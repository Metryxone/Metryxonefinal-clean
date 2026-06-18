import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, LayoutGrid, Link2, Info, RefreshCw, Search, Trash2, AlertTriangle, FileQuestion, Layers } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', gray: '#6b7280' };

const CRIT_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-300',
  important: 'bg-blue-100 text-blue-700 border-blue-300',
  desirable: 'bg-gray-100 text-gray-600 border-gray-300',
  optional: 'bg-gray-50 text-gray-400 border-gray-200',
};
const CRIT_TIERS = ['critical', 'important', 'desirable', 'optional'];
const LEVEL_LABELS: Record<number, string> = { 1: 'Awareness', 2: 'Basic', 3: 'Independent', 4: 'Advanced', 5: 'Expert' };

interface BlueprintCompetency {
  id: number; competency_id: string; competency_name: string | null;
  required_level: number; weight: number; criticality: string; source: string; active: boolean;
}
interface Blueprint {
  id: string; blueprint_key: string; name: string; description: string | null;
  source_role_id: string | null; source_role_title: string | null; source: string; active: boolean;
  competency_count: number; weight_total: number; weight_balanced: boolean;
  competencies: BlueprintCompetency[]; updated_at: string | null;
}
interface RoleAssessmentRow {
  id: number; blueprint_id: string; blueprint_name: string | null;
  is_primary: boolean; competency_count: number; source: string; active: boolean;
}
interface RoleAssessmentView {
  role_id: string; role_title: string | null; blueprint_count: number; blueprints: RoleAssessmentRow[];
}
interface QuestionRow {
  id: number; question_id: string; template_key: string | null; question_type: string | null;
  status: string | null; source: string; active: boolean;
}
interface CompetencyQuestionView {
  competency_id: string; competency_name: string | null; question_count: number; questions: QuestionRow[];
}
interface Summary {
  version: string;
  blueprints_total: number;
  blueprint_competencies_total: number;
  unbalanced_blueprints: number;
  blueprint_integrity: { id: string; name: string; weight_total: number; balanced: boolean }[];
  roles_total: number | null;
  roles_mapped: number;
  role_coverage_pct: number | null;
  role_assessments_total: number;
  competencies_total: number | null;
  competencies_with_questions: number;
  competency_question_coverage_pct: number | null;
  question_mappings_total: number;
  questions_available: number;
  source_breakdown: { source: string; count: number }[];
  findings: string[];
}

function MetricCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: (color || BRAND.primary) + '15' }}>
            <Icon className="h-5 w-5" style={{ color: color || BRAND.primary }} />
          </div>
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CritBadge({ c }: { c: string }) {
  return <Badge className={`${CRIT_STYLE[c] ?? CRIT_STYLE.optional} text-[10px] capitalize`}>{c}</Badge>;
}

export default function AssessmentFoundationMappingPanel() {
  const qc = useQueryClient();
  const [view, setView] = React.useState<'blueprints' | 'roles' | 'questions'>('blueprints');
  const [search, setSearch] = React.useState('');

  const summaryQ = useQuery({
    queryKey: ['assessment-foundation-summary'],
    queryFn: async () => {
      const r = await fetch('/api/admin/competency-intelligence/assessment-foundation/summary', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('summary failed');
      return (await r.json()).data as Summary;
    },
  });
  const blueprintsQ = useQuery({
    queryKey: ['assessment-blueprints'],
    queryFn: async () => {
      const r = await fetch('/api/competency-intelligence/blueprints', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('blueprints failed');
      return (await r.json()).data as Blueprint[];
    },
  });
  const rolesQ = useQuery({
    queryKey: ['role-assessments'],
    queryFn: async () => {
      const r = await fetch('/api/competency-intelligence/role-assessments', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('role-assessments failed');
      return (await r.json()).data as RoleAssessmentView[];
    },
  });
  const questionsQ = useQuery({
    queryKey: ['competency-questions'],
    queryFn: async () => {
      const r = await fetch('/api/competency-intelligence/competency-questions', { credentials: 'include' });
      if (r.status === 503) return { __disabled: true } as const;
      if (!r.ok) throw new Error('competency-questions failed');
      return (await r.json()).data as CompetencyQuestionView[];
    },
  });

  const disabled = (summaryQ.data as any)?.__disabled || (blueprintsQ.data as any)?.__disabled;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['assessment-foundation-summary'] });
    qc.invalidateQueries({ queryKey: ['assessment-blueprints'] });
    qc.invalidateQueries({ queryKey: ['role-assessments'] });
    qc.invalidateQueries({ queryKey: ['competency-questions'] });
  };

  const removeBlueprintCompetency = async (id: number) => {
    await fetch(`/api/admin/competency-intelligence/blueprint-competencies/${id}`, { method: 'DELETE', credentials: 'include' });
    refresh();
  };
  const removeRoleAssessment = async (id: number) => {
    await fetch(`/api/admin/competency-intelligence/role-assessments/${id}`, { method: 'DELETE', credentials: 'include' });
    refresh();
  };
  const removeQuestionMapping = async (id: number) => {
    await fetch(`/api/admin/competency-intelligence/competency-questions/${id}`, { method: 'DELETE', credentials: 'include' });
    refresh();
  };

  if (summaryQ.isLoading || blueprintsQ.isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading assessment foundation mappings…</div>;
  }
  if (disabled) {
    return (
      <div className="p-6">
        <Card className="border-dashed border-gray-300 bg-gray-50/60">
          <CardContent className="pt-6 pb-6 flex items-start gap-3">
            <Info className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-700">Assessment Foundation Mapping is disabled</p>
              <p className="text-sm text-gray-500 mt-1">
                Set <code className="px-1 py-0.5 bg-gray-100 rounded">FF_COMPETENCY_FRAMEWORK_INTELLIGENCE=1</code> to
                enable competency → question, role → assessment, and blueprint relationship mappings. Flag OFF keeps every
                existing screen byte-identical.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (summaryQ.isError || blueprintsQ.isError || !blueprintsQ.data || !summaryQ.data) {
    return <div className="p-6 text-sm text-red-600">Failed to load assessment foundation mappings.</div>;
  }

  const summary = summaryQ.data as Summary;
  const blueprints = (blueprintsQ.data as Blueprint[]) ?? [];
  const roleViews = (rolesQ.data as RoleAssessmentView[] | undefined) ?? [];
  const questionViews = (questionsQ.data as CompetencyQuestionView[] | undefined) ?? [];
  const s = search.trim().toLowerCase();
  const shownBlueprints = blueprints.filter((b) =>
    !s || b.name.toLowerCase().includes(s) || b.competencies.some((c) => (c.competency_name ?? '').toLowerCase().includes(s)),
  );

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5" style={{ color: BRAND.primary }} /> Assessment Foundation Mapping
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Foundational mappings only — Competency → Question, Role → Assessment, and Competency Profile → Blueprint.
            Blueprints are projected verbatim from the role competency profiles; every link references existing rows.
            Assessment workflows are never redesigned and the question bank is never mutated.
          </p>
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-md px-3 py-1.5">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={LayoutGrid} label="Blueprints" value={summary.blueprints_total} sub={`${summary.blueprint_competencies_total} competency links`} />
        <MetricCard icon={Link2} label="Roles mapped" value={summary.roles_mapped} sub={summary.role_coverage_pct != null ? `${summary.role_coverage_pct}% of roles` : undefined} color={BRAND.accent} />
        <MetricCard icon={FileQuestion} label="Question links" value={summary.question_mappings_total} sub={`${summary.questions_available} questions available`} color={summary.questions_available > 0 ? BRAND.success : BRAND.gray} />
        <MetricCard icon={AlertTriangle} label="Unbalanced blueprints" value={summary.unbalanced_blueprints} sub="weights ≠ 100" color={summary.unbalanced_blueprints > 0 ? BRAND.warning : BRAND.gray} />
      </div>

      {/* Findings */}
      {summary.findings.length > 0 && (
        <Card className="bg-blue-50/40 border-blue-200">
          <CardContent className="pt-4 pb-4 space-y-1.5">
            {summary.findings.map((f, i) => (
              <p key={i} className="text-sm text-gray-700 flex items-start gap-2"><Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />{f}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* View switcher */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        {([['blueprints', 'Blueprints', LayoutGrid], ['roles', 'Role Assessment', Link2], ['questions', 'Question Mapping', FileQuestion]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${view === id ? 'border-[#344E86] text-[#344E86]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ---- BLUEPRINTS VIEW ---- */}
      {view === 'blueprints' && (
        <>
          <div className="relative max-w-md">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search blueprint or competency…" className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <div className="space-y-4">
            {shownBlueprints.map((b) => (
              <Card key={b.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="h-4 w-4" style={{ color: BRAND.primary }} />
                    <span className="font-semibold text-gray-900">{b.name}</span>
                    <span className="font-mono text-[11px] text-gray-400">{b.id}</span>
                    <Badge className="bg-gray-100 text-gray-500 border-gray-300 text-[10px] capitalize">{b.source}</Badge>
                    <Badge className={`${b.weight_balanced ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-100 text-amber-700 border-amber-300'} text-[10px] ml-auto`}>
                      weight Σ {b.weight_total}{b.weight_balanced ? ' ✓' : ' ⚠'}
                    </Badge>
                    <span className="text-xs text-gray-400">{b.competency_count} competenc{b.competency_count === 1 ? 'y' : 'ies'}</span>
                  </div>
                  {b.source_role_title && (
                    <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                      <Link2 className="h-3 w-3" /> derived from role <span className="font-medium text-gray-600">{b.source_role_title}</span>
                    </p>
                  )}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase text-gray-400">
                        <th className="py-1 font-medium">Competency</th>
                        <th className="py-1 font-medium">Required level</th>
                        <th className="py-1 font-medium">Weight</th>
                        <th className="py-1 font-medium">Criticality</th>
                        <th className="py-1 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.competencies.map((c) => (
                        <tr key={c.id} className={`border-t border-gray-100 ${c.active ? '' : 'opacity-50'}`}>
                          <td className="py-1.5 text-gray-900">{c.competency_name}</td>
                          <td className="py-1.5"><Badge className="bg-indigo-100 text-indigo-700 border-indigo-300 text-[10px]">L{c.required_level} · {LEVEL_LABELS[c.required_level]}</Badge></td>
                          <td className="py-1.5 text-gray-700">{c.weight}%</td>
                          <td className="py-1.5"><CritBadge c={c.criticality} /></td>
                          <td className="py-1.5">
                            <div className="flex items-center justify-end">
                              <button onClick={() => removeBlueprintCompetency(c.id)} className="text-xs text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {b.competencies.length === 0 && <tr><td colSpan={5} className="py-2 text-sm text-gray-400">No competency relationships yet.</td></tr>}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
            {shownBlueprints.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="pt-8 pb-8 text-center text-gray-400 text-sm">
                  No assessment blueprints yet. Run the seed (<code className="px-1 bg-gray-100 rounded">scripts/seed-assessment-foundation-mapping.ts</code>) to derive blueprints from the role competency profiles.
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* ---- ROLE ASSESSMENT VIEW ---- */}
      {view === 'roles' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Each role maps to one or more assessment blueprints. The primary blueprint is the assessment-facing projection of the role's competency profile.</p>
          {roleViews.map((rv) => (
            <Card key={rv.role_id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="h-4 w-4" style={{ color: BRAND.primary }} />
                  <span className="font-semibold text-gray-900">{rv.role_title}</span>
                  <span className="font-mono text-[11px] text-gray-400">{rv.role_id}</span>
                  <span className="text-xs text-gray-400 ml-auto">{rv.blueprint_count} blueprint{rv.blueprint_count === 1 ? '' : 's'}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase text-gray-400">
                      <th className="py-1 font-medium">Blueprint</th>
                      <th className="py-1 font-medium">Competencies</th>
                      <th className="py-1 font-medium">Primary</th>
                      <th className="py-1 font-medium">Source</th>
                      <th className="py-1 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rv.blueprints.map((bp) => (
                      <tr key={bp.id} className={`border-t border-gray-100 ${bp.active ? '' : 'opacity-50'}`}>
                        <td className="py-1.5 text-gray-900">{bp.blueprint_name}<span className="font-mono text-[11px] text-gray-400 ml-2">{bp.blueprint_id}</span></td>
                        <td className="py-1.5 text-gray-700">{bp.competency_count}</td>
                        <td className="py-1.5">{bp.is_primary ? <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-[10px]">primary</Badge> : <span className="text-gray-300">—</span>}</td>
                        <td className="py-1.5"><Badge className="bg-gray-100 text-gray-500 border-gray-300 text-[10px] capitalize">{bp.source}</Badge></td>
                        <td className="py-1.5">
                          <div className="flex items-center justify-end">
                            <button onClick={() => removeRoleAssessment(bp.id)} className="text-xs text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
          {roleViews.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="pt-8 pb-8 text-center text-gray-400 text-sm">
                No role → assessment mappings yet. Run the seed to derive them from the role competency profiles.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ---- QUESTION MAPPING VIEW ---- */}
      {view === 'questions' && (
        <div className="space-y-4">
          {summary.questions_available === 0 ? (
            <Card className="border-dashed border-amber-300 bg-amber-50/40">
              <CardContent className="pt-6 pb-6 flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-700">No questions available to map yet</p>
                  <p className="text-sm text-gray-600 mt-1">
                    The competency → question mapping is foundational infrastructure only. It is derived from the existing
                    question bank (<code className="px-1 bg-white rounded border">competency_question_templates</code>),
                    which is currently empty — so the map is honestly empty and is never seeded with placeholder questions.
                    Once questions are curated, re-run the seed (<code className="px-1 bg-white rounded border">scripts/seed-assessment-foundation-mapping.ts</code>)
                    to derive the links.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                Each competency is linked to questions whose <code className="px-1 bg-gray-100 rounded">competency_code</code> resolves
                to the canonical genome. {summary.competency_question_coverage_pct != null && `${summary.competency_question_coverage_pct}% of competencies have at least one question.`}
              </p>
              {questionViews.map((cv) => (
                <Card key={cv.competency_id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileQuestion className="h-4 w-4" style={{ color: BRAND.primary }} />
                      <span className="font-semibold text-gray-900">{cv.competency_name}</span>
                      <span className="font-mono text-[11px] text-gray-400">{cv.competency_id}</span>
                      <span className="text-xs text-gray-400 ml-auto">{cv.question_count} question{cv.question_count === 1 ? '' : 's'}</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase text-gray-400">
                          <th className="py-1 font-medium">Question</th>
                          <th className="py-1 font-medium">Type</th>
                          <th className="py-1 font-medium">Status</th>
                          <th className="py-1 font-medium">Source</th>
                          <th className="py-1 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cv.questions.map((q) => (
                          <tr key={q.id} className={`border-t border-gray-100 ${q.active ? '' : 'opacity-50'}`}>
                            <td className="py-1.5 text-gray-900">{q.template_key ?? q.question_id}</td>
                            <td className="py-1.5 text-gray-700">{q.question_type ?? '—'}</td>
                            <td className="py-1.5 text-gray-700">{q.status ?? '—'}</td>
                            <td className="py-1.5"><Badge className="bg-gray-100 text-gray-500 border-gray-300 text-[10px] capitalize">{q.source}</Badge></td>
                            <td className="py-1.5">
                              <div className="flex items-center justify-end">
                                <button onClick={() => removeQuestionMapping(q.id)} className="text-xs text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              ))}
              {questionViews.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="pt-8 pb-8 text-center text-gray-400 text-sm">
                    Questions exist but none resolve to a canonical competency yet. Re-run the seed to derive the links.
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
