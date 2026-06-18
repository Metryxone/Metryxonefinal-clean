/**
 * SectionBackground — drop-in animated background layer for plain sections
 * Choose a variant to get coordinated orbs, grid, and accent effects.
 * Usage:
 *   <section className="relative overflow-hidden">
 *     <SectionBackground variant="teal" />
 *     <div className="relative z-10">...content...</div>
 *   </section>
 */
import React from "react";

type Variant = "teal" | "navy" | "amber" | "mesh" | "aurora";

export function SectionBackground({ variant = "mesh" }: { variant?: Variant }) {
  return (
    <>
      {variant === "teal" && (
        <>
          <div aria-hidden className="pointer-events-none absolute -top-20 -left-20 h-[360px] w-[360px] rounded-full bg-[#4ECDC4]/30 blur-[90px]" />
          <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-20 h-[320px] w-[320px] rounded-full bg-[#344E86]/25 blur-[90px]" />
        </>
      )}

      {variant === "navy" && (
        <>
          <div aria-hidden className="pointer-events-none absolute top-10 -right-20 h-[420px] w-[420px] rounded-full bg-[#344E86]/35 blur-[100px]" />
          <div aria-hidden className="pointer-events-none absolute bottom-0 -left-10 h-[340px] w-[340px] rounded-full bg-[#4ECDC4]/25 blur-[100px]" />
        </>
      )}

      {variant === "amber" && (
        <>
          <div aria-hidden className="pointer-events-none absolute top-0 left-1/4 h-[380px] w-[380px] rounded-full bg-[#FFD166]/30 blur-[100px]" />
          <div aria-hidden className="pointer-events-none absolute bottom-0 right-1/4 h-[340px] w-[340px] rounded-full bg-[#FF6B9D]/25 blur-[100px]" />
        </>
      )}

      {variant === "aurora" && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#4ECDC4] to-transparent opacity-70" />
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{
            background: "radial-gradient(1200px 500px at 50% -10%, rgba(78,205,196,0.20), transparent 60%), radial-gradient(900px 400px at 80% 90%, rgba(52,78,134,0.20), transparent 60%), radial-gradient(700px 400px at 10% 80%, rgba(255,209,102,0.15), transparent 60%)",
          }} />
        </>
      )}

      {variant === "mesh" && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{
            background: "radial-gradient(800px 400px at 15% 20%, rgba(78,205,196,0.18), transparent 60%), radial-gradient(700px 360px at 85% 30%, rgba(52,78,134,0.18), transparent 60%), radial-gradient(600px 340px at 50% 90%, rgba(255,209,102,0.12), transparent 60%)",
          }} />
        </>
      )}

      {/* Subtle dot pattern — common to all variants */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.25] dark:opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(52,78,134,0.20) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          maskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
        }}
      />

      {/* Floating specks */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute left-[10%] top-[25%] block h-1.5 w-1.5 rounded-full bg-[#4ECDC4] shadow-[0_0_18px_4px_rgba(78,205,196,0.55)] animate-pulse" />
        <span className="absolute right-[15%] top-[60%] block h-1.5 w-1.5 rounded-full bg-[#344E86] shadow-[0_0_16px_4px_rgba(52,78,134,0.55)] animate-pulse [animation-delay:0.8s]" />
        <span className="absolute left-[55%] top-[80%] block h-1 w-1 rounded-full bg-[#FFD166] shadow-[0_0_14px_3px_rgba(255,209,102,0.6)] animate-pulse [animation-delay:1.5s]" />
      </div>
    </>
  );
}
