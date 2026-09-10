/**
 * ChemDiag Engineering Calculation Library — Fluid Mechanics
 * 
 * Deterministic mathematical calculations for fluid flow, hydraulics,
 * pipe networks, pumps, and fluid machinery.
 */

import { convertUnit, formatEngineeringNumber } from './units.js';

const G = 9.80665; // Standard acceleration due to gravity (m/s²)
const PI = Math.PI;

/**
 * 1. Flow Velocity in a Circular Pipe
 * Formula: A = π * D² / 4, v = Q / A
 */
export function calcPipeVelocity({
  flowRate,
  flowUnit = 'm3/h',
  diameter,
  diameterUnit = 'mm'
}) {
  const Q_m3s = convertUnit(flowRate, flowUnit, 'm3/s', 'volumetric_flow');
  const D_m = convertUnit(diameter, diameterUnit, 'm', 'length');

  if (D_m <= 0) throw new Error('Pipe diameter must be greater than zero.');
  if (Q_m3s < 0) throw new Error('Flow rate cannot be negative.');

  const area_m2 = (PI * D_m * D_m) / 4.0;
  const velocity_ms = Q_m3s / area_m2;
  const velocity_fts = velocity_ms * 3.28084;

  return {
    success: true,
    toolName: 'calcPipeVelocity',
    category: 'Fluid Mechanics',
    summary: `Flow velocity in ${diameter} ${diameterUnit} pipe at ${flowRate} ${flowUnit} is ${formatEngineeringNumber(velocity_ms, 3)} m/s (${formatEngineeringNumber(velocity_fts, 2)} ft/s).`,
    inputs: {
      flowRate: { value: flowRate, unit: flowUnit, siValue: Q_m3s, siUnit: 'm³/s' },
      diameter: { value: diameter, unit: diameterUnit, siValue: D_m, siUnit: 'm' }
    },
    equations: [
      'A = π · D² / 4',
      'v = Q / A'
    ],
    substitutions: [
      `D = ${diameter} ${diameterUnit} = ${formatEngineeringNumber(D_m, 4)} m`,
      `Q = ${flowRate} ${flowUnit} = ${formatEngineeringNumber(Q_m3s, 6)} m³/s`,
      `A = π · (${formatEngineeringNumber(D_m, 4)})² / 4 = ${formatEngineeringNumber(area_m2, 6)} m²`,
      `v = ${formatEngineeringNumber(Q_m3s, 6)} / ${formatEngineeringNumber(area_m2, 6)} = ${formatEngineeringNumber(velocity_ms, 3)} m/s`
    ],
    results: {
      velocity_ms,
      velocity_fts,
      area_m2,
      area_mm2: area_m2 * 1e6
    },
    assumptions: [
      'Circular cross-section pipe fully running with liquid/gas.',
      'Steady-state incompressible single-phase flow velocity profile averaged over cross-section.'
    ]
  };
}

/**
 * 2. Reynolds Number & Flow Regime
 * Formula: Re = ρ * v * D / μ = v * D / ν
 */
export function calcReynoldsNumber({
  velocity,
  velocityUnit = 'm/s',
  diameter,
  diameterUnit = 'mm',
  density = 1000,
  densityUnit = 'kg/m3',
  viscosity = 0.001, // 1 cP for water at 20°C
  viscosityUnit = 'Pa.s'
}) {
  const v_ms = convertUnit(velocity, velocityUnit, 'm/s');
  const D_m = convertUnit(diameter, diameterUnit, 'm', 'length');
  const rho_kgm3 = convertUnit(density, densityUnit, 'kg/m3', 'density');
  const mu_Pas = convertUnit(viscosity, viscosityUnit, 'Pa.s', 'dynamic_viscosity');

  if (D_m <= 0 || rho_kgm3 <= 0 || mu_Pas <= 0) {
    throw new Error('Diameter, density, and viscosity must all be strictly positive values.');
  }

  const reynolds = (rho_kgm3 * v_ms * D_m) / mu_Pas;

  let regime = 'Laminar (Re < 2300)';
  if (reynolds >= 2300 && reynolds <= 4000) {
    regime = 'Transition Region (2300 ≤ Re ≤ 4000)';
  } else if (reynolds > 4000) {
    regime = 'Turbulent (Re > 4000)';
  }

  return {
    success: true,
    toolName: 'calcReynoldsNumber',
    category: 'Fluid Mechanics',
    summary: `Reynolds Number Re = ${formatEngineeringNumber(reynolds, 0)} (${regime}).`,
    inputs: {
      velocity: { value: velocity, unit: velocityUnit, siValue: v_ms, siUnit: 'm/s' },
      diameter: { value: diameter, unit: diameterUnit, siValue: D_m, siUnit: 'm' },
      density: { value: density, unit: densityUnit, siValue: rho_kgm3, siUnit: 'kg/m³' },
      viscosity: { value: viscosity, unit: viscosityUnit, siValue: mu_Pas, siUnit: 'Pa·s' }
    },
    equations: [
      'Re = (ρ · v · D) / μ'
    ],
    substitutions: [
      `Re = (${formatEngineeringNumber(rho_kgm3, 1)} kg/m³ · ${formatEngineeringNumber(v_ms, 3)} m/s · ${formatEngineeringNumber(D_m, 4)} m) / (${formatEngineeringNumber(mu_Pas, 6)} Pa·s)`,
      `Re = ${formatEngineeringNumber(reynolds, 1)}`
    ],
    results: {
      reynolds,
      regime,
      isTurbulent: reynolds > 4000,
      isLaminar: reynolds < 2300
    },
    assumptions: [
      'Newtonian fluid behavior with constant dynamic viscosity.',
      'Fully developed velocity profile in straight circular conduit.'
    ]
  };
}

/**
 * 3. Darcy-Weisbach Friction Factor & Pressure Drop
 * Formula: ΔP = f * (L/D) * (ρ * v² / 2), h_f = ΔP / (ρ * g)
 * Friction factor via Haaland equation for turbulent, 64/Re for laminar.
 */
export function calcDarcyWeisbachPressureDrop({
  flowRate,
  flowUnit = 'm3/h',
  diameter,
  diameterUnit = 'mm',
  length,
  lengthUnit = 'm',
  roughness = 0.045, // Commercial steel ε ≈ 0.045 mm
  roughnessUnit = 'mm',
  density = 1000,
  densityUnit = 'kg/m3',
  viscosity = 0.001,
  viscosityUnit = 'Pa.s'
}) {
  const Q_m3s = convertUnit(flowRate, flowUnit, 'm3/s', 'volumetric_flow');
  const D_m = convertUnit(diameter, diameterUnit, 'm', 'length');
  const L_m = convertUnit(length, lengthUnit, 'm', 'length');
  const eps_m = convertUnit(roughness, roughnessUnit, 'm', 'length');
  const rho_kgm3 = convertUnit(density, densityUnit, 'kg/m3', 'density');
  const mu_Pas = convertUnit(viscosity, viscosityUnit, 'Pa.s', 'dynamic_viscosity');

  const area_m2 = (PI * D_m * D_m) / 4.0;
  const v_ms = Q_m3s / area_m2;
  const re = (rho_kgm3 * v_ms * D_m) / mu_Pas;

  let f = 0.02;
  let method = '';
  if (re < 2300) {
    f = 64.0 / Math.max(re, 1);
    method = 'Laminar (f = 64 / Re)';
  } else {
    // Haaland explicit approximation to Colebrook-White
    const relRoughness = eps_m / D_m;
    const term = Math.pow(relRoughness / 3.7, 1.11) + 6.9 / re;
    const invSqrtF = -1.8 * Math.log10(term);
    f = 1.0 / (invSqrtF * invSqrtF);
    method = 'Turbulent Haaland / Colebrook-White equation';
  }

  // Pressure drop (Pa)
  const deltaP_Pa = f * (L_m / D_m) * (rho_kgm3 * v_ms * v_ms / 2.0);
  const deltaP_bar = deltaP_Pa / 100000.0;
  const deltaP_kPa = deltaP_Pa / 1000.0;
  const deltaP_psi = deltaP_Pa / 6894.757;
  const headLoss_m = deltaP_Pa / (rho_kgm3 * G);

  return {
    success: true,
    toolName: 'calcDarcyWeisbachPressureDrop',
    category: 'Fluid Mechanics',
    summary: `Pressure drop across ${length} ${lengthUnit} of ${diameter} ${diameterUnit} pipe is ${formatEngineeringNumber(deltaP_kPa, 2)} kPa (${formatEngineeringNumber(deltaP_bar, 3)} bar, ${formatEngineeringNumber(headLoss_m, 2)} m head loss).`,
    inputs: {
      flowRate: { value: flowRate, unit: flowUnit },
      diameter: { value: diameter, unit: diameterUnit },
      length: { value: length, unit: lengthUnit },
      velocity: { value: v_ms, unit: 'm/s' },
      reynolds: { value: re, unit: 'dimensionless' },
      density: { value: rho_kgm3, unit: 'kg/m³' }
    },
    equations: [
      'Re = (ρ · v · D) / μ',
      'f = 64/Re (laminar) or 1/√f = -1.8 log₁₀[(ε/D/3.7)¹·¹¹ + 6.9/Re] (Haaland)',
      'ΔP = f · (L / D) · (ρ · v² / 2)',
      'h_f = ΔP / (ρ · g)'
    ],
    substitutions: [
      `Velocity v = ${formatEngineeringNumber(v_ms, 3)} m/s, Reynolds Re = ${formatEngineeringNumber(re, 0)}`,
      `Darcy friction factor f = ${formatEngineeringNumber(f, 4)} (${method})`,
      `ΔP = ${formatEngineeringNumber(f, 4)} · (${formatEngineeringNumber(L_m, 2)} / ${formatEngineeringNumber(D_m, 4)}) · (${formatEngineeringNumber(rho_kgm3, 0)} · ${formatEngineeringNumber(v_ms, 3)}² / 2) = ${formatEngineeringNumber(deltaP_Pa, 1)} Pa`
    ],
    results: {
      frictionFactor: f,
      reynolds: re,
      velocity_ms: v_ms,
      deltaP_Pa,
      deltaP_kPa,
      deltaP_bar,
      deltaP_psi,
      headLoss_m
    },
    assumptions: [
      'Steady, fully developed single-phase liquid/gas pipe flow.',
      'Minor fitting losses (valves, elbows) are not included unless added to equivalent length.'
    ]
  };
}

/**
 * 4. Hydraulic Power & Pump Shaft Power
 * Formula: P_hyd = ρ * g * Q * H = Q * ΔP, P_shaft = P_hyd / η
 */
export function calcPumpHydraulicPower({
  flowRate,
  flowUnit = 'L/s',
  head = null,
  headUnit = 'm',
  deltaP = null,
  deltaPUnit = 'bar',
  density = 1000,
  densityUnit = 'kg/m3',
  efficiency = 0.75 // 75% mechanical/hydraulic efficiency
}) {
  const Q_m3s = convertUnit(flowRate, flowUnit, 'm3/s', 'volumetric_flow');
  const rho_kgm3 = convertUnit(density, densityUnit, 'kg/m3', 'density');
  const eff = efficiency > 1.0 ? efficiency / 100.0 : efficiency;

  if (eff <= 0 || eff > 1.0) throw new Error('Pump efficiency must be between 0 and 1.0 (or 0% to 100%).');

  let head_m = 0;
  let deltaP_Pa = 0;

  if (head !== null && head !== undefined) {
    head_m = convertUnit(head, headUnit, 'm', 'length');
    deltaP_Pa = rho_kgm3 * G * head_m;
  } else if (deltaP !== null && deltaP !== undefined) {
    deltaP_Pa = convertUnit(deltaP, deltaPUnit, 'pa', 'pressure');
    head_m = deltaP_Pa / (rho_kgm3 * G);
  } else {
    throw new Error('Either total head (e.g. 20 m) or differential pressure (e.g. 2 bar) must be provided.');
  }

  // Hydraulic power (W)
  const powerHyd_W = Q_m3s * deltaP_Pa;
  const powerHyd_kW = powerHyd_W / 1000.0;
  const powerHyd_hp = powerHyd_W / 745.7;

  // Shaft mechanical power (W)
  const powerShaft_W = powerHyd_W / eff;
  const powerShaft_kW = powerShaft_W / 1000.0;
  const powerShaft_hp = powerShaft_W / 745.7;

  return {
    success: true,
    toolName: 'calcPumpHydraulicPower',
    category: 'Fluid Mechanics / Pumps',
    summary: `Hydraulic power is ${formatEngineeringNumber(powerHyd_kW, 3)} kW (${formatEngineeringNumber(powerHyd_hp, 2)} hp). At ${Math.round(eff * 100)}% efficiency, required pump shaft power is ${formatEngineeringNumber(powerShaft_kW, 3)} kW (${formatEngineeringNumber(powerShaft_hp, 2)} hp).`,
    inputs: {
      flowRate: { value: flowRate, unit: flowUnit, siValue: Q_m3s, siUnit: 'm³/s' },
      head: { value: head_m, unit: 'm', deltaP_bar: deltaP_Pa / 100000.0 },
      density: { value: rho_kgm3, unit: 'kg/m³' },
      efficiency: { value: eff * 100, unit: '%' }
    },
    equations: [
      'P_hyd = ρ · g · Q · H = Q · ΔP',
      'P_shaft = P_hyd / η'
    ],
    substitutions: [
      `Q = ${flowRate} ${flowUnit} = ${formatEngineeringNumber(Q_m3s, 5)} m³/s`,
      `Head H = ${formatEngineeringNumber(head_m, 2)} m (ΔP = ${formatEngineeringNumber(deltaP_Pa / 1000.0, 2)} kPa)`,
      `P_hyd = ${formatEngineeringNumber(rho_kgm3, 0)} kg/m³ · 9.81 m/s² · ${formatEngineeringNumber(Q_m3s, 5)} m³/s · ${formatEngineeringNumber(head_m, 2)} m = ${formatEngineeringNumber(powerHyd_W, 1)} W (${formatEngineeringNumber(powerHyd_kW, 3)} kW)`,
      `P_shaft = ${formatEngineeringNumber(powerHyd_kW, 3)} kW / ${eff} = ${formatEngineeringNumber(powerShaft_kW, 3)} kW`
    ],
    results: {
      hydraulicPower_W: powerHyd_W,
      hydraulicPower_kW: powerHyd_kW,
      hydraulicPower_hp: powerHyd_hp,
      shaftPower_W: powerShaft_W,
      shaftPower_kW: powerShaft_kW,
      shaftPower_hp: powerShaft_hp,
      head_m,
      deltaP_bar: deltaP_Pa / 100000.0,
      deltaP_kPa: deltaP_Pa / 1000.0
    },
    assumptions: [
      'Incompressible single-phase liquid pump operating at specified head and flow coordinate.',
      'Motor efficiency and variable frequency drive losses not included in shaft power.'
    ]
  };
}

/**
 * 5. Net Positive Suction Head Available (NPSHa) & Cavitation Margin
 * Formula: NPSHa = (P_suction_abs - P_vap) / (ρ * g) + z_static - h_friction
 */
export function calcNPSHAvailable({
  suctionPressure, // Gauge or Absolute
  suctionPressureUnit = 'bar',
  isGauge = true,
  atmosphericPressure = 1.01325,
  atmosphericPressureUnit = 'bar',
  vaporPressure = 0.0317, // ~31.7 mbar for water at 25°C
  vaporPressureUnit = 'bar',
  staticLiquidHead = 0.0, // Height of liquid level above pump center line (m)
  frictionHeadLoss = 0.0, // Friction loss in suction piping (m)
  npshRequired = null,    // NPSHr from pump curve
  density = 1000,
  densityUnit = 'kg/m3'
}) {
  const p_suct_raw = convertUnit(suctionPressure, suctionPressureUnit, 'pa', 'pressure');
  const p_atm_pa = convertUnit(atmosphericPressure, atmosphericPressureUnit, 'pa', 'pressure');
  const p_vap_pa = convertUnit(vaporPressure, vaporPressureUnit, 'pa', 'pressure');
  const rho_kgm3 = convertUnit(density, densityUnit, 'kg/m3', 'density');

  const p_suct_abs_pa = isGauge ? (p_suct_raw + p_atm_pa) : p_suct_raw;

  const pressureHead_m = (p_suct_abs_pa - p_vap_pa) / (rho_kgm3 * G);
  const npsha_m = pressureHead_m + staticLiquidHead - frictionHeadLoss;

  let cavitationMargin_m = null;
  let isCavitationSafe = null;
  if (npshRequired !== null && npshRequired !== undefined) {
    cavitationMargin_m = npsha_m - Number(npshRequired);
    isCavitationSafe = cavitationMargin_m >= 0.5; // Standard 0.5m - 1.0m safety margin
  }

  return {
    success: true,
    toolName: 'calcNPSHAvailable',
    category: 'Fluid Mechanics / Pumps',
    summary: `NPSHa = ${formatEngineeringNumber(npsha_m, 2)} m.${npshRequired !== null ? ` With NPSHr = ${npshRequired} m, cavitation margin is ${formatEngineeringNumber(cavitationMargin_m, 2)} m (${isCavitationSafe ? '✓ SAFE' : '⚠ RISK OF CAVITATION'}).` : ''}`,
    inputs: {
      suctionPressure_abs: { value: p_suct_abs_pa / 100000.0, unit: 'bar abs' },
      vaporPressure: { value: p_vap_pa / 100000.0, unit: 'bar abs' },
      staticLiquidHead_m: staticLiquidHead,
      frictionHeadLoss_m: frictionHeadLoss,
      npshRequired_m: npshRequired
    },
    equations: [
      'NPSHa = (P_suction,abs - P_vap) / (ρ · g) + z_static - h_friction',
      'Cavitation Margin = NPSHa - NPSHr'
    ],
    substitutions: [
      `P_suct,abs = ${formatEngineeringNumber(p_suct_abs_pa / 1000.0, 1)} kPa abs, P_vap = ${formatEngineeringNumber(p_vap_pa / 1000.0, 2)} kPa`,
      `Pressure Head = (${formatEngineeringNumber(p_suct_abs_pa, 0)} - ${formatEngineeringNumber(p_vap_pa, 0)}) / (${formatEngineeringNumber(rho_kgm3, 0)} · 9.81) = ${formatEngineeringNumber(pressureHead_m, 2)} m`,
      `NPSHa = ${formatEngineeringNumber(pressureHead_m, 2)} + ${staticLiquidHead} - ${frictionHeadLoss} = ${formatEngineeringNumber(npsha_m, 2)} m`
    ],
    results: {
      npsha_m,
      npsha_ft: npsha_m * 3.28084,
      cavitationMargin_m,
      isCavitationSafe
    },
    assumptions: [
      'Standard gravitational acceleration g = 9.81 m/s².',
      'Suction line velocity head assumed negligible or embedded in static measurement.'
    ]
  };
}

/**
 * 6. Pipe Sizing from Target Velocity
 * Formula: D = sqrt(4 * Q / (π * v_target))
 */
export function calcPipeSizing({
  flowRate,
  flowUnit = 'm3/h',
  targetVelocity = 1.5, // Standard liquid line velocity 1.0 to 2.5 m/s
  targetVelocityUnit = 'm/s'
}) {
  const Q_m3s = convertUnit(flowRate, flowUnit, 'm3/s', 'volumetric_flow');
  const v_ms = convertUnit(targetVelocity, targetVelocityUnit, 'm/s');

  if (v_ms <= 0) throw new Error('Target velocity must be strictly positive.');

  const requiredArea_m2 = Q_m3s / v_ms;
  const innerDiameter_m = Math.sqrt((4.0 * requiredArea_m2) / PI);
  const innerDiameter_mm = innerDiameter_m * 1000.0;
  const innerDiameter_in = innerDiameter_m / 0.0254;

  // Standard nominal pipe sizes (NPS in inches with approximate inner diameters in mm for Sch 40)
  const STANDARD_PIPES = [
    { nps: '1/2"', id_mm: 15.8 },
    { nps: '3/4"', id_mm: 20.9 },
    { nps: '1"', id_mm: 26.6 },
    { nps: '1-1/4"', id_mm: 35.1 },
    { nps: '1-1/2"', id_mm: 40.9 },
    { nps: '2"', id_mm: 52.5 },
    { nps: '2-1/2"', id_mm: 62.7 },
    { nps: '3"', id_mm: 77.9 },
    { nps: '4"', id_mm: 102.3 },
    { nps: '6"', id_mm: 154.1 },
    { nps: '8"', id_mm: 202.7 },
    { nps: '10"', id_mm: 254.5 },
    { nps: '12"', id_mm: 304.8 }
  ];

  let recommendedPipe = STANDARD_PIPES[STANDARD_PIPES.length - 1];
  for (const pipe of STANDARD_PIPES) {
    if (pipe.id_mm >= innerDiameter_mm) {
      recommendedPipe = pipe;
      break;
    }
  }

  const actualVelocity_ms = Q_m3s / ((PI * Math.pow(recommendedPipe.id_mm / 1000.0, 2)) / 4.0);

  return {
    success: true,
    toolName: 'calcPipeSizing',
    category: 'Fluid Mechanics / Piping',
    summary: `For ${flowRate} ${flowUnit} at target velocity ${targetVelocity} ${targetVelocityUnit}, theoretical ID is ${formatEngineeringNumber(innerDiameter_mm, 1)} mm (${formatEngineeringNumber(innerDiameter_in, 2)} in). Recommended standard pipe: ${recommendedPipe.nps} Sch 40 (Actual v = ${formatEngineeringNumber(actualVelocity_ms, 2)} m/s).`,
    inputs: {
      flowRate: { value: flowRate, unit: flowUnit, siValue: Q_m3s, siUnit: 'm³/s' },
      targetVelocity: { value: targetVelocity, unit: targetVelocityUnit }
    },
    equations: [
      'A = Q / v_target',
      'D = √(4 · A / π)'
    ],
    substitutions: [
      `A = ${formatEngineeringNumber(Q_m3s, 5)} / ${v_ms} = ${formatEngineeringNumber(requiredArea_m2, 6)} m²`,
      `D = √(4 · ${formatEngineeringNumber(requiredArea_m2, 6)} / π) = ${formatEngineeringNumber(innerDiameter_m, 4)} m = ${formatEngineeringNumber(innerDiameter_mm, 1)} mm`
    ],
    results: {
      calculatedInnerDiameter_mm: innerDiameter_mm,
      calculatedInnerDiameter_in: innerDiameter_in,
      recommendedStandardNPS: recommendedPipe.nps,
      recommendedStandardID_mm: recommendedPipe.id_mm,
      actualVelocity_ms: actualVelocity_ms
    },
    assumptions: [
      'Standard Schedule 40 carbon steel pipe dimensions.',
      'Sizing criterion based on typical recommended liquid line velocities (1.0 to 2.5 m/s).'
    ]
  };
}
