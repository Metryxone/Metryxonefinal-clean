/**
 * CAPADEX Phase 7 — seed recommendation_library (authored reference catalog).
 *
 * The ONLY authored data in Phase 7. Every other table is composed at runtime from
 * existing intelligence. Catalog rows are anchored on a behavioural CONSTRUCT key and
 * expanded across category × sub_type × stakeholder. Content is construct-specific
 * (detailed profiles for the high-frequency constructs; the rest grounded in the
 * construct's own real label/cluster/description — never generic boilerplate).
 *
 *   Run: node backend/scripts/seed-recommendation-library.mjs
 *   Idempotent: upsert on (recommendation_key, stakeholder).
 */
import pg from 'pg';
import { CONSTRUCTS, CONSTRUCT_MAP } from '../data/behavioural-constructs.ts';

const SUBTYPES = {
  career: ['cluster', 'pathway', 'exploration'],
  learning: ['course', 'certification', 'pathway'],
  project: ['research', 'portfolio', 'team', 'leadership'],
  development: ['communication', 'leadership', 'critical_thinking', 'career_readiness'],
};

const SUBTYPE_LABEL = {
  cluster: 'Career Cluster', pathway: 'Pathway', exploration: 'Exploration',
  course: 'Course', certification: 'Certification',
  research: 'Research Project', portfolio: 'Portfolio Project',
  team: 'Team Project', leadership: 'Leadership Project',
  communication: 'Communication Development', critical_thinking: 'Critical Thinking Development',
  career_readiness: 'Career Readiness Development',
};

const STAKEHOLDER_LEAD = {
  student: '',
  parent: 'Help your child by encouraging this: ',
  counselor: 'For this student, consider guiding them toward: ',
  institution: 'For students showing this pattern across the cohort: ',
};
const STAKEHOLDERS = ['student', 'parent', 'counselor', 'institution'];

// Which development tracks each construct legitimately develops (construct → track[]).
const DEV_TRACKS = {
  COMMUNICATION: ['communication'], SOCIAL_CONFIDENCE: ['communication', 'leadership'],
  PEER_RELATIONS: ['communication', 'leadership'],
  CRITICAL_THINKING: ['critical_thinking'], CREATIVITY: ['critical_thinking'],
  GOAL_ORIENTATION: ['leadership', 'career_readiness'], CAREER_GROWTH: ['leadership', 'career_readiness'],
  CAREER_CLARITY: ['career_readiness'], SKILL_AWARENESS: ['career_readiness'],
  EXECUTIVE_FUNCTION: ['career_readiness'], INTRINSIC_MOTIVATION: ['career_readiness'],
};
const devTracksFor = (k) => DEV_TRACKS[k] ?? ['career_readiness'];

// ── Detailed authored profiles (high-frequency / demo-cohort constructs) ──────────
// Each item = [title, description]; rationale is built from the construct + lineage.
const DETAILED = {
  ANXIETY: {
    career: {
      cluster: ['Calm-environment & structured roles', 'Career fields with predictable rhythms and clear expectations — quality assurance, research, archival, lab-based and analytical roles — where high-pressure improvisation is rare.'],
      pathway: ['Low-stakes-to-high-stakes exposure pathway', 'A staged route that begins in supportive, well-scaffolded settings and gradually adds performance pressure as confidence builds, rather than starting in high-stakes roles.'],
      exploration: ['Job-shadow before committing', 'Shadow professionals in fields of interest to test how each environment feels under real pressure before narrowing your choices.'],
    },
    learning: {
      course: ['Performance psychology & exam confidence', 'A short course on managing performance anxiety, test-taking strategy, and pre-performance routines.'],
      certification: ['Mindfulness / stress-resilience certificate', 'A recognised mindfulness or resilience credential that builds and evidences your self-regulation skills.'],
      pathway: ['Confidence-first learning pathway', 'Sequence courses so early wins build momentum before tackling the most evaluative, high-pressure modules.'],
    },
    project: {
      research: ['Investigate what triggers your performance dips', 'A small self-study tracking the situations, thoughts, and routines around moments of panic — turning anxiety into observable data.'],
      portfolio: ['A "calm under pressure" showcase', 'Document one high-pressure task you prepared for and delivered, including the routine you used — evidence of growth.'],
      team: ['Low-pressure collaborative project', 'Join a small, supportive team where you can contribute steadily and rebuild trust in performing alongside others.'],
      leadership: ['Lead a peer study/support circle', 'Facilitate a small support group — a low-stakes way to practise visible responsibility in a safe setting.'],
    },
    development: {
      career_readiness: ['Build steady calm under evaluation', 'Develop pre-performance routines, breathing resets, and rehearsal habits so interviews, exams, and presentations feel manageable.'],
    },
  },
  EMOTIONAL_REGULATION: {
    career: {
      cluster: ['People-centred & supportive roles', 'Fields that reward emotional steadiness and empathy — counselling, healthcare support, education, human services — where regulated responses are a genuine strength.'],
      pathway: ['Self-awareness-to-mastery pathway', 'A route that pairs role exploration with steadily growing emotional self-management responsibilities.'],
      exploration: ['Try roles with emotional demands in small doses', 'Volunteer or intern in settings with moderate emotional load to learn which environments you regulate well in.'],
    },
    learning: {
      course: ['Emotional intelligence fundamentals', 'A course building awareness, labelling, and modulation of emotional responses in study and work.'],
      certification: ['Wellbeing / peer-support certificate', 'A credential in emotional first-aid or peer support that formalises your regulation skills.'],
      pathway: ['Regulate-then-stretch pathway', 'Build regulation foundations before moving into more emotionally demanding learning.'],
    },
    project: {
      research: ['Map your emotional triggers and recoveries', 'A reflective log study identifying what destabilises you and what helps you recover fastest.'],
      portfolio: ['Document a hard moment you handled well', 'Capture a situation where you stayed regulated under strain — a concrete piece of evidence.'],
      team: ['Be the steady presence on a team project', 'Take a collaborative role where calm coordination matters, practising regulation in a group.'],
      leadership: ['Mentor a younger peer', 'A low-stakes leadership role that rewards patience and emotional steadiness.'],
    },
    development: {
      career_readiness: ['Strengthen emotional steadiness at work', 'Build the habits that keep you regulated through setbacks, feedback, and pressure.'],
    },
  },
  CAREER_CLARITY: {
    career: {
      cluster: ['Exploratory / interest-discovery roles', 'Broad, exposure-rich fields and rotational programmes that let you sample several directions before committing.'],
      pathway: ['Structured decision-making pathway', 'A route that moves from broad exploration → shortlisting → informed commitment, with a decision checkpoint at each stage.'],
      exploration: ['Run informational interviews', 'Talk to people in 3–5 fields you are curious about to replace guesswork with first-hand insight.'],
    },
    learning: {
      course: ['Career exploration & decision-making', 'A course on values, interests, and structured career decision frameworks.'],
      certification: ['Career-planning / self-assessment credential', 'A recognised career-readiness or strengths-assessment certificate that sharpens direction.'],
      pathway: ['Discover-then-specialise pathway', 'Start with broad foundational learning, then specialise once a direction emerges.'],
    },
    project: {
      research: ['Investigate three possible career directions', 'A comparison project researching day-to-day reality, entry routes, and fit for three options.'],
      portfolio: ['Build a "direction map" artefact', 'Create a visual map linking your interests and strengths to concrete roles — evidence of deliberate planning.'],
      team: ['Join a cross-interest project team', 'Work with peers from different interest areas to broaden your sense of what fits.'],
      leadership: ['Organise a careers exploration event', 'Lead a small peer event (panel, fair, or talk) — clarifying your own direction while helping others.'],
    },
    development: {
      career_readiness: ['Turn career confusion into a clear plan', 'Develop the decision-making habits — values clarity, option mapping, checkpoints — that resolve career uncertainty.'],
    },
  },
  SOCIAL_CONFIDENCE: {
    career: {
      cluster: ['Collaborative & client-facing roles', 'Fields where steady interpersonal confidence is rewarded — and which, with practice, build it: team-based, client-facing, and community roles.'],
      pathway: ['Small-group-to-public pathway', 'A route that grows from one-to-one and small-group settings toward more public, visible responsibilities.'],
      exploration: ['Test social-load of different settings', 'Sample roles with different interaction demands to find where you engage most comfortably.'],
    },
    learning: {
      course: ['Confident communication & presence', 'A course on speaking up, group participation, and social assertiveness.'],
      certification: ['Public-speaking / debate credential', 'A recognised speaking or debate certificate that both builds and evidences social confidence.'],
      pathway: ['Participate-then-present pathway', 'Begin with participatory learning before moving to presentation-heavy modules.'],
    },
    project: {
      research: ['Study where withdrawal happens for you', 'A small reflective study of the situations you pull back from and what would make engaging easier.'],
      portfolio: ['Record a presentation you delivered', 'Capture a talk or group contribution you made — proof of social engagement.'],
      team: ['Take an active role on a team project', 'Choose a contributing role in a supportive group to rebuild confidence in being seen and heard.'],
      leadership: ['Co-lead a small group activity', 'Share leadership of a low-stakes activity to practise visible social presence.'],
    },
    development: {
      communication: ['Grow confident social communication', 'Develop the habits — speaking up early, asking questions, contributing in groups — that reduce withdrawal.'],
      leadership: ['Practise being visible in groups', 'Build comfort taking shared responsibility and being seen in collaborative settings.'],
    },
  },
};

// ── Construct-grounded derivation for all other constructs (never generic) ─────────
function derive(c) {
  const L = c.label, low = c.label.toLowerCase(), cl = c.cluster;
  return {
    career: {
      cluster: [`${L}-aligned career cluster`, `Career fields in the ${cl} space where ${low} is a core, rewarded capability.`],
      pathway: [`${L} growth pathway`, `A staged route that progressively builds ${low} from foundational to advanced responsibility.`],
      exploration: [`Explore where ${low} matters most`, `Sample roles and settings to find where your ${low} is most valued and most developed.`],
    },
    learning: {
      course: [`Foundations of ${L}`, `A focused course that strengthens ${low} through structured practice.`],
      certification: [`${L} credential`, `A recognised certificate that builds and evidences your ${low}.`],
      pathway: [`${L} learning pathway`, `Sequence learning so ${low} foundations come before more demanding ${cl.toLowerCase()} modules.`],
    },
    project: {
      research: [`Investigate your ${low}`, `A small self-study that turns your ${low} into observable, trackable data.`],
      portfolio: [`Showcase your ${low}`, `Document a concrete piece of work that demonstrates growth in ${low}.`],
      team: [`Apply ${low} in a team project`, `Join a collaborative project where ${low} is exercised alongside peers.`],
      leadership: [`Lead with ${low}`, `Take a small leadership role that stretches your ${low} in a low-stakes setting.`],
    },
    development: Object.fromEntries(devTracksFor(c.key).map((t) => [t,
      [`Develop ${low} (${SUBTYPE_LABEL[t]})`, `Build the habits that strengthen ${low}, channelled through ${SUBTYPE_LABEL[t].toLowerCase()}.`],
    ])),
  };
}

function profileFor(c) {
  const base = derive(c);
  const d = DETAILED[c.key];
  if (!d) return base;
  // Detailed overrides where authored; derived fills the rest.
  return {
    career: { ...base.career, ...d.career },
    learning: { ...base.learning, ...d.learning },
    project: { ...base.project, ...d.project },
    development: { ...base.development, ...d.development },
  };
}

function buildRows() {
  const rows = [];
  for (const c of CONSTRUCTS) {
    const prof = profileFor(c);
    const detailed = !!DETAILED[c.key];
    const push = (category, sub, item) => {
      if (!item) return;
      const [title, description] = item;
      const key = `${category}:${sub}:${c.key}`;
      const rationale =
        `Surfaced because your assessment activated ${c.label} (${c.cluster}); this ${SUBTYPE_LABEL[sub]} directly develops it. ` +
        `Traced Concern → Capability → Problem → Behavior → Archetype → Intervention → Recommendation.`;
      for (const sh of STAKEHOLDERS) {
        rows.push({
          recommendation_key: key, category, sub_type: sub, anchor_construct: c.key, stakeholder: sh,
          title, description: STAKEHOLDER_LEAD[sh] + description, rationale,
          priority: detailed ? 1 : 2,
        });
      }
    };
    for (const sub of SUBTYPES.career) push('career', sub, prof.career[sub]);
    for (const sub of SUBTYPES.learning) push('learning', sub, prof.learning[sub]);
    for (const sub of SUBTYPES.project) push('project', sub, prof.project[sub]);
    for (const [track, item] of Object.entries(prof.development)) push('development', track, item);
  }
  return rows;
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const rows = buildRows();
  let n = 0;
  for (const r of rows) {
    await pool.query(
      `INSERT INTO recommendation_library
         (recommendation_key, category, sub_type, anchor_construct, stakeholder, title, description, rationale, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (recommendation_key, stakeholder) DO UPDATE SET
         category=EXCLUDED.category, sub_type=EXCLUDED.sub_type, anchor_construct=EXCLUDED.anchor_construct,
         title=EXCLUDED.title, description=EXCLUDED.description, rationale=EXCLUDED.rationale,
         priority=EXCLUDED.priority, is_active=TRUE, updated_at=NOW()`,
      [r.recommendation_key, r.category, r.sub_type, r.anchor_construct, r.stakeholder, r.title, r.description, r.rationale, r.priority],
    );
    n++;
  }
  const { rows: stat } = await pool.query(
    `SELECT category, count(DISTINCT anchor_construct) constructs, count(*) rows FROM recommendation_library GROUP BY category ORDER BY category`);
  console.log(`Seeded/updated ${n} recommendation_library rows.`);
  console.table(stat);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
