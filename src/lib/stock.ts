import { useSyncExternalStore } from "react";

export type Clinic = { id: string; name: string; city: string };
export type Material = {
  id: string; code: string; sku: string; name: string; category: string; brand: string;
  unit: string; cost: number; min: number; max: number; lotControl: boolean;
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

type State = { balances: Balance[]; lots: Lot[]; movements: Movement[]; transfers: Transfer[] };
let state: State = { balances: seedBalances(), lots: seedLots, movements: seedMovements, transfers: seedTransfers };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export function useStock() { return useSyncExternalStore(subscribe, () => state, () => state); }

export const getMaterial = (id: string) => materials.find(x => x.id === id)!;
export const getClinic = (id: string) => clinics.find(x => x.id === id)!;
export const balanceOf = (s: State, materialId: string, clinicId?: string) =>
  s.balances.filter(b => b.materialId === materialId && (!clinicId || b.clinicId === clinicId)).reduce((a, b) => a + b.qty, 0);

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
  const mv: Movement = { ...input, id: `mv${Date.now()}`, number: `MOV-${1200 + state.movements.length}`, date: new Date().toISOString().slice(0, 10) };
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
}

export const daysUntil = (iso: string) => Math.round((Date.parse(iso) - Date.UTC(2026, 10, 11)) / 86400000);
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
