vi.mock('uniwind', () => ({ Uniwind: { setTheme: vi.fn() } }));
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useScale } from '@tallyui/components';
import { ThemeSettings } from '../components/settings/theme-settings';
import { readScaleChoice, ScaleSettingProvider, SCALE_SETTING_KEY } from '../lib/theme/scale-setting';
import { memoryStorage } from './memory-storage';

const STEPS = ['auto', 'compact', 'regular', 'spacious'];

function StepProbe() {
  return <span data-testid="scale-step">{useScale().step}</span>;
}

function renderTheme() {
  return render(<ScaleSettingProvider><ThemeSettings /><StepProbe /></ScaleSettingProvider>);
}

function checked(): string[] {
  return STEPS.filter(step => screen.getByTestId(`settings-scale-${step}`).getAttribute('aria-checked') === 'true');
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("the Scale section offers v2's four steps after the theme tiles, Auto selected by default", () => {
  renderTheme();
  const section = screen.getByTestId('settings-theme-scale');
  // After the Appearance section (v2 theme.tsx:531-532).
  expect(screen.getByTestId('settings-theme-appearance').nextElementSibling).toBe(section);
  expect(screen.getByTestId('settings-theme-scale-heading').textContent).toBe('Scale');
  expect(screen.getByText('Auto follows the window size.')).not.toBeNull();
  expect(screen.getByTestId('settings-scale-status').textContent).toBe('Current scale: Auto');
  expect(screen.getAllByTestId(/^settings-scale-(auto|compact|regular|spacious)$/).map(segment => segment.getAttribute('data-testid')))
    .toEqual(STEPS.map(step => `settings-scale-${step}`));
  expect(STEPS.map(step => screen.getByTestId(`settings-scale-${step}`).textContent)).toEqual(['Auto', 'Compact', 'Regular', 'Spacious']);
  expect(checked()).toEqual(['auto']);
});

test('choosing Spacious selects it, saves it and hands it to the ScaleProvider', () => {
  renderTheme();
  fireEvent.click(screen.getByTestId('settings-scale-spacious'));
  expect(checked()).toEqual(['spacious']);
  expect(screen.getByTestId('settings-scale-status').textContent).toBe('Current scale: Spacious');
  expect(SCALE_SETTING_KEY).toBe('tallywoo.scale');
  expect(localStorage.getItem('tallywoo.scale')).toBe('spacious');
  expect(screen.getByTestId('scale-step').textContent).toBe('spacious');
  // The web root mirror: Spacious is a 16 px base (SCALE_STEPS.spacious).
  expect(document.documentElement.style.getPropertyValue('--text-base')).toBe('16px');
});

test('a stored value that is not a step reads as Auto', () => {
  expect(readScaleChoice()).toBe('auto');
  localStorage.setItem('tallywoo.scale', 'huge');
  expect(readScaleChoice()).toBe('auto');
  renderTheme();
  expect(checked()).toEqual(['auto']);
  expect(screen.getByTestId('settings-scale-status').textContent).toBe('Current scale: Auto');
  cleanup();
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Storage unavailable'); } });
  expect(readScaleChoice()).toBe('auto');
});

test('a remount reads the stored step back', () => {
  // Spacious: in jsdom the window is narrow, so Auto itself resolves to Compact.
  renderTheme();
  fireEvent.click(screen.getByTestId('settings-scale-spacious'));
  expect(screen.getByTestId('scale-step').textContent).toBe('spacious');
  cleanup();
  renderTheme();
  expect(checked()).toEqual(['spacious']);
  expect(screen.getByTestId('settings-scale-status').textContent).toBe('Current scale: Spacious');
  expect(screen.getByTestId('scale-step').textContent).toBe('spacious');
});
