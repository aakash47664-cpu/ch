/**
 * ChemDiag — Full Context Selection & Natural Conversation Verification
 * 
 * Verifies that:
 * 1. General questions (e.g. "Explain entropy") do NOT dump telemetry.
 * 2. Multi-turn conversation transitions smoothly between theory and live plant context.
 * 3. Live process telemetry is ONLY used when relevant.
 */

const BASE_URL = 'http://localhost:8000';

async function testConversationFlow() {
  console.log('=======================================================');
  console.log('🧪 TESTING AI CONTEXT SELECTION & MULTI-TURN FLOW');
  console.log('=======================================================\n');

  let conversation = [];
  let passed = 0;
  let total = 0;

  function assert(condition, name, details = '') {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      if (details) console.error(`    Details: ${details}`);
    }
  }

  async function ask(msg) {
    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        conversation
      })
    });
    if (!res.ok) {
      throw new Error(`Chat failed with status ${res.status}`);
    }
    const data = await res.json();
    const reply = data.response || data.answer;
    conversation.push({ role: 'user', content: msg });
    conversation.push({ role: 'assistant', content: reply });
    return reply;
  }

  // Turn 1: "Explain entropy in your own words."
  console.log('[TURN 1] User: "Explain entropy in your own words."');
  const t1 = await ask('Explain entropy in your own words.');
  assert(!t1.includes('P-101 Pump:') && !t1.includes('Telemetry Analysis') && !t1.includes('Preventive Risk Score:'), 'Does NOT dump plant telemetry');
  assert(t1.toLowerCase().includes('entropy') && (t1.toLowerCase().includes('energy') || t1.toLowerCase().includes('irreversib') || t1.toLowerCase().includes('state')), 'Explains entropy in engineering terms');
  console.log(`  Reply preview: "${t1.slice(0, 140)}..."\n`);

  // Turn 2: "Why does entropy increase?"
  console.log('[TURN 2] User: "Why does entropy increase?"');
  const t2 = await ask('Why does entropy increase?');
  assert(!t2.includes('P-101 Pump:') && !t2.includes('Telemetry Analysis'), 'Does NOT dump plant telemetry');
  assert(t2.toLowerCase().includes('microstate') || t2.toLowerCase().includes('second law') || t2.toLowerCase().includes('irreversib') || t2.toLowerCase().includes('dispers'), 'Explains why entropy increases');
  console.log(`  Reply preview: "${t2.slice(0, 140)}..."\n`);

  // Turn 3: "How is that related to heat transfer?"
  console.log('[TURN 3] User: "How is that related to heat transfer?"');
  const t3 = await ask('How is that related to heat transfer?');
  assert(!t3.includes('P-101 Pump:') && !t3.includes('Telemetry Analysis'), 'Does NOT dump plant telemetry');
  assert(t3.toLowerCase().includes('heat transfer') || t3.toLowerCase().includes('temperature') || t3.toLowerCase().includes('delta t') || t3.toLowerCase().includes('exergy'), 'Explains relationship to heat transfer');
  console.log(`  Reply preview: "${t3.slice(0, 140)}..."\n`);

  // Turn 4: "Could that matter in my heat exchanger?"
  console.log('[TURN 4] User: "Could that matter in my heat exchanger?"');
  const t4 = await ask('Could that matter in my heat exchanger?');
  assert(t4.toLowerCase().includes('heat exchanger') || t4.toLowerCase().includes('e-101') || t4.toLowerCase().includes('fouling') || t4.toLowerCase().includes('exergy'), 'Connects concept to heat exchanger operations');
  console.log(`  Reply preview: "${t4.slice(0, 140)}..."\n`);

  // Turn 5: "What is happening with my heat exchanger right now?"
  console.log('[TURN 5] User: "What is happening with my heat exchanger right now?"');
  const t5 = await ask('What is happening with my heat exchanger right now?');
  assert(t5.toLowerCase().includes('e-101') || t5.toLowerCase().includes('heat exchanger') || t5.includes('°C'), 'Directly audits live heat exchanger readings');
  console.log(`  Reply preview: "${t5.slice(0, 140)}..."\n`);

  // Turn 6: "Forget that. Explain compressor surge."
  console.log('[TURN 6] User: "Forget that. Explain compressor surge."');
  const t6 = await ask('Forget that. Explain compressor surge.');
  assert(!t6.includes('P-101 Pump:') && !t6.includes('Telemetry Analysis'), 'Does NOT dump plant telemetry');
  assert(t6.toLowerCase().includes('surge') && (t6.toLowerCase().includes('compressor') || t6.toLowerCase().includes('flow') || t6.toLowerCase().includes('anti-surge')), 'Explains compressor surge');
  console.log(`  Reply preview: "${t6.slice(0, 140)}..."\n`);

  // Turn 7: "Could that happen in an industrial plant?"
  console.log('[TURN 7] User: "Could that happen in an industrial plant?"');
  const t7 = await ask('Could that happen in an industrial plant?');
  assert(t7.toLowerCase().includes('plant') || t7.toLowerCase().includes('industrial') || t7.toLowerCase().includes('surge') || t7.toLowerCase().includes('risk'), 'Explains real-world plant occurrence of compressor surge');
  console.log(`  Reply preview: "${t7.slice(0, 140)}..."\n`);

  // Turn 8: "What would I need to monitor?"
  console.log('[TURN 8] User: "What would I need to monitor?"');
  const t8 = await ask('What would I need to monitor?');
  assert(t8.toLowerCase().includes('monitor') || t8.toLowerCase().includes('flow') || t8.toLowerCase().includes('pressure') || t8.toLowerCase().includes('vibration'), 'Explains key monitoring variables for surge');
  console.log(`  Reply preview: "${t8.slice(0, 140)}..."\n`);

  console.log('=======================================================');
  console.log(`🏁 CONVERSATION TEST RESULTS: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('=======================================================');

  if (passed === total) {
    console.log('🎉 ALL NATURAL CONTEXT SELECTION & CONVERSATION TESTS PASSED!');
  } else {
    process.exit(1);
  }
}

testConversationFlow().catch(err => {
  console.error('Conversation flow test failed:', err);
  process.exit(1);
});
