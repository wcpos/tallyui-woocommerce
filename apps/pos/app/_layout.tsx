import '../global.css';
import { Stack, usePathname, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PortalHost } from '@tallyui/primitives';
import { SessionProvider } from '../lib/auth/session-context';
import { SessionOnlineStatusProvider } from '../lib/online/online-status';
import { OnlineStatusLogger } from '../lib/online/online-status-logger';
import { CatalogueProvider } from '../lib/catalogue/catalogue-context';
import { OutboxProvider } from '../lib/sale/outbox-context';
import { RegisterProvider } from '../lib/register/register-context';
import { UnreadLogsProvider } from '../lib/logs/unread-errors';
import { Toaster } from '../components/toaster';
import { LocalDataResetGate } from '../components/local-data-reset-gate';
import { AppFrame } from '../components/app-rail';
import { UpdateRequiredGate } from '../components/update-required';
import { railNavigation } from '../lib/layout/rail-routes';
import { useIsWide } from '../lib/layout/wide';
import { applyStoredTheme } from '../lib/theme/theme-setting';

// Before the first render: this device's System/Light/Dark choice (Settings > Theme).
applyStoredTheme();

// v2's permanent drawer: the rail on wide windows, beside every signed-in area screen.
function RailFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const wide = useIsWide();
  return <AppFrame wide={wide} pathname={pathname} onNavigate={(from, to) => {
    const step = railNavigation(from, to);
    if (step) router[step.method](step.href as Href);
  }}>{children}</AppFrame>;
}

export default function RootLayout() {
  // v2 clears before hydration, before any provider opens a database.
  return (
    <LocalDataResetGate>
      <StatusBar style="auto" />
      <SessionProvider>
        <SessionOnlineStatusProvider>
          <OnlineStatusLogger />
          <CatalogueProvider>
            <OutboxProvider>
              <RegisterProvider>
                <UnreadLogsProvider>
                  {/* v2 (app)/_layout.tsx:306-322: the gate sits below every provider, so it never unmounts the catalogue. */}
                  <UpdateRequiredGate><RailFrame><Stack screenOptions={{ headerShown: false }} /></RailFrame></UpdateRequiredGate>
                  <PortalHost />
                </UnreadLogsProvider>
              </RegisterProvider>
            </OutboxProvider>
          </CatalogueProvider>
        </SessionOnlineStatusProvider>
      </SessionProvider>
      <Toaster />
    </LocalDataResetGate>
  );
}
