/**
 * Developmental Compliance Sanitizer
 *
 * Server-side guard that strips or rewrites any predictive hiring / placement /
 * suitability claims in user-facing diagnostic payloads. Every CAPADEX +
 * OMEGA-X surface must frame outputs as **developmental signals only**.
 *
 * Used by route handlers immediately before responding with any text that the
 * LLM, template engine, or admin author may have produced. Pure and
 * deterministic — safe to wrap any text source.
 */

// ─── Forbidden phrase matrix ─────────────────────────────────────────────────
// Each rule is a regex (case-insensitive, word-bounded) plus its developmental
// replacement. Order matters — more specific matches must come first.
interface SanitiseRule {
  pattern: RegExp;
  replacement: string;
  reason: string;
}

const SANITISE_RULES: ReadonlyArray<SanitiseRule> = [
  // ── Direct hiring / placement claims ──
  { pattern: /\b(guaranteed|guarantees?|guaranteeing)\s+(a\s+)?(job|placement|hire|offer|role|position)\b/gi,
    replacement: 'supports your development toward $3 readiness',
    reason: 'guaranteed_placement_claim' },
  { pattern: /\b(will|shall)\s+(be|get)\s+(hired|placed|selected|recruited|offered\s+a\s+job)\b/gi,
    replacement: 'shows developmental readiness toward that direction',
    reason: 'predictive_hiring_claim' },
  { pattern: /\b(you\s+(are|will\s+be|will))\s+(employable|hireable|placement[-\s]?ready)\b/gi,
    replacement: 'your developmental signals point toward $3 capabilities',
    reason: 'fitness_for_employment_claim' },

  // ── Suitability / fitment as a verdict (negative form first so it isn't
  //    pre-empted by the broader positive rule below) ──
  { pattern: /\b(?:are\s+|is\s+)?(?:unsuitable|unfit|not\s+qualified|not\s+suitable)\s+(?:for|to)\s+(?:this|the|a|an)?\s*([a-z\s-]*?)(job|role|position|placement|hire|career)\b/gi,
    replacement: 'shows developmental room to grow in $1$2 capabilities',
    reason: 'negative_suitability_verdict' },
  { pattern: /\b(suitable|fit|qualified)\s+for\s+(this|the|a|an)\s+(job|role|position|placement|hire|career)\b/gi,
    replacement: 'aligned with developmental focus on $3 capabilities',
    reason: 'suitability_verdict' },

  // ── Career outcome predictions framed as certainty ──
  { pattern: /\b(predicts?|prediction\s+of|guarantees?)\s+(career\s+success|success\s+at\s+work|job\s+success|placement\s+success)\b/gi,
    replacement: 'signals developmental focus areas relevant to $2',
    reason: 'success_prediction_claim' },
  { pattern: /\bcareer\s+(verdict|judgment|determination)\b/gi,
    replacement: 'career developmental signal',
    reason: 'verdict_framing' },

  // ── Salary / compensation predictions ──
  { pattern: /\b(salary|compensation|package|ctc)\s+(prediction|forecast|guarantee)\b/gi,
    replacement: '$1 context (developmental reference only)',
    reason: 'compensation_prediction' },

  // ── Recruitment / selection guarantees ──
  { pattern: /\b(should|must)\s+(hire|recruit|select|reject|disqualify)\s+/gi,
    replacement: 'may consider developmental support for ',
    reason: 'directive_recruitment_claim' },
];

// Optional concise advisory appended when sanitisation modifies text.
const COMPLIANCE_FOOTNOTE =
  ' Developmental signal only — not a hiring, placement, or suitability prediction.';

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SanitiseResult {
  text: string;
  modified: boolean;
  removed_claims: string[];
}

/**
 * Sanitise a single text payload. Returns the cleaned text plus a list of
 * the rule `reason` tags that fired (for audit logging upstream).
 */
export function sanitiseDevelopmentalText(input: string | null | undefined): SanitiseResult {
  if (input == null) return { text: '', modified: false, removed_claims: [] };
  const original = String(input);
  if (original.trim().length === 0) {
    return { text: original, modified: false, removed_claims: [] };
  }

  let working = original;
  const fired: string[] = [];

  for (const rule of SANITISE_RULES) {
    if (rule.pattern.test(working)) {
      // Reset lastIndex for global regexes between test() and replace().
      rule.pattern.lastIndex = 0;
      working = working.replace(rule.pattern, rule.replacement);
      fired.push(rule.reason);
    }
    rule.pattern.lastIndex = 0;
  }

  const modified = fired.length > 0;
  const finalText = modified && !working.includes('Developmental signal only')
    ? working + COMPLIANCE_FOOTNOTE
    : working;

  return { text: finalText, modified, removed_claims: fired };
}

/**
 * Walk an arbitrary payload and sanitise every string in place. Arrays,
 * nested objects, and primitives other than `string` pass through untouched
 * (numbers, booleans, nulls, dates).
 *
 * Returns a new structure — the input is not mutated. Aggregates every
 * removed-claim tag from every nested string for upstream audit logging.
 */
export function sanitiseDevelopmentalPayload<T>(payload: T): { value: T; removed_claims: string[] } {
  const allClaims: string[] = [];
  const walked = walk(payload, allClaims);
  return { value: walked as T, removed_claims: allClaims };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function walk(node: unknown, claims: string[]): unknown {
  if (typeof node === 'string') {
    const r = sanitiseDevelopmentalText(node);
    if (r.modified) claims.push(...r.removed_claims);
    return r.text;
  }
  if (Array.isArray(node)) return node.map(item => walk(item, claims));
  if (isPlainObject(node)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = walk(v, claims);
    return out;
  }
  // Dates, Maps, Sets, class instances, primitives → pass through unchanged.
  return node;
}

// Exposed for tests / debugging.
export const __SANITISE_RULES_FOR_TESTS = SANITISE_RULES;
