import assert from 'assert';

const API_BASE = 'http://localhost:8000/api';

async function testFinalAiBehavior() {
  console.log('=======================================================');
  console.log('🧪 TESTING UNIVERSAL AI CONVERSATIONAL BEHAVIOR & PROMPT');
  console.log('=======================================================\n');

  let passed = 0;
  let total = 0;

  function check(desc, cond, excerpt = '') {
    total++;
    if (cond) {
      console.log(`  ✓ PASS: ${desc}`);
      if (excerpt) console.log(`    Preview: "${excerpt.slice(0, 160).replace(/\n/g, ' ')}..."`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      if (excerpt) console.error(`    Actual text: "${excerpt.slice(0, 250).replace(/\n/g, ' ')}..."`);
      assert.ok(cond, desc);
    }
  }

  let conversation = [];

  // TEST 1: "Why is the sky blue? Explain it using thermodynamics if possible."
  console.log('[TEST 1] User: "Why is the sky blue? Explain it using thermodynamics if possible."');
  {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Why is the sky blue? Explain it using thermodynamics if possible.',
        conversation
      })
    });
    const data = await res.json();
    const reply = data.response || data.answer || '';
    
    check('Answers why the sky is blue / Rayleigh scattering / optics', 
      reply.toLowerCase().includes('sky') || reply.toLowerCase().includes('rayleigh') || reply.toLowerCase().includes('scatter') || reply.toLowerCase().includes('blue'), 
      reply);
    
    check('Does NOT mention P-101', !reply.includes('P-101') && !reply.includes('p-101'), reply);
    check('Does NOT mention E-101', !reply.includes('E-101') && !reply.includes('e-101'), reply);
    check('Does NOT mention R-101', !reply.includes('R-101') && !reply.includes('r-101'), reply);
    check('Does NOT mention D-101', !reply.includes('D-101') && !reply.includes('d-101'), reply);
    check('Does NOT dump process telemetry', !reply.includes('Speed =') && !reply.includes('CURRENT PROCESS STATUS:'), reply);
    
    conversation.push({ role: 'user', content: 'Why is the sky blue? Explain it using thermodynamics if possible.' });
    conversation.push({ role: 'assistant', content: reply });
  }

  // TEST 2: "What is compressor surge?"
  console.log('\n[TEST 2] User: "What is compressor surge?"');
  {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What is compressor surge?',
        conversation
      })
    });
    const data = await res.json();
    const reply = data.response || data.answer || '';

    check('Explains compressor surge directly', reply.toLowerCase().includes('compressor') && reply.toLowerCase().includes('surge'), reply);
    check('Does NOT mention P-101 or heat exchangers', !reply.includes('P-101') && !reply.includes('E-101'), reply);

    conversation.push({ role: 'user', content: 'What is compressor surge?' });
    conversation.push({ role: 'assistant', content: reply });
  }

  // TEST 3: "What is happening in my current process?"
  console.log('\n[TEST 3] User: "What is happening in my current process?"');
  {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What is happening in my current process?',
        conversation
      })
    });
    const data = await res.json();
    const reply = data.response || data.answer || '';

    check('Analyzes live ChemDiag process state', reply.includes('P-101') || reply.includes('E-101') || reply.includes('PROCESS') || reply.includes('STATUS'), reply);

    conversation.push({ role: 'user', content: 'What is happening in my current process?' });
    conversation.push({ role: 'assistant', content: reply });
  }

  // TEST 4: "Why is my pump behaving like this?"
  console.log('\n[TEST 4] User: "Why is my pump behaving like this?"');
  {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Why is my pump behaving like this?',
        conversation
      })
    });
    const data = await res.json();
    const reply = data.response || data.answer || '';

    check('Analyzes pump P-101 data', reply.toLowerCase().includes('pump') || reply.includes('P-101') || reply.includes('RPM'), reply);

    conversation.push({ role: 'user', content: 'Why is my pump behaving like this?' });
    conversation.push({ role: 'assistant', content: reply });
  }

  // TEST 5: "Forget the process. Explain entropy."
  console.log('\n[TEST 5] User: "Forget the process. Explain entropy."');
  {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Forget the process. Explain entropy.',
        conversation
      })
    });
    const data = await res.json();
    const reply = data.response || data.answer || '';

    check('Explains entropy without plant dump', reply.toLowerCase().includes('entropy'), reply);
    check('Does NOT dump plant telemetry table', !reply.includes('P-101 Pump: Speed =') && !reply.includes('CURRENT PROCESS STATUS:'), reply);
  }

  console.log('\n=======================================================');
  console.log(`🏁 FINAL AI BEHAVIOR RESULTS: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('=======================================================');

  if (passed === total) {
    console.log('🎉 ALL FINAL AI BEHAVIOR TESTS PASSED 100%!\n');
  } else {
    process.exit(1);
  }
}

testFinalAiBehavior().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
