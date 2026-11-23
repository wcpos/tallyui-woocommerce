import type { JSX, ReactNode } from 'react';
import { View } from 'react-native';
import { IconButton, Text, XIcon } from '@tallyui/components';

/**
 * The tender's title row, after WCPOS v2's checkout-column.tsx:41-57 (its spacing and its close, not its tabs): "Checkout",
 * a spacer, `children` (Cancel payment once a leg is taken), then the X that leaves the checkout as Escape does.
 */
export function CheckoutTitleBar({ onClose, disabled, children }: { onClose: () => void; disabled: boolean; children?: ReactNode }): JSX.Element {
  return <View testID="checkout-title-bar" className="flex-row items-center gap-3 p-2">
    <Text testID="checkout-title" className="text-lg font-semibold text-foreground">Checkout</Text>
    <View className="flex-1" />
    {children}
    <IconButton variant="ghost" className="h-11 w-11" testID="checkout-close" accessibilityLabel="Close" disabled={disabled} onPress={onClose}>
      <XIcon size={18} />
    </IconButton>
  </View>;
}
