import { BRAND } from '@/design-system/tokens';
import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Users, FileText, CheckCircle, Monitor, AlertTriangle,
  Key, RefreshCw, Plus, X, Clock,
  Eye, Trash2, UserCheck, UserX, Globe, Activity,
  AlertCircle, BarChart3, LogOut, Building2, Cpu, Download, Edit3
} from 'lucide-react';



type SecTab = 'overview' | 'members' | 'audit' | 'approvals' | 'sessions' | 'risk' | 'units' | 'sso';

const ROLES = ['owner', 'admin', 'hiring_manager', 'recruiter', 'viewer'] as const;
type RoleT = typeof ROLES[number];

const ROLE_COLORS: Record<RoleT, string> = {
  owner: BRAND.red, admin: BRAND.orange, hiring_manager: BRAND.purple,
  recruiter: BRAND.primary, viewer: '#64748b',
};
const SEV_COLORS: Record<string, string> = {
  critical: BRAND.red, high: BRAND.orange, medium: BRAND.orange, low: '#64748b',
};

interface DashData {
  securityScore: number;
  members: { total: number; byRole: Record<string, number> };
  audit: { last7Days: number };
  pendingApprovals: number;
  activeSessions: number;
  risk: { score: number; bySeverity: Record<string, number> };
  recentActivity: { action: string; resourceType: string; ip: string; createdAt: string }[];
}
interface Member { _id: string; userId: string; role: string; status: string; email: string; fullName: string; businessUnitId: string; lastActive: string | null; joinedAt: string; }
interface AuditEntry { _id: string; userId: string; userEmail: string; action: string; resourceType: string; resourceId: string; status: string; riskScore: number; ip: string; createdAt: string; }
interface Approval { _id: string; requestedBy: string; requesterEmail: string; resourceType: string; resourceId: string; action: string; payload: any; status: string; decidedBy: string; decisionNotes: string; expiresAt: string; createdAt: string; }
interface Session { _id: string; userId: string; userEmail: string; ip: string; deviceType: string; userAgent: string; lastActive: string; createdAt: string; isCurrent: boolean; }
interface RiskEvent { _id: string; userId: string; userEmail: string; eventType: string; severity: string; details: any; createdAt: string; }
interface SSOConfig { provider: string; enabled: boolean; domains: string[]; enforce: boolean; configuredAt: string | null; }
interface OrgInfo { org: { id: string; name: string; domain: string; plan: string; approvalThreshold: number; maxSessions: number; verified: boolean; } | null; myRole: string; memberCount: number; }
interface BusinessUnit { _id: string; name: string; parentId: string; headUserId: string; description: string; createdAt: string; }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color = score >= 90 ? BRAND.green : score >= 70 ? BRAND.orange : BRAND.red;
  return (
    <div className="flex flex-col items-center">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${(score / 100) * 201} 201`}
          strokeLinecap="round" transform="rotate(-90 40 40)" />
        <text x="40" y="44" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>{score}</text>
      </svg>
      <span className="text-xs font-semibold mt-1" style={{ color }}>{label}</span>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role as RoleT] ?? '#64748b';
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: color + '15', color }}>
      {role.replace('_', ' ')}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const color = SEV_COLORS[severity] ?? '#64748b';
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: color + '15', color }}>
      {severity}
    </span>
  );
}

export default function SecurityDashboardPanel() {
  const [tab, setTab] = useState<SecTab>('overview');
  const [dash, setDash] = useState<DashData | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [risk, setRisk] = useState<{ riskScore: number; bySeverity: Record<string, number>; events: RiskEvent[] } | null>(null);
  const [sso, setSso] = useState<SSOConfig | null>(null);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Member invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<RoleT>('recruiter');
  const [inviting, setInviting] = useState(false);

  // Approval decision
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');

  // Org threshold edit
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdVal, setThresholdVal] = useState('');

  // Business unit form
  const [unitName, setUnitName] = useState('');
  const [unitDesc, setUnitDesc] = useState('');
  const [editingUnit, setEditingUnit] = useState<BusinessUnit | null>(null);
  const [savingUnit, setSavingUnit] = useState(false);

  const fetch_ = useCallback(async (url: string) => {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText);
    return r.json();
  }, []);

  const loadDash = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [d, o] = await Promise.all([
        fetch_('/api/employer/security/dashboard').catch(() => null),
        fetch_('/api/employer/orgs/me').catch(() => null),
      ]);
      if (d) setDash(d);
      if (o) setOrg(o);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [fetch_]);

  const loadMembers   = useCallback(async () => { setLoading(true); setErr(''); try { const d = await fetch_('/api/employer/security/members'); setMembers(d.members ?? []); } catch (e: any) { setErr(e.message); } finally { setLoading(false); } }, [fetch_]);
  const loadAudit     = useCallback(async (offset = 0) => { setLoading(true); setErr(''); try { const d = await fetch_(`/api/employer/security/audit-log?limit=50&offset=${offset}`); setAudit(d.entries ?? []); setAuditTotal(d.total ?? 0); } catch (e: any) { setErr(e.message); } finally { setLoading(false); } }, [fetch_]);
  const loadApprovals = useCallback(async (status = 'pending') => { setLoading(true); setErr(''); try { const d = await fetch_(`/api/employer/security/approvals?status=${status}`); setApprovals(d.approvals ?? []); } catch (e: any) { setErr(e.message); } finally { setLoading(false); } }, [fetch_]);
  const loadSessions  = useCallback(async () => { setLoading(true); setErr(''); try { const d = await fetch_('/api/employer/security/sessions'); setSessions(d.sessions ?? []); } catch (e: any) { setErr(e.message); } finally { setLoading(false); } }, [fetch_]);
  const loadRisk      = useCallback(async () => { setLoading(true); setErr(''); try { const d = await fetch_('/api/employer/security/risk'); setRisk(d); } catch (e: any) { setErr(e.message); } finally { setLoading(false); } }, [fetch_]);
  const loadSso       = useCallback(async () => { setLoading(true); setErr(''); try { const d = await fetch_('/api/employer/security/sso'); setSso(d.sso); } catch (e: any) { setErr(e.message); } finally { setLoading(false); } }, [fetch_]);
  const loadUnits     = useCallback(async () => { setLoading(true); setErr(''); try { const d = await fetch_('/api/employer/security/business-units'); setUnits(d.units ?? []); } catch (e: any) { setErr(e.message); } finally { setLoading(false); } }, [fetch_]);

  useEffect(() => {
    if (tab === 'overview')   loadDash();
    else if (tab === 'members')   loadMembers();
    else if (tab === 'audit')     loadAudit();
    else if (tab === 'approvals') loadApprovals();
    else if (tab === 'sessions')  loadSessions();
    else if (tab === 'risk')      loadRisk();
    else if (tab === 'sso')       loadSso();
    else if (tab === 'units')     loadUnits();
  }, [tab]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const r = await fetch('/api/employer/security/members/invite', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'Invite failed'); return; }
      setInviteEmail(''); loadMembers();
    } finally { setInviting(false); }
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    await fetch(`/api/employer/security/members/${memberId}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
    loadMembers();
  };

  const handleSuspend = async (memberId: string) => {
    await fetch(`/api/employer/security/members/${memberId}`, { method: 'DELETE', credentials: 'include' });
    loadMembers();
  };

  const handleDecide = async (approvalId: string, decision: 'approved' | 'rejected') => {
    await fetch(`/api/employer/security/approvals/${approvalId}/decide`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, notes: decisionNotes }) });
    setDecidingId(null); setDecisionNotes(''); loadApprovals();
  };

  const handleRevokeSession = async (sessionId: string) => {
    await fetch(`/api/employer/security/sessions/${sessionId}`, { method: 'DELETE', credentials: 'include' });
    loadSessions();
  };

  const handleResolveRisk = async (eventId: string) => {
    await fetch(`/api/employer/security/risk/${eventId}/resolve`, { method: 'POST', credentials: 'include' });
    loadRisk();
  };

  const handleSaveThreshold = async () => {
    await fetch('/api/employer/orgs/me', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approvalThreshold: Number(thresholdVal) }) });
    setEditingThreshold(false); loadDash();
  };

  const handleSaveUnit = async () => {
    if (!unitName.trim()) return;
    setSavingUnit(true);
    try {
      if (editingUnit) {
        await fetch(`/api/employer/security/business-units/${editingUnit._id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: unitName, description: unitDesc }) });
      } else {
        await fetch('/api/employer/security/business-units', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: unitName, description: unitDesc }) });
      }
      setUnitName(''); setUnitDesc(''); setEditingUnit(null); loadUnits();
    } finally { setSavingUnit(false); }
  };

  const handleDownloadAudit = () => {
    window.open('/api/employer/security/audit-log/export.csv', '_blank');
  };

  const reload = () => {
    if (tab === 'overview') loadDash();
    else if (tab === 'members') loadMembers();
    else if (tab === 'audit') loadAudit();
    else if (tab === 'approvals') loadApprovals();
    else if (tab === 'sessions') loadSessions();
    else if (tab === 'risk') loadRisk();
    else if (tab === 'sso') loadSso();
    else if (tab === 'units') loadUnits();
  };

  const TABS_NAV: { id: SecTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',   label: 'Overview',        icon: <BarChart3 size={14} /> },
    { id: 'members',    label: 'RBAC Members',     icon: <Users size={14} /> },
    { id: 'audit',      label: 'Audit Log',        icon: <FileText size={14} /> },
    { id: 'approvals',  label: 'Approvals',        icon: <CheckCircle size={14} /> },
    { id: 'sessions',   label: 'Sessions',         icon: <Monitor size={14} /> },
    { id: 'risk',       label: 'Risk',             icon: <AlertTriangle size={14} /> },
    { id: 'units',      label: 'Business Units',   icon: <Building2 size={14} /> },
    { id: 'sso',        label: 'SSO Config',       icon: <Key size={14} /> },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg,#1e3a5f,#344E86)' }}>
        <div className="flex items-center gap-3 mb-1">
          <Shield className="text-white" size={22} />
          <h2 className="text-white font-bold text-lg">Security &amp; Compliance</h2>
          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">EP-98-W1</span>
        </div>
        <p className="text-blue-200 text-xs">Organisation isolation · RBAC · Audit trails · Approval workflows · SSO enforcement · Risk scoring</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap">
        {TABS_NAV.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={tab === t.id ? { background: BRAND.primary, color: '#fff' } : { background: '#f1f5f9', color: '#475569' }}>
            {t.icon}{t.label}
            {t.id === 'approvals' && dash && dash.pendingApprovals > 0 && (
              <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 py-0 text-[9px] font-bold">{dash.pendingApprovals}</span>
            )}
          </button>
        ))}
        <button onClick={reload}
          className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600 transition-all" style={{ background: '#f1f5f9' }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {err && (
        <div className="bg-red-50 text-red-700 rounded-xl p-3 text-xs flex items-center gap-2">
          <AlertCircle size={14} /> {err}
        </div>
      )}

      {loading && <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>}

      {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
      {!loading && tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center gap-1 border border-gray-100">
              <ScoreBadge score={dash?.securityScore ?? 98} label="Security Score" />
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Active Members</div>
              <div className="text-2xl font-black" style={{ color: BRAND.primary }}>{dash?.members.total ?? '–'}</div>
              <div className="mt-2 space-y-1">
                {dash && Object.entries(dash.members.byRole).map(([role, n]) => (
                  <div key={role} className="flex items-center gap-1.5"><RoleBadge role={role} /><span className="text-xs text-gray-500">{n}</span></div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Audit Events (7d)</div>
              <div className="text-2xl font-black" style={{ color: BRAND.accent }}>{dash?.audit.last7Days ?? '–'}</div>
              <div className="text-[10px] text-gray-400 mt-1">Active Sessions: {dash?.activeSessions ?? '–'}</div>
              <div className="text-[10px] text-gray-400">Pending Approvals: {dash?.pendingApprovals ?? '–'}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Risk Score</div>
              <div className="text-2xl font-black" style={{ color: dash?.risk.score ? (dash.risk.score > 40 ? BRAND.red : dash.risk.score > 10 ? BRAND.orange : BRAND.green) : BRAND.green }}>
                {dash?.risk.score ?? 0}
              </div>
              {dash && Object.entries(dash.risk.bySeverity).map(([s, n]) => (
                <div key={s} className="flex items-center gap-1.5 mt-1"><SeverityBadge severity={s} /><span className="text-xs text-gray-500">{n}</span></div>
              ))}
            </div>
          </div>

          {org?.org && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={14} style={{ color: BRAND.primary }} />
                <span className="font-bold text-sm text-gray-800">Organisation Settings</span>
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: BRAND.primary + '15', color: BRAND.primary }}>{org.org.plan.toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-gray-400">Org ID</span><br /><code className="text-[10px] bg-gray-100 px-1 rounded">{org.org.id.slice(0,12)}…</code></div>
                <div><span className="text-gray-400">Domain</span><br /><span className="font-semibold">{org.org.domain || '—'}</span></div>
                <div>
                  <span className="text-gray-400">Approval Threshold</span><br />
                  {editingThreshold ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input value={thresholdVal} onChange={e => setThresholdVal(e.target.value)} className="border rounded px-1 py-0.5 text-xs w-24" placeholder="e.g. 1500000" />
                      <button onClick={handleSaveThreshold} className="text-green-600 text-xs font-bold">Save</button>
                      <button onClick={() => setEditingThreshold(false)} className="text-gray-400 text-xs">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">{org.org.approvalThreshold > 0 ? `₹${(org.org.approvalThreshold/100000).toFixed(0)}L` : 'Disabled'}</span>
                      {(org.myRole === 'owner' || org.myRole === 'admin') && (
                        <button onClick={() => { setEditingThreshold(true); setThresholdVal(String(org.org!.approvalThreshold)); }} className="text-blue-500 text-[10px] underline">Edit</button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-gray-400">Max Concurrent Sessions</span><br />
                  <span className="font-semibold">{org.org.maxSessions} per user</span>
                  <span className="ml-1 text-[10px] text-green-600 font-semibold">enforced</span>
                </div>
              </div>
            </div>
          )}

          {dash?.recentActivity && dash.recentActivity.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2"><Activity size={14} style={{ color: BRAND.primary }} /> Recent Activity</div>
              <div className="space-y-2">
                {dash.recentActivity.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-right text-gray-400 shrink-0">{timeAgo(a.createdAt)}</span>
                    <span className="font-semibold capitalize" style={{ color: BRAND.primary }}>{a.action}</span>
                    <span className="text-gray-500">{a.resourceType}</span>
                    {a.ip && <span className="ml-auto text-gray-300 text-[10px]">{a.ip}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MEMBERS ───────────────────────────────────────────────────────── */}
      {!loading && tab === 'members' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2"><UserCheck size={14} style={{ color: BRAND.primary }} /> Invite Member</div>
            <div className="flex gap-2 flex-wrap">
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com"
                className="flex-1 min-w-[180px] border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as RoleT)} className="border rounded-lg px-2 py-1.5 text-sm">
                {ROLES.filter(r => r !== 'owner').map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
              <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: BRAND.primary }}>
                <Plus size={14} />{inviting ? 'Inviting…' : 'Invite'}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left p-3 font-semibold text-gray-500">Member</th>
                <th className="text-left p-3 font-semibold text-gray-500">Role</th>
                <th className="text-left p-3 font-semibold text-gray-500">Status</th>
                <th className="text-left p-3 font-semibold text-gray-500">Last Active</th>
                <th className="p-3"></th>
              </tr></thead>
              <tbody>
                {members.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">No members yet</td></tr>}
                {members.map(m => (
                  <tr key={m._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="p-3"><div className="font-semibold text-gray-800">{m.fullName || m.email}</div>{m.fullName && <div className="text-gray-400">{m.email}</div>}</td>
                    <td className="p-3">
                      <select value={m.role} onChange={e => handleRoleChange(m._id, e.target.value)} className="border rounded px-1 py-0.5 text-[11px]">
                        {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                      </select>
                    </td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.status === 'active' ? 'bg-green-50 text-green-700' : m.status === 'invited' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>{m.status}</span></td>
                    <td className="p-3 text-gray-400">{m.lastActive ? timeAgo(m.lastActive) : '—'}</td>
                    <td className="p-3">{m.role !== 'owner' && <button onClick={() => handleSuspend(m._id)} className="text-red-400 hover:text-red-600"><UserX size={13} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            <span className="font-bold">Role hierarchy: </span>
            <span className="opacity-75">viewer (read) → recruiter (candidates + interviews) → hiring_manager (offers) → admin (members + approvals) → owner (org settings + SSO)</span>
          </div>
        </div>
      )}

      {/* ── AUDIT LOG ─────────────────────────────────────────────────────── */}
      {!loading && tab === 'audit' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">{auditTotal} total audit events</div>
            <button onClick={handleDownloadAudit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: BRAND.green }}>
              <Download size={12} /> Export CSV
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left p-3 font-semibold text-gray-500">Time</th>
                <th className="text-left p-3 font-semibold text-gray-500">User</th>
                <th className="text-left p-3 font-semibold text-gray-500">Action</th>
                <th className="text-left p-3 font-semibold text-gray-500">Resource</th>
                <th className="text-left p-3 font-semibold text-gray-500">IP</th>
                <th className="text-left p-3 font-semibold text-gray-500">Risk</th>
              </tr></thead>
              <tbody>
                {audit.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-400">No audit events yet. Write operations will appear here.</td></tr>}
                {audit.map(e => (
                  <tr key={e._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="p-3 text-gray-400 whitespace-nowrap">{timeAgo(e.createdAt)}</td>
                    <td className="p-3 text-gray-600 truncate max-w-[120px]">{e.userEmail || e.userId.slice(0,8)}</td>
                    <td className="p-3"><span className={`font-bold capitalize ${e.action === 'deleted' ? 'text-red-500' : e.action === 'created' ? 'text-green-600' : 'text-blue-600'}`}>{e.action}</span></td>
                    <td className="p-3 text-gray-500">{e.resourceType}{e.resourceId ? <span className="text-gray-300"> /{e.resourceId.slice(0,6)}</span> : ''}</td>
                    <td className="p-3 text-gray-300 text-[10px]">{e.ip || '—'}</td>
                    <td className="p-3">{e.riskScore > 0 ? <span className="font-bold" style={{ color: e.riskScore > 10 ? BRAND.red : BRAND.orange }}>{e.riskScore}</span> : <span className="text-gray-300">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {auditTotal > 50 && (
            <button onClick={() => loadAudit(audit.length)} className="text-xs font-semibold text-blue-500 underline">
              Load more ({auditTotal - audit.length} remaining)
            </button>
          )}
        </div>
      )}

      {/* ── APPROVALS ─────────────────────────────────────────────────────── */}
      {!loading && tab === 'approvals' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['pending', 'approved', 'rejected', 'expired', 'all'] as const).map(s => (
              <button key={s} onClick={() => loadApprovals(s)}
                className="px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all"
                style={{ background: '#f1f5f9', color: '#475569' }}>{s}</button>
            ))}
          </div>
          {approvals.length === 0 && (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm border border-gray-100">
              No approval requests. Offers above the approval threshold appear here. Pending requests auto-expire after 7 days.
            </div>
          )}
          {approvals.map(a => (
            <div key={a._id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${a.status === 'pending' ? 'bg-yellow-50 text-yellow-700' : a.status === 'approved' ? 'bg-green-50 text-green-700' : a.status === 'expired' ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-700'}`}>{a.status}</span>
                    <span className="text-xs font-semibold text-gray-700 capitalize">{a.action} {a.resourceType}</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Requested by {a.requesterEmail || a.requestedBy.slice(0,8)} · {timeAgo(a.createdAt)}
                    {a.status === 'pending' && a.expiresAt && <span className="ml-2 text-orange-400 flex items-center gap-0.5 inline-flex"><Clock size={9}/> expires {timeAgo(a.expiresAt)}</span>}
                  </div>
                  {a.resourceType === 'offer' && a.payload?.totalCtc && (
                    <div className="mt-2 text-xs text-gray-600">
                      Offer value: <span className="font-bold text-gray-800">₹{Number(a.payload.totalCtc).toLocaleString('en-IN')}</span>
                      {a.payload.candidateName && ` · ${a.payload.candidateName}`}
                      {a.payload.jobTitle && ` · ${a.payload.jobTitle}`}
                    </div>
                  )}
                  {a.decidedBy && <div className="text-[11px] text-gray-400 mt-1">Decision by: {a.decidedBy.slice(0,8)}{a.decisionNotes ? ` — "${a.decisionNotes}"` : ''}</div>}
                </div>
                {a.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    {decidingId === a._id ? (
                      <div className="space-y-2">
                        <input value={decisionNotes} onChange={e => setDecisionNotes(e.target.value)} placeholder="Notes (optional)" className="border rounded px-2 py-1 text-xs w-40" />
                        <div className="flex gap-1">
                          <button onClick={() => handleDecide(a._id, 'approved')} className="px-2 py-1 rounded text-xs font-bold text-white bg-green-600">Approve</button>
                          <button onClick={() => handleDecide(a._id, 'rejected')} className="px-2 py-1 rounded text-xs font-bold text-white bg-red-500">Reject</button>
                          <button onClick={() => setDecidingId(null)} className="px-2 py-1 rounded text-xs text-gray-400"><X size={12}/></button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setDecidingId(a._id)} className="px-3 py-1 rounded-lg text-xs font-semibold text-white" style={{ background: BRAND.primary }}>Review</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SESSIONS ──────────────────────────────────────────────────────── */}
      {!loading && tab === 'sessions' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left p-3 font-semibold text-gray-500">User</th>
                <th className="text-left p-3 font-semibold text-gray-500">Device</th>
                <th className="text-left p-3 font-semibold text-gray-500">IP</th>
                <th className="text-left p-3 font-semibold text-gray-500">Last Active</th>
                <th className="p-3"></th>
              </tr></thead>
              <tbody>
                {sessions.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">No active sessions tracked. Sessions are recorded on employer portal access.</td></tr>}
                {sessions.map(s => (
                  <tr key={s._id} className={`border-b border-gray-50 ${s.isCurrent ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'}`}>
                    <td className="p-3">
                      <div className="text-gray-700 truncate max-w-[150px]">{s.userEmail || s.userId.slice(0,8)}</div>
                      {s.isCurrent && <div className="text-[10px] font-bold text-blue-500">Current session</div>}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 capitalize text-gray-500"><Monitor size={11} />{s.deviceType}</div>
                      <div className="text-[10px] text-gray-300 truncate max-w-[120px]">{s.userAgent}</div>
                    </td>
                    <td className="p-3 text-gray-400 text-[11px]">{s.ip || '—'}</td>
                    <td className="p-3 text-gray-400">{timeAgo(s.lastActive)}</td>
                    <td className="p-3">{!s.isCurrent && <button onClick={() => handleRevokeSession(s._id)} className="text-red-400 hover:text-red-600" title="Revoke session"><LogOut size={13} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            <span className="font-bold">Session controls: </span>
            <span className="opacity-75">Max sessions per user is enforced — oldest session auto-revoked when the limit is exceeded. Revoking a session forces re-authentication on next access.</span>
          </div>
        </div>
      )}

      {/* ── RISK ──────────────────────────────────────────────────────────── */}
      {!loading && tab === 'risk' && (
        <div className="space-y-3">
          {risk && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(['critical', 'high', 'medium', 'low'] as const).map(sev => (
                <div key={sev} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
                  <div className="text-2xl font-black" style={{ color: SEV_COLORS[sev] }}>{risk.bySeverity[sev] ?? 0}</div>
                  <div className="text-[10px] font-bold uppercase text-gray-400 mt-0.5">{sev}</div>
                </div>
              ))}
            </div>
          )}
          {(!risk?.events || risk.events.length === 0) && (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm border border-gray-100">
              No unresolved risk events. Session limit violations are recorded automatically here.
            </div>
          )}
          {risk?.events.map(e => (
            <div key={e._id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><SeverityBadge severity={e.severity} /><span className="text-xs font-semibold text-gray-700">{e.eventType.replace(/_/g, ' ')}</span></div>
                  <div className="text-[11px] text-gray-400 mt-1">{e.userEmail || e.userId.slice(0,8)} · {timeAgo(e.createdAt)}</div>
                  {e.details && Object.keys(e.details).length > 0 && <div className="text-[11px] text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1">{JSON.stringify(e.details).slice(0,120)}</div>}
                </div>
                <button onClick={() => handleResolveRisk(e._id)} className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-white" style={{ background: BRAND.green }}>
                  <CheckCircle size={12} /> Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── BUSINESS UNITS ────────────────────────────────────────────────── */}
      {!loading && tab === 'units' && (
        <div className="space-y-3">
          {/* Create / Edit form */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2">
              <Building2 size={14} style={{ color: BRAND.primary }} />
              {editingUnit ? 'Edit Business Unit' : 'New Business Unit'}
              {editingUnit && <button onClick={() => { setEditingUnit(null); setUnitName(''); setUnitDesc(''); }} className="ml-auto text-gray-400"><X size={13}/></button>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <input value={unitName} onChange={e => setUnitName(e.target.value)} placeholder="Unit name (e.g. Engineering, Sales)"
                className="flex-1 min-w-[160px] border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <input value={unitDesc} onChange={e => setUnitDesc(e.target.value)} placeholder="Description (optional)"
                className="flex-1 min-w-[160px] border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <button onClick={handleSaveUnit} disabled={savingUnit || !unitName.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: BRAND.primary }}>
                {savingUnit ? 'Saving…' : editingUnit ? 'Update' : <><Plus size={14} />Create</>}
              </button>
            </div>
          </div>

          {/* Unit list */}
          {units.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm border border-gray-100">
              No business units yet. Create units to organise your team and scope member access.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {units.map(u => (
                <div key={u._id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-gray-800">{u.name}</div>
                      {u.description && <div className="text-xs text-gray-400 mt-0.5">{u.description}</div>}
                      <div className="text-[10px] text-gray-300 mt-1">Created {timeAgo(u.createdAt)}</div>
                    </div>
                    <button onClick={() => { setEditingUnit(u); setUnitName(u.name); setUnitDesc(u.description); }}
                      className="text-gray-400 hover:text-blue-500 transition-colors">
                      <Edit3 size={13} />
                    </button>
                  </div>
                  {/* Members in this unit */}
                  <div className="mt-3 pt-2 border-t border-gray-50">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Members</div>
                    {members.filter(m => m.businessUnitId === u._id).length === 0
                      ? <div className="text-[11px] text-gray-300">No members assigned</div>
                      : members.filter(m => m.businessUnitId === u._id).map(m => (
                          <div key={m._id} className="flex items-center gap-1.5 mt-1">
                            <RoleBadge role={m.role} />
                            <span className="text-xs text-gray-600">{m.fullName || m.email}</span>
                          </div>
                        ))
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            <span className="font-bold">Business units: </span>
            <span className="opacity-75">Assign members to units from the RBAC Members tab. Units scope audit logs and analytics by department.</span>
          </div>
        </div>
      )}

      {/* ── SSO CONFIG ────────────────────────────────────────────────────── */}
      {!loading && tab === 'sso' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <div className="font-bold text-sm text-gray-800 flex items-center gap-2"><Key size={14} style={{ color: BRAND.primary }} /> SSO Provider Configuration</div>
            {sso && (
              <>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-gray-400 font-semibold uppercase text-[10px] block mb-1">Provider</label>
                    <select defaultValue={sso.provider} className="border rounded-lg px-2 py-1.5 w-full">
                      <option value="none">None (disabled)</option>
                      <option value="google_workspace">Google Workspace</option>
                      <option value="microsoft">Microsoft Entra ID</option>
                      <option value="saml">Generic SAML 2.0</option>
                      <option value="oidc">OpenID Connect</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 font-semibold uppercase text-[10px] block mb-1">Allowed Domains</label>
                    {sso.domains.length ? sso.domains.map((d, i) => <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[11px] font-semibold mr-1">{d}</span>) : <span className="text-gray-300">None configured</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 font-semibold uppercase text-[10px]">SSO Enabled</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sso.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{sso.enabled ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 font-semibold uppercase text-[10px]">Enforce SSO</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sso.enforce ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-400'}`}>{sso.enforce ? 'Required — active' : 'Optional'}</span>
                  </div>
                </div>
                {sso.enforce && sso.enabled && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                    <span className="font-bold">⚠ SSO enforcement is ACTIVE.</span> Users whose email domain matches a configured SSO domain must authenticate via the SSO provider. Email/password logins from those domains are blocked.
                  </div>
                )}
                {sso.configuredAt && <div className="text-[10px] text-gray-300">Last configured: {timeAgo(sso.configuredAt)}</div>}
              </>
            )}
            <div className="pt-2 border-t border-gray-100 grid grid-cols-1 gap-2 text-xs text-gray-500">
              <div className="flex items-center gap-2"><Globe size={12} style={{ color: BRAND.primary }} /> <span className="font-semibold">ACS URL:</span> <code className="bg-gray-100 px-1 rounded text-[10px]">/api/employer/auth/sso/callback</code></div>
              <div className="flex items-center gap-2"><Globe size={12} style={{ color: BRAND.primary }} /> <span className="font-semibold">Entity ID:</span> <code className="bg-gray-100 px-1 rounded text-[10px]">urn:metryx.one:employer:sp</code></div>
              <div className="flex items-center gap-2"><Cpu size={12} style={{ color: BRAND.primary }} /> <span className="font-semibold">Metadata URL:</span> <code className="bg-gray-100 px-1 rounded text-[10px]">/api/employer/auth/sso/metadata</code></div>
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
            <span className="font-bold">Architecture note: </span>
            SSO enforcement is live — domain-matched users are blocked from email/password login when enforcement is on. Active SAML/OIDC token exchange requires completing the IdP integration.
          </div>
        </div>
      )}
    </div>
  );
}
