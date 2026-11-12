// v2's form pieces that the product settings and cart settings sheets share (WCPOS monorepo packages/components/src).
import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Path } from 'react-native-svg';
import { createSvgIcon, Switch, Text } from '@tallyui/components';

// TallyUI 3.19.0's SelectTrigger draws a chevron at 50% of the text colour; v2's is text-muted-foreground
// (select/index.tsx:141), so the settings select faces pass chevron={false} and draw this one.
export const ChevronDownIcon = createSvgIcon('ChevronDownIcon', () => <Path d="m6 9 6 6 6-6" />);

// v2's field box, default theme (components field-box/index.tsx; apps/main/global.css): h-ctl 44 px,
// rounded-field 1 x --radius 8 px. TallyUI's trigger already fills bg-card, but its border-input is #d1d5db;
// v2's field border is --border, so border-border keeps v2's tone.
export const SELECT_FACE = 'h-11 gap-2 rounded-lg border-border';

// v2's FormLabel (components form/common.tsx: py-1) over its Label text (label/index.web.tsx).
export function FieldLabel({ children }: { children: string }): JSX.Element { return <Text className="py-1 text-sm font-medium leading-none text-muted-foreground">{children}</Text>; }

/** v2's FormSwitch (form/switch.tsx): the switch first, then its FormLabel, which fills the row and toggles the switch when pressed.
 *  v2's Switch is h-5 (switch/index.tsx:28), and TallyUI's size="sm" is h-5 too. */
export function SwitchRow({ label, testID, accessibilityLabel, checked, disabled, onCheckedChange }: {
  label: string; testID: string; accessibilityLabel: string; checked: boolean; disabled?: boolean; onCheckedChange(next: boolean): void;
}): JSX.Element {
  return <View testID={`${testID}-row`} className="w-full flex-row items-center gap-3">
    <Switch testID={testID} size="sm" accessibilityLabel={accessibilityLabel} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    <Pressable testID={`${testID}-label`} className="grow" disabled={disabled} onPress={() => onCheckedChange(!checked)}>
      <FieldLabel>{label}</FieldLabel>
    </Pressable>
  </View>;
}
