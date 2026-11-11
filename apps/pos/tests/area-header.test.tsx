import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { createTallyDatabase } from '@tallyui/database';
import { AppRailShown } from '../components/app-rail';
import { AreaHeader } from '../components/area-header';
import { CouponsScreen } from '../components/coupons-screen';

const connector = createWooCommerceConnector();
let db: Awaited<ReturnType<typeof createTallyDatabase>>;

beforeEach(async () => {
  db = await createTallyDatabase({ connector, name: `area_header_${crypto.randomUUID()}`, storage: getRxStorageMemory() });
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await db.close();
});

test('without the rail the header shows the title and a Back button that calls onBack', () => {
  const onBack = vi.fn();
  render(<AreaHeader title="Orders" backTestID="orders-back" onBack={onBack} />);
  expect(screen.getByRole('heading', { name: 'Orders' })).not.toBeNull();
  fireEvent.click(screen.getByTestId('orders-back'));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('area-header-gap')).toBeNull();
});

test('beside the rail the header draws only a top gap, and nothing with gap={false}', () => {
  const view = render(<AppRailShown.Provider value={true}><AreaHeader title="Orders" backTestID="orders-back" onBack={vi.fn()} /></AppRailShown.Provider>);
  expect(screen.queryByText('Orders')).toBeNull();
  expect(screen.queryByTestId('orders-back')).toBeNull();
  expect(screen.getByTestId('area-header-gap')).not.toBeNull();
  view.rerender(<AppRailShown.Provider value={true}><AreaHeader title="Orders" backTestID="orders-back" onBack={vi.fn()} gap={false} /></AppRailShown.Provider>);
  expect(screen.queryByTestId('area-header-gap')).toBeNull();
  expect(screen.queryByText('Orders')).toBeNull();
  expect(view.container.textContent).toBe('');
});

test('the Coupons screen beside the rail has no title or Back but keeps its search; without the rail Back is there', async () => {
  const view = render(<AppRailShown.Provider value={true}><CouponsScreen coupons={db.coupons} currency="USD" locale="en_US" onBack={vi.fn()} /></AppRailShown.Provider>);
  expect(await screen.findByTestId('search-coupons')).not.toBeNull();
  expect(screen.queryByTestId('coupons-back')).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Coupons' })).toBeNull();
  expect(screen.queryByText('Coupons')).toBeNull();
  expect(screen.getByTestId('area-header-gap')).not.toBeNull();
  view.unmount();
  render(<CouponsScreen coupons={db.coupons} currency="USD" locale="en_US" onBack={vi.fn()} />);
  expect(await screen.findByTestId('coupons-back')).not.toBeNull();
  expect(screen.getByRole('heading', { name: 'Coupons' })).not.toBeNull();
});
