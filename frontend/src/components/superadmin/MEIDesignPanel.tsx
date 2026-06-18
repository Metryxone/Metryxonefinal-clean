import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, Briefcase, GraduationCap, Brain, FolderOpen,
  ChevronDown, ChevronRight, RefreshCw, BarChart3, Users,
  Settings, TrendingUp, Sliders, AlertTriangle,
  Plus, Pencil, Trash2, X, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ────────────────────────────────────────────────────────────────────

type Dimension = { id:number; code:string; name:string; short_name:string; description:string; rationale:string; base_weight:string; max_points:string; icon_key:string; color_hex:string; display_order:number; is_active:boolean };
type Subdimension = { id:number; dimension_id:number; dimension_code:string; dimension_name:string; code:string; name:string; description:string; within_dim_weight:string; data_sources:string[] };
type Competency = { id:number; subdimension_id:number; subdimension_code:string; subdimension_name:string; dimension_code:string; code:string; name:string; description:string; within_sd_weight:string; formula_type:string; formula_config:Record<string,unknown>; max_raw:string; is_gated:boolean; gate_condition:string|null };
type IndustryCal = { id:number; industry_code:string; industry_name:string; dimension_id:number; dimension_code:string; dimension_name:string; multiplier:string };
type RoleCal = { id:number; role_level_code:string; role_level_name:string; yoe_min:string|null; yoe_max:string|null; dimension_id:number; dimension_code:string; dimension_name:string; multiplier:string };
type InsightRule = { id:number; rule_type:string; trigger_field:string; trigger_operator:string; narrative_template:string; tone:string; audience:string; priority:number };
type Recommendation = { id:number; code:string; title:string; description:string; action_type:string; dimension_name:string|null; estimated_point_gain:string|null; effort_level:string; time_to_complete:string|null };
type ScoreOverview = { overview:{total_scored:number;avg_score:string;min_score:string;max_score:string}; band_distribution:{band:string;count:number}[]; recent_scores:{user_id:string;composite_score:number;band:string;computed_at:string}[] };

// ── Icon map ─────────────────────────────────────────────────────────────────

const DIM_ICONS: Record<string,React.ReactNode> = {
  validated_proficiency:   <CheckCircle  className="h-4 w-4" style={{color:'#6366f1'}}/>,
  professional_experience: <Briefcase    className="h-4 w-4" style={{color:'#0ea5e9'}}/>,
  knowledge_foundation:    <GraduationCap className="h-4 w-4" style={{color:'#10b981'}}/>,
  behavioural_intelligence:<Brain        className="h-4 w-4" style={{color:'#f59e0b'}}/>,
  portfolio_signal:        <FolderOpen   className="h-4 w-4" style={{color:'#8b5cf6'}}/>,
};

const BAND_COLORS: Record<string,string> = {
  hire_ready:    'bg-green-100 text-green-700',
  career_ready:  'bg-blue-100 text-blue-700',
  building:      'bg-yellow-100 text-yellow-700',
  getting_started:'bg-gray-100 text-gray-600',
};

// ── Main Panel ────────────────────────────────────────────────────────────────

// ── Blank templates ───────────────────────────────────────────────────────────

const BLANK_RULE = { rule_type:'band', trigger_field:'band', trigger_operator:'eq', trigger_value:'', narrative_template:'', tone:'direct', audience:'candidate', priority:50 };
const BLANK_REC  = { code:'', title:'', description:'', action_type:'update_profile', estimated_point_gain:'', effort_level:'medium', time_to_complete:'', link_path:'', display_order:99 };

export default function MEIDesignPanel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'overview'|'taxonomy'|'calibration'|'insights'|'scores'>('overview');
  const [expandedDim, setExpandedDim] = useState<string|null>(null);
  const [editingCal, setEditingCal] = useState<{type:'industry'|'role';id:number;val:string}|null>(null);

  // Rule CRUD state
  const [editingRule, setEditingRule] = useState<(typeof BLANK_RULE & {id?:number})|null>(null);
  const [addingRule,  setAddingRule]  = useState(false);
  const [ruleFilter,  setRuleFilter]  = useState<string>('all');

  // Recommendation CRUD state
  const [editingRec, setEditingRec] = useState<(typeof BLANK_REC & {id?:number})|null>(null);
  const [addingRec,  setAddingRec]  = useState(false);

  const { data: dims=[] } = useQuery<Dimension[]>({ queryKey:['mei-dims'], queryFn:()=>fetch('/api/admin/mei/dimensions').then(r=>r.json()).then(d=>d.dimensions??[]) });
  const { data: sds=[] }  = useQuery<Subdimension[]>({ queryKey:['mei-sds'], queryFn:()=>fetch('/api/admin/mei/subdimensions').then(r=>r.json()).then(d=>d.subdimensions??[]) });
  const { data: comps=[] }= useQuery<Competency[]>({ queryKey:['mei-comps'], queryFn:()=>fetch('/api/admin/mei/competencies').then(r=>r.json()).then(d=>d.competencies??[]) });
  const { data: indCal=[] }= useQuery<IndustryCal[]>({ queryKey:['mei-ind-cal'], queryFn:()=>fetch('/api/admin/mei/calibration/industry').then(r=>r.json()).then(d=>d.calibration??[]), enabled:tab==='calibration' });
  const { data: roleCal=[] }= useQuery<RoleCal[]>({ queryKey:['mei-role-cal'], queryFn:()=>fetch('/api/admin/mei/calibration/role').then(r=>r.json()).then(d=>d.calibration??[]), enabled:tab==='calibration' });
  const { data: rules=[] }= useQuery<InsightRule[]>({ queryKey:['mei-rules'], queryFn:()=>fetch('/api/admin/mei/insight-rules').then(r=>r.json()).then(d=>d.rules??[]), enabled:tab==='insights' });
  const { data: recs=[] } = useQuery<Recommendation[]>({ queryKey:['mei-recs'], queryFn:()=>fetch('/api/admin/mei/recommendations').then(r=>r.json()).then(d=>d.recommendations??[]), enabled:tab==='insights' });
  const { data: scores }  = useQuery<ScoreOverview>({ queryKey:['mei-scores'], queryFn:()=>fetch('/api/admin/mei/scores').then(r=>r.json()), enabled:tab==='scores' });

  const patchDim = useMutation({
    mutationFn:({id,w}:{id:number;w:number})=>fetch(`/api/admin/mei/dimensions/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_weight:w})}).then(r=>r.json()),
    onSuccess:()=>qc.invalidateQueries({queryKey:['mei-dims']}),
  });
  const patchCal = useMutation({
    mutationFn:({type,id,multiplier}:{type:'industry'|'role';id:number;multiplier:number})=>
      fetch(`/api/admin/mei/calibration/${type}/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({multiplier})}).then(r=>r.json()),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['mei-ind-cal']}); qc.invalidateQueries({queryKey:['mei-role-cal']}); setEditingCal(null); },
  });
  const refreshBenchmark = useMutation({
    mutationFn:(b:Record<string,string|null>)=>fetch('/api/admin/mei/benchmark/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()),
  });

  // ── Insight rule mutations ─────────────────────────────────────────────────
  const createRule = useMutation({
    mutationFn:(body:Record<string,unknown>)=>fetch('/api/admin/mei/insight-rules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['mei-rules']}); setAddingRule(false); setEditingRule(null); },
  });
  const updateRule = useMutation({
    mutationFn:({id,...body}:{id:number;[k:string]:unknown})=>fetch(`/api/admin/mei/insight-rules/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['mei-rules']}); setEditingRule(null); },
  });
  const deleteRule = useMutation({
    mutationFn:(id:number)=>fetch(`/api/admin/mei/insight-rules/${id}`,{method:'DELETE'}).then(r=>r.json()),
    onSuccess:()=>qc.invalidateQueries({queryKey:['mei-rules']}),
  });

  // ── Recommendation mutations ──────────────────────────────────────────────
  const createRec = useMutation({
    mutationFn:(body:Record<string,unknown>)=>fetch('/api/admin/mei/recommendations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['mei-recs']}); setAddingRec(false); setEditingRec(null); },
  });
  const updateRec = useMutation({
    mutationFn:({id,...body}:{id:number;[k:string]:unknown})=>fetch(`/api/admin/mei/recommendations/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['mei-recs']}); setEditingRec(null); },
  });
  const deleteRec = useMutation({
    mutationFn:(id:number)=>fetch(`/api/admin/mei/recommendations/${id}`,{method:'DELETE'}).then(r=>r.json()),
    onSuccess:()=>qc.invalidateQueries({queryKey:['mei-recs']}),
  });

  function pct(v:string|number) { return `${(parseFloat(String(v))*100).toFixed(0)}%`; }
  function mult(v:string|number) { const n=parseFloat(String(v)); return n===1?'—':(n>1?`+${((n-1)*100).toFixed(0)}%`:`${((n-1)*100).toFixed(0)}%`); }
  function multColor(v:string|number) { const n=parseFloat(String(v)); return n>1.05?'text-green-600':n<0.95?'text-red-500':'text-gray-500'; }

  // ── Industry calibration matrix ───────────────────────────────────────────
  const industries = [...new Set(indCal.map(r=>r.industry_code))];
  const dimCodes   = dims.map(d=>d.code);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Employability Index v2</h2>
          <p className="text-sm text-gray-500 mt-0.5">5 dimensions · 15 subdimensions · 45 competencies · industry + role calibration</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={()=>refreshBenchmark.mutate({})} disabled={refreshBenchmark.isPending} className="gap-1">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshBenchmark.isPending?'animate-spin':''}`}/>Refresh Benchmarks
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['overview','taxonomy','calibration','insights','scores'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${tab===t?'border-indigo-600 text-indigo-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab==='overview' && (
        <div className="space-y-4">
          {/* Dimension cards */}
          <div className="grid grid-cols-5 gap-3">
            {dims.map(d=>(
              <div key={d.id} className="bg-white border rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {DIM_ICONS[d.code]}
                  <span className="text-sm font-semibold text-gray-800">{d.short_name}</span>
                </div>
                <div className="text-2xl font-bold" style={{color:d.color_hex}}>{d.max_points}pts</div>
                <div className="text-xs text-gray-500">{pct(d.base_weight)} base weight</div>
                <div className="h-1.5 bg-gray-100 rounded-full">
                  <div className="h-1.5 rounded-full" style={{width:`${parseFloat(d.base_weight)*100}%`,backgroundColor:d.color_hex}}/>
                </div>
              </div>
            ))}
          </div>

          {/* Band definitions */}
          <div className="bg-white border rounded-xl p-5">
            <div className="text-sm font-semibold text-gray-700 mb-3">Score Bands</div>
            <div className="grid grid-cols-4 gap-3">
              {[['75–99','Hire-Ready','hire_ready','Strong profile. Focus on visibility & interviews.'],
                ['50–74','Career-Ready','career_ready','Solid foundation. Close key gaps.'],
                ['25–49','Building','building','Profile taking shape. Add validated signal.'],
                ['0–24','Getting Started','getting_started','Add core inputs to unlock trajectory.']].map(([range,band,key,desc])=>(
                <div key={key} className={`rounded-lg p-3 ${BAND_COLORS[key]}`}>
                  <div className="text-lg font-bold">{range}</div>
                  <div className="text-sm font-medium">{band}</div>
                  <div className="text-xs mt-1 opacity-75">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Weight sum check */}
          <div className="bg-gray-50 border rounded-lg p-4 flex items-center gap-4">
            <div className="text-sm text-gray-500">Base weight sum:</div>
            <div className="font-mono text-sm font-bold text-gray-800">
              {dims.reduce((a,d)=>a+parseFloat(d.base_weight),0).toFixed(2)}
            </div>
            {Math.abs(dims.reduce((a,d)=>a+parseFloat(d.base_weight),0)-1.0) < 0.001
              ? <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5"/>Valid (sums to 1.0)</span>
              : <span className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5"/>Warning: does not sum to 1.0</span>}
          </div>
        </div>
      )}

      {/* ── Taxonomy ── */}
      {tab==='taxonomy' && (
        <div className="space-y-2">
          {dims.map(dim=>{
            const dimSDs = sds.filter(sd=>sd.dimension_code===dim.code);
            const open = expandedDim===dim.code;
            return (
              <div key={dim.id} className="bg-white border rounded-xl overflow-hidden">
                {/* Dimension header */}
                <button onClick={()=>setExpandedDim(open?null:dim.code)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                  {DIM_ICONS[dim.code]}
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-800">{dim.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{dim.description}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold" style={{color:dim.color_hex}}>{dim.max_points}pts · {pct(dim.base_weight)}</span>
                    <span className="text-xs text-gray-400">{dimSDs.length} subdimensions</span>
                    {open ? <ChevronDown className="h-4 w-4 text-gray-400"/> : <ChevronRight className="h-4 w-4 text-gray-400"/>}
                  </div>
                </button>

                {open && (
                  <div className="border-t bg-gray-50 divide-y">
                    {dimSDs.map(sd=>{
                      const sdComps = comps.filter(c=>c.subdimension_code===sd.code);
                      return (
                        <div key={sd.id} className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-gray-400"/>
                            <span className="text-sm font-medium text-gray-700">{sd.name}</span>
                            <span className="text-xs text-gray-400 ml-auto">{pct(sd.within_dim_weight)} of dimension</span>
                          </div>
                          <div className="text-xs text-gray-500 mb-3 ml-4">{sd.description}</div>
                          {/* Competencies */}
                          <div className="ml-4 space-y-1.5">
                            {sdComps.map(c=>(
                              <div key={c.id} className="flex items-start gap-2 bg-white rounded-lg p-2.5 border">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-700">{c.name}</span>
                                    {c.is_gated && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Gated: {c.gate_condition}</span>}
                                    <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded ml-auto">{c.formula_type}</span>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-0.5">{c.description}</div>
                                </div>
                                <div className="text-xs text-gray-400 whitespace-nowrap">{pct(c.within_sd_weight)} · max {c.max_raw}pts</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Calibration ── */}
      {tab==='calibration' && (
        <div className="space-y-6">
          {/* Industry calibration matrix */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Sliders className="h-4 w-4"/>Industry Calibration
              <span className="text-xs text-gray-400 font-normal">— multipliers applied to base dimension weights (re-normalised)</span>
            </div>
            <div className="bg-white border rounded-xl overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 w-36">Industry</th>
                    {dimCodes.map(dc=><th key={dc} className="px-3 py-2 text-center font-medium text-gray-500 capitalize">{dc.replace('_',' ')}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {industries.map(ind=>{
                    const indName = indCal.find(r=>r.industry_code===ind)?.industry_name ?? ind;
                    return (
                      <tr key={ind} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-700 text-xs">{indName}</td>
                        {dimCodes.map(dc=>{
                          const row = indCal.find(r=>r.industry_code===ind&&r.dimension_code===dc);
                          if (!row) return <td key={dc} className="px-3 py-2 text-center text-gray-300">—</td>;
                          const isEditing = editingCal?.type==='industry'&&editingCal?.id===row.id;
                          return (
                            <td key={dc} className="px-3 py-2 text-center">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <input type="number" step="0.05" min="0.3" max="2.5"
                                    value={editingCal.val}
                                    onChange={e=>setEditingCal({...editingCal,val:e.target.value})}
                                    className="w-16 border rounded px-1 py-0.5 text-xs"/>
                                  <button onClick={()=>patchCal.mutate({type:'industry',id:row.id,multiplier:parseFloat(editingCal.val)})} className="text-green-600 text-xs">✓</button>
                                  <button onClick={()=>setEditingCal(null)} className="text-gray-400 text-xs">✕</button>
                                </div>
                              ) : (
                                <button onClick={()=>setEditingCal({type:'industry',id:row.id,val:row.multiplier})}
                                  className={`font-mono font-medium text-xs hover:underline ${multColor(row.multiplier)}`}>
                                  {mult(row.multiplier)}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role calibration matrix */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Users className="h-4 w-4"/>Role Level Calibration
            </div>
            <div className="bg-white border rounded-xl overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Role Level</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">YoE Range</th>
                    {dimCodes.map(dc=><th key={dc} className="px-3 py-2 text-center font-medium text-gray-500 capitalize">{dc.replace('_',' ')}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...new Set(roleCal.map(r=>r.role_level_code))].map(lvl=>{
                    const lvlRow = roleCal.find(r=>r.role_level_code===lvl);
                    return (
                      <tr key={lvl} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-700 capitalize">{lvlRow?.role_level_name ?? lvl}</td>
                        <td className="px-3 py-2 text-gray-400">{lvlRow?.yoe_min ?? '?'}–{lvlRow?.yoe_max ?? '∞'} yr</td>
                        {dimCodes.map(dc=>{
                          const row = roleCal.find(r=>r.role_level_code===lvl&&r.dimension_code===dc);
                          if (!row) return <td key={dc} className="px-3 py-2 text-center text-gray-300">—</td>;
                          const isEditing = editingCal?.type==='role'&&editingCal?.id===row.id;
                          return (
                            <td key={dc} className="px-3 py-2 text-center">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <input type="number" step="0.05" min="0.3" max="2.5"
                                    value={editingCal.val}
                                    onChange={e=>setEditingCal({...editingCal,val:e.target.value})}
                                    className="w-16 border rounded px-1 py-0.5 text-xs"/>
                                  <button onClick={()=>patchCal.mutate({type:'role',id:row.id,multiplier:parseFloat(editingCal.val)})} className="text-green-600 text-xs">✓</button>
                                  <button onClick={()=>setEditingCal(null)} className="text-gray-400 text-xs">✕</button>
                                </div>
                              ) : (
                                <button onClick={()=>setEditingCal({type:'role',id:row.id,val:row.multiplier})}
                                  className={`font-mono font-medium text-xs hover:underline ${multColor(row.multiplier)}`}>
                                  {mult(row.multiplier)}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Insights & Recommendations ── */}
      {tab==='insights' && (
        <div className="space-y-6">

          {/* ── Insight Rules section ──────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">Narrative Rules</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{rules.length}</span>
                {/* Filter by audience */}
                <select
                  value={ruleFilter}
                  onChange={e=>setRuleFilter(e.target.value)}
                  className="text-xs border rounded px-2 py-1 text-gray-600"
                >
                  {['all','candidate','counselor','employer'].map(v=>(
                    <option key={v} value={v}>{v==='all'?'All audiences':v}</option>
                  ))}
                </select>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                onClick={()=>{ setEditingRule({...BLANK_RULE}); setAddingRule(true); }}>
                <Plus className="h-3.5 w-3.5"/>Add Rule
              </Button>
            </div>

            {/* Add / Edit Rule Form */}
            {editingRule && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-3 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-indigo-700">{addingRule?'New Rule':'Edit Rule'}</span>
                  <button onClick={()=>{ setEditingRule(null); setAddingRule(false); }}><X className="h-4 w-4 text-gray-400"/></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Rule Type</label>
                    <select value={editingRule.rule_type}
                      onChange={e=>setEditingRule({...editingRule,rule_type:e.target.value})}
                      className="w-full text-xs border rounded px-2 py-1.5">
                      {['band','dimension_strength','dimension_gap','composite_insight'].map(v=><option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Audience</label>
                    <select value={editingRule.audience}
                      onChange={e=>setEditingRule({...editingRule,audience:e.target.value})}
                      className="w-full text-xs border rounded px-2 py-1.5">
                      {['candidate','counselor','employer'].map(v=><option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Trigger Field</label>
                    <input value={editingRule.trigger_field}
                      onChange={e=>setEditingRule({...editingRule,trigger_field:e.target.value})}
                      placeholder="e.g. band, validated_proficiency"
                      className="w-full text-xs border rounded px-2 py-1.5"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Operator</label>
                    <select value={editingRule.trigger_operator}
                      onChange={e=>setEditingRule({...editingRule,trigger_operator:e.target.value})}
                      className="w-full text-xs border rounded px-2 py-1.5">
                      {['eq','gte','lte','between','any'].map(v=><option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Trigger Value (JSON or number)</label>
                    <input value={editingRule.trigger_value}
                      onChange={e=>setEditingRule({...editingRule,trigger_value:e.target.value})}
                      placeholder='e.g. "hire_ready" or 70'
                      className="w-full text-xs border rounded px-2 py-1.5 font-mono"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Tone</label>
                    <select value={editingRule.tone}
                      onChange={e=>setEditingRule({...editingRule,tone:e.target.value})}
                      className="w-full text-xs border rounded px-2 py-1.5">
                      {['direct','motivational','supportive'].map(v=><option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Priority</label>
                    <input type="number" value={editingRule.priority}
                      onChange={e=>setEditingRule({...editingRule,priority:parseInt(e.target.value)||50})}
                      className="w-full text-xs border rounded px-2 py-1.5"/>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Narrative Template (use {'{{'}score{'}}'}, {'{{'}band{'}}'}, {'{{'}dim_score{'}}'} etc.)</label>
                  <textarea value={editingRule.narrative_template}
                    onChange={e=>setEditingRule({...editingRule,narrative_template:e.target.value})}
                    rows={3} placeholder="Your score of {{score}}..."
                    className="w-full text-xs border rounded px-2 py-1.5 font-mono resize-none"/>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" className="text-xs" onClick={()=>{ setEditingRule(null); setAddingRule(false); }}>Cancel</Button>
                  <Button size="sm" className="text-xs gap-1.5"
                    disabled={createRule.isPending||updateRule.isPending}
                    onClick={()=>{
                      const body = {
                        rule_type:editingRule.rule_type, trigger_field:editingRule.trigger_field,
                        trigger_operator:editingRule.trigger_operator,
                        trigger_value: editingRule.trigger_value === '' ? null : (() => { try { return JSON.parse(editingRule.trigger_value); } catch { return editingRule.trigger_value; } })(),
                        narrative_template:editingRule.narrative_template,
                        tone:editingRule.tone, audience:editingRule.audience, priority:editingRule.priority,
                      };
                      if (addingRule) createRule.mutate(body);
                      else if (editingRule.id) updateRule.mutate({id:editingRule.id,...body});
                    }}>
                    <Save className="h-3.5 w-3.5"/>{addingRule?'Create':'Save'}
                  </Button>
                </div>
              </div>
            )}

            {/* Rules list */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {rules
                .filter(r=>ruleFilter==='all'||r.audience===ruleFilter)
                .map(r=>(
                <div key={r.id} className="bg-white border rounded-lg p-3 hover:border-gray-300 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      r.rule_type==='band'?'bg-indigo-100 text-indigo-700':
                      r.rule_type==='dimension_strength'?'bg-green-100 text-green-700':
                      r.rule_type==='dimension_gap'?'bg-red-100 text-red-600':
                      'bg-gray-100 text-gray-500'}`}>{r.rule_type}</span>
                    <span className="text-xs font-mono text-gray-500 flex-1 truncate">{r.trigger_field} {r.trigger_operator} {JSON.stringify(r.trigger_value)}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      r.audience==='candidate'?'bg-blue-50 text-blue-600':
                      r.audience==='counselor'?'bg-purple-50 text-purple-600':
                      'bg-orange-50 text-orange-600'}`}>{r.audience}</span>
                    <span className="text-xs text-gray-400">p{r.priority}</span>
                    <button
                      onClick={()=>{ setEditingRule({id:r.id,rule_type:r.rule_type,trigger_field:r.trigger_field,trigger_operator:r.trigger_operator,trigger_value:JSON.stringify(r.trigger_value??''),narrative_template:r.narrative_template,tone:r.tone,audience:r.audience,priority:r.priority}); setAddingRule(false); }}
                      className="text-gray-300 hover:text-indigo-500 transition-colors">
                      <Pencil className="h-3.5 w-3.5"/>
                    </button>
                    <button
                      onClick={()=>{ if (confirm('Soft-delete this rule?')) deleteRule.mutate(r.id); }}
                      className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5"/>
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2 italic">"{r.narrative_template}"</p>
                </div>
              ))}
              {rules.length===0 && <div className="text-xs text-gray-400 text-center py-6">No rules seeded yet. Run the migration first.</div>}
            </div>
          </div>

          {/* ── Recommendation Master section ─────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">Recommendation Master</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{recs.length}</span>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                onClick={()=>{ setEditingRec({...BLANK_REC}); setAddingRec(true); }}>
                <Plus className="h-3.5 w-3.5"/>Add Recommendation
              </Button>
            </div>

            {/* Add / Edit Rec Form */}
            {editingRec && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-green-700">{addingRec?'New Recommendation':'Edit Recommendation'}</span>
                  <button onClick={()=>{ setEditingRec(null); setAddingRec(false); }}><X className="h-4 w-4 text-gray-400"/></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Code (unique)</label>
                    <input value={editingRec.code}
                      onChange={e=>setEditingRec({...editingRec,code:e.target.value})}
                      placeholder="e.g. take_capadex"
                      className="w-full text-xs border rounded px-2 py-1.5 font-mono"
                      disabled={!addingRec}/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Title</label>
                    <input value={editingRec.title}
                      onChange={e=>setEditingRec({...editingRec,title:e.target.value})}
                      placeholder="Short action title"
                      className="w-full text-xs border rounded px-2 py-1.5"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Action Type</label>
                    <select value={editingRec.action_type}
                      onChange={e=>setEditingRec({...editingRec,action_type:e.target.value})}
                      className="w-full text-xs border rounded px-2 py-1.5">
                      {['capadex','take_assessment','add_skills','get_cert','complete_profile','add_projects','add_experience','update_profile'].map(v=><option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Effort Level</label>
                    <select value={editingRec.effort_level}
                      onChange={e=>setEditingRec({...editingRec,effort_level:e.target.value})}
                      className="w-full text-xs border rounded px-2 py-1.5">
                      {['low','medium','high'].map(v=><option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Est. Point Gain</label>
                    <input type="number" step="0.5" value={editingRec.estimated_point_gain}
                      onChange={e=>setEditingRec({...editingRec,estimated_point_gain:e.target.value})}
                      placeholder="e.g. 12"
                      className="w-full text-xs border rounded px-2 py-1.5"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Time to Complete</label>
                    <input value={editingRec.time_to_complete}
                      onChange={e=>setEditingRec({...editingRec,time_to_complete:e.target.value})}
                      placeholder="e.g. 35 minutes"
                      className="w-full text-xs border rounded px-2 py-1.5"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Deep Link Path</label>
                    <input value={editingRec.link_path}
                      onChange={e=>setEditingRec({...editingRec,link_path:e.target.value})}
                      placeholder="/career-builder?tab=..."
                      className="w-full text-xs border rounded px-2 py-1.5"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-0.5 block">Display Order</label>
                    <input type="number" value={editingRec.display_order}
                      onChange={e=>setEditingRec({...editingRec,display_order:parseInt(e.target.value)||99})}
                      className="w-full text-xs border rounded px-2 py-1.5"/>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Description</label>
                  <textarea value={editingRec.description}
                    onChange={e=>setEditingRec({...editingRec,description:e.target.value})}
                    rows={3} placeholder="Explanation + expected outcome..."
                    className="w-full text-xs border rounded px-2 py-1.5 resize-none"/>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" className="text-xs" onClick={()=>{ setEditingRec(null); setAddingRec(false); }}>Cancel</Button>
                  <Button size="sm" className="text-xs gap-1.5"
                    disabled={createRec.isPending||updateRec.isPending}
                    onClick={()=>{
                      const body = {
                        code:editingRec.code, title:editingRec.title, description:editingRec.description,
                        action_type:editingRec.action_type,
                        estimated_point_gain: editingRec.estimated_point_gain ? parseFloat(editingRec.estimated_point_gain) : null,
                        effort_level:editingRec.effort_level,
                        time_to_complete:editingRec.time_to_complete||null,
                        link_path:editingRec.link_path||null,
                        display_order:editingRec.display_order,
                      };
                      if (addingRec) createRec.mutate(body);
                      else if (editingRec.id) updateRec.mutate({id:editingRec.id,...body});
                    }}>
                    <Save className="h-3.5 w-3.5"/>{addingRec?'Create':'Save'}
                  </Button>
                </div>
              </div>
            )}

            {/* Recs list */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {recs.map(r=>(
                <div key={r.id} className="bg-white border rounded-lg p-3 hover:border-gray-300 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-800 flex-1">{r.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      r.effort_level==='low'?'bg-green-100 text-green-600':
                      r.effort_level==='medium'?'bg-yellow-100 text-yellow-600':
                      'bg-red-100 text-red-500'}`}>{r.effort_level}</span>
                    {r.estimated_point_gain && <span className="text-xs font-bold text-green-600">+{r.estimated_point_gain}</span>}
                    <button
                      onClick={()=>{ setEditingRec({id:r.id,code:r.code,title:r.title,description:r.description,action_type:r.action_type,estimated_point_gain:r.estimated_point_gain??'',effort_level:r.effort_level,time_to_complete:r.time_to_complete??'',link_path:'',display_order:99}); setAddingRec(false); }}
                      className="text-gray-300 hover:text-indigo-500 transition-colors">
                      <Pencil className="h-3.5 w-3.5"/>
                    </button>
                    <button
                      onClick={()=>{ if (confirm('Soft-delete this recommendation?')) deleteRec.mutate(r.id); }}
                      className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5"/>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{r.description}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {r.time_to_complete && <span className="text-xs text-gray-400">{r.time_to_complete}</span>}
                    {r.dimension_name   && <span className="text-xs text-gray-400">→ {r.dimension_name}</span>}
                    <span className="text-xs text-gray-300 font-mono ml-auto">{r.code}</span>
                  </div>
                </div>
              ))}
              {recs.length===0 && <div className="text-xs text-gray-400 text-center py-6">No recommendations seeded yet. Run the migration first.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── Scores ── */}
      {tab==='scores' && scores && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label:'Scored Users',  value: scores.overview.total_scored.toLocaleString(), color:'bg-indigo-50 text-indigo-600' },
              { label:'Avg Score',     value: scores.overview.avg_score ?? '—', color:'bg-blue-50 text-blue-600' },
              { label:'Min Score',     value: scores.overview.min_score ?? '—', color:'bg-yellow-50 text-yellow-600' },
              { label:'Max Score',     value: scores.overview.max_score ?? '—', color:'bg-green-50 text-green-600' },
            ].map(s=>(
              <div key={s.label} className={`rounded-xl p-4 ${s.color.split(' ')[0]}`}>
                <div className={`text-2xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Band distribution */}
          <div className="bg-white border rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4"/>Band Distribution</div>
            <div className="grid grid-cols-4 gap-3">
              {scores.band_distribution.map(b=>(
                <div key={b.band} className={`rounded-lg p-3 text-center ${BAND_COLORS[b.band]}`}>
                  <div className="text-2xl font-bold">{b.count}</div>
                  <div className="text-xs mt-0.5 capitalize">{b.band.replace('_',' ')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent scores */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4"/>Recent Scores
            </div>
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50"><tr>{['User','Score','Band','Computed'].map((h,i)=>
                <th key={i} className="px-4 py-2 text-left text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {scores.recent_scores.map(s=>(
                  <tr key={s.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs font-mono text-gray-500">{s.user_id.slice(0,16)}…</td>
                    <td className="px-4 py-2 text-sm font-bold text-gray-800">{s.composite_score}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${BAND_COLORS[s.band]}`}>{s.band.replace('_',' ')}</span></td>
                    <td className="px-4 py-2 text-xs text-gray-400">{new Date(s.computed_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {scores.recent_scores.length===0&&<tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400">No scores computed yet. Use /api/mei/score/:userId to compute.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
