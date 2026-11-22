import type { JSX, ReactNode } from 'react';
import { MoneyFormatProvider } from '@tallyui/core';
import { useStoreMoney } from './store-money';

/**
 * Scopes `@tallyui/components` money (Receipt and the like) to one document's currency. Core's provider applies its
 * format to any currency, so under the store-wide provider a USD order on a EUR store would print `12,50 €`. Here the
 * store's format applies only when `currency` is the store's (compared upper-case, as `formatStoreMoney` does);
 * otherwise `format` is `undefined`. Core 4.0.0's `MoneyFormatProvider` builds its context value fresh as
 * `{ locale, format }` and its hooks read the nearest one, so a nested `undefined` replaces the outer format rather
 * than inheriting it, and the money reads as Intl does for that currency (main's behaviour).
 */
export function StoreMoneyFor({ currency, children }: { currency: string; children: ReactNode }): JSX.Element {
  const store = useStoreMoney();
  const format = store && currency.toUpperCase() === store.currency.toUpperCase() ? store.format : undefined;
  return <MoneyFormatProvider format={format}>{children}</MoneyFormatProvider>;
}
