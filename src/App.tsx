// FreshRoute — Main Application Shell
import React, { useEffect } from 'react';
import { AppProvider, useApp, type ActiveSection } from './store/AppContext';
import { CommandSection } from './components/CommandSection';
import { DispatchSection } from './components/DispatchSection';
import { InventorySection } from './components/InventorySection';
import { DestinationsSection } from './components/DestinationsSection';
import { ImpactSection } from './components/ImpactSection';
import { ScenarioSection } from './components/ScenarioSection';
import './styles/design-system.css';

const NAV_ITEMS: {
  id: ActiveSection;
  icon: string;
  label: string;
}[] = [
  { id: 'command', icon: '⚡', label: 'Command' },
  { id: 'dispatch', icon: '📦', label: 'Dispatch' },
  { id: 'inventory', icon: '🥬', label: 'Inventory' },
  { id: 'destinations', icon: '🗺', label: 'Destinations' },
  { id: 'scenario', icon: '🔬', label: 'Scenario Lab' },
  { id: 'impact', icon: '📊', label: 'Impact' },
];

function AppShell() {
  const { state, navigate, generatePlan, resetDemo } = useApp();

  // Auto-generate plan on first load for demo
  useEffect(() => {
    generatePlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.demoReset]);

  const currentSection = state.section;

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <nav className="sidebar" role="navigation" aria-label="Main navigation">
        <div className="sidebar-logo">
          <div className="logo-mark">FreshRoute</div>
          <div className="logo-tagline">Save the value. Before time takes it away.</div>
        </div>

        <div className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${currentSection === item.id ? 'active' : ''}`}
              onClick={() => navigate(item.id as ActiveSection)}
              role="button"
              tabIndex={0}
              aria-label={item.label}
              onKeyDown={(e) => e.key === 'Enter' && navigate(item.id as ActiveSection)}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'scenario' && state.scenarioPlan && (
                <span
                  style={{
                    marginLeft: 'auto',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--warning-text)',
                    flexShrink: 0,
                  }}
                  aria-label="Scenario active"
                />
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="data-badge" style={{ marginBottom: 'var(--space-3)', display: 'flex' }}>
            ⚠ Synthetic Data
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
            onClick={resetDemo}
            title="Reset to initial demo state"
          >
            ↺ Reset Demo
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="main-content" role="main">
        {currentSection === 'command' && <CommandSection />}
        {currentSection === 'dispatch' && <DispatchSection />}
        {currentSection === 'inventory' && <InventorySection />}
        {currentSection === 'destinations' && <DestinationsSection />}
        {currentSection === 'scenario' && <ScenarioSection />}
        {currentSection === 'impact' && <ImpactSection />}
      </main>
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
