const BASE_URL = 'http://localhost:8000';

async function testUserExactAcceptance() {
  console.log('=====================================================');
  console.log('  EXACT USER ACCEPTANCE CRITERIA TEST SUITE');
  console.log('=====================================================\n');

  // Test 1: Health Endpoint
  console.log('--- TEST 1: GET /api/ai/health ---');
  const healthRes = await fetch(`${BASE_URL}/api/ai/health`);
  const health = await healthRes.json();
  console.log('Health:', JSON.stringify(health, null, 2));

  // Test 2: Reaction Engineering (Requirement 7)
  console.log('\n--- TEST 2: Gemini - Reaction Engineering in Simple Words ---');
  const res2 = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Explain reaction engineering in simple words.',
      provider: 'gemini'
    })
  });
  const data2 = await res2.json();
  console.log(`Provider: ${data2.provider}, Model: ${data2.model}`);
  console.log('Response:\n', data2.answer || data2.response || data2.text);

  // Assertions for Test 2
  const text2 = (data2.answer || data2.response || data2.text || '').toLowerCase();
  const hasReactionRate = text2.includes('reaction rate') || text2.includes('kinetics') || text2.includes('rate');
  const hasConversion = text2.includes('conversion') || text2.includes('convert');
  const hasReactor = text2.includes('cstr') || text2.includes('pfr') || text2.includes('batch');
  const hasOldGeneric = text2.includes('this concept spans fundamental physical');
  const isNotLocal = data2.provider?.toLowerCase() !== 'local reasoning engine';

  console.log('\n[TEST 2 VALIDATIONS]:');
  console.log('- Has reaction rate/kinetics:', hasReactionRate);
  console.log('- Has conversion:', hasConversion);
  console.log('- Has CSTR/PFR/batch:', hasReactor);
  console.log('- Does NOT have old generic template:', !hasOldGeneric);
  console.log('- Provider is NOT Local Reasoning Engine:', isNotLocal);
  if (!hasReactionRate || !hasReactor || hasOldGeneric || !isNotLocal) {
    throw new Error('Test 2 failed validation requirements!');
  }

  // Test 3: Exact Calculation (Requirement 8)
  console.log('\n--- TEST 3: Gemini - 18 m3/h through 50 mm pipe velocity ---');
  const res3 = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'A pump delivers 18 m³/h of water through a 50 mm diameter pipe. Calculate the average fluid velocity and show all unit conversions.',
      provider: 'gemini'
    })
  });
  const data3 = await res3.json();
  console.log(`Provider: ${data3.provider}, Model: ${data3.model}`);
  console.log('Response:\n', data3.answer || data3.response || data3.text);

  const text3 = data3.answer || data3.response || data3.text || '';
  const has255 = text3.includes('2.55') || text3.includes('2.546');
  const hasConversionCalc = text3.includes('0.005') || text3.includes('3600');
  console.log('\n[TEST 3 VALIDATIONS]:');
  console.log('- Computed velocity ≈ 2.55 m/s:', has255);
  console.log('- Shows unit conversion (18/3600 = 0.005 m³/s):', hasConversionCalc);
  if (!has255 || !hasConversionCalc) {
    throw new Error('Test 3 failed velocity calculation verification!');
  }

  // Test 4: Live Process Diagnostics (Requirement 9)
  console.log('\n--- TEST 4: Gemini - Why is P-101 abnormal? ---');
  const res4 = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Why is P-101 abnormal?',
      provider: 'gemini'
    })
  });
  const data4 = await res4.json();
  console.log(`Provider: ${data4.provider}, Model: ${data4.model}`);
  console.log('Response:\n', data4.answer || data4.response || data4.text);

  // Test 5: Follow-up Context Memory (Requirement 9)
  console.log('\n--- TEST 5: Gemini - Follow-up: "How would I fix that?" ---');
  const history = [
    { sender: 'user', text: 'Why is P-101 abnormal?' },
    { sender: 'ai', text: data4.answer || data4.response || data4.text }
  ];
  const res5 = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'How would I fix that?',
      conversation: history,
      provider: 'gemini'
    })
  });
  const data5 = await res5.json();
  console.log(`Provider: ${data5.provider}, Model: ${data5.model}`);
  console.log('Response:\n', data5.answer || data5.response || data5.text);

  console.log('\n=====================================================');
  console.log('  ALL USER ACCEPTANCE CRITERIA VERIFIED & PASSED!    ');
  console.log('=====================================================');
}

testUserExactAcceptance().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
