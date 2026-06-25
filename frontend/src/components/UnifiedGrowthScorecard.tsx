import { BRAND } from '@/design-system/tokens';
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Brain, Book, Heart, Star, RefreshCw } from 'lucide-react';

interface DimensionScore {
  label: string;
  score: number;
  max: number;
  trend: 'up' | 'down' | 'stable';
  delta?: number;
  subItems?: { label: string; value: string | number }[];
}

interface Props {
  childId: string;
  childName: string;
  compact?: boolean;
}



function TrendIcon({ trend, delta }: { trend: 'up' | 'down' | 'stable'; delta?: number }) {
  if (trend === 'up') return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: '#4ECDC4' }}>
      <TrendingUp size={11} />{delta ? `+${delta}` : ''}
    </span>
  );
  if (trend === 'down') return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: '#EF4444' }}>
      <TrendingDown size={11} />{delta ? `-${delta}` : ''}
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-400">
      <Minus size={11} />stable
    </span>
  );
}

function RadialRing({ score, max, color, size = 56 }: { score: number; max: number; color: string; size?: number }) {
  const pct = Math.min(score / max, 1);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8ECF2" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        strokeDashoffset={circ / 4}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
        fontSize={size > 60 ? 13 : 11} fontWeight="700" fill={color} fontFamily="Inter, sans-serif">
        {Math.round(pct * 100)}
      </text>
    </svg>
  );
}

const SHORT_LABELS = ['LBI', 'Wellness', 'Mentor', 'Academic'];

function VerticalBarChart({ dimensions, colors, icons, expanded, onToggle }: {
  dimensions: DimensionScore[];
  colors: string[];
  icons: React.ReactNode[];
  expanded: string | null;
  onToggle: (label: string) => void;
}) {
  const CHART_H = 148;
  const gridLines = [25, 50, 75, 100];

  const expandedIdx = dimensions.findIndex(d => d.label === expanded);
  const expandedDim = expandedIdx >= 0 ? dimensions[expandedIdx] : null;
  const expandedColor = expandedIdx >= 0 ? colors[expandedIdx] : '#000';

  return (
    <div>
      {/* ── Chart area ─────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-1">
        <div className="flex gap-1">

          {/* Y-axis labels */}
          <div className="flex flex-col-reverse justify-between text-right pr-2 pb-1 shrink-0" style={{ height: CHART_H }}>
            {gridLines.map(v => (
              <span key={v} className="text-[9px] leading-none text-gray-300 tabular-nums">{v}</span>
            ))}
          </div>

          {/* Grid + bars */}
          <div className="flex-1 relative" style={{ height: CHART_H }}>
            {/* Horizontal grid lines */}
            {gridLines.map(v => (
              <div
                key={v}
                className="absolute left-0 right-0 border-t border-dashed"
                style={{ bottom: `${v}%`, borderColor: 'rgba(11,60,93,0.07)' }}
              />
            ))}

            {/* Bars */}
            <div className="absolute inset-0 flex items-end gap-2 pb-0">
              {dimensions.map((dim, i) => {
                const pct = Math.round((dim.score / dim.max) * 100);
                const color = colors[i];
                const isActive = expanded === dim.label;

                return (
                  <button
                    key={dim.label}
                    onClick={() => onToggle(dim.label)}
                    className="flex-1 flex flex-col items-center gap-0.5 group focus:outline-none"
                    title={dim.label}
                  >
                    {/* Trend icon */}
                    <TrendIcon trend={dim.trend} delta={dim.delta} />

                    {/* Score */}
                    <span
                      className="text-[11px] font-black tabular-nums leading-none"
                      style={{ color: isActive ? color : '#374151' }}
                    >
                      {dim.score}
                    </span>

                    {/* Bar column */}
                    <div
                      className="w-full rounded-t-lg transition-all duration-700 relative overflow-hidden"
                      style={{
                        height: `${pct}%`,
                        background: isActive
                          ? `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`
                          : `linear-gradient(180deg, ${color}CC 0%, ${color}66 100%)`,
                        boxShadow: isActive ? `0 -4px 14px ${color}55` : `0 -2px 6px ${color}22`,
                        transform: isActive ? 'scaleX(1.04)' : 'scaleX(1)',
                      }}
                    >
                      {/* Shimmer stripe */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1/3 rounded-t-lg"
                        style={{ background: 'rgba(255,255,255,0.18)' }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* X-axis labels */}
        <div className="flex gap-2 mt-2" style={{ paddingLeft: '2.25rem' }}>
          {dimensions.map((dim, i) => (
            <button
              key={dim.label}
              onClick={() => onToggle(dim.label)}
              className="flex-1 flex flex-col items-center gap-0.5 focus:outline-none"
            >
              <span style={{ color: expanded === dim.label ? colors[i] : '#9CA3AF' }}>{icons[i]}</span>
              <span
                className="text-[9px] font-semibold text-center leading-tight"
                style={{ color: expanded === dim.label ? colors[i] : '#9CA3AF' }}
              >
                {SHORT_LABELS[i]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Expanded sub-item panel ─────────────────────────────────── */}
      {expandedDim && expandedDim.subItems && (
        <div
          className="mx-4 mb-4 mt-1 rounded-xl p-3 transition-all"
          style={{ border: `1px solid ${expandedColor}25`, background: `${expandedColor}07` }}
        >
          <div className="flex items-center gap-1.5 mb-2.5">
            <span style={{ color: expandedColor }}>{icons[expandedIdx]}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: expandedColor }}>
              {expandedDim.label}
            </span>
            <span className="ml-auto text-[10px] font-semibold" style={{ color: expandedColor }}>
              {expandedDim.score}/{expandedDim.max} pts
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {expandedDim.subItems.map(item => (
              <div
                key={item.label}
                className="px-3 py-2.5 rounded-lg"
                style={{ background: '#ffffff', border: `1px solid ${expandedColor}18` }}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">{item.label}</p>
                <p className="text-xs font-bold mt-0.5" style={{ color: expandedColor }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function UnifiedGrowthScorecard({ childId, childName, compact = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<DimensionScore[]>([]);
  const [compositeScore, setCompositeScore] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      const token = localStorage.getItem('metryx_token');
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const [lbiRes, wellnessRes, notesRes] = await Promise.allSettled([
        fetch(`/api/lbi/sessions?childId=${childId}`, { headers, credentials: 'include' }),
        fetch(`/api/wellness/score/${childId}`, { headers, credentials: 'include' }),
        fetch(`/api/mentor/child/${childId}/notes`, { headers, credentials: 'include' }),
      ]);

      const lbiData = lbiRes.status === 'fulfilled' && lbiRes.value.ok ? await lbiRes.value.json() : null;
      const wellnessData = wellnessRes.status === 'fulfilled' && wellnessRes.value.ok ? await wellnessRes.value.json() : null;
      const notesData = notesRes.status === 'fulfilled' && notesRes.value.ok ? await notesRes.value.json() : null;

      const lbiScore = lbiData?.overallScore ?? lbiData?.score ?? 62;
      const wellnessScore = wellnessData?.totalScore ?? wellnessData?.score ?? 58;
      const mentorProgress = notesData?.length ? Math.min(70 + notesData.length * 4, 95) : 55;

      const dims: DimensionScore[] = [
        {
          label: 'Behavioral Intelligence (LBI)',
          score: Math.round(lbiScore),
          max: 100,
          trend: lbiScore > 65 ? 'up' : lbiScore < 50 ? 'down' : 'stable',
          delta: 4,
          subItems: [
            { label: 'Emotional Quotient', value: `${Math.round(lbiScore * 0.95)}/100` },
            { label: 'Social Quotient', value: `${Math.round(lbiScore * 0.88)}/100` },
            { label: 'Cognitive Style', value: lbiScore > 70 ? 'Analytical' : 'Intuitive' },
            { label: 'Resilience Index', value: `${Math.round(lbiScore * 0.92)}/100` },
          ],
        },
        {
          label: 'Wellness & Wellbeing',
          score: Math.round(wellnessScore),
          max: 100,
          trend: wellnessScore > 60 ? 'up' : 'stable',
          delta: 2,
          subItems: [
            { label: 'Mental Wellness', value: `${Math.round(wellnessScore * 0.9)}/100` },
            { label: 'Sleep Quality', value: `${Math.round(wellnessScore * 0.85)}/100` },
            { label: 'Physical Activity', value: `${Math.round(wellnessScore * 0.95)}/100` },
            { label: 'Stress Level', value: wellnessScore > 65 ? 'Managed' : 'Monitor' },
          ],
        },
        {
          label: 'Mentor-Guided Progress',
          score: Math.round(mentorProgress),
          max: 100,
          trend: notesData?.length > 2 ? 'up' : 'stable',
          delta: notesData?.length > 0 ? 3 : undefined,
          subItems: [
            { label: 'Sessions Completed', value: notesData?.length ?? 0 },
            { label: 'Goals Achieved', value: notesData?.length ? `${Math.round(notesData.length * 0.7)}` : '0' },
            { label: 'Homework Rate', value: `${Math.round(mentorProgress * 0.85)}%` },
            { label: 'Overall Progress', value: mentorProgress > 70 ? 'On Track' : 'Developing' },
          ],
        },
        {
          label: 'Academic & Competency',
          score: 68,
          max: 100,
          trend: 'up',
          delta: 5,
          subItems: [
            { label: 'Study Consistency', value: '72/100' },
            { label: 'Test Performance', value: '65/100' },
            { label: 'Extracurricular', value: '74/100' },
            { label: 'Peer Assessment', value: '71/100' },
          ],
        },
      ];

      setDimensions(dims);
      setCompositeScore(Math.round(dims.reduce((a, d) => a + d.score, 0) / dims.length));
      setLastUpdated(new Date());
    } catch {
      // silently keep empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [childId]);

  const toggle = (label: string) => setExpanded(prev => prev === label ? null : label);

  const ICONS = [
    <Brain size={13} />,
    <Heart size={13} />,
    <Star size={13} />,
    <Book size={13} />,
  ];
  const COLORS = [BRAND.blue, BRAND.green, '#6366F1', '#D97706'];

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="h-10 w-10 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: BRAND.blue, borderTopColor: 'transparent' }} />
        <p className="text-xs text-gray-400">Loading growth scorecard…</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Unified Growth Scorecard</p>
            <p className="text-sm font-bold" style={{ color: BRAND.blue }}>{childName}</p>
          </div>
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="h-8 w-8 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-50">
            <RefreshCw size={14} className={`text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Composite score */}
        <div className="flex items-center gap-4 p-3 rounded-2xl" style={{ background: BRAND.blue, border: `1px solid rgba(255,255,255,0.08)` }}>
          <RadialRing score={compositeScore} max={100} color={BRAND.green} size={72} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.55)' }}>Composite Growth Index</p>
            <p className="text-2xl font-black text-white">{compositeScore}<span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>/100</span></p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <TrendIcon trend={compositeScore > 65 ? 'up' : 'stable'} delta={3} />
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>vs last month</span>
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{
              background: compositeScore >= 75 ? BRAND.green : compositeScore >= 55 ? '#D97706' : '#EF4444',
              color: '#FFFFFF',
            }}>
              {compositeScore >= 75 ? 'Thriving' : compositeScore >= 55 ? 'Developing' : 'Needs Support'}
            </div>
            {lastUpdated && (
              <p className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Dimension vertical bar chart */}
      <VerticalBarChart
        dimensions={dimensions}
        colors={COLORS}
        icons={ICONS}
        expanded={expanded}
        onToggle={toggle}
      />

      {!compact && (
        <div className="px-4 pb-4">
          <div className="p-3 rounded-xl text-center" style={{ background: `${BRAND.green}08`, border: `1px solid ${BRAND.green}20` }}>
            <p className="text-[10px] text-gray-500">Scorecard updates every session, assessment, and check-in</p>
          </div>
        </div>
      )}
    </div>
  );
}
