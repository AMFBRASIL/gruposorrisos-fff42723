import { useState } from 'react';
import { Upload, ClipboardList, FileCheck2 } from 'lucide-react';
import { toast } from 'sonner';
import { WizardShell, WizardFooter } from './erp-wizard';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { CurrencyInput } from './ui/currency-input';
import { OrderCsvImport } from './order-csv-import';
import { answerDemoPortalRequest } from '@/lib/supplier-portal-demo';
import { validatePortalPrices, type PortalRequest } from '@/lib/supplier-portal';
import { downloadCsv, exportCsv, type ImportItem } from '@/lib/order-csv';
import type { Material } from '@/lib/stock';
import { brl } from '@/lib/stock';

export function PortalPriceWizard({ request, onClose, onSaved }: { request: PortalRequest; onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(0); const [mode, setMode] = useState('manual'); const [notes, setNotes] = useState(''); const [file, setFile] = useState<string>(); const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ImportItem[]>(request.payload.items.map(i => ({ materialId: i.materialId, requested: i.requested, unitPrice: request.responses.at(-1)?.items.find(x => x.materialId === i.materialId)?.unitPrice })));
  const catalog: Material[] = request.payload.items.map(i => ({ id: i.materialId, name: i.name, code: i.code, sku: i.code, unit: i.unit, barcode: i.barcode, category: '', brand: '', cost: 0, min: 0, max: 0, lotControl: false }));
  const valid = !validatePortalPrices(request, items);
  const total = items.reduce((a, i) => a + i.requested * (i.unitPrice ?? 0), 0);
  async function save() {
    const error = validatePortalPrices(request, items); if (error) return toast.error(error);
    setBusy(true);
    try { answerDemoPortalRequest(request, items.map(i => ({ ...i, unitPrice: i.unitPrice ?? 0 })), notes, file); toast.success('Resposta simulada para conferência de Compras'); onSaved(); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao enviar resposta'); } finally { setBusy(false); }
  }
  return <WizardShell open onClose={() => !busy && onClose()} badge={request.number} headline="Resposta comercial" sub={`${request.payload.supplierName} · ${request.payload.branchName}`} steps={[{ title: 'Origem dos preços', desc: 'Preenchimento ou arquivo CSV', icon: Upload }, { title: 'Itens e condições', desc: 'Preços unitários e observações', icon: ClipboardList }, { title: 'Revisão e envio', desc: 'Confira os valores da proposta', icon: FileCheck2 }]} step={step} setStep={setStep} footer={<WizardFooter step={step} last={2} setStep={setStep} onClose={onClose} onFinish={() => void save()} finishLabel={busy ? 'Enviando...' : 'Enviar resposta'} canNext={!busy && (step === 0 || valid)} />}>
    {step === 0 && <><div className="grid sm:grid-cols-2 gap-3"><Button variant={mode === 'manual' ? 'default' : 'outline'} className="h-24 gap-2" onClick={() => setMode('manual')}><ClipboardList className="h-5 w-5" />Preencher preços</Button><Button variant={mode === 'csv' ? 'default' : 'outline'} className="h-24 gap-2" onClick={() => setMode('csv')}><Upload className="h-5 w-5" />Importar CSV</Button></div><Button variant="outline" onClick={() => downloadCsv(exportCsv([['codigo', 'material', 'unidade', 'quantidade', 'preco unitario'], ...request.payload.items.map(i => [i.code, i.name, i.unit, String(i.requested), ''])]), `${request.number}.csv`)}>Baixar itens solicitados</Button><div className="border-t border-border pt-4 text-sm"><div>Entrega desejada: {request.payload.desiredDate.split('-').reverse().join('/')}</div><p className="mt-3 whitespace-pre-wrap">{request.payload.notes || 'Sem observações de Compras.'}</p></div></>}
    {step === 1 && <>{mode === 'csv' && <OrderCsvImport catalog={catalog} onConfirm={(data, filename) => { const error = validatePortalPrices(request, data); if (error) return toast.error(error); setItems(data); setFile(filename); setMode('manual'); toast.success('Preços conciliados'); }} />}<div className="divide-y divide-border">{items.map(i => { const m = request.payload.items.find(x => x.materialId === i.materialId); return <div key={i.materialId} className="flex flex-wrap justify-between gap-3 py-4"><div><div className="font-medium">{m?.name}</div><div className="text-xs text-muted-foreground mt-1">{m?.code} · {i.requested} {m?.unit}</div></div><div><CurrencyInput aria-label={`Preço ${m?.name}`} className="w-44" value={i.unitPrice ?? ''} onValueChange={v => setItems(items.map(x => x.materialId === i.materialId ? { ...x, unitPrice: v === '' ? undefined : v } : x))} /><div className="text-xs text-muted-foreground mt-2 text-right">Subtotal {brl(i.requested * (i.unitPrice ?? 0))}</div></div></div>; })}</div><label className="block text-sm font-medium">Observações e condições comerciais<Textarea aria-label="Observações e condições comerciais" value={notes} maxLength={2000} onChange={e => setNotes(e.target.value)} className="mt-2 min-h-28" /></label></>}
    {step === 2 && <><div className="flex justify-between items-end gap-3 border-b border-border pb-5"><div><div className="text-xs text-muted-foreground">Valor da proposta</div><div className="text-3xl font-semibold mt-2">{brl(total)}</div></div><span className="text-sm text-muted-foreground">{items.length} itens · versão {request.responses.length + 1}</span></div><div className="divide-y divide-border">{items.map(i => <div key={i.materialId} className="flex justify-between gap-4 py-3 text-sm"><span>{request.payload.items.find(m => m.materialId === i.materialId)?.name}<span className="block text-muted-foreground">{i.requested} × {brl(i.unitPrice ?? 0)}</span></span><span className="font-medium whitespace-nowrap">{brl(i.requested * (i.unitPrice ?? 0))}</span></div>)}</div><p className="text-sm whitespace-pre-wrap">{notes || 'Sem observações comerciais.'}</p>{file && <p className="text-xs text-muted-foreground">Origem: {file}</p>}</>}
  </WizardShell>;
}