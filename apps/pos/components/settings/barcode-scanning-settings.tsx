import { useEffect, useState, type JSX } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  Badge, Button, Card, Dialog, DialogContent, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  IconButton, Input, RadioGroup, RadioGroupItem, Slider, Switch, Text, XIcon,
} from '@tallyui/components';
import { removeScannerProfile, scannerProfiles$, useDeviceScanControls, type ScannerProfile } from '@tallyui/pos';
import { useCatalogue } from '../../lib/catalogue/catalogue-context';
import { useScanSettings } from '../../lib/scan/scan-settings';
import { SCANNER_FAST_CEILING_MS, scanSuggestions } from '../../lib/scan/scan-suggestions';
import {
  MAX_SCAN_SOUND_VOLUME, MIN_SCAN_SOUND_VOLUME, normalizeScanSoundTheme, playScanTone, SCAN_SOUND_THEMES, useScanSoundSettings,
  type ScanSoundTheme,
} from '../../lib/scan/scan-sound';
import { useWedgeScanner } from '../../lib/scan/use-wedge-scanner';
import type { ScanSettings, WedgeAttempt, WedgeResult } from '../../lib/scan/wedge';
import { SavedFieldProvider, SavedMark, savedKeys, SettingsField, SettingsSection, SETTINGS_HELP_CLASS, SETTINGS_KEY_CLASS, useMarkSaved } from './settings-form';
import { CheckIcon, MoreIcon } from '../icons';
import { DocsLink, SCAN_TEST_DOCS_URL, SCANNER_DOCS_URL } from '../docs-link';
import { RIGHT_SHEET, SHEET_TITLE, SheetCloseButton } from '../sheet';

// v2 settings.barcode_test_result_*; badge tones follow v2's History (ok, warning, muted).
const RESULT_WORDS: Record<WedgeResult, string> = { scan: 'scan', too_short: 'too short', typing: 'typing' };
const RESULT_VARIANTS = { scan: 'success', too_short: 'warning', typing: 'secondary' } as const;
// v2 use-scan-trace-capture.ts:11,34: the panel keeps the last five attempts, newest first.
const MAX_ATTEMPTS = 5;

// v2 analyze-trace.ts:55 nearMiss: typing, yet fast enough to be a scanner over the threshold.
const nearMiss = (attempt: WedgeAttempt) => attempt.result === 'typing' && attempt.avgGapMs !== undefined && attempt.avgGapMs < SCANNER_FAST_CEILING_MS;

// v2 test-panel.tsx headlines (settings.barcode_test_*).
function verdict(attempt: WedgeAttempt, threshold: number): string {
  // v2 analyze-trace.ts:54: a too-short code is a detected scan; its fix is the suggestion notice below.
  if (attempt.result === 'scan' || attempt.result === 'too_short') return `Detected as a scan → ${attempt.code}`;
  if (attempt.avgGapMs === undefined) return 'Treated as typing — only one key pressed, so there are no gaps to measure';
  if (nearMiss(attempt)) return `Treated as typing — average gap ${Math.round(attempt.avgGapMs)}ms is above your ${threshold}ms threshold`;
  return `Treated as typing (average gap ${Math.round(attempt.avgGapMs)}ms) — correctly ignored`;
}

// v2's Notice tone="warning" band (notice/index.tsx, lib/tone.ts:26), drawn as health-screen's: TallyUI has no Notice.
function WarningNotice({ testID, title, description, className = '' }: { testID: string; title: string; description?: string; className?: string }): JSX.Element {
  return (
    <View testID={testID} role="status" className={`rounded-lg border border-warning/45 bg-warning/15 px-3 py-2.5 ${className}`}>
      <Text testID={`${testID}-title`} className="font-medium text-foreground">{title}</Text>
      {description && <Text testID={`${testID}-description`} className="text-muted-foreground">{description}</Text>}
    </View>
  );
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

// v2 test-panel.tsx:26: bars stop growing at 60ms, so the dashed line sits at most 60px up.
const BAR_HEIGHT_CAP_MS = 60;

// v2 test-panel.tsx:35-81 (TimingChart): a column per key with its bar, key and gap; amber where a gap is over the threshold.
// Before an attempt the area reads v2's settings.barcode_test_chart_empty.
function TimingChart({ attempt, threshold }: { attempt: WedgeAttempt | null; threshold: number }): JSX.Element {
  if (!attempt) return <View testID="barcode-test-chart"><Text className={SETTINGS_HELP_CLASS}>Scan into this page to see keystroke timing</Text></View>;
  return (
    <View testID="barcode-test-chart" className="gap-1">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="relative flex-row gap-1 pt-2">
          <View testID="barcode-test-chart-threshold" className="absolute left-0 right-0 border-t border-dashed border-border"
            style={{ top: 8 + BAR_HEIGHT_CAP_MS - Math.min(threshold, BAR_HEIGHT_CAP_MS) }} />
          {[...attempt.raw].map((key, index) => {
            const gap = index > 0 ? attempt.gapsMs[index - 1] : undefined;
            return (
              <View key={index} className="w-6 items-center gap-0.5">
                <View className="items-center justify-end" style={{ height: BAR_HEIGHT_CAP_MS }}>
                  <View testID={gap === undefined ? undefined : `barcode-test-chart-bar-${index - 1}`}
                    className={`w-4 rounded-t-sm ${gap !== undefined && gap > threshold ? 'bg-warning' : 'bg-primary'}`}
                    style={{ height: Math.max(3, Math.min(gap ?? 0, BAR_HEIGHT_CAP_MS)) }} />
                </View>
                <Text className="font-mono text-xs text-foreground">{key}</Text>
                <Text testID={gap === undefined ? undefined : `barcode-test-chart-gap-${index - 1}`} className={SETTINGS_HELP_CLASS}>
                  {gap === undefined ? '—' : String(gap)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Text testID="barcode-test-chart-legend" className={SETTINGS_HELP_CLASS}>
        {`Dashed line = your ${threshold}ms threshold — amber bars exceed it`}</Text>
    </View>
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
      {/* v2 test-panel.tsx:171-177: the chart sits between the Detected Barcode box and the verdict. */}
      <TimingChart attempt={attempt} threshold={settings.threshold} />
      {attempt && <View className="flex-row items-center gap-2">
        <Badge testID="barcode-test-result" variant={RESULT_VARIANTS[attempt.result]} label={RESULT_WORDS[attempt.result]} />
        {/* v2 test-panel.tsx:226-240: a scan is the success check and a subheading, then its timing as help. */}
        {detected && <CheckIcon testID="barcode-test-scan-check" size={16} className="text-success" />}
        {/* v2 test-panel.tsx:241-242: a near miss is a warning Notice in place of the plain line. */}
        {nearMiss(attempt) ? <WarningNotice testID="barcode-test-near-miss" className="flex-1" title={verdict(attempt, settings.threshold)} />
          : <Text testID="barcode-test-verdict" className={`flex-1 ${detected ? 'text-base font-medium text-foreground' : 'text-sm text-muted-foreground'}`}>{verdict(attempt, settings.threshold)}</Text>}
      </View>}
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
      {/* v2 test-panel.tsx:257-268, analyze-trace.ts:57-60: Shift sent as separate keys, then a trailing Enter. */}
      {attempt && attempt.shiftKeys >= 2 && <WarningNotice testID="barcode-test-shift-mangled" title="Scanner is sending Shift as separate keys"
        description="Reconfigure it to a US-keyboard / no-modifier mode." />}
      {attempt?.trailingEnter && <Text testID="barcode-test-trailing-enter" className={SETTINGS_HELP_CLASS}>Trailing Enter detected and ignored — no suffix needed</Text>}
      {attempts.length > 0 && <RecentAttempts attempts={attempts} />}
      {/* v2 test-panel.tsx:185-187: the troubleshooting link closes the panel, before any attempt too. */}
      <DocsLink testID="barcode-test-docs-link" href={SCAN_TEST_DOCS_URL}>Troubleshooting guide</DocsLink>
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

// v2 barcode-scanning/settings.tsx:100-111: after a write, mark the keys it really changed; a write that changes nothing marks nothing.
function useMarked<T extends object>([value, update]: [T, (patch: Partial<T>) => void]): [T, (patch: Partial<T>) => void] {
  const markSaved = useMarkSaved();
  return [value, patch => { update(patch); markSaved(savedKeys(value, patch)); }];
}

function PreviewButton({ testID, label, glyph, onPress }: { testID: string; label: string; glyph: string; onPress(): void }) {
  return <Button variant="outline" size="sm" testID={testID} accessibilityLabel={label} onPress={onPress}><Text>{glyph}</Text></Button>;
}

// v2 barcode-scanning/settings.tsx, the Sound section. The haptic switch is native-only and this app is web-first.
function SoundSettings(): JSX.Element {
  const [sound, update] = useMarked(useScanSoundSettings());
  // Previews ignore the success/failure switches, as v2's do.
  const preview = (kind: 'success' | 'failure', theme: ScanSoundTheme) => playScanTone(kind, { theme, volume: sound.volume });
  return (
    <SettingsSection title="Sound" testID="settings-barcode-sound-group">
      <SettingsField name="enabled" testID="settings-barcode-sound-row" label="Play a sound on scan">
        <Switch size="sm" testID="settings-barcode-sound" accessibilityLabel="Play a sound on scan" checked={sound.enabled}
          onCheckedChange={enabled => update({ enabled })} />
      </SettingsField>
      {sound.enabled && (
        <View testID="scan-sound-options">
          <View testID="settings-barcode-sound-theme-row" className="gap-1 py-1">
            <View className="flex-row items-center gap-x-2">
              <Text testID="settings-barcode-sound-theme-row-label" className={`${SETTINGS_KEY_CLASS} pl-4`}>Sound theme</Text>
              <SavedMark name="theme" />
            </View>
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
          <SettingsField indent name="volume" testID="settings-barcode-sound-volume-row" label="Volume" trailing={
            <PreviewButton testID="sound-preview-volume" label="Preview success sound" glyph="▶"
              onPress={() => preview('success', sound.theme)} />
          }>
            <View className="w-full px-2">
              <Slider testID="settings-barcode-sound-volume" aria-label="Volume" value={sound.volume}
                min={MIN_SCAN_SOUND_VOLUME} max={MAX_SCAN_SOUND_VOLUME} step={0.05} onValueChange={volume => update({ volume })} />
            </View>
          </SettingsField>
          <SettingsField indent name="success" testID="settings-barcode-sound-success-row" label="Success sound">
            <Switch size="sm" testID="settings-barcode-sound-success" accessibilityLabel="Success sound" checked={sound.success}
              onCheckedChange={success => update({ success })} />
          </SettingsField>
          <SettingsField indent name="failure" testID="settings-barcode-sound-failure-row" label="Failure sound">
            <Switch size="sm" testID="settings-barcode-sound-failure" accessibilityLabel="Failure sound" checked={sound.failure}
              onCheckedChange={failure => update({ failure })} />
          </SettingsField>
        </View>
      )}
    </SettingsSection>
  );
}

// v2 input-sources.tsx scannerStatus() l.76-99 and the type and status words (core.json settings.scanner_*).
const TYPE_LABEL: Record<ScannerProfile['connectionType'], string> = {
  keyboard: 'Keyboard mode', 'usb-serial': 'USB', 'bluetooth-spp': 'Bluetooth serial', 'bluetooth-le': 'Bluetooth', 'hid-pos': 'HID POS',
};
function scannerStatus(type: ScannerProfile['connectionType'], live: boolean): string {
  if (type === 'keyboard') return 'Registered';
  if (live) return 'Connected';
  return type === 'usb-serial' ? 'Not plugged in' : type === 'bluetooth-spp' || type === 'bluetooth-le' ? 'Not in range' : 'Not connected';
}

// v2 input-sources.tsx ScannerProfileRow l.101-174: name, `type · vendor:product`, a status muted unless live, a ⋮ with Remove.
function ScannerProfileRow({ profile, live, first, onRemove }: { profile: ScannerProfile; live: boolean; first: boolean; onRemove(): void }): JSX.Element {
  const type = TYPE_LABEL[profile.connectionType];
  const detail = profile.vendorId !== undefined && profile.productId !== undefined ? `${profile.vendorId}:${profile.productId}` : profile.serviceUuid;
  return (
    <View testID="scanner-profile-row" className={`flex-row items-center gap-3 py-3 ${first ? '' : 'border-t border-border'}`}>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-base text-foreground" numberOfLines={1}>{profile.name || profile.deviceName || type}</Text>
        <Text className={SETTINGS_KEY_CLASS} numberOfLines={1}>{[type, detail].filter(Boolean).join(' · ')}</Text>
      </View>
      <Text testID="scanner-profile-status" className={`text-sm ${live ? 'text-success' : 'text-muted-foreground'}`}>{scannerStatus(profile.connectionType, live)}</Text>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton testID="scanner-profile-menu" accessibilityLabel="Actions" className="h-11 w-11">
            <MoreIcon size={18} strokeWidth={1.5} className="text-muted-foreground" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem testID="scanner-profile-delete" onPress={onRemove}><Text className="text-destructive">Remove</Text></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </View>
  );
}

// v2 input-sources.tsx:177-211 and 223-460 (InputSources): saved scanners stay on the page; connecting one is the Direct
// connection sheet's. The keyboard register flow, BLE and UUID entry and the device chooser are not ported.
function ScannerSection(): JSX.Element {
  const collection = useCatalogue().catalogue?.scannerProfiles;
  const [profiles, setProfiles] = useState<ScannerProfile[]>([]);
  useEffect(() => {
    if (!collection) return;
    const sub = scannerProfiles$(collection).subscribe(setProfiles);
    return () => sub.unsubscribe();
  }, [collection]);
  const { hid, serial } = useDeviceScanControls();
  const [open, setOpen] = useState(false);
  const live = new Set([hid.connectedDeviceKey, serial.connectedDeviceKey]);
  const none = profiles.length === 0;
  const verb = none ? 'Connect a scanner directly (advanced)' : 'Connect another scanner (advanced)';
  return (
    <SettingsSection title="Scanner" testID="barcode-input-sources" description={none
      ? 'Almost all barcode scanners pair as a Bluetooth or USB keyboard. Pair it in your device’s settings, then scan into the POS — the app recognises the scan automatically.' : undefined}>
      <View className="gap-2 pt-1">
        {/* v2's `subheading` rank (text/ladder.ts:12, text-base font-ui). */}
        {none && <Text testID="scanner-no-setup-needed" className="text-base font-medium text-foreground">No setup needed for most scanners.</Text>}
        {profiles.length > 0 && <View>{profiles.map((profile, index) => <ScannerProfileRow key={profile.deviceKey} profile={profile} first={index === 0}
          live={live.has(profile.deviceKey)} onRemove={() => { if (collection) void removeScannerProfile(collection, profile.deviceKey); }} />)}</View>}
        {!none && <Text testID="scanner-registered-hint" className={SETTINGS_HELP_CLASS}>Scans from these devices are captured directly, with no typing-speed guesswork. Keyboard-mode scanners still work alongside them — those need no setup.</Text>}
        <DocsLink testID="scanner-setup-guide-link" href={SCANNER_DOCS_URL}>Scanner setup guide</DocsLink>
        {collection && (hid.available || serial.available) && (
          <SettingsField testID="scanner-row-direct" label="Direct connection" trailing={
            <Button testID="scanner-advanced-trigger" variant="link" size="sm" onPress={() => setOpen(true)}><Text>{verb}</Text></Button>}>
            {none ? <Text className="text-muted-foreground">None</Text> : null}
          </SettingsField>
        )}
      </View>
      {open && <Dialog open onOpenChange={next => { if (!next) setOpen(false); }}>
        <DialogContent testID="scanner-advanced-content" className={RIGHT_SHEET}>
          <View className="pl-4 pr-11"><DialogTitle className={SHEET_TITLE}>{verb}</DialogTitle></View>
          <View className="absolute right-1 top-1">
            <IconButton variant="ghost" className="h-11 w-11" accessibilityLabel="Close" onPress={() => setOpen(false)}><XIcon size={18} /></IconButton>
          </View>
          <ScrollView className="flex-1" contentContainerClassName="gap-2 px-4 py-1">
            <Text className={SETTINGS_HELP_CLASS}>A direct connection identifies scans by the device itself instead of by typing speed. The scanner must first be switched out of keyboard mode using a barcode from its manual.</Text>
            <View className="flex-row flex-wrap gap-2">
              {hid.available && <Button testID="hid-connect-button" variant="outline" size="sm" onPress={() => void (hid.connected ? hid.disconnect() : hid.connect())}>
                <Text>{hid.connected ? 'Disconnect USB scanner' : 'Connect over USB'}</Text></Button>}
              {serial.available && <Button testID="serial-connect-button" variant="outline" size="sm" onPress={() => void (serial.connected ? serial.disconnect() : serial.connect())}>
                <Text>{serial.connected ? 'Disconnect Bluetooth serial scanner' : 'Connect over Bluetooth serial'}</Text></Button>}
            </View>
            <Text testID="scanner-keyboard-wall-note" className={SETTINGS_HELP_CLASS}>Scanners in keyboard mode can’t be connected to directly — that’s an operating-system restriction, not a POS one. They still scan into the POS normally.</Text>
          </ScrollView>
          <View className="flex-row justify-end border-t border-border px-4 pt-4"><SheetCloseButton testID="scanner-advanced-close" onPress={() => setOpen(false)} /></View>
        </DialogContent>
      </Dialog>}
    </SettingsSection>
  );
}

export const BarcodeScanningSettings = (): JSX.Element => <SavedFieldProvider><BarcodeScanningPage /></SavedFieldProvider>;

function BarcodeScanningPage(): JSX.Element {
  const [settings, update] = useMarked(useScanSettings());
  return (
    <View testID="screen-settings-barcode-scanning" className="gap-5">
      <SettingsSection first title="Scanning" testID="settings-barcode-scanning-group">
        <SettingsField name="threshold" testID="settings-barcode-threshold-row" label="Barcode Average Time Input Threshold (ms)">
          <CountField testID="settings-barcode-threshold" label="Barcode Average Time Input Threshold (ms)"
            value={settings.threshold} onChange={threshold => update({ threshold })} />
        </SettingsField>
        <SettingsField name="minChars" testID="settings-barcode-min-chars-row" label="Barcode Minimum Length">
          <CountField testID="settings-barcode-min-chars" label="Barcode Minimum Length"
            value={settings.minChars} onChange={minChars => update({ minChars })} />
        </SettingsField>
        <SettingsField name="prefix" testID="settings-barcode-prefix-row" label="Barcode Scanner Prefix">
          <TextField testID="settings-barcode-prefix" label="Barcode Scanner Prefix"
            value={settings.prefix} onChange={prefix => update({ prefix })} />
        </SettingsField>
        <SettingsField name="suffix" testID="settings-barcode-suffix-row" label="Barcode Scanner Suffix">
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
