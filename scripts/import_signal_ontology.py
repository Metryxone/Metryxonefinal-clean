"""
import_signal_ontology.py — 4-tier Behavioural Signal Ontology audit pipeline (v2 matrices).

Targets the v2 spreadsheet drop. File discovery is timestamp-based via
`newest()` so refreshed exports auto-replace older ones without code edits.
Conceptual file targets (per spec):
  - "Domain List_2.xlsx"     → matches Domain_List_*.xlsx     (20 rows)
  - "Family List_2.xlsx"     → matches Family_List_*.xlsx     (400 rows)
  - "Signal lList_2.xlsx"    → matches Signal_lList_*.xlsx    (20 rows)
  - "Atomic Signal_2.xlsx"   → matches Atomic_Signal_*.xlsx   (~15,975 rows)

Outputs (repo root, overwritten on every run):
  - audited_domains.csv
  - audited_families.csv
  - audited_signals.csv
  - audited_atomic_signals.csv

Invariants enforced:
  1. High-fidelity ingestion: smart-quote/encoding safe (xlsx is binary →
     openpyxl handles unicode natively; defensive str-coerce on object cols
     replaces NaN/None/empty with pd.NA before downstream logic).
  2. Excel-artefact suppression: rows whose first cell literally equals
     the column header (3 such phantom rows in Atomic) are dropped.
  3. Relational typo repair: 'FFAM_*' family_id values in atomic are
     rewritten to 'FAM_*' to preserve FK integrity (40 occurrences in v2).
  4. Hierarchical unique-key hardening with _v2/_v3 suffixing on collisions
     across domain_id, family_id, signal_id, atomic_signal_id.
  5. Age range parsing (handles -, –, —) → age_min/age_max Int64,
     defaults 17/24 when blank/corrupt, original text column dropped.
  6. Relational_Bridge_Tag derived from text-token matching against the
     5 lifecycle buckets + GENERAL_CONCERN sentinel.
  7. Title Case on categorical weights (Severity, Priority,
     adaptive_importance, signal_status, etc.).
  8. Empty routing slots patched with UNASSIGNED_ROUTING_NODE to keep
     downstream NOT NULL constraints safe.
  9. Telemetry report at end: per-tier row counts, bridge-tag distribution
     across atomic, and FK integrity verification matrix.
"""
from __future__ import annotations
import glob
import os
import re
import sys
import warnings
from pathlib import Path

import pandas as pd

warnings.filterwarnings("ignore")

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS = REPO_ROOT / "attached_assets"

UNASSIGNED = "UNASSIGNED_ROUTING_NODE"
GENERAL_CONCERN = "GENERAL_CONCERN"

# ── Bridge-tag routing (mirrors audit_clarity_questions.py vocabulary) ────
BRIDGE_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b(CAREER|EMPLOYABILITY|JOB|PLACEMENT|HIRE)\b", re.I),    "CAREER_READINESS"),
    (re.compile(r"\b(COLLEGE|CAMPUS|ACADEMIC|UNIVERSITY|SCHOOL)\b", re.I),  "COLLEGE_ADAPT"),
    (re.compile(r"\b(DISCIPLINE|HABIT|TIME|ROUTINE|PROCRAST)\b", re.I),     "DISCIPLINE_HABITS"),
    (re.compile(r"\b(ADJUSTMENT|COPING|EMOTIONAL|STRESS|ANXIETY|FEAR)\b",
                re.I),                                                       "ADJUSTMENT_COPING"),
    (re.compile(r"\b(EXAM|TEST|EVALUATION|ASSESSMENT)\b", re.I),            "EXAM_STRESS"),
]


def newest(pattern: str) -> Path:
    """Return newest file matching `pattern` under attached_assets/."""
    paths = sorted(glob.glob(str(ASSETS / pattern)), key=os.path.getmtime)
    if not paths:
        sys.exit(f"FATAL: no file matches {pattern} under {ASSETS}")
    return Path(paths[-1])


def load_xlsx(path: Path) -> pd.DataFrame:
    """Read xlsx, strip header whitespace, strip cell whitespace on object cols.
    Also drops phantom rows whose first column literally repeats the header
    (3 such rows exist in Atomic_Signal.xlsx — Excel export artefacts)."""
    df = pd.read_excel(path, sheet_name=0)
    df.columns = [str(c).strip() for c in df.columns]
    for c in df.select_dtypes(include="object").columns:
        df[c] = df[c].astype(str).str.strip().replace({"nan": pd.NA, "None": pd.NA, "": pd.NA})
    # Drop phantom header-repeat rows
    if len(df.columns) > 0:
        first_col = df.columns[0]
        phantom_mask = df[first_col].astype(str).str.strip() == first_col
        if phantom_mask.any():
            print(f"  ↳ dropping {int(phantom_mask.sum())} phantom header-repeat rows")
            df = df.loc[~phantom_mask].reset_index(drop=True)
    return df


def dedupe_key(df: pd.DataFrame, key: str) -> pd.DataFrame:
    """Preserve first instance of duplicate keys, append _v2/_v3 to later collisions."""
    if key not in df.columns:
        return df
    seen: dict[str, int] = {}
    new_vals = []
    for v in df[key].fillna("MISSING_ID").astype(str):
        if v not in seen:
            seen[v] = 1
            new_vals.append(v)
        else:
            seen[v] += 1
            new_vals.append(f"{v}_v{seen[v]}")
    df = df.copy()
    df[key] = new_vals
    return df


AGE_HYPHENS = re.compile(r"\s*[-–—]\s*")
AGE_BOUNDED = re.compile(r"(\d{1,2})\s*[-–—]\s*(\d{1,3})")


def parse_age(value, default_min: int = 17, default_max: int = 24) -> tuple[int, int]:
    if value is None or pd.isna(value):
        return default_min, default_max
    s = str(value).strip()
    if not s or s.lower() in {"all", "any", "n/a", "na"}:
        return default_min, default_max
    m = AGE_BOUNDED.search(s)
    if m:
        lo, hi = int(m.group(1)), int(m.group(2))
        if lo <= hi <= 120:
            return lo, hi
    # Single-number ("18+")
    m2 = re.search(r"(\d{1,2})\s*\+", s)
    if m2:
        return int(m2.group(1)), default_max
    return default_min, default_max


def split_age(df: pd.DataFrame, col: str = "age_applicability") -> pd.DataFrame:
    if col not in df.columns:
        df = df.copy()
        df["age_min"] = default_age_min(df)
        df["age_max"] = default_age_max(df)
        return df
    ages = df[col].apply(parse_age)
    df = df.copy()
    df["age_min"] = pd.array([a[0] for a in ages], dtype="Int64")
    df["age_max"] = pd.array([a[1] for a in ages], dtype="Int64")
    df = df.drop(columns=[col])
    return df


def default_age_min(df):
    return pd.array([17] * len(df), dtype="Int64")


def default_age_max(df):
    return pd.array([24] * len(df), dtype="Int64")


def derive_bridge_tag(*text_fields) -> str:
    """Apply BRIDGE_RULES against concatenated text; return first match or sentinel."""
    blob = " ".join(str(t) for t in text_fields if t is not None and not pd.isna(t)).upper()
    for pat, tag in BRIDGE_RULES:
        if pat.search(blob):
            return tag
    return GENERAL_CONCERN


def attach_bridge_tag(df: pd.DataFrame, *cols: str) -> pd.DataFrame:
    df = df.copy()
    df["relational_bridge_tag"] = df.apply(
        lambda r: derive_bridge_tag(*(r.get(c) for c in cols)), axis=1
    )
    return df


TITLE_CASE_COLS = (
    "severity", "priority", "adaptive_importance", "signal_status",
    "intervention_priority", "volatility", "longitudinal_importance",
    "emotional_sensitivity", "cognitive_load_impact", "explainability_level",
)


def title_case_categoricals(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for c in df.columns:
        if c.lower() in TITLE_CASE_COLS:
            df[c] = df[c].apply(
                lambda v: str(v).strip().title() if v is not None and not pd.isna(v) else v
            )
    return df


def patch_routing_nulls(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    df = df.copy()
    for c in cols:
        if c in df.columns:
            df[c] = df[c].fillna(UNASSIGNED)
    return df


def fill_text_nulls(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    df = df.copy()
    for c in cols:
        if c in df.columns:
            df[c] = df[c].fillna("")
    return df


# ─── Per-file pipelines ────────────────────────────────────────────────────

def audit_domains() -> pd.DataFrame:
    src = newest("Domain_List_*.xlsx")
    print(f"[domains] loading {src.name}")
    df = load_xlsx(src)
    df = dedupe_key(df, "domain_id")
    df = title_case_categoricals(df)
    df = attach_bridge_tag(df, "domain_name", "domain_purpose", "primary_focus")
    df = patch_routing_nulls(df, [
        "intervention_orientation", "longitudinal_importance",
        "adaptive_runtime_importance",
    ])
    df = fill_text_nulls(df, [
        "domain_purpose", "primary_focus", "key_behavioral_scope",
        "example_signal_families", "core_risk_areas",
    ])
    out = REPO_ROOT / "audited_domains.csv"
    df.to_csv(out, index=False)
    print(f"[domains] wrote {out} ({len(df)} rows, {len(df.columns)} cols)")
    return df


def audit_families(domain_ids: set[str]) -> pd.DataFrame:
    src = newest("Family_List_*.xlsx")
    print(f"[families] loading {src.name}")
    df = load_xlsx(src)
    df = dedupe_key(df, "family_id")
    df = attach_bridge_tag(df, "family_name", "family_purpose", "key_behavioral_scope", "Domain")
    df = fill_text_nulls(df, ["family_purpose", "key_behavioral_scope", "Domain", "family_name"])
    # FK integrity check
    missing = (~df["domain_id"].isin(domain_ids)).sum() if "domain_id" in df.columns else 0
    if missing:
        print(f"[families] WARN {missing} rows have unknown domain_id (will keep, FK enforced at DB level)")
    out = REPO_ROOT / "audited_families.csv"
    df.to_csv(out, index=False)
    print(f"[families] wrote {out} ({len(df)} rows, {len(df.columns)} cols)")
    return df


def audit_signals() -> pd.DataFrame:
    src = newest("Signal_lList_*.xlsx")
    print(f"[signals] loading {src.name}")
    df = load_xlsx(src)
    df = dedupe_key(df, "signal_id")
    df = title_case_categoricals(df)
    df = attach_bridge_tag(df, "signal_name", "domain", "signal_family",
                           "behavioral_meaning", "risk_mapping")
    df = patch_routing_nulls(df, [
        "category", "detection_type", "adaptive_importance",
        "intervention_priority", "volatility",
    ])
    df = fill_text_nulls(df, [
        "behavioral_meaning", "hidden_pattern_contribution",
        "amplification_rules", "contradiction_links",
        "related_signals", "recovery_indicator",
        "longitudinal_impact", "risk_mapping",
        "source_types",
    ])
    # Coerce numeric weights to nullable float, default to NaN (DB column is REAL)
    for c in ("severity_weight", "confidence_weight", "persistence_weight"):
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    out = REPO_ROOT / "audited_signals.csv"
    df.to_csv(out, index=False)
    print(f"[signals] wrote {out} ({len(df)} rows, {len(df.columns)} cols)")
    return df


def audit_atomic(family_ids: set[str], domain_ids: set[str]) -> pd.DataFrame:
    src = newest("Atomic_Signal_*.xlsx")
    print(f"[atomic] loading {src.name} (this is the big one, ~16k rows)")
    df = load_xlsx(src)
    # Repair known source-CSV typo: FFAM_* → FAM_* (single occurrence in 15k rows)
    if "family_id" in df.columns:
        typo_mask = df["family_id"].astype(str).str.startswith("FFAM_")
        if typo_mask.any():
            n = int(typo_mask.sum())
            df.loc[typo_mask, "family_id"] = df.loc[typo_mask, "family_id"].str.replace(
                r"^FFAM_", "FAM_", regex=True
            )
            print(f"  ↳ repaired {n} 'FFAM_*' typos → 'FAM_*'")
    df = dedupe_key(df, "atomic_signal_id")
    df = split_age(df, "age_applicability")
    df = title_case_categoricals(df)
    df = attach_bridge_tag(df, "atomic_signal_name", "signal_label",
                           "signal_definition", "domain_name", "family_name",
                           "risk_mapping")
    df = patch_routing_nulls(df, [
        "signal_category", "detection_type", "adaptive_importance",
        "intervention_priority", "volatility", "emotional_sensitivity",
        "cognitive_load_impact", "longitudinal_importance",
        "explainability_level", "signal_status",
    ])
    df = fill_text_nulls(df, [
        "signal_definition", "primary_behavioral_scope",
        "secondary_behavioral_scope", "recovery_indicator",
        "hidden_pattern_contribution", "amplification_rules",
        "suppression_rules", "contradiction_links", "related_signals",
        "progression_risk", "regression_risk", "risk_mapping",
        "intervention_mapping", "telemetry_sources", "question_sources",
        "runtime_visibility", "persona_sensitivity",
        "cultural_context_fit", "execution_relevance",
        "employability_relevance", "learning_relevance",
        "behavioral_examples",
    ])
    for c in ("severity_weight", "confidence_weight", "persistence_weight"):
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    # FK checks
    miss_fam = (~df["family_id"].isin(family_ids)).sum() if "family_id" in df.columns else 0
    miss_dom = (~df["domain_id"].isin(domain_ids)).sum() if "domain_id" in df.columns else 0
    if miss_fam:
        print(f"[atomic] WARN {miss_fam} rows have unknown family_id")
    if miss_dom:
        print(f"[atomic] WARN {miss_dom} rows have unknown domain_id")
    out = REPO_ROOT / "audited_atomic_signals.csv"
    df.to_csv(out, index=False)
    print(f"[atomic] wrote {out} ({len(df)} rows, {len(df.columns)} cols)")
    return df


def main() -> None:
    print("=" * 64)
    print("Signal Ontology Audit Pipeline — v2 matrices")
    print("=" * 64)
    domains  = audit_domains()
    families = audit_families(set(domains["domain_id"].astype(str)))
    signals  = audit_signals()
    atomic   = audit_atomic(
        set(families["family_id"].astype(str)),
        set(domains["domain_id"].astype(str)),
    )

    # ── Telemetry: row counts ──────────────────────────────────────────
    print("\n" + "=" * 64)
    print("EXECUTION TELEMETRY")
    print("=" * 64)
    print(f"  Row counts")
    print(f"    domains          : {len(domains):>6}")
    print(f"    families         : {len(families):>6}")
    print(f"    signals          : {len(signals):>6}")
    print(f"    atomic signals   : {len(atomic):>6}")

    # ── Telemetry: bridge-tag distribution ─────────────────────────────
    print(f"\n  Bridge-tag distribution (atomic, {len(atomic):,} rows)")
    counts = atomic["relational_bridge_tag"].value_counts(dropna=False)
    total = int(counts.sum()) or 1
    for tag, n in counts.items():
        pct = 100.0 * int(n) / total
        bar = "█" * max(1, int(pct / 2))
        print(f"    {str(tag):<22} {int(n):>6} ({pct:5.1f}%) {bar}")

    # ── Telemetry: FK integrity matrix ─────────────────────────────────
    print(f"\n  Foreign-key integrity matrix")
    dom_ids = set(domains["domain_id"].astype(str))
    fam_ids = set(families["family_id"].astype(str))

    fam_to_dom_missing = (
        (~families["domain_id"].astype(str).isin(dom_ids)).sum()
        if "domain_id" in families.columns else "n/a"
    )
    atom_to_fam_missing = (
        (~atomic["family_id"].astype(str).isin(fam_ids)).sum()
        if "family_id" in atomic.columns else "n/a"
    )
    atom_to_dom_missing = (
        (~atomic["domain_id"].astype(str).isin(dom_ids)).sum()
        if "domain_id" in atomic.columns else "n/a"
    )

    def status(n):
        return "✓ INTACT" if n == 0 else f"✗ {n} ORPHANS"
    print(f"    families.domain_id  → domains.domain_id   : {status(fam_to_dom_missing)}")
    print(f"    atomic.family_id    → families.family_id  : {status(atom_to_fam_missing)}")
    print(f"    atomic.domain_id    → domains.domain_id   : {status(atom_to_dom_missing)}")

    # ── Telemetry: uniqueness verification ─────────────────────────────
    print(f"\n  Primary-key uniqueness")
    for label, df, key in [
        ("domains.domain_id              ", domains, "domain_id"),
        ("families.family_id             ", families, "family_id"),
        ("signals.signal_id              ", signals, "signal_id"),
        ("atomic_signals.atomic_signal_id", atomic, "atomic_signal_id"),
    ]:
        if key in df.columns:
            dupes = int(df[key].duplicated().sum())
            print(f"    {label} : {'✓ UNIQUE' if dupes == 0 else f'✗ {dupes} DUPES'}")
        else:
            print(f"    {label} : (column missing)")

    print("=" * 64)
    print("Outputs written:")
    for f in ("audited_domains.csv", "audited_families.csv",
              "audited_signals.csv", "audited_atomic_signals.csv"):
        p = REPO_ROOT / f
        size_kb = p.stat().st_size // 1024 if p.exists() else 0
        print(f"  • {f:<32} ({size_kb:,} KB)")
    print("=" * 64)


if __name__ == "__main__":
    main()
