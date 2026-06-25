import { BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, ShieldAlert, UserPlus, Loader2, X, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';



const SEV_COLORS: Record<string, string> = {
  low: '#10B981', medium: '#F59E0B', high: '#EF4444', critical: '#7C3AED',
};

const PAGE_SIZE = 25;

interface Counsellor {
  email: string;
  name: string;
}

interface AssignPopoverProps {
  escalationId: string;
  onClose: () => void;
  onAssigned: (id: string, email: string, name: string) => void;
}

function AssignPopover({ escalationId, onClose, onAssigned }: AssignPopoverProps) {
  const [counsellors, setCounsellors] = useState<Counsellor[]>([]);
  const [loadingCounsellors, setLoadingCounsellors] = useState(true);
  const [selected, setSelected] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/rie/counsellors', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setCounsellors(data.counsellors || []);
        }
      } catch {}
      setLoadingCounsellors(false);
    }
    load();
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  async function handleAssign() {
    const email = selected === '__custom__' ? customEmail.trim() : selected;
    const name = selected === '__custom__'
      ? (customName.trim() || email)
      : (counsellors.find(c => c.email === selected)?.name || selected);

    if (!email) {
      toast({ title: 'Please select or enter a counsellor', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/rie/escalations/${escalationId}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counsellor_email: email, counsellor_name: name }),
      });
      if (!res.ok) throw new Error('Failed');
      onAssigned(escalationId, email, name);
      toast({ title: `Assigned to ${name}` });
      onClose();
    } catch {
      toast({ title: 'Failed to assign counsellor', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-1 z-[60] w-72 bg-white rounded-xl shadow-2xl border border-gray-200 p-4"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-800">Assign Counsellor</p>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-gray-100 text-gray-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {loadingCounsellors ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Select counsellor</label>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">— Choose —</option>
            {counsellors.map(c => (
              <option key={c.email} value={c.email}>{c.name || c.email}</option>
            ))}
            <option value="__custom__">+ Enter manually…</option>
          </select>

          {selected === '__custom__' && (
            <div className="space-y-2 mb-3">
              <input
                type="text"
                placeholder="Counsellor name"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <input
                type="email"
                placeholder="Counsellor email"
                value={customEmail}
                onChange={e => setCustomEmail(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          )}

          <button
            onClick={handleAssign}
            disabled={submitting || !selected}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-colors text-white disabled:opacity-50"
            style={{ backgroundColor: BRAND.primary }}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            {submitting ? 'Assigning…' : 'Assign & Notify'}
          </button>
        </>
      )}
    </div>
  );
}

function EscalationDrawer({ esc, onClose, onAssigned }: { esc: any; onClose: () => void; onAssigned: (id: string, email: string, name: string) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showAssignPopover, setShowAssignPopover] = useState(false);
  const signals: string[] = Array.isArray(esc.trigger_signals) ? esc.trigger_signals : JSON.parse(esc.trigger_signals || '[]');

  const resolveMutation = useMutation({
    mutationFn: (body: any) => fetch(`/api/admin/rie/escalations/${esc.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rie-escalations'] });
      toast({ title: 'Escalation updated' });
      onClose();
    },
  });

  const sevColor = SEV_COLORS[esc.severity] || '#6B7280';
  const assignedLabel = esc.assigned_to_name || esc.assigned_to;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[85vh] overflow-auto shadow-2xl z-10">
        <div className="p-5 border-b" style={{ borderLeft: `4px solid ${sevColor}` }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="text-[10px] capitalize" style={{ backgroundColor: `${sevColor}18`, color: sevColor, border: 'none' }}>{esc.severity}</Badge>
                {esc.mandatory_human_review && <Badge className="text-[10px] bg-red-100 text-red-700 border-0">Mandatory Review</Badge>}
              </div>
              <h3 className="font-bold text-gray-900 text-sm capitalize">{esc.escalation_type?.replace(/_/g, ' ')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{esc.user_email}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {esc.trigger_reason && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100">
              <p className="text-xs font-semibold text-red-800 mb-1">Trigger Reason</p>
              <p className="text-xs text-red-700">{esc.trigger_reason}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Counsellor', val: esc.requires_counsellor },
              { label: 'Mentor', val: esc.requires_mentor },
              { label: 'Peer Support', val: esc.requires_peer_support },
            ].map(r => (
              <div key={r.label} className={`p-2 rounded-lg text-center ${r.val ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
                <p className="text-[10px] text-gray-500">{r.label}</p>
                <p className={`text-xs font-bold ${r.val ? 'text-orange-700' : 'text-gray-400'}`}>{r.val ? 'Required' : 'Not required'}</p>
              </div>
            ))}
          </div>

          {signals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Trigger Signals</p>
              <div className="flex flex-wrap gap-1.5">
                {signals.map((s, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border border-red-200 text-red-700 bg-red-50">{s}</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Assigned Counsellor</p>
            <div className="flex items-center gap-2">
              {assignedLabel ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg">
                  <Check className="h-3.5 w-3.5" />
                  {assignedLabel}
                </span>
              ) : (
                <span className="text-xs text-gray-400 italic">Not yet assigned</span>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowAssignPopover(o => !o)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:text-blue-600 text-gray-500 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {assignedLabel ? 'Reassign' : 'Assign'}
                </button>
                {showAssignPopover && (
                  <AssignPopover
                    escalationId={esc.id}
                    onClose={() => setShowAssignPopover(false)}
                    onAssigned={(id, email, name) => {
                      onAssigned(id, email, name);
                      setShowAssignPopover(false);
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Resolution Notes</p>
            <textarea className="w-full border rounded-lg p-2 text-xs resize-none" rows={3} value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} placeholder="Enter resolution notes…" />
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 text-xs text-white"
              style={{ backgroundColor: '#10B981' }}
              onClick={() => resolveMutation.mutate({ status: 'resolved', resolution_notes: resolutionNotes, resolved_by: 'admin' })}
              disabled={resolveMutation.isPending}
            >Mark Resolved</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RIEEscalationsPanel() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [sevFilter, setSevFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rie-escalations', search, statusFilter, sevFilter, typeFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (sevFilter !== 'all') params.set('severity', sevFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (search) params.set('search', search);
      return fetch(`/api/admin/rie/escalations?${params}`).then(r => r.json());
    },
  });

  const escalations: any[] = data?.escalations || [];
  const summary = data?.summary || {};
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function handleAssigned(id: string, email: string, name: string) {
    qc.setQueryData(
      ['rie-escalations', search, statusFilter, sevFilter, typeFilter, page],
      (old: any) => {
        if (!old) return old;
        return {
          ...old,
          escalations: old.escalations.map((e: any) =>
            e.id === id ? { ...e, assigned_to: email, assigned_to_name: name } : e
          ),
        };
      }
    );
    if (selected?.id === id) {
      setSelected((s: any) => s ? { ...s, assigned_to: email, assigned_to_name: name } : s);
    }
    setAssigningId(null);
  }

  return (
    <div className="space-y-6">
      {selected && (
        <EscalationDrawer
          esc={selected}
          onClose={() => setSelected(null)}
          onAssigned={handleAssigned}
        />
      )}

      <div>
        <h2 className="text-2xl font-bold" style={{ color: BRAND.primary }}>RIE Escalations</h2>
        <p className="text-sm text-gray-500 mt-1">Crisis queue and human-review escalation management</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Pending', value: summary.pending_count, color: '#F59E0B' },
          { label: 'Crisis Pending', value: summary.crisis_pending, color: '#7C3AED' },
          { label: 'Critical', value: summary.critical_count, color: '#EF4444' },
          { label: 'High', value: summary.high_count, color: '#F97316' },
          { label: 'Resolved', value: summary.resolved_count, color: '#10B981' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl border text-center">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value ?? 0}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Input
            placeholder="Search…"
            className="h-9 pl-8 text-xs w-48"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sevFilter} onValueChange={v => { setSevFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            {['critical', 'high', 'medium', 'low'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {[
              'crisis_escalation',
              'burnout_escalation',
              'dropout_risk_escalation',
              'emotional_support_escalation',
              'emotional_containment',
            ].map(t => (
              <SelectItem key={t} value={t} className="capitalize text-xs">{t.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: BRAND.primary }} />
        </div>
      ) : escalations.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">No escalations matching filters</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {escalations.map((esc: any) => {
            const sevColor = SEV_COLORS[esc.severity] || '#6B7280';
            const assignedLabel = esc.assigned_to_name || esc.assigned_to;
            const isAssigning = assigningId === esc.id;
            return (
              <div
                key={esc.id}
                className="flex items-start gap-4 p-4 rounded-xl border bg-white hover:shadow-sm"
                style={{ borderLeft: `3px solid ${sevColor}` }}
              >
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => setSelected(esc)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {esc.mandatory_human_review && <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <p className="text-sm font-semibold text-gray-800 capitalize truncate">{esc.escalation_type?.replace(/_/g, ' ')}</p>
                  </div>
                  <p className="text-xs text-gray-500">{esc.user_email}</p>
                  {esc.trigger_reason && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{esc.trigger_reason}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge className="text-[10px] capitalize" style={{ backgroundColor: `${sevColor}18`, color: sevColor, border: 'none' }}>{esc.severity}</Badge>
                    {esc.mandatory_human_review && <Badge className="text-[10px] bg-red-50 text-red-700 border-red-200">Mandatory</Badge>}
                    <Badge className="text-[10px] capitalize" variant="outline">{esc.status}</Badge>
                    {assignedLabel ? (
                      <span className="flex items-center gap-1 text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full font-medium">
                        <Check className="h-2.5 w-2.5" />
                        {assignedLabel}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">Unassigned</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1 relative">
                  <button
                    onClick={e => { e.stopPropagation(); setAssigningId(isAssigning ? null : esc.id); }}
                    className={`p-1.5 rounded-lg transition-colors text-gray-400 hover:text-blue-600 hover:bg-blue-50 ${isAssigning ? 'bg-blue-50 text-blue-600' : ''}`}
                    title={assignedLabel ? `Reassign (currently: ${assignedLabel})` : 'Assign counsellor'}
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                  {isAssigning && (
                    <AssignPopover
                      escalationId={esc.id}
                      onClose={() => setAssigningId(null)}
                      onAssigned={handleAssigned}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-500">Page {page + 1} of {totalPages} · {total} total</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
