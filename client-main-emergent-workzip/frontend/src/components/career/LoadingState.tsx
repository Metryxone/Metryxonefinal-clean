import React from 'react';
import { COLOR } from '@/design-system';

interface LoadingStateProps {
  message?: string;
  compact?: boolean;
}

export function LoadingState({ message = 'Loading…', compact = false }: LoadingStateProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${COLOR.primary}40`, borderTopColor: COLOR.primary }} />
        {message}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
        style={{ borderColor: `${COLOR.primary}30`, borderTopColor: COLOR.primary }} />
      <p className="text-xs text-gray-400">{message}</p>
    </div>
  );
}
