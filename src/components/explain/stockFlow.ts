// Splits today's stock into: sold at full price / sold at a discount / cold storage / at risk.
import type { InventoryBatch } from '../../data/dataset';
import type { Plan } from '../../types';
import type { StorageAdvice } from '../../engine/coldStorage';
import { FLOW_COLORS, type FlowSegment } from './PlainWords';

export function stockFlow(batches: InventoryBatch[], plan: Plan | null, advice: StorageAdvice[]): FlowSegment[] {
  const ids = new Set(batches.map((b) => b.batch_id));
  const sold = (plan?.allocations ?? []).filter((a) => ids.has(a.batch.batch_id)).reduce((s, a) => s + a.quantity_kg, 0);
  let discount = 0;
  let storage = 0;
  let risk = 0;
  for (const a of advice) {
    if (!ids.has(a.batch.batch_id) || a.leftover_kg <= 0) continue;
    if (a.action === 'STORE') storage += a.leftover_kg;
    else if (a.action === 'DISCOUNT') discount += a.leftover_kg;
    else risk += a.leftover_kg;
  }
  return [
    { key: 'sold', label: 'Sell at full price', kg: sold, color: FLOW_COLORS.sold, note: 'Loaded on trucks to markets that want it today.' },
    { key: 'discount', label: 'Sell at a discount', kg: discount, color: FLOW_COLORS.discount, note: 'No full-price buyer; a price cut sells it before it spoils.' },
    { key: 'storage', label: 'Go to cold storage', kg: storage, color: FLOW_COLORS.storage, note: 'No buyer today, but it keeps for days if kept cold.' },
    { key: 'risk', label: 'At risk of spoiling', kg: risk, color: FLOW_COLORS.risk, note: 'Too little freshness left to ship or store. Sell nearby fast.' },
  ];
}
