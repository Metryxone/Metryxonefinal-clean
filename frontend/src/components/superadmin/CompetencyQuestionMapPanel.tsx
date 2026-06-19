import { useEffect, useMemo, useState, useCallback } from 'react';

interface GridQuestion {
  question_id: string;
  template_key: string;
  competency_code: string | null;
  question_type: string;
  status: string;
  mapped_competency_ids: string[];
}
interface GridCompetency {
  id: string;
  canonical_name: string;
  domain_id: string | null;
}
interface BulkResult {
  ok: boolean;
  mapped: number;
  reactivated: number;
  skipped: { competency_id: string; question_id: string; reason: string }[];
  error?: string;
}

/**
 * Bulk question -> competency mapping tool (T3).
 *
 * Populates onto_competency_question_map so the runtime scorer upgrades from a
 * 7->5 domain-PROXY to PRECISE per-competency scoring. Read-honest: shows the
 * current mapping per question, never fabricates, and surfaces the skip ledger
 * returned by the bulk endpoint.
 */
export default function CompetencyQuestionMapPanel() {
  const [questions, setQuestions] = useState<GridQuestion[]>([]);
  const [competencies, setCompetencies] = useState<GridCompetency[]>([]);
  const [totals, setTotals] = useState<{ total_questions: number; total_mapped: number }>({ total_questions: 0, total_mapped: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetCompetency, setTargetCompetency] = useState('');
  const [competencyFilter, setCompetencyFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/competency-runtime/mapping-grid?status=approved&limit=2000', { credentials: 'include' });
      const d = await r.json();
      if (!r.ok || !d.ok) { setError(d?.error || `Failed to load (${r.status})`); return; }
      const data = d.data || {};
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      setCompetencies(Array.isArray(data.competencies) ? data.competencies : []);
      setTotals({ total_questions: data.total_questions ?? 0, total_mapped: data.total_mapped ?? 0 });
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const compName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of competencies) m.set(c.id, c.canonical_name);
    return m;
  }, [competencies]);

  const visibleQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter((x) =>
      x.template_key.toLowerCase().includes(q) || (x.competency_code || '').toLowerCase().includes(q));
  }, [questions, search]);

  const visibleCompetencies = useMemo(() => {
    const q = competencyFilter.trim().toLowerCase();
    if (!q) return competencies;
    return competencies.filter((c) => c.canonical_name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [competencies, competencyFilter]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === visibleQuestions.length) return new Set();
      return new Set(visibleQuestions.map((q) => q.question_id));
    });
  };

  const applyBulk = async () => {
    if (!targetCompetency || selected.size === 0) return;
    setSaving(true);
    setResult(null);
    setError(null);
    try {
      const pairs = [...selected].map((qid) => ({ competency_id: targetCompetency, question_id: qid }));
      const r = await fetch('/api/competency-runtime/competency-map/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pairs, source: 'curated' }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { setError(d?.data?.error || d?.error || `Bulk map failed (${r.status})`); return; }
      setResult(d.data as BulkResult);
      setSelected(new Set());
      await load();
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Bulk Question → Competency Mapping</h2>
        <p className="text-sm text-gray-500 mt-1">
          Map approved bank questions to competencies. Once a question is mapped, the runtime scorer upgrades
          that competency from a domain-<span className="font-mono">PROXY</span> to a{' '}
          <span className="font-mono">PRECISE</span> per-competency score.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">Questions: <b>{totals.total_questions}</b></span>
        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700">Mapped: <b>{totals.total_mapped}</b></span>
        <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700">Unmapped: <b>{Math.max(totals.total_questions - totals.total_mapped, 0)}</b></span>
        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">Competencies: <b>{competencies.length}</b></span>
      </div>

      {error && <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>}

      {result && (
        <div className="p-3 rounded-md bg-emerald-50 text-emerald-800 text-sm space-y-1">
          <div>Mapped <b>{result.mapped}</b> · reactivated <b>{result.reactivated}</b> · skipped <b>{result.skipped.length}</b>.</div>
          {result.skipped.length > 0 && (
            <ul className="list-disc list-inside text-amber-700">
              {result.skipped.slice(0, 8).map((s, i) => (
                <li key={i}><span className="font-mono">{s.question_id.slice(0, 8)}…</span> → {s.competency_id}: {s.reason}</li>
              ))}
              {result.skipped.length > 8 && <li>…and {result.skipped.length - 8} more</li>}
            </ul>
          )}
        </div>
      )}

      {/* Mapping action bar */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Filter competencies</label>
          <input
            value={competencyFilter}
            onChange={(e) => setCompetencyFilter(e.target.value)}
            placeholder="Search competency…"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm w-56"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">Map selected questions to</label>
          <select
            value={targetCompetency}
            onChange={(e) => setTargetCompetency(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm w-72"
          >
            <option value="">— Choose competency —</option>
            {visibleCompetencies.map((c) => (
              <option key={c.id} value={c.id}>{c.canonical_name} ({c.domain_id || 'no domain'})</option>
            ))}
          </select>
        </div>
        <button
          onClick={applyBulk}
          disabled={saving || !targetCompetency || selected.size === 0}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium disabled:opacity-40"
        >
          {saving ? 'Mapping…' : `Map ${selected.size} selected`}
        </button>
        <div className="flex-1" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions…"
          className="px-3 py-2 border border-gray-300 rounded-md text-sm w-56"
        />
      </div>

      {/* Question grid */}
      {loading ? (
        <div className="text-sm text-gray-500">Loading question bank…</div>
      ) : visibleQuestions.length === 0 ? (
        <div className="text-sm text-gray-500 p-6 text-center border border-dashed border-gray-300 rounded-lg">
          No approved questions found. Author and approve questions first, then map them here.
        </div>
      ) : (
        <div className="overflow-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === visibleQuestions.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2 text-left">Question key</th>
                <th className="px-3 py-2 text-left">Bank code</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Mapped competencies</th>
              </tr>
            </thead>
            <tbody>
              {visibleQuestions.map((q) => (
                <tr key={q.question_id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(q.question_id)} onChange={() => toggle(q.question_id)} />
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-800">{q.template_key}</td>
                  <td className="px-3 py-2 text-gray-500">{q.competency_code || '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{q.question_type}</td>
                  <td className="px-3 py-2">
                    {q.mapped_competency_ids.length === 0 ? (
                      <span className="text-amber-600">Unmapped (domain-proxy only)</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {q.mapped_competency_ids.map((cid) => (
                          <span key={cid} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs">
                            {compName.get(cid) || cid}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
