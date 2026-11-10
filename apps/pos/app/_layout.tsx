import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PortalHost } from '@tallyui/primitives';
import { SessionProvider } from '../lib/auth/session-context';
import { SessionOnlineStatusProvider } from '../lib/online/online-status';
import { CatalogueProvider } from '../lib/catalogue/catalogue-context';
import { OutboxProvider } from '../lib/sale/outbox-context';
import { RegisterProvider } from '../lib/register/register-context';
import { Toaster } from '../components/toaster';
import { applyStoredTheme } from '../lib/theme/theme-setting';

// Before the first render: this device's System/Light/Dark choice (Settings > Theme).
applyStoredTheme();

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <SessionProvider>
        <SessionOnlineStatusProvider>
          <CatalogueProvider>
            <OutboxProvider>
              <RegisterProvider>
                <Stack screenOptions={{ headerShown: false }} />
                <PortalHost />
              </RegisterProvider>
            </OutboxProvider>
          </CatalogueProvider>
        </SessionOnlineStatusProvider>
      </SessionProvider>
      <Toaster />
    </>
  );
}
