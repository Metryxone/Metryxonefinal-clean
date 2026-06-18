/**
 * ParentMentorServices — AI-powered mentor recommendation, booking, calling,
 * post-session feedback, and academic-year planning hub for parents.
 *
 * DPDP Act 2023 compliant: parental consent recorded before every video session
 * involving a minor child.
 */
import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Star, Sparkles, Video, Calendar, Clock, User, BookOpen, Brain,
  ChevronRight, ChevronDown, ChevronUp, Shield, CheckCircle, AlertCircle,
  Phone, MessageSquare, Download, ThumbsUp, Award, Target, TrendingUp,
  X, Copy, Check, Globe, MapPin, Zap, Heart, RefreshCw, Eye, Filter,
  CalendarDays, Bell, Info, ArrowRight, Play, Mic, FileText,
  GraduationCap, BarChart3, Users, Lock, Layers, RotateCcw, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { VideoCallRoom } from './video/VideoCallRoom';
import { DPDPConsentModal } from './video/DPDPConsentModal';

import mentor1 from '@/assets/images/mentor1.png';
import mentor2 from '@/assets/images/mentor2.png';
import mentor3 from '@/assets/images/mentor3.png';
import mentor4 from '@/assets/images/mentor4.png';
import mentor5 from '@/assets/images/mentor5.png';
import mentor6 from '@/assets/images/mentor6.png';
import mentor7 from '@/assets/images/mentor7.png';
import mentor8 from '@/assets/images/mentor8.png';

const BRAND = { primary: '#0B3C5D', accent: '#4ECDC4' };

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChildProfile {
  id?: string;
  name?: string;
  grade?: string;
  educationBoard?: string;
  lbiConsent?: boolean;
  age?: number;
  school?: string;
}

interface MentorProfile {
  id: string;
  name: string;
  photo: string;
  title: string;
  subjects: string[];
  behaviorDomains: string[];
  rating: number;
  reviews: number;
  experience: string;
  ratePerHr: number;
  mode: 'online' | 'both';
  city: string;
  languages: string[];
  bio: string;
  aiMatch: number;
  nextSlot: string;
  badges: string[];
  totalSessions: number;
  successRate: number;
  prelimFree: boolean;
  specialization: string;
  calendarSlots: CalendarSlot[];
}

interface CalendarSlot {
  date: string;       // ISO date
  label: string;      // human-readable
  times: string[];    // HH:MM strings
}

export interface BookedSession {
  id: string;
  mentor: MentorProfile;
  stage: SessionStage;
  sessionType: string;
  scheduledDate: string;
  scheduledTime: string;
  roomId: string;
  inviteUrl: string;
  status: 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
  childName: string;
  dpdpConsented: boolean;
  feedback?: SessionFeedback;
}

interface SessionFeedback {
  overallRating: number;
  academicRating: number;
  engagementRating: number;
  communicationRating: number;
  comment: string;
  wouldRecommend: boolean;
  submittedAt: string;
}

type SessionStage = 'preliminary' | 'deep-dive' | 'ongoing';
type ViewMode = 'recommendations' | 'browse' | 'my-sessions';
type BookingStep = 'stage' | 'format' | 'calendar' | 'dpdp' | 'confirm' | 'success';

// ─── Mentor data ──────────────────────────────────────────────────────────────

const ALL_MENTORS: MentorProfile[] = [
  {
    id: 'm1', name: 'Dr. Priya Sharma', photo: mentor1,
    title: 'Senior Mathematics & Physics Educator',
    subjects: ['Mathematics', 'Physics', 'Chemistry'],
    behaviorDomains: ['Logical Reasoning', 'Numerical Intelligence', 'Analytical Thinking'],
    rating: 4.9, reviews: 134, experience: '14 years', ratePerHr: 1800,
    mode: 'online', city: 'Mumbai', languages: ['English', 'Hindi', 'Marathi'],
    bio: 'IIT-Bombay alumna with a PhD in Applied Mathematics. Specialises in JEE/NEET conceptual clarity and making complex topics intuitive through visual learning.',
    aiMatch: 97, nextSlot: 'Today 4:00 PM',
    badges: ['Top Rated', 'JEE Expert', 'NEET Specialist', 'Verified'],
    totalSessions: 1240, successRate: 94, prelimFree: true,
    specialization: 'JEE · NEET · Class XI–XII',
    calendarSlots: [
      { date: new Date().toISOString().split('T')[0], label: 'Today', times: ['16:00', '18:00', '20:00'] },
      { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], label: 'Tomorrow', times: ['09:00', '11:00', '15:00', '17:00'] },
      { date: new Date(Date.now() + 172800000).toISOString().split('T')[0], label: 'Day after', times: ['10:00', '14:00', '16:00'] },
    ],
  },
  {
    id: 'm2', name: 'Rahul Mehta', photo: mentor2,
    title: 'Behavioral Intelligence & Study Skills Coach',
    subjects: ['Study Skills', 'Focus Training', 'Exam Strategy'],
    behaviorDomains: ['Emotional Intelligence', 'Stress Management', 'Self-Regulation', 'Executive Functioning'],
    rating: 4.8, reviews: 98, experience: '9 years', ratePerHr: 1500,
    mode: 'online', city: 'Delhi', languages: ['English', 'Hindi'],
    bio: 'Certified LBI practitioner and behavioral coach. Helps children build metacognitive skills, manage exam stress, and develop consistent study habits through evidence-based interventions.',
    aiMatch: 93, nextSlot: 'Tomorrow 11:00 AM',
    badges: ['LBI Specialist', 'Burnout Coach', 'Verified'],
    totalSessions: 860, successRate: 91, prelimFree: true,
    specialization: 'Behavior · Study Skills · Stress',
    calendarSlots: [
      { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], label: 'Tomorrow', times: ['11:00', '14:00', '16:00'] },
      { date: new Date(Date.now() + 172800000).toISOString().split('T')[0], label: 'Day after', times: ['09:00', '13:00', '17:00'] },
    ],
  },
  {
    id: 'm3', name: 'Dr. Ananya Krishnan', photo: mentor3,
    title: 'Child Psychologist & Academic Counsellor',
    subjects: ['Psychology', 'Academic Planning', 'Career Guidance'],
    behaviorDomains: ['Emotional Wellness', 'Learning Patterns', 'Motivation', 'Social Intelligence'],
    rating: 4.9, reviews: 211, experience: '16 years', ratePerHr: 2200,
    mode: 'both', city: 'Bengaluru', languages: ['English', 'Tamil', 'Kannada'],
    bio: 'M.Phil Clinical Psychology with 16 years working with school-going children. Integrates cognitive-behavioral techniques with academic goal setting to drive holistic growth.',
    aiMatch: 89, nextSlot: 'Tomorrow 3:00 PM',
    badges: ['Child Psychologist', 'Top Counsellor', 'Verified'],
    totalSessions: 2100, successRate: 96, prelimFree: false,
    specialization: 'Counselling · Wellness · Career',
    calendarSlots: [
      { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], label: 'Tomorrow', times: ['15:00', '17:00'] },
      { date: new Date(Date.now() + 172800000).toISOString().split('T')[0], label: 'Day after', times: ['10:00', '12:00', '15:00'] },
      { date: new Date(Date.now() + 259200000).toISOString().split('T')[0], label: 'In 3 days', times: ['11:00', '14:00', '16:00'] },
    ],
  },
  {
    id: 'm4', name: 'Kavya Nair', photo: mentor4,
    title: 'English & Social Science Specialist',
    subjects: ['English', 'History', 'Social Science', 'Political Science'],
    behaviorDomains: ['Language Processing', 'Creative Thinking', 'Communication'],
    rating: 4.7, reviews: 76, experience: '8 years', ratePerHr: 1200,
    mode: 'online', city: 'Kochi', languages: ['English', 'Malayalam', 'Hindi'],
    bio: 'Post-graduate in English Literature from JNU. Makes language arts engaging through storytelling, Socratic discussions, and real-world context. Expertise in CBSE and ICSE boards.',
    aiMatch: 85, nextSlot: 'Today 6:00 PM',
    badges: ['English Expert', 'CBSE Specialist', 'Verified'],
    totalSessions: 540, successRate: 89, prelimFree: true,
    specialization: 'English · Humanities · CBSE/ICSE',
    calendarSlots: [
      { date: new Date().toISOString().split('T')[0], label: 'Today', times: ['18:00', '19:30'] },
      { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], label: 'Tomorrow', times: ['10:00', '14:00', '16:00', '18:00'] },
    ],
  },
  {
    id: 'm5', name: 'Arjun Verma', photo: mentor5,
    title: 'Science & Biology Tutor',
    subjects: ['Biology', 'Chemistry', 'Environmental Science'],
    behaviorDomains: ['Scientific Reasoning', 'Observational Skills', 'Curiosity'],
    rating: 4.6, reviews: 54, experience: '6 years', ratePerHr: 1100,
    mode: 'online', city: 'Hyderabad', languages: ['English', 'Hindi', 'Telugu'],
    bio: 'B.Sc Biotechnology, pursuing PhD. Passionate about making life sciences fascinating for students from Class VI to XII. Specialises in NEET Biology and board exams.',
    aiMatch: 82, nextSlot: 'Day after tomorrow',
    badges: ['NEET Bio Expert', 'Verified'],
    totalSessions: 310, successRate: 86, prelimFree: true,
    specialization: 'Biology · Chemistry · NEET',
    calendarSlots: [
      { date: new Date(Date.now() + 172800000).toISOString().split('T')[0], label: 'Day after', times: ['10:00', '12:00', '15:00', '17:00'] },
    ],
  },
  {
    id: 'm6', name: 'Sanjana Patel', photo: mentor6,
    title: 'Test Prep & Planner Coach',
    subjects: ['Mathematics', 'Test Strategy', 'Time Management'],
    behaviorDomains: ['Goal Setting', 'Planning Intelligence', 'Performance Consistency'],
    rating: 4.8, reviews: 103, experience: '10 years', ratePerHr: 1600,
    mode: 'both', city: 'Ahmedabad', languages: ['English', 'Hindi', 'Gujarati'],
    bio: 'Expert in full-year academic planning across CBSE, IGCSE, and competitive exam calendars. Helps families build robust study roadmaps with measurable milestones.',
    aiMatch: 91, nextSlot: 'Tomorrow 9:00 AM',
    badges: ['Planner Expert', 'Top Rated', 'Verified'],
    totalSessions: 920, successRate: 93, prelimFree: false,
    specialization: 'Annual Planning · Test Prep · Milestones',
    calendarSlots: [
      { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], label: 'Tomorrow', times: ['09:00', '11:00', '13:00'] },
      { date: new Date(Date.now() + 172800000).toISOString().split('T')[0], label: 'Day after', times: ['10:00', '14:00'] },
    ],
  },
  {
    id: 'm7', name: 'Dr. Vikram Bose', photo: mentor7,
    title: 'IIT/IIM Alumni · Senior Career Counsellor',
    subjects: ['Career Planning', 'College Admissions', 'Stream Selection'],
    behaviorDomains: ['Decision Making', 'Leadership Potential', 'Entrepreneurial Thinking'],
    rating: 4.9, reviews: 189, experience: '18 years', ratePerHr: 2500,
    mode: 'online', city: 'Pune', languages: ['English', 'Hindi', 'Bengali'],
    bio: 'IIT Kharagpur + IIM Calcutta. Counselled 3,000+ students across JEE, CAT, UPSC, and international admissions. Known for data-driven, family-involved planning.',
    aiMatch: 78, nextSlot: 'In 3 days',
    badges: ['IIT/IIM Alumni', 'Career Expert', 'Premium', 'Verified'],
    totalSessions: 3200, successRate: 97, prelimFree: false,
    specialization: 'Career · College · Stream Selection',
    calendarSlots: [
      { date: new Date(Date.now() + 259200000).toISOString().split('T')[0], label: 'In 3 days', times: ['11:00', '14:00', '16:00'] },
    ],
  },
  {
    id: 'm8', name: 'Meera Iyer', photo: mentor8,
    title: 'Holistic Learning & Mindfulness Coach',
    subjects: ['Mindfulness', 'Concentration', 'Emotional Balance', 'Learning Habits'],
    behaviorDomains: ['Mindfulness', 'Intrinsic Motivation', 'Resilience', 'Emotional Regulation'],
    rating: 4.8, reviews: 67, experience: '7 years', ratePerHr: 1300,
    mode: 'online', city: 'Chennai', languages: ['English', 'Tamil'],
    bio: 'Certified mindfulness teacher and neuro-education specialist. Works with children to build concentration, reduce screen addiction, and develop positive learning identities.',
    aiMatch: 87, nextSlot: 'Tomorrow 7:00 PM',
    badges: ['Mindfulness Expert', 'Neuro-Education', 'Verified'],
    totalSessions: 420, successRate: 90, prelimFree: true,
    specialization: 'Mindfulness · Habits · Focus',
    calendarSlots: [
      { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], label: 'Tomorrow', times: ['19:00', '20:30'] },
      { date: new Date(Date.now() + 172800000).toISOString().split('T')[0], label: 'Day after', times: ['09:00', '10:30', '19:00'] },
    ],
  },
];

const SESSION_STAGES = [
  {
    id: 'preliminary' as SessionStage,
    label: 'Preliminary Counselling',
    duration: '30 min',
    description: 'Free introductory session to understand your child\'s unique learning profile, challenges, and goals. The mentor maps gaps and recommends a personalised roadmap.',
    color: '#4ECDC4',
    bg: 'rgba(78,205,196,0.08)',
    border: 'rgba(78,205,196,0.25)',
    icon: <MessageSquare size={20} />,
    badge: 'Start Here · Free*',
    outcome: 'Personalised learning roadmap',
  },
  {
    id: 'deep-dive' as SessionStage,
    label: 'Deep-Dive Sessions',
    duration: '60–90 min',
    description: 'Structured subject or behaviour-focused sessions aligned to your child\'s academic calendar. Includes test prep, concept clarity, and milestone tracking across the year.',
    color: '#0B3C5D',
    bg: 'rgba(11,60,93,0.08)',
    border: 'rgba(11,60,93,0.25)',
    icon: <Target size={20} />,
    badge: 'Core Learning',
    outcome: 'Measurable subject improvement',
  },
  {
    id: 'ongoing' as SessionStage,
    label: 'Ongoing Partnership',
    duration: 'Monthly plan',
    description: 'Long-term mentor–child relationship with monthly progress reviews, adaptive planning, and parent check-ins tied to the full academic year roadmap.',
    color: '#6C63FF',
    bg: 'rgba(108,99,255,0.08)',
    border: 'rgba(108,99,255,0.25)',
    icon: <Heart size={20} />,
    badge: 'Best Value',
    outcome: 'Holistic academic growth',
  },
];

// ─── Helper: compute AI insight bullets for a child ──────────────────────────

function getAIInsights(child?: ChildProfile) {
  const grade = parseInt(child?.grade?.replace(/[^\d]/g, '') || '8', 10);
  const insights: { label: string; color: string; icon: React.ReactNode }[] = [];
  if (grade >= 9) insights.push({ label: 'Board exam years — structured prep critical', color: '#0B3C5D', icon: <GraduationCap size={12} /> });
  if (grade >= 6 && grade <= 8) insights.push({ label: 'Foundation years — concept clarity focus', color: '#4ECDC4', icon: <BookOpen size={12} /> });
  if (child?.lbiConsent) insights.push({ label: 'LBI profile available — behavioural match active', color: '#4ECDC4', icon: <Brain size={12} /> });
  if (!child?.educationBoard) insights.push({ label: 'Set education board to unlock curriculum alignment', color: '#D97706', icon: <AlertCircle size={12} /> });
  insights.push({ label: 'AI matched based on grade, subjects & behaviour data', color: '#6C63FF', icon: <Sparkles size={12} /> });
  return insights;
}

// ─── StarRating component ────────────────────────────────────────────────────

function StarRating({ value, onChange, size = 20 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i)}
          onMouseEnter={() => onChange && setHovered(i)}
          onMouseLeave={() => onChange && setHovered(0)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
        >
          <Star
            size={size}
            className={`transition-colors ${(hovered || value) >= i ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        </button>
      ))}
    </div>
  );
}

// ─── MentorCard component ─────────────────────────────────────────────────────

function MentorCard({
  mentor, onBook, onViewProfile, compact = false,
}: {
  mentor: MentorProfile;
  onBook: (m: MentorProfile) => void;
  onViewProfile: (m: MentorProfile) => void;
  compact?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* AI Match Badge */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: `${BRAND.primary}12`, color: BRAND.primary }}>
          <Sparkles size={9} />
          {mentor.aiMatch}% AI Match
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock size={10} />
          {mentor.nextSlot}
        </div>
      </div>

      <div className="px-4 pb-4">
        {/* Profile row */}
        <div className="flex gap-3 mb-3">
          <img src={mentor.photo} alt={mentor.name}
            className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-gray-900 truncate">{mentor.name}</div>
            <div className="text-[11px] text-gray-500 truncate mb-1">{mentor.title}</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {mentor.badges.slice(0, 2).map(b => (
                <span key={b} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{b}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Rating', value: mentor.rating.toFixed(1), icon: <Star size={9} className="fill-yellow-400 text-yellow-400" /> },
            { label: 'Sessions', value: `${mentor.totalSessions}+`, icon: <Video size={9} style={{ color: BRAND.primary }} /> },
            { label: 'Success', value: `${mentor.successRate}%`, icon: <CheckCircle size={9} className="text-emerald-500" /> },
          ].map(s => (
            <div key={s.label} className="text-center rounded-xl py-1.5" style={{ background: '#f8fafc' }}>
              <div className="flex items-center justify-center gap-0.5 mb-0.5">{s.icon}<span className="font-bold text-xs text-gray-800">{s.value}</span></div>
              <div className="text-[9px] text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Subjects */}
        <div className="flex flex-wrap gap-1 mb-3">
          {mentor.subjects.slice(0, 3).map(s => (
            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">{s}</span>
          ))}
          {mentor.behaviorDomains.slice(0, 2).map(d => (
            <span key={d} className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium">{d}</span>
          ))}
        </div>

        {!compact && (
          <p className="text-[11px] text-gray-500 leading-relaxed mb-3 line-clamp-2">{mentor.bio}</p>
        )}

        {/* Rate & CTA */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-sm font-bold text-gray-900">₹{mentor.ratePerHr.toLocaleString()}</span>
            <span className="text-[10px] text-gray-400">/hr</span>
            {mentor.prelimFree && (
              <div className="text-[9px] font-semibold text-emerald-600 mt-0.5">★ Free preliminary session</div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onViewProfile(mentor)}
              className="text-[11px] px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              Profile
            </button>
            <button onClick={() => onBook(mentor)}
              className="text-[11px] px-3 py-1.5 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: BRAND.primary }}>
              Book Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MentorProfileSheet ───────────────────────────────────────────────────────

function MentorProfileSheet({ mentor, onClose, onBook }: { mentor: MentorProfile; onClose: () => void; onBook: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="relative h-24 rounded-t-2xl" style={{ background: `${BRAND.primary}` }}>
          <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
            <X size={14} />
          </button>
          <div className="absolute -bottom-8 left-5">
            <img src={mentor.photo} alt={mentor.name} className="w-16 h-16 rounded-xl border-3 border-white object-cover shadow-lg" />
          </div>
          <div className="absolute -bottom-8 left-24">
            <div className="font-bold text-gray-900">{mentor.name}</div>
            <div className="text-xs text-gray-500">{mentor.title}</div>
          </div>
        </div>

        <div className="pt-12 px-5 pb-5 space-y-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-1">
            {mentor.badges.map(b => (
              <span key={b} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${BRAND.primary}12`, color: BRAND.primary }}>{b}</span>
            ))}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { v: mentor.rating.toFixed(1), l: 'Rating', icon: <Star size={14} className="fill-yellow-400 text-yellow-400" /> },
              { v: `${mentor.reviews}`, l: 'Reviews', icon: <MessageSquare size={14} style={{ color: BRAND.primary }} /> },
              { v: `${mentor.totalSessions}+`, l: 'Sessions', icon: <Video size={14} style={{ color: BRAND.accent }} /> },
              { v: `${mentor.successRate}%`, l: 'Success', icon: <CheckCircle size={14} className="text-emerald-500" /> },
            ].map(s => (
              <div key={s.l} className="text-center p-2 rounded-xl bg-gray-50">
                <div className="flex justify-center mb-0.5">{s.icon}</div>
                <div className="font-bold text-sm text-gray-900">{s.v}</div>
                <div className="text-[9px] text-gray-400">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Bio */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">About</div>
            <p className="text-xs text-gray-600 leading-relaxed">{mentor.bio}</p>
          </div>

          {/* Subjects & Behavior Domains */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1.5">Subjects</div>
              <div className="flex flex-wrap gap-1">
                {mentor.subjects.map(s => <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{s}</span>)}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1.5">Behaviour Domains</div>
              <div className="flex flex-wrap gap-1">
                {mentor.behaviorDomains.map(d => <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">{d}</span>)}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { icon: <Clock size={11} />, l: 'Experience', v: mentor.experience },
              { icon: <Globe size={11} />, l: 'Mode', v: mentor.mode === 'both' ? 'Online & Offline' : 'Online Only' },
              { icon: <MapPin size={11} />, l: 'Location', v: mentor.city },
              { icon: <MessageSquare size={11} />, l: 'Languages', v: mentor.languages.join(', ') },
            ].map(r => (
              <div key={r.l} className="flex items-start gap-1.5">
                <span className="text-gray-400 mt-0.5">{r.icon}</span>
                <div><div className="text-gray-400">{r.l}</div><div className="font-medium text-gray-800">{r.v}</div></div>
              </div>
            ))}
          </div>

          {/* Rate + CTA */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <div>
              <span className="text-lg font-bold text-gray-900">₹{mentor.ratePerHr.toLocaleString()}</span>
              <span className="text-xs text-gray-400"> /hr</span>
              {mentor.prelimFree && <div className="text-[10px] text-emerald-600 font-semibold">★ Free preliminary session</div>}
            </div>
            <button onClick={onBook}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: BRAND.primary }}>
              Book a Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Booking Modal (4-step) ───────────────────────────────────────────────────

interface BookingModalProps {
  mentor: MentorProfile;
  childName: string;
  isMinor: boolean;
  parentEmail: string | null;
  parentName: string | null;
  onClose: () => void;
  onConfirmed: (session: BookedSession) => void;
}

function BookingModal({ mentor, childName, isMinor, parentEmail, parentName, onClose, onConfirmed }: BookingModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<BookingStep>('stage');
  const [selectedStage, setSelectedStage] = useState<SessionStage>('preliminary');
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);
  const [dpdpConsented, setDpdpConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdSession, setCreatedSession] = useState<BookedSession | null>(null);
  const [copied, setCopied] = useState(false);
  const [sessionFormat, setSessionFormat] = useState<'individual' | 'group'>('individual');
  const [groupPeerNames, setGroupPeerNames] = useState<string[]>(['', '', '']);

  const stageInfo = SESSION_STAGES.find(s => s.id === selectedStage)!;

  const handleCreate = useCallback(async () => {
    if (!selectedSlot) return;
    setLoading(true);
    try {
      const res = await fetch('/api/video-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mentorName: mentor.name,
          studentName: childName,
          sessionType: `${stageInfo.label} — ${sessionFormat === 'group' ? 'Group Study' : mentor.specialization}`,
          scheduledDate: selectedSlot.date,
          scheduledTime: selectedSlot.time,
          mode: 'Online',
          sessionFormat,
          groupPeers: sessionFormat === 'group' ? groupPeerNames.filter(n => n.trim()) : undefined,
          dpdpConsent: isMinor ? { parentalConsent: true, childIsMinor: true } : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      const data = await res.json();
      const baseUrl = window.location.origin;
      const session: BookedSession = {
        id: data.roomId,
        mentor,
        stage: selectedStage,
        sessionType: stageInfo.label,
        scheduledDate: selectedSlot.date,
        scheduledTime: selectedSlot.time,
        roomId: data.roomId,
        inviteUrl: `${baseUrl}${data.inviteUrl}`,
        status: 'upcoming',
        childName,
        dpdpConsented: true,
      };
      setCreatedSession(session);
      setStep('success');
      onConfirmed(session);

      // Send email invitation (best-effort, non-blocking)
      if (parentEmail) {
        fetch(`/api/video-sessions/${data.roomId}/send-invitation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: parentEmail,
            recipientName: parentName || undefined,
            mentorName: mentor.name,
            sessionType: `${stageInfo.label} — ${mentor.specialization}`,
            scheduledDate: selectedSlot.date,
            scheduledTime: selectedSlot.time,
            inviteUrl: `${baseUrl}${data.inviteUrl}`,
            childName,
            dpdpConsented: isMinor,
          }),
        }).then(r => r.json()).then(res => {
          if (res.status === 'sent') {
            toast({ title: 'Invitation sent', description: `Session details emailed to ${parentEmail}` });
          }
        }).catch(() => {});
      }
    } catch {
      toast({ title: 'Booking failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedSlot, mentor, childName, stageInfo, selectedStage, isMinor, onConfirmed, toast, parentEmail, parentName]);

  const copyLink = async () => {
    if (!createdSession) return;
    await navigator.clipboard.writeText(createdSession.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const STEPS = ['stage', 'format', 'calendar', 'dpdp', 'confirm', 'success'];
  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="fixed inset-0 z-[95] flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="font-bold text-sm text-gray-900">Book with {mentor.name}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {step === 'stage' && 'Choose session type'}
              {step === 'format' && 'Choose session format'}
              {step === 'calendar' && 'Pick a time slot'}
              {step === 'dpdp' && 'Parental consent — DPDP Act 2023'}
              {step === 'confirm' && 'Review & confirm'}
              {step === 'success' && 'Session booked!'}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
            <X size={14} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 px-5 pt-3">
          {STEPS.slice(0, -1).map((s, i) => (
            <div key={s} className="h-1 flex-1 rounded-full transition-colors"
              style={{ backgroundColor: i <= stepIdx ? BRAND.primary : '#e5e7eb' }} />
          ))}
        </div>

        <div className="px-5 py-5 space-y-4">

          {/* Step 1: Session Stage */}
          {step === 'stage' && (
            <div className="space-y-3">
              <div className="text-xs text-gray-500 mb-2">Select the type of session for <strong>{childName}</strong>:</div>
              {SESSION_STAGES.map(s => (
                <button key={s.id} onClick={() => setSelectedStage(s.id)}
                  className="w-full text-left p-4 rounded-xl border-2 transition-all"
                  style={{
                    borderColor: selectedStage === s.id ? s.color : '#e5e7eb',
                    background: selectedStage === s.id ? s.bg : 'white',
                  }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: s.bg, color: s.color }}>
                      {s.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-sm text-gray-900">{s.label}</div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: `${s.color}15`, color: s.color }}>{s.badge}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{s.duration} · {s.outcome}</div>
                      <div className="text-[11px] text-gray-400 mt-1 leading-relaxed">{s.description}</div>
                    </div>
                    {selectedStage === s.id && <CheckCircle size={16} style={{ color: s.color, flexShrink: 0 }} />}
                  </div>
                </button>
              ))}
              <button className="w-full py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 mt-2"
                style={{ backgroundColor: BRAND.primary }} onClick={() => setStep('format')}>
                Continue <ChevronRight size={14} className="inline ml-1" />
              </button>
            </div>
          )}

          {/* Step 2: Session Format */}
          {step === 'format' && (
            <div className="space-y-4">
              <div className="text-xs text-gray-500 mb-2">How would you like <strong>{childName}</strong> to learn?</div>

              {[
                {
                  id: 'individual' as const,
                  label: '1-on-1 Session',
                  desc: `Dedicated time with ${mentor.name}. Personalised pace, immediate feedback, and focused guidance on ${childName}'s specific needs.`,
                  icon: <User size={16} />,
                  color: BRAND.primary,
                  badge: null,
                },
                {
                  id: 'group' as const,
                  label: 'Group Study Session',
                  desc: `3–5 students learn together. Collaborative problem-solving, peer motivation, and structured discussion facilitated by ${mentor.name}.`,
                  icon: <Users size={16} />,
                  color: BRAND.accent,
                  badge: 'Save 30%',
                },
              ].map(opt => (
                <button
                  key={opt.id}
                  className="w-full text-left p-4 rounded-xl border-2 transition-all"
                  onClick={() => setSessionFormat(opt.id)}
                  style={{
                    borderColor: sessionFormat === opt.id ? opt.color : '#e5e7eb',
                    background: sessionFormat === opt.id ? `${opt.color}08` : 'white',
                  }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${opt.color}15`, color: opt.color }}>
                      {opt.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        {opt.label}
                        {opt.badge && <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold text-white" style={{ backgroundColor: opt.color }}>{opt.badge}</span>}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{opt.desc}</div>
                    </div>
                    {sessionFormat === opt.id && <CheckCircle size={16} style={{ color: opt.color, flexShrink: 0 }} />}
                  </div>
                </button>
              ))}

              {sessionFormat === 'group' && (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] text-gray-500 font-medium">Add peer student names (optional — up to 4 more):</div>
                  {groupPeerNames.map((name, i) => (
                    <input
                      key={i}
                      value={name}
                      onChange={e => setGroupPeerNames(prev => prev.map((n, j) => j === i ? e.target.value : n))}
                      placeholder={`Peer ${i + 1} name`}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#4ECDC4] transition-colors"
                    />
                  ))}
                  {groupPeerNames.length < 4 && (
                    <button
                      className="text-[11px] flex items-center gap-1 hover:opacity-80 transition-opacity"
                      style={{ color: BRAND.accent }}
                      onClick={() => setGroupPeerNames(prev => [...prev, ''])}>
                      <Plus size={11} /> Add another peer
                    </button>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                  onClick={() => setStep('stage')}>Back</button>
                <button
                  className="flex-1 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90"
                  style={{ backgroundColor: BRAND.primary }}
                  onClick={() => setStep('calendar')}>
                  Continue <ChevronRight size={14} className="inline ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Calendar */}
          {step === 'calendar' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: `${stageInfo.color}10`, border: `1px solid ${stageInfo.color}30` }}>
                <div style={{ color: stageInfo.color }}>{stageInfo.icon}</div>
                <div className="text-xs">
                  <span className="font-semibold">{stageInfo.label}</span>
                  <span className="text-gray-500"> · {stageInfo.duration}</span>
                </div>
              </div>
              {mentor.calendarSlots.map(daySlot => (
                <div key={daySlot.date}>
                  <div className="text-xs font-semibold text-gray-600 mb-1.5">{daySlot.label} — {new Date(daySlot.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                  <div className="flex flex-wrap gap-2">
                    {daySlot.times.map(t => {
                      const isSelected = selectedSlot?.date === daySlot.date && selectedSlot?.time === t;
                      const [h, m] = t.split(':').map(Number);
                      const ampm = h >= 12 ? 'PM' : 'AM';
                      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
                      const label = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
                      return (
                        <button key={t} onClick={() => setSelectedSlot({ date: daySlot.date, time: t })}
                          className="text-xs px-3 py-1.5 rounded-lg border-2 font-medium transition-all"
                          style={{
                            borderColor: isSelected ? BRAND.primary : '#e5e7eb',
                            backgroundColor: isSelected ? BRAND.primary : 'white',
                            color: isSelected ? 'white' : '#374151',
                          }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                  onClick={() => setStep('format')}>Back</button>
                <button
                  disabled={!selectedSlot}
                  className="flex-1 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: BRAND.primary }}
                  onClick={() => setStep(isMinor ? 'dpdp' : 'confirm')}>
                  Continue <ChevronRight size={14} className="inline ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: DPDP Parental Consent */}
          {step === 'dpdp' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(11,60,93,0.05)', border: '1px solid rgba(11,60,93,0.15)' }}>
                <Shield size={20} style={{ color: BRAND.primary, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div className="font-semibold text-sm text-gray-900 mb-1">Parental Consent Required</div>
                  <div className="text-[11px] text-gray-500 leading-relaxed">
                    Under the <strong>Digital Personal Data Protection Act 2023 (DPDP)</strong>, online video sessions involving minors require explicit parental consent. As the parent/guardian, you are consenting on behalf of <strong>{childName}</strong>.
                  </div>
                </div>
              </div>

              {[
                { id: 'c1', text: `I consent to a live video session between ${childName} and ${mentor.name} on the MetryxOne platform for educational purposes.` },
                { id: 'c2', text: `I understand the session may be recorded for quality review. ${childName}'s personal data will be processed under MetryxOne's DPDP-compliant privacy policy and retained for 90 days maximum.` },
                { id: 'c3', text: `I confirm that I am the parent or lawful guardian of ${childName} (a minor) and have the authority to provide this consent under the DPDP Act 2023.` },
              ].map(({ id, text }) => (
                <label key={id} className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={dpdpConsented} onChange={e => setDpdpConsented(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-[#0B3C5D] shrink-0" />
                  <span className="text-[11px] text-gray-600 leading-relaxed">{text}</span>
                </label>
              ))}

              <div className="text-[10px] text-gray-400 flex items-center gap-1">
                <Lock size={9} />
                Your consent is logged with IP hash, timestamp, and consent version DPDP-2023-v1.
                Contact: <a href="mailto:dpo@metryxone.com" className="underline">dpo@metryxone.com</a>
              </div>

              <div className="flex gap-2 pt-1">
                <button className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                  onClick={() => setStep('calendar')}>Back</button>
                <button
                  disabled={!dpdpConsented}
                  className="flex-1 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: BRAND.primary }}
                  onClick={() => setStep('confirm')}>
                  I Consent & Continue <ChevronRight size={14} className="inline ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && selectedSlot && (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-gray-700 mb-2">Review your booking</div>

              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 p-4 border-b border-gray-50">
                  <img src={mentor.photo} alt={mentor.name} className="w-10 h-10 rounded-lg object-cover" />
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{mentor.name}</div>
                    <div className="text-xs text-gray-500">{mentor.title}</div>
                  </div>
                </div>
                {[
                  { icon: <User size={12} />, label: 'Student', value: childName },
                  { icon: <Layers size={12} />, label: 'Session Type', value: stageInfo.label },
                  { icon: <Calendar size={12} />, label: 'Date', value: new Date(selectedSlot.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) },
                  { icon: <Clock size={12} />, label: 'Time', value: (() => { const [h, m] = selectedSlot.time.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m.toString().padStart(2, '0')} ${ap} IST`; })() },
                  { icon: <Video size={12} />, label: 'Mode', value: 'Secure Online Video Call' },
                  { icon: <Users size={12} />, label: 'Format', value: sessionFormat === 'group' ? `Group Study (${1 + groupPeerNames.filter(n => n.trim()).length} students)` : '1-on-1 Individual' },
                  isMinor && { icon: <Shield size={12} />, label: 'DPDP Consent', value: 'Parent consent recorded' },
                ].filter(Boolean).map((r: any) => (
                  <div key={r.label} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-400 w-4 shrink-0">{r.icon}</span>
                    <span className="text-xs text-gray-500 w-28 shrink-0">{r.label}</span>
                    <span className="text-xs font-medium text-gray-800">{r.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                  onClick={() => setStep(isMinor ? 'dpdp' : 'calendar')}>Back</button>
                <button
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ backgroundColor: BRAND.primary }}
                  onClick={handleCreate}
                  disabled={loading}>
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <Video size={14} />}
                  {loading ? 'Creating session…' : 'Confirm & Create Session'}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && createdSession && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: `${BRAND.accent}20` }}>
                <CheckCircle size={28} style={{ color: BRAND.accent }} />
              </div>
              <div>
                <div className="font-bold text-gray-900 mb-1">Session Booked!</div>
                <div className="text-xs text-gray-500">Your secure session with <strong>{mentor.name}</strong> is confirmed. Share the join link with anyone who needs to attend.</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-left">
                <div className="text-[10px] text-gray-400 mb-1">Session Join Link</div>
                <div className="text-xs text-gray-700 break-all font-mono">{createdSession.inviteUrl}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={copyLink}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-sm flex items-center justify-center gap-1.5 hover:bg-gray-50">
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button onClick={onClose}
                  className="flex-1 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90"
                  style={{ backgroundColor: BRAND.primary }}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Post-Session Feedback Modal ──────────────────────────────────────────────

function FeedbackModal({ session, onClose, onSubmit }: {
  session: BookedSession;
  onClose: () => void;
  onSubmit: (feedback: SessionFeedback) => void;
}) {
  const { toast } = useToast();
  const [overall, setOverall] = useState(0);
  const [academic, setAcademic] = useState(0);
  const [engagement, setEngagement] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [comment, setComment] = useState('');
  const [recommend, setRecommend] = useState(true);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (overall === 0) { toast({ title: 'Please rate the session', variant: 'destructive' }); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800)); // simulate API
    const fb: SessionFeedback = {
      overallRating: overall, academicRating: academic, engagementRating: engagement,
      communicationRating: communication, comment, wouldRecommend: recommend,
      submittedAt: new Date().toISOString(),
    };
    setDone(true);
    setLoading(false);
    setTimeout(() => { onSubmit(fb); onClose(); }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="font-bold text-sm text-gray-900">Rate Your Session</div>
            <div className="text-[11px] text-gray-400">with {session.mentor.name} · {session.sessionType}</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14} /></button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3" style={{ background: `${BRAND.accent}20` }}>
              <CheckCircle size={28} style={{ color: BRAND.accent }} />
            </div>
            <div className="font-bold text-gray-900 mb-1">Thank you!</div>
            <div className="text-xs text-gray-500">Your feedback helps personalise future recommendations.</div>
          </div>
        ) : (
          <div className="px-5 py-5 space-y-5">
            {/* Overall rating */}
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-800 mb-2">Overall Session Rating</div>
              <div className="flex justify-center">
                <StarRating value={overall} onChange={setOverall} size={32} />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {overall === 0 ? 'Tap to rate' : ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][overall]}
              </div>
            </div>

            {/* Dimension ratings */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-gray-700">Rate specific areas</div>
              {[
                { label: 'Academic Content', value: academic, onChange: setAcademic, icon: <BookOpen size={13} /> },
                { label: 'Student Engagement', value: engagement, onChange: setEngagement, icon: <Zap size={13} /> },
                { label: 'Communication', value: communication, onChange: setCommunication, icon: <MessageSquare size={13} /> },
              ].map(d => (
                <div key={d.label} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 w-36 shrink-0">
                    <span className="text-gray-400">{d.icon}</span>{d.label}
                  </div>
                  <StarRating value={d.value} onChange={d.onChange} size={16} />
                </div>
              ))}
            </div>

            {/* Written comment */}
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Your feedback</div>
              <textarea
                className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:ring-1 focus:ring-[#0B3C5D] focus:border-[#0B3C5D] outline-none resize-none"
                rows={3}
                placeholder="Share what went well or what could be improved…"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
            </div>

            {/* Recommendation toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                className="relative w-9 h-5 rounded-full transition-colors shrink-0"
                style={{ backgroundColor: recommend ? BRAND.accent : '#e5e7eb' }}
                onClick={() => setRecommend(r => !r)}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${recommend ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs text-gray-600">I would recommend {session.mentor.name} to other parents</span>
            </label>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading || overall === 0}
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ backgroundColor: BRAND.primary }}>
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              {loading ? 'Submitting…' : 'Submit Feedback'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ParentMentorServicesProps {
  selectedChild?: ChildProfile | null;
  onNavigate: (screen: string, data?: any) => void;
  onSessionBooked?: (session: BookedSession) => void;
}

export function ParentMentorServices({ selectedChild, onNavigate, onSessionBooked }: ParentMentorServicesProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('recommendations');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<SessionStage | ''>('');
  const [sortBy, setSortBy] = useState<'match' | 'rating' | 'rate'>('match');
  const [expandedInsights, setExpandedInsights] = useState(false);

  // Profile sheet
  const [profileMentor, setProfileMentor] = useState<MentorProfile | null>(null);

  // Booking
  const [bookingMentor, setBookingMentor] = useState<MentorProfile | null>(null);

  // Sessions
  const [bookedSessions, setBookedSessions] = useState<BookedSession[]>([]);

  // Active call (join)
  const [callSession, setCallSession] = useState<BookedSession | null>(null);
  const [consentDone, setConsentDone] = useState(false);
  const [consentPending, setConsentPending] = useState<BookedSession | null>(null);

  // Feedback
  const [feedbackSession, setFeedbackSession] = useState<BookedSession | null>(null);

  const isMinor = useMemo(() => {
    const age = selectedChild?.age;
    if (age) return age < 18;
    const grade = parseInt(selectedChild?.grade?.replace(/[^\d]/g, '') || '0');
    return grade < 12;
  }, [selectedChild]);

  const childName = selectedChild?.name || 'your child';
  const insights = useMemo(() => getAIInsights(selectedChild), [selectedChild]);

  // Sort & filter mentors
  const displayedMentors = useMemo(() => {
    let list = [...ALL_MENTORS];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.subjects.some(s => s.toLowerCase().includes(q)) ||
        m.behaviorDomains.some(d => d.toLowerCase().includes(q)) ||
        m.specialization.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'rate') list.sort((a, b) => a.ratePerHr - b.ratePerHr);
    else list.sort((a, b) => b.aiMatch - a.aiMatch);
    return list;
  }, [searchQuery, sortBy]);

  const handleBookConfirmed = useCallback((session: BookedSession) => {
    setBookedSessions(prev => [session, ...prev]);
    setBookingMentor(null);
    toast({ title: 'Session booked!', description: `Your session with ${session.mentor.name} is confirmed.` });
    onSessionBooked?.(session);
  }, [toast, onSessionBooked]);

  const handleJoinCall = useCallback((session: BookedSession) => {
    if (isMinor && !consentDone) {
      setConsentPending(session);
    } else {
      setCallSession(session);
    }
  }, [isMinor, consentDone]);

  const handleConsentAccepted = useCallback(() => {
    setConsentDone(true);
    if (consentPending) {
      setCallSession(consentPending);
      setConsentPending(null);
    }
  }, [consentPending]);

  const handleFeedbackSubmit = useCallback((fb: SessionFeedback) => {
    if (!feedbackSession) return;
    setBookedSessions(prev => prev.map(s =>
      s.id === feedbackSession.id ? { ...s, status: 'completed', feedback: fb } : s
    ));
    setFeedbackSession(null);
    toast({ title: 'Feedback submitted', description: 'Thank you! Your ratings help personalise future recommendations.' });
  }, [feedbackSession, toast]);

  // Academic year plan data
  const yearPhases: { label: string; name: string; color: string; recommended: string; done: boolean; stage: SessionStage; keyword: string }[] = [
    { label: 'Jun–Jul', name: 'Foundation',   color: '#4ECDC4', recommended: 'Preliminary Counselling', done: true,  stage: 'preliminary', keyword: '' },
    { label: 'Aug–Sep', name: 'Acceleration', color: '#0B3C5D', recommended: 'Deep-Dive Sessions',      done: false, stage: 'deep-dive',   keyword: 'acceleration' },
    { label: 'Oct–Nov', name: 'Pre-Boards',   color: '#4ECDC4', recommended: 'Intensive Prep',          done: false, stage: 'deep-dive',   keyword: 'exam prep' },
    { label: 'Dec–Jan', name: 'Board Season', color: '#0B3C5D', recommended: 'Daily Support',           done: false, stage: 'ongoing',     keyword: 'board' },
    { label: 'Feb–Mar', name: 'Finals',       color: '#4ECDC4', recommended: 'Consolidation',           done: false, stage: 'ongoing',     keyword: 'finals' },
    { label: 'Apr–May', name: 'Reflection',   color: '#0B3C5D', recommended: 'Progress Review',         done: false, stage: 'preliminary', keyword: 'review' },
  ];

  // If a call is active, render the call room full-screen
  if (callSession) {
    return (
      <VideoCallRoom
        roomId={callSession.roomId}
        userName={`Parent of ${callSession.childName}`}
        onLeave={() => {
          setCallSession(null);
          // move session to completed for feedback prompt
          setBookedSessions(prev => prev.map(s =>
            s.id === callSession.id ? { ...s, status: 'completed' } : s
          ));
          setFeedbackSession({ ...callSession, status: 'completed' });
        }}
      />
    );
  }

  return (
    <div className="space-y-5" data-testid="parent-mentor-services">

      {/* DPDP Consent gate before joining a call */}
      {consentPending && (
        <DPDPConsentModal
          onAccept={handleConsentAccepted}
          onDecline={() => setConsentPending(null)}
          userName={`Parent of ${childName}`}
        />
      )}

      {/* Profile sheet */}
      {profileMentor && (
        <MentorProfileSheet
          mentor={profileMentor}
          onClose={() => setProfileMentor(null)}
          onBook={() => { setProfileMentor(null); setBookingMentor(profileMentor); }}
        />
      )}

      {/* Booking modal */}
      {bookingMentor && (
        <BookingModal
          mentor={bookingMentor}
          childName={childName}
          isMinor={isMinor}
          parentEmail={user?.email ?? null}
          parentName={user?.fullName ?? user?.name ?? null}
          onClose={() => setBookingMentor(null)}
          onConfirmed={handleBookConfirmed}
        />
      )}

      {/* Feedback modal */}
      {feedbackSession && (
        <FeedbackModal
          session={feedbackSession}
          onClose={() => setFeedbackSession(null)}
          onSubmit={handleFeedbackSubmit}
        />
      )}

      {/* ── Top hero banner ── */}
      <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
        style={{ background: `#4a6bc4` }}>
        <div className="px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-yellow-300" />
                <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">AI Mentor Intelligence</span>
              </div>
              <h2 className="text-lg font-bold mb-1">Personalised Mentor Services for {childName}</h2>
              <p className="text-white/70 text-xs leading-relaxed max-w-lg">
                AI-matched mentors ranked by academic profile, behavioural intelligence (LBI), and exam goals across the full academic year — from preliminary counselling to ongoing partnership.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-xs text-white">
                  <Shield size={11} /> DPDP 2023 Compliant
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-xs text-white">
                  <Video size={11} /> Native Video Calls
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-xs text-white">
                  <Brain size={11} /> LBI-Matched
                </div>
              </div>
            </div>
            <div className="shrink-0 hidden md:flex flex-col items-center gap-1">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Sparkles size={28} className="text-yellow-300" />
              </div>
              <div className="text-[10px] text-white/60 text-center">AI Matching<br/>Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Insight Panel ── */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          onClick={() => setExpandedInsights(e => !e)}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${BRAND.accent}15` }}>
              <Brain size={14} style={{ color: BRAND.accent }} />
            </div>
            <span className="text-sm font-semibold text-gray-800">AI Recommendation Insights for {childName}</span>
          </div>
          {expandedInsights ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {expandedInsights && (
          <div className="px-4 pb-4 space-y-2 border-t border-gray-50">
            <div className="text-[11px] text-gray-500 mt-2 mb-3">Why these mentors were recommended:</div>
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl" style={{ background: `${ins.color}08`, border: `1px solid ${ins.color}20` }}>
                <span style={{ color: ins.color, flexShrink: 0, marginTop: 1 }}>{ins.icon}</span>
                <span className="text-[11px] text-gray-700">{ins.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Academic Year Journey ── */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
          <CalendarDays size={15} style={{ color: BRAND.primary }} />
          <span className="font-semibold text-sm text-gray-800">Academic Year Mentor Roadmap</span>
          <span className="ml-auto text-[10px] text-gray-400">2025–26</span>
        </div>
        <div className="px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {yearPhases.map((phase, i) => (
              <div key={i} className="shrink-0 w-28 rounded-xl p-2.5 border transition-all"
                style={{
                  borderColor: `${phase.color}30`,
                  background: phase.done ? `${phase.color}10` : 'white',
                }}>
                <div className="text-[9px] font-bold mb-0.5" style={{ color: phase.color }}>{phase.label}</div>
                <div className="text-[11px] font-semibold text-gray-800 mb-1">{phase.name}</div>
                <div className="text-[9px] text-gray-500 leading-tight mb-1.5">{phase.recommended}</div>
                {phase.done ? (
                  <div className="flex items-center gap-0.5 text-[9px]" style={{ color: phase.color }}>
                    <CheckCircle size={9} /> Done
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setFilterStage(phase.stage);
                      if (phase.keyword) setSearchQuery(phase.keyword);
                      setViewMode('recommendations');
                    }}
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: phase.color }}>
                    Book Now
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Session Stages ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SESSION_STAGES.map(stage => (
          <div key={stage.id} className="bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
            style={{ borderColor: stage.border }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: stage.bg, color: stage.color }}>
                {stage.icon}
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: `${stage.color}15`, color: stage.color }}>
                {stage.badge}
              </span>
            </div>
            <div className="font-bold text-sm text-gray-900 mb-0.5">{stage.label}</div>
            <div className="text-[11px] text-gray-500 mb-2">{stage.duration} · {stage.outcome}</div>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-3">{stage.description}</p>
            <button
              onClick={() => { setFilterStage(stage.id); setViewMode('recommendations'); }}
              className="text-[11px] font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ color: stage.color }}>
              Find mentors <ArrowRight size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* ── View toggle + Search ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([
            { id: 'recommendations', label: 'AI Recommendations', icon: <Sparkles size={12} /> },
            { id: 'browse', label: 'Browse All', icon: <Users size={12} /> },
            { id: 'my-sessions', label: `My Sessions${bookedSessions.length > 0 ? ` (${bookedSessions.length})` : ''}`, icon: <CalendarDays size={12} /> },
          ] as { id: ViewMode; label: string; icon: React.ReactNode }[]).map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === v.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {v.icon}{v.label}
            </button>
          ))}
        </div>

        {(viewMode === 'recommendations' || viewMode === 'browse') && (
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search subject, domain…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#0B3C5D] focus:border-[#0B3C5D] outline-none w-44"
              />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-[#0B3C5D] outline-none bg-white">
              <option value="match">AI Match %</option>
              <option value="rating">Highest Rated</option>
              <option value="rate">Lowest Rate</option>
            </select>
          </div>
        )}
      </div>

      {/* ── Recommendations view ── */}
      {viewMode === 'recommendations' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-gray-800">
              Top {Math.min(4, displayedMentors.length)} AI-Matched Mentors
              {selectedChild?.name ? ` for ${selectedChild.name}` : ''}
            </div>
            <button onClick={() => setViewMode('browse')}
              className="text-xs flex items-center gap-1 hover:opacity-80" style={{ color: BRAND.primary }}>
              See all <ChevronRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {displayedMentors.slice(0, 4).map(m => (
              <MentorCard
                key={m.id}
                mentor={m}
                onBook={setBookingMentor}
                onViewProfile={setProfileMentor}
              />
            ))}
          </div>

          {/* Behavior-based recommendation callout */}
          {selectedChild?.lbiConsent && (
            <div className="mt-4 rounded-2xl p-4 border" style={{ background: `${BRAND.accent}08`, borderColor: `${BRAND.accent}25` }}>
              <div className="flex items-start gap-3">
                <Brain size={20} style={{ color: BRAND.accent, flexShrink: 0 }} />
                <div>
                  <div className="font-semibold text-sm text-gray-900 mb-1">LBI-Powered Recommendations Active</div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    {childName}'s LBI assessment data is being used to match mentors specialising in the exact behavioural domains that need strengthening — including emotional regulation, focus, and executive functioning. Behaviour-matched sessions show <strong>34% better outcomes</strong> than subject-only matching.
                  </p>
                  <button className="mt-2 text-[11px] font-semibold flex items-center gap-1 hover:opacity-80" style={{ color: BRAND.accent }}
                    onClick={() => onNavigate('parent-lbi')}>
                    View LBI Report <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Test & planner integration callout */}
          <div className="mt-4 rounded-2xl p-4 border" style={{ background: `${BRAND.primary}06`, borderColor: `${BRAND.primary}18` }}>
            <div className="flex items-start gap-3">
              <BarChart3 size={20} style={{ color: BRAND.primary, flexShrink: 0 }} />
              <div>
                <div className="font-semibold text-sm text-gray-900 mb-1">Academic Performance Integration</div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Mentor recommendations are dynamically updated based on {childName}'s test scores, exam performance trends, and study planner completion rate. Subjects with below-average scores get higher-weighted mentor matches automatically.
                </p>
                <div className="flex gap-2 mt-2">
                  <button className="text-[11px] font-semibold flex items-center gap-1 hover:opacity-80" style={{ color: BRAND.primary }}
                    onClick={() => onNavigate('exam-trends')}>
                    View Exam Analytics <ArrowRight size={11} />
                  </button>
                  <span className="text-gray-300">·</span>
                  <button className="text-[11px] font-semibold flex items-center gap-1 hover:opacity-80" style={{ color: BRAND.primary }}
                    onClick={() => onNavigate('tests-planner')}>
                    Tests & Planner <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Browse All view ── */}
      {viewMode === 'browse' && (
        <div>
          <div className="text-xs text-gray-500 mb-3">
            Showing {displayedMentors.length} mentor{displayedMentors.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {displayedMentors.map(m => (
              <MentorCard key={m.id} mentor={m} onBook={setBookingMentor} onViewProfile={setProfileMentor} compact />
            ))}
          </div>
          {displayedMentors.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Search size={32} className="mx-auto mb-2 opacity-30" />
              <div className="text-sm">No mentors found for "{searchQuery}"</div>
              <button onClick={() => setSearchQuery('')} className="text-xs mt-1 underline">Clear search</button>
            </div>
          )}
        </div>
      )}

      {/* ── My Sessions view ── */}
      {viewMode === 'my-sessions' && (
        <div className="space-y-3">
          {bookedSessions.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-10 text-center">
              <CalendarDays size={36} className="mx-auto mb-3 text-gray-300" />
              <div className="font-semibold text-gray-500 mb-1">No sessions booked yet</div>
              <div className="text-xs text-gray-400 mb-4">Book a preliminary counselling session to get started</div>
              <button onClick={() => setViewMode('recommendations')}
                className="px-5 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90"
                style={{ backgroundColor: BRAND.primary }}>
                Find a Mentor
              </button>
            </div>
          ) : (
            bookedSessions.map(session => {
              const stageInfo = SESSION_STAGES.find(s => s.id === session.stage)!;
              const isUpcoming = session.status === 'upcoming' || session.status === 'in-progress';
              const isCompleted = session.status === 'completed';
              return (
                <div key={session.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-start justify-between p-4 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                      <img src={session.mentor.photo} alt={session.mentor.name}
                        className="w-10 h-10 rounded-xl object-cover shrink-0" />
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{session.mentor.name}</div>
                        <div className="text-xs text-gray-500">{session.sessionType}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isCompleted ? 'bg-emerald-100 text-emerald-700' :
                      session.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                    </span>
                  </div>

                  <div className="p-4 grid grid-cols-2 gap-3">
                    {[
                      { icon: <Calendar size={11} />, label: 'Date', value: new Date(session.scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                      { icon: <Clock size={11} />, label: 'Time', value: (() => { const [h, m] = session.scheduledTime.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m.toString().padStart(2, '0')} ${ap} IST`; })() },
                      { icon: stageInfo.icon, label: 'Stage', value: stageInfo.label },
                      { icon: <User size={11} />, label: 'Student', value: session.childName },
                    ].map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-gray-400">{r.icon}</span>
                        <div>
                          <div className="text-[9px] text-gray-400">{r.label}</div>
                          <div className="text-[11px] font-medium text-gray-800">{r.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {session.dpdpConsented && (
                    <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 border-t border-emerald-100">
                      <Shield size={10} className="text-emerald-600" />
                      <span className="text-[10px] text-emerald-700 font-medium">Parental DPDP consent recorded · DPDP-2023-v1</span>
                    </div>
                  )}

                  {/* Feedback display + Session Quality Score */}
                  {isCompleted && session.feedback && (() => {
                    const fb = session.feedback!;
                    const qualityScore = Math.round(
                      (fb.overallRating * 40 + (fb.academicRating || fb.overallRating) * 20 +
                       (fb.engagementRating || fb.overallRating) * 20 + (fb.communicationRating || fb.overallRating) * 20) / 5
                    );
                    const qualityLabel = qualityScore >= 85 ? 'Excellent' : qualityScore >= 70 ? 'Good' : qualityScore >= 55 ? 'Average' : 'Needs Work';
                    const qualityColor = qualityScore >= 85 ? BRAND.accent : qualityScore >= 70 ? BRAND.primary : qualityScore >= 55 ? '#F59E0B' : '#DC2626';
                    return (
                      <div className="px-4 py-3 border-t border-gray-50 bg-gray-50">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <StarRating value={fb.overallRating} size={13} />
                            <span className="text-xs text-gray-500 ml-1">Your rating</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {fb.wouldRecommend && (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                                <ThumbsUp size={10} /> Recommended
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: qualityColor }}>
                              Session Quality: {qualityScore}% · {qualityLabel}
                            </div>
                          </div>
                        </div>
                        {fb.comment && (
                          <p className="text-[11px] text-gray-500 italic">"{fb.comment}"</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Actions */}
                  <div className="flex gap-2 px-4 pb-4 pt-2">
                    {isUpcoming && (
                      <>
                        <button onClick={() => handleJoinCall(session)}
                          className="flex-1 py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90"
                          style={{ backgroundColor: BRAND.primary }}>
                          <Video size={13} /> Join Call
                        </button>
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(session.inviteUrl);
                            toast({ title: 'Link copied!', description: 'Share with the mentor or other attendees.' });
                          }}
                          className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs hover:bg-gray-50 flex items-center gap-1">
                          <Copy size={12} /> Link
                        </button>
                        <button className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs hover:bg-gray-50 flex items-center gap-1">
                          <RotateCcw size={12} /> Reschedule
                        </button>
                      </>
                    )}
                    {isCompleted && !session.feedback && (
                      <button onClick={() => setFeedbackSession(session)}
                        className="flex-1 py-2 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90"
                        style={{ backgroundColor: BRAND.accent }}>
                        <Star size={13} /> Rate & Review
                      </button>
                    )}
                    {isCompleted && session.feedback && (
                      <button
                        onClick={() => {
                          const fb = session.feedback!;
                          const qualityScore = Math.round((fb.overallRating * 40 + (fb.academicRating || fb.overallRating) * 20 + (fb.engagementRating || fb.overallRating) * 20 + (fb.communicationRating || fb.overallRating) * 20) / 5);
                          const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Session Report</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:40px auto;padding:0 24px;color:#1e293b}
.header{background:#0B3C5D;color:white;border-radius:16px;padding:24px 28px;margin-bottom:24px}
h1{margin:0 0 4px;font-size:20px}.sub{opacity:.8;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center}
.val{font-size:22px;font-weight:700;color:#0B3C5D}.lbl{font-size:10px;color:#64748b;margin-top:3px}
.section{margin-bottom:16px}.section h3{color:#0B3C5D;font-size:13px;margin:0 0 8px;border-bottom:2px solid #4ECDC4;padding-bottom:4px}
.comment{background:#f8fafc;border-left:3px solid #4ECDC4;padding:12px;border-radius:0 8px 8px 0;font-size:12px;color:#475569;font-style:italic}
.footer{text-align:center;font-size:10px;color:#94a3b8;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px}
</style></head><body>
<div class="header"><h1>Mentor Session Report</h1><div class="sub">${session.childName} · with ${session.mentor.name} · ${session.scheduledDate}</div></div>
<div class="grid">
<div class="kpi"><div class="val">${fb.overallRating}/5</div><div class="lbl">Overall Rating</div></div>
<div class="kpi"><div class="val">${qualityScore}%</div><div class="lbl">Session Quality</div></div>
<div class="kpi"><div class="val">${fb.academicRating || '–'}/5</div><div class="lbl">Academic Content</div></div>
<div class="kpi"><div class="val">${fb.engagementRating || '–'}/5</div><div class="lbl">Engagement</div></div>
</div>
<div class="section"><h3>Session Details</h3><p style="font-size:13px;color:#475569">Type: ${session.sessionType} · Stage: ${session.stage} · Communication rating: ${fb.communicationRating || '–'}/5</p></div>
${fb.comment ? `<div class="section"><h3>Parent Feedback</h3><div class="comment">"${fb.comment}"</div></div>` : ''}
<div class="section"><h3>Recommendation</h3><p style="font-size:13px;color:#475569">${fb.wouldRecommend ? '✅ Parent would recommend this mentor to others.' : 'Parent did not recommend this mentor.'}</p></div>
<div class="footer">MetryxOne · Mentor Progress Report · Generated ${new Date().toLocaleDateString('en-IN', { weekday:'long',year:'numeric',month:'long',day:'numeric' })}</div>
</body></html>`;
                          const blob = new Blob([html], { type: 'text/html' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `Mentor_Session_${session.mentor.name.replace(/\s+/g,'_')}_${session.scheduledDate}.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="flex-1 py-2 rounded-xl border text-xs flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity font-semibold"
                        style={{ borderColor: `${BRAND.primary}30`, color: BRAND.primary }}
                      >
                        <Download size={13} /> Download Report
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* T008: 4-Session Milestone Progress Report */}
          {(() => {
            const completedWithFeedback = bookedSessions.filter(s => s.status === 'completed' && s.feedback);
            if (completedWithFeedback.length < 4) return null;
            const mentorName = bookedSessions[0]?.mentor?.name || 'Your Mentor';
            const handleProgressReport = async () => {
              try {
                const token = localStorage.getItem('metryx_token');
                const resp = await fetch('/api/mentor-progress-report', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                  body: JSON.stringify({ childName, mentorName, sessions: completedWithFeedback.map(s => ({ sessionType: s.sessionType, scheduledDate: s.scheduledDate, stage: s.stage, feedback: s.feedback })) }),
                });
                const data = resp.ok ? await resp.json() : null;
                const avgQ = data?.avgQualityScore ?? Math.round(completedWithFeedback.reduce((s, sess) => { const fb = sess.feedback!; return s + (fb.overallRating * 40 + (fb.academicRating || fb.overallRating) * 20 + (fb.engagementRating || fb.overallRating) * 20 + (fb.communicationRating || fb.overallRating) * 20) / 5; }, 0) / completedWithFeedback.length);
                const rec = data?.recommendation ?? (avgQ >= 80 ? 'Excellent progression — continue with this mentor.' : 'Good progress — review feedback and refocus on weaker areas.');
                const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Mentor Progress Report</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;max-width:680px;margin:40px auto;padding:0 24px;color:#1e293b}
.header{background:#0B3C5D;color:white;border-radius:16px;padding:28px 32px;margin-bottom:24px}
h1{margin:0 0 4px;font-size:22px}.sub{opacity:.8;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center}
.val{font-size:28px;font-weight:700;color:#0B3C5D}.lbl{font-size:11px;color:#64748b;margin-top:4px}
.section{margin-bottom:20px}.section h3{color:#0B3C5D;font-size:14px;font-weight:600;margin:0 0 10px;border-bottom:2px solid #4ECDC4;padding-bottom:6px}
.session-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;background:rgba(78,205,196,0.15);color:#4ECDC4}
.rec{background:rgba(11,60,93,0.06);border-left:3px solid #0B3C5D;padding:14px;border-radius:0 8px 8px 0;font-size:13px;color:#0B3C5D;font-style:italic}
.footer{text-align:center;font-size:11px;color:#94a3b8;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px}
</style></head><body>
<div class="header"><h1>4-Session Mentor Progress Report</h1><div class="sub">${childName} · with ${mentorName} · ${completedWithFeedback.length} sessions reviewed</div></div>
<div class="grid">
<div class="kpi"><div class="val">${completedWithFeedback.length}</div><div class="lbl">Sessions Completed</div></div>
<div class="kpi"><div class="val">${avgQ}%</div><div class="lbl">Avg Session Quality</div></div>
<div class="kpi"><div class="val">${completedWithFeedback.filter(s => s.feedback?.wouldRecommend).length}/${completedWithFeedback.length}</div><div class="lbl">Would Recommend</div></div>
</div>
<div class="section"><h3>Session Summary</h3>
${completedWithFeedback.map((s, i) => { const fb = s.feedback!; const q = Math.round((fb.overallRating * 40 + (fb.academicRating || fb.overallRating) * 20 + (fb.engagementRating || fb.overallRating) * 20 + (fb.communicationRating || fb.overallRating) * 20) / 5); return `<div class="session-row"><span>Session ${i + 1} · ${s.sessionType}</span><span class="badge">${q}% Quality</span><span>${s.scheduledDate}</span></div>`; }).join('')}
</div>
<div class="section"><h3>Mentor Recommendation</h3><div class="rec">${rec}</div></div>
<div class="footer">MetryxOne · Mentor Progress Intelligence · Generated ${new Date().toLocaleDateString('en-IN', { weekday:'long',year:'numeric',month:'long',day:'numeric' })}</div>
</body></html>`;
                const blob = new Blob([html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `MetryxOne_MentorProgress_${childName.replace(/\s+/g,'_')}_${completedWithFeedback.length}Sessions.html`;
                a.click();
                URL.revokeObjectURL(url);
              } catch { /* fallback handled */ }
            };
            return (
              <div className="rounded-2xl p-4 border flex items-center gap-4" style={{ background: 'rgba(11,60,93,0.05) 100%)', borderColor: 'rgba(11,60,93,0.15)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: BRAND.primary }}>
                  <Award size={18} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{ color: BRAND.primary }}>{completedWithFeedback.length}-Session Progress Report Ready</div>
                  <div className="text-[11px] text-gray-500">A milestone has been reached — download a comprehensive report on {childName}'s mentor journey with {mentorName}.</div>
                </div>
                <button onClick={handleProgressReport}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold shrink-0 hover:opacity-90 transition-opacity"
                  style={{ background: BRAND.primary }}>
                  <Download size={12} /> Report
                </button>
              </div>
            );
          })()}

          {/* Quick book again */}
          {bookedSessions.length > 0 && (
            <div className="rounded-2xl p-4 border border-dashed border-gray-200 bg-gray-50 text-center">
              <div className="text-sm font-medium text-gray-600 mb-2">Ready to book another session?</div>
              <button onClick={() => setViewMode('recommendations')}
                className="px-5 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90"
                style={{ backgroundColor: BRAND.primary }}>
                <Sparkles size={13} className="inline mr-1" />
                AI Recommendations
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
