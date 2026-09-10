/**
 * Automated Acceptance Test Suite for ChemDiag AI Complete Novelty
 * Validates:
 *  1. Normal Operation Pipeline
 *  2. Early Fault Detection before failure limit
 *  3. Confirmed Fault with XAI attribution & Operator-Gated Preventive Action
 *  4. UNKNOWN FAULT (Core USP): Isolation Forest Anomaly + Low RF match -> DO NOT ACT, DO NOT FORCE CLASSIFICATION
 *  5. Sensor Reliability drops -> Safety Gate blocks recommendations
 *  6. Grounded Copilot Q&A across multiple queries
 *  7. Operator Approval recording to SQLite
 */

import { ProcessSimulator } from './simulator/processSimulator.js';
import { IsolationForest } from './ai/isolationForest.js';
import { RandomForestClassifier } from './ai/randomForest.js';
import { generateSyntheticDataset, FEATURE_NAMES, CLASSES } from './ai/syntheticData.js';
import { diagnoseProcessState } from './ai/rootCauseEngine.js';
import { answerProcessQuestion } from './services/copilot.js';
import { initDb, recordOperatorApproval, getRecentOperatorApprovals } from './database/db.js';

async function runTests() {
  console.log('================================================================');
  console.log('CHEMDIAG AI NOVELTY ACCEPTANCE TEST SUITE');
  console.log('USP: "AI that knows when NOT to recommend action"');
  console.log('================================================================\n');

  await initDb();

  // Train ML models
  const syntheticData = generateSyntheticDataset(300);
  const isolationForest = new IsolationForest(40, 256, 0.58);
  isolationForest.fit(syntheticData.map(d => d.features), FEATURE_NAMES);

  const randomForest = new RandomForestClassifier(25, 8, 4);
  randomForest.fit(syntheticData, FEATURE_NAMES, CLASSES);

  const simulator = new ProcessSimulator();

  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, message) {
    totalCount++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
    }
  }

  function runSimulationStep(faultMode, tickCount = 8) {
    simulator.setFault(faultMode);
    for (let i = 0; i < tickCount; i++) {
      simulator.tick();
    }
    const simState = simulator.getState();
    const telemetryVector = {
      pump_rpm: simState.pump.rpm,
      pump_vibration: simState.pump.vibration,
      pump_flow: simState.pump.flow,
      pump_inlet_temperature: simState.pump.inlet_temperature,
      pump_outlet_temperature: simState.pump.outlet_temperature,
      heat_exchanger_inlet_temperature: simState.heatExchanger.inlet_temperature,
      heat_exchanger_outlet_temperature: simState.heatExchanger.outlet_temperature,
      heat_exchanger_efficiency: simState.heatExchanger.efficiency,
      heat_exchanger_indicator: simState.heatExchanger.heat_transfer_indicator,
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

    const ifRes = isolationForest.predict(mlSample);
    const rfRes = randomForest.predict(mlSample);

    const diagnosis = diagnoseProcessState({
      telemetry: telemetryVector,
      mlAnomaly: ifRes.anomaly,
      mlScore: ifRes.anomaly_score,
      mlClass: rfRes.fault_type,
      mlConfidence: rfRes.confidence,
      rfProbabilities: rfRes.probabilities || {},
      faultMode,
      faultSeverity: simulator.getFaultSeverity(),
      faultTicks: simulator.getFaultTicks(),
      isHardwareOnline: false,
      hardwareLastSeen: 0,
      operatorApproved: false
    });

    return { simState, telemetryVector, diagnosis };
  }

  // -------------------------------------------------------------
  // TEST 1: Level 1 - Normal Operation
  // -------------------------------------------------------------
  console.log('--- TEST 1: Level 1 Normal Baseline Telemetry ---');
  const normalRun = runSimulationStep('normal', 3);
  const normalDiag = normalRun.diagnosis;

  assert(normalDiag.severity === 'NORMAL', `Normal state has NORMAL severity (got ${normalDiag.severity})`);
  assert(normalDiag.anomaly === false, `Anomaly flag is false for normal state (got ${normalDiag.anomaly})`);
  assert(normalDiag.is_unknown_fault === false, 'Normal state is not unknown fault');
  assert(normalDiag.safetyGate.safeToRecommend === true, 'Safety gate state is safe for nominal');
  assert(normalDiag.safetyGate.actionBlocked === false, 'Action is not blocked in normal state');
  assert(normalDiag.preventive.riskScore < 25, `Preventive risk score is low (${normalDiag.preventive.riskScore})`);

  // -------------------------------------------------------------
  // TEST 2: Level 2 - Early Pump Degradation
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Level 2 Early Pump Degradation ---');
  const earlyPumpRun = runSimulationStep('early_pump_degradation', 8);
  const earlyPumpDiag = earlyPumpRun.diagnosis;

  assert(earlyPumpDiag.prognosis.isEarlyWarning === true || earlyPumpDiag.fault.startsWith('early_'), 'Early warning detected');
  assert(earlyPumpDiag.equipment === 'P-101', `Equipment identified as P-101 (got ${earlyPumpDiag.equipment})`);
  assert(earlyPumpDiag.preventive.riskStage === 'EARLY_WARNING' || earlyPumpDiag.preventive.riskScore > 20, 'Preventive stage captures early drift');
  assert(earlyPumpDiag.xai_contributions.length > 0, 'XAI feature contributions generated');
  const sumXai = earlyPumpDiag.xai_contributions.reduce((acc, c) => acc + c.contributionPercent, 0);
  assert(Math.abs(sumXai - 100) <= 2, `XAI contributions sum to ~100% (got ${sumXai}%)`);
  assert(earlyPumpDiag.prognosis.timeToThreshold !== undefined, `Time-to-threshold prognosis computed: "${earlyPumpDiag.prognosis.timeToThreshold}"`);

  // -------------------------------------------------------------
  // TEST 3: Level 3 - Confirmed Pump Mechanical Fault
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Level 3 Confirmed Pump Mechanical Fault ---');
  const confPumpRun = runSimulationStep('pump_fault', 8);
  const confPumpDiag = confPumpRun.diagnosis;

  assert(confPumpDiag.anomaly === true, 'Anomaly detected');
  assert(confPumpDiag.equipment === 'P-101', `Equipment is P-101 (got ${confPumpDiag.equipment})`);
  assert(confPumpDiag.confidence >= 0.70, `High classification confidence: ${(confPumpDiag.confidence * 100).toFixed(1)}%`);
  assert(confPumpDiag.is_unknown_fault === false, 'Not flagged as unknown fault');
  assert(confPumpDiag.safetyGate.requiresOperatorApproval === true, 'Safety Gate enforces Operator Approval required');
  assert(confPumpDiag.safetyGate.safeToRecommend === true, 'Safe to recommend specific preventive measure');
  assert(confPumpDiag.recommended_action && confPumpDiag.recommended_action.toLowerCase().includes('pump'), 'Actionable specific recommendation provided');

  // -------------------------------------------------------------
  // TEST 4: Level 4 - PRIMARY USP: UNKNOWN FAULT
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Level 4 PRIMARY USP - Unknown Fault (Knows when NOT to act) ---');
  const unknownRun = runSimulationStep('unknown_fault', 12);
  const unknownDiag = unknownRun.diagnosis;

  assert(unknownDiag.anomaly === true, 'Anomaly flag triggered by Isolation Forest');
  assert(unknownDiag.is_unknown_fault === true, 'Unknown Fault Guard triggered (is_unknown_fault = true)');
  assert(unknownDiag.confidence < 0.60, `Confidence is low/uncertain: ${(unknownDiag.confidence * 100).toFixed(1)}%`);
  assert(unknownDiag.safetyGate.actionBlocked === true, 'Safety Gate actionBlocked = true');
  assert(unknownDiag.safetyGate.safeToRecommend === false, 'Safety Gate safeToRecommend = false');
  assert(unknownDiag.safetyGate.bannerType === 'unknown', 'Banner type is unknown');
  assert(unknownDiag.safetyGate.statusLabel.includes('DO NOT ACT') || unknownDiag.safetyGate.directive.includes('DO NOT ACT'), 'DO NOT ACT directive displayed');
  assert(unknownDiag.probable_fault.includes('Unknown') || unknownDiag.probable_fault.includes('Unclassified'), 'Probable fault indicates Unknown');

  // -------------------------------------------------------------
  // TEST 5: Sensor Reliability Drop Gating
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Degraded Sensor Signal Reliability ---');
  // Inject bad telemetry with missing / out of range sensor
  const noisyTelemetry = {
    ...confPumpRun.telemetryVector,
    pump_vibration: null, // missing
    reactor_pressure: 999.0 // impossible physical spike
  };
  const noisyDiag = diagnoseProcessState({
    telemetry: noisyTelemetry,
    mlAnomaly: true,
    mlScore: 0.85,
    mlClass: 'pump_fault',
    mlConfidence: 0.88,
    faultMode: 'pump_fault',
    faultSeverity: 1.0,
    faultTicks: 20
  });
  assert(noisyDiag.sensorReliability.score < 75, `Sensor reliability drops below threshold (got ${noisyDiag.sensorReliability.score}%)`);
  assert(noisyDiag.safetyGate.safeToRecommend === false || noisyDiag.safetyGate.gateState === 'SENSOR_DEGRADED' || noisyDiag.safetyGate.actionBlocked === true, 'Safety gate blocks recommendation on sensor unreliability');

  // -------------------------------------------------------------
  // TEST 6: Grounded Copilot Intelligence
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Grounded Copilot Q&A ---');
  
  // Q1: Why did AI detect this fault?
  const liveStateConf = {
    equipment: {
      pump: { data: confPumpRun.telemetryVector },
      heat_exchanger: { data: confPumpRun.telemetryVector },
      reactor: { data: confPumpRun.telemetryVector },
      distillation: { data: confPumpRun.telemetryVector }
    },
    diagnosis: confPumpDiag,
    activeFault: 'pump_fault'
  };
  const copilotQ1 = answerProcessQuestion({ message: 'Why did AI detect this fault?', liveState: liveStateConf });
  assert(copilotQ1.answer.includes('XAI') || copilotQ1.answer.includes('contribution') || copilotQ1.answer.includes('vibration') || copilotQ1.answer.includes('Pump'), 'Copilot explains XAI root cause');

  // Q2: What will happen next?
  const liveStateEarly = {
    equipment: {
      pump: { data: earlyPumpRun.telemetryVector },
      heat_exchanger: { data: earlyPumpRun.telemetryVector },
      reactor: { data: earlyPumpRun.telemetryVector },
      distillation: { data: earlyPumpRun.telemetryVector }
    },
    diagnosis: earlyPumpDiag,
    activeFault: 'early_pump_degradation'
  };
  const copilotQ2 = answerProcessQuestion({ message: 'What will happen next?', liveState: liveStateEarly });
  assert(copilotQ2.answer.includes('Prognosis') || copilotQ2.answer.includes('progression') || copilotQ2.answer.includes('estimate') || copilotQ2.answer.includes('Stage'), 'Copilot provides prognosis progression trajectory');

  // Q3: Why is recommendation blocked for unknown fault?
  const liveStateUnknown = {
    equipment: {
      pump: { data: unknownRun.telemetryVector },
      heat_exchanger: { data: unknownRun.telemetryVector },
      reactor: { data: unknownRun.telemetryVector },
      distillation: { data: unknownRun.telemetryVector }
    },
    diagnosis: unknownDiag,
    activeFault: 'unknown_fault'
  };
  const copilotQ3 = answerProcessQuestion({ message: 'Why is recommendation blocked?', liveState: liveStateUnknown });
  assert(copilotQ3.answer.includes('Safety Gate') || copilotQ3.answer.includes('UNKNOWN') || copilotQ3.answer.includes('DO NOT ACT') || copilotQ3.answer.includes('blocked'), 'Copilot explains safety gate blockage for unknown fault');

  // Q4: What is the preventive risk score?
  const copilotQ4 = answerProcessQuestion({ message: 'What is the preventive risk score?', liveState: liveStateEarly });
  assert(copilotQ4.answer.includes('/ 100') || copilotQ4.answer.includes('Risk Score') || copilotQ4.answer.includes('Risk:'), 'Copilot returns grounded preventive risk score');

  // -------------------------------------------------------------
  // TEST 7: Human-in-the-Loop Operator Authorization
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Human-in-the-Loop Operator Authorization ---');
  const approvalRes = await recordOperatorApproval({
    equipment: 'P-101',
    fault: 'pump_fault',
    riskScore: 82,
    recommendedMeasure: 'Switch P-101 to standby unit P-101B and inspect bearing',
    decision: 'APPROVED',
    note: 'Operator verified local telemetry on Aspen PFD.'
  });
  assert(approvalRes.id !== undefined, 'Operator approval saved to SQLite database');
  const recentApprovals = await getRecentOperatorApprovals(5);
  assert(recentApprovals.length > 0 && recentApprovals[0].equipment === 'P-101', 'Operator approval record retrievable from database');

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedCount} / ${totalCount} PASSED (${Math.round((passedCount / totalCount) * 100)}%)`);
  console.log('================================================================\n');

  if (passedCount === totalCount) {
    console.log('🏆 ALL ACCEPTANCE CRITERIA MET WITH 100% PASS RATE!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
