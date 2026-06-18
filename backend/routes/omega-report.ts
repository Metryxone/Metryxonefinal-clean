/**
 * OMEGA-X Enriched Report Endpoint
 *
 * GET /api/capadex/report/:session_id/omega
 *
 * Returns the full OMEGA-X enriched report. The aggregation itself lives in the
 * shared `buildOmegaReport` service (also used by the report email path) — this
 * route is a thin HTTP wrapper around it.
 */

import { Router } from 'express';
import type { Pool } from 'pg';
import { OntologyEngine } from '../services/ontology-engine';
import { buildOmegaReport } from '../services/omega-report-builder';

export function registerOmegaReportRoutes(app: Router, pool: Pool): void {
  const ontologyEngine = new OntologyEngine(pool);

  // Idempotent seed-on-boot: the OMEGA-X enriched report derives `active_node_count`,
  // trigger/protective scopes and the causal chain from the ontology graph. If the
  // `omega_ontology_nodes`/`_edges` tables are empty (fresh DB / never seeded), every
  // enriched section collapses to nothing. Seed once on startup when empty so the
  // graph is always present. Best-effort — a seed fault never blocks route wiring.
  (async () => {
    try {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM omega_ontology_nodes');
      if (!rows.length || Number(rows[0].n) === 0) {
        await ontologyEngine.seedOntology();
        console.log('[omega-report] ontology graph seeded on boot (was empty)');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[omega-report] ontology seed-on-boot skipped:', msg);
    }
  })();

  // ── GET /api/capadex/report/:session_id/omega ───────────────────────────────
  app.get('/api/capadex/report/:session_id/omega', async (req, res) => {
    try {
      const { session_id } = req.params;
      const omegaReport = await buildOmegaReport(pool, session_id);
      if (!omegaReport) {
        return res.status(404).json({ error: 'Report not found' });
      }
      res.json(omegaReport);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[omega-report]', msg);
      res.status(500).json({ error: 'Failed to generate OMEGA report', detail: msg });
    }
  });

  // ── GET /api/capadex/ontology/nodes — admin: browse ontology graph ──────────
  app.get('/api/admin/omega/ontology/nodes', async (req, res) => {
    try {
      const { category, type } = req.query;
      let query = 'SELECT * FROM omega_ontology_nodes WHERE 1=1';
      const params: string[] = [];
      if (category) { params.push(String(category)); query += ` AND concern_category = $${params.length}`; }
      if (type) { params.push(String(type)); query += ` AND node_type = $${params.length}`; }
      query += ' ORDER BY concern_category, node_type, severity_weight DESC';
      const { rows } = await pool.query(query, params);
      res.json({ nodes: rows, total: rows.length });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/admin/omega/ontology/edges', async (req, res) => {
    try {
      const { from_key, edge_type } = req.query;
      let query = `SELECT e.*, fn.label AS from_label, fn.node_type AS from_type,
                          tn.label AS to_label, tn.node_type AS to_type
                   FROM omega_ontology_edges e
                   JOIN omega_ontology_nodes fn ON e.from_node_key = fn.node_key
                   JOIN omega_ontology_nodes tn ON e.to_node_key = tn.node_key
                   WHERE 1=1`;
      const params: string[] = [];
      if (from_key) { params.push(String(from_key)); query += ` AND e.from_node_key = $${params.length}`; }
      if (edge_type) { params.push(String(edge_type)); query += ` AND e.edge_type = $${params.length}`; }
      query += ' ORDER BY e.weight DESC';
      const { rows } = await pool.query(query, params);
      res.json({ edges: rows, total: rows.length });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── POST /api/admin/omega/ontology/seed — re-seed ontology ──────────────────
  app.post('/api/admin/omega/ontology/seed', async (req, res) => {
    try {
      await ontologyEngine.seedOntology();
      res.json({ success: true, message: 'Ontology seeded successfully' });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });
}
