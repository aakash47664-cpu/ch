/**
 * End-to-end HTTP integration test for Intermittent Fault API routes
 */

import express from 'express';
import { createApiRouter } from './routes/api.js';
import { IntermittentFaultDetector } from './engineering/intermittentFaultDetector.js';
import { initDb, clearIntermittentFaultEvents } from './database/db.js';

async function testApi() {
  console.log('🌐 Testing Intermittent Fault REST API Endpoints...');
  await initDb();
  await clearIntermittentFaultEvents();

  const app = express();
  app.use(express.json());

  const intermittentFaultDetector = new IntermittentFaultDetector();

  app.use('/api', createApiRouter({
    simulator: { getFault: () => 'normal', getState: () => ({}) },
    isolationForest: { predict: () => ({ anomaly: false, anomaly_score: 0.1 }) },
    randomForest: { predict: () => ({ fault_type: 'normal', confidence: 0.9 }) },
    hardwareState: { lastSeen: 0, timeoutMs: 5000 },
    getLatestDiagnosis: () => ({}),
    updateLatestDiagnosis: () => {},
    getLatestEarlyFaultAssessment: () => ({}),
    getEquipmentDiagnostics: () => ({}),
    continuousMlMonitor: null,
    intermittentFaultDetector,
    setOperatorApprovedState: () => {}
  }));

  const server = app.listen(8099, async () => {
    try {
      // 1. GET /api/intermittent-faults/state
      const stateRes = await fetch('http://localhost:8099/api/intermittent-faults/state');
      const stateJson = await stateRes.json();
      console.log('✅ GET /api/intermittent-faults/state status:', stateRes.status, 'active_events:', stateJson.active_events_count);

      // 2. POST /api/intermittent-faults/trigger-pulse
      const pulseRes = await fetch('http://localhost:8099/api/intermittent-faults/trigger-pulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment: 'pump', duration_seconds: 4 })
      });
      const pulseJson = await pulseRes.json();
      console.log('✅ POST /api/intermittent-faults/trigger-pulse status:', pulseRes.status, 'pulse status:', pulseJson.status);

      // 3. GET /api/intermittent-faults/stats
      const statsRes = await fetch('http://localhost:8099/api/intermittent-faults/stats');
      const statsJson = await statsRes.json();
      console.log('✅ GET /api/intermittent-faults/stats status:', statsRes.status, 'total_events:', statsJson.stats.total_events);

      // 4. GET /api/intermittent-faults/events
      const eventsRes = await fetch('http://localhost:8099/api/intermittent-faults/events');
      const eventsJson = await eventsRes.json();
      console.log('✅ GET /api/intermittent-faults/events status:', eventsRes.status, 'count:', eventsJson.count);

      console.log('\n🎉 ALL INTERMITTENT FAULT HTTP API ENDPOINTS TESTED SUCCESSFULLY!\n');
      server.close();
      process.exit(0);
    } catch (err) {
      console.error('❌ API test failed:', err);
      server.close();
      process.exit(1);
    }
  });
}

testApi();
