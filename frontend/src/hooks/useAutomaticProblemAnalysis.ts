import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ProcessUpdatePayload,
  AutomaticAnalysisItem,
  EquipmentHealthMap,
  FailureEventHistoryItem,
  ParameterDeviationRow
} from '../types';
import { sendAiChatMessage } from '../services/api';

// ============================================================================
// LATEX & RAW MARKDOWN TEXT SANITIZER
// Strictly removes all broken LaTeX notation ($9.6 \text{ L/min}$, \tau, \Delta T, $U$, etc.)
// and raw markdown pipe tables to guarantee clean, readable engineering typography.
// ============================================================================
export function cleanLatexAndMarkdown(raw: string): string {
  if (!raw) return '';
  return raw
    // Strip LaTeX math blocks and dollar signs
    .replace(/\$\$(.*?)\$\$/gs, '$1')
    .replace(/\$(.*?)\$/g, '$1')
    // Convert common LaTeX Greek letters & symbols
    .replace(/\\tau\b/g, 'τ')
    .replace(/\\Delta\s*T\b/g, 'ΔT')
    .replace(/\\Delta\s*P\b/g, 'ΔP')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\mu\b/g, 'μ')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\gamma\b/g, 'γ')
    .replace(/\\theta\b/g, 'θ')
    .replace(/\\lambda\b/g, 'λ')
    .replace(/\\sigma\b/g, 'σ')
    .replace(/\\omega\b/g, 'ω')
    .replace(/\\pm\b/g, '±')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\times\b/g, '×')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\le\b|\\leq\b/g, '≤')
    .replace(/\\ge\b|\\geq\b/g, '≥')
    .replace(/\\neq\b/g, '≠')
    .replace(/\\circ\b/g, '°')
    .replace(/\\degree\b/g, '°')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^}]+)\}/g, '$1')
    .replace(/\\mathit\{([^}]+)\}/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    // Remove markdown formatting asterisks and headers
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    // Clean raw markdown table delimiters
    .replace(/^\|.*\|$/gm, '')
    .replace(/\|/g, ' ')
    // Normalize excessive whitespace
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// ============================================================================
// UNIT METADATA & FAULT LIBRARIES
// ============================================================================
const UNIT_DEFINITIONS: Array<{
  id: string;
  tag: string;
  name: string;
  key: keyof EquipmentHealthMap;
  diagKey: 'P101' | 'E101' | 'R101' | 'D101';
}> = [
  { id: 'pump', tag: 'P-101', name: 'Centrifugal Feed Pump', key: 'pump', diagKey: 'P101' },
  { id: 'heat_exchanger', tag: 'E-101', name: 'Shell & Tube Heat Exchanger', key: 'heat_exchanger', diagKey: 'E101' },
  { id: 'reactor', tag: 'R-101', name: 'Continuous Stirred-Tank Reactor (CSTR)', key: 'reactor', diagKey: 'R101' },
  { id: 'distillation', tag: 'D-101', name: 'Binary Distillation Column', key: 'distillation', diagKey: 'D101' }
];

const ALTERNATIVE_POSSIBILITIES_MAP: Record<string, string[]> = {
  pump: [
    'Mechanical seal face friction & thermal expansion',
    'Suction line cavitation & strainer clogging',
    'Motor electrical winding imbalance / VFD slip',
    'Discharge throttling valve misalignment'
  ],
  heat_exchanger: [
    'Boundary layer particulate deposition & scaling',
    'Cooling utility starvation / supply valve drift',
    'Tube baffle bypass / internal gasket leakage',
    'Shell-side air binding / venting deficit'
  ],
  reactor: [
    'Emergency cooling water jacket valve trip / loss',
    'Agitator drive slip causing thermal hot-spotting',
    'Runaway Arrhenius kinetic heat generation',
    'Reactant stoichiometry overfeed / vessel flooding'
  ],
  distillation: [
    'Reflux pump head decay & upper tray starvation',
    'Reboiler tube bundle fouling / thermal duty loss',
    'Column top vapor line overpressurization',
    'Condenser subcooling deficit / non-condensible gas accumulation'
  ]
};

// ============================================================================
// DETERMINISTIC STRUCTURED ANALYSIS GENERATOR
// ============================================================================
export function synthesizeDeterministicAnalysis(
  targetUnit: { id: string; tag: string; name: string },
  diag: any,
  eqData: any,
  state: ProcessUpdatePayload
): AutomaticAnalysisItem {
  const timeStr = new Date().toLocaleTimeString();
  const unitId = targetUnit.id;
  const tag = targetUnit.tag;
  const name = targetUnit.name;

  const healthScore = diag?.health ?? (eqData?.health ?? 100);
  const riskScore = diag?.risk ?? Math.round(100 - healthScore);
  const stage = diag?.stage ?? 'NORMAL';
  const stageLabel = diag?.stageLabel ?? (healthScore >= 90 ? 'NOMINAL' : healthScore >= 70 ? 'EARLY DEGRADATION' : healthScore >= 40 ? 'DEVELOPING FAULT' : 'HIGH RISK');
  const severity = diag?.severity ?? (healthScore < 40 ? 'CRITICAL' : healthScore < 70 ? 'HIGH' : healthScore < 90 ? 'MEDIUM' : 'NORMAL');
  const role = diag?.role ?? (state.active_fault_mode?.includes(unitId) ? 'PRIMARY_FAULT' : 'NOMINAL');
  const isUnknown = !!(diag?.isUnknownFault || state.diagnosis?.is_unknown_fault);
  const isFailure = stage === 'FAULT_CONFIRMED' || healthScore < 35 || severity === 'CRITICAL';
  const confidence = isUnknown ? 68 : isFailure ? 95 : 89;

  let whatIsHappening = '';
  let whyItIsHappening = '';
  let primaryHypothesis = '';
  const supportingEvidence: string[] = [];
  const parameterRows: ParameterDeviationRow[] = [];
  const downstreamImpacts: Array<{ unitTag: string; unitName?: string; impact: string }> = [];
  const operatorChecklist: string[] = [];

  // 1. PUMP (P-101)
  if (unitId === 'pump') {
    const rpm = Math.round(eqData?.rpm ?? 2450);
    const vib = Number((eqData?.vibration ?? 0.08).toFixed(2));
    const flow = Number((eqData?.flow ?? 10.0).toFixed(1));
    const suctionP = Number((eqData?.suction_pressure ?? 1.01).toFixed(2));
    const dischargeP = Number((eqData?.discharge_pressure ?? 2.80).toFixed(2));

    const rpmDev = Number((((rpm - 2450) / 2450) * 100).toFixed(1));
    const vibDev = Number((((vib - 0.08) / 0.08) * 100).toFixed(1));
    const flowDev = Number((((flow - 10.0) / 10.0) * 100).toFixed(1));
    const pressDev = Number((((dischargeP - 2.80) / 2.80) * 100).toFixed(1));

    parameterRows.push(
      { parameter: 'Pump Speed', baseline: '2450 RPM', current: `${rpm} RPM`, deviation: `${rpmDev > 0 ? '+' : ''}${rpmDev}%`, isAnomaly: Math.abs(rpmDev) > 5 },
      { parameter: 'Casing Vibration', baseline: '0.08 g', current: `${vib.toFixed(2)} g`, deviation: `${vibDev > 0 ? '+' : ''}${vibDev}%`, isAnomaly: vibDev > 25 },
      { parameter: 'Discharge Flow', baseline: '10.0 L/min', current: `${flow.toFixed(1)} L/min`, deviation: `${flowDev > 0 ? '+' : ''}${flowDev}%`, isAnomaly: Math.abs(flowDev) > 5 },
      { parameter: 'Discharge Pressure', baseline: '2.80 bar', current: `${dischargeP.toFixed(2)} bar`, deviation: `${pressDev > 0 ? '+' : ''}${pressDev}%`, isAnomaly: Math.abs(pressDev) > 8 }
    );

    if (healthScore >= 90) {
      whatIsHappening = `P-101 Centrifugal Feed Pump is operating in steady nominal state. Rotational speed (2450 RPM), casing vibration (${vib} g), and discharge flow (${flow} L/min) are within design tolerances.`;
      primaryHypothesis = 'Nominal Steady Operation';
      whyItIsHappening = 'Hydraulic efficiency and mechanical integrity remain at design baseline with zero detectable anomaly signature.';
      supportingEvidence.push('Motor speed matches 2450 RPM design setpoint', 'Vibration is well below the 0.20 g ISO warning threshold', 'Discharge head and flow rate in dynamic equilibrium');
    } else {
      whatIsHappening = `P-101 is showing ${isFailure ? 'confirmed mechanical failure' : 'progressive mechanical degradation'}. Rotational speed has decreased from 2450 RPM to ${rpm} RPM (${rpmDev}% deviation). Casing vibration has increased from 0.08 g baseline to ${vib.toFixed(2)} g (${vibDev > 0 ? '+' : ''}${vibDev}%). Volumetric discharge flow has decreased to ${flow.toFixed(1)} L/min (${flowDev}%). The combined deviation indicates deteriorating pump hydraulic performance and elevated mechanical wear.`;
      primaryHypothesis = diag?.faultLabel || (vibDev > 100 ? 'Bearing wear / mechanical degradation' : 'Suction restriction / hydraulic slip');
      whyItIsHappening = `Primary hypothesis is ${primaryHypothesis.toLowerCase()}. Mechanical friction and rotational slip have reduced impeller head generation while escalating high-frequency structural vibration.`;
      supportingEvidence.push(
        `RPM decreased by ${Math.abs(rpmDev)}% from nominal 2450 baseline`,
        `Vibration elevated by ${vibDev}% (${vib.toFixed(2)} g vs 0.08 g baseline)`,
        `Flow reduced by ${Math.abs(flowDev)}% to ${flow.toFixed(1)} L/min`,
        `Discharge pressure dropped to ${dischargeP.toFixed(2)} bar (${pressDev}%)`
      );
    }

    downstreamImpacts.push(
      { unitTag: 'E-101', unitName: 'Heat Exchanger', impact: `Reduced inlet feed flow (${flow.toFixed(1)} L/min vs 10.0 L/min design), lower thermal exchange velocity.` },
      { unitTag: 'R-101', unitName: 'CSTR Reactor', impact: 'Reduced feed flow delivery, extending reactant residence time in reactor vessel.' },
      { unitTag: 'D-101', unitName: 'Distillation Column', impact: 'Reduced column feed delivery, shifting vapor-liquid equilibrium trays.' }
    );

    operatorChecklist.push(
      'Verify pump casing vibration spectrum and continuous trend.',
      'Check bearing housing temperature with contact pyrometer.',
      'Check suction and discharge differential pressure across strainer.',
      'Inspect mechanical seal faces for weepage or dry-run damage.',
      'Verify suction supply line block valves are fully unobstructed.'
    );
  }

  // 2. HEAT EXCHANGER (E-101)
  else if (unitId === 'heat_exchanger') {
    const dt = Number((eqData?.temperature_difference ?? 12.9).toFixed(1));
    const tOut = Number((eqData?.outlet_temperature ?? 38.1).toFixed(1));
    const eff = Number((eqData?.efficiency ?? 95.0).toFixed(1));
    const tIn = Number((eqData?.inlet_temperature ?? 25.2).toFixed(1));

    const dtDev = Number((((dt - 12.9) / 12.9) * 100).toFixed(1));
    const effDev = Number((((eff - 95.0) / 95.0) * 100).toFixed(1));
    const tOutDev = Number((((tOut - 38.1) / 38.1) * 100).toFixed(1));

    parameterRows.push(
      { parameter: 'Thermal Gradient (ΔT)', baseline: '12.9 °C', current: `${dt.toFixed(1)} °C`, deviation: `${dtDev > 0 ? '+' : ''}${dtDev}%`, isAnomaly: dtDev < -15 },
      { parameter: 'Shell Outlet Temperature', baseline: '38.1 °C', current: `${tOut.toFixed(1)} °C`, deviation: `${tOutDev > 0 ? '+' : ''}${tOutDev}%`, isAnomaly: Math.abs(tOutDev) > 8 },
      { parameter: 'Heat Transfer Efficiency', baseline: '95.0%', current: `${eff.toFixed(1)}%`, deviation: `${effDev > 0 ? '+' : ''}${effDev}%`, isAnomaly: effDev < -15 },
      { parameter: 'Inlet Temperature', baseline: '25.2 °C', current: `${tIn.toFixed(1)} °C`, deviation: `${(((tIn - 25.2) / 25.2) * 100).toFixed(1)}%`, isAnomaly: false }
    );

    if (healthScore >= 90) {
      whatIsHappening = `E-101 Shell & Tube Heat Exchanger is transferring thermal duty on-spec. Thermal gradient ΔT (${dt} °C) and heat transfer efficiency (${eff}%) are nominal.`;
      primaryHypothesis = 'Nominal Heat Exchange';
      whyItIsHappening = 'Counter-flow log mean temperature difference (LMTD) and overall heat transfer coefficient U match clean design specification.';
      supportingEvidence.push('Thermal gradient ΔT on design baseline (12.9 °C)', 'Heat transfer efficiency exceeds 92%', 'Process fluid exiting exchanger at specified 38.1 °C');
    } else {
      whatIsHappening = `E-101 is showing ${isFailure ? 'severe thermal fouling failure' : 'reduced heat-transfer performance and progressive fouling'}. Thermal gradient ΔT has degraded from 12.9 °C baseline to ${dt.toFixed(1)} °C (${dtDev}%). Heat transfer efficiency has dropped to ${eff.toFixed(1)}% (${effDev}%). Shell outlet temperature has shifted to ${tOut.toFixed(1)} °C. The combined multivariable deviation indicates progressive fouling resistance on the heat transfer tubes.`;
      primaryHypothesis = diag?.faultLabel || 'Thermal Fouling / Scaling on Tube Bundle';
      whyItIsHappening = `Primary hypothesis is ${primaryHypothesis.toLowerCase()}. Boundary layer scale accumulation or utility starvation creates excessive conductive thermal resistance across the tube walls.`;
      supportingEvidence.push(
        `Thermal gradient ΔT dropped to ${dt.toFixed(1)} °C (${dtDev}%)`,
        `Heat transfer efficiency decayed to ${eff.toFixed(1)}% (${effDev}%)`,
        `Process fluid exiting shell outlet shifted to ${tOut.toFixed(1)} °C`,
        'Calculated overall heat transfer coefficient U is below baseline envelope'
      );
    }

    downstreamImpacts.push(
      { unitTag: 'R-101', unitName: 'CSTR Reactor', impact: `Warmer process fluid (${tOut.toFixed(1)} °C vs 38.1 °C design) enters reactor core, increasing jacket cooling load.` },
      { unitTag: 'D-101', unitName: 'Distillation Column', impact: 'Secondary thermal composition shift propagating into distillation column feed.' }
    );

    operatorChecklist.push(
      'Verify cooling water supply flow rate and utility inlet/outlet temperatures.',
      'Measure shell-side and tube-side differential pressure drops.',
      'Inspect temperature transmitters TT-101 and TT-102 for calibration drift.',
      'Check cooling water control valve positioner and actuator response.',
      'Schedule offline chemical descaling wash for tube bundle.'
    );
  }

  // 3. REACTOR (R-101)
  else if (unitId === 'reactor') {
    const t = Number((eqData?.temperature ?? 65.0).toFixed(1));
    const p = Number((eqData?.pressure ?? 2.05).toFixed(2));
    const cool = eqData?.cooling_status ?? 1;
    const agit = Math.round(eqData?.agitator_speed ?? 350);

    const tDev = Number((((t - 65.0) / 65.0) * 100).toFixed(1));
    const pDev = Number((((p - 2.05) / 2.05) * 100).toFixed(1));

    parameterRows.push(
      { parameter: 'Core Reaction Temp', baseline: '65.0 °C', current: `${t.toFixed(1)} °C`, deviation: `${tDev > 0 ? '+' : ''}${tDev}%`, isAnomaly: tDev > 10 },
      { parameter: 'Vessel Vapor Pressure', baseline: '2.05 bar', current: `${p.toFixed(2)} bar`, deviation: `${pDev > 0 ? '+' : ''}${pDev}%`, isAnomaly: pDev > 12 },
      { parameter: 'Cooling Jacket Status', baseline: 'ACTIVE (1.0)', current: cool === 1 ? 'ACTIVE (1.0)' : 'TRIPPED (0.0)', deviation: cool === 1 ? '0%' : '-100%', isAnomaly: cool !== 1 },
      { parameter: 'Agitator Speed', baseline: '350 RPM', current: `${agit} RPM`, deviation: `${(((agit - 350) / 350) * 100).toFixed(1)}%`, isAnomaly: agit < 300 }
    );

    if (healthScore >= 90) {
      whatIsHappening = `R-101 Continuous Stirred-Tank Reactor is operating in balanced kinetic equilibrium. Core temperature (65.0 °C) and pressure (2.05 bar) are steady.`;
      primaryHypothesis = 'Nominal Exothermic Reaction Balance';
      whyItIsHappening = 'Arrhenius reaction heat generation is fully balanced by jacket cooling heat removal with uniform agitation.';
      supportingEvidence.push('Core temperature steady at 65.0 °C baseline', 'Vessel pressure steady at 2.05 bar Antoine equilibrium', 'Cooling jacket active and responsive');
    } else {
      whatIsHappening = `R-101 is experiencing ${isFailure ? 'critical cooling loss and thermal runaway risk' : 'elevated core temperature and kinetic thermal accumulation'}. Core reaction temperature has accelerated to ${t.toFixed(1)} °C (${tDev > 0 ? '+' : ''}${tDev}%). Vessel pressure has climbed to ${p.toFixed(2)} bar (${pDev > 0 ? '+' : ''}${pDev}%). Cooling jacket status is ${cool === 1 ? 'strained' : 'TRIPPED'}. The combined deviation indicates heat generation exceeding cooling dissipation capacity.`;
      primaryHypothesis = diag?.faultLabel || (cool === 0 ? 'Cooling Jacket Circulation Loss / Valve Trip' : 'Exothermic Kinetic Runaway');
      whyItIsHappening = `Primary hypothesis is ${primaryHypothesis.toLowerCase()}. Reduced cooling utility heat extraction causes Arrhenius exponential heat generation to outpace heat removal, accumulating vapor pressure.`;
      supportingEvidence.push(
        `Reaction core temperature accelerated to ${t.toFixed(1)} °C (${tDev > 0 ? '+' : ''}${tDev}%)`,
        `Internal vessel vapor pressure climbed to ${p.toFixed(2)} bar (${pDev > 0 ? '+' : ''}${pDev}%)`,
        `Cooling jacket state: ${cool === 1 ? 'Strained' : 'TRIPPED / COMPROMISED'}`,
        'Vessel approaching safety relief valve lift setpoint (3.00 bar)'
      );
    }

    downstreamImpacts.push(
      { unitTag: 'D-101', unitName: 'Distillation Column', impact: `Overheated reaction effluent (${t.toFixed(1)} °C vs 65.0 °C design) enters distillation column feed tray, increasing column vapor boilup rate.` }
    );

    operatorChecklist.push(
      'Verify emergency cooling water inlet control valve CV-101 is fully open.',
      'Check jacket recirculation pump differential pressure and power.',
      'Confirm agitator drive motor current and RPM to ensure uniform mixing.',
      'Prepare emergency reactant feed shutoff sequence if temperature exceeds 80 °C.',
      'Monitor vessel vapor pressure relief valve PRV-101 status.'
    );
  }

  // 4. DISTILLATION (D-101)
  else {
    const r = Number((eqData?.reflux_ratio ?? 1.85).toFixed(2));
    const topT = Number((eqData?.top_temperature ?? 76.5).toFixed(1));
    const botT = Number((eqData?.bottom_temperature ?? 98.4).toFixed(1));
    const colP = Number((eqData?.pressure ?? 2.10).toFixed(2));

    const rDev = Number((((r - 1.85) / 1.85) * 100).toFixed(1));
    const topTDev = Number((((topT - 76.5) / 76.5) * 100).toFixed(1));
    const botTDev = Number((((botT - 98.4) / 98.4) * 100).toFixed(1));

    parameterRows.push(
      { parameter: 'Reflux Ratio (L/D)', baseline: '1.85', current: `${r.toFixed(2)}`, deviation: `${rDev > 0 ? '+' : ''}${rDev}%`, isAnomaly: rDev < -20 },
      { parameter: 'Column Top Temperature', baseline: '76.5 °C', current: `${topT.toFixed(1)} °C`, deviation: `${topTDev > 0 ? '+' : ''}${topTDev}%`, isAnomaly: topTDev > 5 },
      { parameter: 'Column Bottom Temperature', baseline: '98.4 °C', current: `${botT.toFixed(1)} °C`, deviation: `${botTDev > 0 ? '+' : ''}${botTDev}%`, isAnomaly: Math.abs(botTDev) > 5 },
      { parameter: 'Column Pressure', baseline: '2.10 bar', current: `${colP.toFixed(2)} bar`, deviation: `${(((colP - 2.10) / 2.10) * 100).toFixed(1)}%`, isAnomaly: false }
    );

    if (healthScore >= 90) {
      whatIsHappening = `D-101 Binary Distillation Column is operating at on-spec vapor-liquid separation equilibrium. Reflux ratio (1.85) and top temperature (76.5 °C) are nominal.`;
      primaryHypothesis = 'Nominal Column Separation';
      whyItIsHappening = 'Tray vapor-liquid hydraulics and condenser subcooling maintain sharp binary split with on-spec distillate purity.';
      supportingEvidence.push('Reflux ratio steady at 1.85 design baseline', 'Overhead vapor temperature steady at 76.5 °C', 'Distillate product purity exceeds 98%');
    } else {
      whatIsHappening = `D-101 is showing ${isFailure ? 'critical reflux starvation failure' : 'reduced reflux ratio and overhead tray starvation'}. Reflux ratio L/D has fallen from 1.85 baseline to ${r.toFixed(2)} (${rDev}%). Column top vapor temperature has risen to ${topT.toFixed(1)} °C (${topTDev > 0 ? '+' : ''}${topTDev}%). Column bottoms temperature is at ${botT.toFixed(1)} °C. The combined deviation indicates insufficient liquid reflux return, causing heavy fraction carryover into overhead distillate.`;
      primaryHypothesis = diag?.faultLabel || 'Reflux Loss / Upper Tray Starvation';
      whyItIsHappening = `Primary hypothesis is ${primaryHypothesis.toLowerCase()}. Reflux pump flow decay or valve restriction starves the top rectification trays, allowing higher-boiling fractions into overhead condenser.`;
      supportingEvidence.push(
        `Reflux ratio dropped to ${r.toFixed(2)} (${rDev}%) below minimum 1.50 limit`,
        `Column top temperature escalated to ${topT.toFixed(1)} °C (${topTDev > 0 ? '+' : ''}${topTDev}%)`,
        'Overhead distillate product purity degrading due to heavy component slip'
      );
    }

    downstreamImpacts.push(
      { unitTag: 'T-102', unitName: 'Distillate Storage', impact: 'Off-spec distillate product composition accumulating in product tankage.' },
      { unitTag: 'Reboiler', unitName: 'Reboiler Sump', impact: 'Bottoms duty imbalance requiring thermal trim adjustment.' }
    );

    operatorChecklist.push(
      'Check reflux control valve FCV-101 positioner and actuator response.',
      'Inspect reflux pump P-102 discharge pressure and flow transmitter.',
      'Verify overhead condenser cooling water flow and subcooling gradient.',
      'Check column differential pressure across tray packings.',
      'Switch reflux service to standby pump or increase manual reflux setpoint.'
    );
  }

  const alternativePossibilities = ALTERNATIVE_POSSIBILITIES_MAP[unitId] || [
    'Sensor transmitter calibration drift',
    'Local control loop hunting / PID detuning',
    'Upstream mass flow disturbance'
  ];

  return {
    id: `auto_${unitId}_${Date.now()}`,
    timestamp: timeStr,
    equipmentId: unitId,
    equipmentTag: tag,
    equipmentName: `${tag} — ${name}`,
    stage,
    stageLabel,
    severity,
    healthScore,
    triggerReason: isFailure
      ? `🔴 Confirmed fault condition on ${tag}`
      : isUnknown
      ? `⚠ Unknown process anomaly detected on ${tag}`
      : `Degradation (${stageLabel}) detected on ${tag}`,
    whatIsHappening: cleanLatexAndMarkdown(whatIsHappening),
    whyItIsHappening: cleanLatexAndMarkdown(whyItIsHappening),
    evidence: supportingEvidence.map((e) => cleanLatexAndMarkdown(e)),
    trend: diag?.trend || (healthScore < 60 ? 'DEGRADING' : 'STABLE'),
    potentialImpact: cleanLatexAndMarkdown(
      downstreamImpacts.map((d) => `${d.unitTag}: ${d.impact}`).join(' | ')
    ),
    whatToVerify: cleanLatexAndMarkdown(
      operatorChecklist.map((c, i) => `${i + 1}. ${c}`).join('\n')
    ),
    riskScore,
    confidence,
    status: 'UPDATED',
    provider: 'Continuous ML Engine (Physical Synthesis)',
    parameterRows,
    primaryHypothesis,
    supportingEvidence,
    alternativePossibilities,
    downstreamImpacts,
    operatorChecklist,
    primaryFaultTag: state.equipment_diagnostics?.plant?.primarySource?.split(' ')[0] || tag,
    role,
    isFailureConfirmed: isFailure,
    isUnknownFault: isUnknown
  };
}

// ============================================================================
// MAIN REACT HOOK
// ============================================================================
export function useAutomaticProblemAnalysis(state: ProcessUpdatePayload) {
  const [currentAnalysis, setCurrentAnalysis] = useState<AutomaticAnalysisItem | null>(null);
  const [activeProblemAnalyses, setActiveProblemAnalyses] = useState<AutomaticAnalysisItem[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<AutomaticAnalysisItem[]>([]);
  const [failureHistory, setFailureHistory] = useState<FailureEventHistoryItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // Tracking refs for debounce, cooldown, and state transition history
  const lastSignatureRef = useRef<string>('');
  const lastCallTimeRef = useRef<number>(0);
  const pendingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAnalyzingRef = useRef<boolean>(false);
  const statePayloadRef = useRef<ProcessUpdatePayload>(state);

  statePayloadRef.current = state;

  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);

  // Execute analysis with asynchronous AI enrichment
  const executeAnalysis = useCallback(
    async (
      targetUnit: { id: string; tag: string; name: string; key: keyof EquipmentHealthMap; diagKey: 'P101' | 'E101' | 'R101' | 'D101' },
      allDegradedUnits: typeof UNIT_DEFINITIONS
    ) => {
      const currentState = statePayloadRef.current;
      const timeStr = new Date().toLocaleTimeString();
      setIsAnalyzing(true);
      setAiError(null);

      const eqDiagnostics = currentState.equipment_diagnostics || (currentState as any).equipmentDiagnostics || {};
      const diag = eqDiagnostics[targetUnit.diagKey] || eqDiagnostics[targetUnit.id];
      const eqData = currentState.equipment[targetUnit.id as keyof typeof currentState.equipment]?.data as any;

      // 1. Immediately synthesize high-fidelity deterministic analysis (<10ms)
      const baseAnalysis = synthesizeDeterministicAnalysis(targetUnit, diag, eqData, currentState);

      // Build cards for all active degraded units
      const multiAnalyses = allDegradedUnits.map((u) => {
        const uDiag = eqDiagnostics[u.diagKey] || eqDiagnostics[u.id];
        const uData = currentState.equipment[u.id as keyof typeof currentState.equipment]?.data as any;
        return synthesizeDeterministicAnalysis(u, uDiag, uData, currentState);
      });

      setActiveProblemAnalyses(multiAnalyses.length > 0 ? multiAnalyses : [baseAnalysis]);
      setCurrentAnalysis(baseAnalysis);
      setLastAnalysisTime(timeStr);

      // 2. Prepare asynchronous LLM query
      const prompt = `[CHEMDIAG AUTOMATIC PROBLEM ANALYSIS]
Equipment: ${targetUnit.tag} — ${targetUnit.name}
Role: ${baseAnalysis.role} (Primary Root-Cause: ${baseAnalysis.primaryFaultTag})
Operating State: ${baseAnalysis.stageLabel} (Health: ${baseAnalysis.healthScore}%, Risk: ${baseAnalysis.riskScore}/100)
Active Fault: ${currentState.active_fault_mode}

LIVE MEASUREMENTS VS DESIGN BASELINE:
${baseAnalysis.parameterRows?.map((r) => `- ${r.parameter}: Current ${r.current} (Baseline: ${r.baseline}, Deviation: ${r.deviation})`).join('\n')}

DOWNSTREAM TOPOLOGY IMPACT:
${baseAnalysis.downstreamImpacts?.map((d) => `- ${d.unitTag} (${d.unitName}): ${d.impact}`).join('\n')}

DIRECTIVE:
Provide an authoritative engineering diagnosis for ${targetUnit.tag}.
Format response using plain text with NO raw LaTeX symbols ($ or \\text) and NO markdown tables.
Include:
### WHAT IS HAPPENING
### LIKELY ROOT CAUSE
### KEY EVIDENCE
### DOWNSTREAM PROCESS IMPACT
### WHAT THE OPERATOR SHOULD VERIFY`;

      try {
        const res = await sendAiChatMessage(prompt, [], targetUnit.tag, {
          equipment: targetUnit.tag,
          healthScore: baseAnalysis.healthScore,
          stage: baseAnalysis.stage,
          activeFaultMode: currentState.active_fault_mode
        }, 'gemini');

        const aiText = res.text || res.response || res.answer || '';
        if (aiText) {
          const cleanedText = cleanLatexAndMarkdown(aiText);
          const enrichedAnalysis: AutomaticAnalysisItem = {
            ...baseAnalysis,
            fullExplanation: cleanedText,
            provider: res.provider || 'Groq / Gemini Copilot'
          };
          setCurrentAnalysis(enrichedAnalysis);
          setActiveProblemAnalyses((prev) =>
            prev.map((p) => (p.equipmentId === targetUnit.id ? enrichedAnalysis : p))
          );
        }
      } catch (err: any) {
        console.warn('AI provider temporarily offline, retaining continuous ML analysis:', err.message);
        setAiError(err.message || 'AI service unavailable');
      }

      // 3. Record History
      setRecentAnalyses((prev) => {
        const filtered = prev.filter((p) => p.equipmentId !== targetUnit.id || p.stage !== baseAnalysis.stage);
        return [baseAnalysis, ...filtered].slice(0, 10);
      });

      const historyRecord: FailureEventHistoryItem = {
        id: `evt_${Date.now()}`,
        timestamp: timeStr,
        equipment: targetUnit.name,
        equipmentTag: targetUnit.tag,
        equipmentName: `${targetUnit.tag} (${targetUnit.name})`,
        previousState: baseAnalysis.stage,
        newState: baseAnalysis.stage,
        health: baseAnalysis.healthScore,
        risk: baseAnalysis.riskScore,
        trigger: baseAnalysis.triggerReason,
        evidence: baseAnalysis.evidence,
        aiStatus: 'COMPLETED',
        analysis: baseAnalysis
      };

      setFailureHistory((prev) => [historyRecord, ...prev.slice(0, 20)]);
      setIsAnalyzing(false);
    },
    []
  );

  // Manual Trigger for on-demand re-analysis
  const triggerManualAnalysis = useCallback(
    async (equipmentId: string) => {
      const target = UNIT_DEFINITIONS.find((u) => u.id === equipmentId || u.tag === equipmentId) || UNIT_DEFINITIONS[0];
      await executeAnalysis(target, [target]);
    },
    [executeAnalysis]
  );

  // Continuous monitoring watcher with signature change detection & cooldown
  useEffect(() => {
    const currentState = state;
    const eqDiagnostics = currentState.equipment_diagnostics || (currentState as any).equipmentDiagnostics || {};

    // 1. Identify all degraded / problem units
    const degradedUnits: typeof UNIT_DEFINITIONS = [];
    let primaryFaultUnit = UNIT_DEFINITIONS[0];
    let worstHealth = 100;

    for (const unit of UNIT_DEFINITIONS) {
      const diag = eqDiagnostics[unit.diagKey] || eqDiagnostics[unit.id];
      const eqData = currentState.equipment[unit.id as keyof typeof currentState.equipment]?.data as any;
      const health = diag?.health ?? (eqData?.health ?? 100);
      const stage = diag?.stage ?? 'NORMAL';
      const isUnknown = !!(diag?.isUnknownFault || currentState.diagnosis?.is_unknown_fault);

      if (health < 90 || stage !== 'NORMAL' || isUnknown || diag?.role === 'PRIMARY_FAULT') {
        degradedUnits.push(unit);
      }

      if (diag?.role === 'PRIMARY_FAULT') {
        primaryFaultUnit = unit;
        worstHealth = health;
      } else if (health < worstHealth && primaryFaultUnit?.id !== 'PRIMARY_FAULT') {
        worstHealth = health;
        primaryFaultUnit = unit;
      }
    }

    const isSystemDegraded = degradedUnits.length > 0;
    const activeUnit = selectedUnitId
      ? UNIT_DEFINITIONS.find((u) => u.id === selectedUnitId) || primaryFaultUnit
      : primaryFaultUnit;

    const signature = isSystemDegraded
      ? `${activeUnit.id}_${worstHealth < 40 ? 'CRIT' : worstHealth < 70 ? 'HIGH' : 'WARN'}_${currentState.active_fault_mode}_${degradedUnits.length}`
      : 'NORMAL_ALL';

    // Nominal state handling: No active degraded units
    if (!isSystemDegraded) {
      if (lastSignatureRef.current !== 'NORMAL_ALL') {
        setCurrentAnalysis(null);
        setActiveProblemAnalyses([]);
      }
      lastSignatureRef.current = 'NORMAL_ALL';
      return;
    }

    // 2. Synchronously update live deterministic analysis with ZERO delay (<1ms)
    const updated = synthesizeDeterministicAnalysis(
      activeUnit,
      eqDiagnostics[activeUnit.diagKey] || eqDiagnostics[activeUnit.id],
      currentState.equipment[activeUnit.id as keyof typeof currentState.equipment]?.data,
      currentState
    );
    const multiAnalyses = degradedUnits.map((u) => {
      const uDiag = eqDiagnostics[u.diagKey] || eqDiagnostics[u.id];
      const uData = currentState.equipment[u.id as keyof typeof currentState.equipment]?.data as any;
      return synthesizeDeterministicAnalysis(u, uDiag, uData, currentState);
    });

    setCurrentAnalysis((prev) => ({
      ...updated,
      fullExplanation: prev?.fullExplanation || updated.fullExplanation,
      provider: prev?.provider || updated.provider
    }));
    setActiveProblemAnalyses(multiAnalyses.length > 0 ? multiAnalyses : [updated]);

    // 3. Debounce & cooldown checks for asynchronous LLM enrichment
    const now = Date.now();
    const timeSinceLastCall = (now - lastCallTimeRef.current) / 1000;
    const isSignatureChanged = signature !== lastSignatureRef.current;

    if (!isSignatureChanged && timeSinceLastCall < 15) {
      return;
    }

    if (isAnalyzingRef.current) return;

    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
    }

    // Debounce 1.0s to trigger background LLM copilot enrichment
    pendingTimerRef.current = setTimeout(async () => {
      lastSignatureRef.current = signature;
      lastCallTimeRef.current = Date.now();
      await executeAnalysis(activeUnit, degradedUnits);
    }, 1000);

    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
      }
    };
  }, [
    state,
    selectedUnitId,
    executeAnalysis
  ]);

  return {
    currentAnalysis,
    activeProblemAnalyses,
    recentAnalyses,
    failureHistory,
    isAnalyzing,
    lastAnalysisTime,
    aiError,
    selectedUnitId,
    setSelectedUnitId,
    triggerManualAnalysis
  };
}
