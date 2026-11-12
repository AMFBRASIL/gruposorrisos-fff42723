import type { PurchaseOrder, Quote, Supplier } from './purchasing';
import type { Order } from './orders';
import type { SupplierRequest } from './supplier-orders';

export type ReceiptLine = { accepted: number; damaged: number; actualPrice?: number };
export type PurchaseReceipt = { id: string; at: string; user: string; notes: string; lines: Record<string, ReceiptLine> };
export function quoteTotal(quote: Quote, qty: number) { return quote.unitPrice * qty + (quote.freight ?? 0); }
export function rankQuotes(quotes: Quote[], qty: number, suppliers: Supplier[], mode: 'cost' | 'balanced' = 'cost') {
  const min = Math.min(...quotes.map(q => quoteTotal(q, qty)));
  return quotes.map(q => {
    const rating = suppliers.find(s => s.id === q.supplierId)?.rating ?? 0;
    const total = quoteTotal(q, qty);
    const score = (total === 0 ? 1 : min / total) * 60 + Math.max(0, 20 - q.days) + rating * 4;
    return { ...q, total, rating, score };
  }).sort((a, b) => mode === 'cost' ? a.total - b.total || a.days - b.days : b.score - a.score);
}
export function validateReceipt(order: PurchaseOrder, lines: Record<string, ReceiptLine>, notes: string): string | null {
  if (!['enviado', 'recebido_parcial'].includes(order.status)) return 'Pedido de compra não está aguardando entrega';
  if (Object.keys(lines).some(id => !order.items.some(i => i.materialId === id))) return 'Material não pertence à compra';
  let total = 0, divergent = false;
  for (const item of order.items) {
    const line = lines[item.materialId] ?? { accepted: 0, damaged: 0 };
    if (![line.accepted, line.damaged].every(n => Number.isFinite(n) && n >= 0) || line.accepted + line.damaged > item.qty - item.received) return 'Quantidade acima da pendente ou inválida';
    if (line.actualPrice !== undefined && (!Number.isFinite(line.actualPrice) || line.actualPrice < 0)) return 'Preço recebido inválido';
    const price = item.quotes.find(q => q.supplierId === item.chosen)?.unitPrice;
    divergent ||= line.damaged > 0 || (line.actualPrice !== undefined && line.actualPrice !== price);
    total += line.accepted + line.damaged;
  }
  if (!total) return 'Informe ao menos uma quantidade recebida ou danificada';
  if (divergent && !notes.trim()) return 'Informe o motivo dos danos ou da diferença de preço';
  return null;
}
export function duplicateOrders(branchId: string, materialIds: string[], orders: Order[], requests: SupplierRequest[], purchases: PurchaseOrder[], excludeId?: string) {
  const ids = new Set(materialIds);
  return [
    ...orders.filter(o => o.branchId === branchId && !['concluido', 'cancelado', 'rejeitado'].includes(o.status)).map(o => ({ id: o.id, number: o.number, materials: o.items.map(i => i.materialId) })),
    ...requests.filter(r => r.branchId === branchId && r.status !== 'aprovado').map(r => ({ id: r.id, number: r.number, materials: r.items.map(i => i.materialId) })),
    ...purchases.filter(p => p.branchId === branchId && !['recebido', 'cancelado'].includes(p.status)).map(p => ({ id: p.id, number: p.number, materials: p.items.filter(i => i.received < i.qty).map(i => i.materialId) })),
  ].filter(o => o.id !== excludeId && o.materials.some(id => ids.has(id))).map(o => ({ ...o, materials: o.materials.filter(id => ids.has(id)) }));
}
export function procurementMetrics(orders: Order[], purchases: PurchaseOrder[], now: string) {
  const durations = orders.flatMap(o => {
    const sent = o.events.find(e => e.action === 'Pedido enviado');
    const approved = o.events.find(e => e.action === 'Pedido aprovado');
    return sent && approved ? [Math.max(0, (Date.parse(approved.at) - Date.parse(sent.at)) / 3600000)] : [];
  });
  const receipts = purchases.flatMap(p => p.receipts ?? []);
  const accepted = receipts.reduce((a, r) => a + Object.values(r.lines).reduce((s, l) => s + l.accepted, 0), 0);
  const damaged = receipts.reduce((a, r) => a + Object.values(r.lines).reduce((s, l) => s + l.damaged, 0), 0);
  const savings = purchases.reduce((sum, p) => sum + p.items.reduce((s, i) => {
    const chosen = i.quotes.find(q => q.supplierId === i.chosen);
    return s + (chosen ? Math.max(0, Math.max(...i.quotes.map(q => quoteTotal(q, i.qty))) - quoteTotal(chosen, i.qty)) : 0);
  }, 0), 0);
  return { approvalHours: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null, approvalSamples: durations.length, savings, receiptSamples: receipts.length, quality: accepted + damaged ? accepted / (accepted + damaged) * 100 : null, late: orders.filter(o => !['concluido', 'cancelado', 'rejeitado'].includes(o.status) && o.desiredDate < now.slice(0, 10)).length };
}