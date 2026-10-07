import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { QuickFilterEditor } from '../components/quick-filter-editor';
import { isQuickFilterValid, QUICK_FILTER_CONDITION_FIELDS } from '../lib/catalogue/quick-filters';
import type { QuickFilter } from '../lib/catalogue/quick-filters';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => Array.from(data.keys())[index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

function renderEditor(initial: QuickFilter | null = null) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(<><QuickFilterEditor initial={initial} products={products} connector={createWooCommerceConnector()}
    currency={stores[0].currency} baselineSort={{ field: 'name', dir: 'asc' }} onSave={onSave} onCancel={onCancel} /><PortalHost /></>);
  return { onSave, onCancel };
}

test('a new quick filter cannot be saved until it has a name and a complete condition', () => {
  const { onSave } = renderEditor();
  const save = screen.getByTestId('quick-filter-save');
  expect(save.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(save);
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: 'Sale' } });
  expect(save.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByTestId('quick-filter-add-condition'));
  expect(screen.getByTestId('quick-filter-condition-field-0').textContent).toBe('Category');
  expect(save.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByTestId('quick-filter-term-categories-25'));
  expect(save.getAttribute('aria-disabled')).not.toBe('true');
  fireEvent.click(save);
  expect(onSave).toHaveBeenCalledExactlyOnceWith({
    id: expect.any(String), type: 'quick', label: 'Sale', conditions: [{ field: 'categories', value: [25] }],
  });
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('sort');
  expect(isQuickFilterValid(onSave.mock.calls[0][0])).toBe(true);
});

test('save trims the name', () => {
  const { onSave } = renderEditor();
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: '  Coffee  ' } });
  fireEvent.click(screen.getByTestId('quick-filter-sort-field'));
  expect(screen.getByTestId('quick-filter-sort-option-price').textContent).toBe('Price');
  fireEvent.click(screen.getByTestId('quick-filter-sort-option-price'));
  expect(screen.getByTestId('quick-filter-sort-field').textContent).toBe('Price');
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  expect(onSave).toHaveBeenCalledExactlyOnceWith({
    id: expect.any(String), type: 'quick', label: 'Coffee', conditions: [], sort: { field: 'price', dir: 'asc' },
  });
  expect(isQuickFilterValid(onSave.mock.calls[0][0])).toBe(true);
});

test('a sort alone is enough to save', () => {
  const { onSave } = renderEditor();
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: 'By price' } });
  fireEvent.click(screen.getByTestId('quick-filter-sort-field'));
  fireEvent.click(screen.getByTestId('quick-filter-sort-option-price'));
  fireEvent.click(screen.getByTestId('quick-filter-sort-direction-desc'));
  expect(screen.getByTestId('quick-filter-sort-direction-desc').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTestId('quick-filter-sort-direction-asc').getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByTestId('quick-filter-save').getAttribute('aria-disabled')).not.toBe('true');
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  expect(onSave).toHaveBeenCalledExactlyOnceWith({
    id: expect.any(String), type: 'quick', label: 'By price', conditions: [], sort: { field: 'price', dir: 'desc' },
  });
});

test('choosing Default order removes the sort', () => {
  const { onSave } = renderEditor({
    id: 'sale', type: 'quick', label: 'Sale', conditions: [{ field: 'on_sale', value: true }], sort: { field: 'price', dir: 'desc' },
  });
  fireEvent.click(screen.getByTestId('quick-filter-sort-field'));
  fireEvent.click(screen.getByTestId('quick-filter-sort-option-default'));
  expect(screen.queryByTestId('quick-filter-sort-direction')).toBeNull();
  expect(screen.queryByTestId('quick-filter-sort-direction-asc')).toBeNull();
  expect(screen.queryByTestId('quick-filter-sort-direction-desc')).toBeNull();
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  expect(onSave).toHaveBeenCalledExactlyOnceWith({
    id: 'sale', type: 'quick', label: 'Sale', conditions: [{ field: 'on_sale', value: true }],
  });
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('sort');
});

test('changing a row field resets its value', () => {
  const { onSave } = renderEditor();
  fireEvent.click(screen.getByTestId('quick-filter-add-condition'));
  fireEvent.click(screen.getByTestId('quick-filter-term-categories-25'));
  fireEvent.click(screen.getByTestId('quick-filter-condition-field-0'));
  fireEvent.click(screen.getByTestId('quick-filter-condition-option-0-on_sale'));
  expect(screen.getByTestId('quick-filter-toggle-on_sale-yes').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTestId('quick-filter-toggle-on_sale-no').getAttribute('aria-pressed')).toBe('false');
  expect(screen.queryByTestId('quick-filter-term-categories-25')).toBeNull();
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: 'Sale' } });
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  expect(onSave).toHaveBeenCalledExactlyOnceWith({
    id: expect.any(String), type: 'quick', label: 'Sale', conditions: [{ field: 'on_sale', value: true }],
  });
});

test('each field can be used once', () => {
  renderEditor();
  const add = screen.getByTestId('quick-filter-add-condition');
  for (const field of QUICK_FILTER_CONDITION_FIELDS) {
    expect(add.getAttribute('aria-disabled'), field).not.toBe('true');
    fireEvent.click(add);
  }
  expect(add.getAttribute('aria-disabled')).toBe('true');
  expect(screen.getAllByTestId(/^quick-filter-condition-field-/).map(row => row.textContent)).toEqual([
    'Category', 'Tag', 'Price', 'On Sale', 'Stock Status', 'Type', 'Search',
  ]);
  expect(screen.getAllByText('and')).toHaveLength(6);
  fireEvent.click(screen.getByTestId('quick-filter-condition-field-0'));
  expect(screen.getAllByTestId(/^quick-filter-condition-option-0-/)).toHaveLength(1);
  expect(screen.getByTestId('quick-filter-condition-option-0-categories').textContent).toBe('Category');
});

test('removing a condition frees its field', () => {
  renderEditor();
  fireEvent.click(screen.getByTestId('quick-filter-add-condition'));
  fireEvent.click(screen.getByTestId('quick-filter-add-condition'));
  fireEvent.click(screen.getByTestId('quick-filter-condition-remove-0'));
  expect(screen.getByTestId('quick-filter-condition-field-0').textContent).toBe('Tag');
  expect(screen.getByText('No tags on synced products')).not.toBeNull();
  fireEvent.click(screen.getByTestId('quick-filter-add-condition'));
  expect(screen.getByTestId('quick-filter-condition-field-1').textContent).toBe('Category');
  expect(screen.getAllByTestId(/^quick-filter-term-categories-/).map(term => term.textContent)).toEqual(['Coffee', 'Merch']);
});

test('price bounds: blank, zero and garbage mean no bound', () => {
  const { onSave } = renderEditor();
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: 'At least five' } });
  fireEvent.click(screen.getByTestId('quick-filter-add-condition'));
  fireEvent.click(screen.getByTestId('quick-filter-condition-field-0'));
  fireEvent.click(screen.getByTestId('quick-filter-condition-option-0-price'));
  const min = screen.getByTestId('quick-filter-price-min') as HTMLInputElement;
  const max = screen.getByTestId('quick-filter-price-max') as HTMLInputElement;
  expect(min.value).toBe('');
  expect(max.value).toBe('');
  expect(screen.getByTestId('quick-filter-save').getAttribute('aria-disabled')).toBe('true');
  fireEvent.change(min, { target: { value: '0' } });
  fireEvent.change(max, { target: { value: 'abc' } });
  expect(screen.getByTestId('quick-filter-save').getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(min, { target: { value: '5' } });
  expect(screen.getByTestId('quick-filter-save').getAttribute('aria-disabled')).not.toBe('true');
  fireEvent.change(min, { target: { value: '5.' } });
  expect(min.value).toBe('5.');
  fireEvent.change(max, { target: { value: '' } });
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  expect(onSave).toHaveBeenCalledExactlyOnceWith({
    id: expect.any(String), type: 'quick', label: 'At least five', conditions: [{ field: 'price', value: { min: 5 } }],
  });
  expect(onSave.mock.calls[0][0].conditions[0].value).not.toHaveProperty('max');
});

test('a price with min above max cannot be saved', () => {
  const { onSave } = renderEditor({
    id: 'price', type: 'quick', label: 'Price range', conditions: [{ field: 'price', value: { min: 1, max: 5 } }],
  });
  expect((screen.getByTestId('quick-filter-price-min') as HTMLInputElement).value).toBe('1');
  expect((screen.getByTestId('quick-filter-price-max') as HTMLInputElement).value).toBe('5');
  fireEvent.change(screen.getByTestId('quick-filter-price-min'), { target: { value: '10' } });
  expect(screen.getByTestId('quick-filter-save').getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  expect(onSave).not.toHaveBeenCalled();
});

test('stock status, type and search editors save their values', () => {
  const { onSave } = renderEditor();
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: 'Special products' } });
  for (const [index, field] of ['stock_status', 'type', 'search'].entries()) {
    fireEvent.click(screen.getByTestId('quick-filter-add-condition'));
    fireEvent.click(screen.getByTestId(`quick-filter-condition-field-${index}`));
    fireEvent.click(screen.getByTestId(`quick-filter-condition-option-${index}-${field}`));
  }
  fireEvent.click(screen.getByTestId('quick-filter-stock-status'));
  expect(screen.getByTestId('quick-filter-stock-status-option-outofstock').textContent).toBe('Out of Stock');
  fireEvent.click(screen.getByTestId('quick-filter-stock-status-option-outofstock'));
  fireEvent.click(screen.getByTestId('quick-filter-product-type'));
  expect(screen.getByTestId('quick-filter-product-type-option-variable').textContent).toBe('Variable');
  fireEvent.click(screen.getByTestId('quick-filter-product-type-option-variable'));
  fireEvent.change(screen.getByTestId('quick-filter-search-term'), { target: { value: 'Esp' } });
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  expect(onSave).toHaveBeenCalledExactlyOnceWith({
    id: expect.any(String), type: 'quick', label: 'Special products', conditions: [
      { field: 'stock_status', value: 'outofstock' }, { field: 'type', value: 'variable' }, { field: 'search', value: 'Esp' },
    ],
  });
});

test('the preview counts matches after a pause and lists the first names', () => {
  renderEditor({ id: 'regular', type: 'quick', label: 'Not on sale', conditions: [{ field: 'on_sale', value: false }] });
  expect(screen.queryByTestId('quick-filter-preview-count')).toBeNull();
  expect(screen.queryByTestId('quick-filter-preview-item-0')).toBeNull();
  act(() => vi.advanceTimersByTime(249));
  expect(screen.queryByTestId('quick-filter-preview-count')).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByTestId('quick-filter-preview-count').textContent).toBe('2 products match on this device');
  expect(screen.getByTestId('quick-filter-preview-item-0').textContent).toBe('Espresso');
  expect(screen.getByTestId('quick-filter-preview-item-1').textContent).toBe('T-Shirt');
  fireEvent.click(screen.getByTestId('quick-filter-toggle-on_sale-yes'));
  expect(screen.getByTestId('quick-filter-preview-count').textContent).toBe('2 products match on this device');
  act(() => vi.advanceTimersByTime(250));
  expect(screen.getByTestId('quick-filter-preview-count').textContent).toBe('1 products match on this device');
  expect(screen.getByTestId('quick-filter-preview-item-0').textContent).toBe('Cold Brew');
  expect(screen.queryByTestId('quick-filter-preview-item-1')).toBeNull();
});

test('the preview says when nothing matches', () => {
  const { onSave } = renderEditor({ id: 'external', type: 'quick', label: 'External', conditions: [{ field: 'type', value: 'external' }] });
  act(() => vi.advanceTimersByTime(250));
  expect(screen.getByTestId('quick-filter-preview-count').textContent).toBe('0 products match on this device');
  expect(screen.getByTestId('quick-filter-preview-empty').textContent).toBe('No products match right now. You can still save this button.');
  expect(screen.queryByTestId('quick-filter-preview-item-0')).toBeNull();
  expect(screen.getByTestId('quick-filter-save').getAttribute('aria-disabled')).not.toBe('true');
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  expect(onSave).toHaveBeenCalledOnce();
  expect(isQuickFilterValid(onSave.mock.calls[0][0])).toBe(true);
});

test('the preview follows the draft sort', () => {
  renderEditor({
    id: 'coffee', type: 'quick', label: 'Coffee', conditions: [{ field: 'categories', value: [25] }], sort: { field: 'price', dir: 'asc' },
  });
  act(() => vi.advanceTimersByTime(250));
  expect(screen.getByTestId('quick-filter-preview-item-0').textContent).toBe('Espresso');
  expect(screen.getByTestId('quick-filter-preview-item-1').textContent).toBe('Cold Brew');
});

test('a selected category missing from the products can be removed', () => {
  const { onSave } = renderEditor({ id: 'missing', type: 'quick', label: 'Coffee', conditions: [{ field: 'categories', value: [99] }] });
  const missing = screen.getByTestId('quick-filter-term-categories-99');
  expect(missing.textContent).toBe('#99');
  expect(missing.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(missing);
  expect(screen.queryByTestId('quick-filter-term-categories-99')).toBeNull();
  fireEvent.click(screen.getByTestId('quick-filter-term-categories-25'));
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  expect(onSave).toHaveBeenCalledExactlyOnceWith({
    id: 'missing', type: 'quick', label: 'Coffee', conditions: [{ field: 'categories', value: [25] }],
  });
});

test('cancel calls onCancel and does not save', () => {
  const { onSave, onCancel } = renderEditor();
  fireEvent.click(screen.getByTestId('quick-filter-cancel'));
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onSave).not.toHaveBeenCalled();
});

test('the preview applies the search condition', () => {
  renderEditor({ id: 'brew', type: 'quick', label: 'Brew', conditions: [{ field: 'search', value: 'Brew' }] });
  act(() => vi.advanceTimersByTime(250));
  expect(screen.getByTestId('quick-filter-preview-count').textContent).toBe('1 products match on this device');
  expect(screen.getByTestId('quick-filter-preview-item-0').textContent).toBe('Cold Brew');
  expect(screen.queryByTestId('quick-filter-preview-item-1')).toBeNull();
});

test('the preview lists at most five names', () => {
  const manyProducts = Array.from({ length: 7 }, (_, i) => ({ ...products[0], id: 9000 + i, name: `Product ${i + 1}` }));
  render(<><QuickFilterEditor initial={{ id: 'many', type: 'quick', label: 'Many', conditions: [{ field: 'search', value: 'Product' }] }}
    products={manyProducts} connector={createWooCommerceConnector()} currency={stores[0].currency}
    baselineSort={{ field: 'name', dir: 'asc' }} onSave={vi.fn()} onCancel={vi.fn()} /><PortalHost /></>);
  act(() => vi.advanceTimersByTime(250));
  expect(screen.getByTestId('quick-filter-preview-count').textContent).toBe('7 products match on this device');
  expect(screen.getByTestId('quick-filter-preview-item-4').textContent).toBe('Product 5');
  expect(screen.queryByTestId('quick-filter-preview-item-5')).toBeNull();
});
