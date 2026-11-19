import type { JSX } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle, IconButton, Text, XIcon } from '@tallyui/components';
import { Dialog as DialogPrimitive } from '@tallyui/primitives';
import { chordPlatform, keycaps, pressChord, TILL_CHORDS, type TillChordId } from '../lib/sale/till-chords';
import { CART_SHEET } from './cart-settings';
import { SHEET_TITLE, SheetCloseButton } from './sheet';

/** v2's HelpSheet (hotkeys/help-sheet.tsx:30-97): the shell's side, always right, size lg; every chord's MenuRow with
 *  its keycaps, dimmed (pressable-surface opacity-45) when its command cannot run, and a row runs what its key does. */
export function KeyboardShortcutsSheet({ open, onOpenChange, enabled }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  enabled: Record<TillChordId, boolean>;
}): JSX.Element | null {
  if (!open) return null;
  const platform = chordPlatform();
  const close = () => onOpenChange(false);
  // v2: after the close commits, or the open sheet would pull a focused search back into itself.
  const run = (code: string) => { close(); setTimeout(() => pressChord(code)); };
  return <Dialog open onOpenChange={onOpenChange}><DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content testID="hotkeys-help-sheet" className={CART_SHEET.right(false)}>
      <View className="pl-4 pr-11"><DialogTitle testID="hotkeys-help-title" className={SHEET_TITLE}>Keyboard shortcuts</DialogTitle></View>
      <View className="absolute right-1 top-1">
        <IconButton variant="ghost" className="h-11 w-11" testID="hotkeys-help-x" accessibilityLabel="Close" onPress={close}><XIcon size={18} /></IconButton>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="px-2 py-1">
        {TILL_CHORDS.map(({ id, label, code, key }) => <Pressable key={id} testID={`hotkeys-help-row-${id}`} role="button"
          disabled={!enabled[id]} onPress={() => run(code)}
          className={`min-h-11 w-full flex-row items-center gap-2 rounded-md px-2.5 py-1.5 web:hover:bg-accent active:bg-accent ${enabled[id] ? '' : 'opacity-45'}`}>
          <Text numberOfLines={1} className="min-w-0 flex-1 text-base text-foreground">{label}</Text>
          <View className="flex-row gap-1">{keycaps(key, platform).map(cap => <Text key={cap}
            className="min-w-7 rounded-md border border-border bg-muted px-1.5 text-center text-muted-foreground">{cap}</Text>)}</View>
        </Pressable>)}
      </ScrollView>
      {/* v2: Alt+F and Alt+D collide with Firefox's menu mnemonics on Windows only; on a Mac the note would mislead. */}
      {platform !== 'mac' && <Text testID="hotkeys-help-firefox-note" className="px-4 text-sm text-muted-foreground">
        On Windows, Alt+F and Alt+D may also open the Firefox menu.</Text>}
      <View className="flex-row justify-end border-t border-border px-4 pt-4"><SheetCloseButton testID="hotkeys-help-close" onPress={close} /></View>
    </DialogPrimitive.Content>
  </DialogPortal></Dialog>;
}
