// FreshRoute — Google Routes API Service
// Calls Google computeRoutes (v2) with server-side caching and fallback.

import { config, isGoogleMapsConfigured } from '../config.js';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteEstimateResult {
  routeId?: string;
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationHours: number;
  durationFormatted: string;
  encodedPolyline?: string;
  isFallback: boolean;
  source: 'google_routes' | 'cache' | 'fallback';
  status: 'OK' | 'FALLBACK_SYNTHETIC' | 'CONFIG_ERROR' | 'API_ERROR';
  note?: string;
}

interface CacheEntry {
  timestamp: number;
  data: RouteEstimateResult;
}

const routeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function isValidLatLng(coords: any): coords is LatLng {
  if (!coords || typeof coords !== 'object') return false;
  const { lat, lng } = coords;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function parseDurationSeconds(durationStr: string): number {
  // Google Routes API returns duration as a string ending in 's', e.g. "19420s"
  if (!durationStr) return 0;
  const cleaned = durationStr.replace('s', '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export async function computeRouteEstimate(
  origin: LatLng,
  destination: LatLng,
  routeId?: string,
  fallbackHours?: number,
  fallbackKm?: number
): Promise<RouteEstimateResult> {
  if (!isValidLatLng(origin) || !isValidLatLng(destination)) {
    throw new Error('Invalid origin or destination coordinates provided.');
  }

  const cacheKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      ...cached.data,
      routeId: routeId || cached.data.routeId,
      source: 'cache',
    };
  }

  if (!isGoogleMapsConfigured()) {
    const defaultHours = fallbackHours || 4.0;
    const defaultKm = fallbackKm || 180;
    return {
      routeId,
      distanceMeters: defaultKm * 1000,
      distanceKm: defaultKm,
      durationSeconds: defaultHours * 3600,
      durationHours: defaultHours,
      durationFormatted: formatDuration(defaultHours * 3600),
      isFallback: true,
      source: 'fallback',
      status: 'CONFIG_ERROR',
      note: 'GOOGLE_MAPS_API_KEY is not configured on the server. Using deterministic synthetic fallback data.',
    };
  }

  const endpoint = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  const requestBody = {
    origin: {
      location: {
        latLng: {
          latitude: origin.lat,
          longitude: origin.lng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.lat,
          longitude: destination.lng,
        },
      },
    },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    routeModifiers: {
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: true,
    },
    languageCode: 'en-US',
    units: 'METRIC',
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000); // 12-second timeout

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.googleMapsApiKey,
        'X-Goog-FieldMask':
          'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[GoogleRoutes] Upstream error: HTTP ${response.status}`,
        errorText.substring(0, 200)
      );

      const defaultHours = fallbackHours || 4.0;
      const defaultKm = fallbackKm || 180;
      return {
        routeId,
        distanceMeters: defaultKm * 1000,
        distanceKm: defaultKm,
        durationSeconds: defaultHours * 3600,
        durationHours: defaultHours,
        durationFormatted: formatDuration(defaultHours * 3600),
        isFallback: true,
        source: 'fallback',
        status: 'API_ERROR',
        note: `Google Routes API returned HTTP ${response.status}. Using verified fallback data.`,
      };
    }

    const data = (await response.json()) as any;
    const route = data.routes?.[0];

    if (!route) {
      const defaultHours = fallbackHours || 4.0;
      const defaultKm = fallbackKm || 180;
      return {
        routeId,
        distanceMeters: defaultKm * 1000,
        distanceKm: defaultKm,
        durationSeconds: defaultHours * 3600,
        durationHours: defaultHours,
        durationFormatted: formatDuration(defaultHours * 3600),
        isFallback: true,
        source: 'fallback',
        status: 'FALLBACK_SYNTHETIC',
        note: 'No direct driving route returned by Google Routes API. Using fallback data.',
      };
    }

    const distanceMeters = route.distanceMeters || 0;
    const durationSeconds = parseDurationSeconds(route.duration);
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
    const durationHours = Math.round((durationSeconds / 3600) * 100) / 100;
    const encodedPolyline = route.polyline?.encodedPolyline;

    const result: RouteEstimateResult = {
      routeId,
      distanceMeters,
      distanceKm,
      durationSeconds,
      durationHours,
      durationFormatted: formatDuration(durationSeconds),
      encodedPolyline,
      isFallback: false,
      source: 'google_routes',
      status: 'OK',
    };

    // Cache result
    routeCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (err: any) {
    clearTimeout(timeout);
    console.error('[GoogleRoutes] Fetch exception:', err.message || err);

    const defaultHours = fallbackHours || 4.0;
    const defaultKm = fallbackKm || 180;
    return {
      routeId,
      distanceMeters: defaultKm * 1000,
      distanceKm: defaultKm,
      durationSeconds: defaultHours * 3600,
      durationHours: defaultHours,
      durationFormatted: formatDuration(defaultHours * 3600),
      isFallback: true,
      source: 'fallback',
      status: 'API_ERROR',
      note: `Network error reaching Google Routes API (${err.message || 'timeout'}). Using fallback data.`,
    };
  }
}
