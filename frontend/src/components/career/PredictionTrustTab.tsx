import { BRAND } from '@/design-system/tokens';
/**
 * MX-75X — Candidate Prediction Trust & Transparency (READ-ONLY, candidate-facing).
 *
 * The honest, candidate-facing window into the closed-loop intelligence architecture. It does NOT
 * claim predictive accuracy: every insight in the platform is a DEVELOPMENTAL signal, and empirical
 * accuracy is deliberately withheld until enough realized outcomes accrue platform-wide
 * (k_min = 30 realized, non-demo outcomes). This panel explains:
 *   - the validation loop (how insights become trustworthy over time),
 *   - Coverage (does data about you exist?) vs Confidence (is the model calibrated yet?) as SEPARATE
 *     axes — neither is ever fabricated,
 *   - the language policy (these are growth signals, never hiring/promotion/suitability verdicts).
 *
 * There is no candidate-scoped calibration endpoint by design (calibration is a platform-wide,
 * privacy-preserving aggregate), so this is a transparency disclosure — it shows the honest CURRENT
 * state ("Insufficient Evidence" / developmental) rather than inventing a per-user accuracy number.
 */
import { ShieldCheck, GitBranch, Database, Gauge, Info, CheckCircle2, XCircle, Clock } from 'lucide-react';


const K_MIN = 30;

const LOOP = ['Assessment', 'Prediction', 'Outcome', 'Validation', 'Calibration', 'Improved prediction'];

const ALLOWED = [
  'developmental signal', 'growth area', 'strength to build on',
  'directional guidance', 'area to explore', 'readiness indicator',
];
const DISALLOWED = [
  'hiring verdict', 'promotion decision', 'suitability score',
  'guaranteed outcome', 'pass/fail judgement', 'ranking against others',
];

export default function PredictionTrustTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold" style={{ color: BRAND.primary }}>
          <ShieldCheck size={22} /> How we validate your insights
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Transparency matters. Here's exactly how trustworthy your career insights are today — and how
          they get sharper over time. We never inflate or fabricate accuracy.
        </p>
      </div>

      {/* Honest current state */}
      <div className="rounded-xl border p-5" style={{ borderColor: BRAND.amber, backgroundColor: `${BRAND.amber}14` }}>
        <div className="flex items-start gap-3">
          <Clock size={20} style={{ color: BRAND.amber }} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold" style={{ color: BRAND.primary }}>
              Developmental signals — empirical accuracy still building
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Your insights are <strong>developmental signals</strong> designed to guide your growth.
              The platform is still gathering enough real-world outcomes to publish a validated accuracy
              figure — so we deliberately show <strong>none</strong> rather than guess. This is honesty
              by design, not a gap in your profile.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Calibration is published only after at least <strong>{K_MIN}</strong> realized outcomes
              accrue across the platform (privacy-preserving, aggregate). Until then: directional guidance.
            </p>
          </div>
        </div>
      </div>

      {/* The validation loop */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <GitBranch size={16} /> The closed validation loop
        </h3>
        <p className="mt-0.5 text-xs text-slate-400">
          Every insight flows through this loop. Real outcomes feed back in, so guidance gets more
          accurate the more the community grows.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {LOOP.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-600">{step}</span>
              {i < LOOP.length - 1 && <span className="text-slate-300">→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Coverage vs Confidence */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Database size={16} /> Coverage
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            <em>Does enough data about you exist?</em> The more of your assessments, skills and history
            we have, the more complete your picture. Missing data is shown as missing — never filled in
            with a guess.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Gauge size={16} /> Confidence
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            <em>Is the model calibrated yet?</em> A separate question from coverage. Even with complete
            data about you, predictive confidence only grows once real outcomes validate the model.
            Today: developmental.
          </p>
        </div>
      </div>

      {/* Language policy */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Info size={16} /> What these insights are — and aren't
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-1.5 font-medium text-emerald-700">
              <CheckCircle2 size={15} /> These insights ARE
            </p>
            <ul className="space-y-1">
              {ALLOWED.map((a) => (
                <li key={a} className="flex items-center gap-2 text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {a}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 font-medium text-red-700">
              <XCircle size={15} /> These insights are NOT
            </p>
            <ul className="space-y-1">
              {DISALLOWED.map((d) => (
                <li key={d} className="flex items-center gap-2 text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
