import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const concerns = [
  // Academic
  { category:"Academic", concern_area:"Academic Performance",         keywords:"academic performance grades school results marks exams",             personas:["student","parent","teacher"], sort:1  },
  { category:"Academic", concern_area:"Exam Stress",                  keywords:"exam stress test anxiety board exams pressure results",               personas:["student","parent","teacher"], sort:2  },
  { category:"Academic", concern_area:"Study Focus & Concentration",  keywords:"study focus concentration distraction attention studying",            personas:["student","parent","teacher"], sort:3  },
  { category:"Academic", concern_area:"Academic Motivation",          keywords:"academic motivation interest studies learning unmotivated disengaged", personas:["student","parent","teacher"], sort:4  },
  { category:"Academic", concern_area:"Homework & Assignment Management", keywords:"homework assignment management deadlines incomplete work submission",personas:["student","parent","teacher"], sort:5  },
  { category:"Academic", concern_area:"Time Management for Studies",  keywords:"time management study schedule planning revision timetable",          personas:["student","parent","teacher"], sort:6  },
  { category:"Academic", concern_area:"Fear of Failure",              keywords:"fear of failure failing grades school anxiety mistakes performance",   personas:["student","parent"],           sort:7  },
  { category:"Academic", concern_area:"Learning Difficulties",        keywords:"learning difficulty slow learner comprehension understanding concepts",personas:["student","parent","teacher"], sort:8  },
  { category:"Academic", concern_area:"Grade Pressure & Expectations",keywords:"grade pressure expectations performance competition percentile rank",  personas:["student","parent"],           sort:9  },
  { category:"Academic", concern_area:"Competitive Exam Preparation", keywords:"competitive exam JEE NEET UPSC preparation coaching entrance",        personas:["student","parent"],           sort:10 },
  { category:"Academic", concern_area:"Classroom Participation",      keywords:"classroom participation speaking up shy class engagement teacher",     personas:["student","parent","teacher"], sort:11 },
  { category:"Academic", concern_area:"College Transition Stress",    keywords:"college transition adjustment higher education university stress",     personas:["student","parent"],           sort:12 },
  { category:"Academic", concern_area:"School Refusal & Avoidance",   keywords:"school refusal avoidance skipping attendance phobia absent",          personas:["student","parent","teacher"], sort:13 },
  { category:"Academic", concern_area:"Peer Comparison & Inferiority",keywords:"peer comparison inferiority sibling comparison topper pressure rank",  personas:["student","parent"],           sort:14 },

  // Professional
  { category:"Professional", concern_area:"Work Stress",                    keywords:"work stress job pressure deadline burnout professional overwhelm",          personas:["professional"], sort:20 },
  { category:"Professional", concern_area:"Career Anxiety",                 keywords:"career anxiety job insecurity future worry professional growth direction",   personas:["professional"], sort:21 },
  { category:"Professional", concern_area:"Focus at Work",                  keywords:"focus work concentration productivity distraction office remote",           personas:["professional"], sort:22 },
  { category:"Professional", concern_area:"Low Motivation at Work",         keywords:"low motivation work unmotivated disengaged apathy professional listless",   personas:["professional"], sort:23 },
  { category:"Professional", concern_area:"Work-Life Balance",              keywords:"work life balance overwork overtime personal time family boundaries",       personas:["professional"], sort:24 },
  { category:"Professional", concern_area:"Leadership & Management",        keywords:"leadership management team leading people skills manager effectiveness",   personas:["professional"], sort:25 },
  { category:"Professional", concern_area:"Workplace Communication",        keywords:"workplace communication colleagues manager conflict office professional",   personas:["professional"], sort:26 },
  { category:"Professional", concern_area:"Career Growth & Progression",    keywords:"career growth progression promotion advancement stagnant professional",    personas:["professional"], sort:27 },
  { category:"Professional", concern_area:"Job Dissatisfaction",            keywords:"job dissatisfaction unhappy unfulfilled work satisfaction meaning",        personas:["professional"], sort:28 },
  { category:"Professional", concern_area:"Professional Burnout",           keywords:"burnout exhaustion overwork chronic stress drained professional fatigue",  personas:["professional"], sort:29 },
  { category:"Professional", concern_area:"Imposter Syndrome",              keywords:"imposter syndrome self doubt inadequate fraud professional confidence",    personas:["professional"], sort:30 },
  { category:"Professional", concern_area:"Career Transition & Change",     keywords:"career transition change job switch industry shift professional pivot",    personas:["professional"], sort:31 },
  { category:"Professional", concern_area:"Workplace Conflict",             keywords:"workplace conflict colleague manager dispute office tension professional",  personas:["professional"], sort:32 },
  { category:"Professional", concern_area:"Presentation & Public Speaking", keywords:"presentation public speaking fear stage fright professional meeting",      personas:["professional"], sort:34 },
  { category:"Professional", concern_area:"Decision Making at Work",        keywords:"decision making work choices uncertainty professional judgement clarity",  personas:["professional"], sort:35 },
  { category:"Professional", concern_area:"Delegation & Team Management",   keywords:"delegation team management workload distribution ownership manager",      personas:["professional"], sort:36 },

  // Emotional & Behavioural
  { category:"Emotional", concern_area:"Anxiety & Overthinking",       keywords:"anxiety overthinking worry rumination nervous stress constant worry mind",  personas:["student","professional","parent"], sort:40 },
  { category:"Emotional", concern_area:"Anger & Impulse Control",      keywords:"anger impulse control temper rage outburst frustration reactive emotional",  personas:["student","professional","parent"], sort:41 },
  { category:"Emotional", concern_area:"Low Self-Esteem & Confidence", keywords:"self esteem confidence low self worth insecurity belief doubt inadequate",    personas:["student","professional","parent"], sort:42 },
  { category:"Emotional", concern_area:"Social Withdrawal",            keywords:"social withdrawal isolation lonely reclusive avoiding people retreating",     personas:["student","professional","parent"], sort:43 },
  { category:"Emotional", concern_area:"Procrastination",              keywords:"procrastination delaying avoiding tasks last minute postpone inaction",       personas:["student","professional","parent"], sort:44 },
  { category:"Emotional", concern_area:"Loneliness & Isolation",       keywords:"loneliness isolation alone disconnected no friends social cut off",          personas:["student","professional","parent"], sort:45 },
  { category:"Emotional", concern_area:"Low Motivation & Apathy",      keywords:"low motivation apathy unmotivated nothing interests listless energy drive",  personas:["student","professional","parent"], sort:46 },
  { category:"Emotional", concern_area:"Mood & Emotional Regulation",  keywords:"mood swings emotional regulation feelings emotional control dysregulation",  personas:["student","professional","parent"], sort:47 },
  { category:"Emotional", concern_area:"Fear & Phobias",               keywords:"fear phobia specific fear avoidance panic anxiety trigger object",           personas:["student","parent"],               sort:48 },
  { category:"Emotional", concern_area:"Negative Self-Talk",           keywords:"negative self talk inner critic harsh self judgment destructive thoughts",   personas:["student","professional","parent"], sort:49 },

  // Social
  { category:"Social", concern_area:"Social Anxiety",                  keywords:"social anxiety shy nervous people crowd social situation fear interaction",  personas:["student","professional","parent"], sort:50 },
  { category:"Social", concern_area:"Peer Relationships & Friendships",keywords:"peer relationships friendships friends making friends social skills circle",  personas:["student","parent","teacher"],      sort:51 },
  { category:"Social", concern_area:"Peer Pressure",                   keywords:"peer pressure influence friends bad influence group decisions fitting in",    personas:["student","parent"],               sort:52 },
  { category:"Social", concern_area:"Bullying",                        keywords:"bullying bully teasing harassment school cyberbullying victimisation",       personas:["student","parent","teacher"],      sort:53 },
  { category:"Social", concern_area:"Family Conflicts & Relationships", keywords:"family conflict relationship parents siblings home tension disputes",        personas:["student","professional","parent"], sort:54 },
  { category:"Social", concern_area:"Romantic Relationship Issues",    keywords:"relationship romantic partner breakup love heartbreak couples conflict",     personas:["student","professional"],         sort:55 },
  { category:"Social", concern_area:"Communication & Expression",      keywords:"communication expression speaking articulate words feelings expressing",     personas:["student","professional","parent"], sort:56 },

  // Career & Identity
  { category:"Career", concern_area:"Career Direction & Clarity",   keywords:"career direction clarity future goal path unclear profession lost",     personas:["student","professional"], sort:60 },
  { category:"Career", concern_area:"Career Change & Pivot",        keywords:"career change pivot switch industry domain professional transition shift",personas:["professional"],           sort:61 },
  { category:"Career", concern_area:"Higher Education Choices",     keywords:"higher education choice college degree course selection university",   personas:["student","parent"],       sort:62 },
  { category:"Career", concern_area:"Identity & Purpose",           keywords:"identity purpose meaning life direction who am I lost confused value", personas:["student","professional"], sort:63 },
  { category:"Career", concern_area:"Goal Setting & Achievement",   keywords:"goal setting achievement follow through discipline consistency habit",  personas:["student","professional"], sort:64 },

  // Wellbeing
  { category:"Wellbeing", concern_area:"Sleep Issues & Insomnia",     keywords:"sleep insomnia sleepless late night rest fatigue tired poor sleep",         personas:["student","professional","parent"], sort:70 },
  { category:"Wellbeing", concern_area:"Screen Time & Technology Overuse", keywords:"screen time phone addiction gaming social media overuse internet compulsive", personas:["student","parent","teacher"],  sort:71 },
  { category:"Wellbeing", concern_area:"Stress Management",           keywords:"stress management coping pressure overwhelm relaxation techniques burnout", personas:["student","professional","parent"], sort:74 },
  { category:"Wellbeing", concern_area:"Eating & Body Image",         keywords:"eating body image food diet weight appearance self image disordered",       personas:["student","parent"],               sort:73 },

  // Parenting
  { category:"Parenting", concern_area:"Parenting Challenges",        keywords:"parenting challenge child behavior discipline difficult parent teenager",  personas:["parent"],           sort:80 },
  { category:"Parenting", concern_area:"Child Behavioral Issues",     keywords:"behavior behavioral issues child defiance tantrums disobedience difficult", personas:["parent","teacher"], sort:81 },
  { category:"Parenting", concern_area:"Parental Stress & Burnout",   keywords:"parental stress burnout overwhelmed parent exhausted caregiver depletion",  personas:["parent"],           sort:82 },

  // Teaching
  { category:"Teaching", concern_area:"Classroom Management",  keywords:"classroom management discipline students behavior control teacher authority",  personas:["teacher"], sort:90 },
  { category:"Teaching", concern_area:"Student Engagement",    keywords:"student engagement participation motivation teaching class interest learning",  personas:["teacher"], sort:91 },
  { category:"Teaching", concern_area:"Teaching Stress & Burnout", keywords:"teaching stress burnout overwhelmed educator teacher workload pressure",   personas:["teacher"], sort:92 },
];

let inserted = 0, skipped = 0;
for (const c of concerns) {
  const r = await pool.query(
    `INSERT INTO concern_areas
       (category, concern_area, parent_worry, impact_on_child, assessment_type,
        search_keywords, services, roles, target_personas, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,'[]'::jsonb,'[]'::jsonb,$7,true,$8)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [c.category, c.concern_area, "", "", "Curiosity", c.keywords, c.personas, c.sort]
  );
  if (r.rowCount > 0) inserted++; else skipped++;
}

const total = await pool.query("SELECT COUNT(*) FROM concern_areas WHERE is_active=true");
console.log(`Done — inserted: ${inserted}, skipped: ${skipped}, total active: ${total.rows[0].count}`);
await pool.end();
