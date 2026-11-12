import { describe, expect, it } from 'vitest';
import { applyDemoPortalResponse } from './supplier-portal-demo';
import type { PortalRequest } from './supplier-portal';

describe('portal apenas demonstrativo', () => {
  it('responde em memória sem modificar o pedido original', () => {
    const request: PortalRequest = { id: 'demo', supplier_id: 's1', number: 'DEMO', created_at: '2026-11-12', status: 'aguardando', responses: [], payload: { supplierName: 'Fornecedor', branchName: 'Filial', desiredDate: '2026-12-01', notes: '', priority: 'normal', items: [{ materialId: 'm1', name: 'Material', code: '001', requested: 10, unit: 'cx' }] } };
    const result = applyDemoPortalResponse(request, [{ materialId: 'm1', requested: 10, unitPrice: 12.5 }], 'Teste visual', 'precos.csv');
    expect(result.status).toBe('resposta');
    expect(result.responses[0].items[0].unitPrice).toBe(12.5);
    expect(result.responses[0].notes).toBe('Teste visual');
    expect(request.responses).toEqual([]);
    expect(request.status).toBe('aguardando');
  });
});