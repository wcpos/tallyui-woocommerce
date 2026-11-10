import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { Text } from '@tallyui/components';
import { SettingsArea } from '../components/settings/settings-area';
import { SETTINGS_DEFAULT_HREF, SETTINGS_NAV_ITEMS } from '../components/settings/settings-navigation';
import { GeneralSettings, wooSettingsUrl } from '../components/settings/general-settings';

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const store = { id: 1, name: 'Corner Café', currency: 'AUD', locale: 'en_AU' };
const siteHome = 'https://shop.example/';

test('the nav lists General, Tax, Barcode Scanning then Theme, with the v2 test ids and hrefs', () => {
  expect(SETTINGS_NAV_ITEMS).toEqual([{ href: '/settings/general', label: 'General', testID: 'settings-nav-general' }, { href: '/settings/tax', label: 'Tax', testID: 'settings-nav-tax' }, { href: '/settings/barcode-scanning', label: 'Barcode Scanning', testID: 'settings-nav-barcode-scanning' }, { href: '/settings/theme', label: 'Theme', testID: 'settings-nav-theme' }]);
  expect(SETTINGS_DEFAULT_HREF).toBe('/settings/general');
  render(
    <SettingsArea wide items={SETTINGS_NAV_ITEMS} currentHref="/settings/general" onNavigate={vi.fn()} onBack={vi.fn()}>
      <Text>page body</Text>
    </SettingsArea>
  );
  expect(screen.getByTestId('settings-nav-general')).not.toBeNull();
  expect(screen.getByTestId('settings-nav-tax')).not.toBeNull();
  expect(screen.getByTestId('settings-nav-barcode-scanning')).not.toBeNull();
  expect(screen.getByTestId('settings-nav-theme')).not.toBeNull();
  expect(within(screen.getByTestId('settings-screen')).getByText('page body')).not.toBeNull();
  expect(screen.getByTestId('settings-navigation')).not.toBeNull();
});

test('pressing a nav item navigates to its href', () => {
  const onNavigate = vi.fn();
  render(
    <SettingsArea wide items={SETTINGS_NAV_ITEMS} currentHref="/settings/general" onNavigate={onNavigate} onBack={vi.fn()}>
      <Text>page body</Text>
    </SettingsArea>
  );
  fireEvent.click(screen.getByTestId('settings-nav-general'));
  expect(onNavigate).toHaveBeenCalledExactlyOnceWith('/settings/general');
});

// react-native-web drops className from the DOM, so read it off the component that took the testID.
type Fiber = { memoizedProps?: { testID?: string; className?: unknown }; return?: Fiber };
function classesAbove(testID: string, ownOnly = false): string[] {
  const node = screen.getByTestId(testID) as unknown as Record<string, Fiber>;
  const found: string[] = [];
  for (let fiber: Fiber | undefined = node[Object.keys(node).find(key => key.startsWith('__reactFiber$'))!]; fiber; fiber = fiber.return) {
    const { className, testID: id } = fiber.memoizedProps ?? {};
    if (typeof className !== 'string') continue;
    found.push(...className.split(/\s+/));
    if (ownOnly && id === testID) break;
  }
  return found;
}
const classesOf = (testID: string) => classesAbove(testID, true);
const renderArea = (props: { wide: boolean; currentHref?: string; onNavigate?(href: string): void; onBack?(): void }, body = <Text>body</Text>) => render(
  <SettingsArea items={SETTINGS_NAV_ITEMS} currentHref={props.currentHref ?? '/settings/general'} wide={props.wide}
    onNavigate={props.onNavigate ?? vi.fn()} onBack={props.onBack ?? vi.fn()}>{body}</SettingsArea>
);

test('on a wide window Settings has no bar of its own: no Back, no Settings title', () => {
  renderArea({ wide: true });
  expect(screen.queryByTestId('settings-back')).toBeNull();
  expect(screen.queryByText('Settings')).toBeNull();
});

test("the sub-nav is v2's 224px column and the open page reads selected", () => {
  renderArea({ wide: true, currentHref: '/settings/tax' });
  expect(classesOf('settings-navigation-rail')).toContain('w-56');
  expect(classesOf('settings-nav-tax')).toContain('bg-card');
  expect(screen.getByTestId('settings-nav-tax').getAttribute('aria-selected')).toBe('true');
  for (const id of ['settings-nav-general', 'settings-nav-barcode-scanning', 'settings-nav-theme']) {
    expect(classesOf(id)).not.toContain('bg-card');
    expect(screen.getByTestId(id).getAttribute('aria-selected')).not.toBe('true');
  }
});

test('each page is one card titled by its nav item, with the body under a hairline', () => {
  renderArea({ wide: true, currentHref: '/settings/tax' });
  expect(screen.getByTestId('settings-page-title').textContent).toBe('Tax');
  expect(screen.getByRole('heading', { name: 'Tax' }).getAttribute('aria-level')).toBe('1');
  expect(within(screen.getByTestId('settings-page-body')).getByText('body')).not.toBeNull();
  expect(classesOf('settings-page-body')).toContain('border-t');
  expect(classesOf('settings-page')).toEqual(expect.arrayContaining(['border', 'rounded-lg']));
  expect(classesAbove('settings-page')).toContain('max-w-4xl');
});

test('pressing a nav item navigates to its page', () => {
  const onNavigate = vi.fn();
  renderArea({ wide: true, onNavigate });
  fireEvent.click(screen.getByTestId('settings-nav-tax'));
  expect(onNavigate).toHaveBeenCalledExactlyOnceWith('/settings/tax');
});

test('on a phone Settings keeps its Back bar, and Back leaves Settings', () => {
  const onBack = vi.fn();
  renderArea({ wide: false, currentHref: '/settings/tax', onBack });
  expect(screen.getByText('Settings')).not.toBeNull();
  expect(screen.getByRole('heading', { name: 'Tax' })).not.toBeNull();
  fireEvent.click(screen.getByTestId('settings-back'));
  expect(onBack).toHaveBeenCalledOnce();
});

test('the General page carries its title once', () => {
  renderArea({ wide: true, currentHref: '/settings/general' }, <GeneralSettings store={store} siteHome={siteHome} />);
  expect(screen.getAllByText('General')).toHaveLength(2);
  expect(screen.getByTestId('settings-page-title').textContent).toBe('General');
  expect(within(screen.getByTestId('screen-settings-general')).queryByText('General')).toBeNull();
});

test('General shows the store name, currency and language read-only, each set in WooCommerce', () => {
  const { container } = render(<GeneralSettings store={store} siteHome={siteHome} />);
  expect(screen.getByTestId('screen-settings-general')).not.toBeNull();
  expect(screen.queryByText('General')).toBeNull();
  expect(screen.getByText('Store')).not.toBeNull();
  expect(screen.getByTestId('settings-general-locked-name-value').textContent).toBe('Corner Café');
  expect(screen.getByTestId('settings-general-locked-currency-value').textContent).toBe('AUD');
  expect(screen.getByTestId('settings-general-locked-locale-value').textContent).toBe('en_AU');
  expect(screen.getAllByText('Set in WooCommerce')).toHaveLength(3);
  expect(screen.getByText('Store Name')).not.toBeNull();
  expect(screen.getByText('Currency')).not.toBeNull();
  expect(screen.getByText('Language')).not.toBeNull();
  expect(container.querySelectorAll('input, textarea, select').length).toBe(0);
});

test('a missing language shows a dash', () => {
  render(<GeneralSettings store={{ ...store, locale: undefined }} siteHome={siteHome} />);
  expect(screen.getByTestId('settings-general-locked-locale-value').textContent).toBe('—');
});

test('Open opens the WooCommerce settings page', () => {
  const open = vi.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(true);
  render(<GeneralSettings store={store} siteHome={siteHome} />);
  fireEvent.click(screen.getByTestId('settings-general-locked-currency-open'));
  expect(open).toHaveBeenCalledExactlyOnceWith('https://shop.example/wp-admin/admin.php?page=wc-settings');
  expect(wooSettingsUrl('https://shop.example')).toBe('https://shop.example/wp-admin/admin.php?page=wc-settings');
});
