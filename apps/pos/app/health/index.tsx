import { Redirect } from 'expo-router';
import { useIsWide } from '../../lib/layout/wide';

// v2 health/index.tsx (`NavigationAreaIndex`): wide opens on Database; a phone stays here, where the layout draws the page list.
export default function HealthIndex() {
  return useIsWide() ? <Redirect href="/health/database" /> : null;
}
