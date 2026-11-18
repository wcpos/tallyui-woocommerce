import { useContext } from 'react';
import type { JSX } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Button, Dialog, DialogOverlay, DialogPortal, DialogTitle, IconButton, Text, XIcon } from '@tallyui/components';
import { ORDER_NOTE_MAX } from '@tallyui/core';
import { Dialog as DialogPrimitive } from '@tallyui/primitives';
import type { PanelPosition } from '../lib/catalogue/catalogue-view-state';
import { AppRailShown, BESIDE_RAIL } from './app-rail';
import { sideSheet } from './cart-settings';
import { SHEET_TITLE, SheetCloseButton } from './sheet';
import { FieldLabel } from './select-chevron';
import { useIsWide } from '../lib/layout/wide';

// v2's record dialog is `size="xl"` (record-dialog/index.tsx:63), `w-160`: 560 px (dialog/index.tsx:75).
export const ORDER_SHEET = sideSheet('w-[560px]');

export function OrderDetailsSheet({ open, onOpenChange, side, note, onNoteChange, onVoid }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  side: PanelPosition;
  note: string;
  onNoteChange(note: string): void;
  /** Absent: no Void button (nothing to void). */
  onVoid?: () => void;
}): JSX.Element | null {
  const railShown = useContext(AppRailShown);
  const wide = useIsWide();
  if (!open) return null;
  // v2's DialogFooter (dialog/index.tsx:344-398): Void is the `destructive` slot, outline-destructive (red border,
  // foreground label), h-ctl 44 px; on a phone the footer stacks dismiss above the losing button, each full width.
  const close = <SheetCloseButton testID="order-details-close" className={wide ? '' : 'w-full'} onPress={() => onOpenChange(false)} />;
  const voidButton = onVoid && <Button testID="order-details-void" variant="outline" className={`h-11 border-destructive ${wide ? '' : 'w-full'}`}
    onPress={() => { onOpenChange(false); onVoid(); }}><Text testID="order-details-void-label">Void</Text></Button>;
  return <Dialog open onOpenChange={onOpenChange}><DialogPortal>
    <DialogOverlay testID="order-details-overlay" className={railShown && side === 'left' ? BESIDE_RAIL : undefined} />
    <DialogPrimitive.Content testID="order-details" dataSet={{ side }} className={ORDER_SHEET[side](railShown)}>
      <View className="pl-4 pr-11">
        <DialogTitle testID="order-details-title" className={SHEET_TITLE}>Order details</DialogTitle>
      </View>
      <View className="absolute right-1 top-1">
        <IconButton variant="ghost" className="h-11 w-11" testID="order-details-x" accessibilityLabel="Close" onPress={() => onOpenChange(false)}><XIcon size={18} /></IconButton>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="gap-2 px-4 py-1">
        <View testID="order-details-note-row" className="flex-row gap-3 items-start">
          <View className="w-32"><FieldLabel>Customer Note</FieldLabel></View>
          <View className="flex-1">
            {/* TallyUI's Input box; v2's field-box (field-box/index.tsx:10-16): muted placeholder, ring when focused. */}
            <TextInput testID="order-details-note" multiline maxLength={ORDER_NOTE_MAX} placeholder="Add Customer Note"
              accessibilityLabel="Customer Note" value={note} onChangeText={onNoteChange} placeholderTextColorClassName="accent-muted-foreground"
              className="min-h-20 rounded-md border border-input bg-card px-3 py-2 text-base text-foreground web:outline-none web:focus:border-ring web:focus:ring-1 web:focus:ring-ring"
              textAlignVertical="top" />
          </View>
        </View>
      </ScrollView>
      <View testID="order-details-footer" className={`${wide ? 'flex-row items-center' : 'flex-col'} gap-2 border-t border-border px-4 pt-4`}>
        {wide ? <>{voidButton}<View className="flex-1" />{close}</> : <>{close}{voidButton}</>}
      </View>
    </DialogPrimitive.Content>
  </DialogPortal></Dialog>;
}
