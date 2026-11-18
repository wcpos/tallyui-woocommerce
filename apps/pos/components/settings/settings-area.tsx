import type { JSX, ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, SettingsLayout, Text } from '@tallyui/components';
import { ChevronRightIcon } from '../icons';

export interface SettingsNavItem { href: string; label: string; testID: string;
  /** The page's help line under its title (v2 `AreaPage` `description`). */
  description?: string;
}

/** v2 `NavItem` (row size): selection lifts the row onto `bg-card`, the page card's own surface; no button look.
 *  `chevron`: the phone index's trailing mark (v2 nav-item/index.tsx:96). */
function NavRow({ item, selected, onPress, chevron = false }: { item: SettingsNavItem; selected: boolean; onPress(): void; chevron?: boolean }): JSX.Element {
  return (
    <Pressable testID={item.testID} accessibilityRole="button" accessibilityState={{ selected }}
      // react-native-web reads aria-selected, not accessibilityState (as app-rail.tsx).
      aria-selected={selected} onPress={onPress}
      className={`h-10 flex-row items-center rounded-md px-3 ${selected ? 'bg-card' : 'web:hover:bg-card/60'}`}>
      <Text className={`flex-1 text-sm ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</Text>
      {chevron && <ChevronRightIcon testID={`${item.testID}-chevron`} size={16} className="text-muted-foreground" />}
    </Pressable>
  );
}

/** v2 `NavigationAreaLayout`: Settings and Store health; `title` and `testIDPrefix` default to Settings'. */
export function SettingsArea({ items, currentHref, onNavigate, onBack, wide, title: areaTitle = 'Settings',
  testIDPrefix: id = 'settings', children }: {
  items: SettingsNavItem[];
  /** The phone bar's area title. */
  title?: string;
  /** Prefixes the area's test ids (`<prefix>-screen`, `<prefix>-back`, …). */
  testIDPrefix?: string;
  currentHref: string;
  onNavigate(href: string): void;
  onBack(): void;
  /** `useIsWide()`: the app rail is beside Settings, so Settings draws no bar of its own (v2 `NavigationAreaLayout`). */
  wide: boolean;
  children: ReactNode;
}): JSX.Element {
  const title = items.find(item => item.href === currentHref)?.label;
  const description = items.find(item => item.href === currentHref)?.description;
  const navRows = items.map(item => (
    <NavRow key={item.href} item={item} selected={item.href === currentHref} onPress={() => onNavigate(item.href)} />
  ));
  // v2 `AreaPage` (scroll): one card centred at 896, its heading, a rule (`border-t`: no hairline class here), the body.
  const page = (
    <ScrollView testID={`${id}-screen`} className="flex-1">
      <View className="mx-auto w-full max-w-4xl p-3">
        <View testID={`${id}-page`} className="rounded-lg border border-border bg-card overflow-hidden">
          {title !== undefined && (
            <View className="gap-0.5 px-4 pt-4 pb-3">
              <Text testID={`${id}-page-title`} role="heading" aria-level={1} className="text-xl font-semibold">{title}</Text>
              {!!description && <Text testID={`${id}-page-description`} className="text-xs text-muted-foreground">{description}</Text>}
            </View>
          )}
          <View testID={`${id}-page-body`} className="border-t border-border p-4">{children}</View>
        </View>
      </View>
    </ScrollView>
  );
  if (wide) {
    return (
      <View testID={`${id}-navigation`} className="flex-1 flex-row bg-background">
        <View testID={`${id}-navigation-rail`} className="w-56 shrink-0 gap-0.5 border-r border-border/50 bg-background p-3">
          {navRows}
        </View>
        {page}
      </View>
    );
  }
  const header = (
    <View className="flex-row items-center gap-4 p-4">
      <Button testID={`${id}-back`} onPress={onBack}><Text>Back</Text></Button>
      <Text className="text-xl font-semibold">{areaTitle}</Text>
    </View>
  );
  // v2 `NavigationAreaIndex` (navigation-area/index.tsx:146-151): on a phone the area opens on its page list, rows with a chevron, no page.
  if (title === undefined) {
    return (
      <View testID={`${id}-navigation`} className="flex-1 bg-background">
        {header}
        <ScrollView testID={`screen-${id}`} className="flex-1 bg-background">
          <View testID={`${id}-navigation-rail`} className="gap-1 p-3">
            {items.map(item => <NavRow key={item.href} item={item} selected={false} chevron onPress={() => onNavigate(item.href)} />)}
          </View>
          {/* The index route (null on a phone): its Slot stays mounted, or expo-router loops (React #185) entering the index. */}
          {children}
        </ScrollView>
      </View>
    );
  }
  return (
    <SettingsLayout
      testID={`${id}-navigation`}
      layout="stacked"
      headerSlot={header}
      navSlot={<View testID={`${id}-navigation-rail`} className="gap-1 p-2">{navRows}</View>}
      contentSlot={page}
    />
  );
}
