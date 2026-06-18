/**
 * Competency Normalization Engine — UCIP Phase 1.
 *
 * Purpose: produce a single canonical identity for every competency referenced
 * across assessments, ontology, inference, benchmarks and workforce intelligence.
 *
 * Pure-function: no DB, no side effects. Callers pass raw competency identifiers
 * + optional source labels; receive a stable `CompetencyIdentity`.
 *
 * NEVER mutates source data. NEVER renames anything in upstream tables.
 */

export const COMPETENCY_NORMALIZER_VERSION = '1.0.0';

export type CompetencyIdentity = {
  competencyId: string;
  canonicalName: string;
  family?: string;
  domain?: string;
  source?: string;
};

export type RawCompetencyInput = {
  id?: string | null;
  name?: string | null;
  family?: string | null;
  domain?: string | null;
  source?: string | null;
};

/** Domain aliases — left = anything we may see in upstream payloads, right = canonical 7-domain code. */
const DOMAIN_ALIASES: Record<string, string> = {
  tec: 'TEC', technical: 'TEC', 'technical-execution': 'TEC',
  cog: 'COG', cognitive: 'COG', 'cognitive-analytical': 'COG',
  lea: 'LEA', leadership: 'LEA',
  exe: 'EXE', execution: 'EXE', 'execution-delivery': 'EXE',
  com: 'COM', communication: 'COM',
  eiq: 'EIQ', 'emotional-intelligence': 'EIQ', 'emotional intelligence': 'EIQ',
  adp: 'ADP', adaptability: 'ADP',
};

function slugify(s: string): string {
  return s.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function titleCase(s: string): string {
  return s.split(/[\s_-]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeDomain(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const k = raw.trim().toLowerCase();
  return DOMAIN_ALIASES[k] ?? raw.trim().toUpperCase();
}

export function normalizeCompetency(input: RawCompetencyInput): CompetencyIdentity {
  const rawName = (input.name ?? input.id ?? '').toString().trim();
  if (!rawName) {
    return { competencyId: 'unknown', canonicalName: 'Unknown', source: input.source ?? undefined };
  }
  const competencyId = input.id ? slugify(input.id) : slugify(rawName);
  return {
    competencyId,
    canonicalName: titleCase(rawName),
    family: input.family ? titleCase(input.family) : undefined,
    domain: normalizeDomain(input.domain),
    source: input.source ?? undefined,
  };
}

/**
 * Deduplicate a list of competencies by `competencyId`. When duplicates appear,
 * the later entry wins for non-empty optional fields (family/domain), so a
 * richer source can fill gaps from a thinner one.
 */
export function dedupeCompetencies(items: CompetencyIdentity[]): CompetencyIdentity[] {
  const map = new Map<string, CompetencyIdentity>();
  for (const it of items) {
    const prev = map.get(it.competencyId);
    if (!prev) { map.set(it.competencyId, it); continue; }
    map.set(it.competencyId, {
      ...prev,
      canonicalName: prev.canonicalName || it.canonicalName,
      family: prev.family || it.family,
      domain: prev.domain || it.domain,
      source: prev.source || it.source,
    });
  }
  return Array.from(map.values());
}
