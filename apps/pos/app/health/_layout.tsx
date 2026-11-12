import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import { SettingsArea, type SettingsNavItem } from '../../components/settings/settings-area';
import { useIsWide } from '../../lib/layout/wide';

// v2 apps/main/components/area-navigation/health.tsx.
const HEALTH_NAV_ITEMS: SettingsNavItem[] = [
  { href: '/health/database', label: 'Database', testID: 'health-nav-database', description: 'Your store, on this device — sales keep working even if your server does not.' },
  { href: '/health/performance', label: 'Performance', testID: 'health-nav-performance' },
  { href: '/health/logs', label: 'Logs', testID: 'health-nav-logs' },
];

export default function HealthLayoutRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const wide = useIsWide();
  return (
    <SettingsArea items={HEALTH_NAV_ITEMS} currentHref={pathname} wide={wide} title="Store health" testIDPrefix="health"
      onNavigate={href => router.push(href as Href)}
      onBack={() => { router.canGoBack() ? router.back() : router.replace('/catalogue'); }}>
      <Slot />
    </SettingsArea>
  );
}
