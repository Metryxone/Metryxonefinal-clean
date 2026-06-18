/**
 * Adaptive Question Bank v2 (Phase 2).
 *
 * Catalog-only, additive. Used by `AdaptiveAssessmentRuntime` to render
 * client-side fallback questions when the backend defers to pool keys
 * without server-rendered question bodies.
 *
 * Each question carries optional affinity tags (`role_tags`, `industry_tags`,
 * `stage_tags`, `function_tags`) so the runtime can prefer items that match
 * the candidate's actual context — e.g. an HR leader sees workforce / talent
 * scenarios, an engineer sees system-design / dependency scenarios, etc.
 */

export type QuestionType =
  | 'mcq' | 'sjt' | 'scenario' | 'case' | 'behavioral'
  | 'simulation' | 'communication' | 'ai_conversational' | 'portfolio_review';

export type AdaptiveQuestion = {
  id: string;
  pool_key: string;
  competency_code: string;
  question_type: QuestionType;
  difficulty: 'easy' | 'medium' | 'hard';
  depth: 'shallow' | 'standard' | 'deep';
  prompt: string;
  options?: string[];
  /** index of correct/best option (for scoring; soft for SJT) */
  best_option?: number;
  /** Affinity tags — lowercase substrings; question prefers users whose profile fields contain ANY of these. Empty = neutral, applies to anyone. */
  role_tags?: string[];
  industry_tags?: string[];
  stage_tags?: string[];
  function_tags?: string[];
};

export const ADAPTIVE_QUESTION_BANK_V2: AdaptiveQuestion[] = [
  // ─── COG — Cognitive & Analytical ─────────────────────────────────────────
  { id:'cog-1', pool_key:'cog_mcq_med', competency_code:'COG', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'A team velocity drops 30% over 3 sprints. What is the FIRST diagnostic step?',
    options:['Replace the team lead','Run a structured retro on root causes','Add more developers','Cut scope'], best_option:1,
    function_tags:['engineering','product'] },
  { id:'cog-2', pool_key:'cog_mcq_med', competency_code:'COG', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'Which framing best balances exploration vs exploitation in a new market?',
    options:['100% exploit known channels','Time-box experiments alongside core spend','Stop spending, only explore','Outsource entirely'], best_option:1,
    function_tags:['strategy','marketing','founder'] },
  { id:'cog-3', pool_key:'cog_mcq_med', competency_code:'COG', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'Two HR metrics conflict: attrition is down 5% but engagement scores dropped 12%. What is the strongest interpretation?',
    options:['Both are noise — wait another quarter','People are staying but disengaged — investigate manager quality and growth blockers','Lower attrition is good; ignore engagement','Run a salary benchmark immediately'], best_option:1,
    role_tags:['hr','people','talent','chro','recruit'], function_tags:['hr','people'] },
  { id:'cog-4', pool_key:'cog_case_hi', competency_code:'COG', question_type:'case', difficulty:'hard', depth:'deep',
    prompt:'You have 6 weeks and one team. Three initiatives: a 20% revenue feature (uncertain), a compliance fix (deadline in 8 weeks), a churn-reducing UX overhaul (proven). How do you sequence?',
    options:['Revenue first, then compliance, then churn','Compliance first (non-negotiable), then churn (proven), then revenue (uncertain)','All three in parallel','Churn first, drop the others'], best_option:1,
    function_tags:['product','strategy','founder'] },
  { id:'cog-5', pool_key:'cog_mcq_easy', competency_code:'COG', question_type:'mcq', difficulty:'easy', depth:'shallow',
    prompt:'When data and instinct disagree on a low-stakes decision, the better default is:',
    options:['Always follow instinct','Always follow data','Lean on data but document the instinct as a hypothesis to test','Defer to your manager'], best_option:2 },
  { id:'cog-6', pool_key:'cog_scen_hi', competency_code:'COG', question_type:'scenario', difficulty:'hard', depth:'deep',
    prompt:'A regulator queries a model decision that affected a customer. You have 48 hours. Pick the highest-leverage first action.',
    options:['Retrain the model','Pull the exact decision trace + inputs + version, then draft the response','Disable the model','Wait for legal to handle it'], best_option:1,
    industry_tags:['finance','bank','health','insurance','regulated'] },

  // ─── COM — Communication ──────────────────────────────────────────────────
  { id:'com-1', pool_key:'com_sjt_med', competency_code:'COM', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'A peer publicly disagrees with your plan in a leadership review. Best response?',
    options:['Ignore and proceed','Acknowledge their point, ask one clarifying question, defer disagreement to a 1:1','Escalate to the CEO','Defend the plan loudly'], best_option:1 },
  { id:'com-2', pool_key:'com_sjt_med', competency_code:'COM', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'You must deliver bad news to a customer who lost data due to your team\'s mistake. Best opening?',
    options:['"There was a system event…"','"We made a mistake. Here\'s what happened, what we\'re doing, and what you can expect from us by Friday."','"It wasn\'t entirely our fault, but…"','"Our SLA covers this — let\'s focus on the credit."'], best_option:1,
    function_tags:['customer','sales','support','founder'] },
  { id:'com-3', pool_key:'com_scen_hi', competency_code:'COM', question_type:'scenario', difficulty:'hard', depth:'deep',
    prompt:'Your CEO asks for "the one-pager" on a 9-month effort. The strongest structure is:',
    options:['Timeline + tasks + owners','Outcome → 3 key decisions → 2 risks → ask','Slack thread summary','Full Gantt chart'], best_option:1,
    stage_tags:['senior','lead','director','principal','exec','vp','chief'] },
  { id:'com-4', pool_key:'com_behav_med', competency_code:'COM', question_type:'behavioral', difficulty:'medium', depth:'standard',
    prompt:'Describe the last time you simplified a complex idea for a non-technical stakeholder. Which best matches your approach?',
    options:['I sent the full doc and asked them to read it','I led with the so-what + one visual, then offered detail on request','I asked them to find someone else','I avoided the conversation'], best_option:1 },
  { id:'com-5', pool_key:'com_comm_med', competency_code:'COM', question_type:'communication', difficulty:'medium', depth:'standard',
    prompt:'A junior teammate sends you a wall-of-text Slack at 9pm asking for urgent feedback. Best response?',
    options:['Reply at 9pm with a long answer','Acknowledge tonight + propose a 15-min sync tomorrow with structured questions','Ignore until morning','Forward to their manager'], best_option:1 },

  // ─── LEA — Leadership ─────────────────────────────────────────────────────
  { id:'lea-1', pool_key:'lea_scen_hi', competency_code:'LEA', question_type:'scenario', difficulty:'hard', depth:'deep',
    prompt:'You inherit a team with two senior ICs in low-grade conflict. Pick the most leveraged first move.',
    options:['Reorg around them','Hold a structured 1:1 with each, then a joint outcome conversation','Performance manage both out','Wait for it to settle'], best_option:1,
    stage_tags:['lead','manager','director','exec','vp','chief'] },
  { id:'lea-2', pool_key:'lea_sjt_med', competency_code:'LEA', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'A high-performer asks for a promotion you can\'t grant this cycle. Best response?',
    options:['Stall with vague language','Be specific about why it\'s "not yet" + co-create a measurable plan + commit to a date','Promote them to avoid losing them','Tell them to look elsewhere'], best_option:1,
    role_tags:['hr','people','talent','manager','lead','head'], function_tags:['hr','people','management'] },
  { id:'lea-3', pool_key:'lea_behav_hi', competency_code:'LEA', question_type:'behavioral', difficulty:'hard', depth:'deep',
    prompt:'Recall the toughest hiring decision you\'ve owned. Which best describes how you made the call?',
    options:['Went with my gut','Triangulated structured signals (interviews + work sample + references) and named the tradeoff openly','Deferred to the loudest interviewer','Hired for "potential" without evidence'], best_option:1,
    role_tags:['hr','recruit','founder','head','chief','manager'], function_tags:['hr','founder','management'] },
  { id:'lea-4', pool_key:'lea_scen_hi', competency_code:'LEA', question_type:'scenario', difficulty:'hard', depth:'deep',
    prompt:'You must cut 15% of your org. What sequence creates the most trust?',
    options:['Surprise announcement Friday afternoon','Quietly let managers tell their reports first','Frame the why, do it in one wave with severance + outplacement + public manager Q&A within 48h','Drip it over 3 months'], best_option:2,
    stage_tags:['exec','director','vp','chief','founder'] },
  { id:'lea-5', pool_key:'lea_mcq_easy', competency_code:'LEA', question_type:'mcq', difficulty:'easy', depth:'shallow',
    prompt:'The clearest signal of a healthy team you lead is:',
    options:['Nobody disagrees with you','People disagree openly + commit fully after the decision','Everyone works late','Low attrition alone'], best_option:1 },

  // ─── EXE — Execution ──────────────────────────────────────────────────────
  { id:'exe-1', pool_key:'exe_case_med', competency_code:'EXE', question_type:'case', difficulty:'medium', depth:'standard',
    prompt:'A flagship launch slips 2 weeks. What execution lever is HIGHEST signal?',
    options:['Cut scope to protect the date','Move the date and keep scope','Add headcount mid-flight','Defer to next quarter'], best_option:0,
    function_tags:['product','engineering','marketing'] },
  { id:'exe-2', pool_key:'exe_mcq_med', competency_code:'EXE', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'You\'re running 6 priorities and slipping on 4. Best move?',
    options:['Work weekends','Re-rank and explicitly drop 2 with stakeholder sign-off','Hide the slippage','Spread effort thinner'], best_option:1 },
  { id:'exe-3', pool_key:'exe_scen_hi', competency_code:'EXE', question_type:'scenario', difficulty:'hard', depth:'deep',
    prompt:'A vendor misses an integration deadline that blocks 3 downstream teams. Best escalation?',
    options:['Wait politely','Activate written escalation w/ revised dates + parallel internal contingency + daily standup','Replace the vendor mid-flight','Take it on internally with no notice'], best_option:1,
    function_tags:['operations','engineering','product'] },
  { id:'exe-4', pool_key:'exe_sjt_med', competency_code:'EXE', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'A high-volume hiring drive is behind plan by 30%. Most leveraged correction?',
    options:['Lower the bar','Diagnose funnel stage with biggest drop + double down on that stage + recalibrate weekly','Outsource everything','Pause and replan in 4 weeks'], best_option:1,
    role_tags:['hr','recruit','talent','people'], function_tags:['hr','recruiting'] },
  { id:'exe-5', pool_key:'exe_mcq_easy', competency_code:'EXE', question_type:'mcq', difficulty:'easy', depth:'shallow',
    prompt:'The truest measure of execution quality is:',
    options:['Hours worked','Outcomes shipped vs commitments, on the cadence agreed','Number of status meetings','Slack activity'], best_option:1 },

  // ─── ADP — Adaptability ───────────────────────────────────────────────────
  { id:'adp-1', pool_key:'adp_sjt_med', competency_code:'ADP', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'Your top customer signs a competitor. Best adaptive move in week 1?',
    options:['Run a blameless customer post-mortem and reset the roadmap','Slash prices','Replace your AE','Do nothing'], best_option:0,
    function_tags:['sales','customer','founder'] },
  { id:'adp-2', pool_key:'adp_scen_hi', competency_code:'ADP', question_type:'scenario', difficulty:'hard', depth:'deep',
    prompt:'New regulation lands that materially impacts your product in 60 days. First two moves?',
    options:['Lobby against it','(1) Compliance gap analysis + impact sizing, (2) Cross-functional war room with weekly external counsel sync','Ignore until enforcement','Outsource compliance entirely'], best_option:1,
    industry_tags:['finance','bank','health','insurance','regulated','pharma'] },
  { id:'adp-3', pool_key:'adp_behav_med', competency_code:'ADP', question_type:'behavioral', difficulty:'medium', depth:'standard',
    prompt:'When was the last time you reversed a public position you held? Best match:',
    options:['I rarely change my mind','I changed it once new evidence appeared, named the new evidence, and updated the team','I changed quietly without acknowledgment','I held the line to preserve credibility'], best_option:1 },
  { id:'adp-4', pool_key:'adp_mcq_med', competency_code:'ADP', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'A reorg removes 2 of your skip-level managers. Best first-week adaptation?',
    options:['Wait to be told the plan','Map the new reporting lines, schedule 1:1s with new reports, surface top 3 risks in writing to your manager','Resist the change','Apply for a new role'], best_option:1 },
  { id:'adp-5', pool_key:'adp_mcq_easy', competency_code:'ADP', question_type:'mcq', difficulty:'easy', depth:'shallow',
    prompt:'The most adaptive professionals tend to:',
    options:['Resist change to preserve quality','Treat their plan as a hypothesis and update it on new evidence','Wait for clarity before moving','Change direction weekly'], best_option:1 },

  // ─── TEC — Technical / Domain ─────────────────────────────────────────────
  { id:'tec-1', pool_key:'tec_mcq_med', competency_code:'TEC', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'When evaluating a new core dependency, the strongest signal is:',
    options:['GitHub stars','License + maintainer cadence + team familiarity','Twitter buzz','Bundle size alone'], best_option:1,
    role_tags:['engineer','developer','architect','tech','devops','data','ml','sde'], function_tags:['engineering','data','technology'] },
  { id:'tec-2', pool_key:'tec_mcq_med', competency_code:'TEC', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'You\'re selecting an HRIS for a 5,000-employee company. The dominant criterion is:',
    options:['Cheapest TCO','Fit to compliance + integration with existing payroll + change-management cost','Brand recognition','Newest UI'], best_option:1,
    role_tags:['hr','people','chro','head','talent'], function_tags:['hr','people','operations'] },
  { id:'tec-3', pool_key:'tec_case_hi', competency_code:'TEC', question_type:'case', difficulty:'hard', depth:'deep',
    prompt:'Your service has p99 latency spiking only on weekends. Best diagnostic order?',
    options:['Rewrite the hot path','Correlate with traffic shape + downstream dependency latency + GC/cache behaviour under load, then localise','Add more replicas blindly','Move to a new cloud'], best_option:1,
    role_tags:['engineer','sre','devops','architect','sde','backend'], function_tags:['engineering','infrastructure'] },
  { id:'tec-4', pool_key:'tec_scen_med', competency_code:'TEC', question_type:'scenario', difficulty:'medium', depth:'standard',
    prompt:'A clinical trial dataset arrives with 8% missing values in a key endpoint. Strongest analytic move?',
    options:['Drop incomplete rows','Characterise missingness pattern (MCAR/MAR/MNAR), pre-register a sensitivity analysis, then impute or model accordingly','Impute the mean silently','Ignore and report'], best_option:1,
    industry_tags:['health','pharma','clinical'], function_tags:['data','research','clinical'] },
  { id:'tec-5', pool_key:'tec_mcq_med', competency_code:'TEC', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'A SaaS sales pipeline shows 80% close on stage-4 opps but only 12% conversion stage-2 → stage-3. Best leverage point?',
    options:['Bigger team','Diagnose the stage-2 → 3 gap (qualification quality, discovery depth, ICP fit) before scaling','Higher discounts','Drop stage-2 entirely'], best_option:1,
    role_tags:['sales','revenue','rev','account','ae','bdr','sdr'], function_tags:['sales','revenue'] },

  // ─── EIQ — Emotional Intelligence ────────────────────────────────────────
  { id:'eiq-1', pool_key:'eiq_behav_med', competency_code:'EIQ', question_type:'behavioral', difficulty:'medium', depth:'standard',
    prompt:'Describe a moment you changed your mind after disagreeing with someone you led.',
    options:['Never happened','Once, but I disguised it','Yes — and I publicly credited them','I asked them to change their mind instead'], best_option:2 },
  { id:'eiq-2', pool_key:'eiq_sjt_med', competency_code:'EIQ', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'A teammate is visibly stressed in a meeting and snaps at a colleague. Best in-the-moment response from you?',
    options:['Call them out publicly','Briefly pause the meeting, reframe softly, and follow up privately within the hour','Ignore it','End the meeting abruptly'], best_option:1 },
  { id:'eiq-3', pool_key:'eiq_behav_hi', competency_code:'EIQ', question_type:'behavioral', difficulty:'hard', depth:'deep',
    prompt:'Think of the last difficult feedback you received. Which best matches how you metabolised it?',
    options:['Dismissed it','Felt defensive, sat with it for 24h, then identified the 1 specific behaviour to change and told the giver','Agreed publicly, ignored privately','Argued back in the moment'], best_option:1 },
  { id:'eiq-4', pool_key:'eiq_sjt_med', competency_code:'EIQ', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'A direct report shares they\'re burning out. The most EI-aware first response is:',
    options:['"Push through, deadlines first."','Listen fully, validate, ask what specifically would help in the next 2 weeks, then unblock','"Take a vacation and let\'s talk after."','Reassign their work without asking'], best_option:1,
    role_tags:['hr','people','manager','lead','head','director'], function_tags:['hr','management','people'] },
  { id:'eiq-5', pool_key:'eiq_mcq_easy', competency_code:'EIQ', question_type:'mcq', difficulty:'easy', depth:'shallow',
    prompt:'The strongest signal of self-awareness in a leader is:',
    options:['Never apologising','Naming their own pattern in a tough moment + course-correcting','Always being calm','Avoiding hard conversations'], best_option:1 },

  // ─── HR/People expansion — added so HR profiles see role-relevant items
  //     across all 7 domains and bank is deep enough that retakes don't repeat.

  // COG — HR-flavoured analytical
  { id:'cog-hr-1', pool_key:'cog_mcq_med', competency_code:'COG', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'Voluntary attrition in your top-performer cohort jumped from 8% to 19% YoY. Strongest first analysis?',
    options:['Run a blanket retention bonus','Segment exits by manager, tenure-in-role, and last-promotion gap before acting','Assume market-driven, do nothing','Replace the recruiters'], best_option:1,
    role_tags:['hr','people','talent','chro','head','manager'], function_tags:['hr','people'] },
  { id:'cog-hr-2', pool_key:'cog_case_hi', competency_code:'COG', question_type:'case', difficulty:'hard', depth:'deep',
    prompt:'Engagement scores fell 14 pts in 2 BUs but rose 6 pts org-wide. The most defensible interpretation?',
    options:['Average is fine, no action','Investigate the 2 BUs as a local signal — manager quality, workload, or leadership change likely','Roll out a company-wide survey','Discount the negative BUs as outliers'], best_option:1,
    role_tags:['hr','people','chro','talent','head'], function_tags:['hr','people'] },
  { id:'cog-hr-3', pool_key:'cog_scen_med', competency_code:'COG', question_type:'scenario', difficulty:'medium', depth:'standard',
    prompt:'A pay-equity audit shows a 4% unexplained gap in one job family. Most rigorous next step?',
    options:['Adjust all salaries up immediately','Decompose the gap by tenure / level / hire cohort, identify drivers, then remediate by driver','Dismiss as statistical noise','Wait for legal complaint'], best_option:1,
    role_tags:['hr','people','chro','compensation','reward'], function_tags:['hr','people','compensation'] },

  // COM — HR-flavoured communication
  { id:'com-hr-1', pool_key:'com_sjt_med', competency_code:'COM', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'You must announce a hiring freeze to your org tomorrow. Best opening for the all-hands?',
    options:['Bury it in operational updates','Lead with the why + what stays funded + decision criteria for unfreezing + how questions will be answered','Email it after the meeting','Let managers tell their teams individually'], best_option:1,
    role_tags:['hr','people','chro','head','talent','manager'], function_tags:['hr','people','communication'] },
  { id:'com-hr-2', pool_key:'com_scen_hi', competency_code:'COM', question_type:'scenario', difficulty:'hard', depth:'deep',
    prompt:'A manager escalates a complaint about a peer\'s "tone" with no specifics. Best clarifying response?',
    options:['Mediate immediately','Ask for 2–3 concrete recent examples, who was present, and the impact — then decide between coaching, mediation, or formal process','Tell them to handle it themselves','Open a formal investigation right away'], best_option:1,
    role_tags:['hr','people','er','employee-relations','manager','head'], function_tags:['hr','people'] },
  { id:'com-hr-3', pool_key:'com_behav_med', competency_code:'COM', question_type:'behavioral', difficulty:'medium', depth:'standard',
    prompt:'How do you typically deliver a "no" to a senior leader requesting a non-standard exception?',
    options:['Avoid until they forget','Acknowledge the goal, name the principle at stake, offer one viable alternative, document the decision','Approve to avoid friction','Escalate to my manager first every time'], best_option:1,
    role_tags:['hr','people','chro','head','talent'], function_tags:['hr','people'] },

  // LEA — HR-flavoured leadership
  { id:'lea-hr-1', pool_key:'lea_scen_hi', competency_code:'LEA', question_type:'scenario', difficulty:'hard', depth:'deep',
    prompt:'A founder wants to fire a long-tenured leader after one bad quarter. Your highest-leverage move as HR?',
    options:['Process the termination as requested','Run a 1-week diagnostic (perf history, 360, business context) before any irreversible decision; present options + risks','Push back publicly in the leadership meeting','Wait and see'], best_option:1,
    role_tags:['hr','chro','people','head','talent'], function_tags:['hr','people','leadership'] },
  { id:'lea-hr-2', pool_key:'lea_sjt_med', competency_code:'LEA', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'Two strong internal candidates apply for the same Director role. Best process?',
    options:['Pick whoever the hiring manager prefers','Structured calibrated panel, same rubric, transparent decision rationale shared with the not-selected candidate within 48h','Open it externally instead','Promote both with split scope'], best_option:1,
    role_tags:['hr','talent','people','recruit','head'], function_tags:['hr','people','talent'] },
  { id:'lea-hr-3', pool_key:'lea_behav_hi', competency_code:'LEA', question_type:'behavioral', difficulty:'hard', depth:'deep',
    prompt:'Describe the last time you held a senior leader accountable for a people-related failure. Closest match:',
    options:['I haven\'t had to','I named the specific behaviour + impact privately, agreed a concrete change, and followed up with their manager + me weekly','I escalated to the CEO immediately','I documented but didn\'t raise it'], best_option:1,
    role_tags:['hr','chro','people','head','talent'], function_tags:['hr','people'] },

  // EXE — HR-flavoured execution
  { id:'exe-hr-1', pool_key:'exe_case_med', competency_code:'EXE', question_type:'case', difficulty:'medium', depth:'standard',
    prompt:'You committed to closing 40 reqs this quarter; you\'re at 18 with 5 weeks left. Most leveraged move?',
    options:['Lower the bar uniformly','Diagnose top funnel stage with biggest drop, double recruiter capacity there, re-forecast publicly with stakeholders','Hide the slippage','Push everything to next quarter'], best_option:1,
    role_tags:['hr','recruit','talent','ta','head'], function_tags:['hr','recruiting'] },
  { id:'exe-hr-2', pool_key:'exe_scen_hi', competency_code:'EXE', question_type:'scenario', difficulty:'hard', depth:'deep',
    prompt:'Performance review cycle is 3 weeks away; calibration data is inconsistent across 4 BUs. Best execution path?',
    options:['Delay the cycle','Lock the rubric + run a same-week BU-level calibration with HRBPs, then escalate exceptions to a cross-BU committee','Skip calibration this cycle','Let each BU set their own ratings'], best_option:1,
    role_tags:['hr','hrbp','people','head','talent'], function_tags:['hr','people'] },
  { id:'exe-hr-3', pool_key:'exe_mcq_med', competency_code:'EXE', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'A new onboarding program is launching across 12 offices. Strongest rollout sequence?',
    options:['Big-bang launch on day 1 everywhere','Pilot in 2 offices for 4 weeks, instrument, fix top 3 issues, then waved rollout','Email the deck and self-serve','Skip change management'], best_option:1,
    role_tags:['hr','people','l&d','learning','head','talent'], function_tags:['hr','people','operations'] },

  // ADP — HR-flavoured adaptability
  { id:'adp-hr-1', pool_key:'adp_scen_hi', competency_code:'ADP', question_type:'scenario', difficulty:'hard', depth:'deep',
    prompt:'New labour regulation in 2 of your geographies changes notice periods overnight. First two HR moves?',
    options:['Wait for legal to draft','(1) Impact map across affected populations + (2) policy + manager comms + employment-doc updates within 10 working days','Ignore until enforcement','Apply globally to avoid complexity'], best_option:1,
    role_tags:['hr','people','chro','head','talent'], industry_tags:['regulated'], function_tags:['hr','people'] },
  { id:'adp-hr-2', pool_key:'adp_mcq_med', competency_code:'ADP', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'CEO pivots from "hire aggressively" to "freeze + restructure" in 30 days. Most adaptive HR posture?',
    options:['Resist the pivot publicly','Re-plan workforce strategy in 1 week, surface 3 scenarios with people-cost + risk, partner with finance on sequencing','Wait for written direction','Execute literally with no scenarios'], best_option:1,
    role_tags:['hr','chro','people','head','talent'], function_tags:['hr','people'] },

  // TEC — HR-flavoured technical/domain
  { id:'tec-hr-1', pool_key:'tec_mcq_med', competency_code:'TEC', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'Replacing your ATS for a 3,000-person company. Dominant selection criterion?',
    options:['Cheapest seat price','Compliance fit + integration depth (HRIS, calendar, assessments) + recruiter adoption cost + reporting','Newest UI','Vendor brand'], best_option:1,
    role_tags:['hr','recruit','ta','talent','head','hrbp'], function_tags:['hr','people','operations'] },
  { id:'tec-hr-2', pool_key:'tec_case_hi', competency_code:'TEC', question_type:'case', difficulty:'hard', depth:'deep',
    prompt:'You\'re designing a competency framework for the engineering org. Strongest first step?',
    options:['Copy a public framework wholesale','Interview 10 ICs + 6 managers across levels, derive 5–7 anchored behaviours per level, validate against real review data','Survey only managers','Outsource to a consultancy'], best_option:1,
    role_tags:['hr','people','l&d','talent','head','hrbp'], function_tags:['hr','people'] },
  { id:'tec-hr-3', pool_key:'tec_scen_med', competency_code:'TEC', question_type:'scenario', difficulty:'medium', depth:'standard',
    prompt:'Compensation benchmarking shows you\'re at p60 in 2 functions and p35 in 3. Best response?',
    options:['Move everyone to p75','Tier roles by criticality + market scarcity, address p35 hot-spots first within budget, communicate the principle','Cut the p60 roles','Wait for the next cycle'], best_option:1,
    role_tags:['hr','people','compensation','reward','chro','head'], function_tags:['hr','people','compensation'] },

  // EIQ — HR-flavoured emotional intelligence
  { id:'eiq-hr-1', pool_key:'eiq_sjt_med', competency_code:'EIQ', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'A manager privately tells you they\'re considering letting a teammate go after one conflict. Best EI-aware move?',
    options:['Approve and move on','Slow them down — explore what changed, what\'s been tried, what the teammate would say; agree a 2-week behavioural plan before any irreversible step','Tell them to escalate to legal','Defer entirely to the manager'], best_option:1,
    role_tags:['hr','people','er','hrbp','manager','head'], function_tags:['hr','people'] },
  { id:'eiq-hr-2', pool_key:'eiq_behav_hi', competency_code:'EIQ', question_type:'behavioral', difficulty:'hard', depth:'deep',
    prompt:'Recall the last time a senior leader was visibly defensive in feedback. Closest to your handling?',
    options:['I stopped giving feedback','I named the dynamic gently ("I notice this lands hard — want to pause?"), gave them time, returned with one concrete example + a small ask','I escalated to their manager','I pushed harder in the moment'], best_option:1,
    role_tags:['hr','chro','people','hrbp','head','talent'], function_tags:['hr','people'] },
  { id:'eiq-hr-3', pool_key:'eiq_scen_med', competency_code:'EIQ', question_type:'scenario', difficulty:'medium', depth:'standard',
    prompt:'During a layoff briefing, an affected employee becomes very emotional. Best in-the-moment response?',
    options:['Stick to the script','Pause, acknowledge the weight of the moment, offer water + a short break, then continue at their pace + name the support available','Ask them to compose themselves','End the meeting and reschedule'], best_option:1,
    role_tags:['hr','people','er','hrbp','head','manager'], function_tags:['hr','people'] },

  // ─── Generalist depth expansion — extra items so non-HR roles also get
  //     enough rotation across retakes.
  { id:'cog-gen-1', pool_key:'cog_mcq_med', competency_code:'COG', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'You have one chart to show a board. The MOST decision-useful chart shows:',
    options:['Vanity totals over time','The 2 metrics whose movement triggers a different decision, with target band overlaid','Every KPI in a small-multiples grid','A pie chart of revenue mix'], best_option:1 },
  { id:'com-gen-1', pool_key:'com_sjt_med', competency_code:'COM', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'A cross-functional kickoff has 5 unaligned stakeholders. Best opening move?',
    options:['Jump into the agenda','Restate the goal in one sentence, surface the top disagreement explicitly, time-box it, and capture the resolution','Skip the conflict','Take a vote'], best_option:1 },
  { id:'lea-gen-1', pool_key:'lea_sjt_med', competency_code:'LEA', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'A direct report misses a commitment for the third time. Most growth-oriented response?',
    options:['Public reprimand','Private conversation: name the pattern, ask for their read, co-create a concrete next-30-day system, agree on what success looks like','Reassign their work','Wait one more cycle'], best_option:1 },
  { id:'exe-gen-1', pool_key:'exe_sjt_med', competency_code:'EXE', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'Your weekly priorities keep being interrupted by ad-hoc requests. Most leveraged correction?',
    options:['Say yes to everything','Publish a written intake rubric (priority bands + lead time) and start saying "yes, in week X" with rationale','Refuse all ad-hoc','Work longer hours'], best_option:1 },
  { id:'adp-gen-1', pool_key:'adp_sjt_med', competency_code:'ADP', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'Your manager changes the goal mid-quarter without explanation. Best adaptive response?',
    options:['Push back hard','Ask 3 calibration questions (what changed, what stays, what success looks like) in writing, then re-plan with explicit trade-offs','Comply silently and resent it','Wait for it to change back'], best_option:1 },
  { id:'tec-gen-1', pool_key:'tec_mcq_med', competency_code:'TEC', question_type:'mcq', difficulty:'medium', depth:'standard',
    prompt:'The single best signal that a domain expert truly understands their craft is:',
    options:['Years of experience','They can name the 2–3 cases where the standard playbook fails and what to do instead','They cite the most authors','They never make mistakes'], best_option:1 },
  { id:'eiq-gen-1', pool_key:'eiq_sjt_med', competency_code:'EIQ', question_type:'sjt', difficulty:'medium', depth:'standard',
    prompt:'You realise mid-meeting that you misjudged a colleague\'s intent earlier. Best in-the-moment move?',
    options:['Say nothing','Name it briefly ("I want to revisit something I said — I read your intent wrong, and I\'m sorry"), then move on','Apologise at length','Discuss only in private later'], best_option:1 },
];

/**
 * Compute affinity score for a question vs a user context.
 * Returns 0..3 (higher = better match). Empty tag lists are neutral (no penalty).
 */
function affinityScore(q: AdaptiveQuestion, ctx: PickContext | undefined): number {
  if (!ctx) return 0;
  const haystack = `${ctx.role || ''} ${ctx.industry || ''} ${ctx.stage || ''} ${ctx.department || ''} ${ctx.subDepartment || ''}`.toLowerCase();
  let s = 0;
  const matchAny = (tags?: string[]) => !!tags && tags.length > 0 && tags.some((t) => haystack.includes(t));
  if (matchAny(q.role_tags)) s += 1.5;
  if (matchAny(q.industry_tags)) s += 1.0;
  if (matchAny(q.stage_tags)) s += 0.7;
  if (matchAny(q.function_tags)) s += 0.5;
  return s;
}

export type PickContext = {
  role?: string;
  industry?: string;
  stage?: string;
  department?: string;
  subDepartment?: string;
};

/**
 * Pick a question from a pool, ranked by affinity to user context.
 * Falls back to round-robin within the pool if no affinity matches.
 */
export function pickByPool(poolKey: string, served: number, ctx?: PickContext): AdaptiveQuestion | null {
  const matches = ADAPTIVE_QUESTION_BANK_V2.filter((q) => q.pool_key === poolKey);
  if (!matches.length) {
    // Fallback: any question for the same competency prefix (e.g. 'cog_mcq_med' → 'cog_*')
    const prefix = poolKey.split('_')[0];
    const widened = ADAPTIVE_QUESTION_BANK_V2.filter((q) => q.competency_code.toLowerCase() === prefix);
    if (!widened.length) return null;
    const scored = widened.map((q) => ({ q, score: affinityScore(q, ctx) }));
    scored.sort((a, b) => b.score - a.score);
    return scored[served % scored.length].q;
  }
  if (!ctx) return matches[served % matches.length];
  const scored = matches.map((q) => ({ q, score: affinityScore(q, ctx) }));
  scored.sort((a, b) => b.score - a.score);
  // Cycle through the ranked list so we don't show the same top-affinity question twice in a row
  return scored[served % scored.length].q;
}
