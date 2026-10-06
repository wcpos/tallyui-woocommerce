import { useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Text } from '@tallyui/components';
import { SaleScreen } from '../components/sale-screen';
import { useSession } from '../lib/auth/session-context';
import { useCatalogue } from '../lib/catalogue/catalogue-context';
import { customerSource } from '../lib/customers/customer-source';
import { receiptMailer } from '../lib/receipts/receipt-mailer';

export default function Catalogue() {
  const { session, ready, signOut } = useSession();
  const { catalogue, products, status, notice, error } = useCatalogue();
  const router = useRouter();
  const latest = useRef(session);
  latest.current = session;
  const connector = catalogue?.connector;
  const customers = useMemo(() => connector ? customerSource(connector, () => ({
    connectorId: connector.id,
    baseUrl: latest.current!.site.wcposApiUrl,
    headers: connector.auth.getHeaders({ token: latest.current!.tokens.accessToken }),
  })) : null, [connector]);
  const mailer = useMemo(() => connector ? receiptMailer(connector, () => ({
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
  return (
    <SaleScreen
      connector={catalogue.connector}
      customers={customers}
      mailer={mailer}
      receiptEmails={catalogue.receiptEmails}
      parkedCarts={catalogue.parkedCarts}
      currency={catalogue.store.currency}
      locale={catalogue.store.locale}
      chargesTax={catalogue.store.chargesTax}
      products={products}
      storeName={catalogue.store.name}
      cashierName={session.tokens.user.displayName}
      cashierRef={String(session.tokens.user.id)}
      status={status}
      notice={notice}
      onSignOut={() => { signOut(); router.replace('/connect'); }}
      onOpenReports={() => router.push('/reports')}
    />
  );
}
