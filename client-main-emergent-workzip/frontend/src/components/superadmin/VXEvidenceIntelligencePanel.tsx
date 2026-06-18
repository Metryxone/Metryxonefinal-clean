import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface EvidenceOverview { total: number; users: number; by_type: { evidence_type: string; count: number; avg_quality: number }[]; by_verification: { verification_status: string; count: number }[]; avg_scores: { avg_quality: number; avg_confidence: number }; }
interface QualityRule { id: number; evidence_type: string; quality_dimensions: Record<string, number>; base_weight: number; description: string; }
interface WeightConfig { id: number; evidence_type: string; base_weight: number; recency_decay_days: number; verification_premium: number; max_contribution_pct: number; }

const VERIF_COLORS: Record<string, string> = { platform_verified: 'bg-green-100 text-green-800', third_party_verified: 'bg-emerald-100 text-emerald-800', peer_verified: 'bg-blue-100 text-blue-800', self_attested: 'bg-amber-100 text-amber-800', unverified: 'bg-gray-100 text-gray-600' };
const WEIGHT_BAR = (w: number) => `${(w * 100).toFixed(0)}%`;

export default function VXEvidenceIntelligencePanel() {
  const [tab, setTab] = useState<'overview' | 'rules' | 'weights'>('overview');
  const [overview, setOverview] = useState<EvidenceOverview | null>(null);
  const [rules, setRules] = useState<QualityRule[]>([]);
  const [weights, setWeights] = useState<WeightConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/vx/evidence/overview').then(r => r.json()).catch(() => null),
      fetch('/api/admin/vx/evidence/quality-rules').then(r => r.json()).catch(() => ({ quality_rules: [], weighting_config: [] })),
    ]).then(([ov, qr]) => {
      setOverview(ov);
      setRules(qr.quality_rules || []);
      setWeights(qr.weighting_config || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Evidence Intelligence…</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Evidence Intelligence Platform <span className="text-sm font-normal text-gray-500 ml-2">VX-D16</span></h2>
          <p className="text-sm text-gray-500 mt-1">Evidence quality scoring · confidence scoring · weighting models</p>
        </div>
        <div className="flex gap-2">
          {(['overview', 'rules', 'weights'] as const).map(t => (
            <Button key={t} variant={tab === t ? 'default' : 'outline'} size="sm" onClick={() => setTab(t)} className="capitalize">{t}</Button>
          ))}
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Evidence Items', value: overview.total ?? 0 },
            { label: 'Users with Evidence', value: overview.users ?? 0 },
            { label: 'Avg Quality Score', value: `${overview.avg_scores?.avg_quality ?? 0}/100` },
            { label: 'Avg Confidence', value: `${overview.avg_scores?.avg_confidence ?? 0}/100` },
          ].map(s => (
            <div key={s.label} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-2xl font-bold text-indigo-700">{s.value}</div>
              <div className="text-sm text-gray-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'overview' && overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Evidence by Type</h3>
            <div className="space-y-3">
              {(overview.by_type || []).map(t => (
                <div key={t.evidence_type} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 capitalize">{t.evidence_type.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-100 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${t.avg_quality}%` }} /></div>
                    <span className="text-xs text-gray-500">Avg {t.avg_quality}</span>
                    <Badge variant="outline" className="text-xs">{t.count}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Verification Status</h3>
            <div className="space-y-3">
              {(overview.by_verification || []).map(v => (
                <div key={v.verification_status} className="flex items-center justify-between">
                  <Badge className={VERIF_COLORS[v.verification_status] || 'bg-gray-100'}>{v.verification_status.replace(/_/g, ' ')}</Badge>
                  <span className="text-sm font-semibold">{v.count} items</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'rules' && (
        <div className="space-y-4">
          {rules.map(r => (
            <div key={r.id} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold capitalize">{r.evidence_type.replace(/_/g, ' ')}</span>
                <Badge variant="outline">Base weight: {(r.base_weight * 100).toFixed(0)}%</Badge>
              </div>
              <p className="text-sm text-gray-600 mb-3">{r.description}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(r.quality_dimensions || {}).map(([dim, wt]) => (
                  <div key={dim} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 capitalize">{dim}</div>
                    <div className="font-semibold text-indigo-700">{wt}%</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'weights' && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Evidence Type', 'Base Weight', 'Recency Decay (days)', 'Verification Premium', 'Max Contribution'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {weights.map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium capitalize">{w.evidence_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-16 bg-gray-100 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{ width: WEIGHT_BAR(w.base_weight) }} /></div><span>{(w.base_weight * 100).toFixed(0)}%</span></div></td>
                  <td className="px-4 py-3">{w.recency_decay_days}d</td>
                  <td className="px-4 py-3">+{(w.verification_premium * 100).toFixed(0)}%</td>
                  <td className="px-4 py-3">{w.max_contribution_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
