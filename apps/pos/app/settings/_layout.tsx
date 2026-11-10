import { Slot, usePathname, useRouter, type Href } from 'expo-router';
import { SettingsArea } from '../../components/settings/settings-area';
import { SETTINGS_NAV_ITEMS } from '../../components/settings/settings-navigation';

export default function SettingsLayoutRoute() {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <SettingsArea items={SETTINGS_NAV_ITEMS} currentHref={pathname}
      onNavigate={href => router.push(href as Href)}
      onBack={() => { router.canGoBack() ? router.back() : router.replace('/catalogue'); }}>
      <Slot />
    </SettingsArea>
  );
}
