import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
/**
 * BookSessionModal — Create a new video session and generate a shareable invite link.
 */
import { useState } from 'react';
import { X, Copy, Check, Calendar, Clock, Users, Video, Link2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';



export interface CreatedSession {
  roomId: string;
  inviteToken: string;
  inviteUrl: string;
  title: string;
  studentName: string;
  sessionType: string;
  scheduledDate: string;
  scheduledTime: string;
  mode: 'Online' | 'Offline' | 'Hybrid';
}

interface BookSessionModalProps {
  mentorName: string;
  onClose: () => void;
  onSessionCreated: (session: CreatedSession) => void;
}

const SESSION_TYPES = ['Math Tutoring', 'Physics Doubt Clearing', 'Chemistry Lab Prep', 'Study Planning', 'English Essay Writing', 'Science Concepts', 'Career Guidance', 'Mock Interview', 'Custom Session'];

export function BookSessionModal({ mentorName, onClose, onSessionCreated }: BookSessionModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'form' | 'created'>('form');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createdSession, setCreatedSession] = useState<CreatedSession | null>(null);

  const [form, setForm] = useState({
    studentName: '',
    sessionType: 'Math Tutoring',
    scheduledDate: '',
    scheduledTime: '',
    mode: 'Online' as 'Online' | 'Offline' | 'Hybrid',
    customType: '',
  });

  const handleCreate = async () => {
    if (!form.studentName.trim() || !form.scheduledDate || !form.scheduledTime) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const sessionType = form.sessionType === 'Custom Session' ? form.customType : form.sessionType;
      const res = await fetch('/api/video-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${sessionType} with ${mentorName}`,
          mentorName,
          studentName: form.studentName.trim(),
          sessionType,
          scheduledDate: new Date(form.scheduledDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          scheduledTime: new Date(`${form.scheduledDate}T${form.scheduledTime}`).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          mode: form.mode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create session');

      // Build full invite URL
      const baseUrl = window.location.origin;
      const fullUrl = `${baseUrl}${data.inviteUrl}`;
      const session: CreatedSession = {
        roomId: data.roomId,
        inviteToken: data.inviteToken,
        inviteUrl: fullUrl,
        title: data.session.title,
        studentName: form.studentName.trim(),
        sessionType,
        scheduledDate: data.session.scheduledDate,
        scheduledTime: data.session.scheduledTime,
        mode: form.mode,
      };
      setCreatedSession(session);
      setStep('created');
      onSessionCreated(session);
    } catch (err: any) {
      toast({ title: 'Failed to create session', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!createdSession) return;
    await navigator.clipboard.writeText(createdSession.inviteUrl);
    setCopied(true);
    toast({ title: 'Invite link copied!', description: 'Share this link with your student.' });
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {step === 'form' ? 'Book a Session' : 'Session Created!'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 'form' ? 'Fill in details to generate a session link' : 'Share the invite link with your student'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
        </div>

        {/* Form */}
        {step === 'form' && (
          <div className="px-6 py-4 space-y-4">
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1 block">Student Name *</Label>
              <Input placeholder="e.g. Aarav Kapoor" value={form.studentName} onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))}
                className="h-9 text-sm rounded-xl border-gray-200" />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1 block">Session Type *</Label>
              <select value={form.sessionType} onChange={e => setForm(f => ({ ...f, sessionType: e.target.value }))}
                className="w-full h-9 text-sm rounded-xl border border-gray-200 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3C5D]/20">
                {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              {form.sessionType === 'Custom Session' && (
                <Input placeholder="Describe session type" value={form.customType}
                  onChange={e => setForm(f => ({ ...f, customType: e.target.value }))}
                  className="h-9 text-sm rounded-xl border-gray-200 mt-2" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1 block">Date *</Label>
                <Input type="date" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="h-9 text-sm rounded-xl border-gray-200" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1 block">Time *</Label>
                <Input type="time" value={form.scheduledTime} onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                  className="h-9 text-sm rounded-xl border-gray-200" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1 block">Mode</Label>
              <div className="flex gap-2">
                {(['Online', 'Offline', 'Hybrid'] as const).map(m => (
                  <button key={m} onClick={() => setForm(f => ({ ...f, mode: m }))}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${form.mode === m ? 'text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    style={form.mode === m ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : {}}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 text-sm" onClick={onClose}>Cancel</Button>
              <Button className="flex-1 text-sm text-white gap-1.5" style={{ backgroundColor: BRAND.primary }}
                onClick={handleCreate} disabled={loading}>
                <Video size={14} /> {loading ? 'Creating…' : 'Create Session'}
              </Button>
            </div>
          </div>
        )}

        {/* Created — invite link */}
        {step === 'created' && createdSession && (
          <div className="px-6 py-4 space-y-4">
            {/* Session summary */}
            <div className="p-3 bg-gray-50 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2">
                <Users size={13} className="text-gray-400" />
                <span className="text-xs text-gray-700"><span className="font-semibold">{mentorName}</span> + <span className="font-semibold">{createdSession.studentName}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Video size={13} className="text-gray-400" />
                <span className="text-xs text-gray-700">{createdSession.sessionType}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={13} className="text-gray-400" />
                <span className="text-xs text-gray-700">{createdSession.scheduledDate}</span>
                <Clock size={13} className="text-gray-400 ml-1" />
                <span className="text-xs text-gray-700">{createdSession.scheduledTime}</span>
              </div>
            </div>

            {/* Invite link */}
            <div>
              <Label className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5 block">
                <Link2 size={12} /> Student Invite Link
              </Label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[11px] text-gray-600 font-mono truncate">
                  {createdSession.inviteUrl}
                </div>
                <button onClick={copyLink}
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-white transition-all"
                  style={{ backgroundColor: copied ? '#4ECDC4' : BRAND.accent }}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                Share this link with {createdSession.studentName}. They'll be asked to consent to recording before joining.
              </p>
            </div>

            {/* Room ID */}
            <div className="p-3 bg-[#0B3C5D]/5 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Room ID</p>
                <p className="text-xs font-mono font-semibold text-gray-800">{createdSession.roomId}</p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gray-200 flex items-center justify-center">
                <QrCode size={16} className="text-gray-500" />
              </div>
            </div>

            <Button className="w-full text-sm text-white" style={{ backgroundColor: BRAND.primary }} onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
