import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen as SaleScreenWithoutHost, type SaleScreenProps } from '../components/sale-screen';
import { parkedCartSchema, parkedCartMigrationStrategies, type ParkedCartCollection } from '../lib/sale/parked-carts';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { parkedTabs } from './open-orders-helpers';
import { CashierSheet } from '../components/cashier-sheet';
import { classesOf } from './classes-of';

function SaleScreen(props: SaleScreenProps) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

// The Cart sets no testID on a line. Each line sits in its own wrapper: the CartLine row first
// (Qty, Item, Price when the cart is wide enough, Total cells), then the line's actions, Increase <name> among them.
// unitPrice is undefined when the Price column folds away.
function cartLine(name: string) {
  // By its aria-label, not getByRole: a role query re-reads every button's name and is slow inside waitFor.
  let node: HTMLElement | null = screen.getByLabelText(`Increase ${name}`);
  while (node && !(node.firstElementChild && within(node.firstElementChild as HTMLElement).queryByText(name))) node = node.parentElement;
  if (!node) throw new Error(`No cart line for ${name}`);
  const cells = Array.from(node.firstElementChild!.children);
  // Collapses whitespace as getByText's default normalizer does.
  const text = (cell: Element) => cell.textContent!.replace(/\s+/g, ' ').trim();
  return {
    quantity: text(cells[0]),
    unitPrice: cells.length === 4 ? text(cells[2].lastElementChild!) : undefined,
    total: text(cells[cells.length - 1]),
  };
}

addRxPlugin(RxDBMigrationSchemaPlugin);

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
  cashiers: [{ uuid: 'b', name: 'Sam' }], heldCartKey: 'held-test',
  onSwitchCashier: async () => null,
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
  vi.stubGlobal('localStorage', storage);
});

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => { localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function withParkedCarts(run: (parkedCarts: ParkedCartCollection) => Promise<void>) {
  const db = await createRxDatabase({
    name: `cashier_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  try {
    const { parked_carts: parkedCarts } = await db.addCollections<{ parked_carts: ParkedCartCollection }>({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    await run(parkedCarts);
  } finally {
    cleanup();
    await db.remove();
  }
}

test('the sheet lists the other cashiers and switches to the chosen one', async () => {
  await withParkedCarts(async parkedCarts => {
    const onSwitchCashier = vi.fn(async () => null);
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onSwitchCashier={onSwitchCashier} />);
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    expect(within(screen.getByTestId('user-sheet')).getByText('Switch to Sam')).not.toBeNull();
    fireEvent.click(screen.getByTestId('user-sheet-user-b'));
    await waitFor(() => expect(onSwitchCashier).toHaveBeenCalledWith('b'));
    expect(screen.queryByTestId('user-sheet')).toBeNull();
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(localStorage.getItem('held-test')).toBeNull();
  });
});

test('Remove in the sheet asks first, then removes the chosen cashier', async () => {
  await withParkedCarts(async parkedCarts => {
    const onRemoveCashier = vi.fn();
    const onSwitchCashier = vi.fn(async () => null);
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onRemoveCashier={onRemoveCashier} onSwitchCashier={onSwitchCashier} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    fireEvent.click(screen.getByTestId('user-sheet-remove-b'));
    expect(screen.getByText('Remove Sam')).not.toBeNull();
    expect(screen.getByText('Are you sure you want to remove this user? Removing a user from the POS will not affect any data on the server.')).not.toBeNull();
    expect(onRemoveCashier).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('user-sheet-remove-confirm'));
    expect(onRemoveCashier).toHaveBeenCalledExactlyOnceWith('b');
    expect(onSwitchCashier).not.toHaveBeenCalled();
    expect(screen.getByTestId('user-sheet')).not.toBeNull();
    expect(screen.queryByTestId('user-sheet-remove-confirm')).toBeNull();
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(localStorage.getItem('held-test')).toBeNull();
  });
});

test('cancelling a remove keeps the cashier', async () => {
  await withParkedCarts(async parkedCarts => {
    const onRemoveCashier = vi.fn();
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onRemoveCashier={onRemoveCashier} />);
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    fireEvent.click(screen.getByTestId('user-sheet-remove-b'));
    fireEvent.click(screen.getByTestId('user-sheet-remove-cancel'));
    expect(onRemoveCashier).not.toHaveBeenCalled();
    expect(screen.queryByText('Are you sure you want to remove this user? Removing a user from the POS will not affect any data on the server.')).toBeNull();
    expect(screen.getByText('Switch to Sam')).not.toBeNull();
  });
});

test('without onRemoveCashier the sheet shows no remove button', async () => {
  await withParkedCarts(async parkedCarts => {
    render(<SaleScreen {...props} parkedCarts={parkedCarts} />);
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    expect(screen.queryByTestId('user-sheet-remove-b')).toBeNull();
  });
});

test('switching with a cart parks it under the held-cart key before switching', async () => {
  await withParkedCarts(async parkedCarts => {
    const onSwitchCashier = vi.fn(async () => {
      const docs = await parkedCarts.find().exec();
      expect(docs).toHaveLength(1);
      expect(docs[0].toJSON()).toMatchObject({ lines: [{ name: 'Espresso', quantity: 1 }] });
      expect(localStorage.getItem('held-test')).toBe(docs[0].id);
      return null;
    });
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onSwitchCashier={onSwitchCashier} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    fireEvent.click(screen.getByTestId('user-sheet-user-b'));
    await waitFor(() => expect(onSwitchCashier).toHaveBeenCalledWith('b'));
    await onSwitchCashier.mock.results[0].value;
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull());
    expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
  });
});

test('a failed switch shows the message and puts the cart back', async () => {
  await withParkedCarts(async parkedCarts => {
    const error = 'Could not switch cashier. Check the connection and try again.';
    const onSwitchCashier = vi.fn(async () => error);
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onSwitchCashier={onSwitchCashier} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    fireEvent.click(screen.getByTestId('user-sheet-user-b'));
    await waitFor(() => expect(onSwitchCashier).toHaveBeenCalledWith('b'));
    await screen.findByText(error);
    await screen.findByRole('button', { name: 'Remove Espresso' });
    await waitFor(async () => expect(await parkedCarts.find().exec()).toEqual([]));
    expect(localStorage.getItem('held-test')).toBeNull();
    expect(screen.getByText(error)).not.toBeNull();
  });
});

test('a held cart comes back when its cashier\'s screen mounts once the catalogue is ready', async () => {
  await withParkedCarts(async parkedCarts => {
    const cart = await parkedCarts.insert({
      id: crypto.randomUUID(), parkedAt: new Date().toISOString(), itemCount: 2, totalMinor: 600,
      lines: [{ productId: '80', variantId: '80', name: 'Espresso', quantity: 2, discounts: [] }], orderDiscounts: [],
    });
    localStorage.setItem('held-test', cart.id);
    const view = render(<SaleScreen {...props} parkedCarts={parkedCarts} status="syncing" />);
    await waitFor(() => expect(parkedTabs()).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull();
    expect(localStorage.getItem('held-test')).toBe(cart.id);
    expect(await parkedCarts.find().exec()).toHaveLength(1);
    view.rerender(<SaleScreen {...props} parkedCarts={parkedCarts} status="ready" />);
    await waitFor(() => expect(cartLine('Espresso')).toEqual({ quantity: '2', unitPrice: '$3.00', total: '$6.00' }));
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(localStorage.getItem('held-test')).toBeNull();
  });
}, 20_000);

test('Another account holds the cart and starts the sign-in', async () => {
  await withParkedCarts(async parkedCarts => {
    const onAddCashier = vi.fn();
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onAddCashier={onAddCashier} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    fireEvent.click(screen.getByTestId('user-sheet-another-account'));
    await waitFor(() => expect(onAddCashier).toHaveBeenCalledTimes(1));
    const docs = await parkedCarts.find().exec();
    expect(docs).toHaveLength(1);
    expect(docs[0].toJSON()).toMatchObject({ lines: [{ name: 'Espresso', quantity: 1 }] });
    expect(localStorage.getItem('held-test')).toBe(docs[0].id);
    expect(screen.queryByTestId('user-sheet')).toBeNull();
  });
});

test('the cashier button is disabled while taking payment', async () => {
  await withParkedCarts(async parkedCarts => {
    render(<SaleScreen {...props} parkedCarts={parkedCarts} />);
    fireEvent.click(screen.getByText('Espresso'));
    // At 900px the cart is already open alongside the catalogue.
    fireEvent.click(screen.getByTestId('cart-checkout'));
    const button = screen.getByTestId('register-bar-avatar');
    expect(button.getAttribute('aria-disabled') === 'true' || button.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Finish or cancel the payment first.')).not.toBeNull();
    fireEvent.click(button);
    expect(screen.queryByTestId('user-sheet')).toBeNull();
  });
});

test('Sign out in the sheet calls onSignOut', async () => {
  await withParkedCarts(async parkedCarts => {
    const onSignOut = vi.fn();
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    fireEvent.click(screen.getByTestId('user-sheet-sign-out'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('user-sheet')).toBeNull();
  });
});

test('without onSwitchCashier the header keeps the cashier name and Sign out button', async () => {
  await withParkedCarts(async parkedCarts => {
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onSwitchCashier={undefined} />);
    expect(screen.getByText('Cashier: Paul')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).not.toBeNull();
    expect(screen.queryByTestId('register-bar-avatar')).toBeNull();
  });
});

test('a cart held for a switch that is still pending stays parked on the same screen', async () => {
  await withParkedCarts(async parkedCarts => {
    let resolveSwitch!: (result: string | null) => void;
    const pending = new Promise<string | null>(resolve => { resolveSwitch = resolve; });
    const onSwitchCashier = vi.fn(() => pending);
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onSwitchCashier={onSwitchCashier} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    fireEvent.click(screen.getByTestId('user-sheet-user-b'));
    await waitFor(async () => expect(await parkedCarts.find().exec()).toHaveLength(1));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    const docs = await parkedCarts.find().exec();
    expect(docs).toHaveLength(1);
    expect(docs[0].toJSON()).toMatchObject({ lines: [{ name: 'Espresso', quantity: 1 }] });
    expect(localStorage.getItem('held-test')).toBe(docs[0].id);
    expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull();
    expect(onSwitchCashier).toHaveBeenCalledWith('b');
    await act(async () => { resolveSwitch(null); await pending; });
  });
});

// v2's sheet layout (monorepo packages/core/src/screens/main/pos/cart/user-sheet.tsx): × and avatar in the header,
// a quiet + row under the caption, the WordPress Admin link with its glyph, Sign out and Close in the footer.
function openSheet(extra: Partial<Parameters<typeof CashierSheet>[0]> = {}) {
  const handlers = { onAddAnother: vi.fn(), onSignOut: vi.fn() };
  render(<><CashierSheet name="Bob Ross" cashiers={[]} onSwitch={() => {}} {...handlers} {...extra} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('register-bar-avatar'));
  return handlers;
}

test.each(['user-sheet-close-x', 'user-sheet-close'])('%s closes the sheet', testID => {
  openSheet();
  expect(screen.getByTestId('user-sheet-avatar').textContent).toBe('BR');
  expect(screen.getByTestId('user-sheet-close-x').getAttribute('aria-label')).toBe('Close');
  fireEvent.click(screen.getByTestId(testID));
  expect(screen.queryByTestId('user-sheet')).toBeNull();
});

test('Another account is a quiet + row, not a filled button', () => {
  const { onAddAnother } = openSheet();
  const row = screen.getByTestId('user-sheet-another-account');
  expect(row.textContent).toBe('Another account…');
  expect(within(row).getByTestId('user-sheet-another-account-icon')).not.toBeNull();
  expect(classesOf('user-sheet-another-account')).toEqual(expect.arrayContaining(['min-h-11', 'px-2.5', 'web:hover:bg-accent']));
  expect(classesOf('user-sheet-another-account')).not.toContain('bg-primary');
  fireEvent.click(row);
  expect(onAddAnother).toHaveBeenCalledTimes(1);
});

test('Sign out is an outline button with the red border, in the footer beside Close', () => {
  const { onSignOut } = openSheet();
  const signOut = screen.getByTestId('user-sheet-sign-out');
  expect(signOut.parentElement!.getAttribute('data-testid')).toBe('user-sheet-footer');
  expect(within(screen.getByTestId('user-sheet-footer')).getByTestId('user-sheet-close')).not.toBeNull();
  // The outline variant keeps its 1 px `border`; the destructive variant has none and a red fill.
  expect(classesOf('user-sheet-sign-out')).toEqual(expect.arrayContaining(['border', 'border-destructive', 'bg-card']));
  expect(classesOf('user-sheet-sign-out')).not.toContain('bg-destructive');
  fireEvent.click(signOut);
  expect(onSignOut).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('user-sheet')).toBeNull();
});

test('the WordPress Admin link carries its open-external glyph, and is hidden without adminUrl', () => {
  openSheet({ adminUrl: 'https://shop.example/wp-admin' });
  const link = screen.getByTestId('user-sheet-wp-admin');
  expect(link.textContent).toBe('WordPress Admin');
  expect(within(link).getByTestId('user-sheet-wp-admin-icon')).not.toBeNull();
  cleanup();
  openSheet();
  expect(screen.queryByTestId('user-sheet-wp-admin')).toBeNull();
  expect(screen.queryByTestId('user-sheet-foot')).toBeNull();
});

// v2's CashierEntry (cashier-entry/index.tsx:91-101): `wash="accent"` is a press and hover wash, never a fill.
test("the bar's avatar sits on the bar, with no accent fill", () => {
  render(<CashierSheet name="Bob Ross" cashiers={[]} onSwitch={() => {}} onAddAnother={() => {}} onSignOut={() => {}} />);
  expect(classesOf('register-bar-avatar')).not.toContain('bg-accent');
  expect(classesOf('register-bar-avatar-initials')).toEqual(expect.arrayContaining(['size-5', 'bg-primary']));
});

// v2's sheet and drawer door (dialog/index.tsx:199; user-sheet.tsx:143-158,199-218): the sheet on bg-card, the door with
// no fill of its own but a border, the register glyph, the opener's sm initials avatar, and the verbs in the foreground.
test('the sheet is on the card surface and the drawer door is drawn as v2 draws it', () => {
  const onOpenDrawer = vi.fn();
  openSheet({ drawer: { figure: '$50.00', verbs: 'Pay in · Pay out · Close register', opener: 'opened 09:00 by', openerName: 'Sam Lee' }, onOpenDrawer });
  expect(classesOf('user-sheet')).toContain('bg-card');
  expect(classesOf('user-sheet')).not.toContain('bg-background');
  expect(classesOf('user-sheet-drawer')).toEqual(expect.arrayContaining(['rounded-lg', 'border', 'border-border', 'active:bg-accent']));
  expect(classesOf('user-sheet-drawer').filter(name => /^bg-/.test(name))).toEqual([]);
  expect(within(screen.getByTestId('user-sheet-drawer')).getByTestId('user-sheet-drawer-icon')).not.toBeNull();
  const opener = screen.getByTestId('user-sheet-drawer-opener');
  // v2's opener line stops at "by" (user-sheet.tsx:143-158); the avatar carries the name for a screen reader.
  expect(opener.textContent).toBe('opened 09:00 by');
  const avatar = screen.getByTestId('user-sheet-drawer-opener-avatar');
  expect(avatar.textContent).toBe('SL');
  expect(avatar.getAttribute('aria-label')).toBe('Sam Lee');
  expect(avatar.parentElement).toBe(opener.parentElement);
  expect(classesOf('user-sheet-drawer-opener-avatar')).toEqual(expect.arrayContaining(['size-7', 'rounded-full', 'bg-primary']));
  expect(screen.getByTestId('user-sheet-drawer-verbs-text').textContent).toBe('Pay in · Pay out · Close register');
  expect(classesOf('user-sheet-drawer-verbs-text')).toContain('text-foreground');
  expect(classesOf('user-sheet-drawer-verbs-text')).not.toContain('text-primary');
  fireEvent.click(screen.getByTestId('user-sheet-drawer'));
  expect(onOpenDrawer).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('user-sheet')).toBeNull();
});

// v2's insets and ranks (dialog/index.tsx:243,277; user-sheet.tsx:679,685-686,702,209; text/ladder.ts:14;
// amount-figure/index.tsx:20): content 16 px in, flush sections, a 28 px band, muted `key` labels and `tile` figures.
test("the sheet's content, labels and figure take v2's inset, ranks and gaps", () => {
  openSheet({ drawer: { figure: '$50.00', verbs: 'Pay in · Pay out · Close register', opener: 'opened 09:00 by', openerName: 'Sam Lee' },
    onOpenDrawer: () => {}, adminUrl: 'https://shop.example/wp-admin' });
  expect(classesOf('user-sheet')).toContain('px-4');
  expect(classesOf('user-sheet-foot')).toContain('-mx-4');
  expect(classesOf('user-sheet-footer')).toContain('-mx-4');
  expect(classesOf('user-sheet-body')).toContain('gap-0');
  expect(classesOf('user-sheet-body')).not.toContain('gap-4');
  expect(classesOf('user-sheet-switch-band')).toEqual(expect.arrayContaining(['mt-2', 'h-7']));
  expect(classesOf('user-sheet-drawer-label')).toEqual(expect.arrayContaining(['text-sm', 'text-muted-foreground']));
  expect(classesOf('user-sheet-drawer-label')).not.toContain('font-medium');
  expect(classesOf('user-sheet-drawer-figure')).toEqual(expect.arrayContaining(['text-xl', 'font-bold', 'tabular-nums']));
  expect(classesOf('user-sheet-drawer-figure')).not.toContain('text-lg');
});

test('an opener with no name shows no avatar', () => {
  openSheet({ drawer: { figure: '$50.00', verbs: 'Pay in · Pay out · Close register', opener: 'opened 09:00' }, onOpenDrawer: () => {} });
  expect(screen.getByTestId('user-sheet-drawer-opener').textContent).toBe('opened 09:00');
  expect(screen.queryByTestId('user-sheet-drawer-opener-avatar')).toBeNull();
});
