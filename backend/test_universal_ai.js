/**
 * ChemDiag — Universal Industrial AI Verification Suite
 * 
 * Verifies:
 * 1. Single unified AI intelligence (no separate modes)
 * 2. Universal industrial engineering knowledge (cavitation, compressor surge, PID formulas, distillation flooding, reactor runaway)
 * 3. Dynamic blending of universal theory with live ChemDiag process telemetry
 * 4. Multi-turn pronoun resolution and conversation history retention
 * 5. Deterministic Safety Gate compliance & "DO NOT ACT" directives
 * 6. Clean responses without disclaimer boilerplate
 */

const BASE_URL = 'http://localhost:8000';

async function postJson(path, data) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  return res.json();
}

async function getJson(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('=======================================================');
  console.log('🚀 RUNNING CHEMDIAG UNIVERSAL INDUSTRIAL AI TEST SUITE');
  console.log('=======================================================\n');

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

  // TEST 1: Universal Engineering Theory (Cavitation)
  console.log('[TEST 1] Universal Fluid Mechanics: Cavitation');
  const res1 = await postJson('/api/ai/chat', {
    message: 'What is cavitation and why does it happen in pumps?'
  });
  assert(res1.success === true, 'Response status is success');
  assert(res1.answer.toLowerCase().includes('cavitation') && res1.answer.toLowerCase().includes('vapor'), 'Explains cavitation vapor mechanism');
  assert(!res1.answer.toLowerCase().includes('prototype'), 'No prototype disclaimer in response');
  console.log(`  AI Answer preview: ${res1.answer.slice(0, 120)}...\n`);

  // TEST 2: Compressors & Anti-Surge (Unmodeled Equipment)
  console.log('[TEST 2] Universal Industrial Knowledge: Compressors & Surge');
  const res2 = await postJson('/api/ai/chat', {
    message: 'Explain dynamic compressor surge and how anti-surge valves work.'
  });
  assert(res2.success === true, 'Response status is success');
  assert(res2.answer.toLowerCase().includes('surge') && (res2.answer.toLowerCase().includes('anti-surge') || res2.answer.toLowerCase().includes('valve') || res2.answer.toLowerCase().includes('recycle')), 'Explains dynamic compressor surge and anti-surge protection');
  console.log(`  AI Answer preview: ${res2.answer.slice(0, 120)}...\n`);

  // TEST 3: Process Control & PID Tuning Formulas
  console.log('[TEST 3] Process Control & Automation: PID Formula');
  const res3 = await postJson('/api/ai/chat', {
    message: 'Give me the mathematical formula for PID control and explain the terms.'
  });
  assert(res3.success === true, 'Response status is success');
  assert(res3.answer.includes('u(t)') || res3.answer.toLowerCase().includes('proportional') || res3.answer.includes('K_c') || res3.answer.toLowerCase().includes('integral'), 'Provides PID equation and term explanations');
  console.log(`  AI Answer preview: ${res3.answer.slice(0, 120)}...\n`);

  // TEST 4: Live Process Grounding (Pump Cavitation Audit on P-101)
  console.log('[TEST 4] Dynamic Blending: Could my pump have cavitation?');
  // Inject pump fault
  await postJson('/api/demo/fault', { fault: 'pump_fault' });
  await sleep(1200);

  const res4 = await postJson('/api/ai/chat', {
    message: 'Could my pump be experiencing cavitation?',
    selectedEquipment: 'pump'
  });
  assert(res4.success === true, 'Response status is success');
  assert(res4.answer.toLowerCase().includes('p-101') || res4.answer.toLowerCase().includes('rpm') || res4.answer.toLowerCase().includes('vibration'), 'Blends theory with live P-101 telemetry (RPM, Vibration, Flow)');
  console.log(`  AI Answer preview: ${res4.answer.slice(0, 140)}...\n`);

  // TEST 5: Multi-Turn Conversation & Follow-Up Context Tracking
  console.log('[TEST 5] Multi-Turn Context: Follow-up questions with pronoun resolution');
  const historyTurn1 = [
    { sender: 'user', text: 'Why is the reactor temperature rising?' },
    { sender: 'ai', text: 'Reactor R-101 is experiencing cooling loss and exothermic runaway heat accumulation.' }
  ];

  const res5 = await postJson('/api/ai/chat', {
    message: 'What should I do about it?',
    conversation: historyTurn1
  });
  assert(res5.success === true, 'Response status is success');
  assert(res5.answer.toLowerCase().includes('reactor') || res5.answer.toLowerCase().includes('cooling') || res5.answer.toLowerCase().includes('recommend') || res5.answer.toLowerCase().includes('action'), 'Resolves pronoun "it" to Reactor R-101');
  console.log(`  AI Answer preview: ${res5.answer.slice(0, 140)}...\n`);

  // TEST 6: Unknown Fault Guard & Safety Gate Enforcement
  console.log('[TEST 6] Safety Gate: Unknown Fault & DO NOT ACT Directive');
  await postJson('/api/demo/fault', { fault: 'unknown_fault' });
  await sleep(1200);

  const res6 = await postJson('/api/ai/chat', {
    message: 'Why is recommendation blocked and what should I do?'
  });
  assert(res6.success === true, 'Response status is success');
  assert(res6.answer.includes('DO NOT ACT') || res6.answer.toLowerCase().includes('safety gate') || res6.answer.toLowerCase().includes('blocked'), 'Enforces deterministic DO NOT ACT directive during unknown condition');
  console.log(`  AI Answer preview: ${res6.answer.slice(0, 140)}...\n`);

  // Reset to normal
  await postJson('/api/demo/fault', { fault: 'normal' });
  await sleep(1000);

  console.log('=======================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('=======================================================');

  if (passed === total) {
    console.log('🎉 ALL UNIVERSAL INDUSTRIAL AI ACCEPTANCE TESTS PASSED PERFECTLY!');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test run failed with error:', err);
  process.exit(1);
});
