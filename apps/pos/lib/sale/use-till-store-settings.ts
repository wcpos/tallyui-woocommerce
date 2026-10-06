import { useMemo, useRef } from 'react';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { SyncContext } from '@tallyui/core';
import { useStoreSettings, type StoreSettingsState } from '@tallyui/pos';
import type { Session } from '../auth/session';

export function useTillStoreSettings(session: Session | null): StoreSettingsState {
  const latest = useRef(session);
  latest.current = session;
  const url = session?.site.wcposApiUrl;
  const connector = useMemo(() => createWooCommerceConnector(), [url]);
  const context = useMemo<SyncContext>(() => ({
    connectorId: connector.id,
    baseUrl: url ?? '',
    get headers() {
      return { ...connector.auth.getHeaders({ token: latest.current?.tokens.accessToken ?? '' }) };
    },
  }), [connector, url]);
  return useStoreSettings({ connector, context, loadChoice: () => undefined, saveChoice: () => {} });
}
