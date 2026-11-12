// v2's Reports menu chip (WCPOS monorepo `packages/core/src/screens/main/reports/menu-chip.tsx`): the chip shows the
// current choice, pressing it opens a menu of choices, and a chip off its default carries a clear that puts it back.
import { useEffect, useState, type ComponentType } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text, type SvgIconProps } from '@tallyui/components';
import { Popover } from '@tallyui/primitives';
import { chipInkClassName, chipToneClassName } from './catalogue-filter-chips';

export type MenuChoice = { value: string; label: string };

/** v2's `Chip` face (packages/components/src/chip/index.tsx): a 44 (`h-ctl`) pill, `px-3`, `gap-1.5`, an 18 icon
 *  (`size-4.5`) and a regular `text-base` label in one ink, and no caret; the shared chip tone (chip/index.tsx:163). */
export function chipFaceClassName(on: boolean): string {
  return `h-11 flex-row items-center self-start rounded-full border ${chipToneClassName(on)}`;
}

export function MenuChip({ name, icon: Icon, value, defaultValue, choices, onChange, hint }: {
  name: string; icon?: ComponentType<SvgIconProps>; value: string; defaultValue: string; choices: readonly MenuChoice[];
  onChange(next: string): void; hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const on = value !== defaultValue;
  // v2's one ink for icon, label and clear (chip/index.tsx:106).
  const ink = chipInkClassName(on);
  const choose = (next: string) => {
    if (next !== value) onChange(next);
    setOpen(false);
  };
  // Escape closes the open menu on web, as TallyUI's LinePopover does.
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);
  // The primitives' Popover, wired as LinePopover is, so a press on the overlay outside the menu closes it.
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <View testID={`hero-chip-${name}-face`} className={chipFaceClassName(on)}>
        <Popover.Trigger asChild>
          <Pressable testID={`hero-chip-${name}`} accessibilityRole="button" className="h-full flex-row items-center gap-1.5 px-3">
            {Icon && <Icon testID={`hero-chip-${name}-icon`} size={18} className={ink} />}
            <Text className={`text-base font-normal ${ink}`}>
              {choices.find(row => row.value === value)?.label ?? value}
            </Text>
          </Pressable>
        </Popover.Trigger>
        {on && <Pressable testID={`hero-chip-${name}-clear`} accessibilityRole="button" accessibilityLabel="Clear"
          onPress={() => choose(defaultValue)} className="h-full justify-center pr-3">
          <Text testID={`hero-chip-${name}-clear-mark`} className={`text-sm ${ink}`}>✕</Text>
        </Pressable>}
      </View>
      <Popover.Portal>
        <Popover.Overlay testID={`hero-${name}-overlay`} style={StyleSheet.absoluteFill} />
        <Popover.Content testID={`hero-${name}-menu`} align="start" sideOffset={4}
          className="z-50 w-64 rounded-md border border-border bg-popover p-1 shadow-md outline-none">
          {choices.map(row => {
            const selected = row.value === value;
            return <Pressable key={row.value} testID={`hero-${name}-${row.value}`} role="menuitem"
              accessibilityState={{ selected }} aria-selected={selected} onPress={() => choose(row.value)}
              className={`flex-row items-center justify-between gap-2 rounded-sm px-3 py-2${selected ? ' bg-accent' : ''}`}>
              <Text className="text-sm text-popover-foreground">{row.label}</Text>
              {selected && <Text className="text-sm text-primary">✓</Text>}
            </Pressable>;
          })}
          {hint && <Text testID={`hero-${name}-menu-hint`} className="px-3 py-2 text-sm text-muted-foreground">{hint}</Text>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
