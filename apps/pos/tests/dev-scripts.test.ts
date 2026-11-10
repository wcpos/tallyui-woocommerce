import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

// The SQLite worker and wasm are gitignored build outputs; Expo's dev server answers a missing worker URL with its
// HTML fallback, so every script that serves the app must build them first, the way `build` does.
const { scripts } = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};
const builder = (script: string): string => script.split(' && ')[0];

test('the web dev server builds the SQLite worker before it starts', () => {
  expect(scripts.web).toBe('tallyui-build-sqlite-worker public/ && expo start --web');
});

test('the dev server builds the SQLite worker before it starts', () => {
  expect(scripts.dev).toBe('tallyui-build-sqlite-worker public/ && expo start');
});

test('the dev servers build the worker the same way the web build does', () => {
  expect(builder(scripts.web)).toBe(builder(scripts.build));
  expect(builder(scripts.dev)).toBe(builder(scripts.build));
});
