/**
 * MX-301E — brand convergence codemod.
 * Removes every inline `const BRAND = {...}` in frontend/src/**.tsx and replaces it
 * with a canonical import from design-system/tokens:
 *   - primary === #0b3c5d  → import { BRAND_NAVY as BRAND }  (preserves navy sub-brand)
 *   - everything else      → import { BRAND }                (canonical; converges drift)
 * Idempotent-ish: skips files that no longer contain an inline `const BRAND`.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../frontend/src');
const DRY = process.argv.includes('--dry');

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (/node_modules|artifacts|__mockup/.test(full)) continue;
      walk(full, acc);
    } else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) acc.push(full);
  }
  return acc;
}

let navy = 0, canonical = 0, offbrand = 0;
const offbrandFiles: string[] = [];

for (const f of walk(ROOT)) {
  let src = fs.readFileSync(f, 'utf8');
  const m = src.match(/(?:export\s+)?const\s+BRAND\s*=\s*\{/);
  if (!m) continue;
  const start = m.index ?? 0;
  const braceIdx = start + m[0].length - 1;
  let depth = 0, end = -1;
  for (let j = braceIdx; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end < 0) { console.warn('UNBALANCED', f); continue; }
  // consume optional ` as const` and trailing `;`
  const asConst = src.slice(end).match(/^\s*as const/);
  if (asConst) end += asConst[0].length;
  const semi = src.slice(end).match(/^\s*;/);
  if (semi) end += semi[0].length;

  const body = src.slice(braceIdx, end);
  const pm = body.match(/primary\s*:\s*['"]([^'"]+)['"]/);
  const primary = pm ? pm[1].toLowerCase() : '';
  const isNavy = primary === '#0b3c5d';
  if (isNavy) navy++;
  else if (primary && primary !== '#344e86') { offbrand++; offbrandFiles.push(`${path.relative(ROOT, f)} (${primary})`); }
  else canonical++;

  const importName = isNavy ? 'BRAND_NAVY as BRAND' : 'BRAND';
  const importLine = `import { ${importName} } from '@/design-system/tokens';\n`;
  const without = src.slice(0, start) + src.slice(end);
  src = importLine + without.replace(/^\n{2,}/, '\n');
  if (!DRY) fs.writeFileSync(f, src);
}

console.log(`${DRY ? '[dry] ' : ''}converged inline BRAND → token import`);
console.log(`  canonical-primary (no visual change): ${canonical}`);
console.log(`  navy-primary (BRAND_NAVY, preserved): ${navy}`);
console.log(`  off-brand drift (converged to canonical): ${offbrand}`);
offbrandFiles.forEach(x => console.log('    ' + x));
