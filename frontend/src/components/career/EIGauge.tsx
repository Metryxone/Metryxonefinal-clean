import React from 'react';
import { getEIBand } from '@/design-system';

interface EIGaugeProps {
  score: number;
  size?: number;
}

export function EIGauge({ score, size = 136 }: EIGaugeProps) {
  const r = size * 0.382;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const band = getEIBand(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={band.color} strokeWidth="10"
          strokeDasharray={`${filled} ${circ}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s ease' }} />
        <text x={size/2} y={size/2 - 5} textAnchor="middle" fontSize={size * 0.19} fontWeight="700" fill={band.color}>{score}</text>
        <text x={size/2} y={size/2 + 12} textAnchor="middle" fontSize={size * 0.08} fill="#64748b">/ 100</text>
      </svg>
      <div className="text-center">
        <div className="text-xs font-bold" style={{ color: band.color }}>{band.label}</div>
        <div className="text-[10px] text-gray-400">Employability Index™</div>
      </div>
    </div>
  );
}
