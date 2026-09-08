import http from 'http';

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'localhost',
      port: 8000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: JSON.parse(data)
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log('=== TESTING FAULT SCENARIOS WITH LOCAL AI COPILOT ===\n');

  // Scenario 1: Pump Fault
  console.log('1. Setting fault: pump_fault');
  await postJson('/api/demo/fault', { fault: 'pump_fault' });
  await sleep(1200); // allow simulator ticks

  const pumpRes = await postJson('/api/ai/chat', { message: 'Why is the pump abnormal?' });
  console.log('[PUMP FAULT RESPONSE]:');
  console.log(pumpRes.body.answer);
  console.log('Equipment:', pumpRes.body.equipment, '| Status:', pumpRes.statusCode, '\n');

  // Scenario 2: Reactor Cooling Failure
  console.log('2. Setting fault: reactor_cooling_failure');
  await postJson('/api/demo/fault', { fault: 'reactor_cooling_failure' });
  await sleep(1500);

  const reactorRes = await postJson('/api/ai/chat', { message: 'Why is the reactor abnormal?' });
  console.log('[REACTOR FAULT RESPONSE]:');
  console.log(reactorRes.body.answer);
  console.log('Equipment:', reactorRes.body.equipment, '| Status:', reactorRes.statusCode, '\n');

  const reactorSeriousRes = await postJson('/api/ai/chat', {
    message: 'How serious is it?',
    history: [
      { sender: 'user', text: 'Why is the reactor abnormal?' },
      { sender: 'ai', text: reactorRes.body.answer }
    ]
  });
  console.log('[REACTOR FOLLOW-UP "How serious is it?"]:');
  console.log(reactorSeriousRes.body.answer);
  console.log('Equipment:', reactorSeriousRes.body.equipment, '\n');

  // Scenario 3: Distillation Fault
  console.log('3. Setting fault: distillation_fault');
  await postJson('/api/demo/fault', { fault: 'distillation_fault' });
  await sleep(1200);

  const distRes = await postJson('/api/ai/chat', { message: 'Why is the distillation column abnormal?' });
  console.log('[DISTILLATION FAULT RESPONSE]:');
  console.log(distRes.body.answer);
  console.log('Equipment:', distRes.body.equipment, '| Status:', distRes.statusCode, '\n');

  const distChangedRes = await postJson('/api/ai/chat', { message: 'Which variable changed?' });
  console.log('[DISTILLATION "Which variable changed?"]:');
  console.log(distChangedRes.body.answer);
  console.log('Intent:', distChangedRes.body.intent, '\n');

  // Scenario 4: Heat Exchanger Fault
  console.log('4. Setting fault: heat_exchanger_fault');
  await postJson('/api/demo/fault', { fault: 'heat_exchanger_fault' });
  await sleep(1200);

  const hxRes = await postJson('/api/ai/chat', { message: 'Why is the heat exchanger abnormal?' });
  console.log('[HEAT EXCHANGER FAULT RESPONSE]:');
  console.log(hxRes.body.answer);
  console.log('Equipment:', hxRes.body.equipment, '| Status:', hxRes.statusCode, '\n');

  // Reset to Normal
  console.log('5. Resetting fault to normal');
  await postJson('/api/demo/fault', { fault: 'normal' });
  await sleep(1000);

  const normalRes = await postJson('/api/ai/chat', { message: 'Is everything normal?' });
  console.log('[NORMAL RESTORATION RESPONSE]:');
  console.log(normalRes.body.answer);
  console.log('Equipment:', normalRes.body.equipment, '| Status:', normalRes.statusCode, '\n');

  console.log('=== ALL SCENARIO TESTS COMPLETED SUCCESSFULLY ===');
}

run().catch(console.error);
