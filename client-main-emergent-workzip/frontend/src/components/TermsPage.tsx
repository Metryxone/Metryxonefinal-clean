import { motion } from 'framer-motion';
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from '../App';
import { FileText, Users, BookOpen, AlertTriangle, Scale, CreditCard, RefreshCw, Ban, Gavel, Mail } from 'lucide-react';

interface TermsPageProps {
  onNavigate: (screen: Screen) => void;
}

const sections = [
  {
    icon: Users,
    title: "1. Acceptance of Terms",
    content: `By accessing or using MetryxOne's platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services. These terms apply to all users including students, parents, guardians, and educational institutions.`
  },
  {
    icon: BookOpen,
    title: "2. Educational Use Only",
    content: `MetryxOne is designed exclusively for educational purposes. Our platform provides academic assessment tools, behavioral insights through Learning Behavior Index (LBI), and learning analytics. The platform should not be used for any commercial purposes outside of educational contexts. Users must be affiliated with educational institutions or be parents/guardians of students.`
  },
  {
    icon: AlertTriangle,
    title: "3. User Responsibilities",
    content: `Users are responsible for maintaining the confidentiality of their account credentials. You agree to: (a) provide accurate and complete information during registration, (b) update your information to keep it current, (c) not share your account with others, (d) notify us immediately of any unauthorized access, (e) comply with all applicable laws and regulations.`
  },
  {
    icon: Scale,
    title: "4. Intellectual Property",
    content: `All content, features, and functionality on MetryxOne including but not limited to text, graphics, logos, icons, images, audio clips, digital downloads, data compilations, and software are the exclusive property of MetryxOne and are protected by copyright, trademark, and other intellectual property laws. The LBI assessment methodology and ExamReadiness Index™ framework are proprietary technologies.`
  },
  {
    icon: CreditCard,
    title: "5. Payment Terms",
    content: `Certain features require paid subscriptions. By subscribing, you agree to pay all applicable fees. Payments are processed securely through Razorpay. All fees are non-refundable except as expressly stated in our refund policy. We reserve the right to change pricing with 30 days' notice. Educational institutions may be eligible for custom pricing plans.`
  },
  {
    icon: RefreshCw,
    title: "6. Subscription & Cancellation",
    content: `Subscriptions automatically renew unless cancelled before the renewal date. You may cancel your subscription at any time through your account settings. Upon cancellation, you will retain access until the end of your current billing period. Some data may be retained as per our data retention policy even after cancellation.`
  },
  {
    icon: Ban,
    title: "7. Prohibited Activities",
    content: `Users may not: (a) use the platform for any unlawful purpose, (b) attempt to gain unauthorized access to any portion of the platform, (c) transmit viruses or malicious code, (d) collect user data without consent, (e) impersonate another person or entity, (f) interfere with the proper functioning of the platform, (g) share assessment content or answers outside the platform.`
  },
  {
    icon: Gavel,
    title: "8. Limitation of Liability",
    content: `MetryxOne provides educational insights and recommendations but does not guarantee specific academic outcomes. Our behavioral assessments are tools for understanding, not clinical diagnoses. To the maximum extent permitted by law, MetryxOne shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform.`
  }
];

export function TermsPage({ onNavigate }: TermsPageProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-secondary)" }}>
      <Navbar onNavigate={onNavigate} currentScreen="terms" />
      
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
              <FileText size={32} style={{ color: "var(--metryx-blue)" }} />
            </div>
            <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
              Terms of Service
            </h1>
            <p className="text-lg" style={{ color: "var(--text-muted)" }}>
              Please read these terms carefully before using MetryxOne.
            </p>
            <p className="text-sm mt-4" style={{ color: "var(--text-muted)" }}>
              Effective Date: January 2026
            </p>
          </motion.div>

          {/* Sections */}
          <div className="space-y-6">
            {sections.map((section, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                className="p-6 rounded-2xl"
                style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-subtle)" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "rgba(46, 196, 182, 0.1)" }}
                  >
                    <section.icon size={20} style={{ color: "var(--accent-cyan)" }} />
                  </div>
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                    {section.title}
                  </h2>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {section.content}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Governing Law */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 p-6 rounded-2xl"
            style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-subtle)" }}
          >
            <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              9. Governing Law
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              These Terms shall be governed by and construed in accordance with the laws of India. 
              Any disputes arising under these terms shall be subject to the exclusive jurisdiction of the courts in Bangalore, Karnataka.
              These terms are compliant with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023.
            </p>
          </motion.div>

          {/* Contact Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mt-8 p-6 rounded-2xl text-center"
            style={{ backgroundColor: "rgba(31, 60, 136, 0.05)", border: "1px solid rgba(31, 60, 136, 0.1)" }}
          >
            <Mail size={24} className="mx-auto mb-3" style={{ color: "var(--metryx-blue)" }} />
            <h3 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Questions About These Terms?
            </h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Contact our legal team at{' '}
              <a href="mailto:legal@metryxone.com" style={{ color: "var(--metryx-blue)" }}>
                legal@metryxone.com
              </a>
            </p>
          </motion.div>
        </div>
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
