import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Capability { id: number; capability_code: string; capability_name: string; cluster_code: string; cluster_name: string; description: string; long_lived_relevance: string; automation_risk_level: string; is_active: boolean; }
interface Stats { total: number; active: number; by_cluster: { cluster_name: string; count: number }[]; by_risk: { automation_risk_level: string; count: number }[]; dependency_count: number; weight_entries: number; }

const RISK_COLORS: Record<string, string> = { low: 'bg-emerald-100 text-emerald-800', moderate: 'bg-amber-100 text-amber-800', high: 'bg-red-100 text-red-800' };
const RELEVANCE_COLORS: Record<string, string> = { permanent: 'bg-purple-100 text-purple-800', decade: 'bg-blue-100 text-blue-800', '5yr': 'bg-cyan-100 text-cyan-800', '3yr': 'bg-gray-100 text-gray-700' };

export default function VXCapabilityArchitecturePanel() {
  const [caps, setCaps] = useState<Capability[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'capabilities' | 'stats'>('capabilities');

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/vx/capabilities?refresh=1').then(r => r.json()).catch(() => ({ capabilities: [] })),
      fetch('/api/admin/vx/capabilities/stats').then(r => r.json()).catch(() => null),
    ]).then(([data, s]) => {
      setCaps(data.capabilities || []);
      setStats(s);
      setLoading(false);
    });
  }, []);

  const filtered = caps.filter(c =>
    (riskFilter === 'all' || c.automation_risk_level === riskFilter) &&
    (c.capability_name.toLowerCase().includes(search.toLowerCase()) || c.cluster_name?.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Capability Architecture…</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Capability Architecture <span className="text-sm font-normal text-gray-500 ml-2">VX-D3</span></h2>
          <p className="text-sm text-gray-500 mt-1">Stable, long-lived capabilities — the layer between Role Families and Competencies</p>
        </div>
        <div className="flex gap-2">
          <Button variant={activeTab === 'capabilities' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('capabilities')}>Capabilities</Button>
          <Button variant={activeTab === 'stats' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('stats')}>Analytics</Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Capabilities', value: stats.total, sub: `${stats.active} active` },
            { label: 'Clusters', value: stats.by_cluster?.length ?? 0, sub: 'Capability clusters' },
            { label: 'Dependencies', value: stats.dependency_count, sub: 'Cross-cap links' },
            { label: 'Weight Entries', value: stats.weight_entries, sub: 'Role × Layer weights' },
          ].map(s => (
            <div key={s.label} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-2xl font-bold text-indigo-700">{s.value}</div>
              <div className="text-sm font-medium text-gray-700 mt-1">{s.label}</div>
              <div className="text-xs text-gray-400">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'stats' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">By Cluster</h3>
            <div className="space-y-3">
              {stats.by_cluster?.map(c => (
                <div key={c.cluster_name} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{c.cluster_name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-100 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(Number(c.count) / stats.total) * 100}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-600 w-6 text-right">{c.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Automation Risk Distribution</h3>
            <div className="space-y-3">
              {stats.by_risk?.map(r => (
                <div key={r.automation_risk_level} className="flex items-center justify-between">
                  <Badge className={RISK_COLORS[r.automation_risk_level] || 'bg-gray-100'}>{r.automation_risk_level}</Badge>
                  <span className="text-sm font-semibold">{r.count} capabilities</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'capabilities' && (
        <>
          <div className="flex gap-3">
            <Input placeholder="Search capabilities…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Automation Risk" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-400 self-center">{filtered.length} of {caps.length}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(cap => (
              <div key={cap.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-gray-900">{cap.capability_name}</div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">{cap.capability_code}</div>
                  </div>
                  <Badge className={RISK_COLORS[cap.automation_risk_level] || 'bg-gray-100'} variant="outline">{cap.automation_risk_level} risk</Badge>
                </div>
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{cap.description}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="text-xs">{cap.cluster_name}</Badge>
                  <Badge className={RELEVANCE_COLORS[cap.long_lived_relevance] || 'bg-gray-100'} variant="outline">{cap.long_lived_relevance}</Badge>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
