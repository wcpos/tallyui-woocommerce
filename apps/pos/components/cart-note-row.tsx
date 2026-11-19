import { useState } from 'react';
import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Path } from 'react-native-svg';
import { createSvgIcon, Text, usePointer } from '@tallyui/components';

// v2's tabler `note` and `edit` glyphs (monorepo packages/components/src/icon/svg/tabler/note.svg, edit.svg).
const NoteIcon = createSvgIcon('NoteIcon', () => <Path d="m13 20l7-7m-7 7v-6a1 1 0 0 1 1-1h6V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />);
const EditIcon = createSvgIcon('EditIcon', () => <><Path d="M7 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1" />
  <Path d="M20.385 6.585a2.1 2.1 0 0 0-2.97-2.97L9 12v3h3zM16 5l3 3" /></>);

/**
 * v2's cart note row (pos/cart/note-row.tsx:24-66): the order note, quiet at rest, ruled off above. A fine-pointer
 * hover or a keyboard focus washes the row, steps the text up to the foreground and fades in the edit glyph; on a
 * coarse pointer the edit glyph is always there. The press opens Order details, where the note is edited.
 */
export function CartNoteRow({ note, onPress }: { note: string; onPress(): void }): JSX.Element | null {
  // Hover and focus kept apart, as v2: a pointer leaving a row the keyboard holds must not drop it.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const pointer = usePointer();
  if (!note.trim()) return null;
  const reached = hovered || focused;
  const tint = `${reached ? 'text-foreground' : 'text-muted-foreground'} web:transition-colors web:duration-150`;
  return <View className="border-t border-border px-2 pt-2">
    {/* Drawn at 36, hit at 44 (v2's `minTarget`). */}
    <Pressable testID="cart-note-row" accessibilityRole="button" hitSlop={4} onPress={onPress}
      onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      className={`min-h-9 flex-row items-center gap-2 rounded-lg px-2 web:transition-colors web:duration-150 ${reached ? 'bg-accent' : ''}`}>
      <NoteIcon size={18} strokeWidth={1.5} className={tint} />
      <Text numberOfLines={1} className={`min-w-0 flex-1 ${tint}`}>{note}</Text>
      <EditIcon size={16} strokeWidth={1.5} className={`text-muted-foreground web:transition-opacity web:duration-150 ${reached || pointer === 'coarse' ? 'opacity-100' : 'opacity-0'}`} />
    </Pressable>
  </View>;
}
