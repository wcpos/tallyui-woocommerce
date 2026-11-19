const uniwind = vi.hoisted(() => ({ theme: 'light' }));
vi.mock('uniwind', () => ({ Uniwind: { setTheme: vi.fn() }, useUniwind: () => ({ theme: uniwind.theme }) }));
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { JSX } from 'react';
import { useFontType } from '@tallyui/components';
import type { ThemeFontFamily } from '@tallyui/theme';
import { ThemeSettings } from '../components/settings/theme-settings';
import { FONT_SETTING_KEY, FontSettingProvider, readFontChoice } from '../lib/theme/font-setting';
import { memoryStorage } from './memory-storage';

const IDS = ['auto', 'system', 'instrument', 'grotesk', 'fraunces', 'manrope'];

function RootProbe(): JSX.Element {
  const { setId, status } = useFontType();
  return <span data-testid="root-font">{`${setId}:${status}`}</span>;
}

function renderPage(loadFonts: (families: ThemeFontFamily[]) => Promise<void> = vi.fn(async () => undefined)) {
  return render(<FontSettingProvider loadFonts={loadFonts}><ThemeSettings /><RootProbe /></FontSettingProvider>);
}

const sample = (id: string, text: string) => within(screen.getByTestId(`settings-fonts-${id}-samples`)).getByText(text);

beforeEach(() => {
  uniwind.theme = 'light';
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('the Fonts section lists Match theme plus the five sets in v2\'s order and copy, Match theme selected by default', () => {
  renderPage();
  const section = screen.getByTestId('settings-fonts');
  expect(within(section).getByRole('heading').textContent).toBe('Fonts');
  expect(screen.getByTestId('settings-fonts-description').textContent)
    .toBe('The typeface the app\'s text uses on this device. Match theme follows the theme you chose.');
  expect(screen.getByTestId('settings-fonts-status').textContent).toBe('Current fonts: Match theme');
  expect(within(section).getAllByRole('radio').map(radio => radio.getAttribute('data-testid'))).toEqual(IDS.map(id => `settings-fonts-${id}`));
  const labels = ['Match theme', 'System', 'DM Sans · Instrument Serif', 'Space Grotesk', 'DM Sans · Fraunces', 'Manrope'];
  IDS.forEach((id, index) => {
    expect(screen.getByTestId(`settings-fonts-${id}`).getAttribute('aria-label')).toBe(labels[index]);
    expect(screen.getByTestId(`settings-fonts-${id}`).getAttribute('aria-checked')).toBe(id === 'auto' ? 'true' : 'false');
    expect(within(screen.getByTestId(`settings-fonts-${id}-samples`)).getByText('Total')).not.toBeNull();
  });
  expect(screen.getByTestId('root-font').textContent).toBe('system:loaded');
  // It follows Appearance, the last section of the page.
  expect(screen.getByTestId('screen-settings-theme').lastElementChild).toBe(section);
});

test('choosing Manrope persists it per device and the root provider receives it', async () => {
  const loadFonts = vi.fn(async () => undefined);
  renderPage(loadFonts);
  await act(async () => { fireEvent.click(screen.getByTestId('settings-fonts-manrope')); });
  expect(localStorage.getItem(FONT_SETTING_KEY)).toBe('manrope');
  expect(FONT_SETTING_KEY).toBe('tallywoo.fonts');
  expect(screen.getByTestId('settings-fonts-manrope').getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('settings-fonts-status').textContent).toBe('Current fonts: Manrope');
  expect(loadFonts).toHaveBeenCalledWith(['Manrope']);
  expect(screen.getByTestId('root-font').textContent).toBe('manrope:loaded');
  cleanup();
  renderPage(loadFonts);
  expect(screen.getByTestId('settings-fonts-manrope').getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('root-font').textContent).toMatch(/^manrope:/);
});

test('a stored retired id, nothing stored, or a throwing storage reads as Match theme', () => {
  expect(readFontChoice()).toBe('auto');
  localStorage.setItem('tallywoo.fonts', 'fraunces');
  expect(readFontChoice()).toBe('fraunces');
  localStorage.setItem('tallywoo.fonts', 'mono');
  expect(readFontChoice()).toBe('auto');
  renderPage();
  expect(screen.getByTestId('settings-fonts-auto').getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('root-font').textContent).toBe('system:loaded');
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Storage unavailable'); } });
  expect(readFontChoice()).toBe('auto');
});

test('the specimens draw the system fallback until the faces resolve, then their own faces', async () => {
  let resolve: () => void = () => undefined;
  const loadFonts = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  renderPage(loadFonts);
  expect(loadFonts).toHaveBeenCalledWith(['DM Sans', 'Instrument Serif', 'JetBrains Mono', 'Space Grotesk', 'Fraunces', 'Manrope']);
  for (const text of ['Aa', '12.50', 'Total']) expect(getComputedStyle(sample('manrope', text)).fontFamily).not.toContain('Manrope');
  expect(getComputedStyle(sample('fraunces', 'Total')).fontFamily).not.toContain('Fraunces');
  await act(async () => { resolve(); });
  for (const text of ['Aa', '12.50', 'Total']) expect(getComputedStyle(sample('manrope', text)).fontFamily).toContain('"Manrope"');
  expect(getComputedStyle(sample('fraunces', 'Total')).fontFamily).toContain('"Fraunces"');
  expect(getComputedStyle(sample('instrument', '12.50')).fontFamily).toContain('"JetBrains Mono"');
  expect(getComputedStyle(sample('system', 'Aa')).fontFamily).not.toMatch(/Manrope|DM Sans|Fraunces/);
});

test('Match theme follows the theme: Market draws Manrope in the Auto row and at the root', async () => {
  uniwind.theme = 'market';
  renderPage();
  await act(async () => undefined);
  expect(screen.getByTestId('root-font').textContent).toBe('manrope:loaded');
  expect(getComputedStyle(sample('auto', 'Total')).fontFamily).toContain('"Manrope"');
  cleanup();
  uniwind.theme = 'dark';
  renderPage();
  await act(async () => undefined);
  expect(screen.getByTestId('root-font').textContent).toBe('system:loaded');
});
