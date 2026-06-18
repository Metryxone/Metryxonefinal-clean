import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import { connectMongo } from '../db/mongo.js';
import mongoose, { Schema, Document } from 'mongoose';

const router = Router();

// ── Multer (memory storage so we parse without hitting disk permanently) ────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.doc', '.docx'].includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX files allowed'));
  },
});

// ── CareerSeekerProfile Mongoose schema ────────────────────────────────────
const CareerSeekerProfileSchema = new Schema({
  userId:     { type: String, required: true, unique: true },
  email:      { type: String },
  parsedAt:   { type: Date, default: Date.now },
  rawText:    { type: String },
  personal: {
    name:       String,
    email:      String,
    phone:      String,
    location:   String,
    linkedin:   String,
    github:     String,
    website:    String,
    portfolio:  String,
  },
  summary:    { type: String },
  skills: {
    technical:   [String],
    soft:        [String],
    tools:       [String],
    languages:   [String],
  },
  education: [{
    institution: String,
    degree:      String,
    field:       String,
    startYear:   String,
    endYear:     String,
    grade:       String,
  }],
  experience: [{
    company:     String,
    role:        String,
    startDate:   String,
    endDate:     String,
    description: String,
    isCurrent:   Boolean,
  }],
  certifications: [{
    name:   String,
    issuer: String,
    year:   String,
  }],
  projects: [{
    name:        String,
    description: String,
    tech:        [String],
    url:         String,
  }],
  achievements: [String],
  spokenLanguages: [String],
  competencyProfile: {
    completeness:   { type: Number, default: 0 },
    sectionsFilled: [String],
  },
}, { timestamps: true });

let CareerSeekerProfile: mongoose.Model<any>;
async function getModel() {
  await connectMongo();
  if (!CareerSeekerProfile) {
    CareerSeekerProfile = mongoose.models.CareerSeekerProfile
      || mongoose.model('CareerSeekerProfile', CareerSeekerProfileSchema);
  }
  return CareerSeekerProfile;
}

// ── Text extractor ─────────────────────────────────────────────────────────
async function extractText(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.pdf') {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js' as any)).default;
    const data = await pdfParse(buffer);
    return data.text || '';
  }

  if (ext === '.docx' || ext === '.doc') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  return buffer.toString('utf8');
}

// ── Section header patterns ────────────────────────────────────────────────
function findSection(text: string, headers: string[]): string {
  const escaped = headers.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    `(?:^|\\n)\\s*(?:${escaped.join('|')})\\s*[:\\-]?\\s*(?:\\n|$)([\\s\\S]*?)(?=\\n\\s*(?:${SECTION_HEADERS_JOINED})|$)`,
    'im'
  );
  const m = text.match(pattern);
  return m ? m[1].trim() : '';
}

const ALL_SECTION_HEADERS = [
  'summary', 'objective', 'profile', 'about', 'introduction',
  'skills', 'technical skills', 'core skills', 'key skills', 'competencies', 'expertise',
  'education', 'academic', 'qualifications',
  'experience', 'work experience', 'professional experience', 'employment', 'career history',
  'certifications', 'certificates', 'credentials', 'courses',
  'projects', 'project experience',
  'achievements', 'awards', 'honors', 'accomplishments',
  'languages', 'language proficiency',
  'interests', 'hobbies',
  'references',
];

const SECTION_HEADERS_JOINED = ALL_SECTION_HEADERS
  .map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

// ── Personal info extractor ────────────────────────────────────────────────
function extractPersonal(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 15);

  const emailRx   = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
  const phoneRx   = /(?:\+91[-\s]?)?[6-9]\d{9}|(?:\+\d{1,3}[-\s]?)?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}/;
  const linkedinRx= /linkedin\.com\/in\/[\w\-]+/i;
  const githubRx  = /github\.com\/[\w\-]+/i;
  const websiteRx = /https?:\/\/(?!linkedin|github)[\w\-]+\.[\w\-]+/i;

  const email    = text.match(emailRx)?.[0] || '';
  const phone    = text.match(phoneRx)?.[0] || '';
  const linkedin = text.match(linkedinRx)?.[0] || '';
  const github   = text.match(githubRx)?.[0] || '';
  const website  = text.match(websiteRx)?.[0] || '';

  // Location: look for city, state patterns
  const locationRx = /(?:^|\n)\s*([A-Z][a-z]+(?:[\s,]+[A-Z][a-z]+){0,3}(?:,\s*(?:India|USA|UK|Canada|Australia|UAE))?)(?:\s*[-|·]|$)/m;
  const location = text.match(locationRx)?.[1]?.trim() || '';

  // Name: usually the first non-empty line that is capitalised words without numbers
  const nameRx = /^[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,3}$/;
  const name = lines.find(l => nameRx.test(l) && !emailRx.test(l) && !phoneRx.test(l)) || '';

  return { name, email, phone, location, linkedin, github, website, portfolio: '' };
}

// ── Skills extractor ───────────────────────────────────────────────────────
function extractSkills(section: string) {
  if (!section) return { technical: [], soft: [], tools: [], languages: [] };

  const TECH_KEYWORDS = new Set([
    'javascript','typescript','python','java','c++','c#','go','rust','ruby','php','swift','kotlin',
    'react','angular','vue','node','express','django','flask','spring','laravel',
    'sql','mysql','postgresql','mongodb','redis','firebase',
    'aws','azure','gcp','docker','kubernetes','terraform','ci/cd','git','linux',
    'machine learning','deep learning','nlp','data science','ai','ml',
    'html','css','rest','graphql','microservices','agile','scrum',
  ]);
  const SOFT_KEYWORDS = new Set([
    'communication','leadership','teamwork','problem solving','analytical','creative',
    'adaptable','time management','critical thinking','collaboration','detail-oriented',
    'self-motivated','empathy','conflict resolution','decision making',
  ]);
  const TOOL_KEYWORDS = new Set([
    'excel','powerpoint','word','figma','sketch','photoshop','illustrator','tableau','power bi',
    'jira','confluence','slack','notion','vs code','intellij','eclipse','postman','github','gitlab',
  ]);
  const LANG_KEYWORDS = new Set([
    'english','hindi','tamil','telugu','kannada','malayalam','marathi','bengali','gujarati',
    'french','german','spanish','japanese','chinese','arabic',
  ]);

  const raw = section.replace(/[•\-–—*|►▪◦]/g, ',').split(/[,\n;\/]/).map(s => s.trim().toLowerCase()).filter(s => s.length > 1 && s.length < 40);

  const technical: string[] = [];
  const soft: string[] = [];
  const tools: string[] = [];
  const languages: string[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (seen.has(item)) continue;
    seen.add(item);
    if (LANG_KEYWORDS.has(item)) { languages.push(toTitle(item)); continue; }
    if (TOOL_KEYWORDS.has(item))  { tools.push(toTitle(item)); continue; }
    if (SOFT_KEYWORDS.has(item))  { soft.push(toTitle(item)); continue; }
    if (TECH_KEYWORDS.has(item) || /\b(js|ts|css|html|api|sdk|orm|ml|ai)\b/i.test(item)) { technical.push(item.toUpperCase().length <= 6 ? item.toUpperCase() : toTitle(item)); continue; }
    if (item.split(' ').length <= 3) technical.push(toTitle(item));
  }

  return {
    technical: [...new Set(technical)].slice(0, 30),
    soft:      [...new Set(soft)].slice(0, 15),
    tools:     [...new Set(tools)].slice(0, 20),
    languages: [...new Set(languages)].slice(0, 10),
  };
}

// ── Education extractor ─────────────────────────────────────────────────────
function extractEducation(section: string) {
  if (!section) return [];
  const entries: any[] = [];
  const blocks = section.split(/\n{2,}|(?=\b(?:B\.?Tech|M\.?Tech|B\.?E|M\.?E|B\.?Sc|M\.?Sc|MBA|BBA|B\.?Com|M\.?Com|PhD|Bachelor|Master|Diploma|Class\s*X|Class\s*XII|SSLC|HSC|SSC)\b)/i);

  const yearRx   = /\b(19|20)\d{2}\b/g;
  const gradeRx  = /\b(?:cgpa|gpa|percentage|grade)\s*[:\-]?\s*([\d.]+\s*(?:%|\/10|\/100)?)/i;
  const degreeRx = /\b(B\.?Tech|M\.?Tech|B\.?E|M\.?E|B\.?Sc|M\.?Sc|MBA|BBA|B\.?Com|M\.?Com|PhD|Bachelor[^\n,]*|Master[^\n,]*|Diploma[^\n,]*|Class\s*X{1,2}I?|SSLC|HSC|SSC)\b/i;

  for (const block of blocks) {
    const t = block.trim();
    if (!t) continue;
    const years = [...t.matchAll(yearRx)].map(m => m[0]);
    const degree = t.match(degreeRx)?.[0] || '';
    if (!degree && years.length === 0) continue;

    const lines = t.split('\n').map(l => l.trim()).filter(Boolean);
    const institution = lines.find(l => /university|college|institute|school|academy|iit|nit|bits|iim/i.test(l)) || lines[0] || '';
    const grade = t.match(gradeRx)?.[1] || '';

    entries.push({
      institution: institution.slice(0, 100),
      degree: degree.slice(0, 80),
      field: '',
      startYear: years[0] || '',
      endYear:   years[1] || years[0] || '',
      grade,
    });
  }
  return entries.slice(0, 6);
}

// ── Experience extractor ────────────────────────────────────────────────────
function extractExperience(section: string) {
  if (!section) return [];
  const entries: any[] = [];
  const dateRx = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|(?:19|20)\d{2}/gi;
  const currentRx = /(?:present|current|till date|ongoing)/i;

  const blocks = section.split(/\n{2,}/);
  for (const block of blocks) {
    const t = block.trim();
    if (!t || t.length < 20) continue;
    const lines = t.split('\n').map(l => l.trim()).filter(Boolean);
    const dates  = t.match(dateRx) || [];
    const isCurrent = currentRx.test(t);

    const role = lines[0] || '';
    const company = lines[1] || '';
    const description = lines.slice(2).join(' ').replace(/\s+/g, ' ').slice(0, 400);

    if (!role && !company) continue;

    entries.push({
      company: company.slice(0, 100),
      role:    role.slice(0, 100),
      startDate: dates[0] || '',
      endDate:   isCurrent ? 'Present' : (dates[1] || ''),
      description: description,
      isCurrent,
    });
  }
  return entries.slice(0, 10);
}

// ── Certifications extractor ────────────────────────────────────────────────
function extractCertifications(section: string) {
  if (!section) return [];
  const yearRx = /\b(19|20)\d{2}\b/;
  return section
    .split(/\n|[•\-–—*►▪]/)
    .map(l => l.trim())
    .filter(l => l.length > 5)
    .map(l => {
      const year = l.match(yearRx)?.[0] || '';
      const issuerM = l.match(/(?:by|from|–|-)\s*([A-Z][^\n,]{2,30})/i);
      const name = l.replace(yearRx, '').replace(/(?:by|from|–|-)\s*[A-Z][^\n,]{2,30}/i, '').trim();
      return { name: name.slice(0, 120), issuer: issuerM?.[1] || '', year };
    })
    .filter(c => c.name.length > 3)
    .slice(0, 15);
}

// ── Projects extractor ──────────────────────────────────────────────────────
function extractProjects(section: string) {
  if (!section) return [];
  const urlRx = /https?:\/\/[^\s]+/i;
  const blocks = section.split(/\n{2,}/);

  return blocks
    .filter(b => b.trim().length > 10)
    .map(b => {
      const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
      const name = lines[0] || '';
      const url  = b.match(urlRx)?.[0] || '';
      const desc = lines.slice(1).join(' ').replace(/\s+/g, ' ').slice(0, 300);
      const techM = b.match(/(?:tech(?:nologies|nology|stack)?|built with|using)[:\s]+([^\n]{5,80})/i);
      const tech = techM ? techM[1].split(/[,|\/]/).map(t => t.trim()).filter(Boolean) : [];
      return { name: name.slice(0, 80), description: desc, tech, url };
    })
    .filter(p => p.name.length > 2)
    .slice(0, 8);
}

// ── Achievements extractor ──────────────────────────────────────────────────
function extractAchievements(section: string) {
  if (!section) return [];
  return section
    .split(/\n|[•\-–—*►▪]/)
    .map(l => l.trim())
    .filter(l => l.length > 8)
    .slice(0, 10);
}

// ── Spoken languages extractor ──────────────────────────────────────────────
function extractSpokenLanguages(text: string) {
  const LANGUAGES = ['english','hindi','tamil','telugu','kannada','malayalam','marathi','bengali','gujarati','punjabi','odia','french','german','spanish','japanese','chinese','arabic','portuguese'];
  const found: string[] = [];
  for (const lang of LANGUAGES) {
    if (new RegExp(`\\b${lang}\\b`, 'i').test(text)) found.push(toTitle(lang));
  }
  return found;
}

// ── Summary extractor ───────────────────────────────────────────────────────
function extractSummary(section: string, fallbackText: string): string {
  if (section && section.length > 20) return section.slice(0, 600);
  const lines = fallbackText.split('\n').filter(l => l.trim().length > 40);
  return lines[0]?.slice(0, 400) || '';
}

// ── Completeness score ──────────────────────────────────────────────────────
function computeCompleteness(profile: any) {
  const sections: Record<string, boolean> = {
    personal:       !!(profile.personal?.name || profile.personal?.email),
    summary:        !!(profile.summary?.length > 20),
    skills:         profile.skills?.technical?.length > 0,
    education:      profile.education?.length > 0,
    experience:     profile.experience?.length > 0,
    certifications: profile.certifications?.length > 0,
    projects:       profile.projects?.length > 0,
    achievements:   profile.achievements?.length > 0,
    languages:      profile.spokenLanguages?.length > 0,
  };
  const filled = Object.entries(sections).filter(([, v]) => v).map(([k]) => k);
  const completeness = Math.round((filled.length / Object.keys(sections).length) * 100);
  return { completeness, sectionsFilled: filled };
}

// ── Util ────────────────────────────────────────────────────────────────────
function toTitle(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── POST /api/cv/parse ──────────────────────────────────────────────────────
router.post('/parse', upload.single('cv'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const rawText = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);

    if (!rawText || rawText.trim().length < 50) {
      res.status(422).json({ message: 'Could not extract readable text from file. Ensure it is not a scanned image PDF.' });
      return;
    }

    const personal        = extractPersonal(rawText);
    const summarySection  = findSection(rawText, ['summary', 'objective', 'profile', 'about me', 'professional summary', 'career objective', 'introduction']);
    const skillsSection   = findSection(rawText, ['skills', 'technical skills', 'core skills', 'key skills', 'competencies', 'expertise', 'technologies']);
    const educationSection= findSection(rawText, ['education', 'academic background', 'qualifications', 'academic qualifications']);
    const experienceSection=findSection(rawText, ['experience', 'work experience', 'professional experience', 'employment history', 'career history', 'work history']);
    const certSection     = findSection(rawText, ['certifications', 'certificates', 'credentials', 'courses', 'training', 'professional development']);
    const projectSection  = findSection(rawText, ['projects', 'project experience', 'side projects', 'personal projects', 'key projects']);
    const achievementSection = findSection(rawText, ['achievements', 'awards', 'honors', 'accomplishments', 'recognition']);
    const languageSection = findSection(rawText, ['languages', 'language proficiency', 'language skills']);

    const skills         = extractSkills(skillsSection);
    const education      = extractEducation(educationSection);
    const experience     = extractExperience(experienceSection);
    const certifications = extractCertifications(certSection);
    const projects       = extractProjects(projectSection);
    const achievements   = extractAchievements(achievementSection);
    const spokenLanguages= extractSpokenLanguages(languageSection || rawText);
    const summary        = extractSummary(summarySection, rawText);

    const profile = {
      personal,
      summary,
      skills,
      education,
      experience,
      certifications,
      projects,
      achievements,
      spokenLanguages,
    };

    const competencyProfile = computeCompleteness(profile);

    res.json({
      success: true,
      rawTextLength: rawText.length,
      profile: { ...profile, competencyProfile },
    });
  } catch (err: any) {
    console.error('[CV Parse]', err?.message);
    res.status(500).json({ message: 'CV parsing failed. ' + (err?.message || '') });
  }
});

// ── POST /api/cv/save-profile  (called after successful registration) ────────
router.post('/save-profile', async (req: Request, res: Response) => {
  try {
    const { userId, email, profile } = req.body as { userId: string; email: string; profile: any };
    if (!userId || !profile) {
      res.status(400).json({ message: 'userId and profile are required' });
      return;
    }

    const Model = await getModel();
    const competencyProfile = computeCompleteness(profile);
    const doc = await Model.findOneAndUpdate(
      { userId },
      { $set: { userId, email, ...profile, competencyProfile, parsedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, profileId: doc._id, completeness: competencyProfile.completeness });
  } catch (err: any) {
    console.error('[CV Save Profile]', err?.message);
    res.status(500).json({ message: 'Failed to save profile' });
  }
});

// ── Empty profile skeleton ───────────────────────────────────────────────────
function emptyProfileSkeleton(userId: string, email = '', name = '') {
  return {
    userId,
    email,           // root-level record key — NOT copied into personal so completeness stays 0
    exists: false,
    personal: { name, email: '', phone: '', location: '', linkedin: '', github: '', website: '', portfolio: '' },
    summary: '',
    skills: { technical: [], soft: [], tools: [], languages: [] },
    education: [],
    experience: [],
    certifications: [],
    projects: [],
    achievements: [],
    spokenLanguages: [],
    competencyProfile: { completeness: 0, sectionsFilled: [] },
  };
}

// ── GET /api/cv/profile/:userId ──────────────────────────────────────────────
router.get('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const Model = await getModel();
    const doc = await Model.findOne({ userId: req.params.userId }).lean();
    if (!doc) {
      res.json({ success: true, profile: emptyProfileSkeleton(req.params.userId), exists: false });
      return;
    }
    res.json({ success: true, profile: { ...doc, exists: true }, exists: true });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// ── POST /api/cv/init-profile  (create blank profile for manual entry) ───────
router.post('/init-profile', async (req: Request, res: Response) => {
  try {
    const { userId, email, name } = req.body as { userId: string; email?: string; name?: string };
    if (!userId) { res.status(400).json({ message: 'userId is required' }); return; }
    const Model = await getModel();
    const existing = await Model.findOne({ userId }).lean();
    if (existing) {
      res.json({ success: true, profile: { ...existing, exists: true }, created: false });
      return;
    }
    const skeleton = emptyProfileSkeleton(userId, email || '', name || '');
    const competencyProfile = computeCompleteness(skeleton);
    const doc = await Model.create({ ...skeleton, competencyProfile });
    res.json({ success: true, profile: { ...doc.toObject(), exists: true }, created: true });
  } catch (err: any) {
    console.error('[CV Init Profile]', err?.message);
    res.status(500).json({ message: 'Failed to initialise profile' });
  }
});

// ── PUT /api/cv/profile/:userId  (upsert + recompute completeness) ────────────
router.put('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updates = req.body as Record<string, any>;
    const Model = await getModel();

    const existing = await Model.findOne({ userId }).lean() as Record<string, any> | null;
    const merged = { ...(existing || emptyProfileSkeleton(userId)), ...updates, userId };
    const competencyProfile = computeCompleteness(merged);

    const doc = await Model.findOneAndUpdate(
      { userId },
      { $set: { ...updates, competencyProfile, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, profile: { ...doc.toObject(), exists: true } });
  } catch (err: any) {
    console.error('[CV Update Profile]', err?.message);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// ── Job Applications Mongoose schema ─────────────────────────────────────────
const JobApplicationSchema = new Schema({
  userId:      { type: String, required: true, index: true },
  company:     { type: String, required: true },
  role:        { type: String, required: true },
  location:    { type: String, default: '' },
  type:        { type: String, default: 'Full-time' },
  salary:      { type: String, default: '' },
  source:      { type: String, default: '' },
  status:      { type: String, default: 'Wishlist', enum: ['Wishlist','Applied','Screening','Interview','Assessment','Offer','Accepted','Rejected'] },
  appliedDate: { type: String, default: '' },
  deadline:    { type: String, default: '' },
  notes:       { type: String, default: '' },
  contactName: { type: String, default: '' },
  contactEmail:{ type: String, default: '' },
  url:         { type: String, default: '' },
  matchScore:  { type: Number, default: 0 },
}, { timestamps: true });

let JobApplicationModel: mongoose.Model<any>;
async function getJobModel() {
  await connectMongo();
  if (!JobApplicationModel) {
    JobApplicationModel = mongoose.models.JobApplication
      || mongoose.model('JobApplication', JobApplicationSchema);
  }
  return JobApplicationModel;
}

// ── Career Goals Mongoose schema ──────────────────────────────────────────────
const CareerGoalSchema = new Schema({
  userId:      { type: String, required: true, index: true },
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  category:    { type: String, default: 'Skill', enum: ['Skill','Certification','Role','Network','Other'] },
  targetDate:  { type: String, default: '' },
  completed:   { type: Boolean, default: false },
  completedAt: { type: Date },
  priority:    { type: String, default: 'Medium', enum: ['High','Medium','Low'] },
}, { timestamps: true });

let CareerGoalModel: mongoose.Model<any>;
async function getGoalModel() {
  await connectMongo();
  if (!CareerGoalModel) {
    CareerGoalModel = mongoose.models.CareerGoal
      || mongoose.model('CareerGoal', CareerGoalSchema);
  }
  return CareerGoalModel;
}

// ── Job Applications CRUD ─────────────────────────────────────────────────────
router.get('/jobs/:userId', async (req: Request, res: Response) => {
  try {
    const M = await getJobModel();
    const jobs = await M.find({ userId: req.params.userId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, jobs });
  } catch { res.status(500).json({ message: 'Failed to fetch jobs' }); }
});

router.post('/jobs', async (req: Request, res: Response) => {
  try {
    const M = await getJobModel();
    const job = await M.create(req.body);
    res.json({ success: true, job });
  } catch { res.status(500).json({ message: 'Failed to create job application' }); }
});

router.put('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const M = await getJobModel();
    const job = await M.findByIdAndUpdate(req.params.jobId, { $set: req.body }, { new: true });
    if (!job) { res.status(404).json({ message: 'Not found' }); return; }
    res.json({ success: true, job });
  } catch { res.status(500).json({ message: 'Failed to update job application' }); }
});

router.delete('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const M = await getJobModel();
    await M.findByIdAndDelete(req.params.jobId);
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Failed to delete job application' }); }
});

// ── Career Goals CRUD ─────────────────────────────────────────────────────────
router.get('/goals/:userId', async (req: Request, res: Response) => {
  try {
    const M = await getGoalModel();
    const goals = await M.find({ userId: req.params.userId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, goals });
  } catch { res.status(500).json({ message: 'Failed to fetch goals' }); }
});

router.post('/goals', async (req: Request, res: Response) => {
  try {
    const M = await getGoalModel();
    const goal = await M.create(req.body);
    res.json({ success: true, goal });
  } catch { res.status(500).json({ message: 'Failed to create goal' }); }
});

router.put('/goals/:goalId', async (req: Request, res: Response) => {
  try {
    const M = await getGoalModel();
    const updates: any = { ...req.body };
    if (updates.completed === true && !updates.completedAt) updates.completedAt = new Date();
    const goal = await M.findByIdAndUpdate(req.params.goalId, { $set: updates }, { new: true });
    if (!goal) { res.status(404).json({ message: 'Not found' }); return; }
    res.json({ success: true, goal });
  } catch { res.status(500).json({ message: 'Failed to update goal' }); }
});

router.delete('/goals/:goalId', async (req: Request, res: Response) => {
  try {
    const M = await getGoalModel();
    await M.findByIdAndDelete(req.params.goalId);
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Failed to delete goal' }); }
});

export default router;
