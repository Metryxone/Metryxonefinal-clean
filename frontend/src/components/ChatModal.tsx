import { useState, useEffect, useRef, useCallback } from 'react';
import { useChatPreferences } from '../hooks/useChatPreferences';
import { useTranslation } from 'react-i18next';
import {
  X, Send, Loader2,
  HelpCircle, ChevronRight, Play, Settings,
} from 'lucide-react';
import { Screen } from '../App';
import { VideoPopup } from './VideoPopup';
import PauseOverlay from './PauseOverlay';
import { ChatSettingsPopover, PausePref, ResponseStyle } from './ChatSettingsPopover';

interface VideoSuggestion {
  id: string;
  title: string;
  description: string;
  duration: string;
  embedUrl: string;
}

interface ChatModalProps {
  onNavigate: (screen: Screen) => void;
  onDismiss:  () => void;
}
interface ChatMsg {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  ts:        Date;
  isLoading?:  boolean;
  actions?:  { label: string; message: string }[];
  intentTag?: string;
  videos?: VideoSuggestion[];
  sensitive?: boolean;
}
type ProfileKey = 'student' | 'parent' | 'career' | 'teacher' | 'hr' | 'corporate' | 'institution' | 'coach';

const PROFILES: { key: ProfileKey; label: string }[] = [
  { key: 'student',     label: 'Student'               },
  { key: 'parent',      label: 'Parent'                },
  { key: 'career',      label: 'Career Seeker'         },
  { key: 'teacher',     label: 'Teacher / Educator'    },
  { key: 'hr',          label: 'HR Professional'       },
  { key: 'corporate',   label: 'Corporate / Enterprise'},
  { key: 'institution', label: 'School / Institution'  },
  { key: 'coach',       label: 'Coach / Counsellor'    },
];

const INTENT_LABELS: Record<string, string> = {
  informational: 'Info', advisory: 'Advice', diagnostic: 'Analysis',
  transactional: 'Action', emotional: 'Support',
};

const STARTERS = [
  'I\'m a student preparing for exams',
  'I\'m a parent worried about my child',
  'I need career guidance',
  'I\'m a teacher looking for classroom tools',
  'I\'m in HR — help with hiring',
  'How does MetryxOne work?',
];

const PROMO_SLIDES = [
  { tag: 'FREE ASSESSMENT', headline: 'Discover Your Behavioural DNA', sub: 'Free LBI assessment for students, parents & professionals — takes just 5 minutes', cta: 'Start Free Assessment', ctaMessage: 'I want to start the free LBI behavioural assessment' },
  { tag: 'STUDENTS', headline: 'ExamReady Index', sub: 'AI-powered exam readiness prediction — know where you stand before the big day', cta: 'Check Readiness', ctaMessage: 'How does the ExamReadiness Index work and how do I start?' },
  { tag: 'SCHOOLS', headline: 'MetryxOne for Schools', sub: '200+ schools use behavioural intelligence to transform student outcomes', cta: 'Book School Demo', ctaMessage: 'How can our school use MetryxOne for students? I want to book a demo.' },
  { tag: 'CAREER', headline: 'Career Intelligence Report', sub: 'AI-matched career paths based on your behavioural profile and strengths', cta: 'Explore Careers', ctaMessage: 'I want to explore career options using MetryxOne Career Intelligence' },
  { tag: 'FOR HR TEAMS', headline: 'Hire for Behaviour Fit', sub: 'LBI-powered hiring intelligence — predict culture fit before the interview', cta: 'Book HR Demo', ctaMessage: 'I want to book a corporate HR demo of MetryxOne' },
];

const T = {
  msgAreaBg:  '#F7F9FC',
  botBubble:  '#ffffff',
  botBorder:  '#E8ECF2',
  chipBg:     'rgba(29,62,139,0.06)',
  chipBorder: 'rgba(29,62,139,0.18)',
  chipText:   '#1D3E8B',
  chipHover:  'rgba(29,62,139,0.12)',
  textPrimary:'#1e293b',
  textMuted:  '#94a3b8',
  divider:    '#E8ECF2',
  inputBg:    '#F0F3F8',
};

function MsgText({ text, light = false }: { text: string; light?: boolean }) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <p style={{ fontSize: '14px', margin: 0, color: light ? '#fff' : T.textPrimary, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
      {parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)}
    </p>
  );
}

/* ── Hand-drawn Pragati bot avatar (PNG icons) with idle bob & talk-pulse ── */
function BotAvatar({ size = 32, variant = 'navy', talking = false }: { size?: number; variant?: 'navy' | 'white'; talking?: boolean }) {
  const src = variant === 'white' ? '/bots/bot4-white.png' : '/bots/bot4-navy.png';
  return (
    <span style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
      <span aria-hidden style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: variant === 'white' ? 'transparent' : 'transparent', animation: talking ? 'cmBotPulse 0.9s ease-in-out infinite' : 'cmBotPulse 2.6s ease-in-out infinite' }} />
      <img src={src} alt="" style={{ width: size, height: size, objectFit: 'contain', position: 'relative', zIndex: 1, animation: talking ? 'cmBotTalk 0.55s ease-in-out infinite' : 'cmBotBob 3.2s ease-in-out infinite', transformOrigin: '50% 80%' }} />
    </span>
  );
}

export function ChatModal({ onNavigate: _onNavigate, onDismiss }: ChatModalProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [profile, setProfile] = useState<ProfileKey | null>(null);
  const [profileLocked, setProfileLocked] = useState(false);
  const [sessionId] = useState(() => `cm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [typewriter, setTypewriter] = useState<{ id: string; shown: string; done: boolean } | null>(null);
  const [promoIdx, setPromoIdx] = useState(0);
  const [introTyped, setIntroTyped] = useState(false);
  const [introText, setIntroText] = useState('');
  const [showStarters, setShowStarters] = useState(true);
  const [concernInput, setConcernInput] = useState('');
  const [activeVideo, setActiveVideo] = useState<VideoSuggestion | null>(null);
  const [dismissedBreathing, setDismissedBreathing] = useState<Set<string>>(new Set());
  const { pausePref: suppressBreathing, setPausePreference, clearPausePreference, responseStyle, setResponseStyle, preferredLanguage, setPreferredLanguage, refetch: refetchPrefs } = useChatPreferences();
  const [pauseRemaining, setPauseRemaining] = useState<number | null>(null);
  const pauseRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [concernMatches, setConcernMatches] = useState<{id: number; category: string; concern_area: string; parent_worry: string; impact_on_child: string; assessment_type: string}[]>([]);
  const twRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const concernDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const INTRO_MSG = "Namaste! I'm Pragati, your Progress Assistant.\n\nTell me what's on your mind — whether it's your child's studies, career confusion, exam stress, or anything else. I'm here to help.";

  const startTypewriter = (msgId: string, fullText: string) => {
    if (twRef.current) clearInterval(twRef.current);
    setTypewriter({ id: msgId, shown: '', done: false });
    let i = 0;
    twRef.current = setInterval(() => {
      i++;
      setTypewriter({ id: msgId, shown: fullText.slice(0, i), done: i >= fullText.length });
      if (i >= fullText.length) { clearInterval(twRef.current!); twRef.current = null; }
    }, 18);
  };

  useEffect(() => () => { if (twRef.current) clearInterval(twRef.current); }, []);
  useEffect(() => () => { if (pauseRef.current) clearInterval(pauseRef.current); }, []);

  const startPause = () => {
    if (pauseRef.current) clearInterval(pauseRef.current);
    setPauseRemaining(30);
    pauseRef.current = setInterval(() => {
      setPauseRemaining(r => {
        if (r === null) return null;
        if (r <= 1) {
          if (pauseRef.current) { clearInterval(pauseRef.current); pauseRef.current = null; }
          return null;
        }
        return r - 1;
      });
    }, 1000);
  };
  const endPause = () => {
    if (pauseRef.current) { clearInterval(pauseRef.current); pauseRef.current = null; }
    setPauseRemaining(null);
  };
  const dismissBreathing = (id: string) => setDismissedBreathing(prev => { const next = new Set(prev); next.add(id); return next; });
  const reEnableBreathing = () => {
    clearPausePreference();
    setDismissedBreathing(new Set());
  };
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOpen(true), 60); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setTimeout(onDismiss, 320); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);
  useEffect(() => { if (open) refetchPrefs(); }, [open, refetchPrefs]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!open || introTyped) return;
    let charI = 0;
    setIntroText('');
    const t = setInterval(() => {
      charI++;
      setIntroText(INTRO_MSG.slice(0, charI));
      if (charI >= INTRO_MSG.length) { clearInterval(t); setIntroTyped(true); setTimeout(() => inputRef.current?.focus(), 300); }
    }, 18);
    return () => clearInterval(t);
  }, [open, introTyped]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setPromoIdx(i => (i + 1) % PROMO_SLIDES.length), 5000);
    return () => clearInterval(id);
  }, [open]);

  const effectiveRole = profileLocked ? (profile ?? undefined) : undefined;

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || inputValue).trim();
    if (!msg || isTyping) return;
    setShowStarters(false);
    setMessages(prev => [...prev,
      { id: `u_${Date.now()}`, role: 'user', content: msg, ts: new Date() },
      { id: `l_${Date.now()}`, role: 'assistant', content: '', ts: new Date(), isLoading: true },
    ]);
    setInputValue('');
    setIsTyping(true);
    try {
      const resp = await fetch('/api/chat/message', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId, language: i18n.language, responseStyle, preferredLanguage, context: { userRole: effectiveRole ?? 'guest' } }),
      });
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);
      const data = await resp.json();
      const actions = (data.suggestedActions ?? []).slice(0, 6).map((a: { label: string; message: string }) => ({ label: a.label, message: a.message }));
      const newId = `ai_${Date.now()}`;
      const newText = data.response ?? 'Something went wrong.';
      const videos: VideoSuggestion[] = (data.videoSuggestions ?? []).map((v: any) => ({
        id: v.id, title: v.title, description: v.description, duration: v.duration, embedUrl: v.embedUrl,
      }));
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [...filtered, { id: newId, role: 'assistant', content: newText, ts: new Date(), actions, intentTag: data.intent ? INTENT_LABELS[data.intent] : undefined, videos: videos.length > 0 ? videos : undefined, sensitive: !!data.sensitive }];
      });
      startTypewriter(newId, newText);
      if (data.userType && !profileLocked) {
        const matched = PROFILES.find(p => p.key === data.userType);
        if (matched) { setProfile(matched.key); setProfileLocked(true); }
      }
    } catch {
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [...filtered, { id: `err_${Date.now()}`, role: 'assistant', content: 'Connection issue — try again shortly.', ts: new Date() }];
      });
    } finally { setIsTyping(false); }
  }, [inputValue, isTyping, sessionId, i18n.language, effectiveRole, profileLocked, responseStyle]);

  const searchConcerns = async (text: string) => {
    if (text.trim().length < 3) { setConcernMatches([]); return; }
    try {
      const resp = await fetch('/api/chat/match-concerns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
      const data = await resp.json();
      setConcernMatches(data.matches || []);
    } catch { setConcernMatches([]); }
  };

  const handleConcernInput = (val: string) => {
    setConcernInput(val);
    if (concernDebounce.current) clearTimeout(concernDebounce.current);
    concernDebounce.current = setTimeout(() => searchConcerns(val), 300);
  };

  const handleConcernSelect = (concern: typeof concernMatches[0]) => {
    setConcernMatches([]); setConcernInput('');
    sendMessage(concern.parent_worry);
  };

  const dismiss = () => { setOpen(false); setTimeout(onDismiss, 320); };
  const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const promo = PROMO_SLIDES[promoIdx % PROMO_SLIDES.length];

  return (
    <>
      <div className="fixed inset-0 z-[9998] transition-all duration-300"
        style={{ backgroundColor: open ? 'rgba(15,23,42,0.5)' : 'rgba(15,23,42,0)', backdropFilter: open ? 'blur(6px)' : 'blur(0px)' }}
        onClick={dismiss} />

      <div className="fixed z-[9999]"
        style={{
          width: 'min(820px, 96vw)', top: '50%', left: '50%',
          transform: `translate(-50%, ${open ? '-50%' : '-46%'})`,
          opacity: open ? 1 : 0,
          transition: 'transform 0.32s cubic-bezier(0.34,1.2,0.64,1), opacity 0.22s ease',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(15,23,42,0.30), 0 8px 32px rgba(15,23,42,0.20)',
        }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', height: 'min(540px, 90vh)' }}>

          {/* Left promo panel */}
          <div style={{ width: 300, background: '#1D3E8B', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
            {/* Decorative gradient orbs */}
            <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'transparent', pointerEvents: 'none', filter: 'blur(8px)' }} />
            <div style={{ position: 'absolute', bottom: -50, left: -50, width: 180, height: 180, borderRadius: '50%', background: 'transparent', pointerEvents: 'none', filter: 'blur(10px)' }} />
            {/* Subtle dot grid pattern */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'transparent', backgroundSize: '14px 14px', pointerEvents: 'none' }} />
            <div style={{ padding: '28px 24px 16px', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <BotAvatar size={44} variant="white" />
                <div>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>MetryxOne</p>
                  <p style={{ margin: 0, fontSize: '11px', color: 'rgba(46,196,182,0.85)', fontWeight: 600, letterSpacing: '0.2px' }}>Behavioural Intelligence</p>
                </div>
              </div>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.65, margin: '0 0 20px' }}>
                AI-powered assessments and personalised reports for students, parents, schools and enterprises.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {['LBI Behavioural Assessment', 'Exam Readiness Index', 'Career Intelligence', 'Mentor Matching', 'HR Hiring Intelligence'].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="7" cy="7" r="6.5" fill="rgba(46,196,182,0.18)" />
                      <path d="M4 7 L6 9 L10 5" stroke="#2EC4B6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{item}</span>
                  </div>
                ))}
              </div>
              {/* Stat tiles — credibility strip */}
              <div style={{ display: 'flex', gap: 6, marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                {[
                  { num: '160', label: 'Concerns' },
                  { num: '18', label: 'Categories' },
                  { num: '4', label: 'Stages' },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#2EC4B6', lineHeight: 1.1, letterSpacing: '-0.3px' }}>{s.num}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 24px 22px', position: 'relative', zIndex: 1 }}>
              <button key={promoIdx} aria-label={`${promo.headline} — ${promo.cta}`}
                style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.10)', animation: 'cmFadeUp 0.4s ease both', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s' }}
                onClick={() => sendMessage(promo.ctaMessage)}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}>
                <span style={{ display: 'inline-block', marginBottom: 6, fontSize: '9px', fontWeight: 700, letterSpacing: '0.2px', color: '#2EC4B6', background: 'rgba(46,196,182,0.12)', borderRadius: 4, padding: '2px 7px' }}>{promo.tag.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                <p style={{ margin: '0 0 4px', fontSize: '13.5px', fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>{promo.headline}</p>
                <p style={{ margin: '0 0 10px', fontSize: '10.5px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{promo.sub}</p>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#2EC4B6', display: 'flex', alignItems: 'center', gap: 4 }}>{promo.cta} <ChevronRight size={10} /></span>
              </button>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 10 }} role="tablist" aria-label="Promotional slides">
                {PROMO_SLIDES.map((s, i) => (
                  <button key={i} onClick={() => setPromoIdx(i)} role="tab" aria-selected={i === promoIdx % PROMO_SLIDES.length} aria-label={`Slide ${i + 1}: ${s.headline}`}
                    style={{ width: i === promoIdx % PROMO_SLIDES.length ? 14 : 5, height: 5, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0, background: i === promoIdx % PROMO_SLIDES.length ? '#2EC4B6' : 'rgba(255,255,255,0.25)', transition: 'all 0.3s ease' }} />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 14 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ECDC4' }} />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>Live · In-house · Private</span>
              </div>
            </div>
          </div>

          {/* Right chat panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff', minWidth: 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 56, minHeight: 56, background: '#2352b0', borderBottom: '1px solid rgba(46,196,182,0.25)', flexShrink: 0 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <BotAvatar size={34} variant="white" talking={isTyping} />
                <span style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: '#4ECDC4', border: '1.5px solid #1D3E8B', boxShadow: '0 0 4px rgba(74,222,128,0.7)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#ffffff', lineHeight: 1.2, letterSpacing: '-0.2px' }}>Pragati</p>
                <p style={{ margin: 0, fontSize: '10px', color: 'rgba(46,196,182,0.9)', fontWeight: 500 }}>● Online · Progress Assistant</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
                <button onClick={() => setShowSettings(s => !s)} title="Chat preferences"
                  data-testid="btn-chat-settings" data-mx-chat-settings-trigger aria-label="Chat preferences" aria-expanded={showSettings}
                  style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: showSettings ? 'rgba(255,255,255,0.15)' : 'transparent', cursor: 'pointer', color: showSettings ? '#fff' : 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { if (!showSettings) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; } }}>
                  <Settings size={14} />
                </button>
                <button onClick={dismiss} title="Close"
                  style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
                  ✕
                </button>
                {showSettings && (
                  <ChatSettingsPopover
                    pausePref={suppressBreathing}
                    onChangePausePref={setPausePreference}
                    responseStyle={responseStyle}
                    onChangeResponseStyle={setResponseStyle}
                    preferredLanguage={preferredLanguage}
                    onChangePreferredLanguage={setPreferredLanguage}
                    onClose={() => setShowSettings(false)}
                    testIdPrefix="cm-settings"
                  />
                )}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: `${T.msgAreaBg}` }}>
              {/* Intro bubble */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, animation: 'cmFadeUp 0.35s ease both' }}>
                <BotAvatar size={28} variant="navy" talking={!introTyped} />
                <div style={{ background: T.botBubble, borderRadius: '4px 14px 14px 14px', border: `1px solid ${T.botBorder}`, padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', maxWidth: '85%' }}>
                  {introText === '' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0' }}>
                      {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', display: 'inline-block', animation: `cmDot 1.4s infinite ${i*0.22}s` }} />)}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.6, color: T.textPrimary, whiteSpace: 'pre-wrap' }}>
                      {introText}{!introTyped && <span style={{ color: '#1D3E8B', fontWeight: 300, marginLeft: 1, animation: 'cmBlink 0.6s step-end infinite' }}>|</span>}
                    </p>
                  )}
                </div>
              </div>

              {/* Conversation starters */}
              {introTyped && showStarters && messages.length === 0 && (
                <div style={{ animation: 'cmFadeUp 0.4s ease 0.15s both', paddingLeft: 4, marginTop: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '4px 0 12px' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1 L8.2 5.2 L12.5 5.2 L9 8 L10.2 12.5 L7 9.8 L3.8 12.5 L5 8 L1.5 5.2 L5.8 5.2 Z" fill="#2EC4B6" /></svg>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1D3E8B', letterSpacing: '-0.2px' }}>How can I help you today?</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                    {[
                      { title: 'Student',      sub: 'Exam prep & study help', text: STARTERS[0],
                        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3 L2 8 L12 13 L22 8 L12 3 Z M6 10 V15 C6 16.5 9 18 12 18 C15 18 18 16.5 18 15 V10" stroke="#1D3E8B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                      { title: 'Parent',       sub: 'Worried about my child', text: STARTERS[1],
                        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="#1D3E8B" strokeWidth="1.8"/><circle cx="17" cy="9" r="2.2" stroke="#1D3E8B" strokeWidth="1.8"/><path d="M3 20 C3 16 6 14 9 14 C12 14 15 16 15 20 M14 20 C14 17 16 15.5 17 15.5 C19 15.5 21 17 21 20" stroke="#1D3E8B" strokeWidth="1.8" strokeLinecap="round"/></svg> },
                      { title: 'Career',       sub: 'Find your direction',    text: STARTERS[2],
                        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#1D3E8B" strokeWidth="1.8"/><circle cx="12" cy="12" r="4.5" stroke="#1D3E8B" strokeWidth="1.8"/><circle cx="12" cy="12" r="1.5" fill="#1D3E8B"/></svg> },
                      { title: 'Teacher',      sub: 'Classroom tools',        text: STARTERS[3],
                        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 5 H21 V17 H13 L12 19 L11 17 H3 Z" stroke="#1D3E8B" strokeWidth="1.8" strokeLinejoin="round"/><path d="M7 9 H17 M7 13 H14" stroke="#1D3E8B" strokeWidth="1.8" strokeLinecap="round"/></svg> },
                      { title: 'HR & Hiring',  sub: 'Culture & fit',          text: STARTERS[4],
                        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 8 H20 V20 H4 Z M9 8 V5 H15 V8" stroke="#1D3E8B" strokeWidth="1.8" strokeLinejoin="round"/><path d="M4 13 H20" stroke="#1D3E8B" strokeWidth="1.8"/></svg> },
                      { title: 'How it works', sub: 'About MetryxOne',        text: STARTERS[5],
                        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#1D3E8B" strokeWidth="1.8"/><path d="M9 9 C9 7 10.5 6 12 6 C13.5 6 15 7 15 9 C15 11 12 11 12 13" stroke="#1D3E8B" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="17" r="0.9" fill="#1D3E8B"/></svg> },
                    ].map((s, i) => (
                      <button key={i} onClick={() => sendMessage(s.text)}
                        style={{ position: 'relative', padding: '10px 11px 10px 13px', borderRadius: 10, border: `1px solid ${T.chipBorder}`, background: '#ffffff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 9 }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#2EC4B6'; e.currentTarget.style.boxShadow = '0 3px 12px rgba(29,62,139,0.10)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.chipBorder; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                        <span style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: '#1D3E8B', borderRadius: '10px 0 0 10px' }} />
                        <span style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(29,62,139,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</span>
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#1D3E8B', lineHeight: 1.2, letterSpacing: '-0.1px' }}>{s.title}</span>
                          <span style={{ fontSize: '10px', fontWeight: 500, color: '#64748b', lineHeight: 1.3, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.sub}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat messages */}
              {messages.map(message => (
                <div key={message.id} style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start', animation: 'cmFadeUp 0.25s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, maxWidth: '88%', flexDirection: message.role === 'user' ? 'row-reverse' : 'row' }}>
                    {message.role === 'user' ? (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0B3C5D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                        <span style={{ fontSize: '10px', color: '#fff', fontWeight: 700 }}>{profile ? PROFILES.find(p => p.key === profile)?.label[0] : 'U'}</span>
                      </div>
                    ) : <BotAvatar size={28} variant="navy" talking={isTyping && message.id === messages[messages.length-1]?.id} />}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      {message.role === 'user' ? (
                        <div style={{ background: '#1D3E8B', padding: '10px 14px', borderRadius: '14px 4px 14px 14px', display: 'inline-block' }}>
                          <MsgText text={message.content} light />
                        </div>
                      ) : (
                        <div>
                          <div style={{ background: T.botBubble, border: `1px solid ${T.botBorder}`, borderRadius: '4px 14px 14px 14px', padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                            {message.isLoading ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0' }}>
                                {[0,1,2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#1D3E8B', display: 'inline-block', animation: `cmDot 1.4s infinite ${i*0.22}s` }} />)}
                              </div>
                            ) : (
                              <>
                                <MsgText text={typewriter?.id === message.id ? typewriter.shown : message.content} />
                                {typewriter?.id === message.id && !typewriter.done && (
                                  <span style={{ display: 'inline-block', width: 2, height: '1em', background: '#1D3E8B', marginLeft: 1, verticalAlign: 'text-bottom', animation: 'cmBlink 0.6s step-end infinite' }} />
                                )}
                              </>
                            )}
                          </div>

                          {message.sensitive && message.videos && message.videos.length > 0 && !message.isLoading && (typewriter?.id !== message.id || typewriter.done) && !dismissedBreathing.has(message.id) && (
                            suppressBreathing === 'none' ? (
                              <div className="cm-breathing-room" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 2px 0', flexWrap: 'wrap' }}>
                                <p style={{ margin: 0, fontSize: '12.5px', fontStyle: 'italic', color: '#0f8a7e', lineHeight: 1.4, opacity: 0.9, flex: '1 1 auto', minWidth: 0 }}>
                                  Would you like a moment before we continue?
                                </p>
                                <button onClick={startPause} aria-label="Take a 30-second pause" data-testid={`btn-take-pause-${message.id}`}
                                  style={{ padding: '4px 10px', borderRadius: 14, border: '1px solid rgba(46,196,182,0.45)', background: 'rgba(46,196,182,0.10)', color: '#0f8a7e', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(46,196,182,0.20)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(46,196,182,0.10)'; }}>
                                  Take a moment
                                </button>
                                <button onClick={() => setPausePreference('session')} aria-label="Don't ask again this session" data-testid={`btn-suppress-breathing-session-${message.id}`}
                                  style={{ padding: '4px 8px', borderRadius: 14, border: 'none', background: 'transparent', color: '#0f8a7e', fontSize: '11px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline', textUnderlineOffset: 2, opacity: 0.85 }}
                                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.85'; }}>
                                  Don't ask this session
                                </button>
                                <button onClick={() => setPausePreference('always')} aria-label="Don't ask again — always hide" data-testid={`btn-suppress-breathing-always-${message.id}`}
                                  style={{ padding: '4px 6px', border: 'none', background: 'transparent', color: '#5b8c87', fontSize: '10.5px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', opacity: 0.75 }}
                                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.75'; }}>
                                  · Always
                                </button>
                                <button onClick={() => dismissBreathing(message.id)} aria-label="Dismiss breathing-room prompt" data-testid={`btn-dismiss-breathing-${message.id}`}
                                  style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'transparent', color: '#0f8a7e', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, opacity: 0.6, transition: 'opacity 0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; }}>
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="cm-breathing-room" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 2px 0', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', fontStyle: 'italic', color: '#94a3b8' }}>
                                  Pause prompts hidden{suppressBreathing === 'always' ? ' (always)' : ' for this session'} —
                                </span>
                                <button onClick={reEnableBreathing} data-testid={`btn-reenable-breathing-${message.id}`} aria-label="Re-enable pause prompts"
                                  style={{ padding: 0, border: 'none', background: 'transparent', color: '#0f8a7e', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                                  re-enable
                                </button>
                              </div>
                            )
                          )}

                          {message.videos && message.videos.length > 0 && !message.isLoading && (typewriter?.id !== message.id || typewriter.done) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                              {message.sensitive && (
                                <p style={{ margin: '0 0 2px', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: '#0f8a7e' }}>
                                  Helpful video — take a moment to watch
                                </p>
                              )}
                              {message.videos.map(v => message.sensitive ? (
                                <button key={v.id} onClick={() => setActiveVideo(v)} aria-label={`Watch supportive video: ${v.title}`}
                                  className="mx-supportive-video"
                                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1.5px solid rgba(46,196,182,0.45)', background: 'rgba(46,196,182,0.10))', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.2s', boxShadow: '0 2px 12px rgba(46,196,182,0.12)' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(46,196,182,0.18))'; e.currentTarget.style.borderColor = 'rgba(46,196,182,0.65)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(46,196,182,0.10))'; e.currentTarget.style.borderColor = 'rgba(46,196,182,0.45)'; }}>
                                  <div className="mx-supportive-play" style={{ width: 46, height: 46, borderRadius: 12, background: '#2EC4B6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 0 4px rgba(46,196,182,0.18), 0 4px 14px rgba(46,196,182,0.35)' }}>
                                    <Play size={18} fill="#fff" color="#fff" />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: '#0f8a7e', lineHeight: 1.3 }}>{v.title}</p>
                                    <p style={{ margin: '3px 0 0', fontSize: '10.5px', color: '#5b8c87', lineHeight: 1.3 }}>{v.duration} · A supportive resource</p>
                                  </div>
                                </button>
                              ) : (
                                <button key={v.id} onClick={() => setActiveVideo(v)} aria-label={`Watch: ${v.title}`}
                                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(29,62,139,0.15)', background: 'rgba(29,62,139,0.03)', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(29,62,139,0.08)'; e.currentTarget.style.borderColor = 'rgba(29,62,139,0.30)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(29,62,139,0.03)'; e.currentTarget.style.borderColor = 'rgba(29,62,139,0.15)'; }}>
                                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1D3E8B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Play size={14} fill="#fff" color="#fff" />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontSize: '11.5px', fontWeight: 600, color: '#1D3E8B', lineHeight: 1.3 }}>{v.title}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', lineHeight: 1.3 }}>{v.duration} · Click to watch</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {message.actions && message.actions.length > 0 && !message.isLoading && (typewriter?.id !== message.id || typewriter.done) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                              {message.actions.slice(0, 6).map((action, ai) => (
                                <button key={ai} onClick={() => sendMessage(action.message)}
                                  style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${T.chipBorder}`, background: T.chipBg, color: T.chipText, fontSize: '11.5px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = T.chipHover; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = T.chipBg; }}>
                                  {action.label}
                                </button>
                              ))}
                              {message.id === [...messages].reverse().find(m => m.role === 'assistant' && !m.isLoading && m.actions && m.actions.length > 0)?.id && !isTyping && (
                                <div style={{ marginTop: 4, position: 'relative' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <input value={concernInput} onChange={e => handleConcernInput(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter' && concernInput.trim()) { sendMessage(concernInput); setConcernInput(''); setConcernMatches([]); } }}
                                      placeholder="Describe your concern..."
                                      style={{ flex: 1, padding: '6px 11px', borderRadius: 18, border: `1px solid ${T.chipBorder}`, background: T.chipBg, fontSize: '11px', color: T.textPrimary, outline: 'none' }}
                                      onFocus={e => { e.currentTarget.style.borderColor = '#1D3E8B'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(29,62,139,0.10)'; }}
                                      onBlur={e => { setTimeout(() => { e.currentTarget.style.borderColor = T.chipBorder; e.currentTarget.style.boxShadow = 'none'; }, 200); }}
                                    />
                                    <button onClick={() => { if (concernInput.trim()) { sendMessage(concernInput); setConcernInput(''); setConcernMatches([]); } }} disabled={!concernInput.trim()}
                                      style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', flexShrink: 0, background: concernInput.trim() ? '#1D3E8B' : 'rgba(29,62,139,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: concernInput.trim() ? 'pointer' : 'default' }}>
                                      <Send size={10} color={concernInput.trim() ? '#fff' : '#94a3b8'} />
                                    </button>
                                  </div>
                                  {concernMatches.length > 0 && (
                                    <div style={{ marginTop: 6, borderRadius: 10, border: `1px solid ${T.botBorder}`, background: T.botBubble, overflow: 'hidden' }}>
                                      <p style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', padding: '6px 10px 2px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Related concerns</p>
                                      {concernMatches.map(c => (
                                        <button key={c.id} onClick={() => handleConcernSelect(c)}
                                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', cursor: 'pointer', background: 'transparent', borderTop: `1px solid ${T.botBorder}`, transition: 'background 0.12s' }}
                                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(29,62,139,0.04)'; }}
                                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                                          <span style={{ fontSize: '11px', fontWeight: 600, color: T.textPrimary, display: 'block', lineHeight: 1.3 }}>"{c.parent_worry}"</span>
                                          <span style={{ fontSize: '9px', color: '#94a3b8', display: 'flex', gap: 6, marginTop: 2 }}>
                                            <span style={{ background: 'rgba(29,62,139,0.08)', padding: '1px 5px', borderRadius: 3, color: '#1D3E8B', fontWeight: 600 }}>{c.category}</span>
                                            <span>{c.impact_on_child}</span>
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <p style={{ fontSize: '9px', color: T.textMuted, marginTop: 4, textAlign: message.role === 'user' ? 'right' : 'left' }}>{fmtTime(message.ts)}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div style={{ padding: '12px 16px', background: '#ffffff', borderTop: `1px solid ${T.divider}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 24, padding: '0 4px 0 16px', background: T.inputBg, border: `1.5px solid ${T.divider}`, transition: 'all 0.2s' }} id="cm-input-wrap">
                <input ref={inputRef} value={inputValue} onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type your question or concern..."
                  disabled={isTyping}
                  style={{ flex: 1, background: 'transparent', border: 'none', padding: '11px 0', outline: 'none', fontSize: '13.5px', color: T.textPrimary }}
                  onFocus={() => { const el = document.getElementById('cm-input-wrap'); if (el) { el.style.borderColor = '#2EC4B6'; el.style.boxShadow = '0 0 0 3px rgba(46,196,182,0.15)'; el.style.background = '#ffffff'; } }}
                  onBlur={() => { const el = document.getElementById('cm-input-wrap'); if (el) { el.style.borderColor = T.divider; el.style.boxShadow = 'none'; el.style.background = T.inputBg; } }}
                />
                <button onClick={() => sendMessage()} disabled={!inputValue.trim() || isTyping}
                  style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: inputValue.trim() ? '#2EC4B6' : '#E0E5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inputValue.trim() ? 'pointer' : 'default', flexShrink: 0, transition: 'all 0.2s', boxShadow: inputValue.trim() ? '0 2px 10px rgba(46,196,182,0.4)' : 'none' }}>
                  {isTyping ? <Loader2 size={14} style={{ color: '#fff', animation: 'spin 1s linear infinite' }} /> : <Send size={14} style={{ color: inputValue.trim() ? '#fff' : '#94a3b8' }} />}
                </button>
              </div>
              <p style={{ textAlign: 'center', margin: '8px 0 0', fontSize: '9px', color: '#b0b8c9', fontWeight: 500, letterSpacing: '0.3px' }}>
                🔒 Pragati · In-house · Private · No data shared externally
              </p>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes cmBotBob { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-2.5px) rotate(1deg)} }
          @keyframes cmBotTalk { 0%,100%{transform:translateY(0) scale(1) rotate(-2deg)} 25%{transform:translateY(-1.5px) scale(1.04) rotate(2deg)} 75%{transform:translateY(0.5px) scale(0.98) rotate(-1deg)} }
          @keyframes cmBotPulse { 0%,100%{opacity:0.55;transform:scale(0.92)} 50%{opacity:0.95;transform:scale(1.08)} }
          @keyframes cmFadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
          @keyframes cmDot { 0%,80%,100%{transform:translateY(0);opacity:0.35} 40%{transform:translateY(-6px);opacity:1} }
          @keyframes cmBlink { 0%,100%{opacity:1} 50%{opacity:0} }
          @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
          @keyframes cmSupportivePulse {
            0%,100% { box-shadow: 0 0 0 4px rgba(46,196,182,0.18), 0 4px 14px rgba(46,196,182,0.35); }
            50%     { box-shadow: 0 0 0 8px rgba(46,196,182,0.10), 0 6px 18px rgba(46,196,182,0.50); }
          }
          .mx-supportive-play { animation: cmSupportivePulse 2.4s ease-in-out infinite; }
          @keyframes cmBreathingFade { from{opacity:0;transform:translateY(2px)} to{opacity:0.9;transform:translateY(0)} }
          .cm-breathing-room { animation: cmBreathingFade 0.6s ease-out both; }
          @media (prefers-reduced-motion: reduce) {
            .mx-supportive-play { animation: none !important; }
            .cm-breathing-room { animation: none !important; opacity: 0.9 !important; transform: none !important; }
          }
        `}</style>
      </div>
      {activeVideo && <VideoPopup title={activeVideo.title} embedUrl={activeVideo.embedUrl} onClose={() => setActiveVideo(null)} />}
      {pauseRemaining !== null && (
        <PauseOverlay prefix="cm" onEnd={endPause} />
      )}
    </>
  );
}
