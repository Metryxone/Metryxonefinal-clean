import { motion } from 'framer-motion';
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from '../App';
import { Shield, Eye, Lock, Database, UserCheck, Bell, Trash2, Globe, FileText, Mail } from 'lucide-react';

interface PrivacyPageProps {
  onNavigate: (screen: Screen) => void;
}

const sections = [
  {
    icon: Database,
    title: "Information We Collect",
    content: [
      "Personal identification information (name, email, phone number)",
      "Academic records and assessment results",
      "Behavioral assessment data through Learning Behavior Index (LBI)",
      "Device information and usage analytics",
      "Login credentials and session data"
    ]
  },
  {
    icon: Eye,
    title: "How We Use Your Information",
    content: [
      "Provide personalized learning insights and recommendations",
      "Generate behavioral and academic reports",
      "Improve our platform and services",
      "Communicate important updates and notifications",
      "Ensure platform security and prevent fraud"
    ]
  },
  {
    icon: Lock,
    title: "Data Protection",
    content: [
      "256-bit SSL encryption for all data transmission",
      "Secure cloud storage with industry-standard protocols",
      "Regular security audits and vulnerability assessments",
      "Role-based access control for data management",
      "Encrypted storage of sensitive personal information"
    ]
  },
  {
    icon: UserCheck,
    title: "DPDP Act Compliance",
    content: [
      "Full compliance with Digital Personal Data Protection Act, 2023",
      "Explicit consent required for minor's data processing",
      "Parental/guardian consent for students under 18",
      "Right to access, correct, and delete personal data",
      "Data processing limited to specified purposes only"
    ]
  },
  {
    icon: Bell,
    title: "Your Rights",
    content: [
      "Access your personal data at any time",
      "Request correction of inaccurate information",
      "Withdraw consent for data processing",
      "Request deletion of your data (subject to legal requirements)",
      "Receive data in a portable format"
    ]
  },
  {
    icon: Trash2,
    title: "Data Retention",
    content: [
      "Academic data retained for duration of enrollment plus 3 years",
      "Behavioral insights retained for 6 months post-assessment",
      "Account data deleted within 90 days of account closure",
      "Anonymized data may be retained for research purposes",
      "Legal compliance data retained as per statutory requirements"
    ]
  }
];

export function PrivacyPage({ onNavigate }: PrivacyPageProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-secondary)" }}>
      <Navbar onNavigate={onNavigate} currentScreen="privacy" />
      
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
              <Shield size={32} style={{ color: "var(--metryx-blue)" }} />
            </div>
            <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
              Privacy Policy
            </h1>
            <p className="text-lg" style={{ color: "var(--text-muted)" }}>
              Your privacy matters. Here's how MetryxOne protects your data.
            </p>
            <p className="text-sm mt-4" style={{ color: "var(--text-muted)" }}>
              Last updated: January 2026
            </p>
          </motion.div>

          {/* Introduction */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl mb-8"
            style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-subtle)" }}
          >
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}>
              MetryxOne ("we", "our", or "us") is committed to protecting the privacy of students, parents, and educational institutions. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our unified education 
              and behavioral intelligence platform. We are fully compliant with the Digital Personal Data Protection Act (DPDP Act), 2023 of India.
            </p>
          </motion.div>

          {/* Sections */}
          <div className="space-y-6">
            {sections.map((section, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + idx * 0.05 }}
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
                <ul className="space-y-2 pl-4">
                  {section.content.map((item, itemIdx) => (
                    <li 
                      key={itemIdx}
                      className="text-sm flex items-start gap-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <span style={{ color: "var(--accent-cyan)" }}>•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          {/* Contact Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 p-6 rounded-2xl text-center"
            style={{ backgroundColor: "rgba(31, 60, 136, 0.05)", border: "1px solid rgba(31, 60, 136, 0.1)" }}
          >
            <Globe size={24} className="mx-auto mb-3" style={{ color: "var(--metryx-blue)" }} />
            <h3 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Questions About Privacy?
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Contact our Data Protection Officer at{' '}
              <a href="mailto:privacy@metryxone.com" style={{ color: "var(--metryx-blue)" }}>
                privacy@metryxone.com
              </a>
            </p>
            <div className="flex justify-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1">
                <FileText size={12} />
                DPDP Act Compliant
              </span>
              <span className="flex items-center gap-1">
                <Lock size={12} />
                256-bit SSL
              </span>
              <span className="flex items-center gap-1">
                <Shield size={12} />
                ISO 27001
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
