// FreshRoute — Inventory Section (Batch Intelligence)
// Browse, search, filter inventory. Select a batch to inspect routes, feasibility, economics.

import React, { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { BATCHES, DESTINATIONS, ROUTES } from '../data/dataset';
import { checkFeasibility } from '../engine/optimizer';
import { FeasibilityBadge, MarginBar, formatINR, formatKg } from './shared';
import type { InventoryBatch } from '../data/dataset';

const BatchDetailPanel: React.FC<{
  batch: InventoryBatch;
  allocatedKg: number;
  onClose: () => void;
}> = ({ batch, allocatedKg, onClose }) => {
  const valueAtRisk = batch.quantity_kg * batch.acquisition_cost_per_kg;

  const routeAnalysis = useMemo(() =>
    ROUTES.map((route) => {
      const dest = DESTINATIONS.find((d) => d.destination_id === route.destination_id)!;
      const feasibility = checkFeasibility(batch, route, dest);
      const demand = dest.demand_by_commodity[batch.commodity] ?? 0;
      const sellingPrice = dest.selling_price_by_commodity[batch.commodity] ?? 0;
      const netPerKg = sellingPrice - route.transport_cost_per_kg - batch.acquisition_cost_per_kg;
      return { route, dest, feasibility, demand, sellingPrice, netPerKg };
    }).sort((a, b) => b.netPerKg - a.netPerKg),
    [batch]
  );

  return (
    <div
      className="card"
      style={{
        borderColor: 'var(--accent)',
        marginTop: 'var(--space-5)',
        animation: 'fadeInUp 280ms cubic-bezier(0.25,1,0.5,1) both',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            {batch.batch_id} — {batch.commodity}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {batch.notes}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
      </div>

      {/* Batch vitals */}
      <div className="stat-grid" style={{ marginBottom: 'var(--space-5)' }}>
        {[
          ['Quantity', formatKg(batch.quantity_kg)],
          ['Shelf Life Remaining', `${batch.remaining_shelf_life_hours}h`],
          ['Grade', batch.quality_grade],
          ['Acq. Cost', `₹${batch.acquisition_cost_per_kg}/kg`],
          ['Value at Risk', formatINR(valueAtRisk)],
          ['Allocated (plan)', formatKg(allocatedKg)],
        ].map(([label, value]) => (
          <div key={label as string} className="card card-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="card-title">{label}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Route analysis */}
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 'var(--space-3)' }}>
        Feasible Destinations & Economics
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Destination</th>
              <th>Travel</th>
              <th>Handling</th>
              <th>Margin</th>
              <th>Status</th>
              <th>Demand</th>
              <th>Sell ₹/kg</th>
              <th>Net ₹/kg</th>
            </tr>
          </thead>
          <tbody>
            {routeAnalysis.map(({ route, dest, feasibility, demand, sellingPrice, netPerKg }) => (
              <tr key={route.route_id} style={{ opacity: feasibility.status === 'INFEASIBLE' ? 0.5 : 1 }}>
                <td style={{ fontWeight: 600 }}>{dest.name}</td>
                <td className="num">{route.travel_time_hours}h</td>
                <td className="num">{dest.handling_time_hours}h</td>
                <td style={{ minWidth: 120 }}>
                  <MarginBar
                    status={feasibility.status}
                    marginHours={feasibility.usable_margin_hours}
                    maxHours={batch.remaining_shelf_life_hours}
                  />
                </td>
                <td>
                  <FeasibilityBadge
                    status={feasibility.status}
                    margin={feasibility.usable_margin_hours}
                  />
                </td>
                <td className="num">{formatKg(demand)}</td>
                <td className="num">₹{sellingPrice}</td>
                <td
                  className="num bold"
                  style={{
                    color: netPerKg >= 0 ? 'var(--ready-text)' : 'var(--danger-text)',
                  }}
                >
                  ₹{netPerKg.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 'var(--space-3)', fontSize: 12, color: 'var(--text-muted)' }}>
        ⓘ Net ₹/kg = Selling price − transport cost − acquisition cost.
        Availability flags reflect route availability only; demand and capacity constraints are enforced by the allocation engine.
      </div>
    </div>
  );
};

export const InventorySection: React.FC = () => {
  const { state } = useApp();
  const [search, setSearch] = useState('');
  const [filterCommodity, setFilterCommodity] = useState('all');
  const [filterRisk, setFilterRisk] = useState('all');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const plan = state.optimized;

  // Allocated kg per batch from plan
  const allocatedByBatch = useMemo(() => {
    const map: Record<string, number> = {};
    plan?.allocations.forEach((a) => {
      map[a.batch.batch_id] = (map[a.batch.batch_id] ?? 0) + a.quantity_kg;
    });
    return map;
  }, [plan]);

  const commodities = [...new Set(BATCHES.map((b) => b.commodity))].sort();

  const filtered = useMemo(() => {
    return BATCHES.filter((b) => {
      if (search && !b.batch_id.toLowerCase().includes(search.toLowerCase()) &&
          !b.commodity.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCommodity !== 'all' && b.commodity !== filterCommodity) return false;
      if (filterRisk === 'urgent' && b.remaining_shelf_life_hours > 24) return false;
      if (filterRisk === 'critical' && b.remaining_shelf_life_hours > 12) return false;
      if (filterRisk === 'stable' && b.remaining_shelf_life_hours <= 24) return false;
      return true;
    });
  }, [search, filterCommodity, filterRisk]);

  const selectedBatch = BATCHES.find((b) => b.batch_id === selectedBatchId);

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">Inventory</h1>
        <p className="page-subtitle">
          {BATCHES.length} batches · {BATCHES.reduce((s, b) => s + b.quantity_kg, 0).toLocaleString('en-IN')} kg total ·{' '}
          <span className="data-badge" style={{ verticalAlign: 'middle' }}>⚠ Synthetic Demo Data</span>
        </p>
      </div>

      <div className="filter-bar anim-fade-up">
        <input
          className="search-input"
          type="text"
          placeholder="Search batch ID or commodity…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={filterCommodity}
          onChange={(e) => setFilterCommodity(e.target.value)}
        >
          <option value="all">All Commodities</option>
          {commodities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filterRisk}
          onChange={(e) => setFilterRisk(e.target.value)}
        >
          <option value="all">All Risk Levels</option>
          <option value="critical">Critical (≤12h)</option>
          <option value="urgent">Urgent (≤24h)</option>
          <option value="stable">Stable (&gt;24h)</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {filtered.length} of {BATCHES.length} batches
        </span>
      </div>

      <div className="table-wrap anim-fade-up anim-fade-up-1">
        <table>
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Commodity</th>
              <th>Quantity</th>
              <th>Shelf Life</th>
              <th>Grade</th>
              <th>Acq. Cost</th>
              <th>Value</th>
              <th>Allocated</th>
              <th>Risk</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((batch) => {
              const allocated = allocatedByBatch[batch.batch_id] ?? 0;
              const unallocated = batch.quantity_kg - allocated;
              const isUrgent = batch.remaining_shelf_life_hours <= 24;
              const isCritical = batch.remaining_shelf_life_hours <= 12;
              return (
                <tr
                  key={batch.batch_id}
                  className={selectedBatchId === batch.batch_id ? 'selected' : ''}
                  style={{ cursor: 'pointer' }}
                  onClick={() =>
                    setSelectedBatchId(
                      selectedBatchId === batch.batch_id ? null : batch.batch_id
                    )
                  }
                >
                  <td className="mono bold">{batch.batch_id}</td>
                  <td>
                    <span className="pill">{batch.commodity}</span>
                  </td>
                  <td className="num">{formatKg(batch.quantity_kg)}</td>
                  <td>
                    <span
                      className="num bold"
                      style={{
                        color: isCritical
                          ? 'var(--danger-text)'
                          : isUrgent
                          ? 'var(--warning-text)'
                          : 'var(--ready-text)',
                      }}
                    >
                      {batch.remaining_shelf_life_hours}h
                    </span>
                  </td>
                  <td>
                    <span className="pill">Grade {batch.quality_grade}</span>
                  </td>
                  <td className="num">₹{batch.acquisition_cost_per_kg}/kg</td>
                  <td className="num">{formatINR(batch.quantity_kg * batch.acquisition_cost_per_kg)}</td>
                  <td>
                    {plan ? (
                      <div>
                        <div className="num" style={{ fontSize: 12 }}>
                          <span style={{ color: 'var(--ready-text)' }}>{formatKg(allocated)}</span>
                          {unallocated > 0 && (
                            <span style={{ color: 'var(--warning-text)', marginLeft: 4 }}>
                              +{formatKg(unallocated)} unalloc.
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>No plan</span>
                    )}
                  </td>
                  <td>
                    {isCritical ? (
                      <span className="status-badge status-infeasible">Critical</span>
                    ) : isUrgent ? (
                      <span className="status-badge status-time-sensitive">Urgent</span>
                    ) : (
                      <span className="status-badge status-ready">Stable</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBatchId(
                          selectedBatchId === batch.batch_id ? null : batch.batch_id
                        );
                      }}
                    >
                      {selectedBatchId === batch.batch_id ? '▲' : '▼ Inspect'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedBatch && (
        <BatchDetailPanel
          batch={selectedBatch}
          allocatedKg={allocatedByBatch[selectedBatch.batch_id] ?? 0}
          onClose={() => setSelectedBatchId(null)}
        />
      )}
    </div>
  );
};
