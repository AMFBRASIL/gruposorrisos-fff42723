import { describe, expect, it } from 'vitest';
import { numericFormatter, removeNumericFormat } from 'react-number-format';
import { currencyValue, realMask } from './currency';

describe('Brazilian real fields', () => {
  it('formats thousands with dots and cents with a comma', () => {
    expect(numericFormatter('1234.56', { ...realMask, allowedDecimalSeparators: [','] })).toBe('R$ 1.234,56');
  });
  it('retains two decimal places', () => {
    expect(numericFormatter('500', { ...realMask, allowedDecimalSeparators: [','] })).toBe('R$ 500,00');
  });
  it('converts pasted Brazilian currency to a numeric amount', () => {
    expect(removeNumericFormat('R$ 1.234,56', { from: { start: 0, end: 0 }, to: { start: 0, end: 11 }, lastValue: '' }, { ...realMask, allowedDecimalSeparators: [','] })).toBe('1234.56');
  });
  it('keeps blank optional fields distinct from zero', () => {
    expect(currencyValue(undefined)).toBe('');
    expect(currencyValue(0)).toBe(0);
    expect(currencyValue(1234.56)).toBe(1234.56);
  });
});