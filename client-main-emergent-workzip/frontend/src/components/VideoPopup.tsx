import { useEffect, useRef } from 'react';

interface VideoPopupProps {
  title: string;
  embedUrl: string;
  onClose: () => void;
}

export function VideoPopup({ title, embedUrl, onClose }: VideoPopupProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<Element | null>(null);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const dialog = overlayRef.current?.querySelector('[role="dialog"]');
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (prevFocus.current instanceof HTMLElement) prevFocus.current.focus();
    };
  }, [onClose]);

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{ background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(8px)', animation: 'vpFadeIn 0.25s ease' }}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}>

      <div role="dialog" aria-modal="true" aria-labelledby="vp-title" style={{ width: 'min(800px, 92vw)', background: '#0d1117', borderRadius: 14, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', animation: 'vpSlideUp 0.3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#1D3E8B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#2EC4B6', background: 'rgba(46,196,182,0.15)', padding: '3px 8px', borderRadius: 4, flexShrink: 0 }}>VIDEO</span>
            <p id="vp-title" style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close video"
            style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
            ✕
          </button>
        </div>
        <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
          <iframe
            src={`${embedUrl}?autoplay=1&rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          />
        </div>
        <div style={{ padding: '10px 16px', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>MetryxOne · Behavioural Intelligence</span>
          <button onClick={onClose}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}>
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes vpFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes vpSlideUp { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>
    </div>
  );
}
