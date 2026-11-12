import Papa from 'papaparse';
import { z } from 'zod';
import type { Material } from './stock';

export const CSV_MAX_BYTES = 5 * 1024 * 1024;
export const CSV_MAX_ROWS = 2000;
export type CsvField = 'code' | 'barcode' | 'name' | 'unit' | 'qty' | 'price';
export type CsvMapping = Record<CsvField, string>;
export type ImportItem = { materialId: string; requested: number; unitPrice?: number; supplierCode?: string };
export type MatchRow = { line: number; values: Record<string, string>; materialId: string; qty: number; price?: number; error: string; supplierCode?: string };
export const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
export function brazilNumber(raw: string): number {
  const v = raw.trim().replace(/^R\$\s*/, '');
  if (!v || !/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$|^\d+(?:\.\d+)?$/.test(v)) return NaN;
  return Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v);
}
const aliases: Record<CsvField, string[]> = { code: ['codigo', 'code', 'sku'], barcode: ['codigo de barras', 'barcode', 'ean'], name: ['material', 'nome', 'produto', 'descricao'], unit: ['unidade', 'unit'], qty: ['quantidade', 'qty', 'qtd'], price: ['preco unitario', 'preco', 'valor', 'unitprice'] };
export function parseCsv(text: string, bytes: number) {
  if (bytes > CSV_MAX_BYTES) throw new Error('O arquivo excede 5 MB');
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
  if (parsed.errors.length) throw new Error(`CSV inválido: ${parsed.errors[0]?.message}`);
  if (!parsed.data.length) throw new Error('O arquivo não possui materiais');
  if (parsed.data.length > CSV_MAX_ROWS) throw new Error('O arquivo excede 2.000 linhas');
  const headers = parsed.meta.fields ?? [];
  const mapping = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, headers.find(h => names.includes(normalize(h))) ?? ''])) as CsvMapping;
  return { headers, data: parsed.data, mapping };
}
const itemSchema = z.object({ materialId: z.string().min(1), requested: z.number().finite().positive().max(1e9), unitPrice: z.number().finite().nonnegative().max(1e9).optional() });
export function reconcileCsv(data: Record<string, string>[], mapping: CsvMapping, catalog: Material[], links: Record<string, string> = {}, overrides: Record<number, string> = {}): MatchRow[] {
  const seen = new Set<string>();
  return data.map((values, index) => {
    const value = (field: CsvField) => values[mapping[field]]?.trim() ?? '';
    const code = value('code'); const barcode = value('barcode'); const name = normalize(value('name'));
    const exact = catalog.filter(m => (code && [m.code, m.sku].some(c => normalize(c) === normalize(code))) || (barcode && m.barcode === barcode));
    const linked = catalog.filter(m => m.id === links[code]);
    const named = catalog.filter(m => name && normalize(m.name) === name);
    const candidates = exact.length ? exact : linked.length ? linked : named;
    const materialId = overrides[index] ?? (candidates.length === 1 ? candidates[0]?.id ?? '' : '');
    const material = catalog.find(m => m.id === materialId);
    const qty = brazilNumber(value('qty')); const price = value('price') ? brazilNumber(value('price')) : undefined;
    let error = !material ? candidates.length > 1 ? 'Correspondência ambígua' : 'Material não encontrado' : '';
    if (!error && !itemSchema.safeParse({ materialId, requested: qty, unitPrice: price }).success) error = 'Quantidade ou preço inválido';
    if (!error && value('unit') && normalize(value('unit')) !== normalize(material?.unit ?? '')) error = 'Unidade incompatível';
    if (!error && seen.has(materialId)) error = 'Material duplicado';
    if (materialId) seen.add(materialId);
    return { line: index + 2, values, materialId, qty, price, error, supplierCode: code };
  });
}
export function safeCsvCell(value: string) { return /^[\s]*[=+@\-]/.test(value) ? `'${value}` : value; }
export function exportCsv(rows: string[][]) { return Papa.unparse(rows.map(row => row.map(safeCsvCell)), { delimiter: ';' }); }
export function downloadCsv(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}