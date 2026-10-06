import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PortalHost } from '@tallyui/primitives';
import { SessionProvider } from '../lib/auth/session-context';
import { CatalogueProvider } from '../lib/catalogue/catalogue-context';
import { OutboxProvider } from '../lib/sale/outbox-context';
import { RegisterProvider } from '../lib/register/register-context';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <SessionProvider>
        <CatalogueProvider>
          <OutboxProvider>
            <RegisterProvider>
              <Stack screenOptions={{ headerShown: false }} />
              <PortalHost />
            </RegisterProvider>
          </OutboxProvider>
        </CatalogueProvider>
      </SessionProvider>
    </>
  );
}
