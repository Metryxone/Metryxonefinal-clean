import { BRAND } from '@/design-system/tokens';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Star, CheckCircle, MapPin, Clock, Globe2,
  BookOpen, Award, Languages, Calendar, User, Users, X,
} from 'lucide-react';



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

const MENTOR_TYPE_COLORS: Record<string, string> = {
  subject_tutor: '#344E86',
  exam_strategist: '#4ECDC4',
  performance_coach: '#3B8C85',
  psychological_counsellor: '#2A3F6E',
  career_counsellor: '#5B7FBF',
  employability_coach: '#3E9E8F',
  interview_coach: '#6B5EA8',
  leadership_coach: '#B85C2A',
  hr_consultant: '#2E7D6B',
  corporate_trainer: '#4A6FA5',
};

interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface MentorProfile {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
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
  city?: string;
  bio?: string;
  qualifications?: string;
  profilePhoto?: string;
}

interface MentorProfileResponse {
  profile: MentorProfile;
  availability: Slot[];
  reviews: Review[];
}

interface MentorProfilePageProps {
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
  mentorId: string;
  autoBook?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatReviewDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
        />
      ))}
    </div>
  );
}

export function MentorProfilePage({ onNavigate, mentorId, autoBook }: MentorProfilePageProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const bookingRef = useRef<HTMLDivElement>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<'one_on_one' | 'group'>('one_on_one');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookedSession, setBookedSession] = useState<{ slotDate: string; slotTime: string; type: string } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<MentorProfileResponse>({
    queryKey: ['/api/mentor-marketplace', mentorId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/mentor-marketplace/${mentorId}`);
      return res.json();
    },
    enabled: !!mentorId,
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/mentor-sessions', {
        mentorProfileId: mentorId,
        slotId: selectedSlot,
        sessionType: sessionType,
      });
      return res.json();
    },
    onSuccess: () => {
      const slot = data?.availability.find((s) => s.id === selectedSlot);
      setBookedSession({
        slotDate: slot ? formatDate(slot.date) : '',
        slotTime: slot ? `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}` : '',
        type: sessionType === 'one_on_one' ? 'One-on-One' : 'Group Session',
      });
      setShowSuccessModal(true);
      setSelectedSlot(null);
      qc.invalidateQueries({ queryKey: ['/api/mentor-marketplace', mentorId] });
    },
    onError: (err: Error) => {
      toast({
        title: 'Booking Failed',
        description: err.message || 'Could not book session. Please try again.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (autoBook && bookingRef.current && !isLoading) {
      bookingRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoBook, isLoading]);

  const mentor = data?.profile;
  const availability = data?.availability || [];
  const reviews = data?.reviews || [];

  const slotsByDate = availability.reduce<Record<string, Slot[]>>((acc, slot) => {
    const key = slot.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

  const avgRating = mentor?.rating ?? 0;

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', fontFamily: 'Inter, sans-serif' }}>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-6" data-testid="skeleton-back" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-start gap-6">
                <div className="w-24 h-24 rounded-full bg-gray-200 animate-pulse" data-testid="skeleton-avatar" />
                <div className="flex-1 space-y-3">
                  <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-24 bg-gray-200 rounded-lg animate-pulse" data-testid="skeleton-bio" />
              <div className="h-16 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
            </div>
            <div className="space-y-6">
              <div className="h-64 bg-gray-200 rounded-lg animate-pulse" data-testid="skeleton-booking" />
              <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!mentorId || isError || !mentor) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)', fontFamily: 'Inter, sans-serif' }}>
        <div className="text-center space-y-4" data-testid="error-state">
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {!mentorId ? 'No mentor selected' : 'Failed to load mentor profile'}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {!mentorId ? 'Please select a mentor from the marketplace.' : 'Something went wrong. Please try again.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => onNavigate('mentor-marketplace')}
              className="px-6 py-2.5 rounded-lg text-white font-medium text-sm"
              style={{ backgroundColor: BRAND.accent }}
              data-testid="btn-browse-mentors"
            >
              Browse Mentors
            </button>
            {mentorId && (
              <button
                onClick={() => refetch()}
                className="px-6 py-2.5 rounded-lg text-white font-medium text-sm"
                style={{ backgroundColor: BRAND.primary }}
                data-testid="btn-retry"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', fontFamily: 'Inter, sans-serif' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <button
          onClick={() => onNavigate('mentor-marketplace')}
          className="flex items-center gap-1.5 text-sm font-medium mb-6 hover:opacity-80 transition-opacity"
          style={{ color: BRAND.primary }}
          data-testid="btn-back"
        >
          <ArrowLeft size={16} />
          Back to Marketplace
        </button>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row items-start gap-5" data-testid="profile-header">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0"
                style={{ backgroundColor: BRAND.primary }}
                data-testid="avatar-initials"
              >
                {getInitials(mentor.displayName)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }} data-testid="text-mentor-name">
                    {mentor.displayName}
                  </h1>
                  {mentor.verified && (
                    <CheckCircle size={18} className="shrink-0" style={{ color: BRAND.accent }} data-testid="icon-verified" />
                  )}
                </div>

                <span
                  className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium text-white mb-2"
                  style={{ backgroundColor: MENTOR_TYPE_COLORS[mentor.mentorType] || BRAND.primary }}
                  data-testid="badge-mentor-type"
                >
                  {MENTOR_TYPE_LABELS[mentor.mentorType] || mentor.mentorType}
                </span>

                <div className="flex items-center gap-1.5 mb-2" data-testid="rating-display">
                  <StarRating rating={mentor.rating} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{mentor.rating.toFixed(1)}</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>({mentor.totalReviews} reviews)</span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {mentor.city && (
                    <span className="flex items-center gap-1" data-testid="text-city">
                      <MapPin size={13} /> {mentor.city}
                    </span>
                  )}
                  <span className="flex items-center gap-1 capitalize" data-testid="text-mode">
                    <Globe2 size={13} /> {mentor.mode}
                  </span>
                </div>
              </div>
            </div>

            {mentor.bio && (
              <div data-testid="section-bio">
                <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <BookOpen size={15} style={{ color: BRAND.accent }} /> About
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }} data-testid="text-bio">
                  {mentor.bio}
                </p>
              </div>
            )}

            {mentor.qualifications && (
              <div data-testid="section-qualifications">
                <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <Award size={15} style={{ color: BRAND.accent }} /> Qualifications
                </h2>
                <ul className="space-y-1">
                  {mentor.qualifications.split(';').map((q: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }} data-testid={`text-qualification-${i}`}>
                      <CheckCircle size={13} className="shrink-0 mt-0.5" style={{ color: BRAND.accent }} />
                      {q.trim()}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mentor.subjects && mentor.subjects.length > 0 && (
              <div data-testid="section-subjects">
                <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <BookOpen size={15} style={{ color: BRAND.accent }} /> Subjects / Areas
                </h2>
                <div className="flex flex-wrap gap-2">
                  {mentor.subjects.map((s: string, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary }}
                      data-testid={`tag-subject-${i}`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {mentor.languages && mentor.languages.length > 0 && (
              <div data-testid="section-languages">
                <h2 className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <Languages size={15} style={{ color: BRAND.accent }} /> Languages
                </h2>
                <div className="flex flex-wrap gap-2">
                  {mentor.languages.map((l: string, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${BRAND.accent}15`, color: BRAND.accent }}
                      data-testid={`tag-language-${i}`}
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div data-testid="section-experience">
              <h2 className="text-sm font-bold mb-1 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <Clock size={15} style={{ color: BRAND.accent }} /> Experience
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }} data-testid="text-experience">
                {mentor.experienceYears} years of experience
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div
              ref={bookingRef}
              className="rounded-xl border p-5 lg:sticky lg:top-6"
              style={{ borderColor: 'var(--border-color, #e5e7eb)', backgroundColor: 'var(--bg-primary)' }}
              data-testid="booking-card"
            >
              <p className="text-2xl font-bold mb-4" style={{ color: BRAND.primary }} data-testid="text-rate">
                ₹{mentor.hourlyRate}<span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>/hr</span>
              </p>

              <div className="mb-4">
                <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <Calendar size={14} style={{ color: BRAND.accent }} /> Available Slots
                </h3>
                {Object.keys(slotsByDate).length === 0 ? (
                  <p className="text-xs py-3 text-center" style={{ color: 'var(--text-secondary)' }} data-testid="text-no-slots">
                    No available slots right now
                  </p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {Object.entries(slotsByDate).map(([date, slots]) => (
                      <div key={date}>
                        <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }} data-testid={`text-slot-date-${date}`}>
                          {formatDate(date)}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {slots.map((slot) => (
                            <button
                              key={slot.id}
                              onClick={() => setSelectedSlot(selectedSlot === slot.id ? null : slot.id)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium border-2 transition-all"
                              style={{
                                borderColor: selectedSlot === slot.id ? BRAND.accent : 'var(--border-color, #e5e7eb)',
                                backgroundColor: selectedSlot === slot.id ? `${BRAND.accent}10` : 'transparent',
                                color: selectedSlot === slot.id ? BRAND.accent : 'var(--text-secondary)',
                              }}
                              data-testid={`btn-slot-${slot.id}`}
                            >
                              {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <h3 className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Session Type</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSessionType('one_on_one')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all"
                    style={{
                      borderColor: sessionType === 'one_on_one' ? BRAND.accent : 'var(--border-color, #e5e7eb)',
                      backgroundColor: sessionType === 'one_on_one' ? `${BRAND.accent}10` : 'transparent',
                      color: sessionType === 'one_on_one' ? BRAND.accent : 'var(--text-secondary)',
                    }}
                    data-testid="btn-session-one-on-one"
                  >
                    <User size={13} /> One-on-One
                  </button>
                  <button
                    onClick={() => setSessionType('group')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all"
                    style={{
                      borderColor: sessionType === 'group' ? BRAND.accent : 'var(--border-color, #e5e7eb)',
                      backgroundColor: sessionType === 'group' ? `${BRAND.accent}10` : 'transparent',
                      color: sessionType === 'group' ? BRAND.accent : 'var(--text-secondary)',
                    }}
                    data-testid="btn-session-group"
                  >
                    <Users size={13} /> Group Session
                  </button>
                </div>
              </div>

              <button
                onClick={() => bookMutation.mutate()}
                disabled={!selectedSlot || bookMutation.isPending}
                className="w-full py-2.5 rounded-lg text-white font-medium text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: BRAND.accent }}
                data-testid="btn-book-session"
              >
                {bookMutation.isPending ? 'Booking...' : 'Book Session'}
              </button>
            </div>

            <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border-color, #e5e7eb)' }} data-testid="reviews-section">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <Star size={15} style={{ color: BRAND.accent }} /> Reviews
              </h3>

              {reviews.length > 0 && (
                <div className="flex items-center gap-3 mb-4 pb-4" style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }} data-testid="reviews-summary">
                  <span className="text-3xl font-bold" style={{ color: BRAND.primary }}>{avgRating.toFixed(1)}</span>
                  <div>
                    <StarRating rating={avgRating} size={16} />
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {mentor.totalReviews} review{mentor.totalReviews !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              )}

              {reviews.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }} data-testid="text-no-reviews">
                  No reviews yet
                </p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="pb-3" style={{ borderBottom: '1px solid var(--border-color, #e5e7eb)' }} data-testid={`review-${review.id}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }} data-testid={`text-reviewer-${review.id}`}>
                          {review.reviewerName}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }} data-testid={`text-review-date-${review.id}`}>
                          {formatReviewDate(review.createdAt)}
                        </span>
                      </div>
                      <StarRating rating={review.rating} size={12} />
                      {review.comment && (
                        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }} data-testid={`text-review-comment-${review.id}`}>
                          {review.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSuccessModal && bookedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="modal-success">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" data-testid="modal-success-content">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: BRAND.primary }}>Session Booked!</h3>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                data-testid="btn-close-modal"
              >
                <X size={18} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: `${BRAND.accent}10` }}>
              <CheckCircle size={32} className="mx-auto mb-2" style={{ color: BRAND.accent }} />
              <p className="text-center text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Your session has been confirmed
              </p>
            </div>
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Mentor</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }} data-testid="text-booked-mentor">{mentor.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Date</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }} data-testid="text-booked-date">{bookedSession.slotDate}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Time</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }} data-testid="text-booked-time">{bookedSession.slotTime}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Type</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }} data-testid="text-booked-type">{bookedSession.type}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onNavigate('mentor-sessions')}
                className="flex-1 py-2.5 rounded-lg text-white font-medium text-sm"
                style={{ backgroundColor: BRAND.accent }}
                data-testid="btn-view-sessions"
              >
                View My Sessions
              </button>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="flex-1 py-2.5 rounded-lg font-medium text-sm border"
                style={{ borderColor: 'var(--border-color, #e5e7eb)', color: 'var(--text-primary)' }}
                data-testid="btn-close-success"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
