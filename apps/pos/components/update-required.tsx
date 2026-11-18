// v2 core screens/main/update-required.tsx (GateScreen tone="warning", components gate-screen/index.tsx): the store's 426
// wcpos_update_required refusal, this app older than the store's plugin accepts. No Logo (the app has no mark) and no
// docs link (the app has no error-code docs).
import type { JSX, ReactNode } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Path } from 'react-native-svg';
import { Button, Card, createSvgIcon, Text } from '@tallyui/components';
import { useSession } from '../lib/auth/session-context';
import { useCatalogue } from '../lib/catalogue/catalogue-context';
import { useIsWide } from '../lib/layout/wide';

// v2 tone-disc warning glyph (tabler `warning`).
const WarningGlyph = createSvgIcon('WarningGlyph', () => <Path d="M12 9v4m-1.637-9.409L2.257 17.125a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87L13.637 3.59a1.914 1.914 0 0 0-3.274 0M12 16h.01" />);

/** True only for the connector's 426 till-update refusal; a `fixedBy: 'till'` sign-in notice is not one. */
export function isTillUpdateRequired(notice?: { code: string; fixedBy?: string }): boolean {
  return notice?.code === 'till_update_required' && notice.fixedBy === 'till';
}

export function UpdateRequired({ onLogout }: { onLogout(): void }): JSX.Element {
  const wide = useIsWide();
  const web = Platform.OS === 'web';
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="grow items-center justify-center p-4">
      <Card testID="update-required-screen" className={`w-full max-w-md items-center gap-4 ${wide ? 'p-8' : 'p-4'}`}>
        <View className="size-14 items-center justify-center rounded-full bg-warning-bg">
          <WarningGlyph size={28} strokeWidth={1.5} className="text-warning-text" />
        </View>
        <Text role="heading" testID="update-required-title" className="text-center text-xl font-semibold text-foreground">Update the POS app on this device.</Text>
        {/* v2 core.json gate.update_app.web / gate.update_app.native. */}
        <Text testID="update-required-description" className="text-center text-muted-foreground">{web
          ? 'The WCPOS plugin on your WordPress site is newer than the app in this tab. Reload the page to load the latest version.'
          : 'The WCPOS plugin on your WordPress site is newer than this app. Install the WCPOS app update on this device, then open it again. Unsent sales stay on this device.'}</Text>
        <View className="w-full gap-2">
          {web && <Button testID="update-required-reload" className="w-full" onPress={() => window.location.reload()}><Text>Reload</Text></Button>}
          <Button variant="outline" testID="update-required-logout" className="w-full" onPress={onLogout}><Text>Log out</Text></Button>
        </View>
      </Card>
    </ScrollView>
  );
}

/** v2 (app)/_layout.tsx:306-322 UpdateRequiredGate: below the catalogue, so it swaps only the screens, never the engine. */
export function UpdateRequiredGate({ children }: { children: ReactNode }): JSX.Element {
  const { notice } = useCatalogue();
  const { signOut } = useSession();
  return isTillUpdateRequired(notice) ? <UpdateRequired onLogout={signOut} /> : <>{children}</>;
}
