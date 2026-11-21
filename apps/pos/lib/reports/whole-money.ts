import { formatMoney, type MoneyFormat } from '@tallyui/core';

/**
 * The reports donut centres' whole currency units: the amount rounded to whole units and shown with no decimals, in the
 * store's money format when given (core's formatMoney honours `decimals`). A currency it can't format reads as the
 * bare minor amount.
 */
export function wholeMoney(minor: number, currency: string, locale: string | undefined, format?: MoneyFormat): string {
  return formatMoney({ amount: minor, currency }, locale, { ...format, decimals: 0 }) ?? String(minor);
}
