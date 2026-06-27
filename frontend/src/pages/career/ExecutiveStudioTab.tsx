import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useRef } from 'react';
import {
  Briefcase, Target, BookOpen, Gauge, Plus, Trash2, Edit3, X,
  CheckCircle, Circle, Info, Crown, TrendingUp, ShieldCheck, Landmark,
  Flag, Compass,
} from 'lucide-react';

// ─── Persistence keys ─────────────────────────────────────────────────────────
const LS_PRIORITIES = 'mx-executive-priorities';
const LS_BOARD      = 'mx-executive-board';

// ─── Types ────────────────────────────────────────────────────────────────────
type ExecSubTab = 'readiness' | 'priorities' | 'board' | 'playbook';
type Horizon = 'This Quarter' | 'This Year' | 'Multi-Year';
type PriorityHealth = 'On Track' | 'At Risk' | 'Off Track';
type BoardType = 'Board Member' | 'Investor' | 'Exec Peer' | 'Advisor' | 'Key Partner';

interface StrategicPriority {
  id: string;
  title: string;
  objective: string;
  horizon: Horizon;
  health: PriorityHealth;
  progress: number; // 0-100
}

interface BoardContact {
  id: string;
  name: string;
  role: string;
  type: BoardType;
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
const EXEC_TABS = [
  { id: 'readiness'  as ExecSubTab, label: 'Executive Readiness', icon: <Gauge size={14} /> },
  { id: 'priorities' as ExecSubTab, label: 'Strategic Priorities', icon: <Target size={14} /> },
  { id: 'board'      as ExecSubTab, label: 'Board & Stakeholders', icon: <Landmark size={14} /> },
  { id: 'playbook'   as ExecSubTab, label: 'Executive Playbook',  icon: <BookOpen size={14} /> },
];

const EXEC_NAVY = BRAND.navy;

// ══════════════════════════════════════════════════════════════════════════════
// EXECUTIVE READINESS
// ══════════════════════════════════════════════════════════════════════════════

function ExecutiveReadiness({ profile, priorities, board }: { profile: any; priorities: StrategicPriority[]; board: BoardContact[] }) {
  const checks = [
    { label: 'Profile reflects executive scope',          done: !!(profile?.personal?.title || profile?.targetRole),       pts: 10 },
    { label: 'Competency assessment completed',           done: !!profile?.competencyProfile?.assessmentDone,              pts: 10 },
    { label: 'Strategic priorities defined (3+)',         done: priorities.length >= 3,                                    pts: 20 },
    { label: 'Each priority has a clear objective',       done: priorities.length > 0 && priorities.every(p => !!p.objective), pts: 10 },
    { label: 'A multi-year horizon priority exists',      done: priorities.some(p => p.horizon === 'Multi-Year'),          pts: 10 },
    { label: 'Off-track priorities are visible',          done: priorities.some(p => p.health !== 'On Track') || priorities.length === 0, pts: 10 },
    { label: 'Board / stakeholder network mapped (3+)',   done: board.length >= 3,                                         pts: 15 },
    { label: 'Executive narrative built (resume)',        done: !!profile?.resumeBuilt,                                    pts: 15 },
  ];

  const earned = checks.filter(c => c.done).reduce((s, c) => s + c.pts, 0);
  const total  = checks.reduce((s, c) => s + c.pts, 0);
  const score  = Math.round((earned / total) * 100);
  const pct    = (earned / total) * 100;

  const tier = score >= 80 ? { label: 'Operating at Scale', color: BRAND.green } :
               score >= 55 ? { label: 'Sharpening Focus', color: BRAND.orange } :
               { label: 'Setting the Agenda', color: BRAND.accent };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Executive Readiness</h2>
        <p className="text-xs text-gray-400 mt-0.5">A developmental view of how clearly your strategic agenda and stakeholder network are set up — never a performance verdict.</p>
      </div>

      {/* Score Card */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: EXEC_NAVY }}>
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10 bg-white" />
        <div className="relative flex items-center gap-8">
          <div className="relative w-28 h-28 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={BRAND.accent} strokeWidth="10"
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
            <p className="text-white/60 text-xs mt-1">{checks.filter(c => !c.done).length} areas left to sharpen</p>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {checks.map((c, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${c.done ? 'bg-slate-50 border-slate-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: c.done ? EXEC_NAVY : '#e5e7eb' }}>
              {c.done ? <CheckCircle size={14} className="text-white" /> : <Circle size={14} className="text-gray-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${c.done ? 'text-slate-800' : 'text-gray-600'}`}>{c.label}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.done ? 'bg-slate-200 text-slate-700' : 'bg-gray-200 text-gray-500'}`}>
              +{c.pts}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4 border border-slate-200 bg-slate-50 flex gap-3">
        <Info size={16} className="mt-0.5 shrink-0" style={{ color: EXEC_NAVY }} />
        <p className="text-xs text-slate-700">
          <strong>Executive tip:</strong> Your leverage comes from a short, clear strategic agenda and the network that can move it.
          Define your priorities and map the board and stakeholders who decide their fate.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STRATEGIC PRIORITIES
// ══════════════════════════════════════════════════════════════════════════════

const HORIZONS: Horizon[] = ['This Quarter', 'This Year', 'Multi-Year'];
const HEALTHS: PriorityHealth[] = ['On Track', 'At Risk', 'Off Track'];
const HEALTH_BADGE: Record<PriorityHealth, string> = {
  'On Track':  'bg-teal-100 text-teal-700',
  'At Risk':   'bg-yellow-100 text-yellow-700',
  'Off Track': 'bg-red-100 text-red-700',
};
const HEALTH_BAR: Record<PriorityHealth, string> = {
  'On Track':  BRAND.green,
  'At Risk':   BRAND.orange,
  'Off Track': BRAND.red,
};
const BLANK_PRIORITY: Omit<StrategicPriority, 'id'> = { title: '', objective: '', horizon: 'This Quarter', health: 'On Track', progress: 0 };

function StrategicPriorities({ priorities, setPriorities }: { priorities: StrategicPriority[]; setPriorities: (p: StrategicPriority[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<StrategicPriority, 'id'>>(BLANK_PRIORITY);
  const [editing, setEditing] = useState<string | null>(null);

  const save = () => {
    if (!form.title) return;
    const clamped = { ...form, progress: Math.max(0, Math.min(100, Number(form.progress) || 0)) };
    const updated = editing
      ? priorities.map(p => p.id === editing ? { ...clamped, id: editing } : p)
      : [{ ...clamped, id: uid() }, ...priorities];
    setPriorities(updated);
    setShowForm(false); setEditing(null); setForm(BLANK_PRIORITY);
  };
  const del = (id: string) => { const u = priorities.filter(p => p.id !== id); setPriorities(u); };
  const startEdit = (p: StrategicPriority) => {
    setForm({ title: p.title, objective: p.objective, horizon: p.horizon, health: p.health, progress: p.progress });
    setEditing(p.id); setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Strategic Priorities</h2>
          <p className="text-xs text-gray-400 mt-0.5">{priorities.length} priorit{priorities.length !== 1 ? 'ies' : 'y'} · {priorities.filter(p => p.health !== 'On Track').length} needing attention</p>
        </div>
        <button onClick={() => { setForm(BLANK_PRIORITY); setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm"
          style={{ backgroundColor: EXEC_NAVY }}>
          <Plus size={13} /> Add Priority
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-gray-200 p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">{editing ? 'Edit Priority' : 'Add Strategic Priority'}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Priority title"
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs sm:col-span-2" />
            <input value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })} placeholder="Measurable objective / key result"
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs sm:col-span-2" />
            <select value={form.horizon} onChange={e => setForm({ ...form, horizon: e.target.value as Horizon })}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs">
              {HORIZONS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <select value={form.health} onChange={e => setForm({ ...form, health: e.target.value as PriorityHealth })}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs">
              {HEALTHS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <div className="sm:col-span-2">
              <label className="text-[11px] text-gray-500">Progress: {form.progress}%</label>
              <input type="range" min={0} max={100} value={form.progress}
                onChange={e => setForm({ ...form, progress: Number(e.target.value) })} className="w-full" />
            </div>
          </div>
          <button onClick={save} className="text-xs font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: EXEC_NAVY }}>
            {editing ? 'Save Changes' : 'Add Priority'}
          </button>
        </div>
      )}

      {priorities.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Target size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No strategic priorities yet</p>
          <p className="text-xs mt-1">Define the handful of outcomes that define your agenda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {priorities.map(p => (
            <div key={p.id} className="rounded-2xl border border-gray-200 p-4 bg-white">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{p.title}</p>
                  {p.objective && <p className="text-xs text-gray-500 mt-0.5">{p.objective}</p>}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${HEALTH_BADGE[p.health]}`}>{p.health}</span>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{p.horizon}</span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${p.progress}%`, backgroundColor: HEALTH_BAR[p.health] }} />
                </div>
                <span className="text-[10px] text-gray-400 w-8 text-right">{p.progress}%</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => startEdit(p)} className="text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1"><Edit3 size={12} /> Edit</button>
                <button onClick={() => del(p.id)} className="text-[11px] text-red-400 hover:text-red-600 flex items-center gap-1"><Trash2 size={12} /> Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BOARD & STAKEHOLDERS
// ══════════════════════════════════════════════════════════════════════════════

const BOARD_TYPES: BoardType[] = ['Board Member', 'Investor', 'Exec Peer', 'Advisor', 'Key Partner'];
const BOARD_BADGE: Record<BoardType, string> = {
  'Board Member': 'bg-indigo-100 text-indigo-700',
  'Investor':     'bg-teal-100 text-teal-700',
  'Exec Peer':    'bg-blue-100 text-blue-700',
  'Advisor':      'bg-violet-100 text-violet-700',
  'Key Partner':  'bg-amber-100 text-amber-700',
};
const BLANK_BOARD: Omit<BoardContact, 'id'> = { name: '', role: '', type: 'Board Member' };

function BoardStakeholders({ board, setBoard }: { board: BoardContact[]; setBoard: (b: BoardContact[]) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<BoardContact, 'id'>>(BLANK_BOARD);
  const [editing, setEditing] = useState<string | null>(null);

  const save = () => {
    if (!form.name || !form.role) return;
    const updated = editing
      ? board.map(b => b.id === editing ? { ...form, id: editing } : b)
      : [{ ...form, id: uid() }, ...board];
    setBoard(updated);
    setShowForm(false); setEditing(null); setForm(BLANK_BOARD);
  };
  const del = (id: string) => { const u = board.filter(b => b.id !== id); setBoard(u); };
  const startEdit = (b: BoardContact) => {
    setForm({ name: b.name, role: b.role, type: b.type });
    setEditing(b.id); setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Board &amp; Stakeholders</h2>
          <p className="text-xs text-gray-400 mt-0.5">{board.length} relationship{board.length !== 1 ? 's' : ''} across your governance and partner network</p>
        </div>
        <button onClick={() => { setForm(BLANK_BOARD); setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl text-white shadow-sm"
          style={{ backgroundColor: EXEC_NAVY }}>
          <Plus size={13} /> Add Contact
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-gray-200 p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">{editing ? 'Edit Contact' : 'Add Contact'}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name"
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs" />
            <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Role / organisation"
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs" />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as BoardType })}
              className="h-9 px-3 rounded-lg border border-gray-200 text-xs sm:col-span-2">
              {BOARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={save} className="text-xs font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: EXEC_NAVY }}>
            {editing ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      )}

      {board.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Landmark size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No contacts mapped yet</p>
          <p className="text-xs mt-1">Map your board, investors, peers, and key partners</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {board.map(b => (
            <div key={b.id} className="rounded-2xl border border-gray-200 p-4 bg-white">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{b.name}</p>
                  <p className="text-xs text-gray-500 truncate">{b.role}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${BOARD_BADGE[b.type]}`}>{b.type}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => startEdit(b)} className="text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1"><Edit3 size={12} /> Edit</button>
                <button onClick={() => del(b.id)} className="text-[11px] text-red-400 hover:text-red-600 flex items-center gap-1"><Trash2 size={12} /> Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXECUTIVE PLAYBOOK
// ══════════════════════════════════════════════════════════════════════════════

interface PlaySection {
  id: string; title: string; icon: React.ReactNode; color: string;
  items: { label: string; detail: string }[];
}

const PLAYBOOK: PlaySection[] = [
  {
    id: 'strategy', title: 'Setting Strategy', icon: <Compass size={16} />, color: EXEC_NAVY,
    items: [
      { label: 'Choose what not to do', detail: 'Strategy is a small number of deliberate bets. Name the things you are explicitly saying no to.' },
      { label: 'Tie priorities to measurable outcomes', detail: 'Every strategic priority should have a result you can point to — not just an activity.' },
      { label: 'Balance horizons', detail: 'Hold this-quarter execution and multi-year bets at the same time. Neither alone is enough.' },
      { label: 'Pressure-test assumptions', detail: 'Name the key assumptions your strategy rests on and decide how you will validate them early.' },
    ],
  },
  {
    id: 'board', title: 'Board & Governance', icon: <Landmark size={16} />, color: BRAND.accent,
    items: [
      { label: 'No surprises', detail: 'Brief board members on bad news before the meeting. The board room is for decisions, not first reveals.' },
      { label: 'Bring decisions, not just updates', detail: 'Frame board materials around the choices you need them to weigh in on.' },
      { label: 'Build relationships between meetings', detail: 'The real alignment happens in one-on-ones, not in the quarterly board session.' },
      { label: 'Be transparent about risk', detail: 'Show the risks and your mitigation plan. Credibility compounds; hidden risk destroys it.' },
    ],
  },
  {
    id: 'org', title: 'Leading at Scale', icon: <TrendingUp size={16} />, color: BRAND.green,
    items: [
      { label: 'Lead through leaders', detail: 'At the top, you shape the system and develop the leaders, rather than doing the work directly.' },
      { label: 'Make the operating model explicit', detail: 'Clarify how decisions are made, who owns what, and how the organisation runs without you in the room.' },
      { label: 'Set the cultural tone', detail: 'What you tolerate and what you celebrate becomes the culture. Be deliberate about both.' },
      { label: 'Communicate relentlessly', detail: 'Repeat the priorities until you are bored of them — that is roughly when the organisation starts to hear them.' },
    ],
  },
  {
    id: 'self', title: 'Executive Resilience', icon: <ShieldCheck size={16} />, color: BRAND.orange,
    items: [
      { label: 'Protect decision quality', detail: 'Guard your energy and attention for the small number of decisions only you can make.' },
      { label: 'Build a trusted inner circle', detail: 'Have a few people who will tell you the truth, not just what you want to hear.' },
      { label: 'Separate signal from noise', detail: 'Not every fire needs your hand. Decide what you will deliberately not respond to.' },
      { label: 'Invest in your own development', detail: 'A coach, a peer group, or an advisor keeps you growing as the role outgrows your last playbook.' },
    ],
  },
];

function ExecutivePlaybook() {
  const [open, setOpen] = useState<string | null>(PLAYBOOK[0].id);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Executive Playbook</h2>
        <p className="text-xs text-gray-400 mt-0.5">Guidance for the distinct demands of executive and C-suite leadership.</p>
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

interface ExecutiveStudioTabProps {
  profile: any;
}

export function ExecutiveStudioTab({ profile }: ExecutiveStudioTabProps) {
  const [subTab, setSubTab] = useState<ExecSubTab>('readiness');
  const [priorities, setPriorities] = useState<StrategicPriority[]>(() => ls(LS_PRIORITIES, []));
  const [board, setBoard] = useState<BoardContact[]>(() => ls(LS_BOARD, []));
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
        const srvPri: StrategicPriority[] = Array.isArray(j?.executive?.priorities) ? j.executive.priorities : [];
        const srvBoard: BoardContact[] = Array.isArray(j?.executive?.board) ? j.executive.board : [];
        if (srvPri.length || srvBoard.length) {
          setPriorities(srvPri); setBoard(srvBoard);
          lsSet(LS_PRIORITIES, srvPri); lsSet(LS_BOARD, srvBoard);
        } else {
          const localPri = ls<StrategicPriority[]>(LS_PRIORITIES, []);
          const localBoard = ls<BoardContact[]>(LS_BOARD, []);
          if (localPri.length || localBoard.length) {
            void persist({ priorities: localPri, board: localBoard });
          }
        }
      } catch { /* offline → localStorage only */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = (patch: { priorities?: StrategicPriority[]; board?: BoardContact[] }) => {
    if (!serverEnabled.current) return;
    fetch('/api/career/studio-data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authHeader() as Record<string, string>) },
      credentials: 'include',
      body: JSON.stringify({ executive: patch }),
    }).catch(() => {});
  };

  const updatePriorities = (p: StrategicPriority[]) => { setPriorities(p); lsSet(LS_PRIORITIES, p); persist({ priorities: p }); };
  const updateBoard = (b: BoardContact[]) => { setBoard(b); lsSet(LS_BOARD, b); persist({ board: b }); };

  return (
    <div className="space-y-0" data-testid="tab-executive-studio">
      {/* Header */}
      <div className="rounded-2xl p-5 mb-5 relative overflow-hidden" style={{ background: EXEC_NAVY, border: `1px solid ${EXEC_NAVY}20` }}>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10 bg-white" />
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Crown size={22} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Executive Studio</h1>
            <p className="text-xs text-white/80 mt-0.5">An executive-grade workspace — set your strategic agenda, govern your stakeholder network, and lead at scale.</p>
          </div>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        {EXEC_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            data-testid={`subtab-executive-${t.id}`}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-colors"
            style={subTab === t.id
              ? { backgroundColor: EXEC_NAVY, color: 'white', borderColor: 'transparent' }
              : { color: '#6b7280', borderColor: '#e5e7eb', background: 'white' }}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'readiness'  && <ExecutiveReadiness profile={profile} priorities={priorities} board={board} />}
      {subTab === 'priorities' && <StrategicPriorities priorities={priorities} setPriorities={updatePriorities} />}
      {subTab === 'board'      && <BoardStakeholders board={board} setBoard={updateBoard} />}
      {subTab === 'playbook'   && <ExecutivePlaybook />}
    </div>
  );
}
