import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, Edit2, Trash2, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TYPES = ['behavioral','functional','cognitive','leadership','future_readiness'];
const FORMATS = ['likert_5','likert_7','mcq','free_text','ranking','situational_judgment','scenario_choice','multi_select'];
const DIFFICULTIES = ['easy','medium','hard'];
const STATUSES = ['draft','review','approved','deprecated'];
const TYPE_LABELS: Record<string, string> = {
  behavioral: 'Behavioral', functional: 'Functional', cognitive: 'Cognitive',
  leadership: 'Leadership', future_readiness: 'Future Readiness'
};
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700', deprecated: 'bg-red-100 text-red-600'
};
const DIFF_COLORS: Record<string, string> = {
  easy: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', hard: 'bg-red-100 text-red-600'
};

type Question = {
  id: number; code: string; assessment_type: string; stem: string;
  response_format: string; difficulty_tier: string; domain?: string;
  level_code?: string; status: string; option_count?: string;
  irt_b?: number; p_value?: number;
};

const defaultForm = {
  code: '', assessment_type: 'behavioral', stem: '', response_format: 'likert_5',
  difficulty_tier: 'medium', domain: '', sub_domain: '', level_code: '',
  time_estimate_secs: 90, instructions: '', polarity: 'positive',
  reverse_score: false, is_anchor_item: false, status: 'draft',
  tags: '', persona_filter: '',
};

export default function CAFQuestionBankPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...defaultForm });

  const { data, isLoading } = useQuery({
    queryKey: ['caf-questions', search, type, status, difficulty, page],
    queryFn: () => fetch(`/api/caf/questions?search=${encodeURIComponent(search)}&type=${type}&status=${status}&difficulty=${difficulty}&page=${page}&limit=50`)
      .then(r => r.json()),
  });

  const { data: optionsData } = useQuery({
    queryKey: ['caf-q-options', expanded],
    queryFn: () => expanded ? fetch(`/api/caf/questions/${expanded}/options`).then(r => r.json()) : Promise.resolve([]),
    enabled: expanded !== null,
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editId
        ? fetch(`/api/caf/questions/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
        : fetch('/api/caf/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['caf-questions'] }); setShowForm(false); setEditId(null); setForm({ ...defaultForm }); },
  });

  const del = useMutation({
    mutationFn: (id: number) => fetch(`/api/caf/questions/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caf-questions'] }),
  });

  function openCreate() { setEditId(null); setForm({ ...defaultForm }); setShowForm(true); }
  function openEdit(q: Question) {
    setEditId(q.id);
    setForm({ ...defaultForm, code: q.code, assessment_type: q.assessment_type, stem: q.stem,
      response_format: q.response_format, difficulty_tier: q.difficulty_tier,
      domain: q.domain ?? '', sub_domain: '', level_code: q.level_code ?? '',
      polarity: 'positive', reverse_score: false, is_anchor_item: false, status: q.status,
      tags: '', persona_filter: '', instructions: '', time_estimate_secs: 90 });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    save.mutate({
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
      persona_filter: form.persona_filter ? form.persona_filter.split(',').map(t => t.trim()).filter(Boolean) : null,
    });
  }

  const questions: Question[] = data?.questions ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Question Bank</h2>
          <p className="text-sm text-gray-500 mt-0.5">Master item library across 5 assessment types · {total.toLocaleString()} items</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New Question</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-gray-50 rounded-lg p-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search code or stem…" className="pl-9 h-8 text-sm" />
        </div>
        {[
          { label: 'Type', value: type, set: setType, opts: ['all', ...TYPES] },
          { label: 'Status', value: status, set: setStatus, opts: ['all', ...STATUSES] },
          { label: 'Difficulty', value: difficulty, set: setDifficulty, opts: ['all', ...DIFFICULTIES] },
        ].map(f => (
          <select key={f.label} value={f.value} onChange={e => { f.set(e.target.value); setPage(1); }}
            className="h-8 text-sm border rounded px-2 bg-white">
            <option value="all">All {f.label}s</option>
            {f.opts.slice(1).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <div className="flex items-center gap-1 text-xs text-gray-400"><Filter className="h-3.5 w-3.5" />{total} results</div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['','Code','Type','Stem','Format','Difficulty','Level','Status','Options',''].map((h,i) => (
              <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={10} className="py-12 text-center text-gray-400">Loading…</td></tr>
            ) : questions.length === 0 ? (
              <tr><td colSpan={10} className="py-12 text-center text-gray-400">No questions found</td></tr>
            ) : questions.map(q => (
              <>
                <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2">
                    <button onClick={() => setExpanded(expanded === q.id ? null : q.id)} className="text-gray-400 hover:text-gray-600">
                      {expanded === q.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-blue-700">{q.code}</td>
                  <td className="px-3 py-2">
                    <span className="bg-blue-50 text-blue-700 text-xs px-1.5 py-0.5 rounded">{TYPE_LABELS[q.assessment_type] ?? q.assessment_type}</span>
                  </td>
                  <td className="px-3 py-2 max-w-xs">
                    <span className="line-clamp-2 text-xs text-gray-700">{q.stem}</span>
                    {q.domain && <div className="flex items-center gap-1 mt-0.5"><Tag className="h-2.5 w-2.5 text-gray-300" /><span className="text-[10px] text-gray-400">{q.domain}</span></div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{q.response_format.replace('_', ' ')}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${DIFF_COLORS[q.difficulty_tier]}`}>{q.difficulty_tier}</span></td>
                  <td className="px-3 py-2 text-xs text-gray-500">{q.level_code || '—'}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[q.status]}`}>{q.status}</span></td>
                  <td className="px-3 py-2 text-xs text-gray-500">{q.option_count || 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(q)} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm(`Delete question ${q.code}?`)) del.mutate(q.id); }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
                {expanded === q.id && (
                  <tr key={`${q.id}-exp`}>
                    <td colSpan={10} className="bg-blue-50/40 px-6 py-3">
                      <div className="text-xs font-medium text-gray-600 mb-2">Answer Options</div>
                      {optionsData?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {optionsData.map((o: { id: number; option_key: string; option_text: string; score_value: number; is_correct: boolean }) => (
                            <div key={o.id} className={`border rounded px-2 py-1 text-xs ${o.is_correct ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'}`}>
                              <span className="font-mono font-bold mr-1">{o.option_key}.</span>{o.option_text}
                              <span className="ml-1 text-gray-400">(score: {o.score_value})</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-xs text-gray-400">No options defined (use free-text or configure below)</p>}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Page {page} of {Math.ceil(total / 50)}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold mb-4">{editId ? 'Edit Question' : 'New Question'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
                  <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="BEH-001" required className="h-8 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Assessment Type *</label>
                  <select value={form.assessment_type} onChange={e => setForm(f => ({ ...f, assessment_type: e.target.value }))} className="w-full h-8 text-sm border rounded px-2">
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stem (question text) *</label>
                <textarea value={form.stem} onChange={e => setForm(f => ({ ...f, stem: e.target.value }))} className="w-full border rounded p-2 text-sm min-h-20 resize-y" required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Response Format</label>
                  <select value={form.response_format} onChange={e => setForm(f => ({ ...f, response_format: e.target.value }))} className="w-full h-8 text-sm border rounded px-2">
                    {FORMATS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Difficulty</label>
                  <select value={form.difficulty_tier} onChange={e => setForm(f => ({ ...f, difficulty_tier: e.target.value }))} className="w-full h-8 text-sm border rounded px-2">
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full h-8 text-sm border rounded px-2">
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Domain</label>
                  <Input value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="e.g. Communication" className="h-8 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Level Code</label>
                  <Input value={form.level_code} onChange={e => setForm(f => ({ ...f, level_code: e.target.value }))} placeholder="e.g. Proficient" className="h-8 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Time Estimate (s)</label>
                  <Input type="number" value={form.time_estimate_secs} onChange={e => setForm(f => ({ ...f, time_estimate_secs: parseInt(e.target.value) }))} className="h-8 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tags (comma-separated)</label>
                  <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="collaboration, feedback" className="h-8 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Persona Filter (comma-separated)</label>
                  <Input value={form.persona_filter} onChange={e => setForm(f => ({ ...f, persona_filter: e.target.value }))} placeholder="professional, student" className="h-8 text-sm" />
                </div>
              </div>
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.reverse_score} onChange={e => setForm(f => ({ ...f, reverse_score: e.target.checked }))} />
                  Reverse score
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_anchor_item} onChange={e => setForm(f => ({ ...f, is_anchor_item: e.target.checked }))} />
                  Anchor item (equating)
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</Button>
                <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : editId ? 'Save Changes' : 'Create Question'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
