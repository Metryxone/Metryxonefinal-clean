import React from 'react';

export interface RadarDataPoint {
  label:       string;
  value:       number;   // 0-100
  benchmark?:  number;   // 0-100 optional benchmark line
  color?:      string;
}

interface RadarChartProps {
  data:            RadarDataPoint[];
  size?:           number;
  fillColor?:      string;
  strokeColor?:    string;
  benchmarkColor?: string;
  showLabels?:     boolean;
  showGrid?:       boolean;
  showBenchmark?:  boolean;
  title?:          string;
  className?:      string;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  size           = 300,
  fillColor      = 'rgba(52, 78, 134, 0.18)',
  strokeColor    = '#344E86',
  benchmarkColor = 'rgba(78, 205, 196, 0.35)',
  showLabels     = true,
  showGrid       = true,
  showBenchmark  = true,
  title,
  className = '',
}) => {
  const n       = data.length;
  if (n < 3) return null;

  const cx      = size / 2;
  const cy      = size / 2;
  const r       = size * 0.36;
  const labelR  = size * 0.47;
  const rings   = [0.2, 0.4, 0.6, 0.8, 1.0];

  function polar(angle: number, radius: number): [number, number] {
    const rad = (angle - 90) * (Math.PI / 180);
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  }

  function buildPath(values: number[]): string {
    return values.map((v, i) => {
      const angle   = (360 / n) * i;
      const scale   = Math.max(0, Math.min(1, v / 100));
      const [x, y]  = polar(angle, r * scale);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ') + ' Z';
  }

  const userPath      = buildPath(data.map(d => d.value));
  const benchmarkPath = showBenchmark && data.some(d => d.benchmark !== undefined)
    ? buildPath(data.map(d => d.benchmark ?? 0))
    : null;

  return (
    <div className={className} style={{ display: 'inline-block', position: 'relative' }}>
      {title && (
        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#344E86', marginBottom: 4 }}>
          {title}
        </div>
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title ?? 'Radar chart'}>
        {/* Grid rings */}
        {showGrid && rings.map((pct, ri) => {
          const ringR = r * pct;
          const ringPts = Array.from({ length: n }, (_, i) => polar((360 / n) * i, ringR));
          const d = ringPts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(' ') + ' Z';
          return <path key={ri} d={d} fill="none" stroke="#e2e8f0" strokeWidth={0.8} />;
        })}
        {/* Axis spokes */}
        {data.map((_, i) => {
          const [x, y] = polar((360 / n) * i, r);
          return <line key={i} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="#e2e8f0" strokeWidth={0.8} />;
        })}
        {/* Benchmark fill */}
        {benchmarkPath && (
          <path d={benchmarkPath} fill={benchmarkColor} stroke="#4ECDC4" strokeWidth={1.5} strokeDasharray="4,3" />
        )}
        {/* User fill */}
        <path d={userPath} fill={fillColor} stroke={strokeColor} strokeWidth={2} strokeLinejoin="round" />
        {/* User dots */}
        {data.map((d, i) => {
          const angle  = (360 / n) * i;
          const scale  = Math.max(0, Math.min(1, d.value / 100));
          const [x, y] = polar(angle, r * scale);
          return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={3.5} fill={strokeColor} stroke="#fff" strokeWidth={1.5} />;
        })}
        {/* Labels */}
        {showLabels && data.map((d, i) => {
          const angle     = (360 / n) * i;
          const [lx, ly]  = polar(angle, labelR);
          const anchor    = angle > 180 && angle < 360 ? 'end' : angle === 0 || angle === 180 ? 'middle' : 'start';
          const dy        = ly < cy - 5 ? -4 : ly > cy + 5 ? 12 : 4;
          return (
            <text
              key={i} x={lx.toFixed(1)} y={(ly + dy).toFixed(1)}
              textAnchor={anchor} fontSize={9.5} fill="#64748b" fontFamily="Inter, sans-serif" fontWeight={500}
            >
              {d.label}
            </text>
          );
        })}
        {/* Value labels at user dots */}
        {data.map((d, i) => {
          const angle   = (360 / n) * i;
          const scale   = Math.max(0, Math.min(1, d.value / 100));
          const [dx, dy]= polar(angle, r * scale + 12);
          if (scale < 0.1) return null;
          return (
            <text key={`v${i}`} x={dx.toFixed(1)} y={dy.toFixed(1)} textAnchor="middle"
              fontSize={8.5} fill={strokeColor} fontFamily="Inter, sans-serif" fontWeight={600}>
              {Math.round(d.value)}
            </text>
          );
        })}
      </svg>
      {/* Legend */}
      {showBenchmark && benchmarkPath && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4, fontSize: 11 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}>
            <span style={{ width: 14, height: 3, background: strokeColor, borderRadius: 2, display: 'inline-block' }} />You
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}>
            <span style={{ width: 14, height: 3, background: '#4ECDC4', borderRadius: 2, display: 'inline-block', borderTop: '2px dashed #4ECDC4' }} />Benchmark
          </span>
        </div>
      )}
    </div>
  );
};

export default RadarChart;
