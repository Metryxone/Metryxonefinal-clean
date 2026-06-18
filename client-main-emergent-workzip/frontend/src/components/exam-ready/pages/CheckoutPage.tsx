import { useState, useEffect } from 'react';
import { Loader2, CreditCard, Shield, Check, Users, Star, Zap, Gift, Lock, FileText, AlertCircle, ChevronRight, Timer, Award, BadgeCheck, Heart } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ExamReadyHeader } from '../components/ExamReadyHeader';
import { ExamReadyFooter } from '../components/ExamReadyFooter';
import { BotWidget } from '../components/BotWidget';
// Razorpay is loaded via script tag; declare its global type
declare global {
  interface Window { Razorpay: any; }
}

interface SubscriptionPackage {
  id: string;
  category?: string;
  productName?: string;
  name?: string;
  studentSegment?: string;
  domainsCovered?: string[];
  features?: string[];
  reportType?: string;
  price: number;
  currency?: string;
  period?: string;
  isRecommended?: boolean;
  isActive?: boolean;
}

interface Props {
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
  isAuthenticated: boolean;
  initialChildName?: string;
  initialBoard?: string;
  initialGrade?: string;
  initialChildId?: string;
}

const brand = {
  primary: '#0B3C5D',
  accent: '#4ECDC4',
  accentHover: '#3dbdb5',
  warning: '#f59e0b',
  success: '#4ECDC4',
  dark: '#0f1f44',
  light: '#f8fafc',
};

const BOARDS = ['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE'];
const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

export function CheckoutPage({ onNavigate, isAuthenticated, initialChildName, initialBoard, initialGrade, initialChildId }: Props) {
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('metryx_token');
    fetch('/api/subscription-packages', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const pkgList = data as SubscriptionPackage[];
        setPackages(pkgList);
        if (pkgList.length > 0) {
          const recommended = pkgList.find(p => p.isRecommended);
          if (recommended) setSelectedPlanId(String(recommended.id));
          else setSelectedPlanId(String(pkgList[0].id));
        }
      })
      .catch(() => setPackages([]))
      .finally(() => setLoadingPackages(false));
  }, []);

  const [selectedPlanId, setSelectedPlanId] = useState<string>('annual');
  const [board, setBoard] = useState(initialBoard || '');
  const [grade, setGrade] = useState(() => {
    const g = initialGrade || '';
    if (!g) return '';
    if (GRADES.includes(g)) return g;
    const num = g.replace(/\D/g, '');
    const match = num ? GRADES.find(gr => gr.includes(num)) : null;
    return match || g;
  });
  const [childName, setChildName] = useState(initialChildName || '');

  // Normalize grade to match Select options (e.g. "9" → "Grade 9")
  const normalizeGrade = (g: string) => {
    if (!g) return '';
    if (GRADES.includes(g)) return g;
    const num = g.replace(/\D/g, '');
    if (num) {
      const match = GRADES.find(gr => gr.includes(num));
      if (match) return match;
    }
    return g;
  };

  // Auto-fill from API if props didn't provide child data
  useEffect(() => {
    if (childName && board && grade) return;
    const token = localStorage.getItem('metryx_token');
    if (!token) return;
    fetch('/api/children', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : [])
      .then((children: any[]) => {
        if (children.length > 0) {
          const child = children[0];
          if (!childName && child.name) setChildName(child.name);
          if (!board && child.board) setBoard(child.board);
          if (!grade && child.grade) setGrade(normalizeGrade(child.grade));
        }
      })
      .catch(() => {});
  }, []);
  const [paying, setPaying] = useState(false);
  const [consentDPDP, setConsentDPDP] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentNonDiagnostic, setConsentNonDiagnostic] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);

  const selectedPlan = packages.find(p => String(p.id) === selectedPlanId);
  const allConsentsChecked = consentDPDP && consentTerms && consentNonDiagnostic;
  const formComplete = board && grade && childName && allConsentsChecked && selectedPlan;

  const handlePayment = async () => {
    if (!isAuthenticated) {
      onNavigate('exam-ready-login');
      return;
    }
    if (!formComplete) return;

    setPaying(true);
    try {
      const token = localStorage.getItem('metryx_token');

      // 1. Create Razorpay order on server
      const orderRes = await fetch('/api/v1/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ plan_id: selectedPlanId }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        // If payment gateway not configured, fall back to demo mode
        if (orderRes.status === 500 && (err.message || '').includes('not configured')) {
          console.warn('Razorpay not configured — proceeding in demo mode');
          setPaying(false);
          onNavigate('exam-ready-assessment-start', { planId: selectedPlanId, board, grade, childName });
          return;
        }
        throw new Error(err.message || 'Failed to create payment order');
      }

      const { orderId, amount, currency, key } = await orderRes.json();

      // 2. Open Razorpay checkout
      const options = {
        key,
        amount,
        currency: currency || 'INR',
        name: 'MetryxOne',
        description: selectedPlan?.productName || 'ExamReadiness Assessment',
        order_id: orderId,
        handler: async (response: any) => {
          // 3. Verify payment on server
          const verifyRes = await fetch('/api/v1/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            credentials: 'include',
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_id: selectedPlanId,
              childId: initialChildId,
            }),
          });
          if (!verifyRes.ok) throw new Error('Payment verification failed');

          setPaying(false);
          onNavigate('exam-ready-assessment-start', { planId: selectedPlanId, board, grade, childName });
        },
        prefill: { name: childName },
        theme: { color: brand.primary },
        modal: { ondismiss: () => setPaying(false) },
      };

      // Load Razorpay script if not already loaded
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Razorpay'));
          document.head.appendChild(script);
        });
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error('[Payment Error]', err);
      setPaying(false);
    }
  };

  const applyPromo = () => {
    if (promoCode.toUpperCase() === 'EXAM25') {
      setPromoApplied(true);
    }
  };

  const basePrice = selectedPlan?.price || 0;
  const originalPrice = Math.round(basePrice * 1.25);
  const finalPrice = promoApplied ? Math.round(basePrice * 0.75) : basePrice;
  const discount = originalPrice - finalPrice;
  const savingsPercent = originalPrice > 0 ? Math.round((1 - basePrice / originalPrice) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 to-white flex flex-col font-['Inter',sans-serif]">
      <ExamReadyHeader 
        showBack 
        onBack={() => onNavigate('exam-ready')} 
        title="Checkout"
        showDashboardLink
        onDashboard={() => onNavigate('unified-parent-dashboard')}
      />

      <main className="flex-1 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {['Select Plan', 'Details', 'Payment'].map((step, idx) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${idx <= 1 ? 'bg-[#0B3C5D] text-white' : 'bg-gray-200 text-gray-500'}`}>
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">{idx + 1}</span>
                  {step}
                </div>
                {idx < 2 && <ChevronRight size={16} className="mx-1 text-gray-300" />}
              </div>
            ))}
          </div>

          {/* Limited Time Banner */}
          <div className="mb-6 p-3 rounded-xl text-center text-white font-medium text-sm" style={{ background: `${brand.primary}` }}>
            <div className="flex items-center justify-center gap-2">
              <Timer size={16} />
              <span>Limited Time Offer: Up to 50% OFF on Annual Plans!</span>
              <Badge className="bg-white/20 text-white border-0 text-xs">Ends Soon</Badge>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Plans */}
            <div className="lg:col-span-2 space-y-5">
              {/* Plan Selection */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brand.primary}12` }}>
                    <Zap size={14} style={{ color: brand.primary }} />
                  </div>
                  <h2 className="text-base font-bold" style={{ color: brand.primary }}>Choose Your Plan</h2>
                </div>

                {loadingPackages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" style={{ color: brand.primary }} />
                  </div>
                ) : packages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No packages available. Please try again later.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-3 gap-4">
                    {packages.slice(0, 6).map((pkg) => {
                      const pkgOriginalPrice = Math.round(pkg.price * 1.25);
                      const pkgSavings = 20;
                      return (
                        <Card 
                          key={pkg.id}
                          className={`relative cursor-pointer transition-all hover:shadow-lg border-2 ${selectedPlanId === String(pkg.id) ? 'shadow-lg' : 'border-gray-100'}`}
                          style={{ borderColor: selectedPlanId === String(pkg.id) ? brand.accent : undefined }}
                          onClick={() => setSelectedPlanId(String(pkg.id))}
                          data-testid={`plan-${pkg.id}`}
                        >
                          {pkg.isRecommended && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                              <Badge className="text-white text-xs font-bold px-3" style={{ backgroundColor: brand.accent }}>
                                <Star size={10} className="mr-1" /> RECOMMENDED
                              </Badge>
                            </div>
                          )}
                          <CardContent className="p-4 pt-5">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <Badge variant="outline" className="text-[10px] mb-2 px-2 py-0.5" style={{ borderColor: brand.accent, color: brand.accent }}>
                                  {(pkg.category || 'ASSESSMENT').toUpperCase()}
                                </Badge>
                                <h3 className="font-bold text-sm" style={{ color: brand.primary }}>{pkg.productName || pkg.name || 'Assessment'}</h3>
                              </div>
                              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${selectedPlanId === String(pkg.id) ? 'border-[#4ECDC4] bg-[#4ECDC4]' : 'border-gray-300'}`}>
                                {selectedPlanId === String(pkg.id) && <Check size={12} className="text-white" />}
                              </div>
                            </div>

                            <div className="mb-3">
                              <div className="flex items-baseline gap-2">
                                <span className="text-xl font-bold" style={{ color: brand.primary }}>₹{pkg.price}</span>
                                <span className="text-xs text-gray-400 line-through">₹{pkgOriginalPrice}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className="text-[10px] px-2 py-0.5 text-white" style={{ backgroundColor: brand.accent }}>
                                  {pkgSavings}% OFF
                                </Badge>
                                <span className="text-xs text-gray-500">{pkg.studentSegment || pkg.period || ''}</span>
                              </div>
                            </div>

                            <div className="space-y-1.5 border-t pt-3">
                              {(pkg.domainsCovered || pkg.features || []).slice(0, 3).map((domain, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                                  <Check size={12} style={{ color: brand.accent }} className="mt-0.5 flex-shrink-0" />
                                  <span>{domain}</span>
                                </div>
                              ))}
                              {(pkg.domainsCovered || []).length > 3 && (
                                <p className="text-xs text-gray-400">+{(pkg.domainsCovered || []).length - 3} more domains</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Student Details */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-6 w-6 rounded flex items-center justify-center" style={{ backgroundColor: `${brand.accent}12` }}>
                      <Users size={12} style={{ color: brand.accent }} />
                    </div>
                    <h2 className="text-sm font-semibold" style={{ color: brand.primary }}>Student Details</h2>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="childName" className="text-sm font-medium">Child's Name</Label>
                      <input
                        id="childName"
                        type="text"
                        value={childName}
                        onChange={(e) => setChildName(e.target.value)}
                        placeholder="Enter name"
                        className="w-full h-10 px-3 rounded-lg border border-gray-200 focus:border-[#2EC4B6] focus:ring-1 focus:ring-[#2EC4B6] outline-none text-sm"
                        data-testid="input-child-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="board" className="text-sm font-medium">Board</Label>
                      <Select value={board} onValueChange={setBoard}>
                        <SelectTrigger className="h-10" data-testid="select-board">
                          <SelectValue placeholder="Select board" />
                        </SelectTrigger>
                        <SelectContent>
                          {BOARDS.map((b) => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grade" className="text-sm font-medium">Grade</Label>
                      <Select value={grade} onValueChange={setGrade}>
                        <SelectTrigger className="h-10" data-testid="select-grade">
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent>
                          {GRADES.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Consent & Agreements */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-6 w-6 rounded flex items-center justify-center" style={{ backgroundColor: `${brand.warning}12` }}>
                      <FileText size={12} style={{ color: brand.warning }} />
                    </div>
                    <h2 className="text-sm font-semibold" style={{ color: brand.primary }}>Consent & Agreements</h2>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 cursor-pointer transition-colors">
                      <Checkbox 
                        checked={consentDPDP} 
                        onCheckedChange={(c) => setConsentDPDP(c as boolean)}
                        className="mt-0.5"
                        data-testid="checkbox-dpdp"
                      />
                      <div>
                        <p className="text-xs font-medium" style={{ color: brand.primary }}>DPDP Act Compliance</p>
                        <p className="text-[10px] text-gray-500">I consent to processing of my child's data as per DPDP Act, 2023.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 cursor-pointer transition-colors">
                      <Checkbox 
                        checked={consentTerms} 
                        onCheckedChange={(c) => setConsentTerms(c as boolean)}
                        className="mt-0.5"
                        data-testid="checkbox-terms"
                      />
                      <div>
                        <p className="text-xs font-medium" style={{ color: brand.primary }}>Terms & Conditions</p>
                        <p className="text-[10px] text-gray-500">I agree to <button className="underline" style={{ color: brand.accent }}>Terms</button> & <button className="underline" style={{ color: brand.accent }}>Privacy</button>.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 cursor-pointer transition-colors">
                      <Checkbox 
                        checked={consentNonDiagnostic} 
                        onCheckedChange={(c) => setConsentNonDiagnostic(c as boolean)}
                        className="mt-0.5"
                        data-testid="checkbox-non-diagnostic"
                      />
                      <div>
                        <p className="text-xs font-medium" style={{ color: brand.primary }}>Non-Diagnostic Acknowledgment</p>
                        <p className="text-[10px] text-gray-500">I understand ExamReadiness Index™ is NOT a clinical diagnostic test.</p>
                      </div>
                    </label>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-20 space-y-4">
                <Card className="border-0 shadow-lg">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-3" style={{ color: brand.primary }}>Order Summary</h3>

                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">{selectedPlan?.productName || 'No plan selected'}</span>
                        <span className="font-medium text-gray-600">₹{originalPrice}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Report Type</span>
                        <span className="font-medium text-gray-600">{selectedPlan?.reportType || '-'}</span>
                      </div>
                      <div className="flex justify-between text-xs" style={{ color: brand.accent }}>
                        <span>Discount ({savingsPercent}% OFF)</span>
                        <span>-₹{originalPrice - basePrice}</span>
                      </div>
                      {promoApplied && (
                        <div className="flex justify-between text-xs" style={{ color: brand.accent }}>
                          <span>Promo (EXAM25)</span>
                          <span>-₹{Math.round(basePrice * 0.25)}</span>
                        </div>
                      )}
                    </div>

                    {/* Promo Code */}
                    <div className="mb-4">
                      {!showPromo ? (
                        <button 
                          onClick={() => setShowPromo(true)}
                          className="text-sm font-medium flex items-center gap-1"
                          style={{ color: brand.accent }}
                        >
                          <Gift size={14} /> Have a promo code?
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            placeholder="Enter code"
                            className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm"
                            data-testid="input-promo"
                          />
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={applyPromo}
                            disabled={promoApplied}
                            data-testid="btn-apply-promo"
                          >
                            {promoApplied ? <Check size={14} /> : 'Apply'}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-200 pt-3 mb-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm" style={{ color: brand.primary }}>Total</span>
                        <div className="text-right">
                          {discount > 0 && <span className="line-through text-gray-400 text-sm mr-2">₹{originalPrice}</span>}
                          <span className="font-bold text-lg" style={{ color: brand.primary }}>₹{finalPrice}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full h-10 text-sm font-semibold text-white"
                      style={{ backgroundColor: formComplete ? brand.accent : '#94a3b8' }}
                      onClick={handlePayment}
                      disabled={paying || !formComplete}
                      data-testid="btn-pay-now"
                    >
                      {paying ? (
                        <Loader2 size={14} className="animate-spin mr-1.5" />
                      ) : (
                        <Zap size={14} className="mr-1.5" />
                      )}
                      {!isAuthenticated
                        ? 'Sign In to Continue'
                        : paying
                          ? 'Processing Payment...'
                          : `Pay ₹${finalPrice} & Start Assessment`}
                    </Button>

                    {!formComplete && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Please complete all fields and agreements
                      </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-center gap-3 text-[10px] text-gray-400">
                        <div className="flex items-center gap-1">
                          <Shield size={10} style={{ color: brand.accent }} />
                          <span>Secure</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Lock size={10} style={{ color: brand.accent }} />
                          <span>SSL</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CreditCard size={10} style={{ color: brand.accent }} />
                          <span>Razorpay</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Trust Signals */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-3">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { icon: BadgeCheck, text: 'DPDP Compliant' },
                        { icon: Shield, text: 'Data Protected' },
                        { icon: Award, text: 'Expert Designed' },
                        { icon: Heart, text: 'Parent Approved' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <item.icon size={11} style={{ color: brand.accent }} />
                          <span>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Guarantee */}
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: `${brand.accent}08` }}>
                  <div className="flex items-center justify-center gap-1.5 text-xs font-medium" style={{ color: brand.accent }}>
                    <Check size={12} />
                    <span>100% Satisfaction Guarantee</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Full refund if not started within 7 days</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ExamReadyFooter onDisclaimerClick={() => onNavigate('exam-ready-disclaimer')} />
      <BotWidget mode="pre-purchase" context="checkout" />
    </div>
  );
}
