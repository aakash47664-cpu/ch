/**
 * Automated Verification Script: Multi-Turn Conversation Context
 * 
 * Verifies both sequences from user prompt:
 * Sequence 1:
 * - "Explain PID control."
 * - "Why does it oscillate?"
 * - "How would I fix that?"
 * - "What if the process has a large dead time?"
 * - "Okay forget PID. Explain compressor surge."
 * - "How would I detect it?"
 * 
 * Sequence 2:
 * - "What is cavitation?"
 * - "What causes it?"
 * - "Could my pump have it?"
 * - "What should I check first?"
 */

import { processAiChat } from './ai/aiChatEngine.js';

const nominalLiveState = {
  activeFault: 'normal',
  equipment: {
    pump: { data: { rpm: 2450, vibration: 0.08, flow: 10.0, inlet_temperature: 25.2, outlet_temperature: 38.1, status: 'NORMAL' } },
    heat_exchanger: { data: { inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, heat_transfer_indicator: 95.0, efficiency: 95.0, status: 'NORMAL' } },
    reactor: { data: { temperature: 65.0, pressure: 2.05, cooling_status: 1, status: 'NORMAL' } },
    distillation: { data: { top_temperature: 76.5, bottom_temperature: 98.4, pressure: 2.10, reflux_ratio: 1.85, status: 'NORMAL' } }
  },
  diagnosis: {
    anomaly: false,
    severity: 'NORMAL',
    fault: 'Nominal Operation',
    confidence: 0.95,
    safetyGate: { safeToRecommend: true, statusLabel: '✓ SAFE TO RECOMMEND' }
  }
};

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('=== MULTI-TURN CONVERSATION CONTEXT VERIFICATION ===\n');

  // ==========================================
  // SEQUENCE 1
  // ==========================================
  console.log('--- Sequence 1: PID Control -> Oscillation -> Fix -> Dead Time -> Forget PID / Surge -> Detection ---');
  let historySeq1 = [];

  // Turn 1
  const t1Prompt = "Explain PID control.";
  const t1Res = await processAiChat({ message: t1Prompt, conversation: historySeq1, liveState: nominalLiveState });
  assert(
    t1Res.answer.includes('PID') && (t1Res.answer.includes('Proportional') || t1Res.answer.includes('Integral')),
    'Turn 1: Explains PID control directly'
  );
  assert(!t1Res.answer.includes('P-101') && !t1Res.answer.includes('E-101'), 'Turn 1: Does not dump plant equipment');
  historySeq1.push({ role: 'user', content: t1Prompt });
  historySeq1.push({ role: 'assistant', content: t1Res.answer });

  // Turn 2
  const t2Prompt = "Why does it oscillate?";
  const t2Res = await processAiChat({ message: t2Prompt, conversation: historySeq1, liveState: nominalLiveState });
  assert(
    (t2Res.answer.includes('Gain') || t2Res.answer.includes('Integral') || t2Res.answer.includes('Phase Lag') || t2Res.answer.includes('OSCILLATE')) &&
    !t2Res.answer.includes('Compressor'),
    'Turn 2: Correctly understands "it" as PID loop and explains oscillation causes'
  );
  historySeq1.push({ role: 'user', content: t2Prompt });
  historySeq1.push({ role: 'assistant', content: t2Res.answer });

  // Turn 3
  const t3Prompt = "How would I fix that?";
  const t3Res = await processAiChat({ message: t3Prompt, conversation: historySeq1, liveState: nominalLiveState });
  assert(
    (t3Res.answer.includes('Reduce') || t3Res.answer.includes('Gain') || t3Res.answer.includes('Tuning') || t3Res.answer.includes('Reset Time') || t3Res.answer.includes('Lambda')),
    'Turn 3: Correctly understands "that" as loop oscillation and explains tuning/fixing approaches'
  );
  historySeq1.push({ role: 'user', content: t3Prompt });
  historySeq1.push({ role: 'assistant', content: t3Res.answer });

  // Turn 4
  const t4Prompt = "What if the process has a large dead time?";
  const t4Res = await processAiChat({ message: t4Prompt, conversation: historySeq1, liveState: nominalLiveState });
  assert(
    (t4Res.answer.includes('Dead Time') || t4Res.answer.includes('Smith Predictor') || t4Res.answer.includes('Phase Lag') || t4Res.answer.includes('IMC')),
    'Turn 4: Continues PID discussion for large dead-time processes and mentions Smith Predictor / IMC'
  );
  historySeq1.push({ role: 'user', content: t4Prompt });
  historySeq1.push({ role: 'assistant', content: t4Res.answer });

  // Turn 5
  const t5Prompt = "Okay forget PID. Explain compressor surge.";
  const t5Res = await processAiChat({ message: t5Prompt, conversation: historySeq1, liveState: nominalLiveState });
  assert(
    (t5Res.answer.includes('SURGE') || t5Res.answer.includes('COMPRESSOR') || t5Res.answer.includes('Stall') || t5Res.answer.includes('Anti-Surge')),
    'Turn 5: Naturally switches topic away from PID to compressor surge'
  );
  historySeq1.push({ role: 'user', content: t5Prompt });
  historySeq1.push({ role: 'assistant', content: t5Res.answer });

  // Turn 6
  const t6Prompt = "How would I detect it?";
  const t6Res = await processAiChat({ message: t6Prompt, conversation: historySeq1, liveState: nominalLiveState });
  assert(
    (t6Res.answer.includes('Differential Pressure') || t6Res.answer.includes('Transmitter') || t6Res.answer.includes('Vibration') || t6Res.answer.includes('Surge Control Line') || t6Res.answer.includes('Proximity')),
    'Turn 6: Correctly understands "it" as compressor surge and explains detection instrumentation'
  );

  console.log('\n--- Sequence 2: Cavitation -> Causes -> Could my pump have it? -> What should I check first? ---');
  let historySeq2 = [];

  // Turn 1
  const s2t1Prompt = "What is cavitation?";
  const s2t1Res = await processAiChat({ message: s2t1Prompt, conversation: historySeq2, liveState: nominalLiveState });
  assert(
    (s2t1Res.answer.includes('Cavitation') || s2t1Res.answer.includes('vapor pressure') || s2t1Res.answer.includes('bubble')),
    'Turn 1: Explains cavitation phenomenology accurately'
  );
  historySeq2.push({ role: 'user', content: s2t1Prompt });
  historySeq2.push({ role: 'assistant', content: s2t1Res.answer });

  // Turn 2
  const s2t2Prompt = "What causes it?";
  const s2t2Res = await processAiChat({ message: s2t2Prompt, conversation: historySeq2, liveState: nominalLiveState });
  assert(
    (s2t2Res.answer.includes('NPSH') || s2t2Res.answer.includes('Temperature') || s2t2Res.answer.includes('Suction') || s2t2Res.answer.includes('Vapor Pressure')),
    'Turn 2: Correctly understands "it" as cavitation and explains root causes (NPSH, temp, suction restriction)'
  );
  historySeq2.push({ role: 'user', content: s2t2Prompt });
  historySeq2.push({ role: 'assistant', content: s2t2Res.answer });

  // Turn 3
  const s2t3Prompt = "Could my pump have it?";
  const s2t3Res = await processAiChat({ message: s2t3Prompt, conversation: historySeq2, liveState: nominalLiveState });
  assert(
    (s2t3Res.answer.includes('P-101') || s2t3Res.answer.includes('Pump')) &&
    (s2t3Res.answer.includes('RPM') || s2t3Res.answer.includes('vibration') || s2t3Res.answer.includes('NPSH')),
    'Turn 3: Correctly grounds in live P-101 pump telemetry and evaluates cavitation'
  );
  historySeq2.push({ role: 'user', content: s2t3Prompt });
  historySeq2.push({ role: 'assistant', content: s2t3Res.answer });

  // Turn 4
  const s2t4Prompt = "What should I check first?";
  const s2t4Res = await processAiChat({ message: s2t4Prompt, conversation: historySeq2, liveState: nominalLiveState });
  assert(
    (s2t4Res.answer.includes('Strainer') || s2t4Res.answer.includes('Suction') || s2t4Res.answer.includes('Valve') || s2t4Res.answer.includes('Level') || s2t4Res.answer.includes('CHECKLIST')),
    'Turn 4: Provides priority diagnostic checklist for pump cavitation / suction issues'
  );

  console.log(`\n========================================`);
  console.log(`RESULT: ${passed}/${total} Tests Passed (${Math.round((passed/total)*100)}%)`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
