// FreshRoute — Global Application Store
// State management with Google Routes sync and OpenRouter Qwen integration.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';
import { generatePlans, comparePlans } from '../engine/optimizer';
import type { Plan, ComparisonResult, ScenarioModification } from '../types';
import {
  ROUTES,
  DESTINATIONS,
  ORIGIN_COORDINATES,
  type Route,
  BATCHES,
} from '../data/dataset';

export type ActiveSection =
  | 'command'
  | 'dispatch'
  | 'inventory'
  | 'destinations'
  | 'scenario'
  | 'impact';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  model?: string;
  grounded?: boolean;
  timestamp: string;
}

interface AppState {
  section: ActiveSection;
  routes: Route[];
  routesSource: 'google_routes' | 'cache' | 'fallback_synthetic';
  isSyncingRoutes: boolean;
  baseline: Plan | null;
  optimized: Plan | null;
  comparison: ComparisonResult | null;
  scenarios: ScenarioModification[];
  scenarioPlan: Plan | null;
  isGenerating: boolean;
  selectedBatchId: string | null;
  demoReset: number; // increment to trigger reset
  // Assistant State
  isAssistantOpen: boolean;
  isAskingAssistant: boolean;
  assistantMessages: ChatMessage[];
}

type Action =
  | { type: 'SET_SECTION'; payload: ActiveSection }
  | { type: 'GENERATE_START' }
  | {
      type: 'GENERATE_COMPLETE';
      payload: { baseline: Plan; optimized: Plan; comparison: ComparisonResult };
    }
  | { type: 'SET_SCENARIOS'; payload: ScenarioModification[] }
  | { type: 'SCENARIO_REPLAN'; payload: Plan }
  | { type: 'RESET_SCENARIO' }
  | { type: 'SELECT_BATCH'; payload: string | null }
  | { type: 'RESET_DEMO' }
  | { type: 'SYNC_ROUTES_START' }
  | {
      type: 'SYNC_ROUTES_COMPLETE';
      payload: { routes: Route[]; source: 'google_routes' | 'cache' | 'fallback_synthetic' };
    }
  | { type: 'TOGGLE_ASSISTANT'; payload?: boolean }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_ASKING_ASSISTANT'; payload: boolean };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SECTION':
      return { ...state, section: action.payload };
    case 'GENERATE_START':
      return { ...state, isGenerating: true };
    case 'GENERATE_COMPLETE':
      return {
        ...state,
        isGenerating: false,
        baseline: action.payload.baseline,
        optimized: action.payload.optimized,
        comparison: action.payload.comparison,
      };
    case 'SET_SCENARIOS':
      return { ...state, scenarios: action.payload };
    case 'SCENARIO_REPLAN':
      return { ...state, scenarioPlan: action.payload, isGenerating: false };
    case 'RESET_SCENARIO':
      return { ...state, scenarios: [], scenarioPlan: null };
    case 'SELECT_BATCH':
      return { ...state, selectedBatchId: action.payload };
    case 'RESET_DEMO':
      return {
        ...initialState,
        demoReset: state.demoReset + 1,
      };
    case 'SYNC_ROUTES_START':
      return { ...state, isSyncingRoutes: true };
    case 'SYNC_ROUTES_COMPLETE':
      return {
        ...state,
        isSyncingRoutes: false,
        routes: action.payload.routes,
        routesSource: action.payload.source,
      };
    case 'TOGGLE_ASSISTANT':
      return {
        ...state,
        isAssistantOpen:
          action.payload !== undefined ? action.payload : !state.isAssistantOpen,
      };
    case 'ADD_CHAT_MESSAGE':
      return {
        ...state,
        assistantMessages: [...state.assistantMessages, action.payload],
      };
    case 'SET_ASKING_ASSISTANT':
      return { ...state, isAskingAssistant: action.payload };
    default:
      return state;
  }
}

const initialState: AppState = {
  section: 'command',
  routes: ROUTES,
  routesSource: 'fallback_synthetic',
  isSyncingRoutes: false,
  baseline: null,
  optimized: null,
  comparison: null,
  scenarios: [],
  scenarioPlan: null,
  isGenerating: false,
  selectedBatchId: null,
  demoReset: 0,
  isAssistantOpen: false,
  isAskingAssistant: false,
  assistantMessages: [
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hello, I am the FreshRoute operational assistant powered by Qwen. Ask me about batch shelf-life urgency, destination allocations, economic comparisons, or active disruptions.',
      model: 'qwen/qwen-2.5-72b-instruct',
      grounded: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ],
};

interface AppContextValue {
  state: AppState;
  navigate: (section: ActiveSection) => void;
  generatePlan: () => void;
  applyScenario: (mods: ScenarioModification[]) => void;
  resetScenario: () => void;
  selectBatch: (id: string | null) => void;
  resetDemo: () => void;
  syncRoutesWithGoogle: () => Promise<void>;
  toggleAssistant: (open?: boolean) => void;
  askAssistantPrompt: (question: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const navigate = useCallback((section: ActiveSection) => {
    dispatch({ type: 'SET_SECTION', payload: section });
  }, []);

  const generatePlan = useCallback(() => {
    dispatch({ type: 'GENERATE_START' });
    setTimeout(() => {
      const { baseline, optimized } = generatePlans(undefined, state.routes);
      const comparison = comparePlans(baseline, optimized);
      dispatch({
        type: 'GENERATE_COMPLETE',
        payload: { baseline, optimized, comparison },
      });
    }, 400);
  }, [state.routes]);

  const applyScenario = useCallback(
    (mods: ScenarioModification[]) => {
      dispatch({ type: 'SET_SCENARIOS', payload: mods });
      dispatch({ type: 'GENERATE_START' });
      setTimeout(() => {
        const { optimized } = generatePlans(mods, state.routes);
        dispatch({ type: 'SCENARIO_REPLAN', payload: optimized });
      }, 500);
    },
    [state.routes]
  );

  const resetScenario = useCallback(() => {
    dispatch({ type: 'RESET_SCENARIO' });
  }, []);

  const selectBatch = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_BATCH', payload: id });
  }, []);

  const resetDemo = useCallback(() => {
    dispatch({ type: 'RESET_DEMO' });
  }, []);

  const toggleAssistant = useCallback((open?: boolean) => {
    dispatch({ type: 'TOGGLE_ASSISTANT', payload: open });
  }, []);

async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(url, options);
    // If dev server proxy returns 404 or isn't active, fallback to direct backend port 3001
    if (res.status === 404 && url.startsWith('/api')) {
      return await fetch(`http://localhost:3001${url}`, options);
    }
    return res;
  } catch (err) {
    if (url.startsWith('/api')) {
      return await fetch(`http://localhost:3001${url}`, options);
    }
    throw err;
  }
}

  // Sync route estimates with backend (Google Routes API / cached / fallback)
  const syncRoutesWithGoogle = useCallback(async () => {
    dispatch({ type: 'SYNC_ROUTES_START' });

    try {
      const routesPayload = state.routes.map((r) => {
        const dest = DESTINATIONS.find((d) => d.destination_id === r.destination_id);
        return {
          routeId: r.route_id,
          origin: ORIGIN_COORDINATES,
          destination: dest?.coordinates || { lat: 19.0, lng: 73.0 },
          fallbackHours: r.travel_time_hours,
          fallbackKm: r.distance_km || 150,
        };
      });

      const res = await apiFetch('/api/routes/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routes: routesPayload }),
      });

      if (!res.ok) {
        throw new Error(`Route estimate API error HTTP ${res.status}`);
      }

      const data = await res.json();
      let detectedSource: 'google_routes' | 'cache' | 'fallback_synthetic' = 'fallback_synthetic';

      const updatedRoutes = state.routes.map((r) => {
        const est = (data.routes || []).find((item: any) => item.routeId === r.route_id);
        if (est) {
          if (est.source === 'google_routes') detectedSource = 'google_routes';
          else if (est.source === 'cache' && detectedSource !== 'google_routes') detectedSource = 'cache';

          return {
            ...r,
            travel_time_hours: est.durationHours || r.travel_time_hours,
            distance_km: est.distanceKm || r.distance_km,
            duration_formatted: est.durationFormatted || r.duration_formatted,
            encoded_polyline: est.encodedPolyline,
            is_live_google: !est.isFallback,
            route_source: est.source === 'google_routes' ? 'google_routes' : est.source === 'cache' ? 'cache' : 'fallback_synthetic',
          } as Route;
        }
        return r;
      });

      dispatch({
        type: 'SYNC_ROUTES_COMPLETE',
        payload: { routes: updatedRoutes, source: detectedSource },
      });

      // Recalculate plan with the freshly synchronized route durations
      const { baseline, optimized } = generatePlans(
        state.scenarios.length > 0 ? state.scenarios : undefined,
        updatedRoutes
      );
      const comparison = comparePlans(baseline, optimized);
      dispatch({
        type: 'GENERATE_COMPLETE',
        payload: { baseline, optimized, comparison },
      });
    } catch (err) {
      console.warn('[AppContext] syncRoutesWithGoogle failed; retaining fallback routes:', err);
      dispatch({
        type: 'SYNC_ROUTES_COMPLETE',
        payload: { routes: state.routes, source: 'fallback_synthetic' },
      });
    }
  }, [state.routes, state.scenarios]);

  // Ask Qwen Assistant with full operational context
  const askAssistantPrompt = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: q,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: userMsg });
      dispatch({ type: 'SET_ASKING_ASSISTANT', payload: true });

      try {
        const currentPlan = state.scenarioPlan || state.optimized;

        const context = {
          planSummary: currentPlan
            ? {
                totalAllocatedKg: currentPlan.metrics.total_allocated_kg,
                fulfilledDemandKg: currentPlan.metrics.fulfilled_demand_kg,
                fulfillmentRatePct: currentPlan.metrics.fulfillment_rate * 100,
                grossRevenue: currentPlan.metrics.gross_revenue,
                netRevenue: currentPlan.metrics.net_revenue,
                transportCost: currentPlan.metrics.total_transport_cost,
                estimatedSpoilageKg: currentPlan.metrics.estimated_spoilage_kg,
                feasibilityViolations: currentPlan.metrics.feasibility_violations,
              }
            : undefined,
          activeScenario: {
            active: !!state.scenarioPlan,
            name: state.scenarios[0]?.description || 'Custom Scenario',
            description: state.scenarios.map((s) => s.description).join('; '),
          },
          batches: BATCHES.map((b) => ({
            batch_id: b.batch_id,
            commodity: b.commodity,
            quantity_kg: b.quantity_kg,
            remaining_shelf_life_hours: b.remaining_shelf_life_hours,
            acquisition_cost_per_kg: b.acquisition_cost_per_kg,
            quality_grade: b.quality_grade,
          })),
          destinations: DESTINATIONS.map((d) => ({
            destination_id: d.destination_id,
            name: d.name,
            handling_time_hours: d.handling_time_hours,
            capacity_kg: d.capacity_kg,
          })),
          allocations: currentPlan?.allocations.slice(0, 10).map((a) => ({
            batch_id: a.batch.batch_id,
            commodity: a.batch.commodity,
            destination_name: a.destination.name,
            quantity_kg: a.quantity_kg,
            margin_hours: a.feasibility.usable_margin_hours,
            feasibility_status: a.feasibility.status,
            net_revenue_contribution: a.net_revenue_contribution,
            dispatch_priority: a.dispatch_priority,
            why_destination: a.explanation.why_this_destination,
          })),
          discounts: currentPlan?.metrics.discount_recommendations.map((d) => ({
            batch_id: d.batch.batch_id,
            commodity: d.batch.commodity,
            quantity_at_risk_kg: d.quantity_at_risk_kg,
            recommended_discount_pct: d.recommended_discount_pct,
            discounted_price_per_kg: d.discounted_price_per_kg,
          })),
          comparison: state.comparison
            ? {
                netRevenueDelta: state.comparison.net_revenue_diff,
                spoilageDeltaKg: state.comparison.spoilage_diff_kg,
                fulfillmentDeltaKg: state.comparison.fulfillment_diff_kg,
              }
            : undefined,
        };

        const res = await apiFetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: q, context }),
        });

        if (!res.ok) {
          throw new Error(`Assistant error HTTP ${res.status}`);
        }

        const data = await res.json();
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: data.reply || 'No response returned.',
          model: data.model || 'qwen/qwen-2.5-72b-instruct',
          grounded: data.grounded ?? true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        dispatch({ type: 'ADD_CHAT_MESSAGE', payload: assistantMsg });
      } catch (err: any) {
        console.error('[AppContext] askAssistantPrompt error:', err);
        const errorMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: `Operational assistant query failed (${err.message || 'connection issue'}). The application optimizer and dispatch views remain fully operational.`,
          model: 'fallback-error',
          grounded: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        dispatch({ type: 'ADD_CHAT_MESSAGE', payload: errorMsg });
      } finally {
        dispatch({ type: 'SET_ASKING_ASSISTANT', payload: false });
      }
    },
    [state.optimized, state.scenarioPlan, state.scenarios, state.comparison]
  );

  // Sync routes on mount if backend is reachable
  useEffect(() => {
    syncRoutesWithGoogle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
        navigate,
        generatePlan,
        applyScenario,
        resetScenario,
        selectBatch,
        resetDemo,
        syncRoutesWithGoogle,
        toggleAssistant,
        askAssistantPrompt,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { ROUTES };
