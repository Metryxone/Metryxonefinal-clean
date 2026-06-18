import { eventBus } from './eventBus';
import { useProfileStore }     from '@/lib/stores/profileStore';
import { useCompetencyStore }  from '@/lib/stores/competencyStore';
import { useIntelligenceStore } from '@/lib/stores/intelligenceStore';
import { useIDPStore }         from '@/lib/stores/idpStore';
import { useBenchmarkStore }   from '@/lib/stores/benchmarkStore';

export const CAREER_EVENTS = {
  PROFILE_UPDATED:        'profile:updated',
  COMPETENCY_RECALCULATED:'competency:recalculated',
  FITMENT_UPDATED:        'fitment:updated',
  FUTURE_ROLES_RECOMPUTED:'future_roles:recomputed',
  IDP_REGENERATED:        'idp:regenerated',
  BENCHMARK_UPDATED:      'benchmark:updated',
  EI_COMPUTED:            'ei:computed',
  TARGET_ROLE_CHANGED:    'target_role:changed',
  ASSESSMENT_SUBMITTED:   'assessment:submitted',
} as const;

export type CareerEventType = typeof CAREER_EVENTS[keyof typeof CAREER_EVENTS];

let pipelineActive = false;

export function initCareerEventPipeline(): void {
  if (pipelineActive) return;
  pipelineActive = true;

  eventBus.on(CAREER_EVENTS.PROFILE_UPDATED, (profile: any) => {
    const { compute: computeCompetency } = useCompetencyStore.getState();
    computeCompetency(profile);
    eventBus.emit(CAREER_EVENTS.COMPETENCY_RECALCULATED, profile);
  });

  eventBus.on(CAREER_EVENTS.COMPETENCY_RECALCULATED, (profile: any) => {
    const { compute } = useIntelligenceStore.getState();
    compute(profile);
    eventBus.emit(CAREER_EVENTS.EI_COMPUTED, profile);
    eventBus.emit(CAREER_EVENTS.FUTURE_ROLES_RECOMPUTED, profile);
  });

  eventBus.on(CAREER_EVENTS.FUTURE_ROLES_RECOMPUTED, (profile: any) => {
    const { targetRole } = useIntelligenceStore.getState();
    if (targetRole) {
      useIDPStore.getState().build(profile, targetRole);
      eventBus.emit(CAREER_EVENTS.IDP_REGENERATED, { profile, targetRole });
    }
    const { compute: computeBenchmark } = useBenchmarkStore.getState();
    computeBenchmark(profile);
    eventBus.emit(CAREER_EVENTS.BENCHMARK_UPDATED, profile);
  });

  eventBus.on(CAREER_EVENTS.TARGET_ROLE_CHANGED, ({ profile, roleId }: { profile: any; roleId: string }) => {
    const { setTargetRole } = useIntelligenceStore.getState();
    setTargetRole(roleId);
    const newRole = useIntelligenceStore.getState().targetRole;
    if (newRole) {
      useIDPStore.getState().build(profile, newRole);
      eventBus.emit(CAREER_EVENTS.IDP_REGENERATED, { profile, targetRole: newRole });
    }
  });
}

export function dispatchProfileUpdated(profile: any): void {
  useProfileStore.getState().setProfile(profile);
  eventBus.emit(CAREER_EVENTS.PROFILE_UPDATED, profile);
}

export function dispatchTargetRoleChanged(profile: any, roleId: string): void {
  eventBus.emit(CAREER_EVENTS.TARGET_ROLE_CHANGED, { profile, roleId });
}

export function dispatchAssessmentSubmitted(profile: any, answers: Record<string, number>): void {
  useCompetencyStore.getState().setAnswer('__submitted', 1);
  eventBus.emit(CAREER_EVENTS.ASSESSMENT_SUBMITTED, { profile, answers });
  eventBus.emit(CAREER_EVENTS.PROFILE_UPDATED, profile);
}
