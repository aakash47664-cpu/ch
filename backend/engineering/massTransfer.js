/**
 * ChemDiag Engineering Calculation Library — Mass Transfer & Separations
 * 
 * Deterministic mathematical calculations for distillation, diffusion,
 * minimum reflux ratio, and theoretical stage requirements (Fenske, McCabe-Thiele).
 */

import { formatEngineeringNumber } from './units.js';

/**
 * 1. Fenske Equation for Minimum Theoretical Stages in Distillation
 * Formula: N_min = ln( (x_D / (1 - x_D)) * ((1 - x_B) / x_B) ) / ln(α_avg)
 */
export function calcFenskeMinimumStages({
  distillatePurity, // xD (e.g. 0.95 for 95 mol% light key)
  bottomsPurity, // xB (e.g. 0.05 for 5 mol% light key in bottoms)
  relativeVolatility // α (average relative volatility between key components)
}) {
  const xD = Number(distillatePurity);
  const xB = Number(bottomsPurity);
  const alpha = Number(relativeVolatility);

  if (xD <= 0 || xD >= 1.0 || xB <= 0 || xB >= 1.0 || xD <= xB) {
    throw new Error('Distillate purity xD must be strictly greater than bottoms purity xB, and both must be between 0 and 1.0.');
  }
  if (alpha <= 1.0) {
    throw new Error('Relative volatility α must be strictly greater than 1.0 for feasible distillation separation.');
  }

  const separationFactor = (xD / (1.0 - xD)) * ((1.0 - xB) / xB);
  const nMin = Math.log(separationFactor) / Math.log(alpha);

  return {
    success: true,
    toolName: 'calcFenskeMinimumStages',
    category: 'Mass Transfer / Distillation',
    summary: `Minimum equilibrium stages required at total reflux (N_min) is ${formatEngineeringNumber(nMin, 2)} theoretical stages (${Math.ceil(nMin)} integer stages including reboiler) for α = ${alpha}.`,
    inputs: {
      distillateMoleFraction_xD: xD,
      bottomsMoleFraction_xB: xB,
      relativeVolatility_alpha: alpha
    },
    equations: [
      'N_min = ln[ (x_D / (1 - x_D)) · ((1 - x_B) / x_B) ] / ln(α)'
    ],
    substitutions: [
      `Separation factor = (${xD} / ${formatEngineeringNumber(1 - xD, 3)}) · (${formatEngineeringNumber(1 - xB, 3)} / ${xB}) = ${formatEngineeringNumber(separationFactor, 2)}`,
      `N_min = ln(${formatEngineeringNumber(separationFactor, 2)}) / ln(${alpha}) = ${formatEngineeringNumber(Math.log(separationFactor), 4)} / ${formatEngineeringNumber(Math.log(alpha), 4)} = ${formatEngineeringNumber(nMin, 2)}`
    ],
    results: {
      minStages: nMin,
      minStagesCeil: Math.ceil(nMin),
      separationFactor
    },
    assumptions: [
      'Total reflux operation (R = ∞).',
      'Constant relative volatility α across all column trays.',
      'Binary or pseudo-binary light/heavy key component system.'
    ]
  };
}

/**
 * 2. Binary Distillation Minimum Reflux Ratio (Underwood / Saturated Liquid Feed)
 * Formula: R_min = (1 / (α - 1)) * [ (x_D / x_F) - α * ((1 - x_D) / (1 - x_F)) ]
 */
export function calcBinaryMinReflux({
  feedMoleFraction, // zF / xF
  distillateMoleFraction, // xD
  relativeVolatility // α
}) {
  const xF = Number(feedMoleFraction);
  const xD = Number(distillateMoleFraction);
  const alpha = Number(relativeVolatility);

  if (xF <= 0 || xF >= 1.0 || xD <= xF || xD >= 1.0) {
    throw new Error('Distillate purity xD must be greater than feed composition xF (both between 0 and 1.0).');
  }
  if (alpha <= 1.0) throw new Error('Relative volatility α must be greater than 1.0.');

  const term1 = xD / xF;
  const term2 = alpha * ((1.0 - xD) / (1.0 - xF));
  const rMin = (1.0 / (alpha - 1.0)) * (term1 - term2);
  const rOperatingTypical = rMin * 1.3; // Typical 1.2x - 1.5x R_min rule of thumb

  return {
    success: true,
    toolName: 'calcBinaryMinReflux',
    category: 'Mass Transfer / Distillation',
    summary: `Minimum Reflux Ratio R_min = ${formatEngineeringNumber(rMin, 3)} L/D (at pinch point with infinite trays). Recommended operating reflux (1.3 · R_min) is ${formatEngineeringNumber(rOperatingTypical, 2)} L/D.`,
    inputs: {
      feedMoleFraction_xF: xF,
      distillateMoleFraction_xD: xD,
      relativeVolatility_alpha: alpha
    },
    equations: [
      'R_min = [1 / (α - 1)] · [ (x_D / x_F) - α · (1 - x_D) / (1 - x_F) ]',
      'R_operating ≈ 1.2 to 1.5 · R_min'
    ],
    substitutions: [
      `R_min = [1 / (${alpha} - 1)] · [ (${xD} / ${xF}) - ${alpha} · (${formatEngineeringNumber(1 - xD, 3)} / ${formatEngineeringNumber(1 - xF, 3)}) ] = ${formatEngineeringNumber(rMin, 3)}`
    ],
    results: {
      minRefluxRatio: rMin,
      typicalOperatingReflux: rOperatingTypical
    },
    assumptions: [
      'Saturated liquid feed (q = 1.0).',
      'Constant molar overflow (McCabe-Thiele assumptions).'
    ]
  };
}

/**
 * 3. Overall Material Balance for a Separator / Distillation Unit
 * Total Balance: F = D + B
 * Component Balance: F * zF = D * xD + B * xB
 */
export function calcBinaryMaterialBalance({
  feedFlow,
  feedFlowUnit = 'kg/h',
  feedFraction, // zF
  distillateFraction, // xD
  bottomsFraction // xB
}) {
  const F = Number(feedFlow);
  const zF = Number(feedFraction);
  const xD = Number(distillateFraction);
  const xB = Number(bottomsFraction);

  if (F <= 0) throw new Error('Feed flow rate must be strictly positive.');
  if (xD <= xB || zF <= xB || zF >= xD) {
    throw new Error('Feed composition zF must lie strictly between bottoms composition xB and distillate composition xD (xB < zF < xD).');
  }

  // D = F * (zF - xB) / (xD - xB)
  const D = F * ((zF - xB) / (xD - xB));
  const B = F - D;
  const distillateRecovery = (D * xD) / (F * zF);

  return {
    success: true,
    toolName: 'calcBinaryMaterialBalance',
    category: 'Mass Transfer / Material Balance',
    summary: `For ${feedFlow} ${feedFlowUnit} feed (z_F = ${zF}), Distillate flow D = ${formatEngineeringNumber(D, 2)} ${feedFlowUnit} (x_D = ${xD}) and Bottoms flow B = ${formatEngineeringNumber(B, 2)} ${feedFlowUnit} (x_B = ${xB}). Light key recovery in distillate is ${formatEngineeringNumber(distillateRecovery * 100, 1)}%.`,
    inputs: {
      feedFlow: `${F} ${feedFlowUnit}`,
      feedFraction: zF,
      distillateFraction: xD,
      bottomsFraction: xB
    },
    equations: [
      'F = D + B',
      'F · z_F = D · x_D + B · x_B',
      'D = F · (z_F - x_B) / (x_D - x_B)',
      'B = F - D'
    ],
    substitutions: [
      `D = ${F} · (${zF} - ${xB}) / (${xD} - ${xB}) = ${F} · ${formatEngineeringNumber(zF - xB, 3)} / ${formatEngineeringNumber(xD - xB, 3)} = ${formatEngineeringNumber(D, 2)} ${feedFlowUnit}`,
      `B = ${F} - ${formatEngineeringNumber(D, 2)} = ${formatEngineeringNumber(B, 2)} ${feedFlowUnit}`
    ],
    results: {
      distillateFlow: D,
      bottomsFlow: B,
      lightKeyRecoveryPercent: distillateRecovery * 100
    },
    assumptions: [
      'Steady-state macroscopic mass balance with no chemical reaction.'
    ]
  };
}
