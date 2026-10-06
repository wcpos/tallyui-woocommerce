import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Text } from '@tallyui/components';
import { ReportsScreen } from '../components/reports-screen';
import { useSession } from '../lib/auth/session-context';
import { useCatalogue } from '../lib/catalogue/catalogue-context';

export default function Reports() {
  const { session, ready } = useSession();
  const { catalogue, error } = useCatalogue();
  const router = useRouter();
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text>{error ?? `Connecting to ${session.site.name}…`}</Text>
    </View>
  );
  return <ReportsScreen storeName={catalogue.store.name} currency={catalogue.store.currency} locale={catalogue.store.locale}
    onBack={() => { router.canGoBack() ? router.back() : router.replace('/catalogue'); }} />;
}
