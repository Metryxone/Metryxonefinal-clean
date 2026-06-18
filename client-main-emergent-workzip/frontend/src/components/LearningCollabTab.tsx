import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users, MessageSquare, BookOpen, Target, CheckCircle2, Clock, Calendar,
  ChevronRight, Send, Sparkles, TrendingUp, Brain, GraduationCap, Building2,
  Video, Award, ArrowRight, RefreshCw, AlertCircle, Star, Milestone,
  UserCheck, Layers, BarChart3, FileText, Bell, Lock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const B = { blue: '#0B3C5D', teal: '#4ECDC4' };

interface Booking {
  id: string;
  mentor_display_name: string;
  mentor_title: string;
  mentor_photo: string | null;
  mentor_rating: number;
  mentor_subjects: string[];
  mentor_lbi_domains: string[];
  mentor_rate: number;
  mentor_verified: boolean;
  slot_date: string;
  start_time: string;
  end_time: string;
  mode: string;
  status: string;
  notes: string | null;
  child_name: string;
  child_grade: string;
}

interface BookingMessage {
  id: number;
  sender_id: string;
  sender_name: string;
  sender_role: 'parent' | 'mentor';
  message: string;
  created_at: string;
}

interface Child {
  id: string;
  name: string;
  grade?: string;
}

interface DashboardData {
  children?: Child[];
  exams?: { id: string; title: string; status: string; score?: number; subject?: string }[];
  goals?: { id: string; title: string; category: string; progress: number; status: string }[];
}

interface Props {
  selectedChild: Child | null;
  dashboardData: DashboardData | null;
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
}

function fmt(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ROADMAP_PHASES = [
  {
    id: 'assess',
    label: 'Preliminary counseling',
    icon: Brain,
    desc: 'Understand learning gaps, LBI profile review, set expectations',
    color: B.teal,
  },
  {
    id: 'plan',
    label: 'Personalized plan',
    icon: Target,
    desc: "Mentor builds a subject/behavior roadmap aligned to child's grade",
    color: B.blue,
  },
  {
    id: 'deepdive',
    label: 'Deep-dive sessions',
    icon: BookOpen,
    desc: 'Curriculum-aligned 60–90 min sessions with milestone tracking',
    color: B.teal,
  },
  {
    id: 'partner',
    label: 'Ongoing partnership',
    icon: Award,
    desc: 'Monthly adaptive planning, exam prep, and behavioral coaching',
    color: B.blue,
  },
];

export default function LearningCollabTab({ selectedChild, dashboardData, onNavigate }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const token = localStorage.getItem('metryx_token') || '';

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [msgInput, setMsgInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);

  const fetchBookings = useCallback(async () => {
    if (!token) return;
    setLoadingBookings(true);
    try {
      const res = await fetch('/api/mentor-marketplace/bookings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
        if (data.length > 0 && !selectedBooking) setSelectedBooking(data[0]);
      }
    } catch { /* silent */ } finally {
      setLoadingBookings(false);
    }
  }, [token]);

  const fetchMessages = useCallback(async (bookingId: string) => {
    if (!token || !bookingId) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/mentor-marketplace/bookings/${bookingId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMessages(await res.json());
    } catch { /* silent */ } finally {
      setLoadingMessages(false);
    }
  }, [token]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);
  useEffect(() => {
    if (selectedBooking) fetchMessages(selectedBooking.id);
  }, [selectedBooking, fetchMessages]);
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!msgInput.trim() || !selectedBooking) return;
    setSendingMsg(true);
    try {
      const res = await fetch(`/api/mentor-marketplace/bookings/${selectedBooking.id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgInput.trim() }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => [...prev, newMsg]);
        setMsgInput('');
      } else {
        toast({ title: 'Could not send message', variant: 'destructive' });
      }
    } catch { toast({ title: 'Network error', variant: 'destructive' }); }
    finally { setSendingMsg(false); }
  }

  const upcomingSessions = bookings.filter(b =>
    b.status === 'pending' || b.status === 'confirmed'
  ).slice(0, 3);
  const completedSessions = bookings.filter(b => b.status === 'completed');
  const activeMentors = [...new Map(bookings.map(b => [b.mentor_display_name, b])).values()];

  const activeGoals = dashboardData?.goals?.filter(g => g.status !== 'completed') ?? [];
  const pendingExams = dashboardData?.exams?.filter(e => e.status === 'pending') ?? [];
  const completedExams = dashboardData?.exams?.filter(e => e.status === 'completed') ?? [];

  const phaseIndex = completedSessions.length >= 3 ? 3
    : completedSessions.length >= 2 ? 2
    : completedSessions.length >= 1 ? 1
    : 0;

  return (
    <div className="space-y-5">

      {/* ── Header stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active mentors', value: activeMentors.length, icon: UserCheck, color: B.blue },
          { label: 'Sessions done', value: completedSessions.length, icon: Video, color: B.teal },
          { label: 'Upcoming', value: upcomingSessions.length, icon: Calendar, color: B.blue },
          { label: 'Shared goals', value: activeGoals.length, icon: Target, color: B.teal },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${s.color}18` }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-gray-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── LEFT: Roadmap + Bridges ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Learning roadmap */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Milestone size={16} style={{ color: B.blue }} />
                <h3 className="text-sm font-semibold" style={{ color: B.blue }}>Learning roadmap</h3>
              </div>
              {activeMentors.length > 0 && (
                <Badge variant="outline" className="text-[10px]" style={{ borderColor: B.teal, color: B.teal }}>
                  Phase {phaseIndex + 1} of 4
                </Badge>
              )}
            </div>
            <div className="p-4 space-y-1">
              {ROADMAP_PHASES.map((phase, idx) => {
                const done = idx < phaseIndex;
                const active = idx === phaseIndex;
                const locked = idx > phaseIndex;
                return (
                  <div key={phase.id}
                    className={`relative flex items-start gap-3 p-3 rounded-xl transition-all ${active ? 'shadow-sm border' : ''}`}
                    style={active ? { backgroundColor: `${phase.color}0A`, borderColor: `${phase.color}30` } : {}}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${done ? 'text-white' : ''}`}
                      style={{
                        backgroundColor: done ? phase.color : active ? `${phase.color}20` : '#F3F4F6',
                        color: done ? 'white' : active ? phase.color : '#9CA3AF',
                      }}>
                      {done ? <CheckCircle2 size={14} /> : locked ? <Lock size={12} /> : <phase.icon size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-semibold ${locked ? 'text-gray-400' : ''}`}
                          style={!locked ? { color: done ? '#374151' : phase.color } : {}}>
                          {phase.label}
                        </span>
                        {done && <Badge className="text-[9px] py-0" style={{ backgroundColor: `${phase.color}20`, color: phase.color }}>Done</Badge>}
                        {active && <Badge className="text-[9px] py-0" style={{ backgroundColor: `${phase.color}20`, color: phase.color }}>Active</Badge>}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{phase.desc}</p>
                    </div>
                    {idx < ROADMAP_PHASES.length - 1 && (
                      <div className="absolute left-[22px] top-[42px] w-0.5 h-4"
                        style={{ backgroundColor: done ? phase.color : '#E5E7EB' }} />
                    )}
                  </div>
                );
              })}
              {activeMentors.length === 0 && (
                <div className="pt-2 pb-1 text-center">
                  <p className="text-xs text-gray-400 mb-3">No mentor booked yet. Book a session to start your child's learning journey.</p>
                  <Button size="sm" className="text-xs h-8 text-white"
                    style={{ backgroundColor: B.blue }}
                    onClick={() => onNavigate('unified-parent-dashboard', { tab: 'mentor-services' })}>
                    <Sparkles size={12} className="mr-1.5" /> Find a mentor
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Platform bridges */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
              <Layers size={16} style={{ color: B.teal }} />
              <h3 className="text-sm font-semibold" style={{ color: B.blue }}>Platform bridges</h3>
            </div>
            <div className="p-4 space-y-3">

              {/* Institution → Student */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${B.blue}15` }}>
                  <Building2 size={14} style={{ color: B.blue }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Institution → {selectedChild?.name || 'Student'}</span>
                    <ChevronRight size={12} className="text-gray-300" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {pendingExams.length > 0
                      ? `${pendingExams.length} exam${pendingExams.length > 1 ? 's' : ''} pending · ${completedExams.length} completed`
                      : completedExams.length > 0
                        ? `${completedExams.length} exam${completedExams.length > 1 ? 's' : ''} completed`
                        : 'No exams assigned yet'}
                  </p>
                  {pendingExams.slice(0, 2).map(e => (
                    <div key={e.id} className="mt-1.5 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: B.teal }} />
                      <span className="text-[10px] text-gray-500 truncate">{e.title}</span>
                      <Badge variant="outline" className="text-[9px] py-0 shrink-0" style={{ borderColor: '#F59E0B', color: '#F59E0B' }}>pending</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mentor → Student */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${B.teal}15` }}>
                  <UserCheck size={14} style={{ color: B.teal }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Mentor → {selectedChild?.name || 'Student'}</span>
                    <ChevronRight size={12} className="text-gray-300" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {activeMentors.length > 0
                      ? `${activeMentors.length} active mentor${activeMentors.length > 1 ? 's' : ''} · ${completedSessions.length} sessions completed`
                      : 'No mentor sessions yet'}
                  </p>
                  {activeMentors.slice(0, 1).map(b => (
                    <div key={b.id} className="mt-1.5 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: B.blue }} />
                      <span className="text-[10px] text-gray-500 truncate">{b.mentor_display_name}</span>
                      <span className="text-[9px] text-gray-400">{b.mentor_subjects?.slice(0, 2).join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Parent ↔ Student */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${B.blue}15` }}>
                  <Target size={14} style={{ color: B.blue }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Parent ↔ {selectedChild?.name || 'Student'}</span>
                    <ChevronRight size={12} className="text-gray-300" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {activeGoals.length > 0
                      ? `${activeGoals.length} shared goal${activeGoals.length > 1 ? 's' : ''} active`
                      : 'No shared goals set'}
                  </p>
                  {activeGoals.slice(0, 2).map(g => (
                    <div key={g.id} className="mt-1.5 flex items-center gap-1.5">
                      <div className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${g.progress}%`, backgroundColor: B.teal }} />
                      </div>
                      <span className="text-[10px] text-gray-500 shrink-0">{g.progress}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Upcoming sessions + Message thread ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Upcoming sessions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={16} style={{ color: B.blue }} />
                <h3 className="text-sm font-semibold" style={{ color: B.blue }}>Upcoming sessions</h3>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2"
                onClick={() => onNavigate('unified-parent-dashboard', { tab: 'mentor-services' })}
                style={{ color: B.teal }}>
                Book more <ArrowRight size={12} className="ml-1" />
              </Button>
            </div>
            {loadingBookings ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw size={20} className="animate-spin" style={{ color: B.blue }} />
              </div>
            ) : upcomingSessions.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Calendar size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm text-gray-400">No upcoming sessions scheduled</p>
                <Button size="sm" className="mt-3 text-xs h-8 text-white"
                  style={{ backgroundColor: B.blue }}
                  onClick={() => onNavigate('unified-parent-dashboard', { tab: 'mentor-services' })}>
                  Schedule a session
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingSessions.map(b => (
                  <div key={b.id}
                    className={`px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/50 cursor-pointer transition-colors ${selectedBooking?.id === b.id ? 'bg-blue-50/30' : ''}`}
                    onClick={() => setSelectedBooking(b)}>
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-sm font-bold"
                      style={{ color: B.blue }}>
                      {(b.mentor_display_name || 'M').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800 truncate">{b.mentor_display_name}</span>
                        {b.mentor_verified && <CheckCircle2 size={12} style={{ color: B.teal }} />}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Calendar size={9} /> {fmt(b.slot_date)}
                        </span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock size={9} /> {b.start_time?.slice(0, 5)}
                        </span>
                        <span className="text-[10px] text-gray-400">{b.child_name}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className="text-[9px] capitalize py-0"
                        style={{
                          backgroundColor: b.status === 'confirmed' ? `${B.teal}20` : `${B.blue}15`,
                          color: b.status === 'confirmed' ? B.teal : B.blue,
                        }}>
                        {b.status}
                      </Badge>
                      <span className="text-[10px] text-gray-300 capitalize">{b.mode}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parent ↔ Mentor message thread */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
            style={{ minHeight: '320px' }}>
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} style={{ color: B.teal }} />
                <h3 className="text-sm font-semibold" style={{ color: B.blue }}>
                  {selectedBooking
                    ? `Notes with ${selectedBooking.mentor_display_name}`
                    : 'Mentor notes'}
                </h3>
              </div>
              {bookings.length > 1 && (
                <select
                  className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white"
                  value={selectedBooking?.id ?? ''}
                  onChange={e => {
                    const b = bookings.find(x => x.id === e.target.value);
                    if (b) setSelectedBooking(b);
                  }}>
                  {bookings.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.mentor_display_name} · {fmt(b.slot_date)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {!selectedBooking ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center px-6">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: `${B.blue}10` }}>
                  <MessageSquare size={22} style={{ color: B.blue }} />
                </div>
                <p className="text-sm text-gray-400">Book a mentor session to start collaborating</p>
                <p className="text-[11px] text-gray-300 mt-1">Notes and messages with your mentor will appear here</p>
                <Button size="sm" className="mt-4 text-xs h-8 text-white"
                  style={{ backgroundColor: B.blue }}
                  onClick={() => onNavigate('unified-parent-dashboard', { tab: 'mentor-services' })}>
                  <Sparkles size={12} className="mr-1.5" /> Find a mentor
                </Button>
              </div>
            ) : (
              <>
                {/* Messages area */}
                <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3" style={{ maxHeight: '260px' }}>
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-6">
                      <RefreshCw size={18} className="animate-spin" style={{ color: B.blue }} />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <MessageSquare size={28} className="mb-2 opacity-20" />
                      <p className="text-xs text-gray-400">No messages yet</p>
                      <p className="text-[10px] text-gray-300 mt-1">Send a note to your mentor below</p>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isParent = msg.sender_role === 'parent';
                      return (
                        <div key={msg.id} className={`flex gap-2 ${isParent ? 'flex-row-reverse' : ''}`}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                            style={{ backgroundColor: isParent ? B.blue : B.teal }}>
                            {(msg.sender_name || (isParent ? 'P' : 'M')).charAt(0).toUpperCase()}
                          </div>
                          <div className={`max-w-[75%] ${isParent ? 'items-end' : 'items-start'} flex flex-col`}>
                            <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                              isParent ? 'rounded-tr-sm' : 'rounded-tl-sm'
                            }`}
                              style={{
                                backgroundColor: isParent ? `${B.blue}12` : `${B.teal}12`,
                                color: '#374151',
                              }}>
                              {msg.message}
                            </div>
                            <span className="text-[9px] text-gray-300 mt-0.5 px-1">
                              {msg.sender_name} · {timeAgo(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={msgEndRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-gray-50 shrink-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={msgInput}
                      onChange={e => setMsgInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Write a note to your mentor…"
                      className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-300 transition-colors"
                    />
                    <Button size="sm"
                      className="h-8 w-8 p-0 rounded-xl shrink-0 text-white"
                      style={{ backgroundColor: B.blue }}
                      onClick={sendMessage}
                      disabled={sendingMsg || !msgInput.trim()}>
                      {sendingMsg ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                    </Button>
                  </div>
                  <p className="text-[9px] text-gray-300 mt-1.5 px-1">
                    Notes are private to this session and visible to the mentor
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Past sessions summary */}
          {completedSessions.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                <FileText size={16} style={{ color: B.blue }} />
                <h3 className="text-sm font-semibold" style={{ color: B.blue }}>Past sessions</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {completedSessions.slice(0, 4).map(b => (
                  <div key={b.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: B.teal }}>
                      {(b.mentor_display_name || 'M').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-700 truncate">{b.mentor_display_name}</div>
                      <div className="text-[10px] text-gray-400">{fmt(b.slot_date)} · {b.child_name}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Star size={11} fill={B.teal} stroke="none" />
                      <span className="text-[10px] text-gray-500">{b.mentor_rating?.toFixed(1) || '—'}</span>
                      <Badge className="text-[9px] py-0" style={{ backgroundColor: `${B.teal}15`, color: B.teal }}>
                        Done
                      </Badge>
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
