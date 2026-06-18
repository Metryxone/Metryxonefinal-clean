import React from 'react';
import { Brain } from 'lucide-react';
import { COLOR } from '@/design-system';

interface Signal {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

interface IntelligencePanelProps {
  title: string;
  signals: Signal[];
  footer?: React.ReactNode;
  className?: string;
}

export function IntelligencePanel({ title, signals, footer, className = '' }: IntelligencePanelProps) {
  return (
    <div className={`bg-gradient-to-br from-[#344E86] to-[#4ECDC4] rounded-2xl p-5 text-white ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Brain size={16} className="opacity-80" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="space-y-3">
        {signals.map((s, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2 opacity-80">
              {s.icon}
              <span className="text-xs">{s.label}</span>
            </div>
            <span className="text-sm font-bold">{s.value}</span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-4 pt-4 border-t border-white/20">{footer}</div>}
    </div>
  );
}
