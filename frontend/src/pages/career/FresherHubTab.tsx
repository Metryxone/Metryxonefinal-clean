import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect } from 'react';
import {
  GraduationCap, Building2, Code, BookOpen, CheckSquare, Square, Plus, X,
  Github, ExternalLink, ChevronDown, ChevronUp, Star, Trophy, Zap,
  Target, Users, AlertCircle, CheckCircle, Clock, ArrowRight, Sparkles,
  Briefcase, Brain, MessageSquare, TrendingUp, Flag, RotateCcw, Info,
  Edit3, Trash2, Award, Gauge
} from 'lucide-react';
import { Button } from '@/components/ui/button';



const LS_DRIVES   = 'mx-fresher-drives';
const LS_PROJECTS = 'mx-fresher-projects';
const LS_CHECKLIST = 'mx-fresher-checklist';

// ─── Types ───────────────────────────────────────────────────────────────────

type DriveStage = 'Registration' | 'Aptitude Test' | 'Technical Round' | 'Group Discussion' | 'HR Interview' | 'Offer' | 'Rejected';
type DriveStatus = 'Active' | 'Selected' | 'Rejected' | 'On Hold';
type ProjectType = 'Academic' | 'Personal' | 'Open Source' | 'Internship' | 'Hackathon';
type AptitudeCat = 'Quantitative' | 'Verbal' | 'Logical';
type FresherSubTab = 'readiness' | 'drives' | 'projects' | 'aptitude' | 'guide';

interface CampusDrive {
  id: string;
  company: string;
  role: string;
  ctc: string;
  driveDate: string;
  currentStage: DriveStage;
  status: DriveStatus;
  notes: string;
}

interface Project {
  id: string;
  title: string;
  description: string;
  techStack: string;
  githubUrl: string;
  demoUrl: string;
  type: ProjectType;
  featured: boolean;
}

// ─── Aptitude Question Bank ───────────────────────────────────────────────────

interface AptQuestion {
  id: number;
  category: AptitudeCat;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  topic: string;
}

const APTITUDE_BANK: AptQuestion[] = [
  // Quantitative
  { id: 1, category: 'Quantitative', topic: 'Percentages', question: 'If 40% of a number is 120, what is 25% of that number?', options: ['65', '70', '75', '80'], answer: 2, explanation: '40% of N = 120 → N = 300. 25% of 300 = 75.' },
  { id: 2, category: 'Quantitative', topic: 'Profit & Loss', question: 'A shopkeeper bought an item for ₹800 and sold it for ₹1000. What is the profit percentage?', options: ['20%', '25%', '30%', '15%'], answer: 1, explanation: 'Profit = 200, Profit% = (200/800)×100 = 25%.' },
  { id: 3, category: 'Quantitative', topic: 'Time & Speed', question: 'A train 300 m long passes a pole in 15 seconds. What is the speed of the train in km/h?', options: ['60', '72', '80', '54'], answer: 1, explanation: 'Speed = 300/15 = 20 m/s = 20×3.6 = 72 km/h.' },
  { id: 4, category: 'Quantitative', topic: 'Averages', question: 'The average of 5 numbers is 18. If one number is excluded, the average becomes 16. What is the excluded number?', options: ['22', '24', '26', '28'], answer: 2, explanation: 'Sum of 5 = 90. Sum of 4 = 64. Excluded = 90−64 = 26.' },
  { id: 5, category: 'Quantitative', topic: 'Simple Interest', question: 'What is the SI on ₹5000 at 8% per annum for 3 years?', options: ['₹1,000', '₹1,200', '₹1,500', '₹800'], answer: 1, explanation: 'SI = (P×R×T)/100 = (5000×8×3)/100 = ₹1200.' },
  { id: 6, category: 'Quantitative', topic: 'Ratio & Proportion', question: 'A:B = 3:4, B:C = 2:5. Find A:B:C.', options: ['3:4:10', '6:8:20', '3:8:10', '6:4:10'], answer: 0, explanation: 'A:B = 3:4, B:C = 2:5 → B common → A:B:C = 6:8:20 = 3:4:10.' },
  { id: 7, category: 'Quantitative', topic: 'Pipes & Cisterns', question: 'Pipe A fills a tank in 4 hours, Pipe B in 6 hours. How long to fill the tank together?', options: ['2.4 hrs', '2 hrs', '3 hrs', '1.5 hrs'], answer: 0, explanation: '1/4 + 1/6 = 5/12. Time = 12/5 = 2.4 hours.' },
  // Verbal
  { id: 8, category: 'Verbal', topic: 'Synonyms', question: 'Choose the synonym of "EPHEMERAL":', options: ['Permanent', 'Transitory', 'Eternal', 'Substantial'], answer: 1, explanation: 'Ephemeral means lasting for a very short time — synonym: Transitory.' },
  { id: 9, category: 'Verbal', topic: 'Antonyms', question: 'Choose the antonym of "VERBOSE":', options: ['Wordy', 'Lengthy', 'Concise', 'Elaborate'], answer: 2, explanation: 'Verbose means using too many words. Its antonym is Concise.' },
  { id: 10, category: 'Verbal', topic: 'Fill in the Blanks', question: 'The committee decided to _____ the meeting to next Monday.', options: ['cancel', 'postpone', 'advance', 'commence'], answer: 1, explanation: '"Postpone" means to arrange a later time, which fits the context.' },
  { id: 11, category: 'Verbal', topic: 'Sentence Correction', question: 'Identify the error: "He is one of the student who has passed the exam."', options: ['He is one', 'of the student', 'who has passed', 'No error'], answer: 1, explanation: '"One of the students" — use plural (students) after "one of the".' },
  { id: 12, category: 'Verbal', topic: 'Reading Comprehension', question: 'A passage states: "Innovation thrives in cultures that tolerate failure." What does this imply?', options: ['Failure is good in all situations', 'Fear of failure blocks creativity', 'Innovation requires failure', 'Cultures should ignore failure'], answer: 1, explanation: 'If cultures that "tolerate" failure allow innovation, the implication is fear of failure blocks creativity.' },
  // Logical
  { id: 13, category: 'Logical', topic: 'Blood Relations', question: 'A is the mother of B. C is the brother of B. D is the father of A. How is D related to C?', options: ['Father', 'Grandfather', 'Uncle', 'Brother'], answer: 1, explanation: 'A is mother of C. D is father of A. So D is the maternal grandfather of C.' },
  { id: 14, category: 'Logical', topic: 'Direction Sense', question: 'Ravi walks 5 km North, then turns right and walks 4 km, then turns right again and walks 5 km. How far is he from the start?', options: ['4 km', '5 km', '3 km', '0 km'], answer: 0, explanation: 'Ravi ends up 4 km East of the starting point.' },
  { id: 15, category: 'Logical', topic: 'Coding-Decoding', question: 'In a code, MANGO = NBNHP. What is APPLE in the same code?', options: ['BQQMF', 'BQPMF', 'BQQLF', 'BQPMG'], answer: 0, explanation: 'Each letter is shifted +1: A→B, P→Q, P→Q, L→M, E→F → BQQMF.' },
  { id: 16, category: 'Logical', topic: 'Syllogism', question: 'All dogs are mammals. All mammals are animals. Conclusion: All dogs are animals.', options: ['True', 'False', 'Uncertain', 'Cannot be determined'], answer: 0, explanation: 'All dogs → mammals → animals. The syllogism is valid and the conclusion is definitely True.' },
  { id: 17, category: 'Logical', topic: 'Number Series', question: 'Find the missing number: 2, 6, 12, 20, 30, ?', options: ['40', '42', '44', '46'], answer: 1, explanation: 'Differences: 4, 6, 8, 10, 12 → next is 30+12 = 42.' },
  { id: 18, category: 'Logical', topic: 'Seating Arrangement', question: '5 people sit in a row. A is left of B, C is right of D, B is right of C. Who is in the middle?', options: ['A', 'B', 'C', 'D'], answer: 2, explanation: 'Arrangement: D, C, B, A — with 5 people C is third, in the middle position.' },
];

// ─── First Job Essentials Content ────────────────────────────────────────────

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  items: { label: string; detail: string }[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'pre-joining',
    title: 'Pre-Joining Checklist',
    icon: <CheckSquare size={16} />,
    color: BRAND.primary,
    items: [
      { label: 'Verify your offer letter carefully', detail: 'Check role title, CTC breakdown, joining date, location, and probation period before signing.' },
      { label: 'Arrange all documents', detail: 'Marksheets, degree certificate, ID proof (Aadhar, PAN), passport photos, experience/internship letters.' },
      { label: 'Open a savings account', detail: 'Many companies mandate a salary account with a specific bank — confirm this with HR beforehand.' },
      { label: 'Set up a professional email', detail: 'If you don\'t have one: firstname.lastname@gmail.com — avoid nicknames or numbers.' },
      { label: 'Update your LinkedIn profile', detail: 'Add your new company using the "I\'m hired" feature — connects you with colleagues automatically.' },
      { label: 'Research your employer', detail: 'Know the products, recent news, org structure, and your team\'s role in the company.' },
    ],
  },
  {
    id: 'first-week',
    title: 'First Week at Work',
    icon: <Briefcase size={16} />,
    color: BRAND.accent,
    items: [
      { label: 'Arrive 10–15 minutes early', detail: 'Especially on Day 1 — it signals professionalism and gives you time to settle.' },
      { label: 'Introduce yourself proactively', detail: 'Don\'t wait to be introduced — walk up to colleagues and say "Hi, I\'m [Name], just joined as [Role]."' },
      { label: 'Listen more, talk less', detail: 'Observe workplace culture, communication norms, and team dynamics before forming strong opinions.' },
      { label: 'Ask questions — smartly', detail: 'Research before asking. Batch your questions. Never ask the same thing twice without noting it down.' },
      { label: 'Understand your KPIs early', detail: 'Know what success looks like in your role. Ask your manager: "What does a great first 90 days look like?"' },
      { label: 'Master workplace tools quickly', detail: 'Get comfortable with email clients, Slack/Teams, project management tools (Jira, Notion) ASAP.' },
    ],
  },
  {
    id: 'salary',
    title: 'Salary & Benefits Decoded',
    icon: <Award size={16} />,
    color: BRAND.green,
    items: [
      { label: 'CTC ≠ In-Hand salary', detail: 'CTC includes PF contribution, gratuity, insurance — your in-hand is usually 60–70% of CTC for freshers.' },
      { label: 'Provident Fund (PF)', detail: '12% of basic salary is deducted for PF; employer contributes the same. It\'s your retirement fund — don\'t withdraw early.' },
      { label: 'Income Tax Basics', detail: 'Salaries above ₹3 lakh are taxable. Submit your investment declarations (80C, 80D) to HR to reduce TDS.' },
      { label: 'Form 16', detail: 'Your employer will issue Form 16 each April — it\'s your income proof and needed for filing ITR.' },
      { label: 'Health Insurance', detail: 'Group health insurance from your employer usually covers ₹1–5 lakh. Know your coverage limits.' },
      { label: 'Leave Policy', detail: 'Know your Casual Leave, Sick Leave, and Earned Leave quotas. Most companies allow carry-forward of a portion.' },
    ],
  },
  {
    id: 'communication',
    title: 'Professional Communication',
    icon: <MessageSquare size={16} />,
    color: BRAND.orange,
    items: [
      { label: 'Email subject lines matter', detail: 'Be specific: "Action Required: Q3 Report by Friday" beats "Regarding the report".' },
      { label: 'Reply within 24 hours', detail: 'Even if you can\'t resolve something — acknowledge receipt and give an ETA for your full reply.' },
      { label: 'Meeting etiquette', detail: 'Join on time. Mute when not speaking. Don\'t multitask visibly. Come prepared with updates.' },
      { label: 'Escalation etiquette', detail: 'Always try to solve issues at the lowest level first. Escalate with facts, not frustration.' },
      { label: 'Use "Reply All" carefully', detail: 'Only reply-all if your message is relevant to everyone in the thread.' },
      { label: 'Feedback is a gift', detail: 'When given constructive feedback, thank the person. Ask "What would a better version look like?"' },
    ],
  },
  {
    id: 'growth',
    title: 'Grow Fast — Career Habits',
    icon: <TrendingUp size={16} />,
    color: '#8b5cf6',
    items: [
      { label: 'Find a mentor in your company', detail: 'Senior colleague + informal mentor check-in = faster growth than any training program.' },
      { label: 'Volunteer for visible projects', detail: 'High-visibility projects (even if hard) get you noticed by decision-makers faster.' },
      { label: 'Document your wins', detail: 'Keep a private "brag doc" — things you shipped, problems you solved, metrics you moved.' },
      { label: 'Cross-functional curiosity', detail: 'Attend a Sales call, shadow a PM, review a Design mockup — breadth builds credibility.' },
      { label: 'Set a 6-month review with your manager', detail: 'Don\'t wait for annual reviews — proactively ask for mid-year feedback and growth discussion.' },
      { label: 'Continuous learning', detail: 'Dedicate 30 min/day to learning — a certification, a book chapter, or a course module.' },
    ],
  },
];

// ─── Stage Colors ─────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<DriveStage, string> = {
  'Registration':    '#94a3b8',
  'Aptitude Test':   BRAND.primary,
  'Technical Round': '#8b5cf6',
  'Group Discussion': BRAND.accent,
  'HR Interview':    BRAND.orange,
  'Offer':           BRAND.green,
  'Rejected':        BRAND.red,
};

const DRIVE_STAGES: DriveStage[] = ['Registration', 'Aptitude Test', 'Technical Round', 'Group Discussion', 'HR Interview', 'Offer', 'Rejected'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function ls<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

const FRESHER_TABS = [
  { id: 'readiness' as FresherSubTab, label: 'Readiness Score', icon: <Gauge size={14} /> },
  { id: 'drives'    as FresherSubTab, label: 'Campus Drives',   icon: <Building2 size={14} /> },
  { id: 'projects'  as FresherSubTab, label: 'Project Portfolio', icon: <Code size={14} /> },
  { id: 'aptitude'  as FresherSubTab, label: 'Aptitude Prep',   icon: <Brain size={14} /> },
  { id: 'guide'     as FresherSubTab, label: 'First Job Guide', icon: <BookOpen size={14} /> },
];

// ══════════════════════════════════════════════════════════════════════════════
// READINESS SCORE
// ══════════════════════════════════════════════════════════════════════════════

function ReadinessScore({ profile, drives, projects }: { profile: any; drives: CampusDrive[]; projects: Project[] }) {
  const checks = [
    { label: 'Profile photo uploaded',        done: !!profile?.photo,                                    pts: 5 },
    { label: 'Education section filled',       done: (profile?.education || []).length > 0,               pts: 15 },
    { label: 'At least 2 skills added',        done: (profile?.skills?.technical || []).length >= 2,      pts: 10 },
    { label: 'Resume built in Resume Studio',  done: !!profile?.resumeBuilt,                              pts: 10 },
    { label: 'Competency assessment taken',    done: !!profile?.competencyProfile?.assessmentDone,        pts: 15 },
    { label: '1+ campus drive tracked',        done: drives.length >= 1,                                   pts: 10 },
    { label: '1+ project in portfolio',        done: projects.length >= 1,                                 pts: 15 },
    { label: 'Career goal set',                done: !!profile?.targetRole,                               pts: 10 },
    { label: 'LinkedIn URL added',             done: !!profile?.linkedin,                                 pts: 5  },
    { label: 'GitHub URL added',               done: !!profile?.github,                                   pts: 5  },
  ];

  const earned  = checks.filter(c => c.done).reduce((s, c) => s + c.pts, 0);
  const total   = checks.reduce((s, c) => s + c.pts, 0);
  const score   = Math.round((earned / total) * 100);
  const pct     = (earned / total) * 100;

  const tier = score >= 80 ? { label: 'Hire-Ready', color: BRAND.green } :
               score >= 55 ? { label: 'Getting There', color: BRAND.orange } :
               { label: 'Just Starting', color: BRAND.red };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Fresher Readiness Score</h2>
        <p className="text-xs text-gray-400 mt-0.5">Complete all items to maximize your chances of landing your first job</p>
      </div>

      {/* Score Card */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: `#5a7fc7` }}>
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10 bg-white" />
        <div className="relative flex items-center gap-8">
          {/* Circular gauge */}
          <div className="relative w-28 h-28 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="white" strokeWidth="10"
                strokeDasharray={`${pct * 2.638} 263.8`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold">{score}</span>
              <span className="text-[10px] opacity-70">/ 100</span>
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full mb-2 inline-block" style={{ backgroundColor: tier.color }}>
              {tier.label}
            </span>
            <p className="text-white/90 text-sm font-medium mt-1">{earned} of {total} points earned</p>
            <p className="text-white/60 text-xs mt-1">{checks.filter(c => !c.done).length} items left to improve your score</p>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {checks.map((c, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${c.done ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${c.done ? 'bg-teal-500' : 'bg-gray-200'}`}>
              {c.done ? <CheckCircle size={14} className="text-white" /> : <Circle size={14} className="text-gray-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${c.done ? 'text-teal-800' : 'text-gray-600'}`}>{c.label}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.done ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-500'}`}>
              +{c.pts}
            </span>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="rounded-xl p-4 border border-blue-100 bg-blue-50 flex gap-3">
        <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          <strong>Pro Tip:</strong> A score above 80 puts you in the top 20% of fresher profiles on MetryxOne.
          Complete the Competency Assessment and add your first project to jump quickly.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CAMPUS DRIVE TRACKER
// ══════════════════════════════════════════════════════════════════════════════

const BLANK_DRIVE: Omit<CampusDrive, 'id'> = { company: '', role: '', ctc: '', driveDate: '', currentStage: 'Registration', status: 'Active', notes: '' };

function CampusDriveTracker({ drives, setDrives }: { drives: CampusDrive[]; setDrives: (d: CampusDrive[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<Omit<CampusDrive, 'id'>>(BLANK_DRIVE);
  const [editing, setEditing]   = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<DriveStatus | 'All'>('All');

  const save = () => {
    if (!form.company || !form.role) return;
    let updated: CampusDrive[];
    if (editing) {
      updated = drives.map(d => d.id === editing ? { ...form, id: editing } : d);
    } else {
      updated = [{ ...form, id: uid() }, ...drives];
    }
    setDrives(updated);
    lsSet(LS_DRIVES, updated);
    setShowForm(false); setEditing(null); setForm(BLANK_DRIVE);
  };

  const del = (id: string) => {
    const updated = drives.filter(d => d.id !== id);
    setDrives(updated); lsSet(LS_DRIVES, updated);
  };

  const advanceStage = (id: string) => {
    const updated = drives.map(d => {
      if (d.id !== id) return d;
      const idx = DRIVE_STAGES.indexOf(d.currentStage);
      const next = DRIVE_STAGES[Math.min(idx + 1, DRIVE_STAGES.length - 1)];
      const status: DriveStatus = next === 'Offer' ? 'Selected' : next === 'Rejected' ? 'Rejected' : 'Active';
      return { ...d, currentStage: next, status };
    });
    setDrives(updated); lsSet(LS_DRIVES, updated);
  };

  const visible = filterStatus === 'All' ? drives : drives.filter(d => d.status === filterStatus);

  const startEdit = (d: CampusDrive) => {
    setForm({ company: d.company, role: d.role, ctc: d.ctc, driveDate: d.driveDate, currentStage: d.currentStage, status: d.status, notes: d.notes });
    setEditing(d.id); setShowForm(true);
  };

  const statusBadge = (s: DriveStatus) => {
    const map: Record<DriveStatus, string> = { Active: 'bg-blue-100 text-blue-700', Selected: 'bg-teal-100 text-teal-700', Rejected: 'bg-red-100 text-red-700', 'On Hold': 'bg-yellow-100 text-yellow-700' };
    return map[s];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Campus Drive Tracker</h2>
          <p className="text-xs text-gray-400 mt-0.5">{drives.length} drive{drives.length !== 1 ? 's' : ''} tracked · {drives.filter(d => d.status === 'Selected').length} offer{drives.filter(d => d.status === 'Selected').length !== 1 ? 's' : ''} received</p>
        </div>
        <button onClick={() => { setForm(BLANK_DRIVE); setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm"
          style={{ backgroundColor: BRAND.primary }}>
          <Plus size={13} /> Add Drive
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['All', 'Active', 'Selected', 'Rejected', 'On Hold'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${filterStatus === s ? 'text-white border-transparent' : 'text-gray-500 border-gray-200 hover:border-gray-300'}`}
            style={filterStatus === s ? { backgroundColor: BRAND.primary } : {}}>
            {s}
          </button>
        ))}
      </div>

      {/* Drives List */}
      {visible.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No drives tracked yet</p>
          <p className="text-xs mt-1">Add your first campus placement drive above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(d => {
            const stageIdx = DRIVE_STAGES.indexOf(d.currentStage);
            const progressPct = ((stageIdx) / (DRIVE_STAGES.length - 2)) * 100;
            return (
              <div key={d.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gray-900 truncate">{d.company}</h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge(d.status)}`}>{d.status}</span>
                    </div>
                    <p className="text-xs text-gray-500">{d.role}{d.ctc && ` · ${d.ctc} LPA`}{d.driveDate && ` · ${d.driveDate}`}</p>

                    {/* Stage Progress */}
                    <div className="mt-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-gray-400 font-medium">Current: <span className="font-bold" style={{ color: STAGE_COLORS[d.currentStage] }}>{d.currentStage}</span></span>
                        <span className="text-[10px] text-gray-400">{stageIdx}/{DRIVE_STAGES.length - 2} rounds</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(progressPct, 100)}%`, backgroundColor: STAGE_COLORS[d.currentStage] }} />
                      </div>
                    </div>

                    {d.notes && <p className="text-[11px] text-gray-400 mt-2 italic">{d.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {!['Offer', 'Rejected'].includes(d.currentStage) && (
                      <button onClick={() => advanceStage(d.id)}
                        title="Advance to next round"
                        className="flex items-center gap-1 text-[10px] font-semibold text-white px-2.5 py-1.5 rounded-lg"
                        style={{ backgroundColor: BRAND.green }}>
                        <ArrowRight size={11} /> Next Round
                      </button>
                    )}
                    <button onClick={() => startEdit(d)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Edit3 size={14} /></button>
                    <button onClick={() => del(d.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900">{editing ? 'Edit Drive' : 'Add Campus Drive'}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {([['company', 'Company Name*'], ['role', 'Role / Profile*'], ['ctc', 'CTC (LPA)'], ['driveDate', 'Drive Date']] as [keyof typeof form, string][]).map(([k, label]) => (
                <div key={k}>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">{label}</label>
                  <input value={form[k] as string} onChange={e => setForm({ ...form, [k]: e.target.value })}
                    type={k === 'driveDate' ? 'date' : 'text'}
                    className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Current Stage</label>
                  <select value={form.currentStage} onChange={e => setForm({ ...form, currentStage: e.target.value as DriveStage })}
                    className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 bg-white">
                    {DRIVE_STAGES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as DriveStatus })}
                    className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 bg-white">
                    {(['Active', 'Selected', 'Rejected', 'On Hold'] as DriveStatus[]).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={save}
                className="flex-1 text-xs font-semibold text-white py-2.5 rounded-xl"
                style={{ backgroundColor: BRAND.primary }}>
                {editing ? 'Save Changes' : 'Add Drive'}
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PROJECT PORTFOLIO
// ══════════════════════════════════════════════════════════════════════════════

const BLANK_PROJECT: Omit<Project, 'id'> = { title: '', description: '', techStack: '', githubUrl: '', demoUrl: '', type: 'Academic', featured: false };

function ProjectPortfolio({ projects, setProjects }: { projects: Project[]; setProjects: (p: Project[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<Omit<Project, 'id'>>(BLANK_PROJECT);
  const [editing, setEditing]   = useState<string | null>(null);

  const save = () => {
    if (!form.title) return;
    let updated: Project[];
    if (editing) {
      updated = projects.map(p => p.id === editing ? { ...form, id: editing } : p);
    } else {
      updated = [{ ...form, id: uid() }, ...projects];
    }
    setProjects(updated); lsSet(LS_PROJECTS, updated);
    setShowForm(false); setEditing(null); setForm(BLANK_PROJECT);
  };

  const del = (id: string) => {
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated); lsSet(LS_PROJECTS, updated);
  };

  const toggleFeatured = (id: string) => {
    const updated = projects.map(p => p.id === id ? { ...p, featured: !p.featured } : p);
    setProjects(updated); lsSet(LS_PROJECTS, updated);
  };

  const startEdit = (p: Project) => {
    setForm({ title: p.title, description: p.description, techStack: p.techStack, githubUrl: p.githubUrl, demoUrl: p.demoUrl, type: p.type, featured: p.featured });
    setEditing(p.id); setShowForm(true);
  };

  const TYPE_COLORS: Record<ProjectType, string> = {
    Academic: '#6366f1', Personal: '#f59e0b', 'Open Source': '#10b981', Internship: '#3b82f6', Hackathon: '#ec4899'
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Project Portfolio</h2>
          <p className="text-xs text-gray-400 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''} · {projects.filter(p => p.featured).length} featured</p>
        </div>
        <button onClick={() => { setForm(BLANK_PROJECT); setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm"
          style={{ backgroundColor: BRAND.primary }}>
          <Plus size={13} /> Add Project
        </button>
      </div>

      {/* Tip */}
      <div className="rounded-xl p-3 border border-amber-100 bg-amber-50 flex gap-3">
        <Sparkles size={15} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700">
          Projects are the #1 differentiator for freshers. Aim for 3–5 solid projects with working GitHub links.
          Recruiters look for: complexity, real-world relevance, clean code, and good documentation.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Code size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No projects yet</p>
          <p className="text-xs mt-1">Add your academic, personal, or open-source projects</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map(p => {
            const tags = p.techStack.split(',').map(t => t.trim()).filter(Boolean);
            return (
              <div key={p.id} className={`bg-white border rounded-2xl p-4 shadow-sm relative ${p.featured ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-100'}`}>
                {p.featured && (
                  <div className="absolute top-3 right-10">
                    <Star size={14} className="text-amber-400 fill-amber-400" />
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white inline-block mb-2" style={{ backgroundColor: TYPE_COLORS[p.type] }}>{p.type}</span>
                    <h3 className="text-sm font-bold text-gray-900 mb-1">{p.title}</h3>
                    {p.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{p.description}</p>}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {tags.slice(0, 6).map(t => (
                          <span key={t} className="text-[9px] font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      {p.githubUrl && <a href={p.githubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-800"><Github size={11} /> GitHub</a>}
                      {p.demoUrl && <a href={p.demoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700"><ExternalLink size={11} /> Live Demo</a>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => toggleFeatured(p.id)} title={p.featured ? 'Unfeature' : 'Feature'}
                      className="p-1.5 rounded-lg hover:bg-gray-100">
                      <Star size={14} className={p.featured ? 'text-amber-400 fill-amber-400' : 'text-gray-400'} />
                    </button>
                    <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><Edit3 size={14} /></button>
                    <button onClick={() => del(p.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900">{editing ? 'Edit Project' : 'Add Project'}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Project Title*</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1" placeholder="e.g. Smart Attendance System" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as ProjectType })}
                  className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 bg-white">
                  {(['Academic', 'Personal', 'Open Source', 'Internship', 'Hackathon'] as ProjectType[]).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 resize-none"
                  placeholder="What does the project do? What problem does it solve?" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Tech Stack (comma-separated)</label>
                <input value={form.techStack} onChange={e => setForm({ ...form, techStack: e.target.value })}
                  className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1"
                  placeholder="e.g. React, Node.js, PostgreSQL, Python" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">GitHub URL</label>
                  <input value={form.githubUrl} onChange={e => setForm({ ...form, githubUrl: e.target.value })}
                    className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1" placeholder="https://github.com/..." />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Live Demo URL</label>
                  <input value={form.demoUrl} onChange={e => setForm({ ...form, demoUrl: e.target.value })}
                    className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1" placeholder="https://..." />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} className="rounded" />
                <span className="text-xs text-gray-600">Mark as featured project</span>
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={save} className="flex-1 text-xs font-semibold text-white py-2.5 rounded-xl" style={{ backgroundColor: BRAND.primary }}>
                {editing ? 'Save Changes' : 'Add Project'}
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APTITUDE PREP HUB
// ══════════════════════════════════════════════════════════════════════════════

function AptitudePrepHub() {
  const [category, setCategory]   = useState<AptitudeCat>('Quantitative');
  const [current, setCurrent]     = useState(0);
  const [selected, setSelected]   = useState<number | null>(null);
  const [showExpl, setShowExpl]   = useState(false);
  const [score, setScore]         = useState(0);
  const [answered, setAnswered]   = useState(0);
  const [history, setHistory]     = useState<Record<number, boolean>>({});

  const questions = APTITUDE_BANK.filter(q => q.category === category);
  const q = questions[current];

  const choose = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const correct = idx === q.answer;
    if (correct && !history[q.id]) { setScore(s => s + 1); }
    if (!history[q.id]) { setAnswered(a => a + 1); setHistory(h => ({ ...h, [q.id]: correct })); }
    setShowExpl(true);
  };

  const next = () => { setSelected(null); setShowExpl(false); setCurrent(c => (c + 1) % questions.length); };
  const reset = () => { setSelected(null); setShowExpl(false); setCurrent(0); setScore(0); setAnswered(0); setHistory({}); };

  const CAT_COLORS: Record<AptitudeCat, string> = { Quantitative: BRAND.primary, Verbal: '#8b5cf6', Logical: BRAND.green };

  const topicsInCat: Record<AptitudeCat, string[]> = {
    Quantitative: ['Number System', 'Percentages', 'Profit & Loss', 'Time & Speed', 'Averages', 'Simple Interest', 'Ratio & Proportion', 'Pipes & Cisterns'],
    Verbal: ['Synonyms & Antonyms', 'Fill in the Blanks', 'Sentence Correction', 'Reading Comprehension'],
    Logical: ['Blood Relations', 'Direction Sense', 'Coding-Decoding', 'Syllogism', 'Number Series', 'Seating Arrangement'],
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Aptitude Prep Hub</h2>
        <p className="text-xs text-gray-400 mt-0.5">Practice Quantitative, Verbal & Logical Reasoning for campus placements</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Questions Attempted', value: answered, icon: <Target size={14} />, color: BRAND.primary },
          { label: 'Correct Answers',      value: score,    icon: <CheckCircle size={14} />, color: BRAND.green },
          { label: 'Accuracy',             value: answered > 0 ? `${Math.round((score / answered) * 100)}%` : '—', icon: <Trophy size={14} />, color: BRAND.orange },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-3 text-center shadow-sm">
            <div className="flex items-center justify-center gap-1 mb-1" style={{ color: s.color }}>{s.icon}</div>
            <p className="text-lg font-extrabold text-gray-900">{s.value}</p>
            <p className="text-[10px] text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2">
        {(['Quantitative', 'Verbal', 'Logical'] as AptitudeCat[]).map(c => (
          <button key={c} onClick={() => { setCategory(c); setCurrent(0); setSelected(null); setShowExpl(false); }}
            className="flex-1 text-xs font-semibold py-2 rounded-xl border transition-colors"
            style={category === c ? { backgroundColor: CAT_COLORS[c], color: 'white', borderColor: 'transparent' } : { color: '#6b7280', borderColor: '#e5e7eb' }}>
            {c}
          </button>
        ))}
      </div>

      {/* Topics covered */}
      <div className="flex flex-wrap gap-1.5">
        {topicsInCat[category].map(t => (
          <span key={t} className="text-[10px] px-2.5 py-1 rounded-full font-medium border" style={{ borderColor: CAT_COLORS[category], color: CAT_COLORS[category], background: `${CAT_COLORS[category]}10` }}>{t}</span>
        ))}
      </div>

      {/* Question Card */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between" style={{ background: `${CAT_COLORS[category]}08` }}>
          <span className="text-[11px] font-semibold" style={{ color: CAT_COLORS[category] }}>{q.topic}</span>
          <span className="text-[11px] text-gray-400">Q{current + 1} of {questions.length}</span>
        </div>

        <div className="p-5">
          <p className="text-sm font-medium text-gray-800 mb-4 leading-relaxed">{q.question}</p>

          {/* Options */}
          <div className="space-y-2 mb-4">
            {q.options.map((opt, idx) => {
              let bg = 'bg-gray-50 border-gray-200 text-gray-700';
              if (selected !== null) {
                if (idx === q.answer) bg = 'bg-teal-50 border-teal-400 text-teal-800';
                else if (idx === selected) bg = 'bg-red-50 border-red-300 text-red-700';
              }
              return (
                <button key={idx} onClick={() => choose(idx)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-medium border-2 transition-all ${bg} ${selected === null ? 'hover:border-blue-300 hover:bg-blue-50' : ''}`}>
                  <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>{opt}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showExpl && (
            <div className={`rounded-xl p-3 text-xs mb-4 ${selected === q.answer ? 'bg-teal-50 border border-teal-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="font-semibold mb-0.5" style={{ color: selected === q.answer ? BRAND.green : BRAND.red }}>
                {selected === q.answer ? '✓ Correct!' : '✗ Incorrect'}
              </p>
              <p className="text-gray-700">{q.explanation}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={next}
              className="flex-1 text-xs font-semibold text-white py-2.5 rounded-xl"
              style={{ backgroundColor: CAT_COLORS[category] }}>
              {current < questions.length - 1 ? 'Next Question →' : 'Restart Category'}
            </button>
            <button onClick={reset} title="Reset score" className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-400">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Prep Tips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { company: 'TCS / Wipro', tip: 'Focus on Percentages, Time-Speed, and Verbal Ability. Cocubes and TCS NQT pattern used.', color: '#6366f1' },
          { company: 'Infosys / HCL', tip: 'Heavy on Logical Reasoning and Verbal. Hackwithinfy includes coding rounds too.', color: '#0ea5e9' },
          { company: 'Accenture / Cognizant', tip: 'Quantitative + Logical combined. Communication skills tested in GD/HR rounds.', color: '#10b981' },
        ].map(c => (
          <div key={c.company} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
            <p className="text-[11px] font-bold mb-1" style={{ color: c.color }}>{c.company}</p>
            <p className="text-[10px] text-gray-500 leading-relaxed">{c.tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FIRST JOB GUIDE
// ══════════════════════════════════════════════════════════════════════════════

function FirstJobGuide() {
  const [openSection, setOpenSection]   = useState<string | null>('pre-joining');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => ls(LS_CHECKLIST, {}));

  const toggleItem = (key: string) => {
    const updated = { ...checkedItems, [key]: !checkedItems[key] };
    setCheckedItems(updated); lsSet(LS_CHECKLIST, updated);
  };

  const totalItems  = GUIDE_SECTIONS.reduce((s, sec) => s + sec.items.length, 0);
  const doneItems   = GUIDE_SECTIONS.reduce((s, sec) => s + sec.items.filter((_, i) => checkedItems[`${sec.id}-${i}`]).length, 0);
  const donePct     = Math.round((doneItems / totalItems) * 100);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">First Job Guide</h2>
        <p className="text-xs text-gray-400 mt-0.5">Everything you need to know before and after your first day</p>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">Guide Completion</span>
          <span className="text-xs font-bold" style={{ color: BRAND.green }}>{doneItems}/{totalItems} items</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className="h-full rounded-full transition-all" style={{ width: `${donePct}%`, backgroundColor: BRAND.green }} />
        </div>
        <p className="text-[10px] text-gray-400 mt-1">{donePct}% complete</p>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {GUIDE_SECTIONS.map(sec => {
          const secDone = sec.items.filter((_, i) => checkedItems[`${sec.id}-${i}`]).length;
          const isOpen  = openSection === sec.id;
          return (
            <div key={sec.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <button onClick={() => setOpenSection(isOpen ? null : sec.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: sec.color }}>
                    {sec.icon}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">{sec.title}</p>
                    <p className="text-[10px] text-gray-400">{secDone}/{sec.items.length} completed</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {secDone === sec.items.length && <CheckCircle size={14} style={{ color: BRAND.green }} />}
                  {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-4 space-y-3 border-t border-gray-100">
                  {sec.items.map((item, i) => {
                    const key = `${sec.id}-${i}`;
                    const done = !!checkedItems[key];
                    return (
                      <div key={i} className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-colors ${done ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                        onClick={() => toggleItem(key)}>
                        <div className="mt-0.5 shrink-0">
                          {done
                            ? <CheckSquare size={16} style={{ color: BRAND.green }} />
                            : <Square size={16} className="text-gray-300" />}
                        </div>
                        <div>
                          <p className={`text-xs font-semibold ${done ? 'text-teal-800 line-through' : 'text-gray-800'}`}>{item.label}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface FresherHubTabProps {
  profile: any;
  // MX-302A — user-facing title override ("Career Launchpad" when flag ON).
  title?: string;
}

export function FresherHubTab({ profile, title }: FresherHubTabProps) {
  const [subTab, setSubTab]     = useState<FresherSubTab>('readiness');
  const [drives, setDrives]     = useState<CampusDrive[]>(() => ls(LS_DRIVES, []));
  const [projects, setProjects] = useState<Project[]>(() => ls(LS_PROJECTS, []));

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="rounded-2xl p-5 mb-5 relative overflow-hidden" style={{ background: `${BRAND.primary}`, border: `1px solid ${BRAND.primary}20` }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white" style={{ background: `${BRAND.primary}` }}>
            <GraduationCap size={22} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-gray-900">{title || 'Fresher Hub'}</h1>
            <p className="text-xs text-gray-500 mt-0.5">Your complete toolkit for landing your first job — campus drives, projects, aptitude prep, and more.</p>
          </div>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        {FRESHER_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-colors"
            style={subTab === t.id
              ? { backgroundColor: BRAND.primary, color: 'white', borderColor: 'transparent' }
              : { color: '#6b7280', borderColor: '#e5e7eb', background: 'white' }}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'readiness' && <ReadinessScore profile={profile} drives={drives} projects={projects} />}
      {subTab === 'drives'    && <CampusDriveTracker drives={drives} setDrives={setDrives} />}
      {subTab === 'projects'  && <ProjectPortfolio projects={projects} setProjects={setProjects} />}
      {subTab === 'aptitude'  && <AptitudePrepHub />}
      {subTab === 'guide'     && <FirstJobGuide />}
    </div>
  );
}
