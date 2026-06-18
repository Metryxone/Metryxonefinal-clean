/**
 * import-export.ts
 * Import / Export endpoints for LBI, SDI, and Competency frameworks.
 * Export → CSV download (or JSON for full dump)
 * Import → JSON body { type, rows[] }, upserts by natural code key
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';

type Auth = (req: Request, res: Response, next: NextFunction) => void;

// ─── CSV helpers ────────────────────────────────────────────────────────────

function escapeCell(v: any): string {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join('|') : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n'))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: any[]): string {
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escapeCell(r[h])).join(',')),
  ];
  return lines.join('\n');
}

function sendCsv(res: Response, filename: string, headers: string[], rows: any[]) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + toCsv(headers, rows));
}

function sendJson(res: Response, filename: string, data: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(data, null, 2));
}

// ─── Register all routes ─────────────────────────────────────────────────────

export function registerImportExportRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Auth,
  requireSuperAdmin: Auth,
) {

  // ══════════════════════════════════════════════════════════════════════════
  // LBI
  // ══════════════════════════════════════════════════════════════════════════

  app.get('/api/lbi/admin/export', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const type = String(req.query.type || 'full');
    try {
      if (type === 'domains') {
        const { rows } = await pool.query(
          `SELECT domain_code, domain_name, description, color, weightage, display_order, status
           FROM lbi_domains ORDER BY display_order, domain_code`
        );
        return sendCsv(res, 'lbi-domains.csv',
          ['domain_code','domain_name','description','color','weightage','display_order','status'], rows);
      }

      if (type === 'subdomains') {
        const { rows } = await pool.query(
          `SELECT d.domain_code, s.subdomain_code, s.subdomain_name, s.description,
                  s.weightage, s.display_order, s.status
           FROM lbi_subdomains s
           JOIN lbi_domains d ON d.id = s.domain_id
           ORDER BY d.display_order, s.display_order`
        );
        return sendCsv(res, 'lbi-subdomains.csv',
          ['domain_code','subdomain_code','subdomain_name','description','weightage','display_order','status'], rows);
      }

      if (type === 'clusters') {
        const { rows } = await pool.query(
          `SELECT cl.code, cl.name, cl.description, cl.is_active,
                  array_agg(m.subdomain_code ORDER BY m.subdomain_code) FILTER (WHERE m.subdomain_code IS NOT NULL) AS subdomain_codes
           FROM lbi_clusters cl
           LEFT JOIN lbi_cluster_map m ON m.cluster_id = cl.id
           GROUP BY cl.id ORDER BY cl.code`
        );
        const flat = rows.map(r => ({ ...r, subdomain_codes: (r.subdomain_codes || []).join('|') }));
        return sendCsv(res, 'lbi-clusters.csv',
          ['code','name','description','is_active','subdomain_codes'], flat);
      }

      if (type === 'all') {
        const { rows } = await pool.query(
          `SELECT d.domain_code, d.domain_name, d.description AS domain_description,
                  d.color AS domain_color, d.weightage AS domain_weightage,
                  s.subdomain_code, s.subdomain_name, s.description AS subdomain_description,
                  s.weightage AS subdomain_weightage, s.display_order, s.status
           FROM lbi_domains d
           LEFT JOIN lbi_subdomains s ON s.domain_id = d.id
           ORDER BY d.display_order, s.display_order`
        );
        return sendCsv(res, 'lbi-all.csv',
          ['domain_code','domain_name','domain_description','domain_color','domain_weightage',
           'subdomain_code','subdomain_name','subdomain_description','subdomain_weightage','display_order','status'], rows);
      }

      if (type === 'questions') {
        const { rows } = await pool.query(
          `SELECT
             d.domain_code AS "domainCode", d.domain_name AS "domainName",
             s.subdomain_code AS "subdomainCode", s.subdomain_name AS "subdomainName",
             q.question_code AS "questionCode",
             b.band_code AS "ageBandCode",
             q.question_type AS "questionType",
             q.question_text AS "questionText",
             COALESCE(q.passage_text, '') AS "passageText",
             CASE WHEN q.reverse_scored THEN 'Negative' ELSE 'Positive' END AS "keying",
             q.response_options AS "_opts",
             COALESCE(q.correct_answer, '') AS "correctAnswer",
             COALESCE(q.explanation, '') AS "explanation",
             CASE WHEN q.is_anchor THEN 'Yes' ELSE 'No' END AS "anchor",
             q.difficulty, q.set_number AS "setNumber",
             q.display_order AS "displayOrder", q.version,
             q.language, q.status
           FROM lbi_questions q
           JOIN lbi_domains d ON d.id = q.domain_id
           JOIN lbi_subdomains s ON s.id = q.subdomain_id
           JOIN lbi_age_bands b ON b.id = q.age_band_id
           ORDER BY d.display_order, s.display_order, b.band_code, q.display_order`
        );
        const OPTION_LABELS = ['optionA','optionB','optionC','optionD'];
        const flat = rows.map((r: any) => {
          let opts: { label?: string; score?: number | string }[] = [];
          try { opts = JSON.parse(r._opts || '[]'); } catch {}
          const row: Record<string, any> = {
            domainCode: r.domainCode, domainName: r.domainName,
            subdomainCode: r.subdomainCode, subdomainName: r.subdomainName,
            questionCode: r.questionCode, ageBandCode: r.ageBandCode,
            questionType: r.questionType, questionText: r.questionText,
            passageText: r.passageText, keying: r.keying,
          };
          for (let i = 0; i < 4; i++) {
            row[OPTION_LABELS[i]] = opts[i]?.label ?? '';
            row[`${OPTION_LABELS[i]}Score`] = opts[i]?.score ?? '';
          }
          row.correctAnswer = r.correctAnswer;
          row.explanation = r.explanation;
          row.anchor = r.anchor;
          row.difficulty = r.difficulty;
          row.setNumber = r.setNumber;
          row.displayOrder = r.displayOrder;
          row.version = r.version;
          row.language = r.language;
          row.status = r.status;
          return row;
        });
        return sendCsv(res, 'lbi-questions.csv', [
          'domainCode','domainName','subdomainCode','subdomainName',
          'questionCode','ageBandCode','questionType','questionText','passageText',
          'keying','optionA','optionAScore','optionB','optionBScore',
          'optionC','optionCScore','optionD','optionDScore',
          'correctAnswer','explanation','anchor',
          'difficulty','setNumber','displayOrder','version','language','status',
        ], flat);
      }

      if (type === 'norms') {
        const { rows } = await pool.query(
          `SELECT n.age_band_code AS "ageBandCode",
                  n.subdomain_code AS "subdomainCode",
                  s.subdomain_name AS "subdomainName",
                  d.domain_code AS "domainCode", d.domain_name AS "domainName",
                  n.min_score AS "minScore",
                  n.median_score AS "medianScore",
                  n.top10_score AS "top10Score"
           FROM lbi_subdomain_norms n
           JOIN lbi_subdomains s ON s.subdomain_code = n.subdomain_code
           JOIN lbi_domains d ON d.id = s.domain_id
           ORDER BY d.display_order, s.display_order, n.age_band_code`
        );
        return sendCsv(res, 'lbi-norms.csv',
          ['domainCode','domainName','subdomainCode','subdomainName','ageBandCode',
           'minScore','medianScore','top10Score'], rows);
      }

      if (type === 'weights') {
        const { rows } = await pool.query(
          `SELECT w.age_band_code AS "ageBandCode",
                  w.subdomain_code AS "subdomainCode",
                  s.subdomain_name AS "subdomainName",
                  d.domain_code AS "domainCode", d.domain_name AS "domainName",
                  w.weight AS "weight", w.weight_type AS "weightType"
           FROM lbi_age_band_weights w
           JOIN lbi_subdomains s ON s.subdomain_code = w.subdomain_code
           JOIN lbi_domains d ON d.id = s.domain_id
           ORDER BY d.display_order, s.display_order, w.age_band_code`
        );
        return sendCsv(res, 'lbi-weights.csv',
          ['domainCode','domainName','subdomainCode','subdomainName','ageBandCode',
           'weight','weightType'], rows);
      }

      // full JSON
      const [domains, subdomains, clusters, clusterMap] = await Promise.all([
        pool.query(`SELECT domain_code,domain_name,description,color,weightage,display_order,status FROM lbi_domains ORDER BY display_order`),
        pool.query(`SELECT d.domain_code,s.subdomain_code,s.subdomain_name,s.description,s.weightage,s.display_order,s.status FROM lbi_subdomains s JOIN lbi_domains d ON d.id=s.domain_id ORDER BY d.display_order,s.display_order`),
        pool.query(`SELECT code,name,description,is_active FROM lbi_clusters ORDER BY code`),
        pool.query(`SELECT cl.code AS cluster_code, m.subdomain_code FROM lbi_cluster_map m JOIN lbi_clusters cl ON cl.id=m.cluster_id ORDER BY cl.code`),
      ]);
      const clusterMapGrouped: Record<string, string[]> = {};
      clusterMap.rows.forEach((r: any) => {
        (clusterMapGrouped[r.cluster_code] ||= []).push(r.subdomain_code);
      });
      return sendJson(res, 'lbi-full.json', {
        framework: 'LBI',
        exported_at: new Date().toISOString(),
        domains: domains.rows,
        subdomains: subdomains.rows,
        clusters: clusters.rows.map((c: any) => ({ ...c, subdomain_codes: clusterMapGrouped[c.code] || [] })),
      });
    } catch (err) { next(err); }
  });

  app.post('/api/lbi/admin/import', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const { type, rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ error: 'rows array required' });
    try {
      let inserted = 0, updated = 0, errors: string[] = [];

      if (type === 'domains') {
        for (const r of rows) {
          try {
            const result = await pool.query(
              `INSERT INTO lbi_domains (domain_code, domain_name, description, color, weightage, display_order, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT (domain_code) DO UPDATE SET
                 domain_name=EXCLUDED.domain_name, description=EXCLUDED.description,
                 color=EXCLUDED.color, weightage=EXCLUDED.weightage,
                 display_order=EXCLUDED.display_order, status=EXCLUDED.status
               RETURNING (xmax=0) AS is_insert`,
              [r.domain_code, r.domain_name, r.description||null, r.color||null,
               r.weightage||null, r.display_order||null, r.status||'Active']
            );
            result.rows[0]?.is_insert ? inserted++ : updated++;
          } catch (e: any) { errors.push(`${r.domain_code}: ${e.message}`); }
        }
      }

      else if (type === 'subdomains') {
        for (const r of rows) {
          try {
            const dom = await pool.query(`SELECT id FROM lbi_domains WHERE domain_code=$1`, [r.domain_code]);
            if (!dom.rows[0]) { errors.push(`${r.subdomain_code}: domain_code "${r.domain_code}" not found`); continue; }
            const result = await pool.query(
              `INSERT INTO lbi_subdomains (domain_id, subdomain_code, subdomain_name, description, weightage, display_order, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT (subdomain_code) DO UPDATE SET
                 domain_id=EXCLUDED.domain_id, subdomain_name=EXCLUDED.subdomain_name,
                 description=EXCLUDED.description, weightage=EXCLUDED.weightage,
                 display_order=EXCLUDED.display_order, status=EXCLUDED.status
               RETURNING (xmax=0) AS is_insert`,
              [dom.rows[0].id, r.subdomain_code, r.subdomain_name, r.description||null,
               r.weightage||null, r.display_order||null, r.status||'Active']
            );
            result.rows[0]?.is_insert ? inserted++ : updated++;
          } catch (e: any) { errors.push(`${r.subdomain_code}: ${e.message}`); }
        }
      }

      else if (type === 'clusters') {
        for (const r of rows) {
          try {
            const result = await pool.query(
              `INSERT INTO lbi_clusters (code, name, description, is_active)
               VALUES ($1,$2,$3,$4)
               ON CONFLICT (code) DO UPDATE SET
                 name=EXCLUDED.name, description=EXCLUDED.description, is_active=EXCLUDED.is_active
               RETURNING id, (xmax=0) AS is_insert`,
              [r.code, r.name, r.description||null, r.is_active !== 'false' && r.is_active !== false]
            );
            const { id, is_insert } = result.rows[0];
            is_insert ? inserted++ : updated++;
            if (r.subdomain_codes) {
              const codes = String(r.subdomain_codes).split('|').map((s: string) => s.trim()).filter(Boolean);
              await pool.query(`DELETE FROM lbi_cluster_map WHERE cluster_id=$1`, [id]);
              for (const code of codes)
                await pool.query(`INSERT INTO lbi_cluster_map (cluster_id,subdomain_code) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, code]);
            }
          } catch (e: any) { errors.push(`${r.code}: ${e.message}`); }
        }
      }

      else if (type === 'all') {
        const domainSeen = new Set<string>();
        for (const r of rows) {
          if (r.domain_code && !domainSeen.has(r.domain_code)) {
            domainSeen.add(r.domain_code);
            try {
              await pool.query(
                `INSERT INTO lbi_domains (domain_code, domain_name, description, color, weightage, status)
                 VALUES ($1,$2,$3,$4,$5,$6)
                 ON CONFLICT (domain_code) DO UPDATE SET
                   domain_name=EXCLUDED.domain_name, description=EXCLUDED.description,
                   color=EXCLUDED.color, weightage=EXCLUDED.weightage, status=EXCLUDED.status`,
                [r.domain_code, r.domain_name||r.domain_code, r.domain_description||null,
                 r.domain_color||null, r.domain_weightage||null, 'Active']
              );
            } catch (e: any) { errors.push(`domain ${r.domain_code}: ${e.message}`); }
          }
          if (r.subdomain_code) {
            try {
              const dom = await pool.query(`SELECT id FROM lbi_domains WHERE domain_code=$1`, [r.domain_code]);
              if (!dom.rows[0]) { errors.push(`${r.subdomain_code}: domain "${r.domain_code}" not found`); continue; }
              const result = await pool.query(
                `INSERT INTO lbi_subdomains (domain_id, subdomain_code, subdomain_name, description, weightage, display_order, status)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (subdomain_code) DO UPDATE SET
                   domain_id=EXCLUDED.domain_id, subdomain_name=EXCLUDED.subdomain_name,
                   description=EXCLUDED.description, weightage=EXCLUDED.weightage,
                   display_order=EXCLUDED.display_order, status=EXCLUDED.status
                 RETURNING (xmax=0) AS is_insert`,
                [dom.rows[0].id, r.subdomain_code, r.subdomain_name, r.subdomain_description||null,
                 r.subdomain_weightage||null, r.display_order||null, r.status||'Active']
              );
              result.rows[0]?.is_insert ? inserted++ : updated++;
            } catch (e: any) { errors.push(`${r.subdomain_code}: ${e.message}`); }
          }
        }
      }

      else if (type === 'questions') {
        // ── Age-band shorthand: A→AB01 … F→AB06 ────────────────────────────
        const BAND_SHORT: Record<string, string> = {
          A: 'AB01', B: 'AB02', C: 'AB03', D: 'AB04', E: 'AB05', F: 'AB06',
        };

        // ── Domain abbreviation map (user-facing code → DB domain_code) ────
        // Supports both the DB numeric codes (D01–D19) AND the human abbreviations
        // (ACE, TQP, OCR, …) that practitioners use in their item files.
        const DOMAIN_ABBREV: Record<string, string> = {
          ACE:'D01', TQP:'D02', ESER:'D03', CSCC:'D04', ACC:'D05',
          SEI:'D06', DHC:'D07', CE:'D08',  MVR:'D09', LPE:'D10',
          CER:'D11', IRCM:'D12',APRI:'D13',MSR:'D14', HSSU:'D15',
          AIM:'D16', TCA:'D17', TSIS:'D18',OCR:'D19',
        };

        // ── Helper: resolve domain ID ────────────────────────────────────────
        // Priority: exact code → abbreviation mapping → case-insensitive name match
        const resolveDomain = async (raw: string): Promise<string | null> => {
          if (!raw) return null;
          const up = raw.trim().toUpperCase();
          const candidates = [up, DOMAIN_ABBREV[up] || up];
          for (const code of [...new Set(candidates)]) {
            const { rows: dr } = await pool.query(
              `SELECT id FROM lbi_domains WHERE domain_code=$1`, [code]
            );
            if (dr[0]) return dr[0].id;
          }
          // Fall back to name match
          const { rows: nr } = await pool.query(
            `SELECT id FROM lbi_domains WHERE LOWER(domain_name)=LOWER($1)`, [raw.trim()]
          );
          return nr[0]?.id || null;
        };

        // ── Helper: resolve (or create) subdomain ID ─────────────────────────
        // Priority: exact code → name match within domain → auto-create
        const resolveOrCreateSubdomain = async (
          rawCode: string, rawName: string, domainId: string, domainCode: string
        ): Promise<string> => {
          const code = rawCode?.trim();
          // 1. Exact code match
          if (code) {
            const { rows } = await pool.query(
              `SELECT id FROM lbi_subdomains WHERE subdomain_code=$1`, [code]
            );
            if (rows[0]) return rows[0].id;
            // 2. Same domain + name match
            const { rows: nr } = await pool.query(
              `SELECT id FROM lbi_subdomains WHERE domain_id=$1 AND LOWER(subdomain_name)=LOWER($2)`,
              [domainId, rawName?.trim() || code]
            );
            if (nr[0]) return nr[0].id;
          } else if (rawName?.trim()) {
            const { rows: nr } = await pool.query(
              `SELECT id FROM lbi_subdomains WHERE domain_id=$1 AND LOWER(subdomain_name)=LOWER($2)`,
              [domainId, rawName.trim()]
            );
            if (nr[0]) return nr[0].id;
          }
          // 3. Auto-create: derive a DB subdomain_code if the user supplied one,
          //    otherwise synthesise one from the domain code + subdomain name.
          const { rows: domCodeR } = await pool.query(
            `SELECT domain_code FROM lbi_domains WHERE id=$1`, [domainId]
          );
          const dbDomCode = domCodeR[0]?.domain_code || 'UNK';
          // Count existing subdomains to assign a sequential number
          const { rows: cnt } = await pool.query(
            `SELECT COUNT(*) AS n FROM lbi_subdomains WHERE domain_id=$1`, [domainId]
          );
          const nextN = (parseInt(cnt[0]?.n) || 0) + 1;
          const finalCode = code || `${dbDomCode}_SD${String(nextN).padStart(2,'0')}`;
          const finalName = rawName?.trim() || code || finalCode;
          const { rows: cr } = await pool.query(
            `INSERT INTO lbi_subdomains (domain_id, subdomain_code, subdomain_name, display_order, status)
             VALUES ($1,$2,$3,$4,'Active')
             ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name
             RETURNING id`,
            [domainId, finalCode, finalName, nextN]
          );
          return cr[0].id;
        };

        for (const r of rows) {
          try {
            const qCode = r.questionCode?.trim();
            if (!qCode)              { errors.push('row missing questionCode'); continue; }
            if (!r.questionText?.trim()) { errors.push(`${qCode}: questionText required`); continue; }

            // ── Resolve domain ──────────────────────────────────────────────
            const domainId = await resolveDomain(r.domainCode?.trim() || '');
            if (!domainId) {
              errors.push(`${qCode}: domain "${r.domainCode}" not found. Use D01-D19, abbreviations (ACE, OCR…), or the full domain name.`);
              continue;
            }

            // ── Resolve/create subdomain ────────────────────────────────────
            const subdomainId = await resolveOrCreateSubdomain(
              r.subdomainCode?.trim() || '',
              r.subdomainName?.trim() || '',
              domainId,
              r.domainCode?.trim() || ''
            );

            // ── Resolve age band ────────────────────────────────────────────
            const rawBand = r.ageBandCode?.trim() || '';
            const resolvedBand = BAND_SHORT[rawBand.toUpperCase()] || rawBand.toUpperCase();
            const bandR = await pool.query(
              `SELECT id FROM lbi_age_bands WHERE band_code=$1`, [resolvedBand]
            );
            if (!bandR.rows[0]) {
              errors.push(`${qCode}: age band "${r.ageBandCode}" not found — use A-F (A=Early Childhood 6-9 … F=Adult 22+) or AB01-AB06`);
              continue;
            }

            // ── Build response_options JSON ─────────────────────────────────
            const opts: { label: string; score: number }[] = [];
            for (const [lc, sc] of [
              ['optionA','optionAScore'],['optionB','optionBScore'],
              ['optionC','optionCScore'],['optionD','optionDScore'],
            ]) {
              if (r[lc]?.trim()) opts.push({ label: r[lc].trim(), score: parseFloat(r[sc]) || 0 });
            }
            const responseOptions = opts.length > 0 ? JSON.stringify(opts) : null;

            // ── Scoring map {label → score} ─────────────────────────────────
            const scoringMap: Record<string, number> = {};
            for (const o of opts) scoringMap[o.label] = o.score;
            const scoring = opts.length > 0 ? JSON.stringify(scoringMap) : null;

            const reverseScored = r.keying?.toLowerCase() === 'negative';
            const isAnchor      = r.anchor?.toLowerCase()  === 'yes';

            const result = await pool.query(
              `INSERT INTO lbi_questions (
                 question_code, domain_id, subdomain_id, age_band_id,
                 question_type, question_text, passage_text,
                 response_options, scoring, reverse_scored,
                 correct_answer, explanation, is_anchor,
                 difficulty, set_number, display_order, version, language, status
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
               ON CONFLICT (question_code) DO UPDATE SET
                 domain_id=EXCLUDED.domain_id, subdomain_id=EXCLUDED.subdomain_id,
                 age_band_id=EXCLUDED.age_band_id, question_type=EXCLUDED.question_type,
                 question_text=EXCLUDED.question_text, passage_text=EXCLUDED.passage_text,
                 response_options=EXCLUDED.response_options, scoring=EXCLUDED.scoring,
                 reverse_scored=EXCLUDED.reverse_scored, correct_answer=EXCLUDED.correct_answer,
                 explanation=EXCLUDED.explanation, is_anchor=EXCLUDED.is_anchor,
                 difficulty=EXCLUDED.difficulty, set_number=EXCLUDED.set_number,
                 display_order=EXCLUDED.display_order, version=EXCLUDED.version,
                 language=EXCLUDED.language, status=EXCLUDED.status,
                 updated_at=NOW()
               RETURNING (xmax=0) AS is_insert`,
              [
                qCode, domainId, subdomainId, bandR.rows[0].id,
                r.questionType?.trim() || 'likert',
                r.questionText.trim(),
                r.passageText?.trim() || null,
                responseOptions, scoring, reverseScored,
                r.correctAnswer?.trim() || null,
                r.explanation?.trim() || null,
                isAnchor,
                r.difficulty?.trim() || 'MEDIUM',
                parseInt(r.setNumber) || 1,
                parseInt(r.displayOrder) || 0,
                parseInt(r.version) || 1,
                r.language?.trim() || 'EN',
                r.status?.trim() || 'Active',
              ]
            );
            result.rows[0]?.is_insert ? inserted++ : updated++;
          } catch (e: any) { errors.push(`${r.questionCode || '?'}: ${e.message}`); }
        }
      }

      else if (type === 'norms') {
        // Short-code support: A→AB01 … F→AB06
        const BAND_S: Record<string,string> = { A:'AB01',B:'AB02',C:'AB03',D:'AB04',E:'AB05',F:'AB06' };
        for (const r of rows) {
          try {
            if (!r.subdomainCode?.trim()) { errors.push('row missing subdomainCode'); continue; }
            const ageBandCode = BAND_S[r.ageBandCode?.trim()?.toUpperCase()] || r.ageBandCode?.trim();
            if (!ageBandCode)            { errors.push(`${r.subdomainCode}: ageBandCode required`); continue; }
            // Validate subdomain exists
            const { rows: subR } = await pool.query(
              `SELECT 1 FROM lbi_subdomains WHERE subdomain_code=$1`, [r.subdomainCode.trim()]
            );
            if (!subR[0]) { errors.push(`${r.subdomainCode}: subdomain not found`); continue; }
            const result = await pool.query(
              `INSERT INTO lbi_subdomain_norms (age_band_code, subdomain_code, min_score, median_score, top10_score)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (age_band_code, subdomain_code) DO UPDATE SET
                 min_score=EXCLUDED.min_score, median_score=EXCLUDED.median_score,
                 top10_score=EXCLUDED.top10_score, updated_at=NOW()
               RETURNING (xmax=0) AS is_insert`,
              [ageBandCode, r.subdomainCode.trim(),
               parseFloat(r.minScore) || 0,
               parseFloat(r.medianScore) || 50,
               parseFloat(r.top10Score) || 100]
            );
            result.rows[0]?.is_insert ? inserted++ : updated++;
          } catch (e: any) { errors.push(`${r.subdomainCode || '?'}: ${e.message}`); }
        }
      }

      else if (type === 'weights') {
        const BAND_S: Record<string,string> = { A:'AB01',B:'AB02',C:'AB03',D:'AB04',E:'AB05',F:'AB06' };
        const VALID_TYPES = new Set(['core','differentiator','supporting']);
        for (const r of rows) {
          try {
            if (!r.subdomainCode?.trim()) { errors.push('row missing subdomainCode'); continue; }
            const ageBandCode = BAND_S[r.ageBandCode?.trim()?.toUpperCase()] || r.ageBandCode?.trim();
            if (!ageBandCode)            { errors.push(`${r.subdomainCode}: ageBandCode required`); continue; }
            const { rows: subR } = await pool.query(
              `SELECT 1 FROM lbi_subdomains WHERE subdomain_code=$1`, [r.subdomainCode.trim()]
            );
            if (!subR[0]) { errors.push(`${r.subdomainCode}: subdomain not found`); continue; }
            const weightType = r.weightType?.trim()?.toLowerCase() || 'core';
            const result = await pool.query(
              `INSERT INTO lbi_age_band_weights (age_band_code, subdomain_code, weight, weight_type)
               VALUES ($1,$2,$3,$4)
               ON CONFLICT (age_band_code, subdomain_code) DO UPDATE SET
                 weight=EXCLUDED.weight, weight_type=EXCLUDED.weight_type
               RETURNING (xmax=0) AS is_insert`,
              [ageBandCode, r.subdomainCode.trim(),
               parseFloat(r.weight) || 1.0,
               VALID_TYPES.has(weightType) ? weightType : 'core']
            );
            result.rows[0]?.is_insert ? inserted++ : updated++;
          } catch (e: any) { errors.push(`${r.subdomainCode || '?'}: ${e.message}`); }
        }
      }

      else return res.status(400).json({ error: `Unknown type: ${type}` });

      res.json({ ok: true, inserted, updated, errors });
    } catch (err) { next(err); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SDI
  // ══════════════════════════════════════════════════════════════════════════

  app.get('/api/sdi/admin/export', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const type = String(req.query.type || 'full');
    try {
      if (type === 'domains') {
        const { rows } = await pool.query(
          `SELECT domain_code, domain_name, description, category, weightage, display_order, status, is_active
           FROM sdi_domains ORDER BY display_order, domain_code`
        );
        return sendCsv(res, 'sdi-domains.csv',
          ['domain_code','domain_name','description','category','weightage','display_order','status','is_active'], rows);
      }

      if (type === 'subdomains') {
        const { rows } = await pool.query(
          `SELECT domain_code, subdomain_code, subdomain_name, description, display_order, is_active
           FROM sdi_subdomains ORDER BY domain_code, display_order`
        );
        return sendCsv(res, 'sdi-subdomains.csv',
          ['domain_code','subdomain_code','subdomain_name','description','display_order','is_active'], rows);
      }

      if (type === 'items') {
        const { rows } = await pool.query(
          `SELECT subdomain_code, item_code, item_type, difficulty, question,
                  concern_name, stage_code, age_band, polarity, weight,
                  anchor, focus_area, layer_tag, expected_time, language_code, is_active
           FROM sdi_items ORDER BY subdomain_code, item_code`
        );
        return sendCsv(res, 'sdi-items.csv',
          ['subdomain_code','item_code','item_type','difficulty','question',
           'concern_name','stage_code','age_band','polarity','weight',
           'anchor','focus_area','layer_tag','expected_time','language_code','is_active'], rows);
      }

      if (type === 'clusters') {
        const { rows } = await pool.query(
          `SELECT cl.code, cl.name, cl.description, cl.is_active,
                  array_agg(m.subdomain_code ORDER BY m.subdomain_code) FILTER (WHERE m.subdomain_code IS NOT NULL) AS subdomain_codes
           FROM sdi_clusters cl
           LEFT JOIN sdi_cluster_map m ON m.cluster_id = cl.id
           GROUP BY cl.id ORDER BY cl.code`
        );
        const flat = rows.map(r => ({ ...r, subdomain_codes: (r.subdomain_codes || []).join('|') }));
        return sendCsv(res, 'sdi-clusters.csv',
          ['code','name','description','is_active','subdomain_codes'], flat);
      }

      if (type === 'all') {
        const { rows } = await pool.query(
          `SELECT d.domain_code, d.domain_name, d.description AS domain_description,
                  d.category, d.weightage AS domain_weightage,
                  s.subdomain_code, s.subdomain_name, s.description AS subdomain_description,
                  s.display_order, s.is_active
           FROM sdi_domains d
           LEFT JOIN sdi_subdomains s ON s.domain_code = d.domain_code
           ORDER BY d.display_order, s.display_order`
        );
        return sendCsv(res, 'sdi-all.csv',
          ['domain_code','domain_name','domain_description','category','domain_weightage',
           'subdomain_code','subdomain_name','subdomain_description','display_order','is_active'], rows);
      }

      // full JSON
      const [domains, subdomains, items, clusters, clusterMap] = await Promise.all([
        pool.query(`SELECT domain_code,domain_name,description,category,weightage,display_order,status,is_active FROM sdi_domains ORDER BY display_order`),
        pool.query(`SELECT domain_code,subdomain_code,subdomain_name,description,display_order,is_active FROM sdi_subdomains ORDER BY domain_code,display_order`),
        pool.query(`SELECT subdomain_code,item_code,item_type,difficulty,question,expected_time,language_code,is_active FROM sdi_items ORDER BY subdomain_code`),
        pool.query(`SELECT code,name,description,is_active FROM sdi_clusters ORDER BY code`),
        pool.query(`SELECT cl.code AS cluster_code,m.subdomain_code FROM sdi_cluster_map m JOIN sdi_clusters cl ON cl.id=m.cluster_id ORDER BY cl.code`),
      ]);
      const clusterMapGrouped: Record<string, string[]> = {};
      clusterMap.rows.forEach((r: any) => { (clusterMapGrouped[r.cluster_code] ||= []).push(r.subdomain_code); });
      return sendJson(res, 'sdi-full.json', {
        framework: 'SDI',
        exported_at: new Date().toISOString(),
        domains: domains.rows,
        subdomains: subdomains.rows,
        items: items.rows,
        clusters: clusters.rows.map((c: any) => ({ ...c, subdomain_codes: clusterMapGrouped[c.code] || [] })),
      });
    } catch (err) { next(err); }
  });

  app.post('/api/sdi/admin/import', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const { type, rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ error: 'rows array required' });
    try {
      let inserted = 0, updated = 0, errors: string[] = [];

      if (type === 'domains') {
        for (const r of rows) {
          try {
            const result = await pool.query(
              `INSERT INTO sdi_domains (domain_code, domain_name, description, category, weightage, display_order, status, is_active)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
               ON CONFLICT (domain_code) DO UPDATE SET
                 domain_name=EXCLUDED.domain_name, description=EXCLUDED.description,
                 category=EXCLUDED.category, weightage=EXCLUDED.weightage,
                 display_order=EXCLUDED.display_order, status=EXCLUDED.status, is_active=EXCLUDED.is_active
               RETURNING (xmax=0) AS is_insert`,
              [r.domain_code, r.domain_name, r.description||null, r.category||null,
               r.weightage||null, r.display_order||null, r.status||'Active', r.is_active !== 'false' && r.is_active !== false]
            );
            result.rows[0]?.is_insert ? inserted++ : updated++;
          } catch (e: any) { errors.push(`${r.domain_code}: ${e.message}`); }
        }
      }

      else if (type === 'subdomains') {
        for (const r of rows) {
          try {
            const result = await pool.query(
              `INSERT INTO sdi_subdomains (domain_code, subdomain_code, subdomain_name, description, display_order, is_active)
               VALUES ($1,$2,$3,$4,$5,$6)
               ON CONFLICT (subdomain_code) DO UPDATE SET
                 domain_code=EXCLUDED.domain_code, subdomain_name=EXCLUDED.subdomain_name,
                 description=EXCLUDED.description, display_order=EXCLUDED.display_order, is_active=EXCLUDED.is_active
               RETURNING (xmax=0) AS is_insert`,
              [r.domain_code, r.subdomain_code, r.subdomain_name, r.description||null,
               r.display_order||null, r.is_active !== 'false' && r.is_active !== false]
            );
            result.rows[0]?.is_insert ? inserted++ : updated++;
          } catch (e: any) { errors.push(`${r.subdomain_code}: ${e.message}`); }
        }
      }

      else if (type === 'items') {
        for (const r of rows) {
          if (!r.item_code || !r.question) { errors.push(`Row missing item_code or question`); continue; }
          try {
            const result = await pool.query(
              `INSERT INTO sdi_items
                 (subdomain_code, item_code, item_type, difficulty, question,
                  concern_name, stage_code, age_band, polarity, weight,
                  anchor, focus_area, layer_tag, expected_time, language_code, is_active)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
               ON CONFLICT (item_code) DO UPDATE SET
                 subdomain_code=EXCLUDED.subdomain_code, item_type=EXCLUDED.item_type,
                 difficulty=EXCLUDED.difficulty, question=EXCLUDED.question,
                 concern_name=EXCLUDED.concern_name, stage_code=EXCLUDED.stage_code,
                 age_band=EXCLUDED.age_band, polarity=EXCLUDED.polarity, weight=EXCLUDED.weight,
                 anchor=EXCLUDED.anchor, focus_area=EXCLUDED.focus_area, layer_tag=EXCLUDED.layer_tag,
                 expected_time=EXCLUDED.expected_time, language_code=EXCLUDED.language_code,
                 is_active=EXCLUDED.is_active, updated_at=now()
               RETURNING (xmax=0) AS is_insert`,
              [
                r.subdomain_code || null,
                r.item_code,
                r.item_type || 'standard',
                r.difficulty ? parseInt(r.difficulty) : 3,
                r.question,
                r.concern_name || null,
                r.stage_code   || null,
                r.age_band     || null,
                r.polarity     || null,
                r.weight       ? parseFloat(r.weight) : null,
                r.anchor === 'true' || r.anchor === true,
                r.focus_area   || null,
                r.layer_tag    || null,
                r.expected_time ? parseInt(r.expected_time) : 30,
                r.language_code || 'en',
                r.is_active !== 'false' && r.is_active !== false,
              ]
            );
            result.rows[0]?.is_insert ? inserted++ : updated++;
          } catch (e: any) { errors.push(`${r.item_code}: ${e.message}`); }
        }
      }

      else if (type === 'clusters') {
        for (const r of rows) {
          try {
            const result = await pool.query(
              `INSERT INTO sdi_clusters (code, name, description, is_active)
               VALUES ($1,$2,$3,$4)
               ON CONFLICT (code) DO UPDATE SET
                 name=EXCLUDED.name, description=EXCLUDED.description, is_active=EXCLUDED.is_active
               RETURNING id, (xmax=0) AS is_insert`,
              [r.code, r.name, r.description||null, r.is_active !== 'false' && r.is_active !== false]
            );
            const { id, is_insert } = result.rows[0];
            is_insert ? inserted++ : updated++;
            if (r.subdomain_codes) {
              const codes = String(r.subdomain_codes).split('|').map((s: string) => s.trim()).filter(Boolean);
              await pool.query(`DELETE FROM sdi_cluster_map WHERE cluster_id=$1`, [id]);
              for (const code of codes)
                await pool.query(`INSERT INTO sdi_cluster_map (cluster_id,subdomain_code) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, code]);
            }
          } catch (e: any) { errors.push(`${r.code}: ${e.message}`); }
        }
      }

      else if (type === 'all') {
        const domainSeen = new Set<string>();
        for (const r of rows) {
          if (r.domain_code && !domainSeen.has(r.domain_code)) {
            domainSeen.add(r.domain_code);
            try {
              await pool.query(
                `INSERT INTO sdi_domains (domain_code, domain_name, description, category, weightage, status, is_active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (domain_code) DO UPDATE SET
                   domain_name=EXCLUDED.domain_name, description=EXCLUDED.description,
                   category=EXCLUDED.category, weightage=EXCLUDED.weightage, status=EXCLUDED.status, is_active=EXCLUDED.is_active`,
                [r.domain_code, r.domain_name||r.domain_code, r.domain_description||null,
                 r.category||null, r.domain_weightage||null, 'Active', true]
              );
            } catch (e: any) { errors.push(`domain ${r.domain_code}: ${e.message}`); }
          }
          if (r.subdomain_code) {
            try {
              const result = await pool.query(
                `INSERT INTO sdi_subdomains (domain_code, subdomain_code, subdomain_name, description, display_order, is_active)
                 VALUES ($1,$2,$3,$4,$5,$6)
                 ON CONFLICT (subdomain_code) DO UPDATE SET
                   domain_code=EXCLUDED.domain_code, subdomain_name=EXCLUDED.subdomain_name,
                   description=EXCLUDED.description, display_order=EXCLUDED.display_order, is_active=EXCLUDED.is_active
                 RETURNING (xmax=0) AS is_insert`,
                [r.domain_code, r.subdomain_code, r.subdomain_name, r.subdomain_description||null,
                 r.display_order||null, r.is_active !== 'false' && r.is_active !== false]
              );
              result.rows[0]?.is_insert ? inserted++ : updated++;
            } catch (e: any) { errors.push(`${r.subdomain_code}: ${e.message}`); }
          }
        }
      }

      else return res.status(400).json({ error: `Unknown type: ${type}` });

      res.json({ ok: true, inserted, updated, errors });
    } catch (err) { next(err); }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // COMPETENCY  (uses pool, not drizzle, for consistency)
  // ══════════════════════════════════════════════════════════════════════════

  app.get('/api/competency/admin/export', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const type = String(req.query.type || 'full');
    try {
      if (type === 'domains') {
        const { rows } = await pool.query(
          `SELECT code, name, description, color, weight, display_order, is_active
           FROM competency_domains ORDER BY display_order, code`
        );
        return sendCsv(res, 'competency-domains.csv',
          ['code','name','description','color','weight','display_order','is_active'], rows);
      }

      if (type === 'competencies') {
        const { rows } = await pool.query(
          `SELECT d.code AS domain_code, c.code, c.name, c.description,
                  c.competency_type, c.display_order, c.is_active
           FROM competencies c
           JOIN competency_domains d ON d.id = c.domain_id
           ORDER BY d.display_order, c.display_order`
        );
        return sendCsv(res, 'competency-competencies.csv',
          ['domain_code','code','name','description','competency_type','display_order','is_active'], rows);
      }

      if (type === 'items') {
        const { rows } = await pool.query(
          `SELECT c.code AS competency_code, i.code, i.item_type, i.difficulty,
                  i.level, i.question, i.expected_time, i.is_active
           FROM competency_assessment_items i
           JOIN competencies c ON c.id = i.competency_id
           ORDER BY c.code, i.code`
        );
        return sendCsv(res, 'competency-items.csv',
          ['competency_code','code','item_type','difficulty','level','question','expected_time','is_active'], rows);
      }

      if (type === 'clusters') {
        const { rows } = await pool.query(
          `SELECT cl.code, cl.name, cl.description, cl.is_active,
                  array_agg(c.code ORDER BY c.code) FILTER (WHERE c.id IS NOT NULL) AS competency_codes
           FROM competency_clusters cl
           LEFT JOIN competency_cluster_map m ON m.cluster_id = cl.id
           LEFT JOIN competencies c ON c.id = m.competency_id
           GROUP BY cl.id ORDER BY cl.code`
        );
        const flat = rows.map(r => ({ ...r, competency_codes: (r.competency_codes || []).join('|') }));
        return sendCsv(res, 'competency-clusters.csv',
          ['code','name','description','is_active','competency_codes'], flat);
      }

      if (type === 'all') {
        const { rows } = await pool.query(
          `SELECT d.code AS domain_code, d.name AS domain_name, d.description AS domain_description,
                  d.color AS domain_color, d.weight AS domain_weight,
                  c.code AS competency_code, c.name AS competency_name, c.description AS competency_description,
                  c.competency_type, c.display_order, c.is_active
           FROM competency_domains d
           LEFT JOIN competencies c ON c.domain_id = d.id
           ORDER BY d.display_order, c.display_order`
        );
        return sendCsv(res, 'competency-all.csv',
          ['domain_code','domain_name','domain_description','domain_color','domain_weight',
           'competency_code','competency_name','competency_description','competency_type','display_order','is_active'], rows);
      }

      // full JSON
      const [domains, competencies, items, clusters, clusterMap] = await Promise.all([
        pool.query(`SELECT code,name,description,color,weight,display_order,is_active FROM competency_domains ORDER BY display_order`),
        pool.query(`SELECT d.code AS domain_code,c.code,c.name,c.description,c.competency_type,c.display_order,c.is_active FROM competencies c JOIN competency_domains d ON d.id=c.domain_id ORDER BY d.display_order,c.display_order`),
        pool.query(`SELECT c.code AS competency_code,i.code,i.item_type,i.difficulty,i.level,i.question,i.expected_time,i.is_active FROM competency_assessment_items i JOIN competencies c ON c.id=i.competency_id ORDER BY c.code,i.code`),
        pool.query(`SELECT code,name,description,is_active FROM competency_clusters ORDER BY code`),
        pool.query(`SELECT cl.code AS cluster_code,c.code AS competency_code FROM competency_cluster_map m JOIN competency_clusters cl ON cl.id=m.cluster_id JOIN competencies c ON c.id=m.competency_id ORDER BY cl.code`),
      ]);
      const clusterMapGrouped: Record<string, string[]> = {};
      clusterMap.rows.forEach((r: any) => { (clusterMapGrouped[r.cluster_code] ||= []).push(r.competency_code); });
      return sendJson(res, 'competency-full.json', {
        framework: 'Competency',
        exported_at: new Date().toISOString(),
        domains: domains.rows,
        competencies: competencies.rows,
        items: items.rows,
        clusters: clusters.rows.map((c: any) => ({ ...c, competency_codes: clusterMapGrouped[c.code] || [] })),
      });
    } catch (err) { next(err); }
  });

  app.post('/api/competency/admin/import', requireAuth, requireSuperAdmin, async (req, res, next) => {
    const { type, rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ error: 'rows array required' });
    try {
      let inserted = 0, updated = 0, errors: string[] = [];

      if (type === 'domains') {
        for (const r of rows) {
          try {
            const result = await pool.query(
              `INSERT INTO competency_domains (code, name, description, color, weight, display_order, is_active)
               VALUES ($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT (code) DO UPDATE SET
                 name=EXCLUDED.name, description=EXCLUDED.description, color=EXCLUDED.color,
                 weight=EXCLUDED.weight, display_order=EXCLUDED.display_order, is_active=EXCLUDED.is_active
               RETURNING (xmax=0) AS is_insert`,
              [r.code, r.name, r.description||null, r.color||null,
               r.weight||null, r.display_order||null, r.is_active !== 'false' && r.is_active !== false]
            );
            result.rows[0]?.is_insert ? inserted++ : updated++;
          } catch (e: any) { errors.push(`${r.code}: ${e.message}`); }
        }
      }

      else if (type === 'competencies') {
        for (const r of rows) {
          try {
            const dom = await pool.query(`SELECT id FROM competency_domains WHERE code=$1`, [r.domain_code]);
            if (!dom.rows[0]) { errors.push(`${r.code}: domain_code "${r.domain_code}" not found`); continue; }
            const result = await pool.query(
              `INSERT INTO competencies (domain_id, code, name, description, competency_type, display_order, is_active)
               VALUES ($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT (code) DO UPDATE SET
                 domain_id=EXCLUDED.domain_id, name=EXCLUDED.name, description=EXCLUDED.description,
                 competency_type=EXCLUDED.competency_type, display_order=EXCLUDED.display_order, is_active=EXCLUDED.is_active
               RETURNING (xmax=0) AS is_insert`,
              [dom.rows[0].id, r.code, r.name, r.description||null,
               r.competency_type||'core', r.display_order||null, r.is_active !== 'false' && r.is_active !== false]
            );
            result.rows[0]?.is_insert ? inserted++ : updated++;
          } catch (e: any) { errors.push(`${r.code}: ${e.message}`); }
        }
      }

      else if (type === 'items') {
        for (const r of rows) {
          try {
            const comp = await pool.query(`SELECT id FROM competencies WHERE code=$1`, [r.competency_code]);
            if (!comp.rows[0]) { errors.push(`${r.code}: competency_code "${r.competency_code}" not found`); continue; }
            const result = await pool.query(
              `INSERT INTO competency_assessment_items (competency_id, code, item_type, difficulty, level, question, expected_time, is_active)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
               ON CONFLICT (code) DO UPDATE SET
                 competency_id=EXCLUDED.competency_id, item_type=EXCLUDED.item_type,
                 difficulty=EXCLUDED.difficulty, level=EXCLUDED.level, question=EXCLUDED.question,
                 expected_time=EXCLUDED.expected_time, is_active=EXCLUDED.is_active
               RETURNING (xmax=0) AS is_insert`,
              [comp.rows[0].id, r.code, r.item_type||'mcq',
               r.difficulty ? parseInt(r.difficulty) : 3, r.level ? parseInt(r.level) : 3,
               r.question, r.expected_time ? parseInt(r.expected_time) : 60,
               r.is_active !== 'false' && r.is_active !== false]
            );
            result.rows[0]?.is_insert ? inserted++ : updated++;
          } catch (e: any) { errors.push(`${r.code}: ${e.message}`); }
        }
      }

      else if (type === 'clusters') {
        for (const r of rows) {
          try {
            const result = await pool.query(
              `INSERT INTO competency_clusters (code, name, description, is_active)
               VALUES ($1,$2,$3,$4)
               ON CONFLICT (code) DO UPDATE SET
                 name=EXCLUDED.name, description=EXCLUDED.description, is_active=EXCLUDED.is_active
               RETURNING id, (xmax=0) AS is_insert`,
              [r.code, r.name, r.description||null, r.is_active !== 'false' && r.is_active !== false]
            );
            const { id, is_insert } = result.rows[0];
            is_insert ? inserted++ : updated++;
            if (r.competency_codes) {
              const codes = String(r.competency_codes).split('|').map((s: string) => s.trim()).filter(Boolean);
              await pool.query(`DELETE FROM competency_cluster_map WHERE cluster_id=$1`, [id]);
              for (const code of codes)
                await pool.query(
                  `INSERT INTO competency_cluster_map (cluster_id, competency_id)
                   SELECT $1, id FROM competencies WHERE code=$2 ON CONFLICT DO NOTHING`,
                  [id, code]
                );
            }
          } catch (e: any) { errors.push(`${r.code}: ${e.message}`); }
        }
      }

      else if (type === 'all') {
        const domainSeen = new Set<string>();
        for (const r of rows) {
          if (r.domain_code && !domainSeen.has(r.domain_code)) {
            domainSeen.add(r.domain_code);
            try {
              await pool.query(
                `INSERT INTO competency_domains (code, name, description, color, weight, is_active)
                 VALUES ($1,$2,$3,$4,$5,$6)
                 ON CONFLICT (code) DO UPDATE SET
                   name=EXCLUDED.name, description=EXCLUDED.description,
                   color=EXCLUDED.color, weight=EXCLUDED.weight, is_active=EXCLUDED.is_active`,
                [r.domain_code, r.domain_name||r.domain_code, r.domain_description||null,
                 r.domain_color||null, r.domain_weight||null, true]
              );
            } catch (e: any) { errors.push(`domain ${r.domain_code}: ${e.message}`); }
          }
          if (r.competency_code) {
            try {
              const dom = await pool.query(`SELECT id FROM competency_domains WHERE code=$1`, [r.domain_code]);
              if (!dom.rows[0]) { errors.push(`${r.competency_code}: domain "${r.domain_code}" not found`); continue; }
              const result = await pool.query(
                `INSERT INTO competencies (domain_id, code, name, description, competency_type, display_order, is_active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (code) DO UPDATE SET
                   domain_id=EXCLUDED.domain_id, name=EXCLUDED.name, description=EXCLUDED.description,
                   competency_type=EXCLUDED.competency_type, display_order=EXCLUDED.display_order, is_active=EXCLUDED.is_active
                 RETURNING (xmax=0) AS is_insert`,
                [dom.rows[0].id, r.competency_code, r.competency_name, r.competency_description||null,
                 r.competency_type||'core', r.display_order||null, r.is_active !== 'false' && r.is_active !== false]
              );
              result.rows[0]?.is_insert ? inserted++ : updated++;
            } catch (e: any) { errors.push(`${r.competency_code}: ${e.message}`); }
          }
        }
      }

      else return res.status(400).json({ error: `Unknown type: ${type}` });

      res.json({ ok: true, inserted, updated, errors });
    } catch (err) { next(err); }
  });
}
