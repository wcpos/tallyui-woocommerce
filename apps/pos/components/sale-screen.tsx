import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { RxCollection } from 'rxdb';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, Button, CartBar, ParkedSales, Receipt, SyncStatus, Text } from '@tallyui/components';
import { catalogueEntries, RegisterSessionRequiredError, TaxProvider, taxProviderProps, useSale, useTax } from '@tallyui/pos';
import { formatMoney } from '@tallyui/core';
import type { ServerCapabilities, StoreSettings } from '@tallyui/core';
import type { CatalogueEntry, ParkedOrderSummary, Payment, TenderVoid } from '@tallyui/pos';
import { createCustomersBlockedReason, type CashierCapabilities } from '../lib/auth/capabilities';
import { drawerFigureText, drawerVerbs, sheetMoney } from '../lib/cashier/sheet-figures';
import { inCartCounts } from '../lib/catalogue/tile-words';
import { useCatalogueView } from '../lib/catalogue/catalogue-view-state';
import { useRegister } from '../lib/register/register-context';
import { buildReceiptIdentity } from '../lib/receipts/receipt-identity';
import { useReceiptPrintCount } from '../lib/receipts/use-receipt-print-count';
import { useOutbox } from '../lib/sale/outbox-context';
import { clearBeforeLeave, setBeforeLeave, type BeforeLeave } from '../lib/sale/before-leave';
import { parkCart, restoreCart } from '../lib/sale/parked-carts';
import { saleDiscountCodes } from '../lib/sale/discount-codes';
import { taxClassOptions } from '../lib/sale/tax-classes';
import { lookupCode } from '../lib/scan/lookup';
import { scanFeedback } from '../lib/scan/scan-sound';
import { recordTenderVoids, type TenderVoidCollection } from '../lib/sale/tender-voids';
import type { ParkedCart, ParkedCartCollection } from '../lib/sale/parked-carts';
import { VariantChooser } from './variant-chooser';
import { CatalogueView } from './catalogue-view';
import type { CatalogueViewProps } from './catalogue-view';
import type { CustomerSource } from '../lib/customers/customer-source';
import { CustomerPicker } from './customer-picker';
import type { ReceiptMailer } from '../lib/receipts/receipt-mailer';
import { useReceiptEmailSender, type ReceiptEmailCollection } from '../lib/receipts/receipt-emails';
import { ReceiptEmail } from './receipt-email';
import { ReceiptIdentity } from './receipt-identity';
import { ReceiptZoom } from './receipt-zoom';
import { ReceiptPrintSheet } from './receipt-print-sheet';
import { ReceiptPaidMoment } from './receipt-paid-moment';
import { useReceiptSettings } from '../lib/receipts/receipt-settings';
import { RegisterControls, RegisterSwitch } from './register-controls';
import { CancelPaymentView } from './cancel-payment-view';
import { CashierSheet, type CashierOption } from './cashier-sheet';
import { CouponEntry, CouponRows } from './coupon-entry';
import { OpenOrderTabs } from './open-order-tabs';
import { PanelResizeHandle } from './panel-resize-handle';
import { CartWithSettings } from './cart-settings';
import { TenderPane } from './tender-pane';
import { LedgerPane } from './ledger-pane';

// The till id; the bound register is the drawer.
const REGISTER_ID = 'web';
// Stores without a capabilities read stay on order.create v3 (no fees, shipping or custom lines).
const DEFAULT_CAPABILITIES = { orderCreate: 3 } as const;

export interface SaleScreenProps extends Omit<CatalogueViewProps, 'onSelect' | 'message' | 'onScan'> {
  cashierRef: string; parkedCarts?: ParkedCartCollection; customers?: CustomerSource | null;
  mailer?: ReceiptMailer | null; receiptEmails?: ReceiptEmailCollection;
  storeSettings: StoreSettings; locale?: string;
  multiplePayments?: boolean;
  capabilities?: ServerCapabilities;
  couponCollections?: { coupons: RxCollection; products: RxCollection };
  cashier?: CashierCapabilities;
  cashiers?: CashierOption[];
  onSwitchCashier?(uuid: string): Promise<string | null>;
  onRemoveCashier?(uuid: string): void;
  onAddCashier?(): void;
  heldCartKey?: string;
  // The store's wp-admin, linked from the cashier sheet.
  adminUrl?: string;
}

export function SaleScreen(props: SaleScreenProps): JSX.Element {
  return <TaxProvider {...taxProviderProps(props.storeSettings)}><SaleScreenInner {...props} /></TaxProvider>;
}

function SaleScreenInner(props: SaleScreenProps): JSX.Element {
  const { connector, currency, parkedCarts, mailer, receiptEmails } = props;
  const [viewState, setViewState] = useCatalogueView();
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const [groupWidth, setGroupWidth] = useState(0);
  const effective: CashierCapabilities = props.cashier ?? { known: false, reason: 'Your permissions have not been read from the store.' };
  const outbox = useOutbox();
  const register = useRegister();
  useReceiptEmailSender({ collection: mailer ? receiptEmails ?? null : null, mailer: mailer ?? null,
    orders: outbox.enabled ? outbox.orders : null });
  const outboxOrders = outbox.enabled ? outbox.orders : null;
  const discountCodes = useMemo(() => props.couponCollections && outboxOrders
    ? saleDiscountCodes({ ...props.couponCollections, orders: outboxOrders }) : undefined, [props.couponCollections, outboxOrders]);
  const capabilities: ServerCapabilities = props.capabilities ?? DEFAULT_CAPABILITIES;
  const tax = useTax();
  const { rounding } = tax;
  // useSale's own coupon gate (codesFor): the UI shows only when applyCoupon can succeed.
  const couponsOffered = capabilities.coupons === true && (capabilities.orderCreate ?? 0) >= 6
    && !!discountCodes && discountCodes.supports({ capabilities, rounding });
  const sale = useSale({ currency, calcDiscountsSequentially: props.storeSettings.calcDiscountsSequentially }, {
    registerId: REGISTER_ID, cashierRef: props.cashierRef,
    capabilities,
    session: register?.saleSession,
    onSaleCompleted: outbox.enabled ? outbox.record : undefined,
    isStored: outbox.enabled ? outbox.isStored : undefined,
    discountCodes,
  });
  const inCart = useMemo(() => inCartCounts(sale.order.lineItems), [sale.order.lineItems]);
  const receiptOrderId = sale.stage.kind === 'receipt' ? sale.stage.posOrder.id : null;
  const printCount = useReceiptPrintCount(receiptOrderId);
  const [receiptSettings] = useReceiptSettings();
  const { width } = useWindowDimensions();
  const [cartOpen, setCartOpen] = useState(false);
  // The register panel lives in RegisterControls (the cart side); the cashier sheet's drawer door opens it from the products side.
  const [registerPanelOpen, setRegisterPanelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [voidError, setVoidError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [parked, setParked] = useState<ParkedCart[]>([]);
  const [parkedOpen, setParkedOpen] = useState(false);
  const [variants, setVariants] = useState<CatalogueEntry<any>[]>();
  const [restoring, setRestoring] = useState<ParkedCart>();
  const restoreSteps = useRef<ReturnType<typeof restoreCart> | null>(null);
  const restoreResolve = useRef<((result: string | null) => void) | null>(null);
  const currentOrder = useRef<typeof sale.order | null>(sale.order);
  currentOrder.current = sale.order;
  const heldAtMount = useRef<string | null>(null);
  useEffect(() => {
    try { heldAtMount.current = props.heldCartKey ? localStorage.getItem(props.heldCartKey) : null; } catch {}
  }, []);
  useEffect(() => {
    register?.setTenderInProgress(sale.stage.kind === 'tender');
  }, [register?.setTenderInProgress, sale.stage.kind]);
  const leave = useRef({ hold: holdOpenCart, tendering: false });
  leave.current = { hold: holdOpenCart, tendering: sale.stage.kind === 'tender' || sale.saving };
  useEffect(() => {
    const handler: BeforeLeave = async () => {
      if (leave.current.tendering) return 'Finish or cancel the payment first.';
      const result = await leave.current.hold();
      return typeof result === 'string' ? result : null;
    };
    setBeforeLeave(handler);
    return () => clearBeforeLeave(handler);
  }, []);
  useEffect(() => {
    if (sale.stage.kind !== 'tender') { setCancelling(false); setVoidError(undefined); }
  }, [sale.stage.kind]);
  // v2's autoShowReceipt off (use-complete-order-flow.ts): with no auto print either, a finished sale goes straight
  // back to an empty till, once per order. With auto print on, the receipt stage renders so the print area exists.
  useEffect(() => {
    if (receiptOrderId !== null && !receiptSettings.autoShow && !receiptSettings.autoPrint) sale.newSale();
  }, [sale.stage.kind, receiptOrderId]);

  async function voidTenders(payments: readonly Payment[], reason: TenderVoid['reason']): Promise<boolean> {
    try {
      const collection = (outbox.enabled && outbox.orders!.database.collections.tender_voids) as TenderVoidCollection;
      await recordTenderVoids(collection, payments, {
        saleId: sale.order.id, currency: sale.order.currency, reason,
        registerId: REGISTER_ID, sessionId: register?.saleSession?.id,
        cashierRef: props.cashierRef, deviceTime: new Date().toISOString(),
        deviceTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setVoidError(undefined);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setVoidError(`The void was not recorded, so the payment was kept: ${message}`);
      return false;
    }
  }

  async function removeLeg(id: string) {
    if (sale.saving) { sale.removeTender(id); return; }
    const payment = sale.order.payments.find(payment => payment.id === id);
    if (!payment) return;
    if (await voidTenders([payment], 'removed')) sale.removeTender(id);
  }

  function requestCancel() {
    if (sale.order.payments.length > 0 && !sale.saving) setCancelling(true);
    else sale.cancelTender();
  }

  // A multi-payment tender is taken leg by leg: v2's checkout opens on the balance due with no leg taken, whatever the
  // method, so startTender's preset tender is cleared on that path (Card's is a full-total leg).
  function beginTender(method: 'cash' | 'external', options?: Parameters<typeof sale.startTender>[1]) {
    sale.startTender(method, options);
    if (outbox.enabled && props.multiplePayments === true) sale.setTender(null);
  }

  async function gatedStartTender(method: 'cash' | 'external') {
    if (!register?.enabled) { register?.setTenderInProgress(true); return beginTender(method); }
    try {
      const session = await register.requireSaleSession();
      register?.setTenderInProgress(true);
      beginTender(method, { session: session ?? undefined });
    } catch (error) {
      if (!(error instanceof RegisterSessionRequiredError)) throw error;
      setMessage('Open the register to take payment.');
    }
  }
  const summaries: ParkedOrderSummary[] = parked.map(cart => ({
    id: cart.id, customerName: cart.customer?.name, itemCount: cart.itemCount,
    totalMinor: cart.totalMinor, parkedAt: cart.parkedAt, source: 'local',
  }));

  useEffect(() => {
    if (!parkedCarts) return;
    const subscription = parkedCarts.find({ sort: [{ parkedAt: 'desc' }] }).$.subscribe(docs => {
      setParked(docs.map(doc => doc.toJSON() as ParkedCart));
    });
    return () => subscription.unsubscribe();
  }, [parkedCarts]);

  useEffect(() => {
    if (!restoring) return;
    restoreSteps.current ??= restoreCart(sale, restoring, props.products, connector.traits.product, currency);
    const step = restoreSteps.current.next(sale);
    if (step.done) {
      restoreSteps.current = null;
      setRestoring(undefined);
      const problems = step.value;
      const resolve = restoreResolve.current;
      restoreResolve.current = null;
      void (async () => {
        for (const code of restoring.coupons ?? []) {
          const refusal = await sale.applyCoupon(code);
          if (refusal !== null) problems.push(`Coupon ${code} was removed: ${refusal}.`);
        }
        setMessage(problems.join(' ') || undefined);
        resolve?.(null);
      })();
    }
  }, [sale.order, restoring]);

  async function onPark() {
    const cart = parkCart(sale.order);
    try {
      if (parkedCarts) await parkedCarts.insert(cart);
      else setParked(carts => [cart, ...carts]);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    sale.newSale();
    return null;
  }

  async function onResume(id: string) {
    // The 3.3.0 product schema v2 resyncs the catalogue once; resuming before it finishes would drop lines.
    if (props.status !== 'ready') {
      return 'The catalogue is still syncing. Try again in a moment.';
    }
    return resumeCart(parked.find(cart => cart.id === id)!);
  }

  async function resumeCart(selected: ParkedCart): Promise<string | null> {
    const { id } = selected;
    const current = currentOrder.current?.lineItems.length ? parkCart(currentOrder.current) : undefined;
    try {
      if (parkedCarts) {
        if (current) await parkedCarts.insert(current);
        await parkedCarts.findOne(id).remove();
      } else setParked(carts => [...(current ? [current] : []), ...carts.filter(cart => cart.id !== id)]);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    return new Promise<string | null>(resolve => {
      restoreResolve.current = resolve;
      sale.newSale();
      setRestoring(selected);
    });
  }

  // Parks a non-empty cart and records it under heldCartKey so it comes back after a redirect.
  // Resolves the parked cart, undefined for an empty cart, or the failure message.
  async function holdOpenCart(): Promise<ParkedCart | undefined | string> {
    // Only an open cart is parked: on the receipt stage the builder still holds the finished sale, which must never come back.
    if (sale.stage.kind !== 'cart' || !sale.order.lineItems.length) return undefined;
    const held = parkCart(sale.order);
    try {
      if (parkedCarts) await parkedCarts.insert(held);
      else setParked(carts => [held, ...carts]);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    try { if (props.heldCartKey) localStorage.setItem(props.heldCartKey, held.id); } catch {}
    sale.newSale();
    currentOrder.current = null;
    return held;
  }

  async function changeCashier(uuid?: string) {
    const result = await holdOpenCart();
    if (typeof result === 'string') { setMessage(result); return; }
    const held = result;
    if (uuid === undefined) { props.onAddCashier?.(); return; }
    const error = await props.onSwitchCashier!(uuid);
    if (typeof error === 'string') {
      setMessage(error);
      if (held) {
        try { if (props.heldCartKey) localStorage.removeItem(props.heldCartKey); } catch {}
        setMessage(await resumeCart(held) ?? error);
      }
    }
  }

  useEffect(() => {
    if (!props.heldCartKey || !heldAtMount.current || props.status !== 'ready'
      || sale.stage.kind !== 'cart' || sale.order.lineItems.length || restoring) return;
    const cart = parked.find(cart => cart.id === heldAtMount.current);
    if (!cart) return;
    heldAtMount.current = null;
    try { localStorage.removeItem(props.heldCartKey); } catch {}
    void resumeCart(cart).then(error => { if (typeof error === 'string') setMessage(error); });
  }, [parked, props.status, sale.stage.kind, sale.order.lineItems.length, restoring]);

  async function onDiscard(id: string) {
    try {
      if (parkedCarts) await parkedCarts.findOne(id).remove();
      else setParked(carts => carts.filter(cart => cart.id !== id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  // v2's cart foot (cart/foot.tsx, buttons/pay.tsx): one "Checkout {total}" opens the tender on Cash, where the cashier
  // picks the method, and a ⋮ menu holds Void. v2 voids at once and offers Undo; the open sale here has no server copy
  // to restore, so Void asks first.
  const [voidOpen, setVoidOpen] = useState(false);
  const voidOffered = sale.order.lineItems.length > 0 && sale.order.payments.length === 0;
  const checkout = {
    onCheckout: () => { void gatedStartTender('cash'); },
    actions: voidOffered ? [{ label: 'Void', destructive: true, onPress: () => setVoidOpen(true) }] : [],
  };

  function onSelect(doc: any) {
    try {
      const entries = catalogueEntries([doc], connector.traits.product, { currency });
      if (!entries.length) {
        setMessage(`${connector.traits.product.getName(doc)} has no options to sell`);
        return;
      }
      if (entries.length === 1) onAdd(entries[0]);
      else { setVariants(entries); setMessage(undefined); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function onAdd(entry: CatalogueEntry<any>): boolean {
    try {
      sale.add(entry, connector.traits.product);
      setVariants(undefined);
      setMessage(undefined);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  function onScan(code: string): 'clear' | 'search' | 'keep' {
    try {
      const result = lookupCode(props.products, connector.traits.product, code, { currency });
      if (result.kind === 'entry') {
        const { product, variant } = result.entry;
        const name = connector.traits.product.getName(product);
        const label = variant.title ? `${name} · ${variant.title}` : name;
        if (variant.stock.status === 'out_of_stock') {
          scanFeedback('failure');
          setMessage(`${label} out of stock`);
          return 'keep';
        }
        if (onAdd(result.entry)) {
          scanFeedback('success');
          setMessage(`${label} added to cart`);
        } else scanFeedback('failure');
        return 'clear';
      }
      if (result.kind === 'product') {
        // v2's chooseVariation plays the failure tone: the scan did not add a line.
        scanFeedback('failure');
        onSelect(result.product);
        return 'clear';
      }
      scanFeedback('failure');
      setMessage(result.kind === 'several'
        ? `Several matches: ${result.count} products found — ${code}`
        : `Barcode not found — ${code}`);
      return 'search';
    } catch (error) {
      scanFeedback('failure');
      setMessage(error instanceof Error ? error.message : String(error));
      return 'keep';
    }
  }

  const drawerFigure = drawerFigureText(register, minor => sheetMoney(minor, currency, props.locale));
  const browse = variants ? (
    <VariantChooser entries={variants} currency={currency} traits={connector.traits.product} onSelect={onAdd} onClose={() => setVariants(undefined)} />
  ) : <CatalogueView {...props} hideOfflineBadge={width >= 900 && register?.enabled === true} onSelect={onSelect} onScan={onScan} message={message}
    tax={tax} inCartCounts={inCart}
    viewState={viewState} onViewStateChange={setViewState}
    cashierControl={props.onSwitchCashier ? <CashierSheet name={props.cashierName} cashiers={props.cashiers ?? []}
      onSwitch={changeCashier} onAddAnother={() => changeCashier()} onSignOut={props.onSignOut}
      onRemove={props.onRemoveCashier}
      blockedReason={sale.stage.kind === 'tender' || sale.saving ? 'Finish or cancel the payment first.' : undefined}
      storeName={props.storeName}
      sales={outboxOrders ? { orders: outboxOrders, cashierRef: props.cashierRef, currency, locale: props.locale } : null}
      drawer={drawerFigure ? { figure: drawerFigure,
        ...drawerVerbs(register, id => id === props.cashierRef ? props.cashierName : undefined) } : undefined}
      // On a narrow screen the products and the cart are never mounted together, so opening the cart is what mounts
      // RegisterPanel; on a wide screen both panes are up and setCartOpen changes nothing.
      onOpenDrawer={register?.enabled ? () => { setCartOpen(true); setRegisterPanelOpen(true); } : undefined}
      adminUrl={props.adminUrl}
    /> : props.cashierControl} />;
  const cartPane = (
    <View className="flex-1 bg-background p-4">
      {width < 900 && message ? <Text>{message}</Text> : null}
      {sale.stage.kind === 'cart' ? (
        <>
          {props.customers ? <CustomerPicker source={props.customers} customer={sale.order.customer ?? null} onChange={sale.setCustomer}
            createBlockedReason={createCustomersBlockedReason(effective)} /> : null}
          <ParkedSales sale={sale} parked={summaries} onPark={onPark} onResume={onResume}
            onDiscard={onDiscard} currency={currency} open={parkedOpen} onOpenChange={setParkedOpen} />
          {/* Add coupon sits above the cart; WCPOS v2 has it in an add-items menu. Applied coupons are rows under Subtotal (afterSubtotal). */}
          {couponsOffered && props.couponCollections ? <CouponEntry sale={sale} coupons={props.couponCollections.coupons} currency={currency} /> : null}
          {/* M6's order notes can take the price-change reason via onPriceChange. */}
          {/* B7: quantity and price open keypad popovers, as v2's cart/cells/quantity-keypad.tsx and cart/cells/price.tsx do. */}
          <CartWithSettings sale={{ ...sale, startTender: gatedStartTender }} canEditPrice lineEditor="popover" taxClasses={taxClassOptions(props.storeSettings.taxClassSlugs)}
            afterSubtotal={couponsOffered && props.couponCollections ? <CouponRows sale={sale} /> : undefined}
            checkout={checkout}
            position={viewState.position} onPositionChange={position => setViewState({ ...viewState, position })}
            openOrders={<OpenOrderTabs parked={parked} current={sale.order} currency={currency} locale={props.locale} onSelect={onResume} onNew={onPark} onError={setMessage}
              onOpenList={() => setParkedOpen(true)} />} />
          {voidOpen && <AlertDialog open onOpenChange={next => { if (!next) setVoidOpen(false); }}>
            <AlertDialogContent testID="cart-void-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>Void this sale?</AlertDialogTitle>
                <AlertDialogDescription>Its items are removed. This can't be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel asChild onPress={() => setVoidOpen(false)}>
                  <Button variant="outline" testID="cart-void-keep"><Text>Keep sale</Text></Button>
                </AlertDialogCancel>
                <AlertDialogAction asChild onPress={() => { setVoidOpen(false); sale.newSale(); }}>
                  <Button variant="destructive" testID="cart-void-confirm"><Text>Void sale</Text></Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>}
        </>
      ) : sale.stage.kind === 'tender' ? outbox.enabled ? (props.multiplePayments === true ? (
        cancelling && sale.order.payments.length > 0 ? (
          <>
            {voidError ? <Text testID="tender-void-error" accessibilityRole="alert" className="text-destructive">{voidError}</Text> : null}
            <CancelPaymentView payments={sale.order.payments} currency={currency} onKeep={() => setCancelling(false)}
              onConfirm={async () => {
                if (sale.saving) { setCancelling(false); sale.cancelTender(); return; }
                if (!(await voidTenders(sale.order.payments, 'cancelled'))) return;
                setCancelling(false); sale.cancelTender();
              }} />
          </>
        ) : (
          <>
            {voidError ? <Text testID="tender-void-error" accessibilityRole="alert" className="text-destructive">{voidError}</Text> : null}
            {sale.order.payments.length > 0 ? <Button variant="ghost" testID="checkout-cancel-payment" onPress={requestCancel}><Text>Cancel payment</Text></Button> : null}
            <TenderPane multi sale={{ ...sale, cancelTender: requestCancel }} />
            {/* One column below 900: the legs sit under the tender (wide, the ledger has the products panel). */}
            {width < 900 ? <LedgerPane order={sale.order} onRemove={sale.saving ? undefined : id => { void removeLeg(id); }} /> : null}
          </>
        )
      ) : <TenderPane sale={sale} />) : (
        <>
          <Text>Taking payment arrives in the next update</Text>
          <Button onPress={() => sale.cancelTender()}><Text>Back to cart</Text></Button>
        </>
      ) : sale.stage.kind === 'receipt' ? (() => {
        const orderId = sale.stage.posOrder.id;
        const receiptOrder = (outbox.enabled && outbox.recent.find(o => o.id === orderId)) || sale.stage.posOrder;
        const receiptCoupons = sale.stage.order.display.coupons ?? [], receiptCurrency = sale.stage.order.currency;
        return (
        <>
          <ReceiptPaidMoment posOrder={receiptOrder} locale={props.locale} onClose={sale.newSale} />
          <ReceiptZoom>
          <ReceiptPrintSheet orderId={orderId} autoPrint={receiptSettings.autoPrint}
            onAutoPrinted={receiptSettings.autoShow ? undefined : sale.newSale}>
          <Receipt order={sale.stage.order} posOrder={receiptOrder} store={{ name: props.storeName }}
            cashier={props.cashierName} registerId={REGISTER_ID} newSale={sale.newSale}
            doneLabel={receiptSettings.autoPrint ? 'Print receipt · New sale' : 'New sale'} />
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
          </ReceiptPrintSheet>
          </ReceiptZoom>
          {mailer && receiptEmails && outbox.enabled ? <ReceiptEmail collection={receiptEmails}
            orderId={sale.stage.posOrder.id} defaultEmail={sale.stage.order.customer?.email ?? ''}
            localOnly={!receiptOrder.serverRefs?.orderId} /> : null}
        </>
        );
      })() : null}
      {outbox.enabled ? <SyncStatus state={outbox.state} /> : null}
    </View>
  );

  const cart = (
    <View className="flex-1">
      <RegisterControls currency={currency} storeName={props.storeName} locale={props.locale} cartEmpty={!sale.order.lineItems.length}
        panelOpen={registerPanelOpen} onPanelOpenChange={setRegisterPanelOpen}>{cartPane}</RegisterControls>
      <RegisterSwitch />
    </View>
  );

  // WCPOS v2's two-pane checkout: during a multi-payment tender the ledger takes the products panel, beside the tender.
  const multiTender = outbox.enabled && props.multiplePayments === true && sale.stage.kind === 'tender';
  if (width >= 900) {
    const shown = liveWidth ?? viewState.width;
    const productsPanel = <View key="products" testID="pos-products-panel"
      style={{ flexGrow: shown, flexShrink: 1, flexBasis: 0 }}>{multiTender ? <View testID="checkout-ledger-column" className="flex-1 bg-muted p-4">
        <LedgerPane closing order={sale.order} onRemove={cancelling || sale.saving ? undefined : id => { void removeLeg(id); }} />
      </View> : browse}</View>;
    const cartPanel = <View key="cart" testID="pos-cart-panel"
      style={{ flexGrow: 100 - shown, flexShrink: 1, flexBasis: 0 }}
      className={`${viewState.position === 'right' ? 'border-r' : 'border-l'} border-border`}>{cart}</View>;
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
  return (
    <View className="flex-1 bg-background">
      {cartOpen ? (
        <>
          <View className="p-4">
            <Button onPress={() => setCartOpen(false)}><Text>Back to products</Text></Button>
          </View>
          {cart}
        </>
      ) : (
        <>
          {browse}
          {sale.idle && parked.length > 0 ? (
            <Button onPress={() => { setCartOpen(true); setParkedOpen(true); }}>
              <Text>{`Parked (${parked.length})`}</Text>
            </Button>
          ) : null}
          <CartBar sale={sale} onOpen={() => setCartOpen(true)} />
        </>
      )}
    </View>
  );
}
