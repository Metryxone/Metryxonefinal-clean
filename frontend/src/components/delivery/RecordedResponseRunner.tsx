import React from 'react';
import { BRAND } from '@/design-system/tokens';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

/**
 * RecordedResponseRunner — first-class VIDEO / audio recorded-response delivery
 * mode (GAP-AD-2). Uses the browser MediaRecorder API to capture a candidate's
 * spoken/video answer to a prompt. onCommit fires with the recorded Blob + its
 * duration so the parent can upload it and persist to ad_responses.
 *
 * Degrades HONESTLY: if getUserMedia / MediaRecorder is unavailable the runner
 * surfaces an explicit unsupported state (null ≠ 0) rather than pretending.
 * Blob URLs are revoked on unmount only (a shown <video> keeps its src alive).
 */
export interface RecordedResponseRunnerProps {
  prompt: string;
  mode?: 'video' | 'audio';
  maxSeconds?: number;
  onCommit?: (payload: { blob: Blob; durationSec: number; mimeType: string }) => void;
}

export default function RecordedResponseRunner({ prompt, mode = 'video', maxSeconds = 120, onCommit }: RecordedResponseRunnerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const startedAtRef = React.useRef<number>(0);
  const urlRef = React.useRef<string | null>(null);

  const [state, setState] = React.useState<'idle' | 'recording' | 'recorded' | 'unsupported'>('idle');
  const [elapsed, setElapsed] = React.useState(0);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof (window as any).MediaRecorder !== 'undefined';
    if (!supported) setState('unsupported');
  }, []);

  React.useEffect(() => {
    if (state !== 'recording') return;
    const t = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(secs);
      if (secs >= maxSeconds) stop();
    }, 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, maxSeconds]);

  React.useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const start = React.useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(mode === 'video' ? { video: true, audio: true } : { audio: true });
      streamRef.current = stream;
      if (mode === 'video' && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => undefined);
      }
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const mimeType = rec.mimeType || (mode === 'video' ? 'video/webm' : 'audio/webm');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPreviewUrl(url);
        setState('recorded');
        const durationSec = Math.floor((Date.now() - startedAtRef.current) / 1000);
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        onCommit?.({ blob, durationSec, mimeType });
      };
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      setElapsed(0);
      rec.start();
      setState('recording');
    } catch (e: any) {
      setError(e?.message ?? 'Could not access media devices');
      setState('idle');
    }
  }, [mode, onCommit]);

  const stop = React.useCallback(() => {
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
  }, []);

  if (state === 'unsupported') {
    return (
      <div className="rounded-lg border bg-white p-3">
        <p className="text-xs text-amber-700 italic">Recorded-response capture is not supported in this browser (MediaRecorder unavailable).</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: BRAND.primary }}>Recorded response · {mode}</span>
        <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">MediaRecorder</Badge>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{prompt}</p>
      {mode === 'video' && state !== 'recorded' && (
        <video ref={videoRef} className="mb-2 aspect-video w-full rounded-md bg-slate-950" playsInline />
      )}
      {state === 'recorded' && previewUrl && (
        mode === 'video'
          ? <video src={previewUrl} controls className="mb-2 aspect-video w-full rounded-md bg-slate-950" />
          : <audio src={previewUrl} controls className="mb-2 w-full" />
      )}
      <div className="flex items-center gap-2">
        {state === 'idle' && <Button size="sm" onClick={start}>Start recording</Button>}
        {state === 'recording' && (
          <>
            <Button size="sm" variant="destructive" onClick={stop}>Stop</Button>
            <span className="text-xs font-semibold text-red-600">● {elapsed}s / {maxSeconds}s</span>
          </>
        )}
        {state === 'recorded' && <Button size="sm" variant="outline" onClick={() => setState('idle')}>Re-record</Button>}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
