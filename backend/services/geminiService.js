/**
 * ChemDiag — Google Gemini Cloud Industrial AI Service
 * 
 * Powered by Google GenAI SDK (@google/genai) using process.env.GEMINI_API_KEY.
 * Provides fast, high-accuracy conversational intelligence across
 * universal industrial/chemical engineering domains with dynamic
 * live ChemDiag Digital Twin process grounding and deterministic tool calling.
 */

import { GoogleGenAI } from '@google/genai';
import { ENGINEERING_TOOL_DEFINITIONS, executeEngineeringTool } from '../engineering/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded reliably regardless of current working directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Returns whether GEMINI_API_KEY is configured in the environment
 */
export function isGeminiConfigured() {
  const key = process.env.GEMINI_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}

/**
 * Returns Gemini AI health metadata (never exposes the secret key)
 */
export function getGeminiHealth() {
  const configured = isGeminiConfigured();
  return {
    provider: 'Gemini',
    configured,
    status: configured ? 'ONLINE' : 'UNCONFIGURED',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    calculationEngine: 'ACTIVE'
  };
}

/**
 * Converts standard JSON-schema tool definitions into Gemini FunctionDeclaration format
 */
function convertToolsToGeminiDeclarations(tools) {
  return tools.map(t => {
    const fn = t.function;
    const convertProperties = (props) => {
      const result = {};
      for (const [key, val] of Object.entries(props || {})) {
        result[key] = {
          type: (val.type || 'string').toUpperCase(),
          description: val.description || ''
        };
        if (val.enum) result[key].enum = val.enum;
      }
      return result;
    };

    return {
      name: fn.name,
      description: fn.description,
      parameters: {
        type: 'OBJECT',
        properties: convertProperties(fn.parameters?.properties),
        required: fn.parameters?.required || []
      }
    };
  });
}

/**
 * Builds system prompt combining universal conversational capability,
 * deep engineering expertise, deterministic calculation tools, and optional ChemDiag process telemetry.
 */
export function buildIndustrialSystemPrompt(liveState, processContext) {
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

CORE CAPABILITIES & CONVERSATIONAL RULES:
1. Universal Engineering Intelligence: Answer the user's actual question directly, accurately, and naturally across chemical, mechanical, electrical, and process engineering.
2. Real Deterministic Calculation Tools: You have access to precise engineering calculation functions for fluid mechanics (velocity, Reynolds, pressure drop, pump power, NPSH), heat transfer (sensible duty Q = m·Cp·ΔT, LMTD, exchanger area, conduction), thermodynamics (ideal gas, compressor power, Carnot efficiency), reaction engineering (Arrhenius, conversion, residence time, CSTR sizing), mass transfer (Fenske stages, minimum reflux), process control (PID error, PID output), and equipment (control valve Cv, tanks).
3. Tool Usage & Calculation Transparency: Whenever a user requests an engineering calculation or provides numbers, invoke the appropriate calculation tool to compute the exact result. When presenting the calculation, explain the Given values, Governing Equation, Substitution, Computed Result with Units, Assumptions, and Engineering Interpretation clearly and naturally.
4. Continuous Conversational Context: Maintain conversation history across turns. When the user asks follow-up questions (e.g. "Why did you divide by 3600?", "What if the diameter becomes 50 mm?", "How does that affect pressure drop?", "Why does it oscillate?", "How would I fix that?"), interpret them in the context of the ongoing discussion without requiring repetition.
5. Seamless Topic Switching: If the user changes topics (e.g. "Okay forget PID. Explain compressor surge"), naturally pivot to the new topic.
6. Selective Plant Context: You have optional background telemetry from the live ChemDiag plant simulation below. Use this data ONLY when the user asks about the live process, plant status, or specific equipment (e.g. "Estimate the hydraulic power of my current pump", "Check P-101", "Why is the reactor hot?"). Do NOT force unrelated queries into plant context.
7. Mathematical & Calculation Formatting:
- Present mathematical equations clearly using LaTeX display math $$...$$ (e.g. $$v = \\frac{Q}{A}$$ or $$A = \\frac{\\pi D^2}{4}$$) or inline math $ ... $.
- Format input parameters, step results, and comparisons cleanly using Markdown tables and bullet points.
- Always include standard chemical engineering units (e.g. m², m³, m/s, m³/h, kg/m³, kJ/(kg·K), kPa, °C).
${plantContextSection}`;
}

/**
 * Helper to call Gemini SDK with model fallback support
 */
async function callGeminiGenerate(ai, primaryModel, params) {
  const candidateModels = [
    primaryModel,
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-3-flash-preview',
    'gemini-3.6-flash',
    'gemini-2.5-flash'
  ];

  // Filter unique model names
  const modelsToTry = [...new Set(candidateModels.filter(Boolean))];

  let lastError = null;
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        ...params,
        model
      });
      return { response, usedModel: model };
    } catch (err) {
      lastError = err;
      const msg = String(err.message || '');
      const isRecoverable =
        msg.includes('404') ||
        msg.includes('no longer available') ||
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('quota') ||
        msg.includes('503') ||
        msg.includes('high demand') ||
        err.status === 404 ||
        err.status === 429 ||
        err.status === 503;

      if (isRecoverable) {
        console.warn(`Gemini model ${model} unavailable (${msg.slice(0, 90)}), trying fallback candidate...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Sends chat request to Google Gemini API with Tool Calling support
 */
export async function chatWithGemini({
  message,
  conversation = [],
  processContext = null,
  liveState = null,
  systemPrompt = null
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the environment');
  }

  const actualUserMessage = String(message || '').trim();
  console.log("CHEMDIAG GEMINI USER MESSAGE:", actualUserMessage);

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const resolvedSystemPrompt = systemPrompt || buildIndustrialSystemPrompt(liveState, processContext);

  const ai = new GoogleGenAI({ apiKey });

  // Format conversation history for Gemini contents format
  const formattedContents = [];
  const rawHistory = (conversation || []).slice(-14);

  for (const turn of rawHistory) {
    if (!turn) continue;
    const text = String(turn.content || turn.text || turn.message || '').trim();
    if (!text) continue;

    const role = (turn.role === 'user' || turn.sender === 'user') ? 'user' : 'model';
    formattedContents.push({
      role,
      parts: [{ text }]
    });
  }

  // Ensure current user message is not duplicated at the end of history
  if (
    formattedContents.length > 0 &&
    formattedContents[formattedContents.length - 1].role === 'user' &&
    formattedContents[formattedContents.length - 1].parts[0]?.text?.trim() === actualUserMessage
  ) {
    formattedContents.pop();
  }

  formattedContents.push({
    role: 'user',
    parts: [{ text: actualUserMessage }]
  });

  const geminiTools = [{
    functionDeclarations: convertToolsToGeminiDeclarations(ENGINEERING_TOOL_DEFINITIONS)
  }];

  try {
    const { response: firstRes, usedModel } = await callGeminiGenerate(ai, model, {
      contents: formattedContents,
      config: {
        systemInstruction: resolvedSystemPrompt,
        temperature: 0.2,
        tools: geminiTools
      }
    });

    const functionCalls = firstRes.functionCalls;

    // Handle Tool Calling
    if (functionCalls && functionCalls.length > 0) {
      const toolCall = functionCalls[0];
      console.log(`CHEMDIAG GEMINI INVOKING CALCULATION TOOL: ${toolCall.name}`);

      let toolResult;
      try {
        toolResult = await executeEngineeringTool(
          toolCall.name,
          toolCall.args,
          liveState || processContext
        );
      } catch (toolErr) {
        console.warn(`Error executing tool ${toolCall.name}:`, toolErr.message);
        toolResult = { success: false, error: toolErr.message };
      }

      // Re-invoke Gemini with calculation result grounded in prompt
      const groundedPrompt = `The operator asked: "${actualUserMessage}"\n\n` +
        `Deterministic Engineering Calculation Output (${toolCall.name}):\n` +
        `Summary: ${toolResult.summary || ''}\n` +
        `Given Inputs: ${JSON.stringify(toolResult.inputs || {})}\n` +
        `Equations: ${JSON.stringify(toolResult.equations || [])}\n` +
        `Substitutions: ${JSON.stringify(toolResult.substitutions || [])}\n` +
        `Results: ${JSON.stringify(toolResult.results || {})}\n` +
        `Assumptions: ${JSON.stringify(toolResult.assumptions || [])}\n\n` +
        `Please present the complete engineering calculation clearly to the operator including Given parameters, SI unit conversions, Governing equation, Step-by-step substitution, Final result with units, and Practical engineering interpretation.`;

      const { response: groundedRes } = await callGeminiGenerate(ai, usedModel, {
        contents: [
          ...formattedContents.slice(0, -1),
          { role: 'user', parts: [{ text: actualUserMessage }] },
          { role: 'user', parts: [{ text: groundedPrompt }] }
        ],
        config: {
          systemInstruction: resolvedSystemPrompt,
          temperature: 0.2
        }
      });

      const finalReply = groundedRes.text?.trim();
      if (finalReply) return finalReply;
    }

    const reply = firstRes.text?.trim();
    if (!reply) {
      throw new Error('Empty response received from Gemini API');
    }

    return reply;
  } catch (sdkError) {
    console.warn('Gemini SDK call error:', sdkError.message);
    throw sdkError;
  }
}
