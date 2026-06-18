// ============================================================================
// MetryxOne — Intervention catalog
// 7 intervention types × competency mappings, with provider/effort/EI-lift
// ============================================================================

export type InterventionType =
  | 'course' | 'certification' | 'project' | 'mentor' | 'mock-interview' | 'reading' | 'stretch';

export interface Intervention {
  id: string;
  type: InterventionType;
  title: string;
  provider: string;
  /** Competency IDs this intervention develops */
  competencies: string[];
  hours: number;
  /** INR cost; 0 = free */
  cost: number;
  /** Estimated EI-Index lift on completion */
  eiLift: number;
  url?: string;
  description: string;
}

export const INTERVENTIONS: Intervention[] = [
  // ── Courses ──────────────────────────────────────────────────────────────
  { id: 'c-react-advanced', type: 'course', title: 'Advanced React Patterns',
    provider: 'Frontend Masters', competencies: ['programming','systems-design'],
    hours: 12, cost: 3500, eiLift: 6, description: 'Hooks, suspense, server components, advanced state.' },
  { id: 'c-nodejs-prod', type: 'course', title: 'Node.js in Production',
    provider: 'Pluralsight', competencies: ['programming','systems-design'],
    hours: 14, cost: 2800, eiLift: 6, description: 'Build, deploy, scale, observe Node services.' },
  { id: 'c-python-ds', type: 'course', title: 'Python for Data Science',
    provider: 'DataCamp', competencies: ['programming','data-analysis'],
    hours: 20, cost: 2500, eiLift: 7, description: 'Pandas, NumPy, scikit-learn fundamentals.' },
  { id: 'c-sql-advanced', type: 'course', title: 'Advanced SQL & Window Functions',
    provider: 'Mode Analytics', competencies: ['data-analysis','data-engineering'],
    hours: 8, cost: 0, eiLift: 5, description: 'Joins, CTEs, window functions, query tuning.' },
  { id: 'c-system-design', type: 'course', title: 'Grokking the System Design Interview',
    provider: 'Educative', competencies: ['systems-design'],
    hours: 25, cost: 4000, eiLift: 8, description: 'Distributed-systems patterns at staff+ depth.' },
  { id: 'c-figma', type: 'course', title: 'Figma Master Class',
    provider: 'Designlab', competencies: ['visual-design','design-thinking'],
    hours: 10, cost: 3000, eiLift: 5, description: 'Components, variants, auto-layout, design systems.' },
  { id: 'c-ml-coursera', type: 'course', title: 'Machine Learning Specialization',
    provider: 'Coursera (Andrew Ng)', competencies: ['statistics','data-analysis'],
    hours: 60, cost: 4900, eiLift: 12, description: 'Supervised, unsupervised, recommenders.' },
  { id: 'c-llm-rag', type: 'course', title: 'Building LLM Applications with RAG',
    provider: 'DeepLearning.AI', competencies: ['programming','statistics'],
    hours: 16, cost: 0, eiLift: 9, description: 'Vector DBs, embeddings, prompt orchestration.' },
  { id: 'c-prod-thinking', type: 'course', title: 'Product Thinking',
    provider: 'Reforge', competencies: ['business-acumen','strategy'],
    hours: 18, cost: 12000, eiLift: 8, description: 'Frameworks for opportunity sizing & prioritization.' },
  { id: 'c-ux-research', type: 'course', title: 'UX Research Foundations',
    provider: 'Nielsen Norman', competencies: ['research','design-thinking'],
    hours: 14, cost: 8500, eiLift: 7, description: 'Interviewing, synthesis, usability testing.' },
  { id: 'c-financial-modeling', type: 'course', title: 'Financial Modeling & Valuation',
    provider: 'Wall Street Prep', competencies: ['data-analysis','business-acumen'],
    hours: 30, cost: 9000, eiLift: 9, description: 'Three-statement models, DCF, comparables.' },
  { id: 'c-storytelling', type: 'course', title: 'Storytelling with Data',
    provider: 'storytellingwithdata.com', competencies: ['storytelling','presentation'],
    hours: 8, cost: 2000, eiLift: 5, description: 'Turn dashboards into decisions.' },
  { id: 'c-leadership', type: 'course', title: 'Manager Tools — First-Time Manager',
    provider: 'Manager Tools', competencies: ['people-mgmt','mentoring'],
    hours: 20, cost: 5000, eiLift: 8, description: '1:1s, feedback, delegation, performance.' },

  // ── Certifications ───────────────────────────────────────────────────────
  { id: 'cert-aws-saa', type: 'certification', title: 'AWS Solutions Architect Associate',
    provider: 'Amazon Web Services', competencies: ['cloud','systems-design'],
    hours: 80, cost: 12500, eiLift: 12, description: 'Industry-standard cloud architecture cert.' },
  { id: 'cert-gcp-pde', type: 'certification', title: 'GCP Professional Data Engineer',
    provider: 'Google Cloud', competencies: ['data-engineering','cloud'],
    hours: 90, cost: 16000, eiLift: 13, description: 'Data pipelines, ML on GCP.' },
  { id: 'cert-pmp', type: 'certification', title: 'PMP — Project Management Professional',
    provider: 'PMI', competencies: ['project-mgmt','stakeholder-mgmt'],
    hours: 120, cost: 45000, eiLift: 15, description: 'Gold-standard PM credential.' },
  { id: 'cert-cspo', type: 'certification', title: 'Certified Scrum Product Owner',
    provider: 'Scrum Alliance', competencies: ['business-acumen','project-mgmt'],
    hours: 16, cost: 30000, eiLift: 7, description: 'Agile product ownership.' },
  { id: 'cert-cka', type: 'certification', title: 'Certified Kubernetes Administrator',
    provider: 'CNCF', competencies: ['cloud','systems-design'],
    hours: 60, cost: 30000, eiLift: 11, description: 'Hands-on K8s operations.' },
  { id: 'cert-cissp', type: 'certification', title: 'CISSP — Certified Info Sec Professional',
    provider: 'ISC²', competencies: ['security','strategy'],
    hours: 150, cost: 60000, eiLift: 14, description: 'Senior security leadership credential.' },
  { id: 'cert-tableau', type: 'certification', title: 'Tableau Desktop Specialist',
    provider: 'Tableau', competencies: ['data-analysis','storytelling'],
    hours: 25, cost: 8000, eiLift: 6, description: 'Foundational BI cert.' },

  // ── Projects ─────────────────────────────────────────────────────────────
  { id: 'p-saas-mvp', type: 'project', title: 'Ship a SaaS MVP end-to-end',
    provider: 'Self-directed', competencies: ['programming','systems-design','business-acumen'],
    hours: 60, cost: 0, eiLift: 14, description: 'Auth, payments, deploy, get 5 real users.' },
  { id: 'p-data-dashboard', type: 'project', title: 'Build an analytics dashboard from a public dataset',
    provider: 'Self-directed', competencies: ['data-analysis','storytelling'],
    hours: 20, cost: 0, eiLift: 8, description: 'Source → clean → model → publish insights.' },
  { id: 'p-design-redesign', type: 'project', title: 'Redesign a popular app & publish case study',
    provider: 'Self-directed', competencies: ['design-thinking','visual-design','storytelling'],
    hours: 30, cost: 0, eiLift: 10, description: 'Research-driven redesign, Behance case study.' },
  { id: 'p-ml-kaggle', type: 'project', title: 'Top-25% finish in a Kaggle competition',
    provider: 'Kaggle', competencies: ['statistics','data-analysis'],
    hours: 40, cost: 0, eiLift: 11, description: 'Public proof of ML chops.' },
  { id: 'p-llm-app', type: 'project', title: 'Build a RAG chatbot on your own docs',
    provider: 'Self-directed', competencies: ['programming','systems-design'],
    hours: 25, cost: 500, eiLift: 10, description: 'Embeddings + vector DB + LLM, deployed.' },
  { id: 'p-cicd-pipeline', type: 'project', title: 'Set up CI/CD for an open-source repo',
    provider: 'Self-directed', competencies: ['cloud','process'],
    hours: 15, cost: 0, eiLift: 7, description: 'Lint, test, deploy on every PR.' },
  { id: 'p-prd', type: 'project', title: 'Write a product requirements doc with metrics',
    provider: 'Self-directed', competencies: ['business-acumen','writing','stakeholder-mgmt'],
    hours: 10, cost: 0, eiLift: 6, description: 'Real PRD shareable with hiring managers.' },

  // ── Mentor sessions ──────────────────────────────────────────────────────
  { id: 'm-1on1-pm', type: 'mentor', title: '1:1 with a Senior PM',
    provider: 'Mentor Connect', competencies: ['business-acumen','strategy','stakeholder-mgmt'],
    hours: 1, cost: 1500, eiLift: 3, description: 'Coaching call on PM craft & career.' },
  { id: 'm-1on1-eng', type: 'mentor', title: '1:1 with a Staff Engineer',
    provider: 'Mentor Connect', competencies: ['programming','systems-design','mentoring'],
    hours: 1, cost: 1500, eiLift: 3, description: 'Tech-lead path coaching.' },
  { id: 'm-1on1-design', type: 'mentor', title: '1:1 with a Design Lead',
    provider: 'Mentor Connect', competencies: ['design-thinking','visual-design'],
    hours: 1, cost: 1500, eiLift: 3, description: 'Portfolio + craft critique.' },

  // ── Mock interviews ──────────────────────────────────────────────────────
  { id: 'mi-system-design', type: 'mock-interview', title: 'Mock systems-design interview',
    provider: 'Pragati AI Interview', competencies: ['systems-design','presentation'],
    hours: 1, cost: 0, eiLift: 4, description: 'Live whiteboard with AI examiner + rubric.' },
  { id: 'mi-coding', type: 'mock-interview', title: 'Mock coding interview (DSA)',
    provider: 'Pragati AI Interview', competencies: ['programming'],
    hours: 1, cost: 0, eiLift: 4, description: 'Algorithmic problem-solving practice.' },
  { id: 'mi-product', type: 'mock-interview', title: 'Mock product-sense interview',
    provider: 'Pragati AI Interview', competencies: ['business-acumen','storytelling'],
    hours: 1, cost: 0, eiLift: 4, description: 'Product framing + structured response.' },
  { id: 'mi-behavioral', type: 'mock-interview', title: 'Mock behavioral interview',
    provider: 'Pragati AI Interview', competencies: ['storytelling','collaboration'],
    hours: 1, cost: 0, eiLift: 3, description: 'STAR-format coaching on impact stories.' },

  // ── Reading ──────────────────────────────────────────────────────────────
  { id: 'r-designing-data', type: 'reading', title: 'Designing Data-Intensive Applications',
    provider: 'Martin Kleppmann', competencies: ['systems-design','data-engineering'],
    hours: 30, cost: 800, eiLift: 8, description: 'The reference for backend depth.' },
  { id: 'r-inspired', type: 'reading', title: 'Inspired — Marty Cagan',
    provider: 'SVPG', competencies: ['business-acumen','strategy'],
    hours: 12, cost: 700, eiLift: 5, description: 'Modern product management bible.' },
  { id: 'r-storyworthy', type: 'reading', title: 'Storyworthy',
    provider: 'Matthew Dicks', competencies: ['storytelling','presentation'],
    hours: 8, cost: 600, eiLift: 4, description: 'Build memorable stories from real life.' },
  { id: 'r-thinking-fast', type: 'reading', title: 'Thinking, Fast and Slow',
    provider: 'Kahneman', competencies: ['research','business-acumen'],
    hours: 20, cost: 600, eiLift: 5, description: 'Behavioral economics fundamentals.' },

  // ── Stretch assignments ──────────────────────────────────────────────────
  { id: 's-tech-talk', type: 'stretch', title: 'Give a 20-min tech talk at a meetup',
    provider: 'Self-organized', competencies: ['presentation','storytelling','programming'],
    hours: 12, cost: 0, eiLift: 8, description: 'Public proof of expertise.' },
  { id: 's-blog-series', type: 'stretch', title: 'Publish a 3-part technical blog series',
    provider: 'Self-published', competencies: ['writing','storytelling'],
    hours: 20, cost: 0, eiLift: 7, description: 'SEO-friendly long-form on a depth topic.' },
  { id: 's-oss-contribution', type: 'stretch', title: 'Land 3 PRs in a popular OSS repo',
    provider: 'GitHub', competencies: ['programming','collaboration'],
    hours: 25, cost: 0, eiLift: 9, description: 'Visible craftsmanship signal.' },
  { id: 's-team-lead', type: 'stretch', title: 'Lead a small cross-functional initiative',
    provider: 'Current employer', competencies: ['people-mgmt','stakeholder-mgmt','project-mgmt'],
    hours: 40, cost: 0, eiLift: 12, description: 'Earn the next role before applying.' },
];

export const INTERVENTION_LABELS: Record<InterventionType, { label: string; emoji: string }> = {
  'course':         { label: 'Course',          emoji: '📘' },
  'certification':  { label: 'Certification',   emoji: '🎓' },
  'project':        { label: 'Project',         emoji: '🛠' },
  'mentor':         { label: 'Mentor session',  emoji: '🤝' },
  'mock-interview': { label: 'Mock interview',  emoji: '🎤' },
  'reading':        { label: 'Reading',         emoji: '📖' },
  'stretch':        { label: 'Stretch assignment', emoji: '🚀' },
};
