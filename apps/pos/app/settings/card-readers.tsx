import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { Text } from '@tallyui/components';
import { CardReadersSettings, type CardReadersLoad } from '../../components/settings/card-readers-settings';
import { useSession } from '../../lib/auth/session-context';
import { useCatalogue } from '../../lib/catalogue/catalogue-context';
import { useChosenReaders } from '../../lib/card-readers/smart-readers';

export default function CardReadersSettingsRoute() {
  const { session, ready } = useSession();
  const { catalogue, error } = useCatalogue();
  const latest = useRef(session);
  latest.current = session;
  const connector = catalogue?.connector;
  const [load, setLoad] = useState<CardReadersLoad>({ status: 'loading' });
  useEffect(() => {
    if (!connector?.paymentMethods) {
      setLoad({ status: 'ready', methods: [] });
      return;
    }
    let cancelled = false;
    setLoad({ status: 'loading' });
    void connector.paymentMethods({
      connectorId: connector.id,
      baseUrl: latest.current!.site.wcposApiUrl,
      headers: connector.auth.getHeaders({ token: latest.current!.tokens.accessToken }),
    }).then(methods => {
      if (!cancelled) setLoad({ status: 'ready', methods });
    }, error => {
      if (!cancelled) setLoad({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    });
    return () => { cancelled = true; };
  }, [connector]);
  const [chosen, choose] = useChosenReaders(session?.site.home);
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text>{error ?? `Connecting to ${session.site.name}…`}</Text>
    </View>
  );
  return <CardReadersSettings load={load} chosen={chosen} onChoose={choose} />;
}
