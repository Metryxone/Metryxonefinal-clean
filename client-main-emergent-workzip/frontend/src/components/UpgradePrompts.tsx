import { Button } from "@/components/ui/button";
import { Lock, Crown, ArrowRight, Zap, TrendingUp, AlertCircle } from "lucide-react";

const BRAND = {
  primary: '#0B3C5D',
  accent: '#4ECDC4',
};

interface UpgradePromptProps {
  feature: string;
  currentPlan?: string;
  requiredPlan?: string;
  description?: string;
  onUpgrade: () => void;
  variant?: 'inline' | 'card' | 'banner' | 'overlay';
}

export function UpgradePrompt({ feature, currentPlan, requiredPlan, description, onUpgrade, variant = 'card' }: UpgradePromptProps) {
  if (variant === 'banner') {
    return (
      <div
        className="flex items-center justify-between px-4 py-2.5 rounded-lg border"
        style={{ backgroundColor: `${BRAND.accent}08`, borderColor: `${BRAND.accent}30` }}
        data-testid={`upgrade-banner-${feature}`}
      >
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}20` }}>
            <Zap size={14} style={{ color: BRAND.accent }} />
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>
              {description || `Unlock ${feature}`}
            </p>
            {requiredPlan && (
              <p className="text-[10px] text-muted-foreground">Available on {requiredPlan} plan and above</p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={onUpgrade}
          className="h-7 text-[11px] text-white"
          style={{ backgroundColor: BRAND.accent }}
          data-testid={`btn-upgrade-${feature}`}
        >
          Upgrade <ArrowRight size={12} className="ml-1" />
        </Button>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <button
        onClick={onUpgrade}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors hover:opacity-80"
        style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}
        data-testid={`upgrade-inline-${feature}`}
      >
        <Lock size={10} />
        <span>{requiredPlan || 'Pro'}</span>
      </button>
    );
  }

  if (variant === 'overlay') {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(2px)' }} data-testid={`upgrade-overlay-${feature}`}>
        <div className="text-center p-6 max-w-xs">
          <div className="h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${BRAND.primary}10` }}>
            <Lock size={20} style={{ color: BRAND.primary }} />
          </div>
          <h3 className="text-sm font-bold mb-1" style={{ color: BRAND.primary }}>
            {feature}
          </h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            {description || `This feature requires a ${requiredPlan || 'paid'} plan.`}
          </p>
          {currentPlan && (
            <p className="text-[10px] text-muted-foreground mb-2">
              Current plan: <span className="font-semibold">{currentPlan}</span>
            </p>
          )}
          <Button
            size="sm"
            onClick={onUpgrade}
            className="h-8 text-xs text-white px-4"
            style={{ backgroundColor: BRAND.primary }}
            data-testid={`btn-upgrade-overlay-${feature}`}
          >
            <Crown size={12} className="mr-1" /> View Plans
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border p-4 text-center"
      style={{ backgroundColor: `${BRAND.primary}04`, borderColor: `${BRAND.primary}20` }}
      data-testid={`upgrade-card-${feature}`}
    >
      <div className="h-10 w-10 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: `${BRAND.primary}10` }}>
        <Crown size={18} style={{ color: BRAND.primary }} />
      </div>
      <h4 className="text-xs font-bold mb-1" style={{ color: BRAND.primary }}>
        Upgrade to {requiredPlan || 'unlock'}
      </h4>
      <p className="text-[10px] text-muted-foreground mb-3">
        {description || `Access ${feature} and more powerful features for your child's growth.`}
      </p>
      <Button
        size="sm"
        onClick={onUpgrade}
        className="h-7 text-[11px] text-white w-full"
        style={{ backgroundColor: BRAND.primary }}
        data-testid={`btn-upgrade-card-${feature}`}
      >
        View Plans <ArrowRight size={12} className="ml-1" />
      </Button>
    </div>
  );
}

interface PlanUsageWidgetProps {
  planName: string;
  tierKey: string;
  usageItems: { label: string; current: number; max: number; }[];
  onUpgrade: () => void;
}

export function PlanUsageWidget({ planName, tierKey, usageItems, onUpgrade }: PlanUsageWidgetProps) {
  const isFree = tierKey === 'free';
  const isNearLimit = usageItems.some(item => item.max > 0 && item.current >= item.max * 0.8);

  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: isNearLimit ? `${BRAND.accent}40` : undefined }}
      data-testid="plan-usage-widget"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Crown size={14} style={{ color: isFree ? '#94a3b8' : BRAND.primary }} />
          <span className="text-xs font-bold" style={{ color: BRAND.primary }}>
            {planName} Plan
          </span>
        </div>
        {isFree && (
          <button
            onClick={onUpgrade}
            className="text-[10px] font-semibold flex items-center gap-0.5"
            style={{ color: BRAND.accent }}
            data-testid="btn-plan-upgrade"
          >
            Upgrade <ArrowRight size={10} />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {usageItems.map((item) => {
          const pct = item.max > 0 ? Math.min((item.current / item.max) * 100, 100) : 0;
          const atLimit = item.max > 0 && item.current >= item.max;
          const nearLimit = item.max > 0 && item.current >= item.max * 0.8;

          return (
            <div key={item.label} data-testid={`usage-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
                <span className={`text-[10px] font-medium ${atLimit ? 'text-red-500' : nearLimit ? 'text-amber-500' : ''}`}>
                  {item.current}/{item.max === 999 ? '∞' : item.max}
                </span>
              </div>
              {item.max > 0 && item.max < 999 && (
                <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: atLimit ? '#ef4444' : nearLimit ? '#f59e0b' : BRAND.accent,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isNearLimit && !isFree && (
        <div className="mt-2 flex items-center gap-1.5 p-1.5 rounded" style={{ backgroundColor: '#fef3c7' }}>
          <AlertCircle size={12} className="text-amber-500 shrink-0" />
          <p className="text-[10px] text-amber-700">
            You're approaching your plan limits.{' '}
            <button onClick={onUpgrade} className="font-semibold underline" data-testid="btn-limit-upgrade">
              Upgrade now
            </button>
          </p>
        </div>
      )}

      {isFree && (
        <Button
          size="sm"
          onClick={onUpgrade}
          className="w-full h-7 text-[10px] text-white mt-2"
          style={{ backgroundColor: BRAND.accent }}
          data-testid="btn-free-upgrade"
        >
          <TrendingUp size={12} className="mr-1" /> Unlock More Features
        </Button>
      )}
    </div>
  );
}

interface FeatureLockedCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  requiredPlan: string;
  onUpgrade: () => void;
}

export function FeatureLockedCard({ title, description, icon, requiredPlan, onUpgrade }: FeatureLockedCardProps) {
  return (
    <div className="relative rounded-lg border p-4 opacity-80" data-testid={`locked-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}10` }}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-semibold">{title}</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium text-white" style={{ backgroundColor: BRAND.primary }}>
              <Lock size={8} /> {requiredPlan}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">{description}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={onUpgrade}
            className="h-6 text-[10px]"
            style={{ borderColor: BRAND.primary, color: BRAND.primary }}
            data-testid={`btn-unlock-${title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            Unlock Feature <ArrowRight size={10} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
