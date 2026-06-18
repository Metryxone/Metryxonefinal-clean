import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, BarChart3, AlertTriangle, CheckCircle, Archive, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const QF_COLORS: Record<string,string> = { good:'bg-green-100 text-green-700', review:'bg-yellow-100 text-yellow-700', retire:'bg-red-100 text-red-600' };
const QF_ICONS: Record<string,React.ReactNode> = { good:<CheckCircle className="h-3.5 w-3.5"/>, review:<AlertTriangle className="h-3.5 w-3.5"/>, retire:<Archive className="h-3.5 w-3.5"/> };

type ItemStat = { id:number; question_id:number; assessment_id?:number; code:string; stem:string; assessment_type:string; domain?:string; difficulty_tier:string; sample_size:number; p_value?:number; point_biserial?:number; skip_rate?:number; revision_rate?:number; mean_time_secs?:number; quality_flag:string; last_computed_at:string; };
type Psychometric = { id:number; calibration_code:string; assessment_title?:string; assessment_type?:string; calibration_type:string; sample_size:number; calibration_date:string; reliability_alpha?:number; sem?:number; theta_range?:{mean:number;sd:number;min:number;max:number}; is_current:boolean; };
type Overview = { assessments:{assessment_type:string;status:string;count:string}[]; sessions:{status:string;count:string}[]; questions:{assessment_type:string;status:string;count:string}[]; item_quality:{quality_flag:string;count:string}[]; };
type Assessment = { id:number; code:string; title:string; assessment_type:string; };

export default function CAFAnalyticsPanel() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview'|'items'|'psychometric'>('overview');
  const [qfFilter, setQfFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedAsmId, setSelectedAsmId] = useState<number|null>(null);
  const [computeMsg, setComputeMsg] = useState('');

  const { data: overview } = useQuery<Overview>({ queryKey:['caf-analytics-overview'], queryFn:()=>fetch('/api/caf/analytics/overview').then(r=>r.json()) });
  const { data: items=[], isLoading: itemsLoading } = useQuery<ItemStat[]>({
    queryKey:['caf-item-stats', qfFilter, typeFilter],
    queryFn:()=>fetch(`/api/caf/analytics/items?quality_flag=${qfFilter}&type=${typeFilter}&min_sample=0&limit=200`).then(r=>r.json()).then(d=>d.items??[]),
    enabled:activeTab==='items',
  });
  const { data: calibrations=[] } = useQuery<Psychometric[]>({
    queryKey:['caf-psychometric'],
    queryFn:()=>fetch('/api/caf/analytics/psychometric').then(r=>r.json()),
    enabled:activeTab==='psychometric',
  });
  const { data: assessments=[] } = useQuery<Assessment[]>({
    queryKey:['caf-assessments-all'],
    queryFn:()=>fetch('/api/caf/assessments?limit=200').then(r=>r.json()).then(d=>d.assessments??[]),
  });

  const compute = useMutation({
    mutationFn:(b:Record<string,unknown>)=>fetch('/api/caf/analytics/items/compute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json()),
    onSuccess:(d)=>{ qc.invalidateQueries({queryKey:['caf-item-stats']}); qc.invalidateQueries({queryKey:['caf-analytics-overview']}); setComputeMsg(`Computed stats for ${d.computed} items`); setTimeout(()=>setComputeMsg(''),3000); },
  });

  const calibrate = useMutation({
    mutationFn:(aid:number)=>fetch('/api/caf/analytics/psychometric/calibrate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({assessment_id:aid,calibration_type:'ctt'})}).then(r=>r.json()),
    onSuccess:()=>qc.invalidateQueries({queryKey:['caf-psychometric']}),
  });

  const updateFlag = useMutation({
    mutationFn:({id,flag}:{id:number,flag:string})=>fetch(`/api/caf/analytics/items/${id}/flag`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({quality_flag:flag})}).then(r=>r.json()),
    onSuccess:()=>qc.invalidateQueries({queryKey:['caf-item-stats']}),
  });

  // Aggregate helpers
  const totalSessions = (overview?.sessions??[]).reduce((acc,s)=>acc+parseInt(s.count),0);
  const completedSessions = (overview?.sessions??[]).find(s=>s.status==='completed');
  const itemQuality = Object.fromEntries((overview?.item_quality??[]).map(q=>[q.quality_flag,parseInt(q.count)]));

  function fmtPct(v?:number|null) { return v!=null ? `${(v*100).toFixed(1)}%` : '—'; }
  function fmtNum(v?:number|null,dp=2) { return v!=null ? v.toFixed(dp) : '—'; }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Item analysis, psychometric calibration, and platform overview</p>
        </div>
        <div className="flex gap-2">
          {computeMsg && <span className="text-sm text-green-600 font-medium flex items-center gap-1"><CheckCircle className="h-4 w-4"/>{computeMsg}</span>}
          <Button size="sm" variant="outline" onClick={()=>compute.mutate({})} disabled={compute.isPending} className="gap-1">
            <RefreshCw className={`h-4 w-4 ${compute.isPending?'animate-spin':''}`}/>Recompute All Stats
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        {(['overview','items','psychometric'] as const).map(t=>(
          <button key={t} onClick={()=>setActiveTab(t)}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab===t?'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab==='overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label:'Total Sessions', value:totalSessions.toLocaleString(), icon:<BarChart3 className="h-5 w-5 text-blue-600"/>, bg:'bg-blue-50' },
              { label:'Completed', value:(completedSessions?.count??'0'), icon:<CheckCircle className="h-5 w-5 text-green-600"/>, bg:'bg-green-50' },
              { label:'Items Flagged (review)', value:(itemQuality['review']??0).toLocaleString(), icon:<AlertTriangle className="h-5 w-5 text-yellow-500"/>, bg:'bg-yellow-50' },
              { label:'Items for Retirement', value:(itemQuality['retire']??0).toLocaleString(), icon:<Archive className="h-5 w-5 text-red-500"/>, bg:'bg-red-50' },
            ].map(s=>(
              <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3`}>
                {s.icon}
                <div>
                  <div className="text-2xl font-bold text-gray-800">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Questions by type/status */}
            <div className="bg-white border rounded-lg p-4">
              <div className="font-semibold text-gray-700 mb-3 text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4"/>Questions by Type</div>
              {Object.entries(
                (overview?.questions??[]).reduce((acc,q)=>{ const t=q.assessment_type.replace('_',' '); acc[t]=(acc[t]??0)+parseInt(q.count); return acc; },{} as Record<string,number>)
              ).map(([type,count])=>(
                <div key={type} className="flex items-center gap-2 mb-2">
                  <div className="text-xs text-gray-600 w-32 truncate capitalize">{type}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-400 h-2 rounded-full" style={{width:`${Math.min(100,(count/Math.max(1,overview?.questions?.reduce((a,q)=>a+parseInt(q.count),0)??1))*100)}%`}}/>
                  </div>
                  <div className="text-xs text-gray-500 w-10 text-right">{count}</div>
                </div>
              ))}
              {!overview?.questions?.length && <p className="text-xs text-gray-400">No data</p>}
            </div>

            {/* Assessments by status */}
            <div className="bg-white border rounded-lg p-4">
              <div className="font-semibold text-gray-700 mb-3 text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4"/>Assessments by Status</div>
              {Object.entries(
                (overview?.assessments??[]).reduce((acc,a)=>{ acc[a.status]=(acc[a.status]??0)+parseInt(a.count); return acc; },{} as Record<string,number>)
              ).map(([status,count])=>(
                <div key={status} className="flex items-center gap-2 mb-2">
                  <div className="text-xs capitalize w-20">{status}</div>
                  <div className={`text-xs px-2 py-0.5 rounded ${status==='published'?'bg-green-100 text-green-700':status==='draft'?'bg-gray-100 text-gray-500':'bg-yellow-100 text-yellow-700'}`}>{count}</div>
                </div>
              ))}
              {!overview?.assessments?.length && <p className="text-xs text-gray-400">No data</p>}
            </div>
          </div>

          {/* Item quality distribution */}
          <div className="bg-white border rounded-lg p-4">
            <div className="font-semibold text-gray-700 mb-3 text-sm">Item Quality Distribution</div>
            <div className="grid grid-cols-3 gap-4">
              {[['good','Good — no issues detected'],['review','Review — one quality concern'],['retire','Retire — multiple concerns']].map(([flag,desc])=>(
                <div key={flag} className={`rounded-lg p-4 text-center ${QF_COLORS[flag]}`}>
                  <div className="flex justify-center mb-1">{QF_ICONS[flag]}</div>
                  <div className="text-2xl font-bold">{(itemQuality[flag]??0).toLocaleString()}</div>
                  <div className="text-xs mt-0.5 opacity-80">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Item Analysis ── */}
      {activeTab==='items' && (
        <div className="space-y-3">
          <div className="flex gap-3 bg-gray-50 rounded-lg p-3">
            <select value={qfFilter} onChange={e=>setQfFilter(e.target.value)} className="h-8 text-sm border rounded px-2 bg-white">
              <option value="all">All Quality Flags</option>
              <option value="good">Good</option>
              <option value="review">Needs Review</option>
              <option value="retire">Retire</option>
            </select>
            <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="h-8 text-sm border rounded px-2 bg-white">
              <option value="all">All Types</option>
              {['behavioral','functional','cognitive','leadership','future_readiness'].map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
            </select>
            <div className="flex items-center gap-2 ml-auto">
              <select value={selectedAsmId??''} onChange={e=>{const id=parseInt(e.target.value);setSelectedAsmId(isNaN(id)?null:id);}} className="h-8 text-sm border rounded px-2 bg-white">
                <option value="">Compute for all approved…</option>
                {assessments.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
              <Button size="sm" onClick={()=>compute.mutate(selectedAsmId?{assessment_id:selectedAsmId}:{})} disabled={compute.isPending} className="gap-1"><RefreshCw className={`h-3.5 w-3.5 ${compute.isPending?'animate-spin':''}`}/>Compute</Button>
            </div>
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Code','Stem','Type','Difficulty','N','p-value','Rpbis','Skip%','Time(s)','Flag',''].map((h,i)=>(
                  <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y">
                {itemsLoading ? <tr><td colSpan={11} className="py-12 text-center text-gray-400">Loading…</td></tr>
                : items.length===0 ? <tr><td colSpan={11} className="py-12 text-center text-gray-400">No item stats — click Compute to generate</td></tr>
                : items.map(item=>(
                  <tr key={item.id} className={`hover:bg-gray-50 ${item.quality_flag==='retire'?'bg-red-50/30':''}`}>
                    <td className="px-3 py-2 font-mono text-xs text-blue-700">{item.code}</td>
                    <td className="px-3 py-2 max-w-xs"><span className="text-xs text-gray-700 line-clamp-2">{item.stem}</span></td>
                    <td className="px-3 py-2 text-xs text-gray-500">{item.assessment_type.replace('_',' ')}</td>
                    <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${item.difficulty_tier==='hard'?'bg-red-100 text-red-600':item.difficulty_tier==='easy'?'bg-green-100 text-green-600':'bg-yellow-100 text-yellow-700'}`}>{item.difficulty_tier}</span></td>
                    <td className="px-3 py-2 text-xs text-gray-500">{item.sample_size}</td>
                    <td className="px-3 py-2 text-xs font-mono">
                      <span className={item.p_value!=null&&(item.p_value<0.15||item.p_value>0.85)?'text-red-500':''}>
                        {fmtNum(item.p_value,3)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">
                      <span className={item.point_biserial!=null&&item.point_biserial<0.15?'text-red-500':''}>
                        {fmtNum(item.point_biserial,3)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">
                      <span className={item.skip_rate!=null&&item.skip_rate>0.20?'text-orange-500':''}>
                        {fmtPct(item.skip_rate)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{fmtNum(item.mean_time_secs,0)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-fit ${QF_COLORS[item.quality_flag]}`}>
                        {QF_ICONS[item.quality_flag]}{item.quality_flag}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <select value={item.quality_flag} onChange={e=>updateFlag.mutate({id:item.question_id,flag:e.target.value})} className="h-6 text-xs border rounded px-1">
                        <option value="good">good</option>
                        <option value="review">review</option>
                        <option value="retire">retire</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-gray-400 px-1">
            Thresholds: p-value outside [0.15–0.85] → concern · Rpbis &lt; 0.15 → concern · Skip rate &gt; 20% → concern · 2+ concerns → retire
          </div>
        </div>
      )}

      {/* ── Psychometric Calibrations ── */}
      {activeTab==='psychometric' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={selectedAsmId??''} onChange={e=>{const id=parseInt(e.target.value);setSelectedAsmId(isNaN(id)?null:id);}} className="h-9 text-sm border rounded px-3 flex-1">
              <option value="">— Select assessment to calibrate —</option>
              {assessments.filter(a=>a['status' as keyof typeof a]==='published').map(a=><option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
            {selectedAsmId && (
              <Button size="sm" onClick={()=>calibrate.mutate(selectedAsmId)} disabled={calibrate.isPending} className="gap-1">
                <RefreshCw className={`h-3.5 w-3.5 ${calibrate.isPending?'animate-spin':''}`}/>Run Calibration
              </Button>
            )}
          </div>
          {calibrate.error && <p className="text-xs text-red-600">{String((calibrate.error as Error).message)}</p>}
          {(calibrate.data as Record<string,unknown>)?.error && <p className="text-xs text-red-600">{String((calibrate.data as Record<string,unknown>).error)}</p>}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            Minimum 30 completed sessions required. Classical Test Theory (CTT) calibration computes reliability α, SEM, and θ range from existing scores.
          </div>

          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Code','Assessment','Type','N','Date','α (Reliability)','SEM','θ Mean','θ SD','Current',''].map((h,i)=>(
                  <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y">
                {calibrations.length===0 ? <tr><td colSpan={11} className="py-10 text-center text-xs text-gray-400">No calibrations yet. Run calibration on a published assessment with ≥30 sessions.</td></tr>
                : calibrations.map(c=>(
                  <tr key={c.id} className={`hover:bg-gray-50 ${c.is_current?'bg-green-50/30':''}`}>
                    <td className="px-3 py-2 font-mono text-xs text-blue-700">{c.calibration_code}</td>
                    <td className="px-3 py-2 text-xs font-medium text-gray-800 max-w-32 truncate">{c.assessment_title||'—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{c.calibration_type.toUpperCase()}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{c.sample_size.toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{c.calibration_date}</td>
                    <td className="px-3 py-2 text-xs font-mono">
                      <span className={c.reliability_alpha!=null&&c.reliability_alpha<0.70?'text-orange-500':'text-gray-700'}>
                        {c.reliability_alpha!=null?c.reliability_alpha.toFixed(3):'—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-500">{c.sem!=null?c.sem.toFixed(2):'—'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-500">{c.theta_range?.mean!=null?c.theta_range.mean.toFixed(1):'—'}</td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-500">{c.theta_range?.sd!=null?c.theta_range.sd.toFixed(1):'—'}</td>
                    <td className="px-3 py-2">{c.is_current && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Current</span>}</td>
                    <td className="px-3 py-2"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-gray-400">α ≥ 0.80 = excellent · α 0.70–0.79 = acceptable · α &lt; 0.70 = poor (shown in orange)</div>
        </div>
      )}
    </div>
  );
}
