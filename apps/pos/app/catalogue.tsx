import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Text } from '@tallyui/components';
import { SaleScreen } from '../components/sale-screen';
import { useSession } from '../lib/auth/session-context';
import { useCatalogue } from '../lib/catalogue/catalogue-context';

export default function Catalogue() {
  const { session, ready, signOut } = useSession();
  const { catalogue, products, status, notice, error } = useCatalogue();
  const router = useRouter();
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text>{error ?? `Connecting to ${session.site.name}…`}</Text>
    </View>
  );
  return (
    <SaleScreen
      connector={catalogue.connector}
      currency={catalogue.store.currency}
      products={products}
      storeName={catalogue.store.name}
      cashierName={session.tokens.user.displayName}
      cashierRef={String(session.tokens.user.id)}
      status={status}
      notice={notice}
      onSignOut={() => { signOut(); router.replace('/connect'); }}
    />
  );
}
