import { EarlyFaultEngine } from './engineering/earlyFaultEngine.js';

console.log('🧪 Testing EarlyFaultEngine...');

const engine = new EarlyFaultEngine();

// 1. Normal state test
const normalTelemetry = {
  pump_rpm: 2450,
  pump_vibration: 0.08,
  pump_flow: 10.0,
  pump_discharge_pressure: 2.80,
  pump_inlet_temperature: 25.2,
  pump_outlet_temperature: 38.1,
  hx_inlet_temp: 38.1,
  hx_outlet_temp: 25.2,
  hx_delta_t: 12.9,
  hx_efficiency: 95.0,
  hx_flow: 9.9,
  reactor_temp: 65.0,
  reactor_pressure: 2.05,
  reactor_level: 50.0,
  reactor_feed_flow: 9.8,
  reactor_cooling_status: 1,
  reactor_agitator_speed: 350,
  dist_reflux_ratio: 1.85,
  dist_top_temp: 76.5,
  dist_bottom_temp: 98.4,
  dist_pressure: 2.10,
  dist_feed_flow: 9.7
};

const r1 = engine.processTelemetry(normalTelemetry, 'normal');
console.log('--- TEST 1: Baseline Normal ---');
console.log('Process Health Score:', r1.process_health.score, 'Stage:', r1.process_health.stage);
console.log('Pump Health:', r1.equipment_health.pump.health);
console.log('Early Warnings Count:', r1.early_warnings.length);
console.log('Watch List top 1:', r1.watch_list[0].equipment, r1.watch_list[0].attentionLevel);

if (r1.process_health.score >= 90) {
  console.log('✅ PASS: Normal health is >= 90%');
} else {
  console.error('❌ FAIL: Expected >= 90%');
}

// 2. Early Pump Degradation test
console.log('--- TEST 2: Early Pump Vibration Drift ---');
const degradingTelemetry = {
  ...normalTelemetry,
  pump_rpm: 2360,
  pump_vibration: 0.20,
  pump_flow: 9.1
};

const r2 = engine.processTelemetry(degradingTelemetry, 'early_pump_degradation');
console.log('Process Health Score:', r2.process_health.score, 'Stage:', r2.process_health.stage);
console.log('Pump Health:', r2.equipment_health.pump.health, 'Stage:', r2.equipment_health.pump.stage);
console.log('What Changed items:', r2.what_changed.length, 'Top:', r2.what_changed[0]?.name, r2.what_changed[0]?.deltaPercent + '%');
console.log('Early Warnings:', r2.early_warnings.map(w => `${w.equipment}: ${w.title}`));
console.log('Watch List top 1:', r2.watch_list[0].equipment, r2.watch_list[0].attentionLevel);
console.log('Causal Propagation:', r2.causal_propagation.primarySource);

if (r2.equipment_health.pump.health < 85 && r2.watch_list[0].equipment === 'P-101') {
  console.log('✅ PASS: Early pump degradation accurately detected and prioritized in watch list');
} else {
  console.error('❌ FAIL: Pump should be degraded and top of watch list');
}

console.log('🎉 EarlyFaultEngine unit test complete!');
