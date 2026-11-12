import type { ComponentType, JSX } from 'react';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { Path } from 'react-native-svg';
import { createSvgIcon, Text } from '@tallyui/components';
import type { SvgIconProps } from '@tallyui/components';
import { useThemeChoice } from '../../lib/theme/theme-setting';
import type { ThemeChoice } from '../../lib/theme/theme-setting';

// v2's glyphs for the theme tiles (theme.tsx:444-498), its tabler set at stroke 1.5
// (packages/components/src/icon/components/tabler/<name>.tsx).
const DesktopIcon = createSvgIcon('DesktopIcon', () => <Path d="M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm4 15h10m-8-4v4m6-4v4" />);
const SunIcon = createSvgIcon('SunIcon', () => <Path d="M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0m-5 0h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m12.1-.7-.7.7m0 11.4.7.7m-12.1-.7-.7.7" />);
const MoonIcon = createSvgIcon('MoonIcon', () => <Path d="M12 3h.393a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 2.992z" />);
const WaveIcon = createSvgIcon('WaveIcon', () => <Path d="M3 7q4.5-3 9 0c4.5 3 6 2 9 0M3 17q4.5-3 9 0c4.5 3 6 2 9 0M3 12q4.5-3 9 0c4.5 3 6 2 9 0" />);
const SunsetIcon = createSvgIcon('SunsetIcon', () => <Path d="M3 12h1m8-9v1m8 8h1M5.6 5.6l.7.7m12.1-.7-.7.7M8 12a4 4 0 1 1 8 0M3 16h18M3 20h18" />);
const ContrastIcon = createSvgIcon('ContrastIcon', () => <>
  <Path d="M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0" />
  <Path d="M12 17a5 5 0 0 0 0-10z" />
</>);
const ReceiptIcon = createSvgIcon('ReceiptIcon', () => <Path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2zM9 7h6m-6 4h6m-2 4h2" />);
const StoreIcon = createSvgIcon('StoreIcon', () => <Path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M5 21V10.85M19 21V10.85M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />);
const CashIcon = createSvgIcon('CashIcon', () => <>
  <Path d="M7 15H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
  <Path d="M7 10a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" />
  <Path d="M12 14a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
</>);
const BasketIcon = createSvgIcon('BasketIcon', () => <>
  <Path d="M10 14a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
  <Path d="M5.001 8H19a2 2 0 0 1 1.977 2.304l-1.255 7.152A3 3 0 0 1 16.756 20H7.244a3 3 0 0 1-2.965-2.544l-1.255-7.152A2 2 0 0 1 5.001 8M17 10l-2-6m-8 6 2-6" />
</>);

type ThemeOption = { name: ThemeChoice; label: string; description: string; icon: ComponentType<SvgIconProps> };

// v2's order, copy and icons (packages/core/src/screens/main/settings/theme.tsx:440-501).
const THEME_OPTIONS: ThemeOption[] = [
  { name: 'system', label: 'System', description: 'Follow your device settings', icon: DesktopIcon },
  { name: 'light', label: 'Light', description: 'Clean and bright', icon: SunIcon },
  { name: 'dark', label: 'Dark', description: 'Easy on the eyes', icon: MoonIcon },
  { name: 'ocean', label: 'Ocean', description: 'Cool blues and teals', icon: WaveIcon },
  { name: 'sunset', label: 'Sunset', description: 'Warm oranges and purples', icon: SunsetIcon },
  { name: 'monochrome', label: 'Monochrome', description: 'High contrast grayscale', icon: ContrastIcon },
  { name: 'paper', label: 'Paper till', description: 'Cream paper and ink', icon: ReceiptIcon },
  { name: 'warm', label: 'Warm shop', description: 'Warm neutrals and terracotta', icon: StoreIcon },
  { name: 'bold', label: 'Bold money', description: 'Black, white and lime', icon: CashIcon },
  { name: 'market', label: 'Market stall', description: 'Coral, ink and pastel tiles', icon: BasketIcon },
];

// v2's tile grid: tiles at least 128px wide with an 8px gap, two to five columns.
const MIN_TILE_WIDTH = 128;
const TILE_GAP = 8;
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 5;

export function themeColumns(width: number): number {
  return Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, Math.floor((width + TILE_GAP) / (MIN_TILE_WIDTH + TILE_GAP))));
}

export function ThemeSettings(): JSX.Element {
  const [choice, setChoice] = useThemeChoice();
  const windowSize = useWindowDimensions();
  // The grid's own width once laid out; the window width until then.
  const [gridWidth, setGridWidth] = useState<number | null>(null);
  const columns = themeColumns(gridWidth ?? windowSize.width);
  const rows: ThemeOption[][] = [];
  for (let start = 0; start < THEME_OPTIONS.length; start += columns) rows.push(THEME_OPTIONS.slice(start, start + columns));
  const label = THEME_OPTIONS.find(option => option.name === choice)?.label;
  return (
    <View testID="screen-settings-theme" className="gap-5">
      {/* v2's first SettingsSection (theme.tsx:525, settings-section.tsx:32): a flat heading, no card round the rows. */}
      <View testID="settings-theme-appearance" className="gap-1">
        <View className="gap-0.5">
          {/* v2's SectionHeading `section` rank (section-heading/index.tsx:21, text/ladder.ts:11). */}
          <Text testID="settings-theme-appearance-heading" role="heading" aria-level={2} className="text-base font-semibold text-foreground">Appearance</Text>
          <Text className="text-xs text-muted-foreground">Choose a theme for the app. Custom themes provide different color schemes.</Text>
        </View>
        {/* v2's status line is a stacked PropertyRow key (theme.tsx:131-139). The demo reads "Current Theme: Light";
            v2 says "Following system theme" while it follows the device and names no resolved theme.
            v2's stacked row (property-row/index.tsx:150-166) is py-1 round a min-h-9 key column whose wrapped line packs at
            its top, then gap-1 and an empty value: 48 tall, the key at its top. Here the row is 44 (`min-h-11 py-1`, the
            line at the top) and the section's gap-1 makes the 48, so the cards start 44 below the line's middle, not 30. */}
        <View testID="settings-theme-status-row" className="min-h-11 py-1">
          <Text testID="settings-theme-status" className="text-sm text-muted-foreground">
            {choice === 'system' ? 'Following system theme' : `Current Theme: ${label}`}
          </Text>
        </View>
        {/* v2's measured grid under the row (theme.tsx:141-142, tile-grid/index.tsx:27). */}
        <View testID="settings-theme-grid" className="pt-2" onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>
          <View testID="settings-theme-options" className="w-full gap-2">
            {rows.map(row => (
              <View key={row[0].name} testID="settings-theme-row" className="flex-row gap-2">
                {row.map(option => {
                  const selected = choice === option.name;
                  const Glyph = option.icon;
                  return (
                    <View key={option.name} className="min-w-0 flex-1">
                      <Pressable testID={`theme-option-${option.name}`} accessibilityRole="button"
                        accessibilityState={{ selected }} aria-selected={selected}
                        className={`min-h-16 grow items-center justify-center gap-1 rounded-lg border px-2 py-2 ${selected ? 'border-primary bg-muted' : 'border-border bg-card'}`}
                        onPress={() => setChoice(option.name)}>
                        {/* v2's Tile draws the icon above the title (theme.tsx:95), at Icon's default 18 (icon/index.tsx:27). */}
                        <Glyph testID={`theme-card-${option.name}-icon`} size={18} strokeWidth={1.5} className="text-foreground" />
                        <Text numberOfLines={2} className="text-center text-base font-medium text-foreground">{option.label}</Text>
                        <Text numberOfLines={2} className="text-center text-xs text-muted-foreground">{option.description}</Text>
                      </Pressable>
                    </View>
                  );
                })}
                {Array.from({ length: columns - row.length }, (_, pad) => (
                  <View key={`pad-${pad}`} testID="settings-theme-spacer" className="min-w-0 flex-1" />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
