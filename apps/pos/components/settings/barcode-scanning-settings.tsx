import { useState, type JSX } from 'react';
import { View } from 'react-native';
import { Badge, Input, SettingsGroup, SettingsRow, Text } from '@tallyui/components';
import { useScanSettings } from '../../lib/scan/scan-settings';
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

export function BarcodeScanningSettings(): JSX.Element {
  const [settings, update] = useScanSettings();
  return (
    <View testID="screen-settings-barcode-scanning" className="gap-5">
      <Text className="text-2xl font-semibold">Barcode Scanning</Text>
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
      <SettingsGroup title="Barcode Scanning Test" testID="settings-barcode-test"><ScanTestPanel /></SettingsGroup>
    </View>
  );
}
