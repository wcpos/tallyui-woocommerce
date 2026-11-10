import type { SettingsNavItem } from './settings-area';
// v2 apps/main/components/area-navigation/settings.ts, listing only the pages this app has.
export const SETTINGS_DEFAULT_HREF = '/settings/general';
export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { href: '/settings/general', label: 'General', testID: 'settings-nav-general' },
  { href: '/settings/tax', label: 'Tax', testID: 'settings-nav-tax' },
  { href: '/settings/barcode-scanning', label: 'Barcode Scanning', testID: 'settings-nav-barcode-scanning' },
  { href: '/settings/theme', label: 'Theme', testID: 'settings-nav-theme' },
];
