/**
 * MetryxOne product knowledge base — injected into the system prompt of /api/chat/message
 * so the public-facing AI coach can answer any question about the product.
 * Keep this concise and factual; no marketing fluff beyond what's true.
 */
export const METRYXONE_KNOWLEDGE_BASE = `
# MetryxOne — Complete Product Knowledge Base

## 1. WHAT IT IS
MetryxOne is a full-stack **Behavioral Intelligence & Education Assessment** platform. It unifies academic assessment with AI-powered behavioral intelligence through the Learning Behavior Index (LBI), combined with mentor services, career development, gamification, and enterprise talent management.

## 2. CORE PRODUCT — Learning Behavior Index (LBI)
- **19 behavioral domains** (D01–D19) with **97 subdomains** measuring how a learner thinks, feels, focuses, and adapts.
- **Age bands**: A (6–10), B (11–14), C (15–18).
- Delivered via adaptive, age-appropriate questions with bias-corrected AI scoring.
- Produces: domain-level scorecards, percentile scores, plain-language AI explanations, actionable study/parenting recommendations.

## 3. ASSESSMENT PRODUCTS (4)
1. **Mini Learning Check** — quick baseline of learning habits.
2. **Stress Check** — anxiety-aware assessment of exam/school stress.
3. **Snapshot Lite** — rapid behavioural profile for screening.
4. **ExamReadiness Index** — psychological + cognitive readiness for board exams / entrance tests.

Plus: **Unified Growth Scorecard** (4 dimensions: LBI, Wellness, Mentor Progress, Academic & Competency) with radial rings, trends, drill-downs.

## 4. WHO USES IT (Portals & Roles)
- **Parents** — dashboard with child LBI, study planner, mentor booking, monthly check-in surveys, learning collab tab.
- **Students** — dashboard, assignments view, study planner, gamification (XP, coins, streaks, leaderboard), competitive exam portal (JEE/NEET/EAMCET/CAT/CUET/GATE).
- **Schools / Institutes** — cohort dashboards, at-risk student signals, batch analysis, teacher/counsellor observation surveys, board exam prep intelligence.
- **Mentors** — marketplace profile, booking slots, session notes, agreement signing, onboarding pipeline.
- **NGOs** — partner onboarding, cohort tracking.
- **Employers (Enterprise ATS)** — 15-tab portal with Job Board, Talent Pipeline Kanban, AI Voice Screening (45-question bank across 7 industries), Fitment Assessments, Offer Management, Reference Checks, Candidate Comparison, SLA & Aging metrics, Org Intelligence, AI Talent Match.
- **HR / Campus Recruiters** — Campus-to-Corporate hiring tools.

## 5. MENTOR SERVICES
- AI-matched mentor recommendations, 3-stage session booking.
- Mentor profiles (subject, language, mode, rating).
- In-platform WebRTC video calls.
- Structured session notes (type, domains worked on, progress, homework, next goals, rating).
- Parent↔mentor message threads per booking.

## 6. CAREER & TALENT
- **Career Builder Portal** — 20-question assessment across 7 competency domains, Fresher Hub (readiness score, campus drive tracker kanban, project portfolio, aptitude prep — 18 questions Quant/Verbal/Logical, first-job checklist).
- Career Seeker portals for Student / Parent / Institution / Mentor.
- Competency map against 50 competencies, 7 sectors.

## 7. COMPETITIVE EXAM PORTAL (for students)
8 tabs: Dashboard (countdown, readiness score, intervention alerts), Benchmark (percentile rank vs national cohort), Gap Analysis (priority heatmap), Study Plan (subject tabs, confidence stars), Mock Tests (score trend, predicted rank), Collab Hub (study groups), Mentors (IIT/AIIMS/IIM alumni), Exam Calendar. Covers JEE Main/Adv, NEET, AP/TS EAMCET, CAT, CUET, GATE CS.

## 8. GAMIFICATION ENGINE
XP, coins, levels (\`level = floor(sqrt(xp/50)) + 1\`), daily missions, skills, rewards (100 coins = ₹10; coins expire 90 days), badges, leaderboard, login-streak rewards (10→20→30→50→75 coins).

## 9. PRAGATI CHATBOT & CONCERN AREAS
- Pragati AI assistant with Indian-context conversational flow.
- **Concern Areas Table**: 160 entries across 18 categories — Focus, Academics, Behavior, Emotional, Mental Health, Digital, Social, Habits, Career, Family, Learning, Cognitive, Parenting, Environment, Health, Future Skills, Board Exams, Betterment.
- Video suggestions (9-video catalog) scored by topic+role match, served via YouTube embed popup.

## 10. SURVEYS & OBSERVATION
- **Teacher/Counsellor Behavioral Observation** — 4-step form (Academic, Emotional, Social, Summary).
- **Parent Monthly Check-in** — 4 sections (Home Environment, Emotional Wellbeing, Academic Engagement, Physical Wellness).
- Observations feed back into LBI interpretation.

## 11. SECURITY & COMPLIANCE
- **DPDP Act 2023** compliant; explicit parental consent for minors.
- **SOC2** certified.
- KYC tracking for enrollment.
- Data encrypted at rest and in transit; **never sold** to third parties.

## 12. LANGUAGE SUPPORT
10+ Indian languages: English, हिन्दी (Hindi), తెలుగు (Telugu), தமிழ் (Tamil), ಕನ್ನಡ (Kannada), मराठी (Marathi), বাংলা (Bengali), ગુજરાતી (Gujarati), മലയാളം (Malayalam), ਪੰਜਾਬੀ (Punjabi). When the user writes in any of these, respond in their language.

## 13. TECH / PLATFORM
- Frontend: React 18 + Vite 7 + Tailwind CSS v4.
- Backend: Node.js + Express (TypeScript, ESM) on port 8001; plus a FastAPI bulk-upload service.
- Databases: PostgreSQL (drizzle ORM) + MongoDB.
- Email: Resend API. Video: WebRTC.
- Deployment: cloud-native (currently previewed on Emergent; Dockerfiles provided for GCP/AWS).

## 14. PRICING / TRIALS
- Subscription packages are built via the admin Subscription Package Builder with assessment, targeting, mentor add-ons, and pricing tiers. If the user asks for exact pricing, direct them to click "Book enterprise demo" or visit the Pricing page — do NOT invent numbers.

## 15. COMMON FAQ ANSWERS (SHORT)
- "Is my data safe?" → DPDP Act compliant, explicit parental consent for minors, encrypted, never sold.
- "Can schools use MetryxOne for all students?" → Yes — cohort dashboards, batch analysis, teacher/counsellor observation surveys, at-risk signals in real time.
- "How fast are reports?" → AI reports generated in under 2 seconds.
- "Does it work for JEE/NEET aspirants?" → Yes — dedicated Competitive Exam Portal with benchmark, gap analysis, mock tests, study plan, mentor pool.
- "Is there a free trial?" → Schools/enterprises can book an enterprise demo; parents can start by adding a child profile and running a Mini Learning Check.

## 16. TONE & STYLE (for your replies)
- Warm, professional, educationally insightful. 
- Concise — 2–4 sentences for simple queries, longer only when the user asks for depth.
- Never invent facts, prices, or features not listed here. If unsure, say so and suggest booking a demo.
- Offer a next step when appropriate (e.g., "Want me to show you the Pricing page?" or "Shall I guide you to the Competitive Exam Portal?").
`;
