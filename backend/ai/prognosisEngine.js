/**
 * ChemDiag AI — Fault Progression & Prognosis Engine
 * 
 * Estimates current physical degradation level (0–100%), trend velocity,
 * risk progression stage, and estimated time-to-threshold.
 * 
 * DISCLAIMER:
 * Labeled as "Prototype Trend Estimate" — provides decision support without claiming certified remaining-useful-life accuracy.
 */

export function calculatePrognosis({
  equipment,
  faultMode = 'normal',
  faultSeverity = 0.0,
  faultTicks = 0,
  telemetry = {}
}) {
  let degradationPercent = 0;
  let trend = 'STABLE';
  let riskStage = 'NORMAL';
  let timeToThreshold = 'Operating at nominal steady state';
  let narrative = 'Process condition is stable and within nominal operating envelopes.';

  if (faultMode === 'normal' || faultSeverity <= 0.05) {
    return {
      degradationPercent: Math.round(faultSeverity * 100),
      trend: 'STABLE',
      riskStage: 'NORMAL',
      timeToThreshold: 'Operating nominally',
      narrative: 'All continuous parameters operating stably within baseline design limits.',
      isEarlyWarning: false,
      isCritical: false
    };
  }

  // Calculate degradation based on fault mode & progressive fault severity
  degradationPercent = Math.min(100, Math.round(faultSeverity * 100));

  if (faultSeverity < 0.25) {
    riskStage = 'EARLY_WARNING';
  } else if (faultSeverity < 0.50) {
    riskStage = 'DEVELOPING';
  } else if (faultSeverity < 0.75) {
    riskStage = 'HIGH_RISK';
  } else {
    riskStage = 'CRITICAL';
  }

  trend = faultTicks > 2 ? 'INCREASING' : 'DEVELOPING';

  // Estimate time-to-threshold (prototype extrapolation)
  const remainingSeverityToAlarm = Math.max(0, 0.75 - faultSeverity);
  const estimatedSeconds = Math.round(remainingSeverityToAlarm * 60 + 15);
  const estimatedMinutes = Math.max(1, Math.round(estimatedSeconds / 60));

  if (faultMode.includes('pump')) {
    const pVib = telemetry.pump_vibration ?? 0.08;
    const pRpm = telemetry.pump_rpm ?? 2450;
    if (riskStage === 'EARLY_WARNING') {
      timeToThreshold = `At current degradation rate, critical threshold may be reached in ~${estimatedMinutes + 12} min`;
      narrative = `Early mechanical degradation detected: vibration (${pVib.toFixed(2)} g) is increasing while RPM (${Math.round(pRpm)}) is trending downward.`;
    } else if (riskStage === 'DEVELOPING') {
      timeToThreshold = `Warning threshold estimated in ~${estimatedMinutes + 4} min`;
      narrative = `Condition is worsening based on recent vibration/RPM trend. Approaching high risk envelope.`;
    } else {
      timeToThreshold = `Critical operating envelope reached`;
      narrative = `High dynamic vibration (${pVib.toFixed(2)} g) and motor slip require prompt operator maintenance verification.`;
    }
  } else if (faultMode.includes('heat') || faultMode.includes('exchanger')) {
    const deltaT = Math.abs((telemetry.heat_exchanger_outlet_temperature ?? 38.1) - (telemetry.heat_exchanger_inlet_temperature ?? 25.2));
    if (riskStage === 'EARLY_WARNING') {
      timeToThreshold = `Fouling limit estimated in ~${estimatedMinutes + 15} min`;
      narrative = `Early thermal boundary degradation: ΔT has dropped to ${deltaT.toFixed(1)}°C with gradual heat transfer resistance buildup.`;
    } else {
      timeToThreshold = `Thermal gradient collapse reached (< 4.0°C)`;
      narrative = `Severe tube fouling scale accumulation causing significant heat transfer coefficient degradation.`;
    }
  } else if (faultMode.includes('reactor')) {
    const rTemp = telemetry.reactor_temperature ?? 65.0;
    const rPress = telemetry.reactor_pressure ?? 2.05;
    if (riskStage === 'EARLY_WARNING') {
      timeToThreshold = `Thermal runaway threshold estimated in ~${estimatedMinutes + 8} min`;
      narrative = `Cooling capacity degraded: Reaction temperature (${rTemp.toFixed(1)}°C) and vapor pressure (${rPress.toFixed(2)} bar) are escalating.`;
    } else {
      timeToThreshold = `Thermal runaway trip condition active`;
      narrative = `Exothermic Arrhenius runaway risk due to loss of jacket heat dissipation. Immediate operator quench verification required.`;
    }
  } else if (faultMode.includes('distillation')) {
    const dReflux = telemetry.distillation_reflux_ratio ?? 1.85;
    if (riskStage === 'EARLY_WARNING') {
      timeToThreshold = `Separation off-spec limit in ~${estimatedMinutes + 10} min`;
      narrative = `Reflux ratio (${dReflux.toFixed(2)}) is decaying, leading to overhead vapor fraction slip.`;
    } else {
      timeToThreshold = `Column starvation limit reached`;
      narrative = `Low liquid reflux return causing off-spec top distillate and column vapor pressure rise.`;
    }
  } else if (faultMode === 'unknown_fault') {
    narrative = 'Uncharacteristic multivariate deviation with uncertain degradation trajectory. Operator verification required.';
    timeToThreshold = 'Trajectory indeterminate (Unclassified multivariate anomaly)';
  }

  return {
    degradationPercent,
    trend,
    riskStage,
    timeToThreshold,
    narrative,
    isEarlyWarning: riskStage === 'EARLY_WARNING',
    isCritical: riskStage === 'CRITICAL'
  };
}
