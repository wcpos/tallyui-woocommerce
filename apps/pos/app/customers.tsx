import { useMemo } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { CatalogueUnavailable } from '../components/catalogue-unavailable';
import { CustomersScreen } from '../components/customers-screen';
import { SessionHoldBanner } from '../components/session-hold-banner';
import { createCustomersBlockedReason, deriveUserCapabilities } from '../lib/auth/capabilities';
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
    <>
    <SessionHoldBanner />
    <CatalogueUnavailable message={error ?? `Connecting to ${session.site.name}…`} />
    </>
  );
  return <><SessionHoldBanner /><CustomersScreen source={customers} onBack={() => { router.canGoBack() ? router.back() : router.replace('/catalogue'); }}
    canEditCustomers={deriveUserCapabilities(catalogue.cashier).canEditCustomers} defaultCountry={catalogue.store.address?.country}
    createBlockedReason={createCustomersBlockedReason(catalogue.cashier, session.site.home)} /></>;
}
