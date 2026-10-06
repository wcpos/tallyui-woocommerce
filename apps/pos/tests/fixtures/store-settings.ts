import type { StoreSettings } from '@tallyui/core';

export const noTaxSettings: StoreSettings = {
  currency: 'USD', pricesIncludeTax: false, taxRatesPpm: { default: 0 },
};
