import { BRAND } from '@/design-system/tokens';
import { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import type { Screen } from '../../App';
import InstitutionCareerRealView from './InstitutionCareerRealView';
import {
  Brain, Target, BookOpen, Users, Star, Award, BarChart3, TrendingUp,
  CheckCircle, Clock, ChevronRight, Sparkles, Zap, Building2, Trophy,
  Briefcase, ArrowRight, RefreshCw, GraduationCap, Lightbulb,
  Activity, FileText, Compass, MessageSquare, Bell, PieChart, LogOut,
  AlertCircle, Shield, BarChart2, Download, Filter, Search,
  TrendingDown, Minus, Calendar, MapPin, PlusCircle, Eye
} from 'lucide-react';



type Tab = 'heatmap' | 'placement' | 'gaps' | 'mentorship' | 'reports';

interface InstitutionCareerPageProps {
  onNavigate: (screen: Screen | string) => void;
}

const BATCH_STATS = {
  total: 248, assessed: 187, highReadiness: 62, atRisk: 28, placementRate: 74,
};

const DEPARTMENTS = [
  { name: 'Computer Science', students: 68, avgReadiness: 79, assessed: 65, placements: 58 },
  { name: 'Electronics & EEE', students: 52, avgReadiness: 71, assessed: 48, placements: 41 },
  { name: 'Mechanical', students: 44, avgReadiness: 63, assessed: 38, placements: 31 },
  { name: 'Business Administration', students: 40, avgReadiness: 74, assessed: 36, placements: 33 },
  { name: 'Data Science', students: 44, avgReadiness: 82, assessed: 42, placements: 39 },
];

const DOMAIN_HEATMAP = [
  { name: 'Cognitive', code: 'COG', CS: 77, EEE: 68, Mech: 61, BA: 72, DS: 84 },
  { name: 'Communication', code: 'COM', CS: 65, EEE: 61, Mech: 58, BA: 78, DS: 70 },
  { name: 'Leadership', code: 'LEA', CS: 52, EEE: 49, Mech: 55, BA: 72, DS: 58 },
  { name: 'Execution', code: 'EXE', CS: 74, EEE: 70, Mech: 68, BA: 67, DS: 79 },
  { name: 'Adaptability', code: 'ADP', CS: 80, EEE: 73, Mech: 65, BA: 71, DS: 83 },
  { name: 'Technical', code: 'TEC', CS: 85, EEE: 78, Mech: 74, BA: 55, DS: 88 },
  { name: 'Emotional IQ', code: 'EIQ', CS: 57, EEE: 54, Mech: 58, BA: 68, DS: 61 },
];

const TOP_EMPLOYERS = [
  { name: 'TCS', roles: 22, package: '₹3.6L–6.2L', domain: 'Technology' },
  { name: 'Infosys', roles: 18, package: '₹3.2L–5.8L', domain: 'Technology' },
  { name: 'Deloitte', roles: 8, package: '₹6L–9L', domain: 'Consulting' },
  { name: 'ICICI Bank', roles: 6, package: '₹4L–7L', domain: 'Finance' },
  { name: 'Amazon', roles: 4, package: '₹12L–18L', domain: 'Technology' },
];

const MENTOR_SESSIONS = [
  { mentor: 'Dr. Ananya Krishnan', subject: 'Interview Skills', students: 24, rating: 4.9, next: 'Apr 5' },
  { mentor: 'Rajesh Iyer (TCS)', subject: 'Technical Screening Prep', students: 18, rating: 4.7, next: 'Apr 8' },
  { mentor: 'Priya Nair (Deloitte)', subject: 'Career Roadmap Workshop', students: 32, rating: 4.8, next: 'Apr 12' },
];

function heatColor(score: number) {
  if (score >= 80) return { bg: '#d1fae5', text: '#065f46' };
  if (score >= 70) return { bg: '#dcfce7', text: '#166534' };
  if (score >= 60) return { bg: '#fef9c3', text: '#713f12' };
  if (score >= 50) return { bg: '#ffedd5', text: '#9a3412' };
  return { bg: '#fee2e2', text: '#991b1b' };
}

export default function InstitutionCareerPage({ onNavigate }: InstitutionCareerPageProps) {
  const [tab, setTab] = useState<Tab>('heatmap');
  const [search, setSearch] = useState('');

  // MX-302H — probe the institutionalIntelligence flag. Default OFF: the probe
  // 503s, `enabled` stays false, and the legacy MOCK dashboard below renders
  // byte-identically. ON: render the live, k-anonymity-gated real view instead.
  const [institutionalEnabled, setInstitutionalEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/institutional-intelligence/enabled', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d && d.enabled === true) setInstitutionalEnabled(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (institutionalEnabled) {
    return <InstitutionCareerRealView onNavigate={onNavigate} />;
  }

  const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'heatmap', label: 'Competency Heatmap', icon: <Brain size={16} /> },
    { id: 'placement', label: 'Placement Dashboard', icon: <Briefcase size={16} /> },
    { id: 'gaps', label: 'Gap Analysis', icon: <AlertCircle size={16} /> },
    { id: 'mentorship', label: 'Mentorship', icon: <Users size={16} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
  ];

  const depts = ['CS', 'EEE', 'Mech', 'BA', 'DS'];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafc' }}>
      <Navbar onNavigate={onNavigate} currentScreen="institution-career-portal" />
      <div className="flex gap-0 max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-10 min-h-[calc(100vh-80px)]">

        {/* Sidebar */}
        <aside className="w-64 shrink-0 mr-6 space-y-1 pt-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={16} style={{ color: BRAND.primary }} />
              <span className="text-xs font-bold text-gray-800">Institution Portal</span>
            </div>
            <div className="text-[10px] text-gray-400">Career Readiness Intelligence</div>
            <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 gap-2">
              <div>
                <div className="text-base font-bold" style={{ color: BRAND.primary }}>{BATCH_STATS.total}</div>
                <div className="text-[9px] text-gray-400">Students</div>
              </div>
              <div>
                <div className="text-base font-bold" style={{ color: BRAND.green }}>{BATCH_STATS.placementRate}%</div>
                <div className="text-[9px] text-gray-400">Placement Rate</div>
              </div>
            </div>
          </div>

          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${tab === n.id ? 'text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:shadow-sm'}`}
              style={tab === n.id ? { backgroundColor: BRAND.primary } : {}}>
              {n.icon} {n.label}
            </button>
          ))}

          <div className="pt-3 mt-3 border-t border-gray-100">
            <button onClick={() => onNavigate('unified-institute-dashboard')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:bg-white hover:text-gray-700 transition-all">
              <LogOut size={14} /> Institution Dashboard
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 pt-4 space-y-5">

          {/* ── HEATMAP ── */}
          {tab === 'heatmap' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Competency Heatmap</h1>
                <p className="text-xs text-gray-500 mt-0.5">Batch-level competency scores across departments and domains</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Students', val: BATCH_STATS.total, color: BRAND.primary },
                  { label: 'Assessed', val: BATCH_STATS.assessed, color: BRAND.accent },
                  { label: 'High Readiness', val: BATCH_STATS.highReadiness, color: BRAND.green },
                  { label: 'At Risk', val: BATCH_STATS.atRisk, color: BRAND.red },
                ].map(k => (
                  <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Heat table */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50">
                  <h3 className="text-sm font-semibold text-gray-800">Domain × Department Heatmap</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Average competency score per domain, grouped by department</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-50">
                        <th className="text-left py-3 px-4 text-[10px] font-semibold text-gray-500 w-36">Domain</th>
                        {depts.map(d => (
                          <th key={d} className="text-center py-3 px-3 text-[10px] font-semibold text-gray-500">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DOMAIN_HEATMAP.map(row => (
                        <tr key={row.code} className="border-b border-gray-50">
                          <td className="py-2.5 px-4 text-xs font-medium text-gray-700">{row.name}</td>
                          {depts.map(d => {
                            const score = (row as any)[d];
                            const c = heatColor(score);
                            return (
                              <td key={d} className="py-2.5 px-3 text-center">
                                <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold min-w-[36px]"
                                  style={{ backgroundColor: c.bg, color: c.text }}>
                                  {score}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-t border-gray-50 flex gap-3">
                  {[{ label: '≥80 Excellent', bg: '#d1fae5', text: '#065f46' }, { label: '70–79 Good', bg: '#dcfce7', text: '#166534' }, { label: '60–69 Average', bg: '#fef9c3', text: '#713f12' }, { label: '<60 Risk', bg: '#fee2e2', text: '#991b1b' }].map(l => (
                    <span key={l.label} className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: l.bg, color: l.text }}>{l.label}</span>
                  ))}
                </div>
              </div>

              {/* Department table */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50">
                  <h3 className="text-sm font-semibold text-gray-800">Department Readiness Summary</h3>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-50">
                      {['Department', 'Students', 'Assessed', 'Avg Readiness', 'Placements'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-[10px] font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DEPARTMENTS.map(d => (
                      <tr key={d.name} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-800">{d.name}</td>
                        <td className="py-3 px-4 text-gray-600">{d.students}</td>
                        <td className="py-3 px-4 text-gray-600">{d.assessed}/{d.students}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${d.avgReadiness}%`, backgroundColor: d.avgReadiness >= 75 ? BRAND.green : BRAND.accent }} />
                            </div>
                            <span className="font-semibold" style={{ color: d.avgReadiness >= 75 ? BRAND.green : BRAND.accent }}>{d.avgReadiness}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium" style={{ color: BRAND.primary }}>{d.placements}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PLACEMENT DASHBOARD ── */}
          {tab === 'placement' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Placement Dashboard</h1>
                <p className="text-xs text-gray-500 mt-0.5">Placement readiness and employer engagement overview</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Placement Rate', val: `${BATCH_STATS.placementRate}%`, color: BRAND.green },
                  { label: 'Offers Received', val: '184', color: BRAND.primary },
                  { label: 'Avg Package', val: '₹5.2L', color: BRAND.accent },
                  { label: 'Top Package', val: '₹18L', color: BRAND.purple },
                ].map(k => (
                  <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-center">
                    <div className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Top Recruiting Partners</h3>
                <div className="space-y-3">
                  {TOP_EMPLOYERS.map((e, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: BRAND.primary }}>
                        {e.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-gray-800">{e.name}</div>
                        <div className="text-[10px] text-gray-400">{e.domain} · {e.package}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: BRAND.primary }}>{e.roles}</div>
                        <div className="text-[9px] text-gray-400">offers</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── GAP ANALYSIS ── */}
          {tab === 'gaps' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Institutional Gap Analysis</h1>
                <p className="text-xs text-gray-500 mt-0.5">System-wide competency gaps and intervention priorities</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <AlertCircle size={13} style={{ color: BRAND.red }} /> Critical Gaps (Batch-wide)
                  </h3>
                  {[
                    { name: 'Leadership & Initiative', avgScore: 52, students: 89 },
                    { name: 'Emotional Intelligence', avgScore: 56, students: 74 },
                    { name: 'Communication', avgScore: 63, students: 61 },
                  ].map((g, i) => (
                    <div key={i} className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-700">{g.name}</span>
                        <span className="text-[10px] text-gray-400">{g.students} students affected</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${g.avgScore}%`, backgroundColor: BRAND.orange }} />
                      </div>
                      <div className="text-[9px] text-gray-400 mt-0.5">Avg score: {g.avgScore}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Lightbulb size={13} style={{ color: BRAND.accent }} /> Recommended Interventions
                  </h3>
                  {[
                    { title: 'Leadership Development Program', type: 'Workshop', duration: '4 weeks', priority: 'Critical' },
                    { title: 'EQ & Soft Skills Bootcamp', type: 'Course', duration: '3 weeks', priority: 'High' },
                    { title: 'Group Discussion & Debate Club', type: 'Activity', duration: 'Ongoing', priority: 'Medium' },
                  ].map((r, i) => (
                    <div key={i} className="flex items-start gap-2 mb-3 last:mb-0 p-2.5 rounded-xl border border-gray-100">
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded text-white shrink-0 mt-0.5"
                        style={{ backgroundColor: r.priority === 'Critical' ? BRAND.red : r.priority === 'High' ? BRAND.orange : BRAND.accent }}>
                        {r.priority}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-gray-800">{r.title}</div>
                        <div className="text-[10px] text-gray-400">{r.type} · {r.duration}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => onNavigate('competency-learning-paths')}
                className="w-full text-xs font-semibold py-3 rounded-xl text-white shadow-sm" style={{ backgroundColor: BRAND.primary }}>
                View Detailed Intervention Plans →
              </button>
            </div>
          )}

          {/* ── MENTORSHIP ── */}
          {tab === 'mentorship' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Mentorship Programme</h1>
                <p className="text-xs text-gray-500 mt-0.5">Mentor engagement, session coverage, and outcomes</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[{ label: 'Active Mentors', val: 18, color: BRAND.primary }, { label: 'Sessions This Month', val: 74, color: BRAND.accent }, { label: 'Students Covered', val: 156, color: BRAND.green }].map(k => (
                  <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Active Mentor Programme</h3>
                <div className="space-y-3">
                  {MENTOR_SESSIONS.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: BRAND.primary }}>
                        {m.mentor.split(' ')[1]?.charAt(0) || m.mentor.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-gray-800">{m.mentor}</div>
                        <div className="text-[10px] text-gray-400">{m.subject}</div>
                        <div className="text-[9px] text-gray-400 mt-0.5">{m.students} students · Next: {m.next}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-amber-500">{'★'.repeat(Math.floor(m.rating))} {m.rating}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => onNavigate('mentor-marketplace')}
                  className="mt-4 w-full text-xs font-medium py-2.5 rounded-xl text-white" style={{ backgroundColor: BRAND.primary }}>
                  + Add Mentor to Programme
                </button>
              </div>
            </div>
          )}

          {/* ── REPORTS ── */}
          {tab === 'reports' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Institutional Reports</h1>
                <p className="text-xs text-gray-500 mt-0.5">Download and share batch career readiness reports</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: 'Batch Competency Report Q1 2026', type: 'PDF', size: '2.4 MB', ready: true },
                  { title: 'Placement Readiness Summary', type: 'PDF', size: '1.8 MB', ready: true },
                  { title: 'Domain Gap Analysis Report', type: 'Excel', size: '1.2 MB', ready: true },
                  { title: 'Mentorship Impact Report', type: 'PDF', size: '0.9 MB', ready: false },
                ].map((r, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: r.ready ? `${BRAND.primary}12` : '#f1f5f9' }}>
                      <FileText size={18} style={{ color: r.ready ? BRAND.primary : '#94a3b8' }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-800">{r.title}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{r.type} · {r.size}</div>
                      {r.ready ? (
                        <button className="mt-2 flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>
                          <Download size={10} /> Download
                        </button>
                      ) : (
                        <span className="mt-2 inline-block text-[9px] text-gray-400">Generating…</span>
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
