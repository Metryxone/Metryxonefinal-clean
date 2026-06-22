// Predictive options for the Competency Assessment setup panel.
//
// Source of truth: the curated industry → department → sub-department → role
// taxonomy in `frontend/src/data/catalogs/industryRoles.ts` (extracted from
// the attached industrial-breakup library). The ontology API is queried as
// an enrichment layer but the catalog always wins — this guarantees the
// fields are accurate and precisely linked to the assessment runtime even
// when the backend ontology is empty.

import { ALL_ROLES, ALL_INDUSTRIES, INDUSTRY_TAXONOMY, type RoleNode } from '@/data/catalogs/industryRoles';

type AuthHeader = Record<string, string>;

export interface RoleOption {
  id: string | null;
  title: string;
  layerName?: string;
  seniority?: string | null;
  industryName?: string;
  department?: string;
  subDepartment?: string;
  source?: 'catalog' | 'ontology' | 'profile' | 'custom';
  meta?: string;
}

export interface IndustryOption {
  id: string;
  name: string;
  source?: 'catalog' | 'ontology';
}

export interface AdjacentRole {
  role_id: string;
  title: string;
  seniority?: string | null;
  adjacency_score: number;
  basis?: string | null;
  industry?: string;
  department?: string;
  subDepartment?: string;
}

export const STAGE_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'junior',   label: 'Junior',   hint: '0\u20132 yrs \u00b7 individual contributor' },
  { value: 'mid',      label: 'Mid',      hint: '3\u20135 yrs \u00b7 owns a workstream' },
  { value: 'senior',   label: 'Senior',   hint: '6\u20139 yrs \u00b7 mentors others' },
  { value: 'lead',     label: 'Lead',     hint: '10\u201314 yrs \u00b7 leads a team' },
  { value: 'director', label: 'Director', hint: '15+ yrs \u00b7 leads multiple teams' },
];

// ---- in-memory cache (5 min) ---------------------------------------------
type CacheEntry<T> = { ts: number; value: T };
const TTL_MS = 5 * 60 * 1000;
const cache: Record<string, CacheEntry<unknown>> = {};
function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache[key] as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.ts < TTL_MS) return Promise.resolve(hit.value);
  return fn().then(value => { cache[key] = { ts: Date.now(), value }; return value; });
}

async function safeJson<T>(url: string, headers: AuthHeader, fallback: T): Promise<T> {
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) return fallback;
    return (await r.json()) as T;
  } catch { return fallback; }
}

// ---- catalog → RoleOption ------------------------------------------------
function catalogRoles(): RoleOption[] {
  return ALL_ROLES.map(r => ({
    id: null,
    title: r.title,
    industryName: r.industry,
    department: r.department,
    subDepartment: r.subDepartment,
    source: 'catalog' as const,
    meta: `${r.department} \u00b7 ${r.subDepartment}`,
  }));
}

// ---- roles ---------------------------------------------------------------
export async function loadRoleOptions(authHeader: AuthHeader): Promise<RoleOption[]> {
  return memo('roles', async () => {
    const base = catalogRoles();
    // Enrich with ontology data — when an ontology row matches a catalog title
    // we copy its `id` into the catalog entry (so /api/mobility/adjacent can be
    // called for that role). Ontology-only titles are appended.
    const json = await safeJson<any>('/api/ontology/curated/roles', authHeader, null);
    const rows: any[] = Array.isArray(json) ? json
                      : Array.isArray(json?.data) ? json.data
                      : Array.isArray(json?.roles) ? json.roles
                      : [];
    const byTitle = new Map<string, RoleOption>();
    base.forEach(r => byTitle.set(r.title.toLowerCase(), r));
    for (const r of rows) {
      const title = (r.title || r.name || '').toString().trim();
      if (!title) continue;
      const k = title.toLowerCase();
      const existing = byTitle.get(k);
      if (existing) {
        // Merge: keep catalog department/sub-dept context but adopt ontology id
        // + seniority so the mobility API can fire and richer meta can show.
        if (!existing.id && r.id) existing.id = String(r.id);
        if (!existing.seniority && r.seniority) existing.seniority = r.seniority;
        if (!existing.layerName && r.layer_name) existing.layerName = r.layer_name;
        continue;
      }
      const meta = [r.seniority, r.layer_name].filter(Boolean).join(' \u00b7 ');
      const opt: RoleOption = {
        id: r.id ? String(r.id) : null,
        title,
        seniority: r.seniority ?? null,
        layerName: r.layer_name,
        industryName: r.industry_name,
        source: 'ontology',
        meta: meta || undefined,
      };
      base.push(opt);
      byTitle.set(k, opt);
    }
    return base.sort((a, b) => a.title.localeCompare(b.title));
  });
}

// ---- industries ----------------------------------------------------------
export async function loadIndustryOptions(authHeader: AuthHeader): Promise<IndustryOption[]> {
  return memo('industries', async () => {
    const base: IndustryOption[] = ALL_INDUSTRIES.map(n => ({ id: n, name: n, source: 'catalog' as const }));
    const json = await safeJson<any>('/api/ontology/curated/industries', authHeader, null);
    const rows: any[] = Array.isArray(json) ? json
                      : Array.isArray(json?.data) ? json.data
                      : Array.isArray(json?.industries) ? json.industries
                      : [];
    const seen = new Set(base.map(b => b.name.toLowerCase()));
    for (const r of rows) {
      const name = (r.name || r.title || '').toString().trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      base.push({ id: (r.id || name).toString(), name, source: 'ontology' });
    }
    return base.sort((a, b) => a.name.localeCompare(b.name));
  });
}

// ---- catalog-driven predictive target-role suggestions -------------------
// Strategy: given the user's current role, rank other catalog roles by
//   (a) same industry + same department + same sub-department  → 1.00
//   (b) same industry + same department                          → 0.80
//   (c) same industry, different department                      → 0.55
// Returned in descending score; top N (default 6) used as "Suggested next moves".
export function suggestTargetRolesFromCatalog(currentRoleTitle: string, n = 6): AdjacentRole[] {
  if (!currentRoleTitle) return [];
  const me = ALL_ROLES.find(r => r.title.toLowerCase() === currentRoleTitle.toLowerCase());
  if (!me) return [];
  const scored: AdjacentRole[] = [];
  for (const r of ALL_ROLES) {
    if (r.title.toLowerCase() === me.title.toLowerCase()) continue;
    if (r.industry !== me.industry) continue;
    let score = 0.55;
    let basis = 'same industry';
    if (r.department === me.department) {
      score = 0.80;
      basis = `same ${r.department.toLowerCase()} team`;
      if (r.subDepartment === me.subDepartment) {
        score = 1.0;
        basis = `${r.subDepartment} adjacency`;
      }
    }
    scored.push({
      role_id: r.title,
      title: r.title,
      seniority: null,
      adjacency_score: score,
      basis,
      industry: r.industry,
      department: r.department,
      subDepartment: r.subDepartment,
    });
  }
  return scored.sort((a, b) => b.adjacency_score - a.adjacency_score).slice(0, n);
}

// ---- adjacent roles (Phase 3 mobility API, kept as enrichment) -----------
export async function loadAdjacentRoles(roleId: string, authHeader: AuthHeader): Promise<AdjacentRole[]> {
  return memo(`adj:${roleId}`, async () => {
    const json = await safeJson<any>(`/api/mobility/adjacent?role_id=${encodeURIComponent(roleId)}`, authHeader, null);
    const rows: any[] = Array.isArray(json) ? json
                      : Array.isArray(json?.data) ? json.data
                      : Array.isArray(json?.adjacents) ? json.adjacents
                      : Array.isArray(json?.adjacent) ? json.adjacent
                      : [];
    return rows
      .map(r => ({
        role_id: r.role_id || r.id,
        title: (r.title || '').toString(),
        seniority: r.seniority ?? null,
        adjacency_score: typeof r.adjacency_score === 'number' ? r.adjacency_score : Number(r.adjacency_score) || 0,
        basis: r.basis || null,
      }))
      .filter(r => r.title)
      .sort((a, b) => b.adjacency_score - a.adjacency_score);
  });
}

// ---- role lookups --------------------------------------------------------
export function findRoleIdByTitle(options: RoleOption[], title: string): string | null {
  if (!title) return null;
  const t = title.toLowerCase().trim();
  const hit = options.find(o => o.title.toLowerCase() === t);
  return hit?.id || null;
}

export function findRoleByTitle(options: RoleOption[], title: string): RoleOption | null {
  if (!title) return null;
  const t = title.toLowerCase().trim();
  return options.find(o => o.title.toLowerCase() === t) || null;
}

// ---- fuzzy match ---------------------------------------------------------
const STOP = new Set(['of', 'and', 'the', 'a', 'an', 'for', 'to', 'in']);
function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter(t => t && !STOP.has(t) && t.length > 1);
}
export function fuzzyMatchTitle(input: string, choices: string[], threshold = 0.5): string | null {
  if (!input || !choices.length) return null;
  const exact = choices.find(c => c.toLowerCase() === input.toLowerCase().trim());
  if (exact) return exact;
  const inputTokens = new Set(tokenize(input));
  if (inputTokens.size === 0) return null;
  let best: { c: string; score: number } | null = null;
  for (const c of choices) {
    const cTokens = new Set(tokenize(c));
    if (cTokens.size === 0) continue;
    let shared = 0;
    inputTokens.forEach(t => { if (cTokens.has(t)) shared++; });
    const union = new Set([...inputTokens, ...cTokens]).size;
    const jaccard = shared / union;
    const sub = c.toLowerCase().includes(input.toLowerCase().trim()) ||
                input.toLowerCase().includes(c.toLowerCase()) ? 0.2 : 0;
    const score = jaccard + sub;
    if (!best || score > best.score) best = { c, score };
  }
  return best && best.score >= threshold ? best.c : null;
}

// Re-export for callers that need the raw taxonomy.
export { INDUSTRY_TAXONOMY, ALL_ROLES };
export type { RoleNode };
