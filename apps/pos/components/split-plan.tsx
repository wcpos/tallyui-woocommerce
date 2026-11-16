import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@tallyui/components';
import { evenSplitShareMinor, type PlanLeg } from '@tallyui/pos';

// WCPOS v2: tender-pane.tsx:732-777.
export function EvenSplitTiles({ restMinor, onPick, fmt, disabled }: {
  restMinor: number; onPick: (ways: number) => void; fmt: (minor: number) => string; disabled: boolean;
}): JSX.Element {
  return <>
    <Text className="w-full text-center text-sm text-muted-foreground">Split the rest</Text>
    <View className="w-full flex-row flex-wrap gap-2">
      {[2, 3, 4, 5, 6].map(ways => <Pressable key={ways} accessibilityRole="button" testID={`checkout-even-${ways}`}
        className="flex-1 items-center rounded-lg border border-border bg-card px-4 py-3" disabled={disabled} onPress={() => onPick(ways)}>
        <Text className="text-base font-semibold text-foreground">{ways} ways</Text>
        <Text className="text-sm text-muted-foreground">{fmt(evenSplitShareMinor(restMinor, ways))} each</Text>
      </Pressable>)}
    </View>
  </>;
}

// WCPOS v2: tender-pane.tsx:337-352, 485-584.
export function PlanStrip({ legs, taken, paidMinor, onChange, fmt, disabled }: {
  legs: PlanLeg[]; taken: { title: string; minor: number }[]; paidMinor: number;
  onChange: () => void; fmt: (minor: number) => string; disabled: boolean;
}): JSX.Element {
  const pills: JSX.Element[] = [];
  for (let index = 0; index < legs.length; index++) {
    const leg = legs[index];
    if (leg.state === 'done') continue;
    let run = 1;
    if (leg.state === 'todo') while (legs[index + run]?.state === 'todo' && legs[index + run].minor === leg.minor) run++;
    pills.push(<View key={index} testID={`checkout-plan-leg-${index}`} className={`min-h-8 flex-row items-center rounded-full border px-3 ${leg.state === 'now' ? 'border-primary' : 'border-border opacity-60'}`}>
      <Text className="text-xs text-foreground">{run > 1 ? `Then ${run} × ${fmt(leg.minor)}` : fmt(leg.minor)}</Text>
    </View>);
    index += run - 1;
  }
  return <View testID="checkout-plan" className="w-full flex-row flex-wrap items-center justify-center gap-2">
    {taken.length >= 1 && <View testID="checkout-plan-done" className="min-h-8 flex-row items-center rounded-full border border-border opacity-60 px-3">
      <Text className="text-xs text-foreground">{taken.length === 1 ? `${taken[0].title} ${fmt(taken[0].minor)}` : `${taken.length} paid · ${fmt(paidMinor)}`}</Text>
    </View>}
    {pills}
    <Pressable accessibilityRole="button" testID="checkout-plan-change" className="min-h-8 items-center justify-center px-3" disabled={disabled} onPress={onChange}>
      <Text className="text-xs text-foreground underline">Change split</Text>
    </Pressable>
  </View>;
}
