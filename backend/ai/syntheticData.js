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
export function generateSyntheticDataset(samplesPerClass = 250) {
  const dataset = [];

  for (let i = 0; i < samplesPerClass; i++) {
    // 1. NORMAL OPERATION
    // Stable RPM, low vibration, good delta T, stable reactor T & P, balanced reflux
    dataset.push({
      features: {
        temperature: gaussianRandom(65.0, 1.5),
        pressure: gaussianRandom(2.0, 0.08),
        level: gaussianRandom(50.0, 1.2),
        vibration: Math.max(0.02, gaussianRandom(0.08, 0.02)),
        rpm: gaussianRandom(2450, 25),
        inlet_temperature: gaussianRandom(25.0, 0.8),
        outlet_temperature: gaussianRandom(38.0, 1.0),
        reflux_ratio: gaussianRandom(1.85, 0.12),
        agitator_speed: gaussianRandom(350, 8)
      },
      label: 'normal'
    });

    // 2. PUMP FAULT
    // Elevated vibration, dropping/unstable RPM, slight outlet heating due to friction/slip
    dataset.push({
      features: {
        temperature: gaussianRandom(66.0, 1.5),
        pressure: gaussianRandom(1.85, 0.12),
        level: gaussianRandom(49.0, 1.5),
        vibration: gaussianRandom(0.48, 0.08), // High vibration
        rpm: gaussianRandom(1750, 90),         // Low RPM
        inlet_temperature: gaussianRandom(25.5, 0.8),
        outlet_temperature: gaussianRandom(43.0, 1.8), // Heated casing
        reflux_ratio: gaussianRandom(2.1, 0.12),
        agitator_speed: gaussianRandom(350, 8)
      },
      label: 'pump_fault'
    });

    // 3. HEAT EXCHANGER FAULT
    // Reduced delta T (outlet temp close to inlet), poor heat transfer indicator
    const inletTemp = gaussianRandom(26.0, 0.8);
    dataset.push({
      features: {
        temperature: gaussianRandom(65.5, 1.5),
        pressure: gaussianRandom(2.05, 0.09),
        level: gaussianRandom(50.0, 1.2),
        vibration: gaussianRandom(0.09, 0.02),
        rpm: gaussianRandom(2440, 30),
        inlet_temperature: inletTemp,
        outlet_temperature: inletTemp + Math.max(0.5, gaussianRandom(2.0, 0.6)), // Poor delta T (<3°C vs 13°C normal)
        reflux_ratio: gaussianRandom(2.15, 0.1),
        agitator_speed: gaussianRandom(350, 8)
      },
      label: 'heat_exchanger_fault'
    });

    // 4. REACTOR COOLING FAILURE
    // Cooling jacket loss -> rapid thermal runaway risk, temperature & vapor pressure rise
    dataset.push({
      features: {
        temperature: gaussianRandom(98.5, 4.0), // High temp (>90°C)
        pressure: gaussianRandom(4.2, 0.35),    // High pressure (>3.5 bar)
        level: gaussianRandom(52.0, 2.0),
        vibration: gaussianRandom(0.12, 0.03),
        rpm: gaussianRandom(2450, 25),
        inlet_temperature: gaussianRandom(26.0, 1.0),
        outlet_temperature: gaussianRandom(38.0, 1.0),
        reflux_ratio: gaussianRandom(2.2, 0.1),
        agitator_speed: gaussianRandom(350, 12)
      },
      label: 'reactor_cooling_failure'
    });

    // 5. DISTILLATION FAULT
    // Low reflux ratio (< 0.8), overhead top temperature rises sharply, pressure fluctuations
    dataset.push({
      features: {
        temperature: gaussianRandom(66.0, 1.5),
        pressure: gaussianRandom(2.7, 0.25),
        level: gaussianRandom(46.0, 2.5),
        vibration: gaussianRandom(0.08, 0.02),
        rpm: gaussianRandom(2450, 25),
        inlet_temperature: gaussianRandom(25.0, 0.8),
        outlet_temperature: gaussianRandom(38.0, 1.0),
        reflux_ratio: gaussianRandom(0.65, 0.12), // Low reflux ratio
        agitator_speed: gaussianRandom(350, 8)
      },
      label: 'distillation_fault'
    });
  }

  return dataset;
}
