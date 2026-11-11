import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { CatalogueView } from '../components/catalogue-view';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('the web scrim blurs the picture under the words through v2\'s fade-shaped mask', () => {
  render(<CatalogueView connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
    storeName={stores[0].name} cashierName="Paul" status="ready" onSignOut={() => {}} />);
  // v2's poster-scrim-blur: the blur and its mask sit on a child, so the scrim's own fade is never masked.
  expect((screen.getByTestId('tile-scrim-80').style as unknown as Record<string, string>).maskImage).toBe('');
  const blur = screen.getByTestId('tile-scrim-blur-80');
  expect(blur.parentElement).toBe(screen.getByTestId('tile-scrim-80'));
  const style = blur.style as unknown as Record<string, string>;
  expect(style.backdropFilter).toBe('blur(6px)');
  // jsdom parses the CSS: it drops `to bottom` (the default) and writes `rgb(0 0 0 / a)` as rgba.
  // Transparent at the top, opaque from the reach (48 px) down: the fade's stops as alpha.
  expect(style.maskImage).toMatch(/^linear-gradient\(rgba\(0, 0, 0, 0\) 0px, .*, rgb\(0, 0, 0\) 48px, rgb\(0, 0, 0\) 100%\)$/);
});
