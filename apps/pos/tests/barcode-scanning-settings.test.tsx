import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { BarcodeScanningSettings } from '../components/settings/barcode-scanning-settings';
import { readScanSettings, SCAN_SETTINGS_KEY, writeScanSettings } from '../lib/scan/scan-settings';
import { readScanSoundSettings, SCAN_SOUND_KEY, writeScanSoundSettings } from '../lib/scan/scan-sound';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { installFakeAudio, tones } from './fake-audio-context';

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

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function burst(keys: string, gapMs: number) {
  act(() => {
    for (const key of [...keys, 'Enter']) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      vi.advanceTimersByTime(gapMs);
    }
  });
}

function value(testID: string): string {
  return (screen.getByTestId(testID) as HTMLInputElement).value;
}

test('stored settings fall back to the v2 defaults field by field', () => {
  expect(readScanSettings()).toEqual({ threshold: 24, minChars: 8, prefix: '', suffix: '' });
  localStorage.setItem(SCAN_SETTINGS_KEY, JSON.stringify({ threshold: -1, minChars: 4, prefix: 5, suffix: '#' }));
  expect(readScanSettings()).toEqual({ threshold: 24, minChars: 4, prefix: '', suffix: '#' });
  localStorage.setItem(SCAN_SETTINGS_KEY, 'not json');
  expect(readScanSettings()).toEqual({ threshold: 24, minChars: 8, prefix: '', suffix: '' });
});

test('the page shows the four Scanning rows with the v2 defaults', () => {
  render(<BarcodeScanningSettings />);
  expect(screen.getByTestId('screen-settings-barcode-scanning')).not.toBeNull();
  for (const text of [
    'Scanning', 'Barcode Average Time Input Threshold (ms)', 'Barcode Minimum Length',
    'Barcode Scanner Prefix', 'Barcode Scanner Suffix', 'Barcode Scanning Test',
  ]) expect(screen.getByText(text)).not.toBeNull();
  expect(value('settings-barcode-threshold')).toBe('24');
  expect(value('settings-barcode-min-chars')).toBe('8');
  expect(value('settings-barcode-prefix')).toBe('');
  expect(value('settings-barcode-suffix')).toBe('');
});

test('each change saves for this device at once, and a non-number is not saved', () => {
  render(<BarcodeScanningSettings />);
  fireEvent.change(screen.getByTestId('settings-barcode-threshold'), { target: { value: '40' } });
  fireEvent.change(screen.getByTestId('settings-barcode-min-chars'), { target: { value: '4' } });
  fireEvent.change(screen.getByTestId('settings-barcode-prefix'), { target: { value: ']C1' } });
  fireEvent.change(screen.getByTestId('settings-barcode-suffix'), { target: { value: '#' } });
  expect(JSON.parse(localStorage.getItem(SCAN_SETTINGS_KEY)!)).toEqual({ threshold: 40, minChars: 4, prefix: ']C1', suffix: '#' });
  fireEvent.change(screen.getByTestId('settings-barcode-threshold'), { target: { value: '4x' } });
  expect(readScanSettings().threshold).toBe(40);
  expect(value('settings-barcode-threshold')).toBe('4x');
});

test('the page reopens with the saved values', () => {
  writeScanSettings({ threshold: 50, prefix: 'X' });
  render(<BarcodeScanningSettings />);
  expect(value('settings-barcode-threshold')).toBe('50');
  expect(value('settings-barcode-prefix')).toBe('X');
  expect(value('settings-barcode-min-chars')).toBe('8');
});

test('the test panel shows a passing scan, then a too-short code', () => {
  vi.useFakeTimers();
  render(<BarcodeScanningSettings />);
  expect(screen.getByTestId('barcode-test-verdict').textContent).toBe('Scan into this page to see keystroke timing');
  expect(screen.queryByTestId('barcode-test-result')).toBeNull();
  burst('2000000000015', 5);
  expect(screen.getByTestId('barcode-test-keys').textContent).toBe('2000000000015');
  expect(screen.getByTestId('barcode-test-detected').textContent).toBe('2000000000015');
  expect(screen.getByTestId('barcode-test-result').textContent).toBe('scan');
  expect(screen.getByTestId('barcode-test-verdict').textContent).toBe('Detected as a scan → 2000000000015');
  burst('123', 5);
  expect(screen.getByTestId('barcode-test-result').textContent).toBe('too short');
  expect(screen.getByTestId('barcode-test-detected').textContent).toBe('—');
  expect(screen.getByTestId('barcode-test-verdict').textContent).toBe('Lower minimum length to 3 — this code is 3 characters');
});

test('the test panel shows typing, and a saved prefix applies to the next scan', () => {
  vi.useFakeTimers();
  render(<BarcodeScanningSettings />);
  burst('abc', 100);
  expect(screen.getByTestId('barcode-test-result').textContent).toBe('typing');
  expect(screen.getByTestId('barcode-test-verdict').textContent).toBe('Treated as typing (average gap 100ms) — correctly ignored');
  fireEvent.change(screen.getByTestId('settings-barcode-prefix'), { target: { value: ']C1' } });
  burst(']C12000000000015', 5);
  expect(screen.getByTestId('barcode-test-keys').textContent).toBe(']C12000000000015');
  expect(screen.getByTestId('barcode-test-detected').textContent).toBe('2000000000015');
  expect(screen.getByTestId('barcode-test-result').textContent).toBe('scan');
});

test('a test scan never reaches the till underneath', () => {
  vi.useFakeTimers();
  const till = vi.fn();
  renderHook(() => useWedgeScanner(till, true));
  render(<BarcodeScanningSettings />);
  burst('2000000000015', 5);
  expect(screen.getByTestId('barcode-test-result').textContent).toBe('scan');
  expect(till).not.toHaveBeenCalled();
});

test('Sound sits between Scanning and the Test, off by default with no options', () => {
  render(<BarcodeScanningSettings />);
  const titles = ['Scanning', 'Sound', 'Barcode Scanning Test'].map(title => screen.getByText(title));
  expect(titles[0].compareDocumentPosition(titles[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(titles[1].compareDocumentPosition(titles[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByTestId('settings-barcode-sound-group')).not.toBeNull();
  expect(screen.getByText('Play a sound on scan')).not.toBeNull();
  expect(screen.getByTestId('settings-barcode-sound').getAttribute('aria-checked')).toBe('false');
  expect(screen.queryByTestId('scan-sound-options')).toBeNull();
});

test('turning Sound on shows the themes, volume and switches, and a theme saves for this device', () => {
  render(<BarcodeScanningSettings />);
  fireEvent.click(screen.getByTestId('settings-barcode-sound'));
  expect(screen.getByTestId('scan-sound-options')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(SCAN_SOUND_KEY)!).enabled).toBe(true);
  for (const text of [
    'Sound theme', 'Classic', 'Bright rising blip / low buzz', 'Checkout', 'Supermarket-style flat beep / double low tone',
    'Soft', 'Gentle chime / muted knock — for quiet shops', 'Volume', 'Success sound', 'Failure sound',
  ]) expect(screen.getByText(text)).not.toBeNull();
  for (const theme of ['classic', 'checkout', 'soft']) {
    expect(screen.getByTestId(`sound-preview-success-${theme}`).getAttribute('aria-label')).toBe('Preview success sound');
    expect(screen.getByTestId(`sound-preview-failure-${theme}`).getAttribute('aria-label')).toBe('Preview failure sound');
  }
  expect(screen.getByTestId('settings-barcode-sound-volume')).not.toBeNull();
  expect(screen.getByTestId('sound-preview-volume')).not.toBeNull();
  expect(screen.getByTestId('sound-theme-classic').getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('settings-barcode-sound-success').getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('settings-barcode-sound-failure').getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByTestId('sound-theme-soft'));
  expect(screen.getByTestId('sound-theme-soft').getAttribute('aria-checked')).toBe('true');
  expect(readScanSoundSettings()).toEqual({ enabled: true, theme: 'soft', volume: 0.15, success: true, failure: true });
});

test('a preview plays its row theme even with that kind switched off', () => {
  installFakeAudio();
  writeScanSoundSettings({ enabled: true, success: false, failure: false });
  render(<BarcodeScanningSettings />);
  fireEvent.click(screen.getByTestId('sound-preview-success-soft'));
  expect(tones()).toEqual(['sine 660', 'sine 990']);
  installFakeAudio();
  fireEvent.click(screen.getByTestId('sound-preview-failure-checkout'));
  expect(tones()).toEqual(['square 240', 'square 240']);
});
