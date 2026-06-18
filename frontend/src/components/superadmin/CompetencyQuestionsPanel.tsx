import React, { useEffect, useMemo, useState } from 'react';

type Row = {
  id: string;
  template_key: string;
  competency_code: string;
  question_type: string;
  difficulty_band: string;
  status: 'draft' | 'approved' | 'rejected' | 'archived';
  source: 'manual' | 'generated' | 'seed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
  notes: string | null;
  template_body: {
    prompt?: string;
    options?: string[];
    best_option?: number;
    depth?: string;
    role_tags?: string[];
    industry_tags?: string[];
    stage_tags?: string[];
    function_tags?: string[];
    pool_key?: string;
    origin_id?: string;
  };
};

const DOMAINS = ['', 'COG', 'COM', 'LEA', 'EXE', 'ADP', 'TEC', 'EIQ'];
const STATUSES: Array<'' | Row['status']> = ['', 'draft', 'approved', 'rejected', 'archived'];
const SOURCES: Array<'' | Row['source']> = ['', 'seed', 'manual', 'generated'];
const TYPES = ['mcq', 'sjt', 'scenario', 'case', 'behavioral', 'communication'];
const BANDS = ['easy', 'medium', 'hard'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
  archived: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function CompetencyQuestionsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState<'' | Row['status']>('');
  const [code, setCode] = useState('');
  const [source, setSource] = useState<'' | Row['source']>('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [gen, setGen] = useState<{ count: number; code: string }>({ count: 10, code: '' });
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<{ totals: Array<{ status: string; n: number }> }>({ totals: [] });

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (code)   qs.set('competency_code', code);
      if (source) qs.set('source', source);
      if (search) qs.set('search', search);
      const r = await fetch(`/api/admin/competency-questions?${qs.toString()}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'load failed');
      setRows(j.rows || []);
      const s = await fetch('/api/admin/competency-questions/stats', { credentials: 'include' }).then((x) => x.json());
      if (s?.ok) setStats({ totals: s.totals || [] });
    } catch (e: any) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, code, source]);

  const totalsByStatus = useMemo(() => {
    const m: Record<string, number> = {};
    stats.totals.forEach((t) => { m[t.status] = t.n; });
    return m;
  }, [stats]);

  const startNew = () => setEditing({
    id: '', template_key: '', competency_code: 'COG', question_type: 'mcq', difficulty_band: 'medium',
    status: 'draft', source: 'manual', reviewed_by: null, reviewed_at: null, updated_at: '',
    notes: '', template_body: { prompt: '', options: ['', '', '', ''], best_option: 0, role_tags: [], industry_tags: [], stage_tags: [], function_tags: [] },
  });

  const save = async (row: Row) => {
    setBusy(true); setErr('');
    try {
      const cleanOpts = (row.template_body.options || []).filter((o) => o.trim().length > 0);
      // Re-anchor best_option to the still-present option (the index may have
      // shifted when empty entries were dropped). If the originally-marked
      // best option was empty, fall back to 0 and warn the admin.
      const origBest = row.template_body.best_option ?? 0;
      const origLabel = (row.template_body.options || [])[origBest] || '';
      let bestOption = cleanOpts.findIndex((o) => o === origLabel);
      if (bestOption < 0) bestOption = 0;
      if (cleanOpts.length < 2) { setErr('Need at least 2 non-empty options.'); setBusy(false); return; }
      const body = {
        competency_code: row.competency_code,
        question_type: row.question_type,
        difficulty_band: row.difficulty_band,
        status: row.status,
        notes: row.notes,
        prompt: row.template_body.prompt,
        options: cleanOpts,
        best_option: bestOption,
        depth: row.template_body.depth || 'standard',
        role_tags: row.template_body.role_tags || [],
        industry_tags: row.template_body.industry_tags || [],
        stage_tags: row.template_body.stage_tags || [],
        function_tags: row.template_body.function_tags || [],
      };
      const url = row.id ? `/api/admin/competency-questions/${row.id}` : '/api/admin/competency-questions';
      const method = row.id ? 'PATCH' : 'POST';
      const r = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'save failed');
      setEditing(null);
      await load();
    } catch (e: any) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  };

  const setStatusFor = async (row: Row, next: Row['status']) => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/admin/competency-questions/${row.id}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'status update failed');
      await load();
    } catch (e: any) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  };

  const del = async (row: Row) => {
    if (!confirm(`Delete "${row.template_body?.prompt?.slice(0, 60)}..."?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/competency-questions/${row.id}`, { method: 'DELETE', credentials: 'include' });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'delete failed');
      await load();
    } catch (e: any) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  };

  const generate = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/admin/competency-questions/generate', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: gen.count, competency_code: gen.code || undefined }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'generate failed');
      setStatus('draft');
      await load();
      alert(`Generated ${j.generated} draft variant(s). Review & approve below.`);
    } catch (e: any) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  };

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => (r.template_body.prompt || '').toLowerCase().includes(q) || r.template_key.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-900">Competency Assessment — Question Bank</h2>
        <p className="text-sm text-slate-600">
          Manage the dynamic question pool. Only <span className="font-semibold text-emerald-700">approved</span> questions surface to users.
          Generated drafts must be reviewed + approved manually.
        </p>
      </header>

      <div className="grid grid-cols-4 gap-3 text-sm">
        {(['approved', 'draft', 'rejected', 'archived'] as const).map((s) => (
          <div key={s} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">{s}</div>
            <div className="text-2xl font-semibold text-slate-900">{totalsByStatus[s] ?? 0}</div>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Generator</h3>
          <span className="text-xs text-slate-500">Creates draft variants from approved seeds — no LLM, deterministic transforms.</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600">Count
            <input type="number" min={1} max={50} value={gen.count}
              onChange={(e) => setGen({ ...gen, count: Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
              className="ml-2 w-20 rounded border border-slate-300 px-2 py-1 text-sm" />
          </label>
          <label className="text-xs text-slate-600">Domain (optional)
            <select value={gen.code} onChange={(e) => setGen({ ...gen, code: e.target.value })}
              className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm">
              {DOMAINS.map((d) => <option key={d} value={d}>{d || 'any'}</option>)}
            </select>
          </label>
          <button onClick={generate} disabled={busy}
            className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
            Generate drafts
          </button>
          <button onClick={startNew} disabled={busy}
            className="px-3 py-1.5 rounded border border-slate-300 text-sm hover:bg-slate-50">
            + New question
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="rounded border border-slate-300 px-2 py-1 text-sm">
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'all statuses'}</option>)}
          </select>
          <select value={code} onChange={(e) => setCode(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm">
            {DOMAINS.map((d) => <option key={d} value={d}>{d || 'all domains'}</option>)}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value as any)} className="rounded border border-slate-300 px-2 py-1 text-sm">
            {SOURCES.map((s) => <option key={s} value={s}>{s || 'all sources'}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search prompt..." className="rounded border border-slate-300 px-2 py-1 text-sm flex-1 min-w-[200px]" />
          <button onClick={load} disabled={busy} className="px-2 py-1 rounded border border-slate-300 text-sm hover:bg-slate-50">Refresh</button>
          <span className="text-xs text-slate-500 ml-auto">{filtered.length} row(s)</span>
        </div>

        {err && <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 border-b border-slate-200">
              <tr><th className="text-left py-2 pr-2">Status</th><th className="text-left py-2 pr-2">Code</th><th className="text-left py-2 pr-2">Type</th><th className="text-left py-2 pr-2">Diff</th><th className="text-left py-2 pr-2">Prompt</th><th className="text-left py-2 pr-2">Source</th><th className="text-left py-2 pr-2">Actions</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="py-6 text-center text-slate-500">Loading…</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={7} className="py-6 text-center text-slate-500">No rows</td></tr>
                : filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-2"><span className={`inline-block text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${STATUS_COLORS[r.status] || ''}`}>{r.status}</span></td>
                  <td className="py-2 pr-2 font-mono text-xs">{r.competency_code}</td>
                  <td className="py-2 pr-2 text-xs">{r.question_type}</td>
                  <td className="py-2 pr-2 text-xs">{r.difficulty_band}</td>
                  <td className="py-2 pr-2 max-w-[600px]"><div className="line-clamp-2 text-slate-800">{r.template_body.prompt}</div><div className="text-[10px] text-slate-400 font-mono">{r.template_key}</div></td>
                  <td className="py-2 pr-2 text-xs text-slate-500">{r.source}</td>
                  <td className="py-2 pr-2">
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => setEditing(r)} className="text-xs px-2 py-0.5 rounded border border-slate-300 hover:bg-slate-50">Edit</button>
                      {r.status !== 'approved' && <button onClick={() => setStatusFor(r, 'approved')} disabled={busy} className="text-xs px-2 py-0.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50">Approve</button>}
                      {r.status !== 'rejected' && <button onClick={() => setStatusFor(r, 'rejected')} disabled={busy} className="text-xs px-2 py-0.5 rounded border border-rose-300 text-rose-700 hover:bg-rose-50">Reject</button>}
                      {r.status === 'approved' && <button onClick={() => setStatusFor(r, 'archived')} disabled={busy} className="text-xs px-2 py-0.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100">Archive</button>}
                      <button onClick={() => del(r)} disabled={busy} className="text-xs px-2 py-0.5 rounded border border-slate-300 text-slate-700 hover:bg-rose-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && setEditing(null)}>
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{editing.id ? 'Edit question' : 'New question'}</h3>
            <div className="grid grid-cols-4 gap-3">
              <label className="text-xs text-slate-600 col-span-1">Domain
                <select value={editing.competency_code} onChange={(e) => setEditing({ ...editing, competency_code: e.target.value })} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">
                  {DOMAINS.filter(Boolean).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-600 col-span-1">Type
                <select value={editing.question_type} onChange={(e) => setEditing({ ...editing, question_type: e.target.value })} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-600 col-span-1">Difficulty
                <select value={editing.difficulty_band} onChange={(e) => setEditing({ ...editing, difficulty_band: e.target.value })} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">
                  {BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-600 col-span-1">Status
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Row['status'] })} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">
                  {(['draft', 'approved', 'rejected', 'archived'] as const).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <label className="text-xs text-slate-600 block">Prompt
              <textarea value={editing.template_body.prompt || ''}
                onChange={(e) => setEditing({ ...editing, template_body: { ...editing.template_body, prompt: e.target.value } })}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm min-h-[80px]" />
            </label>
            <div className="space-y-1">
              <div className="text-xs text-slate-600">Options (radio = best answer)</div>
              {(editing.template_body.options || []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="best" checked={editing.template_body.best_option === i}
                    onChange={() => setEditing({ ...editing, template_body: { ...editing.template_body, best_option: i } })} />
                  <input value={opt}
                    onChange={(e) => {
                      const next = [...(editing.template_body.options || [])];
                      next[i] = e.target.value;
                      setEditing({ ...editing, template_body: { ...editing.template_body, options: next } });
                    }}
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
                  <button onClick={() => {
                    const next = (editing.template_body.options || []).filter((_, j) => j !== i);
                    setEditing({ ...editing, template_body: { ...editing.template_body, options: next } });
                  }} className="text-xs text-rose-700">×</button>
                </div>
              ))}
              <button onClick={() => setEditing({ ...editing, template_body: { ...editing.template_body, options: [...(editing.template_body.options || []), ''] } })}
                className="text-xs text-indigo-700">+ Add option</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['role_tags', 'industry_tags', 'stage_tags', 'function_tags'] as const).map((k) => (
                <label key={k} className="text-xs text-slate-600">{k.replace('_', ' ')} (comma-separated)
                  <input value={(editing.template_body[k] || []).join(', ')}
                    onChange={(e) => setEditing({ ...editing, template_body: { ...editing.template_body, [k]: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } })}
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                </label>
              ))}
            </div>
            <label className="text-xs text-slate-600 block">Notes
              <input value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} disabled={busy} className="px-3 py-1.5 rounded border border-slate-300 text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={() => save(editing)} disabled={busy} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
