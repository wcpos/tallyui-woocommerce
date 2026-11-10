vi.mock('uniwind', () => ({ Uniwind: { setTheme: vi.fn() } }));
import { Uniwind } from 'uniwind';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ThemeSettings } from '../components/settings/theme-settings';
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
  localStorage.setItem('tallywoo.theme', 'ocean');
  expect(readThemeChoice()).toBe('system');
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Storage unavailable'); } });
  expect(readThemeChoice()).toBe('system');
  expect(isThemeChoice('light')).toBe(true);
  expect(isThemeChoice('ocean')).toBe(false);
  expect(THEME_CHOICES).toEqual(['system', 'light', 'dark']);
});

test('applyStoredTheme applies the saved choice, and System when none is saved', () => {
  applyStoredTheme();
  expect(Uniwind.setTheme).toHaveBeenCalledExactlyOnceWith('system');
  localStorage.setItem('tallywoo.theme', 'dark');
  applyStoredTheme();
  expect(Uniwind.setTheme).toHaveBeenLastCalledWith('dark');
  localStorage.setItem('tallywoo.theme', 'ocean');
  applyStoredTheme();
  expect(Uniwind.setTheme).toHaveBeenLastCalledWith('system');
});

test('the Theme page offers System, Light and Dark with the v2 copy, System selected by default', () => {
  render(<ThemeSettings />);
  expect(screen.getByTestId('screen-settings-theme')).not.toBeNull();
  expect(screen.getByText('Theme')).not.toBeNull();
  expect(screen.getByText('Appearance')).not.toBeNull();
  expect(screen.getByText('Choose a theme for the app.')).not.toBeNull();
  expect(screen.getByTestId('settings-theme-status').textContent).toBe('Following system theme');
  expect(screen.getAllByTestId(/^theme-option-/)).toHaveLength(3);
  const options = [
    { name: 'system', label: 'System', description: 'Follow your device settings' },
    { name: 'light', label: 'Light', description: 'Clean and bright' },
    { name: 'dark', label: 'Dark', description: 'Easy on the eyes' },
  ];
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
