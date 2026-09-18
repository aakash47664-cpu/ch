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
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
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
 * Builds system prompt defining CHEMDIAG INDUSTRIAL AI as a universal industrial and chemical engineering assistant.
 * Combines universal engineering capabilities with optional live ChemDiag Digital Twin telemetry.
 */
export function buildIndustrialSystemPrompt(liveState, processContext) {
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
 * Helper to sanitize strings of any sensitive keys
 */
export function sanitizeErrorMessage(msg) {
  if (!msg) return '';
  let sanitized = String(msg);
  if (process.env.GEMINI_API_KEY) {
    sanitized = sanitized.replaceAll(process.env.GEMINI_API_KEY, '[REDACTED_GEMINI_KEY]');
  }
  if (process.env.GROQ_API_KEY) {
    sanitized = sanitized.replaceAll(process.env.GROQ_API_KEY, '[REDACTED_GROQ_KEY]');
  }
  sanitized = sanitized.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]');
  sanitized = sanitized.replace(/gsk_[0-9A-Za-z]{30,}/g, '[REDACTED_KEY]');
  sanitized = sanitized.replace(/key=[^&\s"']+/gi, 'key=[REDACTED]');
  return sanitized;
}

// Concurrency mutex to prevent multiple simultaneous Gemini requests
let geminiExecutionQueue = Promise.resolve();

function enqueueSequential(task) {
  const next = geminiExecutionQueue.catch(() => {}).then(task);
  geminiExecutionQueue = next;
  return next;
}

export function isTemporaryGeminiError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.response?.status || err.httpStatus;
  if (status === 429 || status === 503 || status === 500 || status === 502 || status === 504) return true;
  const msg = String(err.message || err.details || err).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('service unavailable') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('timeout') ||
    msg.includes('fetch failed') ||
    msg.includes('network')
  );
}

/**
 * Sends chat request to Google Gemini API with Tool Calling support (Single fast attempt for demo responsiveness)
 */
export async function chatWithGemini({
  message,
  conversation = [],
  processContext = null,
  liveState = null,
  systemPrompt = null
}) {
  return enqueueSequential(async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const err = new Error('GEMINI_API_KEY is not configured in the environment');
      err.status = 401;
      err.provider = 'Gemini';
      throw err;
    }

    const actualUserMessage = String(message || '').trim();
    const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const resolvedSystemPrompt = systemPrompt || buildIndustrialSystemPrompt(liveState, processContext);

    const ai = new GoogleGenAI({ apiKey });

    // Format and sanitize conversation history for Gemini contents format (strictly alternating user/model)
    const formattedContents = [];
    const rawHistory = (conversation || []).slice(-14);

    for (const turn of rawHistory) {
      if (!turn) continue;
      const text = String(turn.content || turn.text || turn.message || '').trim();
      if (!text) continue;

      const role = (turn.role === 'user' || turn.sender === 'user') ? 'user' : 'model';

      if (formattedContents.length === 0) {
        // Skip leading model turn (e.g. system welcome message) so contents begins with 'user'
        if (role === 'model') continue;
        formattedContents.push({ role, parts: [{ text }] });
      } else {
        const prev = formattedContents[formattedContents.length - 1];
        if (prev.role === role) {
          prev.parts[0].text += `\n${text}`;
        } else {
          formattedContents.push({ role, parts: [{ text }] });
        }
      }
    }

    // Append the current user message ensuring alternating sequence
    if (formattedContents.length > 0 && formattedContents[formattedContents.length - 1].role === 'user') {
      if (formattedContents[formattedContents.length - 1].parts[0]?.text?.trim() === actualUserMessage) {
        // Current message is already last turn
      } else {
        formattedContents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
        formattedContents.push({ role: 'user', parts: [{ text: actualUserMessage }] });
      }
    } else {
      formattedContents.push({ role: 'user', parts: [{ text: actualUserMessage }] });
    }

    const geminiTools = [{
      functionDeclarations: convertToolsToGeminiDeclarations(ENGINEERING_TOOL_DEFINITIONS)
    }];

    try {
      console.log(`[GEMINI SDK] Sending request to model: ${model}, prompt length: ${actualUserMessage.length}`);
      const firstRes = await ai.models.generateContent({
        model,
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
        console.log(`[GEMINI SDK] Invoking calculation tool: ${toolCall.name}`);

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

        const groundedRes = await ai.models.generateContent({
          model,
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
      const sanitizedMsg = sanitizeErrorMessage(sdkError.message || String(sdkError));
      const statusMatch = sanitizedMsg.match(/\b(400|401|403|404|429|500|502|503|504)\b/);
      const status = sdkError.status || sdkError.statusCode || sdkError.response?.status || (statusMatch ? parseInt(statusMatch[1], 10) : 500);

      console.error(`[GEMINI PROVIDER DIAGNOSTIC LOG] Status: ${status}, Message: ${sanitizedMsg}`);

      const enrichedError = new Error(sanitizedMsg);
      enrichedError.name = sdkError.name || 'GeminiApiError';
      enrichedError.status = status;
      enrichedError.provider = 'Gemini';
      enrichedError.model = model;
      enrichedError.isTemporary = isTemporaryGeminiError(sdkError) || status === 429 || status === 503 || status >= 500;
      enrichedError.originalError = sdkError;
      throw enrichedError;
    }
  });
}
