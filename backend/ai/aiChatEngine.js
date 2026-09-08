import { answerProcessQuestion, getEquipmentContext, compareRecentValues, generateRecommendation, getCurrentDiagnosis } from '../services/copilot.js';

export { answerProcessQuestion, getEquipmentContext, compareRecentValues, generateRecommendation, getCurrentDiagnosis };

/**
 * Main function to process user message with live state context
 */
export async function processAiChat({
  message,
  history = [],
  selectedEquipment = null,
  liveState,
  telemetryHistory = []
}) {
  const query = (message || '').trim();
  const timestamp = new Date().toISOString();

  // Check if external LLM API key is present (optional future LLM support)
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const detectedEquip = getEquipmentContext(query, selectedEquipment, history);
      const llmResponse = await queryExternalLlm({
        apiKey,
        message,
        history,
        detectedEquip,
        liveState
      });
      if (llmResponse) {
        return {
          success: true,
          answer: llmResponse,
          equipment: detectedEquip || 'all',
          intent: 'llm_chat',
          timestamp
        };
      }
    } catch (err) {
      console.warn('External LLM query failed, falling back to local ChemDiag Copilot engine:', err.message);
    }
  }

  // Local ChemDiag Chemical Process Copilot Service (100% Local, Offline, No API key needed)
  return answerProcessQuestion({
    message,
    history,
    selectedEquipment,
    liveState,
    telemetryHistory
  });
}

/**
 * Local Chemical Process Engineering Reasoning Engine
 */
function generateLocalProcessReasoning({ query, lowerQ, detectedEquip, history, liveState }) {
  const { equipment, diagnosis, activeFault, recentAlerts } = liveState;

  const pump = equipment?.pump?.data || { rpm: 2450, vibration: 0.08, inlet_temperature: 25.2, outlet_temperature: 38.1 };
  const hx = equipment?.heat_exchanger?.data || { inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, heat_transfer_indicator: 95.0 };
  const reactor = equipment?.reactor?.data || { temperature: 65.0, pressure: 2.05, level: 50.0, agitator_speed: 350, cooling_status: 1 };
  const dist = equipment?.distillation?.data || { top_temperature: 64.2, bottom_temperature: 98.4, pressure: 1.82, level: 52.0, reflux_ratio: 2.2 };

  const isAnomaly = diagnosis?.anomaly && diagnosis?.severity !== 'NORMAL';
  const currentSeverity = diagnosis?.severity || 'NORMAL';
  const currentFault = diagnosis?.probable_fault || diagnosis?.fault || 'Nominal Operation';
  const currentRootCause = diagnosis?.root_cause || 'All units operating within baseline bounds.';
  const currentAction = diagnosis?.recommended_action || 'Continue routine monitoring.';

  // Equipment health evaluations
  const isPumpAbnormal = (pump.vibration || 0) > 0.20 || (pump.rpm || 2450) < 2200;
  const isHxAbnormal = (hx.temperature_difference || 12.9) < 5.0;
  const isReactorAbnormal = (reactor.cooling_status === 0) || (reactor.temperature || 65) > 74.0 || (reactor.pressure || 2.05) > 2.50;
  const isDistAbnormal = (dist.reflux_ratio || 2.2) < 1.1 || (dist.top_temperature || 64) > 78.0;

  // -------------------------------------------------------------
  // 1. Process Status / Summary
  // -------------------------------------------------------------
  if (
    lowerQ.includes('summary') ||
    lowerQ.includes('overview') ||
    lowerQ.includes('process status') ||
    lowerQ.includes('status of the process') ||
    lowerQ.includes('status summary') ||
    (lowerQ.includes('what is happening') && !detectedEquip) ||
    lowerQ === 'what is wrong?' ||
    lowerQ === 'what is wrong'
  ) {
    if (!isAnomaly) {
      return {
        text: `CURRENT PROCESS STATUS: NOMINAL ✓

• Pump (P-101): NORMAL (${Math.round(pump.rpm)} RPM, ${pump.vibration.toFixed(2)} g)
• Heat Exchanger (E-102): NORMAL (ΔT = ${hx.temperature_difference.toFixed(1)} °C)
• Reactor (R-201): NORMAL (${reactor.temperature.toFixed(1)} °C, ${reactor.pressure.toFixed(2)} bar, Cooling ON)
• Distillation (T-301): NORMAL (Reflux = ${dist.reflux_ratio.toFixed(2)}, Top Temp = ${dist.top_temperature.toFixed(1)} °C)

AI Assessment:
Isolation Forest anomaly score is ${diagnosis?.anomaly_score?.toFixed(3) || '0.180'} (Threshold = 0.58). All 4 physical and simulated process units are operating within nominal boundaries.

Recommendation:
${currentAction}`,
        equipment: 'all'
      };
    } else {
      return {
        text: `CURRENT PROCESS STATUS: FAULT DETECTED ⚠

Active Diagnosis: ${currentFault} (${currentSeverity} SEVERITY)
Affected Unit: ${diagnosis?.equipment || 'Process Unit'}

Live Equipment Status:
• Pump (P-101): ${isPumpAbnormal ? 'ABNORMAL ⚠' : 'NORMAL ✓'} (${Math.round(pump.rpm)} RPM, ${pump.vibration.toFixed(2)} g)
• Heat Exchanger (E-102): ${isHxAbnormal ? 'ABNORMAL ⚠' : 'NORMAL ✓'} (ΔT = ${hx.temperature_difference.toFixed(1)} °C)
• Reactor (R-201): ${isReactorAbnormal ? 'CRITICAL ALARM 🔴' : 'NORMAL ✓'} (${reactor.temperature.toFixed(1)} °C, ${reactor.pressure.toFixed(2)} bar, Cooling: ${reactor.cooling_status === 1 ? 'ON' : 'OFF'})
• Distillation (T-301): ${isDistAbnormal ? 'ABNORMAL ⚠' : 'NORMAL ✓'} (Reflux = ${dist.reflux_ratio.toFixed(2)}, Top Temp = ${dist.top_temperature.toFixed(1)} °C)

Probable Root Cause:
${currentRootCause}

Recommended Operator Action:
${currentAction}`,
        equipment: detectedEquip || 'all'
      };
    }
  }

  // -------------------------------------------------------------
  // 2. Comparison Queries (checked before single equipment)
  // -------------------------------------------------------------
  if (lowerQ.includes('compare') || (lowerQ.includes('pump') && lowerQ.includes('reactor'))) {
    return {
      text: `PROCESS UNIT HEALTH COMPARISON:

1. Pump (P-101): ${isPumpAbnormal ? 'ABNORMAL ⚠ (Vibration Fault)' : 'HEALTHY ✓ (Nominal)'}
   • Speed: ${Math.round(pump.rpm)} RPM | Vibration: ${pump.vibration.toFixed(2)} g | Temp: ${pump.outlet_temperature.toFixed(1)} °C

2. Heat Exchanger (E-102): ${isHxAbnormal ? 'ABNORMAL ⚠ (Thermal Fouling)' : 'HEALTHY ✓ (Nominal)'}
   • ΔT: ${hx.temperature_difference.toFixed(1)} °C | Heat Transfer Efficiency: ${hx.heat_transfer_indicator.toFixed(1)} %

3. Reactor (R-201): ${isReactorAbnormal ? 'CRITICAL 🔴 (Cooling Loss / Runaway Risk)' : 'HEALTHY ✓ (Nominal)'}
   • Core Temp: ${reactor.temperature.toFixed(1)} °C | Pressure: ${reactor.pressure.toFixed(2)} bar | Cooling: ${reactor.cooling_status === 1 ? 'ON' : 'TRIPPED'}

4. Distillation Column (T-301): ${isDistAbnormal ? 'ABNORMAL ⚠ (Reflux Loss)' : 'HEALTHY ✓ (Nominal)'}
   • Reflux Ratio: ${dist.reflux_ratio.toFixed(2)} | Top Temp: ${dist.top_temperature.toFixed(1)} °C

Highest Risk Unit: ${isReactorAbnormal ? 'Reactor R-201 (Thermal Runaway Risk)' : isAnomaly ? `${diagnosis?.equipment} (${currentSeverity})` : 'None (All Units Operating Nominally)'}`,
      equipment: 'all'
    };
  }

  // -------------------------------------------------------------
  // 3. Sensor Meaning Queries (checked before single equipment)
  // -------------------------------------------------------------
  if (lowerQ.includes('vibration') && (lowerQ.includes('mean') || lowerQ.includes('indicate') || lowerQ.includes('what is'))) {
    return {
      text: `Vibration Telemetry (MPU6050 Accelerometer on Pump P-101):
• Current Value: ${pump.vibration.toFixed(2)} g
• Nominal Operating Limit: < 0.15 g (ISO 10816 Standard)
• Mechanical Alarm Threshold: > 0.25 g

Meaning:
Vibration magnitude measures dynamic casing acceleration. Elevated readings (> 0.20 g) indicate physical unbalance, mechanical bearing race damage, or rotor misalignment on the centrifugal pump.`,
      equipment: 'pump'
    };
  }

  if (lowerQ.includes('delta t') && (lowerQ.includes('mean') || lowerQ.includes('indicate') || lowerQ.includes('what is'))) {
    return {
      text: `Thermal Difference ΔT (Heat Exchanger E-102):
• Current Value: ${hx.temperature_difference.toFixed(1)} °C
• Nominal Operating Range: 12.0–14.0 °C
• Fouling Degradation Limit: < 4.0 °C

Meaning:
ΔT represents the temperature gradient across the heat exchanger boundary. When fouling scale builds up on tube walls, thermal resistance surges, collapsing ΔT and reducing overall heat transfer efficiency.`,
      equipment: 'heat_exchanger'
    };
  }

  // -------------------------------------------------------------
  // 4. Is Process Normal / Nominal Question
  // -------------------------------------------------------------
  if (lowerQ.includes('is the process normal') || lowerQ.includes('is everything normal') || lowerQ.includes('is it normal') || lowerQ.includes('is everything ok')) {
    if (!isAnomaly) {
      return {
        text: `Yes, the process is currently operating within NOMINAL parameters.

Live Verification:
• Pump speed: ${Math.round(pump.rpm)} RPM (Nominal: 2400–2500)
• Pump vibration: ${pump.vibration.toFixed(2)} g (Nominal: < 0.15 g)
• Heat exchanger ΔT: ${hx.temperature_difference.toFixed(1)} °C (Nominal: 12–14 °C)
• Reactor core temp: ${reactor.temperature.toFixed(1)} °C (Nominal: 65 °C)
• Distillation reflux: ${dist.reflux_ratio.toFixed(2)} (Nominal: 1.8–2.2)

No anomalies detected by Isolation Forest or Random Forest models.`,
        equipment: 'all'
      };
    } else {
      return {
        text: `No, the process is currently ABNORMAL.

The AI system has detected a ${currentSeverity} severity fault on ${diagnosis?.equipment || 'the system'}:
• Diagnosed Fault: ${currentFault}
• Probable Cause: ${currentRootCause}
• Operator Directive: ${currentAction}`,
        equipment: detectedEquip || 'all'
      };
    }
  }

  // -------------------------------------------------------------
  // 5. Severity / Risk / Danger Questions
  // -------------------------------------------------------------
  if (lowerQ.includes('severity') || lowerQ.includes('how serious') || lowerQ.includes('highest risk') || lowerQ.includes('dangerous') || lowerQ.includes('risk')) {
    if (!isAnomaly) {
      return {
        text: `Current process risk is LOW / NORMAL. All monitored variables remain within baseline design tolerances.`,
        equipment: 'all'
      };
    }

    let riskDetails = '';
    if (currentSeverity === 'CRITICAL') {
      riskDetails = `The current condition is CRITICAL. The exothermic CSTR reaction temperature (${reactor.temperature.toFixed(1)} °C) and pressure (${reactor.pressure.toFixed(2)} bar) are escalating due to cooling jacket failure (Cooling: OFF). Immediate interlock verification is required to prevent thermal runaway and relief valve discharge.`;
    } else if (currentSeverity === 'HIGH') {
      riskDetails = `The severity is HIGH because primary operating parameters on ${diagnosis?.equipment} have breached alarm limits (${diagnosis?.important_variables?.join(', ') || 'significant multivariate deviation'}).`;
    } else {
      riskDetails = `The severity is ${currentSeverity}. Process efficiency is degraded but operating variables have not yet breached catastrophic safety limits.`;
    }

    return {
      text: `SEVERITY ASSESSMENT: ${currentSeverity}

${riskDetails}

Model Confidence: ${Math.round((diagnosis?.confidence || 0.85) * 100)}%

Immediate Directive:
${currentAction}`,
      equipment: detectedEquip || 'all'
    };
  }

  // -------------------------------------------------------------
  // 6. Operator Action / Recommendation / Check Questions
  // -------------------------------------------------------------
  if (
    lowerQ.includes('what should i check') ||
    lowerQ.includes('what to check') ||
    lowerQ.includes('what should the operator check') ||
    lowerQ.includes('action') ||
    lowerQ.includes('recommendation') ||
    lowerQ.includes('how to fix') ||
    lowerQ.includes('what should we do')
  ) {
    if (!isAnomaly) {
      return {
        text: `No corrective operator intervention is currently needed.

Recommended Action:
• Continue routine supervisory monitoring.
• Verify physical ESP32 sensor connectivity and steady-state mass/energy balances.`,
        equipment: 'all'
      };
    }

    return {
      text: `RECOMMENDED OPERATOR ACTION FOR ${diagnosis?.equipment?.toUpperCase() || 'PROCESS UNIT'}:

Priority: ${currentSeverity}

Action Directive:
${currentAction}

Root Cause Basis:
${currentRootCause}

Key Sensors to Inspect:
${(diagnosis?.evidence_cards || []).map(c => `• ${c.label}: Current = ${c.val} (${c.state})`).join('\n') || '• Review active multivariate telemetry on dashboard.'}`,
      equipment: detectedEquip || 'all'
    };
  }

  // -------------------------------------------------------------
  // 7. Why Diagnosis / Explain Fault / Which Variables Changed
  // -------------------------------------------------------------
  if (
    lowerQ.includes('why did you classify') ||
    lowerQ.includes('why did you diagnose') ||
    lowerQ.includes('explain the fault') ||
    lowerQ.includes('which variable') ||
    lowerQ.includes('which variables') ||
    lowerQ.includes('why is it abnormal') ||
    lowerQ.includes('what caused') ||
    lowerQ === 'why?' ||
    lowerQ === 'why'
  ) {
    if (!isAnomaly && !detectedEquip) {
      return {
        text: `The AI classifies the process as NOMINAL because all 9 multivariate sensor features fall within the nominal multidimensional envelope. Isolation Forest anomaly score is ${diagnosis?.anomaly_score?.toFixed(3) || '0.180'} (< 0.58 threshold).`,
        equipment: 'all'
      };
    }

    // If a specific equipment is being asked about or diagnosed
    const targetEquip = detectedEquip || (isPumpAbnormal ? 'pump' : isHxAbnormal ? 'heat_exchanger' : isReactorAbnormal ? 'reactor' : isDistAbnormal ? 'distillation' : null);

    if (targetEquip === 'pump' || (!targetEquip && currentFault.toLowerCase().includes('pump'))) {
      return {
        text: `Pump P-101 Diagnostic Explanation:

Evidence:
• Casing Vibration: ${pump.vibration.toFixed(2)} g ${pump.vibration > 0.20 ? '↑ HIGH (Nominal < 0.15 g)' : '✓ NORMAL'}
• Rotational Speed: ${Math.round(pump.rpm)} RPM ${pump.rpm < 2200 ? '↓ REDUCED (Nominal ~2450 RPM)' : '✓ NORMAL'}
• Discharge Temp: ${pump.outlet_temperature.toFixed(1)} °C

Why AI Diagnosed This:
Elevated casing vibration accompanied by motor speed reduction matches the pump mechanical-fault signature (ISO 10816 vibration standard).

Probable Root Cause:
${currentRootCause || 'Bearing raceway degradation, mechanical unbalance, or shaft misalignment.'}

Action:
Inspect pump mechanical alignment, coupling integrity, and bearing lubrication.`,
        equipment: 'pump'
      };
    }

    if (targetEquip === 'heat_exchanger' || (!targetEquip && currentFault.toLowerCase().includes('heat'))) {
      return {
        text: `Heat Exchanger E-102 Diagnostic Explanation:

Evidence:
• Inlet Temp: ${hx.inlet_temperature.toFixed(1)} °C
• Outlet Temp: ${hx.outlet_temperature.toFixed(1)} °C
• Thermal Gradient (ΔT): ${hx.temperature_difference.toFixed(1)} °C ${hx.temperature_difference < 5.0 ? '↓ SEVERELY REDUCED (Nominal 12–14 °C)' : '✓ NORMAL'}
• Heat Transfer Efficiency: ${hx.heat_transfer_indicator.toFixed(1)} %

Why AI Diagnosed This:
The collapse in thermal difference (ΔT < 4.0 °C) despite normal fluid flow indicates a severe loss in overall heat transfer coefficient (U).

Probable Root Cause:
${currentRootCause || 'Internal scale accumulation or boundary fouling layer on exchanger tubes.'}

Action:
Initiate chemical cleaning / backflush cycle and inspect cooling stream flow.`,
        equipment: 'heat_exchanger'
      };
    }

    if (targetEquip === 'reactor' || (!targetEquip && currentFault.toLowerCase().includes('reactor'))) {
      return {
        text: `Reactor R-201 (CSTR) Diagnostic Explanation:

Evidence:
• Reactor Core Temp: ${reactor.temperature.toFixed(1)} °C ${reactor.temperature > 74.0 ? '↑ HIGH (Nominal 65.0 °C)' : '✓ NORMAL'}
• Internal Pressure: ${reactor.pressure.toFixed(2)} bar ${reactor.pressure > 2.50 ? '↑ ELEVATED (Nominal 2.05 bar)' : '✓ NORMAL'}
• Cooling Jacket Interlock: ${reactor.cooling_status === 1 ? 'ON (Active)' : 'TRIPPED / OFF 🔴'}
• Agitator Speed: ${Math.round(reactor.agitator_speed)} RPM

Why AI Diagnosed This:
Loss of jacket heat removal (Cooling = 0) causes exothermic Arrhenius reaction runaway, driving vapor pressure upward according to Antoine vapor-liquid equilibria.

Probable Root Cause:
${currentRootCause || 'Cooling jacket coolant supply failure or control valve interlock trip.'}

Action:
${currentAction || 'Emergency jacket coolant restoration and initiate automated quench protocol.'}`,
        equipment: 'reactor'
      };
    }

    if (targetEquip === 'distillation' || (!targetEquip && currentFault.toLowerCase().includes('distillation'))) {
      return {
        text: `Distillation Column T-301 Diagnostic Explanation:

Evidence:
• Reflux Ratio (L/D): ${dist.reflux_ratio.toFixed(2)} ${dist.reflux_ratio < 1.1 ? '↓ LOW (Nominal 1.8–2.2)' : '✓ NORMAL'}
• Top Vapor Temperature: ${dist.top_temperature.toFixed(1)} °C ${dist.top_temperature > 78.0 ? '↑ ELEVATED (Nominal ~76.5 °C)' : '✓ NORMAL'}
• Column Operating Pressure: ${dist.pressure.toFixed(2)} bar ${dist.pressure > 2.50 ? '↑ ELEVATED (Nominal 2.10 bar)' : '✓ NORMAL'}

Why AI Diagnosed This:
Depleted reflux flow reduces cold liquid return to upper column trays, allowing heavy vapor fractions to bypass fractionation, driving overhead temperature upward.

Probable Root Cause:
${currentRootCause || 'Column reflux starvation / reflux pump control valve failure.'}

Action:
${currentAction || 'Inspect reflux pump, verify reflux control valve position, and check condenser cooling flow.'}`,
        equipment: 'distillation'
      };
    }
  }

  // -------------------------------------------------------------
  // 8. Equipment-Specific Query: PUMP (P-101)
  // -------------------------------------------------------------
  if (detectedEquip === 'pump' || lowerQ.includes('pump') || lowerQ.includes('p-101') || lowerQ.includes('p101')) {
    const isFaulty = pump.vibration > 0.20 || pump.rpm < 2200;
    return {
      text: `PUMP P-101 (6V Water Demonstrator / Hardware Prototype):

Current Telemetry:
• Speed: ${Math.round(pump.rpm)} RPM ${pump.rpm < 2200 ? '↓ (Abnormal Slip)' : '✓ (Nominal)'}
• Casing Vibration: ${pump.vibration.toFixed(2)} g ${pump.vibration > 0.20 ? '↑ (Elevated Acceleration)' : '✓ (Nominal)'}
• Inlet Temperature: ${pump.inlet_temperature.toFixed(1)} °C
• Discharge Temperature: ${pump.outlet_temperature.toFixed(1)} °C
• Data Source: ${equipment?.pump?.source_label || 'DEMO / REAL SENSOR'}

Status: ${isFaulty ? 'ABNORMAL / MECHANICAL FAULT ⚠' : 'NORMAL OPERATION ✓'}
${isFaulty ? `Probable Cause: Bearing wear, shaft misalignment, or impeller unbalance.\nRecommended Check: Inspect pump mounting, shaft alignment, and bearing lubrication.` : `Operating smoothly within nominal vibration boundary (< 0.15 g).`}`,
      equipment: 'pump'
    };
  }

  // -------------------------------------------------------------
  // 9. Equipment-Specific Query: HEAT EXCHANGER (E-102 / E-101)
  // -------------------------------------------------------------
  if (detectedEquip === 'heat_exchanger' || lowerQ.includes('heat exchanger') || lowerQ.includes('e-102') || lowerQ.includes('e-101') || lowerQ.includes('e102') || lowerQ.includes('e101')) {
    const isFaulty = hx.temperature_difference < 5.0;
    return {
      text: `HEAT EXCHANGER E-102 (Counter-Flow Shell & Tube Unit):

Current Telemetry:
• Stream Inlet Temp: ${hx.inlet_temperature.toFixed(1)} °C
• Stream Outlet Temp: ${hx.outlet_temperature.toFixed(1)} °C
• Thermal Gradient (ΔT): ${hx.temperature_difference.toFixed(1)} °C ${isFaulty ? '↓ (Severely Degraded)' : '✓ (Nominal 12–14 °C)'}
• Heat Transfer Indicator: ${hx.heat_transfer_indicator.toFixed(1)} %

Status: ${isFaulty ? 'ABNORMAL / THERMAL FOULING ⚠' : 'NORMAL OPERATION ✓'}
${isFaulty ? `Probable Cause: Tube scale fouling or coolant flow reduction creating high boundary thermal resistance.\nRecommended Check: Perform exchanger chemical wash / backflush and inspect coolant circulation pump.` : `Thermal transfer gradient is nominal with healthy heat exchange efficiency.`}`,
      equipment: 'heat_exchanger'
    };
  }

  // -------------------------------------------------------------
  // 10. Equipment-Specific Query: REACTOR (R-201 / R-101 / CSTR)
  // -------------------------------------------------------------
  if (detectedEquip === 'reactor' || lowerQ.includes('reactor') || lowerQ.includes('r-201') || lowerQ.includes('r-101') || lowerQ.includes('r201') || lowerQ.includes('r101') || lowerQ.includes('cstr')) {
    const isFaulty = reactor.cooling_status === 0 || reactor.temperature > 74.0 || reactor.pressure > 2.50;
    return {
      text: `REACTOR R-201 (Continuous Stirred-Tank Reactor - CSTR):

Current Telemetry:
• Reaction Temperature: ${reactor.temperature.toFixed(1)} °C ${reactor.temperature > 74.0 ? '↑ (HIGH ALARM)' : '✓ (Nominal 65.0 °C)'}
• Vessel Internal Pressure: ${reactor.pressure.toFixed(2)} bar ${reactor.pressure > 2.50 ? '↑ (ELEVATED)' : '✓ (Nominal 2.05 bar)'}
• Vessel Holdup Level: ${reactor.level.toFixed(1)} %
• Agitator Speed: ${Math.round(reactor.agitator_speed)} RPM
• Cooling Jacket Interlock: ${reactor.cooling_status === 1 ? 'ON (1 - Active)' : 'TRIPPED / OFF (0) 🔴'}

Status: ${isFaulty ? 'CRITICAL RUNAWAY RISK 🔴' : 'NORMAL OPERATION ✓'}
${isFaulty ? `Probable Cause: Loss of cooling jacket heat dissipation triggering exothermic Arrhenius temperature surge and Antoine vapor pressure buildup.\nRecommended Check: Immediately verify jacket coolant valve position, emergency backup coolant pump, and prepare reaction inhibitor/quench.` : `Exothermic heat generation is stably balanced by jacket heat removal.`}`,
      equipment: 'reactor'
    };
  }

  // -------------------------------------------------------------
  // 11. Equipment-Specific Query: DISTILLATION (T-301 / D-101)
  // -------------------------------------------------------------
  if (detectedEquip === 'distillation' || lowerQ.includes('distillation') || lowerQ.includes('t-301') || lowerQ.includes('d-101') || lowerQ.includes('t301') || lowerQ.includes('d101') || lowerQ.includes('column')) {
    const isFaulty = dist.reflux_ratio < 1.1 || dist.top_temperature > 78.0;
    return {
      text: `DISTILLATION COLUMN T-301 (Binary Fractionating Unit):

Current Telemetry:
• Reflux Ratio (L/D): ${dist.reflux_ratio.toFixed(2)} ${dist.reflux_ratio < 1.1 ? '↓ (Reflux Starvation)' : '✓ (Nominal 1.8–2.2)'}
• Top Vapor Temperature: ${dist.top_temperature.toFixed(1)} °C ${dist.top_temperature > 78.0 ? '↑ (High Overhead Temp)' : '✓ (Nominal 76.5 °C)'}
• Bottom Reboiler Temp: ${dist.bottom_temperature.toFixed(1)} °C
• Column Pressure: ${dist.pressure.toFixed(2)} bar
• Bottom Level: ${dist.level.toFixed(1)} %

Status: ${isFaulty ? 'ABNORMAL / SEPARATION DEGRADATION ⚠' : 'NORMAL OPERATION ✓'}
${isFaulty ? `Probable Cause: Reflux pump starvation or control valve closure allowing uncondensed heavy vapor to reach the top tray.\nRecommended Check: Check reflux pump motor, reflux flow control valve, and condenser cooling water supply.` : `Tray vapor-liquid equilibria and distillate separation are operating at nominal design specifications.`}`,
      equipment: 'distillation'
    };
  }

  // -------------------------------------------------------------
  // 12. Default Intelligent Fallback
  // -------------------------------------------------------------
  return {
    text: `ChemDiag AI Telemetry Analysis:

Current Process State:
• Active Diagnosis: ${currentFault} (${currentSeverity} Severity)
• Anomaly Status: ${isAnomaly ? 'DETECTED ⚠' : 'NOMINAL ✓'}

Live Sensor Highlights:
• Pump P-101: ${Math.round(pump.rpm)} RPM, ${pump.vibration.toFixed(2)} g vibration
• Heat Exchanger E-102: ΔT = ${hx.temperature_difference.toFixed(1)} °C
• Reactor R-201: ${reactor.temperature.toFixed(1)} °C, ${reactor.pressure.toFixed(2)} bar, Cooling: ${reactor.cooling_status === 1 ? 'ON' : 'OFF'}
• Distillation T-301: Reflux = ${dist.reflux_ratio.toFixed(2)}, Top Temp = ${dist.top_temperature.toFixed(1)} °C

${isAnomaly ? `Probable Root Cause: ${currentRootCause}\nAction: ${currentAction}` : `All monitored process equipment is currently operating within nominal baseline parameters.`}`,
    equipment: detectedEquip || 'all'
  };
}

/**
 * External LLM API Query Handler (if configured via env)
 */
async function queryExternalLlm({ apiKey, message, history, detectedEquip, liveState }) {
  const { equipment, diagnosis, activeFault } = liveState;

  const systemPrompt = `You are ChemDiag AI, an explainable chemical process engineering AI copilot monitoring a live pilot chemical plant.
You must answer concisely based strictly on the following CURRENT LIVE PROCESS TELEMETRY:

Current Process State:
- Active Fault Mode: ${activeFault}
- Overall Diagnosis: ${diagnosis?.probable_fault || 'Nominal'} (Severity: ${diagnosis?.severity || 'NORMAL'}, Confidence: ${Math.round((diagnosis?.confidence || 0.85) * 100)}%)
- Root Cause: ${diagnosis?.root_cause || 'None'}
- Recommended Action: ${diagnosis?.recommended_action || 'Continue routine monitoring'}

Live Equipment Telemetry:
1. Pump (P-101): Speed = ${equipment?.pump?.data?.rpm || 2450} RPM, Vibration = ${equipment?.pump?.data?.vibration || 0.08} g, Inlet Temp = ${equipment?.pump?.data?.inlet_temperature || 25.2} °C, Outlet Temp = ${equipment?.pump?.data?.outlet_temperature || 38.1} °C (Status: ${(equipment?.pump?.data?.vibration || 0) > 0.25 ? 'HIGH VIBRATION FAULT' : 'NORMAL'})
2. Heat Exchanger (E-102): Inlet Temp = ${equipment?.heat_exchanger?.data?.inlet_temperature || 25.2} °C, Outlet Temp = ${equipment?.heat_exchanger?.data?.outlet_temperature || 38.1} °C, ΔT = ${equipment?.heat_exchanger?.data?.temperature_difference || 12.9} °C (Status: ${(equipment?.heat_exchanger?.data?.temperature_difference || 0) < 4.0 ? 'FOULING DEGRADATION' : 'NORMAL'})
3. Reactor (R-201 CSTR): Core Temp = ${equipment?.reactor?.data?.temperature || 65.0} °C, Pressure = ${equipment?.reactor?.data?.pressure || 2.05} bar, Agitator = ${equipment?.reactor?.data?.agitator_speed || 350} RPM, Cooling Jacket = ${equipment?.reactor?.data?.cooling_status === 1 ? 'ON (Active)' : 'TRIPPED/OFF (Cooling Loss)'} (Status: ${(equipment?.reactor?.data?.temperature || 0) > 85 || equipment?.reactor?.data?.cooling_status === 0 ? 'CRITICAL RUNAWAY RISK' : 'NORMAL'})
4. Distillation Column (T-301): Top Temp = ${equipment?.distillation?.data?.top_temperature || 64.2} °C, Bottom Temp = ${equipment?.distillation?.data?.bottom_temperature || 98.4} °C, Pressure = ${equipment?.distillation?.data?.pressure || 1.82} bar, Reflux Ratio = ${equipment?.distillation?.data?.reflux_ratio || 2.2} (Status: ${(equipment?.distillation?.data?.reflux_ratio || 0) < 1.1 ? 'REFLUX STARVATION FAULT' : 'NORMAL'})

Instructions:
- Keep answers concise, factual, and based on actual numbers above.
- Structure responses with: ANSWER, EVIDENCE, PROBABLE ROOT CAUSE, and RECOMMENDED ACTION where applicable.
- Do NOT hallucinate sensor values or conditions.`;

  const url = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1/chat/completions';
  
  const formattedHistory = (history || []).slice(-6).map(h => ({
    role: h.sender === 'ai' ? 'assistant' : 'user',
    content: h.text
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...formattedHistory,
        { role: 'user', content: message }
      ],
      temperature: 0.2,
      max_tokens: 450
    })
  });

  if (!response.ok) {
    throw new Error(`LLM API returned status ${response.status}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content?.trim();
}
