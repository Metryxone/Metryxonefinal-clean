export interface CompetencyRow {
  id: string;
  code: string;
  name: string;
  description: string;
  domain_id: string;
  sort_order: number;
  is_active: boolean;
}

export interface CompetencyScoreRow {
  id: string;
  profile_id: string;
  competency_id: string;
  raw_score: string;
  confidence: string;
  final_score: string;
  source: string;
  assessed_at: string;
  competency_code: string;
  competency_name: string;
  domain_code: string;
  domain_name: string;
  domain_id: string;
}

export interface BenchmarkRow {
  competency_id: string;
  mean: string;
  median: string;
  std_dev: string;
  p25: string;
  p75: string;
  p90: string;
  sample_size: number;
}

export interface WeightRow {
  competency_id: string;
  weight: string;
}

export interface CareerProfileRow {
  id: string;
  user_id: string;
  current_job_role: string;
  target_job_role: string | null;
  industry: string;
  career_stage: string;
  experience_years: number;
  full_name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateRow {
  user_id: string;
  current_job_role: string;
  industry: string;
  career_stage: string;
  experience_years: string;
  full_name: string;
  avg_score: string;
  scored_competencies: number;
}

export interface InterventionRow {
  id: string;
  competency_id: string;
  type: string;
  title: string;
  description: string;
  provider: string | null;
  duration_weeks: number | null;
  gap_level: string;
  competency_code: string;
  competency_name: string;
}
