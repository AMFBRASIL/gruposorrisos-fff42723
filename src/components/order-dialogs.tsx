import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApprovalTimeline } from './order-workflow';
import { ProcurementContext } from './procurement-context';
import { OrderActivity } from './order-activity';
import { workflowAssignee } from '@/lib/order-workflow';
import { useErp, useSession, branchName, userName } from "@/lib/erp";
import { useStock, materials, categories, getMaterial, balanceOf, brl } from "@/lib/stock";
import { actions, saveDraft, statusLabels, type Order, type Priority } from "@/lib/orders";
import { WizardShell, WizardFooter, OptionCard } from "@/components/erp-wizard";
import { StockCodeScanner } from './stock-code-scanner';
import { fefo } from '@/lib/stock-intelligence';
import { Leaf, Gauge, Flame, Siren } from "lucide-react";
import { Check, Search, Trash2, ClipboardList, PackageSearch, FileCheck2 } from "lucide-react";
import { Upload, Store, ClipboardPenLine } from 'lucide-react';
import { OrderCsvImport } from './order-csv-import';
import { OrderReview } from './order-review';
import { CurrencyInput } from './ui/currency-input';
import { usePurchasing } from '@/lib/purchasing';
import { saveSupplierRequest } from '@/lib/supplier-orders';
import type { ImportItem } from '@/lib/order-csv';

const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
export const priorityMeta: Record<Priority, string> = { baixa: "bg-muted text-muted-foreground", normal: "bg-info/10 text-info border-info/30", alta: "bg-warning/10 text-warning border-warning/30", urgente: "bg-destructive/10 text-destructive border-destructive/30" };

const prioIcons = { baixa: Leaf, normal: Gauge, alta: Flame, urgente: Siren };
const prioDesc = { baixa: "Até 10 dias", normal: "Fluxo padrão, 5 dias", alta: "Até 48 horas", urgente: "Mesmo dia, notifica o CD" };

export function NewOrderDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Order }) {
  const s = useErp(); const ses = useSession(); const st = useStock();
  const allowed = s.branches.filter(b => b.type !== "administracao" && b.active && ses.can("pedidos.criar", b.id) && ses.visible.includes(b.id));
  const [step, setStep] = useState(0);
  const [branchId, setBranch] = useState(initial?.branchId ?? (ses.filter !== "all" ? ses.filter : allowed[0]?.id ?? ""));
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "normal");
  const [desiredDate, setDate] = useState(initial?.desiredDate ?? "2026-11-18");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [cart, setCart] = useState<ImportItem[]>(initial?.items.map(i => ({ materialId: i.materialId, requested: i.requested })) ?? []);
  const { sup } = usePurchasing();
  const [target, setTarget] = useState('cd'); const [supplierId, setSupplierId] = useState(sup[0]?.id ?? '');
  const [mode, setMode] = useState('manual'); const [file, setFile] = useState<string>();
  const [q, setQ] = useState(""); const [cat, setCat] = useState("Todas");
  const found = useMemo(() => materials.filter(m => (cat === "Todas" || m.category === cat) && `${m.name} ${m.code} ${m.sku}`.toLowerCase().includes(q.toLowerCase())), [q, cat]);
  const avail = (mid: string) => balanceOf(st, mid, "cd") - (st.balances.find(b => b.materialId === mid && b.clinicId === "cd")?.reserved ?? 0);
  const suggested = (mid: string) => { const m = getMaterial(mid); return Math.max(0, m.max - balanceOf(st, mid, branchId)); };
  const steps = [{ title: "Identificação", desc: "Filial, atendimento e prioridade", icon: ClipboardList }, { title: "Origem da lista", desc: "Catálogo manual ou arquivo CSV", icon: Upload }, { title: "Materiais", desc: "Quantidades, unidades e conciliação", icon: PackageSearch }, { title: "Condições", desc: "Prazo e observações", icon: ClipboardPenLine }, { title: "Revisão", desc: "Volumes, saldos e valores", icon: FileCheck2 }];
  const valid = !!branchId && !!desiredDate && (target === 'cd' || !!supplierId) && cart.length > 0 && cart.every(i => Number.isFinite(i.requested) && i.requested > 0);
  const finish = (send: boolean) => {
    if (!valid) return toast.error('Confira filial, prazo e quantidades');
    if (target === 'supplier') {
      const result = saveSupplierRequest({ branchId, supplierId, priority, desiredDate, notes, items: cart, file }, send);
      if (result.error) return toast.error(result.error);
      toast.success(send ? `Pedido ${result.request?.number} aguardando preços` : 'Rascunho salvo'); onClose(); return;
    }
    const r = saveDraft({ branchId, priority, desiredDate, notes, items: cart }, initial?.id);
    if (!r.ok) return toast.error(r.error);
    if (send) { const e = actions.submit(r.order.id); if (e) return toast.error(e); toast.success(`Pedido ${r.order.number} enviado para aprovação`); }
    else toast.success("Rascunho salvo");
    onClose();
  };
  if (allowed.length === 0) return <Dialog open={open} onOpenChange={o => !o && onClose()}><DialogContent><DialogHeader><DialogTitle>Sem permissão</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Seu perfil não pode criar pedidos em nenhuma filial.</p></DialogContent></Dialog>;
  return (
    <WizardShell open={open} onClose={onClose} badge={initial ? `Editando ${initial.number}` : "Pedido de material"} headline={<>Abasteça sua filial<br /><span className="opacity-60">sem rupturas.</span></>} sub="Solicitação ao Centro de Distribuição com sugestão de reposição e disponibilidade em tempo real."
      steps={steps} step={step} setStep={setStep} footer={<WizardFooter step={step} last={4} onClose={onClose} setStep={setStep} onFinish={() => finish(true)} finishLabel={target === 'supplier' ? 'Solicitar preços' : 'Enviar pedido'} canNext={step === 0 ? !!branchId && !!desiredDate && (target === 'cd' || !!supplierId) : step === 2 || step === 4 ? valid : true} extra={<Button variant="outline" onClick={() => finish(false)} disabled={!valid}>Salvar rascunho</Button>} />}>

            {step === 0 && (<>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Filial solicitante</Label><select className={sel} value={branchId} onChange={e => setBranch(e.target.value)}>{allowed.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                <div className="space-y-1"><Label>Atendimento</Label><select aria-label="Atendimento do pedido" disabled={!!initial} className={sel} value={target} onChange={e => setTarget(e.target.value)}><option value="cd">Centro de Distribuição</option><option value="supplier">Fornecedor definido</option></select></div>
                {target === 'supplier' && <div className="space-y-1 md:col-span-2"><Label>Fornecedor</Label><select aria-label="Fornecedor do pedido" className={sel} value={supplierId} onChange={e => setSupplierId(e.target.value)}>{sup.map(supplier => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></div>}
                <div className="space-y-1"><Label>Solicitante</Label><Input value={ses.user.name} disabled /></div>
                <div className="space-y-1"><Label>Data desejada</Label><Input type="date" value={desiredDate} onChange={e => setDate(e.target.value)} /></div>
              </div>
              <Label>Prioridade</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(Object.keys(priorityMeta) as Priority[]).map(p => <OptionCard key={p} selected={priority === p} onClick={() => setPriority(p)} icon={prioIcons[p]} title={p} desc={prioDesc[p]} />)}
              </div>
              <div className="space-y-1"><Label>Observações</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></div>
            </>)}
            {step === 1 && <div className="grid sm:grid-cols-2 gap-4"><Button variant={mode === 'manual' ? 'default' : 'outline'} className="h-28 flex-col gap-3" onClick={() => setMode('manual')}><PackageSearch className="h-7 w-7" />Selecionar no catálogo</Button><Button variant={mode === 'csv' ? 'default' : 'outline'} className="h-28 flex-col gap-3" onClick={() => setMode('csv')}><Upload className="h-7 w-7" />Importar arquivo CSV</Button></div>}
            {step === 2 && (<>
              {mode === 'csv' && <OrderCsvImport onConfirm={(items, filename) => { if (items.some(i => cart.some(c => c.materialId === i.materialId))) return toast.error('Há materiais já presentes na lista. Remova-os antes de confirmar o arquivo'); setCart([...cart, ...items]); setFile(filename); setMode('manual'); toast.success(`${items.length} materiais incluídos`); }} />}
              <div className="flex gap-2">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Nome, código ou código de barras" value={q} onChange={e => setQ(e.target.value)} /></div>
                <select className={`${sel} w-56`} value={cat} onChange={e => setCat(e.target.value)}><option>Todas</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {found.map(m => { const inCart = cart.some(c => c.materialId === m.id); return (
                  <Button key={m.id} variant="outline" aria-pressed={inCart} onClick={() => !inCart && setCart([...cart, { materialId: m.id, requested: Math.max(1, suggested(m.id)) }])} className={`h-auto block rounded-lg p-3 text-left whitespace-normal ${inCart ? 'border-primary bg-primary/5' : ''}`}>
                    <div className="text-sm font-medium flex justify-between gap-2">{m.name}{inCart && <Check className="h-4 w-4 shrink-0 text-primary" />}</div>
                    <div className="text-xs text-muted-foreground">{m.code} · {m.unit} · CD disponível: {avail(m.id)}</div>
                  </Button>
                ); })}
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>{["Material", "Unidade", "Sugerido", "Quantidade", "Disponibilidade", ""].map(h => <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-border">
                    {cart.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhum material adicionado.</td></tr>}
                    {cart.map(c => { const m = getMaterial(c.materialId); const a = avail(c.materialId); const st2 = a >= c.requested ? ["Disponível", "bg-success/10 text-success border-success/30"] : a > 0 ? ["Parcial", "bg-warning/10 text-warning border-warning/30"] : ["Indisponível", "bg-destructive/10 text-destructive border-destructive/30"]; return (
                      <tr key={c.materialId}>
                        <td className="px-3 py-2">{m.name}</td><td className="px-3 py-2">{m.unit}</td><td className="px-3 py-2 text-muted-foreground">{suggested(c.materialId)}</td>
                        <td className="px-3 py-2"><Input type="number" min={1} className="h-8 w-24" value={c.requested} onChange={e => setCart(cart.map(x => x.materialId === c.materialId ? { ...x, requested: Number(e.target.value) } : x))} /></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={st2[1]}>{st2[0]}</Badge></td>
                        <td className="px-3 py-2"><Button size="icon" variant="ghost" aria-label="Remover" onClick={() => setCart(cart.filter(x => x.materialId !== c.materialId))}><Trash2 className="h-4 w-4" /></Button></td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            </>)}
            {step === 3 && <div className="space-y-4"><div className="space-y-1"><Label>Data desejada</Label><Input aria-label="Prazo do pedido" type="date" value={desiredDate} onChange={e => setDate(e.target.value)} /></div><div className="space-y-1"><Label>Condições e observações</Label><Textarea maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} /></div>{target === 'supplier' && <div className="space-y-3">{cart.map(i => <div key={i.materialId} className="flex flex-wrap items-center justify-between gap-3"><Label>{getMaterial(i.materialId).name} · preço de referência</Label><CurrencyInput aria-label={`Preço de referência ${getMaterial(i.materialId).name}`} className="w-40" value={i.unitPrice ?? getMaterial(i.materialId).cost} onValueChange={value => setCart(cart.map(c => c.materialId === i.materialId ? { ...c, unitPrice: value === '' ? undefined : value } : c))} /></div>)}</div>}</div>}
            {step === 4 && (
              <div className="space-y-3 text-sm">
                <div className="grid md:grid-cols-4 gap-3">
                  {[["Filial", branchName(branchId)], ["Prioridade", priority], ["Data desejada", desiredDate.split("-").reverse().join("/")], ["Itens", String(cart.length)]].map(([k, v]) => <div key={k} className="rounded-lg border border-border p-3"><div className="text-xs text-muted-foreground">{k}</div><div className="font-medium capitalize">{v}</div></div>)}
                </div>
                <div className="flex gap-2 items-center text-muted-foreground"><Store className="h-4 w-4" />{target === 'supplier' ? sup.find(supplier => supplier.id === supplierId)?.name : 'Centro de Distribuição'}{file && <Badge variant="outline">{file}</Badge>}</div>
                <ProcurementContext branchId={branchId} items={cart} excludeId={initial?.id} /><OrderReview items={cart} branchId={branchId} external={target === 'supplier'} />
                {notes && <div className="text-muted-foreground">Obs.: {notes}</div>}
              </div>
            )}
    </WizardShell>
  );
}

export function OrderSheet({ order, onClose, onEdit }: { order: Order | null; onClose: () => void; onEdit: (o: Order) => void }) {
  const ses = useSession(); const erp = useErp(); const st = useStock();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  if (!order) return null;
  const o = order;
  const activeStep = o.workflow?.steps[o.workflow.index];
  const mayApprove = activeStep ? workflowAssignee(activeStep, ses.user, erp.roles, o.branchId) : ses.can('pedidos.aprovar', o.branchId);
  const done = (e: string | null, msg: string) => { if (e) return toast.error(e); toast.success(msg); setQty({}); setNote(""); };
  const qcol = o.status === "enviado" ? "approved" : o.status === "aprovado" || o.status === "separacao" ? "picked" : o.status === "transporte" || o.status === "recebido_parcial" ? "received" : null;
  const defaultQ = (i: Order["items"][number]) => qcol === "approved" ? i.requested : qcol === "picked" ? Math.min(i.approved, balanceOf(st, i.materialId, order?.sourceId ?? "cd")) : i.shipped - i.received;
  const val = (i: Order["items"][number]) => qty[i.materialId] ?? defaultQ(i);
  const all = () => Object.fromEntries(o.items.map(i => [i.materialId, val(i)]));
  return (
    <Dialog open onOpenChange={x => !x && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2">{o.number} <Badge variant="outline">{statusLabels[o.status]}</Badge></DialogTitle></DialogHeader>
        <div className="mt-4 space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-2">
            {[["Filial", branchName(o.branchId)], ["Atendimento", branchName(o.sourceId)], ["Solicitante", userName(o.requesterId)], ["Data desejada", o.desiredDate.split("-").reverse().join("/")]].map(([k, v]) => <div key={k} className="rounded-md bg-muted/50 p-2"><div className="text-xs text-muted-foreground">{k}</div><div className="font-medium">{v}</div></div>)}
          </div>
          <ProcurementContext branchId={o.branchId} items={o.items} excludeId={o.id} /><ApprovalTimeline workflow={o.workflow} active={o.status === 'enviado'} />
          <div className="grid grid-cols-2 gap-3 border-y border-border py-3"><div><div className="text-xs text-muted-foreground">Materiais solicitados</div><div className="text-xl font-semibold">{o.items.length}</div></div><div><div className="text-xs text-muted-foreground">Valor de referência</div><div className="text-xl font-semibold">{brl(o.items.reduce((sum, i) => sum + i.requested * getMaterial(i.materialId).cost, 0))}</div></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[600px]">
            <thead className="text-xs text-muted-foreground"><tr>{["Material", "Solic.", "Aprov.", "Separ.", "Exped.", "Receb.", qcol ? "Agora" : ""].map(h => <th key={h} className="text-left py-1">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {o.items.map(i => <tr key={i.materialId}>
                <td className="py-2">{getMaterial(i.materialId).name}{qcol === 'picked' && <div className="text-[11px] text-muted-foreground">FEFO: {fefo(st.lots, i.materialId, o.sourceId, val(i)).allocations.map(l => `${l.lot} · ${l.qty} · ${l.expires}`).join(' / ') || 'Sem lote válido'}</div>}{i.allocations?.map(l => <div className="text-[11px] text-muted-foreground" key={l.lotId}>{l.lot} · {l.qty}</div>)}</td><td>{i.requested}</td><td>{i.approved}</td><td>{i.picked}</td><td>{i.shipped}</td><td>{i.received}</td>
                {qcol && <td title={qcol === "picked" ? `Disponível no depósito: ${balanceOf(st, i.materialId, o.sourceId)}` : undefined}><Input type="number" min={0} className="h-8 w-20" value={val(i)} onChange={e => setQty({ ...qty, [i.materialId]: Number(e.target.value) })} /></td>}
              </tr>)}
            </tbody>
          </table></div>
          {(qcol === 'received' || qcol === 'picked') && <StockCodeScanner onMaterial={id => { const i = o.items.find(i => i.materialId === id); if (!i) return toast.error('Material não pertence ao pedido'); setQty(prev => ({ ...prev, [id]: Math.min((prev[id] ?? 0) + 1, qcol === 'received' ? i.shipped - i.received : i.approved) })); }} />}
          <Textarea aria-label="Observação da decisão" placeholder="Observação / motivo / divergência" maxLength={2000} value={note} onChange={e => setNote(e.target.value)} rows={2} />
          <div className="flex flex-wrap gap-2">
            {(o.status === "rascunho" || o.status === "correcao") && o.requesterId === ses.user.id && <><Button variant="outline" onClick={() => onEdit(o)}>Editar</Button><Button onClick={() => done(actions.submit(o.id), "Pedido enviado")}>Enviar</Button></>}
            {o.status === "enviado" && mayApprove && <>
              <Button onClick={() => done(actions.approve(o.id, all(), note), "Aprovação registrada")}>{activeStep ? 'Aprovar etapa' : 'Aprovar'}</Button>
              <Button variant="outline" onClick={() => done(actions.reject(o.id, note, true), "Correção solicitada")}>Solicitar correção</Button>
              <Button variant="outline" className="text-destructive" onClick={() => done(actions.reject(o.id, note), "Pedido rejeitado")}>Rejeitar</Button></>}
            {(o.status === "aprovado" || o.status === "separacao") && ses.can("pedidos.separar", o.sourceId) && <Button onClick={() => done(actions.pick(o.id, all()), "Separação registrada")}>Registrar separação</Button>}
            {o.status === "separacao" && ses.can("pedidos.expedir", o.sourceId) && <Button onClick={() => done(actions.ship(o.id), "Pedido expedido")}>Expedir</Button>}
            {(o.status === "transporte" || o.status === "recebido_parcial") && ses.can("pedidos.receber", o.branchId) && <Button onClick={() => done(actions.receive(o.id, all(), note), "Recebimento registrado")}>Confirmar recebimento</Button>}
            {o.status === "recebido_parcial" && ses.can("pedidos.receber", o.branchId) && <Button variant="outline" onClick={() => done(actions.close(o.id, note), "Pedido encerrado com divergência")}>Encerrar com divergência</Button>}
            {["rascunho", "enviado", "correcao", "aprovado"].includes(o.status) && <Button variant="ghost" className="text-destructive" onClick={() => done(actions.cancel(o.id, note), "Pedido cancelado")}>Cancelar</Button>}
            <Button variant="ghost" onClick={() => { const r = actions.duplicate(o.id); if (r.ok) toast.success(`Rascunho ${r.order.number} criado`); else toast.error(r.error); }}>Duplicar</Button>
            <Button variant="ghost" onClick={() => window.print()}>Imprimir</Button>
          </div>
          <OrderActivity key={o.id} events={o.events} initialNotes={o.notes} onComment={text => { const error = actions.comment(o.id, text); if (error) { toast.error(error); return false; } toast.success('Observação adicionada'); return true; }} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
