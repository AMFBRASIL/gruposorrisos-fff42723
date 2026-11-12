import { can, type ErpUser, type ErpRole } from './erp';
import { workflowAssignee } from './order-workflow';
import type { Order } from './orders';
import type { SupplierRequest } from './supplier-orders';
import type { PurchaseOrder } from './purchasing';
import type { Adjustment } from './stock-advanced';

export type Pending = { id: string; number: string; branchId: string; kind: string; action: string; due: string; mine: boolean; target: 'cd' | 'supplier' | 'purchase' | 'inventory' };
export function pendingActions(orders: Order[], requests: SupplierRequest[], purchases: PurchaseOrder[], adjustments: Adjustment[], user: ErpUser, roles: ErpRole[], scope: string[]): Pending[] {
  const rows: Pending[] = [];
  for (const o of orders.filter(o => scope.includes(o.branchId) || scope.includes(o.sourceId))) {
    const step = o.workflow?.steps[o.workflow.index];
    const action = o.status === 'enviado' ? step?.name ?? 'Aprovar pedido' : ['aprovado', 'separacao'].includes(o.status) ? 'Separar / expedir' : ['transporte', 'recebido_parcial'].includes(o.status) ? 'Conferir entrega' : o.status === 'correcao' ? 'Corrigir pedido' : '';
    if (!action) continue;
    const mine = o.status === 'enviado' ? step ? workflowAssignee(step, user, roles, o.branchId) : can(user, roles, 'pedidos.aprovar', o.branchId) : ['aprovado', 'separacao'].includes(o.status) ? can(user, roles, 'pedidos.separar', o.sourceId) : o.status === 'correcao' ? o.requesterId === user.id : can(user, roles, 'pedidos.receber', o.branchId);
    rows.push({ id: o.id, number: o.number, branchId: o.branchId, kind: 'Material / CD', action, due: step && o.status === 'enviado' && o.workflow ? new Date(Date.parse(o.workflow.startedAt) + step.hours * 3600000).toISOString() : o.desiredDate, mine, target: 'cd' });
  }
  for (const r of requests.filter(r => scope.includes(r.branchId) && r.status !== 'aprovado')) {
    const step = r.workflow?.steps[r.workflow.index];
    rows.push({ id: r.id, number: r.number, branchId: r.branchId, kind: 'Fornecedor', action: r.status === 'resposta' ? step?.name ?? 'Conferir preços' : r.status === 'rascunho' ? 'Enviar solicitação' : 'Cobrar resposta do fornecedor', due: r.desiredDate, mine: r.status === 'resposta' && step ? workflowAssignee(step, user, roles, r.branchId) : can(user, roles, 'compras.gerenciar', r.branchId), target: 'supplier' });
  }
  for (const p of purchases.filter(p => scope.includes(p.branchId) && !['recebido', 'cancelado'].includes(p.status))) rows.push({ id: p.id, number: p.number, branchId: p.branchId, kind: 'Compra', action: ['enviado', 'recebido_parcial'].includes(p.status) ? 'Conferir recebimento' : p.status === 'aprovado' ? 'Enviar ao fornecedor' : 'Comparar cotações', due: '', mine: can(user, roles, 'compras.gerenciar', p.branchId), target: 'purchase' });
  for (const a of adjustments.filter(a => scope.includes(a.input.branchId) && a.status === 'pendente')) rows.push({ id: a.id, number: `Ajuste ${a.id.slice(0, 6)}`, branchId: a.input.branchId, kind: 'Inventário', action: 'Revisar divergência', due: a.at, mine: a.requesterId !== user.id && can(user, roles, 'pedidos.aprovar', a.input.branchId), target: 'inventory' });
  return rows;
}