/**
 * IntelligencePipelinePanel — Admin diagnostics for the CAPADEX composite + pattern pipeline.
 *
 * Shows:
 *  - Activation analytics: aggregate coverage (signals / composites / patterns)
 *  - Per-session diagnostics table: which sessions have composites and patterns
 *  - Backfill trigger: run the pipeline for sessions missing composites
 */
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Play, CheckCircle, XCircle, AlertCircle, BarChart2, Layers, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ────────────────────────────────────────────────────────────────────

interface ActivationAnalytics {
  total_sessions_with_signals: number;
  sessions_with_composites: number;
  sessions_with_patterns: number;
  composite_coverage_pct: number;
  pattern_coverage_pct: number;
  total_composites: number;
  total_patterns: number;
  avg_composites_per_session: number;
  avg_patterns_per_session: number;
  avg_signals_per_session: number;
  sessions_missing_composites: number;
  sessions_missing_patterns: number;
}

interface SessionRow {
  session_id: string;
  signals: number;
  composites: number;
  patterns: number;
  has_composites: boolean;
  has_patterns: boolean;
  first_signal: string | null;
}

interface BackfillResult {
  total_eligible: number;
  processed: number;
  summary: {
    composites_written: number;
    patterns_written: number;
    errors: number;
    skipped: number;
  };
  results: Array<{
    session_id: string;
    signals: number;
    composites: number;
    patterns: number;
    skipped: string | null;
    error: string | null;
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function CoverageBadge({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? 'bg-green-100 text-green-800' :
    pct >= 50 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      {pct}%
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IntelligencePipelinePanel() {
  const [analytics, setAnalytics]   = useState<ActivationAnalytics | null>(null);
  const [sessions,  setSessions]    = useState<SessionRow[]>([]);
  const [backfill,  setBackfill]    = useState<BackfillResult | null>(null);
  const [loading,   setLoading]     = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error,     setError]       = useState<string | null>(null);
  const [sessionLimit, setSessionLimit] = useState(100);
  const [backfillLimit, setBackfillLimit] = useState(100);

  const loadData = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, sessionsRes] = await Promise.all([
        fetch(`/api/admin/intelligence/activation-analytics${refresh ? '?refresh=1' : ''}`),
        fetch(`/api/admin/intelligence/diagnostics?limit=${sessionLimit}${refresh ? '&refresh=1' : ''}`),
      ]);
      const analyticsJson = await analyticsRes.json();
      const sessionsJson  = await sessionsRes.json();
      if (analyticsJson.ok) setAnalytics(analyticsJson.analytics);
      if (sessionsJson.ok)  setSessions(sessionsJson.sessions ?? []);
    } catch (e) {
      setError('Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  }, [sessionLimit]);

  useEffect(() => { loadData(); }, [loadData]);

  const runBackfill = async () => {
    setBackfilling(true);
    setBackfill(null);
    try {
      const res = await fetch(`/api/admin/intelligence/backfill?limit=${backfillLimit}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: backfillLimit }),
      });
      const json = await res.json();
      if (json.ok) {
        setBackfill(json);
        loadData(true);
      } else {
        setError(json.error ?? 'Backfill failed');
      }
    } catch (e) {
      setError('Backfill request failed');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" />
            Intelligence Pipeline
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Composite + Pattern activation — signals → composites → patterns
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData(true)}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Activation Analytics */}
      {analytics && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <BarChart2 className="h-4 w-4 text-indigo-500" />
            Activation Analytics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard
              label="Sessions with Signals"
              value={analytics.total_sessions_with_signals}
              sub={`avg ${analytics.avg_signals_per_session} signals each`}
            />
            <StatCard
              label="Composite Coverage"
              value={`${analytics.composite_coverage_pct}%`}
              sub={`${analytics.sessions_with_composites} of ${analytics.total_sessions_with_signals} sessions`}
            />
            <StatCard
              label="Pattern Coverage"
              value={`${analytics.pattern_coverage_pct}%`}
              sub={`${analytics.sessions_with_patterns} of ${analytics.total_sessions_with_signals} sessions`}
            />
            <StatCard
              label="Total Composites / Patterns"
              value={`${analytics.total_composites} / ${analytics.total_patterns}`}
              sub={`avg ${analytics.avg_composites_per_session}c · ${analytics.avg_patterns_per_session}p per session`}
            />
          </div>

          {/* Pipeline health bar */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Pipeline Health</span>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>Composites <CoverageBadge pct={analytics.composite_coverage_pct} /></span>
                <span>Patterns <CoverageBadge pct={analytics.pattern_coverage_pct} /></span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 shrink-0">Composites</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${analytics.composite_coverage_pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{analytics.composite_coverage_pct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 shrink-0">Patterns</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-violet-500 h-2 rounded-full transition-all"
                    style={{ width: `${analytics.pattern_coverage_pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{analytics.pattern_coverage_pct}%</span>
              </div>
            </div>
            {analytics.sessions_missing_composites > 0 && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠ {analytics.sessions_missing_composites} session(s) still missing composites
                {analytics.sessions_missing_patterns > 0 && ` · ${analytics.sessions_missing_patterns} missing patterns`}.
                Run backfill below.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Backfill */}
      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-amber-500" />
          Backfill Pipeline
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Runs the composite + pattern pipeline for sessions that have signals but no composites yet.
          Idempotent — safe to run multiple times.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500">Batch limit</label>
            <select
              value={backfillLimit}
              onChange={(e) => setBackfillLimit(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded px-2 py-1"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
          <Button
            size="sm"
            onClick={runBackfill}
            disabled={backfilling}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Play className={`h-3.5 w-3.5 ${backfilling ? 'animate-spin' : ''}`} />
            {backfilling ? 'Running…' : 'Run Backfill'}
          </Button>
        </div>

        {backfill && (
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-indigo-50 rounded p-2 text-center">
                <p className="text-lg font-bold text-indigo-700">{backfill.processed}</p>
                <p className="text-xs text-indigo-500">Processed</p>
              </div>
              <div className="bg-green-50 rounded p-2 text-center">
                <p className="text-lg font-bold text-green-700">{backfill.summary.composites_written}</p>
                <p className="text-xs text-green-500">Composites</p>
              </div>
              <div className="bg-violet-50 rounded p-2 text-center">
                <p className="text-lg font-bold text-violet-700">{backfill.summary.patterns_written}</p>
                <p className="text-xs text-violet-500">Patterns</p>
              </div>
              <div className="bg-red-50 rounded p-2 text-center">
                <p className="text-lg font-bold text-red-700">{backfill.summary.errors}</p>
                <p className="text-xs text-red-500">Errors</p>
              </div>
            </div>
            {backfill.summary.errors > 0 && (
              <div className="text-xs text-red-600 bg-red-50 rounded p-2 max-h-32 overflow-y-auto">
                {backfill.results
                  .filter((r) => r.error)
                  .map((r) => (
                    <div key={r.session_id} className="font-mono">
                      {r.session_id.slice(0, 8)}… — {r.error}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Per-session diagnostics table */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Session Diagnostics</h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Show</label>
            <select
              value={sessionLimit}
              onChange={(e) => setSessionLimit(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded px-2 py-1"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
            <span className="text-xs text-gray-400">most recent</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24 text-gray-400">
            <RefreshCw className="h-5 w-5 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">No session signals found</div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Session ID</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Signals</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Composites</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Patterns</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500">Composite ✓</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500">Pattern ✓</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">First Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sessions.map((s) => (
                    <tr key={s.session_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-gray-600">
                        {s.session_id.slice(0, 12)}…
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">{s.signals}</td>
                      <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                        {s.composites}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-violet-700">
                        {s.patterns}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {s.has_composites
                          ? <CheckCircle className="h-3.5 w-3.5 text-green-500 inline" />
                          : <XCircle    className="h-3.5 w-3.5 text-red-400  inline" />}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {s.has_patterns
                          ? <CheckCircle className="h-3.5 w-3.5 text-green-500 inline" />
                          : <XCircle    className="h-3.5 w-3.5 text-red-400  inline" />}
                      </td>
                      <td className="px-3 py-2 text-gray-400">
                        {s.first_signal ? new Date(s.first_signal).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
