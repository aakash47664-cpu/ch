/**
 * ChemDiag AI — Dynamic Process Simulation & Intelligent Alert Engine
 * 
 * Process Train:
 * WATER SOURCE -> P-101 PUMP -> E-101 HEAT EXCHANGER -> R-101 CSTR REACTOR -> D-101 DISTILLATION -> PRODUCTS
 */

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function noise(magnitude = 0.02) {
  return (Math.random() - 0.5) * 2 * magnitude;
}

export class ProcessSimulator {
  constructor() {
    this.currentFault = 'normal';
    this.faultTicks = 0;
    this.faultSeverity = 0.0;
    this.isPaused = false;

    // Hardware stream hook (ESP32)
    this.externalHardwareState = null;

    // Unit States
    this.pump = {
      status: 'RUNNING',
      rpm: 2450,
      vibration: 0.08,
      flow: 10.0, // L/min
      suction_pressure: 1.01, // bar
      discharge_pressure: 2.80, // bar
      inlet_temperature: 25.2, // °C
      outlet_temperature: 38.1, // °C
      health: 100
    };

    this.heatExchanger = {
      status: 'NORMAL',
      flow: 9.9, // L/min
      efficiency: 95.0, // %
      inlet_temperature: 25.2,
      outlet_temperature: 38.1,
      temperature_difference: 12.9, // °C
      heat_transfer_indicator: 95.0,
      health: 100
    };

    this.reactor = {
      status: 'NORMAL',
      feed_flow: 9.8, // L/min
      temperature: 65.0, // °C
      pressure: 2.05, // bar
      level: 50.0, // %
      agitator_speed: 350, // RPM
      cooling_status: 1, // 1 = ON, 0 = OFF
      health: 100
    };

    this.distillation = {
      status: 'NORMAL',
      feed_flow: 9.7, // L/min
      top_temperature: 76.5, // °C
      bottom_temperature: 98.4, // °C
      pressure: 2.10, // bar
      level: 52.0, // %
      reflux_ratio: 1.85, // L/D
      health: 100
    };

    // Internal Dynamic Lag Storage
    this.lags = {
      pumpRpm: 2450,
      pumpFlow: 10.0,
      hxFlow: 9.9,
      reactorFlow: 9.8,
      distFlow: 9.7
    };

    // Simulation / What-If Parameter Overrides (Adjustable by operator for experimentation)
    this.userControls = {
      pump_rpm: null,
      heat_exchanger_efficiency: null,
      cooling_status: null,
      reflux_ratio: null,
      agitator_speed: null
    };

    // Central Process Graph Model
    this.processGraph = this.createDefaultProcessGraph();

    // Intelligent Alerts State Repository
    this.alerts = {
      P101_HIGH_VIBRATION: {
        id: 'P101_HIGH_VIBRATION',
        alert_key: 'P101_HIGH_VIBRATION',
        equipment: 'P-101',
        title: 'High Pump Casing Vibration',
        parameter: 'Casing Vibration',
        current_value: '0.08 g',
        expected_range: '< 0.20 g',
        unit: 'g',
        severity: 'NORMAL',
        status: 'CLEARED',
        explanation: 'Pump casing mechanical vibration exceeds nominal baseline limits.',
        likely_cause: 'Bearing wear, impeller unbalance, or cavitation onset.',
        process_impact: 'Risk of accelerated mechanical seal failure and train feed drop.',
        related_effects: [],
        persistence: 0,
        requiredTicks: 2,
        clearTicks: 0,
        triggered_at: null,
        acknowledged_at: null,
        acknowledged_by: null,
        cleared_at: null
      },
      P101_PERF_DEVIATION: {
        id: 'P101_PERF_DEVIATION',
        alert_key: 'P101_PERF_DEVIATION',
        equipment: 'P-101',
        title: 'Pump Hydraulic Performance Deviation',
        parameter: 'Discharge Flow Rate',
        current_value: '10.0 L/min',
        expected_range: '8.5 - 11.5 L/min',
        unit: 'L/min',
        severity: 'NORMAL',
        status: 'CLEARED',
        explanation: 'Discharge fluid throughput is lower than expected for current rotational speed.',
        likely_cause: 'Suction strainer obstruction or impeller vane wear.',
        process_impact: 'Reduced feedstock throughput propagating downstream to E-101 and R-101.',
        related_effects: [],
        persistence: 0,
        requiredTicks: 3,
        clearTicks: 0,
        triggered_at: null,
        acknowledged_at: null,
        acknowledged_by: null,
        cleared_at: null
      },
      E101_THERMAL_FOULING: {
        id: 'E101_THERMAL_FOULING',
        alert_key: 'E101_THERMAL_FOULING',
        equipment: 'E-101',
        title: 'Heat Exchanger Thermal Fouling',
        parameter: 'Thermal Gradient (ΔT)',
        current_value: '12.9 °C',
        expected_range: '6.0 - 15.0 °C (> 75%)',
        unit: '°C',
        severity: 'NORMAL',
        status: 'CLEARED',
        explanation: 'Heat transfer efficiency and temperature gradient have deteriorated below threshold.',
        likely_cause: 'Particulate scaling or bio-fouling film on tube bundle surface.',
        process_impact: 'Conditioned fluid enters CSTR R-101 below target reaction temperature.',
        related_effects: [],
        persistence: 0,
        requiredTicks: 3,
        clearTicks: 0,
        triggered_at: null,
        acknowledged_at: null,
        acknowledged_by: null,
        cleared_at: null
      },
      R101_THERMAL_RUNAWAY: {
        id: 'R101_THERMAL_RUNAWAY',
        alert_key: 'R101_THERMAL_RUNAWAY',
        equipment: 'R-101',
        title: 'Exothermic Core Thermal Escalation',
        parameter: 'Reactor Core Temperature',
        current_value: '65.0 °C',
        expected_range: '60.0 - 72.0 °C',
        unit: '°C',
        severity: 'NORMAL',
        status: 'CLEARED',
        explanation: 'Exothermic Arrhenius reaction kinetics generating heat faster than jacket dissipation.',
        likely_cause: 'Cooling jacket limitation or feed enthalpy surge.',
        process_impact: 'Vessel vapor pressure rise and potential thermal runaway.',
        related_effects: [],
        persistence: 0,
        requiredTicks: 2,
        clearTicks: 0,
        triggered_at: null,
        acknowledged_at: null,
        acknowledged_by: null,
        cleared_at: null
      },
      R101_COOLING_FAILURE: {
        id: 'R101_COOLING_FAILURE',
        alert_key: 'R101_COOLING_FAILURE',
        equipment: 'R-101',
        title: 'Reactor Cooling System Failure',
        parameter: 'Cooling Jacket Relay',
        current_value: 'ACTIVE (1)',
        expected_range: 'ACTIVE (1)',
        unit: '',
        severity: 'NORMAL',
        status: 'CLEARED',
        explanation: 'Cooling jacket flow has ceased while reactor operates with exothermic feed.',
        likely_cause: 'Cooling supply valve trip, pump failure, or utility outage.',
        process_impact: 'Immediate escalation towards runaway temperature limit.',
        related_effects: [],
        persistence: 0,
        requiredTicks: 2,
        clearTicks: 0,
        triggered_at: null,
        acknowledged_at: null,
        acknowledged_by: null,
        cleared_at: null
      },
      R101_OVERPRESSURE: {
        id: 'R101_OVERPRESSURE',
        alert_key: 'R101_OVERPRESSURE',
        equipment: 'R-101',
        title: 'Reactor Vessel Overpressure',
        parameter: 'Internal Vessel Pressure',
        current_value: '2.05 bar',
        expected_range: '1.80 - 2.40 bar',
        unit: 'bar',
        severity: 'NORMAL',
        status: 'CLEARED',
        explanation: 'Vapor pressure accumulation exceeds normal operating envelope.',
        likely_cause: 'Elevated core temperature vaporizing volatile components.',
        process_impact: 'Safety relief valve approach and downstream pressure surge to D-101.',
        related_effects: [],
        persistence: 0,
        requiredTicks: 2,
        clearTicks: 0,
        triggered_at: null,
        acknowledged_at: null,
        acknowledged_by: null,
        cleared_at: null
      },
      D101_REFLUX_STARVATION: {
        id: 'D101_REFLUX_STARVATION',
        alert_key: 'D101_REFLUX_STARVATION',
        equipment: 'D-101',
        title: 'Distillation Reflux Loss & Starvation',
        parameter: 'Reflux Ratio (L/D)',
        current_value: '1.85',
        expected_range: '1.50 - 2.20',
        unit: '',
        severity: 'NORMAL',
        status: 'CLEARED',
        explanation: 'Overhead reflux ratio has fallen below minimum fractionation boundary.',
        likely_cause: 'Reflux pump loss, control valve restriction, or condenser undercooling.',
        process_impact: 'Overhead vapor temperature rises, causing product purity drop.',
        related_effects: [],
        persistence: 0,
        requiredTicks: 3,
        clearTicks: 0,
        triggered_at: null,
        acknowledged_at: null,
        acknowledged_by: null,
        cleared_at: null
      },
      ESP32_SENSOR_QUALITY: {
        id: 'ESP32_SENSOR_QUALITY',
        alert_key: 'ESP32_SENSOR_QUALITY',
        equipment: 'ESP32',
        title: 'ESP32 Telemetry Quality Alert',
        parameter: 'Sensor Data Stream',
        current_value: 'OFFLINE',
        expected_range: 'CONNECTED',
        unit: '',
        severity: 'NORMAL',
        status: 'CLEARED',
        explanation: 'Hardware sensor transceiver connection lost or telemetry packets stale.',
        likely_cause: 'Wi-Fi disconnect, power cycle, or serial transceiver timeout.',
        process_impact: 'Fallback to continuous digital twin simulation active.',
        related_effects: [],
        persistence: 0,
        requiredTicks: 3,
        clearTicks: 0,
        triggered_at: null,
        acknowledged_at: null,
        acknowledged_by: null,
        cleared_at: null
      }
    };

    // Alert History Array (cleared and acknowledged alerts)
    this.alertHistory = [];

    // Process streams
    this.streams = this.calculateStreams();
  }

  createDefaultProcessGraph() {
    return {
      nodes: {
        'P-101': {
          id: 'P-101',
          equipmentId: 'pump',
          name: 'Centrifugal Feed Pump',
          type: 'PUMP',
          enabled: true,
          role: 'PRIMARY_SOURCE',
          upstreamUnit: 'Raw Water Tank (Feed)',
          downstreamUnit: 'E-101 (Heat Exchanger)',
          inputs: ['Raw Water Tank / Suction Line'],
          outputs: ['Stream 02 (Pump Discharge)'],
          parameters: { rpm: 2450, vibration: 0.08, flow: 10.0 }
        },
        'E-101': {
          id: 'E-101',
          equipmentId: 'heat_exchanger',
          name: 'Shell & Tube Exchanger',
          type: 'HEAT_EXCHANGER',
          enabled: true,
          role: 'NOMINAL',
          upstreamUnit: 'P-101 (Feed Pump)',
          downstreamUnit: 'R-101 (CSTR Reactor)',
          inputs: ['Stream 02 (Pump Discharge)'],
          outputs: ['Stream 03 (Conditioned Effluent)'],
          parameters: { efficiency: 95.0, deltaT: 12.9, outletTemp: 38.1 }
        },
        'R-101': {
          id: 'R-101',
          equipmentId: 'reactor',
          name: 'CSTR Reactor',
          type: 'CSTR',
          enabled: true,
          role: 'NOMINAL',
          upstreamUnit: 'E-101 (Heat Exchanger)',
          downstreamUnit: 'D-101 (Distillation Column)',
          inputs: ['Stream 03 (Conditioned Effluent)'],
          outputs: ['Stream 04 (Reaction Effluent)'],
          parameters: { temperature: 65.0, pressure: 2.05, cooling: 1, agitatorSpeed: 350 }
        },
        'D-101': {
          id: 'D-101',
          equipmentId: 'distillation',
          name: 'Distillation Column',
          type: 'DISTILLATION',
          enabled: true,
          role: 'NOMINAL',
          upstreamUnit: 'R-101 (CSTR Reactor)',
          downstreamUnit: 'Product Tank / Storage',
          inputs: ['Stream 04 (Reaction Effluent)'],
          outputs: ['Stream 05 (Overhead Distillate)', 'Stream 06 (Bottoms Product)'],
          parameters: { refluxRatio: 1.85, topTemp: 76.5, bottomTemp: 98.4, pressure: 2.10 }
        }
      },
      sequence: ['P-101', 'E-101', 'R-101', 'D-101'],
      connections: [
        { id: 'P101_E101', from: 'P-101', to: 'E-101', fromPort: 'outlet', toPort: 'inlet', streamId: '02', flow: 10.0, status: 'CONNECTED', valid: true },
        { id: 'E101_R101', from: 'E-101', to: 'R-101', fromPort: 'outlet', toPort: 'inlet', streamId: '03', flow: 9.9, status: 'CONNECTED', valid: true },
        { id: 'R101_D101', from: 'R-101', to: 'D-101', fromPort: 'outlet', toPort: 'inlet', streamId: '04', flow: 9.8, status: 'CONNECTED', valid: true }
      ],
      availableTypes: [
        { type: 'PUMP', name: 'Centrifugal Pump', defaultTag: 'P-102', description: 'Liquid feed pressurization and flow driver', maxInputs: 1, maxOutputs: 1 },
        { type: 'HEAT_EXCHANGER', name: 'Shell & Tube Exchanger', defaultTag: 'E-102', description: 'Counter-flow thermal conditioning', maxInputs: 1, maxOutputs: 1 },
        { type: 'CSTR', name: 'Continuous Stirred Tank', defaultTag: 'R-102', description: 'Exothermic jacketed chemical conversion', maxInputs: 1, maxOutputs: 1 },
        { type: 'DISTILLATION', name: 'Fractionation Column', defaultTag: 'D-102', description: 'Vapor-liquid binary separation', maxInputs: 1, maxOutputs: 2 },
        { type: 'TANK', name: 'Buffer Storage Tank', defaultTag: 'T-101', description: 'Surge buffering and inventory hold-up', maxInputs: 2, maxOutputs: 2 },
        { type: 'VALVE', name: 'Control Valve', defaultTag: 'V-101', description: 'In-line pressure drop and flow throttling', maxInputs: 1, maxOutputs: 1 },
        { type: 'COMPRESSOR', name: 'Gas Compressor', defaultTag: 'C-101', description: 'Vapor compression and head boost', maxInputs: 1, maxOutputs: 1 },
        { type: 'SEPARATOR', name: 'Flash Separator', defaultTag: 'S-101', description: 'Gravity vapor-liquid phase flash split', maxInputs: 1, maxOutputs: 2 },
        { type: 'HEATER', name: 'Fired Heater', defaultTag: 'H-101', description: 'Direct thermal enthalpy input', maxInputs: 1, maxOutputs: 1 },
        { type: 'COOLER', name: 'Utility Cooler', defaultTag: 'CLR-101', description: 'Cooling water heat dissipation', maxInputs: 1, maxOutputs: 1 },
        { type: 'MIXER', name: 'In-Line Mixer', defaultTag: 'M-101', description: 'Multi-stream blending manifold', maxInputs: 2, maxOutputs: 1 },
        { type: 'PFR', name: 'Plug Flow Reactor', defaultTag: 'PFR-101', description: 'Tubular continuous conversion reactor', maxInputs: 1, maxOutputs: 1 }
      ],
      isValid: true,
      validationMessage: 'Process flow train is continuous and valid.'
    };
  }

  getWorkflowGraph() {
    return this.processGraph;
  }

  validateWorkflow(nodes, connections, sequence) {
    if (!sequence || sequence.length === 0) {
      return { isValid: false, message: 'Workflow must contain at least one active process unit.' };
    }
    if (!nodes || !nodes['P-101'] || nodes['P-101'].enabled === false) {
      return { isValid: false, message: 'Train must include an active feed pump (P-101) to supply hydraulic motive force.' };
    }
    // Check continuous flow path for active sequence
    for (let i = 0; i < sequence.length - 1; i++) {
      const fromId = sequence[i];
      const toId = sequence[i + 1];
      const hasConn = (connections || []).some(c => c.from === fromId && c.to === toId);
      if (!hasConn) {
        return { isValid: false, message: `Missing connection between [${fromId}] and [${toId}]. Train is discontinuous.` };
      }
    }
    return { isValid: true, message: 'Process flow train is continuous and valid.' };
  }

  updateWorkflowGraph({ nodes, connections, sequence }) {
    const updatedNodes = nodes || this.processGraph.nodes;
    const updatedConnections = connections || this.processGraph.connections;
    const updatedSequence = sequence || this.processGraph.sequence;

    const validation = this.validateWorkflow(updatedNodes, updatedConnections, updatedSequence);

    // Update upstream/downstream metadata on nodes
    Object.keys(updatedNodes).forEach(nodeId => {
      const node = updatedNodes[nodeId];
      const incoming = updatedConnections.filter(c => c.to === nodeId).map(c => c.from);
      const outgoing = updatedConnections.filter(c => c.from === nodeId).map(c => c.to);
      node.upstreamUnit = incoming.length > 0 ? incoming.join(', ') : 'None / Source Feed';
      node.downstreamUnit = outgoing.length > 0 ? outgoing.join(', ') : 'None / Terminal Drain';
    });

    this.processGraph = {
      ...this.processGraph,
      nodes: updatedNodes,
      connections: updatedConnections,
      sequence: updatedSequence,
      isValid: validation.isValid,
      validationMessage: validation.message
    };

    return this.processGraph;
  }

  resetWorkflowGraph() {
    this.processGraph = this.createDefaultProcessGraph();
    this.resetUserControls();
    return this.processGraph;
  }

  executeRemoteCommand({ command, equipment, params = {} }) {
    if (command === 'SET_RPM' || (equipment === 'P-101' && params.rpm !== undefined)) {
      this.userControls.pump_rpm = Number(params.rpm);
    } else if (command === 'SET_EFFICIENCY' || (equipment === 'E-101' && params.efficiency !== undefined)) {
      this.userControls.heat_exchanger_efficiency = Number(params.efficiency);
    } else if (command === 'SET_COOLING' || (equipment === 'R-101' && params.cooling_status !== undefined)) {
      this.userControls.cooling_status = Number(params.cooling_status);
    } else if (command === 'SET_AGITATOR' || (equipment === 'R-101' && params.agitator_speed !== undefined)) {
      this.userControls.agitator_speed = Number(params.agitator_speed);
    } else if (command === 'SET_REFLUX' || (equipment === 'D-101' && params.reflux_ratio !== undefined)) {
      this.userControls.reflux_ratio = Number(params.reflux_ratio);
    } else if (command === 'RESET_CONTROLS') {
      this.resetUserControls();
    }
    return this.getState();
  }

  resetUserControls() {
    this.userControls = {
      pump_rpm: null,
      heat_exchanger_efficiency: null,
      cooling_status: null,
      reflux_ratio: null,
      agitator_speed: null
    };
  }

  setUserControls(controls = {}) {
    if (controls.pump_rpm !== undefined) this.userControls.pump_rpm = controls.pump_rpm;
    if (controls.heat_exchanger_efficiency !== undefined) this.userControls.heat_exchanger_efficiency = controls.heat_exchanger_efficiency;
    if (controls.cooling_status !== undefined) this.userControls.cooling_status = controls.cooling_status;
    if (controls.reflux_ratio !== undefined) this.userControls.reflux_ratio = controls.reflux_ratio;
    if (controls.agitator_speed !== undefined) this.userControls.agitator_speed = controls.agitator_speed;
    return this.userControls;
  }

  getUserControls() {
    return this.userControls;
  }

  setHardwareState(hw) {
    this.externalHardwareState = hw;
  }

  setFault(fault) {
    this.currentFault = fault;
    this.faultTicks = 0;
    this.faultSeverity = 0.0;
  }

  getFault() {
    return this.currentFault;
  }

  getFaultTicks() {
    return this.faultTicks;
  }

  getFaultSeverity() {
    return this.faultSeverity;
  }

  // ---------------------------------------------------------------------------
  // 1-SECOND DYNAMIC SIMULATION TIMESTEP & CAUSAL MASS BALANCE PROPAGATION
  // ---------------------------------------------------------------------------
  tick() {
    if (this.isPaused) return this.getState();

    this.faultTicks++;
    const fault = this.currentFault;
    const t = this.faultTicks;

    // 1. Fault Severity Progression
    if (fault === 'normal') {
      this.faultSeverity = Math.max(0.0, this.faultSeverity - 0.15);
    } else if (fault.startsWith('early_')) {
      const targetSev = 0.25;
      this.faultSeverity += (targetSev - this.faultSeverity) * 0.25;
      this.faultSeverity = clamp(this.faultSeverity, 0.0, 0.35);
    } else if (fault === 'unknown_fault') {
      const targetSev = 0.48;
      this.faultSeverity += (targetSev - this.faultSeverity) * 0.3;
      this.faultSeverity = clamp(this.faultSeverity, 0.0, 0.60);
    } else {
      const targetSev = Math.min(1.0, 0.20 + (t / 10) * 0.80);
      this.faultSeverity += (targetSev - this.faultSeverity) * 0.35;
      this.faultSeverity = clamp(this.faultSeverity, 0.0, 1.0);
    }

    const s = this.faultSeverity;

    // -------------------------------------------------------------------------
    // 2. P-101 PUMP DYNAMICS & CAUSAL FLOW GENERATION
    // -------------------------------------------------------------------------
    // Base nominal or operator-adjusted RPM
    const baseRpm = this.userControls.pump_rpm !== null ? this.userControls.pump_rpm : 2450;
    let targetRpm = baseRpm;
    let targetVib = 0.08;

    if (fault === 'early_pump_degradation') {
      targetRpm = baseRpm - s * (baseRpm - 2150);
      targetVib = 0.08 + s * (0.28 - 0.08);
    } else if (fault === 'pump_fault') {
      targetRpm = baseRpm - s * (baseRpm - 1580);
      targetVib = 0.08 + s * (0.64 - 0.08);
    } else if (fault === 'unknown_fault') {
      targetRpm = baseRpm - s * (baseRpm - 2250);
      targetVib = 0.08 + s * (0.35 - 0.08);
    }

    // Dynamic lag on RPM (first-order dynamic response)
    const tauRpm = 1.8;
    this.lags.pumpRpm += (targetRpm - this.lags.pumpRpm) / tauRpm;
    this.pump.rpm = Math.round(clamp(this.lags.pumpRpm + noise(8), 0, 3500));

    // Vibration dynamics
    this.pump.vibration += (targetVib - this.pump.vibration) * 0.30 + noise(0.01);
    this.pump.vibration = Number(clamp(this.pump.vibration, 0.04, 1.20).toFixed(2));

    // Deterministic flow function: Q = (RPM / 2450) * 10.0 L/min
    const theoreticalFlow = (this.pump.rpm / 2450) * 10.0;
    const tauFlow = 1.5;
    this.lags.pumpFlow += (theoreticalFlow - this.lags.pumpFlow) / tauFlow;
    this.pump.flow = Number(clamp(this.lags.pumpFlow + noise(0.05), 0.0, 16.0).toFixed(1));

    // Hydraulic pressures
    const pDischarge = this.pump.flow > 0.5 ? clamp(1.01 + (this.pump.flow / 10.0) * 1.79, 1.01, 3.80) : 1.01;
    this.pump.discharge_pressure = Number(pDischarge.toFixed(2));
    this.pump.suction_pressure = Number((1.01 - (this.pump.flow / 10.0) * 0.08).toFixed(2));

    // Pump fluid temperatures
    this.pump.inlet_temperature = Number((25.2 + noise(0.1)).toFixed(1));
    const pumpHeatGeneration = this.pump.flow > 0.5 ? 12.9 * (1.0 + (this.pump.vibration - 0.08) * 2.5) : 0.0;
    this.pump.outlet_temperature = Number((this.pump.inlet_temperature + pumpHeatGeneration).toFixed(1));
    this.pump.health = Math.max(0, Math.round(100 - (this.pump.vibration - 0.08) * 160));
    this.pump.status = this.pump.vibration > 0.40 ? 'CRITICAL' : (this.pump.vibration > 0.20 ? 'WARNING' : 'RUNNING');

    // -------------------------------------------------------------------------
    // 3. E-101 HEAT EXCHANGER CAUSAL DYNAMICS
    // -------------------------------------------------------------------------
    // Determine inlet flow and temp from upstream connected unit in the process graph
    const isHxEnabled = this.processGraph?.nodes?.['E-101']?.enabled !== false;
    const hxUpstreamFlow = isHxEnabled ? this.pump.flow : 0.0;
    const hxInletTemp = this.pump.outlet_temperature;

    const tauHxFlow = 2.0;
    this.lags.hxFlow += (hxUpstreamFlow * 0.99 - this.lags.hxFlow) / tauHxFlow;
    this.heatExchanger.flow = Number(clamp(this.lags.hxFlow, 0.0, 16.0).toFixed(1));

    const baseEff = this.userControls.heat_exchanger_efficiency !== null ? this.userControls.heat_exchanger_efficiency : 95.0;
    let targetEff = baseEff;
    if (fault === 'early_heat_exchanger_fouling') {
      targetEff = baseEff - s * (baseEff - 68.0);
    } else if (fault === 'heat_exchanger_fault') {
      targetEff = baseEff - s * (baseEff - 28.0);
    }

    this.heatExchanger.efficiency += (targetEff - this.heatExchanger.efficiency) * 0.25;
    this.heatExchanger.efficiency = Number(clamp(this.heatExchanger.efficiency, 10.0, 100.0).toFixed(1));

    this.heatExchanger.inlet_temperature = hxInletTemp;
    const deltaTNominal = this.heatExchanger.flow > 0.5 ? (12.9 * (this.heatExchanger.efficiency / 95.0) * Math.sqrt(this.heatExchanger.flow / 10.0)) : 0.0;
    this.heatExchanger.temperature_difference += (deltaTNominal - this.heatExchanger.temperature_difference) * 0.35 + noise(0.08);
    this.heatExchanger.temperature_difference = Number(clamp(this.heatExchanger.temperature_difference, 0.0, 25.0).toFixed(1));
    this.heatExchanger.outlet_temperature = Number((this.heatExchanger.inlet_temperature - this.heatExchanger.temperature_difference).toFixed(1));
    this.heatExchanger.heat_transfer_indicator = this.heatExchanger.efficiency;
    this.heatExchanger.health = Math.round(this.heatExchanger.efficiency);
    this.heatExchanger.status = this.heatExchanger.efficiency < 40.0 ? 'CRITICAL' : (this.heatExchanger.efficiency < 65.0 ? 'WARNING' : 'NORMAL');

    // -------------------------------------------------------------------------
    // 4. R-101 CSTR REACTOR CAUSAL DYNAMICS (Exothermic Kinetics)
    // -------------------------------------------------------------------------
    // Determine inlet flow and temp from upstream connected unit in the process graph
    const isRxEnabled = this.processGraph?.nodes?.['R-101']?.enabled !== false;
    const rxUpstreamFlow = isRxEnabled ? this.heatExchanger.flow : 0.0;
    const rxInletTemp = this.heatExchanger.outlet_temperature;

    const tauRxFlow = 2.4;
    this.lags.reactorFlow += (rxUpstreamFlow * 0.99 - this.lags.reactorFlow) / tauRxFlow;
    this.reactor.feed_flow = Number(clamp(this.lags.reactorFlow, 0.0, 16.0).toFixed(1));

    let coolingActive = this.userControls.cooling_status !== null ? this.userControls.cooling_status : 1;
    if (fault === 'reactor_cooling_failure') {
      coolingActive = 0;
    } else if (fault === 'early_reactor_cooling_degradation') {
      coolingActive = s > 0.4 ? 0 : (this.userControls.cooling_status !== null ? this.userControls.cooling_status : 1);
    }
    this.reactor.cooling_status = coolingActive;

    const baseAgitator = this.userControls.agitator_speed !== null ? this.userControls.agitator_speed : 350;
    this.reactor.agitator_speed = Math.round(baseAgitator + noise(4));

    // Arrhenius Kinetics with Feed Flow and Enthalpy Coupling
    const kArrhenius = 0.045 * Math.exp(0.035 * (this.reactor.temperature - 65.0));
    const qGen = this.reactor.feed_flow > 0.5 ? kArrhenius * 320.0 : 0.0;
    const qCooling = coolingActive === 1 ? (this.reactor.feed_flow > 0.5 ? 320.0 * (this.reactor.temperature - 20.0) / 45.0 : 0.0) : 40.0;
    const netHeat = qGen - qCooling;

    // Upstream thermal effect from E-101
    const thermalEnthalpyEffect = (rxInletTemp - 25.2) * 0.22;

    const targetRxTemp = this.reactor.feed_flow > 0.5
      ? (coolingActive === 1 ? (65.0 + s * 12.0 + thermalEnthalpyEffect) : (65.0 + s * 34.0 + thermalEnthalpyEffect))
      : 25.0;

    this.reactor.temperature += (targetRxTemp - this.reactor.temperature) * 0.25 + (this.reactor.feed_flow > 0.5 ? netHeat * 0.008 : 0) + noise(0.1);
    this.reactor.temperature = Number(clamp(this.reactor.temperature, 20.0, 115.0).toFixed(1));

    // Antoine vapor-liquid pressure
    const antoineVaporP = Math.exp(10.2 - 2800 / (this.reactor.temperature + 273.15)) * 0.15;
    const targetRxPress = this.reactor.feed_flow > 0.5 ? clamp(1.01 + antoineVaporP, 1.01, 5.0) : 1.01;
    this.reactor.pressure += (targetRxPress - this.reactor.pressure) * 0.30 + noise(0.01);
    this.reactor.pressure = Number(clamp(this.reactor.pressure, 1.01, 5.0).toFixed(2));

    const nominalLevel = this.reactor.feed_flow > 0.2 ? clamp(50.0 + (this.reactor.feed_flow - 10.0) * 1.5, 20.0, 90.0) : 0.0;
    this.reactor.level += (nominalLevel - this.reactor.level) * 0.20;
    this.reactor.level = Number(clamp(this.reactor.level, 0.0, 100.0).toFixed(1));
    this.reactor.health = Math.max(0, Math.round(100 - Math.max(0, this.reactor.temperature - 65.0) * 4));
    this.reactor.status = this.reactor.temperature > 85.0 || this.reactor.cooling_status === 0 ? 'CRITICAL' : (this.reactor.temperature > 74.0 ? 'WARNING' : 'NORMAL');

    // -------------------------------------------------------------------------
    // 5. D-101 DISTILLATION COLUMN CAUSAL DYNAMICS
    // -------------------------------------------------------------------------
    // Determine inlet flow and temp from upstream connected unit in the process graph
    const isDistEnabled = this.processGraph?.nodes?.['D-101']?.enabled !== false;
    const distUpstreamFlow = isDistEnabled ? this.reactor.feed_flow : 0.0;
    const distInletTemp = this.reactor.temperature;

    const tauDistFlow = 2.4;
    this.lags.distFlow += (distUpstreamFlow * 0.99 - this.lags.distFlow) / tauDistFlow;
    this.distillation.feed_flow = Number(clamp(this.lags.distFlow, 0.0, 16.0).toFixed(1));

    const baseReflux = this.userControls.reflux_ratio !== null ? this.userControls.reflux_ratio : 1.85;
    let targetReflux = baseReflux;
    if (fault === 'early_distillation_reflux_loss') {
      targetReflux = baseReflux - s * (baseReflux - 1.30);
    } else if (fault === 'distillation_fault') {
      targetReflux = baseReflux - s * (baseReflux - 0.60);
    }

    this.distillation.reflux_ratio += (targetReflux - this.distillation.reflux_ratio) * 0.35 + noise(0.02);
    this.distillation.reflux_ratio = Number(clamp(this.distillation.reflux_ratio, 0.35, 4.0).toFixed(2));

    const refluxLossEffect = (1.85 - this.distillation.reflux_ratio) * 6.5;
    const rxTempThermalEffect = (distInletTemp - 65.0) * 0.18;

    const nomTopTemp = this.distillation.feed_flow > 0.5 ? (76.5 + refluxLossEffect + rxTempThermalEffect) : 25.0;
    const nomBottomTemp = this.distillation.feed_flow > 0.5 ? (98.4 + (distInletTemp - 65.0) * 0.12) : 25.0;
    const nomColPress = this.distillation.feed_flow > 0.5 ? (2.10 + refluxLossEffect * 0.55 + rxTempThermalEffect * 0.03) : 1.01;

    this.distillation.top_temperature += (nomTopTemp - this.distillation.top_temperature) * 0.35 + (this.distillation.feed_flow > 0.5 ? noise(0.1) : 0);
    this.distillation.bottom_temperature += (nomBottomTemp - this.distillation.bottom_temperature) * 0.30 + (this.distillation.feed_flow > 0.5 ? noise(0.08) : 0);
    this.distillation.pressure += (nomColPress - this.distillation.pressure) * 0.35 + (this.distillation.feed_flow > 0.5 ? noise(0.015) : 0);

    this.distillation.top_temperature = Number(clamp(this.distillation.top_temperature, 20.0, 98.0).toFixed(1));
    this.distillation.bottom_temperature = Number(clamp(this.distillation.bottom_temperature, 20.0, 118.0).toFixed(1));
    this.distillation.pressure = Number(clamp(this.distillation.pressure, 1.01, 4.00).toFixed(2));

    const nominalDistLevel = this.distillation.feed_flow > 0.2 ? clamp(52.0 + (this.distillation.feed_flow - 10.0) * 1.2, 20.0, 85.0) : 0.0;
    this.distillation.level += (nominalDistLevel - this.distillation.level) * 0.25;
    this.distillation.level = Number(clamp(this.distillation.level, 0.0, 100.0).toFixed(1));
    this.distillation.health = Math.max(0, Math.round(100 - (this.distillation.reflux_ratio < 1.85 ? (1.85 - this.distillation.reflux_ratio) * 80 : 0)));
    this.distillation.status = this.distillation.reflux_ratio < 0.75 && this.distillation.feed_flow > 1.0 ? 'CRITICAL' : (this.distillation.reflux_ratio < 1.15 && this.distillation.feed_flow > 1.0 ? 'WARNING' : 'NORMAL');

    // -------------------------------------------------------------------------
    // 6. UPDATE PROCESS GRAPH LIVE FLOWS & CAUSAL FAULT ROLES
    // -------------------------------------------------------------------------
    if (this.processGraph?.connections) {
      this.processGraph.connections.forEach(conn => {
        if (conn.from === 'P-101') conn.flow = this.pump.flow;
        else if (conn.from === 'E-101') conn.flow = this.heatExchanger.flow;
        else if (conn.from === 'R-101') conn.flow = this.reactor.feed_flow;
        else if (conn.from === 'D-101') conn.flow = Number((this.distillation.feed_flow * 0.45).toFixed(1));
      });
    }

    if (this.processGraph?.nodes) {
      const nodes = this.processGraph.nodes;
      if (nodes['P-101']) {
        nodes['P-101'].parameters = { rpm: this.pump.rpm, vibration: this.pump.vibration, flow: this.pump.flow };
      }
      if (nodes['E-101']) {
        nodes['E-101'].parameters = { efficiency: this.heatExchanger.efficiency, deltaT: this.heatExchanger.temperature_difference, outletTemp: this.heatExchanger.outlet_temperature };
      }
      if (nodes['R-101']) {
        nodes['R-101'].parameters = { temperature: this.reactor.temperature, pressure: this.reactor.pressure, cooling: this.reactor.cooling_status, agitatorSpeed: this.reactor.agitator_speed };
      }
      if (nodes['D-101']) {
        nodes['D-101'].parameters = { refluxRatio: this.distillation.reflux_ratio, topTemp: this.distillation.top_temperature, bottomTemp: this.distillation.bottom_temperature, pressure: this.distillation.pressure };
      }

      // Causal fault role attribution: PRIMARY FAULT vs DOWNSTREAM EFFECT
      if (fault === 'pump_fault' || fault === 'early_pump_degradation' || (this.pump.health < 80 && this.pump.health < this.heatExchanger.health)) {
        if (nodes['P-101']) nodes['P-101'].role = this.pump.health < 50 ? 'PRIMARY_FAULT' : 'PRIMARY_DEGRADATION';
        if (nodes['E-101']) nodes['E-101'].role = 'DOWNSTREAM_EFFECT';
        if (nodes['R-101']) nodes['R-101'].role = 'DOWNSTREAM_EFFECT';
        if (nodes['D-101']) nodes['D-101'].role = 'DOWNSTREAM_EFFECT';
      } else if (fault === 'heat_exchanger_fault' || fault === 'early_heat_exchanger_fouling' || (this.heatExchanger.health < 80 && this.heatExchanger.health < this.reactor.health)) {
        if (nodes['P-101']) nodes['P-101'].role = 'PRIMARY_SOURCE';
        if (nodes['E-101']) nodes['E-101'].role = this.heatExchanger.health < 50 ? 'PRIMARY_FAULT' : 'PRIMARY_DEGRADATION';
        if (nodes['R-101']) nodes['R-101'].role = 'DOWNSTREAM_EFFECT';
        if (nodes['D-101']) nodes['D-101'].role = 'DOWNSTREAM_EFFECT';
      } else if (fault === 'reactor_cooling_failure' || fault === 'early_reactor_cooling_degradation' || (this.reactor.health < 80 && this.reactor.health < this.distillation.health)) {
        if (nodes['P-101']) nodes['P-101'].role = 'PRIMARY_SOURCE';
        if (nodes['E-101']) nodes['E-101'].role = 'NOMINAL';
        if (nodes['R-101']) nodes['R-101'].role = this.reactor.health < 50 ? 'PRIMARY_FAULT' : 'PRIMARY_DEGRADATION';
        if (nodes['D-101']) nodes['D-101'].role = 'DOWNSTREAM_EFFECT';
      } else if (fault === 'distillation_fault' || fault === 'early_distillation_reflux_loss' || this.distillation.health < 80) {
        if (nodes['P-101']) nodes['P-101'].role = 'PRIMARY_SOURCE';
        if (nodes['E-101']) nodes['E-101'].role = 'NOMINAL';
        if (nodes['R-101']) nodes['R-101'].role = 'NOMINAL';
        if (nodes['D-101']) nodes['D-101'].role = this.distillation.health < 50 ? 'PRIMARY_FAULT' : 'PRIMARY_DEGRADATION';
      } else {
        if (nodes['P-101']) nodes['P-101'].role = 'PRIMARY_SOURCE';
        if (nodes['E-101']) nodes['E-101'].role = 'NOMINAL';
        if (nodes['R-101']) nodes['R-101'].role = 'NOMINAL';
        if (nodes['D-101']) nodes['D-101'].role = 'NOMINAL';
      }
    }

    // -------------------------------------------------------------------------
    // 7. PROCESS STREAMS (Mass Balance Calculation)
    // -------------------------------------------------------------------------
    this.streams = this.calculateStreams();

    // -------------------------------------------------------------------------
    // 7. INTELLIGENT ALERT ENGINE EVALUATION
    // -------------------------------------------------------------------------
    this.evaluateIntelligentAlerts();

    return this.getState();
  }

  // ---------------------------------------------------------------------------
  // INTELLIGENT ALERT ENGINE (Correlated, Debounced with Hysteresis & Persistence)
  // ---------------------------------------------------------------------------
  evaluateIntelligentAlerts() {
    const p = this.pump;
    const hx = this.heatExchanger;
    const rx = this.reactor;
    const dist = this.distillation;

    // 1. P-101 High Mechanical Vibration
    const vibCrit = p.vibration > 0.45;
    const vibHigh = p.vibration > 0.32;
    const vibWarn = p.vibration > 0.22;
    const vibCond = vibWarn;
    const vibClear = p.vibration < 0.18;
    const vibSev = vibCrit ? 'CRITICAL' : (vibHigh ? 'HIGH' : (vibWarn ? 'WARNING' : 'NORMAL'));
    
    const vibRelated = [];
    if (p.flow < 8.5) vibRelated.push(`Downstream flow restricted (${p.flow.toFixed(1)} L/min)`);
    if (p.rpm < 2200) vibRelated.push(`Motor speed degradation (${p.rpm} RPM)`);
    if (rx.feed_flow < 8.5) vibRelated.push(`Reactor feed rate decreased (${rx.feed_flow.toFixed(1)} L/min)`);

    this.processAlertCondition(
      'P101_HIGH_VIBRATION',
      vibCond,
      vibClear,
      `${p.vibration.toFixed(2)} g`,
      vibSev,
      vibCrit ? 'CRITICAL PUMP VIBRATION — DAMAGE RISK' : (vibHigh ? 'High Mechanical Vibration' : 'Early Vibration Warning'),
      'Bearing race micro-pitting, impeller imbalance, or shaft misalignment.',
      'Risk of catastrophic mechanical seal blowout and plant emergency trip.',
      vibRelated
    );

    // 2. P-101 Pump Performance / Cavitation Deviation
    const perfCond = p.rpm >= 2100 && p.flow < 7.5;
    const perfClear = p.flow >= 8.5;
    const perfSev = p.flow < 5.0 ? 'HIGH' : 'WARNING';
    const perfRelated = [`Suction pressure: ${p.suction_pressure.toFixed(2)} bar`, `Vibration: ${p.vibration.toFixed(2)} g`];

    this.processAlertCondition(
      'P101_PERF_DEVIATION',
      perfCond,
      perfClear,
      `${p.flow.toFixed(1)} L/min`,
      perfSev,
      'Pump Flow Restriction / Cavitation Deviation',
      'Suction strainer debris buildup or insufficient NPSHa causing cavitation.',
      'Starves downstream heat exchanger and continuous reactor of feed.',
      perfRelated
    );

    // 3. E-101 Exchanger Thermal Fouling
    const foulCrit = hx.flow > 2.0 && (hx.efficiency < 40.0 || hx.temperature_difference < 3.0);
    const foulHigh = hx.flow > 2.0 && (hx.efficiency < 60.0 || hx.temperature_difference < 5.0);
    const foulWarn = hx.flow > 2.0 && (hx.efficiency < 75.0 || hx.temperature_difference < 6.5);
    const foulCond = foulWarn;
    const foulClear = hx.efficiency > 80.0 || hx.flow <= 2.0;
    const foulSev = foulCrit ? 'HIGH' : (foulHigh ? 'WARNING' : 'INFO');
    const foulRelated = [`Outlet temp: ${hx.outlet_temperature.toFixed(1)} °C`, `Thermal gradient ΔT: ${hx.temperature_difference.toFixed(1)} °C`];

    this.processAlertCondition(
      'E101_THERMAL_FOULING',
      foulCond,
      foulClear,
      `${hx.temperature_difference.toFixed(1)} °C (${hx.efficiency.toFixed(0)}%)`,
      foulSev,
      foulCrit ? 'Severe Heat Exchanger Fouling' : 'Thermal Gradient Fouling Degradation',
      'Mineral scaling or biofilm resistance layer on tube surfaces.',
      'Unconditioned fluid enters CSTR R-101 at suboptimal enthalpy, altering reaction yield.',
      foulRelated
    );

    // 4. R-101 Reactor Core Thermal Escalation / Runaway
    const rxCrit = rx.temperature > 85.0;
    const rxHigh = rx.temperature > 78.0;
    const rxWarn = rx.temperature > 73.0;
    const rxCond = rxWarn;
    const rxClear = rx.temperature < 70.0;
    const rxSev = rxCrit ? 'CRITICAL' : (rxHigh ? 'HIGH' : 'WARNING');
    const rxRelated = [`Vapor pressure: ${rx.pressure.toFixed(2)} bar`, `Distillation feed temp: ${rx.temperature.toFixed(1)} °C`];

    this.processAlertCondition(
      'R101_THERMAL_RUNAWAY',
      rxCond,
      rxClear,
      `${rx.temperature.toFixed(1)} °C`,
      rxSev,
      rxCrit ? 'CRITICAL EXOTHERMIC RUNAWAY ALERT' : (rxHigh ? 'High Reaction Temperature Alarm' : 'Exothermic Temperature Rise Warning'),
      'Arrhenius reaction heat production exceeds jacket heat removal capacity.',
      'Thermal runaway causes violent vapor boiling and vessel pressure escalation.',
      rxRelated
    );

    // 5. R-101 Cooling System Failure
    const coolCond = rx.cooling_status === 0;
    const coolClear = rx.cooling_status === 1;
    const coolSev = 'CRITICAL';
    const coolRelated = [`Core temp climbing at ${((rx.temperature - 65) / 2).toFixed(1)} °C/s`, `Vessel pressure: ${rx.pressure.toFixed(2)} bar`];

    this.processAlertCondition(
      'R101_COOLING_FAILURE',
      coolCond,
      coolClear,
      'TRIPPED (0)',
      coolSev,
      'CRITICAL: Reactor Cooling Relay Tripped',
      'Cooling jacket valve closed or cooling water supply circulation failure.',
      'Reactor will quickly reach explosive thermal runaway without cooling intervention.',
      coolRelated
    );

    // 6. R-101 Reactor Vessel Overpressure
    const pressCrit = rx.pressure > 3.00;
    const pressHigh = rx.pressure > 2.60;
    const pressWarn = rx.pressure > 2.30;
    const pressCond = pressWarn;
    const pressClear = rx.pressure < 2.20;
    const pressSev = pressCrit ? 'CRITICAL' : (pressHigh ? 'HIGH' : 'WARNING');
    const pressRelated = [`Core temperature: ${rx.temperature.toFixed(1)} °C`, `Relief valve threshold: 3.50 bar`];

    this.processAlertCondition(
      'R101_OVERPRESSURE',
      pressCond,
      pressClear,
      `${rx.pressure.toFixed(2)} bar`,
      pressSev,
      pressCrit ? 'CRITICAL VESSEL OVERPRESSURE' : (pressHigh ? 'High Vessel Pressure Alert' : 'Vapor Accumulation Warning'),
      'Antoine vapor pressure accumulation from overheating reaction core.',
      'Approaching mechanical design limits and relief valve burst disc activation.',
      pressRelated
    );

    // 7. D-101 Distillation Reflux Starvation
    const refCrit = dist.feed_flow > 2.0 && dist.reflux_ratio < 0.80;
    const refHigh = dist.feed_flow > 2.0 && dist.reflux_ratio < 1.15;
    const refWarn = dist.feed_flow > 2.0 && dist.reflux_ratio < 1.45;
    const refCond = refWarn;
    const refClear = dist.reflux_ratio > 1.60 || dist.feed_flow <= 2.0;
    const refSev = refCrit ? 'CRITICAL' : (refHigh ? 'HIGH' : 'WARNING');
    const refRelated = [`Overhead top temp: ${dist.top_temperature.toFixed(1)} °C`, `Overhead product flow: ${(p.flow * 0.45).toFixed(1)} L/min`];

    this.processAlertCondition(
      'D101_REFLUX_STARVATION',
      refCond,
      refClear,
      dist.reflux_ratio.toFixed(2),
      refSev,
      refCrit ? 'Severe Reflux Starvation — Fractionation Lost' : (refHigh ? 'Low Reflux Ratio Alarm' : 'Reflux Loss Warning'),
      'Reflux control valve failure or overhead distillate pump cavitation.',
      'Loss of separation equilibrium; heavy components contaminate overhead distillate.',
      refRelated
    );
  }

  processAlertCondition(key, isConditionMet, isClearConditionMet, currentValueStr, severity, title, likelyCause, processImpact, relatedEffects = []) {
    const alert = this.alerts[key];
    if (!alert) return;

    alert.current_value = currentValueStr;
    alert.title = title || alert.title;
    alert.likely_cause = likelyCause || alert.likely_cause;
    alert.process_impact = processImpact || alert.process_impact;
    alert.related_effects = relatedEffects;

    if (isConditionMet) {
      alert.clearTicks = 0;
      alert.persistence++;
      if (alert.persistence >= alert.requiredTicks) {
        if (alert.status === 'CLEARED' || !alert.status) {
          alert.status = 'ACTIVE';
          alert.severity = severity;
          alert.triggered_at = new Date().toISOString();
        } else if (alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED') {
          // Escalate severity if critical
          if (severity === 'CRITICAL' && alert.severity !== 'CRITICAL') {
            alert.severity = 'CRITICAL';
          } else if (severity === 'HIGH' && alert.severity === 'WARNING') {
            alert.severity = 'HIGH';
          }
        }
      }
    } else if (isClearConditionMet) {
      alert.clearTicks++;
      if (alert.clearTicks >= 2) {
        alert.persistence = 0;
        if (alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED') {
          alert.status = 'CLEARED';
          alert.cleared_at = new Date().toISOString();
          // Push copy to alert history
          this.alertHistory.unshift({
            ...alert,
            history_id: Date.now() + Math.random()
          });
          if (this.alertHistory.length > 50) this.alertHistory.pop();
        }
      }
    }
  }

  acknowledgeAlert(keyOrId, operator = 'Operator') {
    const alert = this.alerts[keyOrId];
    if (alert && (alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED')) {
      alert.status = 'ACKNOWLEDGED';
      alert.acknowledged_at = new Date().toISOString();
      alert.acknowledged_by = operator;
      return { success: true, status: 'ACKNOWLEDGED', alert };
    }
    return { success: false, reason: 'Alert not found or already cleared' };
  }

  clearAlert(keyOrId) {
    const alert = this.alerts[keyOrId];
    if (alert) {
      alert.status = 'CLEARED';
      alert.cleared_at = new Date().toISOString();
      alert.persistence = 0;
      this.alertHistory.unshift({ ...alert, history_id: Date.now() });
      return { success: true, status: 'CLEARED', alert };
    }
    return { success: false, reason: 'Alert not found' };
  }

  getActiveAlerts() {
    return Object.values(this.alerts).filter(a => a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED');
  }

  getAllAlerts() {
    return Object.values(this.alerts);
  }

  getAlertSummary() {
    const active = this.getActiveAlerts();
    return {
      totalActive: active.length,
      activeCount: active.length,
      critical: active.filter(a => a.severity === 'CRITICAL').length,
      criticalCount: active.filter(a => a.severity === 'CRITICAL').length,
      high: active.filter(a => a.severity === 'HIGH').length,
      highCount: active.filter(a => a.severity === 'HIGH').length,
      warning: active.filter(a => a.severity === 'WARNING').length,
      warningCount: active.filter(a => a.severity === 'WARNING').length,
      info: active.filter(a => a.severity === 'INFO').length,
      infoCount: active.filter(a => a.severity === 'INFO').length,
      acknowledgedCount: active.filter(a => a.status === 'ACKNOWLEDGED').length
    };
  }

  getAlertHistory() {
    return this.alertHistory;
  }

  calculateStreams() {
    const qPump = this.pump.flow;
    const tPumpIn = this.pump.inlet_temperature;
    const tPumpOut = this.pump.outlet_temperature;
    const pPumpOut = this.pump.discharge_pressure;

    const tHxOut = this.heatExchanger.outlet_temperature;
    const pHxOut = Number(clamp(pPumpOut - 0.35, 1.01, 3.50).toFixed(2));

    const tReactor = this.reactor.temperature;
    const pReactor = this.reactor.pressure;

    const tTop = this.distillation.top_temperature;
    const tBottom = this.distillation.bottom_temperature;
    const pDist = this.distillation.pressure;
    const reflux = this.distillation.reflux_ratio;

    const topProductFlow = Number((qPump * 0.45).toFixed(1));
    const refluxReturnFlow = Number((topProductFlow * reflux).toFixed(1));
    const bottomProductFlow = Number((qPump * 0.53).toFixed(1));

    return {
      stream_1: {
        id: '01',
        name: 'Water Source Feed',
        from: 'Raw Water Tank',
        to: 'P-101 Centrifugal Pump',
        flow: qPump,
        temperature: tPumpIn,
        pressure: this.pump.suction_pressure
      },
      stream_2: {
        id: '02',
        name: 'Pump Discharge Stream',
        from: 'P-101 Centrifugal Pump',
        to: 'E-101 Shell & Tube Exchanger',
        flow: Number((qPump * 0.99).toFixed(1)),
        temperature: tPumpOut,
        pressure: pPumpOut
      },
      stream_3: {
        id: '03',
        name: 'Conditioned Exchanger Effluent',
        from: 'E-101 Heat Exchanger',
        to: 'R-101 CSTR Reactor',
        flow: Number((this.heatExchanger.flow * 0.99).toFixed(1)),
        temperature: tHxOut,
        pressure: pHxOut
      },
      stream_4: {
        id: '04',
        name: 'Reactor Reaction Effluent',
        from: 'R-101 CSTR Reactor',
        to: 'D-101 Binary Distillation Column',
        flow: Number((this.reactor.feed_flow * 0.99).toFixed(1)),
        temperature: tReactor,
        pressure: pReactor
      },
      stream_5: {
        id: '05',
        name: 'Overhead Distillate & Reflux Loop',
        from: 'D-101 Overhead Condenser',
        to: 'Product Tank / Reflux Return',
        flow: topProductFlow,
        temperature: tTop,
        pressure: pDist,
        reflux_ratio: reflux,
        reflux_flow: refluxReturnFlow
      },
      stream_6: {
        id: '06',
        name: 'Column Bottoms Product',
        from: 'D-101 Column Reboiler',
        to: 'Bottoms Storage',
        flow: bottomProductFlow,
        temperature: tBottom,
        pressure: Number((pDist + 0.15).toFixed(2))
      }
    };
  }

  resetSimulation() {
    this.currentFault = 'normal';
    this.faultTicks = 0;
    this.faultSeverity = 0.0;
    this.isPaused = false;

    this.resetUserControls();
    this.processGraph = this.createDefaultProcessGraph();

    this.pump = {
      status: 'RUNNING',
      rpm: 2450,
      vibration: 0.08,
      flow: 10.0,
      suction_pressure: 1.01,
      discharge_pressure: 2.80,
      inlet_temperature: 25.2,
      outlet_temperature: 38.1,
      health: 100
    };

    this.heatExchanger = {
      status: 'NORMAL',
      flow: 9.9,
      efficiency: 95.0,
      inlet_temperature: 25.2,
      outlet_temperature: 38.1,
      temperature_difference: 12.9,
      heat_transfer_indicator: 95.0,
      health: 100
    };

    this.reactor = {
      status: 'NORMAL',
      feed_flow: 9.8,
      temperature: 65.0,
      pressure: 2.05,
      level: 50.0,
      agitator_speed: 350,
      cooling_status: 1,
      health: 100
    };

    this.distillation = {
      status: 'NORMAL',
      feed_flow: 9.7,
      top_temperature: 76.5,
      bottom_temperature: 98.4,
      pressure: 2.10,
      level: 52.0,
      reflux_ratio: 1.85,
      health: 100
    };

    this.lags = {
      pumpRpm: 2450,
      pumpFlow: 10.0,
      hxFlow: 9.9,
      reactorFlow: 9.8,
      distFlow: 9.7
    };

    // Clear active alerts
    Object.keys(this.alerts).forEach(k => {
      this.alerts[k].status = 'CLEARED';
      this.alerts[k].persistence = 0;
    });

    this.streams = this.calculateStreams();
  }

  getState() {
    const activeAlerts = this.getActiveAlerts();
    const alertSummary = this.getAlertSummary();

    return {
      timestamp: new Date().toISOString(),
      current_fault: this.currentFault,
      fault_ticks: this.faultTicks,
      fault_severity: Number(this.faultSeverity.toFixed(3)),
      is_paused: this.isPaused,
      workflow: { ...this.processGraph },
      controls: { ...this.userControls },
      pump: { ...this.pump },
      heatExchanger: { ...this.heatExchanger },
      reactor: { ...this.reactor },
      distillation: { ...this.distillation },
      streams: { ...this.streams },
      active_alerts: activeAlerts,
      alert_summary: alertSummary,
      // Backward compatibility aliases
      demoPump: {
        rpm: this.pump.rpm,
        vibration: this.pump.vibration,
        inlet_temperature: this.pump.inlet_temperature,
        outlet_temperature: this.pump.outlet_temperature,
        flow: this.pump.flow
      },
      demoHeatExchanger: {
        inlet_temperature: this.heatExchanger.inlet_temperature,
        outlet_temperature: this.heatExchanger.outlet_temperature,
        temperature_difference: this.heatExchanger.temperature_difference,
        heat_transfer_indicator: this.heatExchanger.heat_transfer_indicator,
        efficiency: this.heatExchanger.efficiency
      }
    };
  }
}
