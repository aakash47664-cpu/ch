/**
 * ChemDiag — Groq Cloud AI Integration Test Suite
 * 
 * Verifies:
 * 1. GET /api/ai/health endpoint
 * 2. POST /api/ai/chat with {"message": "Explain centrifugal pump cavitation", "conversation": []}
 * 3. Exact response format {"success": true, "response": "..."}
 * 4. Multi-turn conversation support
 */

const BASE_URL = 'http://localhost:8000';

async function testGroqIntegration() {
  console.log('=======================================================');
  console.log('🧪 TESTING GROQ CLOUD INTEGRATION & AI CHAT ENDPOINTS');
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

  // 1. Test GET /api/ai/health
  console.log('[TEST 1] Testing GET /api/ai/health...');
  const healthRes = await fetch(`${BASE_URL}/api/ai/health`);
  assert(healthRes.status === 200, 'GET /api/ai/health returned status 200');
  const healthData = await healthRes.json();
  console.log('  Health response:', JSON.stringify(healthData, null, 2));
  assert(healthData.provider === 'Groq', 'Health report confirms provider is Groq');
  assert(typeof healthData.configured === 'boolean', 'Health report has configured boolean');
  assert(typeof healthData.status === 'string', 'Health report has status string');
  assert(!JSON.stringify(healthData).includes('gsk_'), 'Health report never exposes API key');

  // 2. Test POST /api/ai/chat
  console.log('\n[TEST 2] Testing POST /api/ai/chat...');
  const testPayload = {
    message: 'Explain centrifugal pump cavitation',
    conversation: []
  };

  const chatRes = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload)
  });

  assert(chatRes.status === 200, 'POST /api/ai/chat returned status 200');
  const chatData = await chatRes.json();
  console.log('  Chat response keys:', Object.keys(chatData));
  assert(chatData.success === true, 'Response contains success: true');
  assert(typeof chatData.response === 'string' && chatData.response.length > 20, 'Response contains valid response text');
  assert(chatData.response.toLowerCase().includes('cavitation') || chatData.response.toLowerCase().includes('pump'), 'Response contains explanation of cavitation');
  console.log(`  Response excerpt (first 180 chars):\n  "${chatData.response.slice(0, 180)}..."`);

  // 3. Test Multi-Turn Conversation
  console.log('\n[TEST 3] Testing Multi-turn conversation retention...');
  const multiTurnPayload = {
    message: 'How do I prevent it in a chemical plant?',
    conversation: [
      { role: 'user', content: 'Explain centrifugal pump cavitation' },
      { role: 'assistant', content: chatData.response }
    ]
  };

  const followUpRes = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(multiTurnPayload)
  });

  assert(followUpRes.status === 200, 'Follow-up returned status 200');
  const followUpData = await followUpRes.json();
  assert(followUpData.success === true, 'Follow-up success is true');
  assert(typeof followUpData.response === 'string' && followUpData.response.length > 20, 'Follow-up response is non-empty');
  console.log(`  Follow-up excerpt (first 180 chars):\n  "${followUpData.response.slice(0, 180)}..."`);

  console.log('\n=======================================================');
  console.log(`🏁 GROQ INTEGRATION RESULTS: ${passed}/${total} PASSED`);
  console.log('=======================================================');

  if (passed === total) {
    console.log('🎉 ALL GROQ ENDPOINT & AI CHAT TESTS PASSED!');
  } else {
    process.exit(1);
  }
}

testGroqIntegration().catch(err => {
  console.error('Groq integration test failed:', err);
  process.exit(1);
});
