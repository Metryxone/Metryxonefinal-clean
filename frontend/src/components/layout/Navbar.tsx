import { Menu, X, ChevronDown, ArrowRight, Brain, GraduationCap, Briefcase, Building2, BookOpen, Users, Shield, Sparkles, Cpu, MessageSquare, School, Target, Rocket, FileText, Award, HeadphonesIcon, Mail, Heart, Newspaper, TrendingUp, Zap, Search, Settings, Map, BarChart3, UserCheck, Layers, Network, Activity, Lightbulb, FlaskConical, GitMerge, Gauge } from "lucide-react";
import React, { useState } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import NotificationCenter from "@/components/NotificationCenter";
import logoTransparent from "@/assets/metryx-logo-transparent.png";
import logoTransparentDark from "@/assets/metryx-logo-transparent-dark.png";
import { Screen } from "../../App";

type MenuItem = {
  label: string;
  slug: string;
  desc?: string;
  icon?: React.ElementType;
  featured?: boolean;
  badge?: string;
  stat?: string;
};

type MenuGroup = {
  heading: string;
  items: MenuItem[];
};

type FeaturedPanel = {
  title: string;
  desc: string;
  cta: string;
  slug: string;
  highlights?: { label: string; value: string }[];
  accent?: string;
};

type PrimaryMenu = {
  id: string;
  label: string;
  groups: MenuGroup[];
  featured?: FeaturedPanel;
};

const INTELLIGENCE_MENU: PrimaryMenu = {
  id: "intelligence",
  label: "Intelligence",
  groups: [
    {
      heading: "Learning Intelligence",
      items: [
        {
          label: "Behavioral Intelligence (LBI™)",
          slug: "lbi-product",
          desc: "Map human potential across 19 domains & 97 subdomains with scientific precision",
          icon: Brain,
          featured: true,
          badge: "Core",
          stat: "50K+ profiled",
        },
        {
          label: "Exam Readiness Science",
          slug: "exam-ready",
          desc: "Psychometric frameworks that predict peak academic performance before exam day",
          icon: Sparkles,
          featured: true,
          badge: "New",
        },
        {
          label: "Cognitive Profiling",
          slug: "ai-powered-reports",
          desc: "Deep intelligence mapping across attention, memory, reasoning & learning styles",
          icon: FlaskConical,
        },
        {
          label: "Learning Analytics",
          slug: "learning-paths",
          desc: "Pattern recognition across academic behavior, engagement & performance trajectories",
          icon: Activity,
        },
      ],
    },
    {
      heading: "Human Capital Intelligence",
      items: [
        {
          label: "Talent Intelligence",
          slug: "enterprise-hiring",
          desc: "Predictive hiring signals that identify high performers beyond resumes & credentials",
          icon: Network,
          featured: true,
          badge: "Popular",
          stat: "10K+ hired",
        },
        {
          label: "Leadership Readiness",
          slug: "leadership-readiness",
          desc: "Identify emerging leaders before they surface using behavioral signal mapping",
          icon: TrendingUp,
        },
        {
          label: "Workforce Intelligence",
          slug: "workforce-analytics",
          desc: "Real-time team performance patterns, culture fit & organizational capability gaps",
          icon: BarChart3,
        },
        {
          label: "Competency Intelligence Platform",
          slug: "competency-intelligence",
          desc: "Industry benchmarked competency analysis — gap scoring, role-fit probability & hiring prediction across 50 competencies",
          icon: Gauge,
          featured: true,
          badge: "New",
          stat: "50 competencies",
        },
      ],
    },
  ],
  featured: {
    title: "The Intelligence Platform",
    desc: "Behavioral science + Competency Intelligence — mapping 19 learning domains, 50 competencies & industry benchmarks to power precise decisions across 50,000+ individuals worldwide.",
    cta: "Explore the Science",
    slug: "competency-intelligence",
    highlights: [
      { label: "Domains", value: "19" },
      { label: "Competencies", value: "50" },
      { label: "Industries", value: "7" },
    ],
    accent: '#344E86',
  },
};

const COMPETENCY_MENU: PrimaryMenu = {
  id: "competency",
  label: "Competency Intelligence",
  groups: [
    {
      heading: "Benchmarking Engine",
      items: [
        {
          label: "Universal Competency Benchmarking",
          slug: "competency-intelligence",
          desc: "Benchmark any role against 50 competencies across 7 industries and 4 career stages",
          icon: Gauge,
          featured: true,
          badge: "New",
          stat: "50 competencies",
        },
        {
          label: "Gap Analysis & Role Fit",
          slug: "competency-gap-analysis",
          desc: "Score every individual's competency gaps against industry cohort benchmarks",
          icon: Target,
          featured: true,
        },
        {
          label: "Industry Benchmarks",
          slug: "competency-benchmarks",
          desc: "7-industry benchmark cohorts: Technology, Finance, Healthcare, Education, Manufacturing, Consulting, E-Commerce",
          icon: BarChart3,
        },
        {
          label: "Career Stage Analysis",
          slug: "competency-career-stages",
          desc: "Tailored scoring across Entry, Mid, Senior & Leadership career stages",
          icon: TrendingUp,
        },
      ],
    },
    {
      heading: "Career & Talent Intelligence",
      items: [
        {
          label: "Role Transition Intelligence",
          slug: "competency-role-transition",
          desc: "Probability-scored role-fit and personalised learning paths for career transitions",
          icon: GitMerge,
          badge: "New",
        },
        {
          label: "Hiring Prediction Engine",
          slug: "competency-hiring-prediction",
          desc: "Predict candidate success probability before hire using competency benchmarks",
          icon: UserCheck,
          featured: true,
        },
        {
          label: "Growth Simulation",
          slug: "competency-growth-simulation",
          desc: "Simulate 6-month competency growth trajectories with domain-level projections",
          icon: Rocket,
        },
        {
          label: "Personalised Learning Paths",
          slug: "competency-learning-paths",
          desc: "Auto-generated interventions and learning journeys prioritised by gap severity",
          icon: Lightbulb,
        },
      ],
    },
  ],
  featured: {
    title: "Competency Intelligence Platform™",
    desc: "The only engine that benchmarks 50 competencies across 7 industries — delivering gap scores, role-fit probability, hiring predictions, and growth simulations in real time.",
    cta: "Open Competency Dashboard",
    slug: "competency-intelligence",
    highlights: [
      { label: "Competencies", value: "50" },
      { label: "Industries", value: "7" },
      { label: "Career Stages", value: "4" },
    ],
    accent: '#4ECDC4',
  },
};

const MENUS: PrimaryMenu[] = [
  INTELLIGENCE_MENU,
  {
    id: "products",
    label: "Products",
    groups: [
      {
        heading: "Assessment Products",
        items: [
          { label: "LBI™", slug: "lbi-product", desc: "Comprehensive behavioral intelligence across 19 domains and 97 subdomains", icon: Brain, featured: true, badge: "Core", stat: "50K+ assessed" },
          { label: "ExamReadiness Index™", slug: "exam-ready", desc: "Measure psychological exam readiness, not academic knowledge", icon: Sparkles, featured: true, badge: "New" },
          { label: "Competency Intelligence Platform™", slug: "competency-intelligence", desc: "50-competency benchmarking, role-fit scoring, gap analysis & hiring prediction across 7 industries", icon: Gauge, featured: true, badge: "New", stat: "7 industries" },
          { label: "AI-Powered Reports", slug: "ai-powered-reports", desc: "Personalized insights with actionable recommendations for growth", icon: Cpu },
          { label: "MetryxAI Assistant", slug: "metryxai-assistant", desc: "24/7 AI guidance for parents, students & educators", icon: MessageSquare, stat: "Always on" },
        ],
      },
      {
        heading: "Plans & Pricing",
        items: [
          { label: "Pricing & Subscriptions", slug: "pricing", desc: "Compare plans, packages & find the right fit for your needs", icon: Zap, featured: true, badge: "Popular" },
        ],
      },
    ],
    featured: {
      title: "Competency Intelligence Platform™",
      desc: "50-competency benchmarking across 7 industries. Map gaps, score role-fit, predict hiring outcomes and deliver personalised learning paths — all in one engine.",
      cta: "Explore Competency Intelligence",
      slug: "competency-intelligence",
      highlights: [
        { label: "Competencies", value: "50" },
        { label: "Industries", value: "7" },
        { label: "Career Stages", value: "4" },
      ],
      accent: '#344E86',
    },
  },
  {
    id: "solutions",
    label: "Solutions",
    groups: [
      {
        heading: "Education",
        items: [
          { label: "K-12 Schools", slug: "k12-schools", desc: "Student wellbeing & learning pattern insights for all grades", icon: School, stat: "500+ schools" },
          { label: "Coaching Institutes", slug: "coaching", desc: "JEE/NEET/UPSC exam readiness optimization", icon: Target, badge: "Popular" },
          { label: "EdTech Platforms", slug: "edtech", desc: "API integration for seamless learning platform embedding", icon: Rocket },
          { label: "Learning Paths", slug: "learning-paths", desc: "Career-based personalized roadmaps with milestones & skill tracking", icon: TrendingUp, badge: "New" },
          { label: "Mentor Marketplace", slug: "mentor-marketplace", desc: "Find expert tutors, counsellors & coaches for personalized guidance", icon: Users },
        ],
      },
      {
        heading: "Enterprise & Workforce",
        items: [
          { label: "Talent Assessment", slug: "enterprise-hiring", desc: "Hire based on cognitive potential, not just resumes", icon: Briefcase, stat: "10K+ hired", featured: true, badge: "Popular" },
          { label: "Competency Benchmarking", slug: "competency-intelligence", desc: "Benchmark roles against 50 competencies across 7 industries — identify who's ready, who needs growth", icon: Gauge, featured: true, badge: "New" },
          { label: "Campus Recruitment", slug: "campus-recruit", desc: "University-to-workforce talent signals & matching", icon: GraduationCap, badge: "New" },
          { label: "Workforce Analytics", slug: "workforce-analytics", desc: "Team performance patterns, leadership readiness & skill gaps", icon: BarChart3 },
          { label: "Role Transition & Hiring Prediction", slug: "competency-role-transition", desc: "Probability-scored role-fit, gap analysis & personalised learning paths for career progression", icon: GitMerge },
          { label: "L&D Integration", slug: "ld-integration", desc: "Plug into existing LMS, HRIS & corporate learning platforms", icon: Layers },
        ],
      },
    ],
    featured: {
      title: "Competency Intelligence",
      desc: "Benchmark your workforce against 50 competencies across 7 industries. Identify gaps, predict role-fit, and deliver personalised growth paths — all in one platform.",
      cta: "Explore Competency Intelligence",
      slug: "competency-intelligence",
      highlights: [
        { label: "Competencies", value: "50" },
        { label: "Industries", value: "7" },
        { label: "Clients", value: "120+" },
      ],
      accent: '#4ECDC4',
    },
  },
  COMPETENCY_MENU,
  {
    id: "resources",
    label: "Resources",
    groups: [
      {
        heading: "Learn",
        items: [
          { label: "Documentation", slug: "docs", desc: "Technical guides, API reference & integration docs", icon: BookOpen },
          { label: "Case Studies", slug: "case-studies", desc: "Real success stories from schools, parents & institutes", icon: Award, badge: "Updated" },
          { label: "Research Papers", slug: "research", desc: "Scientific methodology & validation behind LBI", icon: FileText },
        ],
      },
      {
        heading: "Support",
        items: [
          { label: "Help Center", slug: "help", desc: "FAQs, troubleshooting guides & video tutorials", icon: HeadphonesIcon },
          { label: "Contact Us", slug: "contact", desc: "Reach our support team - avg response < 4 hours", icon: Mail, stat: "< 4hr response" },
        ],
      },
    ],
    featured: {
      title: "Free LBI Mini Check",
      desc: "Take a quick 10-question behavioral assessment. Discover strengths across focus, resilience, social skills and more.",
      cta: "Start Free Check",
      slug: "mini-check",
      highlights: [
        { label: "Questions", value: "10" },
        { label: "Time", value: "5 min" },
        { label: "Domains", value: "5" },
      ],
      accent: '#f59e0b',
    },
  },
  {
    id: "company",
    label: "Company",
    groups: [
      {
        heading: "About MetryxOne",
        items: [
          { label: "Our Story", slug: "about", desc: "Mission to transform education intelligence worldwide", icon: Heart },
          { label: "Leadership", slug: "leadership", desc: "Meet the visionary team behind MetryxOne", icon: Users },
          { label: "Careers", slug: "careers", desc: "Join us in shaping education's future", icon: TrendingUp, featured: true, badge: "Hiring" },
          { label: "Press & Media", slug: "press", desc: "News, coverage, awards & media kit", icon: Newspaper },
        ],
      },
    ],
    featured: {
      title: "Join Our Mission",
      desc: "We're building the future of education intelligence. Remote-first culture, meaningful impact, and a passionate team.",
      cta: "View Open Roles",
      slug: "careers",
      highlights: [
        { label: "Team", value: "50+" },
        { label: "Countries", value: "4" },
        { label: "Culture", value: "Remote" },
      ],
      accent: '#4ECDC4',
    },
  },
];

const BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  Core:    { bg: '#344E86', text: '#fff' },
  New:     { bg: '#4ECDC4', text: '#fff' },
  Popular: { bg: '#f59e0b', text: '#fff' },
  Hiring:  { bg: '#4ECDC4', text: '#fff' },
  Updated: { bg: '#0B3C5D', text: '#fff' },
  Admin:   { bg: '#dc2626', text: '#fff' },
};

const ICON_ACCENT_COLORS = ['#4ECDC4', '#344E86', '#f59e0b', '#0B3C5D'];

interface NavbarProps {
  onNavigate: (screen: Screen) => void;
  currentScreen?: Screen;
}

export function Navbar({ onNavigate, currentScreen }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const menuTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const desktopNavRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (desktopNavRef.current && !desktopNavRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setHoveredItem(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  const isAuthPage = currentScreen === 'login' || currentScreen === 'registration' || currentScreen === 'forgot-password';
  const isPublicPage = [
    'landing', 'careers', 'privacy', 'request-demo', 'site-map',
    'resources', 'blog', 'about', 'contact', 'pricing',
  ].includes(currentScreen as string) || isAuthPage;

  const handleMenuHover = (menuId: string) => {
    if (menuTimeoutRef.current) {
      clearTimeout(menuTimeoutRef.current);
      menuTimeoutRef.current = null;
    }
    setOpenMenu(menuId);
  };

  const handleMenuLeave = () => {
    menuTimeoutRef.current = setTimeout(() => {
      setOpenMenu(null);
      setHoveredItem(null);
    }, 150);
  };

  const handleDropdownEnter = () => {
    if (menuTimeoutRef.current) {
      clearTimeout(menuTimeoutRef.current);
      menuTimeoutRef.current = null;
    }
  };

  const handleItemClick = (slug: string) => {
    if (menuTimeoutRef.current) {
      clearTimeout(menuTimeoutRef.current);
    }
    setOpenMenu(null);
    setHoveredItem(null);
    onNavigate(slug as Screen);
  };

  const renderMenuItem = (item: MenuItem, menuId: string, itemIndex: number) => {
    const isHovered = hoveredItem === `${menuId}-${item.label}`;
    const badgeStyle = item.badge ? BADGE_STYLES[item.badge] || BADGE_STYLES.Core : null;
    const iconColor = ICON_ACCENT_COLORS[itemIndex % ICON_ACCENT_COLORS.length];

    return (
      <li key={item.label}>
        <button
          type="button"
          onClick={() => handleItemClick(item.slug)}
          onMouseEnter={() => setHoveredItem(`${menuId}-${item.label}`)}
          onMouseLeave={() => setHoveredItem(null)}
          className="w-full text-left rounded-xl transition-all duration-200 focus:outline-none group relative"
          style={{
            padding: '8px 10px',
            backgroundColor: isHovered ? 'var(--bg-secondary)' : 'transparent',
          }}
          data-testid={`menuitem-${menuId}-${item.slug}`}
        >
          <div className="flex items-start gap-3">
            {item.icon && (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 mt-0.5"
                style={{
                  backgroundColor: isHovered
                    ? `${iconColor}18`
                    : 'var(--bg-tertiary, var(--bg-secondary))',
                  border: `1px solid ${isHovered ? `${iconColor}30` : 'transparent'}`,
                }}
              >
                <item.icon
                  size={15}
                  style={{
                    color: isHovered ? iconColor : 'var(--text-muted)',
                    transition: 'color 0.2s',
                  }}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-[12.5px] font-semibold leading-tight transition-colors duration-200"
                  style={{
                    color: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {item.label}
                </span>
                {item.badge && badgeStyle && (
                  <span
                    className="text-[7px] font-bold uppercase px-1.5 py-[2px] rounded-full tracking-wider shrink-0"
                    style={{
                      backgroundColor: badgeStyle.bg,
                      color: badgeStyle.text,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                {item.stat && (
                  <span
                    className="text-[9px] font-medium shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    · {item.stat}
                  </span>
                )}
              </div>
              {item.desc && (
                <span
                  className="block text-[10.5px] leading-snug mt-0.5 line-clamp-2 transition-colors duration-200"
                  style={{ color: isHovered ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                >
                  {item.desc}
                </span>
              )}
            </div>
            <ArrowRight
              size={11}
              className="shrink-0 mt-1.5 transition-all duration-200"
              style={{
                color: iconColor,
                opacity: isHovered ? 1 : 0,
                transform: isHovered ? 'translateX(0)' : 'translateX(-6px)',
              }}
            />
          </div>
        </button>
      </li>
    );
  };

  return (
    <>
      <header
        className="fixed top-0 w-full z-50 border-b"
        style={{
          backgroundColor: `color-mix(in srgb, var(--bg-primary) 96%, transparent)`,
          borderColor: "var(--border-subtle)",
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 1px 0 0 var(--border-subtle), 0 2px 16px rgba(11,60,93,0.06)',
        }}
        data-testid="header-root"
      >
        <nav className="container mx-auto px-4 h-[60px] flex items-center justify-between gap-4">

          {/* Logo */}
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center cursor-pointer shrink-0"
            data-testid="link-home-logo"
          >
            <img
              src={theme === 'dark' ? logoTransparentDark : logoTransparent}
              alt="MetryxOne"
              className="h-7 w-auto"
              data-testid="logo-image"
            />
          </button>

          {/* Desktop nav */}
          <div
            ref={desktopNavRef}
            className="hidden lg:flex items-center gap-0.5 flex-1 justify-center"
            onMouseLeave={handleMenuLeave}
            aria-label="Primary navigation"
            role="menubar"
          >
            {MENUS.map((menu) => {
              const isActive = openMenu === menu.id;
              return (
                <div key={menu.id} className="relative" data-testid={`nav-menu-${menu.id}`}>
                  <button
                    type="button"
                    className="relative flex items-center gap-1 text-[13px] font-medium px-2.5 py-1.5 rounded-lg transition-all duration-150 focus:outline-none whitespace-nowrap"
                    style={{
                      color: isActive ? '#0B3C5D' : 'var(--text-secondary)',
                      backgroundColor: isActive ? 'rgba(78,205,196,0.10)' : 'transparent',
                    }}
                    onMouseEnter={() => handleMenuHover(menu.id)}
                    onClick={() => {
                      if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
                      setOpenMenu(prev => prev === menu.id ? null : menu.id);
                    }}
                    aria-haspopup="true"
                    aria-expanded={isActive}
                    data-testid={`button-nav-${menu.id}`}
                  >
                    {menu.label}
                    <ChevronDown
                      size={13}
                      className={`transition-transform duration-200 ${isActive ? 'rotate-180' : ''}`}
                      style={{ color: isActive ? '#4ECDC4' : 'var(--text-muted)' }}
                    />
                    {/* Active underline indicator */}
                    {isActive && (
                      <span
                        className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                        style={{ backgroundColor: '#4ECDC4' }}
                      />
                    )}
                  </button>

                  {isActive && (
                    <div
                      className="absolute top-full pt-2.5"
                      onMouseEnter={handleDropdownEnter}
                      onMouseLeave={handleMenuLeave}
                      style={{
                        animation: 'navDropIn 0.16s ease-out',
                        left: menu.id === 'company' || menu.id === 'resources' || menu.id === 'competency' ? 'auto' : '0',
                        right: menu.id === 'company' || menu.id === 'resources' || menu.id === 'competency' ? '0' : 'auto',
                        zIndex: 100,
                      }}
                    >
                      <div
                        className="rounded-2xl border overflow-hidden"
                        style={{
                          width: menu.featured ? '700px' : '500px',
                          backgroundColor: "var(--bg-primary)",
                          borderColor: "var(--border-subtle)",
                          boxShadow: '0 20px 60px rgba(11,60,93,0.14), 0 4px 16px rgba(0,0,0,0.06)',
                        }}
                        role="menu"
                      >
                        {/* Top accent bar */}
                        <div
                          className="h-[3px] w-full"
                          style={{ background: 'linear-gradient(90deg, #0B3C5D 0%, #4ECDC4 60%, #344E86 100%)' }}
                        />

                        <div style={{ display: 'flex' }}>
                          {/* Menu items column */}
                          <div style={{ flex: 1, padding: '16px 18px 12px' }}>
                            {menu.groups.map((group, gi) => (
                              <div
                                key={group.heading}
                                style={gi > 0 ? { marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' } : {}}
                              >
                                {/* Group heading */}
                                <div className="flex items-center gap-2 mb-3">
                                  <span
                                    className="text-[9px] font-bold uppercase tracking-[0.18em]"
                                    style={{ color: gi % 2 === 0 ? '#4ECDC4' : '#344E86' }}
                                  >
                                    {group.heading}
                                  </span>
                                  <div
                                    className="flex-1 h-px"
                                    style={{ backgroundColor: 'var(--border-subtle)' }}
                                  />
                                </div>

                                <ul
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: group.items.length > 2 ? 'repeat(2, 1fr)' : '1fr',
                                    gap: '2px',
                                  }}
                                >
                                  {group.items.map((item, idx) => renderMenuItem(item, menu.id, idx))}
                                </ul>
                              </div>
                            ))}
                          </div>

                          {/* Featured panel */}
                          {menu.featured && (
                            <div
                              style={{
                                width: '200px',
                                flexShrink: 0,
                                padding: '16px 14px 14px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                position: 'relative',
                                overflow: 'hidden',
                                backgroundColor: '#0B3C5D',
                              }}
                            >
                              {/* Subtle pattern overlay */}
                              <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
                                <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', border: '1px solid white' }} />
                                <div style={{ position: 'absolute', bottom: -10, left: -10, width: 70, height: 70, borderRadius: '50%', border: '1px solid white' }} />
                              </div>

                              <div className="relative">
                                {/* Featured label */}
                                <div className="flex items-center gap-1.5 mb-3">
                                  <div
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: menu.featured.accent || '#4ECDC4' }}
                                  />
                                  <span
                                    className="text-[8.5px] font-bold uppercase tracking-[0.18em]"
                                    style={{ color: menu.featured.accent || '#4ECDC4' }}
                                  >
                                    Featured
                                  </span>
                                </div>

                                <p className="text-white text-[13px] font-bold mb-1.5 leading-snug">
                                  {menu.featured.title}
                                </p>
                                <p className="text-[10px] leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
                                  {menu.featured.desc}
                                </p>

                                {menu.featured.highlights && (
                                  <div className="flex gap-1.5 mb-4">
                                    {menu.featured.highlights.map((h) => (
                                      <div
                                        key={h.label}
                                        className="flex-1 rounded-lg px-1 py-1.5 text-center"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}
                                      >
                                        <div className="text-[11px] font-bold text-white leading-none mb-0.5">{h.value}</div>
                                        <div className="text-[7px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.38)' }}>{h.label}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => handleItemClick(menu.featured!.slug)}
                                className="flex items-center justify-center gap-1.5 text-[10.5px] font-semibold group/cta w-full py-2 rounded-lg transition-all"
                                style={{
                                  backgroundColor: menu.featured.accent || '#4ECDC4',
                                  color: '#fff',
                                }}
                                data-testid={`menuitem-featured-${menu.id}`}
                              >
                                {menu.featured.cta}
                                <ArrowRight size={11} className="transition-transform group-hover/cta:translate-x-1" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Footer bar */}
                        <div
                          className="px-4 py-2.5 flex items-center justify-between border-t"
                          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
                        >
                          <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            {menu.id === 'products' && '5 products · Trusted by 50K+ users'}
                            {menu.id === 'solutions' && '10 solutions · Education & Enterprise · 500+ clients'}
                            {menu.id === 'resources' && '5 resources · Updated weekly'}
                            {menu.id === 'company' && 'Building the future of education intelligence'}
                            {menu.id === 'competency' && '50 competencies · 7 industries · 4 career stages'}
                            {menu.id === 'intelligence' && '19 domains · 50 competencies · Science-backed'}
                          </span>
                          <button
                            onClick={() => handleItemClick(menu.groups[0].items[0].slug)}
                            className="text-[10px] font-semibold flex items-center gap-1 transition-all hover:gap-1.5"
                            style={{ color: '#4ECDC4' }}
                          >
                            View all <ArrowRight size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Site Map */}
            <button
              type="button"
              onClick={() => onNavigate('site-map')}
              className="flex items-center gap-1.5 text-[13px] font-medium px-2.5 py-1.5 rounded-lg transition-all duration-150 focus:outline-none whitespace-nowrap"
              style={{
                color: currentScreen === 'site-map' ? '#0B3C5D' : 'var(--text-secondary)',
                backgroundColor: currentScreen === 'site-map' ? 'rgba(78,205,196,0.10)' : 'transparent',
              }}
              data-testid="nav-sitemap"
            >
              <Map size={13} style={{ color: currentScreen === 'site-map' ? '#4ECDC4' : 'var(--text-muted)' }} />
              Site Map
            </button>
          </div>

          {/* Right controls */}
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            {/* Search pill */}
            <button
              onClick={() => window.dispatchEvent(new Event('metryx:open-search'))}
              className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg text-[12px] font-medium transition-all"
              style={{
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-secondary)',
              }}
              data-testid="btn-search"
              title="Search (⌘K)"
            >
              <Search size={12} style={{ color: 'var(--text-muted)' }} />
              <span>Search</span>
              <kbd
                className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-muted)',
                }}
              >⌘K</kbd>
            </button>

            <ThemeToggle />

            {isAuthenticated && !isPublicPage && (
              <>
                <NotificationCenter variant="light" onNavigate={(s) => onNavigate(s as Screen)} />
                <div className="w-px h-5 mx-0.5" style={{ backgroundColor: 'var(--border-subtle)' }} />
              </>
            )}

            {!isAuthPage && !isAuthenticated && (
              <button
                onClick={() => onNavigate('login')}
                className="text-[12.5px] font-semibold px-4 py-1.5 rounded-lg transition-all"
                style={{
                  color: 'var(--text-primary)',
                  border: '1.5px solid var(--border-subtle)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-secondary)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#4ECDC4';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)';
                }}
                data-testid="link-login"
              >
                Login
              </button>
            )}

            <LanguageSelector variant="minimal" />
          </div>

          {/* Mobile toggle */}
          <div className="lg:hidden flex items-center gap-3">
            <LanguageSelector variant="minimal" />
            <ThemeToggle />
            <button
              style={{ color: "var(--text-secondary)" }}
              onClick={() => {
                setIsOpen(!isOpen);
                setOpenMenu(null);
              }}
              aria-label="Toggle navigation menu"
              data-testid="button-mobile-menu"
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>

        {/* Mobile menu panel */}
        {isOpen && (
          <div
            className="lg:hidden border-t"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border-subtle)",
              boxShadow: '0 8px 32px rgba(11,60,93,0.10)',
            }}
            data-testid="panel-mobile-menu"
          >
            <div className="px-5 py-4 space-y-3 max-h-[72vh] overflow-y-auto">
              {MENUS.map((menu) => (
                <details
                  key={menu.id}
                  className="border-b pb-3"
                  style={{ borderColor: "var(--border-subtle)" }}
                  data-testid={`accordion-${menu.id}`}
                >
                  <summary
                    className="flex items-center justify-between cursor-pointer text-[13px] font-semibold py-2 select-none"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {menu.label}
                    <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />
                  </summary>
                  <div className="mt-2 space-y-4 pl-1">
                    {menu.groups.map((group) => (
                      <div key={group.heading}>
                        <p
                          className="text-[9px] font-bold uppercase tracking-[0.16em] mb-2"
                          style={{ color: '#4ECDC4' }}
                        >
                          {group.heading}
                        </p>
                        <ul className="space-y-0.5">
                          {group.items.map((item) => (
                            <li key={item.label}>
                              <button
                                onClick={() => {
                                  handleItemClick(item.slug);
                                  setIsOpen(false);
                                }}
                                className="w-full text-left text-[13px] py-2 px-2 rounded-lg flex items-center gap-2.5 transition-colors"
                                style={{ color: "var(--text-secondary)" }}
                                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-secondary)'}
                                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'}
                              >
                                {item.icon && (
                                  <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                                  >
                                    <item.icon size={13} style={{ color: '#4ECDC4' }} />
                                  </div>
                                )}
                                <span className="flex-1">{item.label}</span>
                                {item.badge && (
                                  <span
                                    className="text-[8px] font-bold uppercase px-1.5 py-[2px] rounded-full shrink-0"
                                    style={{
                                      backgroundColor: (BADGE_STYLES[item.badge] || BADGE_STYLES.Core).bg,
                                      color: '#fff',
                                    }}
                                  >
                                    {item.badge}
                                  </span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              ))}

              <button
                onClick={() => { onNavigate('site-map'); setIsOpen(false); }}
                className="w-full text-left text-[13px] font-semibold py-2 border-b flex items-center gap-2.5"
                style={{ color: "var(--text-secondary)", borderColor: "var(--border-subtle)" }}
                data-testid="button-mobile-sitemap"
              >
                <Map size={14} style={{ color: '#4ECDC4' }} />
                Site Map
              </button>

              {!isAuthPage && !isAuthenticated && (
                <button
                  onClick={() => {
                    onNavigate('login');
                    setIsOpen(false);
                  }}
                  className="w-full text-center text-[13px] font-semibold py-2.5 rounded-xl mt-1"
                  style={{
                    color: '#0B3C5D',
                    border: '1.5px solid rgba(11,60,93,0.25)',
                  }}
                  data-testid="button-mobile-login"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Spacer for fixed header (60px) */}
      <div className="h-[60px] shrink-0" aria-hidden="true" />

      <style>{`
        @keyframes navDropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
