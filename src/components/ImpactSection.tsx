// FreshRoute — Impact Section (Baseline vs Proposed)
// The proof screen. Honest comparison with computed metrics.

import React from 'react';
import { useApp } from '../store/AppContext';
import { EmptyState, DiffChip, formatINR, formatKg, formatPct, Spinner } from './shared';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const MetricRow: React.FC<{
  label: string;
  baselineVal: string | number;
  proposedVal: string | number;
  diffNode: React.ReactNode;
  note?: string;
}> = ({ label, baselineVal, proposedVal, diffNode, note }) => (
  <div className="comparison-row">
    <div>
      <div className="comparison-label">{label}</div>
      {note && <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 2 }}>{note}</div>}
    </div>
    <div className="comparison-value num">{baselineVal}</div>
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
      <div className="comparison-value num" style={{ color: 'var(--accent-light)' }}>{proposedVal}</div>
      {diffNode}
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12.5 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}
        </div>
      ))}
    </div>
  );
};

export const ImpactSection: React.FC = () => {
  const { state, generatePlan } = useApp();
  const { baseline, optimized, comparison, isGenerating } = state;

  if (isGenerating) {
    return (
      <div className="page-wrapper">
        <Spinner label="Computing baseline and optimized plans…" />
      </div>
    );
  }

  if (!baseline || !optimized || !comparison) {
    return (
      <div className="page-wrapper">
        <EmptyState
          icon="📊"
          title="No comparison yet"
          desc="Generate a plan first. The system will compute both the baseline (earliest-expiry-first) and the optimized plan using identical inputs, then compare their outcomes honestly."
          action={
            <button className="btn btn-primary btn-lg" onClick={generatePlan}>
              ⚡ Generate Plans
            </button>
          }
        />
      </div>
    );
  }

  const bm = baseline.metrics;
  const om = optimized.metrics;

  // Bar chart data
  const revenueData = [
    { name: 'Gross Revenue', Baseline: Math.round(bm.gross_revenue), Optimized: Math.round(om.gross_revenue) },
    { name: 'Transport Cost', Baseline: Math.round(bm.total_transport_cost), Optimized: Math.round(om.total_transport_cost) },
    { name: 'Net Revenue', Baseline: Math.round(bm.net_revenue), Optimized: Math.round(om.net_revenue) },
  ];

  const spoilageData = [
    { name: 'Spoilage (kg)', Baseline: Math.round(bm.estimated_spoilage_kg), Optimized: Math.round(om.estimated_spoilage_kg) },
    { name: 'Unsold (kg)', Baseline: Math.round(bm.unsold_kg), Optimized: Math.round(om.unsold_kg) },
    { name: 'Allocated (kg)', Baseline: Math.round(bm.total_allocated_kg), Optimized: Math.round(om.total_allocated_kg) },
  ];

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Impact Analysis</h1>
            <p className="page-subtitle">
              Baseline vs Optimized — identical inputs, same constraints, same evaluation logic.
              No data manipulation. If optimized performs worse on a metric, it is shown honestly.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={generatePlan}>
            Recalculate
          </button>
        </div>
      </div>

      {/* Strategy descriptions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card" style={{ borderLeft: '3px solid var(--neutral-text)' }}>
          <div className="card-title">Baseline Strategy</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {baseline.strategy_description}
          </div>
        </div>
        <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="card-title" style={{ color: 'var(--accent-light)' }}>Optimized Strategy</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {optimized.strategy_description}
          </div>
        </div>
      </div>

      {/* Comparison header row */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Metric</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Baseline</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Optimized · Δ</div>
        </div>

        {/* Revenue */}
        <MetricRow
          label="Gross Revenue"
          baselineVal={formatINR(bm.gross_revenue)}
          proposedVal={formatINR(om.gross_revenue)}
          diffNode={<DiffChip value={comparison.net_revenue_diff + (bm.total_transport_cost - om.total_transport_cost) + (bm.total_acquisition_cost - om.total_acquisition_cost)} formatter={(n) => `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`} />}
          note="Sum of selling_price × quantity for all allocations"
        />
        <MetricRow
          label="Transport Cost"
          baselineVal={formatINR(bm.total_transport_cost)}
          proposedVal={formatINR(om.total_transport_cost)}
          diffNode={<DiffChip value={comparison.transport_cost_diff} formatter={(n) => `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`} invertSign />}
          note="Sum of transport_cost_per_kg × quantity"
        />
        <MetricRow
          label="Net Revenue"
          baselineVal={formatINR(bm.net_revenue)}
          proposedVal={formatINR(om.net_revenue)}
          diffNode={<DiffChip value={comparison.net_revenue_diff} formatter={(n) => `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`} />}
          note="Gross − Acquisition cost − Transport cost"
        />

        <hr className="divider" />

        {/* Fulfillment */}
        <MetricRow
          label="Fulfilled Demand"
          baselineVal={formatKg(bm.fulfilled_demand_kg)}
          proposedVal={formatKg(om.fulfilled_demand_kg)}
          diffNode={<DiffChip value={comparison.fulfillment_diff_kg} formatter={(n) => `${Math.abs(Math.round(n))} kg`} />}
          note="Total quantity in valid allocations"
        />
        <MetricRow
          label="Fulfillment Rate"
          baselineVal={formatPct(bm.fulfillment_rate)}
          proposedVal={formatPct(om.fulfillment_rate)}
          diffNode={<DiffChip value={comparison.fulfillment_rate_diff} formatter={(n) => `${(Math.abs(n) * 100).toFixed(1)}pp`} />}
          note="fulfilled_demand_kg / total_demand_kg"
        />
        <MetricRow
          label="Unsold Inventory"
          baselineVal={formatKg(bm.unsold_kg)}
          proposedVal={formatKg(om.unsold_kg)}
          diffNode={<DiffChip value={om.unsold_kg - bm.unsold_kg} formatter={(n) => `${Math.abs(Math.round(n))} kg`} invertSign />}
          note="Total inventory − allocated quantity"
        />

        <hr className="divider" />

        {/* Spoilage */}
        <MetricRow
          label="Est. Spoilage"
          baselineVal={formatKg(bm.estimated_spoilage_kg)}
          proposedVal={formatKg(om.estimated_spoilage_kg)}
          diffNode={<DiffChip value={comparison.spoilage_diff_kg} formatter={(n) => `${Math.abs(Math.round(n))} kg`} invertSign />}
          note="Unallocated kg from batches with ≤24h shelf life"
        />
        <MetricRow
          label="Spoilage Rate"
          baselineVal={formatPct(bm.spoilage_rate)}
          proposedVal={formatPct(om.spoilage_rate)}
          diffNode={<DiffChip value={comparison.spoilage_rate_diff} formatter={(n) => `${(Math.abs(n) * 100).toFixed(1)}pp`} invertSign />}
          note="spoiled_kg / total_inventory_kg"
        />

        <hr className="divider" />

        {/* Other */}
        <MetricRow
          label="Feasibility Violations"
          baselineVal={bm.feasibility_violations}
          proposedVal={om.feasibility_violations}
          diffNode={<DiffChip value={comparison.feasibility_violations_diff} formatter={(n) => `${Math.abs(Math.round(n))}`} invertSign />}
          note="Allocations with INFEASIBLE shelf-life margin (should be 0)"
        />
        <MetricRow
          label="Discount Recommendations"
          baselineVal={bm.discount_recommendations.length}
          proposedVal={om.discount_recommendations.length}
          diffNode={<DiffChip value={om.discount_recommendations.length - bm.discount_recommendations.length} />}
          note="Batches recommended for price reduction"
        />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Revenue comparison */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Revenue Breakdown (₹)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
              <Bar dataKey="Baseline" fill="var(--neutral-text)" radius={[3,3,0,0]} />
              <Bar dataKey="Optimized" fill="var(--accent)" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Inventory disposition */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Inventory Disposition (kg)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={spoilageData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
              <Bar dataKey="Baseline" fill="var(--neutral-text)" radius={[3,3,0,0]} />
              <Bar dataKey="Optimized" fill="var(--accent)" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Honesty notice */}
      <div className="card" style={{ borderLeft: '3px solid var(--warning-text)' }}>
        <div className="card-title" style={{ color: 'var(--warning-text)' }}>Methodology Disclosures</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <p>• Both plans use identical input data: {state.batches.length} batches, {state.routes.length} destinations, {state.routes.length} routes.</p>
          <p>• Net revenue = gross revenue − acquisition cost − transport cost. No double-counting.</p>
          <p>• Spoilage estimates apply only to batches with ≤24h remaining shelf life and unallocated residual. Unsold ≠ spoiled for stable batches.</p>
          <p>• The optimized plan uses a greedy heuristic (economic-urgency scoring) — <strong>not a proven mathematical optimum</strong>.</p>
          <p>• Discount demand response is an illustrative assumption (15% uplift per 10% discount). Not derived from observed price elasticity.</p>
          <p>• Data is synthetic and clearly labeled as such throughout the application.</p>
        </div>
      </div>
    </div>
  );
};
