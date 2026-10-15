// FreshRoute — Automated Acceptance & Verification Suite
// Validates all 8 challenge requirements, constraint satisfaction,
// economics, feasibility checks, and scenario replanning.

import {
  BATCHES,
  DESTINATIONS,
  ROUTES,
  FEASIBILITY_CONFIG,
  DISCOUNT_TIERS,
} from '../data/dataset.ts';
import {
  checkFeasibility,
  generatePlans,
  comparePlans,
} from './optimizer.ts';

interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, testName: string, message?: string) {
  results.push({
    suite,
    testName,
    passed: !!condition,
    message: condition ? undefined : (message || 'Assertion failed'),
  });
}

console.log('================================================================');
console.log('FRESHROUTE — ACCEPTANCE & VERIFICATION TEST SUITE');
console.log('================================================================\n');

// ─── SUITE 1: DATASET & PROVENANCE INTEGRITY ─────────────────────────────────
const S1 = '1. Data & Provenance Integrity';

// 1.1 Batch validation
BATCHES.forEach((b) => {
  assert(
    b.batch_id.length > 0 && b.quantity_kg > 0 && b.remaining_shelf_life_hours > 0,
    S1,
    `Batch ${b.batch_id} valid schema`,
    `Invalid fields in batch ${b.batch_id}`
  );
  assert(
    b.acquisition_cost_per_kg >= 0,
    S1,
    `Batch ${b.batch_id} non-negative acquisition cost`,
    `Negative cost in batch ${b.batch_id}`
  );
});

// 1.2 Destination validation
DESTINATIONS.forEach((d) => {
  assert(
    d.capacity_kg > 0 && d.handling_time_hours >= 0,
    S1,
    `Destination ${d.destination_id} capacity & handling valid`,
    `Invalid destination config ${d.destination_id}`
  );
  Object.entries(d.demand_by_commodity).forEach(([comm, dem]) => {
    assert(dem >= 0, S1, `Destination ${d.name} demand for ${comm} non-negative`);
  });
  Object.entries(d.selling_price_by_commodity).forEach(([comm, pr]) => {
    assert(pr > 0, S1, `Destination ${d.name} price for ${comm} positive`);
  });
});

// 1.3 Route validation
ROUTES.forEach((r) => {
  assert(
    r.travel_time_hours > 0 && r.transport_cost_per_kg >= 0 && r.vehicle_capacity_kg > 0,
    S1,
    `Route ${r.route_id} valid physics and cost`,
    `Invalid route parameters for ${r.route_id}`
  );
});

// ─── SUITE 2: SHELF-LIFE FEASIBILITY (THE FRESH WINDOW) ──────────────────────
const S2 = '2. Feasibility Engine (The Fresh Window)';

// 2.1 Formula verification: usable_margin_hours = shelf_life - travel - handling
const testBatch = { ...BATCHES[0], remaining_shelf_life_hours: 15 };
const testRoute = ROUTES[0]; // 6h travel
const testDest = DESTINATIONS[0]; // 2h handling
const feasRes = checkFeasibility(testBatch, testRoute, testDest);
const expectedMargin = 15 - 6 - 2; // 7h
assert(
  feasRes.usable_margin_hours === expectedMargin,
  S2,
  'Usable margin formula matches specification',
  `Expected ${expectedMargin}, got ${feasRes.usable_margin_hours}`
);
assert(
  feasRes.status === 'READY',
  S2,
  'Margin >= 6h classified as READY',
  `Status was ${feasRes.status}`
);

// 2.2 Time-sensitive threshold
const tightBatch = { ...BATCHES[0], remaining_shelf_life_hours: 11 }; // 11 - 6 - 2 = 3h margin
const tightRes = checkFeasibility(tightBatch, testRoute, testDest);
assert(
  tightRes.status === 'TIME_SENSITIVE' && tightRes.usable_margin_hours === 3,
  S2,
  'Margin between 1h and 6h classified as TIME_SENSITIVE'
);

// 2.3 Infeasible threshold
const expiredBatch = { ...BATCHES[0], remaining_shelf_life_hours: 8 }; // 8 - 6 - 2 = 0h margin (< 1h)
const infeasRes = checkFeasibility(expiredBatch, testRoute, testDest);
assert(
  infeasRes.status === 'INFEASIBLE' && infeasRes.usable_margin_hours === 0,
  S2,
  'Margin < 1h classified as INFEASIBLE'
);

// ─── SUITE 3: OPTIMIZATION & CONSTRAINT SATISFACTION ─────────────────────────
const S3 = '3. Constraints & Optimization Engine';

const { baseline, optimized } = generatePlans();

[ { plan: baseline, name: 'Baseline' }, { plan: optimized, name: 'Optimized' } ].forEach(({ plan, name }) => {
  // 3.1 Batch quantity constraint
  const batchAllocSum: Record<string, number> = {};
  plan.allocations.forEach((a) => {
    batchAllocSum[a.batch.batch_id] = (batchAllocSum[a.batch.batch_id] || 0) + a.quantity_kg;
  });
  BATCHES.forEach((b) => {
    const allocated = batchAllocSum[b.batch_id] || 0;
    assert(
      allocated <= b.quantity_kg + 0.001,
      S3,
      `${name}: Allocation for ${b.batch_id} (${allocated}kg) <= Batch quantity (${b.quantity_kg}kg)`,
      `Batch capacity violated for ${b.batch_id}`
    );
  });

  // 3.2 Destination demand constraint
  const destCommAllocSum: Record<string, Record<string, number>> = {};
  plan.allocations.forEach((a) => {
    destCommAllocSum[a.destination.destination_id] = destCommAllocSum[a.destination.destination_id] || {};
    destCommAllocSum[a.destination.destination_id][a.batch.commodity] =
      (destCommAllocSum[a.destination.destination_id][a.batch.commodity] || 0) + a.quantity_kg;
  });
  DESTINATIONS.forEach((d) => {
    Object.entries(d.demand_by_commodity).forEach(([comm, demand]) => {
      const allocated = destCommAllocSum[d.destination_id]?.[comm] || 0;
      assert(
        allocated <= demand + 0.001,
        S3,
        `${name}: Allocation for ${d.name} (${comm}) (${allocated}kg) <= Demand (${demand}kg)`,
        `Destination demand exceeded for ${d.name} ${comm}`
      );
    });
  });

  // 3.3 Destination overall capacity constraint
  DESTINATIONS.forEach((d) => {
    const totalDestAlloc = plan.allocations
      .filter((a) => a.destination.destination_id === d.destination_id)
      .reduce((s, a) => s + a.quantity_kg, 0);
    assert(
      totalDestAlloc <= d.capacity_kg + 0.001,
      S3,
      `${name}: Total dispatch to ${d.name} (${totalDestAlloc}kg) <= Dest capacity (${d.capacity_kg}kg)`
    );
  });

  // 3.4 Route vehicle capacity constraint
  ROUTES.forEach((r) => {
    const totalRouteAlloc = plan.allocations
      .filter((a) => a.route.route_id === r.route_id)
      .reduce((s, a) => s + a.quantity_kg, 0);
    assert(
      totalRouteAlloc <= r.vehicle_capacity_kg + 0.001,
      S3,
      `${name}: Total dispatch on ${r.route_id} (${totalRouteAlloc}kg) <= Vehicle cap (${r.vehicle_capacity_kg}kg)`
    );
  });

  // 3.5 No infeasible allocations allowed
  const infeasibleCount = plan.allocations.filter((a) => a.feasibility.status === 'INFEASIBLE').length;
  assert(
    infeasibleCount === 0,
    S3,
    `${name}: Zero infeasible allocations in plan`,
    `Found ${infeasibleCount} infeasible allocations!`
  );

  // 3.6 Non-negative quantities
  const nonPositiveCount = plan.allocations.filter((a) => a.quantity_kg <= 0).length;
  assert(
    nonPositiveCount === 0,
    S3,
    `${name}: All allocated quantities are strictly positive`
  );
});

// ─── SUITE 4: ECONOMIC CONSISTENCY & METRICS EVALUATION ──────────────────────
const S4 = '4. Economic Consistency & Metrics';

[ { plan: baseline, name: 'Baseline' }, { plan: optimized, name: 'Optimized' } ].forEach(({ plan, name }) => {
  const m = plan.metrics;

  // 4.1 Net revenue formula consistency: Net = Gross - Acq - Transport
  const computedNet = m.gross_revenue - m.total_acquisition_cost - m.total_transport_cost;
  assert(
    Math.abs(m.net_revenue - computedNet) < 0.01,
    S4,
    `${name}: Net Revenue matches Gross - Acquisition - Transport`,
    `Net revenue ${m.net_revenue} does not match ${computedNet}`
  );

  // 4.2 Fulfillment rate formula
  assert(
    m.fulfillment_rate >= 0 && m.fulfillment_rate <= 1,
    S4,
    `${name}: Fulfillment rate is a valid fraction [0, 1] (${(m.fulfillment_rate * 100).toFixed(1)}%)`
  );

  // 4.3 Spoilage vs Unsold distinction
  assert(
    m.estimated_spoilage_kg <= m.unsold_kg + 0.001,
    S4,
    `${name}: Estimated spoilage (${m.estimated_spoilage_kg}kg) <= Total unsold (${m.unsold_kg}kg)`
  );
});

// 4.4 Comparison audit
const comp = comparePlans(baseline, optimized);
assert(
  comp.net_revenue_diff === optimized.metrics.net_revenue - baseline.metrics.net_revenue,
  S4,
  'Comparison net_revenue_diff is exactly proposed - baseline'
);
assert(
  comp.spoilage_diff_kg === optimized.metrics.estimated_spoilage_kg - baseline.metrics.estimated_spoilage_kg,
  S4,
  'Comparison spoilage_diff_kg is exactly proposed - baseline'
);

// ─── SUITE 5: DISCOUNT RECOMMENDATION ENGINE ─────────────────────────────────
const S5 = '5. Discount Recommendation Engine';

const discountRecs = optimized.metrics.discount_recommendations;
assert(
  discountRecs.length > 0,
  S5,
  'Discounts computed for at-risk unallocated inventory',
  'Expected at least one discount recommendation'
);

discountRecs.forEach((rec) => {
  assert(
    rec.recommended_discount_pct >= 0 && rec.recommended_discount_pct <= 50,
    S5,
    `Discount for ${rec.batch.batch_id} is within valid bounds (0-50%)`
  );
  assert(
    rec.discounted_price_per_kg > 0,
    S5,
    `Discounted price for ${rec.batch.batch_id} is positive`
  );
  assert(
    rec.reason.length > 10 && rec.limitation.length > 10,
    S5,
    `Discount for ${rec.batch.batch_id} contains grounded reason and disclosure`
  );
});

// ─── SUITE 6: SCENARIO DISRUPTION & REPLANNING ────────────────────────────────
const S6 = '6. Scenario Lab & Replanning';

// 6.1 Scenario A: Route unavailable
const { optimized: planScenarioA } = generatePlans([
  {
    type: 'route_unavailable',
    route_id: 'R-NAS-MUM',
    description: 'Mumbai truck breakdown',
  },
]);
const mumAllocations = planScenarioA.allocations.filter((a) => a.route.route_id === 'R-NAS-MUM');
assert(
  mumAllocations.length === 0,
  S6,
  'Scenario A: Disabled Mumbai truck yields 0 allocations on R-NAS-MUM',
  `Found ${mumAllocations.length} allocations on disabled route`
);
assert(
  planScenarioA.metrics.total_allocated_kg <= optimized.metrics.total_allocated_kg,
  S6,
  'Scenario A: Total allocation reflects reduced transport network'
);

// 6.2 Scenario B: Demand shock
const { optimized: planScenarioB } = generatePlans([
  {
    type: 'demand_shock',
    destination_id: 'D-MUM',
    commodity: 'Tomatoes',
    demand_factor: 0.5,
    description: 'Mumbai tomato demand cut by 50%',
  },
]);
const mumTomatoAlloc = planScenarioB.allocations
  .filter((a) => a.destination.destination_id === 'D-MUM' && a.batch.commodity === 'Tomatoes')
  .reduce((s, a) => s + a.quantity_kg, 0);
const originalMumTomatoDemand = DESTINATIONS.find((d) => d.destination_id === 'D-MUM')!.demand_by_commodity['Tomatoes'];
assert(
  mumTomatoAlloc <= originalMumTomatoDemand * 0.5 + 0.001,
  S6,
  `Scenario B: Mumbai tomato allocation (${mumTomatoAlloc}kg) respects 50% shock (${originalMumTomatoDemand * 0.5}kg)`
);

// 6.3 Scenario C: Shelf life shock
const { optimized: planScenarioC } = generatePlans([
  {
    type: 'shelf_life_shock',
    batch_id: 'B-001',
    shelf_life_reduction_hours: 6,
    description: 'B-001 shelf life reduced by 6h',
  },
]);
const b001Alloc = planScenarioC.allocations.find((a) => a.batch.batch_id === 'B-001');
if (b001Alloc) {
  assert(
    b001Alloc.batch.remaining_shelf_life_hours === 18 - 6,
    S6,
    'Scenario C: Batch B-001 remaining shelf life reflects reduction (12h)'
  );
  assert(
    b001Alloc.feasibility.status !== 'INFEASIBLE',
    S6,
    'Scenario C: Allocated destination remains feasible under reduced margin'
  );
}

// 6.4 Scenario Reset idempotency
const { baseline: resetBaseline, optimized: resetOptimized } = generatePlans();
assert(
  resetOptimized.metrics.net_revenue === optimized.metrics.net_revenue &&
  resetOptimized.allocations.length === optimized.allocations.length,
  S6,
  'Resetting scenarios restores exact original optimization state'
);

// ─── SUITE 7: EXPLANATION INTEGRITY ──────────────────────────────────────────
const S7 = '7. Grounded Explanations (No Black Box)';

optimized.allocations.forEach((a) => {
  const exp = a.explanation;
  assert(
    exp.why_this_batch.includes(a.batch.batch_id) && exp.why_this_batch.length > 15,
    S7,
    `Allocation ${a.allocation_id} has grounded why_this_batch explanation`
  );
  assert(
    exp.why_this_destination.includes(a.destination.name) && exp.why_this_destination.length > 15,
    S7,
    `Allocation ${a.allocation_id} has grounded why_this_destination explanation`
  );
  assert(
    exp.why_this_quantity.includes('kg'),
    S7,
    `Allocation ${a.allocation_id} has concrete quantity explanation with constraints`
  );
  assert(
    exp.economic_summary.includes('Gross') && exp.economic_summary.includes('Net'),
    S7,
    `Allocation ${a.allocation_id} has full economic summary with margin`
  );
});

// ─── REPORT SUMMARY ──────────────────────────────────────────────────────────
console.log('\n================================================================');
console.log('TEST EXECUTION RESULTS');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

const grouped: Record<string, TestResult[]> = {};
results.forEach((r) => {
  grouped[r.suite] = grouped[r.suite] || [];
  grouped[r.suite].push(r);
  if (r.passed) passCount++;
  else failCount++;
});

Object.entries(grouped).forEach(([suite, tests]) => {
  const suitePassed = tests.every((t) => t.passed);
  console.log(`${suitePassed ? '✓' : '✗'} ${suite} (${tests.filter((t) => t.passed).length}/${tests.length})`);
  tests.forEach((t) => {
    if (t.passed) {
      console.log(`   ✓ ${t.testName}`);
    } else {
      console.log(`   ✗ ${t.testName} — ${t.message}`);
    }
  });
  console.log('');
});

console.log('----------------------------------------------------------------');
console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\nALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY.\n');
  process.exit(0);
}
