import React, { useEffect, useState, useRef } from "react";
import { X, TrendingUp, TrendingDown, Minus, Zap, Star, RefreshCw, AlertTriangle, ChevronRight } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface SparkPoint {
  date: string;
  composite: number;
  behavioural: number | null;
  emotional: number | null;
  resilience: number | null;
  milestones: string[];
}

interface Momentum {
  momentum_state: string;
  momentum_score: number;
  growth_velocity: number;
  stability_score: number;
  sustainability_score: number;
  trend_direction: string;
  forecast_30d: number;
  computed_at: string;
}

interface Narrative {
  narrative_type: string;
  title: string;
  content: string;
  tone: string;
  key_themes: string[];
  generated_at: string;
}

interface IdentityCheckpoint {
  checkpoint_date: string;
  confidence_score: number;
  self_efficacy_score: number;
  aspiration_score: number;
  motivation_score: number;
  identity_coherence: number;
  breakthrough_flag: boolean;
  shift_detected: boolean;
  notes: string | null;
}

interface JourneyData {
  user_id: string;
  has_data: boolean;
  checkpoint_count: number;
  sparkline: SparkPoint[];
  momentum: Momentum | null;
  narratives: Narrative[];
  latest_narrative: Narrative | null;
  identity: {
    latest: IdentityCheckpoint | null;
    breakthroughs: IdentityCheckpoint[];
    identity_shifts: IdentityCheckpoint[];
    history: IdentityCheckpoint[];
  };
}

// ── Momentum config ────────────────────────────────────────────────────────
const MOMENTUM_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType; explanation: string }> = {
  acceleration: {
    label: "Accelerating",
    color: "#10B981",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    icon: TrendingUp,
    explanation: "Your development is picking up pace — scores are climbing and growth signals are strong.",
  },
  stable: {
    label: "Stable",
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    icon: Minus,
    explanation: "Your trajectory is steady and consistent — a solid foundation for the next growth push.",
  },
  recovery: {
    label: "Recovery",
    color: "#F59E0B",
    bg: "#FFFBEB",
    border: "#FDE68A",
    icon: RefreshCw,
    explanation: "You are navigating a recovery arc. Resilience is building and momentum is returning.",
  },
  stagnation: {
    label: "Plateau",
    color: "#6B7280",
    bg: "#F9FAFB",
    border: "#E5E7EB",
    icon: Minus,
    explanation: "Growth has paused. This often precedes a breakthrough — focused effort can break the cycle.",
  },
  breakthrough: {
    label: "Breakthrough",
    color: "#8B5CF6",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    icon: Zap,
    explanation: "A rare developmental window — hidden capabilities are emerging at an accelerated rate.",
  },
  collapse: {
    label: "Rebuilding",
    color: "#EF4444",
    bg: "#FEF2F2",
    border: "#FECACA",
    icon: AlertTriangle,
    explanation: "Developmental stress detected. Support and targeted intervention can restore momentum.",
  },
};

// ── Sparkline SVG ──────────────────────────────────────────────────────────
function Sparkline({ points, color = "#344E86" }: { points: SparkPoint[]; color?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 280;
  const H = 72;
  const PAD = 8;

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-18 rounded-xl" style={{ height: H, background: "#F9FAFB", border: "1px dashed #E5E7EB" }}>
        <p className="text-[12px]" style={{ color: "#9CA3AF" }}>No timeline data yet — complete more assessments to see your journey.</p>
      </div>
    );
  }

  const values = points.map(p => p.composite);
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 100);
  const range = maxV - minV || 1;
  const xStep = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;

  const toX = (i: number) => PAD + i * xStep;
  const toY = (v: number) => H - PAD - ((v - minV) / range) * (H - PAD * 2);

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.composite).toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${toX(points.length - 1).toFixed(1)},${H} L${PAD},${H} Z`;

  const hasMilestone = (pt: SparkPoint) => pt.milestones && pt.milestones.length > 0;

  return (
    <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, overflow: "visible" }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* 75-threshold dashed line */}
      <line
        x1={PAD} y1={toY(75).toFixed(1)}
        x2={W - PAD} y2={toY(75).toFixed(1)}
        stroke="#E5E7EB" strokeWidth="1" strokeDasharray="3 3"
      />
      <text x={W - PAD - 2} y={toY(75) - 3} fontSize="8" fill="#D1D5DB" textAnchor="end">75</text>
      {/* Area fill */}
      <path d={areaD} fill="url(#sparkGrad)" />
      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {points.map((pt, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(pt.composite)} r={hasMilestone(pt) ? 5 : 3.5} fill={hasMilestone(pt) ? "#F59E0B" : color} stroke="#fff" strokeWidth="1.5" />
          {hasMilestone(pt) && (
            <text x={toX(i)} y={toY(pt.composite) - 8} fontSize="8" textAnchor="middle" fill="#F59E0B">★</text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ── Date helpers ────────────────────────────────────────────────────────────
function fmtDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtShortDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Score bar ───────────────────────────────────────────────────────────────
function ScoreBar({ label, value, color = "#344E86" }: { label: string; value: number | null; color?: string }) {
  const pct = Math.round(Math.min(100, Math.max(0, value ?? 0)));
  return (
    <div className="mb-2.5">
      <div className="flex justify-between mb-1">
        <span className="text-[12px]" style={{ color: "#6B7280" }}>{label}</span>
        <span className="text-[12px] font-semibold" style={{ color: pct >= 65 ? "#10B981" : pct >= 40 ? "#F59E0B" : "#EF4444" }}>{value !== null ? pct : "—"}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "#F3F4F6" }}>
        <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Tone badge ─────────────────────────────────────────────────────────────
function ToneBadge({ tone }: { tone: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    celebratory: { label: "Celebratory", color: "#D97706", bg: "#FFFBEB" },
    supportive:  { label: "Supportive",  color: "#2563EB", bg: "#EFF6FF" },
    analytical:  { label: "Analytical",  color: "#6B7280", bg: "#F9FAFB" },
    urgent:      { label: "Action-ready",color: "#EF4444", bg: "#FEF2F2" },
  };
  const cfg = map[tone] || map.analytical;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
      {cfg.label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
interface GrowthJourneyModalProps {
  sessionId: string;
  userName?: string;
  onClose: () => void;
}

export default function GrowthJourneyModal({ sessionId, userName, onClose }: GrowthJourneyModalProps) {
  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "narrative">("overview");

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/lde/journey/session/${encodeURIComponent(sessionId)}`)
      .then(async r => {
        if (!r.ok) {
          const body: Record<string, unknown> = await r.json().catch(() => ({}));
          const msg = typeof body.error === "string" ? body.error : `Request failed: ${r.status}`;
          throw new Error(msg);
        }
        return r.json();
      })
      .then((d: JourneyData) => {
        if (!d || typeof d !== "object" || !("has_data" in d)) {
          throw new Error("Unexpected response format");
        }
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load your journey data. Please try again.");
        setLoading(false);
      });
  }, [sessionId]);

  const mom = data?.momentum;
  const momCfg = mom ? (MOMENTUM_CONFIG[mom.momentum_state] || MOMENTUM_CONFIG.stable) : null;
  const name = userName?.split(" ")[0] || "You";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(17,24,39,0.55)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md mx-auto rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: "#FFFFFF", maxHeight: "92dvh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(17,24,39,0.22)" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid #E8EBF4" }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#344E86" }}>
                <TrendingUp size={14} color="#fff" />
              </div>
              <span className="text-[15px] font-bold" style={{ color: "#111827", fontFamily: "'Plus Jakarta Sans','DM Sans',sans-serif" }}>Your Growth Journey</span>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100">
              <X size={15} color="#9CA3AF" />
            </button>
          </div>
          <p className="text-[12px] mt-1" style={{ color: "#9CA3AF" }}>
            {name}'s personal development trajectory — powered by Longitudinal Intelligence
          </p>
          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            {(["overview", "timeline", "narrative"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 h-8 rounded-lg text-[12px] font-semibold transition-all capitalize"
                style={{
                  background: activeTab === tab ? "#344E86" : "#F3F4F6",
                  color: activeTab === tab ? "#fff" : "#6B7280",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#344E86", borderTopColor: "transparent" }} />
              <p className="text-[13px]" style={{ color: "#9CA3AF" }}>Loading your journey…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
              <AlertTriangle size={24} color="#F59E0B" />
              <p className="text-[14px]" style={{ color: "#6B7280" }}>{error}</p>
              <button onClick={onClose} className="text-[13px] px-4 py-2 rounded-lg" style={{ background: "#344E86", color: "#fff" }}>Close</button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* ── OVERVIEW TAB ── */}
              {activeTab === "overview" && (
                <div className="px-5 pt-4 pb-6 space-y-4">
                  {/* Momentum badge */}
                  {momCfg && mom ? (
                    <div className="rounded-xl p-4" style={{ background: momCfg.bg, border: `1.5px solid ${momCfg.border}` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: momCfg.color }}>
                          <momCfg.icon size={14} color="#fff" />
                        </div>
                        <div>
                          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: momCfg.color }}>Momentum State</span>
                          <p className="text-[16px] font-bold leading-tight" style={{ color: "#111827" }}>{momCfg.label}</p>
                        </div>
                      </div>
                      <p className="text-[13px] leading-relaxed" style={{ color: "#374151" }}>{momCfg.explanation}</p>
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {[
                          { label: "Growth Velocity", value: `${Math.round((mom.growth_velocity || 0) * 100)}%` },
                          { label: "Stability",       value: `${Math.round((mom.stability_score || 0) * 100)}%` },
                          { label: "30-Day Forecast", value: `${Math.round((mom.forecast_30d || 0) * 100)}%` },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-lg px-2 py-2 text-center" style={{ background: "rgba(255,255,255,0.7)" }}>
                            <p className="text-[15px] font-bold" style={{ color: momCfg.color }}>{value}</p>
                            <p className="text-[10px] mt-0.5 leading-tight" style={{ color: "#6B7280" }}>{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl p-4" style={{ background: "#F9FAFB", border: "1px dashed #E5E7EB" }}>
                      <p className="text-[13px] text-center" style={{ color: "#9CA3AF" }}>Momentum data will appear after your first full assessment is processed.</p>
                    </div>
                  )}

                  {/* Sparkline preview */}
                  <div className="rounded-xl p-4" style={{ background: "#FFFFFF", border: "1px solid #E8EBF4" }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[12px] font-semibold" style={{ color: "#374151" }}>Score Trajectory</p>
                      {data.sparkline.length > 0 && (
                        <button
                          onClick={() => setActiveTab("timeline")}
                          className="flex items-center gap-1 text-[11px] font-medium"
                          style={{ color: "#344E86" }}
                        >
                          View full <ChevronRight size={11} />
                        </button>
                      )}
                    </div>
                    <Sparkline points={data.sparkline} color="#344E86" />
                    {data.sparkline.length > 1 && (
                      <div className="flex justify-between mt-2">
                        <span className="text-[10px]" style={{ color: "#9CA3AF" }}>{fmtShortDate(data.sparkline[0].date)}</span>
                        <span className="text-[10px]" style={{ color: "#9CA3AF" }}>{fmtShortDate(data.sparkline[data.sparkline.length - 1].date)}</span>
                      </div>
                    )}
                  </div>

                  {/* Breakthrough & identity shift highlights */}
                  {(data.identity.breakthroughs.length > 0 || data.identity.identity_shifts.length > 0) && (
                    <div className="rounded-xl p-4" style={{ background: "#FFFFFF", border: "1px solid #E8EBF4" }}>
                      <p className="text-[12px] font-semibold mb-3" style={{ color: "#374151" }}>Key Moments</p>
                      <div className="space-y-2">
                        {data.identity.breakthroughs.slice(0, 2).map((b, i) => (
                          <div key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2.5" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                            <Star size={13} color="#D97706" className="mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[12px] font-semibold" style={{ color: "#92400E" }}>Breakthrough detected</p>
                              <p className="text-[11px] mt-0.5" style={{ color: "#9CA3AF" }}>{fmtDate(b.checkpoint_date)}</p>
                              {b.notes && <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#6B7280" }}>{b.notes}</p>}
                            </div>
                          </div>
                        ))}
                        {data.identity.identity_shifts.slice(0, 2).map((s, i) => (
                          <div key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2.5" style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
                            <Zap size={13} color="#7C3AED" className="mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[12px] font-semibold" style={{ color: "#5B21B6" }}>Identity shift detected</p>
                              <p className="text-[11px] mt-0.5" style={{ color: "#9CA3AF" }}>{fmtDate(s.checkpoint_date)}</p>
                              {s.notes && <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "#6B7280" }}>{s.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Identity dimension scores */}
                  {data.identity.latest && (
                    <div className="rounded-xl p-4" style={{ background: "#FFFFFF", border: "1px solid #E8EBF4" }}>
                      <p className="text-[12px] font-semibold mb-3" style={{ color: "#374151" }}>Identity Dimensions</p>
                      <ScoreBar label="Confidence"      value={data.identity.latest.confidence_score !== null ? Math.round(data.identity.latest.confidence_score * 100) : null} color="#344E86" />
                      <ScoreBar label="Self-Efficacy"   value={data.identity.latest.self_efficacy_score !== null ? Math.round(data.identity.latest.self_efficacy_score * 100) : null} color="#2563EB" />
                      <ScoreBar label="Aspiration"      value={data.identity.latest.aspiration_score !== null ? Math.round(data.identity.latest.aspiration_score * 100) : null} color="#8B5CF6" />
                      <ScoreBar label="Motivation"      value={data.identity.latest.motivation_score !== null ? Math.round(data.identity.latest.motivation_score * 100) : null} color="#10B981" />
                      <ScoreBar label="Identity Coherence" value={data.identity.latest.identity_coherence !== null ? Math.round(data.identity.latest.identity_coherence * 100) : null} color="#F59E0B" />
                    </div>
                  )}

                  {/* Latest narrative teaser */}
                  {data.latest_narrative && (
                    <div className="rounded-xl p-4" style={{ background: "#F9FAFB", border: "1px solid #E8EBF4" }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[12px] font-semibold" style={{ color: "#374151" }}>Your Development Narrative</p>
                        <ToneBadge tone={data.latest_narrative.tone} />
                      </div>
                      <p className="text-[13px] leading-relaxed" style={{ color: "#374151" }}>
                        {data.latest_narrative.content.slice(0, 200)}{data.latest_narrative.content.length > 200 ? "…" : ""}
                      </p>
                      {data.latest_narrative.content.length > 200 && (
                        <button onClick={() => setActiveTab("narrative")} className="text-[12px] mt-2 font-medium" style={{ color: "#344E86" }}>
                          Read full narrative →
                        </button>
                      )}
                    </div>
                  )}

                  {/* Empty state */}
                  {!data.has_data && !data.latest_narrative && !momCfg && (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#F3F4F6" }}>
                        <TrendingUp size={24} color="#9CA3AF" />
                      </div>
                      <p className="text-[15px] font-semibold" style={{ color: "#374151" }}>Your journey is just beginning</p>
                      <p className="text-[13px] leading-relaxed max-w-xs" style={{ color: "#9CA3AF" }}>
                        Complete more CAPADEX assessments to unlock your longitudinal growth insights, narrative, and momentum tracking.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── TIMELINE TAB ── */}
              {activeTab === "timeline" && (
                <div className="px-5 pt-4 pb-6">
                  <div className="rounded-xl p-4 mb-4" style={{ background: "#FFFFFF", border: "1px solid #E8EBF4" }}>
                    <p className="text-[12px] font-semibold mb-4" style={{ color: "#374151" }}>
                      Composite Development Score — {data.sparkline.length} checkpoint{data.sparkline.length !== 1 ? "s" : ""}
                    </p>
                    <Sparkline points={data.sparkline} color="#344E86" />
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: "#F59E0B", display: "inline-block" }} />
                        <span className="text-[10px]" style={{ color: "#9CA3AF" }}>Milestone</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="3 3"/></svg>
                        <span className="text-[10px]" style={{ color: "#9CA3AF" }}>75 Threshold</span>
                      </div>
                    </div>
                  </div>

                  {data.sparkline.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <p className="text-[14px]" style={{ color: "#9CA3AF" }}>No timeline checkpoints yet. Complete your next assessment to start tracking.</p>
                    </div>
                  )}

                  {/* Checkpoint list */}
                  {data.sparkline.length > 0 && (
                    <div className="space-y-3">
                      {[...data.sparkline].reverse().map((pt, i) => {
                        const hasMilestone = pt.milestones && pt.milestones.length > 0;
                        const scoreColor = pt.composite >= 75 ? "#10B981" : pt.composite >= 50 ? "#F59E0B" : "#EF4444";
                        return (
                          <div key={i} className="rounded-xl px-4 py-3" style={{ background: "#FFFFFF", border: `1px solid ${hasMilestone ? "#FDE68A" : "#E8EBF4"}` }}>
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  {hasMilestone && <Star size={11} color="#D97706" />}
                                  <p className="text-[13px] font-semibold" style={{ color: "#374151" }}>{fmtDate(pt.date)}</p>
                                </div>
                                {hasMilestone && (
                                  <p className="text-[11px] mt-0.5" style={{ color: "#9CA3AF" }}>
                                    Milestones: {pt.milestones.join(", ")}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-[20px] font-bold" style={{ color: scoreColor }}>{pt.composite}</p>
                                <p className="text-[10px]" style={{ color: "#9CA3AF" }}>composite</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                              {[
                                { label: "Behavioural", v: pt.behavioural },
                                { label: "Emotional",   v: pt.emotional },
                                { label: "Resilience",  v: pt.resilience },
                              ].map(({ label, v }) => (
                                <div key={label} className="rounded-md px-2 py-1.5 text-center" style={{ background: "#F9FAFB" }}>
                                  <p className="text-[12px] font-semibold" style={{ color: v !== null ? scoreColor : "#9CA3AF" }}>
                                    {v !== null ? Math.round(v) : "—"}
                                  </p>
                                  <p className="text-[10px]" style={{ color: "#9CA3AF" }}>{label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── NARRATIVE TAB ── */}
              {activeTab === "narrative" && (
                <div className="px-5 pt-4 pb-6 space-y-4">
                  {data.narratives.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <p className="text-[14px]" style={{ color: "#9CA3AF" }}>No narratives have been generated yet. Your personal development story will appear here as you progress through assessments.</p>
                    </div>
                  )}
                  {data.narratives.map((n, i) => (
                    <div key={i} className="rounded-xl p-4" style={{ background: "#FFFFFF", border: "1px solid #E8EBF4" }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-[13px] font-bold leading-snug" style={{ color: "#111827" }}>{n.title}</p>
                        <ToneBadge tone={n.tone} />
                      </div>
                      <p className="text-[13px] leading-relaxed mb-3" style={{ color: "#374151" }}>{n.content}</p>
                      {n.key_themes && n.key_themes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {n.key_themes.map((theme, ti) => (
                            <span key={ti} className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#F3F4F6", color: "#6B7280" }}>
                              {theme.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] mt-2" style={{ color: "#9CA3AF" }}>{fmtDate(n.generated_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 shrink-0" style={{ borderTop: "1px solid #E8EBF4", background: "#FAFAFA" }}>
          <div className="flex items-center justify-between">
            <p className="text-[11px]" style={{ color: "#9CA3AF" }}>Powered by MetryxOne LDE Intelligence</p>
            <button
              onClick={onClose}
              className="h-8 px-4 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90"
              style={{ background: "#344E86", color: "#fff" }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
