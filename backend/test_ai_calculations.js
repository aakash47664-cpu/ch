/**
 * ChemDiag Industrial AI — Engineering Calculations & Multi-Turn Verification Suite
 * 
 * Verifies that ChemDiag Industrial AI:
 * 1. Accurately performs dynamic, deterministic engineering calculations (NO hardcoded FAQ answers).
 * 2. Provides transparent derivations: Given Parameters, Governing Equations, Substitutions, Computed Results with Units, and Engineering Interpretations.
 * 3. Supports multi-turn conversational follow-ups across calculation chains:
 *    Turn 1: "A pipe carries 5 m³/h through a 25 mm pipe. Calculate velocity."
 *    Turn 2: "Why did you divide by 3600?"
 *    Turn 3: "What if the diameter becomes 50 mm?"
 *    Turn 4: "How does that affect pressure drop?"
 * 4. Responds accurately to parameter queries:
 *    "What information do I need to calculate pump power?" -> "Calculate it using 20 m head and 10 L/s."
 * 5. Intelligently grounds calculations with live plant telemetry:
 *    "Estimate the hydraulic power of my current pump." (P-101 telemetry)
 * 6. Handles heat transfer duties, CSTR kinetics, Reynolds numbers, and PID errors.
 */

import { answerProcessQuestion } from './services/copilot.js';
import * as Units from './engineering/units.js';
import * as Fluid from './engineering/fluidMechanics.js';
import * as Heat from './engineering/heatTransfer.js';
import * as Thermo from './engineering/thermodynamics.js';
import * as Reaction from './engineering/reactionEngineering.js';
import * as Mass from './engineering/massTransfer.js';
import * as Control from './engineering/processControl.js';
import * as Equipment from './engineering/equipment.js';
import { executeEngineeringTool } from './engineering/index.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('===============================================================');
console.log('CHEMDIAG INDUSTRIAL AI: ENGINEERING CALCULATION ENGINE TESTS');
console.log('===============================================================\n');

const mockLiveState = {
  activeFault: 'normal',
  equipment: {
    pump: {
      data: { rpm: 2450, vibration: 0.08, flow: 10.0, inlet_temperature: 25.2, outlet_temperature: 38.1 }
    },
    heat_exchanger: {
      data: { inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, efficiency: 95.0 }
    },
    reactor: {
      data: { temperature: 65.0, pressure: 2.05, level: 50.0, agitator_speed: 350, cooling_status: 1 }
    },
    distillation: {
      data: { top_temperature: 76.5, bottom_temperature: 98.4, pressure: 2.10, level: 52.0, reflux_ratio: 1.85 }
    }
  },
  diagnosis: {
    anomaly: false,
    severity: 'NORMAL',
    probable_fault: 'Nominal Operation',
    confidence: 0.95
  }
};

// =========================================================================
// TEST 1: PIPE VELOCITY CALCULATION
// =========================================================================
console.log('--- Test 1: Pipe Flow Velocity Calculation ---');
const t1Res = answerProcessQuestion({
  message: 'A pipe carries 5 m³/h through a 25 mm pipe. Calculate velocity.',
  liveState: mockLiveState
});

assert(t1Res.success === true, 'Turn 1 returns success: true');
assert(t1Res.answer.includes('2.83') || t1Res.answer.includes('2.829'), 'Turn 1 calculates velocity ~2.83 m/s');
assert(t1Res.answer.includes('m³/s') || t1Res.answer.includes('3600'), 'Turn 1 shows flow rate conversion in m³/s');
assert(t1Res.answer.includes('A = (π · D²) / 4') || t1Res.answer.includes('v = Q / A'), 'Turn 1 includes governing formulas');
assert(t1Res.answer.includes('Assumptions') || t1Res.answer.includes('Interpretation'), 'Turn 1 provides engineering interpretation');

// =========================================================================
// TEST 2: MULTI-TURN TURN 2: "Why did you divide by 3600?"
// =========================================================================
console.log('\n--- Test 2: Multi-Turn: "Why did you divide by 3600?" ---');
const historyTurn1 = [
  { sender: 'user', message: 'A pipe carries 5 m³/h through a 25 mm pipe. Calculate velocity.' },
  { sender: 'ai', message: t1Res.answer }
];

const t2Res = answerProcessQuestion({
  message: 'Why did you divide by 3600?',
  history: historyTurn1,
  liveState: mockLiveState
});

assert(t2Res.success === true, 'Turn 2 returns success: true');
assert(t2Res.answer.includes('60') && t2Res.answer.includes('seconds in one hour'), 'Turn 2 explains 3600 = 60 min * 60 sec');
assert(t2Res.answer.includes('m³/h') && t2Res.answer.includes('m³/s'), 'Turn 2 explains conversion from m³/h to SI m³/s');
assert(t2Res.answer.includes('m/s'), 'Turn 2 explains dimensional consistency for velocity in m/s');

// =========================================================================
// TEST 3: MULTI-TURN TURN 3: "What if the diameter becomes 50 mm?"
// =========================================================================
console.log('\n--- Test 3: Multi-Turn: "What if the diameter becomes 50 mm?" ---');
const historyTurn2 = [
  ...historyTurn1,
  { sender: 'user', message: 'Why did you divide by 3600?' },
  { sender: 'ai', message: t2Res.answer }
];

const t3Res = answerProcessQuestion({
  message: 'What if the diameter becomes 50 mm?',
  history: historyTurn2,
  liveState: mockLiveState
});

assert(t3Res.success === true, 'Turn 3 returns success: true');
assert(t3Res.answer.includes('0.71') || t3Res.answer.includes('0.707'), 'Turn 3 calculates new velocity ~0.71 m/s (25% of 2.83 m/s)');
assert(t3Res.answer.includes('50') && t3Res.answer.includes('mm'), 'Turn 3 acknowledges 50 mm pipe');
assert(t3Res.answer.includes('4') || t3Res.answer.includes('D²') || t3Res.answer.includes('quarter'), 'Turn 3 explains inverse-square area/velocity scaling');

// =========================================================================
// TEST 4: MULTI-TURN TURN 4: "How does that affect pressure drop?"
// =========================================================================
console.log('\n--- Test 4: Multi-Turn: "How does that affect pressure drop?" ---');
const historyTurn3 = [
  ...historyTurn2,
  { sender: 'user', message: 'What if the diameter becomes 50 mm?' },
  { sender: 'ai', message: t3Res.answer }
];

const t4Res = answerProcessQuestion({
  message: 'How does that affect pressure drop?',
  history: historyTurn3,
  liveState: mockLiveState
});

assert(t4Res.success === true, 'Turn 4 returns success: true');
assert(t4Res.answer.includes('Darcy-Weisbach'), 'Turn 4 references Darcy-Weisbach equation');
assert(t4Res.answer.includes('1 / D⁵') || t4Res.answer.includes('1/D⁵') || t4Res.answer.includes('D⁵') || t4Res.answer.includes('32'), 'Turn 4 explains 1/D⁵ scaling factor of 32 (96.9% drop)');

// =========================================================================
// TEST 5: SENSIBLE HEATING ENERGY CALCULATION
// =========================================================================
console.log('\n--- Test 5: Water Heating Energy Calculation ---');
const t5Res = answerProcessQuestion({
  message: 'How much energy is required to heat 100 kg of water from 25°C to 80°C?',
  liveState: mockLiveState
});

assert(t5Res.success === true, 'Turn 5 returns success: true');
assert(t5Res.answer.includes('23012') || t5Res.answer.includes('23.01') || t5Res.answer.includes('23012 kJ'), 'Turn 5 calculates ~23,012 kJ (23.01 MJ)');
assert(t5Res.answer.includes('Q = m · Cp · ΔT') || t5Res.answer.includes('Q = m · Cp'), 'Turn 5 states sensible heat formula');
assert(t5Res.answer.includes('4.184') || t5Res.answer.includes('4.18'), 'Turn 5 uses water specific heat ~4.184 kJ/kg·K');

// =========================================================================
// TEST 6: HEAT EXCHANGER DUTY CALCULATION
// =========================================================================
console.log('\n--- Test 6: Continuous Heat Exchanger Duty Calculation ---');
const t6Res = answerProcessQuestion({
  message: 'Calculate heat exchanger duty if flow is 2 kg/s, Cp is 4.18 kJ/kg-K and temperature rises by 10°C.',
  liveState: mockLiveState
});

assert(t6Res.success === true, 'Turn 6 returns success: true');
assert(t6Res.answer.includes('83.6') || t6Res.answer.includes('83.6 kW'), 'Turn 6 calculates 83.6 kW duty');
assert(t6Res.answer.includes('Q̇ = ṁ · Cp · ΔT') || t6Res.answer.includes('Cp'), 'Turn 6 shows duty formula');

// =========================================================================
// TEST 7: PUMP POWER INFORMATION QUERY
// =========================================================================
console.log('\n--- Test 7: Pump Power Information Requirements ---');
const t7Res = answerProcessQuestion({
  message: 'What information do I need to calculate pump power?',
  liveState: mockLiveState
});

assert(t7Res.success === true, 'Turn 7 returns success: true');
assert(t7Res.answer.includes('Flow Rate') || t7Res.answer.includes('Volumetric Flow'), 'Turn 7 mentions flow rate (Q)');
assert(t7Res.answer.includes('Head') || t7Res.answer.includes('Differential Pressure'), 'Turn 7 mentions head (H) / differential pressure');
assert(t7Res.answer.includes('Density') || t7Res.answer.includes('Specific Gravity'), 'Turn 7 mentions fluid density (ρ)');
assert(t7Res.answer.includes('Efficiency'), 'Turn 7 mentions pump efficiency (η)');
assert(t7Res.answer.includes('P_hydraulic') || t7Res.answer.includes('ρ · g · Q · H'), 'Turn 7 provides hydraulic power formula');

// =========================================================================
// TEST 8: PUMP POWER DETERMINISTIC CALCULATION
// =========================================================================
console.log('\n--- Test 8: Pump Power Calculation ---');
const t8Res = answerProcessQuestion({
  message: 'A pump delivers 10 L/s against 20 m head. Estimate hydraulic power.',
  liveState: mockLiveState
});

assert(t8Res.success === true, 'Turn 8 returns success: true');
assert(t8Res.answer.includes('1.96') || t8Res.answer.includes('1.962') || t8Res.answer.includes('1962'), 'Turn 8 calculates hydraulic power ~1.962 kW (1962 W)');
assert(t8Res.answer.includes('Shaft Power') || t8Res.answer.includes('2.62') || t8Res.answer.includes('2.616'), 'Turn 8 computes required shaft power');

// =========================================================================
// TEST 9: LIVE PLANT PUMP HYDRAULIC POWER AUDIT
// =========================================================================
console.log('\n--- Test 9: Live ChemDiag Pump Hydraulic Power ---');
const t9Res = answerProcessQuestion({
  message: 'Estimate the hydraulic power of my current pump.',
  liveState: mockLiveState
});

assert(t9Res.success === true, 'Turn 9 returns success: true');
assert(t9Res.answer.includes('P-101') || t9Res.answer.includes('LIVE CHEMDIAG'), 'Turn 9 grounds calculation to P-101 pump');
assert(t9Res.answer.includes('RPM') || t9Res.answer.includes('2450'), 'Turn 9 uses live RPM telemetry');
assert(t9Res.answer.includes('Watts') || t9Res.answer.includes('W') || t9Res.answer.includes('kW'), 'Turn 9 calculates live hydraulic power');

// =========================================================================
// TEST 10: REYNOLDS NUMBER CALCULATION
// =========================================================================
console.log('\n--- Test 10: Reynolds Number Calculation ---');
const t10Res = answerProcessQuestion({
  message: 'What is the Reynolds number for this pipe?',
  history: historyTurn1,
  liveState: mockLiveState
});

assert(t10Res.success === true, 'Turn 10 returns success: true');
assert(t10Res.answer.includes('70,7') || t10Res.answer.includes('707') || t10Res.answer.includes('TURBULENT'), 'Turn 10 calculates Re ~70,700 and Turbulent regime');
assert(t10Res.answer.includes('Re = (ρ · v · D) / μ') || t10Res.answer.includes('Re ='), 'Turn 10 states Reynolds formula');

// =========================================================================
// TEST 11: CSTR RESIDENCE TIME
// =========================================================================
console.log('\n--- Test 11: CSTR Residence Time ---');
const t11Res = answerProcessQuestion({
  message: 'How do I calculate CSTR residence time?',
  liveState: mockLiveState
});

assert(t11Res.success === true, 'Turn 11 returns success: true');
assert(t11Res.answer.includes('τ = V / v₀') || t11Res.answer.includes('V / v0') || t11Res.answer.includes('V / v'), 'Turn 11 states space time equation tau = V / v0');
assert(t11Res.answer.includes('Volume') && t11Res.answer.includes('Flow'), 'Turn 11 explains required variables');

// =========================================================================
// TEST 12: PID ERROR CALCULATION
// =========================================================================
console.log('\n--- Test 12: PID Error Calculation ---');
const t12Res = answerProcessQuestion({
  message: 'Calculate PID error if setpoint is 80°C and process temperature is 73°C.',
  liveState: mockLiveState
});

assert(t12Res.success === true, 'Turn 12 returns success: true');
assert(t12Res.answer.includes('+7.0') || t12Res.answer.includes('7.0 °C') || t12Res.answer.includes('7 °C'), 'Turn 12 calculates error = +7.0 °C');
assert(t12Res.answer.includes('8.75%') || t12Res.answer.includes('8.8%'), 'Turn 12 calculates relative error ~8.75%');
assert(t12Res.answer.includes('e(t) = SP - PV') || t12Res.answer.includes('SP - PV'), 'Turn 12 states error equation');

// =========================================================================
// TEST 13: NON-CALCULATION QUERIES STILL WORK PROPERLY
// =========================================================================
console.log('\n--- Test 13: General Scientific & Process Inquiries ---');
const t13aRes = answerProcessQuestion({
  message: 'Why is the sky blue?',
  liveState: mockLiveState
});
assert(t13aRes.answer.includes('Rayleigh Scattering') && !t13aRes.answer.includes('P-101'), 'Sky blue explains Rayleigh scattering without telemetry dump');

const t13bRes = answerProcessQuestion({
  message: 'Explain entropy in thermodynamics in your own words.',
  liveState: mockLiveState
});
assert(t13bRes.answer.includes('entropy') && t13bRes.answer.includes('Second Law') && !t13bRes.answer.includes('P-101'), 'Entropy explains 2nd Law without telemetry dump');

console.log('\n===============================================================');
console.log(`SUMMARY: ${passed} / ${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
console.log('===============================================================');

if (passed === total) {
  console.log('🎉 ALL ENGINEERING CALCULATION & MULTI-TURN TESTS PASSED!');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED');
  process.exit(1);
}
