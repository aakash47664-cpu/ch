/**
 * ChemDiag Engineering Calculation Engine — Master Index & Tool Registry
 * 
 * Unifies all deterministic mathematical modules and exposes them for:
 * 1. Groq / OpenAI Tool Calling (JSON function definitions)
 * 2. Local zero-latency deterministic execution
 * 3. Live ChemDiag Digital Twin telemetry grounding
 */

import * as Units from './units.js';
import * as Fluid from './fluidMechanics.js';
import * as Heat from './heatTransfer.js';
import * as Thermo from './thermodynamics.js';
import * as Reaction from './reactionEngineering.js';
import * as Mass from './massTransfer.js';
import * as Control from './processControl.js';
import * as Equipment from './equipment.js';

export { Units, Fluid, Heat, Thermo, Reaction, Mass, Control, Equipment };

/**
 * Standard OpenAI / Groq Tool Calling Schemas for Engineering Calculations
 */
export const ENGINEERING_TOOL_DEFINITIONS = [
  // 1. Fluid Velocity in Pipe
  {
    type: 'function',
    function: {
      name: 'calcPipeVelocity',
      description: 'Calculates the fluid flow velocity and cross-sectional area in a circular pipe given volumetric flow rate and pipe inner diameter.',
      parameters: {
        type: 'object',
        properties: {
          flowRate: { type: 'number', description: 'Volumetric flow rate (e.g. 5.0)' },
          flowUnit: { type: 'string', description: 'Unit of flow rate: m3/h, m3/s, L/s, L/min, gpm, cfm', default: 'm3/h' },
          diameter: { type: 'number', description: 'Pipe inside diameter (e.g. 25)' },
          diameterUnit: { type: 'string', description: 'Unit of diameter: mm, cm, m, in, inches', default: 'mm' }
        },
        required: ['flowRate', 'diameter']
      }
    }
  },

  // 2. Reynolds Number
  {
    type: 'function',
    function: {
      name: 'calcReynoldsNumber',
      description: 'Calculates the dimensionless Reynolds number (Re) and determines the flow regime (Laminar, Transition, Turbulent) in a pipe.',
      parameters: {
        type: 'object',
        properties: {
          velocity: { type: 'number', description: 'Fluid flow velocity (e.g. 2.5)' },
          velocityUnit: { type: 'string', description: 'Unit of velocity: m/s, ft/s', default: 'm/s' },
          diameter: { type: 'number', description: 'Pipe inner diameter (e.g. 50)' },
          diameterUnit: { type: 'string', description: 'Unit of diameter: mm, m, in', default: 'mm' },
          density: { type: 'number', description: 'Fluid density (e.g. 1000 for water)', default: 1000 },
          densityUnit: { type: 'string', description: 'Unit of density: kg/m3, g/cm3, lb/ft3', default: 'kg/m3' },
          viscosity: { type: 'number', description: 'Fluid dynamic viscosity (e.g. 0.001 for water, or in cP)', default: 0.001 },
          viscosityUnit: { type: 'string', description: 'Unit of viscosity: Pa.s, cP, P, kg/(m.s)', default: 'Pa.s' }
        },
        required: ['velocity', 'diameter']
      }
    }
  },

  // 3. Darcy-Weisbach Pressure Drop
  {
    type: 'function',
    function: {
      name: 'calcDarcyWeisbachPressureDrop',
      description: 'Calculates the frictional pressure drop (ΔP) and hydraulic head loss along a pipe using the Darcy-Weisbach and Haaland/Colebrook-White friction equations.',
      parameters: {
        type: 'object',
        properties: {
          flowRate: { type: 'number', description: 'Volumetric flow rate' },
          flowUnit: { type: 'string', default: 'm3/h' },
          diameter: { type: 'number', description: 'Pipe inner diameter' },
          diameterUnit: { type: 'string', default: 'mm' },
          length: { type: 'number', description: 'Pipe straight length' },
          lengthUnit: { type: 'string', default: 'm' },
          roughness: { type: 'number', description: 'Absolute pipe wall roughness (e.g. 0.045 for commercial steel)', default: 0.045 },
          roughnessUnit: { type: 'string', default: 'mm' },
          density: { type: 'number', default: 1000 },
          densityUnit: { type: 'string', default: 'kg/m3' },
          viscosity: { type: 'number', default: 0.001 },
          viscosityUnit: { type: 'string', default: 'Pa.s' }
        },
        required: ['flowRate', 'diameter', 'length']
      }
    }
  },

  // 4. Pump Hydraulic Power & Shaft Power
  {
    type: 'function',
    function: {
      name: 'calcPumpHydraulicPower',
      description: 'Calculates the hydraulic power and shaft brake horsepower (BHP) required for a centrifugal pump given flow rate, head/pressure, and efficiency.',
      parameters: {
        type: 'object',
        properties: {
          flowRate: { type: 'number', description: 'Liquid volumetric flow rate (e.g. 10)' },
          flowUnit: { type: 'string', description: 'L/s, L/min, m3/h, m3/s, gpm', default: 'L/s' },
          head: { type: 'number', description: 'Total dynamic head (e.g. 20)' },
          headUnit: { type: 'string', description: 'm, ft', default: 'm' },
          deltaP: { type: 'number', description: 'Differential pressure (optional alternative to head)' },
          deltaPUnit: { type: 'string', default: 'bar' },
          density: { type: 'number', description: 'Liquid density in kg/m3 (default 1000)', default: 1000 },
          densityUnit: { type: 'string', default: 'kg/m3' },
          efficiency: { type: 'number', description: 'Pump mechanical/hydraulic efficiency (0.0 to 1.0 or %)', default: 0.75 }
        },
        required: ['flowRate']
      }
    }
  },

  // 5. NPSH Available & Cavitation Margin
  {
    type: 'function',
    function: {
      name: 'calcNPSHAvailable',
      description: 'Calculates the Net Positive Suction Head Available (NPSHa) and cavitation safety margin for a pump.',
      parameters: {
        type: 'object',
        properties: {
          suctionPressure: { type: 'number', description: 'Suction pressure at pump inlet flange' },
          suctionPressureUnit: { type: 'string', default: 'bar' },
          isGauge: { type: 'boolean', description: 'True if pressure is gauge (psig/barg), false if absolute', default: true },
          vaporPressure: { type: 'number', description: 'Fluid vapor pressure at operating temperature' },
          vaporPressureUnit: { type: 'string', default: 'bar' },
          staticLiquidHead: { type: 'number', description: 'Static liquid height above suction in meters', default: 0.0 },
          frictionHeadLoss: { type: 'number', description: 'Friction head loss in suction line in meters', default: 0.0 },
          npshRequired: { type: 'number', description: 'NPSHr from pump manufacturer curve' },
          density: { type: 'number', default: 1000 }
        },
        required: ['suctionPressure', 'vaporPressure']
      }
    }
  },

  // 6. Pipe Sizing
  {
    type: 'function',
    function: {
      name: 'calcPipeSizing',
      description: 'Recommends nominal standard pipe sizes (NPS / Schedule 40) based on flow rate and recommended target velocity criteria.',
      parameters: {
        type: 'object',
        properties: {
          flowRate: { type: 'number', description: 'Volumetric flow rate' },
          flowUnit: { type: 'string', default: 'm3/h' },
          targetVelocity: { type: 'number', description: 'Target economic velocity in m/s (default 1.5 m/s)', default: 1.5 },
          targetVelocityUnit: { type: 'string', default: 'm/s' }
        },
        required: ['flowRate']
      }
    }
  },

  // 7. Sensible Heat Duty (Q = m * Cp * ΔT)
  {
    type: 'function',
    function: {
      name: 'calcSensibleHeatDuty',
      description: 'Calculates thermal energy or heat duty using Q = m · Cp · ΔT for continuous fluid flow or batch mass heating/cooling.',
      parameters: {
        type: 'object',
        properties: {
          massFlow: { type: 'number', description: 'Continuous mass flow rate (e.g. 2 kg/s)' },
          massFlowUnit: { type: 'string', default: 'kg/s' },
          mass: { type: 'number', description: 'Total batch mass (e.g. 100 kg)' },
          massUnit: { type: 'string', default: 'kg' },
          specificHeat: { type: 'number', description: 'Specific heat capacity Cp (default 4.184 for water)', default: 4.184 },
          specificHeatUnit: { type: 'string', description: 'kJ/(kg.K) or J/(kg.K)', default: 'kJ/(kg.K)' },
          deltaT: { type: 'number', description: 'Temperature change ΔT (e.g. 10 or 55)' },
          deltaTUnit: { type: 'string', default: 'C' },
          tIn: { type: 'number', description: 'Initial / inlet temperature' },
          tOut: { type: 'number', description: 'Final / outlet temperature' },
          tempUnit: { type: 'string', default: 'C' }
        }
      }
    }
  },

  // 8. Log Mean Temperature Difference (LMTD)
  {
    type: 'function',
    function: {
      name: 'calcLMTD',
      description: 'Calculates the Log Mean Temperature Difference (LMTD) for counter-current or co-current heat exchangers.',
      parameters: {
        type: 'object',
        properties: {
          tHotIn: { type: 'number', description: 'Hot fluid inlet temperature' },
          tHotOut: { type: 'number', description: 'Hot fluid outlet temperature' },
          tColdIn: { type: 'number', description: 'Cold fluid inlet temperature' },
          tColdOut: { type: 'number', description: 'Cold fluid outlet temperature' },
          flowArrangement: { type: 'string', description: 'counter or parallel/co-current', default: 'counter' },
          tempUnit: { type: 'string', default: 'C' }
        },
        required: ['tHotIn', 'tHotOut', 'tColdIn', 'tColdOut']
      }
    }
  },

  // 9. Heat Exchanger Sizing & Rating (Q = U * A * LMTD)
  {
    type: 'function',
    function: {
      name: 'calcHeatExchangerSizing',
      description: 'Calculates heat exchanger surface area (A) from duty and overall U, or heat duty (Q) from area and overall U.',
      parameters: {
        type: 'object',
        properties: {
          duty: { type: 'number', description: 'Heat exchanger duty (kW or W)' },
          dutyUnit: { type: 'string', default: 'kW' },
          overallU: { type: 'number', description: 'Overall heat transfer coefficient U in W/(m²·K)' },
          overallUUnit: { type: 'string', default: 'W/(m2.K)' },
          area: { type: 'number', description: 'Surface area in m² (if rating)' },
          areaUnit: { type: 'string', default: 'm2' },
          lmtd: { type: 'number', description: 'Log Mean Temperature Difference' },
          lmtdUnit: { type: 'string', default: 'C' },
          fFactor: { type: 'number', description: 'Multi-pass geometry correction factor (0.75 - 1.0)', default: 1.0 }
        },
        required: ['overallU', 'lmtd']
      }
    }
  },

  // 10. Conduction Heat Transfer (Fourier's Law)
  {
    type: 'function',
    function: {
      name: 'calcConductionHeat',
      description: 'Calculates 1D steady-state conductive heat transfer rate through a wall or insulation layer (Q = k · A · ΔT / L).',
      parameters: {
        type: 'object',
        properties: {
          thermalConductivity: { type: 'number', description: 'Thermal conductivity k in W/(m·K)' },
          area: { type: 'number', description: 'Wall surface area in m²' },
          areaUnit: { type: 'string', default: 'm2' },
          thickness: { type: 'number', description: 'Wall or insulation thickness' },
          thicknessUnit: { type: 'string', default: 'mm' },
          deltaT: { type: 'number', description: 'Temperature difference across wall' },
          deltaTUnit: { type: 'string', default: 'C' }
        },
        required: ['thermalConductivity', 'area', 'thickness', 'deltaT']
      }
    }
  },

  // 11. Ideal Gas Law
  {
    type: 'function',
    function: {
      name: 'calcIdealGasLaw',
      description: 'Calculates gas density, molar volume, pressure, or volume using the Ideal Gas Equation of State (PV = nRT).',
      parameters: {
        type: 'object',
        properties: {
          pressure: { type: 'number', description: 'Gas pressure' },
          pressureUnit: { type: 'string', default: 'bar' },
          temperature: { type: 'number', description: 'Gas temperature' },
          temperatureUnit: { type: 'string', default: 'C' },
          volume: { type: 'number', description: 'Gas volume' },
          volumeUnit: { type: 'string', default: 'm3' },
          moles: { type: 'number', description: 'Number of moles' },
          mass: { type: 'number', description: 'Gas mass' },
          massUnit: { type: 'string', default: 'kg' },
          molecularWeight: { type: 'number', description: 'Gas molecular weight in g/mol (default 28.97 for air)', default: 28.97 }
        }
      }
    }
  },

  // 12. Compressor Power & Discharge Temperature
  {
    type: 'function',
    function: {
      name: 'calcCompressorPower',
      description: 'Calculates isentropic/actual compressor power, compression ratio, and discharge temperature for gas compression.',
      parameters: {
        type: 'object',
        properties: {
          massFlow: { type: 'number', description: 'Gas mass flow rate (kg/s)' },
          volumetricFlow: { type: 'number', description: 'Inlet volumetric flow rate' },
          flowUnit: { type: 'string', default: 'kg/s' },
          suctionPressure: { type: 'number', description: 'Suction pressure P1' },
          dischargePressure: { type: 'number', description: 'Discharge pressure P2' },
          pressureUnit: { type: 'string', default: 'bar' },
          suctionTemperature: { type: 'number', description: 'Suction temperature T1' },
          temperatureUnit: { type: 'string', default: 'C' },
          gamma: { type: 'number', description: 'Ratio of specific heats Cp/Cv (default 1.4 for air)', default: 1.4 },
          molecularWeight: { type: 'number', default: 28.97 },
          isentropicEfficiency: { type: 'number', description: 'Isentropic efficiency (default 0.75)', default: 0.75 }
        },
        required: ['suctionPressure', 'dischargePressure', 'suctionTemperature']
      }
    }
  },

  // 13. Carnot Cycle Efficiency
  {
    type: 'function',
    function: {
      name: 'calcCarnotEfficiency',
      description: 'Calculates the theoretical maximum Carnot thermodynamic efficiency between hot and cold reservoirs.',
      parameters: {
        type: 'object',
        properties: {
          tHot: { type: 'number', description: 'Hot reservoir temperature' },
          tCold: { type: 'number', description: 'Cold reservoir temperature' },
          tempUnit: { type: 'string', default: 'C' }
        },
        required: ['tHot', 'tCold']
      }
    }
  },

  // 14. Arrhenius Reaction Rate Constant
  {
    type: 'function',
    function: {
      name: 'calcArrheniusRateConstant',
      description: 'Calculates chemical reaction rate constant k(T) using the Arrhenius kinetic equation.',
      parameters: {
        type: 'object',
        properties: {
          preExponentialFactor: { type: 'number', description: 'Frequency pre-exponential factor A' },
          activationEnergy: { type: 'number', description: 'Activation energy Ea (e.g. 50 kJ/mol)' },
          activationEnergyUnit: { type: 'string', default: 'kJ/mol' },
          temperature: { type: 'number', description: 'Reaction temperature' },
          temperatureUnit: { type: 'string', default: 'C' }
        },
        required: ['preExponentialFactor', 'activationEnergy', 'temperature']
      }
    }
  },

  // 15. Reactor Residence Time
  {
    type: 'function',
    function: {
      name: 'calcReactorResidenceTime',
      description: 'Calculates reactor space time / residence time (τ = V / v0) and space velocity.',
      parameters: {
        type: 'object',
        properties: {
          reactorVolume: { type: 'number', description: 'Reactor volume' },
          reactorVolumeUnit: { type: 'string', default: 'm3' },
          volumetricFlow: { type: 'number', description: 'Feed volumetric flow rate' },
          volumetricFlowUnit: { type: 'string', default: 'm3/h' }
        },
        required: ['reactorVolume', 'volumetricFlow']
      }
    }
  },

  // 16. CSTR Reactor Sizing
  {
    type: 'function',
    function: {
      name: 'calcCSTRSizing',
      description: 'Calculates required CSTR reactor volume and residence time for target conversion.',
      parameters: {
        type: 'object',
        properties: {
          volumetricFlow: { type: 'number', description: 'Feed flow rate' },
          volumetricFlowUnit: { type: 'string', default: 'm3/h' },
          feedConcentration: { type: 'number', description: 'Initial reactant concentration CA0 (mol/L or mol/m³)' },
          concentrationUnit: { type: 'string', default: 'mol/L' },
          targetConversion: { type: 'number', description: 'Target fractional conversion XA (e.g. 0.85 for 85%)' },
          rateConstant: { type: 'number', description: 'Reaction rate constant k' },
          reactionOrder: { type: 'number', description: 'Reaction order (default 1)', default: 1 }
        },
        required: ['volumetricFlow', 'feedConcentration', 'targetConversion', 'rateConstant']
      }
    }
  },

  // 17. Distillation Fenske Minimum Stages
  {
    type: 'function',
    function: {
      name: 'calcFenskeMinimumStages',
      description: 'Calculates minimum equilibrium stages (N_min) in distillation at total reflux using the Fenske equation.',
      parameters: {
        type: 'object',
        properties: {
          distillatePurity: { type: 'number', description: 'Distillate light key mole fraction xD (e.g. 0.95)' },
          bottomsPurity: { type: 'number', description: 'Bottoms light key mole fraction xB (e.g. 0.05)' },
          relativeVolatility: { type: 'number', description: 'Average relative volatility α (e.g. 2.4)' }
        },
        required: ['distillatePurity', 'bottomsPurity', 'relativeVolatility']
      }
    }
  },

  // 18. Distillation Minimum Reflux Ratio
  {
    type: 'function',
    function: {
      name: 'calcBinaryMinReflux',
      description: 'Calculates minimum reflux ratio (R_min) and recommended operating reflux for binary distillation.',
      parameters: {
        type: 'object',
        properties: {
          feedMoleFraction: { type: 'number', description: 'Feed light key mole fraction zF (e.g. 0.50)' },
          distillateMoleFraction: { type: 'number', description: 'Distillate light key mole fraction xD (e.g. 0.95)' },
          relativeVolatility: { type: 'number', description: 'Relative volatility α (e.g. 2.5)' }
        },
        required: ['feedMoleFraction', 'distillateMoleFraction', 'relativeVolatility']
      }
    }
  },

  // 19. Binary Separator Material Balance
  {
    type: 'function',
    function: {
      name: 'calcBinaryMaterialBalance',
      description: 'Performs macroscopic steady-state mass/mole balance across a distillation column or flash separator (F = D + B).',
      parameters: {
        type: 'object',
        properties: {
          feedFlow: { type: 'number', description: 'Total feed flow rate' },
          feedFlowUnit: { type: 'string', default: 'kg/h' },
          feedFraction: { type: 'number', description: 'Feed light component fraction zF' },
          distillateFraction: { type: 'number', description: 'Distillate light component fraction xD' },
          bottomsFraction: { type: 'number', description: 'Bottoms light component fraction xB' }
        },
        required: ['feedFlow', 'feedFraction', 'distillateFraction', 'bottomsFraction']
      }
    }
  },

  // 20. PID Controller Error
  {
    type: 'function',
    function: {
      name: 'calcControllerError',
      description: 'Calculates instantaneous tracking error e(t) and relative % error between Setpoint and Process Variable.',
      parameters: {
        type: 'object',
        properties: {
          setpoint: { type: 'number', description: 'Target Setpoint value (SP)' },
          processVariable: { type: 'number', description: 'Current Process Variable value (PV)' },
          actionType: { type: 'string', description: 'direct (SP-PV) or reverse (PV-SP)', default: 'direct' }
        },
        required: ['setpoint', 'processVariable']
      }
    }
  },

  // 21. PID Output Calculation
  {
    type: 'function',
    function: {
      name: 'calcPIDOutput',
      description: 'Calculates the P, I, D terms and clamped actuator output percentage for a PID control loop.',
      parameters: {
        type: 'object',
        properties: {
          controllerGain: { type: 'number', description: 'Proportional gain Kc' },
          integralTime: { type: 'number', description: 'Integral reset time Ti (seconds or minutes)' },
          derivativeTime: { type: 'number', description: 'Derivative time Td (seconds or minutes)', default: 0 },
          error: { type: 'number', description: 'Current error e = SP - PV' },
          integralError: { type: 'number', description: 'Accumulated integral of error', default: 0 },
          derivativeError: { type: 'number', description: 'Rate of change de/dt', default: 0 },
          bias: { type: 'number', description: 'Actuator baseline bias %', default: 50.0 }
        },
        required: ['controllerGain', 'error']
      }
    }
  },

  // 22. Control Valve Cv Sizing
  {
    type: 'function',
    function: {
      name: 'calcControlValveCv',
      description: 'Calculates required valve flow coefficient (Cv and Kv) and recommended nominal valve body size for liquid service.',
      parameters: {
        type: 'object',
        properties: {
          flowRate: { type: 'number', description: 'Volumetric flow rate' },
          flowUnit: { type: 'string', description: 'gpm, m3/h, L/min', default: 'gpm' },
          pressureDrop: { type: 'number', description: 'Pressure drop ΔP across valve' },
          pressureDropUnit: { type: 'string', description: 'psi, bar, kPa', default: 'psi' },
          specificGravity: { type: 'number', description: 'Liquid specific gravity (water = 1.0)', default: 1.0 }
        },
        required: ['flowRate', 'pressureDrop']
      }
    }
  },

  // 23. Storage Tank Volume & Hold-up Time
  {
    type: 'function',
    function: {
      name: 'calcTankVolumeAndHoldTime',
      description: 'Calculates geometric volume and continuous hold-up residence time of storage and surge vessels.',
      parameters: {
        type: 'object',
        properties: {
          diameter: { type: 'number', description: 'Tank inner diameter' },
          diameterUnit: { type: 'string', default: 'm' },
          height: { type: 'number', description: 'Tank height or length' },
          heightUnit: { type: 'string', default: 'm' },
          flowRate: { type: 'number', description: 'Throughput flow rate' },
          flowUnit: { type: 'string', default: 'm3/h' }
        },
        required: ['diameter', 'height']
      }
    }
  }
];

/**
 * Map of tool names to their implementation functions
 */
export const TOOL_FUNCTION_MAP = {
  calcPipeVelocity: Fluid.calcPipeVelocity,
  calcReynoldsNumber: Fluid.calcReynoldsNumber,
  calcDarcyWeisbachPressureDrop: Fluid.calcDarcyWeisbachPressureDrop,
  calcPumpHydraulicPower: Fluid.calcPumpHydraulicPower,
  calcNPSHAvailable: Fluid.calcNPSHAvailable,
  calcPipeSizing: Fluid.calcPipeSizing,
  calcSensibleHeatDuty: Heat.calcSensibleHeatDuty,
  calcLMTD: Heat.calcLMTD,
  calcHeatExchangerSizing: Heat.calcHeatExchangerSizing,
  calcConductionHeat: Heat.calcConductionHeat,
  calcIdealGasLaw: Thermo.calcIdealGasLaw,
  calcCompressorPower: Thermo.calcCompressorPower,
  calcCarnotEfficiency: Thermo.calcCarnotEfficiency,
  calcArrheniusRateConstant: Reaction.calcArrheniusRateConstant,
  calcReactorResidenceTime: Reaction.calcReactorResidenceTime,
  calcCSTRSizing: Reaction.calcCSTRSizing,
  calcFenskeMinimumStages: Mass.calcFenskeMinimumStages,
  calcBinaryMinReflux: Mass.calcBinaryMinReflux,
  calcBinaryMaterialBalance: Mass.calcBinaryMaterialBalance,
  calcControllerError: Control.calcControllerError,
  calcPIDOutput: Control.calcPIDOutput,
  calcControlValveCv: Equipment.calcControlValveCv,
  calcTankVolumeAndHoldTime: Equipment.calcTankVolumeAndHoldTime
};

/**
 * Dispatcher function to execute any registered engineering tool
 */
export async function executeEngineeringTool(toolName, rawArgs = {}, liveState = null) {
  const fn = TOOL_FUNCTION_MAP[toolName];
  if (!fn) {
    throw new Error(`Unknown engineering tool: ${toolName}. Available tools: ${Object.keys(TOOL_FUNCTION_MAP).join(', ')}`);
  }

  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : { ...rawArgs };

  // If calculating with live ChemDiag process pump telemetry:
  if (toolName === 'calcPumpHydraulicPower' && liveState && (!args.flowRate || !args.head)) {
    const pumpData = liveState.equipment?.pump?.data || {};
    if (!args.flowRate && pumpData.flow) {
      args.flowRate = pumpData.flow;
      args.flowUnit = 'L/min';
    }
    if (!args.head && !args.deltaP) {
      // Nominal head estimate from RPM (H ≈ (RPM/2450)² * 20m)
      const rpm = pumpData.rpm || 2450;
      args.head = Number(((rpm / 2450) ** 2 * 20.0).toFixed(1));
      args.headUnit = 'm';
    }
  }

  // If calculating with live ChemDiag heat exchanger telemetry:
  if (toolName === 'calcSensibleHeatDuty' && liveState && (!args.deltaT && !args.tIn)) {
    const hxData = liveState.equipment?.heat_exchanger?.data || {};
    const pumpData = liveState.equipment?.pump?.data || {};
    if (hxData.inlet_temperature !== undefined && hxData.outlet_temperature !== undefined) {
      args.tIn = hxData.inlet_temperature;
      args.tOut = hxData.outlet_temperature;
      args.tempUnit = 'C';
    }
    if (!args.massFlow && pumpData.flow) {
      // 1 L/min water ≈ (1/60) kg/s
      args.massFlow = Number((pumpData.flow / 60.0).toFixed(3));
      args.massFlowUnit = 'kg/s';
    }
  }

  return fn(args);
}
