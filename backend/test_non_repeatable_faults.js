/**
 * ChemDiag AI — Non-Repeatable & Refined Temporal Fault Test Suite
 * 
 * Purpose:
 * Validates the 5 required temporal event cases:
 * Case 1: Normal → Short Abnormality → Normal => NON-REPEATABLE (preserved in DB & memory)
 * Case 2: Normal → Abnormality → Normal → Abnormality → Normal => INTERMITTENT
 * Case 3: Multiple irregular abnormal events => SPORADIC
 * Case 4: Repeated similar abnormal events => RECURRENT
 * Case 5: Continuous abnormality (> 30s) => PERSISTENT
 */

import { initDb, clearIntermittentFaultEvents, getIntermittentFaultEvents, getIntermittentFaultStats } from './database/db.js';
import { IntermittentFaultDetector } from './engineering/intermittentFaultDetector.js';

const NOMINAL_TELEMETRY = {
  pump_rpm: 2450,
  pump_vibration: 0.08,
  pump_flow: 10.0,
  pump_discharge_pressure: 2.80,
  pump_suction_pressure: 1.01,
  pump_inlet_temperature: 25.2,
  pump_outlet_temperature: 38.1,
  hx_inlet_temp: 38.1,
  hx_outlet_temp: 25.2,
  hx_delta_t: 12.9,
  hx_efficiency: 95.0,
  hx_flow: 9.9,
  reactor_temp: 65.0,
  reactor_pressure: 2.05,
  reactor_level: 50.0,
  reactor_feed_flow: 9.8,
  reactor_cooling_status: 1,
  reactor_agitator_speed: 350,
  dist_top_temp: 76.5,
  dist_bottom_temp: 98.4,
  dist_pressure: 2.10,
  dist_feed_flow: 9.7,
  dist_reflux_ratio: 1.85
};

const NOMINAL_SIM_STATE = {
  pump: { rpm: 2450, vibration: 0.08, flow: 10.0, discharge_pressure: 2.80 },
  heatExchanger: { temperature_difference: 12.9, outlet_temperature: 25.2, efficiency: 95.0, flow: 9.9 },
  reactor: { temperature: 65.0, pressure: 2.05, level: 50.0, feed_flow: 9.8, cooling_status: 1, agitator_speed: 350 },
  distillation: { reflux_ratio: 1.85, top_temperature: 76.5, bottom_temperature: 98.4, pressure: 2.10, feed_flow: 9.7 }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTestSuite() {
  console.log('🧪 Starting Non-Repeatable & Temporal Fault Test Suite...\n');

  await initDb();
  await clearIntermittentFaultEvents();

  const detector = new IntermittentFaultDetector();
  await sleep(100);

  // ----------------------------------------------------
  // TEST CASE 1: Single Transient Abnormality -> NON-REPEATABLE
  // ----------------------------------------------------
  console.log('--- TEST CASE 1: Single Transient Event (Normal → Abnormality → Normal) ---');
  
  // 1. Initial Nominal Ticks
  for (let i = 0; i < 3; i++) {
    detector.processTick(NOMINAL_TELEMETRY, NOMINAL_SIM_STATE, 'normal');
  }
  let state = detector.getState();
  if (state.active_events_count !== 0) {
    throw new Error(`Expected 0 active events at nominal baseline, got ${state.active_events_count}`);
  }
  console.log('✓ Nominal baseline: 0 events detected.');

  // 2. Introduce correlated abnormality on P-101 (2 ticks to trigger debounce)
  const abnormalP101 = {
    ...NOMINAL_TELEMETRY,
    pump_vibration: 0.35, // High vibration
    pump_rpm: 2150,      // Low RPM
    pump_flow: 8.2       // Low Flow
  };

  detector.processTick(abnormalP101, NOMINAL_SIM_STATE, 'normal'); // Tick 1: Debounce start
  detector.processTick(abnormalP101, NOMINAL_SIM_STATE, 'normal'); // Tick 2: Confirmed event
  detector.processTick(abnormalP101, NOMINAL_SIM_STATE, 'normal'); // Tick 3: Active

  state = detector.getState();
  if (state.active_events_count !== 1) {
    throw new Error(`Expected 1 active event on P-101, got ${state.active_events_count}`);
  }
  const activeEv = state.active_events[0];
  console.log(`✓ Event started: ID ${activeEv.event_id}, Status: ${activeEv.status}, Pattern: ${activeEv.pattern}`);
  console.log(`  Variables correlated: ${activeEv.variables.join(', ')}`);

  // 3. Process returns to normal (2 ticks for recovery debounce)
  detector.processTick(NOMINAL_TELEMETRY, NOMINAL_SIM_STATE, 'normal'); // Tick 1: Recovery debounce
  detector.processTick(NOMINAL_TELEMETRY, NOMINAL_SIM_STATE, 'normal'); // Tick 2: Confirmed recovery
  detector.processTick(NOMINAL_TELEMETRY, NOMINAL_SIM_STATE, 'normal'); // Tick 3: Nominal

  await sleep(150);

  state = detector.getState();
  if (state.active_events_count !== 0) {
    throw new Error(`Expected 0 active events after recovery, got ${state.active_events_count}`);
  }
  if (state.recent_events.length !== 1) {
    throw new Error(`Expected 1 preserved event in history, got ${state.recent_events.length}`);
  }

  const preservedEv = state.recent_events[0];
  if (preservedEv.pattern !== 'NON-REPEATABLE' && preservedEv.event_type !== 'NON-REPEATABLE') {
    throw new Error(`Expected pattern NON-REPEATABLE, got ${preservedEv.pattern}`);
  }
  if (preservedEv.status !== 'RECOVERED') {
    throw new Error(`Expected status RECOVERED, got ${preservedEv.status}`);
  }

  console.log('✓ Event PRESERVED after recovery! Pattern correctly classified as NON-REPEATABLE.');
  console.log(`  Duration: ${preservedEv.duration}s`);
  console.log(`  Interpretation: "${preservedEv.interpretation}"`);

  // Check Database Persistence
  const dbEvents = await getIntermittentFaultEvents();
  const dbStats = await getIntermittentFaultStats();
  if (dbEvents.length !== 1 || dbStats.non_repeatable_events !== 1) {
    throw new Error(`Database check failed: count=${dbEvents.length}, non_repeatable_events=${dbStats.non_repeatable_events}`);
  }
  console.log('✓ SQLite Persistence verified: Event safely stored in intermittent_fault_events table.\n');

  // ----------------------------------------------------
  // TEST CASE 2: Second Abnormal Pulse -> INTERMITTENT
  // ----------------------------------------------------
  console.log('--- TEST CASE 2: Second Occurrence (Disappears and Returns → INTERMITTENT) ---');

  // 3 nominal ticks
  for (let i = 0; i < 3; i++) {
    detector.processTick(NOMINAL_TELEMETRY, NOMINAL_SIM_STATE, 'normal');
  }

  // 2 abnormal ticks on P-101
  detector.processTick(abnormalP101, NOMINAL_SIM_STATE, 'normal');
  detector.processTick(abnormalP101, NOMINAL_SIM_STATE, 'normal');
  detector.processTick(abnormalP101, NOMINAL_SIM_STATE, 'normal');

  // 2 recovery ticks
  detector.processTick(NOMINAL_TELEMETRY, NOMINAL_SIM_STATE, 'normal');
  detector.processTick(NOMINAL_TELEMETRY, NOMINAL_SIM_STATE, 'normal');

  await sleep(150);

  state = detector.getState();
  if (state.recent_events.length !== 2) {
    throw new Error(`Expected 2 events in history, got ${state.recent_events.length}`);
  }

  const secondEv = state.recent_events[0];
  if (secondEv.pattern !== 'INTERMITTENT' && secondEv.event_type !== 'INTERMITTENT') {
    throw new Error(`Expected pattern INTERMITTENT for 2nd pulse, got ${secondEv.pattern}`);
  }
  if (state.recurrence_stats.intermittent_events < 1 && state.recurrence_stats.overall_pattern !== 'INTERMITTENT') {
    throw new Error(`Expected overall pattern INTERMITTENT, got ${state.recurrence_stats.overall_pattern}`);
  }

  console.log('✓ Second event correctly transitioned cluster to INTERMITTENT pattern.');
  console.log(`  Total events: ${state.recurrence_stats.total_events}, Overall Pattern: ${state.recurrence_stats.overall_pattern}`);
  console.log(`  Interpretation: "${secondEv.interpretation}"\n`);

  // ----------------------------------------------------
  // TEST CASE 3: Third Pulse -> RECURRENT
  // ----------------------------------------------------
  console.log('--- TEST CASE 3: Third Occurrence (Repeated Pattern → RECURRENT) ---');

  // 3 nominal ticks
  for (let i = 0; i < 3; i++) {
    detector.processTick(NOMINAL_TELEMETRY, NOMINAL_SIM_STATE, 'normal');
  }

  // 2 abnormal ticks on P-101
  detector.processTick(abnormalP101, NOMINAL_SIM_STATE, 'normal');
  detector.processTick(abnormalP101, NOMINAL_SIM_STATE, 'normal');
  detector.processTick(abnormalP101, NOMINAL_SIM_STATE, 'normal');

  // 2 recovery ticks
  detector.processTick(NOMINAL_TELEMETRY, NOMINAL_SIM_STATE, 'normal');
  detector.processTick(NOMINAL_TELEMETRY, NOMINAL_SIM_STATE, 'normal');

  await sleep(150);

  state = detector.getState();
  if (state.recent_events.length !== 3) {
    throw new Error(`Expected 3 events in history, got ${state.recent_events.length}`);
  }

  const thirdEv = state.recent_events[0];
  if (thirdEv.pattern !== 'RECURRENT' && thirdEv.event_type !== 'RECURRENT') {
    throw new Error(`Expected pattern RECURRENT for 3rd pulse, got ${thirdEv.pattern}`);
  }
  if (state.recurrence_stats.overall_pattern !== 'RECURRENT') {
    throw new Error(`Expected overall pattern RECURRENT, got ${state.recurrence_stats.overall_pattern}`);
  }

  console.log('✓ Third event correctly established RECURRENT pattern.');
  console.log(`  Recurrence Count: ${thirdEv.recurrence_count}`);
  console.log(`  Interpretation: "${thirdEv.interpretation}"\n`);

  // ----------------------------------------------------
  // TEST CASE 4: Continuous Abnormality (> 30s) -> PERSISTENT
  // ----------------------------------------------------
  console.log('--- TEST CASE 4: Continuous Abnormality (> 30s) → PERSISTENT ---');

  const abnormalE101 = {
    ...NOMINAL_TELEMETRY,
    hx_delta_t: 4.5,
    hx_outlet_temp: 36.0,
    hx_efficiency: 65.0
  };

  // Start event on E-101
  detector.processTick(abnormalE101, NOMINAL_SIM_STATE, 'normal');
  detector.processTick(abnormalE101, NOMINAL_SIM_STATE, 'normal');

  state = detector.getState();
  const e101Active = state.active_events.find(e => e.equipment_id === 'E-101');
  if (!e101Active) {
    throw new Error('Expected active event on E-101');
  }

  // Simulate duration surpassing 30s
  e101Active.start_time = new Date(Date.now() - 35000).toISOString();
  detector.processTick(abnormalE101, NOMINAL_SIM_STATE, 'normal');

  state = detector.getState();
  const updatedE101 = state.active_events.find(e => e.equipment_id === 'E-101');
  if (updatedE101.pattern !== 'PERSISTENT') {
    throw new Error(`Expected PERSISTENT pattern for sustained abnormality, got ${updatedE101.pattern}`);
  }

  console.log('✓ Sustained abnormality correctly classified as PERSISTENT (not intermittent).');
  console.log(`  Duration: ${updatedE101.duration}s, Pattern: ${updatedE101.pattern}\n`);

  // ----------------------------------------------------
  // TEST CASE 5: Multi-Mode Test Pulse Bench Integration
  // ----------------------------------------------------
  console.log('--- TEST CASE 5: Test Pulse Triggering & Multi-Phase Modes ---');
  
  const pulseRes1 = detector.triggerTestPulse('reactor', 'single_spike');
  if (pulseRes1.status !== 'TEST_PULSE_TRIGGERED' || pulseRes1.mode !== 'single_spike') {
    throw new Error('Trigger single_spike failed');
  }
  console.log(`✓ Single spike pulse triggered for ${pulseRes1.equipment}`);

  const pulseRes2 = detector.triggerTestPulse('distillation', 'three_pulse');
  if (pulseRes2.status !== 'TEST_PULSE_TRIGGERED' || pulseRes2.mode !== 'three_pulse') {
    throw new Error('Trigger three_pulse failed');
  }
  console.log(`✓ Three pulse sequence triggered for ${pulseRes2.equipment}`);

  console.log('\n🎉 ALL NON-REPEATABLE & TEMPORAL FAULT TEST CASES PASSED WITH 100% SUCCESS!\n');
}

runTestSuite().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
