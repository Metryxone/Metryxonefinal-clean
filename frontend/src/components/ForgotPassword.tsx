import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from '../App';
import {
  ArrowLeft, Mail, CheckCircle, KeyRound, Shield, Lock, Clock,
  Loader2, AlertCircle, Smartphone, Eye, EyeOff, RefreshCw, HelpCircle,
  Brain, Sparkles, BarChart3
} from 'lucide-react';

interface ForgotPasswordProps {
  onNavigate: (screen: Screen) => void;
}

type Step = 'identifier' | 'otp' | 'password' | 'success';

export function ForgotPassword({ onNavigate }: ForgotPasswordProps) {
  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const startResendTimer = useCallback(() => {
    setResendTimer(30);
    const tick = () => setResendTimer(t => { if (t <= 1) return 0; setTimeout(tick, 1000); return t - 1; });
    setTimeout(tick, 1000);
  }, []);

  const handleSendOtp = async (identifierOverride?: string) => {
    const id = identifierOverride ?? identifier;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Failed to send OTP.'); return; }
      if (!data.email) {
        setError('No account found with that email. Please try again or contact support.');
        return;
      }
      setEmail(data.email);
      setMaskedEmail(data.maskedEmail);
      setStep('otp');
      setOtp(['', '', '', '', '', '']);
      startResendTimer();
      setResendCount(c => c + 1);
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    setError('');
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
    else if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); otpRefs.current[index - 1]?.focus(); }
    else if (e.key === 'ArrowRight' && index < 5) { e.preventDefault(); otpRefs.current[index + 1]?.focus(); }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...otp];
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) { setError('Please enter the complete 6-digit OTP.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/otp/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code, purpose: 'reset' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Incorrect OTP. Please try again.');
        return;
      }
      setStep('password');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otp.join(''), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'OTP_INVALID') {
          setError('OTP expired or incorrect. Please go back and try again.');
          setStep('otp');
          setOtp(['', '', '', '', '', '']);
        } else {
          setError(data.message ?? 'Failed to reset password.');
        }
        return;
      }
      setStep('success');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  const stepIndex = step === 'identifier' ? 0 : step === 'otp' ? 1 : step === 'password' ? 2 : 3;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Navbar onNavigate={onNavigate} currentScreen="forgot-password" />

      <div className="flex-1 flex pt-16">
        <div className="hidden lg:flex lg:w-[42%] xl:w-[45%] relative overflow-hidden" style={{ backgroundColor: "#0B3C5D" }}>
          <div className="absolute inset-0 opacity-[0.04]">
            <div className="absolute top-20 left-12 w-72 h-72 border border-white rounded-full" />
            <div className="absolute -bottom-16 -right-16 w-96 h-96 border border-white rounded-full" />
            <div className="absolute top-1/3 right-1/4 w-44 h-44 border border-white rounded-full" />
          </div>

          <div className="relative z-10 flex flex-col h-full w-full p-10 xl:p-14">
            <div className="mb-auto">
              <span className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                Metryx<span style={{ color: "#4ECDC4" }}>One</span>
              </span>
              <p className="text-white/40 text-[10px] mt-0.5 tracking-wide uppercase font-medium">Unified Intelligence Platform</p>
            </div>

            <div className="my-auto py-6">
              <h1 className="text-3xl xl:text-[2.2rem] font-extrabold text-white leading-[1.15] mb-5 tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                Secure account<br /><span style={{ color: "#4ECDC4" }}>recovery</span> in minutes.
              </h1>
              <p className="text-sm text-white/50 max-w-sm leading-relaxed mb-10">
                Reset or set your password securely using OTP verification on your registered mobile number.
              </p>

              <div className="space-y-4 mb-10">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">How it works</p>
                {[
                  { icon: Mail, label: 'Enter your email or mobile', step: '1' },
                  { icon: Smartphone, label: 'Verify with OTP', step: '2' },
                  { icon: KeyRound, label: 'Set your new password', step: '3' },
                ].map((s, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: idx < stepIndex ? 'rgba(78,205,196,0.3)' : 'rgba(78,205,196,0.15)' }}>
                      {idx < stepIndex
                        ? <CheckCircle size={18} style={{ color: '#4ECDC4' }} />
                        : <s.icon size={18} style={{ color: '#4ECDC4' }} />}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Step {s.step}</span>
                      <p className="text-sm font-semibold text-white/80">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: 'rgba(78,205,196,0.08)' }}>
                <Clock size={14} style={{ color: '#4ECDC4' }} />
                <p className="text-[11px] text-white/50">OTPs expire in 10 minutes. Reset links are single-use.</p>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap gap-2">
              {[
                { icon: Brain, label: 'LBI Assessment' },
                { icon: Sparkles, label: 'ExamReadiness Index™' },
                { icon: BarChart3, label: 'AI Analytics' },
                { icon: Shield, label: 'DPDP Compliant' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'rgba(78,205,196,0.12)', color: '#4ECDC4' }}>
                  <item.icon size={11} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[58%] xl:w-[55%] flex flex-col">
          <div className="flex items-center justify-between px-6 sm:px-10 lg:px-12 py-4">
            <div className="lg:hidden">
              <span className="text-xl font-bold" style={{ color: "#0B3C5D", fontFamily: "'Inter', sans-serif" }}>
                Metryx<span style={{ color: "#4ECDC4" }}>One</span>
              </span>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-12 pb-8">
            <div className="w-full max-w-[440px]">
              {step !== 'success' && (
                <div className="flex items-center mb-6">
                  <button
                    onClick={() => step === 'identifier' ? onNavigate('login') : step === 'otp' ? setStep('identifier') : setStep('otp')}
                    className="flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70"
                    style={{ color: "#0B3C5D" }}
                    data-testid="link-back"
                  >
                    <ArrowLeft size={16} />
                    {step === 'identifier' ? 'Back to Sign In' : 'Back'}
                  </button>
                </div>
              )}

              <AnimatePresence mode="wait">

                {step === 'identifier' && (
                  <motion.div key="identifier" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                    <div className="mb-6">
                      <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(11,60,93,0.08)' }}>
                        <KeyRound size={26} style={{ color: '#0B3C5D' }} />
                      </div>
                      <h2 className="text-xl font-extrabold tracking-tight mb-1.5" style={{ color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>
                        Forgot your password?
                      </h2>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        Enter your registered email or mobile number. We'll send an OTP to your mobile.
                      </p>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); handleSendOtp(); }} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Email or Mobile Number
                        </Label>
                        <div className="relative">
                          <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                          <Input
                            type="text"
                            placeholder="email@example.com or 9XXXXXXXXX"
                            value={identifier}
                            onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                            required
                            className="h-12 pl-10 rounded-xl text-sm border-2 focus:border-[#0B3C5D]"
                            style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
                            data-testid="input-identifier"
                            autoFocus
                          />
                        </div>
                      </div>

                      <AnimatePresence>
                        {error && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium"
                            style={{ backgroundColor: "rgba(239,68,68,0.06)", color: "#dc2626" }} role="alert">
                            <AlertCircle size={15} />
                            {error}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <Button
                        type="submit"
                        className="w-full h-12 text-sm font-bold rounded-xl text-white transition-all hover:opacity-90"
                        style={{ backgroundColor: "#0B3C5D" }}
                        disabled={loading || !identifier.trim()}
                        data-testid="button-send-otp"
                      >
                        {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Sending OTP...</> : 'Send OTP'}
                      </Button>
                    </form>

                    <div className="flex items-center gap-3 mt-6 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <HelpCircle size={16} style={{ color: "var(--text-muted)" }} />
                      <p className="text-[11px] flex-1" style={{ color: "var(--text-muted)" }}>
                        Registered without a mobile? Contact support to set one up.
                      </p>
                    </div>
                  </motion.div>
                )}

                {step === 'otp' && (
                  <motion.div key="otp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                    <div className="text-center mb-8">
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm"
                        style={{ background: '#0B3C5D' }}
                      >
                        <Shield size={28} className="text-white" />
                      </motion.div>
                      <h2 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>
                        Verify Your Identity
                      </h2>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        We sent a 6-digit code to
                      </p>
                      <p className="text-sm font-bold mt-1 flex items-center justify-center gap-1.5" style={{ color: "#0B3C5D" }}>
                        <Mail size={14} />
                        {maskedEmail}
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6" onPaste={handleOtpPaste}>
                      {otp.map((digit, i) => (
                        <div key={i} className="flex items-center gap-2 sm:gap-3">
                          <motion.div
                            animate={digit ? { scale: [1, 1.05, 1] } : {}}
                            transition={{ duration: 0.15 }}
                          >
                            <input
                              ref={el => { otpRefs.current[i] = el; }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={e => handleOtpChange(i, e.target.value)}
                              onKeyDown={e => handleOtpKeyDown(i, e)}
                              className="w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-extrabold rounded-xl border-2 outline-none transition-all duration-200"
                              style={{
                                backgroundColor: digit ? 'rgba(11,60,93,0.06)' : "var(--bg-primary)",
                                borderColor: digit ? '#0B3C5D' : 'var(--border-subtle)',
                                color: "#0B3C5D",
                                boxShadow: digit ? '0 2px 8px rgba(11,60,93,0.12)' : 'none',
                              }}
                              onFocus={e => { e.target.style.borderColor = '#0B3C5D'; e.target.style.boxShadow = '0 0 0 3px rgba(11,60,93,0.12)'; }}
                              onBlur={e => { e.target.style.borderColor = digit ? '#0B3C5D' : 'var(--border-subtle)'; e.target.style.boxShadow = digit ? '0 2px 8px rgba(11,60,93,0.12)' : 'none'; }}
                              data-testid={`otp-input-${i}`}
                            />
                          </motion.div>
                          {i === 2 && (
                            <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: 'var(--border-subtle)' }} />
                          )}
                        </div>
                      ))}
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                          className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium mb-4"
                          style={{ backgroundColor: "rgba(239,68,68,0.06)", color: "#dc2626" }} role="alert">
                          <AlertCircle size={15} />
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Button
                      onClick={handleVerifyOtp}
                      className="w-full h-12 text-sm font-bold rounded-xl text-white transition-all hover:opacity-90 mb-5"
                      style={{ backgroundColor: otp.join('').length === 6 ? "#0B3C5D" : "#0B3C5D", opacity: otp.join('').length === 6 ? 1 : 0.6 }}
                      disabled={otp.join('').length !== 6 || loading}
                      data-testid="button-verify-otp"
                    >
                      {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Verifying...</> : <>Verify & Continue <ArrowLeft size={14} className="rotate-180 ml-1" /></>}
                    </Button>

                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        <Clock size={12} />
                        <span>Expires in 10 min</span>
                      </div>
                      {resendTimer > 0 ? (
                        <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                          Resend in <span className="font-bold" style={{ color: "#0B3C5D" }}>{resendTimer}s</span>
                        </p>
                      ) : resendCount < 5 ? (
                        <button
                          onClick={() => handleSendOtp(identifier)}
                          disabled={loading}
                          className="text-[11px] font-bold flex items-center gap-1 hover:opacity-70 transition-opacity"
                          style={{ color: '#4ECDC4' }}
                          data-testid="button-resend-otp"
                        >
                          <RefreshCw size={11} /> Resend Code
                        </button>
                      ) : (
                        <p className="text-[11px]" style={{ color: "#dc2626" }}>Max attempts reached</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {step === 'password' && (
                  <motion.div key="password" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                    <div className="mb-6">
                      <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(11,60,93,0.08)' }}>
                        <Lock size={26} style={{ color: '#0B3C5D' }} />
                      </div>
                      <h2 className="text-xl font-extrabold tracking-tight mb-1.5" style={{ color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>
                        Set New Password
                      </h2>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        Choose a strong password for your account.
                      </p>
                    </div>

                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          New Password
                        </Label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Min. 8 characters"
                            value={newPassword}
                            onChange={e => { setNewPassword(e.target.value); setError(''); }}
                            required
                            className="h-12 pl-10 pr-10 rounded-xl text-sm border-2 focus:border-[#0B3C5D]"
                            style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
                            data-testid="input-new-password"
                            autoFocus
                          />
                          <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Confirm Password
                        </Label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                          <Input
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="Re-enter password"
                            value={confirmPassword}
                            onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                            required
                            className="h-12 pl-10 pr-10 rounded-xl text-sm border-2 focus:border-[#0B3C5D]"
                            style={{
                              backgroundColor: "var(--bg-primary)",
                              borderColor: confirmPassword && confirmPassword !== newPassword ? '#dc2626' : confirmPassword && confirmPassword === newPassword ? '#4ECDC4' : 'var(--border-subtle)',
                            }}
                            data-testid="input-confirm-password"
                          />
                          <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      {newPassword.length > 0 && (
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { label: '8+ characters', ok: newPassword.length >= 8 },
                            { label: 'Uppercase letter', ok: /[A-Z]/.test(newPassword) },
                            { label: 'Number', ok: /\d/.test(newPassword) },
                            { label: 'Passwords match', ok: newPassword === confirmPassword && confirmPassword.length > 0 },
                          ].map((req, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: req.ok ? '#4ECDC4' : 'var(--text-muted)' }}>
                              <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-white ${req.ok ? 'bg-teal-500' : 'bg-gray-200'}`}>
                                {req.ok && <CheckCircle size={9} />}
                              </div>
                              {req.label}
                            </div>
                          ))}
                        </div>
                      )}

                      <AnimatePresence>
                        {error && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium"
                            style={{ backgroundColor: "rgba(239,68,68,0.06)", color: "#dc2626" }} role="alert">
                            <AlertCircle size={15} />
                            {error}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <Button
                        type="submit"
                        className="w-full h-12 text-sm font-bold rounded-xl text-white transition-all hover:opacity-90"
                        style={{ backgroundColor: "#0B3C5D" }}
                        disabled={loading || !newPassword || !confirmPassword}
                        data-testid="button-set-password"
                      >
                        {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Setting password...</> : 'Set Password'}
                      </Button>
                    </form>
                  </motion.div>
                )}

                {step === 'success' && (
                  <motion.div key="success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                      className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ backgroundColor: 'rgba(78,205,196,0.1)' }}
                    >
                      <CheckCircle size={32} style={{ color: '#4ECDC4' }} />
                    </motion.div>
                    <h2 className="text-xl font-extrabold tracking-tight mb-2" style={{ color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>
                      Password Set!
                    </h2>
                    <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
                      Your password has been set successfully. You can now log in with your email/mobile and new password.
                    </p>
                    <Button
                      onClick={() => onNavigate('login')}
                      className="w-full h-12 text-sm font-bold rounded-xl text-white transition-all hover:opacity-90"
                      style={{ backgroundColor: "#0B3C5D" }}
                      data-testid="button-go-login"
                    >
                      Go to Sign In
                    </Button>
                  </motion.div>
                )}

              </AnimatePresence>

              <div className="flex items-center justify-center gap-1.5 mt-6 text-[10px]" style={{ color: "var(--text-muted)" }}>
                <Shield size={10} style={{ color: "#4ECDC4" }} />
                <span>256-bit SSL · DPDP Compliant · SOC2 Certified</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
