// FreshRoute — Scenario Lab (What-If)
// Disruption replanning: truck unavailable, demand shock, shelf-life shock.

import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import { ROUTES, DESTINATIONS, BATCHES } from '../data/dataset';
import { EmptyState, formatINR, formatKg, FeasibilityBadge, Spinner } from './shared';
import type { ScenarioModification } from '../types';

interface ScenarioDef {
  id: string;
  title: string;
  icon: string;
  description: string;
  label: 'A' | 'B' | 'C';
  buildMods: () => ScenarioModification[];
}

const SCENARIOS: ScenarioDef[] = [
  {
    id: 'truck-unavailable',
    title: 'Truck Unavailable',
    icon: '🚛',
    label: 'A',
    description:
      'The Mumbai truck (Route R-NAS-MUM) breaks down. The system re-routes allocations to Pune, Aurangabad, and local markets — or marks them unallocatable.',
    buildMods: () => [
      {
        type: 'route_unavailable',
        route_id: 'R-NAS-MUM',
        description: 'Mumbai route disabled — vehicle breakdown',
      },
    ],
  },
  {
    id: 'demand-shock',
    title: 'Demand Shock',
    icon: '📉',
    label: 'B',
    description:
      'Tomato demand in Mumbai drops by 50% due to a competing local harvest. The system identifies stock that needs re-routing or discounting.',
    buildMods: () => [
      {
        type: 'demand_shock',
        destination_id: 'D-MUM',
        commodity: 'Tomatoes',
        demand_factor: 0.5,
        description: 'Mumbai tomato demand reduced to 50%',
      },
    ],
  },
  {
    id: 'shelf-life-shock',
    title: 'Shelf-Life Shock',
    icon: '⏱',
    label: 'C',
    description:
      'Batch B-001 (Tomatoes) reveals earlier-than-expected ripeness — remaining shelf life reduced by 6 hours. Feasibility changes for longer routes.',
    buildMods: () => [
      {
        type: 'shelf_life_shock',
        batch_id: 'B-001',
        shelf_life_reduction_hours: 6,
        description: 'B-001 shelf life reduced by 6h due to accelerated ripening',
      },
    ],
  },
];

const ScenarioResultComparison: React.FC = () => {
  const { state } = useApp();
  const { optimized, scenarioPlan } = state;

  if (!optimized || !scenarioPlan) return null;

  const om = optimized.metrics;
  const sm = scenarioPlan.metrics;

  const rows = [
    { label: 'Net Revenue', base: formatINR(om.net_revenue), scenario: formatINR(sm.net_revenue), delta: sm.net_revenue - om.net_revenue, goodIfPositive: true },
    { label: 'Allocated (kg)', base: formatKg(om.total_allocated_kg), scenario: formatKg(sm.total_allocated_kg), delta: sm.total_allocated_kg - om.total_allocated_kg, goodIfPositive: true },
    { label: 'Est. Spoilage', base: formatKg(om.estimated_spoilage_kg), scenario: formatKg(sm.estimated_spoilage_kg), delta: sm.estimated_spoilage_kg - om.estimated_spoilage_kg, goodIfPositive: false },
    { label: 'Fulfillment Rate', base: `${(om.fulfillment_rate * 100).toFixed(1)}%`, scenario: `${(sm.fulfillment_rate * 100).toFixed(1)}%`, delta: (sm.fulfillment_rate - om.fulfillment_rate) * 100, goodIfPositive: true, suffix: 'pp' },
    { label: 'Allocations', base: String(om.total_allocated_kg > 0 ? optimized.allocations.length : 0), scenario: String(scenarioPlan.allocations.length), delta: scenarioPlan.allocations.length - optimized.allocations.length, goodIfPositive: true },
  ];

  return (
    <div className="card" style={{ marginTop: 'var(--space-5)', borderColor: 'var(--warning-text)' }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
        Scenario Impact vs Optimized Plan
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: 'var(--space-4)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-subtle)' }}>
        <span>Metric</span><span>Before</span><span>After</span><span>Δ</span>
      </div>
      {rows.map((row) => {
        const isGood = row.goodIfPositive ? row.delta >= 0 : row.delta <= 0;
        const isNeutral = Math.abs(row.delta) < 0.01;
        return (
          <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: 'var(--space-4)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>{row.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-secondary)' }}>{row.base}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--warning-text)' }}>{row.scenario}</span>
            <span style={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              fontSize: 12.5,
              color: isNeutral ? 'var(--text-muted)' : isGood ? 'var(--ready-text)' : 'var(--danger-text)',
            }}>
              {isNeutral ? '—' : `${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(row.suffix === 'pp' ? 1 : 0)}${row.suffix ?? ''}`}
            </span>
          </div>
        );
      })}

      {/* Allocation changes */}
      <div style={{ marginTop: 'var(--space-5)' }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 'var(--space-3)' }}>
          Changed Allocations
        </div>
        {scenarioPlan.allocations.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--danger-text)', fontWeight: 600 }}>⚠ No feasible allocations in this scenario.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Commodity</th>
                  <th>Destination</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Net Rev.</th>
                </tr>
              </thead>
              <tbody>
                {scenarioPlan.allocations.slice(0, 8).map((a) => (
                  <tr key={a.allocation_id}>
                    <td className="mono bold">{a.batch.batch_id}</td>
                    <td><span className="pill">{a.batch.commodity}</span></td>
                    <td>{a.destination.name}</td>
                    <td className="num">{formatKg(a.quantity_kg)}</td>
                    <td><FeasibilityBadge status={a.feasibility.status} margin={a.feasibility.usable_margin_hours} /></td>
                    <td className="num bold" style={{ color: a.net_revenue_contribution >= 0 ? 'var(--ready-text)' : 'var(--danger-text)' }}>
                      {formatINR(a.net_revenue_contribution)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {scenarioPlan.unallocated_batches.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--danger-bg)', borderRadius: 'var(--radius)', border: '1px solid rgba(255,59,48,0.25)' }}>
            <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--danger-text)', marginBottom: 'var(--space-2)' }}>
              Newly Unallocated ({scenarioPlan.unallocated_batches.length})
            </div>
            {scenarioPlan.unallocated_batches.map((u) => (
              <div key={u.batch.batch_id + u.reason} style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                <strong className="mono">{u.batch.batch_id}</strong> {u.batch.commodity} — {u.reason}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const ScenarioSection: React.FC = () => {
  const { state, applyScenario, resetScenario, navigate } = useApp();
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  const handleApply = (scenario: ScenarioDef) => {
    setActiveScenarioId(scenario.id);
    applyScenario(scenario.buildMods());
    navigate('dispatch');
  };

  const handleReset = () => {
    setActiveScenarioId(null);
    resetScenario();
  };

  const hasScenario = !!state.scenarioPlan;

  if (state.isGenerating) {
    return (
      <div className="page-wrapper">
        <Spinner label="Recalculating allocation plan with scenario constraints…" />
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Scenario Lab</h1>
            <p className="page-subtitle">
              Apply a disruption. The engine recalculates the full allocation plan — not a simulation. Real constraints, real recalculation.
            </p>
          </div>
          {hasScenario && (
            <button className="btn btn-danger btn-sm" onClick={handleReset}>
              ↺ Reset Scenario
            </button>
          )}
        </div>
      </div>

      {!state.optimized ? (
        <EmptyState
          icon="🔬"
          title="Generate a base plan first"
          desc="Go to Command or Dispatch and generate the initial plan, then return here to test scenarios."
          action={
            <button className="btn btn-primary" onClick={() => navigate('command')}>
              Go to Command →
            </button>
          }
        />
      ) : (
        <>
          {hasScenario && (
            <div className="action-banner warning anim-fade-up">
              <div>
                <div style={{ fontWeight: 700, color: 'var(--warning-text)', fontSize: 14 }}>
                  ◆ Scenario Active
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  The Dispatch view now shows the scenario plan. Reset to restore the original optimized plan.
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={handleReset}>
                ↺ Reset to Original
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
            {SCENARIOS.map((scenario, i) => (
              <div
                key={scenario.id}
                className={`scenario-card anim-fade-up ${activeScenarioId === scenario.id && hasScenario ? 'active-scenario' : ''}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius)',
                      background: 'var(--surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    {scenario.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Scenario {scenario.label}
                    </div>
                    <div className="scenario-title">{scenario.title}</div>
                  </div>
                  {activeScenarioId === scenario.id && hasScenario && (
                    <span className="status-badge status-time-sensitive" style={{ marginLeft: 'auto', flexShrink: 0 }}>Active</span>
                  )}
                </div>
                <p className="scenario-desc">{scenario.description}</p>
                <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleApply(scenario)}
                    style={{ flex: 1 }}
                  >
                    Apply → Dispatch
                  </button>
                  {activeScenarioId === scenario.id && hasScenario && (
                    <button className="btn btn-ghost btn-sm" onClick={handleReset}>
                      Reset
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* What-If controls */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="card-title" style={{ marginBottom: 'var(--space-3)' }}>What if something changes?</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              The three predefined scenarios above cover the most common disruptions. Each invokes the real allocation engine with modified inputs.
              Results are isolated from the original data — resetting always restores the original plan.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 'var(--space-4)' }}>
              {[
                { icon: '🚛', label: 'Route blocked', action: 'Scenario A' },
                { icon: '📉', label: 'Demand drop', action: 'Scenario B' },
                { icon: '⏱', label: 'Earlier expiry', action: 'Scenario C' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: 'var(--space-4)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 'var(--space-2)' }}>{item.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>→ {item.action}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Scenario comparison */}
          {hasScenario && (
            <ScenarioResultComparison />
          )}
        </>
      )}
    </div>
  );
};
