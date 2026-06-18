import { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import type { Screen } from '../../App';
import {
  Brain, Target, BookOpen, Users, Star, Award, BarChart3, TrendingUp,
  CheckCircle, Clock, ChevronRight, ChevronDown, Sparkles, Zap, Flame, Trophy,
  MapPin, Briefcase, ArrowRight, RefreshCw, GraduationCap, Lightbulb,
  Activity, Play, BookMarked, Compass, MessageSquare, Bell, PieChart, LogOut,
  AlertCircle, Heart, Rocket, Shield, User, FileText, Calendar, TrendingDown, Plus
} from 'lucide-react';

const BRAND = { primary: '#344E86', accent: '#4ECDC4', green: '#2A9D8F', orange: '#f4a261', red: '#e63946', purple: '#8b5cf6' };

type Tab = 'overview' | 'assessments' | 'career' | 'sessions' | 'reports';

interface ParentCareerPageProps {
  onNavigate: (screen: Screen | string) => void;
}

const CHILDREN = [
  { id: 'c1', name: 'Aanya Sharma', grade: 'Grade 10', readiness: 68, assessment: true, goals: 3, sessions: 4 },
  { id: 'c2', name: 'Rohan Sharma', grade: 'Grade 8', readiness: 42, assessment: false, goals: 1, sessions: 1 },
];

const COMPETENCY_DOMAINS = [
  { name: 'Cognitive & Analytical', score: 74, color: BRAND.primary, trend: 'up', change: '+5' },
  { name: 'Communication', score: 61, color: BRAND.accent, trend: 'up', change: '+3' },
  { name: 'Leadership', score: 48, color: BRAND.purple, trend: 'neutral', change: '0' },
  { name: 'Execution & Delivery', score: 69, color: BRAND.orange, trend: 'up', change: '+7' },
  { name: 'Adaptability & Growth', score: 82, color: BRAND.green, trend: 'up', change: '+2' },
  { name: 'Technical & Digital', score: 77, color: '#0ea5e9', trend: 'down', change: '-2' },
  { name: 'Emotional Intelligence', score: 55, color: '#ec4899', trend: 'up', change: '+4' },
];

const SESSIONS = [
  { mentor: 'Dr. Priya Nair', subject: 'Career Roadmap', child: 'Aanya Sharma', date: 'Apr 1', status: 'upcoming', rating: null },
  { mentor: 'Arjun Mehta', subject: 'Interview Skills', child: 'Aanya Sharma', date: 'Mar 28', status: 'completed', rating: 5 },
  { mentor: 'Sunita Verma', subject: 'Study Planning', child: 'Rohan Sharma', date: 'Mar 25', status: 'completed', rating: 4 },
];

const CAREER_PATHS = [
  { path: 'Software Engineering', readiness: 88, icon: '💻', priority: 'Top Match', color: BRAND.green },
  { path: 'Data Science', readiness: 79, icon: '📊', priority: 'Strong Fit', color: BRAND.accent },
  { path: 'Product Management', readiness: 71, icon: '🎯', priority: 'Good Fit', color: BRAND.primary },
];

function ScoreRing({ score, size = 80, color = BRAND.primary }: { score: number; size?: number; color?: string }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

export default function ParentCareerPage({ onNavigate }: ParentCareerPageProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedChild, setSelectedChild] = useState(CHILDREN[0]);
  const [showChildSelector, setShowChildSelector] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem('metryx_user');
    if (raw) try { setUser(JSON.parse(raw)); } catch {}
  }, []);

  const parentName = (user?.name || user?.username || 'Parent').split(' ')[0];

  const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
    { id: 'assessments', label: 'Assessments', icon: <Brain size={16} /> },
    { id: 'career', label: 'Career Path', icon: <Compass size={16} /> },
    { id: 'sessions', label: 'Mentor Sessions', icon: <Users size={16} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      <Navbar onNavigate={onNavigate} currentScreen="parent-career-portal" />
      <div className="flex gap-0 max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-10 min-h-[calc(100vh-80px)]">

        {/* Sidebar */}
        <aside className="w-60 shrink-0 mr-6 space-y-1 pt-4">
          {/* Child selector */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Viewing child</div>
            <button onClick={() => setShowChildSelector(s => !s)}
              className="w-full flex items-center justify-between gap-2 rounded-xl p-2 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: BRAND.accent }}>
                  {selectedChild.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-gray-800">{selectedChild.name}</div>
                  <div className="text-[9px] text-gray-400">{selectedChild.grade}</div>
                </div>
              </div>
              <ChevronDown size={12} className="text-gray-400" />
            </button>
            {showChildSelector && (
              <div className="mt-2 space-y-1">
                {CHILDREN.map(c => (
                  <button key={c.id} onClick={() => { setSelectedChild(c); setShowChildSelector(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${selectedChild.id === c.id ? 'font-semibold text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                    style={selectedChild.id === c.id ? { backgroundColor: BRAND.primary } : {}}>
                    {c.name} · {c.grade}
                  </button>
                ))}
                <button className="w-full text-left px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-gray-50 flex items-center gap-1">
                  <Plus size={11} /> Add Child
                </button>
              </div>
            )}
          </div>

          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${tab === n.id ? 'text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:shadow-sm'}`}
              style={tab === n.id ? { backgroundColor: BRAND.primary } : {}}>
              {n.icon} {n.label}
            </button>
          ))}

          <div className="pt-3 mt-3 border-t border-gray-100 space-y-1">
            <button onClick={() => onNavigate('unified-parent-dashboard')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-white hover:text-gray-700 transition-all">
              <LogOut size={14} /> Exit Portal
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 pt-4 space-y-5">

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Parent Career Intelligence</h1>
                <p className="text-xs text-gray-500 mt-0.5">Monitoring {selectedChild.name}'s career readiness journey</p>
              </div>

              {/* Child cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CHILDREN.map(c => (
                  <div key={c.id} onClick={() => setSelectedChild(c)}
                    className={`bg-white border rounded-2xl p-5 shadow-sm cursor-pointer transition-all ${selectedChild.id === c.id ? 'border-blue-200 ring-2 ring-blue-100' : 'border-gray-100 hover:border-gray-200'}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: selectedChild.id === c.id ? BRAND.primary : '#94a3b8' }}>
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-800">{c.name}</div>
                        <div className="text-[10px] text-gray-400">{c.grade}</div>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-lg font-bold" style={{ color: c.readiness >= 60 ? BRAND.green : BRAND.orange }}>{c.readiness}%</div>
                        <div className="text-[9px] text-gray-400">readiness</div>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-3">
                      <div className="h-full rounded-full" style={{ width: `${c.readiness}%`, backgroundColor: c.readiness >= 60 ? BRAND.green : BRAND.orange }} />
                    </div>
                    <div className="flex gap-3 text-[10px] text-gray-500">
                      <span className={`flex items-center gap-1 ${c.assessment ? 'text-teal-600' : 'text-orange-500'}`}>
                        {c.assessment ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                        Assessment {c.assessment ? 'done' : 'pending'}
                      </span>
                      <span className="flex items-center gap-1"><Target size={10} /> {c.goals} goals</span>
                      <span className="flex items-center gap-1"><Users size={10} /> {c.sessions} sessions</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Focused child stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Career Readiness', val: `${selectedChild.readiness}%`, color: selectedChild.readiness >= 60 ? BRAND.green : BRAND.orange, icon: <Rocket size={16} /> },
                  { label: 'Assessment Status', val: selectedChild.assessment ? 'Complete' : 'Pending', color: selectedChild.assessment ? BRAND.green : BRAND.orange, icon: <Brain size={16} /> },
                  { label: 'Active Goals', val: selectedChild.goals, color: BRAND.primary, icon: <Target size={16} /> },
                  { label: 'Mentor Sessions', val: selectedChild.sessions, color: BRAND.purple, icon: <Users size={16} /> },
                ].map(k => (
                  <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ color: k.color }}>{k.icon}</span>
                    </div>
                    <div className="text-xl font-bold" style={{ color: k.color }}>{k.val}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Competency snapshot */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Brain size={14} style={{ color: BRAND.primary }} /> {selectedChild.name}'s Competency Profile
                  </h3>
                  <button onClick={() => setTab('assessments')} className="text-[10px] font-medium" style={{ color: BRAND.primary }}>
                    View full report →
                  </button>
                </div>
                <div className="space-y-2.5">
                  {COMPETENCY_DOMAINS.map(d => (
                    <div key={d.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-gray-600">{d.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold" style={{ color: d.color }}>{d.score}</span>
                          <span className={`text-[9px] font-medium ${d.trend === 'up' ? 'text-teal-500' : d.trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
                            {d.trend === 'up' ? '↑' : d.trend === 'down' ? '↓' : '—'}{d.change}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${d.score}%`, backgroundColor: d.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guidance tips */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Lightbulb size={14} style={{ color: BRAND.accent }} /> Parent Guidance Tips
                </h3>
                {[
                  { tip: 'Encourage daily 30-min self-reflection journaling to improve EIQ scores', priority: 'High' },
                  { tip: 'Enroll in a public speaking club to develop COM domain', priority: 'Medium' },
                  { tip: 'Review completed career assessment results together this week', priority: 'High' },
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-2 mb-2 last:mb-0 p-2.5 rounded-xl" style={{ backgroundColor: `${BRAND.primary}06` }}>
                    <div className={`shrink-0 mt-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded text-white`} style={{ backgroundColor: t.priority === 'High' ? BRAND.orange : BRAND.accent }}>
                      {t.priority}
                    </div>
                    <span className="text-xs text-gray-700">{t.tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ASSESSMENTS ── */}
          {tab === 'assessments' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Assessment Results</h1>
                <p className="text-xs text-gray-500 mt-0.5">Detailed competency assessment report for {selectedChild.name}</p>
              </div>
              {!selectedChild.assessment ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
                  <Brain size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-sm font-medium text-gray-700 mb-2">{selectedChild.name} hasn't taken the assessment yet</p>
                  <p className="text-xs text-gray-400 mb-4">Share the Career Builder link with them to get started</p>
                  <button onClick={() => onNavigate('career-builder')}
                    className="text-xs font-semibold px-5 py-2.5 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>
                    Go to Career Builder
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {[{ label: 'Overall Score', val: 68, color: BRAND.primary }, { label: 'Percentile', val: 'P62', color: BRAND.accent }, { label: 'Role Fit', val: '79%', color: BRAND.green }].map(k => (
                      <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
                        <div className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4">Full Domain Breakdown</h3>
                    <div className="space-y-3">
                      {COMPETENCY_DOMAINS.map(d => (
                        <div key={d.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">{d.name}</span>
                            <span className="text-xs font-bold" style={{ color: d.color }}>{d.score} / 100</span>
                          </div>
                          <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${d.score}%`, backgroundColor: d.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── CAREER PATH ── */}
          {tab === 'career' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Career Path Analysis</h1>
                <p className="text-xs text-gray-500 mt-0.5">AI-recommended career directions for {selectedChild.name}</p>
              </div>
              <div className="space-y-4">
                {CAREER_PATHS.map((c, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-4 mb-3">
                      <span className="text-3xl">{c.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-800">{c.path}</div>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold text-white mt-1 inline-block" style={{ backgroundColor: c.color }}>{c.priority}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold" style={{ color: c.color }}>{c.readiness}%</div>
                        <div className="text-[9px] text-gray-400">readiness</div>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.readiness}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Lightbulb size={14} style={{ color: BRAND.accent }} /> How to Support This Journey
                </h3>
                <div className="space-y-2">
                  {['Enroll in domain-specific online courses (Coursera, Khan Academy)', 'Book regular mentor sessions to practice soft skills', 'Attend career fairs and industry talks at school'].map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle size={12} className="shrink-0 mt-0.5" style={{ color: BRAND.green }} />{s}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SESSIONS ── */}
          {tab === 'sessions' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Mentor Sessions</h1>
                <p className="text-xs text-gray-500 mt-0.5">Session history and upcoming bookings for all children</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[{ label: 'Total Sessions', val: 5, color: BRAND.primary }, { label: 'Hours Invested', val: 7.5, color: BRAND.accent }, { label: 'Avg Rating', val: '4.8 ★', color: BRAND.orange }].map(k => (
                  <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="space-y-3">
                  {SESSIONS.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: BRAND.primary }}>
                        {s.mentor.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-gray-800">{s.mentor}</div>
                        <div className="text-[10px] text-gray-400">{s.subject} · {s.child}</div>
                        <div className="text-[9px] text-gray-400 mt-0.5">{s.date}</div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${s.status === 'upcoming' ? 'text-blue-700 bg-blue-50' : 'text-teal-700 bg-teal-50'}`}>
                          {s.status}
                        </span>
                        {s.rating && <div className="text-[10px] text-amber-500 mt-1">{'★'.repeat(s.rating)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => onNavigate('mentor-marketplace')}
                  className="mt-4 w-full text-xs font-medium py-2.5 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>
                  Book New Session
                </button>
              </div>
            </div>
          )}

          {/* ── REPORTS ── */}
          {tab === 'reports' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Progress Reports</h1>
                <p className="text-xs text-gray-500 mt-0.5">Detailed career development reports for your children</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: 'Monthly Career Progress Report', child: 'Aanya Sharma', date: 'March 2026', ready: true },
                  { title: 'Competency Assessment Report', child: 'Aanya Sharma', date: 'March 2026', ready: true },
                  { title: 'Monthly Career Progress Report', child: 'Rohan Sharma', date: 'March 2026', ready: false },
                  { title: 'Gap Analysis & Intervention Plan', child: 'Aanya Sharma', date: 'March 2026', ready: true },
                ].map((r, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: r.ready ? `${BRAND.primary}12` : '#f1f5f9' }}>
                      <FileText size={18} style={{ color: r.ready ? BRAND.primary : '#94a3b8' }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-800">{r.title}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{r.child} · {r.date}</div>
                      {r.ready ? (
                        <button className="mt-2 text-[10px] font-medium px-2.5 py-1 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>
                          Download PDF
                        </button>
                      ) : (
                        <span className="mt-2 inline-block text-[9px] text-gray-400">Assessment pending</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
