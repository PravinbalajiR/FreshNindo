// FreshRoute — Interactive Google Map & Transit Corridors Component
// Integrates Google Maps JavaScript API with Apple-style dark aesthetics,
// destination markers, route polylines, and graceful fallback.

import React, { useEffect, useRef, useState } from 'react';
import {
  DESTINATIONS,
  ORIGIN,
  ORIGIN_COORDINATES,
  type Destination,
  type Route,
} from '../data/dataset';
import { FeasibilityBadge, formatINR, formatKg } from './shared';

interface GoogleMapViewProps {
  routes: Route[];
  selectedDestId: string | null;
  onSelectDest: (id: string | null) => void;
  routesSource?: 'google_routes' | 'cache' | 'fallback_synthetic';
}

declare global {
  interface Window {
    google?: any;
    initFreshRouteGoogleMap?: () => void;
  }
}

// Apple-inspired dark map styles
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#161618' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#161618' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#86868b' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d2d2d7' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6e6e73' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1a1f1a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2a2a2d' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212124' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#333338' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#262629' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0d131a' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3d4b5c' }],
  },
];

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  routes,
  selectedDestId,
  onSelectDest,
  routesSource = 'fallback_synthetic',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // Load Google Maps JS Script
  useEffect(() => {
    if (!apiKey) {
      setMapError('VITE_GOOGLE_MAPS_API_KEY is not defined in client environment.');
      return;
    }

    if (window.google?.maps) {
      setMapLoaded(true);
      return;
    }

    const scriptId = 'freshroute-google-maps-script';
    const existingScript = document.getElementById(scriptId);

    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkInterval);
          setMapLoaded(true);
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setMapLoaded(true);
    };

    script.onerror = () => {
      setMapError('Failed to load Google Maps JavaScript API (network or invalid key).');
    };

    document.head.appendChild(script);
  }, [apiKey]);

  // Initialize and update Map instance
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || !window.google?.maps) return;

    try {
      if (!mapInstanceRef.current) {
        // Center between Nashik and Mumbai/Pune region
        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: { lat: 19.35, lng: 74.2 },
          zoom: 8,
          styles: DARK_MAP_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
          backgroundColor: '#111113',
        });
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Clear existing markers & polylines
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];

      // 1. Warehouse Origin Marker
      const originMarker = new window.google.maps.Marker({
        position: ORIGIN_COORDINATES,
        map,
        title: ORIGIN,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#0066cc',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      const originInfoWindow = new window.google.maps.InfoWindow({
        content: `<div style="color:#000;padding:4px;font-family:sans-serif;">
          <strong>${ORIGIN}</strong><br/>
          <span style="font-size:12px;color:#555;">Central Produce Dispatch Depot</span>
        </div>`,
      });
      originMarker.addListener('click', () => {
        originInfoWindow.open(map, originMarker);
      });
      markersRef.current.push(originMarker);

      // 2. Destination Markers and Transit Lines
      DESTINATIONS.forEach((dest) => {
        const route = routes.find((r) => r.destination_id === dest.destination_id);
        const isSelected = selectedDestId === dest.destination_id;
        const isAvailable = route ? route.available : true;

        const markerColor = !isAvailable
          ? '#6e6e73'
          : isSelected
          ? '#2997ff'
          : dest.handling_time_hours <= 1.0
          ? '#30d158'
          : '#ffd60a';

        const destMarker = new window.google.maps.Marker({
          position: dest.coordinates,
          map,
          title: dest.name,
          icon: {
            path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: isSelected ? 7 : 5,
            fillColor: markerColor,
            fillOpacity: 1,
            strokeColor: isSelected ? '#ffffff' : '#161617',
            strokeWeight: isSelected ? 2 : 1,
          },
        });

        destMarker.addListener('click', () => {
          onSelectDest(dest.destination_id);
        });
        markersRef.current.push(destMarker);

        // Transit Corridor Polyline
        const strokeColor = isSelected ? '#2997ff' : isAvailable ? '#424245' : '#8b1a1a';
        const strokeWeight = isSelected ? 4 : isAvailable ? 2 : 1;
        const strokeOpacity = isSelected ? 0.95 : isAvailable ? 0.6 : 0.3;

        const polyline = new window.google.maps.Polyline({
          path: [ORIGIN_COORDINATES, dest.coordinates],
          geodesic: true,
          strokeColor,
          strokeOpacity,
          strokeWeight,
          map,
        });

        polyline.addListener('click', () => {
          onSelectDest(dest.destination_id);
        });
        polylinesRef.current.push(polyline);
      });
    } catch (e: any) {
      console.warn('[GoogleMapView] Map rendering exception:', e);
      setMapError(e.message || 'Error initializing map components');
    }
  }, [mapLoaded, routes, selectedDestId, onSelectDest]);

  const selectedDest = DESTINATIONS.find((d) => d.destination_id === selectedDestId);
  const selectedRoute = routes.find((r) => r.destination_id === selectedDestId);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
      {/* Map Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-5)',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
            🗺 Interactive Transit Network
          </div>
          <span
            className={`status-badge ${
              routesSource === 'google_routes'
                ? 'status-ready'
                : 'status-time-sensitive'
            }`}
            style={{ fontSize: 10 }}
          >
            {routesSource === 'google_routes'
              ? '● Live Google Routes'
              : routesSource === 'cache'
              ? '● Cached Google Routes'
              : '⚠ Fallback Routing'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className={`btn btn-sm ${!selectedDestId ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onSelectDest(null)}
          >
            All Corridors
          </button>
          {DESTINATIONS.map((d) => (
            <button
              key={d.destination_id}
              className={`btn btn-sm ${selectedDestId === d.destination_id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onSelectDest(d.destination_id)}
            >
              {d.region}
            </button>
          ))}
        </div>
      </div>

      {/* Map or Fallback View */}
      <div style={{ position: 'relative', width: '100%', height: 380, background: '#111113' }}>
        {mapError ? (
          // Elegant Fallback when Google Maps JS cannot load
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-6)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 'var(--space-2)' }}>🗺</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              Interactive Map Canvas (Fallback Schematic)
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', maxWidth: 440, marginBottom: 'var(--space-4)' }}>
              {mapError}. The application's deterministic routing, freshness margins, and transit optimizer continue to function normally.
            </p>
            {/* Visual SVG Corridor Diagram */}
            <svg width="340" height="140" viewBox="0 0 340 140" style={{ maxWidth: '100%' }}>
              <circle cx="50" cy="70" r="16" fill="#0066cc" />
              <text x="50" y="74" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">DC</text>
              <line x1="66" y1="70" x2="160" y2="30" stroke="#424245" strokeWidth="2" strokeDasharray="4 4" />
              <line x1="66" y1="70" x2="250" y2="50" stroke="#424245" strokeWidth="2" strokeDasharray="4 4" />
              <line x1="66" y1="70" x2="250" y2="90" stroke="#424245" strokeWidth="2" strokeDasharray="4 4" />
              <line x1="66" y1="70" x2="160" y2="110" stroke="#424245" strokeWidth="2" strokeDasharray="4 4" />
              <circle cx="160" cy="30" r="10" fill="#30d158" />
              <circle cx="250" cy="50" r="10" fill="#ffd60a" />
              <circle cx="250" cy="90" r="10" fill="#ffd60a" />
              <circle cx="160" cy="110" r="10" fill="#30d158" />
              <text x="175" y="34" fill="#e8e8ed" fontSize="10">Nashik (0.5h)</text>
              <text x="265" y="54" fill="#e8e8ed" fontSize="10">Mumbai (6h)</text>
              <text x="265" y="94" fill="#e8e8ed" fontSize="10">Pune (3.5h)</text>
              <text x="175" y="114" fill="#e8e8ed" fontSize="10">Aurangabad (5h)</text>
            </svg>
          </div>
        ) : (
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        )}

        {/* Selected Route Floating Overlay Card */}
        {selectedDest && selectedRoute && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              maxWidth: 360,
              background: 'rgba(22, 22, 23, 0.94)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                  {selectedDest.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Corridor {selectedRoute.route_id} · {selectedDest.region}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={() => onSelectDest(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', margin: 'var(--space-3) 0', fontSize: 12 }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Distance: </span>
                <strong style={{ color: 'var(--text-secondary)' }}>{selectedRoute.distance_km || '—'} km</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Transit: </span>
                <strong style={{ color: 'var(--accent-light)' }}>
                  {selectedRoute.duration_formatted || `${selectedRoute.travel_time_hours}h`}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Handling: </span>
                <strong style={{ color: 'var(--text-secondary)' }}>{selectedDest.handling_time_hours}h</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Cost: </span>
                <strong style={{ color: 'var(--text-secondary)' }}>₹{selectedRoute.transport_cost_per_kg}/kg</strong>
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-subtle)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
              Source:{' '}
              {selectedRoute.route_source === 'google_routes'
                ? 'Google Routes API (Live Driving Distance)'
                : selectedRoute.route_source === 'cache'
                ? 'Google Routes API (Cached Response)'
                : 'Verified Deterministic Fallback'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
