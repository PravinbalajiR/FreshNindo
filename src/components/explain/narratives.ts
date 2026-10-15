// Plain-English sentences computed from the real plan numbers. No AI involved.
import type { Destination } from '../../data/dataset';
import type { ComparisonResult, Plan, ScenarioModification } from '../../types';
import { formatINR, formatKg } from '../shared';
import { outOfTen, type FlowSegment } from './PlainWords';

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Biggest unmet demand by crop, e.g. "Tomatoes (620 kg short)". */
function biggestShortfall(plan: Plan, destinations: Destination[]): string | null {
  const demand: Record<string, number> = {};
  const got: Record<string, number> = {};
  destinations.forEach((d) => Object.entries(d.demand_by_commodity).forEach(([c, kg]) => (demand[c] = (demand[c] ?? 0) + kg)));
  plan.allocations.forEach((a) => (got[a.batch.commodity] = (got[a.batch.commodity] ?? 0) + a.quantity_kg));
  const worst = Object.keys(demand)
    .map((c) => ({ c, short: demand[c] - (got[c] ?? 0) }))
    .sort((a, b) => b.short - a.short)[0];
  return worst && worst.short > 0 ? `${worst.c.toLowerCase()} (${formatKg(worst.short)} short)` : null;
}

export function planPoints(plan: Plan, destinations: Destination[], flow: FlowSegment[]): string[] {
  const m = plan.metrics;
  const markets = new Set(plan.allocations.map((a) => a.destination.destination_id)).size;
  const first = [...plan.allocations].sort((a, b) => a.dispatch_priority - b.dispatch_priority)[0];
  const short = biggestShortfall(plan, destinations);
  return [
    outOfTen(flow),
    `Trucks carry ${formatKg(m.total_allocated_kg)} to ${markets} markets. After paying for the produce and transport, that leaves about ${formatINR(m.net_revenue)}.`,
    m.fulfillment_rate >= 0.999
      ? 'Every market gets everything it asked for.'
      : `Markets get ${pct(m.fulfillment_rate)} of what they asked for. ${short ? `The biggest gap is ${short}: there isn't enough fresh stock of it.` : ''}`.trim(),
    first
      ? `The first truck should leave with ${first.batch.commodity.toLowerCase()} (${first.batch.batch_id}) for ${first.destination.region}: it will still have ${first.feasibility.usable_margin_hours.toFixed(0)} hours of freshness when it arrives.`
      : 'Nothing is being shipped yet.',
  ];
}

export function dispatchPoints(plan: Plan): string[] {
  const sorted = [...plan.allocations].sort((a, b) => a.dispatch_priority - b.dispatch_priority);
  const urgent = sorted.filter((a) => a.feasibility.status === 'TIME_SENSITIVE');
  const best = [...plan.allocations].sort((a, b) => b.net_revenue_contribution - a.net_revenue_contribution)[0];
  return [
    `This is the loading list: ${sorted.length} loads, in the order trucks should leave (#1 first).`,
    urgent.length
      ? `${urgent.length} load${urgent.length > 1 ? 's are' : ' is'} cutting it close (amber): ${urgent.slice(0, 3).map((a) => `${a.batch.commodity.toLowerCase()} to ${a.destination.region}`).join(', ')}. ${urgent.length > 1 ? 'They' : 'It'} must not be delayed.`
      : 'Every load arrives with plenty of freshness to spare.',
    best ? `The most valuable load is ${best.batch.commodity.toLowerCase()} to ${best.destination.region}, earning about ${formatINR(best.net_revenue_contribution)} after costs.` : '',
    'Click any row to see, in six short reasons, why that batch goes to that market.',
  ].filter(Boolean);
}

export function impactPoints(c: ComparisonResult): string[] {
  const money = c.net_revenue_diff;
  const waste = -c.spoilage_diff_kg;
  const filled = c.fulfillment_diff_kg;
  return [
    'We compared our plan with a simple rule many depots use: send the oldest stock first, on the cheapest truck. Same stock, same trucks, same prices.',
    money >= 0 ? `Our plan keeps ${formatINR(money)} more money after costs.` : `Our plan earns ${formatINR(-money)} less. The simple rule wins on money here.`,
    waste > 0.5 ? `${formatKg(waste)} less produce goes bad.` : waste < -0.5 ? `${formatKg(-waste)} more produce goes bad than with the simple rule.` : 'Both plans waste about the same amount.',
    filled > 0.5 ? `Markets receive ${formatKg(filled)} more of what they ordered.` : filled < -0.5 ? `Markets receive ${formatKg(-filled)} less of what they ordered.` : 'Both plans fill about the same share of orders.',
  ];
}

export function scenarioPoints(base: Plan, scenario: Plan | null, mods: ScenarioModification[]): string[] {
  if (!scenario) {
    return [
      'This is a practice area: pick a problem (a truck breaks down, a market wants less, produce ripens faster) and see how the plan would change.',
      'Applying one switches the Dispatch list to the new plan until you press Reset.',
    ];
  }
  const b = base.metrics;
  const s = scenario.metrics;
  const moneyDiff = s.net_revenue - b.net_revenue;
  const moved = scenario.allocations.filter(
    (a) => !base.allocations.some((x) => x.batch.batch_id === a.batch.batch_id && x.destination.destination_id === a.destination.destination_id)
  ).length;
  return [
    `What happened: ${mods.map((m) => m.description).join('; ')}.`,
    `The plan was rebuilt from scratch. ${moved} load${moved === 1 ? ' was' : 's were'} sent somewhere new.`,
    moneyDiff < 0 ? `This problem costs about ${formatINR(-moneyDiff)} compared with a normal day.` : `Money after costs is about the same or better (${formatINR(moneyDiff)}).`,
    s.estimated_spoilage_kg > b.estimated_spoilage_kg
      ? `${formatKg(s.estimated_spoilage_kg - b.estimated_spoilage_kg)} more produce is now at risk of going bad.`
      : 'No extra produce goes bad because of it.',
  ];
}
