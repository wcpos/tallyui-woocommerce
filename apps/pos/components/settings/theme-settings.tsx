import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { SettingsGroup, Text } from '@tallyui/components';
import { useThemeChoice } from '../../lib/theme/theme-setting';
import type { ThemeChoice } from '../../lib/theme/theme-setting';

type ThemeOption = { name: ThemeChoice; label: string; description: string };

// v2's order and copy (packages/core/src/screens/main/settings/theme.tsx).
const THEME_OPTIONS: ThemeOption[] = [
  { name: 'system', label: 'System', description: 'Follow your device settings' },
  { name: 'light', label: 'Light', description: 'Clean and bright' },
  { name: 'dark', label: 'Dark', description: 'Easy on the eyes' },
  { name: 'ocean', label: 'Ocean', description: 'Cool blues and teals' },
  { name: 'sunset', label: 'Sunset', description: 'Warm oranges and purples' },
  { name: 'monochrome', label: 'Monochrome', description: 'High contrast grayscale' },
  { name: 'paper', label: 'Paper till', description: 'Cream paper and ink' },
  { name: 'warm', label: 'Warm shop', description: 'Warm neutrals and terracotta' },
  { name: 'bold', label: 'Bold money', description: 'Black, white and lime' },
  { name: 'market', label: 'Market stall', description: 'Coral, ink and pastel tiles' },
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
      <SettingsGroup testID="settings-theme-appearance" title="Appearance"
        description="Choose a theme for the app. Custom themes provide different color schemes.">
        <View className="gap-3 p-4">
          <Text testID="settings-theme-status">
            {choice === 'system' ? 'Following system theme' : `Current theme: ${label}`}
          </Text>
          <View testID="settings-theme-options" className="w-full gap-2"
            onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>
            {rows.map(row => (
              <View key={row[0].name} testID="settings-theme-row" className="flex-row gap-2">
                {row.map(option => {
                  const selected = choice === option.name;
                  return (
                    <View key={option.name} className="min-w-0 flex-1">
                      <Pressable testID={`theme-option-${option.name}`} accessibilityRole="button"
                        accessibilityState={{ selected }} aria-selected={selected}
                        className={`min-h-16 grow items-center justify-center gap-1 rounded-lg border px-2 py-2 ${selected ? 'border-primary bg-muted' : 'border-border bg-card'}`}
                        onPress={() => setChoice(option.name)}>
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
      </SettingsGroup>
    </View>
  );
}
