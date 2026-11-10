import { useState, type JSX, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@tallyui/components';
import { RECEIPT_PAPER_WIDTH, type ReceiptPaperWidth } from '../lib/receipts/print-receipt';
import { MAX_PREVIEW_ZOOM, MIN_PREVIEW_ZOOM, PAPER_DIMENSIONS, pickAutoFitZoom, stepPreviewZoom } from '../lib/receipts/receipt-zoom';

// v2's scroll-area padding (receipt-preview-viewport.web.tsx CANVAS_PAD_PX).
const CANVAS_PAD_PX = 12;
// The width fit leaves the padding and the 1px border on each side.
const FIT_INSET_PX = CANVAS_PAD_PX * 2 + 2;

/** v2's receipt preview: a paper-size canvas that fits the pane's width, with Zoom in / Zoom out. Screen only:
 * it wraps the print area from outside, where the receipt print CSS resets its scale and hides its controls. */
export function ReceiptZoom({ children, paperWidth = RECEIPT_PAPER_WIDTH, testID = 'receipt-preview' }: {
  children: ReactNode; paperWidth?: ReceiptPaperWidth; testID?: string;
}): JSX.Element {
  const paper = PAPER_DIMENSIONS[paperWidth];
  const [availWidth, setAvailWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  // Null until the user presses a control; after that the width fit no longer applies, as in v2.
  const [picked, setPicked] = useState<number | null>(null);
  const zoom = picked ?? pickAutoFitZoom(paper.width, availWidth);
  const scale = zoom / 100;
  const canZoomOut = zoom > MIN_PREVIEW_ZOOM;
  const canZoomIn = zoom < MAX_PREVIEW_ZOOM;
  const step = (delta: 1 | -1) => setPicked(stepPreviewZoom(zoom, delta));
  return (
    <View testID={testID} onLayout={e => setAvailWidth(e.nativeEvent.layout.width - FIT_INSET_PX)}
      className="relative min-h-0 flex-1 rounded-md border border-border bg-muted">
      <View testID={`${testID}-zoom-controls`} dataSet={{ print: 'hide' }}
        className="absolute right-2 top-2 z-10 flex-row items-stretch overflow-hidden rounded-lg border border-border bg-background">
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" disabled={!canZoomOut} onPress={() => step(-1)}
          className="h-7 w-7 items-center justify-center hover:bg-accent">
          <Text className={canZoomOut ? 'text-base text-foreground' : 'text-base text-muted-foreground'}>{'−'}</Text>
        </Pressable>
        <View className="min-w-[44px] items-center justify-center border-l border-r border-border px-2">
          <Text testID={`${testID}-zoom-value`} role="status" aria-live="polite" className="text-xs text-foreground"
            style={{ fontVariant: ['tabular-nums'] }}>{`${zoom}%`}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" disabled={!canZoomIn} onPress={() => step(1)}
          className="h-7 w-7 items-center justify-center hover:bg-accent">
          <Text className={canZoomIn ? 'text-base text-foreground' : 'text-base text-muted-foreground'}>+</Text>
        </Pressable>
      </View>
      <ScrollView testID={`${testID}-scroll-area`} className="min-h-0 flex-1" contentContainerStyle={{ padding: CANVAS_PAD_PX }}>
        <ScrollView horizontal contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <View testID={`${testID}-canvas-frame`} className="overflow-hidden bg-card shadow-sm"
            style={{ width: paper.width * scale, height: (contentHeight ?? paper.height) * scale }}>
            <View testID={`${testID}-canvas`} onLayout={e => setContentHeight(e.nativeEvent.layout.height)}
              style={{ width: paper.width, transform: [{ scale }], transformOrigin: 'top left' }}>
              {children}
            </View>
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}
