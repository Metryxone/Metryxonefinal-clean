/**
 * Adaptive Runtime Authority debug panel — Phase 5 (shadow-mode).
 * Mounted only behind `?debug=1`; never affects production UI.
 */
import { useEffect, useState } from 'react';
import {
  adaptiveRuntimeAuthorityService, type AdaptiveRuntimeFlagState,
} from '@/lib/services/adaptiveRuntimeAuthorityService';

export function AdaptiveRuntimeAuthorityDebugPanel() {
  const [flags, setFlags] = useState<AdaptiveRuntimeFlagState | null>(null);
  const [versions, setVersions] = useState<Record<string, string> | null>(null);
  const [stages, setStages] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [f, v] = await Promise.all([
        adaptiveRuntimeAuthorityService.featureFlag(),
        adaptiveRuntimeAuthorityService.versions(),
      ]);
      if (!alive) return;
      setFlags(f);
      setVersions(v?.versions ?? null);
      setStages(v?.authority_stages ?? null);
    })();
    return () => { alive = false; };
  }, []);

  if (!flags) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 12, left: 12, zIndex: 9999,
      background: 'rgba(15,23,42,0.92)', color: '#e2e8f0', padding: '10px 12px',
      borderRadius: 8, fontSize: 12, lineHeight: 1.4, fontFamily: 'monospace',
      maxWidth: 340, border: '1px solid rgba(148,163,184,0.3)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Adaptive Runtime Authority · Phase 5</div>
      <div>foundation: {String(flags.adaptiveIntelligenceFoundation)}</div>
      <div>adaptiveRuntimeAuthority: {String(flags.adaptiveRuntimeAuthority)}</div>
      <div>competencyFusionEnabled: {String(flags.competencyFusionEnabled)}</div>
      <div>contextualScoringAuthority: {String(flags.contextualScoringAuthority)}</div>
      <div>intelligenceNarratives: {String(flags.intelligenceNarratives)}</div>
      <div>continuousCompetencyMemory: {String(flags.continuousCompetencyMemory)}</div>
      {stages && <div style={{ marginTop: 6 }}>stages: {stages.join(' → ')}</div>}
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
