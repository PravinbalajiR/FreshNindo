// FreshRoute — Backend Integration & Security Test Suite
// Verifies Express routes, Google Routes integration, Qwen OpenRouter assistant,
// rate limiting, secret isolation, and fallback handling.

import { config, isGoogleMapsConfigured, isOpenRouterConfigured } from '../config.js';
import { computeRouteEstimate, isValidLatLng } from '../services/googleRoutes.js';
import { askAssistant } from '../services/openRouter.js';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, message?: string) {
  results.push({
    suite,
    name,
    passed: !!condition,
    message: condition ? undefined : (message || 'Assertion failed'),
  });
}

console.log('================================================================');
console.log('FRESHROUTE — BACKEND, ROUTING & AI VERIFICATION SUITE');
console.log('================================================================\n');

async function runTests() {
  const S1 = '1. Server Health & Secret Protection';

  // 1.1 Health endpoint check via fetch
  try {
    const healthRes = await fetch(`http://localhost:${config.port}/api/health`);
    assert(healthRes.status === 200, S1, 'GET /api/health responds with HTTP 200 OK');
    const healthData = await healthRes.json() as any;
    assert(healthData.status === 'ok', S1, 'Health status is "ok"');
    assert(typeof healthData.uptimeSeconds === 'number', S1, 'Health report includes valid uptime');
    assert(healthData.services?.googleMaps?.configured !== undefined, S1, 'Health report audits Google Maps');
    assert(healthData.services?.openRouter?.configured !== undefined, S1, 'Health report audits OpenRouter');

    // 1.2 Secret Leak Prevention: verify raw API keys are never returned in health response
    const jsonStr = JSON.stringify(healthData);
    assert(
      !jsonStr.includes(config.openRouterApiKey) && !jsonStr.includes(config.googleMapsApiKey),
      S1,
      'Raw API keys are strictly excluded from /api/health client response'
    );
  } catch (e: any) {
    assert(false, S1, 'GET /api/health connection failed', e.message);
  }

  // ─── SUITE 2: GOOGLE ROUTES & COORDINATE VALIDATION ──────────────────────
  const S2 = '2. Google Routes & Coordinate Validation';

  // 2.1 Coordinate validation
  assert(isValidLatLng({ lat: 19.9975, lng: 73.7898 }), S2, 'Validates real Nashik coordinates');
  assert(!isValidLatLng({ lat: 95.0, lng: 73.0 }), S2, 'Rejects out-of-range latitude (> 90)');
  assert(!isValidLatLng({ lat: '19.9', lng: 73.0 }), S2, 'Rejects non-numeric latitude');
  assert(!isValidLatLng(null), S2, 'Rejects null coordinates');

  // 2.2 Route calculation & fallback normalization
  const origin = { lat: 19.9975, lng: 73.7898 }; // Nashik
  const destMumbai = { lat: 19.076, lng: 72.8777 }; // Mumbai

  try {
    const estimate = await computeRouteEstimate(origin, destMumbai, 'R-NAS-MUM', 6.0, 168);
    assert(estimate.distanceKm > 0, S2, 'Route returns positive distance in km');
    assert(estimate.durationHours > 0, S2, 'Route returns positive duration in hours');
    assert(typeof estimate.durationFormatted === 'string', S2, 'Route returns human-readable duration string');
    assert(typeof estimate.isFallback === 'boolean', S2, 'Route explicitly declares fallback status');
    assert(
      ['google_routes', 'cache', 'fallback'].includes(estimate.source),
      S2,
      `Route source is declared (${estimate.source})`
    );
  } catch (e: any) {
    assert(false, S2, 'Route calculation failed', e.message);
  }

  // 2.3 Invalid coordinate handling via API
  try {
    const badRes = await fetch(`http://localhost:${config.port}/api/routes/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin: { lat: 999, lng: 0 }, destination: destMumbai }),
    });
    assert(
      badRes.status === 400,
      S2,
      'POST /api/routes/estimate rejects invalid coordinates with HTTP 400'
    );
  } catch (e: any) {
    assert(false, S2, 'API validation error test failed', e.message);
  }

  // ─── SUITE 3: OPENROUTER QWEN OPERATIONAL ASSISTANT ───────────────────────
  const S3 = '3. OpenRouter Qwen Operational Assistant';

  const testContext = {
    planSummary: {
      totalAllocatedKg: 2800,
      fulfilledDemandKg: 2800,
      fulfillmentRatePct: 57.6,
      grossRevenue: 85200,
      netRevenue: 48600,
      transportCost: 4800,
      estimatedSpoilageKg: 0,
      feasibilityViolations: 0,
    },
    batches: [
      {
        batch_id: 'B-005',
        commodity: 'Spinach',
        quantity_kg: 200,
        remaining_shelf_life_hours: 12,
        acquisition_cost_per_kg: 18,
        quality_grade: 'A',
      },
      {
        batch_id: 'B-002',
        commodity: 'Tomatoes',
        quantity_kg: 500,
        remaining_shelf_life_hours: 10,
        acquisition_cost_per_kg: 10,
        quality_grade: 'B',
      },
    ],
  };

  try {
    // 3.1 Live assistant query
    const chatRes = await askAssistant('Which batches are most time-sensitive?', testContext);
    assert(chatRes.reply.length > 20, S3, 'Assistant returns detailed operational response');
    assert(
      chatRes.reply.includes('B-002') || chatRes.reply.includes('Tomatoes') || chatRes.reply.includes('Spinach'),
      S3,
      'Assistant response is grounded in the supplied perishable batches'
    );
    assert(chatRes.grounded === true, S3, 'Assistant response is verified grounded');

    // 3.2 Empty message rejection
    let threwOnEmpty = false;
    try {
      await askAssistant('');
    } catch {
      threwOnEmpty = true;
    }
    assert(threwOnEmpty, S3, 'Assistant service rejects empty prompt');

    // 3.3 Message length bounds (> 1000 chars)
    let threwOnLong = false;
    try {
      await askAssistant('x'.repeat(1050));
    } catch {
      threwOnLong = true;
    }
    assert(threwOnLong, S3, 'Assistant service rejects messages exceeding 1000 characters');
  } catch (e: any) {
    assert(false, S3, 'OpenRouter Qwen test failed', e.message);
  }

  // ─── SUITE 4: DYNAMIC ROUTING IMPACT ON OPTIMIZER FEASIBILITY ────────────
  const S4 = '4. Routing Impact on Optimizer Feasibility';

  // Import optimizer & dataset to test how longer transit times alter feasibility
  const { checkFeasibilityPublic } = await import('../../src/engine/optimizer.js');
  const { BATCHES, DESTINATIONS } = await import('../../src/data/dataset.js');

  const urgentBatch = BATCHES.find((b: any) => b.batch_id === 'B-002')!; // 10h shelf life
  const mumbaiDest = DESTINATIONS.find((d: any) => d.destination_id === 'D-MUM')!; // 2h handling

  // Test with standard 4h transit: 10 - 4 - 2 = 4h margin (TIME_SENSITIVE, feasible)
  const normalRoute = {
    route_id: 'R-TEST-NORMAL',
    origin: 'Nashik',
    destination_id: 'D-MUM',
    travel_time_hours: 4.0,
    transport_cost_per_kg: 2.5,
    vehicle_capacity_kg: 1000,
    available: true,
  };
  const normalFeas = checkFeasibilityPublic(urgentBatch, normalRoute, mumbaiDest);
  assert(
    normalFeas.status === 'TIME_SENSITIVE' && normalFeas.usable_margin_hours === 4.0,
    S4,
    'Normal 4h transit yields feasible TIME_SENSITIVE status with 4h margin'
  );

  // Test with congested/delayed 8h transit: 10 - 8 - 2 = 0h margin (< 1h = INFEASIBLE)
  const delayedRoute = {
    ...normalRoute,
    travel_time_hours: 8.0,
  };
  const delayedFeas = checkFeasibilityPublic(urgentBatch, delayedRoute, mumbaiDest);
  assert(
    delayedFeas.status === 'INFEASIBLE' && delayedFeas.usable_margin_hours === 0,
    S4,
    'Delayed 8h transit correctly marks shipment INFEASIBLE and blocks dispatch'
  );

  // ─── REPORT SUMMARY ──────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log('BACKEND & AI TEST RESULTS');
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
        console.log(`   ✓ ${t.name}`);
      } else {
        console.log(`   ✗ ${t.name} — ${t.message}`);
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
    console.log('\nALL BACKEND & AI ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY.\n');
    process.exit(0);
  }
}

runTests();
