import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FresherHubTab } from './career/FresherHubTab';
import { SimulationsTab } from './career/SimulationsTab';
import { MarketIntelTab } from './career/MarketIntelTab';
import { CareerVelocityTab } from './career/CareerVelocityTab';
import { WorkforceTab } from './career/WorkforceTab';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import type { Screen } from '../App';
import {
  User, Briefcase, Target, BookOpen, Star, Award, Code, Wrench,
  Heart, BarChart3, TrendingUp, CheckCircle, Circle, Plus, X, Edit3,
  MapPin, Mail, Phone, Linkedin, Github, Globe, FileText, ChevronRight,
  ChevronLeft, ChevronDown, ChevronUp, Trash2, ExternalLink, Download, Sparkles,
  GraduationCap, FolderOpen, Languages, AlertCircle, Clock, Calendar,
  Send, Zap, Flame, Brain, Shield, Users, MessageSquare, ArrowRight,
  Search, Filter, MoreHorizontal, Building2, DollarSign, Activity,
  PieChart, Lightbulb, Flag, CheckSquare, Square, Settings, Bell,
  LogOut, TrendingDown, Minus, RefreshCw, Upload, Eye, Bookmark,
  ClipboardList, Trophy, Percent, Gauge, BookMarked, Info,
  CalendarCheck, Rocket, History, Network, Route, Layers, ArrowUpRight, ShieldCheck, Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  recommendFutureRoles, rankJobsForUser, computeVisibility, estimateRecruiterViews,
  inferCompetencyLevels, buildIDP, detectCurrentRole, computeFitment, switchability,
  type FutureRoleRec, type RankedJob, type IDPItem, type BehaviorContext,
} from '@/lib/careerIntelligence';
import { MARKET_CATALOG, COMPETENCY_DOMAINS, findRoleById, type MarketRole } from '@/data/marketCatalog';
import { INTERVENTION_LABELS } from '@/data/interventionCatalog';
import { EIGauge, SectionCard, SkillBar, Chip } from '@/components/career';
import { PassportOwnerModal } from '@/components/passport/EmployabilityPassport';
import FitmentInsightsPanel from '@/components/career/FitmentInsightsPanel';
import {
  listCustomRoles, addCustomRole, removeCustomRole,
  listCustomIndustries, addCustomIndustry, removeCustomIndustry,
  type CustomEntry,
} from '@/lib/customEntries';
import { AssessmentCombobox, type ComboItem } from '@/components/career/AssessmentCombobox';
import {
  loadRoleOptions, loadIndustryOptions, loadAdjacentRoles, findRoleIdByTitle, fuzzyMatchTitle, STAGE_OPTIONS,
  type RoleOption, type IndustryOption, type AdjacentRole,
  suggestTargetRolesFromCatalog,
  findRoleByTitle,
} from '@/lib/services/assessmentOptionsService';
import { useCompetencyRuntimeStore } from '@/lib/stores/competencyRuntimeStore';
import ResumeStudio from '@/components/career/ResumeStudio';
import { EIProvenanceCard } from '@/components/career/EIProvenanceCard';
import { WeeklyActionPlanTab, NextBestActionsTab, BehavioralGrowthTab, CareerMemoryTab } from '@/components/career';
import CareerGraphTab from '@/components/career/CareerGraphTab';
import MEIDashboard from '@/components/career/MEIDashboard';
import CareerRecommendationsTab from '@/components/career/CareerRecommendationsTab';
import LearningIntelligenceTab from '@/components/career/LearningIntelligenceTab';
import FutureReadinessTab from '@/components/career/FutureReadinessTab';
import HiringReadinessTab from '@/components/career/HiringReadinessTab';
import PredictionTrustTab from '@/components/career/PredictionTrustTab';
import MyWorkforcePanel from '@/components/career/MyWorkforcePanel';
import CareerPassportTab from '@/components/career/CareerPassportTab';
import LBIDashboard from '@/components/career/LBIDashboard';
import CareerTracksPanel from '@/components/career/CareerTracksPanel';
import PromotionPathsPanel from '@/components/career/PromotionPathsPanel';
import { PathwayExplorerPanel } from '@/components/career/PathwayExplorerPanel';
import { ForecastDashboard } from '@/components/career/ForecastDashboard';
import { GrowthRoadmap } from '@/components/career/GrowthRoadmap';
import { RecommendationHistory } from '@/components/career/RecommendationHistory';
import { WhatIfAnalysis } from '@/components/career/WhatIfAnalysis';
import CareerIntelligenceHub from '@/components/career/CareerIntelligenceHub';
import { useCareerBrain } from '@/lib/services/useCareerBrain';
import { useHybridEI } from '@/lib/hooks/useHybridEI';
import { useStageGuidance } from '@/hooks/useStageGuidance';
import { useBehaviouralIntelligence, type SignalScore as BISignalScore, type ContradictionFlag as BIContradictionFlag } from '@/hooks/useBehaviouralIntelligence';
import {
  INDUSTRY_BENCHMARKS, INTERVIEW_QS, COURSE_RECS, CAREER_DOMAINS, MENTORS,
  DOMAIN_COLORS,
  JOB_STAGES, STAGE_COLORS, GOAL_CATEGORIES, GOAL_PRIORITIES,
  type JobStage, type AQ,
} from '@/data/catalogs';
import { selectAssessmentQuestions, selectAssessmentQuestionsFromAPI, computeScoresFromSelected, getAssessmentAttempt, bumpAssessmentAttempt } from '@/lib/assessmentSelector';
import { classifyEducation, classifyExperience, classifyCertifications } from '@/lib/engines/employabilityEngine';



/* Persistence keys for client-side career state (will graduate to API later) */
const LS_TARGET_ROLE   = 'mx-career-target-role';
const LS_VISIBILITY    = 'mx-career-visibility-open';
const LS_IDP_PROGRESS  = 'mx-career-idp-progress'; // { [interventionId]: 'in-progress'|'done' }

interface CareerBuilderPageProps {
  onNavigate: (screen: Screen | string, data?: Record<string, unknown>) => void;
}

type TabId =
  | 'dashboard' | 'profile' | 'skills' | 'resume'
  | 'jobs' | 'interview' | 'learning' | 'pathways'
  | 'mentors' | 'goals' | 'assessment'
  | 'future-map' | 'development' | 'visibility'
  | 'fresher-hub'
  | 'simulations' | 'market-intel' | 'velocity' | 'workforce'
  // ── Phase 5 — Career Operating System (additive) ──
  | 'weekly-plan' | 'next-actions' | 'behavioral-growth' | 'career-memory'
  // ── CGI — Career Graph Intelligence (additive) ──
  | 'career-graph' | 'career-recs' | 'career-tracks' | 'career-paths'
  // ── LIP — Learning Intelligence Platform (additive) ──
  | 'learning-intel'
  // ── LBI — Learning Behaviour Index (additive) ──
  | 'lbi'
  // ── FRP — Future Readiness Platform (additive) ──
  | 'future-readiness'
  // ── Career Passport (additive) ──
  | 'career-passport'
  // ── P-R8 — Career Pathways Intelligence (CPI) (additive) ──
  | 'forecast-dashboard' | 'growth-roadmap' | 'what-if' | 'rec-history'
  // ── Career Intelligence Hub (additive) ──
  | 'intelligence-hub'
  // ── Hiring Readiness (98X §9 candidate, additive) ──
  | 'hiring-readiness'
  // ── MX-75X — Prediction Trust & Transparency (additive) ──
  | 'prediction-trust'
  // ── MX-77X — My Workforce Outlook (self-scoped, additive) ──
  | 'my-workforce';

// 5-zone workspace grouping for the sidebar (Phase 5). Order here = render order.
type Zone = 'command' | 'profile' | 'intelligence' | 'execution' | 'growth' | 'adaptive';
const ZONE_ORDER: Zone[] = ['command', 'profile', 'intelligence', 'execution', 'growth', 'adaptive'];
const ZONE_LABELS: Record<Zone, string> = {
  command: 'Command center',
  profile: 'Profile studio',
  intelligence: 'Intelligence hub',
  execution: 'Execution engine',
  growth: 'Growth & memory',
  adaptive: 'Adaptive intelligence',
};

const TABS: { id: TabId; label: string; icon: React.ReactNode; screen?: string; group?: string; desc?: string; zone?: Zone }[] = [
  // ── Command center ────────────────────────────────────────────────────────
  { id: 'dashboard',     label: 'Dashboard',              icon: <BarChart3 size={16} />,     zone: 'command' },
  { id: 'weekly-plan',   label: "This week's plan",       icon: <CalendarCheck size={16} />, zone: 'command' },
  { id: 'next-actions',  label: 'Next best actions',      icon: <Rocket size={16} />,        zone: 'command' },
  // ── Profile studio ────────────────────────────────────────────────────────
  { id: 'profile',     label: 'My Profile',             icon: <User size={16} />,     zone: 'profile' },
  { id: 'resume',      label: 'Resume Studio',          icon: <FileText size={16} />, zone: 'profile' },
  { id: 'skills',      label: 'Skills Lab',             icon: <Code size={16} />,     zone: 'profile' },
  // ── Intelligence hub ──────────────────────────────────────────────────────
  { id: 'assessment',   label: 'Competency Assessment',  icon: <Brain size={16} />,      zone: 'intelligence' },
  { id: 'assessment',   label: 'Competency Intelligence', icon: <TrendingUp size={16} />,  screen: 'competency-intelligence', zone: 'intelligence', desc: 'Trends, forecasts & growth interventions from your assessment data' },
  { id: 'future-map',   label: 'Future Map',             icon: <Activity size={16} />,   zone: 'intelligence' },
  { id: 'pathways',     label: 'Career Pathways',        icon: <TrendingUp size={16} />, zone: 'intelligence' },
  { id: 'simulations',  label: 'AI Simulations',         icon: <Brain size={16} />,      zone: 'intelligence' },
  { id: 'market-intel', label: 'Market Intelligence',    icon: <Globe size={16} />,      zone: 'intelligence' },
  { id: 'velocity',     label: 'Career Velocity',        icon: <Zap size={16} />,        zone: 'intelligence' },
  { id: 'workforce',    label: 'Workforce Intel',        icon: <TrendingUp size={16} />, zone: 'intelligence' },
  // ── Execution engine ──────────────────────────────────────────────────────
  { id: 'jobs',        label: 'Job Tracker',            icon: <Briefcase size={16} />,     zone: 'execution' },
  { id: 'interview',   label: 'Interview Prep',         icon: <MessageSquare size={16} />, zone: 'execution' },
  { id: 'visibility',  label: 'Recruiter Visibility',   icon: <Eye size={16} />,           zone: 'execution' },
  { id: 'mentors',     label: 'Mentor Connect',         icon: <Users size={16} />,         zone: 'execution' },
  { id: 'goals',       label: 'Goals',                  icon: <Target size={16} />,        zone: 'execution' },
  { id: 'development', label: 'Development Plan',       icon: <ClipboardList size={16} />, zone: 'execution' },
  { id: 'learning',    label: 'Learning Hub',           icon: <BookOpen size={16} />,      zone: 'execution' },
  { id: 'fresher-hub', label: 'Fresher Hub',            icon: <GraduationCap size={16} />, zone: 'execution' },
  // ── Growth & memory ───────────────────────────────────────────────────────
  { id: 'behavioral-growth', label: 'Behavioural Growth', icon: <Activity size={16} />, zone: 'growth' },
  { id: 'career-memory',     label: 'Career Memory',      icon: <History size={16} />,  zone: 'growth' },
  // ── Career Graph Intelligence ─────────────────────────────────────────────
  { id: 'career-graph',   label: 'Career Graph',      icon: <Network size={16} />,      zone: 'intelligence' },
  { id: 'career-recs',    label: 'Career Paths',      icon: <Route size={16} />,        zone: 'intelligence' },
  { id: 'career-tracks',  label: 'Career Tracks',     icon: <Layers size={16} />,       zone: 'intelligence' },
  { id: 'career-paths',   label: 'Promotion & Lateral', icon: <ArrowUpRight size={16} />, zone: 'intelligence' },
  // ── Learning Intelligence Platform ────────────────────────────────────────
  { id: 'learning-intel',    label: 'Learning Intel',     icon: <GraduationCap size={16} />, zone: 'intelligence' },
  { id: 'lbi',               label: 'Learning Behaviour', icon: <Brain size={16} />,          zone: 'intelligence' },
  // ── Future Readiness Platform ─────────────────────────────────────────────
  { id: 'future-readiness',  label: 'Future Readiness',   icon: <Zap size={16} />,           zone: 'intelligence' },
  // ── Career Passport ───────────────────────────────────────────────────────
  { id: 'career-passport',   label: 'Career Passport',    icon: <Award size={16} />,          zone: 'profile' },
  // ── P-R8 — Career Pathways Intelligence (additive) ────────────────────────
  { id: 'forecast-dashboard', label: 'Career Forecast',   icon: <TrendingUp size={16} />,     zone: 'intelligence' },
  { id: 'growth-roadmap',     label: 'Growth Roadmap',    icon: <ClipboardList size={16} />,  zone: 'growth' },
  { id: 'what-if',            label: 'What-If Analysis',  icon: <Lightbulb size={16} />,      zone: 'intelligence' },
  { id: 'rec-history',        label: 'Rec. History',      icon: <History size={16} />,        zone: 'growth' },
  // ── Career Intelligence Hub (additive) ────────────────────────────────────
  { id: 'intelligence-hub',   label: 'Intelligence Hub',  icon: <Brain size={16} />,          zone: 'intelligence', desc: '8 intelligence surfaces — memory, trajectory, forecast, outcomes, interventions, risk & opportunity' },
  { id: 'hiring-readiness',   label: 'Hiring Readiness',  icon: <Gauge size={16} />,          zone: 'intelligence', desc: 'How your assessed competencies map to a target role — developmental, not a hiring decision' },
  { id: 'prediction-trust',   label: 'Prediction Trust',  icon: <ShieldCheck size={16} />,    zone: 'intelligence', desc: 'How trustworthy your insights are today, and how they get sharper over time — full transparency' },
  { id: 'my-workforce',       label: 'Workforce Outlook', icon: <Compass size={16} />,        zone: 'intelligence', desc: 'Your own readiness trend over time + role-general future-readiness — developmental, never a peer ranking' },
  // ── Adaptive Career Intelligence (Phases 1–5) ─────────────────────────────
  { id: 'dashboard', label: 'My Competency Map',      icon: <Brain size={16} />,        screen: 'ontology-explorer',      group: 'aci', zone: 'adaptive', desc: "See what's being measured about you" },
  { id: 'dashboard', label: 'Adaptive Benchmark',     icon: <BarChart3 size={16} />,    screen: 'benchmark-dashboard',    group: 'aci', zone: 'adaptive', desc: 'See where you stand vs peers' },
  { id: 'dashboard', label: 'Career Mobility',        icon: <TrendingUp size={16} />,   screen: 'career-mobility',        group: 'aci', zone: 'adaptive', desc: 'Plan a move to a target role' },
  { id: 'dashboard', label: 'Growth Trajectory',      icon: <Activity size={16} />,     screen: 'trajectory-dashboard',   group: 'aci', zone: 'adaptive', desc: 'Track scores over time' },
  { id: 'dashboard', label: 'Workforce Insights',     icon: <Globe size={16} />,        screen: 'workforce-insights',     group: 'aci', zone: 'adaptive', desc: 'Org capability heatmap (admins)' },
  { id: 'dashboard', label: 'Enterprise Workforce OS',icon: <Briefcase size={16} />,    screen: 'enterprise-workforce-os',group: 'aci', zone: 'adaptive', desc: 'Executive command center' },
  // Also accessible via the dedicated Employer Dashboard at ?screen=employer-dashboard.
];


interface JobApp {
  _id: string; userId: string; company: string; role: string; location: string;
  type: string; salary: string; source: string; status: JobStage;
  appliedDate: string; deadline: string; notes: string;
  contactName: string; contactEmail: string; url: string; matchScore: number;
  createdAt: string;
}
interface CareerGoal {
  _id: string; userId: string; title: string; description: string;
  category: string; targetDate: string; completed: boolean; priority: string;
  createdAt: string;
}

function getUser() {
  try {
    const t = localStorage.getItem('metryx_token');
    if (!t) return null;
    const payload = JSON.parse(atob(t.split('.')[1]));
    return payload;
  } catch { return null; }
}

function authHeader() {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}








const CAREER_PATHS = CAREER_DOMAINS[0].paths;

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE WIZARD — first-login multi-step onboarding
// ═══════════════════════════════════════════════════════════════════════════
const WIZARD_STEPS = ['Import', 'Personal Info', 'Skills', 'All Done'];

function ImportSourcePicker({ userId: _userId, onParsed, onManual }: {
  userId: string;
  onParsed: (parsed: any) => void;
  onManual: () => void;
}) {
  const [mode, setMode] = useState<'pick' | 'upload' | 'paste' | 'linkedin'>('pick');
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');

  const submitText = async () => {
    if (text.trim().length < 30) { setError('Please paste at least a few lines from your resume or LinkedIn profile.'); return; }
    setParsing(true); setError('');
    try {
      const res = await fetch('/api/cv/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) { setError(d.message || 'Could not parse the text. Please try again.'); return; }
      onParsed(d.profile);
    } catch (e: any) {
      setError(e?.message || 'Network error. Please try again.');
    } finally { setParsing(false); }
  };

  const submitFile = async (file: File) => {
    setParsing(true); setError('');
    try {
      const fd = new FormData();
      fd.append('cv', file);
      const res = await fetch('/api/cv/parse', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok || !d.success) { setError(d.message || 'Could not read this file. Try paste-text instead.'); return; }
      onParsed(d.profile);
    } catch (e: any) {
      setError(e?.message || 'Network error. Please try again.');
    } finally { setParsing(false); }
  };

  if (mode === 'paste') {
    return (
      <div className="space-y-3">
        <div className="text-[11px] text-gray-500">Paste the text of your resume (or copy your LinkedIn profile content). We&rsquo;ll extract the rest.</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9}
          placeholder="Paste your resume text here..."
          className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none placeholder-gray-300"/>
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50">
            <AlertCircle size={13} className="text-red-500 shrink-0"/>
            <span className="text-xs text-red-600">{error}</span>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => { setMode('upload'); setError(''); }} className="text-xs text-gray-500 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300">
            &larr; Back to upload
          </button>
          <button onClick={submitText} disabled={parsing || text.trim().length < 30}
            className="flex-1 text-xs font-semibold text-white py-2 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: BRAND.primary }}>
            {parsing ? 'Parsing…' : 'Parse & continue →'}
          </button>
        </div>
      </div>
    );
  }

  // Default: upload — single primary action, fallbacks as inline text links.
  return (
    <div className="space-y-3">
      <label className="block border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all">
        <FileText size={26} className="mx-auto text-gray-400 mb-2"/>
        <div className="text-sm font-semibold text-gray-700">Upload your resume</div>
        <div className="text-[10px] text-gray-400 mt-1">PDF or DOCX, up to 5 MB. We&rsquo;ll auto-fill the next steps.</div>
        <input type="file" accept=".pdf,.docx,.doc" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) submitFile(f); }}/>
      </label>

      {parsing && <div className="text-xs text-gray-500 text-center py-1">Parsing your file…</div>}

      {error && (
        <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-red-50">
          <div className="flex items-center gap-2">
            <AlertCircle size={13} className="text-red-500 shrink-0"/>
            <span className="text-xs text-red-600">{error}</span>
          </div>
          <button onClick={() => { setError(''); setMode('paste'); }} className="text-[10px] text-blue-600 underline self-start">
            Paste your resume text instead &rarr;
          </button>
        </div>
      )}

      <div className="text-center text-[10px] text-gray-400 pt-1 space-y-1">
        <div>
          <button onClick={() => setMode('paste')} className="underline hover:text-gray-600">
            Don&rsquo;t have a file? Paste resume text
          </button>
        </div>
        <div>
          <button onClick={onManual} className="underline hover:text-gray-600">
            I&rsquo;ll fill details manually
          </button>
        </div>
        <div className="text-[9px] text-gray-300 pt-1">
          Tip: importing from LinkedIn? Open your profile &rarr; More &rarr; Save to PDF, then upload that file here.
        </div>
      </div>
    </div>
  );
}

function blankDraft() {
  return {
    personal: { name: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '' },
    summary: '',
    skills: { technical: [] as string[], soft: [] as string[], tools: [] as string[], languages: [] as string[] },
    experience: [] as any[],
    education: [] as any[],
    certifications: [] as any[],
    projects: [] as any[],
    achievements: [] as any[],
    spokenLanguages: [] as string[],
  };
}


// Canonical vocabularies — keep aligned with backend/routes/cv-parser.ts so the same
// terms appear from auto-parse and from manual entry (standardisation across users).
const VOCAB_TECHNICAL = [
  'JavaScript','TypeScript','Python','Java','C++','C#','Golang','Rust','Ruby','PHP','Swift','Kotlin','Scala','R','MATLAB',
  'React','Next.js','Vue','Angular','Svelte','Node.js','Express','Django','Flask','FastAPI',
  'Spring','Rails','Laravel','SQL','PostgreSQL','MySQL','MongoDB','Redis','Elasticsearch','Snowflake','BigQuery',
  'AWS','Azure','GCP','Docker','Kubernetes','Terraform','CI/CD','GraphQL','REST','gRPC',
  'HTML','CSS','Tailwind','Sass','Webpack','Vite','Jest','Cypress','Playwright','Selenium',
  'TensorFlow','PyTorch','Pandas','NumPy','Scikit-learn','Machine Learning','Deep Learning','Data Science','NLP','LLM','Generative AI',
  'Talent Acquisition','Talent Management','Performance Management','Compensation','Payroll','HRBP','HRIS',
  'Workforce Planning','Organizational Development','Employee Engagement','Learning & Development',
  'Diversity & Inclusion','Succession Planning','Compliance','Labour Law','Industrial Relations',
  'Change Management','Stakeholder Management','Strategic Planning','Business Strategy','P&L',
  'Recruitment','Onboarding','Talent Development','Coaching','Mentoring',
  'Product Management','Project Management','Agile','Scrum','Kanban','Lean','Six Sigma','PMO',
  'Operations','Supply Chain','Vendor Management','Budgeting','Forecasting',
  'Digital Marketing','Brand Management','SEO','SEM','Content Marketing','Sales','Business Development','CRM',
];
const VOCAB_SOFT = [
  'Leadership','Communication','Teamwork','Problem Solving','Critical Thinking','Adaptability','Resilience',
  'Creativity','Time Management','Collaboration','Mentoring','Presentation','Negotiation','Public Speaking',
  'Emotional Intelligence','Decision Making','Conflict Resolution','Strategic Thinking','Innovation','Empathy',
];
const VOCAB_TOOLS = [
  // Collaboration & productivity
  'Jira','Confluence','Slack','Notion','Asana','Trello','Monday.com','ClickUp','Microsoft Teams','Zoom',
  'Excel','PowerPoint','Word','Google Workspace','Outlook','OneDrive','SharePoint',
  // Design
  'Figma','Sketch','Photoshop','Illustrator','Canva','Adobe XD','InVision','Miro',
  // Analytics / BI
  'Tableau','Power BI','Looker','Google Analytics','Mixpanel','Amplitude','Metabase','Qlik',
  // CRM / Sales / Marketing
  'Salesforce','HubSpot','Zoho CRM','Pipedrive','Marketo','Mailchimp','Pardot','ActiveCampaign',
  // ERP / Finance
  'SAP','SAP S/4HANA','SAP SuccessFactors','SAP HCM','Oracle','Oracle ERP','Oracle Fusion','Oracle HCM','Oracle HCM Cloud','PeopleSoft','NetSuite','QuickBooks','Xero',
  // HRIS / HR-tech / TA
  'Workday','SuccessFactors','BambooHR','Greenhouse','Lever','LinkedIn Recruiter','Naukri','Indeed',
  'Darwinbox','Keka','Zoho People','Zoho Recruit','PeopleStrong','Ramco HCM','Ceridian Dayforce','UKG','ADP','Paychex','iCIMS','Taleo','SmartRecruiters','JobVite','Eightfold','HiBob','Personio','Rippling','Gusto','Namely',
  // ITSM / DevOps platforms
  'ServiceNow','Jenkins','GitHub','GitLab','Bitbucket','Docker','Kubernetes','AWS','Azure','GCP',
  // Customer support
  'Zendesk','Freshdesk','Intercom','Help Scout',
];



function WizardTagInput({ label, color, tags, onAdd, onRemove, placeholder, suggestions = [] }: {
  label: string; color: string; tags: string[];
  onAdd: (t: string) => void; onRemove: (i: number) => void; placeholder: string;
  suggestions?: string[];
}) {
  const [val, setVal] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const taken = new Set(tags.map(t => t.toLowerCase()));
  const trimmed = val.trim();
  const lower = trimmed.toLowerCase();

  // Match against canonical vocabulary. Prefer prefix matches, then substring.
  const matches = (() => {
    if (!suggestions.length) return [] as string[];
    const pool = suggestions.filter(s => !taken.has(s.toLowerCase()));
    if (!lower) return pool.slice(0, 12);
    const starts: string[] = [], includes: string[] = [];
    for (const s of pool) {
      const sl = s.toLowerCase();
      if (sl.startsWith(lower)) starts.push(s);
      else if (sl.includes(lower)) includes.push(s);
    }
    return [...starts, ...includes].slice(0, 8);
  })();

  // Quick-pick chips shown when the field is empty and not focused — gentle prompt.
  const quickPicks = !val && !focused ? suggestions.filter(s => !taken.has(s.toLowerCase())).slice(0, 6) : [];

  const commit = (text: string) => {
    const t = text.trim();
    if (t && !taken.has(t.toLowerCase())) onAdd(t);
    setVal(''); setActiveIdx(0);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (focused && matches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, matches.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') { e.preventDefault(); commit(matches[activeIdx] || trimmed); return; }
      if (e.key === 'Tab' && trimmed) { e.preventDefault(); commit(matches[activeIdx] || trimmed); return; }
    } else if (e.key === 'Enter') {
      e.preventDefault(); commit(trimmed);
    }
    if (e.key === ',' || e.key === ';') {
      e.preventDefault(); commit(trimmed);
    }
  };

  return (
    <div>
      <div className="text-xs font-semibold text-gray-600 mb-1.5">
        {label} <span className="font-normal text-gray-400">({tags.length})</span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}18`, color }}>
              {t}
              <button type="button" onClick={() => onRemove(i)} className="ml-0.5 hover:opacity-60 transition-opacity leading-none">&times;</button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="flex gap-1.5">
          <input value={val}
            onChange={e => { setVal(e.target.value); setActiveIdx(0); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={onKey}
            placeholder={placeholder}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
            autoComplete="off"/>
          <button type="button" onClick={() => commit(trimmed)}
            disabled={!trimmed}
            className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40"
            style={{ backgroundColor: `${color}18`, color }}>Add</button>
        </div>

        {focused && matches.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {matches.map((m, i) => (
              <button key={m} type="button"
                onMouseDown={(e) => { e.preventDefault(); commit(m); }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full text-left text-xs px-3 py-1.5 transition-colors ${i === activeIdx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <span style={{ color }}>{m}</span>
                {trimmed && m.toLowerCase().startsWith(lower) && (
                  <span className="ml-1 text-[9px] text-gray-300 uppercase tracking-wide">match</span>
                )}
              </button>
            ))}
            {trimmed && !matches.some(m => m.toLowerCase() === lower) && (
              <button type="button"
                onMouseDown={(e) => { e.preventDefault(); commit(trimmed); }}
                className="w-full text-left text-xs px-3 py-1.5 border-t border-gray-100 text-gray-500 hover:bg-gray-50">
                + Add &ldquo;{trimmed}&rdquo; as a custom skill
              </button>
            )}
          </div>
        )}
      </div>

      {quickPicks.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          <span className="text-[9px] text-gray-400 uppercase tracking-wider self-center mr-0.5">Quick add:</span>
          {quickPicks.map(s => (
            <button key={s} type="button" onClick={() => commit(s)}
              className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:text-white transition-colors"
              style={{ ['--hover-bg' as any]: color }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = color; (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.color = ''; }}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CompletionRing({ pct }: { pct: number }) {
  const r = 54; const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={130} height={130} className="-rotate-90">
        <circle cx={65} cy={65} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10}/>
        <circle cx={65} cy={65} r={r} fill="none" strokeWidth={10}
          stroke={pct >= 60 ? BRAND.green : pct >= 30 ? BRAND.accent : BRAND.primary}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: pct >= 60 ? BRAND.green : pct >= 30 ? BRAND.accent : BRAND.primary }}>{pct}%</span>
        <span className="text-[9px] text-gray-400 mt-0.5">Complete</span>
      </div>
    </div>
  );
}

function ProfileWizard({ userId, onComplete, onSkip, initialProfile }: {
  userId: string;
  onComplete: (profile: any) => void;
  onSkip: () => void;
  initialProfile?: any;
}) {
  // Only skip the import step when we actually have CV-level data (skills/exp/summary).
  // Name+email alone (auto-seeded from the user record) is NOT enough — the user should
  // still see the "Import from CV / Paste text / LinkedIn" picker.
  const seedCompleteness = initialProfile?.competencyProfile?.completeness ?? 0;
  const hasCvData = !!(initialProfile && (
    (initialProfile.skills?.technical?.length ?? 0) > 0 ||
    (initialProfile.experience?.length ?? 0) > 0 ||
    (initialProfile.education?.length ?? 0) > 0 ||
    !!initialProfile.summary
  ));
  const hasSeedData = hasCvData || seedCompleteness >= 40;
  const [step, setStep]         = useState(hasSeedData ? 2 : 1);
  const [draft, setDraft]       = useState<any>(hasSeedData ? { ...blankDraft(), ...initialProfile, personal: { ...blankDraft().personal, ...(initialProfile.personal ?? {}) }, skills: { ...blankDraft().skills, ...(initialProfile.skills ?? {}) } } : blankDraft());
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState('');
  const [finalPct, setFinalPct] = useState(0);

  const pct = draft?.competencyProfile?.completeness || 0;

  const updatePersonal = (k: string, v: string) =>
    setDraft((d: any) => ({ ...d, personal: { ...d.personal, [k]: v } }));

  const addSkill = (cat: 'technical' | 'soft' | 'tools') => (t: string) =>
    setDraft((d: any) => ({ ...d, skills: { ...d.skills, [cat]: [...d.skills[cat], t] } }));

  const removeSkill = (cat: 'technical' | 'soft' | 'tools') => (i: number) =>
    setDraft((d: any) => ({ ...d, skills: { ...d.skills, [cat]: d.skills[cat].filter((_: any, idx: number) => idx !== i) } }));

  const handleParsed = (parsed: any) => {
    setDraft(parsed);
    setStep(2);
  };

  const handleSave = async () => {
    if (!userId) { setSaveError('Please log in to save your profile.'); return; }
    setSaving(true); setSaveError('');
    try {
      const res = await fetch('/api/cv/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email: draft.personal?.email || '', profile: draft }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) { setSaveError(d.message || 'Save failed. Please try again.'); return; }
      setFinalPct(d.completeness || pct);
      try {
        const pr = await fetch(`/api/cv/profile/${userId}`);
        const pd = await pr.json();
        if (pd.success) { onComplete(pd.profile); setStep(4); return; }
      } catch {}
      onComplete({ ...draft, exists: true });
      setStep(4);
    } catch (err: any) {
      setSaveError(err?.message || 'Network error. Please try again.');
    } finally { setSaving(false); }
  };

  const inputCls = 'w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder-gray-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(30,30,60,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* ── Gradient header ── */}
        <div className="px-6 pt-6 pb-4 text-white shrink-0" style={{ background: `${BRAND.primary}` }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70 mb-0.5">Profile Setup</div>
              <h2 className="text-base font-bold leading-snug">
                {step === 1 && 'Upload your resume'}
                {step === 2 && (hasSeedData ? 'Complete the missing info' : 'Personal details')}
                {step === 3 && 'Skills &amp; expertise'}
                {step === 4 && 'Profile complete!'}
              </h2>
              <p className="text-[10px] opacity-75 mt-1">
                {step === 1 && 'We\u2019ll auto-fill everything from your CV in seconds'}
                {step === 2 && (hasSeedData ? 'Your resume is already on file \u2014 just fill anything that\u2019s blank.' : 'Review and update your personal information')}
                {step === 3 && 'Add the skills you know \u2014 tech, tools, and soft skills'}
                {step === 4 && 'Your profile is live and recruiters can find you'}
              </p>
            </div>
            {step < 4 && (
              <button onClick={onSkip} className="mt-0.5 p-1 rounded-lg hover:bg-white/20 transition-colors" title="Skip setup">
                <X size={15} className="opacity-80"/>
              </button>
            )}
          </div>
          {/* Step dots */}
          <div className="flex items-center gap-2 mt-3">
            {WIZARD_STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`flex items-center justify-center rounded-full text-[9px] font-bold transition-all ${step > i + 1 ? 'w-5 h-5' : step === i + 1 ? 'w-6 h-6 ring-2 ring-white/40' : 'w-4 h-4 opacity-50'}`}
                  style={{ backgroundColor: step > i + 1 ? BRAND.green : step === i + 1 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
                  {step > i + 1 ? <CheckCircle size={10}/> : i + 1}
                </div>
                <span className={`text-[9px] font-medium transition-opacity ${step === i + 1 ? 'opacity-90' : 'opacity-40'}`}>{label}</span>
                {i < WIZARD_STEPS.length - 1 && <div className="w-3 h-px bg-white/20 mx-0.5"/>}
              </div>
            ))}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── STEP 1: Pick import source ── */}
          {step === 1 && (
            <ImportSourcePicker
              userId={userId}
              onParsed={(parsed) => handleParsed(parsed)}
              onManual={() => setStep(2)}
            />
          )}

          {/* ── STEP 2: Personal Info ── */}
          {step === 2 && (
            <div className="space-y-3">
              {pct > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl mb-1" style={{ backgroundColor: `${BRAND.green}12` }}>
                  <CheckCircle size={14} style={{ color: BRAND.green }} className="shrink-0"/>
                  <span className="text-xs text-gray-600">CV parsed &mdash; fields pre-filled. Review and update as needed.</span>
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-lg" style={{ backgroundColor: `${BRAND.green}22`, color: BRAND.green }}>{pct}%</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Full Name <span className="text-red-400">*</span></label>
                  <input value={draft.personal?.name || ''} onChange={e => updatePersonal('name', e.target.value)}
                    placeholder="e.g. Priya Sharma" className={inputCls}/>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Phone</label>
                  <input value={draft.personal?.phone || ''} onChange={e => updatePersonal('phone', e.target.value)}
                    placeholder="+91 98765 43210" className={inputCls}/>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Location</label>
                  <input value={draft.personal?.location || ''} onChange={e => updatePersonal('location', e.target.value)}
                    placeholder="Bengaluru, Karnataka" className={inputCls}/>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Email</label>
                  <input value={draft.personal?.email || ''} onChange={e => updatePersonal('email', e.target.value)}
                    placeholder="priya@example.com" className={inputCls}/>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 mb-1 block">LinkedIn</label>
                  <input value={draft.personal?.linkedin || ''} onChange={e => updatePersonal('linkedin', e.target.value)}
                    placeholder="linkedin.com/in/priya" className={inputCls}/>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Professional Summary</label>
                  <textarea value={draft.summary || ''} onChange={e => setDraft((d: any) => ({ ...d, summary: e.target.value }))}
                    rows={3} placeholder="A brief overview of your background and goals..."
                    className={`${inputCls} resize-none`}/>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Skills ── */}
          {step === 3 && (
            <div className="space-y-5">
              <WizardTagInput label="Technical Skills" color={BRAND.primary}
                tags={draft.skills?.technical || []}
                onAdd={addSkill('technical')} onRemove={removeSkill('technical')}
                suggestions={VOCAB_TECHNICAL}
                placeholder="Start typing &mdash; e.g. React, Python, SQL"/>
              <WizardTagInput label="Tools &amp; Platforms" color="#8b5cf6"
                tags={draft.skills?.tools || []}
                onAdd={addSkill('tools')} onRemove={removeSkill('tools')}
                suggestions={VOCAB_TOOLS}
                placeholder="Start typing &mdash; e.g. Jira, Figma, AWS"/>
              <WizardTagInput label="Soft Skills" color={BRAND.green}
                tags={draft.skills?.soft || []}
                onAdd={addSkill('soft')} onRemove={removeSkill('soft')}
                suggestions={VOCAB_SOFT}
                placeholder="Start typing &mdash; e.g. Leadership, Communication"/>
              {saveError && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ backgroundColor: '#fef2f2' }}>
                  <AlertCircle size={13} className="text-red-500 shrink-0"/>
                  <span className="text-xs text-red-600">{saveError}</span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4: Done ── */}
          {step === 4 && (
            <div className="text-center py-4">
              <CompletionRing pct={finalPct || pct}/>
              <h3 className="text-base font-bold text-gray-900 mt-3">You&rsquo;re all set!</h3>
              <p className="text-xs text-gray-500 mt-1 mb-5 max-w-xs mx-auto">
                Your profile is live. Keep building it to improve your match score and recruiter visibility.
              </p>
              <div className="grid grid-cols-2 gap-2 text-left mb-4 max-w-xs mx-auto">
                {[
                  { icon: <User size={11}/>, label: 'Personal Info', done: !!(draft.personal?.name) },
                  { icon: <Code size={11}/>, label: 'Technical Skills', done: (draft.skills?.technical?.length || 0) > 0 },
                  { icon: <Heart size={11}/>, label: 'Soft Skills', done: (draft.skills?.soft?.length || 0) > 0 },
                  { icon: <Briefcase size={11}/>, label: 'Experience', done: (draft.experience?.length || 0) > 0 },
                  { icon: <GraduationCap size={11}/>, label: 'Education', done: (draft.education?.length || 0) > 0 },
                  { icon: <FileText size={11}/>, label: 'Summary', done: !!(draft.summary) },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] text-gray-600">
                    {item.done
                      ? <CheckCircle size={11} style={{ color: BRAND.green }}/>
                      : <Circle size={11} className="text-gray-300"/>}
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              <button onClick={onSkip}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: `${BRAND.primary}` }}>
                Go to My Dashboard &rarr;
              </button>
              <p className="text-[10px] text-gray-400 mt-2.5">You can always update your profile from the Profile tab</p>
            </div>
          )}
        </div>

        {/* ── Footer nav ── */}
        {step < 4 && (
          <div className="shrink-0 px-6 pb-5 pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
            <div className="text-[10px] text-gray-400">Step {step} of {WIZARD_STEPS.length}</div>
            <div className="flex gap-2 ml-auto">
              {step > 1 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                  <ChevronLeft size={13}/> Back
                </button>
              )}
              {step < 3 && (
                <button onClick={() => setStep(s => s + 1)}
                  className="flex items-center gap-1 text-xs font-semibold text-white px-4 py-1.5 rounded-lg transition-opacity hover:opacity-90"
                  style={{ backgroundColor: BRAND.primary }}>
                  {step === 1 ? 'Skip to details' : 'Next'} <ChevronRight size={13}/>
                </button>
              )}
              {step === 3 && (
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-1.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: BRAND.green }}>
                  {saving ? <><RefreshCw size={11} className="animate-spin"/> Saving&hellip;</> : <><CheckCircle size={11}/> Save &amp; Finish</>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CareerBuilderPage({ onNavigate }: CareerBuilderPageProps) {
  // Allow deep-linking directly to a sub-tab (e.g. ?tab=assessment from
  // landing page hero, Adaptive Intelligence dashboards, and CAPADEX /
  // Pragati completion CTAs).
  const initialTab: TabId = (() => {
    if (typeof window === 'undefined') return 'dashboard';
    const q = new URLSearchParams(window.location.search).get('tab');
    return (q as TabId) || 'dashboard';
  })();
  const [tab, setTab] = useState<TabId>(initialTab);
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [jobs, setJobs] = useState<JobApp[]>([]);
  const [goals, setGoals] = useState<CareerGoal[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showWelcomeUpload, setShowWelcomeUpload] = useState(false);
  // MX-75X — validationLoop flag probe: gate the Prediction Trust tab so flag-OFF is byte-identical.
  const [validationLoopEnabled, setValidationLoopEnabled] = useState(false);
  const [myWorkforceEnabled, setMyWorkforceEnabled] = useState(false);

  const tokenUser = getUser();
  const [sessionUser, setSessionUser] = useState<any>(null);
  // Form-login uses cookie session (no JWT). Fall back to /api/user so the
  // dashboard works regardless of which login path the user took.
  useEffect(() => {
    if (tokenUser?.id || tokenUser?.userId) return;
    fetch('/api/user', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.id) setSessionUser(d); })
      .catch(() => {});
  }, [tokenUser?.id, tokenUser?.userId]);
  useEffect(() => {
    fetch('/api/validation-loop/enabled', { credentials: 'include' })
      .then(r => setValidationLoopEnabled(r.ok))
      .catch(() => setValidationLoopEnabled(false));
    fetch('/api/my-workforce/_meta/status', { headers: authHeader() as HeadersInit })
      .then(r => setMyWorkforceEnabled(r.ok))
      .catch(() => setMyWorkforceEnabled(false));
  }, []);
  const user = tokenUser ?? sessionUser;
  const userId = user?.id || user?.userId || sessionUser?.id || '';

  // ── Profile load (returns empty skeleton when no CV uploaded) ─────────────
  const loadProfile = useCallback(async () => {
    if (!userId) { setLoadingProfile(false); return; }
    try {
      const r = await fetch(`/api/cv/profile/${userId}`, { headers: authHeader() as HeadersInit });
      const d = await r.json();
      if (d.success) {
        if (!d.exists) {
          const ir = await fetch('/api/cv/init-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(authHeader() as Record<string, string>) },
            body: JSON.stringify({ userId, email: user?.email || '', name: user?.name || '' }),
          });
          const id = await ir.json();
          const p = id.success ? id.profile : d.profile;
          setProfile(p);
          const pct0 = p?.competencyProfile?.completeness ?? 0;
          if (pct0 < 25 && !sessionStorage.getItem('mx-wizard-skip')) setShowWelcomeUpload(true);
        } else {
          setProfile(d.profile);
          const pct1 = d.profile?.competencyProfile?.completeness ?? 0;
          if (pct1 < 25 && !sessionStorage.getItem('mx-wizard-skip')) setShowWelcomeUpload(true);
        }
      }
    } catch {}
    setLoadingProfile(false);
  }, [userId, user?.email, user?.name]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // ── Jobs load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/cv/jobs/${userId}`, { headers: authHeader() as HeadersInit })
      .then(r => r.json()).then(d => { if (d.success) setJobs(d.jobs); }).catch(() => {});
  }, [userId]);

  // ── Goals load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/cv/goals/${userId}`, { headers: authHeader() as HeadersInit })
      .then(r => r.json()).then(d => { if (d.success) setGoals(d.goals); }).catch(() => {});
  }, [userId]);

  // ── Compute Employability Index — quality-weighted, evidence-based ──────────
  // Replaces the prior "profile fill ≈ score" model. Each dimension is now
  // weighted by *evidence quality*, not just count:
  //   • Education: degree level × institution tier
  //   • Experience: years × seniority of roles held
  //   • Certifications: issuer credibility (top providers worth more)
  //   • Assessment: only counted if actually completed (assessmentScore present)
  const eiBreakdown = useMemo(() => {
    const edu = classifyEducation(profile?.education || []);
    const exp = classifyExperience(profile?.experience || []);
    const cer = classifyCertifications(profile?.certifications || []);
    const techSkills = (profile?.skills?.technical || []).length;
    const softSkills = (profile?.skills?.soft || []).length;
    const projCount = (profile?.projects || []).length;
    // Assessment is ONLY counted if a real assessment score exists on the profile.
    // `competencyProfile.completeness` is profile-fill %, not an assessment score.
    const assessmentTaken = typeof profile?.assessmentScore === 'number';
    const assessmentScore = assessmentTaken ? Math.max(0, Math.min(100, profile.assessmentScore)) : 0;

    type EIComp = {
      key: string; label: string; rationale: string;
      actual: number; max: number; weight: string;
      detail?: string;
      currentCount?: number; targetCount?: number;
      cta: string; tab: TabId;
    };
    const components: EIComp[] = [
      {
        key: 'assessment',
        label: 'Competency Assessment',
        rationale: 'Validated proficiency across role-relevant competencies — strongest predictor of role-fit. Counted only when the assessment is actually completed.',
        actual: +(assessmentTaken ? (assessmentScore / 100) * 25 : 0).toFixed(1),
        max: 25,
        weight: '25%',
        detail: assessmentTaken
          ? `You scored ${assessmentScore}/100 on the assessment.`
          : 'Not taken yet — this dimension contributes 0 pts until you complete it.',
        cta: assessmentTaken && assessmentScore >= 95 ? 'Assessment complete' : (assessmentTaken ? 'Retake to improve' : 'Take the assessment'),
        tab: 'assessment',
      },
      {
        key: 'experience',
        label: 'Work Experience (Quality)',
        rationale: 'Tenure × seniority of roles you\'ve held. C-suite/VP = 1.0, Director/Head/Principal = 0.9, Manager/Lead = 0.8, Senior = 0.7, Associate/Mid = 0.55, Junior/Intern = 0.35.',
        actual: +exp.points.toFixed(1),
        max: 20,
        weight: '20%',
        detail: exp.summary,
        cta: exp.points < 20 ? 'Update roles / titles' : 'Strong experience',
        tab: 'profile',
      },
      {
        key: 'education',
        label: 'Education (Tier-weighted)',
        rationale: 'Degree level × institution tier. PhD 1.0 / Masters 0.85 / Bachelors 0.65 / Diploma 0.4. Tier 1 (IIT/IIM/IISc/AIIMS/NIT/BITS/ISB or global top-100) ×1.0, Tier 2 (reputed private/state university) ×0.75, Tier 3 (other) ×0.5.',
        actual: +edu.points.toFixed(1),
        max: 15,
        weight: '15%',
        detail: edu.summary,
        cta: edu.points < 15 ? 'Add or refine education' : 'Strong education',
        tab: 'profile',
      },
      {
        key: 'technical',
        label: 'Technical Skills',
        rationale: 'Listed technical skills drive recruiter keyword match. 1.875 pts each, up to 8 skills (deeper coverage beats long lists).',
        actual: +Math.min(techSkills * 1.875, 15).toFixed(1),
        max: 15,
        weight: '15%',
        currentCount: techSkills,
        targetCount: 8,
        cta: techSkills < 8 ? `Add ${8 - techSkills} more skill${8 - techSkills > 1 ? 's' : ''}` : 'Maxed',
        tab: 'skills',
      },
      {
        key: 'certifications',
        label: 'Certifications (Issuer-weighted)',
        rationale: 'Top-tier issuers (PMP, CFA, CPA, AWS/Azure/GCP Certified, CISSP, SHRM, Six Sigma BB, Salesforce Certified) = 4 pts; mid (Google/Microsoft/Coursera Specializations) = 2.5 pts; generic (short courses, course-completion) = 1 pt. Cap 10.',
        actual: +cer.points.toFixed(1),
        max: 10,
        weight: '10%',
        detail: cer.summary,
        currentCount: (profile?.certifications || []).length,
        targetCount: 3,
        cta: cer.points < 10 ? 'Add a top-tier certification' : 'Strong credentials',
        tab: 'profile',
      },
      {
        key: 'soft',
        label: 'Soft Skills',
        rationale: 'Behavioural skills — leadership, communication, collaboration. 1.6 pts each, up to 5 skills.',
        actual: +Math.min(softSkills * 1.6, 8).toFixed(1),
        max: 8,
        weight: '8%',
        currentCount: softSkills,
        targetCount: 5,
        cta: softSkills < 5 ? `Add ${5 - softSkills} more soft skill${5 - softSkills > 1 ? 's' : ''}` : 'Maxed',
        tab: 'skills',
      },
      {
        key: 'projects',
        label: 'Projects & Portfolio',
        rationale: 'Demonstrable work — projects, case studies, publications. 1 pt each, up to 4.',
        actual: +Math.min(projCount * 1, 4).toFixed(1),
        max: 4,
        weight: '4%',
        currentCount: projCount,
        targetCount: 4,
        cta: projCount < 4 ? `Add ${4 - projCount} more project${4 - projCount > 1 ? 's' : ''}` : 'Maxed',
        tab: 'profile',
      },
      {
        key: 'profile',
        label: 'Profile Completeness',
        rationale: 'Basic contact/summary fields filled — bio, location, LinkedIn, phone. Small but necessary signal.',
        actual: +(((profile?.competencyProfile?.completeness || 0) / 100) * 3).toFixed(1),
        max: 3,
        weight: '3%',
        cta: 'Complete profile basics',
        tab: 'profile',
      },
    ];
    const total = Math.min(Math.round(components.reduce((s, c) => s + c.actual, 0)), 99);
    return { total, components };
  }, [profile]);

  const eiScore = eiBreakdown.total;

  // Phase 5 — Career Brain aggregator (best-effort; never throws). Powers the
  // Command Center + Growth & Memory zones. Read-only; touches no EI/benchmarks.
  const { brain: careerBrain } = useCareerBrain(userId, { profile, jobs, goals, eiScore });
  const openJobsCount = (jobs || []).filter((j) => !['Accepted', 'Rejected'].includes(j?.status as string)).length;
  const hasAssessment = (profile?.competencyProfile?.completeness || 0) > 0;

  const handleLogout = () => {
    localStorage.removeItem('metryx_token');
    onNavigate('landing');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Navbar onNavigate={onNavigate} />

      <div className="flex flex-1 max-w-[1400px] mx-auto w-full px-4 py-6 gap-6">
        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside className={`shrink-0 transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-14'}`}>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm sticky top-20 flex flex-col max-h-[calc(100vh-6rem)] overflow-y-auto overscroll-contain">
            {/* User card */}
            {sidebarOpen && (
              <div className="px-4 py-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold mb-2"
                  style={{ background: `${BRAND.primary}` }}>
                  {(profile?.personal?.name || user?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="text-xs font-semibold text-gray-800 truncate">
                  {profile?.personal?.name || user?.name || 'Career Seeker'}
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                  {profile?.personal?.location || 'Location not set'}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${profile?.competencyProfile?.completeness || 0}%`, backgroundColor: BRAND.accent }} />
                  </div>
                  <span className="text-[9px] text-gray-400">{profile?.competencyProfile?.completeness || 0}%</span>
                </div>
              </div>
            )}

            {/* Nav — grouped into the 5-zone Career Operating System workspace */}
            <nav className="p-2 space-y-0.5">
              {ZONE_ORDER.map((zone) => {
                const items = TABS.filter((t) => (t.zone ?? 'command') === zone)
                  .filter((t) => (t.id !== 'prediction-trust' || validationLoopEnabled) && (t.id !== 'my-workforce' || myWorkforceEnabled));
                if (items.length === 0) return null;
                return (
                  <div key={zone} className="pb-1">
                    {sidebarOpen && (
                      <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                        {ZONE_LABELS[zone]}
                      </div>
                    )}
                    {items.map((t) => {
                      const isActive = !t.screen && tab === t.id;
                      return (
                        <button key={`${t.id}-${t.label}`} onClick={() => {
                            if (!t.screen) { setTab(t.id); return; }
                            const params = new URLSearchParams();
                            if (userId) params.set('user_id', userId);
                            const orgId = (user as any)?.orgId;
                            if (orgId) params.set('org_id', orgId);
                            const qs = params.toString();
                            onNavigate(qs ? `${t.screen}?${qs}` : t.screen);
                          }}
                          title={t.desc ? `${t.label} — ${t.desc}` : t.label}
                          className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? 'text-white shadow-sm'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                          }`}
                          style={isActive ? { backgroundColor: BRAND.primary } : {}}>
                          <span className="shrink-0 mt-0.5">{t.icon}</span>
                          {sidebarOpen && (
                            <span className="flex-1 min-w-0 text-left">
                              <span className="block leading-tight">{t.label}</span>
                              {t.desc && (
                                <span
                                  className={`block text-[10px] font-normal mt-0.5 leading-tight truncate ${
                                    isActive ? 'text-white/80' : 'text-gray-400'
                                  }`}
                                >
                                  {t.desc}
                                </span>
                              )}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </nav>

            {/* Bottom actions */}
            <div className="p-2 border-t border-gray-100 space-y-0.5">
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600">
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

        {/* ── Main content ──────────────────────────────────────── */}
        <main className="flex-1 min-w-0 space-y-6">
          {tab === 'dashboard'   && <DashboardTab profile={profile} loading={loadingProfile} eiScore={eiScore} eiBreakdown={eiBreakdown} jobs={jobs} goals={goals} onTabChange={setTab} onNavigate={onNavigate} onOpenWizard={() => setShowWelcomeUpload(true)} userId={userId} />}
          {tab === 'assessment'  && <AssessmentTab userId={userId} profile={profile} onTabChange={setTab} />}
          {tab === 'future-map'  && <FutureMapTab profile={profile} onTabChange={setTab} behavior={careerBrain.behaviorProfile} />}
          {tab === 'development' && <DevelopmentPlanTab profile={profile} onTabChange={setTab} behavior={careerBrain.behaviorProfile} />}
          {tab === 'visibility'  && <VisibilityTab profile={profile} eiScore={eiScore} onTabChange={setTab} />}
          {tab === 'profile'    && <ProfileTab profile={profile} userId={userId} onProfileUpdate={setProfile} onRefreshProfile={loadProfile} />}
          {tab === 'skills'     && <SkillsTab profile={profile} userId={userId} onProfileUpdate={setProfile} />}
          {tab === 'resume'     && <ResumeTab profile={profile} userId={userId} onProfileSaved={(p) => { setProfile(p); setShowWelcomeUpload(false); }} />}
          {tab === 'jobs'       && <JobsTab jobs={jobs} setJobs={setJobs} userId={userId} profile={profile} behavior={careerBrain.behaviorProfile} />}
          {tab === 'interview'  && <InterviewTab profile={profile} behavior={careerBrain.behaviorProfile} />}
          {tab === 'learning'   && <LearningTab profile={profile} />}
          {tab === 'pathways'   && (
            <div className="p-4 md:p-6 overflow-auto h-full">
              <PathwayExplorerPanel userId={userId} />
            </div>
          )}
          {tab === 'mentors'    && <MentorsTab profile={profile} />}
          {tab === 'goals'      && <GoalsTab goals={goals} setGoals={setGoals} userId={userId} />}
          {tab === 'fresher-hub'  && <FresherHubTab profile={profile} />}
          {tab === 'simulations'  && <SimulationsTab profile={profile} eiScore={eiScore} />}
          {tab === 'market-intel' && <MarketIntelTab profile={profile} eiScore={eiScore} />}
          {tab === 'velocity'     && <CareerVelocityTab profile={profile} eiScore={eiScore} userId={userId} />}
          {tab === 'workforce'    && <WorkforceTab profile={profile} eiScore={eiScore} />}
          {tab === 'weekly-plan'       && <WeeklyActionPlanTab brain={careerBrain} openJobs={openJobsCount} hasAssessment={hasAssessment} onTabChange={setTab} />}
          {tab === 'next-actions'      && <NextBestActionsTab  brain={careerBrain} openJobs={openJobsCount} hasAssessment={hasAssessment} eiScore={eiScore} profile={profile} userId={userId} goals={goals.map((g) => ({ text: g.title, completed: g.completed, targetDate: g.targetDate }))} jobs={jobs.map((j) => ({ company: j.company, role: j.role, status: j.status }))} onTabChange={setTab} />}
          {tab === 'behavioral-growth' && <BehavioralGrowthTab brain={careerBrain} profile={profile} openJobs={openJobsCount} eiScore={eiScore} />}
          {tab === 'career-memory'     && <CareerMemoryTab userId={userId} brain={careerBrain} eiScore={eiScore} />}
          {tab === 'learning-intel'    && <LearningIntelligenceTab userId={userId} />}
          {tab === 'lbi'               && <LBIDashboard email={profile?.email || undefined} />}
          {tab === 'future-readiness' && <FutureReadinessTab userId={userId} />}
          {tab === 'hiring-readiness' && <HiringReadinessTab userId={userId} />}
          {tab === 'prediction-trust' && validationLoopEnabled && <PredictionTrustTab />}
          {tab === 'my-workforce' && myWorkforceEnabled && <MyWorkforcePanel />}
          {tab === 'career-passport' && <CareerPassportTab userId={userId} profile={profile} />}
          {tab === 'career-graph'      && <CareerGraphTab userId={userId} />}
          {tab === 'career-recs'       && <CareerRecommendationsTab userId={userId} />}
          {tab === 'career-tracks'     && <CareerTracksPanel userId={userId} />}
          {tab === 'career-paths'      && <PromotionPathsPanel userId={userId} />}
          {tab === 'forecast-dashboard' && (
            <div className="p-4 md:p-6 overflow-auto h-full">
              <ForecastDashboard userId={userId} />
            </div>
          )}
          {tab === 'growth-roadmap' && (
            <div className="p-4 md:p-6 overflow-auto h-full">
              <GrowthRoadmap userId={userId} />
            </div>
          )}
          {tab === 'what-if' && (
            <div className="p-4 md:p-6 overflow-auto h-full">
              <WhatIfAnalysis userId={userId} />
            </div>
          )}
          {tab === 'rec-history' && (
            <div className="p-4 md:p-6 overflow-auto h-full">
              <RecommendationHistory userId={userId} />
            </div>
          )}
          {tab === 'intelligence-hub' && (
            <div className="h-full overflow-hidden flex flex-col">
              <CareerIntelligenceHub
                userId={userId}
                email={profile?.email}
                eiScore={eiScore}
                profile={profile}
                onTabChange={setTab}
              />
            </div>
          )}
        </main>
      </div>

      <Footer onNavigate={onNavigate} />

      {/* ── Profile Setup Wizard (first login / zero completeness) ── */}
      {showWelcomeUpload && (
        <ProfileWizard
          userId={userId}
          initialProfile={profile}
          onComplete={(p) => { setProfile(p); setShowWelcomeUpload(false); }}
          onSkip={() => { sessionStorage.setItem('mx-wizard-skip', '1'); setShowWelcomeUpload(false); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════
type EIComponent = {
  key: string; label: string; rationale: string;
  actual: number; max: number; weight: string;
  detail?: string;
  currentCount?: number; targetCount?: number;
  cta: string; tab: TabId;
};

// ── E2: Competency Readiness Ring widget ────────────────────────────────────
function CompetencyRingWidget({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [readiness, setReadiness] = useState<{ pct: number; label: string; critGaps: number } | null>(null);
  useEffect(() => {
    fetch('/api/competency/intelligence/outcomes', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.outcome_projection) {
          setReadiness({
            pct: d.outcome_projection.overall_readiness_pct,
            label: d.outcome_projection.outcome_label ?? '',
            critGaps: (d.gap_priority ?? []).filter((g: any) => g.gap_level === 'critical').length,
          });
        }
      })
      .catch(() => {});
  }, []);
  if (!readiness) return null;
  const R = 24, circ = 2 * Math.PI * R, fill = (readiness.pct / 100) * circ;
  const color = readiness.pct >= 85 ? '#16a34a' : readiness.pct >= 70 ? '#2563eb' : readiness.pct >= 50 ? '#d97706' : '#dc2626';
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onNavigate('competency-intelligence')}
      role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onNavigate('competency-intelligence')}>
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={R} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx="32" cy="32" r={R} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 32 32)" />
        <text x="32" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">{readiness.pct}%</text>
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">Competency Readiness</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {readiness.label.replace(/_/g, ' ') || 'Role readiness score'} ·{' '}
          {readiness.critGaps > 0
            ? <span className="text-red-500 font-medium">{readiness.critGaps} critical gap{readiness.critGaps !== 1 ? 's' : ''}</span>
            : <span className="text-green-600">No critical gaps</span>}
        </p>
      </div>
      <span className="text-xs text-indigo-600 font-medium flex-shrink-0">View →</span>
    </div>
  );
}

function DashboardTab({ profile, loading, eiScore, eiBreakdown, jobs, goals, onTabChange, onNavigate, onOpenWizard, userId }: {
  profile: any; loading: boolean; eiScore: number;
  eiBreakdown: { total: number; components: EIComponent[] };
  jobs: JobApp[]; goals: CareerGoal[];
  onTabChange: (t: TabId) => void;
  onNavigate: (s: Screen | string, d?: Record<string, unknown>) => void;
  onOpenWizard: () => void;
  userId: string;
}) {
  const [showEIDetails, setShowEIDetails] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [showPeerDetails, setShowPeerDetails] = useState(false);
  const [showStageGuidance, setShowStageGuidance] = useState(false);
  const [showPassport, setShowPassport] = useState(false);
  const [lbiCard, setLbiCard] = useState<any>(null);
  useEffect(() => {
    if (!profile?.email) return;
    let cancelled = false;
    fetch(`/api/lbi/learner-profile?email=${encodeURIComponent(profile.email)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.learner?.overall_lbi != null) setLbiCard(d.learner); })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [profile?.email]);
  const stageGuidanceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const stageGuidanceCloseRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!showStageGuidance) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowStageGuidance(false); };
    document.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => stageGuidanceCloseRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
      stageGuidanceTriggerRef.current?.focus();
    };
  }, [showStageGuidance]);
  const hybridEI = useHybridEI(profile);
  const peerBenchmark = usePeerBenchmark(eiScore, hybridEI.versions);
  const completeness = profile?.competencyProfile?.completeness || 0;
  const techSkills = (profile?.skills?.technical || []).length;
  const expCount = (profile?.experience || []).length;
  const certCount = (profile?.certifications || []).length;
  const eduCount = (profile?.education || []).length;
  const openJobs = jobs.filter(j => !['Accepted','Rejected'].includes(j.status)).length;
  const completedGoals = goals.filter(g => g.completed).length;
  const userName = (profile?.personal?.name || 'Career Seeker').split(' ')[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  /* ── Stage trajectory ── */
  const STAGES = [
    { key: 'starter',      label: 'Starter',      min: 0  },
    { key: 'builder',      label: 'Builder',      min: 25 },
    { key: 'career-ready', label: 'Career-Ready', min: 50 },
    { key: 'hire-ready',   label: 'Hire-Ready',   min: 75 },
  ];
  const currentStageIdx = Math.max(0, [...STAGES].reverse().findIndex(s => eiScore >= s.min));
  const currentStage = STAGES[STAGES.length - 1 - currentStageIdx];
  const nextStage = STAGES[Math.min(STAGES.length - currentStageIdx, STAGES.length - 1)];
  const gapToNext = Math.max(0, nextStage.min - eiScore);
  // Peer percentile from the server-side benchmark engine (k-anonymous, version-pinned).
  // While the cohort is still under the k-anonymity floor, the API returns null —
  // we fall back to the deterministic stage-band heuristic ONLY for the visual
  // pointer position, and flag it clearly in the UI as "provisional".
  const peerPctFallback = eiScore < 20 ? 12 : eiScore < 35 ? 28 : eiScore < 50 ? 50 : eiScore < 65 ? 72 : 88;
  const peerPct = peerBenchmark.data?.percentile ?? peerPctFallback;
  // Provisional iff the backend explicitly suppressed (anonymity_met=false OR zero variance) OR data not yet loaded.
  const peerProvisional = !peerBenchmark.data || !peerBenchmark.data.cohort_anonymity_met || peerBenchmark.data.suppression_reason != null;

  /* ── Pragati daily brief ── */
  let brief = '';
  if (eiScore < 25)      brief = `Let's get you started — completing 3 quick steps below can lift your Employability Index by ~30 points today.`;
  else if (eiScore < 50) brief = `You're building well. Closing your top skill gaps and adding one more project can push you into "Career-Ready" territory.`;
  else if (eiScore < 75) brief = `You're close to "Hire-Ready". Two mock interviews and 3 tracked applications this week should do it.`;
  else                   brief = `Strong profile. Focus on quality applications and mentor referrals — you're ready for top roles.`;

  const openPragati = (msg?: string) => {
    try {
      sessionStorage.removeItem('mx-chat-dismissed');
      window.dispatchEvent(new CustomEvent('mx-open-chat', { detail: msg ? { message: msg } : undefined }));
    } catch {}
  };

  /* ── Onboarding checklist ── */
  const checklist = [
    { key: 'summary', label: 'Add a short bio',          done: !!profile?.summary,           tab: 'profile'  as TabId, impact: '+5'  },
    { key: 'skills',  label: 'List 3+ technical skills', done: techSkills >= 3,              tab: 'skills'   as TabId, impact: '+12' },
    { key: 'exp',     label: 'Add work / project',       done: expCount >= 1,                tab: 'profile'  as TabId, impact: '+15' },
    { key: 'edu',     label: 'Add your education',       done: eduCount >= 1,                tab: 'profile'  as TabId, impact: '+8'  },
    { key: 'goal',    label: 'Set your first goal',      done: goals.length >= 1,            tab: 'goals'    as TabId, impact: '+5'  },
  ];
  const checklistDone = checklist.filter(c => c.done).length;
  const showOnboarding = checklistDone < checklist.length;

  /* ── KPI tiles with non-zero CTAs ── */
  type Kpi = { label: string; value: number | string; sub: string; color: string; icon: React.ReactNode; cta?: string; onCta?: () => void; isEmpty: boolean; onClick?: () => void };
  const KPI: Kpi[] = [
    { label: 'Employability Index', value: eiScore,         sub: '/ 100',          color: eiScore >= 65 ? BRAND.green : BRAND.primary, icon: <Zap size={18}/>,        cta: 'Take assessment', onCta: () => onTabChange('assessment'), isEmpty: eiScore === 0, onClick: () => setShowEIDetails(true) },
    { label: 'Profile Complete',    value: `${completeness}%`, sub: 'filled',      color: BRAND.primary,                                icon: <User size={18}/>,       cta: 'Start filling',   onCta: () => onTabChange('profile'),    isEmpty: completeness === 0, onClick: () => setShowProfileDetails(true) },
    { label: 'Technical Skills',    value: techSkills,      sub: 'listed',         color: BRAND.accent,                                 icon: <Code size={18}/>,       cta: 'Add skills',      onCta: () => onTabChange('skills'),     isEmpty: techSkills === 0, onClick: () => onTabChange('skills') },
    { label: 'Active Applications', value: openJobs,        sub: 'in progress',    color: BRAND.primary,                                icon: <Briefcase size={18}/>,  cta: 'Track first',     onCta: () => onTabChange('jobs'),       isEmpty: openJobs === 0,   onClick: () => onTabChange('jobs') },
    { label: 'Goals',               value: goals.length === 0 ? '—' : `${completedGoals}/${goals.length}`, sub: goals.length === 0 ? 'none yet' : 'done', color: BRAND.green, icon: <Target size={18}/>, cta: 'Set first goal', onCta: () => onTabChange('goals'), isEmpty: goals.length === 0, onClick: () => onTabChange('goals') },
    { label: 'Experience',          value: expCount,        sub: `role${expCount !== 1 ? 's' : ''}`, color: BRAND.accent,               icon: <Briefcase size={18}/>,  cta: 'Add a role',      onCta: () => onTabChange('profile'),    isEmpty: expCount === 0,   onClick: () => onTabChange('profile') },
  ];

  /* ── Today's plan (ranked) ── */
  type Plan = { label: string; impact: string; mins: number; tab: TabId; icon: React.ReactNode };
  const planPool: Plan[] = [];
  if (!profile?.summary)           planPool.push({ label: 'Write a 2-line professional bio',     impact: '+5',  mins: 2,  tab: 'profile',   icon: <Edit3 size={14}/> });
  if (techSkills < 3)              planPool.push({ label: `Add ${3 - techSkills} technical skill${3-techSkills>1?'s':''}`,  impact: '+12', mins: 3,  tab: 'skills',    icon: <Code size={14}/> });
  if (expCount < 1)                planPool.push({ label: 'Add your most recent role or project', impact: '+15', mins: 5,  tab: 'profile',   icon: <Briefcase size={14}/> });
  if (eduCount < 1)                planPool.push({ label: 'Add your education',                   impact: '+8',  mins: 2,  tab: 'profile',   icon: <GraduationCap size={14}/> });
  if (goals.length === 0)          planPool.push({ label: 'Set 1 career goal for this month',     impact: '+5',  mins: 3,  tab: 'goals',     icon: <Target size={14}/> });
  if (eiScore >= 25 && openJobs < 3) planPool.push({ label: `Track ${3 - openJobs} job application${3-openJobs>1?'s':''}`, impact: '+8',  mins: 4,  tab: 'jobs',      icon: <Briefcase size={14}/> });
  if (eiScore >= 50)               planPool.push({ label: 'Practice a 10-min mock interview',     impact: '+10', mins: 10, tab: 'interview', icon: <MessageSquare size={14}/> });
  if (eiScore >= 50)               planPool.push({ label: 'Connect with a mentor',                impact: '+8',  mins: 5,  tab: 'mentors',   icon: <Users size={14}/> });
  if (certCount === 0 && eiScore >= 25) planPool.push({ label: 'Add 1 certification',             impact: '+6',  mins: 2,  tab: 'profile',   icon: <Award size={14}/> });
  const todayPlan = planPool.slice(0, 3);

  /* ── Concerns surfaced from profile state ── */
  type Concern = { tag: string; text: string; cta: string; tab: TabId };
  const concernPool: Concern[] = [];
  if (completeness < 30)               concernPool.push({ tag: 'Visibility',           text: 'Your profile is too sparse for recruiters to evaluate.',         cta: 'Complete profile', tab: 'profile' });
  if (techSkills < 3)                  concernPool.push({ tag: 'Skill clarity',        text: 'Without listed skills, you won\'t match keyword filters.',       cta: 'Add skills',       tab: 'skills' });
  if (expCount === 0)                  concernPool.push({ tag: 'Experience signal',    text: 'Add at least one project or role to be considered.',            cta: 'Add experience',   tab: 'profile' });
  if (goals.length === 0)              concernPool.push({ tag: 'Direction',            text: 'No goals set — Pragati can help you pick one in 3 minutes.',    cta: 'Set goals',        tab: 'goals' });
  if (openJobs === 0 && eiScore >= 25) concernPool.push({ tag: 'Application velocity', text: 'You haven\'t applied to any roles yet.',                         cta: 'Track jobs',       tab: 'jobs' });
  if (certCount === 0 && eiScore >= 35) concernPool.push({ tag: 'Credibility',         text: 'A single certification adds measurable trust signal.',           cta: 'Add certification',tab: 'profile' });
  const topConcerns = concernPool.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Career Command Center</h1>
          <p className="text-xs text-gray-500 mt-0.5">{greet}, {userName} · Stage: <span className="font-semibold" style={{ color: BRAND.primary }}>{currentStage.label}</span></p>
        </div>
        {/* Header CTA hidden when the completion banner is visible (avoids duplicate "go to profile" actions). */}
        {!(!loading && completeness < 25) && (
          <button onClick={() => onTabChange('profile')}
            className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50 transition-all">
            <Edit3 size={13} /> Update Profile
          </button>
        )}
      </div>

      {/* ── Fresher Banner (shown when no work experience detected) ── */}
      {expCount === 0 && (
        <div className="rounded-2xl p-4 flex items-center gap-4 border" style={{ background: '#f0f9f4', borderColor: '#a7d7c5' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: '#4ECDC4' }}>
            <GraduationCap size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800">Looks like you're a fresher 🎓</p>
            <p className="text-xs text-gray-500 mt-0.5">Check out the <strong>Fresher Hub</strong> — campus drive tracker, project portfolio, aptitude prep &amp; your first job guide.</p>
          </div>
          <button onClick={() => onTabChange('fresher-hub')}
            className="shrink-0 text-xs font-semibold text-white px-4 py-2 rounded-xl whitespace-nowrap"
            style={{ backgroundColor: '#4ECDC4' }}>
            Go to Fresher Hub →
          </button>
        </div>
      )}

      {/* ── Pragati Daily Brief ── */}
      <div className="rounded-2xl p-5 text-white relative overflow-hidden shadow-sm"
        style={{ background: `#1D3E8B` }}>
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: '#ffffff', backgroundSize: '14px 14px', pointerEvents: 'none' }} />
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full" style={{ background: `${BRAND.accent}` }} />
        <div className="relative flex items-start gap-4">
          <img src="/bots/bot4-white.png" alt="" className="w-14 h-14 shrink-0" style={{ animation: 'cbBobLite 3.2s ease-in-out infinite' }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND.accent }}>Pragati's Daily Brief</span>
              <span className="text-[10px] opacity-60">· {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
            <p className="text-xs opacity-90 leading-relaxed mb-3">{brief}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => openPragati(`Help me improve my Employability Index from ${eiScore}.`)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                style={{ backgroundColor: BRAND.accent, color: '#0d2354' }}>
                <MessageSquare size={12}/> Ask Pragati
              </button>
              <button onClick={() => onTabChange('assessment')}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/25 text-white hover:bg-white/10 transition-all flex items-center gap-1.5">
                <Activity size={12}/> Re-take assessment
              </button>
            </div>
          </div>
        </div>
        <style>{`@keyframes cbBobLite { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-3px) rotate(1deg)} }`}</style>
      </div>

      {/* ── Employability Passport ── */}
      <div className="rounded-2xl p-5 flex items-center gap-4 shadow-sm bg-white border border-gray-100">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white" style={{ background: BRAND.primary }}>
          <FileText size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">Employability Passport</p>
          <p className="text-xs text-gray-500 mt-0.5">One shareable profile of your competencies, skills, readiness &amp; verified credentials — share a private link with recruiters.</p>
        </div>
        <button onClick={() => setShowPassport(true)}
          className="shrink-0 text-xs font-semibold px-4 py-2 rounded-xl text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: BRAND.primary }}>
          Open Passport →
        </button>
      </div>
      {showPassport && (
        <PassportOwnerModal userId={userId} profile={profile} eiScore={eiScore} eiBreakdown={eiBreakdown} onClose={() => setShowPassport(false)} />
      )}

      {/* ── MEI v2 Score Dashboard ── */}
      {userId && <MEIDashboard userId={userId} />}

      {/* ── E2: Competency Readiness Ring ── */}
      <CompetencyRingWidget onNavigate={onNavigate} />

      {/* ── Profile completion CTA (when very low completeness) ── */}
      {!loading && completeness < 25 && (
        <div className="rounded-2xl p-5 flex items-center gap-4 shadow-sm"
          style={{ background: `${BRAND.accent}`, border: `1px solid ${BRAND.accent}30` }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: BRAND.accent, color: '#fff' }}>
            <User size={22} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800">Your profile is only {completeness}% complete</p>
            <p className="text-xs text-gray-500 mt-0.5">Complete the quick setup wizard to unlock recruiter visibility and personalised job matches.</p>
          </div>
          <button onClick={onOpenWizard}
            className="shrink-0 text-xs font-semibold px-4 py-2 rounded-xl text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: BRAND.accent }}>
            Complete Setup
          </button>
        </div>
      )}

      {/* ── Onboarding checklist ── */}
      {showOnboarding && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}18`, color: BRAND.accent }}>
                <Sparkles size={14}/>
              </span>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Unlock your full dashboard</h3>
                <p className="text-[11px] text-gray-500">{checklistDone}/{checklist.length} steps done · ~15 min total</p>
              </div>
            </div>
            <div className="text-[10px] font-semibold px-2 py-1 rounded-md" style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary }}>
              +{checklist.filter(c => !c.done).reduce((s, c) => s + parseInt(c.impact), 0)} EI potential
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-4">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(checklistDone/checklist.length)*100}%`, background: `${BRAND.primary}` }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {checklist.map(c => (
              <button key={c.key} onClick={() => !c.done && onTabChange(c.tab)} disabled={c.done}
                className={`text-left p-3 rounded-xl border text-xs transition-all ${c.done ? 'border-teal-100 bg-teal-50/40 cursor-default' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm hover:bg-gray-50'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {c.done ? <CheckCircle size={13} className="text-teal-600 shrink-0"/> : <Circle size={13} className="text-gray-300 shrink-0"/>}
                  <span className={`font-medium ${c.done ? 'text-teal-700 line-through' : 'text-gray-800'}`}>{c.label}</span>
                </div>
                {!c.done && (
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] font-semibold" style={{ color: BRAND.accent }}>{c.impact} EI</span>
                    <ArrowRight size={11} className="text-gray-400"/>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI row with non-zero CTAs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPI.map(k => {
          const clickable = !!k.onClick && !k.isEmpty;
          return (
            <div key={k.label}
              onClick={clickable ? k.onClick : undefined}
              className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-1 min-h-[112px] ${clickable ? 'cursor-pointer hover:border-gray-300 hover:shadow-md transition-all' : ''}`}>
              <div className="flex items-center justify-between">
                <span style={{ color: k.color }}>{k.icon}</span>
                <span className="text-[10px] text-gray-400">{k.sub}</span>
              </div>
              {k.isEmpty && k.cta ? (
                <button onClick={k.onCta} className="text-left mt-1 group">
                  <div className="text-[11px] font-semibold leading-snug" style={{ color: k.color }}>{k.cta}</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 group-hover:gap-1.5 transition-all">
                    Start <ArrowRight size={10}/>
                  </div>
                </button>
              ) : (
                <>
                  <div className="text-xl font-bold" style={{ color: k.color }}>{k.value}</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-1">
                    {k.label}
                    {clickable && <Info size={9} className="text-gray-300"/>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── LBI Intelligence mini-card ── */}
      {lbiCard?.overall_lbi != null && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${BRAND.primary}12` }}>
                <Brain size={18} style={{ color: BRAND.primary }} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Learning Behaviour Index</p>
                <p className="text-[11px] text-gray-400">{lbiCard.sessions_analyzed ?? 0} sessions · 5 behavioural dimensions</p>
              </div>
            </div>
            <button onClick={() => onTabChange('lbi')}
              className="flex items-center gap-0.5 text-xs font-medium hover:underline"
              style={{ color: BRAND.primary }}>
              Full report <ChevronRight size={11} />
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <div className="col-span-1 flex flex-col items-center justify-center py-1">
              <div className="text-3xl font-black" style={{ color: BRAND.primary }}>{Math.round(lbiCard.overall_lbi)}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Overall</div>
              <span className="mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                style={{
                  background: lbiCard.lbi_band === 'high' || lbiCard.lbi_band === 'exceptional' ? '#D1FAE5'
                    : lbiCard.lbi_band === 'developing' ? '#EEF2FF' : '#FEF3C7',
                  color: lbiCard.lbi_band === 'high' || lbiCard.lbi_band === 'exceptional' ? '#10B981'
                    : lbiCard.lbi_band === 'developing' ? BRAND.primary : '#F59E0B',
                }}>
                {(lbiCard.lbi_band ?? 'scored').replace('_', ' ')}
              </span>
            </div>
            {([
              { label: 'Consistency', key: 'consistency_score', color: '#344E86' },
              { label: 'Persistence', key: 'persistence_score', color: '#4ECDC4' },
              { label: 'Attention',   key: 'attention_score',   color: '#6366F1' },
              { label: 'Adaptability',key: 'adaptability_score',color: '#10B981' },
              { label: 'Velocity',    key: 'velocity_score',    color: '#F59E0B' },
            ] as const).map(d => (
              <div key={d.key} className="flex flex-col">
                <div className="text-[10px] text-gray-400 mb-1">{d.label}</div>
                <div className="flex-1 h-14 bg-gray-50 rounded-xl relative overflow-hidden border border-gray-100">
                  <div className="absolute bottom-0 left-0 right-0 rounded-b-xl transition-all duration-700"
                    style={{ height: `${Math.min(100, lbiCard[d.key] ?? 0)}%`, backgroundColor: `${d.color}25` }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black" style={{ color: d.color }}>
                      {lbiCard[d.key] != null ? Math.round(lbiCard[d.key]) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {lbiCard.learning_style && (
            <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Zap size={11} style={{ color: BRAND.primary }} />
                Style: <span className="font-semibold capitalize text-gray-700 ml-1">{lbiCard.learning_style}</span>
              </span>
              {lbiCard.top_strengths?.[0] && (
                <span className="flex items-center gap-1">
                  <Star size={11} className="text-amber-400" />
                  Top strength: <span className="font-semibold text-gray-700 ml-1">{lbiCard.top_strengths[0]?.label ?? lbiCard.top_strengths[0]}</span>
                </span>
              )}
              {lbiCard.risk_level && lbiCard.risk_level !== 'none' && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertCircle size={11} />
                  {lbiCard.risk_level} risk signal
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── EI Trajectory + Concerns ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Trajectory */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><TrendingUp size={14} style={{ color: BRAND.primary }}/> Your trajectory</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Where you are on the path to Hire-Ready</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" style={{ color: BRAND.primary }}>{eiScore}</div>
              <div className="text-[10px] text-gray-400">Employability Index™ / 100</div>
            </div>
          </div>

          {/* Stage stepper */}
          <div className="relative mb-5">
            <div className="absolute left-2 right-2 top-3 h-1 rounded-full bg-gray-100"/>
            <div className="absolute left-2 top-3 h-1 rounded-full transition-all duration-700" style={{ width: `calc(${eiScore}% - 4px)`, background: `${BRAND.primary}`, maxWidth: 'calc(100% - 16px)' }}/>
            <div className="relative flex justify-between">
              {STAGES.map((s, i) => {
                const reached = eiScore >= s.min;
                const isCurrent = s.key === currentStage.key;
                return (
                  <div key={s.key} className="flex flex-col items-center" style={{ width: 80 }}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${isCurrent ? 'bg-white scale-110' : reached ? 'text-white' : 'bg-white text-gray-400'}`}
                      style={{ borderColor: reached ? BRAND.primary : '#e5e7eb', backgroundColor: reached && !isCurrent ? BRAND.primary : isCurrent ? '#fff' : '#fff', color: isCurrent ? BRAND.primary : reached ? '#fff' : '#9ca3af', boxShadow: isCurrent ? `0 0 0 4px ${BRAND.primary}20` : 'none' }}>
                      {reached ? '✓' : i + 1}
                    </div>
                    <div className={`text-[10px] mt-2 font-semibold ${isCurrent ? '' : 'text-gray-400'}`} style={{ color: isCurrent ? BRAND.primary : undefined }}>{s.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Peer benchmark — click to see methodology, cohort & legal basis */}
          <button onClick={() => setShowPeerDetails(true)}
            className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-xl p-3 mb-3 transition-colors group"
            aria-label={peerProvisional
              ? 'Peer benchmark — provisional estimate while peer cohort builds. Click to learn more.'
              : 'Peer benchmark — click to see methodology, cohort and legal basis.'}>
            <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
                Peer benchmark
                {peerProvisional && (
                  <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 border"
                    style={{ background: '#fef3c7', color: '#78350f', borderColor: '#fcd34d' }}
                    title="Live peer cohort is still building. The shown position is a deterministic estimate based on your stage band, not a real cohort percentile. The exact number appears once 30+ same-version peers exist.">
                    <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706', display: 'inline-block', animation: 'pulse 1.6s ease-in-out infinite' }}/>
                    Provisional · cohort building
                  </span>
                )}
                <Info size={9} className="text-gray-300 group-hover:text-gray-500 transition-colors"/>
              </span>
              <span className="text-[10px] font-semibold" style={{ color: peerProvisional ? '#92400e' : (peerPct >= 50 ? BRAND.green : BRAND.primary) }}>
                {peerProvisional ? '~ estimate' : `Top ${100 - peerPct}%`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white relative overflow-hidden"
              style={peerProvisional ? {
                backgroundImage: 'repeating-linear-gradient(45deg, #fef3c7 0, #fef3c7 4px, #fde68a 4px, #fde68a 8px)',
              } : undefined}>
              <div className="absolute inset-y-0 left-[20%] right-[20%]" style={{ background: peerProvisional ? 'rgba(217,119,6,0.10)' : 'rgba(229,231,235,0.6)' }}/>
              <div className="absolute top-0 bottom-0 w-1 rounded-full transition-all duration-700"
                style={{
                  left: `${peerPct}%`,
                  backgroundColor: peerProvisional ? '#d97706' : BRAND.accent,
                  transform: 'translateX(-50%)',
                  opacity: peerProvisional ? 0.55 : 1,
                  boxShadow: peerProvisional ? '0 0 0 2px #fff, 0 0 0 3px #d97706' : undefined,
                }}/>
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 mt-1"><span>Bottom</span><span>Median</span><span>Top</span></div>
            {peerProvisional && (
              <p className="text-[10px] mt-2 leading-snug" style={{ color: '#78350f' }}>
                Live peer cohort hasn't reached the 30-person privacy floor for your assessment version yet, so this position is an <b>indicative estimate</b> — not a real peer percentile. Click for full methodology.
              </p>
            )}
          </button>

          {/* Gap to next */}
          {gapToNext > 0 ? (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${BRAND.accent}40`, background: `${BRAND.accent}08` }}>
              <div className="flex items-center justify-between p-3">
                <div>
                  <div className="text-[11px] text-gray-500">Gap to next stage</div>
                  <div className="text-sm font-bold" style={{ color: BRAND.primary }}>{gapToNext} pts to {nextStage.label}</div>
                </div>
                <button onClick={() => setShowStageGuidance(v => !v)}
                  ref={stageGuidanceTriggerRef}
                  aria-expanded={showStageGuidance}
                  aria-haspopup="dialog"
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                  style={{ backgroundColor: BRAND.primary, color: '#fff' }}>
                  {showStageGuidance ? 'Hide guidance' : 'Show me how'}
                  {showStageGuidance
                    ? <ChevronUp size={11}/>
                    : <ArrowRight size={11}/>}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold" style={{ backgroundColor: `${BRAND.green}12`, color: BRAND.green }}>
              <Trophy size={14}/> You've reached the top stage — keep refining.
            </div>
          )}

          {showStageGuidance && gapToNext > 0 && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label="Stage guidance"
              onClick={() => setShowStageGuidance(false)}
            >
              <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowStageGuidance(false)}
                  ref={stageGuidanceCloseRef}
                  aria-label="Close guidance"
                  className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/90 hover:bg-gray-100 text-gray-600 hover:text-gray-900 shadow-sm"
                >
                  <X size={16}/>
                </button>
                <StageGuidanceErrorBoundary fallback={null}>
                  <StageGuidancePanel
                    currentStage={currentStage.label}
                    nextStage={nextStage.label}
                    gapToNext={gapToNext}
                    eiScore={eiScore}
                    sessionId={userId || `anon-${currentStage.label}`}
                    userId={userId || undefined}
                    onAskPragati={() => { openPragati(`I'm in the ${currentStage.label} band at EI ${eiScore}. Walk me through a personalised plan to reach ${nextStage.label}.`); setShowStageGuidance(false); }}
                    onGoToTab={(t) => { onTabChange(t); setShowStageGuidance(false); }}
                  />
                </StageGuidanceErrorBoundary>
              </div>
            </div>
          )}
        </div>

        {/* Concerns flagged */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <AlertCircle size={14} style={{ color: BRAND.orange }}/> Concerns flagged for you
            </h3>
            <span className="text-[10px] text-gray-400">{topConcerns.length} active</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400"><RefreshCw size={12} className="animate-spin"/> Analysing your profile…</div>
          ) : topConcerns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: `${BRAND.green}15` }}>
                <CheckCircle size={20} style={{ color: BRAND.green }}/>
              </div>
              <p className="text-xs font-semibold text-gray-700">No active concerns</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Your profile is in good shape.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {topConcerns.map((c, i) => (
                <li key={i} className="p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BRAND.orange}18`, color: '#b45309' }}>{c.tag}</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-snug mb-2">{c.text}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onTabChange(c.tab)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: BRAND.primary, color: '#fff' }}>
                      {c.cta} →
                    </button>
                    <button onClick={() => openPragati(`Tell me more about: ${c.text}`)} className="text-[11px] text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline">
                      Ask Pragati
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Future Role Spotlight + Top Job Matches ── */}
      <FutureRoleSpotlight profile={profile} onTabChange={onTabChange} />

      {/* ── Competency Radar mini + Visibility Meter ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CompetencyRadarMini profile={profile} onTabChange={onTabChange} />
        <VisibilityMeterCard profile={profile} eiScore={eiScore} onTabChange={onTabChange} />
      </div>

      {/* ── Top Job Matches (real fitment) ── */}
      <TopJobMatchesCard profile={profile} jobs={jobs} onTabChange={onTabChange} />

      {/* ── Today's Plan (replaces Quick Actions) ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>
              <Flame size={14}/>
            </span>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Today's plan</h3>
              <p className="text-[11px] text-gray-500">3 actions ranked by impact for your stage</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${BRAND.orange}15`, color: '#b45309' }}>
            <Flame size={11}/> Day 1 streak
          </div>
        </div>
        {todayPlan.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Trophy size={20} className="mb-1.5" style={{ color: BRAND.green }}/>
            <p className="text-xs font-semibold text-gray-700">All caught up for today</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Pragati will refresh your plan tomorrow.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayPlan.map((p, i) => (
              <button key={i} onClick={() => onTabChange(p.tab)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm hover:bg-gray-50 transition-all text-left">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ backgroundColor: BRAND.primary, color: '#fff' }}>{i + 1}</span>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800">{p.label}</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1"><Clock size={9}/> {p.mins} min</span>
                    <span>·</span>
                    <span className="font-semibold" style={{ color: BRAND.green }}>{p.impact} EI</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-gray-400 shrink-0"/>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent jobs + goals side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Recent Applications" icon={<Briefcase size={16} />}
          action={<button onClick={() => onTabChange('jobs')} className="text-[10px]" style={{ color: BRAND.primary }}>View all →</button>}>
          {jobs.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400">No applications yet. Start tracking your job search.</div>
          ) : (
            <div className="space-y-2">
              {jobs.slice(0, 4).map(j => (
                <div key={j._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-xs font-medium text-gray-800">{j.role}</div>
                    <div className="text-[10px] text-gray-400">{j.company}</div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: `${STAGE_COLORS[j.status]}18`, color: STAGE_COLORS[j.status] }}>
                    {j.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Active Goals" icon={<Target size={16} />}
          action={<button onClick={() => onTabChange('goals')} className="text-[10px]" style={{ color: BRAND.primary }}>View all →</button>}>
          {goals.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400">No goals set yet. Set your career milestones.</div>
          ) : (
            <div className="space-y-2">
              {goals.slice(0, 4).map(g => (
                <div key={g._id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                  {g.completed ? <CheckCircle size={13} style={{ color: BRAND.green }} /> : <Circle size={13} className="text-gray-300" />}
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium truncate ${g.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{g.title}</div>
                    <div className="text-[10px] text-gray-400">{g.category} · {g.priority} Priority</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Reference Intelligence (Phase 2) — canonical resolution & provenance ── */}
      <EIProvenanceCard
        resolution={hybridEI.resolution}
        official={hybridEI.official}
        trusted={hybridEI.trusted}
        trust={hybridEI.trust}
        isOfficial={hybridEI.isOfficial}
        isLoading={hybridEI.isLoading}
        fallbackUsed={hybridEI.fallbackUsed}
        previewScore={hybridEI.preview.score}
        confidenceDetail={hybridEI.confidenceDetail}
        versions={hybridEI.versions}
      />

      {/* ── Employability Index breakdown modal ── */}
      {showEIDetails && (
        <EIDetailsModal
          score={eiScore}
          components={eiBreakdown.components}
          onClose={() => setShowEIDetails(false)}
          onGoToTab={(t) => { setShowEIDetails(false); onTabChange(t); }}
        />
      )}

      {/* ── Profile Completeness breakdown modal ── */}
      {showProfileDetails && (
        <ProfileCompletenessModal
          profile={profile}
          completeness={completeness}
          onClose={() => setShowProfileDetails(false)}
          onGoToTab={(t) => { setShowProfileDetails(false); onTabChange(t); }}
          onOpenWizard={() => { setShowProfileDetails(false); onOpenWizard(); }}
        />
      )}

      {/* ── Peer Benchmark methodology / cohort / legal modal ── */}
      {showPeerDetails && (
        <PeerBenchmarkModal
          eiScore={eiScore}
          benchmark={peerBenchmark.data}
          loading={peerBenchmark.loading}
          error={peerBenchmark.error}
          onClose={() => setShowPeerDetails(false)}
          onShowMeHow={() => {
            setShowPeerDetails(false);
            setShowStageGuidance(true);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PEER BENCHMARK — Hook + Modal
// Hits /api/ei/peer-benchmark with the user's EI score + version quad.
// Cohort source, k-anonymity, methodology and legal basis are explained in
// the modal. The hook is silent on failure — caller falls back gracefully.
// ═══════════════════════════════════════════════════════════════════════════

type PeerBenchmarkData = {
  score: number;
  z_score: number;
  percentile: number | null;
  rank_label: string;
  position_in_band: number;
  cohort: {
    // All numeric fields are null when cohort_anonymity_met=false (hard
    // redaction at the service layer — sub-k cohort exposes no distribution).
    n: number | null; mean: number | null; std: number | null;
    p25: number | null; p50: number | null; p75: number | null; p90: number | null;
    scope: 'stage_band' | 'all_stages';
    scope_label: string;
  };
  cohort_anonymity_met: boolean;
  min_cohort_size: number;
  suppression_reason: 'insufficient_cohort' | 'zero_variance' | null;
  confidence_interval_low: number;
  confidence_interval_high: number;
  current_stage: { key: string; label: string; min: number; max: number };
  next_stage:    { key: string; label: string; min: number; max: number } | null;
  pts_to_next_stage: number;
  people_ahead_in_band: number | null;
  methodology_version: string;
  ei_version: string;
  ruleset_version: string;
  computed_at: string;
};

function usePeerBenchmark(eiScore: number, versions: { ei_version: string; ruleset_version: string } | null) {
  const [data, setData] = useState<PeerBenchmarkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eiVersion = versions?.ei_version;
  const rulesetVersion = versions?.ruleset_version;
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    // Clear stale benchmark on every input transition so the UI never shows
    // the prior cohort's percentile against a new score/version pair.
    inflight.current?.abort();
    setData(null);
    setError(null);
    if (!eiVersion || !rulesetVersion || !Number.isFinite(eiScore)) {
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    inflight.current = ac;
    setLoading(true);
    const url = `/api/ei/peer-benchmark?score=${encodeURIComponent(eiScore)}&ei_version=${encodeURIComponent(eiVersion)}&ruleset_version=${encodeURIComponent(rulesetVersion)}`;
    fetch(url, { signal: ac.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(j => { if (j?.ok && j.benchmark) setData(j.benchmark); else throw new Error(j?.error || 'malformed response'); })
      .catch(e => { if (e?.name !== 'AbortError') setError(String(e?.message || e)); })
      .finally(() => { if (inflight.current === ac) { setLoading(false); inflight.current = null; } });
    return () => ac.abort();
  }, [eiScore, eiVersion, rulesetVersion]);

  return { data, loading, error };
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE GUIDANCE — inline "Show me how" panel
// Stage-specific, actionable guidance shown directly on the dashboard so users
// get an immediate answer. The "Ask Pragati" button below is an escape hatch
// for users who want personalised, conversational coaching.
// ═══════════════════════════════════════════════════════════════════════════

type StageGuidance = {
  intro: string;
  steps: { title: string; detail: string; tab?: TabId; estImpact: string }[];
  expectedTime: string;
};

const STAGE_GUIDANCE: Record<string, StageGuidance> = {
  'Builder': {
    intro: 'You\'re in the Starter band. The Builder stage rewards a complete profile and basic skill evidence — close these gaps to unlock recruiter visibility.',
    expectedTime: '~2–3 hours of focused work',
    steps: [
      { title: 'Complete your profile basics',  detail: 'Add a short bio, your education, and one work or project entry. Recruiters filter out profiles below 60% completeness.', tab: 'profile', estImpact: '+15 EI' },
      { title: 'List 5+ technical skills',       detail: 'Pick the skills most relevant to your target role. Each tagged skill is matched against role-DNA in the background.', tab: 'skills',  estImpact: '+12 EI' },
      { title: 'Take the core competency check', detail: 'A 12-minute behavioural assessment that anchors your competency baseline. Without it, peer benchmarks stay provisional.', tab: 'assessment', estImpact: '+10 EI' },
    ],
  },
  'Career-Ready': {
    intro: 'You\'re solidly in the Builder band. Career-Ready means a recruiter can see you as an immediate fit — evidence > claims at this stage.',
    expectedTime: '~1–2 weeks of consistent work',
    steps: [
      { title: 'Ship one portfolio project',           detail: 'Add a measurable outcome (metric, scale, impact). Generic project descriptions add almost nothing to your score.', tab: 'profile', estImpact: '+10 EI' },
      { title: 'Close your top 2 skill gaps',          detail: 'The Skills Lab shows the gaps that matter most for your target role — courses are pre-sequenced.', tab: 'skills',  estImpact: '+8 EI' },
      { title: 'Run 2 mock interviews',                detail: 'Behavioural + role-specific. The transcript feeds your competency profile, so weak answers actually improve your score over time.', tab: 'interview', estImpact: '+6 EI' },
      { title: 'Set a clear 90-day goal',              detail: 'Career-Ready candidates show direction. A specific role + target company + date is worth more than a vague "growth" goal.', tab: 'goals',   estImpact: '+4 EI' },
    ],
  },
  'Hire-Ready': {
    intro: 'You\'re in the Career-Ready band — you have evidence + direction. Hire-Ready is about signal density: recruiters need to see traction.',
    expectedTime: '~3–4 weeks of consistent application',
    steps: [
      { title: 'Track 5+ active applications',         detail: 'Use the Job Tracker. Hire-Ready signals require visible momentum, not just readiness.', tab: 'jobs',    estImpact: '+8 EI' },
      { title: 'Get 1 mentor endorsement',             detail: 'Mentor Connect — a verified endorsement on a competency carries ~3× the weight of a self-claim.', tab: 'mentors', estImpact: '+10 EI' },
      { title: 'Polish 1 case-study or technical write-up', detail: 'Recruiter Visibility ranks profiles with at least one long-form artefact above those with only a CV.', tab: 'profile', estImpact: '+5 EI' },
      { title: 'Run a recruiter-grade interview prep cycle', detail: '5 sessions covering behavioural, technical, system-design. Builds the response patterns recruiters score against.', tab: 'interview', estImpact: '+7 EI' },
    ],
  },
};

class StageGuidanceErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[StageGuidancePanel] render crash:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="px-4 pb-4 pt-3 border-t" style={{ borderColor: `${BRAND.accent}40` }}>
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-[11px] font-semibold text-red-800">Guidance failed to render.</p>
            <p className="text-[10.5px] text-red-700 mt-1 leading-snug">
              {this.state.error.message || 'Unknown error.'} Check the browser console for the full stack.
            </p>
          </div>
          {this.props.fallback}
        </div>
      );
    }
    return this.props.children;
  }
}

function StageGuidancePanel({
  currentStage, nextStage, gapToNext, eiScore,
  sessionId, userId,
  onAskPragati, onGoToTab,
}: {
  currentStage: string;
  nextStage: string;
  gapToNext: number;
  eiScore: number;
  sessionId: string;
  userId?: string;
  onAskPragati: () => void;
  onGoToTab: (t: TabId) => void;
}) {
  // NOTE: demo:true is an interim opt-in until real per-user competency-score
  // and reliability-response plumbing reaches this surface. Without it the API
  // (correctly) refuses to synthesise data and returns its static fallback envelope.
  const { data, loading, error } = useStageGuidance({ sessionId, userId, demo: true });
  const [showMethod, setShowMethod] = useState(false);

  // Static fallback content — preserved verbatim from Phase 0
  const staticGuidance = STAGE_GUIDANCE[nextStage] ?? {
    intro: `Closing the ${gapToNext}-point gap to ${nextStage} unlocks the next band.`,
    steps: [],
    expectedTime: '~1–2 weeks',
  };

  // Decide whether to render the evidence-driven view or the static fallback.
  // We render evidence whenever: not loading, no hard error, payload present,
  // not flagged static, AND at least one ranked_step came back.
  const useEvidence = !!data && !data.static_fallback_used && (data.ranked_steps?.length ?? 0) > 0;
  const showLoading = loading && !data;

  // Active dimension filter — click a Role-requirement coverage card to filter the ranked sequence.
  const [dimensionFilter, setDimensionFilter] = useState<string | null>(null);
  const visibleSteps = useMemo(() => {
    if (!data?.ranked_steps) return [];
    return dimensionFilter ? data.ranked_steps.filter(s => s.dimension === dimensionFilter) : data.ranked_steps;
  }, [data?.ranked_steps, dimensionFilter]);

  return (
    <div id="stage-guidance-panel" className="px-4 pb-4 pt-1 border-t" style={{ borderColor: `${BRAND.accent}40` }}>
      {/* Intro line + target role chip */}
      <div className="flex items-start justify-between gap-3 mt-3 mb-2 flex-wrap">
        <p className="text-[11.5px] text-gray-700 leading-relaxed flex-1 min-w-[180px]">
          {staticGuidance.intro}{' '}
          <span className="text-gray-500">· {staticGuidance.expectedTime}</span>
        </p>
        {useEvidence && data?.target_role && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
            style={{ background: `${BRAND.primary}10`, color: BRAND.primary, border: `1px solid ${BRAND.primary}30` }}
            aria-label={`Target role: ${data.target_role.name}`}>
            Target · {data.target_role.name}
          </span>
        )}
      </div>

      {/* Reliability banner (only if C or D) */}
      {useEvidence && data?.reliability && (data.reliability.quality_tier === 'C' || data.reliability.quality_tier === 'D') && (
        <div role="status" className="mb-2 px-2.5 py-1.5 rounded-lg text-[10.5px] leading-snug"
          style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#78350f' }}>
          Underlying evidence confidence is limited (tier {data.reliability.quality_tier}). Recommendations should be treated as directional.
        </div>
      )}

      {/* Loading shimmer */}
      {showLoading && (
        <div aria-busy="true" className="space-y-1.5 mb-2">
          <div className="h-3 rounded bg-gray-100 animate-pulse w-3/4"/>
          <div className="h-3 rounded bg-gray-100 animate-pulse w-2/3"/>
        </div>
      )}

      {/* ───── EVIDENCE-DRIVEN VIEW ───── */}
      {useEvidence && data && (
        <>
          {/* Weighted gap decomposition (top 3) */}
          {data.gap_decomposition.filter(g => g.gap_pts > 0).slice(0, 3).length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Top weighted gaps</p>
              <div className="space-y-1.5">
                {data.gap_decomposition.filter(g => g.gap_pts > 0).slice(0, 3).map(g => (
                  <GapBar key={g.competency_id} g={g}/>
                ))}
              </div>
            </div>
          )}

          {/* Role-requirement coverage strip (Phase 6) — click a card to filter the ranked sequence */}
          {data.requirement_summary && (
            <RequirementCoverageStrip summary={data.requirement_summary}
              activeDimension={dimensionFilter}
              onSelectDimension={(k) => setDimensionFilter(prev => prev === k ? null : k)} />
          )}

          {/* Ranked steps */}
          <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Recommended sequence · ranked by ROI · 6-dimension
              {dimensionFilter && <span className="ml-1.5 normal-case font-normal text-gray-400">· filtered to {DIMENSION_META[dimensionFilter]?.label || dimensionFilter}</span>}
            </p>
            {dimensionFilter && (
              <button onClick={() => setDimensionFilter(null)}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-gray-200 hover:border-gray-400 text-gray-600">
                Clear filter ×
              </button>
            )}
          </div>
          {visibleSteps.length === 0 && dimensionFilter && (
            <p className="text-[11px] text-gray-500 italic mb-2 px-3 py-2 bg-gray-50 rounded-lg">
              No ranked steps in this dimension right now. <button onClick={() => setDimensionFilter(null)} className="underline" style={{ color: BRAND.primary }}>Show all</button>
            </p>
          )}
          <ol className="space-y-2">
            {visibleSteps.map((s, i) => (
              <li key={s.id} className="bg-white rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{ background: `${BRAND.primary}12`, color: BRAND.primary }} aria-hidden="true">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <DimensionChip dimension={s.dimension} />
                        {s.importance && <ImportancePill importance={s.importance} />}
                        <p className="text-[12px] font-semibold text-gray-900 leading-snug">{s.title}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded"
                          style={{ background: `${BRAND.green}15`, color: BRAND.green }}
                          title={`95% interval: ${s.confidence_interval.min}–${s.confidence_interval.max} EI`}>
                          +{s.projected_ei_lift.toFixed(1)} ±{((s.confidence_interval.max - s.confidence_interval.min) / 2).toFixed(1)} EI
                        </span>
                        <ConfidencePill tier={s.confidence_tier}/>
                      </div>
                    </div>
                    <p className="text-[10.5px] text-gray-500 leading-snug mb-1">
                      Effort: ~{s.effort_hours}h · ROI score {s.roi_score.toFixed(2)}
                    </p>
                    <p className="text-[11px] text-gray-700 leading-snug">{s.rationale}</p>
                    {s.why_recommended.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {s.why_recommended.map((w, k) => (
                          <li key={k} className="text-[10.5px] text-gray-500 leading-snug flex items-start gap-1.5">
                            <span className="text-gray-400 mt-0.5">▸</span><span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.behavioural_indicators.length > 0 && (
                      <p className="mt-1 text-[10.5px] italic text-gray-500 leading-snug">
                        e.g. {s.behavioural_indicators[0]}
                      </p>
                    )}
                    <button onClick={() => {
                        // Parse tab from the orchestrator-supplied CTA route so each
                        // step deep-links to the correct tab (skills / pathways / …)
                        // rather than always falling back to 'skills'.
                        try {
                          const u = new URL(s.cta.route, window.location.origin);
                          const t = u.searchParams.get('tab') as TabId | null;
                          const validTabs: TabId[] = ['dashboard','profile','skills','resume','jobs','interview','learning','pathways','mentors','goals','assessment','future-map','development','visibility','fresher-hub','simulations','market-intel','velocity','workforce','weekly-plan','next-actions','behavioral-growth','career-memory','career-graph','career-recs','career-tracks','career-paths','learning-intel','lbi','future-readiness','career-passport','forecast-dashboard','growth-roadmap','what-if','rec-history','intelligence-hub','hiring-readiness','prediction-trust','my-workforce'];
                          onGoToTab(t && validTabs.includes(t) ? t : 'skills');
                        } catch { onGoToTab('skills'); }
                      }}
                      className="mt-1.5 text-[10.5px] font-semibold inline-flex items-center gap-1 hover:underline"
                      style={{ color: BRAND.primary }}>
                      {s.cta.label} <ArrowRight size={9}/>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {/* Adjacent offramp */}
          {data.adjacent_offramp && (
            <div className="mt-3 p-3 rounded-lg border" style={{ background: `${BRAND.accent}08`, borderColor: `${BRAND.accent}40` }}>
              <p className="text-[11px] font-semibold text-gray-800 leading-snug">
                Easier reachable path: <span style={{ color: BRAND.primary }}>{data.adjacent_offramp.role_name}</span>
              </p>
              <p className="text-[10.5px] text-gray-600 leading-snug mt-0.5">
                Closes {(data.adjacent_offramp.current_gap - data.adjacent_offramp.projected_gap).toFixed(1)} pts more of your composite gap.
                Switchability {(data.adjacent_offramp.switchability * 100).toFixed(0)}%.
              </p>
            </div>
          )}

          {/* Behavioural Intelligence (Phase 2) */}
          <BehaviouralIntelligenceSection sessionId={sessionId} userId={userId} />
        </>
      )}

      {/* ───── STATIC FALLBACK VIEW ───── */}
      {!useEvidence && !showLoading && (
        <>
          {error && (
            <div role="status" className="mb-2 px-2.5 py-1.5 rounded-lg text-[10.5px] leading-snug bg-gray-50 border border-gray-200 text-gray-600">
              Showing stage-level guidance while personalised intelligence is unavailable.
            </div>
          )}
          {data?.static_fallback_used && data.fallback_reason && (
            <div role="status" className="mb-2 px-2.5 py-1.5 rounded-lg text-[10.5px] leading-snug bg-gray-50 border border-gray-200 text-gray-600">
              Personalised guidance is calibrating — showing stage-level steps for now.
            </div>
          )}
          <ol className="space-y-2 mt-2">
            {staticGuidance.steps.map((s, i) => (
              <li key={i} className="bg-white rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{ background: `${BRAND.primary}12`, color: BRAND.primary }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-[12px] font-semibold text-gray-900 leading-snug">{s.title}</p>
                      <span className="text-[9px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded" style={{ background: `${BRAND.green}15`, color: BRAND.green }}>{s.estImpact}</span>
                    </div>
                    <p className="text-[11px] text-gray-600 leading-snug">{s.detail}</p>
                    {s.tab && (
                      <button onClick={() => onGoToTab(s.tab!)}
                        className="mt-1.5 text-[10.5px] font-semibold inline-flex items-center gap-1 hover:underline" style={{ color: BRAND.primary }}>
                        Go to {s.tab.charAt(0).toUpperCase() + s.tab.slice(1)} <ArrowRight size={9}/>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* Footer: explainability + Ask Pragati */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
        <button onClick={() => setShowMethod(true)}
          className="text-[10.5px] text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline inline-flex items-center gap-1"
          aria-label="Open methodology disclosure">
          <Info size={10}/> How we computed this
        </button>
        <button onClick={onAskPragati}
          className="text-[10.5px] font-semibold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors hover:opacity-90"
          style={{ background: '#fff', color: BRAND.primary, border: `1px solid ${BRAND.primary}40` }}>
          <Sparkles size={11}/> Ask Pragati for a personalised plan
        </button>
      </div>

      {showMethod && <ExplainabilityDrawer data={data} onClose={() => setShowMethod(false)}/>}
    </div>
  );
}

// ─── Behavioural Intelligence (Phase 2) ───────────────────────────────────

/**
 * Demo sources — used when no user_id is present so designers/QA can preview
 * the panel on the static landing path. When `userId` is supplied, the hook
 * uses /api/behavioural/diagnose/profile and pulls live profile + jobs + goals.
 */
const BI_DEMO_SOURCES = [
  { source_type: 'resume' as const, source_id: 'demo-r1',
    text: 'I owned the relaunch and increased ARR by 35% across 3 quarters. Led a cross-functional team of 8. In hindsight I underestimated stakeholder alignment.', occurred_at: '2026-04-12' },
  { source_type: 'project_description' as const, source_id: 'demo-p1',
    text: 'Delivered weekly v1 v2 v3 releases. Hit every milestone. Surfaced a downstream effect on customer support tickets.', occurred_at: '2026-05-02' },
  { source_type: 'goal' as const, source_id: 'demo-g1',
    text: 'Iterate faster — pivot when the data invalidates the plan. Saved $1.2M annually on a previous cycle.', occurred_at: '2026-05-15' },
];

function BehaviouralIntelligenceSection({ sessionId, userId }: { sessionId: string; userId?: string }) {
  void sessionId;
  const args = userId ? { userId } : { sources: BI_DEMO_SOURCES };
  const { data, loading, error } = useBehaviouralIntelligence(args);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (loading && !data) {
    return (
      <div className="mt-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
        <p className="text-[10.5px] text-gray-500">Diagnosing behavioural signals…</p>
      </div>
    );
  }
  if (error || !data || data.fallback || !data.scores?.length) {
    return null; // graceful skip — Stage Guidance still renders
  }

  const topSignals: BISignalScore[] = [...data.scores]
    .sort((a, b) => b.behavioural_strength - a.behavioural_strength)
    .slice(0, 6);
  const weakestSignals: BISignalScore[] = [...data.scores]
    .filter(s => s.behavioural_strength < 0.5)
    .sort((a, b) => a.behavioural_strength - b.behavioural_strength)
    .slice(0, 3);
  const flags: BIContradictionFlag[] = data.contradictions?.contradiction_flags ?? [];
  const ctScore = data.contradictions?.contradiction_score ?? 0;

  // ── Phase 3: psychometric overlays ──────────────────────────────────────
  const posteriorByKey = new Map<string, NonNullable<typeof data.psychometrics>['signal_posteriors'][number]>(
    (data.psychometrics?.signal_posteriors ?? []).map(p => [p.signal_key, p]));
  const reliabilityByKey = new Map<string, NonNullable<typeof data.psychometrics>['reliability'][number]>(
    (data.psychometrics?.reliability ?? []).map(r => [r.signal_key, r]));
  const excludedSignals = data.psychometrics?.excluded_signals ?? [];
  const stability = data.stability;

  return (
    <div className="mt-4 p-3 rounded-lg border" style={{ background: '#fff', borderColor: '#E2E8F0' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <p className="text-[12px] font-bold text-gray-900 leading-snug">Behavioural Intelligence</p>
          <p className="text-[10px] text-gray-500 leading-snug">
            {data.hit_count ?? 0} evidence hit(s) across {data.source_count ?? 0} source(s) ·
            taxonomy v{data.taxonomy_version}
          </p>
        </div>
        {flags.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-1 rounded"
            style={{ background: ctScore > 0.5 ? '#FEE2E2' : ctScore > 0.2 ? '#FEF3C7' : '#E0F2FE',
                     color:      ctScore > 0.5 ? '#991B1B' : ctScore > 0.2 ? '#92400E' : '#075985' }}>
            {flags.length} contradiction{flags.length === 1 ? '' : 's'} · score {(ctScore * 100).toFixed(0)}
          </span>
        )}
      </div>

      {/* Signal confidence bars + Phase 3 CI whiskers */}
      <div className="space-y-1.5">
        {topSignals.map(s => {
          const isOpen = !!expanded[s.signal_key];
          const pct = Math.round(s.behavioural_strength * 100);
          const color = pct >= 65 ? BRAND.green : pct >= 40 ? BRAND.accent : '#E11D48';
          const post = posteriorByKey.get(s.signal_key);
          const rel  = reliabilityByKey.get(s.signal_key);
          const ciLowPct  = post ? Math.round(post.confidence_interval.lower * 100) : null;
          const ciHighPct = post ? Math.round(post.confidence_interval.upper * 100) : null;
          const probPct   = post ? Math.round(post.probability_mastery * 100) : null;
          const relPct    = rel ? Math.round(rel.composite_reliability * 100) : null;
          const relTier   = rel ? (rel.composite_reliability >= 0.7 ? 'A'
                               : rel.composite_reliability >= 0.5 ? 'B'
                               : rel.composite_reliability >= 0.3 ? 'C' : 'D') : null;
          return (
            <div key={s.signal_key}>
              <button
                onClick={() => setExpanded(e => ({ ...e, [s.signal_key]: !isOpen }))}
                className="w-full text-left"
                aria-expanded={isOpen}>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[11px] font-semibold text-gray-800 truncate flex items-center gap-1">
                    {s.label}
                    {relTier && (
                      <span className="text-[8.5px] font-bold px-1 py-px rounded"
                            title={`Evidence reliability composite ${relPct}% — tier ${relTier}`}
                            style={{ background: relTier === 'A' ? '#DCFCE7' : relTier === 'B' ? '#DBEAFE' : relTier === 'C' ? '#FEF3C7' : '#FEE2E2',
                                     color:      relTier === 'A' ? '#166534' : relTier === 'B' ? '#1E40AF' : relTier === 'C' ? '#92400E' : '#991B1B' }}>
                        R{relTier}
                      </span>
                    )}
                  </span>
                  <span className="text-[9.5px] text-gray-500 whitespace-nowrap">
                    {probPct != null ? `${probPct}% · CI [${ciLowPct}, ${ciHighPct}]` : `${pct}%`} · {s.evidence_count} src
                  </span>
                </div>
                <div className="relative h-2 bg-gray-100 rounded-full overflow-visible">
                  {/* CI whisker (Phase 3) — drawn under the fill so it's visible at the edges */}
                  {post && ciLowPct != null && ciHighPct != null && (
                    <div className="absolute top-1/2 -translate-y-1/2 h-[10px] rounded"
                         title={`95% confidence interval [${ciLowPct}%, ${ciHighPct}%] · evidence strength ${post.evidence_strength.toFixed(1)}`}
                         style={{ left: `${ciLowPct}%`, width: `${Math.max(0, ciHighPct - ciLowPct)}%`,
                                  background: '#CBD5E1', opacity: 0.55 }}
                         aria-label={`Confidence interval ${ciLowPct} to ${ciHighPct} percent`}/>
                  )}
                  {/* Point estimate fill */}
                  <div className="absolute inset-y-[2px] left-0 rounded-full"
                       style={{ width: `${probPct ?? pct}%`, background: color }}/>
                </div>
              </button>
              {isOpen && s.evidence.length > 0 && (
                <ul className="mt-1.5 ml-1 space-y-1">
                  {s.evidence.map((e, i) => (
                    <li key={i} className="text-[10px] text-gray-600 leading-snug border-l-2 pl-2"
                        style={{ borderColor: '#CBD5E1' }}>
                      <span className="font-mono text-gray-400">[{e.source_type}]</span> "{e.snippet}"
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Why-this-gap-exists insights (weakest signals) */}
      {weakestSignals.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
            Why your gaps exist
          </p>
          <ul className="space-y-1">
            {weakestSignals.map(s => (
              <li key={s.signal_key} className="text-[10.5px] text-gray-700 leading-snug">
                <span className="font-semibold">{s.label}</span> at <span className="font-mono">{Math.round(s.behavioural_strength * 100)}%</span> —
                {s.evidence.length === 0
                  ? ` no evidence found in your narrative. Add 2–3 concrete examples.`
                  : ` ${s.evidence_count} source(s) of evidence; add more for consistency.`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Excluded evidence (Phase 3) */}
      {excludedSignals.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
            Excluded evidence ({excludedSignals.length})
          </p>
          <ul className="space-y-1">
            {excludedSignals.slice(0, 4).map(x => (
              <li key={x.signal_key} className="text-[10.5px] text-gray-700 leading-snug">
                <span className="font-semibold">{x.signal_key}</span> — {x.reason.replace(/_/g, ' ')}
                <span className="ml-1 font-mono text-gray-400">({Math.round(x.composite * 100)}% reliability)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Longitudinal stability flags (Phase 3) */}
      {stability && stability.flags.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
            Stability indicators · index {Math.round(stability.stability_index * 100)}%
          </p>
          <ul className="space-y-1.5">
            {stability.flags.map((f, i) => {
              const sev = f.severity === 'high'   ? { bg: '#FEE2E2', fg: '#991B1B' }
                        : f.severity === 'medium' ? { bg: '#FEF3C7', fg: '#92400E' }
                        :                            { bg: '#E0F2FE', fg: '#075985' };
              return (
                <li key={`${f.rule_id}-${f.signal_key ?? 'global'}-${i}`}
                    className="p-2 rounded text-[10.5px] leading-snug"
                    style={{ background: sev.bg, color: sev.fg }}>
                  <p className="font-semibold">{f.title}</p>
                  <p className="mt-0.5 opacity-90">{f.detail}</p>
                  <p className="mt-1 italic opacity-80">→ {f.developmental_action}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Contradiction flags */}
      {flags.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
            Narrative contradictions
          </p>
          <ul className="space-y-1.5">
            {flags.map(f => {
              const sev = f.severity === 'high' ? { bg: '#FEE2E2', fg: '#991B1B' }
                        : f.severity === 'medium' ? { bg: '#FEF3C7', fg: '#92400E' }
                        : { bg: '#E0F2FE', fg: '#075985' };
              return (
                <li key={f.rule_id} className="p-2 rounded text-[10.5px] leading-snug"
                    style={{ background: sev.bg, color: sev.fg }}>
                  <p className="font-semibold">{f.title}</p>
                  <p className="mt-0.5 opacity-90">{f.detail}</p>
                  {f.developmental_action && (
                    <p className="mt-1 italic opacity-80">→ {f.developmental_action}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Small presentational helpers for the evidence-driven view ────────────

function GapBar({ g }: { g: { competency_id: string; competency_name: string; user_score: number;
  cohort_p50: number | null; target_anchor: number; gap_pts: number; weight: number;
  trend: 'accelerating'|'stabilizing'|'flat'|'declining'; velocity_30d: number; } }) {
  const trendIcon = g.trend === 'accelerating' ? '↑'
                  : g.trend === 'declining'    ? '↓'
                  : g.trend === 'stabilizing'  ? '→' : '▢';
  const trendLabel = g.trend === 'accelerating' ? `accelerating, +${g.velocity_30d}/30d`
                   : g.trend === 'declining'    ? `declining, ${g.velocity_30d}/30d`
                   : g.trend === 'stabilizing'  ? `stable, +${g.velocity_30d}/30d`
                   : `flat`;
  const userPos    = Math.max(0, Math.min(100, g.user_score));
  const medianPos  = g.cohort_p50 != null ? Math.max(0, Math.min(100, g.cohort_p50)) : null;
  const targetPos  = Math.max(0, Math.min(100, g.target_anchor));
  return (
    <div className="bg-white rounded-md p-2 border border-gray-100"
      aria-label={`${g.competency_name}: you ${g.user_score}, cohort median ${g.cohort_p50 ?? 'unknown'}, target anchor ${g.target_anchor}, gap ${g.gap_pts} pts, trend ${trendLabel}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[11px] font-semibold text-gray-800 truncate">{g.competency_name}</span>
        <span className="text-[9.5px] text-gray-500 whitespace-nowrap">
          you {g.user_score} · p50 {g.cohort_p50?.toFixed(0) ?? '—'} · target {g.target_anchor} · weight {(g.weight * 100).toFixed(0)}%
          <span className="ml-1.5" title={trendLabel} aria-hidden="true">{trendIcon}</span>
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-gray-100 overflow-visible">
        {/* user fill */}
        <div className="absolute top-0 left-0 h-full rounded-full"
          style={{ width: `${userPos}%`, background: `${BRAND.primary}` }}/>
        {/* median marker */}
        {medianPos != null && (
          <div className="absolute top-[-3px] h-[14px] w-[2px]"
            style={{ left: `${medianPos}%`, background: '#9ca3af' }} aria-hidden="true"/>
        )}
        {/* target marker */}
        <div className="absolute top-[-3px] h-[14px] w-[2px]"
          style={{ left: `${targetPos}%`, background: BRAND.green }} aria-hidden="true"/>
      </div>
    </div>
  );
}

const DIMENSION_META: Record<string, { label: string; icon: string; bg: string; fg: string; border: string }> = {
  competency:        { label: 'Competency',    icon: '◆', bg: `${BRAND.primary}12`, fg: BRAND.primary, border: `${BRAND.primary}30` },
  technical_skill:   { label: 'Technical',     icon: '⌘', bg: '#dbeafe',            fg: '#1e40af',     border: '#bfdbfe' },
  certification:     { label: 'Certification', icon: '⚑', bg: '#ede9fe',            fg: '#6d28d9',     border: '#ddd6fe' },
  education:         { label: 'Education',     icon: '⛁', bg: '#e0e7ff',            fg: '#4338ca',     border: '#c7d2fe' },
  functional_skill:  { label: 'Functional',    icon: '◇', bg: '#ccfbf1',            fg: '#0f766e',     border: '#99f6e4' },
  tool:              { label: 'Tool',          icon: '⚒', bg: '#f3f4f6',            fg: '#374151',     border: '#e5e7eb' },
  domain_expertise:  { label: 'Domain',        icon: '◷', bg: '#fef3c7',            fg: '#92400e',     border: '#fde68a' },
};

function DimensionChip({ dimension }: { dimension: string }) {
  const m = DIMENSION_META[dimension] ?? DIMENSION_META.competency;
  return (
    <span className="text-[9px] font-semibold whitespace-nowrap px-1.5 py-0.5 rounded inline-flex items-center gap-1"
      style={{ background: m.bg, color: m.fg, border: `1px solid ${m.border}` }}
      title={`Dimension: ${m.label}`}>
      <span aria-hidden="true">{m.icon}</span>{m.label}
    </span>
  );
}

function ImportancePill({ importance }: { importance: 'critical'|'required'|'preferred'|'nice_to_have' }) {
  const map: Record<typeof importance, { label: string; bg: string; fg: string }> = {
    critical:     { label: 'Critical',     bg: '#fee2e2', fg: '#b91c1c' },
    required:     { label: 'Required',     bg: '#ffedd5', fg: '#9a3412' },
    preferred:    { label: 'Preferred',    bg: '#ecfccb', fg: '#3f6212' },
    nice_to_have: { label: 'Nice-to-have', bg: '#f1f5f9', fg: '#475569' },
  };
  const m = map[importance];
  return (
    <span className="text-[9px] font-semibold whitespace-nowrap px-1.5 py-0.5 rounded"
      style={{ background: m.bg, color: m.fg }} title={`Importance: ${m.label}`}>
      {m.label}
    </span>
  );
}

function RequirementCoverageStrip({ summary, activeDimension, onSelectDimension }: {
  summary: Record<string, { total: number; satisfied: number; missing: number; coverage: number }> & { total_missing_ei?: number };
  activeDimension?: string | null;
  onSelectDimension?: (k: string) => void;
}) {
  const order = ['technical_skill','certification','education','functional_skill','tool','domain_expertise'] as const;
  const visible = order.filter(k => (summary[k]?.total ?? 0) > 0);
  if (visible.length === 0) return null;
  const interactive = !!onSelectDimension;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          Role-requirement coverage{interactive && <span className="ml-1.5 normal-case font-normal text-gray-400">· tap to filter steps</span>}
        </p>
        {typeof summary.total_missing_ei === 'number' && summary.total_missing_ei > 0 && (
          <span className="text-[9.5px] text-gray-500">~{summary.total_missing_ei.toFixed(0)} EI in unmet requirements</span>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {visible.map(k => {
          const s = summary[k];
          const m = DIMENSION_META[k];
          const pct = Math.round(s.coverage * 100);
          const barColor = pct >= 80 ? BRAND.green : pct >= 50 ? BRAND.primary : pct >= 25 ? '#d97706' : '#b91c1c';
          const isActive = activeDimension === k;
          const baseCls = `rounded-md border p-1.5 text-left transition-all ${interactive ? 'cursor-pointer hover:shadow-sm hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-offset-1' : ''}`;
          const activeStyle = isActive
            ? { background: m.bg, borderColor: m.fg, boxShadow: `0 0 0 2px ${m.fg}33` }
            : { background: m.bg, borderColor: m.border };
          const inner = (
            <>
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[10px]" aria-hidden="true" style={{ color: m.fg }}>{m.icon}</span>
                <span className="text-[9.5px] font-semibold truncate" style={{ color: m.fg }}>{m.label}</span>
                {isActive && <span className="ml-auto text-[8.5px] font-bold px-1 rounded" style={{ background: m.fg, color: '#fff' }}>ON</span>}
              </div>
              <div className="h-1 rounded-full bg-white/60 overflow-hidden mb-0.5">
                <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: barColor }} />
              </div>
              <p className="text-[9px]" style={{ color: m.fg }}>{s.satisfied}/{s.total} · {pct}%</p>
            </>
          );
          return interactive ? (
            <button key={k} type="button" onClick={() => onSelectDimension!(k)}
              aria-pressed={isActive}
              aria-label={`Filter recommended steps by ${m.label} — ${s.satisfied} of ${s.total} requirements met`}
              className={baseCls} style={activeStyle}
              title={`${m.label}: ${s.satisfied} of ${s.total} requirements met · click to filter ranked steps`}>
              {inner}
            </button>
          ) : (
            <div key={k} className="rounded-md border p-1.5" style={activeStyle}
              title={`${m.label}: ${s.satisfied} of ${s.total} requirements met`}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfidencePill({ tier }: { tier: 'A'|'B'|'C'|'D' }) {
  const color = tier === 'A' ? BRAND.green
              : tier === 'B' ? BRAND.primary
              : tier === 'C' ? '#d97706' : '#b91c1c';
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
      style={{ background: `${color}15`, color }}
      aria-label={`Confidence tier ${tier}`}
      title={`Confidence tier ${tier}`}>
      {tier}
    </span>
  );
}

function ExplainabilityDrawer({ data, onClose }: {
  data: ReturnType<typeof useStageGuidance>['data'];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-3"
      role="dialog" aria-modal="true" aria-label="How we computed this guidance"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900">How this guidance was computed</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none" aria-label="Close">×</button>
        </div>
        {!data && (
          <p className="text-[12px] text-gray-600">Personalised intelligence is unavailable — fallback guidance is shown.</p>
        )}
        {data && (
          <div className="space-y-3 text-[11.5px] text-gray-700">
            <Row k="Methodology version" v={data.explainability.methodology_version}/>
            {data.explainability.weighting_policy && <Row k="Weighting policy" v={data.explainability.weighting_policy}/>}
            {data.explainability.cohort_size != null && (
              <Row k="Cohort size" v={`${data.explainability.cohort_size.toLocaleString()} (tier ${data.explainability.cohort_tier ?? '—'})`}/>
            )}
            {data.reliability && (
              <Row k="Reliability" v={`composite ${(data.reliability.composite_reliability * 100).toFixed(0)}% · tier ${data.reliability.quality_tier}`}/>
            )}
            <div>
              <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Evidence sources</p>
              <ul className="space-y-1">
                {data.explainability.data_sources.map((s, i) => (
                  <li key={i} className="text-[11px] text-gray-600 flex items-start gap-1.5">
                    <span className="text-gray-400 mt-0.5">▸</span><span className="font-mono">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Ranking formula</p>
              <p className="text-[11px] font-mono text-gray-700 bg-gray-50 rounded p-2 leading-snug">{data.explainability.ranking_formula}</p>
              <p className="text-[10.5px] text-gray-500 mt-1.5 leading-snug">
                <b>projected_ei_lift</b> = gap × competency_weight (the actual composite EI delta from closing one gap; role-DNA weight is embedded here once — not multiplied again).<br/>
                <b>velocity_mult</b>: accelerating 1.4 · stabilizing 1.1 · flat 1.0 · declining 1.6.<br/>
                <b>confidence_mult</b>: A 1.0 · B 0.9 · C 0.7 · D 0.4.
              </p>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Language policy</p>
              <p className="text-[10.5px] text-gray-600 leading-snug">
                <b>Allowed:</b> {data.explainability.language_policy.allowed.join(' · ')}.<br/>
                <b>Disallowed:</b> {data.explainability.language_policy.disallowed.join(' · ')}.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider">{k}</span>
      <span className="text-[11.5px] text-gray-800 text-right">{v}</span>
    </div>
  );
}

function PeerBenchmarkModal({ eiScore, benchmark, loading, error, onClose, onShowMeHow }: {
  eiScore: number;
  benchmark: PeerBenchmarkData | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onShowMeHow: () => void;
}) {
  const [tab, setTab] = useState<'where' | 'cohort' | 'method' | 'legal'>('where');
  const pct = benchmark?.percentile ?? null;
  const anonymityMet = !!benchmark?.cohort_anonymity_met;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Users size={16} style={{ color: BRAND.primary }}/> Peer benchmark
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Live, version-pinned, k-anonymous · methodology v{benchmark?.methodology_version || '1.0.0'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Status banner */}
        {!loading && benchmark && (() => {
          const reason = benchmark.suppression_reason;
          const ok = anonymityMet && !reason;
          const bg = ok ? `${BRAND.green}10` : '#fef3c7';
          const fg = ok ? '#065f46' : '#78350f';
          const icon = ok ? BRAND.green : '#92400e';
          let body: React.ReactNode;
          if (ok) {
            body = <><b>{benchmark.rank_label}</b> · cohort n={benchmark.cohort.n} ({benchmark.cohort.scope_label})</>;
          } else if (reason === 'zero_variance') {
            body = <><b>Provisional — cohort has zero variance.</b> Everyone in your version-pinned cohort currently has an identical score, so a percentile can't be meaningfully computed. The percentile will appear as soon as the cohort diversifies.</>;
          } else {
            body = <><b>Provisional result.</b> Cohort on this exact ruleset (EI v{benchmark.ei_version} · ruleset v{benchmark.ruleset_version}) is below the k={benchmark.min_cohort_size} anonymity floor, so distribution statistics are withheld to prevent re-identification. Your score and the visual position are still accurate; the precise percentile will appear once the cohort grows.</>;
          }
          return (
            <div className="px-5 py-3 border-b border-gray-100" style={{ background: bg }}>
              <div className="flex items-center gap-2">
                <Info size={12} style={{ color: icon }}/>
                <div className="text-[11px]" style={{ color: fg }}>{body}</div>
              </div>
            </div>
          );
        })()}

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5">
          {[
            { k: 'where',  label: 'Where you stand' },
            { k: 'cohort', label: 'Cohort' },
            { k: 'method', label: 'Methodology' },
            { k: 'legal',  label: 'Privacy & Legal' },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k as any)}
              className={`text-[11px] font-semibold py-3 px-3 border-b-2 transition-colors ${tab === t.k ? '' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              style={{ borderColor: tab === t.k ? BRAND.primary : undefined, color: tab === t.k ? BRAND.primary : undefined }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && <div className="text-[12px] text-gray-500">Computing your benchmark…</div>}
          {error && !loading && (
            <div className="text-[12px] p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
              Couldn't load benchmark: {error}
            </div>
          )}
          {!loading && !error && benchmark && tab === 'where' && (
            <div className="space-y-4">
              {/* Score + CI */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Your EI</div>
                  <div className="text-2xl font-bold" style={{ color: BRAND.primary }}>{benchmark.score}</div>
                  <div className="text-[10px] text-gray-500">
                    {anonymityMet
                      ? <>95% CI: {benchmark.confidence_interval_low}–{benchmark.confidence_interval_high}</>
                      : <>95% CI pending cohort</>}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Percentile</div>
                  <div className="text-2xl font-bold" style={{ color: pct != null && pct >= 50 ? BRAND.green : BRAND.primary }}>
                    {pct != null ? `Top ${100 - pct}%` : '—'}
                  </div>
                  <div className="text-[10px] text-gray-500">{pct != null ? `z = ${benchmark.z_score.toFixed(2)}` : 'Pending cohort'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Stage</div>
                  <div className="text-base font-bold text-gray-800 mt-1">{benchmark.current_stage.label}</div>
                  <div className="text-[10px] text-gray-500">
                    {benchmark.next_stage ? `${benchmark.pts_to_next_stage} pts → ${benchmark.next_stage.label}` : 'Top stage reached'}
                  </div>
                </div>
              </div>

              {/* Distribution bar — only render when k-anonymity is met. Below
                  the floor the backend redacts these fields to null and we
                  show a privacy notice instead. */}
              {anonymityMet && benchmark.cohort.p25 != null ? (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-[11px] font-semibold text-gray-700 mb-2">Where you sit in the cohort</div>
                  <div className="relative h-8 rounded-lg bg-white border border-gray-200 overflow-hidden">
                    <div className="absolute inset-y-0 bg-gray-200/60"
                      style={{ left: `${benchmark.cohort.p25}%`, right: `${100 - (benchmark.cohort.p75 ?? 0)}%` }}/>
                    <div className="absolute top-0 bottom-0 w-px bg-gray-400" style={{ left: `${benchmark.cohort.p50}%` }}/>
                    <div className="absolute top-0 bottom-0 w-1 rounded-full"
                      style={{ left: `${Math.max(0, Math.min(100, benchmark.score))}%`, background: BRAND.accent, transform: 'translateX(-50%)' }}/>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1.5">
                    <span>p25 · {benchmark.cohort.p25}</span>
                    <span>median · {benchmark.cohort.p50}</span>
                    <span>p75 · {benchmark.cohort.p75}</span>
                    <span>p90 · {benchmark.cohort.p90}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 text-[11px] text-gray-600 leading-relaxed">
                  <b>Distribution withheld.</b> The cohort for your exact EI version + ruleset is below the k={benchmark.min_cohort_size} anonymity floor. Showing it would risk re-identifying individual users, so we redact mean / σ / percentile anchors until the cohort grows. The visual pointer above uses a deterministic stage-band heuristic only — not real cohort data.
                </div>
              )}

              {/* Gap framing */}
              {benchmark.next_stage && benchmark.pts_to_next_stage > 0 && (
                <div className="p-4 rounded-xl border" style={{ borderColor: `${BRAND.accent}40`, background: `${BRAND.accent}08` }}>
                  <div className="text-[12px] font-semibold text-gray-800">
                    {benchmark.pts_to_next_stage} pts to {benchmark.next_stage.label}
                  </div>
                  <div className="text-[11px] text-gray-600 mt-1">
                    {benchmark.people_ahead_in_band != null
                      ? `${benchmark.people_ahead_in_band} peers ahead of you in the ${benchmark.current_stage.label} band. Closing the gap moves you past them.`
                      : `Closing this gap unlocks the ${benchmark.next_stage.label} band.`}
                  </div>
                  <button onClick={onShowMeHow}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white"
                    style={{ background: BRAND.primary }}>
                    Show me how <ArrowRight size={11}/>
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && !error && benchmark && tab === 'cohort' && (
            <div className="space-y-3 text-[12px] text-gray-700">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Cohort size (n)"        value={anonymityMet && benchmark.cohort.n != null ? String(benchmark.cohort.n) : `Below k=${benchmark.min_cohort_size} — withheld`}/>
                <Stat label="Scope"                  value={benchmark.cohort.scope_label}/>
                <Stat label="Mean (μ)"               value={anonymityMet && benchmark.cohort.mean != null ? benchmark.cohort.mean.toFixed(2) : 'Withheld'}/>
                <Stat label="Std deviation (σ)"      value={anonymityMet && benchmark.cohort.std  != null ? benchmark.cohort.std.toFixed(2)  : 'Withheld'}/>
                <Stat label="EI version pin"         value={benchmark.ei_version}/>
                <Stat label="Ruleset version pin"    value={benchmark.ruleset_version}/>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-[11px] leading-relaxed">
                <b>How the cohort is selected.</b> We start from your stage band ({benchmark.current_stage.label}) restricted to your exact EI version + ruleset. If that group is below the k-anonymity floor (k={benchmark.min_cohort_size}), we widen the score range to all stages — but we never relax the version pin, so you are never compared against scores produced by a different ruleset. Current cohort scope: <b>{benchmark.cohort.scope}</b>.
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-[11px] leading-relaxed">
                <b>Opted-out users excluded.</b> Users in the <code>benchmark_exclusions</code> registry are filtered out of every cohort query at the SQL layer — enforcement is in-query, not just policy.
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-[11px] leading-relaxed">
                <b>Cohort source.</b> Authoritative EI calculations from <code>ei_calculation_logs</code> with <code>source='resolve'</code> and <code>fallback_used=false</code> — i.e. real resolved assessments only, never error/retry paths.
              </div>
              <div className="text-[10px] text-gray-400">Computed at {new Date(benchmark.computed_at).toLocaleString()}</div>
            </div>
          )}

          {!loading && !error && tab === 'method' && (
            <div className="space-y-3 text-[12px] text-gray-700 leading-relaxed">
              <Section title="Percentile formula">
                z = (your score − μ) / σ, then percentile = Φ(z) using the Abramowitz & Stegun 7.1.26 standard-normal CDF approximation (|error| &lt; 7.5 × 10⁻⁸). Result is bounded to [1, 99].
              </Section>
              <Section title="Empirical anchors">
                p25 / p50 / p75 / p90 are computed directly from the cohort with Postgres <code>PERCENTILE_CONT</code> — distribution-agnostic anchors that don't assume normality. The shaded band on "Where you stand" is the p25–p75 interquartile range.
              </Section>
              <Section title="Confidence interval">
                95% CI on your score uses the standard error of the cohort estimate: SE = σ / √n, margin = 1.96 · SE. The interval reflects sampling uncertainty, not measurement error in your individual answers.
              </Section>
              <Section title="Determinism">
                Same (score, cohort) → same percentile, always. No random sampling, no Monte Carlo, no model temperature. Reproducible by re-running the query at any time.
              </Section>
              <Section title="Version pinning">
                Your benchmark is computed only against scores produced under the same <code>ei_version</code> and <code>ruleset_version</code>. A v1 score is never compared to a v2 score.
              </Section>
              <Section title="Recompute cadence">
                Live on every dashboard load — no cached comparison can go stale.
              </Section>
            </div>
          )}

          {!loading && !error && tab === 'legal' && (
            <div className="space-y-3 text-[12px] text-gray-700 leading-relaxed">
              <Section title="k-anonymity (k = 30)">
                Cohorts smaller than 30 widen by score range only — stage band → all stages on the SAME ruleset. We never relax the version pin. If even the all-stages cohort on your exact ruleset is below 30, the percentile AND every distribution statistic (n, mean, σ, p25/p50/p75/p90) are redacted to null. This is enforced at the service layer, not by the UI.
              </Section>
              <Section title="Aggregates only · with hard redaction">
                Nothing about any other user — name, ID, profile, exact score — ever leaves the benchmark service. When the cohort meets k, only aggregate statistics (n, mean, σ, percentile anchors) cross the boundary. When it doesn't, even those are withheld.
              </Section>
              <Section title="Opt out · enforced in-query">
                Users added to the <code>benchmark_exclusions</code> table are filtered out of every cohort query at the SQL layer — not by policy, but in the WHERE clause of the only query that touches the data. Your personal benchmark is still computed for yourself; only your contribution to others' cohorts is suppressed.
              </Section>
              <Section title="Anti-enumeration">
                The endpoint is rate-limited per IP (60 req / minute) to frustrate adversaries who might otherwise probe across (score, version) tuples to reconstruct the score distribution.
              </Section>
              <Section title="GDPR · DPDP Act 2023">
                Aggregate, non-identifying analytics processed under legitimate interest (GDPR Art. 6(1)(f)) and DPDP §7(c) (necessary for specified purpose). With k ≥ 30 the result is outside the personal-data scope.
              </Section>
              <Section title="No automated decisions (GDPR Art. 22)">
                The percentile is <b>descriptive only</b>. It is not used to make hiring, lending, admissions or any decision with legal or similarly significant effects. It exists to help you understand and improve your own employability.
              </Section>
              <Section title="Right to explanation">
                Every benchmark response is stamped with methodology version, EI version, ruleset version, cohort size and CI. Request a full audit trail via support at any time.
              </Section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="text-[10px] text-gray-500">
            {benchmark ? <>EI v{benchmark.ei_version} · Ruleset v{benchmark.ruleset_version} · Method v{benchmark.methodology_version}</> : ''}
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-gray-200 hover:bg-gray-100">Close</button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-[13px] font-semibold text-gray-900 mt-0.5 break-all">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-gray-900 uppercase tracking-wider mb-1">{title}</div>
      <div>{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE COMPLETENESS — Breakdown modal
// Mirrors backend/routes/cv-parser.ts weights so the % matches exactly.
// Core sections cap at 94 pts, bonus sections cap at +18 (combined cap 100).
// ═══════════════════════════════════════════════════════════════════════════
function ProfileCompletenessModal({ profile, completeness, onClose, onGoToTab, onOpenWizard }: {
  profile: any;
  completeness: number;
  onClose: () => void;
  onGoToTab: (t: TabId) => void;
  onOpenWizard: () => void;
}) {
  type Section = {
    key: string;
    label: string;
    bucket: 'core' | 'bonus';
    weight: number;
    filled: boolean;
    evidence: string;
    tab: TabId;
    hint: string;
  };

  // ── Field readers — MUST match backend/routes/career-seeker.ts computeCompleteness ──
  // Personal strings are trimmed; languages use OR-length across both keys.
  const p = profile || {};
  const personal = p.personal || {};
  const str = (v: any) => (typeof v === 'string' ? v.trim() : '');
  const arr = (v: any) => (Array.isArray(v) ? v : []);
  const skills = p.skills || {};
  const tech  = arr(skills.technical);
  const soft  = arr(skills.soft);
  const tools = arr(skills.tools);
  const langsList = arr(skills.languages);
  const spokenList = arr(p.spokenLanguages);
  const langsCount = langsList.length || spokenList.length;
  const edu   = arr(p.education);
  const exp   = arr(p.experience);
  const proj  = arr(p.projects);
  const certs = arr(p.certifications);
  const achv  = arr(p.achievements);

  const nameV = str(personal.name);
  const emailV = str(personal.email);
  const phoneV = str(personal.phone);
  const linkedinV = str(personal.linkedin);
  const githubV = str(personal.github);
  const summaryV = str(p.summary);

  const truncate = (s: string, n = 48) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  const sections: Section[] = [
    // Core (weights total 94) — trimmed string semantics
    { key: 'personal',         label: 'Full name',           bucket: 'core',  weight: 12, filled: !!nameV,         evidence: nameV    || '—',                                                                   tab: 'profile', hint: 'Add your full name in personal details.' },
    { key: 'email',            label: 'Email address',       bucket: 'core',  weight: 12, filled: !!emailV,        evidence: emailV   || '—',                                                                   tab: 'profile', hint: 'Add a working email recruiters can reach you on.' },
    { key: 'phone',            label: 'Phone number',        bucket: 'core',  weight: 8,  filled: !!phoneV,        evidence: phoneV   || '—',                                                                   tab: 'profile', hint: 'Add your phone number.' },
    { key: 'summary',          label: 'Professional summary',bucket: 'core',  weight: 12, filled: !!summaryV,      evidence: summaryV ? truncate(summaryV) : '—',                                               tab: 'profile', hint: 'Write a 2–3 line bio that frames who you are.' },
    { key: 'education',        label: 'Education',           bucket: 'core',  weight: 14, filled: edu.length > 0,  evidence: edu.length ? `${edu.length} entr${edu.length>1?'ies':'y'}` : '—',                  tab: 'profile', hint: 'Add at least one degree or qualification.' },
    { key: 'experience',       label: 'Work experience',     bucket: 'core',  weight: 18, filled: exp.length > 0,  evidence: exp.length ? `${exp.length} role${exp.length>1?'s':''}` : '—',                     tab: 'profile', hint: 'Add your most recent role (or a project if you are a fresher).' },
    { key: 'technical_skills', label: 'Technical skills',    bucket: 'core',  weight: 10, filled: tech.length > 0, evidence: tech.length ? `${tech.length} listed` : '—',                                       tab: 'skills',  hint: 'List the tech you actually use.' },
    { key: 'soft_skills',      label: 'Soft skills',         bucket: 'core',  weight: 8,  filled: soft.length > 0, evidence: soft.length ? `${soft.length} listed` : '—',                                       tab: 'skills',  hint: 'Add 3–5 soft skills (e.g. communication, ownership).' },
    // Bonus (cap +18 combined) — trimmed URLs; languages = OR-length across skills.languages and spokenLanguages
    { key: 'linkedin',         label: 'LinkedIn URL',        bucket: 'bonus', weight: 4,  filled: !!linkedinV,       evidence: linkedinV || '—',                                                                tab: 'profile', hint: 'Paste your LinkedIn profile URL.' },
    { key: 'github',           label: 'GitHub URL',          bucket: 'bonus', weight: 3,  filled: !!githubV,         evidence: githubV   || '—',                                                                tab: 'profile', hint: 'Paste your GitHub URL (huge signal for tech roles).' },
    { key: 'tools',            label: 'Tools / platforms',   bucket: 'bonus', weight: 3,  filled: tools.length > 0,  evidence: tools.length ? `${tools.length} listed` : '—',                                   tab: 'skills',  hint: 'Add the tools you use (Figma, Jira, AWS, …).' },
    { key: 'languages',        label: 'Spoken languages',    bucket: 'bonus', weight: 3,  filled: langsCount > 0,    evidence: langsCount ? `${langsCount} listed` : '—',                                       tab: 'profile', hint: 'Add the languages you speak.' },
    { key: 'projects',         label: 'Projects',            bucket: 'bonus', weight: 4,  filled: proj.length > 0,   evidence: proj.length ? `${proj.length} project${proj.length>1?'s':''}` : '—',             tab: 'profile', hint: 'Add 1–2 projects that show your work.' },
    { key: 'certifications',   label: 'Certifications',      bucket: 'bonus', weight: 4,  filled: certs.length > 0,  evidence: certs.length ? `${certs.length} listed` : '—',                                   tab: 'profile', hint: 'Add any certification you hold (course, exam, course-completion).' },
    { key: 'achievements',     label: 'Achievements',        bucket: 'bonus', weight: 3,  filled: achv.length > 0,   evidence: achv.length ? `${achv.length} listed` : '—',                                     tab: 'profile', hint: 'List awards, rankings, publications, contributions.' },
  ];

  const coreEarned  = sections.filter(s => s.bucket === 'core'  && s.filled).reduce((n, s) => n + s.weight, 0);
  const coreMax     = sections.filter(s => s.bucket === 'core').reduce((n, s) => n + s.weight, 0); // 94
  const bonusEarnedRaw = sections.filter(s => s.bucket === 'bonus' && s.filled).reduce((n, s) => n + s.weight, 0);
  const bonusMax    = 18;
  const bonusEarned = Math.min(bonusMax, bonusEarnedRaw);
  const computed    = Math.min(100, coreEarned + bonusEarned);

  const filled  = sections.filter(s => s.filled);
  const missing = sections.filter(s => !s.filled);

  // Ranked by impact — bonus is *cumulatively* cap-aware: greedily allocate the
  // remaining bonus headroom across the highest-weight missing bonus items so
  // we never display more total bonus gain than the cap actually allows.
  const bonusHeadroom = Math.max(0, bonusMax - bonusEarned);
  const sortedMissingBonus = missing
    .filter(s => s.bucket === 'bonus')
    .sort((a, b) => b.weight - a.weight);
  const bonusImpact: Record<string, number> = {};
  let remaining = bonusHeadroom;
  for (const s of sortedMissingBonus) {
    const give = Math.min(s.weight, remaining);
    bonusImpact[s.key] = give;
    remaining -= give;
  }
  const missingRanked = missing
    .map(s => ({
      ...s,
      effectiveImpact: s.bucket === 'core' ? s.weight : (bonusImpact[s.key] ?? 0),
    }))
    .filter(s => s.effectiveImpact > 0)
    .sort((a, b) => b.effectiveImpact - a.effectiveImpact);

  const ptsToHundred = Math.max(0, 100 - computed);

  const band =
    computed >= 90 ? { label: 'Recruiter-ready', color: BRAND.green,   blurb: 'Strong profile signal. Close the last gaps to hit 100%.' } :
    computed >= 70 ? { label: 'Almost there',    color: BRAND.accent,  blurb: 'Most of your profile is in place — finish the remaining sections.' } :
    computed >= 40 ? { label: 'Building',        color: BRAND.primary, blurb: 'Halfway there — the items below have the biggest impact.' } :
                      { label: 'Getting started', color: '#94a3b8',    blurb: 'Fill the core sections first — each adds meaningful signal.' };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${band.color}15`, color: band.color }}>
              <User size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Profile Completeness</h2>
              <p className="text-[11px] text-gray-500">What's filled, what's missing, and how to reach 100%</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>

        {/* Score summary */}
        <div className="px-6 py-5 border-b border-gray-100" style={{ background: `${band.color}08` }}>
          <div className="flex items-end gap-3">
            <div className="text-4xl font-bold" style={{ color: band.color }}>{completeness}%</div>
            <div className="text-sm text-gray-400 mb-1">complete</div>
            <div className="ml-auto text-right">
              <div className="text-xs font-semibold" style={{ color: band.color }}>{band.label}</div>
              <div className="text-[10px] text-gray-500">{ptsToHundred} pts to 100%</div>
            </div>
          </div>
          <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">{band.blurb}</p>
          {computed !== completeness && (
            <p className="text-[10px] text-gray-400 mt-1">
              Tile shows the saved score ({completeness}%); the breakdown reflects your live profile state ({computed}%). Save the wizard to sync.
            </p>
          )}
        </div>

        {/* Bucket meters */}
        <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-2 gap-3">
          <div className="border border-gray-100 rounded-xl p-3">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-[11px] font-semibold text-gray-700">Core sections</div>
              <div className="text-[11px] text-gray-500">
                <span className="font-semibold" style={{ color: BRAND.primary }}>{coreEarned}</span>
                <span className="text-gray-400"> / {coreMax} pts</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(coreEarned/coreMax)*100}%`, background: BRAND.primary }}/>
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">Identity, summary, education, experience and skills.</p>
          </div>
          <div className="border border-gray-100 rounded-xl p-3">
            <div className="flex items-baseline justify-between mb-1">
              <div className="text-[11px] font-semibold text-gray-700">Bonus signals</div>
              <div className="text-[11px] text-gray-500">
                <span className="font-semibold" style={{ color: BRAND.accent }}>{bonusEarned}</span>
                <span className="text-gray-400"> / {bonusMax} pts</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(bonusEarned/bonusMax)*100}%`, background: BRAND.accent }}/>
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">Links, projects, certs and other proof — capped at +18.</p>
          </div>
        </div>

        {/* Missing — ranked */}
        {missingRanked.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Missing — ranked by impact ({missingRanked.length})
            </h3>
            <div className="space-y-2">
              {missingRanked.map((s, i) => (
                <button key={s.key}
                  onClick={() => onGoToTab(s.tab)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: BRAND.primary }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-800">{s.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                        background: s.bucket === 'core' ? `${BRAND.primary}15` : `${BRAND.accent}15`,
                        color:      s.bucket === 'core' ?  BRAND.primary       :  BRAND.accent,
                      }}>{s.bucket}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{s.hint}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold" style={{ color: BRAND.green }}>+{s.effectiveImpact}</div>
                    <div className="text-[9px] text-gray-400">pts</div>
                  </div>
                  <ArrowRight size={13} className="text-gray-400 shrink-0"/>
                </button>
              ))}
            </div>
            {bonusHeadroom === 0 && missing.some(s => s.bucket === 'bonus') && (
              <p className="text-[10px] text-gray-400 mt-2">
                Your bonus signals are already maxed at +{bonusMax} — remaining bonus items won't add more points, but they still strengthen recruiter signal.
              </p>
            )}
          </div>
        )}

        {/* Filled — for transparency */}
        {filled.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Already filled ({filled.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filled.map(s => (
                <div key={s.key} className="flex items-start gap-2 p-2.5 rounded-xl border border-gray-100" style={{ background: '#f8fafc' }}>
                  <CheckCircle size={13} className="mt-0.5 shrink-0" style={{ color: BRAND.green }}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-semibold text-gray-800 truncate">{s.label}</span>
                      <span className="text-[10px] font-semibold shrink-0" style={{ color: BRAND.green }}>+{s.weight}</span>
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">{s.evidence}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {missingRanked.length === 0 && (
          <div className="px-6 py-6 text-center">
            <CheckCircle size={28} className="mx-auto mb-2" style={{ color: BRAND.green }}/>
            <p className="text-sm font-semibold text-gray-800">Your profile is fully complete.</p>
            <p className="text-[11px] text-gray-500 mt-1">Focus next on applications, mock interviews and mentor outreach.</p>
          </div>
        )}

        <div className="px-6 py-3 bg-gray-50 rounded-b-2xl flex justify-between items-center gap-2">
          <button onClick={onOpenWizard}
            className="text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-white transition-all">
            Re-open setup wizard
          </button>
          <button onClick={onClose}
            className="text-xs font-medium px-4 py-2 rounded-xl text-white"
            style={{ background: BRAND.primary }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPLOYABILITY INDEX — Breakdown modal
// ═══════════════════════════════════════════════════════════════════════════
function EIDetailsModal({ score, components, onClose, onGoToTab }: {
  score: number;
  components: EIComponent[];
  onClose: () => void;
  onGoToTab: (t: TabId) => void;
}) {
  const maxTotal = components.reduce((s, c) => s + c.max, 0);
  const earned = components.reduce((s, c) => s + c.actual, 0);
  const gap = Math.max(0, maxTotal - earned);

  // Initiatives ordered by point-impact (largest gap first).
  const initiatives = [...components]
    .map(c => ({ ...c, gap: +(c.max - c.actual).toFixed(1) }))
    .filter(c => c.gap > 0.5)
    .sort((a, b) => b.gap - a.gap);

  const band =
    score >= 75 ? { label: 'Hire-Ready', color: BRAND.green, blurb: 'Strong profile — focus on visibility and applications.' } :
    score >= 50 ? { label: 'Career-Ready', color: BRAND.accent, blurb: 'Solid foundation — close gaps below to reach Hire-Ready.' } :
    score >= 25 ? { label: 'Building', color: BRAND.primary, blurb: 'Profile is taking shape — keep adding signal.' } :
                   { label: 'Getting Started', color: '#94a3b8', blurb: 'Add a few core inputs to unlock your trajectory.' };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${band.color}15`, color: band.color }}>
              <Zap size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Employability Index™</h2>
              <p className="text-[11px] text-gray-500">How your score is calculated &amp; how to raise it</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>

        {/* Score summary */}
        <div className="px-6 py-5 border-b border-gray-100" style={{ background: `${band.color}08` }}>
          <div className="flex items-end gap-3">
            <div className="text-4xl font-bold" style={{ color: band.color }}>{score}</div>
            <div className="text-sm text-gray-400 mb-1">/ 100</div>
            <div className="ml-auto text-right">
              <div className="text-xs font-semibold" style={{ color: band.color }}>{band.label}</div>
              <div className="text-[10px] text-gray-500">{gap.toFixed(0)} pts available</div>
            </div>
          </div>
          <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">{band.blurb}</p>
        </div>

        {/* The science */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">The Science</h3>
          <p className="text-[11px] text-gray-600 leading-relaxed">
            Employability Index is a weighted composite of eight profile dimensions that predict recruiter shortlist probability and role-fit accuracy. Each dimension contributes a capped number of points — the cap is the most you can earn from that dimension. Your score updates the moment you act.
          </p>
        </div>

        {/* Breakdown */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Score Breakdown</h3>
          <div className="space-y-3">
            {components.map(c => {
              const pct = c.max > 0 ? (c.actual / c.max) * 100 : 0;
              const full = pct >= 99;
              return (
                <div key={c.key} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="text-xs font-semibold text-gray-800">{c.label}</div>
                    <div className="text-[11px] text-gray-500">
                      <span className="font-semibold" style={{ color: full ? BRAND.green : BRAND.primary }}>{c.actual}</span>
                      <span className="text-gray-400"> / {c.max} pts</span>
                      <span className="ml-2 text-[10px] text-gray-400">weight {c.weight}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 mb-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: full ? BRAND.green : BRAND.primary }}/>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed mb-2">{c.rationale}</p>
                  {c.detail && (
                    <div className="text-[10px] text-gray-600 mb-2 p-2 rounded-md" style={{ background: '#f8fafc' }}>
                      <span className="font-semibold text-gray-700">Your evidence: </span>{c.detail}
                    </div>
                  )}
                  {c.currentCount !== undefined && c.targetCount !== undefined && (
                    <div className="text-[10px] text-gray-400 mb-2">
                      You have <span className="font-semibold text-gray-600">{c.currentCount}</span> of <span className="font-semibold text-gray-600">{c.targetCount}</span> recommended.
                    </div>
                  )}
                  {!full && (
                    <button onClick={() => onGoToTab(c.tab)}
                      className="text-[11px] font-semibold flex items-center gap-1 hover:gap-1.5 transition-all"
                      style={{ color: BRAND.primary }}>
                      {c.cta} <ArrowRight size={11}/>
                    </button>
                  )}
                  {full && (
                    <div className="text-[10px] font-semibold flex items-center gap-1" style={{ color: BRAND.green }}>
                      <CheckCircle size={11}/> Maxed out
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommended initiatives */}
        {initiatives.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Recommended Initiatives (ranked by impact)</h3>
            <div className="space-y-2">
              {initiatives.slice(0, 5).map((c, i) => (
                <button key={c.key}
                  onClick={() => onGoToTab(c.tab)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: BRAND.primary }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-800">{c.cta}</div>
                    <div className="text-[10px] text-gray-500">{c.label}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold" style={{ color: BRAND.green }}>+{c.gap}</div>
                    <div className="text-[9px] text-gray-400">pts</div>
                  </div>
                  <ArrowRight size={13} className="text-gray-400 shrink-0"/>
                </button>
              ))}
            </div>
          </div>
        )}

        {initiatives.length === 0 && (
          <div className="px-6 py-6 text-center">
            <CheckCircle size={28} className="mx-auto mb-2" style={{ color: BRAND.green }}/>
            <p className="text-sm font-semibold text-gray-800">You've maxed every dimension.</p>
            <p className="text-[11px] text-gray-500 mt-1">Focus next on Visibility, Applications and Mock Interviews.</p>
          </div>
        )}

        <div className="px-6 py-3 bg-gray-50 rounded-b-2xl flex justify-end">
          <button onClick={onClose}
            className="text-xs font-medium px-4 py-2 rounded-xl text-white"
            style={{ background: BRAND.primary }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE TAB
// ═══════════════════════════════════════════════════════════════════════════
function ProfileTab({ profile, userId, onProfileUpdate, onRefreshProfile }: {
  profile: any; userId: string;
  onProfileUpdate: (p: any) => void;
  onRefreshProfile: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [localSummary, setLocalSummary] = useState('');
  const [localPersonal, setLocalPersonal] = useState<any>({});
  const [newSkill, setNewSkill] = useState<Record<string, string>>({});
  const [showExpForm, setShowExpForm] = useState(false);
  const [showEduForm, setShowEduForm] = useState(false);
  const [showCertForm, setShowCertForm] = useState(false);
  const [showProjForm, setShowProjForm] = useState(false);
  const [showAchvForm, setShowAchvForm] = useState(false);
  const [expForm, setExpForm] = useState({ company: '', role: '', startDate: '', endDate: '', description: '', isCurrent: false });
  const [eduForm, setEduForm] = useState({ institution: '', degree: '', field: '', startYear: '', endYear: '', grade: '' });
  const [certForm, setCertForm] = useState({ name: '', issuer: '', year: '' });
  const [projForm, setProjForm] = useState({ name: '', description: '', tech: '', url: '' });
  const [newAchv, setNewAchv] = useState('');

  useEffect(() => { setLocalSummary(profile?.summary || ''); }, [profile]);
  useEffect(() => { setLocalPersonal(profile?.personal || {}); }, [profile]);

  const saveField = async (field: string, value: any) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cv/profile/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as Record<string, string>) },
        body: JSON.stringify({ [field]: value }),
      });
      const d = await res.json();
      if (d.success) { onProfileUpdate(d.profile); setEditing(null); }
    } catch {} finally { setSaving(false); }
  };

  const addSkillChip = async (category: string) => {
    const val = (newSkill[category] || '').trim();
    if (!val) return;
    const current = (profile?.skills?.[category] || []) as string[];
    if (current.map((s: string) => s.toLowerCase()).includes(val.toLowerCase())) {
      setNewSkill(s => ({ ...s, [category]: '' }));
      return;
    }
    await saveField('skills', { ...(profile?.skills || {}), [category]: [...current, val] });
    setNewSkill(s => ({ ...s, [category]: '' }));
  };

  const removeSkillChip = async (category: string, skill: string) => {
    const updated = ((profile?.skills?.[category] || []) as string[]).filter((s: string) => s !== skill);
    await saveField('skills', { ...(profile?.skills || {}), [category]: updated });
  };

  const addExperience = async () => {
    if (!expForm.company || !expForm.role) return;
    const entry = { ...expForm };
    await saveField('experience', [...(profile?.experience || []), entry]);
    setExpForm({ company: '', role: '', startDate: '', endDate: '', description: '', isCurrent: false });
    setShowExpForm(false);
  };

  const removeExperience = async (idx: number) => {
    const updated = (profile?.experience || []).filter((_: any, i: number) => i !== idx);
    await saveField('experience', updated);
  };

  const addEducation = async () => {
    if (!eduForm.institution || !eduForm.degree) return;
    await saveField('education', [...(profile?.education || []), { ...eduForm }]);
    setEduForm({ institution: '', degree: '', field: '', startYear: '', endYear: '', grade: '' });
    setShowEduForm(false);
  };

  const removeEducation = async (idx: number) => {
    await saveField('education', (profile?.education || []).filter((_: any, i: number) => i !== idx));
  };

  const addCertification = async () => {
    if (!certForm.name) return;
    await saveField('certifications', [...(profile?.certifications || []), { ...certForm }]);
    setCertForm({ name: '', issuer: '', year: '' });
    setShowCertForm(false);
  };

  const removeCertification = async (idx: number) => {
    await saveField('certifications', (profile?.certifications || []).filter((_: any, i: number) => i !== idx));
  };

  const addProject = async () => {
    if (!projForm.name) return;
    const entry = { ...projForm, tech: projForm.tech.split(',').map(t => t.trim()).filter(Boolean) };
    await saveField('projects', [...(profile?.projects || []), entry]);
    setProjForm({ name: '', description: '', tech: '', url: '' });
    setShowProjForm(false);
  };

  const removeProject = async (idx: number) => {
    await saveField('projects', (profile?.projects || []).filter((_: any, i: number) => i !== idx));
  };

  const addAchievement = async () => {
    const val = newAchv.trim();
    if (!val) return;
    await saveField('achievements', [...(profile?.achievements || []), val]);
    setNewAchv('');
    setShowAchvForm(false);
  };

  const removeAchievement = async (idx: number) => {
    await saveField('achievements', (profile?.achievements || []).filter((_: any, i: number) => i !== idx));
  };

  const personal = profile?.personal || {};
  const skills = profile?.skills || {};
  const completeness = profile?.competencyProfile?.completeness || 0;
  const isNewProfile = !profile?.exists || (!personal.name && !personal.email);

  const inBtn = (label: string, onClick: () => void) => (
    <button onClick={onClick} className="text-[10px] flex items-center gap-1 font-medium" style={{ color: BRAND.primary }}>
      <Plus size={11} /> {label}
    </button>
  );
  const editBtn = (onClick: () => void) => (
    <button onClick={onClick} className="text-[10px] flex items-center gap-1" style={{ color: BRAND.primary }}>
      <Edit3 size={11} /> Edit
    </button>
  );
  const saveCancel = (onSave: () => void) => (
    <div className="flex gap-2">
      <button onClick={() => setEditing(null)} className="text-[10px] text-gray-400">Cancel</button>
      <button onClick={onSave} disabled={saving} className="text-[10px] font-medium px-2.5 py-1 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );

  const inp = (label: string, val: string, onChange: (v: string) => void, type = 'text', placeholder = '') => (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">{label}</label>
      <input type={type} value={val} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1" />
    </div>
  );

  return (
    <div className="space-y-4">
      {isNewProfile && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
          <Sparkles size={16} className="shrink-0 mt-0.5" style={{ color: BRAND.primary }} />
          <div>
            <div className="text-xs font-semibold text-gray-800">Build your profile manually</div>
            <div className="text-[11px] text-gray-500 mt-0.5">No CV uploaded yet — fill in each section below to boost your Employability Index™. All changes save instantly.</div>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0"
            style={{ background: `${BRAND.primary}` }}>
            {(personal.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{personal.name || 'Name not set'}</h2>
            <p className="text-xs text-gray-500 mb-3">{profile?.summary?.slice(0, 120) || 'No summary added yet.'}{(profile?.summary?.length || 0) > 120 ? '…' : ''}</p>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              {personal.email    && <span className="flex items-center gap-1"><Mail size={11} />{personal.email}</span>}
              {personal.phone    && <span className="flex items-center gap-1"><Phone size={11} />{personal.phone}</span>}
              {personal.location && <span className="flex items-center gap-1"><MapPin size={11} />{personal.location}</span>}
              {personal.linkedin && <span className="flex items-center gap-1"><Linkedin size={11} />{personal.linkedin.replace('https://','')}</span>}
              {personal.github   && <span className="flex items-center gap-1"><Github size={11} />{personal.github.replace('https://','')}</span>}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl font-bold" style={{ color: BRAND.primary }}>{completeness}%</div>
            <div className="text-[10px] text-gray-400">Profile Complete</div>
            <div className="mt-1 w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${completeness}%`, backgroundColor: BRAND.accent }} />
            </div>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><User size={14} style={{ color: BRAND.primary }} /> Personal Information</h3>
          {editing !== 'personal' ? editBtn(() => setEditing('personal')) : saveCancel(() => { saveField('personal', localPersonal); })}
        </div>
        {editing === 'personal' ? (
          <div className="grid grid-cols-2 gap-3">
            {inp('Full Name', localPersonal.name || '', v => setLocalPersonal((p: any) => ({ ...p, name: v })), 'text', 'Your full name')}
            {inp('Phone', localPersonal.phone || '', v => setLocalPersonal((p: any) => ({ ...p, phone: v })), 'tel', '+91 XXXXX XXXXX')}
            {inp('Location', localPersonal.location || '', v => setLocalPersonal((p: any) => ({ ...p, location: v })), 'text', 'City, Country')}
            {inp('LinkedIn URL', localPersonal.linkedin || '', v => setLocalPersonal((p: any) => ({ ...p, linkedin: v })), 'url', 'linkedin.com/in/yourname')}
            {inp('GitHub URL', localPersonal.github || '', v => setLocalPersonal((p: any) => ({ ...p, github: v })), 'url', 'github.com/username')}
            {inp('Portfolio / Website', localPersonal.website || '', v => setLocalPersonal((p: any) => ({ ...p, website: v })), 'url', 'https://yoursite.com')}
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            {personal.email    && <span className="flex items-center gap-1.5"><Mail size={12} className="text-gray-400" />{personal.email}</span>}
            {personal.phone    && <span className="flex items-center gap-1.5"><Phone size={12} className="text-gray-400" />{personal.phone}</span>}
            {personal.location && <span className="flex items-center gap-1.5"><MapPin size={12} className="text-gray-400" />{personal.location}</span>}
            {personal.linkedin && <span className="flex items-center gap-1.5"><Linkedin size={12} className="text-gray-400" />{personal.linkedin}</span>}
            {personal.github   && <span className="flex items-center gap-1.5"><Github size={12} className="text-gray-400" />{personal.github}</span>}
            {personal.website  && <span className="flex items-center gap-1.5"><Globe size={12} className="text-gray-400" />{personal.website}</span>}
            {!personal.name && !personal.phone && !personal.location && (
              <span className="text-[11px] text-gray-400 italic">No personal info yet — click Edit to fill in.</span>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><FileText size={14} style={{ color: BRAND.primary }} /> Professional Summary</h3>
          {editing !== 'summary' ? editBtn(() => setEditing('summary')) : saveCancel(() => saveField('summary', localSummary))}
        </div>
        {editing === 'summary'
          ? <textarea rows={4} value={localSummary} onChange={e => setLocalSummary(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-1"
              style={{ '--tw-ring-color': BRAND.primary } as any} placeholder="Write a professional summary..." />
          : <p className="text-xs text-gray-600 leading-relaxed">{profile?.summary || 'No summary added yet. Click Edit to add one.'}</p>}
      </div>

      {/* Skills */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4"><Code size={14} style={{ color: BRAND.primary }} /> Skills</h3>
        <div className="space-y-4">
          {([
            { label: 'Technical Skills', key: 'technical', color: BRAND.primary },
            { label: 'Tools & Platforms', key: 'tools', color: '#8b5cf6' },
            { label: 'Soft Skills', key: 'soft', color: BRAND.green },
            { label: 'Languages', key: 'languages', color: BRAND.orange },
          ] as const).map(({ label, key, color }) => (
            <div key={key}>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{label}</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {((skills as any)[key] || []).map((s: string) => (
                  <Chip key={s} label={s} color={color} onRemove={() => removeSkillChip(key, s)} />
                ))}
                {!((skills as any)[key] || []).length && <span className="text-[10px] text-gray-400 italic">None listed</span>}
              </div>
              {editing === `skill-${key}` ? (
                <div className="flex gap-1.5">
                  <input value={newSkill[key] || ''} onChange={e => setNewSkill(s => ({ ...s, [key]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkillChip(key); } }}
                    placeholder={`Add ${label.toLowerCase()}…`}
                    className="flex-1 h-7 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none" />
                  <button onClick={() => addSkillChip(key)} className="text-[10px] font-medium px-2 py-1 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>Add</button>
                  <button onClick={() => setEditing(null)} className="text-[10px] text-gray-400 px-1">✕</button>
                </div>
              ) : (
                inBtn('Add', () => setEditing(`skill-${key}`))
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Experience */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Briefcase size={14} style={{ color: BRAND.primary }} /> Work Experience</h3>
          {inBtn('Add Entry', () => setShowExpForm(v => !v))}
        </div>
        {showExpForm && (
          <div className="border border-gray-100 rounded-xl p-4 mb-4 bg-gray-50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {inp('Job Title *', expForm.role, v => setExpForm(f => ({ ...f, role: v })), 'text', 'e.g. Software Engineer')}
              {inp('Company *', expForm.company, v => setExpForm(f => ({ ...f, company: v })), 'text', 'e.g. Infosys')}
              {inp('Start Date', expForm.startDate, v => setExpForm(f => ({ ...f, startDate: v })), 'text', 'e.g. Jan 2022')}
              {expForm.isCurrent ? (
                <div className="flex items-end pb-1">
                  <span className="text-xs text-gray-500 italic">Currently working here</span>
                </div>
              ) : (
                inp('End Date', expForm.endDate, v => setExpForm(f => ({ ...f, endDate: v })), 'text', 'e.g. Dec 2023')
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={expForm.isCurrent} onChange={e => setExpForm(f => ({ ...f, isCurrent: e.target.checked, endDate: '' }))} className="rounded" />
              <label>Currently working here</label>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Description</label>
              <textarea rows={2} value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Key responsibilities and achievements…"
                className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowExpForm(false)} className="text-xs text-gray-400">Cancel</button>
              <button onClick={addExperience} disabled={saving} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>
                {saving ? 'Saving…' : 'Add Experience'}
              </button>
            </div>
          </div>
        )}
        {(profile?.experience || []).length === 0
          ? <p className="text-xs text-gray-400 italic">No experience added yet — click Add Entry above.</p>
          : <div className="space-y-4">
              {(profile?.experience || []).map((exp: any, i: number) => (
                <div key={i} className="border-l-2 pl-4 py-1 relative group" style={{ borderColor: BRAND.primary }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold text-gray-800">{exp.role}</div>
                      <div className="text-xs text-gray-500">{exp.company}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {exp.isCurrent && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${BRAND.green}15`, color: BRAND.green }}>Current</span>}
                      <button onClick={() => removeExperience(i)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {exp.description && <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">{exp.description}</p>}
                </div>
              ))}
            </div>}
      </div>

      {/* Education */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><GraduationCap size={14} style={{ color: BRAND.primary }} /> Education</h3>
          {inBtn('Add Entry', () => setShowEduForm(v => !v))}
        </div>
        {showEduForm && (
          <div className="border border-gray-100 rounded-xl p-4 mb-4 bg-gray-50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {inp('Institution *', eduForm.institution, v => setEduForm(f => ({ ...f, institution: v })), 'text', 'e.g. IIT Bombay')}
              {inp('Degree *', eduForm.degree, v => setEduForm(f => ({ ...f, degree: v })), 'text', 'e.g. B.Tech')}
              {inp('Field of Study', eduForm.field, v => setEduForm(f => ({ ...f, field: v })), 'text', 'e.g. Computer Science')}
              {inp('Grade / CGPA', eduForm.grade, v => setEduForm(f => ({ ...f, grade: v })), 'text', 'e.g. 8.5/10')}
              {inp('Start Year', eduForm.startYear, v => setEduForm(f => ({ ...f, startYear: v })), 'text', 'e.g. 2019')}
              {inp('End Year', eduForm.endYear, v => setEduForm(f => ({ ...f, endYear: v })), 'text', 'e.g. 2023')}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowEduForm(false)} className="text-xs text-gray-400">Cancel</button>
              <button onClick={addEducation} disabled={saving} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>
                {saving ? 'Saving…' : 'Add Education'}
              </button>
            </div>
          </div>
        )}
        {(profile?.education || []).length === 0
          ? <p className="text-xs text-gray-400 italic">No education added yet — click Add Entry above.</p>
          : <div className="space-y-3">
              {(profile?.education || []).map((edu: any, i: number) => (
                <div key={i} className="flex gap-3 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}15` }}>
                    <GraduationCap size={14} style={{ color: BRAND.accent }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-gray-800">{edu.institution}</div>
                    <div className="text-[11px] text-gray-600">{edu.degree} {edu.field ? `· ${edu.field}` : ''}</div>
                    <div className="text-[10px] text-gray-400">{edu.startYear} – {edu.endYear} {edu.grade ? `· ${edu.grade}` : ''}</div>
                  </div>
                  <button onClick={() => removeEducation(i)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity self-start mt-0.5">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>}
      </div>

      {/* Projects */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><FolderOpen size={14} style={{ color: BRAND.primary }} /> Projects</h3>
          {inBtn('Add Entry', () => setShowProjForm(v => !v))}
        </div>
        {showProjForm && (
          <div className="border border-gray-100 rounded-xl p-4 mb-4 bg-gray-50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {inp('Project Name *', projForm.name, v => setProjForm(f => ({ ...f, name: v })), 'text', 'e.g. Portfolio Website')}
              {inp('Project URL', projForm.url, v => setProjForm(f => ({ ...f, url: v })), 'url', 'https://github.com/…')}
              {inp('Tech Stack (comma-separated)', projForm.tech, v => setProjForm(f => ({ ...f, tech: v })), 'text', 'React, Node.js, MongoDB')}
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Description</label>
              <textarea rows={2} value={projForm.description} onChange={e => setProjForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What does this project do?"
                className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowProjForm(false)} className="text-xs text-gray-400">Cancel</button>
              <button onClick={addProject} disabled={saving} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>
                {saving ? 'Saving…' : 'Add Project'}
              </button>
            </div>
          </div>
        )}
        {(profile?.projects || []).length === 0
          ? <p className="text-xs text-gray-400 italic">No projects added yet — click Add Entry above.</p>
          : <div className="space-y-4">
              {(profile?.projects || []).map((proj: any, i: number) => (
                <div key={i} className="p-3 rounded-xl border border-gray-100 bg-gray-50 group">
                  <div className="flex items-start justify-between">
                    <div className="text-xs font-semibold text-gray-800">{proj.name}</div>
                    <div className="flex items-center gap-2">
                      {proj.url && <a href={proj.url} target="_blank" rel="noopener noreferrer" className="text-[10px]" style={{ color: BRAND.accent }}><ExternalLink size={11} /></a>}
                      <button onClick={() => removeProject(i)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {proj.description && <p className="text-[11px] text-gray-600 mt-1">{proj.description}</p>}
                  {(proj.tech || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(proj.tech || []).map((t: string) => <Chip key={t} label={t} color={BRAND.primary} />)}
                    </div>
                  )}
                </div>
              ))}
            </div>}
      </div>

      {/* Certifications + Achievements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Award size={14} style={{ color: BRAND.primary }} /> Certifications</h3>
            {inBtn('Add', () => setShowCertForm(v => !v))}
          </div>
          {showCertForm && (
            <div className="space-y-2 mb-3">
              {inp('Certification Name *', certForm.name, v => setCertForm(f => ({ ...f, name: v })), 'text', 'e.g. AWS Solutions Architect')}
              {inp('Issuer', certForm.issuer, v => setCertForm(f => ({ ...f, issuer: v })), 'text', 'e.g. Amazon')}
              {inp('Year', certForm.year, v => setCertForm(f => ({ ...f, year: v })), 'text', 'e.g. 2024')}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCertForm(false)} className="text-xs text-gray-400">Cancel</button>
                <button onClick={addCertification} disabled={saving} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>
                  {saving ? 'Saving…' : 'Add'}
                </button>
              </div>
            </div>
          )}
          {(profile?.certifications || []).length === 0
            ? <p className="text-xs text-gray-400 italic">None yet — click Add.</p>
            : <div className="space-y-2">
                {(profile?.certifications || []).map((c: any, i: number) => (
                  <div key={i} className="flex gap-2 text-xs group">
                    <Award size={12} style={{ color: BRAND.orange }} className="shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{c.name}</div>
                      <div className="text-gray-400 text-[10px]">{c.issuer} {c.year ? `· ${c.year}` : ''}</div>
                    </div>
                    <button onClick={() => removeCertification(i)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Star size={14} style={{ color: BRAND.primary }} /> Achievements</h3>
            {inBtn('Add', () => setShowAchvForm(v => !v))}
          </div>
          {showAchvForm && (
            <div className="space-y-2 mb-3">
              <input value={newAchv} onChange={e => setNewAchv(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAchievement(); } }}
                placeholder="e.g. Won national coding hackathon 2024"
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAchvForm(false)} className="text-xs text-gray-400">Cancel</button>
                <button onClick={addAchievement} disabled={saving} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>
                  {saving ? 'Saving…' : 'Add'}
                </button>
              </div>
            </div>
          )}
          {(profile?.achievements || []).length === 0
            ? <p className="text-xs text-gray-400 italic">None yet — click Add.</p>
            : <ul className="space-y-1.5">
                {(profile?.achievements || []).map((a: string, i: number) => (
                  <li key={i} className="flex gap-2 text-xs text-gray-600 group">
                    <Star size={11} style={{ color: BRAND.orange }} className="shrink-0 mt-0.5" />
                    <span className="flex-1">{a}</span>
                    <button onClick={() => removeAchievement(i)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={11} />
                    </button>
                  </li>
                ))}
              </ul>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SKILLS LAB TAB
// ═══════════════════════════════════════════════════════════════════════════
function SkillsTab({ profile, userId, onProfileUpdate }: { profile: any; userId: string; onProfileUpdate: (p: any) => void }) {
  const skills = profile?.skills || { technical: [] as string[], soft: [] as string[], tools: [] as string[], languages: [] as string[] };
  const allMySkills = [...skills.technical, ...skills.soft, ...skills.tools];
  const [newSkill, setNewSkill] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);

  const saveSkills = async (updated: typeof skills) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cv/profile/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as Record<string,string>) },
        body: JSON.stringify({ skills: updated }),
      });
      const d = await res.json();
      if (d.success) onProfileUpdate(d.profile);
    } catch {} finally { setSaving(false); }
  };

  const addSkill = async (cat: keyof typeof skills) => {
    const val = (newSkill[cat] || '').trim();
    if (!val || (skills[cat] as string[]).map((s: string) => s.toLowerCase()).includes(val.toLowerCase())) {
      setNewSkill(s => ({ ...s, [cat]: '' })); return;
    }
    const updated = { ...skills, [cat]: [...(skills[cat] as string[]), val] };
    setNewSkill(s => ({ ...s, [cat]: '' }));
    await saveSkills(updated);
  };

  const removeSkill = async (cat: keyof typeof skills, skill: string) => {
    const updated = { ...skills, [cat]: (skills[cat] as string[]).filter((s: string) => s !== skill) };
    await saveSkills(updated);
  };

  const topInDemand = Object.entries(INDUSTRY_BENCHMARKS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const gapSkills = topInDemand.filter(([skill]) =>
    !allMySkills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
  );

  const radarData = [
    { label: 'Technical', val: Math.min(skills.technical.length * 10, 100) },
    { label: 'Tools', val: Math.min(skills.tools.length * 12, 100) },
    { label: 'Soft Skills', val: Math.min(skills.soft.length * 12, 100) },
    { label: 'Languages', val: Math.min(skills.languages.length * 20, 100) },
    { label: 'Experience', val: Math.min((profile?.experience?.length || 0) * 25, 100) },
    { label: 'Certs', val: Math.min((profile?.certifications?.length || 0) * 25, 100) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Skills Lab</h1>
        <span className="text-xs text-gray-400">Powered by MetryxOne competency engine</span>
      </div>

      {/* Skill counts KPI */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Technical', count: skills.technical.length, color: BRAND.primary },
          { label: 'Tools', count: skills.tools.length, color: '#8b5cf6' },
          { label: 'Soft Skills', count: skills.soft.length, color: BRAND.green },
          { label: 'Languages', count: skills.languages.length, color: BRAND.orange },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</div>
            <div className="text-[10px] text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Competency radar + breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Radar (CSS bars as radar substitute) */}
        <SectionCard title="Competency Radar" icon={<PieChart size={16} />}>
          <div className="space-y-3 mt-1">
            {radarData.map(d => (
              <div key={d.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">{d.label}</span>
                  <span className="font-medium" style={{ color: BRAND.primary }}>{d.val}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${d.val}%`, background: `${BRAND.primary}` }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Industry gap */}
        <SectionCard title="Industry Gap Analysis" icon={<TrendingUp size={16} />}>
          <p className="text-[10px] text-gray-400 mb-3">Top in-demand skills you haven't listed yet</p>
          {gapSkills.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-teal-600 py-2"><CheckCircle size={14} /> Excellent! You have all top industry skills covered.</div>
          ) : (
            <div className="space-y-2">
              {gapSkills.slice(0, 6).map(([skill, demand]) => (
                <div key={skill} className="flex items-center gap-2">
                  <TrendingUp size={11} style={{ color: BRAND.orange }} className="shrink-0" />
                  <span className="text-xs text-gray-700 flex-1">{skill}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-400">{demand}% demand</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${BRAND.orange}15`, color: BRAND.orange }}>Gap</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Editable skill categories */}
      {saving && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <RefreshCw size={11} className="animate-spin"/><span>Saving&hellip;</span>
        </div>
      )}
      {([
        { label: 'Technical Skills', cat: 'technical' as const, color: BRAND.primary, placeholder: 'e.g. Python, React, SQL…' },
        { label: 'Tools & Platforms', cat: 'tools' as const, color: '#8b5cf6', placeholder: 'e.g. Docker, Jira, Figma…' },
        { label: 'Soft Skills', cat: 'soft' as const, color: BRAND.green, placeholder: 'e.g. Leadership, Communication…' },
        { label: 'Languages', cat: 'languages' as const, color: BRAND.orange, placeholder: 'e.g. English, Hindi, Tamil…' },
      ] as { label: string; cat: 'technical'|'soft'|'tools'|'languages'; color: string; placeholder: string }[]).map(g => (
        <SectionCard key={g.label} title={g.label} icon={<Code size={16} />}>
          <div className="flex flex-wrap gap-2 mb-3 min-h-[24px]">
            {(skills[g.cat] as string[]).length === 0
              ? <span className="text-xs text-gray-400 italic">None added yet</span>
              : (skills[g.cat] as string[]).map((s: string) => (
                  <Chip key={s} label={s} color={g.color} onRemove={() => removeSkill(g.cat, s)} />
                ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newSkill[g.cat] || ''}
              onChange={e => setNewSkill(n => ({ ...n, [g.cat]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(g.cat); } }}
              placeholder={g.placeholder}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"/>
            <button type="button" onClick={() => addSkill(g.cat)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ backgroundColor: `${g.color}18`, color: g.color }}>
              Add
            </button>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RESUME STUDIO TAB
// ═══════════════════════════════════════════════════════════════════════════
// ── Shared Resume Upload + Parse block ──────────────────────────────────────
function ResumeUploadBlock({ userId, onProfileSaved, compact = false, onParsed }: {
  userId: string;
  onProfileSaved: (profile: any) => void;
  compact?: boolean;
  onParsed?: (parsed: any) => void;
}) {
  const [dragging, setDragging]     = useState(false);
  const [file, setFile]             = useState<File | null>(null);
  const [parsing, setParsing]       = useState(false);
  const [parsed, setParsed]         = useState<any | null>(null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [step, setStep]             = useState<'upload' | 'review' | 'done'>('upload');

  const acceptedFile = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (!['pdf','doc','docx'].includes(ext)) { setError('Only PDF, DOC, DOCX files are supported.'); return; }
    if (f.size > 5 * 1024 * 1024) { setError('File must be under 5 MB.'); return; }
    setError(''); setFile(f);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) acceptedFile(f);
  };
  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) acceptedFile(f);
  };

  const parseResume = async () => {
    if (!file) return;
    setParsing(true); setError('');
    try {
      const fd = new FormData();
      fd.append('cv', file);
      const res = await fetch('/api/cv/parse', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok || !d.success) { setError(d.message || 'Parsing failed. Try a different file.'); return; }
      setParsed(d.profile);
      if (onParsed) { onParsed(d.profile); return; }
      setStep('review');
    } catch { setError('Network error. Please try again.'); }
    finally { setParsing(false); }
  };

  const saveProfile = async () => {
    if (!parsed) return;
    if (!userId) {
      setError('You must be logged in to save your profile. Please log in and try again.');
      return;
    }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/cv/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email: parsed.personal?.email || '', profile: parsed }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.message || 'Save failed. Please try again.');
        return;
      }
      // Refresh profile from server after successful save
      try {
        const pr = await fetch(`/api/cv/profile/${userId}`);
        const pd = await pr.json();
        if (pd.success) { onProfileSaved(pd.profile); setStep('done'); return; }
      } catch { /* ignore refresh error — save already succeeded */ }
      // Fallback: use the parsed profile directly if refresh fails
      onProfileSaved({ ...parsed, competencyProfile: d.competencyProfile || parsed.competencyProfile, exists: true });
      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'Network error. Please check your connection and try again.');
    }
    finally { setSaving(false); }
  };

  if (step === 'done') return (
    <div className="text-center py-4">
      <CheckCircle size={28} className="mx-auto mb-2" style={{ color: BRAND.green }}/>
      <p className="text-sm font-semibold text-gray-800">Profile built successfully!</p>
      <p className="text-xs text-gray-400 mt-1">Your resume has been parsed and saved to your profile.</p>
    </div>
  );

  if (step === 'review' && parsed) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">Parsed from &ldquo;{file?.name}&rdquo;</h4>
          <p className="text-[10px] text-gray-400 mt-0.5">Review the extracted data before saving to your profile</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: `${BRAND.green}15`, color: BRAND.green }}>
          {parsed.competencyProfile?.completeness ?? 0}% complete
        </span>
      </div>

      {/* Parsed field preview grid */}
      <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
        {/* Personal */}
        {parsed.personal?.name && (
          <ParsedSection icon={<User size={11}/>} label="Name" value={parsed.personal.name} color={BRAND.primary}/>
        )}
        {(parsed.personal?.email || parsed.personal?.phone || parsed.personal?.location) && (
          <ParsedSection icon={<Mail size={11}/>} label="Contact" color={BRAND.primary}
            value={[parsed.personal.email, parsed.personal.phone, parsed.personal.location].filter(Boolean).join(' · ')}/>
        )}
        {parsed.summary && (
          <ParsedSection icon={<FileText size={11}/>} label="Summary" color={BRAND.accent} value={parsed.summary.slice(0, 150) + (parsed.summary.length > 150 ? '...' : '')}/>
        )}
        {parsed.skills?.technical?.length > 0 && (
          <ParsedSection icon={<Code size={11}/>} label={`Technical Skills (${parsed.skills.technical.length})`} color={BRAND.primary}
            tags={parsed.skills.technical.slice(0, 12)}/>
        )}
        {parsed.skills?.soft?.length > 0 && (
          <ParsedSection icon={<Heart size={11}/>} label={`Soft Skills (${parsed.skills.soft.length})`} color={BRAND.green}
            tags={parsed.skills.soft.slice(0, 8)}/>
        )}
        {parsed.experience?.length > 0 && (
          <ParsedSection icon={<Briefcase size={11}/>} label={`Experience (${parsed.experience.length} roles)`} color={BRAND.accent}
            value={parsed.experience.slice(0, 2).map((e: any) => `${e.role} @ ${e.company}`).join(' · ')}/>
        )}
        {parsed.education?.length > 0 && (
          <ParsedSection icon={<GraduationCap size={11}/>} label={`Education (${parsed.education.length})`} color={BRAND.orange}
            value={parsed.education.slice(0, 2).map((e: any) => `${e.degree} — ${e.institution}`).join(' · ')}/>
        )}
        {parsed.certifications?.length > 0 && (
          <ParsedSection icon={<Award size={11}/>} label={`Certifications (${parsed.certifications.length})`} color={BRAND.green}
            value={parsed.certifications.slice(0, 3).map((c: any) => c.name).join(', ')}/>
        )}
        {parsed.projects?.length > 0 && (
          <ParsedSection icon={<FolderOpen size={11}/>} label={`Projects (${parsed.projects.length})`} color="#8b5cf6"
            value={parsed.projects.slice(0, 2).map((p: any) => p.name).join(', ')}/>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={() => { setStep('upload'); setParsed(null); setFile(null); }}
          className="text-xs px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
          Re-upload
        </button>
        <button onClick={saveProfile} disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl text-white disabled:opacity-60"
          style={{ backgroundColor: BRAND.green }}>
          {saving ? 'Saving...' : <><CheckCircle size={12}/> Save to Profile</>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`block rounded-2xl border-2 border-dashed transition-all cursor-pointer ${compact ? 'p-6' : 'p-10'} text-center ${dragging ? 'border-blue-400 bg-blue-50/40' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50/60'}`}
        style={dragging ? { borderColor: BRAND.primary } : {}}>
        <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={onFileInput}/>
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
              <FileText size={18} style={{ color: BRAND.primary }}/>
            </div>
            <div className="text-sm font-semibold text-gray-800">{file.name}</div>
            <div className="text-[10px] text-gray-400">{(file.size / 1024).toFixed(0)} KB &middot; ready to parse</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1" style={{ backgroundColor: `${BRAND.primary}10` }}>
              <Upload size={20} style={{ color: BRAND.primary }}/>
            </div>
            <p className="text-sm font-semibold text-gray-700">Drag &amp; drop your resume here</p>
            <p className="text-xs text-gray-400">or click to browse &middot; PDF, DOC, DOCX &middot; max 5 MB</p>
          </div>
        )}
      </label>

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}

      {file && (
        <button onClick={parseResume} disabled={parsing}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl text-white disabled:opacity-60"
          style={{ backgroundColor: BRAND.primary }}>
          {parsing ? (
            <><RefreshCw size={13} className="animate-spin"/> Parsing resume...</>
          ) : (
            <><Sparkles size={13}/> Parse &amp; Build Profile</>
          )}
        </button>
      )}

      {!compact && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { icon: <User size={11}/>, label: 'Name & Contact' },
            { icon: <Briefcase size={11}/>, label: 'Work Experience' },
            { icon: <GraduationCap size={11}/>, label: 'Education' },
            { icon: <Code size={11}/>, label: 'Skills & Tools' },
            { icon: <Award size={11}/>, label: 'Certifications' },
            { icon: <FolderOpen size={11}/>, label: 'Projects' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5 p-2 rounded-lg border border-gray-100 bg-gray-50/60">
              <span style={{ color: BRAND.accent }}>{item.icon}</span>
              <span className="text-[9px] text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ParsedSection({ icon, label, value, tags, color }: { icon: React.ReactNode; label: string; value?: string; tags?: string[]; color: string }) {
  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
      </div>
      {value && <p className="text-[11px] text-gray-700 leading-relaxed">{value}</p>}
      {tags && (
        <div className="flex flex-wrap gap-1">
          {tags.map(t => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}12`, color }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ResumeTab({ profile, userId, onProfileSaved }: { profile: any; userId: string; onProfileSaved: (p: any) => void }) {
  const hasProfile = profile && (profile.competencyProfile?.completeness ?? 0) > 0;

  if (!hasProfile) return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Resume Studio</h1>
        <p className="text-xs text-gray-500 mt-0.5">Upload your CV to instantly build a visual profile &mdash; or build manually from My Profile</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-7 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}12` }}>
            <Upload size={16} style={{ color: BRAND.primary }}/>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Import from Resume</h3>
            <p className="text-[10px] text-gray-400">Pragati AI parses PDF, DOC or DOCX files and fills your profile automatically</p>
          </div>
        </div>
        <ResumeUploadBlock userId={userId} onProfileSaved={onProfileSaved}/>
      </div>
    </div>
  );

  return <ResumeStudio profile={profile} userId={userId} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// JOB TRACKER TAB
// ═══════════════════════════════════════════════════════════════════════════
function JobsTab({ jobs, setJobs, userId, profile, behavior }: { jobs: JobApp[]; setJobs: (j: JobApp[]) => void; userId: string; profile: any; behavior?: BehaviorContext | null }) {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<JobApp | null>(null);
  const [filter, setFilter] = useState<JobStage | 'All'>('All');
  const [form, setForm] = useState({ company: '', role: '', location: '', type: 'Full-time', salary: '', source: '', status: 'Applied' as JobStage, appliedDate: '', deadline: '', notes: '', contactName: '', contactEmail: '', url: '' });
  const [saving, setSaving] = useState(false);

  const visible = filter === 'All' ? jobs : jobs.filter(j => j.status === filter);

  const stageCount = (s: JobStage) => jobs.filter(j => j.status === s).length;

  const handleAdd = async () => {
    if (!form.company || !form.role) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cv/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as Record<string, string>) },
        body: JSON.stringify({ ...form, userId }),
      });
      const d = await res.json();
      if (d.success) { setJobs([d.job, ...jobs]); setShowForm(false); setForm({ company: '', role: '', location: '', type: 'Full-time', salary: '', source: '', status: 'Applied', appliedDate: '', deadline: '', notes: '', contactName: '', contactEmail: '', url: '' }); }
    } catch {} finally { setSaving(false); }
  };

  const handleStatusChange = async (job: JobApp, status: JobStage) => {
    const res = await fetch(`/api/cv/jobs/${job._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authHeader() as Record<string, string>) },
      body: JSON.stringify({ status }),
    });
    const d = await res.json();
    if (d.success) setJobs(jobs.map(j => j._id === job._id ? { ...j, status } : j));
  };

  const handleDelete = async (jobId: string) => {
    await fetch(`/api/cv/jobs/${jobId}`, { method: 'DELETE', headers: authHeader() as HeadersInit });
    setJobs(jobs.filter(j => j._id !== jobId));
    if (selected?._id === jobId) setSelected(null);
  };

  const fld = (k: keyof typeof form, label: string, type = 'text') => (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">{label}</label>
      <input type={type} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
        className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Job Application Tracker</h1>
          <p className="text-xs text-gray-400 mt-0.5">{jobs.length} total · {jobs.filter(j => !['Accepted','Rejected'].includes(j.status)).length} active</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm"
          style={{ backgroundColor: BRAND.primary }}>
          <Plus size={13} /> Add Application
        </button>
      </div>

      {/* Fitment Intelligence: peer ranking + applied + recruiter openings */}
      <FitmentInsightsPanel profile={profile} jobs={jobs} userId={userId} behavior={behavior} />

      {/* Stage pipeline overview */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex gap-0 overflow-x-auto">
          {(['Wishlist','Applied','Screening','Interview','Assessment','Offer','Accepted'] as JobStage[]).map((s, i, arr) => (
            <div key={s} className="flex items-center shrink-0">
              <button onClick={() => setFilter(s === filter ? 'All' : s)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${filter === s ? 'shadow-sm' : 'hover:bg-gray-50'}`}
                style={filter === s ? { backgroundColor: `${STAGE_COLORS[s]}15` } : {}}>
                <span className="text-sm font-bold" style={{ color: STAGE_COLORS[s] }}>{stageCount(s)}</span>
                <span className="text-[9px] text-gray-500 whitespace-nowrap">{s}</span>
              </button>
              {i < arr.length - 1 && <ChevronRight size={12} className="text-gray-300 mx-0.5" />}
            </div>
          ))}
          <button onClick={() => setFilter('All')}
            className="ml-auto shrink-0 text-[10px] px-2 py-1 rounded-lg text-gray-400 hover:text-gray-600">
            {filter !== 'All' ? 'Show all' : ''}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Add New Application</h3>
            <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {fld('company', 'Company *')}
            {fld('role', 'Role / Position *')}
            {fld('location', 'Location')}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                {['Full-time','Part-time','Contract','Internship','Freelance'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            {fld('salary', 'Salary Range')}
            {fld('source', 'Source (LinkedIn, Naukri…)')}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as JobStage })}
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                {JOB_STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {fld('appliedDate', 'Applied Date', 'date')}
            {fld('deadline', 'Deadline', 'date')}
            {fld('url', 'Job URL')}
            {fld('contactName', 'Recruiter Name')}
            {fld('contactEmail', 'Recruiter Email', 'email')}
          </div>
          <div className="mb-3">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full text-xs border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-xs px-3 py-2 text-gray-500 hover:text-gray-700">Cancel</button>
            <button onClick={handleAdd} disabled={saving}
              className="text-xs font-medium px-4 py-2 rounded-xl text-white"
              style={{ backgroundColor: BRAND.primary }}>
              {saving ? 'Saving…' : 'Save Application'}
            </button>
          </div>
        </div>
      )}

      {/* Job cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visible.length === 0 && (
          <div className="col-span-2 bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
            <Briefcase size={28} className="mx-auto mb-2 text-gray-300" />
            <div className="text-sm text-gray-400">No applications {filter !== 'All' ? `with status "${filter}"` : 'yet'}.</div>
          </div>
        )}
        {visible.map(job => (
          <div key={job._id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-gray-800">{job.role}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <Building2 size={11} />{job.company}
                  {job.location && <><span className="text-gray-300">·</span><MapPin size={11} />{job.location}</>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: `${STAGE_COLORS[job.status]}15`, color: STAGE_COLORS[job.status] }}>
                  {job.status}
                </span>
                <button onClick={() => handleDelete(job._id)} className="text-gray-300 hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {job.type && <Chip label={job.type} color={BRAND.primary} />}
              {job.salary && <Chip label={job.salary} color={BRAND.green} />}
              {job.source && <Chip label={job.source} color="#94a3b8" />}
              {job.appliedDate && <Chip label={`Applied ${job.appliedDate}`} color="#64748b" />}
            </div>
            {/* Stage changer */}
            <div>
              <div className="text-[9px] text-gray-400 mb-1">Move to stage:</div>
              <div className="flex flex-wrap gap-1">
                {JOB_STAGES.filter(s => s !== job.status).slice(0, 4).map(s => (
                  <button key={s} onClick={() => handleStatusChange(job, s)}
                    className="text-[9px] px-1.5 py-0.5 rounded font-medium border transition-colors hover:opacity-80"
                    style={{ borderColor: `${STAGE_COLORS[s]}40`, color: STAGE_COLORS[s], backgroundColor: `${STAGE_COLORS[s]}08` }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {job.notes && <p className="text-[10px] text-gray-400 mt-2 italic truncate">"{job.notes}"</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERVIEW PREP TAB
// ═══════════════════════════════════════════════════════════════════════════
function InterviewTab({ profile, behavior }: { profile: any; behavior?: BehaviorContext | null }) {
  const [category, setCategory] = useState<keyof typeof INTERVIEW_QS>('Behavioral');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [bookmarked, setBookmarked] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('mx-interview-bookmarked') || '[]'); } catch { return []; }
  });
  const [answers, setAnswers] = useState<Record<string,string>>(() => {
    try { return JSON.parse(localStorage.getItem('mx-interview-answers') || '{}'); } catch { return {}; }
  });

  const categories = Object.keys(INTERVIEW_QS) as (keyof typeof INTERVIEW_QS)[];
  const bmKey = (c: string, i: number) => `${c}::${i}`;

  const toggleBookmark = (c: string, i: number) => {
    const k = bmKey(c, i);
    setBookmarked(prev => {
      const next = prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k];
      localStorage.setItem('mx-interview-bookmarked', JSON.stringify(next));
      return next;
    });
  };

  const updateAnswer = (c: string, i: number, val: string) => {
    const k = bmKey(c, i);
    setAnswers(prev => {
      const next = { ...prev, [k]: val };
      localStorage.setItem('mx-interview-answers', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Interview Prep Hub</h1>
        <span className="text-xs text-gray-400">{bookmarked.length} bookmarked &middot; {Object.keys(answers).length} answered</span>
      </div>

      {/* Behavioural interview readiness (additive — from CAPADEX behaviour profile) */}
      {behavior && Number.isFinite(behavior.interviewReadiness as number) && (
        <div className="rounded-2xl p-4 flex items-center gap-4 bg-white border border-gray-100 shadow-sm">
          <div className="shrink-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Interview readiness</div>
            <div className="text-2xl font-bold" style={{ color: (behavior.interviewReadiness as number) >= 70 ? BRAND.green : (behavior.interviewReadiness as number) >= 45 ? BRAND.primary : BRAND.accent }}>
              {Math.round(behavior.interviewReadiness as number)}<span className="text-sm text-gray-400">/100</span>
            </div>
          </div>
          <div className="flex-1 text-xs text-gray-600">
            {(behavior.interviewReadiness as number) >= 70
              ? 'Your behavioural signals suggest you present with composure under pressure — focus practice on sharpening role-specific stories.'
              : (behavior.interviewReadiness as number) >= 45
                ? 'Mixed behavioural signals around interview composure — rehearse high-stakes answers out loud to convert preparation into confidence.'
                : 'Behavioural signals flag interview pressure as a growth area — start with low-stakes mock runs and STAR scripting before live interviews.'}
          </div>
        </div>
      )}

      {/* Tips banner */}
      <div className="rounded-2xl p-4 flex items-start gap-3" style={{ backgroundColor: `${BRAND.primary}08`, border: `1px solid ${BRAND.primary}20` }}>
        <Lightbulb size={16} style={{ color: BRAND.primary }} className="shrink-0 mt-0.5" />
        <div className="text-xs text-gray-700">
          <span className="font-semibold" style={{ color: BRAND.primary }}>Pro Tip:</span> Practice each answer out loud. Use the STAR method for behavioral questions. Research the company 48 hrs before the interview.
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => { setCategory(c); setExpanded(null); }}
            className={`text-xs font-medium px-4 py-2 rounded-xl border transition-all ${category === c ? 'text-white shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
            style={category === c ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : {}}>
            {c}
          </button>
        ))}
      </div>

      {/* Questions */}
      <div className="space-y-2">
        {INTERVIEW_QS[category].map((q, i) => {
          const k = bmKey(category, i);
          const isBm = bookmarked.includes(k);
          const answerVal = answers[k] || '';
          const isExpanded = expanded === i;
          return (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : i)}>
                <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: BRAND.primary }}>{i + 1}</span>
                <span className="flex-1 text-xs font-medium text-gray-800 leading-snug">{q.q}</span>
                {answerVal && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
                    style={{ backgroundColor: `${BRAND.green}15`, color: BRAND.green }}>Answered</span>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <span role="button" aria-label="bookmark"
                    className="p-1 rounded hover:opacity-70 cursor-pointer"
                    onClick={e => { e.stopPropagation(); toggleBookmark(category, i); }}>
                    <Bookmark size={13} className={isBm ? 'fill-current' : ''} style={{ color: isBm ? BRAND.accent : '#cbd5e1' }} />
                  </span>
                  {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </div>
              {isExpanded && (
                <div className="px-4 pb-4 pt-0">
                  <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: `${BRAND.accent}10` }}>
                    <Lightbulb size={13} style={{ color: BRAND.accent }} className="shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-700">{q.hint}</p>
                  </div>
                  <textarea rows={4} value={answerVal}
                    onChange={e => updateAnswer(category, i, e.target.value)}
                    placeholder="Type your practice answer here&hellip; (auto-saved)"
                    className="w-full mt-3 text-xs border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-1" />
                  {answerVal && (
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                      <CheckCircle size={10} style={{ color: BRAND.green }} /> Answer saved locally
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LEARNING HUB TAB
// ═══════════════════════════════════════════════════════════════════════════
function LearningTab({ profile }: { profile: any }) {
  const [filter, setFilter] = useState<string>('All');
  const [showSaved, setShowSaved] = useState(false);
  const [saved, setSaved] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('mx-learning-saved') || '[]'); } catch { return []; }
  });
  const mySkills = [
    ...(profile?.skills?.technical || []),
    ...(profile?.skills?.tools || []),
  ].map((s: string) => s.toLowerCase());

  const TAGS = ['All', 'In-Demand', 'Quick Win', 'Trending', 'High Value', 'DevOps', 'Soft Skill', 'Analytics', 'Career Growth', 'Certification', 'Project Mgmt'];

  const toggleSave = (title: string) => {
    setSaved(prev => {
      const next = prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title];
      localStorage.setItem('mx-learning-saved', JSON.stringify(next));
      return next;
    });
  };

  const baseList = showSaved ? COURSE_RECS.filter(c => saved.includes(c.title)) : COURSE_RECS;
  const filtered = filter === 'All' ? baseList : baseList.filter(c => c.tag === filter);

  const recommended = COURSE_RECS.filter(c =>
    !mySkills.some(s => c.skill.toLowerCase().includes(s) || s.includes(c.skill.toLowerCase()))
  ).slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Learning Hub</h1>
          <p className="text-xs text-gray-400 mt-0.5">Personalised for your skills gap</p>
        </div>
        <button onClick={() => setShowSaved(s => !s)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-all ${showSaved ? 'text-white shadow-sm' : 'border-gray-200 text-gray-500'}`}
          style={showSaved ? { backgroundColor: BRAND.accent, borderColor: BRAND.accent } : {}}>
          <Bookmark size={12} className={showSaved ? 'fill-current' : ''} />
          Saved ({saved.length})
        </button>
      </div>

      {recommended.length > 0 && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: `${BRAND.green}08`, border: `1px solid ${BRAND.green}20` }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} style={{ color: BRAND.green }} />
            <span className="text-xs font-semibold" style={{ color: BRAND.green }}>Recommended for Your Skills Gap</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recommended.map(c => <Chip key={c.title} label={c.title} color={BRAND.green} />)}
          </div>
        </div>
      )}

      {/* Filter tags */}
      <div className="flex flex-wrap gap-2">
        {TAGS.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all ${filter === t ? 'text-white shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            style={filter === t ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : {}}>
            {t}
          </button>
        ))}
      </div>

      {/* Course grid */}
      {showSaved && filtered.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          <Bookmark size={24} className="mx-auto mb-2 opacity-30" />
          <p>No saved courses yet.</p>
          <p className="text-xs mt-1">Tap the bookmark on any course to save it.</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(c => {
          const isSaved = saved.includes(c.title);
          return (
            <div key={c.title} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>{c.tag}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-gray-800 mb-1">{c.title}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span>{c.provider}</span>
                    <span>&middot;</span><Clock size={10} /><span>{c.duration}</span>
                    <span>&middot;</span><span>{c.level}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${BRAND.primary}10` }}>
                    <BookOpen size={14} style={{ color: BRAND.primary }} />
                  </div>
                  <button onClick={() => toggleSave(c.title)} aria-label="Save course"
                    className="p-1 rounded-full hover:opacity-70 transition-opacity">
                    <Bookmark size={13} className={isSaved ? 'fill-current' : ''}
                      style={{ color: isSaved ? BRAND.accent : '#cbd5e1' }} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
                <Chip label={c.skill} color={BRAND.primary} />
                <button className="text-[10px] font-medium flex items-center gap-1" style={{ color: BRAND.accent }}>
                  Enroll <ExternalLink size={10} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CAREER PATHWAYS TAB
// ═══════════════════════════════════════════════════════════════════════════
function PathwaysTab({ profile }: { profile: any }) {
  const [domainIdx, setDomainIdx] = useState(0);
  const [selected, setSelected] = useState(1);
  const domain = CAREER_DOMAINS[domainIdx];
  const paths = domain.paths;

  const expCount = (profile?.experience || []).length;
  const currentLevel = expCount === 0 ? 1 : expCount === 1 ? 2 : expCount <= 3 ? 3 : expCount <= 5 ? 4 : 5;

  const mySkills = [...(profile?.skills?.technical || []), ...(profile?.skills?.soft || []), ...(profile?.skills?.tools || [])]
    .map((s: string) => s.toLowerCase());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Career Pathways</h1>
          <p className="text-xs text-gray-400 mt-0.5">Choose your domain and explore the career ladder</p>
        </div>
      </div>

      {/* Domain selector */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Your Career Domain</p>
        <div className="flex flex-wrap gap-2">
          {CAREER_DOMAINS.map((d, i) => (
            <button key={d.label} onClick={() => { setDomainIdx(i); setSelected(1); }}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-all ${
                i === domainIdx ? 'text-white shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              style={i === domainIdx ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : {}}>
              <span>{d.icon}</span>{d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Visual path */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {paths.map((path, i) => (
            <div key={path.role} className="flex items-center">
              <button onClick={() => setSelected(path.level)}
                className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all w-32 ${
                  path.level === selected ? 'shadow-md' : 'hover:bg-gray-50 border-gray-100'
                }`}
                style={path.level === selected ? { borderColor: BRAND.primary, backgroundColor: `${BRAND.primary}06` } : {}}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold mb-2 ${
                  path.level <= currentLevel ? 'text-white' : 'text-gray-400 border-2 border-dashed border-gray-200'
                }`}
                  style={path.level <= currentLevel ? { backgroundColor: path.level === currentLevel ? BRAND.green : BRAND.primary } : {}}>
                  {path.level <= currentLevel ? <CheckCircle size={18} /> : path.level}
                </div>
                <div className="text-[10px] font-semibold text-center leading-tight"
                  style={{ color: path.level === selected ? BRAND.primary : '#374151' }}>
                  {path.role}
                </div>
                {path.level === currentLevel && (
                  <span className="mt-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: BRAND.green }}>You</span>
                )}
              </button>
              {i < paths.length - 1 && (
                <div className="flex items-center mx-1">
                  <div className="w-8 h-0.5 rounded" style={{ backgroundColor: i < currentLevel - 1 ? BRAND.primary : '#e2e8f0' }} />
                  <ArrowRight size={12} style={{ color: i < currentLevel - 1 ? BRAND.primary : '#cbd5e1' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected role detail */}
      {(() => {
        const r = paths.find(p => p.level === selected);
        if (!r) return null;
        const have = r.skills.filter(s => mySkills.some(m => m.includes(s.toLowerCase()) || s.toLowerCase().includes(m)));
        const need = r.skills.filter(s => !mySkills.some(m => m.includes(s.toLowerCase()) || s.toLowerCase().includes(m)));
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">{r.role}</h3>
              <p className="text-[10px] text-gray-400 mb-3">{domain.label}</p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2"><Clock size={12} style={{ color: BRAND.primary }} /><span className="text-gray-600">Experience: <span className="font-medium">{r.yearsExp}</span></span></div>
                <div className="flex items-center gap-2"><DollarSign size={12} style={{ color: BRAND.green }} /><span className="text-gray-600">Salary: <span className="font-medium">{r.avgSalary}</span></span></div>
              </div>
              <div className="mt-3">
                <div className="text-[10px] text-gray-400 mb-1">Progresses to:</div>
                <div className="flex flex-wrap gap-1">
                  {r.nextRoles.map(nr => <Chip key={nr} label={nr} color={BRAND.accent} />)}
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
                <CheckCircle size={12} style={{ color: BRAND.green }} /> Skills You Have
              </h3>
              {have.length === 0
                ? <p className="text-xs text-gray-400">None matched yet &mdash; add skills in Skills Lab</p>
                : <div className="flex flex-wrap gap-1.5">{have.map(s => <Chip key={s} label={s} color={BRAND.green} />)}</div>}
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
                <AlertCircle size={12} style={{ color: BRAND.orange }} /> Skills to Develop
              </h3>
              {need.length === 0
                ? <p className="text-xs text-teal-600 flex items-center gap-1"><CheckCircle size={11} /> All skills covered!</p>
                : <div className="flex flex-wrap gap-1.5">{need.map(s => <Chip key={s} label={s} color={BRAND.orange} />)}</div>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MENTORS TAB
// ═══════════════════════════════════════════════════════════════════════════
function MentorsTab({ profile }: { profile: any }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [requested, setRequested] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>('All');

  const TAGS = ['All', 'AI/ML Expert', 'Leadership', 'Product', 'Full Stack', 'HR/Recruitment', 'DevOps'];

  const filtered = MENTORS.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase()) || m.tag.toLowerCase().includes(search.toLowerCase()) ||
      m.skills.some(s => s.toLowerCase().includes(search.toLowerCase()));
    const matchTag = filter === 'All' || m.tag === filter;
    return matchSearch && matchTag;
  });

  const handleRequest = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRequested(prev => [...prev, id]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mentor Connect</h1>
          <p className="text-xs text-gray-400 mt-0.5">Matched to your career profile &middot; {requested.length} session{requested.length !== 1 ? 's' : ''} requested</p>
        </div>
      </div>

      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, role, or skill&hellip;"
            className="w-full h-10 pl-8 pr-4 text-xs border border-gray-200 rounded-xl focus:outline-none bg-white shadow-sm" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {TAGS.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all ${filter === t ? 'text-white shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            style={filter === t ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : {}}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(m => (
          <div key={m.id} onClick={() => setSelected(selected === m.id ? null : m.id)}
            className={`bg-white border rounded-2xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
              selected === m.id ? 'border-blue-200 shadow-md' : 'border-gray-100'
            }`}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ background: `${BRAND.primary}` }}>
                {m.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-white"
                    style={{ backgroundColor: m.match >= 90 ? BRAND.green : m.match >= 80 ? BRAND.accent : BRAND.orange }}>
                    {m.match}% match
                  </span>
                </div>
                <div className="text-xs text-gray-500">{m.role} · {m.company}</div>
                <div className="text-[10px] text-gray-400">{m.exp} experience</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {m.skills.map(s => <Chip key={s} label={s} color={BRAND.primary} />)}
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3 text-gray-500">
                <span className="flex items-center gap-1"><Star size={11} style={{ color: '#f59e0b' }} />{m.rating}</span>
                <span>{m.sessions} sessions</span>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>{m.tag}</span>
            </div>

            {selected === m.id && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                {requested.includes(m.id) ? (
                  <div className="flex items-center justify-center gap-2 py-2 rounded-xl"
                    style={{ backgroundColor: `${BRAND.green}10`, border: `1px solid ${BRAND.green}30` }}>
                    <CheckCircle size={13} style={{ color: BRAND.green }} />
                    <span className="text-xs font-medium" style={{ color: BRAND.green }}>Request sent &mdash; expect a reply within 2&ndash;4 hrs</span>
                  </div>
                ) : (
                  <>
                    <button onClick={e => handleRequest(e, m.id)}
                      className="w-full text-xs font-medium py-2 rounded-xl text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: BRAND.primary }}>
                      Request Session with {m.name.split(' ')[0]}
                    </button>
                    <p className="text-[10px] text-center text-gray-400 mt-1.5">First session free &middot; Typical response in 2&ndash;4 hrs</p>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GOALS TAB
// ═══════════════════════════════════════════════════════════════════════════
function GoalsTab({ goals, setGoals, userId }: { goals: CareerGoal[]; setGoals: (g: CareerGoal[]) => void; userId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('All');
  const [form, setForm] = useState({ title: '', description: '', category: 'Skill', targetDate: '', priority: 'Medium' });

  const completed = goals.filter(g => g.completed).length;
  const pct = goals.length ? Math.round((completed / goals.length) * 100) : 0;

  const visible = filterCat === 'All' ? goals : goals.filter(g => g.category === filterCat);

  const handleAdd = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cv/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as Record<string, string>) },
        body: JSON.stringify({ ...form, userId }),
      });
      const d = await res.json();
      if (d.success) { setGoals([d.goal, ...goals]); setShowForm(false); setForm({ title: '', description: '', category: 'Skill', targetDate: '', priority: 'Medium' }); }
    } catch {} finally { setSaving(false); }
  };

  const handleToggle = async (goal: CareerGoal) => {
    const res = await fetch(`/api/cv/goals/${goal._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authHeader() as Record<string, string>) },
      body: JSON.stringify({ completed: !goal.completed }),
    });
    const d = await res.json();
    if (d.success) setGoals(goals.map(g => g._id === goal._id ? { ...g, completed: !g.completed } : g));
  };

  const handleDelete = async (goalId: string) => {
    await fetch(`/api/cv/goals/${goalId}`, { method: 'DELETE', headers: authHeader() as HeadersInit });
    setGoals(goals.filter(g => g._id !== goalId));
  };

  const priorityColor = (p: string) => p === 'High' ? BRAND.red : p === 'Medium' ? BRAND.orange : BRAND.green;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Career Goals</h1>
          <p className="text-xs text-gray-400 mt-0.5">{completed} of {goals.length} goals completed</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm"
          style={{ backgroundColor: BRAND.primary }}>
          <Plus size={13} /> Add Goal
        </button>
      </div>

      {/* Progress bar */}
      {goals.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">Overall Progress</span>
            <span className="text-xs font-bold" style={{ color: pct === 100 ? BRAND.green : BRAND.primary }}>{pct}%</span>
          </div>
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: pct === 100 ? BRAND.green : `${BRAND.primary}` }} />
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">New Career Goal</h3>
            <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Goal Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Get AWS Certified by June 2026"
                className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                  {GOAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Priority</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                  className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none">
                  {GOAL_PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Target Date</label>
                <input type="date" value={form.targetDate} onChange={e => setForm({ ...form, targetDate: e.target.value })}
                  className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">Description</label>
              <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What does success look like?" className="w-full text-xs border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="text-xs px-3 py-2 text-gray-500">Cancel</button>
            <button onClick={handleAdd} disabled={saving}
              className="text-xs font-medium px-4 py-2 rounded-xl text-white"
              style={{ backgroundColor: BRAND.primary }}>
              {saving ? 'Saving…' : 'Add Goal'}
            </button>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {['All', ...GOAL_CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-all ${filterCat === c ? 'text-white shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            style={filterCat === c ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : {}}>
            {c} {c !== 'All' ? `(${goals.filter(g => g.category === c).length})` : `(${goals.length})`}
          </button>
        ))}
      </div>

      {/* Goal list */}
      {visible.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
          <Target size={28} className="mx-auto mb-2 text-gray-300" />
          <div className="text-sm text-gray-400">No goals yet. Set your first career milestone!</div>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(g => (
            <div key={g._id} className={`bg-white border rounded-2xl p-4 shadow-sm transition-all ${g.completed ? 'opacity-60' : 'hover:shadow-md'} border-gray-100`}>
              <div className="flex items-start gap-3">
                <button onClick={() => handleToggle(g)} className="mt-0.5 shrink-0">
                  {g.completed
                    ? <CheckCircle size={18} style={{ color: BRAND.green }} />
                    : <Circle size={18} className="text-gray-300 hover:text-gray-400" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${g.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{g.title}</div>
                  {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Chip label={g.category} color={BRAND.primary} />
                    <Chip label={g.priority} color={priorityColor(g.priority)} />
                    {g.targetDate && <Chip label={`Due ${g.targetDate}`} color="#64748b" />}
                    {g.completed && <Chip label="Completed" color={BRAND.green} />}
                  </div>
                </div>
                <button onClick={() => handleDelete(g._id)} className="text-gray-300 hover:text-red-400 shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSESSMENT TAB — Question bank, adaptive flow, scoring, results dashboard
// ═══════════════════════════════════════════════════════════════════════════

interface AssessmentResults {
  computedScore: any; percentile: any; gapAnalysis: any; roleFit: any; interventions: any;
  precise?: any;
}

const ROLES = ['Software Engineer','Product Manager','Data Analyst','Team Lead','Director','Consultant','Business Analyst','UX Designer','DevOps Engineer','Marketing Manager'];
const STAGES = ['junior','mid','senior','lead','director'];
const INDUSTRIES = ['Technology','Finance','Healthcare','E-commerce','Manufacturing','Consulting','Education'];

// ── Profile-derived personalization helpers ─────────────────────────────────
function parseExpYears(experience: any[]): number {
  if (!Array.isArray(experience) || experience.length === 0) return 0;
  const yearRe = /(19|20)\d{2}/;
  let totalMonths = 0;
  for (const e of experience) {
    const s = (e?.startDate || '').toString();
    const en = (e?.endDate || '').toString();
    const isCur = !!e?.isCurrent;
    const sM = s.match(yearRe); if (!sM) continue;
    const startY = parseInt(sM[0], 10);
    const endY = isCur || !en ? new Date().getFullYear() : (en.match(yearRe) ? parseInt(en.match(yearRe)![0], 10) : new Date().getFullYear());
    totalMonths += Math.max(0, (endY - startY)) * 12 + 6; // +half-year approximation
  }
  return Math.max(0, Math.round(totalMonths / 12));
}
function deriveStage(years: number, latestRole: string): { stage: string; reason: string } {
  const r = (latestRole || '').toLowerCase();
  if (/director|vp|head of|chief/.test(r)) return { stage: 'director', reason: 'role title suggests director-level' };
  if (/lead|principal|staff/.test(r))      return { stage: 'lead',     reason: 'role title suggests lead-level' };
  if (years >= 10) return { stage: 'director', reason: `${years}+ yrs experience` };
  if (years >= 6)  return { stage: 'senior',   reason: `${years} yrs experience` };
  if (years >= 3)  return { stage: 'mid',      reason: `${years} yrs experience` };
  if (years >= 1)  return { stage: 'junior',   reason: `${years} yr experience` };
  return { stage: 'junior', reason: 'starting career' };
}
function guessIndustry(profile: any): { industry: string; reason: string } {
  const skills = [
    ...(profile?.skills?.technical || []),
    ...(profile?.skills?.tools     || []),
  ].map((s: string) => s.toLowerCase());
  const role = (profile?.experience?.[0]?.role || '').toLowerCase();
  const company = (profile?.experience?.[0]?.company || '').toLowerCase();
  if (/finance|bank|fintech|invest|trader/.test(role + ' ' + company)) return { industry: 'Finance', reason: 'role/company keywords' };
  if (/health|clinic|hospital|pharma|biotech/.test(role + ' ' + company)) return { industry: 'Healthcare', reason: 'role/company keywords' };
  if (/consult|advisory|deloitte|kpmg|mckinsey|bcg|pwc|accenture/.test(role + ' ' + company)) return { industry: 'Consulting', reason: 'company name' };
  if (/teach|edu|school|college|university/.test(role + ' ' + company)) return { industry: 'Education', reason: 'role/company keywords' };
  if (/amazon|flipkart|shopify|ecom|retail/.test(role + ' ' + company)) return { industry: 'E-commerce', reason: 'role/company keywords' };
  if (/manufactur|industrial|automotive|aerospace/.test(role + ' ' + company)) return { industry: 'Manufacturing', reason: 'role/company keywords' };
  if (skills.some(s => /react|python|aws|kubernetes|node|sql|tensorflow/.test(s))) return { industry: 'Technology', reason: 'technical skills suggest tech' };
  return { industry: 'Technology', reason: 'default — no industry signal' };
}
// ── Profile → assessment-field inference helpers ──────────────────────────
// Parse "MM/YYYY", "YYYY-MM", "YYYY", or "Mon YYYY" into a year-month tuple.
function parseMonthYear(raw: any): { year: number; month: number } | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || /present|current|now/i.test(s)) return null;
  let m = s.match(/^(\d{1,2})[\/\-](\d{4})$/);                          // MM/YYYY
  if (m) return { year: +m[2], month: Math.max(1, Math.min(12, +m[1])) };
  m = s.match(/^(\d{4})[\/\-](\d{1,2})/);                                // YYYY-MM
  if (m) return { year: +m[1], month: Math.max(1, Math.min(12, +m[2])) };
  m = s.match(/^(\d{4})$/);                                              // YYYY
  if (m) return { year: +m[1], month: 1 };
  m = s.match(/([A-Za-z]+)\s+(\d{4})/);                                  // Mon YYYY
  if (m) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const idx = months.indexOf(m[1].slice(0, 3).toLowerCase());
    if (idx >= 0) return { year: +m[2], month: idx + 1 };
  }
  return null;
}

function monthsBetween(from: { year: number; month: number }, to: { year: number; month: number }): number {
  return Math.max(0, (to.year - from.year) * 12 + (to.month - from.month));
}

function deriveTenureMonths(experience: any[]): number | null {
  const latest = experience?.[0];
  if (!latest) return null;
  const start = parseMonthYear(latest.startDate || latest.start_date || latest.start);
  if (!start) return null;
  const endRaw = latest.endDate || latest.end_date || latest.end;
  const isCurrent = latest.isCurrent || latest.current || !endRaw || /present|current|now/i.test(String(endRaw));
  const now = new Date();
  const end = isCurrent
    ? { year: now.getFullYear(), month: now.getMonth() + 1 }
    : (parseMonthYear(endRaw) || { year: now.getFullYear(), month: now.getMonth() + 1 });
  const m = monthsBetween(start, end);
  return Number.isFinite(m) && m >= 0 && m <= 600 ? m : null;
}

function deriveEducationLevel(education: any[]): string {
  if (!Array.isArray(education) || education.length === 0) return '';
  // Pick the highest-ranked degree across all entries (not just the first).
  const rank: Record<string, number> = { highschool: 1, diploma: 2, bachelors: 3, masters: 4, phd: 5 };
  const classify = (e: any): string => {
    const txt = `${e?.degree || ''} ${e?.field || ''} ${e?.qualification || ''}`.toLowerCase();
    if (!txt.trim()) return '';
    if (/(ph\.?d|doctor|dphil|d\.phil)/.test(txt)) return 'phd';
    if (/(master|m\.?sc|m\.?a\b|m\.?tech|m\.?eng|mba|mca|m\.?com|mfa|llm|postgrad|pg\b)/.test(txt)) return 'masters';
    if (/(bachelor|b\.?sc|b\.?a\b|b\.?tech|b\.?e\b|b\.?com|bba|bca|llb|undergrad)/.test(txt)) return 'bachelors';
    if (/(diploma|associate)/.test(txt)) return 'diploma';
    if (/(high\s*school|secondary|hsc|ssc|12th|10th)/.test(txt)) return 'highschool';
    return '';
  };
  let best = '';
  let bestRank = 0;
  for (const e of education) {
    const lvl = classify(e);
    if (lvl && (rank[lvl] || 0) > bestRank) { best = lvl; bestRank = rank[lvl]; }
  }
  return best;
}

function deriveOrgLayer(roleTitle: string): string {
  const t = (roleTitle || '').toLowerCase();
  if (!t) return '';
  if (/(founder|co-?founder|ceo|cto|cfo|coo|cmo|chro|chief|president|partner|owner)/.test(t)) return 'exec';
  if (/(vp\b|vice\s*president|svp|evp)/.test(t)) return 'vp';
  if (/(director|head of|head,\s|chief of staff)/.test(t)) return 'director';
  if (/(manager|sr\.?\s*manager|senior manager|engineering manager|program manager|product manager)/.test(t)) return 'manager';
  if (/(lead|tech lead|team lead|principal|staff)/.test(t)) return 'team_lead';
  return 'ic';
}

function extractCurrentResponsibilities(experience: any[]): string {
  if (!Array.isArray(experience) || experience.length === 0) return '';
  // Founder/transition roles often have empty descriptions; walk forward to the
  // first experience that actually has prose to seed the textarea with.
  const pickDesc = (e: any) => String(e?.description || e?.summary || e?.responsibilities || '').trim();
  let raw = '';
  for (const e of experience) {
    const d = pickDesc(e);
    if (d) { raw = d; break; }
  }
  if (!raw) return '';
  // Decode common HTML entities, collapse bullets/newlines into a clean,
  // readable string capped at 1500 chars.
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[\u2022•●○]+/g, '· ')
    .replace(/\s*\n\s*/g, ' · ')
    .replace(/·\s*·/g, '·')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 1500);
}

function deriveAssessmentDefaults(profile: any): {
  currentRole: string; targetRole: string; industry: string; careerStage: string; experienceYears: number;
  tenureMonths: number | null; educationLevel: string; orgLayer: string; currentResponsibilities: string;
  sources: {
    currentRole: string; targetRole: string; industry: string; careerStage: string;
    tenureMonths?: string; educationLevel?: string; orgLayer?: string; currentResponsibilities?: string;
  };
} {
  const exp = profile?.experience || [];
  const edu = profile?.education || [];
  const latestRole = exp[0]?.role || '';
  const years = parseExpYears(exp);
  const stage = deriveStage(years, latestRole);
  const ind = guessIndustry(profile);
  const targetFromGoals = (profile?.targetRole || profile?.goals?.[0]?.role || '').toString();
  const fitToRoles = (r: string) => ROLES.find(x => x.toLowerCase() === r.toLowerCase()) || r;
  const tenure = deriveTenureMonths(exp);
  const eduLevel = deriveEducationLevel(edu);
  const layer = deriveOrgLayer(latestRole);
  const resp = extractCurrentResponsibilities(exp);
  return {
    currentRole: latestRole ? fitToRoles(latestRole) : 'Software Engineer',
    targetRole: targetFromGoals ? fitToRoles(targetFromGoals) : (latestRole ? fitToRoles(latestRole) : 'Software Engineer'),
    industry: ind.industry,
    careerStage: stage.stage,
    experienceYears: years,
    tenureMonths: tenure,
    educationLevel: eduLevel,
    orgLayer: layer,
    currentResponsibilities: resp,
    sources: {
      currentRole: latestRole ? `from your latest job: ${exp[0]?.company || 'most recent role'}` : 'no resume yet — using default',
      targetRole:  targetFromGoals ? 'from your career goals' : (latestRole ? 'matching current role — set a goal to refine' : 'no goal set yet'),
      industry:    ind.reason,
      careerStage: stage.reason,
      tenureMonths: tenure != null ? `computed from start date at ${exp[0]?.company || 'current role'}` : '',
      educationLevel: eduLevel ? `from your highest degree: ${edu.find((e: any) => /(ph\.?d|doctor|master|bachelor|diploma|high)/i.test(`${e?.degree || ''} ${e?.field || ''}`))?.degree || edu[0]?.degree || ''}` : '',
      orgLayer: layer && latestRole ? `inferred from "${latestRole}" — adjust if your scope differs` : '',
      currentResponsibilities: resp ? `pulled from your ${exp[0]?.company || 'latest role'} description` : '',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// V2 Contextual DNA Preview (feature-flagged, additive — renders nothing
// when /api/v2/competency/feature-flag returns false). Lives BELOW the
// AssessmentTab setup fields; never replaces or rewrites them.
// ═══════════════════════════════════════════════════════════════════════════
function V2ContextPreview({ userId, currentRole, targetRole, industry, careerStage, currentRoleNode }: {
  userId: string;
  currentRole: string;
  targetRole: string;
  industry: string;
  careerStage: string;
  currentRoleNode: RoleOption | null | undefined;
}) {
  const enabled = useCompetencyRuntimeStore(s => s.enabled);
  const loading = useCompetencyRuntimeStore(s => s.loading);
  const weights = useCompetencyRuntimeStore(s => s.runtimeWeights);
  const levels = useCompetencyRuntimeStore(s => s.contextualExpectations);
  const modifiers = useCompetencyRuntimeStore(s => s.appliedModifiers);
  const explainability = useCompetencyRuntimeStore(s => s.explainability);
  const confidence = useCompetencyRuntimeStore(s => s.confidence);
  const intensity = useCompetencyRuntimeStore(s => s.intensity);
  const checkFlag = useCompetencyRuntimeStore(s => s.checkFlag);
  const resolve = useCompetencyRuntimeStore(s => s.resolve);

  useEffect(() => { checkFlag(); }, [checkFlag]);

  const orgMaturity = useMemo(() => {
    const s = (careerStage || '').toLowerCase();
    if (s.includes('founder') || s.includes('startup')) return 'startup';
    if (s.includes('senior') || s.includes('exec') || s.includes('director')) return 'enterprise';
    return null;
  }, [careerStage]);

  const layerId = useMemo(() => {
    const s = (careerStage || '').toLowerCase();
    if (s.includes('exec') || s.includes('director') || s.includes('vp')) return 'executive';
    if (s.includes('lead') || s.includes('principal')) return 'leadership';
    if (s.includes('manager')) return 'managerial';
    if (s.includes('specialist') || s.includes('senior')) return 'specialist';
    return null;
  }, [careerStage]);

  const industryToken = useMemo(() => {
    const i = (industry || '').toLowerCase();
    if (i.includes('ai') || i.includes('ml')) return 'ai_ml';
    if (i.includes('health')) return 'healthcare';
    if (i.includes('finance') || i.includes('bank') || i.includes('pharma')) return 'regulated';
    return null;
  }, [industry]);

  const canResolve = !!(currentRole && targetRole && industry && careerStage);

  if (enabled !== true) return null;

  return (
    <div className="bg-gradient-to-br from-violet-50 via-white to-blue-50 border border-violet-200 rounded-2xl p-4 space-y-3" data-testid="v2-context-preview">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-semibold tracking-wide">V2 PREVIEW</span>
          <h4 className="text-sm font-semibold text-gray-800">Contextual Competency DNA</h4>
        </div>
        <button
          type="button"
          disabled={!canResolve || loading}
          onClick={() => resolve({
            role_id: currentRoleNode?.id ?? null,
            industry_id: industryToken,
            layer_id: layerId,
            org_maturity: orgMaturity,
            seniority_band: careerStage || null,
            assessment_mode: 'preview',
          })}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="v2-resolve-btn"
        >
          {loading ? 'Resolving…' : weights ? 'Re-resolve' : 'Resolve DNA'}
        </button>
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Developmental signals only — not a hiring, promotion, or suitability prediction.
        Powered by ontology-driven Role DNA + context modifiers.
      </p>

      {!weights && (
        <div className="text-xs text-gray-400 italic">
          {canResolve ? 'Click "Resolve DNA" to preview the contextual weights that will drive your assessment.' : 'Fill in role, industry, and stage above to enable preview.'}
        </div>
      )}

      {weights && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white border border-violet-100 rounded-xl p-3 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Contextual weights</div>
            {Object.entries(weights).sort((a, b) => b[1] - a[1]).map(([code, w]) => (
              <div key={code} className="flex items-center gap-2 text-[11px]">
                <span className="w-10 font-mono font-semibold text-gray-700">{code}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500" style={{ width: `${Math.min(100, w * 100 * 4)}%` }} />
                </div>
                <span className="w-12 text-right text-gray-600 tabular-nums">{(w * 100).toFixed(1)}%</span>
                <span className="w-12 text-right text-gray-400 tabular-nums">L{(levels?.[code] ?? 0).toFixed(0)}</span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-violet-100 rounded-xl p-3 space-y-2 text-[11px]">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Applied modifiers</div>
            {modifiers && modifiers.length > 0 ? (
              <ul className="space-y-1">
                {modifiers.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="text-gray-700">{m.modifier_type}:<b>{m.modifier_name}</b></span>
                    <span className="text-violet-600 font-mono">×{m.adjustment_weight.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-400 italic">No context modifiers matched — base DNA only.</div>
            )}

            <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Confidence</span>
                <span className="font-semibold text-gray-700">{confidence != null ? `${(confidence * 100).toFixed(0)}%` : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Assessment intensity</span>
                <span className="font-semibold text-gray-700">{intensity != null ? intensity.toFixed(2) : '—'}</span>
              </div>
              {explainability?.confidence?.provenance && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Source</span>
                  <span className="font-mono text-[10px] text-gray-600">{explainability.confidence.provenance}</span>
                </div>
              )}
            </div>
          </div>

          {explainability?.why_competencies_selected && (
            <div className="md:col-span-2 bg-white border border-violet-100 rounded-xl p-3 text-[11px] text-gray-600 leading-relaxed">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 mb-1">Why these competencies</div>
              {explainability.why_competencies_selected}
              {explainability.why_cohort && (
                <div className="mt-1 text-gray-500"><b>Cohort:</b> {explainability.why_cohort}</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] text-gray-400">user {userId.slice(0, 8)}… · runtime v2.0.0</div>
    </div>
  );
}

// ── Chip option catalogs (used by the detailed Assessment Setup form) ───────
const AGE_BAND_OPTIONS = [
  { value: '18-24', label: '18–24' }, { value: '25-29', label: '25–29' },
  { value: '30-34', label: '30–34' }, { value: '35-39', label: '35–39' },
  { value: '40-49', label: '40–49' }, { value: '50+',   label: '50+' },
];
const GENDER_OPTIONS = [
  { value: 'woman', label: 'Woman' }, { value: 'man', label: 'Man' },
  { value: 'nonbinary', label: 'Non-binary' }, { value: 'prefer_not', label: 'Prefer not to say' },
];
const GEOGRAPHY_OPTIONS = [
  { value: 'IN', label: 'India' }, { value: 'APAC', label: 'Asia-Pacific' },
  { value: 'EU', label: 'Europe' }, { value: 'NA', label: 'North America' },
  { value: 'ME', label: 'Middle East' }, { value: 'AF', label: 'Africa' },
  { value: 'LATAM', label: 'Latin America' }, { value: 'OTHER', label: 'Other' },
];
const EDUCATION_OPTIONS = [
  { value: 'highschool', label: 'High School' }, { value: 'diploma', label: 'Diploma' },
  { value: 'bachelors', label: "Bachelor's" }, { value: 'masters', label: "Master's" },
  { value: 'phd', label: 'PhD / Doctorate' }, { value: 'other', label: 'Other' },
];
const ORG_LAYER_OPTIONS = [
  { value: 'ic', label: 'Individual Contributor' }, { value: 'team_lead', label: 'Team Lead' },
  { value: 'manager', label: 'Manager' }, { value: 'director', label: 'Director' },
  { value: 'vp', label: 'VP+' }, { value: 'exec', label: 'Executive / C-suite' },
];
const ORG_MATURITY_OPTIONS = [
  { value: 'startup', label: 'Startup (<50)' }, { value: 'scaleup', label: 'Scaleup (50–500)' },
  { value: 'midsize', label: 'Mid-size (500–5k)' }, { value: 'enterprise', label: 'Enterprise (5k+)' },
  { value: 'regulated', label: 'Regulated' }, { value: 'public', label: 'Public Sector' },
];
const TEAM_SIZE_OPTIONS = [
  { value: 'solo', label: 'Solo' }, { value: '2-5', label: '2–5' },
  { value: '6-15', label: '6–15' }, { value: '16-50', label: '16–50' }, { value: '50+', label: '50+' },
];
const WORK_ARRANGEMENT_OPTIONS = [
  { value: 'remote', label: 'Remote' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'onsite', label: 'On-site' },
];
const TARGET_TIMELINE_OPTIONS = [
  { value: '0-6mo', label: '0–6 months' }, { value: '6-12mo', label: '6–12 months' },
  { value: '1-2yr', label: '1–2 years' }, { value: '2-3yr', label: '2–3 years' },
  { value: 'exploring', label: 'Just exploring' },
];

function ChipGroup({ value, onChange, options, testId, allowClear = false }: {
  value: string; onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  testId?: string; allowClear?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testId}>
      {options.map(opt => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(allowClear && selected ? '' : opt.value)}
            className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${
              selected
                ? 'text-white border-transparent shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            style={selected ? { backgroundColor: BRAND.primary } : undefined}
            data-testid={testId ? `${testId}-${opt.value}` : undefined}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function NumberStepper({ value, onChange, min = 0, max = 80, step = 1, suffix, testId }: {
  value: number | null; onChange: (n: number | null) => void;
  min?: number; max?: number; step?: number; suffix?: string; testId?: string;
}) {
  const v = value ?? 0;
  return (
    <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden" data-testid={testId}>
      <button type="button" className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
              disabled={v <= min} onClick={() => onChange(Math.max(min, v - step))}>−</button>
      <input
        type="number"
        value={value ?? ''}
        min={min} max={max} step={step}
        onChange={e => {
          const raw = e.target.value;
          if (raw === '') return onChange(null);
          const n = Math.max(min, Math.min(max, Math.round(+raw)));
          onChange(Number.isFinite(n) ? n : null);
        }}
        className="w-14 text-center text-sm tabular-nums outline-none border-x border-gray-200 py-1.5"
      />
      <button type="button" className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
              disabled={v >= max} onClick={() => onChange(Math.min(max, v + step))}>+</button>
      {suffix && <span className="px-2 text-[11px] text-gray-400 border-l border-gray-100">{suffix}</span>}
    </div>
  );
}

function AssessmentTab({ userId, profile, onTabChange }: {
  userId: string; profile: any; onTabChange: (t: TabId) => void;
}) {
  type View = 'landing' | 'setup' | 'assessment' | 'submitting' | 'results';
  const [view, setView] = useState<View>('landing');
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  // Profile-derived defaults — recomputed when profile arrives/changes
  const defaults = useMemo(() => deriveAssessmentDefaults(profile), [profile]);
  const [currentRole, setCurrentRole] = useState(defaults.currentRole);
  const [targetRole,  setTargetRole]  = useState(defaults.targetRole);
  const [industry,    setIndustry]    = useState(defaults.industry);
  const [careerStage, setCareerStage] = useState(defaults.careerStage);
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  // ── Extended context fields (Phase 2/6/7/8 inputs) ───────────────────────
  // Defaults read lazily from profile when available; user can edit any chip/value.
  const profileGeoDefault = useMemo(() => {
    const loc = String(profile?.location || profile?.country || '').toLowerCase();
    if (!loc) return '';
    if (loc.includes('india') || loc.endsWith(' in')) return 'IN';
    if (loc.includes('singapore') || loc.includes('japan') || loc.includes('australia') || loc.includes('apac')) return 'APAC';
    if (loc.includes('uk') || loc.includes('germany') || loc.includes('france') || loc.includes('europe')) return 'EU';
    if (loc.includes('usa') || loc.includes('united states') || loc.includes('canada') || loc.includes('mexico')) return 'NA';
    if (loc.includes('uae') || loc.includes('saudi') || loc.includes('israel')) return 'ME';
    if (loc.includes('brazil') || loc.includes('argentina') || loc.includes('chile')) return 'LATAM';
    return '';
  }, [profile]);
  const [experienceYears,      setExperienceYears]      = useState<number | null>(defaults.experienceYears ?? null);
  const [tenureMonths,         setTenureMonths]         = useState<number | null>(defaults.tenureMonths);
  const [orgLayer,             setOrgLayer]             = useState(defaults.orgLayer);
  const [orgMaturity,          setOrgMaturity]          = useState('');
  const [teamSize,             setTeamSize]             = useState('');
  const [workArrangement,      setWorkArrangement]      = useState('');
  const [geography,            setGeography]            = useState(profileGeoDefault);
  const [ageBand,              setAgeBand]              = useState('');
  const [gender,               setGender]               = useState('');
  const [educationLevel,       setEducationLevel]       = useState(defaults.educationLevel);
  const [targetTimeline,       setTargetTimeline]       = useState('');
  const [currentResponsibilities, setCurrentResponsibilities] = useState(defaults.currentResponsibilities);
  const [targetResponsibilities,  setTargetResponsibilities]  = useState('');
  const [primarySkills,        setPrimarySkills]        = useState(
    Array.isArray(profile?.skills?.technical) ? profile.skills.technical.slice(0, 8).join(', ') : '',
  );
  const [showDemographics, setShowDemographics] = useState(false); // collapsed by default
  // Set true the first time user clicks Start with missing fields → switches all
  // required-field affordances from "amber hint" to "red error" + scrolls to first.
  const [triedSubmit, setTriedSubmit] = useState(false);

  // Re-sync when profile loads asynchronously (only fields the user hasn't manually changed)
  useEffect(() => {
    if (!editedFields.has('currentRole')) setCurrentRole(defaults.currentRole);
    if (!editedFields.has('targetRole'))  setTargetRole(defaults.targetRole);
    if (!editedFields.has('industry'))    setIndustry(defaults.industry);
    if (!editedFields.has('careerStage')) setCareerStage(defaults.careerStage);
    if (!editedFields.has('experienceYears')) setExperienceYears(defaults.experienceYears ?? null);
    // Always mirror the latest profile inference (even when empty) so a fresh
    // profile upload clears stale auto-filled values from a previous profile.
    if (!editedFields.has('tenureMonths')) setTenureMonths(defaults.tenureMonths);
    if (!editedFields.has('orgLayer')) setOrgLayer(defaults.orgLayer);
    if (!editedFields.has('educationLevel')) setEducationLevel(defaults.educationLevel);
    if (!editedFields.has('currentResponsibilities')) setCurrentResponsibilities(defaults.currentResponsibilities);
    if (!editedFields.has('primarySkills')) {
      const tech = Array.isArray(profile?.skills?.technical) ? profile.skills.technical : [];
      setPrimarySkills(tech.slice(0, 8).join(', '));
    }
    if (!editedFields.has('geography') && profileGeoDefault) setGeography(profileGeoDefault);
  }, [defaults, profileGeoDefault]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track the original profile-derived text so we can show "your profile said X" when
  // we couldn't auto-match it against the ontology.
  const [unmatchedHints, setUnmatchedHints] = useState<Record<string, string>>({});
  const markEdited = (field: string, setter: (v: string) => void) => (v: string) => { setter(v); setEditedFields(s => new Set(s).add(field)); };
  const profileLoaded = !!(profile?.experience?.length || profile?.skills?.technical?.length || profile?.summary);

  // ── Backend-driven options (Layer 1) + adjacent-role suggestions (Layer 3) ──
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [industryOptions, setIndustryOptions] = useState<IndustryOption[]>([]);
  const [adjacents, setAdjacents] = useState<AdjacentRole[]>([]);
  const [adjacentsLoading, setAdjacentsLoading] = useState(false);
  useEffect(() => {
    const h = authHeader() as Record<string, string>;
    loadRoleOptions(h).then(setRoleOptions).catch(() => {});
    loadIndustryOptions(h).then(setIndustryOptions).catch(() => {});
  }, []);
  useEffect(() => {
    if (!currentRole || roleOptions.length === 0) { setAdjacents([]); return; }
    const id = findRoleIdByTitle(roleOptions, currentRole);
    if (!id) { setAdjacents([]); return; }
    setAdjacentsLoading(true);
    loadAdjacentRoles(id, authHeader() as Record<string, string>)
      .then(setAdjacents)
      .catch(() => setAdjacents([]))
      .finally(() => setAdjacentsLoading(false));
  }, [currentRole, roleOptions]);

  // Auto-link role → industry/department from the catalog. When the user
  // picks a current role that exists in the industry taxonomy and they have
  // NOT manually edited industry, pre-fill the matching industry so the
  // assessment runtime has the correct context.
  const currentRoleNode = useMemo(
    () => findRoleByTitle(roleOptions, currentRole),
    [currentRole, roleOptions],
  );
  const targetRoleNode = useMemo(
    () => findRoleByTitle(roleOptions, targetRole),
    [targetRole, roleOptions],
  );
  useEffect(() => {
    if (!currentRoleNode?.industryName) return;
    if (editedFields.has('industry')) return;
    if (industry === currentRoleNode.industryName) return;
    setIndustry(currentRoleNode.industryName);
  }, [currentRoleNode, editedFields, industry]);

  // Validate prefilled values against ontology once it loads. Free-text prefills
  // (e.g. "Startup Founder" from a resume) are fuzzy-matched to the closest
  // ontology entry; unmatched values are cleared so users must pick from the list.
  useEffect(() => {
    if (roleOptions.length === 0) return;
    const titles = roleOptions.map(r => r.title);
    const hints: Record<string, string> = {};
    const validate = (field: 'currentRole' | 'targetRole', val: string, setter: (v: string) => void) => {
      if (editedFields.has(field) || !val) return;
      if (titles.some(t => t.toLowerCase() === val.toLowerCase())) return; // already canonical
      const match = fuzzyMatchTitle(val, titles);
      if (match) { setter(match); }
      else { hints[field] = val; setter(''); }
    };
    validate('currentRole', currentRole, setCurrentRole);
    validate('targetRole',  targetRole,  setTargetRole);
    setUnmatchedHints(h => ({ ...h, ...hints }));
  }, [roleOptions]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (industryOptions.length === 0) return;
    if (editedFields.has('industry') || !industry) return;
    const names = industryOptions.map(i => i.name);
    if (names.some(n => n.toLowerCase() === industry.toLowerCase())) return;
    const match = fuzzyMatchTitle(industry, names);
    if (match) setIndustry(match);
    else { setUnmatchedHints(h => ({ ...h, industry })); setIndustry(''); }
  }, [industryOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Custom entries (user-added roles/industries not in the canonical catalog) ──
  // Backed by localStorage via `lib/customEntries.ts`. Lets candidates type in
  // titles like "Founder", "Chief of Staff", "DevRel Lead" etc. that the IT-focused
  // catalog doesn't yet include. Custom entries appear in their own group at the
  // top of the popover, are accepted by the canonical-membership validator,
  // and can be removed via the × in the popover.
  const [customRoles, setCustomRoles] = useState<CustomEntry[]>(() => listCustomRoles());
  const [customIndustries, setCustomIndustries] = useState<CustomEntry[]>(() => listCustomIndustries());
  const commitCustomRole = useCallback((label: string) => {
    setCustomRoles(addCustomRole(label));
  }, []);
  const commitCustomIndustry = useCallback((label: string) => {
    setCustomIndustries(addCustomIndustry(label));
  }, []);
  const dropCustomRole = useCallback((key: string) => {
    const next = removeCustomRole(key);
    setCustomRoles(next);
    // If the removed entry was selected, clear the field so the user picks again.
    if (currentRole.trim().toLowerCase() === key.toLowerCase()) setCurrentRole('');
    if (targetRole.trim().toLowerCase() === key.toLowerCase()) setTargetRole('');
  }, [currentRole, targetRole]);
  const dropCustomIndustry = useCallback((key: string) => {
    const next = removeCustomIndustry(key);
    setCustomIndustries(next);
    if (industry.trim().toLowerCase() === key.toLowerCase()) setIndustry('');
  }, [industry]);

  const roleItems: ComboItem[] = useMemo(() => {
    const catalogTitles = new Set(roleOptions.map(r => r.title.toLowerCase()));
    const custom: ComboItem[] = customRoles
      .filter(e => !catalogTitles.has(e.key))
      .map(e => ({
        value: e.label, label: e.label, meta: 'Custom', group: 'Your custom roles', groupOrder: 0,
      }));
    const catalog: ComboItem[] = roleOptions.map(r => ({ value: r.title, label: r.title, meta: r.meta }));
    return [...custom, ...catalog];
  }, [roleOptions, customRoles]);
  const industryItems: ComboItem[] = useMemo(() => {
    const catalogNames = new Set(industryOptions.map(i => i.name.toLowerCase()));
    const custom: ComboItem[] = customIndustries
      .filter(e => !catalogNames.has(e.key))
      .map(e => ({
        value: e.label, label: e.label, meta: 'Custom', group: 'Your custom industries', groupOrder: 0,
      }));
    const catalog: ComboItem[] = industryOptions.map(i => ({ value: i.name, label: i.name }));
    return [...custom, ...catalog];
  }, [industryOptions, customIndustries]);
  const stageItems: ComboItem[] = useMemo(
    () => STAGE_OPTIONS.map(s => ({ value: s.value, label: s.label, meta: s.hint })),
    [],
  );
  // Target-role suggestions: prefer the Phase-3 ontology mobility API when it
  // returns rows; otherwise fall back to the catalog-driven adjacency (same
  // industry/department/sub-department) so the field always feels predictive.
  const targetSuggestions: ComboItem[] = useMemo(() => {
    if (adjacents.length > 0) {
      return adjacents.slice(0, 6).map(a => ({
        value: a.title,
        label: a.title,
        meta: [a.seniority, `${Math.round(a.adjacency_score * 100)}% match`].filter(Boolean).join(' \u00b7 '),
      }));
    }
    return suggestTargetRolesFromCatalog(currentRole, 6).map(a => ({
      value: a.title,
      label: a.title,
      meta: [a.basis, `${Math.round(a.adjacency_score * 100)}% match`].filter(Boolean).join(' \u00b7 '),
    }));
  }, [adjacents, currentRole]);
  const userFirstName = (profile?.firstName || profile?.name || '').toString().split(' ')[0] || 'you';
  const [results, setResults] = useState<AssessmentResults | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Profile-tailored question selection. Picks ~20 items from the adaptive
  // bank ranked by affinity to (currentRole, industry, careerStage, dept/sub)
  // and balanced across the 7 competency domains. Falls back to the static
  // catalog only if the adaptive bank is empty. Memoised so the set is stable
  // for the duration of an attempt — changes to profile inputs after the user
  // has started answering won't reshuffle questions mid-flow.
  // Retake counter — increments each time the user clicks "Retake" so the
  // memo below recomputes with a fresh attempt offset (different question
  // window from the bank). Stable across answer changes within one attempt.
  const [attemptRunId, setAttemptRunId] = useState(0);
  // API-backed selector — fetches the curated, admin-approved pool from
  // /api/competency/questions/select. Falls back to the local static bank
  // inside the helper if the API errors or returns 0 rows, so the assessment
  // never gets stuck. Sync initial state seeds from the local bank to avoid
  // a flash of empty content before the fetch resolves.
  const [selectedQuestions, setSelectedQuestions] = useState(() => selectAssessmentQuestions(
    { role: currentRole, industry, stage: careerStage,
      department: currentRoleNode?.department, subDepartment: currentRoleNode?.subDepartment },
    20, getAssessmentAttempt(userId), userId,
  ));
  useEffect(() => {
    let alive = true;
    selectAssessmentQuestionsFromAPI(
      { role: currentRole, industry, stage: careerStage,
        department: currentRoleNode?.department, subDepartment: currentRoleNode?.subDepartment },
      20, getAssessmentAttempt(userId), userId,
    ).then((qs) => { if (alive && qs.length) setSelectedQuestions(qs); }).catch(() => {});
    return () => { alive = false; };
    // Intentionally exclude profile fields after first compute so the question
    // set stays stable once the user begins answering. Recomputes only when
    // the user explicitly retakes (attemptRunId bumped) or userId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptRunId, userId]);
  const totalQ = selectedQuestions.length;
  const currentQ = selectedQuestions[qIndex] ?? selectedQuestions[0];
  const answered = Object.keys(answers).length;
  const pct = Math.round((answered / totalQ) * 100);

  // Stores the **option index** the user clicked (0-based). Score is looked
  // up from currentQ.options[index] at compute time. Avoids the bug where
  // multiple SJT options sharing a score (e.g. 3 distractors all = 20)
  // would all highlight when the user clicked one of them.
  const selectAnswer = (qId: string, optionIndex: number) => {
    setAnswers(a => ({ ...a, [qId]: optionIndex }));
    if (qIndex < totalQ - 1) setTimeout(() => setQIndex(i => i + 1), 300);
  };

  // Auto-submit when the user answers the LAST question on the last screen.
  // Mirrors the auto-advance UX from Q1\u2013Q19 so the page never feels frozen
  // after Q20 (previously a stale Submit button could be hidden under the chat
  // widget, making the page look blank).
  //
  // One-shot guard (autoSubmittedRef): we only fire once per assessment attempt.
  // The latch resets when the user (a) starts a new attempt (view leaves
  // assessment then returns with empty answers) or (b) edits an earlier answer
  // such that answers becomes incomplete again. We also bail if `errorMsg` is
  // set so a failed submit doesn't auto-retry in a loop \u2014 the user must
  // click Submit again explicitly.
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (view !== 'assessment') { autoSubmittedRef.current = false; return; }
    if (Object.keys(answers).length < totalQ) { autoSubmittedRef.current = false; return; }
    if (qIndex !== totalQ - 1) return;
    if (autoSubmittedRef.current) return;
    if (errorMsg) return; // don't auto-retry after a failure
    autoSubmittedRef.current = true;
    const t = setTimeout(() => { submitAssessment(); }, 600);
    return () => clearTimeout(t);
    // submitAssessment intentionally omitted \u2014 ref guard ensures single fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, qIndex, answers, errorMsg]);

  const submitAssessment = async () => {
    setErrorMsg('');
    setView('submitting');
    try {
      const scores = computeScoresFromSelected(selectedQuestions, answers);
      const profileRes = await fetch(`/api/competency/profile/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as Record<string, string>) },
        body: JSON.stringify({
          currentRole, targetRole, industry, careerStage,
          experienceYears: experienceYears ?? defaults.experienceYears ?? null,
          tenureMonths,
          orgLayer, orgMaturity, teamSize, workArrangement,
          geography, ageBand, gender, educationLevel,
          targetTimeline, currentResponsibilities, targetResponsibilities, primarySkills,
          currentDepartment: currentRoleNode?.department ?? null,
          currentSubDepartment: currentRoleNode?.subDepartment ?? null,
          targetDepartment: targetRoleNode?.department ?? null,
          targetSubDepartment: targetRoleNode?.subDepartment ?? null,
        }),
      });
      if (!profileRes.ok) {
        const detail = await profileRes.text().catch(() => '');
        throw new Error(`Couldn't save your profile (${profileRes.status})${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
      }
      const runRes = await fetch('/api/competency/run-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as Record<string, string>) },
        body: JSON.stringify({ userId, scores }),
      });
      if (!runRes.ok) {
        const detail = await runRes.text().catch(() => '');
        throw new Error(`Couldn't score your assessment (${runRes.status})${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
      }
      // Bridge into Phase 1-5 pipelines (longitudinal history + latest-score store)
      try {
        const scoreMap: Record<string, number> = {};
        for (const s of scores) scoreMap[s.competencyCode] = s.rawScore;
        await fetch('/api/career/assessment/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(authHeader() as Record<string, string>) },
          body: JSON.stringify({
            user_id: userId,
            org_id: (user as any)?.orgId ?? null,
            role_id: targetRole || null,
            scores: scoreMap,
            reliability: 0.78,
            source: 'assessment',
          }),
        });
      } catch { /* non-blocking — local UI already updated */ }
      setLoadingResults(true);
      const [csRes, percRes, gapRes, rfRes, intRes, precRes] = await Promise.all([
        fetch(`/api/competency/compute-score/${userId}`, { headers: authHeader() as HeadersInit }).then(r => r.json()),
        fetch(`/api/competency/get-percentile/${userId}`, { headers: authHeader() as HeadersInit }).then(r => r.json()),
        fetch(`/api/competency/gap-analysis/${userId}`, { headers: authHeader() as HeadersInit }).then(r => r.json()),
        fetch(`/api/competency/role-fit/${userId}`, { headers: authHeader() as HeadersInit }).then(r => r.json()),
        fetch(`/api/competency/interventions/${userId}`, { headers: authHeader() as HeadersInit }).then(r => r.json()),
        fetch(`/api/competency/precise-scores`, { headers: authHeader() as HeadersInit }).then(r => r.json()).catch(() => null),
      ]);
      setResults({ computedScore: csRes, percentile: percRes, gapAnalysis: gapRes, roleFit: rfRes, interventions: intRes, precise: precRes });

      // ── Propagate assessment score into profile so the Employability Index
      // dashboard card recomputes. The EI breakdown (L948+) reads
      // `profile.assessmentScore`; without this write the dashboard would show
      // the same EI before and after submitting the assessment.
      const overall = typeof csRes?.overallScore === 'number' ? csRes.overallScore : null;
      if (overall !== null) {
        setProfile((prev: any) => prev ? { ...prev, assessmentScore: overall } : prev);
        // Persist so it survives reloads. Non-blocking; UI already reflects it.
        fetch(`/api/cv/profile/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(authHeader() as Record<string, string>) },
          body: JSON.stringify({ assessmentScore: overall }),
        }).catch(() => { /* best-effort */ });
      }

      setView('results');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Submission failed. Please try again.');
      setView('assessment');
    } finally {
      setLoadingResults(false);
    }
  };

  const loadExistingResults = async () => {
    setLoadingResults(true);
    try {
      const [csRes, percRes, gapRes, rfRes, intRes, precRes] = await Promise.all([
        fetch(`/api/competency/compute-score/${userId}`, { headers: authHeader() as HeadersInit }).then(r => r.json()),
        fetch(`/api/competency/get-percentile/${userId}`, { headers: authHeader() as HeadersInit }).then(r => r.json()),
        fetch(`/api/competency/gap-analysis/${userId}`, { headers: authHeader() as HeadersInit }).then(r => r.json()),
        fetch(`/api/competency/role-fit/${userId}`, { headers: authHeader() as HeadersInit }).then(r => r.json()),
        fetch(`/api/competency/interventions/${userId}`, { headers: authHeader() as HeadersInit }).then(r => r.json()),
        fetch(`/api/competency/precise-scores`, { headers: authHeader() as HeadersInit }).then(r => r.json()).catch(() => null),
      ]);
      if (csRes.totalCompetencies > 0) {
        setResults({ computedScore: csRes, percentile: percRes, gapAnalysis: gapRes, roleFit: rfRes, interventions: intRes, precise: precRes });
        setView('results');
        // Backfill assessmentScore into profile for users who took the
        // assessment before the Employability-Index propagation fix shipped.
        const overall = typeof csRes?.overallScore === 'number' ? csRes.overallScore : null;
        if (overall !== null && overall > 0) {
          setProfile((prev: any) =>
            prev && typeof prev.assessmentScore !== 'number'
              ? { ...prev, assessmentScore: overall }
              : prev,
          );
        }
      }
    } catch {} finally { setLoadingResults(false); }
  };

  useEffect(() => { if (userId) loadExistingResults(); }, [userId]);

  // ── LANDING ──────────────────────────────────────────────────────────────
  if (view === 'landing') return (
    <div className="space-y-5">
      {/* Compact header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">Competency Assessment</h1>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
            20 questions · ~15 min · scored across 7 competencies. The more accurate your
            context below, the sharper your scoring, peer rank, role-fit gap and growth plan.
          </p>
        </div>
        {profileLoaded && (
          <button onClick={() => onTabChange('profile')}
                  className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300 shrink-0"
                  data-testid="edit-profile-from-assessment">
            <Edit3 size={11} /> Edit profile
          </button>
        )}
      </div>

      {loadingResults ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <RefreshCw size={24} className="mx-auto mb-3 animate-spin" style={{ color: BRAND.primary }} />
          <p className="text-sm text-gray-500">Checking existing results…</p>
        </div>
      ) : (
        <>
          {/* How this works — 4-step strip */}
          <div className="bg-gradient-to-br from-indigo-50 via-white to-violet-50 border border-indigo-100 rounded-2xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
              <Lightbulb size={11} /> How this works
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
              {[
                { n: 1, t: 'Set your context', d: 'Role, industry, layer, experience — drives the questions you see.' },
                { n: 2, t: 'Answer 20 questions', d: '~15 min · MCQ + situational + behavioural simulation. Auto-saved.' },
                { n: 3, t: 'Get scored against your cohort', d: 'Role-DNA weighted scoring · k-anonymous peer percentile · confidence tier.' },
                { n: 4, t: 'See gaps + growth plan', d: '7-domain map · role-fit gap · ranked interventions · development pathway.' },
              ].map(s => (
                <div key={s.n} className="bg-white border border-indigo-100 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">{s.n}</span>
                    <span className="text-[11px] font-semibold text-gray-800">{s.t}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 leading-snug">{s.d}</div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-gray-400 mt-3 leading-relaxed">
              7 domains scored: <strong className="text-gray-600">COG</strong> Cognitive · <strong className="text-gray-600">COM</strong> Communication · <strong className="text-gray-600">LED</strong> Leadership · <strong className="text-gray-600">EXE</strong> Execution · <strong className="text-gray-600">ADP</strong> Adaptability · <strong className="text-gray-600">TCH</strong> Technical · <strong className="text-gray-600">EQ</strong> Emotional intelligence.
              <span className="italic"> Developmental signals only — not a hiring, promotion, or suitability prediction.</span>
            </div>
          </div>

          {/* Profile snapshot — verify & update before assessment */}
          {profileLoaded && (() => {
            const personal = profile?.personal || {};
            const fullName = personal.name || (user as any)?.name || '';
            const initials = (fullName || 'U').split(' ').filter(Boolean).slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join('') || 'U';
            const summary = (profile?.summary || '').trim();
            const expArr = Array.isArray(profile?.experience) ? profile.experience : [];
            const latestExp = expArr[0] || null;
            const eduArr = Array.isArray(profile?.education) ? profile.education : [];
            const latestEdu = eduArr[0] || null;
            const certs = Array.isArray(profile?.certifications) ? profile.certifications : [];
            const techSkills = (profile?.skills?.technical || []) as string[];
            const softSkills = (profile?.skills?.soft || []) as string[];
            const langs = (profile?.skills?.languages || profile?.languages || []) as string[];
            const projects = (profile?.projects || []) as any[];
            const achievements = (profile?.achievements || []) as any[];
            const completeness = profile?.competencyProfile?.completeness || 0;
            const expYears = expArr.length > 0
              ? Math.max(1, expArr.reduce((acc: number, e: any) => acc + (Number(e?.years) || Number(e?.durationYears) || 1), 0))
              : null;
            const fmtRange = (e: any) => {
              const s = e?.startDate || e?.from || '';
              const en = e?.endDate || e?.to || (e?.current ? 'Present' : '');
              return [s, en].filter(Boolean).join(' – ');
            };
            return (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                {/* header strip */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                       style={{ backgroundColor: BRAND.primary }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Your profile snapshot</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">Verify before you start</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      The form below auto-fills from this. Update anything that's stale — your scoring, peer rank, and growth plan all depend on it.
                    </div>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                    <div className="text-[10px] text-gray-500">Profile {completeness}% complete</div>
                    <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${completeness}%`, backgroundColor: BRAND.accent }} />
                    </div>
                  </div>
                </div>

                {/* identity row */}
                <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Name</div>
                    <div className="text-gray-900 font-medium truncate">{fullName || <span className="text-gray-400 italic">Not set</span>}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Email</div>
                    <div className="text-gray-700 truncate">{personal.email || (user as any)?.email || <span className="text-gray-400 italic">Not set</span>}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Location</div>
                    <div className="text-gray-700 truncate">{personal.location || personal.country || personal.city || <span className="text-gray-400 italic">Not set</span>}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Phone</div>
                    <div className="text-gray-700 truncate">{personal.phone || personal.mobile || <span className="text-gray-400 italic">Not set</span>}</div>
                  </div>
                </div>

                {/* summary */}
                {summary && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Professional summary</div>
                    <p className="text-[11px] text-gray-700 leading-relaxed">{summary.slice(0, 280)}{summary.length > 280 ? '…' : ''}</p>
                  </div>
                )}

                {/* experience + education */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 border-b border-gray-100">
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Most recent role</div>
                      {expArr.length > 1 && <div className="text-[10px] text-gray-400">+{expArr.length - 1} more</div>}
                    </div>
                    {latestExp ? (
                      <div className="text-[11px]">
                        <div className="text-gray-900 font-semibold truncate">{latestExp.role || latestExp.title || latestExp.position || 'Untitled role'}</div>
                        <div className="text-gray-600 truncate">{latestExp.company || latestExp.organization || latestExp.employer || ''}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{fmtRange(latestExp)}</div>
                        {expYears && <div className="text-[10px] text-gray-500 mt-1">~{expYears} yrs total experience on file</div>}
                      </div>
                    ) : <div className="text-[11px] text-gray-400 italic">No work history added</div>}
                  </div>
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Highest education</div>
                      {eduArr.length > 1 && <div className="text-[10px] text-gray-400">+{eduArr.length - 1} more</div>}
                    </div>
                    {latestEdu ? (
                      <div className="text-[11px]">
                        <div className="text-gray-900 font-semibold truncate">{latestEdu.degree || latestEdu.qualification || 'Degree'}</div>
                        <div className="text-gray-600 truncate">{latestEdu.institution || latestEdu.school || latestEdu.university || ''}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{[latestEdu.fieldOfStudy || latestEdu.major, latestEdu.endYear || latestEdu.graduationYear].filter(Boolean).join(' · ')}</div>
                      </div>
                    ) : <div className="text-[11px] text-gray-400 italic">No education added</div>}
                  </div>
                </div>

                {/* skills + certs + projects strip */}
                <div className="px-4 py-3 border-b border-gray-100 space-y-2.5">
                  {techSkills.length > 0 && (
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Technical skills <span className="text-gray-400 normal-case font-normal">· {techSkills.length} on file</span></div>
                      <div className="flex flex-wrap gap-1">
                        {techSkills.slice(0, 12).map((s, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">{s}</span>
                        ))}
                        {techSkills.length > 12 && <span className="text-[10px] text-gray-400 px-1 py-0.5">+{techSkills.length - 12}</span>}
                      </div>
                    </div>
                  )}
                  {softSkills.length > 0 && (
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Soft skills <span className="text-gray-400 normal-case font-normal">· {softSkills.length} on file</span></div>
                      <div className="flex flex-wrap gap-1">
                        {softSkills.slice(0, 10).map((s, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">{s}</span>
                        ))}
                        {softSkills.length > 10 && <span className="text-[10px] text-gray-400 px-1 py-0.5">+{softSkills.length - 10}</span>}
                      </div>
                    </div>
                  )}
                  {(certs.length > 0 || projects.length > 0 || achievements.length > 0 || langs.length > 0) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-gray-600 pt-1">
                      {certs.length > 0 && (
                        <div><span className="font-semibold text-gray-800">{certs.length}</span> certification{certs.length === 1 ? '' : 's'}{certs[0]?.name ? ` · ${certs[0].name}${certs.length > 1 ? ` +${certs.length - 1}` : ''}` : ''}</div>
                      )}
                      {projects.length > 0 && <div><span className="font-semibold text-gray-800">{projects.length}</span> project{projects.length === 1 ? '' : 's'}</div>}
                      {achievements.length > 0 && <div><span className="font-semibold text-gray-800">{achievements.length}</span> achievement{achievements.length === 1 ? '' : 's'}</div>}
                      {langs.length > 0 && <div><span className="font-semibold text-gray-800">{langs.length}</span> language{langs.length === 1 ? '' : 's'}: {langs.slice(0, 3).join(', ')}{langs.length > 3 ? '…' : ''}</div>}
                    </div>
                  )}
                  {techSkills.length === 0 && softSkills.length === 0 && certs.length === 0 && projects.length === 0 && (
                    <div className="text-[11px] text-gray-400 italic">No skills, certifications, or projects on file yet.</div>
                  )}
                </div>

                {/* footer actions */}
                <div className="px-4 py-2.5 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                    <CheckCircle size={11} className="text-emerald-600" />
                    Looks accurate? Scroll down to confirm your context and start.
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onTabChange('resume')}
                            className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300"
                            data-testid="reupload-resume-from-assessment">
                      <RefreshCw size={11} /> Re-upload resume
                    </button>
                    <button onClick={() => onTabChange('profile')}
                            className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white"
                            style={{ backgroundColor: BRAND.primary }}
                            data-testid="edit-profile-snapshot">
                      <Edit3 size={11} /> Update profile
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Add-profile prompt — only when profile is empty */}
          {!profileLoaded && (
            <div className="rounded-2xl p-4 shadow-sm border border-amber-200 bg-amber-50">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-500 text-white shrink-0">
                  <Lightbulb size={14} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-amber-900">For a sharper assessment, add your profile first</div>
                  <div className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Takes ~2 mins. You can still proceed below — we'll prompt for the essentials.
                  </div>
                </div>
                <button onClick={() => onTabChange('profile')}
                        className="text-[11px] flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 shrink-0"
                        data-testid="add-profile-from-assessment">
                  <Edit3 size={11} /> Add profile
                </button>
              </div>
            </div>
          )}

          {/* Build the 4 combobox configs once and provide a renderField helper */}
          {(() => {
            const DEPT_EMPHASIS: Record<string, string> = {
              'Executive Management': 'leadership, strategic decision-making',
              'Human Resources':      'communication, EQ, people development',
              'Finance':              'analytical reasoning, execution rigour',
              'Engineering':          'technical depth, problem-solving, adaptability',
            };
            const STAGE_DETAIL: Record<string, { anchor: number; exp: string; band: string }> = {
              junior:   { anchor: 55, exp: '0\u20132 yrs',  band: 'Builder' },
              mid:      { anchor: 65, exp: '3\u20135 yrs',  band: 'Builder \u2192 Career-Ready' },
              senior:   { anchor: 75, exp: '6\u20139 yrs',  band: 'Career-Ready' },
              lead:     { anchor: 80, exp: '10\u201314 yrs', band: 'Career-Ready \u2192 Hire-Ready' },
              director: { anchor: 85, exp: '15+ yrs',       band: 'Hire-Ready' },
            };
            const classifyMove = (): string | null => {
              if (!currentRoleNode || !targetRoleNode) return null;
              if (currentRoleNode.title === targetRoleNode.title)
                return 'same role \u2014 we\u2019ll measure depth and mastery';
              if (currentRoleNode.industryName !== targetRoleNode.industryName)
                return `cross-industry pivot \u2014 transferable skills emphasized`;
              if (currentRoleNode.department !== targetRoleNode.department)
                return `lateral pivot to ${targetRoleNode.department} \u2014 expect learning-agility focus`;
              if (currentRoleNode.subDepartment !== targetRoleNode.subDepartment)
                return `team move within ${targetRoleNode.department}`;
              return `vertical move within ${targetRoleNode.subDepartment}`;
            };
            const currentCaption = currentRoleNode
              ? `${currentRoleNode.department} \u00b7 ${currentRoleNode.subDepartment}${DEPT_EMPHASIS[currentRoleNode.department] ? ` \u2014 weights ${DEPT_EMPHASIS[currentRoleNode.department]}` : ''}`
              : 'Pick your role so we tailor questions and target suggestions';
            const targetCaption = targetRoleNode
              ? (() => { const move = classifyMove(); const path = `${targetRoleNode.department} \u00b7 ${targetRoleNode.subDepartment}`; return move ? `${path} \u2014 ${move}` : path; })()
              : currentRole ? 'Pick where you\u2019re heading \u2014 drives gap analysis & adjacency suggestions' : null;
            const stageDetail = STAGE_DETAIL[careerStage];
            const stageCaption = stageDetail ? `${stageDetail.exp} \u00b7 anchor ~${stageDetail.anchor}/100 \u00b7 ${stageDetail.band} band` : null;
            const industryCaption = (() => {
              if (!industry) return null;
              if (currentRoleNode && industry === currentRoleNode.industryName)
                return `auto-linked from your role \u2014 cohort: ${industry}${careerStage ? ` \u00b7 ${careerStage}` : ''}`;
              return careerStage ? `peer cohort: ${industry} \u00b7 ${careerStage}` : `peer cohort: ${industry}`;
            })();
            type FieldCfg = {
              key: string; label: string; val: string; set: (v: string) => void;
              items: ComboItem[]; suggestions: ComboItem[]; suggestionsLoading: boolean;
              placeholder: string; source: string; contextMeta: string | null;
              allowFree: boolean; customs: CustomEntry[];
              onAddCustom?: (label: string) => void; onRemoveCustom?: (key: string) => void;
            };
            const fields: FieldCfg[] = [
              { key: 'currentRole', label: 'Current Role', val: currentRole, set: setCurrentRole, items: roleItems,     suggestions: [],                placeholder: 'Start typing your role\u2026', source: defaults.sources.currentRole, contextMeta: currentCaption,  allowFree: true,  customs: customRoles,      suggestionsLoading: false,           onAddCustom: commitCustomRole,     onRemoveCustom: dropCustomRole },
              { key: 'targetRole',  label: 'Target Role',  val: targetRole,  set: setTargetRole,  items: roleItems,     suggestions: targetSuggestions, placeholder: 'Where are you heading?',       source: defaults.sources.targetRole,  contextMeta: targetCaption,   allowFree: true,  customs: customRoles,      suggestionsLoading: adjacentsLoading, onAddCustom: commitCustomRole,     onRemoveCustom: dropCustomRole },
              { key: 'careerStage', label: 'Career Stage', val: careerStage, set: setCareerStage, items: stageItems,    suggestions: [],                placeholder: 'Pick a stage',                 source: defaults.sources.careerStage, contextMeta: stageCaption,    allowFree: false, customs: [],               suggestionsLoading: false },
              { key: 'industry',    label: 'Industry',     val: industry,    set: setIndustry,    items: industryItems, suggestions: [],                placeholder: 'Search industries\u2026',      source: defaults.sources.industry,    contextMeta: industryCaption, allowFree: true,  customs: customIndustries, suggestionsLoading: false,           onAddCustom: commitCustomIndustry, onRemoveCustom: dropCustomIndustry },
            ];
            const renderField = (key: string) => {
              const f = fields.find(x => x.key === key);
              if (!f) return null;
              const wasEdited = editedFields.has(f.key);
              const isPrefilled = profileLoaded && !wasEdited && !!f.val;
              const unmatched = unmatchedHints[f.key];
              const needsPick = !f.val && !!unmatched;
              const isCustom = !!f.val && f.customs.some(c => c.key === f.val.trim().toLowerCase());
              const badge = needsPick
                ? (<span className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded normal-case tracking-normal bg-amber-50 text-amber-700">pick from list</span>)
                : isCustom
                ? (<span className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded normal-case tracking-normal bg-violet-50 text-violet-700"><Plus size={8} /> custom</span>)
                : isPrefilled
                ? (<span title={f.source} className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded normal-case tracking-normal" style={{ background: `${BRAND.primary}15`, color: BRAND.primary }}><Sparkles size={8} /> pre-filled</span>)
                : wasEdited
                ? (<span className="inline-flex items-center text-[8px] font-bold px-1.5 py-0.5 rounded normal-case tracking-normal bg-gray-100 text-gray-500">edited</span>)
                : null;
              const caption = needsPick
                ? `your profile said "${unmatched}" \u2014 pick the closest match`
                : isCustom
                ? `custom ${f.key === 'industry' ? 'industry' : 'role'} \u2014 peer benchmarks build as more candidates pick this`
                : f.contextMeta ? f.contextMeta : isPrefilled ? f.source : undefined;
              const borderColor = needsPick ? '#fcd34d' : isPrefilled ? `${BRAND.primary}40` : '#e5e7eb';
              return (
                <AssessmentCombobox
                  label={f.label}
                  value={f.val}
                  onChange={(v) => {
                    const trimmed = v.trim();
                    markEdited(f.key, f.set)(trimmed);
                    if (!trimmed || !f.allowFree || !f.onAddCustom) return;
                    const lower = trimmed.toLowerCase();
                    const inCatalog = f.key === 'industry'
                      ? industryOptions.some(i => i.name.toLowerCase() === lower)
                      : roleOptions.some(r => r.title.toLowerCase() === lower);
                    if (!inCatalog) f.onAddCustom(trimmed);
                  }}
                  items={f.items}
                  suggestions={f.suggestions}
                  suggestionsLabel={f.key === 'targetRole' ? 'Suggested next moves' : 'Suggested for you'}
                  suggestionsLoading={f.suggestionsLoading}
                  allowFreeText={f.allowFree}
                  placeholder={needsPick ? `Pick a ${f.label.toLowerCase()}\u2026` : f.placeholder}
                  brandColor={BRAND.primary}
                  borderColor={borderColor}
                  badge={badge}
                  caption={caption}
                  testId={`assessment-${f.key}`}
                  onRemoveItem={f.onRemoveCustom}
                />
              );
            };

            const SectionHeader = ({ n, title, sub, optional }: { n: number; title: string; sub: string; optional?: boolean }) => (
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0" style={{ background: `${BRAND.primary}15`, color: BRAND.primary }}>{n}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{title}{optional && <span className="text-[10px] font-normal text-gray-400 ml-1.5">· optional</span>}</div>
                    <div className="text-[11px] text-gray-500 leading-snug mt-0.5">{sub}</div>
                  </div>
                </div>
              </div>
            );
            const FieldLabel = ({ children, required, missing, prefilled, error }: { children: React.ReactNode; required?: boolean; missing?: boolean; prefilled?: boolean; error?: boolean }) => (
              <label className={`flex items-center gap-1.5 text-[11px] font-semibold mb-1.5 ${error ? 'text-red-700' : 'text-gray-700'}`}>
                <span>{children}{required && <span className={`ml-0.5 ${error ? 'text-red-600' : 'text-amber-600'}`}>*</span>}</span>
                {required && missing && (
                  <span
                    className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded normal-case tracking-normal ${
                      error
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                    title={error
                      ? 'Please complete this field to continue.'
                      : 'Used to personalise your questions and benchmarks.'}
                  >
                    <span className={`w-1 h-1 rounded-full ${error ? 'bg-red-500' : 'bg-amber-500'}`} /> {error ? 'Required' : 'Required'}
                  </span>
                )}
                {!missing && prefilled && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded normal-case tracking-normal" style={{ background: `${BRAND.primary}15`, color: BRAND.primary }}>
                    <Sparkles size={8} /> pre-filled
                  </span>
                )}
              </label>
            );
            const isPrefilledChip = (key: string, val: any) =>
              profileLoaded && !editedFields.has(key) && (typeof val === 'string' ? !!val.trim() : val != null && val !== '');

            // ── Auto-fill summary — counts what profile populated vs. what still needs input ──
            // Mirror the start-button gating (~L6498 below) so banner status never
            // contradicts the actual Start Assessment enable/disable state.
            const optionsReady = roleOptions.length > 0 && industryOptions.length > 0;
            const _roleTitleSet = new Set([
              ...roleOptions.map(r => r.title.toLowerCase()),
              ...customRoles.map(c => c.key),
            ]);
            const _industryNameSet = new Set([
              ...industryOptions.map(i => i.name.toLowerCase()),
              ...customIndustries.map(c => c.key),
            ]);
            const _stageValueSet = new Set(STAGE_OPTIONS.map(s => s.value));
            const isCanonicalRole = (v: string) => !!v && _roleTitleSet.has(v.toLowerCase());
            const isCanonicalIndustry = (v: string) => !!v && _industryNameSet.has(v.toLowerCase());
            const isCanonicalStage = (v: string) => !!v && _stageValueSet.has(v);

            const autoFilled: Array<{ key: string; label: string }> = [];
            const missingRequired: Array<{ key: string; label: string; section: string }> = [];
            const isAuto = (key: string, val: any) =>
              profileLoaded && !editedFields.has(key) &&
              (typeof val === 'string' ? !!val.trim() : val != null && val !== '');
            const trackAuto = (key: string, label: string, val: any) => { if (isAuto(key, val)) autoFilled.push({ key, label }); };
            // For canonical fields: count missing when value is empty OR not in the canonical set.
            const pushMissing = (key: string, label: string, section: string) =>
              missingRequired.push({ key, label, section });

            trackAuto('currentRole', 'Current role', currentRole);
            trackAuto('industry', 'Industry', industry);
            trackAuto('careerStage', 'Career stage', careerStage);
            trackAuto('orgLayer', 'Org layer', orgLayer);
            trackAuto('experienceYears', 'Total experience', experienceYears);
            trackAuto('tenureMonths', 'Tenure in role', tenureMonths);
            trackAuto('educationLevel', 'Highest education', educationLevel);
            trackAuto('geography', 'Location / region', geography);
            trackAuto('currentResponsibilities', 'Primary responsibilities', currentResponsibilities);
            trackAuto('primarySkills', 'Key skills', primarySkills);

            // Required-field validation mirrors the Start button (~L6498) exactly.
            if (!isCanonicalRole(currentRole))   pushMissing('currentRole', 'Current role', 'Section 2 · Your current role');
            if (!isCanonicalIndustry(industry))  pushMissing('industry', 'Industry', 'Section 2 · Your current role');
            if (!orgLayer)                       pushMissing('orgLayer', 'Org layer', 'Section 2 · Your current role');
            if (!orgMaturity)                    pushMissing('orgMaturity', 'Org maturity', 'Section 2 · Your current role');
            if (!isCanonicalRole(targetRole))    pushMissing('targetRole', 'Target role', 'Section 3 · Where you\u2019re heading');
            if (!isCanonicalStage(careerStage))  pushMissing('careerStage', 'Career stage', 'Section 3 · Where you\u2019re heading');
            const readyToStart = optionsReady && missingRequired.length === 0;
            // Helpers used by required-field FieldLabels + Start-button click handler
            // so error-state styling, scroll-to-first-missing, and the inline summary
            // all read from the same `missingRequired` list.
            const isMissingKey = (k: string) => missingRequired.some(m => m.key === k);
            const handleStartClick = () => {
              if (readyToStart) {
                // Clear error mode so a later return to setup starts fresh.
                setTriedSubmit(false);
                // Bump per-user attempt so retakes get a fresh question window.
                // First-ever start (attempt 0) is unaffected because the bump
                // only takes effect on the *next* memo recompute below.
                if (Object.keys(answers).length > 0 || results) {
                  bumpAssessmentAttempt(userId);
                  setAttemptRunId(n => n + 1);
                }
                setView('assessment'); setQIndex(0); setAnswers({});
                return;
              }
              // While option catalogs are still loading, canonical sets are empty so
              // every required field reads as "missing" — surfacing red errors would
              // be misleading. Hold off until options are ready.
              if (!optionsReady) return;
              setTriedSubmit(true);
              if (missingRequired.length > 0 && typeof document !== 'undefined') {
                const first = missingRequired[0];
                const el = document.getElementById(`field-${first.key}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Brief outline pulse so the user sees what we scrolled to.
                  el.classList.add('ring-2', 'ring-red-400', 'ring-offset-2', 'rounded-xl');
                  window.setTimeout(() => {
                    el.classList.remove('ring-2', 'ring-red-400', 'ring-offset-2', 'rounded-xl');
                  }, 1800);
                }
              }
            };

            return (
              <>
              {/* AUTO-FILL SUMMARY — visible whenever we have a profile to draw from */}
              {profileLoaded && (
                <div
                  className={`rounded-2xl border p-4 shadow-sm ${
                    readyToStart
                      ? 'bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border-emerald-200'
                      : 'bg-gradient-to-r from-violet-50 via-white to-amber-50 border-violet-200'
                  }`}
                  data-testid="assessment-autofill-banner"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: readyToStart ? '#d1fae5' : `${BRAND.primary}20` }}
                      >
                        <Sparkles size={14} style={{ color: readyToStart ? '#059669' : BRAND.primary }} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-800">
                          {autoFilled.length > 0
                            ? <><span style={{ color: BRAND.primary }}>{autoFilled.length}</span> field{autoFilled.length === 1 ? '' : 's'} auto-filled from your profile</>
                            : 'Add your profile to auto-fill this form'}
                          {missingRequired.length > 0 && (
                            <> · <span className="text-amber-700">{missingRequired.length} still need{missingRequired.length === 1 ? 's' : ''} your input</span></>
                          )}
                          {missingRequired.length === 0 && !optionsReady && (
                            <span className="text-gray-500"> · loading options…</span>
                          )}
                          {readyToStart && autoFilled.length > 0 && (
                            <span className="text-emerald-700"> · ready to start</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {readyToStart
                            ? 'Verify the chips below match your reality, then start the assessment.'
                            : !optionsReady
                            ? 'Loading the role & industry catalog — required fields will validate once it\u2019s ready.'
                            : 'We filled what we could infer — please complete the highlighted required fields to start.'}
                        </div>
                      </div>
                    </div>
                    {autoFilled.length > 0 && (
                      <div className="flex flex-wrap gap-1 max-w-full">
                        {autoFilled.slice(0, 6).map(f => (
                          <span key={f.key} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-violet-200 text-violet-700">
                            {f.label}
                          </span>
                        ))}
                        {autoFilled.length > 6 && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-violet-200 text-violet-600">
                            +{autoFilled.length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {missingRequired.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-amber-200/60">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1.5">Required · please fill</div>
                      <div className="flex flex-wrap gap-1.5">
                        {missingRequired.map(f => (
                          <span
                            key={f.key}
                            title={f.section}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-amber-50 border border-amber-300 text-amber-800"
                            data-testid={`missing-required-${f.key}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {f.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 1 — About you (demographics, collapsed by default) */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <button type="button" onClick={() => setShowDemographics(s => !s)}
                        className="w-full flex items-start justify-between gap-3 text-left">
                  <SectionHeader n={1} title="About you" sub="Helps build a representative peer cohort. Used aggregate-only — never shown to others." optional />
                  <span className="text-[11px] text-gray-400 shrink-0 mt-1">{showDemographics ? 'Hide' : 'Show'}</span>
                </button>
                {showDemographics && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div><FieldLabel>Age band</FieldLabel><ChipGroup value={ageBand} onChange={v => { markEdited('ageBand', setAgeBand)(v); }} options={AGE_BAND_OPTIONS} testId="chip-age" allowClear /></div>
                    <div><FieldLabel>Location / region</FieldLabel><ChipGroup value={geography} onChange={v => { markEdited('geography', setGeography)(v); }} options={GEOGRAPHY_OPTIONS} testId="chip-geo" allowClear /></div>
                    <div><FieldLabel>Highest education</FieldLabel><ChipGroup value={educationLevel} onChange={v => { markEdited('educationLevel', setEducationLevel)(v); }} options={EDUCATION_OPTIONS} testId="chip-edu" allowClear /></div>
                    <div><FieldLabel>Gender</FieldLabel><ChipGroup value={gender} onChange={v => { markEdited('gender', setGender)(v); }} options={GENDER_OPTIONS} testId="chip-gender" allowClear /></div>
                  </div>
                )}
              </div>

              {/* SECTION 2 — Your current role */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <SectionHeader n={2} title="Your current role" sub="The most important context — drives role-DNA, weights, and which questions appear." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div id="field-currentRole" className="transition-shadow"><FieldLabel required missing={isMissingKey('currentRole')} error={triedSubmit && isMissingKey('currentRole')}>Current role</FieldLabel>{renderField('currentRole')}</div>
                  <div id="field-industry" className="transition-shadow"><FieldLabel required missing={isMissingKey('industry')} error={triedSubmit && isMissingKey('industry')}>Industry</FieldLabel>{renderField('industry')}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div id="field-orgLayer" className="transition-shadow"><FieldLabel required missing={isMissingKey('orgLayer')} error={triedSubmit && isMissingKey('orgLayer')} prefilled={isPrefilledChip('orgLayer', orgLayer)}>Org layer</FieldLabel><ChipGroup value={orgLayer} onChange={v => { markEdited('orgLayer', setOrgLayer)(v); }} options={ORG_LAYER_OPTIONS} testId="chip-layer" /><p className="text-[10px] text-gray-400 mt-1.5">Distinct from career stage — captures span of control.</p></div>
                  <div id="field-orgMaturity" className="transition-shadow"><FieldLabel required missing={isMissingKey('orgMaturity')} error={triedSubmit && isMissingKey('orgMaturity')}>Org maturity</FieldLabel><ChipGroup value={orgMaturity} onChange={v => { markEdited('orgMaturity', setOrgMaturity)(v); }} options={ORG_MATURITY_OPTIONS} testId="chip-maturity" /><p className="text-[10px] text-gray-400 mt-1.5">Activates context modifiers (startup vs enterprise weighting).</p></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div><FieldLabel>Team size</FieldLabel><ChipGroup value={teamSize} onChange={v => { markEdited('teamSize', setTeamSize)(v); }} options={TEAM_SIZE_OPTIONS} testId="chip-team" allowClear /></div>
                  <div><FieldLabel>Work arrangement</FieldLabel><ChipGroup value={workArrangement} onChange={v => { markEdited('workArrangement', setWorkArrangement)(v); }} options={WORK_ARRANGEMENT_OPTIONS} testId="chip-arrangement" allowClear /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div><FieldLabel>Total experience</FieldLabel><div className="flex items-center gap-2"><NumberStepper value={experienceYears} onChange={n => { markEdited('experienceYears', () => {})(''); setExperienceYears(n); }} min={0} max={60} suffix="yrs" testId="step-exp" /><span className="text-[10px] text-gray-400">across all roles</span></div></div>
                  <div><FieldLabel>Tenure in current role</FieldLabel><div className="flex items-center gap-2"><NumberStepper value={tenureMonths} onChange={n => { markEdited('tenureMonths', () => {})(''); setTenureMonths(n); }} min={0} max={600} suffix="months" testId="step-tenure" /><span className="text-[10px] text-gray-400">time in seat — used by readiness</span></div></div>
                </div>
                <div className="mb-4">
                  <FieldLabel>Key skills (comma-separated)</FieldLabel>
                  <input type="text" value={primarySkills} onChange={e => { markEdited('primarySkills', setPrimarySkills)(e.target.value); }}
                         placeholder="e.g. Python, system design, stakeholder management, SQL, product strategy"
                         className="w-full text-[12px] px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-gray-400"
                         data-testid="input-skills" maxLength={1000} />
                  <p className="text-[10px] text-gray-400 mt-1">Feeds the technical-depth and adaptability signals.</p>
                </div>
                <div>
                  <FieldLabel>Primary responsibilities</FieldLabel>
                  <textarea value={currentResponsibilities} onChange={e => { markEdited('currentResponsibilities', setCurrentResponsibilities)(e.target.value); }}
                            rows={3} maxLength={2000}
                            placeholder="3–5 things you actually own day-to-day. e.g. own backend roadmap for billing · lead a team of 4 engineers · run weekly stakeholder review with sales/finance"
                            className="w-full text-[12px] px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-gray-400 resize-none"
                            data-testid="input-current-resp" />
                  <p className="text-[10px] text-gray-400 mt-1">Sharper responsibilities → sharper scenario questions.</p>
                </div>
              </div>

              {/* SECTION 3 — Where you're heading */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <SectionHeader n={3} title="Where you're heading" sub="The target your gap analysis and growth plan will be measured against." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div id="field-targetRole" className="transition-shadow"><FieldLabel required missing={isMissingKey('targetRole')} error={triedSubmit && isMissingKey('targetRole')}>Target role</FieldLabel>{renderField('targetRole')}</div>
                  <div id="field-careerStage" className="transition-shadow"><FieldLabel required missing={isMissingKey('careerStage')} error={triedSubmit && isMissingKey('careerStage')}>Career stage</FieldLabel>{renderField('careerStage')}</div>
                </div>
                <div className="mb-4">
                  <FieldLabel>Target timeline</FieldLabel>
                  <ChipGroup value={targetTimeline} onChange={v => { markEdited('targetTimeline', setTargetTimeline)(v); }} options={TARGET_TIMELINE_OPTIONS} testId="chip-timeline" allowClear />
                  <p className="text-[10px] text-gray-400 mt-1.5">Calibrates intervention urgency and readiness probability.</p>
                </div>
                <div>
                  {(() => {
                    const words = targetResponsibilities.trim() ? targetResponsibilities.trim().split(/\s+/).length : 0;
                    const min = 60, ideal = 120;
                    const tone = words === 0 ? 'text-gray-400' : words < min ? 'text-amber-600' : words <= ideal ? 'text-emerald-600' : 'text-gray-500';
                    const label = words === 0 ? 'aim for 60–120 words' : words < min ? `add ~${min - words} more for a precise assessment` : words <= ideal ? 'great detail — precise assessment range' : 'plenty of detail';
                    return (
                      <>
                        <div className="flex items-center justify-between mb-1.5">
                          <FieldLabel>What you want to be doing</FieldLabel>
                          <span className={`text-[10px] tabular-nums ${tone}`} data-testid="target-resp-wordcount">
                            {words} word{words === 1 ? '' : 's'} · {label}
                          </span>
                        </div>
                        <textarea value={targetResponsibilities} onChange={e => { markEdited('targetResponsibilities', setTargetResponsibilities)(e.target.value); }}
                                  rows={4} maxLength={2000}
                                  placeholder="Describe day-to-day responsibilities in your target role in 60–120 words. e.g. own technical strategy across 3 teams · drive cross-functional alignment with product & design · mentor senior ICs · run quarterly architecture reviews · partner with VP Eng on org design"
                                  className="w-full text-[12px] px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-gray-400 resize-none"
                                  data-testid="input-target-resp" />
                        <p className="text-[10px] text-gray-400 mt-1">Aim for <b>60–120 words</b> — sharper detail → sharper gap analysis and growth plan.</p>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Action footer */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1"><Clock size={12} /> ~15–20 minutes</span>
                    <span className="flex items-center gap-1"><CheckCircle size={12} style={{ color: BRAND.green }} /> Auto-saved</span>
                    <span className="flex items-center gap-1"><Shield size={12} style={{ color: BRAND.primary }} /> Confidential</span>
                    {profileLoaded && (
                      <span className="flex items-center gap-1" style={{ color: BRAND.primary }}>
                        <Sparkles size={12} /> Tailored to your profile
                      </span>
                    )}
                  </div>
                  {(() => {
                    // Reuses the hoisted optionsReady + canonical checks above so the
                    // banner status and Start button stay in lock-step.
                    const blockReason = !optionsReady
                      ? 'Loading options\u2026'
                      : missingRequired.length > 0
                      ? `Please fill: ${missingRequired.map(m => m.label).join(', ')}`
                      : '';
                    return (
                      <div className="flex flex-col items-end gap-1.5">
                        <button
                          onClick={handleStartClick}
                          title={blockReason || 'Start your assessment'}
                          className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl text-white shadow-sm hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: readyToStart ? BRAND.primary : '#9ca3af' }}
                          data-testid="start-assessment-btn">
                          <Brain size={15} /> Start Assessment
                        </button>
                        {!readyToStart && blockReason && (
                          <div className={`flex items-start gap-1.5 text-[11px] max-w-sm text-right ${triedSubmit ? 'text-red-700 font-semibold' : 'text-amber-700'}`} data-testid="start-block-reason">
                            <AlertCircle size={12} className="shrink-0 mt-0.5" />
                            <span>{triedSubmit ? `${missingRequired.length} required field${missingRequired.length === 1 ? '' : 's'} missing — ${missingRequired.map(m => m.label).join(', ')}` : blockReason}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              </>
            );
          })()}

          {errorMsg && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-600">{errorMsg}</div>
          )}

          {/* Internal V2 runtime previews — gated behind ?debug=1 query param.
              These expose scoring weights, Role-DNA modifiers, and runtime versions
              which are useful to engineers but confusing to candidates. */}
          {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1' && (
            <>
              <V2ContextPreview
                userId={userId}
                currentRole={currentRole}
                targetRole={targetRole}
                industry={industry}
                careerStage={careerStage}
                currentRoleNode={currentRoleNode}
              />
            </>
          )}
        </>
      )}
    </div>
  );

  // ── ASSESSMENT FLOW ───────────────────────────────────────────────────────
  if (view === 'assessment') return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Competency Assessment</h1>
          <p className="text-xs text-gray-500 mt-0.5">Question {qIndex + 1} of {totalQ} · {currentQ.domain}</p>
        </div>
        <button onClick={() => setView('landing')} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <X size={13} /> Exit
        </button>
      </div>

      {/* Progress */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">{pct}% complete</span>
          <span className="text-xs font-medium" style={{ color: BRAND.primary }}>{answered}/{totalQ} answered</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${((qIndex + 1) / totalQ) * 100}%`, background: `${BRAND.primary}` }} />
        </div>
        <div className="flex gap-1 mt-3 flex-wrap">
          {selectedQuestions.map((q, i) => (
            <button key={q.id} onClick={() => setQIndex(i)}
              className="w-6 h-6 rounded-md text-[9px] font-bold transition-all"
              style={{
                backgroundColor: answers[q.id] !== undefined ? BRAND.primary : i === qIndex ? `${BRAND.primary}30` : '#f1f5f9',
                color: answers[q.id] !== undefined ? '#fff' : i === qIndex ? BRAND.primary : '#94a3b8',
              }}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center mb-4">
          <span className="ml-auto text-[10px] text-gray-400 font-medium">{currentQ.competency}</span>
        </div>

        <p className="text-sm font-medium text-gray-800 leading-relaxed mb-5">{currentQ.text}</p>

        {currentQ.hint && (
          <div className="flex items-start gap-2 p-3 rounded-xl mb-4 bg-blue-50 border border-blue-100">
            <Lightbulb size={13} className="shrink-0 mt-0.5" style={{ color: BRAND.accent }} />
            <p className="text-[11px] text-blue-700">{currentQ.hint}</p>
          </div>
        )}

        <div className="space-y-2">
          {currentQ.options.map((opt, oi) => {
            const isSelected = answers[currentQ.id] === oi;
            return (
            <button key={oi} onClick={() => selectAnswer(currentQ.id, oi)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-medium transition-all ${
                isSelected
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
              style={isSelected ? { backgroundColor: BRAND.primary } : {}}>
              <span className="inline-flex items-center gap-3">
                <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-[9px] font-bold"
                  style={isSelected ? { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.3)' } : { borderColor: '#cbd5e1' }}>
                  {String.fromCharCode(65 + oi)}
                </span>
                {opt.label}
              </span>
            </button>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-600">{errorMsg}</div>
      )}
      {/* Nav \u2014 sticky bottom bar so the chat widget can't hide the Submit CTA */}
      <div className="sticky bottom-0 z-10 -mx-1 px-1 pt-2 pb-2 bg-gradient-to-t from-white via-white to-white/0">
        <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-2 shadow-md">
          <button onClick={() => setQIndex(i => Math.max(0, i - 1))} disabled={qIndex === 0}
            className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronLeft size={14} /> Previous
          </button>
          <div className="text-xs text-gray-400">{answered} of {totalQ} answered</div>
          {qIndex < totalQ - 1 ? (
            <button onClick={() => setQIndex(i => Math.min(totalQ - 1, i + 1))}
              className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl text-white"
              style={{ backgroundColor: BRAND.primary }}>
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={submitAssessment} disabled={answered < Math.floor(totalQ * 0.8)}
              className="flex items-center gap-1.5 text-xs font-semibold px-5 py-2 rounded-xl text-white disabled:opacity-50"
              style={{ backgroundColor: BRAND.green }}>
              <CheckCircle size={14} />
              {answered === totalQ ? 'Submitting\u2026 (or click to submit now)' : 'Submit Assessment'}
            </button>
          )}
        </div>
      </div>
      {answered < Math.floor(totalQ * 0.8) && qIndex === totalQ - 1 && (
        <p className="text-center text-xs text-gray-400">Please answer at least {Math.floor(totalQ * 0.8)} questions to submit.</p>
      )}
    </div>
  );

  // ── SUBMITTING ─────────────────────────────────────────────────────────────
  if (view === 'submitting') return (
    <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white"
        style={{ background: `${BRAND.primary}` }}>
        <Brain size={28} />
      </div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">Analyzing your responses…</h2>
      <p className="text-xs text-gray-400 mb-6">Running scoring engine · Computing percentiles · Generating recommendations</p>
      <div className="flex justify-center gap-3">
        {['Scoring answers','Normalizing','Benchmarking','Role-fit analysis'].map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 text-[10px] text-gray-500 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: BRAND.primary }} />
            {s}
          </div>
        ))}
      </div>
    </div>
  );

  // ── RESULTS ────────────────────────────────────────────────────────────────
  if (view === 'results' && results) {
    const cs = results.computedScore || {};
    const perc = results.percentile || {};
    const gap = results.gapAnalysis || {};
    const rf = results.roleFit || {};
    const int_ = results.interventions || {};
    const overallScore = cs.overallScore || 0;
    const overallPct = perc.overallPercentile || 0;
    const roleFitPct = Math.round((rf.roleFitProbability || 0) * 100);
    const domains: any[] = cs.domains || [];
    const allGaps: any[] = gap.gaps || [];
    const strengths: any[] = gap.strengths || [];
    const recommendations: any[] = (int_.interventions || []).slice(0, 6);

    const gapColor = (g: any) =>
      g.priority === 'critical' ? BRAND.red : g.priority === 'high' ? BRAND.orange : g.priority === 'medium' ? BRAND.accent : BRAND.green;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Assessment Results</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {cs.profile?.currentRole && `${cs.profile.currentRole} → ${cs.profile.targetRole} · ${cs.profile?.careerStage} stage`}
            </p>
          </div>
          <button onClick={() => { bumpAssessmentAttempt(userId); setAttemptRunId(n => n + 1); setResults(null); setView('landing'); setAnswers({}); setQIndex(0); setErrorMsg(''); autoSubmittedRef.current = false; }}
            className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
            <RefreshCw size={13} /> Retake
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Overall Score', value: `${overallScore}`, sub: '/ 100', color: overallScore >= 70 ? BRAND.green : overallScore >= 50 ? BRAND.accent : BRAND.orange, icon: <Gauge size={18} /> },
            { label: 'Percentile Rank', value: `${overallPct}`, sub: `th percentile`, color: BRAND.primary, icon: <Percent size={18} /> },
            { label: 'Role-Fit Probability', value: `${roleFitPct}%`, sub: rf.readinessLevel || '', color: '#8b5cf6', icon: <Trophy size={18} /> },
            { label: 'Competencies Mapped', value: `${cs.totalCompetencies || 0}`, sub: 'assessed', color: BRAND.accent, icon: <Brain size={18} /> },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span style={{ color: k.color }}>{k.icon}</span>
                <span className="text-[10px] text-gray-400">{k.sub}</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Coverage vs Confidence — honesty axes (T8, flag-gated; absent => not shown) */}
        {cs.reliability && (() => {
          const rel = cs.reliability;
          const cov = rel.coverage || {};
          const conf = rel.confidence || {};
          const confBandColor = conf.band === 'high' ? BRAND.green
            : conf.band === 'moderate' ? BRAND.accent
            : conf.band === 'low' ? BRAND.orange : '#9ca3af';
          return (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Brain size={14} style={{ color: BRAND.primary }} /> How to read this result
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Coverage */}
                <div className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">Coverage</span>
                    <span className="text-lg font-bold" style={{ color: BRAND.primary }}>{cov.coverage_pct ?? 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${cov.coverage_pct ?? 0}%`, backgroundColor: BRAND.primary }} />
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {cov.competencies_scored ?? 0}/{cov.total_competencies ?? 0} competencies ·
                    {' '}{cov.domains_covered ?? 0}/{cov.total_domains ?? 0} domains measured.
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">{cov.label}</p>
                </div>
                {/* Confidence */}
                <div className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">Confidence</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize"
                      style={{ backgroundColor: `${confBandColor}1a`, color: confBandColor }}>
                      {conf.band === 'unmeasured' ? 'unmeasured' : conf.band}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {conf.mean == null ? 'Not yet measured.' : `Mean response confidence ${Math.round((conf.mean ?? 0) * 100)}%.`}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">{conf.note}</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-3">
                Coverage and Confidence are separate: a high score over few competencies is broad-but-shallow,
                and a wide assessment can still carry low confidence. We report both honestly.
              </p>
            </div>
          );
        })()}

        {/* Domain scores */}
        {domains.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <PieChart size={14} style={{ color: BRAND.primary }} /> Competency Domain Scores
            </h3>
            <div className="space-y-3">
              {domains.map((d: any) => {
                const color = DOMAIN_COLORS[d.domainName] || BRAND.primary;
                const score = d.avgScore || 0;
                return (
                  <div key={d.domainCode}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-700 font-medium">{d.domainName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color }}>{score}</span>
                        <span className="text-[10px] text-gray-400">/ 100</span>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${score}%`, backgroundColor: color }} />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(d.competencies || []).slice(0, 4).map((c: any) => (
                        <span key={c.competencyCode} className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: `${color}12`, color }}>
                          {c.competencyName}: {c.finalScore}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Precise per-competency scores (Task #131) — onto ledger, flag-gated;
            absent / no precise scores => not shown (falls back to domain above). */}
        {results.precise?.hasPrecise && Array.isArray(results.precise?.precise) && results.precise.precise.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Target size={14} style={{ color: BRAND.primary }} /> Precise Competency Scores
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${BRAND.green}1a`, color: BRAND.green }}>Precise</span>
            </div>
            <p className="text-[11px] text-gray-500 mb-4">
              Measured directly per competency from your latest competency-tagged assessment — more
              granular than the domain-level scores above. Only measured competencies are shown.
            </p>
            <div className="space-y-3">
              {results.precise.precise.map((c: any) => {
                const score = typeof c.score === 'number' ? Math.round(c.score) : null;
                const color = score == null ? '#9ca3af' : score >= 70 ? BRAND.green : score >= 50 ? BRAND.accent : BRAND.orange;
                return (
                  <div key={c.code}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-700 font-medium">{c.name}</span>
                      <div className="flex items-center gap-2">
                        {c.levelLabel && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: `${color}12`, color }}>{c.levelLabel}</span>
                        )}
                        <span className="text-xs font-bold" style={{ color }}>{score == null ? '—' : score}</span>
                        <span className="text-[10px] text-gray-400">/ 100</span>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${score ?? 0}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {Array.isArray(results.precise?.notOnPreciseScale) && results.precise.notOnPreciseScale.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                <p className="text-[11px] font-medium text-amber-800">
                  {results.precise.notOnPreciseScale.length} of your competencies aren't on the precise scale yet
                </p>
                <p className="text-[10px] text-amber-700/90 mt-1 leading-relaxed">
                  These were measured in your broader assessment, but there isn't a genuine matching
                  competency in our genome yet, so we don't show a precise score rather than fabricate one:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {results.precise.notOnPreciseScale.map((c: any) => (
                    <span key={c.code}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-800">
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-3">
              Domain scores above are aggregate proxies; these are precise per-competency measurements.
              Where a competency hasn't been precisely measured, only the domain-level proxy is available.
            </p>
          </div>
        )}

        {/* Percentile breakdown + Role fit side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Percentile table */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <TrendingUp size={14} style={{ color: BRAND.primary }} /> Percentile Ranking
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {(perc.percentiles || []).slice(0, 12).map((p: any) => (
                <div key={p.competencyCode} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-gray-700 truncate">{p.competencyName}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${p.percentile}%`, backgroundColor: p.percentile >= 75 ? BRAND.green : p.percentile >= 50 ? BRAND.accent : BRAND.orange }} />
                    </div>
                    <span className="text-[10px] font-bold w-8 text-right" style={{ color: p.percentile >= 75 ? BRAND.green : p.percentile >= 50 ? BRAND.accent : BRAND.orange }}>
                      P{Math.round(p.percentile)}
                    </span>
                    <span className="text-[9px] text-gray-400 w-16 truncate">{p.percentileLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Role fit + transition */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Trophy size={14} style={{ color: '#8b5cf6' }} /> Role-Fit Analysis
            </h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="30" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle cx="40" cy="40" r="30" fill="none" stroke="#8b5cf6" strokeWidth="8"
                    strokeDasharray={`${(roleFitPct / 100) * 188.5} 188.5`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold" style={{ color: '#8b5cf6' }}>{roleFitPct}%</span>
                </div>
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">{rf.readinessLevel || 'Developing'}</div>
                <div className="text-xs text-gray-500">{rf.targetRole || ''}</div>
                {rf.transition?.readinessScore !== undefined && (
                  <div className="text-[10px] text-gray-400 mt-1">Transition readiness: {Math.round(rf.transition.readinessScore)}%</div>
                )}
              </div>
            </div>
            {rf.transition?.topGaps?.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Key Gaps for Transition</div>
                <div className="space-y-1.5">
                  {(rf.transition.topGaps || []).slice(0, 4).map((g: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: BRAND.orange }} />
                      <span className="flex-1 text-gray-700">{g.competencyName}</span>
                      <span className="text-gray-400">gap: {Math.round(g.gap || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Strengths + Gap analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Star size={14} style={{ color: BRAND.green }} /> Your Strengths
              </h3>
              <div className="space-y-2">
                {strengths.slice(0, 5).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle size={13} style={{ color: BRAND.green }} className="shrink-0" />
                    <span className="text-xs text-gray-700 flex-1">{s.competencyName}</span>
                    <span className="text-xs font-bold" style={{ color: BRAND.green }}>{s.finalScore || s.userScore}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gap analysis */}
          {allGaps.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <AlertCircle size={14} style={{ color: BRAND.orange }} /> Priority Gaps
              </h3>
              <div className="space-y-2">
                {allGaps.slice(0, 6).map((g: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 text-white"
                      style={{ backgroundColor: gapColor(g) }}>{g.priority}</span>
                    <span className="text-xs text-gray-700 flex-1 truncate">{g.competencyName}</span>
                    <span className="text-[10px]" style={{ color: gapColor(g) }}>−{Math.round(g.gap || 0)}</span>
                  </div>
                ))}
              </div>
              {gap.summary && (
                <div className="mt-3 pt-3 border-t border-gray-50 text-[10px] text-gray-400">
                  {gap.summary.criticalCount > 0 && <span className="mr-2 text-red-500">{gap.summary.criticalCount} critical</span>}
                  {gap.summary.highCount > 0 && <span className="mr-2 text-orange-500">{gap.summary.highCount} high</span>}
                  {gap.summary.mediumCount > 0 && <span className="text-yellow-600">{gap.summary.mediumCount} medium</span>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recommended interventions */}
        {recommendations.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BookMarked size={14} style={{ color: BRAND.primary }} /> Recommended Learning Interventions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recommendations.map((r: any, i: number) => {
                const type = r.type || r.interventionType || 'course';
                const typeColor = type === 'course' ? BRAND.primary : type === 'practice' ? BRAND.accent : BRAND.green;
                return (
                  <div key={i} className="flex gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold"
                      style={{ backgroundColor: typeColor }}>
                      {type === 'course' ? '📚' : type === 'practice' ? '🎯' : '🛠'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-800 truncate">{r.title}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{r.competency_name || r.competencyName}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: typeColor }}>
                          {type}
                        </span>
                        {(r.duration_weeks || r.durationWeeks) && (
                          <span className="text-[9px] text-gray-400">{r.duration_weeks || r.durationWeeks}w</span>
                        )}
                        {(r.gap_level || r.gapLevel) && (
                          <span className="text-[9px] text-gray-400 capitalize">{r.gap_level || r.gapLevel} priority</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => onTabChange('learning')}
              className="mt-4 w-full text-xs font-medium py-2.5 rounded-xl border border-dashed border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              <BookOpen size={13} /> Browse full Learning Hub
            </button>
          </div>
        )}

        {/* No results fallback */}
        {domains.length === 0 && allGaps.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
            <Brain size={28} className="mx-auto mb-2 text-gray-300" />
            <div className="text-sm text-gray-500 mb-4">Assessment submitted — scores are being computed.</div>
            <button onClick={loadExistingResults}
              className="text-xs font-medium px-4 py-2 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>
              <RefreshCw size={12} className="inline mr-1" /> Refresh Results
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CAREER INTELLIGENCE — Dashboard widgets
// ═══════════════════════════════════════════════════════════════════════════

/* Helper: persist + read target-role id */
function useTargetRole(profile: any): [string | null, (id: string | null) => void] {
  const [id, setId] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_TARGET_ROLE); } catch { return null; }
  });
  // Auto-pick top recommendation on first load if user hasn't chosen
  useEffect(() => {
    if (id || !profile) return;
    const recs = recommendFutureRoles(profile, 1);
    if (recs.length) {
      setId(recs[0].role.id);
      try { localStorage.setItem(LS_TARGET_ROLE, recs[0].role.id); } catch {}
    }
  }, [profile, id]);
  const update = (next: string | null) => {
    setId(next);
    try {
      if (next) localStorage.setItem(LS_TARGET_ROLE, next);
      else localStorage.removeItem(LS_TARGET_ROLE);
    } catch {}
  };
  return [id, update];
}

/* ──────────────── Future Role Spotlight ──────────────── */
function FutureRoleSpotlight({ profile, onTabChange }: { profile: any; onTabChange: (t: TabId) => void }) {
  const recs = useMemo(() => recommendFutureRoles(profile, 3), [profile]);
  const [targetId, setTargetId] = useTargetRole(profile);
  if (!recs.length) return null;
  const top = recs[0];
  const isTarget = targetId === top.role.id;
  const fmtSalary = (n: number) => n >= 10000000 ? `₹${(n/10000000).toFixed(1)} Cr` : `₹${(n/100000).toFixed(1)} L`;

  return (
    <div className="rounded-2xl p-5 border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}18`, color: BRAND.accent }}>
            <Activity size={14}/>
          </span>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Pragati's market prediction for you</h3>
            <p className="text-[11px] text-gray-500">Top 3 future roles ranked by demand × switchability × fit</p>
          </div>
        </div>
        <button onClick={() => onTabChange('future-map')}
          className="text-[11px] font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
          See all 40 roles <ArrowRight size={11}/>
        </button>
      </div>

      {/* Top role hero */}
      <div className="rounded-xl p-4 border" style={{ borderColor: `${BRAND.primary}25`, background: `${BRAND.primary}` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: BRAND.primary, color: '#fff' }}>#1 PICK</span>
              <span className="text-[10px] text-gray-500">{top.role.family}</span>
            </div>
            <h4 className="text-base font-bold text-gray-900">{top.role.title}</h4>
            <p className="text-[11px] text-gray-600 mt-0.5">
              Median salary {fmtSalary(top.role.salaryP50)} · Demand {top.role.demandScore}/100 · Growth +{top.role.growth36mo}% (3y)
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold" style={{ color: BRAND.primary }}>{top.fitment.fitScore}<span className="text-xs text-gray-400">%</span></div>
            <div className="text-[10px] text-gray-500">fit today</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-white rounded-lg p-2 border border-gray-100">
            <div className="text-[10px] text-gray-500">Switchability</div>
            <div className="text-sm font-bold" style={{ color: top.switch >= 60 ? BRAND.green : BRAND.primary }}>{top.switch}%</div>
          </div>
          <div className="bg-white rounded-lg p-2 border border-gray-100">
            <div className="text-[10px] text-gray-500">Hire probability</div>
            <div className="text-sm font-bold" style={{ color: top.fitment.hireProbability >= 50 ? BRAND.green : BRAND.primary }}>{top.fitment.hireProbability}%</div>
          </div>
          <div className="bg-white rounded-lg p-2 border border-gray-100">
            <div className="text-[10px] text-gray-500">Ready in</div>
            <div className="text-sm font-bold" style={{ color: BRAND.primary }}>~{top.etaMonths} mo</div>
          </div>
        </div>

        {top.fitment.topGapCompetency && (
          <div className="mt-3 text-[11px] text-gray-700 bg-white/60 rounded-lg px-2.5 py-1.5 border border-gray-100">
            <span className="font-semibold">Biggest gap:</span> {top.fitment.topGapCompetency.label} · close it to lift fit by ~{Math.round(top.fitment.topGapCompetency.gap * 8)}%.
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => { setTargetId(top.role.id); onTabChange('development'); }}
            disabled={isTarget && false}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            style={{ backgroundColor: BRAND.primary, color: '#fff' }}>
            {isTarget ? <><CheckCircle size={11}/> Target set · open IDP</> : <><Target size={11}/> Set as my goal</>}
          </button>
          <button onClick={() => onTabChange('future-map')}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
            <Eye size={11}/> Why this match?
          </button>
        </div>
      </div>

      {/* Runners-up */}
      {recs.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {recs.slice(1, 3).map(r => (
            <button key={r.role.id} onClick={() => onTabChange('future-map')}
              className="text-left p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-semibold text-gray-800">{r.role.title}</span>
                <span className="text-xs font-bold" style={{ color: BRAND.primary }}>{r.fitment.fitScore}%</span>
              </div>
              <div className="text-[10px] text-gray-500">{fmtSalary(r.role.salaryP50)} · switch {r.switch}% · ~{r.etaMonths} mo</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────── Competency Radar mini ──────────────── */
function CompetencyRadarMini({ profile, onTabChange }: { profile: any; onTabChange: (t: TabId) => void }) {
  const levels = useMemo(() => inferCompetencyLevels(profile), [profile]);
  // Pick 7 representative competencies for the radar
  const axes = ['programming','data-analysis','design-thinking','business-acumen','stakeholder-mgmt','project-mgmt','collaboration'] as const;
  const W = 200, H = 200, cx = W/2, cy = H/2, R = 75;
  const points = axes.map((id, i) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const lvl = Math.min(5, levels[id] ?? 0);
    const r = (lvl / 5) * R;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), id, level: lvl, angle };
  });
  const polyPts = points.map(p => `${p.x},${p.y}`).join(' ');
  const labels = axes.map((id, i) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const lr = R + 16;
    const c = COMPETENCY_DOMAINS.find(c => c.id === id);
    return { x: cx + lr * Math.cos(angle), y: cy + lr * Math.sin(angle), label: (c?.label ?? id).split(' ')[0] };
  });
  const maxLvl = Math.max(...Object.values(levels));

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Brain size={14} style={{ color: BRAND.primary }}/> Competency fingerprint
        </h3>
        <button onClick={() => onTabChange('assessment')} className="text-[11px] font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
          Full diagnosis <ArrowRight size={11}/>
        </button>
      </div>
      <p className="text-[11px] text-gray-500 mb-3">Inferred from your skills, experience and certifications.</p>
      <div className="flex items-center gap-4">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
          {[1,2,3,4,5].map(ring => (
            <polygon key={ring} fill="none" stroke="#e5e7eb" strokeWidth="0.7"
              points={axes.map((_, i) => {
                const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
                const r = (ring / 5) * R;
                return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
              }).join(' ')} />
          ))}
          {axes.map((_, i) => {
            const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
            return <line key={i} x1={cx} y1={cy} x2={cx + R*Math.cos(angle)} y2={cy + R*Math.sin(angle)} stroke="#e5e7eb" strokeWidth="0.7"/>;
          })}
          <polygon points={polyPts} fill={`${BRAND.accent}30`} stroke={BRAND.accent} strokeWidth="2"/>
          {points.map(p => <circle key={p.id} cx={p.x} cy={p.y} r="3" fill={BRAND.primary}/>)}
          {labels.map((l, i) => (
            <text key={i} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#6b7280" fontWeight="600">{l.label}</text>
          ))}
        </svg>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="text-[11px] text-gray-500">Strongest area</div>
          <div className="text-sm font-bold" style={{ color: BRAND.primary }}>
            {(() => {
              const top = Object.entries(levels).sort(([,a],[,b]) => b-a)[0];
              const c = COMPETENCY_DOMAINS.find(c => c.id === top?.[0]);
              return c ? `${c.label} (${top[1].toFixed(1)}/5)` : '—';
            })()}
          </div>
          <div className="text-[11px] text-gray-500 mt-2">Biggest gap</div>
          <div className="text-sm font-bold" style={{ color: BRAND.accent }}>
            {(() => {
              const bot = Object.entries(levels).filter(([,v]) => v < 1.5).sort(([,a],[,b]) => a-b)[0];
              const c = COMPETENCY_DOMAINS.find(c => c.id === bot?.[0]);
              return c ? c.label : maxLvl >= 3 ? 'None major' : 'Take assessment';
            })()}
          </div>
          <button onClick={() => onTabChange('assessment')}
            className="mt-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>
            Validate with assessment →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── Visibility Meter card ──────────────── */
function VisibilityMeterCard({ profile, eiScore, onTabChange }: { profile: any; eiScore: number; onTabChange: (t: TabId) => void }) {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_VISIBILITY) === '1'; } catch { return false; }
  });
  const v = useMemo(() => computeVisibility(profile, eiScore, isOpen), [profile, eiScore, isOpen]);
  const views = useMemo(() => estimateRecruiterViews(profile, eiScore, v.score), [profile, eiScore, v.score]);
  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    try { localStorage.setItem(LS_VISIBILITY, next ? '1' : '0'); } catch {}
  };
  const bandColor = v.band === 'top' ? BRAND.green : v.band === 'high' ? BRAND.green : v.band === 'medium' ? BRAND.primary : BRAND.accent;
  const bandLabel = { hidden: 'Hidden', low: 'Low', medium: 'Medium', high: 'High', top: 'Top tier' }[v.band];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Eye size={14} style={{ color: BRAND.primary }}/> Recruiter visibility
        </h3>
        <button onClick={() => onTabChange('visibility')} className="text-[11px] font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
          Full report <ArrowRight size={11}/>
        </button>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="32" stroke="#e5e7eb" strokeWidth="6" fill="none"/>
            <circle cx="40" cy="40" r="32" stroke={bandColor} strokeWidth="6" fill="none"
              strokeDasharray={`${(v.score/100)*201} 201`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.7s ease' }}/>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold" style={{ color: bandColor }}>{v.score}</span>
            <span className="text-[8px] text-gray-400 -mt-1">/100</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold mb-0.5" style={{ color: bandColor }}>{bandLabel}</div>
          <p className="text-[11px] text-gray-600 leading-snug mb-2">
            {isOpen ? `${views.thisWeek} recruiter view${views.thisWeek === 1 ? '' : 's'} this week` : 'You are hidden from employer search.'}
          </p>
          <button onClick={toggle}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5"
            style={{ backgroundColor: isOpen ? `${BRAND.green}15` : BRAND.primary, color: isOpen ? BRAND.green : '#fff' }}>
            {isOpen ? <><CheckCircle size={11}/> Open to opportunities</> : <><Activity size={11}/> Open me to recruiters</>}
          </button>
        </div>
      </div>

      {/* Top 2 tips */}
      <div className="space-y-1.5 mt-2">
        {v.drivers.filter(d => d.tip).slice(0, 2).map((d, i) => (
          <div key={i} className="flex items-center justify-between text-[11px] bg-gray-50 rounded-lg px-2.5 py-1.5">
            <span className="text-gray-700">{d.tip}</span>
            <span className="font-semibold" style={{ color: BRAND.accent }}>+{d.max - d.pts} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────── Top Job Matches card ──────────────── */
function TopJobMatchesCard({ profile, jobs, onTabChange }: { profile: any; jobs: JobApp[]; onTabChange: (t: TabId) => void }) {
  const ranked = useMemo(() => rankJobsForUser(profile, jobs).slice(0, 3), [profile, jobs]);
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>
            <Briefcase size={14}/>
          </span>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Best-fit roles for you</h3>
            <p className="text-[11px] text-gray-500">Live fitment from your tracked applications</p>
          </div>
        </div>
        <button onClick={() => onTabChange('jobs')} className="text-[11px] font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
          Open Job Tracker <ArrowRight size={11}/>
        </button>
      </div>
      {ranked.length === 0 ? (
        <div className="text-center py-6">
          <Briefcase size={20} className="mx-auto text-gray-300 mb-1.5"/>
          <p className="text-xs font-semibold text-gray-700">No applications tracked yet</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Add a job in Job Tracker to see fitment.</p>
          <button onClick={() => onTabChange('jobs')} className="mt-3 text-[11px] font-semibold px-3 py-1.5 rounded-lg" style={{ backgroundColor: BRAND.primary, color: '#fff' }}>Add first job →</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {ranked.map(r => {
            const fitColor = r.fitScore >= 75 ? BRAND.green : r.fitScore >= 55 ? BRAND.primary : BRAND.accent;
            return (
              <button key={r.job._id} onClick={() => onTabChange('jobs')}
                className="text-left p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-gray-800 truncate">{r.job.role || 'Untitled'}</span>
                  <span className="text-xs font-bold" style={{ color: fitColor }}>{r.fitScore}%</span>
                </div>
                <div className="text-[10px] text-gray-500 truncate">{r.job.company || '—'} · {r.job.status}</div>
                {r.fitment?.missingSkills.length ? (
                  <div className="text-[10px] mt-1.5" style={{ color: BRAND.accent }}>
                    Add <span className="font-semibold">{r.fitment.missingSkills[0]}</span> to lift fit
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FUTURE MAP TAB — full 40-role explorer with bubble chart + filters
// ═══════════════════════════════════════════════════════════════════════════
function FutureMapTab({ profile, onTabChange, behavior }: { profile: any; onTabChange: (t: TabId) => void; behavior?: BehaviorContext | null }) {
  const recs = useMemo(() => recommendFutureRoles(profile, 40, behavior ?? undefined), [profile, behavior]);
  const [, setTargetId] = useTargetRole(profile);
  const [familyFilter, setFamilyFilter] = useState<string>('all');
  const [sort, setSort] = useState<'score' | 'demand' | 'fit' | 'salary' | 'switch'>('score');
  const families = ['all', ...Array.from(new Set(MARKET_CATALOG.map(r => r.family)))];

  const filtered = recs.filter(r => familyFilter === 'all' || r.role.family === familyFilter)
    .sort((a, b) => {
      if (sort === 'score') return b.score - a.score;
      if (sort === 'demand') return b.role.demandScore - a.role.demandScore;
      if (sort === 'fit') return b.fitment.fitScore - a.fitment.fitScore;
      if (sort === 'salary') return b.role.salaryP50 - a.role.salaryP50;
      if (sort === 'switch') return b.switch - a.switch;
      return 0;
    });

  const fmtSalary = (n: number) => n >= 10000000 ? `₹${(n/10000000).toFixed(1)} Cr` : `₹${(n/100000).toFixed(1)} L`;
  const current = detectCurrentRole(profile);

  // Bubble chart: x = switchability, y = demand growth, size = salary, color = fit
  const W = 720, H = 320, padL = 50, padR = 20, padT = 20, padB = 36;
  const xScale = (v: number) => padL + (v / 100) * (W - padL - padR);
  const yScale = (v: number) => H - padB - (v / 100) * (H - padT - padB);
  const bubbleSize = (sal: number) => 6 + Math.min(20, Math.sqrt(sal / 500000));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Future Map</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {current ? <>You are currently a <strong>{current.title}</strong>. </> : null}
          Explore 40 future roles ranked for you.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-gray-500 mr-1">Family:</span>
        {families.map(f => (
          <button key={f} onClick={() => setFamilyFilter(f)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-lg capitalize ${familyFilter === f ? 'text-white' : 'text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
            style={familyFilter === f ? { backgroundColor: BRAND.primary } : {}}>{f}</button>
        ))}
        <span className="text-[11px] font-semibold text-gray-500 ml-2 mr-1">Sort:</span>
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}
          className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-700 bg-white">
          <option value="score">Recommended</option>
          <option value="fit">Best fit</option>
          <option value="demand">Most demand</option>
          <option value="salary">Highest salary</option>
          <option value="switch">Easiest switch</option>
        </select>
      </div>

      {/* Bubble chart */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800">Demand growth × Switchability</h3>
          <span className="text-[10px] text-gray-400">Bubble size = salary · color = fit</span>
        </div>
        <div className="overflow-x-auto">
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
            {[0,25,50,75,100].map(v => (
              <g key={v}>
                <line x1={padL} y1={yScale(v)} x2={W-padR} y2={yScale(v)} stroke="#f1f5f9"/>
                <text x={padL-6} y={yScale(v)+3} textAnchor="end" fontSize="9" fill="#94a3b8">{v}%</text>
              </g>
            ))}
            {[0,25,50,75,100].map(v => (
              <g key={v}>
                <line x1={xScale(v)} y1={padT} x2={xScale(v)} y2={H-padB} stroke="#f1f5f9"/>
                <text x={xScale(v)} y={H-padB+14} textAnchor="middle" fontSize="9" fill="#94a3b8">{v}</text>
              </g>
            ))}
            <text x={W/2} y={H-4} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">Switchability →</text>
            <text x={12} y={H/2} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600" transform={`rotate(-90 12 ${H/2})`}>Demand growth (3y) →</text>
            {filtered.map(r => {
              const fitColor = r.fitment.fitScore >= 75 ? BRAND.green : r.fitment.fitScore >= 55 ? BRAND.primary : r.fitment.fitScore >= 35 ? BRAND.accent : '#cbd5e1';
              return (
                <g key={r.role.id}>
                  <circle cx={xScale(r.switch)} cy={yScale(r.role.growth36mo)} r={bubbleSize(r.role.salaryP50)}
                    fill={fitColor} fillOpacity="0.55" stroke={fitColor} strokeWidth="1.5">
                    <title>{r.role.title} · fit {r.fitment.fitScore}% · switch {r.switch}% · {fmtSalary(r.role.salaryP50)}</title>
                  </circle>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Role list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(r => (
          <div key={r.role.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-gray-400">{r.role.family}</div>
                <h4 className="text-sm font-bold text-gray-900 truncate">{r.role.title}</h4>
                <p className="text-[11px] text-gray-500">{fmtSalary(r.role.salaryP50)} · demand {r.role.demandScore}/100 · +{r.role.growth36mo}% growth</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold" style={{ color: BRAND.primary }}>{r.fitment.fitScore}%</div>
                <div className="text-[9px] text-gray-400">fit</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[10px] mb-2">
              <div className="bg-gray-50 rounded px-2 py-1"><span className="text-gray-400">Switch </span><span className="font-bold text-gray-700">{r.switch}%</span></div>
              <div className="bg-gray-50 rounded px-2 py-1"><span className="text-gray-400">Hire prob </span><span className="font-bold text-gray-700">{r.fitment.hireProbability}%</span></div>
              <div className="bg-gray-50 rounded px-2 py-1"><span className="text-gray-400">ETA </span><span className="font-bold text-gray-700">~{r.etaMonths}mo</span></div>
            </div>
            {r.fitment.missingSkills.length > 0 && (
              <div className="text-[10px] text-gray-600 mb-2">
                <span className="text-gray-400">Top gaps: </span>
                {r.fitment.missingSkills.slice(0, 3).join(' · ')}
              </div>
            )}
            <div className="flex gap-1.5">
              <button onClick={() => { setTargetId(r.role.id); onTabChange('development'); }}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: BRAND.primary, color: '#fff' }}>
                Set as goal
              </button>
              <button onClick={() => onTabChange('jobs')}
                className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                See jobs
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVELOPMENT PLAN TAB — Target role + IDP with 7 interventions
// ═══════════════════════════════════════════════════════════════════════════
function DevelopmentPlanTab({ profile, onTabChange, behavior }: { profile: any; onTabChange: (t: TabId) => void; behavior?: BehaviorContext | null }) {
  const [targetId, setTargetId] = useTargetRole(profile);
  const [progress, setProgress] = useState<Record<string, 'in-progress' | 'done'>>(() => {
    try { return JSON.parse(localStorage.getItem(LS_IDP_PROGRESS) || '{}'); } catch { return {}; }
  });
  const persistProgress = (next: Record<string, 'in-progress' | 'done'>) => {
    setProgress(next);
    try { localStorage.setItem(LS_IDP_PROGRESS, JSON.stringify(next)); } catch {}
  };

  const target = targetId ? findRoleById(targetId) : undefined;
  const fitment = useMemo(() => target ? computeFitment(profile, target) : null, [profile, target]);
  const idp = useMemo(() => target ? buildIDP(profile, target, 7, behavior ?? undefined) : [], [profile, target, behavior]);
  const current = detectCurrentRole(profile);
  const sw = useMemo(() => target ? switchability(current?.id, target.id) : 0, [current, target]);

  const totalLift = idp.reduce((s, i) => s + i.eiLift, 0);
  const completedLift = idp.filter(i => progress[i.id] === 'done').reduce((s, i) => s + i.eiLift, 0);
  const liftPct = totalLift > 0 ? Math.round((completedLift / totalLift) * 100) : 0;
  const totalHours = idp.reduce((s, i) => s + i.hours, 0);
  const totalCost = idp.reduce((s, i) => s + i.cost, 0);
  const fmtSalary = (n: number) => n >= 10000000 ? `₹${(n/10000000).toFixed(1)} Cr` : `₹${(n/100000).toFixed(1)} L`;

  const toggle = (id: string) => {
    const cur = progress[id];
    const next = { ...progress };
    if (cur === 'done') delete next[id];
    else if (cur === 'in-progress') next[id] = 'done';
    else next[id] = 'in-progress';
    persistProgress(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Individual Development Plan</h1>
          <p className="text-xs text-gray-500 mt-0.5">Pragati's personalised roadmap to close your gaps for the role you want.</p>
        </div>
        <button onClick={() => onTabChange('future-map')} className="text-[11px] font-medium px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
          <Activity size={12}/> Change target role
        </button>
      </div>

      {/* Target role hero */}
      {target ? (
        <div className="rounded-2xl p-5 border shadow-sm" style={{ borderColor: `${BRAND.primary}25`, background: `${BRAND.primary}` }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: BRAND.primary }}>Target role</div>
              <h2 className="text-lg font-bold text-gray-900">{target.title}</h2>
              <p className="text-[11px] text-gray-600 mt-0.5">
                Median {fmtSalary(target.salaryP50)} · Demand {target.demandScore}/100 · Growth +{target.growth36mo}%
                {current ? ` · Coming from ${current.title}` : ''}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center shrink-0">
              <div className="bg-white rounded-lg p-2 border border-gray-100 min-w-[64px]">
                <div className="text-[9px] text-gray-500">Fit</div>
                <div className="text-sm font-bold" style={{ color: BRAND.primary }}>{fitment?.fitScore}%</div>
              </div>
              <div className="bg-white rounded-lg p-2 border border-gray-100">
                <div className="text-[9px] text-gray-500">Switch</div>
                <div className="text-sm font-bold" style={{ color: BRAND.primary }}>{sw}%</div>
              </div>
              <div className="bg-white rounded-lg p-2 border border-gray-100">
                <div className="text-[9px] text-gray-500">Hire</div>
                <div className="text-sm font-bold" style={{ color: fitment && fitment.hireProbability >= 50 ? BRAND.green : BRAND.primary }}>{fitment?.hireProbability}%</div>
              </div>
            </div>
          </div>

          {/* Plan progress */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
              <span>Plan progress · {liftPct}%</span>
              <span>+{completedLift}/{totalLift} EI banked · {totalHours}h · ~₹{(totalCost/1000).toFixed(1)}k</span>
            </div>
            <div className="h-1.5 rounded-full bg-white overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${liftPct}%`, background: `${BRAND.primary}` }}/>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-6 border border-gray-100 bg-white shadow-sm text-center">
          <Activity size={20} className="mx-auto mb-2" style={{ color: BRAND.primary }}/>
          <p className="text-sm font-semibold text-gray-800">Pick a target role first</p>
          <p className="text-[11px] text-gray-500 mt-0.5 mb-3">Open the Future Map to see your top recommendations.</p>
          <button onClick={() => onTabChange('future-map')} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ backgroundColor: BRAND.primary, color: '#fff' }}>
            Open Future Map →
          </button>
        </div>
      )}

      {/* Gap analysis */}
      {target && fitment && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Competency gap for {target.title}</h3>
          <div className="space-y-2">
            {target.competencies.map(rc => {
              const levels = inferCompetencyLevels(profile);
              const actual = levels[rc.id] ?? 0;
              const c = COMPETENCY_DOMAINS.find(c => c.id === rc.id);
              const pctActual = (actual / 5) * 100;
              const pctTarget = (rc.required / 5) * 100;
              const gap = Math.max(0, rc.required - actual);
              return (
                <div key={rc.id}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-gray-700 font-medium">{c?.label ?? rc.id}</span>
                    <span className="text-gray-500">
                      <span className="font-bold" style={{ color: gap > 0 ? BRAND.accent : BRAND.green }}>{actual.toFixed(1)}</span>
                      <span className="text-gray-400"> / {rc.required}</span>
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pctTarget}%`, backgroundColor: '#e5e7eb' }}/>
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pctActual}%`, backgroundColor: gap > 0 ? BRAND.accent : BRAND.green }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* IDP — interventions */}
      {target && idp.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <ClipboardList size={14} style={{ color: BRAND.primary }}/> Your 7-step plan
            </h3>
            <span className="text-[10px] text-gray-400">Click status to track</span>
          </div>
          <div className="space-y-2">
            {idp.map(item => {
              const meta = INTERVENTION_LABELS[item.type];
              const status = progress[item.id];
              return (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-all">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5" style={{ backgroundColor: BRAND.primary, color: '#fff' }}>{item.rank}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: `${BRAND.accent}18`, color: BRAND.accent }}>
                        {meta.emoji} {meta.label}
                      </span>
                      <span className="text-[10px] text-gray-400">closes {item.gapClosed.competencyLabel} gap</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-800">{item.title}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{item.description}</div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-1.5">
                      <span><Clock size={9} className="inline mr-0.5"/> {item.hours}h</span>
                      <span>· {item.provider}</span>
                      <span>· {item.cost === 0 ? 'Free' : `₹${item.cost.toLocaleString('en-IN')}`}</span>
                      <span className="font-semibold" style={{ color: BRAND.green }}>· +{item.eiLift} EI</span>
                    </div>
                  </div>
                  <button onClick={() => toggle(item.id)}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-lg shrink-0"
                    style={{
                      backgroundColor: status === 'done' ? `${BRAND.green}15` : status === 'in-progress' ? `${BRAND.primary}15` : '#f3f4f6',
                      color: status === 'done' ? BRAND.green : status === 'in-progress' ? BRAND.primary : '#6b7280',
                    }}>
                    {status === 'done' ? '✓ Done' : status === 'in-progress' ? '⋯ In progress' : 'Start'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VISIBILITY TAB — Full breakdown + employer-card preview
// ═══════════════════════════════════════════════════════════════════════════
function VisibilityTab({ profile, eiScore, onTabChange }: { profile: any; eiScore: number; onTabChange: (t: TabId) => void }) {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_VISIBILITY) === '1'; } catch { return false; }
  });
  const v = useMemo(() => computeVisibility(profile, eiScore, isOpen), [profile, eiScore, isOpen]);
  const views = useMemo(() => estimateRecruiterViews(profile, eiScore, v.score), [profile, eiScore, v.score]);
  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    try { localStorage.setItem(LS_VISIBILITY, next ? '1' : '0'); } catch {}
  };

  const bandColor = v.band === 'top' ? BRAND.green : v.band === 'high' ? BRAND.green : v.band === 'medium' ? BRAND.primary : BRAND.accent;
  const techCount = (profile?.skills?.technical ?? []).length;
  const expCount = (profile?.experience ?? []).length;
  const current = detectCurrentRole(profile);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Recruiter Visibility</h1>
        <p className="text-xs text-gray-500 mt-0.5">Control how employers discover and evaluate you on MetryxOne.</p>
      </div>

      {/* Open-to-opportunities banner */}
      <div className="rounded-2xl p-5 border shadow-sm flex items-center justify-between gap-4"
        style={{ borderColor: `${isOpen ? BRAND.green : BRAND.accent}40`, background: isOpen ? `${BRAND.green}06` : `${BRAND.accent}06` }}>
        <div>
          <div className="text-sm font-bold" style={{ color: isOpen ? BRAND.green : BRAND.primary }}>
            {isOpen ? 'You are visible to verified employers' : 'You are hidden from employer search'}
          </div>
          <p className="text-[11px] text-gray-600 mt-0.5">
            {isOpen
              ? 'Recruiters see an anonymized card first; your name and contact unlock only when you accept their interest.'
              : 'Toggle on to start appearing in recruiter search results matching your profile.'}
          </p>
        </div>
        <button onClick={toggle} className="text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shrink-0"
          style={{ backgroundColor: isOpen ? '#fff' : BRAND.primary, color: isOpen ? BRAND.green : '#fff', border: isOpen ? `1px solid ${BRAND.green}40` : 'none' }}>
          {isOpen ? <><CheckCircle size={12}/> Open</> : <>Open me to recruiters</>}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Score breakdown */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Visibility score</h3>
            <div className="text-right">
              <div className="text-2xl font-bold" style={{ color: bandColor }}>{v.score}<span className="text-xs text-gray-400">/100</span></div>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: bandColor }}>{v.band}</div>
            </div>
          </div>
          <div className="space-y-2">
            {v.drivers.map((d, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-gray-700">{d.label}</span>
                  <span className="text-gray-500"><span className="font-bold text-gray-700">{d.pts}</span>/{d.max}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(d.pts/d.max)*100}%`, backgroundColor: d.pts === d.max ? BRAND.green : BRAND.primary }}/>
                </div>
                {d.tip && <div className="text-[10px] mt-0.5" style={{ color: BRAND.accent }}>→ {d.tip}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Employer card preview */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">How recruiters see you</h3>
            <span className="text-[10px] text-gray-400">Anonymized preview</span>
          </div>
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: `${BRAND.primary}` }}>?</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">Candidate #{(profile?._id || 'XYZ').toString().slice(-4).toUpperCase()}</div>
                <div className="text-[11px] text-gray-500">{current?.title ?? 'Role hidden'} · {profile?.personal?.location ?? 'Location hidden'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold" style={{ color: BRAND.primary }}>EI {eiScore}</div>
                <div className="text-[9px] text-gray-400">Pragati-vetted</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="bg-gray-50 rounded-lg p-2"><div className="text-[9px] text-gray-500">Experience</div><div className="text-sm font-bold text-gray-800">{expCount} role{expCount===1?'':'s'}</div></div>
              <div className="bg-gray-50 rounded-lg p-2"><div className="text-[9px] text-gray-500">Skills</div><div className="text-sm font-bold text-gray-800">{techCount}</div></div>
              <div className="bg-gray-50 rounded-lg p-2"><div className="text-[9px] text-gray-500">Visibility</div><div className="text-sm font-bold" style={{ color: bandColor }}>{v.band}</div></div>
            </div>
            <div className="flex flex-wrap gap-1">
              {(profile?.skills?.technical ?? []).slice(0, 6).map((s: string, i: number) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-md" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>{s}</span>
              ))}
              {techCount === 0 && <span className="text-[10px] text-gray-400 italic">No skills listed</span>}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <div className="text-[11px] text-gray-500">
                <Eye size={10} className="inline mr-1"/>
                {isOpen ? `${views.thisWeek} view${views.thisWeek===1?'':'s'} this week` : 'Hidden from search'}
              </div>
              <button disabled className="text-[10px] font-semibold px-2.5 py-1 rounded-lg cursor-not-allowed opacity-60" style={{ backgroundColor: BRAND.primary, color: '#fff' }}>
                Request intro (recruiter view)
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 italic">
            Real name and contact are never shown to recruiters until you accept an intro request.
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Boost visibility fast</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={() => onTabChange('profile')} className="p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-left">
            <User size={14} style={{ color: BRAND.primary }}/>
            <div className="text-xs font-semibold text-gray-800 mt-1">Complete profile</div>
            <div className="text-[10px] text-gray-500">+20 pts max</div>
          </button>
          <button onClick={() => onTabChange('skills')} className="p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-left">
            <Code size={14} style={{ color: BRAND.primary }}/>
            <div className="text-xs font-semibold text-gray-800 mt-1">Add skills</div>
            <div className="text-[10px] text-gray-500">+15 pts max</div>
          </button>
          <button onClick={() => onTabChange('assessment')} className="p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-left">
            <Brain size={14} style={{ color: BRAND.primary }}/>
            <div className="text-xs font-semibold text-gray-800 mt-1">Take assessment</div>
            <div className="text-[10px] text-gray-500">+25 pts max</div>
          </button>
          <button onClick={() => onTabChange('development')} className="p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-left">
            <ClipboardList size={14} style={{ color: BRAND.primary }}/>
            <div className="text-xs font-semibold text-gray-800 mt-1">Work your IDP</div>
            <div className="text-[10px] text-gray-500">EI lifts visibility</div>
          </button>
        </div>
      </div>
    </div>
  );
}
