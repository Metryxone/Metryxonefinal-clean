/** MX-301E — extract every key/value used in inline `const BRAND = {...}` across frontend/src. */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../frontend/src');

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

function extractBrandBody(src: string): string | null {
  const m = src.match(/const\s+BRAND\s*=\s*\{/);
  if (!m) return null;
  let i = (m.index ?? 0) + m[0].length - 1; // at '{'
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  return null;
}

const keyVal: Record<string, Record<string, number>> = {};
const keyFiles: Record<string, number> = {};
let filesWithBrand = 0;
const multiBrand: string[] = [];

for (const f of walk(ROOT)) {
  const src = fs.readFileSync(f, 'utf8');
  if (!/const\s+BRAND\s*=\s*\{/.test(src)) continue;
  // detect more than one BRAND decl
  const count = (src.match(/const\s+BRAND\s*=\s*\{/g) ?? []).length;
  if (count > 1) multiBrand.push(path.relative(ROOT, f));
  filesWithBrand++;
  const body = extractBrandBody(src);
  if (!body) continue;
  for (const mm of body.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(['"][^'"]*['"]|[^,}\n]+)/g)) {
    const key = mm[1];
    let val = mm[2].trim().replace(/['"]/g, '').toLowerCase();
    (keyVal[key] ||= {})[val] = (keyVal[key]?.[val] ?? 0) + 1;
  }
  const seen = new Set<string>();
  for (const mm of body.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)) seen.add(mm[1]);
  for (const k of seen) keyFiles[k] = (keyFiles[k] ?? 0) + 1;
}

console.log(`files with inline BRAND: ${filesWithBrand}`);
console.log(`files with >1 BRAND decl: ${multiBrand.length} ${multiBrand.join(', ')}`);
console.log('\n=== keys by file-frequency (key: nFiles | topValues) ===');
for (const [k, n] of Object.entries(keyFiles).sort((a, b) => b[1] - a[1])) {
  const vals = Object.entries(keyVal[k] ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([v, c]) => `${v}(${c})`).join(' ');
  console.log(`${k}: ${n} | ${vals}`);
}
