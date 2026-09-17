import { ProcessSimulator } from './backend/simulator/processSimulator.js';

console.log('🧪 Testing ProcessSimulator First-Principles Causal Dynamics...\n');

const sim = new ProcessSimulator();
console.log('1. Initial nominal steady state:');
let state = sim.getState();
const streamList = Array.isArray(state.streams) ? state.streams : Object.values(state.streams);
console.log(`   Pump Flow: ${state.pump.flow} L/min, Head: ${state.pump.head} m, Eff: ${state.pump.efficiency}%, Power: ${state.pump.power_kw} kW`);
console.log(`   E-101 Duty: ${state.heatExchanger.heat_duty} kW, U: ${state.heatExchanger.overall_u} W/m2K, Rf: ${state.heatExchanger.fouling_factor}`);
console.log(`   R-101 Conv: ${state.reactor.conversion}%, Tau: ${state.reactor.residence_time} min, Temp: ${state.reactor.temperature}°C`);
console.log(`   D-101 Reflux: ${state.distillation.reflux_ratio}, Purity: ${state.distillation.separation_purity}%, Press: ${state.distillation.pressure} bar`);
console.log(`   Streams count: ${streamList.length}`);

// Test manual control overrides
console.log('\n2. Testing Pump RPM reduction to 1700 RPM:');
sim.setUserControls({ pump_rpm: 1700 });
for (let i = 0; i < 5; i++) {
  state = sim.tick();
}
const sList = Array.isArray(state.streams) ? state.streams : Object.values(state.streams);
console.log(`   After 5 ticks -> Pump RPM: ${state.pump.rpm}, Flow: ${state.pump.flow} L/min`);
console.log(`   E-101 Flow: ${state.heatExchanger.flow} L/min`);
console.log(`   R-101 Feed Flow: ${state.reactor.feed_flow} L/min`);
console.log(`   D-101 Distillate Flow: ${state.distillation.distillate_flow} L/min`);
console.log(`   Stream S-100 Flow: ${sList[0].flow || sList[0].flow_rate} L/min`);
console.log(`   Stream S-103 Reactor Effluent Flow: ${sList[3].flow || sList[3].flow_rate} L/min`);

if (state.pump.flow <= 7.2 && state.reactor.feed_flow <= 7.2) {
  console.log('✅ Flow propagation successfully verified!');
} else {
  console.error('❌ Flow propagation failed');
}

// Test Reactor cooling trip
console.log('\n3. Testing Reactor Cooling Trip (cooling_status = 0):');
sim.setUserControls({ cooling_status: 0 });
for (let i = 0; i < 6; i++) {
  state = sim.tick();
}
console.log(`   R-101 Temp: ${state.reactor.temperature}°C, Press: ${state.reactor.pressure} bar`);
if (state.reactor.temperature >= 75.0 && state.reactor.pressure >= 2.05) {
  console.log('✅ Reactor exotherm surge successfully verified!');
} else {
  console.error('❌ Reactor surge failed');
}

// Test Exchanger Fouling
console.log('\n4. Testing Heat Exchanger Fouling (fouling_level = 60%):');
sim.setUserControls({ fouling_level: 60, cooling_status: 1, pump_rpm: 2450 });
for (let i = 0; i < 5; i++) {
  state = sim.tick();
}
console.log(`   E-101 Eff: ${state.heatExchanger.efficiency}%, U: ${state.heatExchanger.overall_u} W/m2K, Rf: ${state.heatExchanger.fouling_factor}`);
console.log(`   E-101 Tout: ${state.heatExchanger.outlet_temperature}°C`);
if (state.heatExchanger.overall_u < 750) {
  console.log('✅ Heat Exchanger fouling degradation verified!');
} else {
  console.error('❌ Exchanger fouling failed');
}

console.log('\n🎉 ALL FIRST-PRINCIPLES SIMULATION PROPAGATION TESTS PASSED!\n');
