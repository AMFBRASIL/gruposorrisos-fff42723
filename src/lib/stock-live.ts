import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api";
import { getAccessToken, useAuth } from "@/lib/auth";
import { useSession } from "@/lib/erp";
import { publishAutomation } from "@/lib/automation-bus";
import { eventById, stockEvent } from "@/lib/automation-catalog";
import { demand, replenishment } from "@/lib/stock-intelligence";
import { brl, transferFlow, transferLabels, type Balance, type InventoryRecord, type Lot, type Material, type Movement, type MovementType, type Transfer } from "@/lib/stock";

export type StockClinic = { id: string; name: string; city: string; kind: "cd" | "clinica" | "administracao" };
export type Recipe = { id: string; name: string; items: { materialId: string; qty: number }[] };
export type LiveAdjustment = {
  id: string;
  input: { branchId: string; scope: string; blind: boolean; counts: Record<string, number>; user: string };
  baseline: Record<string, number>;
  value: number;
  requesterId: string;
  status: "pendente" | "aprovado" | "rejeitado";
  reason: string;
  at: string;
  reviewer?: string;
  reviewedAt?: string;
};
type Advanced = {
  limit: number;
  alertDays: number;
  recipes: Recipe[];
  procedures: { id: string; name: string; branchId: string; repetitions: number; at: string; user: string }[];
  adjustments: LiveAdjustment[];
  digests: { id: string; branchId: string; at: string; count: number; status: string }[];
  incoming: { clinicId: string; materialId: string; qty: number }[];
};
type Snapshot = {
  clinics: StockClinic[];
  categories: string[];
  materials: Material[];
  balances: Balance[];
  lots: Lot[];
  movements: Movement[];
  transfers: Transfer[];
  inventories: InventoryRecord[];
  advanced: Advanced;
};
type State = Omit<Snapshot, "clinics" | "categories" | "materials">;

const emptyAdvanced: Advanced = { limit: 500, alertDays: 60, recipes: [], procedures: [], adjustments: [], digests: [], incoming: [] };
let state: State = { balances: [], lots: [], movements: [], transfers: [], inventories: [], advanced: emptyAdvanced };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const materials: Material[] = [];
export const categories: string[] = [];
export const clinics: StockClinic[] = [];
export { brl, transferFlow, transferLabels };
export type { Material, MovementType };

export function useStock() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => state, () => state);
}
export function useAdvancedStock() {
  return useStock().advanced;
}
export function getState() {
  return state;
}

const missingMaterial = (id: string): Material => ({ id, code: "—", sku: "", name: "—", category: "Outros", brand: "", unit: "un", cost: 0, min: 0, max: 0, lotControl: false });
export const getMaterial = (id: string) => materials.find((item) => item.id === id) ?? missingMaterial(id);
export const getClinic = (id: string) => clinics.find((item) => item.id === id) ?? { id, name: "Filial", city: "", kind: "clinica" as const };
export const distributionId = () => clinics.find((clinic) => clinic.kind === "cd")?.id ?? "";
export const branchName = (id: string) => getClinic(id).name;
export const balanceOf = (source: { balances: Balance[] }, materialId: string, clinicId?: string) =>
  source.balances.filter((row) => row.materialId === materialId && (!clinicId || row.clinicId === clinicId)).reduce((sum, row) => sum + row.qty, 0);
export const daysUntil = (iso: string) => {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.parse(iso.slice(0, 10)) - start) / 86400000);
};

function apply(snapshot: Snapshot) {
  materials.splice(0, materials.length, ...snapshot.materials);
  categories.splice(0, categories.length, ...snapshot.categories);
  clinics.splice(0, clinics.length, ...snapshot.clinics);
  state = { balances: snapshot.balances, lots: snapshot.lots, movements: snapshot.movements, transfers: snapshot.transfers, inventories: snapshot.inventories, advanced: snapshot.advanced };
  emit();
}

function authed<T>(path: string, init?: RequestInit) {
  return apiRequest<T>(path, init, getAccessToken());
}
function failure(error: unknown) {
  return error instanceof ApiError ? error.message : "Não foi possível concluir a operação.";
}
async function commit(path: string, body: unknown, method = "POST") {
  try {
    apply(await authed<Snapshot>(path, { method, body: JSON.stringify(body) }));
    const mapped = stockEvent(path);
    if (mapped) publishAutomation({ module: mapped.module, event: mapped.event, title: eventById(mapped.event)?.label || mapped.event, ref: path });
    return null;
  } catch (error) {
    return failure(error);
  }
}

let loading: Promise<void> | null = null;
export function loadStock() {
  if (!getAccessToken()) return Promise.resolve();
  if (!loading) {
    loading = authed<Snapshot>("/api/stock").then(apply).catch((error: unknown) => { toast.error(failure(error)); }).finally(() => { loading = null; });
  }
  return loading;
}
export function resetStock() {
  apply({ clinics: [], categories: [], materials: [], balances: [], lots: [], movements: [], transfers: [], inventories: [], advanced: emptyAdvanced });
}

export function useStockSession() {
  const auth = useAuth();
  const erp = useSession();
  useStock();
  const ids = clinics.map((clinic) => clinic.id);
  const allBranches = auth.user?.memberships.some((membership) => membership.scope === "all") ?? false;
  const allowed = !auth.user || allBranches ? ids : ids.filter((id) => auth.user?.memberships.some((membership) => membership.branchId === id));
  const visible = allowed.length ? allowed : ids;
  const filter = erp.filter === "all" || ids.includes(erp.filter) ? erp.filter : "all";
  const scope = filter === "all" ? visible : visible.filter((id) => id === filter);
  return {
    user: { id: auth.user?.id ?? "", name: auth.user?.name ?? "Usuário" },
    visible, filter, scope: scope.length ? scope : visible,
    can: (permission: string, branchId?: string) => Boolean(auth.user?.permissions.includes(permission) && (!branchId || allBranches || auth.user.memberships.some((membership) => membership.branchId === branchId))),
  };
}

export function stockInsights(scope: string[]) {
  const source = getState();
  const cd = clinics.find((clinic) => clinic.kind === "cd")?.id;
  const today = new Date().toISOString().slice(0, 10);
  return source.balances.filter((row) => scope.includes(row.clinicId)).flatMap((row) => {
    const material = materials.find((item) => item.id === row.materialId);
    if (!material) return [];
    const incoming = source.advanced.incoming.filter((item) => item.clinicId === row.clinicId && item.materialId === row.materialId).reduce((sum, item) => sum + item.qty, 0);
    const available = Math.max(0, row.qty - row.reserved);
    const origin = cd ? Math.max(0, balanceOf(source, material.id, cd)) : 0;
    return [{ ...row, material, available, incoming, replenish: replenishment(material.min, material.max, available, incoming), channel: row.clinicId !== cd && origin > 0 ? "pedido" : "compra", ...demand(available, source.movements.filter((movement) => movement.clinicId === row.clinicId && movement.materialId === material.id), today) }];
  });
}

export function stockAlerts(scope: string[]) {
  const rows = stockInsights(scope);
  return [
    ...rows.filter((row) => row.available < row.material.min).map((row) => ({ id: `low-${row.clinicId}-${row.materialId}`, branchId: row.clinicId, title: row.material.name, detail: `Abaixo do mínimo · ${row.available}/${row.material.min} ${row.material.unit}`, kind: "Reposição" })),
    ...getState().lots.filter((lot) => scope.includes(lot.clinicId) && lot.qty > 0 && daysUntil(lot.expires) <= getState().advanced.alertDays).map((lot) => ({ id: lot.id, branchId: lot.clinicId, title: `${getMaterial(lot.materialId).name} · ${lot.lot}`, detail: daysUntil(lot.expires) < 0 ? `Vencido · ${lot.expires}` : `Vence em ${daysUntil(lot.expires)} dias`, kind: "Validade" })),
  ];
}

export const addMaterial = (input: Omit<Material, "id"> & { description?: string; manufacturer?: string; approvalCertificate?: string; barcode?: string }, initial: { clinicId: string; qty: number }[] = []) =>
  commit("/api/stock/materials", { ...input, initial });

export const updateMaterial = (id: string, input: Omit<Material, "id">) =>
  commit(`/api/stock/materials/${id}`, input, "PATCH");

export const registerMovements = (lines: { type: MovementType; materialId: string; clinicId: string; toClinicId?: string; qty: number; reason: string }[]) =>
  commit("/api/stock/movements", { lines: lines.map((line) => ({ ...line, reason: line.reason.split(" · ")[0], document: line.reason.includes(" · ") ? line.reason.split(" · ").slice(1).join(" · ") : undefined })) });

export const createTransfer = (input: { fromId: string; toId: string; items: { materialId: string; qty: number }[] }) => commit("/api/stock/transfers", input);
export const advanceTransfer = (id: string) => commit(`/api/stock/transfers/${id}/advance`, {});
export const addLot = (input: Omit<Lot, "id">) => commit("/api/stock/lots", { materialId: input.materialId, clinicId: input.clinicId, lot: input.lot, expires: input.expires, qty: input.qty });
export const saveRecipe = (name: string, items: Recipe["items"]) => commit("/api/stock/recipes", { name, items });
export const consumeProcedure = (recipeId: string, branchId: string, repetitions: number) => commit("/api/stock/procedures", { recipeId, branchId, repetitions });
export const configureStock = (limit: number, alertDays: number) => commit("/api/stock/settings", { limit, alertDays }, "PATCH");
export const simulateDigest = (branchId: string) => commit("/api/stock/digests", { branchId });
export const createRestock = (branchId: string, channel: string) => commit("/api/stock/replenishments", { branchId, channel });
export const reviewAdjustment = (id: string, approve: boolean, note: string) => commit(`/api/stock/adjustments/${id}/review`, { approve, note });

export async function submitInventory(input: { branchId: string; scope: string; blind: boolean; user: string; counts: Record<string, number> }) {
  try {
    const data = await authed<Snapshot & { result: { pending: boolean; number: string } }>("/api/stock/inventories", {
      method: "POST",
      body: JSON.stringify({ branchId: input.branchId, scope: input.scope, blind: input.blind, counts: Object.entries(input.counts).map(([materialId, qty]) => ({ materialId, qty })) }),
    });
    apply(data);
    return data.result.pending ? { pending: true } : { record: { number: data.result.number } };
  } catch (error) {
    return { error: failure(error) };
  }
}
