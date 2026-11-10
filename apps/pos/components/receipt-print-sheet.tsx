import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import { installReceiptPrintStyle, nextReceiptArea, printReceipt, RECEIPT_PAPER_WIDTH, type ReceiptPaperWidth } from '../lib/receipts/print-receipt';
import { useReceiptPrintCount } from '../lib/receipts/use-receipt-print-count';

export function ReceiptPrintSheet({ orderId, paperWidth = RECEIPT_PAPER_WIDTH, children }: {
  orderId: string | null; paperWidth?: ReceiptPaperWidth; children: ReactNode;
}): JSX.Element {
  const [area] = useState(nextReceiptArea);
  useEffect(() => installReceiptPrintStyle(area, paperWidth), [area, paperWidth]);
  const printed = useReceiptPrintCount(orderId) > 0;
  const [error, setError] = useState<string | null>(null);
  // TallyUI's Receipt keeps its own "Print receipt" button; v2 relabels that button "Print again" (receipt/print-sheet.tsx).
  return (
    <View testID="receipt-print-area" dataSet={{ print: 'receipt', receipt: area }}>
      {children}
      {printed && <View dataSet={{ print: 'hide' }} className="gap-2 py-2">
        {error && <Text testID="print-sheet-error" accessibilityRole="alert" className="text-destructive">{error}</Text>}
        <Button testID="receipt-print-again" onPress={() => setError(printReceipt())}><Text>Print again</Text></Button>
      </View>}
    </View>
  );
}
