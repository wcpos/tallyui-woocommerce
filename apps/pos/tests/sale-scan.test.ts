vi.mock('../lib/scan/scan-sound', () => ({ scanFeedback: vi.fn() }));
vi.mock('../lib/toast/toast', () => ({ toast: vi.fn() }));
vi.mock('../lib/toast/added-to-cart-toast', () => ({ showAddedToCartToast: vi.fn() }));

import { beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { saleScanHandlers, type SaleScanDeps } from '../lib/scan/sale-scan';
import { scanFeedback } from '../lib/scan/scan-sound';
import { toast } from '../lib/toast/toast';
import { showAddedToCartToast } from '../lib/toast/added-to-cart-toast';
import products from './fixtures/products.json';
import variations from './fixtures/variations.json';

const traits = createWooCommerceConnector().traits.product;
const shirt = { ...products[2], variation_docs: variations.documents.filter(d => d.parent_id === products[2].id)
  .map(d => ({ ...d.payload, barcode: d.payload.global_unique_id })) };
const catalogue = [products[0], products[1], shirt];

function deps(overrides: Partial<SaleScanDeps<(typeof catalogue)[number]>> = {}) {
  return { products: catalogue, traits, currency: 'USD', add: vi.fn(() => true), choose: vi.fn(), say: vi.fn(), ...overrides };
}

beforeEach(() => vi.clearAllMocks());

test('onScan adds Espresso and clears the search field', () => {
  const d = deps();
  expect(saleScanHandlers(d).onScan('2000000000015')).toBe('clear');
  expect(scanFeedback).toHaveBeenCalledWith('success');
  expect(showAddedToCartToast).toHaveBeenCalledWith('Espresso');
  expect(d.say).not.toHaveBeenCalled();
  expect(d.add).toHaveBeenCalledTimes(1);
  expect(d.add).toHaveBeenCalledWith(expect.objectContaining({ product: expect.objectContaining({ id: 80 }) }));
  expect(d.choose).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
});

test('onScan sounds failure when the sale refuses Espresso', () => {
  const d = deps({ add: vi.fn(() => false) });
  expect(saleScanHandlers(d).onScan('2000000000015')).toBe('clear');
  expect(showAddedToCartToast).not.toHaveBeenCalled();
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(d.say).not.toHaveBeenCalled();
  expect(d.add).toHaveBeenCalledTimes(1);
  expect(d.add).toHaveBeenCalledWith(expect.objectContaining({ product: expect.objectContaining({ id: 80 }) }));
  expect(d.choose).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
});

test('onScan keeps an out-of-stock code and reports it', () => {
  const d = deps({ products: [{ ...catalogue[0], stock_status: 'outofstock' }, ...catalogue.slice(1)] });
  expect(saleScanHandlers(d).onScan('2000000000015')).toBe('keep');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(d.say).toHaveBeenCalledWith('Espresso out of stock');
  expect(d.add).not.toHaveBeenCalled();
  expect(d.choose).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
});

test('onScan opens the variant choice for a parent code', () => {
  const d = deps();
  expect(saleScanHandlers(d).onScan('MER-TEE')).toBe('clear');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(d.choose).toHaveBeenCalledTimes(1);
  expect(d.choose).toHaveBeenCalledWith(expect.objectContaining({ id: products[2].id }));
  expect(d.add).not.toHaveBeenCalled();
  expect(d.say).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
});

test('onScan searches for an unknown code and reports the miss', () => {
  const d = deps();
  expect(saleScanHandlers(d).onScan('999')).toBe('search');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(d.say).toHaveBeenCalledWith('Barcode not found — 999');
  expect(d.add).not.toHaveBeenCalled();
  expect(d.choose).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
});

test('onScan keeps the code and reports an exception from add', () => {
  const d = deps({ add: vi.fn(() => { throw new Error('boom'); }) });
  expect(saleScanHandlers(d).onScan('2000000000015')).toBe('keep');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(d.say).toHaveBeenCalledWith('boom');
  expect(d.add).toHaveBeenCalledTimes(1);
  expect(d.add).toHaveBeenCalledWith(expect.objectContaining({ product: expect.objectContaining({ id: 80 }) }));
  expect(d.choose).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
});

test('onTenderScan adds Espresso and reports through toast', () => {
  const d = deps();
  saleScanHandlers(d).onTenderScan('2000000000015');
  expect(scanFeedback).toHaveBeenCalledWith('success');
  expect(showAddedToCartToast).toHaveBeenCalledWith('Espresso');
  expect(toast).not.toHaveBeenCalled();
  expect(d.add).toHaveBeenCalledTimes(1);
  expect(d.add).toHaveBeenCalledWith(expect.objectContaining({ product: expect.objectContaining({ id: 80 }) }));
  expect(d.choose).not.toHaveBeenCalled();
  expect(d.say).not.toHaveBeenCalled();
});

test('onTenderScan reports when the sale refuses Espresso', () => {
  const d = deps({ add: vi.fn(() => false) });
  saleScanHandlers(d).onTenderScan('2000000000015');
  expect(showAddedToCartToast).not.toHaveBeenCalled();
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(toast).toHaveBeenCalledWith({ type: 'error', title: 'Espresso was not added' });
  expect(d.add).toHaveBeenCalledTimes(1);
  expect(d.add).toHaveBeenCalledWith(expect.objectContaining({ product: expect.objectContaining({ id: 80 }) }));
  expect(d.choose).not.toHaveBeenCalled();
  expect(d.say).not.toHaveBeenCalled();
});

test('onTenderScan warns about out-of-stock Espresso', () => {
  const d = deps({ products: [{ ...catalogue[0], stock_status: 'outofstock' }, ...catalogue.slice(1)] });
  saleScanHandlers(d).onTenderScan('2000000000015');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(toast).toHaveBeenCalledWith({ type: 'warning', title: 'Espresso out of stock' });
  expect(d.add).not.toHaveBeenCalled();
  expect(d.choose).not.toHaveBeenCalled();
  expect(d.say).not.toHaveBeenCalled();
});

test('onTenderScan directs a parent code to the products column without choosing', () => {
  const d = deps();
  saleScanHandlers(d).onTenderScan('MER-TEE');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(toast).toHaveBeenCalledWith({ type: 'info', title: expect.stringMatching(/: choose a variant in the products column$/) });
  expect(d.add).not.toHaveBeenCalled();
  expect(d.choose).not.toHaveBeenCalled();
  expect(d.say).not.toHaveBeenCalled();
});

test('onTenderScan reports an unknown code', () => {
  const d = deps();
  saleScanHandlers(d).onTenderScan('999');
  expect(scanFeedback).toHaveBeenCalledWith('failure');
  expect(toast).toHaveBeenCalledWith({ type: 'info', title: 'Barcode not found — 999' });
  expect(d.add).not.toHaveBeenCalled();
  expect(d.choose).not.toHaveBeenCalled();
  expect(d.say).not.toHaveBeenCalled();
});
