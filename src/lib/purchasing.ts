import { useSyncExternalStore } from "react";
import { applyDelta, logMovement } from "./stock";
import { can, currentUser, getErp } from "./erp";
import { rankQuotes, validateReceipt, type PurchaseReceipt } from "./procurement-rules";
import { budgetCheck, commitBudget } from "./procurement-budget";
import { materials } from "./stock";

export type Supplier = { id: string; name: string; cnpj: string; contact: string; email: string; leadDays: number; rating: number; categories: string[]; phone?: string; address?: string; city?: string; state?: string; notes?: string; portalEnabled?: boolean; portalEmail?: string; portalContact?: string };
export type PoStatus = "requisicao" | "cotacao" | "aprovado" | "enviado" | "recebido_parcial" | "recebido" | "cancelado";
export type Quote = { supplierId: string; unitPrice: number; days: number; freight?: number };
export type PoItem = { materialId: string; qty: number; received: number; quotes: Quote[]; chosen?: string };
export type PurchaseOrder = { id: string; number: string; branchId: string; status: PoStatus; createdAt: string; items: PoItem[]; receipts?: PurchaseReceipt[]; events?: { at: string; action: string; user: string; notes?: string }[] };

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
export function updateSupplier(s: Supplier) { const g = guard(); if (g) return g; if (!s.name.trim()) return "Informe o nome"; if (!sup.some(x => x.id === s.id)) return "Fornecedor não encontrado"; set(pos, sup.map(x => x.id === s.id ? { ...s } : x)); return null; }
export function createRequisition(branchId: string, items: { materialId: string; qty: number }[], confirmed?: { supplierId: string; prices: Record<string, number> }) {
  const g = guard(); if (g) return g; if (!items.length || new Set(items.map(i => i.materialId)).size !== items.length || items.some(i => !materials.some(m => m.id === i.materialId) || !Number.isFinite(i.qty) || i.qty <= 0)) return "Adicione materiais e quantidades válidas";
  if (!getErp().branches.some(b => b.id === branchId && b.active) || !can(currentUser(), getErp().roles, "compras.gerenciar", branchId)) return "Sem acesso à filial";
  if (confirmed && (!sup.some(s => s.id === confirmed.supplierId) || items.some(i => !Number.isFinite(confirmed.prices[i.materialId]) || confirmed.prices[i.materialId] < 0))) return "Fornecedor ou preços confirmados inválidos";
  const id = crypto.randomUUID();
  const total = confirmed ? items.reduce((sum, i) => sum + i.qty * (confirmed.prices[i.materialId] ?? 0), 0) : 0;
  if (confirmed) { const error = budgetCheck(branchId, total, id); if (error) return error; commitBudget(id, branchId, total); }
  set([{ id, events: [{ at: new Date().toISOString(), action: confirmed ? "Compra aprovada" : "Requisição criada", user: currentUser().name }], number: `OC-${2042 + pos.length}`, branchId, status: confirmed ? "aprovado" : "requisicao", createdAt: new Date().toISOString().slice(0, 10), items: items.map(i => ({ ...i, received: 0, quotes: confirmed ? [{ supplierId: confirmed.supplierId, unitPrice: confirmed.prices[i.materialId] ?? 0, days: 0 }] : [], chosen: confirmed?.supplierId })) }, ...pos]); return null;
}
export function addQuote(poId: string, materialId: string, q: Quote) {
  const g = guard(); if (g) return g;
  const po = pos.find(p => p.id === poId);
  if (!po || !["requisicao", "cotacao"].includes(po.status) || !po.items.some(i => i.materialId === materialId)) return "Compra não está aberta para cotação";
  if (!sup.some(s => s.id === q.supplierId) || ![q.unitPrice, q.days, q.freight ?? 0].every(n => Number.isFinite(n) && n >= 0)) return "Cotação inválida";
  set(pos.map(p => p.id !== poId ? p : { ...p, status: "cotacao", items: p.items.map(i => i.materialId !== materialId ? i : { ...i, quotes: [...i.quotes.filter(x => x.supplierId !== q.supplierId), q] }) })); return null;
}
/** Selection compares landed cost or a balanced score; receiving alone changes stock. */
export function approvePo(poId: string, mode: 'cost' | 'balanced' = 'cost') {
  const g = guard(); if (g) return g;
  const p = pos.find(x => x.id === poId); if (!p || !['requisicao', 'cotacao'].includes(p.status)) return 'Compra não está em cotação';
  if (p.items.some(i => !i.quotes.length)) return 'Todos os itens precisam de ao menos uma cotação';
  const items = p.items.map(i => ({ ...i, chosen: rankQuotes(i.quotes, i.qty, sup, mode)[0]?.supplierId }));
  const total = items.reduce((a, i) => a + (rankQuotes(i.quotes, i.qty, sup, mode)[0]?.total ?? 0), 0);
  const error = budgetCheck(p.branchId, total, p.id); if (error) return error;
  commitBudget(p.id, p.branchId, total);
  set(pos.map(x => x.id !== poId ? x : { ...x, status: 'aprovado', items, events: [...(x.events ?? []), { at: new Date().toISOString(), action: 'Cotação aprovada', user: currentUser().name, notes: mode === 'cost' ? 'Menor custo total' : 'Custo, prazo e avaliação' }] })); return null;
}
export function sendPo(poId: string) {
  const g = guard(); if (g) return g;
  const p = pos.find(x => x.id === poId); if (!p || p.status !== 'aprovado') return 'Compra não está aprovada';
  set(pos.map(x => x.id !== poId ? x : { ...x, status: 'enviado', events: [...(x.events ?? []), { at: new Date().toISOString(), action: 'Ordem enviada ao fornecedor', user: currentUser().name }] })); return null;
}
/** Accepted units alone enter inventory; damage remains outstanding for replacement. */
export function receivePo(poId: string, qty: Record<string, number>, details?: { damaged: Record<string, number>; prices: Record<string, number>; notes: string }) {
  const g = guard(); if (g) return g;
  const p = pos.find(x => x.id === poId); if (!p) return 'Compra não encontrada';
  if (!can(currentUser(), getErp().roles, 'compras.gerenciar', p.branchId)) return 'Sem acesso à filial';
  const lines = Object.fromEntries([...new Set([...Object.keys(qty), ...Object.keys(details?.damaged ?? {}), ...Object.keys(details?.prices ?? {})])].map(id => [id, { accepted: qty[id] ?? 0, damaged: details?.damaged[id] ?? 0, actualPrice: details?.prices[id] }]));
  const error = validateReceipt(p, lines, details?.notes ?? ''); if (error) return error;
  const receipt: PurchaseReceipt = { id: crypto.randomUUID(), at: new Date().toISOString(), user: currentUser().name, notes: details?.notes ?? '', lines };
  for (const i of p.items) {
    const q = qty[i.materialId] ?? 0;
    if (q > 0) { applyDelta(i.materialId, p.branchId, q); logMovement({ type: 'entrada', reason: `Compra ${p.number}`, materialId: i.materialId, clinicId: p.branchId, qty: q, user: currentUser().name }); }
  }
  const items = p.items.map(i => ({ ...i, received: i.received + (qty[i.materialId] ?? 0) }));
  const status = items.every(i => i.received === i.qty) ? 'recebido' : 'recebido_parcial';
  const period = p.createdAt.slice(0, 7);
  const previousSpent = (p.receipts ?? []).reduce((sum, r) => sum + Object.entries(r.lines).reduce((a, [mid, line]) => a + line.accepted * (line.actualPrice ?? p.items.find(i => i.materialId === mid)?.quotes.find(q => q.supplierId === p.items.find(i => i.materialId === mid)?.chosen)?.unitPrice ?? 0), 0), 0);
  const spent = previousSpent + p.items.reduce((sum, i) => sum + (qty[i.materialId] ?? 0) * (details?.prices[i.materialId] ?? i.quotes.find(q => q.supplierId === i.chosen)?.unitPrice ?? 0), 0);
  const outstanding = items.reduce((sum, i) => sum + (i.qty - i.received) * (i.quotes.find(q => q.supplierId === i.chosen)?.unitPrice ?? 0), 0);
  const freight = p.items.reduce((sum, i) => sum + (i.quotes.find(q => q.supplierId === i.chosen)?.freight ?? 0), 0);
  commitBudget(p.id, p.branchId, spent + outstanding + freight, period, spent + (status === 'recebido' ? freight : 0));
  set(pos.map(x => x.id !== poId ? x : { ...x, items, status, receipts: [...(x.receipts ?? []), receipt], events: [...(x.events ?? []), { at: receipt.at, action: status === 'recebido' ? 'Recebimento completo' : 'Recebimento parcial / divergência', user: receipt.user, notes: receipt.notes }] })); return null;
}
