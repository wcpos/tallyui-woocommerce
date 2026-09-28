import type { JSX } from 'react';
import { View } from 'react-native';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Text,
} from '@tallyui/components';
import { woocommerceConnector } from '@tallyui/connector-woocommerce';

export function PlaceholderScreen(): JSX.Element {
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>TallyUI WooCommerce POS</CardTitle>
          <CardDescription>Point of sale for WooCommerce, built on TallyUI</CardDescription>
        </CardHeader>
        <CardContent>
          <Text>{`Connector: ${woocommerceConnector.name}`}</Text>
        </CardContent>
      </Card>
    </View>
  );
}
