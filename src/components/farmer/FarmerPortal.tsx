// FreshRoute — Farmer portal: list stock, see where it sells, watch freshness.
import React, { lazy, Suspense, useMemo, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { COMMODITIES } from '../../data/users';
import type { InventoryBatch } from '../../data/dataset';
import { checkFeasibility } from '../../engine/optimizer';
import { batchFreshness, FRESHNESS_COLOR, routeDecisions } from '../../engine/supplyChain';
import { RouteExplorer } from '../map/RouteExplorer';
import { FeasibilityBadge, PageHeader, formatINR, formatKg, useToast } from '../shared';

const CrateStack3D = lazy(() => import('../three/CrateStack3D'));

const FRESH_DEFAULTS: Record<string, number> = { Tomatoes: 24, Onions: 96, Capsicum: 36, Spinach: 12, Grapes: 48 };
const COST_DEFAULTS: Record<string, number> = { Tomatoes: 11, Onions: 8, Capsicum: 24, Spinach: 17, Grapes: 44 };
const FRESH_LABEL = { READY: 'Fresh', TIME_SENSITIVE: 'Sell soon', INFEASIBLE: 'At risk' } as const;

function useFarmerData() {
  const { state } = useApp();
  const plan = state.scenarioPlan || state.optimized;
  const mine = state.batches.filter((b) => b.farmer_id === state.user?.id);
  const ids = new Set(mine.map((b) => b.batch_id));
  return { state, plan, mine, ids };
}

export const FarmerHome: React.FC = () => {
  const { state, plan, mine, ids } = useFarmerData();
  const { navigate, removeBatch } = useApp();
  const [selected, setSelected] = useState<string | null>(null);

  const allocs = plan?.allocations.filter((a) => ids.has(a.batch.batch_id)) ?? [];
  const listedKg = mine.reduce((s, b) => s + b.quantity_kg, 0);
  const shippedKg = allocs.reduce((s, a) => s + a.quantity_kg, 0);
  const expected = allocs.reduce((s, a) => s + a.gross_revenue, 0);
  const atRisk = Math.max(0, listedKg - shippedKg);

  return (
    <div className="page-wrapper">
      <PageHeader
        title={`Hello, ${state.user?.name.split(' ')[0]}`}
        subtitle={`${state.user?.org} · supplying Nashik Distribution Centre`}
        purpose={<>This is all your stock at the distribution centre. <b>Colours show freshness</b>, and every batch shows which market it's going to. The plan updates as soon as you add stock.</>}
        actions={<button className="btn btn-primary" onClick={() => navigate('farmer-add')}>+ Add stock</button>}
      />

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="card"><div className="card-title">Stock listed</div><div className="card-value">{formatKg(listedKg)}</div><div className="card-meta">{mine.length} batches</div></div>
        <div className="card"><div className="card-title">Going to market</div><div className="card-value" style={{ color: 'var(--ready-text)' }}>{formatKg(shippedKg)}</div><div className="card-meta">{listedKg ? Math.round((shippedKg / listedKg) * 100) : 0}% of your stock</div></div>
        <div className="card"><div className="card-title">Expected sales</div><div className="card-value">{formatINR(expected)}</div><div className="card-meta">at today's market prices</div></div>
        <div className="card"><div className="card-title">Not yet placed</div><div className="card-value" style={{ color: atRisk > 0 ? 'var(--warning-text)' : undefined }}>{formatKg(atRisk)}</div><div className="card-meta">{atRisk > 0 ? 'see suggestions below' : 'everything is placed'}</div></div>
      </div>

      <div className="section-title">Your stock in 3D</div>
      <div className="section-sub">Each stack is one batch (1 crate ≈ 100 kg). Click a stack to find it in the list.</div>
      <Suspense fallback={<div className="scene-frame" style={{ display: 'grid', placeItems: 'center' }}>Loading 3D…</div>}>
        <CrateStack3D batches={mine} plan={plan} selectedId={selected} onSelect={setSelected} height={340} />
      </Suspense>

      <div className="section-title" style={{ marginTop: 24 }}>Where each batch goes</div>
      <div className="section-sub">Decided by the distribution optimizer: freshest-margin, best-price market first.</div>
      {mine.length === 0 ? (
        <div className="card">No stock yet. Click <b>+ Add stock</b> to list your first batch.</div>
      ) : (
        <div className="list">
          {mine.map((b) => {
            const fresh = batchFreshness(b, plan);
            const bAllocs = allocs.filter((a) => a.batch.batch_id === b.batch_id);
            const unalloc = plan?.unallocated_batches.find((u) => u.batch.batch_id === b.batch_id);
            const discount = plan?.metrics.discount_recommendations.find((d) => d.batch.batch_id === b.batch_id);
            return (
              <div key={b.batch_id} className={`list-row clickable ${selected === b.batch_id ? 'on' : ''}`} onClick={() => setSelected(selected === b.batch_id ? null : b.batch_id)}>
                <span className="dot" style={{ background: FRESHNESS_COLOR[fresh], width: 12, height: 12 }} title={FRESH_LABEL[fresh]} />
                <div className="list-main">
                  <div className="list-title">{b.commodity} · {formatKg(b.quantity_kg)} <span className="role-tag" style={{ marginLeft: 6 }}>Grade {b.quality_grade}</span></div>
                  <div className="list-meta">{b.batch_id} · {b.remaining_shelf_life_hours}h of freshness left · ₹{b.acquisition_cost_per_kg}/kg cost</div>
                </div>
                <div style={{ flex: 2, minWidth: 220, fontSize: 13 }}>
                  {bAllocs.length > 0 ? (
                    bAllocs.map((a) => (
                      <div key={a.allocation_id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                        <span>→ <b>{a.destination.region}</b> {formatKg(a.quantity_kg)} @ ₹{a.selling_price_per_kg}</span>
                        <FeasibilityBadge status={a.feasibility.status} margin={a.feasibility.usable_margin_hours} />
                      </div>
                    ))
                  ) : (
                    <span style={{ color: 'var(--warning-text)' }}>Not shipped{unalloc ? `: ${unalloc.reason}` : ''}</span>
                  )}
                  {discount && discount.recommended_discount_pct > 0 && (
                    <div style={{ color: 'var(--warning-text)', marginTop: 2 }}>
                      💡 Sell {formatKg(discount.quantity_at_risk_kg)} locally at {discount.recommended_discount_pct}% off (₹{discount.discounted_price_per_kg.toFixed(0)}/kg) instead of losing it
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Remove ${b.batch_id} (${b.commodity}, ${b.quantity_kg} kg)?`)) removeBatch(b.batch_id);
                  }}
                  aria-label={`Remove ${b.batch_id}`}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const FarmerAddStock: React.FC = () => {
  const { state, addBatch, navigate, destinations } = useApp();
  const toast = useToast();
  const [commodity, setCommodity] = useState<string>('Tomatoes');
  const [qty, setQty] = useState(300);
  const [shelf, setShelf] = useState(FRESH_DEFAULTS.Tomatoes);
  const [grade, setGrade] = useState<InventoryBatch['quality_grade']>('A');
  const [cost, setCost] = useState(COST_DEFAULTS.Tomatoes);
  const [notes, setNotes] = useState('');

  const pick = (c: string) => {
    setCommodity(c);
    setShelf(FRESH_DEFAULTS[c]);
    setCost(COST_DEFAULTS[c]);
  };

  // Live preview: which markets this batch could reach in time, and at what price
  const preview = useMemo(() => {
    const draft: InventoryBatch = { batch_id: 'draft', commodity, quantity_kg: qty, remaining_shelf_life_hours: shelf, acquisition_cost_per_kg: cost, quality_grade: grade };
    return state.routes
      .map((r) => {
        const d = destinations.find((x) => x.destination_id === r.destination_id)!;
        const f = checkFeasibility(draft, r, d);
        const price = d.selling_price_by_commodity[commodity] ?? 0;
        return { r, d, f, price, net: price - cost - r.transport_cost_per_kg };
      })
      .sort((a, b) => b.net - a.net);
  }, [commodity, qty, shelf, cost, grade, state.routes, destinations]);

  const valid = qty > 0 && shelf > 0 && cost >= 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !state.user) return;
    const b = addBatch({
      commodity,
      quantity_kg: qty,
      remaining_shelf_life_hours: shelf,
      acquisition_cost_per_kg: cost,
      quality_grade: grade,
      notes: notes || undefined,
      farmer_id: state.user.id,
    });
    toast.show(`${b.batch_id} listed: ${qty} kg ${commodity}. Re-planning routes…`);
    setTimeout(() => navigate('farmer-home'), 900);
  };

  return (
    <div className="page-wrapper">
      <PageHeader
        title="Add stock"
        subtitle="List a harvested batch at Nashik Distribution Centre"
        purpose={<>Fill in four things: <b>crop, weight, how long it stays fresh, and your cost</b>. The right-hand panel shows which markets it can reach in time.</>}
      />
      <div className="split">
        <form className="card stack" onSubmit={submit}>
          <div className="field">
            <label>1 · Crop</label>
            <div className="segmented" role="radiogroup">
              {COMMODITIES.map((c) => (
                <button type="button" key={c} className={commodity === c ? 'on' : ''} onClick={() => pick(c)} role="radio" aria-checked={commodity === c}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="qty">2 · Weight (kg)</label>
              <input id="qty" className="input" type="number" min={1} step={1} value={qty} onChange={(e) => setQty(+e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="shelf">3 · Stays fresh for (hours)</label>
              <input id="shelf" className="input" type="number" min={1} value={shelf} onChange={(e) => setShelf(+e.target.value)} />
              <span className="hint">Typical for {commodity}: {FRESH_DEFAULTS[commodity]}h</span>
            </div>
            <div className="field">
              <label htmlFor="cost">4 · Your cost (₹/kg)</label>
              <input id="cost" className="input" type="number" min={0} step={0.5} value={cost} onChange={(e) => setCost(+e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Quality grade</label>
            <div className="segmented">
              {(['A', 'B', 'C'] as const).map((g) => (
                <button type="button" key={g} className={grade === g ? 'on' : ''} onClick={() => setGrade(g)}>
                  Grade {g}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="notes">Notes (optional)</label>
            <input id="notes" className="input" placeholder="e.g. picked this morning, firm" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={!valid}>List {formatKg(qty)} of {commodity}</button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('farmer-home')}>Cancel</button>
          </div>
        </form>

        <div className="card">
          <div className="section-title">Where it could sell</div>
          <div className="section-sub">Best net return first. Net = market price − your cost − transport.</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {preview.map(({ r, d, f, price, net }) => (
              <div key={r.route_id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, opacity: f.status === 'INFEASIBLE' || !r.available ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <b style={{ fontSize: 14 }}>{d.region}</b>
                  {r.available ? <FeasibilityBadge status={f.status} margin={f.usable_margin_hours} /> : <span className="status-badge status-infeasible">Route blocked</span>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  ₹{price}/kg · {r.travel_time_hours}h by truck · net <b style={{ color: net > 0 ? 'var(--ready-text)' : 'var(--danger-text)' }}>₹{net.toFixed(1)}/kg</b>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {toast.node}
    </div>
  );
};

export const FarmerRoutes: React.FC = () => {
  const { plan, mine, ids, state } = useFarmerData();
  const { destinations } = useApp();
  const decisions = useMemo(() => routeDecisions(state.routes, destinations, state.batches, plan), [state.routes, destinations, state.batches, plan]);
  const myRoute = plan?.allocations.find((a) => ids.has(a.batch.batch_id))?.route.route_id ?? null;

  return (
    <div className="page-wrapper" style={{ maxWidth: 1400 }}>
      <PageHeader
        title="Routes & decisions"
        subtitle={`${mine.length} of your batches across ${decisions.length} market routes`}
        purpose={<>Coloured lines are real roads from Nashik. <b>Green = used, amber = used but urgent, red = blocked, grey = not used.</b> Click a route to see which of your batches ride on it, and why.</>}
      />
      <RouteExplorer decisions={decisions} highlightBatchIds={ids} initialRouteId={myRoute} />
    </div>
  );
};
