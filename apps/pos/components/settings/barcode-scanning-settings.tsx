import { useState, type JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Button, Input, RadioGroup, RadioGroupItem, SettingsGroup, SettingsRow, Slider, Switch, Text } from '@tallyui/components';
import { useScanSettings } from '../../lib/scan/scan-settings';
import {
  MAX_SCAN_SOUND_VOLUME, MIN_SCAN_SOUND_VOLUME, normalizeScanSoundTheme, playScanTone, SCAN_SOUND_THEMES, useScanSoundSettings,
  type ScanSoundTheme,
} from '../../lib/scan/scan-sound';
import { useWedgeScanner } from '../../lib/scan/use-wedge-scanner';
import type { WedgeAttempt, WedgeResult } from '../../lib/scan/wedge';

// v2 settings.barcode_test_result_*; badge tones follow v2's History (ok, warning, muted).
const RESULT_WORDS: Record<WedgeResult, string> = { scan: 'scan', too_short: 'too short', typing: 'typing' };
const RESULT_VARIANTS = { scan: 'success', too_short: 'warning', typing: 'secondary' } as const;

// v2 test-panel.tsx headlines (settings.barcode_test_*).
function verdict(attempt: WedgeAttempt | null): string {
  if (!attempt) return 'Scan into this page to see keystroke timing';
  if (attempt.result === 'scan') return `Detected as a scan → ${attempt.code}`;
  if (attempt.result === 'too_short') return `Lower minimum length to ${attempt.code.length} — this code is ${attempt.code.length} characters`;
  if (attempt.avgGapMs === undefined) return 'Treated as typing — only one key pressed, so there are no gaps to measure';
  return `Treated as typing (average gap ${Math.round(attempt.avgGapMs)}ms) — correctly ignored`;
}

function CountField({ testID, label, value, onChange }: { testID: string; label: string; value: number; onChange(next: number): void }) {
  const [text, setText] = useState(String(value));
  return (
    <Input><Input.Field testID={testID} accessibilityLabel={label} keyboardType="number-pad" value={text}
      onChangeText={next => {
        setText(next);
        // v2's formSchema: a whole number, 0 or more; anything else stays on screen unsaved.
        if (/^\d+$/.test(next.trim())) onChange(Number(next.trim()));
      }} /></Input>
  );
}

function TextField({ testID, label, value, onChange }: { testID: string; label: string; value: string; onChange(next: string): void }) {
  return (
    <Input><Input.Field testID={testID} accessibilityLabel={label} autoCapitalize="none" autoCorrect={false}
      value={value} onChangeText={onChange} /></Input>
  );
}

function ScanTestPanel(): JSX.Element {
  const [attempt, setAttempt] = useState<WedgeAttempt | null>(null);
  // Claims the wedge while the page is open, so a test scan never rings up on the till underneath.
  useWedgeScanner(() => {}, true, setAttempt);
  return (
    <View className="gap-3 px-4 py-3">
      <View className="gap-1">
        <Text className="text-sm font-medium text-foreground">Keypress Event</Text>
        <Text testID="barcode-test-keys">{attempt?.raw || '—'}</Text>
      </View>
      <View className="gap-1">
        <Text className="text-sm font-medium text-foreground">Detected Barcode</Text>
        <Text testID="barcode-test-detected">{attempt?.result === 'scan' ? attempt.code : '—'}</Text>
      </View>
      <View className="flex-row items-center gap-2">
        {attempt && <Badge testID="barcode-test-result" variant={RESULT_VARIANTS[attempt.result]} label={RESULT_WORDS[attempt.result]} />}
        <Text testID="barcode-test-verdict" className="flex-1 text-sm text-muted-foreground">{verdict(attempt)}</Text>
      </View>
    </View>
  );
}

// v2 settings.barcode_sound_theme_* copy.
const THEME_COPY: Record<ScanSoundTheme, { label: string; desc: string }> = {
  classic: { label: 'Classic', desc: 'Bright rising blip / low buzz' },
  checkout: { label: 'Checkout', desc: 'Supermarket-style flat beep / double low tone' },
  soft: { label: 'Soft', desc: 'Gentle chime / muted knock — for quiet shops' },
};

function PreviewButton({ testID, label, glyph, onPress }: { testID: string; label: string; glyph: string; onPress(): void }) {
  return <Button variant="outline" size="sm" testID={testID} accessibilityLabel={label} onPress={onPress}><Text>{glyph}</Text></Button>;
}

// v2 barcode-scanning/settings.tsx, the Sound section. The haptic switch is native-only and this app is web-first.
function SoundSettings(): JSX.Element {
  const [sound, update] = useScanSoundSettings();
  // Previews ignore the success/failure switches, as v2's do.
  const preview = (kind: 'success' | 'failure', theme: ScanSoundTheme) => playScanTone(kind, { theme, volume: sound.volume });
  return (
    <SettingsGroup title="Sound" testID="settings-barcode-sound-group">
      <SettingsRow label="Play a sound on scan" action={
        <Switch testID="settings-barcode-sound" accessibilityLabel="Play a sound on scan" checked={sound.enabled}
          onCheckedChange={enabled => update({ enabled })} />
      } />
      {sound.enabled && (
        <View testID="scan-sound-options">
          <View className="gap-2 px-4 py-3">
            <Text className="text-sm font-medium text-foreground">Sound theme</Text>
            <RadioGroup value={sound.theme} onValueChange={theme => update({ theme: normalizeScanSoundTheme(theme) })}>
              {SCAN_SOUND_THEMES.map(theme => (
                <View key={theme} className="min-h-11 flex-row items-center gap-2">
                  <RadioGroupItem value={theme} testID={`sound-theme-${theme}`} accessibilityLabel={THEME_COPY[theme].label} />
                  <Pressable onPress={() => update({ theme })}>
                    <Text className="text-sm text-foreground">{THEME_COPY[theme].label}</Text>
                  </Pressable>
                  <Text className="flex-1 text-xs text-muted-foreground">{THEME_COPY[theme].desc}</Text>
                  <PreviewButton testID={`sound-preview-success-${theme}`} label="Preview success sound" glyph="▶"
                    onPress={() => preview('success', theme)} />
                  <PreviewButton testID={`sound-preview-failure-${theme}`} label="Preview failure sound" glyph="▶✕"
                    onPress={() => preview('failure', theme)} />
                </View>
              ))}
            </RadioGroup>
          </View>
          <View className="flex-row items-center gap-3 px-4 py-3">
            <Text className="text-sm font-medium text-foreground">Volume</Text>
            <View className="flex-1 px-2">
              <Slider testID="settings-barcode-sound-volume" aria-label="Volume" value={sound.volume}
                min={MIN_SCAN_SOUND_VOLUME} max={MAX_SCAN_SOUND_VOLUME} step={0.05} onValueChange={volume => update({ volume })} />
            </View>
            <PreviewButton testID="sound-preview-volume" label="Preview success sound" glyph="▶"
              onPress={() => preview('success', sound.theme)} />
          </View>
          <SettingsRow label="Success sound" action={
            <Switch testID="settings-barcode-sound-success" accessibilityLabel="Success sound" checked={sound.success}
              onCheckedChange={success => update({ success })} />
          } />
          <SettingsRow label="Failure sound" action={
            <Switch testID="settings-barcode-sound-failure" accessibilityLabel="Failure sound" checked={sound.failure}
              onCheckedChange={failure => update({ failure })} />
          } />
        </View>
      )}
    </SettingsGroup>
  );
}

export function BarcodeScanningSettings(): JSX.Element {
  const [settings, update] = useScanSettings();
  return (
    <View testID="screen-settings-barcode-scanning" className="gap-5">
      <SettingsGroup title="Scanning" testID="settings-barcode-scanning-group">
        <SettingsRow label="Barcode Average Time Input Threshold (ms)" action={
          <CountField testID="settings-barcode-threshold" label="Barcode Average Time Input Threshold (ms)"
            value={settings.threshold} onChange={threshold => update({ threshold })} />
        } />
        <SettingsRow label="Barcode Minimum Length" action={
          <CountField testID="settings-barcode-min-chars" label="Barcode Minimum Length"
            value={settings.minChars} onChange={minChars => update({ minChars })} />
        } />
        <SettingsRow label="Barcode Scanner Prefix" action={
          <TextField testID="settings-barcode-prefix" label="Barcode Scanner Prefix"
            value={settings.prefix} onChange={prefix => update({ prefix })} />
        } />
        <SettingsRow label="Barcode Scanner Suffix" action={
          <TextField testID="settings-barcode-suffix" label="Barcode Scanner Suffix"
            value={settings.suffix} onChange={suffix => update({ suffix })} />
        } />
      </SettingsGroup>
      <SoundSettings />
      <SettingsGroup title="Barcode Scanning Test" testID="settings-barcode-test"><ScanTestPanel /></SettingsGroup>
    </View>
  );
}
