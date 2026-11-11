import { Redirect } from 'expo-router';

// Logs moved under Store health (v2 /health/logs); old links still land there.
export default function LogsRedirect() {
  return <Redirect href="/health/logs" />;
}
