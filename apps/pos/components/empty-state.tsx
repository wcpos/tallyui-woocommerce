import { View } from 'react-native';
import { Button, SearchIcon, Text } from '@tallyui/components';
import { InfoIcon } from './icons';

// v2 empty-state/index.tsx:23-27: each kind's glyph (no app site needs `failed` yet).
const GLYPHS = { empty: ['info', InfoIcon], 'no-results': ['search', SearchIcon] } as const;

/** WCPOS v2's EmptyState (screens/main/components/list-frame): a list's "nothing here" message, with an optional
 *  line under the title and an optional action such as Clear filters. Above the title, unless `inline`, the kind's
 *  glyph at v2's `3xl` (32px) in muted ink (empty-state/index.tsx:62). */
export function EmptyState({ kind, size = 'surface', title, description, action }: {
  kind: keyof typeof GLYPHS; size?: 'surface' | 'inline';
  title: string; description?: string; action?: { label: string; onPress(): void };
}) {
  const [glyph, Glyph] = GLYPHS[kind];
  return (
    <View testID="no-data-message" dataSet={{ kind }} className="flex-1 items-center justify-center gap-2 p-6">
      {size === 'inline' ? null
        : <Glyph testID="no-data-message-glyph" dataSet={{ glyph }} size={32} className="text-muted-foreground" />}
      <Text testID="no-data-message-title" className="text-center font-medium text-foreground">{title}</Text>
      {description ? <Text testID="no-data-message-description" className="text-center text-muted-foreground">{description}</Text> : null}
      {action ? <Button testID="no-data-message-action" variant="ghost" size="sm" onPress={action.onPress}><Text>{action.label}</Text></Button> : null}
    </View>
  );
}
