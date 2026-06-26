import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronDown, ChevronRight, Clock, CheckCircle, XCircle, PauseCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';

const STATUS_COLORS: Record<string,string> = {
  started:'bg-blue-100 text-blue-700', in_progress:'bg-yellow-100 text-yellow-700',
  paused:'bg-orange-100 text-orange-700', completed:'bg-green-100 text-green-700',
  abandoned:'bg-gray-100 text-gray-500', timed_out:'bg-red-100 text-red-600',
};
const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed:<CheckCircle className="h-3.5 w-3.5 text-green-600"/>,
  abandoned:<XCircle className="h-3.5 w-3.5 text-gray-400"/>,
  paused:<PauseCircle className="h-3.5 w-3.5 text-orange-500"/>,
  timed_out:<XCircle className="h-3.5 w-3.5 text-red-500"/>,
  in_progress:<Clock className="h-3.5 w-3.5 text-yellow-500"/>,
  started:<Clock className="h-3.5 w-3.5 text-blue-500"/>,
};

type Session = { id:string; assessment_id?:number; assessment_title?:string; assessment_type?:string; user_id:string; user_email?:string; status:string; attempt_number:number; started_at:string; completed_at?:string; time_elapsed_secs:number; response_count?:string; overall_band?:string; overall_scaled?:number; };

function fmtDuration(secs:number) {
  const m = Math.floor(secs/60); const s = secs%60;
  return m>0?`${m}m ${s}s`:`${s}s`;
}

function fmtDate(iso?:string) {
  if(!iso) return '—';
  return new Date(iso).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}

export default function CAFSessionsPanel() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string|null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey:['caf-sessions', statusFilter, page],
    queryFn:()=>fetch(`/api/caf/sessions?status=${statusFilter}&page=${page}&limit=50`).then(r=>{ if(!r.ok) throw new Error('Failed to load'); return r.json(); }),
  });

  const { data: responses=[] } = useQuery({
    queryKey:['caf-session-responses', expanded],
    queryFn:()=>expanded ? fetch(`/api/caf/sessions/${expanded}/responses`).then(r=>r.json()).then(d=>Array.isArray(d)?d:[]) : Promise.resolve([]),
    enabled:expanded!==null,
  });

  const { data: score } = useQuery({
    queryKey:['caf-session-score', expanded],
    queryFn:()=>expanded ? fetch(`/api/caf/sessions/${expanded}/score`).then(r=>r.json()) : Promise.resolve(null),
    enabled:expanded!==null,
  });

  let sessions: Session[] = data?.sessions ?? [];
  const total = data?.total ?? 0;

  if(search.trim()) {
    sessions = sessions.filter(s=>s.user_email?.toLowerCase().includes(search.toLowerCase()) || s.user_id.toLowerCase().includes(search.toLowerCase()) || s.assessment_title?.toLowerCase().includes(search.toLowerCase()));
  }

  const stats = {
    completed: sessions.filter(s=>s.status==='completed').length,
    in_progress: sessions.filter(s=>s.status==='in_progress'||s.status==='started').length,
    abandoned: sessions.filter(s=>s.status==='abandoned'||s.status==='timed_out').length,
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Sessions</h2>
        <p className="text-sm text-gray-500 mt-0.5">Live and historical assessment sessions — {total.toLocaleString()} total</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {label:'Completed', value:stats.completed, color:'text-green-700', bg:'bg-green-50'},
          {label:'In Progress', value:stats.in_progress, color:'text-yellow-700', bg:'bg-yellow-50'},
          {label:'Abandoned / Timed Out', value:stats.abandoned, color:'text-red-600', bg:'bg-red-50'},
        ].map(s=>(
          <div key={s.label} className={`${s.bg} rounded-lg p-4 text-center`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 bg-gray-50 rounded-lg p-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"/>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter by user or assessment…" className="pl-9 h-8 text-sm"/>
        </div>
        <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);}} className="h-8 text-sm border rounded px-2 bg-white">
          <option value="all">All Statuses</option>
          {['started','in_progress','paused','completed','abandoned','timed_out'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['','User','Assessment','Status','Attempt','Responses','Band','Started','Duration',''].map((h,i)=>(
              <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? <tr><td colSpan={10} className="py-12 text-center text-gray-400">Loading…</td></tr>
            : isError ? <tr><td colSpan={10} className="py-12 text-center text-gray-500">Couldn't load sessions. <button onClick={()=>refetch()} className="underline font-medium">Retry</button></td></tr>
            : sessions.length===0 ? <tr><td colSpan={10} className="py-12 text-center text-gray-400">No sessions found</td></tr>
            : sessions.map(s=>(
              <>
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <button onClick={()=>setExpanded(expanded===s.id?null:s.id)} className="text-gray-400 hover:text-gray-600">
                      {expanded===s.id?<ChevronDown className="h-3.5 w-3.5"/>:<ChevronRight className="h-3.5 w-3.5"/>}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-xs font-medium text-gray-800 truncate max-w-32">{s.user_email||s.user_id}</div>
                  </td>
                  <td className="px-3 py-2 max-w-xs">
                    <div className="text-xs text-gray-700 truncate">{s.assessment_title||'—'}</div>
                    {s.assessment_type && <div className="text-[10px] text-gray-400">{s.assessment_type.replace('_',' ')}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {STATUS_ICONS[s.status]||null}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[s.status]}`}>{s.status.replace('_',' ')}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">#{s.attempt_number}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{s.response_count||0}</td>
                  <td className="px-3 py-2">
                    {s.overall_band ? (
                      <div>
                        <span className="text-xs font-medium text-gray-800">{s.overall_band}</span>
                        {s.overall_scaled!=null && <div className="text-[10px] text-gray-400">{Math.round(s.overall_scaled)}%</div>}
                      </div>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(s.started_at)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{fmtDuration(s.time_elapsed_secs)}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-[10px] text-gray-300 truncate max-w-20 block">{s.id.substring(0,8)}…</span>
                  </td>
                </tr>
                {expanded===s.id && (
                  <tr key={`${s.id}-exp`}>
                    <td colSpan={10} className="bg-blue-50/30 px-6 py-4">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Score summary */}
                        <div>
                          <div className="text-xs font-semibold text-gray-600 mb-2">Score Summary</div>
                          {score && !score.error ? (
                            <div className="bg-white rounded-lg border p-3 space-y-1 text-xs">
                              <div className="flex justify-between"><span className="text-gray-500">Raw Score</span><span className="font-medium">{score.overall_raw??'—'}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Scaled (%)</span><span className="font-medium">{score.overall_scaled!=null?`${Math.round(score.overall_scaled)}%`:'—'}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Band</span><span className="font-medium text-blue-700">{score.overall_band??'—'}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Scored at</span><span className="text-gray-400">{fmtDate(score.scored_at)}</span></div>
                            </div>
                          ) : <p className="text-xs text-gray-400">No score computed</p>}
                        </div>
                        {/* Responses */}
                        <div>
                          <div className="text-xs font-semibold text-gray-600 mb-2">Responses ({(responses as unknown[]).length})</div>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {(responses as {id:number;stem?:string;response_value?:string;is_skipped:boolean;time_taken_secs?:number}[]).map(r=>(
                              <div key={r.id} className="flex items-center gap-2 bg-white rounded border px-2 py-1 text-xs">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.is_skipped?'bg-gray-300':'bg-green-400'}`}/>
                                <span className="flex-1 truncate text-gray-700">{r.stem||`Q${r.id}`}</span>
                                <span className="text-gray-400 flex-shrink-0">{r.response_value||'skipped'}</span>
                                {r.time_taken_secs && <span className="text-gray-300">{r.time_taken_secs}s</span>}
                              </div>
                            ))}
                            {responses.length===0 && <p className="text-xs text-gray-400">No responses recorded</p>}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {total>50 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Page {page} of {Math.ceil(total/50)}</span>
          <div className="flex gap-2">
            <button onClick={()=>setPage(p=>p-1)} disabled={page===1} className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button onClick={()=>setPage(p=>p+1)} disabled={page>=Math.ceil(total/50)} className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
