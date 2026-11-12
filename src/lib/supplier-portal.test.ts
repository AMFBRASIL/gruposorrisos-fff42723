import { describe, expect, it } from 'vitest';
import { validatePortalPrices, type PortalPayload } from './supplier-portal';
const payload: PortalPayload = { supplierName: 'Fornecedor A', branchName: 'Filial A', desiredDate: '2026-12-01', priority: 'normal', notes: '', items: [{ materialId: 'a', requested: 10, name: 'Material A', code: 'A', unit: 'un' }, { materialId: 'b', requested: 5, name: 'Material B', code: 'B', unit: 'un' }] };
const prices = [{ materialId: 'a', requested: 10, unitPrice: 12.5 }, { materialId: 'b', requested: 5, unitPrice: 20 }];
describe('respostas do fornecedor', () => {
  it('aceita preços para todos os itens solicitados', () => expect(validatePortalPrices({ status: 'aguardando', payload }, prices)).toBeNull());
  it('exige todos os itens', () => expect(validatePortalPrices({ status: 'aguardando', payload }, prices.slice(0, 1))).not.toBeNull());
  it('preserva as quantidades de Compras', () => expect(validatePortalPrices({ status: 'aguardando', payload }, [{ ...prices[0], requested: 9 }, prices[1]])).not.toBeNull());
  it('rejeita material fora do pedido', () => expect(validatePortalPrices({ status: 'aguardando', payload }, [{ ...prices[0], materialId: 'outro' }, prices[1]])).not.toBeNull());
  it('rejeita preços ausentes e negativos', () => { expect(validatePortalPrices({ status: 'aguardando', payload }, [{ materialId: 'a', requested: 10 }, prices[1]])).not.toBeNull(); expect(validatePortalPrices({ status: 'aguardando', payload }, [{ ...prices[0], unitPrice: -1 }, prices[1]])).not.toBeNull(); });
  it('bloqueia reenvio depois de respondido', () => expect(validatePortalPrices({ status: 'resposta', payload }, prices)).not.toBeNull());
  it('permite nova versão após solicitação de correção', () => expect(validatePortalPrices({ status: 'correcao', payload }, prices)).toBeNull());
});