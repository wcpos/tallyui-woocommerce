import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ORDER_NOTE_MAX } from '@tallyui/core';
import { PortalHost } from '@tallyui/primitives';
import { OrderDetailsSheet } from '../components/order-details-sheet';
import { classesOf } from './classes-of';

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => { data.delete(key); },
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
