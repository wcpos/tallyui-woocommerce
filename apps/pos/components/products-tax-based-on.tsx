import { useMemo, useState, type JSX } from 'react';
import { useRouter, type Href } from 'expo-router';
import { TaxBasedOn } from '@tallyui/components';
import { woocommerceTax, type StoreSettings } from '@tallyui/core';
import { taxDerivation } from '@tallyui/pos';
import { TaxRatesDialog } from './settings/tax-rates-dialog';

const NO_ADDRESS = { country: '', state: '', city: '', postcode: '' };

/** v2's Products TableFooter caption (products.tsx:270-276, gated on calcTaxes at :443): with no order the address is
 *  always the shop base (tax-based-on/index.tsx:19-21), as saleTaxContexts resolves it for no customer. */
export function ProductsTaxBasedOn({ settings, calcTaxes }: { settings: StoreSettings; calcTaxes: boolean | undefined }): JSX.Element | null {
  const router = useRouter();
  const [rates, setRates] = useState(false);
  const derivation = useMemo(() => taxDerivation(settings, {
    ...woocommerceTax.orderTaxLocation(settings.baseTaxAddress ?? NO_ADDRESS, settings.taxBasedOn), hasCustomer: false,
  }), [settings]);
  if (calcTaxes !== true) return null;
  return (
    <>
      <TaxBasedOn derivation={derivation} onChangeSetting={() => router.push('/settings/tax' as Href)} onViewAllRates={() => setRates(true)} />
      {rates && <TaxRatesDialog rates={settings.allTaxRates} taxClassSlugs={settings.taxClassSlugs} onClose={() => setRates(false)} />}
    </>
  );
}
