import { Redirect, type Href } from 'expo-router';
import { SETTINGS_DEFAULT_HREF } from '../../components/settings/settings-navigation';

export default function SettingsIndex() {
  return <Redirect href={SETTINGS_DEFAULT_HREF as Href} />;
}
