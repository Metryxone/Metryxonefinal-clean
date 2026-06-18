import React from 'react';
import { COLOR } from '@/design-system';

interface SkillBarProps {
  label: string;
  pct: number;
  color?: string;
}

export function SkillBar({ label, pct, color = COLOR.primary }: SkillBarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-32 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-gray-500 w-7 text-right">{pct}%</span>
    </div>
  );
}
