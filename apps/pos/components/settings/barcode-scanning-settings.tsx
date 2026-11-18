import { useEffect, useState, type JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Button, Card, Input, RadioGroup, RadioGroupItem, Slider, Switch, Text } from '@tallyui/components';
import { useScanSettings } from '../../lib/scan/scan-settings';
import { scanSuggestions } from '../../lib/scan/scan-suggestions';
import {
  MAX_SCAN_SOUND_VOLUME, MIN_SCAN_SOUND_VOLUME, normalizeScanSoundTheme, playScanTone, SCAN_SOUND_THEMES, useScanSoundSettings,
  type ScanSoundTheme,
} from '../../lib/scan/scan-sound';
import { useWedgeScanner } from '../../lib/scan/use-wedge-scanner';
import type { ScanSettings, WedgeAttempt, WedgeResult } from '../../lib/scan/wedge';
import { SettingsField, SettingsSection, SETTINGS_HELP_CLASS, SETTINGS_KEY_CLASS } from './settings-form';
import { CheckIcon } from '../icons';
import { DocsLink, SCANNER_DOCS_URL } from '../docs-link';

// v2 settings.barcode_test_result_*; badge tones follow v2's History (ok, warning, muted).
const RESULT_WORDS: Record<WedgeResult, string> = { scan: 'scan', too_short: 'too short', typing: 'typing' };
const RESULT_VARIANTS = { scan: 'success', too_short: 'warning', typing: 'secondary' } as const;
// v2 use-scan-trace-capture.ts:11,34: the panel keeps the last five attempts, newest first.
const MAX_ATTEMPTS = 5;

// v2 test-panel.tsx headlines (settings.barcode_test_*).
function verdict(attempt: WedgeAttempt | null): string {
  if (!attempt) return 'Scan into this page to see keystroke timing';
  // v2 analyze-trace.ts:54: a too-short code is a detected scan; its fix is the suggestion notice below.
  if (attempt.result === 'scan' || attempt.result === 'too_short') return `Detected as a scan → ${attempt.code}`;
  if (attempt.avgGapMs === undefined) return 'Treated as typing — only one key pressed, so there are no gaps to measure';
  return `Treated as typing (average gap ${Math.round(attempt.avgGapMs)}ms) — correctly ignored`;
}

function CountField({ testID, label, value, onChange }: { testID: string; label: string; value: number; onChange(next: number): void }) {
  const [text, setText] = useState(String(value));
  // A value set from outside (a test-panel Apply) replaces the text unless the text already says it.
  useEffect(() => setText(prev => (/^\d+$/.test(prev.trim()) && Number(prev.trim()) === value ? prev : String(value))), [value]);
  return (
    <Input className="w-full"><Input.Field testID={testID} accessibilityLabel={label} keyboardType="number-pad" value={text}
      onChangeText={next => {
        setText(next);
        // v2's formSchema: a whole number, 0 or more; anything else stays on screen unsaved.
        if (/^\d+$/.test(next.trim())) onChange(Number(next.trim()));
      }} /></Input>
  );
}

function TextField({ testID, label, value, onChange }: { testID: string; label: string; value: string; onChange(next: string): void }) {
  return (
    <Input className="w-full"><Input.Field testID={testID} accessibilityLabel={label} autoCapitalize="none" autoCorrect={false}
      value={value} onChangeText={onChange} /></Input>
  );
}

// `settings` is the page's own useScanSettings() value, so an edit above shows in the next verdict; Apply saves through `update`.
function ScanTestPanel({ settings, update }: { settings: ScanSettings; update(patch: Partial<ScanSettings>): void }): JSX.Element {
  const [attempts, setAttempts] = useState<WedgeAttempt[]>([]);
  const attempt = attempts[0] ?? null;
  // v2 analyze-trace.ts:54 (tooShort = detectedAsScan && …): too short gets the scan check and timing as well.
  const detected = attempt?.result === 'scan' || attempt?.result === 'too_short';
  // Claims the wedge while the page is open, so a test scan never rings up on the till underneath.
  useWedgeScanner(() => {}, true, next => setAttempts(prev => [next, ...prev].slice(0, MAX_ATTEMPTS)));
  return (
    <View className="gap-3 pt-1">
      {/* v2 test-panel.tsx:143-169: each value is a filled, read-only mono Input, empty before a scan; the wedge listens globally. */}
      <View className="gap-1">
        <Text className="text-sm font-medium text-foreground">Keypress Event</Text>
        <Input testID="barcode-test-keys-box" className="bg-accent"><Input.Field testID="barcode-test-keys" accessibilityLabel="Keypress Event"
          className="font-mono" value={attempt?.raw ?? ''} editable={false} aria-disabled /></Input>
      </View>
      <View className="gap-1">
        <Text className="text-sm font-medium text-foreground">Detected Barcode</Text>
        <Input testID="barcode-test-detected-box" className="bg-accent"><Input.Field testID="barcode-test-detected" accessibilityLabel="Detected Barcode"
          className="font-mono" value={attempt?.result === 'scan' ? attempt.code : ''} editable={false} aria-disabled /></Input>
      </View>
      <View className="flex-row items-center gap-2">
        {attempt && <Badge testID="barcode-test-result" variant={RESULT_VARIANTS[attempt.result]} label={RESULT_WORDS[attempt.result]} />}
        {/* v2 test-panel.tsx:226-240: a scan is the success check and a subheading, then its timing as help. */}
        {detected && <CheckIcon testID="barcode-test-scan-check" size={16} className="text-success" />}
        <Text testID="barcode-test-verdict" className={`flex-1 ${detected ? 'text-base font-medium text-foreground' : 'text-sm text-muted-foreground'}`}>{verdict(attempt)}</Text>
      </View>
      {detected && <Text testID="barcode-test-scan-detail" className={SETTINGS_HELP_CLASS}>
        {`Average keystroke gap ${Math.round(attempt?.avgGapMs ?? 0)}ms, under the ${settings.threshold}ms threshold`}</Text>}
      {/* v2 test-panel.tsx:247-256: a Notice tone="info" per suggestion with one Apply action. */}
      {attempt && scanSuggestions(attempt, settings).map(s => (
        <View key={s.kind} testID={`barcode-test-suggestion-${s.kind}`} className="gap-2 rounded-lg border border-info bg-info/10 px-3 py-2.5">
          <Text testID={`barcode-test-suggestion-${s.kind}-title`} className="text-sm text-foreground">{s.title}</Text>
          <View className="flex-row"><Button variant="outline" size="sm" testID={`barcode-test-suggestion-${s.kind}-apply`}
            onPress={() => update(s.patch)}><Text>Apply</Text></Button></View>
        </View>
      ))}
      {attempts.length > 0 && <RecentAttempts attempts={attempts} />}
    </View>
  );
}

// v2 test-panel.tsx:294-320 (History): a row card per attempt with its code, its result badge and its rounded gap.
function RecentAttempts({ attempts }: { attempts: WedgeAttempt[] }): JSX.Element {
  return (
    <View testID="barcode-test-history" className="gap-1">
      <Text className="text-base font-medium text-foreground">Recent attempts</Text>
      {attempts.map((entry, index) => (
        // v2's Card padding="row" (p-3) has no shadow.
        <Card key={index} testID={`barcode-test-history-row-${index}`} className="flex-row items-center gap-2 p-3 shadow-none">
          <Text className="flex-1 font-mono text-sm" numberOfLines={1}>{entry.code || entry.raw || '—'}</Text>
          <Badge variant={RESULT_VARIANTS[entry.result]} label={RESULT_WORDS[entry.result]} />
          <Text className={`w-16 text-right ${SETTINGS_HELP_CLASS}`}>
            {entry.avgGapMs === undefined ? '—' : `${Math.round(entry.avgGapMs)}ms`}</Text>
        </Card>
      ))}
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
    <SettingsSection title="Sound" testID="settings-barcode-sound-group">
      <SettingsField testID="settings-barcode-sound-row" label="Play a sound on scan">
        <Switch size="sm" testID="settings-barcode-sound" accessibilityLabel="Play a sound on scan" checked={sound.enabled}
          onCheckedChange={enabled => update({ enabled })} />
      </SettingsField>
      {sound.enabled && (
        <View testID="scan-sound-options">
          <View testID="settings-barcode-sound-theme-row" className="gap-1 py-1">
            <Text testID="settings-barcode-sound-theme-row-label" className={`${SETTINGS_KEY_CLASS} pl-4`}>Sound theme</Text>
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
          <SettingsField indent testID="settings-barcode-sound-volume-row" label="Volume" trailing={
            <PreviewButton testID="sound-preview-volume" label="Preview success sound" glyph="▶"
              onPress={() => preview('success', sound.theme)} />
          }>
            <View className="w-full px-2">
              <Slider testID="settings-barcode-sound-volume" aria-label="Volume" value={sound.volume}
                min={MIN_SCAN_SOUND_VOLUME} max={MAX_SCAN_SOUND_VOLUME} step={0.05} onValueChange={volume => update({ volume })} />
            </View>
          </SettingsField>
          <SettingsField indent testID="settings-barcode-sound-success-row" label="Success sound">
            <Switch size="sm" testID="settings-barcode-sound-success" accessibilityLabel="Success sound" checked={sound.success}
              onCheckedChange={success => update({ success })} />
          </SettingsField>
          <SettingsField indent testID="settings-barcode-sound-failure-row" label="Failure sound">
            <Switch size="sm" testID="settings-barcode-sound-failure" accessibilityLabel="Failure sound" checked={sound.failure}
              onCheckedChange={failure => update({ failure })} />
          </SettingsField>
        </View>
      )}
    </SettingsSection>
  );
}

// v2 input-sources.tsx:326-362 with no saved scanner profile (the keyboard lane); "Direct connection" (HID-POS, serial, BLE pairing) waits for TallyUI #682.
function ScannerSection(): JSX.Element {
  return (
    <SettingsSection title="Scanner" testID="barcode-input-sources"
      description="Almost all barcode scanners pair as a Bluetooth or USB keyboard. Pair it in your device’s settings, then scan into the POS — the app recognises the scan automatically.">
      <View className="gap-2 pt-1">
        {/* v2's `subheading` rank (text/ladder.ts:12, text-base font-ui). */}
        <Text testID="scanner-no-setup-needed" className="text-base font-medium text-foreground">No setup needed for most scanners.</Text>
        <DocsLink testID="scanner-setup-guide-link" href={SCANNER_DOCS_URL}>Scanner setup guide</DocsLink>
      </View>
    </SettingsSection>
  );
}

export function BarcodeScanningSettings(): JSX.Element {
  const [settings, update] = useScanSettings();
  return (
    <View testID="screen-settings-barcode-scanning" className="gap-5">
      <SettingsSection first title="Scanning" testID="settings-barcode-scanning-group">
        <SettingsField testID="settings-barcode-threshold-row" label="Barcode Average Time Input Threshold (ms)">
          <CountField testID="settings-barcode-threshold" label="Barcode Average Time Input Threshold (ms)"
            value={settings.threshold} onChange={threshold => update({ threshold })} />
        </SettingsField>
        <SettingsField testID="settings-barcode-min-chars-row" label="Barcode Minimum Length">
          <CountField testID="settings-barcode-min-chars" label="Barcode Minimum Length"
            value={settings.minChars} onChange={minChars => update({ minChars })} />
        </SettingsField>
        <SettingsField testID="settings-barcode-prefix-row" label="Barcode Scanner Prefix">
          <TextField testID="settings-barcode-prefix" label="Barcode Scanner Prefix"
            value={settings.prefix} onChange={prefix => update({ prefix })} />
        </SettingsField>
        <SettingsField testID="settings-barcode-suffix-row" label="Barcode Scanner Suffix">
          <TextField testID="settings-barcode-suffix" label="Barcode Scanner Suffix"
            value={settings.suffix} onChange={suffix => update({ suffix })} />
        </SettingsField>
      </SettingsSection>
      <SoundSettings />
      <ScannerSection />
      <SettingsSection title="Barcode Scanning Test" testID="settings-barcode-test"><ScanTestPanel settings={settings} update={update} /></SettingsSection>
    </View>
  );
}
