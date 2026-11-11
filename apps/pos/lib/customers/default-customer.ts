import { useCallback, useEffect, useState } from 'react';
import type { CustomerSummary } from '@tallyui/pos';
import type { StoreInfo } from '../catalogue/store-info';

// v2's default_customer / default_customer_is_cashier: v2 writes an edit to its local store record only, never to
// the server, so here it is per-device. Customer ids belong to one site: the stored object is keyed by site home URL.
export interface DefaultCustomerSetting { customerId: number; isCashier: boolean }
export const DEFAULT_CUSTOMER_KEY = 'tallywoo.default_customer.v1';
type Store = Pick<StoreInfo, 'defaultCustomerId' | 'defaultCustomerIsCashier'>;

// Every mounted useDefaultCustomerSetting follows a save, so the sale screen sees a change made in Settings.
const listeners = new Set<() => void>();

function readAll(storage?: Storage): Record<string, unknown> {
  const parsed = JSON.parse((storage ?? globalThis.localStorage).getItem(DEFAULT_CUSTOMER_KEY) ?? '{}');
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
}

/** This site's stored setting, or undefined when there is none or it is not a valid one. */
export function loadDefaultCustomerSetting(site: string, storage?: Storage): DefaultCustomerSetting | undefined {
  try {
    const stored = readAll(storage)[site] as Partial<DefaultCustomerSetting> | undefined;
    const { customerId, isCashier } = stored ?? {};
    return Number.isInteger(customerId) && customerId! >= 0 && typeof isCashier === 'boolean'
      ? { customerId: customerId!, isCashier } : undefined;
  } catch { return undefined; }
}

export function saveDefaultCustomerSetting(site: string, setting: DefaultCustomerSetting, storage?: Storage): void {
  try {
    let all: Record<string, unknown> = {};
    try { all = readAll(storage); } catch {}
    (storage ?? globalThis.localStorage).setItem(DEFAULT_CUSTOMER_KEY, JSON.stringify({ ...all, [site]: setting }));
  } catch {}
  listeners.forEach(listener => listener());
}

/** The stored setting, else the store's: Guest and not the cashier when the store sends neither. */
export function effectiveDefaultCustomerSetting(store: Store, stored: DefaultCustomerSetting | undefined): DefaultCustomerSetting {
  return stored ?? { customerId: store.defaultCustomerId ?? 0, isCashier: store.defaultCustomerIsCashier ?? false };
}

const summary = ({ id, name, email }: CustomerSummary): CustomerSummary => ({ id, name, ...(email ? { email } : {}) });

/** v2's use-default-customer-id: the signed-in user when isCashier, else the chosen customer; null is Guest. */
export async function resolveDefaultCustomer(
  setting: DefaultCustomerSetting, user: { id: number; displayName: string },
  getCustomer: (id: string) => Promise<CustomerSummary | null>,
): Promise<CustomerSummary | null> {
  if (setting.isCashier) {
    // A cashier the store has no customer record for still goes on the sale, under their WordPress user id.
    const found = await getCustomer(String(user.id)).catch(() => null);
    return found ? summary(found) : { id: String(user.id), name: user.displayName };
  }
  if (setting.customerId <= 0) return null;
  return getCustomer(String(setting.customerId)).then(found => found ? summary(found) : null, () => null);
}

/** The effective setting for this site and store, and its save; undefined until both are known. */
export function useDefaultCustomerSetting(site: string | undefined, store: Store | undefined)
  : [DefaultCustomerSetting | undefined, (next: DefaultCustomerSetting) => void] {
  const [stored, setStored] = useState(() => site ? loadDefaultCustomerSetting(site) : undefined);
  useEffect(() => {
    const reload = () => setStored(site ? loadDefaultCustomerSetting(site) : undefined);
    reload();
    listeners.add(reload);
    return () => { listeners.delete(reload); };
  }, [site]);
  const save = useCallback((next: DefaultCustomerSetting) => { if (site) saveDefaultCustomerSetting(site, next); }, [site]);
  return [store ? effectiveDefaultCustomerSetting(store, stored) : undefined, save];
}

const noLookup = async () => null;

/** The resolved customer, null for Guest; undefined while it resolves, and again while a changed setting re-resolves. */
export function useDefaultCustomer(
  setting: DefaultCustomerSetting | undefined, user: { id: number; displayName: string } | undefined,
  getCustomer?: (id: string) => Promise<CustomerSummary | null>,
): CustomerSummary | null | undefined {
  const key = setting && user ? JSON.stringify([setting.customerId, setting.isCashier, user.id, user.displayName]) : undefined;
  const [resolved, setResolved] = useState<{ key: string; customer: CustomerSummary | null }>();
  useEffect(() => {
    if (!key) return;
    let live = true;
    void resolveDefaultCustomer(setting!, user!, getCustomer ?? noLookup)
      .then(customer => { if (live) setResolved({ key, customer }); });
    return () => { live = false; };
  }, [key, getCustomer]);
  return resolved && resolved.key === key ? resolved.customer : undefined;
}
