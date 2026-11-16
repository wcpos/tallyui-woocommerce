import { useMemo } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { CatalogueUnavailable } from '../components/catalogue-unavailable';
import { OrdersScreen } from '../components/orders-screen';
import { SessionHoldBanner } from '../components/session-hold-banner';
import { useSession } from '../lib/auth/session-context';
import { useRequestContext } from '../lib/auth/request-context';
import { useCatalogue } from '../lib/catalogue/catalogue-context';
import { orderHistorySource } from '../lib/orders/order-history';
import { customerSource } from '../lib/customers/customer-source';

export default function Orders() {
  const { session, ready } = useSession();
  const { catalogue, error } = useCatalogue();
  const router = useRouter();
  const connector = catalogue?.connector;
  const context = useRequestContext(connector, session);
  const history = useMemo(() => connector ? orderHistorySource(connector, context) : null, [connector, context]);
  const customers = useMemo(() => connector ? customerSource(connector, context) : null, [connector, context]);
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return (
    <>
    <SessionHoldBanner />
    <CatalogueUnavailable message={error ?? `Connecting to ${session.site.name}…`} />
    </>
  );
  return <><SessionHoldBanner /><OrdersScreen onBack={() => { router.canGoBack() ? router.back() : router.replace('/catalogue'); }}
    onReview={() => router.push('/health/database')}
    history={history} storeName={catalogue.store.name} cashierName={session.tokens.user.displayName} cashierId={String(session.tokens.user.id)}
    onCustomerSearch={customers ? text => customers.search(text).then(found => found.map(({ id, name }) => ({ id, name }))) : undefined} /></>;
}
