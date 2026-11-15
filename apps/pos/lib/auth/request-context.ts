import { useMemo, useRef } from 'react';
import type { SyncContext, TallyConnector } from '@tallyui/core';
import type { Session } from './session';

/**
 * A route's live request context. The token and site are read when a request is made, not when the route rendered,
 * so a refreshed or switched session is used at once; the function changes only with the connector.
 */
export function useRequestContext(connector: TallyConnector | undefined, session: Session | null): () => SyncContext {
  const latest = useRef(session);
  latest.current = session;
  return useMemo(() => () => ({
    connectorId: connector!.id,
    baseUrl: latest.current!.site.wcposApiUrl,
    headers: connector!.auth.getHeaders({ token: latest.current!.tokens.accessToken }),
  }), [connector]);
}
