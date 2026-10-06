import type { ServerCapabilities } from '@tallyui/core';

// TallyUI 3.4.0's WooCommerce connector reports orderCreate 5 for every store (TallyUI/tallyui#456), and a WCPOS
// build without v5 charges fails a fee, shipping or custom-line order after payment. Hold orders at v3 until a
// connector release reports what the store accepts; remove this in that bump.
const HELD_ORDER_CREATE = 3;

export function holdCharges(capabilities: ServerCapabilities | undefined): ServerCapabilities | undefined {
  return capabilities && { ...capabilities, orderCreate: Math.min(capabilities.orderCreate, HELD_ORDER_CREATE) };
}
