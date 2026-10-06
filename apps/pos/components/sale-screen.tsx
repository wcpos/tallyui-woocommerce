import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Button, Cart, CartBar, POSLayout, Text } from '@tallyui/components';
import { catalogueEntries, TaxProvider, useSale } from '@tallyui/pos';
import type { CatalogueEntry } from '@tallyui/pos';
import { parkCart, restoreCart } from '../lib/sale/parked-carts';
import type { ParkedCart, ParkedCartCollection } from '../lib/sale/parked-carts';
import { ParkedCartsList } from './parked-carts';
import { VariantChooser } from './variant-chooser';
import { PriceEdit } from './price-edit';
import { CatalogueView } from './catalogue-view';
import type { CatalogueViewProps } from './catalogue-view';

// One web till until the register job (M8).
const REGISTER_ID = 'web';

export interface SaleScreenProps extends Omit<CatalogueViewProps, 'onSelect' | 'message'> { cashierRef: string; parkedCarts?: ParkedCartCollection }

export function SaleScreen(props: SaleScreenProps): JSX.Element {
  // The dev store runs with taxes off until M5 (docs/PLAN.md).
  return <TaxProvider ratesPpm={{}} pricesIncludeTax={false}><SaleScreenInner {...props} /></TaxProvider>;
}

function SaleScreenInner(props: SaleScreenProps): JSX.Element {
  const { connector, currency, parkedCarts } = props;
  const sale = useSale({ currency }, { registerId: REGISTER_ID, cashierRef: props.cashierRef });
  const { width } = useWindowDimensions();
  const [cartOpen, setCartOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const [parked, setParked] = useState<ParkedCart[]>([]);
  const [parkedOpen, setParkedOpen] = useState(false);
  const [variants, setVariants] = useState<CatalogueEntry<any>[]>();
  const [priceOpen, setPriceOpen] = useState(false);
  const [restoring, setRestoring] = useState<ParkedCart>();
  const restoreSteps = useRef<ReturnType<typeof restoreCart> | null>(null);

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
    }
  }, [sale.order, restoring]);

  async function onPark() {
    const cart = parkCart(sale.order);
    try {
      if (parkedCarts) await parkedCarts.insert(cart);
      else setParked(carts => [cart, ...carts]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return;
    }
    sale.newSale();
    setPriceOpen(false);
  }

  async function onOpen(id: string) {
    const selected = parked.find(cart => cart.id === id)!;
    const current = sale.order.lineItems.length ? parkCart(sale.order) : undefined;
    try {
      if (parkedCarts) {
        if (current) await parkedCarts.insert(current);
        await parkedCarts.findOne(id).remove();
      } else setParked(carts => [...(current ? [current] : []), ...carts.filter(cart => cart.id !== id)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return;
    }
    sale.newSale();
    setRestoring(selected);
    setParkedOpen(false);
    setPriceOpen(false);
  }

  async function onDelete(id: string) {
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

  function onAdd(entry: CatalogueEntry<any>) {
    try {
      sale.add(entry, connector.traits.product);
      setVariants(undefined);
      setMessage(undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  const browse = variants ? (
    <VariantChooser entries={variants} currency={currency} onSelect={onAdd} onClose={() => setVariants(undefined)} />
  ) : <CatalogueView {...props} onSelect={onSelect} message={message} />;
  const cart = (
    <View className="flex-1 bg-background p-4">
      {width < 900 && message ? <Text>{message}</Text> : null}
      {sale.stage.kind === 'cart' ? (
        <>
          <View className="flex-row gap-2">
            <Button disabled={!sale.order.lineItems.length} onPress={onPark}><Text>Park cart</Text></Button>
            <Button onPress={() => setParkedOpen(true)}><Text>{`Parked (${parked.length})`}</Text></Button>
            {sale.order.lineItems.length > 0 ? (
              <Button onPress={() => { setPriceOpen(true); setParkedOpen(false); }}><Text>Edit price</Text></Button>
            ) : null}
          </View>
          {parkedOpen ? (
            <ParkedCartsList carts={parked} currency={currency} onOpen={onOpen}
              onDelete={onDelete}
              onClose={() => setParkedOpen(false)} />
          ) : priceOpen && sale.order.lineItems.length > 0 ? (
            <PriceEdit lines={sale.order.lineItems} currency={currency} onSave={sale.setUnitPrice}
              onClose={() => setPriceOpen(false)} />
          ) : <Cart sale={sale} />}
        </>
      ) : sale.stage.kind === 'tender' ? (
        <>
          <Text>Taking payment arrives in the next update</Text>
          <Button onPress={() => sale.cancelTender()}><Text>Back to cart</Text></Button>
        </>
      ) : null}
    </View>
  );

  if (width >= 900) return <POSLayout layout="split" className="bg-background" browseSlot={browse} cartSlot={cart} />;
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
