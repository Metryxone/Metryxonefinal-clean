import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, BookOpen, Video, CheckCircle2, Clock, Calendar,
  AlertCircle, User, ChevronRight, RefreshCw, Filter, Zap, Target,
} from 'lucide-react';



interface AssignedTest {
  id: string;
  templateId?: string;
  title: string;
  subject: string;
  status: string;
  duration: number;
  totalMarks: number;
  description: string;
  assignedAt: string;
  startedAt?: string;
  completedAt?: string;
  score?: number;
  dueDate?: string;
  assignedByRole: string;
  isParentTest?: boolean;
  assignmentId?: string;
}
interface StudyTask {
  id: string;
  title: string;
  description?: string;
  taskType: string;
  status: string;
  priority: string;
  dueDate?: string;
  estimatedMinutes?: number;
  subject?: string;
  chapter?: string;
  assignedByRole: string;
  assignedByName?: string;
  completedAt?: string;
  createdAt: string;
}
interface MentorSession {
  id: string;
  mentorId: string;
  stage: string;
  status: string;
  scheduledAt?: string;
  durationMinutes?: number;
  topic?: string;
}
interface Assignments {
  tests: AssignedTest[];
  tasks: StudyTask[];
  sessions: MentorSession[];
}

interface Props {
  isDarkMode: boolean;
  onStartExam?: (templateId: string, assignmentId: string) => void;
  onStartParentTest?: (assignmentId: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#4ECDC4' };
const TYPE_COLORS: Record<string, string> = {
  study: BRAND.primary, revision: '#0B3C5D', practice: BRAND.accent, homework: '#D97706', test: '#ef4444',
};
const ROLE_LABEL: Record<string, string> = { parent: 'Parent', mentor: 'Mentor', teacher: 'Teacher' };

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('metryx_token');
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
}

function fmtDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}
function fmtTime(mins?: number) {
  if (!mins) return '';
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ''}`;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending:     { label: 'Pending',     color: '#f59e0b', bg: '#fef3c7' },
    in_progress: { label: 'In Progress', color: '#0B3C5D', bg: 'rgba(11,60,93,0.06)' },
    done:        { label: 'Done',        color: '#4ECDC4', bg: '#f0fdf4' },
    completed:   { label: 'Done',        color: '#4ECDC4', bg: '#f0fdf4' },
    started:     { label: 'Started',     color: '#0B3C5D', bg: 'rgba(11,60,93,0.06)' },
    scheduled:   { label: 'Scheduled',   color: '#0B3C5D', bg: 'rgba(11,60,93,0.05)' },
    booked:      { label: 'Booked',      color: '#0B3C5D', bg: 'rgba(11,60,93,0.05)' },
  };
  const s = map[status] ?? { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
      style={{ color: s.color, backgroundColor: s.bg }}>
      {s.label}
    </span>
  );
}

export default function StudentAssignments({ isDarkMode, onStartExam, onStartParentTest }: Props) {
  const [data, setData] = useState<Assignments>({ tests: [], tasks: [], sessions: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'tests' | 'tasks' | 'sessions'>('tests');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [error, setError] = useState('');

  const theme = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textMuted: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    border: isDarkMode ? 'border-gray-700' : 'border-gray-100',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/student/assignments');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setData(json);
    } catch {
      setError('Could not load assignments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filterFn = (status: string) => {
    if (filter === 'all') return true;
    if (filter === 'done') return status === 'done' || status === 'completed';
    return status !== 'done' && status !== 'completed';
  };

  const tests = data.tests.filter(t => filterFn(t.status));
  const tasks = data.tasks.filter(t => filterFn(t.status));
  const sessions = data.sessions;

  const pendingTests = data.tests.filter(t => t.status !== 'completed' && t.status !== 'done').length;
  const pendingTasks = data.tasks.filter(t => t.status !== 'done').length;

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-48 ${theme.bg}`}>
        <RefreshCw size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-full ${theme.bg} pb-20`}>
      {/* Header */}
      <div className={`sticky top-0 z-20 px-4 pt-4 pb-3 border-b ${theme.border} ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className={`text-lg font-semibold ${theme.text}`}>My Assignments</h2>
            <p className={`text-xs ${theme.textMuted}`}>Tests, tasks &amp; mentor sessions</p>
          </div>
          <button onClick={load} className={`p-2 rounded-lg border ${theme.card} ${theme.textMuted} hover:opacity-80 transition-opacity`}>
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Summary chips */}
        <div className="flex gap-2 mb-3">
          {[
            { label: 'Tests', count: pendingTests, color: BRAND.primary, tab: 'tests' as const },
            { label: 'Tasks', count: pendingTasks, color: '#f59e0b', tab: 'tasks' as const },
            { label: 'Sessions', count: sessions.length, color: '#0B3C5D', tab: 'sessions' as const },
          ].map(c => (
            <button key={c.tab} onClick={() => setTab(c.tab)}
              className={`flex-1 py-2 px-3 rounded-xl border text-center transition-all ${tab === c.tab ? 'text-white shadow-sm' : `${theme.card}`}`}
              style={tab === c.tab ? { background: `${c.color}`, border: 'none' } : {}}>
              <p className={`text-base font-semibold ${tab === c.tab ? 'text-white' : theme.text}`}>{c.count}</p>
              <p className={`text-[10px] ${tab === c.tab ? 'text-white/80' : theme.textMuted}`}>{c.label}</p>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex gap-2">
          {(['all', 'pending', 'done'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${filter === s
                ? 'text-white border-transparent'
                : `${theme.textMuted} ${theme.border} ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}`}
              style={filter === s ? { background: BRAND.primary } : {}}>
              {s === 'all' ? 'All' : s === 'pending' ? 'Pending' : 'Done'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-3">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Tests tab */}
        {tab === 'tests' && (
          <>
            {tests.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${BRAND.primary}12` }}>
                  <FileText size={24} style={{ color: BRAND.primary }} />
                </div>
                <p className={`text-sm font-medium ${theme.text}`}>No tests assigned</p>
                <p className={`text-xs mt-1 ${theme.textMuted}`}>Tests from your parent will appear here</p>
              </div>
            )}
            {tests.map(test => (
              <div key={test.id} className={`rounded-xl border p-4 ${theme.card}`}>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${BRAND.primary}12` }}>
                    <FileText size={16} style={{ color: BRAND.primary }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${theme.text} leading-tight`}>{test.title}</p>
                      <StatusPill status={test.status} />
                    </div>
                    {test.subject && <p className={`text-xs mt-0.5 ${theme.textMuted}`}>{test.subject}</p>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {test.duration > 0 && (
                        <span className={`flex items-center gap-1 text-[10px] ${theme.textMuted}`}>
                          <Clock size={9} />{fmtTime(test.duration)}
                        </span>
                      )}
                      {test.totalMarks > 0 && (
                        <span className={`flex items-center gap-1 text-[10px] ${theme.textMuted}`}>
                          <Target size={9} />{test.totalMarks} marks
                        </span>
                      )}
                      <span className={`flex items-center gap-1 text-[10px] ${theme.textMuted}`}>
                        <User size={9} />{ROLE_LABEL[test.assignedByRole] ?? test.assignedByRole}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] ${theme.textMuted}`}>
                        <Calendar size={9} />{fmtDate(test.assignedAt)}
                      </span>
                    </div>
                    {test.status !== 'completed' && test.status !== 'done' && (
                      test.isParentTest && onStartParentTest ? (
                        <button
                          onClick={() => onStartParentTest(test.assignmentId ?? test.id)}
                          className="mt-3 flex items-center gap-1.5 text-xs font-medium py-1.5 px-4 rounded-lg text-white transition-all hover:opacity-90 active:scale-95"
                          style={{ background: `${BRAND.primary}` }}>
                          <Zap size={12} />
                          {test.status === 'in_progress' ? 'Continue Test' : 'Start Test'}
                        </button>
                      ) : (test.templateId && onStartExam) ? (
                        <button
                          onClick={() => onStartExam(test.templateId!, test.id)}
                          className="mt-3 flex items-center gap-1.5 text-xs font-medium py-1.5 px-4 rounded-lg text-white transition-all hover:opacity-90 active:scale-95"
                          style={{ background: `${BRAND.primary}` }}>
                          <Zap size={12} />
                          {test.status === 'started' ? 'Continue Test' : 'Start Test'}
                        </button>
                      ) : null
                    )}
                    {(test.status === 'completed' || test.status === 'done') && (
                      <div className="mt-2 flex items-center gap-2 text-[10px]">
                        <span style={{ color: BRAND.accent }} className="flex items-center gap-1">
                          <CheckCircle2 size={10} />
                          Completed {fmtDate(test.completedAt)}
                        </span>
                        {test.score !== undefined && (
                          <span className="font-medium" style={{ color: BRAND.primary }}>
                            Score: {test.score}/{test.totalMarks}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Tasks tab */}
        {tab === 'tasks' && (
          <>
            {tasks.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#f59e0b12' }}>
                  <BookOpen size={24} style={{ color: '#f59e0b' }} />
                </div>
                <p className={`text-sm font-medium ${theme.text}`}>No study tasks yet</p>
                <p className={`text-xs mt-1 ${theme.textMuted}`}>Tasks assigned by your parent or mentor appear here</p>
              </div>
            )}
            {tasks.map(task => {
              const typeColor = TYPE_COLORS[task.taskType] ?? BRAND.primary;
              const priColor = PRIORITY_COLORS[task.priority] ?? '#6b7280';
              const isDone = task.status === 'done';
              return (
                <div key={task.id} className={`rounded-xl border p-4 ${theme.card} ${isDone ? 'opacity-75' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${typeColor}12` }}>
                      <BookOpen size={14} style={{ color: typeColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${theme.text} ${isDone ? 'line-through opacity-60' : ''} leading-tight`}>{task.title}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                          style={{ backgroundColor: `${priColor}15`, color: priColor }}>
                          {task.priority}
                        </span>
                      </div>
                      {task.description && <p className={`text-xs mt-0.5 ${theme.textMuted} line-clamp-2`}>{task.description}</p>}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {task.subject && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                            {task.subject}{task.chapter ? ` &middot; ${task.chapter}` : ''}
                          </span>
                        )}
                        {task.estimatedMinutes ? (
                          <span className={`flex items-center gap-1 text-[10px] ${theme.textMuted}`}>
                            <Clock size={9} />{fmtTime(task.estimatedMinutes)}
                          </span>
                        ) : null}
                        {task.dueDate && (
                          <span className={`flex items-center gap-1 text-[10px] ${theme.textMuted}`}>
                            <Calendar size={9} />Due {fmtDate(task.dueDate)}
                          </span>
                        )}
                        {task.assignedByName && (
                          <span className={`flex items-center gap-1 text-[10px] ${theme.textMuted}`}>
                            <User size={9} />{task.assignedByName} ({ROLE_LABEL[task.assignedByRole] ?? task.assignedByRole})
                          </span>
                        )}
                      </div>
                      <StatusPill status={task.status} />
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Sessions tab */}
        {tab === 'sessions' && (
          <>
            {sessions.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#0B3C5D12' }}>
                  <Video size={24} style={{ color: '#0B3C5D' }} />
                </div>
                <p className={`text-sm font-medium ${theme.text}`}>No mentor sessions</p>
                <p className={`text-xs mt-1 ${theme.textMuted}`}>Booked mentor sessions from your parent appear here</p>
              </div>
            )}
            {sessions.map(session => (
              <div key={session.id} className={`rounded-xl border p-4 ${theme.card}`}>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: '#0B3C5D12' }}>
                    <Video size={16} style={{ color: '#0B3C5D' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${theme.text} leading-tight`}>
                        {session.topic ?? 'Mentor Session'}
                      </p>
                      <StatusPill status={session.status} />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {session.scheduledAt && (
                        <span className={`flex items-center gap-1 text-[10px] ${theme.textMuted}`}>
                          <Calendar size={9} />{fmtDate(session.scheduledAt)}
                        </span>
                      )}
                      {session.durationMinutes && (
                        <span className={`flex items-center gap-1 text-[10px] ${theme.textMuted}`}>
                          <Clock size={9} />{fmtTime(session.durationMinutes)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
