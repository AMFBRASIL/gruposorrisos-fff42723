import { useState } from 'react';
import { toast } from 'sonner';
import { Package, ScanLine, FileCheck2 } from 'lucide-react';
import { WizardShell, WizardFooter, ReviewGrid } from './erp-wizard';
import { StockCodeScanner } from './stock-code-scanner';
import { Input } from './ui/input';
import { receivePo, type PurchaseOrder } from '@/lib/purchasing';
import { getMaterial } from '@/lib/stock';
import { branchName } from '@/lib/erp';
export function PurchaseReceivingWizard({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
 const [step, setStep] = useState(0), [counts, setCounts] = useState<Record<string, number>>({});
 const valid = order.items.some(i => (counts[i.materialId] ?? 0) > 0) && order.items.every(i => Number.isFinite(counts[i.materialId] ?? 0) && (counts[i.materialId] ?? 0) >= 0 && (counts[i.materialId] ?? 0) <= i.qty - i.received);
 return <WizardShell open onClose={onClose} badge={`Recebimento ${order.number}`} headline={<>Entrega conferida,<br /><span className="opacity-60">estoque atualizado.</span></>} steps={[{ title: 'Entrega', desc: 'Ordem e filial de recebimento', icon: Package }, { title: 'Conferência', desc: 'Códigos e quantidades recebidas', icon: ScanLine }, { title: 'Revisão', desc: 'Entrada parcial ou completa', icon: FileCheck2 }]} step={step} setStep={setStep} footer={<WizardFooter step={step} last={2} onClose={onClose} setStep={setStep} canNext={step === 0 || valid} finishLabel="Confirmar entrada" onFinish={() => { const e = receivePo(order.id, counts); if (e) return toast.error(e); toast.success('Recebimento registrado no estoque'); onClose(); }} />}>
 {step === 0 && <ReviewGrid items={[["Ordem", order.number], ['Filial', branchName(order.branchId)], ['Itens', String(order.items.length)]]} />}
 {step === 1 && <><StockCodeScanner onMaterial={id => { const i = order.items.find(i => i.materialId === id); if (!i) return toast.error('Material não pertence à ordem'); setCounts(prev => ({ ...prev, [id]: Math.min((prev[id] ?? 0) + 1, i.qty - i.received) })); }} /><div className="divide-y divide-border">{order.items.map(i => <div key={i.materialId} className="flex items-center gap-3 justify-between py-3"><div className="text-sm">{getMaterial(i.materialId).name}<div className="text-xs text-muted-foreground">Pendente: {i.qty - i.received} {getMaterial(i.materialId).unit}</div></div><Input aria-label={`Recebido ${getMaterial(i.materialId).name}`} className="w-24" type="number" min={0} max={i.qty - i.received} value={counts[i.materialId] ?? 0} onChange={e => setCounts({ ...counts, [i.materialId]: Number(e.target.value) })} /></div>)}</div></>}
 {step === 2 && <div className="divide-y divide-border">{order.items.map(i => <div className="py-3 flex justify-between gap-3 text-sm" key={i.materialId}><span>{getMaterial(i.materialId).name}</span><span>{counts[i.materialId] ?? 0} / {i.qty - i.received}</span></div>)}</div>}
 </WizardShell>;
}
