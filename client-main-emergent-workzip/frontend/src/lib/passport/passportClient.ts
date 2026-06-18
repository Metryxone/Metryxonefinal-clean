/**
 * Employability Passport — client orchestration (T-P7).
 *
 * Pure/additive: assembles the passport snapshot from data the Career OS has
 * ALREADY computed (profile, EI, EI competency breakdown) plus a few best-effort
 * reads of EXISTING endpoints (behaviour graph, behavioural-memory growth,
 * verification trust). It never introduces new scoring — it only SURFACES.
 *
 * The owner POSTs the assembled snapshot to be stored alongside a share token;
 * the public/recruiter view reads it back, sanitized, from the public endpoint.
 */

export const PASSPORT_SECTION_KEYS = [
  'competencies',
  'assessment',
  'skills',
  'projects',
  'certifications',
  'careerReadiness',
  'verifiedCredentials',
  'growthReport',
] as const;
export type PassportSectionKey = (typeof PASSPORT_SECTION_KEYS)[number];
export type PassportVisibility = Record<PassportSectionKey, boolean>;

export const PASSPORT_SECTION_LABELS: Record<PassportSectionKey, string> = {
  competencies: 'Competencies',
  assessment: 'Assessment Summary',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  careerReadiness: 'Career Readiness',
  verifiedCredentials: 'Verified Credentials',
  growthReport: 'Career Growth Report',
};

export function defaultVisibility(): PassportVisibility {
  return PASSPORT_SECTION_KEYS.reduce((acc, k) => { acc[k] = true; return acc; }, {} as PassportVisibility);
}

export interface CompetencyItem { label: string; value: number }
export interface SkillsBlock { technical: string[]; soft: string[]; tools: string[]; languages: string[] }
export interface ProjectItem { title: string; description?: string }
export interface CertItem { name: string; authority?: string }
export interface CareerReadiness { eiScore: number; band: string; completeness: number }
export interface VerifiedCredentials { trustScore: number | null; level?: string | null; items: { label: string; status?: string }[] }
export interface GrowthReport { improving: string[]; emerging: string[]; stable: string[]; snapshots: number }
export interface AssessmentSummary { headline: string; signals: number; patterns: number; risks: number; concern?: string | null }

export interface PassportSnapshot {
  header: { name: string; headline: string; eiScore: number; eiBand: string; stage?: string };
  sections: {
    competencies?: { items: CompetencyItem[]; total?: number } | null;
    assessment?: AssessmentSummary | null;
    skills?: SkillsBlock | null;
    projects?: ProjectItem[] | null;
    certifications?: CertItem[] | null;
    careerReadiness?: CareerReadiness | null;
    verifiedCredentials?: VerifiedCredentials | null;
    growthReport?: GrowthReport | null;
  };
  generatedAt: string;
}

export interface ShareStatus {
  shared: boolean;
  shareToken?: string;
  path?: string;
  url?: string;
  visibility?: PassportVisibility;
  sharedAt?: string | null;
}

/** EI band — reuses the platform's canonical Elite/Strong/Developing/Foundation cut-offs. */
export function eiBand(score: number): string {
  if (score >= 75) return 'Elite';
  if (score >= 55) return 'Strong';
  if (score >= 35) return 'Developing';
  return 'Foundation';
}

async function getJSON(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function asNum(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function labelOf(o: any, ...keys: string[]): string {
  if (typeof o === 'string') return o.trim();
  for (const k of keys) { const v = o?.[k]; if (typeof v === 'string' && v.trim()) return v.trim(); }
  return '';
}

/** Build the passport snapshot from already-available page data + best-effort reads. */
export async function assemblePassportSnapshot(input: {
  userId: string;
  profile: any;
  eiScore: number;
  eiBreakdown?: { total: number; components: any[] };
}): Promise<PassportSnapshot> {
  const { userId, profile, eiScore, eiBreakdown } = input;
  const p = profile ?? {};
  const personal = p.personal ?? {};
  const name = String(personal.name || 'Career Seeker').trim();
  const headline = (p.summary || labelOf(p.experience?.[0], 'role', 'title') || '').toString().trim().slice(0, 220);
  const band = eiBand(eiScore);
  const completeness = asNum(p?.competencyProfile?.completeness);

  // Competencies — reuse the EI competency breakdown already on the page.
  const components = Array.isArray(eiBreakdown?.components) ? eiBreakdown!.components : [];
  const compItems: CompetencyItem[] = components
    .map((c: any) => ({ label: labelOf(c, 'label', 'name', 'key', 'code'), value: Math.round(asNum(c?.value ?? c?.score ?? c?.normalized ?? c?.weight)) }))
    .filter((c) => c.label);
  const competencies = compItems.length ? { items: compItems.slice(0, 12), total: asNum(eiBreakdown?.total) || eiScore } : null;

  // Skills / Projects / Certifications — straight from the existing CV profile.
  const sk = p.skills ?? {};
  const skills: SkillsBlock | null = (sk.technical?.length || sk.soft?.length || sk.tools?.length || sk.languages?.length)
    ? {
        technical: (sk.technical ?? []).map((x: any) => String(x)).filter(Boolean),
        soft: (sk.soft ?? []).map((x: any) => String(x)).filter(Boolean),
        tools: (sk.tools ?? []).map((x: any) => String(x)).filter(Boolean),
        languages: (sk.languages ?? []).map((x: any) => String(x)).filter(Boolean),
      }
    : null;
  const projects: ProjectItem[] | null = Array.isArray(p.projects) && p.projects.length
    ? p.projects.map((x: any) => ({ title: labelOf(x, 'title', 'name'), description: labelOf(x, 'description', 'summary') })).filter((x: ProjectItem) => x.title)
    : null;
  const certifications: CertItem[] | null = Array.isArray(p.certifications) && p.certifications.length
    ? p.certifications.map((x: any) => ({ name: labelOf(x, 'name', 'title'), authority: labelOf(x, 'authority', 'issuer', 'organization') })).filter((x: CertItem) => x.name)
    : null;

  const careerReadiness: CareerReadiness = { eiScore: Math.round(eiScore), band, completeness };

  // Assessment summary — best-effort from the Unified Behavior Graph.
  let assessment: AssessmentSummary | null = null;
  const bg = await getJSON(`/api/career/behavior-graph/${userId}`);
  const graph = bg?.graph;
  if (graph) {
    const signals = Array.isArray(graph.signals) ? graph.signals.length : 0;
    const patterns = Array.isArray(graph.patterns) ? graph.patterns.length : 0;
    const risks = Array.isArray(graph.risks) ? graph.risks.length : 0;
    if (signals || patterns || risks) {
      assessment = {
        headline: labelOf(graph, 'concern') ? `Behavioural profile for "${labelOf(graph, 'concern')}"` : 'Behavioural assessment completed',
        signals, patterns, risks,
        concern: labelOf(graph, 'concern') || null,
      };
    }
  }

  // Career growth report — best-effort from behavioural-memory growth deltas.
  let growthReport: GrowthReport | null = null;
  const mem = await getJSON(`/api/career/behavioural-memory/${userId}`);
  if (mem?.growth && asNum(mem?.snapshot_count) > 0) {
    const take = (arr: any[]): string[] => (Array.isArray(arr) ? arr.map((x: any) => labelOf(x, 'label', 'key')).filter(Boolean).slice(0, 6) : []);
    const improving = take(mem.growth.improving_signals);
    const emerging = take(mem.growth.emerging_patterns);
    const stable = take(mem.growth.stable_patterns);
    if (improving.length || emerging.length || stable.length) {
      growthReport = { improving, emerging, stable, snapshots: asNum(mem.snapshot_count) };
    }
  }

  // Verified credentials / trust — best-effort from the verification trust engine.
  let verifiedCredentials: VerifiedCredentials | null = null;
  const trust = await getJSON(`/api/verification/trust`);
  if (trust && (trust.trust_score != null || trust.score != null || Array.isArray(trust.verifications))) {
    const items = (Array.isArray(trust.verifications) ? trust.verifications : [])
      .filter((v: any) => (v?.status ?? '').toLowerCase() === 'verified')
      .map((v: any) => ({ label: labelOf(v, 'provider_code', 'subject_type', 'label') || 'Verified credential', status: 'verified' }))
      .slice(0, 8);
    const score = trust.trust_score ?? trust.score ?? null;
    if (score != null || items.length) {
      verifiedCredentials = { trustScore: score != null ? Math.round(asNum(score)) : null, level: labelOf(trust, 'level', 'band') || null, items };
    }
  }

  return {
    header: { name, headline, eiScore: Math.round(eiScore), eiBand: band, stage: labelOf(p, 'stage') || undefined },
    sections: { competencies, assessment, skills, projects, certifications, careerReadiness, verifiedCredentials, growthReport },
    generatedAt: new Date().toISOString(),
  };
}

function withUrl(s: ShareStatus): ShareStatus {
  if (s.shared && s.path) s.url = `${window.location.origin}${s.path}`;
  return s;
}

export async function getShareStatus(userId: string): Promise<ShareStatus> {
  const r = await fetch(`/api/career/passport/${userId}/share-status`, { credentials: 'include' });
  if (!r.ok) return { shared: false };
  return withUrl(await r.json());
}

export async function createShareLink(userId: string, snapshot: PassportSnapshot, visibility: PassportVisibility): Promise<ShareStatus> {
  const r = await fetch(`/api/career/passport/${userId}/share`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot, visibility }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || `share_failed_${r.status}`);
  return withUrl(await r.json());
}

export async function revokeShareLink(userId: string): Promise<ShareStatus> {
  const r = await fetch(`/api/career/passport/${userId}/share`, { method: 'DELETE', credentials: 'include' });
  if (!r.ok) throw new Error(`revoke_failed_${r.status}`);
  return { shared: false };
}

export async function fetchPublicPassport(token: string): Promise<{ ok: boolean; passport?: PassportSnapshot; sharedAt?: string | null; error?: string }> {
  try {
    const r = await fetch(`/api/public/passport/${encodeURIComponent(token)}`);
    if (r.status === 404) return { ok: false, error: 'not_found' };
    if (r.status === 503) return { ok: false, error: 'feature_disabled' };
    if (!r.ok) return { ok: false, error: `http_${r.status}` };
    const data = await r.json();
    return { ok: true, passport: data.passport, sharedAt: data.sharedAt ?? null };
  } catch { return { ok: false, error: 'network' }; }
}
