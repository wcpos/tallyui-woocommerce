import type { Session } from '../auth/session';

export interface StoreInfo { id: number; name: string; currency: string; locale?: string }

export async function fetchStoreInfo(
  session: Session, headers: Record<string, string>, fetchImpl: typeof fetch = fetch,
): Promise<StoreInfo> {
  const response = await fetchImpl(`${session.site.wcposApiUrl}/stores`, { headers });
  if (!response.ok) throw new Error(`stores request failed: ${response.status}`);
  const [store] = await response.json();
  if (!store) throw new Error('stores response is empty');
  return { id: store.id, name: store.name, currency: store.currency.toUpperCase(), locale: store.locale };
}
