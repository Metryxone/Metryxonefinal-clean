/**
 * D4 — Concern Intelligence Framework
 * talent_concern_master: Competency → Concern → Signal chain.
 * Each concern maps a competency_code (D5) to diagnostic concern patterns,
 * growth/risk/assessment indicators, insight logic, and recommendation logic.
 * Feeds D9 (readiness), D14 (digital twin), D15 (outcome prediction).
 * Additive + flag-gated: FF_CAREER_GRAPH=1. Flag-off → 503. Never throws.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';

const FLAG = 'FF_CAREER_GRAPH';
const flagOn = () => process.env[FLAG] === '1';
type AuthFn = (req: Request, res: Response, next: () => void) => void;

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60_000;
const getCached = <T>(k: string): T | null => { const e = cache.get(k); return e && Date.now() - e.ts < CACHE_TTL ? e.data as T : null; };
const setCache = (k: string, d: unknown) => cache.set(k, { data: d, ts: Date.now() });
const bustCache = () => cache.clear();

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS talent_concern_master (
      id SERIAL PRIMARY KEY,
      concern_key TEXT NOT NULL UNIQUE,
      concern_name TEXT NOT NULL,
      competency_code TEXT NOT NULL,
      blueprint_key TEXT NOT NULL,
      signal_keys TEXT[] DEFAULT '{}',
      concern_category TEXT CHECK (concern_category IN ('behavioral','cognitive','functional','leadership','emotional')) DEFAULT 'behavioral',
      severity_level TEXT CHECK (severity_level IN ('critical','high','moderate','low')) DEFAULT 'moderate',
      growth_indicators JSONB DEFAULT '[]',
      risk_indicators JSONB DEFAULT '[]',
      assessment_indicators JSONB DEFAULT '[]',
      insight_logic JSONB DEFAULT '{}',
      recommendation_logic JSONB DEFAULT '{}',
      feeds_readiness BOOLEAN DEFAULT true,
      feeds_digital_twin BOOLEAN DEFAULT true,
      feeds_outcome_prediction BOOLEAN DEFAULT true,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tcm_competency ON talent_concern_master(competency_code);
    CREATE INDEX IF NOT EXISTS idx_tcm_blueprint ON talent_concern_master(blueprint_key);
    CREATE INDEX IF NOT EXISTS idx_tcm_severity ON talent_concern_master(severity_level);
    CREATE INDEX IF NOT EXISTS idx_tcm_active ON talent_concern_master(is_active);
  `);
  schemaReady = true;
}

/* ── Seed data: ~60 competency-mapped concerns ───────────────────────────── */
const CONCERN_RECORDS = [
  // ── EL_STRAT · Strategic Thinking ──────────────────────────────────────────
  {
    concern_key: 'el_strat_clarity_gap', concern_name: 'Strategic Clarity Gap',
    competency_code: 'EL_STRAT', blueprint_key: 'executive_leadership',
    signal_keys: ['SI_001','SI_002','SI_030'],
    concern_category: 'cognitive', severity_level: 'critical',
    growth_indicators: ['Articulates 3-year vision unprompted','Links daily decisions to long-term direction','Simplifies complex competitive landscapes for teams','Regularly updates strategic hypotheses based on new data'],
    risk_indicators: ['Shifts strategic direction more than once per quarter','Cannot explain how team work connects to company strategy','Avoids long-horizon planning conversations','Strategic plans lack measurable milestones'],
    assessment_indicators: ['Scenario planning exercise score','Strategic communication clarity rating','Horizon-3 thinking assessment','Vision articulation quality'],
    insight_logic: { trigger_condition: 'strategic_score < threshold', threshold: 45, insight_template: 'Strategic clarity signals indicate difficulty connecting daily operations to long-term direction. Focus on structured scenario planning and vision articulation practice.', severity_escalation_rule: 'escalate if < 35 for 2+ consecutive assessments' },
    recommendation_logic: { primary_action: 'Enrol in strategic thinking masterclass and schedule monthly strategy review with senior mentor', learning_resources: ['SI_001','SI_002'], timeline_weeks: 16, success_metrics: ['Can present 3-year team vision in 5 minutes','Receives ≥7/10 on clarity in 360 feedback','Links 80%+ of team OKRs to strategic pillars'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: true
  },
  {
    concern_key: 'el_strat_short_term_bias', concern_name: 'Short-Term Thinking Bias',
    competency_code: 'EL_STRAT', blueprint_key: 'executive_leadership',
    signal_keys: ['SI_001','AC_002','OE_026'],
    concern_category: 'cognitive', severity_level: 'high',
    growth_indicators: ['Voluntarily identifies long-term consequences of near-term decisions','Builds horizon scanning into team rhythms','Reads industry trend reports and shares insights','Advocates for investment in future capabilities'],
    risk_indicators: ['Consistently optimises for quarterly results at cost of long-term','Dismisses strategic planning as theoretical','Allocates no time to competitive landscape monitoring','Reactive to market changes rather than anticipatory'],
    assessment_indicators: ['Time horizon preference assessment','Strategic investment ratio','Future orientation index','Trend monitoring habit check'],
    insight_logic: { trigger_condition: 'time_horizon_score < threshold', threshold: 40, insight_template: 'Pattern shows overweighting of immediate results over long-term positioning. This creates compounding risk for organisational readiness at higher leadership layers.', severity_escalation_rule: 'escalate if combined with high execution_overload signal' },
    recommendation_logic: { primary_action: 'Implement a personal 90-day strategic review ritual; join a cross-industry forum', learning_resources: ['SI_002','SI_030'], timeline_weeks: 12, success_metrics: ['Increases horizon-3 time allocation by 20%','Proposes at least one forward-looking initiative per quarter','360 feedback shows improved big-picture thinking'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: true
  },
  {
    concern_key: 'el_strat_complexity_avoidance', concern_name: 'Complexity Avoidance',
    competency_code: 'EL_STRAT', blueprint_key: 'executive_leadership',
    signal_keys: ['SI_002','SI_030','AC_010'],
    concern_category: 'cognitive', severity_level: 'high',
    growth_indicators: ['Embraces ambiguous strategic problems','Builds frameworks to navigate competing priorities','Seeks diverse perspectives on wicked problems','Comfortable holding multiple hypotheses simultaneously'],
    risk_indicators: ['Oversimplifies nuanced strategic choices','Avoids decisions involving competing stakeholder interests','Prefers clear playbooks to open-ended problems','Delegates all ambiguous situations upward'],
    assessment_indicators: ['Ambiguity tolerance score','Complex scenario navigation test','Systems thinking assessment','Competing priorities resolution quality'],
    insight_logic: { trigger_condition: 'ambiguity_tolerance < threshold', threshold: 38, insight_template: 'Low complexity tolerance is constraining strategic contribution. Senior leadership roles require comfort navigating genuinely ambiguous situations without clear answers.', severity_escalation_rule: 'critical if also showing risk_aversion concern' },
    recommendation_logic: { primary_action: 'Take on a strategic ambiguity project with coaching support; study systems thinking', learning_resources: ['SI_001','SI_002'], timeline_weeks: 20, success_metrics: ['Leads one complex cross-functional initiative to resolution','Ambiguity tolerance score improves by 15+ points','Receives positive stakeholder feedback on navigation of complexity'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: true
  },

  // ── EL_DECIS · Decision Making ─────────────────────────────────────────────
  {
    concern_key: 'el_decis_analysis_paralysis', concern_name: 'Analysis Paralysis',
    competency_code: 'EL_DECIS', blueprint_key: 'executive_leadership',
    signal_keys: ['AC_010','AC_002','SI_004'],
    concern_category: 'cognitive', severity_level: 'critical',
    growth_indicators: ['Sets decision deadlines and honours them','Uses pre-defined decision frameworks under pressure','Distinguishes reversible from irreversible decisions','Accepts 70% information threshold before deciding'],
    risk_indicators: ['Misses decision windows by seeking more data','Revisits decided issues repeatedly','Escalates unnecessarily to avoid commitment','Post-decision regret and second-guessing pattern'],
    assessment_indicators: ['Decision velocity benchmark','Information sufficiency threshold','Commitment index','Decision reversal frequency'],
    insight_logic: { trigger_condition: 'decision_velocity_score < threshold', threshold: 35, insight_template: 'Analysis paralysis pattern is creating decision bottlenecks. This is the top risk flag for promotion readiness to senior leadership — leaders must be able to commit under uncertainty.', severity_escalation_rule: 'block promotion readiness if sustained > 2 assessments' },
    recommendation_logic: { primary_action: 'Practise time-boxed decision protocols; use pre-mortem frameworks to reduce post-decision anxiety', learning_resources: ['AC_010','SI_004'], timeline_weeks: 8, success_metrics: ['Reduces average decision cycle time by 30%','Scores ≥60 on decision velocity benchmark','Zero escalations for decisions within authority level'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: true
  },
  {
    concern_key: 'el_decis_data_aversion', concern_name: 'Data-Light Decision Making',
    competency_code: 'EL_DECIS', blueprint_key: 'executive_leadership',
    signal_keys: ['AC_002','AC_010','DS_001'],
    concern_category: 'behavioral', severity_level: 'high',
    growth_indicators: ['References data unprompted in decision conversations','Builds measurement plan before deciding','Tracks outcomes of past decisions quantitatively','Challenges assumptions with evidence'],
    risk_indicators: ['Defaults to gut-feel without available data','Resists data that conflicts with existing view','Makes resource allocation decisions without ROI analysis','Ignores post-decision outcome measurement'],
    assessment_indicators: ['Data utilisation rate in decisions','Evidence-based reasoning assessment','Quantitative thinking test','Outcome measurement habit score'],
    insight_logic: { trigger_condition: 'data_utilisation_score < threshold', threshold: 42, insight_template: 'Decisions are being made with insufficient data utilisation. In complex organisations, data-light decisions compound risk — especially at leadership transitions.', severity_escalation_rule: 'escalate if data_science or analytics exposure is low' },
    recommendation_logic: { primary_action: 'Implement a personal decision log requiring a data reference before every major call', learning_resources: ['AC_002','DS_001'], timeline_weeks: 10, success_metrics: ['100% of major decisions reference at least one data point','Data quality rating improves in peer feedback','Develops team dashboard habit'] },
    feeds_readiness: true, feeds_digital_twin: false, feeds_outcome_prediction: true
  },

  // ── EL_INSPL · Inspirational Leadership ────────────────────────────────────
  {
    concern_key: 'el_inspl_purpose_disconnection', concern_name: 'Purpose Disconnection',
    competency_code: 'EL_INSPL', blueprint_key: 'executive_leadership',
    signal_keys: ['LP_001','LP_027','CI_028'],
    concern_category: 'leadership', severity_level: 'critical',
    growth_indicators: ['Connects individual team contributions to company mission','Crafts team purpose statement with team','References mission in performance conversations','Celebrates mission-aligned behaviours publicly'],
    risk_indicators: ['Team members cannot articulate why their work matters','Leader rarely references organisational purpose','Recognition is transactional not mission-linked','High attrition among high-meaning-seeking employees'],
    assessment_indicators: ['Team purpose clarity score','Mission articulation assessment','Engagement pulse survey','Purpose communication frequency'],
    insight_logic: { trigger_condition: 'purpose_alignment_score < threshold', threshold: 40, insight_template: 'Teams with disconnected purpose experience 34% higher voluntary attrition. This is a leading indicator for talent risk and team performance degradation.', severity_escalation_rule: 'escalate if team engagement score is also declining' },
    recommendation_logic: { primary_action: 'Run team purpose workshop; create mission-to-role connection map for each team member', learning_resources: ['LP_001','LP_027'], timeline_weeks: 6, success_metrics: ['90%+ of team members can articulate mission connection','Engagement pulse improves ≥10 points','Exit interviews show reduced purpose-related attrition'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: true
  },
  {
    concern_key: 'el_inspl_presence_inconsistency', concern_name: 'Values-Behaviour Gap',
    competency_code: 'EL_INSPL', blueprint_key: 'executive_leadership',
    signal_keys: ['LP_001','CI_028','EI_003'],
    concern_category: 'behavioral', severity_level: 'critical',
    growth_indicators: ['Actively solicits feedback on behaviour-values alignment','Publicly acknowledges when personal behaviour misses stated values','Models the team culture expectations visibly','Consistent across high-pressure and low-pressure situations'],
    risk_indicators: ['360 feedback shows gap between stated and observed values','Behaviour changes significantly under pressure','Blames team for cultural issues without self-reflection','Different standards applied to self vs team'],
    assessment_indicators: ['360 behaviour consistency score','Authentic leadership assessment','Values alignment rating','Pressure-state behaviour observation'],
    insight_logic: { trigger_condition: 'values_behaviour_gap_score > threshold', threshold: 25, insight_template: 'Observable gap between espoused values and behavioural evidence. This is one of the most significant leadership derailers — teams disengage when they see leaders not walking the talk.', severity_escalation_rule: 'critical derailer flag if gap persists 3+ assessments' },
    recommendation_logic: { primary_action: 'Engage executive coach for authentic leadership development; request monthly 360 pulse', learning_resources: ['LP_001','EI_003'], timeline_weeks: 24, success_metrics: ['360 gap closes to < 10 points','Consistently mentioned in positive culture feedback','Values-in-action examples cited by team members'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: true
  },

  // ── OM_PROCD · Process Design ───────────────────────────────────────────────
  {
    concern_key: 'om_procd_over_engineering', concern_name: 'Process Over-Engineering',
    competency_code: 'OM_PROCD', blueprint_key: 'operations_management',
    signal_keys: ['OE_002','OE_009','OE_026'],
    concern_category: 'functional', severity_level: 'moderate',
    growth_indicators: ['Designs minimum viable process before adding complexity','Tests with small pilot group before full rollout','Measures process effort vs value delivered','Prunes processes that create bureaucracy without benefit'],
    risk_indicators: ['Designs 15-step processes for simple tasks','Process adoption rate is consistently low','Team spends more time on process than on outcomes','Redesigns rarely improve cycle time significantly'],
    assessment_indicators: ['Process simplicity score','Adoption rate tracking','Cycle time improvement measure','Bureaucracy index'],
    insight_logic: { trigger_condition: 'process_complexity_score > threshold', threshold: 70, insight_template: 'Over-engineered processes are reducing team velocity. Complexity without corresponding value creation is a scalability risk.', severity_escalation_rule: 'escalate if adoption rate < 60%' },
    recommendation_logic: { primary_action: 'Audit all owned processes against "does this step add value?" criteria; eliminate lowest-ROI steps', learning_resources: ['OE_002','OE_009'], timeline_weeks: 8, success_metrics: ['Average process step count reduces 20%','Process adoption rate > 85%','Team reports reduced friction in surveys'] },
    feeds_readiness: false, feeds_digital_twin: true, feeds_outcome_prediction: false
  },
  {
    concern_key: 'om_procd_measurement_absence', concern_name: 'Unmeasured Process Operation',
    competency_code: 'OM_PROCD', blueprint_key: 'operations_management',
    signal_keys: ['OE_009','OE_026','AC_006'],
    concern_category: 'functional', severity_level: 'high',
    growth_indicators: ['Defines KPIs before process goes live','Tracks process metrics weekly','Runs structured retrospectives on process performance','Uses data to drive process iteration'],
    risk_indicators: ['Processes run for months without performance data','Cannot quantify whether process is working','Relies on anecdotal evidence for process assessment','No feedback loop from process output to process design'],
    assessment_indicators: ['Measurement discipline score','KPI definition rate','Data-driven iteration frequency','Process feedback loop audit'],
    insight_logic: { trigger_condition: 'measurement_discipline_score < threshold', threshold: 40, insight_template: 'Processes without measurement create invisible inefficiency. This is a scalability blocker — what cannot be measured cannot be improved.', severity_escalation_rule: 'escalate if team is scaling headcount without measurement foundation' },
    recommendation_logic: { primary_action: 'Define one measurable KPI for every owned process within 4 weeks; implement weekly review ritual', learning_resources: ['OE_026','AC_006'], timeline_weeks: 6, success_metrics: ['100% of core processes have defined KPIs','Monthly process review in team calendar','First data-driven process improvement completed'] },
    feeds_readiness: false, feeds_digital_twin: true, feeds_outcome_prediction: true
  },

  // ── OM_QUALM · Quality Management ──────────────────────────────────────────
  {
    concern_key: 'om_qualm_reactive_quality', concern_name: 'Reactive Quality Posture',
    competency_code: 'OM_QUALM', blueprint_key: 'operations_management',
    signal_keys: ['OE_003','OE_017','AC_006'],
    concern_category: 'functional', severity_level: 'high',
    growth_indicators: ['Builds quality prevention into process design','Runs pre-mortem analysis before releases','Tracks defect rate trends proactively','Designs quality gates not quality inspections'],
    risk_indicators: ['Quality team is primarily a defect-catching function','Defect rate is not trending down despite repeated focus','Quality issues discovered by customers not internally','No root cause analysis process for quality failures'],
    assessment_indicators: ['Prevention vs detection ratio','Defect rate trend','Customer-reported defect rate','Root cause analysis frequency'],
    insight_logic: { trigger_condition: 'reactive_quality_index > threshold', threshold: 60, insight_template: 'Quality posture is primarily reactive. Prevention costs 10x less than detection and 100x less than customer-reported failure. This is a structural risk for scaling operations.', severity_escalation_rule: 'critical if customer-reported defect rate is rising' },
    recommendation_logic: { primary_action: 'Implement upstream quality gates in process design; train team on defect prevention frameworks', learning_resources: ['OE_003','OE_017'], timeline_weeks: 12, success_metrics: ['Prevention-to-detection ratio improves to 60:40','Customer-reported defects reduce 30% in 6 months','Root cause analysis completed for every critical defect'] },
    feeds_readiness: false, feeds_digital_twin: false, feeds_outcome_prediction: true
  },

  // ── SE_ARCH · Software Architecture ────────────────────────────────────────
  {
    concern_key: 'se_arch_scalability_myopia', concern_name: 'Scalability Myopia',
    competency_code: 'SE_ARCH', blueprint_key: 'software_engineering',
    signal_keys: ['TE_001','TE_002','OE_002'],
    concern_category: 'functional', severity_level: 'high',
    growth_indicators: ['Designs with 10x growth assumption','Benchmarks current systems against projected load','Proactively identifies architectural bottlenecks','Evaluates architectural decisions against future-state requirements'],
    risk_indicators: ['Architecture requires rewrite at each growth stage','Performance degrades non-linearly with user growth','Technical debt accumulates faster than it is resolved','Scalability not considered in design reviews'],
    assessment_indicators: ['Scalability foresight assessment','Load modelling quality','Architectural debt ratio','Growth scenario planning score'],
    insight_logic: { trigger_condition: 'scalability_score < threshold', threshold: 45, insight_template: 'Architectural decisions are being made for current scale. Systems that need full rewrites at each growth stage create compounding technical debt and organisational risk.', severity_escalation_rule: 'escalate if system is in growth phase' },
    recommendation_logic: { primary_action: 'Conduct architecture review against 3-year growth projection; document scaling playbook', learning_resources: ['TE_001','TE_002'], timeline_weeks: 12, success_metrics: ['Architecture review documents 10x growth scenario','Zero emergency rewrites for 12 months','Performance SLAs maintained at 2x current load'] },
    feeds_readiness: false, feeds_digital_twin: true, feeds_outcome_prediction: true
  },
  {
    concern_key: 'se_arch_tech_debt_accumulation', concern_name: 'Unmanaged Technical Debt',
    competency_code: 'SE_ARCH', blueprint_key: 'software_engineering',
    signal_keys: ['TE_002','OE_009','AC_006'],
    concern_category: 'functional', severity_level: 'critical',
    growth_indicators: ['Allocates dedicated sprint capacity to debt reduction','Tracks technical debt as a first-class metric','Makes architectural tradeoffs explicit and documented','Reduces debt before adding significant new features'],
    risk_indicators: ['Velocity slows despite team size increase','Bug rate correlates with older code areas','Engineers spend > 30% time on workarounds','Architectural documentation is outdated or absent'],
    assessment_indicators: ['Technical debt ratio','Velocity trend','Bug concentration by code age','Documentation currency score'],
    insight_logic: { trigger_condition: 'tech_debt_index > threshold', threshold: 65, insight_template: 'Technical debt is accumulating faster than it is being resolved. Compound technical debt is the #1 cause of engineering team velocity collapse and is a leading indicator of system reliability risk.', severity_escalation_rule: 'critical if velocity has declined > 20% year-on-year' },
    recommendation_logic: { primary_action: 'Implement 20% sprint capacity rule for debt reduction; create technical debt register and prioritisation matrix', learning_resources: ['TE_002','OE_009'], timeline_weeks: 16, success_metrics: ['Tech debt ratio improves 30% in 6 months','Velocity trend stabilises or improves','All critical paths have current documentation'] },
    feeds_readiness: false, feeds_digital_twin: true, feeds_outcome_prediction: true
  },

  // ── SE_CODQ · Code Quality & Craft ─────────────────────────────────────────
  {
    concern_key: 'se_codq_test_coverage_neglect', concern_name: 'Test Coverage Deficit',
    competency_code: 'SE_CODQ', blueprint_key: 'software_engineering',
    signal_keys: ['TE_001','OE_003','AC_006'],
    concern_category: 'functional', severity_level: 'high',
    growth_indicators: ['Writes tests before or alongside code','Maintains > 80% test coverage on critical paths','Uses TDD for complex logic','Treats test suite as a first-class product asset'],
    risk_indicators: ['Test coverage < 50% on core paths','Releases frequently break existing functionality','Manual QA is the primary quality gate','Tests are written reactively after bugs are discovered'],
    assessment_indicators: ['Code coverage metric','Regression rate','TDD discipline score','Test-first habit assessment'],
    insight_logic: { trigger_condition: 'test_coverage_score < threshold', threshold: 50, insight_template: 'Low test coverage is creating brittle code foundations. Without automated safety nets, feature development velocity and refactoring confidence both suffer significantly.', severity_escalation_rule: 'escalate if regression rate is increasing' },
    recommendation_logic: { primary_action: 'Set and enforce team coverage thresholds; implement TDD training and pair programming for complex features', learning_resources: ['TE_001','OE_003'], timeline_weeks: 10, success_metrics: ['Critical path coverage ≥ 80%','Regression rate reduces 50%','New features shipped with tests from sprint 1'] },
    feeds_readiness: false, feeds_digital_twin: false, feeds_outcome_prediction: false
  },

  // ── PM_DELIV · Project Delivery ─────────────────────────────────────────────
  {
    concern_key: 'pm_deliv_scope_creep_tolerance', concern_name: 'Scope Creep Tolerance',
    competency_code: 'PM_DELIV', blueprint_key: 'project_management',
    signal_keys: ['OE_002','OE_026','AC_010'],
    concern_category: 'functional', severity_level: 'high',
    growth_indicators: ['Maintains clear scope boundaries with stakeholders','Uses change control process for scope additions','Communicates scope impact on timeline and budget proactively','Says no to scope additions when delivery is at risk'],
    risk_indicators: ['Projects consistently deliver beyond original scope without budget adjustment','Scope changes are accepted without formal change management','Team is frequently working on "urgent" unplanned requests','Original project deliverables are regularly deprioritised for new requests'],
    assessment_indicators: ['Scope discipline score','Change control adherence rate','Delivery-to-plan ratio','Stakeholder management quality'],
    insight_logic: { trigger_condition: 'scope_discipline_score < threshold', threshold: 45, insight_template: 'Scope creep pattern is the primary cause of project overruns. Without scope control, teams lose the ability to make reliable delivery commitments — destroying stakeholder trust progressively.', severity_escalation_rule: 'escalate if > 2 consecutive projects delivered late' },
    recommendation_logic: { primary_action: 'Implement formal change control protocol; train team on scope negotiation and impact communication', learning_resources: ['OE_002','AC_010'], timeline_weeks: 8, success_metrics: ['100% of scope changes go through change control','On-time delivery rate improves to ≥ 80%','Stakeholder satisfaction with delivery predictability improves'] },
    feeds_readiness: true, feeds_digital_twin: false, feeds_outcome_prediction: true
  },
  {
    concern_key: 'pm_deliv_risk_blindness', concern_name: 'Delivery Risk Blindness',
    competency_code: 'PM_DELIV', blueprint_key: 'project_management',
    signal_keys: ['OE_026','AC_002','SI_004'],
    concern_category: 'cognitive', severity_level: 'high',
    growth_indicators: ['Maintains a live risk register for all projects','Proactively identifies risks before they become issues','Escalates risks before they impact delivery','Designs risk mitigation into project plans'],
    risk_indicators: ['Issues are consistently discovered late in project lifecycle','No formal risk review cadence','Risks are not rated by probability or impact','Team is repeatedly surprised by the same failure modes'],
    assessment_indicators: ['Risk identification completeness','Risk register quality score','Early escalation rate','Risk-to-issue conversion rate'],
    insight_logic: { trigger_condition: 'risk_awareness_score < threshold', threshold: 40, insight_template: 'Project risk is being managed reactively. Late issue discovery is a compounding pattern — it signals that risk identification and escalation habits have not yet formed.', severity_escalation_rule: 'escalate if 3+ projects have had unforeseeable late-stage failures' },
    recommendation_logic: { primary_action: 'Implement weekly risk review; use RAID log as a mandatory project artefact', learning_resources: ['OE_026','SI_004'], timeline_weeks: 6, success_metrics: ['Risk register maintained for all active projects','Risk-to-issue conversion reduces 40%','Zero escalation-surprise events in 6 months'] },
    feeds_readiness: true, feeds_digital_twin: false, feeds_outcome_prediction: true
  },

  // ── PM_AGILE · Agile Execution ──────────────────────────────────────────────
  {
    concern_key: 'pm_agile_theatre', concern_name: 'Agile Theatre Pattern',
    competency_code: 'PM_AGILE', blueprint_key: 'project_management',
    signal_keys: ['OE_002','OE_009','CI_028'],
    concern_category: 'behavioral', severity_level: 'high',
    growth_indicators: ['Adapts agile practices to team context vs applying dogmatically','Focuses standups on blockers not status updates','Retrospective actions are tracked and completed','Measures velocity and uses it to improve planning'],
    risk_indicators: ['Daily standups consistently run > 20 minutes','Sprint retrospectives produce no actionable changes','Velocity is tracked but never used to improve','Agile practices are followed without understanding their purpose'],
    assessment_indicators: ['Agile maturity assessment','Retrospective action completion rate','Standup quality score','Velocity trend'],
    insight_logic: { trigger_condition: 'agile_effectiveness_score < threshold', threshold: 40, insight_template: 'Agile rituals are being followed without the underlying mindset. This creates process overhead without the iterative improvement benefit — teams get ceremony with none of the adaptability.', severity_escalation_rule: 'escalate if team velocity is flat or declining despite the same team size' },
    recommendation_logic: { primary_action: 'Conduct Agile mindset workshop; audit and redesign current ceremonies against their original purpose', learning_resources: ['OE_002','OE_009'], timeline_weeks: 8, success_metrics: ['Retrospective action completion rate ≥ 70%','Standup duration < 15 minutes 90% of time','Velocity improves or stabilises with deliberate planning'] },
    feeds_readiness: false, feeds_digital_twin: false, feeds_outcome_prediction: false
  },

  // ── SL_PERSU · Persuasion & Negotiation ────────────────────────────────────
  {
    concern_key: 'sl_persu_pushover_tendency', concern_name: 'Value Concession Pattern',
    competency_code: 'SL_PERSU', blueprint_key: 'sales_leadership',
    signal_keys: ['CI_001','CI_028','AC_010'],
    concern_category: 'behavioral', severity_level: 'high',
    growth_indicators: ['Prepares BATNA before every significant negotiation','Defends value with evidence rather than discounts','Walks away from unprofitable deals','Tracks concession patterns over time'],
    risk_indicators: ['Average deal discount rate exceeds 20%','Concedes on price before exploring alternatives','Loses deals after giving maximum discount','Feels uncomfortable with silence in negotiation'],
    assessment_indicators: ['Discount rate analysis','Negotiation simulation score','BATNA preparation habit','Win rate on full-price deals'],
    insight_logic: { trigger_condition: 'negotiation_effectiveness_score < threshold', threshold: 42, insight_template: 'Consistent value concession pattern is eroding deal quality. This signals either low confidence in the value proposition or underdeveloped negotiation technique.', severity_escalation_rule: 'critical if average discount rate > 25%' },
    recommendation_logic: { primary_action: 'Complete negotiation skills workshop; practise value-based selling conversations with role play', learning_resources: ['CI_001','CI_028'], timeline_weeks: 8, success_metrics: ['Average discount rate reduces to < 15%','Win rate on full-price conversations improves 20%','BATNA prepared for 100% of strategic deals'] },
    feeds_readiness: true, feeds_digital_twin: false, feeds_outcome_prediction: true
  },
  {
    concern_key: 'sl_persu_influence_aggression', concern_name: 'Pressure-Based Influence',
    competency_code: 'SL_PERSU', blueprint_key: 'sales_leadership',
    signal_keys: ['CI_028','LP_001','EI_003'],
    concern_category: 'behavioral', severity_level: 'critical',
    growth_indicators: ['Leads with curiosity about buyer situation','Uses logic and evidence as primary influence tools','Builds influence through trust over time','Receives positive feedback on persuasion style'],
    risk_indicators: ['Customers or colleagues complain of feeling pressured','High initial close rate but low retention or referral rate','Uses urgency tactics without genuine scarcity','Relationship quality declines after transactions'],
    assessment_indicators: ['Influence style assessment','Customer satisfaction post-sale','Relationship longevity metric','Peer feedback on influence approach'],
    insight_logic: { trigger_condition: 'pressure_influence_score > threshold', threshold: 55, insight_template: 'Pressure-based influence creates short-term wins but systematically destroys relationship capital. It is a leading indicator for low customer lifetime value and reputational risk.', severity_escalation_rule: 'critical derailer if customer complaints are documented' },
    recommendation_logic: { primary_action: 'Enrol in consultative selling programme; reframe KPIs from close rate to customer lifetime value', learning_resources: ['CI_028','EI_003'], timeline_weeks: 12, success_metrics: ['Customer satisfaction (post-sale) improves 15+ NPS points','Referral rate increases','0 documented pressure complaints in 6 months'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: true
  },

  // ── SL_CUSTC · Customer Centricity ─────────────────────────────────────────
  {
    concern_key: 'sl_custc_inside_out_selling', concern_name: 'Inside-Out Selling Pattern',
    competency_code: 'SL_CUSTC', blueprint_key: 'sales_leadership',
    signal_keys: ['CI_001','CI_028','OE_026'],
    concern_category: 'behavioral', severity_level: 'high',
    growth_indicators: ['Opens conversations with customer problem discovery','Tailors presentations to specific customer context','References customer language in proposals','Measures success by customer outcome not product sold'],
    risk_indicators: ['Sales presentations are generic feature-benefit decks','Discovery questions are formulaic not genuinely curious','Customer problems are mapped to product features not solutions','Win stories focus on what was sold not what was solved'],
    assessment_indicators: ['Discovery quality score','Presentation relevance rating','Customer language usage','Problem-solution alignment audit'],
    insight_logic: { trigger_condition: 'customer_centricity_score < threshold', threshold: 44, insight_template: 'Selling pattern starts from product rather than customer problem. This reduces resonance, increases price sensitivity, and signals a product-push vs problem-solve orientation.', severity_escalation_rule: 'escalate if win rate is below industry benchmark' },
    recommendation_logic: { primary_action: 'Implement structured discovery methodology; shadow top performers on customer conversations', learning_resources: ['CI_001','OE_026'], timeline_weeks: 10, success_metrics: ['Discovery call quality score improves ≥ 20 points','Win rate improves 15% without price changes','Customer feedback cites problem understanding as a strength'] },
    feeds_readiness: true, feeds_digital_twin: false, feeds_outcome_prediction: true
  },

  // ── CS_EMPTH · Empathy ──────────────────────────────────────────────────────
  {
    concern_key: 'cs_empth_sympathy_substitution', concern_name: 'Sympathy-Not-Empathy Pattern',
    competency_code: 'CS_EMPTH', blueprint_key: 'customer_success',
    signal_keys: ['EI_001','EI_003','CI_028'],
    concern_category: 'emotional', severity_level: 'moderate',
    growth_indicators: ['Reflects feelings before offering solutions','Asks "what would help most?" before suggesting','Checks understanding of customer perspective explicitly','Adjusts response based on emotional state of customer'],
    risk_indicators: ['Jumps to solution before acknowledging customer emotion','Uses "I understand" without demonstrating understanding','Customers repeat themselves because they feel unheard','Confuses agreement with empathy'],
    assessment_indicators: ['Empathy accuracy score','Customer-reported feeling-heard rating','Active listening assessment','Solution-jump frequency'],
    insight_logic: { trigger_condition: 'empathy_accuracy_score < threshold', threshold: 48, insight_template: 'Sympathy (feeling for) is being used in place of empathy (understanding). This creates a gap between intent and impact — customers feel managed rather than understood.', severity_escalation_rule: 'escalate if CSAT < 75' },
    recommendation_logic: { primary_action: 'Complete active listening and empathy training; practice perspective-taking exercises in team roleplay', learning_resources: ['EI_001','EI_003'], timeline_weeks: 6, success_metrics: ['Empathy accuracy score improves ≥ 15 points','Customer "feeling heard" rating improves to ≥ 8/10','0 complaints about being unheard in 3 months'] },
    feeds_readiness: false, feeds_digital_twin: true, feeds_outcome_prediction: false
  },
  {
    concern_key: 'cs_empth_empathy_fatigue', concern_name: 'Empathy Fatigue Risk',
    competency_code: 'CS_EMPTH', blueprint_key: 'customer_success',
    signal_keys: ['EI_003','MH_001','OE_026'],
    concern_category: 'emotional', severity_level: 'high',
    growth_indicators: ['Maintains recovery rituals between high-intensity interactions','Recognises personal emotional depletion signals','Builds professional boundaries without reducing care quality','Seeks peer support when carrying heavy emotional load'],
    risk_indicators: ['Increasing emotional detachment from customer problems','Cynicism or sarcasm about customer situations','Physical or emotional exhaustion after customer interactions','Consistent pattern of low energy in customer-facing work'],
    assessment_indicators: ['Burnout risk index','Emotional recovery rate','Detachment signal score','Work-life boundary quality'],
    insight_logic: { trigger_condition: 'empathy_fatigue_index > threshold', threshold: 60, insight_template: 'Empathy fatigue risk is elevated. Without intervention, this leads to compassion burnout — a significant wellbeing risk and a predictor of service quality decline.', severity_escalation_rule: 'immediate wellbeing flag if burnout index > 75' },
    recommendation_logic: { primary_action: 'Implement structured recovery practices; review workload and interaction intensity with manager', learning_resources: ['EI_003','MH_001'], timeline_weeks: 4, success_metrics: ['Burnout risk index reduces below 45','Emotional recovery between interactions improves','Peer support network established'] },
    feeds_readiness: false, feeds_digital_twin: true, feeds_outcome_prediction: true
  },

  // ── CS_RELM · Relationship Management ──────────────────────────────────────
  {
    concern_key: 'cs_relm_transactional_mindset', concern_name: 'Transactional Relationship Pattern',
    competency_code: 'CS_RELM', blueprint_key: 'customer_success',
    signal_keys: ['CI_001','EI_001','OE_026'],
    concern_category: 'behavioral', severity_level: 'high',
    growth_indicators: ['Invests in relationships outside of active deals','Checks in with customers without transactional agenda','Builds a genuine understanding of customer world','Maintains relationships through contract renewals'],
    risk_indicators: ['Customer contact only at key transaction points','Customer relationships do not survive personnel changes','Low referral and advocacy rates from existing customers','Attrition spikes in renewal conversations'],
    assessment_indicators: ['Relationship depth score','Contact-to-transaction ratio','Referral rate','Renewal conversation quality'],
    insight_logic: { trigger_condition: 'relationship_depth_score < threshold', threshold: 40, insight_template: 'Transactional relationship management creates fragile customer portfolios. Relationships that only exist around transactions are vulnerable to competitive disruption.', severity_escalation_rule: 'escalate if net revenue retention < 90%' },
    recommendation_logic: { primary_action: 'Implement proactive check-in cadence for all key accounts; develop customer success plans', learning_resources: ['CI_001','EI_001'], timeline_weeks: 10, success_metrics: ['Net revenue retention improves ≥ 5 points','Referral rate doubles in 12 months','Customer satisfaction maintained post-transaction'] },
    feeds_readiness: true, feeds_digital_twin: false, feeds_outcome_prediction: true
  },

  // ── DS_MLE · Machine Learning Engineering ──────────────────────────────────
  {
    concern_key: 'ds_mle_model_overfit_bias', concern_name: 'Model Generalisation Weakness',
    competency_code: 'DS_MLE', blueprint_key: 'data_science',
    signal_keys: ['TE_001','TE_002','AC_002'],
    concern_category: 'functional', severity_level: 'high',
    growth_indicators: ['Uses held-out test sets appropriately','Applies cross-validation systematically','Monitors model performance drift post-deployment','Evaluates models on out-of-distribution samples'],
    risk_indicators: ['Models perform significantly worse in production than in testing','Does not separate validation from test sets','Tunes hyperparameters on test data','No monitoring of model drift post-deployment'],
    assessment_indicators: ['Generalisation gap metric','Validation discipline score','Deployment monitoring setup','Cross-validation usage'],
    insight_logic: { trigger_condition: 'generalisation_score < threshold', threshold: 45, insight_template: 'Model validation practices risk overfitting — optimising for test performance rather than real-world generalisation. This creates invisible production risk.', severity_escalation_rule: 'escalate if production model accuracy < 80% of test accuracy' },
    recommendation_logic: { primary_action: 'Implement rigorous train/val/test separation; establish model performance monitoring in production', learning_resources: ['TE_001','AC_002'], timeline_weeks: 8, success_metrics: ['Production accuracy within 5% of validation accuracy','Model monitoring dashboard live within 4 weeks','Zero overfitting-driven production failures'] },
    feeds_readiness: false, feeds_digital_twin: true, feeds_outcome_prediction: true
  },
  {
    concern_key: 'ds_mle_production_readiness_gap', concern_name: 'Model Production Readiness Gap',
    competency_code: 'DS_MLE', blueprint_key: 'data_science',
    signal_keys: ['TE_001','TE_002','OE_002'],
    concern_category: 'functional', severity_level: 'high',
    growth_indicators: ['Builds models with deployment in mind from day 1','Documents model dependencies and requirements','Tests models in staging environment before production','Collaborates with engineering on productionisation'],
    risk_indicators: ['Models frequently fail to deploy without significant rework','No version control for models or training data','Model latency in production not evaluated','Data science and engineering work in silos'],
    assessment_indicators: ['MLOps maturity score','Deployment success rate','Engineering collaboration score','Model documentation quality'],
    insight_logic: { trigger_condition: 'mlops_maturity_score < threshold', threshold: 40, insight_template: 'Models built without production readiness create a research-to-reality gap. This wastes model development investment and creates cross-functional friction.', severity_escalation_rule: 'escalate if > 50% of models require significant rework post-handoff' },
    recommendation_logic: { primary_action: 'Adopt MLOps practices; embed with engineering team on one end-to-end model deployment', learning_resources: ['TE_001','OE_002'], timeline_weeks: 12, success_metrics: ['Model deployment success rate ≥ 90%','Average rework time post-handoff reduces 50%','MLOps tooling implemented and adopted'] },
    feeds_readiness: false, feeds_digital_twin: true, feeds_outcome_prediction: false
  },

  // ── DS_STATS · Statistical Analysis ────────────────────────────────────────
  {
    concern_key: 'ds_stats_correlation_causation', concern_name: 'Correlation-Causation Conflation',
    competency_code: 'DS_STATS', blueprint_key: 'data_science',
    signal_keys: ['AC_002','AC_010','TE_001'],
    concern_category: 'cognitive', severity_level: 'high',
    growth_indicators: ['Explicitly states correlation vs causation in findings','Proposes experimental designs to test causal hypotheses','Identifies confounding variables in analyses','Communicates statistical uncertainty appropriately'],
    risk_indicators: ['Draws causal conclusions from observational data','Does not acknowledge confounders in analysis','Recommends actions based on spurious correlations','Statistical significance conflated with practical significance'],
    assessment_indicators: ['Causal reasoning test score','Confounder identification quality','Experimental design capability','Uncertainty communication score'],
    insight_logic: { trigger_condition: 'causal_reasoning_score < threshold', threshold: 50, insight_template: 'Systematic conflation of correlation and causation creates high-risk analytical outputs. Business decisions made on spurious causal claims can be costly to reverse.', severity_escalation_rule: 'critical if business decisions have been reversed due to analytical errors' },
    recommendation_logic: { primary_action: 'Complete causal inference coursework; implement peer review requirement for all business-critical analyses', learning_resources: ['AC_002','TE_001'], timeline_weeks: 10, success_metrics: ['Causal reasoning score improves ≥ 20 points','Peer review integrated into analytical workflow','0 causal claim errors in external reports'] },
    feeds_readiness: false, feeds_digital_twin: false, feeds_outcome_prediction: true
  },

  // ── PL_PSYS · Psychological Safety ─────────────────────────────────────────
  {
    concern_key: 'pl_psys_silence_culture', concern_name: 'Silence Culture Risk',
    competency_code: 'PL_PSYS', blueprint_key: 'people_leadership',
    signal_keys: ['LP_001','EI_003','CI_028'],
    concern_category: 'leadership', severity_level: 'critical',
    growth_indicators: ['Actively solicits dissenting views in meetings','Responds to concerns with curiosity not defensiveness','Makes it visible when a team concern led to a change','Rewards candour publicly'],
    risk_indicators: ['Team meetings are free of disagreement or challenge','Ideas are not tested before execution','Errors are discovered late because they go unreported','Post-mortems lack honest analysis'],
    assessment_indicators: ['Psychological safety assessment score','Meeting quality (candour rate)','Error reporting rate','Retrospective honesty index'],
    insight_logic: { trigger_condition: 'psychological_safety_score < threshold', threshold: 42, insight_template: 'Silence culture creates invisible risks. Teams that cannot safely raise concerns or challenge ideas make avoidable errors — this is the foundational predictor of team performance.', severity_escalation_rule: 'critical if combined with high team attrition' },
    recommendation_logic: { primary_action: 'Run Amy Edmondson psychological safety team intervention; lead with personal vulnerability in next team meeting', learning_resources: ['LP_001','EI_003'], timeline_weeks: 10, success_metrics: ['Psychological safety survey score improves ≥ 15 points','Candour rate in meetings increases visibly','Team voluntarily raises concerns without prompting'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: true
  },
  {
    concern_key: 'pl_psys_blame_attribution', concern_name: 'Blame Attribution Pattern',
    competency_code: 'PL_PSYS', blueprint_key: 'people_leadership',
    signal_keys: ['LP_001','EI_001','CI_028'],
    concern_category: 'behavioral', severity_level: 'critical',
    growth_indicators: ['Uses systems thinking to analyse failures before attributing cause','Runs blameless post-mortems','Shields team from external blame when systemic factors are involved','Models accountability without blame in personal communication'],
    risk_indicators: ['Failure conversations consistently focus on who rather than what or why','Team members avoid accountability to escape blame','Post-mortems lead to punitive outcomes','Psychological safety survey shows fear of failure'],
    assessment_indicators: ['Blameless post-mortem quality','Failure response assessment','Team psychological safety sub-score','Accountability culture rating'],
    insight_logic: { trigger_condition: 'blame_attribution_score > threshold', threshold: 55, insight_template: 'Blame-first response to failures creates a fear culture that suppresses learning. This is the single most consistent predictor of team performance regression over time.', severity_escalation_rule: 'immediate flag if team members have reported blame culture formally' },
    recommendation_logic: { primary_action: 'Implement blameless post-mortem process; read Dekker\'s safety-II and apply systems thinking to next failure', learning_resources: ['LP_001','EI_001'], timeline_weeks: 8, success_metrics: ['100% of failures reviewed with blameless framework','Psychological safety score improves ≥ 20 points','Team reports feeling safe to take risks in pulse survey'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: true
  },

  // ── PL_COACH · Coaching & Mentoring ────────────────────────────────────────
  {
    concern_key: 'pl_coach_directive_coaching', concern_name: 'Directive Rather Than Coaching',
    competency_code: 'PL_COACH', blueprint_key: 'people_leadership',
    signal_keys: ['LP_027','EI_003','CI_028'],
    concern_category: 'behavioral', severity_level: 'high',
    growth_indicators: ['Leads developmental conversations with questions not answers','Creates space for team members to arrive at their own solutions','Coaches in the moment rather than only in scheduled sessions','Tracks team member development over time'],
    risk_indicators: ['Team members come to leader for answers to problems they could solve','Development conversations are brief and advice-heavy','Team is dependent on leader for problem resolution','Leader spends more time solving than developing'],
    assessment_indicators: ['Question-to-statement ratio in coaching sessions','Team problem-solving independence score','Coaching conversation quality','Team development velocity'],
    insight_logic: { trigger_condition: 'coaching_quality_score < threshold', threshold: 40, insight_template: 'Directive leadership style is limiting team capability development. When leaders answer rather than coach, teams remain dependent and cannot scale beyond the leader\'s own capacity.', severity_escalation_rule: 'escalate if team capability growth is stagnating year-on-year' },
    recommendation_logic: { primary_action: 'Complete GROW model coaching training; commit to 1:1 coaching conversation weekly without giving advice', learning_resources: ['LP_027','EI_003'], timeline_weeks: 10, success_metrics: ['Team members report increased autonomy in surveys','Leader question:statement ratio improves to 60:40','At least 2 team members show measurable capability growth in 6 months'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: true
  },

  // ── PM2_STRAT · Product Strategy ────────────────────────────────────────────
  {
    concern_key: 'pm2_strat_feature_factory', concern_name: 'Feature Factory Trap',
    competency_code: 'PM2_STRAT', blueprint_key: 'product_management',
    signal_keys: ['SI_001','AC_010','OE_002'],
    concern_category: 'cognitive', severity_level: 'high',
    growth_indicators: ['Defines success in terms of outcomes not output','Challenges feature requests with "what problem are we solving?"','Measures product by business impact not release velocity','Kills features that do not deliver expected outcome'],
    risk_indicators: ['Roadmap is a feature list not an outcome plan','Product backlog is entirely feature-driven','Success is measured by features shipped not problems solved','Engineering velocity is celebrated over customer impact'],
    assessment_indicators: ['Outcome orientation score','Roadmap quality assessment','Feature kill rate','Business impact measurement habit'],
    insight_logic: { trigger_condition: 'outcome_orientation_score < threshold', threshold: 40, insight_template: 'Feature factory pattern produces output without corresponding customer value. Products built this way optimise for activity not impact — creating complexity without solving problems.', severity_escalation_rule: 'escalate if product NPS is flat despite high release velocity' },
    recommendation_logic: { primary_action: 'Reformat roadmap as outcome-based OKRs; introduce impact measurement for every feature shipped', learning_resources: ['SI_001','OE_002'], timeline_weeks: 8, success_metrics: ['All roadmap items have defined success metrics','Feature impact measured within 60 days of release','Product NPS improves despite fewer features shipped'] },
    feeds_readiness: true, feeds_digital_twin: false, feeds_outcome_prediction: true
  },
  {
    concern_key: 'pm2_strat_market_signal_lag', concern_name: 'Market Signal Integration Lag',
    competency_code: 'PM2_STRAT', blueprint_key: 'product_management',
    signal_keys: ['SI_001','SI_002','AC_002'],
    concern_category: 'cognitive', severity_level: 'high',
    growth_indicators: ['Integrates market feedback into roadmap within one sprint','Monitors competitive landscape monthly','Conducts customer interviews systematically','Adjusts product direction based on market signals proactively'],
    risk_indicators: ['Product direction changes only in response to major customer loss','Competitive features are a surprise when discovered','Customer feedback sits in reports without roadmap influence','Market research is annual not continuous'],
    assessment_indicators: ['Market feedback integration speed','Competitive intelligence score','Customer interview frequency','Roadmap adaptation rate'],
    insight_logic: { trigger_condition: 'market_responsiveness_score < threshold', threshold: 45, insight_template: 'Slow market signal integration creates a reaction lag that compounds into competitive disadvantage. In fast-moving markets, a 90-day signal lag can be strategically decisive.', severity_escalation_rule: 'critical if a competitive feature has caused material churn' },
    recommendation_logic: { primary_action: 'Implement continuous discovery habits; run bi-weekly customer interviews and monthly competitive review', learning_resources: ['SI_001','AC_002'], timeline_weeks: 8, success_metrics: ['Weekly customer signal integration into backlog','Competitive review cadence established','Roadmap adaptation happens within 2 sprints of market signal'] },
    feeds_readiness: true, feeds_digital_twin: false, feeds_outcome_prediction: true
  },

  // ── PM2_USERR · User Research & Discovery ───────────────────────────────────
  {
    concern_key: 'pm2_userr_assumption_build', concern_name: 'Assumption-Driven Building',
    competency_code: 'PM2_USERR', blueprint_key: 'product_management',
    signal_keys: ['AC_002','AC_010','SI_002'],
    concern_category: 'functional', severity_level: 'high',
    growth_indicators: ['Explicitly states assumptions before building','Designs lightweight experiments to validate before full build','Uses user interviews to challenge internal assumptions','Celebrates invalidated assumptions as learning'],
    risk_indicators: ['Features are built based on stakeholder opinion not user validation','User research is done after decisions are made','Team says "we know what users need" without recent data','High rate of post-launch feature abandonment'],
    assessment_indicators: ['Assumption validation rate','Research-before-build habit','Post-launch adoption rate','Discovery quality score'],
    insight_logic: { trigger_condition: 'assumption_validation_score < threshold', threshold: 40, insight_template: 'Building on assumptions without validation creates waste — features built for users who do not exist or problems that are already solved. This is the primary cause of low product adoption.', severity_escalation_rule: 'escalate if feature adoption rate < 30% consistently' },
    recommendation_logic: { primary_action: 'Implement assumption mapping before every feature; run 5 user interviews before next major build decision', learning_resources: ['AC_002','SI_002'], timeline_weeks: 6, success_metrics: ['All major features validated with at least 3 user interviews','Post-launch adoption improves 30%','Assumption log maintained and reviewed in sprint planning'] },
    feeds_readiness: false, feeds_digital_twin: false, feeds_outcome_prediction: false
  },

  // ── FR2_AILIT · AI Literacy & Collaboration ─────────────────────────────────
  {
    concern_key: 'fr2_ailit_ai_avoidance', concern_name: 'AI Tool Avoidance Pattern',
    competency_code: 'FR2_AILIT', blueprint_key: 'future_readiness_blueprint',
    signal_keys: ['AI_001','AI_002','FR_001'],
    concern_category: 'behavioral', severity_level: 'high',
    growth_indicators: ['Experiments with at least one AI tool per month','Reflects on what AI can and cannot do well','Shares AI workflow learnings with team','Views AI as a capability amplifier not a job threat'],
    risk_indicators: ['Refuses to use AI tools citing reliability concerns','Has not adopted any AI tools despite availability','Dismisses AI use cases in their domain as irrelevant','Anxiety or discomfort visibly increases in AI discussions'],
    assessment_indicators: ['AI tool adoption rate','AI experimentation frequency','AI literacy assessment score','AI anxiety index'],
    insight_logic: { trigger_condition: 'ai_literacy_score < threshold', threshold: 35, insight_template: 'AI avoidance creates a widening capability gap. Professionals who do not adopt AI tools are being outcompeted for productivity and insight by those who do — this is a future employability risk factor.', severity_escalation_rule: 'elevate if in a high-AI-disruption role family' },
    recommendation_logic: { primary_action: 'Enrol in AI fundamentals programme; complete one AI-assisted workflow experiment per week for 4 weeks', learning_resources: ['AI_001','FR_001'], timeline_weeks: 8, success_metrics: ['AI literacy score improves ≥ 20 points','Uses at least 2 AI tools in weekly workflow','Shares one AI workflow insight with team per month'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: true
  },
  {
    concern_key: 'fr2_ailit_ai_overreliance', concern_name: 'Uncritical AI Dependency',
    competency_code: 'FR2_AILIT', blueprint_key: 'future_readiness_blueprint',
    signal_keys: ['AI_001','AI_002','AC_002'],
    concern_category: 'cognitive', severity_level: 'high',
    growth_indicators: ['Fact-checks AI outputs before using them','Understands limitations of the AI tools being used','Applies human judgement to AI-generated recommendations','Treats AI as a draft not a final answer'],
    risk_indicators: ['Publishes or acts on AI outputs without verification','Cannot explain how an AI reached its conclusion','Trusts AI over domain expert knowledge','Has had errors caused by uncritical AI output use'],
    assessment_indicators: ['AI output verification habit','Critical AI assessment score','Error-from-AI rate','AI-human judgement balance score'],
    insight_logic: { trigger_condition: 'ai_critical_assessment_score < threshold', threshold: 45, insight_template: 'Uncritical AI dependency creates invisible quality risks. AI tools are confident even when wrong — human verification is the essential layer that distinguishes AI-amplified from AI-dependent work.', severity_escalation_rule: 'immediate flag if errors from AI output have reached clients or stakeholders' },
    recommendation_logic: { primary_action: 'Implement AI output verification checklist for all high-stakes work; study AI hallucination patterns in relevant domain', learning_resources: ['AI_001','AC_002'], timeline_weeks: 6, success_metrics: ['100% of AI outputs verified before external use','Zero AI-caused errors in deliverables for 3 months','Can explain AI reasoning for 90% of tools used'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: true
  },

  // ── FR2_LEARNA · Learning Agility ───────────────────────────────────────────
  {
    concern_key: 'fr2_learna_fixed_mindset', concern_name: 'Fixed Mindset Pattern',
    competency_code: 'FR2_LEARNA', blueprint_key: 'future_readiness_blueprint',
    signal_keys: ['LA_001','EI_001','LP_001'],
    concern_category: 'behavioral', severity_level: 'critical',
    growth_indicators: ['Seeks critical feedback proactively','Treats failure as data not identity','Changes approach based on new evidence','Views skills as developable not fixed'],
    risk_indicators: ['Avoids situations where failure is possible','Reacts defensively to constructive feedback','Attributes failures to external factors','Repeats same approach despite evidence it is not working'],
    assessment_indicators: ['Mindset orientation score','Feedback response quality','Failure attribution style','Approach flexibility index'],
    insight_logic: { trigger_condition: 'growth_mindset_score < threshold', threshold: 40, insight_template: 'Fixed mindset orientation is the most consistent predictor of learning velocity. Professionals with fixed mindset plateau earlier and adapt more slowly — a compounding career risk in fast-changing roles.', severity_escalation_rule: 'critical for high-disruption roles; flag in outcome prediction' },
    recommendation_logic: { primary_action: 'Engage in mindset coaching using Dweck frameworks; commit to one stretch challenge per quarter', learning_resources: ['LA_001','EI_001'], timeline_weeks: 16, success_metrics: ['Growth mindset score improves ≥ 15 points','Seeks feedback at least monthly','Completes one challenging new skill in 6 months'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: true
  },
  {
    concern_key: 'fr2_learna_learning_without_transfer', concern_name: 'Learning Without Application',
    competency_code: 'FR2_LEARNA', blueprint_key: 'future_readiness_blueprint',
    signal_keys: ['LA_001','OE_009','AC_002'],
    concern_category: 'behavioral', severity_level: 'moderate',
    growth_indicators: ['Plans application experiment for every learning','Shares insights with team within a week of learning','Tracks capability improvements from learning investments','Chooses learning based on current development needs'],
    risk_indicators: ['High course completion rate but no visible skill application','Consumes learning content without connecting to practice','Cannot describe one thing learned that changed their approach','Learning is a scheduled activity not a continuous habit'],
    assessment_indicators: ['Learning transfer rate','Application experiment frequency','Skill application evidence','Learning-to-practice gap'],
    insight_logic: { trigger_condition: 'learning_transfer_score < threshold', threshold: 42, insight_template: 'Learning without application creates the illusion of growth. Knowledge without transfer has no capability return on investment — and this pattern signals that learning is treated as compliance not development.', severity_escalation_rule: 'escalate if high learning investment is not reflected in capability scores' },
    recommendation_logic: { primary_action: 'Implement a 70-20-10 model; for every course completed, design one application experiment within 7 days', learning_resources: ['LA_001','OE_009'], timeline_weeks: 8, success_metrics: ['Learning transfer rate > 60%','At least one skill application per learning unit','Team notices visible capability change from learning investment'] },
    feeds_readiness: true, feeds_digital_twin: true, feeds_outcome_prediction: false
  },
];

export function registerTalentConcernIntelligenceRoutes(
  app: Express, pool: Pool, requireAuth: AuthFn, requireSuperAdmin: AuthFn
): void {
  const guard = (req: Request, res: Response, next: () => void) => {
    if (!flagOn()) return res.status(503).json({ error: `${FLAG} is off` });
    next();
  };

  /* ── seed on first request ──────────────────────────────────────────────── */
  let seeded = false;
  async function seedIfNeeded(): Promise<void> {
    if (seeded) return;
    await ensureSchema(pool);
    const existing = await pool.query('SELECT COUNT(*) FROM talent_concern_master').catch(() => ({ rows: [{ count: '0' }] }));
    if (Number(existing.rows[0].count) === 0) {
      for (const r of CONCERN_RECORDS) {
        await pool.query(
          `INSERT INTO talent_concern_master
            (concern_key,concern_name,competency_code,blueprint_key,signal_keys,concern_category,severity_level,
             growth_indicators,risk_indicators,assessment_indicators,insight_logic,recommendation_logic,
             feeds_readiness,feeds_digital_twin,feeds_outcome_prediction)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (concern_key) DO NOTHING`,
          [r.concern_key, r.concern_name, r.competency_code, r.blueprint_key,
           r.signal_keys, r.concern_category, r.severity_level,
           JSON.stringify(r.growth_indicators), JSON.stringify(r.risk_indicators),
           JSON.stringify(r.assessment_indicators), JSON.stringify(r.insight_logic),
           JSON.stringify(r.recommendation_logic),
           r.feeds_readiness, r.feeds_digital_twin, r.feeds_outcome_prediction]
        ).catch(() => null);
      }
    }
    seeded = true;
  }

  /* ── GET /api/admin/talent/concerns ─────────────────────────────────────── */
  app.get('/api/admin/talent/concerns', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seedIfNeeded().catch(() => null);
    const cached = getCached<unknown>('concerns_list');
    if (cached && !req.query.refresh) return res.json(cached);
    try {
      const { blueprint_key, competency_code, severity_level, concern_category, search, page = '1', limit = '50' } = req.query as Record<string, string>;
      const params: unknown[] = [];
      const where: string[] = ['is_active = true'];
      if (blueprint_key) { params.push(blueprint_key); where.push(`blueprint_key = $${params.length}`); }
      if (competency_code) { params.push(competency_code); where.push(`competency_code = $${params.length}`); }
      if (severity_level) { params.push(severity_level); where.push(`severity_level = $${params.length}`); }
      if (concern_category) { params.push(concern_category); where.push(`concern_category = $${params.length}`); }
      if (search) { params.push(`%${search}%`); where.push(`(concern_name ILIKE $${params.length} OR concern_key ILIKE $${params.length})`); }
      const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const [rows, cnt] = await Promise.all([
        pool.query(`SELECT * FROM talent_concern_master ${wc} ORDER BY blueprint_key, competency_code, severity_level LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, parseInt(limit), offset]),
        pool.query(`SELECT COUNT(*) FROM talent_concern_master ${wc}`, params),
      ]);
      const payload = { concerns: rows.rows, total: Number(cnt.rows[0].count), page: parseInt(page), limit: parseInt(limit) };
      setCache('concerns_list', payload);
      res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  /* ── GET /api/admin/talent/concerns/stats ────────────────────────────────── */
  app.get('/api/admin/talent/concerns/stats', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seedIfNeeded().catch(() => null);
    const cached = getCached<unknown>('concerns_stats');
    if (cached) return res.json(cached);
    try {
      const [total, byCat, bySev, byBlueprint, feedLinks] = await Promise.all([
        pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active) as active FROM talent_concern_master'),
        pool.query('SELECT concern_category, COUNT(*) as count FROM talent_concern_master GROUP BY concern_category ORDER BY count DESC'),
        pool.query('SELECT severity_level, COUNT(*) as count FROM talent_concern_master GROUP BY severity_level ORDER BY count DESC'),
        pool.query('SELECT blueprint_key, COUNT(*) as concern_count, COUNT(DISTINCT competency_code) as competency_count FROM talent_concern_master GROUP BY blueprint_key ORDER BY concern_count DESC'),
        pool.query('SELECT COUNT(*) FILTER (WHERE feeds_readiness) as readiness_feed, COUNT(*) FILTER (WHERE feeds_digital_twin) as twin_feed, COUNT(*) FILTER (WHERE feeds_outcome_prediction) as prediction_feed FROM talent_concern_master'),
      ]);
      const payload = {
        total: Number(total.rows[0].total),
        active: Number(total.rows[0].active),
        by_category: byCat.rows,
        by_severity: bySev.rows,
        by_blueprint: byBlueprint.rows,
        feed_links: feedLinks.rows[0],
      };
      setCache('concerns_stats', payload);
      res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  /* ── GET /api/admin/talent/concerns/competency/:code ─────────────────────── */
  app.get('/api/admin/talent/concerns/competency/:code', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seedIfNeeded().catch(() => null);
    try {
      const rows = await pool.query(
        'SELECT * FROM talent_concern_master WHERE competency_code = $1 AND is_active = true ORDER BY severity_level, concern_name',
        [req.params.code]
      );
      res.json({ competency_code: req.params.code, concerns: rows.rows, count: rows.rows.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  /* ── GET /api/admin/talent/concerns/blueprint/:key ───────────────────────── */
  app.get('/api/admin/talent/concerns/blueprint/:key', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seedIfNeeded().catch(() => null);
    try {
      const rows = await pool.query(
        `SELECT c.*, cdm.competency_name FROM talent_concern_master c
         LEFT JOIN competency_dna_master cdm ON cdm.competency_code = c.competency_code
         WHERE c.blueprint_key = $1 AND c.is_active = true
         ORDER BY c.severity_level, c.concern_name`,
        [req.params.key]
      );
      res.json({ blueprint_key: req.params.key, concerns: rows.rows, count: rows.rows.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  /* ── GET /api/admin/talent/concerns/:id ──────────────────────────────────── */
  app.get('/api/admin/talent/concerns/:id', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seedIfNeeded().catch(() => null);
    try {
      const row = await pool.query('SELECT * FROM talent_concern_master WHERE id = $1', [req.params.id]);
      if (!row.rows.length) return res.status(404).json({ error: 'Concern not found' });
      res.json(row.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  /* ── POST /api/admin/talent/concerns ─────────────────────────────────────── */
  app.post('/api/admin/talent/concerns', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    await seedIfNeeded().catch(() => null);
    try {
      const { concern_key, concern_name, competency_code, blueprint_key, signal_keys = [], concern_category = 'behavioral', severity_level = 'moderate', growth_indicators = [], risk_indicators = [], assessment_indicators = [], insight_logic = {}, recommendation_logic = {}, feeds_readiness = true, feeds_digital_twin = true, feeds_outcome_prediction = true } = req.body;
      if (!concern_key || !concern_name || !competency_code || !blueprint_key) return res.status(400).json({ error: 'concern_key, concern_name, competency_code, blueprint_key required' });
      const row = await pool.query(
        `INSERT INTO talent_concern_master (concern_key,concern_name,competency_code,blueprint_key,signal_keys,concern_category,severity_level,growth_indicators,risk_indicators,assessment_indicators,insight_logic,recommendation_logic,feeds_readiness,feeds_digital_twin,feeds_outcome_prediction)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [concern_key, concern_name, competency_code, blueprint_key, signal_keys, concern_category, severity_level,
         JSON.stringify(growth_indicators), JSON.stringify(risk_indicators), JSON.stringify(assessment_indicators),
         JSON.stringify(insight_logic), JSON.stringify(recommendation_logic),
         feeds_readiness, feeds_digital_twin, feeds_outcome_prediction]
      );
      bustCache();
      res.status(201).json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  /* ── PUT /api/admin/talent/concerns/:id ──────────────────────────────────── */
  app.put('/api/admin/talent/concerns/:id', requireAuth, requireSuperAdmin, guard, async (req: Request, res: Response) => {
    try {
      const { concern_name, severity_level, growth_indicators, risk_indicators, assessment_indicators, insight_logic, recommendation_logic, is_active } = req.body;
      const row = await pool.query(
        `UPDATE talent_concern_master SET
           concern_name = COALESCE($1, concern_name),
           severity_level = COALESCE($2, severity_level),
           growth_indicators = COALESCE($3::jsonb, growth_indicators),
           risk_indicators = COALESCE($4::jsonb, risk_indicators),
           assessment_indicators = COALESCE($5::jsonb, assessment_indicators),
           insight_logic = COALESCE($6::jsonb, insight_logic),
           recommendation_logic = COALESCE($7::jsonb, recommendation_logic),
           is_active = COALESCE($8, is_active),
           updated_at = NOW()
         WHERE id = $9 RETURNING *`,
        [concern_name, severity_level,
         growth_indicators ? JSON.stringify(growth_indicators) : null,
         risk_indicators ? JSON.stringify(risk_indicators) : null,
         assessment_indicators ? JSON.stringify(assessment_indicators) : null,
         insight_logic ? JSON.stringify(insight_logic) : null,
         recommendation_logic ? JSON.stringify(recommendation_logic) : null,
         is_active, req.params.id]
      );
      if (!row.rows.length) return res.status(404).json({ error: 'Concern not found' });
      bustCache();
      res.json(row.rows[0]);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  /* ── GET /api/talent/concerns/profile/:email — user concern risk profile ─── */
  app.get('/api/talent/concerns/profile/:email', requireAuth, guard, async (req: Request, res: Response) => {
    await seedIfNeeded().catch(() => null);
    try {
      // Derive active concerns from talent scoring + competency DNA data for this user
      const [scoring, concerns] = await Promise.all([
        pool.query(`SELECT ts.* FROM talent_scores ts JOIN users u ON u.id::text = ts.user_id WHERE u.email = $1 ORDER BY ts.computed_at DESC LIMIT 1`, [req.params.email]).catch(() => ({ rows: [] })),
        pool.query('SELECT * FROM talent_concern_master WHERE is_active = true ORDER BY severity_level, blueprint_key'),
      ]);
      // Return concerns with user context (scoring linkage is directional — concern keys bridge to signal dimensions)
      res.json({
        email: req.params.email,
        has_scoring_data: scoring.rows.length > 0,
        concern_catalog: concerns.rows.map(c => ({
          concern_key: c.concern_key,
          concern_name: c.concern_name,
          competency_code: c.competency_code,
          blueprint_key: c.blueprint_key,
          severity_level: c.severity_level,
          concern_category: c.concern_category,
          feeds_readiness: c.feeds_readiness,
          feeds_digital_twin: c.feeds_digital_twin,
          feeds_outcome_prediction: c.feeds_outcome_prediction,
        })),
        profile_note: 'Concern activation against live session data requires talent scoring + signal capture pipeline.',
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  /* ── GET /api/admin/talent/concerns/chain/overview — D3→D4→D5 chain audit ── */
  app.get('/api/admin/talent/concerns/chain/overview', requireAuth, requireSuperAdmin, guard, async (_req: Request, res: Response) => {
    await seedIfNeeded().catch(() => null);
    const cached = getCached<unknown>('concern_chain');
    if (cached) return res.json(cached);
    try {
      const [concerns, dna, signals] = await Promise.all([
        pool.query('SELECT blueprint_key, competency_code, COUNT(*) as concerns FROM talent_concern_master WHERE is_active=true GROUP BY blueprint_key, competency_code'),
        pool.query('SELECT blueprint_key, competency_code, COUNT(*) as dna_records FROM competency_dna_master GROUP BY blueprint_key, competency_code').catch(() => ({ rows: [] })),
        pool.query('SELECT signal_category, COUNT(*) as signals FROM talent_signal_master WHERE is_active=true GROUP BY signal_category').catch(() => ({ rows: [] })),
      ]);
      const payload = {
        chain: 'D3 Signal Master → D4 Concern Intelligence → D5 Competency DNA',
        concern_coverage: concerns.rows,
        dna_coverage: (dna as any).rows,
        signal_categories: (signals as any).rows,
        total_concerns: concerns.rows.reduce((s: number, r: any) => s + Number(r.concerns), 0),
        blueprints_covered: [...new Set(concerns.rows.map((r: any) => r.blueprint_key))].length,
        competencies_covered: [...new Set(concerns.rows.map((r: any) => r.competency_code))].length,
      };
      setCache('concern_chain', payload);
      res.json(payload);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log('[talent-concern-intelligence] D4 routes registered — Competency→Concern→Signal chain, feeds D9/D14/D15');
}
