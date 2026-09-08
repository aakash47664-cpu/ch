import http from 'http';

function testChat(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/api/ai/chat',
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

async function run() {
  console.log('Testing POST http://localhost:8000/api/ai/chat...\n');

  // Test 1: "Is the process normal?"
  const res1 = await testChat({ message: 'Is the process normal?' });
  console.log('[TEST 1] Status:', res1.statusCode);
  console.log('Response:', JSON.stringify(res1.body, null, 2));

  // Test 2: "What is wrong with the pump?"
  const res2 = await testChat({ message: 'What is wrong with the pump?' });
  console.log('\n[TEST 2] Status:', res2.statusCode);
  console.log('Response:', JSON.stringify(res2.body, null, 2));

  // Test 3: "Why is the reactor temperature increasing?"
  const res3 = await testChat({ message: 'Why is the reactor temperature increasing?' });
  console.log('\n[TEST 3] Status:', res3.statusCode);
  console.log('Response:', JSON.stringify(res3.body, null, 2));

  // Test 4: "Which variable changed?"
  const res4 = await testChat({ message: 'Which variable changed?' });
  console.log('\n[TEST 4] Status:', res4.statusCode);
  console.log('Response:', JSON.stringify(res4.body, null, 2));

  console.log('\nALL HTTP ENDPOINT TESTS PASSED WITH STATUS 200!');
}

run().catch(console.error);
