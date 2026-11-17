import type { ReceiptTemplate } from '@tallyui/core';
import { renderStoreReceiptTemplate, type PrintableSale, type StoreTemplateContext } from '@tallyui/pos';
import type { StoreTemplatesState } from './use-store-templates';

// v2 takes Pro's active template, else the lowest menu_order; the connector exposes neither, so its order stands.
export function pickReceiptTemplate(templates: ReceiptTemplate[]): ReceiptTemplate | null {
  return templates[0] ?? null;
}

/** The store's receipt template rendered to HTML (thermal bodies through their preview), or null for the built-in receipt. */
export function renderedStoreReceipt(state: StoreTemplatesState, sale: PrintableSale, context: StoreTemplateContext): string | null {
  const template = state.status === 'ready' ? pickReceiptTemplate(state.templates) : null;
  if (!template) return null;
  try {
    return renderStoreReceiptTemplate(template, sale, context);
  } catch {
    return null;
  }
}
