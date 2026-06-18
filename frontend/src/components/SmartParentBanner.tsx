import { useState } from 'react';
import { CheckCircle, ChevronRight, ChevronDown, Bell, X } from 'lucide-react';

export interface SmartAlert {
  type: 'action' | 'warning' | 'info' | 'success' | 'report';
  category: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: () => void;
  actionLabel?: string;
}

interface Props {
  alerts: SmartAlert[];
  childName: string;
}

// Map alert titles to friendly, plain-language versions
function toFriendlyTitle(alert: SmartAlert, childName: string): string {
  const t = alert.title.toLowerCase();
  if (t.includes('lbi') && t.includes('consent')) return `One tap needed to unlock ${childName}'s learning profile`;
  if (t.includes('education board')) return `Tell us which board ${childName} studies under`;
  if (t.includes('grade') || t.includes('class not set')) return `Add ${childName}'s grade to get personalised content`;
  if (t.includes('overdue')) return `${childName} has a task that's past its due date`;
  if (t.includes('due today')) return `A task is due today — just a heads-up`;
  if (t.includes('lbi alert')) return `${childName}'s behavioural profile has a low area — worth checking`;
  if (t.includes('burnout') || t.includes('high pressure')) return `${childName} may be under pressure this week`;
  if (t.includes('mentor session confirmed')) return `Mentor session is confirmed — nothing to do`;
  if (t.includes('mentor session recommended')) return `A mentor could help ${childName} right now`;
  if (t.includes('practice exam') || t.includes('request a practice')) return `Kick off ${childName}'s first practice test`;
  if (t.includes('no study plan')) return `Set up a study routine for ${childName}`;
  if (t.includes('excellent performance')) return `${childName} is doing great — ${alert.title.match(/\d+%/)?.[0] ?? ''} average!`;
  if (t.includes('milestone')) return alert.title;
  return alert.title;
}

function toFriendlyDesc(alert: SmartAlert): string {
  const t = alert.title.toLowerCase();
  if (t.includes('lbi') && t.includes('consent')) return 'Takes 5 seconds — unlocks personalised insights, career mapping, and learning recommendations.';
  if (t.includes('education board')) return 'We need this to show the right curriculum, exam schedule, and AI tips.';
  if (t.includes('grade')) return 'Without a grade, assessments and study plans won\'t match the right level.';
  if (t.includes('overdue')) return 'Quickly review the planner — it should only take a minute.';
  if (t.includes('burnout') || t.includes('high pressure')) return 'Not urgent — but worth a quick check. We\'ve flagged the details below.';
  if (t.includes('mentor session recommended')) return 'No pressure — just a suggestion based on recent scores.';
  return alert.desc;
}

const TYPE_STYLES: Record<SmartAlert['type'], { bg: string; border: string; badge: string; badgeText: string; tagBg: string; tagText: string }> = {
  action: { bg: '#FFF5F5', border: '#FECACA', badge: '#EF4444', badgeText: '#fff', tagBg: '#FEE2E2', tagText: '#DC2626' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', badge: '#D97706', badgeText: '#fff', tagBg: '#FEF3C7', tagText: '#92400E' },
  info: { bg: 'rgba(11,60,93,0.04)', border: 'rgba(11,60,93,0.15)', badge: '#0B3C5D', badgeText: '#fff', tagBg: 'rgba(11,60,93,0.08)', tagText: '#0B3C5D' },
  success: { bg: 'rgba(78,205,196,0.05)', border: 'rgba(78,205,196,0.2)', badge: '#4ECDC4', badgeText: '#fff', tagBg: 'rgba(78,205,196,0.1)', tagText: '#4ECDC4' },
  report: { bg: 'rgba(11,60,93,0.04)', border: 'rgba(11,60,93,0.15)', badge: '#0B3C5D', badgeText: '#fff', tagBg: 'rgba(11,60,93,0.08)', tagText: '#0B3C5D' },
};

const PRIORITY_ORDER: SmartAlert['type'][] = ['action', 'warning', 'info', 'success', 'report'];

export function SmartParentBanner({ alerts, childName }: Props) {
  const [showMore, setShowMore] = useState(false);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  // Sort by priority
  const sorted = [...alerts].sort((a, b) => PRIORITY_ORDER.indexOf(a.type) - PRIORITY_ORDER.indexOf(b.type));
  const active = sorted.filter((_, i) => !dismissed.has(i));

  const urgentCount = active.filter(a => a.type === 'action' || a.type === 'warning').length;
  const primary = active[0];
  const rest = active.slice(1);

  // All-clear state
  if (!primary) {
    return (
      <div className="rounded-2xl border px-4 py-3.5 flex items-center gap-3" style={{ background: 'rgba(78,205,196,0.05)', borderColor: 'rgba(78,205,196,0.2)', fontFamily: 'Inter, sans-serif' }}>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(78,205,196,0.12)' }}>
          <CheckCircle size={18} style={{ color: '#4ECDC4' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: '#4ECDC4' }}>All good — nothing needs your attention right now</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{childName} is on track. We'll surface anything important when it comes up.</p>
        </div>
      </div>
    );
  }

  const style = TYPE_STYLES[primary.type];
  const friendlyTitle = toFriendlyTitle(primary, childName);
  const friendlyDesc = toFriendlyDesc(primary);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }} className="space-y-2">
      {/* Primary card */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: style.bg, borderColor: style.border }}>
        <div className="px-4 py-3.5 flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${style.badge}18` }}>
            <span style={{ color: style.badge }}>{primary.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded" style={{ background: style.tagBg, color: style.tagText }}>
                {primary.category}
              </span>
              {urgentCount > 1 && (
                <span className="text-[9px] font-bold text-gray-400">{urgentCount - 1} more thing{urgentCount > 2 ? 's' : ''} →</span>
              )}
            </div>
            <p className="text-[13px] font-semibold leading-snug" style={{ color: '#1A2540' }}>{friendlyTitle}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{friendlyDesc}</p>
          </div>
        </div>
        {primary.action && primary.actionLabel && (
          <div className="px-4 pb-3.5 flex items-center gap-2">
            <button
              onClick={primary.action}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all"
              style={{ background: style.badge }}
            >
              {primary.actionLabel}
              <ChevronRight size={12} />
            </button>
            {rest.length > 0 && (
              <button
                onClick={() => setShowMore(v => !v)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-medium text-gray-500 hover:bg-black/5 transition-colors"
              >
                <Bell size={11} />
                {rest.length} more
                <ChevronDown size={11} className="transition-transform" style={{ transform: showMore ? 'rotate(180deg)' : 'none' }} />
              </button>
            )}
          </div>
        )}
        {!primary.action && rest.length > 0 && (
          <div className="px-4 pb-3">
            <button
              onClick={() => setShowMore(v => !v)}
              className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Bell size={11} />
              {rest.length} other item{rest.length > 1 ? 's' : ''}
              <ChevronDown size={11} className="transition-transform" style={{ transform: showMore ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>
        )}
      </div>

      {/* Expanded secondary items */}
      {showMore && rest.slice(0, 4).map((alert, i) => {
        const s2 = TYPE_STYLES[alert.type];
        return (
          <div
            key={i}
            className="rounded-xl border px-3.5 py-2.5 flex items-center gap-3"
            style={{ background: s2.bg, borderColor: s2.border }}
          >
            <span style={{ color: s2.badge }} className="flex-shrink-0">{alert.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gray-700 leading-snug truncate">{toFriendlyTitle(alert, childName)}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {alert.action && (
                <button onClick={alert.action} className="text-[10px] font-bold" style={{ color: s2.badge }}>
                  {alert.actionLabel ?? 'View'}
                </button>
              )}
              <button onClick={() => setDismissed(d => new Set([...d, sorted.indexOf(alert)]))} className="text-gray-300 hover:text-gray-400 transition-colors">
                <X size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
