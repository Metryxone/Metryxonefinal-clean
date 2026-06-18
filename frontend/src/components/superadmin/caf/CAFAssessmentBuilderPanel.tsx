import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, Layers, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TYPES = ['behavioral','functional','cognitive','leadership','future_readiness'];
const STATUSES = ['draft','review','published','archived'];
const PROC_LEVELS = ['none','basic','full'];
const SECTION_TYPES = ['standard','scenario','adaptive'];
const SCORE_METHODS = ['sum','weighted_sum','irt','percentage'];
const STATUS_COLORS: Record<string,string> = { draft:'bg-gray-100 text-gray-600', review:'bg-yellow-100 text-yellow-700', published:'bg-green-100 text-green-700', archived:'bg-red-100 text-red-600' };

type Assessment = { id:number; code:string; title:string; assessment_type:string; status:string; time_limit_mins?:number; passing_score:number; max_attempts:number; section_count?:string; session_count?:string; version:number; };
type Section = { id:number; code:string; title:string; section_type:string; question_count:number; scoring_method:string; weight:number; sort_order:number; question_count_actual?:string; };
type SectionQ = { id:number; question_id:number; code:string; stem:string; difficulty_tier:string; domain?:string; is_fixed:boolean; pool_group?:string; };

const defaultAForm = { code:'', title:'', assessment_type:'behavioral', description:'', time_limit_mins:'', max_attempts:1, passing_score:60, randomize_questions:false, show_feedback:true, allow_review:false, proctoring_level:'none', status:'draft' };
const defaultSForm = { code:'', title:'', section_type:'standard', time_limit_mins:'', question_count:10, randomize:false, weight:1.0, scoring_method:'sum', sort_order:0 };

export default function CAFAssessmentBuilderPanel() {
  const qc = useQueryClient();
  const [view, setView] = useState<'list'|'builder'>('list');
  const [activeAssessment, setActiveAssessment] = useState<Assessment|null>(null);
  const [activeSectionId, setActiveSectionId] = useState<number|null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAForm, setShowAForm] = useState(false);
  const [editAId, setEditAId] = useState<number|null>(null);
  const [aForm, setAForm] = useState({...defaultAForm});
  const [showSForm, setShowSForm] = useState(false);
  const [sForm, setSForm] = useState({...defaultSForm});
  const [qSearch, setQSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey:['caf-assessments', typeFilter, statusFilter],
    queryFn:()=>fetch(`/api/caf/assessments?type=${typeFilter}&status=${statusFilter}&limit=100`).then(r=>r.json()),
  });

  const { data: aDetail } = useQuery({
    queryKey:['caf-assessment-detail', activeAssessment?.id],
    queryFn:()=>activeAssessment ? fetch(`/api/caf/assessments/${activeAssessment.id}`).then(r=>r.json()) : Promise.resolve(null),
    enabled:!!activeAssessment,
  });

  const { data: sectionQs=[] } = useQuery<SectionQ[]>({
    queryKey:['caf-section-qs', activeSectionId],
    queryFn:()=>activeSectionId ? fetch(`/api/caf/sections/${activeSectionId}/questions`).then(r=>r.json()) : Promise.resolve([]),
    enabled:!!activeSectionId,
  });

  const { data: availQs } = useQuery({
    queryKey:['caf-q-pool', activeAssessment?.assessment_type, qSearch],
    queryFn:()=>activeAssessment ? fetch(`/api/caf/questions?type=${activeAssessment.assessment_type}&status=approved&search=${encodeURIComponent(qSearch)}&limit=100`).then(r=>r.json()) : Promise.resolve({questions:[]}),
    enabled:!!activeAssessment && !!activeSectionId,
  });

  const saveA = useMutation({
    mutationFn:(b:Record<string,unknown>)=>editAId
      ? fetch(`/api/caf/assessments/${editAId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json())
      : fetch('/api/caf/assessments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()),
    onSuccess:(res)=>{
      qc.invalidateQueries({queryKey:['caf-assessments']});
      setShowAForm(false); setEditAId(null); setAForm({...defaultAForm});
      if(!editAId && res.id){ setActiveAssessment(res); setView('builder'); }
    },
  });

  const delA = useMutation({
    mutationFn:(id:number)=>fetch(`/api/caf/assessments/${id}`,{method:'DELETE'}).then(r=>r.json()),
    onSuccess:()=>qc.invalidateQueries({queryKey:['caf-assessments']}),
  });

  const saveS = useMutation({
    mutationFn:(b:Record<string,unknown>)=>fetch(`/api/caf/assessments/${activeAssessment!.id}/sections`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['caf-assessment-detail']}); setShowSForm(false); setSForm({...defaultSForm}); },
  });

  const delS = useMutation({
    mutationFn:({aid,sid}:{aid:number,sid:number})=>fetch(`/api/caf/assessments/${aid}/sections/${sid}`,{method:'DELETE'}).then(r=>r.json()),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['caf-assessment-detail']}); if(activeSectionId) setActiveSectionId(null); },
  });

  const addQ = useMutation({
    mutationFn:(qid:number)=>fetch(`/api/caf/sections/${activeSectionId}/questions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question_id:qid})}).then(r=>r.json()),
    onSuccess:()=>qc.invalidateQueries({queryKey:['caf-section-qs']}),
  });

  const removeQ = useMutation({
    mutationFn:(qid:number)=>fetch(`/api/caf/sections/${activeSectionId}/questions/${qid}`,{method:'DELETE'}).then(r=>r.json()),
    onSuccess:()=>qc.invalidateQueries({queryKey:['caf-section-qs']}),
  });

  const publishA = useMutation({
    mutationFn:()=>fetch(`/api/caf/assessments/${activeAssessment!.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'published'})}).then(r=>r.json()),
    onSuccess:(res)=>{ qc.invalidateQueries({queryKey:['caf-assessments','caf-assessment-detail']}); setActiveAssessment(res); },
  });

  const assessments: Assessment[] = data?.assessments ?? [];
  const sections: Section[] = aDetail?.sections ?? [];
  const assignedQIds = new Set(sectionQs.map(sq => sq.question_id));

  if(view==='builder' && activeAssessment) return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={()=>{setView('list');setActiveAssessment(null);setActiveSectionId(null);}} className="text-blue-600 text-sm hover:underline">← Assessments</button>
        <span className="text-gray-400">/</span>
        <span className="font-semibold text-gray-800">{activeAssessment.title}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[activeAssessment.status]}`}>{activeAssessment.status}</span>
        <div className="ml-auto flex gap-2">
          {activeAssessment.status==='draft' && <Button size="sm" onClick={()=>publishA.mutate()} disabled={publishA.isPending} className="bg-green-600 hover:bg-green-700">{publishA.isPending?'Publishing…':'Publish'}</Button>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Sections panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 text-sm">Sections</h3>
            <Button size="sm" variant="outline" onClick={()=>setShowSForm(true)} className="gap-1 h-7 text-xs"><Plus className="h-3 w-3"/>Add</Button>
          </div>
          <div className="space-y-2">
            {sections.map(s=>(
              <div key={s.id} onClick={()=>setActiveSectionId(activeSectionId===s.id?null:s.id)}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${activeSectionId===s.id?'border-blue-400 bg-blue-50':'border-gray-200 hover:bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800 truncate">{s.title}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">{s.question_count_actual??'0'}q</span>
                    <button onClick={e=>{e.stopPropagation();if(confirm(`Delete section "${s.title}"?`))delS.mutate({aid:activeAssessment.id,sid:s.id})}} className="p-0.5 text-gray-300 hover:text-red-400"><Trash2 className="h-3 w-3"/></button>
                  </div>
                </div>
                <div className="flex gap-2 mt-1">
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1 rounded">{s.section_type}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1 rounded">{s.scoring_method}</span>
                  <span className="text-[10px] text-gray-400">wt:{s.weight}</span>
                </div>
              </div>
            ))}
            {sections.length===0 && <p className="text-xs text-gray-400 text-center py-6">Add sections to build your assessment</p>}
          </div>
        </div>

        {/* Questions panel */}
        <div className="col-span-2 space-y-3">
          {activeSectionId ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-700 text-sm">
                  Section: <span className="text-blue-700">{sections.find(s=>s.id===activeSectionId)?.title}</span>
                  <span className="ml-2 text-xs text-gray-400">({sectionQs.length} assigned)</span>
                </h3>
              </div>
              {/* Assigned questions */}
              <div className="bg-white border rounded-lg max-h-48 overflow-y-auto">
                <div className="px-3 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500">Assigned Questions</div>
                {sectionQs.length===0 ? <p className="text-xs text-gray-400 text-center py-6">No questions assigned</p>
                : sectionQs.map(sq=>(
                  <div key={sq.id} className="flex items-start gap-2 px-3 py-2 border-b last:border-0 hover:bg-gray-50">
                    <span className={`text-[10px] px-1 rounded mt-0.5 ${sq.difficulty_tier==='hard'?'bg-red-100 text-red-600':sq.difficulty_tier==='easy'?'bg-green-100 text-green-600':'bg-yellow-100 text-yellow-700'}`}>{sq.difficulty_tier}</span>
                    <span className="text-xs text-gray-700 flex-1 truncate">{sq.stem}</span>
                    <button onClick={()=>removeQ.mutate(sq.question_id)} className="text-gray-300 hover:text-red-400 flex-shrink-0"><Trash2 className="h-3 w-3"/></button>
                  </div>
                ))}
              </div>
              {/* Available questions */}
              <div className="bg-white border rounded-lg">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b">
                  <span className="text-xs font-medium text-gray-500">Available Questions (approved)</span>
                  <Input value={qSearch} onChange={e=>setQSearch(e.target.value)} placeholder="Search…" className="h-6 text-xs flex-1"/>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y">
                  {(availQs?.questions??[]).filter((q:{id:number})=>!assignedQIds.has(q.id)).map((q:{id:number;code:string;stem:string;difficulty_tier:string;domain?:string})=>(
                    <div key={q.id} className="flex items-start gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={()=>addQ.mutate(q.id)}>
                      <span className={`text-[10px] px-1 rounded mt-0.5 flex-shrink-0 ${q.difficulty_tier==='hard'?'bg-red-100 text-red-600':q.difficulty_tier==='easy'?'bg-green-100 text-green-600':'bg-yellow-100 text-yellow-700'}`}>{q.difficulty_tier}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-700 truncate">{q.stem}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{q.code}{q.domain&&` · ${q.domain}`}</div>
                      </div>
                      <Plus className="h-3 w-3 text-gray-300 flex-shrink-0 mt-0.5"/>
                    </div>
                  ))}
                  {!availQs?.questions?.length && <p className="text-xs text-gray-400 text-center py-6">No approved questions for this type</p>}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm border-2 border-dashed rounded-xl p-12">
              <div className="text-center"><BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30"/><p>Select a section to manage its questions</p></div>
            </div>
          )}
        </div>
      </div>

      {/* Add section form */}
      {showSForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-bold">Add Section</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Code *</label><Input value={sForm.code} onChange={e=>setSForm(f=>({...f,code:e.target.value}))} className="h-8 text-sm" placeholder="S01-BEHAVIORAL"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Title *</label><Input value={sForm.title} onChange={e=>setSForm(f=>({...f,title:e.target.value}))} className="h-8 text-sm" placeholder="Behavioral Scenarios"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select value={sForm.section_type} onChange={e=>setSForm(f=>({...f,section_type:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                  {SECTION_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Scoring Method</label>
                <select value={sForm.scoring_method} onChange={e=>setSForm(f=>({...f,scoring_method:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                  {SCORE_METHODS.map(m=><option key={m} value={m}>{m.replace('_',' ')}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Q Count</label><Input type="number" value={sForm.question_count} onChange={e=>setSForm(f=>({...f,question_count:parseInt(e.target.value)}))} className="h-8 text-sm"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Weight</label><Input type="number" step="0.1" value={sForm.weight} onChange={e=>setSForm(f=>({...f,weight:parseFloat(e.target.value)}))} className="h-8 text-sm"/></div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={()=>setShowSForm(false)}>Cancel</Button>
              <Button onClick={()=>saveS.mutate({...sForm, time_limit_mins:sForm.time_limit_mins?parseInt(String(sForm.time_limit_mins)):null})} disabled={saveS.isPending||!sForm.code||!sForm.title}>{saveS.isPending?'Saving…':'Add Section'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Assessment Builder</h2>
          <p className="text-sm text-gray-500 mt-0.5">Compose multi-section assessments from the question bank</p>
        </div>
        <Button onClick={()=>{setEditAId(null);setAForm({...defaultAForm});setShowAForm(true);}} className="gap-2"><Plus className="h-4 w-4"/>New Assessment</Button>
      </div>

      <div className="flex gap-3 bg-gray-50 rounded-lg p-3">
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="h-8 text-sm border rounded px-2 bg-white">
          <option value="all">All Types</option>
          {TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="h-8 text-sm border rounded px-2 bg-white">
          <option value="all">All Statuses</option>
          {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-400 flex items-center">{assessments.length} assessments</span>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Code','Title','Type','Sections','Sessions','Time','Status','v',''].map((h,i)=><th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? <tr><td colSpan={9} className="py-12 text-center text-gray-400">Loading…</td></tr>
            : assessments.length===0 ? <tr><td colSpan={9} className="py-12 text-center text-gray-400">No assessments found</td></tr>
            : assessments.map(a=>(
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-blue-700">{a.code}</td>
                <td className="px-3 py-2 text-xs font-medium text-gray-800">{a.title}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{a.assessment_type.replace('_',' ')}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{a.section_count??0}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{a.session_count??0}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{a.time_limit_mins ? `${a.time_limit_mins}m` : '—'}</td>
                <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[a.status]}`}>{a.status}</span></td>
                <td className="px-3 py-2 text-xs text-gray-400">v{a.version}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={()=>{setActiveAssessment(a);setView('builder');}} className="p-1 text-gray-400 hover:text-blue-600" title="Open builder"><Layers className="h-3.5 w-3.5"/></button>
                    <button onClick={()=>{setEditAId(a.id);setAForm({...defaultAForm,code:a.code,title:a.title,assessment_type:a.assessment_type,max_attempts:a.max_attempts,passing_score:a.passing_score,status:a.status,time_limit_mins:String(a.time_limit_mins??''),randomize_questions:false,show_feedback:true,allow_review:false,proctoring_level:'none',description:''});setShowAForm(true);}} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 className="h-3.5 w-3.5"/></button>
                    <button onClick={()=>{if(confirm(`Delete "${a.title}"?`))delA.mutate(a.id)}} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5"/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6 space-y-4">
            <h3 className="text-lg font-bold">{editAId?'Edit Assessment':'New Assessment'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Code *</label><Input value={aForm.code} onChange={e=>setAForm(f=>({...f,code:e.target.value}))} className="h-8 text-sm" placeholder="ASM-BEH-001"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Title *</label><Input value={aForm.title} onChange={e=>setAForm(f=>({...f,title:e.target.value}))} className="h-8 text-sm" placeholder="Behavioral Assessment L3"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
                <select value={aForm.assessment_type} onChange={e=>setAForm(f=>({...f,assessment_type:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                  {TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Time Limit (mins)</label><Input type="number" value={aForm.time_limit_mins} onChange={e=>setAForm(f=>({...f,time_limit_mins:e.target.value}))} placeholder="blank = untimed" className="h-8 text-sm"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Passing Score (%)</label><Input type="number" value={aForm.passing_score} onChange={e=>setAForm(f=>({...f,passing_score:parseFloat(e.target.value)}))} className="h-8 text-sm"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Max Attempts</label><Input type="number" value={aForm.max_attempts} onChange={e=>setAForm(f=>({...f,max_attempts:parseInt(e.target.value)}))} className="h-8 text-sm"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Proctoring</label>
                <select value={aForm.proctoring_level} onChange={e=>setAForm(f=>({...f,proctoring_level:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                  {PROC_LEVELS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={aForm.status} onChange={e=>setAForm(f=>({...f,status:e.target.value}))} className="w-full h-8 text-sm border rounded px-2">
                  {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-4">
              {[['randomize_questions','Randomize questions'],['show_feedback','Show feedback'],['allow_review','Allow review']].map(([k,l])=>(
                <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!aForm[k as keyof typeof aForm]} onChange={e=>setAForm(f=>({...f,[k]:e.target.checked}))} />{l}</label>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={()=>{setShowAForm(false);setEditAId(null);}}>Cancel</Button>
              <Button onClick={()=>saveA.mutate({...aForm, time_limit_mins:aForm.time_limit_mins?parseInt(String(aForm.time_limit_mins)):null})} disabled={saveA.isPending||!aForm.code||!aForm.title}>{saveA.isPending?'Saving…':editAId?'Save Changes':'Create & Open Builder'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
