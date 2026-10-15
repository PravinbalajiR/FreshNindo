// FreshRoute — Destinations Section
// Demand, market context, route schematic, and fulfillment tracking.

import React, { useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { DESTINATIONS, ROUTES, BATCHES } from '../data/dataset';
import { formatKg, formatINR } from './shared';

const RouteSchematic: React.FC = () => {
  return (
    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
      <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>
        Route Network — {ROUTES[0]?.origin ?? 'Origin'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', overflowX: 'auto', padding: 'var(--space-3) 0' }}>
        {/* Origin node */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 8px',
              fontSize: 28,
            }}
          >
            🏭
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', maxWidth: 100 }}>
            Nashik DC
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Origin</div>
        </div>

        {/* Routes to destinations */}
        {ROUTES.map((route) => {
          const dest = DESTINATIONS.find((d) => d.destination_id === route.destination_id)!;
          return (
            <React.Fragment key={route.route_id}>
              {/* Arrow + route info */}
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: route.available ? 'var(--text-muted)' : 'var(--danger-text)',
                    marginBottom: 4,
                  }}
                >
                  {route.available ? '─────' : '· · · ·'} {route.travel_time_hours}h
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
                  ₹{route.transport_cost_per_kg}/kg
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
                  Cap: {formatKg(route.vehicle_capacity_kg)}
                </div>
                {!route.available && (
                  <div className="status-badge status-infeasible" style={{ fontSize: 9, marginTop: 4 }}>
                    Unavailable
                  </div>
                )}
              </div>

              {/* Destination node */}
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: route.available ? 'var(--surface-3)' : 'var(--surface)',
                    border: `2px solid ${route.available ? 'var(--border-strong)' : 'var(--danger)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px',
                    fontSize: 22,
                  }}
                >
                  🏪
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', maxWidth: 90 }}>
                  {dest.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Cap: {formatKg(dest.capacity_kg)}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 'var(--space-3)' }}>
        ⓘ Schematic only. Travel times and costs are from the synthetic dataset. No real geographic data is used.
      </div>
    </div>
  );
};

export const DestinationsSection: React.FC = () => {
  const { state } = useApp();
  const plan = state.optimized;

  // Compute allocated + remaining demand per destination per commodity
  const allocatedByDest = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    DESTINATIONS.forEach((d) => {
      map[d.destination_id] = {};
    });
    plan?.allocations.forEach((a) => {
      const destId = a.destination.destination_id;
      const comm = a.batch.commodity;
      map[destId] = map[destId] ?? {};
      map[destId][comm] = (map[destId][comm] ?? 0) + a.quantity_kg;
    });
    return map;
  }, [plan]);

  const allCommodities = [...new Set(BATCHES.map((b) => b.commodity))].sort();

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1 className="page-title">Destinations</h1>
        <p className="page-subtitle">
          {DESTINATIONS.length} markets · Demand, pricing, and fulfillment status ·{' '}
          <span className="data-badge" style={{ verticalAlign: 'middle' }}>⚠ Synthetic Demo Data</span>
        </p>
      </div>

      {/* Route schematic */}
      <RouteSchematic />

      {/* Destination cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        {DESTINATIONS.map((dest, idx) => {
          const route = ROUTES.find((r) => r.destination_id === dest.destination_id);
          const allocatedHere = allocatedByDest[dest.destination_id] ?? {};
          const totalAllocated = Object.values(allocatedHere).reduce((s, v) => s + v, 0);
          const totalDemand = Object.values(dest.demand_by_commodity).reduce((s, v) => s + v, 0);
          const fillRate = totalDemand > 0 ? totalAllocated / totalDemand : 0;

          return (
            <div
              key={dest.destination_id}
              className="card anim-fade-up"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {/* Dest header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
                    {dest.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {dest.region} · {dest.handling_time_hours}h handling · Capacity {formatKg(dest.capacity_kg)}
                  </div>
                </div>
                {route && (
                  <div>
                    {route.available ? (
                      <span className="status-badge status-ready">Route Active</span>
                    ) : (
                      <span className="status-badge status-infeasible">Route Unavailable</span>
                    )}
                  </div>
                )}
              </div>

              {/* Route info */}
              {route && (
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-4)',
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius)',
                    padding: 'var(--space-3) var(--space-4)',
                    marginBottom: 'var(--space-4)',
                    fontSize: 13,
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Travel: </span>
                    <span style={{ fontWeight: 700 }}>{route.travel_time_hours}h</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Transport: </span>
                    <span style={{ fontWeight: 700 }}>₹{route.transport_cost_per_kg}/kg</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Vehicle cap: </span>
                    <span style={{ fontWeight: 700 }}>{formatKg(route.vehicle_capacity_kg)}</span>
                  </div>
                </div>
              )}

              {/* Fulfillment bar */}
              {plan && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Fulfillment ({formatKg(totalAllocated)} / {formatKg(totalDemand)})</span>
                    <span style={{ fontWeight: 700, color: fillRate >= 0.7 ? 'var(--ready-text)' : 'var(--warning-text)' }}>
                      {(fillRate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="margin-bar-track" style={{ height: 8 }}>
                    <div
                      className={`margin-bar-fill ${fillRate >= 0.7 ? 'ready' : 'time-sensitive'}`}
                      style={{ width: `${Math.min(100, fillRate * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Commodity table */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Commodity</th>
                      <th>Demand</th>
                      <th>Price ₹/kg</th>
                      {plan && <th>Allocated</th>}
                      {plan && <th>Remaining</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {allCommodities.map((commodity) => {
                      const demand = dest.demand_by_commodity[commodity] ?? 0;
                      const price = dest.selling_price_by_commodity[commodity] ?? 0;
                      if (demand === 0 && price === 0) return null;
                      const alloc = allocatedHere[commodity] ?? 0;
                      const remaining = Math.max(0, demand - alloc);
                      return (
                        <tr key={commodity}>
                          <td><span className="pill">{commodity}</span></td>
                          <td className="num">{formatKg(demand)}</td>
                          <td className="num">₹{price}</td>
                          {plan && (
                            <td className="num" style={{ color: alloc > 0 ? 'var(--ready-text)' : 'var(--text-muted)' }}>
                              {formatKg(alloc)}
                            </td>
                          )}
                          {plan && (
                            <td className="num" style={{ color: remaining > 0 ? 'var(--text-muted)' : 'var(--ready-text)' }}>
                              {remaining > 0 ? formatKg(remaining) : '✓ Fulfilled'}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
