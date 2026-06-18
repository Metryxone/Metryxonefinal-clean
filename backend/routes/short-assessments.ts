/**
 * backend/routes/short-assessments.ts
 * Concern Areas + Short Assessment Questions/Age-Bands
 * Extracted from routes.ts (Phase 0 S4 cleanup).
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { CONCERN_TO_CONSTRUCT, CONSTRUCT_MAP, normalizeConcernKey } from '../data/behavioural-constructs';

type Auth = (req: Request, res: Response, next: NextFunction) => void;

// ─── Sentence Intent → Construct Detection ───────────────────────────────────
// Maps free-text sentences or fragments typed by users to one or more construct
// keys so that "can't stop scrolling" → DIGITAL_DEPENDENCY → shows
// "Screen addiction", "Social media overuse", etc.
const SENTENCE_CONSTRUCT_RULES: Array<{ pattern: RegExp; constructs: string[] }> = [
  { pattern: /scroll|tiktok|instagram|reels?|social.?medi|youtube|doom.?scroll|screen.*(addict|too much|can.?t stop|hours)|phone.*(addict|can.?t stop|too much|hours)|can.?t.*put.*down.*phone/i, constructs: ['DIGITAL_DEPENDENCY'] },
  { pattern: /gam(ing|e)|video.?game|gaming.?addict/i, constructs: ['DIGITAL_DEPENDENCY'] },
  { pattern: /late.?night.*(phone|screen)|phone.*night|screen.*night|can.?t.*put.*phone|always.*on.*phone/i, constructs: ['DIGITAL_DISCIPLINE'] },
  { pattern: /\bfocus\b|concentrat|distract|attention|mind.*(wander|drift|go blank)|zone.*out|can.?t.*sit.*still|losing.*focus|can.?t.*pay.*attention|can.?t.*stay.*on/i, constructs: ['ATTENTION_REGULATION'] },
  { pattern: /procrastin|put.*off|keep.*postpone|delay.*task|avoid.*work|last.?minute|never.*start|can.?t.*begin|can.?t.*start|always.*delay/i, constructs: ['PROCRASTINATION'] },
  { pattern: /anxi|nervous|panic|worry|worried|dread|test.*fear|exam.*fear|fear.*fail|fear.*judg|fear.*wrong|scared.*to/i, constructs: ['ANXIETY'] },
  { pattern: /stress(?:ed)?|overwhelm|burnout|burn.?out|too much pressure|under pressure|too much on.*plate/i, constructs: ['STRESS_MANAGEMENT'] },
  { pattern: /mood.?swing|emotional.*outburst|angry|anger|irritable|lose.*temper|blow.*up|react.*too fast|lash.*out/i, constructs: ['EMOTIONAL_REGULATION'] },
  { pattern: /low.*self.?esteem|self.?doubt|not.*good.*enough|insecur|no.*confidence|low.*confidence|feel.*worthless|feel.*stupid/i, constructs: ['SELF_ESTEEM'] },
  { pattern: /no.*motivat|lack.*motivat|unmotivat|no.*drive|feel.*lazy|don.?t.*want.*to.*do|no.*interest|lost.*interest|can.?t.*bring.*myself/i, constructs: ['INTRINSIC_MOTIVATION'] },
  { pattern: /can.?t.*build.*habit|can.?t.*stick|no.*routine|no.*discipline|bad.*habit|break.*routine|inconsistent.*with/i, constructs: ['HABIT_FORMATION'] },
  { pattern: /disorganiz|can.?t.*organiz|can.?t.*plan|time.?manage|can.?t.*prioritiz|always.*forgetting.*tasks|never.*finish/i, constructs: ['EXECUTIVE_FUNCTION'] },
  { pattern: /impulsive|act.*without.*think|react.*without.*think|lose.*control.*react|blurt.*out|can.?t.*control.*impulse/i, constructs: ['IMPULSE_CONTROL'] },
  { pattern: /stuck.*(position|job|role|career|company|firm)|same.*(position|job|role|company).*(for|\d+\s*year|year)|(\d+\s*year|years?.*in.*same).*(position|job|role|company)|no.*(promot|growth|progress|raise).*(year|career|work)|career.*stagnation|stagnation.*career|undervalued|overqualified|not.*(grow|growing|progress).*(career|work|role)|plateaued|feel.*stuck.*work|work.*feel.*stuck/i, constructs: ['CAREER_CLARITY', 'GOAL_ORIENTATION'] },
  { pattern: /career|what.*do.*with.*life|no.*direction|future.*unclear|don.?t.*know.*what.*i.*want|confused.*about.*career|which.*field/i, constructs: ['CAREER_CLARITY', 'GOAL_ORIENTATION'] },
  { pattern: /no.*friends|can.?t.*make.*friend|loneli|alone|don.?t.*fit.*in|don.?t.*belong|left.*out|peer.*pressure/i, constructs: ['PEER_RELATIONS'] },
  { pattern: /shy|introvert|social.*awkward|awkward.*social|talking.*to.*people|public.*speak|presentation.*fear|fear.*crowd/i, constructs: ['SOCIAL_CONFIDENCE'] },
  { pattern: /can.?t.*express|words.*don.?t.*come|difficult.*convers|don.?t.*know.*what.*to.*say|communicat.*issue/i, constructs: ['COMMUNICATION'] },
  { pattern: /can.?t.*sleep|insomnia|wake.*tired|always.*tired|always.*exhausted|low.*energy|no.*energy.*all.*day|fatigue/i, constructs: ['PHYSICAL_WELLBEING'] },
  { pattern: /give.*up.*easily|can.?t.*bounce.*back|every.*setback|failure.*affects|can.?t.*handle.*failure|easily.*defeated/i, constructs: ['RESILIENCE'] },
  { pattern: /forget.*everything|can.?t.*remember|memory.*bad|retention.*issue|read.*but.*forget/i, constructs: ['WORKING_MEMORY'] },
  { pattern: /failing.*exam|bad.*marks|low.*grade|exam.*performance|poor.*result|scored.*bad/i, constructs: ['EXAM_PERFORMANCE'] },
  { pattern: /mental.*health|depress|feel.*empty|feel.*numb|feel.*hollow|sad.*all.*time|nothing.*matters/i, constructs: ['MENTAL_HEALTH'] },
];

// ─── Stopwords — excluded from word-level scoring ────────────────────────────
// Common filler words that carry no signal about the concern being searched.
const STOPWORDS = new Set([
  'i','a','an','the','is','am','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should',
  'may','might','can','cannot','not','no','my','me','its','they','we',
  'you','he','she','it','this','that','these','those','and','or','but',
  'if','in','on','at','to','for','of','with','by','as','into','so',
  'up','out','off','over','then','how','all','just','very','too','than',
  'feel','felt','feels','want','get','make','know','keep','try','go',
  'come','look','need','show','stop','seem','let','put','use','find',
  'give','tell','become','always','never','often','now','here','there',
  'really','quite','even','back','again','away','around','still',
  'cant','dont','wont','isnt','arent','wasnt','didnt','hasnt','hadnt',
  // Time/quantity/filler words that carry no semantic signal
  'more','much','many','most','less','few','lot','lots','bit','bits',
  'year','years','month','months','week','weeks','day','days','hour','hours',
  'long','same','last','next','each','such','also','well','way','via',
  'what','when','why','who','where','got','set','take','made','said',
  'like','just','about','after','before','since','while','until','during',
  'from','into','onto','upon','within','without','through','between',
  'two','three','four','five','six','seven','eight','nine','ten',
]);

// ─── Partial-word completions for mid-typing prefix expansion ─────────────────
// When the last typed "word" is ≤3 chars, expand it with common completions
// so that "sc" → tries "screen"/"scroll" → fires DIGITAL_DEPENDENCY etc.
const PREFIX_COMPLETIONS: Record<string, string[]> = {
  sc: ['screen','scroll','scrolling','school'],
  an: ['anxiety','anger','angry','anxious'],
  ex: ['exam','exams','exhausted','exhaustion'],
  pr: ['procrastination','pressure','presentation','procrastinate'],
  mo: ['motivation','mood','motivated'],
  fo: ['focus','focused'],
  st: ['stress','stressed','study','stuck'],
  sl: ['sleep','sleepless','slow'],
  co: ['concentration','confidence','communication','concentrating'],
  em: ['emotional','emotion','empathy'],
  se: ['self-esteem','self'],
  im: ['impulsive','impulse','impulsivity'],
  re: ['resilience','rejection','relationships'],
  ha: ['habit','habits'],
  me: ['memory','mental'],
  pe: ['peer','performance','perfectionism'],
  ca: ['career'],
  de: ['depression','decisions','digital'],
  at: ['attention','attitude'],
  lo: ['loneliness','loneli'],
  ga: ['gaming','game'],
  di: ['distracted','distraction','digital'],
  so: ['social','social media'],
  fe: ['fear','feeling'],
  ov: ['overwhelm','overthinking'],
  bu: ['burnout','bully'],
};

function detectConstructsFromText(text: string): Set<string> {
  const found = new Set<string>();
  for (const rule of SENTENCE_CONSTRUCT_RULES) {
    if (rule.pattern.test(text)) rule.constructs.forEach(c => found.add(c));
  }

  // ── Partial last-word expansion ───────────────────────────────────────────
  // If the last token is short (≤3 chars), it's probably mid-typing.
  // Try known completions and re-run rules on the expanded text.
  const tokens = text.trim().split(/\s+/);
  const lastTok = tokens[tokens.length - 1].toLowerCase();
  if (lastTok.length >= 2 && lastTok.length <= 3 && tokens.length > 1) {
    const base = tokens.slice(0, -1).join(' ');
    const completions = PREFIX_COMPLETIONS[lastTok] || [];
    for (const comp of completions) {
      const expanded = `${base} ${comp}`;
      for (const rule of SENTENCE_CONSTRUCT_RULES) {
        if (rule.pattern.test(expanded)) rule.constructs.forEach(c => found.add(c));
      }
    }
  }

  return found;
}

function scoreConcern(
  row: any,
  q: string,
  detectedConstructs: Set<string>,
  rowConstructKey: string | null,
): number {
  if (!q) return row.has_assessment ? 10 : 5;

  let score = 0;
  const name     = (row.concern_area   || '').toLowerCase();
  const worry    = (row.parent_worry   || '').toLowerCase();
  const keywords = (row.search_keywords|| '').toLowerCase();
  const qL       = q.toLowerCase().trim();

  // ── Name-level matching (whole query) ────────────────────────────────────
  if (name === qL)                   score += 100;
  else if (name.startsWith(qL))      score += 85;
  else if (name.includes(` ${qL}`))  score += 75;   // word boundary
  else if (name.includes(qL))        score += 60;

  // ── Word-level matching — skip stopwords ─────────────────────────────────
  // Only score on meaningful content words (≥3 chars, not stopwords).
  const words = qL.split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w));
  for (const w of words) {
    if (name.includes(w))          score += 30;
    else if (worry.includes(w))    score += 14;
    else if (keywords.includes(w)) score += 10;
  }

  // ── Whole-query field matching ────────────────────────────────────────────
  if (worry.includes(qL))    score += 18;
  if (keywords.includes(qL)) score += 12;

  // ── Sentence intent → construct boost ────────────────────────────────────
  if (rowConstructKey && detectedConstructs.has(rowConstructKey)) score += 60;

  // ── Small assessed bonus ─────────────────────────────────────────────────
  if (row.has_assessment) score += 3;

  return score;
}

export function registerShortAssessmentRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Auth,
  requireSuperAdmin: Auth,
) {
  // ─── Concern Areas ────────────────────────────────────────────────────

  app.get('/api/concerns/search', async (req, res, next) => {
    try {
      const q          = String(req.query.q || '').trim();
      const category   = req.query.category as string | undefined;
      const persona    = String(req.query.persona || '').trim().toLowerCase();
      const age        = parseInt(String(req.query.age || ''), 10);
      const constructF = req.query.construct as string | undefined;

      // ── Base SQL — no LIKE filter on q; we score in-memory instead ──────────
      let sql = `SELECT ca.id, ca.category, ca.concern_area, ca.parent_worry,
                        ca.impact_on_child, ca.assessment_type, ca.search_keywords,
                        ca.services, ca.roles, ca.target_personas,
                   (
                     EXISTS(
                       SELECT 1 FROM sdi_items si
                       WHERE LOWER(si.concern_name) = LOWER(ca.concern_area)
                         AND si.stage_code = 'CAP_CUR' AND si.is_active = true
                     ) OR EXISTS(
                       SELECT 1 FROM short_assessment_questions sq
                       WHERE sq.concern_area_id = ca.id
                         AND sq.stage = 'Curiosity' AND sq.is_active = true
                     )
                   ) AS has_assessment
                 FROM concern_areas ca WHERE ca.is_active = true`;

      const params: any[] = [];

      if (category) {
        params.push(category);
        sql += ` AND LOWER(ca.category) = LOWER($${params.length})`;
      }
      if (persona) {
        // ── 2026-05-29 Legacy persona vocabulary bridge ────────────────────
        // The legacy `concern_areas.target_personas` column only ever uses
        // {student, parent, professional, teacher}. IntroPhase, however, sends
        // finer legacyKeys for some sub-personas — notably `campus`
        // (campus_student) and `jobseeker` (career_explorer /
        // career_transition_professional) — which match NONE of those values.
        // The old exact `= ANY(...)` filter therefore dropped every legacy row
        // for those personas, so a college student searching "exam"/"career"
        // saw an empty dropdown. Map the unknown keys onto the compatible
        // legacy vocabulary and switch to an array-overlap test so a row is
        // kept when ANY mapped value matches.
        const LEGACY_PERSONA_MAP: Record<string, string[]> = {
          campus:    ['student'],
          jobseeker: ['student', 'professional'],
        };
        const mappedPersonas = LEGACY_PERSONA_MAP[persona] || [persona];
        params.push(mappedPersonas);
        sql += ` AND (ca.target_personas = '{}' OR ca.target_personas && $${params.length}::text[])`;
        if (!isNaN(age) && age < 18 && mappedPersonas.some(p => p === 'student' || p === 'teacher' || p === 'parent')) {
          sql += ` AND LOWER(ca.category) NOT IN ('professional')`;
        }
      }
      if (constructF) {
        const matchingAreas = Object.entries(CONCERN_TO_CONSTRUCT)
          .filter(([, ck]) => ck === constructF)
          .map(([area]) => area);
        if (matchingAreas.length > 0) {
          params.push(matchingAreas);
          sql += ` AND LOWER(ca.concern_area) = ANY($${params.length}::text[])`;
        } else {
          return res.json({ concerns: [] });
        }
      }

      // Fetch all filtered rows (max 200) — scoring done in-memory
      sql += ` ORDER BY ca.sort_order LIMIT 200`;
      const r = await pool.query(sql, params);

      // ── Enrich each row with construct info ──────────────────────────────
      const allRows = r.rows.map((row: any) => {
        const ck = CONCERN_TO_CONSTRUCT[normalizeConcernKey(row.concern_area)];
        const construct = ck ? CONSTRUCT_MAP[ck] : undefined;
        return {
          ...row,
          construct_key:     construct?.key     ?? null,
          construct_label:   construct?.label   ?? null,
          construct_cluster: construct?.cluster ?? null,
        };
      });

      // ── No query: return default list (has_assessment first, age-boosted) ─
      if (!q) {
        let ageCategories: string[] = [];
        if (!isNaN(age)) {
          if (age < 12)       ageCategories = ['academic','behavioral','social','emotional','digital'];
          else if (age < 18)  ageCategories = ['academic','digital','social','emotional','behavioral','career'];
          else if (age < 26)  ageCategories = ['academic','career','digital','social','emotional'];
          else                ageCategories = ['career','professional','stress','digital','social','emotional'];
        }
        const sorted = [...allRows].sort((a, b) => {
          const aBoost = ageCategories.includes((a.category||'').toLowerCase()) ? 0 : 1;
          const bBoost = ageCategories.includes((b.category||'').toLowerCase()) ? 0 : 1;
          if (a.has_assessment !== b.has_assessment) return a.has_assessment ? -1 : 1;
          if (aBoost !== bBoost) return aBoost - bBoost;
          return (a.sort_order || 0) - (b.sort_order || 0);
        });
        return res.json({ concerns: sorted.slice(0, 8) });
      }

      // ── With query: score every row, return top 8 above threshold ─────────
      const detectedConstructs = detectConstructsFromText(q);
      // Minimum score: if sentence intent fired (detect ≥1 construct) require 20,
      // otherwise require 10 so short queries like "pro" still show substring hits.
      // Note: keyword-only matches score ~22 (word +10, whole-query +12) so the
      // threshold must stay ≤22 to surface concerns matched purely via search_keywords
      // when construct_key is null (no +60 boost). Most single-word searches like
      // "attention", "distraction", "concentration" fall into this category.
      const minScore = detectedConstructs.size > 0 ? 20 : 10;

      // ── Master-table relevance scoring (2026-05-28) ─────────────────────
      // Per-row CASE-based score: exact domain match → 100, prefix → 80,
      // exact cluster → 90, substring → 50..20. This replaces the old
      // ORDER BY COUNT(*) which surfaced bucket-popularity instead of query
      // relevance (e.g. typing "Career Competition Readiness" used to return
      // "Career Direction & Clarity" at position 1).
      type MasterRow = any & { _master_score?: number };
      let masterRows: MasterRow[] = [];
      // ── 2026-05-28 Persona-aware hybrid filter ─────────────────────────
      // Map IntroPhase sub-persona ids → master `primary_persona` strings
      // (case-insensitive). When the user has selected a persona, the
      // master query restricts to compatible rows; if that yields zero
      // results we transparently re-run without the persona constraint
      // and set `personaFallback=true` so the UI can surface the "no exact
      // match — showing related concerns" note.
      const PERSONA_AFFINITY: Record<string, string[]> = {
        campus_student:                  ['campus student', 'student', 'self exploration user'],
        // Architect 2026-05-28 — broadened from ['competitive aspirant',
        // 'student'] so terms like "placement" don't fall straight through to
        // TPO/admin rows. Order matters: closest learner cohorts first.
        competitive_aspirant:            ['competitive aspirant', 'student', 'campus student', 'early career learner', 'skill development learner'],
        career_explorer:                 ['career explorer', 'job seeker', 'skill development learner'],
        skill_development_learner:       ['skill development learner', 'student', 'self discovery'],
        // 2026-05-29 — career-gap / transition concerns live under master rows
        // whose primary_persona is 'job seeker' or 'career transition professional'
        // (e.g. "Difficulty Explaining Career Gaps Professionally"). Those are
        // squarely relevant to working professionals, so the early/mid affinity
        // sets now include them — otherwise the hard persona filter dropped every
        // exact "career gap" match and the zero-row fallback never fired (generic
        // 'Career …' rows survived but lacked the 'gap' token the client requires).
        early_career_professional:       ['early career professional', 'early career learner', 'working professional', 'professional employee', 'job seeker', 'career transition professional'],
        mid_career_professional:         ['mid-career professional', 'working professional', 'professional employee', 'job seeker', 'career transition professional'],
        career_transition_professional:  ['career transition professional', 'job seeker', 'working professional'],
        leadership_track_professional:   ['leadership track professional', 'working professional', 'principal / leadership'],
        parent:                          ['parent'],
        teacher_educator:                ['teacher', 'teacher / educator', 'behavioral mentor'],
        academic_counsellor:             ['teacher', 'teacher / educator', 'behavioral mentor'],
        placement_career_cell:           ['placement & career cell', 'principal / leadership'],
      };
      const subPersonaRaw = String(req.query.subPersona || req.query.sub_persona || '').trim().toLowerCase();
      const personaAffinity = subPersonaRaw && PERSONA_AFFINITY[subPersonaRaw]
        ? PERSONA_AFFINITY[subPersonaRaw]
        : null;
      let personaFallback = false;

      try {
        const qLower = q.toLowerCase();
        const pattern = `%${qLower}%`;
        const prefix  = `${qLower}%`;
        // ── 2026-05-28 Phase 1 tokenized prefilter ────────────────────────
        // Old prefilter used `LIKE '%<entire query>%'` which dropped multi-word
        // queries like "exam stress" upstream because no single column contains
        // the contiguous phrase. We now require every whitespace token to
        // match at least one searchable column (AND across tokens, OR across
        // cols per token). Single-token queries are unaffected (1 token →
        // 1 AND clause). Scoring CASE still rewards exact full-string hits.
        const tokens = qLower.split(/\s+/).filter(t => t.length >= 2);
        const SEARCH_COLS = [
          'LOWER(domain)',
          'LOWER(COALESCE(concern_cluster,\'\'))',
          // 2026-06-01 — user-facing natural-language search phrase. This is
          // the purpose-built column the "behaviour/performance patterns"
          // field types against, so it participates in the prefilter.
          'LOWER(COALESCE(concern_search,\'\'))',
          'LOWER(COALESCE(concern_category,\'\'))',
          'LOWER(COALESCE(common_indian_context,\'\'))',
          'LOWER(COALESCE(signal_cluster,\'\'))',
          'LOWER(relational_bridge_tag)',
          'LOWER(COALESCE(intelligence_layer,\'\'))',
        ];
        // params $1=qLower, $2=%q%, $3=q%, $4..=per-token %tok%
        const tokenParams = tokens.map(t => `%${t}%`);
        const tokenWhereClauses = tokens.length === 0
          ? ['TRUE']
          : tokens.map((_, i) => {
              const ph = `$${i + 4}`;
              return `(${SEARCH_COLS.map(c => `${c} LIKE ${ph}`).join(' OR ')})`;
            });
        // 2026-05-29 — match ANY token, not ALL. Natural-language descriptions
        // ("I am planning to restart my career after a job gap") carry filler
        // words ("planning", "restart", "after") that appear in NO concern row,
        // so an AND across tokens zeroed out the master query for every sentence
        // — the precise rows (e.g. "Difficulty Explaining Career Gaps") only
        // matched on the discriminative nouns ("job"/"gap"). Relevance is now
        // preserved by `_tokenScore` below (rows matching more/stronger tokens
        // rank higher), with single-token queries behaving exactly as before.
        const tokenWhereSql = tokenWhereClauses.join(' OR ');
        // Per-token additive relevance — sums the best column hit for EACH token
        // so a row matching two strong nouns outranks one matching a single
        // generic word. Drives ranking when the full-phrase CASE below scores 0
        // (which it always does for multi-word/sentence input).
        const tokenScoreSql = tokens.length === 0
          ? '0'
          : tokens.map((_, i) => {
              const ph = `$${i + 4}`;
              return `(CASE
                WHEN LOWER(domain) LIKE ${ph}                          THEN 30
                WHEN LOWER(COALESCE(concern_search,'')) LIKE ${ph}     THEN 28
                WHEN LOWER(COALESCE(concern_cluster,'')) LIKE ${ph}    THEN 26
                WHEN LOWER(COALESCE(common_indian_context,'')) LIKE ${ph} THEN 14
                WHEN LOWER(COALESCE(concern_category,'')) LIKE ${ph}   THEN 10
                WHEN LOWER(COALESCE(signal_cluster,'')) LIKE ${ph}     THEN 8
                WHEN LOWER(relational_bridge_tag) LIKE ${ph}          THEN 8
                ELSE 0 END)`;
            }).join(' + ');
        // Persona affinity placeholder is appended LAST so we can drop it on
        // the fallback re-run by truncating params + clause.
        const personaPlaceholderIdx = tokens.length + 4;
        const personaWhereSql = personaAffinity
          ? ` AND LOWER(COALESCE(primary_persona,'')) = ANY($${personaPlaceholderIdx}::text[])`
          : '';
        const buildSql = (withPersona: boolean) => `
          SELECT
            MIN(id) AS id,
            MIN(concern_id) AS concern_id,
            COALESCE(NULLIF(concern_category, ''), 'Behavioural') AS category,
            domain                         AS concern_area,
            domain                         AS domain,
            MIN(COALESCE(concern_cluster, ''))         AS concern_cluster,
            -- 2026-05-28 — curated user-facing label (nullable). Frontend
            -- prefers this over concern_cluster/domain for display.
            MIN(NULLIF(display_label, ''))             AS display_label,
            -- 2026-06-01 — surface the user-facing search phrase too.
            MIN(NULLIF(concern_search, ''))            AS concern_search,
            -- 2026-06-01 — surface growth_trend + severity so the intro can
            -- show them once a concern is selected.
            MIN(NULLIF(growth_trend, ''))              AS growth_trend,
            MIN(NULLIF(severity, ''))                  AS severity,
            MIN(COALESCE(common_indian_context, ''))   AS common_indian_context,
            MIN(COALESCE(common_indian_context, ''))   AS parent_worry,
            MIN(COALESCE(concern_cluster, ''))         AS impact_on_child,
            -- 2026-05-28 Phase 1 typeahead recovery: expose canonical
            -- sentence-case headers so the client filter can tokenize over
            -- (Concern Cluster, Domain, Common Indian Context) and apply
            -- hyphen/en-dash-normalised age-band equality.
            MIN(COALESCE(primary_persona, ''))         AS primary_persona,
            CASE
              WHEN MIN(age_min) IS NOT NULL AND MAX(age_max) IS NOT NULL
                THEN MIN(age_min)::text || '-' || MAX(age_max)::text
              ELSE NULL
            END                                        AS typical_age_band,
            'Curiosity'                    AS assessment_type,
            string_agg(DISTINCT relational_bridge_tag, ' ') AS search_keywords,
            '{}'::text[]                   AS services,
            '{}'::text[]                   AS roles,
            COALESCE(array_agg(DISTINCT LOWER(primary_persona)) FILTER (WHERE primary_persona IS NOT NULL), '{}') AS target_personas,
            false                          AS has_assessment,
            'master'                       AS source,
            MAX(
              CASE
                -- Exact domain hit dominates
                WHEN LOWER(domain) = $1                                THEN 100
                WHEN LOWER(domain) LIKE $3                             THEN 80
                -- Cluster exact / prefix
                WHEN LOWER(COALESCE(concern_cluster,'')) = $1          THEN 90
                WHEN LOWER(COALESCE(concern_cluster,'')) LIKE $3       THEN 65
                -- 2026-06-01 — concern_search is the user-facing phrase, so an
                -- exact/prefix hit ranks just below the canonical cluster.
                WHEN LOWER(COALESCE(concern_search,'')) = $1           THEN 88
                WHEN LOWER(COALESCE(concern_search,'')) LIKE $3        THEN 62
                -- Substring hits in priority order
                WHEN LOWER(domain) LIKE $2                             THEN 55
                WHEN LOWER(COALESCE(concern_search,'')) LIKE $2        THEN 48
                WHEN LOWER(COALESCE(concern_cluster,'')) LIKE $2       THEN 45
                WHEN LOWER(COALESCE(concern_category,'')) LIKE $2      THEN 35
                WHEN LOWER(COALESCE(common_indian_context,'')) LIKE $2 THEN 30
                WHEN LOWER(COALESCE(signal_cluster,'')) LIKE $2        THEN 25
                WHEN LOWER(relational_bridge_tag) LIKE $2              THEN 20
                WHEN LOWER(COALESCE(intelligence_layer,'')) LIKE $2    THEN 15
                ELSE 0
              END
            ) + MAX(${tokenScoreSql}) AS _master_score,
            COUNT(*) AS _bucket_size
          FROM capadex_concerns_master
          WHERE ${tokenWhereSql}${withPersona ? personaWhereSql : ''}
          GROUP BY domain, concern_category
          ORDER BY _master_score DESC, _bucket_size DESC
          LIMIT 20
        `;
        // Attempt 1: with persona filter (if applicable).
        const baseParams = [qLower, pattern, prefix, ...tokenParams];
        const firstParams = personaAffinity ? [...baseParams, personaAffinity] : baseParams;
        const mr = await pool.query(buildSql(!!personaAffinity), firstParams);
        if (mr.rows.length === 0 && personaAffinity) {
          // Hybrid fallback: zero rows under persona constraint → drop
          // the filter and re-run so the user still sees related concerns.
          const mr2 = await pool.query(buildSql(false), baseParams);
          masterRows = mr2.rows;
          personaFallback = mr2.rows.length > 0;
        } else {
          masterRows = mr.rows;
        }
      } catch (_e) {
        // Master table missing or query failed — silently fall through.
      }

      // ── Unified ranking — interleave master + legacy by relevance ──────
      // Legacy `scoreConcern` returns 10..100+; master `_master_score` returns
      // 0..100. Normalise both into one ordered list, dedupe by concern_area,
      // cap at 8. This guarantees a master row with an exact-domain hit (100)
      // ranks above a weak legacy substring hit (10-22), and vice versa.
      const legacyRanked = allRows
        .map(row => ({ row, score: scoreConcern(row, q, detectedConstructs, row.construct_key) }))
        .filter(({ score }) => score >= minScore)
        .sort((a, b) => b.score - a.score)
        .map(({ row, score }) => ({ row, score, src: 'legacy' as const }));

      const masterRanked = masterRows
        .filter(r => (r._master_score ?? 0) > 0)
        .map(r => ({ row: r, score: r._master_score as number, src: 'master' as const }));

      const combined = [...legacyRanked, ...masterRanked]
        .sort((a, b) => b.score - a.score);

      const seenAreas = new Set<string>();
      const merged: any[] = [];
      for (const { row } of combined) {
        const key = (row.concern_area || '').toLowerCase().trim();
        if (!key || seenAreas.has(key)) continue;
        seenAreas.add(key);
        // Strip internal scoring columns from master rows before shipping.
        if (row.source === 'master') {
          delete row._master_score;
          delete row._bucket_size;
        }
        merged.push(row);
        if (merged.length >= 8) break;
      }

      // `personaFallback` signals to the UI that the persona-filtered query
      // returned zero rows and we transparently re-ran without the filter —
      // IntroPhase surfaces a "no exact match for your persona — showing
      // related concerns" note so users know the results are adjacent.
      res.json({ concerns: merged, personaFallback });
    } catch (err) { next(err); }
  });

  app.get('/api/concerns/categories', async (_req, res, next) => {
    try {
      const r = await pool.query(
        `SELECT category, COUNT(*)::int AS count FROM concern_areas WHERE is_active = true GROUP BY category ORDER BY category`
      );
      res.json({ categories: r.rows });
    } catch (err) { next(err); }
  });

  app.get('/api/concerns/admin/list', requireAuth, requireSuperAdmin, async (_req, res, next) => {
    try {
      const r = await pool.query(
        `SELECT id, category, concern_area, parent_worry, impact_on_child, assessment_type,
                search_keywords, services, roles, target_personas, is_active, sort_order, created_at, updated_at
         FROM concern_areas ORDER BY sort_order ASC, id ASC`
      );
      const concerns = r.rows.map((row: any) => {
        const ck = CONCERN_TO_CONSTRUCT[normalizeConcernKey(row.concern_area)];
        const construct = ck ? CONSTRUCT_MAP[ck] : undefined;
        return {
          ...row,
          construct_key:     construct?.key     ?? null,
          construct_label:   construct?.label   ?? null,
          construct_cluster: construct?.cluster ?? null,
        };
      });
      res.json({ concerns });
    } catch (err) { next(err); }
  });

  const VALID_PERSONAS = ['student', 'teacher', 'campus', 'jobseeker', 'parent', 'professional'];

  const validateConcernPayload = (body: any) => {
    const required = ['category', 'concern_area', 'parent_worry', 'impact_on_child'];
    for (const k of required) {
      if (!body?.[k] || typeof body[k] !== 'string' || !body[k].trim()) {
        return { ok: false as const, error: `Missing or invalid field: ${k}` };
      }
    }
    return {
      ok: true as const,
      data: {
        category: String(body.category).trim(),
        concern_area: String(body.concern_area).trim(),
        parent_worry: String(body.parent_worry).trim(),
        impact_on_child: String(body.impact_on_child).trim(),
        assessment_type: body.assessment_type ? String(body.assessment_type).trim() : 'lbi',
        search_keywords: body.search_keywords ? String(body.search_keywords).trim() : '',
        services: Array.isArray(body.services) ? body.services.map(String) : [],
        roles: Array.isArray(body.roles) ? body.roles.map(String) : [],
        target_personas: Array.isArray(body.target_personas)
          ? body.target_personas.map(String).filter((p: string) => VALID_PERSONAS.includes(p))
          : [],
        is_active: body.is_active === undefined ? true : !!body.is_active,
        sort_order: Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0,
      },
    };
  };

  app.post('/api/concerns/admin', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const v = validateConcernPayload(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const d = v.data;
    try {
      const r = await pool.query(
        `INSERT INTO concern_areas
          (category, concern_area, parent_worry, impact_on_child, assessment_type, search_keywords, services, roles, target_personas, is_active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11) RETURNING *`,
        [d.category, d.concern_area, d.parent_worry, d.impact_on_child, d.assessment_type,
         d.search_keywords, JSON.stringify(d.services), JSON.stringify(d.roles),
         d.target_personas, d.is_active, d.sort_order]
      );
      res.status(201).json({ concern: r.rows[0] });
    } catch (err) { next(err); }
  });

  app.patch('/api/concerns/admin/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const v = validateConcernPayload(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const d = v.data;
    try {
      const r = await pool.query(
        `UPDATE concern_areas SET
           category=$1, concern_area=$2, parent_worry=$3, impact_on_child=$4,
           assessment_type=$5, search_keywords=$6,
           services=$7::jsonb, roles=$8::jsonb,
           target_personas=$9,
           is_active=$10, sort_order=$11, updated_at=NOW()
         WHERE id=$12 RETURNING *`,
        [d.category, d.concern_area, d.parent_worry, d.impact_on_child, d.assessment_type,
         d.search_keywords, JSON.stringify(d.services), JSON.stringify(d.roles),
         d.target_personas, d.is_active, d.sort_order, id]
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'Concern not found' });
      res.json({ concern: r.rows[0] });
    } catch (err) { next(err); }
  });

  app.delete('/api/concerns/admin/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    try {
      const r = await pool.query('DELETE FROM concern_areas WHERE id=$1', [id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'Concern not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── Short Assessment Questions + Age Bands ───────────────────────────

  app.get('/api/short-assessments/age-bands', async (_req, res, next) => {
    try {
      const r = await pool.query(
        `SELECT code, ages, is_active, sort_order, description,
                (SELECT COUNT(*)::int FROM short_assessment_questions q WHERE q.age_band = sab.code AND q.is_active) AS question_count
         FROM short_assessment_age_bands sab ORDER BY sort_order, code`
      );
      res.json({ bands: r.rows });
    } catch (err) { next(err); }
  });

  app.get('/api/short-assessments/summary', async (_req, res, next) => {
    try {
      const r = await pool.query(
        `SELECT ca.id AS concern_area_id, ca.category, ca.concern_area, ca.parent_worry,
                json_agg(json_build_object('stage', s.stage, 'count', s.cnt) ORDER BY s.stage) AS stages
         FROM concern_areas ca
         LEFT JOIN (
           SELECT concern_area_id, stage, COUNT(*)::int AS cnt
           FROM short_assessment_questions WHERE is_active
           GROUP BY concern_area_id, stage
         ) s ON s.concern_area_id = ca.id
         WHERE ca.is_active
         GROUP BY ca.id, ca.category, ca.concern_area, ca.parent_worry
         ORDER BY ca.sort_order, ca.id`
      );
      res.json({ summary: r.rows });
    } catch (err) { next(err); }
  });

  app.get('/api/short-assessments/admin/list', requireAuth, requireSuperAdmin, async (req, res, next) => {
    try {
      const concernId = req.query.concern_area_id ? Number(req.query.concern_area_id) : null;
      const stage = req.query.stage as string | undefined;
      const params: any[] = [];
      let sql = `SELECT q.id, q.concern_area_id, q.question_code, q.stage, q.age_band, q.is_anchor,
                        q.focus_area, q.layer, q.dimension, q.question_text, q.response_options,
                        q.polarity, q.weight, q.logic, q.options, q.sort_order, q.is_active,
                        COALESCE(q.target_personas, '{}') AS target_personas,
                        ca.category AS concern_category, ca.concern_area AS concern_label
                 FROM short_assessment_questions q
                 JOIN concern_areas ca ON ca.id = q.concern_area_id
                 WHERE 1=1`;
      if (concernId) { params.push(concernId); sql += ` AND q.concern_area_id = $${params.length}`; }
      if (stage && stage !== 'all') { params.push(stage); sql += ` AND q.stage = $${params.length}`; }
      sql += ' ORDER BY q.sort_order, q.id';
      const r = await pool.query(sql, params);
      res.json({ questions: r.rows });
    } catch (err) { next(err); }
  });

  const VALID_SAQ_PERSONAS = ['student', 'teacher', 'campus', 'jobseeker', 'parent', 'professional'];
  const parseSaqPersonas = (v: any): string[] =>
    Array.isArray(v) ? v.map(String).filter(p => VALID_SAQ_PERSONAS.includes(p)) : [];

  app.post('/api/short-assessments/admin', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const b = req.body;
    if (!b.concern_area_id || !b.question_text) return res.status(400).json({ error: 'concern_area_id and question_text required' });
    try {
      const r = await pool.query(
        `INSERT INTO short_assessment_questions
           (concern_area_id, question_code, stage, age_band, is_anchor, focus_area, layer, dimension,
            question_text, response_options, polarity, weight, logic, options, target_personas, sort_order, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17) RETURNING *`,
        [b.concern_area_id, b.question_code||'', b.stage||'Curiosity', b.age_band||null,
         !!b.is_anchor, b.focus_area||null, b.layer||null, b.dimension||null,
         b.question_text, b.response_options||null, b.polarity||null, b.weight||'1',
         b.logic||null, b.options ? JSON.stringify(b.options) : null,
         parseSaqPersonas(b.target_personas), Number(b.sort_order)||0, b.is_active !== false]
      );
      res.status(201).json({ question: r.rows[0] });
    } catch (err) { next(err); }
  });

  app.patch('/api/short-assessments/admin/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const b = req.body;
    try {
      const r = await pool.query(
        `UPDATE short_assessment_questions SET
           concern_area_id=$1, question_code=$2, stage=$3, age_band=$4, is_anchor=$5,
           focus_area=$6, layer=$7, dimension=$8, question_text=$9, response_options=$10,
           polarity=$11, weight=$12, logic=$13, options=$14::jsonb,
           target_personas=$15, sort_order=$16, is_active=$17, updated_at=NOW()
         WHERE id=$18 RETURNING *`,
        [b.concern_area_id, b.question_code||'', b.stage||'Curiosity', b.age_band||null,
         !!b.is_anchor, b.focus_area||null, b.layer||null, b.dimension||null,
         b.question_text, b.response_options||null, b.polarity||null, b.weight||'1',
         b.logic||null, b.options ? JSON.stringify(b.options) : null,
         parseSaqPersonas(b.target_personas), Number(b.sort_order)||0, b.is_active !== false, id]
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ question: r.rows[0] });
    } catch (err) { next(err); }
  });

  app.delete('/api/short-assessments/admin/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    try {
      const r = await pool.query('DELETE FROM short_assessment_questions WHERE id=$1', [id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  app.delete('/api/short-assessments/admin/bulk', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
    if (ids.length === 0) return res.status(400).json({ error: 'No valid ids' });
    try {
      await pool.query('DELETE FROM short_assessment_questions WHERE id = ANY($1)', [ids]);
      res.json({ ok: true, deleted: ids.length });
    } catch (err) { next(err); }
  });

  app.put('/api/short-assessments/admin/age-bands', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const bands: any[] = Array.isArray(req.body?.bands) ? req.body.bands : [];
    if (!bands.length) return res.status(400).json({ error: 'bands array required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const b of bands) {
        const code = String(b.code || '').trim().toUpperCase();
        if (!code) continue;
        const ages = String(b.ages || '').trim();
        await client.query(
          `INSERT INTO short_assessment_age_bands (code, ages, is_active, sort_order, description)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (code) DO UPDATE SET ages=$2, is_active=$3, sort_order=$4, description=$5, updated_at=NOW()`,
          [code, ages, !!b.is_active, Number(b.sort_order)||0, b.description||null]
        );
      }
      const keepCodes = bands.map(b => String(b.code||'').trim().toUpperCase()).filter(Boolean);
      if (keepCodes.length > 0) {
        await client.query(`DELETE FROM short_assessment_age_bands WHERE code != ALL($1)`, [keepCodes]);
      }
      await client.query('COMMIT');
      const r = await client.query('SELECT * FROM short_assessment_age_bands ORDER BY sort_order, code');
      res.json({ bands: r.rows });
    } catch (err) { await client.query('ROLLBACK'); next(err); }
    finally { client.release(); }
  });

  app.post('/api/short-assessments/admin/upload', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const { concern_area_id, stage_default, mode, text } = req.body;
    if (!concern_area_id || !text) return res.status(400).json({ error: 'concern_area_id and text required' });
    try {
      const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return res.status(400).json({ error: 'Need at least a header row and one data row' });

      const headers = lines[0].split(/\t|,/).map(h => h.toLowerCase().trim());
      const getIdx = (...names: string[]) => names.reduce((acc, n) => acc === -1 ? headers.indexOf(n) : acc, -1);

      const idxCode  = getIdx('id', 'question_code', 'code');
      const idxAnchor = getIdx('anchor', 'is_anchor');
      const idxFocus  = getIdx('focus area', 'focus_area', 'focus');
      const idxLayer  = getIdx('layer');
      const idxDim    = getIdx('dimension', 'dim');
      const idxQ      = getIdx('question', 'question_text', 'text');
      const idxResp   = getIdx('response', 'response_options', 'responses');
      const idxPol    = getIdx('polarity', 'pol');
      const idxWt     = getIdx('wt', 'weight');
      const idxLogic  = getIdx('logic');
      const idxAge    = getIdx('age band', 'age_band', 'age');
      const idxStage  = getIdx('stage');

      if (idxQ === -1) return res.status(400).json({ error: 'Column "Question" not found' });

      const sep = lines[0].includes('\t') ? '\t' : ',';
      const rows = lines.slice(1).map(l => l.split(sep));
      const isTrue = (v: string) => ['yes','y','1','true','✓'].includes(String(v||'').toLowerCase().trim());

      const records = rows.map((cols, i) => ({
        concern_area_id: Number(concern_area_id),
        question_code: idxCode !== -1 ? String(cols[idxCode]||'').trim() : `Q${i+1}`,
        stage: (idxStage !== -1 && cols[idxStage]?.trim()) ? cols[idxStage].trim() : (stage_default || 'Curiosity'),
        age_band: idxAge !== -1 ? (cols[idxAge]||'').trim() || null : null,
        is_anchor: idxAnchor !== -1 ? isTrue(cols[idxAnchor]) : false,
        focus_area: idxFocus !== -1 ? (cols[idxFocus]||'').trim() || null : null,
        layer: idxLayer !== -1 ? (cols[idxLayer]||'').trim() || null : null,
        dimension: idxDim !== -1 ? (cols[idxDim]||'').trim() || null : null,
        question_text: String(cols[idxQ]||'').trim(),
        response_options: idxResp !== -1 ? (cols[idxResp]||'').trim() || null : null,
        polarity: idxPol !== -1 ? (cols[idxPol]||'').trim() || null : null,
        weight: idxWt !== -1 ? (cols[idxWt]||'1').trim() || '1' : '1',
        logic: idxLogic !== -1 ? (cols[idxLogic]||'').trim() || null : null,
        sort_order: i,
      })).filter(r => r.question_text);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (mode === 'replace') {
          await client.query('DELETE FROM short_assessment_questions WHERE concern_area_id=$1', [concern_area_id]);
        }
        let inserted = 0;
        for (const r of records) {
          await client.query(
            `INSERT INTO short_assessment_questions
               (concern_area_id, question_code, stage, age_band, is_anchor, focus_area, layer, dimension,
                question_text, response_options, polarity, weight, logic, sort_order, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE)`,
            [r.concern_area_id, r.question_code, r.stage, r.age_band, r.is_anchor,
             r.focus_area, r.layer, r.dimension, r.question_text, r.response_options,
             r.polarity, r.weight, r.logic, r.sort_order]
          );
          inserted++;
        }
        await client.query('COMMIT');
        res.json({ ok: true, inserted });
      } catch (err) { await client.query('ROLLBACK'); throw err; }
      finally { client.release(); }
    } catch (err) { next(err); }
  });
}
