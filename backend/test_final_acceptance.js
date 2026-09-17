/**
 * ChemDiag AI — Final Acceptance Verification Suite
 * Verifies exact User Requirements & Test Sequence:
 *   1. Nominal steady state across all 4 units
 *   2. P-101 RPM Ramp (2450 -> 1800 -> 1200 -> 0)
 *   3. P-101 ML Anomaly rise, RF probability change, Health decrease, Risk increase, PRIMARY_FAULT
 *   4. Downstream flow & feed changes in E-101, R-101, D-101 with DOWNSTREAM_IMPACT
 *   5. Trend & persistence consistency (persistence 0 => STABLE)
 *   6. Recovery back to nominal (2450 RPM)
 */

import { ProcessSimulator } from './simulator/processSimulator.js';
import { ContinuousMlMonitor } from './ai/continuousMlMonitor.js';

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

function extractTelemetry(simState) {
  return {
    pump_rpm: simState.pump.rpm,
    pump_vibration: simState.pump.vibration,
    pump_flow: simState.pump.flow,
    pump_discharge_pressure: simState.pump.discharge_pressure,
    pump_suction_pressure: simState.pump.suction_pressure,
    pump_inlet_temperature: simState.pump.inlet_temperature,
    pump_outlet_temperature: simState.pump.outlet_temperature,
    hx_inlet_temp: simState.heatExchanger.inlet_temperature,
    hx_outlet_temp: simState.heatExchanger.outlet_temperature,
    hx_efficiency: simState.heatExchanger.efficiency,
    hx_delta_t: simState.heatExchanger.temperature_difference,
    hx_flow: simState.heatExchanger.flow,
    reactor_temp: simState.reactor.temperature,
    reactor_pressure: simState.reactor.pressure,
    reactor_level: simState.reactor.level,
    reactor_feed_flow: simState.reactor.feed_flow,
    reactor_agitator_speed: simState.reactor.agitator_speed,
    reactor_cooling_status: simState.reactor.cooling_status,
    dist_top_temp: simState.distillation.top_temperature,
    dist_bottom_temp: simState.distillation.bottom_temperature,
    dist_pressure: simState.distillation.pressure,
    dist_feed_flow: simState.distillation.feed_flow,
    dist_reflux_ratio: simState.distillation.reflux_ratio
  };
}

async function runFinalTest() {
  console.log('=======================================================');
  console.log('🧪 ChemDiag AI — Final Dynamic Acceptance Test Suite');
  console.log('=======================================================\n');

  const sim = new ProcessSimulator();
  const monitor = new ContinuousMlMonitor();

  // 1. Nominal Steady State Verification
  console.log('1. Evaluating Nominal Steady State (2450 RPM):');
  let state = sim.getState();
  let mlDiag = monitor.processState(state, extractTelemetry(state), 'normal', { isConnected: false });

  assert(mlDiag.P101.health >= 90, `P-101 nominal health is high (${mlDiag.P101.health}%)`);
  assert(mlDiag.E101.health >= 90, `E-101 nominal health is high (${mlDiag.E101.health}%)`);
  assert(mlDiag.R101.health >= 90, `R-101 nominal health is high (${mlDiag.R101.health}%)`);
  assert(mlDiag.D101.health >= 90, `D-101 nominal health is high (${mlDiag.D101.health}%)`);
  assert(mlDiag.P101.anomalyScore < 0.56, `P-101 nominal anomaly score is low (${mlDiag.P101.anomalyScore})`);
  assert(mlDiag.P101.trend === 'STABLE', `P-101 nominal trend is STABLE (${mlDiag.P101.trend})`);
  assert(mlDiag.P101.persistenceTicks === 0, `P-101 nominal persistence is 0 (${mlDiag.P101.persistenceTicks})`);
  assert(mlDiag.P101.role === 'PRIMARY_SOURCE' || mlDiag.P101.role === 'NOMINAL', 'P-101 is nominal source');

  // 2. Step 1: Ramp P-101 to 1800 RPM
  console.log('\n2. Step 1: Throttling P-101 to 1800 RPM:');
  sim.setUserControls({ pump_rpm: 1800 });
  for (let i = 0; i < 4; i++) {
    state = sim.tick();
    mlDiag = monitor.processState(state, extractTelemetry(state), 'pump_speed_drop', { isConnected: false });
  }

  console.log(`   P-101 RPM: ${state.pump.rpm}, Flow: ${state.pump.flow} L/min, Anomaly: ${mlDiag.P101.anomalyScore}, Health: ${mlDiag.P101.health}%`);
  console.log(`   E-101 Flow: ${state.heatExchanger.flow} L/min, R-101 Feed: ${state.reactor.feed_flow} L/min`);
  assert(mlDiag.P101.anomalyScore > 0.50, `P-101 Anomaly score increased at 1800 RPM (${mlDiag.P101.anomalyScore})`);
  assert(mlDiag.P101.persistenceTicks >= 1, `P-101 Persistence increments (${mlDiag.P101.persistenceTicks})`);
  assert(mlDiag.P101.role === 'PRIMARY_FAULT', 'P-101 identified as PRIMARY_FAULT');
  assert(mlDiag.E101.role === 'DOWNSTREAM_IMPACT', 'E-101 identified as DOWNSTREAM_IMPACT');

  // 3. Step 2: Ramp P-101 to 1200 RPM
  console.log('\n3. Step 2: Throttling P-101 to 1200 RPM:');
  sim.setUserControls({ pump_rpm: 1200 });
  for (let i = 0; i < 4; i++) {
    state = sim.tick();
    mlDiag = monitor.processState(state, extractTelemetry(state), 'pump_speed_drop', { isConnected: false });
  }

  console.log(`   P-101 RPM: ${state.pump.rpm}, Flow: ${state.pump.flow} L/min, Anomaly: ${mlDiag.P101.anomalyScore}, Health: ${mlDiag.P101.health}%, Risk: ${mlDiag.P101.risk}%`);
  assert(mlDiag.P101.anomalyScore > 0.56, `P-101 Anomaly crossed threshold (${mlDiag.P101.anomalyScore} > 0.56)`);
  assert(mlDiag.P101.health < 60, `P-101 Health dropped significantly (${mlDiag.P101.health}%)`);
  assert(mlDiag.P101.risk > 40, `P-101 Risk elevated (${mlDiag.P101.risk}%)`);
  assert(mlDiag.P101.trend === 'DEGRADING' || mlDiag.P101.trend === 'RAPIDLY DEGRADING', `P-101 trend is DEGRADING (${mlDiag.P101.trend})`);
  assert(mlDiag.R101.role === 'DOWNSTREAM_IMPACT', 'R-101 identified as DOWNSTREAM_IMPACT');
  assert(mlDiag.D101.role === 'DOWNSTREAM_IMPACT', 'D-101 identified as DOWNSTREAM_IMPACT');

  // 4. Step 3: Complete Pump Trip (0 RPM)
  console.log('\n4. Step 3: Complete Pump Trip (0 RPM):');
  sim.setUserControls({ pump_rpm: 0 });
  for (let i = 0; i < 5; i++) {
    state = sim.tick();
    mlDiag = monitor.processState(state, extractTelemetry(state), 'pump_speed_drop', { isConnected: false });
  }

  console.log(`   P-101 RPM: ${state.pump.rpm}, Flow: ${state.pump.flow} L/min, Health: ${mlDiag.P101.health}%, Fault: ${mlDiag.P101.faultLabel}`);
  assert(state.pump.flow < 1.0, `P-101 Flow near zero (${state.pump.flow} L/min)`);
  assert(state.heatExchanger.flow < 1.0, `E-101 Flow near zero (${state.heatExchanger.flow} L/min)`);
  assert(mlDiag.P101.health <= 15, `P-101 Health is critical (${mlDiag.P101.health}%)`);
  assert(mlDiag.P101.risk >= 85, `P-101 Risk is critical (${mlDiag.P101.risk}%)`);

  // 5. Restoration to Nominal (2450 RPM)
  console.log('\n5. Restoring P-101 to Nominal (2450 RPM):');
  sim.setUserControls({ pump_rpm: 2450 });
  for (let i = 0; i < 12; i++) {
    state = sim.tick();
    mlDiag = monitor.processState(state, extractTelemetry(state), 'normal', { isConnected: false });
  }

  console.log(`   P-101 RPM: ${state.pump.rpm}, Flow: ${state.pump.flow} L/min, Anomaly: ${mlDiag.P101.anomalyScore}, Health: ${mlDiag.P101.health}%, Persistence: ${mlDiag.P101.persistenceTicks}`);
  assert(state.pump.flow >= 9.5, `P-101 Flow recovered (${state.pump.flow} L/min)`);
  assert(mlDiag.P101.health >= 90, `P-101 Health recovered (${mlDiag.P101.health}%)`);
  assert(mlDiag.P101.persistenceTicks === 0, `P-101 Persistence decremented back to 0 (${mlDiag.P101.persistenceTicks})`);
  assert(mlDiag.P101.trend === 'STABLE', `P-101 Trend returned to STABLE (${mlDiag.P101.trend})`);

  console.log('\n=======================================================');
  console.log(`Summary: ${passed} passed, ${failed} failed.`);
  console.log('=======================================================');
}

runFinalTest();
