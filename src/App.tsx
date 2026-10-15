// FreshRoute — Main Application Shell
// Login gate → role portal (Farmer / Retailer / Manager) sharing one supply-chain store.
import React, { useEffect } from 'react';
import { AppProvider, useApp, type ActiveSection } from './store/AppContext';
import type { Role } from './data/users';
import { ROLE_META } from './data/users';
import { LoginPage, initials } from './components/LoginPage';
import { CommandSection } from './components/CommandSection';
import { DispatchSection } from './components/DispatchSection';
import { InventorySection } from './components/InventorySection';
import { DestinationsSection } from './components/DestinationsSection';
import { ImpactSection } from './components/ImpactSection';
import { ScenarioSection } from './components/ScenarioSection';
import { AssistantDrawer } from './components/AssistantDrawer';
import { FarmerAddStock, FarmerHome, FarmerRoutes } from './components/farmer/FarmerPortal';
import { RetailerHome, RetailerOrder, RetailerTrack } from './components/retailer/RetailerPortal';
import './styles/design-system.css';
import './styles/portals.css';

interface NavItem {
  id: ActiveSection;
  icon: string;
  label: string;
  hint: string;
}

const NAV: Record<Role, { group: string; items: NavItem[] }[]> = {
  farmer: [
    {
      group: 'My farm',
      items: [
        { id: 'farmer-home', icon: '🌾', label: 'My stock', hint: 'Freshness & where it goes' },
        { id: 'farmer-add', icon: '➕', label: 'Add stock', hint: 'List a new batch' },
        { id: 'farmer-routes', icon: '🗺', label: 'Routes & decisions', hint: 'Road map of markets' },
      ],
    },
  ],
  retailer: [
    {
      group: 'My store',
      items: [
        { id: 'retailer-home', icon: '🏪', label: 'Orders & deliveries', hint: 'Coverage and incoming trucks' },
        { id: 'retailer-order', icon: '🛒', label: 'New order', hint: 'Request produce' },
        { id: 'retailer-track', icon: '🚚', label: 'Track delivery', hint: 'Live 3D truck' },
      ],
    },
  ],
  manager: [
    {
      group: 'Plan',
      items: [
        { id: 'command', icon: '⚡', label: 'Command', hint: 'Today at a glance' },
        { id: 'inventory', icon: '📦', label: 'Inventory', hint: 'All batches, 3D warehouse' },
        { id: 'dispatch', icon: '📋', label: 'Dispatch', hint: 'Who ships what, when' },
      ],
    },
    {
      group: 'Decide',
      items: [
        { id: 'destinations', icon: '🗺', label: 'Routes & markets', hint: 'Road map + decisions' },
        { id: 'scenario', icon: '🔬', label: 'Scenario Lab', hint: 'What-if disruptions' },
        { id: 'impact', icon: '📊', label: 'Impact', hint: 'Vs. baseline plan' },
      ],
    },
  ],
};

function Section({ id }: { id: ActiveSection }) {
  switch (id) {
    case 'command': return <CommandSection />;
    case 'dispatch': return <DispatchSection />;
    case 'inventory': return <InventorySection />;
    case 'destinations': return <DestinationsSection />;
    case 'scenario': return <ScenarioSection />;
    case 'impact': return <ImpactSection />;
    case 'farmer-home': return <FarmerHome />;
    case 'farmer-add': return <FarmerAddStock />;
    case 'farmer-routes': return <FarmerRoutes />;
    case 'retailer-home': return <RetailerHome />;
    case 'retailer-order': return <RetailerOrder />;
    case 'retailer-track': return <RetailerTrack />;
  }
}

function AppShell() {
  const { state, navigate, generatePlan, resetDemo, logout } = useApp();

  // Re-plan whenever stock or orders change (and on demo reset)
  useEffect(() => {
    generatePlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.demoReset, state.batches, state.orders]);

  if (!state.user) return <LoginPage />;

  const role = state.user.role;
  const groups = NAV[role];
  const allItems = groups.flatMap((g) => g.items);
  // Guard against a section that belongs to another role (e.g. after switching)
  const current = allItems.some((i) => i.id === state.section) ? state.section : allItems[0].id;
  const currentItem = allItems.find((i) => i.id === current)!;

  return (
    <div className="app-shell">
      <nav className="sidebar" role="navigation" aria-label="Main navigation">
        <div className="sidebar-logo">
          <div className="logo-mark">
            Fresh<span style={{ color: 'var(--ready)' }}>Route</span>
          </div>
          <div className="logo-tagline">{ROLE_META[role].label} portal</div>
        </div>

        <div className="sidebar-nav">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="nav-section-label">{g.group}</div>
              {g.items.map((item) => (
                <div
                  key={item.id}
                  className={`nav-item ${current === item.id ? 'active' : ''}`}
                  onClick={() => navigate(item.id)}
                  role="button"
                  tabIndex={0}
                  aria-current={current === item.id ? 'page' : undefined}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(item.id)}
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  <span className="nav-text">
                    <span>{item.label}</span>
                    <span className="nav-hint">{item.hint}</span>
                  </span>
                  {item.id === 'scenario' && state.scenarioPlan && (
                    <span
                      style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', flexShrink: 0 }}
                      aria-label="Scenario active"
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="data-badge" style={{ marginBottom: 'var(--space-3)', display: 'flex' }}>
            ⚠ Synthetic demo data
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
            onClick={() => confirm('Reset all stock and orders to the demo starting point?') && resetDemo()}
            title="Reset stock and orders to the initial demo state"
          >
            ↺ Reset demo data
          </button>
        </div>
      </nav>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-crumb">
            {ROLE_META[role].label} / <strong>{currentItem.label}</strong>
            {state.isGenerating && <span style={{ marginLeft: 12, color: 'var(--accent)' }}>● Re-planning…</span>}
          </div>
          <div className="user-chip">
            <span className={`avatar ${role}`}>{initials(state.user.name)}</span>
            <span>
              <span style={{ display: 'block', fontWeight: 600 }}>{state.user.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{state.user.org}</span>
            </span>
            <span className="role-tag">{ROLE_META[role].label}</span>
            <button className="btn btn-secondary btn-sm" onClick={logout}>Switch role</button>
          </div>
        </header>
        <main className="main-content" role="main">
          <Section id={current} />
        </main>
      </div>

      {role === 'manager' && <AssistantDrawer />}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

export default App;
