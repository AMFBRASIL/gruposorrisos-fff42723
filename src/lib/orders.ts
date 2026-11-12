import { useSyncExternalStore } from "react";
import { applyDelta, balanceOf, getState as getStock, logMovement } from "./stock";
import { can, currentUser, getErp, type ErpRole, type ErpUser } from "./erp";

export type OrderStatus = "rascunho" | "enviado" | "correcao" | "rejeitado" | "aprovado" | "separacao" | "transporte" | "recebido_parcial" | "concluido" | "cancelado";
export type Priority = "baixa" | "normal" | "alta" | "urgente";
export type OrderItem = { materialId: string; requested: number; approved: number; picked: number; shipped: number; received: number; lot?: string; note?: string };
export type OrderEvent = { at: string; userId: string; action: string; note?: string };
export type Order = {
  id: string; number: string; branchId: string; sourceId: string; requesterId: string; priority: Priority;
  createdAt: string; desiredDate: string; notes: string; status: OrderStatus; items: OrderItem[]; events: OrderEvent[];
};

export const statusLabels: Record<OrderStatus, string> = {
  rascunho: "Rascunho", enviado: "Aguardando aprovação", correcao: "Correção solicitada", rejeitado: "Rejeitado", aprovado: "Aguardando separação",
  separacao: "Em separação", transporte: "Em transporte", recebido_parcial: "Parcialmente recebido", concluido: "Concluído", cancelado: "Cancelado",
};
export const kanbanColumns: OrderStatus[] = ["enviado", "aprovado", "separacao", "transporte", "recebido_parcial", "concluido"];

type Ctx = { user: ErpUser; roles: ErpRole[]; now?: string };
export type Result = { ok: true; order: Order } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const ev = (o: Order, c: Ctx, action: string, note?: string): OrderEvent[] => [...o.events, { at: c.now ?? new Date().toISOString(), userId: c.user.id, action, note }];

/* ---------- pure state machine (tested) ---------- */
export function submitOrder(o: Order, c: Ctx): Result {
  if (o.status !== "rascunho" && o.status !== "correcao") return fail("Só é possível enviar rascunhos ou pedidos em correção");
  if (!can(c.user, c.roles, "pedidos.criar", o.branchId)) return fail("Sem permissão para criar pedidos nesta filial");
  if (o.items.length === 0 || o.items.some(i => i.requested <= 0)) return fail("Adicione materiais com quantidade maior que zero");
  return { ok: true, order: { ...o, status: "enviado", events: ev(o, c, "Pedido enviado") } };
}
/** approvedQty: optional per-item approved quantities (defaults to requested). */
export function approveOrder(o: Order, c: Ctx, approvedQty?: Record<string, number>): Result {
  if (o.status !== "enviado") return fail("Pedido não está aguardando aprovação");
  if (!can(c.user, c.roles, "pedidos.aprovar", o.branchId)) return fail("Sem permissão para aprovar pedidos desta filial");
  const items = o.items.map(i => { const a = approvedQty?.[i.materialId] ?? i.requested; return { ...i, approved: Math.max(0, Math.min(a, i.requested)) }; });
  if (items.every(i => i.approved === 0)) return fail("Aprove ao menos um item");
  return { ok: true, order: { ...o, items, status: "aprovado", events: ev(o, c, "Pedido aprovado") } };
}
export function rejectOrder(o: Order, c: Ctx, reason: string, correction = false): Result {
  if (o.status !== "enviado") return fail("Pedido não está aguardando aprovação");
  if (!can(c.user, c.roles, "pedidos.aprovar", o.branchId)) return fail("Sem permissão para aprovar pedidos desta filial");
  return { ok: true, order: { ...o, status: correction ? "correcao" : "rejeitado", events: ev(o, c, correction ? "Correção solicitada" : "Pedido rejeitado", reason) } };
}
/** picked: per-item quantity separated; cannot exceed approved nor the stock available at the source. */
export function pickOrder(o: Order, c: Ctx, picked: Record<string, number>, available: (materialId: string) => number): Result {
  if (o.status !== "aprovado" && o.status !== "separacao") return fail("Pedido não está liberado para separação");
  if (!can(c.user, c.roles, "pedidos.separar", o.sourceId)) return fail("Sem permissão para separar neste depósito");
  for (const i of o.items) {
    const p = picked[i.materialId] ?? 0;
    if (p < 0 || p > i.approved) return fail("Quantidade separada acima da aprovada");
    if (p > available(i.materialId)) return fail("Estoque insuficiente no depósito para separar");
  }
  const items = o.items.map(i => ({ ...i, picked: picked[i.materialId] ?? 0 }));
  if (items.every(i => i.picked === 0)) return fail("Separe ao menos um item");
  return { ok: true, order: { ...o, items, status: "separacao", events: ev(o, c, "Separação registrada") } };
}
export function shipOrder(o: Order, c: Ctx): Result {
  if (o.status !== "separacao") return fail(o.status === "transporte" ? "Pedido já foi expedido" : "Separe os materiais antes de expedir");
  if (!can(c.user, c.roles, "pedidos.expedir", o.sourceId)) return fail("Sem permissão para expedir");
  return { ok: true, order: { ...o, items: o.items.map(i => ({ ...i, shipped: i.picked })), status: "transporte", events: ev(o, c, "Pedido expedido") } };
}
/** received: quantities received now (added to previous receipts). Total received can never exceed shipped. */
export function receiveOrder(o: Order, c: Ctx, received: Record<string, number>, note?: string): Result {
  if (o.status !== "transporte" && o.status !== "recebido_parcial") return fail("Pedido não está em transporte");
  if (!can(c.user, c.roles, "pedidos.receber", o.branchId)) return fail("Sem permissão para receber nesta filial");
  for (const i of o.items) { const r = received[i.materialId] ?? 0; if (r < 0 || i.received + r > i.shipped) return fail("Quantidade recebida acima da expedida"); }
  const items = o.items.map(i => ({ ...i, received: i.received + (received[i.materialId] ?? 0) }));
  const complete = items.every(i => i.received === i.shipped);
  return { ok: true, order: { ...o, items, status: complete ? "concluido" : "recebido_parcial", events: ev(o, c, complete ? "Recebimento concluído" : "Recebimento parcial", note) } };
}
/** Closes a partially received order, recording the divergence. */
export function closeWithDivergence(o: Order, c: Ctx, note: string): Result {
  if (o.status !== "recebido_parcial") return fail("Só pedidos parcialmente recebidos");
  if (!can(c.user, c.roles, "pedidos.receber", o.branchId)) return fail("Sem permissão");
  return { ok: true, order: { ...o, status: "concluido", events: ev(o, c, "Encerrado com divergência", note) } };
}
const cancellable: OrderStatus[] = ["rascunho", "enviado", "correcao", "aprovado"];
export function cancelOrder(o: Order, c: Ctx, reason: string): Result {
  if (!cancellable.includes(o.status)) return fail("Pedido não pode ser cancelado nesta etapa");
  if (o.requesterId !== c.user.id && !can(c.user, c.roles, "pedidos.aprovar", o.branchId)) return fail("Sem permissão para cancelar");
  return { ok: true, order: { ...o, status: "cancelado", events: ev(o, c, "Pedido cancelado", reason) } };
}

/* ---------- store + stock side effects ---------- */
const d = (off: number) => { const x = new Date(Date.UTC(2026, 10, 11)); x.setUTCDate(x.getUTCDate() + off); return x.toISOString(); };
const it = (materialId: string, requested: number, extra: Partial<OrderItem> = {}): OrderItem => ({ materialId, requested, approved: 0, picked: 0, shipped: 0, received: 0, ...extra });
const seed: Order[] = [
  { id: "o1", number: "PED-1001", branchId: "c1", sourceId: "cd", requesterId: "u-maria", priority: "alta", createdAt: d(-1), desiredDate: d(2).slice(0, 10), notes: "Reposição semanal", status: "enviado", items: [it("m3", 20), it("m1", 10), it("m4", 15)], events: [{ at: d(-1), userId: "u-maria", action: "Pedido enviado" }] },
  { id: "o2", number: "PED-1002", branchId: "c2", sourceId: "cd", requesterId: "u-lucas", priority: "normal", createdAt: d(-2), desiredDate: d(3).slice(0, 10), notes: "", status: "aprovado", items: [it("m5", 50, { approved: 50 }), it("m12", 40, { approved: 30 })], events: [{ at: d(-2), userId: "u-lucas", action: "Pedido enviado" }, { at: d(-1), userId: "u-ana", action: "Pedido aprovado" }] },
  { id: "o3", number: "PED-0998", branchId: "c3", sourceId: "cd", requesterId: "u-carlos", priority: "urgente", createdAt: d(-3), desiredDate: d(-1).slice(0, 10), notes: "Falta de anestésico", status: "transporte", items: [it("m2", 8, { approved: 8, picked: 8, shipped: 8 })], events: [{ at: d(-3), userId: "u-carlos", action: "Pedido enviado" }, { at: d(-2), userId: "u-carlos", action: "Pedido aprovado" }, { at: d(-1), userId: "u-joao", action: "Pedido expedido" }] },
  { id: "o4", number: "PED-0990", branchId: "c4", sourceId: "cd", requesterId: "u-carlos", priority: "baixa", createdAt: d(-8), desiredDate: d(-4).slice(0, 10), notes: "", status: "concluido", items: [it("m8", 12, { approved: 12, picked: 12, shipped: 12, received: 12 })], events: [{ at: d(-8), userId: "u-carlos", action: "Pedido enviado" }, { at: d(-5), userId: "u-carlos", action: "Recebimento concluído" }] },
  { id: "o5", number: "PED-1003", branchId: "c1", sourceId: "cd", requesterId: "u-maria", priority: "normal", createdAt: d(0), desiredDate: d(5).slice(0, 10), notes: "", status: "rascunho", items: [it("m6", 10)], events: [] },
];
let orders = seed;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const useOrders = () => useSyncExternalStore(subscribe, () => orders, () => orders);
const ctx = (): Ctx => ({ user: currentUser(), roles: getErp().roles });
const put = (o: Order) => { orders = orders.some(x => x.id === o.id) ? orders.map(x => x.id === o.id ? o : x) : [o, ...orders]; listeners.forEach(l => l()); };
const available = (sourceId: string) => (mid: string) => {
  const b = getStock().balances.find(x => x.materialId === mid && x.clinicId === sourceId);
  return b ? b.qty : 0;
};

export function saveDraft(input: Pick<Order, "branchId" | "priority" | "desiredDate" | "notes"> & { items: { materialId: string; requested: number }[] }, id?: string): Result {
  const c = ctx();
  if (!can(c.user, c.roles, "pedidos.criar", input.branchId)) return fail("Sem permissão para criar pedidos nesta filial");
  const prev = id ? orders.find(o => o.id === id) : undefined;
  const o: Order = prev ? { ...prev, ...input, items: input.items.map(i => it(i.materialId, i.requested)) } : {
    id: `o${Date.now()}`, number: `PED-${1004 + orders.length}`, sourceId: "cd", requesterId: c.user.id, createdAt: new Date().toISOString(),
    status: "rascunho", events: [], ...input, items: input.items.map(i => it(i.materialId, i.requested)),
  };
  put(o); return { ok: true, order: o };
}
function run(id: string, fn: (o: Order, c: Ctx) => Result, effect?: (before: Order, after: Order) => void): string | null {
  const o = orders.find(x => x.id === id); if (!o) return "Pedido não encontrado";
  const r = fn(o, ctx()); if (!r.ok) return r.error;
  effect?.(o, r.order); put(r.order); return null;
}
export const actions = {
  submit: (id: string) => run(id, submitOrder),
  approve: (id: string, q?: Record<string, number>) => run(id, (o, c) => approveOrder(o, c, q), (_, a) => { for (const i of a.items) applyDelta(i.materialId, a.sourceId, 0, i.approved); }),
  reject: (id: string, reason: string, correction = false) => run(id, (o, c) => rejectOrder(o, c, reason, correction)),
  pick: (id: string, picked: Record<string, number>) => { const o = orders.find(x => x.id === id); return run(id, (x, c) => pickOrder(x, c, picked, available(o?.sourceId ?? "cd"))); },
  ship: (id: string) => run(id, shipOrder, (_, a) => { for (const i of a.items) { applyDelta(i.materialId, a.sourceId, -i.shipped, -i.approved); if (i.shipped) logMovement({ type: "saida", reason: `Expedição ${a.number}`, materialId: i.materialId, clinicId: a.sourceId, qty: i.shipped, user: currentUser().name }); } }),
  receive: (id: string, r: Record<string, number>, note?: string) => run(id, (o, c) => receiveOrder(o, c, r, note), (_, a) => { for (const [mid, q] of Object.entries(r)) if (q > 0) { applyDelta(mid, a.branchId, q); logMovement({ type: "entrada", reason: `Recebimento ${a.number}`, materialId: mid, clinicId: a.branchId, qty: q, user: currentUser().name }); } }),
  close: (id: string, note: string) => run(id, (o, c) => closeWithDivergence(o, c, note)),
  cancel: (id: string, reason: string) => run(id, (o, c) => cancelOrder(o, c, reason), (b) => { if (b.status === "aprovado") for (const i of b.items) applyDelta(i.materialId, b.sourceId, 0, -i.approved); }),
  duplicate: (id: string) => { const o = orders.find(x => x.id === id)!; return saveDraft({ branchId: o.branchId, priority: o.priority, desiredDate: o.desiredDate, notes: o.notes, items: o.items.map(i => ({ materialId: i.materialId, requested: i.requested })) }); },
};
export const isLate = (o: Order) => !["concluido", "cancelado", "rejeitado"].includes(o.status) && o.desiredDate < "2026-11-11";
export { balanceOf };
