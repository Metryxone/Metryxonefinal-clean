import { motion } from 'framer-motion';
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from '../App';
import {
  FileText, Users, CheckSquare, Layers, KeyRound, Ban, ClipboardList,
  Bot, GraduationCap, Building2, CreditCard, Scale, FolderOpen, Shield,
  Puzzle, AlertTriangle, TrendingDown, Handshake, XCircle, CloudLightning,
  Globe, MessageSquare, RefreshCw, Mail, ScrollText
} from 'lucide-react';

interface TermsPageProps {
  onNavigate: (screen: Screen) => void;
}

const EFFECTIVE_DATE = 'June 16, 2025';
const LAST_UPDATED   = 'June 16, 2025';

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-cyan)' }}>•</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </p>
  );
}

const sections = [
  {
    number: '1',
    icon: FileText,
    title: 'Introduction',
    content: (
      <div className="space-y-2">
        <Para>
          Welcome to MetryxOne ("MetryxOne", "Company", "we", "our", or "us").
        </Para>
        <Para>
          These Terms of Service ("Terms") govern your access to and use of MetryxOne websites,
          applications, assessments, reports, products, software, platforms, APIs, analytics,
          intelligence services, and related offerings (collectively, the "Services").
        </Para>
        <Para>
          By accessing, registering for, purchasing, or using the Services, you agree to be bound
          by these Terms.
        </Para>
        <p className="text-sm font-medium mt-2" style={{ color: 'var(--text-primary)' }}>
          If you do not agree to these Terms, you must not access or use the Services.
        </p>
      </div>
    ),
  },
  {
    number: '2',
    icon: Mail,
    title: 'Company Details',
    content: (
      <div className="text-sm leading-relaxed space-y-3" style={{ color: 'var(--text-secondary)' }}>
        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>MetryxOne</p>
        <div>
          <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Address:</p>
          <p>4th Floor, Bizness Square,<br />
          Junction, Hitech City Road,<br />
          Opposite Hitex Road,<br />
          Jubilee Enclave,<br />
          HITEC City, Hyderabad,<br />
          Telangana – 500081, India</p>
        </div>
        <div>
          <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Contact:</p>
          <a href="mailto:support@metryxone.com" style={{ color: 'var(--metryx-blue)' }}>
            support@metryxone.com
          </a>
        </div>
        <div>
          <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Website:</p>
          <a href="https://www.metryxone.com" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--metryx-blue)' }}>
            www.metryxone.com
          </a>
        </div>
      </div>
    ),
  },
  {
    number: '3',
    icon: CheckSquare,
    title: 'Eligibility',
    content: (
      <div className="space-y-2">
        <Para>You may use the Services only if:</Para>
        <BulletList items={[
          'You are legally capable of entering into a binding agreement.',
          'You comply with applicable laws.',
          'Any information provided is accurate and current.',
          'If you are under the age required by law, your parent, guardian, school, or authorized institution has provided necessary authorization.',
        ]} />
      </div>
    ),
  },
  {
    number: '4',
    icon: Layers,
    title: 'Services',
    content: (
      <div className="space-y-3">
        <Para>MetryxOne provides services including but not limited to:</Para>
        <BulletList items={[
          'CAPADEX™', 'Competency Intelligence™', 'Employability Intelligence™',
          'Learning Behavior Intelligence™', 'Career Builder™', 'Talent Passport™',
          'Employer Intelligence OS™', 'Workforce Intelligence', 'Talent Intelligence',
          'Assessment Services', 'Analytics and Reporting Services',
          'AI-Powered Intelligence Services',
        ]} />
        <p className="text-xs italic mt-1" style={{ color: 'var(--text-muted)' }}>
          Features may be modified, enhanced, suspended, or discontinued at our discretion.
        </p>
      </div>
    ),
  },
  {
    number: '5',
    icon: KeyRound,
    title: 'Account Registration',
    content: (
      <div className="space-y-2">
        <Para>Users may be required to create an account. You agree to:</Para>
        <BulletList items={[
          'Provide accurate information.',
          'Maintain the confidentiality of credentials.',
          'Notify us of unauthorized access.',
          'Accept responsibility for activities occurring under your account.',
        ]} />
        <Para>We may suspend or terminate accounts that violate these Terms.</Para>
      </div>
    ),
  },
  {
    number: '6',
    icon: Ban,
    title: 'Acceptable Use',
    content: (
      <div className="space-y-2">
        <Para>You agree not to:</Para>
        <BulletList items={[
          'Use the Services unlawfully.',
          'Upload harmful, misleading, fraudulent, or illegal content.',
          'Reverse engineer the platform.',
          'Attempt unauthorized access.',
          'Interfere with system operations.',
          'Use automated scraping tools without authorization.',
          'Circumvent subscription, licensing, or access controls.',
          'Introduce malware or malicious code.',
        ]} />
      </div>
    ),
  },
  {
    number: '7',
    icon: ClipboardList,
    title: 'Assessments and Intelligence Services',
    content: (
      <div className="space-y-3">
        <Para>
          MetryxOne provides assessments, analytics, intelligence outputs, recommendations,
          forecasts, and reports. You acknowledge that:
        </Para>
        <BulletList items={[
          'Assessments are informational tools.',
          'Intelligence outputs are decision-support tools.',
          'Results are probabilistic and not guarantees.',
          'Outcomes may vary.',
          'Human judgment should always be exercised.',
        ]} />
        <div className="mt-3 p-3 rounded-lg text-xs" style={{ backgroundColor: 'rgba(31,60,136,0.06)', border: '1px solid rgba(31,60,136,0.12)' }}>
          Assessment results, scores, recommendations, forecasts, benchmarks, and intelligence
          outputs should not be treated as the sole basis for educational, employment, promotion,
          admission, disciplinary, investment, or other significant decisions.
        </div>
      </div>
    ),
  },
  {
    number: '8',
    icon: Bot,
    title: 'AI and Automated Analytics',
    content: (
      <div className="space-y-3">
        <Para>MetryxOne may use Artificial Intelligence, Machine Learning, Statistical Models, Knowledge Graphs, and Automated Analytics to generate recommendations, scores, rankings, forecasts, and intelligence outputs.</Para>
        <Para>Users acknowledge that:</Para>
        <BulletList items={[
          'AI-generated outputs may contain inaccuracies.',
          'Recommendations are not guarantees.',
          'Automated outputs require independent review.',
          'MetryxOne does not guarantee any outcome resulting from reliance on AI-generated insights.',
        ]} />
      </div>
    ),
  },
  {
    number: '9',
    icon: GraduationCap,
    title: 'Educational Services',
    content: (
      <div className="space-y-2">
        <Para>
          Where Services are used by schools, colleges, universities, training institutions, or
          educational organizations:
        </Para>
        <BulletList items={[
          'Institutions are responsible for obtaining required permissions.',
          'Institutions remain responsible for educational decisions.',
          'MetryxOne provides informational and developmental support tools only.',
        ]} />
      </div>
    ),
  },
  {
    number: '10',
    icon: Building2,
    title: 'Employer Services',
    content: (
      <div className="space-y-2">
        <Para>
          Employer Intelligence OS™ and related services provide hiring, workforce, competency,
          succession, talent, and organizational intelligence. Employers acknowledge:
        </Para>
        <BulletList items={[
          'Assessments should not be used as the sole basis for employment decisions.',
          'Human review remains necessary.',
          'MetryxOne is not responsible for employment decisions made by employers.',
        ]} />
      </div>
    ),
  },
  {
    number: '11',
    icon: CreditCard,
    title: 'Subscriptions and Payments',
    content: (
      <div className="space-y-2">
        <Para>Certain Services require payment. Payments may be processed through authorized providers including Razorpay.</Para>
        <Para>Fees:</Para>
        <BulletList items={[
          'Are payable in advance unless otherwise agreed.',
          'May be subject to applicable taxes.',
          'May be non-refundable except where required by law.',
        ]} />
        <Para>We reserve the right to change pricing upon notice.</Para>
      </div>
    ),
  },
  {
    number: '12',
    icon: Scale,
    title: 'Intellectual Property',
    content: (
      <div className="space-y-2">
        <Para>All rights in the Services are owned by MetryxOne or its licensors. This includes:</Para>
        <BulletList items={[
          'Software', 'Assessments', 'Reports', 'Methodologies', 'Algorithms',
          'Competency frameworks', 'Databases', 'Content', 'Designs',
          'Trademarks', 'Logos', 'Documentation',
        ]} />
        <Para>No ownership rights are transferred to users.</Para>
      </div>
    ),
  },
  {
    number: '13',
    icon: FolderOpen,
    title: 'User Content',
    content: (
      <div className="space-y-2">
        <Para>Users retain ownership of content they submit.</Para>
        <Para>
          By submitting content, users grant MetryxOne a worldwide, non-exclusive license to use,
          process, store, display, and analyze such content for the purpose of providing Services.
        </Para>
        <Para>Users warrant that they have the necessary rights to provide such content.</Para>
      </div>
    ),
  },
  {
    number: '14',
    icon: Shield,
    title: 'Privacy',
    content: (
      <Para>
        Use of the Services is subject to the MetryxOne Privacy Policy. By using the Services, you
        acknowledge and agree to the collection and processing practices described therein.
      </Para>
    ),
  },
  {
    number: '15',
    icon: Puzzle,
    title: 'Third-Party Services',
    content: (
      <div className="space-y-2">
        <Para>The Services may integrate with:</Para>
        <BulletList items={[
          'Educational systems', 'HR systems', 'Applicant Tracking Systems',
          'Communication platforms', 'Payment providers', 'Cloud providers',
          'Third-party applications',
        ]} />
        <Para>MetryxOne is not responsible for third-party services.</Para>
      </div>
    ),
  },
  {
    number: '16',
    icon: AlertTriangle,
    title: 'Disclaimers',
    content: (
      <div className="space-y-3">
        <div className="px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide" style={{ backgroundColor: 'rgba(255,166,0,0.08)', color: '#b45309', border: '1px solid rgba(255,166,0,0.2)' }}>
          The Services are provided on an "as is" and "as available" basis.
        </div>
        <Para>To the maximum extent permitted by law, MetryxOne disclaims all warranties including merchantability, fitness for a particular purpose, non-infringement, accuracy of results, and uninterrupted availability.</Para>
        <Para>We do not guarantee:</Para>
        <BulletList items={[
          'Employment outcomes', 'Educational outcomes', 'Career outcomes',
          'Promotion outcomes', 'Business outcomes', 'Assessment outcomes',
        ]} />
      </div>
    ),
  },
  {
    number: '17',
    icon: TrendingDown,
    title: 'Limitation of Liability',
    content: (
      <div className="space-y-2">
        <Para>To the maximum extent permitted by law, MetryxOne shall not be liable for:</Para>
        <BulletList items={[
          'Indirect damages', 'Consequential damages', 'Special damages', 'Incidental damages',
          'Loss of profits', 'Loss of revenue', 'Loss of opportunities',
          'Business interruption', 'Reputational damage',
        ]} />
        <div className="mt-3 p-3 rounded-lg text-xs" style={{ backgroundColor: 'rgba(31,60,136,0.06)', border: '1px solid rgba(31,60,136,0.12)' }}>
          Our total liability shall not exceed the amount paid by the user for the relevant Services
          during the preceding twelve (12) months.
        </div>
      </div>
    ),
  },
  {
    number: '18',
    icon: Handshake,
    title: 'Indemnification',
    content: (
      <div className="space-y-2">
        <Para>
          You agree to indemnify and hold harmless MetryxOne, its directors, officers, employees,
          affiliates, partners, and agents from claims arising from:
        </Para>
        <BulletList items={[
          'Violation of these Terms',
          'Misuse of the Services',
          'Violation of laws',
          'Violation of third-party rights',
        ]} />
      </div>
    ),
  },
  {
    number: '19',
    icon: XCircle,
    title: 'Suspension and Termination',
    content: (
      <div className="space-y-2">
        <Para>We may suspend or terminate access where:</Para>
        <BulletList items={[
          'Terms are violated',
          'Fraud is suspected',
          'Security risks exist',
          'Legal obligations require action',
        ]} />
        <Para>Termination does not affect accrued rights or obligations.</Para>
      </div>
    ),
  },
  {
    number: '20',
    icon: CloudLightning,
    title: 'Force Majeure',
    content: (
      <div className="space-y-2">
        <Para>
          MetryxOne shall not be liable for delays or failures caused by events beyond reasonable
          control, including:
        </Para>
        <BulletList items={[
          'Natural disasters', 'Government actions', 'Network failures',
          'Cyber incidents', 'Power outages', 'Pandemics', 'Labor disputes',
        ]} />
      </div>
    ),
  },
  {
    number: '21',
    icon: Globe,
    title: 'Governing Law',
    content: (
      <Para>
        These Terms shall be governed by and construed in accordance with the laws of India.
      </Para>
    ),
  },
  {
    number: '22',
    icon: MessageSquare,
    title: 'Dispute Resolution',
    content: (
      <div className="space-y-2">
        <Para>
          Any dispute arising from these Terms shall first be addressed through good-faith
          negotiations.
        </Para>
        <Para>
          If unresolved, disputes shall be subject to the exclusive jurisdiction of the courts
          located in Hyderabad, Telangana, India.
        </Para>
      </div>
    ),
  },
  {
    number: '23',
    icon: RefreshCw,
    title: 'Changes to Terms',
    content: (
      <div className="space-y-2">
        <Para>MetryxOne may modify these Terms at any time.</Para>
        <Para>
          Material changes may be communicated through the website, platform, email, or other
          appropriate channels.
        </Para>
        <Para>
          Continued use of the Services following updates constitutes acceptance of revised Terms.
        </Para>
      </div>
    ),
  },
  {
    number: '24',
    icon: Mail,
    title: 'Contact',
    content: (
      <div className="space-y-2">
        <Para>For questions regarding these Terms:</Para>
        <div className="p-4 rounded-xl mt-1" style={{ backgroundColor: 'rgba(31,60,136,0.05)', border: '1px solid rgba(31,60,136,0.1)' }}>
          <p className="font-semibold mb-2 text-sm" style={{ color: 'var(--text-primary)' }}>MetryxOne</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            4th Floor, Bizness Square,<br />
            Junction, Hitech City Road,<br />
            Opposite Hitex Road,<br />
            Jubilee Enclave,<br />
            HITEC City, Hyderabad,<br />
            Telangana – 500081, India
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            Email:{' '}
            <a href="mailto:support@metryxone.com" style={{ color: 'var(--metryx-blue)' }}>
              support@metryxone.com
            </a>
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Website:{' '}
            <a href="https://www.metryxone.com" target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--metryx-blue)' }}>
              www.metryxone.com
            </a>
          </p>
        </div>
      </div>
    ),
  },
  {
    number: '25',
    icon: ScrollText,
    title: 'Entire Agreement',
    content: (
      <Para>
        These Terms, together with the Privacy Policy and any additional agreements expressly
        incorporated by reference, constitute the entire agreement between you and MetryxOne
        regarding the Services.
      </Para>
    ),
  },
];

export function TermsPage({ onNavigate }: TermsPageProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="terms" />

      <div className="pt-24 pb-20 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
              style={{ backgroundColor: 'rgba(31, 60, 136, 0.1)' }}
            >
              <FileText size={32} style={{ color: 'var(--metryx-blue)' }} />
            </div>
            <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Terms of Service
            </h1>
            <p className="text-base" style={{ color: 'var(--text-muted)' }}>
              MetryxOne Human Intelligence Cloud™
            </p>
            <div className="flex justify-center gap-6 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span><span className="font-medium">Effective Date:</span> {EFFECTIVE_DATE}</span>
              <span><span className="font-medium">Last Updated:</span> {LAST_UPDATED}</span>
            </div>
          </motion.div>

          {/* Jurisdiction badges */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex flex-wrap gap-3 justify-center mb-10"
          >
            {[
              { icon: Globe,        label: 'Governed by Laws of India' },
              { icon: Scale,        label: 'Jurisdiction: Hyderabad, Telangana' },
              { icon: Shield,       label: 'DPDP Act 2023 Compliant' },
              { icon: ScrollText,   label: 'IT Act 2000 Compliant' },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: 'rgba(46,196,182,0.1)', color: 'var(--accent-cyan)', border: '1px solid rgba(46,196,182,0.2)' }}
              >
                <Icon size={12} />
                {label}
              </span>
            ))}
          </motion.div>

          {/* Table of Contents */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl mb-8"
            style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
              Table of Contents
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
              {sections.map(s => (
                <a
                  key={s.number}
                  href={`#tos-${s.number}`}
                  className="flex items-center gap-2 py-1 text-sm hover:underline"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="text-xs font-mono w-6 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{s.number}.</span>
                  {s.title}
                </a>
              ))}
            </div>
          </motion.div>

          {/* Sections */}
          <div className="space-y-5">
            {sections.map((section, idx) => (
              <motion.div
                key={section.number}
                id={`tos-${section.number}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + idx * 0.025 }}
                className="p-6 rounded-2xl scroll-mt-28"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(46, 196, 182, 0.1)' }}
                  >
                    <section.icon size={18} style={{ color: 'var(--accent-cyan)' }} />
                  </div>
                  <div>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      §{section.number}
                    </span>
                    <h2 className="text-base font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {section.title}
                    </h2>
                  </div>
                </div>
                <div className="pl-[52px]">
                  {section.content}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Footer card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-10 p-8 rounded-2xl text-center"
            style={{ backgroundColor: 'rgba(31, 60, 136, 0.05)', border: '1px solid rgba(31, 60, 136, 0.12)' }}
          >
            <FileText size={28} className="mx-auto mb-3" style={{ color: 'var(--metryx-blue)' }} />
            <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
              MetryxOne Human Intelligence Cloud™
            </p>
            <p className="text-sm italic mb-5" style={{ color: 'var(--text-muted)' }}>
              Making Human Potential Visible.
            </p>
            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
              Questions about these Terms?{' '}
              <a href="mailto:support@metryxone.com" style={{ color: 'var(--metryx-blue)' }}>
                support@metryxone.com
              </a>
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              4th Floor, Bizness Square, HITEC City, Hyderabad, Telangana – 500081, India
            </p>
          </motion.div>

        </div>
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
