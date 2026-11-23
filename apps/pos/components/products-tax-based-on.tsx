import type { JSX } from 'react';
import { useRouter, type Href } from 'expo-router';
import type { StoreSettings } from '@tallyui/core';
import { TaxBasedOnCaption } from './tax-based-on-caption';

/** The Products screen's caption: TaxBasedOnCaption on the shop base, with "Change setting" routed to Settings › Tax. */
export function ProductsTaxBasedOn({ settings, calcTaxes }: { settings: StoreSettings; calcTaxes: boolean | undefined }): JSX.Element | null {
  const router = useRouter();
  return <TaxBasedOnCaption settings={settings} calcTaxes={calcTaxes} onChangeSetting={() => router.push('/settings/tax' as Href)} />;
}
