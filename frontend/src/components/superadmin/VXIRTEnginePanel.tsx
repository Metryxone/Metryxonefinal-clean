import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface IRTOverview { item_parameters: { model_type: string; calibration_status: string; count: number; avg_difficulty: number; avg_discrimination: number }[]; ability_estimates: { estimation_method: string; count: number; avg_theta: number; avg_se: number }[]; adaptive_configs: AdaptiveConfig[]; }
interface IRTItem { id: number; question_ref: string; difficulty_b: number; discrimination_a: number; guessing_c: number; model_type: string; calibration_status: string; competency_code: string; sample_size: number; }
interface AdaptiveConfig { id: number; config_key: string; assessment_type: string; max_items: number; min_items: number; se_threshold: number; item_selection_method: string; ability_prior_mean: number; ability_prior_sd: number; stopping_rule: string; }

const CALIB_COLORS: Record<string, string> = { validated: 'bg-green-100 text-green-800', calibrated: 'bg-blue-100 text-blue-800', pilot: 'bg-amber-100 text-amber-800', simulated: 'bg-gray-100 text-gray-600' };
const STOPPING_COLORS: Record<string, string> = { both: 'bg-indigo-100 text-indigo-700', max_items: 'bg-blue-100 text-blue-700', se_threshold: 'bg-purple-100 text-purple-700' };

function difficultyLabel(b: number) { return b > 1.5 ? 'Hard' : b > 0.5 ? 'Moderately Hard' : b > -0.5 ? 'Medium' : b > -1.5 ? 'Moderately Easy' : 'Easy'; }
function difficultyColor(b: number) { return b > 1 ? 'text-red-600' : b > 0 ? 'text-orange-500' : b > -1 ? 'text-blue-500' : 'text-green-600'; }

export default function VXIRTEnginePanel() {
  const [tab, setTab] = useState<'overview' | 'items' | 'adaptive' | 'simulate'>('overview');
  const [overview, setOverview] = useState<IRTOverview | null>(null);
  const [items, setItems] = useState<IRTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [simRef, setSimRef] = useState('');
  const [simB, setSimB] = useState('0.0');
  const [simA, setSimA] = useState('1.0');
  const [simC, setSimC] = useState('0.1');
  const [simResult, setSimResult] = useState<Record<string, unknown> | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/vx/irt/overview').then(r => r.json()).catch(() => null),
      fetch('/api/admin/vx/irt/items').then(r => r.json()).catch(() => ({ items: [] })),
    ]).then(([ov, it]) => {
      setOverview(ov);
      setItems(it.items || []);
      setLoading(false);
    });
  }, []);

  const runSimCalibration = () => {
    if (!simRef) return;
    setSimLoading(true);
    fetch('/api/admin/vx/irt/simulate-calibration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_ref: simRef, target_difficulty: parseFloat(simB), target_discrimination: parseFloat(simA), target_guessing: parseFloat(simC), sample_size: 200 }),
    }).then(r => r.json()).then(d => { setSimResult(d); setSimLoading(false); }).catch(() => setSimLoading(false));
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading IRT Engine…</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">IRT & Adaptive Assessment Engine <span className="text-sm font-normal text-gray-500 ml-2">VX-D9</span></h2>
          <p className="text-sm text-gray-500 mt-1">3PL Item Response Theory · θ ability estimation · adaptive stopping · MAP/EAP estimation</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['overview', 'items', 'adaptive', 'simulate'] as const).map(t => (
            <Button key={t} variant={tab === t ? 'default' : 'outline'} size="sm" onClick={() => setTab(t)} className="capitalize">{t}</Button>
          ))}
        </div>
      </div>

      {tab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border rounded-xl p-5 shadow-sm col-span-2">
              <h3 className="font-semibold mb-4">Item Parameter Bank</h3>
              <div className="space-y-3">
                {(overview.item_parameters || []).map(ip => (
                  <div key={`${ip.model_type}-${ip.calibration_status}`} className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Badge variant="outline">{ip.model_type}</Badge>
                      <Badge className={CALIB_COLORS[ip.calibration_status] || 'bg-gray-100'}>{ip.calibration_status}</Badge>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <span><span className="text-gray-500">n=</span><strong>{ip.count}</strong></span>
                      <span><span className="text-gray-500">avg b=</span><strong>{ip.avg_difficulty}</strong></span>
                      <span><span className="text-gray-500">avg a=</span><strong>{ip.avg_discrimination}</strong></span>
                    </div>
                  </div>
                ))}
                {!overview.item_parameters?.length && <div className="text-gray-400 text-sm">No items calibrated yet. Use the Simulate tab to add parameters.</div>}
              </div>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-indigo-800 mb-3">3PL IRT Model</h3>
              <div className="font-mono text-xs text-indigo-700 space-y-1">
                <div>P(θ) = c + (1-c) / (1 + e^(-1.7a(θ-b)))</div>
                <div className="mt-2 space-y-1 text-indigo-600">
                  <div><strong>b</strong> — Item difficulty (logit scale)</div>
                  <div><strong>a</strong> — Item discrimination</div>
                  <div><strong>c</strong> — Guessing parameter</div>
                  <div><strong>θ</strong> — Latent ability estimate</div>
                </div>
              </div>
            </div>
          </div>
          {overview.adaptive_configs?.length > 0 && (
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold mb-4">Adaptive Configs</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {overview.adaptive_configs.map(c => (
                  <div key={c.config_key} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold capitalize">{c.assessment_type}</span>
                      <Badge className={STOPPING_COLORS[c.stopping_rule] || 'bg-gray-100'}>{c.stopping_rule.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><div className="text-xs text-gray-500">Max Items</div><div className="font-semibold">{c.max_items}</div></div>
                      <div><div className="text-xs text-gray-500">Min Items</div><div className="font-semibold">{c.min_items}</div></div>
                      <div><div className="text-xs text-gray-500">SE Threshold</div><div className="font-semibold">{c.se_threshold}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'items' && (
        <>
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No items calibrated yet. Use the Simulate tab to add item parameters.</div>
          ) : (
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['Question Ref', 'b (difficulty)', 'a (discrimination)', 'c (guessing)', 'Model', 'Status', 'Competency'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{item.question_ref}</td>
                      <td className="px-4 py-3"><span className={`font-semibold ${difficultyColor(Number(item.difficulty_b))}`}>{item.difficulty_b}</span><div className="text-xs text-gray-400">{difficultyLabel(Number(item.difficulty_b))}</div></td>
                      <td className="px-4 py-3 font-semibold">{item.discrimination_a}</td>
                      <td className="px-4 py-3">{item.guessing_c}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{item.model_type}</Badge></td>
                      <td className="px-4 py-3"><Badge className={CALIB_COLORS[item.calibration_status] || 'bg-gray-100'}>{item.calibration_status}</Badge></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{item.competency_code || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'adaptive' && overview?.adaptive_configs && (
        <div className="space-y-4">
          {overview.adaptive_configs.map(c => (
            <div key={c.config_key} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div><div className="font-semibold capitalize">{c.assessment_type} Assessment</div><div className="text-xs font-mono text-gray-400">{c.config_key}</div></div>
                <div className="flex gap-2">
                  <Badge className={STOPPING_COLORS[c.stopping_rule] || 'bg-gray-100'}>{c.stopping_rule.replace(/_/g, ' ')}</Badge>
                  <Badge variant="outline" className="capitalize">{c.item_selection_method.replace(/_/g, ' ')}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                {[{ l: 'Max Items', v: c.max_items }, { l: 'Min Items', v: c.min_items }, { l: 'SE Threshold', v: c.se_threshold }, { l: 'Prior Mean (θ)', v: c.ability_prior_mean }, { l: 'Prior SD', v: c.ability_prior_sd }].map(s => (
                  <div key={s.l} className="bg-gray-50 rounded-lg p-3 text-center"><div className="font-bold text-indigo-700">{s.v}</div><div className="text-xs text-gray-500">{s.l}</div></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'simulate' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-xl p-6 shadow-sm max-w-lg">
            <h3 className="font-semibold mb-4">Simulate Item Calibration</h3>
            <div className="space-y-4">
              <div><label className="text-sm font-medium text-gray-700">Question Reference</label><Input value={simRef} onChange={e => setSimRef(e.target.value)} placeholder="e.g., Q_LEAD_001" className="mt-1" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-sm font-medium text-gray-700">b (difficulty)</label><Input value={simB} onChange={e => setSimB(e.target.value)} type="number" step="0.1" className="mt-1" /></div>
                <div><label className="text-sm font-medium text-gray-700">a (discrimination)</label><Input value={simA} onChange={e => setSimA(e.target.value)} type="number" step="0.1" min="0.1" className="mt-1" /></div>
                <div><label className="text-sm font-medium text-gray-700">c (guessing)</label><Input value={simC} onChange={e => setSimC(e.target.value)} type="number" step="0.01" min="0" max="0.35" className="mt-1" /></div>
              </div>
              <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">Range guidance: b ∈ [-3, 3] | a ∈ [0.5, 2.5] | c ∈ [0, 0.35]</div>
              <Button onClick={runSimCalibration} disabled={simLoading || !simRef} className="w-full">{simLoading ? 'Running…' : 'Run Simulation'}</Button>
            </div>
          </div>
          {simResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h3 className="font-semibold text-green-800 mb-3">Simulation Result</h3>
              <pre className="text-xs font-mono text-green-700 overflow-auto">{JSON.stringify(simResult, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
