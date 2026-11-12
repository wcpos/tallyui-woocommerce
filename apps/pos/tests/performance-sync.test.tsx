// Store health › Performance › Sync: the presets, the two dials and the math line (v2 performance-screen.tsx).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { addSyncCadenceCollection, readSyncCadence, type SyncCadenceCollection } from '@tallyui/database';
import { PortalHost } from '@tallyui/primitives';
import { PerformanceSync } from '../components/performance-sync';
import { classesOf } from './classes-of';

let db: RxDatabase;
let collection: SyncCadenceCollection;
let runner: { nextDueAtMs$: BehaviorSubject<number | undefined>; tickNow: () => void; stop: () => void };
beforeEach(async () => {
  db = await createRxDatabase({ name: `performance_sync_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  collection = await addSyncCadenceCollection(db);
  runner = { nextDueAtMs$: new BehaviorSubject<number | undefined>(Date.now() + 42_000), tickNow: vi.fn(), stop: vi.fn() };
});
afterEach(async () => { vi.useRealTimers(); cleanup(); await db.close(); });

const renderSync = () => render(<><PerformanceSync collection={collection} runner={runner} /><PortalHost /></>);
const text = (testID: string) => screen.getByTestId(testID).textContent;
const title = () => within(screen.getByTestId('sync-section')).getAllByText(/^Sync/)[0]!.textContent;

test('by default Balanced is selected, with v2\'s readouts and math line', async () => {
  renderSync();
  expect(classesOf('preset-balanced')).toEqual(expect.arrayContaining(['border-primary', 'bg-primary/5']));
  expect(classesOf('preset-eco')).toContain('border-border');
  expect(classesOf('preset-eco')).not.toContain('border-primary');
  expect(title()).toBe('Sync');
  expect(text('check-interval-value')).toBe('every 60 s');
  expect(text('pull-batch-value')).toBe('up to 50');
  expect(text('settings-math-line')).toBe('Right now: next check in ~42 s · At these settings: ~60 requests per hour');
  expect(screen.getByText('Gentlest on your server')).not.toBeNull();
  expect(screen.getByText('Checks every 5 min')).not.toBeNull();
  expect(screen.getByText('Checks every 10 s')).not.toBeNull();
  expect(screen.queryByTestId('sync-save-error')).toBeNull();
  await waitFor(async () => expect((await readSyncCadence(collection)).preset).toBe('balanced'));
});

test('pressing Eco stores the preset and moves both dials', async () => {
  renderSync();
  fireEvent.click(screen.getByTestId('preset-eco'));
  await vi.waitFor(async () => expect((await readSyncCadence(collection)).preset).toBe('eco'));
  await waitFor(() => expect(text('check-interval-value')).toBe('every 300 s'));
  expect(text('pull-batch-value')).toBe('up to 25');
  expect(text('settings-math-line')).toContain('~12 requests per hour');
  expect(classesOf('preset-eco')).toContain('border-primary');
  expect(classesOf('preset-balanced')).not.toContain('border-primary');
});

test('a slider step shows at once, retitles the section Custom, and is stored once the hand settles', async () => {
  renderSync();
  await waitFor(() => expect(text('check-interval-value')).toBe('every 60 s'));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const thumb = within(screen.getByTestId('check-interval-slider')).getByRole('slider');
  thumb.focus();
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  expect(text('check-interval-value')).toBe('every 65 s');
  expect(title()).toBe('Sync · Custom');
  expect(classesOf('preset-balanced')).not.toContain('border-primary');
  expect(text('settings-math-line')).toContain('~55 requests per hour');
  await vi.advanceTimersByTimeAsync(399);
  expect((await readSyncCadence(collection)).preset).toBe('balanced');
  await vi.advanceTimersByTimeAsync(1);
  vi.useRealTimers();
  await vi.waitFor(async () => expect(await readSyncCadence(collection))
    .toEqual({ preset: 'custom', checkIntervalMs: 65_000, pullBatchSize: 50 }));
  await waitFor(() => expect(screen.getByTestId('performance-reset').getAttribute('aria-disabled')).not.toBe('true'));
  expect(text('check-interval-value')).toBe('every 65 s');
});

test('Reset to Balanced brings the stored preset back from Eco', async () => {
  renderSync();
  fireEvent.click(screen.getByTestId('preset-eco'));
  await vi.waitFor(async () => expect((await readSyncCadence(collection)).preset).toBe('eco'));
  await waitFor(() => expect(text('settings-math-line')).toMatch(/~12 requests per hour$/));
  fireEvent.click(screen.getByTestId('performance-reset'));
  await vi.waitFor(async () => expect((await readSyncCadence(collection)).preset).toBe('balanced'));
  await waitFor(() => expect(text('settings-math-line')).toMatch(/~60 requests per hour$/));
  expect(classesOf('preset-balanced')).toContain('border-primary');
});
