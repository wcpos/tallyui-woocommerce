// v2 components/src/error-boundary/fallback-screen.tsx: GateScreen tone="bad" for a route that threw while rendering. No
// Logo (the app has no mark), as not-found-screen.tsx. The words are English constants, as v2's COPY.
import type { JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { Path } from 'react-native-svg';
import type { ErrorBoundaryProps } from 'expo-router';
import { Button, Card, createSvgIcon, Text } from '@tallyui/components';
import { useIsWide } from '../lib/layout/wide';

// v2's tone `bad` glyph, tabler `alert` (components/src/icon/svg/tabler/alert.svg).
const AlertGlyph = createSvgIcon('AlertGlyph', () => <Path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0m9-4v4m0 4h.01" />);

/** v2 DETAIL_MAX: one line of the thrown message, never a wall and never a stack. */
export const DETAIL_MAX = 300;

export function RouteErrorScreen({ error, retry }: ErrorBoundaryProps): JSX.Element {
  const wide = useIsWide();
  const message = error instanceof Error ? error.message : String(error);
  const detail = message.length > DETAIL_MAX ? `${message.slice(0, DETAIL_MAX - 1)}…` : message;
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="grow items-center justify-center p-4">
      <Card testID="error-boundary-screen" className={`w-full max-w-md items-center gap-4 ${wide ? 'p-8' : 'p-4'}`}>
        {/* v2 ToneDisc bad: the app's bad tone is the destructive colour (closure-panel.tsx). */}
        <View className="size-14 items-center justify-center rounded-full bg-destructive/15">
          <AlertGlyph size={28} strokeWidth={1.5} className="text-destructive" />
        </View>
        <Text role="heading" testID="error-boundary-screen-title" className="text-center text-xl font-semibold text-foreground">Something went wrong</Text>
        {detail ? <Text testID="error-boundary-screen-detail" selectable className="w-full rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">{detail}</Text> : null}
        <Button testID="error-boundary-retry" className="w-full" onPress={() => { void retry(); }}><Text>Try again</Text></Button>
      </Card>
    </ScrollView>
  );
}
