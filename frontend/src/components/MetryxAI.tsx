import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Send, Loader2, ChevronDown,
  Brain, FileText, Settings, CreditCard,
  Sparkles, Users, GraduationCap, Building2, HelpCircle, ShieldCheck
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from '../App';

interface MetryxAIProps {
  onNavigate: (screen: Screen) => void;
  currentScreen: string;
  isLoggedIn?: boolean;
}

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  options?: QuickOption[];
  timestamp: Date;
}

interface QuickOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
  description?: string;
}

type BotState = 'loading' | 'idle' | 'listening' | 'explaining' | 'paused';
type UserRole = 'parent' | 'student' | 'institution' | null;

const GREETING_MESSAGE = `Hey there 👋`;

const FOLLOW_UP_MESSAGE = `I'm here to help. What brings you here today?`;

const ROLE_OPTIONS: QuickOption[] = [
  { 
    label: "I'm a Parent", 
    value: "role-parent", 
    icon: <Users size={14} />,
    description: "Understanding my child"
  },
  { 
    label: "I'm a Student", 
    value: "role-student", 
    icon: <GraduationCap size={14} />,
    description: "Check my readiness"
  },
  { 
    label: "Institution", 
    value: "role-institution", 
    icon: <Building2 size={14} />,
    description: "School or college"
  },
  { 
    label: "Just Exploring", 
    value: "understand-platform", 
    icon: <Sparkles size={14} />,
    description: "Learn about us"
  },
  { 
    label: "Need Help", 
    value: "help-start", 
    icon: <HelpCircle size={14} />,
    description: "Guide me"
  },
];

const FEATURE_LINKS: QuickOption[] = [
  { label: "LBI", value: "lbi", icon: <Brain size={14} /> },
  { label: "ExamReadiness Index™", value: "exam-ready", icon: <Sparkles size={14} /> },
  { label: "Reports", value: "reports", icon: <FileText size={14} /> },
  { label: "Plans", value: "compare", icon: <CreditCard size={14} /> },
  { label: "Settings", value: "settings", icon: <Settings size={14} /> },
];

function MetryxAIIcon({ isHovered, size = 28 }: { isHovered: boolean; size?: number }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <motion.div
        animate={{
          scale: isHovered ? 1.1 : 1,
          rotate: isHovered ? [0, -8, 8, -4, 0] : 0,
        }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <motion.path
            d="M16 3L18.5 10.5H26L20 15.5L22.5 23L16 18.5L9.5 23L12 15.5L6 10.5H13.5L16 3Z"
            fill="currentColor"
            fillOpacity="0.2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            animate={{ fillOpacity: isHovered ? 0.35 : 0.2 }}
            transition={{ duration: 0.3 }}
          />
          <motion.circle
            cx="16"
            cy="14"
            r="3"
            fill="currentColor"
            animate={{ r: isHovered ? 3.5 : 3 }}
            transition={{ duration: 0.3 }}
          />
          <motion.circle cx="9" cy="8" r="1.5" fill="currentColor" fillOpacity="0.5"
            animate={{ scale: isHovered ? [1, 1.4, 1] : 1 }}
            transition={{ duration: 0.6, repeat: isHovered ? Infinity : 0, repeatDelay: 0.8 }}
          />
          <motion.circle cx="24" cy="6" r="1" fill="currentColor" fillOpacity="0.4"
            animate={{ scale: isHovered ? [1, 1.5, 1] : 1 }}
            transition={{ duration: 0.5, repeat: isHovered ? Infinity : 0, repeatDelay: 1 }}
          />
          <motion.circle cx="26" cy="18" r="1.2" fill="currentColor" fillOpacity="0.3"
            animate={{ scale: isHovered ? [1, 1.3, 1] : 1 }}
            transition={{ duration: 0.7, repeat: isHovered ? Infinity : 0, repeatDelay: 0.6 }}
          />
        </svg>
      </motion.div>
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: isHovered
            ? '0 0 24px rgba(78, 205, 196, 0.45)'
            : '0 0 0px rgba(78, 205, 196, 0)',
        }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}

function getContextualGreeting(screen: string): string {
  if (screen.includes('login') || screen.includes('registration')) {
    return "Need help getting started?";
  }
  if (screen.includes('dashboard')) {
    return "I can help you understand your insights.";
  }
  if (screen.includes('exam-ready')) {
    return "Let me explain ExamReadiness Index™.";
  }
  if (screen.includes('assessment') || screen.includes('lbi')) {
    return "Take your time. I'm here if needed.";
  }
  return "Need clarity? I'm here.";
}

function generateResponse(userInput: string, _context: string, userRole: UserRole): { content: string; options?: QuickOption[] } {
  const input = userInput.toLowerCase();
  
  if (input.includes('role-parent')) {
    return {
      content: `Thanks for sharing. I understand the concern you have for your child.

We help you see patterns in how they learn — not labels or scores. Just clarity.

What's on your mind?`,
      options: [
        { label: "Effort vs results gap", value: "inconsistent-results" },
        { label: "Exam stress", value: "anxiety-focus" },
        { label: "Readiness check", value: "exam-readiness" },
        { label: "Go to dashboard", value: "navigate-dashboard" },
      ]
    };
  }
  
  if (input.includes('role-student')) {
    return {
      content: `Hey! I'm here to help you understand yourself better — no tests, no pressure.

Just clarity on how you approach exams.

What would help you most?`,
      options: [
        { label: "Check my readiness", value: "exam-readiness" },
        { label: "Focus struggles", value: "focus-issues" },
        { label: "Just browsing", value: "explore-student" },
      ]
    };
  }
  
  if (input.includes('role-institution')) {
    return {
      content: `Welcome! We offer group-level insights for schools and colleges.

No individual ranking — just cohort patterns that help you support students better.

How can I help?`,
      options: [
        { label: "Group analytics", value: "institutional-analytics" },
        { label: "Privacy & compliance", value: "consent-explain" },
        { label: "Book a demo", value: "schedule-demo" },
      ]
    };
  }
  
  if (input.includes('understand-platform') || input.includes('help-start')) {
    return {
      content: `Let me show you around! Here's what MetryxOne can do:

1️⃣ Understand how your child learns
2️⃣ Check exam readiness  
3️⃣ Get clear, actionable insights

Want a quick tour?`,
      options: [
        { label: "Yes, show me", value: "tutorial-start" },
        { label: "Skip tour", value: "continue" },
      ]
    };
  }
  
  if (input.includes('tutorial-start')) {
    return {
      content: `Great! Let's start with **Learning Behavior Index (LBI)** — our learning pattern tool.

It helps you understand *how* your child thinks and processes information. No labels, just clarity.

Tap below to learn more, or skip ahead.`,
      options: [
        { label: "Tell me more", value: "tutorial-lbi" },
        { label: "Next feature →", value: "tutorial-examready" },
        { label: "End tour", value: "continue" },
      ]
    };
  }
  
  if (input.includes('tutorial-lbi')) {
    return {
      content: `**Learning Behavior Index (LBI)** measures:
• Focus patterns
• How information is processed
• Learning habits

It takes about 20 mins. For minors, parent consent is needed.

Ready to move on?`,
      options: [
        { label: "Next: ExamReadiness Index™", value: "tutorial-examready" },
        { label: "Start LBI", value: "navigate-lbi" },
        { label: "End tour", value: "continue" },
      ]
    };
  }
  
  if (input.includes('tutorial-examready')) {
    return {
      content: `**ExamReadiness Index™** checks behavioral exam readiness:
• Stress management
• Focus under pressure
• Confidence levels

It's not about knowledge — it's about how you *approach* exams.`,
      options: [
        { label: "Next: Reports", value: "tutorial-reports" },
        { label: "Try ExamReadiness Index™", value: "navigate-exam-ready" },
        { label: "End tour", value: "continue" },
      ]
    };
  }
  
  if (input.includes('tutorial-reports')) {
    return {
      content: `Your **reports** show patterns and suggestions — not scores or rankings.

They're designed to help you take the right next steps.

That's the tour! What would you like to do now?`,
      options: [
        { label: "Go to dashboard", value: "navigate-dashboard" },
        { label: "Start an assessment", value: "navigate-exam-ready" },
        { label: "Ask a question", value: "continue" },
      ]
    };
  }
  
  if (input.includes('lbi-explain') || input.includes('lbi')) {
    return {
      content: `LBI looks at thinking patterns — focus, processing, habits.

It doesn't diagnose or label. For minors, parent consent is required.

Want to learn more?`,
      options: [
        { label: "Watch explainer", value: "video-lbi" },
        { label: "Start assessment", value: "navigate-lbi" },
        { label: "More questions", value: "more-questions" },
      ]
    };
  }
  
  if (input.includes('exam-ready-explain') || input.includes('exam-readiness') || input.includes('exam ready')) {
    return {
      content: `ExamReadiness Index™ checks behavioral exam readiness — stress handling, focus, confidence.

Takes about 30-40 mins. You can pause anytime.

Ready to try?`,
      options: [
        { label: "Start now", value: "navigate-exam-ready" },
        { label: "Watch video first", value: "video-exam-ready" },
        { label: "Maybe later", value: "pause" },
      ]
    };
  }
  
  if (input.includes('diagnos') || input.includes('disorder') || input.includes('adhd') || input.includes('dyslexia')) {
    return {
      content: `I hear you. I can't diagnose — that's not my role.

But I can help you see patterns that might be worth discussing with a professional.

Would that help?`,
      options: [
        { label: "Yes, show me patterns", value: "explain-patterns" },
        { label: "Different question", value: "other-question" },
      ]
    };
  }
  
  if (input.includes('predict') || input.includes('score') || input.includes('marks') || input.includes('rank')) {
    return {
      content: `I don't predict marks or ranks.

I focus on *how* exams are approached — the patterns behind performance.

Want to explore that?`,
      options: [
        { label: "Exam readiness", value: "exam-readiness" },
        { label: "LBI", value: "lbi-explain" },
      ]
    };
  }
  
  if (input.includes('inconsistent') || input.includes('working hard') || input.includes('effort')) {
    return {
      content: `That's a common concern. Effort not showing in results usually has a reason.

Could be focus, processing, or stress. Not a flaw — just a pattern to understand.

Want to explore?`,
      options: [
        { label: "Start assessment", value: "navigate-exam-ready" },
        { label: "Learn about patterns", value: "explain-patterns" },
        { label: "Pause for now", value: "pause" },
      ]
    };
  }
  
  if (input.includes('anxiety') || input.includes('stress') || input.includes('focus-issues')) {
    return {
      content: `That sounds tough. Exam stress and focus issues are really common.

They're not flaws — they're signals we can understand together.

One step at a time?`,
      options: [
        { label: "Yes, slowly", value: "slow-approach" },
        { label: "Start assessment", value: "navigate-exam-ready" },
        { label: "Need professional help", value: "professional-redirect" },
      ]
    };
  }
  
  if (input.includes('consent') || input.includes('privacy') || input.includes('dpdp') || input.includes('data')) {
    return {
      content: `Your privacy matters. We're DPDP compliant — data is secure, never sold, and deletable anytime.

Minors need parental consent first.`,
      options: [
        { label: "Privacy policy", value: "privacy-policy" },
        { label: "How consent works", value: "consent-process" },
        { label: "Continue", value: "continue" },
      ]
    };
  }
  
  if (input.includes('professional') || input.includes('counselor') || input.includes('therapist')) {
    return {
      content: `That makes sense. Some things need professional support, and I respect that.

We provide patterns, but for mental health or formal assessments, a qualified professional is best.

Take care of yourself.`,
      options: [
        { label: "Continue here", value: "continue" },
        { label: "Go to dashboard", value: "navigate-dashboard" },
      ]
    };
  }
  
  if (input.includes('pause') || input.includes('later') || input.includes('close')) {
    return {
      content: `No rush. I'll be here when you're ready.

Your progress is saved.`,
      options: [
        { label: "Close chat", value: "close" },
        { label: "One more thing", value: "continue" },
      ]
    };
  }
  
  return {
    content: `I'm here whenever you need clarity — about exams, learning patterns, or just getting started.

No pressure. Take your time.`,
    options: ROLE_OPTIONS.slice(0, 3)
  };
}

export function MetryxAI({ onNavigate, currentScreen, isLoggedIn }: MetryxAIProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [botState, setBotState] = useState<BotState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [showPulse, setShowPulse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const [showProactiveBubble, setShowProactiveBubble] = useState(false);
  const [proactiveMessage, setProactiveMessage] = useState("");
  const [proactiveIndex, setProactiveIndex] = useState(0);
  const proactiveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const PROACTIVE_MESSAGES = [
    "Need any help?",
    "I'm here if you have questions",
    "Curious about something?",
    "Take your time exploring",
    "Ready when you are",
    "Got a question? Ask away",
    "I can help you get started",
  ];

  useEffect(() => {
    if (!isOpen && !isMinimized) {
      const showBubble = () => {
        const nextIndex = (proactiveIndex + 1) % PROACTIVE_MESSAGES.length;
        setProactiveIndex(nextIndex);
        setProactiveMessage(PROACTIVE_MESSAGES[nextIndex]);
        setShowProactiveBubble(true);
        
        setTimeout(() => {
          setShowProactiveBubble(false);
        }, 4000);
      };

      const initialDelay = setTimeout(() => {
        setProactiveMessage(PROACTIVE_MESSAGES[0]);
        setShowProactiveBubble(true);
        setTimeout(() => setShowProactiveBubble(false), 4000);
      }, 3000);

      proactiveTimerRef.current = setInterval(showBubble, 8000);
      
      return () => {
        clearTimeout(initialDelay);
        if (proactiveTimerRef.current) {
          clearInterval(proactiveTimerRef.current);
        }
      };
    } else {
      setShowProactiveBubble(false);
      if (proactiveTimerRef.current) {
        clearInterval(proactiveTimerRef.current);
      }
    }
  }, [isOpen, isMinimized, proactiveIndex]);
  
  useEffect(() => {
    if (isOpen && messages.length === 0 && !hasAutoOpened) {
      initializeChat();
    }
  }, [isOpen, messages.length, hasAutoOpened]);

  useEffect(() => {
    if (!isOpen || isMinimized) {
      pulseTimerRef.current = setInterval(() => {
        setShowPulse(true);
        setTimeout(() => setShowPulse(false), 1000);
      }, 7000);
    }
    return () => {
      if (pulseTimerRef.current) {
        clearInterval(pulseTimerRef.current);
      }
    };
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      resetInactivityTimer();
    }
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isOpen, isMinimized, messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isOpen && !isMinimized) {
          setIsMinimized(true);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMinimized]);

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      if (isOpen && !isMinimized) {
        setIsMinimized(true);
      }
    }, 45000);
  };

  const initializeChat = () => {
    setBotState('loading');
    setTimeout(() => {
      const greeting: Message = {
        id: '1',
        role: 'assistant',
        content: GREETING_MESSAGE,
        timestamp: new Date(),
      };
      setMessages([greeting]);
      setBotState('idle');
      
      setTimeout(() => {
        const rolePrompt: Message = {
          id: '2',
          role: 'assistant',
          content: FOLLOW_UP_MESSAGE,
          options: ROLE_OPTIONS,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, rolePrompt]);
      }, 1000);
    }, 600);
  };

  const handleOptionClick = (option: QuickOption) => {
    resetInactivityTimer();
    
    if (option.value === 'close') {
      setIsMinimized(true);
      return;
    }
    
    if (option.value.startsWith('navigate-')) {
      const screen = option.value.replace('navigate-', '');
      const screenMap: Record<string, Screen> = {
        'exam-ready': 'exam-ready',
        'compare': 'exam-ready-compare',
        'lbi': 'parent-lbi',
        'dashboard': 'unified-parent-dashboard',
        'reports': 'unified-parent-dashboard',
        'settings': 'theme-settings',
      };
      if (screenMap[screen]) {
        onNavigate(screenMap[screen]);
        setIsMinimized(true);
      }
      return;
    }
    
    if (option.value.startsWith('role-')) {
      const role = option.value.replace('role-', '') as UserRole;
      setUserRole(role);
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: option.label,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    
    setBotState('explaining');
    setTimeout(() => {
      const response = generateResponse(option.value, currentScreen, userRole);
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        options: response.options,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);
      setBotState('idle');
    }, 1200);
  };

  const handleSendMessage = () => {
    if (!input.trim() || botState === 'explaining') return;
    
    resetInactivityTimer();
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    setBotState('listening');
    setTimeout(() => {
      setBotState('explaining');
      const response = generateResponse(input, currentScreen, userRole);
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        options: response.options,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);
      setBotState('idle');
    }, 1500);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    if (messages.length === 0) {
      initializeChat();
    }
    resetInactivityTimer();
  };

  const renderMessage = (msg: Message) => {
    const isBot = msg.role === 'assistant';
    
    return (
      <motion.div
        key={msg.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4`}
      >
        <div className={`max-w-[88%]`}>
          <div
            className={`px-3 py-2 rounded-lg ${
              isBot
                ? 'rounded-tl-sm'
                : 'rounded-tr-sm'
            }`}
            style={isBot ? { 
              backgroundColor: 'var(--bg-secondary)', 
              color: 'var(--text-primary)',
              fontSize: '12px',
              lineHeight: '1.6'
            } : {
              backgroundColor: 'var(--metryx-blue)',
              color: '#FFFFFF',
              fontSize: '12px',
              lineHeight: '1.6'
            }}
          >
            {msg.content.split('\n').map((line, i) => (
              <p key={i} className={i > 0 ? 'mt-1' : ''}>
                {line.split('**').map((part, j) => 
                  j % 2 === 1 ? <strong key={j} style={{ fontWeight: 600 }}>{part}</strong> : part
                )}
              </p>
            ))}
          </div>
          
          {msg.options && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {msg.options.map((option, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => handleOptionClick(option)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.2 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="text-left px-3 py-2.5 rounded-lg border transition-all group"
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderColor: 'var(--border-subtle)',
                  }}
                  data-testid={`option-${option.value}`}
                >
                  <div className="flex items-center gap-2">
                    {option.icon && (
                      <div 
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ 
                          backgroundColor: 'var(--metryx-blue)',
                          color: '#FFFFFF'
                        }}
                      >
                        {option.icon}
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="font-medium text-xs block truncate transition-colors group-hover:text-[var(--metryx-blue)]" style={{ color: 'var(--text-primary)' }}>
                        {option.label}
                      </span>
                      {option.description && (
                        <p className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {option.description}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const getBotStateIndicator = () => {
    switch (botState) {
      case 'loading':
        return "Getting things ready…";
      case 'listening':
        return "I'm listening…";
      case 'explaining':
        return "Thinking…";
      case 'paused':
        return "Let's take this one step at a time.";
      default:
        return getContextualGreeting(currentScreen);
    }
  };

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {(!isOpen || isMinimized) && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <motion.button
              onClick={handleOpen}
              className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-white relative"
              style={{ 
                backgroundColor: 'var(--metryx-blue)',
                color: '#FFFFFF',
                boxShadow: '0 4px 16px rgba(31, 60, 136, 0.3)'
              }}
              animate={{
                y: isHovered ? -3 : 0,
                scale: 1,
              }}
              transition={{
                y: { duration: 0.2, ease: 'easeOut' },
                scale: { duration: 0.2, ease: 'easeOut' }
              }}
              data-testid="metryx-ai-trigger"
            >
              <MetryxAIIcon isHovered={isHovered} size={28} />
            </motion.button>
            
            <AnimatePresence>
              {showProactiveBubble && !isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-[68px] right-0"
                  data-testid="proactive-bubble"
                >
                  <div 
                    className="relative px-3 py-2 rounded-lg shadow-md cursor-pointer"
                    onClick={handleOpen}
                    style={{ 
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {proactiveMessage}
                    </span>
                    <div 
                      className="absolute -bottom-1 right-4 w-2 h-2 rotate-45"
                      style={{ backgroundColor: 'var(--bg-primary)', borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}
                    />
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowProactiveBubble(false); }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                  >
                    <X size={10} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </motion.div>
              )}
              {(isHovered || isMinimized) && !showProactiveBubble && (
                <motion.div
                  initial={{ opacity: 0, y: 8, x: 8 }}
                  animate={{ opacity: 1, y: 0, x: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute -top-10 right-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs shadow-md"
                  style={{ 
                    backgroundColor: 'var(--bg-primary)', 
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  Need clarity? I'm here.
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Card 
              className="w-[380px] md:w-[420px] h-[580px] flex flex-col shadow-2xl overflow-hidden rounded-2xl"
              style={{ 
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              {/* Header */}
              <div 
                className="p-4 flex items-center justify-between"
                style={{ 
                  backgroundColor: 'var(--metryx-blue)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: 'var(--accent-cyan)' }}
                  >
                    <MetryxAIIcon isHovered={false} size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-white text-base">MetryxAI</p>
                    <p className="text-xs text-white/80">{getBotStateIndicator()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Minimize" onClick={() => setIsMinimized(true)}
                    className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 rounded-lg"
                    data-testid="metryx-ai-minimize"
                  >
                    <ChevronDown size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close"
                    onClick={() => setIsOpen(false)}
                    className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 rounded-lg"
                    data-testid="metryx-ai-close"
                  >
                    <X size={18} />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div 
                className="flex-1 overflow-y-auto p-4"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                {botState === 'loading' && messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                      <Loader2 size={20} className="animate-spin" />
                      <span className="text-sm">Getting things ready…</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map(renderMessage)}
                    {botState === 'listening' && (
                      <div className="flex justify-start mb-3">
                        <div 
                          className="px-4 py-3 rounded-2xl rounded-tl-md border"
                          style={{ 
                            backgroundColor: 'var(--bg-primary)', 
                            borderColor: 'var(--border-subtle)' 
                          }}
                        >
                          <div className="flex gap-1.5">
                            <motion.span 
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: 'var(--accent-cyan)' }}
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                            />
                            <motion.span 
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: 'var(--accent-cyan)' }}
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                            />
                            <motion.span 
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: 'var(--accent-cyan)' }}
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Quick Links */}
              {isLoggedIn && messages.length > 3 && (
                <div 
                  className="px-3 py-2 border-t flex gap-2 overflow-x-auto"
                  style={{ 
                    backgroundColor: 'var(--bg-primary)', 
                    borderColor: 'var(--border-subtle)' 
                  }}
                >
                  {FEATURE_LINKS.map((link, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleOptionClick({ ...link, value: `navigate-${link.value}` })}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border whitespace-nowrap transition-colors hover:border-[var(--accent-cyan)] hover:text-[var(--accent-cyan)]"
                      style={{ 
                        backgroundColor: 'var(--bg-secondary)', 
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-muted)'
                      }}
                    >
                      {link.icon}
                      {link.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div 
                className="p-3 border-t"
                style={{ 
                  backgroundColor: 'var(--bg-primary)', 
                  borderColor: 'var(--border-subtle)' 
                }}
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-cyan)]/20 focus:border-[var(--accent-cyan)]"
                    style={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-secondary)'
                    }}
                    disabled={botState === 'loading' || botState === 'explaining'}
                    data-testid="metryx-ai-input"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={botState === 'loading' || botState === 'explaining' || !input.trim()}
                    className="rounded-xl px-4"
                    style={{ backgroundColor: 'var(--accent-cyan)' }}
                    data-testid="metryx-ai-send"
                  >
                    <Send size={18} className="text-white" />
                  </Button>
                </div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <ShieldCheck size={12} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    DPDP Compliant • No diagnosis • No labels
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
