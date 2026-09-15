const BASE_URL = 'http://localhost:8000';

async function runHttpE2ETests() {
  console.log('=====================================================');
  console.log('  CHEMDIAG HTTP END-TO-END DUAL-PROVIDER TEST');
  console.log('=====================================================\n');

  // Test 1: GET /api/ai/health
  console.log('Test 1: GET /api/ai/health...');
  const healthRes = await fetch(`${BASE_URL}/api/ai/health`);
  if (!healthRes.ok) throw new Error(`Health check failed: ${healthRes.status}`);
  const healthData = await healthRes.json();
  console.log('Health Response:', JSON.stringify(healthData, null, 2));

  // Test 2: POST /api/ai/chat (Gemini Thermodynamics)
  console.log('\n-----------------------------------------------------');
  console.log('Test 2: POST /api/ai/chat (Gemini - Entropy)...');
  const chatRes1 = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Explain entropy in thermodynamics in 2 sentences.',
      provider: 'gemini'
    })
  });
  if (!chatRes1.ok) throw new Error(`Chat 1 failed: ${chatRes1.status}`);
  const chatData1 = await chatRes1.json();
  console.log(`[Provider: ${chatData1.provider}] Answer:\n${chatData1.answer}\n`);

  // Test 3: POST /api/ai/chat (Gemini Calculation Tool - Pipe Velocity)
  console.log('-----------------------------------------------------');
  console.log('Test 3: POST /api/ai/chat (Gemini - Deterministic Velocity Calc)...');
  const chatRes2 = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'A pump delivers 18 m3/h of water through a 50 mm diameter pipe. Calculate average velocity and show all unit conversions.',
      provider: 'gemini'
    })
  });
  if (!chatRes2.ok) throw new Error(`Chat 2 failed: ${chatRes2.status}`);
  const chatData2 = await chatRes2.json();
  console.log(`[Provider: ${chatData2.provider}] Answer:\n${chatData2.answer}\n`);

  // Test 4: POST /api/ai/what-if with Gemini
  console.log('-----------------------------------------------------');
  console.log('Test 4: POST /api/ai/what-if with Gemini Provider...');
  const whatIfRes = await fetch(`${BASE_URL}/api/ai/what-if`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What happens if I increase pump speed to 2200 RPM?',
      provider: 'gemini'
    })
  });
  if (!whatIfRes.ok) throw new Error(`What-If failed: ${whatIfRes.status}`);
  const whatIfData = await whatIfRes.json();
  console.log(`[Provider: ${whatIfData.provider}] Summary Flow: ${whatIfData.current?.pump?.flow?.toFixed(1)} -> ${whatIfData.predicted?.pump?.flow?.toFixed(1)} L/min`);
  console.log(`What-If AI Explanation:\n${whatIfData.explanation}\n`);

  console.log('=====================================================');
  console.log('  ALL HTTP END-TO-END TESTS PASSED SUCCESSFULLY');
  console.log('=====================================================');
}

runHttpE2ETests().catch(console.error);
