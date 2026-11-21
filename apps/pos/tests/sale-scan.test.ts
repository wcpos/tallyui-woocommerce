vi.mock('../lib/scan/scan-sound', () => ({ scanFeedback: vi.fn() }));
vi.mock('../lib/toast/toast', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/toast/toast')>();
  return { ...actual, toast: vi.fn(actual.toast) };
});
vi.mock('../lib/toast/added-to-cart-toast', () => ({ showAddedToCartToast: vi.fn() }));

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { saleScanHandlers, type SaleScanDeps } from '../lib/scan/sale-scan';
import { scanFeedback } from '../lib/scan/scan-sound';
import { toast, getToasts, dismissToast } from '../lib/toast/toast';
import { showAddedToCartToast } from '../lib/toast/added-to-cart-toast';
import { scanLogger } from '../lib/scan/scan-log';
import products from './fixtures/products.json';
import variations from './fixtures/variations.json';

const traits = createWooCommerceConnector().traits.product;
const shirt = { ...products[2], variation_docs: variations.documents.filter(d => d.parent_id === products[2].id)
  .map(d => ({ ...d.payload, barcode: d.payload.global_unique_id })) };
const catalogue = [products[0], products[1], shirt];
const alert = (type: 'warning' | 'error', title: string, description: string) => ({ id: 'pos-scan-alert', type, title, description, duration: 6000 });

function deps(overrides: Partial<SaleScanDeps<(typeof catalogue)[number]>> = {}) {
  return { products: catalogue, traits, currency: 'USD', add: vi.fn(() => true), ...overrides };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => dismissToast());

test('onScan adds Espresso and clears the search field', () => {
  const d = deps();
  expect(saleScanHandlers(d).onScan('2000000000015')).toBe('clear');
  expect(scanFeedback).toHaveBeenCalledWith('success');
  expect(showAddedToCartToast).toHaveBeenCalledWith('Espresso');
  expect(d.add).toHaveBeenCalledTimes(1);
  expect(d.add).toHaveBeenCalledWith(expect.objectContaining({ product: expect.objectContaining({ id: 80 }) }));
  expect(toast).not.toHaveBeenCalled();
});

test('onScan warns with an error toast when the sale refuses Espresso', () => {
  const d = deps({ add: vi.fn(() => false) });
  expect(saleScanHandlers(d).onScan('2000000000015')).toBe('clear');
  expect(showAddedToCartToast).not.toHaveBeenCalled();
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(d.add).toHaveBeenCalledTimes(1);
  expect(d.add).toHaveBeenCalledWith(expect.objectContaining({ product: expect.objectContaining({ id: 80 }) }));
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(alert('error', 'Couldn’t add to cart', 'Espresso'));
});

test('onScan keeps an out-of-stock code and warns with a toast', () => {
  const d = deps({ products: [{ ...catalogue[0], stock_status: 'outofstock' }, ...catalogue.slice(1)] });
  expect(saleScanHandlers(d).onScan('2000000000015')).toBe('keep');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(d.add).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(alert('warning', 'Espresso out of stock', '2000000000015'));
});

test('onScan searches for a parent code and warns to choose a variation', () => {
  const d = deps();
  expect(saleScanHandlers(d).onScan('MER-TEE')).toBe('search');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(d.add).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(alert('warning', 'Choose a variation', 'T-Shirt — MER-TEE'));
});

test('onScan searches for an unknown code and warns it is not in this store', () => {
  const d = deps();
  expect(saleScanHandlers(d).onScan('999')).toBe('search');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(d.add).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(alert('warning', 'Barcode not found', '999 — not in this store'));
});

test('onScan searches for a code with several matches and warns with the count', () => {
  const d = deps({ products: [products[0], { ...products[0], id: 980, name: 'Espresso Twin' }] });
  expect(saleScanHandlers(d).onScan('2000000000015')).toBe('search');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(d.add).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(alert('warning', 'Several matches', '2 products found locally — 2000000000015'));
});

test('onScan keeps the code and shows an exception from add as an error toast', () => {
  const d = deps({ add: vi.fn(() => { throw new Error('boom'); }) });
  expect(saleScanHandlers(d).onScan('2000000000015')).toBe('keep');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(d.add).toHaveBeenCalledTimes(1);
  expect(d.add).toHaveBeenCalledWith(expect.objectContaining({ product: expect.objectContaining({ id: 80 }) }));
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(alert('error', 'Couldn’t add to cart', 'boom'));
});

test('onTenderScan adds Espresso and reports through toast', () => {
  const d = deps();
  saleScanHandlers(d).onTenderScan('2000000000015');
  expect(scanFeedback).toHaveBeenCalledWith('success');
  expect(showAddedToCartToast).toHaveBeenCalledWith('Espresso');
  expect(toast).not.toHaveBeenCalled();
  expect(d.add).toHaveBeenCalledTimes(1);
  expect(d.add).toHaveBeenCalledWith(expect.objectContaining({ product: expect.objectContaining({ id: 80 }) }));
});

test('onTenderScan warns with an error toast when the sale refuses Espresso', () => {
  const d = deps({ add: vi.fn(() => false) });
  saleScanHandlers(d).onTenderScan('2000000000015');
  expect(showAddedToCartToast).not.toHaveBeenCalled();
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(alert('error', 'Couldn’t add to cart', 'Espresso'));
  expect(d.add).toHaveBeenCalledTimes(1);
  expect(d.add).toHaveBeenCalledWith(expect.objectContaining({ product: expect.objectContaining({ id: 80 }) }));
});

test('onTenderScan warns about out-of-stock Espresso', () => {
  const d = deps({ products: [{ ...catalogue[0], stock_status: 'outofstock' }, ...catalogue.slice(1)] });
  saleScanHandlers(d).onTenderScan('2000000000015');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(alert('warning', 'Espresso out of stock', '2000000000015'));
  expect(d.add).not.toHaveBeenCalled();
});

test('onTenderScan warns to choose a variation without choosing', () => {
  const d = deps();
  saleScanHandlers(d).onTenderScan('MER-TEE');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(alert('warning', 'Choose a variation', 'T-Shirt — MER-TEE'));
  expect(d.add).not.toHaveBeenCalled();
});

test('onTenderScan warns about an unknown code', () => {
  const d = deps();
  saleScanHandlers(d).onTenderScan('999');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(alert('warning', 'Barcode not found', '999 — not in this store'));
  expect(d.add).not.toHaveBeenCalled();
});

test('onTenderScan warns about several matches', () => {
  const d = deps({ products: [products[0], { ...products[0], id: 980, name: 'Espresso Twin' }] });
  saleScanHandlers(d).onTenderScan('2000000000015');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(alert('warning', 'Several matches', '2 products found locally — 2000000000015'));
});

test('onTenderScan shows an exception from add as an error toast', () => {
  const d = deps({ add: vi.fn(() => { throw new Error('boom'); }) });
  saleScanHandlers(d).onTenderScan('2000000000015');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(toast).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledWith(alert('error', 'Couldn’t add to cart', 'boom'));
});

test('two misses in a row leave one scan alert with the second code', () => {
  const { onScan, onTenderScan } = saleScanHandlers(deps());
  onScan('999');
  onTenderScan('888');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(getToasts()).toEqual([expect.objectContaining({ id: 'pos-scan-alert', type: 'warning', title: 'Barcode not found', description: '888 — not in this store' })]);
});

function logSpies() {
  return { info: vi.spyOn(scanLogger, 'info'), warn: vi.spyOn(scanLogger, 'warn') };
}

test('a scan that adds Espresso logs the barcode', () => {
  const { info, warn } = logSpies();
  saleScanHandlers(deps()).onScan('2000000000015');
  expect(info.mock.calls).toEqual([['Barcode scanned: 2000000000015', { barcode: '2000000000015', productName: 'Espresso' }]]);
  expect(warn).not.toHaveBeenCalled();
});

test('a scan the sale refuses logs nothing', () => {
  const { info, warn } = logSpies();
  saleScanHandlers(deps({ add: vi.fn(() => false) })).onScan('2000000000015');
  expect(info).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
});

test('an out-of-stock scan logs the product', () => {
  const { info, warn } = logSpies();
  saleScanHandlers(deps({ products: [{ ...catalogue[0], stock_status: 'outofstock' }, ...catalogue.slice(1)] })).onScan('2000000000015');
  expect(info.mock.calls).toEqual([['Barcode scan matched an out-of-stock product', { barcode: '2000000000015', productName: 'Espresso' }]]);
  expect(warn).not.toHaveBeenCalled();
});

test('an unknown code logs that it matched no product', () => {
  const { info, warn } = logSpies();
  saleScanHandlers(deps()).onScan('999');
  expect(info.mock.calls).toEqual([['Barcode scan did not match a product', { barcode: '999' }]]);
  expect(warn).not.toHaveBeenCalled();
});

test('a code with several matches warns with the count', () => {
  const { info, warn } = logSpies();
  saleScanHandlers(deps({ products: [products[0], { ...products[0], id: 980, name: 'Espresso Twin' }] })).onScan('2000000000015');
  expect(warn.mock.calls).toEqual([['Barcode scan matched multiple products', { barcode: '2000000000015', resultsCount: 2 }]]);
  expect(info).not.toHaveBeenCalled();
});

test('a parent code warns that it matched a variable product', () => {
  const { info, warn } = logSpies();
  saleScanHandlers(deps()).onScan('MER-TEE');
  expect(warn.mock.calls).toEqual([['Barcode scan matched a variable product', { barcode: 'MER-TEE', productName: 'T-Shirt' }]]);
  expect(info).not.toHaveBeenCalled();
});
