import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, Search, Filter, Edit2, Trash2, Eye, EyeOff,
  ChevronDown, ChevronUp, X, Save, RefreshCw, Tag, Layers,
  BarChart3, Users, Briefcase, TrendingUp, CheckCircle2,
  AlertCircle, ArrowLeft, Database, Download,
} from 'lucide-react';
import { AppTopBar } from '@/components/AppTopBar';

// ─── Brand colours ─────────────────────────────────────────────────────────────
const BRAND = {
  primary: '#0B3C5D',
  green:   '#4ECDC4',
  accent:  '#1a6b9e',
  orange:  '#f97316',
  red:     '#ef4444',
  purple:  '#8b5cf6',
  gray:    '#64748b',
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface IQuestion {
  id: string;
  question: string;
  expectedResponse: string | null;
  scoringCriteria: string | null;
  category: string;
  industry: string;
  role: string;
  positionLevel: string;
  difficulty: string;
  isActive: boolean;
  tags: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES    = ['Behavioral', 'Technical', 'Situational', 'HR', 'Culture Fit', 'Leadership', 'Problem Solving'];
const INDUSTRIES    = ['General', 'Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', 'Education', 'Sales & Marketing'];
const LEVELS        = ['Any', 'Fresher', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Manager'];
const DIFFICULTIES  = ['Easy', 'Medium', 'Hard'];

const CATEGORY_COLORS: Record<string, string> = {
  Behavioral:     BRAND.primary,
  Technical:      BRAND.accent,
  Situational:    BRAND.orange,
  HR:             BRAND.purple,
  'Culture Fit':  BRAND.green,
  Leadership:     '#d97706',
  'Problem Solving': '#0891b2',
};
const DIFF_COLORS: Record<string, string> = {
  Easy: BRAND.green, Medium: BRAND.orange, Hard: BRAND.red,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function authHeader(): Record<string, string> {
  const token = localStorage.getItem('metryx_token') || sessionStorage.getItem('metryx_token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function Chip({ label, color, size = 'sm' }: { label: string; color: string; size?: 'xs' | 'sm' }) {
  const sz = size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5';
  return (
    <span className={`inline-block rounded-full font-semibold whitespace-nowrap ${sz}`}
      style={{ backgroundColor: `${color}15`, color }}>
      {label}
    </span>
  );
}

// ─── Empty form ────────────────────────────────────────────────────────────────
function emptyForm() {
  return {
    question: '', expectedResponse: '', scoringCriteria: '',
    category: 'Behavioral', industry: 'General', role: 'General',
    positionLevel: 'Any', difficulty: 'Medium', isActive: true, tags: '',
  };
}

// ─── Question Form Modal ───────────────────────────────────────────────────────
function QuestionFormModal({
  initial, onSave, onClose,
}: { initial: Partial<IQuestion> | null; onSave: (data: any) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(() =>
    initial
      ? { ...initial, tags: (initial.tags || []).join(', '), isActive: initial.isActive ?? true }
      : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.question.trim()) { setErr('Question text is required'); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      });
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, node: React.ReactNode, required = false) => (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {node}
    </div>
  );

  const inputCls = 'w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-300';
  const sel = (k: string, opts: string[]) => (
    <select value={(form as any)[k]} onChange={e => set(k, e.target.value)} className={inputCls}>
      {opts.map(o => <option key={o}>{o}</option>)}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <BookOpen size={16} style={{ color: BRAND.primary }} />
            <h2 className="text-sm font-bold text-gray-800">{initial?.id ? 'Edit Question' : 'Add New Question'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {err && <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600"><AlertCircle size={12} />{err}</div>}

          {field('Question Text *', (
            <textarea rows={3} value={form.question} onChange={e => set('question', e.target.value)}
              placeholder="Enter the interview question…" className={`${inputCls} resize-none`} />
          ), true)}

          {field('Expected Response / Ideal Answer', (
            <textarea rows={4} value={form.expectedResponse} onChange={e => set('expectedResponse', e.target.value)}
              placeholder="Describe what a strong answer looks like…" className={`${inputCls} resize-none`} />
          ))}

          {field('AI Scoring Criteria', (
            <textarea rows={3} value={form.scoringCriteria} onChange={e => set('scoringCriteria', e.target.value)}
              placeholder="What should the AI look for? (e.g., Score 0–10. 8–10: …)" className={`${inputCls} resize-none`} />
          ))}

          <div className="grid grid-cols-2 gap-4">
            {field('Category', sel('category', CATEGORIES))}
            {field('Industry', sel('industry', INDUSTRIES))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Role / Position', (
              <input type="text" value={form.role} onChange={e => set('role', e.target.value)}
                placeholder="e.g., Software Engineer, Sales Executive" className={inputCls} />
            ))}
            {field('Position Level', sel('positionLevel', LEVELS))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Difficulty', sel('difficulty', DIFFICULTIES))}
            {field('Tags (comma-separated)', (
              <input type="text" value={form.tags} onChange={e => set('tags', e.target.value)}
                placeholder="e.g., leadership, communication, SQL" className={inputCls} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => set('isActive', e.target.checked)}
              className="w-3.5 h-3.5 rounded" style={{ accentColor: BRAND.green }} />
            <label htmlFor="isActive" className="text-xs text-gray-600 cursor-pointer">Active (shown in screening)</label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t">
          <button onClick={onClose} className="text-xs px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl text-white font-medium"
            style={{ backgroundColor: BRAND.primary }}>
            {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
            {saving ? 'Saving…' : 'Save Question'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar({ stats }: { stats: any }) {
  if (!stats) return null;
  const cards = [
    { label: 'Total Questions', value: stats.total, icon: <Database size={14} />, color: BRAND.primary },
    { label: 'Active', value: stats.active, icon: <CheckCircle2 size={14} />, color: BRAND.green },
    { label: 'Industries', value: stats.industries?.length || 0, icon: <Layers size={14} />, color: BRAND.accent },
    { label: 'Roles Covered', value: stats.roles?.length || 0, icon: <Briefcase size={14} />, color: BRAND.orange },
  ];
  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {cards.map(c => (
        <div key={c.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${c.color}15`, color: c.color }}>
            {c.icon}
          </div>
          <div>
            <div className="text-lg font-bold text-gray-800">{c.value}</div>
            <div className="text-[10px] text-gray-400">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Question Card ─────────────────────────────────────────────────────────────
function QuestionCard({
  q, onEdit, onToggle, onDelete,
}: { q: IQuestion; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLORS[q.category] || BRAND.gray;
  const diffColor = DIFF_COLORS[q.difficulty] || BRAND.gray;

  return (
    <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${!q.isActive ? 'opacity-60' : ''}`}
      style={{ borderColor: q.isActive ? `${catColor}30` : '#e2e8f0' }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <Chip label={q.category} color={catColor} />
              <Chip label={q.industry} color={BRAND.gray} />
              <Chip label={q.positionLevel} color={BRAND.accent} />
              <Chip label={q.difficulty} color={diffColor} size="xs" />
              {!q.isActive && <Chip label="Inactive" color="#94a3b8" size="xs" />}
            </div>
            <p className="text-xs font-semibold text-gray-800 leading-relaxed">{q.question}</p>
            {q.role !== 'General' && (
              <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                <Briefcase size={9} /> {q.role}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <Edit2 size={13} />
            </button>
            <button onClick={onToggle} title={q.isActive ? 'Deactivate' : 'Activate'}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              {q.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={13} />
            </button>
            <button onClick={() => setExpanded(x => !x)} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600">
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="border-t bg-gray-50 p-4 space-y-3">
          {q.expectedResponse && (
            <div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Expected Response</div>
              <p className="text-[11px] text-gray-600 leading-relaxed">{q.expectedResponse}</p>
            </div>
          )}
          {q.scoringCriteria && (
            <div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">AI Scoring Criteria</div>
              <p className="text-[11px] text-gray-600 leading-relaxed">{q.scoringCriteria}</p>
            </div>
          )}
          {q.tags && q.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {q.tags.map(t => (
                <span key={t} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500">
                  <Tag size={8} />{t}
                </span>
              ))}
            </div>
          )}
          <div className="text-[9px] text-gray-300">Added by {q.createdBy || 'system'} · {new Date(q.createdAt).toLocaleDateString()}</div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
interface Props { onNavigate?: (screen: string) => void }

export default function InterviewQuestionBankPage({ onNavigate }: Props) {
  const [questions, setQuestions]   = useState<IQuestion[]>([]);
  const [stats, setStats]           = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // Filters
  const [search, setSearch]         = useState('');
  const [filterCat, setFilterCat]   = useState('All');
  const [filterInd, setFilterInd]   = useState('All');
  const [filterLvl, setFilterLvl]   = useState('All');
  const [filterDiff, setFilterDiff] = useState('All');
  const [showInactive, setShowInactive] = useState(false);

  // Modals
  const [formModal, setFormModal]   = useState<{ open: boolean; q: Partial<IQuestion> | null }>({ open: false, q: null });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Distribution chart active tab
  const [distTab, setDistTab]       = useState<'category' | 'industry' | 'level'>('category');

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [qRes, sRes] = await Promise.all([
        fetch(`/api/interview-questions?active=${showInactive ? 'all' : 'true'}&limit=500`, { headers: authHeader() }),
        fetch('/api/interview-questions/stats', { headers: authHeader() }),
      ]);
      const qData = await qRes.json();
      const sData = await sRes.json();
      if (qData.success) setQuestions(qData.questions || []);
      if (sData.success) setStats(sData);
    } catch (e: any) {
      setError('Failed to load questions. Is the server running?');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── CRUD helpers ───────────────────────────────────────────────────────────
  const saveQuestion = async (data: any) => {
    const isEdit = !!formModal.q?.id;
    const url = isEdit ? `/api/interview-questions/${formModal.q!.id}` : '/api/interview-questions';
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Save failed');
    fetchData();
  };

  const toggleActive = async (q: IQuestion) => {
    await fetch(`/api/interview-questions/${q.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ isActive: !q.isActive }),
    });
    fetchData();
  };

  const deleteQuestion = async (id: string) => {
    await fetch(`/api/interview-questions/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    setDeleteConfirm(null);
    fetchData();
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = questions.filter(q => {
    if (!showInactive && !q.isActive) return false;
    if (filterCat !== 'All'  && q.category     !== filterCat)  return false;
    if (filterInd !== 'All'  && q.industry     !== filterInd)  return false;
    if (filterLvl !== 'All'  && q.positionLevel !== filterLvl)  return false;
    if (filterDiff !== 'All' && q.difficulty   !== filterDiff) return false;
    if (search && !q.question.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Distribution data ──────────────────────────────────────────────────────
  const distData = (() => {
    if (!stats) return [];
    const raw = distTab === 'category' ? stats.byCategory : distTab === 'industry' ? stats.byIndustry : stats.byLevel;
    if (!raw) return [];
    const total = Object.values(raw as Record<string, number>).reduce((s: any, v: any) => s + v, 0) || 1;
    return Object.entries(raw as Record<string, number>)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label, count, pct: Math.round((count / total) * 100),
        color: distTab === 'category' ? CATEGORY_COLORS[label] || BRAND.gray
          : distTab === 'industry' ? BRAND.primary
          : BRAND.accent,
      }));
  })();

  const selCls = 'text-xs border border-gray-200 rounded-lg px-2.5 h-8 focus:outline-none bg-white text-gray-700';

  return (
    <div className="min-h-screen bg-gray-50">
      <AppTopBar
        title="Interview Question Bank"
        onSearch={() => window.dispatchEvent(new Event('metryx:open-search'))}
        onNavigate={onNavigate}
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {onNavigate && (
              <button onClick={() => onNavigate('employer-portal')}
                className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors">
                <ArrowLeft size={14} />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen size={20} style={{ color: BRAND.primary }} />
                Interview Question Bank
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage questions used by the Pragati AI Voice Screener — categorised by role, industry, level, and type.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
              <RefreshCw size={11} /> Refresh
            </button>
            <button onClick={() => setFormModal({ open: true, q: null })}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl text-white font-medium shadow-sm"
              style={{ backgroundColor: BRAND.primary }}>
              <Plus size={12} /> Add Question
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 mb-5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-600">
            <AlertCircle size={14} />{error}
          </div>
        )}

        {/* Stats */}
        <StatsBar stats={stats} />

        {/* Distribution chart */}
        {stats && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} style={{ color: BRAND.primary }} />
                <span className="text-sm font-semibold text-gray-800">Question Distribution</span>
              </div>
              <div className="flex gap-1">
                {(['category', 'industry', 'level'] as const).map(t => (
                  <button key={t} onClick={() => setDistTab(t)}
                    className="text-[10px] px-2.5 py-1 rounded-lg font-medium transition-colors capitalize"
                    style={distTab === t ? { backgroundColor: BRAND.primary, color: '#fff' } : { backgroundColor: '#f1f5f9', color: '#64748b' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {distData.map(d => (
                <div key={d.label} className="flex items-center gap-3">
                  <div className="w-28 text-[10px] text-gray-600 text-right truncate shrink-0">{d.label}</div>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${d.pct}%`, backgroundColor: d.color }} />
                  </div>
                  <div className="w-16 text-[10px] text-gray-500 shrink-0">{d.count} ({d.pct}%)</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input type="text" placeholder="Search questions…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg pl-7 pr-3 h-8 focus:outline-none bg-white" />
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className={selCls}>
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={filterInd} onChange={e => setFilterInd(e.target.value)} className={selCls}>
            <option value="All">All Industries</option>
            {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
          </select>
          <select value={filterLvl} onChange={e => setFilterLvl(e.target.value)} className={selCls}>
            <option value="All">All Levels</option>
            {LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
          <select value={filterDiff} onChange={e => setFilterDiff(e.target.value)} className={selCls}>
            <option value="All">All Difficulties</option>
            {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
              className="w-3 h-3" style={{ accentColor: BRAND.primary }} />
            Show Inactive
          </label>
          {(search || filterCat !== 'All' || filterInd !== 'All' || filterLvl !== 'All' || filterDiff !== 'All') && (
            <button onClick={() => { setSearch(''); setFilterCat('All'); setFilterInd('All'); setFilterLvl('All'); setFilterDiff('All'); }}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100">
              <X size={10} /> Clear filters
            </button>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-gray-500">
            Showing {filtered.length} of {questions.length} questions
          </span>
          {filtered.length !== questions.length && (
            <span className="text-[10px] text-gray-400">{questions.length - filtered.length} hidden by filters</span>
          )}
        </div>

        {/* Question list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <RefreshCw size={24} className="animate-spin mb-3" />
            <span className="text-sm">Loading questions…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
            <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
            <div className="text-sm font-semibold text-gray-500 mb-1">No questions found</div>
            <p className="text-xs text-gray-400 mb-4">
              {questions.length === 0 ? 'Start by adding questions to the bank.' : 'Try adjusting your filters.'}
            </p>
            <button onClick={() => setFormModal({ open: true, q: null })}
              className="text-xs px-4 py-2 rounded-xl text-white font-medium"
              style={{ backgroundColor: BRAND.primary }}>
              <Plus size={11} className="inline mr-1" /> Add First Question
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(q => (
              <QuestionCard
                key={q.id} q={q}
                onEdit={() => setFormModal({ open: true, q })}
                onToggle={() => toggleActive(q)}
                onDelete={() => setDeleteConfirm(q.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      {formModal.open && (
        <QuestionFormModal
          initial={formModal.q}
          onSave={saveQuestion}
          onClose={() => setFormModal({ open: false, q: null })}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-red-100 mx-auto mb-3">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <h3 className="text-sm font-bold text-gray-800 mb-1">Delete this question?</h3>
            <p className="text-xs text-gray-500 mb-5">This cannot be undone. The question will be permanently removed from the bank.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 text-xs py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => deleteQuestion(deleteConfirm!)}
                className="flex-1 text-xs py-2 rounded-xl text-white font-medium bg-red-500 hover:bg-red-600">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
