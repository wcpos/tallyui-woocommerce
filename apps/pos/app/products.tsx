import { Redirect, useRouter } from 'expo-router';
import { CatalogueUnavailable } from '../components/catalogue-unavailable';
import { ProductsScreen } from '../components/products-screen';
import { ProductsTaxBasedOn } from '../components/products-tax-based-on';
import { useSession } from '../lib/auth/session-context';
import { useCatalogue } from '../lib/catalogue/catalogue-context';
import { useTillStoreSettings } from '../lib/sale/use-till-store-settings';

export default function Products() {
  const { session, ready } = useSession();
  const { catalogue, products, error } = useCatalogue();
  const store = useTillStoreSettings(session);
  const router = useRouter();
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return <CatalogueUnavailable message={error ?? `Connecting to ${session.site.name}…`} />;
  return <ProductsScreen products={products} connector={catalogue.connector} currency={catalogue.store.currency} locale={catalogue.store.locale}
    captionStart={store.state === 'ready' ? <ProductsTaxBasedOn settings={store.settings} calcTaxes={catalogue.store.calcTaxes} /> : undefined}
    onBack={() => { router.canGoBack() ? router.back() : router.replace('/catalogue'); }} />;
}
