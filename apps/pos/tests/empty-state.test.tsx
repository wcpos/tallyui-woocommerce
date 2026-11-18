import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { EmptyState } from '../components/empty-state';
import { classesOf } from './classes-of';

afterEach(cleanup);

// v2's EmptyState (packages/components/src/empty-state/index.tsx:23-27, :54, :62): the root carries its kind, and
// above the title the kind's glyph at `3xl` (32px) in muted ink: `empty` → info, `no-results` → search.
const glyph = () => screen.getByTestId('no-data-message-glyph');
const kindOf = () => screen.getByTestId('no-data-message').getAttribute('data-kind');
const above = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

function expectGlyph(name: string) {
  expect(glyph().getAttribute('data-glyph')).toBe(name);
  expect([glyph().getAttribute('width'), glyph().getAttribute('height')]).toEqual(['32', '32']);
  expect(classesOf('no-data-message-glyph')).toContain('text-muted-foreground');
  expect(above(glyph(), screen.getByTestId('no-data-message-title'))).toBe(true);
}

test("empty draws v2's info glyph above the title", () => {
  render(<EmptyState kind="empty" title="No orders yet" description="Sales you take will appear here." />);
  expect(kindOf()).toBe('empty');
  expectGlyph('info');
  // lucide `info`: the circle r=10 with its stem and dot.
  expect(glyph().querySelector('circle')?.getAttribute('r')).toBe('10');
  expect([...glyph().querySelectorAll('path')].map(path => path.getAttribute('d'))).toEqual(['M12 16v-4', 'M12 8h.01']);
});

test("no-results draws v2's search glyph above the title", () => {
  render(<EmptyState kind="no-results" title="No orders match these filters" action={{ label: 'Clear filters', onPress: () => {} }} />);
  expect(kindOf()).toBe('no-results');
  expectGlyph('search');
  // TallyUI's SearchIcon: the lens r=7 and its handle; no info stem.
  expect(glyph().querySelector('circle')?.getAttribute('r')).toBe('7');
  expect(glyph().querySelector('line')).not.toBeNull();
  expect(glyph().querySelector('path')).toBeNull();
});

test('inline draws no glyph, as v2 (empty-state/index.tsx:62)', () => {
  render(<EmptyState kind="empty" size="inline" title="No logs found" />);
  expect(kindOf()).toBe('empty');
  expect(screen.queryByTestId('no-data-message-glyph')).toBeNull();
  expect(screen.getByTestId('no-data-message-title').textContent).toBe('No logs found');
});
