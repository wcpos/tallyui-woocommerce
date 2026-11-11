import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { audioLog, installFakeAudio, tones } from './fake-audio-context';

type ScanSound = typeof import('../lib/scan/scan-sound');
let sound: ScanSound;

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

// A fresh module per test, so the shared AudioContext is made from this test's window.
beforeEach(async () => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.resetModules();
  sound = await import('../lib/scan/scan-sound');
});
afterEach(() => { vi.unstubAllGlobals(); });

test('classic success rises 880 then 1320 sine; checkout failure is two 240 square', () => {
  installFakeAudio();
  sound.playScanTone('success', { theme: 'classic' });
  expect(tones()).toEqual(['sine 880', 'sine 1320']);
  installFakeAudio();
  sound.playScanTone('failure', { theme: 'checkout' });
  expect(tones()).toEqual(['square 240', 'square 240']);
});

test('the volume is clamped to 0.05–0.4, and the default is 0.15', () => {
  installFakeAudio();
  sound.playScanTone('success', { volume: 9 });
  expect(audioLog.peaks).toEqual([0.4, 0.4]);
  installFakeAudio();
  sound.playScanTone('success', { volume: 0 });
  expect(audioLog.peaks).toEqual([0.05, 0.05]);
  installFakeAudio();
  sound.playScanTone('success');
  expect(audioLog.peaks).toEqual([0.15, 0.15]);
});

test('no AudioContext on window is a quiet no-op', () => {
  expect(() => sound.playScanTone('success')).not.toThrow();
  expect(() => sound.playScanTone('failure')).not.toThrow();
});

test('an AudioContext constructor that throws is a quiet no-op', () => {
  vi.stubGlobal('AudioContext', class { constructor() { throw new Error('blocked'); } });
  expect(() => sound.playScanTone('success')).not.toThrow();
});

test('a suspended context schedules nothing until resume resolves', async () => {
  installFakeAudio('suspended');
  sound.playScanTone('success', { theme: 'soft' });
  expect(audioLog.resumes).toBe(1);
  expect(tones()).toEqual([]);
  await Promise.resolve();
  await Promise.resolve();
  expect(tones()).toEqual(['sine 660', 'sine 990']);
  expect(audioLog.states).toEqual(['running', 'running']);
});

test('stored settings have the v2 defaults, drop an unknown theme and clamp the volume', () => {
  expect(sound.normalizeScanSoundSettings(null)).toEqual({ enabled: false, theme: 'classic', volume: 0.15, success: true, failure: true });
  expect(sound.normalizeScanSoundSettings({ enabled: 'yes', theme: 'loud', volume: 2, success: false, failure: 0 }))
    .toEqual({ enabled: false, theme: 'classic', volume: 0.4, success: false, failure: true });
  expect(sound.normalizeScanSoundSettings({ enabled: true, theme: 'soft', volume: 0.01 }))
    .toEqual({ enabled: true, theme: 'soft', volume: 0.05, success: true, failure: true });
  localStorage.setItem(sound.SCAN_SOUND_KEY, 'not json');
  expect(sound.readScanSoundSettings()).toEqual(sound.DEFAULT_SCAN_SOUND_SETTINGS);
});

test('scanFeedback plays nothing while sound is off', () => {
  installFakeAudio();
  sound.scanFeedback('success');
  sound.scanFeedback('failure');
  expect(tones()).toEqual([]);
});

test('scanFeedback plays success only while the success switch is on', () => {
  installFakeAudio();
  sound.writeScanSoundSettings({ enabled: true, theme: 'classic', success: false });
  sound.scanFeedback('success');
  expect(tones()).toEqual([]);
  sound.writeScanSoundSettings({ success: true });
  sound.scanFeedback('success');
  expect(tones()).toEqual(['sine 880', 'sine 1320']);
});

test('scanFeedback plays failure only while the failure switch is on, at the saved theme and volume', () => {
  installFakeAudio();
  sound.writeScanSoundSettings({ enabled: true, theme: 'soft', volume: 0.3, failure: false });
  sound.scanFeedback('failure');
  expect(tones()).toEqual([]);
  sound.writeScanSoundSettings({ failure: true });
  sound.scanFeedback('failure');
  expect(tones()).toEqual(['sine 180']);
  expect(audioLog.peaks).toEqual([0.3]);
});
