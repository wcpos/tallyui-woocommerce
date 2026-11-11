import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { settingsSheetClassName } from '../components/catalogue-display-options';
import { classesOf } from './classes-of';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { QUICK_FILTERS_KEY } from '../lib/catalogue/quick-filters';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => { localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })); });

afterEach(() => {
  cleanup();
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

const props: CatalogueViewProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', status: 'ready', onSignOut: () => {},
};

const decaf = { ...products[0], id: 90, name: 'Decaf', sku: 'COF-DEC', stock_status: 'outofstock', stock_quantity: 0 };
const tiles = () => screen.getAllByText(/^(Espresso|Cold Brew|T-Shirt|Decaf)$/).map(n => n.textContent);
const stored = () => JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!);
const sale = { id: 'sale', type: 'quick', label: 'Sale', conditions: [{ field: 'on_sale', value: true }] };

function openSheet(extra: Partial<CatalogueViewProps> = {}): void {
  render(<><CatalogueView {...props} {...extra} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
}

test('the sheet shows v2\'s fields in v2\'s order', () => {
  openSheet();
  const text = screen.getByTestId('catalogue-settings').textContent!;
  const positions = ['View Mode', 'Tile Size', 'Browse by', 'Show out-of-stock products', 'Sort By', 'Sort Direction', 'Variations', 'Tile Fields', 'Restore Default Settings', 'Close']
    .map(label => text.indexOf(label));
  expect(positions[0]).toBeGreaterThanOrEqual(0);
  for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThan(positions[i - 1]);
});

test('the sheet sits on the side opposite the products', () => {
  const right = settingsSheetClassName('left');
  for (const token of ['right-0', 'border-l', 'h-full', 'max-w-lg', 'bg-card', 'rounded-none']) expect(right.split(' ')).toContain(token);
  const left = settingsSheetClassName('right').split(' ');
  expect(left).toContain('left-0');
  expect(left).toContain('border-r');
  expect(left).not.toContain('right-0');
});

test('View Mode in the sheet switches the catalogue to the table and back', () => {
  openSheet();
  fireEvent.click(screen.getByTestId('view-mode-segment-table'));
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-84', 'product-row-80', 'product-row-102']);
  expect(screen.getByTestId('view-mode-toggle').getAttribute('aria-label')).toBe('Switch to grid view');
  expect(stored().view).toBe('table');
  expect(screen.getByTestId('column-toggle-name')).not.toBeNull();
  expect(screen.queryByTestId('tile-size')).toBeNull();
  fireEvent.click(screen.getByTestId('view-mode-segment-grid'));
  expect(screen.getByTestId('tile-size')).not.toBeNull();
});

test('Show out-of-stock products shows a sold-out product, saves the choice and survives a remount', () => {
  openSheet({ products: [...products, decaf] });
  expect(screen.queryByText('Decaf')).toBeNull();
  fireEvent.click(screen.getByRole('switch', { name: 'Show out-of-stock products' }));
  expect(tiles()).toContain('Decaf');
  expect(screen.queryByTestId('filter-pill-remove-stock_status')).toBeNull();
  expect(stored().showOutOfStock).toBe(true);
  cleanup();
  render(<><CatalogueView {...props} products={[...products, decaf]} /><PortalHost /></>);
  expect(screen.getByText('Decaf')).not.toBeNull();
});

test('turning Show out-of-stock products off hides them again and turns In Stock back on', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"showOutOfStock":true,"browseBy":"all"}');
  openSheet({ products: [...products, decaf] });
  fireEvent.click(screen.getByRole('switch', { name: 'Show out-of-stock products' }));
  expect(screen.queryByText('Decaf')).toBeNull();
  expect(screen.getByTestId('filter-pill-remove-stock_status')).not.toBeNull();
});

test('restore hides out-of-stock products again', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"showOutOfStock":true,"browseBy":"all"}');
  openSheet({ products: [...products, decaf] });
  fireEvent.click(screen.getByTestId('catalogue-settings-restore'));
  // The restored defaults open on the category tiles; All products shows every product the baseline lets through.
  fireEvent.click(screen.getByTestId('browse-all-products'));
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.queryByText('Decaf')).toBeNull();
  expect(stored().showOutOfStock).toBe(false);
});

test('with out-of-stock products shown, pressing an applied quick filter again keeps them', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"showOutOfStock":true,"browseBy":"all"}');
  localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify([sale]));
  openSheet({ products: [...products, decaf] });
  fireEvent.click(screen.getByTestId('catalogue-settings-close'));
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  expect(tiles()).toEqual(['Cold Brew']);
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  expect(tiles()).toContain('Decaf');
});

test('Sort By lists the fields the catalogue can sort in v2\'s order and copy', () => {
  openSheet();
  fireEvent.click(screen.getByTestId('sort-by'));
  expect(screen.getAllByTestId(/^sort-by-option-/).map(node => node.textContent)).toEqual(['Name', 'SKU', 'Barcode', 'Price', 'Stock Quantity']);
});

test('Sort By is v2\'s select: its trigger ends in a chevron', () => {
  openSheet();
  expect(screen.getByTestId('sort-by').contains(screen.getByTestId('sort-by-chevron'))).toBe(true);
});

test('Sort By and Sort Direction reorder the grid and save the sort', () => {
  openSheet();
  fireEvent.click(screen.getByTestId('sort-direction-segment-desc'));
  expect(tiles()).toEqual(['T-Shirt', 'Espresso', 'Cold Brew']);
  fireEvent.click(screen.getByTestId('sort-by'));
  fireEvent.click(screen.getByTestId('sort-by-option-price'));
  expect(tiles()).toEqual(['T-Shirt', 'Cold Brew', 'Espresso']);
  expect(stored().sort).toEqual({ field: 'price', dir: 'desc' });
  fireEvent.click(screen.getByTestId('sort-direction-segment-asc'));
  expect(tiles()).toEqual(['Espresso', 'Cold Brew', 'T-Shirt']);
});

test('Browse by draws v2\'s sources with All products and Categories available', () => {
  openSheet();
  const row = (value: string) => screen.getByTestId(`ui-settings-browse-by-${value}`);
  expect(row('all').getAttribute('aria-checked')).toBe('true');
  expect(row('categories').getAttribute('aria-disabled')).not.toBe('true');
  for (const value of ['tags', 'brands', 'shortcuts']) expect(row(value).getAttribute('aria-disabled')).toBe('true');
  expect(row('categories').textContent).toContain('2 categories');
  expect(row('tags').textContent).toContain('No tags yet');
  expect(row('brands').textContent).toBe('Brands');
  expect(row('shortcuts').textContent).toContain('No shortcuts yet');
  const before = tiles();
  fireEvent.click(row('tags'));
  expect(row('all').getAttribute('aria-checked')).toBe('true');
  expect(tiles()).toEqual(before);
});

test('Browse by counts saved quick filters as shortcuts', () => {
  localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify([sale]));
  openSheet();
  const shortcuts = screen.getByTestId('ui-settings-browse-by-shortcuts').textContent;
  expect(shortcuts).toContain('1 quick filter');
  expect(shortcuts).not.toContain('filters');
});

test('Variations offers Open in place and shows the inline style as unavailable', () => {
  openSheet();
  expect(screen.getByTestId('products-variations-style-segment-drill').getAttribute('aria-checked')).toBe('true');
  const inline = () => screen.getByTestId('products-variations-style-segment-inline');
  expect(inline().getAttribute('aria-disabled')).toBe('true');
  expect(inline().textContent).toBe('Popover');
  fireEvent.click(screen.getByTestId('view-mode-segment-table'));
  expect(inline().textContent).toBe('Expanded rows');
});

test('the close icon and Close both close the sheet', () => {
  openSheet();
  fireEvent.click(screen.getByTestId('catalogue-settings-x'));
  expect(screen.queryByTestId('catalogue-settings')).toBeNull();
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByTestId('catalogue-settings-close'));
  expect(screen.queryByTestId('catalogue-settings')).toBeNull();
});

test('the out-of-stock switch comes before its label, as v2\'s FormSwitch', () => {
  openSheet();
  const row = screen.getByTestId('show-out-of-stock-row');
  const toggle = screen.getByTestId('show-out-of-stock');
  const label = screen.getByTestId('show-out-of-stock-label');
  expect(row.contains(toggle) && row.contains(label)).toBe(true);
  expect(toggle.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('pressing the label turns out-of-stock products on', () => {
  openSheet({ products: [...products, decaf] });
  fireEvent.click(screen.getByTestId('show-out-of-stock-label'));
  expect(screen.getByTestId('show-out-of-stock').getAttribute('aria-checked')).toBe('true');
  expect(stored().showOutOfStock).toBe(true);
});

test('a tile field label toggles its field, and the name column label does nothing', () => {
  openSheet();
  fireEvent.click(screen.getByTestId('tile-field-toggle-price-label'));
  expect(screen.getByTestId('tile-field-toggle-price').getAttribute('aria-checked')).toBe('false');
  expect(stored().tileFields.price).toBe(false);
  fireEvent.click(screen.getByTestId('view-mode-segment-table'));
  fireEvent.click(screen.getByTestId('column-toggle-name-label'));
  expect(screen.getByTestId('column-toggle-name').getAttribute('aria-checked')).toBe('true');
  expect(stored().columns.find((column: { id: string }) => column.id === 'name').visible).toBe(true);
});

// react-native-web drops a ScrollView's contentContainerClassName from the DOM, so read it off the component that took the testID.
function contentClassesOf(testID: string): string[] {
  const node = screen.getByTestId(testID) as unknown as Record<string, unknown>;
  type Fiber = { memoizedProps?: { testID?: string; contentContainerClassName?: unknown }; return?: Fiber };
  for (let fiber = node[Object.keys(node).find(name => name.startsWith('__reactFiber$'))!] as Fiber | undefined; fiber; fiber = fiber.return) {
    const { contentContainerClassName: classes, testID: id } = fiber.memoizedProps ?? {};
    if (id === testID && typeof classes === 'string') return classes.split(/\s+/);
  }
  return [];
}

// The classes every component between a label's text node and its Pressable took (the Text has no testID of its own).
function labelTextClassesOf(pressableTestID: string): string[] {
  const text = screen.getByTestId(pressableTestID).firstElementChild as unknown as Record<string, unknown>;
  type Fiber = { memoizedProps?: { testID?: string; className?: unknown }; return?: Fiber };
  const found: string[] = [];
  for (let fiber = text[Object.keys(text).find(name => name.startsWith('__reactFiber$'))!] as Fiber | undefined; fiber; fiber = fiber.return) {
    const { className, testID } = fiber.memoizedProps ?? {};
    if (testID === pressableTestID) break;
    if (typeof className === 'string') found.push(...className.split(/\s+/));
  }
  return found;
}

test('a Tile Fields switch label takes v2\'s FormLabel style: muted, medium, leading-none, py-1', () => {
  openSheet();
  const classes = labelTextClassesOf('tile-field-toggle-price-label');
  expect(classes).toEqual(expect.arrayContaining(['text-muted-foreground', 'font-medium', 'leading-none', 'py-1', 'text-sm']));
  expect(classes).not.toContain('text-foreground');
});

test('the fields sit in v2\'s DialogBody list: gap-2 between them, px-4 py-1 round them', () => {
  openSheet();
  expect(contentClassesOf('catalogue-settings-list')).toEqual(['gap-2', 'px-4', 'py-1']);
});

test('a field is a plain FormItem row in that list, with no settings group round it', () => {
  openSheet();
  const list = screen.getByTestId('tile-size-field').parentElement!;
  expect(classesOf('tile-size-field')).toEqual(['gap-1.5']);
  expect(screen.getByTestId('show-out-of-stock-row').parentElement).toBe(list);
  expect(screen.getByTestId('tile-fields').parentElement).toBe(list);
  expect(classesOf('tile-fields')).toEqual(['gap-2', 'px-1', 'pt-2']);
  expect(screen.getByRole('heading', { name: 'Tile Fields' })).not.toBeNull();
});

test('the header holds only the title; the close sits over it, as v2\'s DialogContent places it', () => {
  openSheet();
  expect(classesOf('catalogue-settings-header')).toEqual(['pl-4', 'pr-11']);
  expect(screen.getByTestId('catalogue-settings-header').contains(screen.getByTestId('catalogue-settings-x'))).toBe(false);
  expect(screen.getByTestId('catalogue-settings-x').parentElement!.parentElement).toBe(screen.getByTestId('catalogue-settings'));
});

// v2's DialogTitle is 16 px leading-none, so the header row is 16 px tall and the first label sits at about 62 px.
test('the title keeps leading-none beside text-base, so the header row is v2\'s 16 px, not text-base\'s 24 px line', () => {
  openSheet();
  expect(screen.getByTestId('catalogue-settings-title').textContent).toBe('Product settings');
  const classes = classesOf('catalogue-settings-title');
  expect(classes).toEqual(expect.arrayContaining(['text-base', 'leading-none']));
  expect(classes).not.toContain('text-lg');
  expect(screen.getByTestId('catalogue-settings-header').contains(screen.getByTestId('catalogue-settings-title'))).toBe(true);
});

test('a switch row takes v2\'s 20 px switch layout: TallyUI\'s 24 px switch overhangs by -my-0.5', () => {
  openSheet();
  expect(classesOf('show-out-of-stock')).toContain('-my-0.5');
  expect(classesOf('tile-field-toggle-price')).toContain('-my-0.5');
});

test('the Sort By select takes v2\'s field box border, the light grey border token, not TallyUI\'s dark input border', () => {
  openSheet();
  const classes = classesOf('sort-by');
  expect(classes).toEqual(expect.arrayContaining(['border-border', 'bg-card']));
  expect(classes).not.toContain('border-input');
});

test('Close is v2\'s footer outline: a 1 px light border on the card, not the grey page fill', () => {
  openSheet();
  const classes = classesOf('catalogue-settings-close');
  expect(classes).toEqual(expect.arrayContaining(['border', 'border-border', 'bg-card']));
  expect(classes).not.toContain('border-input');
  expect(classes).not.toContain('bg-background');
  expect(screen.getByTestId('catalogue-settings-close').textContent).toBe('Close');
});

test('Tile Size\'s slider lays its track in a row and takes v2\'s 8 px track height in the list', () => {
  openSheet();
  expect(classesOf('tile-size')).toEqual(expect.arrayContaining(['flex-row', '-my-1.5']));
});

test('Tile Fields take v2\'s pos-products labels: the first switch reads "Product Name", the category one "Categories"', () => {
  openSheet();
  const rows = screen.getAllByTestId(/^tile-field-toggle-[a-z_]+-label$/);
  expect(rows[0].textContent).toBe('Product Name');
  expect(screen.getByRole('switch', { name: 'Show Product Name on tiles' })).not.toBeNull();
  expect(screen.getByTestId('tile-field-toggle-category-label').textContent).toBe('Categories');
});

test('each Tile Fields switch is v2\'s FormSwitch row, and pressing its label toggles it off and on', () => {
  openSheet();
  expect(classesOf('tile-field-toggle-name-row')).toEqual(['w-full', 'flex-row', 'items-center', 'gap-3']);
  fireEvent.click(screen.getByTestId('tile-field-toggle-name-label'));
  expect(screen.getByTestId('tile-field-toggle-name').getAttribute('aria-checked')).toBe('false');
  expect(stored().tileFields.name).toBe(false);
  fireEvent.click(screen.getByTestId('tile-field-toggle-name-label'));
  expect(screen.getByTestId('tile-field-toggle-name').getAttribute('aria-checked')).toBe('true');
});

test("the sliders icon's tooltip shows on hover and is gone once the sheet opens, as v2's web tooltip closes on click", () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  const button = screen.getByTestId('catalogue-settings-button');
  fireEvent.pointerEnter(button);
  expect(screen.getByRole('tooltip').textContent).toBe('Product settings');
  fireEvent.click(button);
  expect(screen.getByTestId('catalogue-settings')).not.toBeNull();
  expect(screen.queryByRole('tooltip')).toBeNull();
});

test("the sliders icon's tooltip closes when the pointer leaves, with no press, as v2's hover tooltip", () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  const button = screen.getByTestId('catalogue-settings-button');
  fireEvent.pointerEnter(button);
  expect(screen.getByRole('tooltip').textContent).toBe('Product settings');
  fireEvent.pointerLeave(button);
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(screen.queryByTestId('catalogue-settings')).toBeNull();
});

test('pressing the sliders icon with no hover opens the sheet and no tooltip', () => {
  openSheet();
  expect(screen.getByTestId('catalogue-settings')).not.toBeNull();
  expect(screen.queryByRole('tooltip')).toBeNull();
});

test("Restore Default Settings is v2's outline-destructive: a red border on the card, the label in the foreground", () => {
  openSheet();
  expect(classesOf('catalogue-settings-restore')).toEqual(expect.arrayContaining(['border-destructive', 'bg-card']));
  expect(classesOf('catalogue-settings-restore-label')).toContain('text-foreground');
  expect(classesOf('catalogue-settings-restore-label')).not.toContain('text-destructive');
});
