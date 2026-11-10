import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { SessionExpiredError } from '../auth/session';
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
  const { session, hold, ready } = useSession();
  const [value, setValue] = useState<CatalogueContextValue>({ catalogue: null, products: [], status: 'idle' });
  const latestSession = useRef(session);
  const latestHold = useRef(hold);
  const active = useRef<{ catalogue: Catalogue; token: string } | null>(null);
  latestSession.current = session;
  latestHold.current = hold;
  const home = session?.site.home;
  const userId = session?.tokens.user.id;
  const token = session?.tokens.accessToken;

  useEffect(() => {
    const initialSession = latestSession.current;
    // Start only after the first refresh settles, so a start never runs on a token that refresh is replacing.
    if (!initialSession || !ready) {
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
        // The store refused this sign-in at start (v2 holds the session on any 401): hold it so the banner offers Log in.
        if (!disposed && error instanceof SessionExpiredError) {
          latestHold.current(initialSession.tokens.accessToken);
          setValue(previous => ({ ...previous, status: 'error', error: 'The store did not accept this sign-in. Log in again to load the catalogue.' }));
          return;
        }
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
  }, [home, userId, ready]);

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
