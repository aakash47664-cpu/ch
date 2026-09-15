/**
 * ChemDiag — Dual-Engine AI Provider Router
 * 
 * Unifies Google Gemini and Groq Cloud Industrial AI providers behind
 * a single conversational interface with strict external provider routing:
 * 
 * When Gemini is selected -> Calls Google Gemini (gemini-2.5-flash)
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

import { chatWithGemini, isGeminiConfigured, getGeminiHealth, buildIndustrialSystemPrompt } from './geminiService.js';
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
    calculationEngine: 'ACTIVE',
    timestamp: new Date().toISOString()
  };
}

/**
 * Dispatches a chat message to the designated AI provider (Gemini or Groq)
 * with strict external failover and ZERO silent substitution with local rule engine.
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
  let primaryFn = null;
  let secondaryFn = null;
  let primaryProviderKey = 'gemini';
  let secondaryProviderKey = 'groq';
  let primaryModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  let secondaryModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  if (reqProvider === 'groq') {
    primaryProviderKey = 'groq';
    secondaryProviderKey = 'gemini';
    primaryModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    secondaryModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    primaryFn = isGroqConfigured()
      ? () => chatWithGroq({ message: actualUserMessage, conversation: cleanConversation, processContext: state, liveState: state })
      : null;
    secondaryFn = isGeminiConfigured()
      ? () => chatWithGemini({ message: actualUserMessage, conversation: cleanConversation, processContext: state, liveState: state })
      : null;
  } else {
    // Default to Gemini
    primaryProviderKey = 'gemini';
    secondaryProviderKey = 'groq';
    primaryModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    secondaryModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    primaryFn = isGeminiConfigured()
      ? () => chatWithGemini({ message: actualUserMessage, conversation: cleanConversation, processContext: state, liveState: state })
      : null;
    secondaryFn = isGroqConfigured()
      ? () => chatWithGroq({ message: actualUserMessage, conversation: cleanConversation, processContext: state, liveState: state })
      : null;
  }

  let lastError = null;

  // 1. Execute Primary Provider (Real API)
  if (primaryFn) {
    try {
      console.log(`[AI ROUTER] Invoking primary external provider: ${primaryProviderKey} (${primaryModel})...`);
      const response = await primaryFn();
      if (response && response.trim().length > 0) {
        return {
          success: true,
          text: response.trim(),
          response: response.trim(),
          answer: response.trim(),
          provider: primaryProviderKey,
          model: primaryModel,
          timestamp: new Date().toISOString()
        };
      }
    } catch (err) {
      lastError = err;
      console.warn(`[AI ROUTER] Primary AI provider (${primaryProviderKey}) error:`, err.message);
    }
  } else {
    console.warn(`[AI ROUTER] Primary AI provider (${primaryProviderKey}) is not configured.`);
  }

  // 2. Failover to Secondary External Provider (Gemini <-> Groq ONLY)
  if (secondaryFn) {
    try {
      console.log(`[AI ROUTER] Failing over to secondary external AI provider: ${secondaryProviderKey} (${secondaryModel})...`);
      const response = await secondaryFn();
      if (response && response.trim().length > 0) {
        return {
          success: true,
          text: response.trim(),
          response: response.trim(),
          answer: response.trim(),
          provider: secondaryProviderKey,
          model: secondaryModel,
          failover: true,
          timestamp: new Date().toISOString()
        };
      }
    } catch (err) {
      lastError = err;
      console.warn(`[AI ROUTER] Secondary AI provider (${secondaryProviderKey}) error:`, err.message);
    }
  }

  // If external AI cannot answer, throw an informative error so user knows exact provider status
  const errorDetail = lastError?.message || `Provider ${primaryProviderKey} is not configured or unavailable`;
  throw new Error(`ChemDiag AI external provider failure (${primaryProviderKey}): ${errorDetail}`);
}
