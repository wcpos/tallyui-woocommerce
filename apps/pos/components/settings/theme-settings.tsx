import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { SettingsGroup, Text } from '@tallyui/components';
import { useThemeChoice } from '../../lib/theme/theme-setting';
import type { ThemeChoice } from '../../lib/theme/theme-setting';

const THEME_OPTIONS: { name: ThemeChoice; label: string; description: string }[] = [
  { name: 'system', label: 'System', description: 'Follow your device settings' },
  { name: 'light', label: 'Light', description: 'Clean and bright' },
  { name: 'dark', label: 'Dark', description: 'Easy on the eyes' },
];

export function ThemeSettings(): JSX.Element {
  const [choice, setChoice] = useThemeChoice();
  const label = THEME_OPTIONS.find(option => option.name === choice)?.label;
  return (
    <View testID="screen-settings-theme" className="gap-5">
      <Text className="text-2xl font-semibold">Theme</Text>
      <SettingsGroup testID="settings-theme-appearance" title="Appearance" description="Choose a theme for the app.">
        <View className="gap-3 p-4">
          <Text testID="settings-theme-status">
            {choice === 'system' ? 'Following system theme' : `Current theme: ${label}`}
          </Text>
          <View testID="settings-theme-options" className="flex-row flex-wrap gap-2">
            {THEME_OPTIONS.map(option => {
              const selected = choice === option.name;
              return (
                <Pressable key={option.name} testID={`theme-option-${option.name}`} accessibilityRole="button"
                  accessibilityState={{ selected }} aria-selected={selected}
                  className={`min-w-32 flex-1 gap-1 rounded-lg border p-3 ${selected ? 'border-primary bg-accent' : 'border-border bg-card'}`}
                  onPress={() => setChoice(option.name)}>
                  <Text className="text-sm font-medium text-foreground">{option.label}</Text>
                  <Text className="text-xs text-muted-foreground">{option.description}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SettingsGroup>
    </View>
  );
}
