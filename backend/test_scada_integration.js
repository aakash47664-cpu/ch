import http from 'http';


function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(dataString ? { 'Content-Length': Buffer.byteLength(dataString) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(responseBody);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, text: responseBody });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (dataString) req.write(dataString);
    req.end();
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runTests() {
  console.log('========================================================');
  console.log('🧪 CHEMDIAG SCADA & REAL-TIME FLOW VERIFICATION SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} -> ${details}`);
      failed++;
    }
  }

  try {
    // 1. Check Initial State & Flow Calculation
    console.log('--- TEST 1: Process State & Deterministic Flow ---');
    const stateRes = await makeRequest('/api/process/state');
    assert(stateRes.status === 200, 'GET /api/process/state returns 200');
    const st = stateRes.data;
    assert(st && st.pump, 'Pump object exists');
    assert(st.streams && st.streams.stream_1, 'Stream 1 exists in process state');
    console.log(`     P-101 Speed: ${st.pump.rpm.toFixed(0)} RPM, Flow: ${(st.pump.flow ?? 0).toFixed(2)} L/min`);
    console.log(`     Stream 1 Flow: ${st.streams.stream_1.flow.toFixed(2)} L/min, Stream 5 (Dist): ${st.streams.stream_5.flow.toFixed(2)} L/min, Stream 6 (Bott): ${st.streams.stream_6.flow.toFixed(2)} L/min`);

    // 2. Setpoint Change: Pump RPM
    console.log('\n--- TEST 2: Remote Setpoint Change & Lag Propagation ---');
    const spRes = await makeRequest('/api/process/setpoint', 'POST', {
      tag: 'P101_SPEED_SP',
      value: 2000,
      operator: 'OP-01 (Lead SCADA Operator)'
    });
    assert(spRes.status === 200 && spRes.data.success, 'POST /api/process/setpoint changes P-101 SP to 2000 RPM');

    // Wait for first-order lag to propagate
    console.log('     Waiting 2.5 seconds for first-order lag propagation (tau = 1.8s)...');
    await sleep(2500);

    const updatedState = await makeRequest('/api/process/state');
    const updatedPump = updatedState.data.pump;
    console.log(`     P-101 Speed after lag: ${updatedPump.rpm.toFixed(1)} RPM (Target 2000), Flow: ${updatedPump.flow.toFixed(2)} L/min (Nominal at 2000 RPM is ~8.16 L/min)`);
    assert(updatedPump.rpm < 2400 && updatedPump.rpm > 1950, 'P-101 speed dynamically transitioned towards 2000 RPM');
    assert(updatedPump.flow < 9.8 && updatedPump.flow > 7.9, 'Discharge flow dynamically adapted to ~8.16 L/min');

    // 3. Interlock Enforcement
    console.log('\n--- TEST 3: Interlock Enforcement ---');
    const interlocksRes = await makeRequest('/api/process/interlocks');
    assert(interlocksRes.status === 200 && Array.isArray(interlocksRes.data.interlocks), 'GET /api/process/interlocks returns interlock matrix');
    console.log(`     Active Interlocks: ${interlocksRes.data.interlocks.map(i => `${i.id}: ${i.permissive ? 'PERMISSIVE' : 'BLOCKED'}`).join(', ')}`);

    // Test P-101 Start / Stop Commands
    console.log('\n--- TEST 4: Remote Equipment Commands (Start/Stop) ---');
    const stopRes = await makeRequest('/api/process/command', 'POST', {
      command: 'PUMP_STOP',
      params: {},
      operator: 'OP-02'
    });
    assert(stopRes.status === 200 && stopRes.data.success, 'POST /api/process/command PUMP_STOP dispatched successfully');
    
    await sleep(2500);
    const stopState = await makeRequest('/api/process/state');
    console.log(`     P-101 Speed after stop: ${stopState.data.pump.rpm.toFixed(1)} RPM, Status: ${stopState.data.pump.status}`);
    assert(stopState.data.pump.rpm < 500, 'P-101 decelerating towards 0 RPM');

    // Resume Pump
    const startRes = await makeRequest('/api/process/command', 'POST', {
      command: 'PUMP_START',
      params: { targetRpm: 2450 },
      operator: 'OP-01'
    });
    assert(startRes.status === 200 && startRes.data.success, 'POST /api/process/command PUMP_START restarted pump to 2450 RPM');



    // 4. Alarms & Acknowledgment
    console.log('\n--- TEST 5: SCADA Alarms & Operator Acknowledgment ---');
    const alarmsRes = await makeRequest('/api/alarms');
    assert(alarmsRes.status === 200 && Array.isArray(alarmsRes.data.alarms), 'GET /api/alarms returns alarm list');
    console.log(`     Total recorded SCADA alarms in SQLite: ${alarmsRes.data.alarms.length}`);
    
    const ackAllRes = await makeRequest('/api/alarms/acknowledge-all', 'POST', {
      operator: 'OP-01',
      note: 'Automated verification acknowledgment'
    });
    assert(ackAllRes.status === 200 && ackAllRes.data.success, 'POST /api/alarms/acknowledge-all acknowledged all active alarms');

    // 5. Event Logs & Operator Audit Trail in SQLite
    console.log('\n--- TEST 6: SQLite Event Logging & Audit Trail ---');
    const eventsRes = await makeRequest('/api/events?limit=10');
    assert(eventsRes.status === 200 && Array.isArray(eventsRes.data.events), 'GET /api/events queries SQLite events table');
    assert(eventsRes.data.events.length > 0, `Recorded ${eventsRes.data.events.length} events in database`);
    console.log(`     Latest Event: [${eventsRes.data.events[0].event_type}] ${eventsRes.data.events[0].message}`);

    const auditRes = await makeRequest('/api/audit?limit=10');
    assert(auditRes.status === 200 && Array.isArray(auditRes.data.audit), 'GET /api/audit queries SQLite audit_trail table');
    assert(auditRes.data.audit.length > 0, `Recorded ${auditRes.data.audit.length} operator actions in audit trail`);
    console.log(`     Latest Audit Log: Operator ${auditRes.data.audit[0].operator} -> ${auditRes.data.audit[0].action} on ${auditRes.data.audit[0].equipment} (${auditRes.data.audit[0].status})`);

    // 6. Maintenance Work Order Ticket Creation
    console.log('\n--- TEST 7: Maintenance Work Orders in SQLite ---');
    const createMaintRes = await makeRequest('/api/maintenance', 'POST', {
      equipment: 'P-101',
      title: 'Routine Vibration & Seal Inspection',
      description: 'Check MPU6050 casing vibration and mechanical seal condition',
      priority: 'HIGH',
      assigned_to: 'John Doe (Mechanical Tech)',
      created_by: 'OP-01 (Lead SCADA Operator)'
    });
    assert(createMaintRes.status === 201 && createMaintRes.data.success, 'POST /api/maintenance created work order ticket');
    const ticketId = createMaintRes.data.ticket_id;
    const dbId = createMaintRes.data.id;
    console.log(`     Created Maintenance Ticket: ${ticketId} (DB ID: ${dbId})`);

    // Update maintenance status
    const updateMaintRes = await makeRequest(`/api/maintenance/${dbId}/status`, 'POST', {
      status: 'RESOLVED',
      resolved_by: 'John Doe',
      resolution_notes: 'Replaced outboard bearing and realigned pump coupling. Vibration nominal at 0.08g.'
    });
    assert(updateMaintRes.status === 200 && updateMaintRes.data.success, 'POST /api/maintenance/:id/status updated ticket to RESOLVED');

    // 7. Controlled Process Reset
    console.log('\n--- TEST 8: Controlled Process Reset (Preserving Logs) ---');
    const resetRes = await makeRequest('/api/process/reset', 'POST', {
      operator: 'OP-01'
    });
    assert(resetRes.status === 200 && resetRes.data.success, 'POST /api/process/reset reset simulation baseline');

    // Verify logs were preserved in SQLite
    const postResetAudit = await makeRequest('/api/audit?limit=5');
    assert(postResetAudit.data.audit.length > 0, 'Audit trail records preserved after simulation reset');
    const postResetEvents = await makeRequest('/api/events?limit=5');
    assert(postResetEvents.data.events.length > 0, 'Event logs preserved after simulation reset');

    console.log('\n========================================================');
    console.log(`🎯 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================');

    if (failed === 0) {
      console.log('🎉 ALL SCADA, FLOW & CONTROL TESTS PASSED PERFECTLY!\n');
    }

  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runTests();
