import { useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Text } from '@tallyui/components';
import { SaleScreen } from '../components/sale-screen';
import { StoreSettingsGate } from '../components/store-settings-gate';
import { useTillStoreSettings } from '../lib/sale/use-till-store-settings';
import { useSession } from '../lib/auth/session-context';
import { useCatalogue } from '../lib/catalogue/catalogue-context';
import { customerSource } from '../lib/customers/customer-source';
import { receiptMailer } from '../lib/receipts/receipt-mailer';
import { SessionExpiredError } from '../lib/auth/session';
import { databaseName } from '../lib/catalogue/start-catalogue';

// The localStorage key for a cashier's cart held across a switch.
const HELD_CART_PREFIX = 'tallywoo.held-cart.';

export default function Catalogue() {
  const { session, ready, signOut, cashiers, switchCashier, removeCashier, startAddCashier } = useSession();
  const store = useTillStoreSettings(session);
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
    <StoreSettingsGate store={store}>{(settings) => <SaleScreen
      storeSettings={settings}
      connector={catalogue.connector}
      customers={customers}
      mailer={mailer}
      receiptEmails={catalogue.receiptEmails}
      parkedCarts={catalogue.parkedCarts}
      currency={catalogue.store.currency}
      locale={catalogue.store.locale}
      multiplePayments={catalogue.capabilities?.multiplePayments === true}
      capabilities={catalogue.capabilities}
      cashier={catalogue.cashier}
      products={products}
      storeName={catalogue.store.name}
      cashierName={session.tokens.user.displayName}
      cashierRef={String(session.tokens.user.id)}
      cashiers={cashiers.map(c => ({ uuid: c.tokens.user.uuid, name: c.tokens.user.displayName }))}
      onSwitchCashier={async uuid => {
        const name = cashiers.find(c => c.tokens.user.uuid === uuid)!.tokens.user.displayName;
        try {
          await switchCashier(uuid);
          return null;
        } catch (error) {
          return error instanceof SessionExpiredError
            ? `${name}'s sign-in has expired. Use Another account to sign them in again.`
            : 'Could not switch cashier. Check the connection and try again.';
        }
      }}
      onAddCashier={startAddCashier}
      onRemoveCashier={removeCashier}
      heldCartKey={`${HELD_CART_PREFIX}${databaseName(session)}`}
      status={status}
      notice={notice}
      onSignOut={() => { signOut(); router.replace('/connect'); }}
      onOpenReports={() => router.push('/reports')}
    />}</StoreSettingsGate>
  );
}
