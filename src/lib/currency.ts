export const realMask = {
  thousandSeparator: '.',
  decimalSeparator: ',',
  allowedDecimalSeparators: [','],
  decimalScale: 2,
  fixedDecimalScale: true,
  prefix: 'R$ ',
  allowNegative: false,
} as const;

export function currencyValue(value: number | undefined): number | '' {
  return value !== undefined && Number.isFinite(value) ? value : '';
}