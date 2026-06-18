export const JOB_STAGES = ['Wishlist','Applied','Screening','Interview','Assessment','Offer','Accepted','Rejected'] as const;
export type JobStage = typeof JOB_STAGES[number];

export const STAGE_COLORS: Record<JobStage, string> = {
  Wishlist:   '#94a3b8',
  Applied:    '#344E86',
  Screening:  '#8b5cf6',
  Interview:  '#4ECDC4',
  Assessment: '#f4a261',
  Offer:      '#2A9D8F',
  Accepted:   '#16a34a',
  Rejected:   '#e63946',
};

export const GOAL_CATEGORIES = ['Skill','Certification','Role','Network','Other'] as const;
export type GoalCategory = typeof GOAL_CATEGORIES[number];

export const GOAL_PRIORITIES = ['High','Medium','Low'] as const;
export type GoalPriority = typeof GOAL_PRIORITIES[number];
