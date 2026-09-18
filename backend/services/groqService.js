import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded reliably
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Groq } from 'groq-sdk';
import { ENGINEERING_TOOL_DEFINITIONS, executeEngineeringTool } from '../engineering/index.js';

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
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    calculationEngine: 'ACTIVE'
  };
}

/**
 * Builds system prompt defining CHEMDIAG INDUSTRIAL AI as a universal industrial and chemical engineering assistant.
 * Combines universal engineering capabilities with optional live ChemDiag Digital Twin telemetry.
 */
export function buildUniversalSystemPrompt(liveState, processContext) {
  let plantContextSection = '';

  const state = liveState || processContext;
  if (state && (state.equipment || state.diagnosis)) {
    const { equipment = {}, diagnosis = {}, activeFault = 'normal', streams = {}, faultSeverity = 'NORMAL', recentAlerts = [] } = state;
    const pump = equipment.pump?.data || {};
    const hx = equipment.heat_exchanger?.data || {};
    const reactor = equipment.reactor?.data || {};
    const dist = equipment.distillation?.data || {};

    plantContextSection = `
=======================================================
OPTIONAL LIVE CHEMDIAG PROCESS CONTEXT (USE ONLY WHEN RELEVANT):
=======================================================
NOTE: The following is operational telemetry from the connected ChemDiag plant simulation. Use this context ONLY when the user asks about the live plant, the current process, active faults, or specific plant units (P-101, E-101, R-101, D-101). Do NOT restrict yourself to this context if the user is asking general, scientific, theoretical, calculation, or non-plant questions.

Process Architecture: Feed -> P-101 (Centrifugal Pump) -> E-101 (Counter-Flow Heat Exchanger) -> R-101 (CSTR Reactor) -> D-101 (Distillation Column)
Overall State: ${activeFault} | Severity: ${faultSeverity || diagnosis.severity || 'NORMAL'}
ML Diagnosis: ${diagnosis.probable_fault || diagnosis.fault || 'Nominal Operation'} (Confidence: ${Math.round((diagnosis.confidence || 0.95) * 100)}%)
Safety Gate Directive: ${diagnosis.safetyGate?.directive || '✓ CONTINUE ROUTINE MONITORING'}
${diagnosis.xai_evidence ? `XAI Evidence: ${JSON.stringify(diagnosis.xai_evidence)}` : ''}
${diagnosis.root_cause ? `Identified Root Cause: ${diagnosis.root_cause}` : ''}

Equipment Telemetry:
- P-101 Pump: Speed = ${pump.rpm ? Math.round(pump.rpm) + ' RPM' : 'N/A'}, Vibration = ${pump.vibration !== undefined ? pump.vibration.toFixed(2) + ' g' : 'N/A'}, Flow = ${pump.flow !== undefined ? pump.flow.toFixed(1) + ' L/min' : 'N/A'}, Suction T = ${pump.inlet_temperature !== undefined ? pump.inlet_temperature.toFixed(1) + ' °C' : 'N/A'}, Discharge T = ${pump.outlet_temperature !== undefined ? pump.outlet_temperature.toFixed(1) + ' °C' : 'N/A'}
- E-101 Heat Exchanger: Inlet T = ${hx.inlet_temperature !== undefined ? hx.inlet_temperature.toFixed(1) + ' °C' : 'N/A'}, Outlet T = ${hx.outlet_temperature !== undefined ? hx.outlet_temperature.toFixed(1) + ' °C' : 'N/A'}, ΔT = ${hx.temperature_difference !== undefined ? hx.temperature_difference.toFixed(1) + ' °C' : 'N/A'}, Efficiency = ${(hx.efficiency ?? hx.heat_transfer_indicator ?? 'N/A')}%
- R-101 CSTR Reactor: Core Temp = ${reactor.temperature !== undefined ? reactor.temperature.toFixed(1) + ' °C' : 'N/A'}, Pressure = ${reactor.pressure !== undefined ? reactor.pressure.toFixed(2) + ' bar' : 'N/A'}, Cooling = ${reactor.cooling_status === 1 ? 'ACTIVE (1 - ON)' : 'TRIPPED (0 - OFF)'}
- D-101 Distillation Column: Top Temp = ${dist.top_temperature !== undefined ? dist.top_temperature.toFixed(1) + ' °C' : 'N/A'}, Bottom Temp = ${dist.bottom_temperature !== undefined ? dist.bottom_temperature.toFixed(1) + ' °C' : 'N/A'}, Column Pressure = ${dist.pressure !== undefined ? dist.pressure.toFixed(2) + ' bar' : 'N/A'}, Reflux Ratio = ${dist.reflux_ratio !== undefined ? dist.reflux_ratio.toFixed(2) + ' L/D' : 'N/A'}
`;
  }

  return `CHEMDIAG INDUSTRIAL AI — a universal industrial and chemical engineering assistant.

You are an expert, highly capable industrial intelligence system with deep universal knowledge and analytical reasoning across:
- chemical engineering
- process engineering
- pumps
- compressors
- heat exchangers
- reactors
- distillation
- mass transfer
- heat transfer
- thermodynamics
- fluid mechanics
- process control
- instrumentation
- process safety
- troubleshooting
- maintenance
- industrial calculations
- general engineering

CORE CAPABILITIES & CONVERSATIONAL INSTRUCTIONS:
1. Universal Engineering Reasoning: Answer arbitrary engineering, scientific, and industrial questions directly and accurately using your pretrained language and engineering reasoning capabilities. You are NOT restricted to any fixed database or only four pieces of equipment.
2. Real Deterministic Calculations: You have access to precise engineering calculation tools for fluid flow (velocity, Reynolds, Darcy-Weisbach pressure drop, pump hydraulic power, NPSH), heat transfer (sensible heat duty Q = m·Cp·ΔT, LMTD, exchanger surface area, Fourier conduction), thermodynamics (ideal gas density/volume, compressor isentropic work, Carnot efficiency), reaction engineering (Arrhenius rate constants, reactor conversion, space time τ, CSTR sizing), mass transfer (Fenske minimum stages, Underwood minimum reflux), process control (PID error, PID output), and equipment (control valve Cv, vessel sizing).
3. Calculation Formatting: When performing calculations, explain the Given values, Governing Equation, Substitution with units, Computed Result, and Practical Engineering Interpretation clearly and cleanly using Markdown and LaTeX ($...$ or $$...$$).
4. Continuous Conversation Memory: Maintain conversation context across turns. When the user asks follow-up questions referencing previous concepts (e.g. "What is cavitation?", followed by "How would I detect it in P-101?"), seamlessly understand the references and provide coherent, context-aware answers.
5. Live Process Telemetry (Context): Live ChemDiag telemetry is supplied below as operational context. Use it when the user asks about the plant state, specific units, alarms, or diagnostics. For general or theoretical questions, provide general engineering explanations without forcing plant specifics.
${plantContextSection}`;
}

/**
 * Sends chat request to Groq Cloud API with Tool Calling support
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
  console.log("CHEMDIAG GROQ USER MESSAGE:", actualUserMessage);

  const primaryModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const fallbackModels = [primaryModel, 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
  const uniqueModels = [...new Set(fallbackModels)];

  const systemPrompt = buildUniversalSystemPrompt(liveState, processContext);

  // Format conversation history for Groq / OpenAI messages format
  const formattedHistory = (conversation || [])
    .slice(-14)
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

  const groq = new Groq({ apiKey });
  let lastError = null;

  for (const currentModel of uniqueModels) {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...formattedHistory,
      { role: 'user', content: actualUserMessage }
    ];

    try {
      console.log(`[GROQ] Attempting chat completion with model: ${currentModel}`);
      let completion = await groq.chat.completions.create({
        model: currentModel,
        messages,
        tools: ENGINEERING_TOOL_DEFINITIONS,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 1024
      });

      let choice = completion.choices?.[0];
      let toolCalls = choice?.message?.tool_calls;

      // Handle Groq Tool Calling
      if (toolCalls && toolCalls.length > 0) {
        console.log(`CHEMDIAG GROQ INVOKING CALCULATION TOOLS: ${toolCalls.map(t => t.function.name).join(', ')}`);
        messages.push(choice.message);

        for (const toolCall of toolCalls) {
          try {
            const toolResult = await executeEngineeringTool(
              toolCall.function.name,
              toolCall.function.arguments,
              liveState || processContext
            );
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(toolResult)
            });
          } catch (toolErr) {
            console.warn(`Error executing tool ${toolCall.function.name}:`, toolErr.message);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify({ success: false, error: toolErr.message })
            });
          }
        }

        // Re-invoke Groq to formulate natural engineering response with calculation results
        const finalCompletion = await groq.chat.completions.create({
          model: currentModel,
          messages,
          temperature: 0.2,
          max_tokens: 1024
        });

        const finalReply = finalCompletion.choices?.[0]?.message?.content?.trim();
        if (finalReply) return finalReply;
      }

      const reply = choice?.message?.content?.trim();
      if (reply) {
        return reply;
      }
    } catch (err) {
      lastError = err;
      const isRateLimit = String(err.message || '').toLowerCase().includes('rate limit') || 
                          String(err.message || '').includes('429') ||
                          String(err.status || '').includes('429');
      console.warn(`[GROQ] Error with model ${currentModel} (${err.status || err.message}):`, isRateLimit ? 'Rate limit / TPM exceeded, failing over to next model' : err.message);
      if (!isRateLimit && currentModel !== uniqueModels[uniqueModels.length - 1]) {
        // For other errors, continue to fallback model
        continue;
      }
    }
  }

  throw lastError || new Error('All Groq model attempts failed.');
}
