import { describe, expect, it } from 'vitest';
import { parseCsv, reconcileCsv, brazilNumber, CSV_MAX_BYTES, safeCsvCell } from './order-csv';
import { materials, getState } from './stock';
import { saveSupplierRequest, respondSupplierRequest, validateResponse, supplierAction } from './supplier-orders';
import { getPurchasing, createRequisition } from './purchasing';

describe('CSV de pedidos', () => {
  it('não cria compra confirmada sem preços válidos', () => {
    const before = getPurchasing().pos.length;
    expect(createRequisition('c1', [{ materialId: 'm1', qty: 10 }], { supplierId: 's1', prices: {} })).toBe('Fornecedor ou preços confirmados inválidos');
    expect(getPurchasing().pos).toHaveLength(before);
  });
  it('preserva códigos com zeros e valores brasileiros', () => {
    const p = parseCsv('codigo;material;unidade;quantidade;preco unitario\n0001;Resina composta A2;seringa;10;1.234,56', 100);
    expect(p.data[0]?.codigo).toBe('0001');
    expect(reconcileCsv(p.data, p.mapping, materials)[0]).toMatchObject({ materialId: 'm1', qty: 10, price: 1234.56, error: '' });
  });
  it('aceita campos entre aspas e delimitador vírgula', () => {
    const p = parseCsv('codigo,material,quantidade,preco\nMAT-0001,"Resina, A2",10,"89,90"', 100);
    expect(reconcileCsv(p.data, p.mapping, materials)[0]?.price).toBe(89.9);
  });
  it('limita arquivos a 5 MB', () => { expect(() => parseCsv('codigo;quantidade\nx;1', CSV_MAX_BYTES + 1)).toThrow('5 MB'); });
  it('limita arquivos a 2000 linhas', () => { expect(() => parseCsv('codigo;quantidade\n' + 'x;1\n'.repeat(2001), 10000)).toThrow('2.000'); });
  it('não concilia nomes ambíguos automaticamente', () => {
    const p = parseCsv('material;quantidade\nResina composta A2;1', 60);
    expect(reconcileCsv(p.data, p.mapping, [...materials, { ...materials[0], id: 'other' }])[0]?.error).toBe('Correspondência ambígua');
  });
  it('bloqueia unidades incompatíveis', () => { const p = parseCsv('codigo;unidade;quantidade\nMAT-0001;caixa;1', 60); expect(reconcileCsv(p.data, p.mapping, materials)[0]?.error).toBe('Unidade incompatível'); });
  it('sinaliza duplicidades', () => { const p = parseCsv('codigo;quantidade\nMAT-0001;1\nMAT-0001;2', 70); expect(reconcileCsv(p.data, p.mapping, materials)[1]?.error).toBe('Material duplicado'); });
  it('rejeita quantidades e preços inválidos', () => { expect(brazilNumber('abc')).toBeNaN(); const p = parseCsv('codigo;quantidade;preco\nMAT-0001;0;-1', 60); expect(reconcileCsv(p.data, p.mapping, materials)[0]?.error).toBe('Quantidade ou preço inválido'); });
  it('neutraliza fórmulas na exportação', () => { expect(safeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)"); });
  it('registra versão sem aprovar nem alterar estoque ou custo', () => {
    const stock = getState(); const cost = materials[0]?.cost;
    const result = saveSupplierRequest({ branchId: 'c1', supplierId: 's1', desiredDate: '2026-11-18', priority: 'normal', notes: '', items: [{ materialId: 'm1', requested: 10 }] }, true);
    if (!result.request) throw new Error(result.error);
    expect(validateResponse(result.request, [{ materialId: 'm2', requested: 10, unitPrice: 12 }])).toBe('Material, quantidade ou preço inválido');
    expect(respondSupplierRequest(result.request.id, [{ materialId: 'm1', requested: 10, unitPrice: 123 }])).toBeNull();
    expect(getPurchasing().pos.some(p => p.id === result.request?.purchaseId)).toBe(false);
    expect(getState()).toBe(stock); expect(materials[0]?.cost).toBe(cost);
  });
  it('aprova apenas uma compra com os preços conferidos', () => {
    const result = saveSupplierRequest({ branchId: 'c1', supplierId: 's1', desiredDate: '2026-11-18', priority: 'normal', notes: '', items: [{ materialId: 'm1', requested: 10 }] }, true);
    if (!result.request) throw new Error(result.error);
    const id = result.request.id;
    expect(supplierAction(id, 'approve')).toBe('Confira uma resposta antes de prosseguir');
    expect(respondSupplierRequest(id, [{ materialId: 'm1', requested: 10, unitPrice: 123 }])).toBeNull();
    const before = getPurchasing().pos.length;
    expect(supplierAction(id, 'approve')).toBeNull();
    expect(getPurchasing().pos).toHaveLength(before + 1);
    expect(getPurchasing().pos[0]?.items[0]).toMatchObject({ qty: 10, chosen: 's1', quotes: [{ supplierId: 's1', unitPrice: 123 }] });
    expect(supplierAction(id, 'approve')).toBe('Confira uma resposta antes de prosseguir');
    expect(getPurchasing().pos).toHaveLength(before + 1);
  });
});