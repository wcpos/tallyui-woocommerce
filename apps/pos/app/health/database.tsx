import { Redirect } from 'expo-router';
import { CatalogueUnavailable } from '../../components/catalogue-unavailable';
import { HealthScreen } from '../../components/health-screen';
import { useSession } from '../../lib/auth/session-context';
import { useCatalogue } from '../../lib/catalogue/catalogue-context';

export default function HealthDatabase() {
  const { session, ready } = useSession();
  const { catalogue, error } = useCatalogue();
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return (
    <CatalogueUnavailable message={error ?? `Connecting to ${session.site.name}…`} />
  );
  return <HealthScreen receiptEmails={catalogue.receiptEmails} runner={catalogue.cadence}
    collections={[
      { key: 'products', label: 'Products', collection: catalogue.db.products, onSyncNow: () => catalogue.replication.resume() },
      { key: 'coupons', label: 'Coupons', collection: catalogue.coupons, onSyncNow: () => catalogue.couponReplication.resume() },
      { key: 'parked', label: 'Parked sales', collection: catalogue.parkedCarts },
    ]} />;
}
