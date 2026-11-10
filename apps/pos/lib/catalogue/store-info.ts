import { SessionExpiredError } from '../auth/session';
import type { Session } from '../auth/session';

export interface StoreInfo {
  id: number; name: string; currency: string; locale?: string;
}

export async function fetchStoreInfo(
  session: Session, headers: Record<string, string>, fetchImpl: typeof fetch = fetch,
): Promise<StoreInfo> {
  const response = await fetchImpl(`${session.site.wcposApiUrl}/stores`, { headers });
  // The store refused the token before its expiry (revoked, or rotated by another device): the session must be held for a fresh sign-in.
  if (response.status === 401 || response.status === 403) throw new SessionExpiredError();
  if (!response.ok) throw new Error(`stores request failed: ${response.status}`);
  const [store] = await response.json();
  if (!store) throw new Error('stores response is empty');
  return { id: store.id, name: store.name, currency: store.currency.toUpperCase(), locale: store.locale };
}
