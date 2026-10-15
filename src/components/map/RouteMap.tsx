// FreshRoute — Route decision map (Leaflet + OpenStreetMap / CARTO light tiles).
// Every corridor is drawn on its real road path and coloured by the optimizer's
// decision: chosen, chosen-but-urgent, blocked, or not used.

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ORIGIN, ORIGIN_COORDINATES } from '../../data/dataset';
import type { Directions } from '../../services/directions';
import { ROUTE_STATUS_META, type RouteDecision } from '../../engine/supplyChain';

interface RouteMapProps {
  decisions: RouteDecision[];
  directions: Record<string, Directions>;
  selectedRouteId: string | null;
  onSelectRoute: (id: string | null) => void;
  /** Destination to emphasise (e.g. the retailer's own market). */
  focusDestinationId?: string;
  /** Moving truck marker: route + 0..1 progress along its path. */
  truck?: { routeId: string; progress: number } | null;
  loading?: boolean;
  approximate?: boolean;
  height?: number;
}

function pointAlong(path: [number, number][], t: number): [number, number] {
  if (path.length < 2) return path[0] ?? [ORIGIN_COORDINATES.lat, ORIGIN_COORDINATES.lng];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    seg.push(d);
    total += d;
  }
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i]) {
      const f = seg[i] === 0 ? 0 : target / seg[i];
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f];
    }
    target -= seg[i];
  }
  return path[path.length - 1];
}

const pin = (html: string) => L.divIcon({ className: 'pin-icon', html, iconSize: [0, 0] });

export const RouteMap: React.FC<RouteMapProps> = ({
  decisions,
  directions,
  selectedRouteId,
  onSelectRoute,
  focusDestinationId,
  truck,
  loading,
  approximate,
  height = 520,
}) => {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const truckRef = useRef<L.Marker | null>(null);
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelectRoute);
  onSelectRef.current = onSelectRoute;

  // Create the map once
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true, attributionControl: true }).setView(
      [ORIGIN_COORDINATES.lat - 0.5, ORIGIN_COORDINATES.lng + 0.3],
      7
    );
    // Free OpenStreetMap tiles (no key). Softened via CSS so route colours stand out.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);
    map.on('click', () => onSelectRef.current(null));
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // Container can mount at 0 size inside animated layouts
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // Draw routes + pins whenever decisions/directions/selection change
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const bounds = L.latLngBounds([[ORIGIN_COORDINATES.lat, ORIGIN_COORDINATES.lng]]);
    // Draw unselected first so the selected route sits on top
    const ordered = [...decisions].sort(
      (a, b) => Number(a.route.route_id === selectedRouteId) - Number(b.route.route_id === selectedRouteId)
    );

    for (const d of ordered) {
      const dir = directions[d.route.route_id];
      const path: [number, number][] = dir?.path ?? [
        [ORIGIN_COORDINATES.lat, ORIGIN_COORDINATES.lng],
        [d.destination.coordinates.lat, d.destination.coordinates.lng],
      ];
      path.forEach((p) => bounds.extend(p));
      const meta = ROUTE_STATUS_META[d.status];
      const isSel = d.route.route_id === selectedRouteId;
      const dimmed = selectedRouteId !== null && !isSel;

      const casing = L.polyline(path, { color: '#ffffff', weight: isSel ? 12 : 9, opacity: dimmed ? 0.4 : 0.95 });
      const line = L.polyline(path, {
        color: meta.color,
        weight: isSel ? 7 : 5,
        opacity: dimmed ? 0.35 : 1,
        dashArray: meta.dash,
        lineCap: 'round',
      });
      const tip = `<b>${d.destination.name}</b><br/>${meta.label} · ${dir ? `${dir.distance_km} km by road` : 'loading road…'}`;
      [casing, line].forEach((pl) => {
        pl.bindTooltip(tip, { sticky: true });
        pl.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(d.route.route_id);
        });
        pl.addTo(layer);
      });

      const mine = d.destination.destination_id === focusDestinationId;
      const label = `${mine ? '★ ' : ''}${d.destination.region}${d.shipped_kg > 0 ? ` · ${Math.round(d.shipped_kg)} kg` : ''}`;
      L.marker([d.destination.coordinates.lat, d.destination.coordinates.lng], {
        icon: pin(`<span class="map-pin ${mine ? 'mine' : ''} ${dimmed ? 'dim' : ''}" style="border-color:${mine ? '' : meta.color}">${label}</span>`),
        zIndexOffset: isSel ? 1000 : 0,
      })
        .on('click', () => onSelectRef.current(d.route.route_id))
        .addTo(layer);
    }

    // Origin goes last so it is never hidden by Nashik Local's pin
    L.marker([ORIGIN_COORDINATES.lat + 0.12, ORIGIN_COORDINATES.lng], {
      icon: pin(`<span class="map-pin origin" title="${ORIGIN}">🏭 Nashik DC</span>`),
      zIndexOffset: 2000,
    }).addTo(layer);

    if (!fittedRef.current && Object.keys(directions).length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
      fittedRef.current = true;
    }
  }, [decisions, directions, selectedRouteId, focusDestinationId]);

  // Zoom to the selected route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedRouteId) return;
    const dir = directions[selectedRouteId];
    if (dir) map.flyToBounds(L.latLngBounds(dir.path), { padding: [60, 60], duration: 0.6 });
  }, [selectedRouteId, directions]);

  // Moving truck marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const dir = truck ? directions[truck.routeId] : undefined;
    if (!truck || !dir) {
      truckRef.current?.remove();
      truckRef.current = null;
      return;
    }
    const pos = pointAlong(dir.path, truck.progress);
    if (!truckRef.current) {
      truckRef.current = L.marker(pos, {
        icon: pin('<span class="map-pin" style="border-color:#0071e3;font-size:15px;padding:2px 6px">🚚</span>'),
        zIndexOffset: 3000,
      }).addTo(map);
    } else {
      truckRef.current.setLatLng(pos);
    }
  }, [truck, directions]);

  const legend: (keyof typeof ROUTE_STATUS_META)[] = ['CHOSEN', 'TIME_SENSITIVE', 'BLOCKED', 'UNUSED'];

  return (
    <div className="map-frame" style={{ height }}>
      <div ref={elRef} style={{ height: '100%' }} aria-label="Route decision map" />
      <div className="map-status">
        {loading ? '⏳ Loading road directions…' : approximate ? '⚠ Some routes approximate (router offline)' : '🛣 Real road routes · OpenStreetMap'}
      </div>
      <div className="map-legend" aria-label="Map legend">
        {legend.map((k) => {
          const m = ROUTE_STATUS_META[k];
          return (
            <div key={k}>
              <span
                className={`legend-line ${m.dash ? (k === 'UNUSED' ? 'dotted' : 'dashed') : ''}`}
                style={{ borderTopColor: m.color }}
              />
              {m.label}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { pointAlong };
