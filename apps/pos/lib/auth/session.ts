import type { AuthTokens } from './login';
import type { StoreSite } from './site';

export interface Session { site: StoreSite; tokens: AuthTokens }
export const SESSION_KEY = 'tallywoo.session';
export const PENDING_KEY = 'tallywoo.auth.pending';
export const REFRESH_WINDOW_SECONDS = 360;

export function loadSession(storage?: Storage): Session | null {
  try {
    return JSON.parse((storage ?? globalThis.localStorage).getItem(SESSION_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function saveSession(session: Session, storage?: Storage): void {
  try {
    (storage ?? globalThis.localStorage).setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

export function clearSession(storage?: Storage): void {
  try {
    (storage ?? globalThis.localStorage).removeItem(SESSION_KEY);
  } catch {}
}

export class SessionExpiredError extends Error {}

export async function refreshSession(
  session: Session, fetchImpl: typeof fetch = fetch, nowSeconds = Math.floor(Date.now() / 1000),
): Promise<Session> {
  if (session.tokens.expiresAt - REFRESH_WINDOW_SECONDS > nowSeconds) return session;
  const response = await fetchImpl(`${session.site.wcposApiUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-WCPOS': '1' },
    body: JSON.stringify({ refresh_token: session.tokens.refreshToken }),
  });
  if (response.status >= 500) throw new Error(`refresh failed: ${response.status}`);
  if (response.status >= 400) throw new SessionExpiredError();
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('refresh failed: bad body');
  }
  if (typeof body?.access_token !== 'string') throw new SessionExpiredError();
  return {
    ...session,
    tokens: {
      ...session.tokens,
      accessToken: body.access_token,
      expiresAt: body.expires_at == null
        ? nowSeconds + Number.parseInt(String(body.expires_in), 10)
        : Number.parseInt(String(body.expires_at), 10),
    },
  };
}
