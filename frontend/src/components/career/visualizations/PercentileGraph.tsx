import React from 'react';

interface PercentileGraphProps {
  percentile:    number;    // 0-100
  label?:        string;
  width?:        number;
  height?:       number;
  fillColor?:    string;
  markerColor?:  string;
  showLabel?:    boolean;
  className?:    string;
  comparisons?:  { label: string; percentile: number; color: string }[];
}

export const PercentileGraph: React.FC<PercentileGraphProps> = ({
  percentile,
  label         = 'You',
  width         = 360,
  height        = 120,
  fillColor     = 'rgba(52, 78, 134, 0.15)',
  markerColor   = '#344E86',
  showLabel     = true,
  className     = '',
  comparisons   = [],
}) => {
  const pad = { l: 24, r: 24, t: 16, b: 32 };
  const gW  = width - pad.l - pad.r;
  const gH  = height - pad.t - pad.b;

  /* Bell curve via cubic bezier approximation */
  const bellPath = () => {
    const pts: [number, number][] = [];
    for (let x = 0; x <= gW; x += 2) {
      const u   = (x / gW) * 6 - 3;          // map to -3..3 std devs
      const y   = Math.exp(-0.5 * u * u);      // Gaussian
      pts.push([x, y]);
    }
    const maxY = Math.max(...pts.map(p => p[1]));
    const scaled = pts.map(([x, y]) => [x + pad.l, pad.t + gH * (1 - y / maxY)] as [number, number]);
    const [sx, sy] = scaled[0];
    const path = `M ${sx} ${sy} ` + scaled.slice(1).map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    /* Close to bottom */
    const last = scaled[scaled.length - 1];
    return path + ` L ${last[0].toFixed(1)} ${(pad.t + gH).toFixed(1)} L ${sx} ${(pad.t + gH).toFixed(1)} Z`;
  };

  /* Shade area up to percentile */
  const shadeUpTo = (pct: number) => {
    const pts: [number, number][] = [];
    const xLimit = (pct / 100) * gW;
    for (let x = 0; x <= xLimit; x += 2) {
      const u   = (x / gW) * 6 - 3;
      const y   = Math.exp(-0.5 * u * u);
      pts.push([x, y]);
    }
    if (!pts.length) return '';
    const maxY = 1;
    const scaled = pts.map(([x, y]) => [x + pad.l, pad.t + gH * (1 - y / maxY)] as [number, number]);
    const [sx, sy] = scaled[0];
    const path = `M ${sx} ${sy} ` + scaled.slice(1).map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const last = scaled[scaled.length - 1];
    return path + ` L ${last[0].toFixed(1)} ${(pad.t + gH).toFixed(1)} L ${sx} ${(pad.t + gH).toFixed(1)} Z`;
  };

  /* Marker x position */
  const markerX = (pct: number) => pad.l + (pct / 100) * gW;

  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className={className} style={{ fontFamily: 'Inter, sans-serif' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Outline bell */}
        <path d={bellPath()} fill={fillColor} stroke="#cbd5e1" strokeWidth={1.5} />
        {/* Shaded region (user) */}
        <path d={shadeUpTo(percentile)} fill={markerColor} opacity={0.25} />
        {/* Comparison markers */}
        {comparisons.map((c, i) => {
          const mx = markerX(c.percentile);
          return (
            <g key={i}>
              <line x1={mx} y1={pad.t - 4} x2={mx} y2={pad.t + gH} stroke={c.color} strokeWidth={1.5} strokeDasharray="3,2" />
              <text x={mx} y={pad.t - 6} textAnchor="middle" fontSize={8} fill={c.color} fontWeight={600}>{c.label}</text>
            </g>
          );
        })}
        {/* User marker */}
        {(() => {
          const mx = markerX(percentile);
          return (
            <g>
              <line x1={mx} y1={pad.t - 4} x2={mx} y2={pad.t + gH} stroke={markerColor} strokeWidth={2} />
              <polygon points={`${mx},${pad.t - 4} ${mx - 5},${pad.t - 12} ${mx + 5},${pad.t - 12}`} fill={markerColor} />
              {showLabel && (
                <text x={mx} y={pad.t - 14} textAnchor="middle" fontSize={9.5} fill={markerColor} fontWeight={700}>
                  {label} · {percentile}th
                </text>
              )}
            </g>
          );
        })()}
        {/* X axis */}
        <line x1={pad.l} y1={pad.t + gH} x2={pad.l + gW} y2={pad.t + gH} stroke="#cbd5e1" strokeWidth={1} />
        {/* Tick labels */}
        {ticks.map(t => (
          <text key={t} x={pad.l + (t / 100) * gW} y={pad.t + gH + 12} textAnchor="middle" fontSize={9} fill="#94a3b8">
            {t}th
          </text>
        ))}
        {/* Axis label */}
        <text x={pad.l + gW / 2} y={height - 2} textAnchor="middle" fontSize={9} fill="#94a3b8">Percentile rank</text>
      </svg>
    </div>
  );
};

export default PercentileGraph;
