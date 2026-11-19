import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import { claimReceiptAutoPrint, installReceiptPrintStyle, nextReceiptArea, printReceipt, RECEIPT_PAPER_WIDTH, type ReceiptPaperWidth } from '../lib/receipts/print-receipt';
import { useReceiptPrintCount } from '../lib/receipts/use-receipt-print-count';

// ready: false holds the auto print until the receipt that will print is on screen.
export function ReceiptPrintSheet({ orderId, paperWidth = RECEIPT_PAPER_WIDTH, autoPrint = false, ready = true, printAgain = true, onAutoPrinted, children }: {
  orderId: string | null; paperWidth?: ReceiptPaperWidth; autoPrint?: boolean; ready?: boolean; printAgain?: boolean; onAutoPrinted?: () => void; children: ReactNode;
}): JSX.Element {
  const [area] = useState(nextReceiptArea);
  useEffect(() => installReceiptPrintStyle(area, paperWidth), [area, paperWidth]);
  const printed = useReceiptPrintCount(orderId) > 0;
  const [error, setError] = useState<string | null>(null);
  // Declared after the style effect, so the @page style is installed before the auto print.
  useEffect(() => {
    if (!autoPrint || !ready || orderId === null || !claimReceiptAutoPrint(orderId)) return;
    const failure = printReceipt();
    setError(failure);
    if (failure === null) onAutoPrinted?.();
  }, [autoPrint, ready, orderId]);
  // TallyUI's Receipt keeps its own "Print receipt" button; v2 relabels that button "Print again" (receipt/print-sheet.tsx).
  // A child that owns its print button (the store receipt) turns printAgain off. Outline: New sale alone is filled, as v2.
  return (
    <View testID="receipt-print-area" dataSet={{ print: 'receipt', receipt: area }}>
      {children}
      {(printed || error !== null) && <View dataSet={{ print: 'hide' }} className="gap-2 py-2">
        {error && <Text testID="print-sheet-error" accessibilityRole="alert" className="text-destructive">{error}</Text>}
        {printAgain && <Button variant="outline" testID="receipt-print-again" onPress={() => setError(printReceipt())}><Text>Print again</Text></Button>}
      </View>}
    </View>
  );
}
