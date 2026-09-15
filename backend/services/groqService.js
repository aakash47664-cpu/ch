/**
 * ChemDiag — Groq Cloud Industrial AI Service
 * 
 * Powered by Groq Cloud API using process.env.GROQ_API_KEY.
 * Provides fast, high-accuracy conversational intelligence across
 * universal industrial/chemical engineering domains with dynamic
 * live ChemDiag Digital Twin process grounding.
 */

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
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    calculationEngine: 'ACTIVE'
  };
}

/**
 * Builds system prompt combining universal conversational capability,
 * deep engineering expertise, deterministic calculation tools, and optional ChemDiag process telemetry.
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

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const systemPrompt = buildSystemPrompt(liveState, processContext);

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

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formattedHistory,
    { role: 'user', content: actualUserMessage }
  ];

  try {
    const groq = new Groq({ apiKey });

    let completion = await groq.chat.completions.create({
      model,
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
        model,
        messages,
        temperature: 0.2,
        max_tokens: 1024
      });

      const finalReply = finalCompletion.choices?.[0]?.message?.content?.trim();
      if (finalReply) return finalReply;
    }

    const reply = choice?.message?.content?.trim();
    if (!reply) {
      throw new Error('Empty response received from Groq API');
    }

    return reply;
  } catch (sdkError) {
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
          tools: ENGINEERING_TOOL_DEFINITIONS,
          tool_choice: 'auto',
          temperature: 0.2,
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
      const choice = data.choices?.[0];
      const toolCalls = choice?.message?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
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
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify({ success: false, error: toolErr.message })
            });
          }
        }

        const secondRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.2,
            max_tokens: 1024
          })
        });
        const secondData = await secondRes.json();
        return secondData.choices?.[0]?.message?.content?.trim() || 'Calculation completed successfully.';
      }

      const reply = choice?.message?.content?.trim();
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
