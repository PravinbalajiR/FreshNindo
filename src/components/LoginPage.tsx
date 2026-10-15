// FreshRoute — One-click demo login. Pick a role, pick a mock profile, you're in.
import React from 'react';
import { useApp } from '../store/AppContext';
import { MOCK_USERS, ROLE_META, type Role } from '../data/users';

const ROLE_DOES: Record<Role, string[]> = {
  farmer: ['List harvested stock in seconds', 'See which market each batch goes to', 'Watch freshness in a 3D crate view'],
  retailer: ['Order produce for your market', 'See how much of each order is covered', 'Track the truck live in 3D'],
  manager: ['Run the dispatch optimizer', 'Compare routes on a real road map', 'Test what-if disruptions'],
};

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const LoginPage: React.FC = () => {
  const { login } = useApp();
  const roles: Role[] = ['farmer', 'retailer', 'manager'];

  return (
    <div className="login-page">
      <div className="login-brand">
        Fresh<span>Route</span>
      </div>
      <p className="login-sub">Get produce from farm to market while it's still fresh. Choose who you are to continue.</p>

      <div className="login-flow" aria-label="How the supply chain flows">
        <span className="node">🌾 Farmer lists stock</span>→<span className="node">🧭 Manager plans routes</span>→
        <span className="node">🚚 Truck dispatched</span>→<span className="node">🏪 Retailer receives</span>
      </div>

      <div className="role-grid">
        {roles.map((role) => {
          const meta = ROLE_META[role];
          return (
            <section key={role} className="role-card anim-fade-up" aria-labelledby={`role-${role}`}>
              <div className="role-icon" aria-hidden="true">{meta.icon}</div>
              <div className="role-title" id={`role-${role}`}>{meta.label}</div>
              <div className="role-tagline">{meta.tagline}</div>
              <ul className="role-does">
                {ROLE_DOES[role].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              {MOCK_USERS.filter((u) => u.role === role).map((u) => (
                <button key={u.id} className="profile-btn" onClick={() => login(u)}>
                  <span className={`avatar ${role}`}>{initials(u.name)}</span>
                  <span>
                    <span className="profile-name" style={{ display: 'block' }}>{u.name}</span>
                    <span className="profile-meta">{u.org} · {u.location}</span>
                  </span>
                  <span className="profile-go">Continue →</span>
                </button>
              ))}
            </section>
          );
        })}
      </div>

      <p className="login-foot">Demo mode: mock accounts with no passwords. All data is synthetic and stays in this browser.</p>
    </div>
  );
};

export { initials };
