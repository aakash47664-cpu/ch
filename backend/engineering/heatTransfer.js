/**
 * ChemDiag Engineering Calculation Library — Heat Transfer
 * 
 * Deterministic mathematical calculations for thermal duties, conduction,
 * convection, heat exchangers, LMTD, and effectiveness-NTU.
 */

import { convertUnit, convertDeltaTemperature, formatEngineeringNumber } from './units.js';

/**
 * 1. Sensible Heat Duty
 * Formula: Q = m_dot * Cp * ΔT
 */
export function calcSensibleHeatDuty({
  massFlow = null, // or mass
  mass = null,
  massFlowUnit = 'kg/s',
  massUnit = 'kg',
  specificHeat = 4.184, // default water Cp in kJ/(kg·K)
  specificHeatUnit = 'kJ/(kg.K)', // or J/(kg.K)
  deltaT = null,
  deltaTUnit = 'C',
  tIn = null,
  tOut = null,
  tempUnit = 'C'
}) {
  let m_kg = 0;
  let isRate = false;

  if (massFlow !== null && massFlow !== undefined) {
    m_kg = convertUnit(massFlow, massFlowUnit, 'kg/s', 'mass_flow');
    isRate = true;
  } else if (mass !== null && mass !== undefined) {
    m_kg = convertUnit(mass, massUnit, 'kg', 'mass');
    isRate = false;
  } else {
    throw new Error('Either mass flow rate (e.g. 2 kg/s) or total batch mass (e.g. 100 kg) must be provided.');
  }

  // Normalize specific heat to J/(kg·K)
  const cp_str = specificHeatUnit.toLowerCase();
  const cp_JkgK = cp_str.includes('kj') ? specificHeat * 1000.0 : specificHeat;

  let dT_K = 0;
  if (deltaT !== null && deltaT !== undefined) {
    dT_K = convertDeltaTemperature(deltaT, deltaTUnit, 'k');
  } else if (tIn !== null && tOut !== null) {
    dT_K = Math.abs(convertDeltaTemperature(tOut - tIn, tempUnit, 'k'));
  } else {
    throw new Error('Either temperature difference (ΔT) or inlet and outlet temperatures (tIn, tOut) must be provided.');
  }

  // Thermal energy in Joules (or Watts if flow rate)
  const Q_SI = m_kg * cp_JkgK * dT_K;
  const Q_kJ = Q_SI / 1000.0;
  const Q_MJ = Q_SI / 1e6;
  const Q_kW = Q_SI / 1000.0;
  const Q_MW = Q_SI / 1e6;
  const Q_Btu = Q_SI / 1055.06;

  const unitLabel = isRate ? 'kW' : 'kJ';
  const valLabel = isRate ? formatEngineeringNumber(Q_kW, 3) : formatEngineeringNumber(Q_kJ, 2);

  return {
    success: true,
    toolName: 'calcSensibleHeatDuty',
    category: 'Heat Transfer',
    summary: `Thermal ${isRate ? 'duty' : 'energy required'} is ${valLabel} ${unitLabel} (${formatEngineeringNumber(isRate ? Q_MW : Q_MJ, 3)} ${isRate ? 'MW' : 'MJ'}).`,
    inputs: {
      mass: { value: isRate ? massFlow : mass, unit: isRate ? massFlowUnit : massUnit, isRate },
      specificHeat: { value: specificHeat, unit: specificHeatUnit, siValue: cp_JkgK, siUnit: 'J/(kg·K)' },
      deltaT: { value: deltaT ?? (tOut - tIn), unit: deltaTUnit ?? tempUnit, siValue: dT_K, siUnit: 'K' }
    },
    equations: [
      isRate ? 'Q_dot = m_dot · Cp · ΔT' : 'Q = m · Cp · ΔT'
    ],
    substitutions: [
      `m = ${isRate ? massFlow : mass} ${isRate ? massFlowUnit : massUnit} = ${formatEngineeringNumber(m_kg, 4)} ${isRate ? 'kg/s' : 'kg'}`,
      `Cp = ${specificHeat} ${specificHeatUnit} = ${formatEngineeringNumber(cp_JkgK, 1)} J/(kg·K)`,
      `ΔT = ${formatEngineeringNumber(dT_K, 2)} K`,
      `Q = ${formatEngineeringNumber(m_kg, 4)} · ${formatEngineeringNumber(cp_JkgK, 1)} · ${formatEngineeringNumber(dT_K, 2)} = ${formatEngineeringNumber(Q_SI, 1)} ${isRate ? 'W' : 'J'} (${valLabel} ${unitLabel})`
    ],
    results: {
      duty_J: Q_SI,
      duty_kJ: Q_kJ,
      duty_MJ: Q_MJ,
      power_W: isRate ? Q_SI : null,
      power_kW: isRate ? Q_kW : null,
      power_MW: isRate ? Q_MW : null,
      energy_Btu: Q_Btu,
      isContinuousRate: isRate
    },
    assumptions: [
      'Constant specific heat capacity Cp over the specified temperature range.',
      'Single-phase sensible heating/cooling (no phase change/vaporization).'
    ]
  };
}

/**
 * 2. Log Mean Temperature Difference (LMTD)
 * Formula: LMTD = (ΔT1 - ΔT2) / ln(ΔT1 / ΔT2)
 */
export function calcLMTD({
  tHotIn,
  tHotOut,
  tColdIn,
  tColdOut,
  flowArrangement = 'counter', // 'counter' or 'co-current' / 'parallel'
  tempUnit = 'C'
}) {
  const Thi = Number(tHotIn);
  const Tho = Number(tHotOut);
  const Tci = Number(tColdIn);
  const Tco = Number(tColdOut);

  if (isNaN(Thi) || isNaN(Tho) || isNaN(Tci) || isNaN(Tco)) {
    throw new Error('All 4 terminal temperatures (tHotIn, tHotOut, tColdIn, tColdOut) are required.');
  }

  const flowStr = String(flowArrangement || 'counter').toLowerCase().trim();
  const isCoCurrent = flowStr.includes('co-current') || flowStr.includes('cocurrent') || flowStr.includes('parallel');
  const isCounter = !isCoCurrent;

  let dT1 = 0;
  let dT2 = 0;

  if (isCounter) {
    // Counter-flow: Hot In meets Cold Out, Hot Out meets Cold In
    dT1 = Thi - Tco;
    dT2 = Tho - Tci;
  } else {
    // Parallel/Co-current: Hot In meets Cold In, Hot Out meets Cold Out
    dT1 = Thi - Tci;
    dT2 = Tho - Tco;
  }

  if (dT1 <= 0 || dT2 <= 0) {
    throw new Error(`Temperature crossover detected! In a physical heat exchanger, terminal ΔT must be strictly positive (ΔT1=${formatEngineeringNumber(dT1, 1)}, ΔT2=${formatEngineeringNumber(dT2, 1)}).`);
  }

  let lmtd = 0;
  if (Math.abs(dT1 - dT2) < 1e-4) {
    lmtd = dT1; // When ΔT1 ≈ ΔT2, LMTD = ΔT1
  } else {
    lmtd = (dT1 - dT2) / Math.log(dT1 / dT2);
  }

  return {
    success: true,
    toolName: 'calcLMTD',
    category: 'Heat Transfer / Heat Exchangers',
    summary: `Log Mean Temperature Difference (LMTD) for ${isCounter ? 'counter-flow' : 'co-current flow'} is ${formatEngineeringNumber(lmtd, 2)} °${tempUnit}.`,
    inputs: {
      tHotIn: `${Thi} °${tempUnit}`,
      tHotOut: `${Tho} °${tempUnit}`,
      tColdIn: `${Tci} °${tempUnit}`,
      tColdOut: `${Tco} °${tempUnit}`,
      flowArrangement: isCounter ? 'Counter-Current' : 'Co-Current'
    },
    equations: [
      isCounter ? 'Counter-flow: ΔT₁ = T_h,in - T_c,out,  ΔT₂ = T_h,out - T_c,in' : 'Co-current: ΔT₁ = T_h,in - T_c,in,  ΔT₂ = T_h,out - T_c,out',
      'LMTD = (ΔT₁ - ΔT₂) / ln(ΔT₁ / ΔT₂)'
    ],
    substitutions: [
      `ΔT₁ = ${formatEngineeringNumber(dT1, 2)} °${tempUnit},  ΔT₂ = ${formatEngineeringNumber(dT2, 2)} °${tempUnit}`,
      `LMTD = (${formatEngineeringNumber(dT1, 2)} - ${formatEngineeringNumber(dT2, 2)}) / ln(${formatEngineeringNumber(dT1, 2)} / ${formatEngineeringNumber(dT2, 2)}) = ${formatEngineeringNumber(lmtd, 2)} °${tempUnit}`
    ],
    results: {
      lmtd,
      deltaT1: dT1,
      deltaT2: dT2,
      flowArrangement: isCounter ? 'counter-flow' : 'co-current'
    },
    assumptions: [
      'Steady-state heat exchange with constant overall heat transfer coefficient U.',
      'No ambient heat losses from the exchanger outer shell.'
    ]
  };
}

/**
 * 3. Heat Exchanger Duty & Area Sizing
 * Formula: Q = U * A * F * LMTD  <=>  A = Q / (U * F * LMTD)
 */
export function calcHeatExchangerSizing({
  duty = null, // kW or W
  dutyUnit = 'kW',
  overallU = null, // W/(m²·K)
  overallUUnit = 'W/(m2.K)',
  area = null, // m²
  areaUnit = 'm2',
  lmtd,
  lmtdUnit = 'C',
  fFactor = 1.0 // Configuration correction factor (F >= 0.75 recommended)
}) {
  const dT_lm = convertDeltaTemperature(lmtd, lmtdUnit, 'k');
  const F = Number(fFactor) || 1.0;

  if (F <= 0 || F > 1.0) throw new Error('Correction factor F must be between 0.0 and 1.0.');
  if (dT_lm <= 0) throw new Error('LMTD must be strictly positive.');

  const U_SI = overallU !== null ? convertUnit(overallU, overallUUnit, 'w', 'power') : null;

  // Case A: Calculate Area from Duty and U
  if (duty !== null && overallU !== null) {
    const Q_W = convertUnit(duty, dutyUnit, 'w', 'power');
    const calculatedArea_m2 = Q_W / (U_SI * F * dT_lm);
    const calculatedArea_ft2 = calculatedArea_m2 * 10.7639;

    return {
      success: true,
      toolName: 'calcHeatExchangerSizing',
      category: 'Heat Transfer / Sizing',
      summary: `Required heat transfer area is ${formatEngineeringNumber(calculatedArea_m2, 2)} m² (${formatEngineeringNumber(calculatedArea_ft2, 1)} ft²) for ${duty} ${dutyUnit} duty at U = ${overallU} ${overallUUnit}.`,
      inputs: {
        duty: `${duty} ${dutyUnit} (${formatEngineeringNumber(Q_W, 0)} W)`,
        overallU: `${overallU} ${overallUUnit}`,
        lmtd: `${lmtd} °${lmtdUnit}`,
        fFactor: F
      },
      equations: [
        'A = Q / (U · F · LMTD)'
      ],
      substitutions: [
        `A = ${formatEngineeringNumber(Q_W, 0)} W / (${formatEngineeringNumber(U_SI, 1)} W/(m²·K) · ${F} · ${formatEngineeringNumber(dT_lm, 2)} K) = ${formatEngineeringNumber(calculatedArea_m2, 2)} m²`
      ],
      results: {
        area_m2: calculatedArea_m2,
        area_ft2: calculatedArea_ft2,
        duty_kW: Q_W / 1000.0,
        overallU_SI: U_SI
      },
      assumptions: [
        'Uniform overall heat transfer coefficient U over entire surface area.',
        'Clean/steady design conditions.'
      ]
    };
  }

  // Case B: Calculate Duty from Area and U
  if (area !== null && overallU !== null) {
    const A_m2 = convertUnit(area, areaUnit, 'm2', 'area');
    const calculatedDuty_W = U_SI * A_m2 * F * dT_lm;
    const calculatedDuty_kW = calculatedDuty_W / 1000.0;
    const calculatedDuty_MW = calculatedDuty_W / 1e6;

    return {
      success: true,
      toolName: 'calcHeatExchangerSizing',
      category: 'Heat Transfer / Rating',
      summary: `Heat transfer duty is ${formatEngineeringNumber(calculatedDuty_kW, 2)} kW (${formatEngineeringNumber(calculatedDuty_MW, 3)} MW) for area = ${area} ${areaUnit} at U = ${overallU} ${overallUUnit}.`,
      inputs: {
        area: `${area} ${areaUnit}`,
        overallU: `${overallU} ${overallUUnit}`,
        lmtd: `${lmtd} °${lmtdUnit}`,
        fFactor: F
      },
      equations: [
        'Q = U · A · F · LMTD'
      ],
      substitutions: [
        `Q = ${formatEngineeringNumber(U_SI, 1)} · ${formatEngineeringNumber(A_m2, 2)} · ${F} · ${formatEngineeringNumber(dT_lm, 2)} = ${formatEngineeringNumber(calculatedDuty_W, 0)} W (${formatEngineeringNumber(calculatedDuty_kW, 2)} kW)`
      ],
      results: {
        duty_W: calculatedDuty_W,
        duty_kW: calculatedDuty_kW,
        duty_MW: calculatedDuty_MW,
        area_m2: A_m2
      },
      assumptions: [
        'Negligible fouling resistance unless pre-factored into U.'
      ]
    };
  }

  throw new Error('Provide (duty and overallU) to calculate Area, or (area and overallU) to calculate Duty.');
}

/**
 * 4. 1D Steady-State Conduction Heat Transfer (Fourier's Law)
 * Formula: Q = k * A * ΔT / L
 */
export function calcConductionHeat({
  thermalConductivity, // k in W/(m·K)
  area,
  areaUnit = 'm2',
  thickness,
  thicknessUnit = 'mm',
  deltaT,
  deltaTUnit = 'C'
}) {
  const k = Number(thermalConductivity);
  const A_m2 = convertUnit(area, areaUnit, 'm2', 'area');
  const L_m = convertUnit(thickness, thicknessUnit, 'm', 'length');
  const dT_K = convertDeltaTemperature(deltaT, deltaTUnit, 'k');

  if (k <= 0 || A_m2 <= 0 || L_m <= 0) {
    throw new Error('Thermal conductivity, area, and thickness must be strictly positive.');
  }

  const Q_W = (k * A_m2 * dT_K) / L_m;
  const Q_kW = Q_W / 1000.0;
  const thermalResistance_KW = L_m / (k * A_m2);

  return {
    success: true,
    toolName: 'calcConductionHeat',
    category: 'Heat Transfer / Conduction',
    summary: `Conduction heat transfer rate is ${formatEngineeringNumber(Q_kW, 3)} kW (${formatEngineeringNumber(Q_W, 1)} W). Thermal resistance R = ${formatEngineeringNumber(thermalResistance_KW, 4)} K/W.`,
    inputs: {
      thermalConductivity: `${k} W/(m·K)`,
      area: `${area} ${areaUnit}`,
      thickness: `${thickness} ${thicknessUnit}`,
      deltaT: `${deltaT} °${deltaTUnit}`
    },
    equations: [
      'Q = (k · A · ΔT) / L',
      'R_thermal = L / (k · A)'
    ],
    substitutions: [
      `Q = (${k} W/(m·K) · ${formatEngineeringNumber(A_m2, 3)} m² · ${formatEngineeringNumber(dT_K, 2)} K) / ${formatEngineeringNumber(L_m, 4)} m = ${formatEngineeringNumber(Q_W, 1)} W`
    ],
    results: {
      heatRate_W: Q_W,
      heatRate_kW: Q_kW,
      thermalResistance_KW: thermalResistance_KW
    },
    assumptions: [
      'One-dimensional steady-state conduction through homogeneous planar slab.',
      'Constant material thermal conductivity.'
    ]
  };
}
