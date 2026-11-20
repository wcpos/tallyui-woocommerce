import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import { View } from 'react-native';
import { SessionHoldBanner } from '../../components/session-hold-banner';
import { SettingsArea } from '../../components/settings/settings-area';
import { SETTINGS_NAV_ITEMS } from '../../components/settings/settings-navigation';
import { useIsWide } from '../../lib/layout/wide';

export default function SettingsLayoutRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const wide = useIsWide();
  return (
    <View className="flex-1 bg-background">
    {/* v2 navigation-area/index.tsx:112: the held-session banner tops the area, once for all its pages. */}
    <SessionHoldBanner />
    <SettingsArea items={SETTINGS_NAV_ITEMS} currentHref={pathname} wide={wide}
      onNavigate={href => router.push(href as Href)}
      onIndex={() => router.dismissTo('/settings')}
      onBack={() => { router.canGoBack() ? router.back() : router.replace('/catalogue'); }}>
      <Slot />
    </SettingsArea>
    </View>
  );
}
