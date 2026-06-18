/**
 * Video recommendation logic — pure, side-effect-free module.
 * Extracted from routes/chat.ts so it can be unit-tested without a live server.
 */

export type UserType =
  | 'student' | 'teacher' | 'parent' | 'hr'
  | 'institution' | 'job_seeker' | 'career'
  | 'corporate' | 'coach' | 'guest';

export interface VideoItem {
  id: string;
  title: string;
  description: string;
  duration: string;
  thumbnail: string;
  embedUrl: string;
  topics: string[];
  forRoles: UserType[];
}

export interface VideoSession {
  userType: UserType | null;
  detectedTopics: string[];
}

export const VIDEO_CATALOG: VideoItem[] = [
  {
    id: 'v_lbi_intro',
    title: 'What is LBI? — 90 Second Overview',
    description: "See how India's first Learning Behaviour Index maps 19 domains of how your child learns",
    duration: '1:30',
    thumbnail: '/video-thumbnails/lbi-intro.jpg',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    topics: ['lbi', 'assessment', 'about', 'learning'],
    forRoles: ['parent', 'student', 'teacher', 'guest', 'coach'],
  },
  {
    id: 'v_exam_ready',
    title: 'ExamReady Index — How It Works',
    description: 'AI-powered exam readiness prediction for boards, JEE, NEET and more',
    duration: '2:15',
    thumbnail: '/video-thumbnails/exam-ready.jpg',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    topics: ['exam_ready', 'exam', 'boards'],
    forRoles: ['parent', 'student', 'teacher', 'guest'],
  },
  {
    id: 'v_parent_guide',
    title: "A Parent's Guide to Behavioural Intelligence",
    description: 'How to support your child using personalised LBI insights — real parent stories',
    duration: '3:45',
    thumbnail: '/video-thumbnails/parent-guide.jpg',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    topics: ['parent', 'learning', 'behaviour'],
    forRoles: ['parent', 'guest'],
  },
  {
    id: 'v_mentor_match',
    title: 'How Mentor Matching Works',
    description: 'See how LBI profiles are used to match your child with the perfect mentor',
    duration: '2:00',
    thumbnail: '/video-thumbnails/mentor-match.jpg',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    topics: ['mentor'],
    forRoles: ['parent', 'student', 'guest', 'coach'],
  },
  {
    id: 'v_school_demo',
    title: 'MetryxOne for Schools — Platform Demo',
    description: 'How 200+ schools use cohort analytics and behavioural intelligence',
    duration: '4:00',
    thumbnail: '/video-thumbnails/school-demo.jpg',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    topics: ['institution'],
    forRoles: ['institution', 'teacher', 'guest'],
  },
  {
    id: 'v_hr_hiring',
    title: 'LBI-Powered Hiring Intelligence',
    description: 'Predict culture fit and behavioural alignment before the interview',
    duration: '2:30',
    thumbnail: '/video-thumbnails/hr-hiring.jpg',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    topics: ['hr_hiring', 'enterprise', 'competency'],
    forRoles: ['hr', 'corporate', 'guest'],
  },
  {
    id: 'v_focus_tips',
    title: "5 Ways to Improve Your Child's Focus",
    description: "Science-backed strategies from MetryxOne's behavioural research team",
    duration: '3:10',
    thumbnail: '/video-thumbnails/focus-tips.jpg',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    topics: ['learning', 'behaviour', 'phone_screen'],
    forRoles: ['parent', 'student', 'guest'],
  },
  {
    id: 'v_career_path',
    title: 'Finding the Right Career Path with LBI',
    description: 'How behavioural data helps identify your ideal career direction',
    duration: '2:45',
    thumbnail: '/video-thumbnails/career-path.jpg',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    topics: ['career', 'stream_selection'],
    forRoles: ['student', 'parent', 'career', 'guest'],
  },
  {
    id: 'v_board_prep',
    title: 'Board Exam Preparation — The Behavioural Edge',
    description: 'How LBI insights give students a genuine advantage in board exams',
    duration: '3:00',
    thumbnail: '/video-thumbnails/board-prep.jpg',
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    topics: ['exam', 'boards', 'burnout'],
    forRoles: ['parent', 'student', 'teacher', 'guest'],
  },
];

export function validateVideoCatalog(catalog: VideoItem[]): void {
  const bad: string[] = [];

  for (const video of catalog) {
    const missing: string[] = [];
    if (!video.topics || video.topics.length === 0) missing.push('topics');
    if (!video.forRoles || video.forRoles.length === 0) missing.push('forRoles');
    if (missing.length > 0) {
      bad.push(`  [${video.id}] missing: ${missing.join(', ')}`);
    }
  }

  if (bad.length > 0) {
    const message = [
      `VIDEO_CATALOG validation failed — ${bad.length} entry/entries have no topics or roles configured:`,
      ...bad,
      'Each video must have at least one topic and one forRole.',
    ].join('\n');
    console.error(message);
    throw new Error(message);
  }
}

validateVideoCatalog(VIDEO_CATALOG);

export function scoreVideo(video: VideoItem, role: UserType, allTopics: string[], message: string): number {
  let score = 0;
  for (const t of video.topics) {
    if (allTopics.includes(t)) score += 3;
  }
  if (video.forRoles.includes(role)) score += 2;
  const lower = message.toLowerCase();
  if (lower.includes('video') || lower.includes('watch') || lower.includes('show me') || lower.includes('see')) score += 5;
  if (video.title.toLowerCase().split(' ').some(w => w.length > 3 && lower.includes(w.toLowerCase()))) score += 1;
  return score;
}

export function selectVideos(session: VideoSession, topics: string[], message: string): VideoItem[] {
  const role = session.userType ?? 'guest';
  const allTopics = [...new Set([...topics, ...session.detectedTopics])];

  const scored = VIDEO_CATALOG.map(v => ({ video: v, score: scoreVideo(v, role, allTopics, message) }));

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(s => s.video);
}
