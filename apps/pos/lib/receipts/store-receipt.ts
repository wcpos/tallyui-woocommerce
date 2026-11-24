import type { ReceiptTemplate } from '@tallyui/core';
import { renderStoreReceiptTemplate, type PrintableSale, type StoreTemplateContext } from '@tallyui/pos';
import type { StoreInfo } from '../catalogue/store-info';
import type { StoreTemplatesState } from './use-store-templates';
import { RECEIPT_PAPER_WIDTH, type ReceiptPaperWidth } from './print-receipt';

export type StoreReceiptTax = Pick<StoreInfo, 'taxTotalDisplay' | 'taxDisplayCart' | 'calcTaxes'>;

// v2 cart/totals/taxes.tsx:24 and build-receipt-data.ts; omit undefined keys because the library spreads the override over its stand-ins.
export function receiptStoreTax(tax: StoreReceiptTax | undefined): StoreTemplateContext['store'] {
  return {
    ...(tax?.taxTotalDisplay !== undefined ? { taxTotalDisplay: tax.taxTotalDisplay } : {}),
    ...(tax?.taxDisplayCart !== undefined ? { taxDisplayCart: tax.taxDisplayCart } : {}),
    ...(tax?.calcTaxes !== undefined ? { calcTaxes: tax.calcTaxes } : {}),
  };
}

// v2 takes Pro's active template, else the lowest menu_order; the connector exposes neither, so its order stands.
// The cashier's pick (v2's template switcher) wins while it names a served template.
export function pickReceiptTemplate(templates: ReceiptTemplate[], selectedId?: string | null): ReceiptTemplate | null {
  return templates.find(template => template.id === selectedId) ?? templates[0] ?? null;
}

/** v2's getReceiptPreviewPaperWidth (receipt-preview-viewport-utils.ts:29-37): the template's paper, else 80 mm for a
 * thermal (escpos) body and A4 for html. The connector keeps paper for thermal only, so html is always A4 here. */
export function receiptPaperWidth(template: ReceiptTemplate | null): ReceiptPaperWidth {
  if (!template) return RECEIPT_PAPER_WIDTH;
  return template.paper ?? (template.engine === 'thermal' ? '80mm' : 'a4');
}

/** v2's thermal paper frame (printer/src/raster/receipt-rasterizer.dom.tsx:56-77, from template-studio styles.css:356-385):
 * the iframe body is the paper, and the renderer's inline-styled thermal div is flattened to fill it with v2's thermal
 * type. The body margin is the iframe's default; #fff is studio's --ts-paper (styles.css:15). None for an A4 template. */
export function thermalFitCss(paper: ReceiptPaperWidth): string {
  if (paper === 'a4') return '';
  return `body { margin: 0; background: #fff; font-family: ui-monospace, 'SFMono-Regular', 'Menlo', monospace; color: #1c1814; padding: 4mm 2mm; font-size: 11.5px; }
body > div { box-shadow: none !important; margin: 0 !important; padding: 0 !important; background: transparent !important; width: 100% !important; font-size: ${paper === '58mm' ? '10.5px' : '10px'} !important; }`;
}

/** v2 keys the pick on its order (use-template-renderer.ts:267-285): a new sale starts on the default again. */
export function receiptTemplateIdFor(pick: { orderId: string; id: string } | null, orderId: string): string | null {
  return pick?.orderId === orderId ? pick.id : null;
}

/** The store's receipt template rendered to HTML (thermal bodies through their preview), or null for the built-in receipt. */
export function renderedStoreReceipt(state: StoreTemplatesState, sale: PrintableSale, context: StoreTemplateContext,
  selectedId?: string | null): string | null {
  const template = state.status === 'ready' ? pickReceiptTemplate(state.templates, selectedId) : null;
  if (!template) return null;
  try {
    return renderStoreReceiptTemplate(template, sale, context);
  } catch {
    return null;
  }
}
