import { useSyncExternalStore } from 'react';
import { can, currentUser, getErp } from './erp';
import { materials } from './stock';

export type Budget = { branchId: string; period: string; limit: number; block: boolean };
export type Commitment = { id: string; branchId: string; period: string; value: number; spent: number };
let state = { budgets: getErp().branches.map(b => ({ branchId: b.id, period: '2026-11', limit: 25000, block: false })), commitments: [
  { id: 'po2', branchId: 'cd', period: '2026-11', value: 7210, spent: 0 },
  { id: 'o2', branchId: 'c2', period: '2026-11', value: 50 * (materials.find(m => m.id === 'm5')?.cost ?? 0) + 30 * (materials.find(m => m.id === 'm12')?.cost ?? 0), spent: 0 },
] as Commitment[] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
export const useBudgets = () => useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
export const getBudgets = () => state;
export function budgetImpact(budget: Budget | undefined, commitments: Commitment[], value: number, excludeId?: string) {
  if (!budget) return { configured: false, limit: 0, committed: 0, spent: 0, available: 0, after: 0, exceeded: false };
  const scoped = commitments.filter(c => c.branchId === budget.branchId && c.period === budget.period && c.id !== excludeId);
  const committed = scoped.reduce((sum, c) => sum + c.value, 0), spent = scoped.reduce((sum, c) => sum + c.spent, 0);
  return { configured: true, limit: budget.limit, committed, spent, available: budget.limit - committed, after: budget.limit - committed - value, exceeded: committed + value > budget.limit };
}
export function budgetCheck(branchId: string, value: number, id: string, period = new Date().toISOString().slice(0, 7)) {
  const budget = state.budgets.find(b => b.branchId === branchId && b.period === period);
  if (!Number.isFinite(value) || value < 0) return 'Valor de compromisso inválido';
  return budget?.block && budgetImpact(budget, state.commitments, value, id).exceeded ? 'O pedido excede o orçamento do centro de custo' : null;
}
export function commitBudget(id: string, branchId: string, value: number, period = new Date().toISOString().slice(0, 7), spent = 0) {
  state = { ...state, commitments: [...state.commitments.filter(c => c.id !== id), { id, branchId, period, value, spent }] }; emit();
}
export function releaseBudget(id: string) { state = { ...state, commitments: state.commitments.filter(c => c.id !== id) }; emit(); }
export function saveBudget(budget: Budget) {
  if (!can(currentUser(), getErp().roles, 'compras.gerenciar', budget.branchId)) return 'Sem permissão para configurar orçamento';
  if (!getErp().branches.some(b => b.id === budget.branchId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(budget.period) || !Number.isFinite(budget.limit) || budget.limit < 0) return 'Confira filial, mês e limite';
  state = { ...state, budgets: [...state.budgets.filter(b => b.branchId !== budget.branchId || b.period !== budget.period), { ...budget }] }; emit(); return null;
}