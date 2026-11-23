import type { StoreSettings } from '@tallyui/core';

// v2 packages/core/src/screens/main/pos/cart/totals/taxes.tsx:24-52; default: @tallyui/components dist/index.js:10374.
export function taxRateLabel(settings: Pick<StoreSettings, 'taxRates'>): (ratePpm: number) => string {
  const labels = new Map<number, Set<string>>();
  for (const rates of Object.values(settings.taxRates ?? {})) {
    for (const rate of rates) {
      const label = rate.label.trim();
      if (!label) continue;
      const ppm = Math.round(Number(rate.rate) * 10_000);
      const names = labels.get(ppm) ?? new Set<string>();
      names.add(label);
      labels.set(ppm, names);
    }
  }
  return ratePpm => {
    const names = labels.get(ratePpm);
    return names?.size === 1 ? [...names][0] : `Tax ${ratePpm / 1e4}%`;
  };
}
