import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  HelpCircle,
  Info,
  Lightbulb,
  BookOpen,
  Video,
  MessageCircle,
  ChevronRight,
  ChevronDown,
  X,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Target,
  Users,
  FileText,
  Settings,
  Shield,
  Zap,
  Phone,
  Mail,
  ExternalLink
} from 'lucide-react';

const brand = {
  primary: '#344E86',
  accent: '#4ECDC4',
};

interface HelpTooltipProps {
  content: string;
  title?: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function HelpTooltip({ content, title, children, position = 'top' }: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsVisible(!isVisible);
    } else if (e.key === 'Escape') {
      setIsVisible(false);
    }
  };

  return (
    <div 
      className="relative inline-flex items-center gap-1" 
      onMouseEnter={() => setIsVisible(true)} 
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <button
        type="button"
        className="text-gray-400 cursor-help hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 rounded-full"
        style={{ focusRing: brand.accent } as any}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        onKeyDown={handleKeyDown}
        aria-label={title || "Help information"}
        aria-describedby={isVisible ? "help-tooltip-content" : undefined}
      >
        <HelpCircle size={14} aria-hidden="true" />
      </button>
      {isVisible && (
        <div 
          id="help-tooltip-content"
          role="tooltip"
          className={`absolute ${positionClasses[position]} z-50 w-64 p-3 bg-white rounded-lg shadow-xl border animate-in fade-in-0 zoom-in-95`}
        >
          {title && <p className="font-semibold text-sm mb-1" style={{ color: brand.primary }}>{title}</p>}
          <p className="text-xs text-gray-600 leading-relaxed">{content}</p>
        </div>
      )}
    </div>
  );
}

interface ContextualHelpProps {
  topic: string;
  description: string;
  learnMoreUrl?: string;
  icon?: any;
}

export function ContextualHelp({ topic, description, learnMoreUrl, icon: Icon = Info }: ContextualHelpProps) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border-l-4" style={{ backgroundColor: `${brand.primary}05`, borderColor: brand.accent }}>
      <div className="p-2 rounded-lg" style={{ backgroundColor: `${brand.accent}15` }}>
        <Icon size={16} style={{ color: brand.accent }} />
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm" style={{ color: brand.primary }}>{topic}</p>
        <p className="text-xs text-gray-600 mt-1 leading-relaxed">{description}</p>
        {learnMoreUrl && (
          <button className="inline-flex items-center gap-1 text-xs mt-2 hover:underline" style={{ color: brand.accent }}>
            Learn more <ExternalLink size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

interface QuickStartItem {
  id: string;
  title: string;
  description: string;
  icon: any;
  completed: boolean;
  action: () => void;
}

interface QuickStartGuideProps {
  title: string;
  subtitle: string;
  items: QuickStartItem[];
  onDismiss?: () => void;
}

export function QuickStartGuide({ title, subtitle, items, onDismiss }: QuickStartGuideProps) {
  const completedCount = items.filter(i => i.completed).length;
  const progress = (completedCount / items.length) * 100;

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <div className="p-1" style={{ background: `${brand.primary}` }} />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={18} style={{ color: brand.accent }} />
              <CardTitle className="text-base" style={{ color: brand.primary }}>{title}</CardTitle>
            </div>
            <CardDescription className="text-xs">{subtitle}</CardDescription>
          </div>
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </Button>
          )}
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">{completedCount} of {items.length} completed</span>
            <span className="font-medium" style={{ color: brand.accent }}>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={item.action}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
              item.completed ? 'bg-teal-50' : 'bg-gray-50 hover:bg-gray-100'
            }`}
            data-testid={`quickstart-${item.id}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              item.completed ? 'bg-teal-100' : ''
            }`} style={{ backgroundColor: item.completed ? undefined : `${brand.primary}10` }}>
              {item.completed ? (
                <CheckCircle size={16} className="text-teal-600" />
              ) : (
                <item.icon size={16} style={{ color: brand.primary }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${item.completed ? 'text-teal-700' : ''}`} style={{ color: item.completed ? undefined : brand.primary }}>
                {item.title}
              </p>
              <p className="text-xs text-gray-500 truncate">{item.description}</p>
            </div>
            {!item.completed && (
              <ChevronRight size={16} className="text-gray-400" />
            )}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

interface FeatureHighlight {
  id: string;
  title: string;
  description: string;
  icon: any;
  isNew?: boolean;
  isPro?: boolean;
}

interface FeatureHighlightsProps {
  features: FeatureHighlight[];
  onFeatureClick?: (feature: FeatureHighlight) => void;
}

export function FeatureHighlights({ features, onFeatureClick }: FeatureHighlightsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {features.map(feature => (
        <button
          key={feature.id}
          onClick={() => onFeatureClick?.(feature)}
          className="p-4 rounded-xl bg-white border hover:border-gray-300 hover:shadow-md transition-all text-left group"
          data-testid={`feature-${feature.id}`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${brand.accent}15` }}>
              <feature.icon size={18} style={{ color: brand.accent }} />
            </div>
            <div className="flex gap-1">
              {feature.isNew && (
                <Badge className="text-[10px] px-1.5 py-0 bg-blue-500">New</Badge>
              )}
              {feature.isPro && (
                <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: brand.accent }}>Pro</Badge>
              )}
            </div>
          </div>
          <p className="font-medium text-sm mb-1 group-hover:underline" style={{ color: brand.primary }}>{feature.title}</p>
          <p className="text-xs text-gray-500 line-clamp-2">{feature.description}</p>
        </button>
      ))}
    </div>
  );
}

interface HelpCenterProps {
  isOpen: boolean;
  onClose: () => void;
  portalType: 'institute' | 'ngo';
}

export function HelpCenter({ isOpen, onClose, portalType }: HelpCenterProps) {
  const [activeCategory, setActiveCategory] = useState('getting-started');

  // Reset category when dialog opens or portal type changes
  useEffect(() => {
    if (isOpen) {
      setActiveCategory('getting-started');
    }
  }, [isOpen, portalType]);

  const categories = portalType === 'institute' ? [
    { id: 'getting-started', label: 'Getting Started', icon: Sparkles },
    { id: 'students', label: 'Student Management', icon: Users },
    { id: 'exams', label: 'Exams & Assessments', icon: FileText },
    { id: 'analytics', label: 'Analytics & Reports', icon: Target },
    { id: 'settings', label: 'Settings & Config', icon: Settings },
    { id: 'compliance', label: 'DPDP Compliance', icon: Shield },
  ] : [
    { id: 'getting-started', label: 'Getting Started', icon: Sparkles },
    { id: 'beneficiaries', label: 'Beneficiary Management', icon: Users },
    { id: 'programs', label: 'Program Management', icon: BookOpen },
    { id: 'impact', label: 'Impact Tracking', icon: Target },
    { id: 'compliance', label: 'DPDP Compliance', icon: Shield },
    { id: 'reports', label: 'Reports & Exports', icon: FileText },
  ];

  const helpContent: Record<string, { title: string; items: { question: string; answer: string }[] }> = {
    'getting-started': {
      title: 'Getting Started',
      items: [
        { question: 'How do I set up my organization?', answer: 'Navigate to Settings to update your organization profile, add team members, and configure preferences. Complete the Quick Start guide for a step-by-step walkthrough.' },
        { question: 'What are the first steps after login?', answer: 'Start by completing your profile, adding students/beneficiaries, creating batches or programs, and exploring the analytics dashboard.' },
        { question: 'How do I invite team members?', answer: 'Go to Settings > Team Management to invite administrators, teachers, or coordinators with role-based access control.' },
      ]
    },
    'students': {
      title: 'Student Management',
      items: [
        { question: 'How do I add students?', answer: 'Use the "Add Student" button to add individuals, or use CSV bulk import for large numbers. Ensure you have proper consent documentation.' },
        { question: 'How do I organize students into batches?', answer: 'Create batches first, then assign students. Students can be in multiple batches simultaneously.' },
        { question: 'What student data is collected?', answer: 'Basic identification, academic details, and optional behavioral assessment data with guardian consent per DPDP Act requirements.' },
      ]
    },
    'exams': {
      title: 'Exams & Assessments',
      items: [
        { question: 'How do I create an exam?', answer: 'Go to Exams section, click "Create Exam", add questions (manually or from question bank), set timing, and publish when ready.' },
        { question: 'What question types are supported?', answer: 'MCQ, True/False, Short Answer, and Essay types. Auto-grading is available for MCQ and True/False.' },
        { question: 'How does auto-generation work?', answer: 'Select curriculum filters (board, class, subject, chapter) and the system will randomly select questions matching your criteria.' },
      ]
    },
    'beneficiaries': {
      title: 'Beneficiary Management',
      items: [
        { question: 'How do I register beneficiaries?', answer: 'Use the Add Beneficiary form with guardian details. Consent is required for behavioral assessments.' },
        { question: 'How do I track individual progress?', answer: 'Click on any beneficiary to see their complete assessment history, improvement trends, and recommendations.' },
        { question: 'What data protection measures are in place?', answer: 'All data is encrypted, consent-tracked, and compliant with DPDP Act 2023. Export functions are audit-logged.' },
      ]
    },
    'programs': {
      title: 'Program Management',
      items: [
        { question: 'How do I create a new program?', answer: 'Go to Programs tab, click Create Program, define objectives, duration, target beneficiaries, and success metrics.' },
        { question: 'How do I assign beneficiaries to programs?', answer: 'From the program detail view, use the Enroll button to add beneficiaries individually or in bulk.' },
        { question: 'How do I measure program success?', answer: 'Define KPIs during program creation. The Impact Analytics tab provides automated tracking and visualization.' },
      ]
    },
    'analytics': {
      title: 'Analytics & Reports',
      items: [
        { question: 'What analytics are available?', answer: 'Performance trends, grade distribution, at-risk students, subject-wise analysis, and comparative reports.' },
        { question: 'How do I export reports?', answer: 'Use the Export button in any analytics view. Choose PDF for presentations or CSV for data analysis.' },
        { question: 'How often is data updated?', answer: 'Analytics refresh every 30 seconds when viewing. Historical data is updated daily.' },
      ]
    },
    'impact': {
      title: 'Impact Tracking',
      items: [
        { question: 'How is impact measured?', answer: 'Pre and post assessments, improvement rates, completion rates, and behavioral progress indicators.' },
        { question: 'Can I generate donor reports?', answer: 'Yes, the Impact Report generator creates professional PDF reports suitable for donors and stakeholders.' },
        { question: 'How do I track long-term outcomes?', answer: 'The system tracks beneficiaries through their entire journey, even after program completion.' },
      ]
    },
    'compliance': {
      title: 'DPDP Compliance',
      items: [
        { question: 'What is DPDP Act 2023?', answer: "India's Digital Personal Data Protection Act governs how children's data must be collected, stored, and processed with guardian consent." },
        { question: 'How is consent managed?', answer: 'All behavioral assessments require explicit guardian consent. Consent logs are maintained and auditable.' },
        { question: 'What data rights do guardians have?', answer: 'Guardians can view all data, request corrections, withdraw consent, and request data deletion at any time.' },
      ]
    },
    'settings': {
      title: 'Settings & Configuration',
      items: [
        { question: 'How do I update my institute profile?', answer: 'Go to Settings > Profile to update display name, contact information, and branding.' },
        { question: 'How do I manage user roles?', answer: 'Settings > Team allows you to assign Admin, Teacher, or Coordinator roles with specific permissions.' },
        { question: 'How do I configure notifications?', answer: 'Settings > Notifications lets you choose email, SMS, or in-app alerts for various events.' },
      ]
    },
    'reports': {
      title: 'Reports & Exports',
      items: [
        { question: 'What reports can I generate?', answer: 'Individual progress reports, program impact reports, compliance audit reports, and custom analytics exports.' },
        { question: 'Are exports DPDP compliant?', answer: 'Yes, all exports are logged, watermarked with user info, and respect data minimization principles.' },
        { question: 'Can I schedule automated reports?', answer: 'Yes, set up weekly or monthly automated reports sent to specified email addresses.' },
      ]
    },
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden p-0">
        <div className="flex h-[70vh]">
          <div className="w-64 bg-gray-50 border-r p-4 overflow-y-auto">
            <div className="mb-4">
              <h3 className="font-bold text-lg" style={{ color: brand.primary }}>Help Center</h3>
              <p className="text-xs text-gray-500">Find answers and guides</p>
            </div>
            <div className="space-y-1">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                    activeCategory === cat.id ? 'bg-white shadow-sm' : 'hover:bg-gray-100'
                  }`}
                  style={{ color: activeCategory === cat.id ? brand.primary : undefined }}
                  data-testid={`help-category-${cat.id}`}
                >
                  <cat.icon size={16} />
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t">
              <p className="text-xs font-medium text-gray-500 mb-2">Need more help?</p>
              <Button variant="outline" size="sm" className="w-full justify-start mb-2" data-testid="btn-contact-support">
                <MessageCircle size={14} className="mr-2" />
                Contact Support
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" data-testid="btn-video-tutorials">
                <Video size={14} className="mr-2" />
                Video Tutorials
              </Button>
            </div>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4" style={{ color: brand.primary }}>
              {helpContent[activeCategory]?.title || 'Help'}
            </h2>
            <div className="space-y-4">
              {helpContent[activeCategory]?.items.map((item, index) => (
                <FAQItem key={index} question={item.question} answer={item.answer} />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium text-sm" style={{ color: brand.primary }}>{question}</span>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-sm text-gray-600 animate-in slide-in-bg-top-2">
          {answer}
        </div>
      )}
    </div>
  );
}

interface FloatingHelpButtonProps {
  onClick: () => void;
  label?: string;
}

export function FloatingHelpButton({ onClick, label = 'Help' }: FloatingHelpButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg text-white z-50 animate-bounce hover:animate-none transition-all duration-300 hover:scale-105 hover:shadow-xl"
      style={{ backgroundColor: brand.accent }}
      data-testid="btn-floating-help"
    >
      <Sparkles size={20} className="animate-pulse" />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

interface SupportContactProps {
  variant?: 'compact' | 'full';
}

export function SupportContact({ variant = 'full' }: SupportContactProps) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50">
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-gray-400" />
          <span className="text-xs text-gray-600">support@metryxone.com</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-gray-400" />
          <span className="text-xs text-gray-600">1800-XXX-XXXX</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2" style={{ color: brand.primary }}>
          <MessageCircle size={18} style={{ color: brand.accent }} />
          Need Help?
        </CardTitle>
        <CardDescription>Our support team is here to assist you</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
          <div className="p-2 rounded-full" style={{ backgroundColor: `${brand.accent}15` }}>
            <Mail size={16} style={{ color: brand.accent }} />
          </div>
          <div>
            <p className="text-sm font-medium">Email Support</p>
            <p className="text-xs text-gray-500">support@metryxone.com</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
          <div className="p-2 rounded-full" style={{ backgroundColor: `${brand.accent}15` }}>
            <Phone size={16} style={{ color: brand.accent }} />
          </div>
          <div>
            <p className="text-sm font-medium">Phone Support</p>
            <p className="text-xs text-gray-500">1800-XXX-XXXX (Toll Free)</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
          <div className="p-2 rounded-full" style={{ backgroundColor: `${brand.accent}15` }}>
            <MessageCircle size={16} style={{ color: brand.accent }} />
          </div>
          <div>
            <p className="text-sm font-medium">Live Chat</p>
            <p className="text-xs text-gray-500">Available Mon-Sat, 9 AM - 6 PM IST</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  image?: string;
}

interface OnboardingWizardProps {
  steps: OnboardingStep[];
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingWizard({ steps, isOpen, onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  const step = steps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={() => onSkip()}>
      <DialogContent className="max-w-lg">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brand.accent}15` }}>
            <Sparkles size={32} style={{ color: brand.accent }} />
          </div>
          <DialogTitle className="text-xl mb-2" style={{ color: brand.primary }}>{step.title}</DialogTitle>
          <DialogDescription className="text-gray-600">{step.description}</DialogDescription>
        </div>
        <div className="flex items-center justify-center gap-2 my-4">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentStep ? 'w-6' : ''
              }`}
              style={{ backgroundColor: index === currentStep ? brand.accent : '#E5E7EB' }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between pt-4">
          <Button variant="ghost" onClick={onSkip} data-testid="btn-skip-onboarding">
            Skip Tour
          </Button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrev} data-testid="btn-prev-step">
                Previous
              </Button>
            )}
            <Button onClick={handleNext} style={{ backgroundColor: brand.accent }} data-testid="btn-next-step">
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface StatusIndicatorProps {
  status: 'active' | 'warning' | 'error' | 'info';
  message: string;
  action?: { label: string; onClick: () => void };
}

export function StatusIndicator({ status, message, action }: StatusIndicatorProps) {
  const statusConfig = {
    active: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', icon: CheckCircle },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: Info },
    error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: X },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: Info },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${config.bg} ${config.border}`}>
      <div className="flex items-center gap-2">
        <StatusIcon size={16} className={config.text} />
        <span className={`text-sm ${config.text}`}>{message}</span>
      </div>
      {action && (
        <Button variant="ghost" size="sm" onClick={action.onClick} className={config.text}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
