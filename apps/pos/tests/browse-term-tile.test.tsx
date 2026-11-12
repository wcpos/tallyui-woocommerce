import * as ReactNative from 'react-native';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { BrowseRootGrid } from '../components/browse-terms-view';
import { classesOf } from './classes-of';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const terms = [{ id: 25, name: 'Clothing', count: 160 }, { id: 27, name: 'Collections', count: 13 }, { id: 31, name: 'Decor', count: 1 }];

function renderAt(width: number) {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 844, scale: 1, fontScale: 1 });
  render(<BrowseRootGrid terms={terms} numColumns={4} onOpen={() => {}} />);
}

// v2's Compact step under 640 px (scale.ts): 13 px body type and a 3.5 px spacing unit, so `p-2.5` is 8.75 px.
test('four term tiles across a 390 px phone take v2 Compact name size and inset', () => {
  renderAt(390);
  for (const id of ['browse-all-products', 'browse-term-25']) {
    expect(classesOf(`${id}-name`)).toEqual(expect.arrayContaining(['text-[13px]', 'font-bold', 'leading-tight']));
    expect(classesOf(`${id}-name`)).not.toContain('text-base');
    expect(classesOf(`${id}-words`)).toEqual(expect.arrayContaining(['px-[8.75px]', 'pb-[8.75px]', 'pt-2']));
    expect(classesOf(`${id}-words`)).not.toContain('px-2.5');
  }
});

test('at 1280 px the term tile keeps its name size and inset', () => {
  renderAt(1280);
  expect(classesOf('browse-all-products-name')).toEqual(expect.arrayContaining(['text-base', 'font-bold', 'leading-tight']));
  expect(classesOf('browse-all-products-name')).not.toContain('text-[13px]');
  expect(classesOf('browse-all-products-words')).toEqual(expect.arrayContaining(['px-2.5', 'pb-2.5', 'pt-2']));
  expect(classesOf('browse-all-products-words')).not.toContain('px-[8.75px]');
});

// P13-S2: v2's bare mark on the filled tile is the Icon's `lg`, 20 px, in the tile's ink (mark.tsx:44, icon/index.tsx:30).
test('the All products tile draws its grid glyph at v2\'s 20 px in the primary foreground', () => {
  renderAt(1280);
  const mark = document.querySelector('[data-testid="browse-all-products-mark"]')!;
  expect(mark.getAttribute('width')).toBe('20');
  expect(classesOf('browse-all-products-mark')).toContain('text-primary-foreground');
});
