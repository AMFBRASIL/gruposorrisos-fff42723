import { NumericFormat } from 'react-number-format';
import type { ComponentProps } from 'react';
import { Input } from './input';
import { currencyValue, realMask } from '@/lib/currency';

type CurrencyInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'defaultValue'> & {
  value: number | '';
  onValueChange: (value: number | '') => void;
};

export function CurrencyInput({ value, onValueChange, placeholder = 'R$ 0,00', ...props }: CurrencyInputProps) {
  return <NumericFormat
    {...props}
    {...realMask}
    allowedDecimalSeparators={[...realMask.allowedDecimalSeparators]}
    customInput={Input}
    type="text"
    inputMode="decimal"
    value={value}
    placeholder={placeholder}
    onValueChange={(values, source) => {
      if (source.source === 'event') onValueChange(currencyValue(values.floatValue));
    }}
  />;
}