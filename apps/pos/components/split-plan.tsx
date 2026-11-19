import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@tallyui/components';
import { evenSplitShareMinor, type PlanLeg } from '@tallyui/pos';
import { filterChipClassName, filterChipTextClassName } from './catalogue-filter-chips';

// WCPOS v2: tender-pane.tsx:171.
const PERCENTS = [10, 20, 25, 50];

// WCPOS v2: tender-pane.tsx:732-785 scrolls the tiles sideways; the desk ruled (2026-11-16, #298)
// that no tile may be clipped, so they wrap instead. The Percent tile leads them (v2 :752-758).
export function EvenSplitTiles({ restMinor, onPick, onPercent, fmt, disabled }: {
  restMinor: number; onPick: (ways: number) => void; onPercent: () => void; fmt: (minor: number) => string; disabled: boolean;
}): JSX.Element {
  const tile = (testID: string, title: string, sub: string, onPress: () => void) => <View key={testID} className="min-w-20 grow basis-0">
    <Pressable accessibilityRole="button" testID={testID}
      className="grow items-center justify-center gap-1 rounded-lg border border-border bg-card px-1 py-2" disabled={disabled} onPress={onPress}>
      <Text className="text-center text-base font-semibold text-foreground" numberOfLines={2}>{title}</Text>
      <Text className="text-center text-sm text-muted-foreground" numberOfLines={2}>{sub}</Text>
    </Pressable>
  </View>;
  return <>
    <Text className="w-full text-center text-sm text-muted-foreground">Split the rest</Text>
    <View testID="checkout-split-ways" className="w-full flex-row flex-wrap gap-2">
      {tile('checkout-percent', 'Percent', 'a share', onPercent)}
      {[2, 3, 4, 5, 6].map(ways => tile(`checkout-even-${ways}`, `${ways} ways`, `${fmt(evenSplitShareMinor(restMinor, ways))} each`, () => onPick(ways)))}
    </View>
  </>;
}

// WCPOS v2: tender-pane.tsx:790-812. `percent` is the typed share; Type clears it for the keypad.
export function PercentChips({ percent, onPick, disabled }: {
  percent: number; onPick: (percent: number) => void; disabled: boolean;
}): JSX.Element {
  const chip = (testID: string, label: string, on: boolean, value: number) => <Pressable key={testID} accessibilityRole="button" testID={testID}
    aria-pressed={on} className={filterChipClassName(on)} disabled={disabled} onPress={() => onPick(value)}>
    <Text className={filterChipTextClassName(on)}>{label}</Text>
  </Pressable>;
  return <>
    <Text className="w-full text-center text-sm text-muted-foreground">Percent of the rest</Text>
    {PERCENTS.map(value => chip(`checkout-percent-${value}`, `${value} %`, percent === value, value))}
    {chip('checkout-percent-type', 'Type', !PERCENTS.includes(percent), 0)}
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
