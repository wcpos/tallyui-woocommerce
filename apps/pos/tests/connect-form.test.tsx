import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as ReactNative from 'react-native';
import { afterEach, expect, test, vi } from 'vitest';
import { ConnectForm } from '../components/connect-form';
import { SiteError } from '../lib/auth/site';
import type { ConnectStage } from '../lib/auth/site';
import type { StartSignIn } from '../lib/auth/use-connect-discovery';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('names each discovery stage while the store connects', async () => {
  let reportStage!: (stage: ConnectStage) => void;
  const startSignIn = vi.fn<StartSignIn>((_siteInput, onStage) => {
    reportStage = onStage;
    return new Promise<void>(() => {});
  });
  render(<ConnectForm startSignIn={startSignIn} />);
  fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop.example' } });
  fireEvent.click(screen.getByTestId('connect-store-button'));
  expect((await screen.findByTestId('connect-progress')).textContent).toBe('Finding your store…');
  expect(startSignIn).toHaveBeenCalledExactlyOnceWith('shop.example', expect.any(Function));
  act(() => { reportStage('checking-wordpress'); });
  expect(screen.getByTestId('connect-progress').textContent).toBe('Checking WordPress…');
  act(() => { reportStage('checking-wcpos'); });
  expect(screen.getByTestId('connect-progress').textContent).toBe('Checking WooCommerce POS…');
  act(() => { reportStage('saving'); });
  expect(screen.getByTestId('connect-progress').textContent).toBe('Saving…');
  fireEvent.click(screen.getByTestId('connect-store-button'));
  expect(startSignIn).toHaveBeenCalledTimes(1);
});

test('does not connect while the address is empty', () => {
  const startSignIn = vi.fn<StartSignIn>();
  render(<ConnectForm startSignIn={startSignIn} />);
  fireEvent.click(screen.getByTestId('connect-store-button'));
  expect(startSignIn).not.toHaveBeenCalled();
});

test.each([
  ['no_wcpos', 'AUTH311'], ['wcpos_outdated', 'AUTH331'], ['invalid_url', 'AUTH411'],
] as const)('links %s to its error code docs', async (code, errorCode) => {
  const startSignIn = vi.fn<StartSignIn>().mockRejectedValue(new SiteError(code, `Message for ${code}`));
  render(<ConnectForm startSignIn={startSignIn} />);
  fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop.example' } });
  fireEvent.click(screen.getByTestId('connect-store-button'));
  expect((await screen.findByTestId('connect-error-message')).textContent).toBe(`Message for ${code}`);
  const link = screen.getByTestId(`connect-error-docs-link-${errorCode}`);
  expect(link.textContent).toContain('Learn more');
  expect(link.textContent).toContain(errorCode);
  expect(screen.queryByTestId('connect-progress')).toBeNull();
});

test.each(['unreachable', 'not_wordpress'] as const)('shows %s without a docs link', async code => {
  const startSignIn = vi.fn<StartSignIn>().mockRejectedValue(new SiteError(code, `Message for ${code}`));
  render(<ConnectForm startSignIn={startSignIn} />);
  fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop.example' } });
  fireEvent.click(screen.getByTestId('connect-store-button'));
  expect((await screen.findByTestId('connect-error-message')).textContent).toBe(`Message for ${code}`);
  expect(document.querySelector('[data-testid^="connect-error-docs-link-"]')).toBeNull();
});

test('opens the error code page from Learn more', async () => {
  const open = vi.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(true);
  const startSignIn = vi.fn<StartSignIn>().mockRejectedValue(new SiteError('no_wcpos', 'Missing WCPOS'));
  render(<ConnectForm startSignIn={startSignIn} />);
  fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop.example' } });
  fireEvent.click(screen.getByTestId('connect-store-button'));
  fireEvent.click(await screen.findByTestId('connect-error-docs-link-AUTH311'));
  expect(open).toHaveBeenCalledExactlyOnceWith('https://docs.wcpos.com/error-codes/AUTH311');
});

test('shows a generic message for an unexpected failure', async () => {
  const startSignIn = vi.fn<StartSignIn>().mockRejectedValue(new Error('boom'));
  render(<ConnectForm startSignIn={startSignIn} />);
  fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop.example' } });
  fireEvent.click(screen.getByTestId('connect-store-button'));
  expect((await screen.findByTestId('connect-error-message')).textContent).toBe('Could not connect. Try again.');
  expect(document.querySelector('[data-testid^="connect-error-docs-link-"]')).toBeNull();
});

test('clears the error when the address changes', async () => {
  const startSignIn = vi.fn<StartSignIn>().mockRejectedValue(new SiteError('no_wcpos', 'Missing WCPOS'));
  render(<ConnectForm startSignIn={startSignIn} />);
  fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop.example' } });
  fireEvent.click(screen.getByTestId('connect-store-button'));
  await screen.findByTestId('connect-error-message');
  fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop2.example' } });
  expect(screen.queryByTestId('connect-error-message')).toBeNull();
  expect(document.querySelector('[data-testid^="connect-error-docs-link-"]')).toBeNull();
});

test.each([
  ['state_mismatch', 'Sign-in could not be verified. Try again.'],
  ['missing_token', 'The store did not return a sign-in token. Try again.'],
  ['no_pending', 'That sign-in link has expired. Try again.'],
  ['other', 'Sign-in failed. Try again.'],
])('shows the sign-in callback error %s until the address changes', (code, message) => {
  const startSignIn = vi.fn<StartSignIn>();
  render(<ConnectForm startSignIn={startSignIn} signInError={code} />);
  expect(screen.getByTestId('connect-error-message').textContent).toBe(message);
  fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop.example' } });
  expect(screen.queryByTestId('connect-error-message')).toBeNull();
});
