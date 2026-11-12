import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@tallyui/components';

/** v2's SegmentedControl: one row of radio segments. */
export function Segmented({ testID, label, value, segments, onChange }: {
  testID: string; label: string; value: string; segments: { value: string; label: string; disabled?: boolean }[]; onChange(value: string): void;
}): JSX.Element {
  return <View role="radiogroup" aria-label={label} testID={testID} className="min-h-11 flex-row overflow-hidden rounded-lg border border-border bg-card">
    {segments.map((segment, index) => {
      const selected = segment.value === value;
      // v2 segmented-control/index.tsx:123 and :132: the open segment is the `--selected` pair, its fill kept on hover,
      // and its ink text-selected-foreground; one component, so every Segmented (Reports and the catalogue sheet) follows.
      return <Pressable key={segment.value} role="radio" aria-checked={selected} disabled={segment.disabled} testID={`${testID}-segment-${segment.value}`}
        className={'flex-1 flex-row items-center justify-center px-3 py-1.5 active:opacity-70'
          + (index > 0 ? ' border-l border-border' : '') + (selected ? ' bg-selected web:hover:bg-selected' : ' web:hover:bg-accent')
          + (segment.disabled ? ' opacity-45' : '')}
        onPress={() => { if (!selected && !segment.disabled) onChange(segment.value); }}>
        <Text testID={`${testID}-segment-${segment.value}-label`} className={'text-base font-medium ' + (selected ? 'text-selected-foreground' : 'text-muted-foreground')}>{segment.label}</Text>
      </Pressable>;
    })}
  </View>;
}
