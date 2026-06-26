/**
 * Task #6 — Invoice & GST Engine routes.
 *
 * ADDITIVE · FLAG-GATED (invoiceGstEngine, default OFF) under /api/invoice.
 *
 * Flag-OFF discipline (byte-identical legacy):
 *   • Every route returns 503 when the flag is OFF.
 *   • The lazy ensure-schema runs ONLY when the flag is ON — so with the flag OFF NO `inv_*`
 *     table is created (schema unchanged too).
 *
 * Never fabricates: documents are built from REAL capadex_payments / comm_subscriptions rows;
 * absent/incompatible sources → honest 4xx (AbstainError).
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import type { Pool } from 'pg';
import fs from 'fs';
import { isInvoiceGstEngineEnabled } from '../config/feature-flags';
import { ensureInvoiceSchema } from '../services/invoice/invoice-schema';
import {
  validateGSTIN, computeGST, stateNameForCode, GST_STATE_CODES,
  DOC_TYPES, DOC_TYPE_LABEL, isDocType,
} from '../services/invoice/gst';
import {
  generateInvoice, getInvoiceWithItems, getSellerConfig, AbstainError,
  type SourceType,
} from '../services/invoice/invoice-runtime';
import { renderInvoiceToPDF } from '../services/pdf-renderer';
import { sendInvoiceEmail } from '../email';
import { z } from 'zod';
import { validate, idParam } from '../lib/validate';

const asStr = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const asNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const rupees = (paise: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(Number(paise) / 100);

// Mirror-only schemas (handler keeps all other validation/coercion).
// gst-preview: handler requires a finite, non-negative amount_paise (`asNum` +
//   `amount < 0` check) → coerce.number().min(0) matches `asNum` (string→number) exactly.
// generate-invoice: handler requires doc_type (isDocType) + non-empty source_id;
//   we require both present (doc_type validity stays in the handler's isDocType 400).
// seller-config (PUT) is all-optional (COALESCE) → no fixed schema (handler-owned).
const gstPreviewBody = z.object({ amount_paise: z.coerce.number().min(0) });
const generateInvoiceBody = z.object({
  doc_type: z.string().trim().min(1),
  source_id: z.string().trim().min(1),
});

function gate(_req: Request, res: Response, next: NextFunction): void {
  if (!isInvoiceGstEngineEnabled()) {
    res.status(503).json({ error: 'feature_disabled', feature: 'invoice_gst_engine' });
    return;
  }
  next();
}

export function registerInvoiceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // ── Lazy ensure-schema — runs ONLY when the flag is ON (no DDL when OFF). ──
  app.use('/api/invoice', (req: Request, res: Response, next: NextFunction) => {
    if (!isInvoiceGstEngineEnabled()) return next();
    ensureInvoiceSchema(pool).then(() => next()).catch((err) => {
      console.error('[invoice-engine] ensure-schema failed:', err instanceof Error ? err.message : String(err));
      res.status(503).json({ error: 'schema_unavailable' });
    });
  });

  const admin: RequestHandler[] = [gate, requireAuth, requireSuperAdmin];

  // ── Metadata (doc types + state codes) ──
  app.get('/api/invoice/admin/meta', ...admin, (_req, res) => {
    res.json({
      doc_types: DOC_TYPES.map((d) => ({ value: d, label: DOC_TYPE_LABEL[d] })),
      state_codes: Object.entries(GST_STATE_CODES).map(([code, name]) => ({ code, name })),
    });
  });

  // ── Seller config ──
  app.get('/api/invoice/admin/seller-config', ...admin, async (_req, res, next) => {
    try { res.json(await getSellerConfig(pool)); } catch (e) { next(e); }
  });
  app.put('/api/invoice/admin/seller-config', ...admin, async (req, res, next) => {
    try {
      const b = req.body || {};
      // Validate GSTIN if provided (state_code is derived from it when valid).
      let stateCode = asStr(b.state_code);
      if (asStr(b.gstin)) {
        const v = validateGSTIN(b.gstin);
        if (!v.valid) return res.status(400).json({ error: `seller GSTIN invalid: ${v.reason}` });
        stateCode = v.state_code;
      }
      const existing = await getSellerConfig(pool);
      const { rows } = await pool.query(
        `UPDATE inv_seller_config SET
           legal_name=COALESCE($2,legal_name), trade_name=COALESCE($3,trade_name),
           gstin=COALESCE($4,gstin), state_code=COALESCE($5,state_code),
           address_line1=COALESCE($6,address_line1), address_line2=COALESCE($7,address_line2),
           city=COALESCE($8,city), state=COALESCE($9,state), pincode=COALESCE($10,pincode),
           email=COALESCE($11,email), phone=COALESCE($12,phone),
           default_gst_rate_pct=COALESCE($13,default_gst_rate_pct), hsn_sac=COALESCE($14,hsn_sac),
           updated_at=now()
         WHERE id=$1 RETURNING *`,
        [existing.id, asStr(b.legal_name), asStr(b.trade_name), asStr(b.gstin), stateCode,
         asStr(b.address_line1), asStr(b.address_line2), asStr(b.city), asStr(b.state), asStr(b.pincode),
         asStr(b.email), asStr(b.phone), asNum(b.default_gst_rate_pct), asStr(b.hsn_sac)],
      );
      res.json(rows[0]);
    } catch (e) { next(e); }
  });

  // ── GSTIN validation (pure) ──
  app.get('/api/invoice/admin/validate-gstin', ...admin, (req, res) => {
    res.json(validateGSTIN(asStr(req.query.gstin)));
  });

  // ── GST preview (pure compute, no persistence) ──
  app.post('/api/invoice/admin/gst-preview', ...admin, validate({ body: gstPreviewBody }), async (req, res, next) => {
    try {
      const b = req.body || {};
      const amount = asNum(b.amount_paise);
      if (amount == null || amount < 0) return res.status(400).json({ error: 'amount_paise is required' });
      const seller = await getSellerConfig(pool);
      let buyerStateCode = asStr(b.buyer_state_code);
      if (asStr(b.buyer_gstin)) {
        const v = validateGSTIN(b.buyer_gstin);
        if (!v.valid) return res.status(400).json({ error: `buyer GSTIN invalid: ${v.reason}` });
        buyerStateCode = v.state_code;
      }
      const rate = asNum(b.gst_rate_pct) ?? seller.default_gst_rate_pct;
      const result = computeGST({
        amountPaise: amount, sellerStateCode: seller.state_code, buyerStateCode,
        gstRatePct: rate, priceIncludesGst: b.price_includes_gst !== false,
      });
      res.json({
        ...result,
        seller_state_code: seller.state_code,
        seller_state_name: stateNameForCode(seller.state_code),
        buyer_state_name: stateNameForCode(buyerStateCode),
      });
    } catch (e) { next(e); }
  });

  // ── Candidate sources for the UI (real rows only) ──
  app.get('/api/invoice/admin/sources', ...admin, async (req, res, next) => {
    try {
      const type = asStr(req.query.type) || 'capadex_payment';
      if (type === 'comm_subscription') {
        const { rows } = await pool.query(
          `SELECT s.id, s.status, c.email AS customer_email, c.name AS customer_name,
                  p.name AS plan_name, p.price_paise, COALESCE(p.currency,'INR') AS currency
           FROM comm_subscriptions s
           JOIN comm_customers c ON c.id = s.customer_id
           LEFT JOIN comm_plans p ON p.id = s.plan_id
           ORDER BY s.created_at DESC LIMIT 100`,
        );
        return res.json({ type, rows });
      }
      // capadex_payment (+ refunds are the same table filtered by status downstream)
      const status = asStr(req.query.status);
      const { rows } = await pool.query(
        `SELECT id, email, participant_name, concern_name, stage_name, amount_paise,
                COALESCE(currency,'INR') AS currency, status, created_at
         FROM capadex_payments ${status ? 'WHERE status = $1' : ''}
         ORDER BY created_at DESC LIMIT 100`,
        status ? [status] : [],
      );
      res.json({ type: 'capadex_payment', rows });
    } catch (e) { next(e); }
  });

  // ── Tax report aggregation (literal path — BEFORE /:id) ──
  app.get('/api/invoice/admin/tax-report', ...admin, async (req, res, next) => {
    try {
      const from = asStr(req.query.from);
      const to = asStr(req.query.to);
      const conds: string[] = [`status <> 'cancelled'`];
      const params: any[] = [];
      if (from) { params.push(from); conds.push(`created_at >= $${params.length}`); }
      if (to) { params.push(to); conds.push(`created_at <= $${params.length}`); }
      const where = `WHERE ${conds.join(' AND ')}`;

      const totals = (await pool.query(
        `SELECT COUNT(*)::int AS document_count,
                COALESCE(SUM(taxable_paise),0)::bigint AS taxable_paise,
                COALESCE(SUM(cgst_paise),0)::bigint AS cgst_paise,
                COALESCE(SUM(sgst_paise),0)::bigint AS sgst_paise,
                COALESCE(SUM(igst_paise),0)::bigint AS igst_paise,
                COALESCE(SUM(total_tax_paise),0)::bigint AS total_tax_paise,
                COALESCE(SUM(total_paise),0)::bigint AS total_paise
         FROM inv_invoices ${where}`, params)).rows[0];

      const byMonth = (await pool.query(
        `SELECT to_char(date_trunc('month', created_at),'YYYY-MM') AS month,
                COUNT(*)::int AS document_count,
                COALESCE(SUM(taxable_paise),0)::bigint AS taxable_paise,
                COALESCE(SUM(cgst_paise),0)::bigint AS cgst_paise,
                COALESCE(SUM(sgst_paise),0)::bigint AS sgst_paise,
                COALESCE(SUM(igst_paise),0)::bigint AS igst_paise,
                COALESCE(SUM(total_tax_paise),0)::bigint AS total_tax_paise
         FROM inv_invoices ${where}
         GROUP BY 1 ORDER BY 1 DESC`, params)).rows;

      const byType = (await pool.query(
        `SELECT doc_type, COUNT(*)::int AS document_count,
                COALESCE(SUM(total_paise),0)::bigint AS total_paise
         FROM inv_invoices ${where}
         GROUP BY doc_type ORDER BY doc_type`, params)).rows;

      res.json({ range: { from: from || null, to: to || null }, totals, by_month: byMonth, by_type: byType });
    } catch (e) { next(e); }
  });

  // ── List invoices (literal path — BEFORE /:id) ──
  app.get('/api/invoice/admin/invoices', ...admin, async (req, res, next) => {
    try {
      const docType = asStr(req.query.doc_type);
      const { rows } = await pool.query(
        `SELECT * FROM inv_invoices ${docType ? 'WHERE doc_type = $1' : ''}
         ORDER BY created_at DESC LIMIT 200`,
        docType ? [docType] : [],
      );
      res.json({ rows });
    } catch (e) { next(e); }
  });

  // ── Generate a document from a real source ──
  app.post('/api/invoice/admin/invoices', ...admin, validate({ body: generateInvoiceBody }), async (req, res, next) => {
    try {
      const b = req.body || {};
      if (!isDocType(b.doc_type)) return res.status(400).json({ error: 'invalid doc_type' });
      const sourceType = (asStr(b.source_type) || 'capadex_payment') as SourceType;
      if (!['capadex_payment', 'comm_subscription', 'refund'].includes(sourceType)) {
        return res.status(400).json({ error: 'invalid source_type' });
      }
      const sourceId = asStr(b.source_id);
      if (!sourceId) return res.status(400).json({ error: 'source_id is required' });

      const result = await generateInvoice(pool, {
        docType: b.doc_type, sourceType, sourceId,
        buyerGstin: asStr(b.buyer_gstin), buyerStateCode: asStr(b.buyer_state_code),
        gstRatePct: asNum(b.gst_rate_pct), priceIncludesGst: b.price_includes_gst !== false,
        notes: asStr(b.notes), relatedInvoiceId: asStr(b.related_invoice_id),
      });
      res.status(201).json(result);
    } catch (e: any) {
      if (e instanceof AbstainError) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  });

  // ── Invoice detail (/:id — AFTER literal paths) ──
  app.get('/api/invoice/admin/invoices/:id', ...admin, async (req, res, next) => {
    try {
      const result = await getInvoiceWithItems(pool, req.params.id);
      if (!result) return res.status(404).json({ error: 'not found' });
      res.json(result);
    } catch (e) { next(e); }
  });

  // ── PDF download (renders + caches pdf_path) ──
  app.get('/api/invoice/admin/invoices/:id/pdf', ...admin, async (req, res, next) => {
    try {
      const result = await getInvoiceWithItems(pool, req.params.id);
      if (!result) return res.status(404).json({ error: 'not found' });
      const seller = await getSellerConfig(pool);
      const filePath = await renderInvoiceToPDF(result.invoice, result.line_items, seller);
      await pool.query(`UPDATE inv_invoices SET pdf_path=$2, updated_at=now() WHERE id=$1`, [result.invoice.id, filePath]);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition',
        `attachment; filename="${String(result.invoice.invoice_number).replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (e) { next(e); }
  });

  // ── Email the document to the customer ──
  app.post('/api/invoice/admin/invoices/:id/email', ...admin, validate({ params: idParam }), async (req, res, next) => {
    try {
      const result = await getInvoiceWithItems(pool, req.params.id);
      if (!result) return res.status(404).json({ error: 'not found' });
      const inv = result.invoice;
      const toEmail = asStr(req.body?.to_email) || inv.customer_email;
      if (!toEmail) return res.status(400).json({ error: 'no customer email on this document; provide to_email' });

      const seller = await getSellerConfig(pool);
      const filePath = await renderInvoiceToPDF(inv, result.line_items, seller);
      const pdfBuffer = fs.readFileSync(filePath);
      const sent = await sendInvoiceEmail({
        toEmail, name: inv.customer_name,
        docTypeLabel: DOC_TYPE_LABEL[inv.doc_type as keyof typeof DOC_TYPE_LABEL] ?? 'Invoice',
        invoiceNumber: inv.invoice_number,
        totalLabel: rupees(Number(inv.total_paise ?? 0)),
        pdfBuffer, pdfFilename: `${String(inv.invoice_number).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      });
      if (sent) {
        await pool.query(
          `UPDATE inv_invoices SET status='emailed', emailed_at=now(), pdf_path=$2, updated_at=now() WHERE id=$1`,
          [inv.id, filePath]);
      } else {
        await pool.query(`UPDATE inv_invoices SET pdf_path=$2, updated_at=now() WHERE id=$1`, [inv.id, filePath]);
      }
      // emailSent:false in dev (Zoho creds absent) is honest, not an error.
      res.json({ ok: true, emailSent: sent, to: toEmail });
    } catch (e) { next(e); }
  });
}
