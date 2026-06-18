/**
 * Pragati — Career Copilot (Phase 8 surface).
 *
 * The grounded, day-to-day face of every Career OS intelligence system. It does NOT
 * compute anything: it assembles a CopilotContext from data already loaded on the
 * page (Career Brain + Behavior Graph + Constraints + Unified Actions + Career Memory
 * + Goals/Jobs) and renders the deterministic, evidence-backed answers from
 * `aiCareerCopilot`. Every answer carries Current state · Evidence · Recommended
 * action · Expected outcome — never generic coaching. Best-effort & null-safe; the
 * Career Memory grounding (ledger/attributions) loads in the background and simply
 * enriches the "what happens if I do it" projection when present.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, ArrowRight, Quote } from 'lucide-react';
import { COLOR } from '@/design-system';
import { SectionCard } from './SectionCard';
import type { CareerBrain } from '@/lib/services/useCareerBrain';
import { deriveConstraints } from '@/lib/intelligence/constraintEngine';
import { buildUnifiedActions } from '@/lib/intelligence/unifiedActionEngine';
import { fetchProgressLedger } from '@/lib/intelligence/progressLedger';
import { fetchAttributions } from '@/lib/intelligence/outcomeAttributionEngine';
import type { GrowthTimeline } from '@/lib/intelligence/progressLedger';
import type { Attribution } from '@/lib/intelligence/outcomeAttributionEngine';
import {
  answerCareerQuestion,
  CANONICAL_QUESTIONS,
  type CopilotAnswer,
  type CopilotContext,
} from '@/lib/intelligence/aiCareerCopilot';

export function CareerCopilotCard({
  brain, userId, eiScore, openJobs = 0, hasAssessment = false, profile, goals, jobs, onTabChange,
}: {
  brain: CareerBrain;
  userId?: string;
  eiScore?: number;
  openJobs?: number;
  hasAssessment?: boolean;
  profile?: any;
  goals?: { text: string; completed?: boolean; targetDate?: string }[];
  jobs?: { company?: string; role?: string; status?: string }[];
  onTabChange: (t: any) => void;
}) {
  // Career Memory grounding (P5/P6) — best-effort, enriches "what if" when present.
  const [ledger, setLedger] = useState<GrowthTimeline | null>(null);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  useEffect(() => {
    let alive = true;
    // Clear any prior-user memory immediately so a userId change never bleeds stale
    // ledger/attribution evidence into the new account's answers before the refetch lands.
    setLedger(null);
    setAttributions([]);
    if (!userId) return;
    (async () => {
      try {
        const [lg, at] = await Promise.all([fetchProgressLedger(userId), fetchAttributions(userId)]);
        if (!alive) return;
        setLedger(lg);
        setAttributions(at);
      } catch { /* best-effort — copilot still answers from brain/graph/constraints */ }
    })();
    return () => { alive = false; };
  }, [userId]);

  const ctx = useMemo<CopilotContext>(() => {
    const constraints = deriveConstraints(brain.behaviorGraph, brain, { openJobs, eiScore, profile, targetRole: brain.targetRole });
    const actions = buildUnifiedActions(brain, { openJobs, hasAssessment }, constraints);
    return {
      brain, graph: brain.behaviorGraph, constraints, actions, ledger, attributions,
      eiScore, openJobs,
      goals: (goals || []).map((g) => ({ text: g.text, completed: g.completed, targetDate: g.targetDate })),
      jobs: (jobs || []).map((j) => ({ company: j.company, role: j.role, status: j.status })),
    };
  }, [brain, eiScore, openJobs, hasAssessment, profile, goals, jobs, ledger, attributions]);

  const [active, setActive] = useState<string>(CANONICAL_QUESTIONS[0].q);
  const answer: CopilotAnswer = useMemo(() => answerCareerQuestion(active, ctx), [active, ctx]);

  return (
    <SectionCard
      title="Pragati — Career Copilot"
      icon={<Sparkles size={16} />}
      action={
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EEF2FB', color: COLOR.primary }}>
          {answer.confidence > 0 ? `${Math.round(answer.confidence * 100)}% confident` : 'Grounded'}
        </span>
      }
    >
      <p className="text-[11px] text-gray-500 -mt-2 mb-3">
        Grounded in your behaviour graph, constraints, career memory, goals &amp; market signals — no generic advice.
      </p>

      {/* Canonical question chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CANONICAL_QUESTIONS.map((c) => {
          const on = c.q === active;
          return (
            <button
              key={c.intent}
              onClick={() => setActive(c.q)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors"
              style={on
                ? { backgroundColor: COLOR.primary, color: '#fff', borderColor: COLOR.primary }
                : { backgroundColor: '#fff', color: '#475569', borderColor: '#E5E7EB' }}
            >
              {c.q}
            </button>
          );
        })}
      </div>

      {/* Grounded structured answer */}
      <div className="rounded-xl border border-gray-100 p-4 space-y-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Where you stand</div>
          <p className="text-sm text-gray-800 mt-0.5">{answer.currentState}</p>
        </div>

        {answer.evidence.length > 0 && (
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Evidence</div>
            <ul className="mt-1 space-y-1">
              {answer.evidence.map((e, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[12px] text-gray-600">
                  <Quote size={11} className="mt-0.5 shrink-0 text-gray-300" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Recommended action</div>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{answer.recommendedAction}</p>
        </div>

        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Expected outcome</div>
          <p className="text-[12px] text-gray-600 mt-0.5">{answer.expectedOutcome}</p>
        </div>

        {answer.deepLinkTab && (
          <button
            onClick={() => onTabChange(answer.deepLinkTab)}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-lg text-white hover:opacity-90"
            style={{ backgroundColor: COLOR.primary }}
          >
            Take me there <ArrowRight size={12} />
          </button>
        )}
      </div>
    </SectionCard>
  );
}
