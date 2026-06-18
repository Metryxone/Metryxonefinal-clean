import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Layers, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TYPES = ['behavioral','functional','cognitive','leadership','future_readiness'];
const CAL_METHODS = ['classical','irt_1pl','irt_2pl','irt_3pl','rasch'];

type DiffCal = { id:number; calibration_set_code:string; name:string; assessment_type:string; calibration_method:string; sample_size?:number; calibration_date?:string; status:string; is_active:boolean; };
type LevelFW = { id:number; code:string; name:string; assessment_type:string; levels:unknown; is_default:boolean; status:string; };
type LevelAnchor = { id:number; framework_id:number; level_code:string; competency_domain:string; anchor_statement:string; };

const DEFAULT_LEVELS = [
  { code:'L1', label:'Foundation', description:'Basic awareness and fundamental understanding', min_score:0, max_score:39 },
  { code:'L2', label:'Developing', description:'Growing proficiency with support needed', min_score:40, max_score:59 },
  { code:'L3', label:'Proficient', description:'Consistent independent performance', min_score:60, max_score:74 },
  { code:'L4', label:'Advanced', description:'Complex application with high reliability', min_score:75, max_score:89 },
  { code:'L5', label:'Expert', description:'Mastery and thought leadership', min_score:90, max_score:100 },
];

const DEFAULT_TIERS = [
  { tier:'easy', label:'Easy', irt_b_min:-3.0, irt_b_max:-0.5, p_min:0.70, p_max:1.00 },
  { tier:'medium', label:'Moderate', irt_b_min:-0.5, irt_b_max:0.5, p_min:0.40, p_max:0.69 },
  { tier:'hard', label:'Challenging', irt_b_min:0.5, irt_b_max:3.0, p_min:0.10, p_max:0.39 },
];

export default function CAFDifficultyLevelPanel() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'difficulty'|'level'|'anchors'>('difficulty');
  const [showCalForm, setShowCalForm] = useState(false);
  const [editCalId, setEditCalId] = useState<number|null>(null);
  const [calForm, setCalForm] = useState({ calibration_set_code:'', name:'', assessment_type:'behavioral', calibration_method:'classical', sample_size:'', calibration_date:'', status:'draft' });
  const [showLFForm, setShowLFForm] = useState(false);
  const [editLFId, setEditLFId] = useState<number|null>(null);
  const [lfForm, setLfForm] = useState({ code:'', name:'', assessment_type:'behavioral', description:'', is_default:false, status:'draft' });
  const [selectedFW, setSelectedFW] = useState<LevelFW|null>(null);
  const [anchorForm, setAnchorForm] = useState({ level_code:'L3', competency_domain:'', anchor_statement:'', sort_order:0 });

  const { data: calibrations=[] } = useQuery<DiffCal[]>({ queryKey:['caf-diff-cals'], queryFn:()=>fetch('/api/caf/difficulty-calibrations').then(r=>r.json()) });
  const { data: frameworks=[] } = useQuery<LevelFW[]>({ queryKey:['caf-level-fws'], queryFn:()=>fetch('/api/caf/level-frameworks').then(r=>r.json()) });
  const { data: anchors=[] } = useQuery<LevelAnchor[]>({
    queryKey:['caf-anchors', selectedFW?.id],
    queryFn:()=>selectedFW ? fetch(`/api/caf/level-anchors?framework_id=${selectedFW.id}`).then(r=>r.json()) : Promise.resolve([]),
    enabled:!!selectedFW,
  });

  const saveCal = useMutation({
    mutationFn:(b:Record<string,unknown>)=>editCalId
      ? fetch(`/api/caf/difficulty-calibrations/${editCalId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json())
      : fetch('/api/caf/difficulty-calibrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['caf-diff-cals']}); setShowCalForm(false); setEditCalId(null); setCalForm({calibration_set_code:'',name:'',assessment_type:'behavioral',calibration_method:'classical',sample_size:'',calibration_date:'',status:'draft'}); },
  });

  const saveLF = useMutation({
    mutationFn:(b:Record<string,unknown>)=>editLFId
      ? fetch(`/api/caf/level-frameworks/${editLFId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json())
      : fetch('/api/caf/level-frameworks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['caf-level-fws']}); setShowLFForm(false); setEditLFId(null); setLfForm({code:'',name:'',assessment_type:'behavioral',description:'',is_default:false,status:'draft'}); },
  });

  const delLF = useMutation({
    mutationFn:(id:number)=>fetch(`/api/caf/level-frameworks/${id}`,{method:'DELETE'}).then(r=>r.json()),
    onSuccess:()=>qc.invalidateQueries({queryKey:['caf-level-fws']}),
  });

  const addAnchor = useMutation({
    mutationFn:(b:Record<string,unknown>)=>fetch('/api/caf/level-anchors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['caf-anchors']}); setAnchorForm({level_code:'L3',competency_domain:'',anchor_statement:'',sort_order:0}); },
  });

  const delAnchor = useMutation({
    mutationFn:(id:number)=>fetch(`/api/caf/level-anchors/${id}`,{method:'DELETE'}).then(r=>r.json()),
    onSuccess:()=>qc.invalidateQueries({queryKey:['caf-anchors']}),
  });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Difficulty & Level Framework</h2>
        <p className="text-sm text-gray-500 mt-0.5">IRT calibration sets, proficiency level definitions, and behavioral anchors</p>
      </div>

      <div className="flex gap-2 border-b">
        {([['difficulty',`Difficulty Calibrations (${calibrations.length})`],['level',`Level Frameworks (${frameworks.length})`],['anchors','Level Anchors']] as const).map(([t,l])=>(
          <button key={t} onClick={()=>setActiveTab(t)}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab===t?'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Difficulty Calibrations ── */}
      {activeTab==='difficulty' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={()=>setShowCalForm(true)} className="gap-2"><Plus className="h-4 w-4"/>New Calibration Set</Button>
          </div>
          {/* Default tier reference */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2 text-blue-800 font-medium text-sm"><BarChart2 className="h-4 w-4"/>Default IRT Tier Definitions</div>
            <div className="grid grid-cols-3 gap-3">
              {DEFAULT_TIERS.map(t=>(
                <div key={t.tier} className="bg-white rounded-lg border p-3 text-xs">
                  <div className="font-bold text-gray-700 mb-1">{t.label}</div>
                  <div className="text-gray-500">IRT b: [{t.irt_b_min}, {t.irt_b_max}]</div>
                  <div className="text-gray-500">p-value: [{t.p_min}, {t.p_max}]</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Code','Name','Type','Method','Sample','Date','Status',''].map((h,i)=><th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {calibrations.length===0 ? <tr><td colSpan={8} className="py-10 text-center text-xs text-gray-400">No calibration sets yet</td></tr>
                : calibrations.map(c=>(
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-blue-700">{c.calibration_set_code}</td>
                    <td className="px-3 py-2 text-xs font-medium text-gray-800">{c.name}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{c.assessment_type.replace('_',' ')}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{c.calibration_method.toUpperCase()}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{c.sample_size?.toLocaleString()??'—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{c.calibration_date??'—'}</td>
                    <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${c.status==='published'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{c.status}</span></td>
                    <td className="px-3 py-2"><button onClick={()=>{setEditCalId(c.id);setCalForm({calibration_set_code:c.calibration_set_code,name:c.name,assessment_type:c.assessment_type,calibration_method:c.calibration_method,sample_size:String(c.sample_size??''),calibration_date:c.calibration_date??'',status:c.status});setShowCalForm(true);}} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 className="h-3.5 w-3.5"/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showCalForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
                <h3 className="text-lg font-bold">{editCalId?'Edit':'New'} Calibration Set</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Code *</label><Input value={calForm.calibration_set_code} onChange={e=>setCalForm(f=>({...f,calibration_set_code:e.target.value}))} className="h-8 text-sm" placeholder="CAL-BEH-2026"/></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><Input value={calForm.name} onChange={e=>setCalForm(f=>({...f,name:e.target.value}))} className="h-8 text-sm" placeholder="Behavioral — 2026"/></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select value={calForm.assessment_type} onChange={e=>setCalForm(f=>({...f,assessment_type:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                      {TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
                    <select value={calForm.calibration_method} onChange={e=>setCalForm(f=>({...f,calibration_method:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                      {CAL_METHODS.map(m=><option key={m} value={m}>{m.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Sample Size</label><Input type="number" value={calForm.sample_size} onChange={e=>setCalForm(f=>({...f,sample_size:e.target.value}))} className="h-8 text-sm"/></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Calibration Date</label><Input type="date" value={calForm.calibration_date} onChange={e=>setCalForm(f=>({...f,calibration_date:e.target.value}))} className="h-8 text-sm"/></div>
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t">
                  <Button variant="outline" onClick={()=>{setShowCalForm(false);setEditCalId(null);}}>Cancel</Button>
                  <Button onClick={()=>saveCal.mutate({...calForm, sample_size:calForm.sample_size?parseInt(calForm.sample_size):null, tier_definitions:DEFAULT_TIERS, passing_thresholds:{Foundation:0,Developing:40,Proficient:60,Advanced:75,Expert:90}})} disabled={saveCal.isPending||!calForm.calibration_set_code||!calForm.name}>{saveCal.isPending?'Saving…':'Save'}</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Level Frameworks ── */}
      {activeTab==='level' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={()=>setShowLFForm(true)} className="gap-2"><Plus className="h-4 w-4"/>New Level Framework</Button>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2 text-purple-800 font-medium text-sm"><Layers className="h-4 w-4"/>Default 5-Level Framework</div>
            <div className="flex gap-2">
              {DEFAULT_LEVELS.map(l=>(
                <div key={l.code} className="flex-1 bg-white rounded border p-2 text-xs text-center">
                  <div className="font-bold text-gray-700">{l.label}</div>
                  <div className="text-gray-400 mt-0.5">{l.min_score}–{l.max_score}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Code','Name','Type','Default','Status','Levels',''].map((h,i)=><th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {frameworks.length===0 ? <tr><td colSpan={7} className="py-10 text-center text-xs text-gray-400">No level frameworks yet</td></tr>
                : frameworks.map(fw=>(
                  <tr key={fw.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-purple-700">{fw.code}</td>
                    <td className="px-3 py-2 text-xs font-medium text-gray-800">{fw.name}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{fw.assessment_type.replace('_',' ')}</td>
                    <td className="px-3 py-2">{fw.is_default && <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded">Default</span>}</td>
                    <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${fw.status==='published'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{fw.status}</span></td>
                    <td className="px-3 py-2 text-xs text-gray-500">{Array.isArray(fw.levels) ? (fw.levels as unknown[]).length : '—'} levels</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={()=>{setSelectedFW(fw);setActiveTab('anchors')}} className="p-1 text-gray-400 hover:text-purple-600" title="Manage anchors"><Layers className="h-3.5 w-3.5"/></button>
                        <button onClick={()=>{if(confirm(`Delete "${fw.name}"?`))delLF.mutate(fw.id)}} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showLFForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
                <h3 className="text-lg font-bold">{editLFId?'Edit':'New'} Level Framework</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Code *</label><Input value={lfForm.code} onChange={e=>setLfForm(f=>({...f,code:e.target.value}))} className="h-8 text-sm" placeholder="LF-BEH-STD"/></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><Input value={lfForm.name} onChange={e=>setLfForm(f=>({...f,name:e.target.value}))} className="h-8 text-sm" placeholder="Behavioral Standard"/></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1">Assessment Type</label>
                    <select value={lfForm.assessment_type} onChange={e=>setLfForm(f=>({...f,assessment_type:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                      {TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lfForm.is_default} onChange={e=>setLfForm(f=>({...f,is_default:e.target.checked}))}/>Set as default</label>
                  </div>
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">Default 5-level schema (Foundation → Expert) will be applied. Edit anchors after creation.</div>
                <div className="flex justify-end gap-3 pt-2 border-t">
                  <Button variant="outline" onClick={()=>{setShowLFForm(false);setEditLFId(null);}}>Cancel</Button>
                  <Button onClick={()=>saveLF.mutate({...lfForm, levels: DEFAULT_LEVELS})} disabled={saveLF.isPending||!lfForm.code||!lfForm.name}>{saveLF.isPending?'Saving…':'Create Framework'}</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Level Anchors ── */}
      {activeTab==='anchors' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <select value={selectedFW?.id??''} onChange={e=>{const fw=frameworks.find(f=>f.id===parseInt(e.target.value))??null;setSelectedFW(fw);}} className="h-8 text-sm border rounded px-2">
              <option value="">Select framework…</option>
              {frameworks.map(fw=><option key={fw.id} value={fw.id}>{fw.name}</option>)}
            </select>
            {selectedFW && <span className="text-xs text-gray-500">{(anchors as LevelAnchor[]).length} anchors</span>}
          </div>

          {selectedFW && (
            <>
              <div className="bg-white border rounded-lg p-4 space-y-3">
                <div className="text-sm font-semibold text-gray-700">Add Anchor Statement</div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="block text-xs text-gray-500 mb-1">Level Code</label>
                    <select value={anchorForm.level_code} onChange={e=>setAnchorForm(f=>({...f,level_code:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                      {DEFAULT_LEVELS.map(l=><option key={l.code} value={l.code}>{l.code} — {l.label}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs text-gray-500 mb-1">Competency Domain *</label><Input value={anchorForm.competency_domain} onChange={e=>setAnchorForm(f=>({...f,competency_domain:e.target.value}))} placeholder="e.g. Communication" className="h-8 text-sm"/></div>
                  <div><label className="block text-xs text-gray-500 mb-1">Sort Order</label><Input type="number" value={anchorForm.sort_order} onChange={e=>setAnchorForm(f=>({...f,sort_order:parseInt(e.target.value)}))} className="h-8 text-sm"/></div>
                </div>
                <div><label className="block text-xs text-gray-500 mb-1">Anchor Statement *</label>
                  <textarea value={anchorForm.anchor_statement} onChange={e=>setAnchorForm(f=>({...f,anchor_statement:e.target.value}))} className="w-full border rounded p-2 text-sm min-h-16 resize-y" placeholder="Clearly states complex information…"/>
                </div>
                <Button size="sm" onClick={()=>addAnchor.mutate({...anchorForm, framework_id:selectedFW.id})} disabled={!anchorForm.competency_domain||!anchorForm.anchor_statement||addAnchor.isPending}>Add Anchor</Button>
              </div>

              <div className="bg-white border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['Level','Domain','Anchor Statement',''].map((h,i)=><th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {(anchors as LevelAnchor[]).length===0 ? <tr><td colSpan={4} className="py-8 text-center text-xs text-gray-400">No anchors yet</td></tr>
                    : (anchors as LevelAnchor[]).map(a=>(
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2"><span className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded font-mono">{a.level_code}</span></td>
                        <td className="px-3 py-2 text-xs font-medium text-gray-700">{a.competency_domain}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{a.anchor_statement}</td>
                        <td className="px-3 py-2"><button onClick={()=>delAnchor.mutate(a.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5"/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
