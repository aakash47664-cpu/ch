/**
 * ChemDiag — Dual-Engine AI Provider Router
 * 
 * Unifies Google Gemini and Groq Cloud Industrial AI providers behind
 * a single conversational interface with strict external provider routing:
 * 
 * When Gemini is selected -> Calls Google Gemini (gemini-3.6-flash)
 * When Groq is selected   -> Calls Groq Cloud (llama-3.3-70b-versatile)
 * Failover is allowed ONLY between real external providers:
 *   Gemini -> Groq
 *   Groq   -> Gemini
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { chatWithGemini, isGeminiConfigured, getGeminiHealth, isTemporaryGeminiError, buildIndustrialSystemPrompt } from './geminiService.js';
import { chatWithGroq, isGroqConfigured, getGroqHealth } from './groqService.js';

export { buildIndustrialSystemPrompt };

/**
 * Returns comprehensive AI health status for all integrated providers
 */
export function getCombinedAiHealth() {
  const geminiHealth = getGeminiHealth();
  const groqHealth = getGroqHealth();

  const anyConfigured = geminiHealth.configured || groqHealth.configured;
  const primaryProvider = geminiHealth.configured ? 'Gemini' : (groqHealth.configured ? 'Groq' : 'Gemini');

  return {
    provider: primaryProvider,
    configured: anyConfigured,
    status: anyConfigured ? 'ONLINE' : 'UNCONFIGURED',
    providers: {
      gemini: geminiHealth,
      groq: groqHealth
    },
    primary: 'Gemini',
    fallback: 'Groq',
    calculationEngine: 'ACTIVE',
    timestamp: new Date().toISOString()
  };
}

/**
 * Dispatches a chat message with GEMINI = PRIMARY PROVIDER and GROQ = AUTOMATIC FALLBACK
 */
export async function dispatchAiChat({
  provider = 'gemini',
  message,
  conversation = [],
  processContext = null,
  liveState = null,
  selectedEquipment = null
}) {
  const actualUserMessage = String(message || '').trim();
  const reqProvider = String(provider || '').toLowerCase().trim();

  // Clean conversation history
  const cleanConversation = (conversation || [])
    .filter(turn => turn && (turn.content || turn.text || turn.message))
    .map(turn => ({
      role: (turn.role === 'user' || turn.sender === 'user') ? 'user' : 'assistant',
      content: String(turn.content || turn.text || turn.message)
    }));

  const state = liveState || processContext;
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const groqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  // 1. Explicit Groq selection by user
  if (reqProvider === 'groq') {
    if (!isGroqConfigured()) {
      const err = new Error('Groq provider is not configured in the environment');
      err.status = 401;
      err.provider = 'Groq';
      throw err;
    }
    console.log(`[AI ROUTER] User selected Groq directly (${groqModel})...`);
    const reply = await chatWithGroq({
      message: actualUserMessage,
      conversation: cleanConversation,
      processContext: state,
      liveState: state
    });
    return {
      success: true,
      text: reply.trim(),
      response: reply.trim(),
      answer: reply.trim(),
      provider: 'Groq',
      model: groqModel,
      fallback: false,
      timestamp: new Date().toISOString()
    };
  }

  // 2. Primary Execution: Google Gemini
  let geminiError = null;

  if (isGeminiConfigured()) {
    try {
      console.log(`[AI ROUTER] Calling primary provider: Gemini (${geminiModel})...`);
      const reply = await chatWithGemini({
        message: actualUserMessage,
        conversation: cleanConversation,
        processContext: state,
        liveState: state
      });

      if (reply && reply.trim().length > 0) {
        return {
          success: true,
          text: reply.trim(),
          response: reply.trim(),
          answer: reply.trim(),
          provider: 'Gemini',
          model: geminiModel,
          fallback: false,
          timestamp: new Date().toISOString()
        };
      }
    } catch (err) {
      geminiError = err;
      console.warn(`[AI ROUTER] Primary Gemini call failed (${err.status || 'error'}): ${err.message}`);
    }
  } else {
    geminiError = new Error('GEMINI_API_KEY is not configured in the environment');
    geminiError.status = 401;
    geminiError.isTemporary = true;
    console.warn('[AI ROUTER] Gemini is not configured, evaluating Groq fallback...');
  }

  // 3. Automatic Groq Fallback for Gemini failures
  if (geminiError && isGroqConfigured()) {
    console.log(`[AI ROUTER] ⚡ Gemini failure detected (${geminiError?.status || 'error'}). Automatically executing Groq fallback (${groqModel})...`);
    try {
      const groqReply = await chatWithGroq({
        message: actualUserMessage,
        conversation: cleanConversation,
        processContext: state,
        liveState: state
      });

      if (groqReply && groqReply.trim().length > 0) {
        console.log(`[AI ROUTER] ✅ Groq fallback succeeded!`);
        return {
          success: true,
          text: groqReply.trim(),
          response: groqReply.trim(),
          answer: groqReply.trim(),
          provider: 'Groq',
          model: groqModel,
          fallback: true,
          fallbackNotice: 'GROQ FALLBACK',
          timestamp: new Date().toISOString()
        };
      }
    } catch (groqErr) {
      console.error(`[AI ROUTER] Groq fallback also encountered an error: ${groqErr.message}`);
      const combinedError = new Error('Both AI providers are currently unavailable');
      combinedError.status = 503;
      combinedError.provider = 'none';
      throw combinedError;
    }
  }

  // 4. If Groq is not configured or error is permanent
  if (geminiError) {
    throw geminiError;
  }

  const unavailError = new Error('Both AI providers are currently unavailable');
  unavailError.status = 503;
  unavailError.provider = 'none';
  throw unavailError;
}
