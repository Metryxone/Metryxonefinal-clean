export type QuestionType = 'mcq' | 'sjt' | 'likert';

export interface AQOption {
  label: string;
  score: number;
}

export interface AQ {
  id: string;
  code: string;
  competency: string;
  domain: string;
  type: QuestionType;
  text: string;
  options: AQOption[];
  hint?: string;
}

export const ASSESSMENT_QUESTIONS: AQ[] = [
  { id:'q1',  code:'COG01', competency:'Critical Thinking',       domain:'Cognitive & Analytical',         type:'mcq',
    text:'A project has 3 possible solutions: A costs ₹50K saves ₹80K, B costs ₹30K saves ₹40K, C costs ₹70K saves ₹120K. Ranked by ROI, the correct order is:',
    options:[{label:'C, A, B',score:100},{label:'A, C, B',score:40},{label:'B, A, C',score:20},{label:'C, B, A',score:60}],
    hint:'Calculate net return (savings minus cost) for each option.' },
  { id:'q2',  code:'COG02', competency:'Problem Solving',         domain:'Cognitive & Analytical',         type:'sjt',
    text:'A critical production server goes down 2 hours before a major demo. You are the only engineer available. What do you do first?',
    options:[{label:'Immediately contact the client to reschedule',score:20},{label:'Diagnose the root cause by checking logs and monitoring',score:100},{label:'Roll back the last deployment',score:70},{label:'Escalate to your manager and wait for instructions',score:40}] },
  { id:'q3',  code:'COG03', competency:'Analytical Reasoning',    domain:'Cognitive & Analytical',         type:'mcq',
    text:'If all A are B, and some B are C, which statement must be true?',
    options:[{label:'All A are C',score:20},{label:'Some A might be C',score:100},{label:'No A are C',score:0},{label:'All C are A',score:10}] },
  { id:'q4',  code:'COG04', competency:'Decision Making',         domain:'Cognitive & Analytical',         type:'sjt',
    text:'You receive two conflicting requirements from two senior stakeholders. The deadline is tomorrow. You:',
    options:[{label:'Pick the requirement from the more senior person',score:40},{label:'Ignore both and implement your best judgment',score:10},{label:'Schedule a quick call with both to align and get written confirmation',score:100},{label:'Complete both requirements separately and let them decide later',score:60}] },
  { id:'q5',  code:'COM01', competency:'Verbal Communication',    domain:'Communication',                  type:'likert',
    text:'I can clearly articulate complex ideas to audiences with different levels of expertise.',
    options:[{label:'Strongly Disagree',score:0},{label:'Disagree',score:25},{label:'Neutral',score:50},{label:'Agree',score:75},{label:'Strongly Agree',score:100}] },
  { id:'q6',  code:'COM02', competency:'Written Communication',   domain:'Communication',                  type:'likert',
    text:'My written reports and emails are structured, concise, and free of ambiguity.',
    options:[{label:'Strongly Disagree',score:0},{label:'Disagree',score:25},{label:'Neutral',score:50},{label:'Agree',score:75},{label:'Strongly Agree',score:100}] },
  { id:'q7',  code:'COM04', competency:'Active Listening',        domain:'Communication',                  type:'likert',
    text:'I actively paraphrase and verify understanding before responding in conversations.',
    options:[{label:'Strongly Disagree',score:0},{label:'Disagree',score:25},{label:'Neutral',score:50},{label:'Agree',score:75},{label:'Strongly Agree',score:100}] },
  { id:'q8',  code:'LEA01', competency:'Team Leadership',         domain:'Leadership & Initiative',        type:'likert',
    text:'I proactively take ownership of team outcomes, even when it is not explicitly my responsibility.',
    options:[{label:'Strongly Disagree',score:0},{label:'Disagree',score:25},{label:'Neutral',score:50},{label:'Agree',score:75},{label:'Strongly Agree',score:100}] },
  { id:'q9',  code:'LEA03', competency:'Coaching & Mentoring',    domain:'Leadership & Initiative',        type:'sjt',
    text:'A junior team member keeps making the same mistake despite your correction. You:',
    options:[{label:'Report the issue to their manager',score:30},{label:'Stop assigning them critical tasks',score:10},{label:'Have a structured 1:1 to understand root cause and co-create a learning plan',score:100},{label:'Let them figure it out on their own',score:20}] },
  { id:'q10', code:'LEA05', competency:'Change Leadership',       domain:'Leadership & Initiative',        type:'sjt',
    text:'Your organization announces a major restructuring that your team is resistant to. Your role is to:',
    options:[{label:'Align with your team and push back against management',score:20},{label:'Communicate the rationale transparently, acknowledge concerns, and build a transition plan',score:100},{label:'Implement the change without discussion to avoid resistance',score:30},{label:'Wait until the resistance dies down naturally',score:15}] },
  { id:'q11', code:'EXE01', competency:'Project Management',      domain:'Execution & Delivery',           type:'sjt',
    text:'Your project is 2 weeks behind schedule with no extra budget. You:',
    options:[{label:'Reduce scope to deliver core features on time and communicate the change',score:100},{label:'Ask for a deadline extension from the client',score:60},{label:'Ask the team to work overtime without compensation',score:30},{label:'Deliver all features late without communication',score:10}] },
  { id:'q12', code:'EXE02', competency:'Accountability',          domain:'Execution & Delivery',           type:'likert',
    text:'When I commit to a deliverable, I track my progress daily and proactively flag risks early.',
    options:[{label:'Strongly Disagree',score:0},{label:'Disagree',score:25},{label:'Neutral',score:50},{label:'Agree',score:75},{label:'Strongly Agree',score:100}] },
  { id:'q13', code:'ADP01', competency:'Learning Agility',        domain:'Adaptability & Growth',          type:'likert',
    text:'I actively seek feedback and use it to rapidly improve my skills and approaches.',
    options:[{label:'Strongly Disagree',score:0},{label:'Disagree',score:25},{label:'Neutral',score:50},{label:'Agree',score:75},{label:'Strongly Agree',score:100}] },
  { id:'q14', code:'ADP02', competency:'Resilience',              domain:'Adaptability & Growth',          type:'likert',
    text:'I maintain focus and productivity even when facing setbacks or high-pressure situations.',
    options:[{label:'Strongly Disagree',score:0},{label:'Disagree',score:25},{label:'Neutral',score:50},{label:'Agree',score:75},{label:'Strongly Agree',score:100}] },
  { id:'q15', code:'ADP03', competency:'Innovation Mindset',      domain:'Adaptability & Growth',          type:'sjt',
    text:'A process your team has used for years is becoming inefficient. You:',
    options:[{label:'Continue the process since it is familiar to everyone',score:10},{label:'Research alternatives, prototype the best one, and present data to the team',score:100},{label:'Complain about the inefficiency without acting',score:5},{label:'Immediately switch to a new tool without team buy-in',score:40}] },
  { id:'q16', code:'TEC01', competency:'Technical Expertise',     domain:'Technical & Domain',             type:'likert',
    text:'I can apply deep domain knowledge to solve complex technical problems independently.',
    options:[{label:'Strongly Disagree',score:0},{label:'Disagree',score:25},{label:'Neutral',score:50},{label:'Agree',score:75},{label:'Strongly Agree',score:100}] },
  { id:'q17', code:'TEC02', competency:'Digital Fluency',         domain:'Technical & Domain',             type:'likert',
    text:'I regularly use digital tools and automation to improve my personal productivity.',
    options:[{label:'Strongly Disagree',score:0},{label:'Disagree',score:25},{label:'Neutral',score:50},{label:'Agree',score:75},{label:'Strongly Agree',score:100}] },
  { id:'q18', code:'EIQ01', competency:'Self-Awareness',          domain:'Emotional & Social Intelligence', type:'likert',
    text:'I regularly reflect on how my behavior and emotions affect those around me.',
    options:[{label:'Strongly Disagree',score:0},{label:'Disagree',score:25},{label:'Neutral',score:50},{label:'Agree',score:75},{label:'Strongly Agree',score:100}] },
  { id:'q19', code:'EIQ02', competency:'Self-Regulation',         domain:'Emotional & Social Intelligence', type:'likert',
    text:'I remain calm and composed when facing criticism or stressful situations at work.',
    options:[{label:'Strongly Disagree',score:0},{label:'Disagree',score:25},{label:'Neutral',score:50},{label:'Agree',score:75},{label:'Strongly Agree',score:100}] },
  { id:'q20', code:'EIQ05', competency:'Conflict Resolution',     domain:'Emotional & Social Intelligence', type:'sjt',
    text:'Two of your colleagues have an ongoing conflict that is affecting team productivity. You:',
    options:[{label:'Stay out of it — it is their personal issue',score:10},{label:'Take sides with the person you believe is right',score:20},{label:'Facilitate a structured conversation to understand each perspective and find common ground',score:100},{label:'Escalate immediately to HR without speaking to either party',score:50}] },
];

export const ASSESSMENT_ROLES      = ['Software Engineer','Product Manager','Data Analyst','Team Lead','Director','Consultant','Business Analyst','UX Designer','DevOps Engineer','Marketing Manager'] as const;
export const ASSESSMENT_STAGES     = ['junior','mid','senior','lead','director'] as const;
export const ASSESSMENT_INDUSTRIES = ['Technology','Finance','Healthcare','E-commerce','Manufacturing','Consulting','Education'] as const;

export const DOMAIN_COLORS: Record<string, string> = {
  'Cognitive & Analytical':        '#344E86',
  'Communication':                 '#4ECDC4',
  'Leadership & Initiative':       '#8b5cf6',
  'Execution & Delivery':          '#f4a261',
  'Adaptability & Growth':         '#2A9D8F',
  'Technical & Domain':            '#0ea5e9',
  'Emotional & Social Intelligence':'#ec4899',
};

export function computeScoresFromAnswers(answers: Record<string, number>): { competencyCode: string; rawScore: number; confidence: number }[] {
  const byCode: Record<string, number[]> = {};
  for (const q of ASSESSMENT_QUESTIONS) {
    if (answers[q.id] !== undefined) {
      if (!byCode[q.code]) byCode[q.code] = [];
      byCode[q.code].push(answers[q.id]);
    }
  }
  return Object.entries(byCode).map(([code, scores]) => ({
    competencyCode: code,
    rawScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    confidence: Math.min(1, scores.length / 2),
  }));
}
