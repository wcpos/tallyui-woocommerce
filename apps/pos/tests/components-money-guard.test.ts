// H4b part 2 (g): every money display a component formats goes through useFormatMoney(), bound to the store's money
// format (v2 hooks/use-currency-format.tsx:21-60), so no component imports core's unbound formatMoney.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { expect, test } from 'vitest';

const COMPONENTS = resolve(process.cwd(), 'apps/pos/components');
// Files allowed to import core's formatMoney, each with its reason. None today.
const EXCLUDED: Record<string, string> = {};
const CORE_FORMAT_MONEY = /import\s*(?:type\s*)?\{[^}]*\bformatMoney\b[^}]*\}\s*from\s*['"]@tallyui\/core['"]/;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? sources(join(dir, entry.name))
    : /\.(ts|tsx)$/.test(entry.name) ? [join(dir, entry.name)] : []);
}

test('(g) no component imports formatMoney from @tallyui/core', () => {
  const files = sources(COMPONENTS);
  expect(files.length).toBeGreaterThan(50);
  const offenders = files.map(file => relative(COMPONENTS, file))
    .filter(file => !(file in EXCLUDED) && CORE_FORMAT_MONEY.test(readFileSync(join(COMPONENTS, file), 'utf8')));
  expect(offenders).toEqual([]);
});
