import { describe, expect, it } from 'vitest';
import { supplierSummary, supplierPortalAccess } from './supplier-summary';
import type { SupplierRequest } from './supplier-orders';
import type { Supplier } from './purchasing';
describe('resumo de fornecedores', () => {
  const base: SupplierRequest = { id: 'r1', number: 'FOR-1', supplierId: 's1', branchId: 'cd', desiredDate: '2026-12-01', priority: 'normal', notes: '', status: 'aguardando', items: [], versions: [], createdAt: '2026-11-12' };
  it('conta apenas pedidos do fornecedor e não duplica compra originada no pedido', () => {
    const summary = supplierSummary('s1', [base, { ...base, id: 'r2', status: 'aprovado', purchaseId: 'po1' }, { ...base, supplierId: 's2', id: 'r3' }], [{ id: 'po1', number: 'OC-1', branchId: 'cd', createdAt: '', status: 'aprovado', items: [{ materialId: 'm1', qty: 10, received: 0, quotes: [], chosen: 's1' }] }]);
    expect(summary).toEqual({ requests: 2, pending: 1, review: 0, purchases: 1, total: 2 });
  });
  it('só indica permitido quando o acesso foi habilitado', () => {
    const supplier: Supplier = { id: 's1', name: 'Empresa', contact: 'Contato', email: 'contato@example.com', cnpj: '', leadDays: 5, rating: 0, categories: [] };
    expect(supplierPortalAccess(supplier).enabled).toBe(false);
    expect(supplierPortalAccess({ ...supplier, portalEnabled: true, portalEmail: 'portal@example.com' })).toEqual({ enabled: true, email: 'portal@example.com', name: 'Contato', profile: 'Fornecedor' });
  });
});