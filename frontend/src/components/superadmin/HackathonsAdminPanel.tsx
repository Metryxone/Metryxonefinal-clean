import { BRAND } from '@/design-system/tokens';
/**
 * Hackathons & Events admin (super-admin) — create / edit / retire the hackathons that
 * appear in the student Community → Hackathons tab.
 *
 * Closes the loop on the ecosystem hackathons surface: the listing + one-click registration
 * are already live (EcosystemCommunityPage → HackathonsTab), but creating an event was
 * API-only (POST /api/ecosystem/hackathons, super-admin gated). This panel drives that
 * endpoint plus the new PATCH (edit / retire) so admins can publish events without curl.
 *
 * Only rendered when the `ecosystemCommunity` flag is ON (the dashboard probes
 * /api/ecosystem/enabled before mounting), so flag-OFF is byte-identical legacy.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Trophy, RefreshCw, Plus, Pencil, Archive, RotateCcw, X, Users } from 'lucide-react';

interface Hackathon {
  id: string;
  title: string;
  theme: string | null;
  description: string | null;
  mode: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  prize_pool: string | null;
  external_url: string | null;
  status: string;
  participant_count?: number;
}

const STATUS_OPTIONS = ['upcoming', 'live', 'completed', 'retired'];
const MODE_OPTIONS = ['online', 'in-person', 'hybrid'];

const EMPTY: Partial<Hackathon> = {
  title: '', theme: '', description: '', mode: 'online',
  start_date: '', end_date: '', registration_deadline: '',
  prize_pool: '', external_url: '', status: 'upcoming',
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* ignore */ }
  if (!res.ok || (body && body.ok === false)) {
    throw new Error(body?.error || `request_failed_${res.status}`);
  }
  return body;
}

function statusStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'live':      return { backgroundColor: `${BRAND.green}1A`, color: BRAND.green };
    case 'completed': return { backgroundColor: '#6B72801A', color: '#6B7280' };
    case 'retired':   return { backgroundColor: '#9CA3AF1A', color: '#9CA3AF' };
    default:          return { backgroundColor: `${BRAND.accent}20`, color: BRAND.primary };
  }
}

export default function HackathonsAdminPanel() {
  const [items, setItems] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Hackathon> | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api('/api/ecosystem/hackathons')
      .then(j => setItems(j.hackathons || []))
      .catch(e => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const isNew = editing != null && !editing.id;

  const save = async () => {
    if (!editing) return;
    const title = (editing.title || '').trim();
    if (!title) { setFormError('Title is required.'); return; }
    setSaving(true);
    setFormError(null);
    const payload = {
      title,
      theme: editing.theme || '',
      description: editing.description || '',
      mode: editing.mode || 'online',
      start_date: editing.start_date || '',
      end_date: editing.end_date || '',
      registration_deadline: editing.registration_deadline || '',
      prize_pool: editing.prize_pool || '',
      external_url: editing.external_url || '',
      status: editing.status || 'upcoming',
    };
    try {
      if (isNew) {
        await api('/api/ecosystem/hackathons', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        await api(`/api/ecosystem/hackathons/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      }
      setEditing(null);
      load();
    } catch (e: any) {
      setFormError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (h: Hackathon, status: string) => {
    try {
      await api(`/api/ecosystem/hackathons/${h.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch (e: any) {
      setError(String(e.message || e));
    }
  };

  const fld = (label: string, node: React.ReactNode) => (
    <label className="block">
      <span className="text-[11px] font-medium text-gray-500">{label}</span>
      {node}
    </label>
  );
  const inputCls = 'mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-offset-0';
  const inputStyle = { ['--tw-ring-color' as any]: `${BRAND.primary}55` } as React.CSSProperties;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5" style={{ color: BRAND.primary }} />
          <h2 className="text-lg font-semibold text-gray-800">Hackathons &amp; Events</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-gray-500 px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={() => { setEditing({ ...EMPTY }); setFormError(null); }}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white"
            style={{ backgroundColor: BRAND.primary }}>
            <Plus className="w-3.5 h-3.5" /> New event
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Publish hackathons and events that appear in the student Community → Hackathons tab. Students can register with one click. Retired events stay in the list marked as retired.
      </p>

      {error && (
        <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <Trophy className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">No hackathons yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first event — it will appear instantly for students.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="px-4 py-2.5 font-medium">Event</th>
                <th className="px-4 py-2.5 font-medium">Mode</th>
                <th className="px-4 py-2.5 font-medium">Dates</th>
                <th className="px-4 py-2.5 font-medium">Prize</th>
                <th className="px-4 py-2.5 font-medium">Registered</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(h => (
                <tr key={h.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{h.title}</p>
                    {h.theme && <p className="text-xs text-gray-400">{h.theme}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 capitalize">{h.mode || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {[h.start_date, h.end_date].filter(Boolean).join(' → ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{h.prize_pool || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{h.participant_count ?? 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full capitalize" style={statusStyle(h.status)}>{h.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => { setEditing({ ...h }); setFormError(null); }}
                        className="flex items-center gap-1 text-[11px] text-gray-600 px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      {h.status === 'retired' ? (
                        <button onClick={() => setStatus(h, 'upcoming')}
                          className="flex items-center gap-1 text-[11px] text-gray-600 px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <RotateCcw className="w-3 h-3" /> Restore
                        </button>
                      ) : (
                        <button onClick={() => setStatus(h, 'retired')}
                          className="flex items-center gap-1 text-[11px] text-red-500 px-2 py-1 border border-red-100 rounded-lg hover:bg-red-50">
                          <Archive className="w-3 h-3" /> Retire
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">{isNew ? 'New hackathon / event' : 'Edit event'}</h3>
              <button onClick={() => !saving && setEditing(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {fld('Title *', (
                <input className={inputCls} style={inputStyle} value={editing.title || ''}
                  onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. MetryxOne Spring Hackathon" />
              ))}
              {fld('Theme', (
                <input className={inputCls} style={inputStyle} value={editing.theme || ''}
                  onChange={e => setEditing({ ...editing, theme: e.target.value })} placeholder="e.g. AI for social good" />
              ))}
              {fld('Description', (
                <textarea className={inputCls} style={inputStyle} rows={3} value={editing.description || ''}
                  onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="What it's about, who can join, format…" />
              ))}
              <div className="grid grid-cols-2 gap-3">
                {fld('Mode', (
                  <select className={inputCls} style={inputStyle} value={editing.mode || 'online'}
                    onChange={e => setEditing({ ...editing, mode: e.target.value })}>
                    {MODE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ))}
                {fld('Status', (
                  <select className={inputCls} style={inputStyle} value={editing.status || 'upcoming'}
                    onChange={e => setEditing({ ...editing, status: e.target.value })}>
                    {STATUS_OPTIONS.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {fld('Start date', (
                  <input type="date" className={inputCls} style={inputStyle} value={editing.start_date || ''}
                    onChange={e => setEditing({ ...editing, start_date: e.target.value })} />
                ))}
                {fld('End date', (
                  <input type="date" className={inputCls} style={inputStyle} value={editing.end_date || ''}
                    onChange={e => setEditing({ ...editing, end_date: e.target.value })} />
                ))}
                {fld('Reg. deadline', (
                  <input type="date" className={inputCls} style={inputStyle} value={editing.registration_deadline || ''}
                    onChange={e => setEditing({ ...editing, registration_deadline: e.target.value })} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {fld('Prize pool', (
                  <input className={inputCls} style={inputStyle} value={editing.prize_pool || ''}
                    onChange={e => setEditing({ ...editing, prize_pool: e.target.value })} placeholder="e.g. ₹1,00,000" />
                ))}
                {fld('External URL', (
                  <input className={inputCls} style={inputStyle} value={editing.external_url || ''}
                    onChange={e => setEditing({ ...editing, external_url: e.target.value })} placeholder="https://…" />
                ))}
              </div>
              {formError && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</div>}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => !saving && setEditing(null)} className="text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving}
                className="text-xs font-medium px-4 py-2 rounded-lg text-white disabled:opacity-60"
                style={{ backgroundColor: BRAND.primary }}>
                {saving ? 'Saving…' : isNew ? 'Publish event' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
