import { useEffect, useState } from 'react';

interface MetryxBotProps {
  size?: number;
  animate?: boolean;
  variant?: 'default' | 'floating' | 'inline' | 'header';
  className?: string;
}

export function MetryxBot({ size = 40, animate = true, variant = 'default', className = '' }: MetryxBotProps) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!animate) return;
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 800);
    }, 4000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [animate]);

  const showLabel = false; // label removed per design spec

  const iconSize  = showLabel ? size * 0.72 : size;
  const totalH    = showLabel ? size : size;
  const labelSize = Math.max(8, Math.round(iconSize * 0.22));

  const cx = iconSize / 2;
  const cy = iconSize / 2;
  const r  = iconSize * 0.44;

  const dot1x = cx - iconSize * 0.14;
  const dot2x = cx + iconSize * 0.14;
  const dotY  = cy + iconSize * 0.02;
  const dotR  = iconSize * 0.08;

  const tailPath = `M ${cx - r * 0.55} ${cy + r * 0.78}
    L ${cx - r * 0.75} ${cy + r * 1.26}
    L ${cx - r * 0.18} ${cy + r * 0.82} Z`;

  return (
    <div
      className={`inline-flex flex-col items-center justify-center flex-shrink-0 ${className}`}
      style={{
        width:  showLabel ? size : size,
        height: showLabel ? totalH : size,
        transition: 'transform 0.5s ease',
        ...(animate && pulse
          ? { transform: 'scale(1.06)', transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)' }
          : {}),
      }}
    >
      {/* Icon — teal circle + white dots + speech-bubble tail */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox={`0 0 ${iconSize} ${iconSize}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Teal filled circle */}
        <circle cx={cx} cy={cy} r={r} fill="#2EC4B6" />

        {/* Speech-bubble tail (teal, bottom-left) */}
        <path d={tailPath} fill="#2EC4B6" />

        {/* White dot — left */}
        <circle cx={dot1x} cy={dotY} r={dotR} fill="#ffffff" />

        {/* White dot — right */}
        <circle cx={dot2x} cy={dotY} r={dotR} fill="#ffffff" />
      </svg>

      {/* "Chatbot" label — only on floating button */}
      {showLabel && (
        <span style={{
          marginTop: Math.round(iconSize * 0.08),
          fontSize:  labelSize,
          fontWeight: 700,
          color: '#1D3E8B',
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '0.3px',
          lineHeight: 1,
          userSelect: 'none',
        }}>
          MetryxAI
        </span>
      )}
    </div>
  );
}
