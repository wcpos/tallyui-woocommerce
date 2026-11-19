import type { ReceiptTemplate } from '@tallyui/core';
import { renderStoreReceiptTemplate, type PrintableSale, type StoreTemplateContext } from '@tallyui/pos';
import type { StoreTemplatesState } from './use-store-templates';
import { RECEIPT_PAPER_WIDTH, type ReceiptPaperWidth } from './print-receipt';

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
