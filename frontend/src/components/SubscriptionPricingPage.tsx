import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from "../App";
import {
  Check, X, ArrowRight, Zap, Crown, Building2, Users, Brain,
  Shield, Star, Sparkles, BookOpen, BarChart3, MessageCircle,
  Award, Clock, ChevronDown, ChevronUp, Globe, Lock, Heart,
  HelpCircle, TrendingUp, Timer, Gift, AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";



interface PlatformTier {
  id: string;
  tierKey: string;
  name: string;
  description: string;
  targetAudience: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  maxChildren: number | null;
  maxStudents: number | null;
  maxAssessmentsPerMonth: number | null;
  features: string[];
  featureDescriptions: string[];
  highlightFeature: string | null;
  isPopular: boolean;
  sortOrder: number;
}

interface SubscriptionPackage {
  id: string;
  category: string;
  productName: string;
  studentSegment: string;
  domainsCovered: string[];
  reportType: string;
  price: number | null;
  isRecommended: boolean;
}

interface CurrentSubscription {
  hasSubscription: boolean;
  currentTier: PlatformTier | null;
  subscription: any;
  usage: any;
}

interface Props {
  role?: 'parent' | 'institute';
  onNavigate?: (screen: string) => void;
}

const FAQ_ITEMS = [
  { q: 'Can I change my plan later?', a: 'Absolutely. You can upgrade, downgrade, or cancel your plan at any time. Changes take effect immediately and unused portions are prorated.' },
  { q: 'What happens when my free plan limits are reached?', a: 'You\'ll be notified before reaching limits. Your existing data is never lost — you can upgrade anytime to unlock more features and capacity.' },
  { q: 'Are LBI assessment packages separate from plans?', a: 'Yes. Platform plans give you dashboard access, tracking, and AI features. LBI assessment packages are one-time add-ons that provide deep behavioral insights and can be purchased separately.' },
  { q: 'Is there a free trial for paid plans?', a: 'The Free plan gives you full basic access indefinitely. Paid plans include a 7-day money-back guarantee if you\'re not satisfied.' },
  { q: 'How does billing work for institutes?', a: 'Institute plans are billed annually on a per-seat basis. Volume discounts are available for 500+ students. Contact our sales team for a custom quote.' },
  { q: 'Is my child\'s data secure?', a: 'We are DPDP Act compliant and SOC2 Type II certified. All data is encrypted at rest and in transit. We never share personal data with third parties.' },
];

const TESTIMONIALS = [
  { name: 'Priya M.', role: 'Parent of Class 7 student', text: 'The Pro plan\'s AI study planner completely changed how my daughter prepares for exams. Her scores improved by 15% in just two months.', rating: 5 },
  { name: 'Rajesh K.', role: 'Vice Principal, DPS Bengaluru', text: 'We enrolled 800 students on the School Pro plan. The behavioral insights from LBI assessments help us support students who need it most.', rating: 5 },
  { name: 'Ananya S.', role: 'Parent of Class 10 student', text: 'Started with Free, upgraded to Starter for the AI assistant. It\'s like having a tutor available 24/7. Worth every rupee.', rating: 4 },
];

const TIER_ICONS: Record<string, any> = {
  free: Users,
  starter: Zap,
  pro: Crown,
  institution_starter: Building2,
  institution_pro: Building2,
  enterprise: Star,
};

const TIER_COLORS: Record<string, string> = {
  free: '#64748b',
  starter: BRAND.accent,
  pro: BRAND.primary,
  institution_starter: BRAND.accent,
  institution_pro: BRAND.primary,
  enterprise: '#0B3C5D',
};

const COMPARISON_ROWS = [
  { feature: 'Dashboard Access', free: 'Basic', starter: 'Full', pro: 'Full + Analytics' },
  { feature: 'Children Profiles', free: '1', starter: '2', pro: '5' },
  { feature: 'Exam Tracking', free: true, starter: true, pro: true },
  { feature: 'Progress Reports', free: 'Basic', starter: 'Detailed', pro: 'Advanced' },
  { feature: 'LBI Assessment', free: false, starter: '1 Micro Check', pro: '1 Full Assessment' },
  { feature: 'AI Study Planner', free: false, starter: true, pro: true },
  { feature: 'AI Assistant', free: false, starter: '10 queries/mo', pro: 'Unlimited' },
  { feature: 'Mentor Marketplace', free: false, starter: false, pro: true },
  { feature: 'Curriculum Planner', free: false, starter: false, pro: true },
  { feature: 'Learning Forum', free: false, starter: false, pro: true },
  { feature: 'Email Reports', free: false, starter: 'Weekly', pro: 'Custom Schedule' },
  { feature: 'Priority Support', free: false, starter: false, pro: true },
];

export function SubscriptionPricingPage({ role = 'parent', onNavigate }: Props) {
  const [tiers, setTiers] = useState<PlatformTier[]>([]);
  const [lbiPackages, setLbiPackages] = useState<SubscriptionPackage[]>([]);
  const [currentSub, setCurrentSub] = useState<CurrentSubscription | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const audience = role === 'institute' ? 'institute' : 'parent';
    Promise.all([
      fetch(`/api/platform-tiers?audience=${audience}`).then(r => r.ok ? r.json() : []),
      fetch('/api/subscription-packages').then(r => r.ok ? r.json() : []),
      fetch('/api/subscriptions/me', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ]).then(([tiersData, pkgsData, subData]) => {
      setTiers(tiersData);
      setLbiPackages(pkgsData);
      setCurrentSub(subData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [role]);

  const handleCheckout = async (tierId: string) => {
    setCheckoutLoading(tierId);
    try {
      const res = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tierId, billingCycle }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: 'Plan Activated', description: `You're now on the ${data.tier.name} plan` });
        setCurrentSub({ hasSubscription: true, currentTier: data.tier, subscription: data.subscription, usage: null });
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    }
    setCheckoutLoading(null);
  };

  const handleNavigate = (screen: string) => {
    onNavigate?.(screen);
  };

  const currentTierKey = currentSub?.currentTier?.tierKey || 'free';
  const parentTiers = tiers.filter(t => t.targetAudience === 'parent' || t.targetAudience === 'both');
  const instituteTiers = tiers.filter(t => t.targetAudience === 'institute' || t.targetAudience === 'both');
  const displayTiers = role === 'institute' ? instituteTiers : parentTiers;

  const groupedPackages: Record<string, SubscriptionPackage[]> = {};
  lbiPackages.forEach(pkg => {
    if (!groupedPackages[pkg.category]) groupedPackages[pkg.category] = [];
    groupedPackages[pkg.category].push(pkg);
  });
  const packageCategories = Object.keys(groupedPackages);
  const activeCategory = selectedCategory && packageCategories.includes(selectedCategory)
    ? selectedCategory
    : packageCategories[0] || null;
  const activePkgs = activeCategory ? groupedPackages[activeCategory] : [];

  const CATEGORY_ICONS: Record<string, any> = {
    'Entry (Micro Check)': Zap,
    'Exam-Season Special': AlertCircle,
    'Annual Core': Award,
    'Premium': Crown,
    'Post-Exam': TrendingUp,
    'Post-Exam / Transition': BarChart3,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8fafc' }}>
        <Navbar onNavigate={handleNavigate as (screen: Screen) => void} currentScreen="pricing" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: `${BRAND.primary} transparent ${BRAND.primary} ${BRAND.primary}` }} />
            <p className="text-sm text-gray-400">Loading plans...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8fafc' }}>
      <Navbar onNavigate={handleNavigate as (screen: Screen) => void} currentScreen="pricing" />

      <main className="flex-1" data-testid="subscription-pricing-page">

        {/* ─── HERO ─── */}
        <section className="pt-28 pb-14 relative overflow-hidden" style={{ backgroundColor: BRAND.primary }}>
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'transparent', backgroundSize: '32px 32px' }} />
          <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <Crown size={13} style={{ color: BRAND.accent }} />
              <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                {role === 'institute' ? 'Institute Plans' : 'Plans & Pricing'}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3" data-testid="text-pricing-title">
              {role === 'institute'
                ? 'Scalable Plans for Schools & Institutes'
                : 'Choose the Plan That Fits Your Family'}
            </h1>
            <p className="text-sm md:text-base text-white/60 max-w-xl mx-auto mb-8 leading-relaxed">
              {role === 'institute'
                ? 'Behavioral intelligence, dashboards, and analytics for every institution size.'
                : 'Start free, upgrade when you need more. No hidden fees, cancel anytime.'}
            </p>

            {role === 'parent' && (
              <div className="inline-flex items-center gap-1 p-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} data-testid="billing-toggle">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className="px-5 py-2 rounded-full text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: billingCycle === 'monthly' ? '#fff' : 'transparent',
                    color: billingCycle === 'monthly' ? BRAND.primary : 'rgba(255,255,255,0.6)',
                  }}
                  data-testid="btn-monthly"
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('annual')}
                  className="px-5 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5"
                  style={{
                    backgroundColor: billingCycle === 'annual' ? '#fff' : 'transparent',
                    color: billingCycle === 'annual' ? BRAND.primary : 'rgba(255,255,255,0.6)',
                  }}
                  data-testid="btn-annual"
                >
                  Annual
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: BRAND.accent, color: '#fff' }}>
                    Save 17%
                  </span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ─── PLAN CARDS ─── */}
        <section className="relative -mt-8 pb-16">
          <div className="max-w-6xl mx-auto px-6">

            {currentSub?.hasSubscription && currentSub.currentTier && (
              <div className="mb-6 p-4 rounded-xl border-2 flex items-center justify-between bg-white" style={{ borderColor: BRAND.accent }} data-testid="current-plan-banner">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                    <Crown size={18} style={{ color: BRAND.accent }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      Current Plan: <span style={{ color: BRAND.primary }}>{currentSub.currentTier.name}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {currentSub.subscription?.billingCycle === 'annual' ? 'Annual' : 'Monthly'} billing
                      {currentSub.subscription?.currentPeriodEnd && ` · Renews ${new Date(currentSub.subscription.currentPeriodEnd).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-semibold" style={{ borderColor: BRAND.accent, color: BRAND.accent }}>Active</Badge>
              </div>
            )}

            <div className={`grid gap-5 ${displayTiers.length <= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'}`} data-testid="pricing-grid">
              {displayTiers.map((tier) => {
                const TierIcon = TIER_ICONS[tier.tierKey] || Star;
                const tierColor = TIER_COLORS[tier.tierKey] || BRAND.primary;
                const isCurrentPlan = currentTierKey === tier.tierKey;
                const price = billingCycle === 'annual' ? tier.annualPrice : tier.monthlyPrice;
                const monthlyEquivalent = billingCycle === 'annual' && tier.annualPrice ? Math.round(tier.annualPrice / 12) : tier.monthlyPrice;
                const isCustom = price === null && tier.tierKey !== 'free';
                const isFree = tier.tierKey === 'free';

                return (
                  <div
                    key={tier.id}
                    className={`relative rounded-2xl border-2 bg-white flex flex-col transition-all ${tier.isPopular ? 'shadow-xl ring-1' : 'shadow-sm hover:shadow-lg'}`}
                    style={{
                      borderColor: tier.isPopular ? tierColor : '#e2e8f0',
                      ...(tier.isPopular ? { boxShadow: `0 8px 40px ${tierColor}18` } : {}),
                    }}
                    data-testid={`tier-card-${tier.tierKey}`}
                  >
                    {tier.isPopular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <span className="px-4 py-1.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider shadow-lg" style={{ backgroundColor: tierColor }}>
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${tierColor}10` }}>
                          <TierIcon size={20} style={{ color: tierColor }} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
                          {tier.highlightFeature && (
                            <p className="text-[10px] font-semibold" style={{ color: tierColor }}>{tier.highlightFeature}</p>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-gray-500 mb-5 leading-relaxed">{tier.description}</p>

                      <div className="mb-6">
                        {isFree ? (
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-4xl font-extrabold text-gray-900">Free</span>
                            <span className="text-sm text-gray-400">forever</span>
                          </div>
                        ) : isCustom ? (
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-extrabold text-gray-900">Custom</span>
                            <span className="text-sm text-gray-400">contact us</span>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-baseline gap-0.5">
                              <span className="text-sm text-gray-400 font-medium">&#8377;</span>
                              <span className="text-4xl font-extrabold text-gray-900">{monthlyEquivalent?.toLocaleString()}</span>
                              <span className="text-sm text-gray-400">/mo</span>
                            </div>
                            {billingCycle === 'annual' && tier.annualPrice && (
                              <p className="text-[11px] text-gray-400 mt-1">
                                &#8377;{tier.annualPrice.toLocaleString()}/year · billed annually
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {isCurrentPlan ? (
                        <Button className="w-full h-11 text-sm font-semibold rounded-xl" variant="outline" disabled data-testid={`btn-current-${tier.tierKey}`}>
                          <Check size={15} className="mr-1.5" /> Current Plan
                        </Button>
                      ) : isCustom ? (
                        <Button className="w-full h-11 text-sm font-semibold rounded-xl text-white" style={{ backgroundColor: tierColor }} onClick={() => handleNavigate('contact')} data-testid={`btn-contact-${tier.tierKey}`}>
                          Contact Sales <ArrowRight size={14} className="ml-1.5" />
                        </Button>
                      ) : (
                        <Button
                          className="w-full h-11 text-sm font-semibold rounded-xl text-white"
                          style={{ backgroundColor: tierColor }}
                          onClick={() => handleCheckout(tier.id)}
                          disabled={checkoutLoading === tier.id}
                          data-testid={`btn-select-${tier.tierKey}`}
                        >
                          {checkoutLoading === tier.id ? (
                            <span className="flex items-center gap-2">
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Processing...
                            </span>
                          ) : isFree ? 'Get Started Free' : (
                            <>Upgrade to {tier.name} <ArrowRight size={14} className="ml-1.5" /></>
                          )}
                        </Button>
                      )}

                      <div className="mt-6 pt-5 border-t border-gray-100 flex-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">What's included</p>
                        <ul className="space-y-2.5">
                          {tier.featureDescriptions.map((desc, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-xs text-gray-600">
                              <Check size={14} className="shrink-0 mt-0.5" style={{ color: tierColor }} />
                              <span>{desc}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {(tier.maxChildren || tier.maxStudents || tier.maxAssessmentsPerMonth) && (
                        <div className="mt-4 pt-3 border-t border-gray-50">
                          <div className="flex flex-wrap gap-2">
                            {tier.maxChildren && (
                              <span className="text-[10px] px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 font-medium">{tier.maxChildren} children</span>
                            )}
                            {tier.maxStudents && (
                              <span className="text-[10px] px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 font-medium">{tier.maxStudents} students</span>
                            )}
                            {tier.maxAssessmentsPerMonth && (
                              <span className="text-[10px] px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 font-medium">{tier.maxAssessmentsPerMonth} assessments/mo</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── SOCIAL PROOF BAR ─── */}
        <section className="py-10 border-y" style={{ borderColor: '#e2e8f0', backgroundColor: '#fff' }}>
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6" data-testid="social-proof-stats">
              {[
                { value: '12,400+', label: 'Parents Trust Us', icon: Users },
                { value: '350+', label: 'Schools Enrolled', icon: Building2 },
                { value: '2.1M', label: 'Assessments Done', icon: Brain },
                { value: '4.8/5', label: 'Average Rating', icon: Star },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: `${BRAND.accent}10` }}>
                    <stat.icon size={18} style={{ color: BRAND.accent }} />
                  </div>
                  <p className="text-xl font-extrabold text-gray-900">{stat.value}</p>
                  <p className="text-[11px] text-gray-500 font-medium mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── COMPARE PLANS TABLE ─── */}
        {role === 'parent' && (
          <section className="py-16" style={{ backgroundColor: '#fff' }}>
            <div className="max-w-4xl mx-auto px-6" data-testid="comparison-table">
              <div className="text-center mb-8">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: BRAND.accent }}>Side-by-Side</p>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Compare Plans</h2>
                <p className="text-sm text-gray-500 mt-1">See exactly what you get with each plan</p>
              </div>

              <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <th className="text-left px-5 py-4 font-semibold text-gray-600 w-[220px]">Feature</th>
                      {parentTiers.filter(t => t.tierKey !== 'enterprise').map(t => (
                        <th key={t.id} className="text-center px-4 py-4 font-bold" style={{ color: TIER_COLORS[t.tierKey] }}>
                          {t.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {COMPARISON_ROWS.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : ''} style={i % 2 !== 0 ? { backgroundColor: '#fafbfc' } : {}}>
                        <td className="px-5 py-3 font-medium text-gray-700 text-xs">{row.feature}</td>
                        {['free', 'starter', 'pro'].map(key => {
                          const val = (row as any)[key];
                          return (
                            <td key={key} className="text-center px-4 py-3">
                              {val === true ? (
                                <div className="w-5 h-5 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                                  <Check size={12} style={{ color: BRAND.accent }} />
                                </div>
                              ) : val === false ? (
                                <X size={14} className="mx-auto text-gray-300" />
                              ) : (
                                <span className="text-xs text-gray-600 font-medium">{val}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ─── LBI ASSESSMENT PACKAGES ─── */}
        <section className="py-16" style={{ backgroundColor: '#fff' }}>
          <div className="max-w-5xl mx-auto px-6" data-testid="lbi-packages-section">

            <div className="text-center mb-8">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: BRAND.accent }}>Add-On Assessments</p>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1.5">Behavioral Insight Packages</h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                One-time purchases that reveal what marks alone can't. No subscription needed.
              </p>
            </div>

            {/* Category Tabs */}
            <div className="flex justify-center mb-8">
              <div className="flex gap-1.5 p-1.5 rounded-2xl overflow-x-auto max-w-full" style={{ backgroundColor: '#f1f5f9' }} data-testid="category-tabs">
                {packageCategories.map((category, catIdx) => {
                  const isActive = category === activeCategory;
                  const pkgs = groupedPackages[category];
                  const hasRecommended = pkgs.some(p => p.isRecommended);

                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className="relative px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0"
                      style={{
                        backgroundColor: isActive ? '#fff' : 'transparent',
                        color: isActive ? BRAND.primary : '#64748b',
                        boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                      }}
                      data-testid={`btn-category-${catIdx}`}
                    >
                      {category}
                      {hasRecommended && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ backgroundColor: BRAND.accent }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Category Info Bar */}
            {activeCategory && (
              <div className="flex items-center justify-between mb-5 px-1">
                <div className="flex items-center gap-2.5">
                  {(() => { const CatIcon = CATEGORY_ICONS[activeCategory] || BookOpen; return (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}08` }}>
                      <CatIcon size={16} style={{ color: BRAND.primary }} />
                    </div>
                  ); })()}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{activeCategory}</h3>
                    <p className="text-[11px] text-gray-400">
                      {activePkgs.length} {activePkgs.length === 1 ? 'package' : 'packages'}
                      {(() => {
                        const prices = activePkgs.filter(p => p.price).map(p => p.price!);
                        if (prices.length === 0) return ' · Custom pricing';
                        const min = Math.min(...prices);
                        const max = Math.max(...prices);
                        return min === max ? <> · From &#8377;{min.toLocaleString()}</> : <> · &#8377;{min.toLocaleString()} – &#8377;{max.toLocaleString()}</>;
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><Check size={10} style={{ color: BRAND.accent }} /> Instant access</span>
                  <span className="flex items-center gap-1"><Check size={10} style={{ color: BRAND.accent }} /> One-time payment</span>
                </div>
              </div>
            )}

            {/* Package Cards */}
            {activeCategory && (
              <div className={`grid gap-4 ${activePkgs.length === 1 ? 'max-w-md mx-auto' : activePkgs.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                {activePkgs.map(pkg => (
                  <div
                    key={pkg.id}
                    className={`relative rounded-2xl border bg-white transition-all hover:shadow-lg flex flex-col ${pkg.isRecommended ? 'border-2 shadow-md' : 'shadow-sm'}`}
                    style={{ borderColor: pkg.isRecommended ? BRAND.accent : '#e5e7eb' }}
                    data-testid={`package-${pkg.id}`}
                  >
                    {pkg.isRecommended && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="text-[9px] font-bold px-3 py-1 rounded-full text-white shadow-sm whitespace-nowrap" style={{ backgroundColor: BRAND.accent }}>
                          Recommended
                        </span>
                      </div>
                    )}

                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="text-sm font-bold text-gray-900 leading-snug">{pkg.productName}</h4>
                        {pkg.price ? (
                          <span className="text-lg font-extrabold shrink-0 ml-3" style={{ color: BRAND.primary }}>&#8377;{pkg.price.toLocaleString()}</span>
                        ) : (
                          <span className="text-[11px] text-gray-400 font-semibold shrink-0 ml-3">Custom</span>
                        )}
                      </div>

                      <p className="text-[11px] text-gray-400 mb-3">{pkg.studentSegment}</p>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ backgroundColor: `${BRAND.primary}06`, color: BRAND.primary }}>
                          {pkg.reportType}
                        </span>
                        <span className="text-[10px] text-gray-400">{pkg.domainsCovered.length} domains</span>
                      </div>

                      <ul className="space-y-1.5 mb-4 flex-1">
                        {pkg.domainsCovered.slice(0, 4).map((d, i) => (
                          <li key={i} className="flex items-center gap-2 text-[11px] text-gray-600">
                            <Check size={11} className="shrink-0" style={{ color: BRAND.accent }} />
                            <span className="truncate">{d}</span>
                          </li>
                        ))}
                        {pkg.domainsCovered.length > 4 && (
                          <li className="text-[11px] pl-5 font-medium" style={{ color: BRAND.accent }}>
                            +{pkg.domainsCovered.length - 4} more domains
                          </li>
                        )}
                      </ul>

                      <Button
                        className="w-full h-9 text-xs font-semibold rounded-lg text-white"
                        style={{ backgroundColor: pkg.isRecommended ? BRAND.accent : BRAND.primary }}
                        onClick={() => toast({ title: 'Coming Soon', description: `${pkg.productName} will be available for purchase shortly.` })}
                        data-testid={`btn-buy-${pkg.id}`}
                      >
                        {pkg.price ? 'Get This Assessment' : 'Request Quote'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Help Bar */}
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-500">
              <HelpCircle size={14} style={{ color: BRAND.primary }} />
              <span>Not sure which assessment fits your child?</span>
              <button
                onClick={() => handleNavigate('contact')}
                className="font-semibold underline underline-offset-2"
                style={{ color: BRAND.primary }}
                data-testid="btn-assessment-help"
              >
                Get a free recommendation
              </button>
            </div>

          </div>
        </section>

        {/* ─── SOCIAL PROOF + FAQ (MERGED) ─── */}
        <section className="py-16" style={{ backgroundColor: '#fff' }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-5 gap-10">

              <div className="lg:col-span-3" data-testid="testimonials-section">
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: BRAND.accent }}>Real Results</p>
                  <h2 className="text-xl font-bold text-gray-900">Trusted by 12,400+ Families</h2>
                </div>
                <div className="space-y-4">
                  {TESTIMONIALS.map((t, i) => (
                    <div key={i} className="p-5 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-shadow" data-testid={`testimonial-${i}`}>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ backgroundColor: BRAND.primary }}>
                          {t.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <p className="text-xs font-bold text-gray-900">{t.name}</p>
                              <p className="text-[11px] text-gray-400">{t.role}</p>
                            </div>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, s) => (
                                <Star key={s} size={11} className={s < t.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                              ))}
                            </div>
                          </div>
                          <p className="text-[13px] text-gray-600 leading-relaxed mt-2">"{t.text}"</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  {[
                    { icon: Shield, label: 'DPDP Compliant' },
                    { icon: Lock, label: 'SOC2 Certified' },
                    { icon: Globe, label: '10+ Languages' },
                    { icon: Heart, label: 'Cancel Anytime' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50" data-testid={`trust-badge-${i}`}>
                      <item.icon size={15} style={{ color: BRAND.primary }} />
                      <span className="text-xs font-semibold text-gray-700">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2" data-testid="faq-section">
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: BRAND.accent }}>FAQ</p>
                  <h2 className="text-xl font-bold text-gray-900">Common Questions</h2>
                </div>
                <div className="space-y-2">
                  {FAQ_ITEMS.map((item, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl overflow-hidden bg-white" data-testid={`faq-${i}`}>
                      <button
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50/50 transition-colors"
                      >
                        <span className="text-[13px] font-semibold text-gray-900 pr-3 leading-snug">{item.q}</span>
                        <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                      </button>
                      {openFaq === i && (
                        <div className="px-4 pb-4 pt-0">
                          <p className="text-xs text-gray-500 leading-relaxed">{item.a}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 rounded-xl text-center" style={{ backgroundColor: `${BRAND.accent}08` }}>
                  <p className="text-xs font-semibold text-gray-700 mb-1">Still have questions?</p>
                  <p className="text-[11px] text-gray-500 mb-3">Our team typically responds within 2 hours.</p>
                  <Button
                    className="h-8 px-5 text-[11px] font-semibold rounded-lg text-white"
                    style={{ backgroundColor: BRAND.accent }}
                    onClick={() => handleNavigate('contact')}
                    data-testid="btn-faq-contact"
                  >
                    <MessageCircle size={12} className="mr-1.5" />
                    Chat with Us
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="py-16" style={{ backgroundColor: BRAND.primary }}>
          <div className="max-w-2xl mx-auto px-6 text-center" data-testid="pricing-cta">
            <h3 className="text-2xl font-bold text-white mb-3">Not sure which plan is right?</h3>
            <p className="text-sm text-white/50 mb-7 max-w-md mx-auto leading-relaxed">
              Start with the Free plan and explore. You can upgrade anytime as your needs grow.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                className="text-white font-semibold h-11 px-8 text-sm rounded-full"
                style={{ backgroundColor: BRAND.accent }}
                onClick={() => {
                  const freeTier = tiers.find(t => t.tierKey === 'free');
                  if (freeTier) handleCheckout(freeTier.id);
                }}
                data-testid="btn-start-free"
              >
                Start Free <ArrowRight size={14} className="ml-1.5" />
              </Button>
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 h-11 px-8 text-sm font-medium rounded-full"
                onClick={() => handleNavigate('contact')}
                data-testid="btn-talk-to-sales"
              >
                Talk to Sales
              </Button>
            </div>
            <p className="mt-6 text-xs text-white/40">
              No credit card required · Cancel anytime · DPDP Compliant
            </p>
          </div>
        </section>

      </main>

      <Footer onNavigate={handleNavigate as (screen: Screen) => void} />
    </div>
  );
}
