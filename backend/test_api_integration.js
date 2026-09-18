/**
 * Integration Test for ChemDiag AI Live REST APIs
 */

const BASE_URL = 'http://localhost:8000';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runIntegrationTests() {
  console.log('🌐 Starting ChemDiag AI API Integration Tests against', BASE_URL);

  // 1. Check Root & Status
  const statusRes = await fetch(`${BASE_URL}/api/status`);
  const statusData = await statusRes.json();
  console.log('1. /api/status ->', statusData.status, '| Active fault:', statusData.active_fault_mode);
  if (statusData.status !== 'ONLINE') throw new Error('System not online');

  // 2. Check Equipment Overview
  const equipRes = await fetch(`${BASE_URL}/api/equipment`);
  const equipData = await equipRes.json();
  console.log('2. /api/equipment -> Total units:', equipData.length);
  const reactor = equipData.find(e => e.id === 'reactor');
  const pump = equipData.find(e => e.id === 'pump');
  console.log('   Reactor source:', reactor.source, '| Pump source:', pump.source);
  if (reactor.source !== 'simulated') throw new Error('Reactor must be simulated');

  // 3. Test Fault Mode Injection: reactor_cooling_failure
  console.log('\n3. Testing POST /api/demo/fault -> reactor_cooling_failure');
  const faultRes = await fetch(`${BASE_URL}/api/demo/fault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fault: 'reactor_cooling_failure' })
  });
  const faultJson = await faultRes.json();
  console.log('   Fault response:', faultJson);

  // Wait 2 ticks for simulator and AI to update
  console.log('   Waiting 2 seconds for simulator to evolve...');
  await sleep(2200);

  // 4. Check AI Diagnosis
  const diagRes = await fetch(`${BASE_URL}/api/diagnosis`);
  const diag = await diagRes.json();
  console.log('4. /api/diagnosis ->');
  console.log('   Equipment:', diag.equipment);
  console.log('   Fault:', diag.probable_fault || diag.fault);
  console.log('   Root Cause:', diag.root_cause);
  console.log('   Severity:', diag.severity);
  console.log('   Confidence:', diag.confidence);
  console.log('   Variables:', diag.important_variables);
  console.log('   Action:', diag.recommended_action);

  if ((diag.equipment !== 'Reactor' && diag.equipment !== 'R-101') || !diag.anomaly) {
    throw new Error('AI Diagnosis did not detect reactor fault');
  }

  // 5. Test Real ESP32 Sensor Packet Ingestion
  console.log('\n5. Testing POST /api/sensors (Simulating physical ESP32 packet)');
  const sensorRes = await fetch(`${BASE_URL}/api/sensors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'real',
      unit: 'pump',
      timestamp: String(Date.now()),
      inlet_temperature: 27.8,
      outlet_temperature: 35.4,
      vibration: 0.11,
      rpm: 2480
    })
  });
  console.log('   /api/sensors status:', sensorRes.status);
  if (sensorRes.status !== 200) throw new Error('Sensor ingestion failed');

  // Verify equipment switched to REAL DATA
  const equipRes2 = await fetch(`${BASE_URL}/api/equipment`);
  const equipData2 = await equipRes2.json();
  const pump2 = equipData2.find(e => e.id === 'pump');
  console.log('   Pump source after ESP32 packet:', pump2.source);
  if (pump2.source !== 'real') throw new Error('Pump source did not switch to real');

  // 6. Test Alerts endpoint
  const alertsRes = await fetch(`${BASE_URL}/api/alerts`);
  const alerts = await alertsRes.json();
  console.log('\n6. /api/alerts -> Total logged alerts:', alerts.length);
  if (alerts.length > 0) {
    console.log('   Latest alert:', alerts[0].equipment, '|', alerts[0].fault, '|', alerts[0].severity);
  }

  // Reset back to normal
  await fetch(`${BASE_URL}/api/demo/fault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fault: 'normal' })
  });
  console.log('\n✅ Reset fault mode back to normal.');
  console.log('🎉 ALL INTEGRATION TESTS PASSED!');
}

runIntegrationTests().catch(err => {
  console.error('❌ Integration test failed:', err);
  process.exit(1);
});
