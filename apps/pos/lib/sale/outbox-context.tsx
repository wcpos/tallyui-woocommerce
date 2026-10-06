import { createContext, useContext, useMemo, useRef } from 'react';
import type { JSX, ReactNode } from 'react';
import type { RxStorage } from 'rxdb';
import type { OrderCreateEnvelope } from '@tallyui/core';
import { getDeviceId, useOrderOutbox } from '@tallyui/pos';
import type { CommandTransport } from '@tallyui/pos';
import type { Session } from '../auth/session';
import { useSession } from '../auth/session-context';
import { openOrderStore, ordersDatabaseName } from './order-store';
import { orderTransport } from './order-transport';

// The key this device's id is kept under in web storage, sent on every order command (getDeviceId)
const DEVICE_ID_KEY = 'tallywoo.device_id';

type Outbox = (ReturnType<typeof useOrderOutbox> & { enabled: true }) | { enabled: false };
const OutboxContext = createContext<Outbox>({ enabled: false });

export function OutboxProvider({ children, transportFor, storage }: {
  children: ReactNode;
  transportFor?: (session: Session) => CommandTransport<OrderCreateEnvelope> | null;
  storage?: RxStorage<any, any>;
}): JSX.Element {
  const { session } = useSession();
  const latest = useRef(session);
  latest.current = session;
  const storeKey = session ? ordersDatabaseName(session) : null;
  const transport = useMemo(() => {
    const createTransport = transportFor ?? (s => orderTransport(s, () => latest.current?.tokens.accessToken ?? ''));
    return session ? createTransport(session) : null;
  }, [storeKey]);
  const outbox = useOrderOutbox({
    storeKey: transport ? storeKey : null,
    open: name => openOrderStore(name, storage),
    transport: () => transport!,
    deviceId: transport ? getDeviceId(typeof localStorage === 'undefined' ? null : localStorage, DEVICE_ID_KEY) : '',
  });
  return <OutboxContext.Provider value={transport ? { ...outbox, enabled: true } : { enabled: false }}>{children}</OutboxContext.Provider>;
}

export function useOutbox(): Outbox {
  return useContext(OutboxContext);
}
