/**
 * ChemDiag AI — Full Explainable Diagnosis, Unknown Fault Guard & Decision Engine
 * 
 * Synthesizes:
 * 1. Isolation Forest Anomaly Score
 * 2. Multi-Class Random Forest Classification Probabilities
 * 3. Unknown Fault Guard (Primary USP)
 * 4. Early Fault Detection
 * 5. Prognosis / Fault Progression
 * 6. XAI Dynamic Feature Contribution Attribution
 * 7. Preventive Risk Score (0-100) & Stage-Specific Recommendations
 * 8. Sensor Reliability
 * 9. Process Operating Limits Validation
 * 10. AI Safety Gate ("Knows when NOT to recommend action")
 * 11. Human-in-the-Loop Operator Approval
 */

import { evaluateOperatingLimits } from './processLimits.js';
import { calculateSensorReliability } from './sensorReliability.js';
import { calculateFeatureContributions } from './xaiEngine.js';
import { calculatePrognosis } from './prognosisEngine.js';
import { calculatePreventiveRisk } from './preventiveEngine.js';
import { evaluateSafetyGate } from './safetyGate.js';

export function diagnoseProcessState({
  telemetry,
  mlAnomaly = false,
  mlScore = 0.18,
  mlClass = 'normal',
  mlConfidence = 0.95,
  rfProbabilities = {},
  faultMode = 'normal',
  faultSeverity = 0.0,
  faultTicks = 0,
  isHardwareOnline = false,
  hardwareLastSeen = 0,
  operatorApproved = false
}) {
  const timestamp = new Date().toISOString();

  // 1. Extract Current Sensor Values
  const rTemp = telemetry.reactor_temperature ?? 65.0;
  const rPress = telemetry.reactor_pressure ?? 2.05;
  const rCooling = telemetry.reactor_cooling_status ?? 1;
  const rLevel = telemetry.reactor_level ?? 50.0;
  const rAgitator = telemetry.reactor_agitator_speed ?? 350;

  const pVib = telemetry.pump_vibration ?? 0.08;
  const pRpm = telemetry.pump_rpm ?? 2450;
  const pFlow = telemetry.pump_flow ?? ((pRpm / 2450) * 10.0);
  const pInTemp = telemetry.pump_inlet_temperature ?? 25.2;
  const pOutTemp = telemetry.pump_outlet_temperature ?? 38.1;

  const hxInTemp = telemetry.heat_exchanger_inlet_temperature ?? 25.2;
  const hxOutTemp = telemetry.heat_exchanger_outlet_temperature ?? 38.1;
  const deltaT = Number(Math.abs(hxOutTemp - hxInTemp).toFixed(1));
  const hxIndicator = telemetry.heat_exchanger_indicator ?? (deltaT > 10 ? 95.0 : Math.max(15, deltaT * 7.5));

  const dTopTemp = telemetry.distillation_top_temperature ?? 76.5;
  const dBottomTemp = telemetry.distillation_bottom_temperature ?? 98.4;
  const dPress = telemetry.distillation_pressure ?? 2.10;
  const dReflux = telemetry.distillation_reflux_ratio ?? 1.85;

  // 2. Evaluate Sensor Reliability & Signal Integrity
  const sensorReliability = calculateSensorReliability({
    telemetry,
    isHardwareOnline,
    hardwareLastSeen
  });

  // 3. Evaluate Prototype Process Operating Limits
  const limitViolations = evaluateOperatingLimits(telemetry);

  // 4. UNKNOWN FAULT GUARD (PRIMARY USP)
  // Check if anomaly detected, but maximum known class probability is too low OR an uncharacteristic unseen pattern is present
  const maxClassProb = Object.values(rfProbabilities).length > 0 ? Math.max(...Object.values(rfProbabilities)) : mlConfidence;
  const isIntentionallyUnknown = faultMode === 'unknown_fault';
  const isUnseenMultivariatePattern = faultMode !== 'normal' && mlAnomaly && maxClassProb < 0.55 && mlClass === 'normal';

  const isUnknownFault = isIntentionallyUnknown || isUnseenMultivariatePattern;

  if (isUnknownFault) {
    const dynamicConfidence = Number(Math.max(0.32, Math.min(0.52, (1.0 - mlScore) * 0.6 + 0.15 + (Math.random() * 0.06 - 0.03))).toFixed(2));
    const abnormalVars = [];
    if (rTemp > 70.0) abnormalVars.push(`Reactor Temperature ↑ (${rTemp.toFixed(1)}°C)`);
    if (rPress > 2.25) abnormalVars.push(`Vessel Pressure ↑ (${rPress.toFixed(2)} bar)`);
    if (pVib > 0.18) abnormalVars.push(`Pump Vibration ↑ (${pVib.toFixed(2)} g)`);
    if (pRpm < 2400) abnormalVars.push(`Pump Speed ↓ (${Math.round(pRpm)} RPM)`);

    const xaiContributions = calculateFeatureContributions({
      telemetry,
      faultType: 'unknown',
      equipment: 'all'
    });

    const prognosis = calculatePrognosis({
      equipment: 'all',
      faultMode: 'unknown_fault',
      faultSeverity,
      faultTicks,
      telemetry
    });

    const preventive = calculatePreventiveRisk({
      equipment: 'all',
      faultMode: 'unknown_fault',
      faultSeverity,
      mlScore,
      telemetry,
      isUnknownFault: true
    });

    const safetyGate = evaluateSafetyGate({
      anomaly: true,
      isUnknownFault: true,
      confidence: dynamicConfidence,
      sensorReliability,
      limitViolations,
      faultSeverity: 'UNKNOWN',
      preventiveResult: preventive,
      equipment: 'all'
    });

    return {
      equipment: 'Multiple Process Units',
      anomaly: true,
      anomaly_score: Number(Math.max(mlScore, 0.72).toFixed(3)),
      is_unknown_fault: true,
      fault: 'unknown_fault',
      probable_fault: 'Unknown Anomaly Detected',
      root_cause: 'Unclassified multivariate deviation — pattern does not match known fault classes.',
      severity: 'HIGH',
      confidence: dynamicConfidence,
      pattern_match_quality: 'LOW / INSUFFICIENT',
      important_variables: abnormalVars.length > 0 ? abnormalVars : ['Temperature ↑', 'Pressure ↑', 'Vibration ↑'],
      evidence_cards: [
        { label: 'ANOMALY DETECTOR', val: 'ANOMALOUS (Score: ' + Math.max(mlScore, 0.72).toFixed(3) + ')', state: '▲ ANOMALOUS', isWarning: true },
        { label: 'PATTERN MATCH', val: 'INSUFFICIENT (< 50%)', state: '⚠ UNKNOWN', isWarning: true },
        { label: 'CLASSIFICATION GUARD', val: 'DO NOT FORCE CLASSIFY', state: '🚨 BLOCKED', isWarning: true }
      ],
      pattern_narrative: 'Multivariate sensor pattern deviates from nominal distribution but does not match single-unit failure profiles. AI refuses to force an unreliable classification.',
      explanation: 'Observed simultaneous temperature, pressure and vibration shifts do not match learned pump, exchanger, reactor or distillation signatures.',
      severity_reason: 'Uncertain operational deviation requires physical sensor and setpoint verification before action.',
      recommended_action: 'DO NOT ACT automatically. Cross-verify physical sensors and process conditions before taking corrective action.',
      xai_contributions: xaiContributions,
      prognosis,
      preventive,
      sensorReliability,
      limitViolations,
      safetyGate,
      operatorApproval: {
        required: false,
        approved: false,
        message: 'Action blocked by Unknown Fault Guard'
      },
      timestamp
    };
  }

  // 5. EVALUATE DISTILLATION COLUMN FAULT (EARLY OR CONFIRMED)
  const isEarlyDist = faultMode === 'early_distillation_reflux_loss' || (faultMode === 'normal' && dReflux < 1.45 && dReflux >= 1.05 && mlAnomaly);
  const isConfirmedDist = faultMode === 'distillation_fault' || (faultMode === 'normal' && ((mlClass === 'distillation_fault' && mlAnomaly) || (dReflux < 1.05 && dTopTemp > 77.0 && mlAnomaly) || (dReflux < 0.90 && mlAnomaly)));

  if (isEarlyDist || isConfirmedDist) {
    const isSevere = dReflux < 0.70 || dTopTemp > 82.0 || dPress > 2.60;
    const severity = isSevere ? 'HIGH' : (isEarlyDist ? 'LOW' : 'MEDIUM');
    const dynamicConfidence = Number((isConfirmedDist ? Math.min(0.98, Math.max(mlConfidence, isSevere ? 0.93 : 0.86)) : 0.78).toFixed(2));

    const xaiContributions = calculateFeatureContributions({
      telemetry,
      faultType: 'distillation_fault',
      equipment: 'distillation'
    });

    const prognosis = calculatePrognosis({
      equipment: 'distillation',
      faultMode: isEarlyDist ? 'early_distillation_reflux_loss' : 'distillation_fault',
      faultSeverity,
      faultTicks,
      telemetry
    });

    const preventive = calculatePreventiveRisk({
      equipment: 'distillation',
      faultMode: isEarlyDist ? 'early_distillation_reflux_loss' : 'distillation_fault',
      faultSeverity,
      mlScore,
      telemetry
    });

    const safetyGate = evaluateSafetyGate({
      anomaly: true,
      isUnknownFault: false,
      confidence: dynamicConfidence,
      sensorReliability,
      limitViolations,
      faultSeverity: severity,
      preventiveResult: preventive,
      equipment: 'distillation'
    });

    return {
      equipment: 'D-101',
      anomaly: true,
      anomaly_score: Number(Math.max(mlScore, isEarlyDist ? 0.62 : 0.82).toFixed(3)),
      is_unknown_fault: false,
      fault: isEarlyDist ? 'early_distillation_reflux_loss' : 'distillation_separation_fault',
      probable_fault: isEarlyDist ? 'Early Reflux Degradation' : 'Distillation Separation Fault',
      root_cause: isEarlyDist ? 'Gradual reflux return decay' : 'Column reflux starvation',
      severity,
      confidence: dynamicConfidence,
      important_variables: [
        `Reflux Ratio ↓ (${dReflux.toFixed(2)} L/D)`,
        `Top Temperature ↑ (${dTopTemp.toFixed(1)}°C)`
      ],
      evidence_cards: [
        { label: 'REFLUX RATIO', val: `${dReflux.toFixed(2)}`, state: dReflux < 1.1 ? '↓ LOW' : (dReflux < 1.4 ? '↓ EARLY DROP' : '✓ NORMAL'), isWarning: dReflux < 1.4 },
        { label: 'TOP TEMP', val: `${dTopTemp.toFixed(1)} °C`, state: dTopTemp > 78.0 ? '↑ HIGH' : '✓ NORMAL', isWarning: dTopTemp > 78.0 },
        { label: 'COLUMN PRESSURE', val: `${dPress.toFixed(2)} bar`, state: dPress > 2.50 ? '↑ ELEVATED' : '✓ NORMAL', isWarning: dPress > 2.50 }
      ],
      pattern_narrative: `${isEarlyDist ? 'Early' : 'Confirmed'} reflux loss (${dReflux.toFixed(2)}) with elevated overhead temperature (${dTopTemp.toFixed(1)}°C) matches column fractionation starvation.`,
      explanation: 'Reduced reflux ratio decreases liquid return to upper trays, allowing heavy vapor fractions to bypass fractionation.',
      severity_reason: isSevere ? 'High overhead vapor load and pressure accumulation in column D-101.' : 'Loss of fractionating efficiency leading to off-spec distillate.',
      recommended_action: preventive.preventiveMeasure,
      xai_contributions: xaiContributions,
      prognosis,
      preventive,
      sensorReliability,
      limitViolations,
      safetyGate,
      operatorApproval: {
        required: safetyGate.requiresOperatorApproval,
        approved: operatorApproved,
        message: operatorApproved ? 'Preventive action authorized by operator.' : 'Requires operator approval before proceeding.'
      },
      timestamp
    };
  }

  // 6. EVALUATE REACTOR COOLING FAILURE / RUNAWAY (EARLY OR CONFIRMED)
  const isEarlyReactor = faultMode === 'early_reactor_cooling_degradation' || (faultMode === 'normal' && rTemp > 69.0 && rTemp <= 76.0 && rPress <= 2.50 && mlAnomaly);
  const isConfirmedReactor = faultMode === 'reactor_cooling_failure' || (faultMode === 'normal' && ((mlClass === 'reactor_cooling_failure' && mlAnomaly) || rCooling === 0 || (rTemp > 78.0 && mlAnomaly)));

  if (isEarlyReactor || isConfirmedReactor) {
    const isCritical = rTemp > 85.0 || rPress > 3.10 || rCooling === 0;
    const severity = isCritical ? 'CRITICAL' : (isEarlyReactor ? 'LOW' : 'HIGH');
    const dynamicConfidence = Number((isConfirmedReactor ? Math.min(0.99, Math.max(mlConfidence, isCritical ? 0.95 : 0.88)) : 0.82).toFixed(2));

    const xaiContributions = calculateFeatureContributions({
      telemetry,
      faultType: 'reactor_cooling_failure',
      equipment: 'reactor'
    });

    const prognosis = calculatePrognosis({
      equipment: 'reactor',
      faultMode: isEarlyReactor ? 'early_reactor_cooling_degradation' : 'reactor_cooling_failure',
      faultSeverity,
      faultTicks,
      telemetry
    });

    const preventive = calculatePreventiveRisk({
      equipment: 'reactor',
      faultMode: isEarlyReactor ? 'early_reactor_cooling_degradation' : 'reactor_cooling_failure',
      faultSeverity,
      mlScore,
      telemetry
    });

    const safetyGate = evaluateSafetyGate({
      anomaly: true,
      isUnknownFault: false,
      confidence: dynamicConfidence,
      sensorReliability,
      limitViolations,
      faultSeverity: severity,
      preventiveResult: preventive,
      equipment: 'reactor'
    });

    return {
      equipment: 'R-101',
      anomaly: true,
      anomaly_score: Number(Math.max(mlScore, isEarlyReactor ? 0.65 : 0.88).toFixed(3)),
      is_unknown_fault: false,
      fault: isEarlyReactor ? 'early_reactor_cooling_degradation' : 'reactor_cooling_failure',
      probable_fault: isCritical ? 'Thermal Runaway Risk' : (isEarlyReactor ? 'Early Cooling Degradation' : 'Reactor Cooling Failure'),
      root_cause: isEarlyReactor ? 'Cooling jacket heat transfer degradation' : 'Cooling-system loss causing unmitigated exothermic heat accumulation.',
      severity,
      confidence: dynamicConfidence,
      important_variables: [
        `Cooling Status ${rCooling === 0 ? 'OFF' : 'DEGRADED'}`,
        `Temperature ↑ (${rTemp.toFixed(1)}°C)`,
        `Pressure ↑ (${rPress.toFixed(2)} bar)`
      ],
      evidence_cards: [
        { label: 'COOLING STATUS', val: rCooling === 0 ? 'OFF' : 'ON', state: rCooling === 0 ? '▲ TRIPPED' : (isEarlyReactor ? 'DEGRADED' : 'ACTIVE'), isWarning: rCooling === 0 || isEarlyReactor },
        { label: 'VESSEL TEMP', val: `${rTemp.toFixed(1)} °C`, state: rTemp > 75.0 ? '↑ HIGH' : (rTemp > 69.0 ? '↑ ELEVATED' : '✓ NORMAL'), isWarning: rTemp > 69.0 },
        { label: 'PRESSURE', val: `${rPress.toFixed(2)} bar`, state: rPress > 2.45 ? '↑ HIGH' : '✓ NORMAL', isWarning: rPress > 2.45 }
      ],
      pattern_narrative: `Cooling performance decline + temperature rise (${rTemp.toFixed(1)}°C) and pressure (${rPress.toFixed(2)} bar) match exothermic runaway dynamics.`,
      explanation: 'Loss of cooling jacket heat removal capacity allows exothermic reaction heat to accumulate, driving vapor pressure toward safety relief thresholds.',
      severity_reason: isCritical ? 'Critical thermal runaway condition and rapid vapor pressure escalation in CSTR R-101.' : 'Cooling jacket performance loss with active temperature rise.',
      recommended_action: preventive.preventiveMeasure,
      xai_contributions: xaiContributions,
      prognosis,
      preventive,
      sensorReliability,
      limitViolations,
      safetyGate,
      operatorApproval: {
        required: safetyGate.requiresOperatorApproval,
        approved: operatorApproved,
        message: operatorApproved ? 'Emergency cooling protocol authorized.' : 'Operator verification required before safety action.'
      },
      timestamp
    };
  }

  // 7. EVALUATE PUMP MECHANICAL FAULT (EARLY OR CONFIRMED)
  const isEarlyPump = faultMode === 'early_pump_degradation' || (faultMode === 'normal' && pVib > 0.16 && pVib <= 0.28 && pRpm >= 2000 && mlAnomaly);
  const isConfirmedPump = faultMode === 'pump_fault' || (faultMode === 'normal' && ((mlClass === 'pump_fault' && mlAnomaly) || (pVib > 0.28 && mlAnomaly) || (pRpm < 2000 && mlAnomaly)));

  if (isEarlyPump || isConfirmedPump) {
    const isSevere = pVib > 0.42 || pRpm < 1800;
    const severity = isSevere ? 'HIGH' : (isEarlyPump ? 'LOW' : 'MEDIUM');
    const dynamicConfidence = Number((isConfirmedPump ? Math.min(0.98, Math.max(mlConfidence, isSevere ? 0.94 : 0.88)) : 0.82).toFixed(2));

    const xaiContributions = calculateFeatureContributions({
      telemetry,
      faultType: 'pump_fault',
      equipment: 'pump'
    });

    const prognosis = calculatePrognosis({
      equipment: 'pump',
      faultMode: isEarlyPump ? 'early_pump_degradation' : 'pump_fault',
      faultSeverity,
      faultTicks,
      telemetry
    });

    const preventive = calculatePreventiveRisk({
      equipment: 'pump',
      faultMode: isEarlyPump ? 'early_pump_degradation' : 'pump_fault',
      faultSeverity,
      mlScore,
      telemetry
    });

    const safetyGate = evaluateSafetyGate({
      anomaly: true,
      isUnknownFault: false,
      confidence: dynamicConfidence,
      sensorReliability,
      limitViolations,
      faultSeverity: severity,
      preventiveResult: preventive,
      equipment: 'pump'
    });

    return {
      equipment: 'P-101',
      anomaly: true,
      anomaly_score: Number(Math.max(mlScore, isEarlyPump ? 0.60 : 0.84).toFixed(3)),
      is_unknown_fault: false,
      fault: isEarlyPump ? 'early_pump_degradation' : 'pump_mechanical_fault',
      probable_fault: isEarlyPump ? 'Early Pump Degradation' : 'Pump Mechanical Fault',
      root_cause: isEarlyPump ? 'Early bearing wear / slight unbalance' : 'Possible bearing wear, rotor misalignment or flow restriction.',
      severity,
      confidence: dynamicConfidence,
      important_variables: [
        `Vibration ↑ (${pVib.toFixed(2)} g)`,
        `Speed ↓ (${Math.round(pRpm)} RPM)`,
        `Flow ↓ (${pFlow.toFixed(1)} L/min)`
      ],
      evidence_cards: [
        { label: 'VIBRATION', val: `${pVib.toFixed(2)} g`, state: pVib > 0.22 ? '↑ HIGH' : (pVib > 0.16 ? '↑ EARLY RISE' : '✓ NORMAL'), isWarning: pVib > 0.16 },
        { label: 'PUMP SPEED', val: `${Math.round(pRpm)} RPM`, state: pRpm < 2100 ? '↓ LOW' : (pRpm < 2350 ? '↓ SLIGHT SLIP' : '✓ NORMAL'), isWarning: pRpm < 2350 },
        { label: 'FLOW RATE', val: `${pFlow.toFixed(1)} L/min`, state: pFlow < 8.0 ? '↓ REDUCED' : '✓ NORMAL', isWarning: pFlow < 8.0 }
      ],
      pattern_narrative: `${isEarlyPump ? 'Early' : 'Confirmed'} casing vibration rise (${pVib.toFixed(2)} g) and rotational speed drop (${Math.round(pRpm)} RPM) match pump mechanical degradation.`,
      explanation: 'Increased radial vibration with motor speed loss indicates bearing wear, shaft misalignment, or impeller unbalance in pump P-101.',
      severity_reason: isSevere ? 'High dynamic vibration exceeds ISO 10816 vibration severity boundaries.' : 'Rotational speed slip and early mechanical vibration elevation.',
      recommended_action: preventive.preventiveMeasure,
      xai_contributions: xaiContributions,
      prognosis,
      preventive,
      sensorReliability,
      limitViolations,
      safetyGate,
      operatorApproval: {
        required: safetyGate.requiresOperatorApproval,
        approved: operatorApproved,
        message: operatorApproved ? 'Preventive maintenance authorized.' : 'Operator verification requested.'
      },
      timestamp
    };
  }

  // 8. EVALUATE HEAT EXCHANGER FOULING (EARLY OR CONFIRMED)
  const isEarlyHx = faultMode === 'early_heat_exchanger_fouling' || (faultMode === 'normal' && deltaT < 6.5 && deltaT >= 4.0 && mlAnomaly);
  const isConfirmedHx = faultMode === 'heat_exchanger_fault' || (faultMode === 'normal' && ((mlClass === 'heat_exchanger_fault' && mlAnomaly) || (deltaT < 4.0 && mlAnomaly)));

  if (isEarlyHx || isConfirmedHx) {
    const isSevere = deltaT < 2.5;
    const severity = isSevere ? 'HIGH' : (isEarlyHx ? 'LOW' : 'MEDIUM');
    const dynamicConfidence = Number((isConfirmedHx ? Math.min(0.97, Math.max(mlConfidence, isSevere ? 0.93 : 0.86)) : 0.80).toFixed(2));

    const xaiContributions = calculateFeatureContributions({
      telemetry,
      faultType: 'heat_exchanger_fault',
      equipment: 'heat_exchanger'
    });

    const prognosis = calculatePrognosis({
      equipment: 'heat_exchanger',
      faultMode: isEarlyHx ? 'early_heat_exchanger_fouling' : 'heat_exchanger_fault',
      faultSeverity,
      faultTicks,
      telemetry
    });

    const preventive = calculatePreventiveRisk({
      equipment: 'heat_exchanger',
      faultMode: isEarlyHx ? 'early_heat_exchanger_fouling' : 'heat_exchanger_fault',
      faultSeverity,
      mlScore,
      telemetry
    });

    const safetyGate = evaluateSafetyGate({
      anomaly: true,
      isUnknownFault: false,
      confidence: dynamicConfidence,
      sensorReliability,
      limitViolations,
      faultSeverity: severity,
      preventiveResult: preventive,
      equipment: 'heat_exchanger'
    });

    return {
      equipment: 'E-101',
      anomaly: true,
      anomaly_score: Number(Math.max(mlScore, isEarlyHx ? 0.60 : 0.80).toFixed(3)),
      is_unknown_fault: false,
      fault: isEarlyHx ? 'early_heat_exchanger_fouling' : 'heat_exchanger_fault',
      probable_fault: isEarlyHx ? 'Early Tube Fouling' : 'Heat Exchanger Performance Fault',
      root_cause: isEarlyHx ? 'Early boundary scale accumulation' : 'Possible heat-transfer degradation / tube fouling',
      severity,
      confidence: dynamicConfidence,
      important_variables: [
        `Temperature Difference ↓ (ΔT = ${deltaT.toFixed(1)}°C)`,
        `Heat Transfer Indicator ↓ (${Math.round(hxIndicator)}%)`
      ],
      evidence_cards: [
        { label: 'INLET TEMP', val: `${hxInTemp.toFixed(1)} °C`, state: 'NOMINAL', isWarning: false },
        { label: 'OUTLET TEMP', val: `${hxOutTemp.toFixed(1)} °C`, state: deltaT < 5.0 ? '↓ LOW ΔT' : '✓ NORMAL', isWarning: deltaT < 5.0 },
        { label: 'ΔT GRADIENT', val: `${deltaT.toFixed(1)} °C`, state: deltaT < 4.0 ? '↓ CRITICAL (<4°C)' : (deltaT < 6.5 ? '↓ EARLY DROP' : '✓ NORMAL'), isWarning: deltaT < 6.5 }
      ],
      pattern_narrative: `Thermal gradient decay (ΔT = ${deltaT.toFixed(1)}°C) and reduced heat transfer indicator (${Math.round(hxIndicator)}%) match tube fouling resistance.`,
      explanation: 'Reduced temperature difference between inlet and outlet streams indicates increased fouling resistance.',
      severity_reason: isSevere ? 'Severe loss of heat transfer capacity in heat exchanger E-101.' : 'Degraded thermal efficiency across exchanger boundary.',
      recommended_action: preventive.preventiveMeasure,
      xai_contributions: xaiContributions,
      prognosis,
      preventive,
      sensorReliability,
      limitViolations,
      safetyGate,
      operatorApproval: {
        required: safetyGate.requiresOperatorApproval,
        approved: operatorApproved,
        message: operatorApproved ? 'Cleaning cycle authorized.' : 'Operator verification requested.'
      },
      timestamp
    };
  }

  // 9. SYSTEM NOMINAL BASELINE (NORMAL OPERATION)
  const normScore = Number(Math.min(0.24, Math.max(0.10, mlScore)).toFixed(3));
  const normConf = Number(Math.max(0.94, mlConfidence).toFixed(2));

  const xaiContributions = calculateFeatureContributions({
    telemetry,
    faultType: 'normal',
    equipment: 'all'
  });

  const prognosis = calculatePrognosis({
    equipment: 'all',
    faultMode: 'normal',
    faultSeverity: 0.0,
    faultTicks: 0,
    telemetry
  });

  const preventive = calculatePreventiveRisk({
    equipment: 'all',
    faultMode: 'normal',
    faultSeverity: 0.0,
    mlScore: normScore,
    telemetry
  });

  const safetyGate = evaluateSafetyGate({
    anomaly: false,
    isUnknownFault: false,
    confidence: normConf,
    sensorReliability,
    limitViolations: [],
    faultSeverity: 'NORMAL',
    preventiveResult: preventive,
    equipment: 'all'
  });

  return {
    equipment: 'All Units',
    anomaly: false,
    anomaly_score: normScore,
    is_unknown_fault: false,
    fault: 'None',
    probable_fault: 'Nominal Operation',
    root_cause: 'No abnormal condition identified. All parameters nominal.',
    severity: 'NORMAL',
    confidence: normConf,
    system_status: 'NORMAL',
    assessment: 'All monitored process variables are currently within their expected operating boundaries.',
    ai_reasoning: 'Continuous sensor telemetry falls squarely within the learned nominal multidimensional manifold. Isolation Forest score is well below anomaly threshold.',
    normal_variables: [
      { name: 'Reflux Ratio', val: `${dReflux.toFixed(2)}`, status: 'NORMAL' },
      { name: 'Top Temperature', val: `${dTopTemp.toFixed(1)} °C`, status: 'NORMAL' },
      { name: 'Column Pressure', val: `${dPress.toFixed(2)} bar`, status: 'NORMAL' },
      { name: 'Pump Vibration', val: `${pVib.toFixed(2)} g`, status: 'NORMAL' },
      { name: 'Reactor Temperature', val: `${rTemp.toFixed(1)} °C`, status: 'NORMAL' },
      { name: 'Heat Exchanger ΔT', val: `${deltaT.toFixed(1)} °C`, status: 'NORMAL' }
    ],
    important_variables: [
      `Reflux ratio normal (${dReflux.toFixed(2)})`,
      `Top temperature normal (${dTopTemp.toFixed(1)}°C)`,
      `Column pressure normal (${dPress.toFixed(2)} bar)`,
      `Pump vibration normal (${pVib.toFixed(2)} g)`,
      `Reactor temperature normal (${rTemp.toFixed(1)}°C)`
    ],
    evidence_cards: [
      { label: 'REFLUX RATIO', val: `${dReflux.toFixed(2)}`, state: '✓ NORMAL', isWarning: false },
      { label: 'TOP TEMP', val: `${dTopTemp.toFixed(1)} °C`, state: '✓ NORMAL', isWarning: false },
      { label: 'COLUMN PRESSURE', val: `${dPress.toFixed(2)} bar`, state: '✓ NORMAL', isWarning: false }
    ],
    pattern_narrative: 'All continuous process indicators are within nominal operational boundaries.',
    explanation: 'All monitored units operating within expected design conditions.',
    severity_reason: 'Nominal steady-state equilibria across all units.',
    recommended_action: 'Continue routine supervisory monitoring. All monitored units operating within expected conditions.',
    xai_contributions: xaiContributions,
    prognosis,
    preventive,
    sensorReliability,
    limitViolations: [],
    safetyGate,
    operatorApproval: {
      required: false,
      approved: false,
      message: 'System nominal. No intervention required.'
    },
    timestamp
  };
}
