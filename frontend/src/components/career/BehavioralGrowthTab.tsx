/**
 * Behavioural Growth (Phase 5 — Growth & Memory).
 *
 * Surfaces the behavioural side of the Career Brain: execution style, the
 * constraints/patterns CAPADEX has observed, recurring signals, and current
 * risk factors. Developmental signals only — never hiring/promotion judgements.
 */
import React from 'react';
import { Brain, ShieldAlert, Activity, AlertTriangle, Target, Star, Sprout } from 'lucide-react';
import { COLOR } from '@/design-system';
import { SectionCard } from './SectionCard';
import { EmptyState } from './EmptyState';
import type { CareerBrain } from '@/lib/services/useCareerBrain';
import { deriveConstraints, type ConstraintSeverity } from '@/lib/intelligence/constraintEngine';
import type { GraphNode } from '@/lib/intelligence/behaviorGraph';

const SEVERITY_COLOR: Record<ConstraintSeverity, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#64748b',
};
const TYPE_LABEL: Record<string, string> = {
  behavior: 'Behaviour',
  skill: 'Skill',
  experience: 'Experience',
  execution: 'Execution',
  confidence: 'Confidence',
};

export function BehavioralGrowthTab({
  brain,
  profile,
  openJobs,
  eiScore,
}: {
  brain: CareerBrain;
  profile?: any;
  openJobs?: number;
  eiScore?: number;
}) {
  const constraintReport = React.useMemo(
    () => deriveConstraints(brain.behaviorGraph, brain, { targetRole: brain.targetRole, profile, openJobs, eiScore }),
    [brain, profile, openJobs, eiScore],
  );
  const { constraints, primary } = constraintReport;
  const graph = brain.behaviorGraph;
  const strengths = graph?.strengths ?? [];
  const growthDrivers = graph?.growthDrivers ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Behavioural growth</h2>
        <p className="text-xs text-gray-500 mt-1">How you operate, and what to work with. Developmental signals only.</p>
      </div>

      <SectionCard title="Why am I stuck?" icon={<Target size={16} />}>
        {constraints.length === 0 ? (
          <EmptyState
            icon={<Target size={40} />}
            title="No clear constraints detected"
            description="Set a target role and complete a CAPADEX assessment to surface what's blocking your progress."
          />
        ) : (
          <div className="space-y-3">
            {primary && (
              <div className="rounded-xl p-4 border" style={{ borderColor: SEVERITY_COLOR[primary.severity], backgroundColor: `${SEVERITY_COLOR[primary.severity]}0d` }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: SEVERITY_COLOR[primary.severity] }}>
                    Primary · {primary.severity}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{TYPE_LABEL[primary.type] || primary.type}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 mt-2">{primary.rootCause}</p>
                <p className="text-xs text-gray-500 mt-1">Blocks: {primary.blocksGoal}</p>
                {primary.evidence[0] && (
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    <span className="font-semibold text-gray-600">Evidence: </span>{primary.evidence[0].detail}
                  </p>
                )}
                {primary.recommendedActions[0] && (
                  <p className="text-xs mt-2" style={{ color: COLOR.primary }}>
                    → {primary.recommendedActions[0].hint}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                  <span>Impact {Math.round(primary.score * 100)}</span>
                  <span>Confidence {Math.round(primary.confidence * 100)}%</span>
                </div>
              </div>
            )}
            {constraints.filter((c) => c !== primary).map((c, i) => (
              <div key={`${c.type}-${i}`} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100">
                <span className="mt-0.5 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0" style={{ color: SEVERITY_COLOR[c.severity], backgroundColor: `${SEVERITY_COLOR[c.severity]}1a` }}>
                  {c.severity}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{TYPE_LABEL[c.type] || c.type}</span>
                  </div>
                  <p className="text-sm text-gray-700">{c.rootCause}</p>
                  {c.evidence[0] && <p className="text-[11px] text-gray-400 mt-0.5">{c.evidence[0].detail}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {(strengths.length > 0 || growthDrivers.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {strengths.length > 0 && (
            <SectionCard title="Strengths" icon={<Star size={16} />}>
              <p className="text-xs text-gray-500 -mt-1 mb-2">Positive contributors carrying your profile — from CSI, not concern signals.</p>
              <NodeList nodes={strengths} color="#2A9D8F" />
            </SectionCard>
          )}
          {growthDrivers.length > 0 && (
            <SectionCard title="Growth drivers" icon={<Sprout size={16} />}>
              <p className="text-xs text-gray-500 -mt-1 mb-2">Momentum working in your favour — trajectories that are improving or emerging.</p>
              <NodeList nodes={growthDrivers} color={COLOR.primary} />
            </SectionCard>
          )}
        </div>
      )}

      <div className="rounded-2xl p-5 border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest" style={{ color: COLOR.primary }}>
          <Brain size={14} /> Execution style
        </div>
        <p className="text-sm font-semibold text-gray-800 mt-2">{brain.executionStyle}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <SectionCard title="Behavioural constraints" icon={<ShieldAlert size={16} />}>
          <ul className="space-y-2">
            {brain.behavioralConstraints.map((c, i) => (
              <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLOR.accent }} />
                {c}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Risk factors" icon={<AlertTriangle size={16} />}>
          <ul className="space-y-2">
            {brain.riskFactors.map((r, i) => (
              <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0 bg-[#f4a261]" />
                {r}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Observed patterns" icon={<Activity size={16} />}>
        {brain.patterns.length === 0 ? (
          <EmptyState
            icon={<Activity size={40} />}
            title="No behavioural patterns yet"
            description="Patterns appear here once you complete a CAPADEX assessment."
          />
        ) : (
          <div className="space-y-2">
            {brain.patterns.map((p, i) => (
              <div key={p.key || i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                <span className="text-sm text-gray-700">{p.label || p.key}</span>
                <span className="text-[11px] text-gray-400">{Math.round((p.confidence || 0) * 100)}% confidence</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// Renders Behavior-Graph nodes (strengths / growth drivers) with their evidence +
// confidence — every line is backed by the evidence the graph node carries.
function NodeList({ nodes, color }: { nodes: GraphNode[]; color: string }) {
  return (
    <ul className="space-y-2">
      {nodes.slice(0, 6).map((n) => (
        <li key={n.id} className="p-3 rounded-xl border-l-2 border-y border-r border-gray-100" style={{ borderLeftColor: color }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-800 capitalize truncate">{n.label}</span>
            <span className="text-[10px] text-gray-400 shrink-0">{Math.round((n.confidence || 0) * 100)}% confidence</span>
          </div>
          {n.evidence[0] && (
            <p className="text-[11px] text-gray-500 mt-0.5">
              <span className="font-semibold text-gray-600">Evidence: </span>{n.evidence[0].detail}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
