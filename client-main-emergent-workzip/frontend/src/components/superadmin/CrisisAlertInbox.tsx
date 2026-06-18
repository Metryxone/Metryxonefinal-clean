import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Bell, Check, ChevronRight, RefreshCw, X, UserPlus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BRAND = '#344E86';
const SEV_COLORS: Record<string, string> = {
  critical: '#DC2626',
  high:     '#D97706',
  medium:   '#6366F1',
  low:      '#6B7280',
};

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Counsellor {
  email: string;
  name: string;
}

interface AssignPopoverProps {
  alertId: string;
  onClose: () => void;
  onAssigned: (alertId: string, counsellorEmail: string, counsellorName: string) => void;
}

function AssignPopover({ alertId, onClose, onAssigned }: AssignPopoverProps) {
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
      const res = await fetch(`/api/admin/rie/escalations/${alertId}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counsellor_email: email, counsellor_name: name }),
      });
      if (!res.ok) throw new Error('Failed');
      onAssigned(alertId, email, name);
      toast({ title: `Assigned to ${name}`, description: 'A notification email will be sent to the counsellor.' });
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
            disabled={submitting || (!selected)}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-colors text-white disabled:opacity-50"
            style={{ backgroundColor: BRAND }}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            {submitting ? 'Assigning…' : 'Assign & Notify'}
          </button>
        </>
      )}
    </div>
  );
}

interface CrisisAlertInboxProps {
  onNavigateToEscalations: () => void;
}

export default function CrisisAlertInbox({ onNavigateToEscalations }: CrisisAlertInboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [assigningAlertId, setAssigningAlertId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rie/escalations/unread', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setAlerts(data.alerts || []);
      setCount(data.count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setAssigningAlertId(null);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  async function acknowledge(id: string) {
    setAcknowledging(id);
    try {
      const res = await fetch(`/api/admin/rie/escalations/${id}/acknowledge`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed');
      setAlerts(prev => prev.filter(a => a.id !== id));
      setCount(prev => Math.max(0, prev - 1));
      toast({ title: 'Escalation acknowledged' });
    } catch {
      toast({ title: 'Failed to acknowledge', variant: 'destructive' });
    } finally {
      setAcknowledging(null);
    }
  }

  async function acknowledgeAll() {
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        alerts.map(a =>
          fetch(`/api/admin/rie/escalations/${a.id}/acknowledge`, {
            method: 'PATCH', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }).then(res => ({ id: a.id, ok: res.ok }))
        )
      );
      const succeededIds = new Set(
        results
          .filter(r => r.status === 'fulfilled' && r.value.ok)
          .map(r => (r as PromiseFulfilledResult<{ id: string; ok: boolean }>).value.id)
      );
      const failed = results.length - succeededIds.size;
      setAlerts(prev => prev.filter(a => !succeededIds.has(a.id)));
      setCount(prev => Math.max(0, prev - succeededIds.size));
      if (failed === 0) {
        toast({ title: 'All crisis alerts acknowledged' });
      } else if (succeededIds.size > 0) {
        toast({ title: `${succeededIds.size} acknowledged, ${failed} failed`, variant: 'destructive' });
      } else {
        toast({ title: 'Failed to acknowledge alerts', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to acknowledge all', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function handleAssigned(alertId: string, counsellorEmail: string, counsellorName: string) {
    setAlerts(prev =>
      prev.map(a => a.id === alertId ? { ...a, assigned_to: counsellorEmail, assigned_to_name: counsellorName } : a)
    );
    setAssigningAlertId(null);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setIsOpen(o => !o); if (!isOpen) fetchUnread(); }}
        className="relative p-2 rounded-lg transition-colors hover:bg-gray-100"
        title="Crisis Alert Inbox"
        data-testid="btn-crisis-inbox"
      >
        <AlertTriangle className="h-5 w-5" style={{ color: count > 0 ? '#DC2626' : '#6B7280' }} />
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-white text-xs font-bold flex items-center justify-center px-1 animate-pulse"
            style={{ backgroundColor: '#DC2626' }}
            data-testid="badge-crisis-count"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-12 w-[440px] max-h-[540px] rounded-xl shadow-2xl border border-gray-200 bg-white z-50 flex flex-col"
          data-testid="crisis-inbox-panel"
        >
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between bg-red-50 rounded-t-xl">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <h3 className="font-semibold text-sm text-red-900">Crisis Alert Inbox</h3>
              {count > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-bold bg-red-600">
                  {count}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <button
                  onClick={acknowledgeAll}
                  disabled={loading}
                  className="text-[10px] px-2 py-1 rounded transition-colors hover:bg-red-100 text-red-700 font-medium flex items-center gap-1"
                >
                  <Check className="h-3 w-3" />
                  Acknowledge all
                </button>
              )}
              <button
                onClick={() => { fetchUnread(); }}
                className="p-1.5 rounded hover:bg-red-100 text-red-600"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded hover:bg-red-100 text-red-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {count === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
                  <Check className="h-6 w-6 text-green-500" />
                </div>
                <p className="text-sm font-semibold text-gray-700">All clear</p>
                <p className="text-xs text-gray-400 mt-1">No unacknowledged crisis escalations</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {alerts.map(alert => {
                  const sevColor = SEV_COLORS[alert.severity] || '#6B7280';
                  const typeLabel = (alert.escalation_type || '').replace(/_/g, ' ');
                  const isAssigning = assigningAlertId === alert.id;
                  return (
                    <div key={alert.id} className="p-4 hover:bg-gray-50 flex gap-3 relative">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${sevColor}15` }}
                      >
                        <AlertTriangle className="h-4 w-4" style={{ color: sevColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 capitalize">{typeLabel}</p>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">{alert.user_email}</p>
                        {alert.trigger_reason && (
                          <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{alert.trigger_reason}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span
                            className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: sevColor }}
                          >
                            {alert.severity}
                          </span>
                          {alert.requires_counsellor && (
                            <span className="text-[9px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-full font-medium">
                              Counsellor required
                            </span>
                          )}
                          {alert.assigned_to ? (
                            <span className="text-[9px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                              <Check className="h-2.5 w-2.5" />
                              {alert.assigned_to_name || alert.assigned_to}
                            </span>
                          ) : null}
                          <span className="text-[9px] text-gray-400 ml-auto">{timeAgo(alert.created_at)}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="shrink-0 flex items-start gap-1 relative">
                        <button
                          onClick={() => setAssigningAlertId(isAssigning ? null : alert.id)}
                          className={`p-1.5 rounded-lg transition-colors text-gray-400 hover:text-blue-600 hover:bg-blue-50 ${isAssigning ? 'bg-blue-50 text-blue-600' : ''}`}
                          title={alert.assigned_to ? `Reassign (currently: ${alert.assigned_to})` : 'Assign counsellor'}
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => acknowledge(alert.id)}
                          disabled={acknowledging === alert.id}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-colors"
                          title="Acknowledge"
                        >
                          <Check className="h-4 w-4" />
                        </button>

                        {isAssigning && (
                          <AssignPopover
                            alertId={alert.id}
                            onClose={() => setAssigningAlertId(null)}
                            onAssigned={handleAssigned}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t bg-gray-50 rounded-b-xl">
            <button
              onClick={() => { setIsOpen(false); onNavigateToEscalations(); }}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-600"
            >
              View all escalations
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
