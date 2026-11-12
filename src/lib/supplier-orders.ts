import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import { can, currentUser, getErp } from './erp';
import { createRequisition, getPurchasing } from './purchasing';
import { materials } from './stock';
import type { ImportItem } from './order-csv';

export type SupplierRequest = { id: string; number: string; branchId: string; supplierId: string; desiredDate: string; priority: string; notes: string; status: 'rascunho' | 'aguardando' | 'resposta' | 'aprovado' | 'correcao'; items: ImportItem[]; file?: string; createdAt: string; purchaseId?: string; versions: { at: string; user: string; file?: string; items: ImportItem[] }[] };
const schema = z.object({ branchId: z.string().min(1), supplierId: z.string().min(1), desiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), priority: z.enum(['baixa', 'normal', 'alta', 'urgente']), notes: z.string().max(2000), file: z.string().max(255).optional(), items: z.array(z.object({ materialId: z.string().min(1), requested: z.number().finite().positive().max(1e9), unitPrice: z.number().finite().nonnegative().max(1e9).optional(), supplierCode: z.string().max(100).optional() })).min(1).max(2000) });
let requests: SupplierRequest[] = [];
let links: Record<string, Record<string, string>> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
export const useSupplierRequests = () => useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => requests, () => requests);
export const getSupplierLinks = (id: string) => links[id] ?? {};
export function validateResponse(request: SupplierRequest, items: ImportItem[]) {
  if (!['aguardando', 'resposta', 'correcao'].includes(request.status)) return 'Pedido não está aberto para preços';
  if (items.length !== request.items.length || new Set(items.map(i => i.materialId)).size !== items.length) return 'Informe todos os materiais uma única vez';
  if (items.some(i => !request.items.some(x => x.materialId === i.materialId) || !Number.isFinite(i.unitPrice) || (i.unitPrice ?? -1) < 0 || !Number.isFinite(i.requested) || i.requested <= 0)) return 'Material, quantidade ou preço inválido';
  if (items.some(i => i.requested !== request.items.find(x => x.materialId === i.materialId)?.requested)) return 'Quantidade divergente da solicitada';
  return null;
}
export function saveSupplierRequest(input: z.input<typeof schema>, send: boolean) {
  const parsed = schema.safeParse(input); if (!parsed.success) return { error: 'Confira filial, fornecedor, prazo e materiais' };
  const d = parsed.data;
  if (!can(currentUser(), getErp().roles, 'pedidos.criar', d.branchId) && !can(currentUser(), getErp().roles, 'compras.gerenciar', d.branchId)) return { error: 'Sem permissão nesta filial' };
  if (!getPurchasing().sup.some(s => s.id === d.supplierId) || !getErp().branches.some(b => b.id === d.branchId && b.active)) return { error: 'Filial ou fornecedor inválido' };
  if (new Set(d.items.map(i => i.materialId)).size !== d.items.length || d.items.some(i => !materials.some(m => m.id === i.materialId))) return { error: 'Materiais inválidos ou duplicados' };
  const request: SupplierRequest = { ...d, id: crypto.randomUUID(), number: `FOR-${String(1001 + requests.length)}`, createdAt: new Date().toISOString(), status: send ? 'aguardando' : 'rascunho', versions: [] };
  requests = [request, ...requests]; emit(); return { request };
}
export function respondSupplierRequest(id: string, items: ImportItem[], file?: string) {
  const r = requests.find(r => r.id === id); if (!r) return 'Pedido não encontrado';
  if (!can(currentUser(), getErp().roles, 'compras.gerenciar', r.branchId)) return 'Sem permissão para conferir preços';
  const error = validateResponse(r, items); if (error) return error;
  const safe = schema.shape.items.safeParse(items); if (!safe.success) return 'Dados de resposta inválidos';
  requests = requests.map(x => x.id === id ? { ...x, status: 'resposta', versions: [...x.versions, { at: new Date().toISOString(), user: currentUser().name, file, items: safe.data }] } : x);
  links = { ...links, [r.supplierId]: { ...links[r.supplierId], ...Object.fromEntries(items.filter(i => i.supplierCode).map(i => [i.supplierCode ?? '', i.materialId])) } };
  emit(); return null;
}
export function supplierAction(id: string, action: 'send' | 'correction' | 'approve') {
  const r = requests.find(r => r.id === id); if (!r) return 'Pedido não encontrado';
  if (!can(currentUser(), getErp().roles, 'compras.gerenciar', r.branchId)) return 'Sem permissão para gerenciar compra';
  if (action === 'send' && r.status !== 'rascunho') return 'Somente rascunhos podem ser enviados';
  if (action !== 'send' && r.status !== 'resposta') return 'Confira uma resposta antes de prosseguir';
  if (action === 'approve') {
    const latest = r.versions.at(-1); if (!latest) return 'Sem preços confirmados';
    const error = createRequisition(r.branchId, r.items.map(i => ({ materialId: i.materialId, qty: i.requested })), { supplierId: r.supplierId, prices: Object.fromEntries(latest.items.map(i => [i.materialId, i.unitPrice ?? 0])) });
    if (error) return error;
    requests = requests.map(x => x.id === id ? { ...x, status: 'aprovado', purchaseId: getPurchasing().pos[0]?.id } : x);
  } else requests = requests.map(x => x.id === id ? { ...x, status: action === 'send' ? 'aguardando' : 'correcao' } : x);
  emit(); return null;
}
export const supplierStatus = { rascunho: 'Rascunho', aguardando: 'Aguardando preços', resposta: 'Em conferência', aprovado: 'Compra aprovada', correcao: 'Correção solicitada' };