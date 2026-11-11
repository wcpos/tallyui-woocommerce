import { Redirect } from 'expo-router';

// v2 health/index.tsx: the area opens on Database.
export default function HealthIndex() {
  return <Redirect href="/health/database" />;
}
