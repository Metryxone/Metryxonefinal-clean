import React from 'react';

export interface TimelinePhase {
  id:          string;
  label:       string;
  weeks:       number;
  color:       string;
  milestones?: string[];
  completed?:  number;   // 0-100 completion pct
}

export interface TimelineMilestone {
  week:   number;
  label:  string;
  color?: string;
}

interface GrowthTimelineProps {
  phases:        TimelinePhase[];
  milestones?:   TimelineMilestone[];
  totalWeeks?:   number;
  currentWeek?:  number;
  width?:        number;
  height?:       number;
  className?:    string;
}

export const GrowthTimeline: React.FC<GrowthTimelineProps> = ({
  phases,
  milestones   = [],
  totalWeeks,
  currentWeek  = 0,
  width        = 600,
  height       = 110,
  className    = '',
}) => {
  const totalW = totalWeeks ?? phases.reduce((s, p) => s + p.weeks, 0);
  if (!totalW) return null;

  const pad     = { l: 12, r: 12, t: 28, b: 28 };
  const barH    = height - pad.t - pad.b;
  const barW    = width - pad.l - pad.r;

  const wToX = (w: number) => pad.l + (w / totalW) * barW;

  /* Phase offsets */
  let offset = 0;
  const phaseRects = phases.map(p => {
    const x = wToX(offset);
    const w = (p.weeks / totalW) * barW;
    offset += p.weeks;
    return { ...p, x, w };
  });

  const trackY   = pad.t + barH / 2;
  const trackH   = Math.round(barH * 0.45);

  return (
    <div className={className} style={{ fontFamily: 'Inter, sans-serif', overflowX: 'auto' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Track background */}
        <rect x={pad.l} y={trackY - trackH / 2} width={barW} height={trackH} rx={trackH / 2} fill="#f1f5f9" />

        {/* Phase fills */}
        {phaseRects.map((p, i) => {
          const fillW = p.completed !== undefined ? p.w * (p.completed / 100) : p.w;
          const isFirst = i === 0;
          const isLast  = i === phaseRects.length - 1;
          const rx      = trackH / 2;
          return (
            <g key={p.id}>
              <rect
                x={p.x} y={trackY - trackH / 2}
                width={fillW} height={trackH}
                rx={isFirst ? rx : 0}
                style={{ borderTopRightRadius: isLast ? rx : 0, borderBottomRightRadius: isLast ? rx : 0 }}
                fill={p.color} opacity={0.9}
              />
              {/* Phase label */}
              <text x={p.x + p.w / 2} y={pad.t - 6} textAnchor="middle"
                fontSize={9.5} fontWeight={600} fill={p.color}>
                {p.label}
              </text>
              {/* Week count */}
              <text x={p.x + p.w / 2} y={height - pad.b + 14} textAnchor="middle"
                fontSize={9} fill="#94a3b8">
                {p.weeks}w
              </text>
              {/* Phase divider */}
              {i < phaseRects.length - 1 && (
                <line x1={p.x + p.w} y1={trackY - trackH / 2 - 4}
                  x2={p.x + p.w} y2={trackY + trackH / 2 + 4}
                  stroke="#fff" strokeWidth={2} />
              )}
            </g>
          );
        })}

        {/* Milestones */}
        {milestones.map((m, i) => {
          const mx    = wToX(m.week);
          const color = m.color ?? '#344E86';
          return (
            <g key={i}>
              <circle cx={mx} cy={trackY} r={5} fill={color} stroke="#fff" strokeWidth={1.5} />
              <text x={mx} y={trackY + trackH / 2 + 14} textAnchor="middle"
                fontSize={8.5} fill={color} fontWeight={500}>
                {m.label}
              </text>
            </g>
          );
        })}

        {/* Current week marker */}
        {currentWeek > 0 && currentWeek <= totalW && (() => {
          const cx = wToX(currentWeek);
          return (
            <g>
              <line x1={cx} y1={trackY - trackH / 2 - 6} x2={cx} y2={trackY + trackH / 2 + 6}
                stroke="#344E86" strokeWidth={2} strokeDasharray="3,2" />
              <polygon points={`${cx},${trackY - trackH / 2 - 6} ${cx - 4},${trackY - trackH / 2 - 14} ${cx + 4},${trackY - trackH / 2 - 14}`}
                fill="#344E86" />
              <text x={cx} y={trackY - trackH / 2 - 16} textAnchor="middle"
                fontSize={9} fill="#344E86" fontWeight={600}>Now</text>
            </g>
          );
        })()}

        {/* Week axis markers */}
        {[0, Math.round(totalW * 0.25), Math.round(totalW * 0.5), Math.round(totalW * 0.75), totalW].map(w => (
          <text key={w} x={wToX(w)} y={height - pad.b + 14} textAnchor="middle" fontSize={8} fill="#cbd5e1">
            W{w}
          </text>
        ))}
      </svg>
    </div>
  );
};

export default GrowthTimeline;
