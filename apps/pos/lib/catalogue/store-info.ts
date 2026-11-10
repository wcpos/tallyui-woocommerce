import { SessionExpiredError } from '../auth/session';
import type { Session } from '../auth/session';

export interface StoreInfo {
  id: number; name: string; currency: string; locale?: string;
}

export class StoreAccessDeniedError extends Error {
  constructor() {
    super('This user cannot use the POS on this store. Ask a store manager for POS access, or sign out and sign in as another user.');
  }
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
  return { id: store.id, name: store.name, currency: store.currency.toUpperCase(), locale: store.locale };
}
