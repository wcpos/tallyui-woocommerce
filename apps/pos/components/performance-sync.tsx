import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Label, RadioGroup, RadioGroupItem, Slider, Text } from '@tallyui/components';
import {
  requestsPerHour, resetSyncCadence, setSyncCadence, SYNC_CADENCE_LIMITS, SYNC_CADENCE_PRESETS, syncCadence$,
  syncCadencePresetBudget, syncCadencePresetFor,
  type SyncCadence, type SyncCadenceCollection, type SyncCadencePreset, type SyncCadenceRunner,
} from '@tallyui/database';
import { formatCadence } from '../lib/health/performance';
import { HealthSection } from './performance-screen';

// v2 core.json health.performance.* copy.
const PRESET_CARDS: { name: SyncCadencePreset; title: string; hint: string }[] = [
  { name: 'eco', title: 'Eco', hint: 'Gentlest on your server' },
  { name: 'balanced', title: 'Balanced', hint: 'Recommended for most stores' },
  { name: 'realtime', title: 'Realtime', hint: 'Fastest updates' },
];

// v2 persistDebounced: the slider shows its value at once, and the write lands once the hand settles.
const SLIDER_SETTLE_MS = 400;

/** The card's cadence, straight off the preset table so it can never drift from what the radio applies (v2 describeCadence). */
function presetCadence(name: SyncCadencePreset): string {
  const { intervalSeconds } = syncCadencePresetBudget(name);
  return intervalSeconds >= 60 ? `Checks every ${intervalSeconds / 60} min` : `Checks every ${intervalSeconds} s`;
}

/** The interval slider's readout, always in whole seconds as in v2 (health.performance.every_s): Eco reads "every 300 s". */
function intervalReadout(ms: number): string {
  return `every ${Math.round(ms / 1000)} s`;
}

function SliderRow({ testID, label, readout, readoutTestID, ends, ...slider }: {
  testID: string; label: string; readout: string; readoutTestID: string; ends: [string, string];
  value: number; min: number; max: number; step: number; onValueChange: (value: number) => void;
}) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm text-muted-foreground">{label}</Text>
        <Text testID={readoutTestID} className="font-semibold text-primary">{readout}</Text>
      </View>
      <Slider testID={testID} aria-label={label} {...slider} />
      <View className="flex-row justify-between">
        <Text className="text-xs text-muted-foreground">{ends[0]}</Text>
        <Text className="text-xs text-muted-foreground">{ends[1]}</Text>
      </View>
    </View>
  );
}

/**
 * Store health › Performance › Sync (v2 apps/main/components/health/performance-screen.tsx): the presets, the two
 * dials and the math line. A changed page size applies from the next start of the catalogue (TallyUI's
 * startReplication fixes it at start); the check interval applies at once.
 */
export function PerformanceSync({ collection, runner, now = Date.now }: {
  collection: SyncCadenceCollection; runner: SyncCadenceRunner; now?: () => number;
}) {
  const [stored, setStored] = useState<SyncCadence>(SYNC_CADENCE_PRESETS.balanced);
  const [draft, setDraft] = useState<SyncCadence | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [nextDueAtMs, setNextDueAtMs] = useState<number | undefined>(undefined);
  const [nowMs, setNowMs] = useState(now);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The latest draft, so quick slider steps build on each other and a settled write only clears its own draft.
  const pending = useRef<SyncCadence | null>(null);

  useEffect(() => {
    const subscription = syncCadence$(collection).subscribe(setStored);
    return () => subscription.unsubscribe();
  }, [collection]);
  useEffect(() => {
    // The countdown rides the runner's re-arms, and a slow tick keeps it current in between (v2's 10 s snapshot clock).
    const subscription = runner.nextDueAtMs$.subscribe(next => { setNextDueAtMs(next); setNowMs(now()); });
    const interval = setInterval(() => setNowMs(now()), 10_000);
    return () => { subscription.unsubscribe(); clearInterval(interval); };
  }, [runner, now]);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);

  const shown = draft ?? stored;
  const choice = syncCadencePresetFor(shown);

  // A failed write keeps the stored value: the draft clears either way and the error line says so.
  const save = (write: () => Promise<unknown>, written: SyncCadence | null) => {
    write().then(() => setSaveFailed(false), () => setSaveFailed(true)).finally(() => {
      if (pending.current === written) { pending.current = null; setDraft(null); }
    });
  };
  // Cancel any pending slider write so a stale draft cannot overwrite the preset just applied (v2 applyPreset).
  const dropDraft = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    setDraft(null);
  };
  const applyPreset = (name: string) => {
    dropDraft();
    save(() => setSyncCadence(collection, name as SyncCadencePreset), null);
  };
  const reset = () => {
    dropDraft();
    save(() => resetSyncCadence(collection), null);
  };
  const slide = (change: Partial<SyncCadence>) => {
    const next = { ...(pending.current ?? stored), ...change };
    pending.current = next;
    setDraft(next);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      save(() => setSyncCadence(collection, next), next);
    }, SLIDER_SETTLE_MS);
  };

  const nextCheck = nextDueAtMs === undefined ? null : formatCadence(nextDueAtMs - nowMs);
  const rightNow = nextCheck ? `Right now: next check in ~${nextCheck.value} ${nextCheck.unit} · ` : '';
  const { checkIntervalMs, pullBatchSize } = SYNC_CADENCE_LIMITS;

  return (
    <HealthSection testID="sync-section" title={choice === 'custom' ? 'Sync · Custom' : 'Sync'}
      sub="How often this till checks your website for changes.">
      <View className="gap-5">
        <RadioGroup value={choice === 'custom' ? '' : choice} onValueChange={applyPreset}>
          <View className="flex-row flex-wrap gap-3">
            {PRESET_CARDS.map(({ name, title, hint }) => (
              <Pressable key={name} testID={`preset-${name}`} onPress={() => applyPreset(name)}
                className={`min-w-40 flex-1 rounded-lg border p-3 ${choice === name ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <View className="flex-row items-center gap-2">
                  <RadioGroupItem value={name} aria-label={title} />
                  <Label className="font-medium">{title}</Label>
                </View>
                <View className="gap-0.5 pt-1.5">
                  <Text className="text-sm">{hint}</Text>
                  <Text className="text-xs text-muted-foreground">{presetCadence(name)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </RadioGroup>
        <SliderRow testID="check-interval-slider" label="Check for changes" readoutTestID="check-interval-value"
          readout={intervalReadout(shown.checkIntervalMs)} ends={['5 s', '5 min']}
          value={shown.checkIntervalMs} min={checkIntervalMs.min} max={checkIntervalMs.max} step={5000}
          onValueChange={value => slide({ checkIntervalMs: value })} />
        <SliderRow testID="pull-batch-slider" label="Records per request" readoutTestID="pull-batch-value"
          readout={`up to ${shown.pullBatchSize}`} ends={['10', '100']}
          value={shown.pullBatchSize} min={pullBatchSize.min} max={pullBatchSize.max} step={5}
          onValueChange={value => slide({ pullBatchSize: value })} />
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <Text testID="settings-math-line" className="text-sm text-muted-foreground">
            {`${rightNow}At these settings: ~${requestsPerHour(shown.checkIntervalMs)} requests per hour`}
          </Text>
          <Button testID="performance-reset" variant="outline" size="sm" onPress={reset}
            disabled={choice === 'balanced' && draft === null}>
            <Text>Reset to Balanced</Text>
          </Button>
        </View>
        {saveFailed ? <Text testID="sync-save-error" className="text-sm text-destructive">Couldn’t save the sync setting.</Text> : null}
      </View>
    </HealthSection>
  );
}
