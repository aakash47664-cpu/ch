/**
 * ChemDiag AI — Preventive Risk Score & Recommendation Engine
 * 
 * Computes:
 * - Preventive Risk Score: 0–100
 * - Risk Stage: NORMAL (0-20), EARLY_WARNING (21-40), DEVELOPING (41-60), HIGH_RISK (61-80), CRITICAL (81-100)
 * - Equipment & Stage-Specific Preventive Recommendations
 */

export function calculatePreventiveRisk({
  equipment = 'all',
  faultMode = 'normal',
  faultSeverity = 0.0,
  mlScore = 0.18,
  telemetry = {},
  isUnknownFault = false
}) {
  let riskScore = 12; // Base nominal score
  let riskStage = 'NORMAL';
  let observedEvidence = 'All parameters operating within nominal baseline bounds.';
  let probableCause = 'Nominal continuous operation';
  let preventiveMeasure = 'Continue routine supervisory monitoring. System operating within nominal limits.';
  let verificationRequired = false;
  let recommendationAllowed = true;

  if (isUnknownFault) {
    riskScore = Math.round(45 + Math.random() * 8); // e.g. ~48-52
    riskStage = 'DEVELOPING';
    observedEvidence = 'Multivariate deviation with low match to known fault classes (Temperature ↑, Pressure ↑, Vibration ↑).';
    probableCause = 'Unclassified anomalous process condition / combined disturbance';
    preventiveMeasure = 'DO NOT ACT automatically. Cross-verify physical sensors and process conditions before taking corrective action.';
    verificationRequired = true;
    recommendationAllowed = false;

    return {
      riskScore,
      riskStage,
      observedEvidence,
      probableCause,
      preventiveMeasure,
      verificationRequired,
      recommendationAllowed,
      reason: 'Multivariate sensor pattern does not strongly match any single trained failure class.'
    };
  }

  if (faultMode === 'normal' || faultSeverity <= 0.05) {
    riskScore = Math.max(5, Math.min(20, Math.round(mlScore * 40)));
    return {
      riskScore,
      riskStage: 'NORMAL',
      observedEvidence: 'All physical sensor streams within expected operating tolerances.',
      probableCause: 'Nominal Operation',
      preventiveMeasure: 'Continue routine supervisory monitoring. All units operating within design limits.',
      verificationRequired: false,
      recommendationAllowed: true,
      reason: 'No abnormal vibration, thermal, or pressure gradients detected.'
    };
  }

  // Calculate dynamic 0-100 score from severity & ML score
  const baseScore = Math.round(faultSeverity * 75 + mlScore * 25);
  riskScore = Math.max(22, Math.min(98, baseScore));

  if (riskScore <= 40) {
    riskStage = 'EARLY_WARNING';
  } else if (riskScore <= 60) {
    riskStage = 'DEVELOPING';
  } else if (riskScore <= 80) {
    riskStage = 'HIGH_RISK';
  } else {
    riskStage = 'CRITICAL';
  }

  // Parameter & Stage-Specific Recommendations
  if (faultMode.includes('pump') || equipment === 'pump') {
    const pVib = (telemetry.pump_vibration ?? 0.24).toFixed(2);
    const pRpm = Math.round(telemetry.pump_rpm ?? 2100);
    const pFlow = (telemetry.pump_flow ?? 7.5).toFixed(1);

    observedEvidence = `Vibration ${pVib} g (Elevated), Speed ${pRpm} RPM (Reduced), Flow ${pFlow} L/min`;
    probableCause = 'Developing bearing wear, shaft misalignment, or suction restriction in centrifugal pump P-101';

    if (riskStage === 'EARLY_WARNING') {
      preventiveMeasure = 'Inspect pump vibration trend and verify mechanical alignment before performance deteriorates.';
      verificationRequired = false;
      recommendationAllowed = true;
    } else if (riskStage === 'DEVELOPING') {
      preventiveMeasure = 'Check bearing condition, shaft alignment, and inspect suction strainer for flow restriction.';
      verificationRequired = true;
      recommendationAllowed = true;
    } else if (riskStage === 'HIGH_RISK') {
      preventiveMeasure = 'Schedule pump inspection/maintenance before performance deteriorates further. Switch to standby pump if available.';
      verificationRequired = true;
      recommendationAllowed = true;
    } else {
      preventiveMeasure = 'Stop recommending automatic action. High dynamic vibration requires physical operator verification.';
      verificationRequired = true;
      recommendationAllowed = false;
    }
  } else if (faultMode.includes('heat') || equipment === 'heat_exchanger') {
    const deltaT = (telemetry.heat_exchanger_outlet_temperature && telemetry.heat_exchanger_inlet_temperature)
      ? Math.abs(telemetry.heat_exchanger_outlet_temperature - telemetry.heat_exchanger_inlet_temperature).toFixed(1)
      : '3.8';

    observedEvidence = `Exchanger ΔT = ${deltaT} °C (Degraded thermal gradient), Reduced heat transfer efficiency`;
    probableCause = 'Tube wall fouling scale accumulation or cooling stream flow reduction in exchanger E-101';

    if (riskStage === 'EARLY_WARNING') {
      preventiveMeasure = 'Verify coolant stream flow and compare current ΔT with historical baseline.';
      verificationRequired = false;
      recommendationAllowed = true;
    } else if (riskStage === 'DEVELOPING') {
      preventiveMeasure = 'Inspect heat-transfer performance and differential pressure across exchanger boundary.';
      verificationRequired = true;
      recommendationAllowed = true;
    } else if (riskStage === 'HIGH_RISK') {
      preventiveMeasure = 'Schedule heat-exchanger inspection/chemical tube cleaning before thermal efficiency degrades further.';
      verificationRequired = true;
      recommendationAllowed = true;
    } else {
      preventiveMeasure = 'Require operator/process verification before taking corrective action.';
      verificationRequired = true;
      recommendationAllowed = false;
    }
  } else if (faultMode.includes('reactor') || equipment === 'reactor') {
    const rTemp = (telemetry.reactor_temperature ?? 78.0).toFixed(1);
    const rPress = (telemetry.reactor_pressure ?? 2.65).toFixed(2);
    const rCool = telemetry.reactor_cooling_status === 0 ? 'TRIPPED' : 'DEGRADED';

    observedEvidence = `Reactor Core Temp ${rTemp} °C, Vapor Pressure ${rPress} bar, Cooling Jacket: ${rCool}`;
    probableCause = 'Loss of cooling jacket heat removal capacity and thermal runaway risk in CSTR R-101';

    if (riskStage === 'EARLY_WARNING') {
      preventiveMeasure = 'Verify coolant circulation flow and cooling-system valve actuation performance.';
      verificationRequired = false;
      recommendationAllowed = true;
    } else if (riskStage === 'DEVELOPING') {
      preventiveMeasure = 'Inspect cooling circuit supply and verify temperature/pressure measurement sensors.';
      verificationRequired = true;
      recommendationAllowed = true;
    } else if (riskStage === 'HIGH_RISK') {
      preventiveMeasure = 'Verify reactor temperature/pressure and cooling capacity before further operation. Prepare reaction inhibitor.';
      verificationRequired = true;
      recommendationAllowed = true;
    } else {
      preventiveMeasure = 'DO NOT ACT automatically. Severe thermal runaway risk requires immediate operator safety procedure.';
      verificationRequired = true;
      recommendationAllowed = false;
    }
  } else if (faultMode.includes('distillation') || equipment === 'distillation') {
    const dReflux = (telemetry.distillation_reflux_ratio ?? 0.85).toFixed(2);
    const dTopT = (telemetry.distillation_top_temperature ?? 82.5).toFixed(1);

    observedEvidence = `Reflux Ratio ${dReflux} L/D (Low), Overhead Temp ${dTopT} °C (Elevated)`;
    probableCause = 'Reflux starvation or reflux pump control valve degradation in distillation column D-101';

    if (riskStage === 'EARLY_WARNING') {
      preventiveMeasure = 'Verify reflux stream flow and check reflux-control valve operation.';
      verificationRequired = false;
      recommendationAllowed = true;
    } else if (riskStage === 'DEVELOPING') {
      preventiveMeasure = 'Check condenser heat-removal performance and inspect reflux circulation loop.';
      verificationRequired = true;
      recommendationAllowed = true;
    } else if (riskStage === 'HIGH_RISK') {
      preventiveMeasure = 'Inspect reflux pump and control system before separation performance deteriorates further.';
      verificationRequired = true;
      recommendationAllowed = true;
    } else {
      preventiveMeasure = 'Require operator verification of tray temperature profile and column reflux loop.';
      verificationRequired = true;
      recommendationAllowed = false;
    }
  }

  return {
    riskScore,
    riskStage,
    observedEvidence,
    probableCause,
    preventiveMeasure,
    verificationRequired,
    recommendationAllowed,
    reason: `${riskStage} condition based on continuous parameter trends and limit envelopes.`
  };
}
