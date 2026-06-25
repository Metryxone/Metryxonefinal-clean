import { BRAND } from '@/design-system/tokens';
import { useState, useEffect } from 'react';
import { CheckCircle, X, Send, ChevronDown, Clock, Book, Target, Clipboard, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  bookingId?: string;
  childId: string;
  childName: string;
  sessionDate?: string;
  onClose?: () => void;
  onSubmitted?: () => void;
  readOnly?: boolean;
}

interface SessionNote {
  id: string;
  sessionDate: string;
  sessionType: string;
  sessionSummary: string;
  progressObserved?: string;
  areasForImprovement?: string;
  homeworkAssigned?: string;
  nextSessionGoals?: string;
  overallProgress: string;
  domainsWorkedOn: string[];
}

const DOMAINS = [
  'Academic Planning', 'Career Exploration', 'Time Management',
  'Study Skills', 'Emotional Regulation', 'Goal Setting',
  'Communication', 'Confidence Building', 'Exam Strategy', 'Life Skills',
];

const SESSION_TYPES = [
  'Academic Coaching', 'Career Counselling', 'Wellness Check-in',
  'Goal Review', 'Skill Building', 'Parent-Mentor Sync', 'Assessment Review',
];

const PROGRESS_OPTIONS = [
  { value: 'excellent', label: 'Excellent', color: '#4ECDC4' },
  { value: 'on-track', label: 'On Track', color: '#4ECDC4' },
  { value: 'developing', label: 'Developing', color: '#D97706' },
  { value: 'needs-support', label: 'Needs Support', color: '#EF4444' },
];



function NoteCard({ note }: { note: SessionNote }) {
  const [open, setOpen] = useState(false);
  const prog = PROGRESS_OPTIONS.find(p => p.value === note.overallProgress) ?? PROGRESS_OPTIONS[1];

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E8ECF2' }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/50 transition-colors">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${BRAND.blue}10` }}>
          <Clock size={15} style={{ color: BRAND.blue }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800">{note.sessionType}</p>
          <p className="text-[10px] text-gray-400">
            {new Date(note.sessionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: `${prog.color}15`, color: prog.color }}>
            {prog.label}
          </span>
          <ChevronDown size={13} className="text-gray-300 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 space-y-3 pt-3">
          {note.domainsWorkedOn?.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Domains Covered</p>
              <div className="flex flex-wrap gap-1">
                {note.domainsWorkedOn.map(d => (
                  <span key={d} className="px-2 py-0.5 rounded-lg text-[10px] font-medium" style={{ background: `${BRAND.blue}08`, color: BRAND.blue }}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
          {note.sessionSummary && (
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Session Summary</p>
              <p className="text-xs text-gray-600 leading-relaxed">{note.sessionSummary}</p>
            </div>
          )}
          {note.progressObserved && (
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Progress Observed</p>
              <p className="text-xs text-gray-600">{note.progressObserved}</p>
            </div>
          )}
          {note.homeworkAssigned && (
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Homework / Tasks</p>
              <p className="text-xs text-gray-600">{note.homeworkAssigned}</p>
            </div>
          )}
          {note.nextSessionGoals && (
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">Next Session Goals</p>
              <p className="text-xs text-gray-600">{note.nextSessionGoals}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MentorSessionNotes({ bookingId, childId, childName, sessionDate, onClose, onSubmitted, readOnly = false }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'form' | 'history'>(readOnly ? 'history' : 'form');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<SessionNote[]>([]);

  const [sessionType, setSessionType] = useState('Academic Coaching');
  const [domains, setDomains] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [progress, setProgress] = useState('');
  const [improvements, setImprovements] = useState('');
  const [homework, setHomework] = useState('');
  const [nextGoals, setNextGoals] = useState('');
  const [overallProgress, setOverallProgress] = useState('on-track');
  const [parentVisible, setParentVisible] = useState(true);
  const [studentVisible, setStudentVisible] = useState(true);

  useEffect(() => {
    if (mode === 'history' || readOnly) fetchHistory();
  }, [mode, childId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('metryx_token');
      const url = bookingId
        ? `/api/mentor/bookings/${bookingId}/notes`
        : `/api/mentor/child/${childId}/notes`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes ?? data ?? []);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  const toggleDomain = (d: string) => setDomains(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const submit = async () => {
    if (!summary.trim()) {
      toast({ title: 'Summary required', description: 'Please write a session summary before submitting.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('metryx_token');
      const endpoint = bookingId
        ? `/api/mentor/bookings/${bookingId}/notes`
        : `/api/mentor/bookings/new/notes`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          childId,
          sessionDate: sessionDate ?? new Date().toISOString(),
          sessionType,
          domainsWorkedOn: domains,
          sessionSummary: summary,
          progressObserved: progress,
          areasForImprovement: improvements,
          homeworkAssigned: homework,
          nextSessionGoals: nextGoals,
          overallProgress,
          parentVisibility: parentVisible,
          studentVisibility: studentVisible,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setSubmitted(true);
      onSubmitted?.();
      toast({ title: 'Session notes saved', description: `Notes for ${childName}'s session have been saved successfully.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to save session notes. Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-8 text-center">
        <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(78,205,196,0.1)' }}>
          <CheckCircle size={32} style={{ color: BRAND.green }} />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">Notes Saved</h3>
        <p className="text-sm text-gray-500 mb-4">Session notes for <strong>{childName}</strong> have been recorded and {parentVisible ? 'shared with parents' : 'kept private'}.</p>
        {onClose && <button onClick={onClose} className="text-sm font-medium text-gray-500 hover:text-gray-700">Close</button>}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Mentor Session Notes</p>
            <h3 className="text-sm font-bold text-gray-900">{childName}</h3>
            {sessionDate && (
              <p className="text-[10px] text-gray-400">
                {new Date(sessionDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-gray-100">
              <X size={14} className="text-gray-400" />
            </button>
          )}
        </div>

        {!readOnly && (
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${BRAND.blue}20` }}>
            {[{ key: 'form', label: 'New Note', icon: <Clipboard size={12} /> },
              { key: 'history', label: 'History', icon: <Clock size={12} /> }].map(tab => (
              <button key={tab.key} onClick={() => setMode(tab.key as 'form' | 'history')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all"
                style={{
                  background: mode === tab.key ? BRAND.blue : 'transparent',
                  color: mode === tab.key ? '#fff' : BRAND.blue,
                }}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-h-[480px] overflow-y-auto">
        {mode === 'form' ? (
          <div className="px-5 py-4 space-y-4">
            {/* Session type */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Session Type</p>
              <div className="flex flex-wrap gap-1.5">
                {SESSION_TYPES.map(st => (
                  <button key={st} onClick={() => setSessionType(st)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                    style={{
                      background: sessionType === st ? BRAND.blue : '#F5F7FA',
                      color: sessionType === st ? '#fff' : '#64748B',
                      border: sessionType === st ? 'none' : '1px solid #E8ECF2',
                    }}>
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Domains */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Domains Worked On <span className="text-gray-400 font-normal">(select all that apply)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {DOMAINS.map(d => (
                  <button key={d} onClick={() => toggleDomain(d)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                    style={{
                      background: domains.includes(d) ? BRAND.green : '#F5F7FA',
                      color: domains.includes(d) ? '#fff' : '#64748B',
                      border: domains.includes(d) ? 'none' : '1px solid #E8ECF2',
                    }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Session Summary <span className="text-red-400">*</span></p>
              <textarea value={summary} onChange={e => setSummary(e.target.value)}
                placeholder="Describe what was discussed, activities done, student's engagement level..."
                rows={3} className="w-full text-xs rounded-xl px-3 py-2.5 border outline-none resize-none"
                style={{ borderColor: '#E8ECF2', fontFamily: 'Inter, sans-serif' }} />
            </div>

            {/* Progress Observed */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Progress Observed</p>
              <textarea value={progress} onChange={e => setProgress(e.target.value)}
                placeholder="What improvements or growth did you notice this session?"
                rows={2} className="w-full text-xs rounded-xl px-3 py-2.5 border outline-none resize-none"
                style={{ borderColor: '#E8ECF2', fontFamily: 'Inter, sans-serif' }} />
            </div>

            {/* Homework */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Homework / Between-Session Tasks</p>
              <textarea value={homework} onChange={e => setHomework(e.target.value)}
                placeholder="Tasks or practice assigned for the student to complete before next session..."
                rows={2} className="w-full text-xs rounded-xl px-3 py-2.5 border outline-none resize-none"
                style={{ borderColor: '#E8ECF2', fontFamily: 'Inter, sans-serif' }} />
            </div>

            {/* Next session goals */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Next Session Goals</p>
              <textarea value={nextGoals} onChange={e => setNextGoals(e.target.value)}
                placeholder="What will you focus on in the next session?"
                rows={2} className="w-full text-xs rounded-xl px-3 py-2.5 border outline-none resize-none"
                style={{ borderColor: '#E8ECF2', fontFamily: 'Inter, sans-serif' }} />
            </div>

            {/* Overall progress */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Overall Progress Rating</p>
              <div className="flex gap-2">
                {PROGRESS_OPTIONS.map(p => (
                  <button key={p.value} onClick={() => setOverallProgress(p.value)}
                    className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all"
                    style={{
                      background: overallProgress === p.value ? p.color : '#F5F7FA',
                      color: overallProgress === p.value ? '#fff' : '#9AA4B2',
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Visibility */}
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={parentVisible} onChange={e => setParentVisible(e.target.checked)}
                  className="h-4 w-4 rounded" style={{ accentColor: BRAND.blue }} />
                <div className="flex items-center gap-1">
                  {parentVisible ? <Eye size={11} className="text-gray-400" /> : <EyeOff size={11} className="text-gray-400" />}
                  <span className="text-xs text-gray-600">Visible to parent</span>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={studentVisible} onChange={e => setStudentVisible(e.target.checked)}
                  className="h-4 w-4 rounded" style={{ accentColor: BRAND.green }} />
                <div className="flex items-center gap-1">
                  {studentVisible ? <Eye size={11} className="text-gray-400" /> : <EyeOff size={11} className="text-gray-400" />}
                  <span className="text-xs text-gray-600">Visible to student</span>
                </div>
              </label>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4">
            {loading ? (
              <div className="py-8 text-center">
                <div className="h-8 w-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2" style={{ borderColor: BRAND.blue, borderTopColor: 'transparent' }} />
                <p className="text-xs text-gray-400">Loading session history…</p>
              </div>
            ) : notes.length === 0 ? (
              <div className="py-8 text-center">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: `${BRAND.blue}08` }}>
                  <Book size={20} style={{ color: BRAND.blue }} />
                </div>
                <p className="text-sm font-medium text-gray-500">No session notes yet</p>
                <p className="text-xs text-gray-400 mt-1">Notes from completed sessions will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notes.map(note => <NoteCard key={note.id} note={note} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {mode === 'form' && (
        <div className="px-5 pb-5 pt-3 flex gap-2 border-t border-gray-100">
          {onClose && (
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 border border-gray-200">
              Cancel
            </button>
          )}
          <button onClick={submit} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
            style={{ background: BRAND.green }}>
            <Send size={14} />
            {submitting ? 'Saving...' : 'Save Session Notes'}
          </button>
        </div>
      )}
    </div>
  );
}
