import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { bindRegister, ensureRegister, getBoundRegisterId, useRegisterSession, type UseRegisterSessionOptions } from '@tallyui/pos';
import { cashierNameFor, deviceCashiers } from '../auth/cashier-name';
import { useSession } from '../auth/session-context';
import { useOutbox } from '../sale/outbox-context';
import { ordersDatabaseName } from '../sale/order-store';
import { SOFTWARE_VERSION } from '../software';
import { REGISTER_ID } from './register-id';
import { useRegisterSessionsSetting } from './register-setting';

type LiveSaleView = NonNullable<UseRegisterSessionOptions['liveSale']>;
type Register = ReturnType<typeof useRegisterSession> & {
  bindLiveSale: (view: LiveSaleView | null) => void;
  boundRegisterId: string | null;
  registerName: string | null;
  setTenderInProgress: (on: boolean) => void;
  setting: boolean;
  setSetting: (on: boolean) => void;
};
const RegisterContext = createContext<Register | null>(null);

export function RegisterProvider({ children }: { children: ReactNode }) {
  const { session, cashiers } = useSession();
  const outbox = useOutbox();
  const orders = outbox.enabled ? outbox.orders : null;
  const collections = orders?.database.collections;
  const host = collections?.register_sessions ?? null;
  const storeKey = session ? ordersDatabaseName(session) : '';
  const [binding, setBinding] = useState<{ storeKey: string; id: string; name: string } | null>(null);
  const boundRegisterId = host && binding?.storeKey === storeKey ? binding.id : null;
  const registerName = host && binding?.storeKey === storeKey ? binding.name : null;
  const [setting, setSetting] = useRegisterSessionsSetting();
  const [tenderInProgress, setTenderInProgress] = useState(false);
  const liveSale = useRef<LiveSaleView | null>(null);
  const [, setLiveVersion] = useState(0);
  const bindLiveSale = useCallback((view: LiveSaleView | null) => {
    liveSale.current = view;
    setLiveVersion(v => v + 1);
  }, []);

  useEffect(() => {
    if (!host || !storeKey) return;
    let mounted = true;
    void (async () => {
      const doc = await ensureRegister(host, REGISTER_ID);
      const id = getBoundRegisterId(doc, storeKey) ?? doc.id;
      if (getBoundRegisterId(doc, storeKey) === null) {
        await bindRegister(host, storeKey, { id, name: doc.name });
      }
      if (mounted) setBinding({ storeKey, id, name: doc.name });
    })();
    return () => { mounted = false; };
  }, [host, storeKey]);

  const enabled = setting && outbox.enabled && !!boundRegisterId;
  const user = session?.tokens.user;
  const hookResult = useRegisterSession({
    sessions: host, movements: collections?.cash_movements ?? null,
    closures: collections?.closures ?? null, orders, register: host, storeKey,
    drafts: null,
    liveSale: () => liveSale.current?.() ?? { takenLegs: [], saving: false },
    registerId: boundRegisterId, enabled,
    actor: { id: user ? String(user.id) : '', name: user?.displayName ?? '' },
    labels: {
      // The closure's `register_name`: v2 stamps the bound register's name.
      registerName: registerName ?? 'This till',
      resolveCashierName: id => cashierNameFor(deviceCashiers(session, cashiers), id),
    },
    timezone: 'device', softwareVersion: SOFTWARE_VERSION, tenderInProgress,
  });
  return <RegisterContext.Provider value={{ ...hookResult, enabled, boundRegisterId, registerName, bindLiveSale, setTenderInProgress, setting, setSetting }}>{children}</RegisterContext.Provider>;
}

export function useRegister(): Register {
  return useContext(RegisterContext)!;
}
