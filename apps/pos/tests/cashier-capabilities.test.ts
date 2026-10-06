import { expect, test, vi } from 'vitest';
import { CREATE_CUSTOMERS_DENIED, createCustomersBlockedReason, deriveUserCapabilities, fetchCashierCapabilities } from '../lib/auth/capabilities';
import type { CashierCapabilities } from '../lib/auth/capabilities';
import type { Session } from '../lib/auth/session';

const session: Session = {
  site: { name: 'Store', home: 'https://shop.example', wpApiUrl: 'https://shop.example/wp-json',
    wcposApiUrl: 'https://shop.example/wp-json/wcpos/v2', authUrl: 'https://shop.example/wcpos-auth/' },
  tokens: { accessToken: 't1', refreshToken: 'refresh', expiresAt: 2000000000, user: { id: 2, uuid: 'cashier', displayName: 'Cashier' } },
};
const headers = { Authorization: 'Bearer t1' };

test('reads and normalises the cashier capabilities using the given headers', async () => {
  const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({
    id: 2, capabilities: ['create_customers', '', 7, 'edit_users', 'create_customers'],
  }));
  expect(await fetchCashierCapabilities(session, headers, fetchImpl as unknown as typeof fetch)).toEqual({
    known: true, granted: ['create_customers', 'edit_users'],
  });
  expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(`${session.site.wcposApiUrl}/cashier/2`, { headers });
  expect(fetchImpl.mock.calls[0][1]?.headers).toBe(headers);
});

test.each([
  { name: 'fetch rejects', fetchImpl: async () => { throw new Error('offline'); },
    reason: 'Could not read your permissions from the store.' },
  { name: 'HTTP 403', fetchImpl: async () => new Response(null, { status: 403 }),
    reason: 'Could not read your permissions from the store (HTTP 403).' },
  { name: 'invalid JSON', fetchImpl: async () => new Response('<html>', { status: 200 }),
    reason: 'The store sent an unreadable permission list.' },
  { name: 'null body', fetchImpl: async () => Response.json(null),
    reason: 'The store sent an unreadable permission list.' },
  { name: 'string capabilities', fetchImpl: async () => Response.json({ capabilities: 'edit_users' }),
    reason: 'The store sent an unreadable permission list.' },
  { name: 'null capabilities', fetchImpl: async () => Response.json({ capabilities: null }),
    reason: 'The store sent an unreadable permission list.' },
  { name: 'absent capabilities', fetchImpl: async () => Response.json({ id: 2 }),
    reason: "This store's WCPOS plugin does not report your permissions. Update the plugin to unlock this." },
])('returns the exact unknown reason for $name', async ({ fetchImpl, reason }) => {
  expect(await fetchCashierCapabilities(session, headers, fetchImpl)).toEqual({ known: false, reason });
});

test.each<CashierCapabilities>([
  { known: false, reason: 'Unavailable' },
  { known: true, granted: [] },
])('closes every gate for $known with no grants', cashier => {
  expect(deriveUserCapabilities(cashier)).toEqual({
    canEditProducts: false,
    canDeleteProducts: false,
    canEditVariations: false,
    canCreateProducts: false,
    canDeleteVariations: false,
    canEditCoupons: false,
    canCreateCoupons: false,
    canDeleteCoupons: false,
    canEditCustomers: false,
    canCreateCustomers: false,
    canDeleteCustomers: false,
  });
});

test.each(['create_customers', 'promote_users'])('%s permits creating customers', capability => {
  expect(deriveUserCapabilities({ known: true, granted: [capability] }).canCreateCustomers).toBe(true);
});

test('product editing requires all plural grants and variation editing also needs edit_product', () => {
  const granted = ['edit_products', 'edit_others_products', 'edit_published_products'];
  expect(deriveUserCapabilities({ known: true, granted })).toMatchObject({ canEditProducts: true, canEditVariations: false });
  expect(deriveUserCapabilities({ known: true, granted: [...granted, 'edit_product'] }).canEditVariations).toBe(true);
  expect(deriveUserCapabilities({ known: true, granted: granted.filter(c => c !== 'edit_others_products') }).canEditProducts).toBe(false);
});

test('explains unknown and denied creation, and leaves permitted creation unblocked', () => {
  expect(createCustomersBlockedReason({ known: false, reason: 'Unavailable' })).toBe('Unavailable');
  expect(CREATE_CUSTOMERS_DENIED).toBe("You don't have permission to create customers. An administrator can grant it in WP Admin > POS > Settings > Access.");
  expect(createCustomersBlockedReason({ known: true, granted: [] })).toBe(CREATE_CUSTOMERS_DENIED);
  expect(createCustomersBlockedReason({ known: true, granted: ['create_customers'] })).toBeUndefined();
});
