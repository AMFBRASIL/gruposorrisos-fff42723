import { useSyncExternalStore } from "react";
import { applyDelta, logMovement } from "./stock";
import { can, currentUser, getErp } from "./erp";

export type Supplier = { id: string; name: string; cnpj: string; contact: string; email: string; leadDays: number; rating: number; categories: string[] };
export type PoStatus = "requisicao" | "cotacao" | "aprovado" | "enviado" | "recebido_parcial" | "recebido" | "cancelado";
export type Quote = { supplierId: string; unitPrice: number; days: number };
export type PoItem = { materialId: string; qty: number; received: number; quotes: Quote[]; chosen?: string };
export type PurchaseOrder = { id: string; number: string; branchId: string; status: PoStatus; createdAt: string; items: PoItem[] };

export const poLabels: Record<PoStatus, string> = { requisicao: "Requisição", cotacao: "Em cotação", aprovado: "Aprovado", enviado: "Pedido enviado", recebido_parcial: "Recebido parcialmente", recebido: "Recebido", cancelado: "Cancelado" };

const suppliers: Supplier[] = [
  { id: "s1", name: "Dental Sul Distribuidora", cnpj: "11.111.111/0001-11", contact: "Rafael", email: "vendas@dentalsul.exemplo", leadDays: 5, rating: 4.6, categories: ["Materiais odontológicos", "Instrumentais"] },
  { id: "s2", name: "Odonto Master", cnpj: "22.222.222/0001-22", contact: "Patrícia", email: "contato@odontomaster.exemplo", leadDays: 3, rating: 4.2, categories: ["Materiais odontológicos", "Descartáveis"] },
  { id: "s3", name: "ProtecMed EPIs", cnpj: "33.333.333/0001-33", contact: "Diego", email: "pedidos@protecmed.exemplo", leadDays: 7, rating: 4.8, categories: ["EPIs", "Descartáveis", "Limpeza"] },
];
let pos: PurchaseOrder[] = [
  { id: "po1", number: "OC-2041", branchId: "cd", status: "cotacao", createdAt: "2026-11-09", items: [{ materialId: "m3", qty: 200, received: 0, quotes: [{ supplierId: "s2", unitPrice: 31.9, days: 3 }, { supplierId: "s3", unitPrice: 29.5, days: 7 }] }] },
  { id: "po2", number: "OC-2038", branchId: "cd", status: "enviado", createdAt: "2026-11-05", items: [{ materialId: "m1", qty: 60, received: 0, quotes: [{ supplierId: "s1", unitPrice: 86, days: 5 }], chosen: "s1" }, { materialId: "m7", qty: 10, received: 0, quotes: [{ supplierId: "s1", unitPrice: 205, days: 5 }], chosen: "s1" }] },
];
let sup = suppliers;
const ls = new Set<() => void>();
const emit = () => ls.forEach(l => l());
const sub = (l: () => void) => { ls.add(l); return () => ls.delete(l); };
const snap = { get: () => ({ pos, sup }) };
let cache = snap.get();
export const usePurchasing = () => useSyncExternalStore(sub, () => cache, () => cache);
export const getPurchasing = () => cache;
const set = (p: PurchaseOrder[], s = sup) => { pos = p; sup = s; cache = { pos, sup }; emit(); };
const guard = () => can(currentUser(), getErp().roles, "compras.gerenciar") ? null : "Sem permissão para gerenciar compras";

export function addSupplier(s: Omit<Supplier, "id">) { const g = guard(); if (g) return g; if (!s.name.trim()) return "Informe o nome"; set(pos, [...sup, { ...s, id: `s${Date.now()}` }]); return null; }
export function createRequisition(branchId: string, items: { materialId: string; qty: number }[], confirmed?: { supplierId: string; prices: Record<string, number> }) {
  const g = guard(); if (g) return g; if (!items.length) return "Adicione itens";
  if (confirmed && (!sup.some(s => s.id === confirmed.supplierId) || items.some(i => !Number.isFinite(confirmed.prices[i.materialId]) || confirmed.prices[i.materialId] < 0))) return "Fornecedor ou preços confirmados inválidos";
  set([{ id: crypto.randomUUID(), number: `OC-${2042 + pos.length}`, branchId, status: confirmed ? "aprovado" : "requisicao", createdAt: new Date().toISOString().slice(0, 10), items: items.map(i => ({ ...i, received: 0, quotes: confirmed ? [{ supplierId: confirmed.supplierId, unitPrice: confirmed.prices[i.materialId] ?? 0, days: 0 }] : [], chosen: confirmed?.supplierId })) }, ...pos]); return null;
}
export function addQuote(poId: string, materialId: string, q: Quote) {
  const g = guard(); if (g) return g;
  set(pos.map(p => p.id !== poId ? p : { ...p, status: "cotacao", items: p.items.map(i => i.materialId !== materialId ? i : { ...i, quotes: [...i.quotes.filter(x => x.supplierId !== q.supplierId), q] }) })); return null;
}
/** Picks the cheapest quote per item and approves. */
export function approvePo(poId: string) {
  const g = guard(); if (g) return g;
  const p = pos.find(x => x.id === poId)!; if (p.items.some(i => i.quotes.length === 0)) return "Todos os itens precisam de ao menos uma cotação";
  set(pos.map(x => x.id !== poId ? x : { ...x, status: "aprovado", items: x.items.map(i => ({ ...i, chosen: [...i.quotes].sort((a, b) => a.unitPrice - b.unitPrice)[0].supplierId })) })); return null;
}
export function sendPo(poId: string) { const g = guard(); if (g) return g; set(pos.map(x => x.id === poId && x.status === "aprovado" ? { ...x, status: "enviado" } : x)); return null; }
/** Receiving puts stock into the requesting branch; can't receive more than ordered. */
export function receivePo(poId: string, qty: Record<string, number>) {
  const g = guard(); if (g) return g;
  const p = pos.find(x => x.id === poId)!;
  if (p.status !== "enviado" && p.status !== "recebido_parcial") return "Pedido de compra não está aguardando entrega";
  if (p.items.some(i => (qty[i.materialId] ?? 0) < 0 || i.received + (qty[i.materialId] ?? 0) > i.qty)) return "Quantidade acima da pedida";
  for (const i of p.items) { const q = qty[i.materialId] ?? 0; if (q > 0) { applyDelta(i.materialId, p.branchId, q); logMovement({ type: "entrada", reason: `Compra ${p.number}`, materialId: i.materialId, clinicId: p.branchId, qty: q, user: currentUser().name }); } }
  const items = p.items.map(i => ({ ...i, received: i.received + (qty[i.materialId] ?? 0) }));
  set(pos.map(x => x.id !== poId ? x : { ...x, items, status: items.every(i => i.received === i.qty) ? "recebido" : "recebido_parcial" })); return null;
}
