// FreshRoute — Command (Overview) Section
// The first thing the operator sees. Answers: What is happening? What needs attention now?

import React, { useMemo } from 'react';
import { useApp } from '../store/AppContext';
import { BATCHES, DESTINATIONS } from '../data/dataset';
import { EmptyState, FeasibilityBadge, formatINR, formatKg, formatPct, Spinner } from './shared';
import { checkFeasibility } from '../engine/optimizer';
import { ROUTES } from '../data/dataset';

function getUrgentBatches() {
  return BATCHES.filter((b) => b.remaining_shelf_life_hours <= 24).sort(
    (a, b) => a.remaining_shelf_life_hours - b.remaining_shelf_life_hours
  );
}

function getBatchFeasibility(batch: (typeof BATCHES)[0]) {
  let bestStatus = 'INFEASIBLE' as 'READY' | 'TIME_SENSITIVE' | 'INFEASIBLE';
  for (const route of ROUTES) {
    if (!route.available) continue;
    const dest = DESTINATIONS.find((d) => d.destination_id === route.destination_id);
    if (!dest) continue;
    const result = checkFeasibility(batch, route, dest);
    if (result.status === 'READY') { bestStatus = 'READY'; break; }
    if (result.status === 'TIME_SENSITIVE') bestStatus = 'TIME_SENSITIVE';
  }
  return bestStatus;
}

export const CommandSection: React.FC = () => {
  const { state, navigate, generatePlan } = useApp();
  const urgentBatches = useMemo(getUrgentBatches, []);
  const totalKg = BATCHES.reduce((s, b) => s + b.quantity_kg, 0);
  const valueAtRisk = urgentBatches.reduce(
    (s, b) => s + b.quantity_kg * b.acquisition_cost_per_kg,
    0
  );

  const plan = state.optimized;

  return (
    <div className="page-wrapper">
      {/* Entrance animation wrapper */}
      <div className="anim-fade-up">
        {/* Hero headline */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <span className="data-badge" style={{ marginBottom: 'var(--space-3)', display: 'inline-flex' }}>
              ⚠ Synthetic Demo Data
            </span>
          </div>
          <h1 className="hero-headline">
            <span className="accent-num">{urgentBatches.length}</span>{' '}
            {urgentBatches.length === 1 ? 'batch needs' : 'batches need'} a decision
            <br />
            before the next dispatch window.
          </h1>
          <p className="hero-sub">
            {formatKg(totalKg)} total inventory across {BATCHES.length} batches.{' '}
            <span className="text-warning">
              ₹{valueAtRisk.toLocaleString('en-IN', { maximumFractionDigits: 0 })} at risk
            </span>{' '}
            in the next 24 hours.
          </p>
        </div>
      </div>

      {/* Primary action banner */}
      <div className="action-banner anim-fade-up anim-fade-up-1">
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Recommended Action
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Generate an optimized dispatch plan and review allocations before{' '}
            <span className="text-warning">
              {urgentBatches[0]?.commodity ?? 'critical inventory'} expires.
            </span>
          </div>
          {!plan && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              No plan generated yet. The system will allocate batches by value-urgency, respecting all shelf-life and capacity constraints.
            </div>
          )}
        </div>
        <div className="flex gap-3" style={{ flexShrink: 0 }}>
          {plan ? (
            <button
              className="btn btn-secondary"
              onClick={() => navigate('dispatch')}
            >
              View Plan
            </button>
          ) : null}
          <button
            className="btn btn-primary btn-lg"
            onClick={generatePlan}
            disabled={state.isGenerating}
          >
            {state.isGenerating ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Planning…
              </>
            ) : (
              '⚡ Generate Plan'
            )}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="stat-grid anim-fade-up anim-fade-up-2" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card card-sm">
          <div className="card-title">Total Inventory</div>
          <div className="card-value card-value-sm num">{formatKg(totalKg)}</div>
          <div className="card-meta">{BATCHES.length} active batches</div>
        </div>
        <div className="card card-sm">
          <div className="card-title">Urgent (≤24h)</div>
          <div className="card-value card-value-sm num text-warning">{urgentBatches.length}</div>
          <div className="card-meta">batches requiring immediate dispatch</div>
        </div>
        <div className="card card-sm">
          <div className="card-title">Value at Risk</div>
          <div className="card-value card-value-sm num text-danger">{formatINR(valueAtRisk)}</div>
          <div className="card-meta">acquisition cost of urgent stock</div>
        </div>
        <div className="card card-sm">
          <div className="card-title">Destinations</div>
          <div className="card-value card-value-sm num">{DESTINATIONS.length}</div>
          <div className="card-meta">active markets available</div>
        </div>
        {plan && (
          <>
            <div className="card card-sm">
              <div className="card-title">Net Revenue (Plan)</div>
              <div className="card-value card-value-sm num text-ready">
                {formatINR(plan.metrics.net_revenue)}
              </div>
              <div className="card-meta">after acquisition & transport costs</div>
            </div>
            <div className="card card-sm">
              <div className="card-title">Demand Fulfillment</div>
              <div className="card-value card-value-sm num text-ready">
                {formatPct(plan.metrics.fulfillment_rate)}
              </div>
              <div className="card-meta">{formatKg(plan.metrics.fulfilled_demand_kg)} of {formatKg(plan.metrics.total_demand_kg)}</div>
            </div>
          </>
        )}
      </div>

      {/* Priority queue */}
      <div className="anim-fade-up anim-fade-up-3">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Priority Queue
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('inventory')}>
            View all →
          </button>
        </div>

        {urgentBatches.length === 0 ? (
          <EmptyState
            icon="✓"
            title="No urgent batches"
            desc="All batches have comfortable remaining shelf life."
          />
        ) : (
          urgentBatches.map((batch, i) => {
            const bestStatus = getBatchFeasibility(batch);
            return (
              <div key={batch.batch_id} className="urgency-item anim-fade-up" style={{ animationDelay: `${(i + 4) * 60}ms` }}>
                <span className="urgency-num">{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                    {batch.batch_id} — {batch.commodity}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatKg(batch.quantity_kg)} · Grade {batch.quality_grade} · {batch.notes}
                  </div>
                </div>
                <FeasibilityBadge status={bestStatus} />
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 15,
                    color:
                      batch.remaining_shelf_life_hours <= 12
                        ? 'var(--danger-text)'
                        : 'var(--warning-text)',
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: 40,
                    textAlign: 'right',
                  }}
                >
                  {batch.remaining_shelf_life_hours}h
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Plan preview if generated */}
      {plan && (
        <div className="card anim-fade-up anim-fade-up-4" style={{ marginTop: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div>
              <div className="card-title">Current Plan Preview</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {plan.allocations.length} allocations · {formatKg(plan.metrics.total_allocated_kg)} dispatched
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('dispatch')}>
              Full Dispatch Plan →
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Commodity</th>
                  <th>Destination</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Net Rev.</th>
                </tr>
              </thead>
              <tbody>
                {plan.allocations.slice(0, 5).map((a) => (
                  <tr key={a.allocation_id}>
                    <td className="mono">{a.batch.batch_id}</td>
                    <td>{a.batch.commodity}</td>
                    <td>{a.destination.name}</td>
                    <td className="num">{formatKg(a.quantity_kg)}</td>
                    <td>
                      <FeasibilityBadge
                        status={a.feasibility.status}
                        margin={a.feasibility.usable_margin_hours}
                      />
                    </td>
                    <td className="num" style={{ color: a.net_revenue_contribution >= 0 ? 'var(--ready-text)' : 'var(--danger-text)' }}>
                      {formatINR(a.net_revenue_contribution)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {plan.allocations.length > 5 && (
              <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 12, color: 'var(--text-muted)' }}>
                +{plan.allocations.length - 5} more allocations in the Dispatch view
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
