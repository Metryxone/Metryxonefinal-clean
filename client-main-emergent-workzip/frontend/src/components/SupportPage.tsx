import { useState } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from '../App';
import { HelpCircle, Mail, Phone, MessageCircle, Clock, ChevronDown, ChevronUp, Search, BookOpen, Users, CreditCard, Shield, Smartphone } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SupportPageProps {
  onNavigate: (screen: Screen) => void;
}

const faqs = [
  {
    category: "Getting Started",
    icon: BookOpen,
    questions: [
      {
        q: "How do I create an account on MetryxOne?",
        a: "Click 'Sign Up' on the login page. Enter your mobile number, verify with OTP, and complete your profile. Parents can add children, and institutions can register their schools."
      },
      {
        q: "What is LBI assessment?",
        a: "Learning Behavior Index (LBI) is our AI-powered behavioral assessment system that measures psychological readiness, emotional intelligence, stress management, and other behavioral traits to provide holistic student development insights."
      },
      {
        q: "How do I add my child to my account?",
        a: "Log in to your parent dashboard, click 'Add Child' and enter their details. You'll need to provide consent for behavioral assessments as per DPDP Act requirements."
      }
    ]
  },
  {
    category: "Assessments",
    icon: Users,
    questions: [
      {
        q: "What is ExamReadiness Index™?",
        a: "ExamReadiness Index™ is our comprehensive assessment that measures psychological exam readiness including stress management, focus, emotional regulation, and confidence. It helps students prepare mentally for exams."
      },
      {
        q: "How often can my child take behavioral assessments?",
        a: "Each behavioral assessment category has a 6-month lockout period to ensure meaningful development between assessments. This prevents assessment fatigue and ensures accurate insights."
      },
      {
        q: "Are the assessments proctored?",
        a: "Parents can enable Supervised Test Mode for minors. This allows you to monitor your child's exam session and ensures a distraction-free environment."
      }
    ]
  },
  {
    category: "Billing & Subscriptions",
    icon: CreditCard,
    questions: [
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit/debit cards, UPI, net banking, and popular wallets through our secure Razorpay integration. All transactions are encrypted and secure."
      },
      {
        q: "Can I get a refund?",
        a: "Refunds are available within 7 days of purchase if no assessments have been started. Contact our support team with your order details for refund processing."
      },
      {
        q: "Are there discounts for schools?",
        a: "Yes! Educational institutions can contact our sales team for custom pricing based on student count. We offer significant discounts for school-wide implementations."
      }
    ]
  },
  {
    category: "Privacy & Security",
    icon: Shield,
    questions: [
      {
        q: "How is my child's data protected?",
        a: "All data is encrypted with 256-bit SSL, stored securely in compliance with DPDP Act, and never shared with third parties without explicit consent. Parents have full control over their child's data."
      },
      {
        q: "Can I delete my data?",
        a: "Yes, you can request complete data deletion through your account settings or by contacting privacy@metryxone.com. Deletion is processed within 90 days as per our policy."
      }
    ]
  },
  {
    category: "Technical Issues",
    icon: Smartphone,
    questions: [
      {
        q: "The app is not loading properly. What should I do?",
        a: "Try clearing your browser cache, disabling ad blockers, or using a different browser. If issues persist, check your internet connection or contact support with your browser details."
      },
      {
        q: "I'm not receiving OTP messages",
        a: "Ensure your mobile number is correct and has network coverage. Check if the number is registered with DND. If issues persist, try the 'Resend OTP' option or contact support."
      }
    ]
  }
];

const contactMethods = [
  {
    icon: Mail,
    title: "Email Support",
    detail: "support@metryxone.com",
    description: "Get a response within 24 hours"
  },
  {
    icon: Phone,
    title: "Phone Support",
    detail: "+91 1800-XXX-XXXX",
    description: "Toll-free, Mon-Sat 9AM-6PM"
  },
  {
    icon: MessageCircle,
    title: "Live Chat",
    detail: "Chat with MetryxAI",
    description: "Available 24/7 for instant help"
  }
];

export function SupportPage({ onNavigate }: SupportPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Getting Started");
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const filteredFaqs = searchQuery
    ? faqs.map(cat => ({
        ...cat,
        questions: cat.questions.filter(q => 
          q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.questions.length > 0)
    : faqs;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-secondary)" }}>
      <Navbar onNavigate={onNavigate} currentScreen="support" />
      
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div 
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
              style={{ backgroundColor: "rgba(31, 60, 136, 0.1)" }}
            >
              <HelpCircle size={32} style={{ color: "var(--metryx-blue)" }} />
            </div>
            <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
              Help & Support
            </h1>
            <p className="text-lg" style={{ color: "var(--text-muted)" }}>
              We're here to help. Find answers or reach out to our team.
            </p>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative mb-8"
          >
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <Input
              type="text"
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-14 pl-12 rounded-2xl text-base"
              style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
              data-testid="input-search-support"
            />
          </motion.div>

          {/* Contact Methods */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid md:grid-cols-3 gap-4 mb-12"
          >
            {contactMethods.map((method, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl text-center cursor-pointer transition-all hover:shadow-lg"
                style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-subtle)" }}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: "rgba(46, 196, 182, 0.1)" }}
                >
                  <method.icon size={24} style={{ color: "var(--accent-cyan)" }} />
                </div>
                <h3 className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  {method.title}
                </h3>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--metryx-blue)" }}>
                  {method.detail}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {method.description}
                </p>
              </div>
            ))}
          </motion.div>

          {/* FAQs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
              Frequently Asked Questions
            </h2>
            
            <div className="space-y-4">
              {filteredFaqs.map((category, catIdx) => (
                <div
                  key={catIdx}
                  className="rounded-2xl overflow-hidden"
                  style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-subtle)" }}
                >
                  {/* Category Header */}
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === category.category ? null : category.category)}
                    className="w-full p-5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: "rgba(31, 60, 136, 0.1)" }}
                      >
                        <category.icon size={20} style={{ color: "var(--metryx-blue)" }} />
                      </div>
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        {category.category}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                        {category.questions.length}
                      </span>
                    </div>
                    {expandedCategory === category.category ? (
                      <ChevronUp size={20} style={{ color: "var(--text-muted)" }} />
                    ) : (
                      <ChevronDown size={20} style={{ color: "var(--text-muted)" }} />
                    )}
                  </button>

                  {/* Questions */}
                  {expandedCategory === category.category && (
                    <div className="px-5 pb-5 space-y-3">
                      {category.questions.map((faq, qIdx) => (
                        <div
                          key={qIdx}
                          className="rounded-xl overflow-hidden"
                          style={{ backgroundColor: "var(--bg-secondary)" }}
                        >
                          <button
                            onClick={() => setExpandedQuestion(expandedQuestion === faq.q ? null : faq.q)}
                            className="w-full p-4 flex items-center justify-between text-left"
                          >
                            <span className="text-sm font-medium pr-4" style={{ color: "var(--text-primary)" }}>
                              {faq.q}
                            </span>
                            {expandedQuestion === faq.q ? (
                              <ChevronUp size={16} className="shrink-0" style={{ color: "var(--accent-cyan)" }} />
                            ) : (
                              <ChevronDown size={16} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                            )}
                          </button>
                          {expandedQuestion === faq.q && (
                            <div className="px-4 pb-4">
                              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                                {faq.a}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Still Need Help */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-12 p-8 rounded-2xl text-center"
            style={{ background: "var(--metryx-blue)" }}
          >
            <h3 className="text-xl font-bold text-white mb-2">
              Still Need Help?
            </h3>
            <p className="text-white/70 mb-6">
              Our support team is ready to assist you with any questions.
            </p>
            <div className="flex justify-center gap-4">
              <Button
                className="rounded-xl font-medium"
                style={{ backgroundColor: "var(--accent-cyan)", color: "#fff" }}
                onClick={() => window.location.href = 'mailto:support@metryxone.com'}
                data-testid="button-email-support"
              >
                <Mail size={18} className="mr-2" />
                Email Us
              </Button>
              <Button
                variant="outline"
                className="rounded-xl font-medium border-white/30 text-white hover:bg-white/10"
                onClick={() => onNavigate('landing')}
                data-testid="button-chat-support"
              >
                <MessageCircle size={18} className="mr-2" />
                Chat with MetryxAI
              </Button>
            </div>
            <div className="flex items-center justify-center gap-2 mt-6 text-white/50 text-sm">
              <Clock size={14} />
              <span>Average response time: 4 hours</span>
            </div>
          </motion.div>
        </div>
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
