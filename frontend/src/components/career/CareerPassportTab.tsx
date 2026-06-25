import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useCallback } from 'react';
import { IntelligenceLayers } from '../shared/IntelligenceLayers';
import {
  Award, Briefcase, BookOpen, Target, Star, Shield, CheckCircle2,
  Circle, Share2, RefreshCw, Plus, X, ExternalLink, Lock, Globe,
  Users, Calendar, GraduationCap, FileCheck2, Layers, Trash2,
  ChevronDown, ChevronUp, BadgeCheck, AlertTriangle, Copy, Check,
  TrendingUp, Mail, Eye, EyeOff,
} from 'lucide-react';



// ── Verification badge ─────────────────────────────────────────────────────
function VerificationBadge({ status, platform }: { status?: string; platform?: boolean }) {
  if (platform) return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ background: BRAND.primaryLight, color: BRAND.primary }}>
      <BadgeCheck size={9} /> Platform
    </span>
  );
  if (status === 'third_party_verified') return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ background: BRAND.greenLight, color: BRAND.green }}>
      <CheckCircle2 size={9} /> Verified
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full text-gray-400"
      style={{ background: '#f3f4f6' }}>
      <Circle size={8} /> Self-declared
    </span>
  );
}

// ── Visibility pill ────────────────────────────────────────────────────────
const VIS_ICONS: Record<string, React.ReactNode> = {
  private: <Lock size={9} />, connections: <Users size={9} />, public: <Globe size={9} />,
};
function VisibilityPill({ vis }: { vis: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] text-gray-400 px-1 py-0.5">
      {VIS_ICONS[vis] ?? <Lock size={9} />} {vis ?? 'private'}
    </span>
  );
}

// ── Completeness ring ──────────────────────────────────────────────────────
function CompletenessRing({ value, color, size = 80 }: { value: number; color: string; size?: number }) {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, value) / 100) * circ;
  return (
    <svg width={size} height={size} className="block">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size * 0.1} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={size * 0.1} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dy="0.4em"
        fontSize={size * 0.22} fontWeight="700" fill={color}>{value}%</text>
    </svg>
  );
}

// ── Section icon map ───────────────────────────────────────────────────────
const SECTION_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  experience:     { label: 'Experience',    icon: <Briefcase size={14} />,    color: '#3b82f6' },
  competencies:   { label: 'Competencies',  icon: <Layers size={14} />,       color: BRAND.primary },
  assessments:    { label: 'Assessments',   icon: <FileCheck2 size={14} />,   color: '#8b5cf6' },
  certifications: { label: 'Certifications',icon: <Award size={14} />,        color: BRAND.amber },
  projects:       { label: 'Projects',      icon: <Target size={14} />,       color: '#06b6d4' },
  achievements:   { label: 'Achievements',  icon: <Star size={14} />,         color: BRAND.amber },
  learning:       { label: 'Learning',      icon: <GraduationCap size={14} />,color: BRAND.green },
  goals:          { label: 'Goals',         icon: <Target size={14} />,       color: '#f97316' },
  scores:         { label: 'Readiness Scores', icon: <TrendingUp size={14} />, color: '#8b5cf6' },
};

// ── Generic item delete ────────────────────────────────────────────────────
type DelFn = (section: string, id: number) => Promise<void>;

// ─── Section renderers ─────────────────────────────────────────────────────

function ExperienceItem({ item, onDelete }: { item: any; onDelete: DelFn }) {
  const dates = [item.start_date?.slice(0,7), item.is_current ? 'Present' : item.end_date?.slice(0,7)].filter(Boolean).join(' – ');
  return (
    <div className="p-3 rounded-lg border text-sm" style={{ borderColor: BRAND.border }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 truncate">{item.role}</p>
          <p className="text-gray-500 text-xs">{item.org} · {item.employment_type?.replace('_',' ')}</p>
          {dates && <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5"><Calendar size={10} />{dates}</p>}
          {item.description && <p className="text-gray-600 text-xs mt-1 line-clamp-2">{item.description}</p>}
          {item.skills_used?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.skills_used.slice(0,5).map((s: string) => (
                <span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s}</span>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => onDelete('experience', item.id)} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function CompetencyItem({ item, onDelete }: { item: any; onDelete: DelFn }) {
  const pct = item.proficiency_score ?? (item.proficiency_level === 'expert' ? 90 : item.proficiency_level === 'advanced' ? 75 : item.proficiency_level === 'intermediate' ? 55 : 35);
  return (
    <div className="p-3 rounded-lg border text-sm" style={{ borderColor: BRAND.border }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="font-medium text-gray-800">{item.skill_name}</p>
            <VerificationBadge status={item.verification_status} platform={item.source === 'platform'} />
          </div>
          {item.category && <p className="text-[10px] text-gray-400">{item.category}</p>}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: BRAND.primary }} />
            </div>
            <span className="text-[10px] text-gray-500 w-12 text-right">{item.proficiency_level}</span>
          </div>
          {item.verification_status !== 'third_party_verified' && item.source !== 'platform' && (
            <VerifyRequestButton itemType="competency" itemId={item.id} />
          )}
        </div>
        <button onClick={() => onDelete('competencies', item.id)} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function AssessmentItem({ item, onDelete }: { item: any; onDelete: DelFn }) {
  const date = item.completed_at ? new Date(item.completed_at).toLocaleDateString('en-GB', { month:'short', year:'numeric' }) : null;
  return (
    <div className="p-3 rounded-lg border text-sm" style={{ borderColor: BRAND.border }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="font-medium text-gray-800 truncate">{item.title}</p>
            {item.platform_verified && <VerificationBadge platform />}
          </div>
          <p className="text-[11px] text-gray-400">{item.provider} {date && `· ${date}`}</p>
          {item.score != null && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color: BRAND.primary }}>{Math.round(item.score)}</span>
              {item.band && <span className="text-[11px] text-gray-500 capitalize">{item.band}</span>}
            </div>
          )}
        </div>
        <button onClick={() => onDelete('assessments', item.id)} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function CertificationItem({ item, onDelete }: { item: any; onDelete: DelFn }) {
  const isExpired = item.expires_at && new Date(item.expires_at) < new Date();
  return (
    <div className="p-3 rounded-lg border text-sm" style={{ borderColor: BRAND.border }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="font-medium text-gray-800 truncate">{item.title}</p>
            <VerificationBadge status={item.verification_status} />
          </div>
          <p className="text-[11px] text-gray-400">{item.issuer}</p>
          {item.issued_at && <p className="text-[10px] text-gray-400 mt-0.5">Issued {item.issued_at?.slice(0,7)}</p>}
          {item.expires_at && (
            <p className="text-[10px] mt-0.5 flex items-center gap-0.5" style={{ color: isExpired ? BRAND.red : BRAND.green }}>
              {isExpired ? <AlertTriangle size={9} /> : <CheckCircle2 size={9} />}
              {isExpired ? `Expired ${item.expires_at.slice(0,7)}` : `Expires ${item.expires_at.slice(0,7)}`}
            </p>
          )}
          {item.credential_url && (
            <a href={item.credential_url} target="_blank" rel="noopener noreferrer"
              className="text-[10px] flex items-center gap-0.5 mt-1" style={{ color: BRAND.primary }}>
              <ExternalLink size={9} /> View credential
            </a>
          )}
          {item.verification_status !== 'third_party_verified' && (
            <VerifyRequestButton itemType="certification" itemId={item.id} />
          )}
        </div>
        <button onClick={() => onDelete('certifications', item.id)} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function ProjectItem({ item, onDelete }: { item: any; onDelete: DelFn }) {
  return (
    <div className="p-3 rounded-lg border text-sm" style={{ borderColor: BRAND.border }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800">{item.title}</p>
          {item.org && <p className="text-[11px] text-gray-400">{item.org} {item.role && `· ${item.role}`}</p>}
          {item.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.description}</p>}
          {item.outcomes && <p className="text-xs text-gray-600 mt-0.5 line-clamp-1"><span className="text-gray-400">Outcome:</span> {item.outcomes}</p>}
          {item.skills_used?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.skills_used.slice(0,5).map((s: string) => (
                <span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s}</span>
              ))}
            </div>
          )}
          {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-0.5 mt-1" style={{ color: BRAND.primary }}><ExternalLink size={9} /> View project</a>}
        </div>
        <button onClick={() => onDelete('projects', item.id)} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function AchievementItem({ item, onDelete }: { item: any; onDelete: DelFn }) {
  return (
    <div className="p-3 rounded-lg border text-sm" style={{ borderColor: BRAND.border }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5"><p className="font-medium text-gray-800">{item.title}</p><VerificationBadge status={item.verification_status} /></div>
          <p className="text-[11px] text-gray-400">{item.category} {item.issuer && `· ${item.issuer}`} {item.issued_at && `· ${item.issued_at.slice(0,7)}`}</p>
          {item.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.description}</p>}
          {item.verification_status !== 'third_party_verified' && (
            <VerifyRequestButton itemType="achievement" itemId={item.id} />
          )}
        </div>
        <button onClick={() => onDelete('achievements', item.id)} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function LearningItem({ item, onDelete }: { item: any; onDelete: DelFn }) {
  return (
    <div className="p-3 rounded-lg border text-sm" style={{ borderColor: BRAND.border }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800">{item.title}</p>
          <p className="text-[11px] text-gray-400">{item.activity_type} {item.provider && `· ${item.provider}`} {item.hours && `· ${item.hours}h`}</p>
          {item.completed_at && <p className="text-[10px] text-gray-400 mt-0.5"><Calendar size={9} className="inline mr-0.5" />{new Date(item.completed_at).toLocaleDateString('en-GB',{month:'short',year:'numeric'})}</p>}
          {item.skills?.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{item.skills.slice(0,4).map((s:string)=><span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s}</span>)}</div>}
        </div>
        <button onClick={() => onDelete('learning', item.id)} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function GoalItem({ item, onDelete }: { item: any; onDelete: DelFn }) {
  const statusColor: Record<string,string> = { active: BRAND.green, achieved: BRAND.primary, paused: BRAND.amber, dropped: BRAND.muted };
  return (
    <div className="p-3 rounded-lg border text-sm" style={{ borderColor: BRAND.border }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full capitalize"
              style={{ background: `${statusColor[item.status]}20`, color: statusColor[item.status] ?? BRAND.muted }}>
              {item.status}
            </span>
            <p className="font-medium text-gray-800">{item.title}</p>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">{item.goal_type?.replace('_',' ')} {item.target_date && `· By ${item.target_date.slice(0,7)}`}</p>
          {item.description && <p className="text-xs text-gray-600 mt-1 line-clamp-1">{item.description}</p>}
        </div>
        <button onClick={() => onDelete('goals', item.id)} className="text-gray-300 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function ScoreItem({ item }: { item: any }) {
  const scoreColor = item.score >= 75 ? BRAND.green : item.score >= 50 ? BRAND.primary : BRAND.amber;
  return (
    <div className="p-3 rounded-lg border text-sm" style={{ borderColor: BRAND.border }}>
      <div className="flex items-center gap-3">
        <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: `${scoreColor}18`, border: `2px solid ${scoreColor}` }}>
          <span className="text-sm font-bold" style={{ color: scoreColor }}>{Math.round(item.score ?? 0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="font-medium text-gray-800">{item.score_type?.replace(/_/g,' ')}</p>
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: BRAND.primaryLight, color: BRAND.primary }}>Platform</span>
          </div>
          {item.band && <p className="text-[11px] capitalize" style={{ color: scoreColor }}>{item.band}</p>}
          <p className="text-[10px] text-gray-400 mt-0.5">
            <Calendar size={9} className="inline mr-0.5" />
            {item.snapshot_at ? new Date(item.snapshot_at).toLocaleDateString('en-GB',{month:'short',year:'numeric'}) : 'Platform-synced'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-gray-400">Confidence</p>
          <p className="text-xs font-semibold text-gray-600 capitalize">{item.confidence_level ?? '—'}</p>
        </div>
      </div>
      {item.dimension_scores && Object.keys(item.dimension_scores).length > 0 && (
        <div className="mt-2 pt-2 border-t flex flex-wrap gap-2" style={{ borderColor: BRAND.border }}>
          {Object.entries(item.dimension_scores).slice(0, 6).map(([dim, val]) => (
            <div key={dim} className="text-[10px] text-gray-500">
              <span className="text-gray-400">{dim}: </span>
              <span className="font-semibold">{Math.round(val as number)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Request-verification inline button ────────────────────────────────────
function VerifyRequestButton({ itemType, itemId }: { itemType: string; itemId: number }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName]   = useState('');
  const [org, setOrg]     = useState('');
  const [sent, setSent]   = useState(false);
  const [busy, setBusy]   = useState(false);

  const send = async () => {
    if (!email) return;
    setBusy(true);
    try {
      const r = await fetch('/api/passport/verify-request', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_type: itemType, item_id: itemId, verifier_email: email, verifier_name: name || undefined, verifier_org: org || undefined }),
      });
      if (r.ok) { setSent(true); setOpen(false); }
    } finally { setBusy(false); }
  };

  if (sent) return (
    <span className="inline-flex items-center gap-0.5 text-[9px] text-green-600 px-1 py-0.5">
      <CheckCircle2 size={9} /> Verification sent
    </span>
  );

  return open ? (
    <div className="mt-2 p-2 rounded-lg border space-y-1.5" style={{ borderColor: BRAND.primary, background: BRAND.primaryLight }}>
      <p className="text-[10px] font-semibold text-gray-700">Request third-party verification</p>
      <input placeholder="Verifier email *" value={email} onChange={e => setEmail(e.target.value)}
        className="w-full border rounded px-2 py-1 text-[11px]" style={{ borderColor: BRAND.border }} />
      <div className="grid grid-cols-2 gap-1.5">
        <input placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)}
          className="border rounded px-2 py-1 text-[11px]" style={{ borderColor: BRAND.border }} />
        <input placeholder="Organisation" value={org} onChange={e => setOrg(e.target.value)}
          className="border rounded px-2 py-1 text-[11px]" style={{ borderColor: BRAND.border }} />
      </div>
      <div className="flex gap-1.5">
        <button onClick={send} disabled={busy || !email}
          className="flex-1 text-[11px] font-semibold py-1 rounded-lg text-white disabled:opacity-50"
          style={{ background: BRAND.primary }}>
          {busy ? 'Sending…' : 'Send request'}
        </button>
        <button onClick={() => setOpen(false)}
          className="px-2 text-[11px] text-gray-500 border rounded-lg" style={{ borderColor: BRAND.border }}>
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button onClick={() => setOpen(true)}
      className="inline-flex items-center gap-0.5 text-[9px] mt-1 hover:text-indigo-600 transition-colors"
      style={{ color: BRAND.muted }}>
      <Mail size={9} /> Request verification
    </button>
  );
}

// ── Add-item forms ────────────────────────────────────────────────────────
type AddFn = (section: string, body: Record<string, unknown>) => Promise<void>;

function AddExperienceForm({ onAdd, onCancel }: { onAdd: AddFn; onCancel: () => void }) {
  const [f, setF] = useState<Record<string,string>>({ employment_type:'full_time', is_current:'false' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => setF(p => ({...p,[k]:e.target.value}));
  return (
    <div className="p-3 rounded-lg border bg-white space-y-2 text-sm" style={{ borderColor: BRAND.primary }}>
      <input placeholder="Organisation *" value={f.org??''} onChange={set('org')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <input placeholder="Role / Job Title *" value={f.role??''} onChange={set('role')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <div className="grid grid-cols-2 gap-2">
        <input type="month" placeholder="Start date *" value={f.start_date??''} onChange={set('start_date')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
        <input type="month" placeholder="End date" value={f.end_date??''} onChange={set('end_date')} disabled={f.is_current==='true'} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      </div>
      <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
        <input type="checkbox" checked={f.is_current==='true'} onChange={e=>setF(p=>({...p,is_current:e.target.checked?'true':'false'}))} />
        Currently working here
      </label>
      <select value={f.employment_type} onChange={set('employment_type')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
        {['full_time','part_time','contract','freelance','internship','volunteer'].map(v=><option key={v} value={v}>{v.replace('_',' ')}</option>)}
      </select>
      <textarea placeholder="Description" value={f.description??''} onChange={set('description')} rows={2} className="w-full border rounded px-2 py-1.5 text-xs resize-none" style={{ borderColor: BRAND.border }} />
      <input placeholder="Skills used (comma-separated)" value={f.skills_str??''} onChange={set('skills_str')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <FormButtons onSave={() => onAdd('experience', { ...f, start_date: f.start_date ? f.start_date+'-01' : undefined, end_date: f.end_date ? f.end_date+'-01' : undefined, is_current: f.is_current==='true', skills_used: f.skills_str ? f.skills_str.split(',').map(s=>s.trim()).filter(Boolean) : [] })} onCancel={onCancel} />
    </div>
  );
}

function AddCompetencyForm({ onAdd, onCancel }: { onAdd: AddFn; onCancel: () => void }) {
  const [f, setF] = useState<Record<string,string>>({ proficiency_level:'intermediate', proficiency_score:'55' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => setF(p=>({...p,[k]:e.target.value}));
  const levels: Record<string,number> = { beginner:25, intermediate:55, advanced:75, expert:90 };
  return (
    <div className="p-3 rounded-lg border bg-white space-y-2 text-sm" style={{ borderColor: BRAND.primary }}>
      <input placeholder="Skill name *" value={f.skill_name??''} onChange={set('skill_name')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <input placeholder="Category (e.g. Data Analysis)" value={f.category??''} onChange={set('category')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <div className="grid grid-cols-2 gap-2">
        <select value={f.proficiency_level} onChange={e=>{setF(p=>({...p,proficiency_level:e.target.value,proficiency_score:String(levels[e.target.value]??55)}))}} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
          {['beginner','intermediate','advanced','expert'].map(v=><option key={v}>{v}</option>)}
        </select>
        <input type="number" min="0" max="100" placeholder="Score 0-100" value={f.proficiency_score??''} onChange={set('proficiency_score')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      </div>
      <input placeholder="Evidence URL (optional)" value={f.evidence_url??''} onChange={set('evidence_url')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <FormButtons onSave={() => onAdd('competencies', { ...f, proficiency_score: Number(f.proficiency_score)||undefined })} onCancel={onCancel} />
    </div>
  );
}

function AddCertificationForm({ onAdd, onCancel }: { onAdd: AddFn; onCancel: () => void }) {
  const [f, setF] = useState<Record<string,string>>({});
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p=>({...p,[k]:e.target.value}));
  return (
    <div className="p-3 rounded-lg border bg-white space-y-2 text-sm" style={{ borderColor: BRAND.primary }}>
      <input placeholder="Certification title *" value={f.title??''} onChange={set('title')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <input placeholder="Issuing organisation *" value={f.issuer??''} onChange={set('issuer')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <input placeholder="Credential ID" value={f.credential_id??''} onChange={set('credential_id')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-[10px] text-gray-400">Issue date</label><input type="date" value={f.issued_at??''} onChange={set('issued_at')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} /></div>
        <div><label className="text-[10px] text-gray-400">Expiry date</label><input type="date" value={f.expires_at??''} onChange={set('expires_at')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} /></div>
      </div>
      <input placeholder="Credential URL" value={f.credential_url??''} onChange={set('credential_url')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <FormButtons onSave={() => onAdd('certifications', f)} onCancel={onCancel} />
    </div>
  );
}

function AddProjectForm({ onAdd, onCancel }: { onAdd: AddFn; onCancel: () => void }) {
  const [f, setF] = useState<Record<string,string>>({});
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) => setF(p=>({...p,[k]:e.target.value}));
  return (
    <div className="p-3 rounded-lg border bg-white space-y-2 text-sm" style={{ borderColor: BRAND.primary }}>
      <input placeholder="Project title *" value={f.title??''} onChange={set('title')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <input placeholder="Organisation / Team" value={f.org??''} onChange={set('org')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <textarea placeholder="Description" value={f.description??''} onChange={set('description')} rows={2} className="w-full border rounded px-2 py-1.5 text-xs resize-none" style={{ borderColor: BRAND.border }} />
      <textarea placeholder="Key outcomes" value={f.outcomes??''} onChange={set('outcomes')} rows={1} className="w-full border rounded px-2 py-1.5 text-xs resize-none" style={{ borderColor: BRAND.border }} />
      <input placeholder="Skills used (comma-separated)" value={f.skills_str??''} onChange={set('skills_str')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <input placeholder="Project URL" value={f.url??''} onChange={set('url')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <FormButtons onSave={() => onAdd('projects', { ...f, skills_used: f.skills_str ? f.skills_str.split(',').map(s=>s.trim()).filter(Boolean) : [] })} onCancel={onCancel} />
    </div>
  );
}

function AddAchievementForm({ onAdd, onCancel }: { onAdd: AddFn; onCancel: () => void }) {
  const [f, setF] = useState<Record<string,string>>({ category:'milestone' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => setF(p=>({...p,[k]:e.target.value}));
  return (
    <div className="p-3 rounded-lg border bg-white space-y-2 text-sm" style={{ borderColor: BRAND.primary }}>
      <input placeholder="Achievement title *" value={f.title??''} onChange={set('title')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <div className="grid grid-cols-2 gap-2">
        <select value={f.category} onChange={set('category')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
          {['milestone','award','recognition','honor','competition','publication'].map(v=><option key={v}>{v}</option>)}
        </select>
        <input type="date" value={f.issued_at??''} onChange={set('issued_at')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      </div>
      <input placeholder="Issuer / Grantor" value={f.issuer??''} onChange={set('issuer')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <textarea placeholder="Description" value={f.description??''} onChange={set('description')} rows={2} className="w-full border rounded px-2 py-1.5 text-xs resize-none" style={{ borderColor: BRAND.border }} />
      <FormButtons onSave={() => onAdd('achievements', f)} onCancel={onCancel} />
    </div>
  );
}

function AddLearningForm({ onAdd, onCancel }: { onAdd: AddFn; onCancel: () => void }) {
  const [f, setF] = useState<Record<string,string>>({ activity_type:'course' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => setF(p=>({...p,[k]:e.target.value}));
  return (
    <div className="p-3 rounded-lg border bg-white space-y-2 text-sm" style={{ borderColor: BRAND.primary }}>
      <input placeholder="Title *" value={f.title??''} onChange={set('title')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <div className="grid grid-cols-2 gap-2">
        <select value={f.activity_type} onChange={set('activity_type')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
          {['course','program','workshop','bootcamp','book','assessment','certification','conference'].map(v=><option key={v}>{v}</option>)}
        </select>
        <input placeholder="Provider" value={f.provider??''} onChange={set('provider')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={f.completed_at??''} onChange={set('completed_at')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
        <input type="number" placeholder="Hours" value={f.hours??''} onChange={set('hours')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      </div>
      <input placeholder="Skills covered (comma-separated)" value={f.skills_str??''} onChange={set('skills_str')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <FormButtons onSave={() => onAdd('learning', { ...f, hours: f.hours ? Number(f.hours) : undefined, skills: f.skills_str ? f.skills_str.split(',').map(s=>s.trim()).filter(Boolean) : [] })} onCancel={onCancel} />
    </div>
  );
}

function AddGoalForm({ onAdd, onCancel }: { onAdd: AddFn; onCancel: () => void }) {
  const [f, setF] = useState<Record<string,string>>({ goal_type:'role', status:'active' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => setF(p=>({...p,[k]:e.target.value}));
  return (
    <div className="p-3 rounded-lg border bg-white space-y-2 text-sm" style={{ borderColor: BRAND.primary }}>
      <input placeholder="Goal title *" value={f.title??''} onChange={set('title')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <div className="grid grid-cols-2 gap-2">
        <select value={f.goal_type} onChange={set('goal_type')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
          {['role','skill','industry','certification','business','education','personal'].map(v=><option key={v}>{v}</option>)}
        </select>
        <input type="date" placeholder="Target date" value={f.target_date??''} onChange={set('target_date')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      </div>
      <textarea placeholder="Description" value={f.description??''} onChange={set('description')} rows={2} className="w-full border rounded px-2 py-1.5 text-xs resize-none" style={{ borderColor: BRAND.border }} />
      <FormButtons onSave={() => onAdd('goals', f)} onCancel={onCancel} />
    </div>
  );
}

function AddAssessmentForm({ onAdd, onCancel }: { onAdd: AddFn; onCancel: () => void }) {
  const [f, setF] = useState<Record<string,string>>({ assessment_type:'external' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => setF(p=>({...p,[k]:e.target.value}));
  return (
    <div className="p-3 rounded-lg border bg-white space-y-2 text-sm" style={{ borderColor: BRAND.primary }}>
      <input placeholder="Assessment title *" value={f.title??''} onChange={set('title')} className="w-full border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      <div className="grid grid-cols-2 gap-2">
        <select value={f.assessment_type} onChange={set('assessment_type')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }}>
          {['external','skill_test','psychometric','competency','language','custom'].map(v=><option key={v}>{v.replace('_',' ')}</option>)}
        </select>
        <input placeholder="Provider" value={f.provider??''} onChange={set('provider')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" placeholder="Score" value={f.score??''} onChange={set('score')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
        <input type="date" placeholder="Date completed" value={f.completed_at??''} onChange={set('completed_at')} className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: BRAND.border }} />
      </div>
      <FormButtons onSave={() => onAdd('assessments', { ...f, score: f.score ? Number(f.score) : undefined })} onCancel={onCancel} />
    </div>
  );
}

function FormButtons({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex gap-2 pt-1">
      <button onClick={onSave} className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white" style={{ background: BRAND.primary }}>Save</button>
      <button onClick={onCancel} className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-gray-500 border" style={{ borderColor: BRAND.border }}>Cancel</button>
    </div>
  );
}

// ── Section visibility controls ───────────────────────────────────────────
const VIS_OPTIONS = ['private', 'connections', 'public'] as const;
const VIS_LABELS: Record<string, string> = { private: 'Private', connections: 'Connections', public: 'Public' };

function SectionVisibilityControls({
  visibility, shareScores, onSave,
}: {
  visibility: Record<string, string>;
  shareScores: boolean;
  onSave: (vis: Record<string, string>, shareScores: boolean) => Promise<void>;
}) {
  const [open, setOpen]   = useState(false);
  const [vis, setVis]     = useState<Record<string, string>>(visibility);
  const [scores, setScores] = useState(shareScores);
  const [saving, setSaving] = useState(false);

  const allSections = Object.keys(SECTION_META);

  const save = async () => {
    setSaving(true);
    try { await onSave(vis, scores); setOpen(false); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: BRAND.border }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
        <span className="flex items-center gap-1.5"><Lock size={12} style={{ color: BRAND.primary }} /> Section Visibility Settings</span>
        {open ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-xs border-t" style={{ borderColor: BRAND.border }}>
          <p className="text-gray-400 pt-3">Control who can see each section in your shared passport links.</p>
          <div className="space-y-2">
            {allSections.map(sec => (
              <div key={sec} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-gray-600 min-w-0">
                  {SECTION_META[sec].icon}
                  <span className="truncate">{SECTION_META[sec].label}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  {VIS_OPTIONS.map(opt => (
                    <button key={opt} onClick={() => setVis(v => ({ ...v, [sec]: opt }))}
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors"
                      style={{
                        background: (vis[sec] ?? 'private') === opt ? BRAND.primary : '#f3f4f6',
                        color:      (vis[sec] ?? 'private') === opt ? '#fff' : BRAND.muted,
                      }}>
                      {VIS_LABELS[opt]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-gray-600">
              <input type="checkbox" checked={scores} onChange={e => setScores(e.target.checked)}
                className="rounded" />
              Include readiness scores in shared views
            </label>
          </div>
          <button onClick={save} disabled={saving}
            className="w-full text-xs font-semibold py-1.5 rounded-lg text-white disabled:opacity-50"
            style={{ background: BRAND.primary }}>
            {saving ? 'Saving…' : 'Save visibility settings'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Add form map ───────────────────────────────────────────────────────────
const ADD_FORMS: Record<string, React.FC<{ onAdd: AddFn; onCancel: () => void }>> = {
  experience: AddExperienceForm, competencies: AddCompetencyForm, assessments: AddAssessmentForm,
  certifications: AddCertificationForm, projects: AddProjectForm, achievements: AddAchievementForm,
  learning: AddLearningForm, goals: AddGoalForm,
};

// ── Share modal ────────────────────────────────────────────────────────────
function ShareModal({ onClose, passportId }: { onClose: () => void; passportId: number | null }) {
  const [shares, setShares] = useState<any[]>([]);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState('30');
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/passport/shares', { credentials: 'include' })
      .then(r => r.json()).then(d => setShares(d.shares ?? [])).catch(() => null);
  }, []);

  const create = async () => {
    setCreating(true);
    try {
      const r = await fetch('/api/passport/share', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label || null, expires_in_days: days ? Number(days) : null }),
      });
      const d = await r.json();
      if (d.ok) {
        setNewToken(d.token);
        setShares(s => [d.share, ...s]);
      }
    } finally { setCreating(false); }
  };

  const revoke = async (token: string) => {
    await fetch(`/api/passport/share/${token}`, { method: 'DELETE', credentials: 'include' });
    setShares(s => s.filter(x => x.token !== token));
  };

  const shareUrl = (token: string) => `${window.location.origin}/api/passport/shared/${token}`;
  const copy = (token: string) => { navigator.clipboard.writeText(shareUrl(token)); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: BRAND.border }}>
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Share2 size={16} style={{ color: BRAND.primary }} />Share Passport</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500">Create a shareable link. Only sections marked as <em>connections</em> or <em>public</em> visibility will be included.</p>
          <div className="space-y-2">
            <input placeholder="Label (optional)" value={label} onChange={e=>setLabel(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BRAND.border }} />
            <div className="flex gap-2 items-center">
              <select value={days} onChange={e=>setDays(e.target.value)} className="border rounded px-3 py-2 text-sm flex-1" style={{ borderColor: BRAND.border }}>
                <option value="7">Expires in 7 days</option>
                <option value="30">Expires in 30 days</option>
                <option value="180">Expires in 6 months</option>
                <option value="">No expiry</option>
              </select>
              <button onClick={create} disabled={creating} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: BRAND.primary }}>
                {creating ? 'Creating…' : 'Create link'}
              </button>
            </div>
          </div>

          {newToken && (
            <div className="p-3 rounded-lg border text-xs" style={{ borderColor: BRAND.green, background: BRAND.greenLight }}>
              <p className="text-green-700 font-semibold mb-1">Link created!</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-[10px] text-gray-600">{shareUrl(newToken)}</code>
                <button onClick={() => copy(newToken)} className="shrink-0" style={{ color: BRAND.green }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}

          {shares.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-gray-500 mb-2">Active links</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {shares.filter(s => !s.revoked_at).map(s => (
                  <div key={s.token} className="flex items-center justify-between text-xs gap-2 p-2 rounded border" style={{ borderColor: BRAND.border }}>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-700 truncate">{s.label || 'Untitled link'}</p>
                      <p className="text-[10px] text-gray-400">{s.view_count} views · {s.expires_at ? `Expires ${new Date(s.expires_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}` : 'No expiry'}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => copy(s.token)} className="p-1 rounded hover:bg-gray-100" title="Copy link"><Copy size={12} className="text-gray-400" /></button>
                      <button onClick={() => revoke(s.token)} className="p-1 rounded hover:bg-red-50" title="Revoke"><X size={12} className="text-red-400" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CareerPassportTab({ userId, profile }: { userId: string; profile?: any }) {
  const [overview, setOverview]   = useState<any>(null);
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [items, setItems]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [flagOff, setFlagOff]     = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/passport/overview', { credentials: 'include' });
      if (r.status === 503) { setFlagOff(true); return; }
      const d = await r.json();
      if (d.ok) setOverview(d);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  const loadSection = useCallback(async (section: string) => {
    if (section === 'overview') { setItems([]); return; }
    setSectionLoading(true);
    setShowAdd(false);
    try {
      const r = await fetch(`/api/passport/items/${section}`, { credentials: 'include' });
      const d = await r.json();
      setItems(d.items ?? []);
    } catch { setItems([]); } finally { setSectionLoading(false); }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadSection(activeSection); }, [activeSection, loadSection]);

  const handleAdd: AddFn = async (section, body) => {
    try {
      const r = await fetch(`/api/passport/items/${section}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.ok) { setItems(prev => [d.item, ...prev]); setShowAdd(false); loadOverview(); }
    } catch { /* ignore */ }
  };

  const handleDelete: DelFn = async (section, id) => {
    await fetch(`/api/passport/items/${section}/${id}`, { method: 'DELETE', credentials: 'include' });
    setItems(prev => prev.filter(i => i.id !== id));
    loadOverview();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/passport/sync', { method: 'POST', credentials: 'include' });
      await loadOverview();
      if (activeSection !== 'overview') await loadSection(activeSection);
    } finally { setSyncing(false); }
  };

  if (flagOff) return (
    <div className="p-6 text-center text-gray-400 text-sm">
      <Shield size={32} className="mx-auto mb-2 opacity-30" />
      Career Passport is not yet enabled.
    </div>
  );

  if (loading) return (
    <div className="p-6 flex items-center justify-center">
      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />
    </div>
  );

  const passport = overview?.passport ?? {};
  const counts   = overview?.section_counts ?? {};
  const completeness = passport.completeness_score ?? 0;
  const strength     = passport.strength_score ?? 0;
  const SECTIONS = Object.keys(SECTION_META);

  const AddForm = ADD_FORMS[activeSection];

  return (
    <div className="space-y-4">

      {/* ── Header card ── */}
      <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
        <div className="flex items-center gap-4">
          <CompletenessRing value={completeness} color={completeness >= 70 ? BRAND.green : completeness >= 40 ? BRAND.primary : BRAND.amber} size={76} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800">{passport.display_name || profile?.fullName || 'My Career Passport'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{passport.headline || 'Your portable lifelong career record'}</p>
            <div className="mt-2 flex items-center gap-3">
              <div>
                <p className="text-[10px] text-gray-400">Strength</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-24 bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width:`${strength}%`, background: BRAND.primary }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-600">{strength}</span>
                </div>
              </div>
              <div className="text-[10px] text-gray-400">
                {Object.values(counts).filter((v: any) => v > 0).length} / {Object.keys(SECTION_META).length} sections filled
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
              style={{ background: BRAND.primary }}>
              <Share2 size={12} /> Share
            </button>
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border"
              style={{ borderColor: BRAND.border, color: BRAND.muted }}>
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section counts grid ── */}
      {activeSection === 'overview' && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(SECTION_META).map(([sec, meta]) => (
              <button key={sec} onClick={() => setActiveSection(sec)}
                className="rounded-xl border p-3 text-left hover:border-indigo-300 transition-colors"
                style={{ borderColor: BRAND.border }}>
                <div className="flex items-center gap-1.5 mb-1" style={{ color: meta.color }}>
                  {meta.icon}
                  <span className="text-xs font-semibold text-gray-700">{meta.label}</span>
                </div>
                <p className="text-lg font-bold" style={{ color: (counts[sec] ?? 0) > 0 ? BRAND.primary : '#d1d5db' }}>
                  {counts[sec] ?? 0}
                </p>
                <p className="text-[10px] text-gray-400">{(counts[sec] ?? 0) === 1 ? 'item' : 'items'}</p>
              </button>
            ))}
          </div>
          <div className="rounded-xl border p-4 text-xs space-y-1.5" style={{ borderColor: BRAND.border }}>
            <p className="font-semibold text-gray-700 mb-2">Privacy rules</p>
            {[
              ['Owner', 'Full control — add, edit, delete any section'],
              ['Share viewer', 'Read-only — filtered by your section visibility settings'],
              ['Verifier', 'Can attest one specific item via email token only'],
              ['Platform', 'Auto-populates from your assessments and scores — marked "Platform"'],
            ].map(([role, rule]) => (
              <div key={role} className="flex gap-2">
                <span className="font-semibold text-gray-600 w-24 shrink-0">{role}</span>
                <span className="text-gray-500">{rule}</span>
              </div>
            ))}
            <p className="text-[10px] text-gray-400 pt-1">PII (contact details, salary) is never included in shared views. Scores only shared when enabled.</p>
          </div>
          <SectionVisibilityControls
            visibility={overview?.passport?.section_visibility ?? {}}
            shareScores={overview?.passport?.share_scores ?? false}
            onSave={async (vis, shareScores) => {
              await fetch('/api/passport/settings', {
                method: 'PATCH', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ section_visibility: vis, share_scores: shareScores }),
              });
              await loadOverview();
            }}
          />
        </>
      )}

      {/* ── Section navigation ── */}
      {activeSection !== 'overview' && (
        <>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <button onClick={() => setActiveSection('overview')} className="hover:text-indigo-600">Overview</button>
            <span>/</span>
            <span className="font-semibold text-gray-700">{SECTION_META[activeSection]?.label}</span>
            <span className="ml-auto text-gray-400">{items.length} item{items.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Add button — scores are platform-generated, no manual add */}
          {!showAdd && AddForm && activeSection !== 'scores' && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border w-full justify-center"
              style={{ borderColor: BRAND.primary, color: BRAND.primary, borderStyle: 'dashed' }}>
              <Plus size={13} /> Add {SECTION_META[activeSection]?.label}
            </button>
          )}

          {/* Add form */}
          {showAdd && AddForm && <AddForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />}

          {/* Item list */}
          {sectionLoading ? (
            <div className="py-8 flex justify-center">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: BRAND.primary, borderTopColor: 'transparent' }} />
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              <div className="mb-2" style={{ color: SECTION_META[activeSection]?.color }}>
                {SECTION_META[activeSection]?.icon}
              </div>
              {activeSection === 'scores'
                ? <p>Readiness scores are synced automatically from the platform.<br /><span className="text-[11px]">Complete assessments and tap <strong>Sync</strong> to populate this section.</span></p>
                : <>No {SECTION_META[activeSection]?.label.toLowerCase()} added yet.
                    {!showAdd && <button onClick={() => setShowAdd(true)} className="ml-1 underline" style={{ color: BRAND.primary }}>Add one</button>}</>
              }
            </div>
          ) : (
            <div className="space-y-2">
              {activeSection === 'experience'     && items.map(i => <ExperienceItem     key={i.id} item={i} onDelete={handleDelete} />)}
              {activeSection === 'competencies'   && items.map(i => <CompetencyItem     key={i.id} item={i} onDelete={handleDelete} />)}
              {activeSection === 'assessments'    && items.map(i => <AssessmentItem     key={i.id} item={i} onDelete={handleDelete} />)}
              {activeSection === 'certifications' && items.map(i => <CertificationItem  key={i.id} item={i} onDelete={handleDelete} />)}
              {activeSection === 'projects'       && items.map(i => <ProjectItem        key={i.id} item={i} onDelete={handleDelete} />)}
              {activeSection === 'achievements'   && items.map(i => <AchievementItem    key={i.id} item={i} onDelete={handleDelete} />)}
              {activeSection === 'learning'       && items.map(i => <LearningItem       key={i.id} item={i} onDelete={handleDelete} />)}
              {activeSection === 'goals'          && items.map(i => <GoalItem           key={i.id} item={i} onDelete={handleDelete} />)}
              {activeSection === 'scores'         && items.map(i => <ScoreItem          key={i.id} item={i} />)}
            </div>
          )}
        </>
      )}

      {activeSection === 'intelligence' && (
        <IntelligenceLayers title="Career Intelligence Layers" userId={userId} />
      )}

      {/* Horizontal section tabs (shown in all views) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <button onClick={() => setActiveSection('overview')}
          className="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors"
          style={{ background: activeSection === 'overview' ? BRAND.primary : '#f3f4f6', color: activeSection === 'overview' ? '#fff' : BRAND.muted }}>
          Overview
        </button>
        <button onClick={() => setActiveSection('intelligence')}
          className="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors"
          style={{ background: activeSection === 'intelligence' ? BRAND.primary : '#f3f4f6', color: activeSection === 'intelligence' ? '#fff' : BRAND.muted }}>
          Intelligence
        </button>
        {Object.entries(SECTION_META).map(([sec, meta]) => (
          <button key={sec} onClick={() => setActiveSection(sec)}
            className="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
            style={{ background: activeSection === sec ? BRAND.primary : '#f3f4f6', color: activeSection === sec ? '#fff' : BRAND.muted }}>
            {meta.label}
            {(counts[sec] ?? 0) > 0 && (
              <span className="text-[9px] px-1 rounded-full" style={{ background: activeSection === sec ? 'rgba(255,255,255,0.25)' : '#e5e7eb' }}>
                {counts[sec]}
              </span>
            )}
          </button>
        ))}
      </div>

      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} passportId={overview?.passport?.id ?? null} />}
    </div>
  );
}
