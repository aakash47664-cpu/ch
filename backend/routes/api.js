import express from 'express';
import {
  recordTelemetry,
  recordDiagnosis,
  recordAlert,
  getRecentAlerts,
  getRecentDiagnoses,
  getRecentTelemetry
} from '../database/db.js';
import { processAiChat } from '../ai/aiChatEngine.js';

export function createApiRouter({
  simulator,
  isolationForest,
  randomForest,
  hardwareState,
  getLatestDiagnosis,
  updateLatestDiagnosis
}) {
  const router = express.Router();

  // 1. ESP32 Sensor Ingestion Endpoint
  router.post('/sensors', async (req, res) => {
    try {
      const payload = req.body;

      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Malformed JSON payload' });
      }

      const inlet_temp = Number(payload.inlet_temperature);
      const outlet_temp = Number(payload.outlet_temperature);
      const vibration = Number(payload.vibration);
      const rpm = Number(payload.rpm);

      // Validation
      if (
        isNaN(inlet_temp) || isNaN(outlet_temp) || isNaN(vibration) || isNaN(rpm) ||
        inlet_temp < -20 || inlet_temp > 120 ||
        outlet_temp < -20 || outlet_temp > 120 ||
        vibration < 0 || vibration > 15 ||
        rpm < 0 || rpm > 15000
      ) {
        return res.status(422).json({
          error: 'Validation failed: sensor readings out of physical range or NaN',
          received: payload
        });
      }

      // Update hardware state
      hardwareState.lastSeen = Date.now();
      hardwareState.isConnected = true;
      hardwareState.inlet_temperature = inlet_temp;
      hardwareState.outlet_temperature = outlet_temp;
      hardwareState.vibration = vibration;
      hardwareState.rpm = rpm;
      hardwareState.source = 'real';

      // Persist to database
      await recordTelemetry('pump', 'real', {
        inlet_temperature: inlet_temp,
        outlet_temperature: outlet_temp,
        vibration,
        rpm
      });

      return res.status(200).json({ status: 'ok', received_at: new Date().toISOString() });
    } catch (err) {
      console.error('Error in /api/sensors:', err);
      return res.status(500).json({ error: 'Internal server error processing sensor payload' });
    }
  });

  // 2. Overview of all 4 Equipment
  router.get('/equipment', (req, res) => {
    const isHardwareOnline = Date.now() - hardwareState.lastSeen < hardwareState.timeoutMs;
    const activeFault = simulator.getFault();
    const useRealPump = isHardwareOnline && activeFault !== 'pump_fault';
    const useRealExchanger = isHardwareOnline && activeFault !== 'heat_exchanger_fault';
    const simState = simulator.getState();

    const equipmentList = [
      {
        id: 'pump',
        name: 'Pump (6V Mini Centrifugal)',
        source: useRealPump ? 'real' : 'demo',
        status: useRealPump ? 'ONLINE' : 'DEMO_MODE',
        data: useRealPump ? {
          rpm: hardwareState.rpm,
          vibration: hardwareState.vibration,
          inlet_temperature: hardwareState.inlet_temperature,
          outlet_temperature: hardwareState.outlet_temperature
        } : {
          rpm: simState.demoPump.rpm,
          vibration: simState.demoPump.vibration,
          inlet_temperature: simState.demoPump.inlet_temperature,
          outlet_temperature: simState.demoPump.outlet_temperature
        }
      },
      {
        id: 'heat_exchanger',
        name: 'Heat Exchanger (Shell & Tube)',
        source: useRealExchanger ? 'real' : 'demo',
        status: useRealExchanger ? 'ONLINE' : 'DEMO_MODE',
        data: useRealExchanger ? {
          inlet_temperature: hardwareState.inlet_temperature,
          outlet_temperature: hardwareState.outlet_temperature,
          temperature_difference: Number(Math.abs(hardwareState.outlet_temperature - hardwareState.inlet_temperature).toFixed(1)),
          heat_transfer_indicator: 92.0
        } : {
          inlet_temperature: simState.demoHeatExchanger.inlet_temperature,
          outlet_temperature: simState.demoHeatExchanger.outlet_temperature,
          temperature_difference: simState.demoHeatExchanger.temperature_difference,
          heat_transfer_indicator: simState.demoHeatExchanger.heat_transfer_indicator
        }
      },
      {
        id: 'reactor',
        name: 'Continuous Stirred-Tank Reactor (CSTR)',
        source: 'simulated',
        status: simState.reactor.cooling_status === 1 ? 'ONLINE' : 'COOLING_TRIPPED',
        data: {
          temperature: simState.reactor.temperature,
          pressure: simState.reactor.pressure,
          level: simState.reactor.level,
          agitator_speed: simState.reactor.agitator_speed,
          cooling_status: simState.reactor.cooling_status
        }
      },
      {
        id: 'distillation',
        name: 'Binary Distillation Column',
        source: 'simulated',
        status: 'ONLINE',
        data: {
          top_temperature: simState.distillation.top_temperature,
          bottom_temperature: simState.distillation.bottom_temperature,
          pressure: simState.distillation.pressure,
          level: simState.distillation.level,
          reflux_ratio: simState.distillation.reflux_ratio
        }
      }
    ];

    res.json(equipmentList);
  });

  // 3. Single Equipment Detail & History
  router.get('/equipment/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const history = await getRecentTelemetry(id, 60);
      res.json({ id, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Current AI Diagnosis & Explainability Object
  router.get('/diagnosis', (req, res) => {
    res.json(getLatestDiagnosis());
  });

  // 5. Recent System Alerts
  router.get('/alerts', async (req, res) => {
    try {
      const alerts = await getRecentAlerts(30);
      res.json(alerts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Rolling Telemetry History
  router.get('/history', async (req, res) => {
    const equipment = req.query.equipment || null;
    const limit = parseInt(req.query.limit, 10) || 50;
    try {
      const history = await getRecentTelemetry(equipment, limit);
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Demo Mode Fault Injection
  router.post('/demo/fault', (req, res) => {
    const { fault } = req.body;
    const allowed = ['normal', 'pump_fault', 'heat_exchanger_fault', 'reactor_cooling_failure', 'distillation_fault'];

    if (!allowed.includes(fault)) {
      return res.status(400).json({
        error: `Invalid fault mode. Must be one of: ${allowed.join(', ')}`
      });
    }

    simulator.setFault(fault);
    res.json({ status: 'success', active_fault: fault });
  });

  // 7b. Interactive Flowsheet Process Controls Override
  router.post('/simulator/control', (req, res) => {
    try {
      const overrides = req.body || {};
      simulator.setControlOverrides(overrides);
      const state = simulator.getState();
      res.json({ status: 'success', message: 'Process controls updated', state });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7c. Reset Interactive Flowsheet Controls to Nominal
  router.post('/simulator/reset', (req, res) => {
    try {
      simulator.resetControls();
      simulator.setFault('normal');
      const state = simulator.getState();
      res.json({ status: 'success', message: 'Process controls reset to nominal', state });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7d. Process Streams Live Telemetry
  router.get('/streams', (req, res) => {
    const simState = simulator.getState();
    res.json(simState.streams);
  });

  // 8. Overall System Status
  router.get('/status', (req, res) => {
    const isHardwareOnline = Date.now() - hardwareState.lastSeen < hardwareState.timeoutMs;
    res.json({
      system: 'ChemDiag AI',
      status: 'ONLINE',
      active_fault_mode: simulator.getFault(),
      esp32: {
        status: isHardwareOnline ? 'CONNECTED' : 'OFFLINE',
        last_seen: hardwareState.lastSeen ? new Date(hardwareState.lastSeen).toISOString() : null,
        message: isHardwareOnline ? 'Receiving live physical sensor stream' : 'Waiting for real ESP32 sensor data'
      },
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  // 9. Interactive AI Chat & Chemical Process Copilot Endpoint
  router.post('/ai/chat', async (req, res) => {
    try {
      const { message, history = [], equipment = null } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message string is required' });
      }

      const isHardwareOnline = Date.now() - hardwareState.lastSeen < hardwareState.timeoutMs;
      const activeFault = simulator.getFault();
      const useRealPump = isHardwareOnline && activeFault !== 'pump_fault';
      const useRealExchanger = isHardwareOnline && activeFault !== 'heat_exchanger_fault';
      const simState = simulator.getState();
      const latestDiag = getLatestDiagnosis();
      const recentAlerts = await getRecentAlerts(5);

      const liveState = {
        activeFault,
        diagnosis: latestDiag,
        recentAlerts,
        equipment: {
          pump: {
            id: 'pump',
            name: 'Pump (6V Mini Centrifugal)',
            source: useRealPump ? 'real' : 'demo',
            source_label: useRealPump ? 'REAL DATA' : 'DEMO / SIMULATED',
            data: useRealPump ? {
              rpm: hardwareState.rpm,
              vibration: hardwareState.vibration,
              inlet_temperature: hardwareState.inlet_temperature,
              outlet_temperature: hardwareState.outlet_temperature
            } : simState.demoPump
          },
          heat_exchanger: {
            id: 'heat_exchanger',
            name: 'Heat Exchanger (Shell & Tube)',
            source: useRealExchanger ? 'real' : 'demo',
            source_label: useRealExchanger ? 'REAL DATA' : 'DEMO / SIMULATED',
            data: useRealExchanger ? {
              inlet_temperature: hardwareState.inlet_temperature,
              outlet_temperature: hardwareState.outlet_temperature,
              temperature_difference: Number(Math.abs(hardwareState.outlet_temperature - hardwareState.inlet_temperature).toFixed(1)),
              heat_transfer_indicator: 92.0
            } : simState.demoHeatExchanger
          },
          reactor: {
            id: 'reactor',
            name: 'Continuous Stirred-Tank Reactor (CSTR)',
            source: 'simulated',
            source_label: 'SIMULATED DATA',
            data: simState.reactor
          },
          distillation: {
            id: 'distillation',
            name: 'Binary Distillation Column',
            source: 'simulated',
            source_label: 'SIMULATED DATA',
            data: simState.distillation
          }
        }
      };

      const telemetryHistory = await getRecentTelemetry(null, 20).catch(() => []);

      const response = await processAiChat({
        message,
        history,
        selectedEquipment: equipment,
        liveState,
        telemetryHistory
      });

      res.json(response);
    } catch (err) {
      console.error('Error in /api/ai/chat:', err);
      res.status(500).json({ error: 'Internal server error in AI chat endpoint', details: err.message });
    }
  });

  return router;
}
