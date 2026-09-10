/**
 * ChemDiag Engineering Calculation Library — Thermodynamics
 * 
 * Deterministic mathematical calculations for ideal gas state equations,
 * compressor & turbine power, enthalpy, entropy, and cycle efficiencies.
 */

import { convertUnit, convertTemperature, formatEngineeringNumber } from './units.js';

const R_UNIVERSAL = 8.314462618; // J/(mol·K) or Pa·m³/(mol·K)

/**
 * 1. Ideal Gas Law State Calculations
 * Formula: P * V = n * R * T  <=>  ρ = (P * M) / (R * T)
 */
export function calcIdealGasLaw({
  pressure = null,
  pressureUnit = 'bar',
  temperature = null,
  temperatureUnit = 'C',
  volume = null,
  volumeUnit = 'm3',
  moles = null,
  mass = null,
  massUnit = 'kg',
  molecularWeight = 28.97, // Air MW ≈ 28.97 g/mol (kg/kmol)
  molecularWeightUnit = 'g/mol'
}) {
  const MW_kgmol = molecularWeight / 1000.0; // kg/mol
  const R_specific = R_UNIVERSAL / MW_kgmol; // J/(kg·K)

  const T_K = temperature !== null ? convertTemperature(temperature, temperatureUnit, 'k') : null;
  const P_Pa = pressure !== null ? convertUnit(pressure, pressureUnit, 'pa', 'pressure') : null;
  const V_m3 = volume !== null ? convertUnit(volume, volumeUnit, 'm3', 'volume') : null;

  let n_mol = moles !== null ? Number(moles) : null;
  if (n_mol === null && mass !== null) {
    const m_kg = convertUnit(mass, massUnit, 'kg', 'mass');
    n_mol = m_kg / MW_kgmol;
  }

  // Case 1: Compute Density (kg/m³) and Molar Volume (m³/mol) from P and T
  if (P_Pa !== null && T_K !== null && V_m3 === null && n_mol === null) {
    const density_kgm3 = (P_Pa * MW_kgmol) / (R_UNIVERSAL * T_K);
    const molarVolume_m3mol = (R_UNIVERSAL * T_K) / P_Pa;
    const molarVolume_Lmol = molarVolume_m3mol * 1000.0;

    return {
      success: true,
      toolName: 'calcIdealGasLaw',
      category: 'Thermodynamics / Ideal Gas',
      summary: `At ${pressure} ${pressureUnit} and ${temperature} °${temperatureUnit}, gas density (MW = ${molecularWeight} ${molecularWeightUnit}) is ${formatEngineeringNumber(density_kgm3, 3)} kg/m³ (Molar Volume = ${formatEngineeringNumber(molarVolume_Lmol, 2)} L/mol).`,
      inputs: {
        pressure: `${pressure} ${pressureUnit} (${formatEngineeringNumber(P_Pa / 1000.0, 1)} kPa)`,
        temperature: `${temperature} °${temperatureUnit} (${formatEngineeringNumber(T_K, 2)} K)`,
        molecularWeight: `${molecularWeight} g/mol`
      },
      equations: [
        'ρ = (P · M) / (R · T)',
        'V_molar = (R · T) / P'
      ],
      substitutions: [
        `ρ = (${formatEngineeringNumber(P_Pa, 0)} Pa · ${formatEngineeringNumber(MW_kgmol, 5)} kg/mol) / (${R_UNIVERSAL} J/(mol·K) · ${formatEngineeringNumber(T_K, 2)} K) = ${formatEngineeringNumber(density_kgm3, 3)} kg/m³`
      ],
      results: {
        density_kgm3,
        molarVolume_m3mol,
        molarVolume_Lmol,
        pressure_Pa: P_Pa,
        temperature_K: T_K
      },
      assumptions: [
        'Ideal gas behavior (Z ≈ 1.0) at moderate pressure and high reduced temperature.'
      ]
    };
  }

  // Case 2: Compute Volume from n, P, T
  if (n_mol !== null && P_Pa !== null && T_K !== null) {
    const calculatedV_m3 = (n_mol * R_UNIVERSAL * T_K) / P_Pa;
    const calculatedV_L = calculatedV_m3 * 1000.0;
    const totalMass_kg = n_mol * MW_kgmol;

    return {
      success: true,
      toolName: 'calcIdealGasLaw',
      category: 'Thermodynamics / Ideal Gas',
      summary: `Volume occupied by ${formatEngineeringNumber(n_mol, 2)} moles (${formatEngineeringNumber(totalMass_kg, 2)} kg) at ${pressure} ${pressureUnit} and ${temperature} °${temperatureUnit} is ${formatEngineeringNumber(calculatedV_m3, 3)} m³ (${formatEngineeringNumber(calculatedV_L, 1)} L).`,
      inputs: {
        moles: n_mol,
        pressure: `${pressure} ${pressureUnit}`,
        temperature: `${temperature} °${temperatureUnit}`
      },
      equations: [
        'V = (n · R · T) / P'
      ],
      substitutions: [
        `V = (${formatEngineeringNumber(n_mol, 2)} mol · 8.314 J/(mol·K) · ${formatEngineeringNumber(T_K, 2)} K) / ${formatEngineeringNumber(P_Pa, 0)} Pa = ${formatEngineeringNumber(calculatedV_m3, 4)} m³`
      ],
      results: {
        volume_m3: calculatedV_m3,
        volume_L: calculatedV_L,
        mass_kg: totalMass_kg
      },
      assumptions: [
        'Ideal gas equation of state.'
      ]
    };
  }

  // Case 3: Compute Pressure from n, V, T
  if (n_mol !== null && V_m3 !== null && T_K !== null) {
    const calculatedP_Pa = (n_mol * R_UNIVERSAL * T_K) / V_m3;
    const calculatedP_bar = calculatedP_Pa / 100000.0;
    const calculatedP_kPa = calculatedP_Pa / 1000.0;
    const calculatedP_psi = calculatedP_Pa / 6894.757;

    return {
      success: true,
      toolName: 'calcIdealGasLaw',
      category: 'Thermodynamics / Ideal Gas',
      summary: `Gas pressure is ${formatEngineeringNumber(calculatedP_bar, 3)} bar (${formatEngineeringNumber(calculatedP_kPa, 1)} kPa, ${formatEngineeringNumber(calculatedP_psi, 1)} psi).`,
      inputs: {
        moles: n_mol,
        volume: `${volume} ${volumeUnit}`,
        temperature: `${temperature} °${temperatureUnit}`
      },
      equations: [
        'P = (n · R · T) / V'
      ],
      substitutions: [
        `P = (${formatEngineeringNumber(n_mol, 2)} mol · 8.314 J/(mol·K) · ${formatEngineeringNumber(T_K, 2)} K) / ${formatEngineeringNumber(V_m3, 4)} m³ = ${formatEngineeringNumber(calculatedP_Pa, 0)} Pa`
      ],
      results: {
        pressure_Pa: calculatedP_Pa,
        pressure_bar: calculatedP_bar,
        pressure_kPa: calculatedP_kPa,
        pressure_psi: calculatedP_psi
      },
      assumptions: [
        'Ideal gas behavior.'
      ]
    };
  }

  throw new Error('Provide sufficient gas properties: (P, T) for density, or (n/m, P, T) for Volume, or (n/m, V, T) for Pressure.');
}

/**
 * 2. Compressor Isentropic Power & Discharge Temperature
 * Formula: W_dot_isen = m_dot * (γ / (γ - 1)) * R_spec * T_in * [ (P_out/P_in)^((γ - 1)/γ) - 1 ]
 * T_out_isen = T_in * (P_out / P_in)^((γ - 1)/γ)
 * Actual Power = W_dot_isen / η_isen
 */
export function calcCompressorPower({
  massFlow = null,
  volumetricFlow = null,
  flowUnit = 'kg/s',
  suctionPressure,
  dischargePressure,
  pressureUnit = 'bar',
  suctionTemperature,
  temperatureUnit = 'C',
  gamma = 1.4, // Ratio of specific heats Cp/Cv (Air/Diatomic ≈ 1.40, Methane ≈ 1.31)
  molecularWeight = 28.97, // g/mol
  isentropicEfficiency = 0.75 // 75%
}) {
  const pIn_Pa = convertUnit(suctionPressure, pressureUnit, 'pa', 'pressure');
  const pOut_Pa = convertUnit(dischargePressure, pressureUnit, 'pa', 'pressure');
  const tIn_K = convertTemperature(suctionTemperature, temperatureUnit, 'k');
  const eta_isen = isentropicEfficiency > 1.0 ? isentropicEfficiency / 100.0 : isentropicEfficiency;

  if (pIn_Pa <= 0 || pOut_Pa <= 0 || pOut_Pa <= pIn_Pa) {
    throw new Error('Discharge pressure must be strictly greater than suction pressure.');
  }
  if (gamma <= 1.0) throw new Error('Specific heat ratio γ must be greater than 1.0.');

  const MW_kgmol = molecularWeight / 1000.0;
  const R_spec = R_UNIVERSAL / MW_kgmol; // J/(kg·K)

  // Determine mass flow rate (kg/s)
  let m_dot_kg = 0;
  if (massFlow !== null) {
    m_dot_kg = convertUnit(massFlow, flowUnit, 'kg/s', 'mass_flow');
  } else if (volumetricFlow !== null) {
    // Convert inlet volumetric flow to mass flow using suction density
    const rho_inlet = (pIn_Pa * MW_kgmol) / (R_UNIVERSAL * tIn_K);
    const Q_m3s = convertUnit(volumetricFlow, flowUnit, 'm3/s', 'volumetric_flow');
    m_dot_kg = Q_m3s * rho_inlet;
  } else {
    throw new Error('Either mass flow rate or inlet volumetric flow rate must be provided.');
  }

  const pressureRatio = pOut_Pa / pIn_Pa;
  const expTerm = (gamma - 1.0) / gamma;
  const tempRatio_isen = Math.pow(pressureRatio, expTerm);

  // Isentropic discharge temperature
  const tOut_isen_K = tIn_K * tempRatio_isen;
  const tOut_actual_K = tIn_K + (tOut_isen_K - tIn_K) / eta_isen;
  const tOut_actual_C = tOut_actual_K - 273.15;

  // Isentropic power (W)
  const isentropicWorkPerKg = (gamma / (gamma - 1.0)) * R_spec * tIn_K * (tempRatio_isen - 1.0);
  const isentropicPower_W = m_dot_kg * isentropicWorkPerKg;
  const isentropicPower_kW = isentropicPower_W / 1000.0;

  // Actual compressor brake power (W)
  const actualPower_W = isentropicPower_W / eta_isen;
  const actualPower_kW = actualPower_W / 1000.0;
  const actualPower_hp = actualPower_W / 745.7;

  return {
    success: true,
    toolName: 'calcCompressorPower',
    category: 'Thermodynamics / Compressors',
    summary: `Compression ratio is ${formatEngineeringNumber(pressureRatio, 2)}. Compressor power required is ${formatEngineeringNumber(actualPower_kW, 2)} kW (${formatEngineeringNumber(actualPower_hp, 1)} hp) at ${Math.round(eta_isen * 100)}% isentropic efficiency. Discharge temperature is ${formatEngineeringNumber(tOut_actual_C, 1)} °C.`,
    inputs: {
      pressureRatio,
      suctionPressure: `${suctionPressure} ${pressureUnit}`,
      dischargePressure: `${dischargePressure} ${pressureUnit}`,
      suctionTemperature: `${suctionTemperature} °${temperatureUnit}`,
      massFlow_kgs: m_dot_kg,
      gamma,
      isentropicEfficiency: eta_isen * 100
    },
    equations: [
      'Pressure Ratio r_p = P_out / P_in',
      'T_out,isen = T_in · (r_p)^((γ-1)/γ)',
      'W_dot_isen = m_dot · (γ/(γ-1)) · R_spec · T_in · [(r_p)^((γ-1)/γ) - 1]',
      'W_dot_actual = W_dot_isen / η_isen',
      'T_out,actual = T_in + (T_out,isen - T_in) / η_isen'
    ],
    substitutions: [
      `r_p = ${formatEngineeringNumber(pOut_Pa / 1000.0, 1)} kPa / ${formatEngineeringNumber(pIn_Pa / 1000.0, 1)} kPa = ${formatEngineeringNumber(pressureRatio, 2)}`,
      `Exponent (γ-1)/γ = (${gamma}-1)/${gamma} = ${formatEngineeringNumber(expTerm, 4)}`,
      `T_out,actual = ${formatEngineeringNumber(tIn_K, 2)} K + (${formatEngineeringNumber(tOut_isen_K - tIn_K, 2)}) / ${eta_isen} = ${formatEngineeringNumber(tOut_actual_K, 2)} K (${formatEngineeringNumber(tOut_actual_C, 1)} °C)`,
      `Power = ${formatEngineeringNumber(isentropicPower_kW, 2)} kW / ${eta_isen} = ${formatEngineeringNumber(actualPower_kW, 2)} kW`
    ],
    results: {
      actualPower_kW,
      actualPower_hp,
      isentropicPower_kW,
      dischargeTemperature_C: tOut_actual_C,
      dischargeTemperature_K: tOut_actual_K,
      pressureRatio
    },
    assumptions: [
      'Adiabatic compression of ideal gas with constant specific heat ratio γ.',
      'Single-stage compression without intercooling.'
    ]
  };
}

/**
 * 3. Carnot Maximum Theoretical Thermal Efficiency
 * Formula: η_Carnot = 1 - (T_cold / T_hot)
 */
export function calcCarnotEfficiency({
  tHot,
  tCold,
  tempUnit = 'C'
}) {
  const Th_K = convertTemperature(tHot, tempUnit, 'k');
  const Tc_K = convertTemperature(tCold, tempUnit, 'k');

  if (Th_K <= Tc_K) {
    throw new Error(`Heat source temperature (${Th_K} K) must be strictly higher than heat sink temperature (${Tc_K} K).`);
  }

  const eta_carnot = 1.0 - (Tc_K / Th_K);
  const eta_percent = eta_carnot * 100.0;

  return {
    success: true,
    toolName: 'calcCarnotEfficiency',
    category: 'Thermodynamics / Cycles',
    summary: `Carnot maximum thermodynamic efficiency between ${tHot} °${tempUnit} (${formatEngineeringNumber(Th_K, 1)} K) and ${tCold} °${tempUnit} (${formatEngineeringNumber(Tc_K, 1)} K) is ${formatEngineeringNumber(eta_percent, 2)}%.`,
    inputs: {
      tHot: `${tHot} °${tempUnit} (${formatEngineeringNumber(Th_K, 2)} K)`,
      tCold: `${tCold} °${tempUnit} (${formatEngineeringNumber(Tc_K, 2)} K)`
    },
    equations: [
      'η_Carnot = 1 - (T_cold,K / T_hot,K)'
    ],
    substitutions: [
      `η_Carnot = 1 - (${formatEngineeringNumber(Tc_K, 2)} K / ${formatEngineeringNumber(Th_K, 2)} K) = ${formatEngineeringNumber(eta_carnot, 4)} (${formatEngineeringNumber(eta_percent, 2)}%)`
    ],
    results: {
      efficiencyFraction: eta_carnot,
      efficiencyPercent: eta_percent,
      tHot_K: Th_K,
      tCold_K: Tc_K
    },
    assumptions: [
      'Reversible Carnot heat engine operating between two constant-temperature thermal reservoirs (2nd Law of Thermodynamics upper bound).'
    ]
  };
}
