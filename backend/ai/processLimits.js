/**
 * ChemDiag AI — Prototype Process Operating Limits
 * 
 * DISCLAIMER:
 * These limits are PROTOTYPE demonstration parameters for testing decision-support logic,
 * NOT certified industrial safety limits.
 */

export const PROTOTYPE_LIMITS = {
  pump: {
    name: 'P-101 Centrifugal Pump',
    rpm: {
      nominal_min: 2300,
      nominal_max: 2600,
      early_warning_min: 2000,
      early_warning_max: 2300,
      developing_min: 1800,
      developing_max: 2000,
      critical_max_drop: 1600,
      unit: 'RPM'
    },
    vibration: {
      nominal_max: 0.20,
      early_warning_max: 0.30,
      developing_max: 0.40,
      high_risk_max: 0.50,
      critical_threshold: 0.50,
      unit: 'g'
    },
    flow: {
      nominal_min: 8.0,
      nominal_max: 11.0,
      early_warning_min: 7.0,
      developing_min: 6.0,
      high_risk_min: 5.0,
      critical_min: 5.0,
      unit: 'L/min'
    },
    outlet_temperature: {
      nominal_max: 40.0,
      warning_max: 45.0,
      critical_max: 55.0,
      unit: '°C'
    }
  },

  heat_exchanger: {
    name: 'E-101 Shell & Tube Exchanger',
    temperature_difference: {
      nominal_min: 6.0,
      nominal_max: 14.0,
      early_warning_min: 4.0,
      early_warning_max: 6.0,
      developing_min: 3.0,
      developing_max: 4.0,
      high_risk_min: 2.0,
      high_risk_max: 3.0,
      critical_threshold: 2.0,
      unit: '°C'
    },
    efficiency: {
      nominal_min: 75.0,
      early_warning_min: 60.0,
      developing_min: 50.0,
      high_risk_min: 40.0,
      critical_threshold: 40.0,
      unit: '%'
    },
    inlet_temperature: {
      nominal_min: 20.0,
      nominal_max: 32.0,
      unit: '°C'
    },
    outlet_temperature: {
      nominal_min: 30.0,
      nominal_max: 45.0,
      unit: '°C'
    }
  },

  reactor: {
    name: 'R-101 Continuous Stirred-Tank Reactor',
    temperature: {
      nominal_min: 60.0,
      nominal_max: 75.0,
      early_warning_max: 78.0,
      developing_max: 84.0,
      high_risk_max: 90.0,
      critical_threshold: 90.0,
      unit: '°C'
    },
    pressure: {
      nominal_min: 1.80,
      nominal_max: 2.30,
      early_warning_max: 2.50,
      developing_max: 2.80,
      high_risk_max: 3.20,
      critical_threshold: 3.20,
      unit: 'bar'
    },
    level: {
      nominal_min: 40.0,
      nominal_max: 80.0,
      unit: '%'
    },
    agitator_speed: {
      nominal_min: 250,
      nominal_max: 380,
      unit: 'RPM'
    }
  },

  distillation: {
    name: 'D-101 Binary Distillation Column',
    reflux_ratio: {
      nominal_min: 1.50,
      nominal_max: 2.40,
      early_warning_min: 1.20,
      developing_min: 0.90,
      high_risk_min: 0.65,
      critical_threshold: 0.65,
      unit: 'L/D'
    },
    top_temperature: {
      nominal_min: 74.0,
      nominal_max: 80.0,
      early_warning_max: 82.0,
      developing_max: 85.0,
      high_risk_max: 88.0,
      critical_threshold: 88.0,
      unit: '°C'
    },
    bottom_temperature: {
      nominal_min: 95.0,
      nominal_max: 115.0,
      unit: '°C'
    },
    pressure: {
      nominal_min: 1.80,
      nominal_max: 2.30,
      warning_max: 2.60,
      critical_threshold: 3.00,
      unit: 'bar'
    },
    level: {
      nominal_min: 40.0,
      nominal_max: 80.0,
      unit: '%'
    }
  }
};

/**
 * Checks telemetry against prototype operating limits and returns violations
 */
export function evaluateOperatingLimits(telemetry) {
  const violations = [];
  const pLimits = PROTOTYPE_LIMITS;

  // Pump checks
  const pVib = telemetry.pump_vibration ?? 0.08;
  const pRpm = telemetry.pump_rpm ?? 2450;
  const pFlow = telemetry.pump_flow ?? ((pRpm / 2450) * 10.0);

  if (pVib > pLimits.pump.vibration.critical_threshold) {
    violations.push({ equipment: 'pump', parameter: 'vibration', severity: 'CRITICAL', value: pVib, limit: pLimits.pump.vibration.critical_threshold, unit: 'g' });
  } else if (pVib > pLimits.pump.vibration.early_warning_max) {
    violations.push({ equipment: 'pump', parameter: 'vibration', severity: 'WARNING', value: pVib, limit: pLimits.pump.vibration.early_warning_max, unit: 'g' });
  }

  if (pRpm < pLimits.pump.rpm.critical_max_drop) {
    violations.push({ equipment: 'pump', parameter: 'rpm', severity: 'CRITICAL', value: pRpm, limit: pLimits.pump.rpm.critical_max_drop, unit: 'RPM' });
  } else if (pRpm < pLimits.pump.rpm.early_warning_max) {
    violations.push({ equipment: 'pump', parameter: 'rpm', severity: 'WARNING', value: pRpm, limit: pLimits.pump.rpm.early_warning_max, unit: 'RPM' });
  }

  // Heat Exchanger checks
  const deltaT = Math.abs((telemetry.heat_exchanger_outlet_temperature ?? 38.1) - (telemetry.heat_exchanger_inlet_temperature ?? 25.2));
  if (deltaT < pLimits.heat_exchanger.temperature_difference.critical_threshold) {
    violations.push({ equipment: 'heat_exchanger', parameter: 'deltaT', severity: 'CRITICAL', value: Number(deltaT.toFixed(1)), limit: pLimits.heat_exchanger.temperature_difference.critical_threshold, unit: '°C' });
  } else if (deltaT < pLimits.heat_exchanger.temperature_difference.early_warning_min) {
    violations.push({ equipment: 'heat_exchanger', parameter: 'deltaT', severity: 'WARNING', value: Number(deltaT.toFixed(1)), limit: pLimits.heat_exchanger.temperature_difference.early_warning_min, unit: '°C' });
  }

  // Reactor checks
  const rTemp = telemetry.reactor_temperature ?? 65.0;
  const rPress = telemetry.reactor_pressure ?? 2.05;
  const rCooling = telemetry.reactor_cooling_status ?? 1;

  if (rCooling === 0 || rTemp > pLimits.reactor.temperature.critical_threshold || rPress > pLimits.reactor.pressure.critical_threshold) {
    violations.push({ equipment: 'reactor', parameter: 'temperature_pressure', severity: 'CRITICAL', value: `${rTemp.toFixed(1)}°C / ${rPress.toFixed(2)}bar`, limit: 'Critical Safe Envelope', unit: '' });
  } else if (rTemp > pLimits.reactor.temperature.early_warning_max || rPress > pLimits.reactor.pressure.early_warning_max) {
    violations.push({ equipment: 'reactor', parameter: 'temperature_pressure', severity: 'WARNING', value: `${rTemp.toFixed(1)}°C / ${rPress.toFixed(2)}bar`, limit: 'Early Warning Envelope', unit: '' });
  }

  // Distillation checks
  const dReflux = telemetry.distillation_reflux_ratio ?? 1.85;
  const dTopTemp = telemetry.distillation_top_temperature ?? 76.5;

  if (dReflux < pLimits.distillation.reflux_ratio.critical_threshold) {
    violations.push({ equipment: 'distillation', parameter: 'reflux_ratio', severity: 'CRITICAL', value: Number(dReflux.toFixed(2)), limit: pLimits.distillation.reflux_ratio.critical_threshold, unit: 'L/D' });
  } else if (dReflux < pLimits.distillation.reflux_ratio.early_warning_min) {
    violations.push({ equipment: 'distillation', parameter: 'reflux_ratio', severity: 'WARNING', value: Number(dReflux.toFixed(2)), limit: pLimits.distillation.reflux_ratio.early_warning_min, unit: 'L/D' });
  }

  return violations;
}
