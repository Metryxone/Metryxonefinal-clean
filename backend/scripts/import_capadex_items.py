"""
CAPADEX Assessment Item Import Script
Reads the TSV file and populates:
  sdi_domains (new: SDI_BEH, SDI_DGN)
  sdi_stages  (new: CAP_CUR, CAP_GRW, CAP_INS, CAP_MAS)
  sdi_subdomains
  sdi_items
  sdi_item_options
  sdi_stage_weights

Run from /home/runner/workspace:
  python3 backend/scripts/import_capadex_items.py
"""

import os, sys, re, uuid, psycopg2, psycopg2.extras

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    sys.exit("DATABASE_URL not set")

TSV = "attached_assets/Pasted-Assessment-name-Stage-Anchor-Domain-Sub-Domain-Dimensio_1777827498527.txt"

# ── Domain normalisation  ────────────────────────────────────────────────────
# Maps raw file Domain values → canonical name used inside this script
DOMAIN_NORM = {
    "Behavioral":           "Behavioral",
    "Behav":                "Behavioral",
    "Digital":              "Behavioral",
    "Physio":               "Behavioral",
    "Physiology":           "Behavioral",
    "Cognitive Development":"Cognitive Development",
    "Metacog":              "Cognitive Development",
    "Sensory":              "Cognitive Development",
    "Emotional":            "Emotional",
    "Diagnostic":           "Diagnostic",
}

# canonical name → existing or new sdi_domain_code
DOMAIN_CODE = {
    "Cognitive Development": "SDI_COG",
    "Behavioral":            "SDI_BEH",   # new
    "Emotional":             "SDI_EMO",
    "Diagnostic":            "SDI_DGN",   # new
}

# New domains to upsert (existing ones are left untouched)
NEW_DOMAINS = [
    dict(domain_code="SDI_BEH", domain_name="Behavioral Intelligence",
         description="Impulse control, executive function, sensory regulation and environmental adaptation",
         category="Personal Development", display_order=19),
    dict(domain_code="SDI_DGN", domain_name="Diagnostic Profiling",
         description="Cross-domain attention diagnostics: chronotype, hyper-focus, task-switching and metacognitive patterns",
         category="Academic", display_order=20),
]

# ── Stage mapping  ───────────────────────────────────────────────────────────
# file Stage → stage_code we'll upsert
STAGE_MAP = {
    "Curiosity": dict(stage_code="CAP_CUR", stage_name="Curiosity (11–14)",
                      min_grade="6", max_grade="9",
                      description="Early-adolescent attention and focus awareness", display_order=10),
    "Growth":    dict(stage_code="CAP_GRW", stage_name="Growth (11–18)",
                      min_grade="6", max_grade="12",
                      description="Cross-stage behavioural and cognitive growth", display_order=11),
    "Insight":   dict(stage_code="CAP_INS", stage_name="Insight (15–18)",
                      min_grade="10", max_grade="12",
                      description="Meta-cognitive insight and executive strategy", display_order=12),
    "Mastery":   dict(stage_code="CAP_MAS", stage_name="Mastery (19+)",
                      min_grade="13", max_grade="16",
                      description="Advanced attentional mastery and self-regulation", display_order=13),
}

# ── Logic → scoring_type normalisation  ─────────────────────────────────────
def norm_logic(logic: str) -> str:
    l = logic.strip().lower()
    if "inverted" in l or l in ("inverted",):
        return "inverted"
    if "linear" in l or l in ("linear", "1=1, 5=5"):
        return "standard"
    if l in ("yes=5, no=1", "f=5, s=1", "s=5, t=1"):
        return "binary"
    if l in ("yes=1, no=5", "1=5, 5+=1"):
        return "binary_inverted"
    if "neut" in l or "neutral" in l:
        return "neutral"
    if "non-linear" in l:
        return "non_linear"
    if "scale" in l:
        return "scaled"
    return "standard"

# ── Slug helper  ─────────────────────────────────────────────────────────────
def slug(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", s.strip())
    return re.sub(r"_+", "_", s).strip("_").upper()[:30]

def subdomain_code(domain_code: str, subdomain_name: str) -> str:
    return f"{domain_code}_{slug(subdomain_name)}"

# ── Parse TSV  ───────────────────────────────────────────────────────────────
def parse_tsv():
    with open(TSV, encoding="utf-8") as f:
        lines = f.readlines()
    raw_cols = lines[0].strip().split("\t")
    # Deduplicate "Dimension" column name (appears twice at idx 5 and 8)
    cols = []
    seen = {}
    for c in raw_cols:
        c = c.strip()
        if c in seen:
            seen[c] += 1
            cols.append(f"{c}_{seen[c]}")
        else:
            seen[c] = 0
            cols.append(c)

    rows = []
    for line in lines[1:]:
        parts = line.strip().split("\t")
        if not parts or parts[0].strip() in ("", "Assessment name"):
            continue
        row = dict(zip(cols, parts))
        rows.append(row)
    return rows

# ── Main import  ─────────────────────────────────────────────────────────────
def main():
    rows = parse_tsv()
    print(f"Parsed {len(rows)} data rows")

    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # 1. Upsert new domains
        print("Upserting new domains...")
        for d in NEW_DOMAINS:
            cur.execute("""
                INSERT INTO sdi_domains (domain_code, domain_name, description, category, display_order)
                VALUES (%(domain_code)s, %(domain_name)s, %(description)s, %(category)s, %(display_order)s)
                ON CONFLICT (domain_code) DO UPDATE
                  SET domain_name  = EXCLUDED.domain_name,
                      description  = EXCLUDED.description,
                      category     = EXCLUDED.category,
                      display_order= EXCLUDED.display_order
            """, d)
        print(f"  {len(NEW_DOMAINS)} domains ready")

        # 2. Upsert CAPADEX stages
        print("Upserting CAPADEX stages...")
        for s in STAGE_MAP.values():
            cur.execute("""
                INSERT INTO sdi_stages (stage_code, stage_name, min_grade, max_grade, description, display_order)
                VALUES (%(stage_code)s, %(stage_name)s, %(min_grade)s, %(max_grade)s, %(description)s, %(display_order)s)
                ON CONFLICT (stage_code) DO UPDATE
                  SET stage_name   = EXCLUDED.stage_name,
                      description  = EXCLUDED.description,
                      display_order= EXCLUDED.display_order
            """, s)
        print(f"  {len(STAGE_MAP)} stages ready")

        # 3. Collect unique (domain_code, subdomain_name) pairs
        print("Collecting subdomains...")
        subdomain_pairs = {}
        for row in rows:
            raw_domain = row.get("Domain", "").strip()
            canon = DOMAIN_NORM.get(raw_domain, raw_domain)
            dc = DOMAIN_CODE.get(canon)
            if not dc:
                continue
            sd_name = row.get("Sub-Domain", "").strip()
            if not sd_name:
                continue
            key = (dc, sd_name)
            if key not in subdomain_pairs:
                sc = subdomain_code(dc, sd_name)
                # Ensure uniqueness if two domains produce same slug
                base_sc = sc
                n = 2
                existing_scs = {v for v in [p[1] for p in subdomain_pairs.values()]}
                while sc in existing_scs:
                    sc = f"{base_sc}_{n}"
                    n += 1
                subdomain_pairs[key] = (sc, sd_name)

        # Upsert subdomains
        print(f"  Upserting {len(subdomain_pairs)} subdomains...")
        cur.execute("SELECT subdomain_code FROM sdi_subdomains")
        existing_sd = {r["subdomain_code"] for r in cur.fetchall()}
        new_sd_count = 0
        for idx, ((dc, sd_name), (sc, _)) in enumerate(subdomain_pairs.items()):
            if sc not in existing_sd:
                cur.execute("""
                    INSERT INTO sdi_subdomains (domain_code, subdomain_code, subdomain_name, display_order)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (subdomain_code) DO NOTHING
                """, (dc, sc, sd_name, idx + 100))
                new_sd_count += 1
        print(f"  {new_sd_count} new subdomains inserted")

        # 4. Insert items + options
        print("Inserting items and options...")
        item_count = 0
        option_count = 0
        weight_count = 0
        skipped = 0

        # Fetch existing item questions per subdomain to avoid duplicates
        cur.execute("SELECT subdomain_code, question FROM sdi_items")
        existing_items = {(r["subdomain_code"], r["question"][:80]) for r in cur.fetchall()}

        OPTION_COLS = ["A (1pt)", "B (2pt)", "C (3pt)", "D (4pt)", "E (5pt)"]

        for row in rows:
            raw_domain = row.get("Domain", "").strip()
            canon = DOMAIN_NORM.get(raw_domain, raw_domain)
            dc = DOMAIN_CODE.get(canon)
            if not dc:
                skipped += 1
                continue

            sd_name = row.get("Sub-Domain", "").strip()
            if not sd_name:
                skipped += 1
                continue

            key = (dc, sd_name)
            if key not in subdomain_pairs:
                skipped += 1
                continue

            sc = subdomain_pairs[key][0]
            question = row.get("Question (Self-Assessment)", "").strip()
            if not question:
                skipped += 1
                continue

            # Skip duplicate questions within same subdomain
            dedup_key = (sc, question[:80])
            if dedup_key in existing_items:
                skipped += 1
                continue
            existing_items.add(dedup_key)

            is_anchor = row.get("Anchor", "").strip().lower() == "yes"
            logic_raw = row.get("Logic", "").strip()
            scoring_type = norm_logic(logic_raw)

            # Weight: parse float, clamp to 1-5 scale (file uses 1.0–2.0)
            try:
                wt_raw = float(row.get("Wt", "1").strip())
                # Normalise from [1.0, 2.0] → [1, 10] for storage
                weight_val = round(wt_raw * 5, 2)
            except Exception:
                weight_val = 5.0

            item_type = "anchor" if is_anchor else "standard"

            # Insert item
            cur.execute("""
                INSERT INTO sdi_items
                  (subdomain_code, item_type, question, scoring_type, is_active)
                VALUES (%s, %s, %s, %s, true)
                RETURNING id
            """, (sc, item_type, question, scoring_type))
            item_id = cur.fetchone()["id"]
            item_count += 1

            # Insert 5 options (A=1 through E=5)
            options = []
            for i, col in enumerate(OPTION_COLS):
                text = row.get(col, "").strip()
                if text and text != "-":
                    options.append((item_id, text, i + 1, i))
            for opt in options:
                cur.execute("""
                    INSERT INTO sdi_item_options (item_id, text, score_value, display_order)
                    VALUES (%s, %s, %s, %s)
                """, opt)
                option_count += 1

            # Stage weights
            stage_raw = row.get("Stage", "").strip()
            if stage_raw in STAGE_MAP:
                sc_stage = STAGE_MAP[stage_raw]["stage_code"]
                cur.execute("""
                    INSERT INTO sdi_stage_weights (stage_code, subdomain_code, weight)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (stage_code, subdomain_code) DO UPDATE
                      SET weight = GREATEST(sdi_stage_weights.weight, EXCLUDED.weight)
                """, (sc_stage, sc, weight_val))
                weight_count += 1

        conn.commit()
        print(f"\n✓ Import complete:")
        print(f"  Items inserted:          {item_count}")
        print(f"  Options inserted:        {option_count}")
        print(f"  Stage weights upserted:  {weight_count}")
        print(f"  Rows skipped:            {skipped}")

    except Exception as e:
        conn.rollback()
        print(f"\n✗ Import failed: {e}")
        import traceback; traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
