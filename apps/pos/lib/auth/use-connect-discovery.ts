import { useCallback, useState } from 'react';
import { SiteError } from './site';
import type { ConnectStage } from './site';

// WCPOS v2's error-code docs root (monorepo packages/utils/src/logger/constants.ts).
export const ERROR_CODE_DOCS_BASE_URL = 'https://docs.wcpos.com/error-codes';

export function errorCodeDocUrl(code: string): string {
  return `${ERROR_CODE_DOCS_BASE_URL}/${code}`;
}

// v2 copy: auth.finding_your_store, auth.checking_wordpress, auth.checking_woocommerce_pos, auth.saving.
export const CONNECT_STAGE_COPY: Record<ConnectStage, string> = {
  'finding-store': 'Finding your store…',
  'checking-wordpress': 'Checking WordPress…',
  'checking-wcpos': 'Checking WooCommerce POS…',
  saving: 'Saving…',
};

// The WCPOS error code v2 raises for each cause (monorepo
// packages/utils/src/logger/generated/error-codes.generated.ts). v2's URL
// discovery failures carry no code, so unreachable and not_wordpress have none.
const SITE_ERROR_CODES: Record<SiteError['code'], string | null> = {
  invalid_url: 'AUTH411',   // STORE_URL_INVALID
  unreachable: null,
  not_wordpress: null,
  no_wcpos: 'AUTH311',      // REST_ROUTE_MISSING
  wcpos_outdated: 'AUTH331', // WCPOS_PLUGIN_OUTDATED
};

export type StartSignIn = (siteInput: string, onStage: (stage: ConnectStage) => void) => Promise<void>;

export interface ConnectDiscovery {
  stage: ConnectStage | null;   // null when idle or after a failure
  busy: boolean;                // stage !== null
  error: string | null;
  errorCode: string | null;     // e.g. 'AUTH311'; null when the cause has no code
  connect(siteInput: string): Promise<void>;
  reset(): void;                // clears error and errorCode
}

export function useConnectDiscovery(startSignIn: StartSignIn): ConnectDiscovery {
  const [stage, setStage] = useState<ConnectStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const connect = useCallback(async (siteInput: string) => {
    if (stage !== null) return;
    setError(null);
    setErrorCode(null);
    setStage('finding-store');
    try {
      await startSignIn(siteInput, setStage);
    } catch (error) {
      setStage(null);
      if (error instanceof SiteError) {
        setError(error.message);
        setErrorCode(SITE_ERROR_CODES[error.code]);
      } else {
        setError('Could not connect. Try again.');
        setErrorCode(null);
      }
    }
  }, [stage, startSignIn]);
  const reset = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);
  return { stage, busy: stage !== null, error, errorCode, connect, reset };
}
