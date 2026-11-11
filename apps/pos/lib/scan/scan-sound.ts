import { useCallback, useState } from 'react';

// Themes, tone tables and limits as in v2's
// `packages/core/src/screens/main/pos/products/scan-sound-themes.ts` (WCPOS monorepo).
export type ScanSoundTheme = 'classic' | 'checkout' | 'soft';

export const SCAN_SOUND_THEMES: ScanSoundTheme[] = ['classic', 'checkout', 'soft'];

export const DEFAULT_SCAN_SOUND_THEME: ScanSoundTheme = 'classic';
export const DEFAULT_SCAN_SOUND_VOLUME = 0.15;
export const MIN_SCAN_SOUND_VOLUME = 0.05;
export const MAX_SCAN_SOUND_VOLUME = 0.4;

export interface ToneSegment {
  freq: number;
  duration: number;
  type?: OscillatorType;
}

export const SCAN_SOUND_TONES: Record<ScanSoundTheme, { success: ToneSegment[]; failure: ToneSegment[] }> = {
  // Bright rising two-note blip / low descending square buzz.
  classic: {
    success: [{ freq: 880, duration: 0.06 }, { freq: 1320, duration: 0.09 }],
    failure: [{ freq: 330, duration: 0.11, type: 'square' }, { freq: 220, duration: 0.13, type: 'square' }],
  },
  // Supermarket-style flat beep / double low tone.
  checkout: {
    success: [{ freq: 1000, duration: 0.12, type: 'triangle' }],
    failure: [{ freq: 240, duration: 0.09, type: 'square' }, { freq: 240, duration: 0.09, type: 'square' }],
  },
  // Gentle chime / muted knock — for quiet shops.
  soft: {
    success: [{ freq: 660, duration: 0.09 }, { freq: 990, duration: 0.14 }],
    failure: [{ freq: 180, duration: 0.16 }],
  },
};

export function normalizeScanSoundTheme(value: unknown): ScanSoundTheme {
  return SCAN_SOUND_THEMES.includes(value as ScanSoundTheme) ? value as ScanSoundTheme : DEFAULT_SCAN_SOUND_THEME;
}

export function clampScanSoundVolume(value: unknown): number {
  const volume = typeof value === 'number' && Number.isFinite(value) ? value : NaN;
  if (Number.isNaN(volume)) return DEFAULT_SCAN_SOUND_VOLUME;
  return Math.min(MAX_SCAN_SOUND_VOLUME, Math.max(MIN_SCAN_SOUND_VOLUME, volume));
}

// Settings > Barcode Scanning > Sound, per device. v2 keeps these on the store document; this app has no local
// store document, and a replicated collection must never take local writes.
export const SCAN_SOUND_KEY = 'tallywoo.scan_sound.v1';

export interface ScanSoundSettings {
  enabled: boolean;
  theme: ScanSoundTheme;
  volume: number;
  success: boolean;
  failure: boolean;
}

export const DEFAULT_SCAN_SOUND_SETTINGS: ScanSoundSettings = {
  enabled: false, theme: DEFAULT_SCAN_SOUND_THEME, volume: DEFAULT_SCAN_SOUND_VOLUME, success: true, failure: true,
};

function flag(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

export function normalizeScanSoundSettings(raw: unknown): ScanSoundSettings {
  const stored = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
  return {
    enabled: flag(stored.enabled, DEFAULT_SCAN_SOUND_SETTINGS.enabled),
    theme: normalizeScanSoundTheme(stored.theme),
    volume: clampScanSoundVolume(stored.volume),
    success: flag(stored.success, DEFAULT_SCAN_SOUND_SETTINGS.success),
    failure: flag(stored.failure, DEFAULT_SCAN_SOUND_SETTINGS.failure),
  };
}

export function readScanSoundSettings(): ScanSoundSettings {
  try {
    const stored = localStorage.getItem(SCAN_SOUND_KEY);
    return normalizeScanSoundSettings(stored === null ? null : JSON.parse(stored));
  } catch { return { ...DEFAULT_SCAN_SOUND_SETTINGS }; }
}

export function writeScanSoundSettings(patch: Partial<ScanSoundSettings>): ScanSoundSettings {
  const next = normalizeScanSoundSettings({ ...readScanSoundSettings(), ...patch });
  try { localStorage.setItem(SCAN_SOUND_KEY, JSON.stringify(next)); } catch { /* the page keeps the value for this visit */ }
  return next;
}

export function useScanSoundSettings(): [ScanSoundSettings, (patch: Partial<ScanSoundSettings>) => void] {
  const [settings, setSettings] = useState(readScanSoundSettings);
  const update = useCallback((patch: Partial<ScanSoundSettings>) => setSettings(writeScanSoundSettings(patch)), []);
  return [settings, update];
}

// v2's play-scan-sound.web.ts: tones synthesised with the Web Audio API, so no audio asset ships. Everything is
// best-effort and swallows errors: a missing or blocked AudioContext must never break a scan.
interface MinimalAudioContext {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: AudioNode;
  resume(): Promise<void>;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
}

type AudioContextCtor = new () => MinimalAudioContext;

let sharedContext: MinimalAudioContext | null = null;

function getContext(): MinimalAudioContext | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  const Ctor = win.AudioContext ?? win.webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  return sharedContext;
}

function scheduleTones(context: MinimalAudioContext, segments: ToneSegment[], peakGain: number): void {
  // currentTime is read here, not before an async resume, so the schedule starts once the context runs.
  let start = context.currentTime;
  for (const segment of segments) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = segment.type ?? 'sine';
    oscillator.frequency.value = segment.freq;
    const end = start + segment.duration;
    // 10 ms ramps top and tail each tone so it does not click.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.01);
    gain.gain.linearRampToValueAtTime(0, end);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
    start = end;
  }
}

function playTones(segments: ToneSegment[], peakGain: number): void {
  const context = getContext();
  if (!context) return;
  // Autoplay policies suspend the context until a user gesture; schedule only once it runs so no tone is clipped.
  if (context.state === 'suspended') {
    void context.resume().then(() => scheduleTones(context, segments, peakGain)).catch(() => undefined);
    return;
  }
  scheduleTones(context, segments, peakGain);
}

export type ScanToneKind = 'success' | 'failure';

export function playScanTone(kind: ScanToneKind, options: { theme?: ScanSoundTheme; volume?: number } = {}): void {
  try {
    const theme = normalizeScanSoundTheme(options.theme);
    playTones(SCAN_SOUND_TONES[theme][kind], clampScanSoundVolume(options.volume));
  } catch {
    // best-effort
  }
}

// v2's use-scan-feedback.ts: the settings are read at play time, so a change on the settings page applies to the next scan.
export function scanFeedback(kind: ScanToneKind): void {
  const settings = readScanSoundSettings();
  if (!settings.enabled || !settings[kind]) return;
  playScanTone(kind, { theme: settings.theme, volume: settings.volume });
}
