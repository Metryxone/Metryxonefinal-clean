export function AuroraSpark() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #0a1628 60%, #0d0f1a 100%)" }}>

      <style>{`
        @keyframes spark-float {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-8px) scale(1.04); }
        }
        @keyframes aurora-shimmer {
          0%   { opacity: 0.6; }
          50%  { opacity: 1; }
          100% { opacity: 0.6; }
        }
        @keyframes particle-drift {
          0%   { transform: translate(0,0); opacity: 1; }
          100% { transform: translate(var(--dx,8px),var(--dy,-20px)); opacity: 0; }
        }
        @keyframes glow-pulse {
          0%,100% { filter: blur(18px); opacity: 0.5; }
          50%      { filter: blur(24px); opacity: 0.85; }
        }
        .spark-icon { animation: spark-float 3s ease-in-out infinite; }
        .aurora-glow { animation: glow-pulse 2.5s ease-in-out infinite; }
        .p1 { --dx:-12px; --dy:-22px; animation: particle-drift 1.8s ease-out infinite 0s; }
        .p2 { --dx: 14px; --dy:-18px; animation: particle-drift 1.8s ease-out infinite 0.3s; }
        .p3 { --dx:-6px;  --dy:-26px; animation: particle-drift 1.8s ease-out infinite 0.6s; }
        .p4 { --dx: 8px;  --dy:-20px; animation: particle-drift 1.8s ease-out infinite 0.9s; }
        .shimmer { animation: aurora-shimmer 2s ease-in-out infinite; }
      `}</style>

      <div style={{ position: "relative", width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="aurora-glow" style={{
          position: "absolute", inset: -10,
          background: "radial-gradient(ellipse, rgba(46,196,182,0.6) 0%, rgba(139,92,246,0.4) 40%, transparent 70%)",
          borderRadius: "50%", zIndex: 0
        }} />

        <div style={{ position: "absolute", top: 8, left: "50%", marginLeft: -3 }}>
          <div className="p1" style={{ width: 5, height: 5, borderRadius: "50%", background: "#2EC4B6" }} />
        </div>
        <div style={{ position: "absolute", top: 12, left: "65%" }}>
          <div className="p2" style={{ width: 4, height: 4, borderRadius: "50%", background: "#a78bfa" }} />
        </div>
        <div style={{ position: "absolute", top: 6, left: "35%" }}>
          <div className="p3" style={{ width: 3, height: 3, borderRadius: "50%", background: "#7dd3fc" }} />
        </div>
        <div style={{ position: "absolute", top: 15, left: "55%" }}>
          <div className="p4" style={{ width: 3, height: 3, borderRadius: "50%", background: "#2EC4B6" }} />
        </div>

        <div className="spark-icon" style={{
          width: 82, height: 82, borderRadius: 24,
          background: "linear-gradient(135deg, #1D3E8B 0%, #0f172a 100%)",
          boxShadow: "0 0 0 1px rgba(46,196,182,0.25), 0 8px 40px rgba(46,196,182,0.3), 0 0 80px rgba(139,92,246,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", position: "relative", zIndex: 2
        }}>
          <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
            <defs>
              <linearGradient id="sg1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2EC4B6" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
              <linearGradient id="sg2" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7dd3fc" />
                <stop offset="100%" stopColor="#2EC4B6" />
              </linearGradient>
            </defs>
            <path d="M22 4 L14 22 L20 22 L18 38 L28 18 L22 18 Z" fill="url(#sg1)" className="shimmer" />
            <path d="M22 4 L28 18 L22 18" fill="url(#sg2)" opacity="0.7" />
            <circle cx="22" cy="21" r="14" stroke="url(#sg1)" strokeWidth="0.5" fill="none" opacity="0.3" />
          </svg>
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#a78bfa", fontFamily: "system-ui", fontWeight: 700, letterSpacing: 3, fontSize: 11, textTransform: "uppercase" }}>
          Aurora Spark
        </p>
        <p style={{ color: "#374151", fontFamily: "system-ui", fontSize: 10, marginTop: 4 }}>
          Dynamic · Vibrant · Instant
        </p>
      </div>
    </div>
  );
}
