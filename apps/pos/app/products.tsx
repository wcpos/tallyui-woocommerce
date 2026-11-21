import { useMemo } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { createTaxContext, taxProviderProps } from '@tallyui/pos';
import { CatalogueUnavailable } from '../components/catalogue-unavailable';
import { ProductsScreen } from '../components/products-screen';
import { ProductsTaxBasedOn } from '../components/products-tax-based-on';
import { SessionHoldBanner } from '../components/session-hold-banner';
import { useSession } from '../lib/auth/session-context';
import { useCatalogue } from '../lib/catalogue/catalogue-context';
import { useTillStoreSettingsState } from '../lib/sale/store-settings-context';

export default function Products() {
  const { session, ready } = useSession();
  const { catalogue, products, error } = useCatalogue();
  const store = useTillStoreSettingsState();
  const router = useRouter();
  // The till's tax settings (sale-screen.tsx's TaxProvider props) for the Price cell's tax line, gated on calcTaxes as
  // v2's PriceWithTax is (price-with-tax.tsx:43).
  const settings = store.state === 'ready' ? store.settings : undefined;
  const calcTaxes = catalogue?.store.calcTaxes === true;
  const tax = useMemo(() => settings && calcTaxes ? createTaxContext(taxProviderProps(settings)) : undefined, [settings, calcTaxes]);
  if (!ready) return null;
  if (!session) return <Redirect href="/connect" />;
  if (!catalogue) return (
    <>
    <SessionHoldBanner />
    <CatalogueUnavailable message={error ?? `Connecting to ${session.site.name}…`} />
    </>
  );
  return <><SessionHoldBanner /><ProductsScreen products={products} connector={catalogue.connector} currency={catalogue.store.currency} locale={catalogue.store.locale}
    captionStart={store.state === 'ready' ? <ProductsTaxBasedOn settings={store.settings} calcTaxes={catalogue.store.calcTaxes} /> : undefined} tax={tax}
    onBack={() => { router.canGoBack() ? router.back() : router.replace('/catalogue'); }} /></>;
}
