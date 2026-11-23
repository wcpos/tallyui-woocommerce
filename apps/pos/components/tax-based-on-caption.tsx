import { useMemo, useState, type JSX } from 'react';
import { TaxBasedOn } from '@tallyui/components';
import { woocommerceTax, type StoreSettings } from '@tallyui/core';
import { taxDerivation, type SaleTaxLocation } from '@tallyui/pos';
import { TaxRatesDialog } from './settings/tax-rates-dialog';

const NO_ADDRESS = { country: '', state: '', city: '', postcode: '' };

/** v2's Products TableFooter caption (products.tsx:270-276, gated on calcTaxes at :443): with no order the address is
 *  always the shop base (tax-based-on/index.tsx:19-21), as saleTaxContexts resolves it for no customer. Router-free:
 *  the caller passes the navigation in, so the till's SaleScreen can render it without expo-router. */
export function TaxBasedOnCaption({ settings, calcTaxes, location, onChangeSetting }: {
  settings: StoreSettings; calcTaxes: boolean | undefined;
  /** The till's sale (`useSale().taxLocation`, v2 pos/products/footer.tsx:53): the panel derives from its address; without it, the shop base. */
  location?: SaleTaxLocation;
  /** "Change setting": opens Settings › Tax. */
  onChangeSetting: () => void;
}): JSX.Element | null {
  const [rates, setRates] = useState(false);
  const derivation = useMemo(() => taxDerivation(settings, location ?? {
    ...woocommerceTax.orderTaxLocation(settings.baseTaxAddress ?? NO_ADDRESS, settings.taxBasedOn), hasCustomer: false,
  }), [settings, location]);
  if (calcTaxes !== true) return null;
  return (
    <>
      <TaxBasedOn derivation={derivation} onChangeSetting={onChangeSetting} onViewAllRates={() => setRates(true)} />
      {/* v2 display-current-tax-rates.tsx:92-106: View all sends the address the panel used (none when it had none). */}
      {rates && <TaxRatesDialog rates={settings.allTaxRates} taxClassSlugs={settings.taxClassSlugs} onClose={() => setRates(false)}
        address={derivation.failure === 'address' ? undefined : derivation.location} rateTable={settings.taxRateTable} />}
    </>
  );
}
