import { Redirect, useRouter } from 'expo-router';
import { CatalogueUnavailable } from '../components/catalogue-unavailable';
import { CouponsScreen } from '../components/coupons-screen';
import { SessionHoldBanner } from '../components/session-hold-banner';
import { useSession } from '../lib/auth/session-context';
import { useCatalogue } from '../lib/catalogue/catalogue-context';

export default function Coupons() {
  const { session, ready } = useSession();
  const { catalogue, error } = useCatalogue();
  const router = useRouter();
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return (
    <>
    <SessionHoldBanner />
    <CatalogueUnavailable message={error ?? `Connecting to ${session.site.name}…`} />
    </>
  );
  return <><SessionHoldBanner /><CouponsScreen coupons={catalogue.coupons} currency={catalogue.store.currency} locale={catalogue.store.locale}
    onBack={() => { router.canGoBack() ? router.back() : router.replace('/catalogue'); }} /></>;
}
