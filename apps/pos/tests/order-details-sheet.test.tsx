import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { ORDER_NOTE_MAX } from '@tallyui/core';
import { PortalHost } from '@tallyui/primitives';
import { CART_SHEET } from '../components/cart-settings';
import { OrderDetailsSheet } from '../components/order-details-sheet';
import { classesOf } from './classes-of';
import { memoryStorage } from './memory-storage';

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const phone = () => vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
const wide = () => vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
const openSheet = (onVoid?: () => void) =>
  render(<><OrderDetailsSheet open side="left" note="" onOpenChange={vi.fn()} onNoteChange={vi.fn()} onVoid={onVoid} /><PortalHost /></>);
// The props the sheet gave the outermost component that took the testID (react-native-web drops what it does not know).
function propsOf(testID: string): Record<string, unknown> {
  const node = screen.getByTestId(testID) as unknown as Record<string, unknown>;
  type Fiber = { memoizedProps?: Record<string, unknown>; return?: Fiber };
  let fiber = node[Object.keys(node).find(key => key.startsWith('__reactFiber$'))!] as Fiber | undefined;
  let props: Record<string, unknown> = {};
  for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.testID === testID) props = fiber.memoizedProps;
  return props;
}

test('closed renders nothing; open shows the title and the supplied customer note', () => {
  const props = { side: 'left' as const, note: 'Ring the bell', onOpenChange: vi.fn(), onNoteChange: vi.fn() };
  const view = render(<><OrderDetailsSheet {...props} open={false} /><PortalHost /></>);
  expect(view.container.innerHTML).toBe('');
  view.rerender(<><OrderDetailsSheet {...props} open /><PortalHost /></>);
  expect(screen.getByTestId('order-details-title').textContent).toBe('Order details');
  const field = screen.getByLabelText('Customer Note') as HTMLTextAreaElement;
  expect(field).toBe(screen.getByPlaceholderText('Add Customer Note'));
  expect(field).toBe(screen.getByTestId('order-details-note'));
  expect(field.tagName).toBe('TEXTAREA');
  expect(field.value).toBe('Ring the bell');
  expect(field.maxLength).toBe(ORDER_NOTE_MAX);
});

test('typing saves the new note', () => {
  const onNoteChange = vi.fn();
  render(<><OrderDetailsSheet open side="left" note="" onOpenChange={vi.fn()} onNoteChange={onNoteChange} /><PortalHost /></>);
  fireEvent.change(screen.getByLabelText('Customer Note'), { target: { value: 'Leave at the door' } });
  expect(onNoteChange).toHaveBeenCalledExactlyOnceWith('Leave at the door');
});

test('Void closes the sheet before calling onVoid once', () => {
  const onOpenChange = vi.fn();
  const onVoid = vi.fn();
  render(<><OrderDetailsSheet open side="left" note="" onOpenChange={onOpenChange} onNoteChange={vi.fn()} onVoid={onVoid} /><PortalHost /></>);
  expect(screen.getByTestId('order-details-void').textContent).toBe('Void');
  fireEvent.click(screen.getByTestId('order-details-void'));
  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  expect(onVoid).toHaveBeenCalledExactlyOnceWith();
  expect(onOpenChange.mock.invocationCallOrder[0]).toBeLessThan(onVoid.mock.invocationCallOrder[0]);
});

test('Void is absent without onVoid', () => {
  render(<><OrderDetailsSheet open side="left" note="" onOpenChange={vi.fn()} onNoteChange={vi.fn()} /><PortalHost /></>);
  expect(screen.queryByTestId('order-details-void')).toBeNull();
});

test.each(['order-details-close', 'order-details-x'])('%s closes the sheet', testID => {
  const onOpenChange = vi.fn();
  render(<><OrderDetailsSheet open side="left" note="" onOpenChange={onOpenChange} onNoteChange={vi.fn()} /><PortalHost /></>);
  expect(screen.getByTestId('order-details-x').getAttribute('aria-label')).toBe('Close');
  fireEvent.click(screen.getByTestId(testID));
  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
});

test.each([['left', 'border-r'], ['right', 'border-l']] as const)('side %s positions the panel', (side, border) => {
  render(<><OrderDetailsSheet open side={side} note="" onOpenChange={vi.fn()} onNoteChange={vi.fn()} /><PortalHost /></>);
  expect(screen.getByTestId('order-details').getAttribute('data-side')).toBe(side);
  expect(classesOf('order-details')).toContain(border);
});

test('Void and Close are 44 px outline buttons; Void\'s label is the foreground, not destructive', () => {
  wide();
  openSheet(vi.fn());
  expect(classesOf('order-details-void')).toEqual(expect.arrayContaining(['h-11', 'border-destructive']));
  expect(classesOf('order-details-void-label')).not.toContain('text-destructive');
  expect(classesOf('order-details-close')).toContain('h-11');
});

test.each(['left', 'right'] as const)('the sheet is 560 wide on the %s while Cart settings stays 512', side => {
  render(<><OrderDetailsSheet open side={side} note="" onOpenChange={vi.fn()} onNoteChange={vi.fn()} /><PortalHost /></>);
  expect(classesOf('order-details')).toEqual(expect.arrayContaining(['w-[560px]', 'max-w-full']));
  expect(classesOf('order-details')).not.toContain('w-[512px]');
  expect(CART_SHEET[side](false).split(' ')).toEqual(expect.arrayContaining(['w-[512px]', 'max-w-full']));
});

test('the note box is the Input field box with a muted placeholder and the ring on focus', () => {
  openSheet();
  expect(propsOf('order-details-note').placeholderTextColorClassName).toBe('accent-muted-foreground');
  expect(classesOf('order-details-note')).toEqual(expect.arrayContaining(['rounded-md', 'border', 'border-input', 'bg-card', 'min-h-20',
    'web:outline-none', 'web:focus:border-ring', 'web:focus:ring-1', 'web:focus:ring-ring']));
  expect(classesOf('order-details-note')).not.toContain('bg-background');
});

test('on a phone the footer stacks Close above Void, both full width', () => {
  phone();
  openSheet(vi.fn());
  expect(classesOf('order-details-footer')).toEqual(expect.arrayContaining(['flex-col', 'gap-2', 'border-t', 'border-border', 'px-4', 'pt-4']));
  expect(classesOf('order-details-footer')).not.toContain('flex-row');
  const ids = Array.from(screen.getByTestId('order-details-footer').children, child => child.getAttribute('data-testid'));
  expect(ids).toEqual(['order-details-close', 'order-details-void']);
  expect(classesOf('order-details-close')).toContain('w-full');
  expect(classesOf('order-details-void')).toContain('w-full');
});

test('wide, the footer is a row with Void first and Close last', () => {
  wide();
  openSheet(vi.fn());
  expect(classesOf('order-details-footer')).toEqual(expect.arrayContaining(['flex-row', 'border-t', 'px-4', 'pt-4']));
  const children = Array.from(screen.getByTestId('order-details-footer').children);
  expect(children[0].getAttribute('data-testid')).toBe('order-details-void');
  expect(children.at(-1)!.getAttribute('data-testid')).toBe('order-details-close');
  expect(classesOf('order-details-void')).not.toContain('w-full');
});

test('on a phone without onVoid the footer holds Close alone', () => {
  phone();
  openSheet();
  const ids = Array.from(screen.getByTestId('order-details-footer').children, child => child.getAttribute('data-testid'));
  expect(ids).toEqual(['order-details-close']);
});
