import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import { useState } from 'react';
import { School, Users, Brain, TrendingUp, AlertTriangle, BarChart2, Download, Filter } from 'lucide-react';



interface ClassData {
  grade: string;
  students: number;
  avgScore: number;
  lbiAvg: number;
  atRisk: number;
  topDomain: string;
  weakDomain: string;
  trend: 'up' | 'down' | 'stable';
}

const MOCK_CLASSES: ClassData[] = [
  { grade: 'Grade 8',  students: 42, avgScore: 68, lbiAvg: 62, atRisk: 5,  topDomain: 'Social & Emotional', weakDomain: 'Discipline',          trend: 'up'     },
  { grade: 'Grade 9',  students: 38, avgScore: 65, lbiAvg: 59, atRisk: 7,  topDomain: 'Critical Thinking',  weakDomain: 'Sustained Attention',  trend: 'stable' },
  { grade: 'Grade 10', students: 45, avgScore: 71, lbiAvg: 65, atRisk: 4,  topDomain: 'Learning Efficiency', weakDomain: 'Time Management',      trend: 'up'     },
  { grade: 'Grade 11', students: 36, avgScore: 73, lbiAvg: 67, atRisk: 6,  topDomain: 'Drive & Integrity',   weakDomain: 'External Pressures',   trend: 'down'   },
  { grade: 'Grade 12', students: 40, avgScore: 76, lbiAvg: 70, atRisk: 3,  topDomain: 'Critical Thinking',   weakDomain: 'Emotional Regulation', trend: 'up'     },
];

const DOMAIN_DISTRIBUTION = [
  { domain: 'Learning Efficiency',   score: 66, color: BRAND.primary },
  { domain: 'Critical Thinking',      score: 71, color: BRAND.teal },
  { domain: 'Social & Emotional',     score: 68, color: '#6B8DD6' },
  { domain: 'Sustained Attention',    score: 60, color: '#38B2A0' },
  { domain: 'Discipline',             score: 57, color: BRAND.primary },
  { domain: 'Communication',          score: 64, color: BRAND.teal },
  { domain: 'Drive & Integrity',      score: 72, color: '#6B8DD6' },
  { domain: 'External Pressures',     score: 53, color: '#DC6B6B' },
];

export function SchoolHealthDashboard() {
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [activeView, setActiveView] = useState<'overview' | 'domains' | 'risk'>('overview');

  const filtered = selectedGrade === 'All' ? MOCK_CLASSES : MOCK_CLASSES.filter(c => c.grade === selectedGrade);
  const totalStudents = filtered.reduce((s, c) => s + c.students, 0);
  const avgScore = Math.round(filtered.reduce((s, c) => s + c.avgScore, 0) / Math.max(filtered.length, 1));
  const avgLBI = Math.round(filtered.reduce((s, c) => s + c.lbiAvg, 0) / Math.max(filtered.length, 1));
  const totalRisk = filtered.reduce((s, c) => s + c.atRisk, 0);

  const handleDownload = () => {
    const csv = [
      'Grade,Students,Avg Score,LBI Avg,At Risk,Top Domain,Weak Domain,Trend',
      ...MOCK_CLASSES.map(c =>
        `${c.grade},${c.students},${c.avgScore}%,${c.lbiAvg}%,${c.atRisk},${c.topDomain},${c.weakDomain},${c.trend}`
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `School_Health_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 p-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: BRAND.primary }}>
            <School size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>School Health Dashboard</h2>
            <p className="text-xs text-gray-400">Anonymised cohort behavioral intelligence · {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedGrade}
            onChange={e => setSelectedGrade(e.target.value)}
            className="text-xs border rounded-lg px-2 py-1.5 outline-none"
            style={{ borderColor: 'rgba(11,60,93,0.2)' }}
          >
            <option>All</option>
            {MOCK_CLASSES.map(c => <option key={c.grade}>{c.grade}</option>)}
          </select>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white hover:opacity-80 transition-opacity"
            style={{ background: BRAND.primary }}
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { val: totalStudents, lbl: 'Students Tracked', icon: <Users size={16} />, color: BRAND.primary },
          { val: `${avgScore}%`, lbl: 'Avg Academic Score', icon: <TrendingUp size={16} />, color: BRAND.teal },
          { val: `${avgLBI}%`, lbl: 'Avg LBI Score', icon: <Brain size={16} />, color: BRAND.primary },
          { val: totalRisk, lbl: 'At-Risk Students', icon: <AlertTriangle size={16} />, color: '#DC6B6B' },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-2xl border p-4 shadow-sm" style={{ borderColor: 'rgba(11,60,93,0.1)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${k.color}15` }}>
                <span style={{ color: k.color }}>{k.icon}</span>
              </div>
            </div>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{k.lbl}</div>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['overview', 'domains', 'risk'] as const).map(v => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className="text-xs font-medium px-4 py-1.5 rounded-lg capitalize transition-all"
            style={activeView === v ? { background: 'white', color: BRAND.primary, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : { color: '#64748B' }}
          >
            {v === 'overview' ? 'Class Overview' : v === 'domains' ? 'Domain Analysis' : 'At-Risk Alerts'}
          </button>
        ))}
      </div>

      {/* Class overview table */}
      {activeView === 'overview' && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: 'rgba(11,60,93,0.1)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(11,60,93,0.04)', borderBottom: '1px solid rgba(11,60,93,0.08)' }}>
                  {['Grade', 'Students', 'Avg Score', 'LBI Avg', 'At Risk', 'Top Domain', 'Needs Focus', 'Trend'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.grade} style={{ borderBottom: '1px solid rgba(11,60,93,0.05)' }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: BRAND.primary }}>{c.grade}</td>
                    <td className="px-4 py-3 text-gray-600">{c.students}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: c.avgScore >= 70 ? BRAND.teal : c.avgScore >= 60 ? BRAND.primary : '#DC6B6B' }}>{c.avgScore}%</span>
                        <div className="w-16 h-1.5 rounded-full bg-gray-100">
                          <div className="h-full rounded-full" style={{ width: `${c.avgScore}%`, background: c.avgScore >= 70 ? BRAND.teal : BRAND.primary }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: BRAND.teal }}>{c.lbiAvg}%</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-semibold" style={{ background: c.atRisk > 5 ? '#DC6B6B' : '#F59E0B' }}>{c.atRisk}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate">{c.topDomain}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate">{c.weakDomain}</td>
                    <td className="px-4 py-3">
                      <span style={{ color: c.trend === 'up' ? BRAND.teal : c.trend === 'down' ? '#DC6B6B' : '#94A3B8' }}>
                        {c.trend === 'up' ? '▲' : c.trend === 'down' ? '▼' : '–'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Domain analysis */}
      {activeView === 'domains' && (
        <div className="bg-white rounded-2xl border shadow-sm p-5" style={{ borderColor: 'rgba(11,60,93,0.1)' }}>
          <div className="text-sm font-semibold mb-4" style={{ color: BRAND.primary }}>School-Wide LBI Domain Averages</div>
          <div className="space-y-3">
            {DOMAIN_DISTRIBUTION.sort((a, b) => b.score - a.score).map(d => (
              <div key={d.domain}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{d.domain}</span>
                  <span className="font-semibold" style={{ color: d.score >= 65 ? BRAND.teal : d.score >= 55 ? BRAND.primary : '#DC6B6B' }}>{d.score}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${d.score}%`, background: d.score >= 65 ? BRAND.teal : d.score >= 55 ? BRAND.primary : '#DC6B6B' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-4">Anonymised averages across all tracked students. External Pressures domain flagged for intervention planning.</p>
        </div>
      )}

      {/* At-risk */}
      {activeView === 'risk' && (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.grade} className="bg-white rounded-2xl border p-4 shadow-sm flex items-center gap-4" style={{ borderColor: c.atRisk > 5 ? 'rgba(220,107,107,0.3)' : 'rgba(11,60,93,0.1)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: c.atRisk > 5 ? 'rgba(220,107,107,0.1)' : 'rgba(11,60,93,0.08)' }}>
                <AlertTriangle size={20} style={{ color: c.atRisk > 5 ? '#DC6B6B' : BRAND.primary }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold" style={{ color: BRAND.primary }}>{c.grade}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full text-white font-semibold" style={{ background: c.atRisk > 5 ? '#DC6B6B' : '#F59E0B' }}>{c.atRisk} at risk</span>
                </div>
                <p className="text-[11px] text-gray-500">Primary concern: <span className="font-medium">{c.weakDomain}</span> — recommend targeted intervention sessions and mentor support for flagged students.</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-gray-400">Class avg</div>
                <div className="text-sm font-bold" style={{ color: BRAND.primary }}>{c.avgScore}%</div>
              </div>
            </div>
          ))}
          <div className="bg-white rounded-2xl border p-4 shadow-sm" style={{ borderColor: 'rgba(11,60,93,0.1)' }}>
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="font-semibold" style={{ color: BRAND.primary }}>Note:</span> At-risk classification uses anonymised LBI trend data and score trajectory over 4 weeks. Student identities are never exposed in this view. Access individual student data through the parent-linked portal with appropriate consent.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
