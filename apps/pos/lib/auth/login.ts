export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: number; uuid: string; displayName: string };
}

export class LoginError extends Error {
  constructor(readonly code: 'state_mismatch' | 'missing_token' | 'no_pending', message: string) {
    super(message);
  }
}

export function buildAuthUrl(authUrl: string, redirectUri: string, state: string): string {
  const url = new URL(authUrl);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('platform', 'web');
  return url.toString();
}

export function newState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function parseCallback(search: string, expectedState: string): AuthTokens {
  const params = new URLSearchParams(search);
  if (params.get('state') !== expectedState) {
    throw new LoginError('state_mismatch', 'The sign-in state does not match. Try again.');
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) {
    throw new LoginError('missing_token', 'Sign-in did not return the required tokens.');
  }
  return {
    accessToken, refreshToken, expiresAt: Number.parseInt(params.get('expires_at') ?? '', 10),
    user: {
      id: Number.parseInt(params.get('id') ?? '', 10),
      uuid: params.get('uuid') ?? '',
      displayName: params.get('display_name') ?? '',
    },
  };
}
