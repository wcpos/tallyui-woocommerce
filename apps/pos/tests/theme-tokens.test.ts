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
  expect(lightNames).toHaveLength(40); // 38 plus v2's --selected pair (apps/main/global.css l.400-401)
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

/** The top-level blocks of `css` as [prelude, body] pairs, comments stripped. */
function blocks(css: string): [string, string][] {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found: [string, string][] = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let index = 0; index < body.length; index++) {
    if (body[index] === '{' && depth++ === 0) open = index;
    if (body[index] === '}' && --depth === 0) {
      found.push([body.slice(start, open).trim(), body.slice(open + 1, index)]);
      start = index + 1;
    }
  }
  return found;
}

// On web, uniwind 1.4.0 rewrites a theme's first `&:where(.x, .x *)` rule to `.x` (css-visitor/rule-visitor.ts),
// dropping only the `&`: under a `:root` parent that is `:root .x`, which misses the class uniwind sets on <html>.
test('each extra theme is a @variant directly in @layer theme, never nested in :root', () => {
  const [layer, ...rest] = blocks(themesCss);
  expect(rest).toEqual([]);
  expect(layer[0]).toBe('@layer theme');
  const children = blocks(layer[1]);
  expect(children.map(([prelude]) => prelude)).toEqual(EXTRA_THEMES.map(theme => `@variant ${theme}`));
  for (const [prelude, body] of children) expect(body, prelude).not.toMatch(/[{}]/);
  expect(themesCss.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain(':root');
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

/** The `--name: value;` declarations of every `@theme …` block in global.css, in order (later wins, as in Tailwind). */
function themeTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const block of body.matchAll(/@theme(?:\s+inline)?\s*\{([^}]*)\}/g)) {
    for (const [, name, raw] of block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) tokens.set(name, raw.trim());
  }
  return tokens;
}

/** A ramp value in px: a px literal, or v2's `calc(var(--text-base) * k …)` worked out against the tokens. */
function px(tokens: Map<string, string>, name: string): number | undefined {
  const raw = tokens.get(name);
  if (raw === undefined) return undefined;
  const literal = /^([\d.]+)px$/.exec(raw);
  if (literal) return Number(literal[1]);
  const calc = /^calc\(var\((--[a-z0-9-]+)\)((?:\s*\*\s*[\d.]+)+)\)$/.exec(raw);
  if (!calc) return undefined;
  const base = px(tokens, calc[1]);
  if (base === undefined) return undefined;
  return [...calc[2].matchAll(/[\d.]+/g)].reduce((product, factor) => product * Number(factor[0]), base);
}

const LIGHT_DESTRUCTIVE = 'oklch(0.52 0.22 25)';    // v2 apps/main/global.css l.381
const LIGHT_DESTRUCTIVE_FG = 'oklch(0.99 0.01 25)'; // l.382
const DARK_DESTRUCTIVE = 'oklch(0.67 0.2 25)';      // l.526
const DARK_DESTRUCTIVE_FG = 'oklch(0.15 0.02 25)';  // l.527

test("global.css takes v2's type ramp: a 14 px base, sm 13 px, xs 12 px, each with a 1.35 line", () => {
  const tokens = themeTokens(globalCss);
  expect(tokens.get('--text-base')).toBe('14px');
  expect(tokens.get('--text-xs')).toBe('12px');
  expect(tokens.get('--text-2xs')).toBe('11px');
  expect(Math.round(px(tokens, '--text-sm')!)).toBe(13);
  expect(Math.round(px(tokens, '--text-lg')!)).toBe(16);
  expect(Math.round(px(tokens, '--text-xl')!)).toBe(18);
  expect(Math.round(px(tokens, '--text-2xl')!)).toBe(21);
  expect(Math.round(px(tokens, '--text-3xl')!)).toBe(26);
  for (const size of ['2xs', 'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl']) {
    const ratio = px(tokens, `--text-${size}--line-height`)! / px(tokens, `--text-${size}`)!;
    expect(ratio, size).toBeCloseTo(1.35, 5);
  }
});

test("the light and dark themes take v2's destructive, over @tallyui/theme's #dc2626", () => {
  const light = Object.fromEntries(declarations(variantBlock(globalCss, 'light')));
  const dark = Object.fromEntries(declarations(variantBlock(globalCss, 'dark')));
  expect(light['--color-destructive']).toBe(LIGHT_DESTRUCTIVE);
  expect(light['--color-destructive-foreground']).toBe(LIGHT_DESTRUCTIVE_FG);
  expect(dark['--color-destructive']).toBe(DARK_DESTRUCTIVE);
  expect(dark['--color-destructive-foreground']).toBe(DARK_DESTRUCTIVE_FG);
  // The theme default (no variant) is the light one, so a utility outside a theme scope gets it too.
  expect(themeTokens(globalCss).get('--color-destructive')).toBe(LIGHT_DESTRUCTIVE);
  expect(themeTokens(globalCss).get('--color-destructive-foreground')).toBe(LIGHT_DESTRUCTIVE_FG);
});

const RAIL_TOKENS = ['--color-rail', '--color-rail-foreground', '--color-rail-border', '--color-rail-selected', '--color-rail-selected-foreground'];

test("light, dark and the seven extra themes all define v2's five rail tokens, and the default is light's", () => {
  const sources: [string, string][] = [['light', globalCss], ['dark', globalCss], ...EXTRA_THEMES.map(theme => [theme, themesCss] as [string, string])];
  for (const [theme, css] of sources) {
    const declared = Object.fromEntries(declarations(variantBlock(css, theme)));
    for (const name of RAIL_TOKENS) expect(declared[name], `${theme} ${name}`).toMatch(/^(oklch\(|var\(--color-card\)$)/);
  }
  // v2 apps/main/global.css l.427 (light rail), l.431 (light rail-selected: var(--card)), l.708 (ocean rail).
  expect(themeTokens(globalCss).get('--color-rail')).toBe('oklch(0.935 0.016 262)');
  expect(themeTokens(globalCss).get('--color-rail-selected')).toBe('var(--color-card)');
  expect(value('ocean', '--color-rail')).toBe('oklch(0.14 0.045 235)');
});

test('light, dark and the seven extra themes all define the destructive pair', () => {
  const sources: [string, string][] = [['light', globalCss], ['dark', globalCss], ...EXTRA_THEMES.map(theme => [theme, themesCss] as [string, string])];
  for (const [theme, css] of sources) {
    const declared = Object.fromEntries(declarations(variantBlock(css, theme)));
    expect(declared['--color-destructive'], theme).toMatch(/^oklch\(/);
    expect(declared['--color-destructive-foreground'], theme).toMatch(/^oklch\(/);
  }
});

// v2 apps/main/global.css: `@variant light` l.345-396, `@variant dark` l.498-539; sale is v2's destructive.
const V2_PALETTE: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    '--color-primary': 'oklch(0.42 0.24 262)', '--color-background': 'oklch(0.97 0.005 262)', '--color-card': 'oklch(1 0 0)',
    '--color-muted-foreground': 'oklch(0.45 0.01 262)', '--color-border': 'oklch(0.885 0.01 262)', '--color-sale': LIGHT_DESTRUCTIVE,
  },
  dark: {
    '--color-primary': 'oklch(0.70 0.17 240)', '--color-background': 'oklch(0.19 0.018 250)', '--color-card': 'oklch(0.23 0.018 250)',
    '--color-muted-foreground': 'oklch(0.70 0.015 250)', '--color-border': 'oklch(0.33 0.02 250)', '--color-sale': DARK_DESTRUCTIVE,
  },
};

test("the light and dark themes take v2's palette, with sale as v2's destructive, and the default is light", () => {
  for (const theme of ['light', 'dark'] as const) {
    const declared = Object.fromEntries(declarations(variantBlock(globalCss, theme)));
    for (const [name, expected] of Object.entries(V2_PALETTE[theme])) expect(declared[name], `${theme} ${name}`).toBe(expected);
  }
  const tokens = themeTokens(globalCss);
  for (const [name, expected] of Object.entries(V2_PALETTE.light)) expect(tokens.get(name), `default ${name}`).toBe(expected);
});
