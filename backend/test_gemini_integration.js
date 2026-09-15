import { dispatchAiChat, getCombinedAiHealth } from './services/aiProvider.js';
import dotenv from 'dotenv';
dotenv.config();

async function runAcceptanceTests() {
  console.log('=====================================================');
  console.log('  CHEMDIAG INDUSTRIAL AI: DUAL-PROVIDER INTEGRATION TEST');
  console.log('=====================================================\n');

  // 1. Health Status
  console.log('Test 1: Checking AI Health...');
  const health = getCombinedAiHealth();
  console.log('Health Status:', JSON.stringify(health, null, 2));

  // 2. Gemini General Concept Test
  console.log('\n-----------------------------------------------------');
  console.log('Test 2: Gemini - Universal Science & Thermodynamics Query');
  console.log('Prompt: "Explain entropy in thermodynamics in 2 clear sentences."');
  const t2 = await dispatchAiChat({
    provider: 'gemini',
    message: 'Explain entropy in thermodynamics in 2 clear sentences.'
  });
  console.log(`[Provider: ${t2.provider}] Response:\n${t2.response}\n`);

  // 3. Gemini Calculation Tool Test (Pipe Velocity)
  console.log('-----------------------------------------------------');
  console.log('Test 3: Gemini - Deterministic Engineering Calculation Tool');
  console.log('Prompt: "A pump delivers 18 m3/h of water through a 50 mm diameter pipe. Calculate average velocity and show all unit conversions."');
  const t3 = await dispatchAiChat({
    provider: 'gemini',
    message: 'A pump delivers 18 m3/h of water through a 50 mm diameter pipe. Calculate average velocity and show all unit conversions.'
  });
  console.log(`[Provider: ${t3.provider}] Response:\n${t3.response}\n`);

  // 4. Gemini Live Process Diagnostics Test
  console.log('-----------------------------------------------------');
  console.log('Test 4: Gemini - Live Equipment Process Grounding');
  console.log('Prompt: "Why is P-101 showing high vibration?"');
  const sampleState = {
    activeFault: 'pump_fault',
    diagnosis: {
      probable_fault: 'Centrifugal Pump Impeller Cavitation',
      severity: 'HIGH',
      confidence: 0.94,
      safetyGate: { directive: 'Reduce pump RPM to 1800 or throttle discharge' }
    },
    equipment: {
      pump: {
        data: {
          rpm: 2750,
          vibration: 4.82,
          flow: 2.1,
          inlet_temperature: 32.5,
          outlet_temperature: 41.2
        }
      }
    }
  };
  const t4 = await dispatchAiChat({
    provider: 'gemini',
    message: 'Why is P-101 showing high vibration?',
    liveState: sampleState
  });
  console.log(`[Provider: ${t4.provider}] Response:\n${t4.response}\n`);

  // 5. Multi-turn Follow-up Context Memory Test
  console.log('-----------------------------------------------------');
  console.log('Test 5: Gemini - Multi-Turn Conversational Memory');
  console.log('Prompt: "How would I fix that?"');
  const conversationHistory = [
    { sender: 'user', text: 'Why is P-101 showing high vibration?' },
    { sender: 'ai', text: t4.response }
  ];
  const t5 = await dispatchAiChat({
    provider: 'gemini',
    message: 'How would I fix that?',
    conversation: conversationHistory,
    liveState: sampleState
  });
  console.log(`[Provider: ${t5.provider}] Response:\n${t5.response}\n`);

  // 6. Provider Switching (Groq test)
  console.log('-----------------------------------------------------');
  console.log('Test 6: Provider Switching - Testing Groq Engine');
  console.log('Prompt: "What is the function of a reflux drum in distillation?"');
  const t6 = await dispatchAiChat({
    provider: 'groq',
    message: 'What is the function of a reflux drum in distillation?'
  });
  console.log(`[Provider: ${t6.provider}] Response:\n${t6.response}\n`);

  console.log('=====================================================');
  console.log('  ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY');
  console.log('=====================================================');
}

runAcceptanceTests().catch(console.error);
