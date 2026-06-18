import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';

interface GapRow {
  rf_name: string;
  total_users: number;
  critical_count: number;
  moderate_count: number;
  minor_count: number;
  no_gap_count: number;
  avg_gap: number;
}

const SEV_COLORS = {
  critical: 'bg-red-500',
  moderate: 'bg-orange-400',
  minor:    'bg-yellow-400',
  none:     'bg-green-400',
};

export default function TalentGapPanel() {
  const [gaps, setGaps] = useState<GapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'avg_gap' | 'critical_count' | 'total_users'>('avg_gap');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/talent/gaps/overview', { credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
      setGaps(await r.json());
    } catch (e: any) { setError(e.message || 'Failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const sorted = [...gaps].sort((a, b) => Number(b[sortBy]) - Number(a[sortBy]));
  const totalCritical = gaps.reduce((s, g) => s + g.critical_count, 0);
  const totalModerate = gaps.reduce((s, g) => s + g.moderate_count, 0);
  const totalUsers = gaps.reduce((s, g) => s + g.total_users, 0);

  const severityBar = (row: GapRow) => {
    const total = row.critical_count + row.moderate_count + row.minor_count + row.no_gap_count;
    if (total === 0) return <span className="text-xs text-gray-300">no data</span>;
    return (
      <div className="flex h-2 w-32 rounded-full overflow-hidden">
        {(['critical','moderate','minor','none'] as const).map(sev => {
          const count = sev === 'none' ? row.no_gap_count : row[`${sev}_count` as keyof GapRow] as number;
          const pct = (count / total) * 100;
          return pct > 0 ? <div key={sev} className={SEV_COLORS[sev]} style={{ width: `${pct}%` }} /> : null;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Assessed Users', val: totalUsers },
          { label: 'Critical Gaps', val: totalCritical, color: 'text-red-600' },
          { label: 'Moderate Gaps', val: totalModerate, color: 'text-orange-500' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${s.color || 'text-gray-800'}`}>{s.val}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {(['critical','moderate','minor','none'] as const).map(s => (
          <div key={s} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${SEV_COLORS[s]}`} />
            <span className="capitalize">{s === 'none' ? 'No Gap' : s}</span>
          </div>
        ))}
        <span className="ml-auto italic">Gaps indicate distance from level thresholds</span>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">Sort by:</span>
        {([['avg_gap','Avg Gap'],['critical_count','Critical Count'],['total_users','Users']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSortBy(key)} className={`text-xs px-2 py-1 rounded ${sortBy === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
        ))}
        <button onClick={load} className="ml-auto p-1.5 border border-gray-200 rounded hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5 text-gray-400" /></button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />{error}<button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 text-gray-500 font-medium">Role Family</th>
                <th className="text-center px-3 py-2 text-gray-500 font-medium">Users</th>
                <th className="text-center px-3 py-2 text-red-500 font-medium">Critical</th>
                <th className="text-center px-3 py-2 text-orange-500 font-medium">Moderate</th>
                <th className="text-center px-3 py-2 text-yellow-500 font-medium">Minor</th>
                <th className="text-center px-3 py-2 text-green-500 font-medium">None</th>
                <th className="text-center px-3 py-2 text-gray-500 font-medium">Avg Gap</th>
                <th className="px-4 py-2 text-gray-500 font-medium">Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(row => (
                <React.Fragment key={row.rf_name}>
                  <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === row.rf_name ? null : row.rf_name)}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      <div className="flex items-center gap-1">
                        {expanded === row.rf_name ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                        {row.rf_name}
                      </div>
                    </td>
                    <td className="text-center px-3 py-2.5 text-gray-600">{row.total_users}</td>
                    <td className="text-center px-3 py-2.5 text-red-600 font-medium">{row.critical_count}</td>
                    <td className="text-center px-3 py-2.5 text-orange-500">{row.moderate_count}</td>
                    <td className="text-center px-3 py-2.5 text-yellow-600">{row.minor_count}</td>
                    <td className="text-center px-3 py-2.5 text-green-600">{row.no_gap_count}</td>
                    <td className="text-center px-3 py-2.5">
                      <span className={`font-mono ${Number(row.avg_gap) > 25 ? 'text-red-500' : Number(row.avg_gap) > 12 ? 'text-orange-400' : 'text-gray-500'}`}>
                        {Number(row.avg_gap).toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{severityBar(row)}</td>
                  </tr>
                  {expanded === row.rf_name && (
                    <tr>
                      <td colSpan={8} className="bg-gray-50 px-8 py-3">
                        <div className="grid grid-cols-4 gap-4 text-xs text-gray-600">
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">Critical Gap Users</p>
                            <p className="text-red-600 text-lg font-bold">{row.critical_count}</p>
                            <p className="text-gray-400">Need immediate development</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">Moderate Gap Users</p>
                            <p className="text-orange-500 text-lg font-bold">{row.moderate_count}</p>
                            <p className="text-gray-400">Structured learning needed</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">Ready Users</p>
                            <p className="text-green-600 text-lg font-bold">{row.no_gap_count}</p>
                            <p className="text-gray-400">At or above level threshold</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">Average Gap Score</p>
                            <p className="text-gray-800 text-lg font-bold">{Number(row.avg_gap).toFixed(1)}</p>
                            <p className="text-gray-400">Points below threshold</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No gap data yet — run Talent Scoring first</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
