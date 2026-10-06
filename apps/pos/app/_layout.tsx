import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '../lib/auth/session-context';
import { CatalogueProvider } from '../lib/catalogue/catalogue-context';
import { OutboxProvider } from '../lib/sale/outbox-context';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <SessionProvider>
        <CatalogueProvider>
          <OutboxProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </OutboxProvider>
        </CatalogueProvider>
      </SessionProvider>
    </>
  );
}
