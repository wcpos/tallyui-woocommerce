import * as ReactNative from 'react-native';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { CatalogueView } from '../components/catalogue-view';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { classesOf } from './classes-of';

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

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

// v2's Compact step under 640 px (lib/catalogue/tile-scale.ts): a 13 px name and an 8.75 px words inset.
test.each([
  [390, ['text-[13px]', 'font-bold', 'leading-tight'], ['px-[8.75px]', 'pb-[8.75px]'], ['text-base', 'px-2.5']],
  [1280, ['text-base', 'font-bold', 'leading-tight'], ['px-2.5', 'pb-2.5'], ['text-[13px]', 'px-[8.75px]']],
])('at %i px the product tile name and words take that step', (width, name, inset, absent) => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 844, scale: 1, fontScale: 1 });
  render(<CatalogueView connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
    storeName={stores[0].name} cashierName="Paul" status="ready" onSignOut={() => {}} />);
  expect(classesOf('tile-name-80')).toEqual(expect.arrayContaining(name));
  expect(classesOf('tile-scrim-80')).toEqual(expect.arrayContaining(inset));
  expect(classesOf('tile-name-80')).not.toContain(absent[0]);
  expect(classesOf('tile-scrim-80')).not.toContain(absent[1]);
});
