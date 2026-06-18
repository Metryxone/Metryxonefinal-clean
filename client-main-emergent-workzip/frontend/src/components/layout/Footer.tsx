import { Twitter, Linkedin, Youtube, Mail, Phone, MapPin, ArrowRight, Heart, GraduationCap, Building2, Star, Clock, Shield, BadgeCheck, Flag, Facebook, Instagram, Map, Sparkles, ChevronRight } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import logoTransparent from "@/assets/metryx-logo-transparent.png";
import logoTransparentDark from "@/assets/metryx-logo-transparent-dark.png";
import { Screen } from "../../App";

interface FooterProps {
  onNavigate?: (screen: Screen) => void;
}

const NAV = [
  {
    key: "intelligence",
    title: "intelligence",
    links: [
      { label: "LBI™ — behavioral profiling", slug: "lbi" },
      { label: "ExamReadiness Index™", slug: "exam-ready" },
      { label: "Competency Intelligence Platform™", slug: "competency" },
      { label: "MetryxAI assistant", slug: "metryx-ai" },
      { label: "analytics dashboard", slug: "analytics" },
    ],
  },
  {
    key: "solutions",
    title: "solutions",
    links: [
      { label: "for schools & coaching", slug: "schools" },
      { label: "for campuses & placement", slug: "campus" },
      { label: "for enterprise & HR", slug: "enterprise" },
      { label: "for government & skilling", slug: "government" },
      { label: "mentor marketplace", slug: "mentor-marketplace", highlight: true },
    ],
  },
  {
    key: "learn",
    title: "learn",
    links: [
      { label: "how it works", slug: "how-it-works" },
      { label: "case studies", slug: "case-studies" },
      { label: "research papers", slug: "research" },
      { label: "blog & insights", slug: "blog" },
      { label: "help center", slug: "help" },
    ],
  },
  {
    key: "company",
    title: "company",
    links: [
      { label: "about MetryxOne", slug: "about" },
      { label: "leadership", slug: "leadership" },
      { label: "careers", slug: "careers", highlight: true },
      { label: "press & media", slug: "press" },
      { label: "contact us", slug: "contact" },
    ],
  },
  {
    key: "legal",
    title: "legal",
    links: [
      { label: "privacy policy", slug: "privacy" },
      { label: "terms of service", slug: "terms" },
      { label: "DPDP compliance", slug: "dpdp" },
      { label: "child safety", slug: "child-safety" },
      { label: "cookie policy", slug: "cookies" },
    ],
  },
];

const STATS = [
  { value: "50,000+", label: "individuals assessed", Icon: GraduationCap },
  { value: "500+",    label: "schools & institutes", Icon: Building2 },
  { value: "4.9 / 5", label: "platform rating",     Icon: Star },
  { value: "93%",     label: "predictive accuracy",  Icon: Sparkles },
  { value: "< 4 h",  label: "support response",     Icon: Clock },
];

const BADGES = [
  { Icon: Shield,    label: "DPDP compliant" },
  { Icon: BadgeCheck, label: "ISO 27001" },
  { Icon: Flag,      label: "made in India" },
];

const SOCIALS = [
  { Icon: Linkedin,  href: "#", label: "LinkedIn" },
  { Icon: Twitter,   href: "#", label: "Twitter / X" },
  { Icon: Facebook,  href: "#", label: "Facebook" },
  { Icon: Instagram, href: "#", label: "Instagram" },
  { Icon: Youtube,   href: "#", label: "YouTube" },
];

export function Footer({ onNavigate }: FooterProps) {
  const { theme } = useTheme();

  return (
    <footer
      className="border-t"
      style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border-subtle)" }}
      data-testid="footer-root"
    >
      {/* ── Main grid ── */}
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="py-10 grid grid-cols-1 lg:grid-cols-7 gap-8 lg:gap-10">

          {/* Brand column — spans 2 */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <button onClick={() => onNavigate?.("landing")} className="self-start" data-testid="footer-logo">
              <img
                src={theme === 'dark' ? logoTransparentDark : logoTransparent}
                alt="MetryxOne"
                className="h-7 w-auto"
              />
            </button>

            <p
              className="text-[12px] leading-relaxed"
              style={{ color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif", maxWidth: 240 }}
            >
              Behavioral intelligence that turns learning potential into measurable performance — for students, schools, campuses, and enterprises.
            </p>

            {/* Social icons */}
            <div className="flex gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105"
                  style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)" }}
                  aria-label={s.label}
                  data-testid={`social-${s.label.split(" ")[0].toLowerCase()}`}
                >
                  <s.Icon size={13} />
                </a>
              ))}
            </div>

            {/* Contact */}
            <div className="space-y-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              <div className="flex items-center gap-2">
                <Mail size={11} />
                <span>hello@metryxone.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={11} />
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={11} />
                <span>Bangalore, India</span>
              </div>
            </div>

            {/* Newsletter — tucked into brand col on desktop */}
            <div
              className="rounded-xl p-3.5 mt-1"
              style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-subtle)" }}
            >
              <p className="text-[11px] font-medium mb-0.5" style={{ color: "var(--text-primary)" }}>
                stay informed on education intelligence
              </p>
              <p className="text-[10px] mb-2.5" style={{ color: "var(--text-muted)" }}>
                weekly insights on learning & behavioral science.
              </p>
              <div className="flex gap-1.5">
                <input
                  type="email"
                  placeholder="your email"
                  aria-label="Email address for newsletter subscription"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md text-[11px]"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-primary)",
                    fontFamily: "'Inter', sans-serif",
                  }}
                  data-testid="input-newsletter-email"
                />
                <button
                  className="px-3 py-1.5 rounded-md text-[11px] font-medium shrink-0 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--accent-cyan)", color: "#fff", fontFamily: "'Inter', sans-serif" }}
                  data-testid="button-newsletter-subscribe"
                >
                  subscribe
                </button>
              </div>
            </div>
          </div>

          {/* Nav columns — spans 5 */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            {NAV.map((section) => (
              <div key={section.key} data-testid={`footer-section-${section.key}`}>
                <h4
                  className="text-[10px] font-semibold mb-3 pb-1.5 border-b"
                  style={{
                    color: "var(--accent-cyan)",
                    letterSpacing: "0.04em",
                    fontFamily: "'Inter', sans-serif",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  {section.title}
                </h4>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.slug}>
                      <a
                        href="#"
                        className="text-[11px] leading-snug transition-colors hover:text-[var(--accent-cyan)] flex items-start gap-1 group"
                        style={{
                          color: link.highlight ? "var(--accent-cyan)" : "var(--text-muted)",
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: link.highlight ? 500 : 400,
                        }}
                        data-testid={`footer-link-${link.slug}`}
                      >
                        {link.highlight && (
                          <ChevronRight size={10} className="mt-0.5 shrink-0 opacity-70" />
                        )}
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── Join our team banner ── */}
        <div className="pb-5">
          <div
            className="rounded-xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ background: "var(--metryx-blue)" }}
          >
            <div className="text-center sm:text-left">
              <p className="text-white font-medium text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>
                join our team
              </p>
              <p className="text-white/70 text-xs mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
                we're hiring engineers, researchers, and educators passionate about learning science.
              </p>
            </div>
            <button
              className="px-5 py-2 bg-white rounded-lg text-xs font-semibold hover:bg-white/90 transition-colors flex items-center gap-1.5 shrink-0"
              style={{ color: "var(--metryx-blue)", fontFamily: "'Inter', sans-serif" }}
              data-testid="footer-careers-cta"
            >
              view positions <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="py-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {STATS.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-center" data-testid={`footer-stat-${s.label.replace(/\s/g, "-")}`}>
                <s.Icon size={14} style={{ color: "var(--accent-cyan)" }} />
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>
                    {s.value}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Trust badges ── */}
        <div className="py-3 border-t flex flex-wrap justify-center gap-2.5" style={{ borderColor: "var(--border-subtle)" }}>
          {BADGES.map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-subtle)" }}
            >
              <b.Icon size={11} style={{ color: "var(--accent-cyan)" }} />
              <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif" }}>
                {b.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div
          className="py-4 border-t flex flex-col md:flex-row justify-between items-center gap-2 text-[10px]"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}
        >
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} MetryxOne™. all rights reserved.</span>
            <button
              onClick={() => onNavigate?.("site-map")}
              className="opacity-0 hover:opacity-20 transition-opacity duration-300 cursor-default"
              data-testid="btn-site-map-footer"
              tabIndex={-1}
              aria-hidden="true"
            >
              <Map size={10} style={{ color: "var(--text-muted)" }} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span>made with</span>
            <Heart size={9} style={{ color: "var(--accent-cyan)" }} />
            <span>in India</span>
          </div>

          <div className="flex gap-4">
            {[
              { label: "privacy", slug: "privacy" },
              { label: "terms", slug: "terms" },
              { label: "security", slug: "security" },
            ].map((l) => (
              <a
                key={l.slug}
                href="#"
                className="transition-colors hover:text-[var(--accent-cyan)]"
                data-testid={`link-footer-${l.slug}`}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
