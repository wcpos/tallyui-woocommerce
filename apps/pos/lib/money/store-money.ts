import { createContext, useCallback, useContext } from 'react';
import { formatMoney, type Money, type MoneyFormat } from '@tallyui/core';

/**
 * The store's money format together with the currency it belongs to. v2 formats an order with the order's own
 * currency, so the store's symbol, separators and decimals apply only to money in the store's currency.
 */
export interface StoreMoney { currency: string; format: MoneyFormat }

/**
 * The one place the app formats money (the money guard test keeps it so). Money in the store's currency reads in the
 * store's format; any other currency (or no store) reads as Intl does for that currency, as before H4b. `decimals`, when
 * given, overrides the places on both paths (the reports' whole units).
 */
export function formatStoreMoney(money: Money, store?: StoreMoney, locale?: string, decimals?: number): string | undefined {
  if (store && money.currency.toUpperCase() === store.currency.toUpperCase()) {
    return formatMoney(money, locale, decimals === undefined ? store.format : { ...store.format, decimals });
  }
  return decimals === undefined ? formatMoney(money, locale) : formatMoney(money, locale, { decimals });
}

/**
 * Handed down by `StoreSettingsProvider` (lib/sale/store-settings-context.tsx). Its own context, not the settings
 * state's: it changes only when the format's fields or the currency do, and a component rendered without the provider
 * (most component tests) reads `undefined` and formats as Intl does.
 */
export const StoreMoneyContext = createContext<StoreMoney | undefined>(undefined);

/** The signed-in store's currency and money format; `undefined` until its settings are in, or outside the provider. */
export function useStoreMoney(): StoreMoney | undefined {
  return useContext(StoreMoneyContext);
}

/** `formatStoreMoney` bound to the store's money; one function while that reads the same, so safe in memo deps. */
export function useFormatStoreMoney(): (money: Money, locale?: string) => string | undefined {
  const store = useStoreMoney();
  return useCallback((money: Money, locale?: string) => formatStoreMoney(money, store, locale), [store]);
}

/** The bound formatter a component hands to its module-level helpers. */
export type FormatStoreMoney = ReturnType<typeof useFormatStoreMoney>;
