import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WKGOverview { nodes: { total: number; active: number }; edges: { total: number }; by_node_type: { node_type: string; count: number }[]; by_relationship: { relationship_type: string; count: number }[]; }
interface WKGNode { id: number; node_type: string; node_key: string; node_label: string; description: string; source_table: string; }
interface SchemaInfo { node_types: string[]; relationship_types: string[]; }

const NODE_COLORS: Record<string, string> = {
  Capability: 'bg-indigo-100 text-indigo-800', Competency: 'bg-blue-100 text-blue-800',
  RoleFamily: 'bg-purple-100 text-purple-800', Concern: 'bg-orange-100 text-orange-800',
  Signal: 'bg-amber-100 text-amber-800', FutureSkill: 'bg-emerald-100 text-emerald-800',
  Outcome: 'bg-green-100 text-green-800', LearningAsset: 'bg-cyan-100 text-cyan-800',
  Role: 'bg-pink-100 text-pink-800', Industry: 'bg-gray-100 text-gray-700',
};

export default function VXWorkforceKnowledgeGraphPanel() {
  const [tab, setTab] = useState<'overview' | 'nodes' | 'schema'>('overview');
  const [overview, setOverview] = useState<WKGOverview | null>(null);
  const [nodes, setNodes] = useState<WKGNode[]>([]);
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [nodeTypeFilter, setNodeTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [materializing, setMaterializing] = useState(false);
  const [materializeResult, setMaterializeResult] = useState<{ nodes: number; edges: number } | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/vx/wkg/overview').then(r => r.json()).catch(() => null),
      fetch('/api/admin/vx/wkg/nodes?limit=100').then(r => r.json()).catch(() => ({ nodes: [] })),
      fetch('/api/admin/vx/wkg/schema').then(r => r.json()).catch(() => null),
    ]).then(([ov, nd, sc]) => {
      setOverview(ov);
      setNodes(nd.nodes || []);
      setSchema(sc);
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  const materialize = () => {
    setMaterializing(true);
    fetch('/api/admin/vx/wkg/materialize', { method: 'POST' }).then(r => r.json()).then(d => {
      setMaterializeResult({ nodes: d.nodes, edges: d.edges });
      setMaterializing(false);
      loadData();
    }).catch(() => setMaterializing(false));
  };

  const filteredNodes = nodes.filter(n =>
    (nodeTypeFilter === 'all' || n.node_type === nodeTypeFilter) &&
    (n.node_label.toLowerCase().includes(search.toLowerCase()) || n.node_key.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Workforce Knowledge Graph…</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workforce Knowledge Graph <span className="text-sm font-normal text-gray-500 ml-2">VX-D1</span></h2>
          <p className="text-sm text-gray-500 mt-1">Typed nodes · named relationships · graph query APIs · cross-domain intelligence</p>
        </div>
        <div className="flex gap-2">
          {(['overview', 'nodes', 'schema'] as const).map(t => (
            <Button key={t} variant={tab === t ? 'default' : 'outline'} size="sm" onClick={() => setTab(t)} className="capitalize">{t}</Button>
          ))}
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Nodes', value: overview.nodes?.total ?? 0, accent: 'text-indigo-600' },
            { label: 'Active Nodes', value: overview.nodes?.active ?? 0, accent: 'text-green-600' },
            { label: 'Graph Edges', value: overview.edges?.total ?? 0, accent: 'text-purple-600' },
            { label: 'Node Types', value: overview.by_node_type?.length ?? 0, accent: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border rounded-xl p-4 shadow-sm">
              <div className={`text-2xl font-bold ${s.accent}`}>{s.value}</div>
              <div className="text-sm text-gray-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={materialize} disabled={materializing} className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
          {materializing ? 'Materializing…' : '⚡ Materialize from Talent Tables'}
        </Button>
        {materializeResult && (
          <span className="text-sm text-green-600">✓ Created {materializeResult.nodes} nodes + {materializeResult.edges} edges</span>
        )}
      </div>

      {tab === 'overview' && overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Nodes by Type</h3>
            <div className="space-y-3">
              {(overview.by_node_type || []).map(n => (
                <div key={n.node_type} className="flex items-center justify-between">
                  <Badge className={NODE_COLORS[n.node_type] || 'bg-gray-100'}>{n.node_type}</Badge>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-100 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min(100, (Number(n.count) / Math.max(1, Number(overview.nodes?.active || 1))) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-semibold w-8 text-right">{n.count}</span>
                  </div>
                </div>
              ))}
              {!overview.by_node_type?.length && <div className="text-gray-400 text-sm">Graph not yet materialized. Click "Materialize" above.</div>}
            </div>
          </div>
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Relationships</h3>
            <div className="space-y-2">
              {(overview.by_relationship || []).map(r => (
                <div key={r.relationship_type} className="flex items-center justify-between">
                  <span className="text-sm font-mono text-indigo-600">{r.relationship_type}</span>
                  <Badge variant="outline">{r.count}</Badge>
                </div>
              ))}
              {!overview.by_relationship?.length && <div className="text-gray-400 text-sm">No edges yet</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'nodes' && (
        <>
          <div className="flex gap-3">
            <Input placeholder="Search nodes…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={nodeTypeFilter} onValueChange={setNodeTypeFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Node Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {schema?.node_types?.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-400 self-center">{filteredNodes.length} nodes</span>
          </div>
          {filteredNodes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No nodes found. Materialize the graph first.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredNodes.slice(0, 60).map(n => (
                <div key={n.id} className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <Badge className={NODE_COLORS[n.node_type] || 'bg-gray-100'} variant="outline">{n.node_type}</Badge>
                    {n.source_table && <span className="text-xs text-gray-400">{n.source_table}</span>}
                  </div>
                  <div className="font-semibold text-gray-900 text-sm mt-2">{n.node_label}</div>
                  <div className="text-xs font-mono text-gray-400 mt-0.5">{n.node_key}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'schema' && schema && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Node Types ({schema.node_types?.length})</h3>
            <div className="flex flex-wrap gap-2">
              {schema.node_types?.map(t => <Badge key={t} className={NODE_COLORS[t] || 'bg-gray-100'}>{t}</Badge>)}
            </div>
          </div>
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Relationship Types ({schema.relationship_types?.length})</h3>
            <div className="flex flex-wrap gap-2">
              {schema.relationship_types?.map(r => <Badge key={r} variant="outline" className="font-mono text-xs">{r}</Badge>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
