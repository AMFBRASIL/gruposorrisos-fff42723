import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { ProcurementContext } from './procurement-context';
import { PurchaseTrace } from './purchase-trace';
import { OrderFigures, OrderLines, OrderStageBoard } from './order-board';
import { OrderActivity } from './order-activity';
import { SupplierResponse } from './supplier-response';
import { useSupplierRequests, supplierStatus, supplierAction, commentSupplierRequest, useProcurementErp as useErp, useProcurementSession as useSession, branchName, usePurchasing } from '@/lib/procurement-live';
import { getMaterial, brl, balanceOf, useStock } from '@/lib/stock-live';
import { stageCursor, workflowAssignee } from '@/lib/order-workflow';

export function SupplierOrderDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const requests = useSupplierRequests(); const erp = useErp(); const ses = useSession(); const { sup } = usePurchasing(); const stock = useStock();
  const [trace, setTrace] = useState(false); const [note, setNote] = useState(''); const [responseOpen, setResponseOpen] = useState(false);
  const askStage = useRef<(() => void) | null>(null);
  const r = requests.find(x => x.id === id); if (!r) return null;
  const current = r.workflow?.steps[r.workflow.index];
  const place = stageCursor(r.workflow);
  const mayApprove = current ? workflowAssignee(current, ses.user, erp.roles, r.branchId) : ses.can('compras.gerenciar', r.branchId);
  const canMove = ses.can('compras.gerenciar', r.branchId) && !!place && !place.finished;
  const items = r.versions.at(-1)?.items ?? r.items;
  const supplier = sup.find(s => s.id === r.supplierId);
  const action = (a: 'send' | 'correction' | 'approve') => { void Promise.resolve(supplierAction(id, a, note)).then(error => { if (error) return toast.error(error); toast.success('Pedido atualizado'); setNote(''); }); };
  const advance = (text: string) => { void Promise.resolve(supplierAction(id, 'advance', text)).then(error => { if (error) return toast.error(error); toast.success(place?.next ? `Pedido agora está em ${place.next.name}` : 'Fluxo concluído'); }); };
  return <><Dialog open onOpenChange={o => !o && onClose()}><DialogContent className="p-0 wide-sheet gap-0 flex flex-col overflow-hidden h-[94dvh]">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5 pr-14">
      <div>
        <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm">{r.number}</span><Badge variant="outline">{supplierStatus[r.status]}</Badge>{place?.current && <Badge variant="outline">Etapa atual: {place.current.name}</Badge>}</div>
        <DialogTitle className="mt-2 text-2xl">Pedido {r.number}</DialogTitle>
        <p className="mt-1 text-sm text-muted-foreground">{supplier?.name ?? 'Fornecedor'} · {branchName(r.branchId)}</p>
      </div>
      {canMove && <Button onClick={() => askStage.current?.()}>{place?.next ? `Atualizar para ${place.next.name}` : 'Concluir fluxo'}</Button>}
    </div>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[['Fornecedor', supplier?.name ?? '—'], ['Filial', branchName(r.branchId)], ['Entrega desejada', r.desiredDate.split('-').reverse().join('/')], ['Prioridade', r.priority], ['Prazo do fornecedor', supplier ? `${supplier.leadDays} dias` : '—'], ['Solicitação', new Date(r.createdAt).toLocaleDateString('pt-BR')]].map(([label, value]) => <div key={label} className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value}</div></div>)}</div>
      <OrderStageBoard workflow={r.workflow} canAdvance={canMove} askRef={askStage} onAdvance={advance} />
      <ProcurementContext branchId={r.branchId} items={items} excludeId={r.purchaseId ?? r.id} />
      {r.purchaseId && <Button variant="outline" onClick={() => setTrace(true)}>Consultar compra, entregas e estoque</Button>}
      <OrderFigures lines={items.map(i => ({ qty: i.requested, price: i.unitPrice ?? getMaterial(i.materialId).cost }))} />
      <OrderLines lines={items.map(i => { const material = getMaterial(i.materialId); return { id: i.materialId, name: material.name, code: material.code, qty: i.requested, unit: material.unit, available: balanceOf(stock, i.materialId, r.branchId), price: i.unitPrice ?? material.cost, note: '' }; })} />
      <Textarea aria-label="Observação da decisão de compra" placeholder="Observação para aprovação ou correção" maxLength={2000} value={note} onChange={e => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">{r.status === 'resposta' && mayApprove && <Button onClick={() => action('approve')}>Aprovar etapa</Button>}{ses.can('compras.gerenciar', r.branchId) && <>{r.status === 'rascunho' && <Button onClick={() => action('send')}>Solicitar preços</Button>}{['aguardando', 'resposta', 'correcao'].includes(r.status) && <Button variant="outline" onClick={() => setResponseOpen(true)}>Importar / preencher resposta</Button>}{r.status === 'resposta' && <Button variant="outline" onClick={() => action('correction')}>Solicitar correção</Button>}</>}</div>
      <OrderActivity initialNotes={r.notes} events={r.events ?? []} onComment={async text => { const error = await commentSupplierRequest(id, text); if (error) { toast.error(error); return false; } toast.success('Observação adicionada'); return true; }} />
      {r.versions.map((v, i) => <details key={`${v.at}-${i}`} className="border-t border-border pt-3 text-sm"><summary>Resposta {i + 1} · {v.user} · {v.file ?? 'Manual'}</summary><p className="mt-2 text-xs text-muted-foreground">{new Date(v.at).toLocaleString('pt-BR')}</p>{v.notes && <p className="mt-2 whitespace-pre-wrap">{v.notes}</p>}{v.items.map(item => <div className="flex justify-between gap-2 py-2" key={item.materialId}><span>{getMaterial(item.materialId).name}</span><span>{brl(item.unitPrice ?? 0)}</span></div>)}</details>)}
    </div>
  </DialogContent></Dialog>{trace && r.purchaseId && <PurchaseTrace id={r.purchaseId} onClose={() => setTrace(false)} />}{responseOpen && <SupplierResponse request={r} onClose={() => setResponseOpen(false)} />}</>;
}
