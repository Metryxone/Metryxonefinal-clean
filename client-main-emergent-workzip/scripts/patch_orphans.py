"""
patch_orphans.py — resolve the 225 UNMAPPED clarity-question orphans.

Pipeline:
  1. High-fidelity ingest of the raw Clarity Questions CSV + the audited
     concerns master (latin1/utf-8-sig safe; header auto-realignment).
  2. Three-tier orphan resolution (regex keywords → token-prefix heuristic →
     GENERAL_CONCERN sentinel) using the live master `Relational_Bridge_Tag`
     set as the source of truth.
  3. Duplicate `question_id` suffixing (_v2, _v3, …) so the primary key stays
     unique and per-user served-ID memory in localStorage keeps working.
  4. Score columns coerced to nullable Int64; option text stripped of
     leading/trailing whitespace.
  5. Serialise back to audited_clarity_questions.csv + telemetry summary.

Run:  python3 scripts/patch_orphans.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CLARITY_SRC   = ROOT / "attached_assets" / "Clarity_Questions_1779962616198.csv"
CONCERNS_OUT  = ROOT / "audited_capadex_concerns.csv"
AUDITED_OUT   = ROOT / "audited_clarity_questions.csv"

# Tier-A regex keyword routing — patterns mirror the live master bridge tags.
TIER_A_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(STRESS|ANXIETY|PRESSURE)\b", re.I), "EXAM_STRESS"),
    (re.compile(r"\b(CAREER|DIRECTION|FUTURE)\b",  re.I), "CAREER_READINESS"),
    (re.compile(r"\b(COLLEGE|CAMPUS|ACADEMIC)\b", re.I), "COLLEGE_ADAPT"),
    (re.compile(r"\b(TIME|HABIT|DISCIPLINE)\b",   re.I), "DISCIPLINE_HABITS"),
    (re.compile(r"\b(ADJUST|COPING|BURN)\b",      re.I), "ADJUSTMENT_COPING"),
]
SENTINEL = "GENERAL_CONCERN"

# Score columns (Int64-coerced) + option text columns (whitespace-stripped).
SCORE_COLS  = ["option_a_score", "option_b_score", "option_c_score",
               "option_d_score", "option_e_score"]
OPTION_COLS = ["option_a", "option_b", "option_c", "option_d", "option_e"]


# ---------------------------------------------------------------------------
# 1. INGEST
# ---------------------------------------------------------------------------
def _read_csv_safely(path: Path) -> pd.DataFrame:
    """Try utf-8-sig first (handles BOM), fall back to latin1 for smart-quote
    artefacts (\\x93, \\x94, etc.)."""
    for enc in ("utf-8-sig", "latin1"):
        try:
            df = pd.read_csv(path, encoding=enc, dtype=str, keep_default_na=False)
            return df
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f"Could not decode {path} as utf-8-sig or latin1")


def _normalise_header(col: str) -> str:
    """Lowercase + snake_case header normalisation."""
    return re.sub(r"[^a-z0-9]+", "_", col.strip().lower()).strip("_")


def _realign_headers_if_needed(df: pd.DataFrame) -> pd.DataFrame:
    """If row 0 contains the actual header labels (e.g. raw CSV has a junk
    title row at position 0), promote it and drop."""
    first_row_values = {str(v).strip().lower() for v in df.iloc[0].tolist()}
    if {"question_id", "concern_id"} <= first_row_values:
        df.columns = [str(v).strip() for v in df.iloc[0].tolist()]
        df = df.iloc[1:].reset_index(drop=True)
    df.columns = [_normalise_header(c) for c in df.columns]
    return df


def load_clarity(path: Path) -> pd.DataFrame:
    df = _read_csv_safely(path)
    df = _realign_headers_if_needed(df)
    print(f"  ✓ loaded {len(df):,} clarity rows ({len(df.columns)} cols)")
    return df


def load_valid_master_tags(path: Path) -> set[str]:
    """Extract live master bridge-tag set — anything outside this set is an
    orphan, regardless of what `master_bridge_tag` already contains."""
    df = pd.read_csv(path, encoding="utf-8-sig", dtype=str, keep_default_na=False)
    df.columns = [_normalise_header(c) for c in df.columns]
    col = "relational_bridge_tag"
    if col not in df.columns:
        raise RuntimeError(f"{path} missing column {col!r} — got {list(df.columns)}")
    tags = {t.strip() for t in df[col] if t and t.strip()}
    print(f"  ✓ loaded {len(tags)} valid master bridge tags from concerns master")
    return tags


# ---------------------------------------------------------------------------
# 2. ORPHAN RESOLUTION
# ---------------------------------------------------------------------------
def resolve_orphans(df: pd.DataFrame, valid_tags: set[str]) -> tuple[pd.DataFrame, dict[str, int]]:
    if "master_bridge_tag" not in df.columns:
        df["master_bridge_tag"] = ""

    current = df["master_bridge_tag"].fillna("").astype(str).str.strip()
    is_orphan = (current == "") | (current.str.upper() == "UNMAPPED") | (~current.isin(valid_tags))
    orphan_idx = df.index[is_orphan]
    stats = {"scanned": len(df), "orphans_before": int(is_orphan.sum()),
             "tier_a": 0, "tier_b": 0, "tier_c": 0}

    if len(orphan_idx) == 0:
        return df, stats

    concern_id_col = df.get("concern_id", pd.Series([""] * len(df))).fillna("").astype(str)
    concern_col    = df.get("concern",    pd.Series([""] * len(df))).fillna("").astype(str)

    for idx in orphan_idx:
        cid  = concern_id_col.iat[idx]
        text = f"{cid} {concern_col.iat[idx]}"

        # Tier A — text-vector keyword routing.
        resolved: str | None = None
        for pat, tag in TIER_A_RULES:
            if pat.search(text):
                resolved = tag
                stats["tier_a"] += 1
                break

        # Tier B — token-prefix heuristic against the live master set.
        if resolved is None and cid:
            prefix = cid.split("_", 1)[0].strip().upper()
            if prefix:
                hit = next((t for t in valid_tags
                            if prefix in t.upper() or t.upper().startswith(prefix)),
                           None)
                if hit:
                    resolved = hit
                    stats["tier_b"] += 1

        # Tier C — sentinel.
        if resolved is None:
            resolved = SENTINEL
            stats["tier_c"] += 1

        df.at[idx, "master_bridge_tag"] = resolved

    return df, stats


# ---------------------------------------------------------------------------
# 3. DUPLICATE QUESTION_ID SUFFIXING
# ---------------------------------------------------------------------------
def dedupe_question_ids(df: pd.DataFrame) -> int:
    if "question_id" not in df.columns:
        return 0
    seen: dict[str, int] = {}
    new_ids: list[str] = []
    bumped = 0
    for raw in df["question_id"].fillna("").astype(str):
        qid = raw.strip()
        if not qid:
            new_ids.append(qid)
            continue
        count = seen.get(qid, 0)
        if count == 0:
            new_ids.append(qid)
        else:
            new_ids.append(f"{qid}_v{count + 1}")
            bumped += 1
        seen[qid] = count + 1
    df["question_id"] = new_ids
    return bumped


# ---------------------------------------------------------------------------
# 4. TYPE CASTING + WHITESPACE NORMALISATION
# ---------------------------------------------------------------------------
def normalise_scores_and_options(df: pd.DataFrame) -> dict[str, str]:
    casts: dict[str, str] = {}
    for col in SCORE_COLS:
        if col in df.columns:
            # Coerce → Int64, then fill NA with 0 to satisfy the DB's
            # `INT NOT NULL DEFAULT 0` constraint on absent options.
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype("Int64")
            casts[col] = str(df[col].dtype)
    # question_weight is `NUMERIC NOT NULL DEFAULT 1.0` in the DB.
    if "question_weight" in df.columns:
        df["question_weight"] = pd.to_numeric(df["question_weight"], errors="coerce").fillna(1.0)
    for col in OPTION_COLS:
        if col in df.columns:
            df[col] = df[col].fillna("").astype(str).str.strip()
            df.loc[df[col] == "", col] = pd.NA
    return casts


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main() -> int:
    try:
        print("▶ patch_orphans — repairing 225 UNMAPPED clarity orphans")

        if not CLARITY_SRC.exists():
            raise FileNotFoundError(f"missing source CSV: {CLARITY_SRC}")
        if not CONCERNS_OUT.exists():
            raise FileNotFoundError(f"missing concerns master: {CONCERNS_OUT}")

        print("Phase 1 — ingest")
        df          = load_clarity(CLARITY_SRC)
        valid_tags  = load_valid_master_tags(CONCERNS_OUT)

        # The raw CSV doesn't carry `master_bridge_tag` — bring across whatever
        # the previous audit already resolved so we only re-process true orphans.
        if AUDITED_OUT.exists() and "master_bridge_tag" not in df.columns:
            prior = pd.read_csv(AUDITED_OUT, encoding="utf-8", dtype=str, keep_default_na=False)
            prior.columns = [_normalise_header(c) for c in prior.columns]
            if {"question_id", "master_bridge_tag"} <= set(prior.columns):
                # Match on the de-suffixed base id so prior _v2/_v3 maps re-attach.
                prior_map = (prior[["question_id", "master_bridge_tag"]]
                             .drop_duplicates("question_id")
                             .set_index("question_id")["master_bridge_tag"]
                             .to_dict())
                df["master_bridge_tag"] = df["question_id"].map(prior_map).fillna("")
                print(f"  ✓ carried-over master_bridge_tag for {df['master_bridge_tag'].ne('').sum():,} rows from prior audit")

        # Phase 1.5 — derive concern_id_prefix if absent (needed by seed step).
        if "concern_id_prefix" not in df.columns and "concern_id" in df.columns:
            df["concern_id_prefix"] = (df["concern_id"].fillna("").astype(str)
                                        .str.split("_", n=1).str[0].str.upper())

        print("Phase 2 — orphan resolution (Tier A → B → C)")
        df, stats = resolve_orphans(df, valid_tags)
        print(f"  • orphans before:   {stats['orphans_before']:,}")
        print(f"  • Tier A keyword:   {stats['tier_a']:,}")
        print(f"  • Tier B token:     {stats['tier_b']:,}")
        print(f"  • Tier C sentinel:  {stats['tier_c']:,}  →  {SENTINEL}")

        print("Phase 3 — duplicate question_id suffixing")
        bumped = dedupe_question_ids(df)
        print(f"  • suffixed {bumped:,} duplicates with _v2/_v3/…")

        print("Phase 4 — score Int64 cast + option whitespace strip")
        casts = normalise_scores_and_options(df)
        for col, dtype in casts.items():
            print(f"  • {col}: {dtype}")

        print("Phase 5 — serialise + telemetry")
        # Rename back to the header form the seed COLUMN_MAP expects
        # (`backend/scripts/seed-capadex-clarity-questions.mjs` keys on
        # 'Option A'…'Option E Score', 'Stage', 'Relational_Bridge_Tag').
        OUT_HEADER_REMAP = {
            "stage": "Stage",
            "option_a": "Option A", "option_b": "Option B",
            "option_c": "Option C", "option_d": "Option D", "option_e": "Option E",
            "option_a_score": "Option A Score", "option_b_score": "Option B Score",
            "option_c_score": "Option C Score", "option_d_score": "Option D Score",
            "option_e_score": "Option E Score",
            "relational_bridge_tag": "Relational_Bridge_Tag",
            "text_bridge_tag": "Relational_Bridge_Tag",
        }
        df_out = df.rename(columns=OUT_HEADER_REMAP)
        df_out.to_csv(AUDITED_OUT, index=False, encoding="utf-8")

        # Final residual orphan check.
        residual = (~df["master_bridge_tag"].isin(valid_tags | {SENTINEL})).sum()
        sentinel_rows = (df["master_bridge_tag"] == SENTINEL).sum()
        print("─" * 60)
        print(f"  rows scanned:       {stats['scanned']:,}")
        print(f"  orphans repaired:   {stats['orphans_before'] - residual:,}")
        print(f"  residual mismatch:  {residual:,}  (should be 0)")
        print(f"  GENERAL_CONCERN:    {sentinel_rows:,}")
        print(f"  output:             {AUDITED_OUT.relative_to(ROOT)} ({AUDITED_OUT.stat().st_size:,} bytes)")
        print()
        preview = df[["question_id", "concern_id", "master_bridge_tag"]].tail(3).to_string(index=False)
        print("  Last 3 patched rows:")
        for line in preview.splitlines():
            print(f"    {line}")
        return 0

    except Exception as exc:  # pragma: no cover — top-level guard
        print(f"✗ patch_orphans failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        import traceback; traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
