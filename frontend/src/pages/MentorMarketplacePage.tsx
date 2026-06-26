import { BRAND } from '@/design-system/tokens';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Screen } from '../App';
import {
  Search, Star, CheckCircle, ChevronLeft, ChevronRight, Users, Filter,
  BookOpen, Brain, Target, Shield, Award, Clock, MapPin, Globe2,
  GraduationCap, ArrowRight, Sparkles, Heart, Briefcase, TrendingUp
} from 'lucide-react';

import mentor1 from '@/assets/images/mentor1.webp';
import mentor2 from '@/assets/images/mentor2.webp';
import mentor3 from '@/assets/images/mentor3.webp';
import mentor4 from '@/assets/images/mentor4.webp';
import mentor5 from '@/assets/images/mentor5.webp';
import mentor6 from '@/assets/images/mentor6.webp';
import mentor7 from '@/assets/images/mentor7.webp';
import mentor8 from '@/assets/images/mentor8.webp';



const MENTOR_THUMBNAILS: Record<number, string> = {
  0: mentor1, 1: mentor2, 2: mentor3, 3: mentor4,
  4: mentor5, 5: mentor6, 6: mentor7, 7: mentor8,
};

const MENTOR_TYPE_LABELS: Record<string, string> = {
  subject_tutor: 'Subject Tutor',
  exam_strategist: 'Exam Strategist',
  performance_coach: 'Performance Coach',
  psychological_counsellor: 'Psychological Counsellor',
  career_counsellor: 'Career Counsellor',
  employability_coach: 'Employability Coach',
  interview_coach: 'Interview Coach',
  leadership_coach: 'Leadership Coach',
  hr_consultant: 'HR Consultant',
  corporate_trainer: 'Corporate Trainer',
};

const MENTOR_TYPE_ICONS: Record<string, typeof BookOpen> = {
  subject_tutor: BookOpen,
  exam_strategist: Target,
  performance_coach: TrendingUp,
  psychological_counsellor: Heart,
  career_counsellor: TrendingUp,
  employability_coach: Target,
  interview_coach: BookOpen,
  leadership_coach: TrendingUp,
  hr_consultant: Heart,
  corporate_trainer: BookOpen,
};

const MENTOR_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'subject_tutor', label: 'Subject Tutor' },
  { value: 'exam_strategist', label: 'Exam Strategist' },
  { value: 'performance_coach', label: 'Performance Coach' },
  { value: 'psychological_counsellor', label: 'Psychological Counsellor' },
  { value: 'career_counsellor', label: 'Career Counsellor' },
  { value: 'employability_coach', label: 'Employability Coach' },
  { value: 'interview_coach', label: 'Interview Coach' },
  { value: 'leadership_coach', label: 'Leadership Coach' },
  { value: 'hr_consultant', label: 'HR Consultant' },
  { value: 'corporate_trainer', label: 'Corporate Trainer' },
];

const SUBJECT_OPTIONS = [
  { value: '', label: 'All Subjects' },
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'Physics', label: 'Physics' },
  { value: 'Chemistry', label: 'Chemistry' },
  { value: 'Biology', label: 'Biology' },
  { value: 'English', label: 'English' },
  { value: 'Computer Science', label: 'Computer Science' },
  { value: 'Psychology', label: 'Psychology' },
];

const MODE_OPTIONS = [
  { value: '', label: 'All Modes' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'hybrid', label: 'Hybrid' },
];

const RATING_OPTIONS = [
  { value: '', label: 'Any Rating' },
  { value: '4', label: '4+ Stars' },
  { value: '4.5', label: '4.5+ Stars' },
];

const SORT_OPTIONS = [
  { value: 'rating_desc', label: 'Highest Rated' },
  { value: 'rate_asc', label: 'Lowest Price' },
  { value: 'rate_desc', label: 'Highest Price' },
  { value: 'experience', label: 'Most Experienced' },
];

const CATEGORIES = [
  { type: 'subject_tutor', title: 'Subject Tutors', desc: 'Expert teachers for Mathematics, Science, English and more', icon: BookOpen, count: '200+' },
  { type: 'exam_strategist', title: 'Exam Strategists', desc: 'JEE, NEET, UPSC preparation and strategy experts', icon: Target, count: '120+' },
  { type: 'performance_coach', title: 'Performance Coaches', desc: 'Study habits, discipline & academic productivity', icon: TrendingUp, count: '60+' },
  { type: 'psychological_counsellor', title: 'Counsellors', desc: 'Licensed psychologists for stress, anxiety and learning support', icon: Heart, count: '80+' },
  { type: 'career_counsellor', title: 'Career Counsellors', desc: 'Career pathways, goal-setting and higher education guidance', icon: TrendingUp, count: '90+' },
  { type: 'employability_coach', title: 'Employability Coaches', desc: 'Job readiness, workplace skills and soft skills development', icon: Target, count: '70+' },
  { type: 'interview_coach', title: 'Interview Coaches', desc: 'Interview preparation, placement & campus recruitment', icon: BookOpen, count: '50+' },
  { type: 'leadership_coach', title: 'Leadership Coaches', desc: 'Leadership development and executive coaching', icon: TrendingUp, count: '40+' },
  { type: 'hr_consultant', title: 'HR Consultants', desc: 'Talent management, workforce development and OD', icon: Heart, count: '30+' },
  { type: 'corporate_trainer', title: 'Corporate Trainers', desc: 'L&D, team training and capability building', icon: BookOpen, count: '45+' },
];

const STATS = [
  { value: '500+', label: 'Verified Mentors', icon: Users },
  { value: '25K+', label: 'Sessions Completed', icon: Briefcase },
  { value: '4.7', label: 'Average Rating', icon: Star },
  { value: '98%', label: 'Satisfaction Rate', icon: Award },
];

interface Mentor {
  id: string;
  displayName: string;
  mentorType: string;
  verified: boolean;
  rating: number;
  totalReviews: number;
  totalSessions: number;
  subjects: string[] | null;
  psychologicalAreas: string[] | null;
  languages: string[] | null;
  experienceYears: number;
  hourlyRate: number;
  mode: string;
  bio: string | null;
  city: string | null;
  profilePhoto?: string;
}

interface MentorMarketplaceResponse {
  mentors: Mentor[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Props {
  onNavigate: (screen: Screen | string, data?: Record<string, unknown>) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse" data-testid="skeleton-card">
      <div className="h-44 bg-gray-100" />
      <div className="p-5">
        <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-full mb-4" />
        <div className="flex gap-2 mb-4"><div className="h-6 bg-gray-200 rounded-full w-16" /><div className="h-6 bg-gray-200 rounded-full w-16" /></div>
        <div className="flex gap-3"><div className="h-10 bg-gray-200 rounded-xl flex-1" /><div className="h-10 bg-gray-200 rounded-xl flex-1" /></div>
      </div>
    </div>
  );
}

export function MentorMarketplacePage({ onNavigate }: Props) {
  const [search, setSearch] = useState('');
  const [mentorType, setMentorType] = useState('');
  const [subject, setSubject] = useState('');
  const [mode, setMode] = useState('');
  const [minRating, setMinRating] = useState('');
  const [sort, setSort] = useState('rating_desc');
  const [page, setPage] = useState(1);
  const limit = 12;

  const { data, isLoading } = useQuery<MentorMarketplaceResponse>({
    queryKey: ['mentor-marketplace', search, mentorType, subject, mode, minRating, sort, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (mentorType) params.set('mentorType', mentorType);
      if (subject) params.set('subject', subject);
      if (mode) params.set('mode', mode);
      if (minRating) params.set('minRating', minRating);
      if (sort) params.set('sort', sort);
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      const res = await apiRequest('GET', `/api/mentor-marketplace?${params.toString()}`);
      return res.json();
    },
  });

  const mentors = data?.mentors || [];
  const total = data?.totalCount || 0;
  const totalPages = data?.totalPages || 1;
  const hasActiveFilters = search || mentorType || subject || mode || minRating;

  const clearFilters = () => {
    setSearch(''); setMentorType(''); setSubject(''); setMode(''); setMinRating(''); setSort('rating_desc'); setPage(1);
  };

  const selectClass = "h-10 px-4 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/40 focus:border-[#4ECDC4] appearance-none cursor-pointer transition-all";

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fc] font-['Inter',sans-serif]" data-testid="mentor-marketplace-page">
      <Navbar onNavigate={onNavigate} currentScreen="mentor-marketplace" />

      {/* Hero Section */}
      <section className="pt-24 pb-12 md:pt-28 md:pb-16 px-4" style={{ backgroundColor: BRAND.primary }} data-testid="hero-section">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-medium mb-6" data-testid="hero-badge">
            <Sparkles size={14} />
            AI-Powered Mentor Matching
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4 leading-tight" data-testid="text-page-title">
            Find Your Perfect Mentor
          </h1>
          <p className="text-base md:text-lg text-white/70 max-w-2xl mx-auto mb-8 leading-relaxed" data-testid="text-page-subtitle">
            Connect with verified expert tutors, counsellors, and coaches for personalised academic guidance, exam preparation, and emotional wellbeing support.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search mentors by name, subject, or specialisation..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full h-14 pl-12 pr-4 text-base rounded-2xl bg-white shadow-lg focus:outline-none focus:ring-2 focus:ring-[#4ECDC4] border-0"
                data-testid="input-search"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-b border-gray-100 bg-white" data-testid="stats-section">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                    <Icon size={18} style={{ color: BRAND.accent }} />
                  </div>
                  <div>
                    <p className="text-lg md:text-xl font-bold" style={{ color: BRAND.primary }}>{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Category Cards */}
      <section className="py-10 px-4" data-testid="categories-section">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold" style={{ color: BRAND.primary }} data-testid="text-categories-title">Browse by Category</h2>
              <p className="text-sm text-gray-500 mt-1">Choose the type of mentorship you need</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = mentorType === cat.type;
              return (
                <button
                  key={cat.type}
                  onClick={() => { setMentorType(isActive ? '' : cat.type); setPage(1); }}
                  className={`relative text-left p-5 rounded-2xl border-2 transition-all hover:shadow-md group ${
                    isActive ? 'border-[#4ECDC4] bg-[#4ECDC4]/5 shadow-md' : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                  data-testid={`category-${cat.type}`}
                >
                  {isActive && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle size={18} style={{ color: BRAND.accent }} />
                    </div>
                  )}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: isActive ? `${BRAND.accent}20` : `${BRAND.primary}08` }}>
                    <Icon size={20} style={{ color: isActive ? BRAND.accent : BRAND.primary }} />
                  </div>
                  <h3 className="text-sm font-bold mb-1" style={{ color: BRAND.primary }}>{cat.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed mb-2">{cat.desc}</p>
                  <span className="text-xs font-semibold" style={{ color: BRAND.accent }}>{cat.count} available</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Filters + Results */}
      <section className="px-4 pb-16" data-testid="results-section">
        <div className="max-w-7xl mx-auto">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 shadow-sm" data-testid="filter-bar">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} style={{ color: BRAND.primary }} />
              <span className="text-sm font-bold" style={{ color: BRAND.primary }}>Refine Results</span>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="ml-auto text-xs font-medium px-3 py-1 rounded-full hover:bg-gray-50 transition-colors" style={{ color: BRAND.accent }} data-testid="button-clear-filters">
                  Clear all filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <select value={mentorType} onChange={(e) => { setMentorType(e.target.value); setPage(1); }} className={selectClass} data-testid="select-mentor-type">
                {MENTOR_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <select value={subject} onChange={(e) => { setSubject(e.target.value); setPage(1); }} className={selectClass} data-testid="select-subject">
                {SUBJECT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <select value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }} className={selectClass} data-testid="select-mode">
                {MODE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <select value={minRating} onChange={(e) => { setMinRating(e.target.value); setPage(1); }} className={selectClass} data-testid="select-min-rating">
                {RATING_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={selectClass} data-testid="select-sort">
                {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>

          {/* Results Header */}
          <div className="flex items-center justify-between mb-5" data-testid="results-count-bar">
            <div>
              <h2 className="text-lg font-bold" style={{ color: BRAND.primary }}>
                {hasActiveFilters ? 'Filtered Results' : 'All Mentors'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5" data-testid="text-results-count">
                Showing <span className="font-semibold" style={{ color: BRAND.primary }}>{total}</span> mentor{total !== 1 ? 's' : ''}
                {mentorType && ` in ${MENTOR_TYPE_LABELS[mentorType] || mentorType}`}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg">
              <Filter size={12} />
              Page {page} of {totalPages}
            </div>
          </div>

          {/* Mentor Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" data-testid="loading-grid">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : mentors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-100" data-testid="empty-state">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: `${BRAND.primary}08` }}>
                <Users size={32} style={{ color: BRAND.primary }} />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: BRAND.primary }} data-testid="text-empty-title">No mentors found</h3>
              <p className="text-sm text-gray-500 max-w-md mb-5" data-testid="text-empty-desc">
                We couldn't find mentors matching your criteria. Try adjusting your filters or broadening your search.
              </p>
              <button onClick={clearFilters} className="h-10 px-6 text-sm font-semibold rounded-xl text-white transition-colors hover:opacity-90" style={{ backgroundColor: BRAND.accent }} data-testid="button-clear-empty">
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" data-testid="mentor-grid">
              {mentors.map((mentor, idx) => {
                const typeLabel = MENTOR_TYPE_LABELS[mentor.mentorType] || mentor.mentorType;
                const TypeIcon = MENTOR_TYPE_ICONS[mentor.mentorType] || BookOpen;
                const thumbnail = MENTOR_THUMBNAILS[idx % 8];

                return (
                  <div
                    key={mentor.id}
                    className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all group"
                    data-testid={`card-mentor-${mentor.id}`}
                  >
                    {/* Card Header - Photo */}
                    <div className="relative h-48 overflow-hidden" data-testid={`photo-${mentor.id}`}>
                      <img
                        src={thumbnail}
                        alt={mentor.displayName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />

                      {/* Overlays */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-sm" style={{ color: BRAND.primary }}>
                          <TypeIcon size={12} />
                          {typeLabel}
                        </span>
                      </div>
                      {mentor.verified && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-white/90 backdrop-blur-sm" style={{ color: BRAND.accent }} data-testid={`badge-verified-${mentor.id}`}>
                          <Shield size={12} />
                          Verified
                        </div>
                      )}

                      {/* Bottom overlay info */}
                      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                        <div>
                          <h3 className="text-white font-bold text-base leading-tight drop-shadow-md" data-testid={`text-name-${mentor.id}`}>
                            {mentor.displayName}
                          </h3>
                          {mentor.city && (
                            <p className="flex items-center gap-1 text-white/80 text-xs mt-0.5">
                              <MapPin size={10} /> {mentor.city}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-lg">
                          <Star size={12} fill="#fbbf24" stroke="#fbbf24" />
                          <span className="text-white text-xs font-bold">{mentor.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4">
                      {/* Quick Stats Row */}
                      <div className="flex items-center gap-4 mb-3 pb-3 border-b border-gray-50">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock size={12} style={{ color: BRAND.accent }} />
                          <span>{mentor.experienceYears} yrs exp</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Users size={12} style={{ color: BRAND.accent }} />
                          <span>{mentor.totalSessions} sessions</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Star size={12} style={{ color: BRAND.accent }} />
                          <span>{mentor.totalReviews} reviews</span>
                        </div>
                      </div>

                      {/* Subjects */}
                      {mentor.subjects && mentor.subjects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3" data-testid={`subjects-${mentor.id}`}>
                          {mentor.subjects.slice(0, 3).map((subj: string, i: number) => (
                            <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${BRAND.primary}08`, color: BRAND.primary }} data-testid={`tag-subject-${mentor.id}-${i}`}>
                              {subj}
                            </span>
                          ))}
                          {mentor.subjects.length > 3 && (
                            <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-gray-50 text-gray-400">
                              +{mentor.subjects.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Languages */}
                      {mentor.languages && mentor.languages.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3" data-testid={`text-languages-${mentor.id}`}>
                          <Globe2 size={12} className="text-gray-400 shrink-0" />
                          <span className="truncate">{mentor.languages.join(', ')}</span>
                        </div>
                      )}

                      {/* Mode Badge */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4" data-testid={`badge-mode-${mentor.id}`}>
                        {mentor.mode === 'online' ? <Globe2 size={12} className="text-emerald-500" /> :
                         mentor.mode === 'offline' ? <MapPin size={12} className="text-amber-500" /> :
                         <Globe2 size={12} className="text-blue-500" />}
                        <span className="capitalize">{mentor.mode}</span>
                      </div>

                      {/* Price + Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                        <div data-testid={`text-rate-${mentor.id}`}>
                          <span className="text-xl font-bold" style={{ color: BRAND.primary }}>₹{mentor.hourlyRate}</span>
                          <span className="text-xs text-gray-400">/session</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onNavigate('mentor-profile', { mentorId: mentor.id })}
                            className="h-9 px-4 text-xs font-semibold rounded-xl border-2 transition-all hover:shadow-sm"
                            style={{ borderColor: BRAND.primary, color: BRAND.primary }}
                            data-testid={`button-view-profile-${mentor.id}`}
                          >
                            Profile
                          </button>
                          <button
                            onClick={() => onNavigate('mentor-profile', { mentorId: mentor.id, autoBook: true })}
                            className="h-9 px-4 text-xs font-semibold rounded-xl text-white transition-all hover:shadow-md hover:opacity-90"
                            style={{ backgroundColor: BRAND.accent }}
                            data-testid={`button-book-session-${mentor.id}`}
                          >
                            Book Now
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && mentors.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10" data-testid="pagination">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-10 px-4 text-sm font-medium rounded-xl border border-gray-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                data-testid="button-prev-page"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (page <= 3) pageNum = i + 1;
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = page - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`h-10 w-10 text-sm font-semibold rounded-xl transition-all ${
                      page === pageNum ? 'text-white shadow-md' : 'border border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    style={page === pageNum ? { backgroundColor: BRAND.primary } : {}}
                    data-testid={`button-page-${pageNum}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-10 px-4 text-sm font-medium rounded-xl border border-gray-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                data-testid="button-next-page"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 pb-16" data-testid="cta-section">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-2xl p-8 md:p-12 text-center" style={{ backgroundColor: BRAND.primary }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium mb-4">
              <GraduationCap size={14} />
              For Mentors
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Are You an Expert Educator?</h2>
            <p className="text-white/70 max-w-xl mx-auto mb-6 text-sm md:text-base leading-relaxed">
              Join MetryxOne's mentor network. Reach thousands of students, set your own schedule, and earn on your terms. We handle the platform, you deliver the impact.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => onNavigate('login')}
                className="h-12 px-8 text-sm font-bold rounded-xl text-white transition-all hover:opacity-90 flex items-center gap-2"
                style={{ backgroundColor: BRAND.accent }}
                data-testid="button-become-mentor"
              >
                Sign In as Mentor <ArrowRight size={16} />
              </button>
              <button
                onClick={() => onNavigate('request-demo')}
                className="h-12 px-8 text-sm font-bold rounded-xl bg-white/10 text-white border border-white/20 transition-all hover:bg-white/20 flex items-center gap-2"
                data-testid="button-request-demo"
              >
                Request a Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
