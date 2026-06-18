/**
 * Dynamic Assessment Runtime debug panel — Phase 4 (shadow-mode).
 * Mounted only behind `?debug=1`; never affects the visible assessment UI.
 */
import { useEffect, useState } from 'react';
import { dynamicAssessmentService, type DynamicAssessmentFlagState } from '@/lib/services/dynamicAssessmentService';

export function DynamicAssessmentDebugPanel() {
  const [flags, setFlags] = useState<DynamicAssessmentFlagState | null>(null);
  const [versions, setVersions] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [f, v] = await Promise.all([
        dynamicAssessmentService.featureFlag(),
        dynamicAssessmentService.versions(),
      ]);
      if (!alive) return;
      setFlags(f);
      setVersions(v);
    })();
    return () => { alive = false; };
  }, []);

  if (!flags) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 12, right: 12, zIndex: 9999,
      background: 'rgba(15,23,42,0.92)', color: '#e2e8f0', padding: '10px 12px',
      borderRadius: 8, fontSize: 12, lineHeight: 1.4, fontFamily: 'monospace',
      maxWidth: 320, border: '1px solid rgba(148,163,184,0.3)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Dynamic Assessment · Phase 4</div>
      <div>foundation: {String(flags.adaptiveIntelligenceFoundation)}</div>
      <div>dynamicQuestionGeneration: {String(flags.dynamicQuestionGeneration)}</div>
      <div>adaptiveQuestionBranching: {String(flags.adaptiveQuestionBranching)}</div>
      <div>cognitiveRuntimeEnabled: {String(flags.cognitiveRuntimeEnabled)}</div>
      {versions && (
        <div style={{ marginTop: 6, opacity: 0.8 }}>
          {Object.entries(versions).map(([k, v]) => (
            <div key={k}>{k}: {v}</div>
          ))}
        </div>
      )}
    </div>
  );
}
