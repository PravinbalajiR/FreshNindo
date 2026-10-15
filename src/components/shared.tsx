// Shared utility components
import React from 'react';
import type { FeasibilityStatus } from '../types';

interface FeasibilityBadgeProps {
  status: FeasibilityStatus;
  margin?: number;
}

export const FeasibilityBadge: React.FC<FeasibilityBadgeProps> = ({
  status,
  margin,
}) => {
  const classMap: Record<FeasibilityStatus, string> = {
    READY: 'status-badge status-ready',
    TIME_SENSITIVE: 'status-badge status-time-sensitive',
    INFEASIBLE: 'status-badge status-infeasible',
  };
  const labelMap: Record<FeasibilityStatus, string> = {
    READY: '● Ready',
    TIME_SENSITIVE: '◆ Time-Sensitive',
    INFEASIBLE: '✕ Infeasible',
  };
  return (
    <span className={classMap[status]}>
      {labelMap[status]}
      {margin !== undefined && status !== 'INFEASIBLE' && (
        <span style={{ fontWeight: 400, opacity: 0.8, marginLeft: 3 }}>
          {margin.toFixed(1)}h
        </span>
      )}
    </span>
  );
};

interface MarginBarProps {
  status: FeasibilityStatus;
  marginHours: number;
  maxHours?: number;
}

export const MarginBar: React.FC<MarginBarProps> = ({
  status,
  marginHours,
  maxHours = 24,
}) => {
  const pct = Math.max(0, Math.min(100, (marginHours / maxHours) * 100));
  const classMap: Record<FeasibilityStatus, string> = {
    READY: 'ready',
    TIME_SENSITIVE: 'time-sensitive',
    INFEASIBLE: 'infeasible',
  };
  return (
    <div className="margin-bar-wrap">
      <div className="margin-bar-track">
        <div
          className={`margin-bar-fill ${classMap[status]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className="mono"
        style={{ fontSize: 11, color: 'var(--text-subtle)', minWidth: 36 }}
      >
        {marginHours < 0 ? '—' : `${marginHours.toFixed(1)}h`}
      </span>
    </div>
  );
};

export const Spinner: React.FC<{ label?: string }> = ({ label }) => (
  <div className="loading-overlay">
    <div className="spinner" />
    {label && <span>{label}</span>}
  </div>
);

export const EmptyState: React.FC<{
  icon?: string;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}> = ({ icon, title, desc, action }) => (
  <div className="empty-state">
    {icon && <div className="empty-state-icon">{icon}</div>}
    <div className="empty-state-title">{title}</div>
    {desc && <div className="empty-state-desc">{desc}</div>}
    {action && <div style={{ marginTop: 'var(--space-5)' }}>{action}</div>}
  </div>
);

export const formatINR = (n: number): string =>
  `₹${Math.abs(n).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;

export const formatKg = (n: number): string =>
  `${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })} kg`;

export const formatPct = (n: number): string => `${(n * 100).toFixed(1)}%`;

export const DiffChip: React.FC<{
  value: number;
  formatter?: (n: number) => string;
  invertSign?: boolean; // true = negative diff is "good" (e.g. spoilage)
}> = ({ value, formatter, invertSign = false }) => {
  const isGood = invertSign ? value < 0 : value > 0;
  const isNeutral = Math.abs(value) < 0.001;
  const cls = isNeutral
    ? 'comparison-diff diff-neutral'
    : isGood
    ? 'comparison-diff diff-positive'
    : 'comparison-diff diff-negative';

  const fmt = formatter ?? ((n: number) => n.toFixed(0));
  const sign = value > 0 ? '+' : '';
  return <span className={cls}>{isNeutral ? '—' : `${sign}${fmt(value)}`}</span>;
};
