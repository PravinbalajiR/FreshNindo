// FreshRoute — Shipment tracking: simulated clock + 3D truck + live freshness numbers.
// Trucks are simulated (no GPS feed): each load starts part-way along its trip
// according to dispatch priority, and plays forward at 12 simulated minutes per second.

import React, { lazy, Suspense, useEffect, useState } from 'react';
import type { Allocation } from '../../types';
import type { Directions } from '../../services/directions';
import { straightLine } from '../../services/directions';
import { ORIGIN_COORDINATES } from '../../data/dataset';
import { FRESHNESS_COLOR } from '../../engine/supplyChain';
import { FeasibilityBadge, formatKg } from '../shared';

const ShipmentTracker3D = lazy(() => import('../three/ShipmentTracker3D'));

export function initialElapsed(a: Allocation): number {
  const frac = Math.max(0.05, Math.min(0.75, 0.75 - 0.15 * (a.dispatch_priority - 1)));
  return +(a.route.travel_time_hours * frac).toFixed(2);
}

export function useShipmentSim(a: Allocation | null) {
  const [hours, setHours] = useState(0);
  const [playing, setPlaying] = useState(true);
  const travel = a?.route.travel_time_hours ?? 1;

  useEffect(() => {
    if (a) {
      setHours(initialElapsed(a));
      setPlaying(true);
    }
  }, [a?.allocation_id]);

  useEffect(() => {
    if (!playing || !a) return;
    const id = setInterval(() => {
      setHours((h) => {
        const next = +(h + 0.02).toFixed(2);
        if (next >= travel) {
          setPlaying(false);
          return travel;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, travel, a]);

  return { hours, setHours, playing, setPlaying, progress: Math.min(1, hours / travel), travel };
}

const fmtH = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
};

interface ShipmentPanelProps {
  allocation: Allocation;
  directions?: Directions;
  sim: ReturnType<typeof useShipmentSim>;
}

export const ShipmentPanel: React.FC<ShipmentPanelProps> = ({ allocation: a, directions, sim }) => {
  const [follow, setFollow] = useState(false);
  const path = directions?.path ?? straightLine(ORIGIN_COORDINATES, a.destination.coordinates).path;
  const delivered = sim.hours >= sim.travel;
  const shelfNow = a.batch.remaining_shelf_life_hours - sim.hours;
  const color = FRESHNESS_COLOR[a.feasibility.status];
  const km = directions ? Math.round(directions.distance_km * sim.progress) : null;

  return (
    <div className="stack">
      <Suspense fallback={<div className="scene-frame" style={{ height: 400, display: 'grid', placeItems: 'center' }}>Loading 3D…</div>}>
        <ShipmentTracker3D
          path={path}
          progress={sim.progress}
          originLabel="Nashik DC"
          destLabel={a.destination.region}
          freshColor={color}
          follow={follow}
        >
          <span className="scene-chip">🚚 {a.batch.commodity} · {formatKg(a.quantity_kg)}</span>
          <span className="scene-chip">
            <span className="dot" style={{ background: delivered ? '#1f9d55' : '#0071e3' }} />
            {delivered ? 'Delivered' : 'In transit'}
          </span>
          {directions?.approximate && <span className="scene-chip">⚠ Approximate path</span>}
        </ShipmentTracker3D>
      </Suspense>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={() => {
              if (delivered) sim.setHours(0);
              sim.setPlaying(delivered ? true : !sim.playing);
            }} style={{ minWidth: 96, justifyContent: 'center' }}>
            {delivered ? '↺ Replay' : sim.playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <div className="segmented">
            <button className={!follow ? 'on' : ''} onClick={() => setFollow(false)}>Overview</button>
            <button className={follow ? 'on' : ''} onClick={() => setFollow(true)}>Follow truck</button>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>Simulated clock · 1 s = 12 min</span>
        </div>

        <input
          type="range"
          min={0}
          max={sim.travel}
          step={0.05}
          value={sim.hours}
          onChange={(e) => {
            sim.setPlaying(false);
            sim.setHours(+e.target.value);
          }}
          style={{ width: '100%', accentColor: '#0071e3' }}
          aria-label="Trip progress"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          <span>Departed Nashik DC</span>
          <span>{Math.round(sim.progress * 100)}% {km !== null ? `· ${km} km driven` : ''}</span>
          <span>{a.destination.name}</span>
        </div>

        <div className="grid-2" style={{ gap: 16 }}>
          <div>
            <div className="card-title">Arrives in</div>
            <div className="big-number">{delivered ? 'Arrived' : fmtH(sim.travel - sim.hours)}</div>
            <div className="card-meta">then {a.destination.handling_time_hours}h unloading</div>
          </div>
          <div>
            <div className="card-title">Shelf life left now</div>
            <div className="big-number" style={{ color }}>{fmtH(Math.max(0, shelfNow))}</div>
            <div className="card-meta">
              Fresh Window on arrival: <FeasibilityBadge status={a.feasibility.status} margin={a.feasibility.usable_margin_hours} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
