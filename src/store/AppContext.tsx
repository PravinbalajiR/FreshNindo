// FreshRoute — Global Application Store
// React context-based state management for the hackathon MVP.

import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
} from 'react';
import { generatePlans, comparePlans } from '../engine/optimizer';
import type { Plan, ComparisonResult, ScenarioModification } from '../types';
import { ROUTES } from '../data/dataset';

export type ActiveSection =
  | 'command'
  | 'dispatch'
  | 'inventory'
  | 'destinations'
  | 'scenario'
  | 'impact';

interface AppState {
  section: ActiveSection;
  baseline: Plan | null;
  optimized: Plan | null;
  comparison: ComparisonResult | null;
  scenarios: ScenarioModification[];
  scenarioPlan: Plan | null;
  isGenerating: boolean;
  selectedBatchId: string | null;
  demoReset: number; // increment to trigger reset
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
  | { type: 'RESET_DEMO' };

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
    default:
      return state;
  }
}

const initialState: AppState = {
  section: 'command',
  baseline: null,
  optimized: null,
  comparison: null,
  scenarios: [],
  scenarioPlan: null,
  isGenerating: false,
  selectedBatchId: null,
  demoReset: 0,
};

interface AppContextValue {
  state: AppState;
  navigate: (section: ActiveSection) => void;
  generatePlan: () => void;
  applyScenario: (mods: ScenarioModification[]) => void;
  resetScenario: () => void;
  selectBatch: (id: string | null) => void;
  resetDemo: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const navigate = useCallback((section: ActiveSection) => {
    dispatch({ type: 'SET_SECTION', payload: section });
  }, []);

  const generatePlan = useCallback(() => {
    dispatch({ type: 'GENERATE_START' });
    // Use setTimeout so the loading state is visible briefly
    setTimeout(() => {
      const { baseline, optimized } = generatePlans();
      const comparison = comparePlans(baseline, optimized);
      dispatch({
        type: 'GENERATE_COMPLETE',
        payload: { baseline, optimized, comparison },
      });
    }, 600);
  }, []);

  const applyScenario = useCallback((mods: ScenarioModification[]) => {
    dispatch({ type: 'SET_SCENARIOS', payload: mods });
    dispatch({ type: 'GENERATE_START' });
    setTimeout(() => {
      const { optimized } = generatePlans(mods);
      dispatch({ type: 'SCENARIO_REPLAN', payload: optimized });
    }, 800);
  }, []);

  const resetScenario = useCallback(() => {
    dispatch({ type: 'RESET_SCENARIO' });
  }, []);

  const selectBatch = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_BATCH', payload: id });
  }, []);

  const resetDemo = useCallback(() => {
    dispatch({ type: 'RESET_DEMO' });
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
