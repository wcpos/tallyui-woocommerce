import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { catalogueEntries, TaxProvider, useSale } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { CartSettingsDialog, CartWithSettings } from '../components/cart-settings';
import { CART_SETTINGS_KEY, loadCartSettings, normalizeQuickDiscounts, saveCartSettings, sortCartLines } from '../lib/sale/cart-settings';
import type { PanelPosition } from '../lib/catalogue/catalogue-view-state';
import { AppFrame, BESIDE_RAIL } from '../components/app-rail';
import { isWideWindow } from '../lib/layout/wide';
import { classesOf } from './classes-of';
import products from './fixtures/products.json';

// No RegisterProvider here, so useRegister is null (no register switch) unless a test hands the sheet a register.
const held = vi.hoisted(() => ({ register: null as null | { setting: boolean; setSetting(on: boolean): void } }));
vi.mock('../lib/register/register-context', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/register/register-context')>(),
  useRegister: () => held.register,
}));

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });

afterEach(() => {
  held.register = null;
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

const connector = createWooCommerceConnector();
const coldBrew = products[1];
const espresso = products[0];
const bananaBread = { ...products[0], id: 90, name: 'Banana Bread', price: '3.50', regular_price: '3.50' };

let latest: ReturnType<typeof useSale>;

type HarnessProps = { position?: PanelPosition; onPositionChange?(next: PanelPosition): void; canEditPrice?: boolean };

function Harness({ position = 'left', onPositionChange = () => {}, canEditPrice }: HarnessProps) {
  const sale = useSale({ currency: 'USD' }, { registerId: 'web', cashierRef: '2' });
  latest = sale;
  return <CartWithSettings sale={sale} position={position} onPositionChange={onPositionChange} canEditPrice={canEditPrice}
    openOrders={<span data-testid="open-orders-node" />} />;
}

function renderCart(props: HarnessProps = {}) {
  return render(<><TaxProvider ratesPpm={{}} pricesIncludeTax={false}><Harness {...props} /></TaxProvider><PortalHost /></>);
}

function addAll() {
  for (const p of [coldBrew, espresso, bananaBread]) {
    act(() => latest.add(catalogueEntries([p], connector.traits.product, { currency: 'USD' })[0], connector.traits.product));
  }
}

const shown = () => screen.getAllByRole('button', { name: /^Remove / }).map(b => b.getAttribute('aria-label'));
const kept = () => latest.order.lineItems.map(l => l.name);

test.each([
  ['newest_bottom', ['Zebra', 'Apple', 'Bear']],
  ['newest_top', ['Bear', 'Apple', 'Zebra']],
  ['name', ['Apple', 'Bear', 'Zebra']],
  ['price', ['Bear', 'Zebra', 'Apple']],
] as const)('sortCartLines %s orders the lines without mutating them', (sort, expected) => {
  const lines = [{ name: 'Zebra', unitPriceMinor: 200 }, { name: 'Apple', unitPriceMinor: 300 }, { name: 'Bear', unitPriceMinor: 100 }];
  const before = lines.map(line => ({ ...line }));
  const sorted = sortCartLines(lines, sort);
  expect(sorted.map(line => line.name)).toEqual(expected);
  expect(lines).toEqual(before);
  expect(sorted).not.toBe(lines);
});

test('sortCartLines keeps the add order between equal names and equal prices', () => {
  const lines = [{ id: 'a', name: 'Tea', unitPriceMinor: 300 }, { id: 'b', name: 'Tea', unitPriceMinor: 300 }];
  expect(sortCartLines(lines, 'name').map(line => line.id)).toEqual(['a', 'b']);
  expect(sortCartLines(lines, 'price').map(line => line.id)).toEqual(['a', 'b']);
});

test('saved cart settings load with newest at top as the fallback', () => {
  const storage = memoryStorage();
  expect(loadCartSettings(storage)).toEqual({ sortLines: 'newest_top', openOrdersPosition: 'bottom', quickDiscounts: [5, 10, 15] });
  storage.setItem(CART_SETTINGS_KEY, '{"sortLines":"price"}');
  expect(loadCartSettings(storage).sortLines).toBe('price');
  storage.setItem(CART_SETTINGS_KEY, '{"sortLines":"oldest"}');
  expect(loadCartSettings(storage).sortLines).toBe('newest_top');
  storage.setItem(CART_SETTINGS_KEY, 'not json');
  expect(loadCartSettings(storage).sortLines).toBe('newest_top');
  const throwing = { ...memoryStorage(), getItem: () => { throw new Error('blocked'); } } as Storage;
  expect(loadCartSettings(throwing).sortLines).toBe('newest_top');
});

test('saving cart settings writes the device key and ignores a refusing storage', () => {
  const storage = memoryStorage();
  saveCartSettings({ sortLines: 'name', openOrdersPosition: 'bottom', quickDiscounts: [5, 10, 15] }, storage);
  expect(storage.getItem(CART_SETTINGS_KEY)).toBe('{"sortLines":"name","openOrdersPosition":"bottom","quickDiscounts":[5,10,15]}');
  const refusing = { ...memoryStorage(), setItem: () => { throw new Error('full'); } } as Storage;
  expect(() => saveCartSettings({ sortLines: 'name', openOrdersPosition: 'bottom', quickDiscounts: [5, 10, 15] }, refusing)).not.toThrow();
});

test('the cart shows the newest line at the top by default and leaves the order alone', () => {
  renderCart();
  addAll();
  expect(shown()).toEqual(['Remove Banana Bread', 'Remove Espresso', 'Remove Cold Brew']);
  expect(kept()).toEqual(['Cold Brew', 'Espresso', 'Banana Bread']);
});

test('choosing a sort in Cart Settings reorders the shown lines and saves it for this device', () => {
  renderCart();
  addAll();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  const dialog = screen.getByTestId('cart-settings');
  expect(within(dialog).getByText('Cart Settings')).not.toBeNull();
  expect(screen.getByTestId('cart-sort-items-hint').textContent).toBe('Fees and shipping always stay last');
  expect(screen.getByTestId('cart-sort-items').textContent).toBe('Newest at top');
  fireEvent.click(screen.getByTestId('cart-sort-items'));
  fireEvent.click(screen.getByTestId('cart-sort-items-option-name'));
  expect(shown()).toEqual(['Remove Banana Bread', 'Remove Cold Brew', 'Remove Espresso']);
  expect(screen.getByTestId('cart-sort-items').textContent).toBe('Name');
  expect(localStorage.getItem(CART_SETTINGS_KEY)).toBe('{"sortLines":"name","openOrdersPosition":"bottom","quickDiscounts":[5,10,15]}');
  expect(kept()).toEqual(['Cold Brew', 'Espresso', 'Banana Bread']);
  fireEvent.click(screen.getByTestId('cart-sort-items'));
  fireEvent.click(screen.getByTestId('cart-sort-items-option-price'));
  expect(shown()).toEqual(['Remove Espresso', 'Remove Banana Bread', 'Remove Cold Brew']);
  expect(kept()).toEqual(['Cold Brew', 'Espresso', 'Banana Bread']);
});

test('a saved sort applies when the cart opens', () => {
  localStorage.setItem(CART_SETTINGS_KEY, '{"sortLines":"newest_bottom"}');
  renderCart();
  addAll();
  expect(shown()).toEqual(['Remove Cold Brew', 'Remove Espresso', 'Remove Banana Bread']);
});

test('Cart left and Cart right show the side and report the products side', () => {
  const onPositionChange = vi.fn();
  renderCart({ position: 'left', onPositionChange });
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(within(screen.getByTestId('cart-settings')).getByText('Panel position')).not.toBeNull();
  expect(screen.getByTestId('cart-setting-panel-position')).not.toBeNull();
  expect(screen.getByTestId('cart-setting-panel-position-right').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('cart-setting-panel-position-left').getAttribute('aria-selected')).toBe('false');
  fireEvent.click(screen.getByTestId('cart-setting-panel-position-left'));
  expect(onPositionChange).toHaveBeenLastCalledWith('right');
  fireEvent.click(screen.getByTestId('cart-setting-panel-position-right'));
  expect(onPositionChange).toHaveBeenLastCalledWith('left');
});

test('without a register provider, Cart Settings has no Register sessions group', () => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  const settings = within(screen.getByTestId('cart-settings'));
  expect(settings.getByText('Panel position')).not.toBeNull();
  expect(settings.queryByText('Register sessions')).toBeNull();
  expect(settings.queryByRole('switch', { name: 'Use register sessions' })).toBeNull();
});

test('Restore Default Settings puts the cart right and newest at top and keeps the dialog open', () => {
  localStorage.setItem(CART_SETTINGS_KEY, '{"sortLines":"price"}');
  const onPositionChange = vi.fn();
  renderCart({ position: 'right', onPositionChange });
  addAll();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  fireEvent.click(screen.getByTestId('ui-settings-restore-defaults'));
  expect(onPositionChange).toHaveBeenCalledWith('left');
  expect(localStorage.getItem(CART_SETTINGS_KEY)).toBe('{"sortLines":"newest_top","openOrdersPosition":"bottom","quickDiscounts":[5,10,15]}');
  expect(shown()).toEqual(['Remove Banana Bread', 'Remove Espresso', 'Remove Cold Brew']);
  expect(screen.getByTestId('cart-settings')).not.toBeNull();
  fireEvent.click(screen.getByTestId('ui-settings-close'));
  expect(screen.queryByTestId('cart-settings')).toBeNull();
});

test("Restore Default Settings is v2's outline-destructive: a red border on the card, the label in the foreground", () => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(classesOf('ui-settings-restore-defaults')).toEqual(expect.arrayContaining(['border-destructive', 'bg-card']));
  expect(classesOf('ui-settings-restore-defaults-label')).toContain('text-foreground');
  expect(classesOf('ui-settings-restore-defaults-label')).not.toContain('text-destructive');
});

test('open orders position loads as bottom unless top was saved, keeping an older sort', () => {
  const storage = memoryStorage();
  expect(loadCartSettings(storage).openOrdersPosition).toBe('bottom');
  storage.setItem(CART_SETTINGS_KEY, '{"sortLines":"name"}');
  expect(loadCartSettings(storage)).toEqual({ sortLines: 'name', openOrdersPosition: 'bottom', quickDiscounts: [5, 10, 15] });
  storage.setItem(CART_SETTINGS_KEY, '{"sortLines":"name","openOrdersPosition":"sideways"}');
  expect(loadCartSettings(storage).openOrdersPosition).toBe('bottom');
  storage.setItem(CART_SETTINGS_KEY, '{"sortLines":"name","openOrdersPosition":"top"}');
  expect(loadCartSettings(storage).openOrdersPosition).toBe('top');
});

test('Open orders position shows Bottom selected and Top keeps the other settings', () => {
  const onSettingsChange = vi.fn();
  render(<><CartSettingsDialog position="left" onPositionChange={() => {}}
    settings={{ sortLines: 'name', openOrdersPosition: 'bottom', quickDiscounts: [5, 10, 15] }} onSettingsChange={onSettingsChange} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(within(screen.getByTestId('cart-settings')).getByText('Open orders position')).not.toBeNull();
  expect(screen.getByTestId('cart-setting-open-orders-top').textContent).toBe('Top');
  expect(screen.getByTestId('cart-setting-open-orders-bottom').textContent).toBe('Bottom');
  expect(screen.getByTestId('cart-setting-open-orders-bottom').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('cart-setting-open-orders-top').getAttribute('aria-selected')).toBe('false');
  fireEvent.click(screen.getByTestId('cart-setting-open-orders-top'));
  expect(onSettingsChange).toHaveBeenLastCalledWith({ sortLines: 'name', openOrdersPosition: 'top', quickDiscounts: [5, 10, 15] });
});

const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

test('the open orders strip sits below the cart by default', () => {
  renderCart();
  const strip = screen.getByTestId('cart-open-orders');
  expect(strip.contains(screen.getByTestId('open-orders-node'))).toBe(true);
  expect(follows(screen.getByTestId('cart-head'), strip)).toBe(true);
});

test('a saved top puts the open orders strip above the cart head', () => {
  localStorage.setItem(CART_SETTINGS_KEY, '{"sortLines":"newest_top","openOrdersPosition":"top"}');
  renderCart();
  expect(follows(screen.getByTestId('cart-open-orders'), screen.getByTestId('cart-head'))).toBe(true);
});

test('normalizeQuickDiscounts keeps up to three valid percents in order and defaults anything that is not an array', () => {
  expect(normalizeQuickDiscounts(undefined)).toEqual([5, 10, 15]);
  expect(normalizeQuickDiscounts('5,10')).toEqual([5, 10, 15]);
  expect(normalizeQuickDiscounts({ 0: 5 })).toEqual([5, 10, 15]);
  expect(normalizeQuickDiscounts([15, 5, 10])).toEqual([15, 5, 10]);
  expect(normalizeQuickDiscounts([0, 20, -5, 150, Number.NaN, Number.POSITIVE_INFINITY, '30', 100])).toEqual([20, 100]);
  expect(normalizeQuickDiscounts([2.5, 5, 10, 15, 20])).toEqual([2.5, 5, 10]);
  expect(normalizeQuickDiscounts([])).toEqual([]);
});

test('settings saved before quick discounts load the default keys and keep their sort', () => {
  const storage = memoryStorage();
  storage.setItem(CART_SETTINGS_KEY, '{"sortLines":"price","openOrdersPosition":"top"}');
  expect(loadCartSettings(storage)).toEqual({ sortLines: 'price', openOrdersPosition: 'top', quickDiscounts: [5, 10, 15] });
  storage.setItem(CART_SETTINGS_KEY, '{"sortLines":"price","quickDiscounts":[]}');
  expect(loadCartSettings(storage).quickDiscounts).toEqual([]);
});

const slot = (i: number) => screen.getByTestId(`cart-setting-quick-discount-${i}`) as HTMLInputElement;
const slots = () => [0, 1, 2].map(i => slot(i).value);
const storedKeys = () => JSON.parse(localStorage.getItem(CART_SETTINGS_KEY) ?? '{}').quickDiscounts;
function enter(i: number, value: string) {
  fireEvent.focus(slot(i));
  fireEvent.change(slot(i), { target: { value } });
  fireEvent.blur(slot(i));
}

test('Quick Discounts shows the three keys and writes a changed or emptied slot in slot order', () => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(within(screen.getByTestId('cart-settings')).getByText('Quick Discounts')).not.toBeNull();
  expect(slots()).toEqual(['−5%', '−10%', '−15%']);
  expect(slot(0).getAttribute('aria-label')).toBe('Quick discount 1');
  expect(slot(2).getAttribute('aria-label')).toBe('Quick discount 3');
  expect(screen.getByTestId('cart-setting-quick-discounts-hint').textContent)
    .toBe('As the cashier sees them on the price keypad. Tap a key to change it.');
  enter(1, '20');
  expect(storedKeys()).toEqual([5, 20, 15]);
  expect(slots()).toEqual(['−5%', '−20%', '−15%']);
  enter(0, '');
  expect(storedKeys()).toEqual([20, 15]);
  expect(slots()).toEqual(['−20%', '−15%', '']);
  enter(1, '0');
  expect(storedKeys()).toEqual([20]);
  expect(slots()).toEqual(['−20%', '', '']);
  expect(JSON.parse(localStorage.getItem(CART_SETTINGS_KEY)!).sortLines).toBe('newest_top');
});

test.each(['150', '-5', 'abc'])('a quick discount of %s is refused inline and leaves the stored keys alone', value => {
  localStorage.setItem(CART_SETTINGS_KEY, '{"sortLines":"name","openOrdersPosition":"bottom","quickDiscounts":[5,10,15]}');
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  enter(1, value);
  expect(screen.getByTestId('cart-setting-quick-discounts-hint').textContent).toBe('Enter a percentage above 0 and up to 100');
  expect(slot(1).getAttribute('aria-invalid')).toBe('true');
  expect(slot(0).getAttribute('aria-invalid')).not.toBe('true');
  expect(localStorage.getItem(CART_SETTINGS_KEY)).toBe('{"sortLines":"name","openOrdersPosition":"bottom","quickDiscounts":[5,10,15]}');
  enter(1, '25');
  expect(storedKeys()).toEqual([5, 25, 15]);
  expect(screen.getByTestId('cart-setting-quick-discounts-hint').textContent)
    .toBe('As the cashier sees them on the price keypad. Tap a key to change it.');
});

test('with every quick discount slot emptied, the none text shows and the empty list is kept', () => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  enter(0, '');
  enter(0, '');
  enter(0, '');
  expect(slots()).toEqual(['', '', '']);
  expect(storedKeys()).toEqual([]);
  expect(screen.getByTestId('cart-setting-quick-discounts-hint').textContent).toBe('No quick keys. The price keypad shows the digits only.');
  expect(loadCartSettings().quickDiscounts).toEqual([]);
});

test('Restore Default Settings brings back the 5, 10 and 15 quick discounts', () => {
  localStorage.setItem(CART_SETTINGS_KEY, '{"sortLines":"name","openOrdersPosition":"bottom","quickDiscounts":[20]}');
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(slots()).toEqual(['−20%', '', '']);
  fireEvent.click(screen.getByTestId('ui-settings-restore-defaults'));
  expect(slots()).toEqual(['−5%', '−10%', '−15%']);
  expect(storedKeys()).toEqual([5, 10, 15]);
});

test("a line's Price form shows the quick discounts from Cart Settings and follows a change", () => {
  renderCart({ canEditPrice: true });
  act(() => latest.add(catalogueEntries([espresso], connector.traits.product, { currency: 'USD' })[0], connector.traits.product));
  fireEvent.click(screen.getByText('Price', { exact: true }));
  const keys = () => within(screen.getByTestId('price-quick-discounts')).getAllByRole('button').map(key => key.textContent);
  expect(keys()).toEqual(['−5%', '−10%', '−15%']);
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  enter(0, '20');
  enter(1, '');
  enter(1, '');
  expect(storedKeys()).toEqual([20]);
  fireEvent.click(screen.getByTestId('ui-settings-close'));
  expect(keys()).toEqual(['−20%']);
});

test.each([
  ['the ✕', () => fireEvent.click(screen.getByTestId('cart-settings-x'))],
  ['Close', () => fireEvent.click(screen.getByTestId('ui-settings-close'))],
  ['Escape', () => fireEvent.keyDown(screen.getByTestId('cart-settings'), { key: 'Escape' })],
] as const)('%s closes the Cart Settings sheet', (_how, close) => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(screen.getByTestId('cart-settings-x').getAttribute('aria-label')).toBe('Close');
  close();
  expect(screen.queryByTestId('cart-settings')).toBeNull();
});

test('the header holds only the title; the close is an h-ctl square over it at top-1 right-1, as v2\'s DialogContent places it', () => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(classesOf('cart-settings-header')).toEqual(['pl-4', 'pr-11']);
  expect(screen.getByTestId('cart-settings-header').textContent).toBe('Cart Settings');
  expect(screen.getByTestId('cart-settings-header').contains(screen.getByTestId('cart-settings-x'))).toBe(false);
  expect(classesOf('cart-settings-close-slot')).toEqual(['absolute', 'right-1', 'top-1']);
  expect(screen.getByTestId('cart-settings-close-slot').parentElement).toBe(screen.getByTestId('cart-settings'));
  expect(screen.getByTestId('cart-settings-close-slot').contains(screen.getByTestId('cart-settings-x'))).toBe(true);
  expect(classesOf('cart-settings-x')).toEqual(expect.arrayContaining(['h-11', 'w-11']));
});

test('the Cart Settings title takes v2\'s dialog title rank, text-base', () => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(screen.getByTestId('cart-settings-title').textContent).toBe('Cart Settings');
  expect(classesOf('cart-settings-title')).toContain('text-base');
  // v2's 16 px leading-none: without it TallyUI's merge leaves text-base's 24 px line and the rows start 8 px low.
  expect(classesOf('cart-settings-title')).toContain('leading-none');
  expect(classesOf('cart-settings-title')).not.toContain('text-lg');
});

test('the Sort items select takes v2\'s field box border, the light grey border token, not TallyUI\'s dark input border', () => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(classesOf('cart-sort-items')).toEqual(expect.arrayContaining(['border-border', 'bg-card']));
  expect(classesOf('cart-sort-items')).not.toContain('border-input');
});

test('Close is v2\'s footer outline: a 1 px light border on the card, not the grey page fill', () => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  const classes = classesOf('ui-settings-close');
  expect(classes).toEqual(expect.arrayContaining(['border', 'border-border', 'bg-card']));
  expect(classes).not.toContain('border-input');
  expect(classes).not.toContain('bg-background');
});

test.each(['left', 'right'] as const)('with the products on the %s, the sheet docks over them as v2 docks it', position => {
  renderCart({ position });
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(screen.getByTestId('cart-settings').getAttribute('data-side')).toBe(position);
});

function PositionHarness() {
  const [position, setPosition] = useState<PanelPosition>('left');
  return <Harness position={position} onPositionChange={setPosition} />;
}

test('pressing a Panel position cell selects it and moves the sheet to the products side', () => {
  render(<><TaxProvider ratesPpm={{}} pricesIncludeTax={false}><PositionHarness /></TaxProvider><PortalHost /></>);
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  const cell = (side: string) => screen.getByTestId(`cart-setting-panel-position-${side}`);
  expect(cell('right').getAttribute('aria-selected')).toBe('true');
  fireEvent.click(cell('left'));
  expect(cell('left').getAttribute('aria-selected')).toBe('true');
  expect(cell('right').getAttribute('aria-selected')).toBe('false');
  expect(screen.getByTestId('cart-settings').getAttribute('data-side')).toBe('right');
  fireEvent.click(cell('right'));
  expect(cell('right').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('cart-settings').getAttribute('data-side')).toBe('left');
});

test('pressing an Open orders position cell selects it and saves it', () => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  const cell = (where: string) => screen.getByTestId(`cart-setting-open-orders-${where}`);
  const savedPosition = () => JSON.parse(localStorage.getItem(CART_SETTINGS_KEY) ?? '{}').openOrdersPosition;
  fireEvent.click(cell('top'));
  expect(cell('top').getAttribute('aria-selected')).toBe('true');
  expect(cell('bottom').getAttribute('aria-selected')).toBe('false');
  expect(savedPosition()).toBe('top');
  fireEvent.click(cell('bottom'));
  expect(cell('bottom').getAttribute('aria-selected')).toBe('true');
  expect(cell('top').getAttribute('aria-selected')).toBe('false');
  expect(savedPosition()).toBe('bottom');
});

test('a quick discount slot reads as its key at rest and as the plain number while it is edited', () => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(slots()).toEqual(['−5%', '−10%', '−15%']);
  fireEvent.focus(slot(0));
  expect(slot(0).value).toBe('5');
  expect(slots().slice(1)).toEqual(['−10%', '−15%']);
  fireEvent.change(slot(0), { target: { value: '20' } });
  expect(slot(0).value).toBe('20');
  fireEvent.blur(slot(0));
  expect(storedKeys()).toEqual([20, 10, 15]);
  expect(slots()).toEqual(['−20%', '−10%', '−15%']);
  fireEvent.focus(slot(2));
  fireEvent.blur(slot(2));
  expect(slots()).toEqual(['−20%', '−10%', '−15%']);
  expect(storedKeys()).toEqual([20, 10, 15]);
});

function Framed({ wide, position, pathname = '/catalogue' }: { wide: boolean; position: PanelPosition; pathname?: string }) {
  return <><AppFrame wide={wide} pathname={pathname} onNavigate={() => {}}>
    <TaxProvider ratesPpm={{}} pricesIncludeTax={false}><Harness position={position} /></TaxProvider>
  </AppFrame><PortalHost /></>;
}

function renderInFrame(wide: boolean, position: PanelPosition) {
  render(<Framed wide={wide} position={position} />);
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  return classesOf('cart-settings');
}

test('at 1280px a left sheet\'s backdrop starts beside the rail, which stays undimmed; on a phone it fills the window', () => {
  renderInFrame(isWideWindow({ width: 1280, height: 800 }), 'left');
  expect(classesOf('cart-settings-overlay')).toContain(BESIDE_RAIL);
  cleanup();
  renderInFrame(false, 'left');
  expect(classesOf('cart-settings-overlay')).toContain('inset-0');
  expect(classesOf('cart-settings-overlay')).not.toContain(BESIDE_RAIL);
});

test('a tap on the backdrop closes the sheet', () => {
  renderInFrame(true, 'left');
  fireEvent.click(screen.getByTestId('cart-settings-overlay'));
  expect(screen.queryByTestId('cart-settings')).toBeNull();
});

test('leaving the sale screen from the rail closes the sheet, so it never floats over the next area', () => {
  const { rerender } = render(<Framed wide position="left" />);
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(screen.getByTestId('cart-settings')).not.toBeNull();
  rerender(<Framed wide position="left" pathname="/orders" />);
  expect(screen.queryByTestId('cart-settings')).toBeNull();
});

test('the receipt switches are two plain rows, switch then label, with no group round them', () => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  const list = screen.getByTestId('cart-sort-items-row').parentElement;
  const show = screen.getByTestId('cart-setting-auto-show-receipt-row');
  const print = screen.getByTestId('cart-setting-auto-print-receipt-row');
  expect(show.parentElement).toBe(list);
  expect(print.parentElement!.parentElement).toBe(list);
  for (const id of ['cart-setting-auto-show-receipt-row', 'cart-setting-auto-print-receipt-row']) {
    expect(classesOf(id)).toEqual(['w-full', 'flex-row', 'items-center', 'gap-3']);
  }
  expect(show.firstElementChild!.contains(screen.getByTestId('cart-setting-auto-show-receipt'))).toBe(true);
  expect(within(screen.getByTestId('cart-settings')).queryByText('Receipt')).toBeNull();
});

test('at 1280px a left sheet starts at the rail\'s right edge, as v2\'s sits beside its rail', () => {
  const sheet = renderInFrame(isWideWindow({ width: 1280, height: 800 }), 'left');
  expect(screen.getByTestId('drawer-panel-permanent')).not.toBeNull();
  expect(sheet).toContain(BESIDE_RAIL);
  expect(sheet).not.toContain('left-0');
});

test.each([
  ['a phone (no rail), left', false, 'left', ['left-0']],
  ['1280px, right', true, 'right', ['left-auto', 'right-0']],
] as const)('on %s the sheet keeps its edge', (_where, wide, position, edge) => {
  const sheet = renderInFrame(wide, position);
  expect(sheet).toEqual(expect.arrayContaining([...edge]));
  expect(sheet).not.toContain(BESIDE_RAIL);
});

test('Sort items is a plain labelled row, as v2 draws it, and its trigger ends in a chevron', () => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  const row = screen.getByTestId('cart-sort-items-row');
  expect(within(row).getByText('Sort items')).not.toBeNull();
  expect(classesOf('cart-sort-items-row')).toEqual(['gap-1']);
  // Nothing wraps the row: it sits in the sheet's list beside Panel position's row.
  expect(row.parentElement).toBe(screen.getByTestId('cart-setting-panel-position').parentElement!.parentElement);
  expect(screen.getByTestId('cart-sort-items').contains(screen.getByTestId('cart-sort-items-chevron'))).toBe(true);
});

test('pressing a receipt row\'s label toggles its switch, as v2\'s FormSwitch label does', () => {
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  const toggle = screen.getByTestId('cart-setting-auto-show-receipt');
  const before = toggle.getAttribute('aria-checked');
  fireEvent.click(screen.getByTestId('cart-setting-auto-show-receipt-label'));
  expect(screen.getByTestId('cart-setting-auto-show-receipt').getAttribute('aria-checked')).toBe(before === 'true' ? 'false' : 'true');
});

test('in the cart sheet the register switch is a plain row, without the p-4 a settings group gives it', () => {
  held.register = { setting: false, setSetting: () => {} };
  renderCart();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(within(screen.getByTestId('cart-settings')).getByText('Register sessions')).not.toBeNull();
  expect(classesOf('register-switch-row')).toEqual(['flex-row', 'items-center', 'gap-3']);
});
