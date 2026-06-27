import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Target, Network, BookOpen, Gauge, Plus, Trash2, Edit3, X,
  CheckCircle, Circle, Info, Compass, TrendingUp, ShieldCheck, MessageSquare,
} from 'lucide-react';

// ─── Persistence keys ─────────────────────────────────────────────────────────
const LS_TEAM         = 'mx-leadership-team';
const LS_STAKEHOLDERS = 'mx-leadership-stakeholders';

// ─── Types ────────────────────────────────────────────────────────────────────
type LeadershipSubTab = 'readiness' | 'team' | 'stakeholders' | 'playbook';
type ReportStatus = 'Thriving' | 'Steady' | 'Needs Support' | 'At Risk';
type Influence = 'High' | 'Medium' | 'Low';
type Alignment = 'Aligned' | 'Neutral' | 'Resistant';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  focus: string;
  status: ReportStatus;
}

interface Stakeholder {
  id: string;
  name: string;
  relationship: string;
  influence: Influence;
  alignment: Alignment;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function ls<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }
function authHeader(): Record<string, string> {
  try { const t = localStorage.getItem('metryx_token'); return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────
const LEADERSHIP_TABS = [
  { id: 'readiness'    as LeadershipSubTab, label: 'Leadership Readiness', icon: <Gauge size={14} /> },
  { id: 'team'         as LeadershipSubTab, label: 'Team Roster',          icon: <Users size={14} /> },
  { id: 'stakeholders' as LeadershipSubTab, label: 'Stakeholder Map',      icon: <Network size={14} /> },
  { id: 'playbook'     as LeadershipSubTab, label: 'Leadership Playbook',  icon: <BookOpen size={14} /> },
];

// ══════════════════════════════════════════════════════════════════════════════
// LEADERSHIP READINESS
// ══════════════════════════════════════════════════════════════════════════════

function LeadershipReadiness({ profile, team, stakeholders }: { profile: any; team: TeamMember[]; stakeholders: Stakeholder[] }) {
  const checks = [
    { label: 'Profile reflects current leadership role', done: !!(profile?.personal?.title || profile?.targetRole),      pts: 10 },
    { label: 'Competency assessment completed',           done: !!profile?.competencyProfile?.assessmentDone,             pts: 15 },
    { label: 'Direct reports mapped (2+)',                done: team.length >= 2,                                          pts: 15 },
    { label: 'A team member flagged for support',         done: team.some(t => t.status === 'Needs Support' || t.status === 'At Risk'), pts: 10 },
    { label: 'Key stakeholders mapped (3+)',              done: stakeholders.length >= 3,                                  pts: 15 },
    { label: 'A high-influence stakeholder identified',   done: stakeholders.some(s => s.influence === 'High'),            pts: 10 },
    { label: 'A development goal is set',                 done: !!profile?.targetRole,                                     pts: 10 },
    { label: 'Resume reflects leadership impact',         done: !!profile?.resumeBuilt,                                    pts: 15 },
  ];

  const earned = checks.filter(c => c.done).reduce((s, c) => s + c.pts, 0);
  const total  = checks.reduce((s, c) => s + c.pts, 0);
  const score  = Math.round((earned / total) * 100);
  const pct    = (earned / total) * 100;

  const tier = score >= 80 ? { label: 'Leading Strong', color: BRAND.green } :
               score >= 55 ? { label: 'Building Influence', color: BRAND.orange } :
               { label: 'Establishing Foundations', color: BRAND.purple };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Leadership Readiness</h2>
        <p className="text-xs text-gray-400 mt-0.5">A developmental snapshot of how set up you are to lead a team and influence your organisation — never a performance rating.</p>
      </div>

      {/* Score Card */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: BRAND.purple }}>
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10 bg-white" />
        <div className="relative flex items-center gap-8">
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
            <p className="text-white/60 text-xs mt-1">{checks.filter(c => !c.done).length} areas left to strengthen</p>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {checks.map((c, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${c.done ? 'bg-violet-50 border-violet-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${c.done ? 'bg-violet-500' : 'bg-gray-200'}`}>
              {c.done ? <CheckCircle size={14} className="text-white" /> : <Circle size={14} className="text-gray-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${c.done ? 'text-violet-800' : 'text-gray-600'}`}>{c.label}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.done ? 'bg-violet-100 text-violet-700' : 'bg-gray-200 text-gray-500'}`}>
              +{c.pts}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4 border border-violet-100 bg-violet-50 flex gap-3">
        <Info size={16} className="text-violet-500 mt-0.5 shrink-0" />
        <p className="text-xs text-violet-700">
          <strong>Leadership tip:</strong> Map your team and your key stakeholders first — clarity on who you lead and who you
          need to influence is the foundation every other leadership move builds on.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEAM ROSTER
// ══════════════════════════════════════════════════════════════════════════════

const STATUS_BADGE: Record<ReportStatus, string> = {
  'Thriving':      'bg-teal-100 text-teal-700',
  'Steady':        'bg-blue-100 text-blue-700',
  'Needs Support': 'bg-yellow-100 text-yellow-700',
  'At Risk':       'bg-red-100 text-red-700',
};
const REPORT_STATUSES: ReportStatus[] = ['Thriving', 'Steady', 'Needs Support', 'At Risk'];
const BLANK_MEMBER: Omit<TeamMember, 'id'> = { name: '', role: '', focus: '', status: 'Steady' };

function TeamRoster({ team, setTeam }: { team: TeamMember[]; setTeam: (t: TeamMember[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<TeamMember, 'id'>>(BLANK_MEMBER);
  const [editing, setEditing] = useState<string | null>(null);

  const save = () => {
    if (!form.name || !form.role) return;
    const updated = editing
      ? team.map(m => m.id === editing ? { ...form, id: editing } : m)
      : [{ ...form, id: uid() }, ...team];
    setTeam(updated);
    setShowForm(false); setEditing(null); setForm(BLANK_MEMBER);
  };
  const del = (id: string) => { const u = team.filter(m => m.id !== id); setTeam(u); };
  const startEdit = (m: TeamMember) => {
    setForm({ name: m.name, role: m.role, focus: m.focus, status: m.status });
    setEditing(m.id); setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Team Roster</h2>
          <p className="text-xs text-gray-400 mt-0.5">{team.length} report{team.length !== 1 ? 's' : ''} · {team.filter(m => m.status === 'Needs Support' || m.status === 'At Risk').length} needing attention</p>
        </div>
        <button onClick={() => { setForm(BLANK_MEMBER); setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm"
          style={{ backgroundColor: BRAND.purple }}>
          <Plus size={13} /> Add Member
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-gray-200 p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">{editing ? 'Edit Member' : 'Add Team Member'}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name"
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs" />
            <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Role / title"
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs" />
            <input value={form.focus} onChange={e => setForm({ ...form, focus: e.target.value })} placeholder="Current focus / project"
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs sm:col-span-2" />
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ReportStatus })}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs">
              {REPORT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button onClick={save} className="text-xs font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: BRAND.purple }}>
            {editing ? 'Save Changes' : 'Add Member'}
          </button>
        </div>
      )}

      {team.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No team members yet</p>
          <p className="text-xs mt-1">Add the people you lead to start tracking their growth</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {team.map(m => (
            <div key={m.id} className="rounded-2xl border border-gray-200 p-4 bg-white">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                  <p className="text-xs text-gray-500 truncate">{m.role}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[m.status]}`}>{m.status}</span>
              </div>
              {m.focus && <p className="text-xs text-gray-500 mt-2"><span className="text-gray-400">Focus:</span> {m.focus}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => startEdit(m)} className="text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1"><Edit3 size={12} /> Edit</button>
                <button onClick={() => del(m.id)} className="text-[11px] text-red-400 hover:text-red-600 flex items-center gap-1"><Trash2 size={12} /> Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STAKEHOLDER MAP
// ══════════════════════════════════════════════════════════════════════════════

const INFLUENCES: Influence[] = ['High', 'Medium', 'Low'];
const ALIGNMENTS: Alignment[] = ['Aligned', 'Neutral', 'Resistant'];
const INFLUENCE_COLOR: Record<Influence, string> = { High: BRAND.red, Medium: BRAND.orange, Low: '#94a3b8' };
const ALIGNMENT_BADGE: Record<Alignment, string> = {
  Aligned:   'bg-teal-100 text-teal-700',
  Neutral:   'bg-gray-100 text-gray-600',
  Resistant: 'bg-red-100 text-red-700',
};
const BLANK_STAKEHOLDER: Omit<Stakeholder, 'id'> = { name: '', relationship: '', influence: 'Medium', alignment: 'Neutral' };

function StakeholderMap({ stakeholders, setStakeholders }: { stakeholders: Stakeholder[]; setStakeholders: (s: Stakeholder[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Stakeholder, 'id'>>(BLANK_STAKEHOLDER);
  const [editing, setEditing] = useState<string | null>(null);

  const save = () => {
    if (!form.name || !form.relationship) return;
    const updated = editing
      ? stakeholders.map(s => s.id === editing ? { ...form, id: editing } : s)
      : [{ ...form, id: uid() }, ...stakeholders];
    setStakeholders(updated);
    setShowForm(false); setEditing(null); setForm(BLANK_STAKEHOLDER);
  };
  const del = (id: string) => { const u = stakeholders.filter(s => s.id !== id); setStakeholders(u); };
  const startEdit = (s: Stakeholder) => {
    setForm({ name: s.name, relationship: s.relationship, influence: s.influence, alignment: s.alignment });
    setEditing(s.id); setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Stakeholder Map</h2>
          <p className="text-xs text-gray-400 mt-0.5">{stakeholders.length} stakeholder{stakeholders.length !== 1 ? 's' : ''} · {stakeholders.filter(s => s.influence === 'High').length} high-influence</p>
        </div>
        <button onClick={() => { setForm(BLANK_STAKEHOLDER); setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm"
          style={{ backgroundColor: BRAND.purple }}>
          <Plus size={13} /> Add Stakeholder
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-gray-200 p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">{editing ? 'Edit Stakeholder' : 'Add Stakeholder'}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name"
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs" />
            <input value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })} placeholder="Relationship (e.g. VP Sales, peer)"
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs" />
            <select value={form.influence} onChange={e => setForm({ ...form, influence: e.target.value as Influence })}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs">
              {INFLUENCES.map(i => <option key={i} value={i}>{i} influence</option>)}
            </select>
            <select value={form.alignment} onChange={e => setForm({ ...form, alignment: e.target.value as Alignment })}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs">
              {ALIGNMENTS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button onClick={save} className="text-xs font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: BRAND.purple }}>
            {editing ? 'Save Changes' : 'Add Stakeholder'}
          </button>
        </div>
      )}

      {stakeholders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Network size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No stakeholders mapped yet</p>
          <p className="text-xs mt-1">Map the people whose support you need to drive outcomes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stakeholders.map(s => (
            <div key={s.id} className="rounded-2xl border border-gray-200 p-4 bg-white">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                  <p className="text-xs text-gray-500 truncate">{s.relationship}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ALIGNMENT_BADGE[s.alignment]}`}>{s.alignment}</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: INFLUENCE_COLOR[s.influence] }}>
                  {s.influence} influence
                </span>
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => startEdit(s)} className="text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1"><Edit3 size={12} /> Edit</button>
                  <button onClick={() => del(s.id)} className="text-[11px] text-red-400 hover:text-red-600 flex items-center gap-1"><Trash2 size={12} /> Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LEADERSHIP PLAYBOOK
// ══════════════════════════════════════════════════════════════════════════════

interface PlaySection {
  id: string; title: string; icon: React.ReactNode; color: string;
  items: { label: string; detail: string }[];
}

const PLAYBOOK: PlaySection[] = [
  {
    id: 'first-90', title: 'Leading a New Team', icon: <Compass size={16} />, color: BRAND.purple,
    items: [
      { label: 'Run listening 1:1s in week one', detail: 'Ask each person what is working, what is broken, and what they need from you — before changing anything.' },
      { label: 'Diagnose before you prescribe', detail: 'Map the team\'s real strengths and gaps against the goals you own. Avoid importing the playbook from your last team wholesale.' },
      { label: 'Name a few early priorities', detail: 'Pick 2–3 things the team can rally around in the first quarter. Clarity beats a long ambiguous list.' },
      { label: 'Establish your operating rhythm', detail: 'Set the cadence for 1:1s, team meetings, and decision reviews so people know how and when work moves.' },
    ],
  },
  {
    id: 'develop', title: 'Developing People', icon: <TrendingUp size={16} />, color: BRAND.green,
    items: [
      { label: 'Delegate outcomes, not tasks', detail: 'Give people the goal and the constraints, then let them own the how. Over-specifying caps their growth.' },
      { label: 'Give feedback close to the moment', detail: 'Specific, timely, and balanced. Tie it to impact, not personality.' },
      { label: 'Build a growth path for each report', detail: 'Know what each person wants next and create stretch assignments that move them toward it.' },
      { label: 'Spot and support the strugglers early', detail: 'A report flagged "Needs Support" needs a concrete plan and a check-in date, not just sympathy.' },
    ],
  },
  {
    id: 'influence', title: 'Influence & Stakeholders', icon: <Network size={16} />, color: BRAND.accent,
    items: [
      { label: 'Map influence and alignment', detail: 'Know who has weight on your outcomes and where they stand. Invest most where influence is high and alignment is low.' },
      { label: 'Communicate up in their language', detail: 'Frame your asks in terms of the outcomes your leaders care about — risk, revenue, speed — not your internal detail.' },
      { label: 'Build coalitions before big decisions', detail: 'Pre-wire support one conversation at a time so the room is already aligned when the decision is made.' },
      { label: 'Manage disagreement openly', detail: 'Surface resistance early and address it directly — silent resistance is the most expensive kind.' },
    ],
  },
  {
    id: 'execution', title: 'Driving Execution', icon: <ShieldCheck size={16} />, color: BRAND.orange,
    items: [
      { label: 'Make priorities visible', detail: 'If everything is a priority, nothing is. Keep a short, ranked list the team can see.' },
      { label: 'Create accountability without fear', detail: 'Clear owners, clear dates, regular check-ins — psychological safety and accountability are not opposites.' },
      { label: 'Protect the team\'s focus', detail: 'Shield your team from thrash and conflicting asks so they can finish what matters.' },
      { label: 'Review and adjust', detail: 'Run honest retrospectives. Celebrate progress, name what is off-track, and adjust the plan.' },
    ],
  },
];

function LeadershipPlaybook() {
  const [open, setOpen] = useState<string | null>(PLAYBOOK[0].id);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Leadership Playbook</h2>
        <p className="text-xs text-gray-400 mt-0.5">Practical guidance for the transitions and challenges senior leaders face.</p>
      </div>
      <div className="space-y-3">
        {PLAYBOOK.map(sec => {
          const isOpen = open === sec.id;
          return (
            <div key={sec.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : sec.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: sec.color }}>{sec.icon}</div>
                <span className="text-sm font-semibold text-gray-800 flex-1">{sec.title}</span>
                <span className="text-xs text-gray-400">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  {sec.items.map((it, i) => (
                    <div key={i} className="pl-11">
                      <p className="text-xs font-semibold text-gray-800">{it.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{it.detail}</p>
                    </div>
                  ))}
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

interface LeadershipStudioTabProps {
  profile: any;
}

export function LeadershipStudioTab({ profile }: LeadershipStudioTabProps) {
  const [subTab, setSubTab] = useState<LeadershipSubTab>('readiness');
  const [team, setTeam] = useState<TeamMember[]>(() => ls(LS_TEAM, []));
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>(() => ls(LS_STAKEHOLDERS, []));
  // Server persistence is gated by the careerLaunchpad flag. When the GET below
  // 503s (flag OFF / unauthenticated), serverEnabled stays false and the tab
  // behaves byte-identically to the legacy localStorage-only flow.
  const serverEnabled = useRef(false);

  // Load the trackers from the server so they follow the user across devices.
  // If the server has no data yet but localStorage does, migrate it up once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/career/studio-data', { headers: authHeader() as HeadersInit, credentials: 'include' });
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled || !j?.enabled) return;
        serverEnabled.current = true;
        const srvTeam: TeamMember[] = Array.isArray(j?.leadership?.team) ? j.leadership.team : [];
        const srvStake: Stakeholder[] = Array.isArray(j?.leadership?.stakeholders) ? j.leadership.stakeholders : [];
        if (srvTeam.length || srvStake.length) {
          setTeam(srvTeam); setStakeholders(srvStake);
          lsSet(LS_TEAM, srvTeam); lsSet(LS_STAKEHOLDERS, srvStake);
        } else {
          const localTeam = ls<TeamMember[]>(LS_TEAM, []);
          const localStake = ls<Stakeholder[]>(LS_STAKEHOLDERS, []);
          if (localTeam.length || localStake.length) {
            void persist({ team: localTeam, stakeholders: localStake });
          }
        }
      } catch { /* offline → localStorage only */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = (patch: { team?: TeamMember[]; stakeholders?: Stakeholder[] }) => {
    if (!serverEnabled.current) return;
    fetch('/api/career/studio-data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authHeader() as Record<string, string>) },
      credentials: 'include',
      body: JSON.stringify({ leadership: patch }),
    }).catch(() => {});
  };

  const updateTeam = (t: TeamMember[]) => { setTeam(t); lsSet(LS_TEAM, t); persist({ team: t }); };
  const updateStakeholders = (s: Stakeholder[]) => { setStakeholders(s); lsSet(LS_STAKEHOLDERS, s); persist({ stakeholders: s }); };

  return (
    <div className="space-y-0" data-testid="tab-leadership-studio">
      {/* Header */}
      <div className="rounded-2xl p-5 mb-5 relative overflow-hidden" style={{ background: BRAND.purple, border: `1px solid ${BRAND.purple}20` }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white" style={{ background: 'rgba(255,255,255,0.18)' }}>
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Leadership Studio</h1>
            <p className="text-xs text-white/80 mt-0.5">Tools for senior leaders — develop your team, map your stakeholders, and sharpen the way you lead.</p>
          </div>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        {LEADERSHIP_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            data-testid={`subtab-leadership-${t.id}`}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-colors"
            style={subTab === t.id
              ? { backgroundColor: BRAND.purple, color: 'white', borderColor: 'transparent' }
              : { color: '#6b7280', borderColor: '#e5e7eb', background: 'white' }}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'readiness'    && <LeadershipReadiness profile={profile} team={team} stakeholders={stakeholders} />}
      {subTab === 'team'         && <TeamRoster team={team} setTeam={updateTeam} />}
      {subTab === 'stakeholders' && <StakeholderMap stakeholders={stakeholders} setStakeholders={updateStakeholders} />}
      {subTab === 'playbook'     && <LeadershipPlaybook />}
    </div>
  );
}
