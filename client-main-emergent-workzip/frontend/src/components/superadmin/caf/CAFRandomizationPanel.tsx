import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STRATEGIES = [
  { value:'fixed', label:'Fixed', desc:'Same questions, same order every time' },
  { value:'stratified', label:'Stratified', desc:'Proportional draw from difficulty × domain strata' },
  { value:'purely_random', label:'Purely Random', desc:'Random selection from the full pool' },
  { value:'adaptive', label:'Adaptive (CAT)', desc:'Item difficulty adjusts based on running θ estimate' },
  { value:'fixed_parallel', label:'Fixed Parallel Forms', desc:'Pre-built forms assigned by session hash' },
];
const SEED_MODES = [
  { value:'session', label:'Per Session', desc:'Each attempt gets a unique seed' },
  { value:'daily', label:'Daily', desc:'Same form all day, rotates midnight' },
  { value:'global', label:'Global', desc:'Single form for all candidates' },
];

type RandRule = { id:number; assessment_id:number; strategy:string; stratify_by?:string[]; difficulty_distribution?:unknown; ensure_coverage?:string[]; seed_mode:string; parallel_forms:number; };
type Assessment = { id:number; code:string; title:string; assessment_type:string; status:string; };

export default function CAFRandomizationPanel() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number|null>(null);
  const [rule, setRule] = useState<Partial<RandRule>>({ strategy:'stratified', seed_mode:'session', parallel_forms:1, stratify_by:['difficulty_tier','domain'], difficulty_distribution:{easy:0.25,medium:0.5,hard:0.25}, ensure_coverage:[] });
  const [ensureCovTxt, setEnsureCovTxt] = useState('');
  const [ddTxt, setDdTxt] = useState(JSON.stringify({easy:0.25,medium:0.5,hard:0.25},null,2));
  const [saved, setSaved] = useState(false);

  const { data: assessments=[] } = useQuery<Assessment[]>({
    queryKey:['caf-assessments-all'],
    queryFn:()=>fetch('/api/caf/assessments?limit=200').then(r=>r.json()).then(d=>d.assessments??[]),
  });

  const { data: existingRule } = useQuery<RandRule|null>({
    queryKey:['caf-rand-rule', selectedId],
    queryFn:()=>selectedId ? fetch(`/api/caf/assessments/${selectedId}/randomization`).then(r=>r.json()) : Promise.resolve(null),
    enabled:!!selectedId,
    onSuccess:(data)=>{
      if(data) {
        setRule(data);
        setDdTxt(data.difficulty_distribution ? JSON.stringify(data.difficulty_distribution,null,2) : '{"easy":0.25,"medium":0.5,"hard":0.25}');
        setEnsureCovTxt((data.ensure_coverage??[]).join(', '));
      }
    },
  } as Parameters<typeof useQuery>[0]);

  const save = useMutation({
    mutationFn:(body:Record<string,unknown>)=>fetch(`/api/caf/assessments/${selectedId}/randomization`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['caf-rand-rule']}); setSaved(true); setTimeout(()=>setSaved(false),2500); },
  });

  function handleSave() {
    let dd: unknown = null;
    try { dd = JSON.parse(ddTxt); } catch { alert('Invalid JSON in difficulty distribution'); return; }
    const coverage = ensureCovTxt.split(',').map(s=>s.trim()).filter(Boolean);
    save.mutate({ ...rule, difficulty_distribution:dd, ensure_coverage:coverage });
  }

  const selected = assessments.find(a=>a.id===selectedId);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Randomization Engine</h2>
        <p className="text-sm text-gray-500 mt-0.5">Configure item-selection and ordering strategy per assessment</p>
      </div>

      {/* Assessment selector */}
      <div className="bg-white border rounded-lg p-4 space-y-2">
        <label className="block text-sm font-semibold text-gray-700">Select Assessment</label>
        <select value={selectedId??''} onChange={e=>{ const id=parseInt(e.target.value); setSelectedId(isNaN(id)?null:id); setSaved(false); }}
          className="w-full h-9 text-sm border rounded px-3">
          <option value="">— Choose an assessment —</option>
          {assessments.map(a=><option key={a.id} value={a.id}>[{a.status}] {a.title} ({a.assessment_type.replace('_',' ')})</option>)}
        </select>
        {selectedId && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Shuffle className="h-3.5 w-3.5"/>
            {existingRule ? 'Existing rule loaded — editing in place' : 'No rule yet — configuring new rule'}
          </div>
        )}
      </div>

      {selectedId && (
        <div className="grid grid-cols-2 gap-6">
          {/* Strategy */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700 text-sm">Randomization Strategy</h3>
            <div className="space-y-2">
              {STRATEGIES.map(s=>(
                <label key={s.value} onClick={()=>setRule(r=>({...r,strategy:s.value}))}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${rule.strategy===s.value?'border-blue-400 bg-blue-50':'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" checked={rule.strategy===s.value} onChange={()=>{}} className="mt-0.5"/>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{s.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Config */}
          <div className="space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-700 text-sm">Seed Mode</h3>
              <div className="space-y-2">
                {SEED_MODES.map(s=>(
                  <label key={s.value} onClick={()=>setRule(r=>({...r,seed_mode:s.value}))}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${rule.seed_mode===s.value?'border-purple-400 bg-purple-50':'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" checked={rule.seed_mode===s.value} onChange={()=>{}} className="mt-0.5"/>
                    <div>
                      <div className="text-sm font-medium text-gray-800">{s.label}</div>
                      <div className="text-xs text-gray-500">{s.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {rule.strategy==='fixed_parallel' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Parallel Forms Count</label>
                <Input type="number" min={1} max={10} value={rule.parallel_forms??1} onChange={e=>setRule(r=>({...r,parallel_forms:parseInt(e.target.value)}))} className="h-8 text-sm w-24"/>
              </div>
            )}

            {rule.strategy==='stratified' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Stratify By (comma-separated)</label>
                  <Input value={(rule.stratify_by??[]).join(', ')} onChange={e=>setRule(r=>({...r,stratify_by:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}))} placeholder="difficulty_tier, domain" className="h-8 text-sm"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Difficulty Distribution (JSON)</label>
                  <textarea value={ddTxt} onChange={e=>setDdTxt(e.target.value)} className="w-full border rounded p-2 text-xs font-mono min-h-16 resize-y"/>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ensure Coverage (domains/competencies, comma-sep)</label>
              <Input value={ensureCovTxt} onChange={e=>setEnsureCovTxt(e.target.value)} placeholder="Communication, Problem Solving" className="h-8 text-sm"/>
              <p className="text-[10px] text-gray-400 mt-0.5">At least one item from each listed domain guaranteed to appear</p>
            </div>
          </div>
        </div>
      )}

      {selectedId && (
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {saved && <span className="text-sm text-green-600 font-medium">✓ Randomization rule saved</span>}
          </div>
          <Button onClick={handleSave} disabled={save.isPending} className="gap-2">
            <Save className="h-4 w-4"/>{save.isPending?'Saving…':'Save Randomization Rule'}
          </Button>
        </div>
      )}
    </div>
  );
}
