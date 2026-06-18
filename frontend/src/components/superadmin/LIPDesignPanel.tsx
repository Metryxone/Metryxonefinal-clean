/**
 * LIP Admin Panel — Learning Intelligence Platform
 * 7 tabs: Courses | Certifications | Projects | Mentors | Path Templates | Readiness Weights | Analytics
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Award, Briefcase, Users, BarChart3,
  RefreshCw, Search, Edit2, Trash2, CheckCircle2,
  XCircle, Plus, Star, Clock, TrendingUp, AlertTriangle,
  SlidersHorizontal, Layout, Save,
} from 'lucide-react';

function authHeader(): Record<string, string> {
  const t = localStorage.getItem('metryx_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(opts?.headers || {}) },
  });
  return res.json();
}

type AdminTab = 'courses' | 'certifications' | 'projects' | 'mentors' | 'path-templates' | 'readiness-weights' | 'analytics';

// ── Shared table wrapper ───────────────────────────────────────────────────────
function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2.5 bg-gray-50 whitespace-nowrap border-b border-gray-200">{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-gray-700 border-b border-gray-100 ${className}`}>{children}</td>;
}

function Badge({ text, color = '#6C63FF' }: { text: string; color?: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: `${color}15`, color }}>
      {text}
    </span>
  );
}

function LoadingRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center py-10 text-gray-400 text-sm">
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-purple-500 rounded-full animate-spin" />
          Loading…
        </div>
      </td>
    </tr>
  );
}

function EmptyRow({ cols, message }: { cols: number; message: string }) {
  return (
    <tr><td colSpan={cols} className="text-center py-10 text-gray-400 text-sm">{message}</td></tr>
  );
}

// ── Courses Panel ──────────────────────────────────────────────────────────────
function CoursesPanel() {
  const [courses, setCourses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuality, setEditQuality] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', ...(refresh ? { refresh: '1' } : {}), ...(filterType ? { type: filterType } : {}), ...(filterRegion ? { region: filterRegion } : {}) });
      const r = await apiFetch(`/api/admin/lip/courses?${params}`);
      if (r.success) { setCourses(r.data.rows || []); setTotal(r.data.total || 0); }
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterType, filterRegion]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Soft-delete this course?')) return;
    await apiFetch(`/api/admin/lip/courses/${id}`, { method: 'DELETE' });
    load(true);
  };

  const handlePatchQuality = async (id: string) => {
    setSaving(true);
    await apiFetch(`/api/admin/lip/courses/${id}`, { method: 'PATCH', body: JSON.stringify({ quality_score: Number(editQuality) }) });
    setSaving(false);
    setEditingId(null);
    load(true);
  };

  const filtered = courses.filter(c =>
    !search || c.title?.toLowerCase().includes(search.toLowerCase()) || c.provider?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none">
          <option value="">All Types</option>
          <option value="online_course">Online Course</option>
          <option value="specialization">Specialization</option>
          <option value="live_cohort">Live Cohort</option>
          <option value="workshop">Workshop</option>
          <option value="nanodegree">Nanodegree</option>
        </select>
        <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none">
          <option value="">All Regions</option>
          <option value="IN">India</option>
          <option value="GLOBAL">Global</option>
        </select>
        <button onClick={() => load(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <RefreshCw size={13} /> Refresh
        </button>
        <span className="text-xs text-gray-400">{total} total</span>
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Title</Th><Th>Provider</Th><Th>Type</Th><Th>Hours</Th>
            <Th>Difficulty</Th><Th>Cost (₹)</Th><Th>Quality</Th><Th>Region</Th><Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? <LoadingRow cols={9} /> : filtered.length === 0 ? <EmptyRow cols={9} message="No courses found" /> :
            filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <Td><span className="font-medium text-gray-800 text-xs">{c.title}</span></Td>
                <Td><span className="text-xs">{c.provider}</span></Td>
                <Td><Badge text={c.type?.replace(/_/g, ' ')} color="#6C63FF" /></Td>
                <Td><span className="text-xs">{c.duration_hours}h</span></Td>
                <Td><Badge text={['','★','★★','★★★','★★★★'][c.difficulty_level] ?? c.difficulty_level} color={['','#43C59E','#45AAF2','#F7B731','#FC5C65'][c.difficulty_level]} /></Td>
                <Td><span className="text-xs">{c.cost_inr === 0 ? <span className="text-green-600">Free</span> : `₹${Number(c.cost_inr).toLocaleString()}`}</span></Td>
                <Td>
                  {editingId === c.id ? (
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" max="100" value={editQuality} onChange={e => setEditQuality(e.target.value)}
                        className="w-16 text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none" />
                      <button onClick={() => handlePatchQuality(c.id)} disabled={saving} className="text-green-600 hover:text-green-700">
                        <CheckCircle2 size={13} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><XCircle size={13} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingId(c.id); setEditQuality(String(c.quality_score)); }}
                      className="flex items-center gap-1 text-xs hover:text-purple-600">
                      <Star size={10} className="text-amber-400" />{c.quality_score}
                      <Edit2 size={10} className="opacity-40 hover:opacity-100" />
                    </button>
                  )}
                </Td>
                <Td><Badge text={c.region} color={c.region === 'IN' ? '#F97316' : '#3B82F6'} /></Td>
                <Td>
                  <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                    <Trash2 size={13} />
                  </button>
                </Td>
              </tr>
            ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

// ── Certifications Panel ───────────────────────────────────────────────────────
function CertificationsPanel() {
  const [certs, setCerts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrestige, setEditPrestige] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', ...(refresh ? { refresh: '1' } : {}), ...(filterType ? { type: filterType } : {}) });
      const r = await apiFetch(`/api/admin/lip/certifications?${params}`);
      if (r.success) { setCerts(r.data.rows || []); setTotal(r.data.total || 0); }
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Soft-delete this certification?')) return;
    await apiFetch(`/api/admin/lip/certifications/${id}`, { method: 'DELETE' });
    load(true);
  };

  const handlePatchPrestige = async (id: string) => {
    setSaving(true);
    await apiFetch(`/api/admin/lip/certifications/${id}`, { method: 'PATCH', body: JSON.stringify({ prestige_score: Number(editPrestige) }) });
    setSaving(false);
    setEditingId(null);
    load(true);
  };

  const filtered = certs.filter(c => !search || c.title?.toLowerCase().includes(search.toLowerCase()) || c.issuing_body?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search certifications…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none">
          <option value="">All Types</option>
          <option value="technical">Technical</option>
          <option value="professional">Professional</option>
          <option value="domain">Domain</option>
          <option value="compliance">Compliance</option>
          <option value="leadership">Leadership</option>
        </select>
        <button onClick={() => load(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
        <span className="text-xs text-gray-400">{total} total</span>
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Title</Th><Th>Issuing Body</Th><Th>Type</Th><Th>Prep Hrs</Th>
            <Th>Cost (₹)</Th><Th>Validity</Th><Th>Prestige</Th><Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? <LoadingRow cols={8} /> : filtered.length === 0 ? <EmptyRow cols={8} message="No certifications found" /> :
            filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <Td><span className="font-medium text-gray-800 text-xs">{c.title}</span></Td>
                <Td><span className="text-xs">{c.issuing_body}</span></Td>
                <Td><Badge text={c.type} color="#6C63FF" /></Td>
                <Td><span className="text-xs"><Clock size={9} className="inline mr-0.5" />{c.prep_hours_estimate}h</span></Td>
                <Td><span className="text-xs">{c.cost_inr === 0 ? <span className="text-green-600">Free</span> : `₹${Number(c.cost_inr).toLocaleString()}`}</span></Td>
                <Td><span className="text-xs">{c.validity_years ? `${c.validity_years}y` : 'Lifetime'}</span></Td>
                <Td>
                  {editingId === c.id ? (
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" max="100" value={editPrestige} onChange={e => setEditPrestige(e.target.value)}
                        className="w-16 text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none" />
                      <button onClick={() => handlePatchPrestige(c.id)} disabled={saving} className="text-green-600"><CheckCircle2 size={13} /></button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400"><XCircle size={13} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingId(c.id); setEditPrestige(String(c.prestige_score)); }}
                      className="flex items-center gap-1 text-xs hover:text-purple-600">
                      <Star size={10} className="text-amber-400" />{c.prestige_score}
                      <Edit2 size={10} className="opacity-40" />
                    </button>
                  )}
                </Td>
                <Td>
                  <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
                </Td>
              </tr>
            ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

// ── Projects Panel ─────────────────────────────────────────────────────────────
function ProjectsPanel() {
  const [projects, setProjects] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', ...(refresh ? { refresh: '1' } : {}), ...(filterType ? { type: filterType } : {}) });
      const r = await apiFetch(`/api/admin/lip/projects?${params}`);
      if (r.success) { setProjects(r.data.rows || []); setTotal(r.data.total || 0); }
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  const DIFF_LABELS: Record<number, string> = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced', 4: 'Expert' };
  const DIFF_COLORS: Record<number, string> = { 1: '#43C59E', 2: '#45AAF2', 3: '#F7B731', 4: '#FC5C65' };

  const filtered = projects.filter(p => !search || p.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none">
          <option value="">All Types</option>
          <option value="capstone">Capstone</option>
          <option value="portfolio">Portfolio</option>
          <option value="open_source">Open Source</option>
          <option value="case_study">Case Study</option>
          <option value="simulation">Simulation</option>
          <option value="freelance">Freelance</option>
        </select>
        <button onClick={() => load(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
        <span className="text-xs text-gray-400">{total} total</span>
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Title</Th><Th>Type</Th><Th>Hours</Th><Th>Difficulty</Th>
            <Th>Deliverable</Th><Th>Solo/Team</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? <LoadingRow cols={6} /> : filtered.length === 0 ? <EmptyRow cols={6} message="No projects found" /> :
            filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Td><span className="font-medium text-gray-800 text-xs">{p.title}</span></Td>
                <Td><Badge text={p.type?.replace(/_/g, ' ')} color="#6C63FF" /></Td>
                <Td><span className="text-xs"><Clock size={9} className="inline mr-0.5" />{p.duration_hours}h</span></Td>
                <Td><Badge text={DIFF_LABELS[p.difficulty_level] ?? p.difficulty_level} color={DIFF_COLORS[p.difficulty_level] ?? '#666'} /></Td>
                <Td><span className="text-xs">{p.deliverable?.replace(/_/g, ' ')}</span></Td>
                <Td><Badge text={p.solo_or_team} color="#45AAF2" /></Td>
              </tr>
            ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

// ── Mentors Panel ──────────────────────────────────────────────────────────────
function MentorsPanel() {
  const [mentors, setMentors] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStyle, setFilterStyle] = useState('');
  const [filterCost, setFilterCost] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', ...(refresh ? { refresh: '1' } : {}), ...(filterStyle ? { style: filterStyle } : {}), ...(filterCost ? { cost_model: filterCost } : {}) });
      const r = await apiFetch(`/api/admin/lip/mentors?${params}`);
      if (r.success) { setMentors(r.data.rows || []); setTotal(r.data.total || 0); }
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterStyle, filterCost]);

  useEffect(() => { load(); }, [load]);

  const toggleVerify = async (id: string, current: boolean) => {
    setSaving(id);
    await apiFetch(`/api/admin/lip/mentors/${id}`, { method: 'PATCH', body: JSON.stringify({ is_verified: !current }) });
    setSaving(null);
    load(true);
  };

  const filtered = mentors.filter(m =>
    !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mentors…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none" />
        </div>
        <select value={filterStyle} onChange={e => setFilterStyle(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none">
          <option value="">All Styles</option>
          <option value="coaching">Coaching</option>
          <option value="teaching">Teaching</option>
          <option value="sponsoring">Sponsoring</option>
          <option value="advising">Advising</option>
          <option value="peer">Peer</option>
        </select>
        <select value={filterCost} onChange={e => setFilterCost(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none">
          <option value="">All Cost Models</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
          <option value="company_sponsored">Company Sponsored</option>
        </select>
        <button onClick={() => load(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
        <span className="text-xs text-gray-400">{total} total</span>
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Name</Th><Th>Title</Th><Th>Style</Th><Th>Seniority</Th>
            <Th>Avail (h/mo)</Th><Th>Cost Model</Th><Th>Rating</Th><Th>Verified</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? <LoadingRow cols={8} /> : filtered.length === 0 ? <EmptyRow cols={8} message="No mentors found" /> :
            filtered.map(m => (
              <tr key={m.id} className="hover:bg-gray-50">
                <Td><span className="font-medium text-gray-800 text-xs">{m.name}</span></Td>
                <Td><span className="text-xs">{m.title}{m.company ? `, ${m.company}` : ''}</span></Td>
                <Td><Badge text={m.mentoring_style} color="#6C63FF" /></Td>
                <Td><span className="text-xs font-mono text-center">{m.seniority_level}/7</span></Td>
                <Td><span className="text-xs">{m.availability_hrs_month}h</span></Td>
                <Td>
                  <Badge text={m.cost_model?.replace(/_/g, ' ')}
                    color={m.cost_model === 'free' ? '#43C59E' : m.cost_model === 'paid' ? '#FC5C65' : '#F7B731'} />
                  {m.cost_per_hour_inr > 0 && <span className="text-[10px] text-gray-400 ml-1">₹{m.cost_per_hour_inr}/h</span>}
                </Td>
                <Td><span className="text-xs">⭐ {m.rating}</span></Td>
                <Td>
                  <button onClick={() => toggleVerify(m.id, m.is_verified)} disabled={saving === m.id}
                    className="flex items-center gap-1 text-xs transition-colors disabled:opacity-50"
                    style={{ color: m.is_verified ? '#43C59E' : '#9CA3AF' }}>
                    {m.is_verified ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {m.is_verified ? 'Verified' : 'Unverified'}
                  </button>
                </Td>
              </tr>
            ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

// ── Path Templates Panel ───────────────────────────────────────────────────────
function PathTemplatesPanel() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const r = await apiFetch(`/api/admin/lip/path-templates${refresh ? '?refresh=1' : ''}`);
      if (r.success) setTemplates(r.data ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const parsePhases = (t: any): any[] => {
    try { return JSON.parse(t.phases ?? '[]'); } catch { return []; }
  };

  const FOCUS_COLOR: Record<string, string> = {
    core_skills: '#6C63FF', technical_depth: '#45AAF2', specialization: '#F7B731',
    advanced: '#FC5C65', portfolio: '#43C59E', certification: '#FF6584', execution: '#8B5CF6', career_launch: '#0EA5E9',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">{templates.length} Path Templates</p>
          <p className="text-xs text-gray-400">Archetype-based templates drive the learning path builder engine</p>
        </div>
        <button onClick={() => load(true)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-all">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No templates found</div>
      ) : (
        <div className="space-y-2">
          {templates.map((t: any, idx: number) => {
            const phases = parsePhases(t);
            const isOpen = expanded === idx;
            return (
              <div key={t.id} className="rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
                <button onClick={() => setExpanded(isOpen ? null : idx)}
                  className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-gray-50 transition-all">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: '#6C63FF15' }}>
                    <Layout size={14} style={{ color: '#6C63FF' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{t.code}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500">
                    <span><Clock size={10} className="inline mr-0.5" />{t.estimated_total_hours}h</span>
                    <span>{t.estimated_weeks}w</span>
                    <span>{t.phase_count} phases</span>
                    <span className="text-gray-300">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                    <div className="space-y-2">
                      {phases.map((ph: any, pi: number) => (
                        <div key={pi} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                            style={{ backgroundColor: FOCUS_COLOR[ph.focus] ?? '#6C63FF' }}>
                            {pi + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700">{ph.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(ph.resource_type_sequence ?? []).map((r: string, ri: number) => (
                                <span key={ri} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-white border text-gray-500">
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 capitalize"
                            style={{ backgroundColor: `${FOCUS_COLOR[ph.focus] ?? '#6C63FF'}15`, color: FOCUS_COLOR[ph.focus] ?? '#6C63FF' }}>
                            {ph.focus?.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
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

// ── Readiness Weights Panel ─────────────────────────────────────────────────────
function ReadinessWeightsPanel() {
  const [weights, setWeights]   = useState<Record<string, number>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  const DIMS = [
    { key: 'motivation_weight',  label: 'Motivation',         desc: 'From WCL-0 motivation score' },
    { key: 'cognitive_weight',   label: 'Cognitive Readiness', desc: 'Median of top-10 competency scores' },
    { key: 'time_weight',        label: 'Time Availability',   desc: 'Login-days proxy (last 30 days)' },
    { key: 'support_weight',     label: 'Support Network',     desc: 'Mentor sessions + peer connections' },
    { key: 'prior_weight',       label: 'Prior Learning',      desc: 'Completed courses & certs' },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/api/admin/lip/readiness-weights');
      if (r.success && r.data) {
        const w: Record<string, number> = {};
        DIMS.forEach(d => { w[d.key] = Number(r.data[d.key] ?? 0); });
        setWeights(w);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  const totalRounded = Math.round(total * 100) / 100;
  const isValid = Math.abs(totalRounded - 1) < 0.011;

  const setW = (key: string, val: number) => {
    setSaved(false);
    setError('');
    setWeights(prev => ({ ...prev, [key]: Math.round(val * 1000) / 1000 }));
  };

  const save = async () => {
    if (!isValid) { setError(`Weights must sum to 1.00 (currently ${totalRounded.toFixed(3)})`); return; }
    setSaving(true);
    setError('');
    try {
      const r = await apiFetch('/api/admin/lip/readiness-weights', { method: 'PATCH', body: JSON.stringify(weights) });
      if (r.success) setSaved(true);
      else setError(r.error ?? 'Save failed');
    } catch { setError('Network error'); }
    setSaving(false);
  };

  const DIM_COLORS = ['#6C63FF', '#45AAF2', '#43C59E', '#F7B731', '#FF6584'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <p className="text-sm font-semibold text-gray-700">Learning Readiness Score (LRS) Weights</p>
        <p className="text-xs text-gray-400 mt-0.5">Five dimensions compose the 0–100 LRS. Weights must sum to exactly 1.00.</p>
      </div>

      <div className="space-y-5">
        {DIMS.map((dim, i) => {
          const val = weights[dim.key] ?? 0;
          const pct = Math.round(val * 100);
          const color = DIM_COLORS[i];
          return (
            <div key={dim.key}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-sm font-semibold text-gray-700">{dim.label}</span>
                  <p className="text-[10px] text-gray-400">{dim.desc}</p>
                </div>
                <span className="text-sm font-bold tabular-nums" style={{ color }}>{pct}%</span>
              </div>
              <input
                type="range" min={0} max={100} step={1} value={pct}
                onChange={e => setW(dim.key, Number(e.target.value) / 100)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: color }}
              />
            </div>
          );
        })}
      </div>

      {/* Sum indicator */}
      <div className={`flex items-center gap-2 rounded-xl p-3 text-sm font-medium ${isValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
        {isValid ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
        Total: {(totalRounded * 100).toFixed(1)}% {isValid ? '✓ Valid' : `(need 100%)`}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {saved && <p className="text-xs text-green-600">✓ Weights saved successfully. LRS will recalculate on next user session.</p>}

      <button onClick={save} disabled={saving || !isValid}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
        style={{ backgroundColor: '#6C63FF' }}>
        <Save size={13} /> {saving ? 'Saving…' : 'Save Weights'}
      </button>
    </div>
  );
}

// ── Analytics Panel ────────────────────────────────────────────────────────────
function AnalyticsPanel() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const r = await apiFetch(`/api/admin/lip/stats${refresh ? '?refresh=1' : ''}`);
      if (r.success) setStats(r.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  const gapDist: any[] = stats?.gap_severity_distribution ?? [];
  const bandDist: any[] = stats?.readiness_band_distribution ?? [];
  const topCourses: any[] = stats?.top_10_recommended_courses ?? [];

  const BAND_COLORS: Record<string, string> = { low: '#FC5C65', moderate: '#F7B731', good: '#45AAF2', high: '#43C59E' };
  const SEV_COLORS: Record<string, string> = { critical: '#FC5C65', major: '#FF6584', moderate: '#F7B731', minor: '#43C59E' };

  const maxGap = Math.max(...gapDist.map(r => Number(r.cnt)), 1);
  const maxBand = Math.max(...bandDist.map(r => Number(r.cnt)), 1);

  return (
    <div className="space-y-6">
      {/* Top-line metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4 text-center" style={{ borderColor: '#E5E7EB' }}>
          <p className="text-2xl font-bold text-gray-800">{stats?.users_with_paths ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">Users with paths</p>
        </div>
        <div className="rounded-xl border p-4 text-center" style={{ borderColor: '#E5E7EB' }}>
          <p className="text-2xl font-bold text-gray-800">{stats?.avg_readiness_score ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">Avg readiness score</p>
        </div>
        <div className="rounded-xl border p-4 text-center col-span-2 sm:col-span-1" style={{ borderColor: '#E5E7EB' }}>
          <p className="text-2xl font-bold text-gray-800">{topCourses.reduce((s: number, r: any) => s + Number(r.cnt), 0)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total resource recommendations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Gap severity chart */}
        <div className="rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Gap Severity Distribution</h4>
          {gapDist.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No data yet</p>
          ) : (
            <div className="space-y-2.5">
              {gapDist.map(r => (
                <div key={r.gap_severity}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="capitalize text-gray-600">{r.gap_severity}</span>
                    <span className="font-semibold text-gray-800">{r.cnt}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${(Number(r.cnt) / maxGap) * 100}%`, backgroundColor: SEV_COLORS[r.gap_severity] ?? '#666' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Readiness band chart */}
        <div className="rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Readiness Band Distribution</h4>
          {bandDist.length === 0 ? (
            <div className="flex items-center gap-2 py-4 justify-center text-xs text-gray-400">
              <AlertTriangle size={13} />
              <span>Suppressed (k &lt; 10 users per band)</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {['high','good','moderate','low'].map(band => {
                const row = bandDist.find(r => r.readiness_band === band);
                return (
                  <div key={band}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="capitalize text-gray-600">{band}</span>
                      <span className="font-semibold text-gray-800">{row?.cnt ?? '—'}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all"
                        style={{ width: row ? `${(Number(row.cnt) / maxBand) * 100}%` : '0%', backgroundColor: BAND_COLORS[band] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top-10 courses */}
      <div className="rounded-xl border p-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">Top 10 Recommended Courses</h4>
          <button onClick={() => load(true)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
        {topCourses.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No recommendation data yet</p>
        ) : (
          <div className="space-y-2">
            {topCourses.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{c.title}</p>
                  <p className="text-[10px] text-gray-400">{c.provider}</p>
                </div>
                <span className="text-xs font-semibold text-purple-600 shrink-0">{c.cnt}×</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────
export default function LIPDesignPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('courses');

  const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'courses',           label: 'Courses',          icon: <BookOpen size={13} /> },
    { id: 'certifications',    label: 'Certifications',   icon: <Award size={13} /> },
    { id: 'projects',          label: 'Projects',         icon: <Briefcase size={13} /> },
    { id: 'mentors',           label: 'Mentors',          icon: <Users size={13} /> },
    { id: 'path-templates',    label: 'Path Templates',   icon: <Layout size={13} /> },
    { id: 'readiness-weights', label: 'LRS Weights',      icon: <SlidersHorizontal size={13} /> },
    { id: 'analytics',         label: 'Analytics',        icon: <BarChart3 size={13} /> },
  ];

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#6C63FF' }}>
          <TrendingUp size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Learning Intelligence Platform</h2>
          <p className="text-xs text-gray-400">Manage courses, certifications, projects, mentors, path templates, LRS weights and analytics</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-0.5 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px whitespace-nowrap ${activeTab === t.id ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-96">
        {activeTab === 'courses'           && <CoursesPanel />}
        {activeTab === 'certifications'    && <CertificationsPanel />}
        {activeTab === 'projects'          && <ProjectsPanel />}
        {activeTab === 'mentors'           && <MentorsPanel />}
        {activeTab === 'path-templates'    && <PathTemplatesPanel />}
        {activeTab === 'readiness-weights' && <ReadinessWeightsPanel />}
        {activeTab === 'analytics'         && <AnalyticsPanel />}
      </div>
    </div>
  );
}
