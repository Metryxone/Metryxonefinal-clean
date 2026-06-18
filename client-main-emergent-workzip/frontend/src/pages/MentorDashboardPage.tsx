import { useState } from 'react';
import { AppTopBar } from '@/components/AppTopBar';
import { GlobalSearch } from '@/components/GlobalSearch';
import { QuickTour } from '@/components/QuickTour';
import { Footer } from '@/components/layout/Footer';
import { Screen } from '../App';
import {
  Calendar, Clock, DollarSign, Star, Users, Video, TrendingUp,
  CalendarCheck, Edit, Eye, Settings, BookOpen, MessageSquare,
  Shield, MapPin, Globe2, Award, BarChart3, ArrowUpRight,
  CheckCircle, Bell, ChevronRight, X,
  PieChart, Activity, UserCheck, ThumbsUp, Flame,
  FileText, Minus, LogOut,
  HelpCircle, Download, Zap, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { VideoCallRoom } from '@/components/video/VideoCallRoom';
import { BookSessionModal, CreatedSession } from '@/components/video/BookSessionModal';
import { Copy, Check } from 'lucide-react';
import { MentorSessionNotes } from '@/components/MentorSessionNotes';
import { FirstLoginProfileModal } from '@/components/FirstLoginProfileModal';
import { Dialog, DialogContent } from '@/components/ui/dialog';

import mentor1 from '@/assets/images/mentor1.png';

const BRAND = { primary: '#344E86', accent: '#4ECDC4' };

interface MentorDashboardPageProps {
  onNavigate: (screen: Screen | string, data?: Record<string, unknown>) => void;
}

interface Session {
  id: number;
  student: string;
  class: string;
  type: string;
  date: string;
  time: string;
  status: 'Confirmed' | 'Pending' | 'Cancelled';
  mode: 'Online' | 'Offline' | 'Hybrid';
  roomId?: string;
  inviteUrl?: string;
}

interface Notification {
  id: number;
  text: string;
  time: string;
  type: 'booking' | 'reminder' | 'review' | 'payout';
  read: boolean;
}

const INITIAL_SESSIONS: Session[] = [
  { id: 1, student: 'Aarav Kapoor',   class: 'Class 10', type: 'Math Tutoring',          date: 'Apr 2, 2026',  time: '4:00 PM', status: 'Confirmed', mode: 'Online' },
  { id: 2, student: 'Meera Joshi',    class: 'Class 12', type: 'Physics Doubt Clearing', date: 'Apr 2, 2026',  time: '5:30 PM', status: 'Confirmed', mode: 'Online' },
  { id: 3, student: 'Rohan Gupta',    class: 'Class 9',  type: 'Study Planning',         date: 'Apr 3, 2026',  time: '3:00 PM', status: 'Pending',   mode: 'Hybrid' },
  { id: 4, student: 'Ishaan Malhotra',class: 'Class 11', type: 'Chemistry Lab Prep',     date: 'Apr 4, 2026',  time: '4:30 PM', status: 'Confirmed', mode: 'Offline' },
  { id: 5, student: 'Diya Agarwal',   class: 'Class 8',  type: 'English Essay Writing',  date: 'Apr 5, 2026',  time: '5:00 PM', status: 'Pending',   mode: 'Online' },
];

const MONTHLY_EARNINGS = [
  { month: 'Oct', amount: 16500 },
  { month: 'Nov', amount: 19200 },
  { month: 'Dec', amount: 21000 },
  { month: 'Jan', amount: 22000 },
  { month: 'Feb', amount: 18400 },
  { month: 'Mar', amount: 24100 },
];

const MY_REVIEWS = [
  { id: 1, student: 'Aarav Kapoor', rating: 5, comment: 'Excellent tutor! Made complex calculus concepts easy to understand.', date: 'Mar 28, 2026', subject: 'Mathematics' },
  { id: 2, student: 'Meera Joshi',  rating: 5, comment: 'Very patient and knowledgeable. Highly recommend for Physics!',      date: 'Mar 22, 2026', subject: 'Physics' },
  { id: 3, student: 'Rohan Gupta',  rating: 4, comment: 'Good session, helped me plan my study schedule effectively.',        date: 'Mar 15, 2026', subject: 'Study Planning' },
  { id: 4, student: 'Diya Agarwal', rating: 5, comment: 'Amazing guidance for essay writing. My child improved significantly.',date: 'Mar 8, 2026',  subject: 'English' },
];

const SUBJECT_DISTRIBUTION = [
  { subject: 'Mathematics',   sessions: 48, pct: 40, color: BRAND.primary },
  { subject: 'Physics',       sessions: 36, pct: 30, color: BRAND.accent },
  { subject: 'Chemistry',     sessions: 18, pct: 15, color: '#8b5cf6' },
  { subject: 'Study Planning',sessions: 12, pct: 10, color: '#f59e0b' },
  { subject: 'English',       sessions: 6,  pct: 5,  color: '#ec4899' },
];

const STUDENT_PROGRESS = [
  { name: 'Aarav Kapoor',    subject: 'Mathematics',   sessions: 12, trend: 'up',     improvement: '+18%', lastScore: '82/100' },
  { name: 'Meera Joshi',     subject: 'Physics',       sessions: 8,  trend: 'up',     improvement: '+24%', lastScore: '76/100' },
  { name: 'Rohan Gupta',     subject: 'Study Planning',sessions: 5,  trend: 'stable', improvement: '+5%',  lastScore: 'N/A' },
  { name: 'Ishaan Malhotra', subject: 'Chemistry',     sessions: 6,  trend: 'up',     improvement: '+12%', lastScore: '71/100' },
  { name: 'Diya Agarwal',    subject: 'English',       sessions: 4,  trend: 'up',     improvement: '+15%', lastScore: '88/100' },
];

const MILESTONES = [
  { label: '100 Sessions Milestone', target: 100,    current: 120,   achieved: true,  icon: BookOpen },
  { label: '50 Unique Students',     target: 50,     current: 38,    achieved: false, icon: Users },
  { label: '4.9 Avg Rating Goal',    target: 4.9,    current: 4.8,   achieved: false, icon: Star },
  { label: '₹1L Lifetime Earnings', target: 100000, current: 96000, achieved: false, icon: Award },
];

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 1, text: 'New booking request from Arjun Singh for Chemistry', time: '2 hours ago',  type: 'booking',  read: false },
  { id: 2, text: 'Session with Meera Joshi starts in 30 minutes',      time: '30 min ago',   type: 'reminder', read: false },
  { id: 3, text: 'You received a new 5-star review!',                  time: '1 day ago',    type: 'review',   read: true },
  { id: 4, text: 'Payout of ₹18,400 processed successfully',          time: '2 days ago',   type: 'payout',   read: true },
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const INITIAL_AVAILABILITY: Record<string, { from: string; to: string; enabled: boolean }> = {
  Mon: { from: '09:00', to: '18:00', enabled: true  },
  Tue: { from: '09:00', to: '18:00', enabled: true  },
  Wed: { from: '10:00', to: '16:00', enabled: true  },
  Thu: { from: '09:00', to: '18:00', enabled: true  },
  Fri: { from: '09:00', to: '20:00', enabled: true  },
  Sat: { from: '10:00', to: '17:00', enabled: true  },
  Sun: { from: '00:00', to: '00:00', enabled: false },
};

const maxEarning = Math.max(...MONTHLY_EARNINGS.map(e => e.amount));

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size} className={i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
      ))}
    </div>
  );
}

function MiniProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}


type Section = 'overview' | 'sessions' | 'earnings' | 'reviews';
const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview',    icon: BarChart3 },
  { id: 'sessions', label: 'My Sessions', icon: Calendar },
  { id: 'earnings', label: 'Earnings',    icon: DollarSign },
  { id: 'reviews',  label: 'Reviews',     icon: MessageSquare },
];

export function MentorDashboardPage({ onNavigate }: MentorDashboardPageProps) {
  const { toast } = useToast();
  const [activeSection, setActiveSection]     = useState<Section>('overview');
  const [sidebarOpen, setSidebarOpen]         = useState(true);
  const [isDarkMode, setIsDarkMode]           = useState(false);
  const [showSearch, setShowSearch]           = useState(false);
  const [showTour, setShowTour]               = useState(false);
  const [sessions, setSessions]               = useState<Session[]>(INITIAL_SESSIONS);
  const [notifications, setNotifications]     = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [availability, setAvailability]       = useState(INITIAL_AVAILABILITY);

  // Modals
  const [activeCall, setActiveCall]           = useState<Session | null>(null);
  const [rescheduleModal, setRescheduleModal] = useState<Session | null>(null);
  const [availModal, setAvailModal]           = useState(false);
  const [bookModal, setBookModal]             = useState(false);
  const [copiedLink, setCopiedLink]           = useState<number | null>(null);
  const [notesSession, setNotesSession]       = useState<Session | null>(null);
  const [showNotesModal, setShowNotesModal]   = useState(false);
  const [rescheduleDate, setRescheduleDate]   = useState('');
  const [rescheduleTime, setRescheduleTime]   = useState('');

  const unreadCount = notifications.filter(n => !n.read).length;
  const confirmedCount = sessions.filter(s => s.status === 'Confirmed').length;
  const nextOnlineSession = sessions.find(s => s.mode === 'Online' && s.status === 'Confirmed');

  const handleLogout = async () => {
    try { await fetch('/api/logout', { method: 'POST', credentials: 'include' }); } catch {}
    localStorage.removeItem('metryx_token');
    onNavigate('login');
  };

  const dismissNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast({ title: 'Notification dismissed', description: '' });
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast({ title: 'All notifications marked as read' });
  };

  const cancelSession = (id: number) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'Cancelled' } : s));
    toast({ title: 'Session cancelled', description: 'The student has been notified.' });
  };

  const handleReschedule = () => {
    if (!rescheduleDate || !rescheduleTime || !rescheduleModal) return;
    const formatted = new Date(`${rescheduleDate}T${rescheduleTime}`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeFormatted = new Date(`${rescheduleDate}T${rescheduleTime}`).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setSessions(prev => prev.map(s => s.id === rescheduleModal.id ? { ...s, date: formatted, time: timeFormatted, status: 'Pending' } : s));
    toast({ title: 'Session rescheduled', description: `Moved to ${formatted} at ${timeFormatted}. Student notified.` });
    setRescheduleModal(null);
    setRescheduleDate(''); setRescheduleTime('');
  };

  const saveAvailability = () => {
    setAvailModal(false);
    toast({ title: 'Availability saved', description: 'Your schedule has been updated.' });
  };

  const joinVideoCall = (session: Session) => {
    setActiveCall(session);
  };

  const handleSessionCreated = (created: CreatedSession) => {
    const newSession: Session = {
      id: Date.now(),
      student: created.studentName,
      class: '—',
      type: created.sessionType,
      date: created.scheduledDate,
      time: created.scheduledTime,
      status: 'Confirmed',
      mode: created.mode,
      roomId: created.roomId,
      inviteUrl: created.inviteUrl,
    };
    setSessions(prev => [newSession, ...prev]);
    toast({ title: 'Session booked!', description: `Invite link ready for ${created.studentName}.` });
  };

  const copySessionLink = async (session: Session) => {
    const link = session.inviteUrl || `${window.location.origin}/join-session?room=${session.roomId}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(session.id);
    toast({ title: 'Link copied!', description: `Share with ${session.student}` });
    setTimeout(() => setCopiedLink(null), 3000);
  };

  // ── Renders ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-['Inter',sans-serif]" data-testid="mentor-dashboard-page">
      <AppTopBar
        title={NAV_ITEMS.find(n => n.id === activeSection)?.label ?? 'Mentor Dashboard'}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onSearch={() => setShowSearch(true)}
        onTour={() => setShowTour(true)}
        onLogout={handleLogout}
      />

      <FirstLoginProfileModal onCompleteNow={() => setActiveSection('profile' as typeof activeSection)} />

      <div className="flex-1 flex">
        <div className="flex-1 flex max-w-[1400px] mx-auto w-full px-4 py-6 gap-6">

          {/* ── Sidebar ── */}
          <aside className={`shrink-0 transition-all duration-300 hidden md:block ${sidebarOpen ? 'w-56' : 'w-14'}`}>
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden sticky top-[56px]">

              {sidebarOpen && (
                <div className="px-4 py-4 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-full overflow-hidden mb-2 border-2 border-white shadow">
                    <img src={mentor1} alt="Dr. Priya Sharma" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-xs font-semibold text-gray-800 truncate">Dr. Priya Sharma</p>
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                  </div>
                  <p className="text-[10px] text-gray-400 truncate">Mentor · Mathematics, Physics</p>
                  <div className="flex items-center gap-1 mt-1 mb-3">
                    <Star size={10} className="fill-yellow-400 text-yellow-400" />
                    <span className="text-[10px] text-gray-500 font-medium">4.8 · 120 reviews</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((confirmedCount / sessions.length) * 100, 100)}%`, backgroundColor: BRAND.accent }} />
                    </div>
                    <span className="text-[9px] text-gray-400">{confirmedCount}/{sessions.length}</span>
                  </div>
                </div>
              )}

              <nav className="p-2 space-y-0.5">
                {NAV_ITEMS.map(item => {
                  const isActive = activeSection === item.id;
                  return (
                    <button key={item.id} onClick={() => setActiveSection(item.id)}
                      title={!sidebarOpen ? item.label : undefined}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${isActive ? 'text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'} ${!sidebarOpen ? 'justify-center' : ''}`}
                      style={isActive ? { backgroundColor: BRAND.primary } : {}}
                      data-testid={`nav-${item.id}`}>
                      <span className="shrink-0"><item.icon size={16} /></span>
                      {sidebarOpen && <span className="flex-1 text-left">{item.label}</span>}
                      {sidebarOpen && item.id === 'sessions' && unreadCount > 0 && (
                        <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#ef4444' }}>{unreadCount}</span>
                      )}
                    </button>
                  );
                })}

                <div className="pt-2 pb-1 px-2"><div className="h-px bg-gray-100" /></div>

                <button onClick={() => onNavigate('mentor-marketplace')} title={!sidebarOpen ? 'Marketplace' : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-gray-600 hover:bg-gray-50 hover:text-gray-800 ${!sidebarOpen ? 'justify-center' : ''}`}>
                  <span className="shrink-0"><Eye size={16} /></span>
                  {sidebarOpen && <span className="flex-1 text-left">Marketplace</span>}
                </button>

                <button onClick={() => setAvailModal(true)} title={!sidebarOpen ? 'Availability' : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-gray-600 hover:bg-gray-50 hover:text-gray-800 ${!sidebarOpen ? 'justify-center' : ''}`}
                  data-testid="nav-availability">
                  <span className="shrink-0"><Settings size={16} /></span>
                  {sidebarOpen && <span className="flex-1 text-left">Availability</span>}
                </button>
              </nav>

              <div className="p-2 border-t border-gray-100 space-y-0.5">
                <button title={!sidebarOpen ? 'Help' : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 ${!sidebarOpen ? 'justify-center' : ''}`}>
                  <HelpCircle size={16} />
                  {sidebarOpen && <span>Help & Support</span>}
                </button>
                <button title={!sidebarOpen ? 'Collapse' : undefined}
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 ${!sidebarOpen ? 'justify-center' : ''}`}>
                  <ChevronRight size={16} className={`transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
                  {sidebarOpen && <span>Collapse</span>}
                </button>
                <button onClick={handleLogout} title={!sidebarOpen ? 'Sign Out' : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-red-50 hover:text-red-500 ${!sidebarOpen ? 'justify-center' : ''}`}
                  data-testid="button-logout">
                  <LogOut size={16} />
                  {sidebarOpen && <span>Sign Out</span>}
                </button>
              </div>
            </div>
          </aside>

          {/* ── Main Content ── */}
          <main className="flex-1 min-w-0 space-y-6">

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-gray-900">{NAV_ITEMS.find(n => n.id === activeSection)?.label ?? 'Dashboard'}</h1>
                <p className="text-xs text-gray-500">Welcome back, Dr. Priya Sharma · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-100 shadow-sm text-xs text-gray-500">
                  <Shield size={12} style={{ color: BRAND.accent }} />
                  <span className="font-medium" style={{ color: BRAND.accent }}>Verified Mentor</span>
                </div>
                <Button size="sm" className="h-8 text-xs gap-1 text-white" style={{ backgroundColor: BRAND.primary }}
                  onClick={() => setAvailModal(true)} data-testid="button-manage-availability">
                  <Settings size={12} /> Availability
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1"
                  onClick={() => onNavigate('mentor-marketplace')} data-testid="button-view-public">
                  <Eye size={12} /> Public Profile
                </Button>
              </div>
            </div>

            {/* ═══════════════ OVERVIEW ═══════════════ */}
            {activeSection === 'overview' && (
              <div className="space-y-6" data-testid="section-overview">

                {/* Today's Focus Banner */}
                <div className="border border-gray-100 rounded-2xl shadow-sm overflow-hidden bg-white" data-testid="today-focus-banner">
                  <div className="flex flex-col sm:flex-row items-stretch">
                    <div className="flex-1 p-4 flex items-center gap-4" style={{ backgroundColor: `${BRAND.primary}08` }}>
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: BRAND.primary }}>
                        <Zap size={20} className="text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Today's Focus</p>
                        {nextOnlineSession ? (
                          <>
                            <p className="text-sm font-bold mt-0.5 text-gray-800">
                              Next session at {nextOnlineSession.time} with {nextOnlineSession.student}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{nextOnlineSession.type} · {nextOnlineSession.mode}</p>
                          </>
                        ) : (
                          <p className="text-sm font-bold mt-0.5 text-gray-800">No online sessions today</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-4 border-t sm:border-t-0 sm:border-l border-gray-100">
                      {nextOnlineSession ? (
                        <Button size="sm" className="text-xs text-white gap-1.5" style={{ backgroundColor: BRAND.accent }}
                          onClick={() => joinVideoCall(nextOnlineSession)} data-testid="button-join-next">
                          <Video size={13} /> Join Next Session
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="text-xs gap-1.5"
                          onClick={() => setAvailModal(true)}>
                          <Settings size={13} /> Set Availability
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* KPI Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="mentor-stats-row">
                  {[
                    { label: 'Total Sessions', value: sessions.length.toString(), icon: BookOpen, color: BRAND.primary, sub: `${confirmedCount} confirmed`, trend: true },
                    { label: 'Upcoming', value: sessions.filter(s => s.status !== 'Cancelled').length.toString(), icon: CalendarCheck, color: BRAND.accent, sub: `Next: Today ${sessions[0]?.time ?? '—'}`, trend: false },
                    { label: 'Active Students', value: '18', icon: Users, color: '#8b5cf6', sub: '+3 new this month', trend: true },
                    { label: 'Total Earnings', value: '₹96K', icon: DollarSign, color: '#16a34a', sub: '₹24.1K this month', trend: true },
                    { label: 'Avg Rating', value: '4.8', icon: Star, color: '#eab308', sub: `${MY_REVIEWS.length} reviews`, trend: true },
                  ].map((stat, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm" data-testid={`stat-card-${idx}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${stat.color}12` }}>
                          <stat.icon size={18} style={{ color: stat.color }} />
                        </div>
                        {stat.trend && <ArrowUpRight size={14} className="text-teal-500" />}
                      </div>
                      <p className="text-2xl font-bold text-gray-800" data-testid={`stat-value-${idx}`}>{stat.value}</p>
                      <p className="text-[11px] text-gray-500 font-medium mt-0.5">{stat.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{stat.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2" data-testid="quick-actions-card">
                  {[
                    { label: 'Availability', icon: Settings,     action: () => setAvailModal(true) },
                    { label: 'Sessions',     icon: Calendar,     action: () => setActiveSection('sessions') },
                    { label: 'Join Call',    icon: Video,        action: () => nextOnlineSession && joinVideoCall(nextOnlineSession) },
                    { label: 'Marketplace', icon: Eye,          action: () => onNavigate('mentor-marketplace') },
                    { label: 'Earnings',     icon: DollarSign,   action: () => setActiveSection('earnings') },
                    { label: 'Reviews',      icon: MessageSquare,action: () => setActiveSection('reviews') },
                  ].map((a, idx) => (
                    <button key={idx} onClick={a.action}
                      className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all"
                      data-testid={`action-${a.label.toLowerCase().replace(/\s+/g, '-')}`}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}10` }}>
                        <a.icon size={15} style={{ color: BRAND.primary }} />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-700 truncate">{a.label}</span>
                    </button>
                  ))}
                </div>

                {/* Sessions + Availability + Notifications */}
                <div className="grid lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-3 border border-gray-100 rounded-2xl shadow-sm bg-white overflow-hidden" data-testid="upcoming-sessions-preview">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} style={{ color: BRAND.primary }} />
                        <h3 className="text-sm font-semibold text-gray-800">Upcoming Sessions</h3>
                        <span className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: BRAND.accent }}>
                          {sessions.filter(s => s.status !== 'Cancelled').length}
                        </span>
                      </div>
                      <button onClick={() => setActiveSection('sessions')} className="text-xs font-semibold flex items-center gap-1 hover:opacity-80" style={{ color: BRAND.accent }}>
                        View All <ChevronRight size={13} />
                      </button>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {sessions.filter(s => s.status !== 'Cancelled').slice(0, 4).map(session => (
                        <div key={session.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors" data-testid={`session-preview-${session.id}`}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: BRAND.primary }}>
                            {session.student.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{session.student}</p>
                            <p className="text-[11px] text-gray-500 truncate">{session.type} · {session.class}</p>
                          </div>
                          <div className="text-right shrink-0 hidden sm:block">
                            <p className="text-[11px] text-gray-600">{session.date}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{session.time}</p>
                          </div>
                          <span className="text-[9px] font-semibold text-white px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ backgroundColor: session.status === 'Confirmed' ? BRAND.accent : '#f59e0b' }}>
                            {session.status}
                          </span>
                          {session.mode === 'Online' && (
                            <button onClick={() => joinVideoCall(session)}
                              className="h-7 w-7 rounded-xl flex items-center justify-center hover:opacity-80 shrink-0 transition-opacity"
                              style={{ backgroundColor: `${BRAND.accent}15` }}
                              data-testid={`button-quick-join-${session.id}`}>
                              <Video size={12} style={{ color: BRAND.accent }} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-4">
                    {/* Availability summary */}
                    <div className="border border-gray-100 rounded-2xl shadow-sm bg-white p-4" data-testid="weekly-availability">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CalendarCheck size={15} style={{ color: BRAND.primary }} />
                          <h3 className="text-sm font-semibold text-gray-800">This Week</h3>
                        </div>
                        <button onClick={() => setAvailModal(true)} className="text-[11px] font-semibold flex items-center gap-1 hover:opacity-80" style={{ color: BRAND.accent }}>
                          <Settings size={11} /> Manage
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {DAYS_OF_WEEK.map((day) => {
                          const avail = availability[day];
                          const isToday = new Date().toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3) === day;
                          return (
                            <div key={day} className={`text-center p-1.5 rounded-xl cursor-pointer hover:opacity-80 ${isToday ? 'ring-2 ring-[#4ECDC4]/40' : ''}`}
                              style={{ backgroundColor: avail.enabled ? (isToday ? `${BRAND.accent}12` : `${BRAND.primary}08`) : '#f9fafb' }}
                              onClick={() => setAvailModal(true)}>
                              <p className="text-[9px] font-bold mb-1" style={{ color: isToday ? BRAND.accent : avail.enabled ? BRAND.primary : '#9ca3af' }}>{day}</p>
                              <div className={`w-2 h-2 rounded-full mx-auto`} style={{ backgroundColor: avail.enabled ? BRAND.accent : '#e5e7eb' }} />
                              <p className="text-[8px] text-gray-400 mt-1">{avail.enabled ? 'On' : 'Off'}</p>
                            </div>
                          );
                        })}
                      </div>
                      <button onClick={() => setAvailModal(true)}
                        className="mt-3 w-full text-center text-[11px] font-semibold py-1.5 rounded-xl border border-dashed border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors">
                        + Edit availability slots
                      </button>
                    </div>

                    {/* Notifications */}
                    <div className="border border-gray-100 rounded-2xl shadow-sm bg-white overflow-hidden" data-testid="notifications-card">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <Bell size={15} style={{ color: BRAND.primary }} />
                          <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
                          {unreadCount > 0 && (
                            <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full bg-red-500">{unreadCount}</span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button onClick={markAllRead} className="text-[10px] font-semibold hover:opacity-80" style={{ color: BRAND.accent }}>
                            Mark all read
                          </button>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-gray-400">No notifications</div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {notifications.map(notif => (
                            <div key={notif.id} className={`px-4 py-3 flex items-start gap-2.5 transition-colors ${notif.read ? '' : 'bg-blue-50/30'}`} data-testid={`notification-${notif.id}`}>
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{
                                backgroundColor: notif.type === 'booking' ? `${BRAND.accent}15` : notif.type === 'reminder' ? `${BRAND.primary}10` : notif.type === 'review' ? '#fef3c7' : '#dcfce7'
                              }}>
                                {notif.type === 'booking'  && <CalendarCheck size={11} style={{ color: BRAND.accent }} />}
                                {notif.type === 'reminder' && <Clock size={11} style={{ color: BRAND.primary }} />}
                                {notif.type === 'review'   && <Star size={11} className="text-yellow-500" />}
                                {notif.type === 'payout'   && <DollarSign size={11} className="text-teal-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-gray-700 leading-snug">{notif.text}</p>
                                <p className="text-[9px] text-gray-400 mt-0.5">{notif.time}</p>
                              </div>
                              <button onClick={() => dismissNotification(notif.id)} className="text-gray-300 hover:text-gray-500 shrink-0">
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Student Progress */}
                <div className="border border-gray-100 rounded-2xl shadow-sm bg-white overflow-hidden" data-testid="student-progress-tracker">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Activity size={16} style={{ color: BRAND.primary }} />
                      <h3 className="text-sm font-semibold text-gray-800">Student Progress</h3>
                    </div>
                    <span className="text-[11px] text-gray-400">{STUDENT_PROGRESS.length} active students</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500">Student</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500">Subject</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500">Sessions</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500">Last Score</th>
                          <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500">Improvement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {STUDENT_PROGRESS.map((s, idx) => (
                          <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors" data-testid={`student-progress-${idx}`}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: BRAND.primary }}>
                                  {s.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <span className="text-xs font-semibold text-gray-800">{s.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">{s.subject}</td>
                            <td className="px-4 py-2.5 text-xs font-medium text-gray-700">{s.sessions}</td>
                            <td className="px-4 py-2.5 text-xs font-medium text-gray-700">{s.lastScore}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs font-semibold flex items-center gap-1 ${s.trend === 'up' ? 'text-teal-600' : 'text-gray-500'}`}>
                                {s.trend === 'up' ? <TrendingUp size={12} /> : <Minus size={12} />}
                                {s.improvement}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4-col analytics row */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="border border-gray-100 rounded-2xl shadow-sm bg-white overflow-hidden" data-testid="earnings-chart">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2"><TrendingUp size={15} style={{ color: BRAND.primary }} /><h3 className="text-sm font-semibold text-gray-800">Earnings</h3></div>
                      <button onClick={() => setActiveSection('earnings')} className="text-[11px] font-semibold flex items-center gap-0.5 hover:opacity-80" style={{ color: BRAND.accent }}>More <ChevronRight size={12} /></button>
                    </div>
                    <div className="p-4 space-y-2">
                      {MONTHLY_EARNINGS.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[10px] font-medium text-gray-500 w-6 shrink-0">{item.month}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                            <div className="h-full rounded-full flex items-center justify-end pr-1.5 text-[8px] font-bold text-white"
                              style={{ width: `${(item.amount / maxEarning) * 100}%`, backgroundColor: idx === MONTHLY_EARNINGS.length - 1 ? BRAND.accent : BRAND.primary }}>
                              ₹{(item.amount / 1000).toFixed(0)}K
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-gray-100 rounded-2xl shadow-sm bg-white overflow-hidden" data-testid="subject-distribution">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2"><PieChart size={15} style={{ color: BRAND.primary }} /><h3 className="text-sm font-semibold text-gray-800">Subject Mix</h3></div>
                      <span className="text-[10px] text-gray-400">120 total</span>
                    </div>
                    <div className="p-4 space-y-3">
                      {SUBJECT_DISTRIBUTION.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="text-[11px] font-medium text-gray-600 flex-1 truncate">{s.subject}</span>
                          <div className="w-12 bg-gray-100 rounded-full h-3 overflow-hidden shrink-0">
                            <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                          </div>
                          <span className="text-[10px] font-bold w-6 text-right" style={{ color: s.color }}>{s.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-gray-100 rounded-2xl shadow-sm bg-white p-4" data-testid="performance-summary">
                    <div className="flex items-center gap-2 mb-3"><Flame size={15} style={{ color: BRAND.primary }} /><h3 className="text-sm font-semibold text-gray-800">Performance</h3></div>
                    <div className="space-y-2">
                      {[
                        { label: 'Completion', value: '96%',    icon: CheckCircle, color: '#22c55e' },
                        { label: 'Retention',  value: '88%',    icon: UserCheck,   color: BRAND.accent },
                        { label: 'Response',   value: '<2 hrs', icon: Clock,       color: BRAND.primary },
                        { label: 'Views',      value: '342',    icon: Eye,         color: '#8b5cf6' },
                        { label: 'Repeat',     value: '72%',    icon: ThumbsUp,    color: '#f59e0b' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}12` }}>
                            <item.icon size={12} style={{ color: item.color }} />
                          </div>
                          <span className="text-[11px] text-gray-600 flex-1">{item.label}</span>
                          <span className="text-[11px] font-bold" style={{ color: item.color }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-gray-100 rounded-2xl shadow-sm bg-white p-4" data-testid="milestones-card">
                    <div className="flex items-center gap-2 mb-3"><Target size={15} style={{ color: BRAND.primary }} /><h3 className="text-sm font-semibold text-gray-800">Goals</h3></div>
                    <div className="space-y-3.5">
                      {MILESTONES.map((m, idx) => {
                        const pct = Math.min((m.current / m.target) * 100, 100);
                        return (
                          <div key={idx}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                {m.achieved ? <CheckCircle size={11} className="text-teal-500" /> : <m.icon size={11} style={{ color: BRAND.primary }} />}
                                <span className={`text-[10px] font-medium ${m.achieved ? 'text-teal-600 line-through' : 'text-gray-700'}`}>{m.label}</span>
                              </div>
                              <span className="text-[9px] font-bold" style={{ color: m.achieved ? '#22c55e' : BRAND.accent }}>{Math.round(pct)}%</span>
                            </div>
                            <MiniProgressBar value={m.current} max={m.target} color={m.achieved ? '#22c55e' : BRAND.accent} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Recent Reviews */}
                <div className="border border-gray-100 rounded-2xl shadow-sm bg-white overflow-hidden" data-testid="recent-reviews-overview">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2"><MessageSquare size={16} style={{ color: BRAND.primary }} /><h3 className="text-sm font-semibold text-gray-800">Recent Reviews</h3></div>
                    <button onClick={() => setActiveSection('reviews')} className="text-xs font-semibold flex items-center gap-1 hover:opacity-80" style={{ color: BRAND.accent }}>
                      All Reviews <ChevronRight size={13} />
                    </button>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                    {MY_REVIEWS.map(review => (
                      <div key={review.id} className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-7 w-7 rounded-xl flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: BRAND.primary }}>
                            {review.student.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-gray-800">{review.student}</p>
                            <p className="text-[9px] text-gray-400">{review.subject}</p>
                          </div>
                        </div>
                        <StarRating rating={review.rating} size={11} />
                        <p className="text-[11px] text-gray-500 leading-relaxed mt-1.5 line-clamp-2">"{review.comment}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════ SESSIONS ═══════════════ */}
            {activeSection === 'sessions' && (
              <div className="space-y-6" data-testid="section-sessions">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{sessions.filter(s => s.status !== 'Cancelled').length} upcoming · {sessions.filter(s => s.status === 'Cancelled').length} cancelled</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white px-3 py-1 rounded-full" style={{ backgroundColor: BRAND.accent }}>
                      {sessions.filter(s => s.status === 'Confirmed').length} confirmed
                    </span>
                    <span className="text-xs font-semibold text-white px-3 py-1 rounded-full bg-amber-400">
                      {sessions.filter(s => s.status === 'Pending').length} pending
                    </span>
                    <Button size="sm" className="text-xs text-white gap-1.5 h-7" style={{ backgroundColor: BRAND.primary }}
                      onClick={() => setBookModal(true)} data-testid="button-book-session">
                      <Video size={12} /> Book Session
                    </Button>
                  </div>
                </div>

                <div className="border border-gray-100 rounded-2xl shadow-sm bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="sessions-table">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500">Student</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500">Date & Time</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500">Mode</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map(session => (
                          <tr key={session.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${session.status === 'Cancelled' ? 'opacity-50' : ''}`} data-testid={`session-row-${session.id}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: BRAND.primary }}>
                                  {session.student.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-800">{session.student}</p>
                                  <p className="text-[11px] text-gray-400">{session.class}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs text-gray-600 flex items-center gap-1"><Calendar size={11} className="text-gray-400" />{session.date}</p>
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Clock size={11} className="text-gray-400" />{session.time}</p>
                            </td>
                            <td className="px-4 py-3 text-xs font-medium text-gray-700">{session.type}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium flex items-center gap-1 text-gray-600">
                                {session.mode === 'Online' ? <Globe2 size={12} className="text-emerald-500" /> : session.mode === 'Offline' ? <MapPin size={12} className="text-amber-500" /> : <Globe2 size={12} className="text-blue-500" />}
                                {session.mode}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-semibold text-white px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: session.status === 'Confirmed' ? BRAND.accent : session.status === 'Pending' ? '#f59e0b' : '#ef4444' }}>
                                {session.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {session.status !== 'Cancelled' ? (
                                <div className="flex items-center gap-2">
                                  {session.mode === 'Online' && (
                                    <Button size="sm" className="h-7 px-3 text-xs text-white rounded-xl gap-1" style={{ backgroundColor: BRAND.accent }}
                                      onClick={() => joinVideoCall(session)} data-testid={`button-join-session-${session.id}`}>
                                      <Video size={11} /> Join
                                    </Button>
                                  )}
                                  {session.mode === 'Online' && (
                                    <button onClick={() => copySessionLink(session)}
                                      title="Copy student invite link"
                                      className="h-7 w-7 rounded-xl flex items-center justify-center border border-gray-200 hover:border-gray-300 transition-colors"
                                      data-testid={`button-copy-link-${session.id}`}>
                                      {copiedLink === session.id ? <Check size={12} className="text-teal-500" /> : <Copy size={12} className="text-gray-500" />}
                                    </button>
                                  )}
                                  <button onClick={() => { setRescheduleModal(session); setRescheduleDate(''); setRescheduleTime(''); }}
                                    className="text-xs font-medium hover:underline" style={{ color: BRAND.primary }}
                                    data-testid={`button-reschedule-${session.id}`}>
                                    Reschedule
                                  </button>
                                  <button onClick={() => cancelSession(session.id)}
                                    className="text-xs font-medium hover:underline text-red-400 hover:text-red-600"
                                    data-testid={`button-cancel-${session.id}`}>
                                    Cancel
                                  </button>
                                  <button onClick={() => { setNotesSession(session); setShowNotesModal(true); }}
                                    className="text-xs font-medium hover:underline"
                                    style={{ color: '#4ECDC4' }}
                                    data-testid={`button-notes-${session.id}`}>
                                    Notes
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">Cancelled</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════ EARNINGS ═══════════════ */}
            {activeSection === 'earnings' && (
              <div className="space-y-6" data-testid="section-earnings">
                <p className="text-sm text-gray-500">Track your income and payout history</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'This Month',      value: '₹24,100', icon: DollarSign, color: BRAND.accent },
                    { label: 'Last Month',      value: '₹18,400', icon: TrendingUp, color: BRAND.primary },
                    { label: 'Pending Payout',  value: '₹8,200',  icon: Clock,      color: '#f59e0b' },
                    { label: 'Total Lifetime',  value: '₹1,20,100', icon: Award,   color: '#22c55e' },
                  ].map((stat, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${stat.color}12` }}>
                        <stat.icon size={18} style={{ color: stat.color }} />
                      </div>
                      <p className="text-xl font-bold text-gray-800">{stat.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="border border-gray-100 rounded-2xl shadow-sm bg-white overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                      <BarChart3 size={16} style={{ color: BRAND.primary }} />
                      <h3 className="text-sm font-semibold text-gray-800">Monthly Earnings</h3>
                    </div>
                    <div className="p-4 space-y-2.5">
                      {MONTHLY_EARNINGS.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="text-[11px] font-medium text-gray-500 w-7 shrink-0">{item.month}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                            <div className="h-full rounded-full flex items-center justify-end pr-2 text-[9px] font-bold text-white"
                              style={{ width: `${(item.amount / maxEarning) * 100}%`, backgroundColor: idx === MONTHLY_EARNINGS.length - 1 ? BRAND.accent : BRAND.primary }}>
                              ₹{(item.amount / 1000).toFixed(0)}K
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold text-gray-700 w-16 text-right shrink-0">₹{item.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-gray-100 rounded-2xl shadow-sm bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2"><FileText size={16} style={{ color: BRAND.primary }} /><h3 className="text-sm font-semibold text-gray-800">Payout History</h3></div>
                      <button className="text-[11px] font-semibold flex items-center gap-1 hover:opacity-80" style={{ color: BRAND.accent }}>
                        <Download size={11} /> Export
                      </button>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {[
                        { month: 'Mar 2026', amount: '₹24,100', sessions: 28, status: 'Pending' },
                        { month: 'Feb 2026', amount: '₹18,400', sessions: 22, status: 'Paid' },
                        { month: 'Jan 2026', amount: '₹22,000', sessions: 26, status: 'Paid' },
                        { month: 'Dec 2025', amount: '₹21,000', sessions: 25, status: 'Paid' },
                        { month: 'Nov 2025', amount: '₹19,200', sessions: 23, status: 'Paid' },
                      ].map((row, idx) => (
                        <div key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{row.month}</p>
                            <p className="text-[11px] text-gray-400">{row.sessions} sessions</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-800">{row.amount}</span>
                            <span className="text-[10px] font-semibold text-white px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: row.status === 'Paid' ? '#22c55e' : '#f59e0b' }}>
                              {row.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════ REVIEWS ═══════════════ */}
            {activeSection === 'reviews' && (
              <div className="space-y-6" data-testid="section-reviews">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{MY_REVIEWS.length} reviews · 4.8 average rating</p>
                  <StarRating rating={5} size={16} />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Reviews',  value: '120',  icon: MessageSquare, color: BRAND.primary },
                    { label: '5-Star Reviews', value: '98',   icon: Star,          color: '#eab308' },
                    { label: 'Response Rate',  value: '100%', icon: CheckCircle,   color: '#22c55e' },
                    { label: 'Avg Rating',     value: '4.8',  icon: ThumbsUp,      color: BRAND.accent },
                  ].map((stat, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: `${stat.color}12` }}>
                        <stat.icon size={18} style={{ color: stat.color }} />
                      </div>
                      <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="border border-gray-100 rounded-2xl shadow-sm bg-white overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                    <MessageSquare size={16} style={{ color: BRAND.primary }} />
                    <h3 className="text-sm font-semibold text-gray-800">All Reviews</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {MY_REVIEWS.map(review => (
                      <div key={review.id} className="p-4 hover:bg-gray-50/50 transition-colors" data-testid={`review-${review.id}`}>
                        <div className="flex items-start gap-3">
                          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: BRAND.primary }}>
                            {review.student.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <span className="text-xs font-semibold text-gray-800">{review.student}</span>
                                <span className="text-[10px] text-gray-400 ml-2">{review.subject} · {review.date}</span>
                              </div>
                              <StarRating rating={review.rating} size={12} />
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">"{review.comment}"</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ═══════════ BOOK SESSION MODAL ═══════════ */}
      {bookModal && (
        <BookSessionModal
          mentorName="Dr. Priya Sharma"
          onClose={() => setBookModal(false)}
          onSessionCreated={handleSessionCreated}
        />
      )}

      {/* ═══════════ IN-APP VIDEO CALL (WebRTC) ═══════════ */}
      {activeCall && (
        <VideoCallRoom
          roomId={activeCall.roomId || `metryx-session-${activeCall.id}`}
          sessionTitle={`${activeCall.type} · ${activeCall.student}`}
          userName="Dr. Priya Sharma"
          userRole="mentor"
          onLeave={() => {
            setActiveCall(null);
            toast({ title: 'Call ended', description: `Session with ${activeCall.student} ended.` });
          }}
        />
      )}

      {/* ═══════════ RESCHEDULE MODAL ═══════════ */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setRescheduleModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Reschedule Session</h3>
              <button onClick={() => setRescheduleModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl mb-4">
              <p className="text-xs font-semibold text-gray-800">{rescheduleModal.student}</p>
              <p className="text-[11px] text-gray-500">{rescheduleModal.type} · {rescheduleModal.class}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Currently: {rescheduleModal.date} at {rescheduleModal.time}</p>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1 block">New Date</Label>
                <Input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                  className="h-9 text-sm rounded-xl border-gray-200"
                  min={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700 mb-1 block">New Time</Label>
                <Input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                  className="h-9 text-sm rounded-xl border-gray-200" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 text-sm text-white" style={{ backgroundColor: BRAND.primary }}
                onClick={handleReschedule} disabled={!rescheduleDate || !rescheduleTime}>
                Confirm Reschedule
              </Button>
              <Button variant="outline" className="text-sm px-4" onClick={() => setRescheduleModal(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ AVAILABILITY MODAL ═══════════ */}
      {availModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setAvailModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-gray-900">Manage Availability</h3>
                <p className="text-xs text-gray-500 mt-0.5">Set your weekly working hours</p>
              </div>
              <button onClick={() => setAvailModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="space-y-2 mb-5">
              {DAYS_OF_WEEK.map(day => {
                const slot = availability[day];
                return (
                  <div key={day} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 bg-gray-50">
                    <button
                      onClick={() => setAvailability(prev => ({ ...prev, [day]: { ...prev[day], enabled: !prev[day].enabled } }))}
                      className={`w-8 h-5 rounded-full transition-colors shrink-0 relative ${slot.enabled ? '' : 'bg-gray-200'}`}
                      style={slot.enabled ? { backgroundColor: BRAND.accent } : {}}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${slot.enabled ? 'translate-x-3' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-xs font-semibold text-gray-700 w-8 shrink-0">{day}</span>
                    {slot.enabled ? (
                      <>
                        <input type="time" value={slot.from} className="text-xs border border-gray-200 rounded-lg px-2 py-1 flex-1 min-w-0"
                          onChange={e => setAvailability(prev => ({ ...prev, [day]: { ...prev[day], from: e.target.value } }))} />
                        <span className="text-xs text-gray-400 shrink-0">to</span>
                        <input type="time" value={slot.to} className="text-xs border border-gray-200 rounded-lg px-2 py-1 flex-1 min-w-0"
                          onChange={e => setAvailability(prev => ({ ...prev, [day]: { ...prev[day], to: e.target.value } }))} />
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 flex-1">Unavailable</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 text-sm text-white" style={{ backgroundColor: BRAND.primary }} onClick={saveAvailability}>
                Save Availability
              </Button>
              <Button variant="outline" className="text-sm px-4" onClick={() => setAvailModal(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Mentor Session Notes Dialog */}
      <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl">
          {notesSession && (
            <MentorSessionNotes
              bookingId={String(notesSession.id)}
              childId={String(notesSession.id)}
              childName={notesSession.student}
              sessionDate={notesSession.date}
              onClose={() => setShowNotesModal(false)}
              onSubmitted={() => setShowNotesModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Footer />

      {showTour && (
        <QuickTour
          type="mentor"
          onClose={() => setShowTour(false)}
          onNavigate={(tab) => setActiveSection(tab as Section)}
        />
      )}

      {showSearch && (
        <GlobalSearch
          role="mentor"
          onNavigate={(screen) => onNavigate(screen as any)}
          onMenuSelect={(item) => setActiveSection(item as Section)}
          onClose={() => setShowSearch(false)}
          onShowTour={() => setShowTour(true)}
        />
      )}
    </div>
  );
}
