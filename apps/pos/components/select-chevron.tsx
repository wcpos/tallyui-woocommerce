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
// rounded-field 1 x --radius 8 px, bg-chip = card, chip-border = border, the light grey. TallyUI's SelectTrigger
// borders in `border-input`, which Tally's tokens make a dark grey (#848a94 against border #e5e7eb), so the face
// names v2's tone; cn() lets the later border colour win.
export const SELECT_FACE = 'h-11 gap-2 rounded-lg border-border bg-card';

// v2's FormLabel (components form/common.tsx: py-1) over its Label text (label/index.web.tsx).
export function FieldLabel({ children }: { children: string }): JSX.Element { return <Text className="py-1 text-sm font-medium leading-none text-muted-foreground">{children}</Text>; }

/** v2's FormSwitch (form/switch.tsx): the switch first, then its FormLabel, which fills the row and toggles the switch when pressed.
 *  v2's Switch is its default size, h-5 (switch/index.tsx); TallyUI's is h-6 with no size option, so -my-0.5 gives it
 *  v2's 20 px of layout and the row keeps v2's height (the label's). Drop the margin when TallyUI's Switch takes `size="sm"`. */
export function SwitchRow({ label, testID, accessibilityLabel, checked, disabled, onCheckedChange }: {
  label: string; testID: string; accessibilityLabel: string; checked: boolean; disabled?: boolean; onCheckedChange(next: boolean): void;
}): JSX.Element {
  return <View testID={`${testID}-row`} className="w-full flex-row items-center gap-3">
    <Switch testID={testID} className="-my-0.5" accessibilityLabel={accessibilityLabel} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    <Pressable testID={`${testID}-label`} className="grow" disabled={disabled} onPress={() => onCheckedChange(!checked)}>
      <FieldLabel>{label}</FieldLabel>
    </Pressable>
  </View>;
}
