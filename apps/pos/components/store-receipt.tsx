import { useEffect, useRef, useState, type JSX } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import { printReceipt } from '../lib/receipts/print-receipt';

/**
 * The store's own receipt template (web only). The frame is sandboxed without scripts, so the template's markup and CSS
 * stay inside it; it grows to its content on load, on a width change and before a print, so nothing is clipped on paper.
 */
export function StoreReceipt({ html, doneLabel, onDone, onLoad, printed = false }: {
  html: string; doneLabel: string; onDone(): void; onLoad(): void; printed?: boolean;
}): JSX.Element {
  const frame = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [printedHere, setPrintedHere] = useState(false);
  const print = () => {
    const failure = printReceipt();
    setError(failure);
    if (failure === null) setPrintedHere(true);
  };
  const fit = () => {
    const doc = frame.current?.contentDocument;
    if (frame.current && doc) frame.current.style.height = `${doc.documentElement.scrollHeight}px`;
  };
  useEffect(() => {
    window.addEventListener('beforeprint', fit);
    // A frame that loads while hidden (the phone layout's Cart tab) measures 0; refit when its width changes.
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    if (frame.current) resize?.observe(frame.current);
    return () => { window.removeEventListener('beforeprint', fit); resize?.disconnect(); };
  }, []);
  return (
    <View>
      <iframe ref={frame} data-testid="store-receipt-frame" sandbox="allow-same-origin" srcDoc={html} title="Receipt"
        style={{ width: '100%', border: 0, display: 'block' }} onLoad={() => { fit(); onLoad(); }} />
      <View dataSet={{ print: 'hide' }} className="gap-2 py-2">
        {error && <Text testID="store-receipt-error" accessibilityRole="alert" className="text-destructive">{error}</Text>}
        <View className="flex-row gap-4">
          {/* v2 relabels its one print choice once printed, and keeps it outline: New sale alone is filled (receipt-stage.tsx:184-189). */}
          <Button variant="outline" testID="store-receipt-print" onPress={print}><Text>{printed || printedHere ? 'Print again' : 'Print receipt'}</Text></Button>
          <Button testID="store-receipt-done" onPress={onDone}><Text>{doneLabel}</Text></Button>
        </View>
      </View>
    </View>
  );
}
