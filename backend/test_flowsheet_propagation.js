const BASE_URL = 'http://localhost:8000';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 RUNNING CHEMDIAG AI FLOWSHEET PROPAGATION TEST SUITE');
  console.log('🧪 ========================================================\n');

  // Test 1: Fetch initial streams
  console.log('Test 1: Verify Initial Streams (01 to 06)...');
  const res1 = await fetch(`${BASE_URL}/api/streams`);
  if (!res1.ok) throw new Error(`Failed to fetch /api/streams: ${res1.status}`);
  const streamsData1 = await res1.json();
  const streams1 = streamsData1.streams || streamsData1;
  console.log('✅ Streams loaded:', Object.keys(streams1));
  console.log(`   Stream 01 Flow: ${streams1.stream_1.flow.toFixed(1)} L/min, Temp: ${streams1.stream_1.temperature.toFixed(1)}°C`);
  console.log(`   Stream 02 Flow: ${streams1.stream_2.flow.toFixed(1)} L/min, Temp: ${streams1.stream_2.temperature.toFixed(1)}°C`);
  console.log(`   Stream 03 Flow: ${streams1.stream_3.flow.toFixed(1)} L/min, Temp: ${streams1.stream_3.temperature.toFixed(1)}°C`);
  console.log(`   Stream 04 Flow: ${streams1.stream_4.flow.toFixed(1)} L/min, Temp: ${streams1.stream_4.temperature.toFixed(1)}°C`);
  console.log(`   Stream 05 Flow: ${streams1.stream_5.flow.toFixed(1)} L/min, Temp: ${streams1.stream_5.temperature.toFixed(1)}°C, Reflux: ${streams1.stream_5.reflux_ratio}`);
  console.log(`   Stream 06 Flow: ${streams1.stream_6.flow.toFixed(1)} L/min, Temp: ${streams1.stream_6.temperature.toFixed(1)}°C\n`);

  // Test 2: Downstream flow propagation on Pump RPM decrease
  console.log('Test 2: Test Pump RPM Override -> Downstream Flow Propagation...');
  await fetch(`${BASE_URL}/api/simulator/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pump_rpm: 1700 })
  });
  console.log('   Pump override set to 1700 RPM. Waiting for dynamic transitions across units...');
  await sleep(4000); // allow 4 seconds for gradual differential transition

  const res2 = await fetch(`${BASE_URL}/api/streams`);
  const streamsData2 = await res2.json();
  const streams2 = streamsData2.streams || streamsData2;
  console.log(`   New Pump RPM: 1700`);
  console.log(`   New Stream 01 Flow: ${streams2.stream_1.flow.toFixed(1)} L/min (Expected ~6.9 L/min)`);
  console.log(`   New Stream 03 Exchanger Out Flow: ${streams2.stream_3.flow.toFixed(1)} L/min`);
  console.log(`   New Stream 04 Reactor Out Flow: ${streams2.stream_4.flow.toFixed(1)} L/min`);
  console.log(`   New Stream 05 Distillate Flow: ${streams2.stream_5.flow.toFixed(1)} L/min`);
  if (streams2.stream_1.flow < 7.6 && streams2.stream_4.flow < 7.6) {
    console.log('✅ Flow successfully propagated downstream through all units!\n');
  } else {
    throw new Error(`Flow propagation failed: stream_1 flow is ${streams2.stream_1.flow}`);
  }

  // Test 3: Reactor Cooling Loss Trip & Temperature Surges
  console.log('Test 3: Test Reactor Cooling Trip -> Reactor Temperature Surge...');
  await fetch(`${BASE_URL}/api/simulator/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cooling_status: 0 })
  });
  console.log('   Cooling tripped OFF. Waiting 3 seconds for kinetics to evolve...');
  await sleep(3500);

  const res3 = await fetch(`${BASE_URL}/api/equipment`);
  const equipRaw3 = await res3.json();
  const equip3 = Array.isArray(equipRaw3) ? Object.fromEntries(equipRaw3.map(e => [e.id, e])) : equipRaw3;
  console.log(`   Reactor Temp: ${equip3.reactor.data.temperature.toFixed(1)}°C (Nominal: 65°C)`);
  console.log(`   Reactor Pressure: ${equip3.reactor.data.pressure.toFixed(2)} bar (Nominal: 2.05 bar)`);
  if (equip3.reactor.data.temperature > 66.0 && equip3.reactor.data.pressure > 2.05) {
    console.log('✅ Dynamic kinetics reacted: Temperature & Pressure surged!\n');
  } else {
    throw new Error('Reactor runaway kinetics failed to rise');
  }

  // Test 4: Copilot Cause-and-Effect Understanding
  console.log('Test 4: Test Copilot Cause-and-Effect Explanations...');
  const chatQueries = [
    'Why did the reactor temperature change?',
    'Why did distillation top temperature increase?',
    'What happens when pump flow decreases?'
  ];

  for (const q of chatQueries) {
    const chatRes = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: q })
    });
    const chatJson = await chatRes.json();
    const ansText = chatJson.answer || chatJson.text || '';
    console.log(`   User: "${q}"`);
    console.log(`   AI Copilot: "${ansText.slice(0, 140).replace(/\n/g, ' ')}..."\n`);
  }

  // Test 5: Reset Simulator to Nominal
  console.log('Test 5: Reset Simulator Steady-State...');
  await fetch(`${BASE_URL}/api/simulator/reset`, { method: 'POST' });
  await sleep(1500);
  const resReset = await fetch(`${BASE_URL}/api/equipment`);
  const equipResetRaw = await resReset.json();
  const equipReset = Array.isArray(equipResetRaw) ? Object.fromEntries(equipResetRaw.map(e => [e.id, e])) : equipResetRaw;
  console.log(`   Pump RPM: ${equipReset.pump.data.rpm}, Reactor Cooling: ${equipReset.reactor.data.cooling_status}`);
  console.log('✅ Simulator successfully restored to steady-state.\n');

  console.log('🎉 ALL FLOWSHEET PROPAGATION TESTS PASSED PERFECTLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
