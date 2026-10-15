// FreshRoute — Map of cold-storage facilities across India (Leaflet + OSM).
// Each pin shows the city and free space; facilities that can't take the chosen crop
// are faded. Click a pin to select it.

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ORIGIN_COORDINATES } from '../../data/dataset';
import type { FacilityMatch } from '../../engine/coldStorage';

interface FacilityMapProps {
  matches: FacilityMatch[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** kg stored per facility by the current viewer (shown as a badge) */
  mineKg?: Record<string, number>;
  height?: number;
}

const pin = (html: string) => L.divIcon({ className: 'pin-icon', html, iconSize: [0, 0] });

export const FacilityMap: React.FC<FacilityMapProps> = ({ matches, selectedId, onSelect, mineKg = {}, height = 460 }) => {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true }).setView([21.5, 79], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const m of matches) {
      const f = m.facility;
      const sel = f.facility_id === selectedId;
      const freeT = Math.round(m.free_kg / 1000);
      const mine = mineKg[f.facility_id];
      const border = !m.takes_crop ? '#c7c7cc' : m.occupancy > 0.9 ? '#d93025' : m.occupancy > 0.75 ? '#d98a00' : '#1f9d55';
      // Compact pins avoid clutter around Nashik; details live in the tooltip and on the selected pin
      const detail = sel && m.takes_crop ? ` · ${freeT}t free` : '';
      const html = `<span class="map-pin ${!m.takes_crop ? 'dim' : ''}" style="border-color:${sel ? '#0071e3' : border};${sel ? 'background:#0071e3;color:#fff;' : ''}font-size:11px;padding:2px 7px">❄ ${f.city}${detail}${mine ? ' ★' : ''}</span>`;
      L.marker([f.coordinates.lat, f.coordinates.lng], { icon: pin(html), zIndexOffset: sel ? 1000 : m.takes_crop ? 100 : 0 })
        .bindTooltip(
          `<b>${f.name}</b><br/>${f.city}, ${f.state}<br/>${m.distance_km} km from Nashik DC · ₹${f.price_per_kg_day}/kg/day<br/>${freeT} t free (${Math.round(m.occupancy * 100)}% full)${mine ? `<br/>★ Yours here: ${Math.round(mine)} kg` : ''}`
        )
        .on('click', () => onSelectRef.current(f.facility_id))
        .addTo(layer);
    }
    L.marker([ORIGIN_COORDINATES.lat, ORIGIN_COORDINATES.lng], {
      icon: pin('<span class="map-pin origin" style="font-size:11px">🏭 Nashik DC</span>'),
      zIndexOffset: 2000,
    }).addTo(layer);
  }, [matches, selectedId, mineKg]);

  useEffect(() => {
    const m = matches.find((x) => x.facility.facility_id === selectedId);
    if (m && mapRef.current) mapRef.current.flyTo([m.facility.coordinates.lat, m.facility.coordinates.lng], Math.max(mapRef.current.getZoom(), 6), { duration: 0.6 });
  }, [selectedId]);

  return (
    <div className="map-frame" style={{ height }}>
      <div ref={elRef} style={{ height: '100%' }} aria-label="Cold storage facilities across India" />
      <div className="map-legend">
        <div><span className="dot" style={{ background: '#1f9d55' }} />&nbsp; Plenty of space</div>
        <div><span className="dot" style={{ background: '#d98a00' }} />&nbsp; Filling up (75%+)</div>
        <div><span className="dot" style={{ background: '#d93025' }} />&nbsp; Nearly full (90%+)</div>
        <div><span className="dot" style={{ background: '#c7c7cc' }} />&nbsp; Doesn't take this crop</div>
        <div>★&nbsp; Your stock is stored here</div>
      </div>
    </div>
  );
};
