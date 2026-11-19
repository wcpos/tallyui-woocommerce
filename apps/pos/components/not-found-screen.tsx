// v2 apps/main/app/+not-found.tsx:14-24: GateScreen tone="muted" icon="help" for an address no route matches. `/` is
// session-neutral (the register when signed in, Connect when not), so the action says "the start". No Logo (the app has
// no mark), as update-required.tsx.
import type { JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { Button, Card, createSvgIcon, Text } from '@tallyui/components';
import { useIsWide } from '../lib/layout/wide';

// v2's `help` glyph, tabler `help-circle` (components/src/icon/svg/tabler/help.svg).
const HelpGlyph = createSvgIcon('HelpGlyph', () => <>
  <Path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0m9 4v.01" /><Path d="M12 13a2 2 0 0 0 .914-3.782a1.98 1.98 0 0 0-2.414.483" />
</>);

export function NotFoundScreen(): JSX.Element {
  const wide = useIsWide();
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="grow items-center justify-center p-4">
      <Card testID="not-found-screen" className={`w-full max-w-md items-center gap-4 ${wide ? 'p-8' : 'p-4'}`}>
        {/* v2 ToneDisc muted: bg-muted disc, text-muted-foreground glyph (lib/tone.ts). */}
        <View className="size-14 items-center justify-center rounded-full bg-muted">
          <HelpGlyph size={28} strokeWidth={1.5} className="text-muted-foreground" />
        </View>
        {/* v2 core.json gate.not_found.title / .description / .action. */}
        <Text role="heading" testID="not-found-screen-title" className="text-center text-xl font-semibold text-foreground">This screen doesn't exist.</Text>
        <Text testID="not-found-screen-description" className="text-center text-muted-foreground">The address may be out of date.</Text>
        <Button testID="not-found-screen-primary" className="w-full" onPress={() => router.replace('/')}><Text>Back to the start</Text></Button>
      </Card>
    </ScrollView>
  );
}
