import { Redirect } from 'expo-router';
import { CatalogueUnavailable } from '../../components/catalogue-unavailable';
import { PerformanceScreen } from '../../components/performance-screen';
import { PerformanceSync } from '../../components/performance-sync';
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
    <CatalogueUnavailable message={error ?? `Connecting to ${session.site.name}…`} />
    </>
  );
  // v2 reads the engine's state; here, the pull notice and the catalogue's own status.
  return (
    <>
      <SessionHoldBanner />
      <PerformanceScreen metrics={catalogue.requestMetrics} healthy={!notice && status !== 'error'}>
        <PerformanceSync collection={catalogue.syncCadence} runner={catalogue.cadence} />
      </PerformanceScreen>
    </>
  );
}
