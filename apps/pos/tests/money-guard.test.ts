// H4b money guard: every money string the app formats goes through lib/money/store-money.ts, which applies the store's
// format only to the store's own currency (v2 hooks/use-currency-format.tsx:21-60). So no other file under app/,
// components/ or lib/ imports core's formatMoney / useFormatMoney / useMoneyFormat, and none formats currency with Intl.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { expect, test } from 'vitest';

const POS = resolve(process.cwd(), 'apps/pos');
const ROOTS = ['app', 'components', 'lib'];
// Files allowed core's money formatters, each with its reason.
const ALLOWED_CORE_FORMATTERS: Record<string, string> = {
  'lib/money/store-money.ts': 'the one module that formats money, with the store-currency check',
};
// Files allowed `new Intl.NumberFormat(` with `style: 'currency'`, each with its reason. None today: closures-csv and
// sales-summary-print's count use Intl without a currency style.
const ALLOWED_INTL_CURRENCY: Record<string, string> = {};
const CORE_MONEY = new Set(['formatMoney', 'useFormatMoney', 'useMoneyFormat']);
// Core helpers that read Intl's symbol, never the store's: no app file imports them.
const DENIED_CORE = new Set(['useCurrencySymbol', 'currencySymbol']);
// Files allowed core's MoneyFormatProvider, each with its reason. Core applies the provider's format to any currency,
// so every other `@tallyui/components` money display gets its format through these two.
const ALLOWED_FORMAT_PROVIDERS: Record<string, string> = {
  'lib/sale/store-settings-context.tsx': 'the store-wide provider, from the signed-in store\'s settings',
  'lib/money/store-money-for.tsx': 'scopes it to one document\'s currency: the store\'s format only for the store\'s currency',
};
const CORE_IMPORT = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]@tallyui\/core['"]/g;
const POS_IMPORT = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]@tallyui\/pos['"]/g;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? sources(join(dir, entry.name))
    : /\.(ts|tsx)$/.test(entry.name) ? [join(dir, entry.name)] : []);
}

const files = ROOTS.flatMap(root => sources(join(POS, root))).map(file => relative(POS, file));
const read = (file: string) => readFileSync(join(POS, file), 'utf8');

// The imported names (before any `as`) of every `{ … } from '@tallyui/core'` import.
function coreImports(source: string): string[] {
  return [...source.matchAll(CORE_IMPORT)].flatMap(match => match[1].split(','))
    .map(spec => spec.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()).filter(Boolean);
}

function posImports(source: string): string[] {
  return [...source.matchAll(POS_IMPORT)].flatMap(match => match[1].split(','))
    .map(spec => spec.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()).filter(Boolean);
}

// The argument text of every `new Intl.NumberFormat(…)` call, parentheses balanced.
function intlCalls(source: string): string[] {
  const calls: string[] = [];
  for (let at = source.indexOf('new Intl.NumberFormat('); at >= 0; at = source.indexOf('new Intl.NumberFormat(', at + 1)) {
    let depth = 0;
    let end = at + 'new Intl.NumberFormat'.length;
    for (; end < source.length; end++) {
      if (source[end] === '(') depth++;
      else if (source[end] === ')' && --depth === 0) break;
    }
    calls.push(source.slice(at, end + 1));
  }
  return calls;
}

test('the guard reads the whole app', () => {
  expect(files.filter(file => file.startsWith('components/')).length).toBeGreaterThan(50);
  expect(files.filter(file => file.startsWith('app/')).length).toBeGreaterThan(5);
  expect(files.filter(file => file.startsWith('lib/')).length).toBeGreaterThan(50);
  expect(files).toContain('lib/money/store-money.ts');
});

test('the parsers catch what they guard', () => {
  expect(coreImports("import {\n  formatMoney as fm,\n  type Money,\n} from '@tallyui/core';")).toEqual(['formatMoney', 'Money']);
  expect(posImports("import { useSale, variantPriceLabel as vpl } from '@tallyui/pos';")).toEqual(['useSale', 'variantPriceLabel']);
  expect(intlCalls("new Intl.NumberFormat(locale, { style: 'currency', currency: c(x) }).format(1)"))
    .toEqual(["new Intl.NumberFormat(locale, { style: 'currency', currency: c(x) })"]);
});

test('only lib/money/store-money.ts imports formatMoney, useFormatMoney or useMoneyFormat from @tallyui/core', () => {
  const offenders = files.filter(file => !(file in ALLOWED_CORE_FORMATTERS)
    && coreImports(read(file)).some(name => CORE_MONEY.has(name)));
  expect(offenders).toEqual([]);
});

test('only store-settings-context.tsx and store-money-for.tsx import MoneyFormatProvider from @tallyui/core', () => {
  const users = files.filter(file => coreImports(read(file)).includes('MoneyFormatProvider'));
  expect(users.sort()).toEqual(Object.keys(ALLOWED_FORMAT_PROVIDERS).sort());
});

test('no file imports useCurrencySymbol or currencySymbol from @tallyui/core, or variantPriceLabel from @tallyui/pos', () => {
  const offenders = files.filter(file => {
    const source = read(file);
    return coreImports(source).some(name => DENIED_CORE.has(name)) || posImports(source).includes('variantPriceLabel');
  });
  expect(offenders).toEqual([]);
});

test('no file formats currency with Intl.NumberFormat', () => {
  const offenders = files.filter(file => !(file in ALLOWED_INTL_CURRENCY)
    && intlCalls(read(file)).some(call => /style\s*:\s*['"]currency['"]/.test(call)));
  expect(offenders).toEqual([]);
});
