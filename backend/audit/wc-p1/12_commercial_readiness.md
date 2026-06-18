# WC-P1 — D12: Commercial Readiness

**Coverage**: 10% | **Confidence**: 5%

---

## Evidence

| Component | State |
|---|---|
| Razorpay keys configured | ❌ Absent (confirmed in WC-C10) |
| EI features behind a paywall | ❌ No subscription gating |
| EI Passport feature flag | `employabilityPassport` = ❌ DISABLED |
| `FF_COMMERCIAL_ACTIVATION` | ✅ In dev workflow command (must be OMITTED in production) |
| Subscription packages for EI tier | ❌ Not defined |
| EI score in subscription upsell flow | ❌ Not wired |
| Payment audit log for EI features | ❌ Not applicable (no payment events) |

---

## Assessment

The EI product is fully available to all users with no commercial gating. This may be intentional for the Free Consumer Launch, but:

1. The EI Passport (shareable with recruiters, PDF export) is a premium feature that should be behind a paywall for the Paid Pilot.
2. No subscription tier maps to EI feature access levels.
3. `FF_COMMERCIAL_ACTIVATION` is in the dev workflow command but is documented as a **HOLD** flag for production until Razorpay is configured — the EI product itself is not gated by this flag.

---

## For Free Consumer Launch

EI scoring, breakdown modal, recommendations, and career routing are available to all users — consistent with a free-tier offering. This is acceptable for launch.

---

## For Paid Consumer Pilot

1. EI Passport (shareable public link + PDF export) should be gated at a paid tier.
2. Advanced trajectory forecasting with verified credentials should be a paid tier.
3. These require Razorpay (Paid Pilot blocker per WC-C10).

---

## Actions to Reach 95%

1. After Razorpay is configured (WC-C10 Paid Pilot gate), define subscription tiers that include/exclude EI Passport, advanced trajectory, and verified credentials.
2. Enable `employabilityPassport` flag and gate the share/PDF routes behind a subscription check.
