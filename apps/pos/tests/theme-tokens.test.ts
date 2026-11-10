vi.mock('uniwind', () => ({ Uniwind: { setTheme: vi.fn() } }));
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, vi } from 'vitest';
import { THEME_CHOICES } from '../lib/theme/theme-setting';

const read = (file: string): string => readFileSync(resolve(process.cwd(), file), 'utf8');
const themesCss = read('apps/pos/themes.css');
const globalCss = read('apps/pos/global.css');
const tokensCss = read('apps/pos/node_modules/@tallyui/theme/src/tokens.css');
const EXTRA_THEMES = ['ocean', 'sunset', 'monochrome', 'paper', 'warm', 'bold', 'market'];

/** The body of the first `@variant <theme> { … }` block, or '' when there is none. */
function variantBlock(css: string, theme: string): string {
  const start = css.indexOf(`@variant ${theme} {`);
  if (start === -1) return '';
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index++) {
    if (css[index] === '{') depth++;
    if (css[index] === '}' && --depth === 0) return css.slice(open + 1, index);
  }
  return '';
}

function declarations(block: string): [string, string][] {
  const body = block.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...body.matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]);
}

const names = (block: string): string[] => declarations(block).map(([name]) => name);
const value = (theme: string, name: string): string | undefined =>
  Object.fromEntries(declarations(variantBlock(themesCss, theme)))[name];
const lightNames = [...new Set([...names(variantBlock(tokensCss, 'light')), ...names(variantBlock(globalCss, 'light'))])].sort();

test('every extra theme defines exactly the variables light defines, once each', () => {
  expect(lightNames).toHaveLength(33);
  expect(lightNames).toContain('--color-tile-tint-5');
  for (const theme of EXTRA_THEMES) {
    const declared = names(variantBlock(themesCss, theme));
    expect(declared.length, theme).toBe(new Set(declared).size);
    expect([...declared].sort(), theme).toEqual(lightNames);
  }
});

test('the extra themes carry the v2 colour values', () => {
  const expected: [string, string, string][] = [
    ['ocean', 'oklch(0.19 0.03 230)', 'oklch(0.72 0.15 195)'],
    ['sunset', 'oklch(0.20 0.035 318)', 'oklch(0.72 0.18 45)'],
    ['monochrome', 'oklch(0.15 0 0)', 'oklch(0.92 0 0)'],
    ['paper', 'oklch(0.948 0.016 83)', 'oklch(0.227 0.016 71)'],
    ['warm', 'oklch(0.965 0.007 81)', 'oklch(0.484 0.092 41)'],
    ['bold', 'oklch(0.985 0 0)', 'oklch(0.145 0 0)'],
    ['market', 'oklch(0.991 0.010 87)', 'oklch(0.686 0.205 34)'],
  ];
  for (const [theme, background, primary] of expected) {
    expect(value(theme, '--color-background'), theme).toBe(background);
    expect(value(theme, '--color-primary'), theme).toBe(primary);
  }
  expect(value('bold', '--color-accent')).toBe('oklch(0.97 0.07 123)');
  expect(value('market', '--color-tile-tint-0')).toBe('oklch(0.90 0.09 61)');
});

test('each extra theme maps input to border, price to success and sale to destructive', () => {
  for (const theme of EXTRA_THEMES) {
    expect(value(theme, '--color-input'), theme).toBe(value(theme, '--color-border'));
    expect(value(theme, '--color-price'), theme).toBe(value(theme, '--color-success'));
    expect(value(theme, '--color-sale'), theme).toBe(value(theme, '--color-destructive'));
  }
});

test('global.css imports themes.css right after the TallyUI tokens', () => {
  expect(globalCss).toContain("@import '@tallyui/theme/tokens.css';\n@import './themes.css';");
});

test('Metro registers each extra theme and the Uniwind types list them', () => {
  const metro = read('apps/pos/metro.config.js');
  const types = read('apps/pos/uniwind-types.d.ts');
  const quoted = (list: string | undefined): string[] => [...(list ?? '').matchAll(/'([a-z]+)'/g)].map(match => match[1]);
  expect(quoted(/extraThemes:\s*\[([^\]]*)\]/.exec(metro)?.[1])).toEqual(EXTRA_THEMES);
  expect(quoted(/themes: readonly \[([^\]]*)\]/.exec(types)?.[1])).toEqual(['light', 'dark', ...EXTRA_THEMES]);
  expect(THEME_CHOICES.filter(choice => !['system', 'light', 'dark'].includes(choice))).toEqual(EXTRA_THEMES);
});
