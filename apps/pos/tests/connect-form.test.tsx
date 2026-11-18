import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as ReactNative from 'react-native';
import { afterEach, expect, test, vi } from 'vitest';
import { Text } from '@tallyui/components';
import { ConnectForm } from '../components/connect-form';
import { SiteError } from '../lib/auth/site';
import type { ConnectStage } from '../lib/auth/site';
import type { StartSignIn } from '../lib/auth/use-connect-discovery';
import { classesOf } from './classes-of';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// v2 core.json auth.login_did_not_complete_hint.
const LOGIN_HINT = "Nothing is lost — unsent changes send once you're signed in. Try logging in again.";

test('with saved stores the address form waits behind Connect another store', () => {
  render(<ConnectForm startSignIn={vi.fn()} saved={<Text testID="saved-slot">saved</Text>} />);
  expect(screen.getByTestId('saved-slot')).not.toBeNull();
  expect(screen.queryByTestId('store-url-input')).toBeNull();
  expect(screen.getByTestId('connect-another-store').textContent).toBe('Connect another store');
  fireEvent.click(screen.getByTestId('connect-another-store'));
  expect(screen.getByTestId('store-url-input')).not.toBeNull();
  expect(screen.queryByTestId('connect-another-store')).toBeNull();
});

test('without saved stores only the address form shows', () => {
  render(<ConnectForm startSignIn={vi.fn()} />);
  expect(screen.getByTestId('store-url-input')).not.toBeNull();
  expect(screen.queryByTestId('connect-another-store')).toBeNull();
});

test('a sign-in callback error opens the address form even with saved stores', () => {
  render(<ConnectForm startSignIn={vi.fn()} saved={<Text testID="saved-slot">saved</Text>} signInError="state_mismatch" />);
  expect(screen.getByTestId('connect-error-message').textContent).toBe("The login didn't complete.");
  expect(screen.getByTestId('connect-error-hint').textContent).toBe(LOGIN_HINT);
});

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
  ['bot_challenge', 'HOST121'],
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

test.each(['state_mismatch', 'missing_token', 'no_pending', 'other'])(
  'shows the sign-in callback error %s until the address changes', code => {
    const startSignIn = vi.fn<StartSignIn>();
    render(<ConnectForm startSignIn={startSignIn} signInError={code} />);
    expect(screen.getByTestId('connect-error-message').textContent).toBe("The login didn't complete.");
    expect(screen.getByTestId('connect-error-hint').textContent).toBe(LOGIN_HINT);
    fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop.example' } });
    expect(screen.queryByTestId('connect-error-message')).toBeNull();
    expect(screen.queryByTestId('connect-error-hint')).toBeNull();
  });

test('a discovery error shows no login hint', async () => {
  const startSignIn = vi.fn<StartSignIn>().mockRejectedValue(new SiteError('no_wcpos', 'Missing WCPOS'));
  render(<ConnectForm startSignIn={startSignIn} signInError="state_mismatch" />);
  fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop.example' } });
  fireEvent.click(screen.getByTestId('connect-store-button'));
  expect((await screen.findByTestId('connect-error-message')).textContent).toBe('Missing WCPOS');
  expect(screen.queryByTestId('connect-error-hint')).toBeNull();
});

test('the form has no card title', () => {
  render(<ConnectForm startSignIn={vi.fn()} />);
  expect(screen.queryByText('Connect to your store')).toBeNull();
  expect(screen.getByText("Your store's address")).not.toBeNull();
});

test('the address field takes focus on open', () => {
  render(<ConnectForm startSignIn={vi.fn()} />);
  expect(document.activeElement).toBe(screen.getByTestId('store-url-input'));
});

test('the clear button shows only with text and empties the box', () => {
  render(<ConnectForm startSignIn={vi.fn()} />);
  expect(screen.queryByTestId('store-url-clear')).toBeNull();
  fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop.example' } });
  expect(screen.getByTestId('store-url-clear').getAttribute('aria-label')).toBe('Clear');
  fireEvent.click(screen.getByTestId('store-url-clear'));
  expect((screen.getByTestId('store-url-input') as HTMLInputElement).value).toBe('');
  expect(screen.queryByTestId('store-url-clear')).toBeNull();
});

test('the clear button hides while the store connects', async () => {
  const startSignIn = vi.fn<StartSignIn>(() => new Promise<void>(() => {}));
  render(<ConnectForm startSignIn={startSignIn} />);
  fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop.example' } });
  expect(screen.getByTestId('store-url-clear')).not.toBeNull();
  fireEvent.click(screen.getByTestId('connect-store-button'));
  await screen.findByTestId('connect-progress');
  expect(screen.queryByTestId('store-url-clear')).toBeNull();
});

function deferredSignIn() {
  let settle!: { resolve: () => void; reject: (error: unknown) => void };
  const startSignIn = vi.fn<StartSignIn>(() => new Promise<void>((resolve, reject) => { settle = { resolve, reject }; }));
  return { startSignIn, settle: () => settle };
}

// v2 url-input.tsx:55-62: the Connect button is `loading` while discovery runs (Button draws a Loader).
test('the Connect button spins while discovery runs and stops on an error', async () => {
  const { startSignIn, settle } = deferredSignIn();
  render(<ConnectForm startSignIn={startSignIn} />);
  fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop.example' } });
  expect(screen.queryByTestId('connect-store-spinner')).toBeNull();
  fireEvent.click(screen.getByTestId('connect-store-button'));
  await screen.findByTestId('connect-progress');
  expect(screen.getByTestId('connect-store-button').contains(screen.getByTestId('connect-store-spinner'))).toBe(true);
  await act(async () => { settle().reject(new SiteError('no_wcpos', 'Missing WCPOS')); });
  expect(screen.getByTestId('connect-error-message').textContent).toBe('Missing WCPOS');
  expect(screen.queryByTestId('connect-store-spinner')).toBeNull();
});

// use-connect-discovery keeps its stage after a resolved sign-in: the page is leaving for the store's login.
test('the Connect button keeps spinning while the page leaves for the sign-in', async () => {
  const { startSignIn, settle } = deferredSignIn();
  render(<ConnectForm startSignIn={startSignIn} />);
  fireEvent.change(screen.getByTestId('store-url-input'), { target: { value: 'shop.example' } });
  fireEvent.click(screen.getByTestId('connect-store-button'));
  expect(await screen.findByTestId('connect-store-spinner')).not.toBeNull();
  await act(async () => { settle().resolve(); });
  expect(screen.getByTestId('connect-store-button').contains(screen.getByTestId('connect-store-spinner'))).toBe(true);
});

// v2 url-input.tsx:69-71: `text-bad text-sm` (the app's text-destructive).
test('the error line is small red text', () => {
  render(<ConnectForm startSignIn={vi.fn()} signInError="state_mismatch" />);
  expect(classesOf('connect-error-message')).toEqual(expect.arrayContaining(['text-sm', 'text-destructive']));
});

// v2 url-input.tsx:37: `<VStack className="gap-2">`.
test('the address form is a tight stack', () => {
  render(<ConnectForm startSignIn={vi.fn()} />);
  const classes = classesOf('connect-url-form');
  expect(classes).toContain('gap-2');
  expect(classes).not.toContain('gap-4');
});
