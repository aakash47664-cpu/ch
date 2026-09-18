/**
 * ChemDiag AI — Intermittent & Transient Process Fault Detector
 * 
 * Purpose:
 * Detection, tracking, multivariable correlation, and recurrence analysis of 
 * short-duration, non-repeatable, sporadic, intermittent, and recurrent process abnormalities.
 * 
 * Key Principles:
 * 1. Independent temporal analysis layer (does NOT modify or merge with ML Monitoring).
 * 2. Remembers short-duration events after process returns to normal (Non-Repeatable Preservation).
 * 3. Uses debounce / hysteresis (2 consecutive ticks) to eliminate noise spikes.
 * 4. Multi-variable correlation per equipment unit into ONE unified event.
 * 5. Cautious engineering terminology (avoids unverified failure claims).
 * 6. Lightweight database persistence on state transitions only.
 */

import {
  recordIntermittentFaultEvent,
  updateIntermittentFaultEvent,
  getIntermittentFaultEvents,
  getIntermittentFaultStats,
  clearIntermittentFaultEvents
} from '../database/db.js';

// Physical nominal baselines and abnormality thresholds for all 4 units
export const INTERMITTENT_BASELINES = {
  // P-101 Centrifugal Pump
  pump: {
    tag: 'P-101',
    name: 'Pump (6V Mini Centrifugal)',
    variables: {
      rpm: { nominal: 2450, unit: 'RPM', tol: 120, isAbnormal: (v) => v < 2320 || v > 2650, name: 'Pump Speed' },
      vibration: { nominal: 0.08, unit: 'g', tol: 0.05, isAbnormal: (v) => v > 0.16, name: 'Casing Vibration' },
      flow: { nominal: 10.0, unit: 'L/min', tol: 0.8, isAbnormal: (v) => v < 8.8 || v > 11.5, name: 'Discharge Flow' },
      discharge_pressure: { nominal: 2.80, unit: 'bar', tol: 0.30, isAbnormal: (v) => v < 2.30 || v > 3.40, name: 'Discharge Pressure' },
      suction_pressure: { nominal: 1.01, unit: 'bar', tol: 0.15, isAbnormal: (v) => v < 0.75, name: 'Suction Pressure' },
      outlet_temperature: { nominal: 38.1, unit: '°C', tol: 4.0, isAbnormal: (v) => v > 44.0, name: 'Discharge Temp' }
    }
  },

  // E-101 Shell & Tube Heat Exchanger
  heat_exchanger: {
    tag: 'E-101',
    name: 'Heat Exchanger (Shell & Tube)',
    variables: {
      temperature_difference: { nominal: 12.9, unit: '°C', tol: 2.5, isAbnormal: (v) => v < 9.0, name: 'Thermal Gradient (ΔT)' },
      outlet_temperature: { nominal: 25.2, unit: '°C', tol: 3.5, isAbnormal: (v) => v > 31.5, name: 'Process Outlet Temp' },
      inlet_temperature: { nominal: 38.1, unit: '°C', tol: 3.5, isAbnormal: (v) => v < 33.0 || v > 44.0, name: 'Process Inlet Temp' },
      flow: { nominal: 9.9, unit: 'L/min', tol: 0.8, isAbnormal: (v) => v < 8.4 || v > 11.4, name: 'Tube Flow Rate' },
      efficiency: { nominal: 95.0, unit: '%', tol: 7.0, isAbnormal: (v) => v < 85.0, name: 'Thermal Efficiency' }
    }
  },

  // R-101 Continuous Stirred-Tank Reactor
  reactor: {
    tag: 'R-101',
    name: 'Continuous Stirred-Tank Reactor (CSTR)',
    variables: {
      temperature: { nominal: 65.0, unit: '°C', tol: 4.0, isAbnormal: (v) => v > 71.0 || v < 58.0, name: 'Core Temperature' },
      pressure: { nominal: 2.05, unit: 'bar', tol: 0.25, isAbnormal: (v) => v > 2.35 || v < 1.70, name: 'Vessel Pressure' },
      level: { nominal: 50.0, unit: '%', tol: 10.0, isAbnormal: (v) => v < 36.0 || v > 68.0, name: 'Liquid Level' },
      feed_flow: { nominal: 9.8, unit: 'L/min', tol: 0.8, isAbnormal: (v) => v < 8.3, name: 'Feed Rate' },
      cooling_status: { nominal: 1, unit: '', tol: 0.2, isAbnormal: (v) => v < 0.6, name: 'Cooling Circuit' },
      agitator_speed: { nominal: 350, unit: 'RPM', tol: 25, isAbnormal: (v) => v < 300 || v > 400, name: 'Agitator Speed' }
    }
  },

  // D-101 Binary Distillation Column
  distillation: {
    tag: 'D-101',
    name: 'Binary Distillation Column',
    variables: {
      reflux_ratio: { nominal: 1.85, unit: '', tol: 0.20, isAbnormal: (v) => v < 1.55 || v > 2.25, name: 'Reflux Ratio (L/D)' },
      top_temperature: { nominal: 76.5, unit: '°C', tol: 3.5, isAbnormal: (v) => v > 81.5 || v < 70.0, name: 'Top Vapor Temp' },
      bottom_temperature: { nominal: 98.4, unit: '°C', tol: 4.0, isAbnormal: (v) => v > 104.5 || v < 91.0, name: 'Bottom Reboiler Temp' },
      pressure: { nominal: 2.10, unit: 'bar', tol: 0.25, isAbnormal: (v) => v > 2.45 || v < 1.75, name: 'Column Pressure' },
      feed_flow: { nominal: 9.7, unit: 'L/min', tol: 0.8, isAbnormal: (v) => v < 8.2, name: 'Column Feed Rate' }
    }
  }
};

export class IntermittentFaultDetector {
  constructor() {
    // Sliding window of raw telemetry points (last 60 seconds)
    this.slidingWindow = [];
    this.maxWindowSize = 60;

    // Per-equipment state machines
    // States: 'NORMAL' | 'DEBOUNCING_START' | 'EVENT_ACTIVE' | 'DEBOUNCING_RECOVERY'
    this.equipmentStates = {
      pump: this.createInitialEquipmentState('pump', 'P-101'),
      heat_exchanger: this.createInitialEquipmentState('heat_exchanger', 'E-101'),
      reactor: this.createInitialEquipmentState('reactor', 'R-101'),
      distillation: this.createInitialEquipmentState('distillation', 'D-101')
    };

    // In-memory completed event history (most recent 50 events)
    this.eventHistory = [];

    // Recurrence analysis metrics cache
    this.recurrenceStats = {
      total_events: 0,
      active_events: 0,
      non_repeatable_events: 0,
      isolated_events: 0,
      sporadic_events: 0,
      intermittent_events: 0,
      recurrent_events: 0,
      persistent_events: 0,
      avg_duration: 0,
      min_duration: 0,
      max_duration: 0,
      avg_interval: null,
      last_event_time: null,
      first_event_time: null,
      overall_pattern: 'NORMAL',
      by_equipment: {
        'P-101': { count: 0, avg_duration: 0, avg_interval: null, last_seen: null, pattern: 'NORMAL' },
        'E-101': { count: 0, avg_duration: 0, avg_interval: null, last_seen: null, pattern: 'NORMAL' },
        'R-101': { count: 0, avg_duration: 0, avg_interval: null, last_seen: null, pattern: 'NORMAL' },
        'D-101': { count: 0, avg_duration: 0, avg_interval: null, last_seen: null, pattern: 'NORMAL' }
      }
    };

    // Active test pulse override (for controlled demo without disrupting real ML)
    this.testPulse = null;

    // Load initial stats from SQLite asynchronously
    this.syncFromDatabase();
  }

  createInitialEquipmentState(id, tag) {
    return {
      id,
      tag,
      state: 'NORMAL', // 'NORMAL' | 'DEBOUNCING_START' | 'EVENT_ACTIVE' | 'DEBOUNCING_RECOVERY'
      debounceStartCount: 0,
      debounceRecoveryCount: 0,
      currentEvent: null,
      lastRecoveryTime: null,
      eventHistory: []
    };
  }

  async syncFromDatabase() {
    try {
      const stats = await getIntermittentFaultStats();
      if (stats && stats.total_events > 0) {
        this.recurrenceStats.total_events = stats.total_events;
        this.recurrenceStats.active_events = stats.active_events;
        this.recurrenceStats.non_repeatable_events = stats.non_repeatable_events || 0;
        this.recurrenceStats.isolated_events = stats.isolated_events || 0;
        this.recurrenceStats.sporadic_events = stats.sporadic_events || 0;
        this.recurrenceStats.intermittent_events = stats.intermittent_events || 0;
        this.recurrenceStats.recurrent_events = stats.recurrent_events || 0;
        this.recurrenceStats.persistent_events = stats.persistent_events || 0;
        this.recurrenceStats.avg_duration = stats.avg_duration;
        this.recurrenceStats.min_duration = stats.min_duration;
        this.recurrenceStats.max_duration = stats.max_duration;
        this.recurrenceStats.avg_interval = stats.avg_interval;
        this.recurrenceStats.last_event_time = stats.last_event_time;
        this.recurrenceStats.first_event_time = stats.first_event_time;
        if (stats.by_equipment) {
          Object.keys(stats.by_equipment).forEach(k => {
            if (this.recurrenceStats.by_equipment[k]) {
              this.recurrenceStats.by_equipment[k] = {
                ...this.recurrenceStats.by_equipment[k],
                ...stats.by_equipment[k]
              };
            }
          });
        }
      }

      const recent = await getIntermittentFaultEvents({ limit: 50 });
      if (recent && Array.isArray(recent) && recent.length > 0) {
        this.eventHistory = recent;
        this.recalculateRecurrencePatterns();
      }
    } catch (err) {
      console.warn('⚠️ IntermittentFaultDetector: Initial DB sync notice:', err.message);
    }
  }

  /**
   * Main 1-second simulation tick processor
   */
  processTick(telemetry, simState, activeFault = 'normal') {
    const now = new Date();
    const timestampIso = now.toISOString();

    // 0. Handle active test pulse if present (transient test pulse simulation)
    const effectiveTelemetry = { ...telemetry };
    if (this.testPulse && Date.now() < this.testPulse.expiresAt) {
      this.applyTestPulse(effectiveTelemetry, this.testPulse);
    } else if (this.testPulse && Date.now() >= this.testPulse.expiresAt) {
      this.testPulse = null;
    }

    // 1. Maintain sliding window of continuous process data points
    this.slidingWindow.push({
      time: now.toLocaleTimeString(),
      timestamp: timestampIso,
      pump_vibration: effectiveTelemetry.pump_vibration,
      pump_rpm: effectiveTelemetry.pump_rpm,
      pump_flow: effectiveTelemetry.pump_flow,
      pump_discharge_pressure: effectiveTelemetry.pump_discharge_pressure,
      hx_delta_t: effectiveTelemetry.hx_delta_t ?? effectiveTelemetry.heat_exchanger_temperature_difference,
      hx_outlet_temp: effectiveTelemetry.hx_outlet_temp ?? effectiveTelemetry.heat_exchanger_outlet_temperature,
      hx_efficiency: effectiveTelemetry.hx_efficiency ?? effectiveTelemetry.heat_exchanger_efficiency,
      reactor_temp: effectiveTelemetry.reactor_temp ?? effectiveTelemetry.reactor_temperature,
      reactor_pressure: effectiveTelemetry.reactor_pressure,
      dist_reflux_ratio: effectiveTelemetry.dist_reflux_ratio ?? effectiveTelemetry.distillation_reflux_ratio,
      dist_top_temp: effectiveTelemetry.dist_top_temp ?? effectiveTelemetry.distillation_top_temperature
    });

    if (this.slidingWindow.length > this.maxWindowSize) {
      this.slidingWindow.shift();
    }

    // 2. Evaluate each equipment unit independently
    this.evaluateUnit('pump', this.extractUnitTelemetry('pump', effectiveTelemetry, simState), timestampIso);
    this.evaluateUnit('heat_exchanger', this.extractUnitTelemetry('heat_exchanger', effectiveTelemetry, simState), timestampIso);
    this.evaluateUnit('reactor', this.extractUnitTelemetry('reactor', effectiveTelemetry, simState), timestampIso);
    this.evaluateUnit('distillation', this.extractUnitTelemetry('distillation', effectiveTelemetry, simState), timestampIso);

    // 3. Update overall recurrence statistics
    this.updateLiveRecurrenceSummary();
  }

  extractUnitTelemetry(unitKey, tel, simState) {
    switch (unitKey) {
      case 'pump':
        return {
          rpm: tel.pump_rpm,
          vibration: tel.pump_vibration,
          flow: tel.pump_flow,
          discharge_pressure: tel.pump_discharge_pressure,
          suction_pressure: tel.pump_suction_pressure,
          outlet_temperature: tel.pump_outlet_temperature
        };
      case 'heat_exchanger':
        return {
          temperature_difference: tel.hx_delta_t ?? simState?.heatExchanger?.temperature_difference ?? 12.9,
          outlet_temperature: tel.hx_outlet_temp ?? simState?.heatExchanger?.outlet_temperature ?? 25.2,
          inlet_temperature: tel.hx_inlet_temp ?? simState?.heatExchanger?.inlet_temperature ?? 38.1,
          flow: tel.hx_flow ?? simState?.heatExchanger?.flow ?? 9.9,
          efficiency: tel.hx_efficiency ?? simState?.heatExchanger?.efficiency ?? 95.0
        };
      case 'reactor':
        return {
          temperature: tel.reactor_temp ?? tel.reactor_temperature ?? 65.0,
          pressure: tel.reactor_pressure ?? 2.05,
          level: tel.reactor_level ?? 50.0,
          feed_flow: tel.reactor_feed_flow ?? 9.8,
          cooling_status: tel.reactor_cooling_status ?? 1,
          agitator_speed: tel.reactor_agitator_speed ?? 350
        };
      case 'distillation':
        return {
          reflux_ratio: tel.dist_reflux_ratio ?? tel.distillation_reflux_ratio ?? 1.85,
          top_temperature: tel.dist_top_temp ?? tel.distillation_top_temperature ?? 76.5,
          bottom_temperature: tel.dist_bottom_temp ?? tel.distillation_bottom_temperature ?? 98.4,
          pressure: tel.dist_pressure ?? tel.distillation_pressure ?? 2.10,
          feed_flow: tel.dist_feed_flow ?? 9.7
        };
      default:
        return {};
    }
  }

  /**
   * Evaluate abnormal conditions, debounce, multivariable correlation, and state transitions for a single unit
   */
  evaluateUnit(unitKey, readings, timestampIso) {
    const config = INTERMITTENT_BASELINES[unitKey];
    if (!config) return;

    const unitState = this.equipmentStates[unitKey];
    const deviatingVars = [];
    const varDetails = {};
    const baselineDetails = {};
    const deviationDetails = {};

    let maxSeverityScore = 0;

    // Check all configured variables for this unit
    Object.keys(config.variables).forEach((varKey) => {
      const varCfg = config.variables[varKey];
      const val = readings[varKey];

      if (typeof val === 'number' && !isNaN(val)) {
        baselineDetails[varKey] = {
          nominal: varCfg.nominal,
          unit: varCfg.unit,
          name: varCfg.name
        };

        const isAbnormal = varCfg.isAbnormal(val);
        const delta = val - varCfg.nominal;
        const normalizedDev = varCfg.tol > 0 ? Math.abs(delta) / varCfg.tol : 0;

        deviationDetails[varKey] = {
          nominal: varCfg.nominal,
          current: Number(val.toFixed(2)),
          delta: Number(delta.toFixed(2)),
          percent: Number(((delta / (varCfg.nominal || 1)) * 100).toFixed(1)),
          unit: varCfg.unit,
          normalizedDev: Number(normalizedDev.toFixed(2)),
          isAbnormal
        };

        varDetails[varKey] = Number(val.toFixed(2));

        if (isAbnormal) {
          deviatingVars.push({
            key: varKey,
            name: varCfg.name,
            value: Number(val.toFixed(2)),
            nominal: varCfg.nominal,
            unit: varCfg.unit,
            normalizedDev,
            delta,
            direction: delta > 0 ? 'increased' : 'decreased'
          });

          if (normalizedDev > maxSeverityScore) {
            maxSeverityScore = normalizedDev;
          }
        }
      }
    });

    const isCurrentlyAbnormal = deviatingVars.length > 0;

    // ----------------------------------------------------
    // STATE MACHINE TRANSITIONS (WITH DEBOUNCE & HYSTERESIS)
    // ----------------------------------------------------
    switch (unitState.state) {
      case 'NORMAL':
        if (isCurrentlyAbnormal) {
          unitState.debounceStartCount = 1;
          unitState.state = 'DEBOUNCING_START';
        }
        break;

      case 'DEBOUNCING_START':
        if (isCurrentlyAbnormal) {
          unitState.debounceStartCount++;
          // Hysteresis: Require at least 2 consecutive abnormal ticks to confirm event start
          if (unitState.debounceStartCount >= 2) {
            this.startNewEvent(unitKey, config, deviatingVars, varDetails, baselineDetails, deviationDetails, maxSeverityScore, timestampIso);
          }
        } else {
          // False alarm or 1-tick noise; reset back to normal
          unitState.debounceStartCount = 0;
          unitState.state = 'NORMAL';
        }
        break;

      case 'EVENT_ACTIVE':
        if (unitState.currentEvent) {
          // Update peak values and live duration
          const startMs = new Date(unitState.currentEvent.start_time).getTime();
          const currentMs = new Date(timestampIso).getTime();
          unitState.currentEvent.duration = Number(Math.max(1, (currentMs - startMs) / 1000).toFixed(1));

          // Merge any new correlated variables that started deviating
          this.updateActiveEventVariables(unitState.currentEvent, deviatingVars, varDetails, deviationDetails);

          // Check if persistence exceeds transient window (>30 seconds)
          if (unitState.currentEvent.duration > 30) {
            unitState.currentEvent.pattern = 'PERSISTENT';
            unitState.currentEvent.event_type = 'PERSISTENT';
            unitState.currentEvent.interpretation = 'Persistent abnormal condition remains continuously present (>30s). Monitored under continuous process diagnostics.';
          }

          if (!isCurrentlyAbnormal) {
            // Process began returning to normal; initiate recovery debounce
            unitState.debounceRecoveryCount = 1;
            unitState.state = 'DEBOUNCING_RECOVERY';
          }
        }
        break;

      case 'DEBOUNCING_RECOVERY':
        if (!isCurrentlyAbnormal) {
          unitState.debounceRecoveryCount++;
          // Hysteresis: Require at least 2 consecutive nominal ticks to confirm recovery
          if (unitState.debounceRecoveryCount >= 2) {
            this.closeActiveEvent(unitKey, timestampIso);
          }
        } else {
          // Fluctuation: abnormality returned during recovery window
          unitState.debounceRecoveryCount = 0;
          unitState.state = 'EVENT_ACTIVE';
        }
        break;
    }
  }

  /**
   * Start a new correlated event
   */
  startNewEvent(unitKey, config, deviatingVars, varDetails, baselineDetails, deviationDetails, maxDev, timestampIso) {
    const unitState = this.equipmentStates[unitKey];
    const eventId = `IF-${config.tag}-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    // Sort deviating variables by normalized deviation (highest first)
    deviatingVars.sort((a, b) => b.normalizedDev - a.normalizedDev);
    const primary = deviatingVars.slice(0, 2).map(v => v.name);
    const secondary = deviatingVars.slice(2).map(v => v.name);
    const allVarNames = deviatingVars.map(v => v.name);

    // Calculate initial severity based on normalized deviation
    let severity = 'LOW';
    if (maxDev > 2.5) severity = 'CRITICAL';
    else if (maxDev > 1.8) severity = 'HIGH';
    else if (maxDev > 1.2) severity = 'MEDIUM';

    // Cautious observation synthesis
    const obsPhrases = deviatingVars.map(v => `${v.name} ${v.direction} (${v.nominal} → ${v.value} ${v.unit})`);
    const observation = obsPhrases.join(', ');

    // Prior equipment history evaluation
    const priorEvents = this.eventHistory.filter(e => e.equipment_id === config.tag);
    const recurrenceCount = priorEvents.length + 1;
    
    let timeSincePrev = null;
    if (priorEvents.length > 0 && priorEvents[0].start_time) {
      timeSincePrev = Number(Math.max(1, (new Date(timestampIso).getTime() - new Date(priorEvents[0].start_time).getTime()) / 1000).toFixed(1));
    }

    // Determine initial temporal pattern
    let pattern = 'NON-REPEATABLE';
    let interpretation = 'Single transient abnormal event detected. Preserved for temporal monitoring; no recurrence observed in available history.';

    if (priorEvents.length === 0) {
      if (maxDev <= 1.2 && severity === 'LOW') {
        pattern = 'ISOLATED TRANSIENT';
        interpretation = 'Short transient abnormal deviation with automatic recovery. No recurrence observed.';
      } else {
        pattern = 'NON-REPEATABLE';
        interpretation = 'Single transient abnormal event detected. Preserved for temporal monitoring; no recurrence observed in available history.';
      }
    } else if (priorEvents.length === 1) {
      if (timeSincePrev && timeSincePrev <= 180) {
        pattern = 'INTERMITTENT';
        interpretation = 'Secondary transient abnormality detected. Abnormality disappeared and returned (Intermittent pattern).';
      } else {
        pattern = 'SPORADIC';
        interpretation = 'Irregular transient abnormality separated by extended nominal period (Sporadic pattern).';
      }
    } else {
      pattern = 'RECURRENT';
      interpretation = `Similar abnormal events repeatedly occur with identifiable recurrence (${recurrenceCount} occurrences observed).`;
    }

    const event = {
      event_id: eventId,
      equipment_id: config.tag,
      equipment_name: config.name,
      start_time: timestampIso,
      end_time: null,
      duration: 1.0,
      severity,
      pattern,
      event_type: pattern,
      variables: allVarNames,
      primary_variables: primary,
      secondary_variables: secondary,
      correlated_variables: allVarNames,
      values: varDetails,
      baseline: baselineDetails,
      deviation: deviationDetails,
      status: 'EVENT ACTIVE',
      observation,
      interpretation,
      time_since_previous: timeSincePrev,
      recurrence_count: recurrenceCount,
      average_interval: null,
      average_duration: null,
      snapshot_history: this.slidingWindow.slice(-15)
    };

    unitState.currentEvent = event;
    unitState.state = 'EVENT_ACTIVE';
    unitState.debounceStartCount = 0;
    unitState.debounceRecoveryCount = 0;

    // Persist event start to SQLite
    recordIntermittentFaultEvent(event).catch(err => {
      console.warn('⚠️ IntermittentFaultDetector: DB write warning:', err.message);
    });
  }

  updateActiveEventVariables(event, deviatingVars, varDetails, deviationDetails) {
    if (!event) return;
    deviatingVars.forEach(dv => {
      if (!event.variables.includes(dv.name)) {
        event.variables.push(dv.name);
        event.correlated_variables.push(dv.name);
      }
    });
    event.values = { ...event.values, ...varDetails };
    event.deviation = { ...event.deviation, ...deviationDetails };
  }

  /**
   * Close active event upon confirmed recovery
   */
  closeActiveEvent(unitKey, timestampIso) {
    const unitState = this.equipmentStates[unitKey];
    if (!unitState.currentEvent) {
      unitState.state = 'NORMAL';
      return;
    }

    const event = unitState.currentEvent;
    event.end_time = timestampIso;
    const startMs = new Date(event.start_time).getTime();
    const endMs = new Date(timestampIso).getTime();
    event.duration = Number(Math.max(1, (endMs - startMs) / 1000).toFixed(1));
    event.status = 'RECOVERED';

    // Capture post-recovery snapshot history
    event.snapshot_history = this.slidingWindow.slice(-25);

    // Prior events on this equipment unit
    const priorEvents = this.eventHistory.filter(e => e.equipment_id === event.equipment_id);
    const totalEquipEvents = priorEvents.length + 1;

    // Final temporal classification
    if (event.duration > 30) {
      event.pattern = 'PERSISTENT';
      event.event_type = 'PERSISTENT';
      event.interpretation = 'Persistent abnormal condition remains continuously present (>30s). Monitored under continuous process diagnostics.';
    } else if (priorEvents.length === 0) {
      if (event.duration >= 2.5 || event.severity !== 'LOW') {
        event.pattern = 'NON-REPEATABLE';
        event.event_type = 'NON-REPEATABLE';
        event.interpretation = 'Single transient abnormal event detected. No recurrence has been observed within the available history.';
      } else {
        event.pattern = 'ISOLATED TRANSIENT';
        event.event_type = 'ISOLATED TRANSIENT';
        event.interpretation = 'Short transient abnormal deviation with automatic recovery. No recurrence observed.';
      }
    } else if (priorEvents.length === 1) {
      const prev = priorEvents[0];
      const interval = (new Date(event.start_time).getTime() - new Date(prev.start_time).getTime()) / 1000;
      event.time_since_previous = Number(interval.toFixed(1));
      
      if (interval <= 180) {
        event.pattern = 'INTERMITTENT';
        event.event_type = 'INTERMITTENT';
        event.interpretation = 'Abnormal condition disappeared and returned across temporal window (Intermittent pattern).';
      } else {
        event.pattern = 'SPORADIC';
        event.event_type = 'SPORADIC';
        event.interpretation = 'Multiple abnormal events occurring irregularly across temporal history.';
      }
    } else {
      // 3 or more occurrences
      const allStarts = [new Date(event.start_time).getTime(), ...priorEvents.map(e => new Date(e.start_time).getTime())].sort((a, b) => a - b);
      const intervals = [];
      for (let i = 1; i < allStarts.length; i++) {
        intervals.push((allStarts[i] - allStarts[i - 1]) / 1000);
      }
      const meanInt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + Math.pow(b - meanInt, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      const cv = meanInt > 0 ? stdDev / meanInt : 0;

      if (intervals.length <= 3 || cv <= 0.85 || meanInt <= 120) {
        event.pattern = 'RECURRENT';
        event.event_type = 'RECURRENT';
        event.interpretation = `Similar abnormal events repeatedly occur with identifiable recurrence (${totalEquipEvents} occurrences observed).`;
      } else {
        event.pattern = 'SPORADIC';
        event.event_type = 'SPORADIC';
        event.interpretation = `Multiple abnormal events occurring irregularly across temporal history (${totalEquipEvents} sporadic occurrences).`;
      }
    }

    event.recurrence_count = totalEquipEvents;

    // Add to in-memory history
    this.eventHistory.unshift({ ...event });
    if (this.eventHistory.length > 50) {
      this.eventHistory.pop();
    }

    unitState.eventHistory.unshift({ ...event });
    unitState.lastRecoveryTime = timestampIso;
    unitState.currentEvent = null;
    unitState.state = 'NORMAL';
    unitState.debounceStartCount = 0;
    unitState.debounceRecoveryCount = 0;

    // Persist completed recovery to SQLite
    updateIntermittentFaultEvent(event.event_id, {
      end_time: event.end_time,
      duration: event.duration,
      status: event.status,
      pattern: event.pattern,
      event_type: event.event_type,
      severity: event.severity,
      observation: event.observation,
      interpretation: event.interpretation,
      time_since_previous: event.time_since_previous,
      recurrence_count: event.recurrence_count,
      values: event.values,
      deviation: event.deviation,
      snapshot_history: event.snapshot_history
    }).catch(err => {
      console.warn('⚠️ IntermittentFaultDetector: DB update warning:', err.message);
    });

    this.recalculateRecurrencePatterns();
  }

  /**
   * Recalculate recurrence patterns and timing across events
   */
  recalculateRecurrencePatterns() {
    const total = this.eventHistory.length;
    if (total === 0) return;

    let totalDuration = 0;
    let minDur = 9999;
    let maxDur = 0;

    this.eventHistory.forEach(ev => {
      const dur = ev.duration || 1;
      totalDuration += dur;
      if (dur < minDur) minDur = dur;
      if (dur > maxDur) maxDur = dur;
    });

    const avgDur = total > 0 ? totalDuration / total : 0;

    // Per equipment metrics
    const byEquip = {
      'P-101': { count: 0, totalDur: 0, last_seen: null, intervals: [], avg_duration: 0, avg_interval: null, pattern: 'NORMAL' },
      'E-101': { count: 0, totalDur: 0, last_seen: null, intervals: [], avg_duration: 0, avg_interval: null, pattern: 'NORMAL' },
      'R-101': { count: 0, totalDur: 0, last_seen: null, intervals: [], avg_duration: 0, avg_interval: null, pattern: 'NORMAL' },
      'D-101': { count: 0, totalDur: 0, last_seen: null, intervals: [], avg_duration: 0, avg_interval: null, pattern: 'NORMAL' }
    };

    // Group events by equipment
    const equipGroups = {};
    this.eventHistory.forEach(ev => {
      if (!equipGroups[ev.equipment_id]) equipGroups[ev.equipment_id] = [];
      equipGroups[ev.equipment_id].push(ev);
    });

    Object.keys(byEquip).forEach(tag => {
      const list = equipGroups[tag] || [];
      byEquip[tag].count = list.length;
      if (list.length > 0) {
        byEquip[tag].last_seen = list[0].start_time;
        const durSum = list.reduce((acc, x) => acc + (x.duration || 0), 0);
        byEquip[tag].avg_duration = Number((durSum / list.length).toFixed(1));

        // Calculate intervals
        const sortedTimes = list.map(x => new Date(x.start_time).getTime()).sort((a, b) => a - b);
        const intervals = [];
        for (let i = 1; i < sortedTimes.length; i++) {
          intervals.push((sortedTimes[i] - sortedTimes[i - 1]) / 1000);
        }
        if (intervals.length > 0) {
          const meanInt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          byEquip[tag].avg_interval = Number(meanInt.toFixed(1));
        }

        if (list.length === 1) {
          byEquip[tag].pattern = (list[0].pattern === 'ISOLATED TRANSIENT' || list[0].pattern === 'ISOLATED') ? 'ISOLATED' : 'NON-REPEATABLE';
        } else if (list.length === 2) {
          const intVal = (sortedTimes[1] - sortedTimes[0]) / 1000;
          byEquip[tag].pattern = intVal <= 180 ? 'INTERMITTENT' : 'SPORADIC';
          list.forEach(item => { item.pattern = byEquip[tag].pattern; item.event_type = byEquip[tag].pattern; });
        } else {
          // 3 or more
          const meanInt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const variance = intervals.reduce((a, b) => a + Math.pow(b - meanInt, 2), 0) / intervals.length;
          const cv = meanInt > 0 ? Math.sqrt(variance) / meanInt : 0;
          byEquip[tag].pattern = (intervals.length <= 3 || cv <= 0.85 || meanInt <= 120) ? 'RECURRENT' : 'SPORADIC';
          list.forEach(item => { item.pattern = byEquip[tag].pattern; item.event_type = byEquip[tag].pattern; });
        }
      }
    });

    // Count pattern occurrences across all stored events
    let nonRepeatableCount = 0;
    let isolatedCount = 0;
    let sporadicCount = 0;
    let intermittentCount = 0;
    let recurrentCount = 0;
    let persistentCount = 0;

    this.eventHistory.forEach(e => {
      const p = e.pattern || e.event_type;
      if (p === 'NON-REPEATABLE') nonRepeatableCount++;
      else if (p === 'ISOLATED TRANSIENT' || p === 'ISOLATED') isolatedCount++;
      else if (p === 'SPORADIC') sporadicCount++;
      else if (p === 'INTERMITTENT') intermittentCount++;
      else if (p === 'RECURRENT') recurrentCount++;
      else if (p === 'PERSISTENT') persistentCount++;
      else nonRepeatableCount++;
    });

    let overallPattern = 'NORMAL';
    if (recurrentCount >= 1 || Object.values(byEquip).some(eq => eq.pattern === 'RECURRENT')) {
      overallPattern = 'RECURRENT';
    } else if (intermittentCount >= 1 || Object.values(byEquip).some(eq => eq.pattern === 'INTERMITTENT')) {
      overallPattern = 'INTERMITTENT';
    } else if (sporadicCount >= 1 || Object.values(byEquip).some(eq => eq.pattern === 'SPORADIC')) {
      overallPattern = 'SPORADIC';
    } else if (nonRepeatableCount >= 1 || Object.values(byEquip).some(eq => eq.pattern === 'NON-REPEATABLE')) {
      overallPattern = 'NON-REPEATABLE';
    } else if (isolatedCount >= 1 || Object.values(byEquip).some(eq => eq.pattern === 'ISOLATED')) {
      overallPattern = 'ISOLATED';
    }

    this.recurrenceStats = {
      total_events: total,
      active_events: this.getActiveEvents().length,
      non_repeatable_events: nonRepeatableCount,
      isolated_events: isolatedCount,
      sporadic_events: sporadicCount,
      intermittent_events: intermittentCount,
      recurrent_events: recurrentCount,
      persistent_events: persistentCount,
      avg_duration: Number(avgDur.toFixed(1)),
      min_duration: minDur === 9999 ? 0 : Number(minDur.toFixed(1)),
      max_duration: Number(maxDur.toFixed(1)),
      last_event_time: this.eventHistory[0]?.start_time || null,
      first_event_time: this.eventHistory[this.eventHistory.length - 1]?.start_time || null,
      overall_pattern: overallPattern,
      by_equipment: byEquip
    };
  }

  updateLiveRecurrenceSummary() {
    this.recurrenceStats.active_events = this.getActiveEvents().length;
  }

  getActiveEvents() {
    const active = [];
    Object.keys(this.equipmentStates).forEach(k => {
      const ev = this.equipmentStates[k].currentEvent;
      if (ev) active.push(ev);
    });
    return active;
  }

  /**
   * Applies controlled transient test pulses (for user testing without breaking ML state)
   */
  applyTestPulse(tel, pulse) {
    if (!pulse || !pulse.equipment) return;
    const now = Date.now();
    let isActive = true;

    if (pulse.phases && Array.isArray(pulse.phases) && pulse.phases.length > 0) {
      let elapsed = now - pulse.startedAt;
      isActive = false;
      for (const ph of pulse.phases) {
        if (elapsed < ph.durationMs) {
          isActive = ph.active;
          break;
        }
        elapsed -= ph.durationMs;
      }
    }

    if (!isActive) return;

    switch (pulse.equipment) {
      case 'pump':
      case 'P-101':
        tel.pump_vibration = 0.32; // transient vibration spike
        tel.pump_rpm = 2190;      // transient RPM dip
        tel.pump_flow = 8.3;       // transient flow dip
        break;
      case 'heat_exchanger':
      case 'E-101':
        tel.hx_delta_t = 5.2;      // transient thermal gradient drop
        tel.hx_outlet_temp = 34.5; // transient hot outlet
        tel.hx_efficiency = 68.0;  // transient efficiency drop
        break;
      case 'reactor':
      case 'R-101':
        tel.reactor_temp = 77.2;   // transient temperature excursion
        tel.reactor_pressure = 2.65; // transient pressure pulse
        break;
      case 'distillation':
      case 'D-101':
        tel.dist_reflux_ratio = 1.10; // transient reflux drop
        tel.dist_top_temp = 85.0;     // transient top temp rise
        break;
    }
  }

  /**
   * Trigger multi-mode transient test pulse
   * @param {string} equipmentId - 'pump' | 'heat_exchanger' | 'reactor' | 'distillation'
   * @param {number|string} modeOrDuration - duration seconds OR mode: 'single_spike' | 'two_pulse' | 'sporadic' | 'three_pulse' | 'persistent'
   */
  triggerTestPulse(equipmentId = 'pump', modeOrDuration = 'single_spike') {
    const norm = equipmentId.toLowerCase().replace(/-/g, '');
    const map = { p101: 'pump', e101: 'heat_exchanger', r101: 'reactor', d101: 'distillation' };
    const target = map[norm] || norm;

    let totalDurationMs = 5000;
    let phases = null;
    const mode = typeof modeOrDuration === 'string' ? modeOrDuration : (modeOrDuration > 15 ? 'persistent' : 'single_spike');

    if (mode === 'two_pulse') {
      // 2 pulses: 3.5s abnormal -> 3.5s nominal -> 3.5s abnormal -> 3.5s nominal
      phases = [
        { durationMs: 3500, active: true },
        { durationMs: 3500, active: false },
        { durationMs: 3500, active: true },
        { durationMs: 3500, active: false }
      ];
      totalDurationMs = 14000;
    } else if (mode === 'three_pulse') {
      // 3 pulses: 3.2s abnormal -> 3.2s nominal -> 3.2s abnormal -> 3.2s nominal -> 3.2s abnormal -> 3.2s nominal
      phases = [
        { durationMs: 3200, active: true },
        { durationMs: 3200, active: false },
        { durationMs: 3200, active: true },
        { durationMs: 3200, active: false },
        { durationMs: 3200, active: true },
        { durationMs: 3200, active: false }
      ];
      totalDurationMs = 19200;
    } else if (mode === 'sporadic') {
      // Irregular pulses: 3.2s abnormal -> 8s nominal -> 2.8s abnormal -> 3s nominal
      phases = [
        { durationMs: 3200, active: true },
        { durationMs: 8000, active: false },
        { durationMs: 2800, active: true },
        { durationMs: 3000, active: false }
      ];
      totalDurationMs = 17000;
    } else if (mode === 'persistent') {
      totalDurationMs = 35000;
      phases = [{ durationMs: 35000, active: true }];
    } else {
      // Single Spike / Non-repeatable (4.5s pulse)
      totalDurationMs = typeof modeOrDuration === 'number' ? modeOrDuration * 1000 : 4500;
      phases = [{ durationMs: totalDurationMs, active: true }];
    }

    this.testPulse = {
      equipment: target,
      mode,
      phases,
      startedAt: Date.now(),
      expiresAt: Date.now() + totalDurationMs,
      durationSec: Math.round(totalDurationMs / 1000)
    };

    return {
      status: 'TEST_PULSE_TRIGGERED',
      equipment: target,
      mode,
      duration_seconds: Math.round(totalDurationMs / 1000),
      expires_at: new Date(this.testPulse.expiresAt).toISOString()
    };
  }

  getState() {
    const active = this.getActiveEvents();
    return {
      timestamp: new Date().toISOString(),
      active_events_count: active.length,
      active_events: active,
      recent_events: this.eventHistory.slice(0, 30),
      recurrence_stats: { ...this.recurrenceStats, active_events: active.length },
      sliding_window: this.slidingWindow.slice(-30),
      equipment_states: {
        pump: { state: this.equipmentStates.pump.state, has_active_event: !!this.equipmentStates.pump.currentEvent },
        heat_exchanger: { state: this.equipmentStates.heat_exchanger.state, has_active_event: !!this.equipmentStates.heat_exchanger.currentEvent },
        reactor: { state: this.equipmentStates.reactor.state, has_active_event: !!this.equipmentStates.reactor.currentEvent },
        distillation: { state: this.equipmentStates.distillation.state, has_active_event: !!this.equipmentStates.distillation.currentEvent }
      }
    };
  }

  async clearHistory() {
    this.eventHistory = [];
    Object.keys(this.equipmentStates).forEach(k => {
      this.equipmentStates[k] = this.createInitialEquipmentState(k, this.equipmentStates[k].tag);
    });
    this.recurrenceStats = {
      total_events: 0,
      active_events: 0,
      non_repeatable_events: 0,
      isolated_events: 0,
      sporadic_events: 0,
      intermittent_events: 0,
      recurrent_events: 0,
      persistent_events: 0,
      avg_duration: 0,
      min_duration: 0,
      max_duration: 0,
      avg_interval: null,
      last_event_time: null,
      first_event_time: null,
      overall_pattern: 'NORMAL',
      by_equipment: {
        'P-101': { count: 0, avg_duration: 0, avg_interval: null, last_seen: null, pattern: 'NORMAL' },
        'E-101': { count: 0, avg_duration: 0, avg_interval: null, last_seen: null, pattern: 'NORMAL' },
        'R-101': { count: 0, avg_duration: 0, avg_interval: null, last_seen: null, pattern: 'NORMAL' },
        'D-101': { count: 0, avg_duration: 0, avg_interval: null, last_seen: null, pattern: 'NORMAL' }
      }
    };
    await clearIntermittentFaultEvents();
    return { cleared: true };
  }
}
