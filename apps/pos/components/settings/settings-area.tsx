import type { JSX, ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, SettingsLayout, Text } from '@tallyui/components';

export interface SettingsNavItem { href: string; label: string; testID: string }

export function SettingsArea({ items, currentHref, onNavigate, onBack, children }: {
  items: SettingsNavItem[];
  currentHref: string;
  onNavigate(href: string): void;
  onBack(): void;
  children: ReactNode;
}): JSX.Element {
  return (
    <SettingsLayout
      testID="settings-navigation"
      headerSlot={
        <View className="flex-row items-center gap-4 p-4">
          <Button testID="settings-back" onPress={onBack}><Text>Back</Text></Button>
          <Text className="text-xl font-semibold">Settings</Text>
        </View>
      }
      navSlot={
        <View testID="settings-navigation-rail" className="gap-1 p-2">
          {items.map(item => {
            const selected = item.href === currentHref;
            return (
              <Button key={item.href} testID={item.testID} variant={selected ? 'secondary' : 'ghost'}
                className="justify-start" accessibilityState={{ selected }} onPress={() => onNavigate(item.href)}>
                <Text>{item.label}</Text>
              </Button>
            );
          })}
        </View>
      }
      contentSlot={
        <ScrollView testID="settings-screen" className="flex-1"><View className="p-4">{children}</View></ScrollView>
      }
    />
  );
}
