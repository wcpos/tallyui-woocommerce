import { useState } from 'react';
import type { JSX } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Button, Cart, CartBar, POSLayout, Text } from '@tallyui/components';
import { TaxProvider, useSale } from '@tallyui/pos';
import { simpleEntry } from '../lib/sale/simple-entry';
import { CatalogueView } from './catalogue-view';
import type { CatalogueViewProps } from './catalogue-view';

// One web till until the register job (M8).
const REGISTER_ID = 'web';

export interface SaleScreenProps extends Omit<CatalogueViewProps, 'onSelect' | 'message'> { cashierRef: string }

export function SaleScreen(props: SaleScreenProps): JSX.Element {
  // The dev store runs with taxes off until M5 (docs/PLAN.md).
  return <TaxProvider ratesPpm={{}} pricesIncludeTax={false}><SaleScreenInner {...props} /></TaxProvider>;
}

function SaleScreenInner(props: SaleScreenProps): JSX.Element {
  const { connector, currency } = props;
  const sale = useSale({ currency }, { registerId: REGISTER_ID, cashierRef: props.cashierRef });
  const { width } = useWindowDimensions();
  const [cartOpen, setCartOpen] = useState(false);
  const [message, setMessage] = useState<string>();

  function onSelect(doc: any) {
    try {
      const entry = simpleEntry(doc, connector.traits.product, currency);
      if (!entry) {
        setMessage(`Options for ${connector.traits.product.getName(doc)} are coming soon`);
        return;
      }
      sale.add(entry, connector.traits.product);
      setMessage(undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  const browse = <CatalogueView {...props} onSelect={onSelect} message={message} />;
  const cart = (
    <View className="flex-1 bg-background p-4">
      {sale.stage.kind === 'cart' ? <Cart sale={sale} /> : sale.stage.kind === 'tender' ? (
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
          <CartBar sale={sale} onOpen={() => setCartOpen(true)} />
        </>
      )}
    </View>
  );
}
