import { useState, useEffect } from 'react';
import { X, Brain, GraduationCap, Users, Briefcase, BookOpen, Shield, ChevronRight } from 'lucide-react';

interface AssessmentBODProps {
  onNavigate: (screen: string, params?: Record<string, unknown>) => void;
  onClose?: () => void;
}

const PROFILES = [
  {
    id: 'student',
    label: 'Student',
    sub: 'Learning Readiness',
    icon: GraduationCap,
    screen: 'start-assessment',
    params: { assessmentType: 'lbi', role: 'student' },
  },
  {
    id: 'teacher',
    label: 'Teacher / Educator',
    sub: 'Classroom Engagement',
    icon: BookOpen,
    screen: 'start-assessment',
    params: { assessmentType: 'lbi', role: 'teacher' },
  },
  {
    id: 'campus',
    label: 'Campus Student',
    sub: 'Employability Check',
    icon: Users,
    screen: 'start-assessment',
    params: { assessmentType: 'competency', role: 'campus' },
  },
  {
    id: 'jobseeker',
    label: 'Job Seeker',
    sub: 'Role Fitment Assessment',
    icon: Briefcase,
    screen: 'start-assessment',
    params: { assessmentType: 'competency', role: 'jobseeker' },
  },
];

const ANIM_TERMS = ['competency', 'learning style', 'memory style', 'focus pattern', 'processing style', 'cognitive strengths', 'behavioural profile'];

export function AssessmentBOD({ onNavigate, onClose }: AssessmentBODProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [termIdx, setTermIdx] = useState(0);
  const [termVisible, setTermVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setTermVisible(false);
      setTimeout(() => {
        setTermIdx(i => (i + 1) % ANIM_TERMS.length);
        setTermVisible(true);
      }, 350);
    }, 2400);
    return () => clearInterval(iv);
  }, []);

  const handleBegin = () => {
    if (!selected) return;
    const profile = PROFILES.find((p) => p.id === selected);
    if (!profile) return;
    handleClose();
    onNavigate(profile.screen, profile.params);
  };

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50"
      style={{ width: 380 }}
      data-testid="assessment-bod"
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: '#fff',
          boxShadow: '0 8px 40px rgba(11,60,93,0.14), 0 2px 10px rgba(0,0,0,0.06)',
          border: '1px solid rgba(226,232,240,0.8)',
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(78,205,196,0.12)' }}
              >
                <Brain size={18} style={{ color: '#4ECDC4' }} />
              </div>
              <div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 400, color: '#0B3C5D', lineHeight: 1.35, margin: 0 }}>
                  Know your{' '}
                  <span style={{
                    color: '#2EC4B6',
                    display: 'inline-block',
                    transition: 'opacity 0.35s ease, transform 0.35s ease',
                    opacity: termVisible ? 1 : 0,
                    transform: termVisible ? 'translateY(0)' : 'translateY(-5px)',
                  }}>
                    {ANIM_TERMS[termIdx]}
                  </span>
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8', fontFamily: "'Inter', sans-serif" }}>
                  2 min · 10 questions · instant report
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
              style={{ color: '#94A3B8' }}
              data-testid="btn-bod-close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold tracking-[0.12em] mb-3" style={{ color: '#94A3B8', fontFamily: "'Inter', sans-serif" }}>
            I AM A…
          </p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {PROFILES.map((p) => {
              const isSelected = selected === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-left transition-all duration-200"
                  style={{
                    border: isSelected ? '1.5px solid #4ECDC4' : '1.5px solid #E2E8F0',
                    backgroundColor: isSelected ? 'rgba(78,205,196,0.06)' : '#FAFAFA',
                  }}
                  data-testid={`bod-profile-${p.id}`}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: isSelected ? 'rgba(78,205,196,0.15)' : '#F1F5F9' }}
                  >
                    <p.icon size={14} style={{ color: isSelected ? '#4ECDC4' : '#64748B' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-normal leading-tight" style={{ color: isSelected ? '#1E293B' : '#374151', fontFamily: "'Inter', sans-serif" }}>
                      {p.label}
                    </p>
                    <p className="text-[10px] leading-tight mt-0.5" style={{ color: '#94A3B8', fontFamily: "'Inter', sans-serif" }}>
                      {p.sub}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Privacy note */}
          <div className="flex items-center gap-1.5 mb-4">
            <Shield size={10} style={{ color: '#94A3B8' }} />
            <p className="text-[10px]" style={{ color: '#94A3B8', fontFamily: "'Inter', sans-serif", lineHeight: 1.4 }}>
              Your responses are private and used only to generate your personalised report.
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={handleBegin}
            disabled={!selected}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              backgroundColor: selected ? '#4ECDC4' : '#E2E8F0',
              color: selected ? '#fff' : '#94A3B8',
              fontFamily: "'Inter', sans-serif",
              cursor: selected ? 'pointer' : 'not-allowed',
            }}
            data-testid="btn-bod-begin"
          >
            Select your profile to begin
            {selected && <ChevronRight size={15} />}
          </button>
        </div>

        {/* Footer stats */}
        <div
          className="flex items-center justify-center gap-4 px-5 py-3"
          style={{ borderTop: '1px solid #F1F5F9', backgroundColor: '#FAFAFA' }}
        >
          <span className="text-[10.5px]" style={{ color: '#64748B', fontFamily: "'Inter', sans-serif" }}>
            <strong style={{ color: '#0B3C5D' }}>12,400+</strong> assessments taken
          </span>
          <span style={{ color: '#E2E8F0' }}>·</span>
          <span className="text-[10.5px]" style={{ color: '#64748B', fontFamily: "'Inter', sans-serif" }}>
            <strong style={{ color: '#0B3C5D' }}>4.8/5</strong> participant rating
          </span>
        </div>
      </div>
    </div>
  );
}
