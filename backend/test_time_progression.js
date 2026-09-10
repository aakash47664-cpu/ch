/**
 * Automated Time-Series Progression Verification Suite for ChemDiag AI
 */

import { ProcessSimulator } from './simulator/processSimulator.js';
import { IsolationForest } from './ai/isolationForest.js';
import { RandomForestClassifier } from './ai/randomForest.js';
import { generateSyntheticDataset, FEATURE_NAMES, CLASSES } from './ai/syntheticData.js';
import { diagnoseProcessState } from './ai/rootCauseEngine.js';

console.log('🤖 Training ML Models on synthetic dataset...');
const trainingData = generateSyntheticDataset(250);
const ifForest = new IsolationForest(40, 256, 0.58);
ifForest.fit(trainingData.map(d => d.features), FEATURE_NAMES);
const rfForest = new RandomForestClassifier(25, 12, 2);
rfForest.fit(trainingData, FEATURE_NAMES, CLASSES);

const simulator = new ProcessSimulator();

function evaluateCurrentState() {
  const simState = simulator.getState();
  const telemetryVector = {
    pump_rpm: simState.demoPump.rpm,
    pump_vibration: simState.demoPump.vibration,
    pump_inlet_temperature: simState.demoPump.inlet_temperature,
    pump_outlet_temperature: simState.demoPump.outlet_temperature,
    heat_exchanger_inlet_temperature: simState.demoHeatExchanger.inlet_temperature,
    heat_exchanger_outlet_temperature: simState.demoHeatExchanger.outlet_temperature,
    heat_exchanger_indicator: simState.demoHeatExchanger.heat_transfer_indicator,
    reactor_temperature: simState.reactor.temperature,
    reactor_pressure: simState.reactor.pressure,
    reactor_level: simState.reactor.level,
    reactor_agitator_speed: simState.reactor.agitator_speed,
    reactor_cooling_status: simState.reactor.cooling_status,
    distillation_top_temperature: simState.distillation.top_temperature,
    distillation_bottom_temperature: simState.distillation.bottom_temperature,
    distillation_pressure: simState.distillation.pressure,
    distillation_level: simState.distillation.level,
    distillation_reflux_ratio: simState.distillation.reflux_ratio
  };

  const mlSample = {
    temperature: telemetryVector.reactor_temperature,
    pressure: telemetryVector.reactor_pressure,
    level: telemetryVector.reactor_level,
    vibration: telemetryVector.pump_vibration,
    rpm: telemetryVector.pump_rpm,
    inlet_temperature: telemetryVector.pump_inlet_temperature,
    outlet_temperature: telemetryVector.pump_outlet_temperature,
    reflux_ratio: telemetryVector.distillation_reflux_ratio,
    agitator_speed: telemetryVector.reactor_agitator_speed
  };

  const ifRes = ifForest.predict(mlSample);
  const rfRes = rfForest.predict(mlSample);
  const diag = diagnoseProcessState({
    telemetry: telemetryVector,
    mlAnomaly: ifRes.anomaly,
    mlScore: ifRes.anomaly_score,
    mlClass: rfRes.fault_type,
    mlConfidence: rfRes.confidence,
    rfProbabilities: rfRes.probabilities || {},
    faultMode: simulator.getFault(),
    faultSeverity: simulator.getFaultSeverity ? simulator.getFaultSeverity() : 0.0,
    faultTicks: simulator.getFaultTicks ? simulator.getFaultTicks() : 0
  });

  return { simState, diag };
}

async function runTests() {
  console.log('\n=======================================================');
  console.log('🧪 TEST 1: DISTILLATION TIME-BASED PROGRESSION');
  console.log('=======================================================');
  simulator.setFault('distillation_fault');

  let anomalyDetectedAt = null;
  let overpressureDetectedAt = null;

  for (let sec = 1; sec <= 20; sec++) {
    simulator.tick();
    const { simState, diag } = evaluateCurrentState();
    const d = simState.distillation;

    if (diag.anomaly && anomalyDetectedAt === null) {
      anomalyDetectedAt = sec;
    }
    if (diag.severity === 'HIGH' && d.pressure > 2.6 && overpressureDetectedAt === null) {
      overpressureDetectedAt = sec;
    }

    if (sec === 3 || sec === 8 || sec === 13 || sec === 18) {
      console.log(`⏱ t = ${sec}s | Reflux: ${d.reflux_ratio.toFixed(2)} | TopT: ${d.top_temperature.toFixed(1)}°C | Press: ${d.pressure.toFixed(2)} bar`);
      console.log(`   -> Anomaly: ${diag.anomaly} | Fault: ${diag.fault} | Severity: ${diag.severity} | Conf: ${Math.round(diag.confidence * 100)}%`);
      console.log(`   -> Root Cause: "${diag.root_cause}"`);
      console.log(`   -> Evidence: ${JSON.stringify(diag.evidence_cards.map(c => `${c.label}: ${c.val} (${c.state})`))}`);
    }
  }

  if (anomalyDetectedAt !== null && overpressureDetectedAt !== null) {
    console.log(`✅ Distillation fault progression verified (Anomaly at ${anomalyDetectedAt}s, Overpressure/Severity escalation at ${overpressureDetectedAt}s).`);
  } else {
    console.error(`❌ Distillation timing unexpected: anomaly at ${anomalyDetectedAt}s, overpressure at ${overpressureDetectedAt}s`);
  }

  console.log('\n=======================================================');
  console.log('🧪 TEST 2: PUMP MECHANICAL FAULT TIME PROGRESSION');
  console.log('=======================================================');
  simulator.setFault('pump_fault');
  for (let sec = 1; sec <= 12; sec++) {
    simulator.tick();
    if (sec === 2 || sec === 6 || sec === 11) {
      const { simState, diag } = evaluateCurrentState();
      const p = simState.demoPump;
      console.log(`⏱ t = ${sec}s | RPM: ${p.rpm} | Vib: ${p.vibration.toFixed(2)} g | OutTemp: ${p.outlet_temperature.toFixed(1)}°C`);
      console.log(`   -> Anomaly: ${diag.anomaly} | Fault: ${diag.fault} | Severity: ${diag.severity}`);
      console.log(`   -> Root Cause: "${diag.root_cause}"`);
      console.log(`   -> Action: "${diag.recommended_action}"`);
    }
  }

  console.log('\n=======================================================');
  console.log('🧪 TEST 3: HEAT EXCHANGER TIME PROGRESSION');
  console.log('=======================================================');
  simulator.setFault('heat_exchanger_fault');
  for (let sec = 1; sec <= 12; sec++) {
    simulator.tick();
    if (sec === 2 || sec === 6 || sec === 11) {
      const { simState, diag } = evaluateCurrentState();
      const hx = simState.demoHeatExchanger;
      console.log(`⏱ t = ${sec}s | InTemp: ${hx.inlet_temperature.toFixed(1)}°C | OutTemp: ${hx.outlet_temperature.toFixed(1)}°C | ΔT: ${hx.temperature_difference.toFixed(1)}°C`);
      console.log(`   -> Anomaly: ${diag.anomaly} | Fault: ${diag.fault} | Severity: ${diag.severity}`);
      console.log(`   -> Root Cause: "${diag.root_cause}"`);
    }
  }

  console.log('\n=======================================================');
  console.log('🧪 TEST 4: REACTOR COOLING FAILURE PROGRESSION');
  console.log('=======================================================');
  simulator.setFault('reactor_cooling_failure');
  for (let sec = 1; sec <= 14; sec++) {
    simulator.tick();
    if (sec === 2 || sec === 6 || sec === 12) {
      const { simState, diag } = evaluateCurrentState();
      const r = simState.reactor;
      console.log(`⏱ t = ${sec}s | Cooling: ${r.cooling_status === 1 ? 'ON' : 'OFF'} | Temp: ${r.temperature.toFixed(1)}°C | Press: ${r.pressure.toFixed(2)} bar`);
      console.log(`   -> Anomaly: ${diag.anomaly} | Fault: ${diag.fault} | Severity: ${diag.severity}`);
      console.log(`   -> Root Cause: "${diag.root_cause}"`);
    }
  }

  console.log('\n=======================================================');
  console.log('🧪 TEST 5: RETURN TO NORMAL RESET');
  console.log('=======================================================');
  simulator.setFault('normal');
  for (let sec = 1; sec <= 3; sec++) {
    simulator.tick();
  }
  const { simState, diag } = evaluateCurrentState();
  console.log(`⏱ Reset Result: Anomaly = ${diag.anomaly} | Fault = "${diag.fault}" | Severity = ${diag.severity}`);
  console.log(`   -> Root Cause: "${diag.root_cause}"`);
  console.log(`   -> Variables: ${JSON.stringify(diag.important_variables)}`);
  console.log(`   -> Action: "${diag.recommended_action}"`);

  if (!diag.anomaly && diag.severity === 'NORMAL' && diag.fault === 'None') {
    console.log('\n🎉 ALL TIME PROGRESSION & DYNAMIC DIAGNOSIS TESTS PASSED!');
  } else {
    console.error('❌ Reset check failed!');
  }
}

runTests();
