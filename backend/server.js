import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';

import { initDb, recordTelemetry, recordDiagnosis, recordAlert } from './database/db.js';
import { generateSyntheticDataset, FEATURE_NAMES, CLASSES } from './ai/syntheticData.js';
import { IsolationForest } from './ai/isolationForest.js';
import { RandomForestClassifier } from './ai/randomForest.js';
import { diagnoseProcessState } from './ai/rootCauseEngine.js';
import { ProcessSimulator } from './simulator/processSimulator.js';
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
  source: 'demo'
};

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
// 3. Process Simulator
// ----------------------------------------------------
const simulator = new ProcessSimulator();

// Latest explainable diagnosis cache
let latestDiagnosis = {
  equipment: 'All Units',
  anomaly: false,
  anomaly_score: 0.18,
  fault: 'normal',
  probable_fault: 'Nominal Operation',
  root_cause: 'No significant anomaly detected.',
  severity: 'NORMAL',
  confidence: 0.95,
  important_variables: ['All variables within nominal tolerances'],
  recommended_action: 'Continue routine monitoring. System operating within nominal limits.',
  timestamp: new Date().toISOString()
};

function getLatestDiagnosis() {
  return latestDiagnosis;
}

function updateLatestDiagnosis(diag) {
  latestDiagnosis = diag;
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
  updateLatestDiagnosis
}));

// Root greeting
app.get('/', (req, res) => {
  res.json({
    name: 'ChemDiag AI Backend',
    version: '1.0.0',
    description: 'Explainable AI-Based Fault Diagnosis and Root-Cause Analysis',
    status: 'ONLINE',
    docs: '/api/status'
  });
});

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
  const simState = simulator.getState();

  const activeFault = simulator.getFault();
  const useRealPump = isHardwareOnline && activeFault !== 'pump_fault';
  const useRealExchanger = isHardwareOnline && activeFault !== 'heat_exchanger_fault';

  const pumpData = useRealPump ? {
    rpm: hardwareState.rpm,
    vibration: hardwareState.vibration,
    inlet_temperature: hardwareState.inlet_temperature,
    outlet_temperature: hardwareState.outlet_temperature,
    source: 'real'
  } : {
    rpm: simState.demoPump.rpm,
    vibration: simState.demoPump.vibration,
    inlet_temperature: simState.demoPump.inlet_temperature,
    outlet_temperature: simState.demoPump.outlet_temperature,
    source: 'demo'
  };

  const heatExchangerData = useRealExchanger ? {
    inlet_temperature: hardwareState.inlet_temperature,
    outlet_temperature: hardwareState.outlet_temperature,
    temperature_difference: Number(Math.abs(hardwareState.outlet_temperature - hardwareState.inlet_temperature).toFixed(1)),
    heat_transfer_indicator: 92.0,
    source: 'real'
  } : {
    inlet_temperature: simState.demoHeatExchanger.inlet_temperature,
    outlet_temperature: simState.demoHeatExchanger.outlet_temperature,
    temperature_difference: simState.demoHeatExchanger.temperature_difference,
    heat_transfer_indicator: simState.demoHeatExchanger.heat_transfer_indicator,
    source: 'demo'
  };

  return {
    type: 'PROCESS_UPDATE',
    timestamp: new Date().toISOString(),
    active_fault_mode: simulator.getFault(),
    esp32_status: {
      connected: isHardwareOnline,
      status: isHardwareOnline ? 'REAL HARDWARE CONNECTED' : 'ESP32 OFFLINE',
      message: isHardwareOnline ? 'Receiving live physical sensor stream' : 'Waiting for real ESP32 sensor data'
    },
    equipment: {
      pump: {
        id: 'pump',
        name: 'Pump (6V Mini Centrifugal)',
        source: pumpData.source, // 'real' | 'demo'
        source_label: useRealPump ? 'REAL DATA' : 'DEMO / SIMULATED',
        data: {
          ...pumpData,
          flow: simState.pump.flow,
          pressure: simState.pump.pressure,
          status: simState.pump.status
        }
      },
      heat_exchanger: {
        id: 'heat_exchanger',
        name: 'Heat Exchanger (Shell & Tube)',
        source: heatExchangerData.source, // 'real' | 'demo'
        source_label: useRealExchanger ? 'REAL DATA' : 'DEMO / SIMULATED',
        data: {
          ...heatExchangerData,
          efficiency: simState.heatExchanger.efficiency,
          status: simState.heatExchanger.status
        }
      },
      reactor: {
        id: 'reactor',
        name: 'Continuous Stirred-Tank Reactor (CSTR)',
        source: 'simulated',
        source_label: 'SIMULATED DATA',
        data: {
          ...simState.reactor,
          feed_flow: simState.pump.flow,
          feed_temperature: simState.heatExchanger.outlet_temperature
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
    controls: simState.manual_overrides,
    diagnosis: latestDiagnosis
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

    // 1. Evolve continuous simulator states
    simulator.tick();

    const activeFault = simulator.getFault();
    const useRealPump = isHardwareOnline && activeFault !== 'pump_fault';
    const useRealExchanger = isHardwareOnline && activeFault !== 'heat_exchanger_fault';
    const simState = simulator.getState();

    // 2. Assemble process telemetry vector
    const telemetryVector = {
      // Pump
      pump_rpm: useRealPump ? hardwareState.rpm : simState.demoPump.rpm,
      pump_vibration: useRealPump ? hardwareState.vibration : simState.demoPump.vibration,
      pump_inlet_temperature: useRealPump ? hardwareState.inlet_temperature : simState.demoPump.inlet_temperature,
      pump_outlet_temperature: useRealPump ? hardwareState.outlet_temperature : simState.demoPump.outlet_temperature,
      // Heat Exchanger
      heat_exchanger_inlet_temperature: useRealExchanger ? hardwareState.inlet_temperature : simState.demoHeatExchanger.inlet_temperature,
      heat_exchanger_outlet_temperature: useRealExchanger ? hardwareState.outlet_temperature : simState.demoHeatExchanger.outlet_temperature,
      heat_exchanger_indicator: useRealExchanger ? 92.0 : simState.demoHeatExchanger.heat_transfer_indicator,
      // Reactor
      reactor_temperature: simState.reactor.temperature,
      reactor_pressure: simState.reactor.pressure,
      reactor_level: simState.reactor.level,
      reactor_agitator_speed: simState.reactor.agitator_speed,
      reactor_cooling_status: simState.reactor.cooling_status,
      // Distillation
      distillation_top_temperature: simState.distillation.top_temperature,
      distillation_bottom_temperature: simState.distillation.bottom_temperature,
      distillation_pressure: simState.distillation.pressure,
      distillation_level: simState.distillation.level,
      distillation_reflux_ratio: simState.distillation.reflux_ratio
    };

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

    // 5. Step C: Root-Cause & Explainability Rules Engine
    const diagnosis = diagnoseProcessState({
      telemetry: telemetryVector,
      mlAnomaly: ifResult.anomaly,
      mlScore: ifResult.anomaly_score,
      mlClass: rfResult.fault_type,
      mlConfidence: rfResult.confidence
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
        await recordTelemetry('pump', 'demo', simState.demoPump);
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
      console.log(`🚀 ChemDiag AI Server listening on http://localhost:${PORT}`);
      console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
      console.log(`💡 ESP32 Sensor Ingestion: POST http://localhost:${PORT}/api/sensors`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

start();
