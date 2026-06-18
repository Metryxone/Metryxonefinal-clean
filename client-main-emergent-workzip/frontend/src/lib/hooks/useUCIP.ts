/**
 * useUCIP — Phase 1 read-only React hook.
 *
 * Shadow-mode safe: returns `{ enabled:false }` whenever the foundation flag
 * is OFF so callers never accidentally render UCIP data into production UI.
 * Pure read; no caching beyond useState. Callers can opt into rebuild() but
 * the hook never auto-triggers a rebuild.
 */
import { useCallback, useEffect, useState } from 'react';
import { ucipService, type UcipFlagState } from '../services/ucipService';

export type UseUcipState = {
  loading: boolean;
  enabled: boolean;
  shadow: boolean;
  flagState?: UcipFlagState;
  profile?: any;
  error?: string;
};

export function useUCIP(userId: string | null | undefined) {
  const [state, setState] = useState<UseUcipState>({ loading: true, enabled: false, shadow: true });

  const refresh = useCallback(async () => {
    if (!userId) { setState({ loading: false, enabled: false, shadow: true }); return; }
    setState((s) => ({ ...s, loading: true }));
    const flag = await ucipService.flagState();
    const fs = flag.feature_flag;
    const enabled = !!fs?.adaptiveIntelligenceFoundation && !!fs?.ucipEnabled;
    const shadow = !!fs?.ucipShadowMode;
    if (!enabled) {
      setState({ loading: false, enabled: false, shadow, flagState: fs });
      return;
    }
    const r = await ucipService.fetch(userId);
    if (!r.ok) {
      setState({ loading: false, enabled, shadow, flagState: fs, error: r.error });
      return;
    }
    setState({ loading: false, enabled, shadow, flagState: fs, profile: (r.data as any)?.profile });
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const rebuild = useCallback(async () => {
    if (!userId) return { ok: false, error: 'no_user' };
    const r = await ucipService.rebuild(userId);
    if (r.ok) await refresh();
    return r;
  }, [userId, refresh]);

  return { ...state, refresh, rebuild };
}
