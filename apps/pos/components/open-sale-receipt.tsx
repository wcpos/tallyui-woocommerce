import { useContext, type JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle, IconButton, Receipt, Text, XIcon } from '@tallyui/components';
import { useFormatMoney } from '@tallyui/core';
import { buildReceiptData, type ReceiptConfig, type SentOrder } from '@tallyui/pos';
import { Dialog as DialogPrimitive } from '@tallyui/primitives';
import type { PanelPosition } from '../lib/catalogue/catalogue-view-state';
import { AppRailShown, BESIDE_RAIL } from './app-rail';
import { ORDER_SHEET } from './order-details-sheet';
import { ReceiptPrintSheet } from './receipt-print-sheet';
import { ReceiptZoom } from './receipt-zoom';
import { SHEET_TITLE } from './sheet';

// v2 receipt/receipt.tsx:68-100 and order-sheet.tsx:75-82: preview the unpaid bill without auto printing.
export function OpenSaleReceipt({ open, onClose, side, order, config }: {
  open: boolean; onClose(): void; side: PanelPosition; order: SentOrder; config: ReceiptConfig;
}): JSX.Element | null {
  const formatMoney = useFormatMoney();
  const railShown = useContext(AppRailShown);
  if (!open) return null;
  const data = buildReceiptData(order, config);
  const receipt = { ...data, header: { ...data.header, orderNumber: `${order.id.slice(-8)} (draft)` } };
  const dueMinor = receipt.totals.totalMinor - receipt.payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
  const money = formatMoney({ amount: dueMinor, currency: receipt.currency }) ?? String(dueMinor);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogPortal>
    <DialogOverlay className={railShown && side === 'left' ? BESIDE_RAIL : undefined} />
    <DialogPrimitive.Content testID="open-sale-receipt" dataSet={{ side }} className={ORDER_SHEET[side](railShown)}>
      <View className="pl-4 pr-11">
        <DialogTitle testID="open-sale-receipt-title" className={SHEET_TITLE}>Receipt</DialogTitle>
      </View>
      <View className="absolute right-1 top-1">
        <IconButton variant="ghost" className="h-11 w-11" testID="open-sale-receipt-x" accessibilityLabel="Close" onPress={() => onClose()}><XIcon size={18} /></IconButton>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="gap-2 px-4 py-1">
        {dueMinor > 0 && <Text testID="receipt-not-paid" className="pb-2 text-sm text-warning-text">{`Not paid · ${money} due`}</Text>}
        <ReceiptZoom><ReceiptPrintSheet orderId={null}>
          <Receipt receipt={receipt} newSale={() => onClose()} doneLabel="Close" />
        </ReceiptPrintSheet></ReceiptZoom>
      </ScrollView>
    </DialogPrimitive.Content>
  </DialogPortal></Dialog>;
}
