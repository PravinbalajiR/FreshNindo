// FreshRoute — Destinations Section
// Demand, market context, interactive Google Map, and fulfillment tracking.

import React, { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { DESTINATIONS, BATCHES } from '../data/dataset';
import { formatKg, formatINR } from './shared';
import { GoogleMapView } from './GoogleMapView';

export const DestinationsSection: React.FC = () => {
  const { state, syncRoutesWithGoogle } = useApp();
  const [selectedDestId, setSelectedDestId] = useState<string | null>(null);

  const plan = state.scenarioPlan || state.optimized;

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Destinations & Transit Network</h1>
            <p className="page-subtitle">
              {DESTINATIONS.length} regional markets · Demand, pricing, and live corridor fulfillment
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span
              className={`status-badge ${
                state.routesSource === 'google_routes'
                  ? 'status-ready'
                  : 'status-time-sensitive'
              }`}
            >
              {state.routesSource === 'google_routes'
                ? '● Google Routes API Active'
                : state.routesSource === 'cache'
                ? '● Cached Routes'
                : '⚠ Fallback Routing'}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => syncRoutesWithGoogle()}
              disabled={state.isSyncingRoutes}
            >
              {state.isSyncingRoutes ? (
                <>
                  <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                  Syncing…
                </>
              ) : (
                '↻ Sync Route Estimates'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Google Map with Route Highlighting */}
      <GoogleMapView
        routes={state.routes}
        selectedDestId={selectedDestId}
        onSelectDest={setSelectedDestId}
        routesSource={state.routesSource}
      />

      {/* Destination cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        {DESTINATIONS.map((dest, idx) => {
          const route = state.routes.find((r) => r.destination_id === dest.destination_id);
          const allocatedHere = allocatedByDest[dest.destination_id] ?? {};
          const totalAllocated = Object.values(allocatedHere).reduce((s, v) => s + v, 0);
          const totalDemand = Object.values(dest.demand_by_commodity).reduce((s, v) => s + v, 0);
          const fillRate = totalDemand > 0 ? totalAllocated / totalDemand : 0;
          const isSelected = selectedDestId === dest.destination_id;

          return (
            <div
              key={dest.destination_id}
              className={`card anim-fade-up ${isSelected ? 'selected' : ''}`}
              style={{
                animationDelay: `${idx * 60}ms`,
                borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                boxShadow: isSelected ? '0 0 16px rgba(0,102,204,0.3)' : undefined,
                cursor: 'pointer',
              }}
              onClick={() => setSelectedDestId(isSelected ? null : dest.destination_id)}
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
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Distance: </span>
                    <span style={{ fontWeight: 700 }}>{route.distance_km || '—'} km</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Transit: </span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-light)' }}>
                      {route.duration_formatted || `${route.travel_time_hours}h`}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Cost: </span>
                    <span style={{ fontWeight: 700 }}>₹{route.transport_cost_per_kg}/kg</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Cap: </span>
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
