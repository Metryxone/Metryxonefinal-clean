import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Shield, CreditCard, GraduationCap, BookOpen, Sparkles, Calendar, MessageSquare, FileText, Users, AlertCircle, Info, ChevronLeft, Smartphone, Mail, MessageCircle, Volume2, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BRAND = { primary: '#344E86', accent: '#4ECDC4' };

interface NotificationPreference {
  id: string;
  userId: string;
  category: string;
  appEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
}

interface NotificationTemplate {
  id: number;
  serviceName: string;
  category: string;
  moduleArea: string;
  notificationType: string;
  triggerEvent: string;
  targetAudience: string[];
  channels: string[];
  priority: string;
  type: string;
  titleTemplate: string;
  messageTemplate: string;
  actionLabel?: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; description: string }> = {
  security: { label: 'Security', icon: Shield, color: '#DC2626', description: 'Login OTPs, suspicious activity alerts, role changes' },
  onboarding: { label: 'Onboarding', icon: Users, color: '#F59E0B', description: 'Welcome messages, profile completion, mentor assignment' },
  billing: { label: 'Billing & Payments', icon: CreditCard, color: '#8B5CF6', description: 'Payment receipts, subscription alerts, invoices' },
  commerce: { label: 'Offers & Discounts', icon: CreditCard, color: '#8B5CF6', description: 'Discount codes, expiry reminders, special offers' },
  exam: { label: 'Assessments & Tests', icon: GraduationCap, color: BRAND.primary, description: 'Test assignments, reminders, submissions, results' },
  reports: { label: 'Reports & Insights', icon: FileText, color: '#059669', description: 'Published reports, AI insights, benchmarks, academic alerts' },
  ai_tools: { label: 'AI Tools', icon: Sparkles, color: '#6366F1', description: 'AI test generation, recommendations, usage limits' },
  booking: { label: 'Mentor Sessions', icon: Calendar, color: '#EC4899', description: 'Bookings, confirmations, reminders, cancellations' },
  classes: { label: 'Classes', icon: BookOpen, color: '#0EA5E9', description: 'Scheduled classes, reminders, cancellations, links' },
  compliance: { label: 'Compliance', icon: Shield, color: '#F97316', description: 'Privacy policy updates, consent requests, audit logs' },
  feedback: { label: 'Feedback & Reviews', icon: MessageSquare, color: '#14B8A6', description: 'Session feedback requests, rating notifications' },
  system: { label: 'System', icon: AlertCircle, color: '#6366F1', description: 'System health, AI errors, platform updates' },
};

const CHANNEL_CONFIG = [
  { key: 'appEnabled', label: 'In-App', icon: Smartphone, description: 'Bell icon notifications' },
  { key: 'emailEnabled', label: 'Email', icon: Mail, description: 'Email notifications' },
  { key: 'smsEnabled', label: 'SMS', icon: MessageCircle, description: 'Text messages' },
  { key: 'pushEnabled', label: 'Push', icon: Volume2, description: 'Browser push notifications' },
];

const REQUIRED_CATEGORIES = ['security'];

interface NotificationPreferencesPageProps {
  onNavigate: (screen: string) => void;
}

export default function NotificationPreferencesPage({ onNavigate }: NotificationPreferencesPageProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data: preferences = [] } = useQuery<NotificationPreference[]>({
    queryKey: ['/api/notification-preferences'],
    queryFn: async () => {
      const res = await fetch('/api/notification-preferences', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: templates = [] } = useQuery<NotificationTemplate[]>({
    queryKey: ['/api/notification-templates'],
    queryFn: async () => {
      const res = await fetch('/api/notification-templates', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  function getPref(category: string): NotificationPreference | undefined {
    return preferences.find(p => p.category === category);
  }

  function getChannelValue(category: string, channelKey: string): boolean {
    const pref = getPref(category);
    if (!pref) return channelKey === 'smsEnabled' ? false : true;
    return (pref as any)[channelKey];
  }

  async function toggleChannel(category: string, channelKey: string) {
    if (REQUIRED_CATEGORIES.includes(category)) {
      toast({ title: 'Security notifications cannot be disabled', variant: 'destructive' });
      return;
    }

    setSavingCategory(category);
    const current = getPref(category);
    const body: Record<string, boolean> = {
      appEnabled: current?.appEnabled ?? true,
      emailEnabled: current?.emailEnabled ?? true,
      smsEnabled: current?.smsEnabled ?? false,
      pushEnabled: current?.pushEnabled ?? true,
    };
    body[channelKey] = !body[channelKey];

    try {
      const res = await fetch(`/api/notification-preferences/${category}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');
      queryClient.invalidateQueries({ queryKey: ['/api/notification-preferences'] });
      toast({ title: 'Preference updated' });
    } catch {
      toast({ title: 'Failed to update preference', variant: 'destructive' });
    } finally {
      setSavingCategory(null);
    }
  }

  const templatesByCategory: Record<string, NotificationTemplate[]> = {};
  templates.forEach(t => {
    if (!templatesByCategory[t.category]) templatesByCategory[t.category] = [];
    templatesByCategory[t.category].push(t);
  });

  const categories = Object.keys(CATEGORY_CONFIG);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary, #fff)' }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            data-testid="btn-back"
          >
            <ChevronLeft className="h-5 w-5" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }} data-testid="page-title">
              Notification Preferences
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Control how and when you receive notifications across {categories.length} categories
            </p>
          </div>
        </div>

        <div className="rounded-xl border p-4 mb-6" style={{ backgroundColor: `${BRAND.primary}08`, borderColor: `${BRAND.primary}20` }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}15` }}>
              <Bell className="h-4 w-4" style={{ color: BRAND.primary }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>59 Notification Types</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                MetryxOne sends notifications across {categories.length} categories covering security, assessments, mentorship, billing, and more. 
                Customize which channels each category uses below.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-6">
          {CHANNEL_CONFIG.map(ch => (
            <div key={ch.key} className="flex items-center gap-2 p-2.5 rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
              <ch.icon className="h-4 w-4" style={{ color: BRAND.primary }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{ch.label}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{ch.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {categories.map(catKey => {
            const config = CATEGORY_CONFIG[catKey];
            const isRequired = REQUIRED_CATEGORIES.includes(catKey);
            const catTemplates = templatesByCategory[catKey] || [];
            const isExpanded = expandedCategory === catKey;
            const isSaving = savingCategory === catKey;

            return (
              <div
                key={catKey}
                className="rounded-xl border overflow-hidden transition-shadow hover:shadow-sm"
                style={{ borderColor: 'var(--border-subtle)' }}
                data-testid={`pref-category-${catKey}`}
              >
                <div className="p-3 flex items-center justify-between">
                  <button
                    className="flex items-center gap-3 flex-1 text-left"
                    onClick={() => setExpandedCategory(isExpanded ? null : catKey)}
                    data-testid={`btn-expand-${catKey}`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${config.color}15` }}
                    >
                      <config.icon className="h-4 w-4" style={{ color: config.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{config.label}</span>
                        {isRequired && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-bold">Always On</span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${config.color}10`, color: config.color }}>
                          {catTemplates.length} types
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{config.description}</p>
                    </div>
                  </button>

                  <div className="flex items-center gap-3">
                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: BRAND.accent }} />}
                    {CHANNEL_CONFIG.map(ch => {
                      const enabled = getChannelValue(catKey, ch.key);
                      return (
                        <button
                          key={ch.key}
                          onClick={() => toggleChannel(catKey, ch.key)}
                          disabled={isRequired || isSaving}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            isRequired ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-105'
                          }`}
                          style={{
                            backgroundColor: enabled ? `${config.color}15` : 'var(--bg-secondary, #f9fafb)',
                            border: enabled ? `1.5px solid ${config.color}` : '1.5px solid var(--border-subtle, #e5e7eb)',
                          }}
                          title={`${ch.label}: ${enabled ? 'On' : 'Off'}`}
                          data-testid={`toggle-${catKey}-${ch.key}`}
                        >
                          <ch.icon
                            className="h-3.5 w-3.5"
                            style={{ color: enabled ? config.color : 'var(--text-muted, #9ca3af)' }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isExpanded && catTemplates.length > 0 && (
                  <div className="border-t px-3 py-2" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-secondary, #f9fafb)' }}>
                    <div className="grid gap-1">
                      {catTemplates.map(t => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-white/60 transition-colors"
                          data-testid={`template-${t.id}`}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <div
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  t.priority === 'critical' ? '#DC2626' :
                                  t.priority === 'high' ? '#F97316' :
                                  t.priority === 'medium' ? '#F59E0B' : '#9CA3AF'
                              }}
                            />
                            <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>
                              {t.notificationType}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              t.type === 'fya' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                              {t.type === 'fya' ? 'Action' : 'Info'}
                            </span>
                            <div className="flex gap-0.5">
                              {t.channels.map(ch => (
                                <span key={ch} className="text-[8px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 capitalize">
                                  {ch}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-3 rounded-xl border text-center" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Some notifications (security OTPs, critical alerts) cannot be disabled to ensure account safety.
            <br />
            SMS and Push channels require additional setup. Contact support for assistance.
          </p>
        </div>
      </div>
    </div>
  );
}
