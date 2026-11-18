import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PortalHost } from '@tallyui/primitives';
import { SavedSites, type SavedSitesProps } from '../components/saved-sites';
import { SessionExpiredError, type Session } from '../lib/auth/session';

const home = 'https://shop.example';
const site = { name: 'Store', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` };
const second = {
  name: 'Second', home: 'https://second.example', wpApiUrl: 'https://second.example/wp-json',
  wcposApiUrl: 'https://second.example/wp-json/wcpos/v2', authUrl: 'https://second.example/wcpos-auth/',
};
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
const c: Session = {
  site: second,
  tokens: {
    accessToken: 'access-c', refreshToken: 'refresh-c', expiresAt: 1791239000 + 86400,
    user: { id: 3, uuid: '12345678-1234-1234-1234-123456789ccc', displayName: 'Cashier C' },
  },
};
const cUuid = c.tokens.user.uuid;
const d: Session = {
  site: second,
  tokens: {
    accessToken: 'access-d', refreshToken: 'refresh-d', expiresAt: 1791239000 + 86400,
    user: { id: 4, uuid: '12345678-1234-1234-1234-123456789ddd', displayName: 'Cashier D' },
  },
};
const dUuid = d.tokens.user.uuid;
const onOpenPos = vi.fn<SavedSitesProps['onOpenPos']>();
const onSignInAt = vi.fn(), onRemoveUser = vi.fn(), onRemoveSite = vi.fn();
beforeEach(() => {
  onOpenPos.mockResolvedValue(undefined);
  render(<><SavedSites sites={[{ site, cashiers: [a, b] }]} onOpenPos={onOpenPos}
    onSignInAt={onSignInAt} onRemoveUser={onRemoveUser} onRemoveSite={onRemoveSite} /><PortalHost /></>);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function renderTwo(secondCashiers: Session[] = [c]) {
  cleanup();
  render(<><SavedSites sites={[{ site, cashiers: [a, b] }, { site: second, cashiers: secondCashiers }]} onOpenPos={onOpenPos}
    onSignInAt={onSignInAt} onRemoveUser={onRemoveUser} onRemoveSite={onRemoveSite} /><PortalHost /></>);
}

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

test('says signed-out users stay saved until removed', () => {
  expect(screen.getByTestId('saved-users-note').textContent).toBe('Signed-out users stay saved on this device until you remove them.');
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

const radio = (uuid: string) => screen.getByTestId(`saved-user-select-${uuid}`);

test('ArrowDown and ArrowRight move to the next user, select it, and wrap at the end', () => {
  cleanup();
  render(<><SavedSites sites={[{ site, cashiers: [a, b, c] }]} onOpenPos={onOpenPos}
    onSignInAt={onSignInAt} onRemoveUser={onRemoveUser} onRemoveSite={onRemoveSite} /><PortalHost /></>);
  radio(aUuid).focus();
  fireEvent.keyDown(radio(aUuid), { key: 'ArrowDown' });
  expect(document.activeElement).toBe(radio(bUuid));
  expect(radio(bUuid).getAttribute('aria-checked')).toBe('true');
  expect(radio(aUuid).getAttribute('aria-checked')).toBe('false');
  fireEvent.keyDown(radio(bUuid), { key: 'ArrowRight' });
  expect(document.activeElement).toBe(radio(cUuid));
  expect(radio(cUuid).getAttribute('aria-checked')).toBe('true');
  fireEvent.keyDown(radio(cUuid), { key: 'ArrowDown' });
  expect(document.activeElement).toBe(radio(aUuid));
  expect(radio(aUuid).getAttribute('aria-checked')).toBe('true');
});

test('ArrowUp and ArrowLeft move to the previous user and wrap at the start', () => {
  cleanup();
  render(<><SavedSites sites={[{ site, cashiers: [a, b, c] }]} onOpenPos={onOpenPos}
    onSignInAt={onSignInAt} onRemoveUser={onRemoveUser} onRemoveSite={onRemoveSite} /><PortalHost /></>);
  radio(aUuid).focus();
  fireEvent.keyDown(radio(aUuid), { key: 'ArrowUp' });
  expect(document.activeElement).toBe(radio(cUuid));
  expect(radio(cUuid).getAttribute('aria-checked')).toBe('true');
  fireEvent.keyDown(radio(cUuid), { key: 'ArrowLeft' });
  expect(document.activeElement).toBe(radio(bUuid));
  expect(radio(bUuid).getAttribute('aria-checked')).toBe('true');
});

test("only the selected user's radio is a Tab stop", () => {
  expect(radio(aUuid).getAttribute('tabindex')).toBe('0');
  expect(radio(bUuid).getAttribute('tabindex')).toBe('-1');
  fireEvent.click(radio(bUuid));
  expect(radio(bUuid).getAttribute('tabindex')).toBe('0');
  expect(radio(aUuid).getAttribute('tabindex')).toBe('-1');
});

test('an arrow never signs a user in', async () => {
  radio(aUuid).focus();
  await act(async () => {
    fireEvent.keyDown(radio(aUuid), { key: 'ArrowDown' });
    fireEvent.keyDown(radio(bUuid), { key: 'ArrowRight' });
    fireEvent.keyDown(radio(aUuid), { key: 'ArrowUp' });
    fireEvent.keyDown(radio(bUuid), { key: 'ArrowLeft' });
  });
  expect(onOpenPos).not.toHaveBeenCalled();
});

test("keys other than the arrows, and arrows on a row's buttons, leave the selection alone", () => {
  fireEvent.keyDown(radio(aUuid), { key: 'Home' });
  expect(radio(aUuid).getAttribute('aria-checked')).toBe('true');
  fireEvent.keyDown(screen.getByTestId(`saved-user-remove-${aUuid}`), { key: 'ArrowDown' });
  expect(radio(aUuid).getAttribute('aria-checked')).toBe('true');
  expect(radio(bUuid).getAttribute('aria-checked')).toBe('false');
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

test('one site shows no heading, fold or users badge', () => {
  expect(screen.queryByTestId('saved-sites-heading')).toBeNull();
  expect(screen.queryByTestId('saved-site-trigger')).toBeNull();
  expect(screen.queryByTestId('saved-site-users')).toBeNull();
});

test('several sites fold under Your sites with the first open', () => {
  renderTwo();
  expect(screen.getByTestId('saved-sites-heading').textContent).toBe('Your sites');
  const cards = screen.getAllByTestId('saved-site');
  expect(cards).toHaveLength(2);
  expect(within(cards[0]).getByTestId('open-pos-button')).not.toBeNull();
  expect(within(cards[1]).queryByTestId('open-pos-button')).toBeNull();
  expect(screen.getAllByTestId('saved-site-users').map(badge => badge.textContent)).toEqual(['2 users', '1 user']);
  const triggers = screen.getAllByTestId('saved-site-trigger');
  expect(triggers.map(trigger => trigger.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
  expect(within(triggers[0]).getByText('Store')).not.toBeNull();
  expect(within(triggers[0]).getByText(home)).not.toBeNull();
  expect(within(triggers[1]).getByText('Second')).not.toBeNull();
  expect(within(triggers[1]).getByText('https://second.example')).not.toBeNull();
});

test('opening the second site folds the first', async () => {
  renderTwo();
  const triggers = screen.getAllByTestId('saved-site-trigger');
  fireEvent.click(triggers[1]);
  const cards = screen.getAllByTestId('saved-site');
  expect(within(cards[1]).getByTestId('open-pos-button')).not.toBeNull();
  expect(within(cards[0]).queryByTestId('open-pos-button')).toBeNull();
  expect(triggers.map(trigger => trigger.getAttribute('aria-expanded'))).toEqual(['false', 'true']);
  await act(async () => { fireEvent.click(within(cards[1]).getByTestId('open-pos-button')); });
  expect(onOpenPos).toHaveBeenCalledWith('https://second.example', cUuid);
});

test('a fold keeps the picked cashier', () => {
  renderTwo();
  fireEvent.click(screen.getByTestId(`saved-user-select-${bUuid}`));
  fireEvent.click(screen.getAllByTestId('saved-site-trigger')[0]);
  expect(screen.queryByTestId('open-pos-button')).toBeNull();
  expect(screen.queryByTestId(`saved-user-select-${bUuid}`)).toBeNull();
  fireEvent.click(screen.getAllByTestId('saved-site-trigger')[0]);
  expect(screen.getByTestId(`saved-user-select-${bUuid}`).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId(`saved-user-select-${aUuid}`).getAttribute('aria-checked')).toBe('false');
});

test('a pick in the second site stays with that site', () => {
  renderTwo([c, d]);
  const checked = (uuid: string) => screen.getByTestId(`saved-user-select-${uuid}`).getAttribute('aria-checked');
  fireEvent.click(screen.getAllByTestId('saved-site-trigger')[1]);
  fireEvent.click(screen.getByTestId(`saved-user-select-${dUuid}`));
  expect([checked(dUuid), checked(cUuid)]).toEqual(['true', 'false']);
  fireEvent.click(screen.getAllByTestId('saved-site-trigger')[0]);
  expect([checked(aUuid), checked(bUuid)]).toEqual(['true', 'false']);
  fireEvent.click(screen.getAllByTestId('saved-site-trigger')[1]);
  expect([checked(dUuid), checked(cUuid)]).toEqual(['true', 'false']);
});
