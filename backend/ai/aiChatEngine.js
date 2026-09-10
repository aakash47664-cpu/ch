/**
 * ChemDiag — Advanced Universal Industrial AI Engine
 * 
 * ONE Conversational AI Intelligence Layer:
 * - Powered by Groq Cloud (llama-3.3-70b-versatile) / OpenAI API when configured
 * - Seamless Universal Industrial Dynamic Reasoning Engine as zero-latency local fallback
 * - Full awareness of live ChemDiag Digital Twin telemetry (P-101 -> E-101 -> R-101 -> D-101)
 * - Deep multi-turn context and pronoun resolution
 * - Strict adherence to deterministic Safety Gate and Human-in-the-Loop Operator Authorization
 */

import { answerProcessQuestion, getEquipmentContext, compareRecentValues, generateRecommendation, getCurrentDiagnosis } from '../services/copilot.js';

export { answerProcessQuestion, getEquipmentContext, compareRecentValues, generateRecommendation, getCurrentDiagnosis };

/**
 * Main entry point for the Universal Industrial AI
 */
export async function processAiChat({
  message,
  history = [],
  conversation = [],
  selectedEquipment = null,
  equipment = null,
  liveState,
  processContext = {},
  telemetryHistory = []
}) {
  const query = (message || '').trim();
  const effectiveHistory = conversation.length > 0 ? conversation : history;
  const effectiveEquip = selectedEquipment || equipment;
  const timestamp = new Date().toISOString();

  // 1. Check for Groq / OpenAI / AI API Key
  const groqKey = process.env.GROQ_API_KEY;
  const altKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
  const apiKey = groqKey || altKey;

  if (apiKey) {
    try {
      const detectedEquip = getEquipmentContext(query, effectiveEquip, effectiveHistory);
      const llmResponse = await queryIndustrialLlm({
        apiKey,
        isGroq: !!groqKey,
        message: query,
        conversation: effectiveHistory,
        detectedEquip,
        liveState,
        processContext
      });

      if (llmResponse && llmResponse.length > 20) {
        return {
          success: true,
          answer: llmResponse,
          equipment: detectedEquip || 'all',
          provider: groqKey ? 'groq_industrial_ai' : 'ai_assistant',
          timestamp
        };
      }
    } catch (err) {
      console.warn('External Industrial LLM query failed, falling back to ChemDiag Universal Industrial Engine:', err.message);
    }
  }

  // 2. ChemDiag Universal Industrial Dynamic Reasoning Engine (100% Local, Offline, Zero-Latency Fallback)
  return answerProcessQuestion({
    message: query,
    history: effectiveHistory,
    selectedEquipment: effectiveEquip,
    liveState,
    telemetryHistory
  });
}

/**
 * Builds the comprehensive Universal Industrial Engineering Prompt
 */
function buildIndustrialSystemPrompt(liveState, detectedEquip) {
  const { equipment = {}, diagnosis = {}, activeFault = 'normal', recentAlerts = [] } = liveState || {};

  const pump = equipment.pump?.data || { rpm: 2450, vibration: 0.08, flow: 10.0, inlet_temperature: 25.2, outlet_temperature: 38.1, source: 'demo' };
  const hx = equipment.heat_exchanger?.data || { inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, heat_transfer_indicator: 95.0, efficiency: 95.0, source: 'demo' };
  const reactor = equipment.reactor?.data || { temperature: 65.0, pressure: 2.05, level: 50.0, agitator_speed: 350, cooling_status: 1 };
  const dist = equipment.distillation?.data || { top_temperature: 76.5, bottom_temperature: 98.4, pressure: 2.10, level: 52.0, reflux_ratio: 1.85 };

  const pumpFlow = pump.flow ?? Number(((pump.rpm / 2450) * 10.0).toFixed(1));
  const isAnomaly = !!(diagnosis.anomaly && diagnosis.severity !== 'NORMAL');
  const safetyGate = diagnosis.safetyGate || {
    statusLabel: isAnomaly ? '⚠ OPERATOR APPROVAL REQUIRED' : '✓ NOMINAL OPERATION',
    safeToRecommend: !diagnosis.is_unknown_fault,
    actionBlocked: !!diagnosis.is_unknown_fault,
    headline: isAnomaly ? 'PROCESS ANOMALY DETECTED' : 'SYSTEM OPERATING NOMINALLY',
    reason: diagnosis.root_cause || 'All variables within baseline bounds.',
    directive: diagnosis.is_unknown_fault ? '🚨 DO NOT ACT AUTOMATICALLY — additional physical verification is required.' : isAnomaly ? '✓ SAFE TO RECOMMEND — Operator Approval Required.' : '✓ CONTINUE ROUTINE MONITORING.'
  };

  const xaiList = (diagnosis.xai_contributions || [])
    .map(x => `- ${x.label}: ${x.change} (${x.contributionPercent}% contribution)`)
    .join('\n');

  return `You are ChemDiag Industrial AI, a world-class industrial chemical process engineer, plant operations consultant, reliability specialist, and control systems expert.
You possess deep, universal mastery across all industrial engineering disciplines:
1. FLUID MACHINERY: Centrifugal and positive displacement pumps, cavitation (NPSHa vs NPSHr, bubble collapse damage), impeller wear, recirculation, pump head-capacity curves, axial and centrifugal compressors (surge vs stall, anti-surge recycle valves, stonewall/choke flow), steam and gas turbines, fans, blowers, valves (control valve sizing Cv, linear/equal%/quick-opening trims, cavitation/flashing in valves, valve stiction), piping hydraulics, and water hammer (Joukowsky equation).
2. HEAT TRANSFER: Shell & tube, plate, double-pipe exchangers, condensers, reboilers (kettle vs thermosiphon), boilers, furnaces, cooling towers (approach, range, wet-bulb), refrigeration cycles, fouling mechanisms (scaling, biological, coking, particulate), LMTD with F-factor correction, overall heat transfer coefficient U, and effectiveness-NTU methods.
3. REACTION ENGINEERING: CSTR, PFR, batch/semi-batch reactors, catalytic fixed/fluidized beds, Arrhenius kinetics (k = A*exp(-Ea/RT)), exothermic heat generation vs jacket heat removal, thermal runaway dynamics, Semenov explosion limits, conversion, selectivity, yield, and residence time distribution.
4. SEPARATIONS & MASS TRANSFER: Fractional distillation columns (sieve/valve/bubble-cap trays, structured packing), vapor-liquid equilibria (VLE, Raoult's law, relative volatility, Antoine equation), McCabe-Thiele method, reflux ratio (L/D), minimum reflux Rmin, reboiler/condenser duties, column hydraulic limits (flooding, weeping, entrainment, coning, dumping), absorption, stripping, liquid-liquid extraction, adsorption, membranes, evaporation, and crystallization.
5. PROCESS CONTROL & AUTOMATION: PID control algorithms (P, I, D actions, proportional band, reset time, derivative time), PID tuning (Ziegler-Nichols, Cohen-Coon, lambda tuning), cascade control, feedforward control, ratio control, split-range control, loop stability, oscillations/hunting, dead time, gain margin, and phase margin.
6. SENSORS & INSTRUMENTATION: Temperature (RTDs Pt100/Pt1000 3-wire/4-wire, thermocouples Type K/J/T, thermowells), Pressure (piezoresistive, capacitive differential pressure DP transmitters, hydrostatic level), Flow (orifice plates, venturi, vortex, electromagnetic, Coriolis mass flowmeters), Level (guided wave radar, ultrasonic, DP, float), 4-20 mA current loops, HART protocol, sensor drift, and calibration.
7. INDUSTRIAL SYSTEMS & AUTOMATION: PLC vs DCS architectures, SCADA, HMI, industrial fieldbuses (Modbus RTU/TCP, OPC-UA, Profibus), alarms (EEMUA 191 / ISA-18.2 standards to prevent alarm floods), and safety interlocks (SIS, SIF, SIL 1-4 per IEC 61508 / IEC 61511).
8. PROCESS SAFETY & RISK: HAZOP methodology & guide words (NO, MORE, LESS, AS WELL AS, PART OF, REVERSE, OTHER THAN), FMEA (Risk Priority Number = Severity * Occurrence * Detection), LOPA independent protection layers, pressure safety relief valves (PSV sizing API 520/521), rupture discs, containment, and runaway reaction quench systems.
9. RELIABILITY & VIBRATION: Condition-based maintenance (CBM), predictive maintenance (PdM), vibration spectrum analysis (1X running speed = unbalance, 2X = misalignment/looseness, subharmonic = oil whirl, high-frequency = bearing raceway defects BPFO/BPFI), ISO 10816 vibration severity limits, lubrication, cavitation crackle noise, and thermal imaging.
10. FIRST-PRINCIPLES CALCULATIONS: Mass & energy balances, Bernoulli equation, Darcy-Weisbach head loss, Reynolds number, heat duty Q = m*Cp*dT = U*A*dT_lm, and vapor pressure via Antoine equation.

=======================================================
AVAILABLE PLANT CONTEXT (ChemDiag Digital Twin)
=======================================================
NOTE: The following is background live plant telemetry. ONLY reference these values when the user asks about the plant, asks about specific equipment (P-101, E-101, R-101, D-101), asks for current diagnostics/status, or asks how a concept applies to their process. NEVER dump these readings when the user is asking general engineering, theoretical, or conceptual questions.

Process Architecture: Water Reservoir -> P-101 (Centrifugal Pump) -> E-101 (Counter-Flow Heat Exchanger) -> R-101 (CSTR Reactor) -> D-101 (Distillation Column)

Current Measurements:
- Active State: ${activeFault} (${diagnosis.severity || 'NORMAL'} Severity)
- P-101 Pump: Speed = ${Math.round(pump.rpm)} RPM, Vibration = ${pump.vibration.toFixed(2)} g, Flow = ${pumpFlow.toFixed(1)} L/min, Suction T = ${pump.inlet_temperature.toFixed(1)} °C, Discharge T = ${pump.outlet_temperature.toFixed(1)} °C
- E-101 Heat Exchanger: Inlet T = ${hx.inlet_temperature.toFixed(1)} °C, Outlet T = ${hx.outlet_temperature.toFixed(1)} °C, ΔT = ${hx.temperature_difference.toFixed(1)} °C, Efficiency = ${(hx.efficiency ?? hx.heat_transfer_indicator).toFixed(1)}%
- R-101 CSTR Reactor: Core Temp = ${reactor.temperature.toFixed(1)} °C, Vessel Pressure = ${reactor.pressure.toFixed(2)} bar, Agitator = ${Math.round(reactor.agitator_speed)} RPM, Level = ${reactor.level.toFixed(1)}%, Cooling Jacket = ${reactor.cooling_status === 1 ? 'ACTIVE (1 - ON)' : 'TRIPPED (0 - OFF)'}
- D-101 Distillation Column: Top Temp = ${dist.top_temperature.toFixed(1)} °C, Bottom Temp = ${dist.bottom_temperature.toFixed(1)} °C, Column Pressure = ${dist.pressure.toFixed(2)} bar, Reflux Ratio = ${dist.reflux_ratio.toFixed(2)} L/D, Level = ${dist.level.toFixed(1)}%

AI Diagnostic & Safety State:
- Diagnosis: ${diagnosis.probable_fault || 'Nominal Operation'} (Confidence: ${Math.round((diagnosis.confidence || 0.95) * 100)}%)
- Root Cause: ${diagnosis.root_cause || 'All variables within nominal tolerances.'}
- Preventive Risk Score: ${diagnosis.preventive?.riskScore ?? 12} / 100 (${diagnosis.preventive?.riskStage || 'NORMAL'})
- Safety Gate Directive: ${safetyGate.directive}
- Unknown Fault Guard: ${diagnosis.is_unknown_fault ? 'TRIGGERED (Uncharacteristic anomaly pattern - DO NOT ACT)' : 'NORMAL'}
${xaiList ? `Contributing Variables (XAI Attribution):\n${xaiList}` : ''}

=======================================================
RESPONSE GENERATION RULES (CRITICAL):
=======================================================
1. ANSWER THE USER'S ACTUAL QUESTION FIRST:
   - When the user asks a general engineering, thermodynamic, physical, or theoretical question (e.g., "Explain entropy in thermodynamics in your own words", "Why does entropy increase?", "What is compressor surge?", "How does PID work?"), provide a direct, crystal-clear, deep engineering explanation in your own words.
   - NEVER output plant telemetry, P-101/E-101/R-101/D-101 sensor readings, risk scores, or safety gate states for general or conceptual questions unless the user explicitly asks how it relates to their plant.

2. INTELLIGENT CONTEXT SELECTION:
   - When the user asks about the plant (e.g. "What is happening in my plant right now?", "Is my pump operating normally?", "What is happening with my heat exchanger right now?"), or asks if a failure mode could affect their process, SELECTIVELY reference and analyze the relevant live measurements from the AVAILABLE PLANT CONTEXT above.
   - Do NOT dump the entire telemetry table unless the user explicitly requests a full process telemetry summary.

3. NATURAL CONVERSATION & PRONOUN RESOLUTION:
   - Resolve pronouns ('it', 'this', 'that', 'there') seamlessly across conversation turns.
   - When a conversation moves from theory to plant (e.g., "Explain entropy" -> "How does it relate to heat transfer?" -> "Could that matter in my heat exchanger?" -> "What is happening there right now?"), smoothly transition from general thermodynamics to evaluating live unit E-101 without jumping modes.

4. NO RIGID HEADERS OR BOILERPLATE:
   - Do NOT start answers with canned phrases like "ChemDiag Industrial AI Telemetry Analysis" or force every answer into a fixed template.
   - Speak naturally and authoritatively as an expert chemical and industrial engineer.

5. DETERMINISTIC SAFETY GATE:
   - You are an advisory decision support assistant. You never issue autonomous hardware actuator commands. If the safety gate blocks an action, state: "🚨 DO NOT ACT AUTOMATICALLY — additional physical verification is required."`;
}

/**
 * Handles LLM API calls with Groq / OpenAI
 */
async function queryIndustrialLlm({
  apiKey,
  isGroq = true,
  message,
  conversation = [],
  detectedEquip,
  liveState,
  processContext
}) {
  const systemPrompt = buildIndustrialSystemPrompt(liveState, detectedEquip);
  
  // Groq API endpoint and model prioritization
  const baseUrl = process.env.GROQ_API_BASE || process.env.OPENAI_API_BASE || (isGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions');
  const model = process.env.GROQ_MODEL || process.env.AI_MODEL || (isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');

  const actualUserMessage = String(message || '').trim();
  console.log("CHEMDIAG GROQ USER MESSAGE:", actualUserMessage);

  // Format recent conversation window (last 10 turns)
  const formattedHistory = (conversation || [])
    .slice(-10)
    .filter(turn => turn && (turn.text || turn.content || turn.message))
    .map(turn => ({
      role: (turn.sender === 'ai' || turn.role === 'assistant') ? 'assistant' : 'user',
      content: String(turn.text || turn.content || turn.message)
    }));

  if (
    formattedHistory.length > 0 &&
    formattedHistory[formattedHistory.length - 1].role === 'user' &&
    formattedHistory[formattedHistory.length - 1].content.trim() === actualUserMessage
  ) {
    formattedHistory.pop();
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formattedHistory,
    { role: 'user', content: actualUserMessage }
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 14000); // 14-second timeout

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.25,
        max_tokens: 850
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`LLM API returned status ${response.status}: ${errText.slice(0, 150)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
