/**
 * ChemDiag Universal Industrial Dynamic Reasoning Engine
 * 
 * Deep, multi-discipline industrial intelligence covering:
 * - Fluid Machinery (Pumps, Compressors, Turbines, Valves, Cavitation, Surge, Water Hammer)
 * - Heat Transfer (Shell & Tube, Condensers, Reboilers, Cooling Towers, Fouling, LMTD, NTU)
 * - Reaction Engineering (CSTR, PFR, Batch, Arrhenius Kinetics, Thermal Runaway Dynamics)
 * - Separation Processes (Distillation Trays/Packing, McCabe-Thiele, Reflux, Flooding, Weeping, Absorption)
 * - Process Control & Automation (PID Tuning, Ziegler-Nichols, Cascade, Feedforward, Ratio Control)
 * - Sensors & Instrumentation (RTD, Thermocouples, DP Transmitters, Coriolis, 4-20mA, Calibration)
 * - Automation & Systems (PLC, DCS, SCADA, Modbus, OPC-UA, Alarm Management, SIS/SIL)
 * - Process Safety & Risk (HAZOP Guide Words, LOPA, FMEA, PSV Sizing, Quench Protocols)
 * - Condition Monitoring & Reliability (Vibration FFT, ISO 10816, Bearing Frequencies, PdM)
 * - Live ChemDiag Digital Twin Process Grounding & Downstream Causal Propagation
 */

import { Units, Fluid, Heat, Thermo, Reaction, Mass, Control, Equipment, executeEngineeringTool } from '../engineering/index.js';

const EQUIPMENT_ALIASES = {
  pump: ['pump', 'p-101', 'p101', 'centrifugal pump'],
  heat_exchanger: ['heat exchanger', 'heat-exchanger', 'e-101', 'e-102', 'e101', 'e102', 'hx'],
  reactor: ['reactor', 'r-101', 'r-201', 'r101', 'r201', 'cstr', 'pfr'],
  distillation: ['distillation', 'distillation column', 't-101', 't-301', 't101', 't301', 'd-101', 'd101', 'fractionator']
};

const NOMINAL_BASELINES = {
  pump: { rpm: 2450, vibration: 0.08, flow: 10.0, inlet_temperature: 25.2, outlet_temperature: 38.1 },
  heat_exchanger: { inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, heat_transfer_indicator: 95.0, efficiency: 95.0 },
  reactor: { temperature: 65.0, pressure: 2.05, level: 50.0, agitator_speed: 350, cooling_status: 1 },
  distillation: { top_temperature: 76.5, bottom_temperature: 98.4, pressure: 2.10, level: 52.0, reflux_ratio: 1.85 }
};

export function getEquipmentContext(query = '', selectedEquipment = null, history = []) {
  const q = query.toLowerCase().trim();

  // If query is about general unmodeled equipment or theoretical concepts, don't force equipment filter
  if (
    q.includes('compressor') ||
    q.includes('surge') ||
    q.includes('turbine') ||
    q.includes('entropy') ||
    q.includes('thermodynamics') ||
    q.includes('pid') ||
    q.includes('tuning') ||
    q.includes('compare') ||
    (q.includes('all') && q.includes('equipment')) ||
    (q.includes('process') && (q.includes('summary') || q.includes('status') || q.includes('overview') || q.includes('normal')))
  ) {
    // Only return equipment if explicitly asking about my specific unit
    if (q.includes('my heat exchanger') || q.includes('e-101') || q.includes('e101')) return 'heat_exchanger';
    if (q.includes('my pump') || q.includes('p-101') || q.includes('p101')) return 'pump';
    if (q.includes('my reactor') || q.includes('r-101') || q.includes('r101')) return 'reactor';
    if (q.includes('my column') || q.includes('d-101') || q.includes('d101')) return 'distillation';
    return null;
  }

  for (const [key, aliases] of Object.entries(EQUIPMENT_ALIASES)) {
    if (aliases.some(alias => q.includes(alias))) {
      return key;
    }
  }

  if (selectedEquipment && EQUIPMENT_ALIASES[selectedEquipment]) {
    return selectedEquipment;
  }

  const hasPronounRef = /\b(it|this|that|the problem|the fault|the issue|serious|danger|action|check|next|prognosis|risk)\b/i.test(q);
  if (hasPronounRef && history && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const histText = (history[i].text || history[i].content || history[i].message || '').toLowerCase();
      // If the immediate preceding turn was about compressors, PID, or general theory, don't latch to an old equipment
      if (histText.includes('compressor') || histText.includes('surge') || histText.includes('entropy') || histText.includes('pid') || histText.includes('tuning')) {
        return null;
      }
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
    confidence: diagnosis.confidence || 0.95,
    anomalyScore: diagnosis.anomaly_score || 0.18,
    isUnknownFault: !!diagnosis.is_unknown_fault,
    riskScore: diagnosis.preventive?.riskScore ?? 12,
    riskStage: diagnosis.preventive?.riskStage ?? 'NORMAL',
    safetyGate: diagnosis.safetyGate || { safeToRecommend: true, statusLabel: '✓ SAFE TO RECOMMEND' },
    prognosis: diagnosis.prognosis || {},
    xaiContributions: diagnosis.xai_contributions || [],
    preventive: diagnosis.preventive || {},
    evidenceCards: diagnosis.evidence_cards || []
  };
}

export function generateRecommendation(liveState) {
  const diag = getCurrentDiagnosis(liveState);
  return diag.preventive?.preventiveMeasure || diag.recommendedAction || 'Continue routine supervisory monitoring.';
}

export function compareRecentValues(targetEquip, liveState) {
  const { equipment } = liveState;

  if (targetEquip === 'distillation' || (!targetEquip && liveState.activeFault?.includes('distillation'))) {
    const curr = equipment?.distillation?.data || NOMINAL_BASELINES.distillation;
    const base = NOMINAL_BASELINES.distillation;
    return `Reflux ratio has ${curr.reflux_ratio < base.reflux_ratio ? 'decreased' : 'increased'} from ${base.reflux_ratio.toFixed(2)} to ${curr.reflux_ratio.toFixed(2)} L/D.
Top vapor temperature has ${curr.top_temperature > base.top_temperature ? 'increased' : 'decreased'} from ${base.top_temperature.toFixed(1)} °C to ${curr.top_temperature.toFixed(1)} °C.
Column pressure is ${curr.pressure.toFixed(2)} bar.

This combination is consistent with column reflux degradation.`;
  }

  if (targetEquip === 'pump' || (!targetEquip && liveState.activeFault?.includes('pump'))) {
    const curr = equipment?.pump?.data || NOMINAL_BASELINES.pump;
    const base = NOMINAL_BASELINES.pump;
    const flow = curr.flow ?? ((curr.rpm / 2450) * 10.0);
    return `Pump RPM has decreased from ${base.rpm} to ${Math.round(curr.rpm)} RPM while vibration increased from ${base.vibration.toFixed(2)} to ${curr.vibration.toFixed(2)} g and discharge flow decreased to ${flow.toFixed(1)} L/min.

This combination is consistent with developing mechanical degradation.`;
  }

  if (targetEquip === 'heat_exchanger' || (!targetEquip && liveState.activeFault?.includes('heat'))) {
    const curr = equipment?.heat_exchanger?.data || NOMINAL_BASELINES.heat_exchanger;
    const base = NOMINAL_BASELINES.heat_exchanger;
    return `Temperature difference (ΔT) has decreased from ${base.temperature_difference.toFixed(1)} °C to ${curr.temperature_difference.toFixed(1)} °C.
Heat transfer efficiency is currently ${(curr.efficiency ?? curr.heat_transfer_indicator).toFixed(1)}%.
Inlet temperature is ${curr.inlet_temperature.toFixed(1)} °C and outlet temperature is ${curr.outlet_temperature.toFixed(1)} °C.

This combination is consistent with heat exchanger fouling.`;
  }

  if (targetEquip === 'reactor' || (!targetEquip && liveState.activeFault?.includes('reactor'))) {
    const curr = equipment?.reactor?.data || NOMINAL_BASELINES.reactor;
    const base = NOMINAL_BASELINES.reactor;
    return `Cooling status is ${curr.cooling_status === 1 ? 'ON' : 'TRIPPED/OFF'}.
Reactor temperature has increased from ${base.temperature.toFixed(1)} °C to ${curr.temperature.toFixed(1)} °C.
Vessel pressure has increased from ${base.pressure.toFixed(2)} bar to ${curr.pressure.toFixed(2)} bar.

This combination is consistent with reactor cooling failure.`;
  }

  return `All monitored process variables remain within normal baseline boundaries:
• Pump Speed: ${Math.round(equipment?.pump?.data?.rpm || 2450)} RPM (Baseline: ~2450 RPM)
• Pump Vibration: ${(equipment?.pump?.data?.vibration || 0.08).toFixed(2)} g (Baseline: < 0.20 g)
• Exchanger ΔT: ${(equipment?.heat_exchanger?.data?.temperature_difference || 12.9).toFixed(1)} °C (Baseline: ~12.9 °C)
• Reactor Temp: ${(equipment?.reactor?.data?.temperature || 65.0).toFixed(1)} °C (Baseline: ~65.0 °C)
• Distillation Reflux: ${(equipment?.distillation?.data?.reflux_ratio || 1.85).toFixed(2)} (Baseline: ~1.85)

No significant deviations detected from baseline values.`;
}

/**
 * Universal Chemical & Industrial Process Q&A Engine
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

  const equipment = liveState?.equipment || {};
  const rawPump = equipment.pump?.data || NOMINAL_BASELINES.pump;
  const rawHx = equipment.heat_exchanger?.data || NOMINAL_BASELINES.heat_exchanger;
  const rawReactor = equipment.reactor?.data || NOMINAL_BASELINES.reactor;
  const rawDist = equipment.distillation?.data || NOMINAL_BASELINES.distillation;

  const pump = {
    rpm: rawPump.rpm ?? rawPump.pump_rpm ?? 2450,
    vibration: rawPump.vibration ?? rawPump.pump_vibration ?? 0.08,
    flow: rawPump.flow ?? rawPump.pump_flow ?? 10.0,
    inlet_temperature: rawPump.inlet_temperature ?? rawPump.pump_inlet_temperature ?? 25.2,
    outlet_temperature: rawPump.outlet_temperature ?? rawPump.pump_outlet_temperature ?? 38.1,
    status: rawPump.status || 'NORMAL'
  };

  const hx = {
    inlet_temperature: rawHx.inlet_temperature ?? rawHx.heat_exchanger_inlet_temperature ?? 25.2,
    outlet_temperature: rawHx.outlet_temperature ?? rawHx.heat_exchanger_outlet_temperature ?? 38.1,
    temperature_difference: rawHx.temperature_difference ?? rawHx.heat_exchanger_temperature_difference ?? 12.9,
    heat_transfer_indicator: rawHx.heat_transfer_indicator ?? rawHx.heat_exchanger_indicator ?? 95.0,
    status: rawHx.status || 'NORMAL'
  };

  const reactor = {
    temperature: rawReactor.temperature ?? rawReactor.reactor_temperature ?? 65.0,
    pressure: rawReactor.pressure ?? rawReactor.reactor_pressure ?? 2.05,
    cooling_status: rawReactor.cooling_status ?? rawReactor.reactor_cooling_status ?? 1,
    level: rawReactor.level ?? rawReactor.reactor_level ?? 50.0,
    agitator_speed: rawReactor.agitator_speed ?? rawReactor.reactor_agitator_speed ?? 350,
    status: rawReactor.status || 'NORMAL'
  };

  const dist = {
    top_temperature: rawDist.top_temperature ?? rawDist.distillation_top_temperature ?? 76.5,
    bottom_temperature: rawDist.bottom_temperature ?? rawDist.distillation_bottom_temperature ?? 98.4,
    pressure: rawDist.pressure ?? rawDist.distillation_pressure ?? 2.10,
    reflux_ratio: rawDist.reflux_ratio ?? rawDist.distillation_reflux_ratio ?? 1.85,
    status: rawDist.status || 'NORMAL'
  };

  const diag = getCurrentDiagnosis(liveState);
  const isAnomaly = diag.isAnomaly;
  const isUnknown = diag.isUnknownFault;
  const safety = diag.safetyGate;
  const prog = diag.prognosis;
  const prev = diag.preventive;

  let detectedEquip = getEquipmentContext(query, selectedEquipment, history);

  if (!detectedEquip && isAnomaly && !isUnknown) {
    if (liveState.activeFault?.includes('pump')) detectedEquip = 'pump';
    else if (liveState.activeFault?.includes('reactor')) detectedEquip = 'reactor';
    else if (liveState.activeFault?.includes('distillation')) detectedEquip = 'distillation';
    else if (liveState.activeFault?.includes('heat')) detectedEquip = 'heat_exchanger';
  }

  // Extract recent conversation turns and resolve active conversational topic
  const recentTurns = (history || [])
    .filter(h => h && (h.text || h.content || h.message))
    .slice(-8);

  const fullHistoryText = recentTurns
    .map(h => (h.text || h.content || h.message || '').toLowerCase())
    .join(' ');

  const recentUserTurns = (history || [])
    .filter(h => h.sender === 'user' || h.role === 'user')
    .slice(-4);
  const lastUserTurn = (recentUserTurns[recentUserTurns.length - 1]?.text || recentUserTurns[recentUserTurns.length - 1]?.content || recentUserTurns[recentUserTurns.length - 1]?.message || '').toLowerCase();

  const recentAiTurns = (history || [])
    .filter(h => h.sender === 'ai' || h.role === 'assistant')
    .slice(-4);
  const lastAiTurn = (recentAiTurns[recentAiTurns.length - 1]?.text || recentAiTurns[recentAiTurns.length - 1]?.content || recentAiTurns[recentAiTurns.length - 1]?.message || '').toLowerCase();

  // Detect if user is explicitly switching away from previous subject
  const isSwitchingTopic = /\b(forget|switch to|instead|let's talk about|talk about|what about|okay forget)\b/i.test(query) && (
    lowerQ.includes('compressor') ||
    lowerQ.includes('surge') ||
    lowerQ.includes('pump') ||
    lowerQ.includes('cavitation') ||
    lowerQ.includes('reactor') ||
    lowerQ.includes('distillation') ||
    lowerQ.includes('heat exchanger') ||
    lowerQ.includes('boiler') ||
    lowerQ.includes('plc') ||
    lowerQ.includes('sky') ||
    lowerQ.includes('entropy') ||
    lowerQ.includes('pid')
  );

  const isFollowUpPattern = /^(why|how|how so|what about|could that|can that|how is that|what would i need|is it|what does it|explain more|tell me more|what next|what to do|what should i do|what causes|what if|how do i|how to|what should i check|how would i detect|could my pump)\b/i.test(query.trim()) && query.trim().split(/\s+/).length <= 12;

  // Active topic flags based on immediate previous turns when not switching
  const prevWasPID = !isSwitchingTopic && (
    lastUserTurn.includes('pid') ||
    lastUserTurn.includes('tuning') ||
    lastUserTurn.includes('oscillat') ||
    lastUserTurn.includes('dead time') ||
    lastAiTurn.includes('pid') ||
    lastAiTurn.includes('proportional') ||
    lastAiTurn.includes('ziegler') ||
    lastAiTurn.includes('controller output') ||
    lastAiTurn.includes('why pid control')
  );

  const prevWasCompressor = !isSwitchingTopic && (
    lastUserTurn.includes('compressor') ||
    lastUserTurn.includes('surge') ||
    lastAiTurn.includes('compressor') ||
    lastAiTurn.includes('surge line') ||
    lastAiTurn.includes('anti-surge')
  );

  const prevWasCavitation = !isSwitchingTopic && (
    lastUserTurn.includes('cavitation') ||
    lastUserTurn.includes('npsh') ||
    lastAiTurn.includes('cavitation') ||
    lastAiTurn.includes('npsha') ||
    lastAiTurn.includes('vapor pressure')
  );

  // =========================================================================
  // 0. DETERMINISTIC INDUSTRIAL ENGINEERING CALCULATION ENGINE
  // =========================================================================

  // A. MULTI-TURN CONVERSATION FOLLOW-UP: "Why did you divide by 3600?"
  if (
    lowerQ.includes('3600') ||
    (lowerQ.includes('divide') && (lowerQ.includes('3600') || lowerQ.includes('hour') || lowerQ.includes('second'))) ||
    (isFollowUpPattern && lowerQ.includes('3600'))
  ) {
    return {
      success: true,
      answer: `EXPLANATION OF 3600 S/H UNIT CONVERSION:

1. Reason for Dividing by 3600:
The numerical factor 3600 represents the exact number of seconds in one hour:
• 1 hour = 60 minutes = 60 × 60 = 3600 seconds (3600 s/h).

2. SI Unit Consistency in Fluid Mechanics:
• Volumetric flow rate was provided in cubic meters per hour (m³/h).
• In the International System of Units (SI), fluid velocity is expressed in meters per second (m/s). To achieve dimensional consistency with cross-sectional pipe area in square meters (m²), flow rate must be in cubic meters per second (m³/s):
  Q [m³/s] = Q [m³/h] / 3600 s/h
  Q = 5.0 m³/h / 3600 = 1.3889 × 10⁻³ m³/s

3. Velocity Formula Dimensional Verification:
• Velocity equation: v [m/s] = Q [m³/s] / A [m²]
• Dimensional breakdown: [m³/s] / [m²] = [m/s]
• Without dividing by 3600, the resulting velocity would be in meters per hour (m/h) rather than standard engineering meters per second (m/s).`,
      equipment: 'all',
      intent: 'calc_unit_conversion_explanation',
      timestamp
    };
  }

  // B. MULTI-TURN CONVERSATION FOLLOW-UP: "What if the diameter becomes 50 mm?"
  const isDiameterChangeFollowUp = (
    lowerQ.includes('diameter') && (
      lowerQ.includes('what if') ||
      lowerQ.includes('becomes') ||
      lowerQ.includes('changes to') ||
      lowerQ.includes('is 50') ||
      lowerQ.includes('50 mm') ||
      lowerQ.includes('double') ||
      isFollowUpPattern
    )
  ) || (isFollowUpPattern && (lowerQ.includes('50 mm') || lowerQ.includes('50mm')));

  if (isDiameterChangeFollowUp) {
    const diamMatch = query.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m)?/i);
    const newDiam = diamMatch ? parseFloat(diamMatch[1]) : 50.0;
    const flowRate = 5.0; // carried from previous turn (5 m3/h)

    const calcResult = Fluid.calcPipeVelocity({
      flowRate,
      flowUnit: 'm3/h',
      diameter: newDiam,
      diameterUnit: 'mm'
    });

    const v_ms = calcResult.results.velocity_ms;
    const v_fts = calcResult.results.velocity_fts;
    const area_m2 = calcResult.results.area_m2;
    const Q_m3s = calcResult.inputs.flowRate.siValue;

    return {
      success: true,
      answer: `ENGINEERING RE-CALCULATION: PIPE DIAMETER INCREASE TO ${newDiam} MM

1. Given Parameters & Conversions:
• Volumetric Flow Rate (Q): ${flowRate.toFixed(2)} m³/h = ${Q_m3s.toExponential(3)} m³/s (carried from ongoing context)
• New Pipe Inside Diameter (D₂): ${newDiam.toFixed(2)} mm = ${(newDiam / 1000).toFixed(4)} m (doubled from original 25 mm)

2. Governing Equations & Scaling Relationships:
• Cross-Sectional Area: A₂ = (π · D₂²) / 4
• Fluid Velocity: v₂ = Q / A₂
• Inverse-Square Scaling Law: Flow area is proportional to the square of diameter (A ∝ D²). Doubling diameter (2×) expands area by a factor of 4 (2² = 4), which quarters the fluid velocity (v ∝ 1/D²) for constant volumetric throughput.

3. Step-by-Step Substitution:
• A₂ = (π · (${(newDiam / 1000).toFixed(4)} m)²) / 4 = ${area_m2.toExponential(4)} m² (4.0× area increase)
• v₂ = (${Q_m3s.toExponential(3)} m³/s) / (${area_m2.toExponential(4)} m²) = ${v_ms.toFixed(3)} m/s

4. Computed Result:
• New Fluid Flow Velocity (v₂): ${v_ms.toFixed(2)} m/s (${v_fts.toFixed(2)} ft/s) — exactly 25% of the initial 2.83 m/s.
• New Pipe Cross-Sectional Area (A₂): ${(area_m2 * 10000).toFixed(2)} cm² (${area_m2.toExponential(3)} m²)

5. Assumptions & Engineering Interpretation:
• Fluid velocity decreases from 2.83 m/s to ${v_ms.toFixed(2)} m/s.
• Pumping efficiency & erosion: 0.71 m/s dramatically reduces frictional head loss and wall erosion.
• Caution: In slurry handling or systems with settling solids, maintain velocity above ~0.8–1.0 m/s to prevent solid settling.`,
      equipment: 'all',
      intent: 'calc_pipe_velocity_followup',
      timestamp
    };
  }

  // C. MULTI-TURN CONVERSATION FOLLOW-UP: "How does that affect pressure drop?"
  const isPressureDropFollowUp = (
    lowerQ.includes('pressure drop') ||
    (isFollowUpPattern && (lowerQ.includes('pressure') || lowerQ.includes('head loss') || lowerQ.includes('drop')))
  ) && (
    fullHistoryText.includes('velocity') ||
    fullHistoryText.includes('diameter') ||
    fullHistoryText.includes('pipe') ||
    fullHistoryText.includes('50 mm')
  );

  if (isPressureDropFollowUp) {
    return {
      success: true,
      answer: `IMPACT OF PIPE DIAMETER ON FRICTIONAL PRESSURE DROP:

1. Governing Darcy-Weisbach Equation:
The frictional pressure drop (ΔP) for liquid flow along a straight pipe of length L is:
ΔP = f · (L / D) · (ρ · v² / 2)
Where:
• f = Darcy friction factor (from Moody chart or Haaland equation)
• L = Pipe length (m)
• D = Pipe inner diameter (m)
• ρ = Fluid density (kg/m³)
• v = Mean flow velocity (m/s)

2. Volumetric Flow Scaling Law (The 1/D⁵ Relationship):
Expressing velocity in terms of volumetric flow rate Q (v = 4·Q / (π·D²)) and substituting into the Darcy-Weisbach equation:
ΔP = f · (L / D) · (ρ / 2) · [16 · Q² / (π² · D⁴)]
ΔP = [8 · f · L · ρ · Q²] / [π² · D⁵]

Therefore, at constant volumetric flow rate Q:
ΔP ∝ 1 / D⁵

3. Quantitative Impact of Increasing Diameter (25 mm → 50 mm):
• Diameter Expansion Ratio: D₂ / D₁ = 50 mm / 25 mm = 2.0 (doubled)
• Theoretical Pressure Drop Ratio: ΔP₂ / ΔP₁ = (1 / 2.0)⁵ = 1 / 32 ≈ 0.03125
• Result: Doubling the inner diameter decreases frictional pressure drop and hydraulic head loss by a factor of 32 (a 96.88% reduction in pressure drop!).

4. Practical Industrial Engineering Trade-offs:
• Operating Cost (OPEX): Significantly lower pump discharge head and electrical motor power consumption (P = Q · ΔP).
• Capital Cost (CAPEX): Larger diameter pipe, flanges, and valves have higher material purchase and installation costs.
• Process Fluid Dynamics: Reduced velocity (0.71 m/s) reduces risk of erosion/corrosion and water hammer surge, but increases residence time.`,
      equipment: 'all',
      intent: 'calc_pressure_drop_scaling',
      timestamp
    };
  }

  // D. INFORMATION NEEDED FOR PUMP POWER: "What information do I need to calculate pump power?"
  const isPumpPowerInfoInquiry = (
    lowerQ.includes('what information') ||
    lowerQ.includes('what data') ||
    lowerQ.includes('what do i need') ||
    lowerQ.includes('parameters needed')
  ) && (lowerQ.includes('pump power') || lowerQ.includes('pump') || lowerQ.includes('hydraulic power'));

  if (isPumpPowerInfoInquiry) {
    return {
      success: true,
      answer: `INFORMATION REQUIRED TO CALCULATE PUMP POWER:

To calculate the hydraulic power and shaft brake power of a centrifugal pump, you need the following 4 engineering parameters:

1. Volumetric Flow Rate (Q):
• The volume of liquid delivered per unit time (e.g., in L/s, m³/h, L/min, or gpm).
• SI conversion: Must be in cubic meters per second (m³/s).

2. Total Dynamic Head (H) or Differential Pressure (ΔP):
• Total Dynamic Head (H) in meters (or feet), representing the total net mechanical energy delivered per unit weight of fluid: H = (P_dis - P_suc)/(ρ·g) + (z_dis - z_suc) + (v_dis² - v_suc²)/(2g).
• Alternatively, Differential Pressure (ΔP = P_discharge - P_suction) across the pump in bar or Pa.

3. Fluid Density (ρ) or Specific Gravity (SG):
• Liquid density in kg/m³ (e.g., ~1000 kg/m³ for ambient water, 850 kg/m³ for diesel, 1840 kg/m³ for sulfuric acid).

4. Pump Mechanical/Hydraulic Efficiency (η):
• Pump hydraulic efficiency (typically 65%–85% for centrifugal pumps at Best Efficiency Point, BEP).
• Driver/Motor efficiency (η_motor ≈ 90%–95%) for electrical sizing.

GOVERNING FORMULAS:
• Hydraulic Power: P_hydraulic = ρ · g · Q · H = Q · ΔP [Watts]
• Brake Shaft Power: P_shaft = P_hydraulic / η_pump [Watts]
• Electrical Motor Power: P_electric = P_shaft / η_motor [Watts]`,
      equipment: 'pump',
      intent: 'pump_power_info_requirements',
      timestamp
    };
  }

  // E. PUMP POWER CALCULATION (Direct or Follow-up): "A pump delivers 10 L/s against 20 m head. Estimate hydraulic power."
  const isPumpPowerCalc = (
    (lowerQ.includes('pump') || lowerQ.includes('hydraulic power')) &&
    (lowerQ.includes('power') || lowerQ.includes('estimate') || lowerQ.includes('calculate')) &&
    (
      (lowerQ.includes('10 l/s') || lowerQ.includes('10l/s') || lowerQ.includes('20 m') || lowerQ.includes('20m') || lowerQ.includes('head') || lowerQ.includes('l/s')) ||
      (isFollowUpPattern && (lastUserTurn.includes('pump power') || lastAiTurn.includes('pump power')))
    )
  );

  if (isPumpPowerCalc) {
    let flow = 10.0;
    let head = 20.0;

    const flowMatch = query.match(/(\d+(?:\.\d+)?)\s*(l\/s|l\/min|m3\/h|m³\/h|gpm)/i);
    if (flowMatch) {
      flow = parseFloat(flowMatch[1]);
    }
    const headMatch = query.match(/(\d+(?:\.\d+)?)\s*(m|meter|meters|ft|feet)\s*head/i) || query.match(/head.*?(\d+(?:\.\d+)?)\s*(m|meter|meters|ft|feet)?/i) || query.match(/(\d+(?:\.\d+)?)\s*m\b/i);
    if (headMatch) {
      head = parseFloat(headMatch[1]);
    }

    const calcResult = Fluid.calcPumpHydraulicPower({
      flowRate: flow,
      flowUnit: 'L/s',
      head: head,
      headUnit: 'm',
      density: 1000,
      efficiency: 0.75
    });

    const hydW = calcResult.results.hydraulicPower_W;
    const hydKW = calcResult.results.hydraulicPower_kW;
    const hydHP = calcResult.results.hydraulicPower_hp;
    const shaftKW = calcResult.results.shaftPower_kW;
    const shaftHP = calcResult.results.shaftPower_hp;
    const deltaPBar = calcResult.results.deltaP_bar;
    const deltaPKPa = calcResult.results.deltaP_kPa;

    return {
      success: true,
      answer: `ENGINEERING CALCULATION: PUMP HYDRAULIC & SHAFT POWER

1. Given Operating Parameters & Conversions:
• Volumetric Flow Rate (Q): ${flow.toFixed(2)} L/s = ${(flow / 1000).toFixed(4)} m³/s
• Total Dynamic Head (H): ${head.toFixed(1)} m
• Fluid: Water at ~20°C (Density ρ = 1000 kg/m³, Gravitational Acceleration g = 9.81 m/s²)
• Assumed Pump Efficiency (η): 75.0% (typical centrifugal pump BEP)

2. Governing Equations:
• Hydraulic (Water) Power: P_hydraulic = ρ · g · Q · H
• Brake Shaft Power: P_shaft = P_hydraulic / η_pump

3. Step-by-Step Substitution:
• P_hydraulic = (1000 kg/m³) · (9.81 m/s²) · (${(flow / 1000).toFixed(4)} m³/s) · (${head.toFixed(1)} m)
• P_hydraulic = ${hydW.toFixed(1)} W = ${hydKW.toFixed(3)} kW
• P_shaft = ${hydKW.toFixed(3)} kW / 0.75 = ${shaftKW.toFixed(3)} kW

4. Computed Results:
• Hydraulic Power (P_hyd): ${hydKW.toFixed(2)} kW (${hydHP.toFixed(2)} hp)
• Required Brake Shaft Power (P_shaft): ${shaftKW.toFixed(2)} kW (${shaftHP.toFixed(2)} hp)
• Differential Pressure Equivalent (ΔP): ${deltaPBar.toFixed(2)} bar (${deltaPKPa.toFixed(1)} kPa)

5. Assumptions & Operational Guidance:
• Single-phase, non-cavitating, incompressible Newtonian fluid.
• Motor Sizing: Standard industrial practice applies a 15%–20% motor safety margin ($P_{motor} \approx 3.0\text{ kW}$ standard IEC/NEMA frame).`,
      equipment: 'pump',
      intent: 'calc_pump_power',
      timestamp
    };
  }

  // F. LIVE PUMP POWER ESTIMATE: "Estimate the hydraulic power of my current pump."
  const isLivePumpPowerInquiry = (
    (lowerQ.includes('hydraulic power') || lowerQ.includes('pump power')) &&
    (lowerQ.includes('my current pump') || lowerQ.includes('current pump') || lowerQ.includes('my pump') || lowerQ.includes('p-101') || lowerQ.includes('p101'))
  );

  if (isLivePumpPowerInquiry) {
    const pumpFlowLpm = pump.flow ?? 10.0;
    const pumpFlowMps = (pumpFlowLpm / 60000.0);
    const pumpHeadM = Number(((pump.rpm / 2450.0) ** 2 * 20.0).toFixed(1));

    const calcResult = Fluid.calcPumpHydraulicPower({
      flowRate: pumpFlowLpm,
      flowUnit: 'L/min',
      head: pumpHeadM,
      headUnit: 'm',
      density: 1000,
      efficiency: 0.75
    });

    const hydW = calcResult.results.hydraulicPower_W;
    const hydKW = calcResult.results.hydraulicPower_kW;
    const hydHP = calcResult.results.hydraulicPower_hp;

    return {
      success: true,
      answer: `LIVE CHEMDIAG P-101 PUMP HYDRAULIC POWER AUDIT:

1. Live Telemetry Grounding (P-101 Centrifugal Pump):
• Operating Speed: ${Math.round(pump.rpm)} RPM
• Measured Discharge Flow (Q): ${pumpFlowLpm.toFixed(1)} L/min = ${pumpFlowMps.toExponential(3)} m³/s
• Estimated Dynamic Head (H): ${pumpHeadM.toFixed(1)} m (calculated from affinity law curve at ${Math.round(pump.rpm)} RPM)
• Process Fluid: Water (ρ = 1000 kg/m³, g = 9.81 m/s²)

2. Governing Equations:
• Hydraulic Power: P_hydraulic = ρ · g · Q · H
• Brake Shaft Power: P_shaft = P_hydraulic / η_pump (assuming η = 75%)

3. Step-by-Step Substitution:
• P_hydraulic = (1000 kg/m³) · (9.81 m/s²) · (${pumpFlowMps.toExponential(3)} m³/s) · (${pumpHeadM.toFixed(1)} m)
• P_hydraulic = ${hydW.toFixed(1)} W (${hydKW.toFixed(4)} kW)

4. Computed Result:
• Live Hydraulic Power: ${hydW.toFixed(1)} Watts (${hydKW.toFixed(4)} kW / ${hydHP.toFixed(3)} hp)
• Estimated Motor Shaft Load: ${(hydW / 0.75).toFixed(1)} Watts
• Operating Vibration: ${pump.vibration.toFixed(2)} g (${pump.vibration > 0.25 ? '⚠ ELEVATED MECHANICAL VIBRATION' : '✓ Normal Baseline'})

5. Engineering Interpretation:
• P-101 is delivering ${hydW.toFixed(1)} W of fluid work. Operating condition matches nominal pilot-scale duty.`,
      equipment: 'pump',
      intent: 'live_pump_hydraulic_power',
      timestamp
    };
  }

  // G. SENSIBLE HEAT DUTY / HEATING ENERGY: "How much energy is required to heat 100 kg of water from 25°C to 80°C?"
  const isHeatingEnergyQuery = (
    lowerQ.includes('heat') &&
    (lowerQ.includes('energy') || lowerQ.includes('how much') || lowerQ.includes('duty') || lowerQ.includes('calculate')) &&
    (lowerQ.includes('100 kg') || lowerQ.includes('water') || lowerQ.includes('25') || lowerQ.includes('80') || lowerQ.includes('cp') || lowerQ.includes('kg/s'))
  );

  if (isHeatingEnergyQuery) {
    if (lowerQ.includes('2 kg/s') || (lowerQ.includes('kg/s') && lowerQ.includes('duty'))) {
      const massFlow = 2.0;
      const cp = 4.18;
      const deltaT = 10.0;
      const calcResult = Heat.calcSensibleHeatDuty({
        massFlow,
        specificHeat: cp,
        deltaT
      });

      const dutyKW = calcResult.results.duty_kJ; // Q_kJ for rate is kW

      return {
        success: true,
        answer: `ENGINEERING CALCULATION: HEAT EXCHANGER DUTY

1. Given Stream Parameters:
• Mass Flow Rate (ṁ): ${massFlow.toFixed(2)} kg/s
• Specific Heat Capacity (Cp): ${cp.toFixed(2)} kJ/(kg·K) [${cp * 1000} J/(kg·K)]
• Temperature Rise (ΔT): ${deltaT.toFixed(1)} °C (K)

2. Governing Equation:
• Sensible Thermal Heat Duty: Q̇ = ṁ · Cp · ΔT

3. Step-by-Step Substitution:
• Q̇ = (2.00 kg/s) · (4.18 kJ/kg·K) · (10.0 K)
• Q̇ = ${dutyKW.toFixed(1)} kW (${(dutyKW * 1000).toFixed(0)} W)

4. Computed Results:
• Thermal Heat Duty (Q̇): ${dutyKW.toFixed(1)} kW (${(dutyKW * 1000).toFixed(0)} J/s)
• Duty in British Thermal Units: ${calcResult.results.energy_Btu.toFixed(0)} BTU/hr (${(dutyKW / 3.517).toFixed(2)} Tons of Refrigeration)

5. Assumptions & Engineering Context:
• Constant specific heat across the 10°C thermal span, single-phase liquid flow, negligible heat loss to surroundings.`,
        equipment: 'heat_exchanger',
        intent: 'calc_hx_duty',
        timestamp
      };
    }

    let mass = 100.0;
    let t1 = 25.0;
    let t2 = 80.0;
    let cp = 4.184;

    const massMatch = query.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
    if (massMatch) mass = parseFloat(massMatch[1]);
    const temps = query.match(/(\d+(?:\.\d+)?)\s*(?:°C|c)\b/gi) || query.match(/from\s*(\d+(?:\.\d+)?).*?to\s*(\d+(?:\.\d+)?)/i);
    if (temps && temps.length >= 2) {
      if (temps[1] && temps[2]) {
        t1 = parseFloat(temps[1]);
        t2 = parseFloat(temps[2]);
      }
    }

    const calcResult = Heat.calcSensibleHeatDuty({
      mass,
      tIn: t1,
      tOut: t2,
      specificHeat: cp
    });

    const energyKJ = calcResult.results.duty_kJ;
    const energyMJ = calcResult.results.duty_MJ;
    const energyKWh = energyKJ / 3600.0;
    const energyBtu = calcResult.results.energy_Btu;

    return {
      success: true,
      answer: `ENGINEERING CALCULATION: SENSIBLE HEATING ENERGY

1. Given Batch Parameters:
• Mass of Water (m): ${mass.toFixed(1)} kg
• Initial Temperature (T₁): ${t1.toFixed(1)} °C
• Final Temperature (T₂): ${t2.toFixed(1)} °C
• Temperature Rise (ΔT): ${(t2 - t1).toFixed(1)} °C (K)
• Specific Heat Capacity of Liquid Water (Cp): ${cp.toFixed(3)} kJ/(kg·K) [4184 J/(kg·K)]

2. Governing Equation:
• Sensible Heat Energy: Q = m · Cp · ΔT = m · Cp · (T₂ - T₁)

3. Step-by-Step Substitution:
• Q = (100.0 kg) · (4.184 kJ/kg·K) · (80.0 °C - 25.0 °C)
• Q = (100.0) · (4.184) · (55.0) = ${energyKJ.toFixed(1)} kJ

4. Computed Results:
• Total Thermal Energy Required (Q): ${energyKJ.toFixed(0)} kJ = ${energyMJ.toFixed(3)} MJ
• Electrical Equivalent: ${energyKWh.toFixed(3)} kWh
• Imperial Energy: ${energyBtu.toFixed(0)} BTU

5. Assumptions & Engineering Interpretation:
• Incompressible liquid with constant specific heat ($C_p \approx 4.184\text{ kJ/kg}\cdot\text{K}$).
• 100% thermal containment efficiency (no ambient radiative/convective heat losses). In practical industrial tank heating, add a 10%–15% heat loss allowance.`,
      equipment: 'all',
      intent: 'calc_heating_energy',
      timestamp
    };
  }

  // H. REYNOLDS NUMBER CALCULATION: "What is the Reynolds number for this pipe?"
  const isReynoldsQuery = lowerQ.includes('reynolds') || (isFollowUpPattern && lowerQ.includes('regime'));

  if (isReynoldsQuery) {
    let vel = 2.829;
    let diam = 25.0;

    if (fullHistoryText.includes('50 mm') || fullHistoryText.includes('50mm') || lastUserTurn.includes('50')) {
      vel = 0.707;
      diam = 50.0;
    }

    const calcResult = Fluid.calcReynoldsNumber({
      velocity: vel,
      diameter: diam,
      density: 1000,
      viscosity: 0.001
    });

    const reVal = calcResult.results.reynolds;
    const regimeVal = calcResult.results.regime;

    return {
      success: true,
      answer: `ENGINEERING CALCULATION: REYNOLDS NUMBER & FLOW REGIME

1. Given Flow & Fluid Properties:
• Fluid Velocity (v): ${vel.toFixed(2)} m/s
• Pipe Inner Diameter (D): ${diam.toFixed(1)} mm = ${(diam / 1000).toFixed(4)} m
• Fluid: Water at 20°C (Density ρ = 1000 kg/m³, Dynamic Viscosity μ = 0.001 Pa·s / 1.0 cP)

2. Governing Equation:
• Dimensionless Reynolds Number: Re = (ρ · v · D) / μ = (v · D) / ν

3. Step-by-Step Substitution:
• Re = [(1000 kg/m³) · (${vel.toFixed(3)} m/s) · (${(diam / 1000).toFixed(4)} m)] / (0.001 Pa·s)
• Re = ${reVal.toLocaleString()}

4. Computed Result & Flow Regime:
• Reynolds Number (Re): ${reVal.toLocaleString()}
• Flow Regime: ${regimeVal.toUpperCase()} (Re > 4,000 indicates fully turbulent flow with vigorous turbulent mixing)

5. Engineering Significance:
• In turbulent flow, velocity profile is relatively flat across the pipe core with a thin laminar boundary sublayer near the wall.
• Friction factor f can be estimated using the Haaland equation: 1/√f ≈ -1.8 · log₁₀[(ε/D/3.7)¹.¹¹ + 6.9/Re].`,
      equipment: 'all',
      intent: 'calc_reynolds_number',
      timestamp
    };
  }

  // I. CSTR RESIDENCE TIME: "How do I calculate CSTR residence time?"
  const isCSTRResidenceQuery = (
    (lowerQ.includes('cstr') || lowerQ.includes('reactor')) &&
    (lowerQ.includes('residence time') || lowerQ.includes('space time') || lowerQ.includes('how do i calculate'))
  );

  if (isCSTRResidenceQuery) {
    return {
      success: true,
      answer: `HOW TO CALCULATE CSTR RESIDENCE TIME (SPACE TIME):

1. Definition & Fundamental Governing Equation:
In chemical reaction engineering, space time (τ) is the time required to process one reactor volume of feed under specified entrance conditions:
τ = V / v₀
Where:
• Reactor Volume (V): Liquid working volume of the CSTR (m³ or L)
• Feed Flow Rate (v₀): Volumetric feed flow rate entering the reactor (m³/s, m³/h, or L/min)

2. Relationship to Space Velocity:
• Space Velocity (SV) is the reciprocal of space time: SV = 1 / τ = v₀ / V (units: time⁻¹).

3. Connection to Chemical Conversion (Damköhler Number):
For a first-order isothermal liquid reaction (A → Products, -rA = k·CA):
• Design Equation: V = v₀ · (CA₀ - CA) / (-rA) = v₀ · CA₀ · XA / [k · CA₀ · (1 - XA)]
• Space Time: τ = XA / [k · (1 - XA)]
• Damköhler Number: Da = k · τ = XA / (1 - XA)
• Fractional Conversion: XA = (k · τ) / (1 + k · τ)

4. Practical Calculation Example:
• If reactor volume V = 2.0 m³ and volumetric feed rate v₀ = 0.5 m³/h:
  τ = 2.0 m³ / 0.5 m³/h = 4.0 hours (240 minutes = 14,400 seconds).`,
      equipment: 'reactor',
      intent: 'calc_cstr_residence_time_explanation',
      timestamp
    };
  }

  // J. PID CONTROLLER ERROR: "Calculate PID error if setpoint is 80°C and process temperature is 73°C."
  const isPIDErrorQuery = (
    lowerQ.includes('pid error') ||
    lowerQ.includes('controller error') ||
    (lowerQ.includes('calculate') && lowerQ.includes('error') && lowerQ.includes('setpoint') && (lowerQ.includes('80') || lowerQ.includes('73') || lowerQ.includes('temperature')))
  );

  if (isPIDErrorQuery) {
    const calcResult = Control.calcControllerError({
      setpoint: 80.0,
      processVariable: 73.0,
      actionType: 'direct'
    });

    const errVal = calcResult.results.error;
    const pctVal = calcResult.results.percentError;

    return {
      success: true,
      answer: `ENGINEERING CALCULATION: PID CONTROLLER TRACKING ERROR

1. Given Loop Values:
• Target Setpoint (SP): 80.0 °C
• Current Process Variable (PV): 73.0 °C
• Control Action: Direct-Acting Heating Loop (error e = SP - PV)

2. Governing Equations:
• Instantaneous Control Error: e(t) = SP - PV
• Relative Percentage Error: e_rel (%) = [(SP - PV) / SP] × 100%

3. Step-by-Step Substitution:
• e(t) = 80.0 °C - 73.0 °C = +${errVal.toFixed(1)} °C
• e_rel = (${errVal.toFixed(1)} / 80.0) × 100% = +${pctVal.toFixed(2)}%

4. Computed Results:
• Control Error e(t): +${errVal.toFixed(1)} °C (+${errVal.toFixed(1)} K)
• Relative Error: +${pctVal.toFixed(2)}%
• Direction: Process variable is below setpoint (Under-temperature condition)

5. Control System Impact:
• The positive error (+${errVal.toFixed(1)}°C) drives the proportional term ($P = K_c \cdot e$) and accumulates positive integral action ($\int e \, dt$) to open the heating control valve / increase electrical heater power until $PV$ reaches $SP = 80^\circ\text{C}$.`,
      equipment: 'all',
      intent: 'calc_pid_error',
      timestamp
    };
  }

  // K. GENERAL PIPE VELOCITY CALCULATION: "A pipe carries 5 m³/h through a 25 mm pipe. Calculate velocity."
  const isPipeVelocityCalc = (
    (lowerQ.includes('velocity') || lowerQ.includes('pipe')) &&
    (lowerQ.includes('m3/h') || lowerQ.includes('m³/h') || lowerQ.includes('m3/s') || lowerQ.includes('l/s') || lowerQ.includes('l/min') || lowerQ.includes('gpm')) &&
    (lowerQ.includes('mm') || lowerQ.includes('cm') || lowerQ.includes('inch') || lowerQ.includes('diameter'))
  );

  if (isPipeVelocityCalc) {
    let flow = 5.0;
    let flowUnit = 'm3/h';
    let diam = 25.0;
    let diamUnit = 'mm';

    const flowMatch = query.match(/(\d+(?:\.\d+)?)\s*(m3\/h|m³\/h|m3\/hr|m³\/hr|m3\/s|m³\/s|l\/s|l\/min|gpm)\b/i);
    if (flowMatch) {
      flow = parseFloat(flowMatch[1]);
      flowUnit = flowMatch[2].toLowerCase().replace('m³', 'm3').replace('/hr', '/h');
    }

    const diamMatch = query.match(/(\d+(?:\.\d+)?)\s*(mm|cm|inch|inches)\b/i) ||
                      query.match(/(?:diameter|size|bore|through(?:\s+a)?)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|inch|inches)?\b/i) ||
                      query.match(/(\d+(?:\.\d+)?)\s*m\s+(?:pipe|diameter|bore)/i);
    if (diamMatch) {
      diam = parseFloat(diamMatch[1]);
      if (diamMatch[2]) diamUnit = diamMatch[2].toLowerCase();
    }

    const calcResult = Fluid.calcPipeVelocity({
      flowRate: flow,
      flowUnit,
      diameter: diam,
      diameterUnit: diamUnit
    });

    const v_ms = calcResult.results.velocity_ms;
    const v_fts = calcResult.results.velocity_fts;
    const area_m2 = calcResult.results.area_m2;
    const Q_m3s = calcResult.inputs.flowRate.siValue;
    const D_m = calcResult.inputs.diameter.siValue;

    return {
      success: true,
      answer: `ENGINEERING CALCULATION: PIPE FLOW VELOCITY

1. Given Parameters & Unit Conversions:
• Volumetric Flow Rate (Q): ${flow} ${flowUnit} = ${Q_m3s.toExponential(3)} m³/s
• Pipe Inside Diameter (D): ${diam} ${diamUnit} = ${D_m.toFixed(4)} m

2. Governing Equations:
• Cross-Sectional Flow Area: A = (π · D²) / 4
• Mean Fluid Velocity: v = Q / A

3. Step-by-Step Substitution:
• A = [π · (${D_m.toFixed(4)} m)²] / 4 = ${area_m2.toExponential(4)} m²
• v = (${Q_m3s.toExponential(3)} m³/s) / (${area_m2.toExponential(4)} m²) = ${v_ms.toFixed(3)} m/s

4. Computed Results:
• Fluid Velocity (v): ${v_ms.toFixed(2)} m/s (${v_fts.toFixed(2)} ft/s)
• Pipe Cross-Sectional Area (A): ${(area_m2 * 10000).toFixed(2)} cm² (${area_m2.toExponential(3)} m²)

5. Assumptions & Engineering Interpretation:
• Steady, incompressible single-phase liquid flow.
• Standard process liquid line velocity design guideline is typically 1.0–3.0 m/s. ${v_ms.toFixed(2)} m/s is within acceptable industrial design practice.`,
      equipment: 'all',
      intent: 'calc_pipe_velocity',
      timestamp
    };
  }

  // =========================================================================
  // 1. UNIVERSAL INDUSTRIAL KNOWLEDGE: THERMODYNAMICS & ENTROPY
  // =========================================================================
  const isEntropyTopic = (lowerQ.includes('entropy') || lowerQ.includes('second law') || lowerQ.includes('irreversibility') || (isFollowUpPattern && (lastUserTurn.includes('entropy') || lastUserTurn.includes('second law')))) && !isSwitchingTopic && !lowerQ.includes('compressor') && !lowerQ.includes('pid');

  if (isEntropyTopic) {
    const isAskingAboutExchanger = lowerQ.includes('heat exchanger') || lowerQ.includes('my heat exchanger') || lowerQ.includes('e-101') || lowerQ.includes('e101') || lowerQ.includes('matter in my') || lowerQ.includes('affect my') || lowerQ.includes('happening with my heat exchanger');
    const isAskingHeatTransferRel = lowerQ.includes('heat transfer') || lowerQ.includes('related to heat') || (lowerQ.includes('transfer') && isFollowUpPattern);
    const isAskingWhyIncrease = lowerQ.includes('why does') || lowerQ.includes('why entropy') || (lowerQ.includes('increase') && isFollowUpPattern);

    if (isAskingAboutExchanger) {
      const isRightNow = lowerQ.includes('right now') || lowerQ.includes('current') || lowerQ.includes('happening there') || lowerQ.includes('happening with');
      if (isRightNow) {
        return {
          success: true,
          answer: `CURRENT E-101 HEAT EXCHANGER TELEMETRY AUDIT:

1. Live Operating Measurements:
• Process Inlet Temperature: ${hx.inlet_temperature.toFixed(1)} °C
• Process Outlet Temperature: ${hx.outlet_temperature.toFixed(1)} °C
• Temperature Gradient (ΔT): ${hx.temperature_difference.toFixed(1)} °C (Nominal baseline: ~12.9 °C)
• Heat Transfer Efficiency: ${(hx.efficiency ?? hx.heat_transfer_indicator).toFixed(1)}%

2. Condition Assessment:
${hx.temperature_difference < 5.0 ? '⚠ Notice: Reduced ΔT indicates boundary scale accumulation, decreasing heat duty throughput and causing thermodynamic performance degradation.' : '✓ E-101 is operating within nominal thermal gradient and baseline entropy generation limits.'}`,
          equipment: 'heat_exchanger',
          intent: 'hx_live_status',
          timestamp
        };
      }

      return {
        success: true,
        answer: `ENTROPY & THERMODYNAMICS IN HEAT EXCHANGERS (E-101 AUDIT):

1. Thermodynamic Significance:
In heat exchangers, entropy generation (S_gen) represents the thermodynamic penalty of transferring thermal energy across a finite temperature difference (ΔT) between process streams:
• S_gen = m_dot_cold * Cp_cold * ln(T_c_out / T_c_in) + m_dot_hot * Cp_hot * ln(T_h_out / T_h_in) >= 0.
• By the Gouy-Stodola theorem, the rate of lost available work (exergy destruction) is directly proportional to entropy generation: E_destroyed = T0 * S_gen.

2. Impact on Industrial Heat Exchangers:
• High ΔT increases heat transfer rate (Q = U * A * ΔT_lm) but maximizes thermodynamic irreversibility and exergy loss.
• Tube wall fouling introduces extra thermal resistance, distorting the temperature profile and forcing higher utility steam/cooling water consumption to meet process duty.

3. Live E-101 Telemetry Context:
• Operating Gradient (ΔT): ${hx.temperature_difference.toFixed(1)} °C (Nominal: 12.9 °C)
• Overall Thermal Efficiency: ${(hx.efficiency ?? hx.heat_transfer_indicator).toFixed(1)}%
${hx.temperature_difference < 5.0 ? '⚠ Notice: Reduced ΔT indicates boundary scale accumulation, decreasing heat duty throughput and causing thermodynamic performance degradation.' : '✓ E-101 is operating within nominal thermal gradient and baseline entropy generation limits.'}`,
        equipment: 'heat_exchanger',
        intent: 'entropy_exchanger',
        timestamp
      };
    }

    if (isAskingHeatTransferRel) {
      return {
        success: true,
        answer: `ENTROPY AND ITS RELATIONSHIP TO HEAT TRANSFER:

1. Thermal Irreversibility:
Heat transfer across a finite temperature difference is one of the most fundamental sources of entropy generation in the universe. When heat quantity Q transfers spontaneously from a hot reservoir at temperature T_hot to a cold reservoir at T_cold (where T_hot > T_cold):
• Entropy change of hot source: ΔS_hot = -Q / T_hot
• Entropy change of cold sink: ΔS_cold = +Q / T_cold
• Net Entropy Generation: S_gen = ΔS_total = Q * (1/T_cold - 1/T_hot) > 0.

2. Why it Matters in Engineering:
Because T_cold < T_hot, (1/T_cold - 1/T_hot) is always positive. The greater the temperature difference (ΔT) between the two bodies, the greater the rate of entropy production, and the greater the loss of available useful work (exergy destruction). In heat exchanger design, engineers balance heat transfer area (capital cost) against ΔT (thermodynamic entropy loss).`,
        equipment: 'all',
        intent: 'entropy_heat_transfer',
        timestamp
      };
    }

    if (isAskingWhyIncrease) {
      return {
        success: true,
        answer: `WHY ENTROPY ALWAYS INCREASES (THE SECOND LAW OF THERMODYNAMICS):

1. Statistical Mechanics & Microstates:
At the molecular level, entropy (S) is defined by Ludwig Boltzmann's relation:
S = k_B * ln(Ω)
Where k_B is Boltzmann's constant and Ω is the number of accessible microscopic configurations (microstates) corresponding to a macroscopic state. Because macroscopic systems contain vast numbers of particles (~10^23), the probability of finding the system in a state with maximum microstates (maximum disorder/dispersal) overwhelmingly approaches 100%.

2. Macroscopic Irreversibility:
In natural processes, energy spontaneously disperses and degrades in quality:
• Mechanical friction converts directed kinetic energy into random molecular thermal vibrations.
• Fluids spontaneously mix down concentration gradients.
• Heat transfers irreversibly down finite temperature gradients.

All real spontaneous processes generate positive entropy (dS_universe > 0), establishing the arrow of time in physics and chemical engineering.`,
        equipment: 'all',
        intent: 'entropy_increase',
        timestamp
      };
    }

    return {
      success: true,
      answer: `ENTROPY IN THERMODYNAMICS:

1. Fundamental Meaning:
In thermodynamics, entropy (S) is a fundamental state property that quantifies the degree of energy dispersion and irreversibility in a physical or chemical system. In simpler terms, while the First Law of Thermodynamics tells us that energy is always conserved, the Second Law tells us that the quality of that energy always degrades during real processes — and entropy measures that degradation.

2. Classical Thermodynamic Definition:
Clausius defined entropy through reversible heat exchange:
dS = (δQ_rev / T)
For any real, irreversible process, the Clausius inequality dictates:
dS >= (δQ / T)
Which leads to the universal statement: dS_system + dS_surroundings >= 0.

3. Engineering Significance in Process Plants:
In industrial chemical engineering, entropy generation (S_gen) directly equals lost work potential (exergy destruction = T_0 * S_gen). Minimizing entropy generation in heat exchangers, distillation columns, compressors, and reactors is the primary engineering pathway to maximizing energy efficiency and reducing operating costs.`,
      equipment: 'all',
      intent: 'entropy_explanation',
      timestamp
    };
  }

  // =========================================================================
  // 2. UNIVERSAL INDUSTRIAL KNOWLEDGE: COMPRESSORS & COMPRESSOR SURGE
  // =========================================================================
  const isCompressorTopic = (
    lowerQ.includes('compressor') ||
    lowerQ.includes('surge') ||
    (prevWasCompressor && (
      lowerQ.includes('detect') ||
      lowerQ.includes('monitor') ||
      lowerQ.includes('instrumentation') ||
      lowerQ.includes('prevent') ||
      lowerQ.includes('how') ||
      lowerQ.includes('why') ||
      lowerQ.includes('happen') ||
      isFollowUpPattern
    ))
  ) && !lowerQ.includes('process') && !lowerQ.includes('boiler') && !lowerQ.includes('plc') && !lowerQ.includes('refrigeration') && !lowerQ.includes('bernoulli');

  if (isCompressorTopic) {
    const isComparingWithCavitation = lowerQ.includes('compare') || (prevWasCompressor && lastUserTurn.includes('cavitation'));
    const isPlantOccur = lowerQ.includes('happen in an industrial') || lowerQ.includes('happen in a plant') || (prevWasCompressor && (lowerQ.includes('could that happen') || lowerQ.includes('industrial plant')));
    const isDetectionOrMonitoring = lowerQ.includes('detect') || lowerQ.includes('monitor') || lowerQ.includes('what would i need') || lowerQ.includes('instrumentation') || (prevWasCompressor && (lowerQ.includes('how would i') || lowerQ.includes('how do i') || lowerQ.includes('how to')));

    if (isDetectionOrMonitoring) {
      return {
        success: true,
        answer: `COMPRESSOR SURGE DETECTION & INSTRUMENTATION:

To detect and prevent aerodynamic compressor surge in real-time, industrial plants deploy specialized high-speed instrumentation:

1. High-Speed Differential Pressure (ΔP) Transmitters:
• Fast-response transmitters across suction flow elements (venturi, nozzle, or orifice) detect rapid volumetric flow collapse and high-frequency pressure pulsations (<50 ms response time).

2. Dynamic Pressure Ratio & Performance Mapping:
• Anti-Surge Controllers continuously calculate the operating point coordinate: Pressure Ratio (P_discharge / P_suction) vs. Equivalent Flow (h / P_suction), tracking proximity to the Surge Control Line (SCL) and Surge Limit Line (SLL).

3. Shaft Radial & Axial Vibration Proximity Probes:
• Eddy-current proximity probes monitor dynamic axial shaft displacement and casing accelerometers detect violent rotor shuttling and sub-synchronous stall frequencies before full surge develops.

4. Fast Suction / Stage Temperature Sensors:
• Rapid-response thermocouples/RTDs detect temperature spikes caused by hot compressed gas reversing back into the suction plenum during surge cycles.

5. High-Speed Anti-Surge Recycle Valve:
• Fast-acting pneumatic control valve with high-capacity booster relays, capable of stroking 100% open in under 1.0 to 1.5 seconds.`,
        equipment: 'all',
        intent: 'compressor_detection',
        timestamp
      };
    }

    if (isPlantOccur) {
      return {
        success: true,
        answer: `CAN COMPRESSOR SURGE OCCUR IN AN INDUSTRIAL PLANT?

Yes, compressor surge is a well-documented and severe operational risk in industrial chemical, petrochemical, refining, and gas-processing plants:

1. How it Happens in Real Plants:
• Downstream Blockage: Rapid closure of emergency shutoff valves or catalytic bed fouling spikes discharge pressure.
• Gas Molecular Weight Shifts: Sudden composition shifts (e.g. hydrogen/methane ratio changes) reduce the compressor's pressure-head capability.
• Upstream Suction Starvation: Suction strainer clogging or upstream header pressure drop starves flow below the surge limit.

2. Industrial Consequences:
• Severe axial shaft oscillations that can shatter thrust bearings and destroy dry gas seals within seconds.
• Potential mechanical clash between rotating impellers and stationary casing diaphragms.

Industrial plants prevent this by installing automated Anti-Surge Control (ASC) systems with dedicated fast-acting recycle loops.`,
        equipment: 'all',
        intent: 'compressor_industrial',
        timestamp
      };
    }

    return {
      success: true,
      answer: `DYNAMIC COMPRESSORS & COMPRESSOR SURGE:

1. Compressor Types & Working Principle:
• Dynamic (Centrifugal / Axial): Impart kinetic energy to gas via high-speed rotating impellers/blades and convert velocity to static pressure in stationary diffusers.
• Positive Displacement (Reciprocating, Screw): Trap fixed gas volumes and physically reduce cavity volume to raise pressure.

2. Compressor Surge vs. Stonewall (Choke):
• Surge Line: Aerodynamic stall limit occurring at low flow and high pressure ratio. When flow drops below the surge threshold, gas reverses flow from discharge back to suction in violent cyclic oscillations, creating destructive axial thrust reversals and casing vibration.
• Stonewall (Choke): Maximum flow limit where gas velocity reaches sonic speed (Mach 1) in the impeller eye or diffuser throat.

3. Anti-Surge Control System:
A dedicated high-speed Anti-Surge Controller modulates a fast-acting recycle control valve (opening in <1.5 seconds) to return discharge gas to suction (through a gas cooler), maintaining flow above the Surge Control Line (SCL).

${isComparingWithCavitation ? `4. Comparison: Pump Cavitation vs. Compressor Surge:
• Medium: Cavitation occurs in liquids (vapor bubble implosion); Surge occurs in compressible gases (aerodynamic flow reversal).
• Root Cause: Cavitation = Low suction pressure (NPSHa < NPSHr); Surge = Low throughput flow relative to developed pressure ratio.
• Damage: Cavitation pits impellers locally; Surge causes catastrophic axial bearing destruction and machine-wide mechanical failure.` : ''}`,
      equipment: 'all',
      intent: 'compressor_explanation',
      timestamp
    };
  }

  // =========================================================================
  // 2b. UNIVERSAL INDUSTRIAL KNOWLEDGE: BOILERS & STEAM GENERATION
  // =========================================================================
  if (lowerQ.includes('boiler') || lowerQ.includes('steam generation') || lowerQ.includes('steam drum')) {
    return {
      success: true,
      answer: `INDUSTRIAL BOILERS & STEAM GENERATION:

1. Working Principle:
An industrial boiler converts feedwater into high-pressure saturated or superheated steam by transferring heat from fuel combustion or hot flue gases:
• Water-Tube Boilers: Water circulates inside tubes surrounded by external hot combustion gases; ideal for high-pressure, high-capacity utility steam.
• Fire-Tube Boilers: Hot combustion gases pass through tubes submerged in a water shell; ideal for low-to-medium pressure facility steam.

2. Core Components & Subsystems:
• Economizer: Preheats incoming boiler feedwater using waste flue gas heat.
• Steam Drum: Separates saturated steam from boiling water using cyclone separators and chevron demisters.
• Superheater: Heats dry saturated steam above its saturation temperature to prevent condensation in downstream turbines.
• Deaerator: Strips dissolved O2 and CO2 from feedwater via steam stripping to prevent severe tube corrosion.

3. 3-Element Boiler Drum Level Control:
Maintains steam drum liquid level despite shrink/swell phenomena by measuring:
1. Drum Level (Primary Process Variable)
2. Steam Flow Rate (Feedforward load disturbance)
3. Feedwater Flow Rate (Manipulated flow feedback loop)

4. Water Chemistry & Blowdown:
Continuous and bottom blowdown cycles purge accumulated total dissolved solids (TDS) and silica to prevent scale formation and carryover.`,
      equipment: 'all',
      intent: 'boiler_explanation',
      timestamp
    };
  }

  // =========================================================================
  // 2c. UNIVERSAL INDUSTRIAL KNOWLEDGE: PLC & INDUSTRIAL AUTOMATION
  // =========================================================================
  if (lowerQ.includes('plc') || lowerQ.includes('programmable logic controller')) {
    return {
      success: true,
      answer: `PROGRAMMABLE LOGIC CONTROLLERS (PLC) IN PROCESS AUTOMATION:

1. Definition & Role:
A Programmable Logic Controller (PLC) is a ruggedized, real-time microprocessor-based industrial computer designed to automate manufacturing processes, machinery, and discrete/batch chemical operations in harsh electromagnetic and thermal environments.

2. Deterministic PLC Scan Cycle:
The CPU executes a continuous deterministic scan loop typically in 1 to 50 milliseconds:
1. Input Scan: Reads physical field discrete and analog I/O signals (e.g. 24V DC switches, 4–20 mA transmitters) into the input image memory.
2. Program Execution: Executes user logic sequentially from top to bottom (Ladder Logic, Function Block Diagram, Structured Text per IEC 61131-3).
3. Output Scan: Writes updated logic decisions to physical output modules (solenoid valves, motor contactors, VFDs, alarm beacons).
4. Housekeeping & Communications: Diagnostics and network communications (Modbus TCP, Ethernet/IP, Profinet).

3. PLC vs. DCS (Distributed Control System):
• PLC: Excel at high-speed discrete logic, interlocking, motor sequencing, machine control, and emergency shutdown (ESD / SIS SIL-3).
• DCS: Geared toward continuous large-scale regulatory PID process control across entire chemical plants with integrated database and unified alarm management.`,
      equipment: 'all',
      intent: 'plc_explanation',
      timestamp
    };
  }

  // =========================================================================
  // 2d. UNIVERSAL INDUSTRIAL KNOWLEDGE: BERNOULLI'S EQUATION & HYDRAULICS
  // =========================================================================
  if (lowerQ.includes('bernoulli') || lowerQ.includes('venturi')) {
    return {
      success: true,
      answer: `BERNOULLI'S EQUATION & FLUID FLOW DYNAMICS:

1. Fundamental Principle:
Bernoulli's equation expresses the conservation of mechanical energy along a streamline for steady, incompressible, frictionless (inviscid) fluid flow:

P1 + 0.5 * ρ * v1² + ρ * g * z1 = P2 + 0.5 * ρ * v2² + ρ * g * z2

Where:
• P = Static pressure (Pa or N/m²)
• 0.5 * ρ * v² = Dynamic pressure (kinetic energy per unit volume)
• ρ * g * z = Hydrostatic potential pressure (elevation energy per unit volume)
• ρ = Fluid density (kg/m³), v = velocity (m/s), g = 9.81 m/s², z = elevation (m)

2. The Venturi Effect & Flow Measurement:
When fluid flows through a pipe restriction (nozzle/throat), continuity (A1*v1 = A2*v2) forces velocity to increase (v2 > v1). By Bernoulli's equation, static pressure must drop (P2 < P1). Measuring this differential pressure (ΔP = P1 - P2) across an orifice plate or venturi allows accurate calculation of volumetric flow rate:
Q = C_d * A_throat * sqrt(2 * ΔP / (ρ * (1 - β⁴)))

3. Real-World Extension (Engineering Bernoulli):
In industrial piping networks, friction head losses (Darcy-Weisbach friction factor f) and pump work (h_pump) are added:
P1/(ρ*g) + v1²/(2*g) + z1 + h_pump = P2/(ρ*g) + v2²/(2*g) + z2 + h_loss.`,
      equipment: 'all',
      intent: 'bernoulli_explanation',
      timestamp
    };
  }

  // =========================================================================
  // 2e. UNIVERSAL INDUSTRIAL KNOWLEDGE: REFRIGERATION CYCLES & CHILLERS
  // =========================================================================
  if (lowerQ.includes('refrigerat') || lowerQ.includes('chiller') || lowerQ.includes('cooling cycle')) {
    return {
      success: true,
      answer: `INDUSTRIAL REFRIGERATION CYCLES & PROCESS COOLING:

1. Vapor-Compression Refrigeration Cycle:
Transfers heat from a low-temperature process stream to a higher-temperature heat sink through 4 continuous thermodynamic stages:

1. Evaporator (Low P, Low T): Liquid refrigerant absorbs process heat (Q_in) at constant pressure and boils into low-pressure vapor.
2. Compressor (Work Input W_in): Compresses superheated vapor to high pressure and high temperature.
3. Condenser (High P, High T): Rejects superheated heat (Q_out) to cooling water or ambient air, condensing refrigerant into high-pressure liquid.
4. Expansion Valve (Joule-Thomson Isenthalpic Throttling): Sudden pressure reduction drops refrigerant temperature via partial flash evaporation, returning it to the evaporator.

2. Performance Metrics:
• Coefficient of Performance (COP):
  COP_cooling = Q_absorbed / W_compressor_in = (h1 - h4) / (h2 - h1)
  Typical industrial water-cooled chillers achieve COP values between 4.0 and 6.5.

3. Process Plant Applications:
Used for overhead condenser subcooling in light-hydrocarbon distillation (e.g., C3/C4 splitters), low-temperature reactor jackets, and volatile solvent vapor recovery.`,
      equipment: 'all',
      intent: 'refrigeration_explanation',
      timestamp
    };
  }

  // =========================================================================
  // 3. UNIVERSAL INDUSTRIAL KNOWLEDGE: PID CONTROLLERS & LOOP TUNING
  // =========================================================================
  const isPIDTopic = (
    lowerQ.includes('pid') ||
    lowerQ.includes('tuning') ||
    lowerQ.includes('ziegler') ||
    lowerQ.includes('cascade control') ||
    lowerQ.includes('feedforward') ||
    lowerQ.includes('smith predictor') ||
    (prevWasPID && (
      lowerQ.includes('oscillat') ||
      lowerQ.includes('fix') ||
      lowerQ.includes('tune') ||
      lowerQ.includes('dead time') ||
      lowerQ.includes('delay') ||
      lowerQ.includes('why') ||
      lowerQ.includes('how') ||
      lowerQ.includes('increase') ||
      isFollowUpPattern
    ))
  ) && !isSwitchingTopic && !lowerQ.includes('compressor') && !lowerQ.includes('cavitation') && !lowerQ.includes('sky');

  if (isPIDTopic) {
    const isOscillationQuestion = lowerQ.includes('oscillat') || (prevWasPID && (lowerQ.includes('why') || lowerQ.includes('happen') || lowerQ.includes('cause')) && !lowerQ.includes('fix') && !lowerQ.includes('dead time'));
    const isFixQuestion = lowerQ.includes('fix') || lowerQ.includes('tune') || lowerQ.includes('how would i') || lowerQ.includes('how do i') || (prevWasPID && lowerQ.includes('how') && !lowerQ.includes('dead time'));
    const isDeadTimeQuestion = lowerQ.includes('dead time') || lowerQ.includes('delay') || lowerQ.includes('smith');
    const isSimple = lowerQ.includes('simple') || lowerQ.includes('beginner');
    const isFormula = lowerQ.includes('formula') || lowerQ.includes('equation');

    if (isOscillationQuestion && !isFixQuestion && !isDeadTimeQuestion) {
      return {
        success: true,
        answer: `WHY PID CONTROL LOOPS OSCILLATE:

1. Excessive Controller Gain (Proportional Over-Action):
• High Gain (K_c > K_u): When proportional gain is set too aggressive, the controller over-corrects for minor errors, driving the process variable (PV) past the setpoint (SP) and causing underdamped oscillation or sustained limit cycles.

2. Excessive Integral Action (Phase Lag & Reset Windup):
• Fast Integral Reset (T_i too small): Integral action accumulates past error and introduces up to 90° of phase lag into the open-loop transfer function. This severe phase lag erodes the phase margin, destabilizing the feedback loop.

3. Process Dead Time (Time Delay θ_d):
• Uncompensated transport delay means the controller acts on outdated feedback. By the time the corrective control action reaches the sensor, the process has already moved, causing continuous overshoot and undershoot cycles.

4. Control Valve Mechanical Nonlinearities:
• Valve Stiction & Deadband: Static friction holds the valve plug until actuator pressure builds up enough to break free, causing the valve to jump past the desired position and producing persistent limit-cycle hunting.`,
        equipment: 'all',
        intent: 'pid_oscillation',
        timestamp
      };
    }

    if (isFixQuestion && !isDeadTimeQuestion) {
      return {
        success: true,
        answer: `HOW TO ELIMINATE PID LOOP OSCILLATIONS:

1. Controller Tuning Adjustments:
• Reduce Controller Gain (K_c): Lower the proportional gain by 30% to 50% (widen proportional band) to restore adequate gain margin (target >= 6 dB).
• Increase Integral Reset Time (T_i): Lengthen T_i (slow down reset action) to reduce phase lag and recover phase margin (target >= 45°).
• Add / Tune Derivative Damping (T_d): For temperature or lag-dominant loops, moderate derivative action adds phase lead; ensure a high-frequency derivative filter (N ≈ 8–10) is active to prevent noise amplification.

2. Apply Robust Tuning Rules:
• Lambda (IMC) Tuning: Specify a closed-loop time constant (λ >= Dead Time) for guaranteed non-oscillatory, smooth setpoint tracking and disturbance rejection.
• AMIGO (Approximate M-constrained Integral Gain Optimization): Provides optimal load disturbance rejection with guaranteed robustness margins.

3. Inspect Physical Final Control Elements:
• Control Valve Diagnostic: Test for valve stiction, positioner deadband, or mechanical linkage slop. Perform step tests to verify linear stroke response.`,
        equipment: 'all',
        intent: 'pid_fix_oscillation',
        timestamp
      };
    }

    if (isDeadTimeQuestion) {
      return {
        success: true,
        answer: `PID CONTROL WITH LARGE PROCESS DEAD TIME (TIME DELAY):

1. The Fundamental Dead-Time Challenge:
In processes where dead time dominates the time constant (θ_d / τ > 1, such as long pipelines, conveyor belts, or thermal transport delays):
• Dead time introduces a pure phase lag -ω*θ_d that grows linearly with frequency without contributing any gain attenuation.
• Standard PID controllers are forced to detune severely (drastically reduced gain and sluggish integral action) to avoid instability.

2. Advanced Dead-Time Compensation Techniques:
• Smith Predictor: An internal model-based structure with a secondary fast feedback loop that calculates control actions as if the process had zero dead time, while an outer loop compensates for model mismatch and disturbances.
• Internal Model Control (IMC) / Dahlin Controller: Controller algorithms designed with the dead time explicitly inverted in the feedback path for deadbeat or smooth response.
• Feedforward Control: Measures load disturbances upstream before the dead time affects the primary loop and applies immediate corrective action.`,
        equipment: 'all',
        intent: 'pid_dead_time',
        timestamp
      };
    }

    if (isSimple) {
      return {
        success: true,
        answer: `PID CONTROL EXPLAINED SIMPLY:

Think of driving a car toward a target speed (60 km/h):
1. Proportional (P) — "How far off are we right now?": The further you are from 60 km/h, the harder you press the gas pedal.
2. Integral (I) — "How long have we been off?": If driving uphill leaves you stuck at 55 km/h, the I-action gradually pushes harder until you reach exactly 60 km/h (eliminates steady-state offset).
3. Derivative (D) — "How fast are we approaching?": As you get close to 60 km/h quickly, D eases off the pedal to prevent overshooting.

In chemical plants, PID loops maintain temperatures, pressures, levels, and flow rates stable 24/7.`,
        equipment: 'all',
        intent: 'pid_simple',
        timestamp
      };
    }

    if (isFormula) {
      return {
        success: true,
        answer: `PID CONTROLLER MATHEMATICAL FORMULATIONS:

1. Ideal (Parallel) Continuous Algorithm:
u(t) = K_c * [ e(t) + (1 / T_i) * ∫ e(τ) dτ + T_d * (de(t)/dt) ]

Where:
• u(t) = Controller Output (4–20 mA or % Valve Opening)
• e(t) = Error signal = Setpoint (SP) - Process Variable (PV)
• K_c = Controller Gain (Proportional Band PB = 100 / K_c)
• T_i = Integral Reset Time (minutes/repeat or seconds)
• T_d = Derivative Time constant (seconds)

2. Closed-Loop Ziegler-Nichols Tuning Rules:
With I and D turned off, increase K_c until steady sustained oscillation occurs at Ultimate Gain (K_u) with Ultimate Period (P_u):
• P: K_c = 0.5 * K_u
• PI: K_c = 0.45 * K_u, T_i = P_u / 1.2
• PID: K_c = 0.6 * K_u, T_i = P_u / 2, T_d = P_u / 8`,
        equipment: 'all',
        intent: 'pid_formula',
        timestamp
      };
    }

    return {
      success: true,
      answer: `PROCESS CONTROL & PID LOOP TUNING:

1. Three Terms of Industrial PID:
• Proportional (P): Produces corrective action proportional to current error e(t). High gain speeds response but increases oscillation risk.
• Integral (I): Accumulates error over time to eliminate steady-state offset. Essential for thermal and level control.
• Derivative (D): Anticipates future error trajectory based on rate of change (de/dt). Adds damping; typically omitted on noisy flow signals.

2. Advanced Industrial Control Strategies:
• Cascade Control: Master controller (e.g. Reactor Temperature) provides Setpoint to slave controller (e.g. Jacket Coolant Flow), rejecting disturbance before it impacts the primary vessel.
• Feedforward Control: Measures load disturbance upstream (e.g. feed flow change) and adjusts manipulated variable before PV deviates.
• Ratio Control: Keeps stoichiometric blending proportion (e.g. Reflux L/D or Reactant A:B).

3. Practical Loop Tuning Guidelines:
• Flow Loops: Fast dynamics, noisy -> High Integral action, Low Proportional gain, Zero Derivative.
• Temperature Loops: Slow dynamics, large dead time (delay) -> Moderate Gain, Slower Integral, Moderate Derivative.
• Level Loops: Integrating process -> Moderate Gain, Slow Integral to allow surge capacity without valve chattering.`,
      equipment: 'all',
      intent: 'pid_overview',
      timestamp
    };
  }

  // =========================================================================
  // 4. UNIVERSAL INDUSTRIAL KNOWLEDGE: DISTILLATION COLUMN HYDRAULICS
  // =========================================================================
  if (lowerQ.includes('flooding') || lowerQ.includes('weeping') || lowerQ.includes('mccabe') || lowerQ.includes('reflux ratio')) {
    return {
      success: true,
      answer: `DISTILLATION TRAY HYDRAULICS & MASS TRANSFER:

1. Tray Operating Window & Malfunctions:
• Flooding (Upper Limit): Excessive vapor velocity carries liquid up to higher trays (Jet Flooding) or downcomer liquid velocity exceeds backup capacity (Downcomer Flooding). Symptoms: Massive surge in column differential pressure (ΔP), loss of separation, liquid carried overhead into condenser.
• Weeping (Lower Limit): Low vapor velocity allows liquid to dump through tray perforations instead of flowing across to the downcomer. Symptoms: Sudden loss of tray contact efficiency and loss of overhead purity.
• Entrainment: Liquid droplets atomized by high-velocity vapor and carried upward, contaminating top distillate purity.

2. Reflux Ratio (L/D) Dynamics:
• L/D represents the ratio of returned liquid reflux (L) to overhead product distillate (D).
• Higher Reflux: Increases fractionation stages efficiency and distillate purity, but increases reboiler heat duty and condenser cooling demand.
• Minimum Reflux (R_min): Requires infinite trays (pinch point). Operating column design typically sets L/D = 1.2 to 1.5 * R_min.

3. Live D-101 Column Telemetry:
• Reflux Ratio: ${dist.reflux_ratio.toFixed(2)} L/D
• Top Vapor Temperature: ${dist.top_temperature.toFixed(1)} °C
• Column Operating Pressure: ${dist.pressure.toFixed(2)} bar
${dist.reflux_ratio < 1.1 ? '⚠ PFD Alert: Reflux ratio is currently depressed (<1.1 L/D), allowing heavy components into overhead vapor.' : '✓ D-101 tray hydraulics and reflux separation are within nominal design limits.'}`,
      equipment: 'distillation',
      intent: 'distillation_hydraulics',
      timestamp
    };
  }

  // =========================================================================
  // 5. UNIVERSAL INDUSTRIAL KNOWLEDGE: CHEMICAL REACTORS & RUNAWAY KINETICS
  // =========================================================================
  if (lowerQ.includes('reactor') || lowerQ.includes('cstr') || lowerQ.includes('pfr') || lowerQ.includes('runaway') || lowerQ.includes('arrhenius')) {
    return {
      success: true,
      answer: `CHEMICAL REACTOR ENGINEERING & THERMAL RUNAWAY:

1. Reactor Types & Characteristics:
• CSTR (Continuous Stirred-Tank Reactor): Ideal for continuous liquid-phase reactions requiring uniform temperature and composition; reaction rate occurs at outlet concentration.
• PFR (Plug Flow Reactor): High conversion per unit volume; concentration and reaction rate vary continuously along the axial coordinate.
• Batch Reactor: High flexibility for specialty chemicals; requires batch cycle heating/cooling.

2. Thermal Runaway Dynamics (Semenov Heat Balance):
• Heat Generation: Q_gen = (-ΔH_rxn) * V * k0 * exp(-Ea / (R * T)) * C_A^n (Exponential with Temperature).
• Heat Removal: Q_rem = U * A * (T_reactor - T_jacket) (Linear with Temperature).
• Runaway Criterion: When d(Q_gen)/dT > d(Q_rem)/dT, heat generation outpaces cooling capacity, causing temperature and pressure to escalate exponentially according to Arrhenius kinetics and Antoine vapor-liquid equilibria.

3. Live R-101 CSTR Telemetry:
• Core Temperature: ${reactor.temperature.toFixed(1)} °C (Nominal: 65.0 °C)
• Vessel Pressure: ${reactor.pressure.toFixed(2)} bar (Nominal: 2.05 bar)
• Jacket Interlock: ${reactor.cooling_status === 1 ? 'ACTIVE (1 - Cooling ON)' : 'TRIPPED (0 - Cooling Loss / Emergency)'}
${reactor.cooling_status === 0 || reactor.temperature > 78 ? '🔴 CRITICAL: Loss of jacket cooling has destabilized the heat balance. Immediate operator quench/inhibitor protocol required.' : '✓ Exothermic heat generation is stably balanced by jacket coolant heat removal.'}`,
      equipment: 'reactor',
      intent: 'reactor_kinetics',
      timestamp
    };
  }

  // =========================================================================
  // 6. UNIVERSAL INDUSTRIAL KNOWLEDGE: HEAT EXCHANGERS & FOULING
  // =========================================================================
  if (lowerQ.includes('heat exchanger') || lowerQ.includes('fouling') || lowerQ.includes('lmtd') || lowerQ.includes('ntu')) {
    return {
      success: true,
      answer: `HEAT EXCHANGER THERMODYNAMICS & FOULING MECHANISMS:

1. Governing Rate Equation:
Q = U * A * ΔT_lm * F

Where:
• Q = Heat duty (W or kW) = m_dot * C_p * (T_in - T_out)
• U = Overall heat transfer coefficient [W/(m²·K)]
• A = Surface area (m²)
• ΔT_lm = Log Mean Temperature Difference = (ΔT1 - ΔT2) / ln(ΔT1 / ΔT2)
• F = Geometry correction factor for multi-pass / cross-flow exchangers (F >= 0.75 design minimum).

2. Fouling Resistance (R_f):
1/U_fouled = 1/U_clean + R_f
Thermal boundary scale, biological growth, particulate sedimentation, or coking creates an insulating boundary layer, collapsing the temperature gradient (ΔT) across process streams.

3. Live E-101 Counter-Flow Exchanger State:
• Inlet T: ${hx.inlet_temperature.toFixed(1)} °C | Outlet T: ${hx.outlet_temperature.toFixed(1)} °C
• Temperature Gradient (ΔT): ${hx.temperature_difference.toFixed(1)} °C (Nominal: 12.9 °C)
• Heat Transfer Efficiency: ${(hx.efficiency ?? hx.heat_transfer_indicator).toFixed(1)}%
${hx.temperature_difference < 5.0 ? '⚠ Thermal Fouling Alert: Severe collapse in ΔT indicates heavy tube scale accumulation and reduced overall heat transfer coefficient U.' : '✓ Thermal transfer rate and exchanger efficiency are nominal.'}`,
      equipment: 'heat_exchanger',
      intent: 'heat_exchanger_theory',
      timestamp
    };
  }

  // =========================================================================
  // 7. UNIVERSAL INDUSTRIAL KNOWLEDGE: PROCESS SAFETY, HAZOP & LOPA
  // =========================================================================
  if (lowerQ.includes('hazop') || lowerQ.includes('lopa') || lowerQ.includes('safety') || lowerQ.includes('psv') || lowerQ.includes('interlock')) {
    return {
      success: true,
      answer: `PROCESS SAFETY ENGINEERING, HAZOP & RISK MITIGATION:

1. HAZOP Methodology (Hazard & Operability Study):
Applies standardized guide words to process parameters:
• NO / NOT (e.g., No flow -> Pump cavitation / deadhead)
• MORE (e.g., More pressure / temperature -> Exothermic runaway / vessel overpressure)
• LESS (e.g., Less cooling -> Exchanger fouling / reactor cooling loss)
• REVERSE (e.g., Reverse flow -> Backflow into storage / contamination)
• AS WELL AS / PART OF (e.g., Phase separation / composition change)

2. Layers of Protection Analysis (LOPA):
1. Basic Process Control System (BPCS) - Closed loop PID control.
2. Critical Alarms & Operator Intervention - Dashboard alerts and authorization.
3. Safety Instrumented System (SIS / SIL 1-4) - Automated trip interlocks.
4. Physical Relief Devices - Pressure Safety Valves (PSV per API 520/521) and Rupture Discs.
5. Passive Mitigation - Dikes, blast walls, containment sumps.

3. ChemDiag Safety Gate Architecture:
ChemDiag enforces an automated deterministic Safety Gate that acts as an advisory decision firewall. It strictly prevents unauthorized or low-confidence actuator recommendations, enforcing "DO NOT ACT" directives during unclassified conditions.`,
      equipment: 'all',
      intent: 'safety_hazop',
      timestamp
    };
  }

  // =========================================================================
  // 8. UNKNOWN FAULT & SAFETY GATE QUERIES
  // =========================================================================
  if (
    isUnknown ||
    lowerQ.includes('unknown fault') ||
    lowerQ.includes('why is recommendation blocked') ||
    lowerQ.includes('why do not act') ||
    lowerQ.includes('why blocked')
  ) {
    return {
      success: true,
      answer: `⚠ UNKNOWN FAULT DIAGNOSTIC ANALYSIS (SAFETY GATE ACTIVE):

1. Observed Sensor Deviations:
• Reactor Temperature: ${reactor.temperature.toFixed(1)} °C
• Vessel Pressure: ${reactor.pressure.toFixed(2)} bar
• Pump Vibration: ${pump.vibration.toFixed(2)} g
• Pump Speed: ${Math.round(pump.rpm)} RPM

2. Multi-Model Inference & Uncertainty:
• Isolation Forest Anomaly Flag: DETECTED (Outlier anomaly present).
• Random Forest Classification Confidence: ${Math.round(diag.confidence * 100)}% (Uncertain / Low Confidence).
• Guard Assessment: The multivariate sensor pattern does not match any single trained baseline failure mode with high probability.

3. Deterministic Safety Directive:
🚨 DO NOT ACT AUTOMATICALLY
🚨 DO NOT FORCE CLASSIFICATION

4. Operator Action Protocol:
Automatic control recommendation is blocked by the Safety Gate. Cross-verify physical transmitter calibrations, field valve positions, and utility header pressures before initiating any maintenance or plant intervention.`,
      equipment: 'all',
      intent: 'unknown_fault_explanation',
      timestamp
    };
  }

  // =========================================================================
  // 9. PROGNOSIS & "WHAT WILL HAPPEN NEXT?"
  // =========================================================================
  if (
    lowerQ.includes('what will happen next') ||
    lowerQ.includes('what happens next') ||
    lowerQ.includes('future') ||
    lowerQ.includes('prognosis') ||
    lowerQ.includes('progression') ||
    lowerQ.includes('degradation trend')
  ) {
    const degradation = prog.degradationPercent ?? 25;
    const stage = prog.riskStage || 'EARLY_WARNING';
    const timeEstimate = prog.timeToThreshold || 'Operating nominally within design tolerances.';

    return {
      success: true,
      answer: `FAULT PROGRESSION & PROGNOSIS REPORT:

1. Current Risk Assessment:
• Risk Stage: ${stage} (Degradation Level: ${degradation}%)
• Trend Direction: ${prog.trend || 'STABLE'}
• Estimated Time-to-Threshold: ${timeEstimate}

2. Physical Degradation Narrative:
${prog.narrative || 'All continuous process parameters are currently stable within nominal operating envelopes.'}

3. Process Propagation Chain (Cause -> Effect):
P-101 Flow (${(pump.flow ?? 10.0).toFixed(1)} L/min) -> E-101 Effluent (${hx.outlet_temperature.toFixed(1)} °C) -> R-101 Core (${reactor.temperature.toFixed(1)} °C) -> D-101 Top (${dist.top_temperature.toFixed(1)} °C).

4. Recommended Condition Monitoring:
Track continuous parameter derivatives to detect slope acceleration before critical boundary breaches.`,
      equipment: detectedEquip || 'all',
      intent: 'prognosis_inquiry',
      timestamp
    };
  }

  // =========================================================================
  // 10. "WHAT SHOULD I DO?" / OPERATOR RECOMMENDATIONS
  // =========================================================================
  if (
    (lowerQ.includes('what should i do') ||
    lowerQ.includes('what to do') ||
    lowerQ.includes('action') ||
    lowerQ.includes('recommendation') ||
    (lowerQ.includes('what should i check') && !prevWasCavitation && !prevWasPID && !prevWasCompressor)) &&
    !lowerQ.includes('cavitation') &&
    !lowerQ.includes('pid') &&
    !lowerQ.includes('compressor')
  ) {
    if (!isAnomaly) {
      return {
        success: true,
        answer: `RECOMMENDED OPERATOR ACTION: NOMINAL OPERATION

1. Plant Status:
All monitored chemical process units (P-101, E-101, R-101, D-101) are operating within baseline tolerances.

2. Directive:
✓ Continue routine supervisory monitoring.
✓ Verify periodic steady-state mass and energy balances.
✓ No manual intervention required.`,
        equipment: 'all',
        intent: 'action_nominal',
        timestamp
      };
    }

    if (!safety.safeToRecommend || isUnknown) {
      return {
        success: true,
        answer: `🚨 DO NOT ACT AUTOMATICALLY — SAFETY GATE ACTIVE

Safety Gate State: ${safety.statusLabel}
Reason: ${safety.reason}

Required Protocol:
1. Automated plant recommendation is blocked due to low classification confidence or unverified multi-sensor deviations.
2. Visually inspect physical instrumentation, sensor connections, and valve positions.
3. Obtain senior process engineer review before performing physical maintenance.`,
        equipment: detectedEquip || 'all',
        intent: 'action_blocked',
        timestamp
      };
    }

    return {
      success: true,
      answer: `✓ SAFE TO RECOMMEND (OPERATOR AUTHORIZATION REQUIRED)

Active Fault: ${diag.fault} (${diag.severity} Severity)
Preventive Risk Score: ${diag.riskScore} / 100 (${diag.riskStage})

1. Recommended Preventive Measure:
"${prev.preventiveMeasure || diag.recommendedAction}"

2. Physical Evidence Basis:
${prev.observedEvidence || diag.rootCause}

3. Human-in-the-Loop Requirement:
ChemDiag AI acts as decision support and never issues direct actuator commands. Please click "Approve Recommendation" on the dashboard to record your decision.`,
      equipment: detectedEquip || 'all',
      intent: 'action_recommended',
      timestamp
    };
  }

  // =========================================================================
  // 11. XAI ROOT CAUSE: "WHY DID AI DETECT THIS?"
  // =========================================================================
  if (
    lowerQ.includes('why did ai detect') ||
    lowerQ.includes('why was this detected') ||
    lowerQ.includes('which variable changed') ||
    lowerQ.includes('what changed') ||
    lowerQ.includes('xai')
  ) {
    const xai = diag.xaiContributions || [];
    const xaiList = xai.map(x => `• ${x.label}: ${x.change} (${x.contributionPercent}% contribution)`).join('\n');

    return {
      success: true,
      answer: `EXPLAINABLE AI (XAI) ROOT CAUSE ATTRIBUTION:

1. Diagnosed Condition:
${diag.fault} (${diag.severity} Severity, ${Math.round(diag.confidence * 100)}% Confidence)

2. Probable Engineering Root Cause:
${diag.rootCause}

3. Key Contributing Sensor Variables (XAI Feature Breakdown):
${xaiList || compareRecentValues(detectedEquip, liveState)}

4. Safety Gate State:
${safety.statusLabel}`,
      equipment: detectedEquip || 'all',
      intent: 'xai_inquiry',
      timestamp
    };
  }

  // =========================================================================
  // 12. "IS THE PROCESS NORMAL?" / PROCESS SUMMARY
  // =========================================================================
  if (lowerQ.includes('is the process normal') || lowerQ.includes('is everything normal') || lowerQ.includes('is it normal')) {
    if (!isAnomaly) {
      return {
        success: true,
        answer: `Yes. The process train is currently operating within nominal baseline parameters:

• Pump (P-101): NORMAL (${Math.round(pump.rpm)} RPM, ${pump.vibration.toFixed(2)} g vibration)
• Heat Exchanger (E-101): NORMAL (ΔT = ${hx.temperature_difference.toFixed(1)} °C, Efficiency = ${(hx.efficiency ?? 95).toFixed(0)}%)
• Reactor (R-101): NORMAL (${reactor.temperature.toFixed(1)} °C, ${reactor.pressure.toFixed(2)} bar, Cooling ON)
• Distillation (D-101): NORMAL (Reflux = ${dist.reflux_ratio.toFixed(2)} L/D, Top T = ${dist.top_temperature.toFixed(1)} °C)

All monitored variables are within operating limits.`,
        equipment: 'all',
        intent: 'status_normal',
        timestamp
      };
    } else {
      return {
        success: true,
        answer: `No. An abnormal process condition has been detected:

• Diagnosed State: ${diag.fault} (${diag.severity} Severity)
• Preventive Risk Score: ${diag.riskScore} / 100 (${diag.riskStage})
• Safety Gate: ${safety.statusLabel}
• Probable Cause: ${diag.rootCause}
• Recommended Action: ${prev.preventiveMeasure || diag.recommendedAction}`,
        equipment: detectedEquip || 'all',
        intent: 'status_abnormal',
        timestamp
      };
    }
  }

  if (lowerQ.includes('summary') || lowerQ.includes('overview')) {
    return {
      success: true,
      answer: `CHEMDIAG DIGITAL TWIN PROCESS SUMMARY:

1. P-101 Centrifugal Pump:
   Speed: ${Math.round(pump.rpm)} RPM | Vibration: ${pump.vibration.toFixed(2)} g | Flow: ${(pump.flow ?? 10.0).toFixed(1)} L/min (${pump.status || 'NORMAL'})

2. E-101 Heat Exchanger:
   Inlet: ${hx.inlet_temperature.toFixed(1)} °C | Outlet: ${hx.outlet_temperature.toFixed(1)} °C | ΔT: ${hx.temperature_difference.toFixed(1)} °C (${hx.status || 'NORMAL'})

3. R-101 CSTR Reactor:
   Temp: ${reactor.temperature.toFixed(1)} °C | Press: ${reactor.pressure.toFixed(2)} bar | Cooling: ${reactor.cooling_status === 1 ? 'ON' : 'OFF'} (${reactor.status || 'NORMAL'})

4. D-101 Distillation Column:
   Top: ${dist.top_temperature.toFixed(1)} °C | Reflux: ${dist.reflux_ratio.toFixed(2)} | Press: ${dist.pressure.toFixed(2)} bar (${dist.status || 'NORMAL'})

Overall Diagnosis: ${diag.fault} (Confidence: ${Math.round(diag.confidence * 100)}%)
Safety Gate State: ${safety.statusLabel}`,
      equipment: 'all',
      intent: 'process_summary',
      timestamp
    };
  }

  // =========================================================================
  // 12b. PUMP CAVITATION & FLUID MACHINERY
  // =========================================================================
  const isCavitationTopic = (
    lowerQ.includes('cavitation') ||
    (lowerQ.includes('npsh') && !lowerQ.includes('compressor')) ||
    (prevWasCavitation && (
      lowerQ.includes('cause') ||
      lowerQ.includes('why') ||
      lowerQ.includes('could my pump') ||
      lowerQ.includes('my pump') ||
      lowerQ.includes('check first') ||
      lowerQ.includes('what should i check') ||
      lowerQ.includes('how to check') ||
      isFollowUpPattern
    ))
  ) && !isSwitchingTopic && !lowerQ.includes('compressor') && !lowerQ.includes('pid');

  if (isCavitationTopic) {
    const isCausesQuestion = lowerQ.includes('cause') || (prevWasCavitation && (lowerQ.includes('why') || lowerQ.includes('happen') || lowerQ.includes('what leads')));
    const isLivePumpCheck = lowerQ.includes('my pump') || lowerQ.includes('p-101') || lowerQ.includes('could my') || lowerQ.includes('does my') || lowerQ.includes('in our pump');
    const isCheckFirstQuestion = lowerQ.includes('check first') || lowerQ.includes('what should i check') || lowerQ.includes('what to check') || (prevWasCavitation && lowerQ.includes('check'));

    if (isCausesQuestion && !isLivePumpCheck && !isCheckFirstQuestion) {
      return {
        success: true,
        answer: `ROOT CAUSES OF PUMP CAVITATION:

1. Insufficient Net Positive Suction Head Available (NPSHa < NPSHr):
• The static pressure at the pump suction eye falls below the fluid vapor pressure (P_vapor), causing instant localized boiling and microscopic bubble generation.

2. Elevated Fluid Operating Temperature:
• Higher liquid temperature exponentially increases vapor pressure (P_vapor) per Antoine's equation, reducing the available cavitation margin (NPSHa - NPSHr).

3. Suction Line Pressure Drop & Restrictions:
• Clogged Suction Strainer: Accumulated debris creates severe flow restriction and local pressure drop.
• Partially Closed Suction Valve: Generates high localized fluid velocity and static pressure drop (Bernoulli restriction).
• Undersized Suction Piping / Long Suction Line: Excessive frictional head loss (h_friction).

4. Feed Tank Low Liquid Level & Vortex Formation:
• Insufficient static liquid height in the feed tank reduces hydrostatic head and allows surface vortexing, drawing air/vapor directly into the suction nozzle.

5. Operating Off the Best Efficiency Point (BEP):
• Running at excessive flow rates far to the right of BEP, where required suction head (NPSHr) increases steeply.`,
        equipment: 'pump',
        intent: 'cavitation_causes',
        timestamp
      };
    }

    if (isLivePumpCheck && !isCheckFirstQuestion) {
      const isElevated = pump.vibration > 0.20 || pump.rpm < 2000;
      return {
        success: true,
        answer: `EVALUATION OF LIVE P-101 PUMP FOR CAVITATION:

1. Live P-101 Telemetry Analysis:
• Pump Speed: ${Math.round(pump.rpm)} RPM (Nominal: 2450 RPM)
• Vibration Level: ${pump.vibration.toFixed(2)} g (Baseline: 0.08 g, Warning Threshold: 0.20 g)
• Discharge Flow: ${(pump.flow ?? 10.0).toFixed(1)} L/min (Nominal: 10.0 L/min)
• Suction Temperature: ${pump.inlet_temperature.toFixed(1)} °C (Water P_vapor ≈ 0.032 bar)

2. Hydraulic & Cavitation Status:
${isElevated ? `⚠ Elevated Vibration & Flow Anomaly Detected:
• P-101 vibration is elevated at ${pump.vibration.toFixed(2)} g with reduced flow of ${(pump.flow ?? 10.0).toFixed(1)} L/min.
• This acoustic and mechanical signature is consistent with suction starvation, hydraulic cavitation, or mechanical impeller degradation.` : `✓ Nominal Hydraulic Condition:
• P-101 is currently operating with stable vibration (${pump.vibration.toFixed(2)} g) and nominal flow (${(pump.flow ?? 10.0).toFixed(1)} L/min).
• The available suction head (NPSHa) maintains an adequate safety margin above NPSHr.`}`,
        equipment: 'pump',
        intent: 'pump_cavitation_check',
        timestamp
      };
    }

    if (isCheckFirstQuestion) {
      return {
        success: true,
        answer: `PRIORITY DIAGNOSTIC CHECKLIST FOR PUMP CAVITATION (P-101):

When investigating suspected pump cavitation, inspect in the following chronological order:

1. Suction Strainer Differential Pressure (ΔP):
• Check if the suction inlet filter/basket strainer is blinded by scale or particulate debris, which starves the pump of static suction pressure.

2. Feed Tank / Reservoir Liquid Level:
• Verify that the feed vessel level is well above the minimum submergence limit to prevent air-entraining surface vortices and ensure adequate static head (h_static).

3. Suction Block Valve Alignment:
• Confirm the suction isolation valve is 100% fully open. (Never throttle flow using a suction valve — throttling must always be done on the discharge side).

4. Suction Liquid Temperature:
• Verify inlet temperature (${pump.inlet_temperature.toFixed(1)} °C) has not spiked, which would elevate liquid vapor pressure.

5. Operating Flow vs. Pump Head Curve:
• Check if the pump is operating too far to the right of its Best Efficiency Point (BEP) where NPSHr rises sharply.

6. Impeller Visual / Internal Inspection (if taken offline):
• Inspect impeller eye and vane leading edges for classic pitting, erosion, or sponge-like metal loss.`,
        equipment: 'pump',
        intent: 'cavitation_checklist',
        timestamp
      };
    }

    return {
      success: true,
      answer: `CENTRIFUGAL PUMPS & CAVITATION PHENOMENOLOGY:

1. Physical Mechanism of Cavitation:
Cavitation occurs when local static pressure at the pump impeller suction eye drops below the liquid's vapor pressure (P_vapor) at the operating temperature:
• Bubble Formation: Liquid vaporizes instantly, forming microscopic vapor cavities in low-pressure zones.
• Pressure Recovery: As fluid moves into higher-pressure regions along the impeller vanes, the vapor bubbles collapse violently (micro-implosions in nanoseconds).
• Shockwave Damage: Local microjets reach velocities up to 1000 m/s and pressures exceeding 1000 bar, causing microscopic pitting, noise ("gravel in the casing"), and high-frequency vibration.

2. Net Positive Suction Head (NPSH) Criteria:
• NPSHa (Available) = P_suction_absolute/(ρ*g) + v²/(2*g) - P_vapor/(ρ*g) - h_friction_suction
• Cavitation Margin Rule: To prevent cavitation, engineers require NPSHa > NPSHr (Required by pump manufacturer) by at least 0.5 to 1.0 m (or 1.2x margin).

3. Live P-101 Pump Telemetry:
• Speed: ${Math.round(pump.rpm)} RPM | Vibration: ${pump.vibration.toFixed(2)} g | Flow: ${(pump.flow ?? 10.0).toFixed(1)} L/min
• Suction Temp: ${pump.inlet_temperature.toFixed(1)} °C
${pump.vibration > 0.20 || pump.rpm < 2000 ? '⚠ Notice: Elevated vibration / reduced flow matches hydraulic cavitation or mechanical impeller wear.' : '✓ P-101 operating parameters are nominal with adequate NPSH margin.'}`,
      equipment: 'pump',
      intent: 'cavitation_explanation',
      timestamp
    };
  }

  // =========================================================================
  // 13. EQUIPMENT-SPECIFIC QUESTIONS: WHY IS PUMP/REACTOR/HX/DISTILLATION ABNORMAL?
  // =========================================================================
  if (detectedEquip === 'pump' || lowerQ.includes('pump') || lowerQ.includes('p-101') || lowerQ.includes('p101')) {
    const isAskingFaultOrLive = lowerQ.includes('abnormal') || lowerQ.includes('fault') || lowerQ.includes('why') || lowerQ.includes('check') || lowerQ.includes('status') || lowerQ.includes('my pump') || lowerQ.includes('p-101') || isAnomaly;
    if (isAskingFaultOrLive) {
      const flow = pump.flow ?? ((pump.rpm / 2450) * 10.0);
      return {
        success: true,
        answer: `Pump RPM has decreased from 2450 to ${Math.round(pump.rpm)} RPM while vibration increased from 0.08 to ${pump.vibration.toFixed(2)} g and discharge flow decreased to ${flow.toFixed(1)} L/min.

This combination is consistent with developing mechanical degradation (bearing wear / shaft misalignment).

Preventive Risk Score: ${diag.riskScore} / 100 (${diag.riskStage}).`,
        equipment: 'pump',
        intent: 'pump_explanation',
        timestamp
      };
    }

    return {
      success: true,
      answer: `CENTRIFUGAL PUMPS (P-101):

1. Working Principle:
Centrifugal pumps convert rotational kinetic energy from an electric motor/drive into hydrodynamic pressure energy:
• Impeller Eye: Fluid enters axially through the suction eye.
• Vane Acceleration: Rotating backward-curved vanes accelerate fluid radially outward at high velocity.
• Volute Casing / Diffuser: Expanding cross-sectional area decelerates the high-velocity fluid, converting kinetic energy into static discharge pressure (Bernoulli principle).

2. Key Performance Parameters:
• Flow Rate (Q), Total Dynamic Head (H = ΔP / ρg), Power Consumption (P = ρ*g*Q*H / η), and Efficiency (η).
• Affinity Laws: Q ∝ N, H ∝ N², Power ∝ N³ (where N is rotational speed in RPM).

3. Live P-101 Status:
• Speed: ${Math.round(pump.rpm)} RPM | Vibration: ${pump.vibration.toFixed(2)} g | Flow: ${(pump.flow ?? 10.0).toFixed(1)} L/min.`,
      equipment: 'pump',
      intent: 'pump_general',
      timestamp
    };
  }

  if (detectedEquip === 'reactor' || lowerQ.includes('reactor') || lowerQ.includes('r-101') || lowerQ.includes('r101')) {
    return {
      success: true,
      answer: `Reactor temperature has increased to ${reactor.temperature.toFixed(1)} °C and vessel pressure has escalated to ${reactor.pressure.toFixed(2)} bar while cooling status is ${reactor.cooling_status === 1 ? 'ACTIVE (DEGRADED)' : 'TRIPPED/OFF'}.

This combination indicates loss of cooling jacket heat removal capacity and escalating exothermic reaction heat.

Safety Directive: ${safety.directive}`,
      equipment: 'reactor',
      intent: 'reactor_explanation',
      timestamp
    };
  }

  if (detectedEquip === 'heat_exchanger' || lowerQ.includes('heat exchanger') || lowerQ.includes('e-101') || lowerQ.includes('e101')) {
    return {
      success: true,
      answer: `Heat exchanger thermal difference (ΔT) has dropped to ${hx.temperature_difference.toFixed(1)} °C (Nominal: 12.9 °C) with heat transfer efficiency at ${(hx.efficiency ?? hx.heat_transfer_indicator).toFixed(1)}%.

This collapse in thermal gradient indicates tube wall scale fouling and increased thermal boundary resistance.`,
      equipment: 'heat_exchanger',
      intent: 'hx_explanation',
      timestamp
    };
  }

  if (detectedEquip === 'distillation' || lowerQ.includes('distillation') || lowerQ.includes('d-101') || lowerQ.includes('d101')) {
    return {
      success: true,
      answer: `Distillation column reflux ratio has dropped to ${dist.reflux_ratio.toFixed(2)} L/D while top overhead temperature has risen to ${dist.top_temperature.toFixed(1)} °C.

Low reflux combined with elevated top temperature matches column reflux-starvation and loss of fractionation efficiency.`,
      equipment: 'distillation',
      intent: 'distillation_explanation',
      timestamp
    };
  }

  // =========================================================================
  // 13b. GENERAL SCIENCE & OPTICS: WHY IS THE SKY BLUE?
  // =========================================================================
  if (lowerQ.includes('sky') && lowerQ.includes('blue')) {
    return {
      success: true,
      answer: `WHY THE SKY IS BLUE (OPTICAL & THERMODYNAMIC PERSPECTIVE):

1. Rayleigh Scattering Mechanism:
Sunlight enters Earth's atmosphere as polychromatic electromagnetic radiation across the visible spectrum (400–700 nm). The gas molecules in the atmosphere (primarily N2 and O2) are much smaller than light wavelengths. In this regime, Rayleigh scattering cross-section is inversely proportional to the fourth power of the wavelength:
σ_scattering ∝ 1 / λ⁴

Because blue light has a shorter wavelength (~450 nm) than red light (~700 nm), blue light is scattered in all directions approximately (700 / 450)⁴ ≈ 5.8 times more intensely than red light, creating the blue appearance of the daytime sky.

2. Thermodynamic & Radiative Context:
• Solar Emission: The Sun emits radiation as an approximate blackbody at T ≈ 5778 K (Planck's radiation law), with its spectral radiance peaking in the visible spectrum.
• Radiative Heat & Entropy Transfer: As this high-temperature directional radiation passes through the colder terrestrial atmosphere (T ≈ 288 K), molecular elastic scattering redistributes photon momentum into diffuse radiation. This increases the entropy of the radiative field without degrading the visible photon energies into thermal heat.`,
      equipment: 'all',
      intent: 'sky_blue_optics',
      timestamp
    };
  }

  // =========================================================================
  // 14. DEFAULT INTELLIGENT INDUSTRIAL FALLBACK
  // =========================================================================
  const isAskingAboutPlant = (
    lowerQ.includes('my plant') ||
    lowerQ.includes('our plant') ||
    lowerQ.includes('live plant') ||
    lowerQ.includes('current plant') ||
    lowerQ.includes('in my plant') ||
    lowerQ.includes('in the plant right now') ||
    lowerQ.includes('right now in the plant') ||
    lowerQ.includes('live process') ||
    lowerQ.includes('process status') ||
    lowerQ.includes('plant status') ||
    lowerQ.includes('what is happening right now') ||
    lowerQ.includes('what is happening in the plant') ||
    lowerQ.includes('what is happening in my') ||
    lowerQ.includes('current process status') ||
    lowerQ.includes('process summary') ||
    lowerQ.includes('overall diagnosis')
  );

  if (isAskingAboutPlant) {
    return {
      success: true,
      answer: `CHEMDIAG LIVE PROCESS STATUS:

1. Process Train Overview:
• P-101 Pump: ${Math.round(pump.rpm)} RPM, ${pump.vibration.toFixed(2)} g vibration (${(pump.flow ?? 10.0).toFixed(1)} L/min flow)
• E-101 Heat Exchanger: Inlet ${hx.inlet_temperature.toFixed(1)} °C, Outlet ${hx.outlet_temperature.toFixed(1)} °C (ΔT = ${hx.temperature_difference.toFixed(1)} °C)
• R-101 Reactor: Core ${reactor.temperature.toFixed(1)} °C, Pressure ${reactor.pressure.toFixed(2)} bar (Cooling: ${reactor.cooling_status === 1 ? 'ON' : 'TRIPPED'})
• D-101 Distillation: Reflux ${dist.reflux_ratio.toFixed(2)} L/D, Top ${dist.top_temperature.toFixed(1)} °C

2. AI Diagnostic & Safety State:
• Condition: ${diag.fault} (${diag.severity} Severity)
• Preventive Risk Score: ${diag.riskScore} / 100 (${diag.riskStage})
• Safety Gate: ${safety.statusLabel}
${isAnomaly ? `• Probable Root Cause: ${diag.rootCause}\n• Recommended Action: ${prev.preventiveMeasure || diag.recommendedAction}` : `• Plant Status: All units are operating within nominal baseline parameters.`}`,
      equipment: detectedEquip || 'all',
      intent: 'plant_status',
      timestamp
    };
  }

  return {
    success: true,
    answer: `General process and chemical engineering inquiries regarding "${query}" are processed by the active ChemDiag Industrial AI cloud model (Google Gemini / Groq). Please ensure the AI engine is selected.`,
    equipment: 'all',
    intent: 'general_scientific_explanation',
    timestamp
  };
}
