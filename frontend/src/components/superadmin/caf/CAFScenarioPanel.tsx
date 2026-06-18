import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, GitBranch, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TYPES = ['behavioral','functional','cognitive','leadership','future_readiness'];
const SCENARIO_TYPES = ['situational_judgment','case_study','roleplay','incident'];
const STATUSES = ['draft','review','approved','deprecated'];
const DIFF_COLORS: Record<string, string> = { easy:'bg-green-100 text-green-700', medium:'bg-yellow-100 text-yellow-700', hard:'bg-red-100 text-red-600' };
const STYPE_LABELS: Record<string, string> = { situational_judgment:'SJT', case_study:'Case Study', roleplay:'Roleplay', incident:'Incident' };

type Scenario = { id:number; code:string; title:string; scenario_type:string; assessment_type:string; context_narrative:string; situation_prompt:string; difficulty_tier:string; estimated_duration_mins:number; status:string; };

const defaultForm = { code:'', title:'', scenario_type:'situational_judgment', assessment_type:'behavioral', context_narrative:'', situation_prompt:'', difficulty_tier:'medium', estimated_duration_mins:15, competency_tags:'', status:'draft' };

export default function CAFScenarioPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [expanded, setExpanded] = useState<number|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [form, setForm] = useState({...defaultForm});
  const [activeTab, setActiveTab] = useState<'scenarios'|'branches'>('scenarios');
  const [branchScenario, setBranchScenario] = useState<Scenario|null>(null);
  const [branchForm, setBranchForm] = useState({ branch_key:'', condition_logic:'{}', outcome_label:'', score_modifier:0, sort_order:0 });

  const { data: scenarios=[], isLoading } = useQuery<Scenario[]>({
    queryKey: ['caf-scenarios', search, type, status],
    queryFn: () => fetch(`/api/caf/scenarios?search=${encodeURIComponent(search)}&type=${type}&status=${status}`)
      .then(r=>r.json())
      .then(d=>Array.isArray(d) ? d : []),
  });

  const { data: branches=[] } = useQuery({
    queryKey: ['caf-branches', expanded],
    queryFn: () => expanded
      ? fetch(`/api/caf/scenarios/${expanded}/branches`).then(r=>r.json()).then(d=>Array.isArray(d) ? d : [])
      : Promise.resolve([]),
    enabled: expanded !== null,
  });

  const save = useMutation({
    mutationFn: (body: Record<string,unknown>) => editId
      ? fetch(`/api/caf/scenarios/${editId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json())
      : fetch('/api/caf/scenarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()),
    onSuccess: () => { qc.invalidateQueries({queryKey:['caf-scenarios']}); setShowForm(false); setEditId(null); setForm({...defaultForm}); },
  });

  const del = useMutation({
    mutationFn: (id:number) => fetch(`/api/caf/scenarios/${id}`,{method:'DELETE'}).then(r=>r.json()),
    onSuccess: () => qc.invalidateQueries({queryKey:['caf-scenarios']}),
  });

  const addBranch = useMutation({
    mutationFn: (body: Record<string,unknown>) => fetch(`/api/caf/scenarios/${branchScenario?.id}/branches`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()),
    onSuccess: () => { qc.invalidateQueries({queryKey:['caf-branches']}); setBranchForm({branch_key:'',condition_logic:'{}',outcome_label:'',score_modifier:0,sort_order:0}); },
  });

  const delBranch = useMutation({
    mutationFn: ({sid,bid}:{sid:number,bid:number}) => fetch(`/api/caf/scenarios/${sid}/branches/${bid}`,{method:'DELETE'}).then(r=>r.json()),
    onSuccess: () => qc.invalidateQueries({queryKey:['caf-branches']}),
  });

  function handleSubmit(e:React.FormEvent) {
    e.preventDefault();
    save.mutate({ ...form, competency_tags: form.competency_tags ? form.competency_tags.split(',').map(t=>t.trim()).filter(Boolean) : null });
  }

  function openEdit(s:Scenario) {
    setEditId(s.id);
    setForm({ code:s.code, title:s.title, scenario_type:s.scenario_type, assessment_type:s.assessment_type,
      context_narrative:s.context_narrative, situation_prompt:s.situation_prompt,
      difficulty_tier:s.difficulty_tier, estimated_duration_mins:s.estimated_duration_mins,
      competency_tags:'', status:s.status });
    setShowForm(true);
  }

  function openBranches(s:Scenario) { setBranchScenario(s); setExpanded(s.id); setActiveTab('branches'); }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Scenario Framework</h2>
          <p className="text-sm text-gray-500 mt-0.5">Contextual scenarios with conditional branching for SJT, case studies, and incidents</p>
        </div>
        <Button onClick={()=>{setEditId(null);setForm({...defaultForm});setShowForm(true);}} className="gap-2"><Plus className="h-4 w-4"/>New Scenario</Button>
      </div>

      <div className="flex gap-2 border-b">
        {(['scenarios','branches'] as const).map(t => (
          <button key={t} onClick={()=>setActiveTab(t)}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab===t?'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t==='scenarios'?`Scenarios (${scenarios.length})`:`Branches${branchScenario?` — ${branchScenario.title}`:''}`}
          </button>
        ))}
      </div>

      {activeTab==='scenarios' && (
        <>
          <div className="flex flex-wrap gap-3 bg-gray-50 rounded-lg p-3">
            <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search scenarios…" className="flex-1 min-w-48 h-8 text-sm" />
            <select value={type} onChange={e=>setType(e.target.value)} className="h-8 text-sm border rounded px-2 bg-white">
              <option value="all">All Types</option>
              {TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
            </select>
            <select value={status} onChange={e=>setStatus(e.target.value)} className="h-8 text-sm border rounded px-2 bg-white">
              <option value="all">All Statuses</option>
              {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['','Code','Type','Scenario Type','Title','Difficulty','Duration','Status',''].map((h,i)=>(
                  <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? <tr><td colSpan={9} className="py-12 text-center text-gray-400">Loading…</td></tr>
                  : scenarios.length===0 ? <tr><td colSpan={9} className="py-12 text-center text-gray-400">No scenarios found</td></tr>
                  : scenarios.map(s => (
                  <>
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <button onClick={()=>setExpanded(expanded===s.id?null:s.id)} className="text-gray-400 hover:text-gray-600">
                          {expanded===s.id?<ChevronDown className="h-3.5 w-3.5"/>:<ChevronRight className="h-3.5 w-3.5"/>}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-700">{s.code}</td>
                      <td className="px-3 py-2"><span className="bg-purple-50 text-purple-700 text-xs px-1.5 py-0.5 rounded">{s.assessment_type.replace('_',' ')}</span></td>
                      <td className="px-3 py-2 text-xs text-gray-600">{STYPE_LABELS[s.scenario_type]??s.scenario_type}</td>
                      <td className="px-3 py-2 text-xs font-medium text-gray-800 max-w-xs truncate">{s.title}</td>
                      <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${DIFF_COLORS[s.difficulty_tier]}`}>{s.difficulty_tier}</span></td>
                      <td className="px-3 py-2 text-xs text-gray-500">{s.estimated_duration_mins}m</td>
                      <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${s.status==='approved'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{s.status}</span></td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={()=>openBranches(s)} className="p-1 text-gray-400 hover:text-purple-600" title="Manage branches"><GitBranch className="h-3.5 w-3.5"/></button>
                          <button onClick={()=>openEdit(s)} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 className="h-3.5 w-3.5"/></button>
                          <button onClick={()=>{if(confirm(`Delete "${s.title}"?`))del.mutate(s.id)}} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5"/></button>
                        </div>
                      </td>
                    </tr>
                    {expanded===s.id && (
                      <tr key={`${s.id}-exp`}>
                        <td colSpan={9} className="px-6 py-3 bg-purple-50/40">
                          <div className="text-xs font-semibold text-gray-600 mb-1">Context Narrative</div>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-4">{s.context_narrative}</p>
                          <div className="text-xs font-semibold text-gray-600 mt-2 mb-1">Situation Prompt</div>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-3">{s.situation_prompt}</p>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab==='branches' && branchScenario && (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700 font-medium">
            Branches for: <span className="font-bold">{branchScenario.title}</span>
            <button onClick={()=>setActiveTab('scenarios')} className="ml-2 text-xs underline text-blue-500">← Back to scenarios</button>
          </div>
          {/* Add branch form */}
          <div className="bg-white border rounded-lg p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-700">Add Branch</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Branch Key</label>
                <Input value={branchForm.branch_key} onChange={e=>setBranchForm(f=>({...f,branch_key:e.target.value}))} placeholder="e.g. escalate" className="h-8 text-sm"/>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Outcome Label</label>
                <Input value={branchForm.outcome_label} onChange={e=>setBranchForm(f=>({...f,outcome_label:e.target.value}))} placeholder="e.g. Effective escalation" className="h-8 text-sm"/>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Score Modifier</label>
                <Input type="number" step="0.1" value={branchForm.score_modifier} onChange={e=>setBranchForm(f=>({...f,score_modifier:parseFloat(e.target.value)}))} className="h-8 text-sm"/>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Condition Logic (JSON)</label>
              <Input value={branchForm.condition_logic} onChange={e=>setBranchForm(f=>({...f,condition_logic:e.target.value}))} placeholder='{"response_key":"q1","operator":"eq","value":"A"}' className="h-8 text-sm font-mono"/>
            </div>
            <Button size="sm" onClick={()=>{
              try { const cl=JSON.parse(branchForm.condition_logic); addBranch.mutate({...branchForm,condition_logic:cl}); }
              catch { alert('Invalid JSON in condition logic'); }
            }} disabled={!branchForm.branch_key||addBranch.isPending}>Add Branch</Button>
          </div>

          {/* Branches list */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Branch Key','Condition','Outcome','Score Modifier',''].map((h,i)=><th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {(branches as {id:number;branch_key:string;condition_logic:unknown;outcome_label?:string;score_modifier:number}[]).map(b=>(
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs text-purple-700">{b.branch_key}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{JSON.stringify(b.condition_logic).substring(0,60)}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{b.outcome_label||'—'}</td>
                    <td className="px-3 py-2 text-xs"><span className={`px-1.5 py-0.5 rounded ${b.score_modifier>0?'bg-green-100 text-green-700':b.score_modifier<0?'bg-red-100 text-red-600':'bg-gray-100 text-gray-500'}`}>{b.score_modifier>=0?'+':''}{b.score_modifier}</span></td>
                    <td className="px-3 py-2"><button onClick={()=>delBranch.mutate({sid:branchScenario.id,bid:b.id})} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5"/></button></td>
                  </tr>
                ))}
                {(branches as unknown[]).length===0 && <tr><td colSpan={5} className="py-8 text-center text-xs text-gray-400">No branches defined</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold mb-4">{editId?'Edit Scenario':'New Scenario'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
                  <Input value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))} placeholder="SCN-001" required className="h-8 text-sm"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                  <Input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Scenario title" required className="h-8 text-sm"/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Assessment Type</label>
                  <select value={form.assessment_type} onChange={e=>setForm(f=>({...f,assessment_type:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                    {TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Scenario Type</label>
                  <select value={form.scenario_type} onChange={e=>setForm(f=>({...f,scenario_type:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                    {SCENARIO_TYPES.map(t=><option key={t} value={t}>{STYPE_LABELS[t]??t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Difficulty</label>
                  <select value={form.difficulty_tier} onChange={e=>setForm(f=>({...f,difficulty_tier:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                    <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Context Narrative *</label>
                <textarea value={form.context_narrative} onChange={e=>setForm(f=>({...f,context_narrative:e.target.value}))} className="w-full border rounded p-2 text-sm min-h-24 resize-y" required placeholder="Set the scene — background, characters, environment…"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Situation Prompt *</label>
                <textarea value={form.situation_prompt} onChange={e=>setForm(f=>({...f,situation_prompt:e.target.value}))} className="w-full border rounded p-2 text-sm min-h-16 resize-y" required placeholder="What does the candidate need to do or decide?"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Duration (mins)</label>
                  <Input type="number" value={form.estimated_duration_mins} onChange={e=>setForm(f=>({...f,estimated_duration_mins:parseInt(e.target.value)}))} className="h-8 text-sm"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                    {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button type="button" variant="outline" onClick={()=>{setShowForm(false);setEditId(null);}}>Cancel</Button>
                <Button type="submit" disabled={save.isPending}>{save.isPending?'Saving…':editId?'Save Changes':'Create Scenario'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
