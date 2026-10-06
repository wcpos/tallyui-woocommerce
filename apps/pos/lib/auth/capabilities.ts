import type { Session } from './session';

export type CashierCapabilities =
  | { known: true; granted: readonly string[] }
  | { known: false; reason: string };

export interface UserCapabilities {
  canEditProducts: boolean;
  canDeleteProducts: boolean;
  canEditVariations: boolean;
  canCreateProducts: boolean;
  canDeleteVariations: boolean;
  canEditCoupons: boolean;
  canCreateCoupons: boolean;
  canDeleteCoupons: boolean;
  canEditCustomers: boolean;
  canCreateCustomers: boolean;
  canDeleteCustomers: boolean;
}

export const CREATE_CUSTOMERS_DENIED: string = "You don't have permission to create customers. An administrator can grant it in WP Admin > POS > Settings > Access.";

export async function fetchCashierCapabilities(
  session: Session, headers: Record<string, string>, fetchImpl: typeof fetch = fetch,
): Promise<CashierCapabilities> {
  let response: Response;
  try {
    response = await fetchImpl(`${session.site.wcposApiUrl}/cashier/${session.tokens.user.id}`, { headers });
  } catch {
    return { known: false, reason: 'Could not read your permissions from the store.' };
  }
  if (!response.ok) return { known: false, reason: `Could not read your permissions from the store (HTTP ${response.status}).` };
  const unreadable = 'The store sent an unreadable permission list.';
  try {
    const body = await response.json();
    if (body === null || typeof body !== 'object') return { known: false, reason: unreadable };
    if (body.capabilities === undefined) return {
      known: false, reason: "This store's WCPOS plugin does not report your permissions. Update the plugin to unlock this.",
    };
    if (!Array.isArray(body.capabilities)) return { known: false, reason: unreadable };
    const granted = [...new Set((body.capabilities as unknown[]).filter((c: unknown): c is string => typeof c === 'string' && c.length > 0))];
    return { known: true, granted };
  } catch {
    return { known: false, reason: unreadable };
  }
}

export function deriveUserCapabilities(cashier: CashierCapabilities): UserCapabilities {
  const granted = new Set(cashier.known ? cashier.granted : []);
  // Unknown fails closed by ADR 0006, where v2 fails open.
  const has = (c: string) => cashier.known && granted.has(c);
  const canEditProducts = has('edit_products') && has('edit_others_products') && has('edit_published_products');
  const canDeleteProducts = has('delete_products') && has('delete_others_products') && has('delete_published_products');
  return {
    canEditProducts,
    canDeleteProducts,
    canEditVariations: canEditProducts && has('edit_product'),
    canCreateProducts: has('publish_products') && has('edit_products'),
    canDeleteVariations: canDeleteProducts && has('delete_product'),
    canEditCoupons: has('edit_shop_coupons') && has('edit_others_shop_coupons') && has('edit_published_shop_coupons'),
    canCreateCoupons: has('publish_shop_coupons') && has('edit_shop_coupons'),
    canDeleteCoupons: has('delete_shop_coupons') && has('delete_others_shop_coupons') && has('delete_published_shop_coupons'),
    canEditCustomers: has('edit_users'),
    canCreateCustomers: has('create_customers') || has('promote_users'),
    canDeleteCustomers: has('delete_users'),
  };
}

export function createCustomersBlockedReason(cashier: CashierCapabilities): string | undefined {
  if (!cashier.known) return cashier.reason;
  return deriveUserCapabilities(cashier).canCreateCustomers ? undefined : CREATE_CUSTOMERS_DENIED;
}
