import React from 'react';
import { FlaskConical } from 'lucide-react';

interface SimulatedDataBannerProps {
  detail?: string;
}

export default function SimulatedDataBanner({ detail }: SimulatedDataBannerProps) {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900"
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="text-xs leading-relaxed">
        <span className="font-semibold">Simulated data — not real predictions.</span>{' '}
        {detail ??
          'This panel surfaces synthetic placeholder values generated for development and demonstration. Do not treat these numbers as real measurements, and never present them as hiring, promotion, or suitability decisions.'}
      </div>
    </div>
  );
}
