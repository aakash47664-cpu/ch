/**
 * Automated Verification Suite for ChemDiag Continuous Plant-Wide ML Monitoring
 */

import { ContinuousMlMonitor, PUMP_FEATURES, HEAT_EXCHANGER_FEATURES, REACTOR_FEATURES, DISTILLATION_FEATURES } from './ai/continuousMlMonitor.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=======================================================');
  console.log('🧪 Starting Continuous ML Monitoring Verification Tests');
  console.log('=======================================================\n');

  // Test 1: Instantiation & Model Training
  console.log('1. Model Instantiation & Training Verification');
  const monitor = new ContinuousMlMonitor();
  assert(monitor.models.pump.isolationForest.isTrained, 'P-101 Isolation Forest is trained');
  assert(monitor.models.pump.randomForest.isTrained, 'P-101 Random Forest is trained');
  assert(monitor.models.heat_exchanger.isolationForest.isTrained, 'E-101 Isolation Forest is trained');
  assert(monitor.models.heat_exchanger.randomForest.isTrained, 'E-101 Random Forest is trained');
  assert(monitor.models.reactor.isolationForest.isTrained, 'R-101 Isolation Forest is trained');
  assert(monitor.models.reactor.randomForest.isTrained, 'R-101 Random Forest is trained');
  assert(monitor.models.distillation.isolationForest.isTrained, 'D-101 Isolation Forest is trained');
  assert(monitor.models.distillation.randomForest.isTrained, 'D-101 Random Forest is trained');

  // Test 2: Nominal Process Evaluation (All 4 units simultaneously)
  console.log('\n2. Nominal Plant State Concurrent Evaluation');
  const nominalTelemetry = {
    pump_rpm: 2450,
    pump_flow: 10.0,
    pump_vibration: 0.08,
    pump_suction_pressure: 1.01,
    pump_discharge_pressure: 2.80,
    hx_inlet_temp: 25.2,
    hx_outlet_temp: 38.1,
    hx_delta_t: 12.9,
    hx_flow: 9.9,
    hx_efficiency: 95.0,
    reactor_temp: 65.0,
    reactor_pressure: 2.05,
    reactor_level: 50.0,
    reactor_feed_flow: 9.8,
    reactor_agitator_speed: 350,
    reactor_cooling_status: 1,
    dist_top_temp: 76.5,
    dist_bottom_temp: 98.4,
    dist_pressure: 2.10,
    dist_feed_flow: 9.7,
    dist_reflux_ratio: 1.85
  };

  const nominalResult = monitor.processState({}, nominalTelemetry, 'normal', { isConnected: false });
  assert(nominalResult.P101 && nominalResult.E101 && nominalResult.R101 && nominalResult.D101, 'Returns all 4 equipment diagnostics simultaneously');
  assert(nominalResult.pump === nominalResult.P101, 'Unit alias pump points to P101');
  assert(nominalResult.heat_exchanger === nominalResult.E101, 'Unit alias heat_exchanger points to E101');
  assert(nominalResult.reactor === nominalResult.R101, 'Unit alias reactor points to R101');
  assert(nominalResult.distillation === nominalResult.D101, 'Unit alias distillation points to D101');

  assert(nominalResult.P101.health >= 90, `P-101 nominal health is high (${nominalResult.P101.health}%)`);
  assert(nominalResult.E101.health >= 90, `E-101 nominal health is high (${nominalResult.E101.health}%)`);
  assert(nominalResult.R101.health >= 90, `R-101 nominal health is high (${nominalResult.R101.health}%)`);
  assert(nominalResult.D101.health >= 90, `D-101 nominal health is high (${nominalResult.D101.health}%)`);
  assert(nominalResult.plant.health >= 90, `Overall plant health is nominal (${nominalResult.plant.health}%)`);

  // Test 3: P-101 Mechanical Degradation & Causal Propagation
  console.log('\n3. P-101 Degradation & Process-Wide Causal Propagation');
  // Feed multiple samples of P-101 degradation to build persistence and rates of change
  let p101DegradationState;
  for (let t = 0; t < 5; t++) {
    p101DegradationState = monitor.processState(
      {},
      {
        ...nominalTelemetry,
        pump_rpm: 2050 - t * 20,
        pump_vibration: 0.38 + t * 0.03,
        pump_flow: 7.2 - t * 0.1,
        hx_flow: 7.2 - t * 0.1,
        reactor_feed_flow: 7.2 - t * 0.1,
        dist_feed_flow: 7.0 - t * 0.1
      },
      'pump_fault',
      { isConnected: false }
    );
  }

  const pDiag = p101DegradationState.P101;
  const hxDiag = p101DegradationState.E101;
  const rxDiag = p101DegradationState.R101;
  const distDiag = p101DegradationState.D101;

  assert(pDiag.anomalyScore > 0.50, `P-101 Anomaly score is elevated (${pDiag.anomalyScore})`);
  assert(pDiag.health < 80, `P-101 Health dropped due to degradation (${pDiag.health}%)`);
  assert(pDiag.role === 'PRIMARY_FAULT', `P-101 identified as PRIMARY_FAULT (actual role: ${pDiag.role})`);
  assert(hxDiag.role === 'DOWNSTREAM_IMPACT', `E-101 identified as DOWNSTREAM_IMPACT (actual role: ${hxDiag.role})`);
  assert(rxDiag.role === 'DOWNSTREAM_IMPACT', `R-101 identified as DOWNSTREAM_IMPACT (actual role: ${rxDiag.role})`);
  assert(distDiag.role === 'DOWNSTREAM_IMPACT', `D-101 identified as DOWNSTREAM_IMPACT (actual role: ${distDiag.role})`);
  assert(p101DegradationState.plant.primarySource.includes('P-101'), `Plant primary source correctly points to P-101`);

  // Test 4: Unknown Fault Guard Handling
  console.log('\n4. Unknown Fault Guard Handling');
  const unknownResult = monitor.processState(
    {},
    {
      ...nominalTelemetry,
      reactor_temp: 74.5,
      reactor_pressure: 2.45,
      pump_vibration: 0.22,
      pump_rpm: 2380
    },
    'unknown_fault',
    { isConnected: false }
  );

  assert(unknownResult.P101.isUnknownFault === true, 'P-101 Unknown Fault flag set');
  assert(unknownResult.P101.faultClass === 'unknown_fault', 'P-101 classified as unknown_fault (not forced to nearest class)');
  assert(unknownResult.R101.isUnknownFault === true, 'R-101 Unknown Fault flag set');
  assert(unknownResult.R101.faultClass === 'unknown_fault', 'R-101 classified as unknown_fault');

  // Test 5: E-101 Thermal Fouling Specific Pipeline
  console.log('\n5. E-101 Thermal Fouling Specific Pipeline');
  let e101FoulingState;
  for (let t = 0; t < 5; t++) {
    e101FoulingState = monitor.processState(
      {},
      {
        ...nominalTelemetry,
        hx_outlet_temp: 34.5 + t * 0.4,
        hx_delta_t: 4.0 - t * 0.2,
        hx_efficiency: 45.0 - t * 2
      },
      'heat_exchanger_fault',
      { isConnected: false }
    );
  }

  const hxFoul = e101FoulingState.E101;
  assert(hxFoul.health < 80, `E-101 Health reflects thermal degradation (${hxFoul.health}%)`);
  assert(hxFoul.role === 'PRIMARY_FAULT', `E-101 identified as PRIMARY_FAULT (actual role: ${hxFoul.role})`);
  assert(hxFoul.evidence.some(e => e.includes('Thermal Gradient')), 'E-101 evidence cites thermal gradient decay');

  // Test 6: R-101 Exothermic Cooling Failure
  console.log('\n6. R-101 Exothermic Cooling Failure Pipeline');
  let r101TripState;
  for (let t = 0; t < 5; t++) {
    r101TripState = monitor.processState(
      {},
      {
        ...nominalTelemetry,
        reactor_cooling_status: 0,
        reactor_temp: 88.0 + t * 2.0,
        reactor_pressure: 3.20 + t * 0.15
      },
      'reactor_cooling_failure',
      { isConnected: false }
    );
  }

  const rxTrip = r101TripState.R101;
  assert(rxTrip.health < 50, `R-101 Health is critical (${rxTrip.health}%)`);
  assert(rxTrip.role === 'PRIMARY_FAULT', `R-101 identified as PRIMARY_FAULT`);
  assert(rxTrip.evidence.some(e => e.includes('Cooling Jacket')), 'R-101 evidence cites cooling jacket trip');

  // Test 7: D-101 Reflux Starvation
  console.log('\n7. D-101 Distillation Reflux Starvation Pipeline');
  let d101RefluxState;
  for (let t = 0; t < 5; t++) {
    d101RefluxState = monitor.processState(
      {},
      {
        ...nominalTelemetry,
        dist_reflux_ratio: 0.65,
        dist_top_temp: 88.0 + t * 0.5
      },
      'distillation_fault',
      { isConnected: false }
    );
  }

  const distSlip = d101RefluxState.D101;
  assert(distSlip.health < 80, `D-101 Health reflects reflux starvation (${distSlip.health}%)`);
  assert(distSlip.role === 'PRIMARY_FAULT', `D-101 identified as PRIMARY_FAULT`);
  assert(distSlip.evidence.some(e => e.includes('Reflux Ratio')), 'D-101 evidence cites reflux ratio slip');

  // Test Summary
  console.log('\n=======================================================');
  console.log(`Summary: ${passed} passed, ${failed} failed.`);
  console.log('=======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
