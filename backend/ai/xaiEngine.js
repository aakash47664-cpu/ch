/**
 * ChemDiag AI — Explainable AI (XAI) Feature Attribution Engine
 * 
 * Computes transparent, data-driven feature contributions based on normalized
 * continuous deviation from nominal baselines.
 * 
 * Provides clear attribution for: "WHY DID AI DETECT THIS?" with dynamic percentages summing to 100%.
 */

const NOMINAL_BASELINES = {
  pump_rpm: { mean: 2450, std: 50, label: 'Pump Speed', unit: 'RPM', expectLowerOnFault: true },
  pump_vibration: { mean: 0.08, std: 0.03, label: 'Casing Vibration', unit: 'g', expectLowerOnFault: false },
  pump_flow: { mean: 10.0, std: 0.5, label: 'Discharge Flow', unit: 'L/min', expectLowerOnFault: true },
  pump_outlet_temp: { mean: 38.1, std: 1.2, label: 'Discharge Temp', unit: '°C', expectLowerOnFault: false },

  hx_delta_t: { mean: 12.9, std: 1.0, label: 'Exchanger ΔT Gradient', unit: '°C', expectLowerOnFault: true },
  hx_efficiency: { mean: 95.0, std: 2.5, label: 'Exchanger Efficiency', unit: '%', expectLowerOnFault: true },
  hx_outlet_temp: { mean: 38.1, std: 1.2, label: 'Effluent Temp', unit: '°C', expectLowerOnFault: false },

  reactor_temp: { mean: 65.0, std: 1.5, label: 'Reaction Core Temp', unit: '°C', expectLowerOnFault: false },
  reactor_press: { mean: 2.05, std: 0.1, label: 'Vessel Vapor Pressure', unit: 'bar', expectLowerOnFault: false },
  reactor_cooling: { mean: 1.0, std: 0.1, label: 'Cooling Interlock', unit: 'Status', expectLowerOnFault: true },

  dist_reflux: { mean: 1.85, std: 0.15, label: 'Reflux Ratio', unit: 'L/D', expectLowerOnFault: true },
  dist_top_temp: { mean: 76.5, std: 1.2, label: 'Top Vapor Temp', unit: '°C', expectLowerOnFault: false },
  dist_press: { mean: 2.10, std: 0.1, label: 'Column Pressure', unit: 'bar', expectLowerOnFault: false }
};

export function calculateFeatureContributions({
  telemetry,
  faultType = 'normal',
  equipment = 'all'
}) {
  const pVib = telemetry.pump_vibration ?? 0.08;
  const pRpm = telemetry.pump_rpm ?? 2450;
  const pFlow = telemetry.pump_flow ?? ((pRpm / 2450) * 10.0);
  const pOutTemp = telemetry.pump_outlet_temperature ?? 38.1;

  const hxInTemp = telemetry.heat_exchanger_inlet_temperature ?? 25.2;
  const hxOutTemp = telemetry.heat_exchanger_outlet_temperature ?? 38.1;
  const deltaT = Math.abs(hxOutTemp - hxInTemp);
  const hxEff = telemetry.heat_exchanger_efficiency ?? 95.0;

  const rTemp = telemetry.reactor_temperature ?? 65.0;
  const rPress = telemetry.reactor_pressure ?? 2.05;
  const rCooling = telemetry.reactor_cooling_status ?? 1;

  const dReflux = telemetry.distillation_reflux_ratio ?? 1.85;
  const dTopTemp = telemetry.distillation_top_temperature ?? 76.5;
  const dPress = telemetry.distillation_pressure ?? 2.10;

  // Compute deviations per feature
  const deviations = [];

  const addDev = (key, currentVal, customLabel, isDown) => {
    const base = NOMINAL_BASELINES[key];
    if (!base) return;
    const rawDev = Math.abs(currentVal - base.mean);
    const zScore = rawDev / base.std;
    if (zScore > 0.4) {
      deviations.push({
        feature: key,
        label: customLabel || base.label,
        currentVal,
        baselineVal: base.mean,
        unit: base.unit,
        zScore,
        isDown: currentVal < base.mean,
        direction: currentVal < base.mean ? '↓' : '↑'
      });
    }
  };

  // Unit-targeted evaluation
  if (faultType.includes('pump') || equipment === 'pump') {
    addDev('pump_rpm', pRpm, 'Pump Rotational Speed', true);
    addDev('pump_vibration', pVib, 'Casing Vibration Magnitude', false);
    addDev('pump_flow', pFlow, 'Discharge Flow Rate', true);
    addDev('pump_outlet_temp', pOutTemp, 'Discharge Temperature', false);
  } else if (faultType.includes('heat') || equipment === 'heat_exchanger') {
    addDev('hx_delta_t', deltaT, 'Thermal Difference ΔT', true);
    addDev('hx_efficiency', hxEff, 'Heat Transfer Efficiency', true);
    addDev('hx_outlet_temp', hxOutTemp, 'Outlet Stream Temperature', false);
  } else if (faultType.includes('reactor') || equipment === 'reactor') {
    addDev('reactor_temp', rTemp, 'Reactor Core Temperature', false);
    addDev('reactor_press', rPress, 'Vessel Vapor Pressure', false);
    if (rCooling === 0) {
      deviations.push({
        feature: 'reactor_cooling',
        label: 'Cooling Jacket Status',
        currentVal: 0,
        baselineVal: 1,
        unit: '',
        zScore: 6.0,
        isDown: true,
        direction: '↓'
      });
    }
  } else if (faultType.includes('distillation') || equipment === 'distillation') {
    addDev('dist_reflux', dReflux, 'Reflux Ratio (L/D)', true);
    addDev('dist_top_temp', dTopTemp, 'Top Overhead Temperature', false);
    addDev('dist_press', dPress, 'Column Operating Pressure', false);
  } else {
    // Check all systems for multivariate anomaly / unknown fault
    addDev('pump_vibration', pVib, 'Pump Vibration', false);
    addDev('pump_rpm', pRpm, 'Pump Speed', true);
    addDev('reactor_temp', rTemp, 'Reactor Temperature', false);
    addDev('reactor_press', rPress, 'Reactor Pressure', false);
    addDev('hx_delta_t', deltaT, 'Exchanger ΔT', true);
    addDev('dist_reflux', dReflux, 'Distillation Reflux', true);
  }

  if (deviations.length === 0) {
    return [
      { feature: 'nominal', label: 'All variables within nominal tolerance', change: '✓ Nominal', contributionPercent: 100, isUp: false }
    ];
  }

  // Sort by zScore descending
  deviations.sort((a, b) => b.zScore - a.zScore);

  // Take top 4 features and normalize to sum to 100%
  const topDevs = deviations.slice(0, 4);
  const totalZ = topDevs.reduce((sum, d) => sum + d.zScore, 0);

  let accumulatedPercent = 0;
  const contributions = topDevs.map((d, index) => {
    let percent;
    if (index === topDevs.length - 1) {
      percent = 100 - accumulatedPercent;
    } else {
      percent = Math.round((d.zScore / totalZ) * 100);
      accumulatedPercent += percent;
    }
    percent = Math.max(1, percent);

    return {
      feature: d.feature,
      label: d.label,
      change: `${d.direction} ${d.currentVal?.toFixed ? d.currentVal.toFixed(1) : d.currentVal} ${d.unit}`,
      contributionPercent: percent,
      isUp: d.direction === '↑',
      zScore: Number(d.zScore.toFixed(2))
    };
  });

  return contributions;
}
