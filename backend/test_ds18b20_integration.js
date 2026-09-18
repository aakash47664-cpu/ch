/**
 * Verification test for ESP32 DS18B20 E-101 Heat Exchanger Outlet Temperature Ingestion
 */

const BASE_URL = 'http://localhost:8000';

async function runTests() {
  console.log('🧪 Starting E-101 DS18B20 Sensor Ingestion Integration Test...\n');

  // 1. Post dedicated E-101 sensor payload
  console.log('1. Testing POST /api/sensors with DS18B20 payload...');
  const testTemp = 42.7;
  const res1 = await fetch(`${BASE_URL}/api/sensors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'real',
      unit: 'heat_exchanger',
      outlet_temperature: testTemp
    })
  });

  const body1 = await res1.json();
  console.log('   Status:', res1.status, '| Response:', JSON.stringify(body1));
  if (res1.status !== 200) throw new Error(`POST /api/sensors failed with status ${res1.status}`);

  // 2. Fetch /api/equipment and check E-101 values
  console.log('\n2. Verifying /api/equipment E-101 data state...');
  const res2 = await fetch(`${BASE_URL}/api/equipment`);
  const equipList = await res2.json();
  const hx = equipList.find(e => e.id === 'heat_exchanger');

  console.log('   E-101 Data:', JSON.stringify(hx.data, null, 2));
  if (hx.data.outlet_temperature !== testTemp) {
    throw new Error(`Expected outlet_temperature ${testTemp}, got ${hx.data.outlet_temperature}`);
  }
  if (hx.data.source !== 'real') {
    throw new Error(`Expected source "real", got "${hx.data.source}"`);
  }
  if (hx.data.sensor_status !== 'LIVE') {
    throw new Error(`Expected sensor_status "LIVE", got "${hx.data.sensor_status}"`);
  }
  if (hx.data.has_real_sensor !== true) {
    throw new Error(`Expected has_real_sensor true, got ${hx.data.has_real_sensor}`);
  }

  // 3. Verify other parameters are preserved
  console.log('\n3. Verifying other E-101 parameters intact...');
  if (typeof hx.data.inlet_temperature !== 'number' || typeof hx.data.flow !== 'number') {
    throw new Error('E-101 parameters were corrupted');
  }
  console.log('   Inlet Temp:', hx.data.inlet_temperature, '°C');
  console.log('   Flow:', hx.data.flow, 'L/min');
  console.log('   Efficiency:', hx.data.efficiency, '%');
  console.log('   ΔT (calculated):', hx.data.temperature_difference, '°C');

  // 4. Test validation with invalid temperature
  console.log('\n4. Testing validation rejection on invalid values...');
  const res3 = await fetch(`${BASE_URL}/api/sensors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'real',
      unit: 'heat_exchanger',
      outlet_temperature: 999.0
    })
  });
  console.log('   Invalid temp status code:', res3.status, '(Expected 422)');
  if (res3.status !== 422) throw new Error(`Expected 422 for out of range temperature, got ${res3.status}`);

  console.log('\n✅ ALL E-101 DS18B20 SENSOR INGESTION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
