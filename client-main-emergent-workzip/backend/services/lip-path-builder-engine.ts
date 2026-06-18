/**
 * LIP — Learning Path Builder Engine
 * Assembles phases from competency gaps and resource maps.
 * Upserts lip_learning_paths + lip_learning_path_items. Never throws.
 *
 * Rebuild semantics (append-only history):
 *   - Prior active path items → status = 'skipped' (never deleted)
 *   - Prior active path     → status = 'paused'
 *   - New path + items created fresh
 *
 * Template application:
 *   When a template is found, its phases[].resource_type_sequence drives
 *   resource assignment per phase (not the static PHASE_NAMES fallback).
 */
import type { Pool } from 'pg';
import type { LIPGap } from './lip-competency-gap-engine';
import type { LIPCourse, LIPCert, LIPProject, LIPMentor } from './lip-resource-mapping-engine';

export interface LIPPathItem {
  id: string;
  item_type: 'course' | 'certification' | 'project' | 'mentoring';
  item_id: string;
  item_title: string;
  item_provider: string;
  hours: number;
  cost_inr: number;
  phase_num: number;
  order_in_phase: number;
  is_required: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export interface LIPPath {
  id: string;
  name: string;
  target_role_id: string | null;
  template_used: string | null;
  status: string;
  total_hours_estimated: number;
  total_hours_completed: number;
  progress_pct: number;
  phases: { phase_num: number; name: string; items: LIPPathItem[] }[];
}

export interface LIPPathResult {
  path: LIPPath;
  total_hours: number;
  estimated_weeks: number;
  template_used: string | null;
}

export interface PathBuilderOpts {
  targetRoleId?: string | null;
  forceRebuild?: boolean;
  maxHours?: number;
}

interface TemplatePhase {
  phase_num: number;
  name: string;
  focus: string;
  resource_type_sequence: string[];
}

const PHASE_NAMES_FALLBACK: Record<number, string> = {
  1: 'Critical Gap Closure',
  2: 'Major Skill Development',
  3: 'Certifications & Validation',
  4: 'Applied Projects',
  5: 'Mentoring & Career Launch',
};

type AnyResource = LIPCourse | LIPCert | LIPProject | LIPMentor;

function pickResourceForType(
  type: string,
  gaps: LIPGap[],
  courses: LIPCourse[],
  certs: LIPCert[],
  projects: LIPProject[],
  mentors: LIPMentor[],
  used: Set<string>,
): LIPPathItem | null {
  if (type === 'course') {
    const match = courses.find(c => !used.has(c.id) && (gaps.length === 0 || gaps.some(g => c.competency_codes.includes(g.competency_code))));
    const fallback = courses.find(c => !used.has(c.id));
    const c = match ?? fallback;
    if (!c) return null;
    used.add(c.id);
    return { id: '', item_type: 'course', item_id: c.id, item_title: c.title, item_provider: c.provider, hours: c.duration_hours, cost_inr: c.cost_inr, phase_num: 0, order_in_phase: 0, is_required: true, status: 'pending' };
  }
  if (type === 'certification') {
    const match = certs.find(c => !used.has(c.id) && (gaps.length === 0 || gaps.some(g => c.competency_codes.includes(g.competency_code))));
    const fallback = certs.find(c => !used.has(c.id));
    const c = match ?? fallback;
    if (!c) return null;
    used.add(c.id);
    return { id: '', item_type: 'certification', item_id: c.id, item_title: c.title, item_provider: c.issuing_body, hours: c.prep_hours_estimate, cost_inr: c.cost_inr, phase_num: 0, order_in_phase: 0, is_required: false, status: 'pending' };
  }
  if (type === 'project') {
    const p = projects.find(p => !used.has(p.id));
    if (!p) return null;
    used.add(p.id);
    return { id: '', item_type: 'project', item_id: p.id, item_title: p.title, item_provider: '', hours: p.duration_hours, cost_inr: 0, phase_num: 0, order_in_phase: 0, is_required: false, status: 'pending' };
  }
  if (type === 'mentoring') {
    const m = mentors.find(m => !used.has(m.id));
    if (!m) return null;
    used.add(m.id);
    return { id: '', item_type: 'mentoring', item_id: m.id, item_title: `Mentoring with ${m.name}`, item_provider: m.title, hours: 8, cost_inr: m.cost_per_hour_inr * 8, phase_num: 0, order_in_phase: 0, is_required: false, status: 'pending' };
  }
  return null;
}

/**
 * Assemble path items using template phase structure.
 * Each template phase specifies a resource_type_sequence; we fill each slot
 * with the best matching unused resource.
 */
function assembleFromTemplate(
  templatePhases: TemplatePhase[],
  gaps: LIPGap[],
  courses: LIPCourse[],
  certs: LIPCert[],
  projects: LIPProject[],
  mentors: LIPMentor[],
): LIPPathItem[] {
  const used = new Set<string>();
  const items: LIPPathItem[] = [];
  const critGaps = gaps.filter(g => g.gap_severity === 'critical');
  const majorGaps = gaps.filter(g => g.gap_severity === 'major');

  for (const phase of templatePhases) {
    const gapsForPhase = phase.focus === 'core_skills' ? critGaps
      : phase.focus === 'technical_depth' ? majorGaps
      : gaps;
    let order = 1;
    for (const rtype of phase.resource_type_sequence) {
      const item = pickResourceForType(rtype, gapsForPhase, courses, certs, projects, mentors, used);
      if (item) {
        item.phase_num = phase.phase_num;
        item.order_in_phase = order++;
        items.push(item);
      }
    }
  }
  return items;
}

/**
 * Assemble path items using gap-severity phases (fallback when no template).
 */
function assembleFromGaps(
  gaps: LIPGap[],
  courses: LIPCourse[],
  certs: LIPCert[],
  projects: LIPProject[],
  mentors: LIPMentor[],
): LIPPathItem[] {
  const used = new Set<string>();
  const items: LIPPathItem[] = [];

  const critGaps = gaps.filter(g => g.gap_severity === 'critical').slice(0, 3);
  let order = 1;
  for (const gap of critGaps) {
    const c = courses.find(c => c.competency_codes.includes(gap.competency_code) && !used.has(c.id));
    if (c) { used.add(c.id); items.push({ id: '', item_type: 'course', item_id: c.id, item_title: c.title, item_provider: c.provider, hours: c.duration_hours, cost_inr: c.cost_inr, phase_num: 1, order_in_phase: order++, is_required: true, status: 'pending' }); }
  }
  const topCert = certs.find(c => critGaps.some(g => c.competency_codes.includes(g.competency_code)) && !used.has(c.id)) ?? certs.find(c => !used.has(c.id));
  if (topCert) { used.add(topCert.id); items.push({ id: '', item_type: 'certification', item_id: topCert.id, item_title: topCert.title, item_provider: topCert.issuing_body, hours: topCert.prep_hours_estimate, cost_inr: topCert.cost_inr, phase_num: 1, order_in_phase: order++, is_required: false, status: 'pending' }); }

  const majorGaps = gaps.filter(g => g.gap_severity === 'major').slice(0, 4);
  order = 1;
  for (const gap of majorGaps) {
    const c = courses.find(c => c.competency_codes.includes(gap.competency_code) && !used.has(c.id));
    if (c) { used.add(c.id); items.push({ id: '', item_type: 'course', item_id: c.id, item_title: c.title, item_provider: c.provider, hours: c.duration_hours, cost_inr: c.cost_inr, phase_num: 2, order_in_phase: order++, is_required: true, status: 'pending' }); }
  }

  const modGaps = gaps.filter(g => g.gap_severity === 'moderate').slice(0, 2);
  order = 1;
  for (const gap of modGaps) {
    const c = courses.find(c => c.competency_codes.includes(gap.competency_code) && !used.has(c.id));
    if (c) { used.add(c.id); items.push({ id: '', item_type: 'course', item_id: c.id, item_title: c.title, item_provider: c.provider, hours: c.duration_hours, cost_inr: c.cost_inr, phase_num: 3, order_in_phase: order++, is_required: false, status: 'pending' }); }
  }
  const cert3 = certs.find(c => !used.has(c.id));
  if (cert3) { used.add(cert3.id); items.push({ id: '', item_type: 'certification', item_id: cert3.id, item_title: cert3.title, item_provider: cert3.issuing_body, hours: cert3.prep_hours_estimate, cost_inr: cert3.cost_inr, phase_num: 3, order_in_phase: ++order, is_required: false, status: 'pending' }); }

  order = 1;
  for (const proj of projects.filter(p => !used.has(p.id)).slice(0, 3)) {
    used.add(proj.id);
    items.push({ id: '', item_type: 'project', item_id: proj.id, item_title: proj.title, item_provider: '', hours: proj.duration_hours, cost_inr: 0, phase_num: 4, order_in_phase: order++, is_required: false, status: 'pending' });
  }

  const mentor = mentors.find(m => !used.has(m.id));
  if (mentor) { items.push({ id: '', item_type: 'mentoring', item_id: mentor.id, item_title: `Mentoring with ${mentor.name}`, item_provider: mentor.title, hours: 8, cost_inr: mentor.cost_per_hour_inr * 8, phase_num: 5, order_in_phase: 1, is_required: false, status: 'pending' }); }

  return items;
}

export async function buildLearningPath(
  userId: string,
  courses: LIPCourse[],
  certs: LIPCert[],
  projects: LIPProject[],
  mentors: LIPMentor[],
  gaps: LIPGap[],
  opts: PathBuilderOpts,
  pool: Pool,
): Promise<LIPPathResult> {
  try {
    // 1. Return cached active path if fresh (< 24 h) and not forcing rebuild
    if (!opts.forceRebuild) {
      try {
        const existing = await pool.query<{ id: string; updated_at: string }>(
          `SELECT id, updated_at FROM lip_learning_paths WHERE user_id=$1 AND status='active'
           ORDER BY updated_at DESC LIMIT 1`,
          [userId],
        );
        if (existing.rows.length > 0) {
          const ageHours = (Date.now() - new Date(existing.rows[0].updated_at).getTime()) / 3600000;
          if (ageHours < 24) return await loadExistingPath(existing.rows[0].id, pool);
        }
      } catch { /* first build */ }
    }

    // 2. Resolve template (by role → by gap pattern → null)
    let templateId: number | null = null;
    let templateCode: string | null = null;
    let templatePhases: TemplatePhase[] | null = null;

    const tryTemplate = async (where: string, param: unknown) => {
      try {
        const r = await pool.query<{ id: number; code: string; phases: TemplatePhase[] }>(
          `SELECT id, code, phases FROM lip_path_templates WHERE ${where} AND is_active=true LIMIT 1`,
          [param],
        );
        if (r.rows.length > 0) {
          templateId = r.rows[0].id;
          templateCode = r.rows[0].code;
          templatePhases = r.rows[0].phases;
        }
      } catch { /* ignore */ }
    };

    if (opts.targetRoleId) {
      await tryTemplate('target_role_id=$1', opts.targetRoleId);
    }
    if (!templateId) {
      const critGaps = gaps.filter(g => g.gap_severity === 'critical');
      let code = 'GENERAL_TECHNICAL';
      if (critGaps.some(g => g.competency_code === 'leadership')) code = 'GENERAL_LEADERSHIP';
      else if (critGaps.some(g => g.competency_code === 'data_analysis')) code = 'GENERAL_ANALYTICS';
      await tryTemplate('code=$1', code);
    }

    // 3. Assemble items: template-driven when available, gap-severity fallback otherwise
    let rawItems: LIPPathItem[];
    let resolvedPhaseNames: Record<number, string> = PHASE_NAMES_FALLBACK;
    if (templatePhases && templatePhases.length > 0) {
      rawItems = assembleFromTemplate(templatePhases, gaps, courses, certs, projects, mentors);
      resolvedPhaseNames = Object.fromEntries(templatePhases.map(p => [p.phase_num, p.name]));
    } else {
      rawItems = assembleFromGaps(gaps, courses, certs, projects, mentors);
    }

    // 4. Honour maxHours
    let filteredItems = rawItems;
    if (opts.maxHours && opts.maxHours > 0) {
      let cum = 0;
      filteredItems = rawItems.filter(i => {
        if (cum + i.hours <= opts.maxHours!) { cum += i.hours; return true; }
        return i.is_required;
      });
    }

    const totalHours = filteredItems.reduce((s, i) => s + i.hours, 0);
    const estimatedWeeks = Math.ceil(totalHours / 8);

    const phaseNums = [...new Set(filteredItems.map(i => i.phase_num))].sort((a, b) => a - b);

    // 5. Persist: mark prior items SKIPPED, pause old paths, create new path + items
    let pathId = 'temp-' + userId;
    try {
      // Mark prior active path items as skipped (append-only — never delete history)
      await pool.query(
        `UPDATE lip_learning_path_items SET status='skipped'
         WHERE path_id IN (
           SELECT id FROM lip_learning_paths WHERE user_id=$1 AND status='active'
         ) AND status NOT IN ('completed','skipped')`,
        [userId],
      );
      // Pause prior active paths
      await pool.query(
        `UPDATE lip_learning_paths SET status='paused', updated_at=NOW()
         WHERE user_id=$1 AND status='active'`,
        [userId],
      );

      // Build lightweight phase summary for the path record
      const phaseSummary = phaseNums.map(n => ({
        phase_num: n,
        name: resolvedPhaseNames[n] ?? `Phase ${n}`,
        item_count: filteredItems.filter(i => i.phase_num === n).length,
      }));

      const pathRes = await pool.query<{ id: string }>(
        `INSERT INTO lip_learning_paths
           (user_id,name,target_role_id,template_id,status,
            total_hours_estimated,total_hours_completed,progress_pct,
            phases,created_at,updated_at)
         VALUES ($1,$2,$3,$4,'active',$5,0,0,$6,NOW(),NOW())
         RETURNING id`,
        [userId, 'My Learning Path', opts.targetRoleId || null, templateId,
         Math.round(totalHours * 10) / 10, JSON.stringify(phaseSummary)],
      );
      pathId = pathRes.rows[0].id;

      // Insert items and collect their DB-assigned ids
      for (const item of filteredItems) {
        const r = await pool.query<{ id: string }>(
          `INSERT INTO lip_learning_path_items
             (path_id,item_type,item_id,item_title,item_provider,
              hours,cost_inr,phase_num,order_in_phase,is_required,status,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',NOW())
           RETURNING id`,
          [pathId, item.item_type, item.item_id, item.item_title, item.item_provider,
           item.hours, item.cost_inr, item.phase_num, item.order_in_phase, item.is_required],
        );
        item.id = r.rows[0].id;
        item.status = 'pending';
      }
    } catch {
      // DB unavailable — return in-memory result without persisted ids
    }

    const phases = phaseNums.map(n => ({
      phase_num: n,
      name: resolvedPhaseNames[n] ?? `Phase ${n}`,
      items: filteredItems.filter(i => i.phase_num === n),
    }));

    const path: LIPPath = {
      id: pathId,
      name: 'My Learning Path',
      target_role_id: opts.targetRoleId || null,
      template_used: templateCode,
      status: 'active',
      total_hours_estimated: Math.round(totalHours * 10) / 10,
      total_hours_completed: 0,
      progress_pct: 0,
      phases,
    };

    return { path, total_hours: Math.round(totalHours * 10) / 10, estimated_weeks: estimatedWeeks, template_used: templateCode };
  } catch {
    return emptyPathResult(opts);
  }
}

async function loadExistingPath(pathId: string, pool: Pool): Promise<LIPPathResult> {
  const pathRes = await pool.query<Record<string, unknown>>(
    `SELECT lp.*, lpt.code AS template_code
     FROM lip_learning_paths lp
     LEFT JOIN lip_path_templates lpt ON lpt.id = lp.template_id
     WHERE lp.id=$1`,
    [pathId],
  );
  const row = pathRes.rows[0];
  const itemsRes = await pool.query<Record<string, unknown>>(
    `SELECT * FROM lip_learning_path_items WHERE path_id=$1 ORDER BY phase_num,order_in_phase`,
    [pathId],
  );
  const items: LIPPathItem[] = itemsRes.rows.map(r => ({
    id: String(r.id ?? ''),
    item_type: r.item_type as LIPPathItem['item_type'],
    item_id: r.item_id as string,
    item_title: r.item_title as string,
    item_provider: (r.item_provider as string) || '',
    hours: Number(r.hours),
    cost_inr: Number(r.cost_inr),
    phase_num: Number(r.phase_num),
    order_in_phase: Number(r.order_in_phase),
    is_required: Boolean(r.is_required),
    status: (r.status as LIPPathItem['status']) ?? 'pending',
  }));

  const phaseNums = [...new Set(items.map(i => i.phase_num))].sort((a, b) => a - b);
  const phases = phaseNums.map(n => ({
    phase_num: n,
    name: PHASE_NAMES_FALLBACK[n] ?? `Phase ${n}`,
    items: items.filter(i => i.phase_num === n),
  }));
  const totalHours = Number(row.total_hours_estimated);
  const templateCode = (row.template_code as string | null) ?? null;
  return {
    path: {
      id: pathId,
      name: row.name as string,
      target_role_id: row.target_role_id as string | null,
      template_used: templateCode,
      status: row.status as string,
      total_hours_estimated: totalHours,
      total_hours_completed: Number(row.total_hours_completed),
      progress_pct: Number(row.progress_pct),
      phases,
    },
    total_hours: totalHours,
    estimated_weeks: Math.ceil(totalHours / 8),
    template_used: templateCode,
  };
}

function emptyPathResult(opts: PathBuilderOpts): LIPPathResult {
  return {
    path: {
      id: '', name: 'My Learning Path', target_role_id: opts.targetRoleId || null,
      template_used: null, status: 'active', total_hours_estimated: 0,
      total_hours_completed: 0, progress_pct: 0, phases: [],
    },
    total_hours: 0, estimated_weeks: 0, template_used: null,
  };
}
