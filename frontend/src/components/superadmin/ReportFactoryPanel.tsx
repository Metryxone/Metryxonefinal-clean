import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Layers, Lightbulb, BarChart2, TrendingUp, Download,
  Palette, Globe2, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, Copy, X, Save, Eye, Settings,
  Award, BookOpen, Zap,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';

const BRAND = {
  primary: '#6366f1', primaryLight: '#eef2ff',
  green: '#10b981', greenLight: '#ecfdf5',
  amber: '#f59e0b', red: '#ef4444',
  border: '#e5e7eb', muted: '#6b7280', bg: '#f9fafb',
};

type RFTab = 'overview' | 'templates' | 'narratives' | 'insights' | 'visualizations' |
             'benchmarks' | 'whitelabel' | 'languages' | 'reports' | 'exports';

const TABS: { id: RFTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',       label: 'Overview',        icon: <Layers size={14} /> },
  { id: 'templates',      label: 'Templates',       icon: <FileText size={14} /> },
  { id: 'narratives',     label: 'Narratives',      icon: <BookOpen size={14} /> },
  { id: 'insights',       label: 'Insight Rules',   icon: <Lightbulb size={14} /> },
  { id: 'visualizations', label: 'Visualizations',  icon: <BarChart2 size={14} /> },
  { id: 'benchmarks',     label: 'Benchmarks',      icon: <TrendingUp size={14} /> },
  { id: 'whitelabel',     label: 'White Label',     icon: <Palette size={14} /> },
  { id: 'languages',      label: 'Languages',       icon: <Globe2 size={14} /> },
  { id: 'reports',        label: 'Generated',       icon: <Award size={14} /> },
  { id: 'exports',        label: 'Exports',         icon: <Download size={14} /> },
];

const SEVERITY_COLORS: Record<string, string> = {
  positive: BRAND.green, info: BRAND.primary, warning: BRAND.amber, critical: BRAND.red,
};
const REPORT_TYPE_COLORS: Record<string, string> = {
  capadex: '#8b5cf6', career: BRAND.primary, competency: BRAND.green,
  employability: BRAND.amber, passport: '#06b6d4', custom: BRAND.muted,
};

function Pill({ label, color }: { label: string; color?: string }) {
  const c = color ?? BRAND.muted;
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize"
      style={{ background: `${c}18`, color: c }}>{label}</span>
  );
}

function Spinner() {
  return <div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto my-8"
    style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color ?? BRAND.primary }}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, sub, onAdd, addLabel }: {
  title: string; sub?: string; onAdd?: () => void; addLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="font-semibold text-gray-800">{title}</h3>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {onAdd && (
        <button onClick={onAdd}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
          style={{ background: BRAND.primary }}>
          <Plus size={12} /> {addLabel ?? 'Add'}
        </button>
      )}
    </div>
  );
}

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(path, { credentials: 'include', ...opts });
  if (r.status === 503) throw new Error('Report Factory flag is off (FF_REPORT_FACTORY not set)');
  return r;
}

// ── Overview Tab ──────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/admin/rf/stats').then(r => r.json()).then(d => setStats(d.stats)).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const s = stats ?? {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Templates" value={s.templates ?? 0} sub="active report templates" />
        <StatCard label="Narrative Blocks" value={s.narratives ?? 0} sub="reusable text blocks" color="#8b5cf6" />
        <StatCard label="Insight Rules" value={s.insight_rules ?? 0} sub="auto-insight rules" color={BRAND.amber} />
        <StatCard label="Viz Configs" value={s.viz_configs ?? 0} sub="chart configurations" color="#06b6d4" />
        <StatCard label="Benchmarks" value={s.benchmark_configs ?? 0} sub="cohort benchmarks" color={BRAND.green} />
        <StatCard label="White Label Tenants" value={s.white_label_configs ?? 0} sub="branded environments" />
        <StatCard label="Languages" value={s.language_packs ?? 0} sub="active language packs" color={BRAND.amber} />
        <StatCard label="Reports Generated" value={s.generated_reports ?? 0} sub="all time" color={BRAND.green} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border p-5" style={{ borderColor: BRAND.border }}>
          <p className="font-semibold text-gray-700 mb-3">Engines</p>
          <div className="space-y-2 text-xs">
            {[
              ['Report Template Builder', 'CRUD for templates + section ordering + layout config'],
              ['Narrative Builder', 'Variable-interpolated text blocks with tone control'],
              ['Insight Engine', 'Rule-based conditional insights fired against report data'],
              ['Visualization Engine', 'Chart type + data-binding + style configuration'],
              ['Benchmark Engine', 'Cohort definitions + percentile aggregation configs'],
              ['PDF Generator', 'Template → HTML → PDF job pipeline with export tracking'],
              ['White Label Engine', 'Per-tenant branding (logo, palette, fonts, footer)'],
              ['Multi-language Engine', 'Translation packs with completeness tracking per language'],
            ].map(([e, d]) => (
              <div key={e} className="flex gap-3">
                <CheckCircle2 size={12} className="shrink-0 mt-0.5" style={{ color: BRAND.green }} />
                <div><span className="font-semibold text-gray-700">{e}</span><span className="text-gray-400 ml-1.5">{d}</span></div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border p-5" style={{ borderColor: BRAND.border }}>
          <p className="font-semibold text-gray-700 mb-3">Database tables</p>
          <div className="grid grid-cols-2 gap-1.5 text-xs font-mono text-gray-500">
            {['rf_templates','rf_template_sections','rf_narrative_blocks','rf_insight_rules',
              'rf_visualization_configs','rf_benchmark_configs','rf_white_label_configs',
              'rf_language_packs','rf_generated_reports','rf_export_jobs']
              .map(t => <span key={t} className="bg-gray-50 px-2 py-1 rounded">{t}</span>)}
          </div>
        </div>
      </div>
      <div className="rounded-xl border p-5 text-xs" style={{ borderColor: BRAND.border }}>
        <p className="font-semibold text-gray-700 mb-2">Export specifications</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { fmt: 'PDF', desc: 'Full-page report with template layout, charts, and branding' },
            { fmt: 'JSON', desc: 'Machine-readable report data for API consumers' },
            { fmt: 'CSV', desc: 'Tabular score and insight export for analytics' },
            { fmt: 'XLSX', desc: 'Multi-sheet workbook with data and benchmarks' },
          ].map(({ fmt, desc }) => (
            <div key={fmt} className="p-3 rounded-lg" style={{ background: BRAND.bg }}>
              <p className="font-semibold text-gray-700 mb-1">{fmt}</p>
              <p className="text-gray-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Templates Tab ─────────────────────────────────────────────────────────
function TemplatesTab() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sections, setSections] = useState<Record<number, any[]>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ report_type: 'custom', language: 'en' });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/api/rf/templates').then(r => r.json()).then(d => setTemplates(d.templates ?? []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadSections = async (id: number) => {
    if (sections[id]) return;
    const r = await apiFetch(`/api/rf/templates/${id}/sections`);
    const d = await r.json();
    setSections(prev => ({ ...prev, [id]: d.sections ?? [] }));
  };

  const toggleExpand = async (id: number) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    await loadSections(id);
  };

  const del = async (id: number) => {
    if (!confirm('Delete template?')) return;
    await apiFetch(`/api/rf/templates/${id}`, { method: 'DELETE' });
    load();
  };

  const addTemplate = async () => {
    if (!form.name) return;
    await apiFetch('/api/rf/templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowAdd(false); setForm({ report_type: 'custom', language: 'en' }); load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader title="Report Templates" sub={`${templates.length} template${templates.length !== 1 ? 's' : ''}`}
        onAdd={() => setShowAdd(true)} addLabel="New Template" />
      {showAdd && (
        <div className="mb-4 p-4 rounded-xl border space-y-3" style={{ borderColor: BRAND.primary, background: BRAND.primaryLight }}>
          <p className="text-sm font-semibold text-gray-700">New Template</p>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Template name *" value={form.name ?? ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs col-span-2" style={{ borderColor: BRAND.border }} />
            <select value={form.report_type} onChange={e => setForm(p => ({ ...p, report_type: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
              {['capadex','career','competency','employability','passport','custom'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
              {['en','hi','ta','te','bn','mr','ar','fr','de'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <textarea placeholder="Description" value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2} className="border rounded px-2 py-1.5 text-xs resize-none col-span-2" style={{ borderColor: BRAND.border }} />
          </div>
          <div className="flex gap-2">
            <button onClick={addTemplate} className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white" style={{ background: BRAND.primary }}>Create</button>
            <button onClick={() => setShowAdd(false)} className="flex-1 text-xs text-gray-500 border rounded-lg py-1.5" style={{ borderColor: BRAND.border }}>Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {templates.map(t => (
          <div key={t.id} className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
            <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(t.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-800 text-sm">{t.name}</p>
                  <Pill label={t.report_type} color={REPORT_TYPE_COLORS[t.report_type]} />
                  {t.is_default && <Pill label="Default" color={BRAND.green} />}
                  {!t.is_active && <Pill label="Inactive" color={BRAND.muted} />}
                </div>
                {t.description && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{t.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-gray-400">v{t.version}</span>
                <button onClick={e => { e.stopPropagation(); del(t.id); }} className="text-gray-300 hover:text-red-400"><Trash2 size={13} /></button>
                {expanded === t.id ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
              </div>
            </div>
            {expanded === t.id && (
              <div className="border-t px-3 pb-3 pt-2" style={{ borderColor: BRAND.border }}>
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Sections ({(sections[t.id] ?? []).length})</p>
                <div className="space-y-1">
                  {(sections[t.id] ?? []).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 text-xs text-gray-600 p-1.5 rounded" style={{ background: BRAND.bg }}>
                      <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-semibold"
                        style={{ background: BRAND.primaryLight, color: BRAND.primary }}>{i + 1}</span>
                      <span className="font-medium flex-1">{s.title}</span>
                      <Pill label={s.section_type} />
                      {s.is_required && <Pill label="required" color={BRAND.amber} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {templates.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No templates yet.</p>}
      </div>
    </div>
  );
}

// ── Narratives Tab ────────────────────────────────────────────────────────
function NarrativesTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [preview, setPreview] = useState<Record<number, string>>({});
  const [form, setForm] = useState<Record<string, string>>({ tone: 'professional', category: 'general' });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/api/rf/narratives').then(r => r.json()).then(d => setItems(d.blocks ?? []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async (id: number) => {
    if (!confirm('Delete narrative block?')) return;
    await apiFetch(`/api/rf/narratives/${id}`, { method: 'DELETE' });
    load();
  };

  const addBlock = async () => {
    if (!form.block_key || !form.title || !form.content) return;
    await apiFetch('/api/rf/narratives', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, report_types: form.report_types ? form.report_types.split(',').map(s => s.trim()) : [] }),
    });
    setShowAdd(false); setForm({ tone: 'professional', category: 'general' }); load();
  };

  const doPreview = async (id: number) => {
    const r = await apiFetch(`/api/rf/narratives/${id}/preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }),
    });
    const d = await r.json();
    setPreview(prev => ({ ...prev, [id]: d.rendered ?? '' }));
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader title="Narrative Blocks" sub={`${items.length} reusable text blocks`}
        onAdd={() => setShowAdd(true)} addLabel="New Block" />
      {showAdd && (
        <div className="mb-4 p-4 rounded-xl border space-y-2" style={{ borderColor: BRAND.primary, background: BRAND.primaryLight }}>
          <p className="text-sm font-semibold text-gray-700">New Narrative Block</p>
          <input placeholder="Block key * (e.g. intro_capadex)" value={form.block_key ?? ''} onChange={e => setForm(p => ({ ...p, block_key: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 text-xs font-mono" style={{ borderColor: BRAND.border }} />
          <input placeholder="Title *" value={form.title ?? ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
          <textarea placeholder="Content * — use {{variable_name}} for dynamic values" value={form.content ?? ''} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            rows={4} className="w-full border rounded px-2 py-1.5 text-xs resize-none font-mono" style={{ borderColor: BRAND.border }} />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.tone} onChange={e => setForm(p => ({ ...p, tone: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
              {['professional','empathetic','developmental','clinical','motivational'].map(v => <option key={v}>{v}</option>)}
            </select>
            <input placeholder="Category (e.g. introduction)" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
          </div>
          <input placeholder="Report types (comma-separated: capadex,career)" value={form.report_types ?? ''} onChange={e => setForm(p => ({ ...p, report_types: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
          <div className="flex gap-2">
            <button onClick={addBlock} className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white" style={{ background: BRAND.primary }}>Save</button>
            <button onClick={() => setShowAdd(false)} className="flex-1 text-xs text-gray-500 border rounded-lg py-1.5" style={{ borderColor: BRAND.border }}>Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {items.map(n => (
          <div key={n.id} className="p-3 rounded-xl border" style={{ borderColor: BRAND.border }}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-800">{n.title}</span>
                  <span className="text-[10px] font-mono text-gray-400">{n.block_key}</span>
                  <Pill label={n.tone} color={BRAND.primary} />
                  <Pill label={n.category} />
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.content}</p>
                {n.report_types?.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {n.report_types.map((rt: string) => <Pill key={rt} label={rt} color={REPORT_TYPE_COLORS[rt]} />)}
                  </div>
                )}
                {preview[n.id] && (
                  <div className="mt-2 p-2 rounded text-xs text-gray-600 italic" style={{ background: BRAND.bg }}>
                    <span className="text-[10px] font-semibold text-gray-400 not-italic block mb-1">Preview (sample data):</span>
                    {preview[n.id]}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => doPreview(n.id)} title="Preview" className="text-gray-300 hover:text-indigo-500"><Eye size={13} /></button>
                <button onClick={() => del(n.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={13} /></button>
              </div>
            </div>
            <p className="text-[10px] text-gray-400">Used {n.usage_count} time{n.usage_count !== 1 ? 's' : ''}</p>
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No narrative blocks yet.</p>}
      </div>
    </div>
  );
}

// ── Insight Rules Tab ─────────────────────────────────────────────────────
function InsightRulesTab() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ condition_type: 'threshold', severity: 'info', priority: '50', data_source: 'any' });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/api/rf/insights/rules').then(r => r.json()).then(d => setRules(d.rules ?? []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async (id: number) => {
    if (!confirm('Delete rule?')) return;
    await apiFetch(`/api/rf/insights/rules/${id}`, { method: 'DELETE' });
    load();
  };

  const addRule = async () => {
    if (!form.rule_key || !form.title || !form.insight_template) return;
    let condition: Record<string, unknown> = {};
    try { condition = JSON.parse(form.condition_json || '{}'); } catch { condition = {}; }
    await apiFetch('/api/rf/insights/rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        condition,
        priority: Number(form.priority) || 50,
        report_types: form.report_types ? form.report_types.split(',').map(s => s.trim()) : [],
      }),
    });
    setShowAdd(false); setForm({ condition_type: 'threshold', severity: 'info', priority: '50', data_source: 'any' }); load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader title="Insight Rules" sub={`${rules.length} rules — auto-fire when conditions match report data`}
        onAdd={() => setShowAdd(true)} addLabel="New Rule" />
      {showAdd && (
        <div className="mb-4 p-4 rounded-xl border space-y-2" style={{ borderColor: BRAND.primary, background: BRAND.primaryLight }}>
          <p className="text-sm font-semibold text-gray-700">New Insight Rule</p>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Rule key *" value={form.rule_key ?? ''} onChange={e => setForm(p => ({ ...p, rule_key: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs font-mono" style={{ borderColor: BRAND.border }} />
            <input placeholder="Title *" value={form.title ?? ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
            <select value={form.condition_type} onChange={e => setForm(p => ({ ...p, condition_type: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
              {['threshold','range','comparison','pattern','composite','presence'].map(v => <option key={v}>{v}</option>)}
            </select>
            <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
              {['positive','info','warning','critical'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <textarea placeholder='Condition JSON * e.g. {"field":"readiness_score","operator":">=","value":75}'
            value={form.condition_json ?? ''} onChange={e => setForm(p => ({ ...p, condition_json: e.target.value }))}
            rows={2} className="w-full border rounded px-2 py-1.5 text-xs resize-none font-mono" style={{ borderColor: BRAND.border }} />
          <textarea placeholder="Insight template * — use {{variable_name}} slots"
            value={form.insight_template ?? ''} onChange={e => setForm(p => ({ ...p, insight_template: e.target.value }))}
            rows={2} className="w-full border rounded px-2 py-1.5 text-xs resize-none" style={{ borderColor: BRAND.border }} />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" placeholder="Priority 0-100" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
            <input placeholder="Data source (capadex|career|any)" value={form.data_source} onChange={e => setForm(p => ({ ...p, data_source: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
            <input placeholder="Report types (csv)" value={form.report_types ?? ''} onChange={e => setForm(p => ({ ...p, report_types: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
          </div>
          <div className="flex gap-2">
            <button onClick={addRule} className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white" style={{ background: BRAND.primary }}>Save Rule</button>
            <button onClick={() => setShowAdd(false)} className="flex-1 text-xs text-gray-500 border rounded-lg py-1.5" style={{ borderColor: BRAND.border }}>Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {rules.map(r => (
          <div key={r.id} className="p-3 rounded-xl border" style={{ borderColor: BRAND.border }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium text-sm text-gray-800">{r.title}</span>
                  <span className="text-[10px] font-mono text-gray-400">{r.rule_key}</span>
                  <Pill label={r.severity} color={SEVERITY_COLORS[r.severity]} />
                  <Pill label={r.condition_type} />
                  <span className="text-[10px] text-gray-400">p={r.priority}</span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{r.insight_template}</p>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {r.report_types?.map((rt: string) => <Pill key={rt} label={rt} color={REPORT_TYPE_COLORS[rt]} />)}
                  <span className="text-[10px] text-gray-400">fired {r.fire_count}×</span>
                </div>
              </div>
              <button onClick={() => del(r.id)} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {rules.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No insight rules yet.</p>}
      </div>
    </div>
  );
}

// ── Visualizations Tab ────────────────────────────────────────────────────
// ── Chart palette & preview ───────────────────────────────────────────────
const CHART_PALETTE = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];

// ── Live chart preview component ───────────────────────────────────────────
function RFChartPreview({ chartType, data }: { chartType: string; data: any }) {
  if (!data || !data.labels?.length) {
    return (
      <div className="flex items-center justify-center h-36 rounded-lg text-xs text-gray-400 bg-gray-50">
        No data available from source
      </div>
    );
  }

  const labels: string[] = data.labels ?? [];
  const datasets: { label: string; data: number[] }[] = data.datasets ?? [];
  const primary = datasets[0]?.data ?? [];

  // Common recharts data format
  const barData = labels.map((lbl, i) => {
    const row: Record<string, string | number> = { name: String(lbl).substring(0, 18) };
    datasets.forEach((ds, di) => { row[ds.label ?? `series${di}`] = Number(ds.data[i] ?? 0); });
    return row;
  });

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip contentStyle={{ fontSize: 10 }} />
          {datasets.map((ds, i) => (
            <Line key={ds.label ?? i} type="monotone" dataKey={ds.label ?? `series${i}`}
              stroke={CHART_PALETTE[i % CHART_PALETTE.length]} dot={false} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'radar') {
    const radarData = labels.map((lbl, i) => ({ subject: String(lbl).substring(0, 14), value: Number(primary[i] ?? 0) }));
    return (
      <ResponsiveContainer width="100%" height={160}>
        <RadarChart data={radarData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
          <PolarRadiusAxis tick={{ fontSize: 8 }} />
          <Radar name="Score" dataKey="value" stroke={CHART_PALETTE[0]} fill={CHART_PALETTE[0]} fillOpacity={0.25} />
          <Tooltip contentStyle={{ fontSize: 10 }} />
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'donut' || chartType === 'gauge') {
    const pieData = labels.map((lbl, i) => ({ name: String(lbl).substring(0, 18), value: Math.max(Number(primary[i] ?? 0), 0) }));
    const innerR = chartType === 'gauge' ? '60%' : '40%';
    return (
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={pieData} cx="50%" cy="50%" innerRadius={innerR} outerRadius="80%"
            dataKey="value" nameKey="name">
            {pieData.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 10 }} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'scatter') {
    const scData = labels.map((_, i) => ({ x: i, y: Number(primary[i] ?? 0) }));
    return (
      <ResponsiveContainer width="100%" height={160}>
        <ScatterChart margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="x" tick={{ fontSize: 9 }} name="Index" />
          <YAxis dataKey="y" tick={{ fontSize: 9 }} name="Value" />
          <Tooltip contentStyle={{ fontSize: 10 }} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={scData} fill={CHART_PALETTE[0]} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  // heatmap, funnel, waterfall, bar (default)
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={labels.length > 6 ? -25 : 0} textAnchor={labels.length > 6 ? 'end' : 'middle'} height={labels.length > 6 ? 36 : 20} />
        <YAxis tick={{ fontSize: 9 }} />
        <Tooltip contentStyle={{ fontSize: 10 }} />
        {datasets.map((ds, i) => (
          <Bar key={ds.label ?? i} dataKey={ds.label ?? `series${i}`}
            fill={CHART_PALETTE[i % CHART_PALETTE.length]} radius={[2, 2, 0, 0]} maxBarSize={32} />
        ))}
        {datasets.length > 1 && <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

function VisualizationsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ chart_type: 'bar', data_source: 'custom' });
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/api/rf/visualizations').then(r => r.json()).then(d => setItems(d.configs ?? []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async (id: number) => {
    if (!confirm('Delete visualization config?')) return;
    await apiFetch(`/api/rf/visualizations/${id}`, { method: 'DELETE' });
    if (previewId === id) { setPreviewId(null); setPreviewData(null); }
    load();
  };

  const togglePreview = async (v: any) => {
    if (previewId === v.id) { setPreviewId(null); setPreviewData(null); return; }
    setPreviewId(v.id);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const r = await apiFetch(`/api/rf/visualizations/${v.id}/data`);
      const d = await r.json();
      setPreviewData(d.data ?? null);
    } catch { setPreviewData(null); }
    finally { setPreviewLoading(false); }
  };

  const addViz = async () => {
    if (!form.config_key || !form.title) return;
    let dataBinding: Record<string, unknown> = {};
    let styleConfig: Record<string, unknown> = {};
    try { dataBinding = JSON.parse(form.data_binding_json || '{}'); } catch { /* empty */ }
    try { styleConfig = JSON.parse(form.style_config_json || '{}'); } catch { /* empty */ }
    await apiFetch('/api/rf/visualizations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form, data_binding: dataBinding, style_config: styleConfig,
        report_types: form.report_types ? form.report_types.split(',').map(s => s.trim()) : [],
      }),
    });
    setShowAdd(false); setForm({ chart_type: 'bar', data_source: 'custom' }); load();
  };

  const CHART_ICONS: Record<string, string> = {
    bar: '▊', line: '╱', radar: '◈', gauge: '◎', donut: '◉',
    scatter: '·', heatmap: '▦', funnel: '▽', waterfall: '⊟',
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader title="Visualization Configs" sub={`${items.length} chart configurations`}
        onAdd={() => setShowAdd(true)} addLabel="New Config" />
      {showAdd && (
        <div className="mb-4 p-4 rounded-xl border space-y-2" style={{ borderColor: BRAND.primary, background: BRAND.primaryLight }}>
          <p className="text-sm font-semibold text-gray-700">New Visualization Config</p>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Config key *" value={form.config_key ?? ''} onChange={e => setForm(p => ({ ...p, config_key: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs font-mono" style={{ borderColor: BRAND.border }} />
            <input placeholder="Title *" value={form.title ?? ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
            <select value={form.chart_type} onChange={e => setForm(p => ({ ...p, chart_type: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
              {['bar','line','radar','gauge','donut','scatter','heatmap','funnel','waterfall'].map(v => <option key={v}>{v}</option>)}
            </select>
            <select value={form.data_source} onChange={e => setForm(p => ({ ...p, data_source: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
              {['capadex','career','competency','employability','passport','custom'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <textarea placeholder='Data binding JSON — e.g. {"labels_field":"names","values_field":"scores"}'
            value={form.data_binding_json ?? ''} onChange={e => setForm(p => ({ ...p, data_binding_json: e.target.value }))}
            rows={2} className="w-full border rounded px-2 py-1.5 text-xs resize-none font-mono" style={{ borderColor: BRAND.border }} />
          <input placeholder="Report types (comma-separated)" value={form.report_types ?? ''} onChange={e => setForm(p => ({ ...p, report_types: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
          <div className="flex gap-2">
            <button onClick={addViz} className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white" style={{ background: BRAND.primary }}>Save</button>
            <button onClick={() => setShowAdd(false)} className="flex-1 text-xs text-gray-500 border rounded-lg py-1.5" style={{ borderColor: BRAND.border }}>Cancel</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(v => (
          <div key={v.id} className="rounded-xl border overflow-hidden" style={{ borderColor: previewId === v.id ? BRAND.primary : BRAND.border }}>
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl leading-none">{CHART_ICONS[v.chart_type] ?? '◌'}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-800">{v.title}</p>
                    <div className="flex gap-1.5 mt-0.5 flex-wrap">
                      <Pill label={v.chart_type} color={BRAND.primary} />
                      <Pill label={v.data_source} />
                      {v.report_types?.map((rt: string) => <Pill key={rt} label={rt} color={REPORT_TYPE_COLORS[rt]} />)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => togglePreview(v)}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border font-medium transition-colors"
                    style={previewId === v.id
                      ? { background: BRAND.primary, color: '#fff', borderColor: BRAND.primary }
                      : { color: BRAND.primary, borderColor: BRAND.primary, background: 'transparent' }}>
                    <Eye size={10} /> {previewId === v.id ? 'Hide' : 'Preview'}
                  </button>
                  <button onClick={() => del(v.id)} className="text-gray-300 hover:text-red-400"><Trash2 size={13} /></button>
                </div>
              </div>
              <p className="text-[10px] font-mono text-gray-400 mt-2">{v.config_key}</p>
            </div>
            {previewId === v.id && (
              <div className="border-t px-3 pt-2 pb-3" style={{ borderColor: BRAND.border, background: '#fafbff' }}>
                {previewLoading ? (
                  <div className="flex items-center justify-center h-36 text-xs text-gray-400 gap-2">
                    <RefreshCw size={12} className="animate-spin" /> Loading data…
                  </div>
                ) : (
                  <>
                    <RFChartPreview chartType={v.chart_type} data={previewData} />
                    {previewData?.metadata && (
                      <p className="text-[9px] text-gray-400 mt-1">
                        Source: {previewData.metadata.source} · {previewData.metadata.row_count} rows ·{' '}
                        {previewData.metadata.user_filtered ? 'user-filtered' : 'aggregate'}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-gray-400 text-sm py-8 col-span-2">No visualization configs yet.</p>}
      </div>
    </div>
  );
}

// ── Benchmarks Tab ────────────────────────────────────────────────────────
function BenchmarksTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ benchmark_type: 'peer', min_cohort_size: '30', display_format: 'percentile' });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/api/rf/benchmarks').then(r => r.json()).then(d => setItems(d.configs ?? []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async (id: number) => {
    if (!confirm('Delete benchmark config?')) return;
    await apiFetch(`/api/rf/benchmarks/${id}`, { method: 'DELETE' });
    load();
  };

  const addBenchmark = async () => {
    if (!form.config_key || !form.title) return;
    let cohort: Record<string, unknown> = {};
    try { cohort = JSON.parse(form.cohort_json || '{}'); } catch { /* empty */ }
    await apiFetch('/api/rf/benchmarks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        cohort_definition: cohort,
        min_cohort_size: Number(form.min_cohort_size) || 30,
        metrics: form.metrics ? form.metrics.split(',').map(s => s.trim()) : [],
        report_types: form.report_types ? form.report_types.split(',').map(s => s.trim()) : [],
      }),
    });
    setShowAdd(false); setForm({ benchmark_type: 'peer', min_cohort_size: '30', display_format: 'percentile' }); load();
  };

  if (loading) return <Spinner />;

  const BM_COLORS: Record<string, string> = { peer: BRAND.primary, industry: BRAND.green, national: BRAND.amber, institutional: '#06b6d4', custom: BRAND.muted };

  return (
    <div>
      <SectionHeader title="Benchmark Configs" sub={`${items.length} cohort configurations — min k=${30} (k-anonymity enforced)`}
        onAdd={() => setShowAdd(true)} addLabel="New Config" />
      {showAdd && (
        <div className="mb-4 p-4 rounded-xl border space-y-2" style={{ borderColor: BRAND.primary, background: BRAND.primaryLight }}>
          <p className="text-sm font-semibold text-gray-700">New Benchmark Config</p>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Config key *" value={form.config_key ?? ''} onChange={e => setForm(p => ({ ...p, config_key: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs font-mono" style={{ borderColor: BRAND.border }} />
            <input placeholder="Title *" value={form.title ?? ''} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
            <select value={form.benchmark_type} onChange={e => setForm(p => ({ ...p, benchmark_type: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
              {['peer','industry','national','institutional','custom'].map(v => <option key={v}>{v}</option>)}
            </select>
            <input type="number" placeholder="Min cohort size (default 30)" value={form.min_cohort_size}
              onChange={e => setForm(p => ({ ...p, min_cohort_size: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
          </div>
          <textarea placeholder='Cohort definition JSON — e.g. {"same_age_band":true,"same_industry":true}'
            value={form.cohort_json ?? ''} onChange={e => setForm(p => ({ ...p, cohort_json: e.target.value }))}
            rows={2} className="w-full border rounded px-2 py-1.5 text-xs resize-none font-mono" style={{ borderColor: BRAND.border }} />
          <input placeholder="Metrics (comma-separated)" value={form.metrics ?? ''} onChange={e => setForm(p => ({ ...p, metrics: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
          <input placeholder="Report types (comma-separated)" value={form.report_types ?? ''} onChange={e => setForm(p => ({ ...p, report_types: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
          <div className="flex gap-2">
            <button onClick={addBenchmark} className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white" style={{ background: BRAND.primary }}>Save</button>
            <button onClick={() => setShowAdd(false)} className="flex-1 text-xs text-gray-500 border rounded-lg py-1.5" style={{ borderColor: BRAND.border }}>Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {items.map(b => (
          <div key={b.id} className="p-3 rounded-xl border" style={{ borderColor: BRAND.border }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium text-sm text-gray-800">{b.title}</span>
                  <Pill label={b.benchmark_type} color={BM_COLORS[b.benchmark_type]} />
                  <span className="text-[10px] text-gray-400">k≥{b.min_cohort_size}</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {b.metrics?.map((m: string) => <span key={m} className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{m}</span>)}
                </div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {b.report_types?.map((rt: string) => <Pill key={rt} label={rt} color={REPORT_TYPE_COLORS[rt]} />)}
                </div>
              </div>
              <button onClick={() => del(b.id)} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No benchmark configs yet.</p>}
      </div>
    </div>
  );
}

// ── White Label Tab ───────────────────────────────────────────────────────
function WhiteLabelTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ primary_color: '#6366f1', secondary_color: '#8b5cf6', accent_color: '#10b981', text_color: '#111827', font_family: 'Inter, sans-serif' });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/api/rf/white-label').then(r => r.json()).then(d => setItems(d.configs ?? []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async (tenantId: string) => {
    if (!confirm('Delete white label config?')) return;
    await apiFetch(`/api/rf/white-label/${encodeURIComponent(tenantId)}`, { method: 'DELETE' });
    load();
  };

  const addConfig = async () => {
    if (!form.tenant_id || !form.org_name) return;
    await apiFetch('/api/rf/white-label', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        allowed_report_types: form.allowed_report_types ? form.allowed_report_types.split(',').map(s => s.trim()) : [],
      }),
    });
    setShowAdd(false); setForm({ primary_color: '#6366f1', secondary_color: '#8b5cf6', accent_color: '#10b981', text_color: '#111827', font_family: 'Inter, sans-serif' }); load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader title="White Label Configs" sub={`${items.length} tenant branding configuration${items.length !== 1 ? 's' : ''}`}
        onAdd={() => setShowAdd(true)} addLabel="New Tenant" />
      {showAdd && (
        <div className="mb-4 p-4 rounded-xl border space-y-2" style={{ borderColor: BRAND.primary, background: BRAND.primaryLight }}>
          <p className="text-sm font-semibold text-gray-700">New White Label Config</p>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Tenant ID *" value={form.tenant_id ?? ''} onChange={e => setForm(p => ({ ...p, tenant_id: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs font-mono" style={{ borderColor: BRAND.border }} />
            <input placeholder="Organisation name *" value={form.org_name ?? ''} onChange={e => setForm(p => ({ ...p, org_name: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
            <input placeholder="Logo URL" value={form.logo_url ?? ''} onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs col-span-2" style={{ borderColor: BRAND.border }} />
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-500 w-16 shrink-0">Primary</label>
              <input type="color" value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))} className="w-8 h-7 rounded cursor-pointer border-0" />
              <input value={form.primary_color} onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))} className="flex-1 border rounded px-2 py-1 text-xs font-mono" style={{ borderColor: BRAND.border }} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-500 w-16 shrink-0">Secondary</label>
              <input type="color" value={form.secondary_color} onChange={e => setForm(p => ({ ...p, secondary_color: e.target.value }))} className="w-8 h-7 rounded cursor-pointer border-0" />
              <input value={form.secondary_color} onChange={e => setForm(p => ({ ...p, secondary_color: e.target.value }))} className="flex-1 border rounded px-2 py-1 text-xs font-mono" style={{ borderColor: BRAND.border }} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-500 w-16 shrink-0">Accent</label>
              <input type="color" value={form.accent_color} onChange={e => setForm(p => ({ ...p, accent_color: e.target.value }))} className="w-8 h-7 rounded cursor-pointer border-0" />
              <input value={form.accent_color} onChange={e => setForm(p => ({ ...p, accent_color: e.target.value }))} className="flex-1 border rounded px-2 py-1 text-xs font-mono" style={{ borderColor: BRAND.border }} />
            </div>
            <input placeholder="Font family" value={form.font_family} onChange={e => setForm(p => ({ ...p, font_family: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
          </div>
          <textarea placeholder="Report footer text" value={form.report_footer ?? ''} onChange={e => setForm(p => ({ ...p, report_footer: e.target.value }))}
            rows={2} className="w-full border rounded px-2 py-1.5 text-xs resize-none" style={{ borderColor: BRAND.border }} />
          <input placeholder="Allowed report types (comma-separated)" value={form.allowed_report_types ?? ''} onChange={e => setForm(p => ({ ...p, allowed_report_types: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
          <div className="flex gap-2">
            <button onClick={addConfig} className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white" style={{ background: BRAND.primary }}>Save</button>
            <button onClick={() => setShowAdd(false)} className="flex-1 text-xs text-gray-500 border rounded-lg py-1.5" style={{ borderColor: BRAND.border }}>Cancel</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {items.map(c => (
          <div key={c.id} className="p-4 rounded-xl border" style={{ borderColor: BRAND.border }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {c.logo_url
                  ? <img src={c.logo_url} alt="logo" className="w-10 h-10 rounded-lg object-contain border" style={{ borderColor: BRAND.border }} />
                  : <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                      style={{ background: c.primary_color ?? BRAND.primary }}>
                      {(c.org_name ?? 'T')[0]}
                    </div>
                }
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-800">{c.org_name}</p>
                  <p className="text-[10px] font-mono text-gray-400">{c.tenant_id}</p>
                  <div className="flex gap-1.5 mt-1">
                    {[c.primary_color, c.secondary_color, c.accent_color].map((clr: string, i: number) => (
                      <div key={i} className="w-4 h-4 rounded-full border" style={{ background: clr, borderColor: BRAND.border }} title={clr} />
                    ))}
                    <span className="text-[10px] text-gray-400 ml-1">{c.font_family}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => del(c.tenant_id)} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No white label configurations yet.</p>}
      </div>
    </div>
  );
}

// ── Languages Tab ─────────────────────────────────────────────────────────
function LanguagesTab() {
  const [packs, setPacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [newTranslations, setNewTranslations] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/api/rf/languages').then(r => r.json()).then(d => setPacks(d.packs ?? []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const activate = async (id: number, active: boolean) => {
    await apiFetch(`/api/rf/languages/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: active }),
    });
    load();
  };

  const saveTranslations = async (id: number) => {
    let translations: Record<string, unknown> = {};
    try { translations = JSON.parse(newTranslations); } catch { return; }
    await apiFetch(`/api/rf/languages/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ translations }),
    });
    setEditing(null); setNewTranslations(''); load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader title="Language Packs" sub="Multi-language report output — add translations per language code" />
      <div className="rounded-xl border p-4 mb-4 text-xs" style={{ borderColor: BRAND.border }}>
        <p className="font-semibold text-gray-700 mb-2">Dashboard specification</p>
        <p className="text-gray-500">Each language pack contains a <code className="bg-gray-100 px-1 rounded">translations</code> JSONB object mapping report keys to localised strings. Completeness % is calculated as <code className="bg-gray-100 px-1 rounded">covered_keys / total_keys × 100</code>. Only active packs are surfaced in the report generation UI.</p>
      </div>
      <div className="space-y-2">
        {packs.map(p => (
          <div key={p.id} className="p-3 rounded-xl border" style={{ borderColor: BRAND.border }}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-800">{p.language_name}</span>
                  <span className="text-gray-500 text-sm">{p.native_name}</span>
                  <span className="text-[10px] font-mono font-bold uppercase text-gray-400">[{p.language_code}]</span>
                  {p.rtl && <Pill label="RTL" color={BRAND.amber} />}
                  {p.is_default && <Pill label="Default" color={BRAND.green} />}
                  {p.is_active && !p.is_default && <Pill label="Active" color={BRAND.primary} />}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-32">
                    <div className="h-1.5 rounded-full" style={{ width: `${p.completeness_pct}%`, background: p.completeness_pct >= 80 ? BRAND.green : p.completeness_pct >= 40 ? BRAND.amber : BRAND.red }} />
                  </div>
                  <span className="text-[10px] text-gray-500">{p.completeness_pct}% complete</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!p.is_default && (
                  <button onClick={() => activate(p.id, !p.is_active)}
                    className="text-[11px] px-2 py-1 rounded-lg border font-semibold"
                    style={{ borderColor: p.is_active ? BRAND.green : BRAND.border, color: p.is_active ? BRAND.green : BRAND.muted }}>
                    {p.is_active ? 'Active' : 'Activate'}
                  </button>
                )}
                <button onClick={() => { setEditing(editing === p.id ? null : p.id); setNewTranslations(JSON.stringify(p.translations ?? {}, null, 2)); }}
                  className="text-gray-400 hover:text-indigo-500"><Settings size={13} /></button>
              </div>
            </div>
            {editing === p.id && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] text-gray-500">Translations JSON — keys map to report output strings</p>
                <textarea value={newTranslations} onChange={e => setNewTranslations(e.target.value)}
                  rows={6} className="w-full border rounded px-2 py-1.5 text-xs font-mono resize-none" style={{ borderColor: BRAND.border }} />
                <div className="flex gap-2">
                  <button onClick={() => saveTranslations(p.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: BRAND.primary }}>
                    <Save size={11} className="inline mr-1" />Save Translations
                  </button>
                  <button onClick={() => setEditing(null)} className="text-xs text-gray-500 border px-3 py-1.5 rounded-lg" style={{ borderColor: BRAND.border }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Precise Competency section renderer (mirrors pdf-renderer.ts) ──────────
// Renders the `precise_competency` section produced by generateReport, clearly
// labelled precise (measured per competency) vs domain-proxy (aggregate).
// No fabrication: score == null renders "—" (never 0); falls back to domain
// when precise absent. Mirrors backend/services/pdf-renderer.ts.
function PreciseCompetencySection({ section }: { section: any }) {
  const precise: any[] = Array.isArray(section?.precise) ? section.precise : [];
  const domains: any[] = Array.isArray(section?.domains) ? section.domains : [];
  const note = String(section?.note ?? '');

  const ScoreRow = ({ c }: { c: any }) => {
    const hasScore = c?.score != null;
    const score = hasScore ? Math.round(Number(c.score)) : null;
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="flex-1 text-gray-700">{c.name ?? c.code}</span>
        {c.levelLabel && <Pill label={c.levelLabel} color={BRAND.muted} />}
        <span className="font-semibold tabular-nums" style={{ color: hasScore ? BRAND.primary : BRAND.muted }}>
          {hasScore ? `${score} / 100` : '—'}
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border, background: BRAND.bg }}>
      <div className="flex items-center gap-2 mb-2">
        <Award size={14} style={{ color: BRAND.green }} />
        <p className="font-semibold text-gray-800 text-sm">{section.title ?? 'Precise Competency Scores'}</p>
      </div>
      {note && <p className="text-[11px] text-gray-400 italic mb-3">{note}</p>}
      {precise.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: BRAND.green }}>
            Precise (measured per competency)
          </p>
          <div className="divide-y" style={{ borderColor: BRAND.border }}>
            {precise.map((c, i) => <ScoreRow key={c.code ?? i} c={c} />)}
          </div>
        </div>
      )}
      {domains.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: BRAND.primary }}>
            Domain proxy (aggregate)
          </p>
          <div className="divide-y" style={{ borderColor: BRAND.border }}>
            {domains.map((c, i) => <ScoreRow key={c.code ?? i} c={c} />)}
          </div>
        </div>
      )}
      {precise.length === 0 && domains.length === 0 && (
        <p className="text-xs text-gray-400">No competency scores available.</p>
      )}
    </div>
  );
}

// ── Generic report-section renderer ───────────────────────────────────────
// Renders one entry of generated_content.sections on screen. Mirrors the
// section types emitted by generateReport (backend/services/report-factory-schema.ts).
function ReportSection({ section }: { section: any }) {
  const type = section?.type;
  if (type === 'precise_competency') return <PreciseCompetencySection section={section} />;

  const Wrap = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
      <div className="flex items-center gap-2 mb-2">
        <p className="font-semibold text-gray-800 text-sm">{section.title ?? section.key}</p>
        <Pill label={String(type ?? 'section')} />
      </div>
      {children}
    </div>
  );

  if (type === 'narrative' && section.text) {
    return <Wrap><p className="text-xs text-gray-600 whitespace-pre-line">{section.text}</p></Wrap>;
  }
  if (type === 'insight') {
    const insights: any[] = Array.isArray(section.insights) ? section.insights : [];
    return (
      <Wrap>
        {insights.length === 0
          ? <p className="text-xs text-gray-400">No insights fired.</p>
          : <div className="space-y-1.5">
              {insights.map((ins, i) => (
                <div key={ins.rule_key ?? i} className="flex items-start gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ background: SEVERITY_COLORS[ins.severity] ?? BRAND.muted }} />
                  <span className="text-gray-600">{ins.text}</span>
                </div>
              ))}
            </div>}
      </Wrap>
    );
  }
  if (type === 'benchmark') {
    const results: any[] = Array.isArray(section.benchmark_results) ? section.benchmark_results : [];
    return (
      <Wrap>
        {results.length === 0
          ? <p className="text-xs text-gray-400">No benchmark results.</p>
          : <div className="space-y-1 text-xs text-gray-600">
              {results.map((b, i) => (
                <div key={i} className="flex justify-between">
                  <span>{b.metric ?? b.label ?? `Metric ${i + 1}`}</span>
                  <span className="font-semibold tabular-nums">{b.percentile != null ? `${b.percentile}th pct` : (b.value ?? '—')}</span>
                </div>
              ))}
            </div>}
      </Wrap>
    );
  }
  if (type === 'chart') {
    return <Wrap><p className="text-xs text-gray-400">Chart: {section.visualization?.name ?? section.key} (rendered in PDF/visual export).</p></Wrap>;
  }
  // header / footer / score / custom — show whatever text the section carries
  return (
    <Wrap>
      {section.text
        ? <p className="text-xs text-gray-600 whitespace-pre-line">{section.text}</p>
        : <p className="text-xs text-gray-400">No on-screen content for this section type.</p>}
    </Wrap>
  );
}

// ── Generated Reports Tab ─────────────────────────────────────────────────
function GeneratedReportsTab() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openUuid, setOpenUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, any>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/api/rf/reports?limit=50').then(r => r.json()).then(d => setReports(d.reports ?? []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleView = async (uuid: string) => {
    if (openUuid === uuid) { setOpenUuid(null); return; }
    setOpenUuid(uuid);
    if (!detail[uuid]) {
      setDetailLoading(uuid);
      try {
        const r = await apiFetch(`/api/rf/reports/${uuid}`);
        const d = await r.json();
        setDetail(prev => ({ ...prev, [uuid]: d.report ?? null }));
      } catch {
        setDetail(prev => ({ ...prev, [uuid]: null }));
      } finally {
        setDetailLoading(null);
      }
    }
  };

  const STATUS_COLORS: Record<string, string> = { complete: BRAND.green, pending: BRAND.amber, generating: BRAND.primary, failed: BRAND.red };

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader title="Generated Reports" sub={`${reports.length} most recent reports`}
        onAdd={load} addLabel="↻ Refresh" />
      <div className="space-y-2">
        {reports.map(r => {
          const rep = detail[r.report_uuid];
          const sections: any[] = Array.isArray(rep?.generated_content?.sections) ? rep.generated_content.sections : [];
          const isOpen = openUuid === r.report_uuid;
          return (
            <div key={r.id} className="rounded-xl border text-xs overflow-hidden" style={{ borderColor: BRAND.border }}>
              <div className="p-3 cursor-pointer hover:bg-gray-50" onClick={() => toggleView(r.report_uuid)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-gray-400">{r.report_uuid?.slice(0, 8)}…</span>
                      <Pill label={r.report_type} color={REPORT_TYPE_COLORS[r.report_type]} />
                      <Pill label={r.status} color={STATUS_COLORS[r.status]} />
                      <span className="text-gray-400">{r.language}</span>
                    </div>
                    {r.user_id && <p className="text-gray-400">User: {r.user_id}</p>}
                    {r.session_id && <p className="text-gray-400">Session: {r.session_id}</p>}
                    <p className="text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.insights?.length > 0 && (
                      <span className="text-[10px] text-gray-400">{r.insights.length} insight{r.insights.length !== 1 ? 's' : ''}</span>
                    )}
                    <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: BRAND.primary }}>
                      <Eye size={11} />{isOpen ? 'Hide' : 'View'}
                      {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </span>
                  </div>
                </div>
              </div>
              {isOpen && (
                <div className="border-t px-3 py-3" style={{ borderColor: BRAND.border, background: BRAND.bg }}>
                  {detailLoading === r.report_uuid && <Spinner />}
                  {detailLoading !== r.report_uuid && rep === null && (
                    <p className="text-gray-400 text-center py-4">Could not load report content.</p>
                  )}
                  {detailLoading !== r.report_uuid && rep && sections.length === 0 && (
                    <p className="text-gray-400 text-center py-4">This report has no body sections.</p>
                  )}
                  {detailLoading !== r.report_uuid && rep && sections.length > 0 && (
                    <div className="space-y-2">
                      {sections.map((s, i) => <ReportSection key={s.key ?? i} section={s} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {reports.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No reports generated yet.</p>}
      </div>
    </div>
  );
}

// ── Exports Tab ───────────────────────────────────────────────────────────
function ExportsTab() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/api/rf/exports?limit=50').then(r => r.json()).then(d => setJobs(d.jobs ?? []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const STATUS_COLORS: Record<string, string> = { done: BRAND.green, queued: BRAND.amber, processing: BRAND.primary, failed: BRAND.red };
  const FORMAT_ICONS: Record<string, string> = { pdf: '📄', csv: '📊', json: '{ }', xlsx: '📋' };

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader title="Export Jobs" sub={`${jobs.length} most recent jobs`}
        onAdd={load} addLabel="↻ Refresh" />
      <div className="rounded-xl border p-4 mb-4 text-xs" style={{ borderColor: BRAND.border }}>
        <p className="font-semibold text-gray-700 mb-2">Export specification</p>
        <div className="grid grid-cols-2 gap-2 text-gray-500">
          <div><span className="font-semibold text-gray-600">PDF</span> — template layout rendered server-side via Puppeteer-compatible pipeline; white-label config applied</div>
          <div><span className="font-semibold text-gray-600">CSV</span> — score/insight rows with headers; UTF-8 BOM for Excel compatibility</div>
          <div><span className="font-semibold text-gray-600">JSON</span> — full generated_content JSONB blob; schema versioned via <code className="bg-gray-100 px-1 rounded">metadata.schema_version</code></div>
          <div><span className="font-semibold text-gray-600">XLSX</span> — multi-sheet (Summary, Scores, Insights, Benchmarks); auto-formatted cells</div>
        </div>
        <p className="text-gray-400 mt-2">Export jobs are async — poll <code className="bg-gray-100 px-1 rounded">GET /api/rf/exports/:jobUuid</code> until <code className="bg-gray-100 px-1 rounded">status=done</code>, then fetch <code className="bg-gray-100 px-1 rounded">output_url</code>.</p>
      </div>
      <div className="space-y-2">
        {jobs.map(j => (
          <div key={j.id} className="p-3 rounded-xl border text-xs" style={{ borderColor: BRAND.border }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl leading-none">{FORMAT_ICONS[j.format] ?? '📄'}</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-gray-400">{j.job_uuid?.slice(0, 8)}…</span>
                    <Pill label={j.format?.toUpperCase()} color={BRAND.primary} />
                    <Pill label={j.status} color={STATUS_COLORS[j.status]} />
                  </div>
                  <p className="text-gray-400 mt-0.5">{new Date(j.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  {j.file_size_bytes && <p className="text-gray-400">{(j.file_size_bytes / 1024).toFixed(1)} KB{j.page_count ? ` · ${j.page_count} pages` : ''}</p>}
                  {j.error_message && <p className="text-red-500 mt-0.5">{j.error_message}</p>}
                </div>
              </div>
              {j.output_url && j.status === 'done' && (
                <a href={j.output_url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg"
                  style={{ background: BRAND.primaryLight, color: BRAND.primary }}>
                  <Download size={10} /> Download
                </a>
              )}
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No export jobs yet.</p>}
      </div>
    </div>
  );
}

// ── Root Panel ────────────────────────────────────────────────────────────
export default function ReportFactoryPanel() {
  const [tab, setTab] = useState<RFTab>('overview');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-5 pb-0 border-b" style={{ borderColor: BRAND.border }}>
        <div className="flex items-center gap-2 mb-4">
          <FileText size={20} style={{ color: BRAND.primary }} />
          <h2 className="text-lg font-semibold text-gray-800">Design Report Factory</h2>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-1" style={{ background: BRAND.primaryLight, color: BRAND.primary }}>8 Engines</span>
        </div>
        {/* Tab bar */}
        <div className="flex gap-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors"
              style={{
                borderColor: tab === t.id ? BRAND.primary : 'transparent',
                color: tab === t.id ? BRAND.primary : BRAND.muted,
              }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>
      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'overview'       && <OverviewTab />}
        {tab === 'templates'      && <TemplatesTab />}
        {tab === 'narratives'     && <NarrativesTab />}
        {tab === 'insights'       && <InsightRulesTab />}
        {tab === 'visualizations' && <VisualizationsTab />}
        {tab === 'benchmarks'     && <BenchmarksTab />}
        {tab === 'whitelabel'     && <WhiteLabelTab />}
        {tab === 'languages'      && <LanguagesTab />}
        {tab === 'reports'        && <GeneratedReportsTab />}
        {tab === 'exports'        && <ExportsTab />}
      </div>
    </div>
  );
}
