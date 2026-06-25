import { BRAND } from '@/design-system/tokens';
import { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import type { Screen } from '../../App';
import {
  Brain, Target, BookOpen, Users, Star, Award, BarChart3, TrendingUp,
  CheckCircle, Clock, ChevronRight, Sparkles, Zap, Flame, Trophy,
  MapPin, Briefcase, ArrowRight, RefreshCw, GraduationCap, Lightbulb,
  BarChart2, Activity, Play, BookMarked, Compass, MessageSquare, Bell,
  PieChart, LogOut, AlertCircle, Heart, Rocket, Shield
} from 'lucide-react';



type Tab = 'dashboard' | 'competency' | 'explore' | 'goals' | 'mentors';

interface StudentCareerPageProps {
  onNavigate: (screen: Screen | string) => void;
}

const CAREER_CLUSTERS = [
  { name: 'Technology', icon: '💻', match: 88, roles: ['Software Engineer', 'Data Analyst', 'Product Manager'] },
  { name: 'Finance & Business', icon: '📊', match: 72, roles: ['Investment Analyst', 'Consultant', 'CFO'] },
  { name: 'Research & Science', icon: '🔬', match: 65, roles: ['Research Scientist', 'Data Scientist', 'Academic'] },
  { name: 'Creative & Design', icon: '🎨', match: 58, roles: ['UX Designer', 'Creative Director', 'Content Strategist'] },
];

const COMPETENCY_DOMAINS = [
  { name: 'Cognitive & Analytical', code: 'COG', score: 74, pct: 68, color: BRAND.primary },
  { name: 'Communication', code: 'COM', score: 61, pct: 55, color: BRAND.accent },
  { name: 'Leadership', code: 'LEA', score: 48, pct: 42, color: BRAND.purple },
  { name: 'Execution & Delivery', code: 'EXE', score: 69, pct: 63, color: BRAND.orange },
  { name: 'Adaptability', code: 'ADP', score: 82, pct: 77, color: BRAND.green },
  { name: 'Technical & Digital', code: 'TEC', score: 77, pct: 71, color: '#0ea5e9' },
  { name: 'Emotional Intelligence', code: 'EIQ', score: 55, pct: 50, color: '#ec4899' },
];

const UPCOMING_SESSIONS = [
  { mentor: 'Dr. Priya Nair', subject: 'Career Roadmap Planning', date: 'Today, 4:00 PM', mode: 'Online', avatar: '👩‍💼' },
  { mentor: 'Arjun Mehta', subject: 'Interview Skills Workshop', date: 'Apr 3, 5:30 PM', mode: 'Online', avatar: '👨‍💻' },
];

const MILESTONES = [
  { label: 'Complete competency assessment', done: true },
  { label: 'Build career profile', done: true },
  { label: 'Explore career clusters', done: false },
  { label: 'Connect with a mentor', done: false },
  { label: 'Apply to 5 internships', done: false },
];

const RECENT_ACHIEVEMENTS = [
  { title: 'Assessment Pioneer', desc: 'Completed first competency assessment', icon: '🧠', date: '2 days ago' },
  { title: 'Profile Builder', desc: 'Filled 80%+ of career profile', icon: '📝', date: '1 week ago' },
];

function ScoreRing({ score, size = 100, color = BRAND.primary }: { score: number; size?: number; color?: string }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

export default function StudentCareerPage({ onNavigate }: StudentCareerPageProps) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [user, setUser] = useState<any>(null);
  const overallScore = 68;
  const careerReadiness = 62;

  useEffect(() => {
    const raw = localStorage.getItem('metryx_user');
    if (raw) try { setUser(JSON.parse(raw)); } catch {}
  }, []);

  const name = user?.name || user?.username || 'Career Seeker';
  const firstName = name.split(' ')[0];

  const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={16} /> },
    { id: 'competency', label: 'Competency Map', icon: <Brain size={16} /> },
    { id: 'explore', label: 'Career Explorer', icon: <Compass size={16} /> },
    { id: 'goals', label: 'My Goals', icon: <Target size={16} /> },
    { id: 'mentors', label: 'Mentors', icon: <Users size={16} /> },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      <Navbar onNavigate={onNavigate} currentScreen="student-career-portal" />
      <div className="flex gap-0 max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-10 min-h-[calc(100vh-80px)]">

        {/* Sidebar */}
        <aside className="w-60 shrink-0 mr-6 space-y-1 pt-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: BRAND.primary }}>
                {firstName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-800 truncate">{firstName}</div>
                <div className="text-[10px] text-gray-400">Career Seeker</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${careerReadiness}%`, backgroundColor: BRAND.accent }} />
              </div>
              <span className="text-[10px] font-bold" style={{ color: BRAND.accent }}>{careerReadiness}%</span>
            </div>
            <div className="text-[9px] text-gray-400 mt-0.5">Career Readiness</div>
          </div>

          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${tab === n.id ? 'text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:shadow-sm'}`}
              style={tab === n.id ? { backgroundColor: BRAND.primary } : {}}>
              {n.icon} {n.label}
            </button>
          ))}

          <div className="pt-3 mt-3 border-t border-gray-100 space-y-1">
            <button onClick={() => onNavigate('career-builder')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-white hover:text-gray-700 transition-all">
              <Briefcase size={14} /> Career Builder
            </button>
            <button onClick={() => onNavigate('mentor-marketplace')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-white hover:text-gray-700 transition-all">
              <Users size={14} /> Find Mentors
            </button>
            <button onClick={() => onNavigate('student-dashboard')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-white hover:text-gray-700 transition-all">
              <LogOut size={14} /> Exit Portal
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 pt-4 space-y-5">

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName} 👋</h1>
                <p className="text-xs text-gray-500 mt-0.5">Your career intelligence dashboard · Updated just now</p>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Career Readiness', val: `${careerReadiness}%`, color: BRAND.accent, icon: <Rocket size={16} />, sub: 'Developing' },
                  { label: 'Competency Score', val: `${overallScore}`, color: BRAND.primary, icon: <Brain size={16} />, sub: '/ 100' },
                  { label: 'Goals Completed', val: '2/5', color: BRAND.green, icon: <CheckCircle size={16} />, sub: 'On track' },
                  { label: 'Mentor Sessions', val: '3', color: BRAND.purple, icon: <Users size={16} />, sub: 'This month' },
                ].map(k => (
                  <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ color: k.color }}>{k.icon}</span>
                      <span className="text-[10px] text-gray-400">{k.sub}</span>
                    </div>
                    <div className="text-xl font-bold" style={{ color: k.color }}>{k.val}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Career readiness + milestones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-6">
                  <div className="relative shrink-0">
                    <ScoreRing score={careerReadiness} size={90} color={BRAND.accent} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold" style={{ color: BRAND.accent }}>{careerReadiness}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800 mb-1">Career Readiness™</div>
                    <div className="text-xs text-gray-500 mb-3 leading-relaxed">You're developing your career foundation. Complete your assessment and connect with mentors to boost your score.</div>
                    <button onClick={() => onNavigate('career-builder')}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                      style={{ backgroundColor: BRAND.primary }}>
                      <Zap size={12} /> Improve Score
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Trophy size={13} style={{ color: BRAND.orange }} /> Career Milestones
                  </h3>
                  <div className="space-y-2.5">
                    {MILESTONES.map((m, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        {m.done
                          ? <CheckCircle size={14} style={{ color: BRAND.green }} className="shrink-0" />
                          : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 shrink-0" />}
                        <span className={`text-xs ${m.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Competency preview + upcoming sessions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                      <Brain size={13} style={{ color: BRAND.primary }} /> Competency Overview
                    </h3>
                    <button onClick={() => setTab('competency')} className="text-[10px] font-medium flex items-center gap-1" style={{ color: BRAND.primary }}>
                      View all <ChevronRight size={11} />
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {COMPETENCY_DOMAINS.slice(0, 4).map(d => (
                      <div key={d.code}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-gray-600">{d.name}</span>
                          <span className="text-[10px] font-bold" style={{ color: d.color }}>{d.score}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${d.score}%`, backgroundColor: d.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setTab('competency')} className="mt-4 text-xs font-medium py-2 rounded-xl border border-dashed border-gray-200 w-full text-gray-400 hover:bg-gray-50">
                    Take full assessment →
                  </button>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Clock size={13} style={{ color: BRAND.accent }} /> Upcoming Sessions
                  </h3>
                  <div className="space-y-3">
                    {UPCOMING_SESSIONS.map((s, i) => (
                      <div key={i} className="p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">{s.avatar}</span>
                          <span className="text-xs font-medium text-gray-800 truncate">{s.mentor}</span>
                        </div>
                        <div className="text-[10px] text-gray-500">{s.subject}</div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>{s.date}</span>
                          <span className="text-[9px] text-gray-400">{s.mode}</span>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setTab('mentors')} className="text-xs font-medium text-center w-full py-1.5 rounded-xl border border-dashed border-gray-200 text-gray-400 hover:bg-gray-50">
                      Book a session →
                    </button>
                  </div>
                </div>
              </div>

              {/* Achievements */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Award size={13} style={{ color: BRAND.orange }} /> Recent Achievements
                </h3>
                <div className="flex gap-3 flex-wrap">
                  {RECENT_ACHIEVEMENTS.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 min-w-[200px]">
                      <span className="text-2xl">{a.icon}</span>
                      <div>
                        <div className="text-xs font-semibold text-gray-800">{a.title}</div>
                        <div className="text-[10px] text-gray-400">{a.desc}</div>
                        <div className="text-[9px] text-gray-300 mt-0.5">{a.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── COMPETENCY MAP ── */}
          {tab === 'competency' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Competency Map</h1>
                <p className="text-xs text-gray-500 mt-0.5">Your strengths and development areas across 7 competency domains</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Overall Score', val: overallScore, color: BRAND.primary },
                  { label: 'Top Domain', val: 'Adaptability', color: BRAND.green },
                  { label: 'Percentile', val: 'P62', color: BRAND.accent },
                  { label: 'Gaps Found', val: '3', color: BRAND.orange },
                ].map(k => (
                  <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
                    <div className="text-2xl font-bold mb-0.5" style={{ color: k.color }}>{k.val}</div>
                    <div className="text-[10px] text-gray-500">{k.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">All 7 Domains</h3>
                <div className="space-y-4">
                  {COMPETENCY_DOMAINS.map(d => (
                    <div key={d.code}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{d.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold" style={{ color: d.color }}>{d.score}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${d.color}15`, color: d.color }}>P{d.pct}</span>
                        </div>
                      </div>
                      <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${d.score}%`, backgroundColor: d.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2"><Star size={13} style={{ color: BRAND.green }} /> Strengths</h3>
                  {COMPETENCY_DOMAINS.filter(d => d.score >= 70).map(d => (
                    <div key={d.code} className="flex items-center gap-2 mb-2">
                      <CheckCircle size={13} style={{ color: BRAND.green }} />
                      <span className="text-xs text-gray-700">{d.name}</span>
                      <span className="ml-auto text-xs font-bold" style={{ color: BRAND.green }}>{d.score}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertCircle size={13} style={{ color: BRAND.orange }} /> Priority Gaps</h3>
                  {COMPETENCY_DOMAINS.filter(d => d.score < 65).map(d => (
                    <div key={d.code} className="flex items-center gap-2 mb-2">
                      <AlertCircle size={13} style={{ color: BRAND.orange }} />
                      <span className="text-xs text-gray-700">{d.name}</span>
                      <span className="ml-auto text-xs font-bold" style={{ color: BRAND.orange }}>{d.score}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => onNavigate('career-builder')}
                className="w-full text-xs font-semibold py-3 rounded-xl text-white shadow-sm" style={{ backgroundColor: BRAND.primary }}>
                Take Full Competency Assessment in Career Builder →
              </button>
            </div>
          )}

          {/* ── CAREER EXPLORER ── */}
          {tab === 'explore' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Career Explorer</h1>
                <p className="text-xs text-gray-500 mt-0.5">AI-matched career clusters based on your competency profile</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CAREER_CLUSTERS.map(c => (
                  <div key={c.name} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl">{c.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-800">{c.name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{c.roles.length} career roles matched</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold" style={{ color: c.match >= 80 ? BRAND.green : c.match >= 65 ? BRAND.accent : BRAND.orange }}>{c.match}%</div>
                        <div className="text-[9px] text-gray-400">match</div>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 mb-3 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.match}%`, backgroundColor: c.match >= 80 ? BRAND.green : c.match >= 65 ? BRAND.accent : BRAND.orange }} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.roles.map(r => (
                        <span key={r} className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">{r}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={15} style={{ color: BRAND.accent }} />
                  <h3 className="text-sm font-semibold text-gray-800">AI-Powered Career Recommendations</h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">Based on your current competency profile and interests, here are your top 3 recommended career paths:</p>
                {[
                  { role: 'Software Engineer', company: 'Technology', readiness: 88, gap: 'Strengthen LEA & COM domains' },
                  { role: 'Data Analyst', company: 'Analytics / Finance', readiness: 79, gap: 'Improve quantitative analysis score' },
                  { role: 'Product Manager', company: 'Technology / Consulting', readiness: 71, gap: 'Build stakeholder management skills' },
                ].map((r, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: BRAND.primary }}>{i + 1}</div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-800">{r.role}</div>
                      <div className="text-[10px] text-gray-400">{r.company} · {r.gap}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: r.readiness >= 80 ? BRAND.green : BRAND.accent }}>{r.readiness}%</div>
                      <div className="text-[9px] text-gray-400">ready</div>
                    </div>
                  </div>
                ))}
                <button onClick={() => onNavigate('competency-learning-paths')}
                  className="mt-2 w-full text-xs font-medium py-2.5 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>
                  Get Personalised Learning Plan →
                </button>
              </div>
            </div>
          )}

          {/* ── GOALS ── */}
          {tab === 'goals' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">My Career Goals</h1>
                <p className="text-xs text-gray-500 mt-0.5">Track your career development milestones</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[{ label: 'Total Goals', val: 5, color: BRAND.primary }, { label: 'Completed', val: 2, color: BRAND.green }, { label: 'In Progress', val: 3, color: BRAND.orange }].map(k => (
                  <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="space-y-3">
                  {MILESTONES.map((m, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${m.done ? 'border-teal-100 bg-teal-50' : 'border-gray-100'}`}>
                      {m.done
                        ? <CheckCircle size={16} style={{ color: BRAND.green }} />
                        : <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}
                      <span className={`text-xs flex-1 ${m.done ? 'line-through text-gray-400' : 'text-gray-700 font-medium'}`}>{m.label}</span>
                      {m.done && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-teal-700 bg-teal-100">Done</span>}
                    </div>
                  ))}
                </div>
                <button onClick={() => onNavigate('career-builder')}
                  className="mt-4 w-full text-xs font-medium py-2.5 rounded-xl border border-dashed border-gray-200 text-gray-400 hover:bg-gray-50">
                  Manage goals in Career Builder →
                </button>
              </div>
            </div>
          )}

          {/* ── MENTORS ── */}
          {tab === 'mentors' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">My Mentors</h1>
                <p className="text-xs text-gray-500 mt-0.5">Connect with experts who guide your career journey</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="text-center py-8">
                  <Users size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-sm text-gray-500 mb-4">Connect with industry mentors to get personalised guidance</p>
                  <button onClick={() => onNavigate('mentor-marketplace')}
                    className="text-xs font-semibold px-6 py-2.5 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>
                    Browse Mentor Marketplace
                  </button>
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2"><Clock size={13} style={{ color: BRAND.accent }} /> Upcoming Sessions</h3>
                <div className="space-y-3">
                  {UPCOMING_SESSIONS.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                      <span className="text-2xl">{s.avatar}</span>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-gray-800">{s.mentor}</div>
                        <div className="text-[10px] text-gray-400">{s.subject}</div>
                        <div className="text-[9px] text-gray-400 mt-0.5">{s.date} · {s.mode}</div>
                      </div>
                      <button className="text-[10px] px-2.5 py-1 rounded-lg font-medium text-white" style={{ backgroundColor: BRAND.accent }}>
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
