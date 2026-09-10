/**
 * ChemDiag Engineering Calculation Library — Chemical Reaction Engineering
 * 
 * Deterministic mathematical calculations for kinetics, conversion, yield,
 * residence time, and ideal reactor sizing (CSTR, PFR, Batch).
 */

import { convertUnit, convertTemperature, formatEngineeringNumber } from './units.js';

const R_UNIVERSAL = 8.314462618; // J/(mol·K)

/**
 * 1. Arrhenius Kinetic Rate Constant
 * Formula: k(T) = A * exp(-Ea / (R * T))
 */
export function calcArrheniusRateConstant({
  preExponentialFactor, // Frequency factor A
  activationEnergy, // Ea in J/mol or kJ/mol
  activationEnergyUnit = 'kJ/mol',
  temperature,
  temperatureUnit = 'C'
}) {
  const A = Number(preExponentialFactor);
  const T_K = convertTemperature(temperature, temperatureUnit, 'k');

  if (A <= 0 || T_K <= 0) {
    throw new Error('Pre-exponential factor A and absolute temperature must be strictly positive.');
  }

  // Normalize Ea to J/mol
  const ea_str = activationEnergyUnit.toLowerCase();
  const Ea_Jmol = ea_str.includes('kj') ? Number(activationEnergy) * 1000.0 : Number(activationEnergy);

  const exponent = -Ea_Jmol / (R_UNIVERSAL * T_K);
  const k = A * Math.exp(exponent);

  return {
    success: true,
    toolName: 'calcArrheniusRateConstant',
    category: 'Reaction Engineering / Kinetics',
    summary: `At ${temperature} °${temperatureUnit} (${formatEngineeringNumber(T_K, 2)} K), rate constant k = ${formatEngineeringNumber(k, 4)} (with Ea = ${activationEnergy} ${activationEnergyUnit}).`,
    inputs: {
      preExponentialFactor: A,
      activationEnergy: `${activationEnergy} ${activationEnergyUnit} (${formatEngineeringNumber(Ea_Jmol, 0)} J/mol)`,
      temperature: `${temperature} °${temperatureUnit} (${formatEngineeringNumber(T_K, 2)} K)`
    },
    equations: [
      'k(T) = A · exp(-E_a / (R · T))'
    ],
    substitutions: [
      `Exponent = -(${formatEngineeringNumber(Ea_Jmol, 0)} J/mol) / (${R_UNIVERSAL} J/(mol·K) · ${formatEngineeringNumber(T_K, 2)} K) = ${formatEngineeringNumber(exponent, 4)}`,
      `k = ${A} · exp(${formatEngineeringNumber(exponent, 4)}) = ${formatEngineeringNumber(k, 4)}`
    ],
    results: {
      rateConstant_k: k,
      temperature_K: T_K,
      exponent
    },
    assumptions: [
      'Arrhenius temperature dependency with constant activation energy Ea over the operating range.'
    ]
  };
}

/**
 * 2. Reactor Residence Time / Space Time (τ) & Space Velocity
 * Formula: τ = V / v_0, Space Velocity = 1 / τ = v_0 / V
 */
export function calcReactorResidenceTime({
  reactorVolume,
  reactorVolumeUnit = 'm3',
  volumetricFlow,
  volumetricFlowUnit = 'm3/h'
}) {
  const V_m3 = convertUnit(reactorVolume, reactorVolumeUnit, 'm3', 'volume');
  const v0_m3s = convertUnit(volumetricFlow, volumetricFlowUnit, 'm3/s', 'volumetric_flow');

  if (V_m3 <= 0 || v0_m3s <= 0) {
    throw new Error('Reactor volume and volumetric flow rate must both be strictly positive.');
  }

  const tau_s = V_m3 / v0_m3s;
  const tau_min = tau_s / 60.0;
  const tau_hr = tau_s / 3600.0;
  const spaceVelocity_perHr = 1.0 / tau_hr;

  return {
    success: true,
    toolName: 'calcReactorResidenceTime',
    category: 'Reaction Engineering / Sizing',
    summary: `Space time (residence time τ) is ${formatEngineeringNumber(tau_min, 2)} minutes (${formatEngineeringNumber(tau_hr, 3)} hours, ${formatEngineeringNumber(tau_s, 1)} seconds). Space Velocity = ${formatEngineeringNumber(spaceVelocity_perHr, 2)} h⁻¹.`,
    inputs: {
      reactorVolume: `${reactorVolume} ${reactorVolumeUnit} (${formatEngineeringNumber(V_m3, 3)} m³)`,
      volumetricFlow: `${volumetricFlow} ${volumetricFlowUnit} (${formatEngineeringNumber(v0_m3s * 3600.0, 2)} m³/h)`
    },
    equations: [
      'τ (Space Time) = V / v₀',
      'Space Velocity = 1 / τ = v₀ / V'
    ],
    substitutions: [
      `τ = ${formatEngineeringNumber(V_m3, 3)} m³ / ${formatEngineeringNumber(v0_m3s, 5)} m³/s = ${formatEngineeringNumber(tau_s, 1)} s = ${formatEngineeringNumber(tau_min, 2)} min`
    ],
    results: {
      residenceTime_s: tau_s,
      residenceTime_min: tau_min,
      residenceTime_hr: tau_hr,
      spaceVelocity_perHr: spaceVelocity_perHr
    },
    assumptions: [
      'Constant density fluid in a continuous flow system (Liquid or isobaric/isothermal gas).'
    ]
  };
}

/**
 * 3. Continuous Stirred-Tank Reactor (CSTR) Design Equation
 * Sizing Volume: V = v_0 * (C_A0 - C_A) / (-r_A) = v_0 * C_A0 * X_A / (-r_A)
 */
export function calcCSTRSizing({
  volumetricFlow,
  volumetricFlowUnit = 'm3/h',
  feedConcentration, // CA0 in mol/m³ or mol/L
  concentrationUnit = 'mol/L',
  targetConversion, // XA (e.g. 0.85 for 85%)
  rateConstant = null, // k (for 1st or 2nd order)
  reactionOrder = 1 // 1 for first-order (-rA = k*CA), 2 for second-order
}) {
  const v0_m3s = convertUnit(volumetricFlow, volumetricFlowUnit, 'm3/s', 'volumetric_flow');
  const XA = targetConversion > 1.0 ? targetConversion / 100.0 : targetConversion;

  if (XA <= 0 || XA >= 1.0) throw new Error('Target conversion must be between 0 and 1.0 (0% to 100%).');
  if (v0_m3s <= 0) throw new Error('Volumetric flow rate must be strictly positive.');

  // Normalize concentration to mol/m³ (1 mol/L = 1000 mol/m³)
  const CA0_molm3 = concentrationUnit.toLowerCase().includes('/l') ? feedConcentration * 1000.0 : feedConcentration;
  const CA_exit_molm3 = CA0_molm3 * (1.0 - XA);

  let reactionRate_exit = 0;
  if (rateConstant !== null) {
    const k = Number(rateConstant);
    if (reactionOrder === 1) {
      reactionRate_exit = k * CA_exit_molm3; // mol/(m³·s)
    } else if (reactionOrder === 2) {
      reactionRate_exit = k * Math.pow(CA_exit_molm3, 2);
    } else {
      reactionRate_exit = k * Math.pow(CA_exit_molm3, reactionOrder);
    }
  } else {
    throw new Error('Rate constant k is required to compute CSTR volume.');
  }

  const requiredVolume_m3 = (v0_m3s * CA0_molm3 * XA) / reactionRate_exit;
  const requiredVolume_L = requiredVolume_m3 * 1000.0;
  const tau_s = requiredVolume_m3 / v0_m3s;
  const tau_min = tau_s / 60.0;

  return {
    success: true,
    toolName: 'calcCSTRSizing',
    category: 'Reaction Engineering / CSTR',
    summary: `Required CSTR volume for ${Math.round(XA * 100)}% conversion is ${formatEngineeringNumber(requiredVolume_m3, 3)} m³ (${formatEngineeringNumber(requiredVolume_L, 1)} L) with residence time τ = ${formatEngineeringNumber(tau_min, 2)} min.`,
    inputs: {
      volumetricFlow: `${volumetricFlow} ${volumetricFlowUnit}`,
      feedConcentration: `${feedConcentration} ${concentrationUnit}`,
      conversion: `${Math.round(XA * 100)}%`,
      rateConstant: rateConstant,
      reactionOrder
    },
    equations: [
      'C_A = C_A0 · (1 - X_A)',
      '-r_A = k · C_Aⁿ',
      'V_CSTR = v₀ · C_A0 · X_A / (-r_A)',
      'τ = V / v₀'
    ],
    substitutions: [
      `C_A,exit = ${formatEngineeringNumber(CA0_molm3 / 1000.0, 3)} · (1 - ${XA}) = ${formatEngineeringNumber(CA_exit_molm3 / 1000.0, 3)} mol/L`,
      `-r_A,exit = ${rateConstant} · (${formatEngineeringNumber(CA_exit_molm3, 1)})^${reactionOrder} = ${formatEngineeringNumber(reactionRate_exit, 4)} mol/(m³·s)`,
      `V = (${formatEngineeringNumber(v0_m3s, 5)} m³/s · ${formatEngineeringNumber(CA0_molm3, 1)} mol/m³ · ${XA}) / ${formatEngineeringNumber(reactionRate_exit, 4)} = ${formatEngineeringNumber(requiredVolume_m3, 3)} m³`
    ],
    results: {
      volume_m3: requiredVolume_m3,
      volume_L: requiredVolume_L,
      residenceTime_min: tau_min,
      residenceTime_s: tau_s,
      exitConcentration_molL: CA_exit_molm3 / 1000.0,
      reactionRate_molm3s: reactionRate_exit
    },
    assumptions: [
      'Ideal CSTR behavior (perfect macromixing with uniform temperature and composition throughout vessel equal to exit stream).',
      'Constant fluid density (isochoric system).'
    ]
  };
}
