import { Router, Request, Response } from 'express';
import { pool } from '../db/client.js';

const router = Router();

// ── Auth helper ───────────────────────────────────────────────────────────────
function getUserId(req: Request): string | null {
  try {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    if (!t) return null;
    const p = JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString());
    return p.id || p.userId || null;
  } catch { return null; }
}
function requireUser(req: Request, res: Response): string | null {
  const id = getUserId(req);
  if (!id) { res.status(401).json({ success: false, error: 'Unauthorized' }); return null; }
  return id;
}

// ─── Exam curriculum data (syllabus chapters) ─────────────────────────────────
export const EXAM_CURRICULUM: Record<string, Record<string, { chapter: string; weightage: number }[]>> = {
  JEE_MAIN: {
    Physics: [
      { chapter: 'Units & Measurements', weightage: 3 }, { chapter: 'Kinematics', weightage: 5 },
      { chapter: 'Laws of Motion', weightage: 6 }, { chapter: 'Work, Energy & Power', weightage: 5 },
      { chapter: 'Rotational Motion', weightage: 6 }, { chapter: 'Gravitation', weightage: 4 },
      { chapter: 'Properties of Solids & Fluids', weightage: 5 }, { chapter: 'Thermodynamics', weightage: 7 },
      { chapter: 'Kinetic Theory of Gases', weightage: 4 }, { chapter: 'Oscillations & Waves', weightage: 6 },
      { chapter: 'Electrostatics', weightage: 8 }, { chapter: 'Current Electricity', weightage: 7 },
      { chapter: 'Magnetic Effects of Current', weightage: 6 }, { chapter: 'Electromagnetic Induction', weightage: 5 },
      { chapter: 'Alternating Current', weightage: 4 }, { chapter: 'Electromagnetic Waves', weightage: 3 },
      { chapter: 'Ray Optics', weightage: 5 }, { chapter: 'Wave Optics', weightage: 4 },
      { chapter: 'Dual Nature of Matter', weightage: 4 }, { chapter: 'Atoms & Nuclei', weightage: 4 },
      { chapter: 'Semiconductor Devices', weightage: 5 },
    ],
    Chemistry: [
      { chapter: 'Atomic Structure', weightage: 5 }, { chapter: 'Chemical Bonding', weightage: 6 },
      { chapter: 'States of Matter', weightage: 4 }, { chapter: 'Thermodynamics', weightage: 5 },
      { chapter: 'Equilibrium', weightage: 6 }, { chapter: 'Redox & Electrochemistry', weightage: 5 },
      { chapter: 'Chemical Kinetics', weightage: 4 }, { chapter: 'Surface Chemistry', weightage: 3 },
      { chapter: 'p-Block Elements', weightage: 7 }, { chapter: 'd & f Block Elements', weightage: 5 },
      { chapter: 'Coordination Compounds', weightage: 5 }, { chapter: 'Solid State', weightage: 4 },
      { chapter: 'Solutions', weightage: 4 }, { chapter: 'Biomolecules', weightage: 4 },
      { chapter: 'Polymers', weightage: 3 }, { chapter: 'Hydrocarbons', weightage: 5 },
      { chapter: 'Haloalkanes & Haloarenes', weightage: 4 }, { chapter: 'Alcohols & Phenols', weightage: 4 },
      { chapter: 'Aldehydes & Ketones', weightage: 5 }, { chapter: 'Amines', weightage: 4 },
    ],
    Mathematics: [
      { chapter: 'Sets, Relations & Functions', weightage: 5 }, { chapter: 'Complex Numbers', weightage: 5 },
      { chapter: 'Quadratic Equations', weightage: 4 }, { chapter: 'Sequences & Series', weightage: 5 },
      { chapter: 'Permutations & Combinations', weightage: 4 }, { chapter: 'Binomial Theorem', weightage: 4 },
      { chapter: 'Limits, Continuity & Differentiability', weightage: 6 }, { chapter: 'Applications of Derivatives', weightage: 6 },
      { chapter: 'Integrals', weightage: 8 }, { chapter: 'Differential Equations', weightage: 5 },
      { chapter: 'Matrices & Determinants', weightage: 5 }, { chapter: 'Vectors', weightage: 5 },
      { chapter: '3D Geometry', weightage: 5 }, { chapter: 'Coordinate Geometry', weightage: 8 },
      { chapter: 'Trigonometry', weightage: 5 }, { chapter: 'Probability', weightage: 5 },
      { chapter: 'Statistics', weightage: 3 }, { chapter: 'Mathematical Reasoning', weightage: 2 },
    ],
  },
  NEET: {
    Physics: [
      { chapter: 'Mechanics', weightage: 12 }, { chapter: 'Kinematics', weightage: 5 },
      { chapter: 'Laws of Motion', weightage: 6 }, { chapter: 'Thermodynamics', weightage: 7 },
      { chapter: 'Oscillations & Waves', weightage: 6 }, { chapter: 'Electrostatics', weightage: 7 },
      { chapter: 'Current Electricity', weightage: 6 }, { chapter: 'Magnetic Effects', weightage: 5 },
      { chapter: 'Optics', weightage: 8 }, { chapter: 'Modern Physics', weightage: 8 },
      { chapter: 'Semiconductor Devices', weightage: 5 },
    ],
    Chemistry: [
      { chapter: 'Basic Concepts', weightage: 4 }, { chapter: 'Atomic Structure', weightage: 5 },
      { chapter: 'Chemical Bonding', weightage: 6 }, { chapter: 'Equilibrium', weightage: 6 },
      { chapter: 'Electrochemistry', weightage: 5 }, { chapter: 'Chemical Kinetics', weightage: 5 },
      { chapter: 'p-Block Elements', weightage: 8 }, { chapter: 'Organic Chemistry Basics', weightage: 6 },
      { chapter: 'Hydrocarbons', weightage: 5 }, { chapter: 'Biomolecules', weightage: 5 },
      { chapter: 'Environmental Chemistry', weightage: 3 },
    ],
    Biology: [
      { chapter: 'Cell Biology', weightage: 10 }, { chapter: 'Cell Division', weightage: 5 },
      { chapter: 'Biomolecules', weightage: 6 }, { chapter: 'Plant Physiology', weightage: 8 },
      { chapter: 'Photosynthesis', weightage: 6 }, { chapter: 'Respiration', weightage: 5 },
      { chapter: 'Human Physiology', weightage: 12 }, { chapter: 'Reproduction', weightage: 8 },
      { chapter: 'Genetics & Evolution', weightage: 10 }, { chapter: 'Ecology & Environment', weightage: 8 },
      { chapter: 'Biotechnology', weightage: 6 }, { chapter: 'Microbes & Human Welfare', weightage: 4 },
    ],
  },
  CAT: {
    VARC: [
      { chapter: 'Reading Comprehension', weightage: 25 }, { chapter: 'Para Jumbles', weightage: 8 },
      { chapter: 'Para Summary', weightage: 6 }, { chapter: 'Odd Sentence Out', weightage: 5 },
      { chapter: 'Vocabulary in Context', weightage: 4 }, { chapter: 'Critical Reasoning', weightage: 7 },
    ],
    DILR: [
      { chapter: 'Data Interpretation - Tables', weightage: 10 }, { chapter: 'DI - Bar & Line Graphs', weightage: 10 },
      { chapter: 'DI - Pie Charts', weightage: 8 }, { chapter: 'Logical Reasoning - Arrangements', weightage: 10 },
      { chapter: 'LR - Blood Relations', weightage: 6 }, { chapter: 'LR - Syllogisms', weightage: 6 },
      { chapter: 'LR - Venn Diagrams', weightage: 6 }, { chapter: 'LR - Games & Tournaments', weightage: 8 },
    ],
    QA: [
      { chapter: 'Number Systems', weightage: 8 }, { chapter: 'Algebra', weightage: 10 },
      { chapter: 'Arithmetic - Ratios & Percentages', weightage: 8 }, { chapter: 'Time, Speed & Distance', weightage: 6 },
      { chapter: 'Geometry', weightage: 8 }, { chapter: 'Coordinate Geometry', weightage: 5 },
      { chapter: 'Permutations & Combinations', weightage: 6 }, { chapter: 'Probability', weightage: 5 },
      { chapter: 'Progressions', weightage: 4 }, { chapter: 'Set Theory', weightage: 4 },
    ],
  },
  GATE_CS: {
    'Engineering Mathematics': [
      { chapter: 'Linear Algebra', weightage: 8 }, { chapter: 'Calculus', weightage: 5 },
      { chapter: 'Probability & Statistics', weightage: 7 }, { chapter: 'Graph Theory', weightage: 5 },
    ],
    'Computer Science': [
      { chapter: 'Data Structures', weightage: 12 }, { chapter: 'Algorithms', weightage: 12 },
      { chapter: 'Theory of Computation', weightage: 8 }, { chapter: 'Compiler Design', weightage: 6 },
      { chapter: 'Operating Systems', weightage: 10 }, { chapter: 'DBMS', weightage: 8 },
      { chapter: 'Computer Networks', weightage: 8 }, { chapter: 'Digital Logic', weightage: 6 },
      { chapter: 'Computer Organisation', weightage: 6 }, { chapter: 'Programming & DS', weightage: 10 },
    ],
  },
};
EXAM_CURRICULUM['JEE_ADV'] = EXAM_CURRICULUM['JEE_MAIN'];
EXAM_CURRICULUM['EAMCET_AP'] = { ...EXAM_CURRICULUM['JEE_MAIN'], Biology: EXAM_CURRICULUM['NEET']['Biology'] };
EXAM_CURRICULUM['EAMCET_TS'] = EXAM_CURRICULUM['EAMCET_AP'];
EXAM_CURRICULUM['CUET'] = {
  English: [
    { chapter: 'Reading Comprehension', weightage: 20 }, { chapter: 'Vocabulary', weightage: 15 },
    { chapter: 'Grammar & Usage', weightage: 15 }, { chapter: 'Writing Skills', weightage: 20 },
    { chapter: 'Literary Texts', weightage: 15 }, { chapter: 'Verbal Reasoning', weightage: 15 },
  ],
  'General Test': [
    { chapter: 'Quantitative Aptitude', weightage: 25 }, { chapter: 'Logical Reasoning', weightage: 25 },
    { chapter: 'General Awareness', weightage: 25 }, { chapter: 'Current Affairs', weightage: 25 },
  ],
};

// Benchmark distributions (percentile brackets: p10, p25, p50, p75, p90 marks out of 100%)
const BENCHMARK_DATA: Record<string, { totalCandidates: number; distribution: number[]; subjectAvg: Record<string, number> }> = {
  JEE_MAIN: { totalCandidates: 1200000, distribution: [18, 28, 42, 60, 78], subjectAvg: { Physics: 38, Chemistry: 45, Mathematics: 35 } },
  JEE_ADV:  { totalCandidates: 200000,  distribution: [12, 22, 38, 55, 72], subjectAvg: { Physics: 32, Chemistry: 40, Mathematics: 30 } },
  NEET:     { totalCandidates: 2200000, distribution: [30, 42, 55, 68, 82], subjectAvg: { Physics: 42, Chemistry: 50, Biology: 58 } },
  EAMCET_AP:{ totalCandidates: 320000,  distribution: [25, 38, 52, 65, 78], subjectAvg: { Physics: 40, Chemistry: 48, Mathematics: 38 } },
  EAMCET_TS:{ totalCandidates: 280000,  distribution: [24, 37, 51, 64, 77], subjectAvg: { Physics: 39, Chemistry: 47, Mathematics: 37 } },
  CAT:      { totalCandidates: 320000,  distribution: [22, 38, 55, 70, 85], subjectAvg: { VARC: 55, DILR: 45, QA: 50 } },
  CUET:     { totalCandidates: 1400000, distribution: [28, 42, 56, 68, 80], subjectAvg: { English: 58, 'General Test': 52 } },
  GATE_CS:  { totalCandidates: 110000,  distribution: [15, 30, 48, 62, 76], subjectAvg: { 'Engineering Mathematics': 45, 'Computer Science': 40 } },
};

// ─── Exam calendar (important dates 2025-2026) ─────────────────────────────────
const EXAM_CALENDAR: Record<string, { event: string; date: string; status: 'done' | 'upcoming' | 'live' }[]> = {
  JEE_MAIN: [
    { event: 'Session 1 Registration', date: '2024-11-01', status: 'done' },
    { event: 'Session 1 Admit Card', date: '2025-01-14', status: 'done' },
    { event: 'Session 1 Exam', date: '2025-01-22', status: 'done' },
    { event: 'Session 1 Result', date: '2025-02-12', status: 'done' },
    { event: 'Session 2 Registration', date: '2025-02-15', status: 'upcoming' },
    { event: 'Session 2 Exam', date: '2025-04-02', status: 'upcoming' },
    { event: 'Session 2 Result', date: '2025-04-25', status: 'upcoming' },
    { event: 'JEE Advanced Registration', date: '2025-05-01', status: 'upcoming' },
    { event: 'JEE Advanced Exam', date: '2025-05-18', status: 'upcoming' },
    { event: 'JoSAA Counselling Round 1', date: '2025-06-16', status: 'upcoming' },
  ],
  NEET: [
    { event: 'NEET 2025 Registration', date: '2025-02-07', status: 'done' },
    { event: 'Last Date to Apply', date: '2025-03-07', status: 'done' },
    { event: 'Admit Card Release', date: '2025-04-26', status: 'upcoming' },
    { event: 'NEET UG 2025 Exam', date: '2025-05-04', status: 'upcoming' },
    { event: 'Provisional Answer Key', date: '2025-05-15', status: 'upcoming' },
    { event: 'NEET Result Declaration', date: '2025-06-04', status: 'upcoming' },
    { event: 'NEET Counselling (MCC)', date: '2025-07-01', status: 'upcoming' },
  ],
  CAT: [
    { event: 'CAT 2025 Notification', date: '2025-07-30', status: 'upcoming' },
    { event: 'CAT Registration Opens', date: '2025-08-01', status: 'upcoming' },
    { event: 'Registration Closes', date: '2025-09-12', status: 'upcoming' },
    { event: 'CAT Admit Card', date: '2025-11-05', status: 'upcoming' },
    { event: 'CAT 2025 Exam', date: '2025-11-23', status: 'upcoming' },
    { event: 'CAT Result', date: '2026-01-05', status: 'upcoming' },
    { event: 'IIM Shortlisting Begins', date: '2026-01-20', status: 'upcoming' },
  ],
  GATE_CS: [
    { event: 'GATE 2026 Notification', date: '2025-08-28', status: 'upcoming' },
    { event: 'Registration Opens', date: '2025-09-01', status: 'upcoming' },
    { event: 'Registration Closes', date: '2025-10-03', status: 'upcoming' },
    { event: 'Admit Card', date: '2026-01-07', status: 'upcoming' },
    { event: 'GATE 2026 Exam', date: '2026-02-01', status: 'upcoming' },
    { event: 'Result Declaration', date: '2026-03-19', status: 'upcoming' },
  ],
};
EXAM_CALENDAR['JEE_ADV']   = EXAM_CALENDAR['JEE_MAIN'].filter(e => e.event.includes('Advanced') || e.event.includes('JoSAA'));
EXAM_CALENDAR['EAMCET_AP'] = [
  { event: 'AP EAMCET Registration', date: '2025-03-01', status: 'done' },
  { event: 'Hall Ticket Download', date: '2025-05-10', status: 'upcoming' },
  { event: 'AP EAMCET Exam', date: '2025-05-20', status: 'upcoming' },
  { event: 'Answer Key Release', date: '2025-05-28', status: 'upcoming' },
  { event: 'Result Declaration', date: '2025-06-15', status: 'upcoming' },
  { event: 'Web Counselling Round 1', date: '2025-07-01', status: 'upcoming' },
];
EXAM_CALENDAR['EAMCET_TS'] = [
  { event: 'TS EAMCET Registration', date: '2025-03-05', status: 'done' },
  { event: 'Hall Ticket Download', date: '2025-05-12', status: 'upcoming' },
  { event: 'TS EAMCET Exam', date: '2025-05-23', status: 'upcoming' },
  { event: 'Answer Key Release', date: '2025-05-30', status: 'upcoming' },
  { event: 'Result Declaration', date: '2025-06-18', status: 'upcoming' },
  { event: 'Counselling Round 1', date: '2025-07-05', status: 'upcoming' },
];
EXAM_CALENDAR['CUET'] = [
  { event: 'CUET Registration Opens', date: '2025-02-20', status: 'done' },
  { event: 'Registration Closes', date: '2025-03-22', status: 'done' },
  { event: 'Admit Card', date: '2025-04-30', status: 'upcoming' },
  { event: 'CUET 2025 Exam', date: '2025-05-13', status: 'upcoming' },
  { event: 'Result Declaration', date: '2025-06-30', status: 'upcoming' },
];

// ─── PROFILE ─────────────────────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM competitive_exam_profiles WHERE user_id=$1 AND is_active=TRUE ORDER BY created_at DESC LIMIT 1', [uid]
    );
    res.json({ success: true, profile: rows[0] || null });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/profile', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { examType, targetYear, examDate, currentClass, targetColleges, dailyStudyHours, coachingInstitute, city } = req.body;
    if (!examType) return res.status(400).json({ success: false, error: 'examType required' });
    // deactivate existing
    await pool.query('UPDATE competitive_exam_profiles SET is_active=FALSE WHERE user_id=$1', [uid]);
    const { rows } = await pool.query(
      `INSERT INTO competitive_exam_profiles (user_id,exam_type,target_year,exam_date,current_class,target_colleges,daily_study_hours,coaching_institute,city)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [uid, examType, targetYear||2025, examDate||null, currentClass||'12', JSON.stringify(targetColleges||[]), dailyStudyHours||6, coachingInstitute||null, city||null]
    );
    // seed chapters
    const profile = rows[0];
    const curriculum = EXAM_CURRICULUM[examType] || {};
    const vals: any[] = [];
    for (const [subj, chapters] of Object.entries(curriculum)) {
      for (const ch of chapters as any[]) {
        vals.push([profile.id, uid, examType, subj, ch.chapter, ch.weightage]);
      }
    }
    if (vals.length > 0) {
      const placeholders = vals.map((_, i) => `($${i*6+1},$${i*6+2},$${i*6+3},$${i*6+4},$${i*6+5},$${i*6+6})`).join(',');
      await pool.query(
        `INSERT INTO exam_chapter_progress (profile_id,user_id,exam_type,subject,chapter_name,weightage) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        vals.flat()
      );
    }
    res.json({ success: true, profile });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/profile/:id', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { targetYear, examDate, targetColleges, dailyStudyHours, coachingInstitute, city } = req.body;
    const { rows } = await pool.query(
      `UPDATE competitive_exam_profiles SET target_year=COALESCE($1,target_year), exam_date=COALESCE($2,exam_date),
       target_colleges=COALESCE($3,target_colleges), daily_study_hours=COALESCE($4,daily_study_hours),
       coaching_institute=COALESCE($5,coaching_institute), city=COALESCE($6,city), updated_at=NOW()
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [targetYear, examDate, targetColleges ? JSON.stringify(targetColleges) : null, dailyStudyHours, coachingInstitute, city, req.params.id, uid]
    );
    res.json({ success: true, profile: rows[0] });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
router.get('/dashboard/:profileId', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { profileId } = req.params;
    const [chaps, mocks, groups, interventions] = await Promise.all([
      pool.query('SELECT status, COUNT(*) cnt FROM exam_chapter_progress WHERE profile_id=$1 GROUP BY status', [profileId]),
      pool.query('SELECT scored_marks, total_marks, percentile, test_date FROM exam_mock_scores WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 10', [profileId]),
      pool.query('SELECT g.* FROM exam_study_groups g JOIN exam_group_members m ON g.id=m.group_id WHERE m.user_id=$1 LIMIT 5', [uid]),
      pool.query('SELECT * FROM exam_interventions WHERE user_id=$1 AND is_acknowledged=FALSE ORDER BY triggered_at DESC LIMIT 5', [uid]),
    ]);
    const chapByStatus: Record<string, number> = {};
    for (const r of chaps.rows) chapByStatus[r.status] = parseInt(r.cnt);
    const totalChaps = Object.values(chapByStatus).reduce((a: any, b: any) => a + b, 0);
    const doneChaps = (chapByStatus['done'] || 0) + (chapByStatus['revision'] || 0);
    const avgScore = mocks.rows.length ? Math.round(mocks.rows.reduce((s, r) => s + (r.scored_marks / r.total_marks) * 100, 0) / mocks.rows.length) : 0;
    const latestMock = mocks.rows[0] || null;
    res.json({
      success: true,
      chaptersTotal: totalChaps, chaptersDone: doneChaps, chapByStatus,
      mocksCount: mocks.rows.length, avgScore, latestMock,
      myGroups: groups.rows,
      interventions: interventions.rows,
    });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── BENCHMARK ────────────────────────────────────────────────────────────────
router.get('/benchmark/:examType', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { examType } = req.params;
    const data = BENCHMARK_DATA[examType];
    if (!data) return res.json({ success: true, benchmark: null });
    // get user's latest mock
    const profileRes = await pool.query('SELECT id FROM competitive_exam_profiles WHERE user_id=$1 AND exam_type=$2 AND is_active=TRUE LIMIT 1', [uid, examType]);
    let userPercentile = null; let userSubjectScores: Record<string, number> = {};
    if (profileRes.rows.length) {
      const mock = await pool.query('SELECT percentile, subject_scores FROM exam_mock_scores WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 1', [profileRes.rows[0].id]);
      if (mock.rows.length) {
        userPercentile = mock.rows[0].percentile;
        userSubjectScores = mock.rows[0].subject_scores || {};
      }
    }
    res.json({
      success: true,
      benchmark: {
        ...data,
        userPercentile,
        userSubjectScores,
        calendar: EXAM_CALENDAR[examType] || [],
      },
    });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── MOCK SCORES ──────────────────────────────────────────────────────────────
router.get('/mocks/:profileId', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { rows } = await pool.query('SELECT * FROM exam_mock_scores WHERE profile_id=$1 ORDER BY test_date DESC', [req.params.profileId]);
    res.json({ success: true, mocks: rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/mocks', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { profileId, examType, testName, testDate, totalMarks, scoredMarks, subjectScores, platform, notes } = req.body;
    const pct = totalMarks > 0 ? ((scoredMarks / totalMarks) * 100).toFixed(2) : 0;
    const benchData = BENCHMARK_DATA[examType];
    let predictedRank = null;
    if (benchData && totalMarks > 0) {
      const pctNum = parseFloat(pct as string);
      const dist = benchData.distribution;
      if (pctNum >= dist[4]) predictedRank = Math.round(benchData.totalCandidates * 0.02);
      else if (pctNum >= dist[3]) predictedRank = Math.round(benchData.totalCandidates * 0.08);
      else if (pctNum >= dist[2]) predictedRank = Math.round(benchData.totalCandidates * 0.30);
      else if (pctNum >= dist[1]) predictedRank = Math.round(benchData.totalCandidates * 0.60);
      else predictedRank = Math.round(benchData.totalCandidates * 0.85);
    }
    const { rows } = await pool.query(
      `INSERT INTO exam_mock_scores (profile_id,user_id,exam_type,test_name,test_date,total_marks,scored_marks,subject_scores,percentile,predicted_rank,platform,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [profileId, uid, examType, testName, testDate, totalMarks, scoredMarks, JSON.stringify(subjectScores||{}), pct, predictedRank, platform||'Self', notes||null]
    );
    await checkAndCreateInterventions(uid, profileId, examType, parseFloat(pct as string));
    res.json({ success: true, mock: rows[0] });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/mocks/:id', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    await pool.query('DELETE FROM exam_mock_scores WHERE id=$1 AND user_id=$2', [req.params.id, uid]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── CHAPTER PROGRESS ─────────────────────────────────────────────────────────
router.get('/chapters/:profileId', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { rows } = await pool.query('SELECT * FROM exam_chapter_progress WHERE profile_id=$1 ORDER BY subject, chapter_name', [req.params.profileId]);
    res.json({ success: true, chapters: rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/chapters/:id', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { status, confidence, notes } = req.body;
    const completedAt = status === 'done' ? 'NOW()' : 'completed_at';
    const { rows } = await pool.query(
      `UPDATE exam_chapter_progress SET
        status=COALESCE($1,status), confidence=COALESCE($2,confidence),
        notes=COALESCE($3,notes), updated_at=NOW(),
        completed_at=${status === 'done' ? 'NOW()' : 'completed_at'}
       WHERE id=$4 AND user_id=$5 RETURNING *`,
      [status, confidence, notes, req.params.id, uid]
    );
    res.json({ success: true, chapter: rows[0] });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── STUDY GROUPS ─────────────────────────────────────────────────────────────
router.get('/groups', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { examType } = req.query as Record<string, string>;
    const where = examType ? 'WHERE g.exam_type=$1' : '';
    const params = examType ? [examType] : [];
    const { rows } = await pool.query(
      `SELECT g.*, u.full_name AS creator_name,
        EXISTS(SELECT 1 FROM exam_group_members WHERE group_id=g.id AND user_id='${uid}') AS is_member
       FROM exam_study_groups g LEFT JOIN users u ON g.created_by=u.id ${where}
       ORDER BY g.member_count DESC, g.created_at DESC LIMIT 30`,
      params
    );
    res.json({ success: true, groups: rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/groups', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { name, examType, description, maxMembers, isPublic } = req.body;
    if (!name || !examType) return res.status(400).json({ success: false, error: 'name and examType required' });
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { rows } = await pool.query(
      `INSERT INTO exam_study_groups (name,exam_type,description,created_by,max_members,is_public,access_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, examType, description||null, uid, maxMembers||20, isPublic!==false, code]
    );
    await pool.query('INSERT INTO exam_group_members (group_id,user_id,role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [rows[0].id, uid, 'admin']);
    res.json({ success: true, group: rows[0] });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/groups/:id/join', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { accessCode } = req.body;
    const grpRes = await pool.query('SELECT * FROM exam_study_groups WHERE id=$1', [req.params.id]);
    if (!grpRes.rows.length) return res.status(404).json({ success: false, error: 'Group not found' });
    const grp = grpRes.rows[0];
    if (!grp.is_public && grp.access_code !== accessCode) return res.status(403).json({ success: false, error: 'Wrong access code' });
    if (grp.member_count >= grp.max_members) return res.status(400).json({ success: false, error: 'Group is full' });
    await pool.query('INSERT INTO exam_group_members (group_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [grp.id, uid]);
    await pool.query('UPDATE exam_study_groups SET member_count=member_count+1 WHERE id=$1', [grp.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/groups/:id/leave', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    await pool.query('DELETE FROM exam_group_members WHERE group_id=$1 AND user_id=$2', [req.params.id, uid]);
    await pool.query('UPDATE exam_study_groups SET member_count=GREATEST(member_count-1,0) WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── INTERVENTIONS ────────────────────────────────────────────────────────────
router.get('/interventions', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    const { rows } = await pool.query('SELECT * FROM exam_interventions WHERE user_id=$1 ORDER BY triggered_at DESC LIMIT 20', [uid]);
    res.json({ success: true, interventions: rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/interventions/:id/acknowledge', async (req, res) => {
  const uid = requireUser(req, res); if (!uid) return;
  try {
    await pool.query('UPDATE exam_interventions SET is_acknowledged=TRUE WHERE id=$1 AND user_id=$2', [req.params.id, uid]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── EXAM CALENDAR ────────────────────────────────────────────────────────────
router.get('/calendar/:examType', async (_req, res) => {
  const { examType } = _req.params;
  res.json({ success: true, events: EXAM_CALENDAR[examType] || [] });
});

// ─── CURRICULUM (for frontend) ────────────────────────────────────────────────
router.get('/curriculum/:examType', (req, res) => {
  const curr = EXAM_CURRICULUM[req.params.examType];
  res.json({ success: true, curriculum: curr || {} });
});

// ─── Auto-intervention logic ───────────────────────────────────────────────────
async function checkAndCreateInterventions(userId: string, profileId: string, examType: string, pct: number) {
  try {
    const bench = BENCHMARK_DATA[examType];
    if (!bench) return;
    const interventions = [];
    if (pct < bench.distribution[0]) {
      interventions.push({ type: 'low_score', severity: 'critical', title: 'Score needs urgent attention', message: `Your score (${pct.toFixed(0)}%) is below the bottom 10th percentile for ${examType}. Consider consulting a mentor for a personalised recovery plan.`, action_label: 'Find a Mentor', action_url: '/competitive-exam-portal?tab=mentors' });
    } else if (pct < bench.distribution[1]) {
      interventions.push({ type: 'low_score', severity: 'warning', title: 'Score below average', message: `Your score (${pct.toFixed(0)}%) is in the bottom 25% for ${examType}. Focus on weak chapters identified in Gap Analysis.`, action_label: 'View Gap Analysis', action_url: '/competitive-exam-portal?tab=gaps' });
    }
    for (const iv of interventions) {
      await pool.query(
        `INSERT INTO exam_interventions (user_id,profile_id,trigger_type,severity,title,message,action_label,action_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [userId, profileId, iv.type, iv.severity, iv.title, iv.message, iv.action_label, iv.action_url]
      );
    }
  } catch { /* non-fatal */ }
}

export default router;
