// v2's Reports date button (WCPOS monorepo `packages/core/src/screens/main/reports/date-button.tsx`): the strip's
// title, the period bold and its dates muted; pressing it opens the presets.
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { Path } from 'react-native-svg';
import { createSvgIcon, Text } from '@tallyui/components';
import { DATE_PRESETS, type DatePreset, type DayRange } from '@tallyui/pos';
import { Popover } from '@tallyui/primitives';

// lucide `chevron-down`, v2's `chevronDown` at the end of its date button, at Icon's default size-4.5 (18 px).
const ChevronDownIcon = createSvgIcon('ChevronDownIcon', () => <Path d="m6 9 6 6 6-6" />);

export const PERIOD_LABELS: Record<DatePreset, string> = {
  today: 'Today', yesterday: 'Yesterday', thisWeek: 'This week', lastWeek: 'Last week', thisMonth: 'This month', lastMonth: 'Last month',
};

/** v2 `periodLabel`: a month preset reads the month, one day `EEE d MMM`, several days `d–d MMM` or `d MMM–d MMM`. */
export function periodLabel(range: DayRange, preset: DatePreset, locale = 'en-US') {
  const date = (day: string) => {
    const [year, month, dayOfMonth] = day.split('-').map(Number);
    return new Date(year, month - 1, dayOfMonth);
  };
  const part = (day: string, option: 'weekday' | 'month' | 'day', style: 'short' | 'long' | 'numeric') =>
    date(day).toLocaleDateString(locale, { [option]: style });
  const dayMonth = (day: string) => `${part(day, 'day', 'numeric')} ${part(day, 'month', 'short')}`;
  const dates = preset === 'thisMonth' || preset === 'lastMonth' ? part(range.from, 'month', 'long')
    : range.from === range.to ? `${part(range.from, 'weekday', 'short')} ${dayMonth(range.from)}`
    : `${range.from.slice(0, 7) === range.to.slice(0, 7) ? part(range.from, 'day', 'numeric') : dayMonth(range.from)}–${dayMonth(range.to)}`;
  return { label: PERIOD_LABELS[preset], dates };
}

// No calendar or custom range: @tallyui/components has no Calendar.
export function ReportsPeriod({ preset, range, locale, onPreset }: {
  preset: DatePreset; range: DayRange; locale?: string; onPreset(next: DatePreset): void;
}) {
  const [open, setOpen] = useState(false);
  const { label, dates } = periodLabel(range, preset, locale);
  const choose = (next: DatePreset) => {
    if (next !== preset) onPreset(next);
    setOpen(false);
  };
  // Escape closes the open menu on web, as the menu chips do.
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        {/* v2's ghost Button at its default size (components button/index.tsx: h-ctl 44, rounded-control 8 px,
            a text-base label), with the date button's own `gap-1 px-1`. */}
        <Pressable testID="reports-period" accessibilityRole="button"
          className="h-11 min-w-0 shrink flex-row items-center gap-1 rounded-lg px-1 web:hover:bg-accent">
          <Text testID="reports-period-label" numberOfLines={1} className="min-w-0 shrink text-base">
            <Text className="font-semibold text-foreground">{`${label} · `}</Text>
            <Text className="text-muted-foreground">{dates}</Text>
          </Text>
          <ChevronDownIcon testID="reports-period-chevron" size={18} className="text-muted-foreground" />
        </Pressable>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Overlay testID="reports-period-overlay" style={StyleSheet.absoluteFill} />
        <Popover.Content testID="reports-period-menu" align="start" sideOffset={4}
          className="z-50 w-48 rounded-md border border-border bg-popover p-1 shadow-md outline-none">
          {DATE_PRESETS.map(row => {
            const selected = row === preset;
            return <Pressable key={row} testID={`reports-period-${row}`} role="menuitem"
              accessibilityState={{ selected }} aria-selected={selected} onPress={() => choose(row)}
              className={`flex-row items-center justify-between gap-2 rounded-sm px-3 py-2${selected ? ' bg-accent' : ''}`}>
              <Text className="text-sm text-popover-foreground">{PERIOD_LABELS[row]}</Text>
              {selected && <Text className="text-sm text-primary">✓</Text>}
            </Pressable>;
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
