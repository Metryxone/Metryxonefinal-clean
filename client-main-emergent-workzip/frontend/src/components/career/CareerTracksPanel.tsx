import React, { useState, useEffect } from 'react';
import {
  Layers, ChevronDown, ChevronUp, CheckCircle2, Circle,
  Clock, ArrowRight, Loader2, AlertCircle, TrendingUp,
} from 'lucide-react';

function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface CgTrack {
  id: number;
  track_key: string;
  name: string;
  description: string | null;
  function_area: string;
  estimated_years: number;
  is_active: boolean;
}

interface Waypoint {
  step_order: number;
  role_id: number;
  title: string;
  seniority: string;
  function_area: string | null;
  avg_salary_inr: number | null;
  demand_score: number;
  is_optional: boolean;
}

interface TrackWithWaypoints extends CgTrack {
  waypoints: Waypoint[];
}

const FUNCTION_COLORS: Record<string, string> = {
  engineering: 'bg-blue-100 text-blue-700',
  data:        'bg-purple-100 text-purple-700',
  product:     'bg-green-100 text-green-700',
  design:      'bg-pink-100 text-pink-700',
  marketing:   'bg-orange-100 text-orange-700',
  sales:       'bg-yellow-100 text-yellow-700',
  finance:     'bg-emerald-100 text-emerald-700',
  hr:          'bg-teal-100 text-teal-700',
  operations:  'bg-slate-100 text-slate-700',
  leadership:  'bg-indigo-100 text-indigo-700',
};

const SENIORITY_ORDER: Record<string, number> = {
  junior: 1, mid: 2, senior: 3, lead: 4, executive: 5,
};

function fnColor(fn: string): string {
  return FUNCTION_COLORS[fn?.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
}

function fmt(n: number | null): string {
  if (!n) return '—';
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function CareerTracksPanel({ userId }: { userId: string }) {
  const [tracks, setTracks] = useState<TrackWithWaypoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [currentRoleId, setCurrentRoleId] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  useEffect(() => {
    void load();
  }, [userId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [tracksRes, currentRes] = await Promise.all([
        fetch('/api/career/tracks', { headers: authHeader() }),
        fetch('/api/career/current-role', { headers: authHeader() }),
      ]);
      const tracksData = await tracksRes.json() as { ok: boolean; tracks?: CgTrack[] };
      const currentData = await currentRes.json() as { ok: boolean; current_role?: { id: number } };
      if (!tracksData.ok) throw new Error('Failed to load tracks');

      // Load waypoints for each track in parallel
      const rawTracks = tracksData.tracks ?? [];
      const detailed = await Promise.all(rawTracks.map(async (t) => {
        try {
          const r = await fetch(`/api/career/tracks/${t.id}`, { headers: authHeader() });
          const d = await r.json() as { ok: boolean; waypoints?: Waypoint[] };
          return { ...t, waypoints: d.waypoints ?? [] };
        } catch {
          return { ...t, waypoints: [] };
        }
      }));
      setTracks(detailed);
      setCurrentRoleId(currentData.current_role?.id ?? null);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }

  async function followTrack(track: TrackWithWaypoints) {
    const lastWaypoint = [...track.waypoints].sort((a, b) => b.step_order - a.step_order)[0];
    if (!lastWaypoint) return;
    setSaving(track.id);
    try {
      await fetch('/api/career/path', {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_role_id: lastWaypoint.role_id, source: 'track_selected' }),
      });
      setSaved(prev => new Set([...prev, track.id]));
    } catch { /* silent */ }
    finally { setSaving(null); }
  }

  function currentStep(track: TrackWithWaypoints): number | null {
    if (!currentRoleId) return null;
    const wp = track.waypoints.find(w => w.role_id === currentRoleId);
    return wp?.step_order ?? null;
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
      <Loader2 size={20} className="animate-spin" />
      <span className="text-sm">Loading career tracks…</span>
    </div>
  );

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex items-center gap-3">
      <AlertCircle size={18} className="text-red-500 shrink-0" />
      <p className="text-sm text-red-700">{error}</p>
    </div>
  );

  if (!tracks.length) return (
    <div className="text-center py-20 text-gray-400 text-sm">No career tracks loaded yet.</div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Layers size={18} className="text-blue-600" />
            Career Tracks
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Structured progression paths. Select a track to see every waypoint role.
          </p>
        </div>
        <span className="text-xs text-gray-400">{tracks.length} tracks</span>
      </div>

      {/* Track grid */}
      <div className="grid gap-3">
        {tracks.map(track => {
          const isExpanded = expandedId === track.id;
          const step = currentStep(track);
          const isSaved = saved.has(track.id);
          const totalSteps = track.waypoints.filter(w => !w.is_optional).length;
          const currentStepPct = step && totalSteps ? Math.round((step / totalSteps) * 100) : 0;

          return (
            <div key={track.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* Track header */}
              <button
                className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : track.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-gray-900">{track.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${fnColor(track.function_area)}`}>
                        {track.function_area}
                      </span>
                      {step && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                          You are here · Step {step}
                        </span>
                      )}
                    </div>
                    {track.description && (
                      <p className="text-xs text-gray-500 line-clamp-1">{track.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={11} />
                        ~{track.estimated_years} years
                      </span>
                      <span className="text-xs text-gray-400">
                        {track.waypoints.length} roles
                      </span>
                      {step && totalSteps > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-20 h-1.5 rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-green-400"
                              style={{ width: `${currentStepPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400">{currentStepPct}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>
              </button>

              {/* Expanded waypoints */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                  {track.waypoints.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No waypoints available for this track.</p>
                  ) : (
                    <div className="relative">
                      {/* Vertical connector */}
                      <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gray-200" />
                      <div className="space-y-3">
                        {[...track.waypoints]
                          .sort((a, b) => a.step_order - b.step_order)
                          .map((wp, idx) => {
                            const isCurrentRole = wp.role_id === currentRoleId;
                            const isPast = step !== null && wp.step_order < step;
                            return (
                              <div key={idx} className="flex items-start gap-3 relative">
                                <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 border-2
                                  ${isCurrentRole ? 'bg-green-500 border-green-500' :
                                    isPast ? 'bg-gray-300 border-gray-300' :
                                    'bg-white border-gray-300'}`}>
                                  {isCurrentRole ? (
                                    <CheckCircle2 size={14} className="text-white" />
                                  ) : isPast ? (
                                    <CheckCircle2 size={14} className="text-white" />
                                  ) : (
                                    <Circle size={14} className="text-gray-300" />
                                  )}
                                </div>
                                <div className={`flex-1 rounded-lg px-3 py-2.5 border ${
                                  isCurrentRole ? 'bg-green-50 border-green-200' :
                                  isPast ? 'bg-white border-gray-100 opacity-60' :
                                  'bg-white border-gray-100'
                                }`}>
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div>
                                      <span className="text-xs font-semibold text-gray-900">
                                        {wp.title}
                                        {isCurrentRole && <span className="ml-1 text-green-600"> ← You</span>}
                                      </span>
                                      {wp.is_optional && (
                                        <span className="ml-1.5 text-[10px] text-gray-400">(optional)</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 capitalize">
                                        {wp.seniority}
                                      </span>
                                      {wp.avg_salary_inr && (
                                        <span className="text-[10px] text-gray-400">{fmt(wp.avg_salary_inr)}</span>
                                      )}
                                      {wp.demand_score > 0 && (
                                        <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                                          <TrendingUp size={9} />
                                          {Math.round(wp.demand_score)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Follow Track CTA */}
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => followTrack(track)}
                      disabled={saving === track.id || isSaved}
                      className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-60 transition-all"
                      style={{ background: isSaved ? '#16a34a' : '#1D3E8B' }}
                    >
                      {saving === track.id ? (
                        <><Loader2 size={12} className="animate-spin" /> Saving…</>
                      ) : isSaved ? (
                        <><CheckCircle2 size={12} /> Track saved</>
                      ) : (
                        <><ArrowRight size={12} /> Follow this track</>
                      )}
                    </button>
                    <span className="text-[10px] text-gray-400">
                      Sets the final role as your career target
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400 text-center pt-2">
        Track timelines are illustrative. Actual progression depends on your unique profile and market conditions.
      </p>
    </div>
  );
}
