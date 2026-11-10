export type ReceiptPaperWidth = '58mm' | '80mm';

// v2 takes the width from the selected receipt template's paper_width (58mm, 80mm or a4;
// packages/printer/src/print-html.ts). This app has no templates or printer settings yet,
// so every receipt prints at 80 mm, the common thermal roll. A device setting replaces this.
export const RECEIPT_PAPER_WIDTH: ReceiptPaperWidth = '80mm';

// The NO_CLOSURE prefix lets a mounted closure document print instead.
const NO_CLOSURE = ':root:not(:has([data-print="closure"]))';
let areas = 0;
// Each mounted receipt sheet prints from its own area, so a receipt left on a hidden stack screen never prints with another.
export function nextReceiptArea(): string { areas += 1; return `receipt-${areas}`; }
const active: HTMLStyleElement[] = [];
function refresh() { active.forEach((style, index) => { style.media = index === active.length - 1 ? 'all' : 'not all'; }); }

// size: auto uses the printer's thermal roll; 80mm auto is invalid and 80mm alone is an 80 mm square.
// jsdom cannot compute styles while any @page rule is mounted, so it is installed only between beforeprint and afterprint.
export const RECEIPT_PAGE_CSS = '@page { size: auto; margin: 0; }';

export function receiptPrintCss(paperWidth: ReceiptPaperWidth, area: string): string {
  const AREA = `[data-receipt="${area}"]`;
  return `
@media print {
  ${NO_CLOSURE}:has(${AREA}), ${NO_CLOSURE} :has(${AREA}) { display: block !important; position: static !important; width: auto !important; min-width: 0 !important; max-width: none !important; height: auto !important; min-height: 0 !important; max-height: none !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; border: 0 !important; transform: none !important; background: #fff !important; }
  ${NO_CLOSURE} :has(${AREA}) > :not(:has(${AREA})):not(${AREA}), ${NO_CLOSURE} ${AREA} [data-print="hide"] { display: none !important; }
  ${NO_CLOSURE} ${AREA} { display: block !important; width: ${paperWidth} !important; max-width: ${paperWidth} !important; margin: 0 auto !important; background: #fff !important; }
  ${NO_CLOSURE} ${AREA} * { color: #000 !important; background-color: transparent !important; border-color: #000 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;
}

export function installReceiptPrintStyle(area: string, paperWidth: ReceiptPaperWidth = RECEIPT_PAPER_WIDTH): () => void {
  if (typeof document === 'undefined') return () => {};
  const style = document.createElement('style');
  style.setAttribute('data-receipt-print', paperWidth);
  style.textContent = receiptPrintCss(paperWidth, area);
  document.head.appendChild(style);
  active.push(style); refresh();
  const page = document.createElement('style');
  page.setAttribute('data-receipt-page', '');
  page.textContent = RECEIPT_PAGE_CSS;
  // A mounted closure document prints with its own margins, as the receipt CSS already steps aside for it.
  const beforeprint = () => {
    if (active[active.length - 1] === style && !page.isConnected && !document.querySelector('[data-print="closure"]')) document.head.appendChild(page);
  };
  const afterprint = () => page.remove();
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('beforeprint', beforeprint); window.addEventListener('afterprint', afterprint);
  }
  return () => {
    if (typeof window.addEventListener === 'function') {
      window.removeEventListener('beforeprint', beforeprint); window.removeEventListener('afterprint', afterprint);
    }
    page.remove(); style.remove(); const index = active.indexOf(style); if (index >= 0) active.splice(index, 1); refresh();
  };
}

export function printReceipt(): string | null {
  if (typeof window === 'undefined' || typeof window.print !== 'function') return 'This browser cannot open the print dialog.';
  try {
    window.print();
    return null;
  } catch (error) {
    return `The receipt did not print: ${error instanceof Error ? error.message : String(error)}`;
  }
}
