"""
audit_clarity_questions.py

Production-grade ingestion + audit pipeline for the CAPADEX Clarity Questions
child pool. Mirrors the architecture of `audit_capadex_concerns.py`:

    1. Adaptive encoding load (utf-8 → utf-8-sig → cp1252 → latin1)
    2. Header re-alignment (raw CSV has a category-band row at index 0)
    3. Whitespace + casing normalisation on IDs, options, polarity
    4. question_id deduplication (preserves first, suffixes _v2/_v3 thereafter)
    5. Score-column integer coercion (Option A..E Score)
    6. NOT-NULL fortification for response_type / polarity / reverse_score /
       question_weight / score columns / option text / anchors
    7. Relational_Bridge_Tag derived from the `concern` text via the SAME
       first-2-tokens-uppercased rule used by the master pipeline → a hard
       join key into capadex_concerns_master.relational_bridge_tag
    8. concern_id_prefix extracted (CAREER/COMP/MOT/...) for legacy lookups
    9. Writes `audited_clarity_questions.csv` and prints an execution summary

Run:
    python3 scripts/audit_clarity_questions.py [INPUT_PATH] [OUTPUT_PATH]

Defaults:
    INPUT_PATH   attached_assets/Clarity_Questions_1779962616198.csv
    OUTPUT_PATH  audited_clarity_questions.csv
"""

from __future__ import annotations

import re
import sys
import traceback
from pathlib import Path

import pandas as pd


DEFAULT_INPUT = "attached_assets/Clarity_Questions_1779962616198.csv"
DEFAULT_OUTPUT = "audited_clarity_questions.csv"

# Columns whose string text should be stripped of surrounding whitespace.
STRIP_COLUMNS = [
    "Stage", "question_id", "concern_id", "concern",
    "question_type", "narrative_style", "question",
    "response_type", "polarity", "reverse_score",
    "low_score_anchor", "high_score_anchor",
    "Option A", "Option B", "Option C", "Option D", "Option E",
]

SCORE_COLUMNS = [
    "Option A Score", "Option B Score", "Option C Score",
    "Option D Score", "Option E Score",
]

# Required text columns — empty values get a safe sentinel so Drizzle .notNull()
# never trips mid-transaction. Sentinels are explicit so they're auditable
# in the database (vs. silent empty strings).
TEXT_DEFAULTS = {
    "response_type":     "frequency",
    "polarity":          "negative",
    "reverse_score":     "no",
    "low_score_anchor":  "",  # narrative; allowed empty after strip
    "high_score_anchor": "",
}

OPTION_COLUMNS = ["Option A", "Option B", "Option C", "Option D", "Option E"]

TOKEN_RE = re.compile(r"[A-Za-z0-9]+")
STOPWORDS = {"and", "the", "of", "in", "for", "to", "a", "an", "with", "on", "&"}
PREFIX_RE = re.compile(r"^([A-Z]+)_")

# Curated prefix → master bridge tag map. Built from manual inspection of the
# top ~50 prefixes (covers ~80% of clarity rows). Long-tail prefixes fall
# through to a token-heuristic that scans the concern text for any master
# bridge-tag token; final fallback is the 'UNMAPPED' sentinel so admins can
# curate gaps without breaking the join surface.
PREFIX_TO_MASTER_BRIDGE = {
    # Career & employability cluster
    "CAREER": "CAREER_READINESS", "CAR": "CAREER_READINESS",
    "CAREERVISION": "CAREER_READINESS", "CAREERUNCERT": "CAREER_READINESS",
    "CAREERCLAR": "CAREER_READINESS", "CAREERDIR": "CAREER_READINESS",
    "CAREERPLAN": "CAREER_READINESS", "CAREERCHOICE": "CAREER_READINESS",
    "CAREERFEAR": "CAREER_READINESS", "CAREERAMB": "CAREER_READINESS",
    "CAREERTRANS": "CAREER_GROWTH", "CAREERPROG": "CAREER_GROWTH",
    "CAREERPIVOT": "CAREER_GROWTH", "CAREERREINVENT": "CAREER_GROWTH",
    "CAREERREBOUND": "CAREER_GROWTH", "CAREERSTAB": "CAREER_GROWTH",
    "CAREERGAP": "CAREER_GROWTH", "CAREERHARM": "CAREER_GROWTH",
    "CAREERP": "CAREER_GROWTH", "REINVENT": "CAREER_GROWTH",
    "REIN": "CAREER_GROWTH", "RESTART": "CAREER_GROWTH",
    "TRANSITION": "CAREER_GROWTH", "TRANS": "CAREER_GROWTH",
    "TRANSFER": "CAREER_GROWTH", "PIVOT": "CAREER_GROWTH",
    "REENTRY": "CAREER_GROWTH", "GROWTH": "CAREER_GROWTH",
    "REAPPLY": "CAREER_GROWTH", "REATTEMPT": "CAREER_GROWTH",
    "HR": "CAREER_READINESS", "EMP": "EMPLOYABILITY",
    "INTERVIEW": "EMPLOYABILITY", "INT": "EMPLOYABILITY",
    "INTERVIEWCONF": "EMPLOYABILITY", "IMPOSTERINT": "EMPLOYABILITY",
    "MOCK": "EMPLOYABILITY", "MOCKCONF": "EMPLOYABILITY",
    "JOB": "EMPLOYABILITY", "JOBSEARCH": "EMPLOYABILITY",
    "JOBDELAY": "EMPLOYABILITY", "PLACEMENT": "EMPLOYABILITY",
    "PLACE": "EMPLOYABILITY", "PLACEREJ": "EMPLOYABILITY",
    "PLAC": "EMPLOYABILITY", "OFFERDELAY": "EMPLOYABILITY",
    "EMPREAD": "EMPLOYABILITY", "HIRING": "EMPLOYABILITY",
    "FIRSTJOB": "EMPLOYABILITY", "UNEMP": "EMPLOYABILITY",
    "LAYOFF": "EMPLOYABILITY", "REJ": "EMOTIONAL_RECOVERY",
    "REJECTION": "EMOTIONAL_RECOVERY", "REC": "EMOTIONAL_RECOVERY",
    "RECOVERY": "EMOTIONAL_RECOVERY", "RECOV": "EMOTIONAL_RECOVERY",
    "RECOVER": "EMOTIONAL_RECOVERY", "TOXRECOV": "EMOTIONAL_RECOVERY",

    # Competency & employability skills
    "COMP": "COMPETENCY_DEVELOPMENT", "COMPETENCE": "COMPETENCY_DEVELOPMENT",
    "COMPETITION": "COMPETENCY_DEVELOPMENT", "COMPIND": "COMPETENCY_DEVELOPMENT",
    "SKILL": "COMPETENCY_DEVELOPMENT", "SKL": "COMPETENCY_DEVELOPMENT",
    "SKILLGAP": "COMPETENCY_DEVELOPMENT", "SKILLOBSO": "COMPETENCY_DEVELOPMENT",
    "SKILLPRESS": "COMPETENCY_DEVELOPMENT", "OBSOLETE": "COMPETENCY_DEVELOPMENT",
    "AI": "COMPETENCY_DEVELOPMENT", "TECH": "COMPETENCY_DEVELOPMENT",
    "TECHPRESS": "COMPETENCY_DEVELOPMENT", "TECHLEAD": "COMPETENCY_DEVELOPMENT",
    "MASTERY": "COMPETENCY_DEVELOPMENT", "PRACTICAL": "COMPETENCY_DEVELOPMENT",
    "ANALYTICS": "COMPETENCY_DEVELOPMENT", "CODE": "COMPETENCY_DEVELOPMENT",
    "PROBSOLVE": "COMPETENCY_DEVELOPMENT", "PROB": "COMPETENCY_DEVELOPMENT",
    "UNFAMPROB": "COMPETENCY_DEVELOPMENT", "PROFILE": "COMPETENCY_DEVELOPMENT",
    "PROF": "COMPETENCY_DEVELOPMENT", "ASSESS": "COMPETENCY_DEVELOPMENT",
    "APT": "COMPETENCY_DEVELOPMENT",

    # Motivation, holistic, identity
    "MOT": "MOTIVATION_VALUES", "MOTIV": "MOTIVATION_VALUES",
    "MOTFAIL": "MOTIVATION_VALUES", "OPT": "MOTIVATION_VALUES",
    "OPTIMISM": "MOTIVATION_VALUES", "HOPE": "MOTIVATION_VALUES",
    "AMBITION": "MOTIVATION_VALUES", "OUTCOME": "MOTIVATION_VALUES",
    "MOMENTUM": "MOTIVATION_VALUES", "ENERGY": "MOTIVATION_VALUES",
    "VAL": "MOTIVATION_VALUES", "EXTVAL": "MOTIVATION_VALUES",
    "EXTERNALVAL": "MOTIVATION_VALUES",
    "HOLISTIC": "HOLISTIC_DEVELOPMENT", "HOL": "HOLISTIC_DEVELOPMENT",
    "HOLISTICSTRAT": "HOLISTIC_DEVELOPMENT", "HOLISTICID": "HOLISTIC_DEVELOPMENT",
    "GROWTHSTABILITY": "HOLISTIC_DEVELOPMENT", "BAL": "HOLISTIC_DEVELOPMENT",
    "BALANCE": "HOLISTIC_DEVELOPMENT", "WORKLIFE": "HOLISTIC_DEVELOPMENT",
    "INSTBAL": "HOLISTIC_DEVELOPMENT", "WELL": "HOLISTIC_DEVELOPMENT",
    "WORKHOME": "HOLISTIC_DEVELOPMENT", "SPILL": "HOLISTIC_DEVELOPMENT",
    "IDENTITY": "ACADEMIC_IDENTITY", "LEARNIDENTITY": "ACADEMIC_IDENTITY",
    "LEADIDENTITY": "ACADEMIC_IDENTITY", "LEADPURPOSE": "ACADEMIC_IDENTITY",

    # Emotional regulation / recovery / resilience
    "EMO": "EMOTIONAL_REGULATION", "EMR": "EMOTIONAL_REGULATION",
    "EMC": "EMOTIONAL_REGULATION", "EMOPEER": "EMOTIONAL_REGULATION",
    "ANX": "EMOTIONAL_REGULATION", "ANXIETY": "EMOTIONAL_REGULATION",
    "ANXREV": "EMOTIONAL_REGULATION", "CAREANX": "EMOTIONAL_REGULATION",
    "FEAR": "EMOTIONAL_REGULATION", "FOF": "EMOTIONAL_REGULATION",
    "CAREERFEAR": "EMOTIONAL_REGULATION", "PANIC": "EMOTIONAL_REGULATION",
    "FRUST": "EMOTIONAL_REGULATION", "BURNOUT": "EMOTIONAL_REGULATION",
    "BURN": "EMOTIONAL_REGULATION", "BUR": "EMOTIONAL_REGULATION",
    "MULTIBURN": "EMOTIONAL_REGULATION", "PERFBURN": "EMOTIONAL_REGULATION",
    "LEADERBURN": "EMOTIONAL_REGULATION", "FATIGUE": "EMOTIONAL_REGULATION",
    "RES": "EMOTIONAL_RECOVERY", "RESILIENCE": "EMOTIONAL_RECOVERY",
    "ORGRES": "EMOTIONAL_RECOVERY", "REI": "EMOTIONAL_RECOVERY",
    "FAILURE": "EMOTIONAL_RECOVERY", "FAIL": "EMOTIONAL_RECOVERY",
    "EARLYFAIL": "EMOTIONAL_RECOVERY", "LFAIL": "EMOTIONAL_RECOVERY",
    "SURVIVE": "EMOTIONAL_RECOVERY", "RFS": "EMOTIONAL_RECOVERY",

    # Confidence & self
    "SELF": "CONFIDENCE_SELF", "SA": "CONFIDENCE_SELF",
    "SELFBELIEF": "CONFIDENCE_SELF", "SELFCONF": "CONFIDENCE_SELF",
    "SELFDOUBT": "CONFIDENCE_SELF", "SELFRELIANCE": "CONFIDENCE_SELF",
    "CONF": "CONFIDENCE_SELF", "CONFENV": "CONFIDENCE_SELF",
    "CONFIDENCE": "CONFIDENCE_SELF", "CONFIDENTCAP": "CONFIDENCE_SELF",
    "CONFPRO": "CONFIDENCE_SELF", "CONFSTRUG": "CONFIDENCE_SELF",
    "LOWCONF": "CONFIDENCE_SELF", "SALCONF": "CONFIDENCE_SELF",
    "STREAMCONF": "CONFIDENCE_SELF", "PROBCONF": "CONFIDENCE_SELF",
    "IMPOSTER": "CONFIDENCE_SELF", "TRUST": "CONFIDENCE_SELF",

    # Comparison & social
    "COMPARE": "SOCIAL_EMOTIONAL", "PEERCOMP": "SOCIAL_EMOTIONAL",
    "PEERCOMPARE": "SOCIAL_EMOTIONAL", "PEER": "SOCIAL_EMOTIONAL",
    "PARENTCOMP": "SOCIAL_EMOTIONAL", "ACADEMIC": "SOCIAL_EMOTIONAL",
    "AGECOMP": "SOCIAL_EMOTIONAL", "COMPARING": "SOCIAL_EMOTIONAL",
    "SOCIAL": "SOCIAL_EMOTIONAL", "SOE": "SOCIAL_EMOTIONAL",

    # Stress & exam
    "STRESS": "EXAMINATION_STRESS", "STR": "EXAMINATION_STRESS",
    "PRESS": "EXAMINATION_STRESS", "PRS": "EXAMINATION_STRESS",
    "TECHPRES": "EXAMINATION_STRESS", "RESULTPRESS": "EXAMINATION_STRESS",
    "ACADPRESS": "EXAMINATION_STRESS", "WORKPOL": "EXAMINATION_STRESS",
    "EXA": "EXAMINATION_STRESS", "EXAM": "EXAMINATION_STRESS",
    "BOARD": "EXAMINATION_STRESS", "RESULTPRES": "EXAMINATION_STRESS",
    "PREP": "STRATEGIC_PREPARATION", "STRAT": "STRATEGIC_PREPARATION",
    "TESTSTRAT": "STRATEGIC_PREPARATION", "STRATEGIC": "STRATEGIC_PREPARATION",
    "MULTIATTEMPT": "STRATEGIC_PREPARATION", "RANK": "STRATEGIC_PREPARATION",
    "CUTOFFREC": "STRATEGIC_PREPARATION", "FILTER": "STRATEGIC_PREPARATION",
    "REV": "STRATEGIC_PREPARATION", "MARKS": "STRATEGIC_PREPARATION",

    # Discipline / habits / focus / lifestyle
    "FOCUS": "DISCIPLINE_HABITS", "ATT": "DISCIPLINE_HABITS",
    "ATTSPAN": "DISCIPLINE_HABITS", "LIMITEDATT": "DISCIPLINE_HABITS",
    "DISTRACTION": "DISCIPLINE_HABITS", "CONCENTRATION": "DISCIPLINE_HABITS",
    "DISC": "DISCIPLINE_HABITS", "DISCIPLINE": "DISCIPLINE_HABITS",
    "SELFDISC": "DISCIPLINE_HABITS", "TIMEALLOC": "DISCIPLINE_HABITS",
    "TIME": "DISCIPLINE_HABITS", "PROCR": "DISCIPLINE_HABITS",
    "PROD": "DISCIPLINE_HABITS", "PRO": "DISCIPLINE_HABITS",
    "CONS": "DISCIPLINE_HABITS", "PERSIST": "DISCIPLINE_HABITS",
    "ENDURANCE": "DISCIPLINE_HABITS", "DIG": "LIFESTYLE_PRESSURE",
    "DIGIDISC": "LIFESTYLE_PRESSURE", "SCREEN": "LIFESTYLE_PRESSURE",
    "SHORTVID": "LIFESTYLE_PRESSURE", "SLEEP": "LIFESTYLE_PRESSURE",
    "HEALTH": "LIFESTYLE_PRESSURE", "AWB": "LIFESTYLE_PRESSURE",
    "LIFESTYLE": "LIFESTYLE_PRESSURE",

    # Academic + thinking
    "ACAD": "ACADEMIC_COGNITIVE", "ACA": "ACADEMIC_COGNITIVE",
    "ACADDECLINE": "ACADEMIC_COGNITIVE", "BACKLOG": "ACADEMIC_COGNITIVE",
    "CONCEPT": "ACADEMIC_COGNITIVE", "CONC": "ACADEMIC_COGNITIVE",
    "MEM": "ACADEMIC_COGNITIVE", "RECALL": "ACADEMIC_COGNITIVE",
    "ROTE": "ACADEMIC_COGNITIVE", "PRACTICE": "ACADEMIC_COGNITIVE",
    "MATHSCI": "STEM_LEARNING", "MATHREASON": "STEM_LEARNING",
    "STEM": "STEM_LEARNING", "THEOPROJ": "STEM_LEARNING",
    "DECISION": "THINKING_QUALITY", "DEC": "THINKING_QUALITY",
    "STREAM": "THINKING_QUALITY", "PARENTDEC": "THINKING_QUALITY",
    "UNCERT": "THINKING_QUALITY", "UNCERTLEAD": "THINKING_QUALITY",
    "UNPRED": "THINKING_QUALITY", "PROB": "THINKING_QUALITY",
    "NAV": "THINKING_QUALITY", "RISK": "THINKING_QUALITY",

    # Leadership + ownership
    "LEAD": "LEADERSHIP_OWNERSHIP", "LEADER": "LEADERSHIP_OWNERSHIP",
    "LEADWELL": "LEADERSHIP_OWNERSHIP", "LEADRESP": "LEADERSHIP_OWNERSHIP",
    "LEADUNCERT": "LEADERSHIP_OWNERSHIP", "LEADFAM": "LEADERSHIP_OWNERSHIP",
    "SELFLEAD": "LEADERSHIP_OWNERSHIP", "OWNERSHIP": "LEADERSHIP_OWNERSHIP",
    "RESPONSIBILITY": "LEADERSHIP_OWNERSHIP", "EXECUTION": "LEADERSHIP_OWNERSHIP",
    "ROLE": "LEADERSHIP_OWNERSHIP",

    # Learning adaptability
    "LEARN": "LEARNING_ADAPTABILITY", "LONGLRN": "LEARNING_ADAPTABILITY",
    "INSTLEARN": "LEARNING_ADAPTABILITY", "SDL": "LEARNING_ADAPTABILITY",
    "ADAPT": "LEARNING_ADAPTABILITY", "ADP": "LEARNING_ADAPTABILITY",
    "ADAPTIVE": "LEARNING_ADAPTABILITY", "SLOWPROG": "LEARNING_ADAPTABILITY",
    "PLATEAU": "LEARNING_ADAPTABILITY", "STAG": "LEARNING_ADAPTABILITY",

    # Communication
    "COMM": "COMMUNICATION_EXPRESSION", "COMMCAREER": "COMMUNICATION_EXPRESSION",
    "PUBSPEAK": "COMMUNICATION_EXPRESSION", "CONV": "COMMUNICATION_EXPRESSION",

    # Adjustment / family / workplace
    "FAM": "ADJUSTMENT_COPING", "FAMILY": "ADJUSTMENT_COPING",
    "FAMCAREER": "ADJUSTMENT_COPING", "FAMTRANS": "ADJUSTMENT_COPING",
    "PARENT": "ADJUSTMENT_COPING", "FIN": "ADJUSTMENT_COPING",
    "FINANCE": "ADJUSTMENT_COPING", "FINFAM": "ADJUSTMENT_COPING",
    "ECO": "ADJUSTMENT_COPING", "ECOSYS": "ADJUSTMENT_COPING",
    "WORK": "WORKPLACE_ADAPTATION", "WRK": "WORKPLACE_ADAPTATION",
    "WORKCOMP": "WORKPLACE_ADAPTATION", "WKCONFLICT": "WORKPLACE_ADAPTATION",
    "CONFLICT": "WORKPLACE_ADAPTATION", "PROBATION": "WORKPLACE_ADAPTATION",
    "CORP": "WORKPLACE_ADAPTATION", "CORPCULT": "WORKPLACE_ADAPTATION",
    "CULT": "WORKPLACE_ADAPTATION", "ENT": "WORKPLACE_ADAPTATION",
    "ENTERPRISE": "WORKPLACE_ADAPTATION", "CROSSIND": "WORKPLACE_ADAPTATION",
    "INDCARR": "WORKPLACE_ADAPTATION", "INDUSTRY": "WORKPLACE_ADAPTATION",
    "CAMPWORK": "WORKPLACE_ADAPTATION", "CAM": "WORKPLACE_ADAPTATION",
    "COLLEGE": "WORKPLACE_ADAPTATION", "SCHOOL": "CLASSROOM_ENGAGEMENT",

    # Self-reflection / interest / strengths
    "INTEREST": "SELF_REFLECTION", "STRENGTH": "SELF_REFLECTION",
    "REF": "SELF_REFLECTION", "VIS": "SELF_REFLECTION",
    "FUTURE": "SELF_REFLECTION",

    # Long-tail concern families (3-letter-prefix taxonomy batch). Keyed by the
    # FULL concern_id prefix (AVOID/MULTITASK/...), not a truncated 3-char column.
    "AAG": "GOAL_ALIGNMENT", "GOALALIGN": "GOAL_ALIGNMENT",
    "ABS": "ACADEMIC_RISK",
    "ADULT": "MATURITY_DEVELOPMENT",
    "ASR": "CONFIDENCE_BUILDING",
    "AVOID": "PERSISTENCE_DEVELOPMENT",
    "AWC": "SELF_ACCEPTANCE", "WEAKNESS": "SELF_ACCEPTANCE",
    "CDC": "ATTENTION_REFLECTION", "DIST": "ATTENTION_REFLECTION",
    "COLLAB": "COLLABORATION_OWNERSHIP", "GRP": "COLLABORATION_OWNERSHIP",
    "COMFORT": "EXPLORATION_INHIBITION",
    "CONCEPTGAP": "LEARNING_AWARENESS",
    "CONTASS": "ASSESSMENT_INTELLIGENCE", "TA": "ASSESSMENT_INTELLIGENCE",
    "CONVCAR": "CAREER_AUTONOMY",
    "CRED": "PERSONAL_BRANDING",
    "DQA": "HELP_SEEKING",
    "ECI": "IDENTITY_CONFIDENCE",
    "EVA": "SELF_WORTH", "OV": "SELF_WORTH",
    "FASTWORK": "WORKPLACE_ADAPTATION",
    "GDA": "ANALYTICAL_DEVELOPMENT", "QUANT": "ANALYTICAL_DEVELOPMENT",
    "GLOBALTEAM": "INCLUSIVE_LEADERSHIP",
    "IMPROVAREA": "SELF_EVALUATION",
    "IND": "CAREER_TRANSITION", "INDEP": "DECISION_INDEPENDENCE",
    "LIMBELIEF": "GROWTH_MINDSET",
    "LM": "REFLECTIVE_LEARNING",
    "MULTITASK": "PRODUCTIVITY_REFLECTION",
    "NETMENT": "GROWTH_MENTORING",
    "OAE": "EXAM_READINESS", "TIMEASSMT": "EXAM_READINESS",
    "PB": "THINKING_QUALITY",
    "PVH": "PURPOSE_DISCOVERY",
    "ROUT": "ADJUSTMENT_COPING",
    "SELFEXP": "IDENTITY_EXPRESSION", "SELFID": "STRENGTH_DISCOVERY",
    "SFS": "ENGAGEMENT_MANAGEMENT",
    "SYLLABUS": "ACADEMIC_PLANNING", "SYLLREV": "STUDY_STRATEGY",
    "TALENT": "TALENT_DISCOVERY",
    "USB": "CAREER_EXPECTATIONS",
    "VIVA": "EXAMINATION_READINESS",
    "WWS": "ACADEMIC_PERFORMANCE",
}

# Token-fallback: when a prefix isn't in the curated map, scan the concern
# text for any token that appears in a known master bridge tag.
def _token_fallback_lookup(concern_text: str, master_tags: set) -> str | None:
    if not concern_text or pd.isna(concern_text):
        return None
    text_tokens = {t.upper() for t in TOKEN_RE.findall(str(concern_text))
                   if t.lower() not in STOPWORDS and len(t) > 2}
    if not text_tokens:
        return None
    best = None
    best_score = 0
    for tag in master_tags:
        tag_tokens = set(tag.split("_"))
        score = len(text_tokens & tag_tokens)
        if score > best_score:
            best, best_score = tag, score
    return best if best_score >= 1 else None


# ---------------------------------------------------------------------------
# 1. Adaptive ingestion + header alignment
# ---------------------------------------------------------------------------

def load_dataset(path: str) -> pd.DataFrame:
    """Try utf-8 → utf-8-sig → cp1252 → latin1. Raw CSV has a category-band
    in row 0 (",,,,,,,,response_options,,,,,Response_Scores,...") and real
    column headers in row 1 — so we read with header=1 once we detect it."""
    last_error: Exception | None = None
    for encoding in ("utf-8", "utf-8-sig", "cp1252", "latin1"):
        try:
            # Peek the first cell of row 0 — if it's empty/category-band, header is row 1.
            peek = pd.read_csv(path, encoding=encoding, nrows=2, header=None)
            header_row = 0
            row0_first = str(peek.iloc[0, 1]).strip().lower() if peek.shape[1] > 1 else ""
            row1_first = str(peek.iloc[1, 1]).strip().lower() if peek.shape[1] > 1 else ""
            if row0_first in ("", "nan") and row1_first == "question_id":
                header_row = 1
            df = pd.read_csv(path, encoding=encoding, header=header_row)
            print(f"  ✓ Loaded ({encoding}, header_row={header_row}) — "
                  f"{len(df)} rows × {len(df.columns)} cols")
            return df
        except UnicodeDecodeError as exc:
            last_error = exc
            continue
        except Exception as exc:
            last_error = exc
            break
    raise RuntimeError(f"Unable to load `{path}` — last error: {last_error}")


# ---------------------------------------------------------------------------
# 2. Column normalisation
# ---------------------------------------------------------------------------

def normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Strip trailing whitespace from column NAMES (raw file has 'Stage ',
    'Option C Score ', 'Option E Score ') so downstream access works on
    canonical names."""
    rename = {c: str(c).strip() for c in df.columns if str(c) != str(c).strip()}
    if rename:
        df = df.rename(columns=rename)
        print(f"  ✓ Renamed {len(rename)} columns with trailing whitespace")
    return df


def scrub_strings(df: pd.DataFrame) -> pd.DataFrame:
    """Trim whitespace on every text column, drop the placeholder index row
    if pandas read in an extra header artefact."""
    for col in STRIP_COLUMNS:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()
            # Convert literal 'nan' string back to real NaN so later fortifiers see it.
            df.loc[df[col].str.lower().isin(["nan", "none", ""]), col] = pd.NA

    # Defensive: drop a row where question_id is literally the column label.
    if "question_id" in df.columns:
        mask = df["question_id"].astype(str).str.lower() == "question_id"
        n = int(mask.sum())
        if n:
            df = df.loc[~mask].reset_index(drop=True)
            print(f"  ✓ Dropped {n} stray header-as-data row(s)")
    return df


# ---------------------------------------------------------------------------
# 3. Deduplication
# ---------------------------------------------------------------------------

def dedupe_question_ids(df: pd.DataFrame) -> pd.DataFrame:
    """Preserve first occurrence; suffix _v2, _v3, ... on subsequent copies.
    Prevents PRIMARY KEY collisions and keeps localStorage served-ID memory
    in sync across attempts."""
    if "question_id" not in df.columns:
        raise KeyError("Source dataset is missing `question_id` column.")

    counts: dict[str, int] = {}
    new_ids: list[str] = []
    suffixed = 0
    for raw in df["question_id"].astype(str):
        qid = raw.strip()
        n = counts.get(qid, 0)
        if n == 0:
            new_ids.append(qid)
        else:
            new_ids.append(f"{qid}_v{n + 1}")
            suffixed += 1
        counts[qid] = n + 1
    df["question_id"] = new_ids
    print(f"  ✓ Dedupe: {suffixed} duplicate question_id(s) suffixed; "
          f"{df['question_id'].nunique()}/{len(df)} unique")
    return df


# ---------------------------------------------------------------------------
# 4. Score coercion + null fortification
# ---------------------------------------------------------------------------

def coerce_scores(df: pd.DataFrame) -> pd.DataFrame:
    """Cast Option *.Score columns to nullable Int64; backfill missing with 0
    (neutral score). Logs the count touched per column."""
    for col in SCORE_COLUMNS:
        if col not in df.columns:
            df[col] = 0
            print(f"  ⚠ {col} missing — synthesized as 0")
            continue
        before_nulls = int(df[col].isna().sum())
        df[col] = pd.to_numeric(df[col], errors="coerce")
        coerced_nulls = int(df[col].isna().sum())
        df[col] = df[col].fillna(0).round().astype("Int64")
        if coerced_nulls:
            print(f"  ✓ {col}: {before_nulls} nulls + {coerced_nulls - before_nulls} "
                  f"non-numeric → filled with 0")
    return df


def fortify_nulls(df: pd.DataFrame) -> pd.DataFrame:
    """Fill required text columns with safe defaults so Drizzle .notNull()
    parameters never reject a row mid-transaction."""
    for col, default in TEXT_DEFAULTS.items():
        if col not in df.columns:
            df[col] = default
            print(f"  ⚠ {col} missing — synthesized as '{default}'")
            continue
        nulls = int(df[col].isna().sum())
        if nulls:
            df[col] = df[col].fillna(default)
            print(f"  ✓ {col}: {nulls} nulls → '{default}'")

    # question_weight: numeric with default 1.0
    if "question_weight" in df.columns:
        df["question_weight"] = pd.to_numeric(df["question_weight"], errors="coerce").fillna(1.0)
    else:
        df["question_weight"] = 1.0

    # Option text: blanks → empty string (some questions have <5 options)
    for col in OPTION_COLUMNS:
        if col in df.columns:
            df[col] = df[col].fillna("").astype(str).str.strip()

    return df


# ---------------------------------------------------------------------------
# 5. Bridge-tag derivation + concern_id_prefix
# ---------------------------------------------------------------------------

def _bridge_tag_for(text: str) -> str:
    """First 2 alphabetic tokens of the concern text → uppercased + underscore-
    joined. MIRRORS the master pipeline so both sides land on identical bucket
    names (e.g. 'Weak Career Direction Clarity' → 'WEAK_CAREER')."""
    if not text or pd.isna(text):
        return "UNCLASSIFIED_CONCERN"
    tokens = [t for t in TOKEN_RE.findall(str(text)) if t.lower() not in STOPWORDS]
    if not tokens:
        return "UNCLASSIFIED_CONCERN"
    picked = tokens[:2] if len(tokens) >= 2 else tokens
    return "_".join(t.upper() for t in picked)


def derive_relational_layer(df: pd.DataFrame, master_tags_path: str | None = None) -> pd.DataFrame:
    """Build three relational columns so clarity rows can join into the master:

      - `concern_id_prefix`     — CAREER / COMP / MOT extracted from concern_id
      - `Relational_Bridge_Tag` — text-derived first-2-tokens (diagnostic,
        mirrors the master tokenization rule so audit drift is detectable)
      - `master_bridge_tag`     — CURATED prefix→master-tag lookup with a
        token-heuristic fallback against a snapshot of every distinct
        relational_bridge_tag already in capadex_concerns_master. This is the
        column the DB layer joins on. Rows that fail both lookups land on
        the 'UNMAPPED' sentinel so admins can curate gaps without breaking
        the join contract.
    """
    if "concern" not in df.columns:
        raise KeyError("Source dataset is missing `concern` column.")
    df["Relational_Bridge_Tag"] = df["concern"].apply(_bridge_tag_for)
    df["concern_id_prefix"] = df["concern_id"].astype(str).str.extract(PREFIX_RE)[0].fillna("UNKNOWN")

    # Load the master vocabulary snapshot (optional file written by the seed
    # tooling — when absent we still emit the column populated from curated
    # prefix lookups only, so the audit doesn't require DB access at run time).
    master_tags: set[str] = set()
    if master_tags_path and Path(master_tags_path).exists():
        master_tags = {ln.strip() for ln in open(master_tags_path) if ln.strip()}
        print(f"  ✓ Loaded {len(master_tags)} master bridge-tag candidates from {master_tags_path}")

    def _resolve(row) -> str:
        prefix = row["concern_id_prefix"]
        # 1) curated prefix lookup wins — high-precision
        tag = PREFIX_TO_MASTER_BRIDGE.get(prefix)
        if tag:
            return tag
        # 2) token-heuristic against master vocabulary (low-precision, last-resort)
        if master_tags:
            t = _token_fallback_lookup(row.get("concern"), master_tags)
            if t:
                return t
        return "UNMAPPED"

    df["master_bridge_tag"] = df.apply(_resolve, axis=1)

    mapped = (df["master_bridge_tag"] != "UNMAPPED").sum()
    via_curated = df["concern_id_prefix"].isin(PREFIX_TO_MASTER_BRIDGE).sum()
    print(f"  ✓ Relational_Bridge_Tag derived — {df['Relational_Bridge_Tag'].nunique()} buckets")
    print(f"  ✓ concern_id_prefix derived — {df['concern_id_prefix'].nunique()} legacy families")
    print(f"  ✓ master_bridge_tag resolved — {mapped}/{len(df)} ({100*mapped/len(df):.1f}%) "
          f"mapped to master vocabulary [{via_curated} via curated, "
          f"{mapped - via_curated} via token-heuristic]")
    top = df["master_bridge_tag"].value_counts().head(5).to_dict()
    print(f"  ✓ Top-5 master buckets: {top}")
    return df


# ---------------------------------------------------------------------------
# 6. Final column ordering + write
# ---------------------------------------------------------------------------

FINAL_COLUMN_ORDER = [
    "question_id", "concern_id", "concern_id_prefix",
    "master_bridge_tag", "Relational_Bridge_Tag",
    "concern", "Stage", "question_type", "narrative_style", "question",
    "response_type",
    "Option A", "Option B", "Option C", "Option D", "Option E",
    "Option A Score", "Option B Score", "Option C Score",
    "Option D Score", "Option E Score",
    "polarity", "reverse_score", "question_weight",
    "low_score_anchor", "high_score_anchor",
]


def reorder(df: pd.DataFrame) -> pd.DataFrame:
    present = [c for c in FINAL_COLUMN_ORDER if c in df.columns]
    extras  = [c for c in df.columns if c not in present]
    return df[present + extras]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    in_path  = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INPUT
    out_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUTPUT
    if not Path(in_path).exists():
        print(f"✗ Input not found: {in_path}", file=sys.stderr)
        return 2

    try:
        print(f"▶ audit_clarity_questions: {in_path} → {out_path}")
        print("─" * 64)
        print("Step 1/7  Loading dataset")
        df = load_dataset(in_path)

        print("Step 2/7  Normalising column names + scrubbing strings")
        df = normalise_columns(df)
        df = scrub_strings(df)

        print("Step 3/7  Deduplicating question_ids")
        df = dedupe_question_ids(df)

        print("Step 4/7  Coercing score columns to Int64")
        df = coerce_scores(df)

        print("Step 5/7  Fortifying NOT-NULL slots")
        df = fortify_nulls(df)

        print("Step 6/7  Deriving relational bridge layer")
        df = derive_relational_layer(df, master_tags_path="/tmp/master_bridge_tags.txt")

        print("Step 7/7  Writing audited dataset")
        df = reorder(df)
        df.to_csv(out_path, index=False)
        size_kb = Path(out_path).stat().st_size // 1024
        print(f"  ✓ Wrote {len(df)} rows × {len(df.columns)} cols → {out_path} ({size_kb} KB)")

        # Execution summary
        print("─" * 64)
        print("EXECUTION SUMMARY")
        print(f"  total rows:               {len(df)}")
        print(f"  unique question_id:       {df['question_id'].nunique()}")
        print(f"  unique concern_id:        {df['concern_id'].nunique()}")
        print(f"  unique bridge tags:       {df['Relational_Bridge_Tag'].nunique()}")
        print(f"  unique concern prefixes:  {df['concern_id_prefix'].nunique()}")
        for col in SCORE_COLUMNS:
            int_share = (df[col].apply(lambda v: isinstance(v, int) or pd.api.types.is_integer(v)).sum())
            print(f"  {col}: dtype={df[col].dtype}, int-cast OK={int_share == len(df)}")
        print("\nPreview (3 rows, bridge-tag join columns):")
        print(df[["question_id", "concern_id", "concern_id_prefix",
                  "Relational_Bridge_Tag", "concern"]].head(3).to_string(index=False))
        return 0
    except Exception:
        print("✗ Audit pipeline failed:", file=sys.stderr)
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
