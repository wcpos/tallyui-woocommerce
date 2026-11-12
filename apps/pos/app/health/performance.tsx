import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { Text } from '@tallyui/components';
import { PerformanceScreen } from '../../components/performance-screen';
import { SessionHoldBanner } from '../../components/session-hold-banner';
import { useSession } from '../../lib/auth/session-context';
import { useCatalogue } from '../../lib/catalogue/catalogue-context';

export default function HealthPerformance() {
  const { session, ready } = useSession();
  const { catalogue, error, notice, status } = useCatalogue();
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return (
    <>
    <SessionHoldBanner />
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text>{error ?? `Connecting to ${session.site.name}…`}</Text>
    </View>
    </>
  );
  // v2 reads the engine's state; here, the pull notice and the catalogue's own status.
  return <><SessionHoldBanner /><PerformanceScreen metrics={catalogue.requestMetrics} healthy={!notice && status !== 'error'} /></>;
}
