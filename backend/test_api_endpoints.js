/**
 * ChemDiag AI End-to-End API Integration Verification Script
 */

async function runApiVerification() {
  console.log('📡 Starting ChemDiag End-to-End API Verification...');
  const baseUrl = 'http://localhost:8000/api';
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

  // 1. Status endpoint
  const statusRes = await fetch(`${baseUrl}/status`);
  const statusData = await statusRes.json();
  assert(statusRes.ok && statusData.status === 'ONLINE', 'GET /api/status is ONLINE');

  // 2. Equipment endpoint
  const equipRes = await fetch(`${baseUrl}/equipment`);
  const equipData = await equipRes.json();
  assert(equipRes.ok && Array.isArray(equipData) && equipData.length === 4, 'GET /api/equipment returns 4 equipment units');

  // 3. Reset process to normal
  const resetRes = await fetch(`${baseUrl}/process/reset`, { method: 'POST' });
  const resetData = await resetRes.json();
  assert(resetRes.ok && resetData.success, 'POST /api/process/reset succeeds');

  // 4. Initial alerts
  const alertsRes = await fetch(`${baseUrl}/alerts`);
  const alertsData = await alertsRes.json();
  assert(alertsRes.ok && alertsData.success && typeof alertsData.activeCount === 'number', 'GET /api/alerts returns structured active alerts & summary');

  // 5. Inject Fault (Reactor Cooling Failure)
  const faultRes = await fetch(`${baseUrl}/demo/fault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fault: 'reactor_cooling_failure' })
  });
  const faultData = await faultRes.json();
  assert(faultRes.ok && faultData.active_fault === 'reactor_cooling_failure', 'POST /api/demo/fault injects reactor_cooling_failure');

  // Wait 3 seconds for simulation ticks and alert evaluation
  console.log('  ⏳ Waiting 3.5s for simulation ticks and debounced alert generation...');
  await new Promise(r => setTimeout(r, 3500));

  // 6. Check Active Alerts
  const activeRes = await fetch(`${baseUrl}/alerts/active`);
  const activeData = await activeRes.json();
  assert(activeRes.ok && activeData.active_alerts.length >= 1, `Active alerts generated (count: ${activeData.active_alerts.length})`);
  const targetAlert = activeData.active_alerts[0];
  assert(!!targetAlert && !!targetAlert.likely_cause && !!targetAlert.process_impact, 'Alert has rich context (likely_cause and process_impact)');

  // 7. Acknowledge Alert
  if (targetAlert) {
    const ackRes = await fetch(`${baseUrl}/alerts/${targetAlert.id}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operator: 'Plant Lead Operator' })
    });
    const ackData = await ackRes.json();
    assert(ackRes.ok && ackData.success && ackData.alert?.status === 'ACKNOWLEDGED', 'POST /api/alerts/:id/acknowledge successfully acknowledges alert');
  }

  // 8. Reset back to normal
  const normalRes = await fetch(`${baseUrl}/demo/fault`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fault: 'normal' })
  });
  assert(normalRes.ok, 'POST /api/demo/fault reset to normal');

  // 9. AI Health Check
  const aiHealthRes = await fetch(`${baseUrl}/ai/health`);
  const aiHealthData = await aiHealthRes.json();
  assert(aiHealthRes.ok && !!aiHealthData.provider, `GET /api/ai/health returns valid AI health (provider: ${aiHealthData.provider})`);

  // 10. Alert History
  const historyRes = await fetch(`${baseUrl}/alerts/history?limit=10`);
  const historyData = await historyRes.json();
  assert(historyRes.ok && Array.isArray(historyData.history), `GET /api/alerts/history returns SQLite historical alerts list (${historyData.history.length} records)`);

  console.log(`\n🏁 API Verification Results: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runApiVerification().catch(err => {
  console.error('Fatal API test error:', err);
  process.exit(1);
});
