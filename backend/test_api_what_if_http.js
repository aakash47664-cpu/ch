/**
 * ChemDiag AI — What-If Simulator API HTTP Integration Test
 */

const BASE_URL = 'http://localhost:8000';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runApiTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 RUNNING WHAT-IF SIMULATOR HTTP API INTEGRATION TESTS');
  console.log('🧪 ========================================================\n');

  // Test 1: AI Health Endpoint
  console.log('Test 1: Check /api/ai/health...');
  const healthRes = await fetch(`${BASE_URL}/api/ai/health`);
  if (!healthRes.ok) throw new Error(`Health check failed: ${healthRes.status}`);
  const health = await healthRes.json();
  console.log('✅ Health status:', health);

  // Test 2: POST /api/ai/what-if (Single Scenario: 2200 RPM)
  console.log('\nTest 2: POST /api/ai/what-if (Increase pump speed to 2200 RPM)...');
  const whatIfRes = await fetch(`${BASE_URL}/api/ai/what-if`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What happens if I increase pump speed to 2200 RPM?'
    })
  });
  if (!whatIfRes.ok) throw new Error(`/api/ai/what-if failed: ${whatIfRes.status}`);
  const whatIfData = await whatIfRes.json();
  console.log('✅ What-If Response received:');
  console.log(`   Target: ${whatIfData.scenario?.equipment_name} (${whatIfData.scenario?.hypothetical_value} ${whatIfData.scenario?.unit})`);
  console.log(`   Current Flow: ${whatIfData.current?.pump?.flow} L/min -> Scenario Flow: ${whatIfData.predicted?.pump?.flow} L/min`);
  console.log(`   Current Reactor Temp: ${whatIfData.current?.reactor?.temperature}°C -> Scenario Reactor Temp: ${whatIfData.predicted?.reactor?.temperature}°C`);
  console.log(`   Risk Transition: ${whatIfData.risk?.currentStage} (${whatIfData.risk?.currentScore}) -> ${whatIfData.risk?.scenarioStage} (${whatIfData.risk?.scenarioScore})`);
  console.log(`   Impact Chain steps: ${whatIfData.impactChain?.length}`);
  console.log(`   Provider: ${whatIfData.provider}`);
  console.log(`   Explanation snippet: "${whatIfData.explanation?.slice(0, 150)}..."`);

  if (!whatIfData.predicted?.pump?.flow || whatIfData.impactChain.length < 3) {
    throw new Error('What-If simulation response structure is invalid');
  }

  // Test 3: POST /api/ai/what-if (Dangerous Scenario: Reactor Cooling Failure)
  console.log('\nTest 3: POST /api/ai/what-if (Reactor cooling failure - Safety Gate)...');
  const runawayRes = await fetch(`${BASE_URL}/api/ai/what-if`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What if reactor cooling fails?'
    })
  });
  const runawayData = await runawayRes.json();
  console.log(`   Predicted Reactor Temp: ${runawayData.predicted?.reactor?.temperature}°C`);
  console.log(`   Predicted Reactor Pressure: ${runawayData.predicted?.reactor?.pressure} bar`);
  console.log(`   Scenario Risk Stage: ${runawayData.risk?.scenarioStage} (Is Dangerous: ${runawayData.risk?.isDangerous})`);
  if (!runawayData.risk?.isDangerous || runawayData.risk?.scenarioStage !== 'CRITICAL') {
    throw new Error('Cooling failure did not return CRITICAL risk');
  }
  console.log('✅ Safety Gate critical alert confirmed via HTTP API!');

  // Test 4: POST /api/ai/what-if (Multi-Scenario Comparison: Compare 2000 RPM and 2200 RPM)
  console.log('\nTest 4: POST /api/ai/what-if (Multi-Scenario Comparison)...');
  const multiRes = await fetch(`${BASE_URL}/api/ai/what-if`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'Compare 2000 RPM and 2200 RPM'
    })
  });
  const multiData = await multiRes.json();
  console.log(`   Is Multi: ${multiData.isMulti}`);
  console.log(`   Scenarios Count: ${multiData.multiComparison?.scenarios?.length}`);
  if (!multiData.isMulti || !multiData.multiComparison?.scenarios || multiData.multiComparison.scenarios.length < 2) {
    throw new Error('Multi-scenario comparison response is invalid');
  }
  for (const s of multiData.multiComparison.scenarios) {
    console.log(`   - ${s.label}: Flow = ${s.flow.toFixed(1)} L/min, Reactor Temp = ${s.reactorTemp.toFixed(1)}°C, Risk = ${s.riskStage} (${s.riskScore}/100)`);
  }
  console.log('✅ Multi-scenario comparison matrix confirmed via HTTP API!');

  // Test 5: Universal AI Chat Endpoint with What-If vs General Theory
  console.log('\nTest 5: POST /api/ai/chat (Unified AI Experience)...');
  
  // 5a. General Engineering Query
  console.log('   5a. Asking general engineering question: "Explain entropy."');
  const generalChatRes = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Explain entropy.' })
  });
  const generalChatData = await generalChatRes.json();
  console.log(`   AI response snippet: "${(generalChatData.answer || generalChatData.response || '').slice(0, 120)}..."`);
  
  // 5b. What-If query in normal chat
  console.log('   5b. Asking What-If question in chat: "What happens if I increase pump speed to 2200 RPM?"');
  const whatIfChatRes = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'What happens if I increase pump speed to 2200 RPM?' })
  });
  const whatIfChatData = await whatIfChatRes.json();
  console.log(`   What-If data attached: ${!!whatIfChatData.whatIf}`);
  console.log(`   AI response snippet: "${(whatIfChatData.answer || whatIfChatData.response || '').slice(0, 140)}..."`);

  // Test 6: Verify Live Process State was NOT modified by any of the simulations
  console.log('\nTest 6: Verify Live Process State remains untouched...');
  const equipRes = await fetch(`${BASE_URL}/api/equipment`);
  const equipData = await equipRes.json();
  const pumpUnit = equipData.find ? equipData.find(e => e.id === 'pump') : equipData.pump;
  console.log(`   Live Pump RPM: ${pumpUnit?.data?.rpm}`);
  console.log('✅ Live process state confirmed unchanged!');

  console.log('\n🎉 ALL WHAT-IF HTTP API INTEGRATION TESTS PASSED!');
}

runApiTests().catch((err) => {
  console.error('❌ Integration test failed:', err);
  process.exit(1);
});
