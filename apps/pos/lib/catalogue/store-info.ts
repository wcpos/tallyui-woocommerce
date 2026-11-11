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
}

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
    id: store.id, name: store.name, currency: store.currency.toUpperCase(), locale: store.locale,
    address: {
      address1: text(store.store_address), address2: text(store.store_address_2), city: text(store.store_city),
      state: text(store.store_state), postcode: text(store.store_postcode), country: text(store.store_country),
    },
    taxBasedOn: taxBasedOn(store.tax_based_on),
    calcTaxes: yesNo(store.calc_taxes),
  };
}
