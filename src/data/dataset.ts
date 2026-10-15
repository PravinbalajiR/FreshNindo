// FreshRoute — Synthetic Demonstration Dataset
// DATA PROVENANCE: SYNTHETIC — clearly labeled throughout the application.
// Designed to demonstrate perishability-aware allocation, infeasible routes,
// capacity constraints, discount logic, and scenario replanning.
// All values are illustrative; not derived from organizer-supplied data.

export interface InventoryBatch {
  batch_id: string;
  commodity: string;
  quantity_kg: number;
  remaining_shelf_life_hours: number;
  acquisition_cost_per_kg: number; // INR/kg
  quality_grade: 'A' | 'B' | 'C';
  notes?: string;
  farmer_id?: string; // supplier account (portal-added and seed batches)
  added_at?: string; // ISO timestamp when a farmer listed the batch
}

export interface RetailerOrder {
  order_id: string;
  retailer_id: string;
  destination_id: string;
  commodity: string;
  quantity_kg: number;
  max_price_per_kg?: number;
  created_at: string;
}

export interface Destination {
  destination_id: string;
  name: string;
  demand_by_commodity: Record<string, number>; // commodity → kg
  selling_price_by_commodity: Record<string, number>; // commodity → INR/kg
  handling_time_hours: number;
  capacity_kg: number; // total fresh produce capacity at this destination
  region: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface Route {
  route_id: string;
  origin: string;
  destination_id: string;
  travel_time_hours: number;
  transport_cost_per_kg: number; // INR/kg
  vehicle_capacity_kg: number;
  available: boolean;
  distance_km?: number;
  duration_formatted?: string;
  encoded_polyline?: string;
  is_live_google?: boolean;
  route_source?: 'google_routes' | 'cache' | 'fallback_synthetic';
}

export const ORIGIN = 'Nashik Distribution Centre';
export const ORIGIN_COORDINATES = {
  lat: 19.9975,
  lng: 73.7898,
};

export const BATCHES: InventoryBatch[] = [
  {
    batch_id: 'B-001',
    commodity: 'Tomatoes',
    quantity_kg: 800,
    remaining_shelf_life_hours: 18,
    acquisition_cost_per_kg: 12,
    quality_grade: 'A',
    notes: 'Overnight arrival; moderate ripeness',
  },
  {
    batch_id: 'B-002',
    commodity: 'Tomatoes',
    quantity_kg: 500,
    remaining_shelf_life_hours: 10,
    acquisition_cost_per_kg: 10,
    quality_grade: 'B',
    notes: 'Near-peak ripeness; priority dispatch required',
  },
  {
    batch_id: 'B-003',
    commodity: 'Onions',
    quantity_kg: 1200,
    remaining_shelf_life_hours: 72,
    acquisition_cost_per_kg: 8,
    quality_grade: 'A',
    notes: 'Stable; long shelf life',
  },
  {
    batch_id: 'B-004',
    commodity: 'Capsicum',
    quantity_kg: 300,
    remaining_shelf_life_hours: 30,
    acquisition_cost_per_kg: 25,
    quality_grade: 'A',
    notes: 'High-value; protect freshness',
  },
  {
    batch_id: 'B-005',
    commodity: 'Spinach',
    quantity_kg: 200,
    remaining_shelf_life_hours: 12,
    acquisition_cost_per_kg: 18,
    quality_grade: 'A',
    notes: 'Very short shelf life — most urgent',
  },
  {
    batch_id: 'B-006',
    commodity: 'Grapes',
    quantity_kg: 400,
    remaining_shelf_life_hours: 48,
    acquisition_cost_per_kg: 45,
    quality_grade: 'A',
    notes: 'Premium batch; cold chain preferred',
  },
];

export const DESTINATIONS: Destination[] = [
  {
    destination_id: 'D-MUM',
    name: 'Mumbai Central Market',
    demand_by_commodity: {
      Tomatoes: 700,
      Onions: 600,
      Capsicum: 200,
      Spinach: 150,
      Grapes: 250,
    },
    selling_price_by_commodity: {
      Tomatoes: 28,
      Onions: 22,
      Capsicum: 60,
      Spinach: 45,
      Grapes: 110,
    },
    handling_time_hours: 2,
    capacity_kg: 1500,
    region: 'Mumbai',
    coordinates: { lat: 19.076, lng: 72.8777 },
  },
  {
    destination_id: 'D-PUN',
    name: 'Pune APMC',
    demand_by_commodity: {
      Tomatoes: 500,
      Onions: 400,
      Capsicum: 150,
      Spinach: 80,
      Grapes: 120,
    },
    selling_price_by_commodity: {
      Tomatoes: 24,
      Onions: 18,
      Capsicum: 52,
      Spinach: 38,
      Grapes: 95,
    },
    handling_time_hours: 1.5,
    capacity_kg: 1200,
    region: 'Pune',
    coordinates: { lat: 18.5204, lng: 73.8567 },
  },
  {
    destination_id: 'D-AUR',
    name: 'Aurangabad Market',
    demand_by_commodity: {
      Tomatoes: 300,
      Onions: 500,
      Capsicum: 100,
      Spinach: 40,
      Grapes: 80,
    },
    selling_price_by_commodity: {
      Tomatoes: 20,
      Onions: 16,
      Capsicum: 45,
      Spinach: 32,
      Grapes: 85,
    },
    handling_time_hours: 1,
    capacity_kg: 800,
    region: 'Aurangabad',
    coordinates: { lat: 19.8762, lng: 75.3433 },
  },
  {
    destination_id: 'D-NAS-LOCAL',
    name: 'Nashik Local Wholesale',
    demand_by_commodity: {
      Tomatoes: 200,
      Onions: 300,
      Capsicum: 80,
      Spinach: 60,
      Grapes: 50,
    },
    selling_price_by_commodity: {
      Tomatoes: 16,
      Onions: 14,
      Capsicum: 38,
      Spinach: 28,
      Grapes: 70,
    },
    handling_time_hours: 0.5,
    capacity_kg: 600,
    region: 'Nashik',
    coordinates: { lat: 20.0125, lng: 73.791 },
  },
];

export const ROUTES: Route[] = [
  {
    route_id: 'R-NAS-MUM',
    origin: ORIGIN,
    destination_id: 'D-MUM',
    travel_time_hours: 6,
    transport_cost_per_kg: 2.5,
    vehicle_capacity_kg: 1000,
    available: true,
    distance_km: 168,
    duration_formatted: '6h 0m',
    is_live_google: false,
    route_source: 'fallback_synthetic',
  },
  {
    route_id: 'R-NAS-PUN',
    origin: ORIGIN,
    destination_id: 'D-PUN',
    travel_time_hours: 3.5,
    transport_cost_per_kg: 1.8,
    vehicle_capacity_kg: 800,
    available: true,
    distance_km: 210,
    duration_formatted: '3h 30m',
    is_live_google: false,
    route_source: 'fallback_synthetic',
  },
  {
    route_id: 'R-NAS-AUR',
    origin: ORIGIN,
    destination_id: 'D-AUR',
    travel_time_hours: 5,
    transport_cost_per_kg: 2.0,
    vehicle_capacity_kg: 600,
    available: true,
    distance_km: 195,
    duration_formatted: '5h 0m',
    is_live_google: false,
    route_source: 'fallback_synthetic',
  },
  {
    route_id: 'R-NAS-LOCAL',
    origin: ORIGIN,
    destination_id: 'D-NAS-LOCAL',
    travel_time_hours: 0.5,
    transport_cost_per_kg: 0.3,
    vehicle_capacity_kg: 400,
    available: true,
    distance_km: 15,
    duration_formatted: '0h 30m',
    is_live_google: false,
    route_source: 'fallback_synthetic',
  },
];

// Discount tiers available as policy options
export const DISCOUNT_TIERS = [0, 10, 20, 30, 40] as const; // percent off

// Shelf-life feasibility thresholds (configurable)
export const FEASIBILITY_CONFIG = {
  // Minimum margin after travel + handling for a READY status
  ready_margin_hours: 6,
  // Minimum margin for TIME_SENSITIVE (below this = INFEASIBLE)
  min_feasible_margin_hours: 1,
};
