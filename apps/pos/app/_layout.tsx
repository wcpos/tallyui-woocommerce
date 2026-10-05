import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '../lib/auth/session-context';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <SessionProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SessionProvider>
    </>
  );
}
