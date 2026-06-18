import { Router, Request, Response } from 'express';
import mongoose, { Schema } from 'mongoose';
import { connectMongo } from '../db/mongo.js';

const router = Router();

// ── Helper: auth from JWT (no hard requireAuth so portal is demo-accessible) ─
function getRequesterId(req: Request): string {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.id || payload.userId || 'anonymous';
  } catch { return 'anonymous'; }
}

// ═══════════════════════════════ SCHEMAS ═══════════════════════════════════

// Company Profile
const CompanyProfileSchema = new Schema({
  ownerId:       { type: String, required: true, unique: true },
  name:          { type: String, default: '' },
  industry:      { type: String, default: '' },
  size:          { type: String, default: '' },
  website:       { type: String, default: '' },
  linkedin:      { type: String, default: '' },
  location:      { type: String, default: '' },
  logo:          { type: String, default: '' },
  about:         { type: String, default: '' },
  culture:       { type: String, default: '' },
  benefits:      [String],
  techStack:     [String],
  values:        [String],
  verified:      { type: Boolean, default: false },
}, { timestamps: true });

// Employer Job
const EmployerJobSchema = new Schema({
  ownerId:        { type: String, required: true, index: true },
  title:          { type: String, required: true },
  department:     { type: String, default: '' },
  location:       { type: String, default: '' },
  type:           { type: String, default: 'Full-time', enum: ['Full-time','Part-time','Contract','Internship','Remote','Hybrid'] },
  workMode:       { type: String, default: 'On-site', enum: ['On-site','Remote','Hybrid'] },
  experience:     { type: String, default: '' },
  salary:         { type: String, default: '' },
  description:    { type: String, default: '' },
  requirements:   [String],
  responsibilities: [String],
  skills:         [String],
  perks:          [String],
  status:         { type: String, default: 'Draft', enum: ['Draft','Active','Paused','Closed'] },
  deadline:       { type: String, default: '' },
  hiringManager:  { type: String, default: '' },
  quota:          { type: Number, default: 1 },
  eiMinScore:     { type: Number, default: 0 },
  applicationCount: { type: Number, default: 0 },
}, { timestamps: true });

// Candidate (employer-side view)
const EmployerCandidateSchema = new Schema({
  ownerId:       { type: String, required: true, index: true },
  jobId:         { type: String, required: true, index: true },
  jobTitle:      { type: String, default: '' },
  name:          { type: String, required: true },
  email:         { type: String, default: '' },
  phone:         { type: String, default: '' },
  location:      { type: String, default: '' },
  currentRole:   { type: String, default: '' },
  experience:    { type: String, default: '' },
  skills:        [String],
  education:     { type: String, default: '' },
  eiScore:       { type: Number, default: 0 },
  matchScore:    { type: Number, default: 0 },
  source:        { type: String, default: 'Direct' },
  stage:         { type: String, default: 'Applied', enum: ['Applied','Screened','Interview','Assessment','Offer','Hired','Rejected'] },
  notes:         { type: String, default: '' },
  rating:        { type: Number, default: 0 },
  resumeUrl:     { type: String, default: '' },
  linkedinUrl:   { type: String, default: '' },
  appliedDate:   { type: String, default: '' },
  interviewDate: { type: String, default: '' },
  offerAmount:   { type: String, default: '' },
  tags:          [String],
  assessmentSent: { type: Boolean, default: false },
  assessmentScore: { type: Number, default: 0 },
  pooled:        { type: Boolean, default: false },
}, { timestamps: true });

// Interview
const EmployerInterviewSchema = new Schema({
  ownerId:       { type: String, required: true, index: true },
  candidateId:   { type: String, required: true },
  candidateName: { type: String, default: '' },
  jobId:         { type: String, default: '' },
  jobTitle:      { type: String, default: '' },
  type:          { type: String, default: 'Video', enum: ['Video','Phone','In-person','Technical','Panel'] },
  date:          { type: String, default: '' },
  time:          { type: String, default: '' },
  duration:      { type: String, default: '60 min' },
  interviewers:  [String],
  meetingLink:   { type: String, default: '' },
  status:        { type: String, default: 'Scheduled', enum: ['Scheduled','Completed','Cancelled','No-show'] },
  feedback:      { type: String, default: '' },
  rating:        { type: Number, default: 0 },
  recommendation: { type: String, default: '', enum: ['','Hire','No Hire','Hold'] },
}, { timestamps: true });

// Offer
const EmployerOfferSchema = new Schema({
  ownerId:        { type: String, required: true, index: true },
  candidateId:    { type: String, required: true },
  candidateName:  { type: String, default: '' },
  jobId:          { type: String, default: '' },
  jobTitle:       { type: String, default: '' },
  ctcFixed:       { type: Number, default: 0 },
  ctcVariable:    { type: Number, default: 0 },
  ctcBonus:       { type: Number, default: 0 },
  totalCTC:       { type: Number, default: 0 },
  joiningDate:    { type: String, default: '' },
  validity:       { type: String, default: '' },
  currency:       { type: String, default: 'INR' },
  status:         { type: String, default: 'Draft', enum: ['Draft','Sent','Negotiating','Accepted','Declined','Expired','Withdrawn'] },
  notes:          { type: String, default: '' },
  counterAmount:  { type: Number, default: 0 },
  counterNotes:   { type: String, default: '' },
  offerLetterUrl: { type: String, default: '' },
}, { timestamps: true });

// Reference Check
const ReferenceCheckSchema = new Schema({
  ownerId:       { type: String, required: true, index: true },
  candidateId:   { type: String, required: true, index: true },
  refName:       { type: String, default: '' },
  refTitle:      { type: String, default: '' },
  refCompany:    { type: String, default: '' },
  refEmail:      { type: String, default: '' },
  refPhone:      { type: String, default: '' },
  relationship:  { type: String, default: '' },
  status:        { type: String, default: 'Not Started', enum: ['Not Started','Requested','In Progress','Completed','Declined'] },
  outcome:       { type: String, default: '' },
  notes:         { type: String, default: '' },
}, { timestamps: true });

// Activity Log
const ActivityLogSchema = new Schema({
  ownerId:      { type: String, required: true, index: true },
  candidateId:  { type: String, required: true, index: true },
  type:         { type: String, default: 'Note', enum: ['Note','Email','Call','WhatsApp','StageChange','Interview','Assessment','Offer','SMS'] },
  title:        { type: String, default: '' },
  description:  { type: String, default: '' },
  by:           { type: String, default: '' },
}, { timestamps: true });

// ── Model getters ─────────────────────────────────────────────────────────────
async function getModel(name: string, schema: Schema) {
  await connectMongo();
  return mongoose.models[name] || mongoose.model(name, schema);
}
const getCompanyModel      = () => getModel('EmployerCompany',      CompanyProfileSchema);
const getJobModel          = () => getModel('EmployerJob',          EmployerJobSchema);
const getCandidateModel    = () => getModel('EmployerCandidate',    EmployerCandidateSchema);
const getInterviewModel    = () => getModel('EmployerInterview',    EmployerInterviewSchema);
const getOfferModel        = () => getModel('EmployerOffer',        EmployerOfferSchema);
const getRefCheckModel     = () => getModel('EmployerRefCheck',     ReferenceCheckSchema);
const getActivityLogModel  = () => getModel('EmployerActivityLog',  ActivityLogSchema);

// ═══════════════════════════════ COMPANY PROFILE ═══════════════════════════

router.get('/company', async (req: Request, res: Response) => {
  const id = getRequesterId(req);
  try {
    const M = await getCompanyModel();
    const doc = await M.findOne({ ownerId: id }).lean();
    res.json({ success: true, company: doc || {} });
  } catch { res.status(500).json({ message: 'Failed to fetch company profile' }); }
});

router.put('/company', async (req: Request, res: Response) => {
  const id = getRequesterId(req);
  try {
    const M = await getCompanyModel();
    const doc = await M.findOneAndUpdate(
      { ownerId: id },
      { $set: { ...req.body, ownerId: id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, company: doc });
  } catch { res.status(500).json({ message: 'Failed to save company profile' }); }
});

// ═══════════════════════════════ JOB POSTINGS ══════════════════════════════

router.get('/jobs', async (req: Request, res: Response) => {
  const id = getRequesterId(req);
  try {
    const M = await getJobModel();
    const jobs = await M.find({ ownerId: id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, jobs });
  } catch { res.status(500).json({ message: 'Failed to fetch jobs' }); }
});

router.post('/jobs', async (req: Request, res: Response) => {
  const id = getRequesterId(req);
  try {
    const M = await getJobModel();
    const job = await M.create({ ...req.body, ownerId: id });
    res.json({ success: true, job });
  } catch { res.status(500).json({ message: 'Failed to create job' }); }
});

router.put('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const M = await getJobModel();
    const job = await M.findByIdAndUpdate(req.params.jobId, { $set: req.body }, { new: true });
    if (!job) { res.status(404).json({ message: 'Not found' }); return; }
    res.json({ success: true, job });
  } catch { res.status(500).json({ message: 'Failed to update job' }); }
});

router.delete('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const M = await getJobModel();
    await M.findByIdAndDelete(req.params.jobId);
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Failed to delete job' }); }
});

// ═══════════════════════════════ CANDIDATES ════════════════════════════════

router.get('/candidates', async (req: Request, res: Response) => {
  const id = getRequesterId(req);
  try {
    const M = await getCandidateModel();
    const { jobId, stage, pooled } = req.query as Record<string, string>;
    const filter: Record<string, any> = { ownerId: id };
    if (jobId)  filter.jobId = jobId;
    if (stage)  filter.stage = stage;
    if (pooled === 'true') filter.pooled = true;
    const candidates = await M.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, candidates });
  } catch { res.status(500).json({ message: 'Failed to fetch candidates' }); }
});

router.post('/candidates', async (req: Request, res: Response) => {
  const id = getRequesterId(req);
  try {
    const M = await getCandidateModel();
    const candidate = await M.create({ ...req.body, ownerId: id });
    res.json({ success: true, candidate });
  } catch { res.status(500).json({ message: 'Failed to create candidate' }); }
});

router.put('/candidates/:candidateId', async (req: Request, res: Response) => {
  try {
    const M = await getCandidateModel();
    const candidate = await M.findByIdAndUpdate(
      req.params.candidateId, { $set: req.body }, { new: true }
    );
    if (!candidate) { res.status(404).json({ message: 'Not found' }); return; }
    res.json({ success: true, candidate });
  } catch { res.status(500).json({ message: 'Failed to update candidate' }); }
});

router.delete('/candidates/:candidateId', async (req: Request, res: Response) => {
  try {
    const M = await getCandidateModel();
    await M.findByIdAndDelete(req.params.candidateId);
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Failed to delete candidate' }); }
});

// Send MetryxOne assessment to candidate
router.post('/candidates/:candidateId/send-assessment', async (req: Request, res: Response) => {
  try {
    const M = await getCandidateModel();
    const candidate = await M.findByIdAndUpdate(
      req.params.candidateId,
      { $set: { assessmentSent: true } },
      { new: true }
    );
    if (!candidate) { res.status(404).json({ message: 'Not found' }); return; }
    res.json({ success: true, message: `Assessment invitation sent to ${candidate.email}`, candidate });
  } catch { res.status(500).json({ message: 'Failed to send assessment' }); }
});

// Toggle talent pool
router.post('/candidates/:candidateId/pool', async (req: Request, res: Response) => {
  try {
    const M = await getCandidateModel();
    const c = await M.findById(req.params.candidateId);
    if (!c) { res.status(404).json({ message: 'Not found' }); return; }
    c.pooled = !c.pooled;
    await c.save();
    res.json({ success: true, pooled: c.pooled, candidate: c });
  } catch { res.status(500).json({ message: 'Failed to update pool' }); }
});

// ═══════════════════════════════ INTERVIEWS ════════════════════════════════

router.get('/interviews', async (req: Request, res: Response) => {
  const id = getRequesterId(req);
  try {
    const M = await getInterviewModel();
    const interviews = await M.find({ ownerId: id }).sort({ date: 1 }).lean();
    res.json({ success: true, interviews });
  } catch { res.status(500).json({ message: 'Failed to fetch interviews' }); }
});

router.post('/interviews', async (req: Request, res: Response) => {
  const id = getRequesterId(req);
  try {
    const M = await getInterviewModel();
    const interview = await M.create({ ...req.body, ownerId: id });
    res.json({ success: true, interview });
  } catch { res.status(500).json({ message: 'Failed to schedule interview' }); }
});

router.put('/interviews/:id', async (req: Request, res: Response) => {
  try {
    const M = await getInterviewModel();
    const interview = await M.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!interview) { res.status(404).json({ message: 'Not found' }); return; }
    res.json({ success: true, interview });
  } catch { res.status(500).json({ message: 'Failed to update interview' }); }
});

router.delete('/interviews/:id', async (req: Request, res: Response) => {
  try {
    const M = await getInterviewModel();
    await M.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Failed to delete interview' }); }
});

// ═══════════════════════════════ OFFERS ════════════════════════════════════

router.get('/offers', async (req: Request, res: Response) => {
  const id = getRequesterId(req);
  try {
    const M = await getOfferModel();
    const offers = await M.find({ ownerId: id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, offers });
  } catch { res.status(500).json({ message: 'Failed to fetch offers' }); }
});

router.post('/offers', async (req: Request, res: Response) => {
  const id = getRequesterId(req);
  try {
    const M = await getOfferModel();
    const total = (Number(req.body.ctcFixed) || 0) + (Number(req.body.ctcVariable) || 0) + (Number(req.body.ctcBonus) || 0);
    const offer = await M.create({ ...req.body, ownerId: id, totalCTC: total });
    res.json({ success: true, offer });
  } catch { res.status(500).json({ message: 'Failed to create offer' }); }
});

router.put('/offers/:id', async (req: Request, res: Response) => {
  const ownerId = getRequesterId(req);
  try {
    const M = await getOfferModel();
    const body = { ...req.body };
    if (body.ctcFixed !== undefined || body.ctcVariable !== undefined || body.ctcBonus !== undefined) {
      const existing: any = await M.findOne({ _id: req.params.id, ownerId }).lean();
      if (existing) {
        body.totalCTC = (Number(body.ctcFixed ?? existing.ctcFixed) || 0)
          + (Number(body.ctcVariable ?? existing.ctcVariable) || 0)
          + (Number(body.ctcBonus ?? existing.ctcBonus) || 0);
      }
    }
    const offer = await M.findOneAndUpdate({ _id: req.params.id, ownerId }, body, { new: true });
    res.json({ success: true, offer });
  } catch { res.status(500).json({ message: 'Failed to update offer' }); }
});

router.delete('/offers/:id', async (req: Request, res: Response) => {
  const ownerId = getRequesterId(req);
  try {
    const M = await getOfferModel();
    await M.deleteOne({ _id: req.params.id, ownerId });
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Failed to delete offer' }); }
});

// ═══════════════════════════════ REFERENCE CHECKS ══════════════════════════

router.get('/ref-checks/:candidateId', async (req: Request, res: Response) => {
  const ownerId = getRequesterId(req);
  try {
    const M = await getRefCheckModel();
    const checks = await M.find({ ownerId, candidateId: req.params.candidateId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, checks });
  } catch { res.status(500).json({ message: 'Failed to fetch ref checks' }); }
});

router.post('/ref-checks', async (req: Request, res: Response) => {
  const ownerId = getRequesterId(req);
  try {
    const M = await getRefCheckModel();
    const check = await M.create({ ...req.body, ownerId });
    res.json({ success: true, check });
  } catch { res.status(500).json({ message: 'Failed to create ref check' }); }
});

router.put('/ref-checks/:id', async (req: Request, res: Response) => {
  const ownerId = getRequesterId(req);
  try {
    const M = await getRefCheckModel();
    const check = await M.findOneAndUpdate({ _id: req.params.id, ownerId }, req.body, { new: true });
    res.json({ success: true, check });
  } catch { res.status(500).json({ message: 'Failed to update ref check' }); }
});

router.delete('/ref-checks/:id', async (req: Request, res: Response) => {
  const ownerId = getRequesterId(req);
  try {
    const M = await getRefCheckModel();
    await M.deleteOne({ _id: req.params.id, ownerId });
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Failed to delete ref check' }); }
});

// ═══════════════════════════════ ACTIVITY LOG ═══════════════════════════════

router.get('/activity/:candidateId', async (req: Request, res: Response) => {
  const ownerId = getRequesterId(req);
  try {
    const M = await getActivityLogModel();
    const logs = await M.find({ ownerId, candidateId: req.params.candidateId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, logs });
  } catch { res.status(500).json({ message: 'Failed to fetch activity log' }); }
});

router.post('/activity', async (req: Request, res: Response) => {
  const ownerId = getRequesterId(req);
  try {
    const M = await getActivityLogModel();
    const log = await M.create({ ...req.body, ownerId });
    res.json({ success: true, log });
  } catch { res.status(500).json({ message: 'Failed to log activity' }); }
});

// ═══════════════════════════════ ANALYTICS ═════════════════════════════════

router.get('/analytics', async (req: Request, res: Response) => {
  const id = getRequesterId(req);
  try {
    const [JobM, CandM] = await Promise.all([getJobModel(), getCandidateModel()]);
    const [jobs, candidates] = await Promise.all([
      JobM.find({ ownerId: id }).lean(),
      CandM.find({ ownerId: id }).lean(),
    ]);

    const totalJobs      = jobs.length;
    const activeJobs     = jobs.filter((j: any) => j.status === 'Active').length;
    const totalCandidates = candidates.length;
    const hired          = candidates.filter((c: any) => c.stage === 'Hired').length;
    const rejected       = candidates.filter((c: any) => c.stage === 'Rejected').length;
    const inInterview    = candidates.filter((c: any) => c.stage === 'Interview').length;
    const inOffer        = candidates.filter((c: any) => c.stage === 'Offer').length;
    const avgEI          = candidates.length
      ? Math.round(candidates.reduce((s: number, c: any) => s + (c.eiScore || 0), 0) / candidates.length)
      : 0;
    const avgMatch       = candidates.length
      ? Math.round(candidates.reduce((s: number, c: any) => s + (c.matchScore || 0), 0) / candidates.length)
      : 0;
    const offerRate      = inOffer + hired > 0 && totalCandidates > 0
      ? Math.round(((inOffer + hired) / totalCandidates) * 100) : 0;
    const hireRate       = totalCandidates > 0 ? Math.round((hired / totalCandidates) * 100) : 0;

    const stageBreakdown: Record<string, number> = {};
    const sourceBreakdown: Record<string, number> = {};
    for (const c of candidates as any[]) {
      stageBreakdown[c.stage] = (stageBreakdown[c.stage] || 0) + 1;
      sourceBreakdown[c.source || 'Direct'] = (sourceBreakdown[c.source || 'Direct'] || 0) + 1;
    }

    res.json({
      success: true,
      analytics: {
        totalJobs, activeJobs, totalCandidates, hired, rejected,
        inInterview, inOffer, avgEI, avgMatch, offerRate, hireRate,
        stageBreakdown, sourceBreakdown,
        conversionFunnel: [
          { stage: 'Applied',    count: totalCandidates },
          { stage: 'Screened',   count: stageBreakdown['Screened'] || 0 },
          { stage: 'Interview',  count: inInterview },
          { stage: 'Assessment', count: stageBreakdown['Assessment'] || 0 },
          { stage: 'Offer',      count: inOffer },
          { stage: 'Hired',      count: hired },
        ],
      },
    });
  } catch { res.status(500).json({ message: 'Failed to fetch analytics' }); }
});

export default router;
