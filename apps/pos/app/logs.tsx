import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Text } from '@tallyui/components';
import { LogsScreen } from '../components/logs-screen';
import { useSession } from '../lib/auth/session-context';
import { useCatalogue } from '../lib/catalogue/catalogue-context';
import { useOutbox } from '../lib/sale/outbox-context';

export default function Logs() {
  const { session, ready } = useSession();
  const { catalogue, error } = useCatalogue();
  const router = useRouter();
  const outbox = useOutbox();
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text>{error ?? `Connecting to ${session.site.name}…`}</Text>
    </View>
  );
  return <LogsScreen collection={catalogue.logs} storeName={catalogue.store.name} siteUrl={session.site.home}
    waiting={outbox.enabled ? outbox.state.pending : 0}
    onBack={() => (router.canGoBack() ? router.back() : router.replace('/health'))} />;
}
