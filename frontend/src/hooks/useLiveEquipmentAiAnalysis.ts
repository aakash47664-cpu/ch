import { useState, useCallback, useRef } from 'react';
import { ProcessUpdatePayload } from '../types';
import { sendAiChatMessage } from '../services/api';

export interface ParsedAiSections {
  whatIsHappening: string;
  keyEvidence: string[];
  likelyCause: string;
  alternativePossibilities: string[];
  processImpact: string;
  whatToVerify: string[];
  riskAssessment: string;
}

export interface LiveEquipmentAnalysisResult {
  equipmentId: string;
  equipmentTag: string;
  equipmentName: string;
  timestamp: string;
  healthScore: number;
  stage: string;
  riskScore: number;
  provider: string;
  model?: string;
  rawText: string;
  sections: ParsedAiSections;
}

/**
 * Parses markdown headers from AI response into structured sections.
 */
function parseAiResponseSections(rawText: string): ParsedAiSections {
  const sections: ParsedAiSections = {
    whatIsHappening: '',
    keyEvidence: [],
    likelyCause: '',
    alternativePossibilities: [],
    processImpact: '',
    whatToVerify: [],
    riskAssessment: ''
  };

  if (!rawText) return sections;

  // Split text by markdown headings (### WHAT IS HAPPENING, **WHAT IS HAPPENING**, etc.)
  const headingRegex = /(?:^|\n)(?:###|##|\*\*)\s*([A-Za-z\s&/]+)(?:\*\*|:)?\s*\n/g;
  const parts: Array<{ title: string; startIndex: number; contentStartIndex: number }> = [];

  let match;
  while ((match = headingRegex.exec(rawText)) !== null) {
    const rawTitle = match[1].trim().toUpperCase();
    parts.push({
      title: rawTitle,
      startIndex: match.index,
      contentStartIndex: match.index + match[0].length
    });
  }

  if (parts.length === 0) {
    sections.whatIsHappening = rawText.trim();
    return sections;
  }

  for (let i = 0; i < parts.length; i++) {
    const curr = parts[i];
    const nextStart = i + 1 < parts.length ? parts[i + 1].startIndex : rawText.length;
    const content = rawText.substring(curr.contentStartIndex, nextStart).trim();
    const title = curr.title;

    if (title.includes('WHAT IS HAPPENING') || title.includes('CURRENT STATE') || title.includes('SITUATION')) {
      sections.whatIsHappening = content;
    } else if (title.includes('KEY EVIDENCE') || title.includes('EVIDENCE') || title.includes('SYMPTOM')) {
      sections.keyEvidence = content
        .split('\n')
        .map((l) => l.replace(/^[*\-•✓\d.]+\s*/, '').trim())
        .filter((l) => l.length > 0);
    } else if (title.includes('LIKELY CAUSE') || title.includes('ROOT CAUSE') || title.includes('PROBABLE CAUSE')) {
      sections.likelyCause = content;
    } else if (title.includes('ALTERNATIVE') || title.includes('POSSIBILIT') || title.includes('OTHER CAUSES')) {
      sections.alternativePossibilities = content
        .split('\n')
        .map((l) => l.replace(/^[*\-•✓\d.]+\s*/, '').trim())
        .filter((l) => l.length > 0);
    } else if (title.includes('PROCESS IMPACT') || title.includes('DOWNSTREAM') || title.includes('CONSEQUENCE')) {
      sections.processImpact = content;
    } else if (title.includes('WHAT TO VERIFY') || title.includes('VERIF') || title.includes('INSPECTION') || title.includes('CHECKLIST') || title.includes('OPERATOR ACTION')) {
      sections.whatToVerify = content
        .split('\n')
        .map((l) => l.replace(/^[*\-•✓\d.]+\s*/, '').trim())
        .filter((l) => l.length > 0);
    } else if (title.includes('RISK') || title.includes('SEVERITY') || title.includes('URGENCY')) {
      sections.riskAssessment = content;
    }
  }

  if (!sections.whatIsHappening && parts[0]) {
    const end = parts[1] ? parts[1].startIndex : rawText.length;
    sections.whatIsHappening = rawText.substring(parts[0].contentStartIndex, end).trim();
  }

  return sections;
}

/**
 * Builds the real-time engineering context prompt for the selected equipment.
 */
function buildEquipmentPrompt(equipId: string, state: ProcessUpdatePayload): { prompt: string; tag: string; name: string } {
  const timestamp = new Date(state.timestamp || Date.now()).toLocaleTimeString();
  const overallStatus = state.diagnosis.system_status || (state.diagnosis.anomaly ? 'ABNORMAL' : 'NOMINAL');
  const faultMode = state.active_fault_mode || 'None (Nominal)';
  const riskScore = state.diagnosis.preventive?.riskScore ?? 15;
  const isUnknown = !!state.diagnosis.is_unknown_fault;

  if (equipId === 'pump') {
    const p = state.equipment.pump.data;
    const rpm = Math.round(p.rpm || 2450);
    const vib = (p.vibration || 0.08).toFixed(2);
    const flow = (p.flow || ((rpm / 2450) * 10.0)).toFixed(1);
    const press = (p.pressure || 2.80).toFixed(2);
    const temp = (p.inlet_temperature || 25.2).toFixed(1);
    const health = state.equipment_health?.pump?.health ?? 100;
    const stage = state.equipment_health?.pump?.stage ?? 'NORMAL';

    const rpmDelta = (((rpm - 2450) / 2450) * 100).toFixed(1);
    const vibDelta = (((Number(vib) - 0.08) / 0.08) * 100).toFixed(1);
    const flowDelta = (((Number(flow) - 10.0) / 10.0) * 100).toFixed(1);

    const prompt = `[CHEMDIAG REAL-TIME INDUSTRIAL PROCESS ANALYSIS REQUEST]
Target Unit: P-101 — Centrifugal Feed Pump
Current Stage: ${stage} (Health Score: ${health}%)
Timestamp: ${timestamp}
Overall Plant Status: ${overallStatus}
Active Plant Fault Mode: ${faultMode}
Risk Score: ${riskScore}/100
Sensor Reliability: ${state.esp32_status.connected ? 'REAL HARDWARE STREAM (ESP32 Online)' : 'SIMULATED DATA / VALIDATED'}

EXACT LIVE MEASUREMENTS VS DESIGN BASELINE:
- Rotational Speed: ${rpm} RPM (Design Baseline: 2450 RPM, Deviation: ${Number(rpmDelta) > 0 ? '+' : ''}${rpmDelta}%, Trend: ${rpm < 2400 ? 'Declining' : 'Stable'})
- Casing Vibration: ${vib} g (Design Baseline: 0.08 g, Deviation: ${Number(vibDelta) > 0 ? '+' : ''}${vibDelta}%, Trend: ${Number(vib) > 0.12 ? 'Increasing' : 'Stable'})
- Calculated Discharge Flow: ${flow} L/min (Design Baseline: 10.0 L/min, Deviation: ${Number(flowDelta) > 0 ? '+' : ''}${flowDelta}%, Trend: ${Number(flow) < 9.5 ? 'Declining' : 'Stable'})
- Discharge Pressure: ${press} bar (Design Baseline: 2.80 bar)
- Inlet Fluid Temp: ${temp} °C (Design Baseline: 25.2 °C)

DOWNSTREAM PROCESS PROPAGATION:
- Feed stream delivery to Shell & Tube Heat Exchanger E-101 (flow reduced if pump slips).
- Reactant volumetric flow entering Exothermic CSTR Reactor R-101 (residence time extends if flow decreases).
- Distillation Column D-101 hydraulic stability.

AI ANALYSIS DIRECTIVE:
Analyze the actual live situation for P-101. Do NOT invent different numbers or hallucinate generic pump trivia; cite and evaluate the exact live measurements provided above.
${isUnknown ? 'NOTE: If evidence is ambiguous, explain why available data is insufficient to definitively classify the fault mode rather than forcing an unverified assumption.\n' : ''}
Format your response using these EXACT section headers:
### WHAT IS HAPPENING
### KEY EVIDENCE
### LIKELY CAUSE
### ALTERNATIVE POSSIBILITIES
### PROCESS IMPACT
### WHAT TO VERIFY
### RISK ASSESSMENT`;

    return { prompt, tag: 'P-101', name: 'Centrifugal Feed Pump' };
  }

  if (equipId === 'heat_exchanger') {
    const hx = state.equipment.heat_exchanger.data;
    const dt = (hx.temperature_difference || 12.9).toFixed(1);
    const eff = (hx.efficiency ?? hx.heat_transfer_indicator ?? 95.0).toFixed(0);
    const inT = (hx.inlet_temperature || 38.1).toFixed(1);
    const outT = (hx.outlet_temperature || 25.2).toFixed(1);
    const health = state.equipment_health?.heat_exchanger?.health ?? 100;
    const stage = state.equipment_health?.heat_exchanger?.stage ?? 'NORMAL';

    const dtDelta = (((Number(dt) - 12.9) / 12.9) * 100).toFixed(1);
    const effDelta = (((Number(eff) - 95.0) / 95.0) * 100).toFixed(1);
    const outTDelta = (((Number(outT) - 25.2) / 25.2) * 100).toFixed(1);

    const prompt = `[CHEMDIAG REAL-TIME INDUSTRIAL PROCESS ANALYSIS REQUEST]
Target Unit: E-101 — Shell & Tube Heat Exchanger
Current Stage: ${stage} (Health Score: ${health}%)
Timestamp: ${timestamp}
Overall Plant Status: ${overallStatus}
Active Plant Fault Mode: ${faultMode}
Risk Score: ${riskScore}/100
Sensor Reliability: ${state.esp32_status.connected ? 'REAL HARDWARE STREAM (ESP32 Dual Probes)' : 'SIMULATED DATA / VALIDATED'}

EXACT LIVE MEASUREMENTS VS DESIGN BASELINE:
- Temperature Gradient (ΔT): ${dt} °C (Design Baseline: 12.9 °C, Deviation: ${Number(dtDelta) > 0 ? '+' : ''}${dtDelta}%, Trend: ${Number(dt) < 10.5 ? 'Declining' : 'Stable'})
- Heat Transfer Efficiency: ${eff}% (Design Baseline: 95.0%, Deviation: ${Number(effDelta) > 0 ? '+' : ''}${effDelta}%, Trend: ${Number(eff) < 88 ? 'Declining' : 'Stable'})
- Shell Inlet Temperature: ${inT} °C (Design Baseline: 38.1 °C)
- Tube Outlet Temperature: ${outT} °C (Design Baseline: 25.2 °C, Deviation: ${Number(outTDelta) > 0 ? '+' : ''}${outTDelta}%, Trend: ${Number(outT) > 28.0 ? 'Increasing' : 'Stable'})

DOWNSTREAM PROCESS PROPAGATION:
- Conditioned feed stream delivery to Exothermic CSTR Reactor R-101 (inlet temperature perturbation affects reactor reaction kinetics and cooling duty).
- Downstream Distillation Column D-101 reboiler thermal duty balance.

AI ANALYSIS DIRECTIVE:
Analyze the actual live situation for E-101. Reference the exact live values above.
${isUnknown ? 'NOTE: If evidence is ambiguous, explain why available data is insufficient to definitively classify the fault mode rather than forcing an unverified assumption.\n' : ''}
Format your response using these EXACT section headers:
### WHAT IS HAPPENING
### KEY EVIDENCE
### LIKELY CAUSE
### ALTERNATIVE POSSIBILITIES
### PROCESS IMPACT
### WHAT TO VERIFY
### RISK ASSESSMENT`;

    return { prompt, tag: 'E-101', name: 'Shell & Tube Exchanger' };
  }

  if (equipId === 'reactor') {
    const rx = state.equipment.reactor.data;
    const temp = (rx.temperature || 65.0).toFixed(1);
    const press = (rx.pressure || 2.05).toFixed(2);
    const level = (rx.level || 50.0).toFixed(1);
    const agit = Math.round(rx.agitator_speed || 350);
    const cooling = rx.cooling_status;
    const health = state.equipment_health?.reactor?.health ?? 100;
    const stage = state.equipment_health?.reactor?.stage ?? 'NORMAL';

    const tempDelta = (((Number(temp) - 65.0) / 65.0) * 100).toFixed(1);
    const pressDelta = (((Number(press) - 2.05) / 2.05) * 100).toFixed(1);

    const prompt = `[CHEMDIAG REAL-TIME INDUSTRIAL PROCESS ANALYSIS REQUEST]
Target Unit: R-101 — Exothermic CSTR Reactor
Current Stage: ${stage} (Health Score: ${health}%)
Timestamp: ${timestamp}
Overall Plant Status: ${overallStatus}
Active Plant Fault Mode: ${faultMode}
Risk Score: ${riskScore}/100
Sensor Reliability: VALIDATED TELEMETRY STREAM

EXACT LIVE MEASUREMENTS VS DESIGN BASELINE:
- Core Reactor Temperature: ${temp} °C (Design Baseline: 65.0 °C, Deviation: ${Number(tempDelta) > 0 ? '+' : ''}${tempDelta}%, Trend: ${Number(temp) > 68.0 ? 'Increasing' : 'Stable'})
- Internal Vessel Pressure: ${press} bar (Design Baseline: 2.05 bar, Deviation: ${Number(pressDelta) > 0 ? '+' : ''}${pressDelta}%, Trend: ${Number(press) > 2.25 ? 'Increasing' : 'Stable'})
- Liquid Holdup Level: ${level}% (Design Baseline: 50.0%)
- Agitator Speed: ${agit} RPM (Design Baseline: 350 RPM)
- Cooling Jacket Status: ${cooling === 1 ? 'ACTIVE (1)' : 'TRIPPED / INACTIVE (0)'}

DOWNSTREAM PROCESS PROPAGATION:
- Overheated reactor effluent flowing into Binary Distillation Column D-101 feed tray.
- Overpressure relief envelope and vapor vent interlock.

AI ANALYSIS DIRECTIVE:
Analyze the actual live situation for R-101. Reference the exact live values above.
${isUnknown ? 'NOTE: If evidence is ambiguous, explain why available data is insufficient to definitively classify the fault mode rather than forcing an unverified assumption.\n' : ''}
Format your response using these EXACT section headers:
### WHAT IS HAPPENING
### KEY EVIDENCE
### LIKELY CAUSE
### ALTERNATIVE POSSIBILITIES
### PROCESS IMPACT
### WHAT TO VERIFY
### RISK ASSESSMENT`;

    return { prompt, tag: 'R-101', name: 'Exothermic CSTR Reactor' };
  }

  // distillation
  const dist = state.equipment.distillation.data;
  const reflux = (dist.reflux_ratio || 1.85).toFixed(2);
  const topT = (dist.top_temperature || 76.5).toFixed(1);
  const botT = (dist.bottom_temperature || 98.4).toFixed(1);
  const press = (dist.pressure || 2.10).toFixed(2);
  const health = state.equipment_health?.distillation?.health ?? 100;
  const stage = state.equipment_health?.distillation?.stage ?? 'NORMAL';

  const refluxDelta = (((Number(reflux) - 1.85) / 1.85) * 100).toFixed(1);
  const topTDelta = (((Number(topT) - 76.5) / 76.5) * 100).toFixed(1);

  const prompt = `[CHEMDIAG REAL-TIME INDUSTRIAL PROCESS ANALYSIS REQUEST]
Target Unit: D-101 — Binary Distillation Fractionator
Current Stage: ${stage} (Health Score: ${health}%)
Timestamp: ${timestamp}
Overall Plant Status: ${overallStatus}
Active Plant Fault Mode: ${faultMode}
Risk Score: ${riskScore}/100
Sensor Reliability: VALIDATED TELEMETRY STREAM

EXACT LIVE MEASUREMENTS VS DESIGN BASELINE:
- Reflux Ratio (L/D): ${reflux} (Design Baseline: 1.85, Deviation: ${Number(refluxDelta) > 0 ? '+' : ''}${refluxDelta}%, Trend: ${Number(reflux) < 1.65 ? 'Declining' : 'Stable'})
- Overhead Top Vapor Temperature: ${topT} °C (Design Baseline: 76.5 °C, Deviation: ${Number(topTDelta) > 0 ? '+' : ''}${topTDelta}%, Trend: ${Number(topT) > 79.5 ? 'Increasing' : 'Stable'})
- Reboiler Bottom Temperature: ${botT} °C (Design Baseline: 98.4 °C)
- Column Operating Pressure: ${press} bar (Design Baseline: 2.10 bar)

DOWNSTREAM PROCESS PROPAGATION:
- Distillate Product stream purity (heavy component carryover if reflux lost).
- Bottoms reboiler waste fraction.

AI ANALYSIS DIRECTIVE:
Analyze the actual live situation for D-101. Reference the exact live values above.
${isUnknown ? 'NOTE: If evidence is ambiguous, explain why available data is insufficient to definitively classify the fault mode rather than forcing an unverified assumption.\n' : ''}
Format your response using these EXACT section headers:
### WHAT IS HAPPENING
### KEY EVIDENCE
### LIKELY CAUSE
### ALTERNATIVE POSSIBILITIES
### PROCESS IMPACT
### WHAT TO VERIFY
### RISK ASSESSMENT`;

  return { prompt, tag: 'D-101', name: 'Distillation Column' };
}

export function useLiveEquipmentAiAnalysis(state: ProcessUpdatePayload) {
  // Store map of analysis results keyed by equipmentId
  const [analysisMap, setAnalysisMap] = useState<Record<string, LiveEquipmentAnalysisResult>>({});
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAnalysisEquipment, setActiveAnalysisEquipment] = useState<string | null>(null);

  // Keep latest state in ref to avoid stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  const analyzeEquipment = useCallback(
    async (equipmentId: string, customProvider: 'gemini' | 'groq' = 'gemini') => {
      const currentState = stateRef.current;
      const { prompt, tag, name } = buildEquipmentPrompt(equipmentId, currentState);

      setIsAnalyzing(true);
      setError(null);
      setActiveAnalysisEquipment(equipmentId);

      try {
        const response = await sendAiChatMessage(
          prompt,
          [],
          equipmentId,
          {
            equipment: tag,
            stage: currentState.equipment_health?.[equipmentId as keyof typeof currentState.equipment_health]?.stage || 'NORMAL',
            health: currentState.equipment_health?.[equipmentId as keyof typeof currentState.equipment_health]?.health || 100
          },
          customProvider
        );

        const rawText = response.text || response.response || response.answer || '';
        const sections = parseAiResponseSections(rawText);

        const result: LiveEquipmentAnalysisResult = {
          equipmentId,
          equipmentTag: tag,
          equipmentName: name,
          timestamp: new Date().toLocaleTimeString(),
          healthScore: currentState.equipment_health?.[equipmentId as keyof typeof currentState.equipment_health]?.health ?? 100,
          stage: currentState.equipment_health?.[equipmentId as keyof typeof currentState.equipment_health]?.stage ?? 'NORMAL',
          riskScore: currentState.diagnosis.preventive?.riskScore ?? 15,
          provider: response.provider || 'Gemini',
          model: (response as any).model || 'gemini-3.6-flash',
          rawText,
          sections
        };

        setAnalysisMap((prev) => ({
          ...prev,
          [equipmentId]: result
        }));
      } catch (err: any) {
        console.error('Live equipment AI analysis error:', err);
        setError(err.message || 'AI request failed');
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  return {
    analysisMap,
    isAnalyzing,
    error,
    activeAnalysisEquipment,
    analyzeEquipment
  };
}
