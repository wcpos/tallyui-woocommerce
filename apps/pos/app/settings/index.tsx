import { Redirect, type Href } from 'expo-router';
import { SETTINGS_DEFAULT_HREF } from '../../components/settings/settings-navigation';
import { useIsWide } from '../../lib/layout/wide';

// v2 `NavigationAreaIndex`: wide opens on General; a phone stays here, where the layout draws the page list.
export default function SettingsIndex() {
  return useIsWide() ? <Redirect href={SETTINGS_DEFAULT_HREF as Href} /> : null;
}
