// An area screen's top row. On a wide window v2's area screens (Orders, Customers, Reports, Products,
// Coupons) have no title row and no Back button: the permanent rail is the navigation, and the screen's first
// row is its own toolbar, 16px below the top. A narrow window has no rail, so the title and Back stay.
import { useContext } from 'react';
import type { JSX } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import { AppRailShown } from './app-rail';

export function AreaHeader({ title, backTestID, onBack, gap = true }: {
  title: string;
  backTestID: string;
  onBack(): void;
  /** False when the screen's body already pads its top. */
  gap?: boolean;
}): JSX.Element | null {
  const railShown = useContext(AppRailShown);
  if (railShown) return gap ? <View testID="area-header-gap" className="h-4" /> : null;
  return (
    <View className="flex-row items-center justify-between p-4">
      <Text accessibilityRole="header">{title}</Text>
      <Button testID={backTestID} onPress={onBack}><Text>Back</Text></Button>
    </View>
  );
}
