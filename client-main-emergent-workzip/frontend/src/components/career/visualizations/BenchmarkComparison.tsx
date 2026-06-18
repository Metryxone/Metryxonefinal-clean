import React from 'react';

export interface BenchmarkBar {
  label:       string;
  userValue:   number;
  benchValue:  number;
  maxValue?:   number;
  unit?:       string;
  userColor?:  string;
  benchColor?: string;
}

interface BenchmarkComparisonProps {
  bars:        BenchmarkBar[];
  width?:      number;
  barHeight?:  number;
  gap?:        number;
  showValues?: boolean;
  showDelta?:  boolean;
  title?:      string;
  className?:  string;
}

export const BenchmarkComparison: React.FC<BenchmarkComparisonProps> = ({
  bars,
  width      = 480,
  barHeight  = 18,
  gap        = 14,
  showValues = true,
  showDelta  = true,
  title,
  className  = '',
}) => {
  const labelW  = 150;
  const barW    = width - labelW - 80;
  const rowH    = barHeight * 2 + 6 + gap;
  const totalH  = bars.length * rowH + 40;

  return (
    <div className={className} style={{ fontFamily: 'Inter, sans-serif' }}>
      {title && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#344E86', marginBottom: 8 }}>{title}</div>
      )}
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 11 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}>
          <span style={{ width: 14, height: 8, background: '#344E86', borderRadius: 2, display: 'inline-block' }} />
          You
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}>
          <span style={{ width: 14, height: 8, background: '#cbd5e1', borderRadius: 2, display: 'inline-block' }} />
          Benchmark
        </span>
      </div>
      <svg width={width} height={totalH} viewBox={`0 0 ${width} ${totalH}`}>
        {bars.map((bar, i) => {
          const y        = 20 + i * rowH;
          const max      = bar.maxValue ?? Math.max(bar.userValue, bar.benchValue, 1) * 1.2;
          const userW    = Math.max(4, (bar.userValue / max) * barW);
          const benchW   = Math.max(4, (bar.benchValue / max) * barW);
          const uColor   = bar.userColor ?? '#344E86';
          const bColor   = bar.benchColor ?? '#cbd5e1';
          const delta    = bar.userValue - bar.benchValue;
          const deltaColor = delta >= 0 ? '#16a34a' : '#ef4444';
          const unit     = bar.unit ?? '';

          return (
            <g key={i}>
              {/* Row label */}
              <text x={labelW - 6} y={y + barHeight / 2 + 3} textAnchor="end"
                fontSize={11} fill="#374151" fontWeight={500}>
                {bar.label}
              </text>

              {/* User bar */}
              <rect x={labelW} y={y} width={userW} height={barHeight} rx={3} fill={uColor} />
              {showValues && (
                <text x={labelW + userW + 5} y={y + barHeight / 2 + 4} fontSize={10} fill={uColor} fontWeight={600}>
                  {bar.userValue}{unit}
                </text>
              )}

              {/* Benchmark bar */}
              <rect x={labelW} y={y + barHeight + 4} width={benchW} height={barHeight} rx={3} fill={bColor} />
              {showValues && (
                <text x={labelW + benchW + 5} y={y + barHeight * 1.5 + 8} fontSize={10} fill="#94a3b8" fontWeight={500}>
                  {bar.benchValue}{unit}
                </text>
              )}

              {/* Delta badge */}
              {showDelta && (
                <g>
                  <rect
                    x={width - 62} y={y + 3}
                    width={58} height={barHeight * 2 + 2}
                    rx={4} fill={delta >= 0 ? '#dcfce7' : '#fee2e2'}
                  />
                  <text
                    x={width - 33} y={y + barHeight + 6}
                    textAnchor="middle" fontSize={10} fill={deltaColor} fontWeight={700}
                  >
                    {delta >= 0 ? '+' : ''}{delta.toFixed(delta % 1 ? 1 : 0)}{unit}
                  </text>
                </g>
              )}

              {/* Divider */}
              {i < bars.length - 1 && (
                <line x1={0} y1={y + rowH - gap / 2} x2={width} y2={y + rowH - gap / 2}
                  stroke="#f1f5f9" strokeWidth={1} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default BenchmarkComparison;
