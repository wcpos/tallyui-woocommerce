// v2's Reports menu chip (WCPOS monorepo `packages/core/src/screens/main/reports/menu-chip.tsx`): the chip shows the
// current choice, pressing it opens a menu of choices, and a chip off its default carries a clear that puts it back.
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@tallyui/components';
import { Popover } from '@tallyui/primitives';

export type MenuChoice = { value: string; label: string };

export function MenuChip({ name, value, defaultValue, choices, onChange, hint }: {
  name: string; value: string; defaultValue: string; choices: readonly MenuChoice[];
  onChange(next: string): void; hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const on = value !== defaultValue;
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
      <View className={`h-9 flex-row items-center self-start rounded-md border bg-card ${on ? 'border-primary' : 'border-border'}`}>
        <Popover.Trigger asChild>
          <Pressable testID={`hero-chip-${name}`} accessibilityRole="button" className="h-full flex-row items-center gap-1.5 px-3">
            <Text className={`text-sm font-medium ${on ? 'text-primary' : 'text-foreground'}`}>
              {choices.find(row => row.value === value)?.label ?? value}
            </Text>
            <Text className={`text-xs ${on ? 'text-primary' : 'text-muted-foreground'}`}>▾</Text>
          </Pressable>
        </Popover.Trigger>
        {on && <Pressable testID={`hero-chip-${name}-clear`} accessibilityRole="button" accessibilityLabel="Clear"
          onPress={() => choose(defaultValue)} className="h-full justify-center pr-3">
          <Text className="text-sm text-primary">✕</Text>
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
