import type { SettingsNavItem } from './settings-area';
// v2 apps/main/components/area-navigation/settings.ts, listing only the pages this app has.
export const SETTINGS_DEFAULT_HREF = '/settings/general';
export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { href: '/settings/general', label: 'General', testID: 'settings-nav-general' },
];
