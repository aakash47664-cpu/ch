/**
 * Test Suite: ChemDiag Intelligent Alert System & Process Simulator
 */

import { ProcessSimulator } from './simulator/processSimulator.js';
import { initDb, recordIntelligentAlert, acknowledgeIntelligentAlert, clearIntelligentAlert, getActiveIntelligentAlerts, getIntelligentAlertHistory } from './database/db.js';

async function runTests() {
  console.log('🧪 Starting ChemDiag Intelligent Alerts & Simulation Test Suite...');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Test Simulator Initial State
  const sim = new ProcessSimulator();
  const state0 = sim.getState();
  assert(state0.pump.status === 'RUNNING', 'P-101 is initially RUNNING');
  assert(state0.active_alerts.length === 0, 'No active alerts initially');
  assert(state0.alert_summary.activeCount === 0, 'Alert summary shows 0 active alerts initially');
  assert(state0.streams.stream_1.flow > 9.0 && state0.streams.stream_1.flow < 11.0, 'Stream 1 nominal flow is ~10 L/min');

  // 2. Test Fault Trigger & Alert Debouncing (Reactor cooling failure)
  sim.setFault('reactor_cooling_failure');
  sim.tick();
  assert(sim.getActiveAlerts().length === 0, 'Alert is debounced on tick 1 (requires confirmation)');

  sim.tick();
  sim.tick();
  const activeAlerts = sim.getActiveAlerts();
  assert(activeAlerts.length >= 1, `Active alerts generated after confirmation ticks (count: ${activeAlerts.length})`);
  
  const rxAlert = activeAlerts.find(a => a.equipment === 'R-101');
  assert(!!rxAlert, 'Found R-101 alert');
  if (rxAlert) {
    assert(rxAlert.severity === 'CRITICAL', `R-101 severity is CRITICAL (got: ${rxAlert.severity})`);
    assert(rxAlert.likely_cause.length > 0, `Alert includes likely cause: "${rxAlert.likely_cause}"`);
    assert(rxAlert.process_impact.length > 0, `Alert includes process impact: "${rxAlert.process_impact}"`);
    assert(Array.isArray(rxAlert.related_effects) && rxAlert.related_effects.length > 0, `Alert includes correlated related effects (${rxAlert.related_effects.join(', ')})`);
  }

  // 3. Test Alert Acknowledgment
  if (rxAlert) {
    const ackResult = sim.acknowledgeAlert(rxAlert.id);
    assert(ackResult.status === 'ACKNOWLEDGED', 'Alert status updated to ACKNOWLEDGED');
    const summaryAfterAck = sim.getAlertSummary();
    assert(summaryAfterAck.acknowledgedCount >= 1, `Alert summary shows acknowledged count >= 1 (${summaryAfterAck.acknowledgedCount})`);
  }

  // 4. Test Fault Clearance & Hysteresis
  sim.setFault('normal');
  sim.tick();
  sim.tick();
  sim.tick();
  const clearedAlerts = sim.getActiveAlerts();
  assert(clearedAlerts.length === 0, `Active alerts cleared after process returned to normal (remaining: ${clearedAlerts.length})`);

  // 5. Test SQLite Persistence
  await initDb();
  const testAlert = {
    id: 'TEST_P101_VIB',
    equipment: 'P-101',
    title: 'Pump Vibration Exceeded',
    parameter: 'vibration',
    current_value: 2.85,
    expected_range: '0.04 - 0.25 mm/s',
    unit: 'mm/s',
    severity: 'HIGH',
    explanation: 'Mechanical vibration exceeds normal operating envelope',
    likely_cause: 'Bearing wear or cavitation',
    process_impact: 'Impeller damage and seal failure risk',
    related_effects: ['Discharge pressure fluctuation', 'Downstream flow ripple'],
    status: 'ACTIVE'
  };

  await recordIntelligentAlert(testAlert);
  const activeInDb = await getActiveIntelligentAlerts();
  assert(activeInDb.some(a => a.alert_key === 'TEST_P101_VIB' || a.id === 'TEST_P101_VIB'), 'Test alert persisted in DB as ACTIVE');

  await acknowledgeIntelligentAlert('TEST_P101_VIB');
  const ackInDb = await getActiveIntelligentAlerts();
  const foundAck = ackInDb.find(a => a.alert_key === 'TEST_P101_VIB' || a.id === 'TEST_P101_VIB');
  assert(foundAck?.status === 'ACKNOWLEDGED', 'Test alert updated to ACKNOWLEDGED in DB');

  await clearIntelligentAlert('TEST_P101_VIB');
  const activeAfterClear = await getActiveIntelligentAlerts();
  assert(!activeAfterClear.some(a => a.alert_key === 'TEST_P101_VIB' || a.id === 'TEST_P101_VIB'), 'Cleared alert removed from active DB query');

  const historyInDb = await getIntelligentAlertHistory(10);
  assert(historyInDb.some(a => a.alert_key === 'TEST_P101_VIB' || a.id === 'TEST_P101_VIB'), 'Cleared alert preserved in history DB query');

  console.log(`\n🏁 Test Results: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
