#!/usr/bin/env python3
"""Phase 1.3 — Competency Data Quality Review.
Analyzes onto_competencies (the canonical master) for duplicates, near-duplicates,
conflicts, and merge candidates. Grounded entirely in live data — no fabrication.
Outputs findings as JSON for report assembly.
"""
import json, re, itertools
from difflib import SequenceMatcher
from collections import defaultdict

comps = json.load(open("/tmp/comps.json"))

STOP = {
    "skill", "skills", "ability", "abilities", "and", "of", "the", "a", "an",
    "competency", "competencies", "professional", "general", "basic", "core",
    "advanced", "effective", "good", "strong",
}
QUALIFIER = {"professional", "advanced", "basic", "core", "general", "effective", "strong", "good"}

def strip_paren(name):
    # capture parenthetical markers like "(duplicate)", "(advanced)"
    markers = re.findall(r"\(([^)]*)\)", name)
    base = re.sub(r"\([^)]*\)", "", name).strip()
    return base, [m.strip().lower() for m in markers]

def norm(name):
    base, _ = strip_paren(name)
    base = base.lower()
    base = re.sub(r"[^a-z0-9 ]", " ", base)
    base = re.sub(r"\s+", " ", base).strip()
    return base

def tokens(name):
    return {t for t in norm(name).split() if t not in STOP}

def token_key(name):
    return " ".join(sorted(tokens(name)))

for c in comps:
    c["_norm"] = norm(c["canonical_name"])
    c["_tokens"] = tokens(c["canonical_name"])
    c["_tokenkey"] = token_key(c["canonical_name"])
    _, c["_markers"] = strip_paren(c["canonical_name"])

# ---- 1. EXACT duplicates (identical canonical_name, case-insensitive) ----
by_lower = defaultdict(list)
for c in comps:
    by_lower[c["canonical_name"].strip().lower()].append(c)
exact_dups = {k: v for k, v in by_lower.items() if len(v) > 1}

# ---- 2. Literal "(duplicate)" / dup markers ----
dup_markers = [c for c in comps if any(m in ("duplicate", "dup", "copy", "old", "deprecated") for m in c["_markers"])]

# ---- 3. Normalized-name duplicates (same after removing punctuation/parentheticals) ----
by_norm = defaultdict(list)
for c in comps:
    by_norm[c["_norm"]].append(c)
norm_dups = {k: v for k, v in by_norm.items() if len(v) > 1 and k}

# ---- 4. Token-set duplicates (same meaningful tokens, ignoring qualifiers/order) ----
by_tok = defaultdict(list)
for c in comps:
    if c["_tokenkey"]:
        by_tok[c["_tokenkey"]].append(c)
token_dups = {k: v for k, v in by_tok.items() if len(v) > 1}

# ---- 5. Near-duplicates: high string + token similarity (pairwise) ----
def jaccard(a, b):
    if not a and not b:
        return 0.0
    return len(a & b) / len(a | b) if (a | b) else 0.0

near = []
seen_pairs = set()
n = len(comps)
for i in range(n):
    ci = comps[i]
    for jx in range(i + 1, n):
        cj = comps[jx]
        if ci["canonical_name"].strip().lower() == cj["canonical_name"].strip().lower():
            continue  # already an exact dup
        sm = SequenceMatcher(None, ci["_norm"], cj["_norm"]).ratio()
        jac = jaccard(ci["_tokens"], cj["_tokens"])
        # one token set subset of the other = qualifier variant (e.g. Integrity vs Professional Integrity)
        subset = bool(ci["_tokens"]) and bool(cj["_tokens"]) and (
            ci["_tokens"] <= cj["_tokens"] or cj["_tokens"] <= ci["_tokens"]
        )
        if jac >= 0.6 or sm >= 0.82 or (subset and jac >= 0.5):
            key = tuple(sorted([ci["id"], cj["id"]]))
            if key in seen_pairs:
                continue
            seen_pairs.add(key)
            near.append({
                "a": ci["canonical_name"], "a_id": ci["id"], "a_domain": ci["domain_id"], "a_type": ci["scientific_type"],
                "b": cj["canonical_name"], "b_id": cj["id"], "b_domain": cj["domain_id"], "b_type": cj["scientific_type"],
                "string_sim": round(sm, 3), "token_jaccard": round(jac, 3),
                "subset": subset,
                "same_domain": ci["domain_id"] == cj["domain_id"],
                "same_type": ci["scientific_type"] == cj["scientific_type"],
            })
near.sort(key=lambda x: (-max(x["string_sim"], x["token_jaccard"])))

# ---- 6. Conflicts: same meaningful name BUT different domain OR different scientific_type ----
conflicts = []
for k, grp in token_dups.items():
    domains = {c["domain_id"] for c in grp}
    types = {c["scientific_type"] for c in grp}
    if len(domains) > 1 or len(types) > 1:
        conflicts.append({"token_key": k, "members": [
            {"name": c["canonical_name"], "id": c["id"], "domain": c["domain_id"], "type": c["scientific_type"]} for c in grp
        ]})
# near-dups with differing type are also conflicts
for nd in near:
    if not nd["same_type"] and max(nd["string_sim"], nd["token_jaccard"]) >= 0.7:
        conflicts.append({"token_key": None, "members": [
            {"name": nd["a"], "id": nd["a_id"], "domain": nd["a_domain"], "type": nd["a_type"]},
            {"name": nd["b"], "id": nd["b_id"], "domain": nd["b_domain"], "type": nd["b_type"]},
        ], "reason": "near-duplicate spanning different scientific_type"})

result = {
    "total": len(comps),
    "domains": sorted({c["domain_id"] for c in comps}),
    "scientific_types": sorted({c["scientific_type"] for c in comps if c["scientific_type"]}),
    "deprecated_count": sum(1 for c in comps if c["deprecated"]),
    "exact_dups": {k: [{"id": c["id"], "name": c["canonical_name"], "domain": c["domain_id"], "type": c["scientific_type"]} for c in v] for k, v in exact_dups.items()},
    "dup_markers": [{"id": c["id"], "name": c["canonical_name"], "markers": c["_markers"]} for c in dup_markers],
    "norm_dups": {k: [{"id": c["id"], "name": c["canonical_name"]} for c in v] for k, v in norm_dups.items()},
    "token_dups": {k: [{"id": c["id"], "name": c["canonical_name"], "domain": c["domain_id"], "type": c["scientific_type"]} for c in v] for k, v in token_dups.items()},
    "near": near,
    "conflicts": conflicts,
}
json.dump(result, open("/tmp/comp_quality.json", "w"), indent=2)

print("total:", result["total"])
print("exact_dups groups:", len(exact_dups))
print("dup_markers:", len(dup_markers))
print("norm_dups groups:", len(norm_dups))
print("token_dups groups:", len(token_dups))
print("near-duplicate pairs:", len(near))
print("conflicts:", len(conflicts))
print("\n--- token_dups (qualifier/order variants) ---")
for k, v in token_dups.items():
    print(" *", " || ".join(f"{c['canonical_name']} [{c['scientific_type']}/{c['domain_id']}]" for c in v))
print("\n--- top 30 near-duplicate pairs ---")
for nd in near[:30]:
    flag = "" if nd["same_type"] else "  <<DIFF-TYPE>>"
    print(f"  {nd['string_sim']:.2f}/{nd['token_jaccard']:.2f}  {nd['a']}  ~  {nd['b']}{flag}")
