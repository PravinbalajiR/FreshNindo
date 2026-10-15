// FreshRoute — Map + route decision panel.
// Left: the road map. Right: every route with the optimizer's verdict, and for the
// selected one: why, what ships on it, what was rejected, and turn-by-turn directions.

import React, { useMemo, useState } from 'react';
import { RouteMap } from './RouteMap';
import { useDirections } from './useDirections';
import { ROUTE_STATUS_META, type RouteDecision } from '../../engine/supplyChain';
import { FeasibilityBadge, formatINR, formatKg } from '../shared';

interface RouteExplorerProps {
  decisions: RouteDecision[];
  focusDestinationId?: string;
  /** Only list these batch ids in "what ships" (e.g. a farmer's own stock). */
  highlightBatchIds?: Set<string>;
  initialRouteId?: string | null;
  truck?: { routeId: string; progress: number } | null;
  mapHeight?: number;
}

export const RouteExplorer: React.FC<RouteExplorerProps> = ({
  decisions,
  focusDestinationId,
  highlightBatchIds,
  initialRouteId = null,
  truck,
  mapHeight = 560,
}) => {
  const [selected, setSelected] = useState<string | null>(initialRouteId);
  const { byRoute, loading, approximate } = useDirections(decisions);
  const current = useMemo(() => decisions.find((d) => d.route.route_id === selected) ?? null, [decisions, selected]);

  return (
    <div className="split">
      <RouteMap
        decisions={decisions}
        directions={byRoute}
        selectedRouteId={selected}
        onSelectRoute={setSelected}
        focusDestinationId={focusDestinationId}
        truck={truck}
        loading={loading}
        approximate={approximate}
        height={mapHeight}
      />

      <div className="card" style={{ maxHeight: mapHeight, overflowY: 'auto' }}>
        {!current ? (
          <>
            <div className="section-title">Route decisions</div>
            <div className="section-sub">Pick a route on the map or below to see why the plan uses it, or doesn't.</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {decisions.map((d) => {
                const meta = ROUTE_STATUS_META[d.status];
                const dir = byRoute[d.route.route_id];
                return (
                  <button key={d.route.route_id} className="route-option" onClick={() => setSelected(d.route.route_id)}>
                    <span className="route-swatch" style={{ background: meta.color }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>
                        {d.destination.destination_id === focusDestinationId ? '★ ' : ''}
                        {d.destination.name}
                      </span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>
                        {meta.label} · {dir ? `${dir.distance_km} km` : '…'} · truck {d.route.travel_time_hours}h
                      </span>
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{d.shipped_kg > 0 ? formatKg(d.shipped_kg) : '—'}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <RouteDetail
            d={current}
            dir={byRoute[current.route.route_id]}
            onBack={() => setSelected(null)}
            highlightBatchIds={highlightBatchIds}
          />
        )}
      </div>
    </div>
  );
};

const RouteDetail: React.FC<{
  d: RouteDecision;
  dir?: ReturnType<typeof useDirections>['byRoute'][string];
  onBack: () => void;
  highlightBatchIds?: Set<string>;
}> = ({ d, dir, onBack, highlightBatchIds }) => {
  const meta = ROUTE_STATUS_META[d.status];
  const allocs = highlightBatchIds ? d.allocations.filter((a) => highlightBatchIds.has(a.batch.batch_id)) : d.allocations;
  const rejected = highlightBatchIds ? d.rejected.filter((r) => highlightBatchIds.has(r.batch.batch_id)) : d.rejected;

  return (
    <div className="anim-fade">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 12, paddingLeft: 0 }}>
        ← All routes
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span className="dot" style={{ background: meta.color, width: 12, height: 12 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{meta.label}</span>
      </div>
      <div className="section-title" style={{ fontSize: 20 }}>Nashik DC → {d.destination.name}</div>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '8px 0 16px' }}>{d.summary}</p>

      <div style={{ marginBottom: 16 }}>
        <div className="kv"><span>Road distance</span><span>{dir ? `${dir.distance_km} km` : '…'}</span></div>
        <div className="kv"><span>Truck transit (plan)</span><span>{d.route.travel_time_hours} h</span></div>
        <div className="kv"><span>Car-speed road time</span><span>{dir ? `${dir.road_hours} h` : '…'}</span></div>
        <div className="kv"><span>Unloading at market</span><span>{d.destination.handling_time_hours} h</span></div>
        <div className="kv"><span>Transport cost</span><span>₹{d.route.transport_cost_per_kg}/kg</span></div>
        <div className="kv"><span>Truck capacity</span><span>{formatKg(d.route.vehicle_capacity_kg)}</span></div>
      </div>

      <div className="card-title">What ships on this route</div>
      {allocs.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Nothing{highlightBatchIds ? ' of yours' : ''}.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
          {allocs.map((a) => (
            <div key={a.allocation_id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <strong>#{a.dispatch_priority} · {a.batch.commodity} {formatKg(a.quantity_kg)}</strong>
                <FeasibilityBadge status={a.feasibility.status} margin={a.feasibility.usable_margin_hours} />
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                {a.batch.batch_id} · sells ₹{a.selling_price_per_kg}/kg · net {formatINR(a.net_revenue_contribution)}
              </div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{a.explanation.why_this_destination}</div>
            </div>
          ))}
        </div>
      )}

      {rejected.length > 0 && (
        <>
          <div className="card-title">Can't make it in time</div>
          <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
            {rejected.map((r) => (
              <div key={r.batch.batch_id} style={{ fontSize: 13, color: 'var(--danger-text)', background: 'var(--danger-bg)', borderRadius: 8, padding: '6px 10px' }}>
                ✕ {r.batch.batch_id} {r.batch.commodity}: {r.batch.remaining_shelf_life_hours}h shelf life − {d.route.travel_time_hours}h travel − {d.destination.handling_time_hours}h unloading = {r.margin_hours.toFixed(1)}h left
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card-title">Directions {dir?.approximate ? '(approximate)' : ''}</div>
      {!dir ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <ol className="steps-list">
          {dir.steps.map((s, i) => (
            <li key={i}>
              <span>{s.instruction}</span>
              {s.distance_km > 0 && <span className="km">{s.distance_km} km</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
