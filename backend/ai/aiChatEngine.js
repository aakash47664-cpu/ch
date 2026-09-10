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
  const { equipment = {}, diagnosis = {}, activeFault = 'normal' } = liveState || {};

  const pump = equipment.pump?.data || { rpm: 2450, vibration: 0.08, flow: 10.0, inlet_temperature: 25.2, outlet_temperature: 38.1 };
  const hx = equipment.heat_exchanger?.data || { inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, heat_transfer_indicator: 95.0, efficiency: 95.0 };
  const reactor = equipment.reactor?.data || { temperature: 65.0, pressure: 2.05, level: 50.0, agitator_speed: 350, cooling_status: 1 };
  const dist = equipment.distillation?.data || { top_temperature: 76.5, bottom_temperature: 98.4, pressure: 2.10, level: 52.0, reflux_ratio: 1.85 };

  const plantContextSection = `
=======================================================
OPTIONAL LIVE CHEMDIAG PROCESS CONTEXT (USE ONLY WHEN RELEVANT):
=======================================================
NOTE: The following is background telemetry from the connected ChemDiag plant simulation. Use this context ONLY when the user asks about the plant, the current process, or specific equipment (P-101, E-101, R-101, D-101). Do NOT mention this data or these units if the user is asking general, scientific, or unrelated questions.

Process Architecture: Water Reservoir -> P-101 (Centrifugal Pump) -> E-101 (Counter-Flow Heat Exchanger) -> R-101 (CSTR Reactor) -> D-101 (Distillation Column)
Current Telemetry:
- Status: ${activeFault} (${diagnosis.severity || 'NORMAL'} Severity)
- P-101 Pump: Speed = ${Math.round(pump.rpm || 2450)} RPM, Vibration = ${(pump.vibration ?? 0.08).toFixed(2)} g, Flow = ${(pump.flow ?? 10.0).toFixed(1)} L/min
- E-101 Heat Exchanger: Inlet T = ${(hx.inlet_temperature ?? 25.2).toFixed(1)} °C, Outlet T = ${(hx.outlet_temperature ?? 38.1).toFixed(1)} °C, ΔT = ${(hx.temperature_difference ?? 12.9).toFixed(1)} °C
- R-101 CSTR Reactor: Core Temp = ${(reactor.temperature ?? 65.0).toFixed(1)} °C, Pressure = ${(reactor.pressure ?? 2.05).toFixed(2)} bar, Cooling = ${reactor.cooling_status === 1 ? 'ON' : 'TRIPPED/OFF'}
- D-101 Distillation: Top Temp = ${(dist.top_temperature ?? 76.5).toFixed(1)} °C, Reflux Ratio = ${(dist.reflux_ratio ?? 1.85).toFixed(2)}
- AI Diagnosis: ${diagnosis.probable_fault || 'Nominal Operation'}
- Safety Gate Directive: ${diagnosis.safetyGate?.directive || '✓ CONTINUE ROUTINE MONITORING'}
`;

  return `You are a highly capable conversational AI with strong expertise in industrial and chemical engineering.
Answer the user's actual request directly, accurately, and naturally.
You have optional access to ChemDiag live process context below. Use that context ONLY when it is relevant to the user's request.
Do NOT force unrelated questions into an industrial-process context.
Do NOT mention P-101, E-101, R-101, D-101, or plant telemetry unless the user asks about them or asks about the live process.
Do NOT invent data. Maintain conversation context across turns. Adapt technical depth to the user's request.
${plantContextSection}`;
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
