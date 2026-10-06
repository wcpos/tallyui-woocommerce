import type { Session } from '../auth/session';

export interface StoreInfo {
  id: number; name: string; currency: string; locale?: string;
  chargesTax: 'no' | 'yes' | 'unknown';
}

export async function fetchStoreInfo(
  session: Session, headers: Record<string, string>, fetchImpl: typeof fetch = fetch,
): Promise<StoreInfo> {
  const response = await fetchImpl(`${session.site.wcposApiUrl}/stores`, { headers });
  if (!response.ok) throw new Error(`stores request failed: ${response.status}`);
  const [store] = await response.json();
  if (!store) throw new Error('stores response is empty');
  // WCPOS 1.10.x serves WooCommerce's "Enable taxes" as calc_taxes on /stores
  // (includes/Abstracts/Store.php); the till prices without tax until G5, so it must know.
  return { id: store.id, name: store.name, currency: store.currency.toUpperCase(), locale: store.locale,
    chargesTax: store.calc_taxes === 'no' ? 'no' : store.calc_taxes === 'yes' ? 'yes' : 'unknown' };
}
