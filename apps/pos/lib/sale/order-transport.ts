import type { OrderCreateEnvelope } from '@tallyui/core';
import { createWooCommandTransport, createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { WooCommandTransportOptions } from '@tallyui/connector-woocommerce';
import type { CommandTransport } from '@tallyui/pos';
import type { Session } from '../auth/session';

const connector = createWooCommerceConnector();

export class CashierChangedError extends Error {}

/** The live access token, but only while the live session is `owner`'s cashier at `owner`'s site. */
export function ownerToken(owner: Session, getLive: () => Session | null): () => string {
  return () => {
    const live = getLive();
    if (live && live.site.home === owner.site.home && live.tokens.user.uuid === owner.tokens.user.uuid) {
      return live.tokens.accessToken;
    }
    throw new CashierChangedError('The signed-in cashier changed; this order waits for its own cashier.');
  };
}

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
