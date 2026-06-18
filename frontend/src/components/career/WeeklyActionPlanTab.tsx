/**
 * Weekly Action Plan (Phase 5 — Command Center).
 *
 * Renders the ROI-ranked plan from weeklyActionEngine — at most 5 moves for the
 * week, each with a deep-link into the tab where it gets done. Developmental
 * actions only; no hiring/promotion framing.
 */
import React, { useMemo } from 'react';
import { CalendarCheck, ArrowRight, Zap } from 'lucide-react';
import { COLOR } from '@/design-system';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import { generateWeeklyActions, type WeeklyAction } from '@/lib/engines/weeklyActionEngine';
import type { CareerBrain } from '@/lib/services/useCareerBrain';

const EFFORT_LABEL: Record<WeeklyAction['effort'], string> = { low: 'Quick win', medium: 'Focused effort', high: 'Deep work' };
const EFFORT_COLOR: Record<WeeklyAction['effort'], string> = { low: '#2A9D8F', medium: '#344E86', high: '#f4a261' };

export function WeeklyActionPlanTab({ brain, openJobs = 0, hasAssessment = false, onTabChange }: {
  brain: CareerBrain;
  openJobs?: number;
  hasAssessment?: boolean;
  onTabChange: (t: any) => void;
}) {
  const actions = useMemo(() => generateWeeklyActions(brain, { openJobs, hasAssessment }), [brain, openJobs, hasAssessment]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800">This week's plan</h2>
        <p className="text-xs text-gray-500 mt-1">
          Your highest-return moves, ranked. Focus on <span className="font-semibold" style={{ color: COLOR.primary }}>{brain.weeklyFocus}</span>.
        </p>
      </div>

      <SectionCard title="Ranked actions" icon={<CalendarCheck size={16} />}>
        {actions.length === 0 ? (
          <EmptyState
            icon={<Zap size={40} />}
            title="No actions yet"
            description="Complete your profile or run an assessment to unlock a tailored weekly plan."
          />
        ) : (
          <ol className="space-y-3">
            {actions.map((a, i) => (
              <li key={a.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: COLOR.primary }}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{a.title}</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: `${EFFORT_COLOR[a.effort]}15`, color: EFFORT_COLOR[a.effort] }}>
                      {EFFORT_LABEL[a.effort]}
                    </span>
                    <span className="text-[10px] text-gray-400">Impact {a.impact}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{a.rationale}</p>
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
          </ol>
        )}
      </SectionCard>
    </div>
  );
}
