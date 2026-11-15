import { useMemo } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Text } from '@tallyui/components';
import { CustomersScreen } from '../components/customers-screen';
import { createCustomersBlockedReason } from '../lib/auth/capabilities';
import { useSession } from '../lib/auth/session-context';
import { useRequestContext } from '../lib/auth/request-context';
import { useCatalogue } from '../lib/catalogue/catalogue-context';
import { customerSource } from '../lib/customers/customer-source';

export default function Customers() {
  const { session, ready } = useSession();
  const { catalogue, error } = useCatalogue();
  const router = useRouter();
  const connector = catalogue?.connector;
  const context = useRequestContext(connector, session);
  const customers = useMemo(() => connector ? customerSource(connector, context) : null, [connector, context]);
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text>{error ?? `Connecting to ${session.site.name}…`}</Text>
    </View>
  );
  return <CustomersScreen source={customers} onBack={() => { router.canGoBack() ? router.back() : router.replace('/catalogue'); }}
    createBlockedReason={createCustomersBlockedReason(catalogue.cashier, session.site.home)} />;
}
