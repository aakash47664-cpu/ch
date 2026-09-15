/**
 * ChemDiag AI — Continuous Process Health & Early-Fault Detection Engine
 * 
 * Implements:
 * 1. Engineering Baselines for all 16 continuous process parameters
 * 2. Sliding-Window Rate-of-Change (Δ/t), Persistence & Trend Direction
 * 3. Multivariable Early Warning Correlation (detecting degradation BEFORE fault thresholds)
 * 4. Progressive Health Scores (0-100%) & Degradation Stages:
 *    NORMAL (>=90%) -> EARLY DEVIATION (80-89%) -> EARLY DEGRADATION (65-79%)
 *    -> DEVELOPING FAULT (45-64%) -> HIGH RISK (25-44%) -> FAULT CONFIRMED (<25%)
 * 5. Overall Plant Process Health Calculation
 * 6. "What Changed?" Real-Time Current vs Baseline Drift Rankings
 * 7. "Equipment to Watch" Dynamic Priority Sorting
 * 8. Process-Wide Causal Propagation (Primary Degradation vs Downstream Impact)
 * 9. Early Warning Progression Event Timeline Buffer
 */

// Exact Engineering Nominal Baselines & Threshold Tolerances
export const BASELINES = {
  // P-101 Centrifugal Pump
  pump_rpm: { nominal: 2450, unit: 'RPM', tol: 150, warnLow: 2350, critLow: 2100, isLowerBad: true, name: 'Pump Speed' },
  pump_vibration: { nominal: 0.08, unit: 'g', tol: 0.06, warnHigh: 0.15, devHigh: 0.22, critHigh: 0.40, isUpperBad: true, name: 'Casing Vibration' },
  pump_flow: { nominal: 10.0, unit: 'L/min', tol: 0.8, warnLow: 8.8, critLow: 7.0, isLowerBad: true, name: 'Discharge Flow' },
  pump_discharge_pressure: { nominal: 2.80, unit: 'bar', tol: 0.35, warnLow: 2.30, critLow: 1.80, isLowerBad: true, name: 'Discharge Pressure' },
  pump_inlet_temperature: { nominal: 25.2, unit: '°C', tol: 3.0, name: 'Suction Temp' },
  pump_outlet_temperature: { nominal: 38.1, unit: '°C', tol: 4.0, warnHigh: 45.0, critHigh: 55.0, isUpperBad: true, name: 'Discharge Temp' },

  // E-101 Shell & Tube Heat Exchanger
  hx_inlet_temp: { nominal: 38.1, unit: '°C', tol: 4.0, name: 'Exchanger Inlet Temp' },
  hx_outlet_temp: { nominal: 25.2, unit: '°C', tol: 4.0, warnHigh: 32.0, critHigh: 36.0, isUpperBad: true, name: 'Exchanger Outlet Temp' },
  hx_delta_t: { nominal: 12.9, unit: '°C', tol: 2.5, warnLow: 9.0, devLow: 6.5, critLow: 3.5, isLowerBad: true, name: 'Thermal Gradient (ΔT)' },
  hx_efficiency: { nominal: 95.0, unit: '%', tol: 8.0, warnLow: 85.0, devLow: 70.0, critLow: 45.0, isLowerBad: true, name: 'Heat Transfer Efficiency' },
  hx_flow: { nominal: 9.9, unit: 'L/min', tol: 0.8, warnLow: 8.5, critLow: 6.8, isLowerBad: true, name: 'Tube Flow Rate' },

  // R-101 CSTR Reactor (Exothermic Kinetics)
  reactor_temp: { nominal: 65.0, unit: '°C', tol: 4.0, warnHigh: 71.0, devHigh: 78.0, critHigh: 85.0, isUpperBad: true, name: 'Core Temperature' },
  reactor_pressure: { nominal: 2.05, unit: 'bar', tol: 0.25, warnHigh: 2.35, devHigh: 2.70, critHigh: 3.10, isUpperBad: true, name: 'Vessel Pressure' },
  reactor_level: { nominal: 50.0, unit: '%', tol: 10.0, warnLow: 35.0, warnHigh: 70.0, name: 'Liquid Level' },
  reactor_feed_flow: { nominal: 9.8, unit: 'L/min', tol: 0.8, warnLow: 8.4, critLow: 6.5, isLowerBad: true, name: 'Feed Rate' },
  reactor_cooling_status: { nominal: 1, unit: '', tol: 0, critLow: 0.5, isLowerBad: true, name: 'Cooling Jacket Relay' },
  reactor_agitator_speed: { nominal: 350, unit: 'RPM', tol: 25, warnLow: 300, name: 'Agitator Speed' },

  // D-101 Binary Distillation Column
  dist_reflux_ratio: { nominal: 1.85, unit: '', tol: 0.20, warnLow: 1.55, devLow: 1.20, critLow: 0.75, isLowerBad: true, name: 'Reflux Ratio (L/D)' },
  dist_top_temp: { nominal: 76.5, unit: '°C', tol: 3.5, warnHigh: 81.0, devHigh: 86.0, critHigh: 92.0, isUpperBad: true, name: 'Top Vapor Temp' },
  dist_bottom_temp: { nominal: 98.4, unit: '°C', tol: 4.0, warnHigh: 105.0, name: 'Bottom Reboiler Temp' },
  dist_pressure: { nominal: 2.10, unit: 'bar', tol: 0.25, warnHigh: 2.45, critHigh: 2.85, isUpperBad: true, name: 'Column Pressure' },
  dist_feed_flow: { nominal: 9.7, unit: 'L/min', tol: 0.8, warnLow: 8.3, name: 'Column Feed' }
};

export class EarlyFaultEngine {
  constructor() {
    this.historyBuffer = []; // stores up to 60 samples
    this.timelineEvents = []; // stores recent health transition events
    this.prevHealthStages = {
      overall: 'NORMAL',
      pump: 'NORMAL',
      heatExchanger: 'NORMAL',
      reactor: 'NORMAL',
      distillation: 'NORMAL'
    };

    // Seed initial normal timeline event
    this.addTimelineEvent({
      stage: 'NORMAL',
      severity: 'NORMAL',
      equipment: 'All Units',
      message: 'Continuous multi-variable monitoring active. All 4 process units within nominal baselines.'
    });
  }

  addTimelineEvent(event) {
    const entry = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString(),
      timestamp: new Date().toISOString(),
      stage: event.stage || 'NORMAL',
      severity: event.severity || 'NORMAL',
      equipment: event.equipment || 'All Units',
      message: event.message || '',
      parameter: event.parameter || null,
      value: event.value || null
    };

    this.timelineEvents.unshift(entry);
    if (this.timelineEvents.length > 20) {
      this.timelineEvents.pop();
    }
  }

  getHealthStage(score) {
    if (score >= 90) return { stage: 'NORMAL', label: 'HEALTHY', color: '#16A34A', sev: 'NORMAL' };
    if (score >= 80) return { stage: 'EARLY_DEVIATION', label: 'EARLY DEVIATION', color: '#0284C7', sev: 'LOW' };
    if (score >= 65) return { stage: 'EARLY_DEGRADATION', label: 'EARLY DEGRADATION', color: '#D97706', sev: 'MEDIUM' };
    if (score >= 45) return { stage: 'DEVELOPING_FAULT', label: 'DEVELOPING RISK', color: '#EA580C', sev: 'HIGH' };
    if (score >= 25) return { stage: 'HIGH_RISK', label: 'HIGH RISK', color: '#DC2626', sev: 'CRITICAL' };
    return { stage: 'FAULT_CONFIRMED', label: 'FAULT CONFIRMED', color: '#991B1B', sev: 'CRITICAL' };
  }

  processTelemetry(telemetry, activeFault = 'normal') {
    const timestamp = Date.now();
    const currentSample = { ...telemetry, _t: timestamp };

    this.historyBuffer.push(currentSample);
    if (this.historyBuffer.length > 60) {
      this.historyBuffer.shift();
    }

    // 1. Calculate Rate-of-Change and Baseline Deviations for All Variables
    const varMetrics = {};
    const whatChangedList = [];

    const historyLen = this.historyBuffer.length;
    const oldSample = historyLen >= 6 ? this.historyBuffer[Math.max(0, historyLen - 6)] : this.historyBuffer[0];
    const dtSeconds = Math.max(1, (timestamp - oldSample._t) / 1000);

    for (const [key, meta] of Object.entries(BASELINES)) {
      const cur = telemetry[key];
      if (typeof cur !== 'number' || isNaN(cur)) continue;

      const base = meta.nominal;
      const rawDelta = cur - base;
      const pctDelta = base !== 0 ? ((cur - base) / Math.abs(base)) * 100 : 0;
      
      const oldVal = oldSample[key] ?? cur;
      const rateOfChangePerMin = ((cur - oldVal) / dtSeconds) * 60;

      let trend = 'stable';
      if (rateOfChangePerMin > (meta.tol * 0.08)) trend = 'increasing';
      else if (rateOfChangePerMin < -(meta.tol * 0.08)) trend = 'decreasing';

      // Deviation penalty score for health calculation (0 to 1)
      let penalty = 0;
      if (meta.isUpperBad && cur > base) {
        penalty = Math.min(1.0, (cur - base) / (meta.tol * 2.5));
      } else if (meta.isLowerBad && cur < base) {
        penalty = Math.min(1.0, (base - cur) / (meta.tol * 2.5));
      } else {
        penalty = Math.min(1.0, Math.abs(cur - base) / (meta.tol * 3.0));
      }

      varMetrics[key] = {
        key,
        name: meta.name,
        unit: meta.unit,
        current: Number(cur.toFixed(2)),
        baseline: base,
        delta: Number(rawDelta.toFixed(2)),
        deltaPercent: Number(pctDelta.toFixed(1)),
        rateOfChangePerMin: Number(rateOfChangePerMin.toFixed(2)),
        trend,
        penalty: Number(penalty.toFixed(3)),
        isDeviated: Math.abs(pctDelta) > 4.0 || penalty > 0.15
      };

      if (Math.abs(pctDelta) > 3.0 || penalty > 0.15) {
        whatChangedList.push({
          key,
          name: meta.name,
          current: Number(cur.toFixed(2)),
          baseline: base,
          unit: meta.unit,
          deltaPercent: Number(pctDelta.toFixed(1)),
          trend,
          rateOfChange: Number(rateOfChangePerMin.toFixed(2)),
          severity: penalty > 0.6 ? 'HIGH' : (penalty > 0.3 ? 'MEDIUM' : 'LOW')
        });
      }
    }

    // Sort "What Changed?" by absolute delta percentage descending
    whatChangedList.sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent));

    // 2. Compute Individual Equipment Health Scores
    // Pump P-101 Health
    const pumpVibPen = varMetrics.pump_vibration?.penalty || 0;
    const pumpRpmPen = varMetrics.pump_rpm?.penalty || 0;
    const pumpFlowPen = varMetrics.pump_flow?.penalty || 0;
    const pumpDischPen = varMetrics.pump_discharge_pressure?.penalty || 0;
    const pumpPenalty = Math.max(pumpVibPen * 0.55 + pumpRpmPen * 0.25 + pumpFlowPen * 0.20, pumpVibPen * 0.9);
    const pumpHealth = Math.max(5, Math.min(100, Math.round(100 - pumpPenalty * 95)));

    // Heat Exchanger E-101 Health
    const hxDeltaTPen = varMetrics.hx_delta_t?.penalty || 0;
    const hxEffPen = varMetrics.hx_efficiency?.penalty || 0;
    const hxPenalty = Math.max(hxDeltaTPen * 0.5 + hxEffPen * 0.5, hxEffPen * 0.85);
    const hxHealth = Math.max(5, Math.min(100, Math.round(100 - hxPenalty * 95)));

    // Reactor R-101 Health
    const rxTempPen = varMetrics.reactor_temp?.penalty || 0;
    const rxPressPen = varMetrics.reactor_pressure?.penalty || 0;
    const rxCoolPen = (telemetry.reactor_cooling_status === 0) ? 1.0 : 0.0;
    const rxPenalty = Math.max(rxTempPen * 0.45 + rxPressPen * 0.35 + rxCoolPen * 0.9, rxCoolPen, rxTempPen);
    const rxHealth = Math.max(5, Math.min(100, Math.round(100 - rxPenalty * 95)));

    // Distillation D-101 Health
    const distRefluxPen = varMetrics.dist_reflux_ratio?.penalty || 0;
    const distTopTempPen = varMetrics.dist_top_temp?.penalty || 0;
    const distPressPen = varMetrics.dist_pressure?.penalty || 0;
    const distPenalty = Math.max(distRefluxPen * 0.50 + distTopTempPen * 0.35 + distPressPen * 0.15, distRefluxPen * 0.9);
    const distHealth = Math.max(5, Math.min(100, Math.round(100 - distPenalty * 95)));

    // 3. Overall Process Health Score
    // Uses a min-weighted formulation so degradation in any single unit directly impacts overall health
    const minUnitHealth = Math.min(pumpHealth, hxHealth, rxHealth, distHealth);
    const avgUnitHealth = (pumpHealth + hxHealth + rxHealth + distHealth) / 4;
    const overallProcessHealth = Math.round(minUnitHealth * 0.65 + avgUnitHealth * 0.35);

    const overallStage = this.getHealthStage(overallProcessHealth);
    const pumpStage = this.getHealthStage(pumpHealth);
    const hxStage = this.getHealthStage(hxHealth);
    const rxStage = this.getHealthStage(rxHealth);
    const distStage = this.getHealthStage(distHealth);

    // 4. Multivariable Early Warning Evaluation
    const earlyWarnings = [];

    // P-101 Multivariable Correlation
    if (telemetry.pump_vibration > 0.12 || telemetry.pump_rpm < 2400) {
      const isEarlyPump = pumpHealth < 90 && pumpHealth >= 45;
      const isCriticalPump = pumpHealth < 45;
      earlyWarnings.push({
        id: 'EW_P101_DEGRADATION',
        equipment: 'P-101',
        equipment_id: 'pump',
        title: isCriticalPump ? 'CRITICAL PUMP FAULT BOUNDARY' : (isEarlyPump ? 'Early Pump Mechanical Degradation' : 'Minor Speed/Vibration Drift'),
        stage: pumpStage.stage,
        stageLabel: pumpStage.label,
        severity: pumpStage.sev,
        health: pumpHealth,
        summary: `Vibration ${telemetry.pump_vibration.toFixed(2)} g (${varMetrics.pump_vibration?.deltaPercent > 0 ? '+' : ''}${varMetrics.pump_vibration?.deltaPercent}% from baseline) with speed ${Math.round(telemetry.pump_rpm)} RPM.`,
        evidence: [
          `Casing Vibration: ${telemetry.pump_vibration.toFixed(2)} g (${varMetrics.pump_vibration?.trend === 'increasing' ? '↑ Increasing' : '→ Steady'})`,
          `Pump Rotational Speed: ${Math.round(telemetry.pump_rpm)} RPM (${varMetrics.pump_rpm?.trend === 'decreasing' ? '↓ Declining' : '→ Steady'})`,
          `Hydraulic Flow: ${telemetry.pump_flow.toFixed(1)} L/min (${varMetrics.pump_flow?.trend === 'decreasing' ? '↓ Reduced' : 'Nominal'})`
        ],
        primaryVariable: 'Vibration & Speed Drift',
        recommendedAction: isCriticalPump ? 'Emergency operator intervention: throttle feed and prepare standby unit.' : 'Inspect bearing lubrication and check motor drive alignment before next production cycle.'
      });
    }

    // E-101 Multivariable Correlation
    if (telemetry.hx_efficiency < 88.0 || telemetry.hx_delta_t < 10.5) {
      const isCriticalHx = hxHealth < 45;
      earlyWarnings.push({
        id: 'EW_E101_FOULING',
        equipment: 'E-101',
        equipment_id: 'heat_exchanger',
        title: isCriticalHx ? 'SEVERE HEAT EXCHANGER SCALING FOULING' : 'Early Exchanger Thermal Fouling Detected',
        stage: hxStage.stage,
        stageLabel: hxStage.label,
        severity: hxStage.sev,
        health: hxHealth,
        summary: `Thermal gradient ΔT dropped to ${telemetry.hx_delta_t.toFixed(1)} °C with efficiency at ${telemetry.hx_efficiency.toFixed(0)}%.`,
        evidence: [
          `Thermal Gradient (ΔT): ${telemetry.hx_delta_t.toFixed(1)} °C (${varMetrics.hx_delta_t?.trend === 'decreasing' ? '↓ Decaying' : '→ Steady'})`,
          `Heat Transfer Efficiency: ${telemetry.hx_efficiency.toFixed(0)}% (Baseline: 95%)`,
          `Cooling Effluent Temp: ${telemetry.hx_outlet_temp.toFixed(1)} °C`
        ],
        primaryVariable: 'Thermal Gradient (ΔT)',
        recommendedAction: isCriticalHx ? 'Schedule chemical tube cleaning; unconditioned feed affecting reactor.' : 'Monitor thermal resistance progression; schedule maintenance during planned shift window.'
      });
    }

    // R-101 Multivariable Correlation
    if (telemetry.reactor_temp > 68.5 || telemetry.reactor_cooling_status === 0 || telemetry.reactor_pressure > 2.25) {
      const isCriticalRx = rxHealth < 45;
      earlyWarnings.push({
        id: 'EW_R101_THERMAL_ESCALATION',
        equipment: 'R-101',
        equipment_id: 'reactor',
        title: isCriticalRx ? 'CRITICAL EXOTHERMIC RUNAWAY RISK' : 'Early Exothermic Heat Balance Degradation',
        stage: rxStage.stage,
        stageLabel: rxStage.label,
        severity: rxStage.sev,
        health: rxHealth,
        summary: `Core temperature climbing at ${telemetry.reactor_temp.toFixed(1)} °C (pressure ${telemetry.reactor_pressure.toFixed(2)} bar).`,
        evidence: [
          `Reactor Temperature: ${telemetry.reactor_temp.toFixed(1)} °C (${varMetrics.reactor_temp?.trend === 'increasing' ? '↑ Rising' : '→ Steady'})`,
          `Internal Pressure: ${telemetry.reactor_pressure.toFixed(2)} bar (${varMetrics.reactor_pressure?.trend === 'increasing' ? '↑ Pressurizing' : '→ Steady'})`,
          `Cooling System Relay: ${telemetry.reactor_cooling_status === 1 ? 'ACTIVE (1)' : '🚨 TRIPPED / OFF (0)'}`
        ],
        primaryVariable: 'Core Temperature & Vapor Pressure',
        recommendedAction: isCriticalRx ? 'IMMEDIATE OPERATOR SAFETY PROTOCOL: Restore cooling jacket flow and initiate reactor quench.' : 'Verify jacket coolant flow rate and throttle exothermic reactant feed.'
      });
    }

    // D-101 Multivariable Correlation
    if (telemetry.dist_reflux_ratio < 1.65 || telemetry.dist_top_temp > 79.5) {
      const isCriticalDist = distHealth < 45;
      earlyWarnings.push({
        id: 'EW_D101_REFLUX_SLIP',
        equipment: 'D-101',
        equipment_id: 'distillation',
        title: isCriticalDist ? 'CRITICAL DISTILLATION REFLUX STARVATION' : 'Early Reflux Ratio Slip & Temperature Drift',
        stage: distStage.stage,
        stageLabel: distStage.label,
        severity: distStage.sev,
        health: distHealth,
        summary: `Reflux ratio reduced to ${telemetry.dist_reflux_ratio.toFixed(2)} (top vapor temperature ${telemetry.dist_top_temp.toFixed(1)} °C).`,
        evidence: [
          `Reflux Ratio (L/D): ${telemetry.dist_reflux_ratio.toFixed(2)} (${varMetrics.dist_reflux_ratio?.trend === 'decreasing' ? '↓ Slipping' : '→ Steady'})`,
          `Overhead Vapor Temp: ${telemetry.dist_top_temp.toFixed(1)} °C (${varMetrics.dist_top_temp?.trend === 'increasing' ? '↑ Rising' : '→ Steady'})`,
          `Column Pressure: ${telemetry.dist_pressure.toFixed(2)} bar`
        ],
        primaryVariable: 'Reflux Ratio (L/D)',
        recommendedAction: isCriticalDist ? 'Adjust overhead reflux control valve and verify reflux pump head.' : 'Check overhead condenser subcooling and inspect reflux control loop trim.'
      });
    }

    // 5. "Equipment to Watch" (Dynamic Priority Attention Ranking)
    const watchList = [
      {
        id: 'pump',
        equipment: 'P-101',
        name: 'Centrifugal Feed Pump',
        health: pumpHealth,
        stage: pumpStage.stage,
        stageLabel: pumpStage.label,
        severity: pumpStage.sev,
        attentionLevel: pumpHealth < 50 ? 'CRITICAL ATTENTION' : (pumpHealth < 75 ? 'HIGH ATTENTION' : (pumpHealth < 88 ? 'MODERATE ATTENTION' : 'NORMAL')),
        attentionRank: pumpHealth < 50 ? 4 : (pumpHealth < 75 ? 3 : (pumpHealth < 88 ? 2 : 1)),
        primaryIssue: pumpHealth < 90 ? `Vibration ${telemetry.pump_vibration.toFixed(2)} g (${varMetrics.pump_vibration?.trend === 'increasing' ? '↑ increasing' : 'elevated'})` : 'Operating within nominal baseline',
        keyVars: [
          { name: 'RPM', val: `${Math.round(telemetry.pump_rpm)}`, trend: varMetrics.pump_rpm?.trend },
          { name: 'Vibration', val: `${telemetry.pump_vibration.toFixed(2)} g`, trend: varMetrics.pump_vibration?.trend },
          { name: 'Flow', val: `${telemetry.pump_flow.toFixed(1)} L/min`, trend: varMetrics.pump_flow?.trend }
        ]
      },
      {
        id: 'heat_exchanger',
        equipment: 'E-101',
        name: 'Shell & Tube Exchanger',
        health: hxHealth,
        stage: hxStage.stage,
        stageLabel: hxStage.label,
        severity: hxStage.sev,
        attentionLevel: hxHealth < 50 ? 'CRITICAL ATTENTION' : (hxHealth < 75 ? 'HIGH ATTENTION' : (hxHealth < 88 ? 'MODERATE ATTENTION' : 'NORMAL')),
        attentionRank: hxHealth < 50 ? 4 : (hxHealth < 75 ? 3 : (hxHealth < 88 ? 2 : 1)),
        primaryIssue: hxHealth < 90 ? `Thermal ΔT ${telemetry.hx_delta_t.toFixed(1)} °C (decaying)` : 'Operating within nominal baseline',
        keyVars: [
          { name: 'ΔT', val: `${telemetry.hx_delta_t.toFixed(1)} °C`, trend: varMetrics.hx_delta_t?.trend },
          { name: 'Efficiency', val: `${telemetry.hx_efficiency.toFixed(0)}%`, trend: varMetrics.hx_efficiency?.trend },
          { name: 'Outlet Temp', val: `${telemetry.hx_outlet_temp.toFixed(1)} °C`, trend: varMetrics.hx_outlet_temp?.trend }
        ]
      },
      {
        id: 'reactor',
        equipment: 'R-101',
        name: 'Exothermic CSTR Reactor',
        health: rxHealth,
        stage: rxStage.stage,
        stageLabel: rxStage.label,
        severity: rxStage.sev,
        attentionLevel: rxHealth < 50 ? 'CRITICAL ATTENTION' : (rxHealth < 75 ? 'HIGH ATTENTION' : (rxHealth < 88 ? 'MODERATE ATTENTION' : 'NORMAL')),
        attentionRank: rxHealth < 50 ? 4 : (rxHealth < 75 ? 3 : (rxHealth < 88 ? 2 : 1)),
        primaryIssue: rxHealth < 90 ? `Core temp ${telemetry.reactor_temp.toFixed(1)} °C (climbing)` : 'Operating within nominal baseline',
        keyVars: [
          { name: 'Temp', val: `${telemetry.reactor_temp.toFixed(1)} °C`, trend: varMetrics.reactor_temp?.trend },
          { name: 'Pressure', val: `${telemetry.reactor_pressure.toFixed(2)} bar`, trend: varMetrics.reactor_pressure?.trend },
          { name: 'Cooling', val: telemetry.reactor_cooling_status === 1 ? 'ON' : 'TRIPPED', trend: 'stable' }
        ]
      },
      {
        id: 'distillation',
        equipment: 'D-101',
        name: 'Binary Distillation Column',
        health: distHealth,
        stage: distStage.stage,
        stageLabel: distStage.label,
        severity: distStage.sev,
        attentionLevel: distHealth < 50 ? 'CRITICAL ATTENTION' : (distHealth < 75 ? 'HIGH ATTENTION' : (distHealth < 88 ? 'MODERATE ATTENTION' : 'NORMAL')),
        attentionRank: distHealth < 50 ? 4 : (distHealth < 75 ? 3 : (distHealth < 88 ? 2 : 1)),
        primaryIssue: distHealth < 90 ? `Reflux ratio ${telemetry.dist_reflux_ratio.toFixed(2)} (sub-optimal)` : 'Operating within nominal baseline',
        keyVars: [
          { name: 'Reflux', val: `${telemetry.dist_reflux_ratio.toFixed(2)}`, trend: varMetrics.dist_reflux_ratio?.trend },
          { name: 'Top Temp', val: `${telemetry.dist_top_temp.toFixed(1)} °C`, trend: varMetrics.dist_top_temp?.trend },
          { name: 'Pressure', val: `${telemetry.dist_pressure.toFixed(2)} bar`, trend: varMetrics.dist_pressure?.trend }
        ]
      }
    ];

    // Sort watch list by attention rank descending (lowest health first)
    watchList.sort((a, b) => b.attentionRank - a.attentionRank || a.health - b.health);

    // 6. Process-Wide Causal Propagation
    let primaryDegradationUnit = 'None';
    let downstreamConsequences = [];

    if (activeFault.includes('pump') || (pumpHealth < hxHealth && pumpHealth < 88)) {
      primaryDegradationUnit = 'P-101 Centrifugal Pump';
      downstreamConsequences = [
        { unit: 'E-101', impact: `Feed throughput reduced to ${telemetry.pump_flow.toFixed(1)} L/min` },
        { unit: 'R-101', impact: `Residence time increased (+${Math.max(0, ((10 - telemetry.pump_flow) * 8)).toFixed(0)}%)` },
        { unit: 'D-101', impact: `Column feed rate reduced to ${(telemetry.pump_flow * 0.97).toFixed(1)} L/min` }
      ];
    } else if (activeFault.includes('exchanger') || (hxHealth < rxHealth && hxHealth < 88)) {
      primaryDegradationUnit = 'E-101 Heat Exchanger';
      downstreamConsequences = [
        { unit: 'R-101', impact: `Sub-optimal inlet enthalpy entering reactor core (${telemetry.hx_outlet_temp.toFixed(1)} °C)` },
        { unit: 'D-101', impact: 'Downstream separation column operating at thermal boundary shift' }
      ];
    } else if (activeFault.includes('reactor') || (rxHealth < distHealth && rxHealth < 88)) {
      primaryDegradationUnit = 'R-101 CSTR Reactor';
      downstreamConsequences = [
        { unit: 'D-101', impact: `Overheated feed stream entering distillation column (${telemetry.reactor_temp.toFixed(1)} °C)` }
      ];
    } else if (activeFault.includes('distillation') || distHealth < 88) {
      primaryDegradationUnit = 'D-101 Distillation Column';
      downstreamConsequences = [
        { unit: 'Product Tank', impact: 'Overhead distillate purity compromised due to reflux starvation' }
      ];
    }

    // 7. Timeline Transition Events Logger
    if (overallStage.stage !== this.prevHealthStages.overall) {
      const isImprovement = overallProcessHealth > (this.prevHealthStages.overallScore || 50);
      this.addTimelineEvent({
        stage: overallStage.stage,
        severity: overallStage.sev,
        equipment: 'Plant Process Health',
        message: isImprovement 
          ? `Process health recovered to ${overallProcessHealth}% (${overallStage.label}).` 
          : `Process health transitioned to ${overallProcessHealth}% (${overallStage.label}).`
      });
      this.prevHealthStages.overall = overallStage.stage;
      this.prevHealthStages.overallScore = overallProcessHealth;
    }

    // Log individual unit transitions if significant
    const checkUnitTransition = (unitKey, unitName, currentStage, currentHealth) => {
      if (currentStage.stage !== this.prevHealthStages[unitKey] && currentStage.stage !== 'NORMAL') {
        this.addTimelineEvent({
          stage: currentStage.stage,
          severity: currentStage.sev,
          equipment: unitName,
          message: `${unitName} health reached ${currentHealth}% (${currentStage.label}).`
        });
        this.prevHealthStages[unitKey] = currentStage.stage;
      }
    };

    checkUnitTransition('pump', 'P-101 Pump', pumpStage, pumpHealth);
    checkUnitTransition('heatExchanger', 'E-101 Exchanger', hxStage, hxHealth);
    checkUnitTransition('reactor', 'R-101 Reactor', rxStage, rxHealth);
    checkUnitTransition('distillation', 'D-101 Distillation', distStage, distHealth);

    return {
      process_health: {
        score: overallProcessHealth,
        stage: overallStage.stage,
        label: overallStage.label,
        color: overallStage.color,
        severity: overallStage.sev,
        summary: overallProcessHealth >= 90
          ? 'Continuous monitoring active. All 4 units operating within nominal design tolerances.'
          : (overallProcessHealth >= 65
            ? 'Early degradation detected. Non-nominal trend drift observed prior to failure boundaries.'
            : 'Significant process degradation observed. Preventive intervention recommended.')
      },
      equipment_health: {
        pump: {
          id: 'pump',
          equipment: 'P-101',
          name: 'Pump (6V Mini Centrifugal)',
          health: pumpHealth,
          stage: pumpStage.stage,
          label: pumpStage.label,
          color: pumpStage.color,
          severity: pumpStage.sev,
          primaryVar: `Vibration ${telemetry.pump_vibration.toFixed(2)} g`,
          trend: varMetrics.pump_vibration?.trend,
          metrics: {
            rpm: varMetrics.pump_rpm,
            vibration: varMetrics.pump_vibration,
            flow: varMetrics.pump_flow,
            discharge_pressure: varMetrics.pump_discharge_pressure,
            inlet_temp: varMetrics.pump_inlet_temperature,
            outlet_temp: varMetrics.pump_outlet_temperature
          }
        },
        heat_exchanger: {
          id: 'heat_exchanger',
          equipment: 'E-101',
          name: 'Heat Exchanger (Shell & Tube)',
          health: hxHealth,
          stage: hxStage.stage,
          label: hxStage.label,
          color: hxStage.color,
          severity: hxStage.sev,
          primaryVar: `ΔT ${telemetry.hx_delta_t.toFixed(1)} °C`,
          trend: varMetrics.hx_delta_t?.trend,
          metrics: {
            inlet_temp: varMetrics.hx_inlet_temp,
            outlet_temp: varMetrics.hx_outlet_temp,
            delta_t: varMetrics.hx_delta_t,
            efficiency: varMetrics.hx_efficiency,
            flow: varMetrics.hx_flow
          }
        },
        reactor: {
          id: 'reactor',
          equipment: 'R-101',
          name: 'Continuous Stirred-Tank Reactor (CSTR)',
          health: rxHealth,
          stage: rxStage.stage,
          label: rxStage.label,
          color: rxStage.color,
          severity: rxStage.sev,
          primaryVar: `Core Temp ${telemetry.reactor_temp.toFixed(1)} °C`,
          trend: varMetrics.reactor_temp?.trend,
          metrics: {
            temperature: varMetrics.reactor_temp,
            pressure: varMetrics.reactor_pressure,
            level: varMetrics.reactor_level,
            feed_flow: varMetrics.reactor_feed_flow,
            cooling_status: varMetrics.reactor_cooling_status,
            agitator_speed: varMetrics.reactor_agitator_speed
          }
        },
        distillation: {
          id: 'distillation',
          equipment: 'D-101',
          name: 'Binary Distillation Column',
          health: distHealth,
          stage: distStage.stage,
          label: distStage.label,
          color: distStage.color,
          severity: distStage.sev,
          primaryVar: `Reflux ${telemetry.dist_reflux_ratio.toFixed(2)}`,
          trend: varMetrics.dist_reflux_ratio?.trend,
          metrics: {
            reflux_ratio: varMetrics.dist_reflux_ratio,
            top_temperature: varMetrics.dist_top_temp,
            bottom_temperature: varMetrics.dist_bottom_temp,
            pressure: varMetrics.dist_pressure,
            feed_flow: varMetrics.dist_feed_flow
          }
        }
      },
      early_warnings: earlyWarnings,
      what_changed: whatChangedList.slice(0, 8),
      watch_list: watchList,
      causal_propagation: {
        primarySource: primaryDegradationUnit,
        downstreamConsequences
      },
      timeline_events: this.timelineEvents.slice(0, 10),
      all_metrics: varMetrics
    };
  }
}
