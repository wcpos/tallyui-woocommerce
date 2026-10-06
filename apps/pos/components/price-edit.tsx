import { useState } from 'react';
import type { JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Input, Text } from '@tallyui/components';
import { formatMoney, minorUnitDigits } from '@tallyui/core';
import { parseMinor } from '@tallyui/pos';
import type { LineItem } from '@tallyui/pos';

export function PriceEdit({ lines, currency, onSave, onClose }: {
  lines: LineItem[]; currency: string; onSave(lineId: string, minor: number): string | null; onClose(): void;
}): JSX.Element {
  const [lineId, setLineId] = useState<string>();
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string>();

  function save() {
    const text = price.trim();
    const minor = parseMinor(text, minorUnitDigits(currency));
    if (!/^(?:\d+\.?\d*|\.\d+)$/.test(text) || !Number.isSafeInteger(minor)) {
      setError('Enter a valid price');
      return;
    }
    if (!lineId) return;
    const refused = onSave(lineId, minor);
    if (refused) setError(refused);
    else onClose();
  }

  return (
    <ScrollView className="py-4">
      <Text>Choose a line</Text>
      {lines.map(line => (
        <Button key={line.id} accessibilityState={{ selected: lineId === line.id }} onPress={() => {
          setLineId(line.id); setPrice(''); setError(undefined);
        }}>
          <Text>{`${line.name} · ${formatMoney({ amount: line.unitPriceMinor, currency })}`}</Text>
        </Button>
      ))}
      <Text>{`New price (${currency})`}</Text>
      <Input><Input.Field accessibilityLabel={`New price (${currency})`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" /></Input>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <View className="flex-row gap-2">
        <Button disabled={!lineId} onPress={save}><Text>Save</Text></Button>
        <Button onPress={onClose}><Text>Cancel</Text></Button>
      </View>
    </ScrollView>
  );
}
