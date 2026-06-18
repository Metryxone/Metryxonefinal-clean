import React from 'react';
import { X } from 'lucide-react';
import { COLOR } from '@/design-system';

interface ChipProps {
  label: string;
  color?: string;
  onRemove?: () => void;
}

export function Chip({ label, color = COLOR.accent, onRemove }: ChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
      style={{ backgroundColor: `${color}15`, color }}
    >
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 hover:opacity-70">
          <X size={10} />
        </button>
      )}
    </span>
  );
}
