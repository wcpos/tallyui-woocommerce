import { cleanup, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import type { HealthScreen } from '../components/health-screen';
import HealthDatabase from '../app/health/database';

const mocks = vi.hoisted(() => ({
  props: null as ComponentProps<typeof HealthScreen> | null,
  catalogue: {
    receiptEmails: {}, db: { products: {} }, coupons: {}, parkedCarts: {},
    replication: { resume: vi.fn(async () => {}) },
    couponReplication: { resume: vi.fn(async () => {}) },
  },
}));

vi.mock('../lib/auth/session-context', () => ({
  useSession: () => ({ ready: true, session: { site: { name: 'S' } } }),
}));
vi.mock('../lib/catalogue/catalogue-context', () => ({
  useCatalogue: () => ({ catalogue: mocks.catalogue, error: null }),
}));
vi.mock('../components/session-hold-banner', () => ({ SessionHoldBanner: () => null }));
vi.mock('../components/catalogue-unavailable', () => ({ CatalogueUnavailable: () => null }));
vi.mock('expo-router', () => ({ Redirect: () => null }));
vi.mock('../components/health-screen', () => ({
  HealthScreen: (props: ComponentProps<typeof HealthScreen>) => { mocks.props = props; return null; },
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test('the coupons row checks for changes through the coupon replication', async () => {
  render(<HealthDatabase />);
  const { collections } = mocks.props!;
  await collections.find(row => row.key === 'coupons')!.onSyncNow!();
  expect(mocks.catalogue.couponReplication.resume).toHaveBeenCalledTimes(1);
  expect(mocks.catalogue.replication.resume).not.toHaveBeenCalled();
  await collections.find(row => row.key === 'products')!.onSyncNow!();
  expect(mocks.catalogue.replication.resume).toHaveBeenCalledTimes(1);
  expect(collections.find(row => row.key === 'parked')!.onSyncNow).toBeUndefined();
});
