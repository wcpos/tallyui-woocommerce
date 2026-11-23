import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import type { RxCollection } from 'rxdb';
import { Button, Receipt, SyncStatus, Text } from '@tallyui/components';
import { catalogueEntries, saleTaxContexts, TAX_ADDRESS_ORDER_CREATE_VERSION, TaxProvider, taxProviderProps, useSale, useTax } from '@tallyui/pos';
import { useFormatStoreMoney, useStoreMoney } from '../lib/money/store-money';
import { StoreMoneyFor } from '../lib/money/store-money-for';
import type { ServerCapabilities, StoreSettings } from '@tallyui/core';
import type { CatalogueEntry, CustomerSummary, OutboxState } from '@tallyui/pos';
import { createCustomersBlockedReason, type CashierCapabilities } from '../lib/auth/capabilities';
import { useRequestContext } from '../lib/auth/request-context';
import { useSession } from '../lib/auth/session-context';
import { drawerFigureText, drawerVerbs, sheetMoney } from '../lib/cashier/sheet-figures';
import { signOutQuestion, startCountThen } from '../lib/cashier/sign-out-question';
import { inCartCounts } from '../lib/catalogue/tile-words';
import { needsAnyPick } from '../lib/catalogue/variation-match';
import { useCatalogueView } from '../lib/catalogue/catalogue-view-state';
import { SALE_SPLIT_MIN_WIDTH } from '../lib/layout/wide';
import { useRegister } from '../lib/register/register-context';
import { REGISTER_ID } from '../lib/register/register-id';
import { buildReceiptIdentity } from '../lib/receipts/receipt-identity';
import { useReceiptPrintCount } from '../lib/receipts/use-receipt-print-count';
import { pickReceiptTemplate, receiptPaperWidth, receiptTemplateIdFor, renderedStoreReceipt } from '../lib/receipts/store-receipt';
import { useStoreTemplates } from '../lib/receipts/use-store-templates';
import { useOutbox } from '../lib/sale/outbox-context';
import { cartLogger, useAssignCustomer } from '../lib/sale/cart-log';
import { useCartRestore } from '../lib/sale/use-cart-restore';
import { useCheckoutBack } from '../lib/sale/use-checkout-back';
import { useChord } from '../lib/sale/use-search-chord';
import { useLeaveTill } from '../lib/sale/use-leave-till';
import { useParkAndResume } from '../lib/sale/use-park-and-resume';
import { useParkedCarts } from '../lib/sale/use-parked-carts';
import { useTenderCancel } from '../lib/sale/use-tender-cancel';
import { useOfflineLegs } from '../lib/sale/offline-legs';
import { useTenderStart } from '../lib/sale/use-tender-start';
import { useVoidSale } from '../lib/sale/use-void-sale';
import { saleDiscountCodes } from '../lib/sale/discount-codes';
import { taxClassOptions } from '../lib/sale/tax-classes';
import { refuseLockedAdd, tillLock } from '../lib/sale/till-lock';
import { saleScanHandlers } from '../lib/scan/sale-scan';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { showAddedToCartToast } from '../lib/toast/added-to-cart-toast';
import type { TenderVoidCollection } from '../lib/sale/tender-voids';
import type { ParkedCartCollection } from '../lib/sale/parked-carts';
import { VariantChooser } from './variant-chooser';
import { CatalogueView, PosBar } from './catalogue-view';
import type { CatalogueViewProps } from './catalogue-view';
import type { CustomerSource } from '../lib/customers/customer-source';
import { CustomerPicker } from './customer-picker';
import { TaxBasedOnCaption } from './tax-based-on-caption';
import type { ReceiptMailer } from '../lib/receipts/receipt-mailer';
import { useReceiptEmailSender, type ReceiptEmailCollection } from '../lib/receipts/receipt-emails';
import { ReceiptEmail } from './receipt-email';
import { ReceiptIdentity } from './receipt-identity';
import { ReceiptZoom } from './receipt-zoom';
import { ReceiptPrintSheet } from './receipt-print-sheet';
import { StoreReceipt } from './store-receipt';
import { ReceiptTemplateRow } from './receipt-template-row';
import { ReceiptPaidMoment } from './receipt-paid-moment';
import { ReceiptStoreLine } from './receipt-store-line';
import { ReceiptSyncOrder } from './receipt-sync-order';
import { useReceiptSettings } from '../lib/receipts/receipt-settings';
import { RegisterControls } from './register-controls';
import { CancelPaymentView } from './cancel-payment-view';
import { CheckoutTitleBar } from './checkout-title-bar';
import { CashierSheet, type CashierOption } from './cashier-sheet';
import { CouponRows } from './coupon-entry';
import { OpenOrderTabs, stripCartIds } from './open-order-tabs';
import { OpenOrdersList } from './open-orders-list';
import { PanelResizeHandle } from './panel-resize-handle';
import { CartWithSettings } from './cart-settings';
import { OrderDetailsSheet } from './order-details-sheet';
import { OpenSaleReceipt } from './open-sale-receipt';
import { KeyboardShortcutsSheet } from './keyboard-shortcuts-sheet';
import { CartNoteRow } from './cart-note-row';
import { TenderPane } from './tender-pane';
import { LedgerPane } from './ledger-pane';
import { PosPhoneTabBar } from './pos-phone-tab-bar';

// Stores without a capabilities read stay on order.create v3 (no fees, shipping or custom lines).
const DEFAULT_CAPABILITIES = { orderCreate: 3 } as const;

export interface SaleScreenProps extends Omit<CatalogueViewProps, 'onSelect' | 'message' | 'onScan' | 'locked'> {
  cashierRef: string; parkedCarts?: ParkedCartCollection; customers?: CustomerSource | null;
  mailer?: ReceiptMailer | null; receiptEmails?: ReceiptEmailCollection;
  storeSettings: StoreSettings; locale?: string;
  multiplePayments?: boolean;
  capabilities?: ServerCapabilities;
  /** The till's "Tax based on" caption: "Change setting" opens Settings › Tax. Without it the caption is not shown. */
  onOpenTaxSettings?: () => void;
  couponCollections?: { coupons: RxCollection; products: RxCollection };
  cashier?: CashierCapabilities;
  cashiers?: CashierOption[];
  onSwitchCashier?(uuid: string): Promise<string | null>;
  onRemoveCashier?(uuid: string): void;
  onAddCashier?(): void;
  heldCartKey?: string;
  // The store's wp-admin, linked from the cashier sheet.
  adminUrl?: string;
  // The store's home URL; picks the demo store's own wording (ADR 0007).
  siteHome?: string;
  // Put on every new sale (v2's default customer); undefined while the app resolves it.
  defaultCustomer?: CustomerSummary | null;
}

/**
 * Whether the sync line shows. v2 draws nothing under its open-order strip while sales are up to date (cart/tabs.tsx,
 * cart/index.tsx: the strip is the last row, and a waiting or refused cart shows only as the tray's dot and its tab chip).
 * TallyUI 3.12.0's SyncStatus (components/src/sale/sync-status.tsx) exports no test of its own, so this mirrors its
 * condition for the bare "Sales are up to date.": line 110 `upToDate` (no sale pending; Tally passes no registerState),
 * line 121 (a refused sale is never up to date), and lines 142-143 (a missing store adds its detail even while up to
 * date). Tally passes no pullNotice. Any other state keeps SyncStatus's own words.
 */
export function syncLineShown(state: OutboxState): boolean {
  return state.pending > 0 || !!state.rejected || !!state.backendMissing;
}

export function SaleScreen(props: SaleScreenProps): JSX.Element {
  return <TaxProvider {...taxProviderProps(props.storeSettings)}><SaleScreenInner {...props} /></TaxProvider>;
}

function SaleScreenInner(props: SaleScreenProps): JSX.Element {
  const formatMoney = useFormatStoreMoney();
  const storeMoney = useStoreMoney();
  const { connector, currency, parkedCarts, mailer, receiptEmails } = props;
  const [viewState, setViewState] = useCatalogueView();
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const [groupWidth, setGroupWidth] = useState(0);
  const effective: CashierCapabilities = props.cashier ?? { known: false, reason: 'Your permissions have not been read from the store.' };
  const outbox = useOutbox();
  const auth = useSession() as ReturnType<typeof useSession> | null;
  const register = useRegister();
  // The store's receipt templates, read once per till mount; without a session there is no store to ask.
  const requestContext = useRequestContext(connector, auth?.session ?? null);
  const storeTemplates = useStoreTemplates(auth?.session ? connector : undefined, requestContext, 'receipt');
  // The order whose store receipt frame has loaded; until then the auto print waits.
  const [frameLoaded, setFrameLoaded] = useState<string | null>(null);
  // The cashier's receipt template pick, in memory and for one order (v2 use-template-renderer.ts:267-285).
  const [templatePick, setTemplatePick] = useState<{ orderId: string; id: string } | null>(null);
  useReceiptEmailSender({ collection: mailer ? receiptEmails ?? null : null, mailer: mailer ?? null,
    orders: outbox.enabled ? outbox.orders : null });
  const outboxOrders = outbox.enabled ? outbox.orders : null;
  const discountCodes = useMemo(() => props.couponCollections && outboxOrders
    ? saleDiscountCodes({ ...props.couponCollections, orders: outboxOrders }) : undefined, [props.couponCollections, outboxOrders]);
  const capabilities: ServerCapabilities = props.capabilities ?? DEFAULT_CAPABILITIES;
  const orderCreate = capabilities.orderCreate ?? 0;
  // #722: each sale is taxed for its customer's address as WooCommerce's tax_based_on picks it; saleTaxContexts
  // re-matches only at order.create 8, below which the server taxes on the shop base (every customer gets the store's rates).
  const taxContextFor = useMemo(() => saleTaxContexts(props.storeSettings, { orderCreateVersion: orderCreate }),
    [props.storeSettings, orderCreate]);
  const readsAddress = orderCreate >= TAX_ADDRESS_ORDER_CREATE_VERSION;
  const tax = useTax();
  const { rounding } = tax;
  // useSale's own coupon gate (codesFor): the UI shows only when applyCoupon can succeed.
  const couponsOffered = capabilities.coupons === true && (capabilities.orderCreate ?? 0) >= 6
    && !!discountCodes && discountCodes.supports({ capabilities, rounding });
  const sale = useSale({ currency, calcDiscountsSequentially: props.storeSettings.calcDiscountsSequentially }, {
    registerId: REGISTER_ID, cashierRef: props.cashierRef,
    capabilities,
    taxContextFor,
    session: register?.saleSession,
    onSaleCompleted: outbox.enabled ? outbox.record : undefined,
    isStored: outbox.enabled ? outbox.isStored : undefined,
    discountCodes,
    defaultCustomer: props.defaultCustomer,
  });
  const assignCustomer = useAssignCustomer(sale);
  const inCart = useMemo(() => inCartCounts(sale.order.lineItems), [sale.order.lineItems]);
  const receiptOrderId = sale.stage.kind === 'receipt' ? sale.stage.posOrder.id : null;
  const printCount = useReceiptPrintCount(receiptOrderId);
  const [receiptSettings] = useReceiptSettings();
  const { width } = useWindowDimensions();
  const [cartOpen, setCartOpen] = useState(false);
  // The register panel lives in RegisterControls (the cart side); the cashier sheet's drawer door, on the bar over the
  // cart, is the one way into it (v2 register-bar.tsx: "the avatar's sheet is the one door to the panel").
  const [registerPanelOpen, setRegisterPanelOpen] = useState(false);
  const { cancelling, voidError, requestCancel, keepPayments, confirmCancel, removeLeg } = useTenderCancel(sale, {
    collection: () => (outbox.enabled && outbox.orders!.database.collections.tender_voids) as TenderVoidCollection,
    sessionId: register?.saleSession?.id, cashierRef: props.cashierRef,
  });
  const offlineLegs = useOfflineLegs(sale.order.id);
  // WCPOS v2 checkout-column.tsx:32-34: Escape is the tender's own Back; in the cancel view the cashier picks Keep or Cancel.
  useCheckoutBack(() => { if (outbox.enabled && props.multiplePayments === true) requestCancel(); else sale.cancelTender(); },
    { enabled: sale.stage.kind === 'tender' && !cancelling });
  const [message, setMessage] = useState<string>();
  const cartRestore = useCartRestore(sale, props.products, connector.traits.product, currency, setMessage);
  const parkedStore = useParkedCarts(parkedCarts);
  const { parked } = parkedStore;
  const { park, resume, resumeCart, hold, unhold, currentOpenedAt } = useParkAndResume(sale, {
    store: parkedStore, cartRestore, heldCartKey: props.heldCartKey,
    catalogueReady: props.status === 'ready', say: setMessage,
  });
  const startTender = useTenderStart(sale, { register, multiPayment: outbox.enabled && props.multiplePayments === true, say: setMessage });
  const [listOpen, setListOpen] = useState(false);
  // Leaving the cart stage unmounts the strip, which uncovers the cart: coming back never finds the list open (v2 cart/tabs.tsx:109-114).
  useEffect(() => { if (sale.stage.kind !== 'cart') setListOpen(false); }, [sale.stage.kind]);
  const [variants, setVariants] = useState<CatalogueEntry<any>[]>();
  // v2's autoShowReceipt off (use-complete-order-flow.ts): with no auto print either, a finished sale goes straight
  // back to an empty till, once per order. With auto print on, the receipt stage renders so the print area exists.
  useEffect(() => {
    if (receiptOrderId !== null && !receiptSettings.autoShow && !receiptSettings.autoPrint) sale.newSale();
  }, [sale.stage.kind, receiptOrderId]);

  // v2's cart foot (cart/foot.tsx, buttons/pay.tsx): one "Checkout {total}" opens the tender on Cash, where the cashier
  // picks the method, and the ⋮'s one item opens the Order details sheet, which holds Void (cart/order-sheet.tsx).
  // v2 voids at once and offers Undo (pos/hooks/use-void-order.ts): Undo brings the voided cart back as resumeCart does.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const voiding = useVoidSale(sale, { resumeCart, say: setMessage, openedAt: currentOpenedAt });
  const changeCashier = useLeaveTill(sale, { hold, unhold, onSwitchCashier: props.onSwitchCashier, onAddCashier: props.onAddCashier, say: setMessage });
  const checkout = {
    onCheckout: () => { void startTender('cash'); },
    actions: [{ label: 'Order details', onPress: () => setDetailsOpen(true) }],
  };

  // v2's `onTill` (extensions/commands/commands.ts:13-18): the chords only on the till, never at checkout or on the
  // receipt. v2's `inCart` also needs the cart shown (`hasSurface('cart')`): on a phone, the Cart tab selected.
  const chords = props.searchChord !== false && sale.stage.kind === 'cart';
  const phoneLayout = width < SALE_SPLIT_MIN_WIDTH;
  const cartChords = chords && (!phoneLayout || cartOpen);
  const hasLines = sale.order.lineItems.length > 0;
  const stripIds = stripCartIds(parked, sale.order, currentOpenedAt);
  // v2 hotkeys.web.tsx: a chord whose previous run has not settled is dropped.
  const chordBusy = useRef(false);
  const runChord = (action: () => Promise<string | null>) => {
    if (chordBusy.current) return;
    chordBusy.current = true;
    action().then(result => { if (typeof result === 'string') setMessage(result); },
      error => setMessage(error instanceof Error ? error.message : String(error)))
      .finally(() => { chordBusy.current = false; });
  };
  // v2 provider.tsx:57-75 selectOrder: the strip's carts wrap at both ends; the blank cart sits past the last one.
  const stepCart = (step: 1 | -1) => {
    const at = stripIds.indexOf(sale.order.id);
    const target = stripIds[at < 0 ? (step > 0 ? 0 : stripIds.length - 1) : (at + step + stripIds.length) % stripIds.length];
    if (target !== sale.order.id) runChord(() => resume(target));
  };
  useChord('KeyN', () => runChord(park), cartChords && hasLines);
  useChord('ArrowLeft', () => stepCart(-1), cartChords && stripIds.length > 1);
  useChord('ArrowRight', () => stepCart(1), cartChords && stripIds.length > 1);
  useChord('KeyP', checkout.onCheckout, cartChords && hasLines);
  // v2's alt+v `pos.cart.void` (commands.ts:40-43): what the Order details Void runs, Undo included, while it is offered.
  useChord('KeyV', voiding.voidSale, cartChords && voiding.offered);
  // v2's alt+slash `pos.help.open` has no `when`; its sheet greys each row by the gate its chord uses here.
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useChord('Slash', () => setShortcutsOpen(true), props.searchChord !== false);
  const onCart = cartChords && hasLines, canStep = cartChords && stripIds.length > 1;
  const shortcuts = { 'pos.search.focus': chords, 'pos.checkout.open': onCart, 'pos.cart.new': onCart, 'pos.cart.previous': canStep,
    'pos.cart.next': canStep, 'pos.cart.discount': onCart, 'pos.cart.void': cartChords && voiding.offered, 'pos.help.open': true };

  function onSelect(doc: any) {
    try {
      const entries = catalogueEntries([doc], connector.traits.product, { currency });
      if (!entries.length) {
        setMessage(`${connector.traits.product.getName(doc)} has no options to sell`);
        return;
      }
      // v2 variable-actions.tsx:44-57 opens the variations popover for every variable product: a lone variation
      // that leaves an attribute open ("Any") waits on the cashier's pick; any other lone entry adds at once.
      const groups = connector.traits.product.getVariantOptions?.(doc) ?? [];
      if (entries.length === 1 && !needsAnyPick(groups, [entries[0].variant])) onAdd(entries[0]);
      else { setVariants(entries); setMessage(undefined); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  // v2 use-add-product.ts:77-85 / use-add-variation.ts: a closed or counting register refuses every add, and says so.
  const lock = tillLock(register);
  function addEntry(entry: CatalogueEntry<any>): boolean {
    if (refuseLockedAdd(lock)) return false;
    try {
      const result = sale.add(entry, connector.traits.product);
      if (typeof result !== 'string') cartLogger.info(`${connector.traits.product.getName(entry.product)} added to cart`, { variantId: entry.variant.id });
      setVariants(undefined);
      setMessage(undefined);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  function onAdd(entry: CatalogueEntry<any>): boolean {
    const added = addEntry(entry);
    if (added) showAddedToCartToast(connector.traits.product.getName(entry.product));
    return added;
  }

  const { onScan: scanAdd, onTenderScan } = saleScanHandlers({
    products: props.products, traits: connector.traits.product, currency, add: addEntry,
  });
  // v2 use-barcode.ts:173-181: refused before the lookup, so a locked till never reads a scan as "not found".
  const onScan = (code: string) => refuseLockedAdd(lock) ? 'keep' as const : scanAdd(code);

  const drawerFigure = drawerFigureText(register, minor => sheetMoney(minor, currency, props.locale, storeMoney));
  const signOutTitle = signOutQuestion(register, drawerFigure);
  const cashierControl = props.onSwitchCashier ? <CashierSheet name={props.cashierName} cashiers={props.cashiers ?? []}
      onSwitch={changeCashier} onAddAnother={() => changeCashier()} onSignOut={props.onSignOut}
      openRegister={register && signOutTitle ? { title: signOutTitle, onClose: () => startCountThen(register, () => setCartOpen(true)) } : undefined}
      onRemove={props.onRemoveCashier}
      drawerRegister={signOutTitle ? register?.registerName ?? 'This till' : undefined}
      paying={sale.stage.kind === 'tender' || sale.saving}
      storeName={props.storeName}
      signedInAt={auth?.session?.signedInAt} awaitingStore={outbox.enabled ? outbox.state.pending : 0}
      sales={outboxOrders ? { orders: outboxOrders, cashierRef: props.cashierRef, currency, locale: props.locale } : null}
      drawer={drawerFigure ? { figure: drawerFigure,
        ...drawerVerbs(register, id => id === props.cashierRef ? props.cashierName : undefined) } : undefined}
      // On a narrow screen the register panel lives in the cart pane, so the door selects the Cart tab first
      // (setCartOpen(true)); on a wide screen both panes are up and setCartOpen changes nothing.
      onOpenDrawer={register?.enabled ? () => { setCartOpen(true); setRegisterPanelOpen(true); } : undefined}
      adminUrl={props.adminUrl}
    /> : props.cashierControl;
  // v2 draws its RegisterBar as the cart column's first row (cart/index.tsx), so the catalogue starts with its search row.
  const bar = <PosBar {...props} cashierControl={cashierControl} />;
  const browse = variants ? (
    <VariantChooser entries={variants} currency={currency} traits={connector.traits.product} onSelect={onAdd} onClose={() => setVariants(undefined)} />
  ) : <CatalogueView {...props} onSelect={onSelect} onAddEntry={onAdd} onScan={onScan} message={message}
    tax={tax} locked={lock} inCartCounts={inCart} hideBar
    // v2 pos/products/footer.tsx:53, gated on calcTaxes: the connector sets taxBasedOn only when calc_taxes is yes. Below
    // order.create 8 the sale is taxed on the shop base whoever the customer is, so the panel shows the shop address.
    captionStart={sale.taxLocation && props.onOpenTaxSettings ? <TaxBasedOnCaption settings={props.storeSettings}
      calcTaxes={props.storeSettings.taxBasedOn !== undefined} onChangeSetting={props.onOpenTaxSettings}
      location={readsAddress ? sale.taxLocation : { ...sale.taxLocation, hasCustomer: false }} /> : undefined}
    // v2's `onTill`: Alt+F only on the till's own route, never at checkout; the phone till brings Products forward.
    searchChord={chords} onRevealSearch={phoneLayout ? () => setCartOpen(false) : undefined}
    viewState={viewState} onViewStateChange={setViewState} cashierControl={cashierControl} />;
  // v2's cart column paints its own surface, white in Light (pos/cart/index.tsx:75 `isColumn ? 'bg-cart'`, :187), and
  // its rows sit 8 px in (cart/foot.tsx:35 `gap-2 p-2`; cart-header.tsx:119 `px-2 py-2`).
  const cartPane = (
    <View testID="cart-pane" className="flex-1 bg-card p-2">
      {width < SALE_SPLIT_MIN_WIDTH && message ? <Text>{message}</Text> : null}
      {sale.stage.kind === 'cart' ? (
        <>
          {/* M6's order notes can take the price-change reason via onPriceChange. */}
          {/* B7: quantity and price open keypad popovers, as v2's cart/cells/quantity-keypad.tsx and cart/cells/price.tsx do. */}
          <CartWithSettings sale={{ ...sale, startTender: startTender }} canEditPrice lineEditor="popover" taxClasses={taxClassOptions(props.storeSettings.taxClassSlugs)}
            afterSubtotal={couponsOffered && props.couponCollections ? <CouponRows sale={sale} /> : undefined}
            // Avoid counting itemised coupons twice, matching v2 cart/totals.tsx:121-148.
            couponDiscountMinor={couponsOffered && props.couponCollections
              ? (sale.order.display.coupons ?? []).reduce((sum, coupon) => sum + coupon.amountMinor, 0) : undefined}
            // v2's cart "+" menu hosts the order discount, charges and coupons (the Coupon side of Add discount).
            orderActions={false} coupons={props.couponCollections?.coupons ?? null} couponsOffered={couponsOffered}
            // B5/B6: v2's cart head row starts with the customer chip; Add new customer is in the + menu.
            customer={props.customers ? <CustomerPicker source={props.customers} customer={sale.order.customer ?? null} onChange={assignCustomer} /> : null}
            customers={props.customers ?? null} createCustomersBlockedReason={createCustomersBlockedReason(effective, props.siteHome)}
            checkout={checkout} chords={cartChords} note={<CartNoteRow note={sale.order.note} onPress={() => setDetailsOpen(true)} />}
            position={viewState.position} onPositionChange={position => setViewState({ ...viewState, position })}
            // v2 cart/tabs.tsx: the count toggles the list (:352); a tab press (:280-284) and + (:438-445) close it.
            openOrders={<OpenOrderTabs parked={parked} current={sale.order} currentOpenedAt={currentOpenedAt} currency={currency} locale={props.locale}
              onSelect={id => { setListOpen(false); return resume(id); }} onNew={() => { setListOpen(false); return park(); }} onError={setMessage}
              onOpenList={() => setListOpen(open => !open)} listOpen={listOpen} compact={phoneLayout} />}
            openOrdersList={<OpenOrdersList parked={parked} current={sale.order} currentOpenedAt={currentOpenedAt} currency={currency} locale={props.locale}
              onSelect={resume} onClose={() => setListOpen(false)} onError={setMessage} leaving={!listOpen} />} listOpen={listOpen} />
          <OrderDetailsSheet open={detailsOpen} onOpenChange={setDetailsOpen} side={viewState.position}
            note={sale.order.note} onNoteChange={sale.setNote} onVoid={voiding.offered ? voiding.voidSale : undefined}
            onPrint={sale.order.lineItems.length ? () => setBillOpen(true) : undefined} />
          <OpenSaleReceipt open={billOpen} onClose={() => setBillOpen(false)} side={viewState.position} order={sale.order}
            config={{ storeName: props.storeName, cashier: props.cashierName, registerName: register?.registerName ?? undefined }} />
        </>
      ) : sale.stage.kind === 'tender' ? outbox.enabled ? (
        // v2's tender pane is a ScrollView (checkout/tender/tender-pane.tsx:377) whose content takes a minimum height, never
        // a height (checkout/LEDGER.md:49), so on a phone a tall pane scrolls to the commit button.
        <ScrollView testID="checkout-scroll" className="flex-1" contentContainerClassName="grow" keyboardShouldPersistTaps="handled">
        {props.multiplePayments === true ? (
        cancelling && sale.order.payments.length > 0 ? (
          <>
            {voidError ? <Text testID="tender-void-error" accessibilityRole="alert" className="text-destructive">{voidError}</Text> : null}
            <CancelPaymentView payments={sale.order.payments} currency={currency} onKeep={keepPayments}
              onConfirm={confirmCancel} />
          </>
        ) : (
          <>
            <CheckoutTitleBar disabled={sale.saving} onClose={requestCancel}>
              {/* v2's CancelPaymentButton (checkout-body-view.tsx:87-101): outline-destructive (button/index.tsx:53-54), sm beside
                  the title when wide, default in the phone sheet (tender-checkout.tsx:129), disabled while the order saves. */}
              {sale.order.payments.length > 0 ? <Button variant="outline" className="border-destructive bg-card" size={width < SALE_SPLIT_MIN_WIDTH ? undefined : 'sm'} disabled={sale.saving} testID="checkout-cancel-payment" onPress={requestCancel}><Text>Cancel payment</Text></Button> : null}
            </CheckoutTitleBar>
            {voidError ? <Text testID="tender-void-error" accessibilityRole="alert" className="text-destructive">{voidError}</Text> : null}
            <TenderPane multi sale={sale} onRecordedOffline={offlineLegs.mark} />
            {/* One column below 900: the legs sit under the tender (wide, the ledger has the products panel). */}
            {width < SALE_SPLIT_MIN_WIDTH ? <LedgerPane order={sale.order} recordedOffline={offlineLegs.ids} onRemove={sale.saving ? undefined : id => { void removeLeg(id); }} /> : null}
          </>
        )
      ) : <>
        <CheckoutTitleBar disabled={sale.saving} onClose={() => sale.cancelTender()} />
        <TenderPane sale={sale} />
      </>}
        </ScrollView>
      ) : (
        <>
          <Text>Taking payment arrives in the next update</Text>
          <Button onPress={() => sale.cancelTender()}><Text>Back to cart</Text></Button>
        </>
      ) : sale.stage.kind === 'receipt' ? (() => {
        const orderId = sale.stage.posOrder.id;
        const receiptOrder = (outbox.enabled && outbox.recent.find(o => o.id === orderId)) || sale.stage.posOrder;
        const receiptCoupons = sale.stage.order.display.coupons ?? [], receiptCurrency = sale.stage.order.currency;
        const doneLabel = receiptSettings.autoPrint ? 'Print receipt · New sale' : 'New sale';
        // The store's own template (v2's receipt screen) when one renders on the web; the built-in receipt otherwise.
        const templateId = receiptTemplateIdFor(templatePick, orderId);
        const storeHtml = Platform.OS === 'web' ? renderedStoreReceipt(storeTemplates, { kind: 'pos', order: receiptOrder }, {
          config: { storeName: props.storeName, cashier: props.cashierName, registerName: register?.registerName ?? undefined },
          pricesIncludeTax: props.storeSettings.pricesIncludeTax,
        }, templateId) : null;
        const shownTemplate = storeTemplates.status === 'ready' ? pickReceiptTemplate(storeTemplates.templates, templateId) : null;
        // v2 previews and prints at the shown template's paper (use-receipt-document.ts:214-220); the built-in receipt at 80 mm.
        const paperWidth = receiptPaperWidth(storeHtml !== null ? shownTemplate : null);
        return (
        <>
          <ReceiptPaidMoment posOrder={receiptOrder} locale={props.locale} onClose={sale.newSale} />
          {/* v2's Template row sits above the paper, outside the zoom and the print (receipt-body.tsx:84-98). */}
          {storeHtml !== null && storeTemplates.status === 'ready' && shownTemplate ? <ReceiptTemplateRow
            templates={storeTemplates.templates} selectedId={shownTemplate.id} onSelect={id => setTemplatePick({ orderId, id })} /> : null}
          <ReceiptZoom paperWidth={paperWidth}>
          <ReceiptPrintSheet orderId={orderId} paperWidth={paperWidth} autoPrint={receiptSettings.autoPrint} printAgain={storeHtml === null}
            ready={storeTemplates.status !== 'loading' && (storeHtml === null || frameLoaded === orderId)}
            onAutoPrinted={receiptSettings.autoShow ? undefined : sale.newSale}>
          <ReceiptStoreLine posOrder={receiptOrder} />
          {storeHtml !== null ? <StoreReceipt html={storeHtml} paper={paperWidth} doneLabel={doneLabel} onDone={sale.newSale} printed={printCount > 0}
            onLoad={() => setFrameLoaded(orderId)} /> : <>
          {/* The sale's own currency (the till's, so a no-op today), by the same rule as the Orders screen's receipt. */}
          <StoreMoneyFor currency={receiptCurrency}><Receipt order={sale.stage.order} posOrder={receiptOrder} store={{ name: props.storeName }}
            cashier={props.cashierName} registerId={REGISTER_ID} newSale={sale.newSale}
            doneLabel={doneLabel} /></StoreMoneyFor>
          {receiptCoupons.length ? (
            <View testID="receipt-coupons" className="gap-1 py-2">
              {receiptCoupons.map(coupon => (
                <View key={coupon.code} className="flex-row justify-between">
                  <Text>{`Coupon ${coupon.code}`}</Text>
                  <Text>{`-${formatMoney({ amount: coupon.amountMinor, currency: receiptCurrency }) ?? coupon.amountMinor}`}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <ReceiptIdentity identity={buildReceiptIdentity({
            posOrder: receiptOrder,
            register: register?.boundRegisterId && register.registerName ? { id: register.boundRegisterId, name: register.registerName } : null,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            copies: printCount,
          })} />
          </>}
          </ReceiptPrintSheet>
          </ReceiptZoom>
          {outbox.enabled ? <ReceiptSyncOrder posOrder={receiptOrder} onRequeue={ids => (outbox.enabled ? outbox.requeue(ids) : Promise.resolve(0))} /> : null}
          {mailer && receiptEmails && outbox.enabled ? <ReceiptEmail collection={receiptEmails}
            orderId={sale.stage.posOrder.id} defaultEmail={sale.stage.order.customer?.email ?? ''}
            localOnly={!receiptOrder.serverRefs?.orderId} /> : null}
        </>
        );
      })() : null}
      {outbox.enabled && syncLineShown(outbox.state) ? <View testID="sync-status"><SyncStatus state={outbox.state} /></View> : null}
    </View>
  );

  const cart = (
    <View className="flex-1">
      <RegisterControls currency={currency} storeName={props.storeName} locale={props.locale} cartEmpty={!sale.order.lineItems.length}
        panelOpen={registerPanelOpen} onPanelOpenChange={setRegisterPanelOpen}>{cartPane}</RegisterControls>
      <KeyboardShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} enabled={shortcuts} />
    </View>
  );

  // WCPOS v2's two-pane checkout: during a multi-payment tender the ledger takes the products panel, beside the tender.
  const multiTender = outbox.enabled && props.multiplePayments === true && sale.stage.kind === 'tender';
  useWedgeScanner(onTenderScan, props.scanActive !== false && multiTender && width >= SALE_SPLIT_MIN_WIDTH);
  if (width >= SALE_SPLIT_MIN_WIDTH) {
    const shown = liveWidth ?? viewState.width;
    // v2 keeps no inset on the products column's edge facing the cart (pos-columns.tsx `GroundInnerEdge`, lib/ground.ts:
    // 84-110 INNER_RIGHT/INNER_LEFT `pr-0`/`pl-0`): the handle is that gutter, so the column's 12 px bleeds under it.
    const productsPanel = <View key="products" testID="pos-products-panel"
      style={{ flexGrow: shown, flexShrink: 1, flexBasis: 0 }}>{multiTender ? <View testID="checkout-ledger-column" className="flex-1 bg-muted p-4">
        <LedgerPane closing order={sale.order} recordedOffline={offlineLegs.ids} onRemove={cancelling || sale.saving ? undefined : id => { void removeLeg(id); }} />
      </View> : <View testID="pos-products-bleed" className={`flex-1 ${viewState.position === 'right' ? '-ml-3' : '-mr-3'}`}>{browse}</View>}</View>;
    // The bar heads the cart column on whichever side the cart sits, as v2's goes with its cart, on the cart's surface.
    const cartPanel = <View key="cart" testID="pos-cart-panel"
      style={{ flexGrow: 100 - shown, flexShrink: 1, flexBasis: 0 }}
      className={`${viewState.position === 'right' ? 'border-r' : 'border-l'} border-border bg-card`}>{bar}{cart}</View>;
    const handle = <PanelResizeHandle key="handle" width={shown} position={viewState.position}
      groupWidth={groupWidth} onResize={setLiveWidth}
      onCommit={w => { setViewState({ ...viewState, width: w }); setLiveWidth(null); }} />;
    return (
      <View className="flex-1 bg-bg bg-background">
        <View className="flex-1 flex-row" onLayout={event => setGroupWidth(event.nativeEvent.layout.width)}>
          {viewState.position === 'right' ? [cartPanel, handle, productsPanel] : [productsPanel, handle, cartPanel]}
        </View>
      </View>
    );
  }
  // v2's phone till (apps/main/app/(app)/(drawer)/(pos)/(columns)/index.tsx): both panes stay mounted and the hidden
  // one is display none, so the products pane's barcode scanning keeps working on the Cart tab (v2 #1438). Parked
  // carts are reached through the cart's open-order strip.
  const active = cartOpen ? 'cart' : 'products';
  return (
    <View className="flex-1 bg-background">
      {/* One bar over both tabs, as v2's phone till draws RegisterBar on the Products tab (apps/main/components/
          pos-products-pane.tsx) and as the Cart tab's first row (cart/index.tsx). */}
      {bar}
      <View testID="pos-pane-products" className="flex-1" style={active === 'products' ? undefined : { display: 'none' }}>{browse}</View>
      <View testID="pos-pane-cart" className="flex-1" style={active === 'cart' ? undefined : { display: 'none' }}>{cart}</View>
      <PosPhoneTabBar active={active} onSelect={tab => setCartOpen(tab === 'cart')}
        cartCount={sale.order.lineItems.reduce((sum, line) => sum + line.quantity, 0)} />
    </View>
  );
}
