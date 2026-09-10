import assert from 'assert';

const API_BASE = 'http://localhost:8000/api';

async function testExactMessageFlow() {
  console.log('=======================================================');
  console.log('🧪 TESTING EXACT MESSAGE FLOW & DYNAMIC CONTEXT ROUTING');
  console.log('=======================================================\n');

  let passed = 0;
  let total = 0;

  function check(desc, cond, excerpt = '') {
    total++;
    if (cond) {
      console.log(`  ✓ PASS: ${desc}`);
      if (excerpt) console.log(`    Preview: "${excerpt.slice(0, 140)}..."`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      if (excerpt) console.error(`    Actual text: "${excerpt.slice(0, 200)}..."`);
      assert.ok(cond, desc);
    }
  }

  // Conversation history accumulator
  let conversation = [];

  // TEST 1: "What is entropy?"
  console.log('[TEST 1] Testing User Message: "What is entropy?"');
  {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What is entropy?',
        conversation
      })
    });
    const data = await res.json();
    const reply = data.response || data.answer || '';
    check('Responds to entropy question directly', reply.toLowerCase().includes('entropy'), reply);
    check('Does NOT mention compressor or boiler', !reply.toLowerCase().includes('compressor surge') && !reply.toLowerCase().includes('boiler drum'), reply);
    check('Does NOT dump plant telemetry table', !reply.includes('P-101 Pump: Speed =') && !reply.includes('CURRENT PROCESS STATUS:'), reply);
    conversation.push({ role: 'user', content: 'What is entropy?' });
    conversation.push({ role: 'assistant', content: reply });
  }

  // TEST 2: "Explain how a boiler works."
  console.log('\n[TEST 2] Testing User Message: "Explain how a boiler works." (With entropy in history)');
  {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Explain how a boiler works.',
        conversation
      })
    });
    const data = await res.json();
    const reply = data.response || data.answer || '';
    check('Responds to boiler question directly', reply.toLowerCase().includes('boiler') || reply.toLowerCase().includes('steam'), reply);
    check('Does NOT answer entropy again', !reply.toLowerCase().includes('clausius defined entropy') && !reply.toLowerCase().includes('boltzmann'), reply);
    check('Does NOT mention compressor surge', !reply.toLowerCase().includes('compressor surge'), reply);
    conversation.push({ role: 'user', content: 'Explain how a boiler works.' });
    conversation.push({ role: 'assistant', content: reply });
  }

  // TEST 3: "What is a PLC?"
  console.log('\n[TEST 3] Testing User Message: "What is a PLC?"');
  {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What is a PLC?',
        conversation
      })
    });
    const data = await res.json();
    const reply = data.response || data.answer || '';
    check('Responds to PLC question directly', reply.toLowerCase().includes('plc') || reply.toLowerCase().includes('programmable logic controller'), reply);
    check('Explains PLC concepts', reply.toLowerCase().includes('scan') || reply.toLowerCase().includes('ladder') || reply.toLowerCase().includes('automation'), reply);
    conversation.push({ role: 'user', content: 'What is a PLC?' });
    conversation.push({ role: 'assistant', content: reply });
  }

  // TEST 4: "Why does compressor surge happen?"
  console.log('\n[TEST 4] Testing User Message: "Why does compressor surge happen?"');
  {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Why does compressor surge happen?',
        conversation
      })
    });
    const data = await res.json();
    const reply = data.response || data.answer || '';
    check('Responds to compressor surge question directly', reply.toLowerCase().includes('compressor') && reply.toLowerCase().includes('surge'), reply);
    check('Explains aerodynamic surge mechanism', reply.toLowerCase().includes('stall') || reply.toLowerCase().includes('flow') || reply.toLowerCase().includes('reversal'), reply);
    conversation.push({ role: 'user', content: 'Why does compressor surge happen?' });
    conversation.push({ role: 'assistant', content: reply });
  }

  // TEST 5: "Explain Bernoulli's equation." (With surge in history!)
  console.log('\n[TEST 5] Testing User Message: "Explain Bernoulli\'s equation." (With surge in immediate history!)');
  {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Explain Bernoulli's equation.",
        conversation
      })
    });
    const data = await res.json();
    const reply = data.response || data.answer || '';
    check('Responds to Bernoulli equation directly', reply.toLowerCase().includes('bernoulli'), reply);
    check('Does NOT respond with compressor surge despite surge in history', !reply.toLowerCase().includes('dynamic compressors & compressor surge') && !reply.toLowerCase().includes('anti-surge'), reply);
    conversation.push({ role: 'user', content: "Explain Bernoulli's equation." });
    conversation.push({ role: 'assistant', content: reply });
  }

  // TEST 6: "What is happening in my current ChemDiag process?"
  console.log('\n[TEST 6] Testing User Message: "What is happening in my current ChemDiag process?"');
  {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What is happening in my current ChemDiag process?',
        conversation
      })
    });
    const data = await res.json();
    const reply = data.response || data.answer || '';
    check('Uses live process telemetry for plant query', reply.includes('P-101') || reply.includes('E-101') || reply.includes('R-101') || reply.includes('LIVE PROCESS') || reply.includes('PROCESS STATUS'), reply);
    check('Does NOT get hijacked into surge', !reply.toLowerCase().includes('dynamic compressors & compressor surge'), reply);
    conversation.push({ role: 'user', content: 'What is happening in my current ChemDiag process?' });
    conversation.push({ role: 'assistant', content: reply });
  }

  // TEST 7: "Forget the process. Explain refrigeration cycles."
  console.log('\n[TEST 7] Testing User Message: "Forget the process. Explain refrigeration cycles."');
  {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Forget the process. Explain refrigeration cycles.',
        conversation
      })
    });
    const data = await res.json();
    const reply = data.response || data.answer || '';
    check('Explains refrigeration cycle directly', reply.toLowerCase().includes('refrigerat'), reply);
    check('Mentions core refrigeration stages', reply.toLowerCase().includes('evaporator') || reply.toLowerCase().includes('condenser') || reply.toLowerCase().includes('expansion'), reply);
    check('Does NOT dump plant telemetry table', !reply.includes('P-101 Pump: Speed ='), reply);
  }

  console.log('\n=======================================================');
  console.log(`🏁 EXACT MESSAGE FLOW RESULTS: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('=======================================================');

  if (passed === total) {
    console.log('🎉 ALL 7 EXACT USER MESSAGE FLOW TESTS PASSED FLAWLESSLY!\n');
  } else {
    process.exit(1);
  }
}

testExactMessageFlow().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
