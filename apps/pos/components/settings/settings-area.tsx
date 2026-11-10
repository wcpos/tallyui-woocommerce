import type { JSX, ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, SettingsLayout, Text } from '@tallyui/components';

export interface SettingsNavItem { href: string; label: string; testID: string }

/** v2 `NavItem` (row size): selection lifts the row onto `bg-card`, the page card's own surface; no button look. */
function NavRow({ item, selected, onPress }: { item: SettingsNavItem; selected: boolean; onPress(): void }): JSX.Element {
  return (
    <Pressable testID={item.testID} accessibilityRole="button" accessibilityState={{ selected }}
      // react-native-web reads aria-selected, not accessibilityState (as app-rail.tsx).
      aria-selected={selected} onPress={onPress}
      className={`h-10 flex-row items-center rounded-md px-3 ${selected ? 'bg-card' : 'web:hover:bg-card/60'}`}>
      <Text className={`text-sm ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</Text>
    </Pressable>
  );
}

export function SettingsArea({ items, currentHref, onNavigate, onBack, wide, children }: {
  items: SettingsNavItem[];
  currentHref: string;
  onNavigate(href: string): void;
  onBack(): void;
  /** `useIsWide()`: the app rail is beside Settings, so Settings draws no bar of its own (v2 `NavigationAreaLayout`). */
  wide: boolean;
  children: ReactNode;
}): JSX.Element {
  const title = items.find(item => item.href === currentHref)?.label;
  const navRows = items.map(item => (
    <NavRow key={item.href} item={item} selected={item.href === currentHref} onPress={() => onNavigate(item.href)} />
  ));
  // v2 `AreaPage` (scroll): one card centred at 896, its heading, a rule (`border-t`: no hairline class here), the body.
  const page = (
    <ScrollView testID="settings-screen" className="flex-1">
      <View className="mx-auto w-full max-w-4xl p-3">
        <View testID="settings-page" className="rounded-lg border border-border bg-card overflow-hidden">
          {title !== undefined && (
            <View className="gap-0.5 px-4 pt-4 pb-3">
              <Text testID="settings-page-title" role="heading" aria-level={1} className="text-xl font-semibold">{title}</Text>
            </View>
          )}
          <View testID="settings-page-body" className="border-t border-border p-4">{children}</View>
        </View>
      </View>
    </ScrollView>
  );
  if (wide) {
    return (
      <View testID="settings-navigation" className="flex-1 flex-row bg-background">
        <View testID="settings-navigation-rail" className="w-56 shrink-0 gap-0.5 border-r border-border/50 bg-background p-3">
          {navRows}
        </View>
        {page}
      </View>
    );
  }
  return (
    <SettingsLayout
      testID="settings-navigation"
      layout="stacked"
      headerSlot={
        <View className="flex-row items-center gap-4 p-4">
          <Button testID="settings-back" onPress={onBack}><Text>Back</Text></Button>
          <Text className="text-xl font-semibold">Settings</Text>
        </View>
      }
      navSlot={<View testID="settings-navigation-rail" className="gap-1 p-2">{navRows}</View>}
      contentSlot={page}
    />
  );
}
