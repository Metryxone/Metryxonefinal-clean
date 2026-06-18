import { useState, useEffect, useRef } from 'react';
import { notificationService } from '@/lib/notifications/service';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from '../App';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithPopup } from 'firebase/auth';
import { auth as firebaseAuth, googleProvider, isFirebaseConfigured } from '@/lib/firebase';
import {
  Eye, EyeOff, Shield, Lock, Smartphone, Mail, Loader2, AlertCircle, Globe,
  CheckCircle2, Check, ArrowRight, Brain, Sparkles, BarChart3,
  GraduationCap, Building2, Target, Briefcase, Users, Heart, Star,
  Settings, UserCircle, ChevronDown, Zap, Trophy
} from 'lucide-react';

interface LoginProps {
  onNavigate: (screen: Screen) => void;
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

type LoginRole = 'parent' | 'student' | 'institute' | 'ngo' | 'mentor' | 'super_admin' | 'college' | 'campus_student' | 'job_seeker' | 'skilling_partner' | 'hr_recruiter' | 'ld_manager' | 'employee_candidate';

interface RoleMeta {
  label: string;
  labelHi: string;
  description: string;
  descriptionHi: string;
  icon: typeof Users;
  color: string;
}

const roleMetaMap: Record<string, RoleMeta> = {
  parent: { label: 'Parent / Guardian', labelHi: 'अभिभावक', description: 'Manage your child\'s learning journey', descriptionHi: 'अपने बच्चे की सीखने की यात्रा प्रबंधित करें', icon: Users, color: '#0B3C5D' },
  student: { label: 'Student', labelHi: 'छात्र', description: 'Access exams, results & assessments', descriptionHi: 'परीक्षा, परिणाम और मूल्यांकन', icon: GraduationCap, color: '#4ECDC4' },
  institute: { label: 'Institute / School', labelHi: 'संस्थान / स्कूल', description: 'Manage enrollments & exam templates', descriptionHi: 'नामांकन और परीक्षा टेम्पलेट प्रबंधित करें', icon: Building2, color: '#0B3C5D' },
  college: { label: 'College / University', labelHi: 'कॉलेज / विश्वविद्यालय', description: 'Campus placement & assessments', descriptionHi: 'कैंपस प्लेसमेंट और मूल्यांकन', icon: Building2, color: '#0B3C5D' },
  campus_student: { label: 'Campus Student', labelHi: 'कैंपस छात्र', description: 'Placement prep & career tools', descriptionHi: 'प्लेसमेंट तैयारी और करियर टूल', icon: GraduationCap, color: '#0B3C5D' },
  mentor: { label: 'Mentor', labelHi: 'मेंटर', description: 'Manage sessions & earn on your terms', descriptionHi: 'सत्र प्रबंधित करें और कमाई करें', icon: Star, color: '#3B8C85' },
  ngo: { label: 'NGO / Partner', labelHi: 'NGO / पार्टनर', description: 'Beneficiary management & impact tracking', descriptionHi: 'लाभार्थी प्रबंधन और प्रभाव ट्रैकिंग', icon: Heart, color: '#4ECDC4' },
  super_admin: { label: 'Platform Admin', labelHi: 'प्लेटफ़ॉर्म एडमिन', description: 'Full platform administration', descriptionHi: 'पूर्ण प्लेटफ़ॉर्म प्रशासन', icon: Settings, color: '#64748B' },
  hr_recruiter: { label: 'HR Recruiter', labelHi: 'HR भर्तीकर्ता', description: 'Talent acquisition & hiring', descriptionHi: 'प्रतिभा अधिग्रहण और भर्ती', icon: Briefcase, color: '#4ECDC4' },
  ld_manager: { label: 'L&D Manager', labelHi: 'L&D प्रबंधक', description: 'Employee learning & development', descriptionHi: 'कर्मचारी शिक्षण और विकास', icon: Target, color: '#4ECDC4' },
  job_seeker: { label: 'Job Seeker', labelHi: 'नौकरी चाहने वाले', description: 'Career opportunities & skill building', descriptionHi: 'करियर अवसर और कौशल निर्माण', icon: Briefcase, color: '#F59E0B' },
  skilling_partner: { label: 'Skilling Partner', labelHi: 'स्किलिंग पार्टनर', description: 'Training programs & certifications', descriptionHi: 'प्रशिक्षण कार्यक्रम और प्रमाणन', icon: Target, color: '#F59E0B' },
  employee_candidate: { label: 'Employee / Candidate', labelHi: 'कर्मचारी / उम्मीदवार', description: 'Assessments & growth tracking', descriptionHi: 'मूल्यांकन और विकास ट्रैकिंग', icon: UserCircle, color: '#4ECDC4' },
};

const t = {
  en: {
    welcome: 'Welcome back',
    subtitle: 'Sign in to your MetryxOne account',
    otpLogin: 'OTP',
    passwordLogin: 'Password',
    emailOtp: 'Email address',
    emailOtpPlaceholder: 'Enter your email address',
    sendOtp: 'Send OTP',
    sending: 'Sending...',
    enterOtp: 'Enter 6-digit OTP',
    otpSentTo: 'OTP sent to',
    resendIn: 'Resend in',
    resendOtp: 'Resend OTP',
    verifyOtp: 'Verify & Sign In',
    verifying: 'Verifying...',
    usernameOrEmail: 'Email or Username',
    usernamePlaceholder: 'Enter your email or username',
    password: 'Password',
    rememberMe: 'Remember me',
    forgotPassword: 'Forgot password?',
    signIn: 'Sign In',
    signingIn: 'Signing in...',
    orContinueWith: 'or',
    noAccount: "New to MetryxOne?",
    signUpFree: 'Create an account',
    securityNote: '256-bit SSL · DPDP Compliant · SOC2 Certified',
    maxOtpAttempts: 'Maximum OTP attempts reached. Please try again later.',
    invalidEmail: 'Please enter a valid email address',
    otpIncomplete: 'Please enter the complete 6-digit OTP',
    incorrectOtp: 'Incorrect OTP. Try again.',
    loginFailed: 'Login failed. Please check your credentials.',
    errorOccurred: 'An error occurred. Please try again.',
    otpFailed: 'Failed to send OTP. Please try again.',
    switchLang: 'हिंदी',
  },
  hi: {
    welcome: 'वापस स्वागत है',
    subtitle: 'अपने MetryxOne खाते में साइन इन करें',
    otpLogin: 'OTP',
    passwordLogin: 'पासवर्ड',
    emailOtp: 'ईमेल पता',
    emailOtpPlaceholder: 'अपना ईमेल पता दर्ज करें',
    sendOtp: 'OTP भेजें',
    sending: 'भेज रहे हैं...',
    enterOtp: '6 अंकों का OTP दर्ज करें',
    otpSentTo: 'OTP भेजा गया',
    resendIn: 'पुनः भेजें',
    resendOtp: 'OTP पुनः भेजें',
    verifyOtp: 'सत्यापित करें और साइन इन करें',
    verifying: 'सत्यापित हो रहा है...',
    usernameOrEmail: 'ईमेल या यूज़रनेम',
    usernamePlaceholder: 'अपना ईमेल या यूज़रनेम दर्ज करें',
    password: 'पासवर्ड',
    rememberMe: 'मुझे याद रखें',
    forgotPassword: 'पासवर्ड भूल गए?',
    signIn: 'साइन इन करें',
    signingIn: 'साइन इन हो रहा है...',
    orContinueWith: 'या',
    noAccount: 'MetryxOne पर नए हैं?',
    signUpFree: 'खाता बनाएं',
    securityNote: '256-बिट SSL · DPDP अनुपालन · SOC2 प्रमाणित',
    maxOtpAttempts: 'अधिकतम OTP प्रयास पूरे। कृपया बाद में पुनः प्रयास करें।',
    invalidEmail: 'कृपया एक वैध ईमेल पता दर्ज करें',
    otpIncomplete: 'कृपया पूरा 6 अंकों का OTP दर्ज करें',
    incorrectOtp: 'गलत OTP। पुनः प्रयास करें।',
    loginFailed: 'लॉगिन विफल। कृपया क्रेडेंशियल जांचें।',
    errorOccurred: 'एक त्रुटि हुई। कृपया पुनः प्रयास करें।',
    otpFailed: 'OTP भेजने में विफल। कृपया पुनः प्रयास करें।',
    switchLang: 'English',
  }
};

const PRIMARY_ROLES = [
  { key: 'parent',       label: 'Parent',      labelHi: 'अभिभावक',      desc: "Track your child's growth & assessments",  descHi: 'बच्चे की प्रगति ट्रैक करें',     icon: Users,         color: '#0B3C5D' },
  { key: 'student',      label: 'Student',     labelHi: 'छात्र',         desc: 'Access exams, results & AI study plans',   descHi: 'परीक्षा, परिणाम और मूल्यांकन',   icon: GraduationCap, color: '#4ECDC4' },
  { key: 'institute',    label: 'Institute',   labelHi: 'संस्थान',       desc: 'Manage enrollments & exam templates',      descHi: 'नामांकन और परीक्षा टेम्पलेट',    icon: Building2,     color: '#0B3C5D' },
  { key: 'mentor',       label: 'Mentor',      labelHi: 'मेंटर',         desc: 'Manage sessions & earn on your terms',     descHi: 'सत्र प्रबंधित करें',              icon: Star,          color: '#3B8C85' },
  { key: 'hr_recruiter', label: 'Corporate',   labelHi: 'कॉर्पोरेट',    desc: 'Hire smarter with behavioural insights',   descHi: 'स्मार्ट भर्ती करें',             icon: Briefcase,     color: '#0891B2' },
  { key: 'job_seeker',   label: 'Job Seeker',  labelHi: 'जॉब सीकर',     desc: 'Discover careers that match your profile', descHi: 'करियर अवसर और कौशल निर्माण',    icon: Target,        color: '#D97706' },
  { key: 'super_admin',  label: 'Super Admin', labelHi: 'सुपर एडमिन',   desc: 'Full platform administration access',      descHi: 'पूर्ण प्लेटफ़ॉर्म प्रशासन',     icon: Settings,      color: '#64748B' },
];

export function Login({ onNavigate }: LoginProps) {
  const { login: saveSession } = useAuth();
  const [authMode, setAuthMode] = useState<'otp' | 'password'>('password');
  const [selectedLoginRole, setSelectedLoginRole] = useState<string | null>(null);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const [loginStep, setLoginStep] = useState<'credentials' | 'role-picker'>('credentials');
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [userName, setUserName] = useState('');
  const [emailOtpInput, setEmailOtpInput] = useState('');
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const lang = t[language];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const validateEmail = (value: string) => {
    if (!value || !emailRegex.test(value)) return lang.invalidEmail;
    return '';
  };

  const handleSendOtp = async () => {
    const emailError = validateEmail(emailOtpInput);
    if (emailError) { setError(emailError); return; }
    if (resendCount >= 5) { setError(lang.maxOtpAttempts); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailOtpInput, role: selectedLoginRole ?? 'parent', purpose: 'login' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message ?? lang.otpFailed);
      }
      setOtpSent(true);
      setResendTimer(30);
      setResendCount(prev => prev + 1);
      const masked = emailOtpInput.replace(/(.{2}).*(@.*)/, '$1***$2');
      setSuccess(`${lang.otpSentTo} ${masked}`);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) { setError(err instanceof Error ? err.message : lang.otpFailed); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
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
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      const newOtp = [...otp];
      pastedData.split('').forEach((char, idx) => { if (idx < 6) newOtp[idx] = char; });
      setOtp(newOtp);
      otpRefs.current[Math.min(pastedData.length, 5)]?.focus();
    }
  };

  const getNavigationTarget = (role: string): Screen => {
    const roleMap: Record<string, Screen> = {
      parent: 'unified-parent-dashboard',
      institute: 'unified-institute-dashboard',
      school: 'unified-institute-dashboard',
      mentor: 'mentor-dashboard',
      student: 'student-dashboard',
      super_admin: 'super-admin',
      superadmin: 'super-admin',
      admin: 'super-admin',
      ngo: 'ngo-dashboard',
      college: 'unified-institute-dashboard',
      campus_student: 'student-dashboard',
      job_seeker: 'career-builder',
      career_seeker: 'career-builder',
      skilling_partner: 'unified-institute-dashboard',
      hr_recruiter: 'employer-portal',
      hr: 'hr-dashboard',
      ld_manager: 'hr-dashboard',
      employee_candidate: 'career-builder',
      corporate: 'employer-portal',
      metryx_applicant: 'mentor-dashboard',
    };
    const target = roleMap[role.toLowerCase().trim()];
    if (target) return target;
    console.warn('[Login] Unknown role, defaulting to landing:', role);
    return 'landing';
  };

  const handleLoginSuccess = (
    userData: { fullName?: string; username?: string; role?: string; roles?: string[]; id?: string; isVerified?: boolean; mobile?: string; email?: string; dashboardTarget?: string },
    token?: string
  ) => {
    const primaryRole = userData.role || 'parent';
    const rawRoles = (userData.roles && userData.roles.length ? userData.roles : [primaryRole]);
    // Self-heal: ensure the user's primary role is always included (handles legacy
    // accounts where the `roles` array was never populated and defaulted to ['parent'])
    const merged = rawRoles.includes(primaryRole) ? rawRoles : [primaryRole, ...rawRoles];
    const uniqueRoles = Array.from(new Set(merged));
    const displayName = userData.fullName || userData.username || 'there';
    setUserName(displayName);
    notificationService.fireWelcome(displayName);
    notificationService.fireNewDeviceLogin();

    if (token && userData.id) {
      saveSession(token, {
        id: userData.id,
        fullName: userData.fullName,
        mobile: userData.mobile,
        email: userData.email,
        role: (userData.role ?? 'parent') as Parameters<typeof saveSession>[1]['role'],
        roles: uniqueRoles as Parameters<typeof saveSession>[1]['roles'],
        isVerified: userData.isVerified ?? false,
        dashboardTarget: userData.dashboardTarget ?? getNavigationTarget(userData.role ?? 'parent'),
      });
    }

    if (selectedLoginRole) {
      onNavigate(getNavigationTarget(selectedLoginRole));
    } else if (uniqueRoles.length > 1) {
      setUserRoles(uniqueRoles);
      setLoginStep('role-picker');
    } else {
      onNavigate(getNavigationTarget(uniqueRoles[0]));
    }
  };

  const handleRoleSelect = (role: string) => {
    onNavigate(getNavigationTarget(role));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      if (authMode === 'otp') {
        const otpValue = otp.join('');
        if (otpValue.length !== 6) { setError(lang.otpIncomplete); setLoading(false); return; }
        const res = await fetch('/api/auth/otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailOtpInput, otp: otpValue, role: selectedLoginRole ?? 'parent', purpose: 'login' }),
        });
        const data = await res.json();
        if (res.ok) {
          handleLoginSuccess(data.user ?? data, data.token);
        } else {
          setError((data as { message?: string }).message ?? lang.incorrectOtp);
        }
      } else {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: usernameOrEmail || emailOtpInput, password, ...(selectedLoginRole ? { role: selectedLoginRole } : {}) }),
        });
        const data = await res.json();
        if (res.ok) {
          handleLoginSuccess(data.user ?? data, data.token);
        } else {
          setError((data as { message?: string }).message ?? lang.loginFailed);
        }
      }
    } catch { setError(lang.errorOccurred); }
    finally { setLoading(false); }
  };

  const [socialProviders, setSocialProviders] = useState({ google: false, github: false, linkedin: false });

  useEffect(() => {
    setSocialProviders({ google: false, github: false, linkedin: false });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('social_token');
    const role = params.get('social_role');
    const err = params.get('social_error');

    if (err) {
      const messages: Record<string, string> = {
        google_denied: 'Google sign-in was cancelled.',
        google_failed: 'Google sign-in failed. Please try again.',
        github_denied: 'GitHub sign-in was cancelled.',
        github_failed: 'GitHub sign-in failed. Please try again.',
        linkedin_denied: 'LinkedIn sign-in was cancelled.',
        linkedin_failed: 'LinkedIn sign-in failed. Please try again.',
      };
      setError(messages[err] || 'Social login failed. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (token) {
      window.history.replaceState({}, '', window.location.pathname);
      const effectiveRole = (role ?? 'parent') as Parameters<typeof saveSession>[1]['role'];
      const target = getNavigationTarget(effectiveRole);
      saveSession(token, {
        id: '',
        role: effectiveRole,
        roles: [effectiveRole],
        isVerified: true,
        dashboardTarget: target,
      });
      onNavigate(target as Parameters<typeof onNavigate>[0]);
    }
  }, []);

  const handleSocialLogin = async (provider: 'google' | 'github' | 'linkedin') => {
    const role = selectedLoginRole ?? 'parent';

    if (provider === 'google') {
      if (!isFirebaseConfigured || !firebaseAuth || !googleProvider) {
        setError('Google sign-in is not available right now. Please use email/password login.');
        return;
      }
      // Firebase Google popup login
      setLoading(true);
      setError('');
      try {
        const result = await signInWithPopup(firebaseAuth, googleProvider);
        const idToken = await result.user.getIdToken();

        const res = await fetch('/api/auth/firebase/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, role }),
        });

        const data = await res.json() as {
          token?: string;
          user?: { id?: string; fullName?: string; email?: string; mobile?: string; role?: string; roles?: string[]; isVerified?: boolean; dashboardTarget?: string };
          isNewUser?: boolean;
          googleProfile?: { email?: string; fullName?: string; profilePicture?: string };
          error?: string;
          message?: string;
        };

        if (res.ok && data.isNewUser && data.googleProfile) {
          // New user — forward to registration with prefilled Google data
          sessionStorage.setItem('google_prefill', JSON.stringify(data.googleProfile));
          onNavigate('registration');
        } else if (res.ok && (data.token || data.id || data.user)) {
          handleLoginSuccess(data.user ?? data, data.token);
        } else {
          setError(data.message ?? 'Google login failed. Please try again.');
        }
      } catch (err: unknown) {
        const firebaseError = err as { code?: string; message?: string };
        if (firebaseError.code === 'auth/popup-closed-by-user') {
          setError('Google sign-in was cancelled.');
        } else if (firebaseError.code === 'auth/popup-blocked') {
          setError('Pop-up was blocked. Please allow pop-ups and try again.');
        } else if (firebaseError.code === 'auth/unauthorized-domain') {
          setError('This domain is not authorised in Firebase. Add it to Firebase → Authentication → Authorised domains.');
        } else if (firebaseError.code === 'auth/operation-not-allowed') {
          setError('Google Sign-In is not enabled. Enable it in Firebase → Authentication → Sign-in method.');
        } else {
          setError(`Google sign-in failed: ${firebaseError.code ?? firebaseError.message ?? 'unknown error'}`);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // GitHub / LinkedIn — keep existing redirect flow
    window.location.href = `/api/auth/social/${provider}?role=${role}`;
  };

  const verticalHighlights = [
    { icon: GraduationCap, label: language === 'en' ? 'Schools & K-12' : 'स्कूल और K-12', color: '#0B3C5D' },
    { icon: Building2, label: language === 'en' ? 'Campus & Placement' : 'कैंपस और प्लेसमेंट', color: '#0B3C5D' },
    { icon: Target, label: language === 'en' ? 'Employability' : 'रोजगार योग्यता', color: '#F59E0B' },
    { icon: Briefcase, label: language === 'en' ? 'Enterprise' : 'एंटरप्राइज़', color: '#4ECDC4' },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Navbar onNavigate={onNavigate} currentScreen="login" />

      <div className="flex-1 flex pt-16">
        <div
          className="hidden lg:flex lg:w-[42%] xl:w-[45%] relative overflow-hidden"
          style={{
            background: selectedLoginRole === 'student'
              ? '#1a2d6a'
              : '#0B3C5D',
          }}
        >
          {/* Decorative rings */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full border border-white/10" />
            <div className="absolute top-1/2 -right-10 w-44 h-44 rounded-full border border-white/10" />
            <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full border border-white/10" />
          </div>

          {selectedLoginRole === 'student' ? (
            /* ── Student-specific panel ── */
            <div className="relative z-10 flex flex-col h-full w-full p-10 xl:p-14">
              {/* Brand */}
              <div className="mb-auto">
                <span className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Metryx<span style={{ color: "#4ECDC4" }}>One</span>
                </span>
                <p className="text-white/40 text-[10px] mt-0.5 tracking-wide uppercase font-medium">Student Zone</p>
              </div>

              {/* Hero text */}
              <div className="my-auto py-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5" style={{ backgroundColor: 'rgba(78,205,196,0.15)', border: '1px solid rgba(78,205,196,0.3)' }}>
                  <Zap size={12} style={{ color: '#4ECDC4' }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#4ECDC4' }}>Gamified Learning</span>
                </div>
                <h1 className="text-3xl xl:text-[2.1rem] font-extrabold text-white leading-[1.15] mb-4 tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {language === 'en' ? (
                    <>Level up your<br /><span style={{ color: "#4ECDC4" }}>learning journey</span></>
                  ) : (
                    <>अपनी सीखने की<br /><span style={{ color: "#4ECDC4" }}>यात्रा को आगे बढ़ाएं</span></>
                  )}
                </h1>
                <p className="text-sm text-white/50 leading-relaxed mb-8 max-w-xs">
                  {language === 'en'
                    ? 'Earn XP, complete missions, unlock rewards — and track your behavioural intelligence.'
                    : 'XP कमाएं, मिशन पूरे करें, पुरस्कार अनलॉक करें।'}
                </p>

                {/* XP / Badge preview card */}
                <div className="rounded-2xl p-4 mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl font-extrabold text-white" style={{ backgroundColor: 'rgba(78,205,196,0.25)' }}>1</div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#4ECDC4' }}>Explorer</p>
                        <p className="text-base font-extrabold text-white leading-none">0 XP</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/40">Your coins</p>
                      <p className="text-xl font-extrabold text-white">0</p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                    <div className="h-full rounded-full w-0" style={{ backgroundColor: '#4ECDC4' }} />
                  </div>
                  <p className="text-[10px] text-white/30 mt-1.5">Complete missions to climb the leaderboard</p>
                </div>

                {/* Student benefits */}
                <div className="space-y-3 mb-8">
                  {[
                    { icon: Zap,          label: language === 'en' ? 'Daily missions & XP rewards'  : 'दैनिक मिशन और XP पुरस्कार',  color: '#f59e0b' },
                    { icon: Brain,        label: language === 'en' ? 'LBI behavioural assessment'    : 'LBI व्यवहार मूल्यांकन',       color: '#a78bfa' },
                    { icon: Trophy,       label: language === 'en' ? 'Leaderboard & achievements'   : 'लीडरबोर्ड और उपलब्धियां',     color: '#4ECDC4' },
                    { icon: BarChart3,    label: language === 'en' ? 'Exam readiness index & trends': 'परीक्षा तत्परता सूचकांक',     color: '#34d399' },
                  ].map((b, idx) => {
                    const BIcon = b.icon;
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${b.color}20` }}>
                          <BIcon size={15} style={{ color: b.color }} />
                        </div>
                        <span className="text-sm font-medium text-white/70">{b.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Mini leaderboard preview */}
                <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Top Learners This Week</p>
                  {[
                    { rank: 1, name: 'Aarav S.',  xp: 420, color: '#f59e0b' },
                    { rank: 2, name: 'Priya M.',  xp: 380, color: '#94a3b8' },
                    { rank: 3, name: 'Rohit K.',  xp: 310, color: '#b45309' },
                  ].map(p => (
                    <div key={p.rank} className="flex items-center gap-2">
                      <span className="text-[11px] font-bold w-4" style={{ color: p.color }}>#{p.rank}</span>
                      <span className="flex-1 text-xs text-white/60">{p.name}</span>
                      <span className="text-xs font-bold text-white/80">{p.xp} XP</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature chips */}
              <div className="mt-auto">
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: Zap,      label: 'Daily Missions' },
                    { icon: Brain,    label: 'LBI Assessment' },
                    { icon: Star,     label: 'Rewards Store' },
                    { icon: Shield,   label: 'DPDP Compliant' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'rgba(78,205,196,0.12)', color: '#4ECDC4' }}>
                      <item.icon size={11} />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── Default / generic panel ── */
            <div className="relative z-10 flex flex-col h-full w-full p-10 xl:p-14">
              <div className="mb-auto">
                <span className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Metryx<span style={{ color: "#4ECDC4" }}>One</span>
                </span>
                <p className="text-white/40 text-[10px] mt-0.5 tracking-wide uppercase font-medium">
                  Unified Intelligence Platform
                </p>
              </div>

              <div className="my-auto py-6">
                <h1 className="text-3xl xl:text-[2.2rem] font-extrabold text-white leading-[1.15] mb-5 tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {language === 'en' ? (
                    <>One platform for<br /><span style={{ color: "#4ECDC4" }}>every</span> learning journey.</>
                  ) : (
                    <>हर सीखने की यात्रा के लिए<br /><span style={{ color: "#4ECDC4" }}>एक</span> प्लेटफ़ॉर्म।</>
                  )}
                </h1>
                <p className="text-sm text-white/50 max-w-sm leading-relaxed mb-10">
                  {language === 'en'
                    ? 'From K-12 classrooms to corporate boardrooms — behavioral intelligence that drives real outcomes.'
                    : 'K-12 कक्षाओं से कॉर्पोरेट बोर्डरूम तक — व्यवहार बुद्धिमत्ता जो वास्तविक परिणाम देती है।'}
                </p>

                <div className="space-y-3 mb-10">
                  {verticalHighlights.map((v, idx) => {
                    const VIcon = v.icon;
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${v.color}20` }}>
                          <VIcon size={17} style={{ color: v.color }} />
                        </div>
                        <span className="text-sm font-medium text-white/70">{v.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-0">
                  {[
                    { value: '50K+', label: language === 'en' ? 'Individuals' : 'व्यक्ति' },
                    { value: '500+', label: language === 'en' ? 'Institutions' : 'संस्थान' },
                    { value: '120+', label: language === 'en' ? 'Corporates' : 'कॉर्पोरेट' },
                    { value: '98%', label: language === 'en' ? 'Satisfaction' : 'संतुष्टि' },
                  ].map((stat, idx) => (
                    <div key={idx} className="flex-1 text-center relative">
                      {idx > 0 && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-8 bg-white/10" />}
                      <p className="text-lg font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>{stat.value}</p>
                      <p className="text-[9px] text-white/35 uppercase tracking-widest font-semibold">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto">
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: Brain,    label: 'LBI Assessment' },
                    { icon: Sparkles, label: 'ExamReadiness Index™' },
                    { icon: BarChart3,label: 'AI Analytics' },
                    { icon: Shield,   label: 'DPDP Compliant' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'rgba(78, 205, 196, 0.12)', color: '#4ECDC4' }}>
                      <item.icon size={11} />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full lg:w-[58%] xl:w-[55%] flex flex-col">
          <div className="flex items-center justify-between px-6 sm:px-10 lg:px-12 py-4">
            <div className="lg:hidden">
              <span className="text-xl font-bold" style={{ color: "#0B3C5D", fontFamily: "'Inter', sans-serif" }}>
                Metryx<span style={{ color: "#4ECDC4" }}>One</span>
              </span>
            </div>
            <div className="lg:ml-auto">
              <button
                onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all hover:shadow-sm"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)", borderColor: "var(--border-subtle)" }}
                data-testid="button-language-toggle"
              >
                <Globe size={13} />
                {lang.switchLang}
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-12 pb-8">
            <div className="w-full max-w-[440px]">
              <AnimatePresence mode="wait">
              {loginStep === 'role-picker' ? (
                <motion.div
                  key="role-picker"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(78, 205, 196, 0.1)' }}>
                        <CheckCircle2 size={20} style={{ color: '#4ECDC4' }} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#4ECDC4' }}>
                          {language === 'en' ? 'Signed in successfully' : 'सफलतापूर्वक साइन इन हुआ'}
                        </p>
                        {userName && <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{userName}</p>}
                      </div>
                    </div>
                    <h2 className="text-xl font-extrabold tracking-tight mb-1" style={{ color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>
                      {language === 'en' ? 'Continue as...' : 'इस रूप में जारी रखें...'}
                    </h2>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {language === 'en'
                        ? 'Your account has multiple roles. Choose how you\'d like to proceed.'
                        : 'आपके खाते में कई भूमिकाएं हैं। चुनें कि आप कैसे आगे बढ़ना चाहते हैं।'}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {userRoles.map((role, idx) => {
                      const meta = roleMetaMap[role] || { label: role, labelHi: role, description: '', descriptionHi: '', icon: UserCircle, color: '#64748B' };
                      const RIcon = meta.icon;
                      return (
                        <motion.button
                          key={role}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.06 }}
                          onClick={() => handleRoleSelect(role)}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all hover:shadow-md group"
                          style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = meta.color; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                          data-testid={`button-role-${role}`}
                        >
                          <div
                            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                            style={{ backgroundColor: `${meta.color}12` }}
                          >
                            <RIcon size={20} style={{ color: meta.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                              {language === 'en' ? meta.label : meta.labelHi}
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                              {language === 'en' ? meta.description : meta.descriptionHi}
                            </p>
                          </div>
                          <ArrowRight size={16} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: meta.color }} />
                        </motion.button>
                      );
                    })}
                  </div>

                  <button
                    onClick={async () => {
                      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
                      localStorage.removeItem('metryx_token');
                      setLoginStep('credentials');
                      setUserRoles([]);
                      setUserName('');
                      setPassword('');
                      setOtp(['', '', '', '', '', '']);
                      setOtpSent(false);
                      setSelectedLoginRole(null);
                    }}
                    className="w-full text-center mt-5 text-xs font-semibold hover:underline"
                    style={{ color: 'var(--text-muted)' }}
                    data-testid="button-switch-account"
                  >
                    {language === 'en' ? 'Sign in with a different account' : 'दूसरे खाते से साइन इन करें'}
                  </button>

                  <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <Shield size={10} style={{ color: "#4ECDC4" }} />
                    <span>{lang.securityNote}</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="credentials"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                >
              <div className="mb-5">
                <h2 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>
                  {selectedLoginRole
                    ? (language === 'en'
                        ? `Welcome, ${PRIMARY_ROLES.find(r => r.key === selectedLoginRole)?.label}`
                        : `स्वागत है, ${PRIMARY_ROLES.find(r => r.key === selectedLoginRole)?.labelHi}`)
                    : lang.welcome}
                </h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {selectedLoginRole
                    ? (language === 'en'
                        ? roleMetaMap[selectedLoginRole]?.description
                        : roleMetaMap[selectedLoginRole]?.descriptionHi)
                    : lang.subtitle}
                </p>
              </div>

              <div className="mb-5" ref={roleDropdownRef}>
                <p className="text-[10px] uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-muted)' }}>
                  {language === 'en' ? 'Sign in as' : 'इस रूप में साइन इन करें'}
                </p>
                <div className="relative">
                  {/* Trigger */}
                  <button
                    type="button"
                    onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all"
                    style={{
                      borderColor: selectedLoginRole
                        ? `${PRIMARY_ROLES.find(r => r.key === selectedLoginRole)?.color}50`
                        : 'var(--border-subtle)',
                      backgroundColor: selectedLoginRole
                        ? `${PRIMARY_ROLES.find(r => r.key === selectedLoginRole)?.color}06`
                        : 'var(--bg-secondary)',
                    }}
                    data-testid="role-dropdown-trigger"
                  >
                    {selectedLoginRole ? (() => {
                      const role = PRIMARY_ROLES.find(r => r.key === selectedLoginRole)!;
                      const RIcon = role.icon;
                      return (
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${role.color}` }}
                          >
                            <RIcon size={16} style={{ color: '#fff' }} />
                          </div>
                          <div className="min-w-0 text-left">
                            <p className="text-[13px] leading-tight truncate" style={{ color: role.color }}>
                              {language === 'en' ? role.label : role.labelHi}
                            </p>
                            <p className="text-[11px] leading-tight mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                              {language === 'en' ? role.desc : role.descHi}
                            </p>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--border-subtle)' }}>
                          <Users size={15} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <div>
                          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                            {language === 'en' ? 'Select your role' : 'भूमिका चुनें'}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {language === 'en' ? 'Parent, student, institute & more' : 'अपनी भूमिका चुनें'}
                          </p>
                        </div>
                      </div>
                    )}
                    <ChevronDown
                      size={15}
                      className={`flex-shrink-0 transition-transform duration-200 ${isRoleDropdownOpen ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--text-muted)' }}
                    />
                  </button>

                  {/* Dropdown panel */}
                  {isRoleDropdownOpen && (
                    <div
                      className="absolute top-full left-0 right-0 z-50 mt-2 rounded-2xl border overflow-hidden"
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        borderColor: 'var(--border-subtle)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
                      }}
                    >
                      <div className="p-1.5 flex flex-col gap-0.5">
                        {PRIMARY_ROLES.map((r) => {
                          const RIcon = r.icon;
                          const isSelected = selectedLoginRole === r.key;
                          return (
                            <button
                              key={r.key}
                              type="button"
                              onClick={() => {
                                setSelectedLoginRole(isSelected ? null : r.key);
                                setIsRoleDropdownOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left relative overflow-hidden group"
                              style={{ backgroundColor: isSelected ? `${r.color}10` : 'transparent' }}
                              data-testid={`role-select-${r.key}`}
                            >
                              {/* Left accent bar */}
                              <div
                                className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full transition-all"
                                style={{
                                  backgroundColor: r.color,
                                  opacity: isSelected ? 1 : 0,
                                }}
                              />
                              {/* Icon */}
                              <div
                                className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                                style={{
                                  background: isSelected
                                    ? `${r.color}`
                                    : 'var(--bg-secondary)',
                                }}
                              >
                                <RIcon size={15} style={{ color: isSelected ? '#fff' : 'var(--text-muted)' }} />
                              </div>
                              {/* Text */}
                              <div className="flex-1 min-w-0">
                                <p
                                  className="text-[13px] leading-snug"
                                  style={{ color: isSelected ? r.color : 'var(--text-primary)' }}
                                >
                                  {language === 'en' ? r.label : r.labelHi}
                                </p>
                                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
                                  {language === 'en' ? r.desc : r.descHi}
                                </p>
                              </div>
                              {/* Check */}
                              {isSelected && (
                                <div
                                  className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: `${r.color}15` }}
                                >
                                  <CheckCircle2 size={12} style={{ color: r.color }} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex p-1 rounded-xl mb-6" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <button
                  onClick={() => { setAuthMode('password'); setOtpSent(false); setError(''); setSuccess(''); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    backgroundColor: authMode === 'password' ? '#0B3C5D' : 'transparent',
                    color: authMode === 'password' ? 'white' : 'var(--text-muted)',
                    boxShadow: authMode === 'password' ? '0 2px 8px rgba(11,60,93,0.25)' : 'none',
                  }}
                  data-testid="button-auth-password"
                >
                  <Lock size={13} />
                  {lang.passwordLogin}
                </button>
                <button
                  onClick={() => { setAuthMode('otp'); setError(''); setSuccess(''); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    backgroundColor: authMode === 'otp' ? '#0B3C5D' : 'transparent',
                    color: authMode === 'otp' ? 'white' : 'var(--text-muted)',
                    boxShadow: authMode === 'otp' ? '0 2px 8px rgba(11,60,93,0.25)' : 'none',
                  }}
                  data-testid="button-auth-otp"
                >
                  <Smartphone size={13} />
                  {lang.otpLogin}
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {authMode === 'password' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="usernameOrEmail" className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        {lang.usernameOrEmail}
                      </Label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                        <Input
                          id="usernameOrEmail"
                          type="text"
                          placeholder={lang.usernamePlaceholder}
                          value={usernameOrEmail}
                          onChange={(e) => { setUsernameOrEmail(e.target.value); setError(''); }}
                          required
                          className="h-12 pl-10 rounded-xl text-sm border-2 focus:border-[#0B3C5D]"
                          style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
                          data-testid="input-username"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        {lang.password}
                      </Label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setError(''); }}
                          required
                          className="h-12 pl-10 pr-12 rounded-xl text-sm border-2 focus:border-[#0B3C5D]"
                          style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
                          data-testid="input-password"
                        />
                        <Button type="button" variant="ghost" size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10"
                          style={{ color: "var(--text-muted)" }}
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox id="remember" checked={rememberMe} onCheckedChange={(c) => setRememberMe(c as boolean)} />
                        <Label htmlFor="remember" className="text-[11px]" style={{ color: "var(--text-muted)" }}>{lang.rememberMe}</Label>
                      </div>
                      <Button variant="link" onClick={() => onNavigate('forgot-password')} className="text-[11px] p-0 h-auto font-semibold" style={{ color: "#4ECDC4" }} data-testid="link-forgot-password">
                        {lang.forgotPassword}
                      </Button>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 text-sm font-bold rounded-xl text-white transition-all hover:opacity-90"
                      style={{ backgroundColor: "#0B3C5D" }}
                      disabled={loading || !password || !usernameOrEmail}
                      data-testid="button-login"
                    >
                      {loading ? <><Loader2 size={16} className="animate-spin mr-2" />{lang.signingIn}</> : <>{lang.signIn} <ArrowRight size={16} className="ml-2" /></>}
                    </Button>
                  </div>
                )}

                {authMode === 'otp' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email-otp" className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        {lang.emailOtp}
                      </Label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                        <Input id="email-otp" type="email" autoComplete="email"
                          placeholder={lang.emailOtpPlaceholder}
                          value={emailOtpInput}
                          onChange={(e) => { setEmailOtpInput(e.target.value.trim()); setError(''); setSuccess(''); }}
                          required
                          className="h-12 rounded-xl pl-10 pr-10 text-sm border-2 focus:border-[#4ECDC4]"
                          style={{ backgroundColor: "var(--bg-primary)", borderColor: emailRegex.test(emailOtpInput) ? "#4ECDC4" : "var(--border-subtle)" }}
                          data-testid="input-email-otp"
                        />
                        {emailRegex.test(emailOtpInput) && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Check size={16} style={{ color: "#4ECDC4" }} />
                          </div>
                        )}
                      </div>
                    </div>

                    {!otpSent ? (
                      <Button type="button" onClick={handleSendOtp}
                        className="w-full h-12 text-sm font-bold rounded-xl text-white transition-all hover:opacity-90"
                        style={{ backgroundColor: "#4ECDC4" }}
                        disabled={loading || !emailRegex.test(emailOtpInput)}
                        data-testid="button-send-otp"
                      >
                        {loading ? <><Loader2 size={16} className="animate-spin mr-2" />{lang.sending}</> : lang.sendOtp}
                      </Button>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                            {lang.enterOtp}
                          </Label>
                          <div className="grid grid-cols-6 gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                            {otp.map((digit, idx) => (
                              <input
                                key={idx}
                                ref={(el) => { otpRefs.current[idx] = el; }}
                                type="text" inputMode="numeric" maxLength={1}
                                value={digit}
                                onChange={(e) => handleOtpChange(idx, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                className="aspect-square w-full text-center text-base sm:text-lg font-bold rounded-xl border-2 focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/30 transition-all"
                                style={{
                                  backgroundColor: digit ? "rgba(78, 205, 196, 0.06)" : "var(--bg-primary)",
                                  borderColor: digit ? "#4ECDC4" : "var(--border-subtle)",
                                  color: "var(--text-primary)"
                                }}
                                data-testid={`input-otp-${idx}`}
                              />
                            ))}
                          </div>
                          <div className="text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {resendTimer > 0 ? (
                              <>{lang.resendIn} <span className="font-bold" style={{ color: "#4ECDC4" }}>{resendTimer}s</span></>
                            ) : (
                              <button type="button" onClick={handleSendOtp} className="font-bold" style={{ color: "#4ECDC4" }} data-testid="button-resend-otp">
                                {lang.resendOtp}
                              </button>
                            )}
                          </div>
                        </div>
                        <Button type="submit"
                          className="w-full h-12 text-sm font-bold rounded-xl text-white transition-all hover:opacity-90"
                          style={{ backgroundColor: "#0B3C5D" }}
                          disabled={loading || otp.join('').length !== 6}
                          data-testid="button-verify-otp"
                        >
                          {loading ? <><Loader2 size={16} className="animate-spin mr-2" />{lang.verifying}</> : lang.verifyOtp}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <AnimatePresence>
                  {success && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium"
                      style={{ backgroundColor: "rgba(78, 205, 196, 0.08)", color: "#4ECDC4" }}
                    >
                      <CheckCircle2 size={15} />
                      {success}
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium"
                      style={{ backgroundColor: "rgba(239, 68, 68, 0.06)", color: "#dc2626" }}
                      role="alert"
                    >
                      <AlertCircle size={15} />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" style={{ borderColor: "var(--border-subtle)" }} />
                </div>
                <div className="relative flex justify-center text-[10px]">
                  <span className="px-3 font-semibold" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)" }}>{lang.orContinueWith}</span>
                </div>
              </div>

              <div className="space-y-2">
                {/* Google — Firebase popup login */}
                <button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  disabled={loading}
                  className="w-full flex items-center gap-3 px-4 h-11 rounded-xl border transition-all group"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    backgroundColor: 'var(--bg-primary)',
                  }}
                  data-testid="button-oauth-google"
                >
                  <GoogleIcon />
                  <span className="flex-1 text-[13px] text-center" style={{ color: 'var(--text-secondary)', marginLeft: '-20px' }}>
                    Continue with Google
                  </span>
                </button>

                {/* GitHub + LinkedIn side by side */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('github')}
                    disabled={!socialProviders.github}
                    className="flex items-center justify-center gap-2 px-3 h-11 rounded-xl border transition-all"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'var(--bg-primary)',
                      opacity: socialProviders.github ? 1 : 0.45,
                      cursor: socialProviders.github ? 'pointer' : 'not-allowed',
                    }}
                    title={!socialProviders.github ? 'GitHub login not configured yet' : undefined}
                    data-testid="button-oauth-github"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-primary)' }}>
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                    </svg>
                    <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      GitHub {!socialProviders.github && <span style={{ color: 'var(--text-muted)' }}>·soon</span>}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialLogin('linkedin')}
                    disabled={!socialProviders.linkedin}
                    className="flex items-center justify-center gap-2 px-3 h-11 rounded-xl border transition-all"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'var(--bg-primary)',
                      opacity: socialProviders.linkedin ? 1 : 0.45,
                      cursor: socialProviders.linkedin ? 'pointer' : 'not-allowed',
                    }}
                    title={!socialProviders.linkedin ? 'LinkedIn login not configured yet' : undefined}
                    data-testid="button-oauth-linkedin"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="#0A66C2">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      LinkedIn {!socialProviders.linkedin && <span style={{ color: 'var(--text-muted)' }}>·soon</span>}
                    </span>
                  </button>
                </div>
              </div>

              <div className="text-center mt-6">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{lang.noAccount} </span>
                <button onClick={() => onNavigate('registration')} className="text-xs font-bold hover:underline" style={{ color: "#4ECDC4" }} data-testid="link-register">
                  {lang.signUpFree}
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px]" style={{ color: "var(--text-muted)" }}>
                <Shield size={10} style={{ color: "#4ECDC4" }} />
                <span>{lang.securityNote}</span>
              </div>

              <div className="flex justify-end mt-3 pr-1">
                <button
                  onClick={() => onNavigate('super-admin')}
                  className="flex items-center gap-1 opacity-30 hover:opacity-70 transition-opacity duration-200"
                  title="Super Admin"
                  data-testid="link-super-admin"
                >
                  <Settings size={11} style={{ color: "var(--text-muted)" }} />
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>Admin</span>
                </button>
              </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
