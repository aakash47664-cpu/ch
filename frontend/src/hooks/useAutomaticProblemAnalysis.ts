import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ProcessUpdatePayload,
  AutomaticAnalysisItem,
  EquipmentHealthItem,
  EquipmentHealthMap,
  FailureEventHistoryItem
} from '../types';
import { sendAiChatMessage } from '../services/api';

export function useAutomaticProblemAnalysis(state: ProcessUpdatePayload) {
  const [currentAnalysis, setCurrentAnalysis] = useState<AutomaticAnalysisItem | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<AutomaticAnalysisItem[]>([]);
  const [failureHistory, setFailureHistory] = useState<FailureEventHistoryItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Tracking refs for debounce, cooldown, and state transition history
  const lastSignatureRef = useRef<string>('');
  const lastStateRef = useRef<string>('NORMAL');
  const lastCallTimeRef = useRef<number>(0);
  const pendingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAnalyzingRef = useRef<boolean>(false);
  const statePayloadRef = useRef<ProcessUpdatePayload>(state);

  // Keep statePayloadRef current
  statePayloadRef.current = state;

  // Synchronize isAnalyzing ref
  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);

  // Core Analysis Execution Function
  const executeAnalysis = useCallback(
    async (
      targetUnit: { id: string; key: keyof EquipmentHealthMap; tag: string; name: string },
      healthItem: EquipmentHealthItem | undefined,
      healthScore: number,
      stage: string,
      prevState: string,
      isUnknown: boolean
    ) => {
      const currentState = statePayloadRef.current;
      const timeStr = new Date().toLocaleTimeString();
      setIsAnalyzing(true);
      setAiError(null);

      // 1. Extract live sensor telemetry vs design baseline
      const eqData = currentState.equipment[targetUnit.id as keyof typeof currentState.equipment]?.data as any;
      const metrics = healthItem?.metrics || {};

      const metricLines: string[] = [];
      if (Object.keys(metrics).length > 0) {
        for (const m of Object.values(metrics) as any[]) {
          metricLines.push(
            `- ${m.name}: Current ${m.current} ${m.unit} (Baseline: ${m.baseline} ${m.unit}, Deviation: ${m.deltaPercent > 0 ? '+' : ''}${m.deltaPercent}%, Trend: ${m.trend})`
          );
        }
      } else {
        // Fallback metric extraction based on unit type
        if (targetUnit.id === 'pump') {
          const rpm = Math.round(eqData?.rpm || 2450);
          const vib = (eqData?.vibration || 0.08).toFixed(2);
          const flow = (eqData?.flow || 10.0).toFixed(1);
          metricLines.push(`- Rotational Speed: ${rpm} RPM (Baseline: 2450 RPM, Dev: ${(((rpm - 2450) / 2450) * 100).toFixed(1)}%)`);
          metricLines.push(`- Casing Vibration: ${vib} g (Baseline: 0.08 g, Dev: ${(((Number(vib) - 0.08) / 0.08) * 100).toFixed(1)}%)`);
          metricLines.push(`- Calculated Flow: ${flow} L/min (Baseline: 10.0 L/min, Dev: ${(((Number(flow) - 10) / 10) * 100).toFixed(1)}%)`);
        } else if (targetUnit.id === 'heat_exchanger') {
          const dt = (eqData?.temperature_difference || 12.9).toFixed(1);
          const eff = (eqData?.efficiency ?? 95).toFixed(0);
          metricLines.push(`- Thermal Gradient (ΔT): ${dt} °C (Baseline: 12.9 °C, Dev: ${(((Number(dt) - 12.9) / 12.9) * 100).toFixed(1)}%)`);
          metricLines.push(`- Heat Transfer Eff: ${eff}% (Baseline: 95.0%)`);
        } else if (targetUnit.id === 'reactor') {
          const t = (eqData?.temperature || 65.0).toFixed(1);
          const p = (eqData?.pressure || 2.05).toFixed(2);
          metricLines.push(`- Core Temperature: ${t} °C (Baseline: 65.0 °C, Dev: ${(((Number(t) - 65.0) / 65.0) * 100).toFixed(1)}%)`);
          metricLines.push(`- Vessel Pressure: ${p} bar (Baseline: 2.05 bar, Dev: ${(((Number(p) - 2.05) / 2.05) * 100).toFixed(1)}%)`);
          metricLines.push(`- Cooling Jacket: ${eqData?.cooling_status === 1 ? 'ACTIVE' : 'TRIPPED (0)'}`);
        } else if (targetUnit.id === 'distillation') {
          const r = (eqData?.reflux_ratio || 1.85).toFixed(2);
          const topT = (eqData?.top_temperature || 76.5).toFixed(1);
          metricLines.push(`- Reflux Ratio: ${r} (Baseline: 1.85, Dev: ${(((Number(r) - 1.85) / 1.85) * 100).toFixed(1)}%)`);
          metricLines.push(`- Top Temperature: ${topT} °C (Baseline: 76.5 °C, Dev: ${(((Number(topT) - 76.5) / 76.5) * 100).toFixed(1)}%)`);
        }
      }

      // 2. Downstream Aspen Mass & Energy Flow Propagation
      const causalConsequences = currentState.causal_propagation?.downstreamConsequences || [];
      const consequencesText =
        causalConsequences.length > 0
          ? causalConsequences.map((c) => `${c.unit}: ${c.impact}`).join('; ')
          : 'Downstream units monitoring for secondary thermal/flow changes.';

      // 3. Sensor Reliability & Hardware Status
      const sensorStatus = currentState.esp32_status.connected
        ? 'REAL HARDWARE STREAM (ESP32 Online & Validated)'
        : 'SIMULATED DATA (Dynamic Aspen Model Validated)';

      const riskScore = currentState.diagnosis.preventive?.riskScore ?? Math.round(100 - healthScore);
      const isFailureConfirmed = stage === 'FAULT_CONFIRMED' || healthScore < 30;

      // 4. Construct Prompt
      const prompt = `[CHEMDIAG AUTOMATIC FAILURE & EARLY-FAULT ROOT-CAUSE ANALYSIS]
Target Equipment: ${targetUnit.tag} — ${targetUnit.name}
Operating State: ${healthItem?.label || stage} (Health Score: ${healthScore}%)
Failure Status: ${isFailureConfirmed ? 'CRITICAL FAILURE DETECTED' : 'DEGRADATION / EARLY WARNING'}
Timestamp: ${timeStr}
Active Plant Fault Mode: ${currentState.active_fault_mode}
Risk Score: ${riskScore}/100
Sensor Reliability: ${sensorStatus}
${isUnknown ? 'FAULT CLASSIFICATION: UNKNOWN / NOVEL ANOMALY PATTERN\n' : ''}

EXACT LIVE MEASUREMENTS VS DESIGN BASELINE:
${metricLines.join('\n')}

DOWNSTREAM PROCESS INTERACTIONS:
${consequencesText}

DIRECTIVE:
Provide an immediate, authoritative chemical-engineering failure analysis for ${targetUnit.tag}.
Reference the exact live values above without inventing numbers.
${isUnknown ? 'NOTE: Since this is an UNKNOWN FAULT, explain why the sensor pattern is ambiguous, what hypotheses exist, and why forcing a known classification would be unsafe.' : ''}

Format your response with these EXACT section headers:
### WHAT HAPPENED
### LIKELY ROOT CAUSE
### KEY EVIDENCE
### BASELINE → CURRENT
### DOWNSTREAM PROCESS IMPACT
### RISK ASSESSMENT
### WHAT TO VERIFY`;

      const processContext = {
        equipment: targetUnit.tag,
        healthScore,
        stage,
        metrics,
        activeFaultMode: currentState.active_fault_mode,
        isUnknownFault: isUnknown,
        causalChain: currentState.causal_propagation
      };

      // 5. Call existing AI asynchronously
      let aiText = '';
      let aiProvider = 'Gemini';
      try {
        const res = await sendAiChatMessage(prompt, [], targetUnit.tag, processContext, 'gemini');
        aiText = res.text || res.response || res.answer || '';
        aiProvider = res.provider || 'Gemini';
      } catch (err: any) {
        console.warn('Automatic AI query offline, using deterministic rule fallback:', err.message);
        setAiError(err.message || 'AI service unavailable');
        aiText = generateFallbackExplanation(targetUnit.id, stage, healthScore, eqData, isUnknown);
        aiProvider = 'Deterministic Engine';
      }

      // 6. Parse structured sections
      const parsed = parseAiExplanation(aiText, targetUnit.id, stage, healthScore, eqData, isUnknown);

      const newAnalysisItem: AutomaticAnalysisItem = {
        id: `auto_${Date.now()}`,
        timestamp: timeStr,
        equipmentId: targetUnit.id,
        equipmentName: `${targetUnit.tag} (${targetUnit.name})`,
        stage,
        stageLabel: healthItem?.label || stage,
        severity: isFailureConfirmed ? 'CRITICAL' : healthScore < 50 ? 'HIGH' : 'MEDIUM',
        healthScore,
        triggerReason: isFailureConfirmed
          ? `🔴 Confirmed failure trip on ${targetUnit.tag}`
          : isUnknown
          ? `⚠ Unknown process anomaly on ${targetUnit.tag}`
          : `Degradation (${healthItem?.label || stage}) on ${targetUnit.tag}`,
        whatIsHappening: parsed.whatIsHappening,
        whyItIsHappening: parsed.whyItIsHappening,
        evidence: parsed.evidence,
        trend: healthItem?.trend === 'increasing' ? 'Escalating' : healthItem?.trend === 'decreasing' ? 'Decaying' : 'Drifting',
        potentialImpact: parsed.potentialImpact,
        whatToVerify: parsed.whatToVerify,
        riskScore,
        confidence: isUnknown ? 68 : isFailureConfirmed ? 96 : 89,
        status: 'UPDATED',
        fullExplanation: aiText,
        provider: aiProvider,
        baselineComparison: parsed.baselineComparison,
        alternativePossibilities: parsed.alternativePossibilities,
        isFailureConfirmed,
        isUnknownFault: isUnknown
      };

      setCurrentAnalysis(newAnalysisItem);
      setLastAnalysisTime(timeStr);

      setRecentAnalyses((prev) => {
        const filtered = prev.filter((p) => p.equipmentId !== targetUnit.id || p.stage !== stage);
        return [newAnalysisItem, ...filtered].slice(0, 6);
      });

      // 7. Record Chronological Failure Event History
      const historyRecord: FailureEventHistoryItem = {
        id: `evt_${Date.now()}`,
        timestamp: timeStr,
        equipment: targetUnit.name,
        equipmentTag: targetUnit.tag,
        equipmentName: `${targetUnit.tag} (${targetUnit.name})`,
        previousState: prevState,
        newState: stage,
        health: healthScore,
        risk: riskScore,
        trigger: isFailureConfirmed
          ? 'FAILURE_CONFIRMED'
          : isUnknown
          ? 'UNKNOWN_FAULT'
          : 'DEGRADATION_THRESHOLD',
        evidence: parsed.evidence,
        aiStatus: 'COMPLETED',
        analysis: newAnalysisItem
      };

      setFailureHistory((prev) => [historyRecord, ...prev.slice(0, 15)]);
      setIsAnalyzing(false);
    },
    []
  );

  // Manual Trigger for "Analyze with AI" or "Retry Analysis"
  const triggerManualAnalysis = useCallback(
    async (equipmentId: string) => {
      const currentState = statePayloadRef.current;
      const units = [
        { id: 'pump', key: 'pump' as keyof EquipmentHealthMap, tag: 'P-101', name: 'Centrifugal Feed Pump' },
        { id: 'heat_exchanger', key: 'heat_exchanger' as keyof EquipmentHealthMap, tag: 'E-101', name: 'Shell & Tube Exchanger' },
        { id: 'reactor', key: 'reactor' as keyof EquipmentHealthMap, tag: 'R-101', name: 'Exothermic CSTR Reactor' },
        { id: 'distillation', key: 'distillation' as keyof EquipmentHealthMap, tag: 'D-101', name: 'Distillation Column' }
      ];

      const targetUnit = units.find((u) => u.id === equipmentId) || units[0];
      const healthItem = currentState.equipment_health?.[targetUnit.key];
      const healthScore = healthItem?.health ?? 100;
      const stage = healthItem?.stage ?? 'NORMAL';
      const isUnknown = !!currentState.diagnosis.is_unknown_fault;

      await executeAnalysis(targetUnit, healthItem, healthScore, stage, stage, isUnknown);
    },
    [executeAnalysis]
  );

  // Continuous 1 Hz Monitoring Watcher with Debounce & Event-Driven Filter
  useEffect(() => {
    if (!state.equipment_health) return;

    const units: Array<{ id: string; key: keyof EquipmentHealthMap; tag: string; name: string }> = [
      { id: 'pump', key: 'pump', tag: 'P-101', name: 'Centrifugal Feed Pump' },
      { id: 'heat_exchanger', key: 'heat_exchanger', tag: 'E-101', name: 'Shell & Tube Exchanger' },
      { id: 'reactor', key: 'reactor', tag: 'R-101', name: 'Exothermic CSTR Reactor' },
      { id: 'distillation', key: 'distillation', tag: 'D-101', name: 'Distillation Column' }
    ];

    let worstUnit = units[0];
    let worstHealth = 100;
    let worstItem: EquipmentHealthItem | undefined = undefined;

    for (const u of units) {
      const item = state.equipment_health[u.key];
      const h = item?.health ?? 100;
      if (h < worstHealth) {
        worstHealth = h;
        worstUnit = u;
        worstItem = item;
      }
    }

    const currentStage = worstItem?.stage ?? 'NORMAL';
    const isUnknown = !!state.diagnosis.is_unknown_fault;
    const isDegraded = worstHealth < 90 || currentStage !== 'NORMAL' || isUnknown;

    // 1. Signature for change detection:
    // Captures unit, stage, 10% health band, active fault mode, and unknown fault flag
    const signature = isDegraded
      ? `${worstUnit.id}_${currentStage}_${Math.floor(worstHealth / 10) * 10}_${state.active_fault_mode}_${isUnknown}`
      : 'NORMAL_ALL';

    // Nominal State
    if (!isDegraded) {
      if (lastSignatureRef.current !== 'NORMAL_ALL' && !currentAnalysis) {
        const nominalItem: AutomaticAnalysisItem = {
          id: `nom_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          equipmentId: 'all',
          equipmentName: 'Plant Process Train',
          stage: 'NORMAL',
          stageLabel: 'HEALTHY',
          severity: 'NORMAL',
          healthScore: 100,
          triggerReason: 'All monitored variables within nominal design envelopes',
          whatIsHappening: 'The complete chemical process train is operating smoothly within nominal baseline design envelopes.',
          whyItIsHappening: 'Mass and thermal balances across P-101, E-101, R-101, and D-101 are in dynamic equilibrium with zero detectable degradation.',
          evidence: [
            '✓ P-101 speed (2450 RPM) and vibration (<0.10 g) nominal',
            '✓ E-101 heat transfer gradient (ΔT 12.9 °C) on-spec',
            '✓ R-101 Arrhenius exothermic heat balance steady at 65.0 °C',
            '✓ D-101 overhead reflux ratio steady at 1.85 L/D'
          ],
          trend: 'STABLE',
          potentialImpact: 'Zero adverse downstream consequences.',
          whatToVerify: 'Maintain standard routine supervisory monitoring.',
          riskScore: 12,
          confidence: 96,
          status: 'IDLE',
          isFailureConfirmed: false,
          isUnknownFault: false
        };
        setCurrentAnalysis(nominalItem);
      }
      lastSignatureRef.current = 'NORMAL_ALL';
      lastStateRef.current = 'NORMAL';
      return;
    }

    // 2. Debounce & Rate Limiting Check
    const now = Date.now();
    const timeSinceLastCall = (now - lastCallTimeRef.current) / 1000;
    const isSignatureChanged = signature !== lastSignatureRef.current;
    const isFailureTransition = currentStage === 'FAULT_CONFIRMED' && lastStateRef.current !== 'FAULT_CONFIRMED';

    // Critical transitions trigger with higher urgency
    const cooldownLimit = isFailureTransition ? 8 : 20;

    if (!isSignatureChanged && timeSinceLastCall < cooldownLimit) {
      return;
    }

    if (isAnalyzingRef.current) {
      return;
    }

    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
    }

    const prevState = lastStateRef.current;

    // 3. Debounce 1.2s to confirm persistence before triggering AI
    pendingTimerRef.current = setTimeout(async () => {
      lastSignatureRef.current = signature;
      lastStateRef.current = currentStage;
      lastCallTimeRef.current = Date.now();

      await executeAnalysis(worstUnit, worstItem, worstHealth, currentStage, prevState, isUnknown);
    }, 1200);

    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
      }
    };
  }, [
    state.equipment_health,
    state.active_fault_mode,
    state.early_warnings,
    state.diagnosis.is_unknown_fault,
    executeAnalysis
  ]);

  return {
    currentAnalysis,
    recentAnalyses,
    failureHistory,
    isAnalyzing,
    lastAnalysisTime,
    aiError,
    triggerManualAnalysis
  };
}

// Fallback explanation generator if API is offline
function generateFallbackExplanation(
  unitId: string,
  stage: string,
  health: number,
  eqData: any,
  isUnknown: boolean
) {
  if (isUnknown) {
    return `### WHAT HAPPENED
An unclassified anomalous multidimensional vector shift was detected across process instrumentation.

### LIKELY ROOT CAUSE
Uncertain / Complex Multi-Variable Deviation. The observed symptom correlation does not match standard single-fault signatures (e.g. pure pump cavitation or pure exchanger fouling).

### KEY EVIDENCE
- Multi-sensor reading deviation exceeds statistical noise envelope
- Cross-correlation coefficient divergence from historical baseline
- Uncharacterized coupling between thermal gradient and hydraulic pressure

### BASELINE → CURRENT
Process parameters exhibiting non-linear covariance shifts differing from nominal design models.

### DOWNSTREAM PROCESS IMPACT
Secondary disturbances propagating into downstream reaction kinetics and distillation separation trays.

### RISK ASSESSMENT
ELEVATED UNCERTAINTY (Risk: ${Math.round(100 - health)}/100). Forcing an unverified diagnosis without physical inspection is unsafe.

### WHAT TO VERIFY
1. Cross-check redundant physical transmitters against software readings.
2. Verify electrical loop power and analog-to-digital ground references.
3. Conduct physical visual inspection of mechanical seals and manual block valves.`;
  }

  if (unitId === 'pump') {
    return `### WHAT HAPPENED
Centrifugal pump P-101 casing vibration has escalated to ${(eqData?.vibration || 0.65).toFixed(2)} g with rotational speed slipping to ${Math.round(eqData?.rpm || 1578)} RPM and discharge flow dropping to ${(eqData?.flow || 6.4).toFixed(1)} L/min.

### LIKELY ROOT CAUSE
Mechanical bearing degradation / severe cavitation inducing rotational slip and high-frequency hydraulic harmonics.

### KEY EVIDENCE
- Casing vibration magnitude elevated (+${Math.round(((eqData?.vibration || 0.65) - 0.08) / 0.08 * 100)}% from baseline)
- Motor shaft speed reduced by ${Math.round(((2450 - (eqData?.rpm || 1578)) / 2450) * 100)}%
- Hydraulic discharge volumetric flow decaying in alignment with Affinity Laws

### BASELINE → CURRENT
Speed: 2450 RPM → ${Math.round(eqData?.rpm || 1578)} RPM | Vibration: 0.08 g → ${(eqData?.vibration || 0.65).toFixed(2)} g | Flow: 10.0 L/min → ${(eqData?.flow || 6.4).toFixed(1)} L/min

### DOWNSTREAM PROCESS IMPACT
Reduced feed delivery stream starves Heat Exchanger E-101 and extends reactant residence time in CSTR Reactor R-101.

### RISK ASSESSMENT
CRITICAL (Risk: ${Math.round(100 - health)}/100). Imminent risk of shaft seizure, seal breach, or motor overcurrent trip.

### WHAT TO VERIFY
1. Inspect motor bearing temperature with contact pyrometer.
2. Check suction line differential pressure across strainer.
3. Switch feed service to standby pump P-102 if available.`;
  }

  if (unitId === 'heat_exchanger') {
    return `### WHAT HAPPENED
Counter-flow exchanger E-101 thermal gradient ΔT has degraded to ${(eqData?.temperature_difference || 6.5).toFixed(1)} °C with heat transfer efficiency dropping to ${Math.round(eqData?.efficiency || 55)}%.

### LIKELY ROOT CAUSE
Progressive internal tube scaling and boundary layer fouling creating excessive conductive thermal resistance.

### KEY EVIDENCE
- Exchanger thermal gradient ΔT dropped from nominal 12.9 °C
- Heat transfer coefficient efficiency decay
- Warmer process fluid exiting shell outlet into reactor

### BASELINE → CURRENT
ΔT: 12.9 °C → ${(eqData?.temperature_difference || 6.5).toFixed(1)} °C | Efficiency: 95% → ${Math.round(eqData?.efficiency || 55)}%

### DOWNSTREAM PROCESS IMPACT
Elevated reactant enthalpy entering CSTR Reactor R-101 increases cooling jacket dissipation burden.

### RISK ASSESSMENT
HIGH RISK (Risk: ${Math.round(100 - health)}/100). Thermal energy accumulation in downstream reaction vessel.

### WHAT TO VERIFY
1. Check cooling utility water flow rate and supply temperature.
2. Measure shell/tube differential pressure drop.
3. Schedule offline chemical descaling wash.`;
  }

  if (unitId === 'reactor') {
    return `### WHAT HAPPENED
Exothermic CSTR R-101 core reaction temperature has climbed to ${(eqData?.temperature || 78.5).toFixed(1)} °C with internal vessel pressure reaching ${(eqData?.pressure || 2.55).toFixed(2)} bar.

### LIKELY ROOT CAUSE
Cooling jacket circulation loss or valve trip allowing Arrhenius heat generation rate to exceed dissipation capacity.

### KEY EVIDENCE
- Reactor core temperature accelerating above 65.0 °C baseline
- Vessel vapor pressure accumulating in dynamic Antoine equilibrium
- Cooling jacket status compromised

### BASELINE → CURRENT
Temp: 65.0 °C → ${(eqData?.temperature || 78.5).toFixed(1)} °C | Pressure: 2.05 bar → ${(eqData?.pressure || 2.55).toFixed(2)} bar | Cooling: 1 → ${eqData?.cooling_status ?? 0}

### DOWNSTREAM PROCESS IMPACT
Overheated reaction mixture flowing into Distillation Column D-101 disrupts tray vapor-liquid equilibrium; vessel approaching relief valve lift threshold.

### RISK ASSESSMENT
CRITICAL (Risk: ${Math.round(100 - health)}/100). Imminent thermal runaway risk if jacket cooling is not restored.

### WHAT TO VERIFY
1. Verify emergency cooling water inlet control valve status.
2. Check jacket recirculation pump operation.
3. Prepare emergency reactant feed shutoff sequence.`;
  }

  // distillation
  return `### WHAT HAPPENED
Distillation column D-101 reflux ratio has dropped to ${(eqData?.reflux_ratio || 1.15).toFixed(2)} with top vapor temperature rising to ${(eqData?.top_temperature || 83.5).toFixed(1)} °C.

### LIKELY ROOT CAUSE
Reflux liquid pump head decay causing tray starvation and heavy fraction vapor carryover.

### KEY EVIDENCE
- Reflux ratio L/D below minimum design threshold of 1.50
- Overhead distillate vapor temperature escalating
- Column top vapor-liquid equilibrium balance shifted

### BASELINE → CURRENT
Reflux: 1.85 → ${(eqData?.reflux_ratio || 1.15).toFixed(2)} | Top Temp: 76.5 °C → ${(eqData?.top_temperature || 83.5).toFixed(1)} °C

### DOWNSTREAM PROCESS IMPACT
Top distillate product contaminated with heavy component carryover; reboiler utility duty imbalance.

### RISK ASSESSMENT
HIGH RISK (Risk: ${Math.round(100 - health)}/100). Off-spec product contamination and downstream tankage contamination.

### WHAT TO VERIFY
1. Check reflux control valve actuator and positioner.
2. Inspect overhead condenser cooling water flow.
3. Increase reflux pump speed or switch to standby unit.`;
}

// Parser for structured sections
function parseAiExplanation(
  text: string,
  unitId: string,
  stage: string,
  health: number,
  eqData: any,
  isUnknown: boolean
) {
  let whatIsHappening = '';
  let whyItIsHappening = '';
  const evidence: string[] = [];
  let baselineComparison = '';
  let potentialImpact = '';
  let whatToVerify = '';
  const alternativePossibilities: string[] = [];

  const lines = text.split('\n');
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (/WHAT HAPPENED|WHAT IS HAPPENING/i.test(trimmed)) {
      currentSection = 'what';
      const clean = trimmed.replace(/(?:###|##|\*\*|WHAT HAPPENED|WHAT IS HAPPENING|:|\*)/gi, '').trim();
      if (clean) whatIsHappening = clean;
    } else if (/LIKELY ROOT CAUSE|LIKELY CAUSE|WHY IT IS HAPPENING/i.test(trimmed)) {
      currentSection = 'why';
      const clean = trimmed.replace(/(?:###|##|\*\*|LIKELY ROOT CAUSE|LIKELY CAUSE|WHY IT IS HAPPENING|:|\*)/gi, '').trim();
      if (clean) whyItIsHappening = clean;
    } else if (/KEY EVIDENCE|EVIDENCE/i.test(trimmed)) {
      currentSection = 'evidence';
    } else if (/BASELINE → CURRENT|BASELINE/i.test(trimmed)) {
      currentSection = 'baseline';
      const clean = trimmed.replace(/(?:###|##|\*\*|BASELINE → CURRENT|BASELINE|:|\*)/gi, '').trim();
      if (clean) baselineComparison = clean;
    } else if (/DOWNSTREAM PROCESS IMPACT|POTENTIAL IMPACT|PROCESS IMPACT/i.test(trimmed)) {
      currentSection = 'impact';
      const clean = trimmed.replace(/(?:###|##|\*\*|DOWNSTREAM PROCESS IMPACT|POTENTIAL IMPACT|PROCESS IMPACT|:|\*)/gi, '').trim();
      if (clean) potentialImpact = clean;
    } else if (/WHAT TO VERIFY|RECOMMENDED VERIFICATION/i.test(trimmed)) {
      currentSection = 'verify';
      const clean = trimmed.replace(/(?:###|##|\*\*|WHAT TO VERIFY|RECOMMENDED VERIFICATION|:|\*)/gi, '').trim();
      if (clean) whatToVerify = clean;
    } else if (/ALTERNATIVE POSSIBILITIES|ALTERNATIVE/i.test(trimmed)) {
      currentSection = 'alternative';
    } else if (trimmed && !trimmed.startsWith('#')) {
      if (currentSection === 'what') {
        whatIsHappening = whatIsHappening ? whatIsHappening + ' ' + trimmed : trimmed;
      } else if (currentSection === 'why') {
        whyItIsHappening = whyItIsHappening ? whyItIsHappening + ' ' + trimmed : trimmed;
      } else if (currentSection === 'evidence' && (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*') || trimmed.startsWith('✓'))) {
        evidence.push(trimmed.replace(/^[-•*✓]\s*/, ''));
      } else if (currentSection === 'baseline') {
        baselineComparison = baselineComparison ? baselineComparison + ' ' + trimmed : trimmed;
      } else if (currentSection === 'impact') {
        potentialImpact = potentialImpact ? potentialImpact + ' ' + trimmed : trimmed;
      } else if (currentSection === 'verify') {
        whatToVerify = whatToVerify ? whatToVerify + ' ' + trimmed : trimmed;
      } else if (currentSection === 'alternative' && (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*') || /^\d+\./.test(trimmed))) {
        alternativePossibilities.push(trimmed.replace(/^[-•*\d.]+\s*/, ''));
      }
    }
  }

  // If empty after parse, use fallback values
  if (!whatIsHappening || !whyItIsHappening) {
    const fb = parseAiExplanation(
      generateFallbackExplanation(unitId, stage, health, eqData, isUnknown),
      unitId,
      stage,
      health,
      eqData,
      isUnknown
    );
    if (!whatIsHappening) whatIsHappening = fb.whatIsHappening;
    if (!whyItIsHappening) whyItIsHappening = fb.whyItIsHappening;
    if (evidence.length === 0) evidence.push(...fb.evidence);
    if (!potentialImpact) potentialImpact = fb.potentialImpact;
    if (!whatToVerify) whatToVerify = fb.whatToVerify;
    if (!baselineComparison) baselineComparison = fb.baselineComparison;
  }

  return {
    whatIsHappening,
    whyItIsHappening,
    evidence: evidence.slice(0, 5),
    baselineComparison,
    potentialImpact,
    whatToVerify,
    alternativePossibilities
  };
}
