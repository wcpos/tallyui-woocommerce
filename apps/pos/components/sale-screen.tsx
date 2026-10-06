import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Button, Cart, CartBar, ParkedSales, Receipt, SplitTender, SyncStatus, Tender, Text } from '@tallyui/components';
import { catalogueEntries, RegisterSessionRequiredError, TaxProvider, taxProviderProps, useSale } from '@tallyui/pos';
import type { ServerCapabilities, StoreSettings } from '@tallyui/core';
import type { CatalogueEntry, ParkedOrderSummary, Payment, TenderVoid } from '@tallyui/pos';
import { createCustomersBlockedReason, type CashierCapabilities } from '../lib/auth/capabilities';
import { useCatalogueView } from '../lib/catalogue/catalogue-view-state';
import { useRegister } from '../lib/register/register-context';
import { buildReceiptIdentity } from '../lib/receipts/receipt-identity';
import { useReceiptPrintCount } from '../lib/receipts/use-receipt-print-count';
import { useOutbox } from '../lib/sale/outbox-context';
import { parkCart, restoreCart } from '../lib/sale/parked-carts';
import { taxClassOptions } from '../lib/sale/tax-classes';
import { lookupCode } from '../lib/scan/lookup';
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
import { RegisterControls, RegisterSwitch } from './register-controls';
import { CancelPaymentView } from './cancel-payment-view';
import { CashierSheet, type CashierOption } from './cashier-sheet';

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
  cashier?: CashierCapabilities;
  cashiers?: CashierOption[];
  onSwitchCashier?(uuid: string): Promise<string | null>;
  onAddCashier?(): void;
  heldCartKey?: string;
}

export function SaleScreen(props: SaleScreenProps): JSX.Element {
  return <TaxProvider {...taxProviderProps(props.storeSettings)}><SaleScreenInner {...props} /></TaxProvider>;
}

function SaleScreenInner(props: SaleScreenProps): JSX.Element {
  const { connector, currency, parkedCarts, mailer, receiptEmails } = props;
  const [viewState, setViewState] = useCatalogueView();
  const effective: CashierCapabilities = props.cashier ?? { known: false, reason: 'Your permissions have not been read from the store.' };
  const outbox = useOutbox();
  const register = useRegister();
  useReceiptEmailSender({ collection: mailer ? receiptEmails ?? null : null, mailer: mailer ?? null,
    orders: outbox.enabled ? outbox.orders : null });
  const sale = useSale({ currency }, {
    registerId: REGISTER_ID, cashierRef: props.cashierRef,
    capabilities: props.capabilities ?? DEFAULT_CAPABILITIES,
    session: register?.saleSession,
    onSaleCompleted: outbox.enabled ? outbox.record : undefined,
    isStored: outbox.enabled ? outbox.isStored : undefined,
  });
  const printCount = useReceiptPrintCount(sale.stage.kind === 'receipt' ? sale.stage.posOrder.id : null);
  const { width } = useWindowDimensions();
  const [cartOpen, setCartOpen] = useState(false);
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
  useEffect(() => {
    if (sale.stage.kind !== 'tender') { setCancelling(false); setVoidError(undefined); }
  }, [sale.stage.kind]);

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

  async function gatedStartTender(method: 'cash' | 'external') {
    if (!register?.enabled) { register?.setTenderInProgress(true); return sale.startTender(method); }
    try {
      const session = await register.requireSaleSession();
      register?.setTenderInProgress(true);
      sale.startTender(method, { session: session ?? undefined });
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
      setMessage(step.value.join(' ') || undefined);
      restoreResolve.current?.(null);
      restoreResolve.current = null;
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

  async function changeCashier(uuid?: string) {
    let held: ParkedCart | undefined;
    if (sale.order.lineItems.length) {
      held = parkCart(sale.order);
      try {
        if (parkedCarts) await parkedCarts.insert(held);
        else setParked(carts => [held!, ...carts]);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
        return;
      }
      try { if (props.heldCartKey) localStorage.setItem(props.heldCartKey, held.id); } catch {}
      sale.newSale();
      currentOrder.current = null;
    }
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
          setMessage(`${label} out of stock`);
          return 'keep';
        }
        if (onAdd(result.entry)) setMessage(`${label} added to cart`);
        return 'clear';
      }
      if (result.kind === 'product') {
        onSelect(result.product);
        return 'clear';
      }
      setMessage(result.kind === 'several'
        ? `Several matches: ${result.count} products found — ${code}`
        : `Barcode not found — ${code}`);
      return 'search';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return 'keep';
    }
  }

  const browse = variants ? (
    <VariantChooser entries={variants} currency={currency} onSelect={onAdd} onClose={() => setVariants(undefined)} />
  ) : <CatalogueView {...props} onSelect={onSelect} onScan={onScan} message={message}
    viewState={viewState} onViewStateChange={setViewState}
    cashierControl={props.onSwitchCashier ? <CashierSheet name={props.cashierName} cashiers={props.cashiers ?? []}
      onSwitch={changeCashier} onAddAnother={() => changeCashier()} onSignOut={props.onSignOut}
      blockedReason={sale.stage.kind === 'tender' || sale.saving ? 'Finish or cancel the payment first.' : undefined}
    /> : props.cashierControl} />;
  const cartPane = (
    <View className="flex-1 bg-background p-4">
      {width < 900 && message ? <Text>{message}</Text> : null}
      {sale.stage.kind === 'cart' ? (
        <>
          {props.customers ? <CustomerPicker source={props.customers} customer={sale.order.customer ?? null} onChange={sale.setCustomer}
            createBlockedReason={createCustomersBlockedReason(effective)} /> : null}
          <View className="flex-row gap-2">
            <Button disabled={!sale.order.lineItems.length} onPress={async () => {
              const result = await onPark();
              if (typeof result === 'string') setMessage(result);
            }}><Text>Park cart</Text></Button>
            <Button onPress={() => setParkedOpen(true)}><Text>{`Parked (${parked.length})`}</Text></Button>
          </View>
          <ParkedSales sale={sale} parked={summaries} onPark={onPark} onResume={onResume}
            onDiscard={onDiscard} currency={currency} open={parkedOpen} onOpenChange={setParkedOpen} />
          {/* M6's order notes can take the price-change reason via onPriceChange. */}
          <Cart sale={{ ...sale, startTender: gatedStartTender }} canEditPrice taxClasses={taxClassOptions(props.storeSettings.taxClassSlugs)} />
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
            <SplitTender sale={{ ...sale, cancelTender: requestCancel, removeTender: id => { void removeLeg(id); } }} />
          </>
        )
      ) : <Tender sale={sale} />) : (
        <>
          <Text>Taking payment arrives in the next update</Text>
          <Button onPress={() => sale.cancelTender()}><Text>Back to cart</Text></Button>
        </>
      ) : sale.stage.kind === 'receipt' ? (
        <>
          <Receipt order={sale.stage.order} posOrder={sale.stage.posOrder} store={{ name: props.storeName }}
            cashier={props.cashierName} registerId={REGISTER_ID} newSale={sale.newSale} />
          <ReceiptIdentity identity={buildReceiptIdentity({
            posOrder: sale.stage.posOrder,
            register: register?.boundRegisterId && register.registerName ? { id: register.boundRegisterId, name: register.registerName } : null,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            copies: printCount,
          })} />
          {mailer && receiptEmails && outbox.enabled ? <ReceiptEmail collection={receiptEmails}
            orderId={sale.stage.posOrder.id} defaultEmail={sale.stage.order.customer?.email ?? ''} /> : null}
        </>
      ) : null}
      {outbox.enabled ? <SyncStatus state={outbox.state} /> : null}
    </View>
  );

  const cart = (
    <View className="flex-1">
      <RegisterControls currency={currency} storeName={props.storeName} locale={props.locale} cartEmpty={!sale.order.lineItems.length}>{cartPane}</RegisterControls>
      <RegisterSwitch />
    </View>
  );

  if (width >= 900) {
    const productsPanel = <View key="products" testID="pos-products-panel" className="flex-[3]">{browse}</View>;
    const cartPanel = <View key="cart" testID="pos-cart-panel"
      className={`flex-[2] ${viewState.position === 'right' ? 'border-r' : 'border-l'} border-border`}>{cart}</View>;
    return (
      <View className="flex-1 bg-bg bg-background">
        <View className="flex-1 flex-row">
          {viewState.position === 'right' ? [cartPanel, productsPanel] : [productsPanel, cartPanel]}
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
