import { create } from 'zustand';
import { runCompetencyEngine, type CompetencyOutput } from '@/lib/engines/competencyEngine';
import { runScoringEngine, type ScoringOutput } from '@/lib/engines/scoringEngine';
import { ASSESSMENT_QUESTIONS, type AQ } from '@/data/catalogs/assessment-questions';

interface CompetencyState {
  output:    CompetencyOutput | null;
  scoring:   ScoringOutput | null;
  answers:   Record<string, number>;
  phase:     'config' | 'taking' | 'results';
  role:      string;
  stage:     string;
  industry:  string;

  compute:   (profile: any) => void;
  setAnswer: (questionId: string, score: number) => void;
  submit:    () => void;
  setPhase:  (phase: 'config' | 'taking' | 'results') => void;
  setConfig: (role: string, stage: string, industry: string) => void;
  reset:     () => void;
}

export const useCompetencyStore = create<CompetencyState>((set, get) => ({
  output:   null,
  scoring:  null,
  answers:  {},
  phase:    'config',
  role:     '',
  stage:    '',
  industry: '',

  compute: (profile) => {
    const output = runCompetencyEngine({ profile });
    set({ output });
  },

  setAnswer: (questionId, score) =>
    set(s => ({ answers: { ...s.answers, [questionId]: score } })),

  submit: () => {
    const { answers } = get();
    const scoring = runScoringEngine({ answers, questions: ASSESSMENT_QUESTIONS });
    set({ scoring, phase: 'results' });
  },

  setPhase:  (phase)             => set({ phase }),
  setConfig: (role, stage, industry) => set({ role, stage, industry, phase: 'taking', answers: {} }),
  reset:     ()                  => set({ output: null, scoring: null, answers: {}, phase: 'config' }),
}));
