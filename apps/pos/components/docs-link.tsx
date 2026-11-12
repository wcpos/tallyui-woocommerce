import type { JSX } from 'react';
import { Linking, View } from 'react-native';
import { Path } from 'react-native-svg';
import { Button, createSvgIcon, Text } from '@tallyui/components';

export const PRINTER_DOCS_URL = 'https://docs.wcpos.com/hardware/printers'; // v2 settings/printer/printer-docs.ts:2

// v2's tabler `openExternal` glyph at its 1.5 stroke (components icon/components/tabler/openExternal.tsx:14).
const OpenExternalIcon = createSvgIcon('OpenExternalIcon', () => <Path d="M12 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6m-7 1 9-9m-5 0h5v5" />);

/** v2 components/docs-link/index.tsx: the one way the app links out to documentation, opened in the system browser. */
export function DocsLink({ href, children, testID, className }: {
  href: string; children: string; testID?: string; className?: string;
}): JSX.Element {
  return (
    <Button variant="link" size="sm" accessibilityRole="link" testID={testID}
      className={className ? `h-auto self-start px-0 py-0 ${className}` : 'h-auto self-start px-0 py-0'}
      onPress={() => { void Linking.openURL(href); }}>
      {/* v2 docs-link/index.tsx:38-47: the label, then the ↗ at Icon size `xs` (size-3.5: 14) in an xs (gap-1) HStack. */}
      <View className="flex-row items-center gap-1">
        <Text>{children}</Text>
        <OpenExternalIcon testID={testID ? `${testID}-icon` : undefined} size={14} strokeWidth={1.5} className="text-primary" />
      </View>
    </Button>
  );
}
