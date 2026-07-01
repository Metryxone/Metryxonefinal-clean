import React from 'react';
import { BRAND } from '@/design-system/tokens';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

/**
 * ProctoringGuard — first-class web-level BROWSER LOCKDOWN / proctoring (GAP-AD-4).
 *
 * Wraps a delivery surface and enforces web-achievable exam hardening:
 *  · fullscreen enforcement (requestFullscreen; exit is a violation)
 *  · tab-visibility + window-blur detection (candidate left the tab/window)
 *  · copy / paste / context-menu prevention
 *  · periodic webcam snapshot (optional; degrades honestly if no camera)
 * Every violation is reported via onViolation so the parent can POST to ad_events.
 *
 * Scope boundary: OS-level secure browsers (screen-lock, process kill) are NOT
 * web-achievable — that is a scope boundary, not a gap.
 */
export type ProctoringViolationType = 'fullscreen_exit' | 'tab_hidden' | 'window_blur' | 'copy' | 'paste' | 'context_menu';
export interface ProctoringViolation { type: ProctoringViolationType; at: number }

export interface ProctoringGuardProps {
  active?: boolean;
  webcam?: boolean;
  snapshotEverySec?: number;
  onViolation?: (v: ProctoringViolation) => void;
  onSnapshot?: (dataUrl: string) => void;
  children: React.ReactNode;
}

export default function ProctoringGuard({
  active = true, webcam = false, snapshotEverySec = 30, onViolation, onSnapshot, children,
}: ProctoringGuardProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [violations, setViolations] = React.useState<ProctoringViolation[]>([]);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [camState, setCamState] = React.useState<'off' | 'on' | 'unavailable'>('off');

  const report = React.useCallback((type: ProctoringViolationType) => {
    const v = { type, at: Date.now() };
    setViolations((prev) => [...prev, v]);
    onViolation?.(v);
  }, [onViolation]);

  React.useEffect(() => {
    if (!active) return;
    const onVisibility = () => { if (document.hidden) report('tab_hidden'); };
    const onBlur = () => report('window_blur');
    const onCopy = () => report('copy');
    const onPaste = () => report('paste');
    const onContext = (e: Event) => { e.preventDefault(); report('context_menu'); };
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) report('fullscreen_exit');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, [active, report]);

  React.useEffect(() => {
    if (!active || !webcam) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
        setCamState('on');
      } catch { setCamState('unavailable'); }
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [active, webcam]);

  React.useEffect(() => {
    if (camState !== 'on') return;
    const t = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      try { onSnapshot?.(canvas.toDataURL('image/jpeg', 0.6)); } catch { /* tainted canvas — skip */ }
    }, Math.max(5, snapshotEverySec) * 1000);
    return () => clearInterval(t);
  }, [camState, snapshotEverySec, onSnapshot]);

  const enterFullscreen = React.useCallback(() => {
    rootRef.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  return (
    <div ref={rootRef} className="rounded-lg border bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: BRAND.primary }}>Proctored session</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={isFullscreen ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'}>
            {isFullscreen ? 'fullscreen' : 'windowed'}
          </Badge>
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
            {violations.length} violation{violations.length === 1 ? '' : 's'}
          </Badge>
        </div>
      </div>
      {active && (
        <div className="mb-2 flex items-center gap-2">
          {!isFullscreen && <Button size="sm" variant="outline" onClick={enterFullscreen}>Enter fullscreen</Button>}
          {webcam && camState === 'on' && <video ref={videoRef} className="h-12 w-16 rounded bg-slate-950" playsInline muted />}
          {webcam && camState === 'unavailable' && <span className="text-[11px] italic text-amber-700">webcam unavailable</span>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
