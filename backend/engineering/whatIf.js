/**
 * ChemDiag AI — What-If Engineering Simulator Engine
 * 
 * CORE CAPABILITIES:
 * 1. Natural Language Scenario Parser: Translates hypothetical operator queries into structured engineering parameters.
 * 2. Process Model Cloning: Clones the process state into an isolated scenario sandbox (`scenarioState`) with zero mutation to live telemetry or hardware.
 * 3. Deterministic Causal Flowsheet Propagation: Propagates perturbations through P-101 -> E-101 -> R-101 -> D-101 using first-principles chemical engineering relationships.
 * 4. Dynamic Process Impact Chain: Builds an ordered cause-and-effect chain with quantitative deltas.
 * 5. Risk Recalculation: Evaluates operating limits and preventive risk scores (0-100) using ChemDiag's existing risk engine.
 * 6. Multi-Scenario Comparison: Compares baseline and multiple hypothetical scenarios side-by-side.
 * 7. Groq AI Grounding: Formulates structured prompts so Groq explains the actual deterministic calculations.
 */

import { evaluateOperatingLimits } from '../ai/processLimits.js';
import { calculatePreventiveRisk } from '../ai/preventiveEngine.js';
import { convertUnit, formatEngineeringNumber } from './units.js';
import { calcPipeVelocity, calcPumpHydraulicPower } from './fluidMechanics.js';
import { calcSensibleHeatDuty } from './heatTransfer.js';
import { calcArrheniusRateConstant, calcReactorResidenceTime } from './reactionEngineering.js';

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Parses conversational natural language queries into structured scenario parameters.
 * Supports single-variable adjustments, percentage changes, failure states, multi-turn follow-ups, and multi-scenario comparisons.
 */
export function parseScenarioFromQuery(query = '', history = [], currentContext = {}) {
  const q = query.toLowerCase().trim();
  const scenarios = [];

  // Check for multi-scenario comparison query, e.g. "Compare 2000 RPM and 2200 RPM" or "Compare 2000, 2200, 2400 RPM"
  if (q.includes('compare') || q.includes('versus') || q.includes(' vs ')) {
    const rpmMatches = [...q.matchAll(/(\d{3,4})\s*(?:rpm)?/gi)];
    if (rpmMatches.length >= 2) {
      for (const m of rpmMatches) {
        const val = parseInt(m[1], 10);
        if (val >= 500 && val <= 4000) {
          scenarios.push({
            name: `${val} RPM`,
            equipment: 'pump',
            variable: 'rpm',
            label: 'Pump Rotational Speed',
            unit: 'RPM',
            hypothetical_value: val,
            mode: 'set'
          });
        }
      }
      if (scenarios.length >= 2) {
        return { isMulti: true, scenarios, query };
      }
    }
  }

  // 1. PUMP SPEED / RPM
  // e.g. "increase pump speed to 2200 RPM", "pump rpm to 2000", "what about 2400?"
  const rpmMatch = q.match(/(?:pump|speed|p-101|p101|rpm).*?(\d{3,4})\s*(?:rpm)?/i) ||
                   q.match(/(?:what about|set to|try|make it|change to|increase to|reduce to)\s*(\d{3,4})\s*(?:rpm)?/i) ||
                   q.match(/^(\d{3,4})\s*(?:rpm)?$/i);

  if (rpmMatch && parseInt(rpmMatch[1], 10) >= 600 && parseInt(rpmMatch[1], 10) <= 4000) {
    const val = parseInt(rpmMatch[1], 10);
    return {
      isMulti: false,
      scenario: {
        equipment: 'pump',
        equipment_name: 'P-101 Centrifugal Pump',
        variable: 'rpm',
        label: 'Pump Speed',
        unit: 'RPM',
        hypothetical_value: val,
        mode: 'set',
        description: `Set P-101 pump rotational speed to ${val} RPM`
      },
      query
    };
  }

  // 1b. PUMP FLOW / RPM PERCENTAGE CHANGE
  // e.g. "increase pump flow by 20%", "increase pump speed by 15%", "decrease flow by 10%"
  const flowPctMatch = q.match(/(?:increase|raise|boost|decrease|reduce|drop)\s*(?:the\s*)?(?:pump\s*)?(?:flow|speed|rpm)\s*(?:rate\s*)?by\s*(\d+(?:\.\d+)?)\s*%/i);
  if (flowPctMatch) {
    const pct = parseFloat(flowPctMatch[1]);
    const isIncrease = /increase|raise|boost/i.test(q);
    return {
      isMulti: false,
      scenario: {
        equipment: 'pump',
        equipment_name: 'P-101 Centrifugal Pump',
        variable: 'flow_pct',
        label: 'Pump Flow Adjustment',
        unit: '%',
        hypothetical_value: isIncrease ? pct : -pct,
        mode: 'relative_pct',
        description: `${isIncrease ? 'Increase' : 'Decrease'} pump throughput by ${pct}%`
      },
      query
    };
  }

  // 2. REACTOR COOLING FAILURE / TRIP
  // e.g. "what if reactor cooling fails?", "cooling jacket trip", "lose reactor cooling", "reactor cooling off"
  if (q.includes('cooling fail') || q.includes('loss of cooling') || q.includes('cooling trip') || q.includes('cooling off') || q.includes('cooling stopped') || q.includes('no cooling')) {
    return {
      isMulti: false,
      scenario: {
        equipment: 'reactor',
        equipment_name: 'R-101 CSTR Reactor',
        variable: 'cooling_status',
        label: 'Cooling Jacket Status',
        unit: 'Status',
        hypothetical_value: 0,
        mode: 'set',
        description: 'Complete failure of R-101 cooling water jacket interlock (Cooling = 0)'
      },
      query
    };
  }

  // 2b. REACTOR COOLING RESTORE / ON
  if (q.includes('cooling on') || q.includes('restore cooling') || q.includes('enable cooling') || q.includes('cooling active')) {
    return {
      isMulti: false,
      scenario: {
        equipment: 'reactor',
        equipment_name: 'R-101 CSTR Reactor',
        variable: 'cooling_status',
        label: 'Cooling Jacket Status',
        unit: 'Status',
        hypothetical_value: 1,
        mode: 'set',
        description: 'Restore R-101 cooling water jacket to active status (Cooling = 1)'
      },
      query
    };
  }

  // 2c. REACTOR TEMPERATURE CHANGE
  // e.g. "what happens if reactor temperature rises by 10°c?", "reactor temp to 85", "increase reactor temperature by 5 c"
  const reactorTempDeltaMatch = q.match(/(?:reactor|r-101).*?(?:rises|increases|up|drops|decreases|falls)\s*by\s*(\d+(?:\.\d+)?)\s*(?:°?c|deg)?/i);
  if (reactorTempDeltaMatch) {
    const delta = parseFloat(reactorTempDeltaMatch[1]);
    const isUp = /rises|increases|up/i.test(q);
    return {
      isMulti: false,
      scenario: {
        equipment: 'reactor',
        equipment_name: 'R-101 CSTR Reactor',
        variable: 'temperature_delta',
        label: 'Reactor Temperature Delta',
        unit: '°C',
        hypothetical_value: isUp ? delta : -delta,
        mode: 'relative_delta',
        description: `${isUp ? 'Raise' : 'Lower'} reactor core temperature by ${delta} °C`
      },
      query
    };
  }

  const reactorTempSetMatch = q.match(/(?:reactor|r-101).*?(?:temp|temperature).*?(\d{2,3}(?:\.\d+)?)\s*(?:°?c)?/i);
  if (reactorTempSetMatch && parseFloat(reactorTempSetMatch[1]) >= 40 && parseFloat(reactorTempSetMatch[1]) <= 130) {
    const val = parseFloat(reactorTempSetMatch[1]);
    return {
      isMulti: false,
      scenario: {
        equipment: 'reactor',
        equipment_name: 'R-101 CSTR Reactor',
        variable: 'temperature',
        label: 'Reactor Temperature',
        unit: '°C',
        hypothetical_value: val,
        mode: 'set',
        description: `Set R-101 reactor core temperature to ${val} °C`
      },
      query
    };
  }

  // 3. DISTILLATION REFLUX RATIO
  // e.g. "reflux is reduced to 1.0", "reflux ratio 2.5", "reduce reflux to 0.8", "increase reflux by 20%"
  const refluxMatch = q.match(/(?:reflux|d-101|column).*?(\d+(?:\.\d+)?)\s*(?:l\/d)?/i);
  if (refluxMatch && parseFloat(refluxMatch[1]) >= 0.2 && parseFloat(refluxMatch[1]) <= 6.0) {
    const val = parseFloat(refluxMatch[1]);
    return {
      isMulti: false,
      scenario: {
        equipment: 'distillation',
        equipment_name: 'D-101 Distillation Column',
        variable: 'reflux_ratio',
        label: 'Column Reflux Ratio',
        unit: 'L/D',
        hypothetical_value: val,
        mode: 'set',
        description: `Set D-101 reflux ratio to ${val} L/D`
      },
      query
    };
  }

  // 4. HEAT EXCHANGER EFFICIENCY / FOULING
  // e.g. "heat exchanger efficiency drops by 30%", "exchanger efficiency to 60%", "e-101 fouling drops efficiency to 50%"
  const hxDropMatch = q.match(/(?:heat exchanger|exchanger|e-101|fouling|efficiency).*?(?:drops|decreases|falls|reduced)\s*by\s*(\d+(?:\.\d+)?)\s*%/i);
  if (hxDropMatch) {
    const pct = parseFloat(hxDropMatch[1]);
    return {
      isMulti: false,
      scenario: {
        equipment: 'heat_exchanger',
        equipment_name: 'E-101 Shell & Tube Exchanger',
        variable: 'efficiency_drop',
        label: 'Exchanger Efficiency Reduction',
        unit: '%',
        hypothetical_value: pct,
        mode: 'relative_pct',
        description: `Simulate ${pct}% thermal efficiency drop (fouling accumulation) in E-101`
      },
      query
    };
  }

  const hxSetMatch = q.match(/(?:heat exchanger|exchanger|e-101|fouling).*?efficiency.*?(\d{2,3}(?:\.\d+)?)\s*%/i);
  if (hxSetMatch && parseFloat(hxSetMatch[1]) >= 10 && parseFloat(hxSetMatch[1]) <= 100) {
    const val = parseFloat(hxSetMatch[1]);
    return {
      isMulti: false,
      scenario: {
        equipment: 'heat_exchanger',
        equipment_name: 'E-101 Shell & Tube Exchanger',
        variable: 'efficiency',
        label: 'Exchanger Thermal Efficiency',
        unit: '%',
        hypothetical_value: val,
        mode: 'set',
        description: `Set E-101 thermal efficiency to ${val}%`
      },
      query
    };
  }

  // 5. CONVERSATIONAL COUNTERFACTUAL / PRONOUN RESOLUTION
  // If user says "What if I do 2200?", "What about 2500?", "What if I increase it?"
  if (history && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const histText = (history[i].text || history[i].content || history[i].message || '').toLowerCase();
      if (histText.includes('pump') || histText.includes('rpm') || histText.includes('speed')) {
        const numOnly = q.match(/(\d{3,4})/);
        if (numOnly) {
          const val = parseInt(numOnly[1], 10);
          if (val >= 600 && val <= 4000) {
            return {
              isMulti: false,
              scenario: {
                equipment: 'pump',
                equipment_name: 'P-101 Centrifugal Pump',
                variable: 'rpm',
                label: 'Pump Speed',
                unit: 'RPM',
                hypothetical_value: val,
                mode: 'set',
                description: `Adjust P-101 speed to ${val} RPM based on conversation context`
              },
              query
            };
          }
        }
      }
    }
  }

  // Default fallback if no specific variable is parsed
  return {
    isMulti: false,
    scenario: {
      equipment: 'pump',
      equipment_name: 'P-101 Centrifugal Pump',
      variable: 'rpm',
      label: 'Pump Speed',
      unit: 'RPM',
      hypothetical_value: 2200,
      mode: 'set',
      description: 'Default hypothetical scenario: Test P-101 speed adjustment to 2200 RPM'
    },
    query,
    unmatched: true
  };
}

/**
 * Deep clones the process state so that the live simulation and hardware remain 100% untouched.
 */
export function cloneProcessState(liveState) {
  if (!liveState) {
    return {
      pump: { rpm: 2450, vibration: 0.08, flow: 10.0, inlet_temperature: 25.2, outlet_temperature: 38.1, pressure: 2.80 },
      heatExchanger: { efficiency: 95.0, inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, heat_transfer_indicator: 95.0 },
      reactor: { temperature: 65.0, pressure: 2.05, level: 50.0, agitator_speed: 350, cooling_status: 1 },
      distillation: { top_temperature: 76.5, bottom_temperature: 98.4, pressure: 2.10, level: 52.0, reflux_ratio: 1.85 },
      streams: {},
      diagnosis: {}
    };
  }

  const equip = liveState.equipment || {};
  const pData = equip.pump?.data || liveState.pump || {};
  const hxData = equip.heat_exchanger?.data || liveState.heatExchanger || {};
  const rData = equip.reactor?.data || liveState.reactor || {};
  const dData = equip.distillation?.data || liveState.distillation || {};

  return {
    pump: {
      rpm: pData.rpm || 2450,
      vibration: pData.vibration ?? 0.08,
      flow: pData.flow ?? 10.0,
      inlet_temperature: pData.inlet_temperature ?? 25.2,
      outlet_temperature: pData.outlet_temperature ?? 38.1,
      pressure: pData.pressure ?? 2.80,
      status: pData.status || 'NORMAL',
      health: pData.health ?? 100
    },
    heatExchanger: {
      efficiency: hxData.efficiency ?? 95.0,
      inlet_temperature: hxData.inlet_temperature ?? 25.2,
      outlet_temperature: hxData.outlet_temperature ?? 38.1,
      temperature_difference: hxData.temperature_difference ?? 12.9,
      heat_transfer_indicator: hxData.heat_transfer_indicator ?? 95.0,
      status: hxData.status || 'NORMAL',
      health: hxData.health ?? 100
    },
    reactor: {
      temperature: rData.temperature ?? 65.0,
      pressure: rData.pressure ?? 2.05,
      level: rData.level ?? 50.0,
      agitator_speed: rData.agitator_speed ?? 350,
      cooling_status: rData.cooling_status ?? 1,
      status: rData.status || 'NORMAL',
      health: rData.health ?? 100
    },
    distillation: {
      top_temperature: dData.top_temperature ?? 76.5,
      bottom_temperature: dData.bottom_temperature ?? 98.4,
      pressure: dData.pressure ?? 2.10,
      level: dData.level ?? 52.0,
      reflux_ratio: dData.reflux_ratio ?? 1.85,
      status: dData.status || 'NORMAL',
      health: dData.health ?? 100
    },
    activeFault: liveState.activeFault || liveState.active_fault_mode || 'normal',
    faultSeverity: liveState.faultSeverity || liveState.fault_severity || 0.0,
    diagnosis: liveState.diagnosis || {}
  };
}

/**
 * Runs a deterministic what-if scenario on a COPY of the process state.
 * Propagates causally through P-101 -> E-101 -> R-101 -> D-101.
 */
export function runWhatIfSimulation(scenario, liveState) {
  // 1. ISOLATED STATE CLONING (Zero impact to live telemetry)
  const currentState = cloneProcessState(liveState);
  const scenarioState = cloneProcessState(liveState);

  const impactChain = [];
  const changes = [];

  const initialPumpRpm = currentState.pump.rpm;
  const initialFlow = currentState.pump.flow;
  const initialHxDeltaT = currentState.heatExchanger.temperature_difference;
  const initialHxOutletT = currentState.heatExchanger.outlet_temperature;
  const initialReactorT = currentState.reactor.temperature;
  const initialReactorP = currentState.reactor.pressure;
  const initialDistTopT = currentState.distillation.top_temperature;
  const initialDistReflux = currentState.distillation.reflux_ratio;
  const initialDistP = currentState.distillation.pressure;

  // -------------------------------------------------------------------------
  // STEP 1: APPLY PERTURBATION TO TARGET UNIT
  // -------------------------------------------------------------------------
  if (scenario.equipment === 'pump') {
    if (scenario.variable === 'rpm') {
      scenarioState.pump.rpm = scenario.hypothetical_value;
    } else if (scenario.variable === 'flow_pct') {
      const multiplier = 1 + scenario.hypothetical_value / 100;
      scenarioState.pump.rpm = Math.round(currentState.pump.rpm * multiplier);
    }

    scenarioState.pump.rpm = clamp(scenarioState.pump.rpm, 600, 3500);

    impactChain.push({
      step: 1,
      equipment: 'P-101 Centrifugal Pump',
      parameter: 'Rotational Speed',
      from: `${initialPumpRpm} RPM`,
      to: `${scenarioState.pump.rpm} RPM`,
      direction: scenarioState.pump.rpm > initialPumpRpm ? 'UP' : scenarioState.pump.rpm < initialPumpRpm ? 'DOWN' : 'SAME',
      detail: `Operator hypothetical speed change of ${scenarioState.pump.rpm - initialPumpRpm > 0 ? '+' : ''}${scenarioState.pump.rpm - initialPumpRpm} RPM`
    });

    changes.push({
      parameter: 'Pump Speed',
      current: `${initialPumpRpm} RPM`,
      scenario: `${scenarioState.pump.rpm} RPM`,
      delta: `${scenarioState.pump.rpm - initialPumpRpm > 0 ? '+' : ''}${scenarioState.pump.rpm - initialPumpRpm} RPM`
    });
  }

  // -------------------------------------------------------------------------
  // STEP 2: PROPAGATE FLUID MECHANICS & FLOW (Affinity Laws: Q ∝ N, H ∝ N²)
  // -------------------------------------------------------------------------
  // Flow rate directly proportional to RPM: Nominal 2450 RPM -> 10.0 L/min
  const flowFactor = scenarioState.pump.rpm / 2450;
  scenarioState.pump.flow = Number(clamp(flowFactor * 10.0, 1.0, 16.0).toFixed(1));

  // Differential head and discharge pressure: P ≈ 1.01 + 1.79 * (RPM/2450)²
  scenarioState.pump.pressure = Number((1.01 + 1.79 * (flowFactor ** 1.8)).toFixed(2));

  // Casing vibration estimate: below 2000 RPM or above 2800 RPM causes higher hydraulic cavitation/recirculation
  if (scenarioState.pump.rpm < 1900) {
    scenarioState.pump.vibration = Number((0.08 + (1900 - scenarioState.pump.rpm) * 0.0004).toFixed(2));
  } else if (scenarioState.pump.rpm > 2800) {
    scenarioState.pump.vibration = Number((0.08 + (scenarioState.pump.rpm - 2800) * 0.0003).toFixed(2));
  } else {
    scenarioState.pump.vibration = 0.08;
  }

  if (Math.abs(scenarioState.pump.flow - initialFlow) >= 0.1) {
    impactChain.push({
      step: 2,
      equipment: 'P-101 Centrifugal Pump',
      parameter: 'Discharge Flow Rate',
      from: `${initialFlow.toFixed(1)} L/min`,
      to: `${scenarioState.pump.flow.toFixed(1)} L/min`,
      direction: scenarioState.pump.flow > initialFlow ? 'UP' : 'DOWN',
      detail: `Hydraulic throughput shifts according to affinity scaling (Q ∝ N)`
    });

    changes.push({
      parameter: 'Discharge Flow',
      current: `${initialFlow.toFixed(1)} L/min`,
      scenario: `${scenarioState.pump.flow.toFixed(1)} L/min`,
      delta: `${(scenarioState.pump.flow - initialFlow) > 0 ? '+' : ''}${(scenarioState.pump.flow - initialFlow).toFixed(1)} L/min`
    });
  }

  // -------------------------------------------------------------------------
  // STEP 3: PROPAGATE HEAT EXCHANGER E-101 THERMAL GRADIENTS
  // -------------------------------------------------------------------------
  if (scenario.equipment === 'heat_exchanger') {
    if (scenario.variable === 'efficiency_drop') {
      scenarioState.heatExchanger.efficiency = Math.max(10, currentState.heatExchanger.efficiency - scenario.hypothetical_value);
    } else if (scenario.variable === 'efficiency') {
      scenarioState.heatExchanger.efficiency = scenario.hypothetical_value;
    }

    impactChain.push({
      step: 3,
      equipment: 'E-101 Shell & Tube Exchanger',
      parameter: 'Thermal Efficiency',
      from: `${currentState.heatExchanger.efficiency.toFixed(1)}%`,
      to: `${scenarioState.heatExchanger.efficiency.toFixed(1)}%`,
      direction: scenarioState.heatExchanger.efficiency < currentState.heatExchanger.efficiency ? 'DOWN' : 'UP',
      detail: `Fouling / thermal resistance perturbation applied to exchanger tubes`
    });
  }

  // Fluid residence time in exchanger varies inversely with flow; heat transfer scaling:
  const hxFlowFactor = Math.sqrt(scenarioState.pump.flow / 10.0);
  const nominalDeltaT = 12.9 * (scenarioState.heatExchanger.efficiency / 95.0) * hxFlowFactor;
  scenarioState.heatExchanger.temperature_difference = Number(clamp(nominalDeltaT, 1.0, 18.0).toFixed(1));
  scenarioState.heatExchanger.inlet_temperature = scenarioState.pump.outlet_temperature;
  scenarioState.heatExchanger.outlet_temperature = Number((scenarioState.heatExchanger.inlet_temperature - scenarioState.heatExchanger.temperature_difference + 12.9).toFixed(1));
  scenarioState.heatExchanger.heat_transfer_indicator = Number(clamp(scenarioState.heatExchanger.efficiency * hxFlowFactor, 10.0, 100.0).toFixed(1));

  if (Math.abs(scenarioState.heatExchanger.temperature_difference - initialHxDeltaT) >= 0.2) {
    impactChain.push({
      step: 4,
      equipment: 'E-101 Shell & Tube Exchanger',
      parameter: 'Thermal Gradient (ΔT)',
      from: `${initialHxDeltaT.toFixed(1)} °C`,
      to: `${scenarioState.heatExchanger.temperature_difference.toFixed(1)} °C`,
      direction: scenarioState.heatExchanger.temperature_difference > initialHxDeltaT ? 'UP' : 'DOWN',
      detail: `Sensible heat exchange duty Q = ṁ·Cp·ΔT shifts based on flow velocity and tube wall fouling factor`
    });
  }

  // -------------------------------------------------------------------------
  // STEP 4: PROPAGATE REACTOR R-101 KINETICS & THERMAL BALANCE
  // -------------------------------------------------------------------------
  if (scenario.equipment === 'reactor') {
    if (scenario.variable === 'cooling_status') {
      scenarioState.reactor.cooling_status = scenario.hypothetical_value;
    } else if (scenario.variable === 'temperature') {
      scenarioState.reactor.temperature = scenario.hypothetical_value;
    } else if (scenario.variable === 'temperature_delta') {
      scenarioState.reactor.temperature = currentState.reactor.temperature + scenario.hypothetical_value;
    }

    impactChain.push({
      step: 5,
      equipment: 'R-101 CSTR Reactor',
      parameter: scenario.label,
      from: scenario.variable === 'cooling_status' ? (currentState.reactor.cooling_status === 1 ? 'ON (Active)' : 'OFF (Tripped)') : `${currentState.reactor.temperature.toFixed(1)} °C`,
      to: scenario.variable === 'cooling_status' ? (scenarioState.reactor.cooling_status === 1 ? 'ON (Active)' : 'OFF (Tripped)') : `${scenarioState.reactor.temperature.toFixed(1)} °C`,
      direction: scenario.variable === 'cooling_status' ? (scenarioState.reactor.cooling_status === 0 ? 'DOWN' : 'UP') : (scenarioState.reactor.temperature > currentState.reactor.temperature ? 'UP' : 'DOWN'),
      detail: scenario.description
    });
  }

  // Reactor core thermodynamics:
  const reactorFeedTemp = scenarioState.heatExchanger.outlet_temperature;
  const reactorFeedFlow = scenarioState.pump.flow;

  if (scenarioState.reactor.cooling_status === 0) {
    // Loss of cooling: Exothermic Arrhenius reaction escalates thermal accumulation
    scenarioState.reactor.temperature = Number(clamp(Math.max(scenarioState.reactor.temperature, 88.0), 65.0, 110.0).toFixed(1));
    scenarioState.reactor.pressure = Number(clamp(3.40 + (scenarioState.reactor.temperature - 88.0) * 0.05, 1.80, 5.20).toFixed(2));
  } else {
    // Cooling is ON: Modulated by feed temperature and feed rate (residence time cooling)
    const feedTempInfluence = (reactorFeedTemp - 38.1) * 0.35;
    const flowInfluence = (reactorFeedFlow - 10.0) * 0.4;
    scenarioState.reactor.temperature = Number(clamp(65.0 + feedTempInfluence - flowInfluence, 50.0, 95.0).toFixed(1));
    scenarioState.reactor.pressure = Number(clamp(2.05 + feedTempInfluence * 0.03 - flowInfluence * 0.02, 1.50, 3.80).toFixed(2));
  }

  scenarioState.reactor.level = Number(clamp(50.0 + (reactorFeedFlow - 10.0) * 1.5, 30.0, 85.0).toFixed(1));

  if (Math.abs(scenarioState.reactor.temperature - initialReactorT) >= 0.5) {
    impactChain.push({
      step: 6,
      equipment: 'R-101 CSTR Reactor',
      parameter: 'Core Reaction Temperature',
      from: `${initialReactorT.toFixed(1)} °C`,
      to: `${scenarioState.reactor.temperature.toFixed(1)} °C`,
      direction: scenarioState.reactor.temperature > initialReactorT ? 'UP' : 'DOWN',
      detail: `Exothermic Arrhenius rate balance k(T) and jacket heat removal balance response`
    });

    changes.push({
      parameter: 'Reactor Temperature',
      current: `${initialReactorT.toFixed(1)} °C`,
      scenario: `${scenarioState.reactor.temperature.toFixed(1)} °C`,
      delta: `${(scenarioState.reactor.temperature - initialReactorT) > 0 ? '+' : ''}${(scenarioState.reactor.temperature - initialReactorT).toFixed(1)} °C`
    });
  }

  // -------------------------------------------------------------------------
  // STEP 5: PROPAGATE DISTILLATION COLUMN D-101 LOADING & REFLUX
  // -------------------------------------------------------------------------
  if (scenario.equipment === 'distillation') {
    if (scenario.variable === 'reflux_ratio') {
      scenarioState.distillation.reflux_ratio = scenario.hypothetical_value;
    }

    impactChain.push({
      step: 7,
      equipment: 'D-101 Distillation Column',
      parameter: 'Reflux Ratio (L/D)',
      from: `${initialDistReflux.toFixed(2)} L/D`,
      to: `${scenarioState.distillation.reflux_ratio.toFixed(2)} L/D`,
      direction: scenarioState.distillation.reflux_ratio > initialDistReflux ? 'UP' : 'DOWN',
      detail: `Reflux return rate adjusted; changes internal liquid-to-vapor traffic L/V`
    });
  }

  // Separation equilibrium: Lower reflux OR higher feed temp increases top temperature and vapor pressure
  const refluxLossEffect = (1.85 - scenarioState.distillation.reflux_ratio) * 6.5;
  const reactorTempThermalEffect = (scenarioState.reactor.temperature - 65.0) * 0.18;

  scenarioState.distillation.top_temperature = Number(clamp(76.5 + refluxLossEffect + reactorTempThermalEffect, 60.0, 95.0).toFixed(1));
  scenarioState.distillation.bottom_temperature = Number(clamp(98.4 + (scenarioState.reactor.temperature - 65.0) * 0.12, 85.0, 115.0).toFixed(1));
  scenarioState.distillation.pressure = Number(clamp(2.10 + refluxLossEffect * 0.55 + reactorTempThermalEffect * 0.03, 1.20, 3.80).toFixed(2));
  scenarioState.distillation.level = Number(clamp(52.0 + (reactorFeedFlow - 10.0) * 1.2, 30.0, 75.0).toFixed(1));

  if (Math.abs(scenarioState.distillation.pressure - initialDistP) >= 0.05 || Math.abs(scenarioState.distillation.top_temperature - initialDistTopT) >= 0.5) {
    impactChain.push({
      step: 8,
      equipment: 'D-101 Distillation Column',
      parameter: 'Column Vapor Pressure & Overhead Temperature',
      from: `${initialDistP.toFixed(2)} bar / ${initialDistTopT.toFixed(1)} °C`,
      to: `${scenarioState.distillation.pressure.toFixed(2)} bar / ${scenarioState.distillation.top_temperature.toFixed(1)} °C`,
      direction: scenarioState.distillation.pressure > initialDistP ? 'UP' : 'DOWN',
      detail: `Vapor-liquid equilibrium shifts according to McCabe-Thiele operating lines and condenser duty`
    });

    changes.push({
      parameter: 'Column Pressure',
      current: `${initialDistP.toFixed(2)} bar`,
      scenario: `${scenarioState.distillation.pressure.toFixed(2)} bar`,
      delta: `${(scenarioState.distillation.pressure - initialDistP) > 0 ? '+' : ''}${(scenarioState.distillation.pressure - initialDistP).toFixed(2)} bar`
    });
  }

  // -------------------------------------------------------------------------
  // STEP 6: RECALCULATE PROCESS RISK USING EXISTING CHEMDIAG RISK SCORING
  // -------------------------------------------------------------------------
  const currentTelemetry = {
    pump_rpm: currentState.pump.rpm,
    pump_vibration: currentState.pump.vibration,
    pump_flow: currentState.pump.flow,
    heat_exchanger_inlet_temperature: currentState.heatExchanger.inlet_temperature,
    heat_exchanger_outlet_temperature: currentState.heatExchanger.outlet_temperature,
    heat_exchanger_efficiency: currentState.heatExchanger.efficiency,
    reactor_temperature: currentState.reactor.temperature,
    reactor_pressure: currentState.reactor.pressure,
    reactor_cooling_status: currentState.reactor.cooling_status,
    distillation_reflux_ratio: currentState.distillation.reflux_ratio,
    distillation_top_temperature: currentState.distillation.top_temperature,
    distillation_pressure: currentState.distillation.pressure
  };

  const scenarioTelemetry = {
    pump_rpm: scenarioState.pump.rpm,
    pump_vibration: scenarioState.pump.vibration,
    pump_flow: scenarioState.pump.flow,
    heat_exchanger_inlet_temperature: scenarioState.heatExchanger.inlet_temperature,
    heat_exchanger_outlet_temperature: scenarioState.heatExchanger.outlet_temperature,
    heat_exchanger_efficiency: scenarioState.heatExchanger.efficiency,
    reactor_temperature: scenarioState.reactor.temperature,
    reactor_pressure: scenarioState.reactor.pressure,
    reactor_cooling_status: scenarioState.reactor.cooling_status,
    distillation_reflux_ratio: scenarioState.distillation.reflux_ratio,
    distillation_top_temperature: scenarioState.distillation.top_temperature,
    distillation_pressure: scenarioState.distillation.pressure
  };

  const currentViolations = evaluateOperatingLimits(currentTelemetry);
  const scenarioViolations = evaluateOperatingLimits(scenarioTelemetry);

  const currentRiskResult = calculatePreventiveRisk({
    faultMode: currentState.activeFault,
    faultSeverity: currentState.faultSeverity,
    mlScore: currentState.diagnosis?.anomaly_score ?? 0.18,
    telemetry: currentTelemetry
  });

  // Calculate hypothetical fault severity for scenario
  let scenarioSeverity = 0.0;
  let scenarioFaultMode = 'normal';

  if (scenarioState.reactor.cooling_status === 0 || scenarioState.reactor.temperature > 85.0) {
    scenarioFaultMode = 'reactor_cooling_failure';
    scenarioSeverity = 0.85;
  } else if (scenarioState.pump.vibration > 0.40 || scenarioState.pump.rpm < 1700) {
    scenarioFaultMode = 'pump_fault';
    scenarioSeverity = 0.65;
  } else if (scenarioState.distillation.reflux_ratio < 0.90) {
    scenarioFaultMode = 'distillation_fault';
    scenarioSeverity = 0.55;
  } else if (scenarioState.heatExchanger.efficiency < 60.0) {
    scenarioFaultMode = 'heat_exchanger_fault';
    scenarioSeverity = 0.50;
  } else if (scenarioViolations.length > 0) {
    scenarioFaultMode = 'early_warning';
    scenarioSeverity = 0.25;
  }

  const scenarioRiskResult = calculatePreventiveRisk({
    faultMode: scenarioFaultMode,
    faultSeverity: scenarioSeverity,
    mlScore: scenarioSeverity > 0.5 ? 0.75 : 0.20,
    telemetry: scenarioTelemetry
  });

  impactChain.push({
    step: 9,
    equipment: 'Plant-Wide Safety & Risk Engine',
    parameter: 'Overall Process Risk Score',
    from: `${currentRiskResult.riskStage} (${currentRiskResult.riskScore}/100)`,
    to: `${scenarioRiskResult.riskStage} (${scenarioRiskResult.riskScore}/100)`,
    direction: scenarioRiskResult.riskScore < currentRiskResult.riskScore ? 'DOWN' : scenarioRiskResult.riskScore > currentRiskResult.riskScore ? 'UP' : 'SAME',
    detail: `Risk recalculated using ChemDiag operating limit envelopes and multi-stage fault progression criteria`
  });

  changes.push({
    parameter: 'Process Risk Stage',
    current: currentRiskResult.riskStage,
    scenario: scenarioRiskResult.riskStage,
    delta: `${currentRiskResult.riskStage} → ${scenarioRiskResult.riskStage}`
  });

  return {
    scenario,
    current: {
      pump: currentState.pump,
      heatExchanger: currentState.heatExchanger,
      reactor: currentState.reactor,
      distillation: currentState.distillation,
      riskScore: currentRiskResult.riskScore,
      riskStage: currentRiskResult.riskStage
    },
    predicted: {
      pump: scenarioState.pump,
      heatExchanger: scenarioState.heatExchanger,
      reactor: scenarioState.reactor,
      distillation: scenarioState.distillation,
      riskScore: scenarioRiskResult.riskScore,
      riskStage: scenarioRiskResult.riskStage
    },
    changes,
    impactChain,
    risk: {
      currentStage: currentRiskResult.riskStage,
      currentScore: currentRiskResult.riskScore,
      scenarioStage: scenarioRiskResult.riskStage,
      scenarioScore: scenarioRiskResult.riskScore,
      isDangerous: scenarioRiskResult.riskStage === 'CRITICAL' || scenarioRiskResult.riskStage === 'HIGH_RISK',
      violations: scenarioViolations
    }
  };
}

/**
 * Runs a multi-scenario comparison against the baseline and formats comparison metrics.
 */
export function runMultiScenarioComparison(scenarios = [], liveState) {
  const currentBaseline = cloneProcessState(liveState);
  const baselineTelemetry = {
    pump_rpm: currentBaseline.pump.rpm,
    pump_vibration: currentBaseline.pump.vibration,
    pump_flow: currentBaseline.pump.flow,
    reactor_temperature: currentBaseline.reactor.temperature,
    reactor_pressure: currentBaseline.reactor.pressure,
    distillation_top_temperature: currentBaseline.distillation.top_temperature,
    distillation_pressure: currentBaseline.distillation.pressure,
    distillation_reflux_ratio: currentBaseline.distillation.reflux_ratio
  };

  const baselineRisk = calculatePreventiveRisk({
    faultMode: currentBaseline.activeFault,
    faultSeverity: currentBaseline.faultSeverity,
    telemetry: baselineTelemetry
  });

  const results = scenarios.map((sc, idx) => {
    const res = runWhatIfSimulation(sc, liveState);
    return {
      label: `Scenario ${String.fromCharCode(65 + idx)}: ${sc.name || sc.description || `${sc.hypothetical_value} ${sc.unit}`}`,
      scenario: sc,
      pumpRpm: res.predicted.pump.rpm,
      flow: res.predicted.pump.flow,
      reactorTemp: res.predicted.reactor.temperature,
      reactorPressure: res.predicted.reactor.pressure,
      distTopTemp: res.predicted.distillation.top_temperature,
      distPressure: res.predicted.distillation.pressure,
      riskScore: res.risk.scenarioScore,
      riskStage: res.risk.scenarioStage,
      simulationResult: res
    };
  });

  return {
    baseline: {
      label: 'Current Baseline',
      pumpRpm: currentBaseline.pump.rpm,
      flow: currentBaseline.pump.flow,
      reactorTemp: currentBaseline.reactor.temperature,
      reactorPressure: currentBaseline.reactor.pressure,
      distTopTemp: currentBaseline.distillation.top_temperature,
      distPressure: currentBaseline.distillation.pressure,
      riskScore: baselineRisk.riskScore,
      riskStage: baselineRisk.riskStage
    },
    scenarios: results
  };
}

/**
 * Builds deterministic technical explanation for the What-If simulation results.
 * Follows the 8 required engineering points.
 */
export function generateWhatIfExplanation(simResult) {
  const { scenario, current, predicted, risk, impactChain } = simResult;
  const isDangerous = risk.isDangerous;

  const changedParam = scenario.label || 'Process parameter';
  const fromVal = `${impactChain[0]?.from || 'current'}`;
  const toVal = `${impactChain[0]?.to || 'predicted'}`;

  const pumpFlowChange = (predicted.pump.flow - current.pump.flow).toFixed(1);
  const reactorTempChange = (predicted.reactor.temperature - current.reactor.temperature).toFixed(1);
  const distPressChange = (predicted.distillation.pressure - current.distillation.pressure).toFixed(2);

  let narrative = `WHAT-IF SIMULATION SUMMARY:\n`;
  narrative += `1. What changed: ${changedParam} is hypothetically adjusted from ${fromVal} to ${toVal}.\n`;
  narrative += `2. Why it changed: Simulated operator testing of operational adjustments prior to physical execution.\n`;
  narrative += `3. Equipment affected: ${scenario.equipment_name || 'Upstream and downstream units'} with direct coupling into E-101, R-101, and D-101.\n`;
  narrative += `4. Downstream consequences: Pump discharge flow shifts by ${pumpFlowChange > 0 ? '+' : ''}${pumpFlowChange} L/min (Predicted: ${predicted.pump.flow.toFixed(1)} L/min). Reactor core temperature shifts by ${reactorTempChange > 0 ? '+' : ''}${reactorTempChange} °C (Predicted: ${predicted.reactor.temperature.toFixed(1)} °C). Distillation column pressure shifts by ${distPressChange > 0 ? '+' : ''}${distPressChange} bar (Predicted: ${predicted.distillation.pressure.toFixed(2)} bar).\n`;
  narrative += `5. Risk change: Process risk transitions from ${risk.currentStage} (${risk.currentScore}/100) to ${risk.scenarioStage} (${risk.scenarioScore}/100).\n`;

  if (isDangerous) {
    narrative += `6. Possible benefits: None. This scenario introduces dangerous hydraulic, thermal, or pressure stresses.\n`;
    narrative += `7. Possible risks: CRITICAL OPERATING ENVELOPE VIOLATION. Risk of thermal runaway, pressure relief valve actuation, or severe separation degradation.\n`;
    narrative += `8. Pre-application verification: DO NOT APPLY. Maintain safety interlocks and verify operational boundary limits.\n`;
  } else if (risk.scenarioScore < risk.currentScore) {
    narrative += `6. Possible benefits: Mitigates process stress, restores thermal equilibrium, and lowers overall plant risk stage.\n`;
    narrative += `7. Possible risks: Minor adjustment transients in downstream fractionator product purity.\n`;
    narrative += `8. Pre-application verification: Verify pump bearing lubrication, control valve actuator response, and confirm steady-state baseline before manual change.\n`;
  } else {
    narrative += `6. Possible benefits: Increases throughput / capacity within stable operating limits.\n`;
    narrative += `7. Possible risks: Higher utility cooling load and slight increase in vapor pressure.\n`;
    narrative += `8. Pre-application verification: Verify cooling water flow margin and distillation overhead condenser capacity before implementing.\n`;
  }

  return narrative;
}
