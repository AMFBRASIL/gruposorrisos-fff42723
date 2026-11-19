import { useMemo, useState } from 'react';
import { Upload, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { selectCls } from './erp-wizard';
import { parseCsv, reconcileCsv, downloadCsv, exportCsv, type CsvMapping, type ImportItem } from '@/lib/order-csv';
import { brl, materials } from '@/lib/stock-live';
import type { Material } from '@/lib/stock';

const fields = { code: 'Código', barcode: 'Código de barras', name: 'Material', unit: 'Unidade', qty: 'Quantidade', price: 'Preço unitário' };
export function OrderCsvImport({ onConfirm, catalog = materials, links = {} }: { onConfirm: (items: ImportItem[], file: string) => void; catalog?: Material[]; links?: Record<string, string> }) {
  const [file, setFile] = useState<File>(); const [encoding, setEncoding] = useState('utf-8');
  const [data, setData] = useState<Record<string, string>[]>([]); const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CsvMapping>({ code: '', barcode: '', name: '', unit: '', qty: '', price: '' });
  const [overrides, setOverrides] = useState<Record<number, string>>({}); const [excluded, setExcluded] = useState<number[]>([]);
  const rows = useMemo(() => reconcileCsv(data, mapping, catalog, links, overrides).filter((_, index) => !excluded.includes(index)), [data, mapping, catalog, links, overrides, excluded]);
  const errors = rows.filter(r => r.error).length;
  async function read(f: File, enc = encoding) {
    setFile(f); setData([]); setOverrides({}); setExcluded([]);
    try { const parsed = parseCsv(new TextDecoder(enc).decode(await f.arrayBuffer()), f.size); setHeaders(parsed.headers); setMapping(parsed.mapping); setData(parsed.data); } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível ler o CSV'); }
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3 items-center">
      <Button variant="outline" onClick={() => downloadCsv(exportCsv([['codigo', 'material', 'unidade', 'quantidade', 'preco unitario'], ['MAT-0001', 'Resina composta A2', 'seringa', '10', '89,90']]), 'modelo-pedido.csv')}><Download className="h-4 w-4 mr-2" />Modelo CSV</Button>
      <select aria-label="Codificação do CSV" className={`${selectCls} max-w-48`} value={encoding} onChange={e => { setEncoding(e.target.value); if (file) void read(file, e.target.value); }}><option value="utf-8">UTF-8</option><option value="windows-1252">Windows / Excel</option></select>
      <span className="text-xs text-muted-foreground">CSV · até 5 MB · 2.000 linhas</span>
    </div>
    <label className="flex items-center gap-4 border border-dashed border-primary/40 bg-primary/5 rounded-lg p-5 cursor-pointer"><Upload className="h-6 w-6 text-primary" /><span className="min-w-0 flex-1 text-sm font-medium">{file?.name ?? 'Selecionar arquivo CSV'}</span><Input aria-label="Arquivo CSV" type="file" accept=".csv,text/csv" className="max-w-56" onChange={e => { const f = e.target.files?.[0]; if (f) void read(f); }} /></label>
    {data.length > 0 && <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{Object.entries(fields).map(([key, label]) => <label key={key} className="text-xs space-y-1 block">{label}<select className={selectCls} value={mapping[key as keyof CsvMapping]} onChange={e => setMapping({ ...mapping, [key]: e.target.value })}><option value="">Não informada</option>{headers.map(h => <option key={h}>{h}</option>)}</select></label>)}</div>
      <div className="flex gap-3 text-sm items-center">{errors ? <AlertTriangle className="h-4 w-4 text-warning" /> : <CheckCircle2 className="h-4 w-4 text-success" />}<span>{rows.length - errors} conciliados · {errors} pendentes · {excluded.length} excluídos</span></div>
      <div className="overflow-x-auto border border-border rounded-lg max-h-80"><table className="w-full text-xs"><thead className="bg-muted"><tr>{['Linha', 'Material vinculado', 'Qtd.', 'Preço', 'Conferência', ''].map(h => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.line} className="border-t border-border"><td className="p-2">{r.line}</td><td className="p-2 min-w-56"><div className="text-muted-foreground mb-1">{r.values[mapping.name] || r.supplierCode}</div><select aria-label={`Material da linha ${r.line}`} className={selectCls} value={r.materialId} onChange={e => setOverrides({ ...overrides, [r.line - 2]: e.target.value })}><option value="">Selecionar material</option>{catalog.map(m => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select></td><td className="p-2">{Number.isFinite(r.qty) ? r.qty : '—'}</td><td className="p-2 whitespace-nowrap">{r.price === undefined ? '—' : Number.isFinite(r.price) ? brl(r.price) : 'Inválido'}</td><td className={`p-2 ${r.error ? 'text-destructive' : 'text-success'}`}>{r.error || 'Conferido'}</td><td><Button variant="ghost" size="sm" onClick={() => setExcluded([...excluded, r.line - 2])}>Excluir</Button></td></tr>)}</tbody></table></div>
      <Button disabled={!rows.length || errors > 0 || !mapping.qty} onClick={() => onConfirm(rows.map(r => ({ materialId: r.materialId, requested: r.qty, unitPrice: r.price, supplierCode: r.supplierCode })), file?.name ?? 'CSV')}>Confirmar {rows.length} materiais</Button>
    </>}
  </div>;
}