/**
 * ChemDiag Engineering Calculation Library — Process Control & Instrumentation
 * 
 * Deterministic mathematical calculations for PID controller outputs,
 * tracking error, loop gains, Ziegler-Nichols tuning, and FOPDT dynamics.
 */

import { formatEngineeringNumber } from './units.js';

/**
 * 1. Controller Tracking Error
 * Formula: e(t) = SP - PV (Direct action) or PV - SP (Reverse action)
 */
export function calcControllerError({
  setpoint,
  processVariable,
  actionType = 'direct' // 'direct' (heating) or 'reverse' (cooling/letdown)
}) {
  const SP = Number(setpoint);
  const PV = Number(processVariable);

  if (isNaN(SP) || isNaN(PV)) {
    throw new Error('Setpoint (SP) and Process Variable (PV) must both be valid numbers.');
  }

  const isDirect = actionType.toLowerCase().includes('direct');
  const error = isDirect ? (SP - PV) : (PV - SP);
  const percentError = SP !== 0 ? (error / SP) * 100.0 : 0;

  return {
    success: true,
    toolName: 'calcControllerError',
    category: 'Process Control / Error',
    summary: `PID Controller Error e(t) = ${formatEngineeringNumber(error, 2)} (${formatEngineeringNumber(percentError, 1)}% relative to SP = ${SP}).`,
    inputs: {
      setpoint: SP,
      processVariable: PV,
      actionType: isDirect ? 'Direct Acting (SP - PV)' : 'Reverse Acting (PV - SP)'
    },
    equations: [
      isDirect ? 'e(t) = Setpoint - ProcessVariable' : 'e(t) = ProcessVariable - Setpoint'
    ],
    substitutions: [
      `e(t) = ${SP} - ${PV} = ${formatEngineeringNumber(error, 2)}`
    ],
    results: {
      error,
      percentError,
      isDirect
    },
    assumptions: [
      'Standard feedback loop controller error computation.'
    ]
  };
}

/**
 * 2. PID Algorithm Instantaneous Output Calculation
 * Formula: u(t) = u_bias + P_term + I_term + D_term
 * P_term = K_c * e
 * I_term = (K_c / T_i) * integral_e
 * D_term = K_c * T_d * (de/dt)
 */
export function calcPIDOutput({
  controllerGain, // Kc
  integralTime = null, // Ti (seconds or minutes)
  derivativeTime = 0, // Td (seconds or minutes)
  error, // current e
  integralError = 0, // cumulative integral of error
  derivativeError = 0, // rate of change de/dt
  bias = 50.0 // nominal % valve bias
}) {
  const Kc = Number(controllerGain);
  const e = Number(error);
  const bias_val = Number(bias);

  if (isNaN(Kc) || isNaN(e)) {
    throw new Error('Controller gain Kc and current error e must be valid numbers.');
  }

  const pTerm = Kc * e;
  
  let iTerm = 0;
  if (integralTime !== null && Number(integralTime) > 0) {
    const Ti = Number(integralTime);
    iTerm = (Kc / Ti) * Number(integralError);
  }

  let dTerm = 0;
  if (derivativeTime !== null && Number(derivativeTime) > 0) {
    const Td = Number(derivativeTime);
    dTerm = Kc * Td * Number(derivativeError);
  }

  const unboundedOutput = bias_val + pTerm + iTerm + dTerm;
  // Output clamped between 0% and 100% actuator travel
  const clampedOutput = Math.max(0.0, Math.min(100.0, unboundedOutput));
  const isSaturated = unboundedOutput !== clampedOutput;

  return {
    success: true,
    toolName: 'calcPIDOutput',
    category: 'Process Control / PID',
    summary: `PID output u(t) = ${formatEngineeringNumber(clampedOutput, 2)}% [P = ${formatEngineeringNumber(pTerm, 2)}, I = ${formatEngineeringNumber(iTerm, 2)}, D = ${formatEngineeringNumber(dTerm, 2)}, Bias = ${bias_val}%].${isSaturated ? ' (Output is SATURATED at limits).' : ''}`,
    inputs: {
      controllerGain_Kc: Kc,
      integralTime_Ti: integralTime,
      derivativeTime_Td: derivativeTime,
      currentError_e: e,
      integralOfError: integralError,
      derivativeOfError: derivativeError,
      bias: bias_val
    },
    equations: [
      'u(t) = Bias + K_c · [ e(t) + (1/T_i) · ∫e(τ)dτ + T_d · (de/dt) ]',
      'P_term = K_c · e(t)',
      'I_term = (K_c / T_i) · ∫e(τ)dτ',
      'D_term = K_c · T_d · (de/dt)'
    ],
    substitutions: [
      `P = ${Kc} · ${e} = ${formatEngineeringNumber(pTerm, 2)}%`,
      `I = ${formatEngineeringNumber(iTerm, 2)}%`,
      `D = ${formatEngineeringNumber(dTerm, 2)}%`,
      `u(t) = ${bias_val} + ${formatEngineeringNumber(pTerm, 2)} + ${formatEngineeringNumber(iTerm, 2)} + ${formatEngineeringNumber(dTerm, 2)} = ${formatEngineeringNumber(clampedOutput, 2)}%`
    ],
    results: {
      clampedOutput,
      unboundedOutput,
      pTerm,
      iTerm,
      dTerm,
      isSaturated
    },
    assumptions: [
      'Standard ideal parallel continuous PID formulation.',
      'Actuator output bounded between 0% (Closed) and 100% (Open).'
    ]
  };
}

/**
 * 3. Process Gain (Steady-State Sensitivity)
 * Formula: K_p = ΔPV / ΔCO
 */
export function calcProcessGain({
  deltaPV,
  deltaPVUnit = 'C',
  deltaCO,
  deltaCOUnit = '%'
}) {
  const dPV = Number(deltaPV);
  const dCO = Number(deltaCO);

  if (isNaN(dPV) || isNaN(dCO) || dCO === 0) {
    throw new Error('Change in controller output ΔCO must be a non-zero number.');
  }

  const Kp = dPV / dCO;

  return {
    success: true,
    toolName: 'calcProcessGain',
    category: 'Process Control / Identification',
    summary: `Process Gain K_p = ${formatEngineeringNumber(Kp, 3)} ${deltaPVUnit} / ${deltaCOUnit} (A 1% change in controller output produces a steady-state change of ${formatEngineeringNumber(Kp, 3)} ${deltaPVUnit} in the process variable).`,
    inputs: {
      deltaPV: `${dPV} ${deltaPVUnit}`,
      deltaCO: `${dCO} ${deltaCOUnit}`
    },
    equations: [
      'K_p = ΔPV / ΔCO'
    ],
    substitutions: [
      `K_p = ${dPV} ${deltaPVUnit} / ${dCO} ${deltaCOUnit} = ${formatEngineeringNumber(Kp, 3)} ${deltaPVUnit}/${deltaCOUnit}`
    ],
    results: {
      processGain: Kp,
      unit: `${deltaPVUnit}/${deltaCOUnit}`
    },
    assumptions: [
      'Linearized steady-state response around the operating point.'
    ]
  };
}

/**
 * 4. Closed-Loop Ziegler-Nichols Tuning Rules
 * Computes Kc, Ti, Td from Ultimate Gain (Ku) and Ultimate Period (Pu)
 */
export function calcZieglerNicholsTuning({
  ultimateGain, // Ku
  ultimatePeriod, // Pu (seconds or minutes)
  periodUnit = 'min',
  controllerType = 'PID' // 'P', 'PI', 'PID'
}) {
  const Ku = Number(ultimateGain);
  const Pu = Number(ultimatePeriod);

  if (Ku <= 0 || Pu <= 0) {
    throw new Error('Ultimate Gain (Ku) and Ultimate Period (Pu) must both be strictly positive.');
  }

  const type = controllerType.toUpperCase().trim();
  let Kc = 0;
  let Ti = 0;
  let Td = 0;

  if (type === 'P') {
    Kc = 0.5 * Ku;
    Ti = 0;
    Td = 0;
  } else if (type === 'PI') {
    Kc = 0.45 * Ku;
    Ti = Pu / 1.2;
    Td = 0;
  } else {
    // Standard PID
    Kc = 0.6 * Ku;
    Ti = Pu / 2.0;
    Td = Pu / 8.0;
  }

  return {
    success: true,
    toolName: 'calcZieglerNicholsTuning',
    category: 'Process Control / Tuning',
    summary: `Classic Ziegler-Nichols ${type} Parameters: Gain K_c = ${formatEngineeringNumber(Kc, 3)}${Ti > 0 ? `, Integral Time T_i = ${formatEngineeringNumber(Ti, 2)} ${periodUnit}` : ''}${Td > 0 ? `, Derivative Time T_d = ${formatEngineeringNumber(Td, 3)} ${periodUnit}` : ''}.`,
    inputs: {
      ultimateGain_Ku: Ku,
      ultimatePeriod_Pu: `${Pu} ${periodUnit}`,
      controllerType: type
    },
    equations: [
      'P:   K_c = 0.5 · K_u',
      'PI:  K_c = 0.45 · K_u,  T_i = P_u / 1.2',
      'PID: K_c = 0.6 · K_u,   T_i = P_u / 2,   T_d = P_u / 8'
    ],
    substitutions: [
      `K_c = 0.6 · ${Ku} = ${formatEngineeringNumber(Kc, 3)}`,
      `T_i = ${Pu} / 2 = ${formatEngineeringNumber(Ti, 2)} ${periodUnit}`,
      `T_d = ${Pu} / 8 = ${formatEngineeringNumber(Td, 3)} ${periodUnit}`
    ],
    results: {
      controllerType: type,
      gain_Kc: Kc,
      integralTime_Ti: Ti,
      derivativeTime_Td: Td,
      periodUnit
    },
    assumptions: [
      'Classic Ziegler-Nichols quarter-amplitude damping closed-loop tuning criteria.',
      'Sustained limit cycle at ultimate gain Ku with period Pu.'
    ]
  };
}
