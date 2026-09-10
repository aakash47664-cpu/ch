import express from 'express';
import {
  recordTelemetry,
  recordDiagnosis,
  recordAlert,
  recordOperatorApproval,
  getRecentAlerts,
  getRecentDiagnoses,
  getRecentTelemetry
} from '../database/db.js';
import { processAiChat } from '../ai/aiChatEngine.js';
import { getGroqHealth, chatWithGroq, isGroqConfigured } from '../services/groqService.js';

export function createApiRouter({
  simulator,
  isolationForest,
  randomForest,
  hardwareState,
  getLatestDiagnosis,
  updateLatestDiagnosis,
  setOperatorApprovedState
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
    const useRealPump = isHardwareOnline && activeFault !== 'pump_fault' && activeFault !== 'early_pump_degradation';
    const useRealExchanger = isHardwareOnline && activeFault !== 'heat_exchanger_fault' && activeFault !== 'early_heat_exchanger_fouling';
    const simState = simulator.getState();

    const equipmentList = [
      {
        id: 'pump',
        name: 'Pump (6V Mini Centrifugal)',
        source: useRealPump ? 'real' : 'demo',
        status: simState.pump.status,
        health: simState.pump.health,
        data: useRealPump ? {
          rpm: hardwareState.rpm,
          vibration: hardwareState.vibration,
          inlet_temperature: hardwareState.inlet_temperature,
          outlet_temperature: hardwareState.outlet_temperature,
          flow: simState.pump.flow
        } : simState.pump
      },
      {
        id: 'heat_exchanger',
        name: 'Heat Exchanger (Shell & Tube)',
        source: useRealExchanger ? 'real' : 'demo',
        status: simState.heatExchanger.status,
        health: simState.heatExchanger.health,
        data: useRealExchanger ? {
          inlet_temperature: hardwareState.inlet_temperature,
          outlet_temperature: hardwareState.outlet_temperature,
          temperature_difference: Number(Math.abs(hardwareState.outlet_temperature - hardwareState.inlet_temperature).toFixed(1)),
          heat_transfer_indicator: 92.0,
          efficiency: 92.0
        } : simState.heatExchanger
      },
      {
        id: 'reactor',
        name: 'Continuous Stirred-Tank Reactor (CSTR)',
        source: 'simulated',
        status: simState.reactor.status,
        health: simState.reactor.health,
        data: {
          ...simState.reactor,
          feed_flow: simState.pump.flow,
          feed_temperature: simState.heatExchanger.outlet_temperature
        }
      },
      {
        id: 'distillation',
        name: 'Binary Distillation Column',
        source: 'simulated',
        status: simState.distillation.status,
        health: simState.distillation.health,
        data: {
          ...simState.distillation,
          feed_flow: simState.pump.flow,
          feed_temperature: simState.reactor.temperature
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

  // 4b. Operator Approval Endpoint (Human-in-the-Loop)
  router.post('/diagnosis/approve', async (req, res) => {
    try {
      const { note = '' } = req.body || {};
      const latest = getLatestDiagnosis();

      if (setOperatorApprovedState) {
        setOperatorApprovedState(true);
      }

      const record = await recordOperatorApproval({
        equipment: latest.equipment || 'All Units',
        fault: latest.probable_fault || latest.fault || 'Nominal',
        riskScore: latest.preventive?.riskScore ?? 0,
        recommendedMeasure: latest.recommended_action || 'Routine supervisory monitoring',
        decision: 'APPROVED',
        note
      });

      res.json({
        status: 'success',
        message: 'Operator approval recorded successfully',
        approval: record
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
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
    const allowed = [
      'normal',
      'early_pump_degradation',
      'early_heat_exchanger_fouling',
      'early_reactor_cooling_degradation',
      'early_distillation_reflux_loss',
      'pump_fault',
      'heat_exchanger_fault',
      'reactor_cooling_failure',
      'distillation_fault',
      'unknown_fault'
    ];

    if (!allowed.includes(fault)) {
      return res.status(400).json({
        error: `Invalid fault mode. Must be one of: ${allowed.join(', ')}`
      });
    }

    if (setOperatorApprovedState) {
      setOperatorApprovedState(false); // Reset operator approval when scenario switches
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
      if (setOperatorApprovedState) setOperatorApprovedState(false);
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
      fault_severity: simulator.getFaultSeverity(),
      esp32: {
        status: isHardwareOnline ? 'CONNECTED' : 'OFFLINE',
        last_seen: hardwareState.lastSeen ? new Date(hardwareState.lastSeen).toISOString() : null,
        message: isHardwareOnline ? 'Receiving live physical sensor stream' : 'Waiting for real ESP32 sensor data'
      },
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  // 9. AI Health Endpoint
  router.get('/ai/health', (req, res) => {
    try {
      const health = getGroqHealth();
      res.json(health);
    } catch (err) {
      console.error('Error in /api/ai/health:', err);
      res.status(500).json({ provider: 'Groq', configured: false, status: 'ERROR', error: err.message });
    }
  });

  // 10. Interactive Universal Industrial AI Chat Endpoint
  router.post('/ai/chat', async (req, res) => {
    try {
      const {
        message,
        conversation = [],
        history = [],
        selectedEquipment = null,
        equipment = null,
        processContext = null
      } = req.body;

      // Safe dev log for verifying message flow
      console.log("CHEMDIAG RECEIVED MESSAGE:", req.body.message);

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Message string is required' });
      }

      const actualUserMessage = message.trim();
      const rawConversation = conversation.length > 0 ? conversation : history;

      // Clean conversation history and ensure current user message is not duplicated in history
      const cleanConversation = rawConversation
        .filter(turn => turn && (turn.content || turn.text || turn.message))
        .map(turn => ({
          role: (turn.role === 'user' || turn.sender === 'user') ? 'user' : 'assistant',
          content: String(turn.content || turn.text || turn.message)
        }));

      if (
        cleanConversation.length > 0 &&
        cleanConversation[cleanConversation.length - 1].role === 'user' &&
        cleanConversation[cleanConversation.length - 1].content.trim() === actualUserMessage
      ) {
        cleanConversation.pop();
      }

      const isHardwareOnline = Date.now() - hardwareState.lastSeen < hardwareState.timeoutMs;
      const activeFault = simulator.getFault();
      const useRealPump = isHardwareOnline && activeFault !== 'pump_fault' && activeFault !== 'early_pump_degradation';
      const useRealExchanger = isHardwareOnline && activeFault !== 'heat_exchanger_fault' && activeFault !== 'early_heat_exchanger_fouling';
      const simState = simulator.getState();
      const latestDiag = getLatestDiagnosis();
      const recentAlerts = await getRecentAlerts(5);

      const liveState = {
        activeFault,
        faultSeverity: simulator.getFaultSeverity(),
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
              outlet_temperature: hardwareState.outlet_temperature,
              flow: simState.pump.flow
            } : simState.pump
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
              heat_transfer_indicator: 92.0,
              efficiency: 92.0
            } : simState.heatExchanger
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
        },
        streams: simState.streams
      };

      // 1. If GROQ_API_KEY is configured, prioritize Groq
      if (isGroqConfigured()) {
        try {
          const groqResponse = await chatWithGroq({
            message: actualUserMessage,
            conversation: cleanConversation,
            processContext: processContext || liveState,
            liveState
          });

          if (groqResponse && groqResponse.trim().length > 0) {
            return res.json({
              success: true,
              response: groqResponse,
              answer: groqResponse,
              provider: 'Groq',
              timestamp: new Date().toISOString()
            });
          }
        } catch (groqErr) {
          console.warn('Groq API call encountered an issue, falling back gracefully:', groqErr.message);
        }
      }

      // 2. Seamless Dynamic Industrial Reasoning Engine fallback
      const telemetryHistory = await getRecentTelemetry(null, 20).catch(() => []);
      const fallbackResult = await processAiChat({
        message: actualUserMessage,
        conversation: cleanConversation,
        history: cleanConversation,
        selectedEquipment: selectedEquipment || equipment,
        liveState,
        processContext,
        telemetryHistory
      });

      const responseText = fallbackResult.answer || fallbackResult.response || 'Operating nominally within design tolerances.';

      return res.json({
        success: true,
        response: responseText,
        answer: responseText,
        equipment: fallbackResult.equipment || 'all',
        provider: fallbackResult.provider || 'Groq',
        timestamp: fallbackResult.timestamp || new Date().toISOString()
      });
    } catch (err) {
      console.error('Error in /api/ai/chat:', err);
      res.status(500).json({
        success: false,
        error: 'Industrial AI service is temporarily unavailable.',
        response: 'Industrial AI service is temporarily unavailable. Please verify network connectivity.',
        answer: 'Industrial AI service is temporarily unavailable. Please verify network connectivity.'
      });
    }
  });

  return router;
}
