import { DashboardIntro } from '../components/career/DashboardIntro';
/**
 * Phase 1 — Competency Ontology + Workforce Taxonomy explorer.
 *
 * Read-only viewer onto the new `/api/ontology/*` endpoints. Five panes:
 *   1. Domains & families
 *   2. Competencies (with aliases, indicators)
 *   3. Workforce taxonomy (industry → function → subfunction → role family → role)
 *   4. Role DNA visualiser
 *   5. Organisational layers + proficiency model
 *
 * Backward-compatible: never touches existing routes, schemas, or peer
 * benchmark code. Reachable via ?screen=ontology-explorer.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Layers as LayersIcon, Network, Briefcase, GitBranch, BookOpen,
  Search, ArrowLeft, ChevronRight, Loader2, X,
} from 'lucide-react';

interface Props { onNavigate?: (screen: string) => void }

type Tab = 'domains' | 'competencies' | 'workforce' | 'role-dna' | 'layers';

interface Domain   { id: string; name: string; scientific_type: string; description: string; display_order: number }
interface Family   { id: string; domain_id: string; name: string; description: string }
interface Competency {
  id: string; canonical_name: string; slug: string;
  domain_id: string; family_id: string;
  scientific_type: string; definition: string;
  trainability: 'low'|'moderate'|'high';
  stability_level: string; complexity_level: number;
  leadership_relevance: number;
  aliases?: string[];
  indicators?: { indicator: string; proficiency_level: number }[];
}
interface Layer {
  id: string; name: string; display_order: number;
  capability_expectations: string; cognitive_complexity: string;
  behavioral_expectations: string; strategic_expectations: string;
  decision_scope: string; ambiguity_tolerance: string; leadership_accountability: string;
  minimum_score: number; median_score: number; high_performer_score: number; exceptional_score: number;
}
interface ProficiencyLevel {
  level: number; label: string; description: string;
  behavioral_indicators_hint: string; complexity_expectation: string;
  role_applicability: string; developmental_expectation: string;
}
interface RoleRow {
  id: string; title: string; seniority: string | null;
  industry_name: string; function_name: string;
  subfunction_name: string; role_family_name: string; layer_name: string;
}
interface RoleDNA {
  role: { id: string; title: string; seniority: string | null; description: string };
  role_family: { name: string };
  subfunction: { name: string };
  function:    { name: string };
  industry:    { name: string };
  layer: Layer;
  profile: { id: string; version: string; is_current: boolean };
  weights: {
    competency_id: string; canonical_name: string;
    domain_id: string; family_id: string;
    weight: number; expected_level: number; rationale: string | null;
    /** Provenance — 'onet_derived' means estimated/inherited rather than measured. */
    source?: string;
  }[];
  weight_sum: number;
}

/** True when a competency's weight is estimated/inherited from O*NET, not measured. */
const isEstimatedSource = (source?: string) => source === 'onet_derived';

const BRAND = {
  primary: '#0F172A',
  accent: '#FB923C',
  green: '#16A34A',
  surface: '#FFFFFF',
  bg: '#F8FAFC',
  border: '#E2E8F0',
};

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'request_failed');
  return j.data as T;
}

export default function OntologyExplorerPage({ onNavigate }: Props) {
  const [tab, setTab] = useState<Tab>('domains');

  return (
    <div className="min-h-screen" style={{ background: BRAND.bg }}>
      {/* Top bar */}
      <header className="border-b" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => onNavigate?.('landing')}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16} /> Home
          </button>
          <div className="h-6 w-px bg-gray-200" />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500">MetryxOne · Phase 1</div>
            <h1 className="text-xl font-bold" style={{ color: BRAND.primary }}>
              Competency Ontology & Workforce Taxonomy
            </h1>
          </div>
          <div className="ml-auto text-[11px] text-gray-500">
            Ontology v1.0.0 · Read-only · k-anonymous benchmarks preserved
          </div>
        </div>
        {/* Tabs */}
        <nav className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {([
            { k: 'domains',      l: 'Domains & Families', i: <LayersIcon size={14}/> },
            { k: 'competencies', l: 'Competencies',       i: <BookOpen size={14}/> },
            { k: 'workforce',    l: 'Workforce Taxonomy', i: <Network size={14}/> },
            { k: 'role-dna',     l: 'Role DNA',           i: <GitBranch size={14}/> },
            { k: 'layers',       l: 'Layers & Proficiency', i: <Briefcase size={14}/> },
          ] as { k: Tab; l: string; i: JSX.Element }[]).map(t => {
            const active = tab === t.k;
            return (
              <button key={t.k} onClick={() => setTab(t.k)}
                className="px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors"
                style={{
                  borderColor: active ? BRAND.accent : 'transparent',
                  color: active ? BRAND.primary : '#64748B',
                }}>
                {t.i}{t.l}
              </button>
            );
          })}
        </nav>
      </header>

      <DashboardIntro
        title="Competency Ontology"
        whatItIs="The library of every competency, domain, role and role-DNA the platform measures. Reference only — nothing here is about you."
        whenToUse="Once, for orientation. Come back if you want to look up what a competency means or which roles use it."
        audience="Anyone"
      />

      <main className="max-w-7xl mx-auto px-6 py-6">
        {tab === 'domains'      && <DomainsPane />}
        {tab === 'competencies' && <CompetenciesPane />}
        {tab === 'workforce'    && <WorkforcePane />}
        {tab === 'role-dna'     && <RoleDNAPane />}
        {tab === 'layers'       && <LayersPane />}
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Domains & Families
// ----------------------------------------------------------------------------
function DomainsPane() {
  const [domains, setDomains]   = useState<Domain[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const [d, f] = await Promise.all([
          getJSON<Domain[]>('/api/ontology/domains'),
          getJSON<Family[]>('/api/ontology/families'),
        ]);
        if (cancelled) return;
        setDomains(d); setFamilies(f);
      } catch (e: any) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Loading/>;
  if (error)   return <ErrorState msg={error}/>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Five capability super-domains organise every competency. Each domain holds
        one or more families — themed clusters of related canonical competencies.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {domains.map(d => {
          const fams = families.filter(f => f.domain_id === d.id);
          return (
            <div key={d.id} className="rounded-xl border bg-white p-5" style={{ borderColor: BRAND.border }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider"
                  style={{ background: BRAND.bg, color: BRAND.primary }}>{d.scientific_type}</span>
              </div>
              <h3 className="font-bold text-base" style={{ color: BRAND.primary }}>{d.name}</h3>
              <p className="text-[12.5px] text-gray-600 mt-1">{d.description}</p>
              <div className="mt-3 pt-3 border-t" style={{ borderColor: BRAND.border }}>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">
                  {fams.length} {fams.length === 1 ? 'family' : 'families'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {fams.map(f => (
                    <span key={f.id} className="text-[11px] px-2 py-1 rounded-md border"
                      style={{ borderColor: BRAND.border, color: BRAND.primary }}>
                      {f.name.replace(/\s+Family$/, '')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Competencies
// ----------------------------------------------------------------------------
function CompetenciesPane() {
  const [list, setList] = useState<Competency[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Competency | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<string>('');
  const [domains, setDomains] = useState<Domain[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const qs = new URLSearchParams();
        if (q) qs.set('q', q);
        if (domainFilter) qs.set('domain_id', domainFilter);
        const [comps, doms] = await Promise.all([
          getJSON<Competency[]>(`/api/ontology/curated/competencies?${qs.toString()}`),
          domains.length ? Promise.resolve(domains) : getJSON<Domain[]>('/api/ontology/domains'),
        ]);
        if (cancelled) return;
        setList(comps);
        if (!domains.length) setDomains(doms);
      } catch (e: any) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, domainFilter]);

  const openDetail = useCallback(async (id: string) => {
    try {
      const c = await getJSON<Competency>(`/api/ontology/curated/competencies/${id}`);
      setSelected(c);
    } catch (e: any) { setError(e.message); }
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search canonical name or alias…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-white"
            style={{ borderColor: BRAND.border }}/>
        </div>
        <select value={domainFilter} onChange={e => setDomainFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border bg-white"
          style={{ borderColor: BRAND.border }}>
          <option value="">All domains</option>
          {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {loading ? <Loading/> : error ? <ErrorState msg={error}/> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map(c => (
            <button key={c.id} onClick={() => openDetail(c.id)}
              className="text-left rounded-xl border bg-white p-4 hover:shadow-md transition-shadow"
              style={{ borderColor: BRAND.border }}>
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm" style={{ color: BRAND.primary }}>{c.canonical_name}</h4>
                <ChevronRight size={14} className="text-gray-400"/>
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                {c.scientific_type} · L{c.complexity_level} · {c.stability_level.replace('_', ' ')}
              </div>
              <p className="text-[12px] text-gray-600 mt-2 line-clamp-2">{c.definition}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: c.trainability === 'high' ? '#dcfce7' : c.trainability === 'moderate' ? '#fef3c7' : '#fee2e2',
                           color:      c.trainability === 'high' ? '#166534' : c.trainability === 'moderate' ? '#92400e' : '#991b1b' }}>
                  trainability: {c.trainability}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded border"
                  style={{ borderColor: BRAND.border, color: '#475569' }}>
                  lead-rel {(c.leadership_relevance * 100).toFixed(0)}%
                </span>
              </div>
            </button>
          ))}
          {!list.length && <div className="text-sm text-gray-500 col-span-full">No competencies match.</div>}
        </div>
      )}

      {selected && <CompetencyDetailModal competency={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CompetencyDetailModal({ competency, onClose }: { competency: Competency; onClose: () => void }) {
  const c = competency;
  const indicatorsByLevel = useMemo(() => {
    const m = new Map<number, string[]>();
    (c.indicators || []).forEach(i => {
      const arr = m.get(i.proficiency_level) || [];
      arr.push(i.indicator); m.set(i.proficiency_level, arr);
    });
    return m;
  }, [c]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-start justify-between" style={{ borderColor: BRAND.border }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>{c.canonical_name}</h2>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {c.scientific_type} · complexity L{c.complexity_level} · {c.stability_level.replace('_',' ')} · trainability {c.trainability}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18}/></button>
        </div>
        <div className="overflow-y-auto px-6 py-4 space-y-4 text-[13px]">
          <p className="text-gray-700">{c.definition}</p>
          {c.aliases && c.aliases.length > 0 && (
            <Section title="Aliases (normalised to this canonical)">
              <div className="flex flex-wrap gap-1.5">
                {c.aliases.map(a => (
                  <span key={a} className="text-[11px] px-2 py-1 rounded border"
                    style={{ borderColor: BRAND.border, color: '#475569' }}>{a}</span>
                ))}
              </div>
            </Section>
          )}
          {indicatorsByLevel.size > 0 && (
            <Section title="Observable behavioural indicators by proficiency">
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].filter(l => indicatorsByLevel.has(l)).map(l => (
                  <div key={l} className="rounded-lg border p-3" style={{ borderColor: BRAND.border }}>
                    <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">
                      Level {l}
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-gray-700">
                      {(indicatorsByLevel.get(l) || []).map(i => <li key={i}>{i}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          )}
          <Section title="Leadership relevance">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full"
                  style={{ width: `${c.leadership_relevance * 100}%`, background: BRAND.accent }}/>
              </div>
              <span className="text-[12px] font-semibold tabular-nums">
                {(c.leadership_relevance * 100).toFixed(0)}%
              </span>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Workforce taxonomy
// ----------------------------------------------------------------------------
function WorkforcePane() {
  const [rows, setRows]     = useState<RoleRow[]>([]);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoad(true); setError(null);
        const r = await getJSON<RoleRow[]>('/api/ontology/curated/roles');
        if (!cancelled) setRows(r);
      } catch (e: any) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoad(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Group: industry → function → subfunction → role_family → roles
  const tree = useMemo(() => {
    const t: any = {};
    for (const r of rows) {
      t[r.industry_name] ??= {};
      t[r.industry_name][r.function_name] ??= {};
      t[r.industry_name][r.function_name][r.subfunction_name] ??= {};
      t[r.industry_name][r.function_name][r.subfunction_name][r.role_family_name] ??= [];
      t[r.industry_name][r.function_name][r.subfunction_name][r.role_family_name].push(r);
    }
    return t;
  }, [rows]);

  if (loading) return <Loading/>;
  if (error)   return <ErrorState msg={error}/>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Hierarchical taxonomy: Industry → Function → Subfunction → Role Family → Role (with Organisational Layer).
      </p>
      <div className="space-y-3">
        {Object.entries(tree).map(([industry, fns]: any) => (
          <div key={industry} className="rounded-xl border bg-white" style={{ borderColor: BRAND.border }}>
            <div className="px-4 py-3 border-b font-semibold" style={{ borderColor: BRAND.border, color: BRAND.primary }}>
              {industry}
            </div>
            <div className="p-4 space-y-3">
              {Object.entries(fns).map(([fn, sfns]: any) => (
                <div key={fn}>
                  <div className="text-sm font-semibold text-gray-700">{fn}</div>
                  <div className="ml-4 mt-1 space-y-2">
                    {Object.entries(sfns).map(([sfn, rfs]: any) => (
                      <div key={sfn}>
                        <div className="text-[13px] text-gray-600">↳ {sfn}</div>
                        <div className="ml-5 mt-1 space-y-1">
                          {Object.entries(rfs).map(([rf, roles]: any) => (
                            <div key={rf}>
                              <div className="text-[12.5px] text-gray-700 font-medium">{rf}</div>
                              <div className="ml-4 flex flex-wrap gap-1.5 mt-1">
                                {(roles as RoleRow[]).map(role => (
                                  <span key={role.id}
                                    className="text-[11px] px-2 py-1 rounded border"
                                    style={{ borderColor: BRAND.border, color: '#475569' }}>
                                    {role.title}{role.seniority ? ` (${role.seniority})` : ''} · {role.layer_name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Role DNA
// ----------------------------------------------------------------------------
function RoleDNAPane() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [roleId, setRoleId] = useState<string>('');
  const [dna, setDna] = useState<RoleDNA | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await getJSON<RoleRow[]>('/api/ontology/curated/roles');
        setRoles(r);
        if (r.length && !roleId) setRoleId(r[0].id);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!roleId) return;
    let cancelled = false;
    setDna(null); setError(null);
    (async () => {
      try {
        const d = await getJSON<RoleDNA>(`/api/ontology/curated/roles/${roleId}/dna`);
        if (!cancelled) setDna(d);
      } catch (e: any) { if (!cancelled) setError(e.message); }
    })();
    return () => { cancelled = true; };
  }, [roleId]);

  if (loading) return <Loading/>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600">Role:</label>
        <select value={roleId} onChange={e => setRoleId(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border bg-white min-w-[260px]"
          style={{ borderColor: BRAND.border }}>
          {roles.map(r => (
            <option key={r.id} value={r.id}>
              {r.industry_name} · {r.title}{r.seniority ? ` (${r.seniority})` : ''} — {r.layer_name}
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorState msg={error}/>}
      {dna && (
        <div className="grid md:grid-cols-3 gap-4">
          {/* Left: meta */}
          <div className="rounded-xl border bg-white p-4 space-y-3" style={{ borderColor: BRAND.border }}>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Role</div>
              <div className="font-semibold text-base" style={{ color: BRAND.primary }}>
                {dna.role.title}{dna.role.seniority ? ` · ${dna.role.seniority}` : ''}
              </div>
            </div>
            <Meta k="Industry"    v={dna.industry.name}/>
            <Meta k="Function"    v={dna.function.name}/>
            <Meta k="Subfunction" v={dna.subfunction.name}/>
            <Meta k="Role family" v={dna.role_family.name}/>
            <Meta k="Layer"       v={dna.layer.name}/>
            <Meta k="DNA version" v={dna.profile.version}/>
            <Meta k="Weight sum"  v={dna.weight_sum.toFixed(3)}/>
            <p className="text-[12px] text-gray-600 pt-2 border-t" style={{ borderColor: BRAND.border }}>
              Competencies remain stable; only the weights below vary by role context.
            </p>
          </div>
          {/* Right: weights */}
          <div className="md:col-span-2 rounded-xl border bg-white p-4" style={{ borderColor: BRAND.border }}>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
              Role DNA — weighted competency vector
            </div>
            {dna.weights.some(w => isEstimatedSource(w.source)) && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                <span className="font-semibold">Estimated</span> weights are inherited from
                related occupations (O*NET) because this role has no measured ratings —
                treat them as approximate, not measured.
              </p>
            )}
            <div className="space-y-2.5">
              {dna.weights.map(w => (
                <div key={w.competency_id}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-medium flex items-center gap-1.5" style={{ color: BRAND.primary }}>
                      {w.canonical_name}
                      {isEstimatedSource(w.source) && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Estimated
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums text-gray-600">
                      w {(w.weight * 100).toFixed(1)}% · target L{w.expected_level}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-1">
                    <div className="h-full rounded-full"
                      style={{ width: `${w.weight * 100}%`, background: BRAND.accent }}/>
                  </div>
                  {w.rationale && <div className="text-[11px] text-gray-500 mt-1">{w.rationale}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Layers & Proficiency
// ----------------------------------------------------------------------------
function LayersPane() {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [profs, setProfs]   = useState<ProficiencyLevel[]>([]);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoad(true); setError(null);
        const [l, p] = await Promise.all([
          getJSON<Layer[]>('/api/ontology/curated/layers'),
          getJSON<ProficiencyLevel[]>('/api/ontology/proficiency-levels'),
        ]);
        setLayers(l); setProfs(p);
      } catch (e: any) { setError(e.message); }
      finally { setLoad(false); }
    })();
  }, []);

  if (loading) return <Loading/>;
  if (error)   return <ErrorState msg={error}/>;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-base font-bold" style={{ color: BRAND.primary }}>Organisational Layers</h2>
        <p className="text-sm text-gray-600">
          The same competency behaves differently across layers. Score anchors
          below are descriptive (developmental aggregates), not hiring thresholds.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {layers.map(l => (
            <div key={l.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BRAND.border }}>
              <div className="font-semibold text-base mb-2" style={{ color: BRAND.primary }}>{l.name}</div>
              <Meta k="Capability"             v={l.capability_expectations}/>
              <Meta k="Cognitive complexity"   v={l.cognitive_complexity}/>
              <Meta k="Behavioural"            v={l.behavioral_expectations}/>
              <Meta k="Strategic"              v={l.strategic_expectations}/>
              <Meta k="Decision scope"         v={l.decision_scope}/>
              <Meta k="Ambiguity tolerance"    v={l.ambiguity_tolerance}/>
              <Meta k="Accountability"         v={l.leadership_accountability}/>
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t" style={{ borderColor: BRAND.border }}>
                <ScoreCell label="min"  v={l.minimum_score}/>
                <ScoreCell label="med"  v={l.median_score}/>
                <ScoreCell label="high" v={l.high_performer_score}/>
                <ScoreCell label="exc"  v={l.exceptional_score}/>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold" style={{ color: BRAND.primary }}>5-Level Proficiency Model</h2>
        <div className="space-y-2">
          {profs.map(p => (
            <div key={p.level} className="rounded-xl border bg-white p-4" style={{ borderColor: BRAND.border }}>
              <div className="flex items-center gap-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: BRAND.bg, color: BRAND.primary }}>Level {p.level}</span>
                <span className="font-semibold text-sm" style={{ color: BRAND.primary }}>{p.label}</span>
              </div>
              <p className="text-[13px] text-gray-700 mt-1.5">{p.description}</p>
              <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-[12px] text-gray-600">
                <div><b>Indicators:</b> {p.behavioral_indicators_hint}</div>
                <div><b>Complexity:</b> {p.complexity_expectation}</div>
                <div><b>Roles:</b> {p.role_applicability}</div>
                <div><b>Develop:</b> {p.developmental_expectation}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Bits
// ----------------------------------------------------------------------------
function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-[12.5px]">
      <span className="text-gray-500">{k}</span>
      <span className="text-gray-800">{v}</span>
    </div>
  );
}
function ScoreCell({ label, v }: { label: string; v: number }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase text-gray-500">{label}</div>
      <div className="text-base font-bold tabular-nums" style={{ color: BRAND.primary }}>{v}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">{title}</div>
      {children}
    </div>
  );
}
function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 py-12 justify-center">
      <Loader2 size={16} className="animate-spin"/> Loading ontology…
    </div>
  );
}
function ErrorState({ msg }: { msg: string }) {
  return <div className="text-sm p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">Error: {msg}</div>;
}
