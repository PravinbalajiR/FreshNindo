// FreshRoute — Supply-chain helpers shared by the Farmer, Retailer and Manager portals.
// Pure functions: merge retailer orders into market demand, track order coverage,
// and summarise the optimizer's decision for each route.

import type { Destination, InventoryBatch, RetailerOrder, Route } from '../data/dataset';
import type { Allocation, FeasibilityStatus, Plan } from '../types';
import { checkFeasibility } from './optimizer';
import { FEASIBILITY_CONFIG } from '../data/dataset';

/** Retailer orders add to the base market demand at their destination. */
export function withOrderDemand(destinations: Destination[], orders: RetailerOrder[]): Destination[] {
  return destinations.map((d) => {
    const demand = { ...d.demand_by_commodity };
    for (const o of orders) {
      if (o.destination_id !== d.destination_id) continue;
      demand[o.commodity] = (demand[o.commodity] ?? 0) + o.quantity_kg;
    }
    return { ...d, demand_by_commodity: demand };
  });
}

export type OrderStatus = 'COVERED' | 'PARTIAL' | 'WAITING';

export interface OrderCoverage {
  order: RetailerOrder;
  covered_kg: number;
  status: OrderStatus;
  allocations: Allocation[];
}

/**
 * Explicit orders are served before anonymous market demand, oldest first.
 * Allocated kg for (destination, commodity) is poured into orders in that order.
 */
export function orderCoverage(orders: RetailerOrder[], plan: Plan | null): OrderCoverage[] {
  const pool: Record<string, number> = {};
  const allocsByKey: Record<string, Allocation[]> = {};
  for (const a of plan?.allocations ?? []) {
    const key = `${a.destination.destination_id}|${a.batch.commodity}`;
    pool[key] = (pool[key] ?? 0) + a.quantity_kg;
    (allocsByKey[key] ??= []).push(a);
  }
  return [...orders]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((order) => {
      const key = `${order.destination_id}|${order.commodity}`;
      const covered = Math.min(order.quantity_kg, pool[key] ?? 0);
      pool[key] = (pool[key] ?? 0) - covered;
      const status: OrderStatus =
        covered >= order.quantity_kg ? 'COVERED' : covered > 0 ? 'PARTIAL' : 'WAITING';
      return { order, covered_kg: covered, status, allocations: allocsByKey[key] ?? [] };
    });
}

export type RouteDecisionStatus = 'CHOSEN' | 'TIME_SENSITIVE' | 'BLOCKED' | 'UNUSED';

export interface RouteDecision {
  route: Route;
  destination: Destination;
  status: RouteDecisionStatus;
  allocations: Allocation[];
  shipped_kg: number;
  /** Batches that cannot make it to this market before spoiling. */
  rejected: { batch: InventoryBatch; margin_hours: number }[];
  summary: string;
}

export function routeDecisions(
  routes: Route[],
  destinations: Destination[],
  batches: InventoryBatch[],
  plan: Plan | null
): RouteDecision[] {
  return routes.flatMap((route) => {
    const destination = destinations.find((d) => d.destination_id === route.destination_id);
    if (!destination) return [];
    const allocations = (plan?.allocations ?? []).filter((a) => a.route.route_id === route.route_id);
    const shipped_kg = allocations.reduce((s, a) => s + a.quantity_kg, 0);
    const rejected = batches
      .map((batch) => ({ batch, f: checkFeasibility(batch, route, destination) }))
      .filter((x) => x.f.status === 'INFEASIBLE' && (destination.demand_by_commodity[x.batch.commodity] ?? 0) > 0)
      .map((x) => ({ batch: x.batch, margin_hours: x.f.usable_margin_hours }));

    let status: RouteDecisionStatus;
    let summary: string;
    if (!route.available) {
      status = 'BLOCKED';
      summary = 'Route is unavailable (vehicle or road disruption). The optimizer sent nothing this way.';
    } else if (allocations.length === 0) {
      status = 'UNUSED';
      summary = 'Not used: other markets give a better net return per kg for the stock available.';
    } else if (allocations.some((a) => a.feasibility.status === 'TIME_SENSITIVE')) {
      status = 'TIME_SENSITIVE';
      summary = `Chosen for ${allocations.length} load(s), but at least one arrives with under ${FEASIBILITY_CONFIG.ready_margin_hours}h of shelf life left. Dispatch first.`;
    } else {
      status = 'CHOSEN';
      summary = `Chosen for ${allocations.length} load(s), all arriving with a comfortable freshness margin.`;
    }
    return [{ route, destination, status, allocations, shipped_kg, rejected, summary }];
  });
}

export const ROUTE_STATUS_META: Record<RouteDecisionStatus, { label: string; color: string; dash?: string }> = {
  CHOSEN: { label: 'Chosen', color: '#1f9d55' },
  TIME_SENSITIVE: { label: 'Chosen · urgent', color: '#d98a00' },
  BLOCKED: { label: 'Blocked', color: '#d93025', dash: '8 8' },
  UNUSED: { label: 'Not used', color: '#9aa0a6', dash: '2 8' },
};

/** Freshness colour for a batch: its planned allocation status, else raw shelf life. */
export function batchFreshness(batch: InventoryBatch, plan: Plan | null): FeasibilityStatus {
  const allocs = plan?.allocations.filter((a) => a.batch.batch_id === batch.batch_id) ?? [];
  if (allocs.length > 0) {
    return allocs.some((a) => a.feasibility.status === 'TIME_SENSITIVE') ? 'TIME_SENSITIVE' : 'READY';
  }
  if (batch.remaining_shelf_life_hours < 10) return 'INFEASIBLE';
  if (batch.remaining_shelf_life_hours < 24) return 'TIME_SENSITIVE';
  return 'READY';
}

export const FRESHNESS_COLOR: Record<FeasibilityStatus, string> = {
  READY: '#34c759',
  TIME_SENSITIVE: '#ff9f0a',
  INFEASIBLE: '#ff3b30',
};
