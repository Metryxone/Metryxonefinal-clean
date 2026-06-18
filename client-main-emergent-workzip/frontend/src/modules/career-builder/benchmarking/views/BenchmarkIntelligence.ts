/**
 * Benchmark Intelligence Module View
 * Aggregated output type for the Benchmark Intelligence tab/panel.
 * Combines peer, geo, salary, percentile, industry, and experience benchmarks
 * with explainable scoring for rendering in the Career Builder UI.
 */

import type { BenchmarkIntelligenceOutput } from '@/lib/engines/benchmarkIntelligenceEngine';
import type { ExplainableScore }            from '@/lib/engines/explainableScoringEngine';
import type { BenchmarkBar }               from '@/components/career/visualizations/BenchmarkComparison';
import type { RadarDataPoint }             from '@/components/career/visualizations/RadarChart';

export interface BenchmarkIntelligenceView {
  benchmark:        BenchmarkIntelligenceOutput;
  explainableEI:    ExplainableScore;

  /* Pre-computed chart data — pass directly to visualization components */
  radarData:        RadarDataPoint[];         // for RadarChart
  comparisonBars:   BenchmarkBar[];           // for BenchmarkComparison
  percentile:       number;                   // for PercentileGraph

  /* Insight cards */
  highlights:       BenchmarkHighlight[];
  actionItems:      BenchmarkAction[];

  /* Summary line for compact display */
  summaryLine:      string;
}

export interface BenchmarkHighlight {
  id:      string;
  label:   string;
  value:   string;
  delta?:  string;
  trend:   'up' | 'down' | 'neutral';
  color:   string;
}

export interface BenchmarkAction {
  priority: 'high' | 'medium' | 'low';
  action:   string;
  impact:   string;
  category: string;
}

/** Build a BenchmarkIntelligenceView from engine outputs. */
export function buildBenchmarkView(
  benchmark:     BenchmarkIntelligenceOutput,
  explainableEI: ExplainableScore,
  competencyLevels: Record<string, number>,
): BenchmarkIntelligenceView {
  /* Radar data — 7 domain scores (average of competencies per domain) */
  const domainGroups: Record<string, string[]> = {
    Technical:     ['programming', 'systems-design', 'cloud', 'data-engineering', 'security'],
    Analytical:    ['data-analysis', 'statistics', 'business-acumen', 'research'],
    Communication: ['writing', 'presentation', 'stakeholder-mgmt'],
    Leadership:    ['people-mgmt', 'strategy', 'mentoring'],
    Creative:      ['design-thinking', 'visual-design', 'storytelling'],
    Execution:     ['project-mgmt', 'process', 'negotiation'],
    Behavioral:    ['drive', 'collaboration', 'resilience'],
  };
  const radarData: RadarDataPoint[] = Object.entries(domainGroups).map(([label, ids]) => {
    const avg   = ids.reduce((s, id) => s + (competencyLevels[id] ?? 0), 0) / ids.length;
    const bench = 2.5 / 5 * 100;   // benchmark at level 2.5 for all domains
    return { label, value: Math.round((avg / 5) * 100), benchmark: bench };
  });

  /* Comparison bars */
  const comparisonBars: BenchmarkBar[] = [
    { label: 'vs Peers',      userValue: benchmark.peer.userEI,          benchValue: benchmark.peer.peerAvgEI,        maxValue: 100 },
    { label: 'vs Industry',   userValue: benchmark.industry.userEI,      benchValue: benchmark.industry.industryAvgEI, maxValue: 100 },
    { label: 'vs Experience', userValue: benchmark.experience.actualEI,  benchValue: benchmark.experience.expectedEI,  maxValue: 100 },
  ];

  /* Highlights */
  const highlights: BenchmarkHighlight[] = [
    {
      id: 'percentile', label: 'Peer Percentile',
      value: `${benchmark.peer.percentile}th`,
      delta: benchmark.peer.delta >= 0 ? `+${benchmark.peer.delta} vs avg` : `${benchmark.peer.delta} vs avg`,
      trend: benchmark.peer.delta >= 0 ? 'up' : 'down', color: '#344E86',
    },
    {
      id: 'salary', label: 'Est. Salary',
      value: `₹${benchmark.geo.adjustedSalary.p50} LPA`,
      delta: `${benchmark.geo.city}`,
      trend: 'neutral', color: '#16a34a',
    },
    {
      id: 'industry', label: `vs ${benchmark.industry.industry}`,
      value: benchmark.industry.standing === 'top' ? 'Top Quartile' :
             benchmark.industry.standing === 'above-avg' ? 'Above Average' :
             benchmark.industry.standing === 'avg' ? 'Average' : 'Below Average',
      delta: `${benchmark.industry.delta >= 0 ? '+' : ''}${benchmark.industry.delta} pts`,
      trend: benchmark.industry.delta >= 0 ? 'up' : 'down', color: '#8b5cf6',
    },
    {
      id: 'experience', label: 'Experience Curve',
      value: benchmark.experience.accelerated ? 'Accelerated' : 'On Track',
      delta: `${benchmark.experience.delta >= 0 ? '+' : ''}${benchmark.experience.delta} pts`,
      trend: benchmark.experience.accelerated ? 'up' : benchmark.experience.delta >= -5 ? 'neutral' : 'down',
      color: '#f4a261',
    },
  ];

  /* Action items from explainable score */
  const actionItems: BenchmarkAction[] = explainableEI.opportunities.slice(0, 4).map((o, i) => ({
    priority: i === 0 ? 'high' as const : i === 1 ? 'medium' as const : 'low' as const,
    action:   o.action,
    impact:   `+${o.scoreImpact} EI pts`,
    category: o.category,
  }));

  return {
    benchmark, explainableEI, radarData, comparisonBars,
    percentile: benchmark.percentile.overall,
    highlights, actionItems,
    summaryLine: benchmark.summary,
  };
}
