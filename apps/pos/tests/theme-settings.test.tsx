vi.mock('uniwind', () => ({ Uniwind: { setTheme: vi.fn() } }));
import { Uniwind } from 'uniwind';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { ThemeSettings, themeColumns } from '../components/settings/theme-settings';
import { applyStoredTheme, isThemeChoice, readThemeChoice, THEME_CHOICES, THEME_SETTING_KEY } from '../lib/theme/theme-setting';

let storage: Storage;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => Array.from(data.keys())[index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

test('readThemeChoice falls back to System for nothing saved, an unknown value or a storage that throws', () => {
  expect(THEME_SETTING_KEY).toBe('tallywoo.theme');
  expect(readThemeChoice()).toBe('system');
  localStorage.setItem('tallywoo.theme', 'dark');
  expect(readThemeChoice()).toBe('dark');
  localStorage.setItem('tallywoo.theme', 'neon');
  expect(readThemeChoice()).toBe('system');
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Storage unavailable'); } });
  expect(readThemeChoice()).toBe('system');
  expect(isThemeChoice('light')).toBe(true);
  expect(isThemeChoice('ocean')).toBe(true);
  expect(isThemeChoice('neon')).toBe(false);
  expect(isThemeChoice(undefined)).toBe(false);
  expect(THEME_CHOICES).toEqual(['system', 'light', 'dark', 'ocean', 'sunset', 'monochrome', 'paper', 'warm', 'bold', 'market']);
});

test('applyStoredTheme applies the saved choice, and System when none is saved', () => {
  applyStoredTheme();
  expect(Uniwind.setTheme).toHaveBeenCalledExactlyOnceWith('system');
  localStorage.setItem('tallywoo.theme', 'dark');
  applyStoredTheme();
  expect(Uniwind.setTheme).toHaveBeenLastCalledWith('dark');
  localStorage.setItem('tallywoo.theme', 'neon');
  applyStoredTheme();
  expect(Uniwind.setTheme).toHaveBeenLastCalledWith('system');
  localStorage.setItem('tallywoo.theme', 'market');
  applyStoredTheme();
  expect(Uniwind.setTheme).toHaveBeenLastCalledWith('market');
});

test('the Theme page offers the ten v2 themes in order with the v2 copy, System selected by default', () => {
  render(<ThemeSettings />);
  expect(screen.getByTestId('screen-settings-theme')).not.toBeNull();
  expect(screen.getByText('Theme')).not.toBeNull();
  expect(screen.getByText('Appearance')).not.toBeNull();
  expect(screen.getByText('Choose a theme for the app. Custom themes provide different color schemes.')).not.toBeNull();
  expect(screen.getByTestId('settings-theme-status').textContent).toBe('Following system theme');
  expect(screen.getAllByTestId(/^theme-option-/)).toHaveLength(10);
  const options = [
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
  expect(screen.getAllByTestId(/^theme-option-/).map(tile => tile.getAttribute('data-testid')))
    .toEqual(options.map(option => `theme-option-${option.name}`));
  for (const option of options) {
    const tile = screen.getByTestId(`theme-option-${option.name}`);
    expect(within(tile).getByText(option.label)).not.toBeNull();
    expect(within(tile).getByText(option.description)).not.toBeNull();
    expect(tile.getAttribute('aria-selected')).toBe(option.name === 'system' ? 'true' : 'false');
  }
  expect(Uniwind.setTheme).not.toHaveBeenCalled();
});

test('the saved choice is selected and named in the status line', () => {
  localStorage.setItem('tallywoo.theme', 'dark');
  render(<ThemeSettings />);
  expect(screen.getByTestId('theme-option-dark').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('theme-option-system').getAttribute('aria-selected')).toBe('false');
  expect(screen.getByTestId('theme-option-light').getAttribute('aria-selected')).toBe('false');
  expect(screen.getByTestId('settings-theme-status').textContent).toBe('Current theme: Dark');
});

test('pressing a tile saves the choice before applying it', () => {
  const setItem = vi.spyOn(storage, 'setItem');
  render(<ThemeSettings />);
  fireEvent.click(screen.getByTestId('theme-option-light'));
  expect(localStorage.getItem('tallywoo.theme')).toBe('light');
  expect(Uniwind.setTheme).toHaveBeenCalledExactlyOnceWith('light');
  expect(setItem.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(Uniwind.setTheme).mock.invocationCallOrder[0]);
  expect(screen.getByTestId('theme-option-light').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('settings-theme-status').textContent).toBe('Current theme: Light');
});

test('choosing System again follows the device', () => {
  localStorage.setItem('tallywoo.theme', 'dark');
  render(<ThemeSettings />);
  fireEvent.click(screen.getByTestId('theme-option-system'));
  expect(localStorage.getItem('tallywoo.theme')).toBe('system');
  expect(Uniwind.setTheme).toHaveBeenCalledWith('system');
  expect(screen.getByTestId('settings-theme-status').textContent).toBe('Following system theme');
});

test('a storage that refuses the write still applies the theme for this session', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => { throw new Error('Storage is read-only'); },
  });
  render(<ThemeSettings />);
  expect(() => fireEvent.click(screen.getByTestId('theme-option-dark'))).not.toThrow();
  expect(Uniwind.setTheme).toHaveBeenCalledWith('dark');
  expect(screen.getByTestId('theme-option-dark').getAttribute('aria-selected')).toBe('true');
});

test('themeColumns follows v2: tiles at least 128px wide with an 8px gap, two to five columns', () => {
  const table: [number, number][] = [[0, 2], [358, 2], [399, 2], [400, 3], [422, 3], [535, 3], [536, 4], [674, 5], [1400, 5]];
  for (const [width, columns] of table) expect(themeColumns(width), `width ${width}`).toBe(columns);
});

test('a narrow window lays the ten tiles out in rows of three and pads the last row', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 422, height: 800, scale: 1, fontScale: 1 });
  render(<ThemeSettings />);
  const rows = within(screen.getByTestId('settings-theme-options')).getAllByTestId('settings-theme-row');
  expect(rows.map(row => within(row).queryAllByTestId(/^theme-option-/).length)).toEqual([3, 3, 3, 1]);
  expect(within(rows[3]).getAllByTestId('settings-theme-spacer')).toHaveLength(2);
  expect(within(rows[3]).getByTestId('theme-option-market')).not.toBeNull();
});

test('a wide window lays the ten tiles out in two rows of five', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1400, height: 900, scale: 1, fontScale: 1 });
  render(<ThemeSettings />);
  const rows = screen.getAllByTestId('settings-theme-row');
  expect(rows.map(row => within(row).queryAllByTestId(/^theme-option-/).length)).toEqual([5, 5]);
  expect(screen.queryAllByTestId('settings-theme-spacer')).toHaveLength(0);
});

test('choosing Paper till saves and applies paper and names it in the status line', () => {
  render(<ThemeSettings />);
  fireEvent.click(screen.getByTestId('theme-option-paper'));
  expect(localStorage.getItem('tallywoo.theme')).toBe('paper');
  expect(Uniwind.setTheme).toHaveBeenCalledExactlyOnceWith('paper');
  expect(screen.getByTestId('theme-option-paper').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('theme-option-system').getAttribute('aria-selected')).toBe('false');
  expect(screen.getByTestId('settings-theme-status').textContent).toBe('Current theme: Paper till');
});
