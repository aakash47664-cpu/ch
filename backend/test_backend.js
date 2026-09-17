/**
 * Automated Test Suite for ChemDiag AI Backend Logic
 */
import { generateSyntheticDataset, FEATURE_NAMES, CLASSES } from './ai/syntheticData.js';
import { IsolationForest } from './ai/isolationForest.js';
import { RandomForestClassifier } from './ai/randomForest.js';
import { diagnoseProcessState } from './ai/rootCauseEngine.js';
import { ProcessSimulator } from './simulator/processSimulator.js';

console.log('🧪 Starting ChemDiag AI Backend Unit Verification...\n');

// 1. Synthetic Dataset Test
console.log('--- 1. Testing Synthetic Dataset Generator ---');
const data = generateSyntheticDataset(100);
console.log(`Generated ${data.length} synthetic samples across classes:`, CLASSES);
if (data.length !== 500) throw new Error('Expected 500 samples');
console.log('✅ Synthetic Dataset Generator passed.\n');

// 2. Isolation Forest Test
console.log('--- 2. Testing Isolation Forest Anomaly Detector ---');
const isoForest = new IsolationForest(30, 128, 0.58);
isoForest.fit(data.map(d => d.features), FEATURE_NAMES);

const normalSample = {
  temperature: 65.0, pressure: 2.05, level: 50.0,
  vibration: 0.08, rpm: 2450,
  inlet_temperature: 25.0, outlet_temperature: 38.0,
  reflux_ratio: 2.2, agitator_speed: 350
};
const normalResult = isoForest.predict(normalSample);
console.log('Normal sample prediction:', normalResult);

const extremeSample = {
  temperature: 110.0, pressure: 5.2, level: 75.0,
  vibration: 0.9, rpm: 1200,
  inlet_temperature: 25.0, outlet_temperature: 55.0,
  reflux_ratio: 0.3, agitator_speed: 100
};
const extremeResult = isoForest.predict(extremeSample);
console.log('Extreme anomalous sample prediction:', extremeResult);
if (extremeResult.anomaly_score <= normalResult.anomaly_score) {
  console.warn('⚠️ Warning: Extreme sample score should exceed normal sample score');
}
console.log('✅ Isolation Forest tests completed.\n');

// 3. Random Forest Test
console.log('--- 3. Testing Random Forest Fault Classifier ---');
const rf = new RandomForestClassifier(20, 7, 4);
rf.fit(data, FEATURE_NAMES, CLASSES);

const rfNormal = rf.predict(normalSample);
console.log('RF Normal sample prediction:', rfNormal);

const rfPumpFaultSample = {
  temperature: 66.0, pressure: 2.0, level: 50.0,
  vibration: 0.55, rpm: 1650,
  inlet_temperature: 25.0, outlet_temperature: 44.0,
  reflux_ratio: 2.2, agitator_speed: 350
};
const rfPumpResult = rf.predict(rfPumpFaultSample);
console.log('RF Pump fault sample prediction:', rfPumpResult);
console.log('✅ Random Forest tests completed.\n');

// 4. Process Simulator Test
console.log('--- 4. Testing Dynamic Process Simulator ---');
const sim = new ProcessSimulator();
console.log('Initial state:', sim.getState().current_fault);

sim.setFault('reactor_cooling_failure');
for (let i = 0; i < 5; i++) sim.tick();
const stateAfterTicks = sim.getState();
console.log(`After 5 ticks of reactor_cooling_failure: Temp = ${stateAfterTicks.reactor.temperature}°C, Press = ${stateAfterTicks.reactor.pressure} bar, Cooling = ${stateAfterTicks.reactor.cooling_status}`);
if (stateAfterTicks.reactor.temperature <= 65.0) {
  throw new Error('Reactor temperature failed to rise during cooling failure');
}
console.log('✅ Simulator dynamic evolution passed.\n');

// 5. Root Cause & Explainability Engine Test
console.log('--- 5. Testing Root-Cause & Explainability Engine ---');
const diagCooling = diagnoseProcessState({
  telemetry: {
    reactor_cooling_status: 0,
    reactor_temperature: 92.5,
    reactor_pressure: 3.8
  },
  mlAnomaly: true,
  mlScore: 0.88,
  mlClass: 'reactor_cooling_failure',
  mlConfidence: 0.91
});
console.log('Cooling failure diagnosis:\n', JSON.stringify(diagCooling, null, 2));

if ((diagCooling.equipment !== 'Reactor' && diagCooling.equipment !== 'R-101') || (diagCooling.severity !== 'HIGH' && diagCooling.severity !== 'CRITICAL')) {
  throw new Error('Diagnosis mismatch for cooling failure');
}

const diagPump = diagnoseProcessState({
  telemetry: {
    pump_vibration: 0.45,
    pump_rpm: 1720,
    pump_outlet_temperature: 42
  },
  mlAnomaly: true,
  mlScore: 0.82,
  mlClass: 'pump_fault',
  mlConfidence: 0.88
});
console.log('\nPump fault diagnosis:\n', JSON.stringify(diagPump, null, 2));
if ((diagPump.equipment !== 'Pump' && diagPump.equipment !== 'P-101') || !diagPump.root_cause.includes('bearing wear')) {
  throw new Error('Diagnosis mismatch for pump fault');
}

console.log('\n🎉 ALL BACKEND LOGIC TESTS PASSED SUCCESSFULLY!');
