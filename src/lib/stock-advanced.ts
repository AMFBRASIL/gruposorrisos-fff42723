import { useSyncExternalStore } from 'react';
import { getState, materials, clinics, balanceOf, registerMovements, applyInventory, type InventoryRecord } from './stock';
import { can, currentUser, getErp } from './erp';
import { actions, saveDraft, getOrders } from './orders';
import { createRequisition, getPurchasing } from './purchasing';
import { adjustmentValue, demand, needsApproval, recipeLines, replenishment, ageDays } from './stock-intelligence';
export type Recipe = { id: string; name: string; items: { materialId: string; qty: number }[] };
type InventoryInput = Parameters<typeof applyInventory>[0];
export type Adjustment = { id: string; input: InventoryInput; baseline: Record<string, number>; value: number; requesterId: string; status: 'pendente' | 'aprovado' | 'rejeitado'; reason: string; at: string; reviewer?: string; reviewedAt?: string };
let state = { limit: 500, alertDays: 60, recipes: [
  { id: 'p1', name: 'Limpeza / profilaxia', items: [{ materialId: 'm3', qty: 1 }, { materialId: 'm4', qty: 1 }, { materialId: 'm5', qty: 2 }] },
  { id: 'p2', name: 'Restauração', items: [{ materialId: 'm1', qty: 1 }, { materialId: 'm3', qty: 1 }, { materialId: 'm5', qty: 1 }] },
] as Recipe[], procedures: [] as { id: string; name: string; branchId: string; repetitions: number; at: string; user: string }[], adjustments: [] as Adjustment[], digests: [] as { id: string; branchId: string; at: string; count: number; status: string }[] };
const listeners = new Set<() => void>(); const emit = () => listeners.forEach(l => l());
export const useAdvancedStock = () => useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
export const getAdvancedStock = () => state;
const allowed = (permission: Parameters<typeof can>[2], branchId?: string) => can(currentUser(), getErp().roles, permission, branchId);
export function stockInsights(scope: string[]) {
  const s = getState(), orders = getOrders(), { pos } = getPurchasing();
  return s.balances.filter(b => scope.includes(b.clinicId)).map(b => {
    const m = materials.find(m => m.id === b.materialId); if (!m) return null;
    const incoming = orders.filter(o => o.branchId === b.clinicId && !['concluido', 'cancelado', 'rejeitado'].includes(o.status)).reduce((a, o) => a + o.items.filter(i => i.materialId === m.id).reduce((n, i) => n + Math.max(0, (o.status === 'rascunho' || o.status === 'enviado' || o.status === 'correcao' ? i.requested : i.approved) - i.received), 0), 0)
      + pos.filter(p => p.branchId === b.clinicId && !['recebido', 'cancelado'].includes(p.status)).reduce((a, p) => a + p.items.filter(i => i.materialId === m.id).reduce((n, i) => n + i.qty - i.received, 0), 0);
    const available = Math.max(0, b.qty - b.reserved), source = Math.max(0, balanceOf(s, m.id, 'cd') - (s.balances.find(x => x.materialId === m.id && x.clinicId === 'cd')?.reserved ?? 0));
    return { ...b, material: m, available, incoming, replenish: replenishment(m.min, m.max, available, incoming), channel: b.clinicId !== 'cd' && source > 0 ? 'pedido' : 'compra', ...demand(available, s.movements.filter(mv => mv.clinicId === b.clinicId && mv.materialId === m.id)) };
  }).filter((r): r is NonNullable<typeof r> => r !== null);
}
export function createRestock(branchId: string, channel: string) {
  const rows = stockInsights([branchId]).filter(r => r.replenish > 0 && r.channel === channel);
  if (!rows.length) return 'Não há reposição pendente para este destino';
  if (channel === 'compra') return createRequisition(branchId, rows.map(r => ({ materialId: r.materialId, qty: r.replenish })));
  const result = saveDraft({ branchId, priority: 'normal', desiredDate: '2026-11-17', notes: 'Reposição automática · mínimo/máximo', items: rows.map(r => ({ materialId: r.materialId, requested: r.replenish })) });
  if (!result.ok) return result.error; return actions.submit(result.order.id);
}
export function saveRecipe(name: string, items: Recipe['items']) {
  if (!allowed('estoque.ajustar')) return 'Sem permissão para configurar fichas';
  if (!name.trim() || !recipeLines(items, 1) || items.some(i => !materials.some(m => m.id === i.materialId))) return 'Informe nome e materiais com quantidades positivas';
  const normalized = recipeLines(items, 1); if (!normalized) return 'Ficha inválida';
  state = { ...state, recipes: [...state.recipes, { id: crypto.randomUUID(), name: name.trim(), items: normalized }] }; emit(); return null;
}
export function consumeProcedure(recipeId: string, branchId: string, repetitions: number) {
  if (!allowed('estoque.movimentar', branchId)) return 'Sem permissão para movimentar nesta filial';
  const r = state.recipes.find(r => r.id === recipeId); if (!r) return 'Ficha não encontrada';
  const lines = recipeLines(r.items, repetitions); if (!lines) return 'Informe um número inteiro de procedimentos';
  const error = registerMovements(lines.map(i => ({ ...i, clinicId: branchId, type: 'saida', reason: `Procedimento · ${r.name}`, user: currentUser().name }))); if (error) return error;
  state = { ...state, procedures: [{ id: crypto.randomUUID(), name: r.name, branchId, repetitions, at: new Date().toISOString(), user: currentUser().name }, ...state.procedures] }; emit(); return null;
}
export function submitInventory(input: InventoryInput): { error?: string; record?: InventoryRecord; pending?: boolean } {
  if (!allowed('inventario.realizar', input.branchId)) return { error: 'Sem permissão para inventariar nesta filial' };
  const entries = Object.entries(input.counts); if (!entries.length || entries.some(([id, q]) => !materials.some(m => m.id === id) || !Number.isFinite(q) || q < 0)) return { error: 'Informe contagens válidas e não negativas' };
  const value = adjustmentValue(input.counts, getState().balances, materials, input.branchId);
  if (!needsApproval(value, state.limit)) return { record: applyInventory(input) };
  state = { ...state, adjustments: [{ id: crypto.randomUUID(), input: { ...input, counts: { ...input.counts } }, baseline: Object.fromEntries(entries.map(([id]) => [id, balanceOf(getState(), id, input.branchId)])), value, requesterId: currentUser().id, status: 'pendente', reason: '', at: new Date().toISOString() }, ...state.adjustments] }; emit(); return { pending: true };
}
export function reviewAdjustment(id: string, approve: boolean, reason: string) {
  const a = state.adjustments.find(a => a.id === id); if (!a || a.status !== 'pendente') return 'Ajuste não está pendente';
  if (!allowed('pedidos.aprovar', a.input.branchId)) return 'Sem permissão para aprovar nesta filial';
  if (a.requesterId === currentUser().id) return 'Outro gestor deve revisar este ajuste';
  if (!reason.trim()) return 'Informe o parecer';
  if (approve && Object.entries(a.baseline).some(([id, q]) => balanceOf(getState(), id, a.input.branchId) !== q)) return 'O saldo mudou após a contagem. Rejeite e faça nova contagem';
  if (approve) applyInventory({ ...a.input, user: `${a.input.user} · aprovado por ${currentUser().name}` });
  state = { ...state, adjustments: state.adjustments.map(x => x.id === id ? { ...x, status: approve ? 'aprovado' : 'rejeitado', reason, reviewer: currentUser().name, reviewedAt: new Date().toISOString() } : x) }; emit(); return null;
}
export function configureStock(limit: number, alertDays: number) {
  if (!allowed('estoque.ajustar')) return 'Sem permissão para configurar estoque';
  if (!Number.isFinite(limit) || limit < 0 || !Number.isInteger(alertDays) || alertDays < 1) return 'Limite e antecedência inválidos';
  state = { ...state, limit, alertDays }; emit(); return null;
}
export function stockAlerts(scope: string[]) {
  const rows = stockInsights(scope);
  return [...rows.filter(r => r.available < r.material.min).map(r => ({ id: `low-${r.clinicId}-${r.materialId}`, branchId: r.clinicId, title: r.material.name, detail: `Abaixo do mínimo · ${r.available}/${r.material.min} ${r.material.unit}`, kind: 'Reposição' })),
    ...getState().lots.filter(l => scope.includes(l.clinicId) && l.qty > 0 && -ageDays(l.expires) <= state.alertDays).map(l => ({ id: l.id, branchId: l.clinicId, title: `${materials.find(m => m.id === l.materialId)?.name} · ${l.lot}`, detail: ageDays(l.expires) > 0 ? `Vencido · ${l.expires}` : `Vence em ${-ageDays(l.expires)} dias`, kind: 'Validade' }))];
}
export function simulateDigest(branchId: string) {
  if (!allowed('estoque.visualizar', branchId) || !clinics.some(c => c.id === branchId)) return 'Sem acesso à filial';
  state = { ...state, digests: [{ id: crypto.randomUUID(), branchId, at: new Date().toISOString(), count: stockAlerts([branchId]).length, status: 'Simulado · não enviado' }, ...state.digests] }; emit(); return null;
}
