/**
 * Synthetic Training Dataset Generator for ChemDiag AI
 * 
 * DISCLAIMER:
 * Synthetic training data is for prototype / demonstration purposes only 
 * and is not industrially certified or validated data.
 */

function gaussianRandom(mean = 0, stdev = 1) {
  const u1 = 1 - Math.random();
  const u2 = 1 - Math.random();
  const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  return mean + randStdNormal * stdev;
}

export const FEATURE_NAMES = [
  'temperature',
  'pressure',
  'level',
  'vibration',
  'rpm',
  'inlet_temperature',
  'outlet_temperature',
  'reflux_ratio',
  'agitator_speed'
];

export const CLASSES = [
  'normal',
  'pump_fault',
  'heat_exchanger_fault',
  'reactor_cooling_failure',
  'distillation_fault'
];

/**
 * Generates N synthetic process samples with realistic correlations
 */
export function generateSyntheticDataset(samplesPerClass = 300) {
  const dataset = [];

  for (let i = 0; i < samplesPerClass; i++) {
    // 1. NORMAL OPERATION
    dataset.push({
      features: {
        temperature: gaussianRandom(65.0, 1.5),
        pressure: gaussianRandom(2.05, 0.08),
        level: gaussianRandom(50.0, 1.2),
        vibration: Math.max(0.02, gaussianRandom(0.08, 0.02)),
        rpm: gaussianRandom(2450, 25),
        inlet_temperature: gaussianRandom(25.2, 0.8),
        outlet_temperature: gaussianRandom(38.1, 1.0),
        reflux_ratio: gaussianRandom(1.85, 0.12),
        agitator_speed: gaussianRandom(350, 8)
      },
      label: 'normal'
    });

    // 2. PUMP FAULT
    dataset.push({
      features: {
        temperature: gaussianRandom(65.5, 1.5),
        pressure: gaussianRandom(1.85, 0.12),
        level: gaussianRandom(49.0, 1.5),
        vibration: gaussianRandom(0.48, 0.08), // High vibration
        rpm: gaussianRandom(1750, 90),         // Low RPM
        inlet_temperature: gaussianRandom(25.5, 0.8),
        outlet_temperature: gaussianRandom(43.0, 1.8), // Heated casing
        reflux_ratio: gaussianRandom(1.85, 0.12),
        agitator_speed: gaussianRandom(350, 8)
      },
      label: 'pump_fault'
    });

    // 3. HEAT EXCHANGER FAULT
    const inletTemp = gaussianRandom(26.0, 0.8);
    dataset.push({
      features: {
        temperature: gaussianRandom(65.5, 1.5),
        pressure: gaussianRandom(2.05, 0.09),
        level: gaussianRandom(50.0, 1.2),
        vibration: gaussianRandom(0.09, 0.02),
        rpm: gaussianRandom(2440, 30),
        inlet_temperature: inletTemp,
        outlet_temperature: inletTemp + Math.max(0.5, gaussianRandom(2.0, 0.6)), // Poor delta T (<3°C)
        reflux_ratio: gaussianRandom(1.85, 0.1),
        agitator_speed: gaussianRandom(350, 8)
      },
      label: 'heat_exchanger_fault'
    });

    // 4. REACTOR COOLING FAILURE
    dataset.push({
      features: {
        temperature: gaussianRandom(92.5, 3.5), // High temp (>88°C)
        pressure: gaussianRandom(3.6, 0.30),    // High pressure (>3.2 bar)
        level: gaussianRandom(52.0, 2.0),
        vibration: gaussianRandom(0.12, 0.03),
        rpm: gaussianRandom(2450, 25),
        inlet_temperature: gaussianRandom(26.0, 1.0),
        outlet_temperature: gaussianRandom(38.0, 1.0),
        reflux_ratio: gaussianRandom(1.85, 0.1),
        agitator_speed: gaussianRandom(350, 12)
      },
      label: 'reactor_cooling_failure'
    });

    // 5. DISTILLATION FAULT
    dataset.push({
      features: {
        temperature: gaussianRandom(66.0, 1.5),
        pressure: gaussianRandom(2.65, 0.20),
        level: gaussianRandom(48.0, 2.0),
        vibration: gaussianRandom(0.08, 0.02),
        rpm: gaussianRandom(2450, 25),
        inlet_temperature: gaussianRandom(25.0, 0.8),
        outlet_temperature: gaussianRandom(38.0, 1.0),
        reflux_ratio: gaussianRandom(0.68, 0.10), // Low reflux ratio
        agitator_speed: gaussianRandom(350, 8)
      },
      label: 'distillation_fault'
    });
  }

  return dataset;
}
