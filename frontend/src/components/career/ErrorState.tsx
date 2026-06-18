import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <AlertCircle size={32} className="text-red-400" />
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      {message && <p className="text-xs text-gray-400 max-w-xs">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
