import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { bindRegister, ensureRegister, getBoundRegisterId, useRegisterSession } from '@tallyui/pos';
import { useSession } from '../auth/session-context';
import { useOutbox } from '../sale/outbox-context';
import { ordersDatabaseName } from '../sale/order-store';
import { useRegisterSessionsSetting } from './register-setting';

// apps/pos/package.json version, stamped on local closures.
const SOFTWARE_VERSION = '0.1.0';
type Register = ReturnType<typeof useRegisterSession> & {
  boundRegisterId: string | null;
  setTenderInProgress: (on: boolean) => void;
  setting: boolean;
  setSetting: (on: boolean) => void;
};
const RegisterContext = createContext<Register | null>(null);

export function RegisterProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const outbox = useOutbox();
  const orders = outbox.enabled ? outbox.orders : null;
  const collections = orders?.database.collections;
  const host = collections?.register_sessions ?? null;
  const storeKey = session ? ordersDatabaseName(session) : '';
  const [binding, setBinding] = useState<{ storeKey: string; id: string } | null>(null);
  const boundRegisterId = host && binding?.storeKey === storeKey ? binding.id : null;
  const [setting, setSetting] = useRegisterSessionsSetting();
  const [tenderInProgress, setTenderInProgress] = useState(false);

  useEffect(() => {
    if (!host || !storeKey) return;
    let mounted = true;
    void (async () => {
      const doc = await ensureRegister(host, 'web');
      const id = getBoundRegisterId(doc, storeKey) ?? doc.id;
      if (getBoundRegisterId(doc, storeKey) === null) {
        await bindRegister(host, storeKey, { id, name: doc.name });
      }
      if (mounted) setBinding({ storeKey, id });
    })();
    return () => { mounted = false; };
  }, [host, storeKey]);

  const enabled = setting && outbox.enabled && !!boundRegisterId;
  const user = session?.tokens.user;
  const hookResult = useRegisterSession({
    sessions: host, movements: collections?.cash_movements ?? null,
    closures: collections?.closures ?? null, orders, register: host, storeKey,
    registerId: boundRegisterId, enabled,
    actor: { id: user ? String(user.id) : '', name: user?.displayName ?? '' },
    labels: {
      registerName: 'This till',
      resolveCashierName: id => user && id === String(user.id) ? user.displayName : id,
    },
    timezone: 'device', softwareVersion: SOFTWARE_VERSION, tenderInProgress,
  });
  return <RegisterContext.Provider value={{ ...hookResult, enabled, boundRegisterId, setTenderInProgress, setting, setSetting }}>{children}</RegisterContext.Provider>;
}

export function useRegister(): Register {
  return useContext(RegisterContext)!;
}
