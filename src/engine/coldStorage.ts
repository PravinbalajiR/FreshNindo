// FreshRoute — Cold-storage engine: lot ageing, facility search, store-vs-ship advice.
// Deterministic and explainable. Uses TODAY's market prices; it does not forecast
// future prices, so "store" advice means "keep it from spoiling", not "sell higher later".

import type { Destination, InventoryBatch } from '../data/dataset';
import { ORIGIN_COORDINATES } from '../data/dataset';
import type { Plan } from '../types';
import {
  FACILITIES,
  GRADE_LIFE,
  STORAGE_PROFILES,
  type ColdStorageFacility,
  type StoredLot,
} from '../data/coldStorage';

const DAY = 86_400_000;
const TRANSPORT_PER_KG_KM = 0.012; // ₹/kg/km, illustrative truck rate for short hauls
const ROAD_FACTOR = 1.25; // straight-line → road distance

export function roadKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * ROAD_FACTOR);
}

// ─── Lot ageing ──────────────────────────────────────────────────────────────

export type LotHealth = 'GOOD' | 'SELL_SOON' | 'EXPIRED';

export interface LotStatus {
  lot: StoredLot;
  facility: ColdStorageFacility | undefined;
  days_stored: number;
  max_days: number;
  days_left: number;
  pct_used: number; // 0..1 of storage life used
  grade_now: 'A' | 'B' | 'C';
  health: LotHealth;
  storage_cost: number; // ₹ so far
}

const GRADES = ['A', 'B', 'C'] as const;

export function lotStatus(lot: StoredLot, now: number = Date.now()): LotStatus {
  const facility = FACILITIES.find((f) => f.facility_id === lot.facility_id);
  const profile = STORAGE_PROFILES[lot.commodity];
  const max_days = Math.max(1, Math.round((profile?.max_days ?? 7) * GRADE_LIFE[lot.grade_in]));
  const days_stored = Math.max(0, (now - new Date(lot.stored_at).getTime()) / DAY);
  const pct_used = Math.min(1, days_stored / max_days);
  // Quality drops one grade after half the storage life, two after 80%
  const drop = pct_used >= 0.8 ? 2 : pct_used >= 0.5 ? 1 : 0;
  const grade_now = GRADES[Math.min(2, GRADES.indexOf(lot.grade_in) + drop)];
  const days_left = Math.max(0, max_days - days_stored);
  const health: LotHealth = days_left <= 0 ? 'EXPIRED' : pct_used >= 0.75 ? 'SELL_SOON' : 'GOOD';
  return {
    lot,
    facility,
    days_stored,
    max_days,
    days_left,
    pct_used,
    grade_now,
    health,
    storage_cost: lot.quantity_kg * (facility?.price_per_kg_day ?? 0) * days_stored,
  };
}

/** Turn a stored lot back into dispatchable stock at the distribution centre. */
export function releaseAsBatch(s: LotStatus): Omit<InventoryBatch, 'batch_id' | 'added_at'> {
  const profile = STORAGE_PROFILES[s.lot.commodity];
  const hours = Math.max(4, Math.round((profile?.ambient_hours_after ?? 24) * (1 - s.pct_used * 0.5)));
  return {
    commodity: s.lot.commodity,
    quantity_kg: s.lot.quantity_kg,
    remaining_shelf_life_hours: hours,
    acquisition_cost_per_kg: +(s.lot.cost_per_kg + s.storage_cost / s.lot.quantity_kg).toFixed(2),
    quality_grade: s.grade_now,
    notes: `Released from ${s.facility?.name ?? 'cold storage'} after ${Math.round(s.days_stored)} days`,
    farmer_id: s.lot.farmer_id,
  };
}

// ─── Facility search ─────────────────────────────────────────────────────────

export interface FacilityMatch {
  facility: ColdStorageFacility;
  distance_km: number;
  free_kg: number;
  occupancy: number; // 0..1
  takes_crop: boolean;
  transport_per_kg: number;
  /** ₹ per kg to haul there and keep it for `days` */
  cost_per_kg: number;
}

export function facilityUsedKg(f: ColdStorageFacility, lots: StoredLot[]): number {
  return f.used_t * 1000 + lots.filter((l) => l.facility_id === f.facility_id).reduce((s, l) => s + l.quantity_kg, 0);
}

export function searchFacilities(opts: {
  commodity: string;
  from?: { lat: number; lng: number };
  lots: StoredLot[];
  days?: number;
}): FacilityMatch[] {
  const from = opts.from ?? ORIGIN_COORDINATES;
  const days = opts.days ?? 7;
  return FACILITIES.map((facility) => {
    const used = facilityUsedKg(facility, opts.lots);
    const cap = facility.capacity_t * 1000;
    const distance_km = roadKm(from, facility.coordinates);
    const transport_per_kg = +(distance_km * TRANSPORT_PER_KG_KM).toFixed(2);
    return {
      facility,
      distance_km,
      free_kg: Math.max(0, cap - used),
      occupancy: Math.min(1, used / cap),
      takes_crop: facility.crops.includes(opts.commodity),
      transport_per_kg,
      cost_per_kg: +(transport_per_kg + facility.price_per_kg_day * days).toFixed(2),
    };
  }).sort((a, b) => Number(b.takes_crop) - Number(a.takes_crop) || a.cost_per_kg - b.cost_per_kg);
}

// ─── Store vs ship advice ────────────────────────────────────────────────────

export type AdviceAction = 'SHIP' | 'STORE' | 'DISCOUNT' | 'SELL_LOCAL';

export interface StorageAdvice {
  batch: InventoryBatch;
  action: AdviceAction;
  shipped_kg: number;
  leftover_kg: number;
  facility?: FacilityMatch;
  hold_days?: number;
  storage_cost?: number;
  value_if_stored?: number;
  value_if_discounted?: number;
  headline: string;
  reason: string;
}

export function storeVsShip(batches: InventoryBatch[], plan: Plan | null, destinations: Destination[], lots: StoredLot[]): StorageAdvice[] {
  return batches.map((batch) => {
    const shipped_kg = (plan?.allocations ?? []).filter((a) => a.batch.batch_id === batch.batch_id).reduce((s, a) => s + a.quantity_kg, 0);
    const leftover_kg = Math.max(0, batch.quantity_kg - shipped_kg);
    const profile = STORAGE_PROFILES[batch.commodity];

    if (leftover_kg <= 0) {
      return {
        batch, action: 'SHIP', shipped_kg, leftover_kg,
        headline: 'Ship it all today',
        reason: `Every kg already has a buyer in today's plan, so paying for cold storage would only add cost.`,
      };
    }

    if (!profile || batch.remaining_shelf_life_hours < 4) {
      return {
        batch, action: 'SELL_LOCAL', shipped_kg, leftover_kg,
        headline: 'Sell nearby right away',
        reason: `Only ${batch.remaining_shelf_life_hours}h of freshness left: too little to cool it down and store it safely. Sell the extra ${Math.round(leftover_kg)} kg locally today.`,
      };
    }

    const hold_days = Math.max(1, Math.min(7, Math.floor(profile.max_days * GRADE_LIFE[batch.quality_grade] * 0.5)));
    const facility = searchFacilities({ commodity: batch.commodity, lots, days: hold_days }).find((m) => m.takes_crop && m.free_kg >= leftover_kg);
    const bestPrice = Math.max(0, ...destinations.map((d) => d.selling_price_by_commodity[batch.commodity] ?? 0));
    const discount = plan?.metrics.discount_recommendations.find((d) => d.batch.batch_id === batch.batch_id);
    const value_if_discounted = discount ? discount.revenue_at_discount : 0;

    if (!facility) {
      return {
        batch, action: value_if_discounted > 0 ? 'DISCOUNT' : 'SELL_LOCAL', shipped_kg, leftover_kg, value_if_discounted,
        headline: value_if_discounted > 0 ? `Sell at ${discount!.recommended_discount_pct}% off` : 'Sell nearby right away',
        reason: `No cold store with enough free space takes ${batch.commodity.toLowerCase()} right now.`,
      };
    }

    const storage_cost = leftover_kg * facility.cost_per_kg;
    // Assume ~10% lower price after storage (grade may slip); no price forecasting.
    const value_if_stored = leftover_kg * bestPrice * 0.9 - storage_cost;
    const store = value_if_stored > value_if_discounted;

    return {
      batch,
      action: store ? 'STORE' : 'DISCOUNT',
      shipped_kg,
      leftover_kg,
      facility,
      hold_days,
      storage_cost,
      value_if_stored,
      value_if_discounted,
      headline: store
        ? `Store ${Math.round(leftover_kg)} kg at ${facility.facility.city}`
        : `Sell ${Math.round(leftover_kg)} kg at ${discount?.recommended_discount_pct ?? 0}% off`,
      reason: store
        ? `No market wants this extra stock today. Keeping it cold for up to ${hold_days} days costs about ₹${Math.round(storage_cost).toLocaleString('en-IN')}, and it could still sell for about ₹${Math.round(value_if_stored + storage_cost).toLocaleString('en-IN')} later, so you keep roughly ₹${Math.round(value_if_stored).toLocaleString('en-IN')} instead of ${value_if_discounted > 0 ? `₹${Math.round(value_if_discounted).toLocaleString('en-IN')} from a discount sale` : 'losing it'}.`
        : `A quick discount sale brings in about ₹${Math.round(value_if_discounted).toLocaleString('en-IN')}, more than the ₹${Math.round(value_if_stored).toLocaleString('en-IN')} left after paying for storage.`,
    };
  });
}

export const LOT_HEALTH_META: Record<LotHealth, { label: string; cls: string }> = {
  GOOD: { label: '● Good', cls: 'status-ready' },
  SELL_SOON: { label: '◆ Sell soon', cls: 'status-time-sensitive' },
  EXPIRED: { label: '✕ Past storage life', cls: 'status-infeasible' },
};
