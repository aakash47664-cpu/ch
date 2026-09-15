import express from 'express';
import {
  recordTelemetry,
  recordDiagnosis,
  recordAlert,
  recordIntelligentAlert,
  acknowledgeIntelligentAlert,
  clearIntelligentAlert,
  getActiveIntelligentAlerts,
  getIntelligentAlertHistory,
  recordOperatorApproval,
  getRecentAlerts,
  getRecentDiagnoses,
  getRecentTelemetry,
  recordEvent,
  getEvents,
  recordAuditEntry,
  getAuditTrail,
  createMaintenanceRecord,
  updateMaintenanceStatus,
  getMaintenanceRecords,
  recordProcessHistory,
  getProcessHistory
} from '../database/db.js';
import { processAiChat } from '../ai/aiChatEngine.js';
import { getGroqHealth, chatWithGroq, isGroqConfigured } from '../services/groqService.js';
import { getGeminiHealth, chatWithGemini, isGeminiConfigured } from '../services/geminiService.js';
import { getCombinedAiHealth, dispatchAiChat } from '../services/aiProvider.js';
import * as WhatIf from '../engineering/whatIf.js';

export function createApiRouter({
  simulator,
  isolationForest,
  randomForest,
  hardwareState,
  getLatestDiagnosis,
  updateLatestDiagnosis,
  getLatestEarlyFaultAssessment,
  setOperatorApprovedState
}) {
  const router = express.Router();

  // 0. Continuous Process Health & Early Fault Endpoint
  router.get('/process/health', (req, res) => {
    try {
      const assessment = typeof getLatestEarlyFaultAssessment === 'function' ? getLatestEarlyFaultAssessment() : null;
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        process_health: assessment?.process_health || { score: 95, stage: 'NORMAL', label: 'HEALTHY' },
        equipment_health: assessment?.equipment_health || {},
        early_warnings: assessment?.early_warnings || [],
        what_changed: assessment?.what_changed || [],
        watch_list: assessment?.watch_list || [],
        causal_propagation: assessment?.causal_propagation || {}
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/early-faults', (req, res) => {
    try {
      const assessment = typeof getLatestEarlyFaultAssessment === 'function' ? getLatestEarlyFaultAssessment() : null;
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        early_warnings: assessment?.early_warnings || [],
        watch_list: assessment?.watch_list || [],
        what_changed: assessment?.what_changed || [],
        process_health: assessment?.process_health || {}
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

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

  // 5. Intelligent System Alerts Endpoints
  router.get('/alerts', async (req, res) => {
    try {
      const activeAlerts = simulator.getActiveAlerts();
      const summary = simulator.getAlertSummary();
      const history = await getIntelligentAlertHistory(30);

      // Return both structured envelope and list for versatile frontend consumers
      res.json({
        success: true,
        summary,
        active_alerts: activeAlerts,
        activeCount: summary.activeCount,
        criticalCount: summary.criticalCount,
        highCount: summary.highCount,
        warningCount: summary.warningCount,
        infoCount: summary.infoCount,
        history,
        alerts: activeAlerts // default array alias
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/alerts/active', (req, res) => {
    try {
      const activeAlerts = simulator.getActiveAlerts();
      const summary = simulator.getAlertSummary();
      res.json({
        success: true,
        summary,
        active_alerts: activeAlerts,
        alerts: activeAlerts
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/alerts/history', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const history = await getIntelligentAlertHistory(limit);
      res.json({
        success: true,
        count: history.length,
        history
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/alerts/:id/acknowledge', async (req, res) => {
    try {
      const { id } = req.params;
      const { operator = 'Plant Operator' } = req.body || {};

      const simAck = simulator.acknowledgeAlert(id);
      await acknowledgeIntelligentAlert(id);

      await recordEvent({
        event_type: 'ALERT_ACKNOWLEDGED',
        equipment: simAck?.equipment || 'PLANT',
        tag: id,
        message: `Alert [${id}] acknowledged by ${operator}`,
        source: operator,
        result: 'SUCCESS'
      });

      res.json({
        success: true,
        id,
        alert: simAck,
        summary: simulator.getAlertSummary()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/alerts/:id/clear', async (req, res) => {
    try {
      const { id } = req.params;
      const { operator = 'Plant Operator' } = req.body || {};

      const simClear = simulator.clearAlert(id);
      await clearIntelligentAlert(id);

      await recordEvent({
        event_type: 'ALERT_CLEARED',
        equipment: simClear?.equipment || 'PLANT',
        tag: id,
        message: `Alert [${id}] cleared by ${operator}`,
        source: operator,
        result: 'SUCCESS'
      });

      res.json({
        success: true,
        id,
        summary: simulator.getAlertSummary()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/alerts/acknowledge-all', async (req, res) => {
    try {
      const { operator = 'Plant Operator' } = req.body || {};
      const count = simulator.acknowledgeAllAlerts();
      const activeAlerts = simulator.getActiveAlerts();

      for (const al of activeAlerts) {
        await acknowledgeIntelligentAlert(al.id);
      }

      await recordEvent({
        event_type: 'ALL_ALERTS_ACKNOWLEDGED',
        equipment: 'PLANT',
        message: `All active alerts (${count}) acknowledged by ${operator}`,
        source: operator,
        result: 'SUCCESS'
      });

      res.json({
        success: true,
        count,
        summary: simulator.getAlertSummary()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Backward compatibility aliases for /alarms
  router.get('/alarms', (req, res) => {
    const activeAlerts = simulator.getActiveAlerts();
    const summary = simulator.getAlertSummary();
    res.json({
      activeCount: summary.activeCount,
      acknowledgedCount: summary.acknowledgedCount,
      alarms: activeAlerts,
      alerts: activeAlerts
    });
  });

  router.post('/alarms/:id/acknowledge', async (req, res) => {
    try {
      const { id } = req.params;
      simulator.acknowledgeAlert(id);
      await acknowledgeIntelligentAlert(id);
      res.json({ success: true, tag: id, acknowledged: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/alarms/acknowledge-all', async (req, res) => {
    try {
      const count = simulator.acknowledgeAllAlerts();
      res.json({ success: true, count, acknowledged: true });
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
    res.json({ status: 'success', active_fault: fault, summary: simulator.getAlertSummary() });
  });

  // 7a. Full Process State
  router.get('/process/state', (req, res) => {
    try {
      res.json(simulator.getState());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7b. Controlled Process Reset
  router.post('/process/reset', async (req, res) => {
    try {
      const { operator = 'Plant Operator' } = req.body || {};
      simulator.resetSimulation();
      if (setOperatorApprovedState) setOperatorApprovedState(false);

      await recordEvent({
        event_type: 'SIMULATION_RESET',
        equipment: 'PLANT',
        message: 'Process simulation reset to nominal baseline state. Historical logs preserved.',
        source: operator,
        result: 'SUCCESS'
      });

      res.json({
        success: true,
        message: 'Process reset to nominal baseline.',
        state: simulator.getState()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7c. Timestamped Process History Trends
  router.get('/process/history', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 60;
      const history = await getProcessHistory(limit);
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7j. SCADA Events Log
  router.get('/events', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 100;
      const equipment = req.query.equipment || null;
      const event_type = req.query.event_type || null;
      const events = await getEvents(limit, equipment, event_type);
      res.json({
        success: true,
        count: (events || []).length,
        events: events || []
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7k. SCADA Operator Audit Trail
  router.get('/audit', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 100;
      const equipment = req.query.equipment || null;
      const audit = await getAuditTrail(limit, equipment);
      res.json({
        success: true,
        count: (audit || []).length,
        audit: audit || []
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7l. Maintenance Tickets Management
  router.get('/maintenance', async (req, res) => {
    try {
      const status = req.query.status || null;
      const limit = parseInt(req.query.limit, 10) || 50;
      const tickets = await getMaintenanceRecords(status, limit);
      // Map columns for frontend/backend flexibility
      const mapped = (tickets || []).map(t => ({
        id: t.id,
        ticket_id: t.ticket_id || `MNT-${String(t.id).padStart(4, '0')}`,
        equipment: t.equipment,
        title: t.issue || t.title,
        description: t.recommended_action || t.description || '',
        priority: t.severity || t.priority || 'MEDIUM',
        status: t.status || 'OPEN',
        created_at: t.detected_at || t.created_at,
        created_by: t.created_by || 'SCADA Operator',
        assigned_to: t.operator_action || t.assigned_to || 'Maintenance Team',
        resolved_at: t.closed_at || t.resolved_at || null,
        resolved_by: t.resolved_by || null,
        resolution_notes: t.operator_action || t.resolution_notes || null
      }));

      res.json({
        success: true,
        count: mapped.length,
        records: mapped,
        tickets: mapped
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/maintenance', async (req, res) => {
    try {
      const {
        id,
        equipment = 'P-101',
        title,
        issue,
        description,
        recommended_action,
        priority,
        severity = 'MEDIUM',
        assigned_to,
        operator_action = null,
        status = 'OPEN',
        created_by = 'Web Operator',
        operator = 'Web Operator'
      } = req.body || {};

      const finalIssue = title || issue || 'Equipment Inspection';
      const finalAction = description || recommended_action || '';
      const finalSev = priority || severity || 'MEDIUM';
      const finalAssignee = assigned_to || operator_action;

      if (id) {
        const updated = await updateMaintenanceStatus(id, { status, operator_action: finalAssignee });
        await recordEvent({
          event_type: 'MAINTENANCE',
          equipment: equipment || 'EQUIPMENT',
          tag: `TICKET_${id}`,
          new_value: status,
          message: `Maintenance ticket #${id} status changed to ${status}`,
          source: operator || created_by,
          result: 'SUCCESS'
        });
        return res.json({ success: true, id, status, updated });
      } else {
        const created = await createMaintenanceRecord({
          equipment,
          issue: finalIssue,
          severity: finalSev,
          recommended_action: finalAction,
          operator_action: finalAssignee,
          status
        });
        await recordEvent({
          event_type: 'MAINTENANCE',
          equipment,
          tag: `TICKET_${created.id}`,
          new_value: status,
          message: `New maintenance ticket created for ${equipment}: ${finalIssue}`,
          source: operator || created_by,
          result: 'SUCCESS'
        });
        return res.status(201).json({
          success: true,
          id: created.id,
          ticket_id: `MNT-${String(created.id).padStart(4, '0')}`,
          ...created
        });
      }
    } catch (err) {
      console.error('Error in /api/maintenance:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/maintenance/:id/status', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { status = 'RESOLVED', resolved_by = 'Web Operator', resolution_notes = '' } = req.body || {};
      const updated = await updateMaintenanceStatus(id, {
        status,
        operator_action: resolution_notes ? `${resolution_notes} (by ${resolved_by})` : null
      });

      await recordEvent({
        event_type: 'MAINTENANCE',
        equipment: 'SYSTEM',
        tag: `TICKET_${id}`,
        new_value: status,
        message: `Maintenance ticket #${id} updated to ${status} by ${resolved_by}`,
        source: resolved_by,
        result: 'SUCCESS'
      });

      res.json({ success: true, id, status, updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


  // 7n. Adjustable Process Workflow Endpoints
  router.get('/workflow', (req, res) => {
    try {
      const graph = simulator.getWorkflowGraph();
      res.json({
        success: true,
        workflow: graph,
        graph,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/workflow/update', async (req, res) => {
    try {
      const { nodes, connections, sequence, operator = 'Plant Operator' } = req.body || {};
      const updated = simulator.updateWorkflowGraph({ nodes, connections, sequence });

      await recordEvent({
        event_type: 'WORKFLOW_UPDATED',
        equipment: 'PROCESS_GRAPH',
        tag: 'WORKFLOW_CONFIG',
        message: `Process train workflow topology updated by ${operator}`,
        source: operator,
        result: updated.isValid ? 'SUCCESS' : 'WARNING'
      });

      res.json({
        success: true,
        workflow: updated,
        isValid: updated.isValid,
        validationMessage: updated.validationMessage,
        state: simulator.getState()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/workflow/reset', async (req, res) => {
    try {
      const { operator = 'Plant Operator' } = req.body || {};
      const resetGraph = simulator.resetWorkflowGraph();
      simulator.resetSimulation();
      if (setOperatorApprovedState) setOperatorApprovedState(false);

      await recordEvent({
        event_type: 'WORKFLOW_RESET',
        equipment: 'PROCESS_GRAPH',
        tag: 'WORKFLOW_DEFAULT',
        message: `Process workflow restored to standard P-101 -> E-101 -> R-101 -> D-101 configuration by ${operator}`,
        source: operator,
        result: 'SUCCESS'
      });

      res.json({
        success: true,
        message: 'Workflow restored to default engineering configuration P-101 -> E-101 -> R-101 -> D-101.',
        workflow: resetGraph,
        state: simulator.getState()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7m. Process Simulator Control Endpoints
  router.post('/simulator/control', async (req, res) => {
    try {
      const overrides = req.body || {};
      if (overrides.pump_rpm !== undefined) {
        simulator.executeRemoteCommand({ command: 'SET_RPM', equipment: 'P-101', params: { rpm: overrides.pump_rpm } });
      }
      if (overrides.heat_exchanger_efficiency !== undefined) {
        simulator.executeRemoteCommand({ command: 'SET_EFFICIENCY', equipment: 'E-101', params: { efficiency: overrides.heat_exchanger_efficiency } });
      }
      if (overrides.cooling_status !== undefined) {
        simulator.executeRemoteCommand({ command: 'SET_COOLING', equipment: 'R-101', params: { cooling_status: overrides.cooling_status } });
      }
      if (overrides.reflux_ratio !== undefined) {
        simulator.executeRemoteCommand({ command: 'SET_REFLUX', equipment: 'D-101', params: { reflux_ratio: overrides.reflux_ratio } });
      }
      if (overrides.agitator_speed !== undefined) {
        simulator.executeRemoteCommand({ command: 'SET_AGITATOR', equipment: 'R-101', params: { agitator_speed: overrides.agitator_speed } });
      }
      const state = simulator.getState();
      res.json({ status: 'success', message: 'Process simulation controls updated', controls: state.controls, state });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/simulator/reset', (req, res) => {
    try {
      simulator.resetSimulation();
      if (setOperatorApprovedState) setOperatorApprovedState(false);
      const state = simulator.getState();
      res.json({ status: 'success', message: 'Process controls reset to nominal', state });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

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
      const health = getCombinedAiHealth();
      res.json(health);
    } catch (err) {
      console.error('Error in /api/ai/health:', err);
      res.status(500).json({ provider: 'Gemini', configured: false, status: 'ERROR', error: err.message });
    }
  });

  // 9b. What-If Engineering Simulator Endpoint
  router.post('/ai/what-if', async (req, res) => {
    try {
      const {
        question = 'What happens if I increase pump speed to 2200 RPM?',
        currentState = null,
        conversation = [],
        history = [],
        scenarios = null
      } = req.body || {};

      const isHardwareOnline = Date.now() - hardwareState.lastSeen < hardwareState.timeoutMs;
      const activeFault = simulator.getFault();
      const useRealPump = isHardwareOnline && activeFault !== 'pump_fault' && activeFault !== 'early_pump_degradation';
      const useRealExchanger = isHardwareOnline && activeFault !== 'heat_exchanger_fault' && activeFault !== 'early_heat_exchanger_fouling';
      const simState = simulator.getState();
      const latestDiag = getLatestDiagnosis();
      const recentAlerts = await getRecentAlerts(5);

      const liveState = currentState || {
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

      const rawConversation = (Array.isArray(conversation) && conversation.length > 0)
        ? conversation
        : (Array.isArray(history) ? history : []);

      const cleanConversation = rawConversation
        .filter(turn => turn && (turn.content || turn.text || turn.message))
        .map(turn => ({
          role: (turn.role === 'user' || turn.sender === 'user') ? 'user' : 'assistant',
          content: String(turn.content || turn.text || turn.message)
        }));

      // Check if multi-scenario comparison was explicitly requested or parsed
      const parsed = WhatIf.parseScenarioFromQuery(question, cleanConversation, liveState);

      if ((scenarios && Array.isArray(scenarios) && scenarios.length >= 2) || (parsed.isMulti && parsed.scenarios && parsed.scenarios.length >= 2)) {
        const scenarioList = (scenarios && Array.isArray(scenarios) && scenarios.length >= 2) ? scenarios : parsed.scenarios;
        const multiResult = WhatIf.runMultiScenarioComparison(scenarioList, liveState);
        let explanation = '';
        let usedProvider = 'What-If Engine';

        try {
          const aiRes = await dispatchAiChat({
            provider: req.body?.provider || 'gemini',
            message: `The operator asked: "${question}". Here is the deterministic engineering simulation matrix:\n${JSON.stringify(multiResult, null, 2)}\nPlease compare the scenarios (A, B, C etc.), explain the physical mechanism behind the parameter changes, recommend which scenario appears preferable and WHY, and highlight verification checks.`,
            conversation: cleanConversation,
            liveState
          });
          if (aiRes?.response) {
            explanation = aiRes.response;
            usedProvider = aiRes.provider || 'AI Engine';
          }
        } catch (e) {
          console.warn('AI multi-scenario explanation fallback:', e.message);
        }

        if (!explanation) {
          explanation = `MULTI-SCENARIO COMPARISON:\nEvaluated ${scenarioList.length} options against baseline.\n` +
            multiResult.scenarios.map(s => `- ${s.label}: Flow = ${s.flow.toFixed(1)} L/min, Reactor Temp = ${s.reactorTemp.toFixed(1)}°C, Column Pressure = ${s.distPressure.toFixed(2)} bar, Risk = ${s.riskStage} (${s.riskScore}/100)`).join('\n') +
            `\nRecommendation: Choose the operational scenario that minimizes overall risk score and maintains reaction stability within the safe operating envelope.`;
        }

        return res.json({
          success: true,
          isMulti: true,
          multiComparison: multiResult,
          explanation,
          answer: explanation,
          response: explanation,
          provider: usedProvider,
          timestamp: new Date().toISOString()
        });
      }

      // Single Scenario Simulation
      const scenarioParam = parsed.scenario || {
        equipment: 'pump',
        equipment_name: 'P-101 Centrifugal Pump',
        variable: 'rpm',
        label: 'Pump Speed',
        unit: 'RPM',
        hypothetical_value: 2200,
        mode: 'set',
        description: 'Set P-101 pump rotational speed to 2200 RPM'
      };

      const simResult = WhatIf.runWhatIfSimulation(scenarioParam, liveState);

      // AI explanation via unified dispatch with deterministic results grounding
      let aiExplanation = '';
      let usedProvider = 'What-If Engine';

      try {
        const prompt = `The operator asked a hypothetical What-If process question: "${question}"\n\n` +
          `The deterministic chemical engineering flowsheet simulator calculated the following exact values (DO NOT INVENT DIFFERENT NUMBERS):\n` +
          `- Target: ${scenarioParam.equipment_name} (${scenarioParam.label} = ${scenarioParam.hypothetical_value} ${scenarioParam.unit})\n` +
          `- Current Flow: ${simResult.current.pump.flow.toFixed(1)} L/min -> Scenario Flow: ${simResult.predicted.pump.flow.toFixed(1)} L/min\n` +
          `- Current Reactor Temp: ${simResult.current.reactor.temperature.toFixed(1)} °C -> Scenario Reactor Temp: ${simResult.predicted.reactor.temperature.toFixed(1)} °C\n` +
          `- Current Column Press: ${simResult.current.distillation.pressure.toFixed(2)} bar -> Scenario Column Press: ${simResult.predicted.distillation.pressure.toFixed(2)} bar\n` +
          `- Current Risk: ${simResult.risk.currentStage} (${simResult.risk.currentScore}/100) -> Scenario Risk: ${simResult.risk.scenarioStage} (${simResult.risk.scenarioScore}/100)\n` +
          `- Impact Chain: ${simResult.impactChain.map(n => `${n.equipment}: ${n.parameter} (${n.from} -> ${n.to})`).join(' -> ')}\n\n` +
          `Explain the scenario clearly covering:\n1. What changed\n2. Why it changed\n3. Equipment affected\n4. Downstream consequences\n5. Risk change\n6. Possible benefits\n7. Possible risks\n8. Verification needed before applying`;

        const aiRes = await dispatchAiChat({
          provider: req.body?.provider || 'gemini',
          message: prompt,
          conversation: cleanConversation,
          liveState
        });

        if (aiRes?.response) {
          aiExplanation = aiRes.response;
          usedProvider = aiRes.provider || 'AI Engine';
        }
      } catch (aiErr) {
        console.warn('AI explanation failed, using deterministic what-if generator:', aiErr.message);
      }

      if (!aiExplanation || aiExplanation.trim().length === 0) {
        aiExplanation = WhatIf.generateWhatIfExplanation(simResult);
      }

      return res.json({
        success: true,
        isMulti: false,
        scenario: simResult.scenario,
        current: simResult.current,
        predicted: simResult.predicted,
        changes: simResult.changes,
        impactChain: simResult.impactChain,
        risk: simResult.risk,
        explanation: aiExplanation,
        answer: aiExplanation,
        response: aiExplanation,
        provider: usedProvider,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error in /api/ai/what-if:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to run What-If engineering simulation: ' + err.message
      });
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
        processContext = null,
        provider = 'gemini'
      } = req.body;

      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Message string is required' });
      }

      const actualUserMessage = message.trim();
      const rawConversation = (Array.isArray(conversation) && conversation.length > 0)
        ? conversation
        : (Array.isArray(history) ? history : []);

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

      // Safe dev logs for verifying conversation context flow (never logs keys/secrets)
      console.log("Conversation messages received:", cleanConversation.length);
      console.log("Current user message:", actualUserMessage);
      console.log("Requested AI provider:", provider);

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

      // Check if this is a What-If hypothetical question asked in the universal chat
      const qLower = actualUserMessage.toLowerCase();
      const isWhatIfQuestion =
        qLower.includes('what if') ||
        qLower.includes('what happens if') ||
        qLower.includes('what would happen') ||
        qLower.startsWith('compare ') ||
        (qLower.includes('if i increase') || qLower.includes('if i reduce') || qLower.includes('if i decrease') || qLower.includes('if i change')) ||
        (qLower.includes('what about ') && /\d{3,4}/.test(qLower));

      if (isWhatIfQuestion) {
        const parsed = WhatIf.parseScenarioFromQuery(actualUserMessage, cleanConversation, liveState);
        if (!parsed.unmatched) {
          if (parsed.isMulti && parsed.scenarios && parsed.scenarios.length >= 2) {
            const multiRes = WhatIf.runMultiScenarioComparison(parsed.scenarios, liveState);
            let explanation = '';
            let usedProvider = 'What-If Engine';

            try {
              const aiRes = await dispatchAiChat({
                provider,
                message: `User asked: "${actualUserMessage}". Deterministic Multi-Scenario Simulation results:\n${JSON.stringify(multiRes, null, 2)}\nCompare the scenarios and explain why the parameters changed.`,
                conversation: cleanConversation,
                liveState
              });
              if (aiRes?.response) {
                explanation = aiRes.response;
                usedProvider = aiRes.provider || 'AI Engine';
              }
            } catch (e) {
              console.warn('AI multi chat fallback:', e.message);
            }

            if (!explanation) {
              explanation = `MULTI-SCENARIO COMPARISON:\n` +
                multiRes.scenarios.map(s => `- ${s.label}: Flow = ${s.flow.toFixed(1)} L/min, Reactor Temp = ${s.reactorTemp.toFixed(1)}°C, Risk = ${s.riskStage} (${s.riskScore}/100)`).join('\n');
            }

            return res.json({
              success: true,
              response: explanation,
              answer: explanation,
              whatIf: multiRes,
              provider: usedProvider,
              timestamp: new Date().toISOString()
            });
          } else {
            const simRes = WhatIf.runWhatIfSimulation(parsed.scenario, liveState);
            let explanation = '';
            let usedProvider = 'What-If Engine';

            try {
              const prompt = `The operator asked What-If question: "${actualUserMessage}"\n\n` +
                `Deterministic Simulation Results (DO NOT INVENT DIFFERENT NUMBERS):\n` +
                `- Flow: ${simRes.current.pump.flow.toFixed(1)} -> ${simRes.predicted.pump.flow.toFixed(1)} L/min\n` +
                `- Reactor Temp: ${simRes.current.reactor.temperature.toFixed(1)} -> ${simRes.predicted.reactor.temperature.toFixed(1)} °C\n` +
                `- Column Press: ${simRes.current.distillation.pressure.toFixed(2)} -> ${simRes.predicted.distillation.pressure.toFixed(2)} bar\n` +
                `- Risk: ${simRes.risk.currentStage} (${simRes.risk.currentScore}/100) -> ${simRes.risk.scenarioStage} (${simRes.risk.scenarioScore}/100)\n\n` +
                `Explain: 1. What changed, 2. Why, 3. Equipment affected, 4. Downstream consequences, 5. Risk change, 6. Benefits, 7. Risks, 8. Verifications before applying.`;

              const aiRes = await dispatchAiChat({
                provider,
                message: prompt,
                conversation: cleanConversation,
                liveState
              });

              if (aiRes?.response) {
                explanation = aiRes.response;
                usedProvider = aiRes.provider || 'AI Engine';
              }
            } catch (e) {
              console.warn('AI chat what-if fallback:', e.message);
            }

            if (!explanation) {
              explanation = WhatIf.generateWhatIfExplanation(simRes);
            }

            return res.json({
              success: true,
              response: explanation,
              answer: explanation,
              whatIf: simRes,
              provider: usedProvider,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // Universal Engineering & Process Chat via AI Dispatcher
      const chatResult = await dispatchAiChat({
        provider,
        message: actualUserMessage,
        conversation: cleanConversation,
        processContext: processContext || liveState,
        liveState,
        selectedEquipment: selectedEquipment || equipment
      });

      return res.json(chatResult);
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
