import React from 'react';
import { COLOR } from '@/design-system';

interface TimelineItem {
  label: string;
  date?: string;
  status: 'done' | 'active' | 'pending';
  description?: string;
}

interface ProgressTimelineProps {
  items: TimelineItem[];
  className?: string;
}

const STATUS_STYLES = {
  done:    { dot: COLOR.green,   line: COLOR.green   },
  active:  { dot: COLOR.primary, line: '#e2e8f0'     },
  pending: { dot: '#e2e8f0',     line: '#e2e8f0'     },
};

export function ProgressTimeline({ items, className = '' }: ProgressTimelineProps) {
  return (
    <div className={`space-y-0 ${className}`}>
      {items.map((item, i) => {
        const s = STATUS_STYLES[item.status];
        const isLast = i === items.length - 1;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full mt-1 shrink-0 transition-colors"
                style={{ backgroundColor: s.dot, border: item.status === 'active' ? `2px solid ${COLOR.primary}` : 'none' }} />
              {!isLast && <div className="w-0.5 flex-1 mt-1" style={{ backgroundColor: s.line }} />}
            </div>
            <div className={`pb-4 ${isLast ? '' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${item.status === 'pending' ? 'text-gray-400' : 'text-gray-800'}`}>
                  {item.label}
                </span>
                {item.date && <span className="text-[10px] text-gray-400">{item.date}</span>}
              </div>
              {item.description && (
                <p className="text-[10px] text-gray-400 mt-0.5">{item.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
