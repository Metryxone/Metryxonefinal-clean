# WC-L0F · Deliverable 2 — Signal Coverage Report
_Generated 2026-06-10T02:58:51.179Z._

- Sessions with activated signals (`signal_type='activated'`): **6/9 = 66.7%** (before: 6/9).
- Sessions stamped as WC-L0E backfilled: 5/9.
- WC-L0F graph backfill (ungraphed sessions WITH responses): **0** activated — none (coverage already at ceiling).
- Refused as un-backfillable (0 responses → no evidence): 2 (d0f54fc4, a0924499).

## Dormant signal sources — audited, intentionally NOT activated (would fabricate)
- `rapid_answer` / `rapid_answer_pattern` / `prolonged_hesitation`: emitted with **NULL strength** → no magnitude to inverse-code into a construct dim. Mapping them would invent a dimension.
- `GENERAL_CONCERN`: non-specific catch-all → maps to no single construct.
- These are honest omissions, not gaps. The 6 specific readable-strength concern keys already cover 100% of the construct-feeding signal vocabulary via `SIGNAL_DEFICIT_MAP`.
