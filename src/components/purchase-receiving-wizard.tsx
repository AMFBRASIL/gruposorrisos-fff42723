import { useState } from 'react';
import { toast } from 'sonner';
import { Package, ScanLine, FileCheck2 } from 'lucide-react';
import { WizardShell, WizardFooter, ReviewGrid } from './erp-wizard';
import { StockCodeScanner } from './stock-code-scanner';
import { Input } from './ui/input';
import { CurrencyInput } from './ui/currency-input';
import { Textarea } from './ui/textarea';
import { validateReceipt } from '@/lib/procurement-rules';
import { receivePo, type PurchaseOrder } from '@/lib/purchasing';
import { getMaterial } from '@/lib/stock';
import { branchName } from '@/lib/erp';
export function PurchaseReceivingWizard({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
 const [step, setStep] = useState(0), [counts, setCounts] = useState<Record<string, number>>({});
 const [damaged, setDamaged] = useState<Record<string, number>>({}), [prices, setPrices] = useState<Record<string, number>>({}), [notes, setNotes] = useState('');
 const lines = Object.fromEntries(order.items.map(i => [i.materialId, { accepted: counts[i.materialId] ?? 0, damaged: damaged[i.materialId] ?? 0, actualPrice: prices[i.materialId] }]));
 const error = validateReceipt(order, lines, notes);
 const valid = !error;
 return <WizardShell open onClose={onClose} badge={`Recebimento ${order.number}`} headline={<>Entrega conferida,<br /><span className="opacity-60">estoque atualizado.</span></>} steps={[{ title: 'Entrega', desc: 'Ordem e filial de recebimento', icon: Package }, { title: 'Conferência', desc: 'Códigos e quantidades recebidas', icon: ScanLine }, { title: 'Revisão', desc: 'Entrada parcial ou completa', icon: FileCheck2 }]} step={step} setStep={setStep} footer={<WizardFooter step={step} last={2} onClose={onClose} setStep={setStep} canNext={step === 0 || valid} finishLabel="Confirmar entrada" onFinish={() => { const e = receivePo(order.id, counts, { damaged, prices, notes }); if (e) return toast.error(e); toast.success('Recebimento registrado no estoque'); onClose(); }} />}>
 {step === 0 && <ReviewGrid items={[["Ordem", order.number], ['Filial', branchName(order.branchId)], ['Itens', String(order.items.length)]]} />}
 {step === 1 && <><StockCodeScanner onMaterial={id => { const i = order.items.find(i => i.materialId === id); if (!i) return toast.error('Material não pertence à ordem'); setCounts(prev => ({ ...prev, [id]: Math.min((prev[id] ?? 0) + 1, i.qty - i.received - (damaged[id] ?? 0)) })); }} /><div className="space-y-4">{order.items.map(i => <section key={i.materialId} className="border-b border-border pb-4 space-y-3"><div className="text-sm font-semibold">{getMaterial(i.materialId).name}<div className="text-xs text-muted-foreground">Pendente: {i.qty - i.received} {getMaterial(i.materialId).unit}</div></div><div className="grid sm:grid-cols-3 gap-3"><label className="text-xs">Aceitos no estoque<Input aria-label={`Recebido ${getMaterial(i.materialId).name}`} type="number" min={0} max={i.qty - i.received} value={counts[i.materialId] ?? 0} onChange={e => setCounts({ ...counts, [i.materialId]: Number(e.target.value) })} /></label><label className="text-xs">Danificados / recusados<Input aria-label={`Danificados ${getMaterial(i.materialId).name}`} type="number" min={0} max={i.qty - i.received} value={damaged[i.materialId] ?? 0} onChange={e => setDamaged({ ...damaged, [i.materialId]: Number(e.target.value) })} /></label><label className="text-xs">Preço na entrega<CurrencyInput aria-label={`Preço recebido ${getMaterial(i.materialId).name}`} value={prices[i.materialId] ?? i.quotes.find(q => q.supplierId === i.chosen)?.unitPrice ?? ''} onValueChange={v => { const next = { ...prices }; if (v === '') delete next[i.materialId]; else next[i.materialId] = v; setPrices(next); }} /></label></div></section>)}</div><Textarea aria-label="Motivo da divergência" placeholder="Motivo dos danos, diferença de preço ou observações da entrega" maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</>}
 {step === 2 && <><div className="divide-y divide-border">{order.items.map(i => <div className="py-3 space-y-1 text-sm" key={i.materialId}><div className="font-semibold">{getMaterial(i.materialId).name}</div><div>{counts[i.materialId] ?? 0} aceitos · {damaged[i.materialId] ?? 0} danificados · saldo a entregar: {i.qty - i.received - (counts[i.materialId] ?? 0)}</div></div>)}</div><p className="text-sm whitespace-pre-wrap">{notes}</p><p className="text-xs text-muted-foreground">Somente materiais aceitos entram no estoque. Danificados continuam pendentes de reposição.</p></>}
 </WizardShell>;
}
