import { View } from 'react-native';
import { Text } from '@tallyui/components';
import type { UptimeCell } from '../lib/health/performance';

// v2 apps/main/components/health/uptime-strip.tsx. Glyphs back up the colours so colour never stands alone.
// v2's Tooltip popover is left out: each cell's accessibility label carries the same words.

const hourLabel = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function cellLabel(cell: UptimeCell): string {
  const hour = hourLabel(cell.hourStartMs);
  if (cell.state === 'closed') return `${hour} — app closed`;
  if (cell.state === 'errors') return `${hour} — ${cell.requests.toLocaleString()} requests · ${cell.errors.toLocaleString()} failed`;
  return `${hour} — ${cell.requests.toLocaleString()} requests, all ok`;
}

function CellView({ cell }: { cell: UptimeCell }) {
  return (
    <View testID="uptime-cell" accessibilityLabel={cellLabel(cell)} className="min-w-1.5 flex-1">
      {cell.state === 'running' ? <View className="h-6 rounded bg-success opacity-75" />
        : cell.state === 'errors' ? (
          <View className="h-6 items-center justify-center rounded border border-warning">
            <Text className="text-xs text-warning">⚠</Text>
          </View>
        ) : <View className="h-6 rounded border border-border" />}
    </View>
  );
}

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={`h-3 w-3 rounded-sm ${swatch}`} />
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}

/** Hourly engine-uptime strip: one cell per trailing hour, glyph legend below. */
export function UptimeStrip({ cells }: { cells: UptimeCell[] }) {
  const first = cells[0];
  const middle = cells[Math.floor(cells.length / 2)];
  return (
    <View testID="uptime-strip" className="gap-1.5">
      <View className="flex-row items-end gap-[3px]">
        {cells.map(cell => <CellView key={cell.hourStartMs} cell={cell} />)}
      </View>
      <View className="flex-row justify-between">
        <Text className="font-mono text-xs text-muted-foreground/80">{first ? hourLabel(first.hourStartMs) : ''}</Text>
        <Text className="font-mono text-xs text-muted-foreground/80">{middle ? hourLabel(middle.hourStartMs) : ''}</Text>
        <Text className="font-mono text-xs text-muted-foreground/80">now ▸</Text>
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        <LegendItem swatch="bg-success opacity-75" label="running" />
        <LegendItem swatch="border border-warning" label="⚠ errors that hour" />
        <LegendItem swatch="border border-border" label="app closed" />
      </View>
    </View>
  );
}
