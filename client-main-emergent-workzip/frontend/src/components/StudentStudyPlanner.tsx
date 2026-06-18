import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, CheckCircle2, Circle, Clock, Calendar, ChevronRight,
  BarChart2, Zap, AlertCircle, Tag, User, Plus, X, Filter, RefreshCw,
} from 'lucide-react';

const BRAND = { primary: '#0B3C5D', accent: '#4ECDC4' };

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
  assignedByRole?: string;
  assignedByName?: string;
  completedAt?: string;
  createdAt: string;
}

interface Props {
  isDarkMode: boolean;
  onNavigate?: (view: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#4ECDC4',
};
const TYPE_COLORS: Record<string, string> = {
  study: BRAND.primary,
  revision: '#0B3C5D',
  practice: BRAND.accent,
  homework: '#D97706',
  test: '#ef4444',
};
const TYPE_LABELS: Record<string, string> = {
  study: 'Study',
  revision: 'Revision',
  practice: 'Practice',
  homework: 'Homework',
  test: 'Test',
};

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('metryx_token');
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
}

function isPast(dateStr?: string) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}
function isToday(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function isThisWeek(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}
function fmtDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function fmtTime(mins?: number) {
  if (!mins) return '';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function StudentStudyPlanner({ isDarkMode, onNavigate }: Props) {
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'today' | 'week' | 'all'>('today');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'done'>('all');
  const [completing, setCompleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const theme = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textMuted: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    border: isDarkMode ? 'border-gray-700' : 'border-gray-100',
    input: isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400',
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/student/study-tasks');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTasks(data);
    } catch {
      setError('Could not load your study tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markDone = async (id: string) => {
    setCompleting(id);
    try {
      await authFetch(`/api/student/study-tasks/${id}/complete`, { method: 'PUT' });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done', completedAt: new Date().toISOString() } : t));
    } finally {
      setCompleting(null);
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      await authFetch(`/api/student/study-tasks/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch { /* silent */ }
  };

  const filtered = tasks.filter(t => {
    const statusOk = filterStatus === 'all' || t.status === filterStatus || (filterStatus === 'pending' && t.status === 'in_progress');
    if (tab === 'today') return isToday(t.dueDate) && statusOk;
    if (tab === 'week') return isThisWeek(t.dueDate) && statusOk;
    return statusOk;
  });

  const pending = tasks.filter(t => t.status !== 'done').length;
  const done = tasks.filter(t => t.status === 'done').length;
  const total = tasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  if (loading) {
    return (
      <div className={`flex flex-col h-full ${theme.bg} p-4`}>
        <div className="flex items-center justify-center h-48">
          <RefreshCw size={24} className="animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-full ${theme.bg} pb-20`}>
      {/* Header */}
      <div className={`sticky top-0 z-20 px-4 pt-4 pb-3 border-b ${theme.border} ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className={`text-lg font-semibold ${theme.text}`}>Study Planner</h2>
            <p className={`text-xs ${theme.textMuted}`}>{pending} task{pending !== 1 ? 's' : ''} remaining</p>
          </div>
          <button onClick={load} className={`p-2 rounded-lg border ${theme.card} ${theme.textMuted} hover:opacity-80 transition-opacity`}>
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Overall progress bar */}
        {total > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className={theme.textMuted}>{done}/{total} complete</span>
              <span className="font-medium" style={{ color: BRAND.accent }}>{progress}%</span>
            </div>
            <div className={`h-1.5 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: `${BRAND.primary}` }} />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className={`flex rounded-lg p-0.5 gap-0.5 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
          {(['today', 'week', 'all'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${tab === t ? 'text-white shadow-sm' : theme.textMuted}`}
              style={tab === t ? { background: `${BRAND.primary}` } : {}}>
              {t === 'today' ? 'Today' : t === 'week' ? 'This Week' : 'All Tasks'}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-4 py-2 flex gap-2">
        {(['all', 'pending', 'done'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${filterStatus === s
              ? 'text-white border-transparent'
              : `${theme.textMuted} ${theme.border} ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}`}
            style={filterStatus === s ? { background: BRAND.primary } : {}}>
            {s === 'all' ? 'All' : s === 'pending' ? 'Pending' : 'Done'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-2 space-y-3 flex-1">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {filtered.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${BRAND.primary}12` }}>
              <BookOpen size={24} style={{ color: BRAND.primary }} />
            </div>
            <p className={`text-sm font-medium ${theme.text}`}>
              {tab === 'today' ? 'No tasks due today' : tab === 'week' ? 'Nothing scheduled this week' : 'No tasks yet'}
            </p>
            <p className={`text-xs mt-1 ${theme.textMuted}`}>Tasks from your parent, mentor, or teacher will appear here</p>
          </div>
        )}

        {filtered.map(task => {
          const isDone = task.status === 'done';
          const overdue = !isDone && isPast(task.dueDate) && !isToday(task.dueDate);
          const typeColor = TYPE_COLORS[task.taskType] ?? BRAND.primary;
          const priColor = PRIORITY_COLORS[task.priority] ?? '#6b7280';

          return (
            <div key={task.id}
              className={`rounded-xl border p-4 transition-all ${theme.card} ${isDone ? 'opacity-70' : ''}`}>
              <div className="flex items-start gap-3">
                {/* Complete toggle */}
                <button
                  onClick={() => isDone ? setStatus(task.id, 'pending') : markDone(task.id)}
                  disabled={completing === task.id}
                  className="flex-shrink-0 mt-0.5 transition-transform active:scale-90">
                  {isDone
                    ? <CheckCircle2 size={20} style={{ color: BRAND.accent }} />
                    : completing === task.id
                      ? <RefreshCw size={20} className="animate-spin text-gray-400" />
                      : <Circle size={20} className="text-gray-300" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium ${theme.text} ${isDone ? 'line-through opacity-60' : ''}`}>{task.title}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ backgroundColor: `${priColor}15`, color: priColor }}>
                      {task.priority}
                    </span>
                  </div>

                  {task.description && (
                    <p className={`text-xs mt-1 ${theme.textMuted} line-clamp-2`}>{task.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {/* Type badge */}
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${typeColor}12`, color: typeColor }}>
                      <Tag size={9} />
                      {TYPE_LABELS[task.taskType] ?? task.taskType}
                    </span>

                    {/* Subject */}
                    {task.subject && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                        {task.subject}{task.chapter ? ` &middot; ${task.chapter}` : ''}
                      </span>
                    )}

                    {/* Duration */}
                    {task.estimatedMinutes ? (
                      <span className={`flex items-center gap-1 text-[10px] ${theme.textMuted}`}>
                        <Clock size={9} />{fmtTime(task.estimatedMinutes)}
                      </span>
                    ) : null}

                    {/* Due date */}
                    {task.dueDate && (
                      <span className={`flex items-center gap-1 text-[10px] font-medium ${overdue ? 'text-red-500' : isToday(task.dueDate) ? 'text-orange-500' : theme.textMuted}`}>
                        <Calendar size={9} />
                        {overdue ? 'Overdue · ' : isToday(task.dueDate) ? 'Due today' : ''}{fmtDate(task.dueDate)}
                      </span>
                    )}

                    {/* Assigned by */}
                    {task.assignedByName && (
                      <span className={`flex items-center gap-1 text-[10px] ${theme.textMuted}`}>
                        <User size={9} />{task.assignedByName}
                      </span>
                    )}
                  </div>

                  {/* Status selector (only for pending/in_progress) */}
                  {!isDone && (
                    <div className="flex gap-1.5 mt-2.5">
                      <button onClick={() => setStatus(task.id, 'pending')}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${task.status === 'pending' ? 'text-white border-transparent' : `${theme.textMuted} ${theme.border} ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}`}
                        style={task.status === 'pending' ? { background: '#6b7280' } : {}}>
                        Not started
                      </button>
                      <button onClick={() => setStatus(task.id, 'in_progress')}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${task.status === 'in_progress' ? 'text-white border-transparent' : `${theme.textMuted} ${theme.border} ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}`}
                        style={task.status === 'in_progress' ? { background: BRAND.primary } : {}}>
                        In progress
                      </button>
                      <button onClick={() => markDone(task.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${theme.textMuted} ${theme.border} ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        Done
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      {total > 0 && (
        <div className={`fixed bottom-16 left-0 right-0 mx-4 rounded-xl border p-3 ${theme.card} flex items-center justify-between`}>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className={`text-lg font-semibold ${theme.text}`}>{done}</p>
              <p className={`text-[10px] ${theme.textMuted}`}>Done</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-semibold ${theme.text}`}>{pending}</p>
              <p className={`text-[10px] ${theme.textMuted}`}>Pending</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold" style={{ color: BRAND.accent }}>{progress}%</p>
              <p className={`text-[10px] ${theme.textMuted}`}>Progress</p>
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${BRAND.primary}12` }}>
            <BarChart2 size={18} style={{ color: BRAND.primary }} />
          </div>
        </div>
      )}
    </div>
  );
}
