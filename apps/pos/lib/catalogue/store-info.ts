import { SessionExpiredError } from '../auth/session';
import type { Session } from '../auth/session';

export interface StoreAddress {
  address1?: string; address2?: string; city?: string; state?: string; postcode?: string; country?: string;
}

export type TaxBasedOn = 'base' | 'billing' | 'shipping';

export interface StoreInfo {
  id: number; name: string; currency: string; locale?: string;
  /** WooCommerce's store base address: `state` is a code (e.g. `AL`), `country` ISO alpha-2. */
  address?: StoreAddress;
  taxBasedOn?: TaxBasedOn;
  calcTaxes?: boolean;
  /** v2's `default_customer`: a WordPress user id, `0` for Guest. */
  defaultCustomerId?: number;
  defaultCustomerIsCashier?: boolean;
  /** WooCommerce's price format. `thousandSeparator: ''` means no grouping. */
  numberFormat?: { position?: CurrencyPosition; thousandSeparator?: string; decimalSeparator?: string; decimals?: number };
}

export type CurrencyPosition = 'left' | 'right' | 'left_space' | 'right_space';
const CURRENCY_POSITIONS: readonly unknown[] = ['left', 'right', 'left_space', 'right_space'] satisfies CurrencyPosition[];

export class StoreAccessDeniedError extends Error {
  constructor() {
    super('This user cannot use the POS on this store. Ask a store manager for POS access, or sign out and sign in as another user.');
  }
}

// WooCommerce sends an unset option as an empty string; the app reads that as absent.
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function taxBasedOn(value: unknown): TaxBasedOn | undefined {
  return value === 'base' || value === 'billing' || value === 'shipping' ? value : undefined;
}

function yesNo(value: unknown): boolean | undefined {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return undefined;
}

// WooCommerce may send a count as a string (`"2"`); anything but a whole number of at least 0 reads as absent.
function count(value: unknown): number | undefined {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : undefined;
}

// WCPOS sends a real boolean; an option read straight from WordPress is 'yes' / 'no'.
function flag(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : yesNo(value);
}

// WordPress locales use `_` (`en_US`, `de_DE_formal`), which Intl rejects, and `formatMoney` then
// returns undefined, so screens fall back to raw minor units. Convert to a BCP 47 tag, dropping
// trailing subtags Intl does not accept (`pt_PT_ao90` -> `pt-PT`).
export function toBcp47Locale(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  const subtags = value.replaceAll('_', '-').split('-');
  while (subtags.length > 0) {
    try {
      return Intl.getCanonicalLocales(subtags.join('-'))[0];
    } catch {
      subtags.pop();
    }
  }
  return undefined;
}

export async function fetchStoreInfo(
  session: Session, headers: Record<string, string>, fetchImpl: typeof fetch = fetch,
): Promise<StoreInfo> {
  const response = await fetchImpl(`${session.site.wcposApiUrl}/stores`, { headers });
  // The store answers 401 for a missing, expired or revoked token: the session must be held for a fresh sign-in.
  if (response.status === 401) throw new SessionExpiredError();
  // 403 means a signed-in user without access_woocommerce_pos; signing in again returns the same user, so it is not a hold.
  if (response.status === 403) throw new StoreAccessDeniedError();
  if (!response.ok) throw new Error(`stores request failed: ${response.status}`);
  const [store] = await response.json();
  if (!store) throw new Error('stores response is empty');
  return {
    id: store.id, name: store.name, currency: store.currency.toUpperCase(), locale: toBcp47Locale(store.locale),
    address: {
      address1: text(store.store_address), address2: text(store.store_address_2), city: text(store.store_city),
      state: text(store.store_state), postcode: text(store.store_postcode), country: text(store.store_country),
    },
    taxBasedOn: taxBasedOn(store.tax_based_on),
    calcTaxes: yesNo(store.calc_taxes),
    defaultCustomerId: count(store.default_customer),
    defaultCustomerIsCashier: flag(store.default_customer_is_cashier),
    numberFormat: {
      position: CURRENCY_POSITIONS.includes(store.currency_pos) ? store.currency_pos : undefined,
      // An empty thousand separator is WooCommerce's "no grouping", so it is kept, unlike the other text fields.
      thousandSeparator: typeof store.price_thousand_sep === 'string' ? store.price_thousand_sep : undefined,
      decimalSeparator: text(store.price_decimal_sep),
      decimals: count(store.price_num_decimals),
    },
  };
}
