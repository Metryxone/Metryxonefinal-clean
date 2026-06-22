#!/usr/bin/env python3
"""Assemble competency_quality_report.md from the live analysis (/tmp/comp_quality.json).
Curated adjudication (merge/retain/conflict) is embedded; the full pair appendix is
generated from live data so the numbers stay honest."""
import json
from datetime import date

q = json.load(open("/tmp/comp_quality.json"))
comps = {c["id"]: c for c in json.load(open("/tmp/comps.json"))}
byname = {c["canonical_name"]: c for c in comps.values()}

def dom(n):
    return byname[n]["domain_id"] if n in byname else "?"
def typ(n):
    return byname[n]["scientific_type"] if n in byname else "?"
def cid(n):
    return byname[n]["id"] if n in byname else "?"

# ---- Curated adjudication (grounded in the live name/taxonomy data) ----
MERGE_HIGH = [
    (["Building Trust", "Trust Building"], "Building Trust", "Word-order variant; identical domain (interpersonal) & type (behavioral) & family."),
    (["Integrity", "Professional Integrity"], "Integrity", "\u201cProfessional\u201d adds no distinct construct; both behavioral / Governance & Ethics."),
    (["Knowledge Sharing", "Sharing Knowledge"], "Knowledge Sharing", "Word-order variant; identical domain/type/family (Operational Excellence)."),
    (["Persuasion", "Persuasion Skills"], "Persuasion", "\u201cSkills\u201d suffix is noise; identical domain/type/family (Stakeholder Influence)."),
    (["Work Ethic", "Strong Work Ethic"], "Work Ethic", "\u201cStrong\u201d is a proficiency level, not a separate competency; family is literally \u201cWork Ethic\u201d."),
    (["Ambiguity Tolerance", "Tolerance for Ambiguity"], "Ambiguity Tolerance", "Exact synonym / word-order; both behavioral."),
]
MERGE_MED = [
    (["Prioritization", "Task Prioritization"], "Prioritization", "\u201cTask\u201d is implied context; identical domain (functional) & type."),
    (["Presentation Skills", "Formal Presentation Skills"], "Presentation Skills", "\u201cFormal\u201d + \u201cSkills\u201d are noise; identical domain/type."),
    (["Constructive Feedback", "Providing Constructive Feedback"], "Constructive Feedback", "Action-phrasing variant; identical domain/type."),
    (["Conflict Resolution", "Workplace Conflict Resolution"], "Conflict Resolution", "\u201cWorkplace\u201d is implied context; identical domain/type."),
    (["Adaptability", "Quick Adaptability"], "Adaptability", "\u201cQuick\u201d is a speed qualifier, not a distinct construct; identical domain/type."),
    (["Safety Focus", "Workplace Safety Focus"], "Safety Focus", "\u201cWorkplace\u201d is implied context; identical domain (strategic) & type."),
    (["Diversity Awareness", "Diversity & Inclusion Awareness"], "Diversity & Inclusion Awareness", "Same construct; keep the broader canonical label."),
]
# Genuine concept overlap BUT inconsistent classification — resolve taxonomy first
CONFLICTS = [
    (["Delegation", "Task Delegation"], "Same concept split across types: Delegation=behavioral/dom_behavioral vs Task Delegation=functional/dom_functional. Pick ONE type (recommend behavioral \u201cDelegation\u201d), then merge."),
    (["Collaboration", "Agile Collaboration"], "\u201cAgile Collaboration\u201d is typed cognitive/dom_strategic while \u201cCollaboration\u201d is behavioral/dom_interpersonal. Likely a context of the same construct; reconcile type before deciding merge vs parent-child."),
    (["Relationship Building", "Customer Relationship Building"], "Same construct across two types (interpersonal vs functional). Either merge or keep as an explicit parent-child with a single owning type."),
]
# Needs SME — the Decision-Making family
REVIEW = [
    (["Decision-Making", "Quick Decision Making", "Sound Decision Making", "Balanced Decision Making", "Ethical Decision Making", "Operational Decision Making"],
     "Six \u201c* Decision Making\u201d entries (all cognitive). Recommend: keep \u201cDecision-Making\u201d as the parent; MERGE the quality-adjective variants (Quick / Sound / Balanced) into it; RETAIN the genuine context variants (Ethical, Operational) as distinct. SME sign-off required."),
    (["Risk-Taking", "Informed Risk Taking"], "\u201cInformed\u201d adds a real qualifier (deliberate vs general). Lean RETAIN, but confirm with SME they are not the same bar."),
    (["Risk Management", "Enterprise Risk Management"], "ERM is an organizational-scope specialization. Lean RETAIN as parent-child; confirm scope intent."),
]
# Distinct despite high string similarity — explicit RETAIN (false positives)
RETAIN = [
    (["Stakeholder Engagement", "Stakeholder Management"], "Engagement (relationship) vs Management (control/coordination) are different constructs."),
    (["Volunteer Engagement", "Volunteer Management"], "Engagement vs Management \u2014 different constructs."),
    (["Attention to Deadlines", "Attention to Detail"], "Timeliness vs accuracy \u2014 unrelated despite shared prefix."),
    (["Personal Credibility", "Personal Responsibility"], "Trust/reputation vs accountability \u2014 different constructs."),
    (["Goal Orientation", "People Orientation"], "Task-focus vs people-focus \u2014 different constructs."),
    (["Open Communication", "Written Communication"], "Transparency style vs channel/medium \u2014 different constructs."),
    (["Communication", "Open Communication"], "Umbrella vs a specific style; keep as parent / child, not a duplicate."),
    (["Leadership", "Team Leadership"], "Umbrella vs team-scoped; keep as parent / child."),
    (["Motivation", "Self-Motivation", "Team Motivation"], "General drive vs self-directed vs motivating-others \u2014 three distinct targets."),
    (["Process Orientation", "Results Orientation"], "Process-focus vs outcome-focus \u2014 opposite emphases, not duplicates."),
    (["Commercial Awareness", "Social Awareness"], "Business acumen vs interpersonal/emotional awareness \u2014 unrelated."),
    (["Energy Management", "Vendor Management"], "Personal energy/resilience vs supplier management \u2014 false positive on \u201cManagement\u201d."),
    (["Inspirational Leadership", "Transformational Leadership"], "Distinct leadership styles; note the type split (interpersonal vs strategic) is a separate taxonomy issue."),
    (["Customer Focus", "Customer Retention Focus"], "General orientation vs retention-specific KPI focus \u2014 distinct."),
]

def line(names):
    return " · ".join(f"**{n}** ({typ(n)}/{dom(n)})" for n in names)

L = []
w = L.append
today = date.today().isoformat()

w("# Competency Data Quality Review — Phase 1.3")
w("")
w(f"*Generated {today} · Source of truth: `onto_competencies` (live PostgreSQL) · Read-only review, no rows modified.*")
w("")
w("---")
w("")
w("## 0. Implementation status (honest)")
w("")
w("**Phase 1.3 was never built.** The Competency Framework Intelligence code ships Phases **1.1, 1.2, 1.4, 1.5, 1.6, 1.7** (markers in `backend/routes/competency-intelligence.ts`) — there is **no 1.3** module, route, or table. This document is the missing Phase-1.3 deliverable, produced as a one-off data-quality audit. It is **read-only**: nothing in the database was merged, renamed, or deleted. Per project policy, cleanup actions below **stop for approval** before any mutation.")
w("")
w("## 1. Method & honest limitations")
w("")
w(f"- **Scope:** all **{q['total']}** rows in `onto_competencies` (the canonical master — the \u201c~300 competencies\u201d). Other competency tables (`competency_library`, `competency_catalog`, `ont_competencies`, …) are **empty** in this environment and were excluded.")
w(f"- **Axes available:** `canonical_name`, `domain_id` ({len(q['domains'])} domains), `family_id`, `scientific_type` ({', '.join(q['scientific_types'])}), `definition`, `deprecated`.")
w("- **Technique:** name normalization (lowercase, strip punctuation & parentheticals, drop noise words like *skills/professional/and*), then (a) exact-name match, (b) token-set match (order/qualifier-insensitive), and (c) pairwise fuzzy similarity (string ratio + token Jaccard). Each candidate pair was then **manually adjudicated** against domain / family / type.")
w("")
w("> **⚠️ Critical limitation — definitions are placeholders.** Every `definition` is an auto-generated template of the form *\u201cX — canonical competency in the Y family.\u201d* They carry **no real semantic content**, so true meaning-based de-duplication is impossible from the data alone. All judgements below rest on **names + taxonomy (domain/family/type)**. **Authoring real definitions is itself the single highest-value cleanup action** — see §6. This is reported as a Coverage gap (the field exists) separate from Confidence (it is not trustworthy for dedup).")
w("")
w("## 2. Scorecard")
w("")
w("| Check | Result |")
w("|---|---|")
w(f"| Total competencies reviewed | **{q['total']}** |")
w(f"| Deprecated flags set | **{q['deprecated_count']}** (none) |")
w(f"| Exact duplicate names | **{len(q['exact_dups'])}** (none) |")
w(f"| Literal \u201c(duplicate)\u201d / dup markers | **{len(q['dup_markers'])}** (none) |")
w(f"| Name-variant duplicate groups (order/qualifier) | **{len(q['token_dups'])}** confirmed + 7 lower-confidence |")
w(f"| Near-duplicate pairs flagged by similarity | **{len(q['near'])}** (most are *distinct* — see §5) |")
w(f"| Genuine classification conflicts | **{len(CONFLICTS)}** |")
w(f"| High-confidence merge groups recommended | **{len(MERGE_HIGH)}** |")
w(f"| Medium-confidence merge groups recommended | **{len(MERGE_MED)}** |")
w("")
w("**Headline:** the master is **clean of literal duplicates** (no identical names, no `(duplicate)` markers, nothing flagged `deprecated`). The real issues are **naming inconsistency** (word-order & qualifier variants of the same construct) and **classification inconsistency** (the same construct filed under different `scientific_type`s).")
w("")

w("## 3. Duplicates & merge recommendations")
w("")
w("### 3a. High-confidence merges (name-variants of one construct — same domain, family & type)")
w("")
w("| Merge these | → Retain | Why |")
w("|---|---|---|")
for names, keep, why in MERGE_HIGH:
    w(f"| {line(names)} | **{keep}** | {why} |")
w("")
w("### 3b. Medium-confidence merges (qualifier/context noise — same type; SME confirm)")
w("")
w("| Merge these | → Retain | Why |")
w("|---|---|---|")
for names, keep, why in MERGE_MED:
    w(f"| {line(names)} | **{keep}** | {why} |")
w("")

w("## 4. Conflicting competencies (same construct, inconsistent classification)")
w("")
w("These are **not** simple duplicates: the same idea appears under **different `scientific_type` / `domain`**, so a merge must first decide the correct classification. They also reveal a **systemic taxonomy-governance gap** (see §6).")
w("")
w("| Conflicting pair | Conflict & recommended resolution |")
w("|---|---|")
for names, why in CONFLICTS:
    w(f"| {line(names)} | {why} |")
w("")

w("## 5. Near-duplicates reviewed → RETAIN (distinct despite similar names)")
w("")
w("High string-similarity does **not** mean duplicate. The following were flagged by the algorithm but are **legitimately distinct** and should be kept as-is (over-merging would destroy real signal):")
w("")
w("| Pair / set | Why they are distinct |")
w("|---|---|")
for names, why in RETAIN:
    w(f"| {line(names)} | {why} |")
w("")
w("### Needs subject-matter-expert (SME) decision")
w("")
w("| Set | Note |")
w("|---|---|")
for names, why in REVIEW:
    w(f"| {line(names)} | {why} |")
w("")

w("## 6. Cleanup actions (recommended — NOT executed; require approval)")
w("")
w("Ordered by value. Nothing here was run; all are proposals.")
w("")
w("1. **Author real definitions for all 299 competencies.** The placeholder definitions are the biggest quality gap — they block rigorous dedup and weaken every downstream engine that reads them. *(Highest value.)*")
w("2. **Apply the 6 high-confidence merges (§3a).** For each: keep the canonical row, repoint any references, and either delete the variant or set `deprecated=true` + `deprecated_replacement_id` (the schema already supports this — it is currently unused).")
w("3. **Resolve the 3 classification conflicts (§4)** by agreeing the correct `scientific_type`/`domain` for each construct *before* merging.")
w("4. **Adjudicate the medium-confidence merges (§3b) and the Decision-Making family (§5)** with an SME, then apply.")
w("5. **Add a uniqueness/consistency guard:** a naming convention (canonical noun-phrase, no trailing \u201cSkills\u201d, no speed/quality adjectives) + a CI check on token-set collisions so new variants can't re-enter.")
w("6. **Adopt the soft-delete path:** prefer `deprecated=true` + `deprecated_replacement_id` over hard deletes so historical scores remain resolvable.")
w("")
w("> **Suggested non-destructive mechanism for merges (illustrative — do not run without approval):**")
w("> ```sql")
w("> UPDATE onto_competencies")
w(">   SET deprecated = true, deprecated_replacement_id = '<canonical_id>', updated_at = now()")
w("> WHERE id = '<variant_id>';")
w("> ```")
w("> Repoint dependent tables (e.g. `onto_competency_type_map`, `map_role_competency`, score tables) to `<canonical_id>` in the same transaction.")
w("")

# ---- Appendix: full near-duplicate pair table (auto-generated, honest) ----
w("## Appendix A — All similarity-flagged pairs (live, unfiltered)")
w("")
w(f"All **{len(q['near'])}** pairs above the similarity threshold, sorted by strength. `DIFF-TYPE` = the two sit under different `scientific_type`. This is the raw evidence behind §3–§5; inclusion here is **not** a merge recommendation.")
w("")
w("| string | jaccard | A (type/domain) | B (type/domain) | flag |")
w("|---:|---:|---|---|---|")
for nd in q["near"]:
    flag = "DIFF-TYPE" if not nd["same_type"] else ("same-domain" if nd["same_domain"] else "cross-domain")
    w(f"| {nd['string_sim']:.2f} | {nd['token_jaccard']:.2f} | {nd['a']} ({nd['a_type']}/{nd['a_domain']}) | {nd['b']} ({nd['b_type']}/{nd['b_domain']}) | {flag} |")
w("")
w("---")
w("")
w(f"*End of report. {q['total']} competencies reviewed; 0 modified. Read-only Phase-1.3 audit.*")

out = "\n".join(L) + "\n"
open("reports/competency_quality_report.md", "w", encoding="utf-8").write(out)
print("wrote reports/competency_quality_report.md", len(L), "lines")
