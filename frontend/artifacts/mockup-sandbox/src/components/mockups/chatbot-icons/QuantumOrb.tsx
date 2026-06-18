export function QuantumOrb() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #0d1f3c 0%, #060912 100%)" }}>

      <style>{`
        @keyframes orbit1 {
          from { transform: rotate(0deg) translateX(46px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(46px) rotate(-360deg); }
        }
        @keyframes orbit2 {
          from { transform: rotate(120deg) translateX(38px) rotate(-120deg); }
          to   { transform: rotate(480deg) translateX(38px) rotate(-480deg); }
        }
        @keyframes orbit3 {
          from { transform: rotate(240deg) translateX(52px) rotate(-240deg); }
          to   { transform: rotate(600deg) translateX(52px) rotate(-600deg); }
        }
        @keyframes orb-breathe {
          0%,100% { box-shadow: 0 0 28px rgba(46,196,182,0.6), 0 0 60px rgba(29,62,139,0.5), inset 0 0 20px rgba(46,196,182,0.2); }
          50%      { box-shadow: 0 0 42px rgba(46,196,182,0.9), 0 0 90px rgba(29,62,139,0.7), inset 0 0 30px rgba(46,196,182,0.35); }
        }
        @keyframes ring-spin {
          from { transform: rotateX(70deg) rotateZ(0deg); }
          to   { transform: rotateX(70deg) rotateZ(360deg); }
        }
        @keyframes ring-spin2 {
          from { transform: rotateX(20deg) rotateY(60deg) rotateZ(0deg); }
          to   { transform: rotateX(20deg) rotateY(60deg) rotateZ(-360deg); }
        }
        .dot1 { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: #2EC4B6; top: 50%; left: 50%; margin: -3px; animation: orbit1 3s linear infinite; box-shadow: 0 0 8px #2EC4B6; }
        .dot2 { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: #7dd3fc; top: 50%; left: 50%; margin: -2.5px; animation: orbit2 4.5s linear infinite; box-shadow: 0 0 8px #7dd3fc; }
        .dot3 { position: absolute; width: 4px; height: 4px; border-radius: 50%; background: #a78bfa; top: 50%; left: 50%; margin: -2px; animation: orbit3 2.8s linear infinite; box-shadow: 0 0 6px #a78bfa; }
        .orb { animation: orb-breathe 2.4s ease-in-out infinite; }
      `}</style>

      <div style={{ position: "relative", width: 110, height: 110, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="dot1" />
        <div className="dot2" />
        <div className="dot3" />

        <div className="orb" style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #2a4a8a 0%, #0d1f3c 50%, #060912 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", position: "relative", zIndex: 2,
          border: "1px solid rgba(46,196,182,0.3)"
        }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M18 6 L30 30 L6 30 Z" fill="none" stroke="rgba(46,196,182,0.3)" strokeWidth="0.5" />
            <circle cx="18" cy="18" r="10" stroke="#2EC4B6" strokeWidth="1" fill="none" opacity="0.5" strokeDasharray="3 3" />
            <circle cx="18" cy="18" r="5" fill="rgba(46,196,182,0.2)" />
            <circle cx="18" cy="18" r="2.5" fill="#2EC4B6" />
            <path d="M18 8 L18 28 M8 18 L28 18" stroke="rgba(46,196,182,0.2)" strokeWidth="0.5" />
          </svg>
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#7dd3fc", fontFamily: "system-ui", fontWeight: 700, letterSpacing: 3, fontSize: 11, textTransform: "uppercase" }}>
          Quantum Orb
        </p>
        <p style={{ color: "#374151", fontFamily: "system-ui", fontSize: 10, marginTop: 4 }}>
          Precise · Intelligent · Responsive
        </p>
      </div>
    </div>
  );
}
