import { minorUnitDigits } from '@tallyui/core';
import { formatStoreMoney, type StoreMoney } from '../money/store-money';

/**
 * The reports donut centres' whole currency units: the amount rounded to whole units and shown with no decimals, in the
 * store's money format when given and in its currency (core's formatMoney honours `decimals`). A currency it can't
 * format reads as the bare whole amount. Both paths round half away from zero, so a negative half goes down
 * (-12.50 reads -13), as core's formatter does with the absolute amount; plain `Math.round` would give -12.
 */
export function wholeMoney(minor: number, currency: string, locale: string | undefined, store?: StoreMoney): string {
  const whole = Math.sign(minor) * Math.round(Math.abs(minor) / 10 ** minorUnitDigits(currency));
  return formatStoreMoney({ amount: minor, currency }, store, locale, 0) ?? String(whole === 0 ? 0 : whole);
}
