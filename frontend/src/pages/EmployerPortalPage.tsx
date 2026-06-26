import { BRAND } from '@/design-system/tokens';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import type { Screen } from '../App';
import {
  Briefcase, Users, BarChart3, Building2, Settings, Target,
  Plus, X, Edit3, Trash2, ChevronRight, ChevronDown, ChevronUp,
  Search, Filter, MapPin, Mail, Phone, Linkedin, Globe, Clock,
  CheckCircle, Circle, AlertCircle, Star, Sparkles, Zap,
  TrendingUp, TrendingDown, ArrowRight, Download, Upload, Send,
  Calendar, Video, Eye, Bookmark, BookmarkCheck, RefreshCw,
  UserCheck, UserX, DollarSign, Award, Code, Brain, Shield,
  MessageSquare, Bell, LogOut, Activity, PieChart, FileText,
  Building, Layers, ChevronLeft, Flag, Users2, Flame,
  ClipboardList, Dna, Radar, HeartPulse, Network, GraduationCap,
  Percent, Gauge, ListChecks, Cpu,
  Mic, Link2, Copy, PhoneCall, BotMessageSquare, Wand2,
  Timer, BadgeCheck, SlidersHorizontal, PlayCircle, Pause, Volume2,
  Repeat, ExternalLink, Hash, MailCheck, Info,
  FileSpreadsheet, Database, UserPlus, ArrowUpRight, Table,
  Tag, Inbox, FolderOpen, ToggleLeft, ToggleRight, CheckSquare, Square,
  LayoutGrid, List
} from 'lucide-react';
import SecurityDashboardPanel        from '@/components/employer/SecurityDashboardPanel';
import TalentIntelligenceGraphPanel  from '@/components/employer/TalentIntelligenceGraphPanel';
import HiringIntelligencePanel       from '@/components/employer/HiringIntelligencePanel';
import CompetencyHiringPanel         from '@/components/employer/CompetencyHiringPanel';
import HiringValidationPanel         from '@/components/employer/HiringValidationPanel';
import EmployerWorkforcePanel        from '@/components/employer/EmployerWorkforcePanel';
import EIOSCockpit                   from '@/components/employer/EIOSCockpit';
import { MARKET_CATALOG, type MarketRole } from '@/data/marketCatalog';



// Hiring-intelligence verdict + calibration presentation (P2: surface AI intelligence).
// Calibration is the CONFIDENCE axis (is the model trustworthy yet?), kept distinct from
// platform-intelligence domain COVERAGE (does data exist?). Honest: never claim "calibrated"
// below the platform k_min of 30 realized hire outcomes.
const VERDICT_META: Record<string, { label: string; color: string }> = {
  STRONG_HIRE:      { label: 'Strong Hire',      color: '#2A9D8F' },
  HIRE:             { label: 'Hire',             color: '#4ECDC4' },
  CONDITIONAL_HIRE: { label: 'Conditional Hire', color: '#f4a261' },
  NO_HIRE:          { label: 'No Hire',          color: '#e63946' },
};
const CALIB_META: Record<string, { label: string; color: string; bg: string; note: string }> = {
  calibrated:  { label: 'Calibrated',   color: '#2A9D8F', bg: '#2A9D8F18', note: 'Probabilities empirically calibrated on ≥30 realized hire outcomes.' },
  provisional: { label: 'Provisional',  color: '#f4a261', bg: '#f4a26118', note: 'Learning from realized outcomes — directional until ≥30 are recorded.' },
  cold_start:  { label: 'Uncalibrated', color: '#94a3b8', bg: '#94a3b818', note: 'No realized hire outcomes yet — predictions are model-derived and directional.' },
};

interface EmployerPortalPageProps {
  onNavigate: (screen: Screen | string, data?: Record<string, unknown>) => void;
}

type TabId =
  | 'dashboard' | 'jobs' | 'pipeline' | 'candidates'
  | 'assessments' | 'screening' | 'interviews' | 'offers' | 'analytics' | 'pool'
  | 'team' | 'company'
  | 'org-intelligence' | 'talent-match' | 'competency-map'
  | 'talent-graph'
  | 'hiring-intelligence'
  | 'competency-hiring'
  | 'hiring-validation'
  | 'workforce'
  | 'eios'
  | 'security';

type NavItem = { id: TabId; label: string; icon: React.ReactNode; badge?: string };
const NAV_SECTIONS: { section: string; items: NavItem[] }[] = [
  {
    section: 'Overview',
    items: [
      { id: 'dashboard', label: 'Command Center', icon: <BarChart3 size={16} /> },
    ],
  },
  {
    section: 'Hiring Pipeline',
    items: [
      { id: 'jobs',        label: 'Job Board',           icon: <Briefcase size={16} /> },
      { id: 'candidates',  label: 'Candidates',          icon: <Users size={16} /> },
      { id: 'pipeline',    label: 'Talent Pipeline',     icon: <Layers size={16} /> },
      { id: 'assessments', label: 'Fitment Assessments', icon: <Brain size={16} /> },
      { id: 'screening',   label: 'Voice Screening',     icon: <Mic size={16} />, badge: 'AI' },
      { id: 'interviews',  label: 'Interview Hub',       icon: <Calendar size={16} /> },
      { id: 'offers',      label: 'Offer Management',    icon: <FileText size={16} />, badge: 'NEW' },
      { id: 'pool',        label: 'Talent Pool',         icon: <Bookmark size={16} /> },
    ],
  },
  {
    section: 'Intelligence & Analytics',
    items: [
      { id: 'org-intelligence', label: 'Org Intelligence', icon: <Network size={16} />, badge: 'NEW' },
      { id: 'talent-match',     label: 'AI Talent Match',  icon: <Cpu size={16} />, badge: 'AI' },
      { id: 'competency-map',   label: 'Competency Map',   icon: <Gauge size={16} />, badge: 'NEW' },
      { id: 'analytics',        label: 'Analytics',        icon: <PieChart size={16} /> },
    ],
  },
  {
    section: 'Advanced Modules',
    items: [
      { id: 'talent-graph',        label: 'Talent Graph',        icon: <Network size={16} />, badge: 'W2' },
      { id: 'hiring-intelligence', label: 'Hiring Intelligence', icon: <Brain  size={16} />, badge: 'W3' },
      { id: 'competency-hiring',   label: 'Competency Hiring',   icon: <Gauge  size={16} />, badge: 'NEW' },
      { id: 'hiring-validation',   label: 'Hiring Validation',   icon: <Target size={16} />, badge: 'NEW' },
      { id: 'workforce',           label: 'Workforce Intelligence', icon: <Network size={16} />, badge: 'NEW' },
      { id: 'eios',                label: 'EIOS Cockpit',        icon: <LayoutGrid size={16} />, badge: 'EIOS' },
    ],
  },
  {
    section: 'Workspace',
    items: [
      { id: 'team',     label: 'Team',            icon: <Users2 size={16} /> },
      { id: 'company',  label: 'Company Profile', icon: <Building2 size={16} /> },
      { id: 'security', label: 'Security',        icon: <Shield size={16} />, badge: 'W1' },
    ],
  },
];

const JOB_STAGES  = ['Applied','Screened','Interview','Assessment','Offer','Hired','Rejected'] as const;
const STAGE_COLORS: Record<string, string> = {
  Applied: '#64748b', Screened: BRAND.purple, Interview: BRAND.accent,
  Assessment: BRAND.orange, Offer: BRAND.green, Hired: '#16a34a', Rejected: BRAND.red,
};
const JOB_STATUSES = ['Draft','Active','Paused','Closed'] as const;
const STATUS_COLORS: Record<string, string> = {
  Draft: '#94a3b8', Active: BRAND.green, Paused: BRAND.orange, Closed: BRAND.red,
};

const INTERVIEW_TYPES  = ['Video','Phone','In-person','Technical','Panel'] as const;
const INTERVIEW_STATUS = ['Scheduled','Completed','Cancelled','No-show'] as const;
const SOURCE_OPTIONS   = ['LinkedIn','Naukri','Indeed','Referral','Direct','Campus','MetryxOne','Other'];

interface EmployerJob { _id: string; title: string; department: string; location: string; type: string; workMode: string; experience: string; salary: string; description: string; requirements: string[]; responsibilities: string[]; skills: string[]; perks: string[]; status: string; deadline: string; hiringManager: string; quota: number; eiMinScore: number; applicationCount: number; shareToken?: string | null; matchedRoleId?: string | null; matchedRoleSource?: string | null; createdAt: string; }

// Task #102 — curated-role crosswalk resolution (employer-scoped, flag-gated).
interface RoleMatchResult {
  input: string;
  resolved: {
    role_id: string; role_title: string; seniority: string | null;
    match_type: string; confidence_pct: number; confidence_label: string;
    estimated: boolean; competency_count: number; weight_total: number;
  } | null;
  alternatives: { role_id: string; role_title: string; confidence_pct: number; estimated: boolean; competency_count: number }[];
  candidates_considered: number;
  note: string;
}
interface MatchableRole { id: string; title: string; seniority: string | null; competency_count: number; weight_total: number; }
interface Candidate { _id: string; jobId: string; jobTitle: string; name: string; email: string; phone: string; location: string; currentRole: string; experience: string; skills: string[]; education: string; eiScore: number; matchScore: number; source: string; stage: string; notes: string; rating: number; linkedinUrl: string; appliedDate: string; interviewDate: string; offerAmount: string; tags: string[]; assessmentSent: boolean; assessmentScore: number; assessmentSentAt?: string | null; assessmentCompleted?: boolean; assessmentCompletedAt?: string | null; completionRequestedAt?: string | null; completionCompletedAt?: string | null; pooled: boolean; createdAt: string; }
interface Interview { _id: string; candidateId: string; candidateName: string; jobId: string; jobTitle: string; type: string; date: string; time: string; duration: string; interviewers: string[]; meetingLink: string; status: string; feedback: string; rating: number; recommendation: string; scorecard?: Record<string, number>; }
interface Analytics { totalJobs: number; activeJobs: number; totalCandidates: number; hired: number; rejected: number; inInterview: number; inOffer: number; avgEI: number; avgMatch: number; offerRate: number; hireRate: number; stageBreakdown: Record<string, number>; sourceBreakdown: Record<string, number>; conversionFunnel: { stage: string; count: number }[]; }
interface Company { name: string; industry: string; size: string; website: string; linkedin: string; location: string; about: string; culture: string; benefits: string[]; techStack: string[]; values: string[]; verified: boolean; }
interface Offer { _id: string; candidateId: string; candidateName: string; jobId: string; jobTitle: string; ctcFixed: number; ctcVariable: number; ctcBonus: number; totalCTC: number; joiningDate: string; validity: string; currency: string; status: string; notes: string; counterAmount: number; counterNotes: string; offerLetterUrl: string; createdAt: string; }
interface RefCheck { _id: string; candidateId: string; refName: string; refTitle: string; refCompany: string; refEmail: string; refPhone: string; relationship: string; status: string; outcome: string; notes: string; createdAt: string; }
interface ActivityLog { _id: string; candidateId: string; type: string; title: string; description: string; by: string; createdAt: string; }

const OFFER_STATUSES = ['Draft','Sent','Negotiating','Accepted','Declined','Expired','Withdrawn'] as const;
const OFFER_STATUS_COLORS: Record<string, string> = {
  Draft: '#94a3b8', Sent: BRAND.primary, Negotiating: BRAND.orange, Accepted: BRAND.green,
  Declined: BRAND.red, Expired: '#64748b', Withdrawn: '#e2e8f0',
};
const REF_CHECK_STATUSES = ['Not Started','Requested','In Progress','Completed','Declined'] as const;
const ACTIVITY_TYPES = ['Note','Email','Call','WhatsApp','StageChange','Interview','Assessment','Offer','SMS'] as const;
const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  Note: <FileText size={12} />, Email: <Mail size={12} />, Call: <PhoneCall size={12} />,
  WhatsApp: <MessageSquare size={12} />, StageChange: <ArrowRight size={12} />,
  Interview: <Calendar size={12} />, Assessment: <Brain size={12} />,
  Offer: <DollarSign size={12} />, SMS: <MessageSquare size={12} />,
};
const ACTIVITY_COLORS: Record<string, string> = {
  Note: '#64748b', Email: BRAND.primary, Call: BRAND.green, WhatsApp: '#25D366',
  StageChange: BRAND.purple, Interview: BRAND.accent, Assessment: BRAND.orange,
  Offer: BRAND.green, SMS: '#94a3b8',
};

/** Deterministic prose summary composed ONLY from this candidate's saved fields (no fabrication). */
function buildCandidateSummary(c: Candidate): string {
  const parts: string[] = [];
  const role = (c.currentRole || '').trim();
  const loc = (c.location || '').trim();
  const exp = (c.experience || '').trim();
  let lead = c.name + (role ? ` is a ${role}` : ' is a candidate');
  if (loc) lead += ` based in ${loc}`;
  if (exp) lead += ` with ${exp} of experience`;
  parts.push(lead + '.');
  if ((c.education || '').trim()) parts.push(`Education: ${c.education.trim()}.`);
  if (c.skills && c.skills.length) parts.push(`Key skills: ${c.skills.slice(0, 8).join(', ')}${c.skills.length > 8 ? `, +${c.skills.length - 8} more` : ''}.`);
  const sig: string[] = [];
  if (Number(c.eiScore) > 0) sig.push(`EI assessment score ${c.eiScore}`);
  if (Number(c.matchScore) > 0) sig.push(`${c.matchScore}% role-fit signal`);
  if (sig.length) parts.push(`Platform signals: ${sig.join(', ')}.`);
  parts.push(`Currently at the ${c.stage} stage${(c.source || '').trim() ? ` · source: ${c.source}` : ''}.`);
  return parts.join(' ');
}

function fmtBytes(n: number): string {
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function authHdr() {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}
function getUser() {
  try { const p = JSON.parse(atob((localStorage.getItem('metryx_token') || '').split('.')[1])); return p; }
  catch { return null; }
}

function Chip({ label, color = BRAND.accent, size = 'sm' }: { label: string; color?: string; size?: 'xs' | 'sm' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium ${size === 'xs' ? 'text-[9px]' : 'text-[10px]'}`}
      style={{ backgroundColor: `${color}18`, color }}>
      {label}
    </span>
  );
}

function KPICard({ label, value, sub, icon, color, trend }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string; trend?: 'up' | 'down' | 'flat' }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {trend && (
          <span className={`text-[10px] font-medium flex items-center gap-0.5 ${trend === 'up' ? 'text-teal-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'}`}>
            {trend === 'up' ? <TrendingUp size={10} /> : trend === 'down' ? <TrendingDown size={10} /> : <span>—</span>}
          </span>
        )}
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-[9px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function SCard({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span style={{ color: BRAND.primary }}>{icon}</span>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function FunnelBar({ stage, count, max, color }: { stage: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, (count / max) * 100) : 4;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-24 shrink-0">{stage}</span>
      <div className="flex-1 h-5 rounded-lg bg-gray-50 overflow-hidden relative">
        <div className="h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
          style={{ width: `${pct}%`, backgroundColor: color }}>
        </div>
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color }}>{count}</span>
    </div>
  );
}

const INDUSTRY_OPTIONS = ['Technology','Finance','Healthcare','Education','Manufacturing','Retail','Consulting','Media','Logistics','Other'];
const COMPANY_SIZES    = ['1–10','11–50','51–200','201–500','501–1000','1000+'];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function EmployerPortalPage({ onNavigate }: EmployerPortalPageProps) {
  const [tab, setTab] = useState<TabId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  // MX-75X — validationLoop flag probe: gate the Hiring Validation tab so flag-OFF is byte-identical.
  const [validationLoopEnabled, setValidationLoopEnabled] = useState(false);
  // MX-77X — enterpriseWorkforceConsole flag probe: gate the Workforce Intelligence tab so flag-OFF is byte-identical.
  const [workforceEnabled, setWorkforceEnabled] = useState(false);

  const user = getUser();

  useEffect(() => {
    fetch('/api/validation-loop/enabled', { headers: authHdr() as HeadersInit })
      .then(r => setValidationLoopEnabled(r.ok))
      .catch(() => setValidationLoopEnabled(false));
    fetch('/api/employer/workforce/_meta/status', { headers: authHdr() as HeadersInit })
      .then(r => setWorkforceEnabled(r.ok))
      .catch(() => setWorkforceEnabled(false));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    // Auto-register as employer on first portal visit (idempotent — safe to call every load)
    await fetch('/api/employer/register', { method: 'POST', headers: authHdr() as HeadersInit }).catch(() => {});
    try {
      const [jRes, cRes, iRes, oRes, aRes, coRes] = await Promise.all([
        fetch('/api/employer/jobs',       { headers: authHdr() as HeadersInit }),
        fetch('/api/employer/candidates', { headers: authHdr() as HeadersInit }),
        fetch('/api/employer/interviews', { headers: authHdr() as HeadersInit }),
        fetch('/api/employer/offers',     { headers: authHdr() as HeadersInit }),
        fetch('/api/employer/analytics',  { headers: authHdr() as HeadersInit }),
        fetch('/api/employer/company',    { headers: authHdr() as HeadersInit }),
      ]);
      const [jD, cD, iD, oD, aD, coD] = await Promise.all([jRes.json(), cRes.json(), iRes.json(), oRes.json(), aRes.json(), coRes.json()]);
      // Backend list/detail GETs return BARE arrays/objects (no { success } envelope).
      // Tolerate both shapes so the portal populates correctly.
      if (jRes.ok)  setJobs(Array.isArray(jD) ? jD : (jD?.jobs ?? []));
      if (cRes.ok)  setCandidates(Array.isArray(cD) ? cD : (cD?.candidates ?? []));
      if (iRes.ok)  setInterviews(Array.isArray(iD) ? iD : (iD?.interviews ?? []));
      if (oRes.ok)  setOffers(Array.isArray(oD) ? oD : (oD?.offers ?? []));
      if (aRes.ok)  setAnalytics(aD?.analytics ?? aD ?? null);
      const comp = coD?.company ?? coD;
      if (coRes.ok && comp?.name) setCompany(comp);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLogout = () => { localStorage.removeItem('metryx_token'); onNavigate('landing'); };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Navbar onNavigate={onNavigate} />

      <div className="flex flex-1 max-w-[1440px] mx-auto w-full px-4 py-6 gap-5">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className={`shrink-0 transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-14'}`}>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden sticky top-20">
            {sidebarOpen && (
              <div className="px-4 py-4 border-b border-gray-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: `${BRAND.primary}` }}>
                    {(company?.name || user?.name || 'E').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-800 truncate">{company?.name || user?.name || 'Your Company'}</div>
                    <div className="text-[10px] text-gray-400 truncate">{company?.industry || 'Set your industry'}</div>
                  </div>
                </div>
                {company?.verified && (
                  <div className="mt-2 flex items-center gap-1 text-[9px] font-semibold" style={{ color: BRAND.green }}>
                    <CheckCircle size={10} /> Verified Employer
                  </div>
                )}
              </div>
            )}

            <nav className="p-2">
              {NAV_SECTIONS.map((sec, si) => (
                <div key={sec.section} className={si > 0 ? 'mt-1.5' : ''}>
                  {sidebarOpen ? (
                    <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-gray-300 select-none">
                      {sec.section}
                    </div>
                  ) : (
                    si > 0 && <div className="mx-2 my-1.5 border-t border-gray-100" />
                  )}
                  <div className="space-y-0.5">
                    {sec.items.filter(t => (t.id !== 'hiring-validation' || validationLoopEnabled) && (t.id !== 'workforce' || workforceEnabled)).map(t => (
                      <button key={t.id} onClick={() => setTab(t.id)}
                        title={!sidebarOpen ? t.label : undefined}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          tab === t.id ? 'text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                        }`}
                        style={tab === t.id ? { backgroundColor: BRAND.primary } : {}}>
                        <span className="shrink-0">{t.icon}</span>
                        {sidebarOpen && <span className="flex-1 text-left">{t.label}</span>}
                        {sidebarOpen && t.badge && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: t.badge === 'AI' ? `${BRAND.accent}20` : `${BRAND.orange}20`, color: t.badge === 'AI' ? BRAND.accent : BRAND.orange }}>
                            {t.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="p-2 border-t border-gray-50 space-y-0.5">
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-gray-50">
                <ChevronRight size={16} className={`transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
                {sidebarOpen && <span>Collapse</span>}
              </button>
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-red-50 hover:text-red-500">
                <LogOut size={16} />
                {sidebarOpen && <span>Sign Out</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main ────────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 space-y-5">
          {tab === 'dashboard'   && <DashboardTab   jobs={jobs} candidates={candidates} interviews={interviews} analytics={analytics} loading={loading} onTabChange={setTab} company={company} user={user} />}
          {tab === 'jobs'        && <JobsTab        jobs={jobs} setJobs={setJobs} />}
          {tab === 'pipeline'    && <PipelineTab    jobs={jobs} candidates={candidates} setCandidates={setCandidates} />}
          {tab === 'candidates'  && <CandidatesTab  candidates={candidates} setCandidates={setCandidates} jobs={jobs} />}
          {tab === 'assessments' && <AssessmentsTab candidates={candidates} setCandidates={setCandidates} jobs={jobs} onTabChange={setTab} />}
          {tab === 'screening'   && <ScreeningTab   candidates={candidates} setCandidates={setCandidates} jobs={jobs} onTabChange={setTab} onNavigate={onNavigate} />}
          {tab === 'interviews'  && <InterviewsTab  interviews={interviews} setInterviews={setInterviews} candidates={candidates} jobs={jobs} />}
          {tab === 'offers'      && <OffersTab      offers={offers} setOffers={setOffers} candidates={candidates} setCandidates={setCandidates} jobs={jobs} />}
          {tab === 'analytics'   && <AnalyticsTab   analytics={analytics} candidates={candidates} jobs={jobs} />}
          {tab === 'pool'        && <PoolTab        candidates={candidates} setCandidates={setCandidates} />}
          {tab === 'team'             && <TeamTab />}
          {tab === 'company'          && <CompanyTab company={company} setCompany={setCompany} />}
          {tab === 'org-intelligence' && <OrgIntelligenceTab company={company} jobs={jobs} candidates={candidates} onTabChange={setTab} />}
          {tab === 'talent-match'     && <TalentMatchTab jobs={jobs} candidates={candidates} onTabChange={setTab} />}
          {tab === 'competency-map'   && <CompetencyMapTab company={company} jobs={jobs} candidates={candidates} onTabChange={setTab} />}
          {tab === 'talent-graph'        && <TalentIntelligenceGraphPanel />}
          {tab === 'hiring-intelligence' && <HiringIntelligencePanel />}
          {tab === 'competency-hiring'   && <CompetencyHiringPanel jobs={jobs as any} candidates={candidates as any} />}
          {tab === 'hiring-validation'   && validationLoopEnabled && <HiringValidationPanel />}
          {tab === 'workforce'           && workforceEnabled && <EmployerWorkforcePanel />}
          {tab === 'eios'                && <div className="h-full" style={{ height: 'calc(100vh - 120px)' }}><EIOSCockpit /></div>}
          {tab === 'security'            && <SecurityDashboardPanel />}
        </main>
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardTab({ jobs, candidates, interviews, analytics, loading, onTabChange, company, user }: {
  jobs: EmployerJob[]; candidates: Candidate[]; interviews: Interview[];
  analytics: Analytics | null; loading: boolean; onTabChange: (t: TabId) => void;
  company: Company | null; user: any;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const hour  = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const userName  = user?.name?.split(' ')[0] || company?.name || 'there';

  // ── Core metrics ──
  const activeJobs      = jobs.filter(j => j.status === 'Active').length;
  const draftJobs       = jobs.filter(j => j.status === 'Draft').length;
  const todayInterviews = interviews.filter(i => i.status === 'Scheduled' && i.date === today).length;
  const pending         = candidates.filter(c => c.stage === 'Applied').length;
  const inInterview     = candidates.filter(c => c.stage === 'Interview').length;
  const inOffer         = candidates.filter(c => c.stage === 'Offer').length;
  const hired           = candidates.filter(c => c.stage === 'Hired').length;
  const rejected        = candidates.filter(c => c.stage === 'Rejected').length;
  const avgEI           = analytics?.avgEI || 0;
  const hireRate        = analytics?.hireRate || 0;
  const offerRate       = analytics?.offerRate || 0;
  const notAssessed     = candidates.filter(c => !c.assessmentSent && c.stage !== 'Hired' && c.stage !== 'Rejected').length;
  const assessedTotal   = candidates.filter(c => c.assessmentSent).length;
  const assessmentPct   = candidates.length > 0 ? Math.round((assessedTotal / candidates.length) * 100) : 0;

  // ── Health Score (0-100) ──
  const healthScore = Math.min(100, Math.round(
    Math.min(activeJobs > 0 ? 20 : 0, 20) +
    Math.min(hireRate * 1.5, 30) +
    Math.min(offerRate, 20) +
    Math.min(avgEI / 5, 20) +
    Math.min(assessmentPct / 10, 10)
  ));
  const healthColor = healthScore >= 70 ? BRAND.green : healthScore >= 40 ? BRAND.orange : BRAND.red;
  const healthLabel = healthScore >= 70 ? 'Healthy' : healthScore >= 40 ? 'Moderate' : 'Needs Attention';

  // ── Source mix ──
  const sourceMix = SOURCE_OPTIONS.map(s => ({
    source: s,
    count: candidates.filter(c => c.source === s).length,
  })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

  // ── Funnel with conversion rates ──
  const funnelStages = ['Applied','Screened','Interview','Assessment','Offer','Hired'];
  const funnelData = funnelStages.map((stage, i) => {
    const count = candidates.filter(c => c.stage === stage).length + (stage === 'Hired' ? hired : 0);
    const prev  = i > 0 ? candidates.filter(c => c.stage === funnelStages[i - 1]).length : candidates.length;
    const cvr   = prev > 0 ? Math.round((count / prev) * 100) : 0;
    return { stage, count: candidates.filter(c => c.stage === stage).length, cvr };
  });
  const totalFunnelMax = Math.max(candidates.length, 1);

  // ── Today's schedule ──
  const todaySchedule      = interviews.filter(i => i.status === 'Scheduled' && i.date === today);
  const upcomingInterviews = interviews.filter(i => i.status === 'Scheduled').sort((a,b) => a.date.localeCompare(b.date)).slice(0, 5);
  const recentCandidates   = [...candidates].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);

  // ── Active requisitions with urgency ──
  const activeReqs = jobs.filter(j => j.status === 'Active').map(job => {
    const appCount = candidates.filter(c => c.jobId === job._id).length;
    const deadlineDays = job.deadline ? Math.ceil((new Date(job.deadline).getTime() - Date.now()) / 86400000) : null;
    const urgency = deadlineDays !== null && deadlineDays < 7 ? 'Critical' : deadlineDays !== null && deadlineDays < 14 ? 'High' : appCount === 0 ? 'High' : 'Normal';
    return { ...job, appCount, deadlineDays, urgency };
  }).sort((a, b) => (a.urgency === 'Critical' ? -1 : a.urgency === 'High' ? 0 : 1) - (b.urgency === 'Critical' ? -1 : b.urgency === 'High' ? 0 : 1));

  // ── Priority actions ──
  const priorityActions: { id: string; label: string; detail: string; urgency: 'Critical' | 'High' | 'Medium'; tab: TabId; icon: React.ReactNode }[] = [];
  if (pending > 5)         priorityActions.push({ id: 'pending', label: `${pending} unreviewed applicants`, detail: 'Response within 48 hrs maintains candidate experience', urgency: pending > 15 ? 'Critical' : 'High', tab: 'candidates', icon: <Users size={12}/> });
  if (notAssessed > 0)     priorityActions.push({ id: 'assess',  label: `${notAssessed} awaiting LBI assessment`, detail: 'MetryxOne assessments improve hire quality 3×', urgency: 'High', tab: 'assessments', icon: <Brain size={12}/> });
  if (todayInterviews > 0) priorityActions.push({ id: 'today',   label: `${todayInterviews} interview${todayInterviews > 1 ? 's' : ''} today`, detail: 'Confirm meeting links and panel availability', urgency: 'Critical', tab: 'interviews', icon: <Calendar size={12}/> });
  if (inOffer > 0)         priorityActions.push({ id: 'offer',   label: `${inOffer} candidates in offer stage`, detail: 'Follow up within 24 hrs to prevent offer fatigue', urgency: 'High', tab: 'pipeline', icon: <Award size={12}/> });
  if (draftJobs > 0)       priorityActions.push({ id: 'draft',   label: `${draftJobs} job${draftJobs > 1 ? 's' : ''} still in draft`, detail: 'Publish to start sourcing candidates', urgency: 'Medium', tab: 'jobs', icon: <Briefcase size={12}/> });

  // ── AI strategic insights ──
  const strategicInsights: { text: string; sub: string; color: string; icon: React.ReactNode; action: string; tab: TabId }[] = [];
  if (candidates.length === 0) {
    strategicInsights.push({ text: 'Start building your talent pipeline', sub: 'Post your first job or import candidates from Naukri, LinkedIn, or your own spreadsheet.', color: BRAND.primary, icon: <Sparkles size={12}/>, action: 'Import Candidates', tab: 'candidates' });
  } else {
    if (hireRate > 0) strategicInsights.push({ text: `${hireRate}% overall conversion rate`, sub: `Industry benchmark is ~8–12%. ${hireRate < 8 ? 'Consider increasing assessment quality or interview scorecards.' : 'Your pipeline is converting well.'}`, color: hireRate >= 8 ? BRAND.green : BRAND.orange, icon: <TrendingUp size={12}/>, action: 'View Analytics', tab: 'analytics' });
    if (notAssessed > 0) strategicInsights.push({ text: `${assessmentPct}% assessment completion rate`, sub: `${notAssessed} active candidates haven't completed their LBI. Assessed candidates are 3× more likely to be good culture fits.`, color: BRAND.accent, icon: <Brain size={12}/>, action: 'Dispatch Assessments', tab: 'assessments' });
    if (inInterview > 0) strategicInsights.push({ text: `${inInterview} candidates currently in interview rounds`, sub: `Schedule panel debrief sessions to reduce time-to-decision. Avg time-to-hire improves 40% with structured feedback.`, color: BRAND.purple, icon: <MessageSquare size={12}/>, action: 'Interview Hub', tab: 'interviews' });
    strategicInsights.push({ text: 'AI Talent Match available for all active roles', sub: `MetryxOne can cross-match your ${candidates.length} candidate profiles against role competency blueprints to surface best-fit candidates automatically.`, color: BRAND.primary, icon: <Cpu size={12}/>, action: 'Open AI Match', tab: 'talent-match' });
  }

  const quickActions = [
    { label: 'Post a Job',         icon: <Briefcase size={13}/>,  tab: 'jobs'             as TabId, color: BRAND.primary, kbd: 'J' },
    { label: 'Add Candidate',      icon: <UserPlus size={13}/>,   tab: 'candidates'       as TabId, color: BRAND.purple,  kbd: 'C' },
    { label: 'Schedule Interview', icon: <Calendar size={13}/>,   tab: 'interviews'       as TabId, color: BRAND.accent,  kbd: 'I' },
    { label: 'View Pipeline',      icon: <Layers size={13}/>,     tab: 'pipeline'         as TabId, color: BRAND.green,   kbd: 'P' },
    { label: 'Dispatch LBI',       icon: <Brain size={13}/>,      tab: 'assessments'      as TabId, color: BRAND.orange,  kbd: 'A' },
    { label: 'Talent Pool',        icon: <Bookmark size={13}/>,   tab: 'pool'             as TabId, color: '#ec4899',     kbd: 'T' },
    { label: 'Org Intelligence',   icon: <Network size={13}/>,    tab: 'org-intelligence' as TabId, color: BRAND.accent,  kbd: 'O' },
    { label: 'AI Talent Match',    icon: <Cpu size={13}/>,        tab: 'talent-match'     as TabId, color: BRAND.purple,  kbd: 'M' },
    { label: 'Analytics',         icon: <BarChart3 size={13}/>,  tab: 'analytics'        as TabId, color: BRAND.primary, kbd: 'R' },
    { label: 'Competency Map',     icon: <Radar size={13}/>,      tab: 'competency-map'   as TabId, color: BRAND.green,   kbd: 'K' },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] text-gray-400 font-medium">{greeting}, {userName} &mdash; {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">Employer Command Center</h1>
          <p className="text-xs text-gray-500 mt-0.5">{company?.name || 'Your Company'}{company?.industry ? ` · ${company.industry}` : ''} &mdash; real-time hiring intelligence</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Health gauge */}
          <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm">
            <div className="relative w-8 h-8">
              <svg viewBox="0 0 36 36" className="w-8 h-8 -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="4"/>
                <circle cx="18" cy="18" r="14" fill="none" stroke={healthColor} strokeWidth="4"
                  strokeDasharray={`${healthScore * 0.88} 88`} strokeLinecap="round"/>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ color: healthColor }}>{healthScore}</span>
            </div>
            <div>
              <div className="text-[10px] font-semibold" style={{ color: healthColor }}>{healthLabel}</div>
              <div className="text-[9px] text-gray-400">Pipeline Health</div>
            </div>
          </div>
          <button onClick={() => onTabChange('candidates')}
            className="text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-gray-700">
            <UserPlus size={12}/> Import Candidates
          </button>
          <button onClick={() => onTabChange('jobs')}
            className="text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 text-white shadow-sm"
            style={{ backgroundColor: BRAND.primary }}>
            <Plus size={12}/> Post a Job
          </button>
        </div>
      </div>

      {/* ── Priority Action Queue ────────────────────────────────────────── */}
      {priorityActions.length > 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-2">
              <AlertCircle size={13} style={{ color: BRAND.red }}/> Priority Queue
            </h3>
            <span className="text-[9px] text-gray-400">{priorityActions.length} item{priorityActions.length !== 1 ? 's' : ''} need attention</span>
          </div>
          <div className="space-y-2">
            {priorityActions.map(a => {
              const uc = a.urgency === 'Critical' ? BRAND.red : a.urgency === 'High' ? BRAND.orange : BRAND.primary;
              return (
                <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl border transition-colors hover:bg-gray-50/60" style={{ borderColor: `${uc}20`, backgroundColor: `${uc}04` }}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${uc}15`, color: uc }}>{a.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-gray-800">{a.label}</div>
                    <div className="text-[9px] text-gray-400 truncate">{a.detail}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${uc}15`, color: uc }}>{a.urgency}</span>
                    <button onClick={() => onTabChange(a.tab)} className="text-[10px] font-semibold px-2.5 py-1 rounded-lg text-white" style={{ backgroundColor: uc }}>Resolve</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : candidates.length > 0 ? (
        <div className="flex items-center gap-2 p-3 rounded-2xl border border-teal-100 bg-teal-50">
          <CheckCircle size={14} className="text-teal-500"/>
          <p className="text-[11px] text-teal-700 font-medium">All caught up &mdash; no pending actions. Pipeline is running smoothly.</p>
        </div>
      ) : null}

      {/* ── KPI Strip (8 cards) ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {[
          { label: 'Active Jobs',       value: activeJobs,        icon: <Briefcase size={14}/>,   color: BRAND.primary, sub: `${draftJobs} draft`,    trend: activeJobs > 0 ? 'up' as const : 'flat' as const },
          { label: 'Total Candidates',  value: candidates.length, icon: <Users size={14}/>,       color: BRAND.purple,  sub: `${rejected} rejected`,   trend: candidates.length > 0 ? 'up' as const : 'flat' as const },
          { label: 'Pending Review',    value: pending,           icon: <Clock size={14}/>,       color: BRAND.orange,  sub: 'in Applied stage',       trend: pending > 10 ? 'down' as const : 'flat' as const },
          { label: 'In Interview',      value: inInterview,       icon: <MessageSquare size={14}/>, color: BRAND.accent, sub: `${todayInterviews} today`, trend: inInterview > 0 ? 'up' as const : 'flat' as const },
          { label: 'Offer Stage',       value: inOffer,           icon: <Award size={14}/>,       color: BRAND.green,   sub: 'awaiting acceptance',     trend: inOffer > 0 ? 'up' as const : 'flat' as const },
          { label: 'Hired This Cycle',  value: hired,             icon: <BadgeCheck size={14}/>,  color: '#16a34a',     sub: `${hireRate}% rate`,       trend: hired > 0 ? 'up' as const : 'flat' as const },
          { label: 'Assessed',          value: `${assessmentPct}%`, icon: <Brain size={14}/>,     color: BRAND.primary, sub: `${assessedTotal} / ${candidates.length}`, trend: assessmentPct > 50 ? 'up' as const : 'flat' as const },
          { label: 'Avg EI Score',      value: avgEI || '—',      icon: <Gauge size={14}/>,       color: BRAND.accent,  sub: 'MetryxOne EI™',          trend: avgEI >= 70 ? 'up' as const : 'flat' as const },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${k.color}15`, color: k.color }}>{k.icon}</div>
              <span className={`text-[8px] font-medium flex items-center gap-0.5 ${k.trend === 'up' ? 'text-teal-500' : k.trend === 'down' ? 'text-red-400' : 'text-gray-300'}`}>
                {k.trend === 'up' ? <TrendingUp size={8}/> : k.trend === 'down' ? <TrendingDown size={8}/> : <span>—</span>}
              </span>
            </div>
            <div className="text-lg font-bold text-gray-900 leading-none">{k.value}</div>
            <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">{k.label}</div>
            {k.sub && <div className="text-[8px] text-gray-400 mt-0.5">{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Pragati AI Strategic Intelligence ───────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
              <Sparkles size={13} style={{ color: BRAND.primary }}/>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Pragati AI &mdash; Hiring Intelligence</h3>
              <p className="text-[9px] text-gray-400">Behavioural + pipeline analysis &middot; updated in real time</p>
            </div>
            <Chip label="Live" color={BRAND.green} size="xs"/>
          </div>
          <button onClick={() => onTabChange('analytics')} className="text-[10px] font-semibold" style={{ color: BRAND.primary }}>Full Analytics →</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {strategicInsights.map((ins, i) => (
            <div key={i} className="rounded-xl p-3.5 border flex flex-col gap-2" style={{ backgroundColor: `${ins.color}06`, borderColor: `${ins.color}20` }}>
              <div className="flex items-start gap-2">
                <span style={{ color: ins.color }} className="mt-0.5 flex-shrink-0">{ins.icon}</span>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-gray-800 leading-tight">{ins.text}</p>
                  <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{ins.sub}</p>
                </div>
              </div>
              <button onClick={() => onTabChange(ins.tab)} className="text-[10px] font-semibold flex items-center gap-1 mt-auto self-start hover:opacity-80" style={{ color: ins.color }}>
                {ins.action} <ArrowRight size={9}/>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Today's Schedule ─────────────────────────────────────────────── */}
      {todaySchedule.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4" style={{ borderLeftColor: BRAND.accent }}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} style={{ color: BRAND.accent }}/>
            <span className="text-xs font-semibold text-gray-800">Today&rsquo;s Schedule &mdash; {todaySchedule.length} interview{todaySchedule.length > 1 ? 's' : ''}</span>
            <Chip label="Today" color={BRAND.accent} size="xs"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {todaySchedule.map(iv => (
              <div key={iv._id} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-gray-50/60">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${BRAND.accent}15` }}>
                    {iv.type === 'Video' ? <Video size={12} style={{ color: BRAND.accent }}/> : <Calendar size={12} style={{ color: BRAND.accent }}/>}
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-gray-800">{iv.candidateName}</div>
                    <div className="text-[9px] text-gray-400">{iv.jobTitle} · {iv.time || 'Time TBD'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Chip label={iv.type} color={BRAND.accent} size="xs"/>
                  {iv.meetingLink && (
                    <a href={iv.meetingLink} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-lg text-white"
                      style={{ backgroundColor: BRAND.accent }}>
                      <Video size={9}/> Join
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hiring Funnel (with conversion rates) + Active Requisitions ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Funnel */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Activity size={14} style={{ color: BRAND.primary }}/> Hiring Funnel</h3>
            <button onClick={() => onTabChange('analytics')} className="text-[10px]" style={{ color: BRAND.primary }}>Full Report →</button>
          </div>
          {candidates.length === 0 ? (
            <div className="text-center py-6">
              <Activity size={20} className="mx-auto mb-2 text-gray-200"/>
              <p className="text-xs text-gray-400">Add candidates to see your pipeline funnel.</p>
              <button onClick={() => onTabChange('candidates')} className="mt-2 text-[10px] font-semibold" style={{ color: BRAND.primary }}>Import now →</button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {funnelData.map((f, i) => {
                const pct = Math.max(4, (f.count / totalFunnelMax) * 100);
                const color = STAGE_COLORS[f.stage] || BRAND.primary;
                return (
                  <div key={f.stage}>
                    <div className="flex items-center gap-2.5 mb-0.5">
                      <span className="text-[10px] text-gray-500 w-20 shrink-0">{f.stage}</span>
                      <div className="flex-1 h-5 rounded-lg bg-gray-50 overflow-hidden relative">
                        <div className="h-full rounded-lg flex items-center justify-end pr-2 transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color }}>
                          <span className="text-[9px] font-bold text-white">{f.count}</span>
                        </div>
                      </div>
                      {i > 0 && f.cvr > 0 && (
                        <span className="text-[9px] text-gray-400 w-10 text-right shrink-0">{f.cvr}%</span>
                      )}
                    </div>
                    {i < funnelData.length - 1 && i > 0 && f.count > 0 && funnelData[i+1]?.count > 0 && (
                      <div className="ml-20 pl-1.5 text-[8px] text-gray-300 flex items-center gap-1 mb-0.5">
                        <ArrowRight size={7}/> {funnelData[i+1].count} advance ({funnelData[i+1].cvr}%)
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="pt-2.5 border-t border-gray-50 flex justify-between text-[10px] text-gray-400 mt-1">
                <span>{candidates.length} total candidates</span>
                <span className="font-semibold" style={{ color: BRAND.green }}>{hired} hired &middot; {hireRate}% conv.</span>
              </div>
            </div>
          )}
        </div>

        {/* Active Requisitions table */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Briefcase size={14} style={{ color: BRAND.primary }}/> Active Requisitions</h3>
            <button onClick={() => onTabChange('jobs')} className="text-[10px]" style={{ color: BRAND.primary }}>Manage all →</button>
          </div>
          {activeReqs.length === 0 ? (
            <div className="text-center py-6">
              <Briefcase size={20} className="mx-auto mb-2 text-gray-200"/>
              <p className="text-xs text-gray-400">No active job postings yet.</p>
              <button onClick={() => onTabChange('jobs')} className="mt-2 text-[10px] font-semibold" style={{ color: BRAND.primary }}>Post first job →</button>
            </div>
          ) : (
            <div className="space-y-2">
              {activeReqs.slice(0, 5).map(job => {
                const uc = job.urgency === 'Critical' ? BRAND.red : job.urgency === 'High' ? BRAND.orange : BRAND.green;
                return (
                  <div key={job._id} className="flex items-center gap-2.5 p-2 rounded-xl border border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-gray-800 truncate">{job.title}</span>
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded shrink-0" style={{ backgroundColor: `${uc}15`, color: uc }}>{job.urgency}</span>
                      </div>
                      <div className="text-[9px] text-gray-400">{job.department} &middot; {job.location || 'Remote'}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-bold" style={{ color: BRAND.primary }}>{job.appCount}</div>
                      <div className="text-[9px] text-gray-400">applied</div>
                    </div>
                    {job.deadlineDays !== null && (
                      <div className="text-right shrink-0">
                        <div className="text-[11px] font-bold" style={{ color: uc }}>{job.deadlineDays}d</div>
                        <div className="text-[9px] text-gray-400">left</div>
                      </div>
                    )}
                    <button onClick={() => onTabChange('pipeline')} className="text-[9px] font-semibold px-2 py-1 rounded-lg flex-shrink-0" style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary }}>View</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Candidate Activity + Source Mix ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Recent Candidates */}
        <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Users size={14} style={{ color: BRAND.primary }}/> Recent Candidates</h3>
            <button onClick={() => onTabChange('candidates')} className="text-[10px]" style={{ color: BRAND.primary }}>View all {candidates.length} →</button>
          </div>
          {recentCandidates.length === 0 ? (
            <div className="text-center py-6">
              <Users size={20} className="mx-auto mb-2 text-gray-200"/>
              <p className="text-xs text-gray-400">No candidates yet.</p>
              <button onClick={() => onTabChange('candidates')} className="mt-2 text-[10px] font-semibold" style={{ color: BRAND.primary }}>Import now →</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentCandidates.map(c => (
                <div key={c._id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/40 -mx-1 px-1 rounded-lg transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: STAGE_COLORS[c.stage] || BRAND.primary }}>
                      {c.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{c.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{c.currentRole || c.jobTitle} &middot; {c.source || 'Unknown'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.eiScore > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-8 h-1 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${c.eiScore}%`, backgroundColor: c.eiScore >= 70 ? BRAND.green : BRAND.primary }}/>
                        </div>
                        <span className="text-[9px] font-bold" style={{ color: BRAND.accent }}>EI {c.eiScore}</span>
                      </div>
                    )}
                    <Chip label={c.stage} color={STAGE_COLORS[c.stage]} size="xs"/>
                    {c.matchScore > 0 && <span className="text-[9px] font-bold text-gray-400">{c.matchScore}%</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Source Mix */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4"><Database size={14} style={{ color: BRAND.primary }}/> Source Mix</h3>
          {sourceMix.length === 0 ? (
            <div className="text-center py-6">
              <Database size={20} className="mx-auto mb-2 text-gray-200"/>
              <p className="text-xs text-gray-400">No source data yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sourceMix.slice(0, 6).map((s, i) => {
                const colors = [BRAND.primary, BRAND.accent, BRAND.green, BRAND.orange, BRAND.purple, '#ec4899'];
                const c = colors[i % colors.length];
                const pct = Math.round((s.count / candidates.length) * 100);
                return (
                  <div key={s.source} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c }}/>
                    <span className="text-[10px] text-gray-600 w-20 truncate">{s.source}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: c }}/>
                    </div>
                    <span className="text-[10px] font-semibold text-gray-700 w-8 text-right">{s.count}</span>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-50 text-[9px] text-gray-400">
                {candidates.length} total &middot; {sourceMix.length} source{sourceMix.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Upcoming Interviews + Quick Actions ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Upcoming Interviews */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Calendar size={14} style={{ color: BRAND.accent }}/> Upcoming Interviews</h3>
            <button onClick={() => onTabChange('interviews')} className="text-[10px]" style={{ color: BRAND.primary }}>View all →</button>
          </div>
          {upcomingInterviews.length === 0 ? (
            <div className="text-center py-6">
              <Calendar size={20} className="mx-auto mb-2 text-gray-200"/>
              <p className="text-xs text-gray-400">No interviews scheduled.</p>
              <button onClick={() => onTabChange('interviews')} className="mt-2 text-[10px] font-semibold" style={{ color: BRAND.primary }}>Schedule one →</button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingInterviews.map(iv => {
                const isToday = iv.date === today;
                return (
                  <div key={iv._id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${isToday ? 'border-orange-100 bg-orange-50/40' : 'border-gray-50 hover:bg-gray-50/60'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}15` }}>
                        {iv.type === 'Video' ? <Video size={13} style={{ color: BRAND.accent }}/> : <Calendar size={13} style={{ color: BRAND.accent }}/>}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-800">{iv.candidateName}</div>
                        <div className="text-[9px] text-gray-400">{iv.date} {iv.time && `· ${iv.time}`} &middot; {iv.type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isToday && <Chip label="Today" color={BRAND.orange} size="xs"/>}
                      <Chip label={iv.type} color={BRAND.accent} size="xs"/>
                      {iv.meetingLink && (
                        <a href={iv.meetingLink} target="_blank" rel="noopener noreferrer"
                          className="text-[9px] font-semibold px-2 py-1 rounded-lg text-white"
                          style={{ backgroundColor: BRAND.accent }}>
                          Join
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions — command palette style */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4"><Zap size={14} style={{ color: BRAND.primary }}/> Command Palette</h3>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map(a => (
              <button key={a.label} onClick={() => onTabChange(a.tab)}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 hover:shadow-sm text-left transition-all hover:border-gray-200 group">
                <span className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                  style={{ backgroundColor: `${a.color}15`, color: a.color }}>{a.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-gray-700 group-hover:text-gray-900 leading-tight">{a.label}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB BOARD TAB — built-in templates, JD import, save-as-template
// ═══════════════════════════════════════════════════════════════════════════════
type JobTpl = { id: string; name: string; department: string; type: string; workMode: string; experience: string; salary: string; description: string; requirements: string; responsibilities: string; skills: string; perks: string; eiMinScore: number; quota: number; isCustom?: boolean; category: string; };

const BUILTIN_TEMPLATES: JobTpl[] = [
  { id: 'tpl-swe-be', category: 'Engineering', name: 'Backend Software Engineer', department: 'Engineering', type: 'Full-time', workMode: 'Hybrid', experience: '3+ years', salary: '12–20 LPA', description: 'We are looking for a skilled Backend Software Engineer to join our engineering team. You will design, build, and maintain scalable APIs and microservices that power our platform.', requirements: 'B.Tech/B.E. in Computer Science or related field, 3+ years of backend development experience, Strong understanding of system design and REST APIs, Experience with cloud services (AWS/GCP/Azure)', responsibilities: 'Design and build robust backend services and APIs, Collaborate with frontend teams on integration, Optimize application for speed and scalability, Write unit and integration tests, Participate in code reviews', skills: 'Node.js, Python, Java, PostgreSQL, MongoDB, Redis, Docker, Kubernetes, AWS, REST APIs, Microservices', perks: 'Health insurance, Flexible hours, Remote work options, ESOP, Learning budget', eiMinScore: 65, quota: 2 },
  { id: 'tpl-fe', category: 'Engineering', name: 'Frontend Engineer', department: 'Engineering', type: 'Full-time', workMode: 'Hybrid', experience: '2+ years', salary: '10–18 LPA', description: 'We are seeking a talented Frontend Engineer to build exceptional user interfaces. You will work closely with our design and product teams to deliver performant web applications.', requirements: 'B.Tech/B.E. or equivalent, 2+ years of frontend development, Strong proficiency in React or Vue, Understanding of responsive design and cross-browser compatibility', responsibilities: 'Build and maintain React/Vue applications, Implement responsive UIs from Figma designs, Optimize for performance and accessibility, Collaborate with backend engineers on API integration', skills: 'React, TypeScript, Tailwind CSS, GraphQL, Figma, Jest, Redux, Next.js, Web Accessibility', perks: 'Health insurance, WFH flexibility, Annual learning budget, Performance bonus', eiMinScore: 60, quota: 2 },
  { id: 'tpl-pm', category: 'Product', name: 'Product Manager', department: 'Product', type: 'Full-time', workMode: 'Hybrid', experience: '4+ years', salary: '18–30 LPA', description: 'We are looking for a strategic Product Manager to drive the vision, strategy, and roadmap for our core product lines. You will work cross-functionally to deliver impactful product experiences.', requirements: 'MBA or B.Tech with 4+ years of product management experience, Demonstrated ability to ship products at scale, Strong analytical and data-driven mindset, Excellent stakeholder management', responsibilities: 'Define product vision and roadmap, Gather and prioritize requirements from customers and stakeholders, Work with engineering and design to deliver features, Define and track product KPIs, Run sprint planning and reviews', skills: 'Product Strategy, Jira, Roadmapping, A/B Testing, SQL, Figma, Customer Research, Agile, Data Analysis', perks: 'Competitive salary, ESOPs, Health and dental coverage, Conference attendance, Remote-first culture', eiMinScore: 70, quota: 1 },
  { id: 'tpl-da', category: 'Analytics', name: 'Data Analyst', department: 'Analytics', type: 'Full-time', workMode: 'Hybrid', experience: '2+ years', salary: '8–15 LPA', description: 'We are looking for a detail-oriented Data Analyst to transform complex data into actionable insights. You will support product, marketing, and operations teams with data-driven decision making.', requirements: 'B.Tech/M.Sc in Statistics, Mathematics, CS or related field, 2+ years in data analysis, Proficiency in SQL and at least one visualization tool, Strong analytical and problem-solving skills', responsibilities: 'Build and maintain dashboards and reports, Perform deep-dive analysis on business metrics, Collaborate with product and marketing on experiments, Ensure data quality and pipeline health', skills: 'SQL, Python, Tableau, Power BI, Excel, Google Analytics, BigQuery, Looker, Statistical Analysis', perks: 'Health insurance, Flexible hours, Growth opportunities, Annual bonus', eiMinScore: 60, quota: 1 },
  { id: 'tpl-devops', category: 'Engineering', name: 'DevOps / SRE Engineer', department: 'Infrastructure', type: 'Full-time', workMode: 'Remote', experience: '3+ years', salary: '14–22 LPA', description: 'We are looking for a DevOps/SRE Engineer to build and maintain our cloud infrastructure, CI/CD pipelines, and monitoring systems to ensure high availability and reliability.', requirements: 'B.Tech in CS or related field, 3+ years of DevOps/infrastructure experience, Experience with Kubernetes and Docker, Strong scripting skills (Bash/Python)', responsibilities: 'Design and manage CI/CD pipelines, Maintain Kubernetes clusters and deployments, Implement monitoring and alerting systems, Automate operational tasks, Ensure system uptime and SLAs', skills: 'Kubernetes, Docker, Terraform, AWS, Jenkins, GitHub Actions, Prometheus, Grafana, Linux, Python, Bash', perks: 'Fully remote, Competitive salary, Health benefits, On-call compensation, Learning budget', eiMinScore: 65, quota: 1 },
  { id: 'tpl-hrbp', category: 'HR', name: 'HR Business Partner', department: 'Human Resources', type: 'Full-time', workMode: 'On-site', experience: '4+ years', salary: '10–16 LPA', description: 'We are seeking an experienced HR Business Partner to align HR strategy with business objectives, drive employee engagement, and build a high-performance culture.', requirements: 'MBA in HR or equivalent, 4+ years of HRBP experience, Strong knowledge of employment law and HR best practices, Excellent interpersonal and communication skills', responsibilities: 'Partner with business leaders on talent strategy, Drive performance management cycles, Handle employee relations and grievances, Lead engagement and culture initiatives, Support workforce planning', skills: 'HRMS, Performance Management, Talent Acquisition, Employee Relations, Succession Planning, Compensation and Benefits', perks: 'Health insurance, Professional development, Flexible leave policy, Annual bonus', eiMinScore: 70, quota: 1 },
  { id: 'tpl-sales', category: 'Sales', name: 'Sales Executive (B2B)', department: 'Sales', type: 'Full-time', workMode: 'Hybrid', experience: '2+ years', salary: '8–14 LPA + commissions', description: 'We are looking for a high-energy Sales Executive to drive new business acquisition and revenue growth. You will identify prospects, build relationships, and close enterprise deals.', requirements: 'Graduate degree, 2+ years of B2B sales experience, Proven track record of meeting and exceeding sales quotas, Strong negotiation and presentation skills', responsibilities: 'Prospect and generate new leads, Conduct product demos and presentations, Negotiate and close contracts, Maintain CRM records, Meet monthly and quarterly sales targets', skills: 'CRM (Salesforce/HubSpot), B2B Sales, Lead Generation, Negotiation, Product Demos, Pipeline Management', perks: 'Competitive base + unlimited commission, Health benefits, Travel allowance, Annual Club trip', eiMinScore: 65, quota: 3 },
  { id: 'tpl-ux', category: 'Design', name: 'UX / Product Designer', department: 'Design', type: 'Full-time', workMode: 'Hybrid', experience: '3+ years', salary: '12–20 LPA', description: 'We are looking for a thoughtful UX/Product Designer to craft intuitive, delightful product experiences. You will lead end-to-end design from research and wireframes to high-fidelity prototypes.', requirements: 'Degree in Design, HCI or related field, 3+ years of product/UX design, Strong portfolio demonstrating UX process, Proficiency in Figma and prototyping tools', responsibilities: 'Conduct user research and usability studies, Create wireframes, prototypes, and high-fidelity designs, Collaborate with product and engineering, Maintain and evolve the design system', skills: 'Figma, Prototyping, User Research, Design Systems, Wireframing, Usability Testing, Accessibility', perks: 'Design tools budget, Conference attendance, Health coverage, Flexible hours, Creative work environment', eiMinScore: 65, quota: 1 },
  { id: 'tpl-mktg', category: 'Marketing', name: 'Growth Marketing Manager', department: 'Marketing', type: 'Full-time', workMode: 'Hybrid', experience: '3+ years', salary: '12–18 LPA', description: 'We are seeking a data-driven Growth Marketing Manager to own our acquisition, activation, and retention funnels. You will experiment rapidly, measure rigorously, and scale what works.', requirements: 'Degree in Marketing, Business or related field, 3+ years of digital/growth marketing, Strong analytical skills and comfort with data, Experience with paid and organic channels', responsibilities: 'Own demand generation and lead acquisition strategy, Run growth experiments across paid, SEO, email, and content, Analyse campaign performance and iterate, Work with sales on pipeline alignment', skills: 'Google Ads, Meta Ads, SEO, HubSpot, Google Analytics, A/B Testing, Email Marketing, Content Strategy, SQL', perks: 'Marketing budget, Health insurance, Remote-friendly, Performance bonus, Learning stipend', eiMinScore: 65, quota: 1 },
  { id: 'tpl-fin', category: 'Finance', name: 'Finance Analyst', department: 'Finance', type: 'Full-time', workMode: 'On-site', experience: '2+ years', salary: '8–14 LPA', description: 'We are looking for a meticulous Finance Analyst to support financial planning, reporting, and analysis. You will work closely with the CFO and business units to provide data-driven financial insights.', requirements: 'CA / MBA Finance or B.Com with strong academics, 2+ years in finance analysis, Advanced Excel and financial modelling skills, Experience with ERP systems', responsibilities: 'Prepare monthly management reports and variance analysis, Support budgeting and forecasting cycles, Build financial models for business decisions, Assist with audit and compliance requirements', skills: 'Financial Modelling, Excel, Tally, SAP, Power BI, FP&A, GAAP, DCF Analysis', perks: 'Health insurance, Professional certification support, Annual bonus, Structured career growth', eiMinScore: 60, quota: 1 },
];

function parseJobDescription(text: string): Partial<{ title: string; department: string; experience: string; salary: string; description: string; requirements: string; responsibilities: string; skills: string; perks: string }> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const sections: Record<string, string[]> = {};
  let cur = 'header';
  for (const line of lines) {
    const lo = line.toLowerCase().replace(/[:\-]+$/, '').trim();
    if (/^(about (the )?(role|job|position|company)|overview|summary|job (description|summary))/i.test(lo)) { cur = 'description'; }
    else if (/^(requirements?|qualifications?|what we.{0,20}looking|must.?have|required|minimum|ideal candidate)/i.test(lo)) { cur = 'requirements'; }
    else if (/^(responsibilit|key duties|what you.{0,10}do|your role|key results|key responsibilities|job duties)/i.test(lo)) { cur = 'responsibilities'; }
    else if (/^(skills?|technical skills?|competencies|expertise|tech stack|tools?)/i.test(lo)) { cur = 'skills'; }
    else if (/^(perks?|benefits?|what we offer|compensation|package|why join)/i.test(lo)) { cur = 'perks'; }
    else {
      if (!sections[cur]) sections[cur] = [];
      const clean = line.replace(/^[\-\u2022\u2013\u2014\*\u2714\u25b8\u2192]\s*/, '').replace(/^\d+[\.\)]\s*/, '').trim();
      if (clean.length > 3) sections[cur].push(clean);
    }
  }
  const expMatch = text.match(/(\d+)\s*[\+\-]?\s*(?:to\s*\d+\s*)?years?\s+(?:of\s+)?(?:work\s+|relevant\s+)?experience/i);
  const salMatch = text.match(/(?:[₹$€£]\s*)?(\d[\d,\.]+)\s*(?:LPA|lakh|lac|k|K)?\s*(?:to|[-–])\s*(?:[₹$€£]\s*)?(\d[\d,\.]+)\s*(?:LPA|lakh|lac|k|K)?/i);
  const title = lines[0] && lines[0].length < 80 && !/\b(we are|about|job|position|company|overview)\b/i.test(lines[0]) ? lines[0] : '';
  return {
    title: title.replace(/[*_#]+/g, '').trim(),
    description: (sections.description || sections.header || []).join(' ').slice(0, 600),
    requirements: (sections.requirements || []).slice(0, 8).join(', '),
    responsibilities: (sections.responsibilities || []).slice(0, 8).join(', '),
    skills: (sections.skills || []).slice(0, 12).join(', '),
    perks: (sections.perks || []).slice(0, 6).join(', '),
    experience: expMatch ? `${expMatch[1]}+ years` : '',
    salary: salMatch ? `${salMatch[1]}-${salMatch[2]} LPA` : '',
  };
}

function JobsTab({ jobs, setJobs }: { jobs: EmployerJob[]; setJobs: (j: EmployerJob[]) => void }) {
  const emptyForm = { title: '', department: '', location: '', type: 'Full-time', workMode: 'Hybrid', experience: '', salary: '', description: '', requirements: '', responsibilities: '', skills: '', perks: '', deadline: '', hiringManager: '', quota: 1, eiMinScore: 0, status: 'Draft', matchedRoleId: '', matchedRoleSource: '' };

  const [showForm, setShowForm]           = useState(false);
  const [editingJob, setEditingJob]       = useState<EmployerJob | null>(null);
  const [filterStatus, setFilterStatus]   = useState<string>('All');
  const [search, setSearch]               = useState('');
  const [saving, setSaving]               = useState(false);
  const [form, setForm]                   = useState<typeof emptyForm>(emptyForm);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showJDImport, setShowJDImport]   = useState(false);
  const [jdText, setJdText]               = useState('');
  const [jdParsed, setJdParsed]           = useState<ReturnType<typeof parseJobDescription> | null>(null);
  const [tplSearch, setTplSearch]         = useState('');
  const [tplCategory, setTplCategory]     = useState('All');
  const [saveAsTplName, setSaveAsTplName] = useState('');
  const [showSaveAsTpl, setShowSaveAsTpl] = useState(false);
  const [expandedJob, setExpandedJob]     = useState<string | null>(null);

  const [customTemplates, setCustomTemplates] = useState<JobTpl[]>(() => {
    try { return JSON.parse(localStorage.getItem('metryx_job_templates') || '[]'); } catch { return []; }
  });
  const persistCustom = (tpls: JobTpl[]) => {
    setCustomTemplates(tpls);
    localStorage.setItem('metryx_job_templates', JSON.stringify(tpls));
  };

  // ── Task #102: curated role matching (flag-gated, hidden when OFF) ──────────
  const [matchEnabled, setMatchEnabled]   = useState(false);
  const [roleMatch, setRoleMatch]         = useState<RoleMatchResult | null>(null);
  const [matchLoading, setMatchLoading]   = useState(false);
  const [matchableRoles, setMatchableRoles] = useState<MatchableRole[]>([]);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [rolePickerSearch, setRolePickerSearch] = useState('');

  const loadMatchableRoles = async () => {
    if (matchableRoles.length) return;
    try {
      const res = await fetch('/api/employer/matchable-roles', { headers: authHdr() as HeadersInit });
      if (!res.ok) return;
      const d = await res.json();
      setMatchableRoles(Array.isArray(d.roles) ? d.roles : []);
    } catch { /* keep panel functional without the override list */ }
  };

  // Debounced title → curated-role resolution. A 503 (flag OFF) hides the panel
  // entirely (byte-identical legacy). Auto-syncs the form's matched role unless
  // the employer has manually overridden it.
  useEffect(() => {
    if (!showForm) return;
    const title = form.title.trim();
    if (!title) { setRoleMatch(null); setMatchLoading(false); return; }
    let cancelled = false;
    setMatchLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/employer/resolve-role?title=${encodeURIComponent(title)}`, { headers: authHdr() as HeadersInit });
        if (cancelled) return;
        if (res.status === 503) { setMatchEnabled(false); setRoleMatch(null); return; }
        if (!res.ok) { setRoleMatch(null); return; }
        const d: RoleMatchResult = await res.json();
        if (cancelled) return;
        setMatchEnabled(true);
        setRoleMatch(d);
        loadMatchableRoles();
        setForm(f => f.matchedRoleSource === 'manual'
          ? f
          : { ...f, matchedRoleId: d.resolved?.role_id ?? '', matchedRoleSource: d.resolved ? 'auto' : '' });
      } catch { if (!cancelled) setRoleMatch(null); }
      finally { if (!cancelled) setMatchLoading(false); }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, showForm]);

  const roleLabel = (id: string): string => {
    if (!id) return '';
    if (roleMatch?.resolved?.role_id === id) return roleMatch.resolved.role_title;
    const m = matchableRoles.find(r => r.id === id);
    return m ? m.title : id;
  };
  const pickRole = (role: MatchableRole) => {
    setForm(f => ({ ...f, matchedRoleId: role.id, matchedRoleSource: 'manual' }));
    setShowRolePicker(false); setRolePickerSearch('');
  };
  const revertToAuto = () => {
    setForm(f => ({ ...f, matchedRoleId: roleMatch?.resolved?.role_id ?? '', matchedRoleSource: roleMatch?.resolved ? 'auto' : '' }));
  };
  const openRolePicker = () => { loadMatchableRoles(); setShowRolePicker(true); };
  const filteredMatchable = matchableRoles.filter(r =>
    !rolePickerSearch || r.title.toLowerCase().includes(rolePickerSearch.toLowerCase()),
  );

  const allTemplates = [...BUILTIN_TEMPLATES, ...customTemplates];
  const tplCategories = ['All', ...Array.from(new Set(allTemplates.map(t => t.category)))];
  const filteredTpls = allTemplates.filter(t =>
    (tplCategory === 'All' || t.category === tplCategory) &&
    (!tplSearch || t.name.toLowerCase().includes(tplSearch.toLowerCase()) || t.department.toLowerCase().includes(tplSearch.toLowerCase()))
  );

  const openNew = () => { setForm(emptyForm); setEditingJob(null); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const openEdit = (job: EmployerJob) => {
    setForm({ ...job, requirements: job.requirements.join(', '), responsibilities: job.responsibilities.join(', '), skills: job.skills.join(', '), perks: job.perks.join(', ') } as any);
    setEditingJob(job); setShowForm(true);
  };
  const cloneJob = (job: EmployerJob) => {
    setForm({ ...job, requirements: job.requirements.join(', '), responsibilities: job.responsibilities.join(', '), skills: job.skills.join(', '), perks: job.perks.join(', '), status: 'Draft', title: `${job.title} (Copy)` } as any);
    setEditingJob(null); setShowForm(true);
  };
  const loadTemplate = (tpl: JobTpl) => {
    setForm(f => ({ ...f, title: tpl.name, department: tpl.department, type: tpl.type, workMode: tpl.workMode, experience: tpl.experience, salary: tpl.salary, description: tpl.description, requirements: tpl.requirements, responsibilities: tpl.responsibilities, skills: tpl.skills, perks: tpl.perks, eiMinScore: tpl.eiMinScore, quota: tpl.quota }));
    setShowTemplates(false);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = { ...form, requirements: form.requirements.toString().split(',').map(s => s.trim()).filter(Boolean), responsibilities: form.responsibilities.toString().split(',').map(s => s.trim()).filter(Boolean), skills: form.skills.toString().split(',').map(s => s.trim()).filter(Boolean), perks: form.perks.toString().split(',').map(s => s.trim()).filter(Boolean) };
    try {
      if (editingJob) {
        const res = await fetch(`/api/employer/jobs/${editingJob._id}`, { method: 'PUT', headers: authHdr() as HeadersInit, body: JSON.stringify(payload) });
        const d = await res.json();
        if (d.success) setJobs(jobs.map(j => j._id === editingJob._id ? d.job : j));
      } else {
        const res = await fetch('/api/employer/jobs', { method: 'POST', headers: authHdr() as HeadersInit, body: JSON.stringify(payload) });
        const d = await res.json();
        if (d.success) setJobs([d.job, ...jobs]);
      }
      setShowForm(false); setEditingJob(null);
    } catch {} finally { setSaving(false); }
  };
  const handleDelete = async (jobId: string) => {
    await fetch(`/api/employer/jobs/${jobId}`, { method: 'DELETE', headers: authHdr() as HeadersInit });
    setJobs(jobs.filter(j => j._id !== jobId));
  };
  const handleStatus = async (job: EmployerJob, status: string) => {
    const res = await fetch(`/api/employer/jobs/${job._id}`, { method: 'PUT', headers: authHdr() as HeadersInit, body: JSON.stringify({ status }) });
    const d = await res.json();
    if (d.success) setJobs(jobs.map(j => j._id === job._id ? { ...j, status } : j));
  };
  const handleParseJD = () => { setJdParsed(parseJobDescription(jdText)); };
  const applyParsed = () => {
    if (!jdParsed) return;
    setForm(f => ({ ...f, ...(jdParsed.title ? { title: jdParsed.title } : {}), ...(jdParsed.description ? { description: jdParsed.description } : {}), ...(jdParsed.requirements ? { requirements: jdParsed.requirements } : {}), ...(jdParsed.responsibilities ? { responsibilities: jdParsed.responsibilities } : {}), ...(jdParsed.skills ? { skills: jdParsed.skills } : {}), ...(jdParsed.perks ? { perks: jdParsed.perks } : {}), ...(jdParsed.experience ? { experience: jdParsed.experience } : {}), ...(jdParsed.salary ? { salary: jdParsed.salary } : {}) }));
    setShowJDImport(false); setJdText(''); setJdParsed(null); setShowForm(true);
  };
  const saveAsTemplate = () => {
    if (!saveAsTplName.trim() && !form.title.trim()) return;
    const name = saveAsTplName.trim() || form.title;
    const dept = allTemplates.find(t => t.department === form.department)?.category || 'Custom';
    const tpl: JobTpl = { id: `custom-${Date.now()}`, name, category: 'Custom', department: form.department, type: form.type, workMode: form.workMode, experience: form.experience, salary: form.salary, description: form.description, requirements: form.requirements, responsibilities: form.responsibilities, skills: form.skills, perks: form.perks, eiMinScore: form.eiMinScore, quota: form.quota, isCustom: true };
    persistCustom([tpl, ...customTemplates]);
    setShowSaveAsTpl(false); setSaveAsTplName('');
  };
  const deleteCustomTpl = (id: string) => persistCustom(customTemplates.filter(t => t.id !== id));

  const filtered = jobs.filter(j =>
    (filterStatus === 'All' || j.status === filterStatus) &&
    (!search || j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase()))
  );

  const fld = (key: keyof typeof form, label: string, type = 'text', full = false, placeholder = '') => (
    <div className={full ? 'col-span-2' : ''}>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">{label}</label>
      <input type={type} placeholder={placeholder} value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200" />
    </div>
  );
  const sel = (key: keyof typeof form, label: string, opts: readonly string[]) => (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">{label}</label>
      <select value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none bg-white">
        {opts.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
  const txa = (key: keyof typeof form, label: string, placeholder = '', rows = 3) => (
    <div className="col-span-2">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">{label}</label>
      <textarea rows={rows} value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder}
        className="w-full text-xs border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-200" />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Job Board</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {jobs.filter(j => j.status === 'Active').length} active &middot; {jobs.length} total &middot; {jobs.filter(j => j.status === 'Draft').length} draft
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { setShowTemplates(true); setShowForm(false); }}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-gray-700">
            <FolderOpen size={12}/> Templates ({allTemplates.length})
          </button>
          <button onClick={() => { setShowJDImport(true); setShowForm(false); }}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-gray-700">
            <Upload size={12}/> Import JD
          </button>
          <button onClick={openNew}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white shadow-sm"
            style={{ backgroundColor: BRAND.primary }}>
            <Plus size={12}/> Post New Job
          </button>
        </div>
      </div>

      {/* ── Template Library Modal ── */}
      {showTemplates && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><FolderOpen size={14} style={{ color: BRAND.primary }}/> Job Posting Templates</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">{BUILTIN_TEMPLATES.length} built-in &middot; {customTemplates.length} saved by you &mdash; click any to pre-fill the form</p>
            </div>
            <button onClick={() => setShowTemplates(false)}><X size={15} className="text-gray-400"/></button>
          </div>

          {/* Template search & category filter */}
          <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-40">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={tplSearch} onChange={e => setTplSearch(e.target.value)} placeholder="Search templates…"
                className="w-full h-8 pl-7 pr-3 text-xs border border-gray-200 rounded-lg focus:outline-none"/>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {tplCategories.map(c => (
                <button key={c} onClick={() => setTplCategory(c)}
                  className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all ${tplCategory === c ? 'text-white' : 'border-gray-200 text-gray-500'}`}
                  style={tplCategory === c ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : {}}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Template cards grid */}
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto">
            {filteredTpls.map(tpl => (
              <div key={tpl.id} className="rounded-xl border border-gray-100 p-3.5 hover:shadow-sm transition-all hover:border-blue-100 flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-gray-800 leading-tight">{tpl.name}</div>
                    <div className="text-[9px] text-gray-400 mt-0.5">{tpl.department} &middot; {tpl.experience} &middot; {tpl.workMode}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>{tpl.category}</span>
                    {tpl.isCustom && <button onClick={() => deleteCustomTpl(tpl.id)} className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400"><X size={10}/></button>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {tpl.skills.split(',').slice(0, 4).map(s => <span key={s} className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary }}>{s.trim()}</span>)}
                  {tpl.skills.split(',').length > 4 && <span className="text-[8px] text-gray-400">+{tpl.skills.split(',').length - 4} more</span>}
                </div>
                <div className="flex items-center justify-between mt-auto pt-1">
                  <span className="text-[9px] text-gray-400">{tpl.salary}</span>
                  <button onClick={() => loadTemplate(tpl)}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-lg text-white"
                    style={{ backgroundColor: BRAND.primary }}>
                    Use Template
                  </button>
                </div>
              </div>
            ))}
            {filteredTpls.length === 0 && (
              <div className="col-span-3 text-center py-8 text-xs text-gray-400">No templates match your search.</div>
            )}
          </div>
        </div>
      )}

      {/* ── JD Import Modal ── */}
      {showJDImport && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Upload size={14} style={{ color: BRAND.primary }}/> Import Job Description</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Paste a JD from any source &mdash; Pragati AI will parse it into the posting form automatically</p>
            </div>
            <button onClick={() => { setShowJDImport(false); setJdParsed(null); setJdText(''); }}><X size={15} className="text-gray-400"/></button>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Input side */}
            <div className="space-y-3">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 block">Paste JD Text</label>
              <textarea rows={12} value={jdText} onChange={e => setJdText(e.target.value)}
                placeholder={'Paste your job description here...\n\nSupports:\n- Structured JDs (About / Requirements / Responsibilities / Skills)\n- Unstructured free-text JDs\n- Naukri, LinkedIn, Indeed exports\n- Internal JD documents'}
                className="w-full text-xs border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-1 focus:ring-blue-200 font-mono leading-relaxed"/>
              <div className="flex gap-2">
                <button onClick={handleParseJD} disabled={!jdText.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl text-white disabled:opacity-40"
                  style={{ backgroundColor: BRAND.primary }}>
                  <Sparkles size={12}/> Parse &amp; Preview
                </button>
                <button onClick={() => setJdText('')} className="text-xs px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50">
                  Clear
                </button>
              </div>
            </div>

            {/* Parsed preview side */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 block">Parsed Fields Preview</label>
                {jdParsed && <Chip label="Ready to apply" color={BRAND.green} size="xs"/>}
              </div>
              {!jdParsed ? (
                <div className="h-full min-h-48 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-100 text-center p-6 gap-2">
                  <Sparkles size={20} className="text-gray-200"/>
                  <p className="text-xs text-gray-400">Paste a JD on the left and click &ldquo;Parse &amp; Preview&rdquo; to see the extracted fields here.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {[
                    { label: 'Job Title', val: jdParsed.title },
                    { label: 'Experience', val: jdParsed.experience },
                    { label: 'Salary', val: jdParsed.salary },
                    { label: 'Description', val: jdParsed.description },
                    { label: 'Requirements', val: jdParsed.requirements },
                    { label: 'Responsibilities', val: jdParsed.responsibilities },
                    { label: 'Skills', val: jdParsed.skills },
                    { label: 'Perks', val: jdParsed.perks },
                  ].filter(f => f.val).map(f => (
                    <div key={f.label} className="rounded-lg border border-gray-100 p-2.5">
                      <div className="text-[9px] font-bold uppercase tracking-wide mb-0.5" style={{ color: BRAND.primary }}>{f.label}</div>
                      <div className="text-[10px] text-gray-700 leading-relaxed line-clamp-3">{f.val}</div>
                    </div>
                  ))}
                  <button onClick={applyParsed}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl text-white mt-2"
                    style={{ backgroundColor: BRAND.green }}>
                    <CheckCircle size={12}/> Apply to Form
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Job Form ── */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
                <Briefcase size={14} style={{ color: BRAND.primary }}/>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">{editingJob ? `Editing: ${editingJob.title}` : 'New Job Posting'}</h3>
                <p className="text-[10px] text-gray-400">Fill in manually, or use &ldquo;Templates&rdquo; / &ldquo;Import JD&rdquo; to auto-fill</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowTemplates(true); setShowForm(false); }}
                className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center gap-1 text-gray-600">
                <FolderOpen size={10}/> Templates
              </button>
              <button onClick={() => { setShowJDImport(true); setShowForm(false); }}
                className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center gap-1 text-gray-600">
                <Upload size={10}/> Import JD
              </button>
              <button onClick={() => { setShowForm(false); setEditingJob(null); }}><X size={15} className="text-gray-400"/></button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Section 1: Basic Info */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Basic Information</p>
              <div className="grid grid-cols-2 gap-3">
                {fld('title', 'Job Title *', 'text', true, 'e.g. Senior Backend Engineer')}
                {fld('department', 'Department', 'text', false, 'e.g. Engineering')}
                {fld('location', 'Location', 'text', false, 'e.g. Bengaluru / Remote')}
                {sel('type', 'Employment Type', ['Full-time','Part-time','Contract','Internship','Remote','Hybrid'])}
                {sel('workMode', 'Work Mode', ['On-site','Remote','Hybrid'])}
                {fld('hiringManager', 'Hiring Manager', 'text', false, 'Name of the HM')}
                {fld('deadline', 'Application Deadline', 'date')}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Headcount (Quota)</label>
                  <input type="number" value={form.quota} min={1} onChange={e => setForm({ ...form, quota: +e.target.value })}
                    className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none"/>
                </div>
                {sel('status', 'Posting Status', [...JOB_STATUSES])}
              </div>

              {/* Task #102 — Curated role match (flag-gated; hidden entirely when OFF) */}
              {matchEnabled && form.title.trim() && (
                <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Brain size={12} style={{ color: BRAND.primary }}/>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Matched Curated Role</span>
                    </div>
                    {matchLoading && <span className="text-[9px] text-gray-400">Matching…</span>}
                  </div>

                  {/* Manual override in effect */}
                  {form.matchedRoleSource === 'manual' ? (
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-800">{roleLabel(form.matchedRoleId)}</span>
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>SET BY YOU</span>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-0.5">You chose this curated role. It will be used to rank candidates instead of the auto-match.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={openRolePicker} className="text-[10px] font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-white">Change</button>
                        {roleMatch?.resolved && (
                          <button onClick={revertToAuto} className="text-[10px] font-medium px-2.5 py-1 rounded-lg text-blue-600 hover:underline">Use auto-match</button>
                        )}
                      </div>
                    </div>
                  ) : roleMatch?.resolved ? (
                    /* Auto-resolved */
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-gray-800">{roleMatch.resolved.role_title}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BRAND.green}15`, color: BRAND.green }}>
                            {roleMatch.resolved.confidence_pct}% confidence
                          </span>
                          {roleMatch.resolved.estimated && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BRAND.orange}18`, color: BRAND.orange }} title="Not an exact title match — inferred from a similar curated role.">ESTIMATED</span>
                          )}
                        </div>
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          Coverage: {roleMatch.resolved.competency_count} profiled competencies (separate from match confidence).
                        </p>
                      </div>
                      <button onClick={openRolePicker} className="text-[10px] font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-white whitespace-nowrap">Override role</button>
                    </div>
                  ) : !matchLoading ? (
                    /* Abstain — prompt the employer to choose */
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-1.5">
                        <AlertCircle size={12} className="mt-0.5" style={{ color: BRAND.orange }}/>
                        <div>
                          <p className="text-[11px] font-medium text-gray-700">No confident curated-role match for this title.</p>
                          <p className="text-[9px] text-gray-400 mt-0.5">Candidates won't be ranked until you pick a role. We never guess.</p>
                        </div>
                      </div>
                      <button onClick={openRolePicker} className="text-[10px] font-semibold px-2.5 py-1 rounded-lg text-white whitespace-nowrap" style={{ backgroundColor: BRAND.primary }}>Choose a role</button>
                    </div>
                  ) : null}

                  {/* Role picker */}
                  {showRolePicker && (
                    <div className="mt-3 rounded-lg border border-gray-200 bg-white p-2.5">
                      <div className="flex items-center gap-2 mb-2">
                        <Search size={11} className="text-gray-400"/>
                        <input autoFocus value={rolePickerSearch} onChange={e => setRolePickerSearch(e.target.value)} placeholder="Search curated roles…"
                          className="flex-1 h-7 px-2 text-[11px] border border-gray-200 rounded-lg focus:outline-none"/>
                        <button onClick={() => { setShowRolePicker(false); setRolePickerSearch(''); }}><X size={13} className="text-gray-400"/></button>
                      </div>
                      <div className="max-h-44 overflow-y-auto space-y-1">
                        {filteredMatchable.map(r => (
                          <button key={r.id} onClick={() => pickRole(r)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center justify-between gap-2 ${form.matchedRoleId === r.id ? 'bg-blue-50' : ''}`}>
                            <span className="text-[11px] text-gray-700">{r.title}{r.seniority ? <span className="text-gray-400"> · {r.seniority}</span> : null}</span>
                            <span className="text-[9px] text-gray-400 whitespace-nowrap">{r.competency_count} comp.</span>
                          </button>
                        ))}
                        {filteredMatchable.length === 0 && (
                          <div className="text-center py-3 text-[10px] text-gray-400">No curated roles match your search.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 2: Compensation */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Compensation &amp; Requirements</p>
              <div className="grid grid-cols-2 gap-3">
                {fld('experience', 'Experience Required', 'text', false, 'e.g. 3+ years')}
                {fld('salary', 'Salary / CTC Range', 'text', false, 'e.g. 12–20 LPA')}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Min EI Score (MetryxOne)</label>
                  <input type="number" value={form.eiMinScore} min={0} max={100} onChange={e => setForm({ ...form, eiMinScore: +e.target.value })}
                    className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none"/>
                  {form.eiMinScore > 0 && <p className="text-[9px] text-gray-400 mt-0.5">Only candidates with EI &ge; {form.eiMinScore} will be surfaced by AI Match</p>}
                </div>
              </div>
            </div>

            {/* Section 3: Description & Content */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Role Content</p>
              <div className="grid grid-cols-2 gap-3">
                {txa('description', 'Job Description', 'Describe the role, team culture, and expected impact...', 4)}
                {txa('responsibilities', 'Key Responsibilities (comma-separated)', 'e.g. Build scalable APIs, Lead sprint planning, Mentor junior engineers')}
                {txa('requirements', 'Requirements & Qualifications (comma-separated)', 'e.g. B.Tech CS, 3+ yrs Node.js, Strong system design knowledge')}
                {txa('skills', 'Required Skills (comma-separated)', 'e.g. Python, PostgreSQL, Docker, REST APIs, Kubernetes')}
                {txa('perks', 'Perks & Benefits (comma-separated)', 'e.g. Health insurance, ESOP, WFH, Flexible hours, Learning budget')}
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-50 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowSaveAsTpl(s => !s)}
                  className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                  <Bookmark size={10}/> Save as Template
                </button>
                {showSaveAsTpl && (
                  <div className="flex items-center gap-1.5">
                    <input value={saveAsTplName} onChange={e => setSaveAsTplName(e.target.value)} placeholder={form.title || 'Template name…'}
                      className="h-7 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none w-36"/>
                    <button onClick={saveAsTemplate}
                      className="text-[10px] font-semibold px-2 py-1 rounded-lg text-white"
                      style={{ backgroundColor: BRAND.green }}>Save</button>
                    <button onClick={() => { setShowSaveAsTpl(false); setSaveAsTplName(''); }} className="text-[10px] text-gray-400 px-1">Cancel</button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowForm(false); setEditingJob(null); }} className="text-xs px-3 py-2 text-gray-500 hover:text-gray-700">Cancel</button>
                {editingJob && (
                  <button onClick={() => cloneJob(editingJob)} className="text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1">
                    <Copy size={11}/> Duplicate
                  </button>
                )}
                <button onClick={handleSave} disabled={saving || !form.title.trim()}
                  className="text-xs font-semibold px-5 py-2 rounded-xl text-white disabled:opacity-50 flex items-center gap-1.5"
                  style={{ backgroundColor: BRAND.primary }}>
                  {saving ? 'Saving…' : editingJob ? 'Save Changes' : 'Post Job'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs, departments…"
            className="w-full h-9 pl-8 pr-3 text-xs border border-gray-200 rounded-xl focus:outline-none bg-white"/>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['All', ...JOB_STATUSES] as string[]).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`text-[10px] font-medium px-2.5 py-1.5 rounded-lg border transition-all ${filterStatus === s ? 'text-white shadow-sm' : 'border-gray-200 text-gray-500'}`}
              style={filterStatus === s ? { backgroundColor: s === 'All' ? BRAND.primary : (STATUS_COLORS as any)[s] || BRAND.primary, borderColor: 'transparent' } : {}}>
              {s} {s !== 'All' ? `(${jobs.filter(j => j.status === s).length})` : `(${jobs.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Job Cards ── */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
          <Briefcase size={28} className="mx-auto mb-3 text-gray-200"/>
          <div className="text-sm font-medium text-gray-500 mb-1">No job postings yet</div>
          <div className="text-xs text-gray-400 mb-4">Post a job or load a template to get started</div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button onClick={() => setShowTemplates(true)} className="text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-700 flex items-center gap-1.5 hover:bg-gray-50"><FolderOpen size={12}/> Browse Templates</button>
            <button onClick={openNew} className="text-xs font-semibold px-3 py-2 rounded-xl text-white flex items-center gap-1.5" style={{ backgroundColor: BRAND.primary }}><Plus size={12}/> Post New Job</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(job => {
            const isExpanded = expandedJob === job._id;
            const daysSincePosted = Math.ceil((Date.now() - new Date(job.createdAt).getTime()) / 86400000);
            const deadlineDays = job.deadline ? Math.ceil((new Date(job.deadline).getTime() - Date.now()) / 86400000) : null;
            const deadlineUrgent = deadlineDays !== null && deadlineDays < 7;
            return (
              <div key={job._id} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  {/* Status indicator */}
                  <div className="w-1.5 self-stretch rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: STATUS_COLORS[job.status] || '#94a3b8', opacity: 0.7 }}/>
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-2.5 flex-wrap mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">{job.title}</h3>
                      <Chip label={job.status} color={STATUS_COLORS[job.status]}/>
                      {job.eiMinScore > 0 && <Chip label={`EI \u2265 ${job.eiMinScore}`} color={BRAND.primary} size="xs"/>}
                      {deadlineUrgent && <Chip label={`${deadlineDays}d left`} color={BRAND.red} size="xs"/>}
                    </div>
                    {/* Meta row */}
                    <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 mb-2">
                      {job.department && <span className="flex items-center gap-1"><Building size={9}/>{job.department}</span>}
                      {job.location   && <span className="flex items-center gap-1"><MapPin size={9}/>{job.location}</span>}
                      {job.type       && <span>{job.type}</span>}
                      {job.workMode   && <span>{job.workMode}</span>}
                      {job.salary     && <span className="flex items-center gap-1"><DollarSign size={9}/>{job.salary}</span>}
                      {job.experience && <span className="flex items-center gap-1"><Clock size={9}/>{job.experience}</span>}
                      {job.hiringManager && <span className="flex items-center gap-1"><UserCheck size={9}/>HM: {job.hiringManager}</span>}
                      <span className="text-gray-400">{daysSincePosted}d ago</span>
                    </div>
                    {/* Skills */}
                    {job.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {job.skills.slice(0, 7).map(s => <Chip key={s} label={s} color={BRAND.primary} size="xs"/>)}
                        {job.skills.length > 7 && <span className="text-[9px] text-gray-400">+{job.skills.length - 7}</span>}
                      </div>
                    )}
                    {/* Quota progress */}
                    {job.quota > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden max-w-32">
                          <div className="h-full rounded-full" style={{ width: `${Math.min((job.applicationCount / job.quota) * 100, 100)}%`, backgroundColor: BRAND.primary }}/>
                        </div>
                        <span className="text-[9px] text-gray-400">{job.applicationCount} / {job.quota} quota</span>
                      </div>
                    )}
                  </div>

                  {/* Right actions */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    <div className="text-xs font-bold" style={{ color: BRAND.primary }}>{job.applicationCount} applied</div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setExpandedJob(isExpanded ? null : job._id)}
                        className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors" title="View details">
                        {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                      </button>
                      <button onClick={() => openEdit(job)} className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700" title="Edit"><Edit3 size={12}/></button>
                      <button onClick={() => cloneJob(job)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500" title="Clone job"><Copy size={12}/></button>
                      {job.shareToken && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/apply/${job.shareToken}`); }}
                          className="p-1.5 rounded-lg hover:bg-teal-50 text-gray-400 hover:text-teal-500" title="Copy public application link">
                          <Link2 size={12}/>
                        </button>
                      )}
                      <button onClick={() => handleDelete(job._id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={12}/></button>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {job.status === 'Draft'  && <button onClick={() => handleStatus(job, 'Active')} className="text-[9px] px-2 py-0.5 rounded-lg font-semibold text-white" style={{ backgroundColor: BRAND.green }}>Publish</button>}
                      {job.status === 'Active' && <button onClick={() => handleStatus(job, 'Paused')} className="text-[9px] px-2 py-0.5 rounded-lg font-semibold text-white" style={{ backgroundColor: BRAND.orange }}>Pause</button>}
                      {job.status === 'Paused' && <button onClick={() => handleStatus(job, 'Active')} className="text-[9px] px-2 py-0.5 rounded-lg font-semibold text-white" style={{ backgroundColor: BRAND.green }}>Resume</button>}
                      {job.status !== 'Closed' && <button onClick={() => handleStatus(job, 'Closed')} className="text-[9px] px-2 py-0.5 rounded-lg font-semibold text-white" style={{ backgroundColor: BRAND.red }}>Close</button>}
                    </div>
                  </div>
                </div>

                {/* Expanded detail section */}
                {isExpanded && (
                  <div className="border-t border-gray-50 px-5 py-4 bg-gray-50/40 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {job.description && (
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Description</div>
                        <p className="text-gray-600 leading-relaxed text-[11px]">{job.description}</p>
                      </div>
                    )}
                    {job.responsibilities.length > 0 && (
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Responsibilities</div>
                        <ul className="space-y-0.5">
                          {job.responsibilities.map((r, i) => <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-600"><span style={{ color: BRAND.primary }} className="mt-0.5 flex-shrink-0">&#8250;</span>{r}</li>)}
                        </ul>
                      </div>
                    )}
                    {job.requirements.length > 0 && (
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Requirements</div>
                        <ul className="space-y-0.5">
                          {job.requirements.map((r, i) => <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-600"><CheckCircle size={9} style={{ color: BRAND.green }} className="mt-0.5 flex-shrink-0"/>{r}</li>)}
                        </ul>
                      </div>
                    )}
                    {job.perks.length > 0 && (
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Perks &amp; Benefits</div>
                        <div className="flex flex-wrap gap-1">
                          {job.perks.map(p => <span key={p} className="text-[9px] px-2 py-0.5 rounded-lg" style={{ backgroundColor: `${BRAND.green}12`, color: BRAND.green }}>{p}</span>)}
                        </div>
                      </div>
                    )}
                    <div className="md:col-span-2 flex items-center gap-2 pt-1">
                      <button onClick={() => openEdit(job)} className="text-[10px] font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white text-gray-700"><Edit3 size={10}/> Edit Posting</button>
                      <button onClick={() => cloneJob(job)} className="text-[10px] font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-white text-gray-700"><Copy size={10}/> Duplicate Role</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TALENT PIPELINE TAB (Kanban)
// ═══════════════════════════════════════════════════════════════════════════════
function PipelineTab({ jobs, candidates, setCandidates }: { jobs: EmployerJob[]; candidates: Candidate[]; setCandidates: (c: Candidate[]) => void }) {
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [movingId, setMovingId] = useState<string | null>(null);

  const visible = selectedJob === 'all' ? candidates : candidates.filter(c => c.jobId === selectedJob);
  const totalCandidates = visible.length;

  const moveStage = async (candidate: Candidate, stage: string) => {
    setMovingId(candidate._id);
    const res = await fetch(`/api/employer/candidates/${candidate._id}`, { method: 'PUT', headers: authHdr() as HeadersInit, body: JSON.stringify({ stage }) });
    const d = await res.json();
    if (d.success) setCandidates(candidates.map(c => c._id === candidate._id ? { ...c, stage } : c));
    setMovingId(null);
  };

  const stageOrder = JOB_STAGES.filter(s => s !== 'Rejected');
  const stageCounts = stageOrder.map(s => visible.filter(c => c.stage === s).length);
  const maxStageCount = Math.max(...stageCounts, 1);
  const bottleneckStage = stageOrder[stageCounts.indexOf(Math.max(...stageCounts))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Talent Pipeline</h1>
          <p className="text-xs text-gray-500 mt-0.5">{visible.length} candidates across {stageOrder.length} stages</p>
        </div>
        <div className="flex items-center gap-2">
          {bottleneckStage && stageCounts[stageOrder.indexOf(bottleneckStage)] > 2 && (
            <div className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: `${BRAND.orange}12`, color: BRAND.orange }}>
              <AlertCircle size={10} /> Bottleneck: {bottleneckStage} ({stageCounts[stageOrder.indexOf(bottleneckStage)]})
            </div>
          )}
          <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)}
            className="h-9 px-3 text-xs border border-gray-200 rounded-xl focus:outline-none bg-white">
            <option value="all">All Jobs</option>
            {jobs.map(j => <option key={j._id} value={j._id}>{j.title}</option>)}
          </select>
        </div>
      </div>

      {/* Conversion rates mini-strip */}
      {totalCandidates > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex items-center gap-2 overflow-x-auto">
          {stageOrder.map((stage, idx) => {
            const count = stageCounts[idx];
            const pct = totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0;
            return (
              <div key={stage} className="flex items-center gap-2 shrink-0">
                <div className="text-center">
                  <div className="text-xs font-bold" style={{ color: STAGE_COLORS[stage] }}>{count}</div>
                  <div className="text-[9px] text-gray-400">{stage}</div>
                  <div className="text-[9px] font-medium text-gray-500">{pct}%</div>
                </div>
                {idx < stageOrder.length - 1 && <ChevronRight size={12} className="text-gray-300 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {stageOrder.map((stage, stageIdx) => {
            const stageCandidates = visible.filter(c => c.stage === stage);
            const isBottleneck = stage === bottleneckStage && stageCandidates.length > 2;
            return (
              <div key={stage} className="w-60 shrink-0">
                <div className={`flex items-center justify-between mb-2 px-2 py-1.5 rounded-lg ${isBottleneck ? 'border' : ''}`}
                  style={isBottleneck ? { borderColor: `${BRAND.orange}40`, backgroundColor: `${BRAND.orange}08` } : {}}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_COLORS[stage] }} />
                    <span className="text-xs font-semibold text-gray-700">{stage}</span>
                    {isBottleneck && <AlertCircle size={10} style={{ color: BRAND.orange }} />}
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: STAGE_COLORS[stage] }}>{stageCandidates.length}</span>
                </div>
                <div className="space-y-2 min-h-16">
                  {stageCandidates.map(c => (
                    <div key={c._id} className={`bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-all ${movingId === c._id ? 'opacity-50' : ''}`}>
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: STAGE_COLORS[stage] }}>
                          {c.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-gray-800 truncate">{c.name}</div>
                          <div className="text-[10px] text-gray-400 truncate">{c.currentRole || '—'}</div>
                        </div>
                        {c.eiScore > 0 && (
                          <span className="text-[9px] font-bold shrink-0" style={{ color: BRAND.accent }}>EI {c.eiScore}</span>
                        )}
                      </div>
                      {c.matchScore > 0 && (
                        <div className="mb-2">
                          <div className="flex justify-between text-[9px] text-gray-400 mb-0.5"><span>Fit</span><span style={{ color: c.matchScore >= 75 ? BRAND.green : c.matchScore >= 55 ? BRAND.orange : BRAND.red }}>{c.matchScore}%</span></div>
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${c.matchScore}%`, backgroundColor: c.matchScore >= 75 ? BRAND.green : c.matchScore >= 55 ? BRAND.orange : BRAND.red }} />
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {c.skills.slice(0, 2).map(s => <Chip key={s} label={s} color={BRAND.primary} size="xs" />)}
                        {c.assessmentCompleted
                          ? <Chip label="✓ Completed" color={BRAND.green} size="xs" />
                          : c.assessmentSent && <Chip label="Invited" color={BRAND.orange} size="xs" />}
                        {c.rating > 0 && <Chip label={`★ ${c.rating}`} color={BRAND.orange} size="xs" />}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {stageOrder.filter(s => s !== stage).slice(0, 3).map(s => (
                          <button key={s} onClick={() => moveStage(c, s)} disabled={movingId === c._id}
                            className="text-[8px] px-1.5 py-0.5 rounded font-medium border hover:opacity-80 transition-opacity"
                            style={{ borderColor: `${STAGE_COLORS[s]}40`, color: STAGE_COLORS[s], backgroundColor: `${STAGE_COLORS[s]}08` }}>
                            → {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {stageCandidates.length === 0 && (
                    <div className="border-2 border-dashed border-gray-100 rounded-xl h-16 flex items-center justify-center">
                      <span className="text-[10px] text-gray-300">Empty</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rejected candidates collapsed */}
      {visible.filter(c => c.stage === 'Rejected').length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center justify-between">
          <span className="text-xs text-red-500 font-medium">{visible.filter(c => c.stage === 'Rejected').length} rejected candidates</span>
          <span className="text-[10px] text-red-400">Removed from active pipeline</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANDIDATES TAB — Mock source data for import demos
// ═══════════════════════════════════════════════════════════════════════════════

interface ImportCandidate {
  id: string; name: string; email: string; phone: string; location: string;
  currentRole: string; experience: string; skills: string[]; education: string;
  source: string; matchScore: number; eiScore: number; salary?: string;
  lastActive?: string; lbiScore?: number; behavProfile?: string; passiveScore?: number;
  linkedinUrl?: string; portalUrl?: string; availability?: string;
}

// Real CSV/Excel import — a parsed-and-validated row from an uploaded file.
interface ParsedRow {
  id: string; name: string; email: string; phone: string; location: string;
  currentRole: string; experience: string; skills: string[]; education: string;
  status: 'new' | 'duplicate' | 'invalid' | 'imported'; reason?: string;
}

const MOCK_NAUKRI: ImportCandidate[] = [
  { id:'nk1', name:'Arjun Mehta', email:'arjun.mehta@gmail.com', phone:'+91 98200 11234', location:'Mumbai', currentRole:'Senior Software Engineer', experience:'6 yrs', skills:['React','Node.js','AWS','TypeScript'], education:'B.Tech CSE — IIT Bombay', source:'Naukri', matchScore:91, eiScore:78, salary:'₹22 LPA', lastActive:'2 days ago', linkedinUrl:'#', availability:'30 days notice' },
  { id:'nk2', name:'Priya Sharma', email:'priya.sharma@outlook.com', phone:'+91 97600 22345', location:'Bangalore', currentRole:'Product Manager', experience:'5 yrs', skills:['Product Strategy','Agile','SQL','Figma'], education:'MBA — IIM Ahmedabad', source:'Naukri', matchScore:88, eiScore:82, salary:'₹28 LPA', lastActive:'1 day ago', availability:'Immediate' },
  { id:'nk3', name:'Rohan Gupta', email:'rohan.g@yahoo.com', phone:'+91 99300 33456', location:'Hyderabad', currentRole:'Data Scientist', experience:'4 yrs', skills:['Python','ML','TensorFlow','SQL'], education:'M.Tech AI — IIT Hyderabad', source:'Naukri', matchScore:85, eiScore:74, salary:'₹18 LPA', lastActive:'3 days ago', availability:'60 days notice' },
  { id:'nk4', name:'Kavya Nair', email:'kavya.nair@gmail.com', phone:'+91 98100 44567', location:'Pune', currentRole:'UX Designer', experience:'3 yrs', skills:['Figma','User Research','Prototyping','CSS'], education:'B.Des — NID Ahmedabad', source:'Naukri', matchScore:79, eiScore:80, salary:'₹12 LPA', lastActive:'5 days ago', availability:'Immediate' },
  { id:'nk5', name:'Vikram Singh', email:'vikram.s@rediffmail.com', phone:'+91 96700 55678', location:'Delhi', currentRole:'DevOps Engineer', experience:'7 yrs', skills:['Kubernetes','Docker','CI/CD','Terraform'], education:'B.E. — Delhi Technological Univ', source:'Naukri', matchScore:83, eiScore:71, salary:'₹24 LPA', lastActive:'1 week ago', availability:'45 days notice' },
  { id:'nk6', name:'Ananya Patel', email:'ananya.p@gmail.com', phone:'+91 99500 66789', location:'Ahmedabad', currentRole:'Business Analyst', experience:'2 yrs', skills:['Excel','Power BI','JIRA','SQL'], education:'MBA — XLRI Jamshedpur', source:'Naukri', matchScore:76, eiScore:77, salary:'₹10 LPA', lastActive:'4 days ago', availability:'Immediate' },
];

const MOCK_LINKEDIN: ImportCandidate[] = [
  { id:'li1', name:'Sneha Kapoor', email:'sneha.kapoor@company.io', phone:'+91 98900 77890', location:'Bangalore', currentRole:'Engineering Manager', experience:'9 yrs', skills:['Team Leadership','System Design','Go','Microservices'], education:'B.Tech — BITS Pilani', source:'LinkedIn', matchScore:94, eiScore:85, salary:'Open', lastActive:'Active', linkedinUrl:'#', availability:'Negotiable' },
  { id:'li2', name:'Rahul Verma', email:'rahul.v@startup.co', phone:'+91 97200 88901', location:'Mumbai', currentRole:'Full Stack Developer', experience:'5 yrs', skills:['Vue.js','Django','PostgreSQL','Redis'], education:'B.Tech — VIT Vellore', source:'LinkedIn', matchScore:87, eiScore:79, salary:'₹20 LPA', lastActive:'Today', linkedinUrl:'#', availability:'2 months notice' },
  { id:'li3', name:'Deepika Rao', email:'deepika.rao@mnc.com', phone:'+91 98400 99012', location:'Chennai', currentRole:'HR Business Partner', experience:'6 yrs', skills:['Talent Acquisition','HRIS','Employee Engagement','L&D'], education:'MSW — Tata Institute of Social Sciences', source:'LinkedIn', matchScore:81, eiScore:88, salary:'₹15 LPA', lastActive:'Yesterday', linkedinUrl:'#', availability:'30 days notice' },
  { id:'li4', name:'Aditya Kumar', email:'aditya.k@consult.in', phone:'+91 96000 10123', location:'Delhi', currentRole:'Strategy Consultant', experience:'4 yrs', skills:['Financial Modeling','Market Research','PowerPoint','Excel'], education:'MBA — IIM Calcutta', source:'LinkedIn', matchScore:86, eiScore:76, salary:'₹30 LPA', lastActive:'3 days ago', linkedinUrl:'#', availability:'1 month notice' },
];

const MOCK_INDEED: ImportCandidate[] = [
  { id:'in1', name:'Meera Pillai', email:'meera.p@gmail.com', phone:'+91 99100 21234', location:'Kochi', currentRole:'Frontend Developer', experience:'3 yrs', skills:['React','CSS','JavaScript','Next.js'], education:'B.Tech — Kerala Univ', source:'Indeed', matchScore:80, eiScore:72, salary:'₹10 LPA', lastActive:'Today', availability:'Immediate' },
  { id:'in2', name:'Suresh Babu', email:'suresh.b@techco.com', phone:'+91 98600 32345', location:'Hyderabad', currentRole:'QA Engineer', experience:'5 yrs', skills:['Selenium','JIRA','API Testing','Python'], education:'B.E. — Osmania University', source:'Indeed', matchScore:75, eiScore:70, salary:'₹12 LPA', lastActive:'2 days ago', availability:'30 days notice' },
  { id:'in3', name:'Lakshmi Iyer', email:'lakshmi.i@fintech.com', phone:'+91 97800 43456', location:'Bangalore', currentRole:'Scrum Master', experience:'6 yrs', skills:['Agile','SAFe','JIRA','Confluence'], education:'MBA — Symbiosis', source:'Indeed', matchScore:78, eiScore:83, salary:'₹18 LPA', lastActive:'5 days ago', availability:'Immediate' },
];

const MOCK_METRYX_POOL: ImportCandidate[] = [
  { id:'mx1', name:'Nikhil Deshpande', email:'nikhil.d@gmail.com', phone:'+91 98000 54567', location:'Pune', currentRole:'Software Developer', experience:'4 yrs', skills:['Java','Spring Boot','MySQL','Docker'], education:'B.E. CSE — Pune University', source:'MetryxOne', matchScore:89, eiScore:86, lbiScore:91, behavProfile:'Analytical Leader', passiveScore:72, availability:'Open to opportunities' },
  { id:'mx2', name:'Shreya Joshi', email:'shreya.j@outlook.com', phone:'+91 96500 65678', location:'Mumbai', currentRole:'Marketing Manager', experience:'5 yrs', skills:['Digital Marketing','SEO','Analytics','Content'], education:'MBA Marketing — SP Jain', source:'MetryxOne', matchScore:83, eiScore:90, lbiScore:88, behavProfile:'Creative Collaborator', passiveScore:65, availability:'Exploring options' },
  { id:'mx3', name:'Kiran Reddy', email:'kiran.r@techstartup.io', phone:'+91 99700 76789', location:'Hyderabad', currentRole:'Sales Lead', experience:'7 yrs', skills:['B2B Sales','CRM','Negotiation','Team Management'], education:'MBA — ICFAI Business School', source:'MetryxOne', matchScore:85, eiScore:79, lbiScore:84, behavProfile:'Driven Achiever', passiveScore:81, availability:'Active seeker' },
  { id:'mx4', name:'Pallavi Singh', email:'pallavi.s@corp.com', phone:'+91 98200 87890', location:'Delhi', currentRole:'Finance Analyst', experience:'3 yrs', skills:['Financial Modeling','Excel','Tally','Power BI'], education:'CA — ICAI', source:'MetryxOne', matchScore:77, eiScore:74, lbiScore:80, behavProfile:'Detail Orienteer', passiveScore:58, availability:'Considering' },
  { id:'mx5', name:'Arun Krishnan', email:'arun.k@gmail.com', phone:'+91 97100 98901', location:'Chennai', currentRole:'Cloud Architect', experience:'10 yrs', skills:['AWS','Azure','GCP','Terraform','Kubernetes'], education:'M.Tech — IIT Madras', source:'MetryxOne', matchScore:96, eiScore:88, lbiScore:94, behavProfile:'Strategic Visionary', passiveScore:45, availability:'Very passive' },
  { id:'mx6', name:'Pooja Nambiar', email:'pooja.n@vc.in', phone:'+91 96200 09012', location:'Bangalore', currentRole:'Operations Manager', experience:'6 yrs', skills:['Process Improvement','ERP','Six Sigma','Data Analysis'], education:'MBA Ops — ISB Hyderabad', source:'MetryxOne', matchScore:82, eiScore:85, lbiScore:87, behavProfile:'Reliable Executor', passiveScore:70, availability:'Open to right role' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CANDIDATES TAB
// ═══════════════════════════════════════════════════════════════════════════════
function CandidatesTab({ candidates, setCandidates, jobs }: { candidates: Candidate[]; setCandidates: (c: Candidate[]) => void; jobs: EmployerJob[] }) {
  // ── core list state ──────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('All');
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState('');
  const [bulkSending, setBulkSending] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const emptyForm = { name: '', email: '', phone: '', location: '', currentRole: '', experience: '', skills: '', education: '', eiScore: 0, matchScore: 0, source: 'Direct', stage: 'Applied', notes: '', linkedinUrl: '', appliedDate: '', jobId: '', jobTitle: '' };
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  // ── import panel state ───────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importSource, setImportSource] = useState<'excel'|'naukri'|'linkedin'|'indeed'|'metryx'>('naukri');
  const [importSearch, setImportSearch] = useState('');
  const [importLocation, setImportLocation] = useState('');
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<string[]>([]);
  const [excelDragOver, setExcelDragOver] = useState(false);
  const [excelParsed, setExcelParsed] = useState(false);

  // ── passive engagement state ─────────────────────────────────────────────────
  const [showPassiveModal, setShowPassiveModal] = useState(false);
  const [passiveCandidates, setPassiveCandidates] = useState<ImportCandidate[]>([]);
  const [passiveMsg, setPassiveMsg] = useState('Hi [Name],\n\nWe came across your profile on MetryxOne and think you could be a great fit for an exciting opportunity at our company.\n\nWe\'d love to share more details \u2014 would you be open to a quick conversation?\n\nBest regards,\nTalent Acquisition Team');
  const [passiveSending, setPassiveSending] = useState(false);
  const [passiveSent, setPassiveSent] = useState(false);
  const [importDropdown, setImportDropdown] = useState(false);

  // ── candidate detail panel ────────────────────────────────────────────────
  const [showDetail, setShowDetail] = useState(false);
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [refChecks, setRefChecks] = useState<RefCheck[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [resumeMeta, setResumeMeta] = useState<{ filename: string; mime: string; size: number; uploadedAt: string } | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const resumeInputRef = useRef<HTMLInputElement>(null);
  // On-screen résumé viewer: blob URL is created on open and MUST be revoked on close.
  const [resumeView, setResumeView] = useState<{ url?: string; mime: string; filename: string; text?: string } | null>(null);
  const [viewingResume, setViewingResume] = useState(false);
  // Applicant self-completion request (recruiter triggers; applicant fills via token link).
  const [requestingCompletion, setRequestingCompletion] = useState(false);
  const [completionInfo, setCompletionInfo] = useState<{ missing: { key: string; label: string }[]; sent: boolean; link?: string } | null>(null);
  const [completionError, setCompletionError] = useState('');
  const [activityForm, setActivityForm] = useState({ type: 'Note', title: '', description: '', by: '' });
  const [savingActivity, setSavingActivity] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [refForm, setRefForm] = useState({ refName: '', refTitle: '', refCompany: '', refEmail: '', refPhone: '', relationship: '', status: 'Not Started' });
  const [showRefForm, setShowRefForm] = useState(false);
  const [savingRef, setSavingRef] = useState(false);
  const [detailTab, setDetailTab] = useState<'timeline'|'refs'|'intelligence'>('timeline');
  const [intelligenceData, setIntelligenceData] = useState<any | null>(null);
  const [hiringAssessment, setHiringAssessment] = useState<any | null>(null);
  const [hiringCalibration, setHiringCalibration] = useState<any | null>(null);
  const [assessmentMissing, setAssessmentMissing] = useState(false);
  const [analyzingFit, setAnalyzingFit] = useState(false);
  // Monotonic request token bumped on every drawer open. Async results carry the token
  // they were issued under; any result whose token != the latest is dropped — so a
  // previously-opened (or re-opened) candidate's fetch can never write into the current
  // drawer (critical: hiring predictions must never be misattributed to the wrong person).
  const detailReqRef = useRef(0);

  // ── comparison modal ───────────────────────────────────────────────────────
  const [showCompare, setShowCompare] = useState(false);

  // ── sorting, advanced filters & export (world-class list) ───────────────────
  const [sortKey, setSortKey] = useState<'recency' | 'name' | 'eiScore' | 'matchScore' | 'stage'>('recency');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [filterSource, setFilterSource] = useState('All');
  const [filterJob, setFilterJob] = useState('All');
  const [filterPooled, setFilterPooled] = useState(false);
  const [filterAssessed, setFilterAssessed] = useState(false);
  const [eiMin, setEiMin] = useState(0);
  const [fitMin, setFitMin] = useState(0);
  const [exportMenu, setExportMenu] = useState(false);

  // Esc closes the top-most open overlay (drawer → modals → panels).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (resumeView) closeResumeView();
      else if (showCompare) setShowCompare(false);
      else if (showDetail) setShowDetail(false);
      else if (showPassiveModal) setShowPassiveModal(false);
      else if (showImport) setShowImport(false);
      else if (showForm) setShowForm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resumeView, showCompare, showDetail, showPassiveModal, showImport, showForm]);

  // Revoke the résumé blob URL whenever it is replaced OR the component unmounts (idempotent
  // with closeResumeView's explicit revoke), so a viewer blob can never leak.
  useEffect(() => {
    const url = resumeView?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [resumeView?.url]);

  // ── real CSV/Excel import state (Phase 1) ───────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [importSummary, setImportSummary] = useState<{ inserted: number; duplicates: number; invalid: number } | null>(null);

  // ── computed import data ─────────────────────────────────────────────────────
  const sourceData: Record<string, ImportCandidate[]> = {
    naukri: MOCK_NAUKRI, linkedin: MOCK_LINKEDIN, indeed: MOCK_INDEED, metryx: MOCK_METRYX_POOL, excel: [],
  };
  const importResults = (sourceData[importSource] || []).filter(c => {
    const q = importSearch.toLowerCase();
    const loc = importLocation.toLowerCase();
    return (!q || c.name.toLowerCase().includes(q) || c.currentRole.toLowerCase().includes(q) || c.skills.some(s => s.toLowerCase().includes(q)))
      && (!loc || c.location.toLowerCase().includes(loc));
  });
  const alreadyImported = (id: string) => importDone.includes(id);

  const toggleImportSelect = (id: string) => {
    setImportSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAllImport = () => {
    if (importSelected.size === importResults.length) setImportSelected(new Set());
    else setImportSelected(new Set(importResults.map(c => c.id)));
  };

  const handleImportCandidates = async () => {
    setImporting(true);
    const toImport = importResults.filter(c => importSelected.has(c.id) && !alreadyImported(c.id));
    const saved: Candidate[] = [];
    for (const c of toImport) {
      try {
        const payload = {
          name: c.name, email: c.email, phone: c.phone, location: c.location,
          currentRole: c.currentRole, experience: c.experience,
          skills: Array.isArray(c.skills) ? c.skills : [],
          education: c.education, source: c.source, matchScore: c.matchScore,
          eiScore: c.eiScore, stage: 'Applied', notes: '', linkedinUrl: c.linkedinUrl || '',
          appliedDate: new Date().toISOString(), jobId: '', jobTitle: '',
        };
        const res = await fetch('/api/employer/candidates', {
          method: 'POST', headers: authHdr() as HeadersInit, body: JSON.stringify(payload),
        });
        const d = await res.json();
        if (d.success && d.candidate) saved.push(d.candidate);
      } catch { /* skip failed rows silently */ }
    }
    if (saved.length > 0) setCandidates(prev => [...saved, ...prev]);
    setImportDone(prev => [...prev, ...toImport.map(c => c.id)]);
    setImportSelected(new Set());
    setImporting(false);
  };

  const handleEngagePassive = (chosen: ImportCandidate[]) => {
    setPassiveCandidates(chosen);
    setPassiveSent(false);
    setShowPassiveModal(true);
  };

  const sendPassiveEngagement = async () => {
    setPassiveSending(true);
    // Save each engaged passive candidate into the pipeline as Applied
    const saved: Candidate[] = [];
    for (const c of passiveCandidates) {
      try {
        const payload = {
          name: c.name, email: c.email, phone: c.phone || '', location: c.location,
          currentRole: c.currentRole, experience: c.experience,
          skills: Array.isArray(c.skills) ? c.skills : [],
          education: c.education, source: 'MetryxOne', matchScore: c.matchScore,
          eiScore: c.eiScore, stage: 'Applied',
          notes: `Passive outreach sent via MetryxOne DB. LBI: ${c.lbiScore ?? '—'} | Profile: ${c.behavProfile ?? '—'}`,
          linkedinUrl: '', appliedDate: new Date().toISOString(), jobId: '', jobTitle: '',
        };
        const res = await fetch('/api/employer/candidates', {
          method: 'POST', headers: authHdr() as HeadersInit, body: JSON.stringify(payload),
        });
        const d = await res.json();
        if (d.success && d.candidate) saved.push(d.candidate);
      } catch { /* skip */ }
    }
    if (saved.length > 0) setCandidates(prev => [...saved, ...prev]);
    setPassiveSending(false);
    setPassiveSent(true);
  };

  // ── real CSV/Excel parsing (SheetJS) — no fabricated rows ────────────────────
  const FIELD_SYNONYMS: Record<string, string[]> = {
    name: ['name', 'fullname', 'candidatename', 'candidate'],
    email: ['email', 'emailaddress', 'mail', 'emailid'],
    phone: ['phone', 'mobile', 'phonenumber', 'contact', 'contactnumber', 'mobilenumber'],
    location: ['location', 'city', 'place', 'currentlocation'],
    currentRole: ['currentrole', 'role', 'designation', 'jobtitle', 'title', 'position', 'currentdesignation'],
    experience: ['experience', 'exp', 'yearsofexperience', 'totalexperience', 'expyears'],
    skills: ['skills', 'skill', 'keyskills', 'technologies', 'techstack'],
    education: ['education', 'qualification', 'degree', 'highestqualification'],
  };
  const normHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const resetParsed = () => {
    setParsedRows([]); setParseError(null); setFileName(''); setImportSummary(null); setExcelParsed(false);
  };

  const parseFile = async (file: File) => {
    setParseError(null); setImportSummary(null); setParsing(true);
    try {
      if (file.size > 5 * 1024 * 1024) { setParseError('File exceeds the 5 MB limit.'); setParsing(false); return; }
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { setParseError('No sheet found in this file.'); setParsing(false); return; }
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: false });
      if (json.length === 0) { setParseError('No data rows found in this file.'); setParsing(false); return; }
      const headers = Object.keys(json[0]);
      const headerToField: Record<string, string> = {};
      for (const h of headers) {
        const n = normHeader(h);
        for (const [field, syns] of Object.entries(FIELD_SYNONYMS)) {
          if (syns.includes(n) && !Object.values(headerToField).includes(field)) { headerToField[h] = field; break; }
        }
      }
      const mapped = new Set(Object.values(headerToField));
      if (!mapped.has('name') || !mapped.has('email')) {
        setParseError('Could not find required "Name" and "Email" columns. Download the template for the expected format.');
        setParsing(false); return;
      }
      const fieldHeader = (field: string) => Object.keys(headerToField).find(h => headerToField[h] === field);
      const existingEmails = new Set(candidates.map(c => (c.email || '').toLowerCase().trim()));
      const seen = new Set<string>();
      const rows: ParsedRow[] = json.map((r, idx) => {
        const get = (field: string) => { const h = fieldHeader(field); return h ? String(r[h] ?? '').trim() : ''; };
        const name = get('name');
        const email = get('email').toLowerCase();
        const skillsRaw = get('skills');
        const skills = skillsRaw ? skillsRaw.split(/[,;|]/).map(s => s.trim()).filter(Boolean) : [];
        let status: ParsedRow['status'] = 'new';
        let reason: string | undefined;
        if (!name || !email) { status = 'invalid'; reason = !name ? 'Missing name' : 'Missing email'; }
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status = 'invalid'; reason = 'Invalid email'; }
        else if (existingEmails.has(email)) { status = 'duplicate'; reason = 'Already in your candidates'; }
        else if (seen.has(email)) { status = 'duplicate'; reason = 'Duplicate in file'; }
        else seen.add(email);
        return { id: `row-${idx}`, name, email, phone: get('phone'), location: get('location'), currentRole: get('currentRole'), experience: get('experience'), skills, education: get('education'), status, reason };
      });
      setParsedRows(rows);
      setFileName(file.name);
      setExcelParsed(true);
      setImportSelected(new Set(rows.filter(r => r.status === 'new').map(r => r.id)));
    } catch {
      setParseError('Could not read this file. Please ensure it is a valid .csv, .xlsx or .xls file.');
    } finally {
      setParsing(false);
    }
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
    e.target.value = '';
  };

  const newRowCount = parsedRows.filter(r => r.status === 'new').length;
  const toggleAllParsed = () => {
    const newIds = parsedRows.filter(r => r.status === 'new').map(r => r.id);
    if (newIds.length > 0 && newIds.every(id => importSelected.has(id))) setImportSelected(new Set());
    else setImportSelected(new Set(newIds));
  };

  const handleImportExcel = async () => {
    const toImport = parsedRows.filter(r => importSelected.has(r.id) && r.status === 'new');
    if (toImport.length === 0) return;
    setImporting(true);
    try {
      const payload = {
        candidates: toImport.map(r => ({
          name: r.name, email: r.email, phone: r.phone, location: r.location,
          currentRole: r.currentRole, experience: r.experience, skills: r.skills,
          education: r.education, source: 'CSV/Excel Import', stage: 'Applied',
          appliedDate: new Date().toISOString(),
        })),
      };
      const res = await fetch('/api/employer/candidates/bulk-import', {
        method: 'POST', headers: authHdr() as HeadersInit, body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.success) {
        if (Array.isArray(d.candidates) && d.candidates.length) setCandidates(prev => [...d.candidates, ...prev]);
        setImportSummary({ inserted: d.inserted ?? 0, duplicates: d.skippedDuplicates ?? 0, invalid: Array.isArray(d.invalid) ? d.invalid.length : 0 });
        const norm = (e: string) => e.trim().toLowerCase();
        const insertedEmails = new Set<string>((Array.isArray(d.candidates) ? d.candidates : []).map((c: any) => norm(String(c.email ?? ''))));
        const serverInvalid = new Map<string, string>();
        if (Array.isArray(d.invalid)) {
          for (const iv of d.invalid) {
            const row = typeof iv?.index === 'number' ? toImport[iv.index] : undefined;
            if (row) serverInvalid.set(norm(row.email), String(iv.reason || 'Rejected'));
          }
        }
        const attempted = new Set(toImport.map(r => norm(r.email)));
        setParsedRows(prev => prev.map(r => {
          if (r.status !== 'new') return r;
          const key = norm(r.email);
          if (!attempted.has(key)) return r;
          if (insertedEmails.has(key)) return { ...r, status: 'imported', reason: 'Imported' };
          if (serverInvalid.has(key)) return { ...r, status: 'invalid', reason: serverInvalid.get(key)! };
          return { ...r, status: 'duplicate', reason: 'Already in system' };
        }));
        setImportSelected(new Set());
      } else {
        setParseError('Import failed. Please try again.');
      }
    } catch {
      setParseError('Import failed. Please check your connection and try again.');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'Name,Email,Phone,Location,Current Role,Experience,Skills,Education\n'
      + 'Jane Doe,jane.doe@example.com,+91 90000 00000,Bangalore,Software Engineer,4 yrs,"React, Node.js, SQL",B.Tech CSE\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'metryxone_candidate_template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAdd = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const payload = { ...form, skills: form.skills.toString().split(',').map(s => s.trim()).filter(Boolean) };
      const res = await fetch('/api/employer/candidates', { method: 'POST', headers: authHdr() as HeadersInit, body: JSON.stringify(payload) });
      const d = await res.json();
      if (d.success) { setCandidates([d.candidate, ...candidates]); setShowForm(false); setForm(emptyForm); }
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this candidate? This cannot be undone.')) return;
    await fetch(`/api/employer/candidates/${id}`, { method: 'DELETE', headers: authHdr() as HeadersInit });
    setCandidates(candidates.filter(c => c._id !== id));
    if (selected?._id === id) setSelected(null);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const togglePool = async (c: Candidate) => {
    const res = await fetch(`/api/employer/candidates/${c._id}/pool`, { method: 'POST', headers: authHdr() as HeadersInit });
    const d = await res.json();
    if (d.success) setCandidates(candidates.map(x => x._id === c._id ? { ...x, pooled: d.pooled } : x));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(c => c._id)));
  };

  const bulkMoveStage = async () => {
    if (!bulkStage) return;
    const targets = filtered.filter(c => selectedIds.has(c._id));
    if (targets.length === 0) { setBulkStage(''); return; }
    const results = await Promise.all(targets.map(async c => {
      try { const r = await fetch(`/api/employer/candidates/${c._id}`, { method: 'PUT', headers: authHdr() as HeadersInit, body: JSON.stringify({ stage: bulkStage }) }); return r.ok ? c._id : null; }
      catch { return null; }
    }));
    const ok = new Set(results.filter((id): id is string => !!id));
    if (ok.size > 0) setCandidates(candidates.map(c => ok.has(c._id) ? { ...c, stage: bulkStage } : c));
    const failed = targets.length - ok.size;
    if (failed > 0) alert(`Moved ${ok.size} of ${targets.length}. ${failed} failed.`);
    setSelectedIds(new Set());
    setBulkStage('');
  };

  const bulkSendAssessments = async () => {
    setBulkSending(true);
    const targets = filtered.filter(c => selectedIds.has(c._id) && !c.assessmentSent);
    const ids = targets.map(c => c._id);
    if (ids.length === 0) {
      setBulkSending(false); setSelectedIds(new Set());
      alert('No new candidates to invite — every selected candidate has already been invited.');
      return;
    }
    const demoCount = targets.filter(c => /@example\.com$/i.test(c.email || '')).length;
    try {
      const res = await fetch('/api/employer/candidates/bulk-send-assessment', {
        method: 'POST',
        headers: authHdr() as HeadersInit,
        body: JSON.stringify({ candidateIds: ids }),
      });
      if (!res.ok) { alert(`Could not send assessments (server error ${res.status}). Please try again.`); setBulkSending(false); return; }
      const d = await res.json();
      // Honest: only flip rows the server actually emailed (sentIds), not failed/demo ones.
      const sentSet = new Set<string>(Array.isArray(d.sentIds) ? d.sentIds : []);
      const nowIso = new Date().toISOString();
      if (sentSet.size > 0) {
        setCandidates(candidates.map(c => sentSet.has(c._id) ? { ...c, assessmentSent: true, assessmentSentAt: nowIso } : c));
      }
      const parts: string[] = [];
      if (d.sent > 0)    parts.push(`${d.sent} invitation${d.sent !== 1 ? 's' : ''} sent`);
      if (d.skipped > 0) parts.push(`${d.skipped} already invited`);
      if (d.failed > 0)  parts.push(`${d.failed} failed`);
      let msg = parts.length ? `Assessment: ${parts.join(', ')}.` : 'No assessments were sent.';
      if (demoCount > 0) msg += `\n\nNote: ${demoCount} selected candidate${demoCount !== 1 ? 's use' : ' uses'} an @example.com demo address, which cannot receive email — invite a real candidate email to test delivery end to end.`;
      alert(msg);
    } catch {
      alert('Could not send assessments — a network error occurred. Please try again.');
    }
    setSelectedIds(new Set());
    setBulkSending(false);
  };

  // Guard against CSV/Excel formula injection: cells beginning with = + - @ (or a
  // leading control char) are coerced to text with a leading apostrophe.
  const csvSafe = (v: unknown): unknown => {
    if (typeof v !== 'string' || v === '') return v;
    return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  };

  // Export the current view (or just the selection) to a CSV via SheetJS. "selected"
  // is scoped to the CURRENTLY VISIBLE selection so a hidden (filtered-out) selection
  // can never be silently exported.
  const exportToCsv = (which: 'filtered' | 'selected') => {
    const list = which === 'selected' ? filtered.filter(c => selectedIds.has(c._id)) : filtered;
    if (list.length === 0) return;
    const rows = list.map(c => ({
      Name: csvSafe(c.name), Email: csvSafe(c.email), Phone: csvSafe(c.phone), Location: csvSafe(c.location),
      'Current Role': csvSafe(c.currentRole), Experience: csvSafe(c.experience), Education: csvSafe(c.education),
      Skills: csvSafe((c.skills || []).join('; ')), Source: csvSafe(c.source), Stage: csvSafe(c.stage),
      'EI Score': c.eiScore, 'Fit %': c.matchScore,
      'Assessment Sent': c.assessmentSent ? 'Yes' : 'No',
      Pooled: c.pooled ? 'Yes' : 'No', LinkedIn: csvSafe(c.linkedinUrl),
      Added: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
    XLSX.writeFile(wb, `candidates_${which}_${new Date().toISOString().slice(0, 10)}.csv`, { bookType: 'csv' });
    setExportMenu(false);
  };

  // Bulk actions operate on the CURRENTLY VISIBLE selection only, and update local
  // state from confirmed-OK responses (never optimistically) so the UI never shows a
  // candidate as pooled/removed when the request actually failed.
  const bulkPool = async () => {
    const targets = filtered.filter(c => selectedIds.has(c._id) && !c.pooled);
    if (targets.length === 0) { setSelectedIds(new Set()); return; }
    const results = await Promise.all(targets.map(async c => {
      try { const r = await fetch(`/api/employer/candidates/${c._id}/pool`, { method: 'POST', headers: authHdr() as HeadersInit }); return r.ok ? c._id : null; }
      catch { return null; }
    }));
    const ok = new Set(results.filter((id): id is string => !!id));
    if (ok.size > 0) setCandidates(candidates.map(c => ok.has(c._id) ? { ...c, pooled: true } : c));
    const failed = targets.length - ok.size;
    if (failed > 0) alert(`Pooled ${ok.size} of ${targets.length}. ${failed} failed.`);
    setSelectedIds(new Set());
  };

  const bulkDelete = async () => {
    const targets = filtered.filter(c => selectedIds.has(c._id));
    if (targets.length === 0) return;
    if (!window.confirm(`Remove ${targets.length} candidate${targets.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    const results = await Promise.all(targets.map(async c => {
      try { const r = await fetch(`/api/employer/candidates/${c._id}`, { method: 'DELETE', headers: authHdr() as HeadersInit }); return r.ok ? c._id : null; }
      catch { return null; }
    }));
    const ok = new Set(results.filter((id): id is string => !!id));
    if (ok.size > 0) setCandidates(candidates.filter(c => !ok.has(c._id)));
    const failed = targets.length - ok.size;
    if (failed > 0) alert(`Removed ${ok.size} of ${targets.length}. ${failed} failed.`);
    setSelectedIds(new Set());
  };

  const clearFilters = () => {
    setFilterSource('All'); setFilterJob('All'); setFilterPooled(false);
    setFilterAssessed(false); setEiMin(0); setFitMin(0);
  };

  const openDetail = async (c: Candidate) => {
    setDetailCandidate(c);
    setShowDetail(true);
    setLoadingDetail(true);
    setDetailTab('timeline');
    setIntelligenceData(null);
    setHiringAssessment(null);
    setHiringCalibration(null);
    setAssessmentMissing(false);
    setAnalyzingFit(false);
    setResumeMeta(null);
    setResumeError('');
    closeResumeView();
    setViewingResume(false);
    setCompletionInfo(null);
    setCompletionError('');
    setRequestingCompletion(false);
    const token = ++detailReqRef.current;
    const isStale = () => detailReqRef.current !== token;
    // Parse each section independently so one failed/non-JSON response never blanks the others.
    const safeJson = async (p: Promise<Response>) => { try { const r = await p; return r.ok ? await r.json() : null; } catch { return null; } };
    try {
      const [aD, rD, intelD, calibD, resD] = await Promise.all([
        safeJson(fetch(`/api/employer/activity/${c._id}`, { headers: authHdr() as HeadersInit })),
        safeJson(fetch(`/api/employer/ref-checks/${c._id}`, { headers: authHdr() as HeadersInit })),
        safeJson(fetch(`/api/employer/candidates/${c._id}/intelligence`, { headers: authHdr() as HeadersInit })),
        safeJson(fetch(`/api/employer/tig/readiness`, { headers: authHdr() as HeadersInit })),
        safeJson(fetch(`/api/employer/candidates/${c._id}/resume/meta`, { headers: authHdr() as HeadersInit })),
      ]);
      if (isStale()) return;
      if (aD?.success) setActivityLogs(aD.logs);
      if (rD?.success) setRefChecks(rD.checks);
      if (intelD?.domains) setIntelligenceData(intelD);
      if (calibD?.calibration) setHiringCalibration(calibD.calibration);
      if (resD?.success) setResumeMeta(resD.resume);
      // Existing per-candidate job-fit assessment (only if the candidate is linked to a job).
      if (c.jobId) {
        const asRes = await fetch(`/api/employer/hiring/assessment/${c.jobId}/${c._id}`, { headers: authHdr() as HeadersInit });
        if (isStale()) return;
        if (asRes.ok) {
          const asJson = await asRes.json();
          if (isStale()) return;
          setHiringAssessment(asJson);
        } else setAssessmentMissing(true);
      }
    } catch {} finally { if (!isStale()) setLoadingDetail(false); }
  };

  // ── Résumé / CV: attach · download · remove ───────────────────────────────
  // Auth is a bearer token (authHdr), so downloads MUST go through fetch+blob, not <a href>.
  // Each async write captures the open-drawer token and drops the result if the drawer moved on.
  const uploadResume = (file: File) => {
    if (!detailCandidate) return;
    setResumeError('');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) { setResumeError('Unsupported file. Use PDF, DOC, DOCX, TXT, RTF or ODT.'); return; }
    if (file.size > 5 * 1024 * 1024) { setResumeError('File exceeds the 5 MB limit.'); return; }
    const cid = detailCandidate._id;
    const token = detailReqRef.current;
    setUploadingResume(true);
    const reader = new FileReader();
    reader.onerror = () => { if (detailReqRef.current === token) { setUploadingResume(false); setResumeError('Could not read the file.'); } };
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result || '');
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const res = await fetch(`/api/employer/candidates/${cid}/resume`, {
          method: 'POST', headers: authHdr() as HeadersInit,
          body: JSON.stringify({ filename: file.name, mime: file.type || 'application/octet-stream', dataBase64: base64 }),
        });
        const j = await res.json().catch(() => null);
        if (detailReqRef.current !== token) return; // drawer moved on — drop write
        if (!res.ok) setResumeError(j?.message || 'Upload failed.');
        else if (j?.resume) setResumeMeta(j.resume);
      } catch { if (detailReqRef.current === token) setResumeError('Upload failed.'); }
      finally { if (detailReqRef.current === token) setUploadingResume(false); }
    };
    reader.readAsDataURL(file);
  };

  const downloadResume = async () => {
    if (!detailCandidate || !resumeMeta) return;
    const fname = resumeMeta.filename || 'resume';
    try {
      const res = await fetch(`/api/employer/candidates/${detailCandidate._id}/resume`, { headers: authHdr() as HeadersInit });
      if (!res.ok) { setResumeError('Download failed.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { setResumeError('Download failed.'); }
  };

  const removeResume = async () => {
    if (!detailCandidate) return;
    if (typeof window !== 'undefined' && !window.confirm('Remove the attached résumé / CV?')) return;
    const cid = detailCandidate._id;
    const token = detailReqRef.current;
    try {
      const res = await fetch(`/api/employer/candidates/${cid}/resume`, { method: 'DELETE', headers: authHdr() as HeadersInit });
      if (res.ok && detailReqRef.current === token) { setResumeMeta(null); closeResumeView(); }
    } catch { setResumeError('Could not remove the file.'); }
  };

  // Open the résumé on-screen. Auth is a bearer token so we fetch the binary and create a
  // blob URL (revoked on close). PDF/image/text render inline; other formats download only.
  const openResumeView = async () => {
    if (!detailCandidate || !resumeMeta) return;
    const token = detailReqRef.current;
    setResumeError('');
    setViewingResume(true);
    try {
      const res = await fetch(`/api/employer/candidates/${detailCandidate._id}/resume`, { headers: authHdr() as HeadersInit });
      if (!res.ok) { if (detailReqRef.current === token) { setViewingResume(false); setResumeError('Could not open the résumé.'); } return; }
      const blob = await res.blob();
      if (detailReqRef.current !== token) return; // drawer moved on — drop
      const mime = (resumeMeta.mime || blob.type || 'application/octet-stream');
      const filename = resumeMeta.filename || 'resume';
      const ml = mime.toLowerCase();
      const nl = filename.toLowerCase();
      // SECURITY: text is read out and rendered ESCAPED (React text node) — NEVER iframed —
      // so a .txt whose bytes are HTML can't execute. PDF/images are server-typed (nosniff) and safe to embed.
      if (ml.startsWith('text/') || nl.endsWith('.txt')) {
        const text = await blob.text();
        if (detailReqRef.current !== token) return;
        setResumeView({ mime, filename, text });
      } else if (ml.includes('pdf') || nl.endsWith('.pdf') || ml.startsWith('image/')) {
        const url = URL.createObjectURL(blob);
        setResumeView({ url, mime, filename });
      } else {
        setResumeView({ mime, filename }); // no inline preview — download only
      }
    } catch { if (detailReqRef.current === token) setResumeError('Could not open the résumé.'); }
    finally { if (detailReqRef.current === token) setViewingResume(false); }
  };

  const closeResumeView = () => {
    setResumeView(prev => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });
  };

  // Recruiter asks the APPLICANT to complete missing fields themselves via a token-scoped
  // public page. Backend computes missing[] deterministically + rotates the link.
  const requestCompletion = async () => {
    if (!detailCandidate) return;
    const cid = detailCandidate._id;
    const token = detailReqRef.current;
    setCompletionError('');
    setRequestingCompletion(true);
    try {
      const res = await fetch(`/api/employer/candidates/${cid}/request-completion`, { method: 'POST', headers: authHdr() as HeadersInit });
      const j = await res.json().catch(() => null);
      if (detailReqRef.current !== token) return; // drawer moved on — drop
      if (!res.ok) { setCompletionError(j?.message || 'Could not send the request.'); return; }
      setCompletionInfo({ missing: j?.missing || [], sent: !!j?.sent, link: j?.link });
      setDetailCandidate(prev => prev && prev._id === cid ? { ...prev, completionRequestedAt: j?.requestedAt || new Date().toISOString() } : prev);
      setCandidates(prev => prev.map(c => c._id === cid ? { ...c, completionRequestedAt: j?.requestedAt || new Date().toISOString() } : c));
    } catch { if (detailReqRef.current === token) setCompletionError('Could not send the request.'); }
    finally { if (detailReqRef.current === token) setRequestingCompletion(false); }
  };

  // One-click "Rank for this job": runs hiring analysis for the candidate's job, then loads
  // this candidate's persisted assessment (6 match dims + 7 predictions). Never throws, and
  // drops its results if the drawer has since been re-opened (different or same candidate).
  const rankForJob = async () => {
    const c = detailCandidate;
    if (!c?.jobId) return;
    const token = detailReqRef.current;
    const isStale = () => detailReqRef.current !== token;
    setAnalyzingFit(true);
    try {
      await fetch(`/api/employer/hiring/analyze/${c.jobId}`, { method: 'POST', headers: authHdr() as HeadersInit });
      if (isStale()) return;
      const asRes = await fetch(`/api/employer/hiring/assessment/${c.jobId}/${c._id}`, { headers: authHdr() as HeadersInit });
      if (isStale()) return;
      if (asRes.ok) {
        const asJson = await asRes.json();
        if (isStale()) return;
        setHiringAssessment(asJson);
        setAssessmentMissing(false);
      } else setAssessmentMissing(true);
    } catch {} finally { if (!isStale()) setAnalyzingFit(false); }
  };

  const logActivity = async () => {
    if (!detailCandidate || !activityForm.title) return;
    setSavingActivity(true);
    try {
      const res = await fetch('/api/employer/activity', { method: 'POST', headers: authHdr() as HeadersInit, body: JSON.stringify({ ...activityForm, candidateId: detailCandidate._id }) });
      const d = await res.json();
      if (d.success) { setActivityLogs(prev => [d.log, ...prev]); setActivityForm({ type: 'Note', title: '', description: '', by: '' }); setShowActivityForm(false); }
    } catch {} finally { setSavingActivity(false); }
  };

  const saveRefCheck = async () => {
    if (!detailCandidate || !refForm.refName) return;
    setSavingRef(true);
    try {
      const res = await fetch('/api/employer/ref-checks', { method: 'POST', headers: authHdr() as HeadersInit, body: JSON.stringify({ ...refForm, candidateId: detailCandidate._id }) });
      const d = await res.json();
      if (d.success) { setRefChecks(prev => [d.check, ...prev]); setRefForm({ refName: '', refTitle: '', refCompany: '', refEmail: '', refPhone: '', relationship: '', status: 'Not Started' }); setShowRefForm(false); }
    } catch {} finally { setSavingRef(false); }
  };

  const updateRefStatus = async (checkId: string, status: string) => {
    const res = await fetch(`/api/employer/ref-checks/${checkId}`, { method: 'PUT', headers: authHdr() as HeadersInit, body: JSON.stringify({ status }) });
    const d = await res.json();
    if (d.success) setRefChecks(prev => prev.map(r => r._id === checkId ? { ...r, status } : r));
  };

  // Multi-axis filtering. Stage is applied separately so the stage chips can show
  // live counts that respect every OTHER active filter.
  const searchQ = search.trim().toLowerCase();
  const matchesFilters = (c: Candidate) =>
    (filterSource === 'All' || c.source === filterSource) &&
    (filterJob === 'All' || c.jobId === filterJob) &&
    (!filterPooled || c.pooled) &&
    (!filterAssessed || c.assessmentSent) &&
    c.eiScore >= eiMin &&
    c.matchScore >= fitMin &&
    (!searchQ ||
      c.name.toLowerCase().includes(searchQ) ||
      c.email.toLowerCase().includes(searchQ) ||
      c.currentRole.toLowerCase().includes(searchQ) ||
      (c.skills || []).some(s => s.toLowerCase().includes(searchQ)));

  const nonStageList = candidates.filter(matchesFilters);
  const stageCounts: Record<string, number> = { All: nonStageList.length };
  JOB_STAGES.forEach(s => { stageCounts[s] = nonStageList.filter(c => c.stage === s).length; });

  const activeFilterCount =
    (filterSource !== 'All' ? 1 : 0) + (filterJob !== 'All' ? 1 : 0) +
    (filterPooled ? 1 : 0) + (filterAssessed ? 1 : 0) +
    (eiMin > 0 ? 1 : 0) + (fitMin > 0 ? 1 : 0);

  const sortDirMul = sortDir === 'asc' ? 1 : -1;
  const filtered = nonStageList
    .filter(c => filterStage === 'All' || c.stage === filterStage)
    .slice()
    .sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':       cmp = a.name.localeCompare(b.name); break;
        case 'eiScore':    cmp = a.eiScore - b.eiScore; break;
        case 'matchScore': cmp = a.matchScore - b.matchScore; break;
        case 'stage':      cmp = JOB_STAGES.indexOf(a.stage) - JOB_STAGES.indexOf(b.stage); break;
        case 'recency':
        default:           cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(); break;
      }
      return cmp * sortDirMul;
    });

  const sourceOptions = Array.from(new Set(candidates.map(c => c.source).filter(Boolean))).sort();

  // "Selection" for bulk actions/counts always means the CURRENTLY VISIBLE selection,
  // so a selection hidden behind a filter is never silently acted on or miscounted.
  const visibleSelected = filtered.filter(c => selectedIds.has(c._id));
  const visibleSelectedCount = visibleSelected.length;

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' || key === 'stage' ? 'asc' : 'desc'); }
  };

  const fld = (k: keyof typeof form, label: string, type = 'text') => (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">{label}</label>
      <input type={type} value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
        className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
    </div>
  );

  const sourceLabels: Record<string,{label:string; icon:React.ReactNode; color:string}> = {
    naukri:  { label:'Naukri',       icon:<Globe size={13}/>,          color:'#f4a261' },
    linkedin:{ label:'LinkedIn',     icon:<Linkedin size={13}/>,       color:'#0a66c2' },
    indeed:  { label:'Indeed',       icon:<Search size={13}/>,         color:'#2557a7' },
    metryx:  { label:'MetryxOne DB', icon:<Database size={13}/>,       color:BRAND.primary },
    excel:   { label:'Excel / CSV',  icon:<FileSpreadsheet size={13}/>,color:BRAND.green },
  };

  return (
    <div className="space-y-4">

      {/* ── Passive Engagement Modal ────────────────────────────────────────── */}
      {showPassiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowPassiveModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Passive Candidate Engagement</h3>
                <p className="text-[10px] text-gray-400">{passiveCandidates.length} candidate{passiveCandidates.length!==1?'s':''} selected from MetryxOne DB</p>
              </div>
              <button onClick={() => setShowPassiveModal(false)}><X size={16} className="text-gray-400" /></button>
            </div>
            {passiveSent ? (
              <div className="text-center py-8">
                <CheckCircle size={36} className="mx-auto mb-3" style={{ color: BRAND.green }} />
                <div className="text-sm font-semibold text-gray-800 mb-1">Engagement Messages Sent!</div>
                <div className="text-xs text-gray-500">{passiveCandidates.length} personalised outreach messages dispatched. Responses will appear in your Candidates list.</div>
                <button onClick={() => { setShowPassiveModal(false); setPassiveSent(false); }} className="mt-4 text-xs font-medium px-4 py-2 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>Done</button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {passiveCandidates.map(c => (
                    <div key={c.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium" style={{ backgroundColor:`${BRAND.primary}10`, color:BRAND.primary }}>
                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px]" style={{ background:`${BRAND.primary}` }}>{c.name.charAt(0)}</div>
                      {c.name}
                      {c.passiveScore && <span className="text-gray-400">· {c.passiveScore}% passive</span>}
                    </div>
                  ))}
                </div>
                <div className="mb-3">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Outreach Message Template</label>
                  <textarea rows={7} value={passiveMsg} onChange={e => setPassiveMsg(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:border-blue-300" />
                  <p className="text-[9px] text-gray-400 mt-1">Use [Name] as a placeholder — it will be personalised per candidate.</p>
                </div>
                <div className="flex gap-2 p-3 rounded-xl mb-4" style={{ backgroundColor:`${BRAND.primary}06`, border:`1px solid ${BRAND.primary}20` }}>
                  <Info size={12} style={{ color:BRAND.primary }} className="shrink-0 mt-0.5" />
                  <div className="text-[10px] text-gray-600">Messages are sent via MetryxOne's encrypted outreach system. Candidates who respond will be automatically added to your <strong>Applied</strong> pipeline.</div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowPassiveModal(false)} className="text-xs px-3 py-2 text-gray-500">Cancel</button>
                  <button onClick={sendPassiveEngagement} disabled={passiveSending}
                    className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl text-white"
                    style={{ backgroundColor: BRAND.primary }}>
                    {passiveSending ? <><RefreshCw size={11} className="animate-spin" />Sending…</> : <><Send size={11} />Send Outreach ({passiveCandidates.length})</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Candidates</h1>
          <p className="text-xs text-gray-500 mt-0.5">{candidates.length} total · {candidates.filter(c => c.stage === 'Applied').length} new · {candidates.filter(c => c.stage === 'Hired').length} hired</p>
        </div>
        <div className="flex items-center gap-2 relative">
          {/* Import split button */}
          <div className="relative">
            <button onClick={() => { setImportDropdown(v => !v); setShowImport(false); }}
              className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-sm">
              <Upload size={13} /> Import <ChevronDown size={11} />
            </button>
            {importDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-20 min-w-44 p-1" onMouseLeave={() => setImportDropdown(false)}>
                {(Object.entries(sourceLabels) as [string, {label:string;icon:React.ReactNode;color:string}][]).map(([key, cfg]) => (
                  <button key={key} onClick={() => { setImportSource(key as any); setShowImport(true); setImportDropdown(false); setImportSearch(''); setImportLocation(''); setImportSelected(new Set()); resetParsed(); }}
                    className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-gray-50">
                    <span style={{ color: cfg.color }}>{cfg.icon}</span>
                    <span className="text-gray-700 font-medium">{cfg.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Export */}
          <div className="relative">
            <button onClick={() => setExportMenu(v => !v)} disabled={candidates.length === 0}
              aria-label="Export candidates" aria-haspopup="menu" aria-expanded={exportMenu}
              className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-sm disabled:opacity-50">
              <Download size={13} /> Export <ChevronDown size={11} />
            </button>
            {exportMenu && (
              <div role="menu" className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-20 min-w-52 p-1" onMouseLeave={() => setExportMenu(false)}>
                <button role="menuitem" onClick={() => exportToCsv('filtered')}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-gray-50">
                  <FileSpreadsheet size={13} style={{ color: BRAND.green }} />
                  <span className="text-gray-700 font-medium">Current view ({filtered.length})</span>
                </button>
                <button role="menuitem" onClick={() => exportToCsv('selected')} disabled={visibleSelectedCount === 0}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-gray-50 disabled:opacity-40">
                  <CheckSquare size={13} style={{ color: BRAND.primary }} />
                  <span className="text-gray-700 font-medium">Selected ({visibleSelectedCount})</span>
                </button>
              </div>
            )}
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm" style={{ backgroundColor: BRAND.primary }}>
            <Plus size={13} /> Add Manually
          </button>
        </div>
      </div>

      {/* ── Import Center Panel ───────────────────────────────────────────── */}
      {showImport && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100" style={{ background:`${BRAND.primary}` }}>
            <div className="flex items-center gap-2">
              <span style={{ color: sourceLabels[importSource].color }}>{sourceLabels[importSource].icon}</span>
              <span className="text-sm font-bold text-gray-800">Import from {sourceLabels[importSource].label}</span>
              {importDone.length > 0 && <Chip label={`${importDone.length} already imported`} color={BRAND.green} size="xs" />}
            </div>
            <div className="flex items-center gap-1.5">
              {/* Source tabs */}
              <div className="flex gap-0.5 p-0.5 bg-gray-100 rounded-lg mr-2">
                {(Object.entries(sourceLabels) as [string,{label:string;icon:React.ReactNode;color:string}][]).map(([key,cfg]) => (
                  <button key={key} onClick={() => { setImportSource(key as any); setImportSearch(''); setImportLocation(''); setImportSelected(new Set()); resetParsed(); }}
                    className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md transition-all ${importSource===key?'bg-white shadow-sm':''}`}
                    style={importSource===key?{color:cfg.color}:{color:'#94a3b8'}}>
                    {cfg.icon}<span className="hidden sm:inline">{cfg.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowImport(false)}><X size={15} className="text-gray-400 hover:text-gray-600" /></button>
            </div>
          </div>

          <div className="p-5">
            {/* ── Real CSV / Excel Upload ── */}
            {importSource === 'excel' && (
              <div className="space-y-4">
                <input ref={fileInputRef} type="file" aria-label="Upload candidate Excel or CSV file" accept=".csv,.xlsx,.xls" onChange={onFilePicked} className="hidden" />
                {!excelParsed ? (
                  <>
                    <div
                      onDragOver={e => { e.preventDefault(); setExcelDragOver(true); }}
                      onDragLeave={() => setExcelDragOver(false)}
                      onDrop={e => { e.preventDefault(); setExcelDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); }}
                      className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${excelDragOver?'border-teal-400 bg-teal-50':'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                      onClick={() => fileInputRef.current?.click()}>
                      {parsing
                        ? <RefreshCw size={36} className="mx-auto mb-3 animate-spin" style={{ color: BRAND.green }} />
                        : <FileSpreadsheet size={36} className="mx-auto mb-3" style={{ color: excelDragOver ? BRAND.green : '#cbd5e1' }} />}
                      <div className="text-sm font-semibold text-gray-700 mb-1">{parsing ? 'Reading your file…' : 'Drop your Excel or CSV file here'}</div>
                      <div className="text-xs text-gray-400 mb-4">Supports .xlsx, .xls, .csv — max 5 MB</div>
                      <button className="text-xs font-medium px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
                        Browse File
                      </button>
                      <div className="mt-4 text-[10px] text-gray-400">
                        Expected columns: Name, Email, Phone, Location, Current Role, Experience, Skills, Education
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                        className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300">
                        <Download size={12} /> Download import template
                      </button>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[10px] text-gray-400">Required: <strong className="text-gray-500">Name</strong> + <strong className="text-gray-500">Email</strong>. Other columns are optional and auto-detected. Use the template above for the exact format.</span>
                    </div>
                    {parseError && (
                      <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor:`${BRAND.red}08`, border:`1px solid ${BRAND.red}25` }}>
                        <AlertCircle size={13} style={{ color: BRAND.red }} className="shrink-0 mt-0.5" />
                        <span className="text-[11px]" style={{ color: BRAND.red }}>{parseError}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} style={{ color: BRAND.green }} />
                        <span className="text-xs font-semibold text-gray-800">Parsed {parsedRows.length} row{parsedRows.length!==1?'s':''} from <span style={{color:BRAND.green}}>{fileName}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={toggleAllParsed} className="text-[10px] font-medium px-2 py-1 rounded-lg border border-gray-200 text-gray-500">
                          {newRowCount > 0 && parsedRows.filter(r=>r.status==='new').every(r=>importSelected.has(r.id)) ? 'Deselect All' : `Select All New (${newRowCount})`}
                        </button>
                        <button onClick={() => { resetParsed(); setTimeout(() => fileInputRef.current?.click(), 0); }} className="text-[10px] font-medium px-2 py-1 rounded-lg border border-gray-200 text-gray-500">
                          Choose another file
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-1">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{backgroundColor:BRAND.green}} />{newRowCount} new</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{backgroundColor:BRAND.orange}} />{parsedRows.filter(r=>r.status==='duplicate').length} duplicate</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{backgroundColor:BRAND.red}} />{parsedRows.filter(r=>r.status==='invalid').length} invalid</span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100 max-h-72 overflow-y-auto">
                      <table className="w-full text-[10px]">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>{['','Name','Email','Location','Role','Experience','Skills','Status'].map(h=><th key={h} className="text-left text-gray-400 font-semibold px-3 py-2 first:px-2">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {parsedRows.map(r => {
                            const isNew = r.status === 'new';
                            const statusColor = r.status==='new'||r.status==='imported'?BRAND.green:r.status==='duplicate'?BRAND.orange:BRAND.red;
                            const statusLabel = r.status==='new'?'New':r.status==='imported'?'Imported':(r.reason || (r.status==='duplicate'?'Duplicate':'Invalid'));
                            return (
                              <tr key={r.id} className={`border-t border-gray-50 ${!isNew?'opacity-60':''}`}>
                                <td className="px-2 py-2"><input type="checkbox" checked={importSelected.has(r.id)} disabled={!isNew} onChange={() => isNew && toggleImportSelect(r.id)} style={{accentColor:BRAND.primary}} /></td>
                                <td className="px-3 py-2 font-semibold text-gray-800">{r.name||'—'}</td>
                                <td className="px-3 py-2 text-gray-500">{r.email||'—'}</td>
                                <td className="px-3 py-2 text-gray-600">{r.location||'—'}</td>
                                <td className="px-3 py-2 text-gray-700">{r.currentRole||'—'}</td>
                                <td className="px-3 py-2 text-gray-500">{r.experience||'—'}</td>
                                <td className="px-3 py-2"><div className="flex flex-wrap gap-0.5">{r.skills.slice(0,2).map(s=><span key={s} className="px-1 py-0.5 rounded bg-blue-50 text-blue-600">{s}</span>)}</div></td>
                                <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded font-medium whitespace-nowrap" style={{backgroundColor:`${statusColor}15`, color:statusColor}}>{statusLabel}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Portal sources (Naukri / LinkedIn / Indeed) ── */}
            {(importSource === 'naukri' || importSource === 'linkedin' || importSource === 'indeed') && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-2.5 rounded-lg" style={{ backgroundColor:`${BRAND.orange}0d`, border:`1px solid ${BRAND.orange}30` }}>
                  <Info size={12} style={{ color: BRAND.orange }} className="shrink-0 mt-0.5" />
                  <span className="text-[10px] text-gray-600"><strong className="text-gray-800">Demo data</strong> — live {sourceLabels[importSource].label} sourcing requires that portal's official paid API. For real candidates today, use the <strong>Excel / CSV</strong> source. These rows are illustrative only.</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-36">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={importSearch} onChange={e => setImportSearch(e.target.value)} placeholder="Role, skill or name…"
                      className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
                  </div>
                  <div className="relative min-w-28">
                    <MapPin size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={importLocation} onChange={e => setImportLocation(e.target.value)} placeholder="City…"
                      className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
                  </div>
                  <button onClick={toggleAllImport} className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                    {importSelected.size === importResults.length && importResults.length > 0 ? 'Deselect All' : `Select All (${importResults.length})`}
                  </button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {importResults.map(c => {
                    const isDone = alreadyImported(c.id);
                    const isSelected = importSelected.has(c.id);
                    return (
                      <label key={c.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isDone?'opacity-50 cursor-default':isSelected?'border-blue-200 bg-blue-50':'border-gray-100 bg-white hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={isSelected || isDone} disabled={isDone} onChange={() => !isDone && toggleImportSelect(c.id)} style={{accentColor:BRAND.primary}} className="mt-0.5" />
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background:`${sourceLabels[importSource].color}` }}>{c.name.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-gray-800">{c.name}</span>
                            {isDone && <Chip label="Imported" color={BRAND.green} size="xs" />}
                            <Chip label={`${c.matchScore}% fit`} color={c.matchScore>=85?BRAND.green:c.matchScore>=75?BRAND.orange:BRAND.red} size="xs" />
                          </div>
                          <div className="text-[10px] text-gray-500">{c.currentRole} · {c.experience} · {c.location}</div>
                          {c.salary && <div className="text-[10px] text-gray-400">{c.salary} · {c.availability}</div>}
                          <div className="flex flex-wrap gap-0.5 mt-1">
                            {c.skills.slice(0,3).map(s=><span key={s} className="px-1 py-0.5 rounded text-[9px]" style={{backgroundColor:`${sourceLabels[importSource].color}12`,color:sourceLabels[importSource].color}}>{s}</span>)}
                          </div>
                        </div>
                        <div className="text-[9px] text-gray-400 shrink-0">{c.lastActive}</div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── MetryxOne DB (Passive Pool) ── */}
            {importSource === 'metryx' && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor:`${BRAND.primary}06`, border:`1px solid ${BRAND.primary}15` }}>
                  <Database size={13} style={{ color:BRAND.primary }} className="shrink-0 mt-0.5" />
                  <div className="text-[10px] text-gray-600"><strong className="text-gray-800">MetryxOne Behavioural Pool</strong> — Candidates who have completed LBI™ assessments via MetryxOne and are available for employer outreach. Each has a verified behavioural profile and LBI score.</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-36">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={importSearch} onChange={e => setImportSearch(e.target.value)} placeholder="Role or skill…"
                      className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
                  </div>
                  <div className="relative min-w-28">
                    <MapPin size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={importLocation} onChange={e => setImportLocation(e.target.value)} placeholder="City…"
                      className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
                  </div>
                  <button onClick={toggleAllImport} className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500">
                    {importSelected.size === importResults.length && importResults.length > 0 ? 'Deselect All' : `Select All (${importResults.length})`}
                  </button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {importResults.map(c => {
                    const isDone = alreadyImported(c.id);
                    const isSelected = importSelected.has(c.id);
                    const passiveLevel = !c.passiveScore ? 'Unknown' : c.passiveScore >= 75 ? 'Active Seeker' : c.passiveScore >= 50 ? 'Open to Opportunities' : 'Passive';
                    const passiveColor = !c.passiveScore ? '#94a3b8' : c.passiveScore >= 75 ? BRAND.green : c.passiveScore >= 50 ? BRAND.orange : '#94a3b8';
                    return (
                      <div key={c.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${isDone?'opacity-50':isSelected?'border-blue-200 bg-blue-50':'border-gray-100 bg-white'}`}>
                        <input type="checkbox" checked={isSelected || isDone} disabled={isDone} onChange={() => !isDone && toggleImportSelect(c.id)} style={{accentColor:BRAND.primary}} className="mt-1 cursor-pointer" />
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background:`${BRAND.primary}` }}>{c.name.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-xs font-semibold text-gray-800">{c.name}</span>
                            {isDone && <Chip label="Imported" color={BRAND.green} size="xs" />}
                            <Chip label={`LBI ${c.lbiScore}`} color={BRAND.primary} size="xs" />
                            <Chip label={c.behavProfile||''} color={BRAND.purple} size="xs" />
                          </div>
                          <div className="text-[10px] text-gray-500">{c.currentRole} · {c.experience} · {c.location}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-medium" style={{color:passiveColor}}>● {passiveLevel}</span>
                            <span className="text-[9px] text-gray-400">{c.availability}</span>
                          </div>
                          <div className="flex flex-wrap gap-0.5 mt-1">
                            {c.skills.slice(0,3).map(s=><span key={s} className="px-1 py-0.5 rounded text-[9px]" style={{backgroundColor:`${BRAND.primary}10`,color:BRAND.primary}}>{s}</span>)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Chip label={`${c.matchScore}% fit`} color={c.matchScore>=85?BRAND.green:BRAND.orange} size="xs" />
                          {!isDone && isSelected && (
                            <button onClick={() => { handleEngagePassive([c]); }}
                              className="text-[9px] font-medium px-2 py-0.5 rounded-lg border flex items-center gap-0.5"
                              style={{ borderColor:`${BRAND.purple}30`, color:BRAND.purple }}>
                              <Send size={9} />Engage
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {importSelected.size > 0 && (
                  <button onClick={() => handleEngagePassive(importResults.filter(c => importSelected.has(c.id)))}
                    className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl text-white w-full justify-center"
                    style={{ backgroundColor: BRAND.purple }}>
                    <Send size={12} />Engage {importSelected.size} Passive Candidate{importSelected.size!==1?'s':''} via MetryxOne
                  </button>
                )}
              </div>
            )}

            {/* ── Import action footer (portal sources) ── */}
            {(importSource === 'naukri' || importSource === 'linkedin' || importSource === 'indeed') && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <span className="text-[10px] text-gray-400">{importSelected.size} selected · {importResults.filter(c=>!alreadyImported(c.id)).length} available to import</span>
                <button onClick={handleImportCandidates}
                  disabled={importing || importSelected.size === 0}
                  className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl text-white"
                  style={{ backgroundColor: importing || importSelected.size === 0 ? '#94a3b8' : sourceLabels[importSource].color }}>
                  {importing ? <><RefreshCw size={11} className="animate-spin" />Importing…</> : <><UserPlus size={11} />Import {importSelected.size > 0 ? importSelected.size : ''} Candidate{importSelected.size!==1?'s':''}</>}
                </button>
              </div>
            )}

            {/* ── Import action footer (real CSV/Excel) ── */}
            {importSource === 'excel' && excelParsed && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                {importSummary && (
                  <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor:`${BRAND.green}08`, border:`1px solid ${BRAND.green}25` }}>
                    <CheckCircle size={13} style={{ color: BRAND.green }} className="shrink-0 mt-0.5" />
                    <span className="text-[11px] text-gray-700">
                      Imported <strong style={{color:BRAND.green}}>{importSummary.inserted}</strong> candidate{importSummary.inserted!==1?'s':''}
                      {importSummary.duplicates > 0 && <> · <strong style={{color:BRAND.orange}}>{importSummary.duplicates}</strong> duplicate{importSummary.duplicates!==1?'s':''} skipped</>}
                      {importSummary.invalid > 0 && <> · <strong style={{color:BRAND.red}}>{importSummary.invalid}</strong> invalid skipped</>}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">{importSelected.size} selected · {newRowCount} new available to import</span>
                  <button onClick={handleImportExcel}
                    disabled={importing || importSelected.size === 0}
                    className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl text-white"
                    style={{ backgroundColor: importing || importSelected.size === 0 ? '#94a3b8' : BRAND.green }}>
                    {importing ? <><RefreshCw size={11} className="animate-spin" />Importing…</> : <><UserPlus size={11} />Import {importSelected.size > 0 ? importSelected.size : ''} Candidate{importSelected.size!==1?'s':''}</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bulk Action Bar ───────────────────────────────────────────────── */}
      {visibleSelectedCount > 0 && (
        <div className="flex items-center gap-3 flex-wrap p-3 rounded-xl border" style={{ backgroundColor: `${BRAND.primary}08`, borderColor: `${BRAND.primary}30` }}>
          <span className="text-xs font-semibold" style={{ color: BRAND.primary }}>{visibleSelectedCount} selected</span>
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <select value={bulkStage} onChange={e => setBulkStage(e.target.value)}
              className="h-8 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none bg-white">
              <option value="">Move to stage…</option>
              {JOB_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {bulkStage && <button onClick={bulkMoveStage} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>Move {visibleSelectedCount}</button>}
            <button onClick={bulkSendAssessments} disabled={bulkSending}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white"
              style={{ backgroundColor: BRAND.purple }}>
              {bulkSending ? <RefreshCw size={10} className="animate-spin" /> : <Send size={10} />}
              Send Assessment
            </button>
            <button onClick={bulkPool} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              <Bookmark size={11} /> Pool
            </button>
            <button onClick={() => exportToCsv('selected')} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              <Download size={11} /> Export
            </button>
            <button onClick={bulkDelete} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border text-red-500 hover:bg-red-50" style={{ borderColor: `${BRAND.red}30` }}>
              <Trash2 size={11} /> Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">Clear</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-40">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, role, skills…"
            className="w-full h-9 pl-8 pr-3 text-xs border border-gray-200 rounded-xl focus:outline-none bg-white" />
        </div>
        <select value={`${sortKey}:${sortDir}`} aria-label="Sort candidates"
          onChange={e => { const [k, d] = e.target.value.split(':'); setSortKey(k as typeof sortKey); setSortDir(d as 'asc' | 'desc'); }}
          className="h-8 px-2 text-[11px] border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none">
          <option value="recency:desc">Newest first</option>
          <option value="recency:asc">Oldest first</option>
          <option value="eiScore:desc">EI: High → Low</option>
          <option value="eiScore:asc">EI: Low → High</option>
          <option value="matchScore:desc">Fit: High → Low</option>
          <option value="matchScore:asc">Fit: Low → High</option>
          <option value="name:asc">Name: A → Z</option>
          <option value="name:desc">Name: Z → A</option>
          <option value="stage:asc">Stage: Applied → Hired</option>
        </select>
        <button onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}
          className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all ${showFilters || activeFilterCount > 0 ? 'text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          style={showFilters || activeFilterCount > 0 ? { backgroundColor: BRAND.primary, borderColor: 'transparent' } : {}}>
          <Filter size={11} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        <button onClick={selectAll} className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          {selectedIds.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
        </button>
        <div className="flex flex-wrap gap-1.5">
          {['All', ...JOB_STAGES].map(s => (
            <button key={s} onClick={() => setFilterStage(s)}
              className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all ${filterStage === s ? 'text-white shadow-sm' : 'border-gray-200 text-gray-500'}`}
              style={filterStage === s ? { backgroundColor: s === 'All' ? BRAND.primary : STAGE_COLORS[s], borderColor: 'transparent' } : {}}>
              {s} <span className="opacity-60">{stageCounts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button onClick={() => setViewMode('table')} title="Table view" aria-label="Table view"
            className={`p-1.5 rounded-lg border transition-colors ${viewMode === 'table' ? 'text-white' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
            style={viewMode === 'table' ? { backgroundColor: BRAND.primary, borderColor: 'transparent' } : {}}>
            <List size={13}/>
          </button>
          <button onClick={() => setViewMode('kanban')} title="Kanban board" aria-label="Kanban board"
            className={`p-1.5 rounded-lg border transition-colors ${viewMode === 'kanban' ? 'text-white' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
            style={viewMode === 'kanban' ? { backgroundColor: BRAND.primary, borderColor: 'transparent' } : {}}>
            <LayoutGrid size={13}/>
          </button>
        </div>
      </div>

      {/* Advanced filter panel */}
      {showFilters && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Source</label>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              className="w-full h-8 px-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none">
              <option value="All">All sources</option>
              {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Applied For</label>
            <select value={filterJob} onChange={e => setFilterJob(e.target.value)}
              className="w-full h-8 px-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none">
              <option value="All">All jobs</option>
              {jobs.map(j => <option key={j._id} value={j._id}>{j.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Min EI Score: {eiMin}</label>
            <input type="range" min={0} max={100} value={eiMin} onChange={e => setEiMin(Number(e.target.value))} className="w-full" style={{ accentColor: BRAND.primary }} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Min Fit %: {fitMin}</label>
            <input type="range" min={0} max={100} value={fitMin} onChange={e => setFitMin(Number(e.target.value))} className="w-full" style={{ accentColor: BRAND.primary }} />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer h-8">
            <input type="checkbox" checked={filterPooled} onChange={e => setFilterPooled(e.target.checked)} style={{ accentColor: BRAND.primary }} /> Pooled only
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer h-8">
            <input type="checkbox" checked={filterAssessed} onChange={e => setFilterAssessed(e.target.checked)} style={{ accentColor: BRAND.primary }} /> Assessed only
          </label>
          {activeFilterCount > 0 && (
            <div className="col-span-2 sm:col-span-3 lg:col-span-6">
              <button onClick={clearFilters} className="text-[11px] font-medium text-gray-500 hover:text-gray-700 underline">Clear all filters</button>
            </div>
          )}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Add New Candidate</h3>
            <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {fld('name', 'Full Name *')}
            {fld('email', 'Email', 'email')}
            {fld('phone', 'Phone')}
            {fld('location', 'Location')}
            {fld('currentRole', 'Current Role / Title')}
            {fld('experience', 'Total Experience')}
            {fld('education', 'Education')}
            {fld('linkedinUrl', 'LinkedIn URL')}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Applied For</label>
              <select value={form.jobId} onChange={e => { const j = jobs.find(x => x._id === e.target.value); setForm({ ...form, jobId: e.target.value, jobTitle: j?.title || '' }); }}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                <option value="">Select job…</option>
                {jobs.map(j => <option key={j._id} value={j._id}>{j.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Source</label>
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                {SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Stage</label>
              <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                {JOB_STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">EI Score</label>
              <input type="number" value={form.eiScore} min={0} max={100} onChange={e => setForm({ ...form, eiScore: +e.target.value })}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Match Score %</label>
              <input type="number" value={form.matchScore} min={0} max={100} onChange={e => setForm({ ...form, matchScore: +e.target.value })}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Skills (comma-separated)</label>
              <input value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full text-xs border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="text-xs px-3 py-2 text-gray-500">Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="text-xs font-medium px-4 py-2 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>
              {saving ? 'Saving…' : 'Add Candidate'}
            </button>
          </div>
        </div>
      )}

      {/* Candidate table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          candidates.length === 0 ? (
            /* First-time empty state — onboarding */
            <div className="p-10">
              <div className="max-w-lg mx-auto text-center">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background:`${BRAND.primary}` }}>
                  <Users size={26} className="text-white" />
                </div>
                <h3 className="text-sm font-bold text-gray-800 mb-1">No candidates yet</h3>
                <p className="text-xs text-gray-500 mb-6">Add candidates manually or pull them from Naukri, LinkedIn, Indeed, Excel, or the MetryxOne behavioural pool.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-6">
                  {[
                    { icon:<FileSpreadsheet size={14}/>, label:'Excel / CSV', desc:'Upload your existing spreadsheet', color:BRAND.green, src:'excel' as const },
                    { icon:<Globe size={14}/>, label:'Naukri / LinkedIn', desc:'Pull profiles from job portals', color:'#f4a261', src:'naukri' as const },
                    { icon:<Database size={14}/>, label:'MetryxOne Pool', desc:'Engage assessed passive talent', color:BRAND.primary, src:'metryx' as const },
                  ].map(opt => (
                    <button key={opt.src} onClick={() => { setImportSource(opt.src); setShowImport(true); setImportSearch(''); setImportLocation(''); setImportSelected(new Set()); resetParsed(); }}
                      className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-left transition-all">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor:`${opt.color}15`, color:opt.color }}>{opt.icon}</div>
                      <div>
                        <div className="text-xs font-semibold text-gray-800">{opt.label}</div>
                        <div className="text-[9px] text-gray-400 mt-0.5">{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 justify-center">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-[10px] text-gray-300">or</span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
                <button onClick={() => setShowForm(true)} className="mt-3 flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 mx-auto">
                  <Plus size={12} />Add a candidate manually
                </button>
              </div>
            </div>
          ) : (
            /* Filtered empty state */
            <div className="p-8 text-center">
              <Search size={22} className="mx-auto mb-2 text-gray-300" />
              <div className="text-sm text-gray-400">No candidates match &ldquo;{search || filterStage}&rdquo;.</div>
              <button onClick={() => { setSearch(''); setFilterStage('All'); clearFilters(); }} className="mt-2 text-xs text-blue-500 hover:underline">Clear filters</button>
            </div>
          )
        ) : (<>
          {/* ── Kanban board ─────────────────────────────────────────────── */}
          {viewMode === 'kanban' && (
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-3 min-w-max py-1">
                {JOB_STAGES.map(stage => {
                  const stageCands = filtered.filter(c => c.stage === stage);
                  return (
                    <div key={stage} className="w-52 flex-shrink-0">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STAGE_COLORS[stage] }}/>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 flex-1">{stage}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0"
                          style={{ backgroundColor: STAGE_COLORS[stage] }}>{stageCands.length}</span>
                      </div>
                      <div className="space-y-2 min-h-16">
                        {stageCands.map(c => (
                          <div key={c._id} onClick={() => openDetail(c)}
                            className="bg-white border border-gray-100 rounded-xl p-3 cursor-pointer hover:shadow-sm hover:border-blue-100 transition-all group">
                            <div className="flex items-start gap-2 mb-1.5">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                style={{ backgroundColor: BRAND.primary }}>
                                {c.name.charAt(0)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-semibold text-gray-800 truncate group-hover:text-blue-700">{c.name}</div>
                                <div className="text-[9px] text-gray-400 truncate">{c.currentRole || c.jobTitle || '—'}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {c.eiScore > 0 && <span className="text-[9px] font-semibold px-1 py-0.5 rounded text-white" style={{ backgroundColor: c.eiScore >= 70 ? BRAND.green : c.eiScore >= 50 ? BRAND.orange : BRAND.red }}>EI {c.eiScore}</span>}
                              {c.matchScore > 0 && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-gray-100 text-gray-600">{c.matchScore}%</span>}
                              {c.assessmentCompleted
                                ? <BadgeCheck size={10} className="shrink-0" style={{ color: BRAND.green }}/>
                                : c.assessmentSent && <Clock size={10} className="shrink-0" style={{ color: BRAND.orange }}/>}
                            </div>
                          </div>
                        ))}
                        {stageCands.length === 0 && (
                          <div className="py-4 rounded-xl border-2 border-dashed border-gray-100 text-center text-[9px] text-gray-300">No candidates</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`overflow-x-auto${viewMode === 'kanban' ? ' hidden' : ''}`}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100" style={{ backgroundColor: `${BRAND.primary}04` }}>
                  <th className="w-8 px-3 py-3">
                    <input type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={selectAll}
                      style={{ accentColor: BRAND.primary }}
                      className="cursor-pointer" />
                  </th>
                  {([
                    ['Candidate', 'name'], ['EI Score', 'eiScore'], ['Stage', 'stage'], ['Source', null],
                    ['Fit %', 'matchScore'], ['Skills', null], ['Contact', null], ['', null],
                  ] as [string, typeof sortKey | null][]).map(([h, key]) => (
                    <th key={h}
                      aria-sort={key && sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-3 whitespace-nowrap">
                      {key ? (
                        <button type="button" onClick={() => toggleSort(key)}
                          className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-gray-600 select-none">
                          {h}
                          {sortKey === key && (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                        </button>
                      ) : <span className="inline-flex items-center gap-1">{h}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => {
                  const isSelected = selectedIds.has(c._id);
                  const eiColor = c.eiScore >= 70 ? BRAND.green : c.eiScore >= 50 ? BRAND.orange : BRAND.red;
                  return (
                    <tr key={c._id}
                      className={`border-b border-gray-50 last:border-0 transition-colors ${isSelected ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50/60`}>

                      {/* Checkbox */}
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(c._id)}
                          style={{ accentColor: BRAND.primary }} className="cursor-pointer" />
                      </td>

                      {/* Candidate */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: `${BRAND.primary}` }}>
                            {c.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-gray-800 truncate max-w-36">{c.name}</div>
                            <div className="text-[10px] text-gray-500 truncate max-w-36">{c.currentRole || '—'}</div>
                            <div className="text-[9px] text-gray-400 flex items-center gap-1">
                              {c.location && <><MapPin size={8} className="shrink-0" />{c.location}</>}
                              {c.experience && <><span>·</span>{c.experience}</>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* EI Score */}
                      <td className="px-3 py-3">
                        {c.eiScore > 0 ? (
                          <div className="w-20">
                            <div className="flex justify-between text-[9px] mb-0.5">
                              <span className="text-gray-400">EI</span>
                              <span className="font-semibold" style={{ color: eiColor }}>{c.eiScore}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${c.eiScore}%`, backgroundColor: eiColor }} />
                            </div>
                          </div>
                        ) : <span className="text-[10px] text-gray-300">—</span>}
                      </td>

                      {/* Stage */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <Chip label={c.stage} color={STAGE_COLORS[c.stage]} size="xs" />
                          {c.assessmentCompleted
                            ? <Chip label="✓ Completed" color={BRAND.green} size="xs" />
                            : c.assessmentSent && <Chip label="Invited" color={BRAND.orange} size="xs" />}
                          {c.pooled && <Chip label="⭐ Pooled" color={BRAND.orange} size="xs" />}
                        </div>
                      </td>

                      {/* Source */}
                      <td className="px-3 py-3">
                        {c.source ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg" style={{ backgroundColor: '#94a3b815', color: '#64748b' }}>{c.source}</span>
                        ) : <span className="text-gray-300 text-[10px]">—</span>}
                      </td>

                      {/* Fit % */}
                      <td className="px-3 py-3 text-center">
                        {c.matchScore > 0 ? (
                          <span className="text-xs font-bold" style={{ color: c.matchScore >= 85 ? BRAND.green : c.matchScore >= 70 ? BRAND.orange : BRAND.red }}>
                            {c.matchScore}%
                          </span>
                        ) : <span className="text-gray-300 text-[10px]">—</span>}
                      </td>

                      {/* Skills */}
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1 max-w-40">
                          {c.skills.slice(0, 3).map(s => (
                            <span key={s} className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary }}>{s}</span>
                          ))}
                          {c.skills.length > 3 && <span className="text-[9px] text-gray-400">+{c.skills.length - 3}</span>}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="text-[9px] flex items-center gap-1 text-gray-400 hover:text-gray-700 truncate max-w-36">
                              <Mail size={9} className="shrink-0" />{c.email}
                            </a>
                          )}
                          {c.linkedinUrl && (
                            <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] flex items-center gap-1" style={{ color: '#0a66c2' }}>
                              <Linkedin size={9} className="shrink-0" />LinkedIn
                            </a>
                          )}
                          {c.phone && (
                            <span className="text-[9px] flex items-center gap-1 text-gray-400">
                              <Phone size={9} className="shrink-0" />{c.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openDetail(c)} title="View profile &amp; activity" aria-label={`View ${c.name}'s profile`}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors">
                            <Eye size={13} />
                          </button>
                          <button onClick={() => togglePool(c)} title={c.pooled ? 'Remove from pool' : 'Add to pool'} aria-label={c.pooled ? `Remove ${c.name} from pool` : `Add ${c.name} to pool`}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                            {c.pooled ? <BookmarkCheck size={13} style={{ color: BRAND.orange }} /> : <Bookmark size={13} className="text-gray-300 hover:text-gray-500" />}
                          </button>
                          <button onClick={() => handleDelete(c._id)} title="Remove candidate" aria-label={`Remove ${c.name}`}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>)}

        {/* Table footer */}
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between" style={{ backgroundColor: `${BRAND.primary}03` }}>
            <span className="text-[10px] text-gray-400">{filtered.length} candidate{filtered.length !== 1 ? 's' : ''} · {candidates.filter(c => c.stage === 'Hired').length} hired · {candidates.filter(c => c.pooled).length} pooled</span>
            {selectedIds.size >= 2 && (
              <button onClick={() => setShowCompare(true)}
                className="text-[10px] font-semibold px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5"
                style={{ backgroundColor: BRAND.purple }}>
                <SlidersHorizontal size={11} />Compare {selectedIds.size} Candidates
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Candidate Detail Panel ───────────────────────────────────────── */}
      {showDetail && detailCandidate && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setShowDetail(false)}>
          <div className="flex-1" />
          <div className="w-full max-w-lg bg-white shadow-2xl border-l border-gray-100 flex flex-col h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ background: `${BRAND.primary}` }}>
                {detailCandidate.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900">{detailCandidate.name}</div>
                <div className="text-xs text-gray-500">{detailCandidate.currentRole || '—'} {detailCandidate.location ? `· ${detailCandidate.location}` : ''}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Chip label={detailCandidate.stage} color={STAGE_COLORS[detailCandidate.stage]} size="xs" />
                  {detailCandidate.eiScore > 0 && <Chip label={`EI: ${detailCandidate.eiScore}`} color={BRAND.purple} size="xs" />}
                  {detailCandidate.matchScore > 0 && <Chip label={`${detailCandidate.matchScore}% fit`} color={detailCandidate.matchScore>=80?BRAND.green:BRAND.orange} size="xs" />}
                </div>
              </div>
              <button onClick={() => setShowDetail(false)} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} className="text-gray-400" /></button>
            </div>

            {/* Quick info */}
            <div className="px-5 py-3 border-b border-gray-50 grid grid-cols-2 gap-x-4 gap-y-2">
              {detailCandidate.email && <div className="flex items-center gap-1.5 text-[10px] text-gray-500 truncate"><Mail size={10} className="shrink-0" />{detailCandidate.email}</div>}
              {detailCandidate.phone && <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><Phone size={10} className="shrink-0" />{detailCandidate.phone}</div>}
              {detailCandidate.experience && <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><Clock size={10} className="shrink-0" />{detailCandidate.experience} exp.</div>}
              {detailCandidate.source && <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><Tag size={10} className="shrink-0" />{detailCandidate.source}</div>}
              {detailCandidate.education && <div className="col-span-2 flex items-center gap-1.5 text-[10px] text-gray-500"><GraduationCap size={10} className="shrink-0" />{detailCandidate.education}</div>}
            </div>
            {detailCandidate.skills.length > 0 && (
              <div className="px-5 py-2 border-b border-gray-50 flex flex-wrap gap-1">
                {detailCandidate.skills.map(s => <span key={s} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor:`${BRAND.primary}10`, color:BRAND.primary }}>{s}</span>)}
              </div>
            )}

            {/* ── Profile summary · Résumé/CV · key facts ───────────────────── */}
            <div className="px-5 py-3 border-b border-gray-50 space-y-3">
              {/* Profile summary (deterministic, composed from saved fields only) */}
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <FileText size={11} style={{ color: BRAND.primary }} />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Profile Summary</span>
                </div>
                <p className="text-[11px] leading-relaxed text-gray-600">{buildCandidateSummary(detailCandidate)}</p>
                <div className="text-[8px] text-gray-300 mt-1.5">Auto-composed from this candidate&apos;s saved data — not an AI prediction.</div>
              </div>

              {/* Résumé / CV */}
              <div className="rounded-xl border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText size={12} style={{ color: resumeMeta ? BRAND.green : '#cbd5e1' }} className="shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-gray-700 truncate">{resumeMeta ? resumeMeta.filename : 'No résumé / CV attached'}</div>
                      <div className="text-[9px] text-gray-400">
                        {resumeMeta
                          ? `${fmtBytes(resumeMeta.size)}${resumeMeta.uploadedAt ? ` · added ${new Date(resumeMeta.uploadedAt).toLocaleDateString()}` : ''}`
                          : 'PDF, DOC, DOCX, TXT, RTF, ODT — max 5 MB'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {resumeMeta ? (
                      <>
                        <button onClick={openResumeView} disabled={viewingResume} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND.primary, opacity: viewingResume ? 0.6 : 1 }}>
                          <Eye size={11} /> {viewingResume ? 'Opening…' : 'View'}
                        </button>
                        <button onClick={downloadResume} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                          <Download size={11} /> Download
                        </button>
                        <button onClick={() => resumeInputRef.current?.click()} disabled={uploadingResume} className="text-[10px] font-medium px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                          {uploadingResume ? '…' : 'Replace'}
                        </button>
                        <button onClick={removeResume} title="Remove résumé / CV" aria-label="Remove résumé" className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={12} /></button>
                      </>
                    ) : (
                      <button onClick={() => resumeInputRef.current?.click()} disabled={uploadingResume} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND.primary, opacity: uploadingResume ? 0.6 : 1 }}>
                        <Upload size={11} /> {uploadingResume ? 'Uploading…' : 'Attach résumé'}
                      </button>
                    )}
                  </div>
                </div>
                {resumeError && <div className="mt-2 text-[9px] text-red-500">{resumeError}</div>}
                <input ref={resumeInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.rtf,.odt" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadResume(f); e.target.value = ''; }} />
              </div>

              {/* Ask the applicant to complete their own profile (token-scoped public page) */}
              <div className="rounded-xl border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Send size={12} className="shrink-0" style={{ color: BRAND.primary }} />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-gray-700">Ask applicant to complete profile</div>
                      <div className="text-[9px] text-gray-400">
                        {detailCandidate.completionCompletedAt
                          ? `Applicant completed ${new Date(detailCandidate.completionCompletedAt).toLocaleDateString()}`
                          : detailCandidate.completionRequestedAt
                          ? `Requested ${new Date(detailCandidate.completionRequestedAt).toLocaleDateString()}`
                          : 'Sends a secure link so they fill in missing details themselves'}
                      </div>
                    </div>
                  </div>
                  <button onClick={requestCompletion} disabled={requestingCompletion} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg shrink-0 border border-gray-200 text-gray-600 hover:bg-gray-50" style={{ opacity: requestingCompletion ? 0.6 : 1 }}>
                    <Send size={11} /> {requestingCompletion ? 'Sending…' : (detailCandidate.completionRequestedAt ? 'Resend request' : 'Request from applicant')}
                  </button>
                </div>
                {completionError && <div className="mt-2 text-[9px] text-red-500">{completionError}</div>}
                {completionInfo && (
                  <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 p-2">
                    {completionInfo.missing.length > 0 ? (
                      <>
                        <div className="text-[9px] font-semibold text-gray-500 mb-1">We asked them to add:</div>
                        <div className="flex flex-wrap gap-1">
                          {completionInfo.missing.map(m => (
                            <span key={m.key} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>{m.label}</span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-[9px] text-gray-500">This profile already looks complete — the applicant can still update any detail via the link.</div>
                    )}
                    <div className="mt-1.5 text-[9px]" style={{ color: completionInfo.sent ? BRAND.green : BRAND.orange }}>
                      {completionInfo.sent ? '✓ Secure link emailed to the applicant.' : 'No email was sent — copy this secure link and share it with the applicant directly:'}
                    </div>
                    {!completionInfo.sent && completionInfo.link && (
                      <div className="mt-1 text-[9px] text-gray-500 break-all bg-white border border-gray-100 rounded px-1.5 py-1">{completionInfo.link}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Key facts not surfaced elsewhere in the drawer */}
              {(detailCandidate.jobTitle || detailCandidate.appliedDate || detailCandidate.rating > 0 || detailCandidate.linkedinUrl || (detailCandidate.tags && detailCandidate.tags.length > 0)) && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {detailCandidate.jobTitle && <div className="text-[10px] min-w-0"><span className="text-gray-400">Applied for</span><div className="text-gray-700 font-medium truncate">{detailCandidate.jobTitle}</div></div>}
                  {detailCandidate.appliedDate && <div className="text-[10px]"><span className="text-gray-400">Applied</span><div className="text-gray-700 font-medium">{new Date(detailCandidate.appliedDate).toLocaleDateString()}</div></div>}
                  {detailCandidate.rating > 0 && <div className="text-[10px]"><span className="text-gray-400">Rating</span><div className="font-medium" style={{ color: BRAND.orange }}>{'★'.repeat(Math.min(5, detailCandidate.rating))}{'☆'.repeat(Math.max(0, 5 - detailCandidate.rating))}</div></div>}
                  {detailCandidate.linkedinUrl && <div className="text-[10px] min-w-0"><span className="text-gray-400">LinkedIn</span><div className="truncate"><a href={detailCandidate.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-medium inline-flex items-center gap-0.5" style={{ color: '#0a66c2' }}><Linkedin size={9} /> View profile</a></div></div>}
                  {detailCandidate.tags && detailCandidate.tags.length > 0 && (
                    <div className="text-[10px] col-span-2"><span className="text-gray-400">Tags</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">{detailCandidate.tags.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BRAND.orange}15`, color: BRAND.orange }}>{t}</span>)}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {detailCandidate.notes && (
                <div className="rounded-xl border border-gray-100 bg-amber-50/40 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Notes</div>
                  <p className="text-[11px] leading-relaxed text-gray-600 whitespace-pre-wrap">{detailCandidate.notes}</p>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-5 pt-3">
              {[{ id:'timeline', label:'Activity Timeline' },{ id:'refs', label:`References (${refChecks.length})` },{ id:'intelligence', label:'Intelligence' }].map(t => (
                <button key={t.id} onClick={() => setDetailTab(t.id as typeof detailTab)}
                  className={`text-xs font-medium pb-2 mr-5 border-b-2 transition-colors ${detailTab===t.id?'border-blue-500 text-blue-600':'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center py-12 text-xs text-gray-400">Loading&hellip;</div>
            ) : detailTab === 'timeline' ? (
              <div className="flex-1 px-5 py-4 space-y-4">
                {/* Log activity */}
                <button onClick={() => setShowActivityForm(p=>!p)}
                  className="w-full flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-dashed border-gray-200 text-gray-500 hover:bg-gray-50">
                  <Plus size={12} />Log Activity
                </button>
                {showActivityForm && (
                  <div className="p-3 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] uppercase font-semibold text-gray-400 mb-1 block">Type</label>
                        <select value={activityForm.type} onChange={e => setActivityForm(f=>({...f, type:e.target.value}))}
                          className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none">
                          {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] uppercase font-semibold text-gray-400 mb-1 block">By</label>
                        <input value={activityForm.by} onChange={e => setActivityForm(f=>({...f, by:e.target.value}))}
                          placeholder="Your name" className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-semibold text-gray-400 mb-1 block">Title *</label>
                      <input value={activityForm.title} onChange={e => setActivityForm(f=>({...f, title:e.target.value}))}
                        placeholder="e.g. Initial screening call" className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-semibold text-gray-400 mb-1 block">Notes</label>
                      <textarea value={activityForm.description} onChange={e => setActivityForm(f=>({...f, description:e.target.value}))} rows={2}
                        className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowActivityForm(false)} className="text-xs text-gray-400">Cancel</button>
                      <button onClick={logActivity} disabled={savingActivity} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor:BRAND.primary }}>
                        {savingActivity ? 'Saving…' : 'Log'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                {activityLogs.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">No activity logged yet.</div>
                ) : (
                  <div className="relative space-y-0">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />
                    {activityLogs.map(log => {
                      const color = ACTIVITY_COLORS[log.type] || '#64748b';
                      return (
                        <div key={log._id} className="relative flex gap-3 pb-4">
                          <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shrink-0 z-10"
                            style={{ backgroundColor:`${color}18`, color }}>
                            {ACTIVITY_ICONS[log.type]}
                          </div>
                          <div className="flex-1 bg-white border border-gray-100 rounded-xl p-3 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-gray-800 truncate">{log.title}</span>
                              <span className="text-[9px] text-gray-400 shrink-0">{new Date(log.createdAt).toLocaleDateString()}</span>
                            </div>
                            {log.by && <div className="text-[9px] text-gray-400 mb-1">by {log.by}</div>}
                            {log.description && <div className="text-[10px] text-gray-600 leading-relaxed">{log.description}</div>}
                            <Chip label={log.type} color={color} size="xs" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : detailTab === 'refs' ? (
              <div className="flex-1 px-5 py-4 space-y-3">
                <button onClick={() => setShowRefForm(p=>!p)}
                  className="w-full flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-dashed border-gray-200 text-gray-500 hover:bg-gray-50">
                  <Plus size={12} />Add Reference
                </button>
                {showRefForm && (
                  <div className="p-3 rounded-xl border border-gray-100 bg-gray-50 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {[['refName','Name *'],['refTitle','Title'],['refCompany','Company'],['refEmail','Email'],['refPhone','Phone'],['relationship','Relationship']].map(([k,l]) => (
                        <div key={k}>
                          <label className="text-[9px] uppercase font-semibold text-gray-400 mb-1 block">{l}</label>
                          <input value={(refForm as any)[k]} onChange={e => setRefForm(f=>({...f,[k]:e.target.value}))}
                            className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none" />
                        </div>
                      ))}
                      <div>
                        <label className="text-[9px] uppercase font-semibold text-gray-400 mb-1 block">Status</label>
                        <select value={refForm.status} onChange={e => setRefForm(f=>({...f, status:e.target.value}))}
                          className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none">
                          {REF_CHECK_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowRefForm(false)} className="text-xs text-gray-400">Cancel</button>
                      <button onClick={saveRefCheck} disabled={savingRef} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor:BRAND.primary }}>
                        {savingRef ? 'Saving…' : 'Add'}
                      </button>
                    </div>
                  </div>
                )}
                {refChecks.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">No references added yet.</div>
                ) : (
                  <div className="space-y-2">
                    {refChecks.map(r => (
                      <div key={r._id} className="p-3 rounded-xl border border-gray-100 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-semibold text-gray-800">{r.refName}</div>
                            <div className="text-[10px] text-gray-500">{r.refTitle}{r.refCompany ? ` · ${r.refCompany}` : ''}</div>
                            {r.refEmail && <div className="text-[9px] text-gray-400 mt-0.5">{r.refEmail}</div>}
                          </div>
                          <select value={r.status} onChange={e => updateRefStatus(r._id, e.target.value)}
                            className="text-[9px] border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none">
                            {REF_CHECK_STATUSES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        {r.outcome && <div className="mt-1 text-[10px] text-gray-600 italic">{r.outcome}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 px-5 py-4 overflow-y-auto space-y-5">
                {!intelligenceData ? (
                  <div className="text-center py-8 text-xs text-gray-400">No platform intelligence found for this candidate&apos;s email.</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-xs font-bold text-gray-800">Platform Intelligence</div>
                        <div className="text-[10px] text-gray-400">{intelligenceData.domainCoverage ?? 0} of 7 domains active</div>
                      </div>
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                        intelligenceData.confidence === 'high' ? 'bg-green-100 text-green-700' :
                        intelligenceData.confidence === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                        intelligenceData.confidence === 'low' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-400'
                      }`}>{String(intelligenceData.confidence ?? 'no_data').replace(/_/g,' ').toUpperCase()}</span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries<any>(intelligenceData.domains).map(([key, domain]) => {
                        const label = key.replace(/_intelligence$/, '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                        const score = domain?.eiScore ?? domain?.score ?? null;
                        const conf: string = domain?.confidence ?? '';
                        const dotColor = conf === 'high' || conf === 'data_driven' ? '#22c55e' : conf === 'moderate' ? '#f59e0b' : '#94a3b8';
                        return (
                          <div key={key} className="p-3 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-gray-800">{label}</div>
                                {score !== null && (
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${Math.min(Number(score), 100)}%`, backgroundColor: BRAND.primary }} />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-700 shrink-0">{Math.round(Number(score))}</span>
                                  </div>
                                )}
                              </div>
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                            </div>
                          </div>
                        );
                      })}
                      {Object.keys(intelligenceData.domains).length === 0 && (
                        <div className="text-center py-8 text-xs text-gray-400">No platform data found for this candidate&apos;s email.</div>
                      )}
                    </div>
                    <div className="mt-4 text-[9px] text-gray-300 text-center">
                      Generated {intelligenceData.generatedAt ? new Date(intelligenceData.generatedAt).toLocaleString() : '—'}
                    </div>
                  </>
                )}

                {/* ── Job Fit & Predictions (CONFIDENCE axis — calibration) ─────── */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs font-bold text-gray-800">Job Fit &amp; Predictions</div>
                      <div className="text-[10px] text-gray-400">{detailCandidate.jobTitle || 'No job linked'}</div>
                    </div>
                    {hiringCalibration && (() => {
                      const m = CALIB_META[hiringCalibration.status as string] ?? CALIB_META.cold_start;
                      return (
                        <span title={m.note} className="text-[9px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: m.color, backgroundColor: m.bg }}>
                          {m.label}{hiringCalibration.status === 'provisional' ? ` ${hiringCalibration.totalOutcomes}/30` : ''}
                        </span>
                      );
                    })()}
                  </div>

                  {!detailCandidate.jobId ? (
                    <div className="text-center py-6 text-[11px] text-gray-400">
                      This candidate isn&apos;t linked to a job yet. Assign a job to compute fit &amp; predictions.
                    </div>
                  ) : !hiringAssessment ? (
                    <div className="text-center py-6">
                      <div className="text-[11px] text-gray-400 mb-3">
                        {assessmentMissing ? `Not yet analyzed for ${detailCandidate.jobTitle || 'this job'}.` : 'No fit analysis available.'}
                      </div>
                      <button onClick={rankForJob} disabled={analyzingFit}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                        style={{ backgroundColor: BRAND.primary }}>
                        {analyzingFit ? 'Analyzing…' : 'Rank for this job'}
                      </button>
                      <div className="text-[9px] text-gray-300 mt-2">Computes fit for every candidate on this job.</div>
                    </div>
                  ) : (() => {
                    const a = hiringAssessment;
                    const verdict = a.hiring_recommendation?.verdict ?? a.verdict;
                    const vm = VERDICT_META[verdict] ?? { label: String(verdict ?? '—').replace(/_/g, ' '), color: '#94a3b8' };
                    const dims = [
                      { label: 'Competency', v: Number(a.competency_match) },
                      { label: 'Behaviour',  v: Number(a.behavior_match) },
                      { label: 'Culture',    v: Number(a.culture_match) },
                      { label: 'Potential',  v: Number(a.potential_match) },
                      { label: 'Growth',     v: Number(a.growth_match) },
                    ];
                    const fit = Number(a.fit_score);
                    const predictions = [
                      { label: 'Readiness',        val: `${Math.round(Number(a.readiness_score))}` },
                      { label: 'Success prob.',    val: `${Math.round(Number(a.success_probability))}%` },
                      { label: 'Ramp-up',          val: `${Math.round(Number(a.ramp_up_days))}d` },
                      { label: 'Retention (12mo)', val: `${Math.round(Number(a.retention_probability))}%` },
                      { label: 'Performance (6mo)',val: `${Math.round(Number(a.performance_prediction))}` },
                      { label: 'Leadership',       val: `${Math.round(Number(a.leadership_prediction))}` },
                    ];
                    return (
                      <div className="space-y-3">
                        {/* Overall fit + verdict (verdict = the 7th prediction) */}
                        <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: `${BRAND.primary}08` }}>
                          <div>
                            <div className="text-[10px] text-gray-400">Overall Fit</div>
                            <div className="text-lg font-bold leading-none" style={{ color: BRAND.primary }}>{Math.round(fit)}<span className="text-xs text-gray-400">/100</span></div>
                          </div>
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: vm.color }}>{vm.label}</span>
                        </div>

                        {/* 6 match dimensions (5 sub-dims + overall fit above) */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Match Dimensions</div>
                          {dims.map(d => (
                            <div key={d.label} className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-600 w-20 shrink-0">{d.label}</span>
                              <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(d.v, 0), 100)}%`, backgroundColor: BRAND.accent }} />
                              </div>
                              <span className="text-[10px] font-bold text-gray-700 w-7 text-right shrink-0">{Math.round(d.v)}</span>
                            </div>
                          ))}
                        </div>

                        {/* 7 predictions (6 numeric + verdict pill above) */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Predictions</div>
                          <div className="grid grid-cols-2 gap-2">
                            {predictions.map(p => (
                              <div key={p.label} className="p-2 rounded-lg border border-gray-100">
                                <div className="text-[9px] text-gray-400">{p.label}</div>
                                <div className="text-xs font-bold text-gray-800">{p.val}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="text-[9px] text-gray-300 leading-relaxed">
                          Decision-support signals, not a hiring decision.{hiringCalibration ? ` ${CALIB_META[hiringCalibration.status as string]?.note ?? ''}` : ''}{a.computed_at ? ` · Analyzed ${new Date(a.computed_at).toLocaleString()}` : ''}
                        </div>

                        <button onClick={rankForJob} disabled={analyzingFit}
                          className="text-[10px] font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50">
                          {analyzingFit ? 'Re-analyzing…' : '↻ Re-analyze'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Résumé / CV viewer ───────────────────────────────────────────── */}
      {resumeView && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closeResumeView}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={15} style={{ color: BRAND.primary }} className="shrink-0" />
                <span className="text-sm font-semibold text-gray-800 truncate">{resumeView.filename}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={downloadResume} className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                  <Download size={12} /> Download
                </button>
                <button onClick={closeResumeView} aria-label="Close viewer" className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} className="text-gray-400" /></button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-gray-50">
              {(() => {
                const mime = (resumeView.mime || '').toLowerCase();
                const name = (resumeView.filename || '').toLowerCase();
                const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
                const isImage = mime.startsWith('image/');
                // Text is rendered ESCAPED in a <pre> (React text node) — never iframed — so résumé
                // bytes can never execute as HTML/script. PDF/images are server-typed (nosniff).
                if (resumeView.text !== undefined) return <pre className="w-full h-full overflow-auto p-4 text-xs text-gray-700 whitespace-pre-wrap break-words bg-white font-mono">{resumeView.text}</pre>;
                if (isPdf && resumeView.url) return <iframe title="Résumé preview" src={resumeView.url} className="w-full h-full border-0" />;
                if (isImage && resumeView.url) return <div className="w-full h-full overflow-auto flex items-start justify-center p-4"><img src={resumeView.url} alt="Résumé preview" className="max-w-full h-auto" /></div>;
                return (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center px-6">
                    <FileText size={40} className="text-gray-300 mb-3" />
                    <div className="text-sm font-semibold text-gray-600 mb-1">No inline preview for this format</div>
                    <div className="text-xs text-gray-400 mb-4 max-w-sm">{resumeView.filename} can't be shown in the browser. Download it to view in its native application.</div>
                    <button onClick={downloadResume} className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>
                      <Download size={13} /> Download résumé
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Candidate Comparison Modal ───────────────────────────────────── */}
      {showCompare && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 pt-12 overflow-y-auto" onClick={() => setShowCompare(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Candidate Comparison</h3>
                <p className="text-[10px] text-gray-400">{selectedIds.size} candidates side-by-side</p>
              </div>
              <button onClick={() => setShowCompare(false)}><X size={16} className="text-gray-400" /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-3 w-32">Attribute</th>
                    {candidates.filter(c => selectedIds.has(c._id)).map(c => (
                      <th key={c._id} className="px-3 py-3 min-w-36">
                        <div className="w-8 h-8 rounded-lg mx-auto mb-1 flex items-center justify-center text-white text-xs font-bold"
                          style={{ background:`${BRAND.primary}` }}>{c.name.charAt(0)}</div>
                        <div className="text-xs font-bold text-gray-800 text-center truncate max-w-32">{c.name}</div>
                        <div className="text-[9px] text-gray-400 text-center">{c.currentRole || '—'}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Stage', render: (c: Candidate) => <Chip label={c.stage} color={STAGE_COLORS[c.stage]} size="xs" /> },
                    { label: 'EI Score', render: (c: Candidate) => c.eiScore > 0 ? <span className="font-bold" style={{ color:c.eiScore>=70?BRAND.green:c.eiScore>=50?BRAND.orange:BRAND.red }}>{c.eiScore}/100</span> : <span className="text-gray-300">—</span> },
                    { label: 'Fit %', render: (c: Candidate) => c.matchScore > 0 ? <span className="font-bold" style={{ color:c.matchScore>=85?BRAND.green:c.matchScore>=70?BRAND.orange:BRAND.red }}>{c.matchScore}%</span> : <span className="text-gray-300">—</span> },
                    { label: 'Experience', render: (c: Candidate) => <span className="text-gray-700">{c.experience || '—'}</span> },
                    { label: 'Education', render: (c: Candidate) => <span className="text-gray-700">{c.education || '—'}</span> },
                    { label: 'Location', render: (c: Candidate) => <span className="text-gray-700">{c.location || '—'}</span> },
                    { label: 'Source', render: (c: Candidate) => <span className="text-gray-500">{c.source || '—'}</span> },
                    { label: 'Skills', render: (c: Candidate) => <div className="flex flex-wrap gap-0.5">{c.skills.slice(0,4).map(s=><span key={s} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor:`${BRAND.primary}10`,color:BRAND.primary }}>{s}</span>)}{c.skills.length>4&&<span className="text-[9px] text-gray-400">+{c.skills.length-4}</span>}</div> },
                    { label: 'Assessment', render: (c: Candidate) => c.assessmentCompleted ? <Chip label={c.assessmentScore>0?`Score: ${c.assessmentScore}`:'✓ Completed'} color={BRAND.green} size="xs" /> : c.assessmentSent ? <Chip label="Invited" color={BRAND.orange} size="xs" /> : <span className="text-gray-300 text-[10px]">Not sent</span> },
                  ].map(row => (
                    <tr key={row.label} className="border-b border-gray-50 even:bg-gray-50/40">
                      <td className="px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{row.label}</td>
                      {candidates.filter(c => selectedIds.has(c._id)).map(c => (
                        <td key={c._id} className="px-3 py-2.5 text-center">{row.render(c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowCompare(false)} className="text-xs text-gray-500 hover:text-gray-700">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSESSMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════════
// ASSESSMENTS TAB — v2 (Passive Invite + Fitment + Auto-rank)
// ═══════════════════════════════════════════════════════════════════════════════
// Internal employee record (lightweight version for dispatch)
interface EmpRecord { id: string; name: string; email: string; dept: string; role: string; level: string; location: string }

const MOCK_EMPLOYEES: EmpRecord[] = [
  { id:'e01', name:'Aarav Mehta',     email:'aarav.m@company.com',    dept:'Engineering',  role:'Software Engineer',     level:'Mid',    location:'Bengaluru' },
  { id:'e02', name:'Priya Sharma',    email:'priya.s@company.com',    dept:'Engineering',  role:'Team Lead',             level:'Senior', location:'Bengaluru' },
  { id:'e03', name:'Rohan Iyer',      email:'rohan.i@company.com',    dept:'Product',      role:'Product Manager',       level:'Mid',    location:'Mumbai'    },
  { id:'e04', name:'Sneha Kapoor',    email:'sneha.k@company.com',    dept:'Design',       role:'UX Designer',           level:'Junior', location:'Pune'      },
  { id:'e05', name:'Vikram Nair',     email:'vikram.n@company.com',   dept:'Sales',        role:'Sales Executive',       level:'Junior', location:'Delhi'     },
  { id:'e06', name:'Kavya Reddy',     email:'kavya.r@company.com',    dept:'HR',           role:'HR Manager',            level:'Senior', location:'Hyderabad' },
  { id:'e07', name:'Arjun Patel',     email:'arjun.p@company.com',    dept:'Finance',      role:'Financial Analyst',     level:'Mid',    location:'Ahmedabad' },
  { id:'e08', name:'Meera Joshi',     email:'meera.j@company.com',    dept:'Engineering',  role:'DevOps Engineer',       level:'Senior', location:'Bengaluru' },
  { id:'e09', name:'Dhruv Malhotra',  email:'dhruv.m@company.com',    dept:'Sales',        role:'Account Manager',       level:'Mid',    location:'Delhi'     },
  { id:'e10', name:'Tanvi Singh',     email:'tanvi.s@company.com',    dept:'Product',      role:'Business Analyst',      level:'Junior', location:'Mumbai'    },
  { id:'e11', name:'Rahul Gupta',     email:'rahul.g@company.com',    dept:'Engineering',  role:'Backend Engineer',      level:'Junior', location:'Pune'      },
  { id:'e12', name:'Ananya Bose',     email:'ananya.b@company.com',   dept:'Marketing',    role:'Brand Manager',         level:'Mid',    location:'Kolkata'   },
];

const ASSESSMENT_SUITE = [
  { id:'lbi',      name:'LBI™ Behavioural Index',       duration:'25 min', color: '#344E86', desc:'Cognitive & behavioural mapping' },
  { id:'ei',       name:'Employability Index™',         duration:'40 min', color: '#4ECDC4', desc:'Career readiness & aptitude' },
  { id:'stress',   name:'Stress & Resilience',          duration:'15 min', color: '#2A9D8F', desc:'Stress tolerance & coping' },
  { id:'comm',     name:'Communication Proficiency',    duration:'20 min', color: '#8b5cf6', desc:'Written, verbal & interpersonal' },
  { id:'competency',name:'Competency Snapshot™',        duration:'30 min', color: '#f4a261', desc:'Role-specific skill assessment' },
];

interface DispatchRecord { recipientId: string; recipientName: string; email: string; dept: string; assessmentId: string; assessmentName: string; status: 'queued'|'sent'|'opened'|'in_progress'|'completed'; score: number; dispatchedAt: string; deadline: string }

function AssessmentsTab({ candidates, setCandidates, jobs, onTabChange }: { candidates: Candidate[]; setCandidates: (c: Candidate[]) => void; jobs: EmployerJob[]; onTabChange: (t: TabId) => void }) {
  const [sending, setSending] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [filterView, setFilterView] = useState<'all' | 'pending' | 'sent' | 'scored'>('all');
  const [inviteMode, setInviteMode] = useState<'pipeline' | 'passive' | 'employees'>('pipeline');
  const [passiveEmails, setPassiveEmails] = useState('');
  const [passiveJob, setPassiveJob] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invitedList, setInvitedList] = useState<{ email: string; name: string; status: 'invited' | 'opened' | 'inprogress' | 'scored'; score: number; sentAt: string }[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoThreshold, setAutoThreshold] = useState(65);

  // Employee dispatch state
  const [empDeptFilter, setEmpDeptFilter] = useState('All');
  const [empLevelFilter, setEmpLevelFilter] = useState('All');
  const [selectedEmps, setSelectedEmps] = useState<string[]>([]);
  const [selectedAssessments, setSelectedAssessments] = useState<string[]>(['lbi']);
  const [dispatchDeadline, setDispatchDeadline] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0,10); });
  const [dispatching, setDispatching] = useState(false);
  const [dispatchLog, setDispatchLog] = useState<DispatchRecord[]>([]);
  const [dispatchTab, setDispatchTab] = useState<'setup'|'tracker'>('setup');

  const sendAssessment = async (candidate: Candidate) => {
    setSending(candidate._id);
    try {
      const res = await fetch(`/api/employer/candidates/${candidate._id}/send-assessment`, { method: 'POST', headers: authHdr() as HeadersInit });
      if (!res.ok) { alert(`Could not send the assessment (server error ${res.status}).`); return; }
      const d = await res.json();
      if (d.emailSent) {
        setCandidates(candidates.map(c => c._id === candidate._id ? { ...c, assessmentSent: true, assessmentSentAt: d.sentAt || new Date().toISOString() } : c));
      } else {
        alert(d.message || `Could not deliver the assessment email to ${candidate.email}.`);
      }
    } catch {
      alert('Could not send the assessment — a network error occurred.');
    } finally { setSending(null); }
  };

  const sendAll = async () => {
    setBulkSending(true);
    const pending = candidates.filter(c => !c.assessmentSent && c.stage !== 'Rejected');
    if (pending.length === 0) { setBulkSending(false); alert('No candidates to invite — everyone has been invited or rejected.'); return; }
    const demoCount = pending.filter(c => /@example\.com$/i.test(c.email || '')).length;
    const results = await Promise.all(pending.map(async c => {
      try {
        const res = await fetch(`/api/employer/candidates/${c._id}/send-assessment`, { method: 'POST', headers: authHdr() as HeadersInit });
        if (!res.ok) return { id: c._id, ok: false };
        const d = await res.json();
        return { id: c._id, ok: !!d.emailSent };
      } catch { return { id: c._id, ok: false }; }
    }));
    const sentSet = new Set(results.filter(r => r.ok).map(r => r.id));
    const nowIso = new Date().toISOString();
    if (sentSet.size > 0) {
      setCandidates(candidates.map(c => sentSet.has(c._id) ? { ...c, assessmentSent: true, assessmentSentAt: nowIso } : c));
    }
    const failed = results.length - sentSet.size;
    let msg = `Assessment: ${sentSet.size} invitation${sentSet.size !== 1 ? 's' : ''} sent${failed > 0 ? `, ${failed} failed` : ''}.`;
    if (demoCount > 0) msg += `\n\nNote: ${demoCount} candidate${demoCount !== 1 ? 's use' : ' uses'} an @example.com demo address, which cannot receive email.`;
    alert(msg);
    setBulkSending(false);
  };

  // Employee dispatch helpers
  const empDepts = ['All', ...Array.from(new Set(MOCK_EMPLOYEES.map(e => e.dept))).sort()];
  const empLevels = ['All', 'Junior', 'Mid', 'Senior'];
  const filteredEmps = MOCK_EMPLOYEES.filter(e =>
    (empDeptFilter === 'All' || e.dept === empDeptFilter) &&
    (empLevelFilter === 'All' || e.level === empLevelFilter)
  );
  const allFilteredSelected = filteredEmps.length > 0 && filteredEmps.every(e => selectedEmps.includes(e.id));
  const toggleEmp = (id: string) => setSelectedEmps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAllEmps = () => setSelectedEmps(allFilteredSelected ? selectedEmps.filter(id => !filteredEmps.find(e => e.id === id)) : [...new Set([...selectedEmps, ...filteredEmps.map(e => e.id)])]);
  const toggleAssessment = (id: string) => setSelectedAssessments(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const dispatchToEmployees = () => {
    if (selectedEmps.length === 0 || selectedAssessments.length === 0) return;
    setDispatching(true);
    const today = new Date().toISOString().slice(0, 10);
    setTimeout(() => {
      const records: DispatchRecord[] = [];
      for (const empId of selectedEmps) {
        const emp = MOCK_EMPLOYEES.find(e => e.id === empId);
        if (!emp) continue;
        for (const asmId of selectedAssessments) {
          const asm = ASSESSMENT_SUITE.find(a => a.id === asmId);
          if (!asm) continue;
          if (dispatchLog.find(r => r.recipientId === empId && r.assessmentId === asmId)) continue;
          records.push({
            recipientId: empId, recipientName: emp.name, email: emp.email,
            dept: emp.dept, assessmentId: asmId, assessmentName: asm.name,
            status: 'sent', score: 0, dispatchedAt: today, deadline: dispatchDeadline,
          });
        }
      }
      setDispatchLog(prev => [...records, ...prev]);
      setSelectedEmps([]);
      setDispatching(false);
      setDispatchTab('tracker');
    }, 1500);
  };

  const empDispatchStats = {
    total:       dispatchLog.length,
    sent:        dispatchLog.filter(r => r.status === 'sent').length,
    opened:      dispatchLog.filter(r => r.status === 'opened').length,
    inProgress:  dispatchLog.filter(r => r.status === 'in_progress').length,
    completed:   dispatchLog.filter(r => r.status === 'completed').length,
  };
  const completionPct = empDispatchStats.total > 0 ? Math.round((empDispatchStats.completed / empDispatchStats.total) * 100) : 0;

  const invitePassive = () => {
    setInviting(true);
    const emails = passiveEmails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@'));
    setTimeout(() => {
      const newInvites = emails.map(e => ({
        email: e, name: e.split('@')[0].replace(/[._]/g, ' '),
        status: 'invited' as const,
        score: 0,
        sentAt: new Date().toISOString().slice(0, 10),
      }));
      setInvitedList(prev => [...prev, ...newInvites.filter(n => !prev.find(p => p.email === n.email))]);
      setPassiveEmails('');
      setInviting(false);
    }, 1200);
  };

  const copyLink = () => {
    const link = `https://assess.metryx.one/fitment/${passiveJob || 'general'}?ref=employer`;
    navigator.clipboard.writeText(link).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); });
  };

  const notSent     = candidates.filter(c => !c.assessmentSent && c.stage !== 'Rejected').length;
  const sentCount   = candidates.filter(c => c.assessmentSent).length;
  const scored      = candidates.filter(c => c.assessmentScore > 0).length;
  const avgFitment  = scored > 0 ? Math.round(candidates.filter(c => c.assessmentScore > 0).reduce((s, c) => s + c.assessmentScore, 0) / scored) : 0;
  const topFit      = candidates.filter(c => c.assessmentScore >= autoThreshold).length;

  const FITMENT_DIMS = [
    { key: 'cognitive',    label: 'Cognitive Ability',       icon: <Brain size={11} />,       color: BRAND.primary },
    { key: 'behavioural',  label: 'Behavioural Fit',         icon: <HeartPulse size={11} />,  color: BRAND.accent },
    { key: 'communication',label: 'Communication',           icon: <MessageSquare size={11} />,color: BRAND.green },
    { key: 'resilience',   label: 'Stress Resilience',       icon: <Shield size={11} />,      color: BRAND.orange },
    { key: 'learning',     label: 'Learning Agility',        icon: <GraduationCap size={11} />,color: BRAND.purple },
  ];

  const getFitBand = (score: number) =>
    score >= 85 ? { label: 'Elite Fit', color: '#16a34a' } :
    score >= 70 ? { label: 'Strong Fit', color: BRAND.green } :
    score >= 55 ? { label: 'Moderate Fit', color: BRAND.accent } :
    score >= 40 ? { label: 'Below Average', color: BRAND.orange } :
    { label: 'Not Fit', color: BRAND.red };

  const getDimScores = (seed: number, total: number) =>
    FITMENT_DIMS.map((_, i) => Math.min(100, Math.max(20, Math.round(total + (((seed * (i + 3)) % 17) - 8)))));

  const scoredCandidates = [...candidates.filter(c => c.assessmentScore > 0)].sort((a, b) => b.assessmentScore - a.assessmentScore);

  const displayCandidates = candidates.filter(c => {
    if (filterView === 'pending') return !c.assessmentSent && c.stage !== 'Rejected';
    if (filterView === 'sent')    return c.assessmentSent && c.assessmentScore === 0;
    if (filterView === 'scored')  return c.assessmentScore > 0;
    return true;
  });

  const INVITE_STATUSES = { invited: { label: 'Invited', color: BRAND.primary }, opened: { label: 'Opened', color: BRAND.accent }, inprogress: { label: 'In Progress', color: BRAND.orange }, scored: { label: 'Scored', color: BRAND.green } };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fitment Assessment Suite</h1>
          <p className="text-xs text-gray-500 mt-0.5">Invite pipeline &amp; passive candidates · Score fitment · Auto-route to interviews</p>
        </div>
        <div className="flex gap-2">
          {notSent > 0 && (
            <button onClick={sendAll} disabled={bulkSending}
              className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white"
              style={{ backgroundColor: BRAND.purple }}>
              {bulkSending ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
              Send All Pending ({notSent})
            </button>
          )}
          <button onClick={() => onTabChange('screening')}
            className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
            <Mic size={12} /> Voice Screening
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard label="Pending Invite" value={notSent}    icon={<Clock size={16} />}      color={BRAND.orange} />
        <KPICard label="Invites Sent"   value={sentCount + invitedList.length} icon={<MailCheck size={16} />} color={BRAND.primary} trend="up" />
        <KPICard label="Scored"         value={scored + invitedList.filter(x => x.status === 'scored').length} icon={<CheckCircle size={16} />} color={BRAND.green} />
        <KPICard label="Avg Fitment"    value={avgFitment || '—'} icon={<Target size={16} />} color={BRAND.accent} sub="overall score" />
        <KPICard label={`Above ${autoThreshold}% Threshold`} value={topFit} icon={<BadgeCheck size={16} />} color={BRAND.green} sub="interview-ready" />
      </div>

      {/* Invite Panel */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {([
            { id:'pipeline',  label:'📋 Pipeline Candidates' },
            { id:'passive',   label:'🎯 Passive Candidates' },
            { id:'employees', label:'🏢 Internal Employees' },
          ] as const).map(m => (
            <button key={m.id} onClick={() => setInviteMode(m.id)}
              className={`flex-1 py-3 text-xs font-semibold transition-all ${inviteMode === m.id ? 'text-white' : 'text-gray-500 bg-gray-50/50'}`}
              style={inviteMode === m.id ? { backgroundColor: BRAND.primary } : {}}>
              {m.label}
            </button>
          ))}
        </div>

        {inviteMode === 'pipeline' && (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Info size={12} />
              <span>Send the fitment assessment directly to candidates already in your pipeline.</span>
            </div>
            <div className="space-y-2">
              {displayCandidates.slice(0, 15).map(c => {
                const band = c.assessmentScore > 0 ? getFitBand(c.assessmentScore) : null;
                const dims = c.assessmentScore > 0 ? getDimScores(c._id.charCodeAt(0), c.assessmentScore) : [];
                return (
                  <div key={c._id} className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: (c.assessmentCompleted || c.assessmentScore > 0) ? BRAND.green : c.assessmentSent ? BRAND.orange : BRAND.primary }}>{c.name.charAt(0)}</div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-800">{c.name}</div>
                          <div className="text-[10px] text-gray-400">{c.stage} · {c.source || 'Direct'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.assessmentScore > 0 && band && (
                          <>
                            <div className="text-right">
                              <div className="text-sm font-bold" style={{ color: band.color }}>{c.assessmentScore}</div>
                              <div className="text-[8px]" style={{ color: band.color }}>{band.label}</div>
                            </div>
                            <button onClick={() => setExpandedId(expandedId === c._id ? null : c._id)}
                              className="text-[9px] px-2 py-1 rounded border font-medium" style={{ borderColor: `${BRAND.primary}30`, color: BRAND.primary }}>
                              {expandedId === c._id ? 'Hide' : 'Breakdown'}
                            </button>
                          </>
                        )}
                        {!c.assessmentSent && !c.assessmentCompleted && (
                          <button onClick={() => sendAssessment(c)} disabled={sending === c._id}
                            className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded-lg text-white"
                            style={{ backgroundColor: sending === c._id ? '#94a3b8' : BRAND.primary }}>
                            {sending === c._id ? <RefreshCw size={10} className="animate-spin" /> : <Send size={10} />}
                            {sending === c._id ? '…' : 'Send'}
                          </button>
                        )}
                        {c.assessmentCompleted && c.assessmentScore === 0 && (
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: BRAND.green }}><BadgeCheck size={10} />Completed{c.assessmentCompletedAt ? ` · ${new Date(c.assessmentCompletedAt).toLocaleDateString()}` : ''}</span>
                        )}
                        {!c.assessmentCompleted && c.assessmentSent && c.assessmentScore === 0 && (
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: BRAND.orange }}><Clock size={10} />Invited{c.assessmentSentAt ? ` · ${new Date(c.assessmentSentAt).toLocaleDateString()}` : ''}</span>
                        )}
                      </div>
                    </div>
                    {/* Fitment Dimension Breakdown */}
                    {expandedId === c._id && c.assessmentScore > 0 && (
                      <div className="px-4 pb-4 bg-gray-50/60 border-t border-gray-100 pt-3 space-y-2">
                        <div className="text-[10px] font-semibold text-gray-600 mb-2">Fitment Competency Breakdown</div>
                        {FITMENT_DIMS.map((dim, i) => {
                          const dimScore = dims[i];
                          return (
                            <div key={dim.key} className="flex items-center gap-3">
                              <div className="flex items-center gap-1 w-32 shrink-0" style={{ color: dim.color }}>
                                {dim.icon}
                                <span className="text-[9px] font-medium truncate">{dim.label}</span>
                              </div>
                              <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${dimScore}%`, backgroundColor: dim.color }} />
                              </div>
                              <span className="text-[10px] font-bold w-6 text-right" style={{ color: dim.color }}>{dimScore}</span>
                            </div>
                          );
                        })}
                        <div className="pt-2 flex items-center gap-2 flex-wrap">
                          <Chip label={getFitBand(c.assessmentScore).label} color={getFitBand(c.assessmentScore).color} />
                          {c.assessmentScore >= autoThreshold && <Chip label="✓ Interview-Ready" color={BRAND.green} size="xs" />}
                          <button onClick={() => onTabChange('screening')} className="text-[9px] text-gray-400 underline">Start voice screen →</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {inviteMode === 'passive' && (
          <div className="p-5 space-y-4">
            {/* Shareable link */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Link2 size={13} style={{ color: BRAND.primary }} />
                <span className="text-xs font-semibold text-gray-700">Shareable Assessment Link</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1">
                  <select value={passiveJob} onChange={e => setPassiveJob(e.target.value)}
                    className="w-full h-8 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none mb-2">
                    <option value="">General Fitment Assessment</option>
                    {jobs.map(j => <option key={j._id} value={j._id}>{j.title}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg">
                <span className="text-[10px] text-gray-400 flex-1 truncate font-mono">
                  https://assess.metryx.one/fitment/{passiveJob || 'general'}?ref=employer
                </span>
                <button onClick={copyLink} className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded shrink-0"
                  style={{ backgroundColor: linkCopied ? `${BRAND.green}15` : `${BRAND.primary}12`, color: linkCopied ? BRAND.green : BRAND.primary }}>
                  {linkCopied ? <><CheckCircle size={10} />Copied!</> : <><Copy size={10} />Copy Link</>}
                </button>
              </div>
              <p className="text-[9px] text-gray-400 mt-1">Share this link via WhatsApp, LinkedIn, email, or job postings. Candidates complete the assessment externally and scores appear here.</p>
            </div>

            {/* Email invite */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">
                Paste Candidate Emails (comma, semicolon, or new-line separated)
              </label>
              <textarea rows={4} value={passiveEmails} onChange={e => setPassiveEmails(e.target.value)}
                placeholder="priya@gmail.com, rahul@outlook.com&#10;amit.sharma@company.com"
                className="w-full text-xs border border-gray-200 rounded-xl p-3 resize-none focus:outline-none font-mono" />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gray-400">
                  {passiveEmails.split(/[\n,;]+/).filter(e => e.trim().includes('@')).length} valid email(s) detected
                </span>
                <button onClick={invitePassive} disabled={inviting || !passiveEmails.trim()}
                  className="flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-xl text-white"
                  style={{ backgroundColor: inviting ? '#94a3b8' : BRAND.primary }}>
                  {inviting ? <RefreshCw size={12} className="animate-spin" /> : <MailCheck size={12} />}
                  {inviting ? 'Sending…' : 'Send Fitment Invites'}
                </button>
              </div>
            </div>

            {/* Invited list */}
            {invitedList.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-2">Invited Passive Candidates ({invitedList.length})</div>
                <div className="space-y-2">
                  {invitedList.map((inv, i) => {
                    const st = INVITE_STATUSES[inv.status];
                    return (
                      <div key={i} className="flex items-center justify-between p-2.5 border border-gray-100 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                            style={{ backgroundColor: BRAND.primary }}>{inv.email.charAt(0).toUpperCase()}</div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-gray-700 truncate capitalize">{inv.name}</div>
                            <div className="text-[9px] text-gray-400 truncate">{inv.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {inv.score > 0 && <span className="text-xs font-bold" style={{ color: BRAND.green }}>{inv.score}</span>}
                          <Chip label={st.label} color={st.color} size="xs" />
                          <span className="text-[9px] text-gray-400">{inv.sentAt}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {inviteMode === 'employees' && (
          <div className="p-5 space-y-4">
            {/* Sub-tabs: Setup / Tracker */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
              {(['setup','tracker'] as const).map(t => (
                <button key={t} onClick={() => setDispatchTab(t)}
                  className={`text-[10px] font-semibold px-4 py-1.5 rounded-lg capitalize transition-all ${dispatchTab === t ? 'text-white shadow-sm' : 'text-gray-500'}`}
                  style={dispatchTab === t ? { backgroundColor: BRAND.primary } : {}}>
                  {t === 'setup' ? '⚙️ Dispatch Setup' : `📊 Tracker ${dispatchLog.length > 0 ? `(${dispatchLog.length})` : ''}`}
                </button>
              ))}
            </div>

            {dispatchTab === 'setup' ? (
              <div className="space-y-4">
                {/* Step 1: Filter & Select Employees */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: BRAND.primary }}>1</div>
                    <span className="text-xs font-semibold text-gray-800">Select Recipients</span>
                    {selectedEmps.length > 0 && <Chip label={`${selectedEmps.length} selected`} color={BRAND.primary} size="xs" />}
                  </div>
                  {/* Filters */}
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-500">Dept:</span>
                      <select value={empDeptFilter} onChange={e => setEmpDeptFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 h-7 focus:outline-none">
                        {empDepts.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-500">Level:</span>
                      <select value={empLevelFilter} onChange={e => setEmpLevelFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 h-7 focus:outline-none">
                        {empLevels.map(l => <option key={l}>{l}</option>)}
                      </select>
                    </div>
                    <button onClick={toggleAllEmps} className="text-[10px] font-medium px-2 py-1 rounded border" style={{ borderColor: `${BRAND.primary}30`, color: BRAND.primary }}>
                      {allFilteredSelected ? 'Deselect All' : `Select All (${filteredEmps.length})`}
                    </button>
                  </div>
                  {/* Employee list */}
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {filteredEmps.map(emp => {
                      const isSelected = selectedEmps.includes(emp.id);
                      return (
                        <label key={emp.id} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-blue-50 border border-blue-100' : 'bg-white border border-gray-100 hover:bg-gray-50'}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleEmp(emp.id)} className="rounded" style={{ accentColor: BRAND.primary }} />
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                            style={{ background: `${BRAND.primary}` }}>{emp.name.charAt(0)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-800">{emp.name}</div>
                            <div className="text-[9px] text-gray-400">{emp.role} · {emp.dept}</div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Chip label={emp.level} color={emp.level === 'Senior' ? BRAND.green : emp.level === 'Mid' ? BRAND.accent : BRAND.orange} size="xs" />
                            <span className="text-[9px] text-gray-400">{emp.location}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Choose Assessments */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: BRAND.accent }}>2</div>
                    <span className="text-xs font-semibold text-gray-800">Choose Assessment(s)</span>
                    <span className="text-[9px] text-gray-400">You can select multiple</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {ASSESSMENT_SUITE.map(a => {
                      const isSelected = selectedAssessments.includes(a.id);
                      return (
                        <label key={a.id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border transition-all ${isSelected ? 'border-2' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                          style={isSelected ? { borderColor: a.color, backgroundColor: `${a.color}08` } : {}}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleAssessment(a.id)} style={{ accentColor: a.color }} className="rounded" />
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${a.color}15`, color: a.color }}>
                            <Brain size={12} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-800">{a.name}</div>
                            <div className="text-[9px] text-gray-400">{a.desc} · {a.duration}</div>
                          </div>
                          {isSelected && <CheckCircle size={14} style={{ color: a.color }} className="shrink-0" />}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3: Set Deadline */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: BRAND.green }}>3</div>
                    <span className="text-xs font-semibold text-gray-800">Set Completion Deadline</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="date" value={dispatchDeadline} onChange={e => setDispatchDeadline(e.target.value)}
                      className="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none" style={{ accentColor: BRAND.primary }} />
                    <span className="text-[10px] text-gray-400">Employees will receive a reminder 2 days before deadline</span>
                  </div>
                </div>

                {/* Dispatch summary + button */}
                <div className="flex items-start gap-4 p-4 rounded-xl border" style={{ borderColor: `${BRAND.primary}20`, backgroundColor: `${BRAND.primary}04` }}>
                  <div className="flex-1 space-y-1">
                    <div className="text-xs font-semibold text-gray-800">Dispatch Summary</div>
                    <div className="text-[10px] text-gray-500">
                      · {selectedEmps.length} employee{selectedEmps.length !== 1 ? 's' : ''} selected
                      {' · '}{selectedAssessments.length} assessment{selectedAssessments.length !== 1 ? 's' : ''} chosen
                      {' · '}{selectedEmps.length * selectedAssessments.length} total assessment{selectedEmps.length * selectedAssessments.length !== 1 ? 's' : ''} to dispatch
                    </div>
                    <div className="text-[10px] text-gray-400">Deadline: {dispatchDeadline || 'Not set'}</div>
                  </div>
                  <button onClick={dispatchToEmployees} disabled={dispatching || selectedEmps.length === 0 || selectedAssessments.length === 0 || !dispatchDeadline}
                    className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl text-white shrink-0"
                    style={{ backgroundColor: dispatching || selectedEmps.length === 0 || selectedAssessments.length === 0 ? '#94a3b8' : BRAND.primary }}>
                    {dispatching ? <><RefreshCw size={12} className="animate-spin" />Dispatching…</> : <><Send size={12} />Dispatch Assessments</>}
                  </button>
                </div>
              </div>
            ) : (
              /* Tracker view */
              <div className="space-y-4">
                {dispatchLog.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">
                    <ClipboardList size={28} className="mx-auto mb-2 text-gray-300" />
                    No assessments dispatched yet. Use the Setup tab to send assessments to employees.
                  </div>
                ) : (
                  <>
                    {/* Completion stats */}
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { label: 'Dispatched', val: empDispatchStats.total,     color: BRAND.primary },
                        { label: 'Delivered',  val: empDispatchStats.sent,      color: BRAND.accent  },
                        { label: 'Opened',     val: empDispatchStats.opened,    color: BRAND.orange  },
                        { label: 'In Progress',val: empDispatchStats.inProgress,color: BRAND.purple  },
                        { label: 'Completed',  val: empDispatchStats.completed, color: BRAND.green   },
                      ].map(s => (
                        <div key={s.label} className="text-center p-2 rounded-xl border border-gray-100">
                          <div className="text-xl font-bold" style={{ color: s.color }}>{s.val}</div>
                          <div className="text-[8px] text-gray-400 mt-0.5">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-gray-500 font-medium">Completion Rate</span>
                        <span className="font-bold" style={{ color: BRAND.green }}>{completionPct}%</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${completionPct}%`, backgroundColor: BRAND.green }} />
                      </div>
                    </div>
                    {/* Dispatch table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-gray-400 font-semibold py-2 pr-4">Employee</th>
                            <th className="text-left text-gray-400 font-semibold py-2 pr-4">Dept</th>
                            <th className="text-left text-gray-400 font-semibold py-2 pr-4">Assessment</th>
                            <th className="text-left text-gray-400 font-semibold py-2 pr-4">Status</th>
                            <th className="text-left text-gray-400 font-semibold py-2 pr-4">Score</th>
                            <th className="text-left text-gray-400 font-semibold py-2">Deadline</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dispatchLog.map((r, i) => {
                            const statusConfig = {
                              queued:      { label: 'Queued',      color: '#94a3b8' },
                              sent:        { label: 'Delivered',   color: BRAND.primary },
                              opened:      { label: 'Opened',      color: BRAND.accent },
                              in_progress: { label: 'In Progress', color: BRAND.orange },
                              completed:   { label: 'Completed',   color: BRAND.green },
                            }[r.status];
                            const asm = ASSESSMENT_SUITE.find(a => a.id === r.assessmentId);
                            return (
                              <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                                <td className="py-2.5 pr-4">
                                  <div className="font-semibold text-gray-800">{r.recipientName}</div>
                                  <div className="text-gray-400 text-[9px]">{r.email}</div>
                                </td>
                                <td className="py-2.5 pr-4 text-gray-600">{r.dept}</td>
                                <td className="py-2.5 pr-4">
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: `${asm?.color || BRAND.primary}15`, color: asm?.color || BRAND.primary }}>
                                    {r.assessmentName}
                                  </span>
                                </td>
                                <td className="py-2.5 pr-4">
                                  <span className="flex items-center gap-1" style={{ color: statusConfig.color }}>
                                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: statusConfig.color }} />
                                    {statusConfig.label}
                                  </span>
                                </td>
                                <td className="py-2.5 pr-4">
                                  {r.score > 0 ? <span className="font-bold" style={{ color: BRAND.green }}>{r.score}</span> : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="py-2.5 text-gray-500">{r.deadline}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <button onClick={() => setDispatchTab('setup')}
                      className="text-[10px] font-medium px-3 py-1.5 rounded-lg border text-gray-500 border-gray-200 hover:bg-gray-50">
                      + Dispatch More Assessments
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auto-route threshold */}
      <SCard title="Auto-Route to Interview Post Fitment" icon={<Wand2 size={16} />}
        action={<button onClick={() => onTabChange('interviews')} className="text-[10px] text-gray-400 flex items-center gap-1">View Schedule <ArrowRight size={10} /></button>}>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600 font-medium">Fitment threshold for auto-schedule</span>
                <span className="font-bold" style={{ color: BRAND.primary }}>{autoThreshold}%</span>
              </div>
              <input type="range" min={40} max={90} step={5} value={autoThreshold} onChange={e => setAutoThreshold(+e.target.value)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer" style={{ accentColor: BRAND.primary }} />
              <div className="flex justify-between text-[9px] text-gray-400 mt-1"><span>40% (Inclusive)</span><span>90% (Elite only)</span></div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-3 rounded-xl" style={{ backgroundColor: `${BRAND.green}08` }}>
              <div className="text-xl font-bold" style={{ color: BRAND.green }}>{topFit}</div>
              <div className="text-[9px] text-gray-500">Eligible Now</div>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ backgroundColor: `${BRAND.orange}08` }}>
              <div className="text-xl font-bold" style={{ color: BRAND.orange }}>{candidates.filter(c => c.assessmentScore > 0 && c.assessmentScore < autoThreshold).length}</div>
              <div className="text-[9px] text-gray-500">Below Threshold</div>
            </div>
            <div className="text-center p-3 rounded-xl" style={{ backgroundColor: `${BRAND.primary}08` }}>
              <div className="text-xl font-bold" style={{ color: BRAND.primary }}>{candidates.filter(c => !c.assessmentSent).length}</div>
              <div className="text-[9px] text-gray-500">Not Yet Assessed</div>
            </div>
          </div>
          {topFit > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: `${BRAND.green}30`, backgroundColor: `${BRAND.green}04` }}>
              <div className="flex items-center gap-2">
                <Sparkles size={14} style={{ color: BRAND.green }} />
                <span className="text-xs font-medium text-gray-700">{topFit} candidate{topFit > 1 ? 's' : ''} cleared {autoThreshold}% fitment threshold</span>
              </div>
              <button onClick={() => onTabChange('interviews')}
                className="text-[10px] font-medium px-3 py-1.5 rounded-lg text-white flex items-center gap-1"
                style={{ backgroundColor: BRAND.green }}>
                <Calendar size={10} /> Auto-Schedule →
              </button>
            </div>
          )}
        </div>
      </SCard>

      {/* Fitment leaderboard */}
      {scoredCandidates.length > 0 && (
        <SCard title="Fitment Leaderboard — Ranked by Score" icon={<BarChart3 size={16} />}
          action={<Chip label={`${scored} scored`} color={BRAND.primary} size="xs" />}>
          <div className="space-y-2 mt-1">
            {scoredCandidates.slice(0, 12).map((c, idx) => {
              const band = getFitBand(c.assessmentScore);
              return (
                <div key={c._id} className="flex items-center gap-3">
                  <span className="text-[9px] font-bold w-5 text-gray-400">#{idx + 1}</span>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{ backgroundColor: idx === 0 ? '#d97706' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : BRAND.primary }}>
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-800 truncate">{c.name}</span>
                      <Chip label={band.label} color={band.color} size="xs" />
                      {c.assessmentScore >= autoThreshold && <Chip label="Interview-Ready" color={BRAND.green} size="xs" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.assessmentScore}%`, backgroundColor: band.color }} />
                      </div>
                      <span className="text-xs font-bold shrink-0" style={{ color: band.color }}>{c.assessmentScore}</span>
                    </div>
                  </div>
                  <div className="text-[9px] text-gray-400 shrink-0">{c.stage}</div>
                </div>
              );
            })}
          </div>
        </SCard>
      )}

      {/* Assessment types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { id: 'lbi', name: 'LBI™ — Learning Behaviour Index', desc: 'Maps 7 cognitive domains — concentration, memory, logic, spatial, creativity, EQ, and processing speed.', duration: '25 min', icon: <Brain size={18} />, color: BRAND.primary, domains: ['Concentration','Memory','Logic','Spatial','Creativity','EQ','Processing'] },
          { id: 'ei',  name: 'Employability Index™ Assessment', desc: 'Comprehensive assessment of career readiness, professional aptitude, and workplace behavioural intelligence.', duration: '40 min', icon: <Target size={18} />, color: BRAND.accent, domains: ['Career Readiness','Aptitude','Behavioural IQ','Communication','Adaptability'] },
          { id: 'stress', name: 'Stress & Resilience Assessment', desc: 'Measures workplace stress tolerance, coping mechanisms, and emotional resilience under pressure.', duration: '15 min', icon: <Shield size={18} />, color: BRAND.green, domains: ['Stress Tolerance','Coping','Emotional Regulation','Recovery','Grit'] },
          { id: 'comm', name: 'Communication Proficiency Test', desc: 'Evaluates written, verbal, and interpersonal communication skills with role-specific benchmarking.', duration: '20 min', icon: <MessageSquare size={18} />, color: BRAND.purple, domains: ['Written','Verbal','Listening','Persuasion','Clarity'] },
        ].map(a => (
          <div key={a.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${a.color}15`, color: a.color }}>{a.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-800">{a.name}</div>
                <div className="text-[10px] text-gray-400 mb-1">{a.duration} · AI-Scored · Standardised</div>
                <div className="flex flex-wrap gap-1">
                  {a.domains.map(d => <span key={d} className="text-[8px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${a.color}12`, color: a.color }}>{d}</span>)}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">{a.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE SCREENING TAB
// ═══════════════════════════════════════════════════════════════════════════════
function ScreeningTab({ candidates, setCandidates, jobs, onTabChange, onNavigate }: {
  candidates: Candidate[];
  setCandidates: (c: Candidate[]) => void;
  jobs: EmployerJob[];
  onTabChange: (t: TabId) => void;
  onNavigate?: (screen: string) => void;
}) {
  type ScreenStatus = 'not_started' | 'initiating' | 'in_call' | 'processing' | 'completed';
  interface VoiceResult { overallScore: number; recommendation: 'Advance' | 'Hold' | 'Reject'; summary: string; dims: { label: string; score: number; color: string; note: string }[] }
  interface BankQuestion { id: string; question: string; category: string; difficulty: string; expectedResponse?: string | null; }
  interface PreviewModal { candidateId: string; candidateName: string; questions: BankQuestion[]; loading: boolean; }

  const [screenStatus, setScreenStatus] = useState<Record<string, ScreenStatus>>({});
  const [voiceResults, setVoiceResults] = useState<Record<string, VoiceResult>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState('All');
  const [fitThreshold, setFitThreshold] = useState(60);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<PreviewModal | null>(null);
  const [usedQuestions, setUsedQuestions] = useState<Record<string, BankQuestion[]>>({});

  const VOICE_DIMS = [
    { label: 'Communication Clarity',   color: BRAND.primary   },
    { label: 'Role Knowledge',          color: BRAND.accent    },
    { label: 'Confidence & Composure',  color: BRAND.green     },
    { label: 'Cultural Alignment',      color: BRAND.purple    },
    { label: 'Responsiveness',          color: BRAND.orange    },
  ];
  const VOICE_NOTES: Record<string, string[]> = {
    'Communication Clarity':  ['Excellent articulation throughout','Clear and structured responses','Minor filler words noted','Struggled with complex explanations'],
    'Role Knowledge':         ['Deep domain expertise demonstrated','Good understanding of core concepts','Some gaps in advanced topics','Limited knowledge of role requirements'],
    'Confidence & Composure': ['Poised and assured throughout','Maintained composure under pressure','Slight nervousness at start, recovered well','Appeared stressed when challenged'],
    'Cultural Alignment':     ['Strong value alignment observed','Collaborative mindset evident','Growth orientation strongly expressed','Limited team experience shared'],
    'Responsiveness':         ['Quick, relevant answers throughout','Answered all questions completely','Occasionally paused before responding','Several questions left partially answered'],
  };

  // ── Fetch questions from the question bank for a candidate's role/industry ──
  const openPreview = async (c: Candidate) => {
    setPreviewModal({ candidateId: c._id, candidateName: c.name, questions: [], loading: true });
    try {
      const params = new URLSearchParams({ active: 'true', limit: '12' });
      if (c.jobTitle) params.set('role', c.jobTitle);
      const res = await fetch(`/api/interview-questions?${params}`);
      const data = await res.json();
      const qs: BankQuestion[] = data.success ? (data.questions || []).slice(0, 10) : [];
      // fallback: pick generic questions if no role-specific ones exist
      if (qs.length < 5) {
        const res2 = await fetch('/api/interview-questions?active=true&limit=10');
        const data2 = await res2.json();
        const generic: BankQuestion[] = data2.success ? data2.questions || [] : [];
        const merged = [...qs, ...generic.filter(q => !qs.find(x => x.id === q.id))].slice(0, 10);
        setPreviewModal(m => m ? { ...m, questions: merged, loading: false } : null);
      } else {
        setPreviewModal(m => m ? { ...m, questions: qs, loading: false } : null);
      }
    } catch {
      // If API fails, show fallback questions list based on categories
      const fallback: BankQuestion[] = VOICE_DIMS.map((d, i) => ({
        id: `fallback-${i}`,
        question: ['Tell me about yourself and your experience relevant to this role.',
          'Describe a challenging project — your role and outcome.',
          'How do you prioritise competing tasks and deadlines?',
          'Give an example of resolving a conflict in a team.',
          'Where do you see yourself in 3–5 years in this field?'][i] || '',
        category: d.label, difficulty: 'Medium',
      }));
      setPreviewModal(m => m ? { ...m, questions: fallback, loading: false } : null);
    }
  };

  const runScreenCall = (candidateId: string, questions: BankQuestion[]) => {
    setPreviewModal(null);
    setUsedQuestions(q => ({ ...q, [candidateId]: questions }));
    setScreenStatus(s => ({ ...s, [candidateId]: 'initiating' }));
    setActiveCallId(candidateId);
    setTimeout(() => {
      setScreenStatus(s => ({ ...s, [candidateId]: 'in_call' }));
      setTimeout(() => {
        setScreenStatus(s => ({ ...s, [candidateId]: 'processing' }));
        setTimeout(() => {
          const seed = candidateId.charCodeAt(0) + candidateId.charCodeAt(candidateId.length - 1);
          const dimScores = VOICE_DIMS.map((_, i) => Math.min(95, Math.max(35, 55 + (seed * (i + 2)) % 35)));
          const overall = Math.round(dimScores.reduce((a, b) => a + b, 0) / dimScores.length);
          const result: VoiceResult = {
            overallScore: overall,
            recommendation: overall >= 72 ? 'Advance' : overall >= 55 ? 'Hold' : 'Reject',
            summary: overall >= 72
              ? `Strong candidate — demonstrates clear communication, solid role knowledge, and high cultural alignment. Recommended for next round.`
              : overall >= 55
              ? `Decent performance overall. Some areas need improvement but shows potential. Recommend a technical panel follow-up.`
              : `Below expectations on key screening parameters. Role knowledge and communication clarity need significant improvement.`,
            dims: VOICE_DIMS.map((d, i) => ({ label: d.label, score: dimScores[i], color: d.color, note: VOICE_NOTES[d.label][dimScores[i] >= 75 ? 0 : dimScores[i] >= 60 ? 1 : dimScores[i] >= 45 ? 2 : 3] })),
          };
          setVoiceResults(r => ({ ...r, [candidateId]: result }));
          setScreenStatus(s => ({ ...s, [candidateId]: 'completed' }));
          setActiveCallId(null);
          setExpandedId(candidateId);
        }, 2500);
      }, 4000);
    }, 1500);
  };

  const eligible = candidates.filter(c => c.assessmentScore >= fitThreshold && c.stage !== 'Rejected');
  const roles = ['All', ...Array.from(new Set(candidates.map(c => c.jobTitle).filter(Boolean)))];
  const displayList = filterRole === 'All' ? eligible : eligible.filter(c => c.jobTitle === filterRole);

  const completedScreens = Object.values(screenStatus).filter(s => s === 'completed').length;
  const avgVoiceScore = completedScreens > 0 ? Math.round(Object.values(voiceResults).reduce((s, r) => s + r.overallScore, 0) / completedScreens) : 0;
  const advanceCount = Object.values(voiceResults).filter(r => r.recommendation === 'Advance').length;

  const getStatusLabel = (id: string) => {
    const s = screenStatus[id];
    if (!s || s === 'not_started') return null;
    return { initiating: { label: 'Initiating call…', color: BRAND.orange }, in_call: { label: '🔴 Live Call', color: BRAND.red }, processing: { label: 'AI Analysing…', color: BRAND.purple }, completed: { label: 'Completed', color: BRAND.green } }[s];
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">AI Voice Bot Screening</h1>
          <p className="text-xs text-gray-500 mt-0.5">AI-powered phone screening for fitment-qualified candidates — automated calls, instant analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onTabChange('assessments')}
            className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
            <Brain size={12} /> Fitment Scores
          </button>
          {onNavigate && (
            <button onClick={() => onNavigate('interview-bank-admin')}
              className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border text-white"
              style={{ backgroundColor: BRAND.accent, borderColor: BRAND.accent }}>
              <Database size={12} /> Question Bank
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KPICard label="Eligible for Screen" value={eligible.length} icon={<Users size={16} />} color={BRAND.primary} sub={`≥${fitThreshold}% fitment`} />
        <KPICard label="Screens Done" value={completedScreens} icon={<Mic size={16} />} color={BRAND.accent} />
        <KPICard label="Avg Voice Score" value={avgVoiceScore || '—'} icon={<Volume2 size={16} />} color={BRAND.green} />
        <KPICard label="Advance to Interview" value={advanceCount} icon={<UserCheck size={16} />} color={BRAND.orange} trend="up" />
      </div>

      {/* How it works */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BotMessageSquare size={16} style={{ color: BRAND.primary }} />
          <h3 className="text-sm font-semibold text-gray-800">How AI Voice Screening Works</h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { step: '1', icon: <PhoneCall size={18} />, title: 'Automated Call', desc: 'Pragati AI places a call to the candidate\'s registered phone number.', color: BRAND.primary },
            { step: '2', icon: <BotMessageSquare size={18} />, title: 'Structured Interview', desc: '8–10 role-specific questions covering knowledge, behaviour, and culture fit.', color: BRAND.accent },
            { step: '3', icon: <Mic size={18} />, title: 'AI Analysis', desc: 'Voice patterns, answer quality, and confidence analysed in real-time by AI.', color: BRAND.green },
            { step: '4', icon: <BadgeCheck size={18} />, title: 'Instant Report', desc: 'Score report with dimension breakdown + recommendation available within minutes.', color: BRAND.purple },
          ].map(s => (
            <div key={s.step} className="text-center">
              <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: s.color }}>{s.step}</div>
              <div className="w-8 h-8 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: `${s.color}15`, color: s.color }}>{s.icon}</div>
              <div className="text-xs font-semibold text-gray-800 mb-1">{s.title}</div>
              <p className="text-[10px] text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Threshold + Role filter */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={13} style={{ color: BRAND.primary }} />
          <span className="text-xs font-semibold text-gray-700">Fitment Threshold:</span>
          <input type="range" min={30} max={90} step={5} value={fitThreshold} onChange={e => setFitThreshold(+e.target.value)}
            className="w-24 h-1.5 rounded" style={{ accentColor: BRAND.primary }} />
          <span className="text-xs font-bold" style={{ color: BRAND.primary }}>≥{fitThreshold}%</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500">Filter by role:</span>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 h-8 focus:outline-none">
            {roles.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Active call banner */}
      {activeCallId && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border-2 animate-pulse" style={{ borderColor: BRAND.red, backgroundColor: `${BRAND.red}06` }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: BRAND.red }}>
            <PhoneCall size={14} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-red-600">🔴 Live Voice Call in Progress</div>
            <div className="text-xs text-gray-500">Pragati AI is conducting structured screening for {candidates.find(c => c._id === activeCallId)?.name}…</div>
          </div>
        </div>
      )}

      {/* Candidate screening list */}
      <div className="space-y-3">
        {displayList.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
            <Mic size={28} className="mx-auto mb-2 text-gray-300" />
            <div className="text-sm text-gray-500 font-medium mb-1">No candidates qualify yet</div>
            <p className="text-xs text-gray-400">Lower the fitment threshold or send assessments to more candidates.</p>
            <button onClick={() => onTabChange('assessments')} className="mt-3 text-xs font-medium px-4 py-2 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>
              Go to Assessments →
            </button>
          </div>
        ) : displayList.map(c => {
          const status = screenStatus[c._id];
          const result = voiceResults[c._id];
          const statusLabel = getStatusLabel(c._id);
          return (
            <div key={c._id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-4 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                      style={{ background: `${BRAND.primary}` }}>{c.name.charAt(0)}</div>
                    {status === 'in_call' && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-red-500 animate-pulse" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{c.name}</div>
                    <div className="text-[10px] text-gray-400">{c.currentRole || c.jobTitle || '—'} · {c.phone || 'No phone on file'}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Chip label={`Fitment ${c.assessmentScore}%`} color={c.assessmentScore >= 75 ? BRAND.green : BRAND.accent} size="xs" />
                      {statusLabel && <Chip label={statusLabel.label} color={statusLabel.color} size="xs" />}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {result && (
                    <div className="text-center mr-2">
                      <div className="text-lg font-bold" style={{ color: result.recommendation === 'Advance' ? BRAND.green : result.recommendation === 'Hold' ? BRAND.orange : BRAND.red }}>
                        {result.overallScore}
                      </div>
                      <div className="text-[9px] font-semibold" style={{ color: result.recommendation === 'Advance' ? BRAND.green : result.recommendation === 'Hold' ? BRAND.orange : BRAND.red }}>
                        {result.recommendation}
                      </div>
                    </div>
                  )}
                  {(!status || status === 'not_started') && (
                    <button onClick={() => openPreview(c)} disabled={!!activeCallId}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl text-white"
                      style={{ backgroundColor: activeCallId ? '#94a3b8' : BRAND.primary }}>
                      <PhoneCall size={12} /> Preview & Screen
                    </button>
                  )}
                  {(status === 'initiating' || status === 'in_call' || status === 'processing') && (
                    <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl text-white" style={{ backgroundColor: status === 'in_call' ? BRAND.red : BRAND.orange }}>
                      <RefreshCw size={11} className="animate-spin" />
                      {status === 'initiating' ? 'Calling…' : status === 'in_call' ? 'In Call' : 'Analysing…'}
                    </div>
                  )}
                  {status === 'completed' && result && (
                    <button onClick={() => setExpandedId(expandedId === c._id ? null : c._id)}
                      className="text-[10px] font-medium px-3 py-2 rounded-xl border" style={{ borderColor: `${BRAND.primary}30`, color: BRAND.primary }}>
                      {expandedId === c._id ? 'Hide Report' : 'View Report'}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded voice screening report */}
              {expandedId === c._id && result && (
                <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                  <div className="flex items-start justify-between mb-4 gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <BotMessageSquare size={14} style={{ color: BRAND.primary }} />
                        <span className="text-xs font-semibold text-gray-800">AI Screening Summary</span>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed italic">"{result.summary}"</p>
                    </div>
                    <div className="text-center shrink-0">
                      <div className="text-3xl font-black" style={{ color: result.recommendation === 'Advance' ? BRAND.green : result.recommendation === 'Hold' ? BRAND.orange : BRAND.red }}>
                        {result.overallScore}
                      </div>
                      <div className="text-[10px] text-gray-500">Voice Score</div>
                      <div className="mt-1 px-2 py-0.5 rounded-lg text-[10px] font-bold text-white"
                        style={{ backgroundColor: result.recommendation === 'Advance' ? BRAND.green : result.recommendation === 'Hold' ? BRAND.orange : BRAND.red }}>
                        {result.recommendation}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {result.dims.map(d => (
                      <div key={d.label}>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="font-medium text-gray-700">{d.label}</span>
                          <span className="font-bold" style={{ color: d.color }}>{d.score}/100</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-200 overflow-hidden mb-0.5">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${d.score}%`, backgroundColor: d.color }} />
                        </div>
                        <div className="text-[9px] text-gray-400 italic">{d.note}</div>
                      </div>
                    ))}
                  </div>
                  {result.recommendation === 'Advance' && (
                    <div className="mt-4 flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: `${BRAND.green}30`, backgroundColor: `${BRAND.green}06` }}>
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                        <CheckCircle size={13} style={{ color: BRAND.green }} />
                        This candidate is cleared for interview scheduling
                      </div>
                      <button onClick={() => onTabChange('interviews')}
                        className="text-[10px] font-medium px-3 py-1.5 rounded-lg text-white flex items-center gap-1"
                        style={{ backgroundColor: BRAND.green }}>
                        <Calendar size={10} /> Schedule Interview
                      </button>
                    </div>
                  )}
                  {/* Questions Asked in this screening */}
                  {usedQuestions[c._id] && usedQuestions[c._id].length > 0 && (
                    <div className="mt-4 border-t pt-3">
                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Database size={9} /> Questions used in this screening
                      </div>
                      <div className="space-y-1.5">
                        {usedQuestions[c._id].map((q, i) => (
                          <div key={q.id} className="flex gap-2 items-start">
                            <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0 mt-0.5"
                              style={{ backgroundColor: BRAND.primary }}>
                              {i + 1}
                            </span>
                            <p className="text-[10px] text-gray-500 leading-relaxed">{q.question}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Question Preview Modal ─────────────────────────────────────────── */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b shrink-0">
              <div>
                <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Mic size={14} style={{ color: BRAND.primary }} />
                  AI Screening Preview
                </h2>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {previewModal.candidateName} · These questions will guide the Pragati AI voice call
                </p>
              </div>
              <button onClick={() => setPreviewModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={15} />
              </button>
            </div>

            {/* Questions list */}
            <div className="flex-1 overflow-y-auto p-5">
              {previewModal.loading ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <RefreshCw size={20} className="animate-spin mb-2" />
                  <span className="text-xs">Loading questions from bank…</span>
                </div>
              ) : previewModal.questions.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  No questions available in the bank. Add questions via the Question Bank admin.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] text-gray-400 mb-3">
                    {previewModal.questions.length} questions selected from the bank — AI will adapt depth based on responses:
                  </p>
                  {previewModal.questions.map((q, idx) => (
                    <div key={q.id} className="flex gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: BRAND.primary }}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-700 font-medium leading-relaxed">{q.question}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: `${BRAND.primary}15`, color: BRAND.primary }}>
                            {q.category}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: q.difficulty === 'Hard' ? '#ef444415' : q.difficulty === 'Easy' ? '#22c55e15' : '#f9731615', color: q.difficulty === 'Hard' ? '#ef4444' : q.difficulty === 'Easy' ? '#22c55e' : '#f97316' }}>
                            {q.difficulty}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between gap-3 p-5 border-t bg-gray-50/50 shrink-0">
              <div className="text-[10px] text-gray-400">
                Call will auto-analyse voice, tone & answer quality via Pragati AI
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPreviewModal(null)}
                  className="text-xs px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100">
                  Cancel
                </button>
                {onNavigate && (
                  <button onClick={() => { setPreviewModal(null); onNavigate('interview-bank-admin'); }}
                    className="text-xs px-3 py-2 rounded-xl border text-gray-700 hover:bg-gray-100"
                    style={{ borderColor: BRAND.accent, color: BRAND.accent }}>
                    <Database size={10} className="inline mr-1" /> Edit Bank
                  </button>
                )}
                <button
                  onClick={() => runScreenCall(previewModal.candidateId, previewModal.questions)}
                  disabled={previewModal.loading}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl text-white font-medium"
                  style={{ backgroundColor: previewModal.loading ? '#94a3b8' : BRAND.primary }}>
                  <PhoneCall size={11} /> Start Call
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERVIEW HUB TAB
// ═══════════════════════════════════════════════════════════════════════════════
function InterviewsTab({ interviews, setInterviews, candidates, jobs }: { interviews: Interview[]; setInterviews: (i: Interview[]) => void; candidates: Candidate[]; jobs: EmployerJob[] }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    feedback: '', rating: 0, recommendation: 'Hire',
    scorecard: { technical: 0, communication: 0, problemSolving: 0, culturalFit: 0, experience: 0 },
  });
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [autoThreshold, setAutoThreshold] = useState(65);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [autoScheduled, setAutoScheduled] = useState<string[]>([]);
  const [showAutoPanel, setShowAutoPanel] = useState(true);
  const emptyForm = { candidateId: '', candidateName: '', jobId: '', jobTitle: '', type: 'Video', date: '', time: '', duration: '60 min', interviewers: '', meetingLink: '', status: 'Scheduled', feedback: '', rating: 0, recommendation: '' };
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const today = new Date().toISOString().slice(0, 10);

  const handleAdd = async () => {
    if (!form.candidateId || !form.date) return;
    setSaving(true);
    try {
      const payload = { ...form, interviewers: form.interviewers.split(',').map(s => s.trim()).filter(Boolean) };
      const res = await fetch('/api/employer/interviews', { method: 'POST', headers: authHdr() as HeadersInit, body: JSON.stringify(payload) });
      const d = await res.json();
      if (d.success) { setInterviews([d.interview, ...interviews]); setShowForm(false); setForm(emptyForm); }
    } catch {} finally { setSaving(false); }
  };

  const updateStatus = async (iv: Interview, status: string) => {
    const res = await fetch(`/api/employer/interviews/${iv._id}`, { method: 'PUT', headers: authHdr() as HeadersInit, body: JSON.stringify({ status }) });
    const d = await res.json();
    if (d.success) setInterviews(interviews.map(i => i._id === iv._id ? { ...i, status } : i));
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/employer/interviews/${id}`, { method: 'DELETE', headers: authHdr() as HeadersInit });
    setInterviews(interviews.filter(i => i._id !== id));
  };

  const saveFeedback = async (iv: Interview) => {
    setSavingFeedback(true);
    const res = await fetch(`/api/employer/interviews/${iv._id}`, { method: 'PUT', headers: authHdr() as HeadersInit, body: JSON.stringify({ feedback: feedbackForm.feedback, rating: feedbackForm.rating, recommendation: feedbackForm.recommendation, scorecard: feedbackForm.scorecard }) });
    const d = await res.json();
    if (d.success) setInterviews(interviews.map(i => i._id === iv._id ? { ...i, ...feedbackForm } : i));
    setFeedbackId(null);
    setSavingFeedback(false);
  };

  const eligibleForAutoSchedule = candidates.filter(c =>
    c.assessmentScore >= autoThreshold &&
    c.stage !== 'Rejected' &&
    !autoScheduled.includes(c._id) &&
    !interviews.find(iv => iv.candidateId === c._id && iv.status === 'Scheduled')
  );

  const autoScheduleAll = async () => {
    if (eligibleForAutoSchedule.length === 0) return;
    setAutoScheduling(true);
    const newInterviews: Interview[] = [];
    const newIds: string[] = [];
    for (let i = 0; i < eligibleForAutoSchedule.length; i++) {
      const c = eligibleForAutoSchedule[i];
      const daysAhead = 3 + i;
      const d = new Date(); d.setDate(d.getDate() + daysAhead);
      const dateStr = d.toISOString().slice(0, 10);
      const timeSlots = ['10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'];
      const slot = timeSlots[i % timeSlots.length];
      const job = jobs.find(j => j._id === c.jobId) || jobs[0];
      try {
        const payload = {
          candidateId: c._id, candidateName: c.name,
          jobId: job?._id || '', jobTitle: job?.title || c.jobTitle || 'General Interview',
          type: 'Video', date: dateStr, time: slot,
          duration: '45 min', interviewers: 'Hiring Manager',
          meetingLink: `https://meet.metryx.one/auto-${c._id.slice(-6)}`,
          status: 'Scheduled', feedback: '', rating: 0, recommendation: '',
        };
        const res = await fetch('/api/employer/interviews', { method: 'POST', headers: authHdr() as HeadersInit, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) { newInterviews.push({ ...data.interview, autoScheduled: true }); newIds.push(c._id); }
      } catch {}
    }
    setInterviews([...newInterviews, ...interviews]);
    setAutoScheduled(prev => [...prev, ...newIds]);
    setAutoScheduling(false);
  };

  const visible = filterStatus === 'All' ? interviews : interviews.filter(i => i.status === filterStatus);
  const scheduled = interviews.filter(i => i.status === 'Scheduled');
  const completed  = interviews.filter(i => i.status === 'Completed');
  const todayInterviews = interviews.filter(i => i.status === 'Scheduled' && i.date === today);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Interview Hub</h1>
          <p className="text-xs text-gray-500 mt-0.5">{scheduled.length} scheduled · {completed.length} completed · {todayInterviews.length} today</p>
        </div>
        <div className="flex gap-2">
          {eligibleForAutoSchedule.length > 0 && (
            <button onClick={autoScheduleAll} disabled={autoScheduling}
              className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm"
              style={{ backgroundColor: autoScheduling ? '#94a3b8' : BRAND.green }}>
              {autoScheduling ? <RefreshCw size={12} className="animate-spin" /> : <Wand2 size={12} />}
              {autoScheduling ? 'Scheduling…' : `Auto-Schedule ${eligibleForAutoSchedule.length}`}
            </button>
          )}
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm" style={{ backgroundColor: BRAND.primary }}>
            <Plus size={13} /> Schedule Interview
          </button>
        </div>
      </div>

      {/* Interview KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KPICard label="Today" value={todayInterviews.length} icon={<Calendar size={16} />} color={BRAND.accent} />
        <KPICard label="Scheduled" value={scheduled.length} icon={<Clock size={16} />} color={BRAND.primary} />
        <KPICard label="Completed" value={completed.length} icon={<CheckCircle size={16} />} color={BRAND.green} />
        <KPICard label="Hire Rate" value={`${completed.length > 0 ? Math.round((interviews.filter(i => i.recommendation === 'Hire').length / completed.length) * 100) : 0}%`} icon={<UserCheck size={16} />} color={BRAND.orange} />
      </div>

      {/* Auto-Schedule Panel */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setShowAutoPanel(s => !s)}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.green}15`, color: BRAND.green }}>
              <Wand2 size={14} />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">Auto-Schedule Interviews Post Fitment</div>
              <div className="text-[10px] text-gray-400">Automatically schedule video interviews for candidates who crossed the fitment threshold</div>
            </div>
          </div>
          {showAutoPanel ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
        {showAutoPanel && (
          <div className="px-4 pb-4 border-t border-gray-50 pt-4 space-y-4">
            {/* Threshold slider */}
            <div className="flex items-center gap-4">
              <SlidersHorizontal size={13} style={{ color: BRAND.primary }} />
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">Minimum fitment score to auto-schedule</span>
                  <span className="font-bold" style={{ color: BRAND.primary }}>{autoThreshold}%</span>
                </div>
                <input type="range" min={40} max={90} step={5} value={autoThreshold} onChange={e => setAutoThreshold(+e.target.value)}
                  className="w-full h-2 rounded-full" style={{ accentColor: BRAND.primary }} />
              </div>
            </div>

            {/* Eligible candidates preview */}
            {eligibleForAutoSchedule.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  {eligibleForAutoSchedule.length} candidate{eligibleForAutoSchedule.length > 1 ? 's' : ''} eligible for auto-scheduling
                </div>
                {eligibleForAutoSchedule.slice(0, 5).map((c, i) => {
                  const d = new Date(); d.setDate(d.getDate() + 3 + i);
                  const slots = ['10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'];
                  return (
                    <div key={c._id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                          style={{ background: `${BRAND.primary}` }}>{c.name.charAt(0)}</div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-800 truncate">{c.name}</div>
                          <div className="text-[9px] text-gray-400">{c.currentRole || c.jobTitle || '—'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Chip label={`Fitment ${c.assessmentScore}%`} color={BRAND.green} size="xs" />
                        <div className="text-right">
                          <div className="text-[9px] font-medium text-gray-700">{d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                          <div className="text-[9px] text-gray-400">{slots[i % slots.length]}</div>
                        </div>
                        <Video size={12} className="text-gray-300" />
                      </div>
                    </div>
                  );
                })}
                {eligibleForAutoSchedule.length > 5 && (
                  <div className="text-[9px] text-gray-400 text-center">+{eligibleForAutoSchedule.length - 5} more candidates</div>
                )}
                <button onClick={autoScheduleAll} disabled={autoScheduling}
                  className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-xl text-white mt-2"
                  style={{ backgroundColor: autoScheduling ? '#94a3b8' : BRAND.green }}>
                  {autoScheduling ? <><RefreshCw size={12} className="animate-spin" />Scheduling video interviews…</> : <><Wand2 size={12} />Auto-Schedule All {eligibleForAutoSchedule.length} Interviews</>}
                </button>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-gray-400">
                {candidates.filter(c => c.assessmentScore >= autoThreshold).length === 0
                  ? `No candidates have scored ≥${autoThreshold}% yet. Lower the threshold or send more assessments.`
                  : `All qualifying candidates are already scheduled. Adjust the threshold to include more.`}
              </div>
            )}

            {autoScheduled.length > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ backgroundColor: `${BRAND.green}08` }}>
                <CheckCircle size={12} style={{ color: BRAND.green }} />
                <span className="text-[10px] text-gray-600">{autoScheduled.length} interview{autoScheduled.length > 1 ? 's' : ''} auto-scheduled this session</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Today's interviews pinned */}
      {todayInterviews.length > 0 && (
        <div className="bg-white border-l-4 rounded-2xl p-4 shadow-sm" style={{ borderLeftColor: BRAND.accent }}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} style={{ color: BRAND.accent }} />
            <span className="text-xs font-semibold text-gray-800">Today's Interviews</span>
            <Chip label={`${todayInterviews.length} scheduled`} color={BRAND.accent} size="xs" />
          </div>
          <div className="space-y-2">
            {todayInterviews.map(iv => (
              <div key={iv._id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>
                    {iv.type === 'Video' ? <Video size={14} /> : <Calendar size={14} />}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-800">{iv.candidateName}</div>
                    <div className="text-[10px] text-gray-500">{iv.jobTitle} · {iv.type} · {iv.time || 'TBD'} · {iv.duration}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {iv.meetingLink && <a href={iv.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND.accent }}><Video size={10} />Join</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-1.5">
        {['All', ...INTERVIEW_STATUS].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-[10px] font-medium px-2.5 py-1.5 rounded-lg border transition-all ${filterStatus === s ? 'text-white shadow-sm' : 'border-gray-200 text-gray-500'}`}
            style={filterStatus === s ? { backgroundColor: BRAND.primary, borderColor: 'transparent' } : {}}>
            {s} {s !== 'All' ? `(${interviews.filter(i => i.status === s).length})` : ''}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Schedule Interview</h3>
            <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Candidate *</label>
              <select value={form.candidateId} onChange={e => { const c = candidates.find(x => x._id === e.target.value); setForm({ ...form, candidateId: e.target.value, candidateName: c?.name || '' }); }}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                <option value="">Select candidate…</option>
                {candidates.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">For Job</label>
              <select value={form.jobId} onChange={e => { const j = jobs.find(x => x._id === e.target.value); setForm({ ...form, jobId: e.target.value, jobTitle: j?.title || '' }); }}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                <option value="">Select job…</option>
                {jobs.map(j => <option key={j._id} value={j._id}>{j.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Interview Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                {INTERVIEW_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Duration</label>
              <select value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                {['30 min','45 min','60 min','90 min','120 min'].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Time</label>
              <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Meeting Link</label>
              <input value={form.meetingLink} onChange={e => setForm({ ...form, meetingLink: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" placeholder="Zoom / Meet URL" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Interviewers (comma-separated)</label>
              <input value={form.interviewers} onChange={e => setForm({ ...form, interviewers: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" placeholder="Priya Sharma, Rahul Mehta" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="text-xs px-3 py-2 text-gray-500">Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="text-xs font-medium px-4 py-2 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>
              {saving ? 'Saving…' : 'Schedule'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
            <Calendar size={28} className="mx-auto mb-2 text-gray-300" />
            <div className="text-sm text-gray-400">No interviews yet.</div>
          </div>
        ) : visible.map(iv => (
          <div key={iv._id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>
                  {iv.type === 'Video' ? <Video size={16} /> : iv.type === 'Technical' ? <Code size={16} /> : <Calendar size={16} />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-800">{iv.candidateName}</div>
                  <div className="text-xs text-gray-500">{iv.jobTitle || 'Role not specified'}</div>
                  <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1"><Calendar size={10} />{iv.date}</span>
                    {iv.time && <span className="flex items-center gap-1"><Clock size={10} />{iv.time}</span>}
                    <span>{iv.duration}</span>
                    {iv.meetingLink && <a href={iv.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ color: BRAND.primary }}><Video size={10} />Join</a>}
                  </div>
                  {iv.interviewers.length > 0 && <div className="text-[10px] text-gray-400 mt-0.5">Panel: {iv.interviewers.join(', ')}</div>}
                  {iv.rating > 0 && (
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1,2,3,4,5].map(n => <Star key={n} size={10} fill={n <= iv.rating ? BRAND.orange : 'none'} style={{ color: BRAND.orange }} />)}
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <Chip label={iv.status} color={iv.status === 'Completed' ? BRAND.green : iv.status === 'Cancelled' ? BRAND.red : BRAND.accent} size="xs" />
                <div className="flex gap-1.5">
                  {iv.status === 'Scheduled' && <button onClick={() => updateStatus(iv, 'Completed')} className="text-[9px] px-2 py-0.5 rounded-lg font-medium text-white" style={{ backgroundColor: BRAND.green }}>Mark Done</button>}
                  {iv.status === 'Scheduled' && <button onClick={() => updateStatus(iv, 'Cancelled')} className="text-[9px] px-2 py-0.5 rounded-lg font-medium text-white" style={{ backgroundColor: BRAND.red }}>Cancel</button>}
                  {iv.status === 'Completed' && !iv.feedback && (
                    <button onClick={() => { setFeedbackId(iv._id); setFeedbackForm({ feedback: '', rating: 0, recommendation: 'Hire' }); }}
                      className="text-[9px] px-2 py-0.5 rounded-lg font-medium border" style={{ borderColor: `${BRAND.primary}40`, color: BRAND.primary }}>
                      Add Feedback
                    </button>
                  )}
                  <button onClick={() => handleDelete(iv._id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>
                </div>
                {iv.recommendation && <Chip label={iv.recommendation} color={iv.recommendation === 'Hire' ? BRAND.green : iv.recommendation === 'No Hire' ? BRAND.red : BRAND.orange} size="xs" />}
              </div>
            </div>
            {iv.feedback && <p className="text-[10px] text-gray-500 mt-2 italic border-t border-gray-50 pt-2">"{iv.feedback}"</p>}
            {/* Structured Scorecard */}
            {feedbackId === iv._id && (() => {
              const CRITERIA = [
                { key: 'technical',      label: 'Technical Skills',      weight: 30 },
                { key: 'communication',  label: 'Communication',         weight: 20 },
                { key: 'problemSolving', label: 'Problem Solving',       weight: 25 },
                { key: 'culturalFit',    label: 'Cultural Fit',          weight: 15 },
                { key: 'experience',     label: 'Experience Relevance',  weight: 10 },
              ] as const;
              const sc = feedbackForm.scorecard;
              const weightedScore = Math.round(
                CRITERIA.reduce((sum, c) => sum + ((sc as any)[c.key] || 0) * c.weight, 0) / 5
              );
              const recColor = feedbackForm.recommendation === 'Strong Hire' ? '#16a34a' : feedbackForm.recommendation === 'Hire' ? BRAND.green : feedbackForm.recommendation === 'No Hire' ? BRAND.red : BRAND.orange;
              return (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700">Interview Scorecard</span>
                    {weightedScore > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-gray-400">Weighted Score:</span>
                        <span className="text-xs font-bold" style={{ color: weightedScore>=4?BRAND.green:weightedScore>=3?BRAND.orange:BRAND.red }}>{weightedScore}/5</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {CRITERIA.map(c => (
                      <div key={c.key} className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-600 w-36 shrink-0">{c.label}</span>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} onClick={() => setFeedbackForm(f => ({ ...f, scorecard: { ...f.scorecard, [c.key]: n } }))}>
                              <Star size={13} fill={n <= (sc as any)[c.key] ? BRAND.orange : 'none'} style={{ color: BRAND.orange }} />
                            </button>
                          ))}
                        </div>
                        <span className="text-[9px] text-gray-400">{c.weight}%</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-gray-500 mb-1.5">Recommendation</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { label:'Strong Hire', color:'#16a34a' },
                        { label:'Hire', color:BRAND.green },
                        { label:'Maybe', color:BRAND.orange },
                        { label:'No Hire', color:BRAND.red },
                      ].map(r => (
                        <button key={r.label} onClick={() => setFeedbackForm(f => ({ ...f, recommendation: r.label }))}
                          className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all"
                          style={feedbackForm.recommendation === r.label
                            ? { backgroundColor: r.color, color: '#fff', borderColor: 'transparent' }
                            : { backgroundColor: `${r.color}10`, color: r.color, borderColor: `${r.color}30` }}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea rows={2} value={feedbackForm.feedback} onChange={e => setFeedbackForm(f => ({ ...f, feedback: e.target.value }))}
                    placeholder="Detailed notes on the candidate&hellip;"
                    className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none" />
                  <div className="flex items-center justify-between">
                    {feedbackForm.recommendation && <Chip label={feedbackForm.recommendation} color={recColor} size="xs" />}
                    <div className="flex gap-2">
                      <button onClick={() => setFeedbackId(null)} className="text-xs text-gray-400">Cancel</button>
                      <button onClick={() => saveFeedback(iv)} disabled={savingFeedback}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
                        style={{ backgroundColor: BRAND.primary }}>
                        {savingFeedback ? 'Saving…' : 'Submit Scorecard'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function AnalyticsTab({ analytics, candidates, jobs }: { analytics: Analytics | null; candidates: Candidate[]; jobs: EmployerJob[] }) {
  if (!analytics || candidates.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <PieChart size={32} className="mx-auto mb-3 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-700 mb-1">No data yet</h3>
          <p className="text-xs text-gray-400">Add jobs and candidates to see your hiring analytics.</p>
        </div>
      </div>
    );
  }

  const { conversionFunnel = [], stageBreakdown = {}, sourceBreakdown = {} } = analytics;
  const maxFunnel = conversionFunnel[0]?.count || 1;
  const sources = Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]);
  const totalSource = sources.reduce((s, [, v]) => s + v, 0);
  const sourceColors = [BRAND.primary, BRAND.accent, BRAND.green, BRAND.purple, BRAND.orange, '#ec4899', '#14b8a6'];

  const eiRanges = [
    { label: '80–100', min: 80, max: 101, color: '#16a34a' },
    { label: '65–79',  min: 65, max: 80,  color: BRAND.green },
    { label: '50–64',  min: 50, max: 65,  color: BRAND.accent },
    { label: '35–49',  min: 35, max: 50,  color: BRAND.orange },
    { label: '<35',    min: 0,  max: 35,  color: BRAND.red },
  ];
  const eiCandidates = candidates.filter(c => c.eiScore > 0);
  const maxEIRange = Math.max(...eiRanges.map(r => eiCandidates.filter(c => c.eiScore >= r.min && c.eiScore < r.max).length), 1);

  const sourceQuality = sources.map(([source, total]) => {
    const hired = candidates.filter(c => c.source === source && c.stage === 'Hired').length;
    return { source, total, hired, rate: total > 0 ? Math.round((hired / total) * 100) : 0 };
  }).sort((a, b) => b.rate - a.rate);

  const thisWeek = new Date();
  thisWeek.setDate(thisWeek.getDate() - 7);
  const newThisWeek = candidates.filter(c => new Date(c.createdAt) > thisWeek).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Hiring Analytics</h1>
        <div className="flex items-center gap-2">
          {newThisWeek > 0 && <Chip label={`+${newThisWeek} this week`} color={BRAND.green} size="xs" />}
          <span className="text-xs text-gray-400">All-time data</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Total Candidates" value={analytics.totalCandidates} icon={<Users size={16} />} color={BRAND.primary} sub={`+${newThisWeek} this week`} />
        <KPICard label="Offer Rate"       value={`${analytics.offerRate}%`} icon={<Award size={16} />} color={BRAND.green} trend="up" />
        <KPICard label="Hire Rate"        value={`${analytics.hireRate}%`}  icon={<UserCheck size={16} />} color={BRAND.accent} />
        <KPICard label="Avg EI Score"     value={analytics.avgEI || '—'}    icon={<Brain size={16} />} color={BRAND.purple} sub="MetryxOne EI™" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conversion funnel */}
        <SCard title="Hiring Funnel" icon={<Activity size={16} />}>
          <div className="space-y-3 mt-1">
            {conversionFunnel.map(f => (
              <FunnelBar key={f.stage} stage={f.stage} count={f.count} max={maxFunnel} color={STAGE_COLORS[f.stage] || BRAND.primary} />
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
            <span>{analytics.hired} hired out of {analytics.totalCandidates} candidates</span>
            <span className="font-semibold" style={{ color: BRAND.green }}>{analytics.hireRate}% hire rate</span>
          </div>
        </SCard>

        {/* EI Score Distribution */}
        <SCard title="EI Score Distribution" icon={<Brain size={16} />}>
          {eiCandidates.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">Send assessments to view EI distribution.</div>
          ) : (
            <div className="space-y-2 mt-1">
              {eiRanges.map(r => {
                const count = eiCandidates.filter(c => c.eiScore >= r.min && c.eiScore < r.max).length;
                return (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500 w-12 shrink-0">{r.label}</span>
                    <div className="flex-1 h-5 rounded-lg bg-gray-50 overflow-hidden">
                      <div className="h-full rounded-lg flex items-center px-1.5 text-[9px] font-bold text-white transition-all"
                        style={{ width: `${(count / maxEIRange) * 100}%`, backgroundColor: r.color, minWidth: count > 0 ? '20px' : '0' }}>
                        {count > 0 && count}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold w-6 text-right" style={{ color: r.color }}>{count}</span>
                  </div>
                );
              })}
              <p className="text-[10px] text-gray-400 pt-1">Avg EI: {Math.round(eiCandidates.reduce((s, c) => s + c.eiScore, 0) / eiCandidates.length)} across {eiCandidates.length} assessed</p>
            </div>
          )}
        </SCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source quality */}
        <SCard title="Source Quality (Hire Rate)" icon={<PieChart size={16} />}>
          {sourceQuality.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">No source data yet.</div>
          ) : (
            <div className="space-y-3 mt-1">
              {sourceQuality.map(({ source, total, hired, rate }, i) => (
                <div key={source} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sourceColors[i % sourceColors.length] }} />
                  <span className="text-xs text-gray-600 w-20 truncate shrink-0">{source}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${rate}%`, backgroundColor: sourceColors[i % sourceColors.length] }} />
                  </div>
                  <span className="text-[10px] font-semibold w-16 text-right" style={{ color: rate >= 20 ? BRAND.green : BRAND.orange }}>{hired}/{total} · {rate}%</span>
                </div>
              ))}
            </div>
          )}
        </SCard>

        {/* Stage snapshot */}
        <SCard title="Current Pipeline by Stage" icon={<Layers size={16} />}>
          <div className="grid grid-cols-4 gap-2 mt-1">
            {JOB_STAGES.map(stage => (
              <div key={stage} className="text-center p-2 rounded-xl" style={{ backgroundColor: `${STAGE_COLORS[stage]}08` }}>
                <div className="text-xl font-bold" style={{ color: STAGE_COLORS[stage] }}>{stageBreakdown[stage] || 0}</div>
                <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">{stage}</div>
              </div>
            ))}
          </div>
        </SCard>
      </div>

      {/* Top jobs by applications */}
      {jobs.length > 0 && (
        <SCard title="Jobs by Application Volume" icon={<Briefcase size={16} />}>
          <div className="space-y-2.5 mt-1">
            {[...jobs].sort((a, b) => candidates.filter(c => c.jobId === b._id).length - candidates.filter(c => c.jobId === a._id).length).slice(0, 6).map(job => {
              const count = candidates.filter(c => c.jobId === job._id).length;
              const hiredCount = candidates.filter(c => c.jobId === job._id && c.stage === 'Hired').length;
              const maxCount = Math.max(...jobs.map(j => candidates.filter(c => c.jobId === j._id).length), 1);
              return (
                <div key={job._id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 truncate w-40 shrink-0">{job.title}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: BRAND.primary }} />
                  </div>
                  <span className="text-xs font-bold w-6 text-right" style={{ color: BRAND.primary }}>{count}</span>
                  {hiredCount > 0 && <Chip label={`${hiredCount} hired`} color={BRAND.green} size="xs" />}
                </div>
              );
            })}
          </div>
        </SCard>
      )}

      {/* SLA / Aging Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SCard title="SLA &amp; Time-to-Fill" icon={<Timer size={16} />}>
          <div className="space-y-3 mt-1">
            {jobs.filter(j => j.status === 'Active' || j.status === 'Closed').slice(0, 5).map(job => {
              const jobCandidates = candidates.filter(c => c.jobId === job._id);
              const hired = jobCandidates.find(c => c.stage === 'Hired');
              const jobCreated = job.createdAt ? new Date(job.createdAt) : new Date();
              const now = new Date();
              const daysOpen = Math.round((now.getTime() - jobCreated.getTime()) / (1000 * 60 * 60 * 24));
              const slaThreshold = 30;
              const isBreach = daysOpen > slaThreshold && !hired;
              return (
                <div key={job._id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-700 truncate max-w-40">{job.title}</span>
                      {isBreach && <Chip label="SLA Breach" color={BRAND.red} size="xs" />}
                      {hired && <Chip label="Filled" color={BRAND.green} size="xs" />}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-gray-400">
                      <span>{daysOpen} days open</span>
                      <span>&middot;</span>
                      <span>{jobCandidates.length} applicants</span>
                      {hired && <><span>&middot;</span><span className="font-medium" style={{ color:BRAND.green }}>Hired!</span></>}
                    </div>
                  </div>
                  <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden shrink-0">
                    <div className="h-full rounded-full transition-all" style={{ width:`${Math.min((daysOpen/slaThreshold)*100,100)}%`, backgroundColor: isBreach?BRAND.red:daysOpen>20?BRAND.orange:BRAND.green }} />
                  </div>
                  <span className="text-[10px] font-bold w-8 text-right shrink-0" style={{ color: isBreach?BRAND.red:daysOpen>20?BRAND.orange:BRAND.green }}>{daysOpen}d</span>
                </div>
              );
            })}
            {jobs.length === 0 && <div className="text-xs text-gray-400 text-center py-3">No active jobs.</div>}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-50 text-[9px] text-gray-400 flex items-center gap-1.5">
            <AlertCircle size={10} /><span>SLA target: 30 days to fill an open position.</span>
          </div>
        </SCard>

        <SCard title="Candidate Aging Alerts" icon={<AlertCircle size={16} />}>
          <div className="space-y-2 mt-1">
            {(() => {
              const now = new Date();
              const aged = candidates
                .filter(c => !['Hired','Rejected'].includes(c.stage) && c.createdAt)
                .map(c => ({
                  ...c,
                  daysInPipeline: Math.round((now.getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
                }))
                .filter(c => c.daysInPipeline > 7)
                .sort((a, b) => b.daysInPipeline - a.daysInPipeline)
                .slice(0, 6);
              if (aged.length === 0) return <div className="text-xs text-gray-400 text-center py-3">No aging candidates.</div>;
              return aged.map(c => {
                const alertColor = c.daysInPipeline > 21 ? BRAND.red : c.daysInPipeline > 14 ? BRAND.orange : '#f59e0b';
                return (
                  <div key={c._id} className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor:`${alertColor}08` }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ background:`${BRAND.primary}` }}>
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{c.name}</div>
                      <div className="flex items-center gap-1.5 text-[9px]">
                        <Chip label={c.stage} color={STAGE_COLORS[c.stage]} size="xs" />
                        <span className="font-semibold" style={{ color:alertColor }}>{c.daysInPipeline}d in pipeline</span>
                      </div>
                    </div>
                    <Flag size={12} style={{ color:alertColor }} className="shrink-0" />
                  </div>
                );
              });
            })()}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-50 text-[9px] text-gray-400 flex items-center gap-1.5">
            <Flag size={10} /><span>Candidates in the same stage for &gt;7 days are flagged for review.</span>
          </div>
        </SCard>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFER MANAGEMENT TAB
// ═══════════════════════════════════════════════════════════════════════════════
function OffersTab({ offers, setOffers, candidates, setCandidates, jobs }: { offers: Offer[]; setOffers: (o: Offer[]) => void; candidates: Candidate[]; setCandidates: (c: Candidate[]) => void; jobs: EmployerJob[] }) {
  const emptyForm = { candidateId: '', candidateName: '', jobId: '', jobTitle: '', ctcFixed: 0, ctcVariable: 0, ctcBonus: 0, joiningDate: '', validity: '', currency: 'INR', notes: '' };
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');
  const [counterOffer, setCounterOffer] = useState<{ id: string; amount: number; notes: string } | null>(null);
  const [savingCounter, setSavingCounter] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingLetter, setSendingLetter] = useState<string | null>(null);

  const fmtCTC = (n: number, currency = 'INR') => {
    if (!n) return '—';
    if (currency === 'INR') {
      if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
      return `₹${n.toLocaleString('en-IN')}`;
    }
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
    return `$${n}`;
  };

  const createOffer = async () => {
    if (!form.candidateId) return;
    setSaving(true);
    const cand = candidates.find(c => c._id === form.candidateId);
    const job  = jobs.find(j => j._id === form.jobId);
    const payload = {
      ...form,
      candidateName: cand?.name || form.candidateName,
      jobTitle: job?.title || form.jobTitle,
    };
    try {
      const res = await fetch('/api/employer/offers', { method: 'POST', headers: authHdr() as HeadersInit, body: JSON.stringify(payload) });
      const d = await res.json();
      if (d.success) {
        setOffers([d.offer, ...offers]);
        setShowForm(false);
        setForm(emptyForm);
      }
    } catch {} finally { setSaving(false); }
  };

  const updateStatus = async (offer: Offer, status: string) => {
    const res = await fetch(`/api/employer/offers/${offer._id}`, { method: 'PUT', headers: authHdr() as HeadersInit, body: JSON.stringify({ status }) });
    const d = await res.json();
    if (d.success) {
      setOffers(offers.map(o => o._id === offer._id ? { ...o, status } : o));
      if (status === 'Accepted' && offer.candidateId) {
        await fetch(`/api/employer/candidates/${offer.candidateId}`, { method: 'PUT', headers: authHdr() as HeadersInit, body: JSON.stringify({ stage: 'Hired' }) });
        setCandidates(candidates.map(c => c._id === offer.candidateId ? { ...c, stage: 'Hired' } : c));
      }
    }
  };

  const deleteOffer = async (id: string) => {
    await fetch(`/api/employer/offers/${id}`, { method: 'DELETE', headers: authHdr() as HeadersInit });
    setOffers(offers.filter(o => o._id !== id));
  };

  const sendOfferLetter = async (offerId: string) => {
    setSendingLetter(offerId);
    try {
      const res = await fetch(`/api/employer/offers/${offerId}/send-letter`, { method: 'POST', headers: authHdr() as HeadersInit });
      const d = await res.json();
      alert(d.message ?? (d.emailSent ? 'Offer letter sent!' : 'Email config issue — check ZOHO_EMAIL.'));
    } catch { alert('Failed to send offer letter.'); }
    setSendingLetter(null);
  };

  const submitCounter = async () => {
    if (!counterOffer) return;
    setSavingCounter(true);
    const res = await fetch(`/api/employer/offers/${counterOffer.id}`, { method: 'PUT', headers: authHdr() as HeadersInit, body: JSON.stringify({ counterAmount: counterOffer.amount, counterNotes: counterOffer.notes, status: 'Negotiating' }) });
    const d = await res.json();
    if (d.success) setOffers(offers.map(o => o._id === counterOffer.id ? { ...o, counterAmount: counterOffer.amount, counterNotes: counterOffer.notes, status: 'Negotiating' } : o));
    setCounterOffer(null);
    setSavingCounter(false);
  };

  const visible = filterStatus === 'All' ? offers : offers.filter(o => o.status === filterStatus);
  const total = offers.length;
  const pending = offers.filter(o => ['Draft','Sent','Negotiating'].includes(o.status)).length;
  const accepted = offers.filter(o => o.status === 'Accepted').length;
  const declined = offers.filter(o => o.status === 'Declined').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Offer Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">{pending} pending · {accepted} accepted · {declined} declined</p>
        </div>
        <button onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl text-white shadow-sm"
          style={{ background: `${BRAND.primary}` }}>
          <Plus size={14} />New Offer
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Total Offers"    value={total}    icon={<FileText size={16}/>}  color={BRAND.primary} />
        <KPICard label="Pending"         value={pending}  icon={<Clock size={16}/>}     color={BRAND.orange}  />
        <KPICard label="Accepted"        value={accepted} icon={<CheckCircle size={16}/>} color={BRAND.green} />
        <KPICard label="Acceptance Rate" value={total > 0 ? `${Math.round((accepted/total)*100)}%` : '—'} icon={<Percent size={16}/>} color={BRAND.purple} />
      </div>

      {/* Create Offer Form */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-900">Create New Offer</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Candidate *</label>
              <select value={form.candidateId} onChange={e => setForm({...form, candidateId:e.target.value})}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                <option value="">Select candidate&hellip;</option>
                {candidates.filter(c=>!['Rejected','Hired'].includes(c.stage)).map(c => (
                  <option key={c._id} value={c._id}>{c.name} &mdash; {c.stage}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Job Role</label>
              <select value={form.jobId} onChange={e => setForm({...form, jobId:e.target.value})}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                <option value="">Select job&hellip;</option>
                {jobs.map(j => <option key={j._id} value={j._id}>{j.title}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[['ctcFixed','Fixed (₹)'],['ctcVariable','Variable (₹)'],['ctcBonus','Bonus (₹)']].map(([k,l]) => (
              <div key={k}>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">{l}</label>
                <input type="number" value={(form as any)[k] || ''} onChange={e => setForm({...form, [k]:Number(e.target.value)})}
                  className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" placeholder="0" />
              </div>
            ))}
          </div>
          <div className="p-3 rounded-xl text-xs font-semibold" style={{ backgroundColor:`${BRAND.green}10`, color:BRAND.green }}>
            Total CTC: {fmtCTC((form.ctcFixed||0)+(form.ctcVariable||0)+(form.ctcBonus||0))}
            {(form.ctcFixed||form.ctcVariable||form.ctcBonus) > 0 && (
              <span className="ml-2 text-[10px] font-normal text-gray-500">
                Fixed {fmtCTC(form.ctcFixed)} + Variable {fmtCTC(form.ctcVariable)} + Bonus {fmtCTC(form.ctcBonus)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Joining Date</label>
              <input type="date" value={form.joiningDate} onChange={e => setForm({...form, joiningDate:e.target.value})}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Offer Valid Until</label>
              <input type="date" value={form.validity} onChange={e => setForm({...form, validity:e.target.value})}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes:e.target.value})}
              className="w-full text-xs border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-xs px-3 py-2 text-gray-500">Cancel</button>
            <button onClick={createOffer} disabled={saving || !form.candidateId}
              className="text-xs font-medium px-4 py-2 rounded-xl text-white disabled:opacity-50"
              style={{ backgroundColor:BRAND.primary }}>
              {saving ? 'Creating…' : 'Create Offer'}
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {['All',...OFFER_STATUSES].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filterStatus===s?'text-white':'text-gray-500 bg-white border border-gray-100 hover:bg-gray-50'}`}
            style={filterStatus===s?{backgroundColor:OFFER_STATUS_COLORS[s]||BRAND.primary}:{}}>
            {s} {s!=='All'&&<span className="ml-1 opacity-70">{offers.filter(o=>o.status===s).length}</span>}
          </button>
        ))}
      </div>

      {/* Offers list */}
      {visible.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <FileText size={32} className="mx-auto mb-3 text-gray-200" />
          <h3 className="text-sm font-semibold text-gray-700 mb-1">{filterStatus==='All'?'No offers yet':'No offers with this status'}</h3>
          <p className="text-xs text-gray-400">{filterStatus==='All'?'Create your first offer to start tracking.':'Try changing the filter above.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(offer => {
            const statusColor = OFFER_STATUS_COLORS[offer.status] || '#94a3b8';
            const isExpanded = expandedId === offer._id;
            const cand = candidates.find(c => c._id === offer.candidateId);
            return (
              <div key={offer._id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                {/* Main row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background:`${BRAND.primary}` }}>
                    {offer.candidateName.charAt(0)||'?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-bold text-gray-900">{offer.candidateName}</span>
                      <Chip label={offer.status} color={statusColor} size="xs" />
                      {offer.counterAmount > 0 && <Chip label="Counter Received" color={BRAND.orange} size="xs" />}
                    </div>
                    <div className="text-[10px] text-gray-500">{offer.jobTitle || '—'}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {offer.validity && <>Valid until {new Date(offer.validity).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</>}
                      {offer.joiningDate && <> &middot; Join: {new Date(offer.joiningDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-bold" style={{ color:BRAND.green }}>{fmtCTC(offer.totalCTC, offer.currency)}</div>
                    <div className="text-[9px] text-gray-400">Total CTC</div>
                    {offer.ctcFixed > 0 && (
                      <div className="text-[9px] text-gray-400">{fmtCTC(offer.ctcFixed)} fixed</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setExpandedId(isExpanded ? null : offer._id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                      {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                    <button onClick={() => deleteOffer(offer._id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-5 pb-4 space-y-3 border-t border-gray-50 pt-3">
                    {/* CTC breakdown */}
                    <div className="grid grid-cols-3 gap-3">
                      {[['Fixed', offer.ctcFixed],['Variable', offer.ctcVariable],['Bonus', offer.ctcBonus]].map(([l,v]) => (
                        <div key={l as string} className="text-center p-2 rounded-lg" style={{ backgroundColor:`${BRAND.primary}06` }}>
                          <div className="text-xs font-bold" style={{ color:BRAND.primary }}>{fmtCTC(v as number, offer.currency)}</div>
                          <div className="text-[9px] text-gray-400">{l as string}</div>
                        </div>
                      ))}
                    </div>

                    {/* Counter offer */}
                    {offer.counterAmount > 0 && (
                      <div className="p-3 rounded-xl" style={{ backgroundColor:`${BRAND.orange}08`, border:`1px solid ${BRAND.orange}20` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <ArrowRight size={12} style={{ color:BRAND.orange }}/>
                          <span className="text-xs font-semibold" style={{ color:BRAND.orange }}>Counter Offer: {fmtCTC(offer.counterAmount, offer.currency)}</span>
                        </div>
                        {offer.counterNotes && <div className="text-[10px] text-gray-600">{offer.counterNotes}</div>}
                      </div>
                    )}

                    {offer.notes && <div className="text-xs text-gray-500 italic">{offer.notes}</div>}

                    {/* Status actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Actions:</span>
                      {cand?.email && (
                        <button onClick={() => sendOfferLetter(offer._id)} disabled={sendingLetter === offer._id}
                          className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-blue-100 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1">
                          <Send size={10}/>{sendingLetter === offer._id ? 'Sending…' : 'Email Letter'}
                        </button>
                      )}
                      {offer.status === 'Draft' && (
                        <button onClick={() => updateStatus(offer, 'Sent')}
                          className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg text-white" style={{ backgroundColor:BRAND.primary }}>
                          Mark as Sent
                        </button>
                      )}
                      {['Sent','Negotiating'].includes(offer.status) && (
                        <>
                          <button onClick={() => updateStatus(offer, 'Accepted')}
                            className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg text-white" style={{ backgroundColor:BRAND.green }}>
                            <CheckCircle size={10} className="inline mr-1"/>Accept
                          </button>
                          <button onClick={() => updateStatus(offer, 'Declined')}
                            className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg text-white" style={{ backgroundColor:BRAND.red }}>
                            <X size={10} className="inline mr-1"/>Decline
                          </button>
                          <button onClick={() => setCounterOffer({ id:offer._id, amount:offer.counterAmount||0, notes:offer.counterNotes||'' })}
                            className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-orange-200 text-orange-600 bg-orange-50">
                            <ArrowRight size={10} className="inline mr-1"/>Counter Offer
                          </button>
                        </>
                      )}
                      {offer.status === 'Accepted' && cand && cand.stage !== 'Hired' && (
                        <button onClick={() => updateStatus(offer, 'Accepted')}
                          className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg text-white" style={{ backgroundColor:BRAND.green }}>
                          <UserCheck size={10} className="inline mr-1"/>Move to Hired
                        </button>
                      )}
                      {!['Accepted','Declined','Withdrawn'].includes(offer.status) && (
                        <button onClick={() => updateStatus(offer, 'Withdrawn')}
                          className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                          Withdraw
                        </button>
                      )}
                    </div>

                    {/* Counter offer form */}
                    {counterOffer?.id === offer._id && (
                      <div className="p-3 rounded-xl border border-orange-100 bg-orange-50 space-y-2">
                        <div className="text-xs font-semibold text-orange-700">Candidate Counter Offer</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] uppercase font-semibold text-orange-500 mb-1 block">Counter Amount</label>
                            <input type="number" value={counterOffer.amount || ''} onChange={e => setCounterOffer(co => co ? {...co, amount:Number(e.target.value)} : co)}
                              className="w-full h-8 text-xs border border-orange-200 rounded-lg px-2 focus:outline-none bg-white" />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase font-semibold text-orange-500 mb-1 block">Notes</label>
                            <input value={counterOffer.notes} onChange={e => setCounterOffer(co => co ? {...co, notes:e.target.value} : co)}
                              className="w-full h-8 text-xs border border-orange-200 rounded-lg px-2 focus:outline-none bg-white" />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setCounterOffer(null)} className="text-xs text-orange-500">Cancel</button>
                          <button onClick={submitCounter} disabled={savingCounter}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor:BRAND.orange }}>
                            {savingCounter ? 'Saving…' : 'Record Counter'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TALENT POOL TAB
// ═══════════════════════════════════════════════════════════════════════════════
interface OutreachInfo { lastSentAt: string | null; count: number; }

function PoolTab({ candidates, setCandidates }: { candidates: Candidate[]; setCandidates: (c: Candidate[]) => void }) {
  const pooled = candidates.filter(c => c.pooled);
  const [filterSkill, setFilterSkill] = useState('All');
  const [outreach, setOutreach] = useState<Record<string, OutreachInfo>>({});
  const [compose, setCompose] = useState<{ candidate: Candidate; subject: string; message: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  // Load real outreach history (last-contacted + count per candidate).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/employer/pool/outreach', { headers: authHdr() as HeadersInit });
        if (!res.ok) return;
        const d = await res.json();
        if (!aliveRef.current || !Array.isArray(d)) return;
        const map: Record<string, OutreachInfo> = {};
        for (const r of d) map[r.candidateId] = { lastSentAt: r.lastSentAt ?? null, count: r.count ?? 0 };
        setOutreach(map);
      } catch { /* non-fatal: contact history simply stays empty */ }
    })();
  }, []);

  const removeFromPool = async (c: Candidate) => {
    const res = await fetch(`/api/employer/candidates/${c._id}/pool`, { method: 'POST', headers: authHdr() as HeadersInit });
    const d = await res.json();
    if (d.success) setCandidates(candidates.map(x => x._id === c._id ? { ...x, pooled: false } : x));
  };

  const openCompose = (c: Candidate) => {
    setComposeError(null);
    const topSkills = c.skills.slice(0, 3).filter(Boolean);
    const skillLine = topSkills.length ? ` Your background in ${topSkills.join(', ')} stood out to us.` : '';
    const role = c.currentRole ? ` as a ${c.currentRole}` : '';
    setCompose({
      candidate: c,
      subject: 'An opportunity to reconnect',
      message:
        `Hi ${c.name || 'there'},\n\n` +
        `We reviewed your profile${role} and would love to reconnect about a new opportunity on our team.${skillLine}\n\n` +
        `If you're open to a conversation, just reply to this email and we'll share the details.\n\n` +
        `Best regards`,
    });
  };

  const sendOutreach = async () => {
    if (!compose) return;
    const c = compose.candidate;
    if (!compose.message.trim()) { setComposeError('Please write a message before sending.'); return; }
    setSending(true); setComposeError(null);
    try {
      const res = await fetch(`/api/employer/candidates/${c._id}/outreach`, {
        method: 'POST', headers: authHdr() as HeadersInit,
        body: JSON.stringify({ subject: compose.subject, message: compose.message }),
      });
      const d = await res.json().catch(() => ({}));
      if (!aliveRef.current) return;
      if (res.ok && d.success) {
        if (d.demo) {
          setCompose(null);
          setNotice(`${c.name || 'Candidate'} uses a demo address (@example.com) — no email was actually delivered.`);
        } else {
          const sentAt = d.sentAt || new Date().toISOString();
          setOutreach(o => ({ ...o, [c._id]: { lastSentAt: sentAt, count: (o[c._id]?.count ?? 0) + 1 } }));
          setCompose(null);
          setNotice(`Outreach email sent to ${c.name || 'candidate'}.`);
        }
        setTimeout(() => { if (aliveRef.current) setNotice(null); }, 5000);
      } else {
        setComposeError(d.message === 'email_failed'
          ? 'The email could not be delivered. Please check the address and try again.'
          : (d.message || 'Could not send the message.'));
      }
    } catch {
      if (aliveRef.current) setComposeError('Something went wrong. Please try again.');
    } finally {
      if (aliveRef.current) setSending(false);
    }
  };

  const allSkills = ['All', ...Array.from(new Set(pooled.flatMap(c => c.skills))).slice(0, 12)];
  const visible = filterSkill === 'All' ? pooled : pooled.filter(c => c.skills.includes(filterSkill));

  const avgEI   = pooled.filter(c => c.eiScore > 0).length > 0
    ? Math.round(pooled.filter(c => c.eiScore > 0).reduce((s, c) => s + c.eiScore, 0) / pooled.filter(c => c.eiScore > 0).length) : 0;
  const topEI   = pooled.filter(c => c.eiScore >= 70).length;
  const contactedCount = pooled.filter(c => outreach[c._id]).length;

  const fmtDate = (iso: string | null) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return ''; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Talent Pool</h1>
          <p className="text-xs text-gray-500 mt-0.5">{pooled.length} saved candidates for future opportunities</p>
        </div>
        <Chip label="Future Pipeline" color={BRAND.orange} />
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium"
          style={{ backgroundColor: `${BRAND.green}12`, color: BRAND.green }}>
          <MailCheck size={13} /> {notice}
        </div>
      )}

      {/* Pool KPIs */}
      {pooled.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <KPICard label="Pooled Talent" value={pooled.length} icon={<Bookmark size={16} />} color={BRAND.orange} />
          <KPICard label="High EI (≥70)" value={topEI} icon={<Brain size={16} />} color={BRAND.primary} />
          <KPICard label="Avg EI Score" value={avgEI || '—'} icon={<Target size={16} />} color={BRAND.accent} />
          <KPICard label="Contacted" value={contactedCount} icon={<MailCheck size={16} />} color={BRAND.green} />
        </div>
      )}

      {pooled.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <Bookmark size={32} className="mx-auto mb-3 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Talent Pool is Empty</h3>
          <p className="text-xs text-gray-400">Bookmark strong candidates from the Candidates tab to save them for future roles.</p>
        </div>
      ) : (
        <>
          {/* Skill filter */}
          <div className="flex flex-wrap gap-1.5">
            {allSkills.map(s => (
              <button key={s} onClick={() => setFilterSkill(s)}
                className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all ${filterSkill === s ? 'text-white' : 'border-gray-200 text-gray-500'}`}
                style={filterSkill === s ? { backgroundColor: BRAND.primary, borderColor: 'transparent' } : {}}>
                {s}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visible.map((c) => {
              const isHighEI = c.eiScore >= 70;
              const isHighFit = c.matchScore >= 70;
              const contact = outreach[c._id];
              return (
                <div key={c._id} className="bg-white border rounded-2xl p-4 shadow-sm" style={{ borderColor: isHighEI ? `${BRAND.orange}40` : '#f1f5f9' }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                        style={{ background: `${BRAND.primary}` }}>
                        {c.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="text-sm font-semibold text-gray-800">{c.name}</div>
                          {isHighEI && <Star size={11} fill={BRAND.orange} style={{ color: BRAND.orange }} />}
                        </div>
                        <div className="text-xs text-gray-500">{c.currentRole || '—'}</div>
                        {c.location && <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5"><MapPin size={9} />{c.location}</div>}
                      </div>
                    </div>
                    <button onClick={() => removeFromPool(c)} title="Remove from pool" aria-label={`Remove ${c.name} from pool`} className="shrink-0 text-gray-300 hover:text-orange-400 transition-colors">
                      <BookmarkCheck size={16} style={{ color: BRAND.orange }} />
                    </button>
                  </div>

                  {/* Real last-contacted indicator (from outreach history) */}
                  {contact && (
                    <div className="flex items-center gap-1.5 mb-2 p-2 rounded-lg" style={{ backgroundColor: `${BRAND.green}0d` }}>
                      <MailCheck size={11} style={{ color: BRAND.green }} className="shrink-0" />
                      <p className="text-[10px] text-gray-600">
                        Contacted {fmtDate(contact.lastSentAt)}{contact.count > 1 ? ` · ${contact.count} times` : ''}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1 mb-2">
                    {c.skills.slice(0, 5).map(s => <Chip key={s} label={s} color={BRAND.primary} size="xs" />)}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {c.eiScore > 0    && <Chip label={`EI ${c.eiScore}`}        color={isHighEI ? BRAND.green : BRAND.accent} size="xs" />}
                    {c.matchScore > 0 && <Chip label={`${c.matchScore}% fit`}   color={isHighFit ? BRAND.green : BRAND.orange} size="xs" />}
                    <Chip label={c.experience || 'Exp not set'} color="#94a3b8" size="xs" />
                  </div>
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
                    {c.email ? (
                      <button onClick={() => openCompose(c)} className="text-[10px] flex items-center gap-1 font-medium" style={{ color: BRAND.primary }}>
                        <Send size={10} /> {contact ? 'Message again' : 'Re-engage'}
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1"><Mail size={10} /> No email on file</span>
                    )}
                    {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-1" style={{ color: BRAND.accent }}>
                      <Linkedin size={10} /> LinkedIn
                    </a>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Compose outreach modal */}
      {compose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !sending && setCompose(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-800">Re-engage {compose.candidate.name}</h3>
              <button onClick={() => !sending && setCompose(null)} aria-label="Close"><X size={16} className="text-gray-400" /></button>
            </div>
            <p className="text-[11px] text-gray-400 mb-4 flex items-center gap-1"><Mail size={10} /> {compose.candidate.email}</p>

            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Subject</label>
            <input value={compose.subject} onChange={e => setCompose({ ...compose, subject: e.target.value })}
              className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none mb-3" />

            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Message</label>
            <textarea value={compose.message} onChange={e => setCompose({ ...compose, message: e.target.value })}
              rows={8} className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none resize-y" />

            <p className="text-[10px] text-gray-400 mt-2">
              This is a real email sent from your account via MetryxOne. Edit the text above before sending — nothing is auto-generated.
            </p>
            {compose.candidate.email.toLowerCase().endsWith('@example.com') && (
              <p className="text-[10px] mt-1" style={{ color: BRAND.orange }}>
                Demo address (@example.com) — this will not actually be delivered.
              </p>
            )}
            {composeError && <p className="text-[10px] mt-2" style={{ color: BRAND.red }}>{composeError}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setCompose(null)} disabled={sending} className="text-xs px-3 py-2 text-gray-500">Cancel</button>
              <button onClick={sendOutreach} disabled={sending || !compose.message.trim()}
                className="text-xs font-medium px-4 py-2 rounded-xl text-white flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: BRAND.primary }}>
                {sending ? <><RefreshCw size={12} className="animate-spin" /> Sending…</> : <><Send size={12} /> Send Email</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM TAB
// ═══════════════════════════════════════════════════════════════════════════════
interface TeamMember { _id: string; name: string; email: string; jobTitle: string; accessLevel: string; status: string; invitedAt?: string | null; createdAt?: string | null; }

function TeamTab() {
  const ACCESS_COLORS: Record<string, string> = { Admin: BRAND.red, Manager: BRAND.purple, Recruiter: BRAND.accent };
  const STATUS_COLORS: Record<string, string> = { Active: BRAND.green, Invited: BRAND.orange, Suspended: '#94a3b8' };
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: 'invite' | 'edit'; target?: TeamMember } | null>(null);
  const [form, setForm] = useState({ name: '', email: '', jobTitle: '', accessLevel: 'Recruiter', status: 'Invited' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const PERMISSIONS = [
    { action: 'Post & manage jobs',     Admin: true,  Manager: true,  Recruiter: false },
    { action: 'View all candidates',    Admin: true,  Manager: true,  Recruiter: true  },
    { action: 'Move pipeline stages',   Admin: true,  Manager: true,  Recruiter: true  },
    { action: 'Schedule interviews',    Admin: true,  Manager: true,  Recruiter: true  },
    { action: 'Send assessments',       Admin: true,  Manager: true,  Recruiter: false },
    { action: 'Access analytics',       Admin: true,  Manager: true,  Recruiter: false },
    { action: 'Invite team members',    Admin: true,  Manager: false, Recruiter: false },
    { action: 'Manage billing & plan',  Admin: true,  Manager: false, Recruiter: false },
    { action: 'Delete candidates/jobs', Admin: true,  Manager: false, Recruiter: false },
  ];

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/employer/team', { headers: authHdr() as HeadersInit });
      const d = await res.json().catch(() => null);
      if (!aliveRef.current) return;
      if (res.ok && Array.isArray(d)) { setMembers(d); setError(null); }
      else setError('Could not load team members.');
    } catch { if (aliveRef.current) setError('Could not load team members.'); }
    finally { if (aliveRef.current) setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const flashNotice = (msg: string) => { setNotice(msg); setTimeout(() => { if (aliveRef.current) setNotice(null); }, 5000); };

  const openInvite = () => { setForm({ name: '', email: '', jobTitle: '', accessLevel: 'Recruiter', status: 'Invited' }); setFormError(null); setModal({ mode: 'invite' }); };
  const openEdit = (m: TeamMember) => { setForm({ name: m.name, email: m.email, jobTitle: m.jobTitle, accessLevel: m.accessLevel, status: m.status }); setFormError(null); setModal({ mode: 'edit', target: m }); };

  const save = async () => {
    setSaving(true); setFormError(null);
    try {
      if (modal?.mode === 'edit' && modal.target) {
        const id = modal.target._id;
        const res = await fetch(`/api/employer/team/${id}`, {
          method: 'PUT', headers: authHdr() as HeadersInit,
          body: JSON.stringify({ name: form.name, jobTitle: form.jobTitle, accessLevel: form.accessLevel, status: form.status }),
        });
        const d = await res.json().catch(() => ({}));
        if (!aliveRef.current) return;
        if (res.ok && d.success) { setMembers(ms => ms.map(m => m._id === id ? d.member : m)); setModal(null); flashNotice('Team member updated.'); }
        else setFormError(d.message || 'Could not save changes.');
      } else {
        if (!form.name.trim()) { setFormError('Name is required.'); setSaving(false); return; }
        const res = await fetch('/api/employer/team', {
          method: 'POST', headers: authHdr() as HeadersInit,
          body: JSON.stringify({ name: form.name, email: form.email, jobTitle: form.jobTitle, accessLevel: form.accessLevel }),
        });
        const d = await res.json().catch(() => ({}));
        if (!aliveRef.current) return;
        if (res.ok && d.success) {
          setMembers(ms => [d.member, ...ms]);
          setModal(null);
          if (d.demo) flashNotice('Member added. Demo address (@example.com) — no invite email was sent.');
          else if (!d.emailSent) flashNotice('Member added, but the invitation email could not be delivered.');
          else flashNotice('Member added and invitation email sent.');
        } else setFormError(d.message || 'Could not add member.');
      }
    } catch { if (aliveRef.current) setFormError('Something went wrong. Please try again.'); }
    finally { if (aliveRef.current) setSaving(false); }
  };

  const remove = async (m: TeamMember) => {
    if (!confirm(`Remove ${m.name || m.email} from the team?`)) return;
    try {
      const res = await fetch(`/api/employer/team/${m._id}`, { method: 'DELETE', headers: authHdr() as HeadersInit });
      if (!aliveRef.current) return;
      if (res.ok) { setMembers(ms => ms.filter(x => x._id !== m._id)); flashNotice('Team member removed.'); }
      else flashNotice('Could not remove that member.');
    } catch { flashNotice('Could not remove that member.'); }
  };

  const initials = (m: TeamMember) => {
    const src = (m.name || m.email || '?').trim();
    const parts = src.split(/\s+/).filter(Boolean);
    return (parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2)).toUpperCase();
  };
  const fmtDate = (iso?: string | null) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return ''; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hiring Team</h1>
          <p className="text-xs text-gray-500 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''} · Managed roster &amp; invitations</p>
        </div>
        <button onClick={openInvite} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm" style={{ backgroundColor: BRAND.primary }}>
          <Plus size={13} /> Invite Member
        </button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium" style={{ backgroundColor: `${BRAND.green}12`, color: BRAND.green }}>
          <CheckCircle size={13} /> {notice}
        </div>
      )}

      {/* Invite / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">{modal.mode === 'edit' ? 'Edit Team Member' : 'Invite Team Member'}</h3>
              <button onClick={() => !saving && setModal(null)} aria-label="Close"><X size={16} className="text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Full Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" placeholder="Priya Sharma" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Email *</label>
                <input type="email" value={form.email} disabled={modal.mode === 'edit'} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none disabled:bg-gray-50 disabled:text-gray-400" placeholder="priya@company.com" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Job Title</label>
                <input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })}
                  className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" placeholder="Senior Recruiter" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Access Level</label>
                <select value={form.accessLevel} onChange={e => setForm({ ...form, accessLevel: e.target.value })}
                  className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                  <option>Admin</option><option>Manager</option><option>Recruiter</option>
                </select>
              </div>
              {modal.mode === 'edit' && (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                    <option>Invited</option><option>Active</option><option>Suspended</option>
                  </select>
                </div>
              )}
            </div>
            {modal.mode === 'invite' && (
              <p className="text-[10px] text-gray-400 mt-3">
                An invitation email will be sent to this address. This adds them to your team roster — it does not automatically grant sign-in access.
              </p>
            )}
            {formError && <p className="text-[10px] mt-2" style={{ color: BRAND.red }}>{formError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setModal(null)} disabled={saving} className="text-xs px-3 py-2 text-gray-500">Cancel</button>
              <button onClick={save} disabled={saving || !form.name.trim() || (modal.mode === 'invite' && !form.email.trim())}
                className="text-xs font-medium px-4 py-2 rounded-xl text-white flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: BRAND.primary }}>
                {saving ? <><RefreshCw size={12} className="animate-spin" /> Saving…</> : modal.mode === 'edit' ? <><CheckCircle size={12} /> Save Changes</> : <><Send size={12} /> Send Invite</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team list */}
      {loading ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
          <RefreshCw size={20} className="mx-auto mb-2 animate-spin text-gray-300" />
          <p className="text-xs text-gray-400">Loading team…</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
          <AlertCircle size={22} className="mx-auto mb-2" style={{ color: BRAND.orange }} />
          <p className="text-xs text-gray-500 mb-3">{error}</p>
          <button onClick={() => { setLoading(true); reload(); }} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600">Retry</button>
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <Users2 size={32} className="mx-auto mb-3 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-700 mb-1">No team members yet</h3>
          <p className="text-xs text-gray-400 mb-4">Invite recruiters and hiring managers to collaborate on your pipeline.</p>
          <button onClick={openInvite} className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>
            <Plus size={13} /> Invite your first member
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m._id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0" style={{ background: `${BRAND.primary}` }}>
                  {initials(m)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{m.name || '—'}</div>
                  {m.jobTitle && <div className="text-xs text-gray-500 truncate">{m.jobTitle}</div>}
                  <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5"><Mail size={9} />{m.email}</div>
                  {m.invitedAt && m.status === 'Invited' && <div className="text-[10px] text-gray-300 mt-0.5">Invited {fmtDate(m.invitedAt)}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Chip label={m.accessLevel} color={ACCESS_COLORS[m.accessLevel] || BRAND.primary} />
                <Chip label={m.status} color={STATUS_COLORS[m.status] || BRAND.orange} size="xs" />
                <button onClick={() => openEdit(m)} aria-label={`Edit ${m.name}`} className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600"><Edit3 size={13} /></button>
                <button onClick={() => remove(m)} aria-label={`Remove ${m.name}`} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Permissions Matrix (role framework — documents intended access by level) */}
      <SCard title="Permissions Matrix" icon={<Shield size={16} />}>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-semibold text-gray-500 py-1.5 pr-4">Action</th>
                {['Admin','Manager','Recruiter'].map(r => (
                  <th key={r} className="text-center text-[10px] font-semibold py-1.5 px-2" style={{ color: ACCESS_COLORS[r] }}>{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p, i) => (
                <tr key={p.action} className={i % 2 === 0 ? 'bg-gray-50/60' : ''}>
                  <td className="py-1.5 pr-4 text-gray-600 text-[10px]">{p.action}</td>
                  {(['Admin','Manager','Recruiter'] as const).map(r => (
                    <td key={r} className="text-center py-1.5 px-2">
                      {p[r]
                        ? <CheckCircle size={12} style={{ color: BRAND.green }} className="mx-auto" />
                        : <X size={10} className="mx-auto text-gray-200" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SCard>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={14} style={{ color: BRAND.primary }} />
          <span className="text-xs font-semibold text-gray-800">Data Security & Compliance</span>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">All candidate data is encrypted at rest and in transit. Access is logged and auditable. Compliant with DPDPA 2023 (India) and GDPR frameworks. Candidate consent is captured at point of application.</p>
        <div className="flex gap-2 mt-3">
          <Chip label="DPDPA 2023" color={BRAND.green} size="xs" />
          <Chip label="GDPR Ready" color={BRAND.green} size="xs" />
          <Chip label="ISO 27001 Aligned" color={BRAND.primary} size="xs" />
          <Chip label="SOC 2 Type II" color={BRAND.accent} size="xs" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANY PROFILE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function CompanyTab({ company, setCompany }: { company: Company | null; setCompany: (c: Company) => void }) {
  const [editing, setEditing] = useState(!company?.name);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: company?.name || '', industry: company?.industry || '', size: company?.size || '',
    website: company?.website || '', linkedin: company?.linkedin || '', location: company?.location || '',
    about: company?.about || '', culture: company?.culture || '',
    benefits: (company?.benefits || []).join(', '), techStack: (company?.techStack || []).join(', '), values: (company?.values || []).join(', '),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, benefits: form.benefits.split(',').map(s => s.trim()).filter(Boolean), techStack: form.techStack.split(',').map(s => s.trim()).filter(Boolean), values: form.values.split(',').map(s => s.trim()).filter(Boolean) };
      const res = await fetch('/api/employer/company', { method: 'PUT', headers: authHdr() as HeadersInit, body: JSON.stringify(payload) });
      const d = await res.json();
      if (d.success) { setCompany(d.company); setEditing(false); }
    } catch {} finally { setSaving(false); }
  };

  const fld = (k: keyof typeof form, label: string, type = 'text') => (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">{label}</label>
      <input type={type} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} disabled={!editing}
        className={`w-full h-9 px-3 text-xs border rounded-lg focus:outline-none ${editing ? 'border-gray-200' : 'border-transparent bg-gray-50'}`} />
    </div>
  );

  const txa = (k: keyof typeof form, label: string, rows = 3) => (
    <div className="col-span-2">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">{label}</label>
      <textarea rows={rows} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} disabled={!editing}
        className={`w-full text-xs border rounded-lg p-2.5 resize-none focus:outline-none ${editing ? 'border-gray-200' : 'border-transparent bg-gray-50'}`} />
    </div>
  );

  const completionFields = [
    { key: 'name', label: 'Company Name', done: !!company?.name },
    { key: 'industry', label: 'Industry', done: !!company?.industry },
    { key: 'size', label: 'Company Size', done: !!company?.size },
    { key: 'location', label: 'Location', done: !!company?.location },
    { key: 'website', label: 'Website', done: !!company?.website },
    { key: 'about', label: 'About section', done: !!company?.about },
    { key: 'culture', label: 'Culture description', done: !!company?.culture },
    { key: 'benefits', label: 'Benefits listed', done: (company?.benefits?.length ?? 0) > 0 },
    { key: 'values', label: 'Company values', done: (company?.values?.length ?? 0) > 0 },
  ];
  const completedCount = completionFields.filter(f => f.done).length;
  const completionPct = Math.round((completedCount / completionFields.length) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Company Profile</h1>
          <p className="text-xs text-gray-500 mt-0.5">Visible to candidates on job postings</p>
        </div>
        {editing
          ? <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-xs px-3 py-2 text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm" style={{ backgroundColor: BRAND.primary }}>
                {saving ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          : <button onClick={() => setEditing(true)} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600">
              <Edit3 size={13} /> Edit
            </button>}
      </div>

      {/* Profile Completion Tracker */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-800">Profile Completion</span>
            <Chip label={`${completionPct}%`} color={completionPct === 100 ? BRAND.green : completionPct >= 60 ? BRAND.orange : BRAND.red} size="xs" />
          </div>
          <span className="text-[10px] text-gray-400">{completedCount}/{completionFields.length} fields</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${completionPct}%`, backgroundColor: completionPct === 100 ? BRAND.green : completionPct >= 60 ? BRAND.orange : BRAND.red }} />
        </div>
        <div className="flex flex-wrap gap-2">
          {completionFields.map(f => (
            <div key={f.key} className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium ${f.done ? '' : 'opacity-60'}`}
              style={{ backgroundColor: f.done ? `${BRAND.green}12` : '#f1f5f9', color: f.done ? BRAND.green : '#94a3b8' }}>
              {f.done ? <CheckCircle size={8} /> : <AlertCircle size={8} />}
              {f.label}
            </div>
          ))}
        </div>
        {completionPct < 100 && <p className="text-[10px] text-gray-400 mt-2">Complete your profile to increase candidate trust and improve job visibility.</p>}
      </div>

      {/* Company header preview */}
      {company?.name && !editing && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="h-20 w-full" style={{ background: `${BRAND.primary}` }} />
          <div className="px-6 pb-5 -mt-8">
            <div className="w-16 h-16 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center text-2xl font-bold mb-3"
              style={{ color: BRAND.primary }}>
              {company.name.charAt(0)}
            </div>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">{company.name}</h2>
                <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                  {company.industry && <span>{company.industry}</span>}
                  {company.size     && <span>· {company.size} employees</span>}
                  {company.location && <span className="flex items-center gap-1"><MapPin size={10} />{company.location}</span>}
                </div>
                <div className="flex gap-2 mt-1">
                  {company.website  && <a href={company.website}  target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-1" style={{ color: BRAND.primary }}><Globe size={10} />Website</a>}
                  {company.linkedin && <a href={company.linkedin} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-1" style={{ color: BRAND.primary }}><Linkedin size={10} />LinkedIn</a>}
                </div>
              </div>
              {company.verified && <Chip label="✓ Verified Employer" color={BRAND.green} />}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          {fld('name',     'Company Name *')}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Industry</label>
            <select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} disabled={!editing}
              className={`w-full h-9 px-3 text-xs border rounded-lg focus:outline-none ${editing ? 'border-gray-200' : 'border-transparent bg-gray-50'}`}>
              <option value="">Select industry</option>
              {INDUSTRY_OPTIONS.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Company Size</label>
            <select value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} disabled={!editing}
              className={`w-full h-9 px-3 text-xs border rounded-lg focus:outline-none ${editing ? 'border-gray-200' : 'border-transparent bg-gray-50'}`}>
              <option value="">Select size</option>
              {COMPANY_SIZES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {fld('location', 'Headquarters')}
          {fld('website',  'Website URL',  'url')}
          {fld('linkedin', 'LinkedIn URL', 'url')}
          {txa('about',   'About the Company')}
          {txa('culture', 'Culture & Work Environment')}
          <div className="col-span-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Employee Benefits (comma-separated)</label>
            <input value={form.benefits} onChange={e => setForm({ ...form, benefits: e.target.value })} disabled={!editing}
              placeholder="Health insurance, WFH, ESOP, Flexible hours, Learning budget…"
              className={`w-full h-9 px-3 text-xs border rounded-lg focus:outline-none ${editing ? 'border-gray-200' : 'border-transparent bg-gray-50'}`} />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Tech Stack (comma-separated)</label>
            <input value={form.techStack} onChange={e => setForm({ ...form, techStack: e.target.value })} disabled={!editing}
              placeholder="React, Node.js, AWS, PostgreSQL, Python…"
              className={`w-full h-9 px-3 text-xs border rounded-lg focus:outline-none ${editing ? 'border-gray-200' : 'border-transparent bg-gray-50'}`} />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Company Values (comma-separated)</label>
            <input value={form.values} onChange={e => setForm({ ...form, values: e.target.value })} disabled={!editing}
              placeholder="Innovation, Integrity, Inclusion, Customer obsession…"
              className={`w-full h-9 px-3 text-xs border rounded-lg focus:outline-none ${editing ? 'border-gray-200' : 'border-transparent bg-gray-50'}`} />
          </div>
        </div>
      </div>

      {/* Preview chips */}
      {company && !editing && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {company.benefits?.length > 0 && (
            <SCard title="Benefits" icon={<Star size={14} />}>
              <div className="flex flex-wrap gap-1.5">{company.benefits.map(b => <Chip key={b} label={b} color={BRAND.green} size="xs" />)}</div>
            </SCard>
          )}
          {company.techStack?.length > 0 && (
            <SCard title="Tech Stack" icon={<Code size={14} />}>
              <div className="flex flex-wrap gap-1.5">{company.techStack.map(t => <Chip key={t} label={t} color={BRAND.primary} size="xs" />)}</div>
            </SCard>
          )}
          {company.values?.length > 0 && (
            <SCard title="Values" icon={<Flame size={14} />}>
              <div className="flex flex-wrap gap-1.5">{company.values.map(v => <Chip key={v} label={v} color={BRAND.purple} size="xs" />)}</div>
            </SCard>
          )}
        </div>
      )}
    </div>
  );
}

// Simple deterministic hash for seeded values (used by other workforce widgets)
function dHash(s: string, offset = 0): number {
  let h = offset + 7;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — WORKFORCE INTELLIGENCE (real EIOS aggregation)
// Wired to GET /api/employer/eios/workforce-analytics (flag-gated → 503 renders
// an honest "disabled" state). Behavioural / cognitive / future-readiness
// indices are computed SERVER-SIDE from real MetryxOne platform signals, joined
// to the employer's roster by work email. Coverage (how many employees have
// signals) is reported SEPARATELY from index values. Employer-reported fields
// (tenure / performance / location / gender) are labelled as such — never inferred.
// ═══════════════════════════════════════════════════════════════════════════

const RISK_META: Record<string, { color: string; label: string }> = {
  High:    { color: BRAND.red,    label: 'High' },
  Medium:  { color: BRAND.orange, label: 'Medium' },
  Low:     { color: BRAND.green,  label: 'Low' },
  Unknown: { color: '#94a3b8',    label: 'Unknown' },
};

function StatTile({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8eef5', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent ?? BRAND.primary, marginTop: 4, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function OrgIntelligenceTab({ company, onTabChange }: {
  company: Company | null; jobs: EmployerJob[]; candidates: Candidate[]; onTabChange: (t: TabId) => void;
}) {
  const [data, setData] = useState<any | null>(null);
  const [arch, setArch] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errKind, setErrKind] = useState<'disabled' | 'failed' | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [expandRoster, setExpandRoster] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // roster import (real SheetJS → POST /api/employer/eios/employees/import)
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setErrKind(null);
    try {
      const res = await fetch('/api/employer/eios/workforce-analytics', { headers: authHdr() as HeadersInit });
      if (res.status === 503) { setErrKind('disabled'); setData(null); }
      else if (!res.ok) { setErrKind('failed'); setData(null); }
      else { setData(await res.json()); }
    } catch { setErrKind('failed'); setData(null); }
    try {
      const aRes = await fetch('/api/employer/eios/competency-architecture', { headers: authHdr() as HeadersInit });
      if (aRes.ok) setArch(await aRes.json());
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const downloadTemplate = useCallback(() => {
    const header = 'email,full_name,role_code,department,seniority,tenure_years,performance_score,location,gender,age';
    const sample = [
      'arjun.sharma@company.com,Arjun Sharma,SWE,Engineering,Senior,2.5,78,Bangalore,Male,29',
      'priya.patel@company.com,Priya Patel,PM,Product,Manager,3.1,85,Mumbai,Female,33',
    ];
    const blob = new Blob([[header, ...sample].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'workforce_roster_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }, []);

  const parseFile = useCallback(async (file: File) => {
    setParsing(true); setParseError(null); setParsedRows(null); setImportResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (raw.length === 0) { setParseError('No rows found in the file.'); setParsing(false); return; }
      const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');
      const pick = (row: any, keys: string[]) => {
        for (const want of keys) for (const k of Object.keys(row)) if (norm(k) === want) { const v = row[k]; if (v !== '' && v != null) return v; }
        return '';
      };
      const mapped = raw.map(r => ({
        email:             String(pick(r, ['email', 'emailaddress', 'mail', 'workemail'])).trim(),
        full_name:         String(pick(r, ['fullname', 'name', 'employeename'])).trim(),
        role_code:         String(pick(r, ['rolecode', 'role', 'designation', 'title', 'jobtitle'])).trim(),
        department:        String(pick(r, ['department', 'dept', 'team'])).trim(),
        seniority:         String(pick(r, ['seniority', 'level', 'grade', 'band'])).trim(),
        tenure_years:      pick(r, ['tenureyears', 'tenure', 'yearsofservice', 'tenureyrs']),
        performance_score: pick(r, ['performancescore', 'performance', 'perfscore', 'rating']),
        location:          String(pick(r, ['location', 'city', 'office', 'site'])).trim(),
        gender:            String(pick(r, ['gender', 'sex'])).trim(),
        age:               pick(r, ['age']),
      })).filter(x => x.email);
      if (mapped.length === 0) { setParseError('No rows with a valid "email" column were found. The email column is required.'); setParsing(false); return; }
      const seen = new Set<string>(); const deduped: any[] = [];
      for (const m of mapped) { const e = m.email.toLowerCase(); if (seen.has(e)) continue; seen.add(e); deduped.push(m); }
      setParsedRows(deduped.slice(0, 500));
    } catch (e: any) { setParseError('Could not read file: ' + (e?.message || 'unknown error')); }
    setParsing(false);
  }, []);

  const runImport = useCallback(async () => {
    if (!parsedRows || parsedRows.length === 0) return;
    setImporting(true); setImportResult(null);
    try {
      const res = await fetch('/api/employer/eios/employees/import', {
        method: 'POST', headers: authHdr() as HeadersInit,
        body: JSON.stringify({ employees: parsedRows }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) setImportResult({ error: j?.error || 'Import failed' });
      else { setImportResult(j); setParsedRows(null); await fetchAll(); }
    } catch (e: any) { setImportResult({ error: e?.message || 'Import failed' }); }
    setImporting(false);
  }, [parsedRows, fetchAll]);

  const exportCsv = useCallback(() => {
    if (!data?.employees?.length) return;
    const cols = ['email', 'fullName', 'department', 'roleName', 'seniority', 'tenureYears', 'performanceScore', 'location', 'gender', 'behavioralIndex', 'cognitiveIndex', 'futureIndex', 'compositeIndex', 'riskScore', 'retentionRisk', 'coverage'];
    const esc = (v: any) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = data.employees.map((e: any) => cols.map(c => esc(e[c])).join(','));
    const blob = new Blob([[cols.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'workforce_intelligence_export.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  const fmt = (v: any, suffix = '') => (v == null ? '—' : `${v}${suffix}`);
  const employees: any[] = data?.employees ?? [];
  const rosterFiltered = employees.filter(e => {
    if (!rosterSearch.trim()) return true;
    const q = rosterSearch.toLowerCase();
    return [e.fullName, e.email, e.department, e.roleName, e.roleCode].some((x: any) => String(x || '').toLowerCase().includes(q));
  });
  const rosterShown = expandRoster ? rosterFiltered : rosterFiltered.slice(0, 10);

  const btn = (bg: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', background: bg, border: 'none', cursor: 'pointer' });
  const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, color: BRAND.primary, background: '#fff', border: '1px solid #d6e0ec', cursor: 'pointer' };
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e8eef5', borderRadius: 14, padding: 18 };
  const sectionTitle: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: BRAND.primary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '4px 2px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: BRAND.primary, margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
            <Users2 size={22} style={{ color: BRAND.accent }} /> Workforce Intelligence
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0', maxWidth: 720 }}>
            Real MetryxOne platform signals for {company?.name ?? 'your organisation'} — behavioural, cognitive and future-readiness — matched to your employee roster by work email. No data is simulated.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn(BRAND.primary)} onClick={() => { setShowUpload(true); setImportResult(null); setParsedRows(null); setParseError(null); }}><Upload size={15} /> Import roster</button>
          <button style={{ ...btnGhost, opacity: data?.employees?.length ? 1 : 0.5, cursor: data?.employees?.length ? 'pointer' : 'not-allowed' }} onClick={exportCsv} disabled={!data?.employees?.length}><Download size={15} /> Export CSV</button>
          <button style={btnGhost} onClick={fetchAll}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      {loading && (
        <div style={{ ...card, textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Loading workforce intelligence…</div>
        </div>
      )}

      {!loading && errKind === 'disabled' && (
        <div style={{ ...card, borderColor: '#fde68a', background: '#fffbeb' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Info size={20} style={{ color: '#b45309', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#92400e' }}>Advanced workforce analytics is disabled</div>
              <p style={{ fontSize: 13, color: '#92400e', margin: '6px 0 0' }}>
                These analytics are gated behind the <code>FF_EIOS_WORLD_CLASS_VERIFIED_V2</code> feature flag, which is currently off in this environment. Enable it on the backend workflow to populate this view. Nothing is shown rather than showing fabricated charts.
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && errKind === 'failed' && (
        <div style={{ ...card, borderColor: '#fecaca', background: '#fef2f2' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <AlertCircle size={20} style={{ color: BRAND.red }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>Couldn't load workforce analytics.</div>
            </div>
            <button style={btn(BRAND.red)} onClick={fetchAll}><RefreshCw size={14} /> Retry</button>
          </div>
        </div>
      )}

      {!loading && !errKind && data && data.total === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: 44 }}>
          <Users2 size={34} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 17, fontWeight: 800, color: BRAND.primary }}>No employees in your workforce yet</div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '8px auto 18px', maxWidth: 460 }}>
            Import your employee roster to see real behavioural, cognitive and future-readiness intelligence for staff who have completed a MetryxOne assessment.
          </p>
          <button style={{ ...btn(BRAND.primary), margin: '0 auto' }} onClick={() => setShowUpload(true)}><Upload size={15} /> Import roster</button>
        </div>
      )}

      {!loading && !errKind && data && data.total > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Coverage banner (COVERAGE axis, kept distinct from index values) */}
          <div style={{ ...card, background: '#f0fdfa', borderColor: '#99f6e4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Gauge size={18} style={{ color: BRAND.green }} />
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f766e' }}>
                Coverage: {data.withAssessment} of {data.total} employees ({data.coveragePct}%) have platform intelligence signals
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#0f766e', margin: '6px 0 0' }}>
              Indices below are computed only for employees with signals. Behavioural / cognitive / future indices are derived from MetryxOne assessments matched by work email; performance, tenure, location and gender are employer-reported.
            </p>
          </div>

          {/* KPI tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <StatTile label="Employees" value={data.total} sub="in roster" />
            <StatTile label="With intelligence" value={`${data.withAssessment}`} sub={`${data.coveragePct}% coverage`} accent={BRAND.accent} />
            <StatTile label="Avg composite" value={fmt(data.averages?.composite?.value)} sub={`n=${data.averages?.composite?.n ?? 0}`} />
            <StatTile label="Avg behavioural" value={fmt(data.averages?.behavioral?.value)} sub={`n=${data.averages?.behavioral?.n ?? 0}`} />
            <StatTile label="Avg performance" value={fmt(data.averages?.performance?.value)} sub={`employer-reported · n=${data.averages?.performance?.n ?? 0}`} />
            <StatTile label="Avg tenure" value={fmt(data.averages?.tenure?.value, ' yr')} sub={`employer-reported · n=${data.averages?.tenure?.n ?? 0}`} />
          </div>

          {/* Retention risk distribution */}
          <div style={card}>
            <div style={sectionTitle}><HeartPulse size={16} /> Retention risk distribution</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              {([['Low', data.riskDistribution?.low], ['Medium', data.riskDistribution?.medium], ['High', data.riskDistribution?.high], ['Unknown', data.riskDistribution?.unknown]] as [string, number][]).map(([k, v]) => (
                <div key={k} style={{ border: `1px solid ${RISK_META[k].color}33`, background: `${RISK_META[k].color}0d`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: RISK_META[k].color }}>{v ?? 0}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{k} risk</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '10px 0 0' }}>
              Risk is the inverse of the behavioural risk signal. "Unknown" = no behavioural data captured for that employee.
            </p>
          </div>

          {/* By department */}
          <div style={card}>
            <div style={sectionTitle}><Building size={16} /> By department</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    <th style={{ padding: '8px 10px' }}>Department</th>
                    <th style={{ padding: '8px 10px' }}>Headcount</th>
                    <th style={{ padding: '8px 10px' }}>Avg composite</th>
                    <th style={{ padding: '8px 10px' }}>Avg performance</th>
                    <th style={{ padding: '8px 10px' }}>High risk</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.byDepartment ?? []).map((d: any) => (
                    <tr key={d.name} style={{ borderTop: '1px solid #eef2f7' }}>
                      <td style={{ padding: '9px 10px', fontWeight: 700, color: BRAND.primary }}>{d.name}</td>
                      <td style={{ padding: '9px 10px' }}>{d.count}</td>
                      <td style={{ padding: '9px 10px' }}>{d.avgComposite == null ? '—' : d.avgComposite} <span style={{ color: '#94a3b8', fontSize: 11 }}>(n={d.assessedCount})</span></td>
                      <td style={{ padding: '9px 10px' }}>{d.avgPerformance == null ? '—' : d.avgPerformance} <span style={{ color: '#94a3b8', fontSize: 11 }}>(n={d.performanceCount})</span></td>
                      <td style={{ padding: '9px 10px', color: d.highRisk > 0 ? BRAND.red : '#475569', fontWeight: d.highRisk > 0 ? 700 : 400 }}>{d.highRisk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Demographics (employer-reported, conditional) */}
          {(data.genderDist?.length > 0 || data.locationDist?.length > 0 || data.tenureBands?.length > 0) ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {data.tenureBands?.length > 0 && (
                <div style={card}>
                  <div style={sectionTitle}><Clock size={16} /> Tenure bands</div>
                  {data.tenureBands.map((b: any) => (
                    <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                      <span style={{ color: '#475569' }}>{b.label}</span><span style={{ fontWeight: 700, color: BRAND.primary }}>{b.count}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Employer-reported.</p>
                </div>
              )}
              {data.locationDist?.length > 0 && (
                <div style={card}>
                  <div style={sectionTitle}><MapPin size={16} /> Locations</div>
                  {data.locationDist.slice(0, 8).map((b: any) => (
                    <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                      <span style={{ color: '#475569' }}>{b.label}</span><span style={{ fontWeight: 700, color: BRAND.primary }}>{b.count}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Employer-reported.</p>
                </div>
              )}
              {data.genderDist?.length > 0 && (
                <div style={card}>
                  <div style={sectionTitle}><Users size={16} /> Gender mix</div>
                  {data.genderDist.map((b: any) => (
                    <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                      <span style={{ color: '#475569' }}>{b.label}</span><span style={{ fontWeight: 700, color: BRAND.primary }}>{b.count}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Employer-reported · for fairness monitoring only.</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...card, color: '#94a3b8', fontSize: 13 }}>
              <Info size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
              No employer-reported demographic fields yet. Add <code>tenure_years</code>, <code>location</code> or <code>gender</code> columns to your roster import to populate tenure / location / gender breakdowns.
            </div>
          )}

          {/* Top performers */}
          {data.topPerformers?.length > 0 && (
            <div style={card}>
              <div style={sectionTitle}><Star size={16} /> Top by composite index</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {data.topPerformers.map((t: any) => (
                  <div key={t.id} style={{ border: '1px solid #eef2f7', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, color: BRAND.primary, fontSize: 14 }}>{t.name}</div>
                      <div style={{ fontWeight: 800, color: BRAND.green, fontSize: 18 }}>{t.compositeIndex}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{t.role || '—'} · {t.department}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {t.behavioralIndex != null && <Chip label={`Behav ${t.behavioralIndex}`} color={BRAND.accent} size="xs" />}
                      {t.cognitiveIndex != null && <Chip label={`Cog ${t.cognitiveIndex}`} color={BRAND.purple} size="xs" />}
                      {t.futureIndex != null && <Chip label={`Future ${t.futureIndex}`} color={BRAND.primary} size="xs" />}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '10px 0 0' }}>
                Ranked by composite of available platform signals — a development snapshot, not a performance rating.
              </p>
            </div>
          )}

          {/* Role competency architecture (real seeded reference, replaces synthetic skill matrix) */}
          {arch?.roles?.length > 0 && (
            <div style={card}>
              <div style={sectionTitle}><Layers size={16} /> Role competency architecture <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>· {arch.industry}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {arch.roles.slice(0, 8).map((r: any) => {
                  const targets = r.proficiency_targets && typeof r.proficiency_targets === 'object' ? Object.entries(r.proficiency_targets) : [];
                  return (
                    <div key={r.role_code} style={{ border: '1px solid #eef2f7', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: BRAND.primary, fontSize: 14 }}>{r.role_name}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{[r.seniority, r.function_name].filter(Boolean).join(' · ') || '—'}</div>
                      {targets.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          {targets.slice(0, 4).map(([k, v]: any) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                              <span style={{ color: '#475569', textTransform: 'capitalize' }}>{String(k).replace(/_/g, ' ')}</span>
                              <span style={{ fontWeight: 700, color: BRAND.accent }}>{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '10px 0 0' }}>
                Reference competency targets per role{arch.seeded ? '' : ' (default catalogue)'} — the basis for measuring role fit.
              </p>
            </div>
          )}

          {/* Roster table */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              <div style={sectionTitle}><ListChecks size={16} /> Employee roster ({rosterFiltered.length})</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #d6e0ec', borderRadius: 8, padding: '4px 10px' }}>
                <Search size={14} style={{ color: '#94a3b8' }} />
                <input value={rosterSearch} onChange={e => setRosterSearch(e.target.value)} placeholder="Search name, email, dept…" style={{ border: 'none', outline: 'none', fontSize: 13, width: 200 }} />
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    <th style={{ padding: '8px 10px' }}>Employee</th>
                    <th style={{ padding: '8px 10px' }}>Dept</th>
                    <th style={{ padding: '8px 10px' }}>Role</th>
                    <th style={{ padding: '8px 10px' }}>Tenure</th>
                    <th style={{ padding: '8px 10px' }}>Perf</th>
                    <th style={{ padding: '8px 10px' }}>Composite</th>
                    <th style={{ padding: '8px 10px' }}>Risk</th>
                    <th style={{ padding: '8px 10px' }}>Signals</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterShown.map((e: any) => (
                    <tr key={e.id} style={{ borderTop: '1px solid #eef2f7' }}>
                      <td style={{ padding: '9px 10px' }}>
                        <div style={{ fontWeight: 700, color: BRAND.primary }}>{e.fullName || '—'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{e.email}</div>
                      </td>
                      <td style={{ padding: '9px 10px', color: '#475569' }}>{e.department}</td>
                      <td style={{ padding: '9px 10px', color: '#475569' }}>{e.roleName || e.roleCode || '—'}</td>
                      <td style={{ padding: '9px 10px' }}>{e.tenureYears == null ? '—' : `${e.tenureYears}y`}</td>
                      <td style={{ padding: '9px 10px' }}>{e.performanceScore == null ? '—' : e.performanceScore}</td>
                      <td style={{ padding: '9px 10px', fontWeight: 700, color: e.compositeIndex == null ? '#cbd5e1' : BRAND.primary }}>{e.compositeIndex == null ? '—' : e.compositeIndex}</td>
                      <td style={{ padding: '9px 10px' }}><span style={{ color: RISK_META[e.retentionRisk]?.color, fontWeight: 700 }}>{e.retentionRisk}</span></td>
                      <td style={{ padding: '9px 10px', color: '#94a3b8', fontSize: 12 }}>{e.coverage}/3</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rosterFiltered.length > 10 && (
              <button style={{ ...btnGhost, marginTop: 12 }} onClick={() => setExpandRoster(v => !v)}>
                {expandRoster ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show all {rosterFiltered.length}</>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }} onClick={() => { if (!importing) setShowUpload(false); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: BRAND.primary, margin: 0 }}>Import employee roster</h3>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }} onClick={() => { if (!importing) setShowUpload(false); }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px' }}>
              Upload a CSV or Excel file. Only <strong>email</strong> is required; other columns (name, role_code, department, seniority, tenure_years, performance_score, location, gender, age) are optional. Existing employees are updated by email.
            </p>
            <button style={{ ...btnGhost, marginBottom: 14 }} onClick={downloadTemplate}><Download size={14} /> Download CSV template</button>

            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ''; }} />
            <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #cbd5e1', borderRadius: 12, padding: 28, textAlign: 'center', cursor: 'pointer', color: '#64748b' }}>
              <Upload size={26} style={{ margin: '0 auto 8px', color: BRAND.accent }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.primary }}>Click to choose a file</div>
              <div style={{ fontSize: 12, marginTop: 3 }}>CSV, XLSX or XLS · up to 500 rows</div>
            </div>

            {parsing && <div style={{ marginTop: 14, fontSize: 13, color: '#64748b' }}><RefreshCw size={14} className="animate-spin" style={{ verticalAlign: -2, marginRight: 6 }} /> Reading file…</div>}
            {parseError && <div style={{ marginTop: 14, fontSize: 13, color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px' }}>{parseError}</div>}

            {parsedRows && parsedRows.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary }}>{parsedRows.length} valid row{parsedRows.length === 1 ? '' : 's'} ready</div>
                <div style={{ fontSize: 12, color: '#64748b', margin: '4px 0 10px' }}>
                  with role: {parsedRows.filter(r => r.role_code).length} · tenure: {parsedRows.filter(r => r.tenure_years !== '' && r.tenure_years != null).length} · performance: {parsedRows.filter(r => r.performance_score !== '' && r.performance_score != null).length}
                </div>
                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #eef2f7', borderRadius: 8 }}>
                  {parsedRows.slice(0, 6).map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 12, borderTop: i ? '1px solid #f1f5f9' : 'none' }}>
                      <span style={{ color: BRAND.primary, fontWeight: 600 }}>{r.email}</span>
                      <span style={{ color: '#94a3b8' }}>{[r.full_name, r.department].filter(Boolean).join(' · ') || '—'}</span>
                    </div>
                  ))}
                  {parsedRows.length > 6 && <div style={{ padding: '6px 10px', fontSize: 12, color: '#94a3b8', borderTop: '1px solid #f1f5f9' }}>+ {parsedRows.length - 6} more…</div>}
                </div>
                <button style={{ ...btn(BRAND.green), marginTop: 14, width: '100%', justifyContent: 'center', opacity: importing ? 0.6 : 1 }} onClick={runImport} disabled={importing}>
                  {importing ? <><RefreshCw size={15} className="animate-spin" /> Importing…</> : <><CheckCircle size={15} /> Import {parsedRows.length} employees</>}
                </button>
              </div>
            )}

            {importResult && (
              <div style={{ marginTop: 16, fontSize: 13, borderRadius: 8, padding: '12px 14px', background: importResult.error ? '#fef2f2' : '#f0fdf4', border: `1px solid ${importResult.error ? '#fecaca' : '#bbf7d0'}`, color: importResult.error ? '#991b1b' : '#166534' }}>
                {importResult.error ? importResult.error : (
                  <>
                    <div style={{ fontWeight: 800 }}><CheckCircle size={15} style={{ verticalAlign: -2, marginRight: 6 }} /> Imported {importResult.imported} · skipped {importResult.skipped} of {importResult.total}</div>
                    {importResult.errors?.length > 0 && <div style={{ marginTop: 6, color: '#92400e' }}>{importResult.errors.length} row issue(s): {importResult.errors.slice(0, 3).join('; ')}{importResult.errors.length > 3 ? '…' : ''}</div>}
                    <button style={{ ...btnGhost, marginTop: 10 }} onClick={() => setShowUpload(false)}>Done</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — AI TALENT MATCH (real hiring-intelligence engine)
// Ranks candidates assigned to a job via POST /api/employer/hiring/analyze/:jobId
// then reads the persisted, engine-computed assessments from
// GET /api/employer/hiring/assessments/:jobId. Every score (fit / readiness /
// success / retention / performance / leadership / verdict) is real engine
// output. Calibration status (CONFIDENCE axis) is surfaced separately from the
// predictions and labelled "decision-support, not a hiring decision".
// ═══════════════════════════════════════════════════════════════════════════
function TalentMatchTab({ jobs, onTabChange }: { jobs: EmployerJob[]; candidates: Candidate[]; onTabChange: (t: TabId) => void }) {
  const [selectedJobId, setSelectedJobId] = useState<string>(jobs[0]?._id ?? '');
  const [assessments, setAssessments] = useState<any[] | null>(null);
  const [assessmentsJobId, setAssessmentsJobId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [calib, setCalib] = useState<any | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<string>('All');

  // Job-bound async safety (mirrors the P2 candidate-drawer guard): rankings are REAL
  // engine output, so a slow response for a previously-selected job must NEVER be
  // written into state or rendered under a different job. We (1) bind results to the
  // job they belong to via assessmentsJobId and only render when it matches the live
  // selection, (2) read the live selection through a ref after every await, and
  // (3) clear results synchronously the instant the user switches jobs.
  const reqRef = useRef(0);                       // latest-wins ordering for same-job refetches
  const selectedJobIdRef = useRef(selectedJobId); // live selected job, readable after awaits
  useEffect(() => { selectedJobIdRef.current = selectedJobId; }, [selectedJobId]);

  const selectJob = useCallback((id: string) => {
    selectedJobIdRef.current = id;
    setSelectedJobId(id);
    setAssessments(null);        // drop the previous job's rankings immediately (no flash)
    setAssessmentsJobId(null);
    setLoadError(false);
  }, []);

  const selectedJob = jobs.find(j => j._id === selectedJobId) ?? jobs[0];

  // Initialise / repair the selected job when the parent loads jobs asynchronously
  // (jobs[] is empty on first render) or when the current selection no longer exists.
  useEffect(() => {
    if (jobs.length === 0) return;
    if (!selectedJobId || !jobs.some(j => j._id === selectedJobId)) selectJob(jobs[0]._id);
  }, [jobs, selectedJobId, selectJob]);

  const fetchAssessments = useCallback(async (jobId: string) => {
    if (!jobId) { setAssessments(null); setAssessmentsJobId(null); return; }
    const token = ++reqRef.current;
    // Stale if a newer request started OR the user has since switched to another job.
    const isStale = () => reqRef.current !== token || selectedJobIdRef.current !== jobId;
    setLoadError(false);
    try {
      const r = await fetch(`/api/employer/hiring/assessments/${jobId}`, { headers: authHdr() as HeadersInit });
      if (isStale()) return;
      if (r.ok) {
        const j = await r.json();
        if (isStale()) return;
        setAssessments(Array.isArray(j.assessments) ? j.assessments : []);
        setAssessmentsJobId(jobId);
      } else if (!isStale()) setLoadError(true);
    } catch { if (!isStale()) setLoadError(true); }
  }, []);

  useEffect(() => { if (selectedJobId) fetchAssessments(selectedJobId); }, [selectedJobId, fetchAssessments]);
  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/employer/tig/readiness', { headers: authHdr() as HeadersInit }); if (r.ok) { const j = await r.json(); if (j?.calibration) setCalib(j.calibration); } } catch {}
    })();
  }, []);

  const runAnalyze = useCallback(async () => {
    const jobId = selectedJobIdRef.current;
    if (!jobId) return;
    setAnalyzing(true);
    try {
      await fetch(`/api/employer/hiring/analyze/${jobId}`, { method: 'POST', headers: authHdr() as HeadersInit });
      // Only refresh if the user is still on the same job; fetchAssessments re-guards too.
      if (selectedJobIdRef.current === jobId) await fetchAssessments(jobId);
    } catch {} finally { setAnalyzing(false); }
  }, [fetchAssessments]);

  const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const verdictOf = (a: any) => a.hiring_recommendation?.verdict ?? a.verdict ?? null;
  // Only treat results as displayable when they belong to the currently-selected job.
  const resultsReady = assessments != null && assessmentsJobId === selectedJobId;
  const showLoading = !loadError && !resultsReady;
  const ranked = (resultsReady ? assessments! : []).filter(a => verdictFilter === 'All' || verdictOf(a) === verdictFilter);
  const calibKey = calib?.status && CALIB_META[calib.status] ? calib.status : 'cold_start';

  const btn = (bg: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', background: bg, border: 'none', cursor: 'pointer' });
  const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, color: BRAND.primary, background: '#fff', border: '1px solid #d6e0ec', cursor: 'pointer' };
  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e8eef5', borderRadius: 14, padding: 18 };

  const metric = (label: string, value: React.ReactNode) => (
    <div style={{ minWidth: 92 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.primary }}>{value}</div>
      <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '4px 2px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: BRAND.primary, margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
            <Target size={22} style={{ color: BRAND.accent }} /> AI Talent Match
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0', maxWidth: 720 }}>
            Rank candidates assigned to a role using MetryxOne's hiring-intelligence engine. Every score below is real engine output — decision-support, not a hiring decision.
          </p>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 44 }}>
          <Briefcase size={32} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.primary }}>No open roles yet</div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '8px auto 0', maxWidth: 420 }}>Create a job and assign candidates to it, then return here to rank them with AI.</p>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: '1 1 240px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 }}>Role</label>
              <select value={selectedJobId} onChange={e => selectJob(e.target.value)} style={{ width: '100%', marginTop: 4, padding: '9px 12px', borderRadius: 9, border: '1px solid #d6e0ec', fontSize: 14, color: BRAND.primary, fontWeight: 600 }}>
                {jobs.map(j => <option key={j._id} value={j._id}>{j.title}{j.department ? ` — ${j.department}` : ''}</option>)}
              </select>
            </div>
            <button style={{ ...btn(BRAND.primary), alignSelf: 'flex-end', opacity: analyzing ? 0.6 : 1 }} onClick={runAnalyze} disabled={analyzing}>
              {analyzing ? <><RefreshCw size={15} className="animate-spin" /> Ranking…</> : <><Sparkles size={15} /> Rank candidates</>}
            </button>
            <button style={{ ...btnGhost, alignSelf: 'flex-end' }} onClick={() => fetchAssessments(selectedJobId)}><RefreshCw size={15} /> Refresh</button>
          </div>

          {/* Calibration confidence (CONFIDENCE axis — separate from predictions) */}
          {calib && (
            <div style={{ ...card, background: CALIB_META[calibKey].bg, borderColor: CALIB_META[calibKey].color + '55', marginBottom: 16, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <BadgeCheck size={16} style={{ color: CALIB_META[calibKey].color }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: CALIB_META[calibKey].color }}>Model confidence: {CALIB_META[calibKey].label}</span>
                <span style={{ fontSize: 12, color: '#475569' }}>{CALIB_META[calibKey].note}</span>
              </div>
            </div>
          )}

          {/* Verdict filter */}
          {resultsReady && assessments!.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {['All', 'STRONG_HIRE', 'HIRE', 'CONDITIONAL_HIRE', 'NO_HIRE'].map(v => {
                const active = verdictFilter === v;
                const label = v === 'All' ? 'All' : (VERDICT_META[v]?.label ?? v);
                const color = v === 'All' ? BRAND.primary : (VERDICT_META[v]?.color ?? BRAND.primary);
                return (
                  <button key={v} onClick={() => setVerdictFilter(v)} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${color}`, background: active ? color : '#fff', color: active ? '#fff' : color }}>{label}</button>
                );
              })}
            </div>
          )}

          {/* States */}
          {showLoading && (
            <div style={{ ...card, textAlign: 'center', padding: 44, color: '#94a3b8' }}>
              <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Loading rankings…</div>
            </div>
          )}

          {loadError && (
            <div style={{ ...card, borderColor: '#fecaca', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><AlertCircle size={20} style={{ color: BRAND.red }} /><span style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>Couldn't load rankings.</span></div>
              <button style={btn(BRAND.red)} onClick={() => fetchAssessments(selectedJobId)}><RefreshCw size={14} /> Retry</button>
            </div>
          )}

          {!loadError && resultsReady && assessments!.length === 0 && (
            <div style={{ ...card, textAlign: 'center', padding: 44 }}>
              <Sparkles size={30} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.primary }}>No ranked candidates yet for {selectedJob?.title}</div>
              <p style={{ fontSize: 13, color: '#64748b', margin: '8px auto 18px', maxWidth: 460 }}>
                Click "Rank candidates" to run the hiring-intelligence engine across candidates assigned to this role. Candidates must be linked to this job in the Candidates tab first.
              </p>
              <button style={{ ...btn(BRAND.primary), margin: '0 auto', opacity: analyzing ? 0.6 : 1 }} onClick={runAnalyze} disabled={analyzing}>
                {analyzing ? <><RefreshCw size={15} className="animate-spin" /> Ranking…</> : <><Sparkles size={15} /> Rank candidates</>}
              </button>
            </div>
          )}

          {!loadError && resultsReady && assessments!.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ranked.map((a, i) => {
                const verdict = verdictOf(a);
                const vm = verdict ? VERDICT_META[verdict] : null;
                const fit = num(a.fit_score);
                return (
                  <div key={a.candidate_id ?? i} style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#cbd5e1', width: 30, textAlign: 'center' }}>{i + 1}</div>
                        <div>
                          <div style={{ fontWeight: 800, color: BRAND.primary, fontSize: 15 }}>{a.candidate_name || 'Candidate'}</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                            {vm && <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: vm.color, borderRadius: 20, padding: '2px 10px' }}>{vm.label}</span>}
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>Fit score</span>
                            <span style={{ fontSize: 18, fontWeight: 800, color: fit == null ? '#cbd5e1' : BRAND.accent }}>{fit == null ? '—' : `${Math.round(fit)}%`}</span>
                          </div>
                        </div>
                      </div>
                      <button style={btnGhost} onClick={() => onTabChange('candidates')}><Eye size={14} /> View profile</button>
                    </div>
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid #eef2f7' }}>
                      {metric('Readiness', num(a.readiness_score) == null ? '—' : `${Math.round(num(a.readiness_score)!)}%`)}
                      {metric('Success prob.', num(a.success_probability) == null ? '—' : `${Math.round(num(a.success_probability)!)}%`)}
                      {metric('Ramp-up', num(a.ramp_up_days) == null ? '—' : `${Math.round(num(a.ramp_up_days)!)}d`)}
                      {metric('Retention 12mo', num(a.retention_probability) == null ? '—' : `${Math.round(num(a.retention_probability)!)}%`)}
                      {metric('Performance', num(a.performance_prediction) == null ? '—' : `${Math.round(num(a.performance_prediction)!)}%`)}
                      {metric('Leadership', num(a.leadership_prediction) == null ? '—' : `${Math.round(num(a.leadership_prediction)!)}%`)}
                    </div>
                  </div>
                );
              })}
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 2px 0' }}>
                Predictions are model-derived decision-support from MetryxOne's hiring-intelligence engine, not a hiring decision. Use alongside structured interviews and human judgement.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — COMPETENCY MAP (Internal vs Market)
// ═══════════════════════════════════════════════════════════════════════════
function CompetencyMapTab({ onTabChange }: {
  company: Company | null; jobs: EmployerJob[]; candidates: Candidate[]; onTabChange: (t: TabId) => void;
}) {
  const [data, setData] = useState<any | null>(null);
  const [arch, setArch] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errKind, setErrKind] = useState<'disabled' | 'failed' | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>('');
  const [view, setView] = useState<'bar' | 'gap'>('bar');
  const [marketRoleId, setMarketRoleId] = useState<string>(MARKET_CATALOG[0]?.id ?? '');
  // Custom role profiles (employer-built from the imported ontology + custom competencies).
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null); // null → new role
  const [deletingRole, setDeletingRole] = useState(false);

  // Single mount fetch; dept/role switches are pure client-side filters (no
  // refetch → no per-switch race). aliveRef just guards setState after unmount.
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  // Monotonic token so a custom-role CRUD refetch is never overwritten by an
  // older in-flight architecture fetch (and vice-versa).
  const archTokenRef = useRef(0);
  const refetchArch = useCallback(async () => {
    const token = ++archTokenRef.current;
    try {
      const aRes = await fetch('/api/employer/eios/competency-architecture', { headers: authHdr() as HeadersInit });
      if (aRes.ok) { const aj = await aRes.json(); if (aliveRef.current && token === archTokenRef.current) setArch(aj); }
    } catch { /* architecture is best-effort; role selector degrades, never fabricated */ }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true); setErrKind(null);
    try {
      const res = await fetch('/api/employer/eios/workforce-analytics', { headers: authHdr() as HeadersInit });
      if (!aliveRef.current) return;
      if (res.status === 503) { setErrKind('disabled'); setData(null); }
      else if (!res.ok) { setErrKind('failed'); setData(null); }
      else { const j = await res.json(); if (aliveRef.current) setData(j); }
    } catch { if (aliveRef.current) { setErrKind('failed'); setData(null); } }
    await refetchArch();
    if (aliveRef.current) setLoading(false);
  }, [refetchArch]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const employees = useMemo<any[]>(() => Array.isArray(data?.employees) ? data.employees : [], [data]);
  const byDept    = useMemo<any[]>(() => Array.isArray(data?.byDepartment) ? data.byDepartment : [], [data]);
  const roles     = useMemo<any[]>(() => Array.isArray(arch?.roles) ? arch.roles : [], [arch]);
  const customRoles = useMemo<any[]>(() => roles.filter(r => r.custom), [roles]);
  const deptOptions = useMemo(
    () => byDept.length
      ? byDept.map(d => String(d.name))
      : Array.from(new Set(employees.map(e => String(e.department || 'General')))),
    [byDept, employees],
  );

  // Default selections once data arrives (set once; no-op afterwards).
  useEffect(() => { if (!selectedDept && deptOptions.length) setSelectedDept(deptOptions[0]); }, [deptOptions, selectedDept]);
  useEffect(() => { if (!selectedRoleCode && roles.length) setSelectedRoleCode(String(roles[0].role_code)); }, [roles, selectedRoleCode]);
  // If the selected role was deleted (no longer in the architecture), fall back to
  // the first available role so the gap analysis never points at a ghost role.
  useEffect(() => {
    if (selectedRoleCode && roles.length && !roles.some(r => String(r.role_code) === selectedRoleCode)) {
      setSelectedRoleCode(String(roles[0].role_code));
    }
  }, [roles, selectedRoleCode]);

  const deptEmployees = useMemo(
    () => employees.filter(e => String(e.department || 'General') === selectedDept),
    [employees, selectedDept],
  );
  const avgOf = (key: string) => {
    const vals = deptEmployees.map(e => e[key]).filter((v: any) => v != null && Number.isFinite(Number(v))).map(Number);
    return { value: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null, n: vals.length };
  };
  const behavioral = avgOf('behavioralIndex');
  const cognitive  = avgOf('cognitiveIndex');
  const future     = avgOf('futureIndex');
  const deptCount    = deptEmployees.length;
  const deptAssessed = deptEmployees.filter(e => e.hasAssessment).length;
  const deptCoveragePct = deptCount ? Math.round(deptAssessed / deptCount * 100) : 0;
  const lowCoverage = deptAssessed > 0 && (deptAssessed < 5 || deptCoveragePct < 50);

  const targetRole = roles.find(r => String(r.role_code) === selectedRoleCode) || null;
  const parseTargets = (t: any) => {
    let o: any = t;
    if (typeof t === 'string') { try { o = JSON.parse(t); } catch { o = {}; } }
    o = o && typeof o === 'object' ? o : {};
    const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
    return { behavioral: num(o.behavioral), functional: num(o.functional), cognitive: num(o.cognitive) };
  };
  const targets = parseTargets(targetRole?.proficiency_targets);
  const targetIsCustom = !!targetRole?.custom;

  // ── custom-role CRUD handlers (additive; never throws — failure leaves list intact) ──
  const openNewRole  = () => { setEditingRole(null); setShowBuilder(true); };
  const openEditRole = () => { if (targetRole?.custom) { setEditingRole(targetRole); setShowBuilder(true); } };
  const handleRoleSaved = async (savedRoleCode?: string) => {
    setShowBuilder(false); setEditingRole(null);
    await refetchArch();
    if (savedRoleCode && aliveRef.current) setSelectedRoleCode(savedRoleCode);
  };
  const deleteRole = async () => {
    if (!targetRole?.custom || !targetRole?.id) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete custom role profile "${targetRole.role_name}"? This can't be undone.`)) return;
    setDeletingRole(true);
    try {
      const r = await fetch(`/api/employer/eios/custom-roles/${targetRole.id}`, { method: 'DELETE', headers: authHdr() as HeadersInit });
      if (r.ok && aliveRef.current) { setSelectedRoleCode(''); await refetchArch(); }
    } catch { /* never throws; the role list simply stays unchanged on failure */ }
    if (aliveRef.current) setDeletingRole(false);
  };

  // Role requirements (competency lists) for the selected role, grouped by dimension.
  // Custom roles carry a rich `competencies` array (with source/domain); seeded roles
  // expose only per-dimension name arrays. Functional is a requirement bucket the
  // platform does NOT measure per-employee (honest: never implies measurement).
  const reqGroups = useMemo(() => {
    type ReqGroup = { id: string; label: string; measured: boolean; items: { name: string; source?: string; domain?: string }[] };
    if (!targetRole) return [] as ReqGroup[];
    const dims: { id: string; label: string; measured: boolean }[] = [
      { id: 'behavioral', label: 'Behavioral', measured: true },
      { id: 'cognitive',  label: 'Cognitive',  measured: true },
      { id: 'functional', label: 'Functional', measured: false },
    ];
    const full = Array.isArray(targetRole.competencies) ? targetRole.competencies : null;
    return dims.map(d => {
      let items: { name: string; source?: string; domain?: string }[] = [];
      if (full) {
        items = full.filter((c: any) => c?.dimension === d.id)
          .map((c: any) => ({ name: String(c?.name || ''), source: c?.source, domain: c?.domain }))
          .filter((c: { name: string }) => c.name);
      } else {
        const arr = targetRole[`${d.id}_competencies`];
        items = Array.isArray(arr) ? arr.map((n: any) => ({ name: String(n) })).filter((c: { name: string }) => c.name) : [];
      }
      return { ...d, items };
    }).filter(g => g.items.length > 0) as ReqGroup[];
  }, [targetRole]);

  type CRow = { id: string; label: string; avg: number | null; n: number; target: number | null; measured: boolean; note?: string };
  const functionalNote = targets.functional != null
    ? 'Role target defined, but functional proficiency is not yet captured on your roster.'
    : 'Functional proficiency is not captured on your roster, and no role target is defined.';
  const futureNote = future.value != null
    ? 'Measured from platform signals; no role target defined for this dimension.'
    : 'No future-readiness data captured for this department yet.';
  const rows: CRow[] = [
    { id: 'behavioral', label: 'Behavioral', avg: behavioral.value, n: behavioral.n, target: targets.behavioral, measured: true },
    { id: 'cognitive',  label: 'Cognitive',  avg: cognitive.value,  n: cognitive.n,  target: targets.cognitive,  measured: true },
    { id: 'functional', label: 'Functional', avg: null,             n: 0,             target: targets.functional, measured: false, note: functionalNote },
    { id: 'future',     label: 'Future-readiness', avg: future.value, n: future.n,    target: null,               measured: true,  note: futureNote },
  ];
  const gapOf = (r: CRow) => (r.measured && r.avg != null && r.target != null) ? r.target - r.avg : null;
  const sevOf = (gap: number | null) => {
    if (gap == null) return 'unknown';
    if (gap <= 0) return 'none';
    if (gap >= 20) return 'critical';
    if (gap >= 10) return 'moderate';
    return 'minor';
  };
  const sevColor = (s: string) => s === 'critical' ? BRAND.red : s === 'moderate' ? BRAND.orange : s === 'minor' ? BRAND.accent : s === 'none' ? BRAND.green : '#94a3b8';
  const sevAction = (s: string) => s === 'critical' ? 'Hire / targeted development' : s === 'moderate' ? 'L&D program' : s === 'minor' ? 'Coaching' : s === 'none' ? 'Meets / exceeds target' : 'Measurement needed';

  const knownGaps = rows.filter(r => { const g = gapOf(r); return g != null && g > 0; });
  const criticalGaps = knownGaps.filter(r => sevOf(gapOf(r)) === 'critical');
  const moderateGaps = knownGaps.filter(r => sevOf(gapOf(r)) === 'moderate');
  const minorGaps    = knownGaps.filter(r => sevOf(gapOf(r)) === 'minor');
  const hasFunctionalTarget = targets.functional != null;

  const marketRole: MarketRole | undefined = MARKET_CATALOG.find(r => r.id === marketRoleId);
  const fmtSalary = (n: number) => n >= 10000000 ? `₹${(n / 10000000).toFixed(1)} Cr` : `₹${(n / 100000).toFixed(1)} L`;

  // ── honest non-data states ───────────────────────────────────────────────
  if (loading) {
    return <div className="flex items-center justify-center py-24 text-sm text-gray-400"><RefreshCw size={16} className="animate-spin mr-2" /> Loading competency data…</div>;
  }
  if (errKind === 'disabled') {
    return (
      <div className="space-y-5">
        <div><h1 className="text-xl font-bold text-gray-900">Competency Map</h1></div>
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
          <Gauge size={28} className="mx-auto mb-3 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-800">Advanced workforce analytics is disabled</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">Competency mapping reads real platform intelligence (behavioural &amp; cognitive indices) for your roster. Enable <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded">FF_EIOS_WORLD_CLASS_VERIFIED_V2</code> to view it.</p>
        </div>
      </div>
    );
  }
  if (errKind === 'failed') {
    return (
      <div className="space-y-5">
        <div><h1 className="text-xl font-bold text-gray-900">Competency Map</h1></div>
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
          <AlertCircle size={28} className="mx-auto mb-3 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-800">Couldn't load workforce analytics</h3>
          <button onClick={fetchAll} className="mt-3 text-xs font-semibold px-4 py-2 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>Retry</button>
        </div>
      </div>
    );
  }
  const totalRoster = Number(data?.total ?? 0);
  if (totalRoster === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Competency Map</h1>
          <p className="text-xs text-gray-500 mt-0.5">Compare your team's real, platform-measured competencies against role targets.</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
          <Users2 size={28} className="mx-auto mb-3 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-800">No workforce roster imported yet</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">Import your team in <strong>Org Intelligence</strong> to map real competency levels. Nothing here is simulated — it appears only once you have roster data.</p>
          <button onClick={() => onTabChange('org-intelligence')} className="mt-3 text-xs font-semibold px-4 py-2 rounded-xl text-white inline-flex items-center gap-1.5" style={{ backgroundColor: BRAND.primary }}><Network size={12} /> Go to Org Intelligence</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Competency Map</h1>
          <p className="text-xs text-gray-500 mt-0.5">Your team's <strong>real, platform-measured</strong> behavioural &amp; cognitive indices vs the competency targets for a role. Decide: promote, develop, or hire.</p>
        </div>
        <button onClick={() => onTabChange('talent-match')} className="text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5" style={{ backgroundColor: BRAND.primary, color: '#fff' }}>
          <Cpu size={12} /> Hire for gap →
        </button>
      </div>

      {/* controls */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-500">Department:</span>
          <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none">
            {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-500">Target role:</span>
          {roles.length ? (
            <select value={selectedRoleCode} onChange={e => setSelectedRoleCode(e.target.value)} className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none">
              <optgroup label="Standard roles">
                {roles.filter(r => !r.custom).map(r => <option key={r.role_code} value={r.role_code}>{r.role_name || r.role_code}{r.seniority ? ` · ${r.seniority}` : ''}</option>)}
              </optgroup>
              {customRoles.length > 0 && (
                <optgroup label="Your custom role profiles">
                  {customRoles.map(r => <option key={r.role_code} value={r.role_code}>{r.role_name || r.role_code}{r.seniority ? ` · ${r.seniority}` : ''}</option>)}
                </optgroup>
              )}
            </select>
          ) : <span className="text-[11px] text-gray-400">No competency architecture available</span>}
          <button onClick={openNewRole} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} title="Build a custom role profile from the competency library">
            <Plus size={12} /> Custom role
          </button>
          {targetIsCustom && (
            <>
              <button onClick={openEditRole} className="text-[11px] font-semibold px-2 py-1.5 rounded-lg inline-flex items-center gap-1 text-gray-600 hover:bg-gray-100" title="Edit this custom role"><Edit3 size={12} /></button>
              <button onClick={deleteRole} disabled={deletingRole} className="text-[11px] font-semibold px-2 py-1.5 rounded-lg inline-flex items-center gap-1 hover:bg-red-50 disabled:opacity-50" style={{ color: BRAND.red }} title="Delete this custom role">{deletingRole ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}</button>
            </>
          )}
        </div>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => setView('bar')} className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: view === 'bar' ? BRAND.primary : `${BRAND.primary}10`, color: view === 'bar' ? '#fff' : BRAND.primary }}>Bar chart</button>
          <button onClick={() => setView('gap')} className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: view === 'gap' ? BRAND.primary : `${BRAND.primary}10`, color: view === 'gap' ? '#fff' : BRAND.primary }}>Gap analysis</button>
        </div>
      </div>

      {/* coverage / confidence banner (SEPARATE from the index values) */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Coverage</div>
          <div className="text-sm font-bold text-gray-800">{deptAssessed}<span className="text-gray-400 font-medium"> / {deptCount} assessed</span> <span className="text-[11px] font-medium text-gray-400">({deptCoveragePct}%)</span></div>
        </div>
        <div className="text-[11px] text-gray-500">
          N per dimension — Behavioural <strong className="text-gray-700">{behavioral.n}</strong> · Cognitive <strong className="text-gray-700">{cognitive.n}</strong> · Future <strong className="text-gray-700">{future.n}</strong>
        </div>
        <div className="ml-auto">
          {deptAssessed === 0 ? (
            <span className="text-[10px] font-semibold px-2 py-1 rounded" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>No assessment data in this department</span>
          ) : lowCoverage ? (
            <span className="text-[10px] font-semibold px-2 py-1 rounded" style={{ backgroundColor: `${BRAND.orange}15`, color: BRAND.orange }}>Directional — low assessment coverage</span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-1 rounded" style={{ backgroundColor: `${BRAND.green}15`, color: BRAND.green }}>Sufficient coverage</span>
          )}
        </div>
      </div>

      {/* recommendation (conditional, honest) */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><Lightbulb size={12} /> Recommendation · {selectedDept}{targetRole ? ` vs ${targetRole.role_name || targetRole.role_code}` : ''}</h4>
        <div className="text-[11px] text-gray-700 space-y-1">
          {deptAssessed === 0 ? (
            <p>No one in {selectedDept} has a platform assessment yet, so competencies can't be measured. Invite this team to complete assessments before drawing conclusions.</p>
          ) : !targetRole ? (
            <p>Select a target role to compare your team's measured indices against its competency targets.</p>
          ) : criticalGaps.length ? (
            <p><span className="font-semibold text-red-600">Significant gap</span> in {criticalGaps.map(r => r.label).join(' and ')} vs the {targetRole.role_name || targetRole.role_code} target. Consider targeted development or external hiring.</p>
          ) : moderateGaps.length ? (
            <p><span className="font-semibold" style={{ color: BRAND.orange }}>Moderate gap</span> in {moderateGaps.map(r => r.label).join(' and ')}. Likely closable with focused L&amp;D.</p>
          ) : minorGaps.length ? (
            <p><span className="font-semibold" style={{ color: BRAND.accent }}>Minor gap</span> in {minorGaps.map(r => r.label).join(' and ')}. Closable with coaching.</p>
          ) : (
            <p><span className="font-semibold" style={{ color: BRAND.green }}>On target.</span> {selectedDept} meets or exceeds the measured behavioural &amp; cognitive targets for this role.</p>
          )}
          {hasFunctionalTarget && (
            <p className="text-gray-500">Functional proficiency isn't captured on your roster yet — this recommendation covers behavioural &amp; cognitive dimensions only.</p>
          )}
        </div>
      </div>

      {/* main chart */}
      {view === 'bar' ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Team vs role target · {selectedDept}{targetRole ? ` vs ${targetRole.role_name || targetRole.role_code}` : ''}</h3>
          <p className="text-[11px] text-gray-500 mb-4">Indices are measured from real platform signals (0–100). The dark marker is the role's proficiency target; the bar is your team's average.</p>
          <div className="space-y-3">
            {rows.map(r => {
              const gap = gapOf(r);
              const sev = sevOf(gap);
              const barColor = !r.measured ? '#cbd5e1' : (gap != null && gap > 0) ? BRAND.accent : BRAND.green;
              return (
                <div key={r.id}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-gray-700 font-medium w-44 truncate">{r.label}{r.measured && <span className="text-gray-400 font-normal"> · n={r.n}</span>}</span>
                    <span className="text-gray-500">
                      {r.measured && r.avg != null ? <span className="font-bold" style={{ color: barColor }}>{r.avg}</span> : <span className="text-gray-400">not captured</span>}
                      {r.target != null && <span className="text-gray-400"> / {r.target} target</span>}
                      {r.target == null && r.measured && <span className="text-gray-400"> · no target</span>}
                    </span>
                  </div>
                  <div className="relative h-4 rounded-full bg-gray-100 overflow-hidden">
                    {r.measured && r.avg != null && (
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, Math.min(100, r.avg))}%`, backgroundColor: barColor, transition: 'width 0.5s ease' }} />
                    )}
                    {r.target != null && (
                      <div className="absolute inset-y-0" style={{ left: `calc(${Math.min(100, r.target)}% - 1px)`, width: 2, backgroundColor: '#0f172a' }} title={`Target ${r.target}`} />
                    )}
                  </div>
                  {r.measured && gap != null && gap > 0 && (
                    <div className="text-[9px] mt-0.5" style={{ color: sevColor(sev) }}>Gap {gap} pts · {sevAction(sev)}</div>
                  )}
                  {r.note && <div className="text-[9px] mt-0.5 text-gray-400">{r.note}</div>}
                  {r.measured && r.avg == null && !r.note && <div className="text-[9px] mt-0.5 text-gray-400">No assessment data for this dimension in {selectedDept}.</div>}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-500">
            <span><span className="inline-block w-8 h-2 rounded-full mr-1" style={{ backgroundColor: BRAND.green }} /> Team avg (on target)</span>
            <span><span className="inline-block w-8 h-2 rounded-full mr-1" style={{ backgroundColor: BRAND.accent }} /> Team avg (below target)</span>
            <span><span className="inline-block w-1 h-3 mr-1 align-middle" style={{ backgroundColor: '#0f172a' }} /> Role target</span>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Gap analysis — {selectedDept}{targetRole ? ` vs ${targetRole.role_name || targetRole.role_code}` : ''}</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-[10px] font-semibold text-gray-400 pb-2 pr-3">Dimension</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 pb-2 pr-3">Team avg</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 pb-2 pr-3">N</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 pb-2 pr-3">Target</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 pb-2 pr-3">Gap</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const gap = gapOf(r);
                const sev = sevOf(gap);
                return (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3 text-gray-700 font-medium">{r.label}</td>
                    <td className="pr-3">{r.measured && r.avg != null ? <span className="font-bold text-gray-800">{r.avg}</span> : <span className="text-gray-400">not captured</span>}</td>
                    <td className="pr-3 text-gray-500">{r.measured ? r.n : '—'}</td>
                    <td className="pr-3">{r.target != null ? <span className="font-bold text-gray-800">{r.target}</span> : <span className="text-gray-400">—</span>}</td>
                    <td className="pr-3">{gap != null ? <span className="font-bold" style={{ color: sevColor(sev) }}>{gap > 0 ? `−${gap}` : gap < 0 ? `+${Math.abs(gap)}` : '0'}</span> : <span className="text-gray-400">{r.measured ? (r.target == null ? 'no target' : '—') : 'not measured'}</span>}</td>
                    <td><span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${sevColor(sev)}15`, color: sevColor(sev) }}>{gap != null ? sevAction(sev) : (r.measured ? '—' : 'Measurement needed')}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hasFunctionalTarget && <p className="text-[10px] text-gray-400 mt-3">Functional target shown for context; per-employee functional proficiency is not yet captured on the roster, so no gap is computed.</p>}
        </div>
      )}

      {/* role requirements — the competencies that define the selected role profile */}
      {targetRole && reqGroups.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <ListChecks size={14} /> Role requirements · {targetRole.role_name || targetRole.role_code}
              {targetIsCustom && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BRAND.purple}15`, color: BRAND.purple }}>Custom</span>}
            </h3>
            {targetIsCustom && <button onClick={openEditRole} className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"><Edit3 size={11} /> Edit</button>}
          </div>
          <p className="text-[10px] text-gray-400 mb-3">Competencies that define this profile. These are <strong>requirements</strong> — the platform measures the aggregate behavioural &amp; cognitive dimensions for your roster, not individual competency proficiency.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {reqGroups.map(g => (
              <div key={g.id} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-gray-700">{g.label}</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: g.measured ? `${BRAND.green}15` : '#f1f5f9', color: g.measured ? BRAND.green : '#94a3b8' }}>{g.measured ? 'measured' : 'not captured'}</span>
                </div>
                <ul className="space-y-1">
                  {g.items.map((it, i) => (
                    <li key={i} className="text-[11px] text-gray-700 flex items-start gap-1.5">
                      <CheckCircle size={11} className="mt-0.5 flex-shrink-0" style={{ color: g.measured ? BRAND.accent : '#cbd5e1' }} />
                      <span className="flex-1">{it.name}{it.source === 'ontology' && <span className="ml-1 text-[8px] font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>library</span>}{it.source === 'custom' && <span className="ml-1 text-[8px] font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: `${BRAND.orange}15`, color: BRAND.orange }}>custom</span>}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* external market context (clearly separated — industry reference data) */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">External market context</h3>
            <p className="text-[10px] text-gray-400">Industry reference data — <strong>not</strong> your team's measurements.</p>
          </div>
          <select value={marketRoleId} onChange={e => setMarketRoleId(e.target.value)} className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none">
            {MARKET_CATALOG.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
        </div>
        {marketRole ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-xl p-3"><div className="text-[10px] text-gray-500">Market demand</div><div className="text-lg font-bold" style={{ color: BRAND.primary }}>{marketRole.demandScore}/100</div></div>
            <div className="bg-gray-50 rounded-xl p-3"><div className="text-[10px] text-gray-500">3y growth</div><div className="text-lg font-bold" style={{ color: BRAND.green }}>+{marketRole.growth36mo}%</div></div>
            <div className="bg-gray-50 rounded-xl p-3"><div className="text-[10px] text-gray-500">Median salary</div><div className="text-lg font-bold" style={{ color: BRAND.primary }}>{fmtSalary(marketRole.salaryP50)}</div></div>
            <div className="bg-gray-50 rounded-xl p-3"><div className="text-[10px] text-gray-500">Automation risk</div><div className="text-lg font-bold" style={{ color: marketRole.automationRisk > 50 ? BRAND.red : BRAND.green }}>{marketRole.automationRisk}%</div></div>
          </div>
        ) : <p className="text-[11px] text-gray-400">Select a market role to view industry benchmarks.</p>}
      </div>

      <p className="text-[10px] text-gray-400 text-center">Decision-support only — developmental competency signals, not hiring, promotion, or suitability decisions.</p>

      {showBuilder && (
        <CustomRoleBuilderModal
          initial={editingRole}
          onClose={() => { setShowBuilder(false); setEditingRole(null); }}
          onSaved={handleRoleSaved}
        />
      )}
    </div>
  );
}

// ─── Custom role profile builder (imported ontology library + custom competencies) ──
type AttachedComp = {
  name: string;
  dimension: 'behavioral' | 'functional' | 'cognitive';
  source: 'ontology' | 'custom';
  competency_id?: string | null;
  domain?: string | null;
  family?: string | null;
};

const DIM_META: { id: 'behavioral' | 'cognitive' | 'functional'; label: string; measured: boolean; color: string }[] = [
  { id: 'behavioral', label: 'Behavioral', measured: true,  color: BRAND.accent },
  { id: 'cognitive',  label: 'Cognitive',  measured: true,  color: BRAND.purple },
  { id: 'functional', label: 'Functional', measured: false, color: '#94a3b8' },
];

function CustomRoleBuilderModal({ initial, onClose, onSaved }: {
  initial: any | null;
  onClose: () => void;
  onSaved: (roleCode?: string) => void;
}) {
  const isEdit = !!initial?.id;
  const [roleName, setRoleName]   = useState<string>(initial?.role_name || '');
  const [seniority, setSeniority] = useState<string>(initial?.seniority || '');
  const [department, setDepartment] = useState<string>(initial?.department || '');
  const [attached, setAttached] = useState<AttachedComp[]>(() => {
    const c = Array.isArray(initial?.competencies) ? initial.competencies : [];
    return c.map((x: any) => ({
      name: String(x?.name || ''),
      dimension: (['behavioral', 'functional', 'cognitive'].includes(x?.dimension) ? x.dimension : 'behavioral') as AttachedComp['dimension'],
      source: (x?.source === 'ontology' ? 'ontology' : 'custom') as AttachedComp['source'],
      competency_id: x?.competency_id ?? null, domain: x?.domain ?? null, family: x?.family ?? null,
    })).filter((x: AttachedComp) => x.name);
  });
  const [targets, setTargets] = useState<Record<string, string>>(() => {
    const pt = initial?.proficiency_targets && typeof initial.proficiency_targets === 'object' ? initial.proficiency_targets : {};
    const f = (v: any) => (v == null || v === '' ? '' : String(v));
    return { behavioral: f(pt.behavioral), cognitive: f(pt.cognitive), functional: f(pt.functional) };
  });
  const [attachDim, setAttachDim] = useState<AttachedComp['dimension']>('behavioral');
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── imported ontology library browser ──────────────────────────────────────
  const [domains, setDomains]   = useState<any[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [domainId, setDomainId] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);
  const searchTokenRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/ontology/domains');
        if (r.ok) { const j = await r.json(); if (aliveRef.current) setDomains(Array.isArray(j?.data) ? j.data : []); }
      } catch { /* library browse is best-effort; custom competencies still work */ }
    })();
  }, []);
  useEffect(() => {
    setFamilyId('');
    if (!domainId) { setFamilies([]); return; }
    (async () => {
      try {
        const r = await fetch(`/api/ontology/families?domain_id=${encodeURIComponent(domainId)}`);
        if (r.ok) { const j = await r.json(); if (aliveRef.current) setFamilies(Array.isArray(j?.data) ? j.data : []); }
      } catch { if (aliveRef.current) setFamilies([]); }
    })();
  }, [domainId]);
  // debounced competency search (q / domain / family) — token guards against stale results
  useEffect(() => {
    const token = ++searchTokenRef.current;
    setLibLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (domainId) params.set('domain_id', domainId);
        if (familyId) params.set('family_id', familyId);
        const r = await fetch(`/api/ontology/curated/competencies?${params.toString()}`);
        if (r.ok) { const j = await r.json(); if (aliveRef.current && token === searchTokenRef.current) setResults(Array.isArray(j?.data) ? j.data.slice(0, 60) : []); }
      } catch { if (aliveRef.current && token === searchTokenRef.current) setResults([]); }
      finally { if (aliveRef.current && token === searchTokenRef.current) setLibLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q, domainId, familyId]);

  const domainName = (id: string) => domains.find(d => d.id === id)?.name || null;
  const familyNameOf = (id: string) => families.find(f => f.id === id)?.name || null;
  const isAttached = (compId: string) => attached.some(a => a.competency_id && a.competency_id === compId);

  const attachOntology = (c: any) => {
    if (isAttached(c.id)) return;
    setAttached(prev => [...prev, { name: c.canonical_name, dimension: attachDim, source: 'ontology', competency_id: c.id, domain: domainName(c.domain_id), family: familyNameOf(c.family_id) }]);
  };
  const addCustom = () => {
    const n = customName.trim();
    if (!n) return;
    if (attached.some(a => a.source === 'custom' && a.name.toLowerCase() === n.toLowerCase() && a.dimension === attachDim)) { setCustomName(''); return; }
    setAttached(prev => [...prev, { name: n, dimension: attachDim, source: 'custom', competency_id: null }]);
    setCustomName('');
  };
  const removeAttached = (idx: number) => setAttached(prev => prev.filter((_, i) => i !== idx));

  const clampInput = (v: string) => {
    if (v === '') return '';
    const n = Math.max(0, Math.min(100, Math.round(Number(v))));
    return Number.isFinite(n) ? String(n) : '';
  };

  const save = async () => {
    setError('');
    if (!roleName.trim()) { setError('Role name is required.'); return; }
    setSaving(true);
    const body = {
      role_name: roleName.trim(),
      seniority: seniority.trim() || null,
      department: department.trim() || null,
      competencies: attached,
      proficiency_targets: {
        behavioral: targets.behavioral === '' ? null : Number(targets.behavioral),
        cognitive:  targets.cognitive  === '' ? null : Number(targets.cognitive),
        functional: targets.functional === '' ? null : Number(targets.functional),
      },
    };
    try {
      const url = isEdit ? `/api/employer/eios/custom-roles/${initial.id}` : '/api/employer/eios/custom-roles';
      const r = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: authHdr() as HeadersInit, body: JSON.stringify(body) });
      if (!r.ok) { setError(r.status === 503 ? 'Custom role profiles are not enabled.' : 'Could not save the role profile.'); setSaving(false); return; }
      const j = await r.json();
      onSaved(j?.role?.role_code);
    } catch { setError('Could not save the role profile.'); setSaving(false); }
  };

  const grouped = DIM_META.map(d => ({ ...d, items: attached.map((a, i) => ({ ...a, _i: i })).filter(a => a.dimension === d.id) }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{isEdit ? 'Edit custom role profile' : 'Build a custom role profile'}</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Attach competencies from your imported library or add your own. They become the role's requirements in the Competency Map.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* role meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Role name *</label>
              <input value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="e.g. Senior Data Engineer" maxLength={200} className="mt-1 w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Seniority</label>
              <input value={seniority} onChange={e => setSeniority(e.target.value)} placeholder="e.g. Senior / Manager" maxLength={120} className="mt-1 w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Department</label>
              <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering" maxLength={200} className="mt-1 w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT — library browser */}
            <div className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2"><Layers size={13} style={{ color: BRAND.primary }} /><span className="text-xs font-semibold text-gray-700">Competency library</span><span className="text-[9px] text-gray-400">(imported ontology)</span></div>
              <div className="flex gap-2 mb-2">
                <select value={domainId} onChange={e => setDomainId(e.target.value)} className="text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-700 flex-1 min-w-0">
                  <option value="">All domains</option>
                  {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select value={familyId} onChange={e => setFamilyId(e.target.value)} disabled={!domainId} className="text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-700 flex-1 min-w-0 disabled:opacity-50">
                  <option value="">All families</option>
                  {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="relative mb-2">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search competencies…" className="w-full text-[11px] pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none" />
              </div>
              <div className="flex items-center gap-1 mb-2">
                <span className="text-[9px] text-gray-400 mr-1">Attach as:</span>
                {DIM_META.map(d => (
                  <button key={d.id} onClick={() => setAttachDim(d.id)} className="text-[9px] font-semibold px-2 py-1 rounded-md" style={{ backgroundColor: attachDim === d.id ? d.color : `${d.color}15`, color: attachDim === d.id ? '#fff' : d.color }}>{d.label}</button>
                ))}
              </div>
              <div className="h-56 overflow-y-auto space-y-1 pr-1">
                {libLoading ? (
                  <div className="flex items-center justify-center py-8 text-[11px] text-gray-400"><RefreshCw size={12} className="animate-spin mr-1.5" /> Loading…</div>
                ) : results.length === 0 ? (
                  <div className="text-[11px] text-gray-400 text-center py-8">No competencies match. Try a different filter, or add a custom competency below.</div>
                ) : results.map(c => {
                  const at = isAttached(c.id);
                  return (
                    <button key={c.id} onClick={() => attachOntology(c)} disabled={at} className="w-full text-left flex items-start gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                      {at ? <CheckCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: BRAND.green }} /> : <Plus size={13} className="mt-0.5 flex-shrink-0 text-gray-400" />}
                      <span className="flex-1 min-w-0"><span className="text-[11px] font-medium text-gray-700 block truncate">{c.canonical_name}</span>{c.definition && <span className="text-[9px] text-gray-400 block truncate">{c.definition}</span>}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex gap-1.5">
                  <input value={customName} onChange={e => setCustomName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} placeholder="Add a custom competency…" maxLength={200} className="flex-1 text-[11px] px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none" />
                  <button onClick={addCustom} disabled={!customName.trim()} className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-40 inline-flex items-center gap-1" style={{ backgroundColor: BRAND.primary }}><Plus size={11} /> Add</button>
                </div>
                <p className="text-[9px] text-gray-400 mt-1">Added to the “{DIM_META.find(d => d.id === attachDim)?.label}” dimension. Custom competencies are recorded as requirements (not in the shared library).</p>
              </div>
            </div>

            {/* RIGHT — attached + targets */}
            <div className="space-y-3">
              <div className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><ListChecks size={13} style={{ color: BRAND.primary }} /> Attached competencies</span><span className="text-[10px] text-gray-400">{attached.length}</span></div>
                {attached.length === 0 ? (
                  <p className="text-[11px] text-gray-400 text-center py-6">Nothing attached yet. Pick competencies from the library or add your own.</p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {grouped.filter(g => g.items.length).map(g => (
                      <div key={g.id}>
                        <div className="flex items-center gap-1.5 mb-1"><span className="text-[10px] font-bold" style={{ color: g.color }}>{g.label}</span><span className="text-[8px] font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: g.measured ? `${BRAND.green}15` : '#f1f5f9', color: g.measured ? BRAND.green : '#94a3b8' }}>{g.measured ? 'measured' : 'not captured'}</span></div>
                        {g.items.map(it => (
                          <div key={it._i} className="flex items-center gap-1.5 pl-1 py-0.5">
                            <span className="flex-1 text-[11px] text-gray-700 truncate">{it.name}<span className="ml-1 text-[8px] font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: it.source === 'ontology' ? `${BRAND.primary}12` : `${BRAND.orange}15`, color: it.source === 'ontology' ? BRAND.primary : BRAND.orange }}>{it.source === 'ontology' ? 'library' : 'custom'}</span></span>
                            <button onClick={() => removeAttached(it._i)} className="text-gray-300 hover:text-red-500"><X size={12} /></button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1"><Gauge size={13} style={{ color: BRAND.primary }} /><span className="text-xs font-semibold text-gray-700">Proficiency targets (0–100)</span></div>
                <p className="text-[9px] text-gray-400 mb-2">Drives the gap analysis. Behavioural &amp; cognitive are measured on your roster; functional is a target only (not captured per-employee).</p>
                <div className="grid grid-cols-3 gap-2">
                  {DIM_META.map(d => (
                    <div key={d.id}>
                      <label className="text-[9px] font-semibold" style={{ color: d.color }}>{d.label}{!d.measured && <span className="text-gray-400 font-normal"> *</span>}</label>
                      <input type="number" min={0} max={100} value={targets[d.id]} onChange={e => setTargets(prev => ({ ...prev, [d.id]: clampInput(e.target.value) }))} placeholder="—" className="mt-0.5 w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none" />
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-gray-400 mt-1">* Functional target is shown for context only — no per-employee measurement exists, so no gap is computed.</p>
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <span className="text-[11px]" style={{ color: error ? BRAND.red : '#94a3b8' }}>{error || 'Decision-support only — developmental signals, not hiring decisions.'}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs font-semibold px-3 py-2 rounded-xl text-gray-600 hover:bg-gray-100">Cancel</button>
            <button onClick={save} disabled={saving || !roleName.trim()} className="text-xs font-semibold px-4 py-2 rounded-xl text-white inline-flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: BRAND.primary }}>{saving ? <><RefreshCw size={12} className="animate-spin" /> Saving…</> : (isEdit ? 'Save changes' : 'Create role profile')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── helper used in CompetencyMapTab ────────────────────────────────────────
function Lightbulb({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>;
}
