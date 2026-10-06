import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import type { Session } from '../auth/session';

export function orderTransport(_session: Session): CommandTransport<OrderCreateEnvelope> | null {
  // G3's WooCommerce CommandTransport in @tallyui/connector-woocommerce plugs in here.
  // Until then no sale can be sent, so the app takes none (M3-spike-paid-push.md).
  return null;
}
