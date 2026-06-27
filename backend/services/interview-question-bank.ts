/**
 * Interview Question Bank (structured, rubric-bearing)
 * ----------------------------------------------------------------------------
 * Authored, deterministic screening questions with grading rubric fields
 * (expectedResponse + scoringCriteria). This is legitimate, human-authored
 * content — NOT model output, and nothing here is fabricated at runtime.
 *
 * The bank is served from the Node backend (so the employer voice-screening
 * feature has a single, real source of structured questions) and is consumed by
 * the voice-screening engine. `selectQuestions` picks a role/industry-tailored
 * set with a graceful General fallback so a screen always has enough questions.
 *
 * Each question is mapped to one of the five voice-screening dimensions so the
 * scorer can attribute evidence consistently with the report UI.
 */

export interface BankQuestion {
  id: string;
  question: string;
  expectedResponse: string;
  scoringCriteria: string;
  category: string;
  industry: string;
  role: string;
  positionLevel: string;
  difficulty: string;
  dimension: string;
  tags: string[];
}

// ── Category → voice-screening dimension ─────────────────────────────────────
// Keeps scorer evidence attribution aligned with the five report dimensions.
const CATEGORY_TO_DIMENSION: Record<string, string> = {
  Behavioral: 'confidence_composure',
  HR: 'cultural_alignment',
  Technical: 'role_knowledge',
  Situational: 'responsiveness',
  Leadership: 'cultural_alignment',
  'Culture Fit': 'cultural_alignment',
  'Problem Solving': 'role_knowledge',
};
const dimensionFor = (category: string): string =>
  CATEGORY_TO_DIMENSION[category] || 'communication_clarity';

let _seq = 0;
const q = (
  question: string,
  expectedResponse: string,
  scoringCriteria: string,
  category: string,
  industry: string,
  role: string,
  positionLevel: string,
  difficulty: string,
  tags: string[] = [],
): BankQuestion => ({
  id: `iqb-${String(++_seq).padStart(3, '0')}`,
  question,
  expectedResponse,
  scoringCriteria,
  category,
  industry,
  role,
  positionLevel,
  difficulty,
  dimension: dimensionFor(category),
  tags,
});

// ── The bank (ported verbatim from the structured authored source) ───────────
const QUESTION_BANK: BankQuestion[] = [
  // ── BEHAVIORAL — General ────────────────────────────────────────────────
  q('Tell me about yourself and why you are interested in this role.',
    'Candidate should give a brief professional summary (2–3 min), highlight relevant skills/experience, and clearly connect their background to the role. Should NOT just recite resume — should show enthusiasm.',
    'Score: 0–10. 8–10: concise, confident, role-relevant. 5–7: decent but generic. <5: unfocused or nervous.',
    'Behavioral', 'General', 'General', 'Any', 'Easy', ['intro', 'communication']),

  q('Describe a situation where you had to handle multiple priorities simultaneously. How did you manage?',
    'Should use STAR method: explain the situation, describe how they prioritized (tools/frameworks like urgency-importance matrix), what actions they took, and the outcome. Ideal: used some system, communicated clearly with stakeholders.',
    'Score 0–10. Look for: concrete example, clear prioritization logic, positive outcome, reflection on what they learned.',
    'Behavioral', 'General', 'General', 'Any', 'Medium', ['time-management', 'prioritization']),

  q('Tell me about a time you made a mistake at work. What happened and how did you handle it?',
    'Candidate should own the mistake (not deflect), explain their thought process, describe what they did to fix it, and what they learned. Red flag: blaming others or saying "I never make mistakes".',
    'Score 0–10. 8–10: honest, shows accountability + corrective action + learning. 5–7: admits mistake but weak on learning. <5: deflects blame.',
    'Behavioral', 'General', 'General', 'Any', 'Medium', ['accountability', 'growth-mindset']),

  q('Where do you see yourself in 5 years?',
    'Should show ambition within a realistic career trajectory aligned with the company/role. Avoid: "I want to start my own company in 3 years" (leaving), vague answers, or clearly scripted responses.',
    'Score 0–10. 8–10: specific, company-aligned, shows progression plan. 5–7: generic but positive. <5: unrealistic or disengaged.',
    'Behavioral', 'General', 'General', 'Any', 'Easy', ['career-goals', 'ambition']),

  q('Tell me about a time you had a conflict with a colleague or manager. How did you resolve it?',
    'Should demonstrate emotional intelligence: describe the conflict factually (not emotionally), explain the steps taken to resolve it, mention positive outcome or learning. Avoid: blaming the other person exclusively.',
    'Score 0–10. Look for: de-escalation approach, communication skills, focus on resolution over blame.',
    'Behavioral', 'General', 'General', 'Any', 'Medium', ['conflict-resolution', 'EQ']),

  q('Why are you looking to leave your current job (or why did you leave your last job)?',
    'Should give professional, forward-looking reasons (growth opportunity, skill expansion, better role fit). Avoid: badmouthing previous employer, purely financial reasons without context.',
    'Score 0–10. 8–10: positive framing, growth-focused. 5–7: neutral. <5: negative about previous employer.',
    'Behavioral', 'General', 'General', 'Any', 'Easy', ['motivation', 'professionalism']),

  // ── HR / Culture Fit — General ───────────────────────────────────────────
  q('What are your salary expectations?',
    'Should give a researched range (not just "whatever you offer"). Ideal: mentions market research, shows flexibility, and grounds the expectation in their experience level.',
    'Score 0–10. 8–10: data-backed range, flexible. 5–7: reasonable but vague. <5: refuses to answer or extreme mismatch.',
    'HR', 'General', 'General', 'Any', 'Easy', ['salary', 'negotiation']),

  q('What are your greatest strengths? Give an example for each.',
    'Should mention 2–3 strengths directly relevant to the role, backed by specific examples (not just listing attributes). Avoid: humblebrags ("I work too hard") or generic answers.',
    'Score 0–10. Look for: relevance to role, specificity of examples, confidence without arrogance.',
    'HR', 'General', 'General', 'Any', 'Easy', ['self-awareness', 'strengths']),

  q('What is your biggest weakness? How are you working on it?',
    'Should be honest about a genuine weakness (not a disguised strength). Candidate must demonstrate active effort to improve. Red flag: "I have no weaknesses" or a weakness that is critical to the role.',
    'Score 0–10. 8–10: genuine weakness + concrete improvement steps. 5–7: honest but weak on action plan. <5: deflects or lies.',
    'HR', 'General', 'General', 'Any', 'Easy', ['self-awareness', 'growth']),

  // ── TECHNOLOGY — Software Engineer ───────────────────────────────────────
  q('Explain the difference between a stack and a queue. When would you use each?',
    'Stack: LIFO (Last In, First Out) — use cases: function call stacks, undo operations, expression evaluation. Queue: FIFO (First In, First Out) — use cases: job scheduling, message queues, BFS traversal. Should give a real example.',
    'Score 0–10. 8–10: correct definition + practical use case. 5–7: correct but vague on use cases. <5: confused definitions.',
    'Technical', 'Technology', 'Software Engineer', 'Any', 'Easy', ['data-structures']),

  q('What is the difference between SQL and NoSQL databases? When would you choose one over the other?',
    'SQL: relational, structured schema, ACID compliance, good for complex queries (e.g., PostgreSQL, MySQL). NoSQL: flexible schema, horizontally scalable, good for large-scale/unstructured data (e.g., MongoDB, Cassandra). Candidate should mention a decision criterion.',
    'Score 0–10. Look for: correct properties of each, a coherent decision framework.',
    'Technical', 'Technology', 'Software Engineer', 'Any', 'Medium', ['databases']),

  q('What is Big-O notation? Give the time complexity of common operations on an array vs a linked list.',
    'Big-O: describes algorithm performance as input size grows. Array: O(1) access, O(n) search, O(n) insert/delete. Linked List: O(n) access/search, O(1) insert/delete (at head). Candidate should explain the tradeoffs.',
    'Score 0–10. 8–10: correct complexities + tradeoff explanation. 5–7: mostly correct. <5: significant errors.',
    'Technical', 'Technology', 'Software Engineer', 'Junior', 'Medium', ['algorithms', 'complexity']),

  q('Explain RESTful API design principles. What makes a good API?',
    'REST principles: stateless, client-server, cacheable, layered, uniform interface. Good API: clear naming (nouns, not verbs), correct HTTP methods (GET/POST/PUT/DELETE), consistent response formats, proper error codes, versioning, authentication.',
    'Score 0–10. Look for: understanding of REST constraints, practical API design sense.',
    'Technical', 'Technology', 'Software Engineer', 'Mid-Level', 'Medium', ['API-design', 'REST']),

  q('How would you debug a performance issue in a production web application?',
    'Should mention: profiling (CPU/memory), identifying bottlenecks (database queries, N+1 problems, slow APIs), APM tools (Datadog, New Relic, Sentry), load testing, logging analysis, caching strategies.',
    'Score 0–10. 8–10: systematic debugging approach with real tools. 5–7: good instincts but incomplete. <5: guessing.',
    'Technical', 'Technology', 'Software Engineer', 'Senior', 'Hard', ['debugging', 'performance']),

  q('What is CI/CD? Describe the pipeline in your last project.',
    'CI: Continuous Integration — code is merged often, automated tests run. CD: Continuous Delivery/Deployment — automated build, test, deploy. Candidate should describe stages: code push → lint → unit test → build → integration test → deploy to staging → deploy to prod.',
    'Score 0–10. Look for: concrete pipeline stages, tools used (GitHub Actions, Jenkins, GitLab CI), deployment strategy.',
    'Technical', 'Technology', 'Software Engineer', 'Mid-Level', 'Medium', ['DevOps', 'CI-CD']),

  // ── TECHNOLOGY — Data Analyst ─────────────────────────────────────────────
  q('Walk me through how you would approach a new data analysis problem.',
    'Should describe: understanding the business question, gathering/validating data, EDA (distributions, outliers, missing values), choosing analysis method, visualizing results, communicating insights to stakeholders.',
    'Score 0–10. Look for: structured approach, mention of data quality checks, business impact framing.',
    'Technical', 'Technology', 'Data Analyst', 'Any', 'Medium', ['data-analysis', 'EDA']),

  q('What is the difference between supervised and unsupervised machine learning? Give an example of each.',
    'Supervised: model trained on labeled data (classification, regression) — e.g., spam detection, price prediction. Unsupervised: model finds patterns in unlabeled data (clustering, dimensionality reduction) — e.g., customer segmentation, anomaly detection.',
    'Score 0–10. 8–10: correct definitions + real business examples. 5–7: correct but abstract. <5: confused.',
    'Technical', 'Technology', 'Data Analyst', 'Mid-Level', 'Medium', ['machine-learning']),

  q('How do you handle missing data in a dataset?',
    'Options: drop rows (if <5% and random), imputation (mean/median/mode for numeric, mode for categorical), model-based imputation (KNN, MICE), or treat missing as a feature. Candidate should ask what the missing data represents and choose accordingly.',
    'Score 0–10. Look for: awareness of different strategies, business context consideration.',
    'Technical', 'Technology', 'Data Analyst', 'Any', 'Medium', ['data-cleaning']),

  // ── FINANCE — General ─────────────────────────────────────────────────────
  q('Explain the difference between accounts payable and accounts receivable.',
    'Accounts Payable (AP): money the company owes to suppliers/vendors (liability on balance sheet). Accounts Receivable (AR): money owed to the company by customers (asset on balance sheet). Both affect working capital.',
    'Score 0–10. 8–10: correct definitions + balance sheet placement + working capital context. 5–7: correct but surface level.',
    'Technical', 'Finance', 'Finance Analyst', 'Any', 'Easy', ['accounting', 'fundamentals']),

  q('What is EBITDA and why is it used in financial analysis?',
    'EBITDA: Earnings Before Interest, Taxes, Depreciation, and Amortization. Used to measure operational profitability excluding non-cash charges and capital structure effects. Used in valuation (EV/EBITDA multiple), comparing companies across capital structures.',
    'Score 0–10. 8–10: correct formula + why it matters for comparison + limitations. 5–7: correct formula but weak on application.',
    'Technical', 'Finance', 'Finance Analyst', 'Mid-Level', 'Medium', ['valuation', 'EBITDA']),

  q('Walk me through a DCF (Discounted Cash Flow) valuation.',
    'Steps: (1) Project free cash flows for 5–10 years, (2) Calculate terminal value (Gordon Growth or Exit Multiple), (3) Discount FCFs and TV to present value using WACC, (4) Sum PVs = enterprise value, (5) Subtract net debt = equity value. Candidate should know WACC components.',
    'Score 0–10. 8–10: correct steps, mentions WACC, terminal value approaches. 5–7: mostly correct. <5: missing key steps.',
    'Technical', 'Finance', 'Investment Analyst', 'Mid-Level', 'Hard', ['DCF', 'valuation']),

  // ── HEALTHCARE ────────────────────────────────────────────────────────────
  q('How do you ensure compliance with healthcare data privacy regulations (HIPAA or similar)?',
    'Should mention: data encryption (at rest and in transit), access controls (role-based), audit trails, minimum necessary principle, BAA with vendors, training, incident response plan.',
    'Score 0–10. Look for: awareness of regulatory framework, practical controls mentioned.',
    'Technical', 'Healthcare', 'Healthcare IT', 'Any', 'Medium', ['compliance', 'HIPAA', 'data-privacy']),

  q('How do you handle a situation where a patient or client is in distress?',
    'Should demonstrate: calm demeanor, active listening, empathy without overpromising, escalation protocol (supervisor, emergency services if needed), documentation. Red flag: minimizing or dismissing the situation.',
    'Score 0–10. Look for: empathy + structured response + escalation awareness.',
    'Situational', 'Healthcare', 'Healthcare Professional', 'Any', 'Medium', ['empathy', 'crisis-response']),

  // ── MANUFACTURING ─────────────────────────────────────────────────────────
  q('What is Lean manufacturing? Name and explain two Lean principles.',
    'Lean: methodology to reduce waste and increase efficiency. Principles include: Value (define from customer POV), Value Stream Mapping, Flow, Pull (produce based on demand), Perfection (continuous improvement/Kaizen). Two examples: Just-in-Time + 5S.',
    'Score 0–10. 8–10: clear definition + 2 specific principles with examples. 5–7: vague but directionally correct. <5: confused with Six Sigma or other methodologies.',
    'Technical', 'Manufacturing', 'Operations Engineer', 'Any', 'Medium', ['lean', 'manufacturing']),

  q('What is Six Sigma? Explain the DMAIC cycle.',
    'Six Sigma: quality improvement methodology targeting 3.4 defects per million opportunities. DMAIC: Define (problem & goals), Measure (current performance), Analyze (root causes), Improve (solutions), Control (sustain gains). Candidate should give an example use case.',
    'Score 0–10. 8–10: correct DMAIC phases with context. 5–7: mostly correct. <5: confuses DMAIC phases.',
    'Technical', 'Manufacturing', 'Quality Engineer', 'Any', 'Medium', ['six-sigma', 'quality']),

  // ── SALES & MARKETING ─────────────────────────────────────────────────────
  q('Sell me this product (hand something generic — pen, glass of water, etc.).',
    'Candidate should: ask questions to understand "buyer\'s" needs, position the product to meet those needs, handle objections, close confidently. Avoid: feature-dumping without understanding needs.',
    'Score 0–10. 8–10: needs discovery first, benefits-focused pitch, confident close. 5–7: decent pitch but skips needs discovery. <5: feature-dumps or becomes awkward.',
    'Situational', 'Sales & Marketing', 'Sales Executive', 'Any', 'Medium', ['sales', 'persuasion']),

  q('Walk me through how you would build a digital marketing campaign from scratch.',
    'Steps: (1) Define goal + KPIs, (2) Audience research, (3) Channel selection (social, SEO, email, PPC), (4) Content creation, (5) Budget allocation, (6) Launch + A/B testing, (7) Analysis + optimization. Should mention attribution.',
    'Score 0–10. Look for: structured approach, awareness of multiple channels, measurement focus.',
    'Technical', 'Sales & Marketing', 'Marketing Manager', 'Any', 'Medium', ['digital-marketing', 'strategy']),

  // ── LEADERSHIP / MANAGEMENT ───────────────────────────────────────────────
  q('Tell me about a time you led a team through a challenging situation.',
    'Should describe: the challenge clearly, their specific leadership actions (not just team actions), how they motivated the team, what the outcome was, what they would do differently. Red flag: using "we" exclusively without explaining personal role.',
    'Score 0–10. Look for: personal accountability for leadership decisions, team empathy, outcome focus.',
    'Leadership', 'General', 'Manager', 'Senior', 'Medium', ['leadership', 'team-management']),

  q('How do you handle underperforming team members?',
    'Should mention: private conversation first (not public), understand root cause (personal/skill/motivation issue), set clear expectations with support, follow up, document, and if no improvement — manage out through proper HR process.',
    'Score 0–10. 8–10: structured approach, empathetic but firm. 5–7: some good steps but incomplete. <5: too harsh or too passive.',
    'Leadership', 'General', 'Manager', 'Senior', 'Hard', ['people-management', 'performance']),

  q('How do you prioritize your team\'s work when everything is a priority?',
    'Should describe a prioritization framework (impact vs. effort, OKRs, stakeholder alignment), how they communicate trade-offs upward, how they protect the team from scope creep, and how they revisit priorities regularly.',
    'Score 0–10. Look for: framework awareness, stakeholder communication skills, decisiveness.',
    'Leadership', 'General', 'Manager', 'Any', 'Medium', ['prioritization', 'management']),

  // ── CULTURE FIT / SITUATIONAL ─────────────────────────────────────────────
  q('How do you stay updated with trends and developments in your field?',
    'Ideal: specific sources (publications, communities, conferences, online courses), regular habits (weekly newsletters, podcasts), applying learning at work. Avoid: vague answers like "I just Google things".',
    'Score 0–10. 8–10: specific, proactive learning habits. 5–7: general but positive. <5: no clear habits.',
    'Culture Fit', 'General', 'General', 'Any', 'Easy', ['learning', 'growth-mindset']),

  q('Describe the ideal work environment for you to do your best work.',
    'Should reveal cultural preferences (collaborative vs. independent, fast-paced vs. structured, autonomy vs. direction). Interviewer checks if it aligns with company culture. No wrong answer — but mismatch is a flag.',
    'Score 0–10. 8–10: specific, self-aware, aligns with company culture. 5–7: generic. <5: misaligned or vague.',
    'Culture Fit', 'General', 'General', 'Any', 'Easy', ['culture', 'work-style']),

  q('If given a task with no clear instructions, what do you do?',
    'Should show: clarifying questions upfront (not guessing), independent thinking, checking in at key milestones, communicating proactively. Avoid: just doing it wrong or paralysis.',
    'Score 0–10. Look for: initiative balanced with communication, structured approach.',
    'Situational', 'General', 'General', 'Any', 'Easy', ['initiative', 'communication']),

  q('A key client calls very upset about a service failure that was not your fault. How do you handle it?',
    'Should: acknowledge the problem empathetically (without deflecting blame), take ownership of the resolution (not just say "it\'s not my department"), provide a clear next step with a timeline, escalate internally as needed.',
    'Score 0–10. Look for: empathy first, solution-focused, professional composure under pressure.',
    'Situational', 'General', 'General', 'Any', 'Medium', ['client-management', 'conflict-resolution']),

  // ── EDUCATION SECTOR ─────────────────────────────────────────────────────
  q('How do you differentiate instruction for students with varying learning needs?',
    'Should mention: pre-assessment to understand student baseline, tiered activities, flexible grouping, UDL (Universal Design for Learning) principles, use of technology for personalization.',
    'Score 0–10. Look for: concrete strategies, awareness of diverse learning styles, student-centered approach.',
    'Technical', 'Education', 'Teacher', 'Any', 'Medium', ['pedagogy', 'differentiation']),

  q('How do you handle a disruptive student in a classroom without derailing the lesson?',
    'Should describe: calm response (not escalating), restorative practices, private conversation post-class, understanding root cause (boredom, personal issue, attention-seeking), partnering with parents/counsellors if persistent.',
    'Score 0–10. Look for: de-escalation skills, empathy, structured response.',
    'Situational', 'Education', 'Teacher', 'Any', 'Medium', ['classroom-management', 'EQ']),

  // ── PRODUCT MANAGEMENT ───────────────────────────────────────────────────
  q('How do you decide what to build next? Walk me through your prioritization process.',
    'Should mention: user research/feedback, business impact, technical feasibility (RICE or similar framework), alignment with roadmap and OKRs, stakeholder input, and communicating decisions clearly.',
    'Score 0–10. 8–10: structured framework + mentions trade-offs + stakeholder communication. 5–7: good intuition but informal. <5: feature-driven without user/business grounding.',
    'Technical', 'Technology', 'Product Manager', 'Mid-Level', 'Hard', ['product', 'prioritization', 'roadmap']),

  q('How do you define and measure the success of a product feature?',
    'Should define success metrics (adoption rate, retention, NPS, revenue impact) before building, establish baseline, A/B test where possible, monitor post-launch, and have a rollback plan if metrics worsen.',
    'Score 0–10. Look for: metric-first thinking, A/B testing awareness, post-launch monitoring.',
    'Technical', 'Technology', 'Product Manager', 'Any', 'Medium', ['product', 'metrics']),

  // ── HR ROLE-SPECIFIC ─────────────────────────────────────────────────────
  q('How do you source passive candidates for hard-to-fill roles?',
    'Should mention: LinkedIn Recruiter (boolean search, InMail strategies), employee referrals, talent communities, GitHub/Dribbble for technical roles, conference networking, alumni databases, engaging passive candidates with personalized outreach.',
    'Score 0–10. Look for: multi-channel approach, personalization, passive candidate engagement skills.',
    'Technical', 'General', 'HR Recruiter', 'Any', 'Medium', ['recruiting', 'sourcing']),

  q('How do you evaluate cultural fit without introducing bias?',
    'Should mention: structured interviews with defined criteria, calibration with the team, blind resume screening, diverse interview panels, evaluating culture "add" not just fit, consistent scoring rubrics.',
    'Score 0–10. Look for: awareness of bias + structured approach to reduce it.',
    'Technical', 'General', 'HR Recruiter', 'Any', 'Hard', ['HR', 'culture', 'bias']),

  // ── FRESHER-SPECIFIC ─────────────────────────────────────────────────────
  q('As a fresh graduate, what relevant projects or coursework have you completed that prepare you for this role?',
    'Should describe 1–2 specific projects with: problem solved, technologies used, role they played, outcome/learning. Not just listing course names — should show depth.',
    'Score 0–10. 8–10: specific, outcome-focused project descriptions. 5–7: mentions projects but vague. <5: only lists course names.',
    'Behavioral', 'General', 'General', 'Fresher', 'Easy', ['projects', 'freshers']),

  q('You have no work experience. How would you prove your value in the first 90 days?',
    'Should show: eagerness to learn quickly, initiative (proactive questions, extra effort), taking on small projects to demonstrate skills, building relationships with teammates, tracking and communicating progress.',
    'Score 0–10. Look for: self-awareness + specific action plan + realistic expectations.',
    'Behavioral', 'General', 'General', 'Fresher', 'Easy', ['freshers', 'onboarding']),

  q('Tell me about a time you worked in a team — even in college or a project. What was your role?',
    'Should describe: specific team situation, their role (leader/contributor/coordinator), how they handled team dynamics, outcome. College project, sports team, club all count.',
    'Score 0–10. 8–10: specific story with clear role + team dynamics + outcome. 5–7: vague teamwork reference. <5: no clear example.',
    'Behavioral', 'General', 'General', 'Fresher', 'Easy', ['teamwork', 'freshers']),

  // ── PROBLEM SOLVING ──────────────────────────────────────────────────────
  q('Walk me through how you would solve a problem you\'ve never faced before.',
    'Should describe: gathering information (research, asking experts), breaking the problem into smaller parts, generating multiple solutions, evaluating trade-offs, choosing and implementing, learning from outcome.',
    'Score 0–10. Look for: structured problem-solving approach, curiosity, intellectual humility.',
    'Problem Solving', 'General', 'General', 'Any', 'Medium', ['problem-solving', 'critical-thinking']),

  q('How do you approach learning a completely new technology or skill required for your work?',
    'Should mention: official documentation, structured courses, building a small project, community resources (Stack Overflow, GitHub), pair programming, timeline for reaching competence.',
    'Score 0–10. 8–10: concrete learning strategy + past example of rapid skill acquisition. 5–7: positive attitude but vague. <5: no clear strategy.',
    'Problem Solving', 'General', 'General', 'Any', 'Easy', ['learning', 'adaptability']),
];

export function getQuestionBank(): BankQuestion[] {
  return QUESTION_BANK;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Select a role/industry-tailored question set with a graceful General fallback.
 * Always returns a balanced set: role/industry-specific questions first, then
 * General questions to top up to `limit`. Never fabricates — only returns
 * authored bank rows.
 */
export function selectQuestions(opts: {
  role?: string;
  industry?: string;
  level?: string;
  limit?: number;
} = {}): BankQuestion[] {
  const role = norm(opts.role || '');
  const industry = norm(opts.industry || '');
  const level = norm(opts.level || '');
  const limit = Math.max(1, Math.min(20, opts.limit ?? 8));

  const levelOk = (q: BankQuestion) =>
    !level || level === 'all' || norm(q.positionLevel) === level || norm(q.positionLevel) === 'any';
  const roleOk = (q: BankQuestion) =>
    !role || norm(q.role) === role || norm(q.role) === 'general';
  const industryOk = (q: BankQuestion) =>
    !industry || norm(q.industry) === industry || norm(q.industry) === 'general';

  // Tier 1: role-specific (and industry/level compatible).
  const specific = QUESTION_BANK.filter(
    (q) => role && norm(q.role) === role && industryOk(q) && levelOk(q),
  );
  // Tier 2: industry-specific (non-General industry match).
  const byIndustry = QUESTION_BANK.filter(
    (q) => industry && norm(q.industry) === industry && norm(q.industry) !== 'general' && levelOk(q),
  );
  // Tier 3: General / universally-applicable questions.
  const general = QUESTION_BANK.filter(
    (q) => roleOk(q) && industryOk(q) && levelOk(q) && norm(q.role) === 'general',
  );

  const seen = new Set<string>();
  const out: BankQuestion[] = [];
  for (const pool of [specific, byIndustry, general, QUESTION_BANK]) {
    for (const q of pool) {
      if (out.length >= limit) break;
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      out.push(q);
    }
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}
