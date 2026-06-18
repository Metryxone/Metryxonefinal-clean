import { motion } from 'framer-motion';
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from '../App';
import {
  Shield, Eye, Lock, Database, UserCheck, Bell, Trash2,
  Globe, FileText, Mail, MapPin, Bot, Building2, GraduationCap,
  Baby, Share2, Server, RefreshCw, Cookie, FlaskConical, ExternalLink,
  MessageSquare, CheckCircle, Briefcase
} from 'lucide-react';

interface PrivacyPageProps {
  onNavigate: (screen: Screen) => void;
}

const EFFECTIVE_DATE = 'June 16, 2025';
const LAST_UPDATED = 'June 16, 2025';

const sections = [
  {
    number: '1',
    icon: FileText,
    title: 'Introduction',
    content: (
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        MetryxOne ("MetryxOne", "Company", "we", "our", or "us") is a Human Intelligence Cloud™ platform that
        provides behavioral intelligence, competency intelligence, employability intelligence, learning
        intelligence, career intelligence, workforce intelligence, talent intelligence, and related services
        to individuals, educational institutions, employers, government agencies, training providers, and
        other organizations.
        <br /><br />
        This Privacy Policy explains how we collect, use, process, store, disclose, and protect personal
        information when you access or use our website, applications, assessments, products, services,
        reports, analytics, and related offerings.
        <br /><br />
        This Privacy Policy is intended to comply with applicable Indian laws, including the Digital
        Personal Data Protection Act, 2023 ("DPDP Act").
      </p>
    ),
  },
  {
    number: '2',
    icon: MapPin,
    title: 'Data Fiduciary Details',
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
          <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Privacy Contact:</p>
          <a href="mailto:privacy@metryxone.com" style={{ color: 'var(--metryx-blue)' }}>
            privacy@metryxone.com
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
    icon: Database,
    title: 'Information We Collect',
    content: (
      <div className="space-y-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <SubSection title="Personal Information" items={[
          'Name', 'Email address', 'Mobile number', 'Date of birth', 'Gender', 'Location',
          'Educational information', 'Employment information', 'Professional information',
          'Skills and certifications', 'Career aspirations',
          'Profile photographs (if voluntarily uploaded)',
        ]} />
        <SubSection title="Assessment Information" intro="Information generated through CAPADEX™, Competency Assessments, Employability Intelligence, Learning Behavior Intelligence (LBI), Career Assessments, Leadership Assessments, Future Readiness Assessments, and Workforce Assessments — including:" items={[
          'Assessment responses', 'Scores', 'Competency profiles', 'Behavioral indicators',
          'Learning indicators', 'Career indicators', 'Recommendations', 'Development plans',
        ]} />
        <SubSection title="Candidate and Workforce Information" items={[
          'Resume information', 'Job applications', 'Interview records', 'Hiring status',
          'Career history', 'Workforce development records', 'Talent management records',
        ]} />
        <SubSection title="Technical Information" items={[
          'IP address', 'Device information', 'Browser information', 'Operating system',
          'Login information', 'Usage analytics', 'Cookies and similar technologies',
        ]} />
        <SubSection title="Payment Information" items={[
          'Payments are processed through Razorpay and other authorized payment providers.',
          'MetryxOne does not store complete card information.',
          "Payment processing is governed by the respective payment provider's privacy policies.",
        ]} />
      </div>
    ),
  },
  {
    number: '4',
    icon: Eye,
    title: 'Purposes of Processing',
    content: (
      <BulletList items={[
        'Deliver assessments and reports',
        'Generate intelligence insights',
        'Build competency profiles',
        'Calculate employability indicators',
        'Support learning and career development',
        'Enable talent intelligence services',
        'Facilitate recruitment and hiring',
        'Enable workforce intelligence and organizational analytics',
        'Improve products and services',
        'Conduct benchmarking and research',
        'Maintain security',
        'Meet legal obligations',
        'Provide customer support',
      ]} />
    ),
  },
  {
    number: '5',
    icon: Briefcase,
    title: 'Talent Intelligence and Analytics',
    content: (
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>MetryxOne may generate:</p>
        <BulletList items={[
          'Behavioral insights', 'Competency intelligence', 'Employability intelligence',
          'Learning intelligence', 'Career intelligence', 'Workforce intelligence',
          'Leadership readiness indicators', 'Succession indicators',
          'Development recommendations', 'Benchmarking insights',
        ]} />
        <p className="mt-3 p-3 rounded-lg text-xs" style={{ backgroundColor: 'rgba(31,60,136,0.06)', border: '1px solid rgba(31,60,136,0.12)' }}>
          These insights are intended to support decision-making and should not be considered the sole
          basis for educational, employment, promotion, disciplinary, or other significant decisions.
          Human judgment should always be applied.
        </p>
      </div>
    ),
  },
  {
    number: '6',
    icon: Bot,
    title: 'AI and Automated Processing',
    content: (
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>MetryxOne uses Artificial Intelligence, Machine Learning, Statistical Models, Knowledge Graphs, and Analytical Algorithms to generate recommendations, scores, rankings, forecasts, benchmarks, and intelligence outputs.</p>
        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>AI-generated outputs:</p>
        <BulletList items={[
          'May contain limitations',
          'Should be independently reviewed',
          'Are intended to support, not replace, human decision-making',
        ]} />
        <p className="text-xs italic mt-2" style={{ color: 'var(--text-muted)' }}>
          MetryxOne does not guarantee outcomes based on AI-generated insights.
        </p>
      </div>
    ),
  },
  {
    number: '7',
    icon: Building2,
    title: 'Employer Access to Candidate Data',
    content: (
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>Where candidates apply for jobs, join employer-sponsored programs, participate in recruitment processes, or consent to profile visibility, MetryxOne may share relevant profile information with authorized employers, including:</p>
        <BulletList items={[
          'Resume data', 'Assessment results', 'Competency profiles',
          'Employability indicators', 'Skills information', 'Career information',
        ]} />
        <p className="text-xs mt-2">Employers receive only information authorized by applicable permissions, platform settings, or candidate consent.</p>
      </div>
    ),
  },
  {
    number: '8',
    icon: GraduationCap,
    title: 'Educational Institutions and Student Data',
    content: (
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>MetryxOne provides services to schools, colleges, universities, and training institutions. Educational institutions may receive reports, analytics, benchmarks, and intelligence outputs related to participating learners.</p>
        <p>Student information is processed solely for educational, developmental, research, benchmarking, and institutional improvement purposes.</p>
      </div>
    ),
  },
  {
    number: '9',
    icon: Baby,
    title: 'Children and Minors',
    content: (
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>MetryxOne may provide services to users under the age of 18 through schools, educational institutions, parents, guardians, or authorized programs.</p>
        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Where required under applicable law:</p>
        <BulletList items={[
          'Parent or guardian consent will be obtained',
          'Institution-authorized processing will be used',
          'Additional safeguards will be implemented',
        ]} />
        <p className="text-xs mt-2">MetryxOne does not knowingly process children's data in violation of applicable laws.</p>
      </div>
    ),
  },
  {
    number: '10',
    icon: Share2,
    title: 'Information Sharing',
    content: (
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>We do not sell personal information.</p>
        <p>We may share information with:</p>
        <SubSection title="Educational Institutions" items={['For educational and developmental purposes.']} />
        <SubSection title="Employers" items={['For recruitment, hiring, workforce development, and talent management purposes.']} />
        <SubSection title="Service Providers" items={[
          'Google Cloud', 'Analytics providers', 'Communication providers',
          'Security providers', 'Payment providers',
        ]} />
        <SubSection title="Legal Authorities" items={['Where required by law or regulatory obligations.']} />
      </div>
    ),
  },
  {
    number: '11',
    icon: Lock,
    title: 'Data Security',
    content: (
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>MetryxOne uses industry-standard security measures including:</p>
        <BulletList items={[
          'Encryption in transit',
          'Access controls',
          'Role-based permissions',
          'Audit logging',
          'Security monitoring',
          'Vulnerability management',
          'Authentication controls',
        ]} />
        <p className="text-xs italic mt-2" style={{ color: 'var(--text-muted)' }}>
          While we strive to protect information, no system can guarantee absolute security.
        </p>
      </div>
    ),
  },
  {
    number: '12',
    icon: Server,
    title: 'Data Storage',
    content: (
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Information may be stored using infrastructure hosted on Google Cloud and related technology
        providers. Data may be processed in locations permitted under applicable law and contractual
        safeguards.
      </p>
    ),
  },
  {
    number: '13',
    icon: Trash2,
    title: 'Data Retention',
    content: (
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>Information is retained only as long as necessary to:</p>
        <BulletList items={[
          'Deliver services', 'Maintain assessment histories',
          'Support longitudinal intelligence', 'Meet legal obligations',
          'Resolve disputes', 'Enforce agreements',
        ]} />
        <p className="mt-2">Retention periods may vary depending on user type, assessment type, regulatory requirements, and customer agreements.</p>
      </div>
    ),
  },
  {
    number: '14',
    icon: UserCheck,
    title: 'User Rights',
    content: (
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>Subject to applicable laws, users may have rights to:</p>
        <BulletList items={[
          'Access information', 'Correct information', 'Update information',
          'Withdraw consent', 'Request deletion where legally permissible',
          'Request grievance resolution',
        ]} />
        <p className="mt-2">Requests may be submitted to:{' '}
          <a href="mailto:privacy@metryxone.com" style={{ color: 'var(--metryx-blue)' }}>
            privacy@metryxone.com
          </a>
        </p>
      </div>
    ),
  },
  {
    number: '15',
    icon: Bell,
    title: 'Withdrawal of Consent',
    content: (
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>Users may withdraw consent where processing is based on consent.</p>
        <p>Withdrawal of consent may impact access to certain services and functionality.</p>
        <p>Withdrawal does not affect processing that occurred before withdrawal.</p>
      </div>
    ),
  },
  {
    number: '16',
    icon: Cookie,
    title: 'Cookies',
    content: (
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>MetryxOne uses:</p>
        <SubSection title="Essential Cookies" items={['Required for platform functionality.']} />
        <SubSection title="Performance Cookies" items={['Used to improve service quality.']} />
        <SubSection title="Analytics Cookies" items={['Used to understand platform usage.']} />
        <SubSection title="Preference Cookies" items={['Used to remember user settings.']} />
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Users may control cookies through browser settings.
        </p>
      </div>
    ),
  },
  {
    number: '17',
    icon: FlaskConical,
    title: 'Research and Benchmarking',
    content: (
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>MetryxOne may use anonymized, aggregated, or de-identified information for:</p>
        <BulletList items={[
          'Research', 'Benchmarking', 'Product improvement',
          'Industry reports', 'Workforce analytics', 'Educational analytics',
        ]} />
        <p className="text-xs mt-2 italic" style={{ color: 'var(--text-muted)' }}>
          Such information will not directly identify individuals.
        </p>
      </div>
    ),
  },
  {
    number: '18',
    icon: ExternalLink,
    title: 'Third-Party Links',
    content: (
      <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>Our services may contain links to third-party websites and services.</p>
        <p>MetryxOne is not responsible for third-party privacy practices.</p>
        <p>Users should review applicable third-party policies.</p>
      </div>
    ),
  },
  {
    number: '19',
    icon: MessageSquare,
    title: 'Grievance Redressal',
    content: (
      <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>Questions, complaints, requests, or concerns regarding personal information may be directed to:</p>
        <div className="p-4 rounded-xl mt-2" style={{ backgroundColor: 'rgba(31,60,136,0.05)', border: '1px solid rgba(31,60,136,0.1)' }}>
          <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Privacy Officer</p>
          <p>Email:{' '}
            <a href="mailto:privacy@metryxone.com" style={{ color: 'var(--metryx-blue)' }}>
              privacy@metryxone.com
            </a>
          </p>
          <p className="mt-2">
            4th Floor, Bizness Square,<br />
            Junction, Hitech City Road,<br />
            Opposite Hitex Road,<br />
            Jubilee Enclave,<br />
            HITEC City, Hyderabad,<br />
            Telangana – 500081, India
          </p>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          We will make reasonable efforts to respond within timelines prescribed by applicable law.
        </p>
      </div>
    ),
  },
  {
    number: '20',
    icon: RefreshCw,
    title: 'Policy Updates',
    content: (
      <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p>We may update this Privacy Policy from time to time.</p>
        <p>Material changes will be communicated through the website, platform, email, or other appropriate channels.</p>
        <p>Continued use of services following updates constitutes acceptance of the revised Privacy Policy.</p>
      </div>
    ),
  },
  {
    number: '21',
    icon: CheckCircle,
    title: 'Consent',
    content: (
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        By using MetryxOne services, assessments, applications, websites, and related offerings, you
        acknowledge that you have read, understood, and agreed to this Privacy Policy and the data
        processing practices described herein.
      </p>
    ),
  },
];

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

function SubSection({ title, intro, items }: { title: string; intro?: string; items: string[] }) {
  return (
    <div>
      <p className="font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {intro && <p className="mb-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{intro}</p>}
      <BulletList items={items} />
    </div>
  );
}

export function PrivacyPage({ onNavigate }: PrivacyPageProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="privacy" />

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
              <Shield size={32} style={{ color: 'var(--metryx-blue)' }} />
            </div>
            <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Privacy Policy
            </h1>
            <p className="text-base" style={{ color: 'var(--text-muted)' }}>
              MetryxOne Human Intelligence Cloud™
            </p>
            <div className="flex justify-center gap-6 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span><span className="font-medium">Effective Date:</span> {EFFECTIVE_DATE}</span>
              <span><span className="font-medium">Last Updated:</span> {LAST_UPDATED}</span>
            </div>
          </motion.div>

          {/* DPDP badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex flex-wrap gap-3 justify-center mb-10"
          >
            {[
              { icon: FileText, label: 'DPDP Act 2023 Compliant' },
              { icon: Lock,     label: 'Encrypted in Transit' },
              { icon: Shield,   label: 'Role-Based Access Control' },
              { icon: Globe,    label: 'India Data Residency' },
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
                  href={`#section-${s.number}`}
                  className="flex items-center gap-2 py-1 text-sm hover:underline"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="text-xs font-mono w-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{s.number}.</span>
                  {s.title}
                </a>
              ))}
            </div>
          </motion.div>

          {/* Policy Sections */}
          <div className="space-y-5">
            {sections.map((section, idx) => (
              <motion.div
                key={section.number}
                id={`section-${section.number}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + idx * 0.03 }}
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
            transition={{ delay: 0.7 }}
            className="mt-10 p-8 rounded-2xl text-center"
            style={{ backgroundColor: 'rgba(31, 60, 136, 0.05)', border: '1px solid rgba(31, 60, 136, 0.12)' }}
          >
            <Shield size={28} className="mx-auto mb-3" style={{ color: 'var(--metryx-blue)' }} />
            <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
              MetryxOne Human Intelligence Cloud™
            </p>
            <p className="text-sm italic mb-5" style={{ color: 'var(--text-muted)' }}>
              Making Human Potential Visible.
            </p>
            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
              Privacy Officer:{' '}
              <a href="mailto:privacy@metryxone.com" style={{ color: 'var(--metryx-blue)' }}>
                privacy@metryxone.com
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
