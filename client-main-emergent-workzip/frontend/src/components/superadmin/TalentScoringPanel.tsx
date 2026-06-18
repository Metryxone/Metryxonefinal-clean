import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, X, Play, Search, ChevronDown, ChevronUp } from 'lucide-react';

interface Coverage {
  scored_users: number;
  total_score_records: number;
  platform_avg_score: number;
  avg_confidence: number;
}
interface RfDist { rf_name: string; future_relevance: string; user_count: number; avg_score: number; min_score: number; max_score: number; }
interface LevelDist { level_fit: string; count: number; }
interface TopScorer { user_id: string; top_rf: string; overall_score: number; level_fit: string; confidence: number; }
interface GapDist { gap_severity: string; count: number; }

const LEVEL_COLORS: Record<string, string> = { junior:'bg-green-100 text-green-700', mid:'bg-blue-100 text-blue-700', senior:'bg-purple-100 text-purple-700', lead:'bg-orange-100 text-orange-700', executive:'bg-red-100 text-red-700' };
const GAP_COLORS: Record<string, string> = { critical:'text-red-600', moderate:'text-orange-500', minor:'text-yellow-600', none:'text-green-600' };
const RELEVANCE_DOT: Record<string, string> = { critical:'bg-red-500', high:'bg-orange-400', moderate:'bg-yellow-400', low:'bg-gray-300' };

export default function TalentScoringPanel() {
  const [overview, setOverview] = useState<{ rf_distribution: RfDist[]; level_distribution: LevelDist[]; top_scorers: TopScorer[]; gap_severity_distribution: GapDist[]; coverage: Coverage } | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [computeUserId, setComputeUserId] = useState('');
  const [error, setError] = useState('');
  const [computeResult, setComputeResult] = useState<any>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/talent/scoring/overview', { credentials: 'include' });
      if (!r.ok) throw new Error(await r.text());
      setOverview(await r.json());
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const compute = async () => {
    setComputing(true); setError(''); setComputeResult(null);
    try {
      const body = computeUserId.trim() ? { user_id: computeUserId.trim() } : {};
      const r = await fetch('/api/admin/talent/scoring/compute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Compute failed'); }
      setComputeResult(await r.json());
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setComputing(false); }
  };

  const loadUser = async (userId: string) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    try {
      const r = await fetch(`/api/admin/talent/scoring/user/${encodeURIComponent(userId)}`, { credentials: 'include' });
      if (r.ok) setUserDetail(await r.json());
    } catch {}
  };

  const scoreBar = (score: number) => (
    <div className="flex items-center gap-2">
      <div className="w-24 bg-gray-200 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-blue-400' : 'bg-orange-400'}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-600 w-8">{score}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Compute controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Compute Talent Scores</h3>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input value={computeUserId} onChange={e => setComputeUserId(e.target.value)} placeholder="User ID (leave blank to compute all)" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={compute} disabled={computing} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
            {computing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {computing ? 'Computing…' : computeUserId.trim() ? 'Compute for User' : 'Compute All'}
          </button>
        </div>
        {computeResult && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            ✓ {computeResult.users_processed != null ? `${computeResult.users_processed} users processed` : `User scored`} — {computeResult.total_scores ?? computeResult.scored} score records written
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />{error}<button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : !overview ? null : (
        <>
          {/* Coverage summary */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Scored Users', val: overview.coverage.scored_users },
              { label: 'Score Records', val: overview.coverage.total_score_records },
              { label: 'Avg Platform Score', val: `${overview.coverage.platform_avg_score ?? '—'}` },
              { label: 'Avg Confidence', val: `${Math.round((overview.coverage.avg_confidence ?? 0) * 100)}%` },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-800">{s.val}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Level Distribution */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Level Fit Distribution</h3>
              {overview.level_distribution.length === 0 ? (
                <p className="text-xs text-gray-400">No scores computed yet. Run "Compute All" to populate.</p>
              ) : (
                <div className="space-y-2">
                  {overview.level_distribution.map(l => {
                    const pct = overview.coverage.scored_users > 0 ? (l.count / overview.coverage.scored_users) * 100 : 0;
                    return (
                      <div key={l.level_fit} className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded w-20 text-center ${LEVEL_COLORS[l.level_fit]}`}>{l.level_fit}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-mono text-gray-600 w-8 text-right">{l.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Gap Severity */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Gap Severity Distribution</h3>
              {overview.gap_severity_distribution.length === 0 ? (
                <p className="text-xs text-gray-400">No gap data yet.</p>
              ) : (
                <div className="space-y-2">
                  {overview.gap_severity_distribution.map(g => (
                    <div key={g.gap_severity} className="flex items-center gap-2">
                      <span className={`text-xs font-medium w-20 ${GAP_COLORS[g.gap_severity]}`}>{g.gap_severity}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${g.gap_severity==='critical'?'bg-red-500':g.gap_severity==='moderate'?'bg-orange-400':g.gap_severity==='minor'?'bg-yellow-400':'bg-green-400'}`} style={{ width: `${Math.min(100, g.count * 10)}%` }} />
                      </div>
                      <span className="text-xs font-mono text-gray-600 w-8 text-right">{g.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RF Score Distribution */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Role Family Score Distribution</h3>
              <button onClick={load} className="p-1 hover:bg-gray-100 rounded"><RefreshCw className="w-3.5 h-3.5 text-gray-400" /></button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {overview.rf_distribution.map(rf => (
                <div key={rf.rf_name} className="flex items-center gap-3 py-1">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${RELEVANCE_DOT[rf.future_relevance]}`} />
                  <span className="text-xs text-gray-700 w-48 truncate shrink-0">{rf.rf_name}</span>
                  <span className="text-xs text-gray-400 w-12 text-center">{rf.user_count} users</span>
                  {rf.avg_score != null ? scoreBar(Number(rf.avg_score)) : <span className="text-xs text-gray-300">no data</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Top Scorers */}
          {overview.top_scorers.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Talent (by Peak Role Family Score)</h3>
              <div className="space-y-1">
                {overview.top_scorers.map(s => (
                  <div key={s.user_id}>
                    <div onClick={() => loadUser(s.user_id)} className="flex items-center gap-3 py-1.5 px-2 hover:bg-gray-50 rounded cursor-pointer">
                      <span className="text-xs font-mono text-gray-500 w-32 truncate">{s.user_id.slice(0,16)}…</span>
                      <span className="text-xs text-gray-700 flex-1 truncate">{s.top_rf}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${LEVEL_COLORS[s.level_fit]}`}>{s.level_fit}</span>
                      {scoreBar(Number(s.overall_score))}
                      <span className="text-xs text-gray-400">{Math.round(s.confidence * 100)}% conf</span>
                      {expandedUser === s.user_id ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                    </div>
                    {expandedUser === s.user_id && userDetail?.user_id === s.user_id && (
                      <div className="ml-4 mb-2 bg-gray-50 rounded p-3">
                        <p className="text-xs font-medium text-gray-600 mb-2">All RF Scores</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {userDetail.scores.map((sc: any) => (
                            <div key={sc.rf_id} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-600 truncate flex-1">{sc.rf_name}</span>
                              {scoreBar(Number(sc.overall_score))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
