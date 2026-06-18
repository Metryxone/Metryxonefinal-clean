import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SCORE_METHODS = ['weighted_sum','irt_theta','percentage','bands','sum'];
const NORM_METHODS = ['raw','percentile','stanine','t_score','z_score'];

type ScoreRule = { id:number; assessment_id:number; rule_name:string; dimension:string; scoring_method:string; normalization:string; band_thresholds?:unknown; is_primary:boolean; sort_order:number; };
type Assessment = { id:number; code:string; title:string; assessment_type:string; status:string; };

const DEFAULT_BANDS = { Foundation:0, Developing:40, Proficient:60, Advanced:75, Expert:90 };

const BAND_DESCRIPTIONS: Record<string,string> = {
  Foundation: 'Score 0–39%: Basic awareness, needs significant development',
  Developing:  'Score 40–59%: Growing proficiency, benefits from coaching',
  Proficient:  'Score 60–74%: Consistent independent performance',
  Advanced:    'Score 75–89%: Complex application, high reliability',
  Expert:      'Score 90–100%: Mastery, can coach others',
};

const defaultForm = { rule_name:'', dimension:'overall', scoring_method:'weighted_sum', normalization:'raw', is_primary:false, sort_order:0, band_thresholds: JSON.stringify(DEFAULT_BANDS, null, 2) };

export default function CAFScoringPanel() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [form, setForm] = useState({...defaultForm});

  const { data: assessments=[] } = useQuery<Assessment[]>({
    queryKey:['caf-assessments-all'],
    queryFn:()=>fetch('/api/caf/assessments?limit=200').then(r=>r.json()).then(d=>d.assessments??[]),
  });

  const { data: rules=[] } = useQuery<ScoreRule[]>({
    queryKey:['caf-score-rules', selectedId],
    queryFn:()=>selectedId ? fetch(`/api/caf/score-rules?assessment_id=${selectedId}`).then(r=>r.json()) : Promise.resolve([]),
    enabled:!!selectedId,
  });

  const save = useMutation({
    mutationFn:(b:Record<string,unknown>)=>editId
      ? fetch(`/api/caf/score-rules/${editId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json())
      : fetch('/api/caf/score-rules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['caf-score-rules']}); setShowForm(false); setEditId(null); setForm({...defaultForm}); },
  });

  function handleSave() {
    let bt: unknown = null;
    try { bt = JSON.parse(form.band_thresholds); } catch { alert('Invalid JSON in band thresholds'); return; }
    save.mutate({ ...form, band_thresholds:bt, assessment_id:selectedId });
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Scoring Engine</h2>
        <p className="text-sm text-gray-500 mt-0.5">Define score rules, band thresholds, and normalization per assessment</p>
      </div>

      {/* Band reference */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">Default Band Thresholds</div>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(DEFAULT_BANDS).map(([band, min])=>(
            <div key={band} className="bg-white rounded-lg border text-center p-2">
              <div className="text-sm font-bold text-gray-800">{band}</div>
              <div className="text-xs text-blue-600 font-medium mt-0.5">≥ {min}%</div>
              <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{BAND_DESCRIPTIONS[band].split(':')[0]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Assessment selector */}
      <div className="flex items-center gap-3">
        <select value={selectedId??''} onChange={e=>{const id=parseInt(e.target.value);setSelectedId(isNaN(id)?null:id);}} className="h-9 text-sm border rounded px-3 flex-1">
          <option value="">— Select assessment to manage scoring rules —</option>
          {assessments.map(a=><option key={a.id} value={a.id}>[{a.status}] {a.title}</option>)}
        </select>
        {selectedId && <Button size="sm" onClick={()=>{setEditId(null);setForm({...defaultForm});setShowForm(true);}} className="gap-1"><Plus className="h-4 w-4"/>Add Rule</Button>}
      </div>

      {selectedId && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Rule Name','Dimension','Method','Normalization','Primary','Sort',''].map((h,i)=><th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {rules.length===0 ? <tr><td colSpan={7} className="py-10 text-center text-xs text-gray-400">No scoring rules configured. Add one above.</td></tr>
              : rules.map(r=>(
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs font-medium text-gray-800">{r.rule_name}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.dimension}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.scoring_method.replace('_',' ')}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.normalization}</td>
                  <td className="px-3 py-2">{r.is_primary && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400"/>}</td>
                  <td className="px-3 py-2 text-xs text-gray-400">{r.sort_order}</td>
                  <td className="px-3 py-2">
                    <button onClick={()=>{setEditId(r.id);setForm({rule_name:r.rule_name,dimension:r.dimension,scoring_method:r.scoring_method,normalization:r.normalization,is_primary:r.is_primary,sort_order:r.sort_order,band_thresholds:JSON.stringify(r.band_thresholds??DEFAULT_BANDS,null,2)});setShowForm(true);}} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 className="h-3.5 w-3.5"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Scoring methodology notes */}
      <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4 text-xs text-gray-600">
        <div>
          <div className="font-semibold mb-1 text-gray-700">Scoring Methods</div>
          <ul className="space-y-0.5 text-gray-500">
            <li><span className="font-medium text-gray-700">weighted_sum</span> — Σ(score × weight) across items</li>
            <li><span className="font-medium text-gray-700">percentage</span> — correct/total × 100</li>
            <li><span className="font-medium text-gray-700">irt_theta</span> — Maximum likelihood θ estimate</li>
            <li><span className="font-medium text-gray-700">bands</span> — Direct band assignment via thresholds</li>
            <li><span className="font-medium text-gray-700">sum</span> — Raw additive score</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-1 text-gray-700">Normalization</div>
          <ul className="space-y-0.5 text-gray-500">
            <li><span className="font-medium text-gray-700">raw</span> — No transformation</li>
            <li><span className="font-medium text-gray-700">percentile</span> — Rank in norming sample</li>
            <li><span className="font-medium text-gray-700">stanine</span> — 1–9 standard nine</li>
            <li><span className="font-medium text-gray-700">t_score</span> — Mean=50, SD=10</li>
            <li><span className="font-medium text-gray-700">z_score</span> — Mean=0, SD=1</li>
          </ul>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-bold">{editId?'Edit':'Add'} Scoring Rule</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">Rule Name *</label><Input value={form.rule_name} onChange={e=>setForm(f=>({...f,rule_name:e.target.value}))} className="h-8 text-sm" placeholder="Overall Proficiency Score"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Dimension</label><Input value={form.dimension} onChange={e=>setForm(f=>({...f,dimension:e.target.value}))} className="h-8 text-sm" placeholder="overall"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label><Input type="number" value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:parseInt(e.target.value)}))} className="h-8 text-sm"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Scoring Method</label>
                <select value={form.scoring_method} onChange={e=>setForm(f=>({...f,scoring_method:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                  {SCORE_METHODS.map(m=><option key={m} value={m}>{m.replace('_',' ')}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Normalization</label>
                <select value={form.normalization} onChange={e=>setForm(f=>({...f,normalization:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                  {NORM_METHODS.map(m=><option key={m} value={m}>{m.replace('_','‑')}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Band Thresholds (JSON — band:min_score)</label>
              <textarea value={form.band_thresholds} onChange={e=>setForm(f=>({...f,band_thresholds:e.target.value}))} className="w-full border rounded p-2 text-xs font-mono min-h-20 resize-y"/>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_primary} onChange={e=>setForm(f=>({...f,is_primary:e.target.checked}))}/>Primary rule (used for session scoring)</label>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={()=>{setShowForm(false);setEditId(null);}}>Cancel</Button>
              <Button onClick={handleSave} disabled={save.isPending||!form.rule_name}>{save.isPending?'Saving…':editId?'Save Changes':'Add Rule'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
