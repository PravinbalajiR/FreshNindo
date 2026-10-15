// FreshRoute — Dispatch Section (Decision Workspace)
// The most important screen. Shows allocations with full context and explanations.

import React, { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { EmptyState, FeasibilityBadge, MarginBar, formatINR, formatKg, Spinner } from './shared';
import type { Allocation } from '../types';

type SortKey = 'priority' | 'expiry' | 'value' | 'commodity' | 'destination' | 'feasibility';

const ExplanationPanel: React.FC<{ allocation: Allocation; onClose: () => void }> = ({
  allocation: a,
  onClose,
}) => (
  <div
    className="card"
    style={{
      marginTop: 'var(--space-4)',
      borderColor: 'var(--accent)',
      animation: 'fadeInUp 250ms cubic-bezier(0.25,1,0.5,1) both',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
        Explanation — {a.batch.batch_id} → {a.destination.name}
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
    </div>
    <div className="explain-box">
      {[
        ['Why this batch?', a.explanation.why_this_batch],
        ['Why this destination?', a.explanation.why_this_destination],
        ['Why this quantity?', a.explanation.why_this_quantity],
        ['Why this priority?', a.explanation.why_this_priority],
        ['Economics', a.explanation.economic_summary],
        ...(a.explanation.discount_note ? [['Discount', a.explanation.discount_note]] : []),
      ].map(([label, value]) => (
        <div key={label} className="explain-row">
          <span className="explain-label">{label}</span>
          <span className="explain-value">{value}</span>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 'var(--space-3)' }}>
      {[
        ['Shelf Life', `${a.batch.remaining_shelf_life_hours}h`],
        ['Travel Time', `${a.route.travel_time_hours}h`],
        ['Handling', `${a.destination.handling_time_hours}h`],
        ['Margin', `${a.feasibility.usable_margin_hours.toFixed(1)}h`],
        ['Sell Price', `₹${a.selling_price_per_kg}/kg`],
        ['Transport', `₹${a.route.transport_cost_per_kg}/kg`],
      ].map(([label, value]) => (
        <div key={label} className="card card-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="card-title">{label}</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        </div>
      ))}
    </div>
  </div>
);

export const DispatchSection: React.FC = () => {
  const { state, generatePlan } = useApp();
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [filterCommodity, setFilterCommodity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedAlloc, setSelectedAlloc] = useState<string | null>(null);

  const plan = state.scenarioPlan ?? state.optimized;

  const commodities = useMemo(() => {
    if (!plan) return [];
    return [...new Set(plan.allocations.map((a) => a.batch.commodity))].sort();
  }, [plan]);

  const sorted = useMemo(() => {
    if (!plan) return [];
    let list = [...plan.allocations];

    // Filter
    if (filterCommodity !== 'all')
      list = list.filter((a) => a.batch.commodity === filterCommodity);
    if (filterStatus !== 'all')
      list = list.filter((a) => a.feasibility.status === filterStatus);

    // Sort
    switch (sortKey) {
      case 'priority':
        list.sort((a, b) => a.dispatch_priority - b.dispatch_priority);
        break;
      case 'expiry':
        list.sort(
          (a, b) =>
            a.batch.remaining_shelf_life_hours - b.batch.remaining_shelf_life_hours
        );
        break;
      case 'value':
        list.sort((a, b) => b.net_revenue_contribution - a.net_revenue_contribution);
        break;
      case 'commodity':
        list.sort((a, b) => a.batch.commodity.localeCompare(b.batch.commodity));
        break;
      case 'destination':
        list.sort((a, b) =>
          a.destination.name.localeCompare(b.destination.name)
        );
        break;
      case 'feasibility':
        const order = { INFEASIBLE: 0, TIME_SENSITIVE: 1, READY: 2 };
        list.sort(
          (a, b) =>
            order[a.feasibility.status] - order[b.feasibility.status]
        );
        break;
    }
    return list;
  }, [plan, sortKey, filterCommodity, filterStatus]);

  const selectedAllocObj = selectedAlloc
    ? sorted.find((a) => a.allocation_id === selectedAlloc)
    : null;

  if (state.isGenerating) {
    return (
      <div className="page-wrapper">
        <Spinner label="Evaluating constraints and computing allocation plan…" />
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Dispatch Plan</h1>
            <p className="page-subtitle">
              {plan
                ? `${plan.allocations.length} allocations · Strategy: ${plan.label === 'scenario' ? 'Scenario Replan' : 'Economic-Urgency Optimized'}`
                : 'No plan generated. Generate a plan to see allocations.'}
              {state.scenarioPlan && (
                <span className="status-badge status-time-sensitive" style={{ marginLeft: 8 }}>
                  Scenario Active
                </span>
              )}
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={generatePlan}
            disabled={state.isGenerating}
          >
            ⚡ {plan ? 'Regenerate Plan' : 'Generate Plan'}
          </button>
        </div>
      </div>

      {!plan ? (
        <EmptyState
          icon="📦"
          title="No plan yet"
          desc="Click 'Generate Plan' to compute an optimized allocation using economic-urgency scoring. All constraints will be enforced."
          action={
            <button className="btn btn-primary btn-lg" onClick={generatePlan}>
              ⚡ Generate Plan
            </button>
          }
        />
      ) : (
        <>
          {/* Summary strip */}
          <div className="stat-grid mb-6 anim-fade-up">
            {[
              ['Allocations', plan.allocations.length, ''],
              ['Total Dispatched', Math.round(plan.metrics.total_allocated_kg), 'kg'],
              ['Gross Revenue', `₹${Math.round(plan.metrics.gross_revenue).toLocaleString('en-IN')}`, ''],
              ['Net Revenue', `₹${Math.round(plan.metrics.net_revenue).toLocaleString('en-IN')}`, ''],
              ['Est. Spoilage', Math.round(plan.metrics.estimated_spoilage_kg), 'kg'],
              ['Feasibility Violations', plan.metrics.feasibility_violations, ''],
            ].map(([label, val, unit]) => (
              <div key={label as string} className="card card-sm">
                <div className="card-title">{label}</div>
                <div className="card-value card-value-sm num">{val}{unit}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div className="filter-bar anim-fade-up anim-fade-up-1">
            <select
              className="filter-select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="priority">Sort: Priority</option>
              <option value="expiry">Sort: Earliest Expiry</option>
              <option value="value">Sort: Highest Value</option>
              <option value="commodity">Sort: Commodity</option>
              <option value="destination">Sort: Destination</option>
              <option value="feasibility">Sort: Feasibility</option>
            </select>
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
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="READY">Ready</option>
              <option value="TIME_SENSITIVE">Time-Sensitive</option>
              <option value="INFEASIBLE">Infeasible</option>
            </select>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {sorted.length} allocations shown
            </span>
          </div>

          {/* Allocations table */}
          <div className="table-wrap anim-fade-up anim-fade-up-2">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Batch</th>
                  <th>Commodity</th>
                  <th>Qty (kg)</th>
                  <th>Destination</th>
                  <th>Travel</th>
                  <th>Margin</th>
                  <th>Status</th>
                  <th>Sell ₹/kg</th>
                  <th>Transport ₹</th>
                  <th>Net Rev ₹</th>
                  <th>Why?</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <React.Fragment key={a.allocation_id}>
                    <tr
                      className={selectedAlloc === a.allocation_id ? 'selected' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() =>
                        setSelectedAlloc(
                          selectedAlloc === a.allocation_id ? null : a.allocation_id
                        )
                      }
                    >
                      <td className="mono" style={{ color: 'var(--text-subtle)' }}>
                        {a.dispatch_priority}
                      </td>
                      <td className="mono bold">{a.batch.batch_id}</td>
                      <td>
                        <span className="pill">{a.batch.commodity}</span>
                      </td>
                      <td className="num bold">{Math.round(a.quantity_kg)}</td>
                      <td style={{ fontWeight: 600 }}>{a.destination.name}</td>
                      <td className="num">{a.route.travel_time_hours}h</td>
                      <td style={{ minWidth: 120 }}>
                        <MarginBar
                          status={a.feasibility.status}
                          marginHours={a.feasibility.usable_margin_hours}
                          maxHours={a.batch.remaining_shelf_life_hours}
                        />
                      </td>
                      <td>
                        <FeasibilityBadge
                          status={a.feasibility.status}
                          margin={a.feasibility.usable_margin_hours}
                        />
                      </td>
                      <td className="num">₹{a.selling_price_per_kg}</td>
                      <td className="num">₹{Math.round(a.transport_cost_total).toLocaleString('en-IN')}</td>
                      <td
                        className="num bold"
                        style={{
                          color:
                            a.net_revenue_contribution >= 0
                              ? 'var(--ready-text)'
                              : 'var(--danger-text)',
                        }}
                      >
                        ₹{Math.round(a.net_revenue_contribution).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAlloc(
                              selectedAlloc === a.allocation_id ? null : a.allocation_id
                            );
                          }}
                        >
                          {selectedAlloc === a.allocation_id ? '▲ Hide' : '▼ Explain'}
                        </button>
                      </td>
                    </tr>
                    {selectedAlloc === a.allocation_id && selectedAllocObj && (
                      <tr>
                        <td colSpan={12} style={{ padding: '0 var(--space-4) var(--space-4)' }}>
                          <ExplanationPanel
                            allocation={selectedAllocObj}
                            onClose={() => setSelectedAlloc(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Unallocated */}
          {plan.unallocated_batches.length > 0 && (
            <div className="card anim-fade-up anim-fade-up-3" style={{ marginTop: 'var(--space-6)', borderColor: 'var(--warning)' }}>
              <div className="card-title" style={{ color: 'var(--warning-text)' }}>
                Unallocated / Residual ({plan.unallocated_batches.length})
              </div>
              {plan.unallocated_batches.map((u) => (
                <div
                  key={u.batch.batch_id + u.reason}
                  style={{
                    display: 'flex',
                    gap: 'var(--space-4)',
                    alignItems: 'center',
                    padding: 'var(--space-3) 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span className="mono">{u.batch.batch_id}</span>
                  <span className="pill">{u.batch.commodity}</span>
                  <span className="num">{formatKg(u.batch.quantity_kg)}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-muted)' }}>
                    {u.reason}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Discount recommendations */}
          {plan.metrics.discount_recommendations.length > 0 && (
            <div className="card anim-fade-up anim-fade-up-4" style={{ marginTop: 'var(--space-6)', borderColor: 'var(--accent)' }}>
              <div className="card-title" style={{ color: 'var(--accent-light)' }}>
                💰 Discount Recommendations ({plan.metrics.discount_recommendations.length})
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                Demand response uses an illustrative 15% uplift per 10% discount. This is a recommendation only. Actual response depends on local market conditions.
              </p>
              {plan.metrics.discount_recommendations.map((rec) => (
                <div
                  key={rec.batch.batch_id}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: 'var(--space-4)',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <span className="mono bold">{rec.batch.batch_id}</span>
                    <span className="pill">{rec.batch.commodity}</span>
                    <span className="num">{formatKg(rec.quantity_at_risk_kg)} at risk</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 16, color: 'var(--warning-text)' }}>
                      {rec.recommended_discount_pct > 0
                        ? `−${rec.recommended_discount_pct}% recommended`
                        : 'No discount needed'}
                    </span>
                  </div>
                  {[
                    ['At-risk qty', formatKg(rec.quantity_at_risk_kg)],
                    ['Margin remaining', `${rec.remaining_margin_hours}h`],
                    ['Discounted price', `₹${rec.discounted_price_per_kg.toFixed(0)}/kg (was ₹${(rec.discounted_price_per_kg / (1 - rec.recommended_discount_pct / 100 || 1)).toFixed(0)})`],
                    ['Est. qty sold', formatKg(rec.expected_qty_sold_at_discount_kg)],
                    ['Revenue at discount', formatINR(rec.revenue_at_discount)],
                    ['Revenue without', formatINR(rec.revenue_without_discount)],
                    ['Revenue impact', formatINR(rec.revenue_impact)],
                  ].map(([label, value]) => (
                    <div key={label} className="explain-row">
                      <span className="explain-label">{label}</span>
                      <span className="explain-value">{value}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 'var(--space-3)', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    ⚠ {rec.limitation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
