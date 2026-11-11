// v2's phone till tab bar (WCPOS monorepo): `apps/main/components/pos-phone-tab-bar.tsx` (`POSPhoneTabBar`: a card
// bar with a top border, `pos-tab-bar`, a tablist of two equal tabs `pos-tab-products` / `pos-tab-cart`, each an icon
// over a small label, the active one in the primary colour and the other muted, the cart's badge hung off its icon's
// top right) and `packages/core/src/screens/main/pos/cart/cart-tab-count.tsx` (`CartTabCount`: the summed product
// quantities when above 0, else `New`, as a primary pill). Deviations: no count beat, no native haptic, no home
// indicator padding.
import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Path, Rect, Line, Circle } from 'react-native-svg';
import { createSvgIcon, Text } from '@tallyui/components';

export type PosPhoneTab = 'products' | 'cart';

// v2's `gift` glyph, as app-rail.tsx's Products item.
const ProductsIcon = createSvgIcon('PhoneProductsIcon', () => <><Rect x={3} y={7} width={18} height={4} rx={1} /><Path d="M5 11v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9" /><Line x1={12} y1={7} x2={12} y2={22} /><Path d="M12 7H8.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><Path d="M12 7h3.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>);
// v2's `cart` glyph: a trolley with two wheels.
const CartIcon = createSvgIcon('PhoneCartIcon', () => <><Circle cx={9} cy={20} r={1.5} /><Circle cx={18} cy={20} r={1.5} /><Path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6" /></>);

const TABS: { tab: PosPhoneTab; label: string; Glyph: typeof CartIcon }[] = [
  { tab: 'products', label: 'Products', Glyph: ProductsIcon },
  { tab: 'cart', label: 'Cart', Glyph: CartIcon },
];

export function PosPhoneTabBar({ active, onSelect, cartCount }: {
  active: PosPhoneTab;
  onSelect(tab: PosPhoneTab): void;
  cartCount: number;
}): JSX.Element {
  const badge = cartCount > 0 ? String(cartCount) : 'New';
  return (
    <View testID="pos-tab-bar" className="border-t border-border bg-card">
      <View role="tablist" className="flex-row justify-around py-2">
        {TABS.map(({ tab, label, Glyph }) => {
          const selected = active === tab;
          const tone = selected ? 'text-primary' : 'text-muted-foreground';
          return (
            // react-native-web reads aria-selected, not accessibilityState (as coupon-entry.tsx).
            <Pressable key={tab} testID={`pos-tab-${tab}`} role="tab" aria-selected={selected} accessibilityState={{ selected }}
              accessibilityLabel={tab === 'cart' ? `Cart, ${badge}` : label} onPress={() => onSelect(tab)}
              className="flex-1 items-center gap-1 py-2">
              {tab === 'cart' ? (
                // The badge's left edge two thirds across the icon, hanging off its right (v2).
                <View>
                  <Glyph size={18} className={tone} />
                  <View pointerEvents="none" className="absolute -top-2 left-3 h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5">
                    <Text testID="pos-tab-cart-count" className="text-xs font-bold tabular-nums text-primary-foreground">{badge}</Text>
                  </View>
                </View>
              ) : <Glyph size={18} className={tone} />}
              <Text className={`text-xs ${tone}`}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
