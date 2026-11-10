import { useCallback, useState } from 'react';
import { Uniwind } from 'uniwind';

export type ThemeChoice =
  | 'system' | 'light' | 'dark'
  | 'ocean' | 'sunset' | 'monochrome' | 'paper' | 'warm' | 'bold' | 'market';
// Per-device appearance (v2 Settings > Theme), System by default.
export const THEME_SETTING_KEY = 'tallywoo.theme';
// v2's order (Settings > Theme). The seven after Dark are defined in themes.css and registered in metro.config.js.
export const THEME_CHOICES: readonly ThemeChoice[] = [
  'system', 'light', 'dark', 'ocean', 'sunset', 'monochrome', 'paper', 'warm', 'bold', 'market',
];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === 'string' && (THEME_CHOICES as readonly string[]).includes(value);
}

/** The saved choice; 'system' for nothing saved, an unknown value, or a storage that throws. */
export function readThemeChoice(): ThemeChoice {
  try {
    const choice = localStorage.getItem(THEME_SETTING_KEY);
    return isThemeChoice(choice) ? choice : 'system';
  } catch {
    return 'system';
  }
}

/** Applies the saved choice to Uniwind. Called once on app start. */
export function applyStoredTheme(): void {
  Uniwind.setTheme(readThemeChoice());
}

export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState(readThemeChoice);
  const update = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(THEME_SETTING_KEY, next);
    } catch {
      // The choice then lasts for this session only.
    }
    Uniwind.setTheme(next);
    setChoice(next);
  }, []);
  return [choice, update];
}
