import React, { useEffect, useMemo, useState } from 'react';

type Question = {
  id: number;
  question_id: string;
  concern_id: string;
  concern_id_prefix: string;
  master_bridge_tag: string;
  text_bridge_tag: string | null;
  concern: string;
  stage: string | null;
  question_type: string | null;
  narrative_style: string | null;
  question: string;
  response_type: string;
  polarity: string;
  reverse_score: string;
  question_weight: number | string;
  option_a: string | null; option_b: string | null;
  option_c: string | null; option_d: string | null; option_e: string | null;
  option_a_score: number; option_b_score: number;
  option_c_score: number; option_d_score: number; option_e_score: number;
  low_score_anchor: string | null;
  high_score_anchor: string | null;
};

type Stats = {
  total_rows: number;
  unique_concerns: number;
  unique_prefixes: number;
  unique_master_bridges: number;
  unmapped_rows: number;
  joinable_rows: number;
};

type Coverage = { bridge: string | null; question_rows: number; concern_rows: number };

const FACET_FIELDS = [
  'concern_id_prefix', 'master_bridge_tag', 'polarity',
  'response_type', 'question_type', 'stage',
] as const;
type FacetField = typeof FACET_FIELDS[number];

const PAGE_SIZE = 50;

async function jsonFetch(url: string) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

const PolarityChip: React.FC<{ value: string }> = ({ value }) => {
  const tone = value === 'positive' ? 'bg-emerald-100 text-emerald-700'
    : value === 'negative' ? 'bg-amber-100 text-amber-700'
    : value === 'mixed' ? 'bg-violet-100 text-violet-700'
    : 'bg-slate-100 text-slate-600';
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${tone}`}>{value}</span>;
};

const BridgePill: React.FC<{ value: string }> = ({ value }) => {
  const tone = value === 'UNMAPPED'
    ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-sky-50 text-sky-700 border-sky-200';
  return <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${tone}`}>{value}</span>;
};

// ============================================================================
// Field config for the editable drawer (config-driven to avoid repetition)
// ============================================================================
type EditField = {
  key: keyof Question;
  label: string;
  kind: 'text' | 'textarea' | 'number' | 'select';
  options?: string[];
  nullable?: boolean;
};

const POLARITY_OPTS = ['negative', 'positive', 'mixed', 'neutral'];
const REVERSE_OPTS = ['no', 'yes'];

const EDIT_GROUPS: { title: string; fields: EditField[] }[] = [
  { title: 'Identity & routing', fields: [
    { key: 'question_id', label: 'Question ID', kind: 'text' },
    { key: 'concern_id', label: 'Concern ID', kind: 'text' },
    { key: 'concern_id_prefix', label: 'Prefix', kind: 'text' },
    { key: 'master_bridge_tag', label: 'Master bridge tag', kind: 'text' },
    { key: 'text_bridge_tag', label: 'Text bridge tag', kind: 'text', nullable: true },
    { key: 'concern', label: 'Concern', kind: 'text' },
  ]},
  { title: 'Classification', fields: [
    { key: 'stage', label: 'Stage', kind: 'text', nullable: true },
    { key: 'question_type', label: 'Question type', kind: 'text', nullable: true },
    { key: 'narrative_style', label: 'Narrative style', kind: 'text', nullable: true },
    { key: 'response_type', label: 'Response type', kind: 'text' },
    { key: 'polarity', label: 'Polarity', kind: 'select', options: POLARITY_OPTS },
    { key: 'reverse_score', label: 'Reverse score', kind: 'select', options: REVERSE_OPTS },
    { key: 'question_weight', label: 'Question weight', kind: 'number' },
  ]},
];

const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e'] as const;

// ============================================================================
// Detail drawer — view + inline edit + every master concern sharing its tag
// ============================================================================
const DetailDrawer: React.FC<{
  row: Question & { linked_master_concerns: any[] };
  startEditing?: boolean;
  onClose: () => void;
  onSaved: (updated: Question) => void;
}> = ({ row, startEditing = false, onClose, onSaved }) => {
  const [editing, setEditing] = useState(startEditing);
  const [form, setForm] = useState<Record<string, any>>({ ...row });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => { setForm({ ...row }); setEditing(startEditing); setSaveError(null); }, [row, startEditing]);

  const setField = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true); setSaveError(null);
    try {
      const payload: Record<string, any> = {};
      // Identity / classification fields
      EDIT_GROUPS.flatMap(g => g.fields).forEach(f => {
        const v = form[f.key as string];
        payload[f.key as string] = f.kind === 'number' ? Number(v) : (v ?? '');
      });
      payload.question = form.question ?? '';
      payload.low_score_anchor = form.low_score_anchor ?? '';
      payload.high_score_anchor = form.high_score_anchor ?? '';
      OPTION_LETTERS.forEach(l => {
        payload[`option_${l}`] = form[`option_${l}`] ?? '';
        payload[`option_${l}_score`] = Number(form[`option_${l}_score`] ?? 0);
      });
      const r = await fetch(`/api/admin/capadex/clarity-questions/${row.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `PATCH → ${r.status}`);
      onSaved(data);
      setEditing(false);
    } catch (e: any) {
      setSaveError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full border border-slate-300 rounded px-2 py-1 text-xs';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}
         role="dialog" aria-modal="true" aria-labelledby="clarity-detail-heading">
      <aside className="w-full max-w-2xl h-full bg-white shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}
             data-testid="drawer-clarity-detail">
        <header className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 z-10">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="text-xs font-mono text-slate-500 truncate">{row.question_id}</div>
              <h2 id="clarity-detail-heading" className="text-base font-semibold text-slate-900 mt-0.5">
                {row.concern}
              </h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <BridgePill value={row.master_bridge_tag} />
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600">{row.concern_id}</span>
                <PolarityChip value={row.polarity} />
                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-50 text-slate-600 border border-slate-200">
                  weight {Number(row.question_weight).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3">
              {!editing && (
                <button onClick={() => setEditing(true)}
                        className="px-3 py-1.5 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                        data-testid="button-edit-drawer">Edit</button>
              )}
              <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
          </div>
        </header>

        {!editing ? (
          <div className="px-5 py-4 space-y-4 text-sm">
            <section>
              <div className="text-xs uppercase text-slate-500 mb-1">Question</div>
              <p className="text-slate-800">{row.question}</p>
            </section>
            <section className="grid grid-cols-2 gap-2">
              {OPTION_LETTERS.map(letter => {
                const text  = (row as any)[`option_${letter}`] as string | null;
                const score = (row as any)[`option_${letter}_score`] as number;
                if (!text) return null;
                return (
                  <div key={letter} className="rounded border border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Option {letter.toUpperCase()}</span>
                      <span className="text-xs font-mono text-slate-500">score {score}</span>
                    </div>
                    <p className="text-xs text-slate-700 mt-1">{text}</p>
                  </div>
                );
              })}
            </section>
            <section className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs uppercase text-slate-500">Low-score anchor</div>
                <p className="text-xs text-slate-700 mt-0.5">{row.low_score_anchor || '—'}</p>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">High-score anchor</div>
                <p className="text-xs text-slate-700 mt-0.5">{row.high_score_anchor || '—'}</p>
              </div>
            </section>
            <section className="grid grid-cols-3 gap-3 text-xs text-slate-700">
              <div><span className="text-slate-500">Response type:</span> {row.response_type}</div>
              <div><span className="text-slate-500">Question type:</span> {row.question_type ?? '—'}</div>
              <div><span className="text-slate-500">Narrative:</span> {row.narrative_style ?? '—'}</div>
              <div><span className="text-slate-500">Reverse:</span> {row.reverse_score}</div>
              <div><span className="text-slate-500">Prefix:</span> {row.concern_id_prefix}</div>
              <div><span className="text-slate-500">Text bridge:</span> <span className="font-mono">{row.text_bridge_tag ?? '—'}</span></div>
            </section>
            <section>
              <div className="text-xs uppercase text-slate-500 mb-2">
                Linked master concerns (via bridge tag <span className="font-mono">{row.master_bridge_tag}</span>)
              </div>
              {row.linked_master_concerns.length === 0
                ? <p className="text-xs text-slate-500">No master concerns share this bridge tag.</p>
                : (
                  <ul className="space-y-1">
                    {row.linked_master_concerns.map((c: any) => (
                      <li key={c.id} className="rounded border border-slate-200 px-2 py-1 text-xs">
                        <span className="font-mono text-slate-500">{c.concern_id}</span>
                        {' · '}<span className="text-slate-700">{c.domain}</span>
                        {' · '}<span className="text-slate-500">{c.concern_cluster}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </section>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-5 text-sm">
            {saveError && (
              <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-xs">{saveError}</div>
            )}
            {EDIT_GROUPS.map(group => (
              <section key={group.title}>
                <div className="text-xs uppercase text-slate-500 mb-2">{group.title}</div>
                <div className="grid grid-cols-2 gap-3">
                  {group.fields.map(f => (
                    <label key={f.key as string} className="flex flex-col">
                      <span className="text-[10px] uppercase text-slate-500 mb-1">{f.label}</span>
                      {f.kind === 'select' ? (
                        <select className={`${inputCls} bg-white`} value={form[f.key as string] ?? ''}
                                onChange={e => setField(f.key as string, e.target.value)}
                                data-testid={`edit-${f.key}`}>
                          {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={f.kind === 'number' ? 'number' : 'text'} step="any"
                               className={inputCls} value={form[f.key as string] ?? ''}
                               onChange={e => setField(f.key as string, e.target.value)}
                               data-testid={`edit-${f.key}`} />
                      )}
                    </label>
                  ))}
                </div>
              </section>
            ))}
            <section>
              <div className="text-xs uppercase text-slate-500 mb-2">Question</div>
              <textarea className={`${inputCls} min-h-[72px]`} value={form.question ?? ''}
                        onChange={e => setField('question', e.target.value)} data-testid="edit-question" />
            </section>
            <section>
              <div className="text-xs uppercase text-slate-500 mb-2">Options & scores</div>
              <div className="space-y-2">
                {OPTION_LETTERS.map(l => (
                  <div key={l} className="flex items-center gap-2">
                    <span className="w-5 text-xs font-semibold text-slate-600 uppercase">{l}</span>
                    <input className={`${inputCls} flex-1`} placeholder={`Option ${l.toUpperCase()} text`}
                           value={form[`option_${l}`] ?? ''}
                           onChange={e => setField(`option_${l}`, e.target.value)}
                           data-testid={`edit-option-${l}`} />
                    <input type="number" className={`${inputCls} w-20`} placeholder="score"
                           value={form[`option_${l}_score`] ?? 0}
                           onChange={e => setField(`option_${l}_score`, e.target.value)}
                           data-testid={`edit-option-${l}-score`} />
                  </div>
                ))}
              </div>
            </section>
            <section className="grid grid-cols-2 gap-3">
              <label className="flex flex-col">
                <span className="text-[10px] uppercase text-slate-500 mb-1">Low-score anchor</span>
                <input className={inputCls} value={form.low_score_anchor ?? ''}
                       onChange={e => setField('low_score_anchor', e.target.value)} data-testid="edit-low-anchor" />
              </label>
              <label className="flex flex-col">
                <span className="text-[10px] uppercase text-slate-500 mb-1">High-score anchor</span>
                <input className={inputCls} value={form.high_score_anchor ?? ''}
                       onChange={e => setField('high_score_anchor', e.target.value)} data-testid="edit-high-anchor" />
              </label>
            </section>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 -mx-5 px-5 py-3 flex items-center justify-end gap-2">
              <button onClick={() => { setForm({ ...row }); setEditing(false); setSaveError(null); }}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                      className="px-3 py-1.5 text-xs rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                      data-testid="button-save-edit">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

// ============================================================================
// Bridge-tag detail drawer — drills into one coverage row: the clarity
// questions AND master concerns that share this bridge tag (read-only).
// ============================================================================
type BridgeClarity = { id: number; question_id: string; question: string; concern: string; polarity: string };
type BridgeConcern = { concern_id: string; concern_cluster: string | null; primary_persona: string | null; domain: string | null; age_min: number | null; age_max: number | null };

const DETAIL_LIMIT = 200;

const BridgeTagDetailDrawer: React.FC<{ row: Coverage; onClose: () => void }> = ({ row, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clarity, setClarity] = useState<BridgeClarity[]>([]);
  const [concerns, setConcerns] = useState<BridgeConcern[]>([]);
  const tag = row.bridge ?? '';

  const status =
    row.question_rows > 0 && row.concern_rows > 0 ? 'Linked'
    : row.question_rows > 0 ? 'Questions-only (orphan)'
    : 'Concerns-only (no questions)';
  const tone =
    status === 'Linked' ? 'text-emerald-700'
    : status.startsWith('Questions') ? 'text-amber-700'
    : 'text-slate-500';

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const enc = encodeURIComponent(tag);
        const [cq, cm] = await Promise.all([
          row.question_rows > 0 && tag
            ? jsonFetch(`/api/admin/capadex/clarity-questions?master_bridge_tag=${enc}&pageSize=${DETAIL_LIMIT}`)
            : Promise.resolve({ rows: [] }),
          row.concern_rows > 0 && tag
            ? jsonFetch(`/api/admin/capadex/concerns-master?bridge=${enc}&pageSize=${DETAIL_LIMIT}`)
            : Promise.resolve({ rows: [] }),
        ]);
        if (!alive) return;
        setClarity(cq.rows ?? []);
        setConcerns(cm.rows ?? []);
      } catch (e) {
        if (alive) setError(String((e as Error).message ?? e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tag, row.question_rows, row.concern_rows]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
         onClick={(e) => { e.stopPropagation(); onClose(); }}
         role="dialog" aria-modal="true" aria-label={`Bridge tag ${tag} detail`}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="border-b border-slate-200 px-5 py-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono border bg-sky-50 text-sky-700 border-sky-200">{tag || '—'}</span>
              <span className={`text-xs font-medium ${tone}`}>{status}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {row.question_rows.toLocaleString()} clarity question(s) · {row.concern_rows.toLocaleString()} master concern(s) share this bridge tag.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-xl" data-testid="button-close-bridge-detail">×</button>
        </header>

        <div className="overflow-y-auto px-5 py-4 space-y-6">
          {loading && <div className="text-center text-slate-500 py-8 text-sm">Loading…</div>}
          {error && <div className="text-center text-red-600 py-8 text-sm">{error}</div>}
          {!loading && !error && (
            <>
              <section>
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  Master concerns ({concerns.length}{row.concern_rows > concerns.length ? ` of ${row.concern_rows.toLocaleString()}` : ''})
                </h3>
                {concerns.length === 0
                  ? <p className="text-xs text-slate-400">No master concerns in this bucket (orphan tag).</p>
                  : (
                    <div className="overflow-x-auto border border-slate-100 rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr className="text-left text-slate-500">
                            <th className="px-2 py-1.5">Concern ID</th>
                            <th className="px-2 py-1.5">Cluster</th>
                            <th className="px-2 py-1.5">Persona</th>
                            <th className="px-2 py-1.5">Domain</th>
                            <th className="px-2 py-1.5 text-right">Age</th>
                          </tr>
                        </thead>
                        <tbody>
                          {concerns.map(c => (
                            <tr key={c.concern_id} className="border-t border-slate-100">
                              <td className="px-2 py-1.5 font-mono text-[11px] text-slate-700">{c.concern_id}</td>
                              <td className="px-2 py-1.5 text-slate-800">{c.concern_cluster ?? '—'}</td>
                              <td className="px-2 py-1.5 text-slate-600">{c.primary_persona ?? '—'}</td>
                              <td className="px-2 py-1.5 text-slate-600">{c.domain ?? '—'}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                                {c.age_min != null && c.age_max != null ? `${c.age_min}–${c.age_max}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </section>

              <section>
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  Clarity questions ({clarity.length}{row.question_rows > clarity.length ? ` of ${row.question_rows.toLocaleString()}` : ''})
                </h3>
                {clarity.length === 0
                  ? <p className="text-xs text-slate-400">No clarity questions in this bucket (orphan tag).</p>
                  : (
                    <div className="overflow-x-auto border border-slate-100 rounded">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr className="text-left text-slate-500">
                            <th className="px-2 py-1.5">Question ID</th>
                            <th className="px-2 py-1.5">Question</th>
                            <th className="px-2 py-1.5">Concern</th>
                            <th className="px-2 py-1.5">Polarity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clarity.map(q => (
                            <tr key={q.id} className="border-t border-slate-100">
                              <td className="px-2 py-1.5 font-mono text-[11px] text-slate-700">{q.question_id}</td>
                              <td className="px-2 py-1.5 text-slate-800">{q.question.length > 120 ? q.question.slice(0, 120) + '…' : q.question}</td>
                              <td className="px-2 py-1.5 text-slate-600">{q.concern}</td>
                              <td className="px-2 py-1.5"><PolarityChip value={q.polarity} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                {row.question_rows > clarity.length && (
                  <p className="text-[11px] text-slate-400 mt-2">Showing first {DETAIL_LIMIT}. Use the main table filter (bridge tag {tag}) to page through all.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Coverage overlay — bridge-tag coverage matrix (question_rows vs concern_rows)
// ============================================================================
const CoverageOverlay: React.FC<{ rows: Coverage[]; onClose: () => void }> = ({ rows, onClose }) => {
  const [selected, setSelected] = useState<Coverage | null>(null);
  return (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}
       role="dialog" aria-modal="true" aria-labelledby="clarity-coverage-heading">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
      <header className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
        <div>
          <h2 id="clarity-coverage-heading" className="text-lg font-semibold text-slate-900">Bridge-tag coverage</h2>
          <p className="text-xs text-slate-500 mt-1">
            Each row is one bridge bucket. <span className="font-mono">question_rows</span> = clarity items in this bucket;
            <span className="font-mono"> concern_rows</span> = master concerns in this bucket. Zero on either side = orphan.
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-xl">×</button>
      </header>
      <div className="overflow-y-auto px-5 py-3">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2">Bridge tag</th>
              <th className="text-right">Clarity questions</th>
              <th className="text-right">Master concerns</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const status =
                r.question_rows > 0 && r.concern_rows > 0 ? 'Linked'
                : r.question_rows > 0 ? 'Questions-only (orphan)'
                : 'Concerns-only (no questions)';
              const tone =
                status === 'Linked' ? 'text-emerald-700'
                : status.startsWith('Questions') ? 'text-amber-700'
                : 'text-slate-500';
              return (
                <tr key={String(r.bridge)} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-1.5 font-mono">{r.bridge ?? '—'}</td>
                  <td className="text-right tabular-nums">{r.question_rows.toLocaleString()}</td>
                  <td className="text-right tabular-nums">{r.concern_rows.toLocaleString()}</td>
                  <td className={tone}>{status}</td>
                  <td className="text-right">
                    <button onClick={() => setSelected(r)}
                            className="text-[11px] text-sky-700 hover:underline disabled:opacity-40 disabled:no-underline"
                            disabled={!r.bridge}
                            data-testid={`button-view-bridge-${r.bridge ?? 'none'}`}>View</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    {selected && <BridgeTagDetailDrawer row={selected} onClose={() => setSelected(null)} />}
  </div>
  );
};

// ============================================================================
// Main panel
// ============================================================================
const CapadexClarityQuestionsPanel: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [facets, setFacets] = useState<Record<FacetField, string[]>>({} as any);
  const [rows, setRows] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<FacetField, string>>({} as any);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<(Question & { linked_master_concerns: any[] }) | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [coverageRows, setCoverageRows] = useState<Coverage[] | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  async function loadStatsAndFacets() {
    try {
      const [s, f] = await Promise.all([
        jsonFetch('/api/admin/capadex/clarity-questions/stats'),
        jsonFetch('/api/admin/capadex/clarity-questions/facets'),
      ]);
      setStats(s); setFacets(f);
    } catch (e: any) { setError(String(e?.message ?? e)); }
  }

  async function loadList(p = page) {
    setLoading(true); setError(null);
    try {
      const url = `/api/admin/capadex/clarity-questions${buildQuery({
        page: p, pageSize: PAGE_SIZE, search, ...filters,
      })}`;
      const data = await jsonFetch(url);
      setRows(data.rows); setTotal(data.total); setPage(data.page);
    } catch (e: any) { setError(String(e?.message ?? e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadStatsAndFacets(); }, []);
  useEffect(() => { loadList(1); /* eslint-disable-next-line */ }, [search, JSON.stringify(filters)]);
  useEffect(() => { loadList(page); /* eslint-disable-next-line */ }, [page]);

  async function openDetail(id: number, edit = false) {
    try {
      const data = await jsonFetch(`/api/admin/capadex/clarity-questions/${id}`);
      setDetailRow(data); setDetailEditing(edit);
    } catch (e: any) { setError(String(e?.message ?? e)); }
  }

  function exportRow(id: number) {
    window.open(`/api/admin/capadex/clarity-questions/${id}/export.csv`, '_blank');
  }

  function onRowSaved(updated: Question) {
    // Patch the in-memory list and the open drawer so the UI reflects the edit
    // without a full reload (drawer keeps `linked_master_concerns`).
    setRows(rs => rs.map(r => (r.id === updated.id ? { ...r, ...updated } : r)));
    setDetailRow(d => (d && d.id === updated.id ? { ...d, ...updated } : d));
  }

  async function openCoverage() {
    try {
      const data = await jsonFetch('/api/admin/capadex/clarity-questions/coverage');
      setCoverageRows(data.rows);
    } catch (e: any) { setError(String(e?.message ?? e)); }
  }

  function exportCsv() {
    const url = `/api/admin/capadex/clarity-questions/export.csv${buildQuery({ search, ...filters })}`;
    window.open(url, '_blank');
  }

  const joinPct = stats ? (100 * stats.joinable_rows / stats.total_rows) : 0;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-6 py-5 text-sm" data-testid="panel-clarity-questions">
      <header className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Clarity Questions</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audited child pool · linked to <span className="font-mono">capadex_concerns_master</span> via{' '}
            <span className="font-mono">master_bridge_tag</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openCoverage} className="px-3 py-1.5 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  data-testid="button-coverage">Bridge coverage</button>
          <button onClick={() => setShowImport(true)} className="px-3 py-1.5 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  data-testid="button-import">Import CSV</button>
          <button onClick={exportCsv} className="px-3 py-1.5 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  data-testid="button-export">Export CSV</button>
          <button onClick={() => { loadStatsAndFacets(); loadList(page); }}
                  className="px-3 py-1.5 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                  data-testid="button-refresh">Refresh</button>
        </div>
      </header>

      {importNotice && (
        <div role="status" data-testid="import-notice"
             className="mb-4 flex items-start justify-between gap-3 rounded border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <span>{importNotice}</span>
          <button onClick={() => setImportNotice(null)} aria-label="Dismiss"
                  className="text-emerald-600 hover:text-emerald-900 text-lg leading-none">×</button>
        </div>
      )}

      {/* Stat strip */}
      {stats && (
        <section className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
          {[
            ['Rows', stats.total_rows],
            ['Unique concerns', stats.unique_concerns],
            ['Legacy prefixes', stats.unique_prefixes],
            ['Master buckets', stats.unique_master_bridges],
            ['UNMAPPED rows', stats.unmapped_rows],
            ['Joinable to master', `${joinPct.toFixed(1)}%`],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded border border-slate-200 bg-white px-3 py-2">
              <div className="text-[10px] uppercase text-slate-500">{label as string}</div>
              <div className="text-base font-semibold text-slate-900">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Filter bar */}
      <section className="rounded border border-slate-200 bg-white px-3 py-3 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <label className="flex flex-col">
            <span className="text-[10px] uppercase text-slate-500 mb-1">Search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="question / concern / id…"
              className="border border-slate-300 rounded px-2 py-1 text-xs"
              data-testid="input-search"
            />
          </label>
          {FACET_FIELDS.map(f => (
            <label key={f} className="flex flex-col">
              <span className="text-[10px] uppercase text-slate-500 mb-1">{f.replace(/_/g, ' ')}</span>
              <select
                value={filters[f] ?? ''}
                onChange={e => setFilters(p => ({ ...p, [f]: e.target.value }))}
                className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"
                data-testid={`filter-${f}`}
              >
                <option value="">All</option>
                {(facets[f] ?? []).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-xs mb-3">
          {error}
        </div>
      )}

      {/* Table */}
      <section className="rounded border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600 border-b border-slate-200">
              <th className="px-3 py-2 w-44">Question ID</th>
              <th className="px-3 py-2">Question</th>
              <th className="px-3 py-2 w-44">Concern</th>
              <th className="px-3 py-2 w-40">Bridge</th>
              <th className="px-3 py-2 w-20">Polarity</th>
              <th className="px-3 py-2 w-36 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Loading…</td></tr>
              : rows.length === 0
                ? <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No questions match.</td></tr>
                : rows.map(r => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{r.question_id}</td>
                      <td className="px-3 py-2 text-slate-800">{r.question.length > 110 ? r.question.slice(0, 110) + '…' : r.question}</td>
                      <td className="px-3 py-2 text-slate-700">{r.concern}</td>
                      <td className="px-3 py-2"><BridgePill value={r.master_bridge_tag} /></td>
                      <td className="px-3 py-2"><PolarityChip value={r.polarity} /></td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => openDetail(r.id)}
                                  className="text-[11px] text-sky-700 hover:underline"
                                  data-testid={`button-view-${r.id}`}>View</button>
                          <button onClick={() => openDetail(r.id, true)}
                                  className="text-[11px] text-slate-700 hover:underline"
                                  data-testid={`button-edit-${r.id}`}>Edit</button>
                          <button onClick={() => exportRow(r.id)}
                                  className="text-[11px] text-slate-700 hover:underline"
                                  data-testid={`button-export-${r.id}`}>Export</button>
                        </div>
                      </td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </section>

      {/* Pagination */}
      <footer className="flex items-center justify-between mt-3 text-xs text-slate-600">
        <div>
          Showing <span className="font-medium">{rows.length}</span> of{' '}
          <span className="font-medium">{total.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40">Prev</button>
          <span>page {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40">Next</button>
        </div>
      </footer>

      {detailRow && (
        <DetailDrawer
          row={detailRow}
          startEditing={detailEditing}
          onClose={() => { setDetailRow(null); setDetailEditing(false); }}
          onSaved={onRowSaved}
        />
      )}
      {coverageRows && <CoverageOverlay rows={coverageRows} onClose={() => setCoverageRows(null)} />}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={(s) => {
            setShowImport(false);
            const parts = [`${s.written} written`, `${s.inserted} inserted`, `${s.updated} updated`];
            if (s.skipped) parts.push(`${s.skipped} skipped`);
            if (s.errorCount) parts.push(`${s.errorCount} errors`);
            setImportNotice(`CSV import (${s.mode}): ${parts.join(' · ')}.`);
            loadStatsAndFacets();
            loadList(page);
          }}
        />
      )}
    </div>
  );
};

type ImportSummary = {
  mode: string;
  dryRun: boolean;
  parsed: number;
  validRows: number;
  errors: Array<{ row: number; reason: string }>;
  errorCount: number;
  written: number;
  inserted: number;
  updated: number;
  skipped: number;
};

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (summary: ImportSummary) => void }) {
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'append' | 'upsert' | 'replace'>('upsert');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(dryRun: boolean) {
    setError(null);
    const f = fileRef.current?.files?.[0];
    if (!f) { setError('Choose a CSV file first.'); return; }
    const fd = new FormData();
    fd.append('file', f);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/capadex/clarity-questions/import?mode=${mode}${dryRun ? '&dryRun=1' : ''}`,
        { method: 'POST', credentials: 'include', body: fd },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || res.statusText);
      setSummary(body as ImportSummary);
      if (!dryRun) onImported(body as ImportSummary);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="clarity-import-heading">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()} data-testid="modal-import-clarity">
        <header className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h2 id="clarity-import-heading" className="text-lg font-semibold text-slate-900">Import CSV</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </header>
        <div className="px-5 py-4 space-y-4 text-sm">
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">CSV file</label>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="block w-full text-sm" data-testid="input-import-file" />
            <p className="text-xs text-slate-500 mt-1">
              Headers may be snake_case (matches Export CSV) or human form (<code>Question ID</code>…). The
              {' '}<code>id</code>, <code>created_at</code>, <code>updated_at</code> columns are ignored.
              Required: <code>question_id, concern_id, concern_id_prefix, concern, question</code>.
              Blank cells inherit column defaults (e.g. <code>polarity=negative</code>).
            </p>
            <p className="text-xs mt-1.5">
              <a href="/api/admin/capadex/clarity-questions/template.csv"
                 className="text-blue-600 hover:text-blue-800 underline font-medium"
                 data-testid="link-import-template">
                ↓ Download import template (.csv)
              </a>
              <span className="text-slate-400"> — header row + one example row to fill in.</span>
            </p>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Mode</label>
            <div className="space-y-1.5">
              {[
                ['upsert',  'Upsert by question_id (insert new, update existing)'],
                ['append',  'Append (insert new; existing question_id skipped)'],
                ['replace', 'Replace (TRUNCATE table then insert all rows)'],
              ].map(([k, label]) => (
                <label key={k} className="flex items-start gap-2">
                  <input type="radio" name="clarity-import-mode" checked={mode === k} onChange={() => setMode(k as any)} className="mt-1" />
                  <span><b className="text-slate-800">{k}</b> — <span className="text-slate-600">{label}</span></span>
                </label>
              ))}
            </div>
          </div>

          {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-xs">{error}</div>}

          {summary && (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs space-y-1">
              <div><b>Mode:</b> {summary.mode}{summary.dryRun && ' (dry run)'}</div>
              <div><b>Parsed:</b> {summary.parsed} · <b>Valid:</b> {summary.validRows}</div>
              {summary.errorCount > 0 && <div className="text-red-700"><b>Errors:</b> {summary.errorCount} (showing first {summary.errors.length})</div>}
              {summary.errors.slice(0, 5).map((e, i) => <div key={i} className="font-mono text-[10px] text-red-700">  row {e.row}: {e.reason}</div>)}
              {!summary.dryRun && summary.written > 0 && (
                <div className="text-emerald-700"><b>Written:</b> {summary.written} (inserted {summary.inserted ?? 0}, updated {summary.updated ?? 0}{summary.skipped ? `, skipped ${summary.skipped}` : ''})</div>
              )}
            </div>
          )}
        </div>
        <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-slate-300 bg-white">Close</button>
          <button onClick={() => submit(true)} disabled={busy} className="px-3 py-1.5 text-sm rounded border border-slate-300 bg-white disabled:opacity-50" data-testid="button-import-dryrun">
            {busy ? 'Working …' : 'Dry-run'}
          </button>
          <button onClick={() => submit(false)} disabled={busy} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" data-testid="button-import-submit">
            {busy ? 'Importing …' : 'Import'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default CapadexClarityQuestionsPanel;
