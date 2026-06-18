import React from 'react';

export interface HeatmapCell {
  id:      string;
  label:   string;
  domain:  string;
  level:   number;   // 0-5
  future?: 'hot' | 'rising' | 'stable' | 'declining';
}

interface CompetencyHeatmapProps {
  cells:       HeatmapCell[];
  maxLevel?:   number;
  showValues?:  boolean;
  showFuture?:  boolean;
  onCellClick?: (cell: HeatmapCell) => void;
  className?:  string;
}

const LEVEL_COLORS = [
  '#f8fafc',  // 0 — none
  '#dbeafe',  // 1 — aware
  '#93c5fd',  // 2 — practicing
  '#3b82f6',  // 3 — proficient
  '#1d4ed8',  // 4 — advanced
  '#1e3a8a',  // 5 — expert
];

const FUTURE_DOTS: Record<string, string> = {
  hot:      '#f59e0b',
  rising:   '#22c55e',
  stable:   '#94a3b8',
  declining:'#ef4444',
};

const DOMAIN_ORDER = ['technical', 'analytical', 'communication', 'leadership', 'creative', 'execution', 'behavioral'];
const DOMAIN_LABELS: Record<string, string> = {
  technical:     'Technical',
  analytical:    'Analytical',
  communication: 'Communication',
  leadership:    'Leadership',
  creative:      'Creative',
  execution:     'Execution',
  behavioral:    'Behavioral',
};

export const CompetencyHeatmap: React.FC<CompetencyHeatmapProps> = ({
  cells,
  maxLevel   = 5,
  showValues  = true,
  showFuture  = true,
  onCellClick,
  className  = '',
}) => {
  const grouped = DOMAIN_ORDER.reduce<Record<string, HeatmapCell[]>>((acc, domain) => {
    const domain_cells = cells.filter(c => c.domain === domain);
    if (domain_cells.length) acc[domain] = domain_cells;
    return acc;
  }, {});

  return (
    <div className={className} style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Level:</span>
        {LEVEL_COLORS.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#64748b' }}>
            <span style={{ width: 16, height: 16, background: c, border: '1px solid #e2e8f0', borderRadius: 3, display: 'inline-block' }} />
            {i}
          </span>
        ))}
        {showFuture && (
          <>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginLeft: 8 }}>Future:</span>
            {Object.entries(FUTURE_DOTS).map(([k, c]) => (
              <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#64748b' }}>
                <span style={{ width: 8, height: 8, background: c, borderRadius: '50%', display: 'inline-block' }} />
                {k}
              </span>
            ))}
          </>
        )}
      </div>

      {/* Domain rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Object.entries(grouped).map(([domain, domCells]) => (
          <div key={domain} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 90, flexShrink: 0, fontSize: 10, fontWeight: 600, color: '#475569',
              textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right',
            }}>
              {DOMAIN_LABELS[domain] ?? domain}
            </div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {domCells.map(cell => {
                const lvlClamped = Math.max(0, Math.min(maxLevel, Math.round(cell.level)));
                const bg         = LEVEL_COLORS[lvlClamped] ?? LEVEL_COLORS[0];
                const textColor  = lvlClamped >= 3 ? '#fff' : '#1e293b';
                return (
                  <div
                    key={cell.id}
                    onClick={() => onCellClick?.(cell)}
                    title={`${cell.label}: Level ${cell.level.toFixed(1)}`}
                    style={{
                      width: 52, height: 40, background: bg,
                      border: '1px solid #e2e8f0', borderRadius: 5,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: onCellClick ? 'pointer' : 'default',
                      position: 'relative', transition: 'transform 0.1s',
                      userSelect: 'none',
                    }}
                    onMouseEnter={e => { if (onCellClick) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 600, color: textColor, textAlign: 'center', lineHeight: 1.2, padding: '0 2px' }}>
                      {cell.label.split(' ')[0]}
                    </span>
                    {showValues && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: textColor }}>{cell.level.toFixed(1)}</span>
                    )}
                    {showFuture && cell.future && (
                      <span style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 6, height: 6, borderRadius: '50%',
                        background: FUTURE_DOTS[cell.future] ?? '#94a3b8',
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompetencyHeatmap;
