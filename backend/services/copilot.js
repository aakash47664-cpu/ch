/**
 * ChemDiag Local Process AI Copilot Service
 * 
 * High-intelligence local process engineering copilot that operates 100% locally
 * without requiring external API keys or internet access.
 * 
 * Uses:
 * - Current sensor values (live simulated / real ESP32)
 * - Current equipment states
 * - Existing ML diagnosis & Isolation/Random Forest models
 * - Chemical process engineering rules
 * - Current alerts
 * - Recent trend/historical values
 */

// Equipment alias dictionary with both industrial tags and common names
const EQUIPMENT_ALIASES = {
  pump: ['pump', 'p-101', 'p101', 'centrifugal', 'impeller', 'motor', 'rpm', 'vibration', 'bearing'],
  heat_exchanger: ['heat exchanger', 'heat-exchanger', 'e-101', 'e-102', 'e101', 'e102', 'hx', 'exchanger', 'delta t', 'fouling', 'cooler', 'condenser', 'heat transfer', 'shell and tube'],
  reactor: ['reactor', 'r-101', 'r-201', 'r101', 'r201', 'cstr', 'vessel', 'jacket', 'runaway', 'exothermic', 'agitator', 'cooling status', 'reaction'],
  distillation: ['distillation', 'column', 't-101', 't-301', 't101', 't301', 'd-101', 'd101', 'reflux', 'reboiler', 'overhead', 'tray', 'fractionator', 'distillate', 'top temperature', 'bottom temperature']
};

// Nominal baseline parameters for trend comparisons
const NOMINAL_BASELINES = {
  pump: {
    rpm: 2450,
    vibration: 0.08,
    inlet_temperature: 25.2,
    outlet_temperature: 38.1
  },
  heat_exchanger: {
    inlet_temperature: 25.2,
    outlet_temperature: 38.1,
    temperature_difference: 12.9,
    heat_transfer_indicator: 95.0
  },
  reactor: {
    temperature: 65.0,
    pressure: 2.05,
    level: 50.0,
    agitator_speed: 350,
    cooling_status: 1
  },
  distillation: {
    top_temperature: 76.5,
    bottom_temperature: 98.4,
    pressure: 2.10,
    level: 52.0,
    reflux_ratio: 1.85
  }
};

/**
 * Resolves which equipment is being referred to in the question or conversational context.
 * Resolves pronouns like "it", "this", "the problem", "that equipment", "why is it serious?".
 */
export function getEquipmentContext(query = '', selectedEquipment = null, history = []) {
  const q = query.toLowerCase().trim();

  // If general overview or multi-equipment comparison
  if (
    q.includes('compare') ||
    (q.includes('all') && q.includes('equipment')) ||
    (q.includes('process') && (q.includes('summary') || q.includes('status') || q.includes('overview') || q.includes('normal')))
  ) {
    return null;
  }

  // Direct alias search in current query
  for (const [key, aliases] of Object.entries(EQUIPMENT_ALIASES)) {
    if (aliases.some(alias => q.includes(alias))) {
      return key;
    }
  }

  // If explicit equipment passed in from UI
  if (selectedEquipment && EQUIPMENT_ALIASES[selectedEquipment]) {
    return selectedEquipment;
  }

  // Context resolution: Check if the question refers to "it", "this", "the fault", "the problem", "that", "serious", etc.
  const hasPronounRef = /\b(it|this|that|the problem|the fault|the issue|serious|danger|action|check)\b/i.test(q);
  if (hasPronounRef && history && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const histText = (history[i].text || history[i].content || history[i].message || '').toLowerCase();
      for (const [key, aliases] of Object.entries(EQUIPMENT_ALIASES)) {
        if (aliases.some(alias => histText.includes(alias))) {
          return key;
        }
      }
      if (history[i].equipment && history[i].equipment !== 'all' && history[i].equipment !== 'none') {
        return history[i].equipment;
      }
    }
  }

  return null;
}

/**
 * Extracts the current diagnosis context and active fault state
 */
export function getCurrentDiagnosis(liveState) {
  const diagnosis = liveState?.diagnosis || {};
  const isAnomaly = !!(diagnosis.anomaly && diagnosis.severity !== 'NORMAL');
  return {
    isAnomaly,
    severity: diagnosis.severity || 'NORMAL',
    fault: diagnosis.probable_fault || diagnosis.fault || 'Nominal Operation',
    equipment: diagnosis.equipment || null,
    rootCause: diagnosis.root_cause || 'All variables operating within nominal baseline bounds.',
    recommendedAction: diagnosis.recommended_action || 'Continue routine supervisory monitoring.',
    confidence: diagnosis.confidence || 0.85,
    anomalyScore: diagnosis.anomaly_score || 0.18,
    evidenceCards: diagnosis.evidence_cards || []
  };
}

/**
 * Compares current equipment values with nominal baseline or historical telemetry
 */
export function compareRecentValues(targetEquip, liveState, telemetryHistory = []) {
  const { equipment } = liveState;

  if (targetEquip === 'distillation' || (!targetEquip && liveState.activeFault === 'distillation_fault')) {
    const curr = equipment?.distillation?.data || NOMINAL_BASELINES.distillation;
    const base = NOMINAL_BASELINES.distillation;
    return `Reflux ratio has ${curr.reflux_ratio < base.reflux_ratio ? 'decreased' : 'increased'} from ${base.reflux_ratio.toFixed(2)} to ${curr.reflux_ratio.toFixed(2)}.
Top temperature has ${curr.top_temperature > base.top_temperature ? 'increased' : 'decreased'} from ${base.top_temperature.toFixed(1)} °C to ${curr.top_temperature.toFixed(1)} °C.
Column pressure has ${curr.pressure > base.pressure ? 'increased' : 'decreased'} from ${base.pressure.toFixed(2)} bar to ${curr.pressure.toFixed(2)} bar.

This change is consistent with the current distillation fault.`;
  }

  if (targetEquip === 'pump' || (!targetEquip && liveState.activeFault === 'pump_fault')) {
    const curr = equipment?.pump?.data || NOMINAL_BASELINES.pump;
    const base = NOMINAL_BASELINES.pump;
    return `Casing vibration has ${curr.vibration > base.vibration ? 'increased' : 'decreased'} from ${base.vibration.toFixed(2)} g to ${curr.vibration.toFixed(2)} g.
Pump speed has ${curr.rpm < base.rpm ? 'decreased' : 'increased'} from ${Math.round(base.rpm)} RPM to ${Math.round(curr.rpm)} RPM.
Discharge temperature is ${curr.outlet_temperature.toFixed(1)} °C.

This change is consistent with the current pump mechanical fault.`;
  }

  if (targetEquip === 'heat_exchanger' || (!targetEquip && liveState.activeFault === 'heat_exchanger_fault')) {
    const curr = equipment?.heat_exchanger?.data || NOMINAL_BASELINES.heat_exchanger;
    const base = NOMINAL_BASELINES.heat_exchanger;
    return `Temperature difference (ΔT) has decreased from ${base.temperature_difference.toFixed(1)} °C to ${curr.temperature_difference.toFixed(1)} °C.
Heat transfer efficiency indicator is currently ${curr.heat_transfer_indicator.toFixed(1)}%.
Inlet temperature is ${curr.inlet_temperature.toFixed(1)} °C and outlet temperature is ${curr.outlet_temperature.toFixed(1)} °C.

This change is consistent with the current heat exchanger fouling fault.`;
  }

  if (targetEquip === 'reactor' || (!targetEquip && liveState.activeFault === 'reactor_cooling_failure')) {
    const curr = equipment?.reactor?.data || NOMINAL_BASELINES.reactor;
    const base = NOMINAL_BASELINES.reactor;
    return `Cooling status has changed from ON to ${curr.cooling_status === 1 ? 'ON' : 'OFF'}.
Reactor temperature has increased from ${base.temperature.toFixed(1)} °C to ${curr.temperature.toFixed(1)} °C.
Vessel pressure has increased from ${base.pressure.toFixed(2)} bar to ${curr.pressure.toFixed(2)} bar.

This change is consistent with the current reactor cooling failure.`;
  }

  // If everything nominal
  return `All monitored process variables remain within normal baseline boundaries:
• Pump Speed: ${Math.round(equipment?.pump?.data?.rpm || 2450)} RPM (Baseline: ~2450 RPM)
• Pump Vibration: ${(equipment?.pump?.data?.vibration || 0.08).toFixed(2)} g (Baseline: < 0.15 g)
• Heat Exchanger ΔT: ${(equipment?.heat_exchanger?.data?.temperature_difference || 12.9).toFixed(1)} °C (Baseline: ~12.9 °C)
• Reactor Temp: ${(equipment?.reactor?.data?.temperature || 65.0).toFixed(1)} °C (Baseline: ~65.0 °C)
• Distillation Reflux: ${(equipment?.distillation?.data?.reflux_ratio || 1.85).toFixed(2)} (Baseline: ~1.85)

No significant deviations detected from baseline values.`;
}

/**
 * Returns specific operator recommendations for equipment
 */
export function generateRecommendation(targetEquip, liveState) {
  const diag = getCurrentDiagnosis(liveState);

  if (targetEquip === 'pump' || (!targetEquip && liveState.activeFault === 'pump_fault')) {
    return 'Inspect pump alignment, coupling integrity, and bearing mechanical condition.';
  }
  if (targetEquip === 'heat_exchanger' || (!targetEquip && liveState.activeFault === 'heat_exchanger_fault')) {
    return 'Check heat-transfer performance, coolant circulation, and possible tube fouling.';
  }
  if (targetEquip === 'reactor' || (!targetEquip && liveState.activeFault === 'reactor_cooling_failure')) {
    return 'Check cooling circulation and heat-removal system and follow the appropriate process safety procedure.';
  }
  if (targetEquip === 'distillation' || (!targetEquip && liveState.activeFault === 'distillation_fault')) {
    return 'Check reflux pump, reflux control valve, and condenser cooling flow.';
  }

  if (diag.isAnomaly) {
    return diag.recommendedAction;
  }

  return 'Continue routine supervisory monitoring. All monitored equipment is operating within design tolerances.';
}

/**
 * Main ChemDiag Local AI Copilot Answer Generator
 */
export function answerProcessQuestion({
  message,
  history = [],
  selectedEquipment = null,
  liveState,
  telemetryHistory = []
}) {
  const query = (message || '').trim();
  const lowerQ = query.toLowerCase();
  const timestamp = new Date().toISOString();

  // Extract live equipment data
  const equipment = liveState?.equipment || {};
  const pump = equipment.pump?.data || NOMINAL_BASELINES.pump;
  const hx = equipment.heat_exchanger?.data || NOMINAL_BASELINES.heat_exchanger;
  const reactor = equipment.reactor?.data || NOMINAL_BASELINES.reactor;
  const dist = equipment.distillation?.data || NOMINAL_BASELINES.distillation;

  // Real vs Demo source flags
  const pumpSource = equipment.pump?.source === 'real' ? 'Real ESP32 Stream' : 'Demo Mode';

  // Diagnosis object
  const diag = getCurrentDiagnosis(liveState);
  const isAnomaly = diag.isAnomaly;

  // Equipment health determinations
  const isPumpAbnormal = (pump.vibration || 0) > 0.20 || (pump.rpm || 2450) < 2200;
  const isHxAbnormal = (hx.temperature_difference || 12.9) < 5.0;
  const isReactorAbnormal = (reactor.cooling_status === 0) || (reactor.temperature || 65) > 74.0 || (reactor.pressure || 2.05) > 2.50;
  const isDistAbnormal = (dist.reflux_ratio || 1.85) < 1.1 || (dist.top_temperature || 76.5) > 78.0;

  // Detect equipment context with multi-turn pronoun resolution
  let detectedEquip = getEquipmentContext(query, selectedEquipment, history);

  // If no equipment detected in query or history, default to the actively faulted unit if one exists
  if (!detectedEquip && isAnomaly) {
    if (isPumpAbnormal || liveState.activeFault === 'pump_fault') detectedEquip = 'pump';
    else if (isReactorAbnormal || liveState.activeFault === 'reactor_cooling_failure') detectedEquip = 'reactor';
    else if (isDistAbnormal || liveState.activeFault === 'distillation_fault') detectedEquip = 'distillation';
    else if (isHxAbnormal || liveState.activeFault === 'heat_exchanger_fault') detectedEquip = 'heat_exchanger';
  }

  // Determine intent
  let intent = 'general';

  // -------------------------------------------------------------
  // 1. "WHAT CHANGED?" / "WHICH VARIABLE CHANGED?" / TREND
  // -------------------------------------------------------------
  if (
    lowerQ.includes('what changed') ||
    lowerQ.includes('which variable changed') ||
    lowerQ.includes('what variables changed') ||
    lowerQ.includes('how did it change') ||
    lowerQ.includes('change in parameters') ||
    lowerQ.includes('parameter change')
  ) {
    intent = 'trend_comparison';
    const answer = compareRecentValues(detectedEquip, liveState, telemetryHistory);
    return {
      success: true,
      answer,
      equipment: detectedEquip || 'all',
      intent,
      timestamp
    };
  }

  // -------------------------------------------------------------
  // 1b. FLOWSHEET CAUSE & EFFECT / PROPAGATION QUERIES
  // -------------------------------------------------------------
  if (
    lowerQ.includes('why did the reactor') ||
    lowerQ.includes('why did reactor') ||
    lowerQ.includes('why is reactor temperature increasing') ||
    lowerQ.includes('why did the distillation') ||
    lowerQ.includes('why did distillation') ||
    lowerQ.includes('why did the heat exchanger') ||
    lowerQ.includes('why did heat exchanger') ||
    lowerQ.includes('how does the pump affect') ||
    lowerQ.includes('how does the fault propagate') ||
    lowerQ.includes('propagate') ||
    lowerQ.includes('cause and effect')
  ) {
    intent = 'cause_and_effect';

    if (lowerQ.includes('distillation') || lowerQ.includes('d-101')) {
      const qDistFeed = pump.flow || 10.0;
      const tDistFeed = reactor.temperature || 65.0;
      const answer = `D-101 distillation dynamics respond directly to upstream feed and reflux control:
• Current Reflux Ratio: ${dist.reflux_ratio.toFixed(2)} (Nominal: ~1.85)
• Upstream Feed Flow (from R-101): ${qDistFeed.toFixed(1)} L/min
• Upstream Feed Temperature (from R-101): ${tDistFeed.toFixed(1)} °C
• Current Top Temperature: ${dist.top_temperature.toFixed(1)} °C

Cause & Effect:
${dist.reflux_ratio < 1.1 ? `Reflux starvation (R = ${dist.reflux_ratio.toFixed(2)}) allows uncondensed heavy vapor to escape overhead, driving top temperature upward.` : tDistFeed > 75.0 ? `Elevated reactor effluent temperature (${tDistFeed.toFixed(1)} °C) increases column vapor boilup, raising top temperature and column pressure.` : `Feed and reflux conditions are nominal with balanced separation efficiency.`}`;

      return {
        success: true,
        answer,
        equipment: 'distillation',
        intent,
        timestamp
      };
    }

    if (lowerQ.includes('reactor') || lowerQ.includes('r-101') || lowerQ.includes('r-201')) {
      const tFeed = hx.outlet_temperature || 38.1;
      const qFeed = pump.flow || 10.0;
      const isCoolingOff = reactor.cooling_status === 0;

      const answer = `R-101 reactor dynamics depend on cooling interlocks and upstream exchanger conditions:
• Cooling Status: ${isCoolingOff ? 'OFF (Tripped)' : 'ON (Active)'}
• Upstream Feed Temperature (from E-101): ${tFeed.toFixed(1)} °C
• Upstream Feed Flow (from P-101): ${qFeed.toFixed(1)} L/min
• Core Temperature: ${reactor.temperature.toFixed(1)} °C | Pressure: ${reactor.pressure.toFixed(2)} bar

Cause & Effect:
${isCoolingOff ? `Loss of jacket cooling (Cooling = OFF) prevents dissipation of exothermic reaction heat, driving reaction core temperature and Antoine vapor pressure upward.` : tFeed < 34.0 ? `The reactor feed temperature changed because the upstream heat exchanger outlet temperature changed (${tFeed.toFixed(1)} °C).` : `Sensible feed enthalpy and exothermic reaction rate are stably balanced by jacket cooling.`}`;

      return {
        success: true,
        answer,
        equipment: 'reactor',
        intent,
        timestamp
      };
    }

    if (lowerQ.includes('heat exchanger') || lowerQ.includes('e-101') || lowerQ.includes('e-102')) {
      const qFeed = pump.flow || 10.0;
      const answer = `E-101 heat exchanger performance is coupled to upstream pump flow and tube surface condition:
• Operating Flow (from P-101): ${qFeed.toFixed(1)} L/min (Nominal: 10.0 L/min)
• Thermal Difference (ΔT): ${hx.temperature_difference.toFixed(1)} °C
• Heat Transfer Efficiency: ${hx.heat_transfer_indicator.toFixed(1)}%

Cause & Effect:
${qFeed < 8.0 ? `Pump flow decreased to ${qFeed.toFixed(1)} L/min due to reduced pump RPM, altering the exchanger residence time and thermal gradient.` : hx.temperature_difference < 5.0 ? `Severe tube fouling scale creates boundary thermal resistance, reducing ΔT to ${hx.temperature_difference.toFixed(1)} °C and altering downstream reactor feed temperature.` : `Heat exchanger operating flow and thermal gradient are within nominal design specifications.`}`;

      return {
        success: true,
        answer,
        equipment: 'heat_exchanger',
        intent,
        timestamp
      };
    }

    if (lowerQ.includes('pump') || lowerQ.includes('p-101') || lowerQ.includes('propagate')) {
      const qFeed = pump.flow || 10.0;
      const answer = `P-101 pump directly governs the flowsheet mass balance:
1. P-101 Speed (${Math.round(pump.rpm)} RPM) establishes process flow (${qFeed.toFixed(1)} L/min).
2. E-101 receives ${qFeed.toFixed(1)} L/min and transfers heat (ΔT = ${hx.temperature_difference.toFixed(1)} °C, Effluent = ${hx.outlet_temperature.toFixed(1)} °C).
3. R-101 receives ${qFeed.toFixed(1)} L/min feed at ${hx.outlet_temperature.toFixed(1)} °C and reacts at ${reactor.temperature.toFixed(1)} °C.
4. D-101 separates R-101 effluent (${qFeed.toFixed(1)} L/min) into top distillate and bottoms product.

If pump RPM drops, flow decreases across all 4 units sequentially.`;

      return {
        success: true,
        answer,
        equipment: 'pump',
        intent,
        timestamp
      };
    }
  }

  // -------------------------------------------------------------
  // 2. "WHY DID AI DETECT THIS?" / "WHY DID YOU DETECT THIS FAULT?" / "WHY CLASSIFY"
  // -------------------------------------------------------------
  if (
    lowerQ.includes('why did you detect') ||
    lowerQ.includes('why did ai detect') ||
    lowerQ.includes('why was this detected') ||
    lowerQ.includes('why did you classify') ||
    lowerQ.includes('why classify') ||
    lowerQ.includes('detection reason')
  ) {
    intent = 'detection_reason';
    let answer = '';

    if (detectedEquip === 'pump' || liveState.activeFault === 'pump_fault' || isPumpAbnormal) {
      answer = `The AI detected the pump fault because vibration (${pump.vibration.toFixed(2)} g) is above its normal range while RPM (${Math.round(pump.rpm)}) is significantly lower. This combination matches the learned pump mechanical fault pattern and the engineering rules.`;
    } else if (detectedEquip === 'heat_exchanger' || liveState.activeFault === 'heat_exchanger_fault' || isHxAbnormal) {
      answer = `The AI detected the heat exchanger fault because the temperature difference ΔT (${hx.temperature_difference.toFixed(1)} °C) has collapsed significantly below the 12.0–14.0 °C nominal baseline. This combination matches the thermal fouling and heat-transfer loss pattern.`;
    } else if (detectedEquip === 'reactor' || liveState.activeFault === 'reactor_cooling_failure' || isReactorAbnormal) {
      answer = `The AI detected the reactor fault because cooling is currently ${reactor.cooling_status === 1 ? 'ON' : 'OFF'} while reactor temperature (${reactor.temperature.toFixed(1)} °C) and pressure (${reactor.pressure.toFixed(2)} bar) have risen rapidly above normal limits. This combination matches the learned cooling-system failure and thermal runaway pattern.`;
    } else if (detectedEquip === 'distillation' || liveState.activeFault === 'distillation_fault' || isDistAbnormal) {
      answer = `The AI detected the distillation column fault because reflux ratio (${dist.reflux_ratio.toFixed(2)}) is below normal while top temperature (${dist.top_temperature.toFixed(1)} °C) and column pressure (${dist.pressure.toFixed(2)} bar) have increased. This combination matches the learned column reflux-starvation pattern.`;
    } else if (!isAnomaly) {
      answer = `The AI detected nominal operation because all monitored sensor values are within their expected boundaries, and the Isolation Forest anomaly score is ${diag.anomalyScore.toFixed(3)} (well below the 0.58 threshold).`;
    } else {
      answer = `The AI detected the fault because active multivariate sensor readings deviated significantly from baseline bounds, resulting in an anomaly score of ${diag.anomalyScore.toFixed(3)} exceeding the anomaly threshold.`;
    }

    return {
      success: true,
      answer,
      equipment: detectedEquip || 'all',
      intent,
      timestamp
    };
  }

  // -------------------------------------------------------------
  // 3. "IS THE PROCESS NORMAL?" / "IS EVERYTHING NORMAL?"
  // -------------------------------------------------------------
  if (
    lowerQ.includes('is the process normal') ||
    lowerQ.includes('is everything normal') ||
    lowerQ.includes('is it normal') ||
    lowerQ.includes('is everything ok') ||
    lowerQ.includes('are all systems normal')
  ) {
    intent = 'status_check';

    if (!isAnomaly && liveState.activeFault === 'normal') {
      const answer = `Yes. No significant process anomaly is currently detected.

Pump:
NORMAL

Heat Exchanger:
NORMAL

Reactor:
NORMAL

Distillation:
NORMAL

The monitored variables are currently within their expected operating ranges.`;
      return {
        success: true,
        answer,
        equipment: 'all',
        intent,
        timestamp
      };
    } else {
      const answer = `No. A ${diag.severity} process anomaly is currently detected on ${diag.equipment || 'the system'}.

Pump:
${isPumpAbnormal ? 'ABNORMAL' : 'NORMAL'}

Heat Exchanger:
${isHxAbnormal ? 'ABNORMAL' : 'NORMAL'}

Reactor:
${isReactorAbnormal ? 'ABNORMAL (CRITICAL)' : 'NORMAL'}

Distillation:
${isDistAbnormal ? 'ABNORMAL' : 'NORMAL'}

Diagnosed fault: ${diag.fault}.
Recommended action: ${diag.recommendedAction}`;
      return {
        success: true,
        answer,
        equipment: detectedEquip || 'all',
        intent,
        timestamp
      };
    }
  }

  // -------------------------------------------------------------
  // 4. "WHAT SHOULD I CHECK?" / "RECOMMENDATION" / "ACTION"
  // -------------------------------------------------------------
  if (
    lowerQ.includes('what should i check') ||
    lowerQ.includes('what should we check') ||
    lowerQ.includes('what to check') ||
    lowerQ.includes('recommendation') ||
    lowerQ.includes('what action') ||
    lowerQ.includes('how to fix') ||
    lowerQ.includes('what should the operator do') ||
    lowerQ.includes('what should i do')
  ) {
    intent = 'recommendation';
    const recAction = generateRecommendation(detectedEquip, liveState);

    let answer = `Recommended action:\n${recAction}`;
    if (isAnomaly || liveState.activeFault !== 'normal') {
      answer = `Priority: ${diag.severity}\n\nRecommended action:\n${recAction}\n\nProbable root cause:\n${diag.rootCause}`;
    }

    return {
      success: true,
      answer,
      equipment: detectedEquip || 'all',
      intent,
      timestamp
    };
  }

  // -------------------------------------------------------------
  // 5. "HOW SERIOUS IS IT?" / "SEVERITY" / "HOW CRITICAL" / "WHY IS IT SERIOUS?"
  // -------------------------------------------------------------
  if (
    lowerQ.includes('how serious') ||
    lowerQ.includes('severity') ||
    lowerQ.includes('how critical') ||
    lowerQ.includes('how dangerous') ||
    lowerQ.includes('is it serious') ||
    lowerQ.includes('why is it serious')
  ) {
    intent = 'severity_assessment';

    if (!isAnomaly && !detectedEquip && liveState.activeFault === 'normal') {
      return {
        success: true,
        answer: `The current process state is NORMAL (Low Risk). All monitored parameters are within safe operating envelopes.`,
        equipment: 'all',
        intent,
        timestamp
      };
    }

    let answer = '';
    if (detectedEquip === 'reactor' || liveState.activeFault === 'reactor_cooling_failure' || diag.severity === 'CRITICAL' || isReactorAbnormal) {
      answer = `The condition on the Reactor (R-201) is CRITICAL. Cooling is currently ${reactor.cooling_status === 1 ? 'ON' : 'OFF'} while reactor temperature is ${reactor.temperature.toFixed(1)} °C and pressure is ${reactor.pressure.toFixed(2)} bar. Loss of heat removal poses a severe thermal runaway risk. Immediate operator action is required.`;
    } else if (detectedEquip === 'pump' || liveState.activeFault === 'pump_fault' || isPumpAbnormal) {
      answer = `The pump condition is HIGH severity due to elevated casing vibration (${pump.vibration.toFixed(2)} g) and speed loss (${Math.round(pump.rpm)} RPM), which can cause bearing destruction or seal failure.`;
    } else if (detectedEquip === 'distillation' || liveState.activeFault === 'distillation_fault' || isDistAbnormal) {
      answer = `The distillation condition is HIGH severity due to reflux depletion (${dist.reflux_ratio.toFixed(2)}) and overhead temperature rise (${dist.top_temperature.toFixed(1)} °C), which causes off-spec product and column pressure escalation.`;
    } else if (detectedEquip === 'heat_exchanger' || liveState.activeFault === 'heat_exchanger_fault' || isHxAbnormal) {
      answer = `The heat exchanger condition is MEDIUM severity due to severe thermal gradient loss (ΔT = ${hx.temperature_difference.toFixed(1)} °C), which degrades overall plant energy balance.`;
    } else {
      answer = `The condition is ${diag.severity} severity. Process parameters deviate from nominal specifications.`;
    }

    return {
      success: true,
      answer,
      equipment: detectedEquip || diag.equipment || 'all',
      intent,
      timestamp
    };
  }

  // -------------------------------------------------------------
  // 6. "WHICH EQUIPMENT IS AFFECTED?" / "WHICH VARIABLE IS MOST ABNORMAL?"
  // -------------------------------------------------------------
  if (
    lowerQ.includes('which equipment') ||
    lowerQ.includes('what equipment') ||
    lowerQ.includes('which variable is most abnormal') ||
    lowerQ.includes('most abnormal variable') ||
    lowerQ.includes('most abnormal')
  ) {
    intent = 'affected_equipment';

    if (!isAnomaly) {
      return {
        success: true,
        answer: `No equipment is currently affected. All 4 units (Pump P-101, Heat Exchanger E-102, Reactor R-201, Distillation D-101) are operating nominally with all variables within design ranges.`,
        equipment: 'all',
        intent,
        timestamp
      };
    }

    let affectedUnit = diag.equipment || 'Process Equipment';
    let abnormalVars = [];

    if (isPumpAbnormal || liveState.activeFault === 'pump_fault') {
      affectedUnit = 'Pump (P-101)';
      abnormalVars.push(`Vibration (${pump.vibration.toFixed(2)} g - HIGH)`, `Speed (${Math.round(pump.rpm)} RPM - LOW)`);
    }
    if (isHxAbnormal || liveState.activeFault === 'heat_exchanger_fault') {
      affectedUnit = 'Heat Exchanger (E-102)';
      abnormalVars.push(`ΔT (${hx.temperature_difference.toFixed(1)} °C - LOW)`);
    }
    if (isReactorAbnormal || liveState.activeFault === 'reactor_cooling_failure') {
      affectedUnit = 'Reactor (R-201)';
      abnormalVars.push(`Cooling (OFF)`, `Temperature (${reactor.temperature.toFixed(1)} °C - HIGH)`, `Pressure (${reactor.pressure.toFixed(2)} bar - HIGH)`);
    }
    if (isDistAbnormal || liveState.activeFault === 'distillation_fault') {
      affectedUnit = 'Distillation Column (D-101 / T-301)';
      abnormalVars.push(`Reflux Ratio (${dist.reflux_ratio.toFixed(2)} - LOW)`, `Top Temperature (${dist.top_temperature.toFixed(1)} °C - HIGH)`);
    }

    const answer = `Affected Equipment: ${affectedUnit}
Severity: ${diag.severity}

Most Abnormal Variables:
${abnormalVars.map(v => `• ${v}`).join('\n')}

Probable Root Cause:
${diag.rootCause}`;

    return {
      success: true,
      answer,
      equipment: detectedEquip || 'all',
      intent,
      timestamp
    };
  }

  // -------------------------------------------------------------
  // 7. "GIVE ME A PROCESS SUMMARY" / "SUMMARY" / "OVERVIEW"
  // -------------------------------------------------------------
  if (
    lowerQ.includes('process summary') ||
    lowerQ.includes('summary') ||
    lowerQ.includes('overview') ||
    lowerQ.includes('give me a summary')
  ) {
    intent = 'process_summary';

    const answer = `PROCESS SUMMARY:

Pump (P-101):
Status: ${isPumpAbnormal ? 'ABNORMAL' : 'NORMAL'}
Speed: ${Math.round(pump.rpm)} RPM | Vibration: ${pump.vibration.toFixed(2)} g | Outlet Temp: ${pump.outlet_temperature.toFixed(1)} °C

Heat Exchanger (E-102):
Status: ${isHxAbnormal ? 'ABNORMAL' : 'NORMAL'}
Inlet Temp: ${hx.inlet_temperature.toFixed(1)} °C | Outlet Temp: ${hx.outlet_temperature.toFixed(1)} °C | ΔT: ${hx.temperature_difference.toFixed(1)} °C

Reactor (R-201):
Status: ${isReactorAbnormal ? 'CRITICAL / ABNORMAL' : 'NORMAL'}
Temperature: ${reactor.temperature.toFixed(1)} °C | Pressure: ${reactor.pressure.toFixed(2)} bar | Cooling: ${reactor.cooling_status === 1 ? 'ON' : 'OFF'}

Distillation (D-101):
Status: ${isDistAbnormal ? 'ABNORMAL' : 'NORMAL'}
Reflux Ratio: ${dist.reflux_ratio.toFixed(2)} | Top Temp: ${dist.top_temperature.toFixed(1)} °C | Pressure: ${dist.pressure.toFixed(2)} bar

Overall Diagnosis: ${diag.fault} (${diag.severity})`;

    return {
      success: true,
      answer,
      equipment: 'all',
      intent,
      timestamp
    };
  }

  // -------------------------------------------------------------
  // 8. SPECIFIC EQUIPMENT: PUMP (P-101)
  // -------------------------------------------------------------
  if (detectedEquip === 'pump') {
    intent = 'pump_query';

    if (isPumpAbnormal || liveState.activeFault === 'pump_fault') {
      const answer = `P-101 is showing an abnormal mechanical pattern.
Current vibration is ${pump.vibration.toFixed(2)} g, which is elevated, while RPM has decreased to ${Math.round(pump.rpm)}.

The combination of high vibration and reduced RPM matches the current pump mechanical-fault pattern.

Probable root cause:
Possible bearing wear or mechanical imbalance.

Recommended action:
Inspect pump alignment and mechanical condition.`;

      return {
        success: true,
        answer,
        equipment: 'pump',
        intent,
        timestamp
      };
    } else {
      const answer = `Pump P-101 is operating NOMINALLY.

Current telemetry:
• Speed: ${Math.round(pump.rpm)} RPM
• Vibration: ${pump.vibration.toFixed(2)} g (Nominal limit < 0.15 g)
• Inlet Temperature: ${pump.inlet_temperature.toFixed(1)} °C
• Outlet Temperature: ${pump.outlet_temperature.toFixed(1)} °C
• Source: ${pumpSource}

No mechanical fault or abnormal vibration pattern is detected.`;

      return {
        success: true,
        answer,
        equipment: 'pump',
        intent,
        timestamp
      };
    }
  }

  // -------------------------------------------------------------
  // 9. SPECIFIC EQUIPMENT: HEAT EXCHANGER (E-102 / E-101)
  // -------------------------------------------------------------
  if (detectedEquip === 'heat_exchanger') {
    intent = 'heat_exchanger_query';

    if (isHxAbnormal || liveState.activeFault === 'heat_exchanger_fault') {
      const answer = `E-102 is showing a thermal transfer abnormality.

Inlet temperature is ${hx.inlet_temperature.toFixed(1)} °C, outlet temperature is ${hx.outlet_temperature.toFixed(1)} °C, resulting in a temperature difference (ΔT) of ${hx.temperature_difference.toFixed(1)} °C.

The severe collapse in thermal gradient matches the heat exchanger fouling pattern.

Probable root cause:
Tube fouling or scale accumulation.

Recommended action:
Check heat-transfer performance, coolant circulation and possible fouling.`;

      return {
        success: true,
        answer,
        equipment: 'heat_exchanger',
        intent,
        timestamp
      };
    } else {
      const answer = `Heat Exchanger E-102 is performing NOMINALLY.

Current telemetry:
• Inlet Temperature: ${hx.inlet_temperature.toFixed(1)} °C
• Outlet Temperature: ${hx.outlet_temperature.toFixed(1)} °C
• Temperature Difference (ΔT): ${hx.temperature_difference.toFixed(1)} °C (Nominal: 12.0–14.0 °C)
• Heat Transfer Indicator: ${hx.heat_transfer_indicator.toFixed(1)}%

Thermal transfer efficiency is healthy with no tube fouling detected.`;

      return {
        success: true,
        answer,
        equipment: 'heat_exchanger',
        intent,
        timestamp
      };
    }
  }

  // -------------------------------------------------------------
  // 10. SPECIFIC EQUIPMENT: REACTOR (R-201 / R-101 / CSTR)
  // -------------------------------------------------------------
  if (detectedEquip === 'reactor') {
    intent = 'reactor_query';

    if (isReactorAbnormal || liveState.activeFault === 'reactor_cooling_failure') {
      const answer = `The reactor is showing a critical condition because cooling is currently ${reactor.cooling_status === 1 ? 'ON' : 'OFF'} while temperature has increased to ${reactor.temperature.toFixed(1)} °C and pressure has increased to ${reactor.pressure.toFixed(2)} bar.

This pattern indicates loss of heat removal.

Probable root cause:
Cooling-system failure.

Recommended action:
Check the cooling circulation and heat-removal system and follow the appropriate process safety procedure.`;

      return {
        success: true,
        answer,
        equipment: 'reactor',
        intent,
        timestamp
      };
    } else {
      const answer = `Reactor R-201 (CSTR) is operating NOMINALLY.

Current telemetry:
• Temperature: ${reactor.temperature.toFixed(1)} °C (Nominal: ~65.0 °C)
• Pressure: ${reactor.pressure.toFixed(2)} bar (Nominal: ~2.05 bar)
• Level: ${reactor.level.toFixed(1)}%
• Agitator Speed: ${Math.round(reactor.agitator_speed)} RPM
• Cooling Status: ${reactor.cooling_status === 1 ? 'ON (Active)' : 'OFF'}

Reaction temperature and vapor pressure are stable with active jacket cooling.`;

      return {
        success: true,
        answer,
        equipment: 'reactor',
        intent,
        timestamp
      };
    }
  }

  // -------------------------------------------------------------
  // 11. SPECIFIC EQUIPMENT: DISTILLATION (D-101 / T-301)
  // -------------------------------------------------------------
  if (detectedEquip === 'distillation') {
    intent = 'distillation_query';

    if (isDistAbnormal || liveState.activeFault === 'distillation_fault') {
      const answer = `D-101 is showing a separation abnormality.

Reflux ratio is currently ${dist.reflux_ratio.toFixed(2)}, while top temperature is ${dist.top_temperature.toFixed(1)} °C and column pressure is ${dist.pressure.toFixed(2)} bar.

Low reflux combined with elevated top temperature matches the current reflux-starvation pattern.

Probable root cause:
Column reflux starvation.

Recommended action:
Check the reflux pump, reflux control valve and condenser.`;

      return {
        success: true,
        answer,
        equipment: 'distillation',
        intent,
        timestamp
      };
    } else {
      const answer = `Distillation Column D-101 is operating NOMINALLY.

Current telemetry:
• Reflux Ratio: ${dist.reflux_ratio.toFixed(2)} (Nominal: ~1.85)
• Top Temperature: ${dist.top_temperature.toFixed(1)} °C (Nominal: ~76.5 °C)
• Bottom Temperature: ${dist.bottom_temperature.toFixed(1)} °C
• Column Pressure: ${dist.pressure.toFixed(2)} bar (Nominal: ~2.10 bar)
• Sump Level: ${dist.level.toFixed(1)}%

Fractionation and reflux flow are operating at nominal specifications.`;

      return {
        success: true,
        answer,
        equipment: 'distillation',
        intent,
        timestamp
      };
    }
  }

  // -------------------------------------------------------------
  // 12. GENERAL "WHY IS IT ABNORMAL?" / "WHAT IS WRONG?" / "WHAT'S HAPPENING?" / "WHAT CAUSED THE FAULT?"
  // -------------------------------------------------------------
  if (
    lowerQ.includes('why is it abnormal') ||
    lowerQ.includes('what is wrong') ||
    lowerQ.includes('what is happening') ||
    lowerQ.includes('what caused the fault') ||
    lowerQ.includes('what is the root cause') ||
    lowerQ.includes('cause of the fault') ||
    lowerQ.includes('root cause') ||
    lowerQ === 'why?' ||
    lowerQ === 'why'
  ) {
    intent = 'diagnosis_explanation';

    if (!isAnomaly) {
      return {
        success: true,
        answer: `The process is currently NOMINAL. No abnormal conditions or faults have been detected across the monitored units.`,
        equipment: 'all',
        intent,
        timestamp
      };
    }

    // Default to the active fault's equipment narrative
    let answer = '';
    if (liveState.activeFault === 'pump_fault' || isPumpAbnormal) {
      answer = `P-101 is showing an abnormal mechanical pattern.
Current vibration is ${pump.vibration.toFixed(2)} g, which is elevated, while RPM has decreased to ${Math.round(pump.rpm)}.

The combination of high vibration and reduced RPM matches the current pump mechanical-fault pattern.

Probable root cause:
Possible bearing wear or mechanical imbalance.

Recommended action:
Inspect pump alignment and mechanical condition.`;
    } else if (liveState.activeFault === 'heat_exchanger_fault' || isHxAbnormal) {
      answer = `E-102 is showing a thermal transfer abnormality.
Inlet temperature is ${hx.inlet_temperature.toFixed(1)} °C, outlet temperature is ${hx.outlet_temperature.toFixed(1)} °C, resulting in a temperature difference (ΔT) of ${hx.temperature_difference.toFixed(1)} °C.

The severe collapse in thermal gradient matches the heat exchanger fouling pattern.

Probable root cause:
Tube fouling or scale accumulation.

Recommended action:
Check heat-transfer performance, coolant circulation and possible fouling.`;
    } else if (liveState.activeFault === 'reactor_cooling_failure' || isReactorAbnormal) {
      answer = `The reactor is showing a critical condition because cooling is currently ${reactor.cooling_status === 1 ? 'ON' : 'OFF'} while temperature has increased to ${reactor.temperature.toFixed(1)} °C and pressure has increased to ${reactor.pressure.toFixed(2)} bar.

This pattern indicates loss of heat removal.

Probable root cause:
Cooling-system failure.

Recommended action:
Check the cooling circulation and heat-removal system and follow the appropriate process safety procedure.`;
    } else if (liveState.activeFault === 'distillation_fault' || isDistAbnormal) {
      answer = `D-101 is showing a separation abnormality.
Reflux ratio is currently ${dist.reflux_ratio.toFixed(2)}, while top temperature is ${dist.top_temperature.toFixed(1)} °C and column pressure is ${dist.pressure.toFixed(2)} bar.

Low reflux combined with elevated top temperature matches the current reflux-starvation pattern.

Probable root cause:
Column reflux starvation.

Recommended action:
Check the reflux pump, reflux control valve and condenser.`;
    } else {
      answer = `A ${diag.severity} fault is detected on ${diag.equipment || 'the system'}.
Probable root cause:
${diag.rootCause}

Recommended action:
${diag.recommendedAction}`;
    }

    return {
      success: true,
      answer,
      equipment: detectedEquip || diag.equipment || 'all',
      intent,
      timestamp
    };
  }

  // -------------------------------------------------------------
  // 13. DEFAULT INTELLIGENT CHEMICAL ENGINEERING COPILOT RESPONSE
  // -------------------------------------------------------------
  intent = 'general_telemetry';
  const defaultAnswer = `Current ChemDiag Process State:

• Pump (P-101): ${Math.round(pump.rpm)} RPM, ${pump.vibration.toFixed(2)} g vibration (${isPumpAbnormal ? 'ABNORMAL' : 'NORMAL'})
• Heat Exchanger (E-102): ΔT = ${hx.temperature_difference.toFixed(1)} °C (${isHxAbnormal ? 'ABNORMAL' : 'NORMAL'})
• Reactor (R-201): ${reactor.temperature.toFixed(1)} °C, ${reactor.pressure.toFixed(2)} bar, Cooling: ${reactor.cooling_status === 1 ? 'ON' : 'OFF'} (${isReactorAbnormal ? 'ABNORMAL' : 'NORMAL'})
• Distillation (D-101): Reflux = ${dist.reflux_ratio.toFixed(2)}, Top Temp = ${dist.top_temperature.toFixed(1)} °C (${isDistAbnormal ? 'ABNORMAL' : 'NORMAL'})

Status: ${isAnomaly ? `FAULT DETECTED - ${diag.fault} (${diag.severity})\nRoot Cause: ${diag.rootCause}\nAction: ${diag.recommendedAction}` : 'NOMINAL OPERATION - All units operating within design specifications.'}`;

  return {
    success: true,
    answer: defaultAnswer,
    equipment: detectedEquip || 'all',
    intent,
    timestamp
  };
}
