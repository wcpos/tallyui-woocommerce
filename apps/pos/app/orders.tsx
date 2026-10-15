import { useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Text } from '@tallyui/components';
import { OrdersScreen } from '../components/orders-screen';
import { useSession } from '../lib/auth/session-context';
import { useCatalogue } from '../lib/catalogue/catalogue-context';
import { orderHistorySource } from '../lib/orders/order-history';

export default function Orders() {
  const { session, ready } = useSession();
  const { catalogue, error } = useCatalogue();
  const router = useRouter();
  const latest = useRef(session);
  latest.current = session;
  const connector = catalogue?.connector;
  const history = useMemo(() => connector ? orderHistorySource(connector, () => ({
    connectorId: connector.id,
    baseUrl: latest.current!.site.wcposApiUrl,
    headers: connector.auth.getHeaders({ token: latest.current!.tokens.accessToken }),
  })) : null, [connector]);
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text>{error ?? `Connecting to ${session.site.name}…`}</Text>
    </View>
  );
  return <OrdersScreen onBack={() => { router.canGoBack() ? router.back() : router.replace('/catalogue'); }}
    history={history} storeName={catalogue.store.name} cashierName={session.tokens.user.displayName} />;
}
