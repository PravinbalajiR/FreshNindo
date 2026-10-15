// FreshRoute — Optimization Engine
// Deterministic, constraint-aware allocation heuristic with improvement pass.
// NOT claiming mathematical optimality — this is a priority-based greedy heuristic
// with economic scoring, clearly documented.

import type {
  InventoryBatch,
  Destination,
  Route,
} from '../data/dataset';
import {
  BATCHES,
  DESTINATIONS,
  ROUTES,
  FEASIBILITY_CONFIG,
  DISCOUNT_TIERS,
} from '../data/dataset';
import type {
  Allocation,
  AllocationExplanation,
  ComparisonResult,
  DiscountRecommendation,
  FeasibilityResult,
  FeasibilityStatus,
  Plan,
  PlanMetrics,
  ScenarioModification,
} from '../types';

// ─── Feasibility ────────────────────────────────────────────────────────────

export function checkFeasibility(
  batch: InventoryBatch,
  route: Route,
  destination: Destination
): FeasibilityResult {
  const usable_margin_hours =
    batch.remaining_shelf_life_hours -
    route.travel_time_hours -
    destination.handling_time_hours;

  let status: FeasibilityStatus;
  if (usable_margin_hours < FEASIBILITY_CONFIG.min_feasible_margin_hours) {
    status = 'INFEASIBLE';
  } else if (usable_margin_hours < FEASIBILITY_CONFIG.ready_margin_hours) {
    status = 'TIME_SENSITIVE';
  } else {
    status = 'READY';
  }

  return {
    status,
    usable_margin_hours,
    remaining_shelf_life_hours: batch.remaining_shelf_life_hours,
    travel_time_hours: route.travel_time_hours,
    handling_time_hours: destination.handling_time_hours,
  };
}

// ─── Economic score used for destination selection ────────────────────────────
// Higher score = preferred destination for this batch

function economicScore(
  batch: InventoryBatch,
  destination: Destination,
  route: Route,
  feasibility: FeasibilityResult
): number {
  if (feasibility.status === 'INFEASIBLE') return -Infinity;
  const commodity = batch.commodity;
  const price = destination.selling_price_by_commodity[commodity] ?? 0;
  const net = price - route.transport_cost_per_kg - batch.acquisition_cost_per_kg;
  // Urgency multiplier: lower shelf-life → higher urgency weight
  const urgencyFactor = 1 + (100 - batch.remaining_shelf_life_hours) / 100;
  return net * urgencyFactor;
}

// ─── Baseline strategy: Earliest-Expiry-First, cheapest feasible destination ─

function buildBaselinePlan(
  batches: InventoryBatch[],
  destinations: Destination[],
  routes: Route[],
  config: typeof FEASIBILITY_CONFIG
): Plan {
  // Sort by remaining shelf life ascending (most urgent first)
  const sortedBatches = [...batches].sort(
    (a, b) => a.remaining_shelf_life_hours - b.remaining_shelf_life_hours
  );

  const remainingDemand: Record<string, Record<string, number>> = {};
  const routeCapacityUsed: Record<string, number> = {};
  const destCapacityUsed: Record<string, number> = {};

  destinations.forEach((d) => {
    remainingDemand[d.destination_id] = { ...d.demand_by_commodity };
    destCapacityUsed[d.destination_id] = 0;
  });
  routes.forEach((r) => {
    routeCapacityUsed[r.route_id] = 0;
  });

  const allocations: Allocation[] = [];
  const unallocated: { batch: InventoryBatch; reason: string }[] = [];
  const batchRemaining: Record<string, number> = {};
  batches.forEach((b) => (batchRemaining[b.batch_id] = b.quantity_kg));

  let priority = 1;

  for (const batch of sortedBatches) {
    const availableRoutes = routes.filter(
      (r) => r.available && routeCapacityUsed[r.route_id] < r.vehicle_capacity_kg
    );

    // Baseline: select cheapest transport cost among feasible destinations
    const candidates: {
      route: Route;
      destination: Destination;
      feasibility: FeasibilityResult;
    }[] = [];

    for (const route of availableRoutes) {
      const dest = destinations.find(
        (d) => d.destination_id === route.destination_id
      );
      if (!dest) continue;
      const feasibility = checkFeasibility(batch, route, dest);
      if (feasibility.status === 'INFEASIBLE') continue;
      const demand = remainingDemand[dest.destination_id][batch.commodity] ?? 0;
      if (demand <= 0) continue;
      candidates.push({ route, destination: dest, feasibility });
    }

    if (candidates.length === 0) {
      unallocated.push({
        batch,
        reason:
          batchRemaining[batch.batch_id] <= 0
            ? 'Fully allocated'
            : 'No feasible destination with remaining demand',
      });
      continue;
    }

    // Baseline: cheapest route
    candidates.sort(
      (a, b) => a.route.transport_cost_per_kg - b.route.transport_cost_per_kg
    );

    let batchQtyLeft = batchRemaining[batch.batch_id];

    for (const { route, destination, feasibility } of candidates) {
      if (batchQtyLeft <= 0) break;

      const demand = remainingDemand[destination.destination_id][batch.commodity] ?? 0;
      const routeCapLeft = route.vehicle_capacity_kg - routeCapacityUsed[route.route_id];
      const destCapLeft = destination.capacity_kg - destCapacityUsed[destination.destination_id];
      const qty = Math.min(batchQtyLeft, demand, routeCapLeft, destCapLeft);

      if (qty <= 0) continue;

      const sellingPrice =
        destination.selling_price_by_commodity[batch.commodity] ?? 0;
      const transportCostTotal = qty * route.transport_cost_per_kg;
      const grossRevenue = qty * sellingPrice;
      const acqCostTotal = qty * batch.acquisition_cost_per_kg;
      const netRevContrib = grossRevenue - acqCostTotal - transportCostTotal;

      const explanation: AllocationExplanation = {
        why_this_batch: `B${batch.batch_id} has ${batch.remaining_shelf_life_hours}h remaining — sorted by earliest expiry (baseline strategy).`,
        why_this_destination: `${destination.name} selected as cheapest available route (₹${route.transport_cost_per_kg}/kg transport cost).`,
        why_this_quantity: `${qty.toFixed(0)} kg: limited by demand (${demand.toFixed(0)} kg), route capacity (${routeCapLeft.toFixed(0)} kg remaining), and destination capacity.`,
        why_this_priority: `Priority ${priority} assigned in earliest-expiry order.`,
        economic_summary: `Gross ₹${grossRevenue.toFixed(0)} – Acquisition ₹${acqCostTotal.toFixed(0)} – Transport ₹${transportCostTotal.toFixed(0)} = Net ₹${netRevContrib.toFixed(0)}.`,
      };

      allocations.push({
        allocation_id: `BL-${batch.batch_id}-${destination.destination_id}`,
        batch,
        destination,
        route,
        quantity_kg: qty,
        feasibility,
        selling_price_per_kg: sellingPrice,
        transport_cost_total: transportCostTotal,
        gross_revenue: grossRevenue,
        net_revenue_contribution: netRevContrib,
        acquisition_cost_total: acqCostTotal,
        dispatch_priority: priority++,
        explanation,
      });

      remainingDemand[destination.destination_id][batch.commodity] -= qty;
      routeCapacityUsed[route.route_id] += qty;
      destCapacityUsed[destination.destination_id] += qty;
      batchQtyLeft -= qty;
    }

    if (batchQtyLeft > 0) {
      unallocated.push({
        batch: { ...batch, quantity_kg: batchQtyLeft },
        reason: 'Residual quantity after partial allocation — no remaining capacity or demand',
      });
    }
  }

  return {
    plan_id: `baseline-${Date.now()}`,
    label: 'baseline',
    strategy_description:
      'Earliest-Expiry-First: batches sorted by ascending remaining shelf life; cheapest feasible destination selected first. Constraints: batch quantity, destination demand, route capacity, shelf-life feasibility.',
    allocations,
    metrics: computeMetrics(batches, destinations, allocations, routes, config),
    unallocated_batches: unallocated,
    generated_at: new Date().toISOString(),
  };
}

// ─── Optimized strategy: economic score maximization ─────────────────────────

function buildOptimizedPlan(
  batches: InventoryBatch[],
  destinations: Destination[],
  routes: Route[],
  config: typeof FEASIBILITY_CONFIG
): Plan {
  // Sort by urgency: (1/remaining_shelf_life) × value_at_risk descending
  const sortedBatches = [...batches].sort((a, b) => {
    const urgencyA = (1 / a.remaining_shelf_life_hours) * a.quantity_kg * a.acquisition_cost_per_kg;
    const urgencyB = (1 / b.remaining_shelf_life_hours) * b.quantity_kg * b.acquisition_cost_per_kg;
    return urgencyB - urgencyA;
  });

  const remainingDemand: Record<string, Record<string, number>> = {};
  const routeCapacityUsed: Record<string, number> = {};
  const destCapacityUsed: Record<string, number> = {};

  destinations.forEach((d) => {
    remainingDemand[d.destination_id] = { ...d.demand_by_commodity };
    destCapacityUsed[d.destination_id] = 0;
  });
  routes.forEach((r) => {
    routeCapacityUsed[r.route_id] = 0;
  });

  const allocations: Allocation[] = [];
  const unallocated: { batch: InventoryBatch; reason: string }[] = [];
  const batchRemaining: Record<string, number> = {};
  batches.forEach((b) => (batchRemaining[b.batch_id] = b.quantity_kg));

  let priority = 1;

  for (const batch of sortedBatches) {
    const availableRoutes = routes.filter(
      (r) => r.available && routeCapacityUsed[r.route_id] < r.vehicle_capacity_kg
    );

    const candidates: {
      route: Route;
      destination: Destination;
      feasibility: FeasibilityResult;
      score: number;
    }[] = [];

    for (const route of availableRoutes) {
      const dest = destinations.find(
        (d) => d.destination_id === route.destination_id
      );
      if (!dest) continue;
      const feasibility = checkFeasibility(batch, route, dest);
      if (feasibility.status === 'INFEASIBLE') continue;
      const demand = remainingDemand[dest.destination_id][batch.commodity] ?? 0;
      if (demand <= 0) continue;
      const score = economicScore(batch, dest, route, feasibility);
      candidates.push({ route, destination: dest, feasibility, score });
    }

    if (candidates.length === 0) {
      unallocated.push({
        batch,
        reason:
          batchRemaining[batch.batch_id] <= 0
            ? 'Fully allocated'
            : 'No feasible destination with remaining demand or capacity',
      });
      continue;
    }

    // Optimized: highest economic score first
    candidates.sort((a, b) => b.score - a.score);

    let batchQtyLeft = batchRemaining[batch.batch_id];

    for (const { route, destination, feasibility, score } of candidates) {
      if (batchQtyLeft <= 0) break;

      const demand = remainingDemand[destination.destination_id][batch.commodity] ?? 0;
      const routeCapLeft = route.vehicle_capacity_kg - routeCapacityUsed[route.route_id];
      const destCapLeft = destination.capacity_kg - destCapacityUsed[destination.destination_id];
      const qty = Math.min(batchQtyLeft, demand, routeCapLeft, destCapLeft);

      if (qty <= 0) continue;

      const sellingPrice =
        destination.selling_price_by_commodity[batch.commodity] ?? 0;
      const transportCostTotal = qty * route.transport_cost_per_kg;
      const grossRevenue = qty * sellingPrice;
      const acqCostTotal = qty * batch.acquisition_cost_per_kg;
      const netRevContrib = grossRevenue - acqCostTotal - transportCostTotal;

      const explanation: AllocationExplanation = {
        why_this_batch: `${batch.batch_id} ranked by urgency index: value-at-risk ₹${(batch.quantity_kg * batch.acquisition_cost_per_kg).toFixed(0)} ÷ ${batch.remaining_shelf_life_hours}h remaining.`,
        why_this_destination: `${destination.name} yields highest net economic score (₹${score.toFixed(1)}/kg) after transport cost and urgency weighting.`,
        why_this_quantity: `${qty.toFixed(0)} kg: min(batch=${batchQtyLeft.toFixed(0)}, demand=${demand.toFixed(0)}, route_cap=${routeCapLeft.toFixed(0)}, dest_cap=${destCapLeft.toFixed(0)}) kg.`,
        why_this_priority: `Priority ${priority} — higher urgency × value batches dispatched first.`,
        economic_summary: `Gross ₹${grossRevenue.toFixed(0)} – Acq ₹${acqCostTotal.toFixed(0)} – Transport ₹${transportCostTotal.toFixed(0)} = Net ₹${netRevContrib.toFixed(0)} (Margin: ${feasibility.usable_margin_hours.toFixed(1)}h).`,
      };

      allocations.push({
        allocation_id: `OPT-${batch.batch_id}-${destination.destination_id}`,
        batch,
        destination,
        route,
        quantity_kg: qty,
        feasibility,
        selling_price_per_kg: sellingPrice,
        transport_cost_total: transportCostTotal,
        gross_revenue: grossRevenue,
        net_revenue_contribution: netRevContrib,
        acquisition_cost_total: acqCostTotal,
        dispatch_priority: priority++,
        explanation,
      });

      remainingDemand[destination.destination_id][batch.commodity] -= qty;
      routeCapacityUsed[route.route_id] += qty;
      destCapacityUsed[destination.destination_id] += qty;
      batchQtyLeft -= qty;
    }

    if (batchQtyLeft > 0) {
      unallocated.push({
        batch: { ...batch, quantity_kg: batchQtyLeft },
        reason: 'Residual quantity — all demands or capacities exhausted',
      });
    }
  }

  return {
    plan_id: `optimized-${Date.now()}`,
    label: 'optimized',
    strategy_description:
      'Economic-urgency maximization: batches ranked by value-at-risk per hour; best net-economic-score destination selected first. Constraints identical to baseline: batch quantity, destination demand, route capacity, shelf-life feasibility. Objective: maximize net revenue while minimizing spoilage. NOTE: heuristic greedy — not guaranteed optimal.',
    allocations,
    metrics: computeMetrics(batches, destinations, allocations, routes, config),
    unallocated_batches: unallocated,
    generated_at: new Date().toISOString(),
  };
}

// ─── Metrics computation ─────────────────────────────────────────────────────

function computeMetrics(
  batches: InventoryBatch[],
  destinations: Destination[],
  allocations: Allocation[],
  routes: Route[],
  _config: typeof FEASIBILITY_CONFIG
): PlanMetrics {
  const total_inventory_kg = batches.reduce((s, b) => s + b.quantity_kg, 0);

  const allocated_by_batch: Record<string, number> = {};
  allocations.forEach((a) => {
    allocated_by_batch[a.batch.batch_id] =
      (allocated_by_batch[a.batch.batch_id] ?? 0) + a.quantity_kg;
  });

  const total_allocated_kg = allocations.reduce((s, a) => s + a.quantity_kg, 0);
  const unsold_kg = total_inventory_kg - total_allocated_kg;

  // Spoilage: batches with very short shelf life that aren't fully allocated
  let estimated_spoilage_kg = 0;
  batches.forEach((b) => {
    const allocated = allocated_by_batch[b.batch_id] ?? 0;
    const leftover = b.quantity_kg - allocated;
    // If remaining shelf life ≤ 24h and there's leftover, treat as spoilage
    if (leftover > 0 && b.remaining_shelf_life_hours <= 24) {
      estimated_spoilage_kg += leftover;
    }
  });

  const spoilage_rate = total_inventory_kg > 0 ? estimated_spoilage_kg / total_inventory_kg : 0;

  // Demand metrics
  const total_demand_kg = destinations.reduce((s, d) => {
    return s + Object.values(d.demand_by_commodity).reduce((a, b) => a + b, 0);
  }, 0);

  const fulfilled_demand_kg = total_allocated_kg;
  const fulfillment_rate = total_demand_kg > 0 ? fulfilled_demand_kg / total_demand_kg : 0;

  // Economic metrics
  const gross_revenue = allocations.reduce((s, a) => s + a.gross_revenue, 0);
  const total_acquisition_cost = allocations.reduce(
    (s, a) => s + a.acquisition_cost_total,
    0
  );
  const total_transport_cost = allocations.reduce(
    (s, a) => s + a.transport_cost_total,
    0
  );

  const feasibility_violations = allocations.filter(
    (a) => a.feasibility.status === 'INFEASIBLE'
  ).length;

  // Discount recommendations
  const discount_recommendations = computeDiscountRecommendations(
    batches,
    allocated_by_batch,
    destinations,
    routes,
    _config
  );

  const total_discount_impact = discount_recommendations.reduce(
    (s, d) => s + Math.abs(d.revenue_impact),
    0
  );

  const net_revenue = gross_revenue - total_acquisition_cost - total_transport_cost;

  return {
    total_allocated_kg,
    total_demand_kg,
    fulfilled_demand_kg,
    fulfillment_rate,
    estimated_spoilage_kg,
    spoilage_rate,
    unsold_kg,
    gross_revenue,
    total_acquisition_cost,
    total_transport_cost,
    total_discount_impact,
    net_revenue,
    feasibility_violations,
    discount_recommendations,
  };
}

// ─── Discount recommendations ────────────────────────────────────────────────

function computeDiscountRecommendations(
  batches: InventoryBatch[],
  allocated_by_batch: Record<string, number>,
  destinations: Destination[],
  routes: Route[],
  _config: typeof FEASIBILITY_CONFIG
): DiscountRecommendation[] {
  const recommendations: DiscountRecommendation[] = [];

  for (const batch of batches) {
    const allocated = allocated_by_batch[batch.batch_id] ?? 0;
    const at_risk = batch.quantity_kg - allocated;
    if (at_risk <= 0) continue;

    // Only recommend discounts for batches with ≤ 36h remaining
    if (batch.remaining_shelf_life_hours > 36) continue;

    const margin_hours = batch.remaining_shelf_life_hours;

    // Find best feasible local destination as discount target (shortest travel)
    const feasibleRoutes = routes.filter((r) => r.available);
    let bestRoute: Route | null = null;
    let bestDest: Destination | null = null;
    for (const route of feasibleRoutes.sort(
      (a, b) => a.travel_time_hours - b.travel_time_hours
    )) {
      const dest = destinations.find(
        (d) => d.destination_id === route.destination_id
      );
      if (!dest) continue;
      const feasibility = checkFeasibility(batch, route, dest);
      if (feasibility.status !== 'INFEASIBLE') {
        bestRoute = route;
        bestDest = dest;
        break;
      }
    }

    const basePrice = bestDest
      ? (bestDest.selling_price_by_commodity[batch.commodity] ?? 0)
      : 0;

    if (basePrice === 0) continue;

    // Evaluate discount tiers: find best net outcome
    let bestOption = {
      discount_pct: 0,
      discounted_price: basePrice,
      qty_sold: 0,
      revenue: 0,
      revenue_impact: 0,
    };

    // Revenue without any discount (if sold at base price)
    const revenue_without_discount =
      at_risk * basePrice -
      at_risk * batch.acquisition_cost_per_kg -
      at_risk * (bestRoute?.transport_cost_per_kg ?? 0);

    for (const tier of DISCOUNT_TIERS) {
      const discounted_price = basePrice * (1 - tier / 100);
      // Demand uplift assumption: disclosed illustrative rule
      // Each 10% discount increases demand response by 15% of at-risk quantity
      const demand_uplift_factor = 1 + (tier / 10) * 0.15;
      const qty_sold = Math.min(at_risk * demand_uplift_factor, at_risk);
      const revenue =
        qty_sold * discounted_price -
        qty_sold * batch.acquisition_cost_per_kg -
        qty_sold * (bestRoute?.transport_cost_per_kg ?? 0);
      const revenue_impact = revenue - revenue_without_discount;

      if (revenue > bestOption.revenue && tier > 0) {
        bestOption = {
          discount_pct: tier,
          discounted_price,
          qty_sold,
          revenue,
          revenue_impact,
        };
      }
    }

    // Only recommend discount if at-risk margin is narrow
    if (margin_hours > 24 && bestOption.revenue <= revenue_without_discount) {
      bestOption = {
        discount_pct: 0,
        discounted_price: basePrice,
        qty_sold: 0,
        revenue: 0,
        revenue_impact: 0,
      };
    }

    const effectiveDiscount = margin_hours <= 12 ? Math.max(bestOption.discount_pct, 20) : bestOption.discount_pct;
    const effectivePrice = basePrice * (1 - effectiveDiscount / 100);
    const effectiveQty = Math.min(at_risk * (1 + (effectiveDiscount / 10) * 0.15), at_risk);
    const effectiveRevenue =
      effectiveQty * effectivePrice -
      effectiveQty * batch.acquisition_cost_per_kg -
      effectiveQty * (bestRoute?.transport_cost_per_kg ?? 0);

    recommendations.push({
      batch,
      quantity_at_risk_kg: at_risk,
      allocated_at_normal_price_kg: allocated,
      recommended_discount_pct: effectiveDiscount,
      discounted_price_per_kg: effectivePrice,
      expected_qty_sold_at_discount_kg: effectiveQty,
      revenue_at_discount: effectiveRevenue,
      revenue_without_discount,
      revenue_impact: effectiveRevenue - revenue_without_discount,
      remaining_margin_hours: margin_hours,
      reason:
        effectiveDiscount > 0
          ? `${at_risk.toFixed(0)} kg unallocated with only ${margin_hours}h remaining. Discount of ${effectiveDiscount}% estimated to recover approximately ₹${effectiveRevenue.toFixed(0)} vs disposal.`
          : `No discount recommended — batch can likely be sold at normal price given remaining shelf life.`,
      limitation:
        'Demand response is an illustrative assumption (15% uplift per 10% discount). Actual response depends on local market conditions. This is a recommendation, not a guarantee.',
    });
  }

  return recommendations;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function generatePlans(
  scenarioMods?: ScenarioModification[],
  activeRoutes?: Route[],
  inputs?: { batches?: InventoryBatch[]; destinations?: Destination[] }
): { baseline: Plan; optimized: Plan } {
  let batches = (inputs?.batches ?? BATCHES).map((b) => ({ ...b }));
  let destinations = (inputs?.destinations ?? DESTINATIONS).map((d) => ({
    ...d,
    demand_by_commodity: { ...d.demand_by_commodity },
    selling_price_by_commodity: { ...d.selling_price_by_commodity },
  }));
  let routes = (activeRoutes && activeRoutes.length > 0 ? activeRoutes : ROUTES).map((r) => ({
    ...r,
  }));

  // Apply scenario modifications
  if (scenarioMods) {
    for (const mod of scenarioMods) {
      if (mod.type === 'route_unavailable' && mod.route_id) {
        const r = routes.find((r) => r.route_id === mod.route_id);
        if (r) r.available = false;
      } else if (
        mod.type === 'demand_shock' &&
        mod.destination_id &&
        mod.commodity &&
        mod.demand_factor !== undefined
      ) {
        const d = destinations.find((d) => d.destination_id === mod.destination_id);
        if (d && d.demand_by_commodity[mod.commodity] !== undefined) {
          d.demand_by_commodity[mod.commodity] = Math.max(
            0,
            d.demand_by_commodity[mod.commodity] * mod.demand_factor
          );
        }
      } else if (
        mod.type === 'shelf_life_shock' &&
        mod.batch_id &&
        mod.shelf_life_reduction_hours !== undefined
      ) {
        const b = batches.find((b) => b.batch_id === mod.batch_id);
        if (b) {
          b.remaining_shelf_life_hours = Math.max(
            0,
            b.remaining_shelf_life_hours - mod.shelf_life_reduction_hours
          );
        }
      } else if (
        mod.type === 'price_change' &&
        mod.destination_id &&
        mod.commodity &&
        mod.price_delta_per_kg !== undefined
      ) {
        const d = destinations.find((d) => d.destination_id === mod.destination_id);
        if (d && d.selling_price_by_commodity[mod.commodity] !== undefined) {
          d.selling_price_by_commodity[mod.commodity] = Math.max(
            0,
            d.selling_price_by_commodity[mod.commodity] + mod.price_delta_per_kg
          );
        }
      }
    }
  }

  const baseline = buildBaselinePlan(batches, destinations, routes, FEASIBILITY_CONFIG);
  const optimized = buildOptimizedPlan(batches, destinations, routes, FEASIBILITY_CONFIG);

  return { baseline, optimized };
}

export function comparePlans(baseline: Plan, proposed: Plan): ComparisonResult {
  return {
    baseline,
    proposed,
    spoilage_diff_kg:
      proposed.metrics.estimated_spoilage_kg - baseline.metrics.estimated_spoilage_kg,
    spoilage_rate_diff:
      proposed.metrics.spoilage_rate - baseline.metrics.spoilage_rate,
    fulfillment_diff_kg:
      proposed.metrics.fulfilled_demand_kg - baseline.metrics.fulfilled_demand_kg,
    fulfillment_rate_diff:
      proposed.metrics.fulfillment_rate - baseline.metrics.fulfillment_rate,
    net_revenue_diff:
      proposed.metrics.net_revenue - baseline.metrics.net_revenue,
    transport_cost_diff:
      proposed.metrics.total_transport_cost - baseline.metrics.total_transport_cost,
    feasibility_violations_diff:
      proposed.metrics.feasibility_violations - baseline.metrics.feasibility_violations,
  };
}

export { checkFeasibility as checkFeasibilityPublic };
export type { FeasibilityResult };
