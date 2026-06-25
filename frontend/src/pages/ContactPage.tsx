import { BRAND } from '@/design-system/tokens';
import {
  Mail, Phone, MapPin, Clock, Send,
  ArrowRight, CheckCircle, MessageSquare,
  Users, Building2, Globe, Shield, Star,
  ChevronRight, Zap, Calendar, HeadphonesIcon
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Screen } from "../App";

interface Props {
  onNavigate: (screen: Screen) => void;
}



const CONTACT_REASONS = [
  'Product Demo Request',
  'Pricing & Plans',
  'Technical Support',
  'Partnership Inquiry',
  'Research Collaboration',
  'Media & Press',
];

export function ContactPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="contact" />

      <main className="flex-1 pt-20">
        <section className="relative py-14 md:py-20 px-4 overflow-hidden" style={{ backgroundColor: BRAND.primary }} data-testid="contact-hero-section">
          <div className="absolute inset-0 opacity-[0.05]">
            <div className="absolute top-12 left-[8%] w-48 h-48 rounded-full border border-white" />
            <div className="absolute bottom-12 right-[6%] w-72 h-72 rounded-full border border-white" />
          </div>
          <div className="max-w-6xl mx-auto relative">
            <div className="max-w-3xl">
              <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1.5 font-medium mb-5" data-testid="badge-contact-resource">
                <Mail size={12} className="mr-1" /> Get in Touch
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight tracking-tight text-white" data-testid="text-contact-title">
                Contact Us
              </h1>
              <p className="text-base font-medium mb-2 text-white/90" data-testid="text-contact-subtitle">
                We're Here to Help — Average Response Under 4 Hours
              </p>
              <p className="text-sm text-white/65 max-w-lg leading-relaxed" data-testid="text-contact-desc">
                Whether you have a question about our platform, need a product demo, or want to explore a partnership — our team is ready to help.
              </p>
            </div>
          </div>
        </section>

        <section className="py-10 px-4" data-testid="contact-stats-strip">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Clock, value: '< 4hr', label: 'Avg response time' },
                { icon: Star, value: '4.9/5', label: 'Support satisfaction' },
                { icon: Globe, value: '10+', label: 'Languages supported' },
                { icon: HeadphonesIcon, value: 'Mon-Sat', label: '9am - 7pm IST' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: `${BRAND.primary}04` }} data-testid={`contact-stat-${i}`}>
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}12` }}>
                    <item.icon size={18} style={{ color: BRAND.accent }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold" style={{ color: BRAND.primary }}>{item.value}</p>
                    <p className="text-[11px] leading-tight" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 px-4" data-testid="contact-form-section">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-10">
              <div className="lg:col-span-3">
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }} data-testid="badge-contact-form">
                  Send a Message
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-6" style={{ color: BRAND.primary }} data-testid="text-contact-form-title">
                  How Can We Help?
                </h2>
                <Card className="border-0 shadow-md" data-testid="contact-form-card">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--text-primary)' }}>First Name</label>
                          <input
                            type="text" placeholder="Your first name"
                            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2"
                            style={{ borderColor: `${BRAND.primary}15` }}
                            data-testid="input-contact-first-name"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--text-primary)' }}>Last Name</label>
                          <input
                            type="text" placeholder="Your last name"
                            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2"
                            style={{ borderColor: `${BRAND.primary}15` }}
                            data-testid="input-contact-last-name"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--text-primary)' }}>Email</label>
                        <input
                          type="email" placeholder="you@company.com"
                          className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2"
                          style={{ borderColor: `${BRAND.primary}15` }}
                          data-testid="input-contact-email"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--text-primary)' }}>Organization</label>
                        <input
                          type="text" placeholder="Your school, institute, or company"
                          className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2"
                          style={{ borderColor: `${BRAND.primary}15` }}
                          data-testid="input-contact-org"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--text-primary)' }}>I'm reaching out about</label>
                        <select
                          className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2"
                          style={{ borderColor: `${BRAND.primary}15`, color: 'var(--text-primary)' }}
                          data-testid="select-contact-reason"
                        >
                          <option value="">Select a topic</option>
                          {CONTACT_REASONS.map((reason) => (
                            <option key={reason} value={reason}>{reason}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--text-primary)' }}>Message</label>
                        <textarea
                          rows={4} placeholder="Tell us how we can help..."
                          className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 resize-none"
                          style={{ borderColor: `${BRAND.primary}15` }}
                          data-testid="textarea-contact-message"
                        />
                      </div>
                      <Button
                        className="w-full h-10 font-medium text-sm rounded-lg text-white"
                        style={{ backgroundColor: BRAND.accent }}
                        data-testid="btn-contact-submit"
                      >
                        <Send size={15} className="mr-1.5" /> Send Message
                      </Button>
                      <p className="text-[10px] text-center" style={{ color: 'var(--text-secondary)' }}>
                        By submitting, you agree to our Privacy Policy. We'll respond within 4 hours during business hours.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2 space-y-5">
                <div>
                  <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }} data-testid="badge-contact-channels">
                    Other Ways to Reach Us
                  </Badge>
                </div>

                <Card className="border-0 shadow-sm hover:shadow-md transition-all" data-testid="contact-email-card">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}12` }}>
                        <Mail size={18} style={{ color: BRAND.accent }} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>Email</h4>
                        <p className="text-xs mb-1" style={{ color: BRAND.accent }}>support@metryxone.com</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>For general inquiries and support requests</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm hover:shadow-md transition-all" data-testid="contact-sales-card">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}10` }}>
                        <Building2 size={18} style={{ color: BRAND.primary }} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>Sales & Partnerships</h4>
                        <p className="text-xs mb-1" style={{ color: BRAND.primary }}>sales@metryxone.com</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>For demos, pricing, and institutional partnerships</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm hover:shadow-md transition-all" data-testid="contact-phone-card">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}12` }}>
                        <Phone size={18} style={{ color: BRAND.accent }} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>Phone</h4>
                        <p className="text-xs mb-1" style={{ color: BRAND.accent }}>+91 (800) METRYX-1</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Mon-Sat, 9:00 AM - 7:00 PM IST</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm hover:shadow-md transition-all" data-testid="contact-office-card">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}10` }}>
                        <MapPin size={18} style={{ color: BRAND.primary }} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>Head Office</h4>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          MetryxOne Technologies Pvt Ltd<br />
                          Cyber City, DLF Phase 2<br />
                          Gurugram, Haryana 122002, India
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md overflow-hidden" data-testid="contact-response-guarantee">
                  <div className="h-1" style={{ backgroundColor: BRAND.accent }} />
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.accent}12` }}>
                        <Zap size={18} style={{ color: BRAND.accent }} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold" style={{ color: BRAND.primary }}>Response Guarantee</h4>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          We respond to all inquiries within <span className="font-bold" style={{ color: BRAND.accent }}>4 hours</span> during business hours
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="contact-cta-section">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight" data-testid="text-contact-cta">
              Prefer a <span style={{ color: BRAND.accent }}>Live Demo</span>?
            </h2>
            <p className="text-white/65 text-sm mb-8 max-w-lg mx-auto leading-relaxed" data-testid="text-contact-cta-desc">
              Schedule a personalized walkthrough of MetryxOne with our product team. See how behavioral intelligence can transform your organization.
            </p>
            <Button
              className="h-10 px-8 font-medium text-sm rounded-lg text-white"
              style={{ backgroundColor: BRAND.accent }}
              onClick={() => onNavigate('request-demo')}
              data-testid="btn-contact-cta-demo"
            >
              <Calendar size={15} className="mr-1.5" /> Schedule a Demo <ArrowRight size={15} className="ml-1.5" />
            </Button>
          </div>
        </section>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
