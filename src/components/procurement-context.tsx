import { useOrders } from '@/lib/orders';
import { usePurchasing } from '@/lib/purchasing';
import { useSupplierRequests } from '@/lib/supplier-orders';
import { budgetImpact, useBudgets } from '@/lib/procurement-budget';
import { duplicateOrders } from '@/lib/procurement-rules';
import { brl, getMaterial } from '@/lib/stock';
import { useErp } from '@/lib/erp';

export function ProcurementContext({ branchId, items, excludeId }: { branchId: string; items: { materialId: string; requested: number; unitPrice?: number }[]; excludeId?: string }) {
  const orders = useOrders(), requests = useSupplierRequests(), { pos } = usePurchasing(), budgets = useBudgets(), erp = useErp();
  const value = items.reduce((sum, i) => sum + i.requested * (i.unitPrice ?? getMaterial(i.materialId).cost), 0);
  const budget = budgets.budgets.find(b => b.branchId === branchId && b.period === new Date().toISOString().slice(0, 7));
  const impact = budgetImpact(budget, budgets.commitments, value, excludeId);
  const duplicates = duplicateOrders(branchId, items.map(i => i.materialId), orders, requests, pos, excludeId);
  return <section className="space-y-3 border-y border-border py-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">Orçamento · {erp.branches.find(b => b.id === branchId)?.costCenter}</h3><span className="text-xs text-muted-foreground">{budget?.period ?? 'Sem orçamento configurado'}</span></div>{impact.configured ? <><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[['Limite', impact.limit], ['Comprometido', impact.committed], ['Disponível', impact.available], ['Após este pedido', impact.after]].map(([label, val]) => <div key={String(label)}><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold">{brl(Number(val))}</div></div>)}</div>{impact.exceeded && <p className="text-destructive">Orçamento excedido · {budget?.block ? 'aprovação bloqueada' : 'alerta para o aprovador'}</p>}</> : <p className="text-muted-foreground">Nenhum limite definido para este mês.</p>}{duplicates.length > 0 && <div role="status" className="border-l-2 border-warning pl-3 text-warning"><div className="font-semibold">Materiais com pedidos já abertos</div>{duplicates.map(d => <p key={d.id} className="text-xs mt-1">{d.number} · {d.materials.map(id => getMaterial(id).name).join(', ')}</p>)}</div>}</section>;
}