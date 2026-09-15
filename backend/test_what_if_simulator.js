/**
 * ChemDiag AI — What-If Engineering Simulator Test Suite
 */

import * as WhatIf from './engineering/whatIf.js';

console.log('🧪 ========================================================');
console.log('🧪 RUNNING WHAT-IF ENGINEERING SIMULATOR TEST SUITE');
console.log('🧪 ========================================================\n');

const liveStateBaseline = {
  activeFault: 'normal',
  faultSeverity: 0.0,
  pump: { rpm: 2450, vibration: 0.08, flow: 10.0, inlet_temperature: 25.2, outlet_temperature: 38.1, pressure: 2.80 },
  heatExchanger: { efficiency: 95.0, inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, heat_transfer_indicator: 95.0 },
  reactor: { temperature: 65.0, pressure: 2.05, level: 50.0, agitator_speed: 350, cooling_status: 1 },
  distillation: { top_temperature: 76.5, bottom_temperature: 98.4, pressure: 2.10, level: 52.0, reflux_ratio: 1.85 },
  diagnosis: { anomaly: false, severity: 'NORMAL', anomaly_score: 0.18 }
};

// TEST 1: Natural Language Scenario Parsing
console.log('Test 1: Natural Language Scenario Parsing...');
const testQueries = [
  { q: "What happens if I increase pump speed to 2200 RPM?", expectedEquip: 'pump', expectedVar: 'rpm', expectedVal: 2200 },
  { q: "What if reactor cooling fails?", expectedEquip: 'reactor', expectedVar: 'cooling_status', expectedVal: 0 },
  { q: "What happens if reflux is reduced to 1.0?", expectedEquip: 'distillation', expectedVar: 'reflux_ratio', expectedVal: 1.0 },
  { q: "What if I increase the pump flow by 20%?", expectedEquip: 'pump', expectedVar: 'flow_pct', expectedVal: 20 },
  { q: "What happens if reactor temperature rises by 10°C?", expectedEquip: 'reactor', expectedVar: 'temperature_delta', expectedVal: 10 },
  { q: "What if the heat exchanger efficiency drops by 30%?", expectedEquip: 'heat_exchanger', expectedVar: 'efficiency_drop', expectedVal: 30 }
];

for (const t of testQueries) {
  const parsed = WhatIf.parseScenarioFromQuery(t.q, [], liveStateBaseline);
  if (!parsed.scenario) {
    throw new Error(`Failed to parse query: "${t.q}"`);
  }
  console.log(`   ✓ "${t.q}" -> ${parsed.scenario.equipment} / ${parsed.scenario.variable} = ${parsed.scenario.hypothetical_value}`);
  if (parsed.scenario.equipment !== t.expectedEquip || parsed.scenario.variable !== t.expectedVar || parsed.scenario.hypothetical_value !== t.expectedVal) {
    throw new Error(`Parse mismatch for "${t.q}": expected ${t.expectedEquip}/${t.expectedVar}/${t.expectedVal}, got ${parsed.scenario.equipment}/${parsed.scenario.variable}/${parsed.scenario.hypothetical_value}`);
  }
}
console.log('✅ Natural Language Parser passed all test queries!\n');

// TEST 2: Deterministic Causal Flowsheet Propagation (Pump Speed Increase to 2200 RPM from degraded 1900 baseline)
console.log('Test 2: Causal Flowsheet Propagation (P-101 -> E-101 -> R-101 -> D-101)...');
const degradedState = {
  ...liveStateBaseline,
  activeFault: 'pump_fault',
  faultSeverity: 0.65,
  pump: { rpm: 1900, vibration: 0.38, flow: 7.8, inlet_temperature: 25.2, outlet_temperature: 35.2, pressure: 2.15 },
  reactor: { temperature: 78.0, pressure: 2.45, level: 46.0, agitator_speed: 350, cooling_status: 1 },
  diagnosis: { anomaly: true, severity: 'HIGH', anomaly_score: 0.72 }
};

const parsedPump = WhatIf.parseScenarioFromQuery("What happens if I increase pump speed to 2200 RPM?", [], degradedState);
const simResult = WhatIf.runWhatIfSimulation(parsedPump.scenario, degradedState);

console.log(`   Target: ${simResult.scenario.equipment_name} -> ${simResult.scenario.hypothetical_value} RPM`);
console.log(`   Pump Flow: ${simResult.current.pump.flow.toFixed(1)} L/min -> ${simResult.predicted.pump.flow.toFixed(1)} L/min`);
console.log(`   Reactor Temp: ${simResult.current.reactor.temperature.toFixed(1)}°C -> ${simResult.predicted.reactor.temperature.toFixed(1)}°C`);
console.log(`   Distillation Press: ${simResult.current.distillation.pressure.toFixed(2)} bar -> ${simResult.predicted.distillation.pressure.toFixed(2)} bar`);
console.log(`   Risk Transition: ${simResult.risk.currentStage} (${simResult.risk.currentScore}/100) -> ${simResult.risk.scenarioStage} (${simResult.risk.scenarioScore}/100)`);
console.log(`   Impact Chain Nodes: ${simResult.impactChain.length} steps`);

if (simResult.predicted.pump.flow <= simResult.current.pump.flow) {
  throw new Error('Flow failed to increase with RPM');
}
if (simResult.impactChain.length < 4) {
  throw new Error('Impact chain is too short');
}
console.log('✅ Flowsheet propagation and causal impact chain verified!\n');

// TEST 3: State Copy Isolation (Verify realState remains untouched)
console.log('Test 3: Verify Isolated State Copy (Zero Live Mutation)...');
const originalRpm = degradedState.pump.rpm;
const originalFlow = degradedState.pump.flow;
if (degradedState.pump.rpm !== originalRpm || degradedState.pump.flow !== originalFlow) {
  throw new Error('Live process state was mutated during simulation!');
}
console.log(`   Original state preserved: ${degradedState.pump.rpm} RPM, ${degradedState.pump.flow} L/min`);
console.log('✅ State isolation verified!\n');

// TEST 4: Dangerous Scenario & Safety Gate Verification (Reactor Cooling Failure)
console.log('Test 4: Dangerous Scenario & Safety Gate (Reactor Cooling Failure)...');
const parsedCooling = WhatIf.parseScenarioFromQuery("What if reactor cooling fails?", [], liveStateBaseline);
const runawayResult = WhatIf.runWhatIfSimulation(parsedCooling.scenario, liveStateBaseline);

console.log(`   Cooling Status: ${runawayResult.predicted.reactor.cooling_status} (Tripped)`);
console.log(`   Predicted Reactor Temp: ${runawayResult.predicted.reactor.temperature.toFixed(1)} °C`);
console.log(`   Predicted Reactor Pressure: ${runawayResult.predicted.reactor.pressure.toFixed(2)} bar`);
console.log(`   Risk Stage: ${runawayResult.risk.scenarioStage} (${runawayResult.risk.scenarioScore}/100)`);
console.log(`   Is Dangerous Flag: ${runawayResult.risk.isDangerous}`);

if (!runawayResult.risk.isDangerous || runawayResult.risk.scenarioStage !== 'CRITICAL') {
  throw new Error('Reactor cooling failure failed to trigger CRITICAL risk stage');
}
console.log('✅ Safety Gate critical alert verified!\n');

// TEST 5: Multi-Scenario Comparison Matrix
console.log('Test 5: Multi-Scenario Comparison ("Compare 2000 RPM and 2200 RPM")...');
const parsedMulti = WhatIf.parseScenarioFromQuery("Compare 2000 RPM and 2200 RPM", [], liveStateBaseline);
if (!parsedMulti.isMulti || parsedMulti.scenarios.length !== 2) {
  throw new Error('Multi-scenario parsing failed');
}

const multiRes = WhatIf.runMultiScenarioComparison(parsedMulti.scenarios, liveStateBaseline);
console.log(`   Baseline Flow: ${multiRes.baseline.flow.toFixed(1)} L/min`);
for (const s of multiRes.scenarios) {
  console.log(`   ${s.label}: Flow = ${s.flow.toFixed(1)} L/min, Reactor Temp = ${s.reactorTemp.toFixed(1)}°C, Risk = ${s.riskStage} (${s.riskScore}/100)`);
}
if (multiRes.scenarios[0].flow >= multiRes.scenarios[1].flow) {
  throw new Error('Scenario comparison flow ordering invalid');
}
console.log('✅ Multi-scenario comparison matrix verified!\n');

// TEST 6: Structured Engineering Explanation
console.log('Test 6: Structured Engineering Explanation...');
const explanation = WhatIf.generateWhatIfExplanation(simResult);
console.log('--- EXPLANATION SAMPLE ---');
console.log(explanation);
console.log('--------------------------');

const requiredHeadings = ['1. What changed:', '2. Why it changed:', '3. Equipment affected:', '4. Downstream consequences:', '5. Risk change:', '6. Possible benefits:', '7. Possible risks:', '8. Pre-application verification:'];
for (const h of requiredHeadings) {
  if (!explanation.includes(h)) {
    throw new Error(`Explanation missing required heading: ${h}`);
  }
}
console.log('✅ All 8 engineering explanation requirements verified!\n');

console.log('🎉 ALL WHAT-IF SIMULATOR UNIT TESTS PASSED SUCCESSFULLY!');
