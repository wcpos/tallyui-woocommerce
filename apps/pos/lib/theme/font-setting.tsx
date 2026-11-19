import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useUniwind } from 'uniwind';
import { FontProvider } from '@tallyui/components';
import { FONT_SETTINGS, TYPE_SETTING_AUTO } from '@tallyui/theme';
import type { ThemeFontFamily, TypeSetId } from '@tallyui/theme';
import { loadFontFamilies } from './font-faces';

export type FontChoice = (typeof FONT_SETTINGS)[number];
// Per-device type set (v2 Settings > Theme > Fonts), Match theme by default.
export const FONT_SETTING_KEY = 'tallywoo.fonts';

// v2 themes.ts THEME_RULES `typeSet`: what Match theme resolves to; every other theme is System.
const THEME_TYPE_SETS: Record<string, TypeSetId> = { paper: 'instrument', warm: 'fraunces', bold: 'grotesk', market: 'manrope' };
export function typeSetForTheme(theme: string): TypeSetId {
  return THEME_TYPE_SETS[theme] ?? 'system';
}

/** The saved choice; Match theme for nothing saved, a retired or unknown id, or a storage that throws (v2 theme.tsx:323). */
export function readFontChoice(): FontChoice {
  try {
    const saved = localStorage.getItem(FONT_SETTING_KEY);
    return FONT_SETTINGS.find(id => id === saved) ?? TYPE_SETTING_AUTO;
  } catch {
    return TYPE_SETTING_AUTO;
  }
}

type LoadFonts = (families: ThemeFontFamily[]) => Promise<void>;
interface FontSetting { choice: FontChoice; autoTypeSet: TypeSetId; setChoice: (choice: FontChoice) => void; loadFonts: LoadFonts }
const FontSettingContext = createContext<FontSetting>({
  choice: TYPE_SETTING_AUTO, autoTypeSet: 'system', setChoice: () => undefined, loadFonts: loadFontFamilies,
});

/** Holds this device's choice and feeds TallyUI's FontProvider, which loads only the chosen set's faces. */
export function FontSettingProvider({ loadFonts = loadFontFamilies, children }: { loadFonts?: LoadFonts; children: ReactNode }): JSX.Element {
  const { theme } = useUniwind();
  const [choice, setState] = useState(readFontChoice);
  const setChoice = useCallback((next: FontChoice) => {
    try {
      localStorage.setItem(FONT_SETTING_KEY, next);
    } catch {
      // The choice then lasts for this session only.
    }
    setState(next);
  }, []);
  const autoTypeSet = typeSetForTheme(theme);
  const value = useMemo(() => ({ choice, autoTypeSet, setChoice, loadFonts }), [choice, autoTypeSet, setChoice, loadFonts]);
  return (
    <FontSettingContext.Provider value={value}>
      <FontProvider font={choice} autoTypeSet={autoTypeSet} loadFonts={loadFonts}>{children}</FontProvider>
    </FontSettingContext.Provider>
  );
}

export function useFontSetting(): FontSetting {
  return useContext(FontSettingContext);
}
