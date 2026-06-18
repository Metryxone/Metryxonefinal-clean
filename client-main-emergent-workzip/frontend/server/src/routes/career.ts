import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { db } from '../db/drizzle.js';
import { children, careerCompassResults } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();
router.use(requireAuth);

const CAREER_DATABASE = [
  { career: 'Software Engineer', traits: ['logical', 'analytical', 'detail-oriented', 'problem-solver'], streams: ['Science', 'Mathematics'], match_keywords: ['Technology', 'Engineering', 'Mathematics', 'Science & Research'] },
  { career: 'Data Scientist', traits: ['analytical', 'mathematical', 'curious', 'systematic'], streams: ['Science', 'Mathematics', 'Commerce'], match_keywords: ['Technology', 'Science & Research', 'Business'] },
  { career: 'Medical Doctor', traits: ['empathetic', 'methodical', 'patient', 'detail-oriented'], streams: ['Science', 'Biology'], match_keywords: ['Medicine', 'Science & Research'] },
  { career: 'Chartered Accountant', traits: ['analytical', 'detail-oriented', 'systematic', 'trustworthy'], streams: ['Commerce'], match_keywords: ['Business', 'Finance'] },
  { career: 'Civil Engineer', traits: ['spatial', 'methodical', 'problem-solver', 'organized'], streams: ['Science', 'Mathematics'], match_keywords: ['Engineering', 'Architecture'] },
  { career: 'Graphic Designer', traits: ['creative', 'visual', 'expressive', 'detail-oriented'], streams: ['Arts', 'Humanities'], match_keywords: ['Arts & Design', 'Technology'] },
  { career: 'IAS / Civil Services', traits: ['leadership', 'analytical', 'empathetic', 'communicative'], streams: ['Humanities', 'Arts'], match_keywords: ['Civil Services', 'Law', 'Business'] },
  { career: 'Lawyer / Advocate', traits: ['argumentative', 'analytical', 'communicative', 'logical'], streams: ['Humanities', 'Arts'], match_keywords: ['Law', 'Civil Services'] },
  { career: 'Entrepreneur', traits: ['risk-taker', 'creative', 'leadership', 'resilient'], streams: ['Commerce', 'Any'], match_keywords: ['Business', 'Technology', 'Arts & Design'] },
  { career: 'Research Scientist', traits: ['curious', 'patient', 'analytical', 'systematic'], streams: ['Science'], match_keywords: ['Science & Research', 'Medicine'] },
  { career: 'Architect', traits: ['creative', 'spatial', 'detail-oriented', 'aesthetic'], streams: ['Science', 'Arts'], match_keywords: ['Arts & Design', 'Engineering'] },
  { career: 'Psychologist', traits: ['empathetic', 'patient', 'communicative', 'observant'], streams: ['Humanities', 'Science'], match_keywords: ['Medicine', 'Civil Services'] },
  { career: 'Product Manager', traits: ['leadership', 'communicative', 'analytical', 'creative'], streams: ['Any'], match_keywords: ['Technology', 'Business'] },
  { career: 'Journalist / Media', traits: ['communicative', 'curious', 'expressive', 'adaptable'], streams: ['Humanities', 'Arts'], match_keywords: ['Arts & Design', 'Civil Services'] },
  { career: 'Professional Athlete', traits: ['competitive', 'resilient', 'disciplined', 'focused'], streams: ['Any'], match_keywords: ['Sports'] },
  { career: 'Musician / Artist', traits: ['creative', 'expressive', 'sensitive', 'disciplined'], streams: ['Arts'], match_keywords: ['Music/Arts', 'Arts & Design'] },
];

const TRAIT_KEYWORDS: Record<string, string[]> = {
  logical: ['Mathematics', 'Science', 'Technology', 'Engineering'],
  creative: ['Arts & Design', 'Music/Arts', 'Entrepreneurship'],
  empathetic: ['Medicine', 'Psychology', 'Civil Services', 'Teaching'],
  leadership: ['Civil Services', 'Business', 'Sports', 'Entrepreneurship'],
  analytical: ['Technology', 'Science', 'Finance', 'Research'],
  communicative: ['Law', 'Media', 'Business', 'Education'],
  competitive: ['Sports', 'Civil Services', 'Business'],
  curious: ['Science & Research', 'Medicine', 'Education'],
};

function generateCareerMatches(child: Record<string, unknown>) {
  const grade = String(child.grade ?? '');
  const favoriteSubjects = (child.favoriteSubjects as string[] | null) ?? (child.favorite_subjects as string[] | null) ?? [];
  const gradeNum = parseInt(grade.replace(/\D/g, '')) || 8;

  const subjectTraits: string[] = [];
  if (favoriteSubjects.some(s => ['Mathematics', 'Physics', 'Chemistry'].includes(s))) subjectTraits.push('logical', 'analytical');
  if (favoriteSubjects.some(s => ['Biology', 'Science'].includes(s))) subjectTraits.push('curious', 'methodical');
  if (favoriteSubjects.some(s => ['English', 'Social Studies', 'History'].includes(s))) subjectTraits.push('communicative', 'expressive');
  if (favoriteSubjects.some(s => ['Art', 'Music'].includes(s))) subjectTraits.push('creative', 'aesthetic');

  return CAREER_DATABASE.map(c => {
    const traitMatch = subjectTraits.filter(t => c.traits.includes(t)).length;
    const maxMatch = Math.max(subjectTraits.length, 1);
    const baseScore = Math.round((traitMatch / maxMatch) * 60) + Math.floor(Math.random() * 25) + 15;
    const score = Math.min(baseScore, 98);
    return { career: c.career, score, traits: c.traits.slice(0, 3), streams: c.streams };
  }).sort((a, b) => b.score - a.score).slice(0, 8);
}

function generateInterestProfile(child: Record<string, unknown>) {
  const subjects = (child.favoriteSubjects as string[] | null) ?? (child.favorite_subjects as string[] | null) ?? [];
  return {
    stem: subjects.some(s => ['Mathematics', 'Physics', 'Chemistry', 'Science'].includes(s)) ? 'High' : 'Moderate',
    humanities: subjects.some(s => ['English', 'History', 'Social Studies', 'Geography'].includes(s)) ? 'High' : 'Low',
    arts: subjects.some(s => ['Art', 'Music', 'Drawing'].includes(s)) ? 'High' : 'Low',
    commerce: subjects.some(s => ['Economics', 'Business', 'Accountancy'].includes(s)) ? 'High' : 'Low',
    sports: 'Moderate',
  };
}

router.get('/:childId', async (req, res) => {
  try {
    const { childId } = req.params;
    const childRows = await db.select().from(children)
      .where(and(eq(children.id, childId), eq(children.parentId, req.user!.id)));
    if (!childRows.length) { res.status(404).json({ error: 'CHILD_NOT_FOUND' }); return; }

    const existing = await db.select().from(careerCompassResults)
      .where(eq(careerCompassResults.childId, childId))
      .orderBy(desc(careerCompassResults.generatedAt))
      .limit(1);

    if (existing.length) {
      return res.json({
        id: existing[0].id,
        childId: existing[0].childId,
        traits: existing[0].traits,
        careerMatches: existing[0].careerMatches,
        interestProfile: existing[0].interestProfile,
        generatedAt: existing[0].generatedAt,
      });
    }

    // Generate fresh
    const child = childRows[0] as Record<string, unknown>;
    const careerMatches = generateCareerMatches(child);
    const interestProfile = generateInterestProfile(child);
    const traits = { logical: 65, creative: 55, empathetic: 70, leadership: 60, analytical: 75 };

    const rows = await db.insert(careerCompassResults)
      .values({
        childId,
        parentId: req.user!.id,
        traits: JSON.stringify(traits),
        careerMatches: JSON.stringify(careerMatches),
        interestProfile: JSON.stringify(interestProfile),
      })
      .returning();

    res.json({
      id: rows[0].id,
      childId: rows[0].childId,
      traits: rows[0].traits,
      careerMatches: rows[0].careerMatches,
      interestProfile: rows[0].interestProfile,
      generatedAt: rows[0].generatedAt,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/:childId/regenerate', async (req, res) => {
  try {
    const { childId } = req.params;
    const childRows = await db.select().from(children)
      .where(and(eq(children.id, childId), eq(children.parentId, req.user!.id)));
    if (!childRows.length) { res.status(404).json({ error: 'CHILD_NOT_FOUND' }); return; }

    const child = childRows[0] as Record<string, unknown>;
    const careerMatches = generateCareerMatches(child);
    const interestProfile = generateInterestProfile(child);
    const traits = {
      logical: Math.floor(Math.random() * 30) + 50,
      creative: Math.floor(Math.random() * 30) + 40,
      empathetic: Math.floor(Math.random() * 30) + 45,
      leadership: Math.floor(Math.random() * 30) + 40,
      analytical: Math.floor(Math.random() * 30) + 55,
    };

    await db.delete(careerCompassResults).where(eq(careerCompassResults.childId, childId));
    const rows = await db.insert(careerCompassResults)
      .values({
        childId,
        parentId: req.user!.id,
        traits: JSON.stringify(traits),
        careerMatches: JSON.stringify(careerMatches),
        interestProfile: JSON.stringify(interestProfile),
      })
      .returning();

    res.json({ message: 'Career compass refreshed', careerMatches: rows[0].careerMatches, traits: rows[0].traits, interestProfile: rows[0].interestProfile });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
