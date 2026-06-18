import React from 'react';

export interface TrajectoryNode {
  id:          string;
  label:       string;
  sublabel?:   string;
  score?:      number;     // 0-100 — shown as fill level
  status:      'current' | 'next' | 'future' | 'completed';
  etaMonths?:  number;
}

interface TrajectoryMapProps {
  nodes:       TrajectoryNode[];
  width?:      number;
  height?:     number;
  orientation?:'horizontal' | 'vertical';
  className?:  string;
}

const STATUS_COLORS: Record<TrajectoryNode['status'], { fill: string; stroke: string; text: string }> = {
  completed: { fill: '#dcfce7', stroke: '#16a34a', text: '#15803d' },
  current:   { fill: '#344E86', stroke: '#344E86', text: '#ffffff' },
  next:      { fill: '#eff6ff', stroke: '#3b82f6', text: '#1d4ed8' },
  future:    { fill: '#f8fafc', stroke: '#cbd5e1', text: '#94a3b8' },
};

export const TrajectoryMap: React.FC<TrajectoryMapProps> = ({
  nodes,
  width       = 620,
  height      = 140,
  orientation = 'horizontal',
  className   = '',
}) => {
  const n      = nodes.length;
  if (!n) return null;

  const isH    = orientation === 'horizontal';
  const pad    = 40;
  const nodeR  = 22;

  const positions = nodes.map((_, i) => {
    if (isH) {
      const x = pad + (i / Math.max(1, n - 1)) * (width - pad * 2);
      return [x, height / 2] as [number, number];
    } else {
      const y = pad + (i / Math.max(1, n - 1)) * (height - pad * 2);
      return [width / 2, y] as [number, number];
    }
  });

  return (
    <div className={className} style={{ fontFamily: 'Inter, sans-serif', overflowX: 'auto' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Connector lines */}
        {positions.slice(0, -1).map(([x1, y1], i) => {
          const [x2, y2] = positions[i + 1];
          const isDone   = nodes[i].status === 'completed' && nodes[i + 1].status !== 'future';
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isDone ? '#16a34a' : '#cbd5e1'} strokeWidth={2.5}
              strokeDasharray={isDone ? undefined : '5,4'}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const [cx, cy] = positions[i];
          const colors   = STATUS_COLORS[node.status];
          const labelY   = isH ? (i % 2 === 0 ? cy - nodeR - 28 : cy + nodeR + 16) : cy;
          const labelX   = isH ? cx : (i % 2 === 0 ? cx - nodeR - 8 : cx + nodeR + 8);
          const textAnchor = isH ? 'middle' : (i % 2 === 0 ? 'end' : 'start');

          return (
            <g key={node.id}>
              {/* Score arc fill for current node */}
              {node.status === 'current' && node.score !== undefined && (
                <circle cx={cx} cy={cy} r={nodeR} fill="none" stroke="rgba(255,255,255,0.3)"
                  strokeWidth={4} strokeDasharray={`${(node.score / 100) * 2 * Math.PI * nodeR} ${2 * Math.PI * nodeR}`}
                  strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
              )}
              {/* Circle */}
              <circle cx={cx} cy={cy} r={nodeR} fill={colors.fill} stroke={colors.stroke} strokeWidth={2} />
              {/* Index label */}
              <text x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill={colors.text}>
                {i + 1}
              </text>
              {/* ETA badge for next node */}
              {node.status === 'next' && node.etaMonths && (
                <g>
                  <rect x={cx - 18} y={cy + nodeR + 2} width={36} height={14} rx={7} fill="#eff6ff" />
                  <text x={cx} y={cy + nodeR + 12} textAnchor="middle" fontSize={8} fill="#3b82f6" fontWeight={600}>
                    {node.etaMonths}mo
                  </text>
                </g>
              )}
              {/* Label */}
              <text x={labelX} y={labelY} textAnchor={textAnchor} fontSize={10} fontWeight={600} fill={colors.stroke}>
                {node.label}
              </text>
              {node.sublabel && (
                <text x={labelX} y={labelY + 13} textAnchor={textAnchor} fontSize={8.5} fill="#64748b">
                  {node.sublabel}
                </text>
              )}
              {/* Checkmark for completed */}
              {node.status === 'completed' && (
                <text x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fill="#16a34a" fontWeight={700}>✓</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default TrajectoryMap;
