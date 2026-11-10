import { Redirect } from 'expo-router';
import { StoreSettingsGate } from '../../components/store-settings-gate';
import { TaxSettings } from '../../components/settings/tax-settings';
import { useSession } from '../../lib/auth/session-context';
import { useTillStoreSettings } from '../../lib/sale/use-till-store-settings';

export default function TaxSettingsRoute() {
  const { session, ready } = useSession();
  const store = useTillStoreSettings(session);
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  return (
    <StoreSettingsGate store={store}>
      {settings => <TaxSettings settings={settings} siteHome={session.site.home} />}
    </StoreSettingsGate>
  );
}
