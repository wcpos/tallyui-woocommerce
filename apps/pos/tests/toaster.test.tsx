import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Toaster } from '../components/toaster';
import { dismissToast, toast } from '../lib/toast/toast';

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });
afterEach(() => {
  act(() => dismissToast());
  cleanup();
  vi.useRealTimers();
});

test('shows a typed toast with its title, description and v2 test id', () => {
  render(<Toaster />);
  let id!: string;
  act(() => { id = toast({ type: 'success', title: 'Saved', description: 'All done' }); });
  const notification = within(screen.getByTestId('success-toast'));
  expect(notification.getByText('Saved')).not.toBeNull();
  expect(notification.getByText('All done')).not.toBeNull();
  expect(typeof id).toBe('string');
});

test('an untyped toast uses the default-toast test id', () => {
  render(<Toaster />);
  act(() => { toast({ title: 'Hello' }); });
  expect(within(screen.getByTestId('default-toast')).getByText('Hello')).not.toBeNull();
});

test.each(['error', 'info', 'warning'] as const)('each type gets its own test id', type => {
  render(<Toaster />);
  act(() => { toast({ type, title: 'Notice' }); });
  expect(within(screen.getByTestId(`${type}-toast`)).getByText('Notice')).not.toBeNull();
});

test('closes itself after 4000 ms, or after its own duration', () => {
  render(<Toaster />);
  act(() => { toast({ title: 'Default duration' }); });
  act(() => { vi.advanceTimersByTime(3999); });
  expect(screen.getByText('Default duration')).not.toBeNull();
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.queryByText('Default duration')).toBeNull();
  act(() => { toast({ title: 'Short duration', duration: 1000 }); });
  expect(screen.getByText('Short duration')).not.toBeNull();
  act(() => { vi.advanceTimersByTime(1000); });
  expect(screen.queryByText('Short duration')).toBeNull();
});

test('the same id updates the toast in place and restarts its timer', () => {
  render(<Toaster />);
  act(() => { toast({ id: 'x', title: 'One' }); });
  act(() => { vi.advanceTimersByTime(3000); });
  act(() => { toast({ id: 'x', title: 'Two' }); });
  expect(screen.getAllByTestId('default-toast')).toHaveLength(1);
  expect(screen.getByText('Two')).not.toBeNull();
  expect(screen.queryByText('One')).toBeNull();
  act(() => { vi.advanceTimersByTime(3000); });
  expect(screen.getByText('Two')).not.toBeNull();
  act(() => { vi.advanceTimersByTime(1000); });
  expect(screen.queryByText('Two')).toBeNull();
});

test('shows at most three, newest first, dropping the oldest', () => {
  render(<Toaster />);
  act(() => {
    for (const title of ['A', 'B', 'C', 'D']) toast({ title });
  });
  const notifications = screen.getAllByTestId('default-toast');
  expect(notifications).toHaveLength(3);
  ['D', 'C', 'B'].forEach((title, index) => {
    expect(within(notifications[index]).getByText(title)).not.toBeNull();
  });
  expect(screen.queryByText('A')).toBeNull();
});

test('the close button dismisses that toast', () => {
  render(<Toaster />);
  act(() => { toast({ title: 'First' }); toast({ title: 'Second' }); });
  fireEvent.click(screen.getAllByRole('button', { name: 'Close toast' })[0]);
  expect(screen.queryByText('Second')).toBeNull();
  expect(screen.getByText('First')).not.toBeNull();
  expect(screen.getAllByTestId('default-toast')).toHaveLength(1);
});

test('a toast raised before the host mounts shows when it mounts', () => {
  act(() => { toast({ title: 'Already saved' }); });
  render(<Toaster />);
  expect(screen.getByText('Already saved')).not.toBeNull();
});

test('renders nothing when there are no toasts', () => {
  render(<Toaster />);
  expect(screen.queryByTestId('toaster')).toBeNull();
});
