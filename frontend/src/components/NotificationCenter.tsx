import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, Eye, Info, Mail, MailOpen, Settings, X, Trash2, RefreshCw, Filter, Shield, CreditCard, GraduationCap, BookOpen, Users, MessageSquare, Calendar, FileText, Sparkles, AlertCircle, Zap, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BRAND = { primary: '#0B3C5D', accent: '#4ECDC4' };

type NotificationType = 'fyi' | 'fya';
type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

interface NotificationItem {
  id: string;
  recipientId: string;
  senderId: string | null;
  type: NotificationType;
  category: string;
  title: string;
  message: string;
  actionUrl: string | null;
  actionLabel: string | null;
  priority: NotificationPriority;
  isRead: boolean;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  isEmailSent: boolean;
  metadata: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const SAMPLE_VARIABLES: Record<number, Record<string, string>> = {
  7:  { name: 'Alex' },
  3:  { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  14: { amount: '₹4,999', plan: 'Pro Annual' },
  22: { testName: 'Cognitive Readiness Test', assignedBy: 'Admin' },
  28: { testName: 'Cognitive Readiness Test' },
  32: { reportType: 'LBI', testName: 'Cognitive Readiness Test' },
  33: { studentName: 'Alex' },
  38: { studentName: 'Alex', competency: 'Critical Thinking' },
  45: { mentorName: 'Dr. Priya', date: 'March 15', time: '10:00 AM' },
  12: { endDate: 'March 31, 2026' },
  17: { code: 'SAVE20', discount: '20%', plan: 'Pro' },
  42: {},
  54: { className: 'Study Skills 101', date: 'March 12', time: '4:00 PM' },
  37: { subject: 'Mathematics' },
  9:  { mentorName: 'Dr. Priya' },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  security: { label: 'Security', icon: Shield, color: '#DC2626' },
  onboarding: { label: 'Onboarding', icon: Users, color: '#F59E0B' },
  billing: { label: 'Billing', icon: CreditCard, color: '#0B3C5D' },
  commerce: { label: 'Commerce', icon: CreditCard, color: '#0B3C5D' },
  exam: { label: 'Assessments', icon: GraduationCap, color: BRAND.primary },
  assessment: { label: 'Assessments', icon: GraduationCap, color: BRAND.primary },
  reports: { label: 'Reports', icon: FileText, color: '#4ECDC4' },
  ai_tools: { label: 'AI Tools', icon: Sparkles, color: '#0B3C5D' },
  booking: { label: 'Mentorship', icon: Calendar, color: '#4ECDC4' },
  mentorship: { label: 'Mentorship', icon: Calendar, color: '#4ECDC4' },
  classes: { label: 'Classes', icon: BookOpen, color: '#0B3C5D' },
  compliance: { label: 'Compliance', icon: Shield, color: '#D97706' },
  feedback: { label: 'Feedback', icon: MessageSquare, color: '#4ECDC4' },
  system: { label: 'System', icon: AlertCircle, color: '#0B3C5D' },
  general: { label: 'General', icon: Info, color: '#6B7280' },
  consent: { label: 'Consent', icon: Shield, color: '#4ECDC4' },
  document: { label: 'Documents', icon: FileText, color: '#4ECDC4' },
  subscription: { label: 'Subscription', icon: CreditCard, color: '#0B3C5D' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgent', color: '#DC2626', bg: '#FEE2E2' },
  high: { label: 'High', color: '#D97706', bg: '#FFF7ED' },
  normal: { label: 'Normal', color: '#6B7280', bg: '#F3F4F6' },
  low: { label: 'Low', color: '#9CA3AF', bg: '#F9FAFB' },
};

const TEST_NOTIFICATION_SAMPLES = [
  { id: 7, label: 'Welcome', category: 'onboarding', desc: 'Account activation welcome message' },
  { id: 3, label: 'New Device Login', category: 'security', desc: 'Security alert for new device' },
  { id: 14, label: 'Payment Success', category: 'billing', desc: 'Payment confirmation with receipt' },
  { id: 22, label: 'Test Assigned', category: 'exam', desc: 'New test assigned to student' },
  { id: 28, label: 'Test Submitted', category: 'exam', desc: 'Test completion confirmation' },
  { id: 32, label: 'Report Published', category: 'reports', desc: 'New assessment report available' },
  { id: 33, label: 'AI Insight', category: 'reports', desc: 'AI-powered insights ready' },
  { id: 38, label: 'Competency Mastered', category: 'reports', desc: 'Student mastered a competency' },
  { id: 45, label: 'Session Booked', category: 'booking', desc: 'Mentor session booking confirmation' },
  { id: 12, label: 'Trial Ending', category: 'billing', desc: 'Free trial expiry reminder' },
  { id: 17, label: 'Discount Code', category: 'commerce', desc: 'New promotional discount code' },
  { id: 42, label: 'AI Recommendations', category: 'ai_tools', desc: 'Personalized study plan ready' },
  { id: 54, label: 'Class Scheduled', category: 'classes', desc: 'New class scheduling notification' },
  { id: 37, label: 'Weak Area Found', category: 'reports', desc: 'AI identified improvement area' },
  { id: 9, label: 'Mentor Assigned', category: 'onboarding', desc: 'New mentor assignment' },
];

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getDateGroup(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  if (diffDays < 30) return 'This Month';
  return 'Earlier';
}

function getToken(): string {
  return localStorage.getItem('metryx_token') ?? '';
}

function mapNotification(raw: any): NotificationItem {
  return {
    id: raw.id,
    recipientId: raw.recipient_id ?? raw.recipientId,
    senderId: raw.sender_id ?? raw.senderId ?? null,
    type: raw.type,
    category: raw.category,
    title: raw.title,
    message: raw.message,
    actionUrl: raw.action_url ?? raw.actionUrl ?? null,
    actionLabel: raw.action_label ?? raw.actionLabel ?? null,
    priority: raw.priority,
    isRead: raw.is_read ?? raw.isRead ?? false,
    isAcknowledged: raw.is_acknowledged ?? raw.isAcknowledged ?? false,
    acknowledgedAt: raw.acknowledged_at ?? raw.acknowledgedAt ?? null,
    isEmailSent: raw.is_email_sent ?? raw.isEmailSent ?? false,
    metadata: raw.metadata ?? null,
    expiresAt: raw.expires_at ?? raw.expiresAt ?? null,
    createdAt: raw.created_at ?? raw.createdAt,
  };
}

async function apiCall(path: string, options: RequestInit = {}) {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`/api/notifications${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `API error ${res.status}`);
  }
  return res.json();
}

interface NotificationCenterProps {
  variant?: 'light' | 'dark';
  onNavigate?: (screen: string) => void;
}

export default function NotificationCenter({ variant = 'light', onNavigate }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'fyi' | 'fya' | 'consents' | 'test'>('all');
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const isDark = variant === 'dark';

  const fetchNotifications = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'fyi') params.set('type', 'fyi');
      if (activeTab === 'fya') params.set('type', 'fya');
      if (categoryFilter) params.set('category', categoryFilter);
      const query = params.toString() ? `?${params}` : '';
      const data = await apiCall(`/${query}`);
      const raw: any[] = data.notifications ?? (Array.isArray(data) ? data : []);
      const list: NotificationItem[] = raw.map(mapNotification);
      setNotificationsList(list);
      setUnreadCount(list.filter((n: NotificationItem) => !n.isRead).length);
    } catch (e) {
      console.error('[NotificationCenter] fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, categoryFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.id) fetchNotifications();
      } catch {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  async function markRead(id: string) {
    try {
      await apiCall(`/${id}/read`, { method: 'PATCH' });
      setNotificationsList(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('[NotificationCenter] markRead error:', e);
    }
  }

  async function markAllRead() {
    try {
      await apiCall('/mark-all-read', { method: 'POST' });
      setNotificationsList(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast({ title: 'All notifications marked as read' });
    } catch (e) {
      console.error('[NotificationCenter] markAllRead error:', e);
    }
  }

  async function acknowledge(id: string) {
    try {
      const res = await apiCall(`/${id}/acknowledge`, { method: 'POST' });
      setNotificationsList(prev =>
        prev.map(n => n.id === id ? { ...n, isAcknowledged: true, acknowledgedAt: res.acknowledgedAt ?? new Date().toISOString() } : n)
      );
      toast({ title: 'Notification acknowledged' });
    } catch (e) {
      console.error('[NotificationCenter] acknowledge error:', e);
    }
  }

  async function deleteNotif(id: string) {
    try {
      await apiCall(`/${id}`, { method: 'DELETE' });
      setNotificationsList(prev => {
        const removed = prev.find(n => n.id === id);
        if (removed && !removed.isRead) setUnreadCount(c => Math.max(0, c - 1));
        return prev.filter(n => n.id !== id);
      });
    } catch (e) {
      console.error('[NotificationCenter] delete error:', e);
    }
  }

  async function fireTestNotification(templateId: number) {
    setSendingId(templateId);
    try {
      const variables = SAMPLE_VARIABLES[templateId] ?? {};
      await apiCall('/fire', {
        method: 'POST',
        body: JSON.stringify({ templateId, variables }),
      });
      const sample = TEST_NOTIFICATION_SAMPLES.find(s => s.id === templateId);
      toast({ title: `"${sample?.label ?? 'Notification'}" sent` });
      await fetchNotifications();
    } catch (e: any) {
      toast({ title: e.message ?? 'Failed to send', variant: 'destructive' });
    } finally {
      setSendingId(null);
    }
  }

  const fyiCount = notificationsList.filter(n => n.type === 'fyi' && !n.isRead).length;
  const fyaCount = notificationsList.filter(n => n.type === 'fya' && !n.isAcknowledged).length;

  const activeCategories = Array.from(new Set(notificationsList.map(n => n.category)));

  const filteredList = categoryFilter
    ? notificationsList.filter(n => n.category === categoryFilter)
    : notificationsList;

  const grouped: Record<string, NotificationItem[]> = {};
  filteredList.forEach(n => {
    const group = getDateGroup(n.createdAt);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(n);
  });
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Earlier'];

  function renderCategoryIcon(category: string, size: number = 14) {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
    const IconComponent = config.icon;
    return <IconComponent size={size} style={{ color: config.color }} />;
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) fetchNotifications(); }}
        className={`relative p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
        data-testid="btn-notification-bell"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-white text-xs font-bold flex items-center justify-center px-1"
            style={{ backgroundColor: '#DC2626' }}
            data-testid="badge-unread-count"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 top-12 w-[440px] max-h-[600px] rounded-xl shadow-2xl border z-50 flex flex-col ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
          data-testid="notification-panel"
        >
          <div className={`p-3 border-b flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-bold" style={{ backgroundColor: BRAND.primary }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className={`text-[10px] px-2 py-1 rounded transition-colors ${isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}
                  data-testid="btn-mark-all-read"
                >
                  <CheckCheck className="h-3 w-3 inline mr-0.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1.5 rounded transition-colors ${showFilters ? 'bg-gray-100' : ''} ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                data-testid="btn-toggle-filters"
              >
                <Filter className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={fetchNotifications}
                disabled={isLoading}
                className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                data-testid="btn-refresh-notifications"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setIsOpen(false)} className={`p-1.5 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`} data-testid="btn-close-notifications">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {showFilters && (
            <div className={`px-3 py-2 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={`text-[10px] px-2 py-1 rounded-full font-medium transition-colors ${
                    !categoryFilter
                      ? 'text-white'
                      : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={!categoryFilter ? { backgroundColor: BRAND.primary } : {}}
                  data-testid="filter-all"
                >
                  All
                </button>
                {activeCategories.map(cat => {
                  const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.general;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                      className={`text-[10px] px-2 py-1 rounded-full font-medium transition-colors flex items-center gap-1 ${
                        categoryFilter === cat
                          ? 'text-white'
                          : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      style={categoryFilter === cat ? { backgroundColor: config.color } : {}}
                      data-testid={`filter-${cat}`}
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`flex border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
            {([
              { key: 'all' as const, label: 'All', count: unreadCount },
              { key: 'fyi' as const, label: 'FYI', count: fyiCount },
              { key: 'fya' as const, label: 'Action Required', count: fyaCount },
              { key: 'consents' as const, label: 'Preferences', count: 0 },
              { key: 'test' as const, label: 'Test', count: 0 },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? isDark ? 'border-white text-white' : 'text-gray-900'
                    : isDark ? 'border-transparent text-gray-400 hover:text-gray-200' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                style={activeTab === tab.key ? { borderColor: BRAND.primary } : {}}
                data-testid={`tab-notification-${tab.key}`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className="ml-1 px-1.5 py-0.5 rounded-full text-white text-[9px]"
                    style={{ backgroundColor: tab.key === 'fya' ? '#DC2626' : BRAND.primary }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'test' ? (
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4" style={{ color: BRAND.accent }} />
                  <span className="text-xs font-semibold">Send Test Notifications</span>
                </div>
                <p className={`text-[10px] mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Click any notification type below to send a sample notification to yourself.
                </p>
                <div className="space-y-1.5">
                  {TEST_NOTIFICATION_SAMPLES.map(sample => {
                    const catConfig = CATEGORY_CONFIG[sample.category] || CATEGORY_CONFIG.general;
                    const CatIcon = catConfig.icon;
                    const isSending = sendingId === sample.id;
                    return (
                      <div
                        key={sample.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-750' : 'bg-gray-50 hover:bg-gray-100'}`}
                        data-testid={`test-notif-${sample.id}`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <CatIcon size={14} style={{ color: catConfig.color }} className="flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">{sample.label}</div>
                            <div className={`text-[10px] truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{sample.desc}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => fireTestNotification(sample.id)}
                          disabled={isSending}
                          className="flex-shrink-0 ml-2 px-2.5 py-1.5 rounded-md text-[10px] font-medium text-white transition-colors flex items-center gap-1"
                          style={{ backgroundColor: isSending ? '#94a3b8' : BRAND.primary }}
                          data-testid={`btn-send-test-${sample.id}`}
                        >
                          {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          {isSending ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className={`text-[10px] p-2 rounded-lg mt-3 ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-amber-50 text-amber-700'}`}>
                  {TEST_NOTIFICATION_SAMPLES.length} sample templates available. Notifications are sent to your own account.
                </div>
              </div>
            ) : activeTab === 'consents' ? (
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4" style={{ color: BRAND.primary }} />
                  <span className="text-xs font-semibold">Email Preferences</span>
                </div>
                <p className={`text-[10px] mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Manage which email notifications you receive.
                </p>
                <div className={`text-[10px] p-2 rounded-lg ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-blue-50 text-blue-700'}`}>
                  Open full preferences below to customize each notification type.
                </div>
                {onNavigate && (
                  <button
                    onClick={() => { setIsOpen(false); onNavigate('notification-preferences'); }}
                    className={`w-full mt-3 p-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    data-testid="btn-all-preferences"
                  >
                    <Settings className="h-3 w-3" />
                    View All Notification Preferences
                  </button>
                )}
              </div>
            ) : (
              <div>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" style={{ color: BRAND.primary }} />
                  </div>
                ) : filteredList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Bell className={`h-8 w-8 mb-2 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {categoryFilter ? `No ${CATEGORY_CONFIG[categoryFilter]?.label || categoryFilter} notifications` : 'No notifications yet'}
                    </p>
                  </div>
                ) : (
                  groupOrder
                    .filter(g => grouped[g] && grouped[g].length > 0)
                    .map(group => (
                      <div key={group}>
                        <div className={`sticky top-0 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'bg-gray-800/90 text-gray-400' : 'bg-gray-50/90 text-gray-400'} backdrop-blur-sm`}>
                          {group}
                        </div>
                        {grouped[group].map(notif => (
                          <div
                            key={notif.id}
                            className={`flex gap-2.5 px-3 py-2.5 border-b transition-colors cursor-pointer group ${
                              !notif.isRead
                                ? isDark ? 'bg-blue-950/30 border-gray-700' : 'bg-blue-50/50 border-gray-100'
                                : isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-50 hover:bg-gray-50'
                            }`}
                            onClick={() => { if (!notif.isRead) markRead(notif.id); }}
                            data-testid={`notification-item-${notif.id}`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${(CATEGORY_CONFIG[notif.category] || CATEGORY_CONFIG.general).color}15` }}
                              >
                                {renderCategoryIcon(notif.category, 14)}
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className={`text-xs font-medium leading-tight ${!notif.isRead ? '' : isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                    {notif.title}
                                  </span>
                                  {(notif.priority === 'high' || notif.priority === 'urgent') && (
                                    <span
                                      className="text-[9px] px-1 py-0.5 rounded font-bold"
                                      style={{ backgroundColor: PRIORITY_CONFIG[notif.priority].bg, color: PRIORITY_CONFIG[notif.priority].color }}
                                    >
                                      {notif.priority === 'urgent' ? '!' : 'H'}
                                    </span>
                                  )}
                                </div>
                                <span className={`text-[9px] whitespace-nowrap flex-shrink-0 mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {timeAgo(notif.createdAt)}
                                </span>
                              </div>
                              <p className={`text-[11px] mt-0.5 line-clamp-2 leading-snug ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {notif.message}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded-full font-medium text-white"
                                  style={{ backgroundColor: notif.type === 'fya' ? '#DC2626' : BRAND.primary }}
                                >
                                  {notif.type === 'fya' ? 'Action' : 'Info'}
                                </span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded-full capitalize ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}
                                >
                                  {(CATEGORY_CONFIG[notif.category] || CATEGORY_CONFIG.general).label}
                                </span>
                                {notif.isAcknowledged && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium flex items-center gap-0.5">
                                    <Check className="h-2 w-2" /> Done
                                  </span>
                                )}
                                {notif.isEmailSent && (
                                  <MailOpen className="h-3 w-3" style={{ color: BRAND.accent }} />
                                )}
                              </div>

                              <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {notif.type === 'fya' && !notif.isAcknowledged && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); acknowledge(notif.id); }}
                                    className="text-[10px] px-2 py-0.5 rounded font-medium text-white"
                                    style={{ backgroundColor: BRAND.accent }}
                                    data-testid={`btn-acknowledge-${notif.id}`}
                                  >
                                    <Check className="h-2.5 w-2.5 inline mr-0.5" />
                                    Acknowledge
                                  </button>
                                )}
                                {notif.actionUrl && (
                                  <a
                                    href={notif.actionUrl}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] px-2 py-0.5 rounded font-medium border"
                                    style={{ color: BRAND.primary, borderColor: BRAND.primary }}
                                    data-testid={`btn-action-${notif.id}`}
                                  >
                                    <Eye className="h-2.5 w-2.5 inline mr-0.5" />
                                    {notif.actionLabel || 'View'}
                                  </a>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteNotif(notif.id); }}
                                  className={`text-[10px] p-1 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-400'}`}
                                  data-testid={`btn-delete-notif-${notif.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            {!notif.isRead && (
                              <div className="flex-shrink-0 mt-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND.primary }} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))
                )}
              </div>
            )}
          </div>

          <div className={`p-2.5 border-t flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND.primary }} />
                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Info</span>
              </span>
              <span className="flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Action Required</span>
              </span>
              <span className="flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>High Priority</span>
              </span>
            </div>
            <button
              onClick={() => setActiveTab('consents')}
              className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
              data-testid="btn-goto-consents"
            >
              <Settings className="h-3 w-3" />
              Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
