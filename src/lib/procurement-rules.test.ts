import { describe, it, expect } from 'vitest';
import { budgetImpact, saveBudget, getBudgets } from './procurement-budget';
import { rankQuotes, validateReceipt, duplicateOrders, procurementMetrics } from './procurement-rules';
import { pendingActions } from './procurement-overview';
import { activateWorkflow, stepApplies, type Workflow } from './order-workflow';
import { getPurchasing, receivePo, approvePo } from './purchasing';
import { getOrders } from './orders';
import { getState, balanceOf } from './stock';
import { seedErpUsers, seedRoles, setCurrentUser } from './erp';

describe('gestão de compras integrada', () => {
  const { pos, sup } = getPurchasing();
  const purchase = pos.find(p => p.id === 'po2');
  if (!purchase) throw new Error('Compra de teste ausente');
  it('central atribui a aprovação ao usuário e respeita o escopo da filial', () => {
    const user = seedErpUsers.find(u => u.id === 'u-maria'); if (!user) throw new Error('Usuário ausente');
    const rows = pendingActions(getOrders(), [], pos, [], user, seedRoles, ['c1']);
    expect(rows.find(r => r.number === 'PED-1001')?.mine).toBe(true);
    expect(rows.some(r => r.branchId === 'c2')).toBe(false);
  });
  it('etapa por valor entra apenas na faixa configurada', () => {
    const step = { id: 'a', name: 'Diretoria', assigneeType: 'user' as const, assigneeId: 'u-carlos', hours: 24, requireNote: false, minValue: 1000, maxValue: 5000 };
    expect(stepApplies(step, { value: 999, branchId: 'c1', categories: [] })).toBe(false);
    expect(stepApplies(step, { value: 1000, branchId: 'c1', categories: [] })).toBe(true);
    expect(stepApplies(step, { value: 5001, branchId: 'c1', categories: [] })).toBe(false);
  });
  it('etapa condicional combina filial e categoria', () => {
    const step = { id: 'a', name: 'EPIs', assigneeType: 'user' as const, assigneeId: 'u-carlos', hours: 24, requireNote: false, branchId: 'c1', category: 'EPIs' };
    expect(stepApplies(step, { value: 10, branchId: 'c1', categories: ['EPIs'] })).toBe(true);
    expect(stepApplies(step, { value: 10, branchId: 'c2', categories: ['EPIs'] })).toBe(false);
    expect(stepApplies(step, { value: 10, branchId: 'c1', categories: ['Limpeza'] })).toBe(false);
  });
  it('preço confirmado reativa etapas do snapshot sem depender de modelos atuais', () => {
    const base = { id: 'base', name: 'Compras', assigneeType: 'user' as const, assigneeId: 'u-carlos', hours: 24, requireNote: false };
    const flow: Workflow = { name: 'Snapshot', steps: [base], candidates: [base, { ...base, id: 'extra', minValue: 1000 }], index: 0, decisions: [], startedAt: '2026-11-12' };
    expect(activateWorkflow(flow, { value: 1500, branchId: 'c1', categories: [] }).steps.map(s => s.id)).toEqual(['base', 'extra']);
  });
  it('saldo do orçamento desconta compromissos e impacto do pedido sem duplicar o próprio', () => {
    const result = budgetImpact({ branchId: 'c1', period: '2026-11', limit: 1000, block: true }, [{ id: 'a', branchId: 'c1', period: '2026-11', value: 600, spent: 200 }, { id: 'own', branchId: 'c1', period: '2026-11', value: 50, spent: 0 }], 500, 'own');
    expect(result.available).toBe(400); expect(result.after).toBe(-100); expect(result.exceeded).toBe(true);
  });
  it('frete muda a menor cotação e avaliação participa do critério equilibrado', () => {
    const quotes = [{ supplierId: 's1', unitPrice: 10, days: 1, freight: 100 }, { supplierId: 's2', unitPrice: 12, days: 3, freight: 0 }];
    expect(rankQuotes(quotes, 10, sup)[0].supplierId).toBe('s2');
    expect(rankQuotes([{ supplierId: 's1', unitPrice: 10, days: 20 }, { supplierId: 's3', unitPrice: 10, days: 1 }], 10, sup, 'balanced')[0].supplierId).toBe('s3');
  });
  it('recebimento exige motivo para danos e divergência de preço e recusa excesso', () => {
    expect(validateReceipt(purchase, { m1: { accepted: 5, damaged: 1 } }, '')).not.toBeNull();
    expect(validateReceipt(purchase, { m1: { accepted: 5, damaged: 0, actualPrice: 90 } }, '')).not.toBeNull();
    expect(validateReceipt(purchase, { m1: { accepted: 60, damaged: 1 } }, 'Danos')).not.toBeNull();
  });
  it('recebimento parcial grava histórico e movimenta apenas aceitos; danos ficam pendentes', () => {
    setCurrentUser('u-carlos');
    const before = balanceOf(getState(), 'm1', 'cd');
    expect(receivePo('po2', { m1: 5 }, { damaged: { m1: 2 }, prices: {}, notes: 'Embalagem danificada' })).toBeNull();
    expect(balanceOf(getState(), 'm1', 'cd')).toBe(before + 5);
    const saved = getPurchasing().pos.find(p => p.id === 'po2');
    expect(saved?.status).toBe('recebido_parcial'); expect(saved?.items.find(i => i.materialId === 'm1')?.received).toBe(5);
    expect(saved?.receipts?.[0].lines.m1.damaged).toBe(2);
    expect(getState().movements.some(m => m.reason === 'Compra OC-2038' && m.qty === 5)).toBe(true);
  });
  it('duplicidade considera mesmo material e filial, sem pedidos concluídos', () => {
    expect(duplicateOrders('c1', ['m1'], getOrders(), [], []).map(o => o.number)).toContain('PED-1001');
    expect(duplicateOrders('c2', ['m1'], getOrders(), [], [])).toEqual([]);
    expect(duplicateOrders('c4', ['m8'], getOrders(), [], [])).toEqual([]);
  });
  it('indicadores calculam aprovação e qualidade de entregas reais do store', () => {
    const result = procurementMetrics(getOrders(), getPurchasing().pos, '2026-11-12');
    expect(result.approvalHours).toBe(24); expect(result.quality).toBeCloseTo(5 / 7 * 100); expect(result.receiptSamples).toBe(1);
  });
  it('configuração de orçamento preserva bloqueio e limite escolhidos', () => {
    setCurrentUser('u-carlos'); expect(saveBudget({ branchId: 'c1', period: '2026-12', limit: 1500, block: true })).toBeNull();
    expect(getBudgets().budgets.find(b => b.branchId === 'c1' && b.period === '2026-12')).toEqual({ branchId: 'c1', period: '2026-12', limit: 1500, block: true });
  });
  it('orçamento bloqueia aprovação da compra sem alterar seu estado', () => {
    setCurrentUser('u-carlos');
    expect(saveBudget({ branchId: 'cd', period: new Date().toISOString().slice(0, 7), limit: 100, block: true })).toBeNull();
    expect(approvePo('po1')).toBe('O pedido excede o orçamento do centro de custo');
    expect(getPurchasing().pos.find(p => p.id === 'po1')?.status).toBe('cotacao');
  });
});