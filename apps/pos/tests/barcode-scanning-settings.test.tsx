import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { BarcodeScanningSettings } from '../components/settings/barcode-scanning-settings';
import { readScanSettings, SCAN_SETTINGS_KEY, writeScanSettings } from '../lib/scan/scan-settings';
import { readScanSoundSettings, SCAN_SOUND_KEY, writeScanSoundSettings } from '../lib/scan/scan-sound';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { installFakeAudio, tones } from './fake-audio-context';
import { memoryStorage } from './memory-storage';
import { classesOf } from './classes-of';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

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

test('a scan shows the check, then the average gap under the current threshold', () => {
  vi.useFakeTimers();
  render(<BarcodeScanningSettings />);
  fireEvent.change(screen.getByTestId('settings-barcode-threshold'), { target: { value: '40' } });
  burst('2000000000015', 7);
  expect(screen.getByTestId('barcode-test-verdict').textContent).toBe('Detected as a scan → 2000000000015');
  expect(classesOf('barcode-test-verdict')).toEqual(expect.arrayContaining(['text-base', 'font-medium']));
  expect(screen.getByTestId('barcode-test-scan-check')).not.toBeNull();
  expect(screen.getByTestId('barcode-test-scan-detail').textContent).toBe('Average keystroke gap 7ms, under the 40ms threshold');
  expect(classesOf('barcode-test-scan-detail')).toEqual(expect.arrayContaining(['text-muted-foreground', 'text-xs']));
  // Gaps of 7ms, then a last one of 8ms, fold to 7.5ms: shown rounded, as v2's Math.round.
  act(() => {
    for (const key of '2000000000015') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      vi.advanceTimersByTime(7);
    }
    vi.advanceTimersByTime(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '9', bubbles: true, cancelable: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  });
  expect(screen.getByTestId('barcode-test-scan-detail').textContent).toBe('Average keystroke gap 8ms, under the 40ms threshold');
});

test('typing and too short show no scan detail', () => {
  vi.useFakeTimers();
  render(<BarcodeScanningSettings />);
  expect(screen.queryByTestId('barcode-test-scan-detail')).toBeNull();
  burst('abc', 100);
  expect(screen.getByTestId('barcode-test-result').textContent).toBe('typing');
  expect(screen.queryByTestId('barcode-test-scan-detail')).toBeNull();
  expect(screen.queryByTestId('barcode-test-scan-check')).toBeNull();
  burst('123', 5);
  expect(screen.getByTestId('barcode-test-result').textContent).toBe('too short');
  expect(screen.queryByTestId('barcode-test-scan-detail')).toBeNull();
  expect(screen.queryByTestId('barcode-test-scan-check')).toBeNull();
});

// One burst whose key gaps fold to a fraction: `gapMs` between the keys, `lastGapMs` before the last one.
function unevenBurst(keys: string, gapMs: number, lastGapMs: number) {
  act(() => {
    [...keys].forEach((key, i) => {
      if (i > 0) vi.advanceTimersByTime(i === keys.length - 1 ? lastGapMs : gapMs);
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  });
}

function historyRow(index: number): string | null {
  return screen.queryByTestId(`barcode-test-history-row-${index}`)?.textContent ?? null;
}

test('no Recent attempts before the first attempt', () => {
  vi.useFakeTimers();
  render(<BarcodeScanningSettings />);
  expect(screen.queryByTestId('barcode-test-history')).toBeNull();
  expect(screen.queryByText('Recent attempts')).toBeNull();
  burst('2000000000015', 5);
  expect(screen.getByTestId('barcode-test-history').textContent).toContain('Recent attempts');
  expect(historyRow(0)).toBe('2000000000015scan5ms');
});

test('Recent attempts lists each attempt newest first with its badge and gap', () => {
  vi.useFakeTimers();
  render(<BarcodeScanningSettings />);
  // Gaps of 7ms, then 8ms, fold to 7.5ms: shown rounded, as v2's Math.round.
  unevenBurst('2000000000015', 7, 8);
  burst('123', 5);
  burst('abc', 100);
  expect(historyRow(0)).toBe('abctyping100ms');
  expect(historyRow(1)).toBe('123too short5ms');
  expect(historyRow(2)).toBe('2000000000015scan8ms');
  expect(historyRow(3)).toBeNull();
  expect(classesOf('barcode-test-history-row-0')).toEqual(expect.arrayContaining(['flex-row', 'p-3']));
});

test('an attempt with no gap shows a dash for its gap', () => {
  vi.useFakeTimers();
  render(<BarcodeScanningSettings />);
  burst('a', 5);
  expect(historyRow(0)).toBe('atyping—');
});

test('a sixth attempt drops the oldest', () => {
  vi.useFakeTimers();
  render(<BarcodeScanningSettings />);
  for (const key of ['a', 'b', 'c', 'd', 'e']) burst(key, 5);
  expect(historyRow(4)).toBe('atyping—');
  burst('f', 5);
  expect([0, 1, 2, 3, 4].map(historyRow)).toEqual(['ftyping—', 'etyping—', 'dtyping—', 'ctyping—', 'btyping—']);
  expect(historyRow(5)).toBeNull();
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

test('the sections sit flat on the page: Scanning first, every later section under a rule', () => {
  render(<BarcodeScanningSettings />);
  expect(classesOf('settings-barcode-scanning-group')).not.toContain('border-t');
  for (const id of ['settings-barcode-sound-group', 'barcode-input-sources', 'settings-barcode-test']) {
    expect(classesOf(id)).toEqual(expect.arrayContaining(['border-t', 'pt-4']));
  }
  expect(classesOf('settings-barcode-scanning-group')).not.toContain('rounded-lg');
  expect(classesOf('settings-barcode-sound-group')).not.toContain('rounded-lg');
});

test("each Scanning row is v2's muted key in the 256 / 288 column, with its field in the value column", () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<BarcodeScanningSettings />);
  for (const [row, label] of [
    ['settings-barcode-threshold-row', 'Barcode Average Time Input Threshold (ms)'],
    ['settings-barcode-min-chars-row', 'Barcode Minimum Length'],
    ['settings-barcode-prefix-row', 'Barcode Scanner Prefix'],
    ['settings-barcode-suffix-row', 'Barcode Scanner Suffix'],
  ]) {
    expect(screen.getByTestId(`${row}-label`).textContent).toBe(label);
    expect(classesOf(`${row}-label`)).toEqual(expect.arrayContaining(['text-muted-foreground', 'text-sm']));
  }
  expect(classesOf('settings-barcode-threshold-row-key')).toEqual(expect.arrayContaining(['w-64', 'lg:w-72']));
  expect(screen.getByTestId('settings-barcode-threshold-row').contains(screen.getByTestId('settings-barcode-threshold'))).toBe(true);
});

test('the Sound options are indented rows under Play a sound on scan', () => {
  writeScanSoundSettings({ enabled: true });
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<BarcodeScanningSettings />);
  expect(classesOf('settings-barcode-sound-row-key')).not.toContain('pl-4');
  for (const id of ['settings-barcode-sound-volume-row', 'settings-barcode-sound-success-row', 'settings-barcode-sound-failure-row']) {
    expect(classesOf(`${id}-key`)).toContain('pl-4');
  }
  expect(classesOf('settings-barcode-sound-theme-row-label')).toContain('pl-4');
  expect(classesOf('settings-barcode-sound-theme-row')).not.toContain('pl-4');
  const volume = screen.getByTestId('settings-barcode-sound-volume-row');
  expect(volume.contains(screen.getByTestId('settings-barcode-sound-volume'))).toBe(true);
  expect(volume.contains(screen.getByTestId('sound-preview-volume'))).toBe(true);
});

test('Scanner sits between Sound and the Test, with the keyboard copy', () => {
  render(<BarcodeScanningSettings />);
  const titles = ['Sound', 'Scanner', 'Barcode Scanning Test'].map(title => screen.getByText(title));
  expect(titles[0].compareDocumentPosition(titles[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(titles[1].compareDocumentPosition(titles[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByTestId('barcode-input-sources-description').textContent).toBe('Almost all barcode scanners pair as a Bluetooth or USB keyboard. Pair it in your device’s settings, then scan into the POS — the app recognises the scan automatically.');
  expect(screen.getByTestId('scanner-no-setup-needed').textContent).toBe('No setup needed for most scanners.');
  expect(screen.getByTestId('barcode-input-sources').textContent).not.toContain('WCPOS');
});

test('Scanner setup guide opens the scanner docs', () => {
  const open = vi.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(true);
  render(<BarcodeScanningSettings />);
  const link = screen.getByTestId('scanner-setup-guide-link');
  expect(link.textContent).toBe('Scanner setup guide');
  fireEvent.click(link);
  expect(open).toHaveBeenCalledExactlyOnceWith('https://docs.wcpos.com/hardware/scanners/setup-wizard');
});
