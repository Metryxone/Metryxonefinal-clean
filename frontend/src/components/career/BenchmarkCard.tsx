import React from 'react';
import { SkillBar } from './SkillBar';
import { COLOR } from '@/design-system';

interface BenchmarkItem {
  label: string;
  userPct: number;
  benchmarkPct: number;
}

interface BenchmarkCardProps {
  title: string;
  items: BenchmarkItem[];
  className?: string;
}

export function BenchmarkCard({ title, items, className = '' }: BenchmarkCardProps) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl p-5 shadow-sm ${className}`}>
      <h3 className="text-sm font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">{item.label}</span>
              <span className="text-[10px] text-gray-400">
                You: <b>{item.userPct}%</b> · Industry: {item.benchmarkPct}%
              </span>
            </div>
            <div className="relative">
              <SkillBar label="" pct={item.userPct} color={item.userPct >= item.benchmarkPct ? COLOR.green : COLOR.orange} />
              <div
                className="absolute top-0 h-2 w-0.5 rounded-full bg-gray-400"
                style={{ left: `${item.benchmarkPct}%` }}
                title={`Industry benchmark: ${item.benchmarkPct}%`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
