import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

// v2's `@layer base` (monorepo apps/main/global.css l.1458-1498): the body on the theme's background and ink, and
// thin scrollbars, a muted thumb on a card track, read from the active theme's colour vars.
const globalCss = readFileSync(resolve(process.cwd(), 'apps/pos/global.css'), 'utf8');

/** The body of the first block that opens with `opener` (which ends in `{`), or '' when there is none. */
function block(css: string, opener: string): string {
  const start = css.indexOf(opener);
  if (start === -1) return '';
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index++) {
    if (css[index] === '{') depth++;
    if (css[index] === '}' && --depth === 0) return css.slice(open + 1, index);
  }
  return '';
}

const baseLayer = (css: string): string => block(css, '@layer base {').replace(/\/\*[\s\S]*?\*\//g, '');

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The declarations of the rule whose selector is exactly `selector`, or undefined when there is none. */
function rule(css: string, selector: string): Record<string, string> | undefined {
  const match = new RegExp(`(?:^|\\n)\\s*${escape(selector)}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) return undefined;
  return Object.fromEntries(
    [...match[1].matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)].map(([, property, value]) => [property, value.trim()]),
  );
}

const base = baseLayer(globalCss);

test("the body sits on the theme's background and ink, as v2's base layer (l.1467-1470)", () => {
  expect(rule(base, 'body')).toEqual({ 'background-color': 'var(--color-background)', color: 'var(--color-foreground)' });
});

test("every element gets v2's thin scrollbar, a muted thumb on a card track (l.1473-1477)", () => {
  expect(rule(base, '*')).toEqual({ 'scrollbar-color': 'var(--color-muted) var(--color-card)', 'scrollbar-width': 'thin' });
});

test('the webkit scrollbar is 8 px, a muted thumb on a card track, muted-foreground on hover (l.1480-1497)', () => {
  expect(rule(base, '::-webkit-scrollbar')).toEqual({ width: '8px', height: '8px' });
  expect(rule(base, '::-webkit-scrollbar-track')).toEqual({ background: 'var(--color-card)', 'border-radius': '4px' });
  expect(rule(base, '::-webkit-scrollbar-thumb')).toEqual({ background: 'var(--color-muted)', 'border-radius': '4px' });
  expect(rule(base, '::-webkit-scrollbar-thumb:hover')).toEqual({ background: 'var(--color-muted-foreground)' });
  expect(rule(base, '::-webkit-scrollbar-corner')).toEqual({ background: 'var(--color-card)' });
});

test('every colour the base layer reads is defined by both the light and the dark theme', () => {
  const read = [...new Set([...base.matchAll(/var\((--color-[a-z-]+)\)/g)].map(([, name]) => name))];
  expect([...read].sort()).toEqual(
    ['--color-background', '--color-card', '--color-foreground', '--color-muted', '--color-muted-foreground'].sort(),
  );
  for (const theme of ['light', 'dark']) {
    const variant = block(globalCss, `@variant ${theme} {`);
    for (const name of read) expect(variant, `${theme} ${name}`).toMatch(new RegExp(`${escape(name)}\\s*:`));
  }
});
