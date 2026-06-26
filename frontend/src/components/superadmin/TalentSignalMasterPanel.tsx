import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Search, Plus, ChevronDown, ChevronUp } from 'lucide-react';

interface Signal {
  id: number; signal_code: string; signal_name: string; category: string;
  subcategory: string; future_relevance: number; behavioral_indicator: string; is_active: boolean;
}

export default function TalentSignalMasterPanel() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expandedSignal, setExpandedSignal] = useState<number | null>(null);
  const [form, setForm] = useState({ signal_code: '', signal_name: '', category: 'behavioral', subcategory: '', future_relevance: 5, description: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [sR, stR] = await Promise.all([
        fetch(`/api/admin/talent/signals?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`, { credentials: 'include' }),
        fetch('/api/admin/talent/signals/stats', { credentials: 'include' }),
      ]);
      if (!sR.ok) throw new Error(await sR.text());
      const sData = await sR.json();
      setSignals(sData.rows || []);
      if (stR.ok) setStats(await stR.json());
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setError('');
    try {
      const r = await fetch('/api/admin/talent/signals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Save failed'); }
      setShowForm(false); setForm({ signal_code: '', signal_name: '', category: 'behavioral', subcategory: '', future_relevance: 5, description: '' });
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const CAT_COLORS: Record<string, string> = { behavioral: 'bg-blue-100 text-blue-700', cognitive: 'bg-purple-100 text-purple-700', emotional: 'bg-pink-100 text-pink-700', social: 'bg-green-100 text-green-700', technical: 'bg-orange-100 text-orange-700' };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Talent Signal Master (D3 + D4)</h2>
          <p className="text-sm text-gray-500 mt-0.5">300+ behavioural talent signals — categories, future relevance, indicators</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><Plus className="w-3.5 h-3.5" /> Add Signal</button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[['Total Signals', stats.overview?.total_signals ?? signals.length, 'bg-blue-50 text-blue-700'], ['Critical (9–10)', stats.overview?.critical_signals ?? 0, 'bg-green-50 text-green-700'], ['High (7–8)', stats.overview?.high_signals ?? 0, 'bg-purple-50 text-purple-700'], ['Categories', stats.category_distribution?.length || 0, 'bg-orange-50 text-orange-700']].map(([label, val, cls]) => (
            <div key={String(label)} className={`rounded-lg p-4 ${cls}`}>
              <div className="text-2xl font-bold">{val}</div>
              <div className="text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-gray-800 text-sm">New Signal</h3>
          <div className="grid grid-cols-2 gap-3">
            {(['signal_code', 'signal_name'] as const).map(f => (
              <div key={f}><label className="text-xs text-gray-500 mb-1 block capitalize">{f.replace('_', ' ')}</label>
                <input aria-label={f.replace('_', ' ')} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} /></div>
            ))}
            <div><label className="text-xs text-gray-500 mb-1 block">Category</label>
              <select className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {['behavioral', 'cognitive', 'emotional', 'social', 'technical'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Subcategory</label>
              <input className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" value={form.subcategory} onChange={e => setForm(p => ({ ...p, subcategory: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Future Relevance (1–10)</label>
              <input type="number" step="1" min="1" max="10" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" value={form.future_relevance} onChange={e => setForm(p => ({ ...p, future_relevance: parseInt(e.target.value) }))} /></div>
          </div>
          <div><label className="text-xs text-gray-500 mb-1 block">Description</label>
            <textarea className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          <div className="flex gap-2"><button onClick={save} disabled={saving} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button></div>
        </div>
      )}

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Search signals…" value={search} onChange={e => setSearch(e.target.value)} /></div>

      {loading ? <div className="text-center py-12 text-gray-500 text-sm">Loading signals…</div> : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Signal Code', 'Name', 'Category', 'Subcategory', 'Relevance', 'Status', ''].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {signals.map(s => (
              <React.Fragment key={s.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{s.signal_code}</td>
                  <td className="px-3 py-2 text-gray-800 text-xs">{s.signal_name}</td>
                  <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${CAT_COLORS[s.category] || 'bg-gray-100 text-gray-600'}`}>{s.category}</span></td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{s.subcategory || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`font-bold text-sm ${s.future_relevance >= 9 ? 'text-green-600' : s.future_relevance >= 7 ? 'text-blue-600' : 'text-gray-600'}`}>{s.future_relevance}</span>
                    <span className="text-gray-400 text-xs">/10</span>
                  </td>
                  <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-3 py-2"><button onClick={() => setExpandedSignal(expandedSignal === s.id ? null : s.id)} className="text-gray-400 hover:text-gray-600">{expandedSignal === s.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</button></td>
                </tr>
                {expandedSignal === s.id && (
                  <tr className="bg-blue-50"><td colSpan={7} className="px-4 py-2 text-xs text-gray-600 italic">{s.behavioral_indicator || s.signal_name}</td></tr>
                )}
              </React.Fragment>
            ))}
            {signals.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No signals found</td></tr>}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
