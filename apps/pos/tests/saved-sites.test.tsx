import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PortalHost } from '@tallyui/primitives';
import { SavedSites, type SavedSitesProps } from '../components/saved-sites';
import { SessionExpiredError, type Session } from '../lib/auth/session';

const home = 'https://shop.example';
const site = { name: 'Store', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` };
const a: Session = {
  site,
  tokens: {
    accessToken: 'access-a', refreshToken: 'refresh-a', expiresAt: 1791239000 + 86400,
    user: { id: 1, uuid: '12345678-1234-1234-1234-123456789aaa', displayName: 'Cashier A' },
  },
};
const b: Session = {
  site,
  tokens: {
    accessToken: 'access-b', refreshToken: 'refresh-b', expiresAt: 1791239000 + 86400,
    user: { id: 2, uuid: '12345678-1234-1234-1234-123456789bbb', displayName: '' },
  },
};
const aUuid = a.tokens.user.uuid, bUuid = b.tokens.user.uuid;
const onOpenPos = vi.fn<SavedSitesProps['onOpenPos']>();
const onSignInAt = vi.fn(), onRemoveUser = vi.fn(), onRemoveSite = vi.fn();
beforeEach(() => {
  onOpenPos.mockResolvedValue(undefined);
  render(<><SavedSites sites={[{ site, cashiers: [a, b] }]} onOpenPos={onOpenPos}
    onSignInAt={onSignInAt} onRemoveUser={onRemoveUser} onRemoveSite={onRemoveSite} /><PortalHost /></>);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

test("shows the saved store and its users in v2's words", () => {
  expect(screen.getByTestId('saved-site-name').textContent).toBe('Store');
  expect(screen.getByTestId('saved-site-url').textContent).toBe(home);
  for (const label of ['WordPress users', 'Cashier A', 'Unknown user', 'Add another user', 'Open POS']) {
    expect(screen.getByText(label)).not.toBeNull();
  }
  expect(screen.getByTestId(`saved-user-status-${aUuid}`).textContent).toBe('Signed in');
  expect(screen.getByTestId(`saved-user-status-${bUuid}`).textContent).toBe('Signed in');
  expect(screen.getByTestId('saved-site-menu').getAttribute('aria-label')).toBe('Actions');
  expect(screen.getByTestId(`saved-user-remove-${aUuid}`).getAttribute('aria-label')).toBe('Remove Cashier A');
  expect(document.querySelector('[data-testid^="saved-user-reauth-"]')).toBeNull();
});

test('Open POS signs in the first user, or the one picked', async () => {
  expect(screen.getByTestId(`saved-user-select-${aUuid}`).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId(`saved-user-select-${bUuid}`).getAttribute('aria-checked')).toBe('false');
  await act(async () => { fireEvent.click(screen.getByTestId('open-pos-button')); });
  expect(onOpenPos).toHaveBeenCalledWith(home, aUuid);
  fireEvent.click(screen.getByTestId(`saved-user-select-${bUuid}`));
  expect(screen.getByTestId(`saved-user-select-${bUuid}`).getAttribute('aria-checked')).toBe('true');
  await act(async () => { fireEvent.click(screen.getByTestId('open-pos-button')); });
  expect(onOpenPos).toHaveBeenLastCalledWith(home, bUuid);
});

test('a refused user reads Sign in again and offers Re-authenticate', async () => {
  onOpenPos.mockRejectedValue(new SessionExpiredError());
  await act(async () => { fireEvent.click(screen.getByTestId('open-pos-button')); });
  expect(screen.getByTestId(`saved-user-status-${aUuid}`).textContent).toBe('Sign in again');
  expect(screen.getByTestId('open-pos-button').getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByTestId(`saved-user-reauth-${aUuid}`));
  expect(onSignInAt).toHaveBeenCalledWith(site);
});

test('another sign-in failure says Could not sign in', async () => {
  onOpenPos.mockRejectedValue(new Error('offline'));
  await act(async () => { fireEvent.click(screen.getByTestId('open-pos-button')); });
  expect(screen.getByTestId('saved-open-pos-error').textContent).toBe('Could not sign in. Try again.');
  expect(screen.getByTestId(`saved-user-status-${aUuid}`).textContent).toBe('Signed in');
});

test('removing a user asks first', () => {
  fireEvent.click(screen.getByTestId(`saved-user-remove-${aUuid}`));
  expect(screen.getByText('Remove Cashier A')).not.toBeNull();
  expect(screen.getByText('Are you sure you want to remove this user? Removing a user from the POS will not affect any data on the server.')).not.toBeNull();
  expect(onRemoveUser).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('saved-user-remove-cancel'));
  expect(onRemoveUser).not.toHaveBeenCalled();
  expect(screen.queryByTestId('saved-user-remove-confirm')).toBeNull();
  expect(screen.queryByText('Remove Cashier A')).toBeNull();
  fireEvent.click(screen.getByTestId(`saved-user-remove-${aUuid}`));
  fireEvent.click(screen.getByTestId('saved-user-remove-confirm'));
  expect(onRemoveUser).toHaveBeenCalledExactlyOnceWith(home, aUuid);
});

test('removing the site asks first', () => {
  fireEvent.click(screen.getByTestId('saved-site-menu'));
  fireEvent.click(screen.getByTestId('saved-site-remove'));
  expect(screen.getByText('Remove site')).not.toBeNull();
  expect(screen.getByText('Remove store and associated users?')).not.toBeNull();
  expect(onRemoveSite).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('saved-site-remove-cancel'));
  expect(onRemoveSite).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('saved-site-menu'));
  fireEvent.click(screen.getByTestId('saved-site-remove'));
  fireEvent.click(screen.getByTestId('saved-site-remove-confirm'));
  expect(onRemoveSite).toHaveBeenCalledExactlyOnceWith(home);
});

test('Add another user starts a sign-in at the saved store', () => {
  fireEvent.click(screen.getByTestId('saved-add-user'));
  expect(onSignInAt).toHaveBeenCalledExactlyOnceWith(site);
});
