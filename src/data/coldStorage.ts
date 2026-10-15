// FreshRoute — Cold-storage facilities across India + per-crop storage profiles.
// DATA PROVENANCE: SYNTHETIC. Facility names are generic placeholders placed in real
// produce hubs; capacities, prices and occupancy are illustrative. Storage profiles
// are typical published post-harvest ranges, not guarantees for any specific lot.

export interface StorageProfile {
  temp: string; // recommended °C range
  humidity: string; // recommended relative humidity
  max_days: number; // typical storage life for grade-A produce at the right setting
  /** Hours the produce lasts once taken back out (ambient), when fresh from storage */
  ambient_hours_after: number;
  tip: string; // one plain-language handling note
}

export const STORAGE_PROFILES: Record<string, StorageProfile> = {
  Onions: { temp: '0–2 °C', humidity: '65–70%', max_days: 150, ambient_hours_after: 96, tip: 'Keep dry; damp air makes onions sprout and rot.' },
  Tomatoes: { temp: '10–13 °C', humidity: '90–95%', max_days: 12, ambient_hours_after: 24, tip: 'Too cold (below 10 °C) damages tomatoes; store them firm, not fully ripe.' },
  Capsicum: { temp: '7–10 °C', humidity: '90–95%', max_days: 18, ambient_hours_after: 30, tip: 'Below 7 °C capsicum gets soft pitted spots.' },
  Spinach: { temp: '0–2 °C', humidity: '95–100%', max_days: 12, ambient_hours_after: 12, tip: 'Needs very moist cold air or leaves wilt within a day.' },
  Grapes: { temp: '-1–0 °C', humidity: '90–95%', max_days: 45, ambient_hours_after: 48, tip: 'Cold quickly after harvest; keep away from strong smells.' },
};

/** Storage life multiplier by quality grade going in. */
export const GRADE_LIFE: Record<'A' | 'B' | 'C', number> = { A: 1, B: 0.8, C: 0.6 };

export interface ColdStorageFacility {
  facility_id: string;
  name: string;
  city: string;
  state: string;
  coordinates: { lat: number; lng: number };
  crops: string[];
  capacity_t: number; // tonnes
  used_t: number; // tonnes occupied by other customers
  price_per_kg_day: number; // ₹
  rating: number; // 1–5
  features: string[];
}

const ALL = ['Onions', 'Tomatoes', 'Capsicum', 'Spinach', 'Grapes'];

export const FACILITIES: ColdStorageFacility[] = [
  // Maharashtra
  { facility_id: 'CS-NSK-1', name: 'Nashik Agri Cold Hub', city: 'Nashik', state: 'Maharashtra', coordinates: { lat: 19.962, lng: 73.73 }, crops: ALL, capacity_t: 1200, used_t: 830, price_per_kg_day: 0.22, rating: 4.6, features: ['Multi-chamber', 'Pre-cooling', '24×7 loading'] },
  { facility_id: 'CS-LSL-1', name: 'Lasalgaon Onion Store', city: 'Lasalgaon', state: 'Maharashtra', coordinates: { lat: 20.149, lng: 74.233 }, crops: ['Onions'], capacity_t: 5000, used_t: 3900, price_per_kg_day: 0.06, rating: 4.4, features: ['Low-humidity chambers', 'Bulk bags'] },
  { facility_id: 'CS-PMB-1', name: 'Pimpalgaon Fruit Cold Chain', city: 'Pimpalgaon Baswant', state: 'Maharashtra', coordinates: { lat: 20.168, lng: 73.988 }, crops: ['Grapes', 'Tomatoes', 'Capsicum'], capacity_t: 900, used_t: 620, price_per_kg_day: 0.26, rating: 4.5, features: ['Export-grade grape rooms', 'SO₂ pads'] },
  { facility_id: 'CS-PUN-1', name: 'Pune Fresh Storage Park', city: 'Pune', state: 'Maharashtra', coordinates: { lat: 18.5, lng: 73.93 }, crops: ALL, capacity_t: 1500, used_t: 1180, price_per_kg_day: 0.24, rating: 4.3, features: ['Multi-chamber', 'Ripening room'] },
  { facility_id: 'CS-MUM-1', name: 'Vashi Market Cold Store', city: 'Navi Mumbai', state: 'Maharashtra', coordinates: { lat: 19.07, lng: 72.99 }, crops: ALL, capacity_t: 2500, used_t: 2310, price_per_kg_day: 0.32, rating: 4.1, features: ['Next to APMC market', 'Small lots OK'] },
  { facility_id: 'CS-AUR-1', name: 'Aurangabad Agro Cold Point', city: 'Aurangabad', state: 'Maharashtra', coordinates: { lat: 19.88, lng: 75.34 }, crops: ['Onions', 'Tomatoes', 'Capsicum'], capacity_t: 700, used_t: 410, price_per_kg_day: 0.18, rating: 4.0, features: ['Pre-cooling'] },
  { facility_id: 'CS-SNG-1', name: 'Sangli Grape Cold House', city: 'Sangli', state: 'Maharashtra', coordinates: { lat: 16.853, lng: 74.581 }, crops: ['Grapes'], capacity_t: 1100, used_t: 700, price_per_kg_day: 0.21, rating: 4.7, features: ['Export-grade grape rooms', 'Packhouse'] },
  { facility_id: 'CS-JLG-1', name: 'Jalgaon Cold Storage Yard', city: 'Jalgaon', state: 'Maharashtra', coordinates: { lat: 21.007, lng: 75.563 }, crops: ['Onions', 'Tomatoes'], capacity_t: 800, used_t: 520, price_per_kg_day: 0.12, rating: 3.9, features: ['Bulk bags'] },
  { facility_id: 'CS-NGP-1', name: 'Nagpur Central Cold Store', city: 'Nagpur', state: 'Maharashtra', coordinates: { lat: 21.172, lng: 79.142 }, crops: ['Onions', 'Tomatoes', 'Capsicum', 'Spinach'], capacity_t: 1000, used_t: 640, price_per_kg_day: 0.17, rating: 4.0, features: ['Multi-chamber'] },
  // West & North
  { facility_id: 'CS-AMD-1', name: 'Ahmedabad Fresh Cold Hub', city: 'Ahmedabad', state: 'Gujarat', coordinates: { lat: 23.022, lng: 72.571 }, crops: ALL, capacity_t: 1600, used_t: 1050, price_per_kg_day: 0.23, rating: 4.4, features: ['Multi-chamber', 'Ripening room'] },
  { facility_id: 'CS-RJK-1', name: 'Rajkot Agri Storage', city: 'Rajkot', state: 'Gujarat', coordinates: { lat: 22.303, lng: 70.802 }, crops: ['Onions'], capacity_t: 2200, used_t: 1400, price_per_kg_day: 0.07, rating: 4.1, features: ['Low-humidity chambers'] },
  { facility_id: 'CS-IDR-1', name: 'Indore Mandi Cold Chain', city: 'Indore', state: 'Madhya Pradesh', coordinates: { lat: 22.72, lng: 75.858 }, crops: ['Onions', 'Tomatoes', 'Capsicum'], capacity_t: 1800, used_t: 1200, price_per_kg_day: 0.14, rating: 4.2, features: ['Pre-cooling', 'Bulk bags'] },
  { facility_id: 'CS-JPR-1', name: 'Jaipur Cold Storage Centre', city: 'Jaipur', state: 'Rajasthan', coordinates: { lat: 26.912, lng: 75.787 }, crops: ['Onions', 'Tomatoes', 'Grapes'], capacity_t: 900, used_t: 500, price_per_kg_day: 0.19, rating: 3.9, features: ['Multi-chamber'] },
  { facility_id: 'CS-DEL-1', name: 'Azadpur Fresh Cold Store', city: 'Delhi (Azadpur)', state: 'Delhi', coordinates: { lat: 28.713, lng: 77.177 }, crops: ALL, capacity_t: 3500, used_t: 3150, price_per_kg_day: 0.34, rating: 4.2, features: ['Next to Asia’s largest fruit & veg market', 'Small lots OK'] },
  { facility_id: 'CS-LDH-1', name: 'Ludhiana Agro Cold Point', city: 'Ludhiana', state: 'Punjab', coordinates: { lat: 30.901, lng: 75.857 }, crops: ['Onions', 'Spinach', 'Tomatoes'], capacity_t: 1300, used_t: 760, price_per_kg_day: 0.16, rating: 4.1, features: ['Pre-cooling'] },
  { facility_id: 'CS-AGR-1', name: 'Agra Multi-Crop Cold Store', city: 'Agra', state: 'Uttar Pradesh', coordinates: { lat: 27.177, lng: 78.008 }, crops: ['Onions', 'Tomatoes'], capacity_t: 4000, used_t: 3300, price_per_kg_day: 0.09, rating: 3.8, features: ['Bulk bags'] },
  { facility_id: 'CS-LKO-1', name: 'Lucknow Fresh Storage', city: 'Lucknow', state: 'Uttar Pradesh', coordinates: { lat: 26.847, lng: 80.947 }, crops: ['Onions', 'Tomatoes', 'Capsicum', 'Spinach'], capacity_t: 1100, used_t: 700, price_per_kg_day: 0.18, rating: 4.0, features: ['Multi-chamber'] },
  // South
  { facility_id: 'CS-BLR-1', name: 'Bengaluru Fresh Cold Hub', city: 'Bengaluru', state: 'Karnataka', coordinates: { lat: 12.972, lng: 77.594 }, crops: ALL, capacity_t: 2000, used_t: 1500, price_per_kg_day: 0.28, rating: 4.5, features: ['Multi-chamber', 'Ripening room', 'Small lots OK'] },
  { facility_id: 'CS-KLR-1', name: 'Kolar Tomato Cold Yard', city: 'Kolar', state: 'Karnataka', coordinates: { lat: 13.137, lng: 78.13 }, crops: ['Tomatoes', 'Capsicum'], capacity_t: 900, used_t: 600, price_per_kg_day: 0.17, rating: 4.1, features: ['Pre-cooling', 'Crate washing'] },
  { facility_id: 'CS-HYD-1', name: 'Hyderabad Agri Cold Chain', city: 'Hyderabad', state: 'Telangana', coordinates: { lat: 17.385, lng: 78.487 }, crops: ALL, capacity_t: 1700, used_t: 1150, price_per_kg_day: 0.25, rating: 4.3, features: ['Multi-chamber'] },
  { facility_id: 'CS-MDP-1', name: 'Madanapalle Produce Cold Store', city: 'Madanapalle', state: 'Andhra Pradesh', coordinates: { lat: 13.55, lng: 78.503 }, crops: ['Tomatoes'], capacity_t: 800, used_t: 520, price_per_kg_day: 0.15, rating: 4.0, features: ['Pre-cooling'] },
  { facility_id: 'CS-CHN-1', name: 'Koyambedu Cold Storage', city: 'Chennai', state: 'Tamil Nadu', coordinates: { lat: 13.07, lng: 80.195 }, crops: ALL, capacity_t: 2200, used_t: 1900, price_per_kg_day: 0.3, rating: 4.1, features: ['Next to wholesale market', 'Small lots OK'] },
  { facility_id: 'CS-KOC-1', name: 'Kochi Fresh Cold Point', city: 'Kochi', state: 'Kerala', coordinates: { lat: 9.931, lng: 76.267 }, crops: ['Tomatoes', 'Capsicum', 'Spinach', 'Grapes'], capacity_t: 600, used_t: 380, price_per_kg_day: 0.29, rating: 4.2, features: ['Multi-chamber'] },
  // East
  { facility_id: 'CS-KOL-1', name: 'Kolkata Agri Cold House', city: 'Kolkata', state: 'West Bengal', coordinates: { lat: 22.573, lng: 88.364 }, crops: ['Onions', 'Tomatoes', 'Capsicum', 'Spinach'], capacity_t: 2600, used_t: 2000, price_per_kg_day: 0.2, rating: 4.0, features: ['Multi-chamber', 'Bulk bags'] },
  { facility_id: 'CS-PAT-1', name: 'Patna Produce Cold Store', city: 'Patna', state: 'Bihar', coordinates: { lat: 25.594, lng: 85.137 }, crops: ['Onions', 'Tomatoes'], capacity_t: 1500, used_t: 1000, price_per_kg_day: 0.11, rating: 3.7, features: ['Bulk bags'] },
  { facility_id: 'CS-BBS-1', name: 'Bhubaneswar Cold Chain Point', city: 'Bhubaneswar', state: 'Odisha', coordinates: { lat: 20.296, lng: 85.825 }, crops: ['Onions', 'Tomatoes', 'Capsicum'], capacity_t: 700, used_t: 420, price_per_kg_day: 0.16, rating: 3.9, features: ['Pre-cooling'] },
];

export interface StoredLot {
  lot_id: string;
  facility_id: string;
  farmer_id: string;
  farmer_name: string;
  commodity: string;
  quantity_kg: number;
  grade_in: 'A' | 'B' | 'C';
  stored_at: string; // ISO
  /** ₹/kg paid for the produce before storage (for releasing back to market) */
  cost_per_kg: number;
  source_batch_id?: string;
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

/** Seed lots: two portal farmers plus other farmers' stock across India (manager view). */
export function seedLots(): StoredLot[] {
  return [
    { lot_id: 'L-101', facility_id: 'CS-LSL-1', farmer_id: 'F-02', farmer_name: 'Sunita Jadhav', commodity: 'Onions', quantity_kg: 2000, grade_in: 'A', stored_at: daysAgo(40), cost_per_kg: 8 },
    { lot_id: 'L-102', facility_id: 'CS-SNG-1', farmer_id: 'F-02', farmer_name: 'Sunita Jadhav', commodity: 'Grapes', quantity_kg: 600, grade_in: 'A', stored_at: daysAgo(22), cost_per_kg: 44 },
    { lot_id: 'L-103', facility_id: 'CS-NSK-1', farmer_id: 'F-01', farmer_name: 'Ramesh Patil', commodity: 'Tomatoes', quantity_kg: 300, grade_in: 'A', stored_at: daysAgo(9), cost_per_kg: 11 },
    { lot_id: 'L-104', facility_id: 'CS-PUN-1', farmer_id: 'F-01', farmer_name: 'Ramesh Patil', commodity: 'Capsicum', quantity_kg: 200, grade_in: 'B', stored_at: daysAgo(4), cost_per_kg: 23 },
    { lot_id: 'L-105', facility_id: 'CS-IDR-1', farmer_id: 'EXT-1', farmer_name: 'Malwa Growers Group', commodity: 'Onions', quantity_kg: 6000, grade_in: 'A', stored_at: daysAgo(70), cost_per_kg: 9 },
    { lot_id: 'L-106', facility_id: 'CS-BLR-1', farmer_id: 'EXT-2', farmer_name: 'Kolar Farmers Collective', commodity: 'Tomatoes', quantity_kg: 900, grade_in: 'B', stored_at: daysAgo(6), cost_per_kg: 10 },
    { lot_id: 'L-107', facility_id: 'CS-DEL-1', farmer_id: 'EXT-3', farmer_name: 'Sonipat Vegetable Co-op', commodity: 'Spinach', quantity_kg: 350, grade_in: 'A', stored_at: daysAgo(3), cost_per_kg: 16 },
    { lot_id: 'L-108', facility_id: 'CS-AMD-1', farmer_id: 'EXT-4', farmer_name: 'Kutch Agro Producers', commodity: 'Grapes', quantity_kg: 800, grade_in: 'A', stored_at: daysAgo(38), cost_per_kg: 42 },
    { lot_id: 'L-109', facility_id: 'CS-KOL-1', farmer_id: 'EXT-5', farmer_name: 'Hooghly Growers', commodity: 'Capsicum', quantity_kg: 400, grade_in: 'A', stored_at: daysAgo(15), cost_per_kg: 24 },
  ];
}
