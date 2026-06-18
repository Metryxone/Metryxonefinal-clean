import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppTopBar } from '@/components/AppTopBar';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  BookOpen, Target, TrendingUp, Users, Bell, Calendar, Award,
  ArrowLeft, ChevronRight, CheckCircle, Circle, Clock, Star,
  AlertTriangle, PlusCircle, X, BarChart2, Brain, Zap,
  MapPin, Home, LogOut, Search, Lock, Unlock, UserCheck,
  Play, Layers, BarChart3, Activity, Shield, Trophy, Flame,
  MessageCircle, ChevronDown, ChevronUp, Eye, Filter, RefreshCw,
  GraduationCap, BookMarked, Lightbulb, Send
} from 'lucide-react';

// ── Auth helpers ─────────────────────────────────────────────────────────────
const authHeaders = () => {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};
const apiFetch = (url: string, opts: RequestInit = {}) =>
  fetch(url, { headers: authHeaders() as any, ...opts });
const getUser = () => {
  try { return JSON.parse(atob((localStorage.getItem('metryx_token') || '').split('.')[1])); } catch { return null; }
};

// ── Exam config ────────────────────────────────────────────────────────────
const EXAM_CONFIG: Record<string, {
  name: string; shortName: string; color: string; bg: string; border: string;
  subjects: string[]; maxMarks: number; description: string; icon: string;
}> = {
  JEE_MAIN:  { name: 'JEE Main',        shortName: 'JEE Main',  color: '#0B3C5D', bg: '#EBF4F8', border: '#0B3C5D', subjects: ['Physics','Chemistry','Mathematics'], maxMarks: 300, description: 'National engineering entrance for NITs & IIITs', icon: '⚛️' },
  JEE_ADV:   { name: 'JEE Advanced',    shortName: 'JEE Adv',   color: '#1a237e', bg: '#E8EAF6', border: '#1a237e', subjects: ['Physics','Chemistry','Mathematics'], maxMarks: 360, description: 'Gateway to IITs — India\'s premier engineering institutes', icon: '🏛️' },
  NEET:      { name: 'NEET UG',         shortName: 'NEET',      color: '#1b5e20', bg: '#E8F5E9', border: '#4ECDC4', subjects: ['Physics','Chemistry','Biology'],     maxMarks: 720, description: 'Medical entrance for MBBS & BDS admissions', icon: '🩺' },
  EAMCET_AP: { name: 'AP EAMCET',       shortName: 'AP EAMCET', color: '#e65100', bg: '#FFF3E0', border: '#e65100', subjects: ['Physics','Chemistry','Mathematics'], maxMarks: 160, description: 'AP state engineering & medical entrance', icon: '🔬' },
  EAMCET_TS: { name: 'TS EAMCET',       shortName: 'TS EAMCET', color: '#4a148c', bg: '#F3E5F5', border: '#4a148c', subjects: ['Physics','Chemistry','Mathematics'], maxMarks: 160, description: 'Telangana state engineering & medical entrance', icon: '🧪' },
  CAT:       { name: 'CAT',             shortName: 'CAT',       color: '#880e4f', bg: '#FCE4EC', border: '#880e4f', subjects: ['VARC','DILR','QA'],                  maxMarks: 198, description: 'MBA entrance for IIMs & top B-schools', icon: '📈' },
  CUET:      { name: 'CUET UG',         shortName: 'CUET',      color: '#37474f', bg: '#ECEFF1', border: '#37474f', subjects: ['English','General Test'],            maxMarks: 400, description: 'Central universities common entrance test', icon: '🎓' },
  GATE_CS:   { name: 'GATE (CS/IT)',    shortName: 'GATE CS',   color: '#bf360c', bg: '#FBE9E7', border: '#bf360c', subjects: ['Engineering Mathematics','Computer Science'], maxMarks: 100, description: 'Graduate engineering — PSUs & M.Tech admissions', icon: '💻' },
};

const PLATFORMS = ['Allen', 'FIITJEE', 'Aakash', 'Vedantu', 'PW (Physics Wallah)', 'Unacademy', 'Byju\'s', 'Official Sample', 'Self-Created'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: JSX.Element }> = {
  not_started: { label: 'Not Started', color: '#6b7280', bg: '#F3F4F6', icon: <Circle size={13} /> },
  in_progress: { label: 'In Progress', color: '#d97706', bg: '#FEF3C7', icon: <Play size={13} /> },
  done:        { label: 'Done',        color: '#059669', bg: '#ECFDF5', icon: <CheckCircle size={13} /> },
  revision:    { label: 'Revision',    color: '#7c3aed', bg: '#EDE9FE', icon: <RefreshCw size={13} /> },
};

const MENTOR_POOL = [
  { id: '1', name: 'Arjun Mehta',     avatar: 'AM', exams: ['JEE_MAIN','JEE_ADV'],       subject: 'Physics',       rating: 4.9, sessions: 342, badge: 'IIT Bombay Alumnus',   bio: 'AIR 47 JEE Adv 2019. Teaches classical mechanics, electrostatics & optics.' },
  { id: '2', name: 'Priya Sharma',    avatar: 'PS', exams: ['NEET'],                      subject: 'Biology',       rating: 4.8, sessions: 287, badge: 'AIIMS Graduate',        bio: 'NEET 2018 AIR 112. Specialises in Human Physiology & Genetics.' },
  { id: '3', name: 'Karthik Rajan',   avatar: 'KR', exams: ['CAT'],                       subject: 'DILR & QA',     rating: 4.7, sessions: 198, badge: 'IIM Ahmedabad MBA',    bio: 'CAT 99.8%ile. Expert in Data Interpretation, Logical Reasoning & Quant.' },
  { id: '4', name: 'Sneha Reddy',     avatar: 'SR', exams: ['EAMCET_AP','EAMCET_TS'],    subject: 'Mathematics',   rating: 4.8, sessions: 156, badge: 'JNTU Rank 1',          bio: 'AP EAMCET State Rank 3. Strongest in Trigonometry, Calculus & Coordinate Geometry.' },
  { id: '5', name: 'Rahul Gupta',     avatar: 'RG', exams: ['JEE_MAIN','CUET'],           subject: 'Chemistry',     rating: 4.6, sessions: 223, badge: 'NIT Warangal Alumnus', bio: 'Chemistry specialist — Organic, Inorganic & Physical. JEE Main 97%ile.' },
  { id: '6', name: 'Dr. Ananya Bose', avatar: 'AB', exams: ['NEET','CUET'],               subject: 'Chemistry',     rating: 4.9, sessions: 315, badge: 'NEET Expert Faculty',  bio: '15 yrs experience. NEET Chemistry — Coordination Compounds & Biomolecules.' },
  { id: '7', name: 'Vikram Singh',    avatar: 'VS', exams: ['GATE_CS'],                   subject: 'CS Core',       rating: 4.8, sessions: 178, badge: 'GATE CS AIR 23',       bio: 'GATE 2021 AIR 23. Algorithms, OS, DBMS & Computer Networks expert.' },
  { id: '8', name: 'Meera Pillai',    avatar: 'MP', exams: ['JEE_MAIN','JEE_ADV','NEET'],subject: 'Mathematics',   rating: 4.7, sessions: 401, badge: 'Senior Faculty 12yr',   bio: 'Covers full JEE/NEET Math & Physics. Integrated coaching specialist.' },
];

interface Profile { id: string; exam_type: string; target_year: number; exam_date: string | null; current_class: string; daily_study_hours: number; coaching_institute: string | null; city: string | null; }
interface Chapter { id: string; subject: string; chapter_name: string; status: string; confidence: number; weightage: number; notes: string | null; }
interface MockScore { id: string; test_name: string; test_date: string; total_marks: number; scored_marks: number; subject_scores: Record<string, number>; percentile: number | null; predicted_rank: number | null; platform: string; }
interface StudyGroup { id: string; name: string; exam_type: string; description: string | null; member_count: number; max_members: number; is_public: boolean; access_code: string; is_member: boolean; creator_name: string | null; }
interface Intervention { id: string; trigger_type: string; severity: string; title: string; message: string; action_label: string | null; action_url: string | null; is_acknowledged: boolean; }

// ── ONBOARDING ───────────────────────────────────────────────────────────────
function OnboardingWizard({ onComplete }: { onComplete: (profile: Profile) => void }) {
  const [step, setStep] = useState(1);
  const [examType, setExamType] = useState('');
  const [form, setForm] = useState({ currentClass: '12', targetYear: 2025, city: '', coachingInstitute: '', dailyStudyHours: 6 });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!examType) return;
    setSaving(true);
    try {
      const r = await apiFetch('/api/exam-portal/profile', {
        method: 'POST',
        body: JSON.stringify({ examType, ...form, targetColleges: [] })
      });
      const data = await r.json();
      if (data.success) onComplete(data.profile);
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: 760, width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#0B3C5D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={24} color="#fff" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0B3C5D' }}>Exam Intelligence Portal</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Powered by MetryxOne</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            {[1, 2, 3].map(s => (
              <React.Fragment key={s}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: step >= s ? '#0B3C5D' : '#e5e7eb', color: step >= s ? '#fff' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{s}</div>
                {s < 3 && <div style={{ width: 60, height: 2, background: step > s ? '#0B3C5D' : '#e5e7eb' }} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div>
            <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Which exam are you preparing for?</h2>
            <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: 24, fontSize: 14 }}>We'll personalise your portal — syllabus, benchmarks, mentors, and study plan — for your exam.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {Object.entries(EXAM_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => setExamType(key)} style={{
                  padding: '16px 18px', borderRadius: 12, border: `2px solid ${examType === key ? cfg.color : '#e5e7eb'}`,
                  background: examType === key ? cfg.bg : '#fff', cursor: 'pointer', textAlign: 'left',
                  transition: 'all .15s', boxShadow: examType === key ? `0 0 0 3px ${cfg.color}22` : 'none'
                }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{cfg.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: examType === key ? cfg.color : '#111827' }}>{cfg.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 1.4 }}>{cfg.description}</div>
                </button>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <button disabled={!examType} onClick={() => setStep(2)} style={{
                padding: '12px 36px', borderRadius: 8, background: examType ? '#0B3C5D' : '#d1d5db',
                color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: examType ? 'pointer' : 'default'
              }}>Continue →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,.08)', maxWidth: 520, margin: '0 auto' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Tell us about yourself</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>Helps us calibrate your peer benchmark and intervention alerts.</p>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Current Class / Status</label>
                <select value={form.currentClass} onChange={e => setForm(f => ({ ...f, currentClass: e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 14, outline: 'none' }}>
                  <option value="11">Class 11</option>
                  <option value="12">Class 12</option>
                  <option value="dropout">Dropper (Class 12 pass)</option>
                  <option value="graduate">Graduate</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Target Year</label>
                <select value={form.targetYear} onChange={e => setForm(f => ({ ...f, targetYear: +e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 14, outline: 'none' }}>
                  {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>City</label>
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Hyderabad" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Coaching Institute (optional)</label>
                <input value={form.coachingInstitute} onChange={e => setForm(f => ({ ...f, coachingInstitute: e.target.value }))} placeholder="e.g. Allen, FIITJEE, Self-study" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Daily Study Hours: <span style={{ color: '#0B3C5D', fontWeight: 700 }}>{form.dailyStudyHours}h</span></label>
                <input type="range" min={2} max={14} value={form.dailyStudyHours} onChange={e => setForm(f => ({ ...f, dailyStudyHours: +e.target.value }))} style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4 }}><span>2h</span><span>14h</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
              <button onClick={() => setStep(3)} style={{ flex: 2, padding: '11px', borderRadius: 8, background: '#0B3C5D', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Continue →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,.08)', maxWidth: 520, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 40 }}>{EXAM_CONFIG[examType]?.icon}</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginTop: 8 }}>Ready to launch your portal!</h2>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>We'll set up your personalised {EXAM_CONFIG[examType]?.name} portal with full syllabus tracker, peer benchmarks, and study plan.</p>
            </div>
            <div style={{ background: '#f8f9fa', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              {[
                { icon: '📚', label: 'Exam Track', value: EXAM_CONFIG[examType]?.name },
                { icon: '🎓', label: 'Class', value: form.currentClass === 'dropout' ? 'Dropper' : form.currentClass === 'graduate' ? 'Graduate' : `Class ${form.currentClass}` },
                { icon: '📅', label: 'Target Year', value: form.targetYear },
                { icon: '🏙️', label: 'City', value: form.city || '—' },
                { icon: '⏱️', label: 'Daily Study Hours', value: `${form.dailyStudyHours} hrs / day` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>← Back</button>
              <button onClick={handleSubmit} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 8, background: '#4ECDC4', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Setting up...' : '🚀 Launch My Portal'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DASHBOARD TAB ─────────────────────────────────────────────────────────────
function DashboardTab({ profile, stats, interventions, onAcknowledge }: { profile: Profile; stats: any; interventions: Intervention[]; onAcknowledge: (id: string) => void }) {
  const cfg = EXAM_CONFIG[profile.exam_type] || EXAM_CONFIG['JEE_MAIN'];
  const daysLeft = profile.exam_date ? Math.max(0, Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000)) : null;
  const readinessScore = stats ? Math.round(((stats.chaptersDone / Math.max(stats.chaptersTotal, 1)) * 0.6 + (stats.avgScore / 100) * 0.4) * 100) : 0;

  return (
    <div style={{ padding: 28 }}>
      {/* Welcome banner */}
      <div style={{ borderRadius: 16, padding: '24px 28px', marginBottom: 24, background: `${cfg.color}`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Your Exam Portal</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{cfg.icon} {cfg.name} Aspirant</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{cfg.description}</div>
        </div>
        {daysLeft !== null && (
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,.15)', borderRadius: 12, padding: '16px 24px' }}>
            <div style={{ fontSize: 36, fontWeight: 900 }}>{daysLeft}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>days to exam</div>
          </div>
        )}
      </div>

      {/* Active interventions */}
      {interventions.filter(i => !i.is_acknowledged).map(iv => (
        <div key={iv.id} style={{ borderRadius: 12, padding: '14px 18px', marginBottom: 12, background: iv.severity === 'critical' ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${iv.severity === 'critical' ? '#FECACA' : '#FDE68A'}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <AlertTriangle size={18} color={iv.severity === 'critical' ? '#DC2626' : '#D97706'} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: iv.severity === 'critical' ? '#DC2626' : '#B45309' }}>{iv.title}</div>
            <div style={{ fontSize: 12, color: '#4B5563', marginTop: 3 }}>{iv.message}</div>
          </div>
          <button onClick={() => onAcknowledge(iv.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2 }}><X size={16} /></button>
        </div>
      ))}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Readiness Score', value: `${readinessScore}%`, icon: <Brain size={20} color="#0B3C5D" />, bg: '#EBF4F8', color: '#0B3C5D', sub: 'Based on chapters + mock avg' },
          { label: 'Chapters Done', value: stats ? `${stats.chaptersDone}/${stats.chaptersTotal}` : '—', icon: <BookOpen size={20} color="#4ECDC4" />, bg: '#ECFDF5', color: '#4ECDC4', sub: 'Complete + Revision' },
          { label: 'Avg Mock Score', value: stats?.avgScore ? `${stats.avgScore}%` : 'No tests yet', icon: <BarChart2 size={20} color="#7c3aed" />, bg: '#EDE9FE', color: '#7c3aed', sub: stats?.mocksCount ? `Across ${stats.mocksCount} tests` : 'Log your first test' },
          { label: 'Study Hours / Day', value: `${profile.daily_study_hours}h`, icon: <Clock size={20} color="#d97706" />, bg: '#FEF3C7', color: '#d97706', sub: profile.coaching_institute || 'Self-study' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{card.icon}</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 2 }}>{card.label}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Chapter progress by status */}
      {stats?.chapByStatus && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Chapter Completion Overview</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_CONFIG).map(([key, scfg]) => {
              const count = stats.chapByStatus[key] || 0;
              const total = stats.chaptersTotal || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={key} style={{ flex: '1 1 120px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ color: scfg.color }}>{scfg.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{scfg.label}</span>
                    <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' }}>{count}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: '#F3F4F6', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: scfg.color, transition: 'width .4s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* My groups preview */}
      {stats?.myGroups?.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 14 }}>My Study Groups</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {stats.myGroups.slice(0, 3).map((g: any) => (
              <div key={g.id} style={{ background: '#F8F9FA', borderRadius: 10, padding: '10px 14px', border: '1px solid #E5E7EB', minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{g.name}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                  <Users size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{g.member_count} members
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── BENCHMARK TAB ─────────────────────────────────────────────────────────────
function BenchmarkTab({ profile, benchmark }: { profile: Profile; benchmark: any }) {
  const cfg = EXAM_CONFIG[profile.exam_type] || EXAM_CONFIG['JEE_MAIN'];
  const dist = benchmark?.distribution || [18, 28, 42, 60, 78];
  const userPct = benchmark?.userPercentile;
  const subjectAvg = benchmark?.subjectAvg || {};
  const userSubScores = benchmark?.userSubjectScores || {};
  const total = benchmark?.totalCandidates || 0;

  const barData = [
    { bracket: 'Bottom 10%', maxScore: dist[0], peerCount: Math.round(total * 0.1) },
    { bracket: '10–25%',     maxScore: dist[1], peerCount: Math.round(total * 0.15) },
    { bracket: '25–50%',     maxScore: dist[2], peerCount: Math.round(total * 0.25) },
    { bracket: '50–75%',     maxScore: dist[3], peerCount: Math.round(total * 0.25) },
    { bracket: '75–90%',     maxScore: dist[4], peerCount: Math.round(total * 0.15) },
    { bracket: 'Top 10%',    maxScore: 100,     peerCount: Math.round(total * 0.1) },
  ];

  return (
    <div style={{ padding: 28 }}>
      {/* Hero percentile card */}
      <div style={{ borderRadius: 16, padding: '28px 32px', marginBottom: 24, background: `#0B3C5D`, color: '#fff', textAlign: 'center' }}>
        {userPct !== null && userPct !== undefined ? (
          <>
            <div style={{ fontSize: 13, opacity: 0.8 }}>Your current percentile</div>
            <div style={{ fontSize: 64, fontWeight: 900, margin: '8px 0' }}>{parseFloat(userPct).toFixed(1)}</div>
            <div style={{ fontSize: 16, opacity: 0.9 }}>percentile among {(total / 100000).toFixed(1)} lakh {cfg.name} aspirants</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Log your first mock test to see your percentile rank</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>We'll show where you stand among {(total / 100000).toFixed(1)} lakh {cfg.name} aspirants</div>
          </>
        )}
      </div>

      {/* Score distribution chart */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Score Distribution of All Aspirants</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>How scores are spread across all registered candidates</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="bracket" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [`${v.toLocaleString()} candidates`, 'Count']} />
            <Bar dataKey="peerCount" fill={cfg.color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Subject comparison table */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Subject-wise Benchmark Comparison</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          {cfg.subjects.map(subj => {
            const avg = subjectAvg[subj] || 0;
            const top25 = Math.round(avg * 1.4);
            const top10 = Math.round(avg * 1.7);
            const mine = userSubScores[subj];
            return (
              <div key={subj}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{subj}</span>
                  {mine && <span style={{ fontSize: 12, color: cfg.color, fontWeight: 700, background: cfg.bg || '#EBF4F8', borderRadius: 6, padding: '2px 8px' }}>You: {mine}%</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Average', val: avg, color: '#9CA3AF' },
                    { label: 'Top 25%', val: top25, color: '#F59E0B' },
                    { label: 'Top 10%', val: top10, color: '#10B981' },
                    ...(mine ? [{ label: 'You', val: mine, color: cfg.color }] : []),
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: '#6B7280', width: 52, flexShrink: 0 }}>{item.label}</span>
                      <div style={{ flex: 1, height: 10, borderRadius: 5, background: '#F3F4F6', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(item.val, 100)}%`, borderRadius: 5, background: item.color, transition: 'width .5s' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: item.color, width: 38, textAlign: 'right' }}>{item.val}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {[
          { icon: '🎯', title: 'Target percentile for Top 10 colleges', value: `${dist[4]}%+`, desc: 'Score needed to be in the top 10th percentile bracket' },
          { icon: '📊', title: 'National average score', value: `${dist[2]}%`, desc: 'Median aspirant performance across India' },
          { icon: '🏆', title: 'Top-tier cut-off', value: `${dist[4]}%+`, desc: 'Minimum to secure a seat in premier institutes' },
        ].map(card => (
          <div key={card.title} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{card.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0B3C5D', marginBottom: 4 }}>{card.value}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{card.title}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4, lineHeight: 1.5 }}>{card.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GAP ANALYSIS TAB ──────────────────────────────────────────────────────────
function GapAnalysisTab({ chapters, profile }: { chapters: Chapter[]; profile: Profile }) {
  const cfg = EXAM_CONFIG[profile.exam_type] || EXAM_CONFIG['JEE_MAIN'];
  const [selectedSubj, setSelectedSubj] = useState('All');

  const gapScore = (ch: Chapter) => {
    const statusFactor = ch.status === 'not_started' ? 1 : ch.status === 'in_progress' ? 0.6 : ch.status === 'revision' ? 0.2 : 0;
    const confFactor = (5 - Math.min(ch.confidence, 5)) / 5;
    return Math.round(ch.weightage * (statusFactor * 0.7 + confFactor * 0.3));
  };

  const weakChapters = chapters
    .filter(c => c.status !== 'done' || c.confidence < 4)
    .map(c => ({ ...c, gap: gapScore(c) }))
    .sort((a, b) => b.gap - a.gap)
    .filter(c => selectedSubj === 'All' || c.subject === selectedSubj);

  const subjectSummary = cfg.subjects.map(subj => {
    const subChaps = chapters.filter(c => c.subject === subj);
    const done = subChaps.filter(c => c.status === 'done' || c.status === 'revision').length;
    const totalGap = subChaps.filter(c => c.status !== 'done').reduce((s, c) => s + gapScore(c), 0);
    return { subj, total: subChaps.length, done, pct: subChaps.length ? Math.round((done / subChaps.length) * 100) : 0, totalGap };
  });

  const subjects = ['All', ...cfg.subjects];

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Gap Analysis</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Chapters ranked by impact — highest weightage & lowest readiness first</div>
        </div>
      </div>

      {/* Subject health bars */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Subject Readiness Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {subjectSummary.map(s => (
            <div key={s.subj}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{s.subj}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: s.pct >= 70 ? '#059669' : s.pct >= 40 ? '#D97706' : '#DC2626' }}>{s.pct}%</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: '#F3F4F6', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${s.pct}%`, borderRadius: 5, background: s.pct >= 70 ? '#10B981' : s.pct >= 40 ? '#F59E0B' : '#EF4444', transition: 'width .5s' }} />
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{s.done}/{s.total} chapters done</div>
            </div>
          ))}
        </div>
      </div>

      {/* Priority list */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Priority Chapters ({weakChapters.length})</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {subjects.map(s => (
              <button key={s} onClick={() => setSelectedSubj(s)} style={{ padding: '5px 12px', borderRadius: 20, border: '1.5px solid', borderColor: selectedSubj === s ? cfg.color : '#E5E7EB', background: selectedSubj === s ? cfg.bg || '#EBF4F8' : '#fff', color: selectedSubj === s ? cfg.color : '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{s}</button>
            ))}
          </div>
        </div>

        {weakChapters.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6B7280' }}>
            <CheckCircle size={36} color="#10B981" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>No gaps detected!</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>All chapters in this subject are marked done with high confidence.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {weakChapters.slice(0, 20).map((ch, i) => {
              const gapPct = Math.min(ch.gap * 8, 100);
              return (
                <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, background: i < 3 ? '#FEF2F2' : '#F9FAFB', border: `1px solid ${i < 3 ? '#FECACA' : '#E5E7EB'}` }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: i < 3 ? '#EF4444' : i < 8 ? '#F59E0B' : '#9CA3AF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{ch.chapter_name}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>{ch.subject} · {ch.weightage}% weightage</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ ...STATUS_CONFIG[ch.status], fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, display: 'inline-block', background: STATUS_CONFIG[ch.status]?.bg, color: STATUS_CONFIG[ch.status]?.color }}>
                      {STATUS_CONFIG[ch.status]?.label}
                    </span>
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 5, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${gapPct}%`, background: i < 3 ? '#EF4444' : '#F59E0B', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>Priority: {ch.gap}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── STUDY PLAN TAB ────────────────────────────────────────────────────────────
function StudyPlanTab({ chapters, profile, onUpdate }: { chapters: Chapter[]; profile: Profile; onUpdate: (id: string, data: any) => void }) {
  const cfg = EXAM_CONFIG[profile.exam_type] || EXAM_CONFIG['JEE_MAIN'];
  const [activeSubj, setActiveSubj] = useState(cfg.subjects[0] || '');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredChaps = chapters.filter(c =>
    c.subject === activeSubj && (filterStatus === 'all' || c.status === filterStatus)
  );
  const subjChaps = chapters.filter(c => c.subject === activeSubj);
  const subjDone = subjChaps.filter(c => c.status === 'done' || c.status === 'revision').length;

  return (
    <div style={{ padding: 28 }}>
      {/* Subject tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {cfg.subjects.map(s => {
          const sDone = chapters.filter(c => c.subject === s && (c.status === 'done' || c.status === 'revision')).length;
          const sTotal = chapters.filter(c => c.subject === s).length;
          const sPct = sTotal ? Math.round((sDone / sTotal) * 100) : 0;
          return (
            <button key={s} onClick={() => setActiveSubj(s)} style={{
              padding: '10px 18px', borderRadius: 10, border: '2px solid', flexShrink: 0,
              borderColor: activeSubj === s ? cfg.color : '#E5E7EB',
              background: activeSubj === s ? cfg.bg || '#EBF4F8' : '#fff',
              cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: activeSubj === s ? cfg.color : '#374151' }}>{s}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sDone}/{sTotal} · {sPct}%</div>
              <div style={{ height: 4, borderRadius: 2, background: '#E5E7EB', marginTop: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${sPct}%`, background: cfg.color, borderRadius: 2, transition: 'width .3s' }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Filter:</span>
        {['all', 'not_started', 'in_progress', 'done', 'revision'].map(f => (
          <button key={f} onClick={() => setFilterStatus(f)} style={{ padding: '4px 12px', borderRadius: 20, border: '1.5px solid', borderColor: filterStatus === f ? '#0B3C5D' : '#E5E7EB', background: filterStatus === f ? '#EBF4F8' : '#fff', color: filterStatus === f ? '#0B3C5D' : '#6B7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9CA3AF' }}>{filteredChaps.length} chapters</span>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 10, borderRadius: 5, background: '#F3F4F6', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${subjChaps.length ? Math.round((subjDone / subjChaps.length) * 100) : 0}%`, background: '#4ECDC4', borderRadius: 5, transition: 'width .5s' }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#4ECDC4', flexShrink: 0 }}>{subjChaps.length ? Math.round((subjDone / subjChaps.length) * 100) : 0}% complete</span>
      </div>

      {/* Chapter list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredChaps.map(ch => (
          <div key={ch.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 8px rgba(0,0,0,.05)', overflow: 'hidden' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
              onClick={() => setExpandedId(expandedId === ch.id ? null : ch.id)}
            >
              <div style={{ color: STATUS_CONFIG[ch.status]?.color || '#9CA3AF', flexShrink: 0 }}>
                {STATUS_CONFIG[ch.status]?.icon || <Circle size={16} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{ch.chapter_name}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{ch.weightage}% weightage</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1,2,3,4,5].map(s => <Star key={s} size={12} fill={s <= ch.confidence ? '#F59E0B' : 'none'} color={s <= ch.confidence ? '#F59E0B' : '#D1D5DB'} />)}
              </div>
              <div style={{ color: '#9CA3AF' }}>{expandedId === ch.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
            </div>
            {expandedId === ch.id && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Update status:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {Object.entries(STATUS_CONFIG).map(([key, scfg]) => (
                    <button key={key} onClick={() => onUpdate(ch.id, { status: key })} style={{
                      padding: '5px 12px', borderRadius: 20, border: '1.5px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
                      borderColor: ch.status === key ? scfg.color : '#E5E7EB',
                      background: ch.status === key ? scfg.bg : '#fff', color: ch.status === key ? scfg.color : '#6B7280',
                    }}>{scfg.icon}{scfg.label}</button>
                  ))}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Confidence ({ch.confidence}/5):</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => onUpdate(ch.id, { confidence: s })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                      <Star size={20} fill={s <= ch.confidence ? '#F59E0B' : 'none'} color={s <= ch.confidence ? '#F59E0B' : '#D1D5DB'} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {filteredChaps.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
            <BookOpen size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div>No chapters match this filter.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MOCK TESTS TAB ────────────────────────────────────────────────────────────
function MockTestsTab({ profile, mocks, onAdd, onDelete }: { profile: Profile; mocks: MockScore[]; onAdd: (data: any) => void; onDelete: (id: string) => void }) {
  const cfg = EXAM_CONFIG[profile.exam_type] || EXAM_CONFIG['JEE_MAIN'];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ testName: '', testDate: new Date().toISOString().split('T')[0], totalMarks: cfg.maxMarks, scoredMarks: '', platform: 'Self-Created', notes: '', subjectScores: {} });

  const chartData = [...mocks].reverse().slice(-10).map((m, i) => ({
    name: `#${i + 1}`, score: Math.round((m.scored_marks / m.total_marks) * 100), percentile: m.percentile ? parseFloat(m.percentile as any) : null
  }));
  const subjectAvgData = cfg.subjects.map(s => {
    const relevant = mocks.filter(m => m.subject_scores?.[s] !== undefined);
    const avg = relevant.length ? Math.round(relevant.reduce((sum, m) => sum + (m.subject_scores[s] || 0), 0) / relevant.length) : 0;
    return { subject: s.slice(0, 8), avg };
  });

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Mock Test Tracker</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{mocks.length} tests logged · {cfg.maxMarks} max marks</div>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: '#0B3C5D', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <PlusCircle size={16} />Log Test
        </button>
      </div>

      {/* Log test modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>Log Mock Test</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#6B7280" /></button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {[
                { key: 'testName', label: 'Test Name', type: 'text', placeholder: 'e.g. Allen DLP Test 3' },
                { key: 'testDate', label: 'Test Date', type: 'date' },
                { key: 'totalMarks', label: 'Total Marks', type: 'number', placeholder: `${cfg.maxMarks}` },
                { key: 'scoredMarks', label: 'Marks Scored', type: 'number', placeholder: '0' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{field.label}</label>
                  <input type={field.type} value={form[field.key]} onChange={e => setForm((f: any) => ({ ...f, [field.key]: field.type === 'number' ? +e.target.value : e.target.value }))} placeholder={field.placeholder} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #D1D5DB', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Platform</label>
                <select value={form.platform} onChange={e => setForm((f: any) => ({ ...f, platform: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #D1D5DB', fontSize: 14, outline: 'none' }}>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Subject-wise Scores (optional)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {cfg.subjects.map(s => (
                    <div key={s}>
                      <label style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, display: 'block' }}>{s}</label>
                      <input type="number" placeholder="Score %" value={form.subjectScores[s] || ''} onChange={e => setForm((f: any) => ({ ...f, subjectScores: { ...f.subjectScores, [s]: +e.target.value } }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1.5px solid #D1D5DB', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="What went well? What needs improvement?" rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #D1D5DB', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { onAdd(form); setShowForm(false); }} disabled={!form.testName || !form.scoredMarks} style={{ flex: 2, padding: '10px', borderRadius: 8, background: form.testName && form.scoredMarks ? '#0B3C5D' : '#D1D5DB', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: form.testName && form.scoredMarks ? 'pointer' : 'default' }}>Save Test</button>
            </div>
          </div>
        </div>
      )}

      {mocks.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '60px 40px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <BarChart3 size={48} color="#D1D5DB" style={{ margin: '0 auto 16px' }} />
          <div style={{ fontSize: 17, fontWeight: 700, color: '#374151', marginBottom: 8 }}>No tests logged yet</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>Log your first mock test to start tracking progress and see your predicted rank.</div>
          <button onClick={() => setShowForm(true)} style={{ padding: '10px 24px', borderRadius: 8, background: '#0B3C5D', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Log First Test</button>
        </div>
      ) : (
        <>
          {/* Score trend chart */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Score Trend (last {chartData.length} tests)</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Score']} />
                <Line type="monotone" dataKey="score" stroke={cfg.color} strokeWidth={2.5} dot={{ r: 4, fill: cfg.color }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Subject avg */}
          {subjectAvgData.some(s => s.avg > 0) && (
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Subject-wise Average Score</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={subjectAvgData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Avg Score']} />
                  <Bar dataKey="avg" fill="#4ECDC4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Test history */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Test History</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mocks.map(m => {
                const pct = Math.round((m.scored_marks / m.total_marks) * 100);
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: pct >= 70 ? '#ECFDF5' : pct >= 45 ? '#FEF3C7' : '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: pct >= 70 ? '#059669' : pct >= 45 ? '#D97706' : '#DC2626' }}>{pct}%</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.test_name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{m.platform} · {new Date(m.test_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{m.scored_marks}/{m.total_marks}</div>
                      {m.predicted_rank && <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 2 }}>Rank ~{m.predicted_rank.toLocaleString()}</div>}
                    </div>
                    <button onClick={() => onDelete(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 4, flexShrink: 0 }}><X size={15} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── COLLAB HUB TAB ────────────────────────────────────────────────────────────
function CollabHubTab({ profile, groups, onCreateGroup, onJoinGroup, onLeaveGroup }: { profile: Profile; groups: StudyGroup[]; onCreateGroup: (data: any) => void; onJoinGroup: (id: string, code?: string) => void; onLeaveGroup: (id: string) => void }) {
  const cfg = EXAM_CONFIG[profile.exam_type] || EXAM_CONFIG['JEE_MAIN'];
  const [showCreate, setShowCreate] = useState(false);
  const [joinId, setJoinId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [form, setForm] = useState({ name: '', description: '', maxMembers: 20, isPublic: true });
  const myGroups = groups.filter(g => g.is_member);
  const otherGroups = groups.filter(g => !g.is_member);

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Collaboration Hub</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Study together with peers preparing for {cfg.name}</div>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: '#4ECDC4', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <PlusCircle size={16} />Create Group
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>Create Study Group</div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#6B7280" /></button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Group Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. JEE Mains 2025 Hyderabad" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #D1D5DB', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Description (optional)</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What will this group focus on?" rows={2} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #D1D5DB', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Max Members: {form.maxMembers}</label>
                <input type="range" min={5} max={50} value={form.maxMembers} onChange={e => setForm(f => ({ ...f, maxMembers: +e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="isPublic" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} style={{ width: 16, height: 16 }} />
                <label htmlFor="isPublic" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                  {form.isPublic ? <><Unlock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Public group (anyone can join)</> : <><Lock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Private group (access code required)</>}
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { onCreateGroup({ ...form, examType: profile.exam_type }); setShowCreate(false); }} disabled={!form.name} style={{ flex: 2, padding: '10px', borderRadius: 8, background: form.name ? '#4ECDC4' : '#D1D5DB', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: form.name ? 'pointer' : 'default' }}>Create Group</button>
            </div>
          </div>
        </div>
      )}

      {/* Join modal */}
      {joinId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Enter Access Code</div>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="e.g. ABC123" maxLength={10} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #D1D5DB', fontSize: 16, letterSpacing: 4, textAlign: 'center', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => { setJoinId(null); setJoinCode(''); }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { onJoinGroup(joinId, joinCode); setJoinId(null); setJoinCode(''); }} style={{ flex: 2, padding: '10px', borderRadius: 8, background: '#0B3C5D', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Join</button>
            </div>
          </div>
        </div>
      )}

      {/* My groups */}
      {myGroups.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>My Groups ({myGroups.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {myGroups.map(g => (
              <div key={g.id} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,.06)', border: '2px solid #4ECDC422' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{g.name}</div>
                  <span style={{ fontSize: 10, background: '#ECFDF5', color: '#059669', borderRadius: 4, padding: '2px 6px', fontWeight: 700, flexShrink: 0 }}>MEMBER</span>
                </div>
                {g.description && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, lineHeight: 1.5 }}>{g.description}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={13} color="#9CA3AF" />
                  <span style={{ fontSize: 12, color: '#6B7280' }}>{g.member_count}/{g.max_members}</span>
                  {!g.is_public && <><Lock size={12} color="#9CA3AF" /><span style={{ fontSize: 12, color: '#9CA3AF' }}>Private</span></>}
                  <button onClick={() => onLeaveGroup(g.id)} style={{ marginLeft: 'auto', fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Leave</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Browse groups */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Browse Groups for {cfg.name} ({otherGroups.length})</div>
        {otherGroups.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: '40px 20px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,.06)', color: '#9CA3AF' }}>
            <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>No other groups yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Be the first to create a study group!</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {otherGroups.map(g => (
              <div key={g.id} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{g.name}</div>
                {g.description && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, lineHeight: 1.5 }}>{g.description}</div>}
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>Created by {g.creator_name || 'Anonymous'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={13} color="#9CA3AF" />
                  <span style={{ fontSize: 12, color: '#6B7280' }}>{g.member_count}/{g.max_members}</span>
                  {!g.is_public && <><Lock size={12} color="#9CA3AF" /></>}
                  <button
                    onClick={() => g.is_public ? onJoinGroup(g.id) : setJoinId(g.id)}
                    disabled={g.member_count >= g.max_members}
                    style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 8, background: g.member_count >= g.max_members ? '#D1D5DB' : '#0B3C5D', color: '#fff', border: 'none', cursor: g.member_count >= g.max_members ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    {g.member_count >= g.max_members ? 'Full' : g.is_public ? 'Join' : 'Request'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MENTORS TAB ───────────────────────────────────────────────────────────────
function MentorsTab({ profile }: { profile: Profile }) {
  const [filterSubj, setFilterSubj] = useState('All');
  const cfg = EXAM_CONFIG[profile.exam_type] || EXAM_CONFIG['JEE_MAIN'];
  const relevantMentors = MENTOR_POOL.filter(m => m.exams.includes(profile.exam_type));
  const subjects = ['All', ...cfg.subjects];
  const filtered = filterSubj === 'All' ? relevantMentors : relevantMentors.filter(m => m.subject.includes(filterSubj) || filterSubj.includes(m.subject.split(' ')[0]));

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Mentor Connect</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Top-ranked alumni & subject experts for {cfg.name}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {subjects.map(s => (
          <button key={s} onClick={() => setFilterSubj(s)} style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid', borderColor: filterSubj === s ? cfg.color : '#E5E7EB', background: filterSubj === s ? cfg.bg || '#EBF4F8' : '#fff', color: filterSubj === s ? cfg.color : '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{s}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF' }}>
          <UserCheck size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <div>No mentors found for this subject. Try another filter.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(m => (
            <div key={m.id} style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 16px rgba(0,0,0,.07)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `#4ECDC4`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{m.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{m.name}</div>
                  <div style={{ fontSize: 11, background: '#EBF4F8', color: '#0B3C5D', borderRadius: 4, padding: '2px 7px', display: 'inline-block', marginTop: 4, fontWeight: 600 }}>{m.badge}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.6, marginBottom: 14 }}>{m.bio}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Star size={13} fill="#F59E0B" color="#F59E0B" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{m.rating}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MessageCircle size={13} color="#9CA3AF" />
                  <span style={{ fontSize: 12, color: '#6B7280' }}>{m.sessions} sessions</span>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>{m.subject}</div>
              </div>
              <button style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#0B3C5D', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Book 1:1 Session →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── EXAM CALENDAR TAB ─────────────────────────────────────────────────────────
function ExamCalendarTab({ profile, events }: { profile: Profile; events: any[] }) {
  const cfg = EXAM_CONFIG[profile.exam_type] || EXAM_CONFIG['JEE_MAIN'];
  const today = new Date();
  const nextEvent = events.find(e => new Date(e.date) >= today && e.status !== 'done');

  const daysUntil = (dateStr: string) => {
    const d = new Date(dateStr);
    const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return `${Math.abs(diff)}d ago`;
    if (diff === 0) return 'Today!';
    return `${diff}d`;
  };

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>Exam Calendar</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Key dates for {cfg.name} — 2025 cycle</div>
      </div>
      {nextEvent && (
        <div style={{ borderRadius: 14, padding: '18px 22px', marginBottom: 24, background: `${cfg.color}`, color: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Bell size={22} color="#fff" />
          <div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Next upcoming event</div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{nextEvent.event}</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>{new Date(nextEvent.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · {daysUntil(nextEvent.date)} away</div>
          </div>
        </div>
      )}
      <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {events.map((ev, i) => {
            const isPast = ev.status === 'done' || new Date(ev.date) < today;
            const isNext = ev === nextEvent;
            return (
              <div key={i} style={{ display: 'flex', gap: 18, position: 'relative' }}>
                {/* Timeline line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: isPast ? '#D1D5DB' : isNext ? '#4ECDC4' : cfg.color, border: `3px solid ${isPast ? '#E5E7EB' : isNext ? '#ECFDF5' : '#EBF4F8'}`, flexShrink: 0, zIndex: 1 }} />
                  {i < events.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 32, background: '#E5E7EB' }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: isNext ? 800 : 600, color: isPast ? '#9CA3AF' : '#111827', textDecoration: isPast ? 'line-through' : 'none' }}>{ev.event}</span>
                    {isNext && <span style={{ fontSize: 10, background: '#ECFDF5', color: '#059669', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>NEXT</span>}
                    {isPast && ev.status === 'done' && <span style={{ fontSize: 10, background: '#F3F4F6', color: '#9CA3AF', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>DONE</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <Calendar size={12} color="#9CA3AF" />
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>{new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isPast ? '#9CA3AF' : isNext ? '#059669' : cfg.color }}>{daysUntil(ev.date)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── MAIN PORTAL ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Dashboard',    icon: <Home size={16} /> },
  { id: 'benchmark', label: 'Benchmark',    icon: <TrendingUp size={16} /> },
  { id: 'gaps',      label: 'Gap Analysis', icon: <Target size={16} /> },
  { id: 'study',     label: 'Study Plan',   icon: <BookOpen size={16} /> },
  { id: 'mocks',     label: 'Mock Tests',   icon: <BarChart2 size={16} /> },
  { id: 'collab',    label: 'Collab Hub',   icon: <Users size={16} /> },
  { id: 'mentors',   label: 'Mentors',      icon: <UserCheck size={16} /> },
  { id: 'calendar',  label: 'Exam Calendar', icon: <Calendar size={16} /> },
];

export default function CompetitiveExamPortal({ onNavigate }: { onNavigate: (screen: string, params?: any) => void }) {
  const user = getUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [mocks, setMocks] = useState<MockScore[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load profile
  useEffect(() => {
    apiFetch('/api/exam-portal/profile').then(r => r.json()).then(data => {
      setProfile(data.profile);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Load data when profile available
  useEffect(() => {
    if (!profile) return;
    const pid = profile.id;
    const exam = profile.exam_type;
    Promise.all([
      apiFetch(`/api/exam-portal/dashboard/${pid}`).then(r => r.json()),
      apiFetch(`/api/exam-portal/chapters/${pid}`).then(r => r.json()),
      apiFetch(`/api/exam-portal/mocks/${pid}`).then(r => r.json()),
      apiFetch(`/api/exam-portal/groups?examType=${exam}`).then(r => r.json()),
      apiFetch('/api/exam-portal/interventions').then(r => r.json()),
      apiFetch(`/api/exam-portal/benchmark/${exam}`).then(r => r.json()),
      apiFetch(`/api/exam-portal/calendar/${exam}`).then(r => r.json()),
    ]).then(([dashData, chapData, mockData, grpData, ivData, bmData, calData]) => {
      if (dashData.success) setStats(dashData);
      if (chapData.success) setChapters(chapData.chapters);
      if (mockData.success) setMocks(mockData.mocks);
      if (grpData.success) setGroups(grpData.groups);
      if (ivData.success) setInterventions(ivData.interventions);
      if (bmData.success) setBenchmark(bmData.benchmark);
      if (calData.success) setCalendarEvents(calData.events);
    });
  }, [profile]);

  const handleAcknowledge = async (id: string) => {
    await apiFetch(`/api/exam-portal/interventions/${id}/acknowledge`, { method: 'PUT' });
    setInterventions(iv => iv.map(i => i.id === id ? { ...i, is_acknowledged: true } : i));
  };

  const handleChapterUpdate = async (id: string, data: any) => {
    const r = await apiFetch(`/api/exam-portal/chapters/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    const res = await r.json();
    if (res.success) {
      setChapters(chs => chs.map(c => c.id === id ? { ...c, ...res.chapter } : c));
    }
  };

  const handleAddMock = async (form: any) => {
    if (!profile) return;
    const r = await apiFetch('/api/exam-portal/mocks', { method: 'POST', body: JSON.stringify({ ...form, profileId: profile.id, examType: profile.exam_type }) });
    const res = await r.json();
    if (res.success) setMocks(m => [res.mock, ...m]);
  };

  const handleDeleteMock = async (id: string) => {
    await apiFetch(`/api/exam-portal/mocks/${id}`, { method: 'DELETE' });
    setMocks(m => m.filter(x => x.id !== id));
  };

  const handleCreateGroup = async (data: any) => {
    const r = await apiFetch('/api/exam-portal/groups', { method: 'POST', body: JSON.stringify(data) });
    const res = await r.json();
    if (res.success) setGroups(g => [{ ...res.group, is_member: true }, ...g]);
  };

  const handleJoinGroup = async (id: string, code?: string) => {
    const r = await apiFetch(`/api/exam-portal/groups/${id}/join`, { method: 'POST', body: JSON.stringify({ accessCode: code }) });
    const res = await r.json();
    if (res.success) setGroups(g => g.map(x => x.id === id ? { ...x, is_member: true, member_count: x.member_count + 1 } : x));
  };

  const handleLeaveGroup = async (id: string) => {
    await apiFetch(`/api/exam-portal/groups/${id}/leave`, { method: 'POST' });
    setGroups(g => g.map(x => x.id === id ? { ...x, is_member: false, member_count: Math.max(x.member_count - 1, 0) } : x));
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#0B3C5D', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><GraduationCap size={22} color="#fff" /></div>
          <div style={{ fontSize: 15, color: '#6B7280' }}>Loading your portal…</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <OnboardingWizard onComplete={p => setProfile(p)} />;
  }

  const cfg = EXAM_CONFIG[profile.exam_type] || EXAM_CONFIG['JEE_MAIN'];
  const unreadCount = interventions.filter(i => !i.is_acknowledged).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f5f7' }}>
      <AppTopBar
        title="Competitive Exam Portal"
        onSearch={() => window.dispatchEvent(new Event('metryx:open-search'))}
        onNavigate={onNavigate}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={{ width: sidebarOpen ? 220 : 60, flexShrink: 0, background: '#0B3C5D', display: 'flex', flexDirection: 'column', transition: 'width .2s', overflow: 'hidden' }}>
          {/* Exam badge */}
          <div style={{ padding: sidebarOpen ? '16px 18px' : '16px 10px', borderBottom: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', gap: 10, minHeight: 68, cursor: 'pointer' }} onClick={() => setSidebarOpen(o => !o)}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{cfg.icon}</div>
            {sidebarOpen && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfg.shortName}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)' }}>Exam Portal</div>
              </div>
            )}
          </div>
          {/* Nav tabs */}
          <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              const showBadge = tab.id === 'dashboard' && unreadCount > 0;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} title={tab.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: sidebarOpen ? '10px 14px' : '10px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', position: 'relative',
                  background: active ? 'rgba(255,255,255,.15)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,.6)',
                  transition: 'all .15s',
                }}>
                  <span style={{ flexShrink: 0 }}>{tab.icon}</span>
                  {sidebarOpen && <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>{tab.label}</span>}
                  {showBadge && <span style={{ position: 'absolute', top: 8, right: sidebarOpen ? 12 : 8, width: 16, height: 16, borderRadius: '50%', background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</span>}
                </button>
              );
            })}
          </nav>
          {/* Bottom: change exam */}
          <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
            <button onClick={() => setProfile(null)} title="Change Exam" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: sidebarOpen ? '10px 14px' : '10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,.5)', width: '100%' }}>
              <RefreshCw size={15} />
              {sidebarOpen && <span style={{ fontSize: 12 }}>Change Exam</span>}
            </button>
          </div>
        </aside>

        {/* Content area */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'dashboard' && <DashboardTab profile={profile} stats={stats} interventions={interventions} onAcknowledge={handleAcknowledge} />}
          {activeTab === 'benchmark' && <BenchmarkTab profile={profile} benchmark={benchmark} />}
          {activeTab === 'gaps'      && <GapAnalysisTab chapters={chapters} profile={profile} />}
          {activeTab === 'study'     && <StudyPlanTab chapters={chapters} profile={profile} onUpdate={handleChapterUpdate} />}
          {activeTab === 'mocks'     && <MockTestsTab profile={profile} mocks={mocks} onAdd={handleAddMock} onDelete={handleDeleteMock} />}
          {activeTab === 'collab'    && <CollabHubTab profile={profile} groups={groups} onCreateGroup={handleCreateGroup} onJoinGroup={handleJoinGroup} onLeaveGroup={handleLeaveGroup} />}
          {activeTab === 'mentors'   && <MentorsTab profile={profile} />}
          {activeTab === 'calendar'  && <ExamCalendarTab profile={profile} events={calendarEvents} />}
        </main>
      </div>
    </div>
  );
}
