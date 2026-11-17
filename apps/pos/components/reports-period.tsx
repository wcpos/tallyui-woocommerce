// v2's Reports date button (WCPOS monorepo `packages/core/src/screens/main/reports/date-button.tsx`): the strip's
// title, the period bold and its dates muted; pressing it opens the presets.
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Calendar, Text } from '@tallyui/components';
import { DATE_PRESETS, presetRange, type DatePreset, type DayRange } from '@tallyui/pos';
import { Popover } from '@tallyui/primitives';
import { NARROW_WIDTH } from '../lib/layout/wide';
import { ChevronDownIcon } from './select-chevron';

export const PERIOD_LABELS: Record<DatePreset, string> = {
  today: 'Today', yesterday: 'Yesterday', thisWeek: 'This week', lastWeek: 'Last week', thisMonth: 'This month', lastMonth: 'Last month',
};

/** v2 `periodLabel`: a month preset reads the month, one day `EEE d MMM`, several days `d–d MMM` or `d MMM–d MMM`. */
export function periodLabel(range: DayRange, preset: DatePreset | 'custom', locale = 'en-US') {
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
  return { label: preset === 'custom' ? null : PERIOD_LABELS[preset], dates };
}

// v2 `screens/main/reports/date-button.tsx`: presets beside a range calendar, with a hint and Done footer.
export function ReportsPeriod({ preset, range, locale, onPreset, onCustom, now = new Date() }: {
  preset: DatePreset | 'custom'; range: DayRange; locale?: string; onPreset(next: DatePreset): void; onCustom?(range: DayRange): void; now?: Date;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DayRange>(range);
  const { width } = useWindowDimensions();
  const wide = width >= NARROW_WIDTH;
  const today = presetRange('today', now, 'device').from;
  const { label, dates } = periodLabel(range, preset, locale);
  const choose = (next: DatePreset) => {
    if (next !== preset) onPreset(next);
    setOpen(false);
  };
  const apply = () => {
    const match = DATE_PRESETS.find(p => {
      const candidate = presetRange(p, now, 'device');
      return draft.from === candidate.from && draft.to === candidate.to;
    });
    if (match) { if (match !== preset) onPreset(match); }
    else onCustom?.(draft);
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
    <Popover.Root open={open} onOpenChange={next => { if (next) setDraft(range); setOpen(next); }}>
      <Popover.Trigger asChild>
        {/* v2's ghost Button at its default size (components button/index.tsx: h-ctl 44, rounded-control 8 px,
            a text-base label), with the date button's own `gap-1 px-1`. */}
        <Pressable testID="reports-period" accessibilityRole="button"
          className="h-11 min-w-0 shrink flex-row items-center gap-1 rounded-lg px-1 web:hover:bg-accent">
          <Text testID="reports-period-label" numberOfLines={1} className="min-w-0 shrink text-base">
            {label !== null && <Text className="font-semibold text-foreground">{`${label} · `}</Text>}
            <Text className="text-muted-foreground">{dates}</Text>
          </Text>
          <ChevronDownIcon testID="reports-period-chevron" size={18} className="text-muted-foreground" />
        </Pressable>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Overlay testID="reports-period-overlay" style={StyleSheet.absoluteFill} />
        <Popover.Content testID="reports-period-menu" align="start" sideOffset={4}
          style={{ width: Math.min(wide ? 556 : 360, width) }}
          className="z-50 rounded-md border border-border bg-popover p-1 shadow-md outline-none">
          <View className={wide ? 'flex-row' : 'flex-col'}>
            <View className="w-48 shrink-0 p-1">
          {DATE_PRESETS.map(row => {
            const selected = row === preset;
            return <Pressable key={row} testID={`reports-period-${row}`} role="menuitem"
              accessibilityState={{ selected }} aria-selected={selected} onPress={() => choose(row)}
              className={`flex-row items-center justify-between gap-2 rounded-sm px-3 py-2${selected ? ' bg-accent' : ''}`}>
              <Text className="text-sm text-popover-foreground">{PERIOD_LABELS[row]}</Text>
              {selected && <Text className="text-sm text-primary">✓</Text>}
            </Pressable>;
          })}
            </View>
            <View className="flex-1 p-2">
              <Calendar testID="reports-period-calendar" mode="range" value={draft} onChange={setDraft} today={today} max={today} locale={locale} />
            </View>
          </View>
          <View className="flex-row items-center gap-2 border-t border-border p-2">
            <Text className="flex-1 text-sm text-muted-foreground">Tap a day, or two days for a range.</Text>
            <Button testID="reports-period-apply" onPress={apply}><Text>Done</Text></Button>
          </View>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
