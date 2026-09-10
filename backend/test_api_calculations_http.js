/**
 * HTTP Integration Test for ChemDiag AI Calculation Engine over /api/ai/chat
 */

async function testHttpChat() {
  console.log('--- Testing /api/ai/health ---');
  const healthRes = await fetch('http://localhost:8000/api/ai/health');
  const health = await healthRes.json();
  console.log('Health response:', health);

  console.log('\n--- Testing /api/ai/chat with Pipe Velocity ---');
  const chatRes1 = await fetch('http://localhost:8000/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'A pipe carries 5 m³/h through a 25 mm pipe. Calculate velocity.',
      conversation: []
    })
  });
  const data1 = await chatRes1.json();
  console.log('Chat 1 Success:', data1.success);
  console.log('Chat 1 Response snippet:', (data1.response || data1.answer || '').slice(0, 300));

  console.log('\n--- Testing /api/ai/chat with Multi-Turn "Why did you divide by 3600?" ---');
  const chatRes2 = await fetch('http://localhost:8000/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Why did you divide by 3600?',
      conversation: [
        { role: 'user', content: 'A pipe carries 5 m³/h through a 25 mm pipe. Calculate velocity.' },
        { role: 'assistant', content: data1.response || data1.answer }
      ]
    })
  });
  const data2 = await chatRes2.json();
  console.log('Chat 2 Success:', data2.success);
  console.log('Chat 2 Response snippet:', (data2.response || data2.answer || '').slice(0, 300));

  console.log('\n--- Testing /api/ai/chat with Live Pump Power ---');
  const chatRes3 = await fetch('http://localhost:8000/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Estimate the hydraulic power of my current pump.',
      conversation: []
    })
  });
  const data3 = await chatRes3.json();
  console.log('Chat 3 Success:', data3.success);
  console.log('Chat 3 Response snippet:', (data3.response || data3.answer || '').slice(0, 300));
}

testHttpChat().catch(err => {
  console.error('HTTP Test Failed:', err);
  process.exit(1);
});
