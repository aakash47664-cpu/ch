/**
 * Comprehensive Test of all 5 Demo Fault Scenarios with Realistic Time Progression
 */
const BASE_URL = 'http://localhost:8000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAllScenarios() {
  console.log('🧪 Testing all 5 Demo Fault Scenarios with Realistic Time Progression...\n');

  const scenarios = [
    { mode: 'pump_fault', expectedEquip: 'Pump', expectedSeverity: ['MEDIUM', 'HIGH'], waitMs: 10000 },
    { mode: 'heat_exchanger_fault', expectedEquip: 'Heat Exchanger', expectedSeverity: ['MEDIUM', 'HIGH'], waitMs: 10000 },
    { mode: 'distillation_fault', expectedEquip: 'Distillation Column', expectedSeverity: ['MEDIUM', 'HIGH'], waitMs: 13000 },
    { mode: 'reactor_cooling_failure', expectedEquip: 'Reactor', expectedSeverity: ['HIGH', 'CRITICAL'], waitMs: 8000 },
    { mode: 'normal', expectedEquip: 'All Units', expectedSeverity: ['NORMAL'], waitMs: 3000 }
  ];

  for (const s of scenarios) {
    console.log(`▶ Triggering fault: ${s.mode} (waiting ${s.waitMs / 1000}s for physical progression)...`);
    await fetch(`${BASE_URL}/api/demo/fault`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fault: s.mode })
    });

    await sleep(s.waitMs);

    const res = await fetch(`${BASE_URL}/api/diagnosis`);
    const diag = await res.json();

    console.log(`   Result: Equipment = ${diag.equipment} | Anomaly = ${diag.anomaly} | Fault = ${diag.probable_fault || diag.fault}`);
    console.log(`           Root Cause = "${diag.root_cause}"`);
    console.log(`           Severity = ${diag.severity} | Confidence = ${Math.round(diag.confidence * 100)}%`);
    console.log(`           Variables = [${(diag.important_variables || []).join(', ')}]`);
    console.log(`           Action = "${diag.recommended_action}"`);

    if (diag.equipment !== s.expectedEquip) {
      throw new Error(`Expected equipment ${s.expectedEquip} but got ${diag.equipment}`);
    }
    if (!s.expectedSeverity.includes(diag.severity)) {
      throw new Error(`Expected severity in [${s.expectedSeverity.join(', ')}] but got ${diag.severity}`);
    }
    console.log(`✅ Scenario "${s.mode}" verified successfully.\n`);
  }

  console.log('🎉 ALL 5 DEMO FAULT SCENARIOS VERIFIED SUCCESSFULLY WITH REAL-TIME PROGRESSION!');
}

testAllScenarios().catch(err => {
  console.error('Scenario verification failed:', err);
  process.exit(1);
});
