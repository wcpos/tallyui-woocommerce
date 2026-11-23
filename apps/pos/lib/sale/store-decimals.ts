// Stopgap for money verify suspect 1 (docs/money-suspects.md): the till
// rounds money at the currency's ISO digits, but WooCommerce rounds an order's tax and total to the store's "Number of
// decimals" (abstract-wc-order.php:2282 update_taxes, :2436 calculate_totals), so the two totals part when they differ.
// The till refuses such a store until TallyUI rounds to the store's decimals the way WooCommerce does; then this goes.
import { minorUnitDigits, type StoreSettings } from '@tallyui/core';

export function storeDecimalsMismatch(settings: StoreSettings): { storeDecimals: number; currencyDigits: number } | null {
  const storeDecimals = settings.moneyFormat?.decimals;
  if (storeDecimals === undefined) return null;
  const currencyDigits = minorUnitDigits(settings.currency);
  return storeDecimals !== currencyDigits ? { storeDecimals, currencyDigits } : null;
}
