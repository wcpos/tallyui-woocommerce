import { useContext } from 'react';
import type { JSX } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Button, Dialog, DialogOverlay, DialogPortal, DialogTitle, IconButton, Text, XIcon } from '@tallyui/components';
import { ORDER_NOTE_MAX } from '@tallyui/core';
import { Dialog as DialogPrimitive } from '@tallyui/primitives';
import type { PanelPosition } from '../lib/catalogue/catalogue-view-state';
import { AppRailShown, BESIDE_RAIL } from './app-rail';
import { CART_SHEET, SCRIM } from './cart-settings';
import { SHEET_TITLE } from './catalogue-display-options';
import { FieldLabel } from './select-chevron';

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
  if (!open) return null;
  return <Dialog open onOpenChange={onOpenChange}><DialogPortal>
    <DialogOverlay testID="order-details-overlay" className={SCRIM + (railShown && side === 'left' ? ' ' + BESIDE_RAIL : '')} />
    <DialogPrimitive.Content testID="order-details" dataSet={{ side }} className={CART_SHEET[side](railShown)}>
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
            <TextInput testID="order-details-note" multiline maxLength={ORDER_NOTE_MAX} placeholder="Add Customer Note"
              accessibilityLabel="Customer Note" value={note} onChangeText={onNoteChange}
              className="min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground web:focus:border-primary"
              textAlignVertical="top" />
          </View>
        </View>
      </ScrollView>
      <View testID="order-details-footer" className="flex-row items-center gap-2 border-t border-border px-4 pt-4">
        {onVoid && <Button testID="order-details-void" variant="outline" className="border-destructive"
          onPress={() => { onOpenChange(false); onVoid(); }}><Text className="text-destructive">Void</Text></Button>}
        <View className="flex-1" />
        <Button testID="order-details-close" variant="outline" onPress={() => onOpenChange(false)}><Text>Close</Text></Button>
      </View>
    </DialogPrimitive.Content>
  </DialogPortal></Dialog>;
}
