import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { CatalogueUnavailable } from '../../components/catalogue-unavailable';
import { CardReadersSettings, type CardReadersLoad } from '../../components/settings/card-readers-settings';
import { useSession } from '../../lib/auth/session-context';
import { useRequestContext } from '../../lib/auth/request-context';
import { useCatalogue } from '../../lib/catalogue/catalogue-context';
import { useChosenReaders } from '../../lib/card-readers/smart-readers';

export default function CardReadersSettingsRoute() {
  const { session, ready } = useSession();
  const { catalogue, error } = useCatalogue();
  const connector = catalogue?.connector;
  const context = useRequestContext(connector, session);
  const [load, setLoad] = useState<CardReadersLoad>({ status: 'loading' });
  useEffect(() => {
    if (!connector?.paymentMethods) {
      setLoad({ status: 'ready', methods: [] });
      return;
    }
    let cancelled = false;
    setLoad({ status: 'loading' });
    void connector.paymentMethods(context()).then(methods => {
      if (!cancelled) setLoad({ status: 'ready', methods });
    }, error => {
      if (!cancelled) setLoad({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    });
    return () => { cancelled = true; };
  }, [connector, context]);
  const [chosen, choose] = useChosenReaders(session?.site.home);
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return <CatalogueUnavailable message={error ?? `Connecting to ${session.site.name}…`} />;
  return <CardReadersSettings load={load} chosen={chosen} onChoose={choose} />;
}
