import type { OrderCreateEnvelope } from '@tallyui/core';
import { createWooCommandTransport, createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { WooCommandTransportOptions } from '@tallyui/connector-woocommerce';
import type { CommandTransport } from '@tallyui/pos';
import type { Session } from '../auth/session';

const connector = createWooCommerceConnector();

export function orderTransport(
  session: Session, getToken: () => string, acceptsPaymentsList?: WooCommandTransportOptions['acceptsPaymentsList'],
): CommandTransport<OrderCreateEnvelope> {
  // G3: WCPOS 1.10.x push (M3-spike-paid-push.md).
  // getToken reads the latest token, because the session refreshes it.
  return createWooCommandTransport({
    baseUrl: session.site.wcposApiUrl,
    getHeaders: () => connector.auth.getHeaders({ token: getToken() }),
    acceptsPaymentsList,
  });
}
