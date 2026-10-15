// FreshRoute — Core Types
// Shared types used by the engine and UI layers

import type { InventoryBatch, Destination, Route } from '../data/dataset';

export type FeasibilityStatus = 'READY' | 'TIME_SENSITIVE' | 'INFEASIBLE';

export interface FeasibilityResult {
  status: FeasibilityStatus;
  usable_margin_hours: number;
  remaining_shelf_life_hours: number;
  travel_time_hours: number;
  handling_time_hours: number;
}

export interface Allocation {
  allocation_id: string;
  batch: InventoryBatch;
  destination: Destination;
  route: Route;
  quantity_kg: number;
  feasibility: FeasibilityResult;
  selling_price_per_kg: number;
  transport_cost_total: number;
  gross_revenue: number;
  net_revenue_contribution: number;
  acquisition_cost_total: number;
  dispatch_priority: number; // 1 = highest
  explanation: AllocationExplanation;
}

export interface AllocationExplanation {
  why_this_batch: string;
  why_this_destination: string;
  why_this_quantity: string;
  why_this_priority: string;
  economic_summary: string;
  discount_note?: string;
}

export interface DiscountRecommendation {
  batch: InventoryBatch;
  quantity_at_risk_kg: number;
  allocated_at_normal_price_kg: number;
  recommended_discount_pct: number;
  discounted_price_per_kg: number;
  expected_qty_sold_at_discount_kg: number;
  revenue_at_discount: number;
  revenue_without_discount: number;
  revenue_impact: number;
  remaining_margin_hours: number;
  reason: string;
  limitation: string;
}

export interface PlanMetrics {
  total_allocated_kg: number;
  total_demand_kg: number;
  fulfilled_demand_kg: number;
  fulfillment_rate: number;
  estimated_spoilage_kg: number;
  spoilage_rate: number;
  unsold_kg: number;
  gross_revenue: number;
  total_acquisition_cost: number;
  total_transport_cost: number;
  total_discount_impact: number;
  net_revenue: number;
  feasibility_violations: number;
  discount_recommendations: DiscountRecommendation[];
}

export interface Plan {
  plan_id: string;
  label: 'baseline' | 'optimized' | 'scenario';
  strategy_description: string;
  allocations: Allocation[];
  metrics: PlanMetrics;
  unallocated_batches: { batch: InventoryBatch; reason: string }[];
  generated_at: string;
}

export interface ScenarioModification {
  type:
    | 'route_unavailable'
    | 'demand_shock'
    | 'shelf_life_shock'
    | 'price_change';
  description: string;
  // route_unavailable
  route_id?: string;
  // demand_shock
  destination_id?: string;
  commodity?: string;
  demand_factor?: number; // multiplier e.g. 0.5 = 50% of original
  // shelf_life_shock
  batch_id?: string;
  shelf_life_reduction_hours?: number;
  // price_change
  price_delta_per_kg?: number;
}

export interface ComparisonResult {
  baseline: Plan;
  proposed: Plan;
  spoilage_diff_kg: number;
  spoilage_rate_diff: number;
  fulfillment_diff_kg: number;
  fulfillment_rate_diff: number;
  net_revenue_diff: number;
  transport_cost_diff: number;
  feasibility_violations_diff: number;
}
