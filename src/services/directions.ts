// FreshRoute — Road directions via the public OSRM router (OpenStreetMap data).
// No API key. Results are cached in memory + localStorage; on failure we return a
// straight-line approximation flagged `approximate: true` so the map always draws.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DirectionStep {
  instruction: string;
  distance_km: number;
}

export interface Directions {
  /** [lat, lng] pairs along the road */
  path: [number, number][];
  distance_km: number;
  road_hours: number;
  steps: DirectionStep[];
  approximate: boolean;
}

const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const CACHE_KEY = 'freshroute.directions.v1';
const memory = new Map<string, Directions>();
const inflight = new Map<string, Promise<Directions>>();

function loadCache(): Record<string, Directions> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveCache(key: string, d: Directions) {
  try {
    const all = loadCache();
    all[key] = d;
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — memory cache still works */
  }
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function straightLine(from: LatLng, to: LatLng): Directions {
  const km = haversineKm(from, to) * 1.25; // rough road factor
  return {
    path: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    distance_km: Math.round(km),
    road_hours: +(km / 45).toFixed(1),
    steps: [{ instruction: 'Road directions unavailable — showing approximate straight-line corridor', distance_km: Math.round(km) }],
    approximate: true,
  };
}

function describeStep(step: any): string {
  const m = step.maneuver ?? {};
  const road = step.name || step.ref || 'unnamed road';
  const mod = m.modifier ? ` ${m.modifier}` : '';
  switch (m.type) {
    case 'depart':
      return `Start on ${road}`;
    case 'arrive':
      return 'Arrive at market';
    case 'turn':
    case 'end of road':
      return `Turn${mod} onto ${road}`;
    case 'merge':
      return `Merge${mod} onto ${road}`;
    case 'on ramp':
      return `Take the ramp onto ${road}`;
    case 'off ramp':
      return `Take the exit towards ${road}`;
    case 'fork':
      return `Keep${mod} at the fork onto ${road}`;
    case 'roundabout':
    case 'rotary':
      return `At the roundabout, take exit ${m.exit ?? ''} onto ${road}`.replace('  ', ' ');
    case 'new name':
    case 'continue':
      return `Continue on ${road}`;
    default:
      return `${(m.type || 'Continue').replace(/^\w/, (c: string) => c.toUpperCase())}${mod} on ${road}`;
  }
}

/** Collapse consecutive steps on the same road so the list stays readable. */
function compactSteps(raw: any[]): DirectionStep[] {
  const out: DirectionStep[] = [];
  for (const s of raw) {
    const instruction = describeStep(s);
    const km = s.distance / 1000;
    const prev = out[out.length - 1];
    if (prev && instruction.startsWith('Continue on') && prev.instruction.endsWith(instruction.slice('Continue on '.length))) {
      prev.distance_km += km;
      continue;
    }
    if (km < 0.05 && !instruction.startsWith('Arrive')) continue;
    out.push({ instruction, distance_km: km });
  }
  return out.map((s) => ({ ...s, distance_km: +s.distance_km.toFixed(1) }));
}

export async function getDirections(from: LatLng, to: LatLng): Promise<Directions> {
  const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const hit = memory.get(key) ?? loadCache()[key];
  if (hit) {
    memory.set(key, hit);
    return hit;
  }
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    try {
      const url = `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) throw new Error('OSRM returned no route');
      const d: Directions = {
        path: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
        distance_km: Math.round(route.distance / 1000),
        road_hours: +(route.duration / 3600).toFixed(1),
        steps: compactSteps(route.legs?.[0]?.steps ?? []),
        approximate: false,
      };
      memory.set(key, d);
      saveCache(key, d);
      return d;
    } catch (err) {
      console.warn('[directions] OSRM unavailable, using straight line:', err);
      const d = straightLine(from, to);
      memory.set(key, d); // not persisted, so a later session retries OSRM
      return d;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
