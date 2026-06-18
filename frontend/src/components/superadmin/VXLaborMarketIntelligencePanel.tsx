import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SkillDemand { id: number; skill_name: string; skill_category: string; demand_score: number; trend_direction: string; demand_velocity: number; role_family_key: string; is_emerging: boolean; ai_impact_score: number; }
interface MarketIntel { id: number; role_family_key: string; industry_key: string; demand_index: number; supply_index: number; market_gap_score: number; competition_intensity: string; avg_salary_min: number; avg_salary_max: number; hiring_trend: string; talent_availability: string; }
interface FutureDemand { id: number; skill_name: string; horizon_years: number; predicted_demand_score: number; disruption_risk: string; opportunity_score: number; reskilling_difficulty: string; strategic_importance: string; }
interface Overview { skill_intelligence: { total: number; emerging: number; avg_demand: number }; market_intelligence: { role_markets: number; avg_gap: number; critical_shortage: number }; future_intelligence: { future_skills: number; transformative: number; avg_future_demand: number }; }

const TREND_COLORS: Record<string, string> = { rising: 'bg-emerald-100 text-emerald-800', emerging: 'bg-purple-100 text-purple-800', stable: 'bg-blue-100 text-blue-800', declining: 'bg-red-100 text-red-800' };
const DISRUPTION_COLORS: Record<string, string> = { transformative: 'bg-red-100 text-red-800', high: 'bg-orange-100 text-orange-800', moderate: 'bg-amber-100 text-amber-800', low: 'bg-green-100 text-green-800' };
const GAP_SEVERITY = (gap: number) => gap > 25 ? 'bg-red-500' : gap > 15 ? 'bg-orange-500' : gap > 5 ? 'bg-amber-400' : 'bg-green-500';

export default function VXLaborMarketIntelligencePanel() {
  const [tab, setTab] = useState<'overview' | 'skills' | 'market' | 'future'>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [skills, setSkills] = useState<SkillDemand[]>([]);
  const [market, setMarket] = useState<MarketIntel[]>([]);
  const [future, setFuture] = useState<FutureDemand[]>([]);
  const [trendFilter, setTrendFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/vx/labor-market/overview').then(r => r.json()).catch(() => null),
      fetch('/api/admin/vx/labor-market/skill-demand').then(r => r.json()).catch(() => ({ skills: [] })),
      fetch('/api/admin/vx/labor-market/market-intelligence').then(r => r.json()).catch(() => ({ markets: [] })),
      fetch('/api/admin/vx/labor-market/future-demand').then(r => r.json()).catch(() => ({ future_skills: [] })),
    ]).then(([ov, sk, mk, fd]) => {
      setOverview(ov);
      setSkills(sk.skills || []);
      setMarket(mk.markets || []);
      setFuture(fd.future_skills || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Labor Market Intelligence…</div>;

  const filteredSkills = trendFilter === 'all' ? skills : skills.filter(s => s.trend_direction === trendFilter);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Labor Market Intelligence <span className="text-sm font-normal text-gray-500 ml-2">VX-D15</span></h2>
          <p className="text-sm text-gray-500 mt-1">Skill demand · market gaps · salary intelligence · future skills</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['overview', 'skills', 'market', 'future'] as const).map(t => (
            <Button key={t} variant={tab === t ? 'default' : 'outline'} size="sm" onClick={() => setTab(t)} className="capitalize">{t}</Button>
          ))}
        </div>
      </div>

      {tab === 'overview' && overview && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-gray-800">Skill Intelligence</h3>
            {[{ l: 'Total Skills Tracked', v: overview.skill_intelligence.total }, { l: 'Emerging Skills', v: overview.skill_intelligence.emerging }, { l: 'Avg Demand Score', v: `${overview.skill_intelligence.avg_demand}/100` }].map(i => (
              <div key={i.l} className="flex justify-between"><span className="text-sm text-gray-600">{i.l}</span><span className="font-semibold">{i.v}</span></div>
            ))}
          </div>
          <div className="bg-white border rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-gray-800">Market Intelligence</h3>
            {[{ l: 'Role Markets Tracked', v: overview.market_intelligence.role_markets }, { l: 'Avg Market Gap', v: `${overview.market_intelligence.avg_gap}pts` }, { l: 'Critical Shortage Markets', v: overview.market_intelligence.critical_shortage }].map(i => (
              <div key={i.l} className="flex justify-between"><span className="text-sm text-gray-600">{i.l}</span><span className="font-semibold">{i.v}</span></div>
            ))}
          </div>
          <div className="bg-white border rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-gray-800">Future Intelligence</h3>
            {[{ l: 'Future Skills Mapped', v: overview.future_intelligence.future_skills }, { l: 'Transformative Disruptions', v: overview.future_intelligence.transformative }, { l: 'Avg Future Demand', v: `${overview.future_intelligence.avg_future_demand}/100` }].map(i => (
              <div key={i.l} className="flex justify-between"><span className="text-sm text-gray-600">{i.l}</span><span className="font-semibold">{i.v}</span></div>
            ))}
          </div>
        </div>
      )}

      {tab === 'skills' && (
        <>
          <div className="flex gap-3">
            <Select value={trendFilter} onValueChange={setTrendFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Trend Direction" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trends</SelectItem>
                <SelectItem value="rising">Rising</SelectItem>
                <SelectItem value="emerging">Emerging</SelectItem>
                <SelectItem value="stable">Stable</SelectItem>
                <SelectItem value="declining">Declining</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSkills.map(s => (
              <div key={s.id} className="bg-white border rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-gray-900">{s.skill_name}</div>
                    <div className="text-xs text-gray-400">{s.skill_category} · {s.role_family_key}</div>
                  </div>
                  <Badge className={TREND_COLORS[s.trend_direction] || 'bg-gray-100'}>{s.trend_direction}</Badge>
                </div>
                <div className="flex gap-4 mt-3">
                  <div>
                    <div className="text-xs text-gray-500">Demand</div>
                    <div className="flex items-center gap-2"><div className="w-20 bg-gray-100 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${s.demand_score}%` }} /></div><span className="text-sm font-semibold">{s.demand_score}</span></div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">AI Impact</div>
                    <div className="flex items-center gap-2"><div className="w-20 bg-gray-100 rounded-full h-2"><div className="bg-purple-500 h-2 rounded-full" style={{ width: `${s.ai_impact_score}%` }} /></div><span className="text-sm font-semibold">{s.ai_impact_score}</span></div>
                  </div>
                  {s.is_emerging && <Badge className="bg-purple-100 text-purple-700 self-end">Emerging</Badge>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'market' && (
        <div className="space-y-4">
          {market.map(m => (
            <div key={m.id} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div><span className="font-semibold text-gray-900">{m.role_family_key}</span><span className="text-sm text-gray-400 ml-2">· {m.industry_key}</span></div>
                <div className="flex gap-2">
                  <Badge variant="outline">{m.hiring_trend?.replace(/_/g, ' ')}</Badge>
                  <Badge variant="outline" className={m.talent_availability === 'critical_shortage' ? 'bg-red-100 text-red-700' : m.talent_availability === 'scarce' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}>{m.talent_availability?.replace(/_/g, ' ')}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div><div className="text-gray-500 text-xs">Demand Index</div><div className="font-semibold">{m.demand_index}</div></div>
                <div><div className="text-gray-500 text-xs">Supply Index</div><div className="font-semibold">{m.supply_index}</div></div>
                <div><div className="text-gray-500 text-xs">Market Gap</div><div className="flex items-center gap-1"><div className={`w-2 h-2 rounded-full ${GAP_SEVERITY(Number(m.market_gap_score))}`} /><span className="font-semibold">{m.market_gap_score}</span></div></div>
                <div><div className="text-gray-500 text-xs">Avg Salary (INR)</div><div className="font-semibold">{m.avg_salary_min ? `₹${(m.avg_salary_min / 100000).toFixed(1)}L–₹${(m.avg_salary_max / 100000).toFixed(1)}L` : '—'}</div></div>
                <div><div className="text-gray-500 text-xs">Time to Hire</div><div className="font-semibold">{m.time_to_hire_days}d</div></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'future' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {future.map(f => (
            <div key={f.id} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div><div className="font-semibold text-gray-900">{f.skill_name}</div><div className="text-xs text-gray-400">{f.horizon_years}yr horizon</div></div>
                <Badge className={DISRUPTION_COLORS[f.disruption_risk] || 'bg-gray-100'}>{f.disruption_risk}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                <div><div className="text-xs text-gray-500">Predicted Demand</div><div className="font-semibold">{f.predicted_demand_score}/100</div></div>
                <div><div className="text-xs text-gray-500">Opportunity</div><div className="font-semibold">{f.opportunity_score}/100</div></div>
                <div><div className="text-xs text-gray-500">Reskilling</div><div className="font-semibold capitalize">{f.reskilling_difficulty}</div></div>
              </div>
              <Badge variant="outline" className="mt-3 text-xs capitalize">{f.strategic_importance?.replace(/_/g, ' ')}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
