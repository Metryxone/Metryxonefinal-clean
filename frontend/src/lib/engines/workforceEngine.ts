import type { CareerProfile } from '@/lib/careerIntelligence';
import { MARKET_CATALOG } from '@/data/marketCatalog';

export interface WorkforceInput {
  profile: CareerProfile | null | undefined;
  region?: string;
}

export interface WorkforceSignal {
  roleId:         string;
  roleTitle:      string;
  demandScore:    number;
  automationRisk: number;
  growth36mo:     number;
  openingsIndex:  number;
}

export interface WorkforceOutput {
  signals:       WorkforceSignal[];
  hotRoles:      WorkforceSignal[];
  safeRoles:     WorkforceSignal[];
  riskFlags:     WorkforceSignal[];
  marketSummary: string;
}

export function runWorkforceEngine(input: WorkforceInput): WorkforceOutput {
  const signals: WorkforceSignal[] = MARKET_CATALOG.map(role => ({
    roleId:         role.id,
    roleTitle:      role.title,
    demandScore:    role.demandScore,
    automationRisk: role.automationRisk,
    growth36mo:     role.growth36mo,
    openingsIndex:  Math.round(role.demandScore * 0.6 + role.growth36mo * 0.4),
  }));

  const hotRoles  = [...signals].sort((a, b) => b.openingsIndex - a.openingsIndex).slice(0, 5);
  const safeRoles = [...signals].sort((a, b) => a.automationRisk - b.automationRisk).slice(0, 5);
  const riskFlags = signals.filter(s => s.automationRisk >= 60).slice(0, 5);

  const avgDemand  = Math.round(signals.reduce((s, r) => s + r.demandScore, 0) / signals.length);
  const avgGrowth  = Math.round(signals.reduce((s, r) => s + r.growth36mo, 0) / signals.length);
  const marketSummary = `Market index: ${avgDemand}/100 demand · ${avgGrowth}% average 36-month growth`;

  return { signals, hotRoles, safeRoles, riskFlags, marketSummary };
}
