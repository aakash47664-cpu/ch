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
LIVE CHEMDIAG PROCESS TELEMETRY & DIGITAL TWIN
=======================================================
Process Train: Water Reservoir -> P-101 (Centrifugal Pump) -> E-101 (Heat Exchanger) -> R-101 (CSTR Reactor) -> D-101 (Distillation Column)

Current Live Telemetry:
- Active Fault State: ${activeFault} (Severity: ${diagnosis.severity || 'NORMAL'})
- P-101 Pump: Speed = ${pump.rpm ? Math.round(pump.rpm) + ' RPM' : 'N/A'}, Casing Vibration = ${pump.vibration !== undefined ? pump.vibration.toFixed(2) + ' g' : 'N/A'}, Flow = ${pump.flow !== undefined ? pump.flow.toFixed(1) + ' L/min' : 'N/A'}, Suction T = ${pump.inlet_temperature !== undefined ? pump.inlet_temperature.toFixed(1) + ' °C' : 'N/A'}, Discharge T = ${pump.outlet_temperature !== undefined ? pump.outlet_temperature.toFixed(1) + ' °C' : 'N/A'} (Source: ${equipment.pump?.source_label || 'DIGITAL TWIN'})
- E-101 Heat Exchanger: Inlet T = ${hx.inlet_temperature !== undefined ? hx.inlet_temperature.toFixed(1) + ' °C' : 'N/A'}, Outlet T = ${hx.outlet_temperature !== undefined ? hx.outlet_temperature.toFixed(1) + ' °C' : 'N/A'}, ΔT = ${hx.temperature_difference !== undefined ? hx.temperature_difference.toFixed(1) + ' °C' : 'N/A'}, Efficiency = ${(hx.efficiency ?? hx.heat_transfer_indicator ?? 'N/A')}%
- R-101 CSTR Reactor: Core Temp = ${reactor.temperature !== undefined ? reactor.temperature.toFixed(1) + ' °C' : 'N/A'}, Vessel Pressure = ${reactor.pressure !== undefined ? reactor.pressure.toFixed(2) + ' bar' : 'N/A'}, Agitator = ${reactor.agitator_speed ? Math.round(reactor.agitator_speed) + ' RPM' : 'N/A'}, Cooling Jacket = ${reactor.cooling_status === 1 ? 'ACTIVE (1 - ON)' : 'TRIPPED (0 - OFF)'}
- D-101 Distillation Column: Top Vapor Temp = ${dist.top_temperature !== undefined ? dist.top_temperature.toFixed(1) + ' °C' : 'N/A'}, Bottom Reboiler Temp = ${dist.bottom_temperature !== undefined ? dist.bottom_temperature.toFixed(1) + ' °C' : 'N/A'}, Column Pressure = ${dist.pressure !== undefined ? dist.pressure.toFixed(2) + ' bar' : 'N/A'}, Reflux Ratio = ${dist.reflux_ratio !== undefined ? dist.reflux_ratio.toFixed(2) + ' L/D' : 'N/A'}

AI Diagnostic State:
- Classification: ${diagnosis.probable_fault || diagnosis.fault || 'Nominal Operation'} (Confidence: ${Math.round((diagnosis.confidence || 0.95) * 100)}%)
- Root Cause: ${diagnosis.root_cause || 'All parameters operating within nominal design baseline.'}
- Preventive Risk Score: ${diagnosis.preventive?.riskScore ?? 12} / 100 (${diagnosis.preventive?.riskStage || 'NORMAL'})
- Safety Gate State: ${diagnosis.safetyGate?.statusLabel || '✓ NOMINAL OPERATION'}
- Safety Gate Directive: ${diagnosis.safetyGate?.directive || '✓ CONTINUE ROUTINE MONITORING'}
- Unknown Fault Guard: ${diagnosis.is_unknown_fault ? 'TRIGGERED (Uncertain anomaly - DO NOT ACT)' : 'NORMAL'}
`;
  }

  return `You are ChemDiag Industrial AI, a world-class industrial chemical process engineer, plant operations consultant, reliability specialist, and control systems expert.
You possess deep, universal mastery across all industrial engineering disciplines:
1. FLUID MACHINERY: Centrifugal and positive displacement pumps, cavitation (NPSHa vs NPSHr, vapor bubble collapse), dynamic centrifugal & axial compressors (surge vs stall, anti-surge recycle valves, stonewall/choke), steam/gas turbines, valves (control valve sizing Cv, linear/equal%/quick-opening trims, valve stiction), piping hydraulics, and water hammer.
2. HEAT TRANSFER: Shell & tube, plate exchangers, condensers, reboilers (kettle vs thermosiphon), cooling towers, refrigeration cycles, fouling mechanisms (scaling, particulate, coking), LMTD with F-factor correction, overall heat transfer coefficient U, and effectiveness-NTU methods.
3. REACTION ENGINEERING: CSTR, PFR, batch reactors, Arrhenius kinetics (k = A*exp(-Ea/RT)), exothermic heat generation vs jacket cooling, Semenov thermal runaway criteria, conversion, selectivity, and residence time distribution.
4. SEPARATIONS & MASS TRANSFER: Fractional distillation columns (sieve/valve/bubble-cap trays, structured packing), vapor-liquid equilibria (VLE, Raoult's law, Antoine equation), McCabe-Thiele method, reflux ratio (L/D), column hydraulic limits (flooding, weeping, entrainment), absorption, stripping, extraction, and membranes.
5. PROCESS CONTROL & AUTOMATION: PID control algorithms (P, I, D actions), PID tuning (Ziegler-Nichols, Cohen-Coon, lambda tuning), cascade control, feedforward control, ratio control, loop stability, dead time, and hunting.
6. INSTRUMENTATION & SENSORS: RTDs (Pt100/Pt1000), thermocouples (Type K/J/T), DP transmitters, Coriolis mass flowmeters, guided wave radar, 4-20 mA current loops, HART, sensor drift, and calibration.
7. PROCESS SAFETY & RELIABILITY: HAZOP guide words, LOPA independent protection layers, PSV sizing (API 520/521), rupture discs, vibration spectrum FFT analysis (1X unbalance, 2X misalignment, high-frequency bearing harmonics BPFO/BPFI), and condition-based predictive maintenance.
${plantContextSection}
=======================================================
OPERATIONAL DIRECTIVES
=======================================================
1. UNIVERSAL INTELLIGENCE: You are a single, universal AI. You answer general chemical and industrial engineering questions naturally without needing process telemetry.
2. LIVE PROCESS AWARENESS: When the user asks about the ChemDiag plant, equipment behavior, or if a failure mode could affect their plant, connect engineering theory with the actual live process telemetry above.
3. MULTI-TURN CONVERSATION: Understand pronouns ('it', 'this', 'that') and follow-up queries naturally based on conversation history.
4. DETERMINISTIC SAFETY GATE: You are an advisory decision support assistant. You never issue autonomous hardware actuator commands. If the safety gate blocks an action, state: "🚨 DO NOT ACT AUTOMATICALLY — additional physical verification is required."
5. CLEAN & AUTHORITATIVE: Do NOT include disclaimer banners, prototype notices, or repetitive boilerplate. Give direct, technically sound, professional engineering responses.`;
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

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const systemPrompt = buildSystemPrompt(liveState, processContext);

  // Format conversation history for Groq / OpenAI messages format
  const formattedHistory = (conversation || [])
    .slice(-12) // Keep recent 12 turns for context
    .filter(turn => turn && (turn.content || turn.text || turn.message))
    .map(turn => ({
      role: (turn.role === 'user' || turn.sender === 'user') ? 'user' : 'assistant',
      content: String(turn.content || turn.text || turn.message)
    }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formattedHistory,
    { role: 'user', content: String(message) }
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
