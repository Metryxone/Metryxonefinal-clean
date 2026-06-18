-- ───────────────────────────────────────────────────────────────────────────────
-- MEI v2 Supplementary Seeds
-- ───────────────────────────────────────────────────────────────────────────────
-- Run AFTER 20260611_mei_v2.sql.  All inserts are idempotent (ON CONFLICT DO NOTHING).
-- Adds:
--   • 17 additional insight rules  (candidate strength/gap coverage for all 5 dims;
--     composite insight types multi_session + career_change; counselor dim rules;
--     employer band + strength rules)
--   • 6 additional recommendation master entries  (reaching 15 total)
-- ───────────────────────────────────────────────────────────────────────────────

-- ─── ADDITIONAL INSIGHT RULES ────────────────────────────────────────────────

INSERT INTO mei_insight_rules
  (rule_type, trigger_field, trigger_operator, trigger_value, narrative_template, tone, audience, priority)
VALUES

-- ── Candidate: missing dimension_strength coverage (KF + PS) ─────────────────
(
  'dimension_strength', 'knowledge_foundation', 'gte', '70'::jsonb,
  'Your Knowledge Foundation score of {{dim_score}} is a strong opening impression. Your academic credentials and institution quality create trust with employers before the first conversation.',
  'direct', 'candidate', 80
),
(
  'dimension_strength', 'portfolio_signal', 'gte', '70'::jsonb,
  'Your Portfolio & Presence score of {{dim_score}} means your work is visible and substantiated. This is especially valuable with employers who review profiles before shortlisting.',
  'direct', 'candidate', 80
),

-- ── Candidate: missing dimension_gap coverage (PE + KF) ──────────────────────
(
  'dimension_gap', 'professional_experience', 'lte', '35'::jsonb,
  'Your Professional Experience signal is at {{dim_score}} — documenting your full role history with titles, months, and companies can unlock up to {{max_gain}} points. Even short-term roles count.',
  'supportive', 'candidate', 90
),
(
  'dimension_gap', 'knowledge_foundation', 'lte', '35'::jsonb,
  'Your Knowledge Foundation is at {{dim_score}}. Adding a recent professional certification or completing an online course are the fastest levers — they contribute directly to your Continuous Learning subdimension.',
  'motivational', 'candidate', 88
),

-- ── Candidate: additional composite insights ──────────────────────────────────
(
  'composite_insight', 'composite', 'any', '{"type":"multi_session"}'::jsonb,
  'You have completed multiple CAPADEX sessions. Your consistency across sessions strengthens your Behavioural Consistency signal — this is one of the harder-to-fake indicators on your profile.',
  'motivational', 'candidate', 82
),
(
  'composite_insight', 'composite', 'any', '{"type":"career_change"}'::jsonb,
  'Your cross-industry experience is an adaptability signal that many candidates lack. Make sure your profile explicitly calls this out — it directly improves your Cross-Industry Breadth subdimension.',
  'direct', 'candidate', 80
),

-- ── Counselor: dimension-level gap rules ─────────────────────────────────────
(
  'dimension_gap', 'validated_proficiency', 'lte', '40'::jsonb,
  'Candidate Validated Proficiency at {{dim_score}}. Priority intervention: schedule formal competency assessment. Potential gain: up to {{max_gain}} points on the composite.',
  'direct', 'counselor', 90
),
(
  'dimension_gap', 'behavioural_intelligence', 'lte', '35'::jsonb,
  'Candidate Behavioural Intelligence signals are absent or low ({{dim_score}}). Recommend CAPADEX session before placement. BI can gain up to {{max_gain}} points post-assessment.',
  'direct', 'counselor', 90
),
(
  'dimension_gap', 'portfolio_signal', 'lte', '35'::jsonb,
  'Candidate Portfolio & Presence at {{dim_score}}. Recommended counsellor action: guide candidate to complete profile and add project descriptions. Quick low-effort gain.',
  'direct', 'counselor', 85
),
(
  'band', 'band', 'eq', '"hire_ready"'::jsonb,
  'Candidate is Hire-Ready ({{score}}). Profile is strong across key dimensions. Focus counselling on job targeting, interview preparation, and application velocity.',
  'direct', 'counselor', 100
),
(
  'band', 'band', 'eq', '"career_ready"'::jsonb,
  'Candidate is Career-Ready ({{score}}). Recommend closing the {{weakest_dimension}} gap before placement. One targeted action can move them into the Hire-Ready band.',
  'direct', 'counselor', 100
),

-- ── Employer: band narratives ─────────────────────────────────────────────────
(
  'band', 'band', 'eq', '"hire_ready"'::jsonb,
  'Candidate MEI {{score}} — Hire-Ready. Assessment scores, experience depth, and credentials align to typical shortlist thresholds. Recommend progressing to the next stage.',
  'direct', 'employer', 100
),
(
  'band', 'band', 'eq', '"career_ready"'::jsonb,
  'Candidate MEI {{score}} — Career-Ready. Strong professional track record with identified development areas in {{weakest_dimension}}. Suitable for roles with structured onboarding.',
  'direct', 'employer', 100
),
(
  'band', 'band', 'eq', '"building"'::jsonb,
  'Candidate MEI {{score}} — Building. Profile is under active development. Best fit for training-track or junior roles with mentoring support.',
  'direct', 'employer', 100
),

-- ── Employer: dimension-strength narratives ───────────────────────────────────
(
  'dimension_strength', 'validated_proficiency', 'gte', '70'::jsonb,
  'Validated Proficiency {{dim_score}} — skill depth, assessment scores, and credential quality are well above baseline. Strong shortlisting signal for technically-demanding roles.',
  'direct', 'employer', 80
),
(
  'dimension_strength', 'professional_experience', 'gte', '70'::jsonb,
  'Professional Experience {{dim_score}} — tenure, seniority progression, and industry alignment meet expectations for this role level.',
  'direct', 'employer', 80
),
(
  'dimension_strength', 'behavioural_intelligence', 'gte', '70'::jsonb,
  'Behavioural Intelligence {{dim_score}} — CAPADEX-validated behavioural profile and interpersonal signals are strong. Indicates cultural and team-fit potential.',
  'direct', 'employer', 80
)

ON CONFLICT DO NOTHING;


-- ─── ADDITIONAL RECOMMENDATION MASTER ENTRIES ────────────────────────────────
-- Adds entries #10–15 (codes not already seeded in 20260611_mei_v2.sql)

WITH dims AS (SELECT id, code FROM mei_dimensions),
     sds  AS (SELECT id, code FROM mei_subdimensions)
INSERT INTO mei_recommendation_master
  (code, title, description, action_type, target_dimension, target_subdimension,
   estimated_point_gain, effort_level, time_to_complete, link_path, display_order)
SELECT
  'add_full_experience',
  'Document Your Complete Role History',
  'Each undocumented role leaves experience points on the table. Add job title, company, months, and industry for every role — even short internships and contract positions count toward your tenure and cross-industry scores.',
  'add_experience',
  (SELECT id FROM dims WHERE code='professional_experience'),
  (SELECT id FROM sds WHERE code='tenure_seniority'),
  3.0, 'low', '20 minutes', '/career-builder?tab=experience', 10
UNION ALL SELECT
  'add_online_presence',
  'Add LinkedIn & Portfolio Links',
  'Your LinkedIn, GitHub, and personal portfolio URLs each contribute to your Online Presence subdimension. Adding all three takes under 5 minutes and signals professional identity to recruiters reviewing your profile.',
  'update_profile',
  (SELECT id FROM dims WHERE code='portfolio_signal'),
  (SELECT id FROM sds WHERE code='professional_visibility'),
  1.0, 'low', '5 minutes', '/career-builder?tab=profile', 11
UNION ALL SELECT
  'request_recommendations',
  'Request 2 or More Written Recommendations',
  'Written recommendations from managers or colleagues are one of the highest-credibility social proof signals. Each recommendation contributes 25 points to your Recommendations subdimension (up to a cap of 4).',
  'update_profile',
  (SELECT id FROM dims WHERE code='portfolio_signal'),
  (SELECT id FROM sds WHERE code='social_proof'),
  1.5, 'medium', '1–2 days', '/career-builder?tab=profile', 12
UNION ALL SELECT
  'take_leadership_assessment',
  'Take the Leadership Assessment',
  'If you are in a management or senior individual-contributor role, the Leadership Assessment contributes to your Assessment Performance subdimension. It is only weighted for Manager+ seniority levels.',
  'take_assessment',
  (SELECT id FROM dims WHERE code='validated_proficiency'),
  (SELECT id FROM sds WHERE code='assessment_performance'),
  3.0, 'medium', '30 minutes', '/career-builder?tab=competency', 13
UNION ALL SELECT
  'document_publications',
  'Add Publications or Thought Leadership Articles',
  'Articles, blog posts, research papers, or conference talks each contribute to your Publications & Thought Leadership subdimension (up to 3 items, 33 pts each). They are especially high-impact for Education, Healthcare, and Consulting roles.',
  'add_projects',
  (SELECT id FROM dims WHERE code='portfolio_signal'),
  (SELECT id FROM sds WHERE code='demonstrable_work'),
  1.5, 'medium', '20 minutes', '/career-builder?tab=projects', 14
UNION ALL SELECT
  'update_skills_recently',
  'Refresh Your Skills List (12-Month Update)',
  'The Skill Update Recency competency awards full credit for skills updated within the past 6 months. If your last skills update was more than a year ago, adding even one new skill resets this clock and contributes to your Adaptive Capacity subdimension.',
  'add_skills',
  (SELECT id FROM dims WHERE code='behavioural_intelligence'),
  (SELECT id FROM sds WHERE code='adaptive_capacity'),
  1.0, 'low', '10 minutes', '/career-builder?tab=skills', 15

ON CONFLICT (code) DO NOTHING;
