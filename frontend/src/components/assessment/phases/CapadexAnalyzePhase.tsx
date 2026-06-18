import React from 'react';
import { X } from 'lucide-react';
import { METRYX_NAVY, BRAND } from '@/lib/behavioural-insights';
import metryxLogo from '@/assets/metryx-logo-transparent.png';
import { PhaseProps } from '../types';

export function CapadexAnalyzePhase(props: PhaseProps) {
  const { selectedConcern, handleClose } = props;

  return (
    <div className="relative flex flex-col items-center justify-center select-none bg-white px-6 py-16 min-h-[420px]">
      <style>{`
        @keyframes mx-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.92; }
        }
        @keyframes mx-halo {
          0% { transform: scale(0.85); opacity: 0.45; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes mx-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(320%); }
        }
      `}</style>

      <button
        onClick={handleClose}
        className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-all"
        aria-label="Close"
      >
        <X size={16} />
      </button>

      {/* Logo with breathing animation + radiating halo */}
      <div className="relative flex items-center justify-center mb-8">
        <span
          className="absolute rounded-full"
          style={{
            width: 132, height: 132,
            background: `${BRAND.accent}22`,
            animation: 'mx-halo 2.4s ease-out infinite',
          }}
        />
        <span
          className="absolute rounded-full"
          style={{
            width: 132, height: 132,
            background: `${BRAND.accent}22`,
            animation: 'mx-halo 2.4s ease-out infinite 1.2s',
          }}
        />
        <div
          className="relative flex items-center justify-center rounded-3xl bg-white"
          style={{
            width: 116, height: 116,
            boxShadow: `0 1px 2px rgba(16,24,40,0.05), 0 18px 40px -18px ${METRYX_NAVY}40`,
            animation: 'mx-breathe 2.4s ease-in-out infinite',
          }}
        >
          <img src={metryxLogo} alt="MetryxOne" className="w-[76px] h-auto object-contain" draggable={false} />
        </div>
      </div>

      <div className="text-center max-w-[300px]">
        <p className="text-[15px] font-semibold text-slate-800">Mapping behavioural patterns…</p>
        <p className="text-[13px] text-slate-400 mt-1 leading-snug">
          {selectedConcern
            ? <>Building your personalised assessment for <span className="font-medium text-slate-500">{selectedConcern}</span></>
            : 'Building your personalised assessment'}
        </p>
      </div>

      {/* Sliding progress indicator (solid — no gradient) */}
      <div className="mt-7 w-[180px] h-[3px] rounded-full overflow-hidden" style={{ background: '#eef2f7' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: '38%',
            background: METRYX_NAVY,
            opacity: 0.85,
            animation: 'mx-shimmer 1.4s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}
