// v2 drawer-content/version.tsx:24-131: the version trigger and Application section.
// Omit {platform} Version (web repeats appVersion; no separate native build number), Server
// (versions unavailable), and Licence and Release notes (WCPOS-specific).
import { useState, type JSX } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Dialog, DialogContent, DialogHeader, DialogTitle, IconButton, Text, XIcon } from '@tallyui/components';
import { SOFTWARE_NAME, SOFTWARE_VERSION } from '../lib/software';

// v2's caption rank: packages/components/src/text/ladder.ts.
const CAPTION = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';
const PLATFORM_LABEL: Partial<Record<string, string>> = { ios: 'iOS', android: 'Android', web: 'Web' };

function InfoRow({ testID, label, value }: { testID: string; label: string; value: string }) {
  return <View testID={testID} className="flex-row justify-between gap-4"><Text className="text-muted-foreground">{label}</Text><Text className="font-mono">{value}</Text></View>;
}

export function VersionAbout({ presentation }: { presentation: 'rail' | 'front' }): JSX.Element {
  const [open, setOpen] = useState(false);
  return <>
    <Pressable testID="drawer-version-button" role="button" onPress={() => setOpen(true)}>
      {presentation === 'rail'
        ? <Text testID="drawer-version" className="py-2 text-center text-xs text-rail-foreground opacity-50">{`v ${SOFTWARE_VERSION}`}</Text>
        : <Text testID="drawer-version" className="px-3 py-2 text-xs text-rail-foreground opacity-50">{`Version ${SOFTWARE_VERSION}`}</Text>}
    </Pressable>
    {open && <Dialog open onOpenChange={setOpen}>
      <DialogContent testID="about-dialog" className="w-80 max-w-full p-4">
        <DialogHeader className="pr-10"><DialogTitle testID="about-dialog-title" className="leading-snug">{`About ${SOFTWARE_NAME}`}</DialogTitle></DialogHeader>
        <View testID="about-dialog-application" className="gap-1">
          <Text className={CAPTION}>Application</Text>
          <InfoRow testID="about-dialog-app-version" label="App Version" value={SOFTWARE_VERSION} />
          <InfoRow testID="about-dialog-platform" label="Platform" value={PLATFORM_LABEL[Platform.OS] ?? Platform.OS} />
        </View>
        <View className="absolute right-1 top-1">
          <IconButton variant="ghost" className="h-11 w-11" testID="about-dialog-close" accessibilityLabel="Close" onPress={() => setOpen(false)}><XIcon size={18} /></IconButton>
        </View>
      </DialogContent>
    </Dialog>}
  </>;
}
