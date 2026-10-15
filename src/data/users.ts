// FreshRoute — Mock accounts for one-click demo login.
// DATA PROVENANCE: SYNTHETIC. No passwords, no real identities.

export type Role = 'farmer' | 'retailer' | 'manager';

export interface MockUser {
  id: string;
  role: Role;
  name: string;
  org: string;
  location: string;
  /** Retailers buy at one market; their orders become demand there. */
  destination_id?: string;
}

export const MOCK_USERS: MockUser[] = [
  { id: 'F-01', role: 'farmer', name: 'Ramesh Patil', org: 'Patil Farms', location: 'Dindori, Nashik' },
  { id: 'F-02', role: 'farmer', name: 'Sunita Jadhav', org: 'Jadhav Agro Co-op', location: 'Niphad, Nashik' },
  { id: 'R-01', role: 'retailer', name: 'FreshMart Mumbai', org: 'Mumbai Central Market', location: 'Mumbai', destination_id: 'D-MUM' },
  { id: 'R-02', role: 'retailer', name: 'GreenBasket Pune', org: 'Pune APMC', location: 'Pune', destination_id: 'D-PUN' },
  { id: 'R-03', role: 'retailer', name: 'Annapurna Stores', org: 'Aurangabad Market', location: 'Aurangabad', destination_id: 'D-AUR' },
  { id: 'M-01', role: 'manager', name: 'Distribution Desk', org: 'Nashik Distribution Centre', location: 'Nashik' },
];

/** Which farmer supplied each seed batch. */
export const SEED_BATCH_OWNERS: Record<string, string> = {
  'B-001': 'F-01',
  'B-002': 'F-01',
  'B-005': 'F-01',
  'B-003': 'F-02',
  'B-004': 'F-02',
  'B-006': 'F-02',
};

export const COMMODITIES = ['Tomatoes', 'Onions', 'Capsicum', 'Spinach', 'Grapes'] as const;

export const ROLE_META: Record<Role, { label: string; tagline: string; icon: string }> = {
  farmer: { label: 'Farmer', tagline: 'Add harvested stock and see where it sells', icon: '🌾' },
  retailer: { label: 'Retailer', tagline: 'Order produce and track deliveries', icon: '🏪' },
  manager: { label: 'Manager', tagline: 'Plan dispatch and make route decisions', icon: '🧭' },
};
