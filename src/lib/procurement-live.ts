import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api";
import { getAccessToken, useAuth } from "@/lib/auth";
import { useErp, type ErpRole, type ErpUser, type Permission } from "@/lib/erp";
import type { Budget, Commitment } from "@/lib/procurement-budget";
import type { Order, OrderStatus, Priority, Result } from "@/lib/orders";
import type { WorkflowKind, WorkflowTemplate } from "@/lib/order-workflow";
import type { PurchaseOrder, Quote, Supplier } from "@/lib/purchasing";
import type { SupplierRequest } from "@/lib/supplier-orders";
import type { ImportItem } from "@/lib/order-csv";
import { loadStock } from "@/lib/stock-live";
import { publishAutomation } from "@/lib/automation-bus";
import { eventById, procurementEvent } from "@/lib/automation-catalog";

type Directory = { branches: { id: string; name: string; type: string; active: boolean; costCenter: string }[]; users: ErpUser[]; roles: ErpRole[] };
type Snapshot = {
  orders: Order[];
  suppliers: Supplier[];
  purchases: PurchaseOrder[];
  requests: SupplierRequest[];
  budgets: Budget[];
  commitments: Commitment[];
  workflows: Record<WorkflowKind, WorkflowTemplate>;
  links: Record<string, Record<string, string>>;
  directory: Directory;
};
type Response = Snapshot & { stockChanged?: boolean };

const emptyDirectory: Directory = { branches: [], users: [], roles: [] };
let state: Snapshot = { orders: [], suppliers: [], purchases: [], requests: [], budgets: [], commitments: [], workflows: { cd: { name: "Aprovação de materiais", steps: [] }, supplier: { name: "Conferência de compra", steps: [] } }, links: {}, directory: emptyDirectory };
let purchasing = { pos: state.purchases, sup: state.suppliers };
let budgets = { budgets: state.budgets, commitments: state.commitments };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const listen = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };

function publish() {
  purchasing = { pos: state.purchases, sup: state.suppliers };
  budgets = { budgets: state.budgets, commitments: state.commitments };
  emit();
}
function apply(data: Response) {
  state = { orders: data.orders, suppliers: data.suppliers, purchases: data.purchases, requests: data.requests, budgets: data.budgets, commitments: data.commitments, workflows: data.workflows, links: data.links, directory: data.directory };
  publish();
  if (data.stockChanged) void loadStock();
}
function failure(error: unknown) {
  return error instanceof ApiError ? error.message : "Não foi possível concluir a operação.";
}
async function send(path: string, body?: unknown, method = "POST") {
  const data = await apiRequest<Response>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }, getAccessToken());
  apply(data);
  return data;
}
function emitProcurement(path: string, title?: string, ref?: string) {
  const mapped = procurementEvent(path);
  if (!mapped) return;
  const id = path.split("/")[4];
  const order = state.orders.find((item) => item.id === id);
  const purchase = state.purchases.find((item) => item.id === id);
  const request = state.requests.find((item) => item.id === id);
  publishAutomation({ module: mapped.module, event: mapped.event, title: title || order?.number || purchase?.number || request?.number || eventById(mapped.event)?.label || mapped.event, ref: ref || id || path, status: order?.status || purchase?.status || request?.status });
}
async function attempt(path: string, body?: unknown, method = "POST") {
  try { await send(path, body, method); emitProcurement(path); return null; }
  catch (error) { return failure(error); }
}

let loading: Promise<void> | null = null;
export function loadProcurement() {
  if (!getAccessToken()) return Promise.resolve();
  if (!loading) loading = send("/api/procurement", undefined, "GET").then(() => undefined).catch((error: unknown) => { toast.error(failure(error)); }).finally(() => { loading = null; });
  return loading;
}
export function resetProcurement() {
  state = { orders: [], suppliers: [], purchases: [], requests: [], budgets: [], commitments: [], workflows: { cd: { name: "Aprovação de materiais", steps: [] }, supplier: { name: "Conferência de compra", steps: [] } }, links: {}, directory: emptyDirectory };
  publish();
}

export const useOrders = () => useSyncExternalStore(listen, () => state.orders, () => state.orders);
export const usePurchasing = () => useSyncExternalStore(listen, () => purchasing, () => purchasing);
export const useSupplierRequests = () => useSyncExternalStore(listen, () => state.requests, () => state.requests);
export const useBudgets = () => useSyncExternalStore(listen, () => budgets, () => budgets);
export const useWorkflowTemplates = () => useSyncExternalStore(listen, () => state.workflows, () => state.workflows);
export const getSupplierLinks = (id: string) => state.links[id] ?? {};
export const branchName = (id: string) => state.directory.branches.find((branch) => branch.id === id)?.name ?? id;
export const userName = (id: string) => state.directory.users.find((user) => user.id === id)?.name ?? id;
export function useProcurementErp() {
  return useSyncExternalStore(listen, () => state.directory, () => state.directory);
}

export function useProcurementSession() {
  const auth = useAuth();
  const header = useErp();
  const directory = useProcurementErp();
  const ids = directory.branches.map((branch) => branch.id);
  const global = auth.user?.memberships.some((membership) => membership.scope === "all") ?? false;
  const visible = !auth.user || global ? ids : ids.filter((id) => auth.user?.memberships.some((membership) => membership.branchId === id));
  const filter = ids.includes(header.branchFilter) ? header.branchFilter : "all";
  const listed = directory.users.find((user) => user.id === auth.user?.id);
  const user: ErpUser = listed ?? { id: auth.user?.id ?? "", name: auth.user?.name ?? "Usuário", email: auth.user?.email ?? "", initials: auth.user?.initials ?? "", color: auth.user?.color ?? "#0f766e", memberships: [] };
  return {
    user, visible, filter,
    scope: filter === "all" ? visible : [filter],
    can: (permission: Permission, branchId?: string) => Boolean(auth.user?.permissions.includes(permission) && (!branchId || global || auth.user.memberships.some((membership) => membership.branchId === branchId))),
  };
}

export const statusLabels: Record<OrderStatus, string> = {
  rascunho: "Rascunho", enviado: "Aguardando aprovação", correcao: "Correção solicitada", rejeitado: "Rejeitado", aprovado: "Aguardando separação",
  separacao: "Em separação", transporte: "Em transporte", recebido_parcial: "Parcialmente recebido", concluido: "Concluído", cancelado: "Cancelado",
};
export const kanbanColumns: OrderStatus[] = ["enviado", "aprovado", "separacao", "transporte", "recebido_parcial", "concluido"];
export const isLate = (order: Order) => !["concluido", "cancelado", "rejeitado"].includes(order.status) && order.desiredDate < new Date().toISOString().slice(0, 10);
export const poLabels = { requisicao: "Requisição", cotacao: "Em cotação", aprovado: "Aprovado", enviado: "Pedido enviado", recebido_parcial: "Recebido parcialmente", recebido: "Recebido", cancelado: "Cancelado" };
export const supplierStatus = { rascunho: "Rascunho", aguardando: "Aguardando preços", resposta: "Em conferência", aprovado: "Compra aprovada", correcao: "Correção solicitada" };

export async function saveDraft(input: { branchId: string; priority: Priority; desiredDate: string; notes: string; items: { materialId: string; requested: number }[] }, id?: string): Promise<Result> {
  try {
    const existed = Boolean(id && state.orders.some((item) => item.id === id));
    const data = await send("/api/procurement/orders", { ...input, id });
    const order = data.orders.find((item) => item.id === id) ?? data.orders[0];
    if (!order) return { ok: false, error: "Pedido não encontrado." };
    if (!existed) emitProcurement("/api/procurement/orders", order.number, order.id);
    return { ok: true, order };
  } catch (error) { return { ok: false, error: failure(error) }; }
}
const act = (id: string, action: string, body: Record<string, unknown> = {}) => attempt(`/api/procurement/orders/${id}/${action}`, body);
export const actions = {
  submit: (id: string) => act(id, "submit"),
  approve: (id: string, quantities?: Record<string, number>, note = "") => act(id, "approve", { quantities, note }),
  reject: (id: string, note: string, correction = false) => act(id, correction ? "correct" : "reject", { note }),
  pick: (id: string, quantities: Record<string, number>) => act(id, "pick", { quantities }),
  ship: (id: string) => act(id, "ship"),
  receive: (id: string, quantities: Record<string, number>, note?: string) => act(id, "receive", { quantities, note }),
  close: (id: string, note: string) => act(id, "close", { note }),
  cancel: (id: string, note: string) => act(id, "cancel", { note }),
  advance: (id: string, note: string) => act(id, "advance", { note }),
  comment: (id: string, note: string) => attempt("/api/procurement/comments", { kind: "order", id, note }),
  duplicate: async (id: string): Promise<Result> => {
    try {
      const before = new Set(state.orders.map((order) => order.id));
      const data = await send(`/api/procurement/orders/${id}/duplicate`, {});
      const order = data.orders.find((item) => !before.has(item.id));
      return order ? { ok: true, order } : { ok: false, error: "Não foi possível duplicar." };
    } catch (error) { return { ok: false, error: failure(error) }; }
  },
};

export const addSupplier = (input: Omit<Supplier, "id">) => attempt("/api/procurement/suppliers", input);
export const updateSupplier = (input: Supplier) => attempt("/api/procurement/suppliers", input);
export const createRequisition = (branchId: string, items: { materialId: string; qty: number }[], confirmed?: { supplierId: string; prices: Record<string, number> }) => attempt("/api/procurement/purchases", { branchId, items, confirmed });
export const addQuote = (id: string, materialId: string, quote: Quote) => attempt(`/api/procurement/purchases/${id}/quotes`, { materialId, ...quote });
export const approvePo = (id: string, mode: "cost" | "balanced" = "cost") => attempt(`/api/procurement/purchases/${id}/approve`, { mode });
export const sendPo = (id: string) => attempt(`/api/procurement/purchases/${id}/send`, {});
export const receivePo = (id: string, qty: Record<string, number>, details?: { damaged: Record<string, number>; prices: Record<string, number>; notes: string }) => attempt(`/api/procurement/purchases/${id}/receive`, { qty, damaged: details?.damaged ?? {}, prices: details?.prices ?? {}, notes: details?.notes ?? "" });
export async function saveSupplierRequest(input: { branchId: string; supplierId: string; desiredDate: string; priority: string; notes: string; file?: string; items: ImportItem[] }, sendNow: boolean) {
  try {
    const data = await send("/api/procurement/requests", { ...input, send: sendNow });
    const request = data.requests[0];
    if (request) emitProcurement("/api/procurement/requests", request.number, request.id);
    return { request };
  } catch (error) { return { error: failure(error) }; }
}
export const respondSupplierRequest = (id: string, items: ImportItem[], file?: string) => attempt(`/api/procurement/requests/${id}/respond`, { items, file });
export const supplierAction = (id: string, action: "send" | "correction" | "approve" | "advance", note = "") => attempt(`/api/procurement/requests/${id}/action`, { action, note });
export const commentSupplierRequest = (id: string, note: string) => attempt("/api/procurement/comments", { kind: "request", id, note });
export const saveBudget = (budget: Budget) => attempt("/api/procurement/budgets", budget, "PUT");
export const saveWorkflowTemplate = (kind: WorkflowKind, template: WorkflowTemplate) => attempt(`/api/procurement/workflows/${kind}`, template, "PUT");
