/**
 * LiveStatsPulse — floating "live activity" card for the landing hero.
 * Shows a pulsing counter of active learners, assessments today, and schools
 * that ticks every few seconds with subtle random increments so it feels live.
 */
import { useEffect, useState } from "react";
import { Activity, Users, GraduationCap } from "lucide-react";

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function LiveStatsPulse() {
  const [learners, setLearners] = useState(142);
  const [tests, setTests] = useState(1847);
  const [schools] = useState(127);

  useEffect(() => {
    const t = setInterval(() => {
      setLearners((n) => Math.max(120, n + rand(-2, 5)));
      setTests((n) => n + rand(0, 3));
    }, 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      data-testid="live-stats-pulse"
      className="pointer-events-auto hidden select-none lg:block"
      style={{
        position: "absolute",
        left: "50%",
        bottom: "-26px",
        transform: "translateX(-50%)",
        zIndex: 30,
      }}
    >
      <div className="group relative flex items-center gap-3 rounded-full border border-white/80 bg-white/95 px-5 py-2.5 shadow-[0_10px_30px_-10px_rgba(11,60,93,0.25)] ring-1 ring-[#4ECDC4]/30 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85">
        {/* Pulsing green dot */}
        <span className="relative inline-flex h-2.5 w-2.5 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
        </span>

        <div className="flex items-center gap-5 text-xs">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-[#344E86]" />
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Live now</div>
              <div className="font-bold tabular-nums text-slate-900 dark:text-white">{learners}</div>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[#4ECDC4]" />
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Tests today</div>
              <div className="font-bold tabular-nums text-slate-900 dark:text-white">{tests.toLocaleString("en-IN")}</div>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-[#F4A261]" />
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Schools</div>
              <div className="font-bold tabular-nums text-slate-900 dark:text-white">{schools}+</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
