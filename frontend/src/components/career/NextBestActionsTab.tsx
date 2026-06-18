/**
 * Next Best Actions (Career OS — Command Center).
 *
 * The focused "what do I do right now" view, now powered by the Unified Action
 * Engine (Phase 4): library-backed CAPADEX interventions lead, weekly ROI moves
 * interleave, and constraint hand-offs fill the gaps — one ranked, deduped list.
 * Developmental guidance only. Degrades to local heuristics when the backend has
 * no linked session.
 */
import React, { useMemo } from 'react';
import { Rocket, ArrowRight, Target, ShieldCheck } from 'lucide-react';
import { COLOR } from '@/design-system';
import { SectionCard } from './SectionCard';
import { buildUnifiedActions, type UnifiedAction } from '@/lib/intelligence/unifiedActionEngine';
import { deriveConstraints } from '@/lib/intelligence/constraintEngine';
import type { CareerBrain } from '@/lib/services/useCareerBrain';
import { CareerCopilotCard } from './CareerCopilotCard';

const PROVENANCE_LABEL: Record<UnifiedAction['provenance'], string> = {
  'library-backed': 'CAPADEX intervention',
  heuristic: 'Weekly ROI',
  constraint: 'Constraint fix',
};

/**
 * Non-generic evidence line for an action — names the underlying signals / construct /
 * constraint the recommendation was derived from (empty for pure ROI heuristics, which
 * carry their basis in the "Weekly ROI" provenance label instead).
 */
function evidenceText(a: UnifiedAction): string {
  const signals = a.refs?.signals?.filter(Boolean) ?? [];
  if (signals.length) {
    const named = signals.slice(0, 3).map((s) => s.replace(/_/g, ' '));
    return named.join(', ') + (signals.length > 3 ? ` +${signals.length - 3} more` : '');
  }
  if (a.refs?.constructKey) return a.refs.constructKey.replace(/_/g, ' ');
  if (a.refs?.constraintType) return `${a.refs.constraintType} constraint`;
  return '';
}

export function NextBestActionsTab({ brain, openJobs = 0, hasAssessment = false, eiScore, profile, userId, goals, jobs, onTabChange }: {
  brain: CareerBrain;
  openJobs?: number;
  hasAssessment?: boolean;
  eiScore?: number;
  profile?: any;
  userId?: string;
  goals?: { text: string; completed?: boolean; targetDate?: string }[];
  jobs?: { company?: string; role?: string; status?: string }[];
  onTabChange: (t: any) => void;
}) {
  const actions = useMemo(() => {
    const report = deriveConstraints(brain.behaviorGraph, brain, { openJobs, eiScore, profile, targetRole: brain.targetRole });
    return buildUnifiedActions(brain, { openJobs, hasAssessment }, report);
  }, [brain, openJobs, hasAssessment, eiScore, profile]);
  const top = actions[0];
  const rest = actions.slice(1, 5);
  const libraryBacked = top?.provenance === 'library-backed';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Next best actions</h2>
        <p className="text-xs text-gray-500 mt-1">Start here. One move at a time, highest return first.</p>
      </div>

      {/* Career Copilot — grounded Q&A over every Career OS intelligence system */}
      <CareerCopilotCard
        brain={brain}
        userId={userId}
        eiScore={eiScore}
        openJobs={openJobs}
        hasAssessment={hasAssessment}
        profile={profile}
        goals={goals}
        jobs={jobs}
        onTabChange={onTabChange}
      />

      {/* Fastest win — hero card */}
      <div className="rounded-2xl p-5 text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${COLOR.primary}, #4661a8)` }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white/80">
            <Rocket size={14} /> Fastest win
          </div>
          {top && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white/90">
              {libraryBacked && <ShieldCheck size={11} />} {PROVENANCE_LABEL[top.provenance]}
            </span>
          )}
        </div>
        <p className="text-base font-semibold mt-2">{top ? top.title : brain.fastestWinAction}</p>
        <p className="text-xs text-white/80 mt-1">
          <span className="font-semibold">Why: </span>{top ? top.rationale : 'Keep building — more guidance unlocks as your profile fills in.'}
        </p>
        {top && evidenceText(top) && (
          <p className="text-xs text-white/70 mt-1"><span className="font-semibold">Evidence: </span>{evidenceText(top)}</p>
        )}
        {top && (
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white/90">Impact {Math.round(top.impact)}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white/90">Confidence {Math.round(top.confidence * 100)}%</span>
          </div>
        )}
        {top && (
          <button
            onClick={() => onTabChange(top.deepLinkTab)}
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-white"
            style={{ color: COLOR.primary }}
          >
            Start now <ArrowRight size={12} />
          </button>
        )}
      </div>

      <SectionCard title="Then tackle" icon={<Target size={16} />}>
        {rest.length === 0 ? (
          <p className="text-xs text-gray-400">Nothing else queued — finish the fastest win above first.</p>
        ) : (
          <ul className="space-y-2">
            {rest.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.title}</p>
                    {a.provenance === 'library-backed' && (
                      <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#EEF2FB', color: COLOR.primary }}>
                        <ShieldCheck size={9} /> CAPADEX
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500"><span className="font-semibold text-gray-600">Why: </span>{a.rationale}</p>
                  {evidenceText(a) && (
                    <p className="text-[11px] text-gray-400 truncate"><span className="font-semibold text-gray-500">Evidence: </span>{evidenceText(a)}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                    <span className="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100">Impact {Math.round(a.impact)}</span>
                    <span className="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100">Confidence {Math.round(a.confidence * 100)}%</span>
                  </div>
                </div>
                <button
                  onClick={() => onTabChange(a.deepLinkTab)}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg text-white hover:opacity-90"
                  style={{ backgroundColor: COLOR.primary }}
                >
                  Go <ArrowRight size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
