import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useSession } from '../auth/session-context';
import { storageStartMessage } from '../storage-start-failure';
import { startCatalogue } from './start-catalogue';
import type { Catalogue } from './start-catalogue';

interface CatalogueContextValue {
  catalogue: Catalogue | null;
  products: any[];
  status: 'idle' | 'starting' | 'syncing' | 'ready' | 'error';
  notice?: { code: string; message?: string };
  error?: string;
}

const CatalogueContext = createContext<CatalogueContextValue>({ catalogue: null, products: [], status: 'idle' });

export function CatalogueProvider({ children }: { children: ReactNode }): JSX.Element {
  const { session } = useSession();
  const [value, setValue] = useState<CatalogueContextValue>({ catalogue: null, products: [], status: 'idle' });
  const latestSession = useRef(session);
  const active = useRef<{ catalogue: Catalogue; token: string } | null>(null);
  latestSession.current = session;
  const home = session?.site.home;
  const userId = session?.tokens.user.id;
  const token = session?.tokens.accessToken;

  useEffect(() => {
    const initialSession = latestSession.current;
    if (!initialSession) {
      setValue({ catalogue: null, products: [], status: 'idle' });
      return;
    }
    let disposed = false;
    let catalogue: Catalogue | undefined;
    const subscriptions: { unsubscribe(): void }[] = [];
    setValue({ catalogue: null, products: [], status: 'starting' });
    void (async () => {
      try {
        const started = await startCatalogue(initialSession);
        if (disposed) { await started.stop(); return; }
        catalogue = started;
        active.current = { catalogue: started, token: initialSession.tokens.accessToken };
        setValue({ catalogue: started, products: [], status: 'syncing' });
        // The WooCommerce schema does not index name, so sort the plain documents here.
        subscriptions.push(started.db.products.find({ selector: {} }).$.subscribe(docs => {
          const products = docs.map(doc => doc.toJSON()).sort((a, b) => a.name.localeCompare(b.name));
          setValue(previous => ({ ...previous, products }));
        }));
        subscriptions.push(started.replication.notice$.subscribe(notice => {
          setValue(previous => ({ ...previous, notice }));
        }));
        await started.replication.awaitInitialReplication();
        if (!disposed) setValue(previous => ({ ...previous, status: 'ready' }));
      } catch (error) {
        if (!disposed) setValue(previous => ({
          ...previous, status: 'error', error: storageStartMessage(error) ?? (error instanceof Error ? error.message : String(error)),
        }));
      }
    })();
    return () => {
      disposed = true;
      subscriptions.forEach(subscription => subscription.unsubscribe());
      active.current = null;
      if (catalogue) void catalogue.stop();
    };
  }, [home, userId]);

  useEffect(() => {
    if (active.current && active.current.catalogue === value.catalogue && token && active.current.token !== token) {
      active.current.token = token;
      active.current.catalogue.setAccessToken(token);
    }
  }, [value.catalogue, token]);

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

export function useCatalogue(): CatalogueContextValue {
  return useContext(CatalogueContext);
}
