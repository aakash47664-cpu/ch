/**
 * ChemDiag Engineering Calculation Library — Process Equipment Sizing
 * 
 * Deterministic mathematical calculations for control valves, storage tanks,
 * pressure vessels, and rotating machinery.
 */

import { convertUnit, formatEngineeringNumber } from './units.js';

const PI = Math.PI;

/**
 * 1. Liquid Control Valve Sizing (Cv & Kv Flow Coefficient)
 * Formula: Q = Cv * sqrt(ΔP / SG)  <=>  Cv = Q * sqrt(SG / ΔP)
 * In metric: Q (m³/h) = Kv * sqrt(ΔP / SG [bar])  (where Cv = 1.156 * Kv)
 */
export function calcControlValveCv({
  flowRate, // US gpm or m³/h
  flowUnit = 'gpm',
  pressureDrop, // psi or bar
  pressureDropUnit = 'psi',
  specificGravity = 1.0 // SG relative to water (water = 1.0)
}) {
  const SG = Number(specificGravity);
  if (SG <= 0) throw new Error('Specific gravity must be strictly positive.');

  // Normalize flow to US gpm
  const Q_gpm = convertUnit(flowRate, flowUnit, 'gpm', 'volumetric_flow');
  // Normalize pressure drop to psi
  const deltaP_psi = convertUnit(pressureDrop, pressureDropUnit, 'psi', 'pressure');

  if (deltaP_psi <= 0) throw new Error('Pressure drop across control valve must be strictly positive.');

  const Cv = Q_gpm * Math.sqrt(SG / deltaP_psi);
  const Kv = Cv * 0.865; // Metric flow coefficient (m³/h at 1 bar ΔP)

  // Standard valve size recommendation based on typical Cv limits
  let recommendedValveSize_in = '1"';
  if (Cv <= 5) recommendedValveSize_in = '1/2"';
  else if (Cv <= 12) recommendedValveSize_in = '3/4"';
  else if (Cv <= 25) recommendedValveSize_in = '1"';
  else if (Cv <= 55) recommendedValveSize_in = '1-1/2"';
  else if (Cv <= 100) recommendedValveSize_in = '2"';
  else if (Cv <= 220) recommendedValveSize_in = '3"';
  else if (Cv <= 380) recommendedValveSize_in = '4"';
  else if (Cv <= 850) recommendedValveSize_in = '6"';
  else recommendedValveSize_in = '8"+';

  return {
    success: true,
    toolName: 'calcControlValveCv',
    category: 'Equipment / Control Valves',
    summary: `Required Flow Coefficient C_v = ${formatEngineeringNumber(Cv, 2)} (K_v = ${formatEngineeringNumber(Kv, 2)} m³/h·bar^0.5). Recommended nominal valve body size: ${recommendedValveSize_in}.`,
    inputs: {
      flowRate: `${flowRate} ${flowUnit} (${formatEngineeringNumber(Q_gpm, 1)} gpm)`,
      pressureDrop: `${pressureDrop} ${pressureDropUnit} (${formatEngineeringNumber(deltaP_psi, 2)} psi)`,
      specificGravity: SG
    },
    equations: [
      'C_v = Q [gpm] · √(SG / ΔP [psi])',
      'K_v = 0.865 · C_v'
    ],
    substitutions: [
      `C_v = ${formatEngineeringNumber(Q_gpm, 1)} gpm · √(${SG} / ${formatEngineeringNumber(deltaP_psi, 2)} psi) = ${formatEngineeringNumber(Cv, 2)}`
    ],
    results: {
      flowCoefficient_Cv: Cv,
      flowCoefficient_Kv: Kv,
      recommendedValveSize: recommendedValveSize_in,
      flowRate_gpm: Q_gpm,
      pressureDrop_psi: deltaP_psi
    },
    assumptions: [
      'Non-cavitating, non-flashing turbulent liquid flow through standard globe control valve (ISA-75.01 standard).',
      'Sub-critical pressure drop without choked flow.'
    ]
  };
}

/**
 * 2. Storage Tank Geometry & Residence / Hold-Up Time
 * Formula: V = π * (D/2)² * H, Hold-up Time = V / Q
 */
export function calcTankVolumeAndHoldTime({
  diameter,
  diameterUnit = 'm',
  height,
  heightUnit = 'm',
  flowRate = null,
  flowUnit = 'm3/h',
  tankOrientation = 'vertical' // 'vertical' or 'horizontal'
}) {
  const D_m = convertUnit(diameter, diameterUnit, 'm', 'length');
  const H_m = convertUnit(height, heightUnit, 'm', 'length');

  if (D_m <= 0 || H_m <= 0) {
    throw new Error('Tank diameter and height/length must both be strictly positive.');
  }

  // Cylindrical volume (m³)
  const volume_m3 = (PI * Math.pow(D_m, 2) / 4.0) * H_m;
  const volume_L = volume_m3 * 1000.0;
  const volume_gal = volume_m3 * 264.172;
  const volume_bbl = volume_m3 * 6.28981;

  let holdTime_hr = null;
  let holdTime_min = null;
  if (flowRate !== null) {
    const Q_m3s = convertUnit(flowRate, flowUnit, 'm3/s', 'volumetric_flow');
    if (Q_m3s > 0) {
      const holdTime_s = volume_m3 / Q_m3s;
      holdTime_hr = holdTime_s / 3600.0;
      holdTime_min = holdTime_s / 60.0;
    }
  }

  return {
    success: true,
    toolName: 'calcTankVolumeAndHoldTime',
    category: 'Equipment / Storage Tanks',
    summary: `Cylindrical tank (D = ${diameter} ${diameterUnit}, H = ${height} ${heightUnit}) total geometric volume is ${formatEngineeringNumber(volume_m3, 2)} m³ (${formatEngineeringNumber(volume_L, 0)} L, ${formatEngineeringNumber(volume_gal, 0)} gallons, ${formatEngineeringNumber(volume_bbl, 1)} bbl).${holdTime_hr !== null ? ` At ${flowRate} ${flowUnit}, residence hold-up time is ${formatEngineeringNumber(holdTime_hr, 2)} hours (${formatEngineeringNumber(holdTime_min, 1)} minutes).` : ''}`,
    inputs: {
      diameter: `${diameter} ${diameterUnit}`,
      height: `${height} ${heightUnit}`,
      flowRate: flowRate !== null ? `${flowRate} ${flowUnit}` : 'N/A'
    },
    equations: [
      'V = (π · D² / 4) · H',
      'Hold Time = V / Q'
    ],
    substitutions: [
      `V = (π · (${formatEngineeringNumber(D_m, 2)} m)² / 4) · ${formatEngineeringNumber(H_m, 2)} m = ${formatEngineeringNumber(volume_m3, 2)} m³`
    ],
    results: {
      volume_m3,
      volume_L,
      volume_gallons: volume_gal,
      volume_barrels: volume_bbl,
      holdTime_hours: holdTime_hr,
      holdTime_minutes: holdTime_min
    },
    assumptions: [
      'Standard flat-bottom cylindrical vessel without dished head volume additions.',
      '100% full capacity (effective working volume typically 80-90% to allow vapor surge space).'
    ]
  };
}

/**
 * 3. ASME Boiler & Pressure Vessel Shell Thickness (ASME Section VIII Div 1)
 * Formula: t = (P * R) / (S * E - 0.6 * P) + CA
 */
export function calcPressureVesselThickness({
  designPressure, // bar or psi
  pressureUnit = 'bar',
  innerRadius, // mm or in
  radiusUnit = 'mm',
  allowableStress = 138, // MPa (SA-516 Grade 70 at ambient ≈ 138 MPa = 20,000 psi)
  stressUnit = 'MPa',
  jointEfficiency = 1.0, // E = 1.0 for 100% radiography, 0.85 for spot
  corrosionAllowance = 3.0, // CA in mm
  corrosionAllowanceUnit = 'mm'
}) {
  const P_MPa = convertUnit(designPressure, pressureUnit, 'mpa', 'pressure');
  const R_mm = convertUnit(innerRadius, radiusUnit, 'mm', 'length');
  const S_MPa = Number(allowableStress);
  const E = Number(jointEfficiency);
  const CA_mm = convertUnit(corrosionAllowance, corrosionAllowanceUnit, 'mm', 'length');

  if (P_MPa <= 0 || R_mm <= 0 || S_MPa <= 0 || E <= 0) {
    throw new Error('Design pressure, radius, allowable stress, and joint efficiency must be strictly positive.');
  }

  const denominator = S_MPa * E - 0.6 * P_MPa;
  if (denominator <= 0) {
    throw new Error('Pressure exceeds maximum allowable limit for material stress and joint efficiency.');
  }

  const theoreticalThickness_mm = (P_MPa * R_mm) / denominator;
  const totalRequiredThickness_mm = theoreticalThickness_mm + CA_mm;
  const totalRequiredThickness_in = totalRequiredThickness_mm / 25.4;

  return {
    success: true,
    toolName: 'calcPressureVesselThickness',
    category: 'Equipment / Pressure Vessels',
    summary: `Minimum cylindrical shell wall thickness is ${formatEngineeringNumber(totalRequiredThickness_mm, 2)} mm (${formatEngineeringNumber(totalRequiredThickness_in, 3)} in) including ${corrosionAllowance} ${corrosionAllowanceUnit} corrosion allowance (ASME Sec VIII Div 1).`,
    inputs: {
      designPressure: `${designPressure} ${pressureUnit} (${formatEngineeringNumber(P_MPa, 3)} MPa)`,
      innerRadius: `${innerRadius} ${radiusUnit}`,
      allowableStress: `${allowableStress} ${stressUnit}`,
      jointEfficiency: E,
      corrosionAllowance: `${corrosionAllowance} ${corrosionAllowanceUnit}`
    },
    equations: [
      't_required = [P · R / (S · E - 0.6 · P)] + CorrosionAllowance'
    ],
    substitutions: [
      `t_calc = (${formatEngineeringNumber(P_MPa, 3)} · ${R_mm}) / (${S_MPa} · ${E} - 0.6 · ${formatEngineeringNumber(P_MPa, 3)}) = ${formatEngineeringNumber(theoreticalThickness_mm, 2)} mm`,
      `t_total = ${formatEngineeringNumber(theoreticalThickness_mm, 2)} + ${CA_mm} = ${formatEngineeringNumber(totalRequiredThickness_mm, 2)} mm`
    ],
    results: {
      minimumThickness_mm: totalRequiredThickness_mm,
      minimumThickness_in: totalRequiredThickness_in,
      theoreticalThickness_mm: theoreticalThickness_mm,
      corrosionAllowance_mm: CA_mm
    },
    assumptions: [
      'ASME Boiler and Pressure Vessel Code Section VIII Division 1 circumferential stress equation (thin-walled cylinder where t <= 0.5R).'
    ]
  };
}
