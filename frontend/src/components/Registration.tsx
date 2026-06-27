import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth as firebaseAuth, googleProvider, isFirebaseConfigured, syncProfileToFirestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from '../App';
import { CVParserPreview, type ParsedCVProfile } from './CVParserPreview';
import { CAREER_STAGES } from '@/lib/career/experienceRouting';
import { saveProfileSetupFlag } from './FirstLoginProfileModal';
import {
  Eye, EyeOff, User, School, BookOpen, Shield,
  Briefcase, Heart, Building2, CheckCircle, Star, Users,
  TrendingUp, Award, Lock, Zap, Upload, FileText, X, Phone, Check,
  ArrowRight, Brain, BarChart3, MapPin, Sparkles, Target, FlaskConical, Activity,
  GraduationCap, LineChart, ChevronRight, Rocket
} from 'lucide-react';

interface RegistrationProps {
  onNavigate: (screen: Screen) => void;
}

type UserRole = 'parent' | 'institute' | 'student' | 'career_seeker' | 'ngo' | 'corporate' | 'metryx_applicant';



const PLATFORM_ROLES: UserRole[] = ['parent', 'student', 'institute', 'career_seeker', 'ngo', 'corporate'];

const ROLE_CONFIG: Record<UserRole, { label: string; sublabel?: string; icon: ReactNode; description: string; next: string; fields?: string[] }> = {
  parent:          { label: 'Parent / Guardian',  icon: <User size={16} strokeWidth={1.25} />,         description: 'Track your child\'s learning progress and behavioral development insights', next: 'your Parent Dashboard' },
  student:         { label: 'Student',              icon: <BookOpen size={16} strokeWidth={1.25} />,     description: 'Access psychometric assessments and personalised learning insights. Ages 11-17 require a parent approval.', next: 'your Student Dashboard', fields: ['age', 'grade'] },
  institute:       { label: 'School / College',    icon: <School size={16} strokeWidth={1.25} />,       description: 'Institutional assessment partnership — bulk enrol and track cohorts', next: 'your Institute Dashboard', fields: ['instituteName'] },
  career_seeker:   {
    label: 'Career Seeker',
    sublabel: 'Employability Index™',
    icon: <LineChart size={16} strokeWidth={1.25} />,
    description: 'Subscribe to Employability Index™ — score your career readiness & benchmark against 50K+ candidate profiles',
    next: 'Career Discovery, then your Career Launchpad',
    fields: ['qualification'],
  },
  ngo:             { label: 'NGO Partner',         icon: <Heart size={16} strokeWidth={1.25} />,        description: 'Community assessment programs — access subsidised tools for social impact', next: 'your NGO Dashboard', fields: ['organizationName'] },
  corporate:       { label: 'Corporate / HR',      icon: <Building2 size={16} strokeWidth={1.25} />,    description: 'Talent assessment, hiring intelligence and employee development at scale', next: 'your Employer Portal', fields: ['companyName'] },
  metryx_applicant:{
    label: 'Join MetryxOne',
    sublabel: 'Mentor · Evaluator · Trainer',
    icon: <GraduationCap size={16} strokeWidth={1.25} />,
    description: 'Apply to work with MetryxOne as a Subject Mentor, Assessment Evaluator, Content Trainer, or Counsellor',
    next: 'your Mentor Dashboard',
    fields: ['qualification'],
  },
};

const STATS = [
  { value: '93%',   label: 'Assessment Accuracy' },
  { value: '50K+',  label: 'Active Users' },
  { value: '500+',  label: 'Institutions' },
  { value: '4.9★',  label: 'Avg. Rating' },
];

const FEATURES = [
  {
    icon: Rocket,
    tag: 'Career Launchpad',
    title: 'Launch Your Career with a Plan',
    body: 'Go from profile to a personalized launch plan — role matches, skill-gap roadmaps, and an Employability Passport™ that shows employers exactly where you stand.',
    accent: '#0B3C5D',
  },
  {
    icon: Brain,
    tag: 'LBI™ Engine',
    title: 'Cognitive Intelligence Profiling',
    body: 'Map 7 cognitive domains in 25 minutes. Understand exactly how your child or candidate processes information, retains knowledge, and performs under pressure.',
    accent: '#0B3C5D',
  },
  {
    icon: Target,
    tag: 'ExamReadiness Index™',
    title: 'Predict Success 6 Months Out',
    body: 'Our ERI™ model analyzes behavioral signals to forecast exam outcomes with 93% accuracy — giving you time to course-correct before it matters most.',
    accent: '#4ECDC4',
  },
  {
    icon: TrendingUp,
    tag: 'Growth Simulation',
    title: 'Model 12-Month Trajectories',
    body: 'Simulate learning paths across 9 competency domains. See projected gains for each intervention before committing resources.',
    accent: '#4ECDC4',
  },
  {
    icon: BarChart3,
    tag: 'Hiring Intelligence',
    title: 'Score Career Readiness Instantly',
    body: 'Rank candidates across psychometric, domain, and culture-fit dimensions in under 20 minutes — backed by behavioral science, not gut feel.',
    accent: '#0B3C5D',
  },
  {
    icon: Sparkles,
    tag: 'AI Learning Paths',
    title: 'Personalized Curriculum, Automatically',
    body: 'The platform auto-sequences learning content based on your profile. No two users get the same path — because no two learners are alike.',
    accent: '#4ECDC4',
  },
  {
    icon: FlaskConical,
    tag: 'Behavioral Profiling',
    title: 'Deep Psychometric Trait Mapping',
    body: 'Go beyond aptitude. Measure emotional resilience, motivation drivers, stress tolerance, and adaptive thinking with validated clinical-grade tools.',
    accent: '#4ECDC4',
  },
];

const TESTIMONIALS = [
  {
    quote: 'MetryxOne helped us understand our daughter\'s learning style completely. The insights were eye-opening and actually actionable.',
    name: 'Priya Sharma',
    role: 'Parent · Mumbai',
    initials: 'PS',
  },
  {
    quote: 'We onboarded 340 students in one semester. The ERI™ reports gave our counsellors a shared language to talk about learning gaps.',
    name: 'Dr. Ramesh Kumar',
    role: 'Principal · DPS Delhi',
    initials: 'RK',
  },
  {
    quote: 'My MetryxOne score opened doors at three companies. The hiring report explained exactly where I stood vs. industry benchmarks.',
    name: 'Arjun Mehta',
    role: 'Job Seeker · Bengaluru',
    initials: 'AM',
  },
];

const LIVE_ACTIVITY = [
  { icon: Users,    text: 'Anjali from Delhi just completed her assessment', time: 'just now' },
  { icon: Building2,text: 'St. Xavier\'s College onboarded 340 students',    time: '2 min ago' },
  { icon: TrendingUp,text: 'Rohan\'s score improved by 23 points this month', time: '5 min ago' },
  { icon: MapPin,   text: '47 new users joined from Chennai today',           time: '8 min ago' },
  { icon: Award,    text: 'Tech Mahindra added 120 employees to their portal', time: '12 min ago' },
  { icon: Activity, text: 'Preethi completed LBI™ profiling in 18 minutes',   time: '15 min ago' },
  { icon: Rocket,   text: 'Karthik launched his career plan on Career Launchpad', time: '18 min ago' },
];

function ConsentCheck({
  checked, onChange, children, required = false, testId,
}: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; required?: boolean; testId?: string }) {
  return (
    <div
      role="checkbox"
      tabIndex={0}
      aria-checked={checked}
      aria-required={required}
      className="flex items-start gap-2.5 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 rounded"
      onClick={(e) => { if ((e.target as HTMLElement).closest('a,button')) return; onChange(!checked); }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          if ((e.target as HTMLElement).closest('a,button')) return;
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <div
        className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer flex-none ${checked ? 'border-transparent' : 'border-gray-300'}`}
        style={{ backgroundColor: checked ? BRAND.accent : 'white', borderColor: checked ? BRAND.accent : undefined }}
        data-testid={testId}
      >
        {checked && <Check size={10} className="text-white" strokeWidth={3} />}
      </div>
      <span className="text-[10px] leading-relaxed text-gray-500">{children}</span>
    </div>
  );
}

export function Registration({ onNavigate }: RegistrationProps) {
  const { login: saveSession } = useAuth();

  // Read Google prefill data from sessionStorage (set by Firebase Google login)
  const googlePrefill = (() => {
    try {
      const raw = sessionStorage.getItem('google_prefill');
      if (raw) {
        sessionStorage.removeItem('google_prefill');
        return JSON.parse(raw) as { email?: string; fullName?: string; profilePicture?: string };
      }
    } catch {}
    return null;
  })();

  const [fullName, setFullName] = useState(googlePrefill?.fullName ?? '');
  const [email, setEmail] = useState(googlePrefill?.email ?? '');
  const [googleProfilePicture, setGoogleProfilePicture] = useState(googlePrefill?.profilePicture ?? '');
  const [uploadedPhotoDataUrl, setUploadedPhotoDataUrl] = useState<string | null>(null);
  const [isGooglePrefilled, setIsGooglePrefilled] = useState(!!googlePrefill);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('career_seeker');
  const [age, setAge] = useState('');
  const [grade, setGrade] = useState('');
  // MX-302A — Career Launchpad: stage capture (flag-gated; hidden when OFF).
  const [launchpadEnabled, setLaunchpadEnabled] = useState(false);
  const [careerStage, setCareerStage] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentConsentSent, setParentConsentSent] = useState(false);
  const [consentApproveLink, setConsentApproveLink] = useState('');
  const [consentLinkCopied, setConsentLinkCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [firebaseUid, setFirebaseUid] = useState<string | null>(
    (() => { try { const r = sessionStorage.getItem('google_prefill'); return r ? (JSON.parse(r) as { firebaseUid?: string }).firebaseUid ?? null : null; } catch { return null; } })()
  );

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured || !firebaseAuth || !googleProvider) {
      setError('Google sign-in is not available right now. Please use email registration.');
      return;
    }
    setGoogleLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const firebaseUser = result.user;
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/auth/firebase/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, role }),
      });
      const data = await res.json() as {
        user?: { email?: string; fullName?: string };
        isNewUser?: boolean;
        googleProfile?: { email?: string; fullName?: string; profilePicture?: string };
        message?: string;
      };
      if (res.ok && data.isNewUser && data.googleProfile) {
        setFirebaseUid(firebaseUser.uid);
        if (data.googleProfile.email) setEmail(data.googleProfile.email);
        if (data.googleProfile.fullName) setFullName(data.googleProfile.fullName);
        if (data.googleProfile.profilePicture) setGoogleProfilePicture(data.googleProfile.profilePicture);
        setIsGooglePrefilled(true);
        // Pre-sync profile to Firestore so the doc exists even before registration completes
        await syncProfileToFirestore(firebaseUser.uid, {
          email: data.googleProfile.email ?? firebaseUser.email ?? '',
          fullName: data.googleProfile.fullName ?? firebaseUser.displayName ?? '',
          profilePicture: data.googleProfile.profilePicture ?? firebaseUser.photoURL ?? '',
          role,
          provider: 'google',
        });
      } else if (res.ok && data.user) {
        setError('An account with this Google email already exists. Please sign in instead.');
        setTimeout(() => onNavigate('login'), 1500);
      } else {
        setError(data.message ?? 'Google sign-in failed. Please try again.');
      }
    } catch (err: unknown) {
      const fe = err as { code?: string; message?: string };
      if (fe.code === 'auth/popup-closed-by-user') setError('Google sign-in was cancelled.');
      else if (fe.code === 'auth/popup-blocked') setError('Pop-up was blocked. Please allow pop-ups and try again.');
      else if (fe.code === 'auth/unauthorized-domain') setError('This domain is not authorised in Firebase. Add it to Firebase → Authentication → Authorised domains.');
      else if (fe.code === 'auth/operation-not-allowed') setError('Google Sign-In is not enabled in Firebase → Authentication → Sign-in method.');
      else setError(`Google sign-in failed: ${fe.code ?? fe.message ?? 'unknown error'}`);
    } finally {
      setGoogleLoading(false);
    }
  };
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [parsedProfile, setParsedProfile] = useState<ParsedCVProfile | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [agreeDataProcessing, setAgreeDataProcessing] = useState(false);
  const [agreeCallback, setAgreeCallback] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const [featureIdx, setFeatureIdx]       = useState(0);
  const [featureVisible, setFeatureVisible] = useState(true);
  const [testiIdx, setTestiIdx]           = useState(0);
  const [testiVisible, setTestiVisible]   = useState(true);
  const [liveIdx, setLiveIdx]             = useState(0);
  const [liveVisible, setLiveVisible]     = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setFeatureVisible(false);
      setTimeout(() => {
        setFeatureIdx(i => (i + 1) % FEATURES.length);
        setFeatureVisible(true);
      }, 350);
    }, 3500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setTestiVisible(false);
      setTimeout(() => {
        setTestiIdx(i => (i + 1) % TESTIMONIALS.length);
        setTestiVisible(true);
      }, 350);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setLiveVisible(false);
      setTimeout(() => {
        setLiveIdx(i => (i + 1) % LIVE_ACTIVITY.length);
        setLiveVisible(true);
      }, 300);
    }, 2800);
    return () => clearInterval(t);
  }, []);

  // MX-302A — probe the flag so the Career Stage capture only renders when ON
  // (flag OFF → endpoint 503s → byte-identical legacy form).
  useEffect(() => {
    let alive = true;
    fetch('/api/career/experience/enabled')
      .then(r => { if (alive) setLaunchpadEnabled(r.ok); })
      .catch(() => { if (alive) setLaunchpadEnabled(false); });
    return () => { alive = false; };
  }, []);

  const consentCount = [agreeTerms, agreePrivacy, agreeDataProcessing].filter(Boolean).length;
  const allRequired = agreeTerms && agreePrivacy && agreeDataProcessing;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!isGooglePrefilled) {
      if (password !== confirmPassword) { setError('Passwords do not match'); setLoading(false); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }
    }
    if (role === 'student') {
      const ageNum = parseInt(age);
      if (!age || isNaN(ageNum) || ageNum < 11) {
        setError('Minimum age is 11. If younger, ask your parent or school to register you.');
        setLoading(false); return;
      }
      if (ageNum < 18 && !parentEmail.trim()) {
        setError('Students under 18 must provide a parent or guardian email for consent.');
        setLoading(false); return;
      }
    }
    if (role === 'career_seeker' && launchpadEnabled && !careerStage) {
      setError('Please select your career stage so we can route you to the right experience.');
      setLoading(false); return;
    }
    if (!allRequired) { setError('Please accept all required consents to continue.'); setLoading(false); return; }

    try {
      const apiRole = role === 'career_seeker' ? 'job_seeker'
        : role === 'metryx_applicant' ? 'mentor'
        : role === 'corporate' ? 'hr_recruiter'
        : role;
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: email, fullName, email: email || undefined, mobile: mobileNumber || undefined,
          password: password || undefined, role: apiRole,
          ...(googleProfilePicture && { profilePicture: googleProfilePicture }),
          ...(isGooglePrefilled && { oauthProvider: 'firebase_google' }),
          metadata: {
            ...(role === 'student' && { age: parseInt(age), grade, ...(parseInt(age) < 18 && { parentEmail, requiresParentConsent: true }) }),
            ...(role === 'career_seeker' && launchpadEnabled && careerStage && {
              careerStage,
              careerProfile: {
                highestQualification: grade || undefined,
                fieldOfStudy: fieldOfStudy || undefined,
                yearsExperience: yearsExperience ? Number(yearsExperience) : undefined,
                currentRole: currentRole || undefined,
              },
            }),
            ...(organizationName && { organizationName }),
            ...(isGooglePrefilled && { oauth_provider: 'firebase_google' }),
            consents: {
              termsAccepted: agreeTerms, privacyAccepted: agreePrivacy,
              dataProcessingAccepted: agreeDataProcessing, marketingAccepted: agreeMarketing,
              callbackAccepted: agreeCallback, consentTimestamp: new Date().toISOString(),
            },
          },
        }),
      });
      const data = await response.json();
      if (response.ok) {
        const userData = data.user ?? data;
        saveSession(data.token, userData);
        // Sync completed profile to Firestore if this was a Google sign-in registration
        if (isGooglePrefilled && firebaseUid) {
          syncProfileToFirestore(firebaseUid, {
            email: email,
            fullName: fullName,
            profilePicture: googleProfilePicture || '',
            role: userData?.role ?? role,
            provider: 'google',
          });
        }

        if (parsedProfile && userData?.id) {
          fetch('/api/cv/save-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userData.id, email: email || userData.email, profile: parsedProfile }),
          }).catch(() => {});
        }

        if (role === 'career_seeker' || role === 'metryx_applicant') {
          saveProfileSetupFlag({
            fullName,
            sectionsFilled: parsedProfile?.competencyProfile?.sectionsFilled ?? [],
            completeness: parsedProfile?.competencyProfile?.completeness ?? 0,
            hasPhoto: !!uploadedPhotoDataUrl,
            source: 'registration',
          });
        }

        const roleToTarget: Record<string, Screen> = {
          parent: 'unified-parent-dashboard',
          institute: 'unified-institute-dashboard',
          school: 'unified-institute-dashboard',
          college: 'unified-institute-dashboard',
          mentor: 'mentor-dashboard',
          metryx_applicant: 'mentor-dashboard',
          student: 'student-dashboard',
          ngo: 'ngo-dashboard',
          hr_recruiter: 'employer-portal',
          corporate: 'employer-portal',
          job_seeker: 'career-discovery',
          career_seeker: 'career-discovery',
        };
        const target = userData?.dashboardTarget
          ?? roleToTarget[(userData?.role ?? apiRole ?? role).toLowerCase().trim()];
        const ageNum = parseInt(age);
        if (role === 'student' && ageNum < 18) {
          try {
            const consentRes = await fetch('/api/auth/parent-consent/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.token}`,
              },
            });
            const consentData = await consentRes.json();
            if (consentData.consentToken) {
              const base = window.location.origin;
              setConsentApproveLink(`${base}/parent-consent/${consentData.consentToken}`);
            }
          } catch { }
          setParentConsentSent(true);
          setLoading(false);
          return;
        }
        onNavigate((target ?? 'unified-parent-dashboard') as Screen);
      } else {
        setError((data as { message?: string }).message ?? 'Registration failed');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar onNavigate={onNavigate} currentScreen="registration" />

      <main className="flex-1 pt-20 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-8 items-start">

            {/* ── Right panel — animated (order-1 on mobile, order-2 on desktop) ── */}
            <div className="space-y-4 order-1 lg:order-2 lg:col-span-2">

              {/* Header */}
              <div>
                <h2 className="text-xl font-extrabold mb-1" style={{ color: BRAND.primary }}>Unlock Your Potential</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Join India's leading behavioral intelligence platform for students, career seekers, parents, and institutions.
                </p>
              </div>

              {/* ── Stats bar ── */}
              <div className="grid grid-cols-4 gap-2">
                {STATS.map(s => (
                  <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-3 text-center">
                    <p className="text-base font-extrabold leading-none" style={{ color: BRAND.primary }}>{s.value}</p>
                    <p className="text-[9px] text-gray-400 mt-1 leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* ── Live activity ticker ── */}
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 flex items-center gap-3 overflow-hidden">
                <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: '#4ECDC4' }} />
                <div className="flex-1 overflow-hidden">
                  {(() => {
                    const item = LIVE_ACTIVITY[liveIdx];
                    const Icon = item.icon;
                    return (
                      <div style={{
                        opacity: liveVisible ? 1 : 0,
                        transform: liveVisible ? 'translateY(0)' : 'translateY(-6px)',
                        transition: 'opacity 0.3s ease, transform 0.3s ease',
                      }} className="flex items-center gap-2">
                        <Icon size={12} className="flex-shrink-0 text-gray-400" />
                        <span className="text-xs text-gray-600 truncate">{item.text}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{item.time}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ── Auto-rotating feature spotlight ── */}
              <div className="rounded-xl border-2 overflow-hidden bg-white"
                style={{ borderColor: `${FEATURES[featureIdx].accent}40` }}>
                <div className="px-1 py-0.5 flex gap-1 border-b border-gray-100">
                  {FEATURES.map((_, i) => (
                    <button key={i} onClick={() => { setFeatureVisible(false); setTimeout(() => { setFeatureIdx(i); setFeatureVisible(true); }, 200); }}
                      className="flex-1 h-1 rounded-full transition-all duration-300"
                      style={{ backgroundColor: i === featureIdx ? FEATURES[featureIdx].accent : '#e5e7eb' }} />
                  ))}
                </div>
                <div className="p-4" style={{
                  opacity: featureVisible ? 1 : 0,
                  transform: featureVisible ? 'translateY(0)' : 'translateY(8px)',
                  transition: 'opacity 0.35s ease, transform 0.35s ease',
                  minHeight: 130,
                }}>
                  {(() => {
                    const f = FEATURES[featureIdx];
                    const Icon = f.icon;
                    return (
                      <>
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${f.accent}15` }}>
                            <Icon size={16} style={{ color: f.accent }} strokeWidth={1.5} />
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: f.accent, backgroundColor: `${f.accent}12` }}>
                            {f.tag}
                          </span>
                        </div>
                        <p className="text-sm font-semibold mb-1.5" style={{ color: BRAND.primary }}>{f.title}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{f.body}</p>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* ── Rotating testimonial ── */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex gap-0.5 mb-2.5">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} className="fill-amber-400 text-amber-400" />)}
                </div>
                <div style={{
                  opacity: testiVisible ? 1 : 0,
                  transform: testiVisible ? 'translateX(0)' : 'translateX(10px)',
                  transition: 'opacity 0.35s ease, transform 0.35s ease',
                  minHeight: 72,
                }}>
                  {(() => {
                    const t = TESTIMONIALS[testiIdx];
                    return (
                      <>
                        <p className="text-xs italic text-gray-600 leading-relaxed mb-3">"{t.quote}"</p>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                            style={{ backgroundColor: BRAND.primary }}>{t.initials}</div>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: BRAND.primary }}>{t.name}</p>
                            <p className="text-[10px] text-gray-400">{t.role}</p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                {/* Testi dots */}
                <div className="flex gap-1 mt-3">
                  {TESTIMONIALS.map((_, i) => (
                    <div key={i} className="h-1 rounded-full transition-all duration-300"
                      style={{ width: i === testiIdx ? 16 : 6, backgroundColor: i === testiIdx ? BRAND.accent : '#d1d5db' }} />
                  ))}
                </div>
              </div>

              {/* ── Access checklist (compact) ── */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">What you'll get access to:</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {[
                    'Career Launchpad', 'Employability Passport™',
                    'ExamReadiness Index™', 'LBI™ Cognitive Insights',
                    'AI Personalized Reports', 'Progress Dashboards',
                    'Expert Recommendations', 'Bank-Grade Security',
                  ].map(label => (
                    <div key={label} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                      <CheckCircle size={11} style={{ color: BRAND.accent }} className="flex-shrink-0" />
                      {label}
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5 text-[10px] text-gray-400">
                  <Lock size={10} />
                  <span>No credit card required · Cancel anytime</span>
                </div>
              </div>
            </div>

            {/* ── Left panel — form (order-2 on mobile, order-1 on desktop) ── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm order-2 lg:order-1 lg:col-span-3">

              {/* Card header — no gradient */}
              <div className="px-6 pt-6 pb-5 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${BRAND.primary}08` }}>
                    <User size={18} style={{ color: BRAND.primary }} />
                  </div>
                  <div>
                    <h1 className="text-base font-bold" style={{ color: BRAND.primary }}>Create Your Account</h1>
                    <p className="text-[11px] text-gray-400">Join 50,000+ users on MetryxOne</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleRegister} className="px-6 py-5 space-y-4">

                {/* ── Role selection ── */}
                <div className="space-y-2.5">
                  {/* Group 1 — Platform subscribers */}
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                      I want to use MetryxOne as a...
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PLATFORM_ROLES.map(key => {
                        const cfg = ROLE_CONFIG[key];
                        const active = role === key;
                        return (
                          <button key={key} type="button" onClick={() => setRole(key)} data-testid={`role-${key}`}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all"
                            style={active
                              ? { borderColor: BRAND.primary, backgroundColor: BRAND.primary, boxShadow: '0 2px 8px rgba(11,60,93,0.2)' }
                              : { borderColor: `${BRAND.primary}30`, backgroundColor: `${BRAND.primary}08` }}>
                            <span style={{ color: active ? '#ffffff' : BRAND.primary, flexShrink: 0 }}>{cfg.icon}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-normal leading-tight truncate" style={{ color: active ? '#ffffff' : BRAND.primary }}>
                                {cfg.label}
                              </p>
                              {cfg.sublabel && (
                                <p className="text-[9px] leading-tight truncate" style={{ color: active ? 'rgba(255,255,255,0.7)' : BRAND.accent }}>
                                  {cfg.sublabel}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Group 2 — Work with MetryxOne */}
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                      Or apply to work with MetryxOne
                    </p>
                    {(() => {
                      const key: UserRole = 'metryx_applicant';
                      const cfg = ROLE_CONFIG[key];
                      const active = role === key;
                      return (
                        <button type="button" onClick={() => setRole(key)} data-testid="role-metryx_applicant"
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all"
                          style={active
                            ? { borderColor: BRAND.accent, backgroundColor: BRAND.accent, boxShadow: '0 2px 10px rgba(78,205,196,0.3)' }
                            : { borderColor: `${BRAND.accent}50`, backgroundColor: `${BRAND.accent}08` }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: active ? 'rgba(255,255,255,0.2)' : `${BRAND.accent}15` }}>
                            <span style={{ color: active ? '#ffffff' : BRAND.accent }}>{cfg.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium" style={{ color: active ? '#ffffff' : '#1a2e4a' }}>
                                {cfg.label}
                              </p>
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                                style={{ backgroundColor: active ? 'rgba(255,255,255,0.25)' : `${BRAND.accent}20`, color: active ? '#ffffff' : BRAND.accent }}>
                                {cfg.sublabel}
                              </span>
                            </div>
                            <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: active ? 'rgba(255,255,255,0.8)' : '#6b7280' }}>
                              {cfg.description}
                            </p>
                          </div>
                          <ChevronRight size={16} style={{ color: active ? 'rgba(255,255,255,0.7)' : BRAND.accent, flexShrink: 0 }} />
                        </button>
                      );
                    })()}
                  </div>

                  {/* Selected-persona feedback — what you get + where you'll start */}
                  <div className="rounded-xl border p-3" style={{ borderColor: `${BRAND.primary}20`, backgroundColor: `${BRAND.primary}06` }}>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex-shrink-0" style={{ color: BRAND.primary }}>{ROLE_CONFIG[role].icon}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold leading-tight" style={{ color: BRAND.primary }}>
                          You're signing up as {ROLE_CONFIG[role].label}
                        </p>
                        <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">{ROLE_CONFIG[role].description}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-medium" style={{ color: BRAND.accent }}>
                          <ArrowRight size={11} className="flex-shrink-0" />
                          <span>After sign-up you'll go straight to {ROLE_CONFIG[role].next}.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Google prefill banner */}
                {isGooglePrefilled && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-teal-200 bg-teal-50">
                    {googleProfilePicture && (
                      <img src={googleProfilePicture} alt="" className="w-8 h-8 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-teal-800 truncate">Signed in with Google</p>
                      <p className="text-[10px] text-teal-600 truncate">{email}</p>
                    </div>
                    <CheckCircle size={16} className="text-teal-500 flex-shrink-0" />
                  </div>
                )}

                {/* Full name */}
                <div>
                  <Label htmlFor="fullname" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">Full Name</Label>
                  <Input id="fullname" autoComplete="name" placeholder="Enter your full name" value={fullName} onChange={e => setFullName(e.target.value)}
                    required className="h-10 rounded-lg border-gray-200 bg-white text-sm" data-testid="input-fullname" />
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">
                    Email Address
                    {isGooglePrefilled && <span className="ml-1.5 text-[9px] font-medium text-teal-600 normal-case">(verified via Google)</span>}
                  </Label>
                  <Input id="email" type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={e => !isGooglePrefilled && setEmail(e.target.value)}
                    readOnly={isGooglePrefilled}
                    required className={`h-10 rounded-lg border-gray-200 text-sm ${isGooglePrefilled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'}`} data-testid="input-email" />
                </div>

                {/* Mobile */}
                <div>
                  <Label htmlFor="mobile" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">
                    Mobile Number <span className="font-normal normal-case">(Optional)</span>
                  </Label>
                  <div className="flex gap-2">
                    <div className="h-10 px-3 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500 flex-shrink-0">
                      <Phone size={13} />
                      <span>+91</span>
                    </div>
                    <div className="relative flex-1">
                      <Input id="mobile" type="tel" autoComplete="tel" placeholder="10-digit number" value={mobileNumber}
                        onChange={e => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="h-10 rounded-lg border-gray-200 bg-white text-sm pr-8" data-testid="input-mobile" />
                      {mobileNumber.length === 10 && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <Check size={14} style={{ color: BRAND.accent }} />
                        </div>
                      )}
                    </div>
                  </div>
                  {mobileNumber && mobileNumber.length < 10 && (
                    <p className="text-[10px] text-gray-400 mt-1">{10 - mobileNumber.length} more digits needed</p>
                  )}
                </div>

                {/* Student-specific fields */}
                {role === 'student' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="age" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">Age</Label>
                        <Input id="age" type="number" min="11" max="35" placeholder="11-35" value={age} onChange={e => { setAge(e.target.value); setParentConsentSent(false); }}
                          required className="h-10 rounded-lg border-gray-200 bg-white text-sm" data-testid="input-age" />
                      </div>
                      <div>
                        <Label htmlFor="grade" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">Level</Label>
                        <select id="grade" value={grade} onChange={e => setGrade(e.target.value)} data-testid="select-grade"
                          className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm appearance-none cursor-pointer text-gray-700">
                          <option value="">Select Level</option>
                          <option>Grade 6</option><option>Grade 7</option><option>Grade 8</option>
                          <option>Grade 9</option><option>Grade 10</option>
                          <option>Grade 11</option><option>Grade 12</option>
                          <option>Undergraduate</option><option>Postgraduate</option>
                        </select>
                      </div>
                    </div>
                    {/* Parent consent gate for ages 11-17 */}
                    {age && parseInt(age) >= 11 && parseInt(age) < 18 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <Shield size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-[11px] font-semibold text-amber-800">Parent approval required</p>
                            <p className="text-[10px] text-amber-700 mt-0.5">To unlock your full growth journey, we need a quick parent approval. Enter your parent&apos;s email below &mdash; they&apos;ll receive a consent link.</p>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="parentEmail" className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-1 block">Parent / Guardian Email *</Label>
                          <Input id="parentEmail" type="email" autoComplete="email" placeholder="parent@email.com" value={parentEmail} onChange={e => setParentEmail(e.target.value)}
                            className="h-9 rounded-lg border-amber-300 bg-white text-sm" data-testid="input-parent-email" />
                        </div>
                        {parentConsentSent && (
                          <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 space-y-2">
                            <div className="flex items-center gap-1.5 text-[10px] text-teal-700 font-semibold">
                              <CheckCircle size={11} className="text-teal-600 flex-shrink-0" />
                              Consent request created! Share the link below with your parent.
                            </div>
                            {consentApproveLink ? (
                              <>
                                <p className="text-[10px] text-teal-600">
                                  Share this link with <span className="font-semibold">{parentEmail}</span> &mdash; they click it to approve your account:
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    readOnly
                                    value={consentApproveLink}
                                    className="flex-1 text-[10px] bg-white border border-teal-300 rounded px-2 py-1 truncate text-gray-600 font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(consentApproveLink).then(() => {
                                        setConsentLinkCopied(true);
                                        setTimeout(() => setConsentLinkCopied(false), 2000);
                                      });
                                    }}
                                    className="text-[10px] px-2 py-1 rounded font-semibold whitespace-nowrap"
                                    style={{ backgroundColor: BRAND.accent, color: 'white' }}
                                  >
                                    {consentLinkCopied ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                                <p className="text-[10px] text-gray-400">
                                  Your account will be fully activated once your parent clicks this link.
                                </p>
                              </>
                            ) : (
                              <p className="text-[10px] text-teal-600">
                                Your account will activate once your parent approves at <span className="font-semibold">{parentEmail}</span>.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* MX-302A — Career Stage capture (flag-gated, career seekers only) */}
                {role === 'career_seeker' && launchpadEnabled && (
                  <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: `${BRAND.accent}40`, backgroundColor: `${BRAND.accent}08` }}>
                    <div>
                      <Label htmlFor="careerStage" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">
                        Career Stage <span className="text-red-400">*</span>
                      </Label>
                      <select id="careerStage" value={careerStage} onChange={e => setCareerStage(e.target.value)} data-testid="select-career-stage"
                        className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm appearance-none cursor-pointer text-gray-700">
                        <option value="">Select your stage</option>
                        {CAREER_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                      <p className="text-[10px] text-gray-400 mt-1">We&apos;ll route you to the experience that fits your stage. You can switch later.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="fieldOfStudy" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">Field of Study <span className="font-normal normal-case">(Optional)</span></Label>
                        <Input id="fieldOfStudy" value={fieldOfStudy} onChange={e => setFieldOfStudy(e.target.value)} placeholder="e.g. Computer Science"
                          className="h-10 rounded-lg border-gray-200 bg-white text-sm" data-testid="input-field-of-study" />
                      </div>
                      <div>
                        <Label htmlFor="yearsExperience" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">Years of Experience <span className="font-normal normal-case">(Optional)</span></Label>
                        <Input id="yearsExperience" type="number" min="0" max="60" value={yearsExperience} onChange={e => setYearsExperience(e.target.value)} placeholder="e.g. 3"
                          className="h-10 rounded-lg border-gray-200 bg-white text-sm" data-testid="input-years-experience" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="currentRole" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">Current / Target Role <span className="font-normal normal-case">(Optional)</span></Label>
                      <Input id="currentRole" value={currentRole} onChange={e => setCurrentRole(e.target.value)} placeholder="e.g. Software Engineer"
                        className="h-10 rounded-lg border-gray-200 bg-white text-sm" data-testid="input-current-role" />
                    </div>
                  </div>
                )}

                {/* Career seeker / MetryxOne applicant fields */}
                {(role === 'career_seeker' || role === 'metryx_applicant') && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="qualification" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">Highest Qualification</Label>
                      <select id="qualification" value={grade} onChange={e => setGrade(e.target.value)} data-testid="select-qualification"
                        className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm appearance-none cursor-pointer text-gray-700">
                        <option value="">Select Qualification</option>
                        <option>High School</option><option>Undergraduate</option>
                        <option>Postgraduate</option><option>Professional Degree</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2 block">
                        Resume / CV
                        <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded font-medium normal-case"
                          style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}>
                          AI-Parsed → Aspirant Profile
                        </span>
                      </Label>
                      <CVParserPreview
                        parsed={parsedProfile}
                        photoDataUrl={uploadedPhotoDataUrl}
                        onPhotoChange={(_, dataUrl) => {
                          setUploadedPhotoDataUrl(dataUrl);
                          setGoogleProfilePicture(dataUrl ?? (googlePrefill?.profilePicture ?? ''));
                        }}
                        onProfileParsed={(profile, file) => {
                          setParsedProfile(profile);
                          setResumeFile(file);
                          if (profile.personal.name && !fullName) setFullName(profile.personal.name);
                          if (profile.personal.email && !email) setEmail(profile.personal.email);
                          if (profile.personal.phone && !mobileNumber) {
                            const digits = profile.personal.phone.replace(/\D/g, '').slice(-10);
                            if (digits.length === 10) setMobileNumber(digits);
                          }
                        }}
                        onClear={() => {
                          setParsedProfile(null);
                          setResumeFile(null);
                          setUploadedPhotoDataUrl(null);
                          setGoogleProfilePicture(googlePrefill?.profilePicture ?? '');
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Org name for institute / ngo / corporate */}
                {(role === 'institute' || role === 'ngo' || role === 'corporate') && (
                  <div>
                    <Label htmlFor="orgName" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">
                      {role === 'ngo' ? 'Organization Name' : role === 'corporate' ? 'Company Name' : 'Institution Name'}
                    </Label>
                    <Input id="orgName" autoComplete="organization" value={organizationName} onChange={e => setOrganizationName(e.target.value)} required
                      placeholder={role === 'ngo' ? 'Enter NGO name' : role === 'corporate' ? 'Enter company name' : 'Enter institution name'}
                      className="h-10 rounded-lg border-gray-200 bg-white text-sm" data-testid="input-org-name" />
                  </div>
                )}

                {/* Password row — optional for Google sign-up */}
                {isGooglePrefilled && !showPasswordFields ? (
                  <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <p className="text-[10px] text-gray-400"><Lock size={10} className="inline mr-1" />Password is optional — you can always sign in with Google. Set one if you'd also like to log in with email &amp; password.</p>
                    <button type="button" onClick={() => setShowPasswordFields(true)}
                      className="text-[10px] font-medium mt-1" style={{ color: BRAND.primary }}>
                      + Set a password (optional)
                    </button>
                  </div>
                ) : null}
                {(!isGooglePrefilled || showPasswordFields) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="password" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">
                        Password {isGooglePrefilled && <span className="font-normal normal-case">(Optional)</span>}
                      </Label>
                      <div className="relative">
                        <Input id="password" autoComplete="new-password" type={showPassword ? 'text' : 'password'} placeholder="Min 6 characters"
                          value={password} onChange={e => setPassword(e.target.value)} required={!isGooglePrefilled}
                          className="h-10 pr-9 rounded-lg border-gray-200 bg-white text-sm" data-testid="input-password" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" data-testid="button-toggle-password">
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="confirmPassword" className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5 block">
                        Confirm {isGooglePrefilled && <span className="font-normal normal-case">(Optional)</span>}
                      </Label>
                      <div className="relative">
                        <Input id="confirmPassword" autoComplete="new-password" type={showConfirmPassword ? 'text' : 'password'} placeholder="Repeat password"
                          value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required={!isGooglePrefilled}
                          className="h-10 pr-9 rounded-lg border-gray-200 bg-white text-sm" data-testid="input-confirm-password" />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (() => {
                  const isDuplicate = /already exists|already registered|already in use/i.test(error);
                  return (
                    <div className="rounded-lg bg-red-50 border border-red-100 text-xs overflow-hidden">
                      <p className="px-3 py-2.5 text-red-600">{error}</p>
                      {isDuplicate && (
                        <p className="px-3 py-2 bg-white border-t border-red-100 text-gray-600 leading-relaxed">
                          An account with this email is already registered. Please{' '}
                          <button
                            type="button"
                            onClick={() => onNavigate('login')}
                            className="font-semibold underline hover:opacity-80"
                            style={{ color: BRAND.primary }}
                            data-testid="link-go-to-login"
                          >
                            sign in here
                          </button>
                          {' '}instead, or{' '}
                          <button
                            type="button"
                            onClick={() => onNavigate('forgot-password')}
                            className="font-semibold underline hover:opacity-80"
                            style={{ color: BRAND.primary }}
                            data-testid="link-forgot-password"
                          >
                            reset your password
                          </button>
                          {' '}if you've forgotten it.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* ── Consents ── */}
                <div className="space-y-2.5 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Required Consents</p>
                    <p className="text-[10px] font-semibold" style={{ color: consentCount === 3 ? BRAND.accent : '#9ca3af' }}>
                      {consentCount}/3 completed
                    </p>
                  </div>

                  <ConsentCheck checked={agreeTerms} onChange={setAgreeTerms} required testId="checkbox-terms">
                    I agree to the{' '}
                    <button type="button" onClick={(e) => { e.stopPropagation(); onNavigate('terms'); }} data-testid="link-terms-consent"
                      className="font-medium underline hover:no-underline" style={{ color: BRAND.primary }}>
                      Terms of Service
                    </button>
                    {' '}and acknowledge that I have read and understood the terms governing use of this platform.
                    <span className="text-red-500 ml-0.5">*</span>
                  </ConsentCheck>

                  <ConsentCheck checked={agreePrivacy} onChange={setAgreePrivacy} required testId="checkbox-privacy">
                    I have read and accept the{' '}
                    <button type="button" onClick={(e) => { e.stopPropagation(); onNavigate('privacy'); }} data-testid="link-privacy-consent"
                      className="font-medium underline hover:no-underline" style={{ color: BRAND.primary }}>
                      Privacy Policy
                    </button>
                    {' '}and understand how my personal data will be collected, used, and protected.
                    <span className="text-red-500 ml-0.5">*</span>
                  </ConsentCheck>

                  <ConsentCheck checked={agreeDataProcessing} onChange={setAgreeDataProcessing} required testId="checkbox-data-processing">
                    I consent to the processing of my personal data in accordance with the Digital Personal Data Protection Act, 2023 (DPDP Act) for the purpose of providing assessment services.
                    <span className="text-red-500 ml-0.5">*</span>
                  </ConsentCheck>

                  <ConsentCheck checked={agreeMarketing} onChange={setAgreeMarketing} testId="checkbox-marketing">
                    I agree to receive promotional communications, updates, and educational content from MetryxOne.{' '}
                    <span className="italic text-gray-400">(Optional)</span>
                  </ConsentCheck>

                  {mobileNumber.length === 10 && (
                    <ConsentCheck checked={agreeCallback} onChange={setAgreeCallback} testId="checkbox-callback">
                      I consent to receive calls from MetryxOne representatives regarding my account, services, and relevant updates at the mobile number provided.{' '}
                      <span className="italic text-gray-400">(Optional)</span>
                    </ConsentCheck>
                  )}
                </div>

                {/* Submit */}
                <Button type="submit" className="w-full h-10 font-semibold rounded-lg text-white text-sm"
                  style={{ backgroundColor: BRAND.primary }} disabled={loading || !allRequired} data-testid="button-register">
                  {loading ? (
                    <span className="flex items-center gap-2"><Zap size={15} className="animate-pulse" /> Creating Account...</span>
                  ) : (
                    <span className="flex items-center gap-2">Create Account <ArrowRight size={15} /></span>
                  )}
                </Button>

                {/* Divider */}
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
                  <div className="relative flex justify-center">
                    <span className="px-3 text-[10px] text-gray-400 bg-white uppercase tracking-wider">Or continue with</span>
                  </div>
                </div>

                {/* Google SSO */}
                <button type="button" data-testid="button-google-sso"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                  className="w-full h-10 flex items-center justify-center gap-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors disabled:opacity-60">
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-sm font-medium text-gray-700">
                    {googleLoading ? 'Connecting…' : 'Continue with Google'}
                  </span>
                </button>

                <p className="text-[9px] text-center text-gray-400 leading-relaxed">
                  By creating an account, you confirm that you are at least 18 years of age or have obtained parental/guardian consent.
                  MetryxOne processes data in compliance with applicable laws including the DPDP Act, 2023.
                </p>

                {/* Sign in link */}
                <p className="text-xs text-center text-gray-500">
                  Already have an account?{' '}
                  <button type="button" onClick={() => onNavigate('login')} data-testid="link-login"
                    className="font-semibold hover:underline" style={{ color: BRAND.primary }}>
                    Sign in
                  </button>
                </p>
              </form>

              {/* Card footer trust bar */}
              <div className="border-t border-gray-100 px-6 py-3 bg-gray-50 flex items-center justify-center gap-1.5 text-[10px] text-gray-400">
                <Shield size={11} />
                <span>256-bit SSL • DPDP Act Compliant • ISO 27001</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
