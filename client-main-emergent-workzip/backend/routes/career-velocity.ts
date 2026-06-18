/**
 * Career Velocity Routes — Phase 3
 * Learning velocity computation, growth acceleration, adaptability,
 * execution consistency, and improvement momentum. All logic self-contained.
 */

import type { Express } from 'express';

/* ── Learnability index ───────────────────────────────────────────── */
const LEARNABILITY: Record<string, number> = {
  'programming':78,'systems-design':58,'cloud':65,'data-engineering':62,'security':52,
  'data-analysis':80,'statistics':55,'business-acumen':70,'research':74,
  'writing':82,'presentation':76,'stakeholder-mgmt':62,
  'people-mgmt':55,'strategy':48,'mentoring':68,
  'design-thinking':84,'visual-design':70,'storytelling':72,
  'project-mgmt':75,'process':80,'negotiation':60,
  'drive':60,'collaboration':72,'resilience':55,
};

const ALL_COMPS = Object.keys(LEARNABILITY);

const DOMAIN_GROUPS: Record<string, string[]> = {
  technical:    ['programming','systems-design','cloud','data-engineering','security'],
  analytical:   ['data-analysis','statistics','business-acumen','research'],
  communication:['writing','presentation','stakeholder-mgmt'],
  leadership:   ['people-mgmt','strategy','mentoring'],
  creative:     ['design-thinking','visual-design','storytelling'],
  execution:    ['project-mgmt','process','negotiation'],
  behavioral:   ['drive','collaboration','resilience'],
};

const VELOCITY_BANDS = [
  { band:'elite',    minScore:80, description:'Top 10% of learners. Elite learning engine.',                 pctOfLearners:10 },
  { band:'high',     minScore:65, description:'Strong and consistent growth across domains.',                 pctOfLearners:20 },
  { band:'moderate', minScore:45, description:'Steady progress with room to accelerate.',                    pctOfLearners:40 },
  { band:'low',      minScore:25, description:'Below-average pace. Structured support recommended.',         pctOfLearners:20 },
  { band:'stalled',  minScore:0,  description:'Minimal measurable progress. Intensive intervention needed.', pctOfLearners:10 },
];

interface Snapshot {
  timestamp: number;
  competencyLevels: Record<string, number>;
  eiScore: number;
}

function computeVelocityFromSnapshots(
  snapshots:     Snapshot[],
  currentLevels: Record<string, number>,
  currentEI:     number,
): Record<string, number> {
  const ordered = [...snapshots].sort((a,b) => a.timestamp - b.timestamp);
  const hasHistory = ordered.length >= 2;

  /* Growth acceleration */
  let growthAcceleration = 0;
  if (hasHistory) {
    const mid   = Math.floor(ordered.length / 2);
    const first = ordered.slice(0, mid + 1);
    const sec   = ordered.slice(mid);
    const velHalf = (snaps: Snapshot[]) => {
      if (snaps.length < 2) return 0;
      const days = (snaps[snaps.length-1].timestamp - snaps[0].timestamp) / 86400000;
      const months = Math.max(0.1, days / 30.44);
      const totalDelta = ALL_COMPS.reduce((s,k) => s + ((snaps[snaps.length-1].competencyLevels[k]??0) - (snaps[0].competencyLevels[k]??0)), 0);
      return totalDelta / months;
    };
    growthAcceleration = Math.round(Math.max(-100, Math.min(100, (velHalf(sec) - velHalf(first)) * 20)));
  }

  /* Adaptability */
  const domainsActive = Object.entries(DOMAIN_GROUPS).filter(([, ids]) => ids.some(id => (currentLevels[id]??0) >= 2)).length;
  const adaptabilityScore = Math.round((domainsActive / 7) * 100);

  /* Execution consistency */
  let executionConsistency = 50;
  if (hasHistory) {
    const gains = ordered.slice(1).map((s,i) => s.eiScore - ordered[i].eiScore);
    const pos  = gains.filter(g => g >= 0).length;
    const mean = gains.reduce((s,v) => s+v, 0) / Math.max(1, gains.length);
    const var_ = gains.reduce((s,g) => s + (g-mean)**2, 0) / Math.max(1, gains.length);
    executionConsistency = Math.round(Math.min(100, (pos/gains.length)*60 + Math.max(0, 40 - Math.sqrt(var_)*3)));
  }

  /* Improvement momentum */
  let improvementMomentum = 50;
  if (ordered.length >= 3) {
    const recent = ordered.slice(-2);
    const hist   = ordered.slice(0, -1);
    const recentGain  = recent[1].eiScore - recent[0].eiScore;
    const historicAvg = hist.slice(1).reduce((s,sn,i) => s + sn.eiScore - hist[i].eiScore, 0) / Math.max(1, hist.length-1);
    improvementMomentum = Math.round(Math.min(100, Math.max(0, 50 + (recentGain - historicAvg) * 5)));
  } else if (hasHistory) {
    const gain = ordered[ordered.length-1].eiScore - ordered[0].eiScore;
    improvementMomentum = Math.round(Math.min(100, Math.max(0, 50 + gain * 2)));
  }

  /* Overall velocity */
  const overallVelocity = Math.round(Math.max(0,
    growthAcceleration * 0.25 + adaptabilityScore * 0.30 +
    executionConsistency * 0.25 + improvementMomentum * 0.20,
  ));
  const absVelocity = Math.round((overallVelocity + 100) / 2);

  /* Monthly level gain (for projections) */
  const monthlyLevelGain = hasHistory
    ? ALL_COMPS.reduce((s,k) => {
        const from  = ordered[0].competencyLevels[k] ?? 0;
        const to    = ordered[ordered.length-1].competencyLevels[k] ?? 0;
        const months= Math.max(0.1, (ordered[ordered.length-1].timestamp - ordered[0].timestamp) / (30.44*86400000));
        return s + Math.max(0, (to-from)/months);
      }, 0)
    : 0.5;

  return {
    overallVelocity: absVelocity,
    growthAcceleration,
    adaptabilityScore,
    executionConsistency,
    improvementMomentum,
    projectedLevels6mo: Math.round(monthlyLevelGain * 6 * 10) / 10,
    projectedEIGain6mo: Math.round(Math.min(30, (currentEI < 50 ? 8 : currentEI < 70 ? 5 : 3) * (absVelocity / 50))),
    domainsActive,
  };
}

/* ── Route registration ───────────────────────────────────────────── */
export function registerCareerVelocityRoutes(app: Express): void {

  /* POST /api/career/velocity/compute */
  app.post('/api/career/velocity/compute', (req, res) => {
    try {
      const { snapshots = [], currentLevels = {}, currentEI = 50 } = req.body as {
        snapshots?: Snapshot[];
        currentLevels?: Record<string, number>;
        currentEI?: number;
        targetEI?: number;
      };

      const metrics = computeVelocityFromSnapshots(snapshots, currentLevels, currentEI);
      const absVelocity = metrics.overallVelocity;
      const band = VELOCITY_BANDS.find(b => absVelocity >= b.minScore)?.band ?? 'stalled';

      const metricsList = [
        { id:'growth-accel', name:'Growth Acceleration', value:Math.round((metrics.growthAcceleration+100)/2), weight:0.25, trend:metrics.growthAcceleration>10?'accelerating':metrics.growthAcceleration<-10?'slowing':'steady', interpretation:metrics.growthAcceleration>10?'Learning pace is speeding up':metrics.growthAcceleration<-10?'Learning pace is slowing':'Consistent learning pace' },
        { id:'adaptability', name:'Adaptability', value:metrics.adaptabilityScore, weight:0.30, trend:metrics.domainsActive>=5?'accelerating':metrics.domainsActive>=3?'steady':'slowing', interpretation:`Active in ${metrics.domainsActive}/7 competency domains` },
        { id:'exec-consistency', name:'Execution Consistency', value:metrics.executionConsistency, weight:0.25, trend:metrics.executionConsistency>=70?'accelerating':metrics.executionConsistency>=45?'steady':'slowing', interpretation:metrics.executionConsistency>=70?'Highly consistent improvement':'Moderate consistency — add routine' },
        { id:'improvement-momentum', name:'Improvement Momentum', value:metrics.improvementMomentum, weight:0.20, trend:metrics.improvementMomentum>=60?'accelerating':metrics.improvementMomentum>=40?'steady':'slowing', interpretation:metrics.improvementMomentum>=60?'Recent momentum above historical average':'Momentum in line with history' },
      ];

      /* Bottlenecks */
      const bottlenecks = ALL_COMPS
        .filter(k => (currentLevels[k]??0) < 2 && (LEARNABILITY[k]??60) < 65)
        .slice(0, 3)
        .map(k => ({ competencyId:k, label:k, reason:'low-learnability', currentLevel:currentLevels[k]??0, recommendation:`Seek structured mentoring for ${k}` }));

      /* Accelerators */
      const accelerators = ALL_COMPS
        .filter(k => (currentLevels[k]??0) >= 2 && (LEARNABILITY[k]??60) >= 75)
        .sort((a,b) => (LEARNABILITY[b]??60)-(LEARNABILITY[a]??60))
        .slice(0, 3)
        .map(k => ({ competencyId:k, label:k, reason:'high-learnability', currentLevel:currentLevels[k]??0, suggestion:`Continue investing in ${k}` }));

      const coaching =
        band==='elite'    ? `Elite learning velocity — top 10%. Sustain and deepen in ${accelerators[0]?.label??'core areas'}.` :
        band==='high'     ? `Strong velocity. Focus on ${bottlenecks[0]?.label??'consistency'} to reach elite range.` :
        band==='moderate' ? `Moderate velocity. Add structured routine to accelerate.` :
        band==='low'      ? `Below-average velocity. An IDP with accountability partner is recommended.` :
                            `Growth stalled. Start with one high-learnability competency to rebuild momentum.`;

      res.json({
        overallVelocity: absVelocity, velocityBand: band,
        velocityBandLabel: band.charAt(0).toUpperCase() + band.slice(1),
        growthAcceleration: metrics.growthAcceleration,
        adaptabilityScore: metrics.adaptabilityScore,
        executionConsistency: metrics.executionConsistency,
        improvementMomentum: metrics.improvementMomentum,
        metrics: metricsList,
        projectedLevelsIn6Mo: metrics.projectedLevels6mo,
        projectedEIGainIn6Mo: metrics.projectedEIGain6mo,
        bottlenecks, accelerators,
        coachingInsight: coaching,
        nextFocusArea: accelerators[0]?.label ?? bottlenecks[0]?.label ?? 'Core competency development',
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  /* GET /api/career/velocity/bands */
  app.get('/api/career/velocity/bands', (_req, res) => {
    res.json({ bands: VELOCITY_BANDS });
  });

  /* POST /api/career/velocity/momentum */
  app.post('/api/career/velocity/momentum', (req, res) => {
    try {
      const { eiHistory = [] } = req.body as { eiHistory?: { score:number; timestamp:number }[] };
      if (eiHistory.length < 2) return res.json({ momentum:50, trend:'steady', narrative:'Need at least 2 data points for momentum analysis.' });
      const gains = eiHistory.slice(1).map((h,i) => h.score - eiHistory[i].score);
      const recentGain = gains[gains.length-1];
      const avgGain    = gains.reduce((s,v) => s+v, 0) / gains.length;
      const momentum   = Math.round(Math.min(100, Math.max(0, 50 + (recentGain - avgGain) * 5)));
      const trend      = recentGain > avgGain + 1 ? 'accelerating' : recentGain < avgGain - 1 ? 'slowing' : 'steady';
      const narrative  = trend==='accelerating' ? 'Recent momentum is above your historical average — excellent form.' :
                         trend==='slowing'       ? 'Recent momentum is below historical average — consider a refresh sprint.' :
                                                   'Momentum is steady and consistent.';
      res.json({ momentum, trend, narrative, avgGainPerPeriod: Math.round(avgGain*10)/10, recentGain, periods: eiHistory.length - 1 });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });

  /* POST /api/career/velocity/projection */
  app.post('/api/career/velocity/projection', (req, res) => {
    try {
      const { currentEI=50, velocityBand='moderate', horizonMonths=12 } = req.body as { currentEI?:number; velocityBand?:string; horizonMonths?:number };
      const gainPerMonth: Record<string,number> = { elite:2.5, high:1.8, moderate:1.2, low:0.7, stalled:0.2 };
      const rate = gainPerMonth[velocityBand] ?? 1.2;
      const points = [3,6,9,12,18,24].filter(m => m <= horizonMonths).map(mo => ({
        monthsFromNow: mo,
        projectedEI: Math.round(Math.min(95, currentEI + rate * mo)),
        confidencePct: mo <= 6 ? 85 : mo <= 12 ? 70 : 50,
      }));
      res.json({ currentEI, velocityBand, projectionPoints: points, monthlyGainRate: rate });
    } catch(e) { res.status(500).json({ error:String(e) }); }
  });
}
