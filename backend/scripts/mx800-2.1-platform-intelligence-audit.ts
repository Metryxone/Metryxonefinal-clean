/**
 * MX-800 Phase 2.1 — Platform Intelligence Operating System Constitution
 * MEASUREMENT SCRIPT (read-only repository scan).
 *
 * This script implements the HONESTY CONTRACT of the phase: every number in the
 * audit deliverable is MEASURED from the live repository here — nothing is
 * fabricated or estimated. It performs NO database access, sets NO feature flags,
 * activates NOTHING, and modifies NO business logic. It only reads the filesystem
 * and writes audit artifacts under backend/audit/mx-800/.
 *
 * It does NOT implement an intelligence engine. It measures the ones that exist.
 */
import * as fs from "fs";
import * as path from "path";

const BACKEND = path.resolve(__dirname, "..");
const ROOT = path.resolve(BACKEND, "..");
const OUT_DIR = path.join(BACKEND, "audit", "mx-800");

function listFiles(dir: string, ext: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(ext))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

function exists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 1) RAW INVENTORY — definitive, exact counts.
// ---------------------------------------------------------------------------
const services = listFiles(path.join(BACKEND, "services"), ".ts");
const servicesGovernance = listFiles(path.join(BACKEND, "services", "governance"), ".ts");
const servicesAutomation = listFiles(path.join(BACKEND, "services", "automation"), ".ts");
const routes = listFiles(path.join(BACKEND, "routes"), ".ts");
const migrations = listFiles(path.join(BACKEND, "migrations"), ".sql");
const memoryDocs = listFiles(path.join(ROOT, ".agents", "memory"), ".md");
const docs = listFiles(path.join(ROOT, "docs"), ".md");

const inventory = {
  services_top_level: services.length,
  services_governance_subdir: servicesGovernance.length,
  services_automation_subdir: servicesAutomation.length,
  routes_modules: routes.length,
  migrations: migrations.length,
  memory_topic_docs: memoryDocs.length,
  product_docs: docs.length,
};

// ---------------------------------------------------------------------------
// 2) FEATURE FLAGS — parse name + default state from the registry file.
// ---------------------------------------------------------------------------
const flagFile = path.join(BACKEND, "config", "feature-flags.ts");
const flagSrc = exists(flagFile) ? fs.readFileSync(flagFile, "utf8") : "";
const flagRe = /^\s{2}([a-zA-Z][a-zA-Z0-9]*):\s*(true|false),?\s*$/gm;
const flags: { name: string; default: boolean }[] = [];
let m: RegExpExecArray | null;
while ((m = flagRe.exec(flagSrc)) !== null) {
  flags.push({ name: m[1], default: m[2] === "true" });
}
const flagsOn = flags.filter((f) => f.default).length;
const flagsOff = flags.length - flagsOn;

// ---------------------------------------------------------------------------
// 3) CONSTITUTIONAL DOMAIN ANCHOR MAP.
//    The nine intelligence domains named in the MX-800 spec, each mapped to its
//    REPRESENTATIVE existing engine files (anchors). This is a CURATED map, not
//    an exhaustive exclusive partition of all 422 services — so we never imply
//    false precision. Every anchor is verified to EXIST on disk; a declared
//    anchor that is missing is reported honestly (present:false), never assumed.
// ---------------------------------------------------------------------------
type Anchor = { domain: string; kind: "service" | "route"; file: string };
const ANCHORS: Anchor[] = [
  // Repository Intelligence — discovery/registry over the repo (MX-700 1.37/1.38)
  { domain: "Repository Intelligence", kind: "service", file: "platform-lifecycle.ts" },
  { domain: "Repository Intelligence", kind: "service", file: "platform-lifecycle-management.ts" },
  { domain: "Repository Intelligence", kind: "route", file: "platform-lifecycle.ts" },
  { domain: "Repository Intelligence", kind: "route", file: "platform-lifecycle-management.ts" },
  // Platform Intelligence — read-only intelligence over the registry (MX-700 1.39/1.42)
  { domain: "Platform Intelligence", kind: "service", file: "platform-lifecycle-intelligence.ts" },
  { domain: "Platform Intelligence", kind: "route", file: "platform-lifecycle-intelligence.ts" },
  { domain: "Platform Intelligence", kind: "route", file: "platform-intelligence.ts" },
  { domain: "Platform Intelligence", kind: "route", file: "platform-lifecycle-operations.ts" },
  // Engineering Intelligence — evolution/debt, automation, quality gates, certification (MX-700 1.40/1.41/1.43)
  { domain: "Engineering Intelligence", kind: "service", file: "platform-evolution-intelligence.ts" },
  { domain: "Engineering Intelligence", kind: "service", file: "platform-lifecycle-automation.ts" },
  { domain: "Engineering Intelligence", kind: "service", file: "platform-lifecycle-certification.ts" },
  { domain: "Engineering Intelligence", kind: "service", file: "platform-completion-certification.ts" },
  { domain: "Engineering Intelligence", kind: "service", file: "go-live-certification.ts" },
  { domain: "Engineering Intelligence", kind: "route", file: "platform-evolution-intelligence.ts" },
  { domain: "Engineering Intelligence", kind: "route", file: "platform-lifecycle-automation.ts" },
  { domain: "Engineering Intelligence", kind: "route", file: "platform-lifecycle-certification.ts" },
  // Runtime Intelligence — signal capture + runtime pipeline + observability
  { domain: "Runtime Intelligence", kind: "service", file: "intelligence-pipeline.ts" },
  { domain: "Runtime Intelligence", kind: "service", file: "intelligence-observability-engine.ts" },
  { domain: "Runtime Intelligence", kind: "route", file: "signal-capture.ts" },
  { domain: "Runtime Intelligence", kind: "route", file: "behavioural-signals.ts" },
  { domain: "Runtime Intelligence", kind: "route", file: "intelligence-diagnostics.ts" },
  // Knowledge Intelligence — knowledge graph + memory engines + curated knowledge
  { domain: "Knowledge Intelligence", kind: "service", file: "knowledge-graph.ts" },
  { domain: "Knowledge Intelligence", kind: "service", file: "mx203-knowledge.ts" },
  { domain: "Knowledge Intelligence", kind: "service", file: "behavioural-memory.ts" },
  { domain: "Knowledge Intelligence", kind: "service", file: "longitudinal-memory.ts" },
  { domain: "Knowledge Intelligence", kind: "service", file: "competency-memory-engine.ts" },
  { domain: "Knowledge Intelligence", kind: "route", file: "mx203-knowledge.ts" },
  // Decision Intelligence — orchestration + persistence + bridges (WC-6/WC-7b/WC-11)
  { domain: "Decision Intelligence", kind: "service", file: path.join("wc7b", "decision-orchestrator.ts") },
  { domain: "Decision Intelligence", kind: "service", file: path.join("wc7b", "decision-persistence.ts") },
  { domain: "Decision Intelligence", kind: "service", file: path.join("wc7b", "mentor-bridge.ts") },
  { domain: "Decision Intelligence", kind: "service", file: path.join("wc7b", "growth-plan-bridge.ts") },
  { domain: "Decision Intelligence", kind: "route", file: "wc7b-activation.ts" },
  // AI Intelligence — AI governance + narrative + explainability/fairness
  { domain: "AI Intelligence", kind: "service", file: "ai-governance-v2.ts" },
  { domain: "AI Intelligence", kind: "service", file: "m4-ai-governance.ts" },
  { domain: "AI Intelligence", kind: "service", file: "intelligence-narrative-engine.ts" },
  { domain: "AI Intelligence", kind: "service", file: "explainability-governance-engine.ts" },
  { domain: "AI Intelligence", kind: "service", file: "fairness-governance-engine.ts" },
  { domain: "AI Intelligence", kind: "route", file: "ai-governance.ts" },
  // Analytics Intelligence — analytics warehouses + market/comparative intelligence
  { domain: "Analytics Intelligence", kind: "service", file: "workforce-analytics.ts" },
  { domain: "Analytics Intelligence", kind: "service", file: "comparative-intelligence.ts" },
  { domain: "Analytics Intelligence", kind: "service", file: "market-intelligence-engine.ts" },
  { domain: "Analytics Intelligence", kind: "route", file: "enterprise-analytics.ts" },
  { domain: "Analytics Intelligence", kind: "route", file: "caf-analytics.ts" },
  { domain: "Analytics Intelligence", kind: "route", file: "talent-analytics-warehouse.ts" },
  // Enterprise Intelligence — enterprise/executive/workforce/institutional/global
  { domain: "Enterprise Intelligence", kind: "service", file: "enterprise-intelligence.ts" },
  { domain: "Enterprise Intelligence", kind: "service", file: "enterprise-certification.ts" },
  { domain: "Enterprise Intelligence", kind: "service", file: "executive-workforce-intelligence.ts" },
  { domain: "Enterprise Intelligence", kind: "service", file: "global-intelligence.ts" },
  { domain: "Enterprise Intelligence", kind: "service", file: "institutional-intelligence-engine.ts" },
  { domain: "Enterprise Intelligence", kind: "route", file: "enterprise-intelligence.ts" },
  { domain: "Enterprise Intelligence", kind: "route", file: "enterprise-governance.ts" },
];

const svcDir = path.join(BACKEND, "services");
const rtDir = path.join(BACKEND, "routes");
const anchorResults = ANCHORS.map((a) => {
  const base = a.kind === "service" ? svcDir : rtDir;
  return { ...a, present: exists(path.join(base, a.file)) };
});

const DOMAIN_ORDER = [
  "Repository Intelligence",
  "Platform Intelligence",
  "Engineering Intelligence",
  "Runtime Intelligence",
  "Knowledge Intelligence",
  "Decision Intelligence",
  "AI Intelligence",
  "Analytics Intelligence",
  "Enterprise Intelligence",
];
const domainSummary = DOMAIN_ORDER.map((d) => {
  const items = anchorResults.filter((a) => a.domain === d);
  const present = items.filter((a) => a.present).length;
  return {
    domain: d,
    anchors_declared: items.length,
    anchors_present: present,
    anchors_missing: items.filter((a) => !a.present).map((a) => `${a.kind}:${a.file}`),
  };
});

// ---------------------------------------------------------------------------
// 4) GOVERNANCE SUBSTRATE (Part 4) — cross-cutting metadata/evidence/confidence/
//    explainability/ownership/compatibility surface. MEASURED, not assumed.
// ---------------------------------------------------------------------------
const governanceServices = services.filter((s) => /governance/i.test(s));
const governanceRoutes = routes.filter((s) => /governance/i.test(s));

// ---------------------------------------------------------------------------
// 5) DUPLICATION CANDIDATES — files whose name pairs a base with a -v2 variant.
//    These are flagged for HUMAN REVIEW as candidates; the script does NOT
//    assert they are redundant (Intelligence-Exists ≠ Duplicate).
// ---------------------------------------------------------------------------
const v2Services = services.filter((s) => /(-v2|V2)\.ts$/.test(s));
const duplicationCandidates = v2Services.map((v2) => {
  const base = v2.replace(/-v2\.ts$/, ".ts").replace(/V2\.ts$/, ".ts");
  return { variant: v2, base_candidate: base, base_present: services.includes(base) };
});

// ---------------------------------------------------------------------------
// 6) BUSINESS / DOMAIN ENGINE BREAKDOWN — honest split of the broad engine
//    families that the Platform Intelligence OS OBSERVES (it does not replace
//    them). Prefix-based, measured; residual reported as "other/infra".
// ---------------------------------------------------------------------------
const PREFIXES: { label: string; re: RegExp }[] = [
  { label: "career-*", re: /^career[-.]/ },
  { label: "competency-*", re: /^competency[-.]/ },
  { label: "capadex*", re: /^capadex/ },
  { label: "talent-*", re: /^talent[-.]/ },
  { label: "hiring/employer-*", re: /^(hiring|employer)[-.]/ },
  { label: "learning/lip/lde-*", re: /^(learning|lip|lde|lbi)[-.]/ },
  { label: "ei-*", re: /^ei[-.]/ },
  { label: "workforce-*", re: /^workforce[-.]/ },
  { label: "enterprise-*", re: /^enterprise[-.]/ },
  { label: "platform-*", re: /^platform[-.]/ },
  { label: "ontology/onet/role-dna", re: /^(ont|onto|onet|role-dna|reference)[-.]/ },
  { label: "report/omega/rf", re: /^(report|omega|rf|dynamic-report)/ },
  { label: "*-governance", re: /governance/ },
  { label: "*intelligence*", re: /intelligence/ },
];
const prefixCounts = PREFIXES.map((p) => ({
  family: p.label,
  service_files: services.filter((s) => p.re.test(s)).length,
  route_files: routes.filter((s) => p.re.test(s)).length,
}));

// ---------------------------------------------------------------------------
// ASSEMBLE + WRITE
// ---------------------------------------------------------------------------
const audit = {
  phase: "MX-800 Phase 2.1 — Platform Intelligence Operating System Constitution",
  mode: "ENHANCEMENT-ONLY / AUDIT + CONSTITUTION (no engine, no business-logic change, no persistence)",
  measured_at: new Date().toISOString(),
  honesty_contract: [
    "Intelligence Exists != Connected != Orchestrated",
    "Data != Knowledge != Intelligence != Reasoning != Decision != Automation",
    "Coverage != Confidence; Evidence != Confidence",
    "Every number below is MEASURED from the repository. Nothing fabricated or estimated.",
  ],
  inventory,
  feature_flags: { total: flags.length, default_on: flagsOn, default_off: flagsOff },
  constitutional_domains: domainSummary,
  governance_substrate: {
    governance_services: governanceServices.length,
    governance_services_subdir: servicesGovernance.length,
    governance_routes: governanceRoutes.length,
    governance_service_files: governanceServices,
  },
  duplication_candidates: {
    count: duplicationCandidates.length,
    note: "CANDIDATES for human review only — presence of a -v2 variant is NOT an assertion of redundancy.",
    items: duplicationCandidates,
  },
  observed_engine_families: prefixCounts,
  anchor_detail: anchorResults,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "phase-2.1-platform-intelligence-audit.json"), JSON.stringify(audit, null, 2));

// Human-readable measured audit MD (the narrative Constitution docs are authored separately).
const md: string[] = [];
md.push("# MX-800 Phase 2.1 — Platform Intelligence Audit (MEASURED)\n");
md.push(`_Measured at ${audit.measured_at} by \`scripts/mx800-2.1-platform-intelligence-audit.ts\` — pure read-only repository scan._\n`);
md.push("> Honesty: every figure here is measured from the live repository. Nothing is fabricated or estimated. Intelligence Exists ≠ Connected ≠ Orchestrated.\n");
md.push("## 1. Raw inventory\n");
md.push("| Asset | Count |");
md.push("|---|---|");
md.push(`| Backend services (top-level) | ${inventory.services_top_level} |`);
md.push(`| Governance services (subdir) | ${inventory.services_governance_subdir} |`);
md.push(`| Automation services (subdir) | ${inventory.services_automation_subdir} |`);
md.push(`| Route modules | ${inventory.routes_modules} |`);
md.push(`| Migrations | ${inventory.migrations} |`);
md.push(`| Memory topic docs | ${inventory.memory_topic_docs} |`);
md.push(`| Product docs | ${inventory.product_docs} |`);
md.push(`| Feature flags | ${flags.length} (${flagsOn} default-ON / ${flagsOff} default-OFF) |\n`);
md.push("## 2. Constitutional intelligence domains (anchor coverage)\n");
md.push("Representative existing engines per domain; anchors verified to exist on disk. This is a curated anchor map, **not** an exhaustive partition of all services.\n");
md.push("| Domain | Anchors present / declared | Missing |");
md.push("|---|---|---|");
for (const d of domainSummary) {
  md.push(`| ${d.domain} | ${d.anchors_present} / ${d.anchors_declared} | ${d.anchors_missing.length ? d.anchors_missing.join(", ") : "—"} |`);
}
md.push("\n## 3. Governance substrate (cross-cutting)\n");
md.push(`- Governance-named services: **${governanceServices.length}** (+ ${servicesGovernance.length} in \`services/governance/\`)`);
md.push(`- Governance-named route modules: **${governanceRoutes.length}**\n`);
md.push("## 4. Duplication candidates (human-review only)\n");
md.push(`Found **${duplicationCandidates.length}** \`-v2\` service variants. Presence of a variant is NOT proof of redundancy — flagged for review.\n`);
md.push("| Variant | Base candidate | Base present |");
md.push("|---|---|---|");
for (const d of duplicationCandidates) md.push(`| ${d.variant} | ${d.base_candidate} | ${d.base_present ? "yes" : "no"} |`);
md.push("\n## 5. Observed engine families (the OS observes, not replaces)\n");
md.push("| Family (name pattern) | Service files | Route files |");
md.push("|---|---|---|");
for (const p of prefixCounts) md.push(`| ${p.family} | ${p.service_files} | ${p.route_files} |`);
md.push("\n_Note: families overlap by name pattern (e.g. a service can be both `*intelligence*` and `enterprise-*`); counts are per-pattern, not a disjoint partition._\n");
fs.writeFileSync(path.join(OUT_DIR, "phase-2.1-platform-intelligence-audit.md"), md.join("\n"));

console.log("MX-800 2.1 audit written to", OUT_DIR);
console.log(JSON.stringify({ inventory, flags: { total: flags.length, on: flagsOn, off: flagsOff }, domains: domainSummary.map((d) => `${d.domain}: ${d.anchors_present}/${d.anchors_declared}`), duplication_candidates: duplicationCandidates.length }, null, 2));
