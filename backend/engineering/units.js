/**
 * ChemDiag Engineering Unit Conversion Engine
 * 
 * Provides robust, deterministic unit conversion across all standard chemical
 * and industrial engineering physical dimensions:
 * - Pressure (Pa, kPa, bar, psi, atm, mmHg, mH2O)
 * - Temperature (C, F, K, R)
 * - Volumetric Flow (m3/s, m3/h, L/s, L/min, gpm, ft3/s, cfm)
 * - Mass Flow (kg/s, kg/h, t/h, lb/s, lb/h, lb/min)
 * - Length / Diameter (m, cm, mm, in, ft, yd)
 * - Area (m2, cm2, mm2, in2, ft2)
 * - Volume (m3, L, mL, gallon, ft3, bbl)
 * - Energy / Heat (J, kJ, MJ, GJ, cal, kcal, Btu, kWh)
 * - Power (W, kW, MW, hp, Btu/h, kcal/h)
 * - Density (kg/m3, g/cm3, g/mL, lb/ft3, lb/gal)
 * - Dynamic Viscosity (Pa.s, cP, P, kg/(m.s), lb/(ft.s))
 * - Kinematic Viscosity (m2/s, cSt, St, ft2/s)
 * - Time (s, min, h, d)
 */

// Factors to convert FROM unit TO standard base SI unit (Base SI = value * factor)
const UNIT_FACTORS = {
  // Pressure -> Base SI: Pascal (Pa)
  pressure: {
    pa: 1.0,
    kpa: 1000.0,
    mpa: 1e6,
    bar: 100000.0,
    mbar: 100.0,
    psi: 6894.757,
    psia: 6894.757,
    psig: 6894.757, // Assumes gauge normalized separately if atmospheric reference given
    atm: 101325.0,
    mmhg: 133.322,
    torr: 133.322,
    inhg: 3386.39,
    mh2o: 9806.65,
    inh2o: 249.0889
  },

  // Volumetric Flow -> Base SI: m³/s
  volumetric_flow: {
    'm3/s': 1.0,
    'm3/hr': 1.0 / 3600.0,
    'm3/h': 1.0 / 3600.0,
    'l/s': 0.001,
    'l/min': 0.001 / 60.0,
    'l/h': 0.001 / 3600.0,
    'l/hr': 0.001 / 3600.0,
    gpm: 0.0000630901964,
    'ft3/s': 0.0283168,
    'ft3/min': 0.0283168 / 60.0,
    cfm: 0.0283168 / 60.0,
    'ft3/hr': 0.0283168 / 3600.0,
    'ft3/h': 0.0283168 / 3600.0,
    bph: 0.158987 / 3600.0, // barrels per hour
    bpd: 0.158987 / 86400.0  // barrels per day
  },

  // Mass Flow -> Base SI: kg/s
  mass_flow: {
    'kg/s': 1.0,
    'kg/min': 1.0 / 60.0,
    'kg/h': 1.0 / 3600.0,
    'kg/hr': 1.0 / 3600.0,
    't/h': 1000.0 / 3600.0,
    't/hr': 1000.0 / 3600.0,
    'tonne/h': 1000.0 / 3600.0,
    'lb/s': 0.45359237,
    'lb/min': 0.45359237 / 60.0,
    'lb/h': 0.45359237 / 3600.0,
    'lb/hr': 0.45359237 / 3600.0,
    'g/s': 0.001,
    'g/min': 0.001 / 60.0
  },

  // Length / Diameter -> Base SI: meter (m)
  length: {
    m: 1.0,
    cm: 0.01,
    mm: 0.001,
    micron: 1e-6,
    um: 1e-6,
    in: 0.0254,
    inch: 0.0254,
    inches: 0.0254,
    ft: 0.3048,
    foot: 0.3048,
    feet: 0.3048,
    yd: 0.9144,
    km: 1000.0,
    mi: 1609.34
  },

  // Area -> Base SI: m²
  area: {
    m2: 1.0,
    cm2: 1e-4,
    mm2: 1e-6,
    in2: 0.00064516,
    sqin: 0.00064516,
    ft2: 0.092903,
    sqft: 0.092903,
    hectare: 10000.0,
    acre: 4046.86
  },

  // Volume -> Base SI: m³
  volume: {
    m3: 1.0,
    l: 0.001,
    liter: 0.001,
    liters: 0.001,
    ml: 1e-6,
    gal: 0.00378541,
    gallon: 0.00378541,
    gallons: 0.00378541,
    ft3: 0.0283168,
    in3: 1.6387e-5,
    bbl: 0.158987 // barrel
  },

  // Energy / Heat -> Base SI: Joule (J)
  energy: {
    j: 1.0,
    kj: 1000.0,
    mj: 1e6,
    gj: 1e9,
    cal: 4.184,
    kcal: 4184.0,
    btu: 1055.06,
    mmbtu: 1055.06 * 1e6,
    kwh: 3.6e6,
    mwh: 3.6e9,
    hp_hr: 2.6845e6
  },

  // Power / Heat Rate -> Base SI: Watt (W)
  power: {
    w: 1.0,
    kw: 1000.0,
    mw: 1e6,
    gw: 1e9,
    hp: 745.7,
    'btu/h': 0.293071,
    'btu/hr': 0.293071,
    'mmbtu/h': 293071.0,
    'mmbtu/hr': 293071.0,
    'kcal/h': 1.163,
    'kcal/hr': 1.163
  },

  // Density -> Base SI: kg/m³
  density: {
    'kg/m3': 1.0,
    'g/cm3': 1000.0,
    'g/ml': 1000.0,
    'kg/l': 1000.0,
    'lb/ft3': 16.0185,
    'lb/gal': 119.826,
    'sg': 1000.0 // specific gravity relative to water at 4°C
  },

  // Dynamic Viscosity -> Base SI: Pa·s (Pascal-second)
  dynamic_viscosity: {
    'pa.s': 1.0,
    'pa*s': 1.0,
    'pas': 1.0,
    'cp': 0.001, // centipoise (water at 20°C ≈ 1.0 cP)
    'p': 0.1,    // poise
    'kg/(m.s)': 1.0,
    'kg/(m*s)': 1.0,
    'n.s/m2': 1.0,
    'lb/(ft.s)': 1.48816,
    'lb/(ft*s)': 1.48816,
    'lb/(ft.h)': 0.000413379,
    'lb/(ft*h)': 0.000413379
  },

  // Kinematic Viscosity -> Base SI: m²/s
  kinematic_viscosity: {
    'm2/s': 1.0,
    'cst': 1e-6, // centistokes
    'st': 1e-4,  // stokes
    'ft2/s': 0.092903,
    'mm2/s': 1e-6
  },

  // Time -> Base SI: second (s)
  time: {
    s: 1.0,
    sec: 1.0,
    seconds: 1.0,
    min: 60.0,
    minute: 60.0,
    minutes: 60.0,
    h: 3600.0,
    hr: 3600.0,
    hour: 3600.0,
    hours: 3600.0,
    d: 86400.0,
    day: 86400.0,
    days: 86400.0
  }
};

/**
 * Normalizes a unit string to lower case and removes extra symbols/spaces
 */
export function normalizeUnitString(unit) {
  if (!unit || typeof unit !== 'string') return '';
  return unit
    .toLowerCase()
    .trim()
    .replace(/[°º]/g, '') // remove degree symbols
    .replace(/\s+/g, '')
    .replace(/\^2/g, '2')
    .replace(/\^3/g, '3');
}

/**
 * Converts Temperature across Celsius, Fahrenheit, Kelvin, and Rankine
 */
export function convertTemperature(value, fromUnit, toUnit) {
  const v = Number(value);
  if (isNaN(v)) throw new Error(`Invalid temperature value: ${value}`);

  const from = normalizeUnitString(fromUnit);
  const to = normalizeUnitString(toUnit);

  // 1. Convert to Kelvin
  let kelvin;
  if (from === 'k' || from === 'kelvin') kelvin = v;
  else if (from === 'c' || from === 'celsius' || from === 'centigrade') kelvin = v + 273.15;
  else if (from === 'f' || from === 'fahrenheit') kelvin = (v - 32) * (5 / 9) + 273.15;
  else if (from === 'r' || from === 'rankine') kelvin = v * (5 / 9);
  else throw new Error(`Unknown temperature unit: ${fromUnit}`);

  // 2. Convert from Kelvin to target unit
  if (to === 'k' || to === 'kelvin') return kelvin;
  if (to === 'c' || to === 'celsius' || to === 'centigrade') return kelvin - 273.15;
  if (to === 'f' || to === 'fahrenheit') return (kelvin - 273.15) * (9 / 5) + 32;
  if (to === 'r' || to === 'rankine') return kelvin * (9 / 5);

  throw new Error(`Unknown target temperature unit: ${toUnit}`);
}

/**
 * Converts Temperature DIFFERENCE (ΔT) where 1 K = 1 °C = 1.8 °F = 1.8 °R
 */
export function convertDeltaTemperature(value, fromUnit, toUnit) {
  const v = Number(value);
  if (isNaN(v)) throw new Error(`Invalid delta temperature value: ${value}`);

  const from = normalizeUnitString(fromUnit);
  const to = normalizeUnitString(toUnit);

  // Normalize to Kelvin / Celsius delta
  let deltaK;
  if (from === 'k' || from === 'c' || from === 'celsius' || from === 'kelvin') deltaK = v;
  else if (from === 'f' || from === 'r' || from === 'fahrenheit' || from === 'rankine') deltaK = v / 1.8;
  else throw new Error(`Unknown temperature difference unit: ${fromUnit}`);

  if (to === 'k' || to === 'c' || to === 'celsius' || to === 'kelvin') return deltaK;
  if (to === 'f' || to === 'r' || to === 'fahrenheit' || to === 'rankine') return deltaK * 1.8;

  throw new Error(`Unknown target temperature difference unit: ${toUnit}`);
}

/**
 * Generic unit converter for linear physical dimensions
 */
export function convertUnit(value, fromUnit, toUnit, dimension = null) {
  const v = Number(value);
  if (isNaN(v)) throw new Error(`Invalid numeric value: ${value}`);

  const from = normalizeUnitString(fromUnit);
  const to = normalizeUnitString(toUnit);

  if (from === to) return v;

  // Temperature special case
  if (from === 'c' || from === 'f' || from === 'k' || from === 'r' ||
      from === 'celsius' || from === 'fahrenheit' || from === 'kelvin') {
    return convertTemperature(v, from, to);
  }

  // Find dimension category if not specified
  let category = dimension;
  if (!category) {
    for (const [dimName, dict] of Object.entries(UNIT_FACTORS)) {
      if (dict[from] !== undefined && dict[to] !== undefined) {
        category = dimName;
        break;
      }
    }
  }

  if (!category || !UNIT_FACTORS[category]) {
    throw new Error(`Cannot convert between "${fromUnit}" and "${toUnit}". Incompatible or unrecognized units.`);
  }

  const factorFrom = UNIT_FACTORS[category][from];
  const factorTo = UNIT_FACTORS[category][to];

  if (factorFrom === undefined) throw new Error(`Unrecognized unit "${fromUnit}" in dimension ${category}`);
  if (factorTo === undefined) throw new Error(`Unrecognized unit "${toUnit}" in dimension ${category}`);

  // Value in Base SI
  const baseValue = v * factorFrom;
  // Convert from Base SI to target unit
  return baseValue / factorTo;
}

/**
 * Formats a number cleanly with standard engineering precision (typically 2-4 sig figs or decimals)
 */
export function formatEngineeringNumber(val, maxDecimals = 3) {
  if (val === null || val === undefined || isNaN(val)) return 'N/A';
  const num = Number(val);
  if (num === 0) return '0';
  
  if (Math.abs(num) >= 1e5 || (Math.abs(num) < 1e-3 && Math.abs(num) > 0)) {
    return num.toExponential(3);
  }
  
  // Clean trailing zeros
  const rounded = Number(num.toFixed(maxDecimals));
  return String(rounded);
}
