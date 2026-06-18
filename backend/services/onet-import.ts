/**
 * MetryxOne Competency Ontology — O*NET bulk importer.
 *
 * Expands the curated starter ontology (services/ontology-seed.ts) into a full
 * role / skill library sourced from the U.S. DoL O*NET database (public domain,
 * CC-BY). Brings real occupations and the O*NET Content Model (Skills, Abilities,
 * Knowledge, Work Styles) into the existing `ont_*` tables so competency
 * assessments and role recommendations draw on a recognised taxonomy rather than
 * hand-authored rows.
 *
 * Mapping into the existing 12-layer hierarchy:
 *   O*NET SOC major group   → ont_role_families      (code RF_ONET_<nn>)
 *   O*NET occupation        → ont_roles              (code ONET_<soc>)
 *   O*NET content element    → ont_competencies       (code ONET_<elementId>)
 *     Skills      (2.A / 2.B) → cluster CC_ONET_SKILLS
 *     Abilities   (1.A)       → cluster CC_ONET_ABILITIES
 *     Knowledge   (2.C)       → cluster CC_ONET_KNOWLEDGE
 *     Work Styles (1.C)       → cluster CC_ONET_WORKSTYLES
 *   O*NET occupation×element → map_role_competency    (source 'onet')
 *
 * Idempotent: every write is ON CONFLICT DO UPDATE / DO NOTHING, so re-running
 * refreshes in place and never duplicates. Additive: the curated starter rows
 * (ROLE_*, C_*) use disjoint code namespaces and are left untouched.
 *
 * Data files: tab-delimited O*NET text exports in `backend/data/onet/`. If a file
 * is missing the importer downloads it from onetcenter.org (override with the
 * ONET_DB_BASE_URL env var; skip with download:false).
 */

import type { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import { ensureTaxonomySchema } from '../routes/ontology-taxonomy.js';
import { ensureCompetencyCoreSchema } from '../routes/ontology-competency-core.js';

export interface OnetImportOptions {
  /** Directory holding the O*NET text exports. Default backend/data/onet. */
  dataDir?: string;
  /** Download missing files from onetcenter.org. Default true. */
  download?: boolean;
  /** Keep only occupation↔element links at or above this importance (1-5). Default 3.0. */
  importanceThreshold?: number;
}

export interface OnetImportResult {
  counts: Record<string, number>;
  ok: boolean;
  error?: string;
}

const DEFAULT_BASE_URL =
  process.env.ONET_DB_BASE_URL ||
  'https://www.onetcenter.org/dl_files/database/db_29_0_text';

// O*NET SOC major groups (first two digits of the SOC code). Stable, public domain.
const SOC_MAJOR_GROUPS: Record<string, string> = {
  '11': 'Management',
  '13': 'Business and Financial Operations',
  '15': 'Computer and Mathematical',
  '17': 'Architecture and Engineering',
  '19': 'Life, Physical, and Social Science',
  '21': 'Community and Social Service',
  '23': 'Legal',
  '25': 'Educational Instruction and Library',
  '27': 'Arts, Design, Entertainment, Sports, and Media',
  '29': 'Healthcare Practitioners and Technical',
  '31': 'Healthcare Support',
  '33': 'Protective Service',
  '35': 'Food Preparation and Serving Related',
  '37': 'Building and Grounds Cleaning and Maintenance',
  '39': 'Personal Care and Service',
  '41': 'Sales and Related',
  '43': 'Office and Administrative Support',
  '45': 'Farming, Fishing, and Forestry',
  '47': 'Construction and Extraction',
  '49': 'Installation, Maintenance, and Repair',
  '51': 'Production',
  '53': 'Transportation and Material Moving',
  '55': 'Military Specific',
};

// Each O*NET data file → the cluster / category / competency type its elements map to.
interface ContentFile {
  file: string;
  remote: string;
  clusterCode: string;
  clusterName: string;
  category: string;
  competencyType: string;
}
const CONTENT_FILES: ContentFile[] = [
  { file: 'Skills.txt',      remote: 'Skills',      clusterCode: 'CC_ONET_SKILLS',     clusterName: 'Occupational Skills (O*NET)',  category: 'technical',  competencyType: 'functional' },
  { file: 'Abilities.txt',   remote: 'Abilities',   clusterCode: 'CC_ONET_ABILITIES',  clusterName: 'Abilities (O*NET)',            category: 'cognitive',  competencyType: 'core' },
  { file: 'Knowledge.txt',   remote: 'Knowledge',   clusterCode: 'CC_ONET_KNOWLEDGE',  clusterName: 'Knowledge Domains (O*NET)',    category: 'domain',     competencyType: 'domain' },
  { file: 'Work_Styles.txt', remote: 'Work Styles', clusterCode: 'CC_ONET_WORKSTYLES', clusterName: 'Work Styles (O*NET)',          category: 'behavioral', competencyType: 'behavioral' },
];

const OCCUPATION_FILE = { file: 'Occupation_Data.txt', remote: 'Occupation Data' };

const LEADERSHIP_RE = /\b(chief|director|manager|supervisor|executive|head|president|officer|lead)\b/i;

function isLeadershipTitle(title: string): boolean {
  return LEADERSHIP_RE.test(title);
}

// Map an O*NET Level scale value (0-7) to a proficiency band.
function levelToProficiency(lv: number | null): string {
  if (lv == null || lv < 2) return 'novice';
  if (lv < 3.5) return 'developing';
  if (lv < 5) return 'proficient';
  if (lv < 6) return 'advanced';
  return 'expert';
}
const PROF_ORDER = ['novice', 'developing', 'proficient', 'advanced', 'expert'];
function oneBandBelow(p: string): string {
  const i = PROF_ORDER.indexOf(p);
  return i <= 0 ? 'novice' : PROF_ORDER[i - 1];
}

async function ensureFile(dataDir: string, remoteName: string, localName: string, download: boolean): Promise<string> {
  const local = path.join(dataDir, localName);
  try {
    await fs.access(local);
    return local;
  } catch {
    if (!download) {
      throw new Error(`Missing O*NET file ${localName} in ${dataDir} (download disabled)`);
    }
  }
  const url = `${DEFAULT_BASE_URL}/${encodeURIComponent(remoteName)}.txt`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed for ${url}: HTTP ${resp.status}`);
  const text = await resp.text();
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(local, text, 'utf8');
  return local;
}

// Parse a tab-delimited O*NET export into header + rows.
async function readTsv(filePath: string): Promise<{ header: string[]; rows: string[][] }> {
  const text = await fs.readFile(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  const header = lines[0].split('\t');
  const rows = lines.slice(1).map(l => l.split('\t'));
  return { header, rows };
}

// Insert rows in chunks via a multi-row parameterised INSERT.
async function chunkedInsert(
  pool: Pool,
  buildSql: (rowCount: number) => string,
  flat: unknown[],
  colsPerRow: number,
  chunkRows = 400,
): Promise<void> {
  const totalRows = flat.length / colsPerRow;
  for (let start = 0; start < totalRows; start += chunkRows) {
    const rowCount = Math.min(chunkRows, totalRows - start);
    const slice = flat.slice(start * colsPerRow, (start + rowCount) * colsPerRow);
    await pool.query(buildSql(rowCount), slice);
  }
}

export async function runOnetImport(pool: Pool, opts: OnetImportOptions = {}): Promise<OnetImportResult> {
  const dataDir = opts.dataDir ?? path.join(process.cwd(), 'data', 'onet');
  const download = opts.download ?? true;
  const importanceThreshold = opts.importanceThreshold ?? 3.0;
  const counts: Record<string, number> = {};

  try {
    await ensureTaxonomySchema(pool);
    await ensureCompetencyCoreSchema(pool);

    // ── 1. LAYER + CLUSTERS ────────────────────────────────────────────────
    await pool.query(`
      INSERT INTO ont_layers (code, name, description, layer_type, scoring_weight, sort_order, status)
      VALUES ('L_ONET', 'Occupational Framework (O*NET)',
              'Occupation skill/ability/knowledge requirements imported from the O*NET database',
              'functional', 1.000, 5, 'published')
      ON CONFLICT (code) DO NOTHING
    `);
    const { rows: [layerRow] } = await pool.query(`SELECT id FROM ont_layers WHERE code='L_ONET'`);
    const layerId: number = layerRow.id;

    for (const cf of CONTENT_FILES) {
      await pool.query(
        `INSERT INTO ont_competency_clusters (code, name, layer_id, category, sort_order, status)
         VALUES ($1,$2,$3,$4,0,'published')
         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, layer_id=EXCLUDED.layer_id,
           category=EXCLUDED.category, updated_at=NOW()`,
        [cf.clusterCode, cf.clusterName, layerId, cf.category],
      );
    }
    counts.clusters = CONTENT_FILES.length;
    const { rows: clusterRows } = await pool.query(
      `SELECT id, code FROM ont_competency_clusters WHERE code = ANY($1)`,
      [CONTENT_FILES.map(c => c.clusterCode)],
    );
    const clusterIdByCode = new Map<string, number>(clusterRows.map((r: any) => [r.code, r.id]));

    // ── 2. ROLE FAMILIES (SOC major groups) ────────────────────────────────
    {
      const flat: unknown[] = [];
      const groups = Object.entries(SOC_MAJOR_GROUPS);
      for (const [nn, name] of groups) {
        flat.push(`RF_ONET_${nn}`, name, `O*NET SOC major group ${nn}: ${name}`, 'published');
      }
      await chunkedInsert(
        pool,
        (n) => `INSERT INTO ont_role_families (code, name, description, status) VALUES ${
          Array.from({ length: n }, (_, i) => `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`).join(',')
        } ON CONFLICT (code) DO NOTHING`,
        flat, 4,
      );
      counts.role_families = groups.length;
    }
    const { rows: rfRows } = await pool.query(
      `SELECT id, code FROM ont_role_families WHERE code LIKE 'RF_ONET_%'`,
    );
    const rfIdByCode = new Map<string, number>(rfRows.map((r: any) => [r.code, r.id]));

    // ── 3. ROLES (occupations) ─────────────────────────────────────────────
    const occPath = await ensureFile(dataDir, OCCUPATION_FILE.remote, OCCUPATION_FILE.file, download);
    const occ = await readTsv(occPath);
    {
      const flat: unknown[] = [];
      let n = 0;
      for (const r of occ.rows) {
        const soc = (r[0] ?? '').trim();
        const title = (r[1] ?? '').trim();
        const desc = (r[2] ?? '').trim();
        if (!soc || !title) continue;
        const major = soc.slice(0, 2);
        const rfId = rfIdByCode.get(`RF_ONET_${major}`) ?? null;
        flat.push(`ONET_${soc}`, title.slice(0, 180), rfId, 'mid', desc || null, isLeadershipTitle(title), 'published');
        n++;
      }
      await chunkedInsert(
        pool,
        (rows) => `INSERT INTO ont_roles (code, title, role_family_id, seniority_level, description, is_leadership, status) VALUES ${
          Array.from({ length: rows }, (_, i) => `($${i * 7 + 1},$${i * 7 + 2},$${i * 7 + 3},$${i * 7 + 4},$${i * 7 + 5},$${i * 7 + 6},$${i * 7 + 7})`).join(',')
        } ON CONFLICT (code) DO UPDATE SET title=EXCLUDED.title, role_family_id=EXCLUDED.role_family_id,
            description=EXCLUDED.description, is_leadership=EXCLUDED.is_leadership, status=EXCLUDED.status, updated_at=NOW()`,
        flat, 7,
      );
      counts.roles = n;
    }
    const { rows: roleRows } = await pool.query(
      `SELECT id, code FROM ont_roles WHERE code LIKE 'ONET_%'`,
    );
    const roleIdByCode = new Map<string, number>(roleRows.map((r: any) => [r.code, r.id]));

    // ── 4. CONTENT MODEL → COMPETENCIES + LINKS ────────────────────────────
    // elementId → { name, clusterCode, category, competencyType }
    const elements = new Map<string, { name: string; clusterCode: string; category: string; competencyType: string }>();
    // `${soc}|${elementId}` → { im, lv }
    type Link = { im: number | null; lv: number | null };
    const links = new Map<string, Link>();

    for (const cf of CONTENT_FILES) {
      const fp = await ensureFile(dataDir, cf.remote, cf.file, download);
      const { header, rows } = await readTsv(fp);
      const ci = {
        soc: header.indexOf('O*NET-SOC Code'),
        eid: header.indexOf('Element ID'),
        name: header.indexOf('Element Name'),
        scale: header.indexOf('Scale ID'),
        value: header.indexOf('Data Value'),
        suppress: header.indexOf('Recommend Suppress'),
        notRel: header.indexOf('Not Relevant'),
      };
      for (const r of rows) {
        const soc = (r[ci.soc] ?? '').trim();
        const eid = (r[ci.eid] ?? '').trim();
        const name = (r[ci.name] ?? '').trim();
        const scale = (r[ci.scale] ?? '').trim();
        const value = parseFloat(r[ci.value] ?? '');
        if (!soc || !eid || isNaN(value)) continue;
        if ((r[ci.suppress] ?? '').trim() === 'Y') continue;
        if ((r[ci.notRel] ?? '').trim() === 'Y') continue;

        if (!elements.has(eid)) {
          elements.set(eid, { name: name.slice(0, 180), clusterCode: cf.clusterCode, category: cf.category, competencyType: cf.competencyType });
        }
        const key = `${soc}|${eid}`;
        const link = links.get(key) ?? { im: null, lv: null };
        if (scale === 'IM') link.im = value;
        else if (scale === 'LV') link.lv = value;
        links.set(key, link);
      }
    }

    // 4a. Competencies
    {
      const flat: unknown[] = [];
      let n = 0;
      for (const [eid, e] of elements) {
        const clusterId = clusterIdByCode.get(e.clusterCode) ?? null;
        flat.push(`ONET_${eid}`, e.name, clusterId, e.category, e.competencyType, eid, 'published');
        n++;
      }
      await chunkedInsert(
        pool,
        (rows) => `INSERT INTO ont_competencies (code, name, cluster_id, category, competency_type, external_ref, status) VALUES ${
          Array.from({ length: rows }, (_, i) => `($${i * 7 + 1},$${i * 7 + 2},$${i * 7 + 3},$${i * 7 + 4},$${i * 7 + 5},$${i * 7 + 6},$${i * 7 + 7})`).join(',')
        } ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, cluster_id=EXCLUDED.cluster_id,
            category=EXCLUDED.category, competency_type=EXCLUDED.competency_type, external_ref=EXCLUDED.external_ref, updated_at=NOW()`,
        flat, 7,
      );
      counts.competencies = n;
    }
    const { rows: compRows } = await pool.query(
      `SELECT id, code FROM ont_competencies WHERE code LIKE 'ONET_%'`,
    );
    const compIdByCode = new Map<string, number>(compRows.map((r: any) => [r.code, r.id]));

    // 4b. Role ↔ competency links (filtered by importance)
    {
      const flat: unknown[] = [];
      let n = 0;
      let skipped = 0;
      for (const [key, link] of links) {
        if (link.im == null || link.im < importanceThreshold) { skipped++; continue; }
        const [soc, eid] = key.split('|');
        const roleId = roleIdByCode.get(`ONET_${soc}`);
        const compId = compIdByCode.get(`ONET_${eid}`);
        if (!roleId || !compId) { skipped++; continue; }
        const tier = link.im >= 3.75 ? 'core' : 'secondary';
        const weight = Math.min(1.5, Math.max(0.5, Math.round((link.im / 3.5) * 1000) / 1000));
        const target = levelToProficiency(link.lv);
        const minP = oneBandBelow(target);
        flat.push(roleId, compId, tier, weight, minP, target, 'onet');
        n++;
      }
      await chunkedInsert(
        pool,
        (rows) => `INSERT INTO map_role_competency (role_id, competency_id, importance_tier, weight, min_proficiency, target_proficiency, source) VALUES ${
          Array.from({ length: rows }, (_, i) => `($${i * 7 + 1},$${i * 7 + 2},$${i * 7 + 3},$${i * 7 + 4},$${i * 7 + 5},$${i * 7 + 6},$${i * 7 + 7})`).join(',')
        } ON CONFLICT (role_id, competency_id) DO UPDATE SET importance_tier=EXCLUDED.importance_tier,
            weight=EXCLUDED.weight, min_proficiency=EXCLUDED.min_proficiency,
            target_proficiency=EXCLUDED.target_proficiency, source=EXCLUDED.source, updated_at=NOW()`,
        flat, 7,
      );
      counts.map_role_competency = n;
      counts.links_skipped_below_threshold = skipped;
    }

    return { counts, ok: true };
  } catch (err: any) {
    console.error('[onet-import] error:', err);
    return { counts, ok: false, error: err?.message ?? 'Unknown error' };
  }
}
