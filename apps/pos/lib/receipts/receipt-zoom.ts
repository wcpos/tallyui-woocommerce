import type { ReceiptPaperWidth } from './print-receipt';

// v2's preview zoom steps, 10% to 200% in tens
// (packages/core/src/screens/main/receipt/components/receipt-preview-viewport-utils.ts).
export const PREVIEW_ZOOM_STEPS = [
  10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200,
] as const;
export const MIN_PREVIEW_ZOOM: number = PREVIEW_ZOOM_STEPS[0];
export const MAX_PREVIEW_ZOOM: number = PREVIEW_ZOOM_STEPS[PREVIEW_ZOOM_STEPS.length - 1];

export interface PaperSize { width: number; height: number }

// True paper sizes in CSS px, from v2. The height holds the frame until the receipt has been measured.
export const PAPER_DIMENSIONS: Record<ReceiptPaperWidth, PaperSize> = {
  '58mm': { width: 219, height: 520 },
  '80mm': { width: 302, height: 520 },
};

/** The zoom that fills the available width (v2: the width fits, the height scrolls). A whole percent, rounded
 * down so the frame never overflows by a sub-pixel, bounded by the control's range; 100 when either size is unknown. */
export function pickAutoFitZoom(paperW: number, availW: number): number {
  if (availW <= 0 || paperW <= 0) return 100;
  const fill = Math.floor((availW / paperW) * 100);
  return Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, fill));
}

/** The step above or below a zoom that need not be a step itself (the width fit rarely is). */
export function stepPreviewZoom(zoom: number, delta: 1 | -1): number {
  if (delta > 0) return PREVIEW_ZOOM_STEPS.find(z => z > zoom) ?? MAX_PREVIEW_ZOOM;
  return [...PREVIEW_ZOOM_STEPS].reverse().find(z => z < zoom) ?? MIN_PREVIEW_ZOOM;
}
