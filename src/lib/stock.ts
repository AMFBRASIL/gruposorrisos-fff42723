import { useSyncExternalStore } from "react";
import { fefo } from './stock-intelligence';

export type Clinic = { id: string; name: string; city: string };
export type Material = {
  id: string; code: string; sku: string; name: string; category: string; brand: string;
  unit: string; cost: number; min: number; max: number; lotControl: boolean;
  barcode?: string; approvalCertificate?: string; supplierId?: string; manufacturer?: string; description?: string;
  averageCost?: number; expiryControl?: boolean; supplier?: string; anvisa?: string; caExpires?: string;
  abcClass?: string; createdAt?: string; updatedAt?: string;
};
export type Balance = { materialId: string; clinicId: string; qty: number; reserved: number };
export type Lot = { id: string; materialId: string; clinicId: string; lot: string; expires: string; qty: number };
export type MovementType = "entrada" | "saida" | "transferencia";
export type Movement = {
  id: string; number: string; type: MovementType; reason: string; materialId: string;
  clinicId: string; toClinicId?: string; qty: number; user: string; date: string;
};
export type TransferStatus = "solicitada" | "aprovada" | "separacao" | "transito" | "recebida" | "concluida";
export type Transfer = { id: string; number: string; fromId: string; toId: string; items: { materialId: string; qty: number }[]; status: TransferStatus; date: string };

export const clinics: Clinic[] = [
  { id: "cd", name: "Centro de Distribuição", city: "São Paulo" },
  { id: "c1", name: "Sorrisos Paulista", city: "São Paulo" },
  { id: "c2", name: "Sorrisos Moema", city: "São Paulo" },
  { id: "c3", name: "Sorrisos Campinas", city: "Campinas" },
  { id: "c4", name: "Sorrisos Santos", city: "Santos" },
];

export const categories = ["Materiais odontológicos", "Descartáveis", "Equipamentos", "Instrumentais", "Limpeza", "Escritório", "EPIs", "Administrativos", "Outros"];

const m = (i: number, name: string, category: string, brand: string, unit: string, cost: number, min: number, max: number, lotControl = true): Material =>
  ({ id: `m${i}`, code: `MAT-${String(i).padStart(4, "0")}`, sku: `SKU${1000 + i}`, name, category, brand, unit, cost, min, max, lotControl });

export const materials: Material[] = [
  m(1, "Resina composta A2", "Materiais odontológicos", "3M", "seringa", 89.9, 20, 120),
  m(2, "Anestésico Lidocaína 2%", "Materiais odontológicos", "DFL", "caixa", 145, 15, 80),
  m(3, "Luva de procedimento M", "EPIs", "Supermax", "caixa", 32.5, 40, 300),
  m(4, "Máscara tripla", "EPIs", "Descarpack", "caixa", 18.9, 30, 250),
  m(5, "Sugador descartável", "Descartáveis", "SSPlus", "pacote", 12.4, 50, 400),
  m(6, "Broca diamantada 1012", "Instrumentais", "KG Sorensen", "unidade", 9.8, 30, 200),
  m(7, "Ionômero de vidro", "Materiais odontológicos", "FGM", "kit", 210, 5, 30),
  m(8, "Álcool 70% 1L", "Limpeza", "Asfer", "frasco", 11.5, 25, 150, false),
  m(9, "Fio de sutura 4-0", "Materiais odontológicos", "Ethicon", "caixa", 98, 8, 50),
  m(10, "Papel A4", "Escritório", "Chamex", "resma", 27.9, 10, 80, false),
  m(11, "Fotopolimerizador LED", "Equipamentos", "Gnatus", "unidade", 1890, 1, 6, false),
  m(12, "Gaze estéril", "Descartáveis", "Cremer", "pacote", 6.7, 60, 500),
];

function seedBalances(): Balance[] {
  const out: Balance[] = [];
  let s = 7;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (const mat of materials) for (const c of clinics) {
    const base = c.id === "cd" ? mat.max * 1.5 : mat.max * 0.5;
    out.push({ materialId: mat.id, clinicId: c.id, qty: Math.round(base * rnd()), reserved: Math.round(rnd() * 5) });
  }
  return out;
}

const day = (offset: number) => { const d = new Date(Date.UTC(2026, 10, 11)); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };

const seedLots: Lot[] = materials.filter(x => x.lotControl).flatMap((mat, i) =>
  clinics.slice(0, 3).map((c, j) => ({ id: `l${i}-${j}`, materialId: mat.id, clinicId: c.id, lot: `L${2600 + i * 7 + j}`, expires: day(((i * 3 + j * 11) % 14) * 15 - 20), qty: 10 + ((i + j) * 7) % 40 })));

const seedMovements: Movement[] = Array.from({ length: 24 }, (_, i) => {
  const types: MovementType[] = ["entrada", "saida", "saida", "transferencia"];
  const type = types[i % 4];
  const reasons = { entrada: "Compra", saida: "Consumo", transferencia: "Entre clínicas" };
  return { id: `mv${i}`, number: `MOV-${String(1200 + i)}`, type, reason: reasons[type], materialId: materials[i % materials.length].id,
    clinicId: type === "transferencia" ? "cd" : clinics[(i % 4) + 1].id, toClinicId: type === "transferencia" ? clinics[(i % 4) + 1].id : undefined,
    qty: 5 + (i * 3) % 30, user: ["Ana Souza", "Carlos Lima", "Bruna Reis"][i % 3], date: day(-i) };
});

const seedTransfers: Transfer[] = [
  { id: "t1", number: "TRF-0451", fromId: "cd", toId: "c1", items: [{ materialId: "m3", qty: 40 }, { materialId: "m4", qty: 30 }], status: "transito", date: day(-1) },
  { id: "t2", number: "TRF-0452", fromId: "cd", toId: "c3", items: [{ materialId: "m1", qty: 15 }], status: "aprovada", date: day(-1) },
  { id: "t3", number: "TRF-0453", fromId: "c2", toId: "c4", items: [{ materialId: "m2", qty: 5 }], status: "solicitada", date: day(0) },
  { id: "t4", number: "TRF-0448", fromId: "cd", toId: "c2", items: [{ materialId: "m5", qty: 100 }, { materialId: "m12", qty: 80 }], status: "separacao", date: day(-2) },
  { id: "t5", number: "TRF-0440", fromId: "cd", toId: "c4", items: [{ materialId: "m8", qty: 20 }], status: "concluida", date: day(-5) },
];

export type InventoryRecord = { id: string; number: string; branchId: string; scope: string; blind: boolean; counted: number; divergences: number; valueIn: number; valueOut: number; user: string; date: string };
type State = { balances: Balance[]; lots: Lot[]; movements: Movement[]; transfers: Transfer[]; inventories: InventoryRecord[] };
let state: State = { balances: seedBalances(), lots: seedLots, movements: seedMovements, transfers: seedTransfers, inventories: [
  { id: "inv1", number: "INV-0031", branchId: "c1", scope: "Completo", blind: true, counted: 12, divergences: 3, valueIn: 89.9, valueOut: 290, user: "Ana Souza", date: day(-20) },
  { id: "inv2", number: "INV-0032", branchId: "c2", scope: "EPIs", blind: false, counted: 2, divergences: 1, valueIn: 0, valueOut: 65, user: "Carlos Lima", date: day(-9) },
  { id: "inv3", number: "INV-0033", branchId: "cd", scope: "Completo", blind: true, counted: 12, divergences: 2, valueIn: 145, valueOut: 37.2, user: "Bruna Reis", date: day(-3) },
] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export function useStock() { return useSyncExternalStore(subscribe, () => state, () => state); }

export const getMaterial = (id: string) => materials.find(x => x.id === id)!;
export const getClinic = (id: string) => clinics.find(x => x.id === id)!;
export const balanceOf = (s: State, materialId: string, clinicId?: string) =>
  s.balances.filter(b => b.materialId === materialId && (!clinicId || b.clinicId === clinicId)).reduce((a, b) => a + b.qty, 0);

/** Low-level balance change used by orders, purchases and inventory. Never lets qty go below zero. */
export function applyDelta(materialId: string, clinicId: string, dQty: number, dReserved = 0): string | null {
  const b = state.balances.find(x => x.materialId === materialId && x.clinicId === clinicId);
  const cur = b ?? { materialId, clinicId, qty: 0, reserved: 0 };
  if (cur.qty + dQty < 0) return "Saldo insuficiente";
  const next = { ...cur, qty: cur.qty + dQty, reserved: Math.max(0, cur.reserved + dReserved) };
  state = { ...state, balances: b ? state.balances.map(x => x === b ? next : x) : [...state.balances, next] };
  emit();
  return null;
}
export function logMovement(mv: Omit<Movement, "id" | "number" | "date">) {
  const full: Movement = { ...mv, id: `mv${Date.now()}${Math.random()}`, number: `MOV-${1200 + state.movements.length}`, date: new Date().toISOString().slice(0, 10) };
  state = { ...state, movements: [full, ...state.movements] };
  emit();
}
export function getState() { return state; }
export function consumeLots(allocations: { lotId: string; qty: number }[]) {
  state = { ...state, lots: state.lots.map(l => ({ ...l, qty: l.qty - allocations.filter(a => a.lotId === l.id).reduce((sum, a) => sum + a.qty, 0) })) }; emit();
}
export function addClinic(c: Clinic) {
  if (clinics.some(x => x.id === c.id)) return;
  clinics.push(c);
  state = { ...state, balances: [...state.balances, ...materials.map(mt => ({ materialId: mt.id, clinicId: c.id, qty: 0, reserved: 0 }))] };
  emit();
}

/** Applies a movement. Returns an error message when it would leave negative stock. */
export function registerMovement(input: Omit<Movement, "id" | "number" | "date">): string | null {
  if (input.qty <= 0) return "Quantidade deve ser maior que zero";
  const out = input.type !== "entrada";
  if (out && balanceOf(state, input.materialId, input.clinicId) < input.qty) return "Saldo insuficiente na origem";
  if (input.type === "transferencia" && (!input.toClinicId || input.toClinicId === input.clinicId)) return "Escolha um destino diferente da origem";
  const balances = state.balances.map(b => {
    if (b.materialId !== input.materialId) return b;
    if (b.clinicId === input.clinicId) return { ...b, qty: b.qty + (out ? -input.qty : input.qty) };
    if (input.type === "transferencia" && b.clinicId === input.toClinicId) return { ...b, qty: b.qty + input.qty };
    return b;
  });
  const mv: Movement = { ...input, id: crypto.randomUUID(), number: `MOV-${1200 + state.movements.length}`, date: new Date().toISOString().slice(0, 10) };
  state = { ...state, balances, movements: [mv, ...state.movements] };
  emit();
  return null;
}

const flow: TransferStatus[] = ["solicitada", "aprovada", "separacao", "transito", "recebida", "concluida"];
export const transferLabels: Record<TransferStatus, string> = { solicitada: "Solicitada", aprovada: "Aprovada", separacao: "Em separação", transito: "Em trânsito", recebida: "Recebida", concluida: "Concluída" };
export const transferFlow = flow;
export function advanceTransfer(id: string) {
  state = { ...state, transfers: state.transfers.map(t => {
    if (t.id !== id) return t;
    const next = flow[Math.min(flow.indexOf(t.status) + 1, flow.length - 1)];
    return { ...t, status: next };
  }) };
  emit();
  const t = state.transfers.find(x => x.id === id)!;
  // Stock leaves origin when shipped and enters destination when received — each happens once because status only moves forward.
  if (t.status === "transito") for (const i of t.items) { applyDelta(i.materialId, t.fromId, -Math.min(i.qty, balanceOf(state, i.materialId, t.fromId))); }
  if (t.status === "recebida") for (const i of t.items) { applyDelta(i.materialId, t.toId, i.qty); logMovement({ type: "transferencia", reason: `Transferência ${t.number}`, materialId: i.materialId, clinicId: t.fromId, toClinicId: t.toId, qty: i.qty, user: "Sistema" }); }
}

export const daysUntil = (iso: string) => Math.round((Date.parse(iso) - Date.UTC(2026, 10, 11)) / 86400000);
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function addMaterial(m: Omit<Material, "id">, initial: { clinicId: string; qty: number }[] = []): string | null {
  if (!m.name.trim()) return "Informe o nome do material";
  if (!m.code.trim()) return "Informe o código do material";
  if (!m.category.trim() || !m.unit.trim()) return "Informe categoria e unidade de medida";
  if (m.category === "EPIs" && !m.approvalCertificate?.trim()) return "Informe o Certificado de Aprovação (CA) para EPIs";
  if (m.barcode?.trim() && materials.some(x => x.barcode === m.barcode?.trim())) return "Código de barras já cadastrado";
  if (materials.some(x => x.code === m.code)) return "Código já cadastrado";
  if (m.min < 0 || m.max < m.min) return "Estoque máximo deve ser maior ou igual ao mínimo";
  const id = crypto.randomUUID();
  materials.push({ ...m, id });
  state = { ...state, balances: [...state.balances, ...clinics.map(c => ({ materialId: id, clinicId: c.id, qty: Math.max(0, initial.find(i => i.clinicId === c.id)?.qty ?? 0), reserved: 0 }))] };
  emit();
  return null;
}

export function createTransfer(input: { fromId: string; toId: string; items: { materialId: string; qty: number }[] }): string | null {
  if (input.fromId === input.toId) return "Origem e destino devem ser diferentes";
  if (input.items.length === 0 || input.items.some(i => i.qty <= 0)) return "Adicione itens com quantidade maior que zero";
  for (const i of input.items) if (balanceOf(state, i.materialId, input.fromId) < i.qty) return `Saldo insuficiente de ${getMaterial(i.materialId).name} na origem`;
  const t: Transfer = { id: `t${Date.now()}`, number: `TRF-${String(454 + state.transfers.length).padStart(4, "0")}`, fromId: input.fromId, toId: input.toId, items: input.items, status: "solicitada", date: new Date().toISOString().slice(0, 10) };
  state = { ...state, transfers: [t, ...state.transfers] };
  emit();
  return null;
}

export function addLot(l: Omit<Lot, "id">): string | null {
  if (!l.lot.trim()) return "Informe o número do lote";
  if (l.qty <= 0) return "Quantidade deve ser maior que zero";
  state = { ...state, lots: [{ ...l, id: crypto.randomUUID() }, ...state.lots] };
  emit();
  return null;
}

/** Registers several movements at once; validates all lines before changing any balance. */
export function registerMovements(lines: Omit<Movement, "id" | "number" | "date">[]): string | null {
  if (lines.length === 0) return "Adicione ao menos um material";
  const need: Record<string, number> = {};
  for (const l of lines) {
    if (!Number.isFinite(l.qty) || l.qty <= 0) return `Quantidade inválida para ${getMaterial(l.materialId).name}`;
    if (l.type === "transferencia" && (!l.toClinicId || l.toClinicId === l.clinicId)) return "Escolha um destino diferente da origem";
    if (l.type !== "entrada") { const key = `${l.clinicId}:${l.materialId}`; need[key] = (need[key] ?? 0) + l.qty; }
  }
  for (const [key, q] of Object.entries(need)) { const [cid, mid] = key.split(':'); if (balanceOf(state, mid, cid) < q) return `Saldo insuficiente de ${getMaterial(mid).name} na origem`; }
  const lotNeeds = lines.filter(l => l.type === 'saida' && l.reason.startsWith('Procedimento')).map(l => ({ ...l, plan: fefo(state.lots, l.materialId, l.clinicId, l.qty) }));
  if (lotNeeds.some(l => getMaterial(l.materialId).lotControl && l.plan.shortage > 0)) return 'Lotes válidos insuficientes para o procedimento';
  for (const l of lines) { const e = registerMovement(l); if (e) return e; }
  consumeLots(lotNeeds.flatMap(l => l.plan.allocations));
  return null;
}

/** Closes an inventory: every counted difference becomes an adjustment movement. */
export function applyInventory(input: { branchId: string; scope: string; blind: boolean; counts: Record<string, number>; user: string }): InventoryRecord {
  let valueIn = 0, valueOut = 0, divergences = 0;
  for (const [mid, cnt] of Object.entries(input.counts)) {
    const diff = cnt - balanceOf(state, mid, input.branchId);
    if (diff === 0) continue;
    divergences++;
    const cost = getMaterial(mid).cost * Math.abs(diff);
    if (diff > 0) valueIn += cost; else valueOut += cost;
    applyDelta(mid, input.branchId, diff);
    logMovement({ type: diff > 0 ? "entrada" : "saida", reason: "Ajuste de inventário", materialId: mid, clinicId: input.branchId, qty: Math.abs(diff), user: input.user });
  }
  const rec: InventoryRecord = { id: `inv${Date.now()}`, number: `INV-${String(34 + state.inventories.length - 3).padStart(4, "0")}`, branchId: input.branchId, scope: input.scope, blind: input.blind, counted: Object.keys(input.counts).length, divergences, valueIn, valueOut, user: input.user, date: new Date().toISOString().slice(0, 10) };
  state = { ...state, inventories: [rec, ...state.inventories] };
  emit();
  return rec;
}
