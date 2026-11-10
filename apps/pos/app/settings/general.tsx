import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { Text } from '@tallyui/components';
import { GeneralSettings } from '../../components/settings/general-settings';
import { useSession } from '../../lib/auth/session-context';
import { useCatalogue } from '../../lib/catalogue/catalogue-context';

export default function GeneralSettingsRoute() {
  const { session, ready } = useSession();
  const { catalogue, error } = useCatalogue();
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text>{error ?? `Connecting to ${session.site.name}…`}</Text>
    </View>
  );
  return <GeneralSettings store={catalogue.store} siteHome={session.site.home} />;
}
