export function CrystallineAI() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ background: "linear-gradient(145deg, #f7f9fc 0%, #eef2f8 100%)" }}>

      <style>{`
        @keyframes crystal-hover {
          0%,100% { transform: translateY(0) rotate(0deg); }
          33%      { transform: translateY(-5px) rotate(1.5deg); }
          66%      { transform: translateY(-3px) rotate(-1deg); }
        }
        @keyframes facet-shimmer {
          0%,100% { opacity: 0.08; }
          50%      { opacity: 0.22; }
        }
        @keyframes inner-glow {
          0%,100% { opacity: 0.7; }
          50%      { opacity: 1; }
        }
        @keyframes dot-blink {
          0%,80%,100% { opacity: 0.3; transform: scale(0.85); }
          40%          { opacity: 1;   transform: scale(1.15); }
        }
        .crystal { animation: crystal-hover 4s ease-in-out infinite; }
        .f1 { animation: facet-shimmer 3s ease-in-out infinite 0s; }
        .f2 { animation: facet-shimmer 3s ease-in-out infinite 1s; }
        .f3 { animation: facet-shimmer 3s ease-in-out infinite 2s; }
        .ig { animation: inner-glow 2s ease-in-out infinite; }
        .d1 { animation: dot-blink 1.4s ease-in-out infinite 0s; }
        .d2 { animation: dot-blink 1.4s ease-in-out infinite 0.25s; }
        .d3 { animation: dot-blink 1.4s ease-in-out infinite 0.5s; }
      `}</style>

      <div style={{ position: "relative" }}>
        <div style={{
          position: "absolute", inset: -16,
          background: "radial-gradient(ellipse, rgba(29,62,139,0.1) 0%, transparent 70%)",
          borderRadius: "50%", pointerEvents: "none"
        }} />

        <div className="crystal" style={{
          width: 84, height: 84, borderRadius: 22,
          background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,246,255,0.9) 100%)",
          boxShadow: "0 2px 4px rgba(29,62,139,0.06), 0 8px 32px rgba(29,62,139,0.14), 0 24px 48px rgba(29,62,139,0.08), inset 0 1px 0 rgba(255,255,255,1)",
          border: "1px solid rgba(29,62,139,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", position: "relative", overflow: "hidden"
        }}>
          <div className="f1" style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(46,196,182,0.15) 0%, transparent 60%)", borderRadius: 22 }} />
          <div className="f2" style={{ position: "absolute", inset: 0, background: "linear-gradient(225deg, rgba(29,62,139,0.12) 0%, transparent 50%)", borderRadius: 22 }} />
          <div className="f3" style={{ position: "absolute", bottom: 0, right: 0, width: "60%", height: "60%", background: "linear-gradient(315deg, rgba(46,196,182,0.1) 0%, transparent 70%)", borderRadius: 22 }} />

          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" className="ig" style={{ position: "relative", zIndex: 1 }}>
            <defs>
              <linearGradient id="cg1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1D3E8B" />
                <stop offset="100%" stopColor="#2EC4B6" />
              </linearGradient>
            </defs>
            <path d="M10 14 L22 7 L34 14 L34 30 L22 37 L10 30 Z" fill="none" stroke="url(#cg1)" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M10 14 L22 21 L34 14" stroke="url(#cg1)" strokeWidth="1" opacity="0.4" />
            <path d="M22 21 L22 37" stroke="url(#cg1)" strokeWidth="1" opacity="0.4" />
            <circle cx="22" cy="22" r="4" fill="url(#cg1)" opacity="0.85" />
            <g>
              <circle cx="15" cy="26" r="1.8" fill="#1D3E8B" className="d1" />
              <circle cx="22" cy="26" r="1.8" fill="#1D3E8B" className="d2" />
              <circle cx="29" cy="26" r="1.8" fill="#1D3E8B" className="d3" />
            </g>
          </svg>
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#1D3E8B", fontFamily: "system-ui", fontWeight: 700, letterSpacing: 3, fontSize: 11, textTransform: "uppercase" }}>
          Crystalline AI
        </p>
        <p style={{ color: "#9CA3AF", fontFamily: "system-ui", fontSize: 10, marginTop: 4 }}>
          Elegant · Clear · Premium
        </p>
      </div>
    </div>
  );
}
