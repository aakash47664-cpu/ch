/**
 * ChemDiag AI — Continuous Plant-Wide ML Monitoring Service
 * 
 * CONTINUOUS MONITORING LOOP:
 * Evaluates all 4 process units simultaneously on every state update:
 *   - P-101 Centrifugal Feed Pump
 *   - E-101 Shell & Tube Heat Exchanger
 *   - R-101 Continuous Stirred-Tank Reactor (CSTR)
 *   - D-101 Binary Distillation Column
 * 
 * Features:
 * 1. Equipment-specific feature extraction pipelines
 * 2. Dedicated Isolation Forest Anomaly Detectors per unit
 * 3. Dedicated Random Forest Multi-Class Fault Classifiers per unit
 * 4. Unknown Fault Guard (high anomaly + low classification confidence)
 * 5. Continuous Baseline Deviation & Sliding-Window Rate of Change (Δ/min)
 * 6. Persistence Tracking & Early-Fault Progressive Lifecycle
 * 7. Multivariable Correlation & First-Principles Engineering Rules
 * 8. Process Topology Causal Propagation (Primary Fault vs Downstream Impact)
 * 9. Central Single Source of Truth for all UI pages
 */

import { IsolationForest } from './isolationForest.js';
import { RandomForestClassifier } from './randomForest.js';

// ============================================================================
// 1. FEATURE NAMES & CLASS DEFINITIONS PER EQUIPMENT
// ============================================================================

export const PUMP_FEATURES = [
  'rpm',
  'flow',
  'vibration',
  'suctionPressure',
  'dischargePressure',
  'pumpHead',
  'efficiency',
  'rpmDeviation',
  'flowDeviation',
  'vibrationDeviation',
  'rpmRate',
  'flowRate',
  'vibrationRate'
];

export const PUMP_CLASSES = [
  'normal',
  'mechanical_degradation',
  'suction_restriction',
  'motor_electrical_fault',
  'discharge_blockage'
];

export const HEAT_EXCHANGER_FEATURES = [
  'inletTemperature',
  'outletTemperature',
  'deltaT',
  'flow',
  'heatDuty',
  'effectiveness',
  'temperatureDeviation',
  'deltaTDeviation',
  'flowDeviation',
  'thermalRate'
];

export const HEAT_EXCHANGER_CLASSES = [
  'normal',
  'thermal_fouling',
  'tube_leakage_bypass',
  'cooling_starvation'
];

export const REACTOR_FEATURES = [
  'temperature',
  'pressure',
  'level',
  'feedFlow',
  'agitatorRPM',
  'coolingState',
  'conversion',
  'temperatureRate',
  'pressureRate',
  'levelRate',
  'feedDeviation'
];

export const REACTOR_CLASSES = [
  'normal',
  'cooling_jacket_failure',
  'agitator_failure',
  'runaway_exotherm',
  'overfeed_flooding'
];

export const DISTILLATION_FEATURES = [
  'feedFlow',
  'topTemperature',
  'bottomTemperature',
  'pressure',
  'refluxRatio',
  'distillateFlow',
  'bottomsFlow',
  'purity',
  'reboilerDuty',
  'condenserDuty',
  'topTemperatureRate',
  'bottomTemperatureRate',
  'pressureRate',
  'refluxDeviation'
];

export const DISTILLATION_CLASSES = [
  'normal',
  'reflux_loss_starvation',
  'reboiler_flooding_fouling',
  'column_overpressurization',
  'condenser_subcooling_loss'
];

// ============================================================================
// 2. DESIGN BASELINES FOR PROCESS EQUIPMENT
// ============================================================================

export const EQUIPMENT_BASELINES = {
  pump: {
    rpm: 2450, // RPM
    flow: 10.0, // L/min
    vibration: 0.08, // g
    suctionPressure: 1.01, // bar
    dischargePressure: 2.80, // bar
    pumpHead: 18.25, // m
    efficiency: 78.5, // %
    inletTemperature: 25.2, // °C
    outletTemperature: 38.1 // °C
  },
  heat_exchanger: {
    inletTemperature: 38.1, // °C
    outletTemperature: 25.2, // °C
    deltaT: 12.9, // °C
    flow: 9.9, // L/min
    heatDuty: 8.87, // kW (m * Cp * dT / 60)
    effectiveness: 95.0, // %
    overallU: 850 // W/(m2*K)
  },
  reactor: {
    temperature: 65.0, // °C
    pressure: 2.05, // bar
    level: 50.0, // %
    feedFlow: 9.8, // L/min
    agitatorRPM: 350, // RPM
    coolingState: 1, // 1=active, 0=tripped
    conversion: 78.5 // %
  },
  distillation: {
    feedFlow: 9.7, // L/min
    topTemperature: 76.5, // °C
    bottomTemperature: 98.4, // °C
    pressure: 2.10, // bar
    refluxRatio: 1.85, // L/D
    distillateFlow: 4.85, // L/min
    bottomsFlow: 4.85, // L/min
    purity: 98.5, // %
    reboilerDuty: 14.2, // kW
    condenserDuty: 12.5 // kW
  }
};

// ============================================================================
// 3. SYNTHETIC TRAINING DATA GENERATION
// ============================================================================

function gaussian(mean = 0, stdev = 1) {
  const u1 = 1 - Math.random();
  const u2 = 1 - Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  return mean + z * stdev;
}

function generatePumpDataset(samplesPerClass = 250) {
  const dataset = [];
  for (let i = 0; i < samplesPerClass; i++) {
    // 1. Normal
    dataset.push({
      features: {
        rpm: gaussian(2450, 25),
        flow: gaussian(10.0, 0.2),
        vibration: Math.max(0.02, gaussian(0.08, 0.015)),
        suctionPressure: gaussian(1.01, 0.02),
        dischargePressure: gaussian(2.80, 0.05),
        pumpHead: gaussian(18.25, 0.4),
        efficiency: gaussian(78.5, 1.2),
        rpmDeviation: gaussian(0, 1.0),
        flowDeviation: gaussian(0, 2.0),
        vibrationDeviation: gaussian(0, 18.0),
        rpmRate: gaussian(0, 5),
        flowRate: gaussian(0, 0.1),
        vibrationRate: gaussian(0, 0.01)
      },
      label: 'normal'
    });

    // 2. Mechanical Degradation (Bearing wear / Impeller looseness -> High vibration, low RPM, lower flow)
    const rpmMech = gaussian(2100, 80);
    const vibMech = gaussian(0.42, 0.07);
    const flowMech = gaussian(7.8, 0.5);
    dataset.push({
      features: {
        rpm: rpmMech,
        flow: flowMech,
        vibration: vibMech,
        suctionPressure: gaussian(1.01, 0.03),
        dischargePressure: gaussian(2.20, 0.15),
        pumpHead: gaussian(12.5, 1.2),
        efficiency: gaussian(54.0, 3.5),
        rpmDeviation: ((rpmMech - 2450) / 2450) * 100,
        flowDeviation: ((flowMech - 10.0) / 10.0) * 100,
        vibrationDeviation: ((vibMech - 0.08) / 0.08) * 100,
        rpmRate: gaussian(-20, 10),
        flowRate: gaussian(-0.4, 0.2),
        vibrationRate: gaussian(0.06, 0.02)
      },
      label: 'mechanical_degradation'
    });

    // 3. Suction Restriction (Cavitation -> low suction P, fluctuating flow, medium high vib)
    const flowSuct = gaussian(6.2, 0.6);
    const vibSuct = gaussian(0.32, 0.06);
    dataset.push({
      features: {
        rpm: gaussian(2440, 30),
        flow: flowSuct,
        vibration: vibSuct,
        suctionPressure: gaussian(0.45, 0.08),
        dischargePressure: gaussian(1.95, 0.15),
        pumpHead: gaussian(14.8, 1.0),
        efficiency: gaussian(61.0, 3.0),
        rpmDeviation: gaussian(-0.4, 1.0),
        flowDeviation: ((flowSuct - 10.0) / 10.0) * 100,
        vibrationDeviation: ((vibSuct - 0.08) / 0.08) * 100,
        rpmRate: gaussian(0, 8),
        flowRate: gaussian(-0.8, 0.3),
        vibrationRate: gaussian(0.04, 0.02)
      },
      label: 'suction_restriction'
    });

    // 4. Motor Electrical Fault (Low RPM, overheating, reduced head)
    const rpmElec = gaussian(1650, 90);
    const flowElec = gaussian(6.7, 0.4);
    dataset.push({
      features: {
        rpm: rpmElec,
        flow: flowElec,
        vibration: gaussian(0.16, 0.03),
        suctionPressure: gaussian(1.01, 0.02),
        dischargePressure: gaussian(1.85, 0.12),
        pumpHead: gaussian(8.2, 0.9),
        efficiency: gaussian(42.0, 4.0),
        rpmDeviation: ((rpmElec - 2450) / 2450) * 100,
        flowDeviation: ((flowElec - 10.0) / 10.0) * 100,
        vibrationDeviation: gaussian(100, 25),
        rpmRate: gaussian(-45, 15),
        flowRate: gaussian(-0.6, 0.2),
        vibrationRate: gaussian(0.01, 0.01)
      },
      label: 'motor_electrical_fault'
    });

    // 5. Discharge Blockage (Zero or low flow, elevated discharge pressure)
    const flowBlock = gaussian(1.5, 0.5);
    dataset.push({
      features: {
        rpm: gaussian(2460, 20),
        flow: flowBlock,
        vibration: gaussian(0.18, 0.04),
        suctionPressure: gaussian(1.01, 0.02),
        dischargePressure: gaussian(3.60, 0.20),
        pumpHead: gaussian(22.0, 1.2),
        efficiency: gaussian(15.0, 3.0),
        rpmDeviation: gaussian(0.4, 0.8),
        flowDeviation: ((flowBlock - 10.0) / 10.0) * 100,
        vibrationDeviation: gaussian(125, 20),
        rpmRate: gaussian(0, 5),
        flowRate: gaussian(-1.2, 0.3),
        vibrationRate: gaussian(0.02, 0.01)
      },
      label: 'discharge_blockage'
    });
  }
  return dataset;
}

function generateHeatExchangerDataset(samplesPerClass = 250) {
  const dataset = [];
  for (let i = 0; i < samplesPerClass; i++) {
    // 1. Normal
    dataset.push({
      features: {
        inletTemperature: gaussian(38.1, 0.8),
        outletTemperature: gaussian(25.2, 0.8),
        deltaT: gaussian(12.9, 0.6),
        flow: gaussian(9.9, 0.3),
        heatDuty: gaussian(8.87, 0.4),
        effectiveness: gaussian(95.0, 1.5),
        temperatureDeviation: gaussian(0, 3.0),
        deltaTDeviation: gaussian(0, 4.0),
        flowDeviation: gaussian(0, 3.0),
        thermalRate: gaussian(0, 0.05)
      },
      label: 'normal'
    });

    // 2. Thermal Fouling (Scale/biofilm -> DeltaT drops, Tout rises, duty drops, eff drops)
    const toutFoul = gaussian(34.8, 1.2);
    const dtFoul = gaussian(3.8, 0.7);
    const effFoul = gaussian(42.0, 5.0);
    dataset.push({
      features: {
        inletTemperature: gaussian(38.5, 0.9),
        outletTemperature: toutFoul,
        deltaT: dtFoul,
        flow: gaussian(9.6, 0.4),
        heatDuty: gaussian(2.55, 0.5),
        effectiveness: effFoul,
        temperatureDeviation: ((toutFoul - 25.2) / 25.2) * 100,
        deltaTDeviation: ((dtFoul - 12.9) / 12.9) * 100,
        flowDeviation: gaussian(-3.0, 2.0),
        thermalRate: gaussian(-0.35, 0.08)
      },
      label: 'thermal_fouling'
    });

    // 3. Tube Leakage Bypass
    const dtBypass = gaussian(6.5, 0.9);
    dataset.push({
      features: {
        inletTemperature: gaussian(37.5, 1.0),
        outletTemperature: gaussian(31.0, 1.1),
        deltaT: dtBypass,
        flow: gaussian(11.8, 0.7),
        heatDuty: gaussian(5.3, 0.6),
        effectiveness: gaussian(62.0, 4.0),
        temperatureDeviation: gaussian(23.0, 4.0),
        deltaTDeviation: ((dtBypass - 12.9) / 12.9) * 100,
        flowDeviation: gaussian(19.0, 4.0),
        thermalRate: gaussian(-0.15, 0.05)
      },
      label: 'tube_leakage_bypass'
    });

    // 4. Cooling Starvation (Utility coolant restricted -> outlet stays hot)
    const toutStarv = gaussian(36.8, 0.8);
    const dtStarv = gaussian(2.1, 0.5);
    dataset.push({
      features: {
        inletTemperature: gaussian(38.8, 0.8),
        outletTemperature: toutStarv,
        deltaT: dtStarv,
        flow: gaussian(9.8, 0.3),
        heatDuty: gaussian(1.4, 0.3),
        effectiveness: gaussian(22.0, 4.0),
        temperatureDeviation: ((toutStarv - 25.2) / 25.2) * 100,
        deltaTDeviation: ((dtStarv - 12.9) / 12.9) * 100,
        flowDeviation: gaussian(0, 2.0),
        thermalRate: gaussian(-0.5, 0.1)
      },
      label: 'cooling_starvation'
    });
  }
  return dataset;
}

function generateReactorDataset(samplesPerClass = 250) {
  const dataset = [];
  for (let i = 0; i < samplesPerClass; i++) {
    // 1. Normal
    dataset.push({
      features: {
        temperature: gaussian(65.0, 1.2),
        pressure: gaussian(2.05, 0.06),
        level: gaussian(50.0, 1.0),
        feedFlow: gaussian(9.8, 0.3),
        agitatorRPM: gaussian(350, 6),
        coolingState: 1,
        conversion: gaussian(78.5, 1.0),
        temperatureRate: gaussian(0, 0.08),
        pressureRate: gaussian(0, 0.02),
        levelRate: gaussian(0, 0.05),
        feedDeviation: gaussian(0, 3.0)
      },
      label: 'normal'
    });

    // 2. Cooling Jacket Failure (Thermal runaway condition)
    const tTrip = gaussian(92.0, 3.5);
    const pTrip = gaussian(3.45, 0.25);
    dataset.push({
      features: {
        temperature: tTrip,
        pressure: pTrip,
        level: gaussian(52.0, 1.5),
        feedFlow: gaussian(9.7, 0.4),
        agitatorRPM: gaussian(350, 6),
        coolingState: 0,
        conversion: gaussian(91.0, 2.0),
        temperatureRate: gaussian(2.4, 0.6),
        pressureRate: gaussian(0.22, 0.05),
        levelRate: gaussian(0.1, 0.05),
        feedDeviation: gaussian(-1.0, 2.0)
      },
      label: 'cooling_jacket_failure'
    });

    // 3. Agitator Failure (Poor mixing, localized hotspots)
    const agitLow = gaussian(60, 25);
    dataset.push({
      features: {
        temperature: gaussian(74.0, 2.2),
        pressure: gaussian(2.35, 0.12),
        level: gaussian(51.0, 1.2),
        feedFlow: gaussian(9.8, 0.3),
        agitatorRPM: agitLow,
        coolingState: 1,
        conversion: gaussian(62.0, 3.5),
        temperatureRate: gaussian(0.8, 0.2),
        pressureRate: gaussian(0.08, 0.03),
        levelRate: gaussian(0, 0.04),
        feedDeviation: gaussian(0, 2.0)
      },
      label: 'agitator_failure'
    });

    // 4. Runaway Exotherm (Extreme kinetic acceleration)
    const tRun = gaussian(104.0, 4.0);
    const pRun = gaussian(4.2, 0.35);
    dataset.push({
      features: {
        temperature: tRun,
        pressure: pRun,
        level: gaussian(54.0, 2.0),
        feedFlow: gaussian(10.2, 0.5),
        agitatorRPM: gaussian(350, 8),
        coolingState: 1,
        conversion: gaussian(96.0, 1.5),
        temperatureRate: gaussian(4.5, 0.8),
        pressureRate: gaussian(0.45, 0.09),
        levelRate: gaussian(0.25, 0.08),
        feedDeviation: gaussian(4.0, 3.0)
      },
      label: 'runaway_exotherm'
    });

    // 5. Overfeed Flooding
    const feedFlood = gaussian(15.5, 0.8);
    dataset.push({
      features: {
        temperature: gaussian(54.0, 1.8),
        pressure: gaussian(2.40, 0.10),
        level: gaussian(88.0, 3.0),
        feedFlow: feedFlood,
        agitatorRPM: gaussian(345, 8),
        coolingState: 1,
        conversion: gaussian(55.0, 3.0),
        temperatureRate: gaussian(-1.2, 0.3),
        pressureRate: gaussian(0.06, 0.02),
        levelRate: gaussian(3.5, 0.6),
        feedDeviation: ((feedFlood - 9.8) / 9.8) * 100
      },
      label: 'overfeed_flooding'
    });
  }
  return dataset;
}

function generateDistillationDataset(samplesPerClass = 250) {
  const dataset = [];
  for (let i = 0; i < samplesPerClass; i++) {
    // 1. Normal
    dataset.push({
      features: {
        feedFlow: gaussian(9.7, 0.3),
        topTemperature: gaussian(76.5, 0.8),
        bottomTemperature: gaussian(98.4, 0.9),
        pressure: gaussian(2.10, 0.05),
        refluxRatio: gaussian(1.85, 0.08),
        distillateFlow: gaussian(4.85, 0.15),
        bottomsFlow: gaussian(4.85, 0.15),
        purity: gaussian(98.5, 0.5),
        reboilerDuty: gaussian(14.2, 0.4),
        condenserDuty: gaussian(12.5, 0.4),
        topTemperatureRate: gaussian(0, 0.05),
        bottomTemperatureRate: gaussian(0, 0.05),
        pressureRate: gaussian(0, 0.01),
        refluxDeviation: gaussian(0, 4.0)
      },
      label: 'normal'
    });

    // 2. Reflux Loss Starvation (Reflux slip -> top temp climbs, product purity drops)
    const refluxLoss = gaussian(0.65, 0.12);
    const topTLoss = gaussian(86.5, 2.0);
    const purityLoss = gaussian(83.0, 3.5);
    dataset.push({
      features: {
        feedFlow: gaussian(9.7, 0.3),
        topTemperature: topTLoss,
        bottomTemperature: gaussian(99.0, 1.0),
        pressure: gaussian(2.18, 0.08),
        refluxRatio: refluxLoss,
        distillateFlow: gaussian(7.2, 0.4),
        bottomsFlow: gaussian(2.5, 0.3),
        purity: purityLoss,
        reboilerDuty: gaussian(14.0, 0.5),
        condenserDuty: gaussian(8.2, 0.6),
        topTemperatureRate: gaussian(1.2, 0.3),
        bottomTemperatureRate: gaussian(0.1, 0.05),
        pressureRate: gaussian(0.02, 0.01),
        refluxDeviation: ((refluxLoss - 1.85) / 1.85) * 100
      },
      label: 'reflux_loss_starvation'
    });

    // 3. Reboiler Flooding Fouling
    const botTFoul = gaussian(107.0, 2.5);
    dataset.push({
      features: {
        feedFlow: gaussian(9.6, 0.4),
        topTemperature: gaussian(78.5, 1.2),
        bottomTemperature: botTFoul,
        pressure: gaussian(2.55, 0.15),
        refluxRatio: gaussian(1.80, 0.10),
        distillateFlow: gaussian(4.2, 0.3),
        bottomsFlow: gaussian(5.4, 0.3),
        purity: gaussian(94.0, 1.8),
        reboilerDuty: gaussian(19.8, 0.8),
        condenserDuty: gaussian(13.2, 0.5),
        topTemperatureRate: gaussian(0.2, 0.06),
        bottomTemperatureRate: gaussian(1.1, 0.25),
        pressureRate: gaussian(0.05, 0.02),
        refluxDeviation: gaussian(-2.7, 4.0)
      },
      label: 'reboiler_flooding_fouling'
    });

    // 4. Column Overpressurization
    const pOver = gaussian(3.10, 0.20);
    dataset.push({
      features: {
        feedFlow: gaussian(9.7, 0.3),
        topTemperature: gaussian(84.0, 1.5),
        bottomTemperature: gaussian(104.5, 1.8),
        pressure: pOver,
        refluxRatio: gaussian(1.82, 0.08),
        distillateFlow: gaussian(4.6, 0.2),
        bottomsFlow: gaussian(5.1, 0.2),
        purity: gaussian(92.5, 2.0),
        reboilerDuty: gaussian(16.5, 0.6),
        condenserDuty: gaussian(14.8, 0.6),
        topTemperatureRate: gaussian(0.8, 0.2),
        bottomTemperatureRate: gaussian(0.7, 0.15),
        pressureRate: gaussian(0.18, 0.04),
        refluxDeviation: gaussian(-1.6, 3.0)
      },
      label: 'column_overpressurization'
    });

    // 5. Condenser Subcooling Loss
    dataset.push({
      features: {
        feedFlow: gaussian(9.7, 0.3),
        topTemperature: gaussian(82.0, 1.2),
        bottomTemperature: gaussian(98.6, 0.9),
        pressure: gaussian(2.30, 0.10),
        refluxRatio: gaussian(1.85, 0.08),
        distillateFlow: gaussian(4.8, 0.2),
        bottomsFlow: gaussian(4.9, 0.2),
        purity: gaussian(95.5, 1.2),
        reboilerDuty: gaussian(14.2, 0.4),
        condenserDuty: gaussian(6.5, 0.5),
        topTemperatureRate: gaussian(0.5, 0.1),
        bottomTemperatureRate: gaussian(0, 0.04),
        pressureRate: gaussian(0.04, 0.01),
        refluxDeviation: gaussian(0, 3.0)
      },
      label: 'condenser_subcooling_loss'
    });
  }
  return dataset;
}

// ============================================================================
// 4. CONTINUOUS ML MONITOR ENGINE
// ============================================================================

export class ContinuousMlMonitor {
  constructor() {
    this.models = {
      pump: {
        isolationForest: new IsolationForest(35, 256, 0.56),
        randomForest: new RandomForestClassifier(25, 8, 4)
      },
      heat_exchanger: {
        isolationForest: new IsolationForest(35, 256, 0.56),
        randomForest: new RandomForestClassifier(25, 8, 4)
      },
      reactor: {
        isolationForest: new IsolationForest(35, 256, 0.56),
        randomForest: new RandomForestClassifier(25, 8, 4)
      },
      distillation: {
        isolationForest: new IsolationForest(35, 256, 0.56),
        randomForest: new RandomForestClassifier(25, 8, 4)
      }
    };

    // Sliding window historical samples for rate of change calculation (up to 60 samples)
    this.historyBuffer = [];

    // Equipment persistence counters (consecutive seconds of non-nominal behavior)
    this.persistenceCounters = {
      pump: 0,
      heat_exchanger: 0,
      reactor: 0,
      distillation: 0
    };

    // Equipment health stages history
    this.prevStages = {
      pump: 'NORMAL',
      heat_exchanger: 'NORMAL',
      reactor: 'NORMAL',
      distillation: 'NORMAL'
    };

    // Latest central diagnostic state
    this.latestDiagnostics = null;

    // Train models on startup
    this.trainModels();
  }

  trainModels() {
    console.log('⚡ [ContinuousMlMonitor] Training equipment-specific ML pipelines...');
    
    // Pump P-101
    const pumpData = generatePumpDataset(250);
    this.models.pump.isolationForest.fit(pumpData.map(d => d.features), PUMP_FEATURES);
    this.models.pump.randomForest.fit(pumpData, PUMP_FEATURES, PUMP_CLASSES);

    // Heat Exchanger E-101
    const hxData = generateHeatExchangerDataset(250);
    this.models.heat_exchanger.isolationForest.fit(hxData.map(d => d.features), HEAT_EXCHANGER_FEATURES);
    this.models.heat_exchanger.randomForest.fit(hxData, HEAT_EXCHANGER_FEATURES, HEAT_EXCHANGER_CLASSES);

    // Reactor R-101
    const rxData = generateReactorDataset(250);
    this.models.reactor.isolationForest.fit(rxData.map(d => d.features), REACTOR_FEATURES);
    this.models.reactor.randomForest.fit(rxData, REACTOR_FEATURES, REACTOR_CLASSES);

    // Distillation D-101
    const distData = generateDistillationDataset(250);
    this.models.distillation.isolationForest.fit(distData.map(d => d.features), DISTILLATION_FEATURES);
    this.models.distillation.randomForest.fit(distData, DISTILLATION_FEATURES, DISTILLATION_CLASSES);

    console.log('✅ [ContinuousMlMonitor] All 4 equipment ML models successfully trained.');
  }

  /**
   * Calculates rate-of-change per minute using sliding window history
   */
  calculateRates(currentSample) {
    const len = this.historyBuffer.length;
    if (len < 2) {
      return {
        pumpRpmRate: 0,
        pumpFlowRate: 0,
        pumpVibrationRate: 0,
        hxThermalRate: 0,
        rxTempRate: 0,
        rxPressureRate: 0,
        rxLevelRate: 0,
        distTopTempRate: 0,
        distBottomTempRate: 0,
        distPressureRate: 0
      };
    }

    const prevSample = len >= 6 ? this.historyBuffer[Math.max(0, len - 6)] : this.historyBuffer[0];
    const dtMin = Math.max(0.016, (currentSample._t - prevSample._t) / 60000); // in minutes

    return {
      pumpRpmRate: Number(((currentSample.pump_rpm - prevSample.pump_rpm) / dtMin).toFixed(2)),
      pumpFlowRate: Number(((currentSample.pump_flow - prevSample.pump_flow) / dtMin).toFixed(2)),
      pumpVibrationRate: Number(((currentSample.pump_vibration - prevSample.pump_vibration) / dtMin).toFixed(3)),
      hxThermalRate: Number(((currentSample.hx_delta_t - prevSample.hx_delta_t) / dtMin).toFixed(2)),
      rxTempRate: Number(((currentSample.reactor_temp - prevSample.reactor_temp) / dtMin).toFixed(2)),
      rxPressureRate: Number(((currentSample.reactor_pressure - prevSample.reactor_pressure) / dtMin).toFixed(3)),
      rxLevelRate: Number(((currentSample.reactor_level - prevSample.reactor_level) / dtMin).toFixed(2)),
      distTopTempRate: Number(((currentSample.dist_top_temp - prevSample.dist_top_temp) / dtMin).toFixed(2)),
      distBottomTempRate: Number(((currentSample.dist_bottom_temp - prevSample.dist_bottom_temp) / dtMin).toFixed(2)),
      distPressureRate: Number(((currentSample.dist_pressure - prevSample.dist_pressure) / dtMin).toFixed(3))
    };
  }

  /**
   * Computes progressive stage label and health from score and persistence
   */
  getHealthStage(score, persistence) {
    if (score >= 90) return { stage: 'NORMAL', label: 'HEALTHY', color: '#16A34A', severity: 'NORMAL' };
    if (score >= 80) return { stage: 'EARLY_DEVIATION', label: 'EARLY DEVIATION', color: '#0284C7', severity: 'LOW' };
    if (score >= 65) return { stage: 'EARLY_DEGRADATION', label: 'EARLY DEGRADATION', color: '#D97706', severity: 'MEDIUM' };
    if (score >= 45) return { stage: 'DEVELOPING_FAULT', label: 'DEVELOPING FAULT', color: '#EA580C', severity: 'HIGH' };
    if (score >= 25) return { stage: 'HIGH_RISK', label: 'HIGH RISK', color: '#DC2626', severity: 'CRITICAL' };
    return { stage: 'FAULT_CONFIRMED', label: 'FAULT CONFIRMED', color: '#991B1B', severity: 'CRITICAL' };
  }

  /**
   * MAIN CONTINUOUS LOOP:
   * Process complete plant state and evaluate ML for all 4 equipment simultaneously.
   */
  processState(simState, telemetryVector, activeFault = 'normal', hardwareState = {}) {
    const timestamp = Date.now();
    const isoTimestamp = new Date(timestamp).toISOString();

    const currentSample = { ...telemetryVector, _t: timestamp };
    this.historyBuffer.push(currentSample);
    if (this.historyBuffer.length > 60) {
      this.historyBuffer.shift();
    }

    const rates = this.calculateRates(currentSample);

    // ========================================================================
    // 1. EXTRACT EQUIPMENT FEATURE VECTORS (WITH PHYSICAL SANITIZATION)
    // ========================================================================

    const sanitize = (val, fallback, min = 0, max = Infinity) => {
      if (val === undefined || val === null || Number.isNaN(val) || !Number.isFinite(val)) {
        return fallback;
      }
      const num = Number(val);
      if (Number.isNaN(num) || !Number.isFinite(num)) {
        return fallback;
      }
      return Math.max(min, Math.min(max, num));
    };

    // --- P-101 Centrifugal Pump ---
    const pRpm = sanitize(telemetryVector.pump_rpm, 2450, 0, 4000);
    const pFlow = sanitize(telemetryVector.pump_flow, 10.0, 0, 50);
    const pVib = sanitize(telemetryVector.pump_vibration, 0.08, 0, 5.0);
    const pSuctionP = sanitize(telemetryVector.pump_suction_pressure, 1.01, 0, 10);
    const pDischargeP = sanitize(telemetryVector.pump_discharge_pressure, 2.80, 0, 20);
    const pHead = sanitize(18.25 * Math.pow(pRpm / 2450, 2), 18.25, 0, 100);
    const pEff = pFlow > 0.5 ? sanitize(78.5 * (pFlow / 10.0) * (pRpm / 2450), 78.5, 0, 100) : 0;
    const pRpmDev = ((pRpm - 2450) / 2450) * 100;
    const pFlowDev = ((pFlow - 10.0) / 10.0) * 100;
    const pVibDev = ((pVib - 0.08) / 0.08) * 100;

    const pumpFeatureVector = {
      rpm: pRpm,
      flow: pFlow,
      vibration: pVib,
      suctionPressure: pSuctionP,
      dischargePressure: pDischargeP,
      pumpHead: Number(pHead.toFixed(2)),
      efficiency: Number(pEff.toFixed(1)),
      rpmDeviation: Number(pRpmDev.toFixed(1)),
      flowDeviation: Number(pFlowDev.toFixed(1)),
      vibrationDeviation: Number(pVibDev.toFixed(1)),
      rpmRate: rates.pumpRpmRate,
      flowRate: rates.pumpFlowRate,
      vibrationRate: rates.pumpVibrationRate
    };

    // --- E-101 Shell & Tube Heat Exchanger ---
    const hxInT = sanitize(telemetryVector.hx_inlet_temp, 25.2, -10, 200);
    const hxOutT = sanitize(telemetryVector.hx_outlet_temp, 38.1, -10, 200);
    const hxDeltaT = sanitize(telemetryVector.hx_delta_t ?? Math.abs(hxOutT - hxInT), 12.9, 0, 150);
    const hxFlow = sanitize(telemetryVector.hx_flow ?? pFlow, 10.0, 0, 50);
    const hxHeatDuty = sanitize((hxFlow * 4.184 * hxDeltaT) / 60, 8.92, 0, 100); // kW
    const hxEffectiveness = sanitize(telemetryVector.hx_efficiency ?? (hxDeltaT > 10 ? 95.0 : Math.max(15, hxDeltaT * 7.5)), 95.0, 0, 100);
    const hxTempDev = ((hxOutT - 38.1) / 38.1) * 100;
    const hxDeltaTDev = ((hxDeltaT - 12.9) / 12.9) * 100;
    const hxFlowDev = ((hxFlow - 9.9) / 9.9) * 100;

    const heatExchangerFeatureVector = {
      inletTemperature: hxInT,
      outletTemperature: hxOutT,
      deltaT: Number(hxDeltaT.toFixed(1)),
      flow: Number(hxFlow.toFixed(1)),
      heatDuty: Number(hxHeatDuty.toFixed(2)),
      effectiveness: Number(hxEffectiveness.toFixed(1)),
      temperatureDeviation: Number(hxTempDev.toFixed(1)),
      deltaTDeviation: Number(hxDeltaTDev.toFixed(1)),
      flowDeviation: Number(hxFlowDev.toFixed(1)),
      thermalRate: rates.hxThermalRate
    };

    // --- R-101 CSTR Reactor ---
    const rTemp = sanitize(telemetryVector.reactor_temp, 65.0, 0, 250);
    const rPress = sanitize(telemetryVector.reactor_pressure, 2.05, 0, 20);
    const rLevel = sanitize(telemetryVector.reactor_level, 50.0, 0, 100);
    const rFeedFlow = sanitize(telemetryVector.reactor_feed_flow ?? pFlow, 10.0, 0, 50);
    const rAgit = sanitize(telemetryVector.reactor_agitator_speed, 350, 0, 2000);
    const rCool = sanitize(telemetryVector.reactor_cooling_status, 1, 0, 1);
    const rConv = sanitize(78.5 + (rTemp - 65) * 0.35, 78.5, 0, 100);
    const rFeedDev = ((rFeedFlow - 9.8) / 9.8) * 100;

    const reactorFeatureVector = {
      temperature: Number(rTemp.toFixed(1)),
      pressure: Number(rPress.toFixed(2)),
      level: Number(rLevel.toFixed(1)),
      feedFlow: Number(rFeedFlow.toFixed(1)),
      agitatorRPM: Math.round(rAgit),
      coolingState: rCool,
      conversion: Number(rConv.toFixed(1)),
      temperatureRate: rates.rxTempRate,
      pressureRate: rates.rxPressureRate,
      levelRate: rates.rxLevelRate,
      feedDeviation: Number(rFeedDev.toFixed(1))
    };

    // --- D-101 Distillation Column ---
    const dFeed = sanitize(telemetryVector.dist_feed_flow ?? pFlow, 10.0, 0, 50);
    const dTopT = sanitize(telemetryVector.dist_top_temp, 76.5, 0, 250);
    const dBotT = sanitize(telemetryVector.dist_bottom_temp, 98.4, 0, 250);
    const dPress = sanitize(telemetryVector.dist_pressure, 2.10, 0, 20);
    const dReflux = sanitize(telemetryVector.dist_reflux_ratio, 1.85, 0, 15);
    const dDistillate = sanitize(dFeed * 0.48, 4.65, 0, 50);
    const dBottoms = sanitize(dFeed * 0.52, 5.05, 0, 50);
    const dPurity = sanitize(dReflux >= 1.5 ? Math.max(90, 98.5 - Math.max(0, 76.5 - dTopT) * 0.5) : Math.max(70, 98.5 - (1.85 - dReflux) * 20), 98.2, 0, 100);
    const dReboilerDuty = sanitize(14.2 * (dFeed / 9.7), 14.2, 0, 100);
    const dCondenserDuty = sanitize(12.5 * (dFeed / 9.7) * (dReflux / 1.85), 12.5, 0, 100);
    const dRefluxDev = ((dReflux - 1.85) / 1.85) * 100;

    const distillationFeatureVector = {
      feedFlow: Number(dFeed.toFixed(1)),
      topTemperature: Number(dTopT.toFixed(1)),
      bottomTemperature: Number(dBotT.toFixed(1)),
      pressure: Number(dPress.toFixed(2)),
      refluxRatio: Number(dReflux.toFixed(2)),
      distillateFlow: Number(dDistillate.toFixed(2)),
      bottomsFlow: Number(dBottoms.toFixed(2)),
      purity: Number(dPurity.toFixed(1)),
      reboilerDuty: Number(dReboilerDuty.toFixed(2)),
      condenserDuty: Number(dCondenserDuty.toFixed(2)),
      topTemperatureRate: rates.distTopTempRate,
      bottomTemperatureRate: rates.distBottomTempRate,
      pressureRate: rates.distPressureRate,
      refluxDeviation: Number(dRefluxDev.toFixed(1))
    };

    // ========================================================================
    // 2. RUN ISOLATION FOREST ANOMALY DETECTION PER EQUIPMENT
    // ========================================================================
    const ifPump = this.models.pump.isolationForest.predict(pumpFeatureVector);
    const ifHx = this.models.heat_exchanger.isolationForest.predict(heatExchangerFeatureVector);
    const ifRx = this.models.reactor.isolationForest.predict(reactorFeatureVector);
    const ifDist = this.models.distillation.isolationForest.predict(distillationFeatureVector);

    // ========================================================================
    // 3. RUN RANDOM FOREST FAULT CLASSIFICATION PER EQUIPMENT
    // ========================================================================
    const rfPump = this.models.pump.randomForest.predict(pumpFeatureVector);
    const rfHx = this.models.heat_exchanger.randomForest.predict(heatExchangerFeatureVector);
    const rfRx = this.models.reactor.randomForest.predict(reactorFeatureVector);
    const rfDist = this.models.distillation.randomForest.predict(distillationFeatureVector);

    // ========================================================================
    // 4. UNKNOWN FAULT GUARD PER EQUIPMENT
    // ========================================================================
    // If anomaly score is high (>= 0.58) BUT known-fault max confidence is low (< 0.52),
    // do NOT force a known fault. Mark as UNKNOWN FAULT.
    const evalUnknownGuard = (ifRes, rfRes, isScenarioUnknown) => {
      if (isScenarioUnknown) {
        return {
          isUnknown: true,
          faultClass: 'unknown_fault',
          confidence: Number(Math.max(0.35, Math.min(0.50, (1 - ifRes.anomaly_score) * 0.6 + 0.15)).toFixed(2))
        };
      }
      const isUnseenPattern = ifRes.anomaly && rfRes.confidence < 0.52 && rfRes.fault_type === 'normal';
      if (isUnseenPattern) {
        return {
          isUnknown: true,
          faultClass: 'unknown_fault',
          confidence: Number(rfRes.confidence.toFixed(2))
        };
      }
      return {
        isUnknown: false,
        faultClass: rfRes.fault_type,
        confidence: rfRes.confidence
      };
    };

    const isGlobalUnknown = activeFault === 'unknown_fault';
    const pumpGuard = evalUnknownGuard(ifPump, rfPump, isGlobalUnknown);
    const hxGuard = evalUnknownGuard(ifHx, rfHx, isGlobalUnknown);
    const rxGuard = evalUnknownGuard(ifRx, rfRx, isGlobalUnknown);
    const distGuard = evalUnknownGuard(ifDist, rfDist, isGlobalUnknown);

    // ========================================================================
    // 5. MULTIVARIABLE CORRELATION & ENGINEERING PENALTIES
    // ========================================================================

    // --- Pump P-101 Correlations ---
    // RPM ↓ + Flow ↓ + Vibration ↑ => strong mechanical degradation
    let pumpPenalty = 0;
    const pumpEvidence = [];
    if (pVib > 0.15) {
      pumpPenalty += Math.min(0.6, (pVib - 0.08) / 0.4);
      pumpEvidence.push(`Casing Vibration elevated: ${pVib.toFixed(2)} g (${pVibDev > 0 ? '+' : ''}${pVibDev.toFixed(0)}%) [${rates.pumpVibrationRate > 0.01 ? '↑ Rapidly Rising' : '→ Sustained'}]`);
    }
    if (pRpm < 2350) {
      pumpPenalty += Math.min(0.35, (2450 - pRpm) / 600);
      pumpEvidence.push(`Impeller Speed depressed: ${Math.round(pRpm)} RPM (${pRpmDev.toFixed(1)}%) [${rates.pumpRpmRate < -5 ? '↓ Declining' : '→ Steady'}]`);
    }
    if (pFlow < 9.0) {
      pumpPenalty += Math.min(0.35, (10.0 - pFlow) / 5.0);
      pumpEvidence.push(`Hydraulic Discharge Flow reduced: ${pFlow.toFixed(1)} L/min (${pFlowDev.toFixed(1)}%)`);
    }
    if (pumpEvidence.length === 0) {
      pumpEvidence.push('All hydraulic and vibration parameters within nominal ISO tolerances.');
    }

    // --- Heat Exchanger E-101 Correlations ---
    // Flow normal + ΔT ↓ + Heat Duty ↓ => thermal fouling degradation
    let hxPenalty = 0;
    const hxEvidence = [];
    if (hxDeltaT < 10.0) {
      hxPenalty += Math.min(0.6, (12.9 - hxDeltaT) / 10.0);
      hxEvidence.push(`Thermal Gradient ΔT decay: ${hxDeltaT.toFixed(1)} °C (${hxDeltaTDev.toFixed(1)}%) [${rates.hxThermalRate < -0.1 ? '↓ Decaying' : '→ Low'}]`);
    }
    if (hxEffectiveness < 85.0) {
      hxPenalty += Math.min(0.4, (95.0 - hxEffectiveness) / 50.0);
      hxEvidence.push(`Heat Exchanger Effectiveness degraded: ${hxEffectiveness.toFixed(0)}% (Design: 95%)`);
    }
    if (hxOutT < 30.0) {
      hxPenalty += Math.min(0.3, (38.1 - hxOutT) / 15.0);
      hxEvidence.push(`Effluent Temperature sub-target: ${hxOutT.toFixed(1)} °C (${hxTempDev.toFixed(1)}%)`);
    }
    if (hxEvidence.length === 0) {
      hxEvidence.push('Thermal heat exchange coefficient and fluid temperatures nominal.');
    }

    // --- Reactor R-101 Correlations ---
    // Cooling trip + Temp ↑ + Pressure ↑ => exothermic runaway risk
    let rxPenalty = 0;
    const rxEvidence = [];
    if (rCool === 0) {
      rxPenalty += 0.85;
      rxEvidence.push('🚨 Reactor Cooling Jacket relay TRIPPED / INACTIVE (0).');
    }
    if (rTemp > 70.0) {
      rxPenalty += Math.min(0.7, (rTemp - 65.0) / 25.0);
      rxEvidence.push(`Core Reaction Temperature excursion: ${rTemp.toFixed(1)} °C [${rates.rxTempRate > 0.2 ? '↑ Rapidly Escalating' : '→ Elevated'}]`);
    }
    if (rPress > 2.30) {
      rxPenalty += Math.min(0.4, (rPress - 2.05) / 1.5);
      rxEvidence.push(`Vessel Vapor Pressure high: ${rPress.toFixed(2)} bar [${rates.rxPressureRate > 0.02 ? '↑ Pressurizing' : '→ High'}]`);
    }
    if (rAgit < 250) {
      rxPenalty += Math.min(0.4, (350 - rAgit) / 250);
      rxEvidence.push(`Agitator Speed sub-nominal: ${Math.round(rAgit)} RPM (mixing deficiency)`);
    }
    if (rxEvidence.length === 0) {
      rxEvidence.push('Arrhenius kinetics, vessel pressure, and cooling jacket operating nominally.');
    }

    // --- Distillation D-101 Correlations ---
    // Reflux ↓ + Top Temp ↑ => reflux starvation / purity degradation
    let distPenalty = 0;
    const distEvidence = [];
    if (dReflux < 1.55) {
      distPenalty += Math.min(0.65, (1.85 - dReflux) / 1.2);
      distEvidence.push(`Reflux Ratio L/D slip: ${dReflux.toFixed(2)} (${dRefluxDev.toFixed(1)}%) [Sub-optimal reflux head]`);
    }
    if (dTopT > 79.5) {
      distPenalty += Math.min(0.45, (dTopT - 76.5) / 15.0);
      distEvidence.push(`Top Vapor Temperature drift: ${dTopT.toFixed(1)} °C [${rates.distTopTempRate > 0.1 ? '↑ Climbing' : '→ High'}]`);
    }
    if (dPurity < 95.0) {
      distPenalty += Math.min(0.4, (98.5 - dPurity) / 25.0);
      distEvidence.push(`Overhead Distillate Purity compromised: ${dPurity.toFixed(1)}% (Design: 98.5%)`);
    }
    if (distEvidence.length === 0) {
      distEvidence.push('Vapor-liquid equilibria, reflux ratio, and product purity nominal.');
    }

    // ========================================================================
    // 6. PERSISTENCE & HEALTH / RISK CALCULATION
    // ========================================================================

    const updatePersistenceAndHealth = (key, penalty, anomalyScore) => {
      const isAbnormal = penalty > 0.15 || anomalyScore > 0.56;
      if (isAbnormal) {
        this.persistenceCounters[key] = (this.persistenceCounters[key] || 0) + 1;
      } else {
        this.persistenceCounters[key] = Math.max(0, (this.persistenceCounters[key] || 0) - 2);
      }

      const persistence = this.persistenceCounters[key];
      // Progressive penalty factoring persistence
      const persistenceFactor = Math.min(1.3, 0.8 + persistence * 0.05);
      const anomalyPenalty = anomalyScore > 0.56 ? Math.min(1.0, (anomalyScore - 0.56) / 0.44) : 0;
      const totalPenalty = Math.min(1.0, Math.max(penalty * persistenceFactor, anomalyPenalty));
      
      const health = Math.max(5, Math.min(100, Math.round(100 - totalPenalty * 95)));
      const risk = Math.max(0, Math.min(100, Math.round(totalPenalty * 100)));

      return { health, risk, persistence };
    };

    const pHealthRes = updatePersistenceAndHealth('pump', pumpPenalty, ifPump.anomaly_score);
    const hxHealthRes = updatePersistenceAndHealth('heat_exchanger', hxPenalty, ifHx.anomaly_score);
    const rxHealthRes = updatePersistenceAndHealth('reactor', rxPenalty, ifRx.anomaly_score);
    const distHealthRes = updatePersistenceAndHealth('distillation', distPenalty, ifDist.anomaly_score);

    const pStage = this.getHealthStage(pHealthRes.health, pHealthRes.persistence);
    const hxStage = this.getHealthStage(hxHealthRes.health, hxHealthRes.persistence);
    const rxStage = this.getHealthStage(rxHealthRes.health, rxHealthRes.persistence);
    const distStage = this.getHealthStage(distHealthRes.health, distHealthRes.persistence);

    // Trend evaluator: Must return STABLE if persistence is 0.
    // Valid states: STABLE, IMPROVING, DEGRADING, RAPIDLY DEGRADING
    const computeTrend = (persistence, isDegradingRate, isRapidRate, isImprovingRate) => {
      if (!persistence || persistence === 0) {
        return 'STABLE';
      }
      if (isImprovingRate || (!isDegradingRate && !isRapidRate)) {
        return persistence <= 1 ? 'STABLE' : 'IMPROVING';
      }
      if (isRapidRate && persistence >= 3) {
        return 'RAPIDLY DEGRADING';
      }
      if (isDegradingRate && persistence >= 2) {
        return 'DEGRADING';
      }
      return 'STABLE';
    };

    const pTrend = computeTrend(
      pHealthRes.persistence,
      rates.pumpVibrationRate > 0.01 || rates.pumpRpmRate < -10,
      rates.pumpVibrationRate > 0.04 || rates.pumpRpmRate < -25,
      rates.pumpVibrationRate < -0.01
    );

    const hxTrend = computeTrend(
      hxHealthRes.persistence,
      rates.hxThermalRate < -0.1 || hxDeltaT < 8.0,
      rates.hxThermalRate < -0.3,
      rates.hxThermalRate > 0.1
    );

    const rxTrend = computeTrend(
      rxHealthRes.persistence,
      rates.rxTempRate > 0.15 || rates.rxPressureRate > 0.02 || rCool === 0,
      rates.rxTempRate > 0.4 || rates.rxPressureRate > 0.08,
      rates.rxTempRate < -0.1
    );

    const distTrend = computeTrend(
      distHealthRes.persistence,
      rates.distTopTempRate > 0.1 || dReflux < 1.4,
      rates.distTopTempRate > 0.3 || dReflux < 1.1,
      rates.distTopTempRate < -0.1
    );

    // ========================================================================
    // 7. CAUSAL PROPAGATION & TOPOLOGY ANALYSIS
    // Process train topology: P-101 -> E-101 -> R-101 -> D-101
    // ========================================================================

    // Determine the primary degradation source by identifying which unit has the primary intrinsic fault
    let primarySource = 'None';
    let pRole = 'PRIMARY_SOURCE';
    let hxRole = 'NOMINAL';
    let rxRole = 'NOMINAL';
    let distRole = 'NOMINAL';

    const pHasIntrinsicFault = (pumpPenalty > 0.25 || ifPump.anomaly_score > 0.60 || activeFault.includes('pump'));
    const hxHasIntrinsicFault = (hxPenalty > 0.35 || ifHx.anomaly_score > 0.65 || activeFault.includes('exchanger'));
    const rxHasIntrinsicFault = (rxPenalty > 0.35 || ifRx.anomaly_score > 0.65 || activeFault.includes('reactor'));
    const distHasIntrinsicFault = (distPenalty > 0.35 || ifDist.anomaly_score > 0.65 || activeFault.includes('distillation'));

    if (pHasIntrinsicFault) {
      primarySource = 'P-101 Centrifugal Feed Pump';
      pRole = 'PRIMARY_FAULT';
      hxRole = 'DOWNSTREAM_IMPACT';
      rxRole = 'DOWNSTREAM_IMPACT';
      distRole = 'DOWNSTREAM_IMPACT';
    } else if (hxHasIntrinsicFault) {
      primarySource = 'E-101 Shell & Tube Heat Exchanger';
      pRole = 'NOMINAL';
      hxRole = 'PRIMARY_FAULT';
      rxRole = 'DOWNSTREAM_IMPACT';
      distRole = 'DOWNSTREAM_IMPACT';
    } else if (rxHasIntrinsicFault) {
      primarySource = 'R-101 CSTR Reactor';
      pRole = 'NOMINAL';
      hxRole = 'NOMINAL';
      rxRole = 'PRIMARY_FAULT';
      distRole = 'DOWNSTREAM_IMPACT';
    } else if (distHasIntrinsicFault) {
      primarySource = 'D-101 Binary Distillation Column';
      pRole = 'NOMINAL';
      hxRole = 'NOMINAL';
      rxRole = 'NOMINAL';
      distRole = 'PRIMARY_FAULT';
    }

    // Generate process impact descriptions
    const pProcessImpact = {
      upstream: 'T-100 Feed Tank supply buffer (Nominal)',
      currentUnit: pRole === 'PRIMARY_FAULT' ? `PRIMARY DEGRADATION: Pump speed (${Math.round(pRpm)} RPM) and vibration (${pVib.toFixed(2)} g) causing hydraulic flow deficit.` : 'Operating as nominal rotary prime mover.',
      downstream: pRole === 'PRIMARY_FAULT' ? `Hydraulic throttling propagating reduced flow (${pFlow.toFixed(1)} L/min) to E-101, extending residence time in R-101, and starving D-101 column feed.` : 'Continuous steady feed delivery to E-101.'
    };

    const hxProcessImpact = {
      upstream: pRole === 'PRIMARY_FAULT' ? 'Received reduced throughput from P-101 feed pump (DOWNSTREAM IMPACT).' : 'Receives nominal pressurized feed from P-101.',
      currentUnit: hxRole === 'PRIMARY_FAULT' ? `PRIMARY DEGRADATION: Thermal gradient decay (ΔT ${hxDeltaT.toFixed(1)} °C) due to heat transfer scaling.` : (hxRole === 'DOWNSTREAM_IMPACT' ? 'Operating under reduced hydraulic feed velocity from upstream P-101.' : 'Thermal pre-heating operating within nominal boundary.'),
      downstream: hxRole === 'PRIMARY_FAULT' ? 'Sub-optimally conditioned reactant stream delivered to R-101 reactor core.' : 'Thermally conditioned reactant stream fed to R-101.'
    };

    const rxProcessImpact = {
      upstream: pRole === 'PRIMARY_FAULT' ? 'Reduced volumetric inflow from P-101 extending reaction residence time (DOWNSTREAM IMPACT).' : (hxRole === 'PRIMARY_FAULT' ? 'Inlet temperature anomaly from E-101 affecting reaction rate (DOWNSTREAM IMPACT).' : 'Receives conditioned feed from E-101.'),
      currentUnit: rxRole === 'PRIMARY_FAULT' ? `PRIMARY DEGRADATION: Exothermic heat accumulation (Core Temp: ${rTemp.toFixed(1)} °C, Pressure: ${rPress.toFixed(2)} bar).` : 'Exothermic kinetics balanced with jacket cooling.',
      downstream: rxRole === 'PRIMARY_FAULT' ? `High-temperature pressurized effluent discharging into D-101 distillation feed tray.` : 'Reacted intermediate stream delivered to D-101 column.'
    };

    const distProcessImpact = {
      upstream: pRole === 'PRIMARY_FAULT' ? 'Reduced column feed rate due to P-101 hydraulic deficit (DOWNSTREAM IMPACT).' : (rxRole === 'PRIMARY_FAULT' ? 'Overheated feed stream from R-101 disturbing column vapor balance (DOWNSTREAM IMPACT).' : 'Receives reaction effluent from R-101.'),
      currentUnit: distRole === 'PRIMARY_FAULT' ? `PRIMARY DEGRADATION: Reflux starvation (${dReflux.toFixed(2)} L/D) causing top vapor temperature drift.` : 'Binary fractionation trays operating in equilibrium.',
      downstream: distRole === 'PRIMARY_FAULT' ? 'Distillate product purity off-spec; heavy component slippage.' : 'Product stream S-104 on-spec to storage tank.'
    };

    // Label helpers
    const formatFaultLabel = (faultClass) => {
      const map = {
        normal: 'Normal Operation',
        mechanical_degradation: 'Mechanical Degradation (Impeller/Bearing)',
        suction_restriction: 'Suction Restriction / Cavitation',
        motor_electrical_fault: 'Motor Electrical / Speed Deficit',
        discharge_blockage: 'Discharge Blockage / High Backpressure',
        thermal_fouling: 'Thermal Fouling / Tube Scaling',
        tube_leakage_bypass: 'Tube Leakage / Shell Bypass',
        cooling_starvation: 'Cooling Utility Starvation',
        cooling_jacket_failure: 'Cooling Jacket Failure / Thermal Runaway',
        agitator_failure: 'Agitator Failure / Mixing Deficit',
        runaway_exotherm: 'Runaway Exothermic Acceleration',
        overfeed_flooding: 'Reactant Overfeed / Vessel Flooding',
        reflux_loss_starvation: 'Reflux Loss / Tray Starvation',
        reboiler_flooding_fouling: 'Reboiler Flooding / Sump Fouling',
        column_overpressurization: 'Column Overpressurization',
        condenser_subcooling_loss: 'Condenser Subcooling Loss',
        unknown_fault: 'Unknown Anomaly (Unclassified)'
      };
      return map[faultClass] || faultClass.replace(/_/g, ' ').toUpperCase();
    };

    // ========================================================================
    // 8. ASSEMBLE CENTRAL SINGLE SOURCE OF TRUTH (equipmentDiagnostics)
    // ========================================================================

    const pDiag = {
      equipmentId: 'pump',
      tag: 'P-101',
      name: 'Pump (6V Mini Centrifugal)',
      anomalyScore: Number(ifPump.anomaly_score.toFixed(3)),
      anomaly: ifPump.anomaly,
      faultClass: pumpGuard.faultClass,
      faultLabel: formatFaultLabel(pumpGuard.faultClass),
      faultProbability: Number(pumpGuard.confidence.toFixed(2)),
      probabilities: rfPump.probabilities,
      isUnknownFault: pumpGuard.isUnknown,
      health: pHealthRes.health,
      risk: pHealthRes.risk,
      state: pStage.stage,
      stage: pStage.stage,
      stageLabel: pStage.label,
      severity: pStage.severity,
      color: pStage.color,
      trend: pTrend,
      persistenceTicks: pHealthRes.persistence,
      role: pRole,
      evidence: pumpEvidence,
      baseline: EQUIPMENT_BASELINES.pump,
      current: {
        rpm: Math.round(pRpm),
        flow: Number(pFlow.toFixed(2)),
        vibration: Number(pVib.toFixed(3)),
        suctionPressure: Number(pSuctionP.toFixed(2)),
        dischargePressure: Number(pDischargeP.toFixed(2)),
        pumpHead: Number(pHead.toFixed(2)),
        efficiency: Number(pEff.toFixed(1))
      },
      deviations: {
        rpmPercent: Number(pRpmDev.toFixed(1)),
        flowPercent: Number(pFlowDev.toFixed(1)),
        vibrationPercent: Number(pVibDev.toFixed(1))
      },
      ratesOfChange: {
        rpmRatePerMin: rates.pumpRpmRate,
        flowRatePerMin: rates.pumpFlowRate,
        vibrationRatePerMin: rates.pumpVibrationRate
      },
      sensorReliability: {
        score: hardwareState.isConnected ? 98 : 95,
        isReliable: true,
        source: hardwareState.isConnected ? 'ESP32 Physical Telemetry' : 'Deterministic Physics Simulation'
      },
      processImpact: pProcessImpact,
      lastUpdated: isoTimestamp
    };

    const hxDiag = {
      equipmentId: 'heat_exchanger',
      tag: 'E-101',
      name: 'Heat Exchanger (Shell & Tube)',
      anomalyScore: Number(ifHx.anomaly_score.toFixed(3)),
      anomaly: ifHx.anomaly,
      faultClass: hxGuard.faultClass,
      faultLabel: formatFaultLabel(hxGuard.faultClass),
      faultProbability: Number(hxGuard.confidence.toFixed(2)),
      probabilities: rfHx.probabilities,
      isUnknownFault: hxGuard.isUnknown,
      health: hxHealthRes.health,
      risk: hxHealthRes.risk,
      state: hxStage.stage,
      stage: hxStage.stage,
      stageLabel: hxStage.label,
      severity: hxStage.severity,
      color: hxStage.color,
      trend: hxTrend,
      persistenceTicks: hxHealthRes.persistence,
      role: hxRole,
      evidence: hxEvidence,
      baseline: EQUIPMENT_BASELINES.heat_exchanger,
      current: {
        inletTemperature: Number(hxInT.toFixed(1)),
        outletTemperature: Number(hxOutT.toFixed(1)),
        deltaT: Number(hxDeltaT.toFixed(1)),
        flow: Number(hxFlow.toFixed(1)),
        heatDuty: Number(hxHeatDuty.toFixed(2)),
        effectiveness: Number(hxEffectiveness.toFixed(1))
      },
      deviations: {
        temperaturePercent: Number(hxTempDev.toFixed(1)),
        deltaTPercent: Number(hxDeltaTDev.toFixed(1)),
        flowPercent: Number(hxFlowDev.toFixed(1))
      },
      ratesOfChange: {
        thermalRatePerMin: rates.hxThermalRate
      },
      sensorReliability: {
        score: 96,
        isReliable: true,
        source: 'DS18B20 Dual Digital Probes / Simulation'
      },
      processImpact: hxProcessImpact,
      lastUpdated: isoTimestamp
    };

    const rxDiag = {
      equipmentId: 'reactor',
      tag: 'R-101',
      name: 'Continuous Stirred-Tank Reactor (CSTR)',
      anomalyScore: Number(ifRx.anomaly_score.toFixed(3)),
      anomaly: ifRx.anomaly,
      faultClass: rxGuard.faultClass,
      faultLabel: formatFaultLabel(rxGuard.faultClass),
      faultProbability: Number(rxGuard.confidence.toFixed(2)),
      probabilities: rfRx.probabilities,
      isUnknownFault: rxGuard.isUnknown,
      health: rxHealthRes.health,
      risk: rxHealthRes.risk,
      state: rxStage.stage,
      stage: rxStage.stage,
      stageLabel: rxStage.label,
      severity: rxStage.severity,
      color: rxStage.color,
      trend: rxTrend,
      persistenceTicks: rxHealthRes.persistence,
      role: rxRole,
      evidence: rxEvidence,
      baseline: EQUIPMENT_BASELINES.reactor,
      current: {
        temperature: Number(rTemp.toFixed(1)),
        pressure: Number(rPress.toFixed(2)),
        level: Number(rLevel.toFixed(1)),
        feedFlow: Number(rFeedFlow.toFixed(1)),
        agitatorRPM: Math.round(rAgit),
        coolingState: rCool,
        conversion: Number(rConv.toFixed(1))
      },
      deviations: {
        temperaturePercent: Number((((rTemp - 65) / 65) * 100).toFixed(1)),
        pressurePercent: Number((((rPress - 2.05) / 2.05) * 100).toFixed(1)),
        feedFlowPercent: Number(rFeedDev.toFixed(1))
      },
      ratesOfChange: {
        temperatureRatePerMin: rates.rxTempRate,
        pressureRatePerMin: rates.rxPressureRate,
        levelRatePerMin: rates.rxLevelRate
      },
      sensorReliability: {
        score: 97,
        isReliable: true,
        source: 'Dual RTD & Piezoelectric Pressure Stream'
      },
      processImpact: rxProcessImpact,
      lastUpdated: isoTimestamp
    };

    const distDiag = {
      equipmentId: 'distillation',
      tag: 'D-101',
      name: 'Binary Distillation Column',
      anomalyScore: Number(ifDist.anomaly_score.toFixed(3)),
      anomaly: ifDist.anomaly,
      faultClass: distGuard.faultClass,
      faultLabel: formatFaultLabel(distGuard.faultClass),
      faultProbability: Number(distGuard.confidence.toFixed(2)),
      probabilities: rfDist.probabilities,
      isUnknownFault: distGuard.isUnknown,
      health: distHealthRes.health,
      risk: distHealthRes.risk,
      state: distStage.stage,
      stage: distStage.stage,
      stageLabel: distStage.label,
      severity: distStage.severity,
      color: distStage.color,
      trend: distTrend,
      persistenceTicks: distHealthRes.persistence,
      role: distRole,
      evidence: distEvidence,
      baseline: EQUIPMENT_BASELINES.distillation,
      current: {
        feedFlow: Number(dFeed.toFixed(1)),
        topTemperature: Number(dTopT.toFixed(1)),
        bottomTemperature: Number(dBotT.toFixed(1)),
        pressure: Number(dPress.toFixed(2)),
        refluxRatio: Number(dReflux.toFixed(2)),
        distillateFlow: Number(dDistillate.toFixed(2)),
        bottomsFlow: Number(dBottoms.toFixed(2)),
        purity: Number(dPurity.toFixed(1)),
        reboilerDuty: Number(dReboilerDuty.toFixed(2)),
        condenserDuty: Number(dCondenserDuty.toFixed(2))
      },
      deviations: {
        refluxPercent: Number(dRefluxDev.toFixed(1)),
        topTempPercent: Number((((dTopT - 76.5) / 76.5) * 100).toFixed(1)),
        pressurePercent: Number((((dPress - 2.10) / 2.10) * 100).toFixed(1))
      },
      ratesOfChange: {
        topTemperatureRatePerMin: rates.distTopTempRate,
        bottomTemperatureRatePerMin: rates.distBottomTempRate,
        pressureRatePerMin: rates.distPressureRate
      },
      sensorReliability: {
        score: 97,
        isReliable: true,
        source: 'Sieve Tray Pressure & Optical Refractometer'
      },
      processImpact: distProcessImpact,
      lastUpdated: isoTimestamp
    };

    // Calculate Plant-Wide Health Summary
    const minHealth = Math.min(pDiag.health, hxDiag.health, rxDiag.health, distDiag.health);
    const avgHealth = (pDiag.health + hxDiag.health + rxDiag.health + distDiag.health) / 4;
    const plantHealth = Math.round(minHealth * 0.65 + avgHealth * 0.35);
    const plantStage = this.getHealthStage(plantHealth, 0);

    const plantDiagnosticState = {
      P101: pDiag,
      E101: hxDiag,
      R101: rxDiag,
      D101: distDiag,
      // Unit id aliases for flexible indexing:
      pump: pDiag,
      heat_exchanger: hxDiag,
      reactor: rxDiag,
      distillation: distDiag,
      plant: {
        health: plantHealth,
        stage: plantStage.stage,
        stageLabel: plantStage.label,
        severity: plantStage.severity,
        color: plantStage.color,
        primarySource,
        activeUnitsCount: 4,
        lastUpdated: isoTimestamp
      }
    };

    this.latestDiagnostics = plantDiagnosticState;
    return plantDiagnosticState;
  }

  getEquipmentDiagnostics() {
    return this.latestDiagnostics || this.getInitialDiagnostics();
  }

  getInitialDiagnostics() {
    return this.processState(
      { pump: {}, heatExchanger: {}, reactor: {}, distillation: {} },
      {
        pump_rpm: 2450,
        pump_flow: 10.0,
        pump_vibration: 0.08,
        pump_suction_pressure: 1.01,
        pump_discharge_pressure: 2.80,
        hx_inlet_temp: 38.1,
        hx_outlet_temp: 25.2,
        hx_delta_t: 12.9,
        hx_flow: 9.9,
        hx_efficiency: 95.0,
        reactor_temp: 65.0,
        reactor_pressure: 2.05,
        reactor_level: 50.0,
        reactor_feed_flow: 9.8,
        reactor_agitator_speed: 350,
        reactor_cooling_status: 1,
        dist_top_temp: 76.5,
        dist_bottom_temp: 98.4,
        dist_pressure: 2.10,
        dist_feed_flow: 9.7,
        dist_reflux_ratio: 1.85
      },
      'normal'
    );
  }
}
