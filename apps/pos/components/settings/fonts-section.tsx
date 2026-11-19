import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { FontProvider, RadioGroup, RadioGroupItem, Text } from '@tallyui/components';
import { FONT_FACES, FONT_SETTINGS, fontFamilyStyle, TYPE_SETS, TYPE_SETTING_AUTO } from '@tallyui/theme';
import type { ThemeFontFamily, ThemeType } from '@tallyui/theme';
import { useFontSetting } from '../../lib/theme/font-setting';
import type { FontChoice } from '../../lib/theme/font-setting';
import { SettingsSection } from './settings-form';

// v2's copy (core.json settings.fonts.*).
const FONT_LABELS: Record<FontChoice, string> = {
  auto: 'Match theme', system: 'System', instrument: 'DM Sans · Instrument Serif',
  grotesk: 'Space Grotesk', fraunces: 'DM Sans · Fraunces', manrope: 'Manrope',
};

/** v2's FontsSection (settings/theme.tsx:314-400): one row per type set with body, numbers and display specimens. */
export function FontsSection(): JSX.Element {
  const { choice, autoTypeSet, setChoice, loadFonts } = useFontSetting();
  // The specimens draw their faces only once every face is registered; a failed load leaves the system fallback.
  const [facesReady, setFacesReady] = useState(false);
  useEffect(() => {
    let stale = false;
    loadFonts(Object.keys(FONT_FACES) as ThemeFontFamily[]).then(
      () => { if (!stale) setFacesReady(true); },
      error => { if (!stale) console.warn('Failed to load font samples', error); },
    );
    return () => { stale = true; };
  }, [loadFonts]);
  return (
    <SettingsSection testID="settings-fonts" title="Fonts" description="The typeface the app's text uses on this device. Match theme follows the theme you chose.">
      <View testID="settings-fonts-status-row" className="min-h-11 py-1">
        <Text testID="settings-fonts-status" className="text-sm text-muted-foreground">{`Current fonts: ${FONT_LABELS[choice]}`}</Text>
      </View>
      <RadioGroup value={choice} onValueChange={value => setChoice(value as FontChoice)} aria-label="Fonts" className="gap-0 pt-2">
        {FONT_SETTINGS.map(id => {
          const set = id === TYPE_SETTING_AUTO ? autoTypeSet : id;
          const type: ThemeType = TYPE_SETS[set];
          return (
            <View key={id} className="min-h-11 flex-row items-center gap-2 py-2">
              <RadioGroupItem value={id} testID={`settings-fonts-${id}`} accessibilityLabel={FONT_LABELS[id]} />
              <Pressable className="flex-1" onPress={() => setChoice(id)}>
                <Text className="text-sm font-medium text-foreground">{FONT_LABELS[id]}</Text>
              </Pressable>
              <FontProvider font={facesReady ? set : 'system'}>
                <Pressable testID={`settings-fonts-${id}-samples`} className="ml-auto flex-row gap-3" onPress={() => setChoice(id)}>
                  <Text className="text-lg text-foreground">Aa</Text>
                  <Text className="text-lg text-foreground tabular-nums">12.50</Text>
                  <Text className={`text-lg font-semibold text-foreground${type.displayItalic ? ' italic' : ''}`}
                    style={fontFamilyStyle(facesReady ? type.display : undefined, Platform.OS === 'web')}>Total</Text>
                </Pressable>
              </FontProvider>
            </View>
          );
        })}
      </RadioGroup>
    </SettingsSection>
  );
}
