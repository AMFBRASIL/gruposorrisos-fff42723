import { useSyncExternalStore } from 'react';
import { branchName } from './erp';
import { getPurchasing } from './purchasing';
import { getMaterial } from './stock';
import { useSupplierRequests, respondDemoSupplierRequest } from './supplier-orders';
import { validatePortalPrices, type PortalRequest, type PortalResponse } from './supplier-portal';

const sample: PortalRequest = { id: 'demo-portal-1001', supplier_id: 's1', number: 'DEMO-1001', created_at: '2026-11-12T11:00:00Z', status: 'aguardando', responses: [], payload: { supplierName: 'Dental Sul Distribuidora', branchName: 'Clínica demonstrativa', desiredDate: '2026-12-01', priority: 'normal', notes: 'Pedido demonstrativo para conferência de preços.', items: [{ materialId: 'demo-luvas', code: 'DEMO-001', name: 'Luvas de procedimento', unit: 'cx', requested: 10 }, { materialId: 'demo-mascaras', code: 'DEMO-002', name: 'Máscaras descartáveis', unit: 'cx', requested: 5 }] } };
let responses: Record<string, PortalResponse[]> = {};
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function applyDemoPortalResponse(request: PortalRequest, items: PortalResponse['items'], notes: string, file?: string): PortalRequest {
  const error = validatePortalPrices(request, items);
  if (error) throw new Error(error);
  return { ...request, status: 'resposta', responses: [...request.responses, { id: crypto.randomUUID(), items: items.map(i => ({ ...i })), notes, file_name: file ?? null, created_at: new Date().toISOString() }] };
}
export function useDemoPortalRequests() {
  const requests = useSupplierRequests();
  const versions = useSyncExternalStore(subscribe, () => responses, () => responses);
  const rows: PortalRequest[] = requests.filter(r => r.status !== 'rascunho').map(r => ({ id: r.id, supplier_id: r.supplierId, number: r.number, status: r.status, created_at: r.createdAt, responses: r.versions.map((v, index) => ({ id: `${r.id}-${index}`, created_at: v.at, items: v.items, notes: v.notes ?? '', file_name: v.file ?? null })), payload: { supplierName: getPurchasing().sup.find(s => s.id === r.supplierId)?.name ?? r.supplierId, branchName: branchName(r.branchId), desiredDate: r.desiredDate, priority: r.priority, notes: r.notes, items: r.items.map(i => { const m = getMaterial(i.materialId); return { ...i, name: m.name, code: m.code, unit: m.unit, barcode: m.barcode }; }) } }));
  return [{ ...sample, status: versions[sample.id]?.length ? 'resposta' : sample.status, responses: versions[sample.id] ?? [] }, ...rows];
}
export function answerDemoPortalRequest(request: PortalRequest, items: PortalResponse['items'], notes: string, file?: string) {
  const updated = applyDemoPortalResponse(request, items, notes, file);
  if (request.id !== sample.id) {
    const error = respondDemoSupplierRequest(request.id, items, notes, file);
    if (error) throw new Error(error);
  } else {
    responses = { ...responses, [request.id]: updated.responses };
    listeners.forEach(listener => listener());
  }
}