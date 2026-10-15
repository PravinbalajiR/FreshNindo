// FreshRoute — Retailer portal: order produce, see coverage, track trucks in 3D.
import React, { useMemo, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { COMMODITIES } from '../../data/users';
import { checkFeasibility } from '../../engine/optimizer';
import { orderCoverage, routeDecisions, FRESHNESS_COLOR } from '../../engine/supplyChain';
import { RouteExplorer } from '../map/RouteExplorer';
import { useDirections } from '../map/useDirections';
import { ShipmentPanel, initialElapsed, useShipmentSim } from '../tracking/ShipmentPanel';
import { EmptyState, FeasibilityBadge, PageHeader, formatINR, formatKg, useToast } from '../shared';
import { PlainWords } from '../explain/PlainWords';

// Carries "track this truck" from the home list into the tracking page
let pendingTrackId: string | null = null;

function useRetailerData() {
  const { state, destinations } = useApp();
  const plan = state.scenarioPlan || state.optimized;
  const destId = state.user?.destination_id ?? '';
  const market = destinations.find((d) => d.destination_id === destId);
  const route = state.routes.find((r) => r.destination_id === destId);
  const myOrders = state.orders.filter((o) => o.retailer_id === state.user?.id);
  const incoming = (plan?.allocations.filter((a) => a.destination.destination_id === destId) ?? []).sort(
    (a, b) => a.dispatch_priority - b.dispatch_priority
  );
  const coverage = orderCoverage(
    state.orders.filter((o) => o.destination_id === destId),
    plan
  ).filter((c) => c.order.retailer_id === state.user?.id);
  return { state, plan, destId, market, route, myOrders, incoming, coverage };
}

const STATUS_STYLE = {
  COVERED: { cls: 'status-ready', label: '● Covered' },
  PARTIAL: { cls: 'status-time-sensitive', label: '◆ Partly covered' },
  WAITING: { cls: 'status-infeasible', label: '✕ Waiting for stock' },
} as const;

export const RetailerHome: React.FC = () => {
  const { state, market, route, incoming, coverage } = useRetailerData();
  const { navigate, cancelOrder } = useApp();

  const ordered = coverage.reduce((s, c) => s + c.order.quantity_kg, 0);
  const covered = coverage.reduce((s, c) => s + c.covered_kg, 0);
  const inboundKg = incoming.reduce((s, a) => s + a.quantity_kg, 0);
  const nextEta = incoming.length ? Math.min(...incoming.map((a) => a.route.travel_time_hours - initialElapsed(a))) : null;
  const waiting = coverage.filter((c) => c.status !== 'COVERED');
  const tight = incoming.filter((a) => a.feasibility.status === 'TIME_SENSITIVE');
  const points = [
    coverage.length
      ? `You ordered ${formatKg(ordered)}; today's trucks cover ${formatKg(covered)} of it (${ordered ? Math.round((covered / ordered) * 100) : 0}%).`
      : 'You have no open orders.',
    waiting.length
      ? `${waiting.map((c) => `${c.order.commodity} (${formatKg(c.order.quantity_kg - c.covered_kg)} missing)`).join(', ')}: not enough fresh stock yet. It may be filled when farmers list more.`
      : coverage.length ? 'Every order is fully covered.' : '',
    incoming.length
      ? `${incoming.length} truck load${incoming.length > 1 ? 's are' : ' is'} on the way; the first arrives in about ${nextEta?.toFixed(1)} hours.`
      : 'No trucks are heading to your market yet.',
    tight.length
      ? `Unload ${tight.map((a) => a.batch.commodity.toLowerCase()).join(', ')} quickly: ${tight.length > 1 ? 'they arrive' : 'it arrives'} with only a few hours of freshness left.`
      : '',
  ].filter(Boolean);

  return (
    <div className="page-wrapper">
      <PageHeader
        title={state.user?.name ?? 'Retailer'}
        subtitle={`Receiving at ${market?.name} · ${route?.travel_time_hours ?? '–'}h by truck from Nashik`}
        purpose={<>Place orders for your market, see <b>how much of each order is covered</b> by today's dispatch plan, and track the trucks coming to you.</>}
        actions={<button className="btn btn-primary" onClick={() => navigate('retailer-order')}>+ New order</button>}
      />

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="card"><div className="card-title">Your orders</div><div className="card-value">{coverage.length}</div><div className="card-meta">{formatKg(ordered)} requested</div></div>
        <div className="card"><div className="card-title">Covered by plan</div><div className="card-value" style={{ color: 'var(--ready-text)' }}>{ordered ? Math.round((covered / ordered) * 100) : 0}%</div><div className="card-meta">{formatKg(covered)} of {formatKg(ordered)}</div></div>
        <div className="card"><div className="card-title">Trucks heading to you</div><div className="card-value">{incoming.length}</div><div className="card-meta">{formatKg(inboundKg)} total, all buyers</div></div>
        <div className="card"><div className="card-title">Next arrival</div><div className="card-value">{nextEta !== null ? `${nextEta.toFixed(1)}h` : '—'}</div><div className="card-meta">simulated clock</div></div>
      </div>

      <PlainWords topic="Retailer orders and deliveries" points={points} />

      <div className="grid-2">
        <div>
          <div className="section-title">Your orders</div>
          <div className="section-sub">Oldest orders are filled first from stock sent to your market.</div>
          {coverage.length === 0 ? (
            <div className="card">No orders yet.</div>
          ) : (
            <div className="list">
              {coverage.map((c) => {
                const st = STATUS_STYLE[c.status];
                const pct = (c.covered_kg / c.order.quantity_kg) * 100;
                return (
                  <div key={c.order.order_id} className="list-row">
                    <div className="list-main">
                      <div className="list-title">{c.order.commodity} · {formatKg(c.order.quantity_kg)}</div>
                      <div className="list-meta">{c.order.order_id}{c.order.max_price_per_kg ? ` · up to ₹${c.order.max_price_per_kg}/kg` : ''}</div>
                      <div className="progress-track" style={{ marginTop: 8 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: c.status === 'COVERED' ? 'var(--ready)' : 'var(--warning)' }} />
                      </div>
                    </div>
                    <span className={`status-badge ${st.cls}`}>{st.label}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => cancelOrder(c.order.order_id)}>Cancel</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="section-title">Incoming trucks</div>
          <div className="section-sub">Loads the optimizer is sending to {market?.region}, in dispatch order.</div>
          {incoming.length === 0 ? (
            <div className="card">No loads planned for your market right now.</div>
          ) : (
            <div className="list">
              {incoming.map((a) => (
                <div key={a.allocation_id} className="list-row">
                  <span className="dot" style={{ background: FRESHNESS_COLOR[a.feasibility.status], width: 12, height: 12 }} />
                  <div className="list-main">
                    <div className="list-title">#{a.dispatch_priority} · {a.batch.commodity} {formatKg(a.quantity_kg)}</div>
                    <div className="list-meta">{a.batch.batch_id} · ₹{a.selling_price_per_kg}/kg · arrives in ~{(a.route.travel_time_hours - initialElapsed(a)).toFixed(1)}h</div>
                  </div>
                  <FeasibilityBadge status={a.feasibility.status} margin={a.feasibility.usable_margin_hours} />
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      pendingTrackId = a.allocation_id;
                      navigate('retailer-track');
                    }}
                  >
                    Track 3D →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const RetailerOrder: React.FC = () => {
  const { state, market, route, destId } = useRetailerData();
  const { addOrder, navigate } = useApp();
  const toast = useToast();
  const [commodity, setCommodity] = useState<string>('Tomatoes');
  const [qty, setQty] = useState(100);
  const [maxPrice, setMaxPrice] = useState<number | ''>('');

  const price = market?.selling_price_by_commodity[commodity] ?? 0;
  const supply = useMemo(() => {
    if (!route || !market) return { total: 0, fresh: 0 };
    const same = state.batches.filter((b) => b.commodity === commodity);
    return {
      total: same.reduce((s, b) => s + b.quantity_kg, 0),
      fresh: same.filter((b) => checkFeasibility(b, route, market).status !== 'INFEASIBLE').reduce((s, b) => s + b.quantity_kg, 0),
    };
  }, [state.batches, commodity, route, market]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.user || qty <= 0) return;
    const o = addOrder({
      retailer_id: state.user.id,
      destination_id: destId,
      commodity,
      quantity_kg: qty,
      max_price_per_kg: maxPrice === '' ? undefined : maxPrice,
    });
    toast.show(`${o.order_id} placed: ${qty} kg ${commodity}. Re-planning dispatch…`);
    setTimeout(() => navigate('retailer-home'), 900);
  };

  return (
    <div className="page-wrapper">
      <PageHeader
        title="New order"
        subtitle={`Delivered to ${market?.name}`}
        purpose={<>Pick a crop and quantity. Your order is added to market demand and <b>the dispatch plan is recalculated straight away</b>.</>}
      />
      <div className="split">
        <form className="card stack" onSubmit={submit}>
          <div className="field">
            <label>Crop</label>
            <div className="segmented">
              {COMMODITIES.map((c) => (
                <button type="button" key={c} className={commodity === c ? 'on' : ''} onClick={() => setCommodity(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="oqty">Quantity (kg)</label>
              <input id="oqty" className="input" type="number" min={1} step={1} value={qty} onChange={(e) => setQty(+e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="omax">Max price ₹/kg (optional)</label>
              <input id="omax" className="input" type="number" min={0} placeholder={`market ₹${price}`} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value === '' ? '' : +e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={qty <= 0}>Place order · {formatINR(qty * price)}</button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('retailer-home')}>Cancel</button>
          </div>
        </form>

        <div className="card">
          <div className="section-title">Availability check</div>
          <div className="section-sub">{commodity} at the Nashik DC today</div>
          <div className="kv"><span>Market price at {market?.region}</span><span>₹{price}/kg</span></div>
          <div className="kv"><span>Stock listed by farmers</span><span>{formatKg(supply.total)}</span></div>
          <div className="kv"><span>Can reach you fresh</span><span style={{ color: supply.fresh >= qty ? 'var(--ready-text)' : 'var(--warning-text)' }}>{formatKg(supply.fresh)}</span></div>
          <div className="kv"><span>Truck time</span><span>{route?.travel_time_hours}h + {market?.handling_time_hours}h unloading</span></div>
          {maxPrice !== '' && maxPrice < price && (
            <p style={{ fontSize: 13, color: 'var(--warning-text)', marginTop: 12 }}>
              Your max price is below today's market price, so suppliers may prefer other markets.
            </p>
          )}
          {supply.fresh < qty && (
            <p style={{ fontSize: 13, color: 'var(--warning-text)', marginTop: 12 }}>
              Only {formatKg(supply.fresh)} can arrive fresh. The rest may stay uncovered until farmers list more.
            </p>
          )}
        </div>
      </div>
      {toast.node}
    </div>
  );
};

export const RetailerTrack: React.FC = () => {
  const { state, plan, incoming, destId } = useRetailerData();
  const { destinations } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const id = pendingTrackId;
    pendingTrackId = null;
    return id;
  });
  const current = incoming.find((a) => a.allocation_id === selectedId) ?? incoming[0] ?? null;
  const sim = useShipmentSim(current);

  const decisions = useMemo(() => routeDecisions(state.routes, destinations, state.batches, plan), [state.routes, destinations, state.batches, plan]);
  const mine = useMemo(() => decisions.filter((d) => d.destination.destination_id === destId), [decisions, destId]);
  const { byRoute } = useDirections(mine);

  if (!current) {
    return (
      <div className="page-wrapper">
        <PageHeader title="Track delivery" purpose="Live view of trucks heading to your market." />
        <EmptyState icon="🚚" title="No trucks heading to you" desc="Place an order. Once the plan sends stock to your market, trucks show up here." />
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ maxWidth: 1400 }}>
      <PageHeader
        title="Track delivery"
        subtitle={`${incoming.length} load(s) heading to ${current.destination.name}`}
        purpose={<>The truck drives the <b>real road route</b> in 3D. The countdown shows how much shelf life the produce has left right now. Drag the slider to scrub through the trip.</>}
      />
      {incoming.length > 1 && (
        <div className="segmented" style={{ marginBottom: 16 }}>
          {incoming.map((a) => (
            <button key={a.allocation_id} className={a.allocation_id === current.allocation_id ? 'on' : ''} onClick={() => setSelectedId(a.allocation_id)}>
              #{a.dispatch_priority} {a.batch.commodity} {formatKg(a.quantity_kg)}
            </button>
          ))}
        </div>
      )}
      <ShipmentPanel allocation={current} directions={byRoute[current.route.route_id]} sim={sim} />
      <div className="section-title" style={{ marginTop: 24 }}>On the map</div>
      <div className="section-sub">Your market is starred. Other routes show where the rest of today's stock is going.</div>
      <RouteExplorer
        decisions={decisions}
        focusDestinationId={destId}
        initialRouteId={current.route.route_id}
        truck={{ routeId: current.route.route_id, progress: sim.progress }}
        mapHeight={480}
      />
    </div>
  );
};
