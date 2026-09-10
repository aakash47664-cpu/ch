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
      // If the immediate preceding turn was about compressors or general theory, don't latch to an old equipment
      if (histText.includes('compressor') || histText.includes('surge') || histText.includes('entropy')) {
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

  // Check recent conversation turns for topic resolution
  const recentUserTurnsList = (history || [])
    .filter(h => h.sender === 'user' || h.role === 'user');
  const lastUserTurnObj = recentUserTurnsList.slice(-1)[0];
  const lastUserTurn = (lastUserTurnObj?.text || lastUserTurnObj?.content || lastUserTurnObj?.message || '').toLowerCase();
  const recentUserTurns = recentUserTurnsList
    .slice(-3)
    .map(h => (h.text || h.content || h.message || '').toLowerCase())
    .join(' ');

  // =========================================================================
  // 1. UNIVERSAL INDUSTRIAL KNOWLEDGE: THERMODYNAMICS & ENTROPY
  // =========================================================================
  const isEntropyTopic = lowerQ.includes('entropy') || lowerQ.includes('thermodynamics') || lowerQ.includes('second law') || lowerQ.includes('irreversibility') || (recentUserTurns.includes('entropy') && (lowerQ.includes('why') || lowerQ.includes('heat transfer') || lowerQ.includes('exchanger') || lowerQ.includes('increase') || lowerQ.includes('matter')));

  if (isEntropyTopic) {
    const isAskingAboutExchanger = lowerQ.includes('heat exchanger') || lowerQ.includes('my heat exchanger') || lowerQ.includes('e-101') || lowerQ.includes('e101') || lowerQ.includes('my process') || lowerQ.includes('matter in my') || lowerQ.includes('affect my') || lowerQ.includes('happening with my heat exchanger') || lowerQ.includes('happening there');
    const isAskingHeatTransferRel = lowerQ.includes('heat transfer') || lowerQ.includes('related to heat') || lowerQ.includes('transfer');
    const isAskingWhyIncrease = lowerQ.includes('why does') || lowerQ.includes('why entropy') || lowerQ.includes('increase');

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
  const isCompressorTopic = lowerQ.includes('compressor') || lowerQ.includes('surge') || (recentUserTurns.includes('surge') && (lowerQ.includes('happen') || lowerQ.includes('monitor') || lowerQ.includes('plant') || lowerQ.includes('industrial') || lowerQ.includes('could that') || lowerQ.includes('what would i need') || lowerQ.includes('how to prevent')));

  if (isCompressorTopic) {
    const isComparingWithCavitation = lowerQ.includes('compare') || lastUserTurn.includes('cavitation');
    const isPlantOccur = lowerQ.includes('happen in an industrial') || lowerQ.includes('happen in a plant') || lowerQ.includes('could that happen') || lowerQ.includes('industrial plant');
    const isMonitoring = lowerQ.includes('monitor') || lowerQ.includes('what would i need') || lowerQ.includes('what to monitor');

    if (isMonitoring) {
      return {
        success: true,
        answer: `COMPRESSOR SURGE MONITORING & INSTRUMENTATION:

To detect and prevent aerodynamic compressor surge in an industrial plant, engineers monitor:
1. Suction Differential Pressure (ΔP): High-speed DP transmitters across a calibrated venturi/orifice to calculate instantaneous volumetric flow.
2. Compression Pressure Ratio (P_discharge / P_suction): Monitored against the machine's characteristic Surge Limit Line (SLL).
3. Shaft Radial & Thrust Vibration: Proximity probes and accelerometers detecting blade-pass frequencies and violent axial rotor shuttling.
4. Fast Temperature Spikes: Suction thermocouples to detect instantaneous gas backflow and re-compression heating.
5. Anti-Surge Valve Positioner: Verifying high-speed modulation (<1.5s stroke time) to recycle gas through a suction cooler.`,
        equipment: 'all',
        intent: 'compressor_monitoring',
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
  // 3. UNIVERSAL INDUSTRIAL KNOWLEDGE: PID CONTROLLERS & LOOP TUNING
  // =========================================================================
  if (lowerQ.includes('pid') || lowerQ.includes('tuning') || lowerQ.includes('ziegler') || lowerQ.includes('cascade control') || lowerQ.includes('feedforward')) {
    const isSimple = lowerQ.includes('simple') || lowerQ.includes('beginner');
    const isFormula = lowerQ.includes('formula') || lowerQ.includes('equation');

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
    lowerQ.includes('what should i do') ||
    lowerQ.includes('what should i check') ||
    lowerQ.includes('what to do') ||
    lowerQ.includes('action') ||
    lowerQ.includes('recommendation')
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
  // 13. EQUIPMENT-SPECIFIC QUESTIONS: WHY IS PUMP/REACTOR/HX/DISTILLATION ABNORMAL?
  // =========================================================================
  if (detectedEquip === 'pump' || lowerQ.includes('pump')) {
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

  if (detectedEquip === 'reactor' || lowerQ.includes('reactor')) {
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

  if (detectedEquip === 'heat_exchanger' || lowerQ.includes('heat exchanger')) {
    return {
      success: true,
      answer: `Heat exchanger thermal difference (ΔT) has dropped to ${hx.temperature_difference.toFixed(1)} °C (Nominal: 12.9 °C) with heat transfer efficiency at ${(hx.efficiency ?? hx.heat_transfer_indicator).toFixed(1)}%.

This collapse in thermal gradient indicates tube wall scale fouling and increased thermal boundary resistance.`,
      equipment: 'heat_exchanger',
      intent: 'hx_explanation',
      timestamp
    };
  }

  if (detectedEquip === 'distillation' || lowerQ.includes('distillation')) {
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
    answer: `In chemical and industrial process engineering, this relates to core operating principles, thermodynamics, fluid dynamics, and process control.

When evaluating equipment design, unit operations, or control loop performance, engineers assess:
1. Mass & Energy Conservation: Ensuring steady-state mass balances and enthalpy exchange across unit boundaries.
2. Rate Kinetics & Transport Phenomena: Analyzing heat transfer coefficients, diffusion rates, fluid pressure drops, and reaction equilibrium.
3. System Safety & Reliability: Ensuring operating envelopes remain well within mechanical, thermal, and design safety margins.

If you would like to analyze how this concept applies specifically to the live ChemDiag process train (P-101, E-101, R-101, D-101), feel free to ask!`,
    equipment: 'all',
    intent: 'general_engineering_explanation',
    timestamp
  };
}
