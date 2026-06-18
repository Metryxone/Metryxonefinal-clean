export function NeuralPulse() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ background: "linear-gradient(135deg,#0a0f1e 0%,#111827 100%)" }}>

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes node-glow {
          0%,100% { opacity: 0.4; r: 3; }
          50%      { opacity: 1;   r: 5; }
        }
        @keyframes edge-flow {
          0%   { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes float {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-6px); }
        }
        .pulse-ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 2px solid #2EC4B6; animation: pulse-ring 2s ease-out infinite;
        }
        .pulse-ring:nth-child(2) { animation-delay: 0.66s; border-color: #1D3E8B; }
        .pulse-ring:nth-child(3) { animation-delay: 1.33s; border-color: #2EC4B6; }
        .n1 { animation: node-glow 1.6s ease-in-out infinite; }
        .n2 { animation: node-glow 1.6s ease-in-out infinite 0.3s; }
        .n3 { animation: node-glow 1.6s ease-in-out infinite 0.6s; }
        .n4 { animation: node-glow 1.6s ease-in-out infinite 0.9s; }
        .n5 { animation: node-glow 1.6s ease-in-out infinite 1.2s; }
        .n6 { animation: node-glow 1.6s ease-in-out infinite 0.5s; }
        .e1 { stroke-dasharray: 12 12; animation: edge-flow 1.2s linear infinite; }
        .e2 { stroke-dasharray: 12 12; animation: edge-flow 1.2s linear infinite 0.4s; }
        .e3 { stroke-dasharray: 12 12; animation: edge-flow 1.2s linear infinite 0.8s; }
        .icon-wrap { animation: float 3s ease-in-out infinite; }
      `}</style>

      <div style={{ position: "relative", width: 88, height: 88 }}>
        <div className="pulse-ring" />
        <div className="pulse-ring" />
        <div className="pulse-ring" />

        <div className="icon-wrap" style={{
          width: 88, height: 88, borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, #1D3E8B, #0a0f2e)",
          boxShadow: "0 0 32px rgba(46,196,182,0.5), 0 0 64px rgba(29,62,139,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer"
        }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <line x1="12" y1="12" x2="24" y2="24" stroke="#2EC4B6" strokeWidth="1.5" className="e1" />
            <line x1="36" y1="12" x2="24" y2="24" stroke="#2EC4B6" strokeWidth="1.5" className="e2" />
            <line x1="12" y1="36" x2="24" y2="24" stroke="#2EC4B6" strokeWidth="1.5" className="e3" />
            <line x1="36" y1="36" x2="24" y2="24" stroke="#2EC4B6" strokeWidth="1.5" className="e1" />
            <line x1="12" y1="12" x2="36" y2="12" stroke="#1D3E8B" strokeWidth="1" opacity="0.6" className="e2" />
            <line x1="12" y1="36" x2="36" y2="36" stroke="#1D3E8B" strokeWidth="1" opacity="0.6" className="e3" />
            <circle cx="24" cy="24" r="4" fill="#2EC4B6" className="n1" />
            <circle cx="12" cy="12" r="3" fill="#2EC4B6" className="n2" />
            <circle cx="36" cy="12" r="3" fill="#2EC4B6" className="n3" />
            <circle cx="12" cy="36" r="3" fill="#2EC4B6" className="n4" />
            <circle cx="36" cy="36" r="3" fill="#2EC4B6" className="n5" />
            <circle cx="24" cy="8"  r="2.5" fill="#6ad4ce" className="n6" />
          </svg>
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#2EC4B6", fontFamily: "system-ui", fontWeight: 700, letterSpacing: 3, fontSize: 11, textTransform: "uppercase" }}>
          Neural Pulse
        </p>
        <p style={{ color: "#4B5563", fontFamily: "system-ui", fontSize: 10, marginTop: 4 }}>
          AI · Intelligent · Connected
        </p>
      </div>
    </div>
  );
}
