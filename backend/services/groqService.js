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
 * Builds system prompt combining universal conversational capability,
 * deep engineering expertise, and optional ChemDiag process telemetry.
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
OPTIONAL LIVE CHEMDIAG PROCESS CONTEXT (USE ONLY WHEN RELEVANT):
=======================================================
NOTE: The following is background telemetry from the connected ChemDiag plant simulation. Use this context ONLY when the user asks about the plant, the current process, or specific equipment (P-101, E-101, R-101, D-101). Do NOT mention this data or these units if the user is asking general, scientific, or unrelated questions.

Process Architecture: Water Reservoir -> P-101 (Centrifugal Pump) -> E-101 (Counter-Flow Heat Exchanger) -> R-101 (CSTR Reactor) -> D-101 (Distillation Column)
Current Telemetry:
- Status: ${activeFault} (${diagnosis.severity || 'NORMAL'} Severity)
- P-101 Pump: Speed = ${pump.rpm ? Math.round(pump.rpm) + ' RPM' : 'N/A'}, Vibration = ${pump.vibration !== undefined ? pump.vibration.toFixed(2) + ' g' : 'N/A'}, Flow = ${pump.flow !== undefined ? pump.flow.toFixed(1) + ' L/min' : 'N/A'}, Suction T = ${pump.inlet_temperature !== undefined ? pump.inlet_temperature.toFixed(1) + ' °C' : 'N/A'}, Discharge T = ${pump.outlet_temperature !== undefined ? pump.outlet_temperature.toFixed(1) + ' °C' : 'N/A'}
- E-101 Heat Exchanger: Inlet T = ${hx.inlet_temperature !== undefined ? hx.inlet_temperature.toFixed(1) + ' °C' : 'N/A'}, Outlet T = ${hx.outlet_temperature !== undefined ? hx.outlet_temperature.toFixed(1) + ' °C' : 'N/A'}, ΔT = ${hx.temperature_difference !== undefined ? hx.temperature_difference.toFixed(1) + ' °C' : 'N/A'}, Efficiency = ${(hx.efficiency ?? hx.heat_transfer_indicator ?? 'N/A')}%
- R-101 CSTR Reactor: Core Temp = ${reactor.temperature !== undefined ? reactor.temperature.toFixed(1) + ' °C' : 'N/A'}, Pressure = ${reactor.pressure !== undefined ? reactor.pressure.toFixed(2) + ' bar' : 'N/A'}, Cooling = ${reactor.cooling_status === 1 ? 'ACTIVE (1 - ON)' : 'TRIPPED (0 - OFF)'}
- D-101 Distillation: Top Temp = ${dist.top_temperature !== undefined ? dist.top_temperature.toFixed(1) + ' °C' : 'N/A'}, Bottom Temp = ${dist.bottom_temperature !== undefined ? dist.bottom_temperature.toFixed(1) + ' °C' : 'N/A'}, Column Pressure = ${dist.pressure !== undefined ? dist.pressure.toFixed(2) + ' bar' : 'N/A'}, Reflux Ratio = ${dist.reflux_ratio !== undefined ? dist.reflux_ratio.toFixed(2) + ' L/D' : 'N/A'}
- AI Diagnosis: ${diagnosis.probable_fault || diagnosis.fault || 'Nominal Operation'} (Confidence: ${Math.round((diagnosis.confidence || 0.95) * 100)}%)
- Safety Gate Directive: ${diagnosis.safetyGate?.directive || '✓ CONTINUE ROUTINE MONITORING'}
- Unknown Fault Guard: ${diagnosis.is_unknown_fault ? 'TRIGGERED (Uncertain anomaly - DO NOT ACT)' : 'NORMAL'}
`;
  }

  return `You are ChemDiag Industrial AI, an expert, highly capable conversational assistant with world-class knowledge in chemical engineering, process operations, instrumentation, control systems, and thermodynamics.

CORE CONVERSATIONAL RULES:
1. Answer the user's actual question directly, accurately, and naturally.
2. Continuous Conversational Context: Always maintain and use the recent conversation history to interpret follow-up questions, pronouns ("it", "that", "this"), and topic continuations (e.g., "why does it oscillate?", "how would I fix that?", "what if the process has a large dead time?", "what causes it?", "what should I check first?").
3. Seamless Topic Switching: If the user changes topics (e.g., "Okay forget PID. Explain compressor surge"), naturally pivot to the new topic and interpret subsequent follow-ups in that new context.
4. Selective Plant Context: You have optional background telemetry from the live ChemDiag plant simulation below. Use this data ONLY when the user asks about the live process, plant status, or specific equipment (e.g., "Could my pump have it?", "Check P-101", "Why is the reactor hot?").
5. Do NOT force unrelated questions (e.g., "Why is the sky blue?", general PID theory, compressor surge theory) into an industrial plant/telemetry context.
6. Do NOT invent sensor numbers or make up equipment that does not exist. Adapt technical depth to the user's request.
${plantContextSection}`;
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
    .slice(-14) // Keep recent 14 turns for rich multi-turn context
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
