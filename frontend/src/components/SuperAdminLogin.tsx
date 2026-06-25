import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import { useState, useEffect } from 'react';
import { Shield, Mail, Lock, ArrowRight, Eye, EyeOff, Loader2, CheckCircle, Home, Map, RefreshCw, AlertCircle, WifiOff, UserX, KeyRound, ShieldOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import metryxLogo from '@/assets/metryx-logo-dark.jpg';



interface SuperAdminLoginProps {
  onLoginSuccess: () => void;
}

export default function SuperAdminLogin({ onLoginSuccess }: SuperAdminLoginProps) {
  const [mode, setMode] = useState<'login' | 'forgot' | 'mfa'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [mfaCode, setMfaCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [mfaAttemptToken, setMfaAttemptToken] = useState('');
  const [mfaEmail, setMfaEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loginError, setLoginError] = useState<{ type: 'credentials' | 'access' | 'network' | 'server' | null; message: string; hint?: string }>({ type: null, message: '' });
  const { toast } = useToast();

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError({ type: null, message: '' });
    
    if (!email || !password) {
      setLoginError({ type: 'credentials', message: 'Both email and password are required.', hint: 'Please fill in all fields before signing in.' });
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: email, password })
      });
      
      let data: any;
      try {
        data = await res.json();
      } catch {
        setLoginError({ type: 'server', message: 'Server returned an unexpected response.', hint: 'The server may be restarting. Please wait a moment and try again.' });
        return;
      }
      
      if (!res.ok) {
        const msg = (data.message || '').toLowerCase();
        if (res.status === 401 || msg.includes('incorrect') || msg.includes('password') || msg.includes('username') || msg.includes('invalid')) {
          setLoginError({
            type: 'credentials',
            message: 'Incorrect email or password.',
            hint: 'Double-check your credentials. Passwords are case-sensitive.'
          });
        } else if (res.status === 403) {
          setLoginError({
            type: 'access',
            message: 'Your account does not have super admin access.',
            hint: 'Contact your platform administrator to request elevated permissions.'
          });
        } else if (res.status >= 500) {
          setLoginError({
            type: 'server',
            message: 'A server error occurred. Please try again shortly.',
            hint: `Error code: ${res.status}. If this persists, contact your system administrator.`
          });
        } else {
          setLoginError({ type: 'server', message: data.message || 'Login failed.', hint: 'Please try again or contact support.' });
        }
        return;
      }
      
      const user = data.user ?? data;
      if (data.mfaRequired) {
        setMfaAttemptToken(data.attemptToken);
        setMfaEmail(data.mfaEmail || 'su***@metryxone.com');
        setMode('mfa');
        setResendCooldown(60);
        if (data.emailSent) {
          toast({ title: 'Verification Code Sent', description: `A 6-digit code has been sent to ${data.mfaEmail || 'support email'}` });
        } else {
          toast({ title: 'Verification Required', description: 'Code generated but email delivery may be delayed. Please check your inbox.', variant: 'destructive' });
        }
      } else if (user?.role === 'super_admin' || (Array.isArray(user?.roles) ? user.roles.includes('super_admin') : String(user?.roles ?? '').includes('super_admin'))) {
        if (data.token) localStorage.setItem('metryx_token', data.token);
        toast({ title: 'Welcome', description: 'Admin access granted' });
        onLoginSuccess();
      } else {
        setLoginError({
          type: 'access',
          message: 'Your account does not have super admin privileges.',
          hint: 'Only accounts with the super_admin role can access this panel. Contact your administrator.'
        });
      }
    } catch (error: any) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setLoginError({
          type: 'network',
          message: 'Unable to reach the server.',
          hint: 'Check your internet connection or try again in a moment.'
        });
      } else {
        setLoginError({ type: 'server', message: error.message || 'An unexpected error occurred.', hint: 'Please try again or contact support.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: 'Error', description: 'Please enter your email address', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (!res.ok) throw new Error('Failed to send reset email');
      
      setResetEmailSent(true);
      toast({ title: 'Email Sent', description: 'Password reset instructions have been sent to your email' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to send password reset email', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaInput = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...mfaCode];
    newCode[index] = value;
    setMfaCode(newCode);
    
    if (value && index < 5) {
      const nextInput = document.getElementById(`mfa-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = mfaCode.join('');
    if (code.length !== 6) {
      toast({ title: 'Error', description: 'Please enter the complete 6-digit code', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ attemptToken: mfaAttemptToken, code })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Verification failed');
      }
      
      toast({ title: 'Welcome', description: 'Authentication successful' });
      onLoginSuccess();
    } catch (error: any) {
      toast({ title: 'Verification Failed', description: error.message, variant: 'destructive' });
      setMfaCode(['', '', '', '', '', '']);
      const firstInput = document.getElementById('mfa-0');
      firstInput?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/mfa/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ attemptToken: mfaAttemptToken })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to resend code');
      }
      
      if (data.attemptToken) {
        setMfaAttemptToken(data.attemptToken);
      }
      setResendCooldown(60);
      setMfaCode(['', '', '', '', '', '']);
      toast({ title: 'New Code Sent', description: `A fresh verification code has been sent to ${data.mfaEmail || mfaEmail}` });
      const firstInput = document.getElementById('mfa-0');
      firstInput?.focus();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div 
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 relative overflow-hidden"
        style={{ backgroundColor: BRAND.primary }}
      >
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-10" style={{ backgroundColor: BRAND.accent }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: BRAND.accent }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-5" style={{ backgroundColor: 'white' }} />
        
        <div className="relative z-10 flex items-center justify-between">
          <img src={metryxLogo} alt="MetryxOne" className="h-12 rounded-lg" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.href = '/?screen=site-map'}
              className="w-10 h-10 flex items-center justify-center rounded-full transition-all bg-white/10 hover:bg-white/20"
              data-testid="button-sitemap"
              title="Site Map"
            >
              <Map className="h-5 w-5 text-white" />
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-10 h-10 flex items-center justify-center rounded-full transition-all"
              style={{ backgroundColor: BRAND.accent }}
              data-testid="button-home"
              title="Home"
            >
              <Home className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Super Admin<br />
            <span style={{ color: BRAND.accent }}>Control Center</span>
          </h1>
          <p className="text-white/60 text-lg max-w-md">
            Manage your entire platform from one powerful dashboard. Monitor, configure, and optimize with ease.
          </p>
          <div className="flex gap-4 pt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BRAND.accent }} />
              <span className="text-white/70 text-sm">Real-time Analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BRAND.accent }} />
              <span className="text-white/70 text-sm">Secure Access</span>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-white/40 text-sm">&copy; 2026 MetryxOne. All rights reserved.</p>
      </div>

      <div className="flex-1 flex flex-col bg-gray-50">
        <div className="lg:hidden p-4 flex items-center justify-between bg-white border-b">
          <img src={metryxLogo} alt="MetryxOne" className="h-8 rounded" />
          <button
            onClick={() => window.location.href = '/'}
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ backgroundColor: BRAND.accent }}
            data-testid="button-home-mobile"
          >
            <Home className="h-4 w-4 text-white" />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg"
                style={{ backgroundColor: BRAND.primary }}
              >
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {mode === 'login' ? 'Welcome Back' : mode === 'mfa' ? 'Verify Identity' : 'Reset Password'}
              </h2>
              <p className="text-gray-500 mt-1 text-sm">
                {mode === 'login' 
                  ? 'Sign in to your admin account'
                  : mode === 'mfa'
                    ? `Code sent to ${mfaEmail}`
                    : resetEmailSent 
                      ? 'Check your email for instructions'
                      : 'Enter your email address'
                }
              </p>
            </div>

            {mode === 'mfa' ? (
              <form onSubmit={handleMfaVerify} className="space-y-6">
                <div className="flex justify-center gap-2">
                  {mfaCode.map((digit, index) => (
                    <input
                      key={index}
                      id={`mfa-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleMfaInput(index, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !digit && index > 0) {
                          const prevInput = document.getElementById(`mfa-${index - 1}`);
                          prevInput?.focus();
                        }
                      }}
                      className="w-11 h-12 text-center text-xl font-bold rounded-xl focus:outline-none transition-all"
                      style={{ 
                        backgroundColor: digit ? `${BRAND.accent}15` : '#f3f4f6',
                        border: `2px solid ${digit ? BRAND.accent : 'transparent'}`
                      }}
                      data-testid={`input-mfa-${index}`}
                    />
                  ))}
                </div>
                
                <p className="text-center text-xs text-gray-400">
                  Enter the 6-digit code sent to your support email. Code expires in 5 minutes.
                </p>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 text-sm font-semibold text-white rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: BRAND.primary }}
                  data-testid="button-verify-mfa"
                >
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                  ) : (
                    <>Verify & Continue <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setMfaCode(['', '', '', '', '', '']); setMfaAttemptToken(''); }}
                    className="text-sm hover:underline"
                    style={{ color: BRAND.primary }}
                    data-testid="link-back-bg-mfa"
                  >
                    &larr; Back to login
                  </button>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || isLoading}
                    className="text-sm flex items-center gap-1 hover:underline disabled:opacity-40 disabled:no-underline"
                    style={{ color: BRAND.accent }}
                    data-testid="button-resend-mfa"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                </div>
              </form>
            ) : mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      placeholder="superadmin@metryx.one"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setLoginError({ type: null, message: '' }); }}
                      className="w-full pl-10 pr-4 h-11 text-sm rounded-xl bg-white border border-gray-200 focus:outline-none transition-all"
                      style={{ borderColor: email ? BRAND.accent : undefined }}
                      onFocus={(e) => e.target.style.borderColor = BRAND.accent}
                      onBlur={(e) => e.target.style.borderColor = email ? BRAND.accent : '#e5e7eb'}
                      data-testid="input-admin-email"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setLoginError({ type: null, message: '' }); }}
                      className="w-full pl-10 pr-10 h-11 text-sm rounded-xl bg-white border border-gray-200 focus:outline-none transition-all"
                      style={{ borderColor: password ? BRAND.accent : undefined }}
                      onFocus={(e) => e.target.style.borderColor = BRAND.accent}
                      onBlur={(e) => e.target.style.borderColor = password ? BRAND.accent : '#e5e7eb'}
                      data-testid="input-admin-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs hover:underline"
                    style={{ color: BRAND.accent }}
                    data-testid="link-forgot-password"
                  >
                    Forgot password?
                  </button>
                </div>

                {loginError.type && (
                  <div
                    className="rounded-xl p-3.5 border flex gap-3 items-start text-sm"
                    style={{
                      backgroundColor: loginError.type === 'access' ? '#fff7ed' : loginError.type === 'network' ? '#f0f9ff' : '#fef2f2',
                      borderColor: loginError.type === 'access' ? '#fed7aa' : loginError.type === 'network' ? '#bae6fd' : '#fecaca',
                    }}
                  >
                    <span className="mt-0.5 shrink-0">
                      {loginError.type === 'credentials' && <KeyRound className="h-4 w-4 text-red-500" />}
                      {loginError.type === 'access' && <ShieldOff className="h-4 w-4 text-orange-500" />}
                      {loginError.type === 'network' && <WifiOff className="h-4 w-4 text-blue-500" />}
                      {loginError.type === 'server' && <AlertCircle className="h-4 w-4 text-red-500" />}
                    </span>
                    <div className="space-y-0.5">
                      <p className="font-medium" style={{ color: loginError.type === 'access' ? '#9a3412' : loginError.type === 'network' ? '#0369a1' : '#991b1b' }}>
                        {loginError.message}
                      </p>
                      {loginError.hint && (
                        <p className="text-xs" style={{ color: loginError.type === 'access' ? '#c2410c' : loginError.type === 'network' ? '#0284c7' : '#b91c1c', opacity: 0.85 }}>
                          {loginError.hint}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 text-sm font-semibold text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:opacity-90"
                  style={{ backgroundColor: BRAND.primary }}
                  data-testid="button-admin-login"
                >
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
                  ) : (
                    <>Sign In <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {!resetEmailSent ? (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 block">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="email"
                          placeholder="admin@metryx.one"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-4 h-11 text-sm rounded-xl bg-white border border-gray-200 focus:outline-none transition-all"
                          onFocus={(e) => e.target.style.borderColor = BRAND.accent}
                          onBlur={(e) => e.target.style.borderColor = email ? BRAND.accent : '#e5e7eb'}
                          data-testid="input-reset-email"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-11 text-sm font-semibold text-white rounded-xl flex items-center justify-center disabled:opacity-50 transition-all hover:opacity-90"
                      style={{ backgroundColor: BRAND.accent }}
                      data-testid="button-send-reset"
                    >
                      {isLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                      ) : (
                        'Send Reset Link'
                      )}
                    </button>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}20` }}>
                      <CheckCircle className="h-7 w-7" style={{ color: BRAND.accent }} />
                    </div>
                    <p className="text-gray-600 text-sm">Instructions sent to <strong>{email}</strong></p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { setMode('login'); setResetEmailSent(false); }}
                  className="w-full text-center text-sm hover:underline"
                  style={{ color: BRAND.primary }}
                  data-testid="link-back-to-login"
                >
                  &larr; Back to Sign In
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
