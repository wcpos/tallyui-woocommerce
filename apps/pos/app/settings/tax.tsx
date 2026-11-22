import { Redirect } from 'expo-router';
import { StoreSettingsGate } from '../../components/store-settings-gate';
import { TaxSettings } from '../../components/settings/tax-settings';
import { useSession } from '../../lib/auth/session-context';
import { useCatalogue } from '../../lib/catalogue/catalogue-context';
import { useTillStoreSettingsState } from '../../lib/sale/store-settings-context';

export default function TaxSettingsRoute() {
  const { session, ready } = useSession();
  const store = useTillStoreSettingsState();
  // The basis and Enable Taxes come from /stores with the catalogue; they read the dash until it is up.
  const { catalogue } = useCatalogue();
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  return (
    <StoreSettingsGate store={store}>
      {settings => <TaxSettings settings={settings} store={catalogue?.store} siteHome={session.site.home} />}
    </StoreSettingsGate>
  );
}
