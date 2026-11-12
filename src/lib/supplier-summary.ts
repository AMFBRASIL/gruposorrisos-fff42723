import type { Supplier, PurchaseOrder } from './purchasing';
import type { SupplierRequest } from './supplier-orders';

export function supplierSummary(id: string, requests: SupplierRequest[], orders: PurchaseOrder[]) {
  const own = requests.filter(r => r.supplierId === id);
  const purchases = orders.filter(p => p.items.some(i => i.chosen === id));
  return { requests: own.length, pending: own.filter(r => ['aguardando', 'correcao'].includes(r.status)).length, review: own.filter(r => r.status === 'resposta').length, purchases: purchases.length, total: own.length + purchases.filter(p => !own.some(r => r.purchaseId === p.id)).length };
}
export function supplierPortalAccess(supplier: Supplier) {
  return { enabled: supplier.portalEnabled === true, email: supplier.portalEmail || supplier.email, name: supplier.portalContact || supplier.contact, profile: 'Fornecedor' };
}
export function validateDemoPassword(password: string, confirmation: string) {
  if (!password && !confirmation) return null;
  return password && password === confirmation ? null : 'As senhas não coincidem';
}