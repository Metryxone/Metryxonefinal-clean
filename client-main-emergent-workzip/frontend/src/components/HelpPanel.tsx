import { useState } from "react";
import { X, Search, Brain, Target, Sparkles, MessageCircle, Heart, BookOpen, FileText, PieChart, Crown, ChevronRight, Phone, Mail, HelpCircle, Zap, CheckCircle } from "lucide-react";

interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: (section: string) => void;
}

const FEATURES = [
  {
    id: "lbi",
    icon: <Brain size={16} />,
    color: "#4ECDC4",
    title: "LBI Assessment",
    subtitle: "Learning Behaviour Index",
    description: "A 19-domain test that maps your child's behavioural patterns, learning style, and emotional intelligence. Takes about 30 minutes. Results unlock personalised study plans and career pathways.",
    steps: ["Grant consent for your child", "Assign the assessment", "View the detailed report"],
  },
  {
    id: "exam-ready",
    icon: <Target size={16} />,
    color: "#D97706",
    title: "Exam Readiness",
    subtitle: "Psychological readiness index",
    description: "Measures how mentally prepared your child is for an upcoming exam — covering stress levels, time management, and confidence. Results guide targeted preparation.",
    steps: ["Select your child", "Click ExamReadiness", "Review the readiness score"],
  },
  {
    id: "ai-reports",
    icon: <Sparkles size={16} />,
    color: "#0B3C5D",
    title: "AI Reports",
    subtitle: "Personalised growth insights",
    description: "MetryxAI analyses your child's assessment data and generates a written report with actionable recommendations for study habits, subject focus, and career alignment.",
    steps: ["Complete at least one LBI assessment", "Go to AI Reports", "Download or share the report"],
  },
  {
    id: "metryxai",
    icon: <MessageCircle size={16} />,
    color: "#E11D48",
    title: "Ask MetryxAI",
    subtitle: "24/7 AI-powered guidance",
    description: "Chat with MetryxAI for instant answers about your child's progress, study advice, career paths, and scholarship opportunities. Available anytime, trained on your child's data.",
    steps: ["Click the chat icon (bottom right)", "Ask any question", "Get personalised answers"],
  },
  {
    id: "hub",
    icon: <Zap size={16} />,
    color: "#0B3C5D",
    title: "Intelligence Hub",
    subtitle: "Wellness · Career · Scholarships",
    description: "Three powerful tools in one place: daily wellness check-ins to track your child's mood, Career Compass™ for AI-matched career paths, and scholarship alerts filtered by your child's grade and board.",
    steps: ["Open Intelligence Hub from sidebar", "Log a daily wellness check-in", "Explore career matches and scholarships"],
  },
  {
    id: "academics",
    icon: <BookOpen size={16} />,
    color: "#0B3C5D",
    title: "Academics",
    subtitle: "Subjects & education plan",
    description: "Set your child's education board (CBSE, ICSE, IB, etc.), grade, and subjects. This unlocks board-specific content, exam alignment, and curriculum-based study plans.",
    steps: ["Go to Academics tab", "Set education board and grade", "Add subjects and goals"],
  },
  {
    id: "tests",
    icon: <FileText size={16} />,
    color: "#0B3C5D",
    title: "Tests & Planner",
    subtitle: "Schedule and manage exams",
    description: "Schedule upcoming exams, track completion, and monitor scores over time. Parents of minor children can run supervised tests directly from the portal.",
    steps: ["Go to Tests & Planner", "Add an upcoming exam", "Supervise or assign tests"],
  },
  {
    id: "analytics",
    icon: <PieChart size={16} />,
    color: "#0B3C5D",
    title: "Analytics",
    subtitle: "Score trends & insights",
    description: "Visual charts showing your child's score progression across subjects and over time. Identify strengths, spot weak areas early, and track improvement after each study cycle.",
    steps: ["Complete at least 2 exams", "Go to Analytics tab", "Review subject and trend charts"],
  },
];

const FAQS = [
  { q: "How do I add a second child?", a: "Click '+ Add Child' in the children strip at the top of the dashboard. Each child has their own data, consent settings, and reports." },
  { q: "What is LBI consent?", a: "Because LBI collects behavioural data, parents must grant explicit consent for minor children (under 18). You control this at any time via 'Manage Consent'." },
  { q: "How do I switch between children?", a: "Click any child card in the strip at the top of the dashboard. All the data below instantly switches to that child." },
  { q: "What does 'No Board' mean?", a: "Your child's education board (CBSE, ICSE, IB, State Board, etc.) hasn't been set yet. Go to Academics → Update board to unlock curriculum-aligned content." },
  { q: "How do I get a career recommendation?", a: "Complete the LBI Assessment first. Then visit the Intelligence Hub → Career Compass™ tab for AI-matched career pathways based on your child's behavioural profile." },
  { q: "Can I download reports?", a: "Yes. AI Reports and LBI result reports can be downloaded as PDFs from the Reports section." },
];

export function HelpPanel({ open, onClose, onNavigate }: HelpPanelProps) {
  const [search, setSearch] = useState("");
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const filteredFeatures = FEATURES.filter(f =>
    !search || f.title.toLowerCase().includes(search.toLowerCase()) || f.description.toLowerCase().includes(search.toLowerCase())
  );
  const filteredFaqs = FAQS.filter(f =>
    !search || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase())
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col bg-white shadow-2xl"
        style={{ width: 380, borderLeft: "1px solid #E2E8F0" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#E2E8F0" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#0B3C5D" }}
            >
              <HelpCircle size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold" style={{ color: "#2E3440" }}>Help & Support</h2>
              <p className="text-[10px]" style={{ color: "#9AA4B2" }}>Guides, FAQs, and feature explanations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "#9AA4B2" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#F5F7FA")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "#E2E8F0" }}>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9AA4B2" }} />
            <input
              type="text"
              placeholder="Search features, questions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-[12px] rounded-lg border outline-none transition-colors"
              style={{
                borderColor: "#E2E8F0",
                color: "#2E3440",
                background: "#F5F7FA",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "#0B3C5D")}
              onBlur={e => (e.currentTarget.style.borderColor = "#E2E8F0")}
            />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Feature guides */}
          <div className="px-4 pt-4 pb-2">
            <p className="text-[9.5px] font-bold uppercase tracking-widest mb-3" style={{ color: "#9AA4B2" }}>
              Feature Guides
            </p>
            <div className="space-y-1.5">
              {filteredFeatures.map(f => (
                <div
                  key={f.id}
                  className="rounded-xl border overflow-hidden transition-all"
                  style={{ borderColor: expandedFeature === f.id ? f.color + "40" : "#E2E8F0" }}
                >
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                    style={{ background: expandedFeature === f.id ? f.color + "08" : "transparent" }}
                    onClick={() => setExpandedFeature(expandedFeature === f.id ? null : f.id)}
                    onMouseEnter={e => { if (expandedFeature !== f.id) (e.currentTarget as HTMLElement).style.background = "#F5F7FA"; }}
                    onMouseLeave={e => { if (expandedFeature !== f.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: f.color + "18", color: f.color }}
                    >
                      {f.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold" style={{ color: "#2E3440" }}>{f.title}</p>
                      <p className="text-[10px]" style={{ color: "#9AA4B2" }}>{f.subtitle}</p>
                    </div>
                    <ChevronRight
                      size={13}
                      className="flex-shrink-0 transition-transform"
                      style={{
                        color: "#9AA4B2",
                        transform: expandedFeature === f.id ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    />
                  </button>

                  {expandedFeature === f.id && (
                    <div className="px-3 pb-3 space-y-3" style={{ background: f.color + "06" }}>
                      <p className="text-[11px] leading-relaxed" style={{ color: "#5F6C80" }}>
                        {f.description}
                      </p>
                      <div>
                        <p className="text-[9.5px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9AA4B2" }}>
                          How to get started
                        </p>
                        <div className="space-y-1">
                          {f.steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5"
                                style={{ background: f.color, color: "white" }}
                              >
                                {i + 1}
                              </div>
                              <p className="text-[11px]" style={{ color: "#5F6C80" }}>{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* FAQs */}
          {filteredFaqs.length > 0 && (
            <div className="px-4 pt-4 pb-2">
              <p className="text-[9.5px] font-bold uppercase tracking-widest mb-3" style={{ color: "#9AA4B2" }}>
                Frequently Asked Questions
              </p>
              <div className="space-y-1.5">
                {filteredFaqs.map((faq, i) => (
                  <div
                    key={i}
                    className="rounded-xl border overflow-hidden"
                    style={{ borderColor: "#E2E8F0" }}
                  >
                    <button
                      className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
                      onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F5F7FA")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <HelpCircle size={12} className="flex-shrink-0 mt-0.5" style={{ color: "#0B3C5D" }} />
                      <span className="flex-1 text-[11.5px] font-semibold" style={{ color: "#2E3440" }}>{faq.q}</span>
                      <ChevronRight
                        size={12}
                        className="flex-shrink-0 mt-0.5 transition-transform"
                        style={{
                          color: "#9AA4B2",
                          transform: expandedFaq === i ? "rotate(90deg)" : "rotate(0deg)",
                        }}
                      />
                    </button>
                    {expandedFaq === i && (
                      <div className="px-3 pb-3">
                        <p className="text-[11px] leading-relaxed" style={{ color: "#5F6C80" }}>{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact support */}
          <div className="px-4 pt-4 pb-6">
            <p className="text-[9.5px] font-bold uppercase tracking-widest mb-3" style={{ color: "#9AA4B2" }}>
              Contact Support
            </p>
            <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "#E2E8F0", background: "#F5F7FA" }}>
              <a
                href="mailto:support@metryxone.com"
                className="flex items-center gap-2.5 text-[11.5px] font-medium transition-colors"
                style={{ color: "#0B3C5D" }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#0B3C5D", color: "white" }}>
                  <Mail size={13} />
                </div>
                support@metryxone.com
              </a>
              <div className="flex items-center gap-2.5 text-[11.5px] font-medium" style={{ color: "#5F6C80" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#E2E8F0" }}>
                  <Phone size={13} />
                </div>
                Mon–Fri, 9 am–6 pm IST
              </div>
              <div className="flex items-center gap-1.5 mt-1 pt-1 border-t" style={{ borderColor: "#E2E8F0" }}>
                <CheckCircle size={10} style={{ color: "#4ECDC4" }} />
                <span className="text-[10px]" style={{ color: "#9AA4B2" }}>Avg. response time: under 4 hours</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
