// v2's form pieces that the product settings and cart settings sheets share (WCPOS monorepo packages/components/src).
import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Path } from 'react-native-svg';
import { createSvgIcon, Switch, Text } from '@tallyui/components';

// lucide `chevron-down`: the end of v2's select face (components select/index.tsx, SelectTrigger). TallyUI's
// SelectTrigger draws none, so the product settings' Sort By and the cart settings' Sort items add this one.
// Remove the chevron and both uses when TallyUI #717 (a chevron in SelectTrigger) ships.
export const ChevronDownIcon = createSvgIcon('ChevronDownIcon', () => <Path d="m6 9 6 6 6-6" />);

// v2's field box, default theme (components field-box/index.tsx; apps/main/global.css): h-ctl 44 px,
// rounded-field 1 x --radius 8 px, bg-chip = card, chip-border = border (Tally's input token is the same colour).
export const SELECT_FACE = 'h-11 gap-2 rounded-lg bg-card';

// v2's FormLabel (components form/common.tsx: py-1) over its Label text (label/index.web.tsx).
export function FieldLabel({ children }: { children: string }): JSX.Element { return <Text className="py-1 text-sm font-medium leading-none text-muted-foreground">{children}</Text>; }

/** v2's FormSwitch (form/switch.tsx): the switch first, then its FormLabel, which fills the row and toggles the switch when pressed. */
export function SwitchRow({ label, testID, accessibilityLabel, checked, disabled, onCheckedChange }: {
  label: string; testID: string; accessibilityLabel: string; checked: boolean; disabled?: boolean; onCheckedChange(next: boolean): void;
}): JSX.Element {
  return <View testID={`${testID}-row`} className="w-full flex-row items-center gap-3">
    <Switch testID={testID} accessibilityLabel={accessibilityLabel} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    <Pressable testID={`${testID}-label`} className="grow" disabled={disabled} onPress={() => onCheckedChange(!checked)}>
      <FieldLabel>{label}</FieldLabel>
    </Pressable>
  </View>;
}
