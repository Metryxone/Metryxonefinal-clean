/**
 * MX-301E — UI/UX Enterprise Certification: static scanner (honesty-first).
 *
 * Read-only. Walks frontend/src and measures OBJECTIVE, mechanically-verifiable UI defect
 * classes per file, against the canonical design system (design-system/tokens.ts +
 * styles/index.css). It NEVER fabricates severity: it classifies what is literally in the
 * source. Visual/subjective criteria (composition, hierarchy, chart legibility) are reported
 * as an explicit ceiling and covered by the screenshot pass, not by this scanner.
 *
 * Emits: backend/audit/mx-301e/scan.json  (+ console summary)
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../frontend/src');
const OUT_DIR = path.resolve(__dirname, '../audit/mx-301e');

// ---- Canonical design system (source of truth) --------------------------------------------
const CANON = {
  primary: '#344e86',
  accent: '#4ecdc4',
  // full canonical palette (lowercased) from design-system/tokens.ts COLOR
  palette: ['#344e86', '#4ecdc4', '#2a9d8f', '#e63946', '#f4a261', '#8b5cf6', '#0ea5e9', '#ec4899', '#94a3b8', '#16a34a'],
  fontCanon: 'plus jakarta sans', // styles/index.css @layer base canon (headings + body)
  fontLegacy: 'inter',            // tokens.ts TYPOGRAPHY.fontFamily (legacy)
};

interface FileFinding {
  file: string;
  loc: number;
  inlineBrand: boolean;
  brandPrimary: string | null;
  brandAccent: string | null;
  offBrandPrimary: boolean; // brand primary diverges from canonical
  offBrandAccent: boolean;
  importsTokens: boolean;
  imgNoAlt: number;          // <img ...> occurrences lacking alt=
  fontInter: number;         // references to Inter
  fontJakarta: number;       // references to Plus Jakarta Sans
  bigFixedPx: number;        // hardcoded widths >= 600px (mobile-overflow risk)
  hasLoading: boolean;       // uses a loading/skeleton/spinner primitive or isLoading guard
  hasEmpty: boolean;         // uses an empty-state primitive/branch
  hasError: boolean;         // uses an error-state primitive/branch
  fetchesData: boolean;      // useQuery/fetch/axios present (so states are EXPECTED)
  intentionalStub: number;   // "coming soon" inside a toast(...) — documented legacy stub
  defectPlaceholder: number; // non-toast "coming soon"/"under construction"/"not implemented"
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (/node_modules|artifacts|__mockup|\.test\b/.test(full)) continue;
      walk(full, acc);
    } else if (/\.(tsx)$/.test(name) && !/\.test\.tsx$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

function analyze(file: string): FileFinding {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  const loc = src.split('\n').length;

  // inline BRAND const + its primary/accent values
  const brandMatch = src.match(/const\s+BRAND\s*=\s*\{[\s\S]*?\}/);
  const inlineBrand = !!brandMatch;
  const brandBody = brandMatch ? brandMatch[0] : '';
  const primaryM = brandBody.match(/primary\s*:\s*['"]([#0-9a-fA-F]+)['"]/);
  const accentM = brandBody.match(/accent\s*:\s*['"]([#0-9a-fA-F]+)['"]/);
  const brandPrimary = primaryM ? primaryM[1].toLowerCase() : null;
  const brandAccent = accentM ? accentM[1].toLowerCase() : null;

  // <img> without alt
  const imgTags = src.match(/<img\b[^>]*>/g) ?? [];
  const imgNoAlt = imgTags.filter((t) => !/\balt\s*=/.test(t)).length;

  // typography refs
  const fontInter = (src.match(/inter/gi) ?? []).filter((_, i, a) => true).length
    ? (src.match(/['"][^'"]*inter[^'"]*['"]/gi) ?? []).length
    : 0;
  const fontJakarta = (src.match(/plus jakarta sans/gi) ?? []).length;

  // hardcoded big widths: w-[NNNpx] or width: NNNpx / style width  >= 600
  const pxWidths = [...src.matchAll(/(?:w-\[|width:\s*|minWidth:\s*['"]?|min-width:\s*)(\d{3,4})px/gi)]
    .map((m) => parseInt(m[1], 10))
    .filter((n) => n >= 600);
  const bigFixedPx = pxWidths.length;

  const fetchesData = /useQuery|useMutation|fetch\(|axios|apiRequest|useSWR/.test(src);
  const hasLoading = /isLoading|isPending|Skeleton|Spinner|LoadingState|animate-pulse|isFetching/.test(src);
  const hasEmpty = /EmptyState|<Empty\b|no (data|results|records)|isEmpty|length\s*===\s*0|\.length\s*\?/i.test(src);
  const hasError = /ErrorState|isError|error\s*&&|catch\s*\(|<Alert\b|onError/i.test(src);

  // placeholders: intentional (toast) vs defect (rendered text)
  const csLines = src.split('\n').filter((l) => /coming soon|under construction|not implemented/i.test(l));
  const intentionalStub = csLines.filter((l) => /toast\(/.test(l)).length;
  const defectPlaceholder = csLines.filter((l) => !/toast\(|\/\/|\/\*|\*/.test(l)).length;

  return {
    file: rel,
    loc,
    inlineBrand,
    brandPrimary,
    brandAccent,
    offBrandPrimary: !!brandPrimary && brandPrimary !== CANON.primary,
    offBrandAccent: !!brandAccent && brandAccent !== CANON.accent,
    importsTokens: /design-system\/tokens|design-system['"]/.test(src),
    imgNoAlt,
    fontInter,
    fontJakarta,
    bigFixedPx,
    hasLoading,
    hasEmpty,
    hasError,
    fetchesData,
    intentionalStub,
    defectPlaceholder,
  };
}

function main() {
  const files = walk(ROOT);
  const findings = files.map(analyze);

  // aggregate (honest counts only)
  const dataScreens = findings.filter((f) => f.fetchesData);
  const agg = {
    scannedAt: new Date().toISOString(),
    totalFiles: findings.length,
    brand: {
      inlineBrandFiles: findings.filter((f) => f.inlineBrand).length,
      importsTokensFiles: findings.filter((f) => f.importsTokens).length,
      offBrandPrimaryFiles: findings.filter((f) => f.offBrandPrimary).map((f) => f.file),
      offBrandAccentFiles: findings.filter((f) => f.offBrandAccent).map((f) => f.file),
    },
    typography: {
      filesReferencingInter: findings.filter((f) => f.fontInter > 0).length,
      filesReferencingJakarta: findings.filter((f) => f.fontJakarta > 0).length,
    },
    accessibility: {
      filesWithImgNoAlt: findings.filter((f) => f.imgNoAlt > 0).map((f) => ({ file: f.file, count: f.imgNoAlt })),
      totalImgNoAlt: findings.reduce((s, f) => s + f.imgNoAlt, 0),
    },
    responsive: {
      filesWithBigFixedPx: findings.filter((f) => f.bigFixedPx > 0).map((f) => ({ file: f.file, count: f.bigFixedPx })),
    },
    states: {
      dataScreens: dataScreens.length,
      dataScreensMissingLoading: dataScreens.filter((f) => !f.hasLoading).map((f) => f.file),
      dataScreensMissingEmpty: dataScreens.filter((f) => !f.hasEmpty).map((f) => f.file),
      dataScreensMissingError: dataScreens.filter((f) => !f.hasError).map((f) => f.file),
    },
    placeholders: {
      intentionalStubFiles: findings.filter((f) => f.intentionalStub > 0).length,
      totalIntentionalStubs: findings.reduce((s, f) => s + f.intentionalStub, 0),
      defectPlaceholderFiles: findings.filter((f) => f.defectPlaceholder > 0).map((f) => f.file),
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'scan.json'), JSON.stringify({ agg, findings }, null, 2));

  // console summary
  console.log('\n[mx301e] UI Certification static scan');
  console.log(`  scanned .tsx files: ${agg.totalFiles}`);
  console.log(`  brand: inline BRAND in ${agg.brand.inlineBrandFiles} files | import tokens in ${agg.brand.importsTokensFiles}`);
  console.log(`  OFF-BRAND primary: ${agg.brand.offBrandPrimaryFiles.length} -> ${agg.brand.offBrandPrimaryFiles.join(', ') || 'none'}`);
  console.log(`  OFF-BRAND accent:  ${agg.brand.offBrandAccentFiles.length} -> ${agg.brand.offBrandAccentFiles.join(', ') || 'none'}`);
  console.log(`  typography: Inter-ref ${agg.typography.filesReferencingInter} | Jakarta-ref ${agg.typography.filesReferencingJakarta}`);
  console.log(`  a11y: <img> missing alt across ${agg.accessibility.filesWithImgNoAlt.length} files (${agg.accessibility.totalImgNoAlt} imgs)`);
  console.log(`  responsive: big (>=600px) fixed widths in ${agg.responsive.filesWithBigFixedPx.length} files`);
  console.log(`  states: ${agg.states.dataScreens} data screens | missing loading ${agg.states.dataScreensMissingLoading.length} | missing empty ${agg.states.dataScreensMissingEmpty.length} | missing error ${agg.states.dataScreensMissingError.length}`);
  console.log(`  placeholders: intentional toast-stubs ${agg.placeholders.totalIntentionalStubs} (legacy, KEEP) | rendered-defect placeholders in ${agg.placeholders.defectPlaceholderFiles.length} files`);
  console.log(`  -> ${path.join(OUT_DIR, 'scan.json')}`);
}

main();
