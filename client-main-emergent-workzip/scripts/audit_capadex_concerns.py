"""
audit_capadex_concerns.py

Production-grade ingestion + audit pipeline for the CAPADEX concerns master
catalogue.  Reads the raw source (CSV or XLSX), scrubs structural noise,
normalises categoricals, builds a relational bridge tag for downstream joins,
splits the typical-age-band string into typed integer bounds, fortifies
strategic routing slots against NULL-rejection inside the ORM, then writes a
clean dataset to `audited_capadex_concerns.csv`.

Run:
    python3 scripts/audit_capadex_concerns.py [INPUT_PATH] [OUTPUT_PATH]

Defaults:
    INPUT_PATH   attached_assets/concerns_1779958055109.csv
    OUTPUT_PATH  audited_capadex_concerns.csv
"""

from __future__ import annotations

import re
import sys
import traceback
from pathlib import Path
from typing import Tuple

import pandas as pd


DEFAULT_INPUT = "attached_assets/concerns_1779958055109.csv"
DEFAULT_OUTPUT = "audited_capadex_concerns.csv"

ROUTING_COLUMNS = [
    "Assessment Dimension",
    "Root Cause Group",
    "Intervention Lens",
    "Capability Mapping",
]

TITLE_CASE_COLUMNS = [
    "Relevance in India",
    "Severity",
    "CAPADEX Priority",
]

FALLBACK_ROUTING_TOKEN = "UNASSIGNED_ROUTING_NODE"

DASH_SPLIT_RE = re.compile(r"\s*[-–—]\s*")
TOKEN_RE = re.compile(r"[A-Za-z0-9]+")
STOPWORDS = {"and", "the", "of", "in", "for", "to", "a", "an", "with", "on", "&"}


def load_dataset(path: str) -> pd.DataFrame:
    """Adaptive loader: prefer CSV (cp1252 fallback), then XLSX."""
    last_error: Exception | None = None
    for encoding in ("utf-8", "cp1252", "latin-1"):
        try:
            df = pd.read_csv(path, encoding=encoding)
            print(f"  ✓ Loaded as CSV ({encoding}) — {len(df)} rows × {len(df.columns)} cols")
            return df
        except UnicodeDecodeError as exc:
            last_error = exc
            continue
        except Exception as exc:
            last_error = exc
            break
    try:
        df = pd.read_excel(path)
        print(f"  ✓ Loaded as Excel — {len(df)} rows × {len(df.columns)} cols")
        return df
    except Exception as exc:
        raise RuntimeError(
            f"Unable to load `{path}` as either CSV or Excel. Last error: {last_error or exc}"
        ) from exc


def scrub_schema(df: pd.DataFrame) -> pd.DataFrame:
    """Drop tracking/trailing junk cols; normalise Concern ID + categoricals."""
    cols_to_drop = [c for c in df.columns if str(c).startswith("Unnamed") or str(c).strip() == ""]
    if cols_to_drop:
        df = df.drop(columns=cols_to_drop)
        print(f"  ✓ Dropped {len(cols_to_drop)} junk col(s): {cols_to_drop}")
    else:
        print("  ✓ No junk columns detected")

    if "Concern ID" in df.columns:
        df["Concern ID"] = df["Concern ID"].astype(str).str.strip()
        print(f"  ✓ Concern ID cast to str + stripped ({df['Concern ID'].nunique()} unique)")
    else:
        raise KeyError("Source dataset is missing the required `Concern ID` column.")

    for col in TITLE_CASE_COLUMNS:
        if col in df.columns:
            before = df[col].astype(str).str.strip().nunique()
            df[col] = (
                df[col]
                .astype(str)
                .str.strip()
                .replace({"": pd.NA, "nan": pd.NA, "NaN": pd.NA})
            )
            df[col] = df[col].where(df[col].isna(), df[col].str.title())
            after = df[col].dropna().nunique()
            print(f"  ✓ {col}: title-cased ({before} → {after} buckets)")
    return df


def _bridge_tag_for(domain: str) -> str:
    """Domain string → composite bridge tag (`COLLEGE_ADAPTATION`, `CAREER_READINESS`)."""
    if not domain or pd.isna(domain):
        return "UNCLASSIFIED_DOMAIN"
    tokens = [t for t in TOKEN_RE.findall(str(domain)) if t.lower() not in STOPWORDS]
    if not tokens:
        return "UNCLASSIFIED_DOMAIN"
    picked = tokens[:2] if len(tokens) >= 2 else tokens
    return "_".join(t.upper() for t in picked)


def build_relational_bridge(df: pd.DataFrame) -> pd.DataFrame:
    """Derive Relational_Bridge_Tag from Domain so legacy joins resolve."""
    if "Domain" not in df.columns:
        raise KeyError("Source dataset is missing the required `Domain` column.")
    df["Relational_Bridge_Tag"] = df["Domain"].apply(_bridge_tag_for)
    print(
        f"  ✓ Relational_Bridge_Tag derived — {df['Relational_Bridge_Tag'].nunique()} "
        f"unique buckets across {len(df)} rows"
    )
    sample = df["Relational_Bridge_Tag"].value_counts().head(5).to_dict()
    print(f"  ✓ Top-5 buckets: {sample}")
    return df


def split_age_band(df: pd.DataFrame) -> pd.DataFrame:
    """Regex-split 'Typical Age Band' on -/–/—, materialise age_min/age_max ints."""
    if "Typical Age Band" not in df.columns:
        print("  ⚠ `Typical Age Band` missing — skipping age normalisation")
        df["age_min"] = pd.NA
        df["age_max"] = pd.NA
        return df

    def _parse(raw: object) -> Tuple[object, object]:
        if raw is None or (isinstance(raw, float) and pd.isna(raw)):
            return (pd.NA, pd.NA)
        text = str(raw).strip()
        if not text:
            return (pd.NA, pd.NA)
        parts = [p.strip() for p in DASH_SPLIT_RE.split(text) if p.strip()]
        nums = []
        for p in parts:
            m = re.search(r"\d+", p)
            if m:
                nums.append(int(m.group(0)))
        if len(nums) == 0:
            return (pd.NA, pd.NA)
        if len(nums) == 1:
            return (nums[0], nums[0])
        return (nums[0], nums[1])

    parsed = df["Typical Age Band"].apply(_parse)
    df["age_min"] = pd.array([p[0] for p in parsed], dtype="Int64")
    df["age_max"] = pd.array([p[1] for p in parsed], dtype="Int64")
    df = df.drop(columns=["Typical Age Band"])
    parsed_ok = int(df["age_min"].notna().sum())
    print(
        f"  ✓ Age band parsed — {parsed_ok}/{len(df)} rows produced (age_min, age_max); "
        f"dropped string column"
    )
    return df


def drop_phantom_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Drop rows where the source CSV has no Concern ID AND no Domain — these are
    trailing-empty parser artefacts (17 such rows at the tail of the source file)
    that previously surfaced as `CONCERN_UNKNOWN_*` phantom catalogue entries."""
    def _norm(s: pd.Series) -> pd.Series:
        # fillna BEFORE .str accessors so NaN→'' (pandas .str.* propagates NaN otherwise)
        return s.fillna("").astype(str).str.strip().str.lower()
    cid = _norm(df["Concern ID"])
    dom = _norm(df.get("Domain", pd.Series([""] * len(df))))
    EMPTY = {"", "nan", "none", "null"}
    phantom_mask = cid.isin(EMPTY) & dom.isin(EMPTY)
    n = int(phantom_mask.sum())
    if n:
        print(f"  ✓ Dropping {n} phantom row(s) (null ID + null Domain — trailing empties)")
        df = df.loc[~phantom_mask].reset_index(drop=True)
    else:
        print("  ✓ No phantom rows detected")
    return df


# Ordered fallback chain — used to derive each routing slot from siblings when blank.
# Picks the first non-empty value from the listed columns; final fallback = sentinel.
ROUTING_FALLBACK_CHAIN = {
    "Assessment Dimension": ["Intelligence Layer", "Signal Cluster", "Concern Category"],
    "Root Cause Group":     ["Concern Category", "Contextual Modifier", "Domain"],
    "Intervention Lens":    ["Contextual Modifier", "Concern Category", "Intelligence Layer"],
    "Capability Mapping":   ["Intelligence Layer", "Domain", "Concern Category"],
}


def fortify_routing_slots(df: pd.DataFrame) -> dict:
    """Derive blank routing slots from sibling context columns; fall back to sentinel
    only when every candidate is also blank. Prevents real concerns (e.g. FAC_1286)
    from being routed to `UNASSIGNED_ROUTING_NODE` just because the source author
    left a couple of strict cells empty."""
    EMPTY = {"", "nan", "none", "null"}

    def _is_blank(s: pd.Series) -> pd.Series:
        # fillna BEFORE .str accessors so NaN→'' (pandas .str.* propagates NaN otherwise)
        return s.isna() | s.fillna("").astype(str).str.strip().str.lower().isin(EMPTY)

    patched: dict = {}
    derived_total = 0
    for col in ROUTING_COLUMNS:
        if col not in df.columns:
            print(f"  ⚠ Routing column `{col}` missing — column inserted with fallback")
            df[col] = FALLBACK_ROUTING_TOKEN
            patched[col] = len(df)
            continue

        blank = _is_blank(df[col])
        count_blank = int(blank.sum())
        derived = 0
        sentinel = 0
        if count_blank:
            chain = ROUTING_FALLBACK_CHAIN.get(col, [])
            new_vals = df[col].copy()
            for src_col in chain:
                if src_col not in df.columns:
                    continue
                cand = df[src_col]
                still_blank = blank & _is_blank(new_vals)
                fill_mask = still_blank & ~_is_blank(cand)
                if fill_mask.any():
                    new_vals = new_vals.where(~fill_mask, cand.astype(str).str.strip())
                    derived += int(fill_mask.sum())
            # Anything still blank after the chain → sentinel
            still_blank = blank & _is_blank(new_vals)
            sentinel = int(still_blank.sum())
            if sentinel:
                new_vals = new_vals.where(~still_blank, FALLBACK_ROUTING_TOKEN)
            df[col] = new_vals.astype(str).str.strip()
        else:
            df[col] = df[col].astype(str).str.strip()

        patched[col] = {"blank": count_blank, "derived": derived, "sentinel": sentinel}
        derived_total += derived
        print(
            f"  ✓ {col}: {count_blank} blank → {derived} derived from siblings, "
            f"{sentinel} sentinel"
        )
    print(f"  Σ {derived_total} routing slot(s) recovered from sibling columns")
    return patched


def main(input_path: str = DEFAULT_INPUT, output_path: str = DEFAULT_OUTPUT) -> int:
    print("─" * 72)
    print(" CAPADEX Concerns — Audit + Normalisation Pipeline")
    print("─" * 72)

    src = Path(input_path)
    if not src.exists():
        print(f"✗ Source file not found: {src}")
        return 2

    initial_rows = 0
    try:
        print("\n[1/6] Ingesting source ...")
        df = load_dataset(str(src))
        initial_rows = len(df)

        print("\n[2/6] Structural schema scrubbing ...")
        df = scrub_schema(df)
        df = drop_phantom_rows(df)

        print("\n[3/6] Building Relational_Bridge_Tag ...")
        df = build_relational_bridge(df)

        print("\n[4/6] Normalising Typical Age Band → (age_min, age_max) ...")
        df = split_age_band(df)

        print("\n[5/6] Fortifying strategic routing slots ...")
        patched = fortify_routing_slots(df)

        print("\n[6/6] Writing output + verification summary ...")
        out_path = Path(output_path)
        df.to_csv(out_path, index=False)
        size_kb = out_path.stat().st_size / 1024
        print(f"  ✓ Saved {out_path} ({size_kb:,.1f} KB)")

        print("\n" + "═" * 72)
        print(" OPERATIONAL SUMMARY")
        print("═" * 72)
        print(f" Rows ingested        : {initial_rows}")
        print(f" Rows persisted       : {len(df)}")
        print(f" Columns persisted    : {len(df.columns)}")
        print(f" age_min dtype        : {df['age_min'].dtype} (int? {pd.api.types.is_integer_dtype(df['age_min'])})")
        print(f" age_max dtype        : {df['age_max'].dtype} (int? {pd.api.types.is_integer_dtype(df['age_max'])})")
        print(f" age rows parsed      : {int(df['age_min'].notna().sum())} of {len(df)}")
        print(f" Bridge-tag buckets   : {df['Relational_Bridge_Tag'].nunique()}")
        print(" Routing fortification:")
        for col, stats in patched.items():
            if isinstance(stats, dict):
                print(
                    f"   - {col:<22} blank={stats['blank']:<3} "
                    f"derived={stats['derived']:<3} sentinel={stats['sentinel']}"
                )
            else:
                print(f"   - {col:<22} {stats} null/blank → {FALLBACK_ROUTING_TOKEN}")

        print("\n First 3 rows of cleaned dataset (head):")
        with pd.option_context("display.max_columns", None, "display.width", 200):
            print(df.head(3).to_string(index=False))

        print("\n✓ Audit pipeline completed successfully.")
        return 0

    except Exception as exc:
        print("\n✗ Pipeline halted by uncaught exception:")
        print(f"  {type(exc).__name__}: {exc}")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    in_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INPUT
    out_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUTPUT
    sys.exit(main(in_path, out_path))
