import { BRAND } from '@/design-system/tokens';
import { useState } from 'react';
import { Briefcase, Brain, Target, Users, TrendingUp, Download, Star, CheckCircle, AlertCircle, Filter } from 'lucide-react';



interface Candidate {
  id: string;
  name: string;
  role: string;
  lbiScore: number;
  fitScore: number;
  topDomains: string[];
  gapDomains: string[];
  experience: string;
  status: 'shortlisted' | 'reviewing' | 'rejected';
}

const ROLE_PROFILES: Record<string, { domains: string[]; weights: Record<string, number>; label: string }> = {
  'Software Engineer': {
    label: 'Software Engineer',
    domains: ['Critical Thinking', 'Learning Efficiency', 'Sustained Attention', 'Discipline'],
    weights: { 'Critical Thinking': 30, 'Learning Efficiency': 25, 'Sustained Attention': 25, 'Discipline': 20 },
  },
  'Product Manager': {
    label: 'Product Manager',
    domains: ['Critical Thinking', 'Communication', 'Drive & Integrity', 'Social & Emotional'],
    weights: { 'Critical Thinking': 25, 'Communication': 30, 'Drive & Integrity': 25, 'Social & Emotional': 20 },
  },
  'Sales Executive': {
    label: 'Sales Executive',
    domains: ['Communication', 'Drive & Integrity', 'Emotional Regulation', 'Effort Persistence'],
    weights: { 'Communication': 35, 'Drive & Integrity': 25, 'Emotional Regulation': 20, 'Effort Persistence': 20 },
  },
  'Data Analyst': {
    label: 'Data Analyst',
    domains: ['Critical Thinking', 'Learning Efficiency', 'Discipline', 'Sustained Attention'],
    weights: { 'Critical Thinking': 30, 'Learning Efficiency': 30, 'Discipline': 20, 'Sustained Attention': 20 },
  },
};

const MOCK_CANDIDATES: Candidate[] = [
  { id: '1', name: 'Priya Sharma',    role: 'Software Engineer', lbiScore: 82, fitScore: 88, topDomains: ['Critical Thinking', 'Discipline'],       gapDomains: ['Communication'],                    experience: '3 years', status: 'shortlisted' },
  { id: '2', name: 'Rahul Nair',      role: 'Product Manager',   lbiScore: 75, fitScore: 79, topDomains: ['Communication', 'Drive & Integrity'],     gapDomains: ['Critical Thinking'],                experience: '5 years', status: 'shortlisted' },
  { id: '3', name: 'Ananya Reddy',    role: 'Data Analyst',      lbiScore: 79, fitScore: 85, topDomains: ['Learning Efficiency', 'Discipline'],      gapDomains: ['Emotional Regulation'],             experience: '2 years', status: 'reviewing'   },
  { id: '4', name: 'Vikram Iyer',     role: 'Sales Executive',   lbiScore: 68, fitScore: 62, topDomains: ['Drive & Integrity'],                      gapDomains: ['Communication', 'Sustained Attention'], experience: '4 years', status: 'reviewing' },
  { id: '5', name: 'Sneha Kulkarni',  role: 'Software Engineer', lbiScore: 90, fitScore: 93, topDomains: ['Critical Thinking', 'Learning Efficiency', 'Discipline'], gapDomains: [],            experience: '6 years', status: 'shortlisted' },
];

export function HRBehavioralHiring() {
  const [selectedRole, setSelectedRole] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'fitScore' | 'lbiScore'>('fitScore');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = MOCK_CANDIDATES
    .filter(c => (selectedRole === 'All' || c.role === selectedRole) && (selectedStatus === 'All' || c.status === selectedStatus))
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const handleDownload = () => {
    const csv = [
      'Name,Role,LBI Score,Role Fit %,Top Domains,Gap Domains,Experience,Status',
      ...MOCK_CANDIDATES.map(c =>
        `${c.name},${c.role},${c.lbiScore},${c.fitScore}%,"${c.topDomains.join('; ')}","${c.gapDomains.join('; ')}",${c.experience},${c.status}`
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MetryxOne_HR_Behavioral_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColors: Record<string, string> = { shortlisted: BRAND.teal, reviewing: '#F59E0B', rejected: '#DC6B6B' };

  return (
    <div className="space-y-5 p-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: BRAND.primary }}>
            <Briefcase size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>Behavioral Hiring Intelligence</h2>
            <p className="text-xs text-gray-400">LBI-powered candidate fit scoring · {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white hover:opacity-80 transition-opacity"
          style={{ background: BRAND.primary }}
        >
          <Download size={12} /> Export Report
        </button>
      </div>

      {/* Role profiles */}
      <div className="bg-white rounded-2xl border shadow-sm p-4" style={{ borderColor: 'rgba(52,78,134,0.1)' }}>
        <div className="text-xs font-semibold mb-3" style={{ color: BRAND.primary }}>Role Behavioral Profiles</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(ROLE_PROFILES).map(([role, profile]) => (
            <div key={role} className="rounded-xl p-3" style={{ background: 'rgba(52,78,134,0.04)', border: '1px solid rgba(52,78,134,0.08)' }}>
              <div className="text-[10px] font-semibold mb-2" style={{ color: BRAND.primary }}>{profile.label}</div>
              <div className="space-y-1">
                {profile.domains.map(d => (
                  <div key={d} className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-500 truncate">{d}</span>
                    <span className="text-[9px] font-semibold" style={{ color: BRAND.teal }}>{profile.weights[d]}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <Filter size={12} className="text-gray-400" />
        <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 outline-none" style={{ borderColor: 'rgba(52,78,134,0.2)' }}>
          <option>All</option>
          {Object.keys(ROLE_PROFILES).map(r => <option key={r}>{r}</option>)}
        </select>
        <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 outline-none" style={{ borderColor: 'rgba(52,78,134,0.2)' }}>
          <option>All</option>
          <option>shortlisted</option>
          <option>reviewing</option>
          <option>rejected</option>
        </select>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 ml-auto">
          {(['fitScore', 'lbiScore'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)} className="text-[10px] font-medium px-2.5 py-1 rounded-md transition-all" style={sortBy === s ? { background: 'white', color: BRAND.primary, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: '#64748B' }}>
              {s === 'fitScore' ? 'Role Fit' : 'LBI Score'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { val: MOCK_CANDIDATES.filter(c => c.status === 'shortlisted').length, lbl: 'Shortlisted', color: BRAND.teal },
          { val: `${Math.round(MOCK_CANDIDATES.reduce((s, c) => s + c.fitScore, 0) / MOCK_CANDIDATES.length)}%`, lbl: 'Avg Role Fit', color: BRAND.primary },
          { val: `${Math.round(MOCK_CANDIDATES.reduce((s, c) => s + c.lbiScore, 0) / MOCK_CANDIDATES.length)}%`, lbl: 'Avg LBI Score', color: BRAND.primary },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-2xl border p-4 text-center shadow-sm" style={{ borderColor: 'rgba(52,78,134,0.1)' }}>
            <div className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{k.lbl}</div>
          </div>
        ))}
      </div>

      {/* Candidate list */}
      <div className="space-y-3">
        {filtered.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: c.fitScore >= 80 ? `${BRAND.teal}40` : 'rgba(52,78,134,0.1)' }}>
            <div
              className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedId(id => id === c.id ? null : c.id)}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0" style={{ background: `${BRAND.primary}` }}>
                {c.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold" style={{ color: BRAND.primary }}>{c.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-semibold capitalize" style={{ background: statusColors[c.status] }}>{c.status}</span>
                </div>
                <div className="text-xs text-gray-400">{c.role} · {c.experience}</div>
              </div>
              <div className="text-right shrink-0 mr-2">
                <div className="text-lg font-bold" style={{ color: c.fitScore >= 80 ? BRAND.teal : BRAND.primary }}>{c.fitScore}%</div>
                <div className="text-[9px] text-gray-400">Role Fit</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold" style={{ color: BRAND.primary }}>{c.lbiScore}%</div>
                <div className="text-[9px] text-gray-400">LBI Score</div>
              </div>
              <span className="text-gray-300 text-xs">{expandedId === c.id ? '▲' : '▼'}</span>
            </div>

            {expandedId === c.id && (
              <div className="px-5 pb-4 border-t" style={{ borderColor: 'rgba(52,78,134,0.06)' }}>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <div className="text-[10px] font-semibold mb-2" style={{ color: BRAND.teal }}>Behavioral Strengths</div>
                    {c.topDomains.map(d => (
                      <div key={d} className="flex items-center gap-1.5 mb-1">
                        <CheckCircle size={11} style={{ color: BRAND.teal }} />
                        <span className="text-[11px] text-gray-600">{d}</span>
                      </div>
                    ))}
                    {c.topDomains.length === 0 && <span className="text-[11px] text-gray-400">No dominant strengths flagged</span>}
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold mb-2" style={{ color: BRAND.primary }}>Development Areas</div>
                    {c.gapDomains.map(d => (
                      <div key={d} className="flex items-center gap-1.5 mb-1">
                        <AlertCircle size={11} style={{ color: BRAND.primary }} />
                        <span className="text-[11px] text-gray-600">{d}</span>
                      </div>
                    ))}
                    {c.gapDomains.length === 0 && <span className="text-[11px]" style={{ color: BRAND.teal }}>No significant gaps — strong fit</span>}
                  </div>
                </div>
                {/* Fit score bar */}
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(52,78,134,0.06)' }}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-gray-400">Role behavioral alignment</span>
                    <span className="font-semibold" style={{ color: c.fitScore >= 80 ? BRAND.teal : BRAND.primary }}>{c.fitScore}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.fitScore}%`, background: `${BRAND.primary}` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
