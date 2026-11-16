import { useMemo } from 'react';
import { Redirect } from 'expo-router';
import { CatalogueUnavailable } from '../../components/catalogue-unavailable';
import { GeneralSettings } from '../../components/settings/general-settings';
import { createCustomersBlockedReason } from '../../lib/auth/capabilities';
import { useSession } from '../../lib/auth/session-context';
import { useRequestContext } from '../../lib/auth/request-context';
import { useCatalogue } from '../../lib/catalogue/catalogue-context';
import { customerSource } from '../../lib/customers/customer-source';
import { useDefaultCustomer, useDefaultCustomerSetting } from '../../lib/customers/default-customer';

export default function GeneralSettingsRoute() {
  const { session, ready } = useSession();
  const { catalogue, error } = useCatalogue();
  const connector = catalogue?.connector;
  const context = useRequestContext(connector, session);
  const customers = useMemo(() => connector ? customerSource(connector, context) : null, [connector, context]);
  const [setting, save] = useDefaultCustomerSetting(session?.site.home, catalogue?.store);
  // The chosen customer's name for the select, whether or not "is cashier" is on.
  const chosen = useDefaultCustomer(setting && { customerId: setting.customerId, isCashier: false },
    session?.tokens.user, customers?.get);
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue || !setting) return <CatalogueUnavailable message={error ?? `Connecting to ${session.site.name}…`} />;
  return <GeneralSettings store={catalogue.store} siteHome={session.site.home} defaultCustomer={{
    setting, customer: chosen, source: customers, onChange: save,
    createBlockedReason: createCustomersBlockedReason(catalogue.cashier, session.site.home),
  }} />;
}
