import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import { View } from 'react-native';
import { SessionHoldBanner } from '../../components/session-hold-banner';
import { SettingsArea, type SettingsNavItem } from '../../components/settings/settings-area';
import { UnreadBadge } from '../../components/unread-badge';
import { useIsWide } from '../../lib/layout/wide';
import { useUnreadLogsCount } from '../../lib/logs/unread-errors';

// v2 apps/main/components/area-navigation/health.tsx; Logs' unread badge is added in the layout.
const HEALTH_NAV_ITEMS: SettingsNavItem[] = [
  { href: '/health/database', label: 'Database', testID: 'health-nav-database', description: 'Your store, on this device — sales keep working even if your server does not.' },
  { href: '/health/performance', label: 'Performance', testID: 'health-nav-performance' },
  { href: '/health/logs', label: 'Logs', testID: 'health-nav-logs' },
];

export default function HealthLayoutRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const wide = useIsWide();
  const unread = useUnreadLogsCount();
  return (
    <View className="flex-1 bg-background">
    {/* v2 navigation-area/index.tsx:112: the held-session banner tops the area, once for all its pages. */}
    <SessionHoldBanner />
    <SettingsArea items={HEALTH_NAV_ITEMS.map(item => item.href === '/health/logs'
      ? { ...item, badge: <UnreadBadge count={unread} testID="health-nav-logs-badge" /> } : item)}
      currentHref={pathname} wide={wide} title="Store health" testIDPrefix="health"
      onNavigate={href => router.push(href as Href)}
      onIndex={() => router.dismissTo('/health')}
      onBack={() => { router.canGoBack() ? router.back() : router.replace('/catalogue'); }}>
      <Slot />
    </SettingsArea>
    </View>
  );
}
