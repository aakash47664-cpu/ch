/**
 * Verification Test Suite for Intermittent & Transient Fault Engine
 */

import { IntermittentFaultDetector, INTERMITTENT_BASELINES } from './engineering/intermittentFaultDetector.js';
import { initDb, getIntermittentFaultEvents, getIntermittentFaultStats, clearIntermittentFaultEvents } from './database/db.js';

async function runTests() {
  console.log('🧪 Starting Intermittent Fault Engine Test Suite...');
  
  // 1. Initialize DB
  await initDb();
  await clearIntermittentFaultEvents();
  console.log('✅ 1. Database initialized and intermittent events table cleared.');

  const detector = new IntermittentFaultDetector();

  const nominalTelemetry = {
    pump_rpm: 2450,
    pump_vibration: 0.08,
    pump_flow: 10.0,
    pump_discharge_pressure: 2.80,
    pump_suction_pressure: 1.01,
    pump_inlet_temperature: 25.2,
    pump_outlet_temperature: 38.1,
    hx_delta_t: 12.9,
    hx_outlet_temp: 25.2,
    hx_inlet_temp: 38.1,
    hx_flow: 9.9,
    hx_efficiency: 95.0,
    reactor_temp: 65.0,
    reactor_pressure: 2.05,
    reactor_level: 50.0,
    reactor_feed_flow: 9.8,
    reactor_cooling_status: 1,
    reactor_agitator_speed: 350,
    dist_reflux_ratio: 1.85,
    dist_top_temp: 76.5,
    dist_bottom_temp: 98.4,
    dist_pressure: 2.10,
    dist_feed_flow: 9.7
  };

  // 2. Process nominal ticks
  for (let i = 0; i < 5; i++) {
    detector.processTick(nominalTelemetry, null, 'normal');
  }

  let state = detector.getState();
  if (state.active_events_count === 0 && state.recent_events.length === 0) {
    console.log('✅ 2. Nominal operation: 0 events detected (No false positives).');
  } else {
    throw new Error(`Expected 0 events in nominal state, got active=${state.active_events_count}, recent=${state.recent_events.length}`);
  }

  // 3. Test 1-Tick Noise Spike (Debounce Check)
  console.log('Testing 1-tick spike (should be filtered by debounce)...');
  const noiseSpike = { ...nominalTelemetry, pump_vibration: 0.35 };
  detector.processTick(noiseSpike, null, 'normal');
  // Immediately return to nominal on next tick
  detector.processTick(nominalTelemetry, null, 'normal');

  state = detector.getState();
  if (state.active_events_count === 0 && state.recent_events.length === 0) {
    console.log('✅ 3. Debounce verified: 1-tick noise spike did NOT generate a false event.');
  } else {
    throw new Error(`Debounce failed: 1-tick spike created an event!`);
  }

  // 4. Test Multi-Variable Correlated Transient Event (P-101: Vibration ↑, RPM ↓, Flow ↓)
  console.log('Testing 3-tick correlated multi-variable abnormal event on P-101...');
  const correlatedAbnormal = {
    ...nominalTelemetry,
    pump_vibration: 0.32, // High vibration (> 0.16 g)
    pump_rpm: 2190,       // Low RPM (< 2320 RPM)
    pump_flow: 8.3        // Low Flow (< 8.8 L/min)
  };

  // Tick 1 (debounce count = 1)
  detector.processTick(correlatedAbnormal, null, 'normal');
  // Tick 2 (debounce count = 2 -> EVENT START confirmed)
  detector.processTick(correlatedAbnormal, null, 'normal');
  // Tick 3 (EVENT ACTIVE)
  detector.processTick(correlatedAbnormal, null, 'normal');

  state = detector.getState();
  if (state.active_events_count === 1) {
    const activeEvt = state.active_events[0];
    console.log(`✅ 4. Correlated Event started successfully! ID: ${activeEvt.event_id}, Equipment: ${activeEvt.equipment_id}`);
    console.log(`   Variables involved: ${activeEvt.variables.join(', ')}`);
    console.log(`   Primary variables: ${activeEvt.primary_variables.join(', ')}`);
    console.log(`   Observation: ${activeEvt.observation}`);
    console.log(`   Interpretation: ${activeEvt.interpretation}`);
    
    if (!activeEvt.variables.includes('Casing Vibration') || !activeEvt.variables.includes('Pump Speed')) {
      throw new Error('Expected both Vibration and Speed in correlated variables list');
    }
  } else {
    throw new Error(`Expected 1 active event, got ${state.active_events_count}`);
  }

  // 5. Test Recovery and Duration Calculation
  console.log('Simulating recovery back to nominal...');
  // Recovery tick 1 (debounceRecovery = 1)
  detector.processTick(nominalTelemetry, null, 'normal');
  // Recovery tick 2 (debounceRecovery = 2 -> Close event)
  detector.processTick(nominalTelemetry, null, 'normal');

  state = detector.getState();
  if (state.active_events_count === 0 && state.recent_events.length === 1) {
    const closedEvt = state.recent_events[0];
    console.log(`✅ 5. Event recovery detected! Status: ${closedEvt.status}, Duration: ${closedEvt.duration}s, Pattern: ${closedEvt.pattern}`);
    if (closedEvt.status !== 'RECOVERED') {
      throw new Error(`Expected status RECOVERED, got ${closedEvt.status}`);
    }
  } else {
    throw new Error(`Expected 0 active and 1 recent event, got active=${state.active_events_count}, recent=${state.recent_events.length}`);
  }

  // 6. Test Multiple Recurrent Events on same equipment
  console.log('Simulating 2 more pulses to verify Recurrence Pattern classification...');
  // Pulse 2
  detector.processTick(correlatedAbnormal, null, 'normal');
  detector.processTick(correlatedAbnormal, null, 'normal');
  detector.processTick(nominalTelemetry, null, 'normal');
  detector.processTick(nominalTelemetry, null, 'normal');

  // Pulse 3
  detector.processTick(correlatedAbnormal, null, 'normal');
  detector.processTick(correlatedAbnormal, null, 'normal');
  detector.processTick(nominalTelemetry, null, 'normal');
  detector.processTick(nominalTelemetry, null, 'normal');

  state = detector.getState();
  console.log(`Total completed events in memory: ${state.recent_events.length}`);
  console.log(`Overall Recurrence Pattern: ${state.recurrence_stats.overall_pattern}`);
  console.log(`P-101 Recurrence Pattern: ${state.recurrence_stats.by_equipment['P-101']?.pattern}`);

  if (state.recent_events.length === 3 && state.recurrence_stats.overall_pattern === 'RECURRENT') {
    console.log('✅ 6. Recurrence pattern correctly classified as RECURRENT after 3 occurrences!');
  } else {
    throw new Error(`Expected RECURRENT pattern, got ${state.recurrence_stats.overall_pattern}`);
  }

  // 7. Verify SQLite Database Persistence
  await new Promise(r => setTimeout(r, 150));
  const dbEvents = await getIntermittentFaultEvents({ limit: 10 });
  const dbStats = await getIntermittentFaultStats();
  console.log(`DB Events Count: ${dbEvents.length}, DB Total Stats: ${dbStats.total_events}`);

  if (dbEvents.length >= 3 && dbStats.total_events >= 3) {
    console.log('✅ 7. SQLite persistence verified: Events and statistics saved and retrieved successfully.');
  } else {
    throw new Error(`Database persistence check failed. dbEvents=${dbEvents.length}`);
  }

  console.log('\n🎉 ALL INTERMITTENT FAULT ENGINE TESTS PASSED PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
