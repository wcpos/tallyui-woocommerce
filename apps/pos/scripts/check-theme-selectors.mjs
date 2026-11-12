// Fails unless the built web CSS gives each of the nine themes a rule that sets --color-primary and matches
// <html class="<theme>">, the element uniwind 1.4.0 puts the theme class on (src/components/web/rnw.ts:15-17).
// `:root .ocean` names a descendant of <html>, so it does not count. Usage, after `pnpm build`:
//   node apps/pos/scripts/check-theme-selectors.mjs [css dir, default apps/pos/dist/_expo/static/css]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const THEMES = ['light', 'dark', 'ocean', 'sunset', 'monochrome', 'paper', 'warm', 'bold', 'market'];
const dir = process.argv[2] ?? fileURLToPath(new URL('../dist/_expo/static/css/', import.meta.url));

/** Splits on `separator` outside parentheses. */
function splitTop(text, separator) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '(') depth++;
    if (text[index] === ')') depth--;
    if (depth === 0 && separator.test(text[index])) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map(part => part.trim()).filter(Boolean);
}

/** True when the selector is one compound that <html class="<theme>"> satisfies. */
function matchesHtml(selector, theme) {
  if (splitTop(selector, /[\s>+~]/).length !== 1) return false;
  const parts = selector.match(/:(?:where|is)\((?:[^()]|\([^()]*\))*\)|:root|html|\.[\w-]+|[^.:]+|:[\w-]+(?:\([^)]*\))?/g) ?? [];
  let named = false;
  for (const part of parts) {
    if (part === ':root' || part === 'html') continue;
    if (part === `.${theme}`) {
      named = true;
      continue;
    }
    const inner = /^:(?:where|is)\((.*)\)$/.exec(part)?.[1];
    if (inner !== undefined && splitTop(inner, /,/).includes(`.${theme}`)) {
      named = true;
      continue;
    }
    return false;
  }
  return named;
}

// expo export leaves earlier builds' CSS in place, so read only the files dist/index.html links, when it is there.
const index = join(dir, '../../../index.html');
const linked = existsSync(index) ? readFileSync(index, 'utf8') : null;
const files = readdirSync(dir).filter(file => file.endsWith('.css') && (linked === null || linked.includes(`/css/${file}`)));
const css = files.map(file => readFileSync(join(dir, file), 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, , body]) => /--color-primary\s*:/.test(body));

let failed = 0;
for (const theme of THEMES) {
  const hit = rules.flatMap(([, selectors]) => splitTop(selectors, /,/)).find(selector => matchesHtml(selector, theme));
  if (hit === undefined) failed++;
  console.log(`${hit === undefined ? 'FAIL' : 'ok  '} ${theme.padEnd(10)} ${hit ?? 'no rule setting --color-primary matches <html class>'}`);
}
console.log(`${files.join(', ') || 'no CSS files'} in ${dir}: ${THEMES.length - failed}/${THEMES.length} themes reach <html>`);
process.exit(failed === 0 && files.length > 0 ? 0 : 1);
