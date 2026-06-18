const TIER_FEATURES: Record<string, string[]> = {
  free: [
    'dashboard_basic',
    'child_profile_1',
    'exam_tracking',
    'progress_basic',
  ],
  starter: [
    'dashboard_basic',
    'dashboard_full',
    'child_profile_2',
    'exam_tracking',
    'progress_detailed',
    'lbi_micro_check',
    'ai_study_planner',
    'ai_assistant_limited',
  ],
  pro: [
    'dashboard_basic',
    'dashboard_full',
    'dashboard_analytics',
    'child_profile_5',
    'exam_tracking',
    'progress_advanced',
    'lbi_full_assessment',
    'ai_study_planner',
    'ai_assistant_unlimited',
    'mentor_marketplace',
    'curriculum_planner',
    'learning_forum',
    'email_reports_custom',
    'priority_support',
  ],
  institution_starter: [
    'dashboard_basic',
    'dashboard_full',
    'student_management',
    'exam_management',
    'batch_management',
    'analytics_basic',
    'lbi_assessments',
  ],
  institution_pro: [
    'dashboard_basic',
    'dashboard_full',
    'dashboard_analytics',
    'student_management',
    'exam_management',
    'batch_management',
    'analytics_advanced',
    'lbi_assessments',
    'ai_reports',
    'mentor_marketplace',
    'api_access',
    'priority_support',
  ],
  enterprise: [
    'all',
  ],
};

export function hasFeature(tierKey: string | null | undefined, feature: string): boolean {
  if (!tierKey) return TIER_FEATURES.free.includes(feature);
  const features = TIER_FEATURES[tierKey] || TIER_FEATURES.free;
  return features.includes('all') || features.includes(feature);
}

export function getMaxChildren(tierKey: string | null | undefined): number {
  if (!tierKey || tierKey === 'free') return 1;
  if (tierKey === 'starter') return 2;
  if (tierKey === 'pro') return 5;
  return 999;
}

export function getMaxAssessments(tierKey: string | null | undefined): number {
  if (!tierKey || tierKey === 'free') return 0;
  if (tierKey === 'starter') return 1;
  if (tierKey === 'pro') return 5;
  return 999;
}

export function getTierBadgeColor(tierKey: string): string {
  const colors: Record<string, string> = {
    free: '#94a3b8',
    starter: '#4ECDC4',
    pro: '#344E86',
    institution_starter: '#4ECDC4',
    institution_pro: '#344E86',
    enterprise: '#7c3aed',
  };
  return colors[tierKey] || '#94a3b8';
}

export function isUpgradeRequired(tierKey: string | null | undefined, feature: string): boolean {
  return !hasFeature(tierKey, feature);
}
