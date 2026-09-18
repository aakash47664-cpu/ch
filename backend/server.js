import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../frontend/dist');

import { initDb, recordTelemetry, recordDiagnosis, recordAlert, recordIntelligentAlert, recordProcessHistory } from './database/db.js';
import { generateSyntheticDataset, FEATURE_NAMES, CLASSES } from './ai/syntheticData.js';
import { IsolationForest } from './ai/isolationForest.js';
import { RandomForestClassifier } from './ai/randomForest.js';
import { diagnoseProcessState } from './ai/rootCauseEngine.js';
import { ProcessSimulator } from './simulator/processSimulator.js';
import { EarlyFaultEngine } from './engineering/earlyFaultEngine.js';
import { ContinuousMlMonitor } from './ai/continuousMlMonitor.js';
import { IntermittentFaultDetector } from './engineering/intermittentFaultDetector.js';
import { createApiRouter } from './routes/api.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// 1. Hardware State Tracking (ESP32)
// ----------------------------------------------------
const hardwareState = {
  lastSeen: 0,
  timeoutMs: parseInt(process.env.ESP32_TIMEOUT_MS, 10) || 5000,
  isConnected: false,
  inlet_temperature: 25.0,
  outlet_temperature: 38.0,
  vibration: 0.08,
  rpm: 2450,
  source: 'demo',
  // Dedicated E-101 Heat Exchanger DS18B20 tracking
  hxLastSeen: 0,
  hx_outlet_temperature: null,
  hxConnected: false
};

// Operator approval state for current session
let isOperatorApproved = false;

function setOperatorApprovedState(val) {
  isOperatorApproved = val;
}

// ----------------------------------------------------
// 2. Machine Learning Initialization
// ----------------------------------------------------
console.log('🤖 Initializing ChemDiag AI Engine...');
const syntheticData = generateSyntheticDataset(300);

const isolationForest = new IsolationForest(40, 256, 0.58);
const ifTrainingData = syntheticData.map(d => d.features);
isolationForest.fit(ifTrainingData, FEATURE_NAMES);

const randomForest = new RandomForestClassifier(25, 8, 4);
randomForest.fit(syntheticData, FEATURE_NAMES, CLASSES);

// ----------------------------------------------------
// 3. Process Simulator, Early Fault Engine & Continuous ML Monitor
// ----------------------------------------------------
const simulator = new ProcessSimulator();
const earlyFaultEngine = new EarlyFaultEngine();
const continuousMlMonitor = new ContinuousMlMonitor();
const intermittentFaultDetector = new IntermittentFaultDetector();

// Initial baseline telemetry for early fault engine
let latestEarlyFaultAssessment = earlyFaultEngine.processTelemetry({
  pump_rpm: 2450,
  pump_vibration: 0.08,
  pump_flow: 10.0,
  pump_discharge_pressure: 2.80,
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
  dist_reflux_ratio: 1.85,
  dist_top_temp: 76.5,
  dist_bottom_temp: 98.4,
  dist_pressure: 2.10,
  dist_feed_flow: 9.7
}, 'normal');

// Initialize continuous ML diagnostics
continuousMlMonitor.getInitialDiagnostics();

// Latest explainable diagnosis cache
let latestDiagnosis = {
  equipment: 'All Units',
  anomaly: false,
  anomaly_score: 0.18,
  is_unknown_fault: false,
  fault: 'normal',
  probable_fault: 'Nominal Operation',
  root_cause: 'No significant anomaly detected.',
  severity: 'NORMAL',
  confidence: 0.95,
  important_variables: ['All variables within nominal tolerances'],
  recommended_action: 'Continue routine monitoring. System operating within nominal limits.',
  xai_contributions: [{ feature: 'nominal', label: 'All variables nominal', change: '✓ Nominal', contributionPercent: 100, isUp: false }],
  prognosis: { degradationPercent: 0, trend: 'STABLE', riskStage: 'NORMAL', timeToThreshold: 'Operating nominally', narrative: 'Operating nominally' },
  preventive: { riskScore: 12, riskStage: 'NORMAL', observedEvidence: 'Operating within boundaries', probableCause: 'Nominal', preventiveMeasure: 'Continue routine monitoring', verificationRequired: false, recommendationAllowed: true },
  safetyGate: { gateState: 'NORMAL', statusLabel: '✓ NOMINAL OPERATION', safeToRecommend: true, actionBlocked: false, requiresOperatorApproval: false, bannerType: 'safe', headline: 'SYSTEM OPERATING NOMINALLY', reason: 'Parameters nominal', directive: '✓ CONTINUE ROUTINE MONITORING' },
  operatorApproval: { required: false, approved: false, message: 'Nominal operation' },
  timestamp: new Date().toISOString()
};

function getLatestDiagnosis() {
  return latestDiagnosis;
}

function updateLatestDiagnosis(diag) {
  latestDiagnosis = diag;
}

function getLatestEarlyFaultAssessment() {
  return latestEarlyFaultAssessment;
}

function getEquipmentDiagnostics() {
  return continuousMlMonitor.getEquipmentDiagnostics();
}

// ----------------------------------------------------
// 4. API Routes
// ----------------------------------------------------
app.use('/api', createApiRouter({
  simulator,
  isolationForest,
  randomForest,
  hardwareState,
  getLatestDiagnosis,
  updateLatestDiagnosis,
  getLatestEarlyFaultAssessment,
  getEquipmentDiagnostics,
  continuousMlMonitor,
  intermittentFaultDetector,
  setOperatorApprovedState
}));

// 4b. Static Frontend Assets (if built)
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      name: 'ChemDiag AI Backend',
      version: '2.0.0',
      description: 'Explainable AI-Based Fault Diagnosis, Digital Twin & Safety-Gated Decision Support',
      status: 'ONLINE',
      docs: '/api/status'
    });
  });
}

// ----------------------------------------------------
// 5. WebSocket Connections & Broadcast
// ----------------------------------------------------
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(` Dashboard client connected to WebSocket. Total clients: ${clients.size}`);

  // Send current state immediately on connect
  ws.send(JSON.stringify(buildBroadcastPayload()));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`🔌 Dashboard client disconnected. Remaining clients: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err.message);
    clients.delete(ws);
  });
});

function broadcast(payload) {
  const json = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

// Helper to construct the unified state package
function buildBroadcastPayload() {
  const isHardwareOnline = Date.now() - hardwareState.lastSeen < hardwareState.timeoutMs;
  const isHxHardwareOnline = hardwareState.hxLastSeen > 0 && (Date.now() - hardwareState.hxLastSeen < hardwareState.timeoutMs);
  const hasRealHxTemp = isHxHardwareOnline && hardwareState.hx_outlet_temperature !== null;
  const simState = simulator.getState();

  const activeFault = simulator.getFault();
  const useRealPump = isHardwareOnline && activeFault !== 'pump_fault' && activeFault !== 'early_pump_degradation';
  const useRealExchanger = (hasRealHxTemp || isHardwareOnline) && activeFault !== 'heat_exchanger_fault' && activeFault !== 'early_heat_exchanger_fouling';

  const pumpData = useRealPump ? {
    rpm: hardwareState.rpm,
    vibration: hardwareState.vibration,
    inlet_temperature: hardwareState.inlet_temperature,
    outlet_temperature: hardwareState.outlet_temperature,
    flow: simState.pump.flow,
    source: 'real'
  } : {
    ...simState.pump,
    source: 'demo'
  };

  // E-101 Heat Exchanger: Replace ONLY the simulated outlet_temperature with REAL DS18B20 sensor data from ESP32
  const hxOutletTemp = hasRealHxTemp
    ? hardwareState.hx_outlet_temperature
    : (useRealExchanger && hardwareState.outlet_temperature ? hardwareState.outlet_temperature : simState.heatExchanger.outlet_temperature);
  const hxInletTemp = simState.heatExchanger.inlet_temperature;
  const hxDeltaT = Number(Math.abs(hxOutletTemp - hxInletTemp).toFixed(1));
  const hxSource = hasRealHxTemp ? 'real' : (useRealExchanger && hardwareState.source === 'real' ? 'real' : 'demo');
  const hxSensorStatus = hasRealHxTemp ? 'LIVE' : (hardwareState.hxLastSeen === 0 ? 'WAITING' : 'OFFLINE');

  const heatExchangerData = {
    ...simState.heatExchanger,
    outlet_temperature: Number(hxOutletTemp.toFixed(1)),
    inlet_temperature: hxInletTemp,
    temperature_difference: hxDeltaT,
    source: hxSource,
    sensor_status: hxSensorStatus,
    has_real_sensor: hasRealHxTemp,
    sensor_last_seen: hardwareState.hxLastSeen || null
  };

  return {
    type: 'PROCESS_UPDATE',
    timestamp: new Date().toISOString(),
    active_fault_mode: simulator.getFault(),
    fault_severity: simulator.getFaultSeverity(),
    is_paused: simState.is_paused,
    esp32_status: {
      connected: isHardwareOnline,
      status: isHardwareOnline ? 'REAL HARDWARE CONNECTED' : 'ESP32 OFFLINE',
      message: isHardwareOnline ? 'Receiving live physical sensor stream' : 'Waiting for real ESP32 sensor data'
    },
    equipment: {
      pump: {
        id: 'pump',
        name: 'Pump (6V Mini Centrifugal)',
        source: pumpData.source,
        source_label: useRealPump ? 'REAL DATA' : 'DEMO / SIMULATED',
        data: pumpData
      },
      heat_exchanger: {
        id: 'heat_exchanger',
        name: 'Heat Exchanger (Shell & Tube)',
        source: heatExchangerData.source,
        source_label: hasRealHxTemp || (useRealExchanger && heatExchangerData.source === 'real') ? 'REAL DATA' : 'DEMO / SIMULATED',
        data: heatExchangerData
      },
      reactor: {
        id: 'reactor',
        name: 'Continuous Stirred-Tank Reactor (CSTR)',
        source: 'simulated',
        source_label: 'SIMULATED DATA',
        data: {
          ...simState.reactor,
          feed_flow: simState.pump.flow,
          feed_temperature: heatExchangerData.outlet_temperature
        }
      },
      distillation: {
        id: 'distillation',
        name: 'Binary Distillation Column',
        source: 'simulated',
        source_label: 'SIMULATED DATA',
        data: {
          ...simState.distillation,
          feed_flow: simState.pump.flow,
          feed_temperature: simState.reactor.temperature,
          distillate_flow: simState.streams.stream_5.flow,
          reflux_flow: simState.streams.stream_5.reflux_flow,
          bottoms_flow: simState.streams.stream_6.flow
        }
      }
    },
    streams: simState.streams,
    workflow: simState.workflow,
    controls: simState.controls,
    active_alerts: simState.active_alerts || [],
    alert_summary: simState.alert_summary || simulator.getAlertSummary(),
    alarms: simState.active_alerts || [], // alias for backward compatibility
    diagnosis: latestDiagnosis,
    // CONTINUOUS PLANT-WIDE EQUIPMENT ML MONITOR STATE (SINGLE SOURCE OF TRUTH)
    equipment_diagnostics: continuousMlMonitor.getEquipmentDiagnostics(),
    equipmentDiagnostics: continuousMlMonitor.getEquipmentDiagnostics(),
    // CONTINUOUS PROCESS HEALTH & EARLY FAULT DETECTION DATA
    process_health: latestEarlyFaultAssessment.process_health,
    equipment_health: latestEarlyFaultAssessment.equipment_health,
    early_warnings: latestEarlyFaultAssessment.early_warnings,
    what_changed: latestEarlyFaultAssessment.what_changed,
    watch_list: latestEarlyFaultAssessment.watch_list,
    causal_propagation: latestEarlyFaultAssessment.causal_propagation,
    timeline_events: latestEarlyFaultAssessment.timeline_events,
    all_metrics: latestEarlyFaultAssessment.all_metrics,
    // INDEPENDENT TEMPORAL INTERMITTENT & TRANSIENT FAULT STATE
    intermittent_faults: intermittentFaultDetector.getState()
  };
}

// ----------------------------------------------------
// 6. Main 1-Second AI & Simulation Tick Loop
// ----------------------------------------------------
let tickCount = 0;

setInterval(async () => {
  try {
    tickCount++;
    const isHardwareOnline = Date.now() - hardwareState.lastSeen < hardwareState.timeoutMs;
    
    // Pass live hardware state to simulator
    simulator.setHardwareState({
      isConnected: isHardwareOnline,
      rpm: hardwareState.rpm,
      vibration: hardwareState.vibration,
      inlet_temperature: hardwareState.inlet_temperature,
      outlet_temperature: hardwareState.outlet_temperature
    });

    // 1. Evolve continuous simulator states and progressive fault severity
    simulator.tick();

    const activeFault = simulator.getFault();
    const faultSeverity = simulator.getFaultSeverity();
    const faultTicks = simulator.getFaultTicks();

    const isHxHardwareOnline = hardwareState.hxLastSeen > 0 && (Date.now() - hardwareState.hxLastSeen < hardwareState.timeoutMs);
    const hasRealHxTemp = isHxHardwareOnline && hardwareState.hx_outlet_temperature !== null;

    const useRealPump = isHardwareOnline && activeFault !== 'pump_fault' && activeFault !== 'early_pump_degradation';
    const useRealExchanger = (hasRealHxTemp || isHardwareOnline) && activeFault !== 'heat_exchanger_fault' && activeFault !== 'early_heat_exchanger_fouling';
    const simState = simulator.getState();

    const hxOutletTemp = hasRealHxTemp
      ? hardwareState.hx_outlet_temperature
      : (useRealExchanger && hardwareState.outlet_temperature ? hardwareState.outlet_temperature : simState.heatExchanger.outlet_temperature);
    const hxInletTemp = simState.heatExchanger.inlet_temperature;
    const hxDeltaT = Number(Math.abs(hxOutletTemp - hxInletTemp).toFixed(1));

    // 2. Assemble process telemetry vector
    const telemetryVector = {
      // Pump
      pump_rpm: useRealPump ? hardwareState.rpm : simState.pump.rpm,
      pump_vibration: useRealPump ? hardwareState.vibration : simState.pump.vibration,
      pump_flow: simState.pump.flow,
      pump_discharge_pressure: simState.pump.discharge_pressure,
      pump_suction_pressure: simState.pump.suction_pressure,
      pump_inlet_temperature: useRealPump ? hardwareState.inlet_temperature : simState.pump.inlet_temperature,
      pump_outlet_temperature: useRealPump ? hardwareState.outlet_temperature : simState.pump.outlet_temperature,
      // Heat Exchanger
      hx_inlet_temp: hxInletTemp,
      hx_outlet_temp: hxOutletTemp,
      hx_efficiency: simState.heatExchanger.efficiency,
      hx_delta_t: hxDeltaT,
      hx_flow: simState.heatExchanger.flow,
      heat_exchanger_inlet_temperature: hxInletTemp,
      heat_exchanger_outlet_temperature: hxOutletTemp,
      heat_exchanger_efficiency: simState.heatExchanger.efficiency,
      heat_exchanger_indicator: simState.heatExchanger.heat_transfer_indicator,
      // Reactor
      reactor_temp: simState.reactor.temperature,
      reactor_temperature: simState.reactor.temperature,
      reactor_pressure: simState.reactor.pressure,
      reactor_level: simState.reactor.level,
      reactor_feed_flow: simState.reactor.feed_flow,
      reactor_agitator_speed: simState.reactor.agitator_speed,
      reactor_cooling_status: simState.reactor.cooling_status,
      // Distillation
      dist_top_temp: simState.distillation.top_temperature,
      dist_bottom_temp: simState.distillation.bottom_temperature,
      dist_pressure: simState.distillation.pressure,
      dist_feed_flow: simState.distillation.feed_flow,
      dist_reflux_ratio: simState.distillation.reflux_ratio,
      distillation_top_temperature: simState.distillation.top_temperature,
      distillation_bottom_temperature: simState.distillation.bottom_temperature,
      distillation_pressure: simState.distillation.pressure,
      distillation_level: simState.distillation.level,
      distillation_reflux_ratio: simState.distillation.reflux_ratio
    };

    // 2a. Execute Continuous Plant-Wide Equipment ML Diagnostics (All 4 Units Simultaneously)
    continuousMlMonitor.processState(simState, telemetryVector, activeFault, hardwareState);

    // 2b. Compute Continuous Early-Fault & Process Health Assessment
    latestEarlyFaultAssessment = earlyFaultEngine.processTelemetry(telemetryVector, activeFault);

    // 2c. Execute Temporal Intermittent & Transient Fault Detection Engine
    intermittentFaultDetector.processTick(telemetryVector, simState, activeFault);

    // Features for ML models
    const mlSample = {
      temperature: telemetryVector.reactor_temperature,
      pressure: telemetryVector.reactor_pressure,
      level: telemetryVector.reactor_level,
      vibration: telemetryVector.pump_vibration,
      rpm: telemetryVector.pump_rpm,
      inlet_temperature: telemetryVector.pump_inlet_temperature,
      outlet_temperature: telemetryVector.pump_outlet_temperature,
      reflux_ratio: telemetryVector.distillation_reflux_ratio,
      agitator_speed: telemetryVector.reactor_agitator_speed
    };

    // 3. Step A: Isolation Forest Anomaly Detection
    const ifResult = isolationForest.predict(mlSample);

    // 4. Step B: Random Forest Fault Classification
    const rfResult = randomForest.predict(mlSample);

    // 5. Step C: Comprehensive Root-Cause, Unknown Guard, Prognosis & Safety Gate
    const diagnosis = diagnoseProcessState({
      telemetry: telemetryVector,
      mlAnomaly: ifResult.anomaly,
      mlScore: ifResult.anomaly_score,
      mlClass: rfResult.fault_type,
      mlConfidence: rfResult.confidence,
      rfProbabilities: rfResult.probabilities || {},
      faultMode: activeFault,
      faultSeverity,
      faultTicks,
      isHardwareOnline,
      hardwareLastSeen: hardwareState.lastSeen,
      operatorApproved: isOperatorApproved
    });

    latestDiagnosis = diagnosis;

    // 6. Persist diagnosis & trigger alert if anomaly detected
    if (diagnosis.anomaly && diagnosis.severity !== 'NORMAL') {
      await recordDiagnosis(diagnosis);
      await recordAlert({
        equipment: diagnosis.equipment,
        fault: diagnosis.probable_fault,
        root_cause: diagnosis.root_cause,
        severity: diagnosis.severity,
        timestamp: diagnosis.timestamp
      });
    }

    // Persist periodic telemetry sample (every 5 seconds)
    if (tickCount % 5 === 0) {
      await recordTelemetry('reactor', 'simulated', simState.reactor);
      await recordTelemetry('distillation', 'simulated', simState.distillation);
      if (!isHardwareOnline) {
        await recordTelemetry('pump', 'demo', simState.pump);
      }
    }

    // Persist timestamped process history trends every 2 seconds
    if (tickCount % 2 === 0) {
      await recordProcessHistory({
        pump_rpm: telemetryVector.pump_rpm,
        pump_flow: telemetryVector.pump_flow,
        pump_vibration: telemetryVector.pump_vibration,
        pump_suction_pressure: simState.pump.suction_pressure,
        pump_discharge_pressure: simState.pump.discharge_pressure,
        hx_inlet_temp: telemetryVector.heat_exchanger_inlet_temperature,
        hx_outlet_temp: telemetryVector.heat_exchanger_outlet_temperature,
        hx_delta_t: simState.heatExchanger.temperature_difference,
        hx_flow: simState.heatExchanger.flow,
        reactor_feed_flow: simState.reactor.feed_flow,
        reactor_temp: simState.reactor.temperature,
        reactor_pressure: simState.reactor.pressure,
        reactor_level: simState.reactor.level,
        dist_feed_flow: simState.distillation.feed_flow,
        dist_top_temp: simState.distillation.top_temperature,
        dist_bottom_temp: simState.distillation.bottom_temperature,
        dist_pressure: simState.distillation.pressure,
        dist_reflux_ratio: simState.distillation.reflux_ratio
      });


      // Synchronize active Intelligent Alerts to database
      for (const al of (simState.active_alerts || [])) {
        await recordIntelligentAlert(al);
      }
    }

    // 7. Broadcast state to WebSocket clients
    broadcast(buildBroadcastPayload());

  } catch (err) {
    console.error('Error in simulation/AI loop:', err);
  }
}, 1000);

// ----------------------------------------------------
// 7. Server Boot
// ----------------------------------------------------
async function start() {
  try {
    await initDb();
    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 ChemDiag AI Server v2.0 listening on http://localhost:${PORT}`);
      console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
      console.log(`💡 ESP32 Sensor Ingestion: POST http://localhost:${PORT}/api/sensors`);
      console.log(`🛡️ Safety Gate & Unknown Fault Guard: ACTIVE`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

start();
