/**
 * ChemDiag — Groq Cloud Industrial AI Service
 * 
 * Powered by Groq Cloud API using process.env.GROQ_API_KEY.
 * Provides fast, high-accuracy conversational intelligence across
 * universal industrial/chemical engineering domains with dynamic
 * live ChemDiag Digital Twin process grounding.
 */

import { Groq } from 'groq-sdk';

/**
 * Returns whether GROQ_API_KEY is configured in the environment
 */
export function isGroqConfigured() {
  const key = process.env.GROQ_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}

/**
 * Returns AI health metadata (never exposes the secret key)
 */
export function getGroqHealth() {
  const configured = isGroqConfigured();
  return {
    provider: 'Groq',
    configured,
    status: configured ? 'ONLINE' : 'UNCONFIGURED',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  };
}

/**
 * Builds system prompt combining universal industrial engineering domain knowledge
 * and real ChemDiag process telemetry if available.
 */
function buildSystemPrompt(liveState, processContext) {
  let plantContextSection = '';

  const state = liveState || processContext;
  if (state && (state.equipment || state.diagnosis)) {
    const { equipment = {}, diagnosis = {}, activeFault = 'normal' } = state;
    const pump = equipment.pump?.data || {};
    const hx = equipment.heat_exchanger?.data || {};
    const reactor = equipment.reactor?.data || {};
    const dist = equipment.distillation?.data || {};

    plantContextSection = `
=======================================================
AVAILABLE PLANT CONTEXT (ChemDiag Digital Twin)
=======================================================
NOTE: The following is background live plant telemetry. ONLY reference these values when the user asks about the plant, asks about specific equipment (P-101, E-101, R-101, D-101), asks for current diagnostics/status, or asks how a concept applies to their process. NEVER dump these readings when the user is asking general engineering, theoretical, or conceptual questions.

Process Architecture: Water Reservoir -> P-101 (Centrifugal Pump) -> E-101 (Counter-Flow Heat Exchanger) -> R-101 (CSTR Reactor) -> D-101 (Distillation Column)

Current Measurements:
- Active State: ${activeFault} (${diagnosis.severity || 'NORMAL'} Severity)
- P-101 Pump: Speed = ${pump.rpm ? Math.round(pump.rpm) + ' RPM' : 'N/A'}, Vibration = ${pump.vibration !== undefined ? pump.vibration.toFixed(2) + ' g' : 'N/A'}, Flow = ${pump.flow !== undefined ? pump.flow.toFixed(1) + ' L/min' : 'N/A'}, Suction T = ${pump.inlet_temperature !== undefined ? pump.inlet_temperature.toFixed(1) + ' °C' : 'N/A'}, Discharge T = ${pump.outlet_temperature !== undefined ? pump.outlet_temperature.toFixed(1) + ' °C' : 'N/A'}
- E-101 Heat Exchanger: Inlet T = ${hx.inlet_temperature !== undefined ? hx.inlet_temperature.toFixed(1) + ' °C' : 'N/A'}, Outlet T = ${hx.outlet_temperature !== undefined ? hx.outlet_temperature.toFixed(1) + ' °C' : 'N/A'}, ΔT = ${hx.temperature_difference !== undefined ? hx.temperature_difference.toFixed(1) + ' °C' : 'N/A'}, Efficiency = ${(hx.efficiency ?? hx.heat_transfer_indicator ?? 'N/A')}%
- R-101 CSTR Reactor: Core Temp = ${reactor.temperature !== undefined ? reactor.temperature.toFixed(1) + ' °C' : 'N/A'}, Vessel Pressure = ${reactor.pressure !== undefined ? reactor.pressure.toFixed(2) + ' bar' : 'N/A'}, Agitator = ${reactor.agitator_speed ? Math.round(reactor.agitator_speed) + ' RPM' : 'N/A'}, Cooling Jacket = ${reactor.cooling_status === 1 ? 'ACTIVE (1 - ON)' : 'TRIPPED (0 - OFF)'}
- D-101 Distillation Column: Top Temp = ${dist.top_temperature !== undefined ? dist.top_temperature.toFixed(1) + ' °C' : 'N/A'}, Bottom Temp = ${dist.bottom_temperature !== undefined ? dist.bottom_temperature.toFixed(1) + ' °C' : 'N/A'}, Column Pressure = ${dist.pressure !== undefined ? dist.pressure.toFixed(2) + ' bar' : 'N/A'}, Reflux Ratio = ${dist.reflux_ratio !== undefined ? dist.reflux_ratio.toFixed(2) + ' L/D' : 'N/A'}

AI Diagnostic & Safety State:
- Classification: ${diagnosis.probable_fault || diagnosis.fault || 'Nominal Operation'} (Confidence: ${Math.round((diagnosis.confidence || 0.95) * 100)}%)
- Root Cause: ${diagnosis.root_cause || 'All parameters operating within nominal design baseline.'}
- Preventive Risk Score: ${diagnosis.preventive?.riskScore ?? 12} / 100 (${diagnosis.preventive?.riskStage || 'NORMAL'})
- Safety Gate Directive: ${diagnosis.safetyGate?.directive || '✓ CONTINUE ROUTINE MONITORING'}
- Unknown Fault Guard: ${diagnosis.is_unknown_fault ? 'TRIGGERED (Uncertain anomaly - DO NOT ACT)' : 'NORMAL'}
`;
  }

  return `You are ChemDiag Industrial AI, a world-class industrial chemical process engineer, plant operations consultant, reliability specialist, and control systems expert.
You possess deep, universal mastery across all industrial engineering disciplines:
1. THERMODYNAMICS & FLUID MECHANICS: Entropy (microstates, irreversibility, second law, Clausius inequality dS >= dQ/T), Enthalpy, Gibbs free energy, Carnot cycle, Centrifugal and positive displacement pumps, cavitation (NPSHa vs NPSHr, vapor bubble collapse), dynamic centrifugal & axial compressors (surge vs stall, anti-surge recycle valves, stonewall/choke), steam/gas turbines, valves (control valve sizing Cv, linear/equal%/quick-opening trims, valve stiction), piping hydraulics, and water hammer.
2. HEAT TRANSFER: Shell & tube, plate exchangers, condensers, reboilers (kettle vs thermosiphon), cooling towers, refrigeration cycles, fouling mechanisms (scaling, particulate, coking), LMTD with F-factor correction, overall heat transfer coefficient U, and effectiveness-NTU methods.
3. REACTION ENGINEERING: CSTR, PFR, batch reactors, Arrhenius kinetics (k = A*exp(-Ea/RT)), exothermic heat generation vs jacket cooling, Semenov thermal runaway criteria, conversion, selectivity, and residence time distribution.
4. SEPARATIONS & MASS TRANSFER: Fractional distillation columns (sieve/valve/bubble-cap trays, structured packing), vapor-liquid equilibria (VLE, Raoult's law, Antoine equation), McCabe-Thiele method, reflux ratio (L/D), column hydraulic limits (flooding, weeping, entrainment), absorption, stripping, extraction, and membranes.
5. PROCESS CONTROL & AUTOMATION: PID control algorithms (P, I, D actions), PID tuning (Ziegler-Nichols, Cohen-Coon, lambda tuning), cascade control, feedforward control, ratio control, loop stability, dead time, and hunting.
6. INSTRUMENTATION & SENSORS: RTDs (Pt100/Pt1000), thermocouples (Type K/J/T), DP transmitters, Coriolis mass flowmeters, guided wave radar, 4-20 mA current loops, HART, sensor drift, and calibration.
7. PROCESS SAFETY & RELIABILITY: HAZOP guide words, LOPA independent protection layers, PSV sizing (API 520/521), rupture discs, vibration spectrum FFT analysis (1X unbalance, 2X misalignment, high-frequency bearing harmonics BPFO/BPFI), and condition-based predictive maintenance.
${plantContextSection}
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
 * Sends chat request to Groq Cloud API
 */
export async function chatWithGroq({
  message,
  conversation = [],
  processContext = null,
  liveState = null
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in the environment');
  }

  const actualUserMessage = String(message || '').trim();

  // Safe dev log for verifying message flow (never logs keys/secrets)
  console.log("CHEMDIAG GROQ USER MESSAGE:", actualUserMessage);

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const systemPrompt = buildSystemPrompt(liveState, processContext);

  // Format conversation history for Groq / OpenAI messages format
  const formattedHistory = (conversation || [])
    .slice(-10) // Keep recent 10 turns for context
    .filter(turn => turn && (turn.content || turn.text || turn.message))
    .map(turn => ({
      role: (turn.role === 'user' || turn.sender === 'user') ? 'user' : 'assistant',
      content: String(turn.content || turn.text || turn.message)
    }));

  // Ensure current user message is not duplicated at the end of history
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

  try {
    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model,
      messages,
      temperature: 0.25,
      max_tokens: 1024
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error('Empty response received from Groq API');
    }

    return reply;
  } catch (sdkError) {
    // Fallback: direct HTTPS fetch to Groq REST endpoint
    console.warn('Groq SDK call error, trying direct HTTPS fetch fallback:', sdkError.message);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const fetchRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.25,
          max_tokens: 1024
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!fetchRes.ok) {
        const errBody = await fetchRes.text().catch(() => '');
        throw new Error(`Groq API HTTP ${fetchRes.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await fetchRes.json();
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        throw new Error('Empty response received from Groq REST endpoint');
      }

      return reply;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  }
}
