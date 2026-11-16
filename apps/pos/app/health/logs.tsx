import { Redirect } from 'expo-router';
import { CatalogueUnavailable } from '../../components/catalogue-unavailable';
import { LogsScreen } from '../../components/logs-screen';
import { useSession } from '../../lib/auth/session-context';
import { useCatalogue } from '../../lib/catalogue/catalogue-context';
import { IDLE_OUTBOX_STATE, outboxSyncStats } from '../../lib/logs/log-view';
import { useOutbox } from '../../lib/sale/outbox-context';

export default function HealthLogs() {
  const { session, ready } = useSession();
  const { catalogue, error } = useCatalogue();
  const outbox = useOutbox();
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return <CatalogueUnavailable message={error ?? `Connecting to ${session.site.name}…`} />;
  return <LogsScreen collection={catalogue.logs} storeName={catalogue.store.name} siteUrl={session.site.home}
    sync={outboxSyncStats(outbox.enabled ? outbox.state : IDLE_OUTBOX_STATE)} />;
}
