-- MX-600 Phase 2 (R1): public partner onboarding submissions.
-- Adds a metadata JSONB column to onboarding_approvals so the public partner
-- onboarding form can persist extended fields (organisation/address/registration/
-- website/etc.) that have no dedicated column — lossless capture for review.
-- Mirrors the lazy ensure (ALTER ... ADD COLUMN IF NOT EXISTS) in backend/routes.ts.
ALTER TABLE onboarding_approvals ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
