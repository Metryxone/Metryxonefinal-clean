import { useState, useEffect, useRef } from 'react';
import { useChatPreferences } from '../hooks/useChatPreferences';
import { useTranslation } from 'react-i18next';
import {
  X, Send, Minus, RotateCcw, Loader2,
  Calendar, Sparkles,
  HelpCircle, Users,
  ChevronRight, Tag, School, Play, Settings, ArrowRight,
} from 'lucide-react';
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

interface MessageAction { label: string; icon: typeof HelpCircle; message: string; }
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  actions?: MessageAction[];
  intentTag?: string;
  videos?: VideoSuggestion[];
  sensitive?: boolean;
  quizCard?: { type: 'persona-select' | 'question' | 'result'; step?: number; };
}

interface ChatWidgetProps {
  position?: 'bottom-right' | 'bottom-left';
  userName?: string;
  userRole?: string;
}

type ProfileKey = 'student' | 'parent' | 'career' | 'teacher' | 'hr' | 'corporate' | 'institution' | 'coach';

const PROFILES: { key: ProfileKey; label: string; sub: string }[] = [
  { key: 'student',     label: 'Student',               sub: 'Academic Excellence'     },
  { key: 'parent',      label: 'Parent',                sub: "Child's Development"     },
  { key: 'career',      label: 'Career Seeker',         sub: 'Professional Growth'     },
  { key: 'teacher',     label: 'Teacher / Educator',    sub: 'Classroom Effectiveness' },
  { key: 'hr',          label: 'HR Professional',       sub: 'Talent & Hiring'         },
  { key: 'corporate',   label: 'Corporate / Enterprise', sub: 'Team Intelligence'      },
  { key: 'institution', label: 'School / Institution',  sub: 'Institutional Analytics' },
  { key: 'coach',       label: 'Coach / Counsellor',    sub: 'Guidance & Support'      },
];

const QUICK_STARTS: MessageAction[] = [
  { label: 'I\'m a student',      icon: ChevronRight, message: 'I\'m a student. How can MetryxOne help me with my studies and career?' },
  { label: 'I\'m a parent',       icon: Users,        message: 'I\'m a parent. How does MetryxOne help me understand my child?' },
  { label: 'Career guidance',     icon: Sparkles,     message: 'I\'m looking for career guidance. What tools does MetryxOne offer?' },
  { label: 'For my school',       icon: School,       message: 'How can our school use MetryxOne for students?' },
  { label: 'HR & hiring',         icon: Tag,          message: 'I\'m in HR. How does MetryxOne help with behavioural hiring?' },
  { label: 'Book a demo',         icon: Calendar,     message: 'I would like to book a demo of MetryxOne' },
];

const INTENT_LABELS: Record<string, string> = {
  informational: 'Info', advisory: 'Advice', diagnostic: 'Analysis',
  transactional: 'Action', emotional: 'Support',
};

const PROMO_SLIDES = [
  {
    tag: 'FREE ASSESSMENT',
    tagColor: '#2EC4B6',
    headline: 'Discover Your Behavioural DNA',
    sub: 'Free LBI assessment for students, parents & professionals — takes just 5 minutes',
    cta: 'Start Free Assessment',
    ctaMessage: 'I want to start the free LBI behavioural assessment',
    bg: '#1D3E8B',
  },
  {
    tag: 'STUDENTS',
    tagColor: '#F59E0B',
    headline: 'ExamReady Index',
    sub: 'AI-powered exam readiness prediction — know where you stand before the big day',
    cta: 'Check Readiness',
    ctaMessage: 'How does the ExamReadiness Index work and how do I start?',
    bg: '#0f4c3a',
  },
  {
    tag: 'SCHOOLS',
    tagColor: '#0B3C5D',
    headline: 'MetryxOne for Schools',
    sub: '200+ schools use behavioural intelligence to transform student outcomes',
    cta: 'Book School Demo',
    ctaMessage: 'How can our school use MetryxOne for students? I want to book a demo.',
    bg: '#3b1d7c',
  },
  {
    tag: 'CAREER',
    tagColor: '#2EC4B6',
    headline: 'Career Intelligence Report',
    sub: 'AI-matched career paths based on your behavioural profile and strengths',
    cta: 'Explore Careers',
    ctaMessage: 'I want to explore career options using MetryxOne Career Intelligence',
    bg: '#1e3a5f',
  },
  {
    tag: 'FOR HR TEAMS',
    tagColor: '#F59E0B',
    headline: 'Hire for Behaviour Fit',
    sub: 'LBI-powered hiring intelligence — predict culture fit before the interview',
    cta: 'Book HR Demo',
    ctaMessage: 'I want to book a corporate HR demo of MetryxOne',
    bg: '#6b3a0f',
  },
];

const STARTERS = [
  'I\'m a student preparing for exams',
  'I\'m a parent worried about my child',
  'I need career guidance',
  'I\'m a teacher looking for classroom tools',
  'I\'m in HR — help with hiring',
  'How does MetryxOne work?',
];

const QUIZ_PERSONAS = [
  { id: 'student',      label: 'Student',              sub: 'Learning Readiness',      emoji: '🎓' },
  { id: 'educator',     label: 'Teacher / Educator',   sub: 'Classroom Engagement',    emoji: '👩‍🏫' },
  { id: 'campus',       label: 'Campus Student',       sub: 'Employability Check',     emoji: '🏫' },
  { id: 'jobseeker',    label: 'Job Seeker',           sub: 'Role Fitment Assessment', emoji: '💼' },
  { id: 'parent',       label: 'Parent / Guardian',    sub: "Child's Readiness Check", emoji: '👨‍👩‍👧' },
  { id: 'professional', label: 'Working Professional', sub: 'Workplace Effectiveness', emoji: '🏢' },
] as const;

const QUIZ_QUESTIONS = [
  { q: 'When you need to learn something new, you prefer to:', options: ['Watch videos or visual diagrams', 'Discuss and explain to others', 'Read and take detailed notes', 'Jump in and try it hands-on'], traits: ['visual','verbal','analytical','kinesthetic'] },
  { q: 'When working on a long task, you usually:', options: ['Break it into scheduled steps', 'Work in one long deep session', 'Switch between tasks to stay fresh', 'Rush under deadline pressure'], traits: ['structured','focused','flexible','reactive'] },
  { q: 'In a group setting, you naturally:', options: ['Take charge and guide the team', 'Generate creative ideas', 'Keep everyone in harmony', 'Track progress and deadlines'], traits: ['leader','creative','social','executor'] },
  { q: 'Your biggest learning challenge is:', options: ['Staying focused for long periods', 'Recalling information later', 'Managing time and priorities', 'Handling stress and pressure'], traits: ['focus','memory','time','stress'] },
  { q: 'When you make a mistake, you typically:', options: ['Analyse what went wrong and fix it', 'Move on quickly and try again', 'Overthink it and feel bad', 'Seek advice from others'], traits: ['analytical','resilient','anxious','social'] },
  { q: 'Which best describes how you remember things?', options: ['Through images, charts or diagrams', 'By explaining or teaching others', 'By writing or typing it down', 'By doing or practising it'], traits: ['visual','verbal','written','kinesthetic'] },
  { q: 'You feel most energised when:', options: ['Solving creative challenges', 'Helping or collaborating with others', 'Tackling complex logical problems', 'Completing tasks and checking goals off'], traits: ['creative','social','analytical','executor'] },
  { q: 'When stressed, you tend to:', options: ['Need quiet alone time to recharge', 'Reach out to friends or mentors', 'Distract yourself to decompress', 'Channel it into focused work'], traits: ['introvert','social','escapist','focused'] },
  { q: 'When you receive feedback, you:', options: ['Reflect carefully before acting on it', 'Feel immediately motivated to improve', 'Feel a bit defensive at first', 'Focus mostly on the positive parts'], traits: ['reflective','motivated','defensive','optimist'] },
  { q: 'Your biggest personal strength is:', options: ['Creative problem-solving', 'Focus and persistence', 'Understanding and empathy', 'Organisation and planning'], traits: ['creative','focused','empathetic','structured'] },
];

const LEARNING_PROFILES = [
  { name: 'Analytical Strategist', color: '#1D3E8B', emoji: '🔬', description: 'You think deeply and systematically. You excel at breaking down complex problems and prefer evidence-based, structured approaches.', strengths: ['Deep critical thinking', 'Pattern recognition', 'Self-directed learning', 'Research & analysis'], actions: ['Use spaced repetition for retention', 'Create mind maps before studying', 'Set structured daily goals', 'Track progress with data'], traits: ['analytical','structured','focused','reflective','written','executor'] },
  { name: 'Collaborative Explorer', color: '#2EC4B6', emoji: '🤝', description: "You learn best through interaction. You're energised by people and thrive in collaborative, discussion-rich environments.", strengths: ['Interpersonal intelligence', 'Communication & persuasion', 'Empathy & team harmony', 'Creative brainstorming'], actions: ['Join study groups or peer learning', 'Teach concepts to others', 'Seek mentorship actively', 'Use discussion forums'], traits: ['social','verbal','empathetic','creative','leader'] },
  { name: 'Kinesthetic Achiever', color: '#F4A261', emoji: '⚡', description: "You're a hands-on learner who thrives with real-world application. You stay motivated through action and tangible outcomes.", strengths: ['Practical problem-solving', 'Resilience under pressure', 'Adaptability & flexibility', 'Fast execution'], actions: ['Apply concepts through projects', 'Use movement while studying', 'Set mini-deadlines for momentum', 'Embrace trial-and-error learning'], traits: ['kinesthetic','resilient','flexible','reactive','focused','motivated'] },
  { name: 'Visual Innovator', color: '#8B5CF6', emoji: '🎨', description: 'You process information visually and think in patterns. You have strong creative imagination and a systems-thinking mindset.', strengths: ['Visual memory & spatial thinking', 'Creative ideation', 'Systems thinking', 'Pattern recognition'], actions: ['Use diagrams, charts and mind maps', 'Colour-code your notes', 'Create visual project timelines', 'Explore design thinking methods'], traits: ['visual','creative','optimist','leader','introvert'] },
];

function computeQuizProfile(answers: number[]) {
  const tc: Record<string, number> = {};
  answers.forEach((a, qi) => { const t = QUIZ_QUESTIONS[qi]?.traits[a]; if (t) tc[t] = (tc[t] || 0) + 1; });
  const scores = LEARNING_PROFILES.map(p => p.traits.reduce((s, t) => s + (tc[t] || 0), 0));
  return LEARNING_PROFILES[scores.indexOf(Math.max(...scores))];
}

function MsgText({ text, light = false }: { text: string; light?: boolean }) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <p style={{ fontSize: '13.5px', margin: 0, color: light ? '#fff' : '#1e293b', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
      {parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)}
    </p>
  );
}

export function ChatWidget({ position = 'bottom-right', userName, userRole }: ChatWidgetProps) {
  const { i18n } = useTranslation();

  const wasDismissed = sessionStorage.getItem('mx-chat-dismissed') === '1';
  const [isOpen,        setIsOpen]        = useState(!wasDismissed);
  const [userDismissed, setUserDismissed] = useState(wasDismissed);
  const [isCentered,    setIsCentered]    = useState(!wasDismissed);
  const [isMinimized,   setIsMinimized]   = useState(false);
  const [messages,      setMessages]      = useState<ChatMessage[]>([]);
  const [inputValue,    setInputValue]    = useState('');
  const [isTyping,      setIsTyping]      = useState(false);
  const [profile,       setProfile]       = useState<ProfileKey | null>(null);
  const [profileLocked, setProfileLocked] = useState(false);
  const [showStarters,  setShowStarters]  = useState(true);
  const [promoIdx,      setPromoIdx]      = useState(0);
  const [introTyped,    setIntroTyped]    = useState(false);
  const [introText,     setIntroText]     = useState('');
  const [sessionId]  = useState(() => `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [hasUnread,     setHasUnread]     = useState(false);
  const [promptVisible, setPromptVisible] = useState(true);
  const [typewriter, setTypewriter] = useState<{ id: string; shown: string; done: boolean } | null>(null);
  const [concernInput, setConcernInput] = useState('');
  const [concernMatches, setConcernMatches] = useState<{id: number; category: string; concern_area: string; parent_worry: string; impact_on_child: string; assessment_type: string}[]>([]);
  const [botConcernSearch, setBotConcernSearch] = useState('');
  const [botConcernSuggestions, setBotConcernSuggestions] = useState<{id: number; concern_area: string; category: string; has_assessment: boolean}[]>([]);
  const [botConcernLoading, setBotConcernLoading] = useState(false);
  const [showBotSuggestions, setShowBotSuggestions] = useState(false);
  const botConcernRef = useRef<HTMLDivElement>(null);
  const botConcernDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quizRef = useRef<{ persona: string; answers: number[] }>({ persona: '', answers: [] });
  const [activeVideo, setActiveVideo] = useState<VideoSuggestion | null>(null);
  const [dismissedBreathing, setDismissedBreathing] = useState<Set<string>>(new Set());
  const { pausePref: suppressBreathing, setPausePreference, clearPausePreference, responseStyle, setResponseStyle, preferredLanguage, setPreferredLanguage, refetch: refetchPrefs } = useChatPreferences();
  const [pauseRemaining, setPauseRemaining] = useState<number | null>(null);
  const pauseRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const twRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const concernDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  const INTRO_MSG = "Namaste! I'm Pragati, your Progress Assistant.\n\nTell me what's on your mind — whether it's your child's studies, career confusion, exam stress, or anything else. I'm here to help.";

  const startTypewriter = (msgId: string, fullText: string) => {
    if (twRef.current) clearInterval(twRef.current);
    setTypewriter({ id: msgId, shown: '', done: false });
    let i = 0;
    twRef.current = setInterval(() => {
      i++;
      const shown = fullText.slice(0, i);
      setTypewriter({ id: msgId, shown, done: i >= fullText.length });
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

  useEffect(() => {
    if (!isOpen) return;
    if (introTyped) return;
    let charI = 0;
    setIntroText('');
    const t = setInterval(() => {
      charI++;
      setIntroText(INTRO_MSG.slice(0, charI));
      if (charI >= INTRO_MSG.length) {
        clearInterval(t);
        setIntroTyped(true);
        setTimeout(() => inputRef.current?.focus(), 300);
      }
    }, 18);
    return () => clearInterval(t);
  }, [isOpen, introTyped]);

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setPromoIdx(i => (i + 1) % PROMO_SLIDES.length), 5000);
    return () => clearInterval(id);
  }, [isOpen]);

  const FEATURES = ['Behavioral Assessment', 'LBI Intelligence', 'Career Guidance', 'Mentor Matching', 'Exam Readiness', 'School Analytics', 'HR Hiring Fit'];
  const [featureIdx, setFeatureIdx] = useState(0);
  useEffect(() => {
    if (isOpen) return;
    const id = setInterval(() => setFeatureIdx(i => (i + 1) % FEATURES.length), 5000);
    return () => clearInterval(id);
  }, [isOpen]);

  useEffect(() => {
    const q = botConcernSearch.trim();
    if (q.length < 2) { setBotConcernSuggestions([]); setShowBotSuggestions(false); return; }
    setBotConcernLoading(true);
    if (botConcernDebounce.current) clearTimeout(botConcernDebounce.current);
    botConcernDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/concerns/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const list = (data.concerns ?? []).slice(0, 6);
        setBotConcernSuggestions(list);
        setShowBotSuggestions(list.length > 0);
      } catch { setBotConcernSuggestions([]); }
      finally { setBotConcernLoading(false); }
    }, 280);
    return () => { if (botConcernDebounce.current) clearTimeout(botConcernDebounce.current); };
  }, [botConcernSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (botConcernRef.current && !botConcernRef.current.contains(e.target as Node)) {
        setShowBotSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (isOpen) { setHasUnread(false); }
    if (isOpen && messages.length > 0) { setTimeout(() => inputRef.current?.focus(), 300); }
  }, [isOpen, messages.length]);
  useEffect(() => { if (isOpen) refetchPrefs(); }, [isOpen, refetchPrefs]);

  /* Listen for external "open chat" requests (e.g. dashboard "Ask Pragati" CTAs) */
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      sessionStorage.removeItem('mx-chat-dismissed');
      setUserDismissed(false);
      setIsOpen(true);
      setIsCentered(false);
      setIsMinimized(false);
      const detail = (e as CustomEvent).detail as { message?: string } | undefined;
      if (detail?.message) setPendingMessage(detail.message);
    };
    window.addEventListener('mx-open-chat', handler as EventListener);
    return () => window.removeEventListener('mx-open-chat', handler as EventListener);
  }, []);

  const effectiveRole = profileLocked ? (profile ?? userRole) : (userRole ?? profile);

  const sendMessage = async (text?: string) => {
    const msg = (text || inputValue).trim();
    if (!msg || isTyping) return;
    setShowStarters(false);
    setMessages(prev => [...prev,
      { id: `user_${Date.now()}`, role: 'user', content: msg, timestamp: new Date() },
      { id: `loading_${Date.now()}`, role: 'assistant', content: '', timestamp: new Date(), isLoading: true },
    ]);
    setInputValue('');
    setIsTyping(true);
    try {
      const resp = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: msg, sessionId, language: i18n.language, responseStyle, preferredLanguage, context: { userName, userRole: effectiveRole ?? undefined } }),
      });
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);
      const data = await resp.json();
      const actions: MessageAction[] = (data.suggestedActions ?? []).slice(0, 6).map((a: { label: string; message: string }, i: number) => ({
        label: a.label, message: a.message,
        icon: (QUICK_STARTS[i]?.icon ?? ChevronRight) as typeof HelpCircle,
      }));
      const newId = `ai_${Date.now()}`;
      const newText = data.response ?? 'Sorry, something went wrong.';
      const videos: VideoSuggestion[] = (data.videoSuggestions ?? []).map((v: any) => ({
        id: v.id, title: v.title, description: v.description, duration: v.duration, embedUrl: v.embedUrl,
      }));
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [...filtered, { id: newId, role: 'assistant', content: newText, timestamp: new Date(), actions, intentTag: data.intent ? INTENT_LABELS[data.intent] : undefined, videos: videos.length > 0 ? videos : undefined, sensitive: !!data.sensitive }];
      });
      startTypewriter(newId, newText);
      if (data.userType && !profileLocked) {
        const matched = PROFILES.find(p => p.key === data.userType);
        if (matched) { setProfile(matched.key); setProfileLocked(true); }
      }
    } catch {
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [...filtered, { id: `err_${Date.now()}`, role: 'assistant', content: 'Connection issue — please try again shortly.', timestamp: new Date() }];
      });
    } finally {
      setIsTyping(false);
      if (!isOpen) setHasUnread(true);
    }
  };

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

  const handleBotConcernSubmit = (overrideConcern?: string) => {
    const text = (overrideConcern ?? botConcernSearch).trim();
    setShowBotSuggestions(false);
    if (!text) return;
    window.dispatchEvent(new CustomEvent('mx-open-assessment', { detail: { concern: text } }));
  };

  const startLearningStyleQuiz = () => {
    quizRef.current = { persona: '', answers: [] };
    setShowStarters(false);
    setMessages([{ id: `quiz_persona_${Date.now()}`, role: 'assistant', content: '', timestamp: new Date(), quizCard: { type: 'persona-select' } }]);
  };

  const selectQuizPersona = (personaId: string) => {
    quizRef.current.persona = personaId;
    const personaLabel = QUIZ_PERSONAS.find(p => p.id === personaId)?.label ?? personaId;
    setMessages(prev => [
      ...prev,
      { id: `user_persona_${Date.now()}`, role: 'user', content: `I am a ${personaLabel}`, timestamp: new Date() },
      { id: `quiz_q0_${Date.now()}`, role: 'assistant', content: '', timestamp: new Date(), quizCard: { type: 'question', step: 0 } },
    ]);
  };

  const answerQuizQuestion = (step: number, answerIdx: number) => {
    quizRef.current.answers = [...quizRef.current.answers, answerIdx];
    const selectedOption = QUIZ_QUESTIONS[step]?.options[answerIdx] ?? '';
    const nextStep = step + 1;
    setMessages(prev => [
      ...prev,
      { id: `user_ans_${Date.now()}`, role: 'user', content: selectedOption, timestamp: new Date() },
      nextStep >= QUIZ_QUESTIONS.length
        ? { id: `quiz_result_${Date.now()}`, role: 'assistant', content: '', timestamp: new Date(), quizCard: { type: 'result' } }
        : { id: `quiz_q${nextStep}_${Date.now()}`, role: 'assistant', content: '', timestamp: new Date(), quizCard: { type: 'question', step: nextStep } },
    ]);
  };

  const resetChat = () => {
    setProfileLocked(false); setProfile(null);
    setMessages([]); setShowStarters(true);
    setIntroTyped(false); setIntroText('');
    setPromoIdx(0); setConcernMatches([]);
    setBotConcernSearch(''); setBotConcernSuggestions([]); setShowBotSuggestions(false);
    quizRef.current = { persona: '', answers: [] };
    reEnableBreathing();
  };

  const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  void position;

  /* Flush pending message once chat is open and idle.
     Fire-and-forget: do NOT return a cleanup that cancels the timer,
     because clearing pendingMessage re-runs the effect and would cancel itself. */
  useEffect(() => {
    if (pendingMessage && isOpen && !isTyping) {
      const msg = pendingMessage;
      setPendingMessage(null);
      window.setTimeout(() => sendMessage(msg), 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage, isOpen, isTyping]);

  const T = {
    windowBg:   '#ffffff',
    msgAreaBg:  '#F7F9FC',
    inputAreaBg:'#ffffff',
    inputBg:    '#F0F3F8',
    botBubble:  '#ffffff',
    botBorder:  '#E8ECF2',
    chipBg:     'rgba(29,62,139,0.06)',
    chipBorder: 'rgba(29,62,139,0.18)',
    chipText:   '#1D3E8B',
    chipHover:  'rgba(29,62,139,0.12)',
    textPrimary:'#1e293b',
    textMuted:  '#94a3b8',
    divider:    '#E8ECF2',
    border:     '#E0E5EE',
  };

  const BotAvatar = ({ size = 28, variant = 'navy', talking = false }: { size?: number; variant?: 'navy' | 'white'; talking?: boolean }) => (
    <span style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
      <span aria-hidden style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: variant === 'white' ? 'transparent' : 'transparent', animation: talking ? 'mxBotPulse 0.9s ease-in-out infinite' : 'mxBotPulse 2.6s ease-in-out infinite' }} />
      <img src={variant === 'white' ? '/bots/bot4-white.png' : '/bots/bot4-navy.png'} alt="" style={{ width: size, height: size, objectFit: 'contain', position: 'relative', zIndex: 1, animation: talking ? 'mxBotTalk 0.55s ease-in-out infinite' : 'mxBotBob 3.2s ease-in-out infinite', transformOrigin: '50% 80%' }} />
    </span>
  );

  const reopenChat = () => {
    sessionStorage.removeItem('mx-chat-dismissed');
    setUserDismissed(false);
    setIsOpen(true);
    setIsCentered(false);
    setIsMinimized(false);
    setPromptVisible(true);
  };

  /* ── Closed state — floating avatar ── */
  if (!isOpen) {
    const PROMPTS = [
      { tag: 'FREE',     headline: 'Discover Your Behavioural DNA',     sub: 'Free LBI assessment for all roles · takes 5 min' },
      { tag: 'STUDENT',  headline: 'Predict Your Exam Readiness',      sub: 'AI-scored insights before your next exam' },
      { tag: 'CAREER',   headline: 'Find Your Ideal Career Path',      sub: 'AI-matched careers based on your strengths' },
      { tag: 'PARENTS',  headline: 'Understand How Your Child Learns', sub: 'Personalised insights for every parent' },
      { tag: 'HR',       headline: 'Hire for Culture & Behaviour Fit', sub: 'LBI-powered behavioural hiring intelligence' },
      { tag: 'SCHOOLS',  headline: 'Track Cohort Growth in Real Time', sub: 'Institutional analytics for educators' },
    ];
    const prompt = PROMPTS[featureIdx % PROMPTS.length];

    return (
      <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 50 }}>
        <style>{`
          @keyframes mxFloat { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} 70%{transform:translateY(-4px)} }
          @keyframes mxBubbleFade { 0%{opacity:0;transform:translateY(6px) scale(0.97)} 12%{opacity:1;transform:translateY(0) scale(1)} 85%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-4px) scale(0.97)} }
          @keyframes mxOnlinePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
          @keyframes mxRing { 0%{box-shadow:0 0 0 0 rgba(46,196,182,0.55)} 70%{box-shadow:0 0 0 16px rgba(46,196,182,0)} 100%{box-shadow:0 0 0 0 rgba(46,196,182,0)} }
          @keyframes mxSignalPulse { 0%,100%{opacity:0.2} 50%{opacity:1} }
          @keyframes mxDotPulse { 0%,100%{opacity:0.4;transform:scale(0.85)} 50%{opacity:1;transform:scale(1.2)} }
          @keyframes mxEdgeFlow { 0%{stroke-dashoffset:18} 100%{stroke-dashoffset:0} }
          @keyframes mxOrbit { from{transform:rotate(0deg) translateX(20px) rotate(0deg)} to{transform:rotate(360deg) translateX(20px) rotate(-360deg)} }
          @keyframes mxCorePulse { 0%,100%{opacity:0.75;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }
          @keyframes mxGlowBreath { 0%,100%{filter:blur(6px);opacity:0.5} 50%{filter:blur(10px);opacity:0.9} }
          .mx-n1{animation:mxSignalPulse 1.6s ease-in-out infinite 0s;transform-box:fill-box;transform-origin:center}
          .mx-n2{animation:mxSignalPulse 1.6s ease-in-out infinite 0.5s;transform-box:fill-box;transform-origin:center}
          .mx-n3{animation:mxDotPulse 2s ease-in-out infinite 0s;transform-box:fill-box;transform-origin:center}
          .mx-e1{stroke-dasharray:9 9;animation:mxEdgeFlow 1.1s linear infinite}
          .mx-e2{stroke-dasharray:9 9;animation:mxEdgeFlow 1.1s linear infinite 0.37s}
          .mx-e3{stroke-dasharray:9 9;animation:mxEdgeFlow 1.1s linear infinite 0.74s}
          .mx-orbit{animation:mxOrbit 3s linear infinite}
          .mx-core{animation:mxCorePulse 2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
          .mx-glow{animation:mxGlowBreath 2s ease-in-out infinite}
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {promptVisible && (
            <div key={featureIdx} style={{ background: '#ffffff', borderRadius: 14, padding: '13px 16px', boxShadow: '0 8px 32px rgba(29,62,139,0.14), 0 2px 8px rgba(29,62,139,0.08)', border: '1px solid #E0E5EE', position: 'relative', width: 220, animation: 'mxBubbleFade 4s ease-in-out' }}>
              <span style={{ display: 'inline-block', marginBottom: 6, fontSize: '9px', fontWeight: 700, letterSpacing: '0.2px', color: '#fff', background: '#1D3E8B', borderRadius: 4, padding: '2px 7px' }}>{prompt.tag.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#1D3E8B', margin: '0 0 4px', lineHeight: 1.35 }}>{prompt.headline}</p>
              <p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 8px', lineHeight: 1.5 }}>{prompt.sub}</p>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#2EC4B6' }}>Chat with Pragati →</span>
              <button onClick={e => { e.stopPropagation(); setPromptVisible(false); }} style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%', border: 'none', background: '#F0F2F6', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#9CA3AF' }}>✕</button>
              <div style={{ position: 'absolute', bottom: -8, right: 28, width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid #ffffff' }} />
            </div>
          )}
          <div style={{ position: 'relative', alignSelf: 'flex-end' }}>
            {hasUnread && <span style={{ position: 'absolute', top: -4, right: -4, zIndex: 1, width: 18, height: 18, borderRadius: '50%', background: '#EF4444', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>!</span>}
            <button onClick={reopenChat} data-testid="btn-open-chat" aria-label="Open MetryxAI chat" style={{ border: 'none', cursor: 'pointer', padding: 0, background: 'transparent', animation: 'mxFloat 3.2s ease-in-out infinite', borderRadius: '50%', position: 'relative' }}>
              <div style={{ borderRadius: '50%', animation: 'mxRing 2.4s ease-out infinite', display: 'inline-flex', position: 'relative' }}>
                {/* Breathing aurora halo */}
                <div className="mx-glow" style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'transparent', pointerEvents: 'none' }} />
                {/* Main disc */}
                <div style={{ width: 66, height: 66, borderRadius: '50%', background: '#1e3f8a', boxShadow: '0 8px 28px rgba(13,31,77,0.8), 0 0 0 2px #2EC4B6, 0 0 0 5px rgba(46,196,182,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  {/* Soft inner top glow */}
                  <div style={{ position: 'absolute', top: -10, left: '10%', width: '80%', height: '50%', borderRadius: '50%', background: 'transparent', pointerEvents: 'none' }} />
                  {/* Futuristic AI face SVG */}
                  <svg width="46" height="46" viewBox="0 0 44 44" fill="none" style={{ position: 'relative', zIndex: 1 }}>
                    <defs>
                      <linearGradient id="mxFaceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3dddd0" />
                        <stop offset="55%" stopColor="#2EC4B6" />
                        <stop offset="100%" stopColor="#1fa89e" />
                      </linearGradient>
                    </defs>
                    {/* Signal arcs — broadcasting AI */}
                    <path d="M16 6 Q22 2 28 6" stroke="#2EC4B6" strokeWidth="1.6" fill="none" strokeLinecap="round" className="mx-n1" />
                    <path d="M13 4 Q22 -1 31 4" stroke="rgba(46,196,182,0.35)" strokeWidth="1" fill="none" strokeLinecap="round" className="mx-n2" />
                    {/* Connector stem */}
                    <rect x="20.5" y="6" width="3" height="5" rx="1.5" fill="rgba(46,196,182,0.6)" />
                    {/* Head — smooth rounded rect */}
                    <rect x="7" y="11" width="30" height="26" rx="9" fill="url(#mxFaceGrad)" />
                    {/* Top shine highlight */}
                    <rect x="9" y="12" width="26" height="9" rx="7" fill="rgba(255,255,255,0.22)" />
                    {/* Holographic visor band */}
                    <rect x="9" y="19" width="26" height="11" rx="5.5" fill="rgba(5,12,35,0.78)" />
                    <rect x="9" y="19" width="26" height="11" rx="5.5" stroke="rgba(46,196,182,0.35)" strokeWidth="0.8" fill="none" />
                    {/* Left eye — lens style */}
                    <circle cx="16" cy="24.5" r="4" fill="rgba(46,196,182,0.2)" className="mx-core" />
                    <circle cx="16" cy="24.5" r="2.6" fill="#2EC4B6" />
                    <circle cx="16" cy="24.5" r="1.3" fill="white" />
                    <circle cx="14.8" cy="23.4" r="0.55" fill="rgba(255,255,255,0.85)" />
                    {/* Right eye — lens style */}
                    <circle cx="28" cy="24.5" r="4" fill="rgba(46,196,182,0.2)" className="mx-core" style={{ animationDelay: '0.55s' }} />
                    <circle cx="28" cy="24.5" r="2.6" fill="#2EC4B6" />
                    <circle cx="28" cy="24.5" r="1.3" fill="white" />
                    <circle cx="26.8" cy="23.4" r="0.55" fill="rgba(255,255,255,0.85)" />
                    {/* Chin arc */}
                    <path d="M15 34 Q22 38 29 34" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    <circle cx="22" cy="36" r="1.3" fill="rgba(46,196,182,0.55)" className="mx-n3" />
                    {/* Left side circuit lines */}
                    <line x1="3" y1="21" x2="7" y2="21" stroke="rgba(46,196,182,0.45)" strokeWidth="1.2" strokeLinecap="round" />
                    <line x1="3" y1="24.5" x2="7" y2="24.5" stroke="rgba(46,196,182,0.7)" strokeWidth="1.2" strokeLinecap="round" />
                    <line x1="3" y1="28" x2="7" y2="28" stroke="rgba(46,196,182,0.45)" strokeWidth="1.2" strokeLinecap="round" />
                    {/* Right side circuit lines */}
                    <line x1="37" y1="21" x2="41" y2="21" stroke="rgba(46,196,182,0.45)" strokeWidth="1.2" strokeLinecap="round" />
                    <line x1="37" y1="24.5" x2="41" y2="24.5" stroke="rgba(46,196,182,0.7)" strokeWidth="1.2" strokeLinecap="round" />
                    <line x1="37" y1="28" x2="41" y2="28" stroke="rgba(46,196,182,0.45)" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            </button>
            <span style={{ position: 'absolute', top: 3, right: 3, width: 11, height: 11, borderRadius: '50%', background: '#4ECDC4', border: '2px solid #ffffff', boxShadow: '0 0 5px rgba(74,222,128,0.7)', animation: 'mxOnlinePulse 2s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  const closeCentered = () => { setIsCentered(false); setIsOpen(false); setUserDismissed(true); sessionStorage.setItem('mx-chat-dismissed', '1'); };
  const minimizeCentered = () => { setIsCentered(false); };
  const closeWidget = () => { setIsOpen(false); setUserDismissed(true); sessionStorage.setItem('mx-chat-dismissed', '1'); };
  const promo = PROMO_SLIDES[promoIdx % PROMO_SLIDES.length];

  /* ── Promo side panel for centered mode ── */
  const PromoPanel = () => (
    <div style={{ width: 280, background: '#1D3E8B', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Decorative gradient orbs */}
      <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'transparent', pointerEvents: 'none', filter: 'blur(8px)' }} />
      <div style={{ position: 'absolute', bottom: -50, left: -50, width: 180, height: 180, borderRadius: '50%', background: 'transparent', pointerEvents: 'none', filter: 'blur(10px)' }} />
      {/* Subtle dot grid pattern */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'transparent', backgroundSize: '14px 14px', pointerEvents: 'none' }} />
      <div style={{ padding: '28px 24px 16px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <BotAvatar size={44} variant="white" />
          <div>
            <p style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.4px' }}>MetryxOne</p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(46,196,182,0.85)', fontWeight: 600, letterSpacing: '0.2px' }}>Behavioural Intelligence</p>
          </div>
        </div>
        <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.65, margin: '0 0 20px' }}>
          AI-powered assessments &amp; personalised reports for students, parents, schools &amp; enterprises.
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
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#2EC4B6', lineHeight: 1.1, letterSpacing: '-0.3px' }}>{s.num}</p>
              <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 24px 20px', position: 'relative', zIndex: 1 }}>
        <button key={promoIdx} aria-label={`${promo.headline} — ${promo.cta}`}
          style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.10)', animation: 'mxMsgIn 0.4s ease both', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 0.15s' }}
          onClick={() => sendMessage(promo.ctaMessage)}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}>
          <span style={{ display: 'inline-block', marginBottom: 6, fontSize: '9px', fontWeight: 700, letterSpacing: '0.2px', color: promo.tagColor, background: 'rgba(46,196,182,0.12)', borderRadius: 4, padding: '2px 7px' }}>{promo.tag.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
          <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>{promo.headline}</p>
          <p style={{ margin: '0 0 10px', fontSize: '10.5px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{promo.sub}</p>
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
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Live · In-house · Private</span>
        </div>
      </div>
    </div>
  );

  /* ── Chat panel (used in both centered and sidebar modes) ── */
  const ChatPanel = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.windowBg, minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 56, minHeight: 56, background: '#2352b0', borderBottom: '1px solid rgba(46,196,182,0.25)', flexShrink: 0, cursor: isMinimized ? 'pointer' : 'default' }}
        onClick={() => isMinimized && setIsMinimized(false)} data-testid="chat-header">
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <BotAvatar size={34} variant="white" talking={isTyping} />
          <span style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: '#4ECDC4', border: '1.5px solid #1D3E8B', boxShadow: '0 0 4px rgba(74,222,128,0.7)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#ffffff', lineHeight: 1.2, letterSpacing: '-0.2px' }}>Pragati</p>
          <p style={{ margin: 0, fontSize: '10px', color: 'rgba(46,196,182,0.9)', fontWeight: 500 }}>● Online · Progress Assistant</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
          <button onClick={(e) => { e.stopPropagation(); setShowSettings(s => !s); }} title="Chat preferences"
            data-testid="btn-chat-settings" data-mx-chat-settings-trigger aria-label="Chat preferences" aria-expanded={showSettings}
            style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: showSettings ? 'rgba(255,255,255,0.15)' : 'transparent', cursor: 'pointer', color: showSettings ? '#fff' : 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { if (!showSettings) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; } }}>
            <Settings size={14} />
          </button>
          {[
            { action: (e: React.MouseEvent) => { e.stopPropagation(); resetChat(); }, testId: 'btn-new-conversation', title: 'New chat', label: '↻' },
            { action: (e: React.MouseEvent) => { e.stopPropagation(); if (isCentered) minimizeCentered(); else setIsMinimized(!isMinimized); }, testId: 'btn-minimize-chat', title: isCentered ? 'Move to sidebar' : 'Minimize', label: '−' },
            { action: (e: React.MouseEvent) => { e.stopPropagation(); if (isCentered) closeCentered(); else closeWidget(); }, testId: 'btn-close-chat', title: 'Close', label: '✕' },
          ].map(({ action, testId, title, label }) => (
            <button key={testId} onClick={action} title={title} data-testid={testId}
              style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
              {label}
            </button>
          ))}
          {showSettings && (
            <ChatSettingsPopover
              pausePref={suppressBreathing}
              onChangePausePref={setPausePreference}
              responseStyle={responseStyle}
              onChangeResponseStyle={setResponseStyle}
              preferredLanguage={preferredLanguage}
              onChangePreferredLanguage={setPreferredLanguage}
              onClose={() => setShowSettings(false)}
              testIdPrefix="chat-settings"
            />
          )}
        </div>
      </div>

      {/* Scrolling ad strip under header (sidebar mode only) */}
      {!isCentered && !isMinimized && (
        <button onClick={() => sendMessage(promo.ctaMessage)} aria-label={`${promo.headline} — ${promo.cta}`}
          style={{ height: 36, minHeight: 36, width: '100%', background: '#F0F3F8', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: 'none', borderBottomStyle: 'solid', borderBottomWidth: 1, borderBottomColor: T.divider, transition: 'background 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#E8ECF2'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#F0F3F8'; }}>
          <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.2px', color: '#fff', background: '#1D3E8B', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>{promo.tag.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#1D3E8B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, textAlign: 'left' }}>{promo.headline}</span>
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#2EC4B6', flexShrink: 0 }}>{promo.cta} →</span>
        </button>
      )}

      {!isMinimized && (
        <>
          {/* Messages area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: `${T.msgAreaBg}` }}>

            {/* Intro bubble */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, animation: 'mxMsgIn 0.35s ease both' }}>
              <BotAvatar size={28} variant="navy" talking={!introTyped} />
              <div style={{ background: T.botBubble, borderRadius: '4px 14px 14px 14px', border: `1px solid ${T.botBorder}`, padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', maxWidth: '85%' }}>
                {introText === '' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0' }}>
                    {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', display: 'inline-block', animation: `mxDot 1.4s infinite ${i*0.22}s` }} />)}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: T.textPrimary, whiteSpace: 'pre-wrap' }}>
                    {introText}{!introTyped && <span style={{ color: '#1D3E8B', fontWeight: 300, marginLeft: 1, animation: 'twCursor 0.6s step-end infinite' }}>|</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Concern Intelligence card */}
            {introTyped && showStarters && messages.length === 0 && (
              <div style={{ animation: 'mxMsgIn 0.4s ease 0.1s both' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <BotAvatar size={28} variant="navy" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ borderRadius: '4px 14px 14px 14px', border: '1.5px solid rgba(52,78,134,0.18)', background: '#fff', boxShadow: '0 2px 12px rgba(52,78,134,0.08)', padding: '12px 14px', overflow: 'visible' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(52,78,134,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 3C10.5 3 9 3.7 8 4.8C7 3.7 5.5 3 4 3C1.8 3 0 4.8 0 7C0 9.6 2.1 11.1 4 12.5C5.2 13.4 6 14.5 6 16H8C8 14.2 7 12.8 5.5 11.7C3.8 10.4 2 9.3 2 7C2 5.9 2.9 5 4 5C5.1 5 6 5.9 6 7H8V6C8.5 5.4 9.2 5 10 5C10.8 5 11.5 5.4 12 6V7H14C14 5.9 14.9 5 16 5C17.1 5 18 5.9 18 7C18 9.3 16.2 10.4 14.5 11.7C13 12.8 12 14.2 12 16H14C14 14.5 14.8 13.4 16 12.5C17.9 11.1 20 9.6 20 7C20 4.8 18.2 3 16 3C14.5 3 13 3.7 12 4.8C11 3.7 10.5 3 12 3Z" fill="#344E86" opacity="0.1"/><path d="M9 3C7 3 5 4.5 5 7C5 9 6.5 10.5 8 11.5C9 12.2 9 13 9 14H11C11 12.5 10.2 11.5 9 10.5C7.5 9.5 7 8.5 7 7C7 5.6 7.9 5 9 5C10 5 11 5.9 11 7H13C13 5.9 14 5 15 5C16.1 5 17 5.6 17 7C17 8.5 16.5 9.5 15 10.5C13.8 11.5 13 12.5 13 14H15C15 13 15 12.2 16 11.5C17.5 10.5 19 9 19 7C19 4.5 17 3 15 3C13.5 3 12 3.8 11 5C10 3.8 10.5 3 9 3Z" stroke="#344E86" strokeWidth="0.5" fill="none"/></svg>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#344E86' }}>Concern Intelligence</span>
                        </div>
                        <span style={{ fontSize: 9, background: 'rgba(78,205,196,0.12)', color: '#2a9d94', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>Free · Instant</span>
                      </div>
                      {/* Headline */}
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: '0 0 2px', lineHeight: 1.3 }}>What's your biggest concern right now?</p>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 10px', lineHeight: 1.5 }}>Describe any behaviour, habit, or struggle — for yourself, a student, or someone you support.</p>
                      {/* Input */}
                      <div ref={botConcernRef} style={{ position: 'relative', marginBottom: 10 }}>
                        <div style={{ display: 'flex', gap: 7 }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                              <circle cx="11" cy="11" r="8" stroke="#94a3b8" strokeWidth="2"/>
                              <path d="M21 21L16.65 16.65" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            {botConcernLoading && (
                              <div style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #344E86', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                            )}
                            <input
                              type="text"
                              value={botConcernSearch}
                              onChange={e => setBotConcernSearch(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && botConcernSearch.trim()) handleBotConcernSubmit();
                                if (e.key === 'Escape') setShowBotSuggestions(false);
                              }}
                              onFocus={() => { if (botConcernSuggestions.length > 0) setShowBotSuggestions(true); }}
                              placeholder="e.g. can't focus, procrastination, anxiety…"
                              style={{ width: '100%', height: 34, paddingLeft: 28, paddingRight: 10, borderRadius: 9, border: `1.5px solid ${botConcernSearch ? '#344E86' : '#E0E5EE'}`, fontSize: 11.5, color: '#1e293b', background: '#F7F9FC', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                            />
                          </div>
                          <button
                            onClick={() => handleBotConcernSubmit()}
                            style={{ padding: '0 12px', height: 34, borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #344E86, #2a3d6e)', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, boxShadow: '0 2px 8px rgba(52,78,134,0.3)', transition: 'opacity 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                          >
                            Analyse <ArrowRight size={11} />
                          </button>
                        </div>
                        {showBotSuggestions && botConcernSuggestions.length > 0 && (
                          <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', borderRadius: 10, border: '1px solid rgba(52,78,134,0.2)', background: '#fff', boxShadow: '0 8px 24px rgba(52,78,134,0.14)', overflow: 'hidden', zIndex: 100 }}>
                            {botConcernSuggestions.map((s, i) => (
                              <button
                                key={s.id}
                                onMouseDown={e => { e.preventDefault(); setBotConcernSearch(s.concern_area); handleBotConcernSubmit(s.concern_area); }}
                                style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', border: 'none', background: 'transparent', borderTop: i > 0 ? '1px solid #f0f3f8' : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,78,134,0.04)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                              >
                                <span style={{ fontSize: 11.5, color: '#1e293b' }}>{s.concern_area}</span>
                                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(52,78,134,0.08)', color: '#344E86', fontWeight: 600 }}>{s.category}</span>
                                  {s.has_assessment && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(78,205,196,0.12)', color: '#2a9d94', fontWeight: 600 }}>Ready</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Chips */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {[
                          { group: 'Personal', chips: [{ label: 'Procrastination', emoji: '⏰' }, { label: 'Low motivation', emoji: '🔋' }, { label: 'Anxiety & overthinking', emoji: '🌀' }] },
                          { group: 'Academic', chips: [{ label: "Can't focus", emoji: '🎯' }, { label: 'Exam anxiety', emoji: '😰' }, { label: 'Screen addiction', emoji: '📱' }] },
                          { group: 'Career', chips: [{ label: 'Career confusion', emoji: '🧭' }, { label: 'Burnout', emoji: '🪫' }] },
                        ].map(({ group, chips }) => (
                          <div key={group} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#94a3b8', width: 50, flexShrink: 0 }}>{group}</span>
                            {chips.map(({ label, emoji }) => (
                              <button
                                key={label}
                                onClick={() => handleBotConcernSubmit(label)}
                                style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 20, border: '1px solid #E0E5EE', background: '#fff', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#344E86'; e.currentTarget.style.background = 'rgba(52,78,134,0.05)'; e.currentTarget.style.color = '#344E86'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E0E5EE'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#475569'; }}
                              >
                                <span>{emoji}</span>{label}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                      {/* Social proof */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0f3f8' }}>
                        <div style={{ display: 'flex' }}>
                          {['#344E86','#4ECDC4','#f59e0b','#10b981'].map((c, i) => (
                            <div key={i} style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: c, border: '2px solid #fff', marginLeft: i > 0 ? -6 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 6, fontWeight: 700, color: '#fff' }}>{String.fromCharCode(65+i)}</span>
                            </div>
                          ))}
                        </div>
                        <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
                          <strong style={{ color: '#475569' }}>2,800+ students & families</strong> gained clarity this month
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: '9px', color: T.textMuted, marginTop: 4 }}>{fmtTime(new Date())}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Conversation starters */}
            {introTyped && showStarters && messages.length === 0 && (
              <div style={{ animation: 'mxMsgIn 0.4s ease 0.15s both', paddingLeft: 4, marginTop: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '4px 0 12px' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1 L8.2 5.2 L12.5 5.2 L9 8 L10.2 12.5 L7 9.8 L3.8 12.5 L5 8 L1.5 5.2 L5.8 5.2 Z" fill="#2EC4B6" /></svg>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1D3E8B', letterSpacing: '-0.2px' }}>How can I help you today?</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  {[
                    { title: 'Student',      sub: 'Exam prep & study help', text: "I'm a student preparing for exams",
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3 L2 8 L12 13 L22 8 L12 3 Z M6 10 V15 C6 16.5 9 18 12 18 C15 18 18 16.5 18 15 V10" stroke="#1D3E8B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                    { title: 'Parent',       sub: 'Worried about my child', text: "I'm a parent worried about my child",
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="#1D3E8B" strokeWidth="1.8"/><circle cx="17" cy="9" r="2.2" stroke="#1D3E8B" strokeWidth="1.8"/><path d="M3 20 C3 16 6 14 9 14 C12 14 15 16 15 20 M14 20 C14 17 16 15.5 17 15.5 C19 15.5 21 17 21 20" stroke="#1D3E8B" strokeWidth="1.8" strokeLinecap="round"/></svg> },
                    { title: 'Career',       sub: 'Find your direction',    text: 'I need career guidance',
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#1D3E8B" strokeWidth="1.8"/><circle cx="12" cy="12" r="4.5" stroke="#1D3E8B" strokeWidth="1.8"/><circle cx="12" cy="12" r="1.5" fill="#1D3E8B"/></svg> },
                    { title: 'Teacher',      sub: 'Classroom tools',        text: "I'm a teacher looking for classroom tools",
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 5 H21 V17 H13 L12 19 L11 17 H3 Z" stroke="#1D3E8B" strokeWidth="1.8" strokeLinejoin="round"/><path d="M7 9 H17 M7 13 H14" stroke="#1D3E8B" strokeWidth="1.8" strokeLinecap="round"/></svg> },
                    { title: 'HR & Hiring',  sub: 'Culture & fit',          text: "I'm in HR — help with hiring",
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 8 H20 V20 H4 Z M9 8 V5 H15 V8" stroke="#1D3E8B" strokeWidth="1.8" strokeLinejoin="round"/><path d="M4 13 H20" stroke="#1D3E8B" strokeWidth="1.8"/></svg> },
                    { title: 'How it works', sub: 'About MetryxOne',        text: 'How does MetryxOne work?',
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

                {/* Know your learning style CTA */}
                <button onClick={startLearningStyleQuiz}
                  style={{ marginTop: 10, width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid rgba(139,92,246,0.3)', background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(29,62,139,0.06))', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.18s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.6)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(29,62,139,0.08))'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(29,62,139,0.06))'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20, lineHeight: 1 }}>📚</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#5b21b6', letterSpacing: '-0.1px' }}>Know your learning style</p>
                      <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', marginTop: 1 }}>10 questions · 2 min · free · ⭐ 4.8 · 12,400+ taken</p>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8B5CF6', display: 'flex', alignItems: 'center', gap: 3 }}>Start <ChevronRight size={12} /></span>
                </button>
              </div>
            )}

            {/* Chat messages */}
            {messages.map(message => (
              <div key={message.id} style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start', animation: 'mxMsgIn 0.25s ease' }}>
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
                    ) : message.quizCard ? (
                      <div style={{ animation: 'mxMsgIn 0.3s ease' }}>
                        {/* ── PERSONA SELECT ── */}
                        {message.quizCard.type === 'persona-select' && (
                          <div style={{ background: '#fff', border: '1.5px solid rgba(139,92,246,0.25)', borderRadius: '4px 16px 16px 16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(139,92,246,0.12)' }}>
                            <div style={{ background: 'linear-gradient(135deg, #1D3E8B, #5b21b6)', padding: '14px 16px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 18 }}>📚</span>
                                <div>
                                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px' }}>Know your <span style={{ color: '#7dd3fc' }}>learning style</span></p>
                                  <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>10 questions · 2 min · free · ⭐ 4.8 · 12,400+ taken</p>
                                </div>
                              </div>
                            </div>
                            <div style={{ padding: '12px 14px' }}>
                              <p style={{ margin: '0 0 10px', fontSize: 10.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>I am a…</p>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                                {QUIZ_PERSONAS.map(p => (
                                  <button key={p.id} onClick={() => selectQuizPersona(p.id)}
                                    style={{ padding: '9px 10px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fafbfe', cursor: 'pointer', textAlign: 'left', transition: 'all 0.16s' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#8B5CF6'; e.currentTarget.style.background = 'rgba(139,92,246,0.05)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fafbfe'; e.currentTarget.style.transform = 'none'; }}>
                                    <span style={{ fontSize: 14 }}>{p.emoji}</span>
                                    <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>{p.label}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: 9.5, color: '#94a3b8', lineHeight: 1.2 }}>{p.sub}</p>
                                  </button>
                                ))}
                              </div>
                              <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: '#64748b' }}>Your report includes:</span>
                                {[{ icon: '📊', label: 'Score' }, { icon: '⚡', label: 'Strengths' }, { icon: '🗺️', label: 'Action Plan' }].map(r => (
                                  <span key={r.label} style={{ fontSize: 10, color: '#1D3E8B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>{r.icon} {r.label}</span>
                                ))}
                              </div>
                              <p style={{ margin: '8px 0 0', fontSize: 9.5, color: '#94a3b8', textAlign: 'center' }}>🔒 Private · never shared · used only to generate your report</p>
                            </div>
                          </div>
                        )}

                        {/* ── QUESTION ── */}
                        {message.quizCard.type === 'question' && (() => {
                          const step = message.quizCard.step ?? 0;
                          const q = QUIZ_QUESTIONS[step];
                          const isLast = step === QUIZ_QUESTIONS.length - 1;
                          const msgIdx = messages.findIndex(m => m.id === message.id);
                          const answered = msgIdx >= 0 && messages.slice(msgIdx + 1).some(m => m.role === 'user');
                          return (
                            <div style={{ background: '#fff', border: '1.5px solid rgba(29,62,139,0.18)', borderRadius: '4px 16px 16px 16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(29,62,139,0.08)' }}>
                              <div style={{ padding: '11px 14px 8px', borderBottom: '1px solid #f0f4f8' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Question {step + 1} of {QUIZ_QUESTIONS.length}</span>
                                  <div style={{ display: 'flex', gap: 2 }}>
                                    {QUIZ_QUESTIONS.map((_, i) => (
                                      <span key={i} style={{ width: 14, height: 3, borderRadius: 3, background: i <= step ? '#1D3E8B' : '#e2e8f0', transition: 'background 0.3s' }} />
                                    ))}
                                  </div>
                                </div>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1e293b', lineHeight: 1.45, letterSpacing: '-0.1px' }}>{q.q}</p>
                              </div>
                              <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {q.options.map((opt, oi) => (
                                  <button key={oi} disabled={answered}
                                    onClick={() => answerQuizQuestion(step, oi)}
                                    style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fafbfe', cursor: answered ? 'default' : 'pointer', textAlign: 'left', fontSize: 12, color: '#1e293b', fontWeight: 500, lineHeight: 1.35, transition: 'all 0.15s', opacity: answered ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
                                    onMouseEnter={e => { if (!answered) { e.currentTarget.style.borderColor = '#1D3E8B'; e.currentTarget.style.background = 'rgba(29,62,139,0.05)'; } }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fafbfe'; }}>
                                    <span style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9.5, fontWeight: 700, color: '#64748b' }}>{String.fromCharCode(65 + oi)}</span>
                                    {opt}
                                  </button>
                                ))}
                              </div>
                              {isLast && <p style={{ margin: '0 14px 10px', fontSize: 9.5, color: '#94a3b8', textAlign: 'center' }}>Last question — your result is almost ready!</p>}
                            </div>
                          );
                        })()}

                        {/* ── RESULT ── */}
                        {message.quizCard.type === 'result' && (() => {
                          const qp = computeQuizProfile(quizRef.current.answers);
                          const personaLabel = QUIZ_PERSONAS.find(p => p.id === quizRef.current.persona)?.label ?? 'You';
                          return (
                            <div style={{ background: '#fff', border: '1.5px solid rgba(139,92,246,0.2)', borderRadius: '4px 16px 16px 16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(139,92,246,0.12)' }}>
                              <div style={{ background: `linear-gradient(135deg, ${qp.color}, ${qp.color}cc)`, padding: '16px 16px 14px' }}>
                                <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Learning Style</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                  <span style={{ fontSize: 26 }}>{qp.emoji}</span>
                                  <p style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.2 }}>{qp.name}</p>
                                </div>
                                <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{qp.description}</p>
                              </div>
                              <div style={{ padding: '13px 14px' }}>
                                <p style={{ margin: '0 0 8px', fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚡ Key Strengths</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 13 }}>
                                  {qp.strengths.map((s, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: `${qp.color}0d`, border: `1px solid ${qp.color}22` }}>
                                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: qp.color, flexShrink: 0 }} />
                                      <span style={{ fontSize: 11.5, color: '#1e293b', fontWeight: 500 }}>{s}</span>
                                    </div>
                                  ))}
                                </div>
                                <p style={{ margin: '0 0 8px', fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🗺️ Your Action Plan</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 13 }}>
                                  {qp.actions.map((a, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                      <span style={{ width: 17, height: 17, borderRadius: '50%', background: qp.color, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                                      <span style={{ fontSize: 11.5, color: '#374151', lineHeight: 1.4 }}>{a}</span>
                                    </div>
                                  ))}
                                </div>
                                <button onClick={() => sendMessage(`I am a ${personaLabel} and my learning style is ${qp.name}. Can you tell me more about how MetryxOne can help me?`)}
                                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${qp.color}, ${qp.color}cc)`, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.1px', transition: 'opacity 0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                                  Get personalised advice for {personaLabel}s →
                                </button>
                                <p style={{ margin: '8px 0 0', fontSize: 9.5, color: '#94a3b8', textAlign: 'center' }}>🔒 Private · never shared · used only to generate your report</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div>
                        <div style={{ background: T.botBubble, border: `1px solid ${T.botBorder}`, borderRadius: '4px 14px 14px 14px', padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                          {message.isLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0' }}>
                              {[0,1,2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#1D3E8B', display: 'inline-block', animation: `mxDot 1.4s infinite ${i*0.22}s` }} />)}
                            </div>
                          ) : (
                            <>
                              <MsgText text={typewriter?.id === message.id ? typewriter.shown : message.content} />
                              {typewriter?.id === message.id && !typewriter.done && (
                                <span style={{ display: 'inline-block', width: 2, height: '1em', background: '#1D3E8B', marginLeft: 1, verticalAlign: 'text-bottom', animation: 'twCursor 0.6s step-end infinite' }} />
                              )}
                            </>
                          )}
                        </div>

                        {message.sensitive && message.videos && message.videos.length > 0 && !message.isLoading && (typewriter?.id !== message.id || typewriter.done) && !dismissedBreathing.has(message.id) && (
                          suppressBreathing === 'none' ? (
                            <div className="mx-breathing-room" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 2px 0', flexWrap: 'wrap' }}>
                              <p style={{ margin: 0, fontSize: '12px', fontStyle: 'italic', color: '#0f8a7e', lineHeight: 1.4, opacity: 0.9, flex: '1 1 auto', minWidth: 0 }}>
                                Would you like a moment before we continue?
                              </p>
                              <button onClick={startPause} aria-label="Take a 30-second pause" data-testid={`btn-take-pause-${message.id}`}
                                style={{ padding: '4px 10px', borderRadius: 14, border: '1px solid rgba(46,196,182,0.45)', background: 'rgba(46,196,182,0.10)', color: '#0f8a7e', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(46,196,182,0.20)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(46,196,182,0.10)'; }}>
                                Take a moment
                              </button>
                              <button onClick={() => setPausePreference('session')} aria-label="Don't ask again this session" data-testid={`btn-suppress-breathing-session-${message.id}`}
                                style={{ padding: '4px 8px', borderRadius: 14, border: 'none', background: 'transparent', color: '#0f8a7e', fontSize: '10.5px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline', textUnderlineOffset: 2, opacity: 0.85 }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '0.85'; }}>
                                Don't ask this session
                              </button>
                              <button onClick={() => setPausePreference('always')} aria-label="Don't ask again — always hide" data-testid={`btn-suppress-breathing-always-${message.id}`}
                                style={{ padding: '4px 6px', border: 'none', background: 'transparent', color: '#5b8c87', fontSize: '10px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', opacity: 0.75 }}
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
                            <div className="mx-breathing-room" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 2px 0', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '10.5px', fontStyle: 'italic', color: '#94a3b8' }}>
                                Pause prompts hidden{suppressBreathing === 'always' ? ' (always)' : ' for this session'} —
                              </span>
                              <button onClick={reEnableBreathing} data-testid={`btn-reenable-breathing-${message.id}`} aria-label="Re-enable pause prompts"
                                style={{ padding: 0, border: 'none', background: 'transparent', color: '#0f8a7e', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
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
                                style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${T.chipBorder}`, background: T.chipBg, color: T.chipText, fontSize: '11px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%' }}
                                onMouseEnter={e => { e.currentTarget.style.background = T.chipHover; }}
                                onMouseLeave={e => { e.currentTarget.style.background = T.chipBg; }}
                                data-testid={`action-btn-${message.id}-${ai}`}>
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
                    <p style={{ fontSize: '9px', color: T.textMuted, marginTop: 4, textAlign: message.role === 'user' ? 'right' : 'left' }}>{fmtTime(message.timestamp)}</p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{ padding: '12px 16px 10px', background: T.inputAreaBg, borderTop: `1px solid ${T.divider}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 26, padding: '0 5px 0 16px', background: T.inputBg, border: `1.5px solid ${T.divider}`, transition: 'border-color 0.2s, box-shadow 0.2s' }} id="mx-chat-input-wrap">
              <input ref={inputRef} value={inputValue} onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type your question or concern..."
                disabled={isTyping}
                style={{ flex: 1, background: 'transparent', border: 'none', padding: '11px 0', outline: 'none', fontSize: '13px', color: T.textPrimary }}
                data-testid="input-chat-message"
                onFocus={() => { const el = document.getElementById('mx-chat-input-wrap'); if (el) { el.style.borderColor = '#2EC4B6'; el.style.boxShadow = '0 0 0 3px rgba(46,196,182,0.12)'; } }}
                onBlur={() => { const el = document.getElementById('mx-chat-input-wrap'); if (el) { el.style.borderColor = T.divider; el.style.boxShadow = 'none'; } }}
              />
              <button onClick={() => sendMessage()} disabled={!inputValue.trim() || isTyping}
                style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: inputValue.trim() ? '#2EC4B6' : '#E0E5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inputValue.trim() ? 'pointer' : 'default', flexShrink: 0, transition: 'all 0.2s', boxShadow: inputValue.trim() ? '0 2px 8px rgba(46,196,182,0.35)' : 'none' }}
                data-testid="btn-send-message">
                {isTyping ? <Loader2 size={14} style={{ color: '#1D3E8B', animation: 'spin 1s linear infinite' }} /> : <Send size={13} style={{ color: inputValue.trim() ? '#fff' : '#94a3b8' }} />}
              </button>
            </div>
            <p style={{ textAlign: 'center', margin: '7px 0 0', fontSize: '9px', color: '#b0b8c9', fontWeight: 500, letterSpacing: '0.3px' }}>
              🔒 Pragati · In-house · Private · No data shared externally
            </p>
          </div>
        </>
      )}
    </div>
  );

  /* ── Render ── */
  return (
    <>
      {activeVideo && <VideoPopup title={activeVideo.title} embedUrl={activeVideo.embedUrl} onClose={() => setActiveVideo(null)} />}
      {pauseRemaining !== null && (
        <PauseOverlay prefix="mx" onEnd={endPause} />
      )}
      {isCentered && <div className="fixed inset-0 z-40" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)' }} onClick={minimizeCentered} />}
      <div className={isCentered ? 'fixed z-50' : 'fixed right-0 top-1/2 z-50'}
        style={isCentered
          ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 780, transition: 'all 0.3s ease' }
          : { transform: 'translateY(-50%)', width: isMinimized ? 300 : 400, transition: 'width 0.3s ease' }
        }>
        <div style={{
          display: 'flex', overflow: 'hidden',
          height: isCentered ? 560 : isMinimized ? 56 : 560,
          transition: 'height 0.3s ease',
          border: `1px solid ${T.border}`,
          borderRight: isCentered ? `1px solid ${T.border}` : 'none',
          borderRadius: isCentered ? 16 : '16px 0 0 16px',
          boxShadow: isCentered
            ? '0 24px 80px rgba(15,23,42,0.30), 0 8px 32px rgba(15,23,42,0.20)'
            : '-12px 0 48px rgba(29,62,139,0.15), -4px 0 16px rgba(29,62,139,0.08)',
        }}>
          {isCentered && <PromoPanel />}
          <ChatPanel />
        </div>

        <style>{`
          @keyframes mxDot { 0%,80%,100%{transform:translateY(0);opacity:0.35} 40%{transform:translateY(-6px);opacity:1} }
          @keyframes mxBotBob { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-2.5px) rotate(1deg)} }
          @keyframes mxBotTalk { 0%,100%{transform:translateY(0) scale(1) rotate(-2deg)} 25%{transform:translateY(-1.5px) scale(1.04) rotate(2deg)} 75%{transform:translateY(0.5px) scale(0.98) rotate(-1deg)} }
          @keyframes mxBotPulse { 0%,100%{opacity:0.55;transform:scale(0.92)} 50%{opacity:0.95;transform:scale(1.08)} }
          @keyframes mxMsgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
          @keyframes twCursor { 0%,100%{opacity:1} 50%{opacity:0} }
          @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
          @keyframes mxSupportivePulse {
            0%,100% { box-shadow: 0 0 0 4px rgba(46,196,182,0.18), 0 4px 14px rgba(46,196,182,0.35); }
            50%     { box-shadow: 0 0 0 8px rgba(46,196,182,0.10), 0 6px 18px rgba(46,196,182,0.50); }
          }
          .mx-supportive-play { animation: mxSupportivePulse 2.4s ease-in-out infinite; }
          @keyframes mxBreathingFade { from{opacity:0;transform:translateY(2px)} to{opacity:1;transform:translateY(0)} }
          .mx-breathing-room { animation: mxBreathingFade 0.6s ease-out both; }
          @media (prefers-reduced-motion: reduce) {
            .mx-supportive-play { animation: none !important; }
            .mx-breathing-room { animation: none !important; transform: none !important; }
          }
        `}</style>
      </div>
    </>
  );
}
