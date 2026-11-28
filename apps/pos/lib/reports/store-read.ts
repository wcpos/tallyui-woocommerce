import { useMemo, useRef } from 'react';
import type { SyncContext, TallyConnector } from '@tallyui/core';
import type { PosOrder, StoreOrdersInRange } from '@tallyui/pos';
import type { Session } from '../auth/session';
import { mergeRoomOrders, type RoomOrder } from './room-orders';

export type ReportScope = 'store' | 'till';

/**
 * useStoreOrdersInRange restarts its read at page 1 for a new context object, so the object
 * changes only with the connector or the site, and the token is read when each request is made.
 */
export function useReportContext(connector: TallyConnector | undefined, session: Session | null): SyncContext | null {
  const latest = useRef(session);
  latest.current = session;
  const url = session?.site.wcposApiUrl;
  return useMemo(() => {
    if (!connector || !url) return null;
    return { connectorId: connector.id, baseUrl: url,
      get headers() {
        return { ...connector.auth.getHeaders({ token: latest.current?.tokens.accessToken ?? '' }) };
      },
    };
  }, [connector, url]);
}

export type StoreRoom = { orders: RoomOrder[] | null; line: string | null };

/**
 * The figures count the store's orders only when the whole read landed (reports-plan §4 Fallback);
 * until then, or when any order could not be read, the till's own figures stand.
 */
export function storeRoom(read: StoreOrdersInRange, local: readonly PosOrder[], replaced?: ReadonlySet<string>): StoreRoom {
  if (read.complete && read.error === null && read.unreadable === 0) {
    return { orders: mergeRoomOrders(read.orders, local, 'done', replaced), line: null };
  }
  if (read.progress) {
    const { downloaded, total } = read.progress;
    return { orders: null, line: 'Reading store orders ' + downloaded + (total === null ? '' : ' of ' + total) };
  }
  return { orders: null, line: "Store unreachable: this till's sales only" };
}
