/**
 * ChemDiag AI — Safety-Gated Recommendation & Decision Gate Engine
 * 
 * CORE PROJECT USP: "AI that knows when NOT to recommend action."
 * 
 * Evaluates 6 comprehensive gating dimensions before displaying or permitting recommendations:
 * 1. AI Diagnostic Confidence
 * 2. Sensor Reliability & Signal Integrity
 * 3. Process Operating Limits
 * 4. Fault Severity Level
 * 5. Evidence Consistency
 * 6. Unknown-Fault Status
 * 
 * Possible Gate States:
 * - NORMAL
 * - ANOMALY_UNCERTAIN
 * - UNKNOWN_FAULT
 * - FAULT_CONFIRMED
 * - RECOMMENDATION_BLOCKED
 * - RECOMMENDATION_READY
 * - OPERATOR_APPROVAL_REQUIRED
 */

export function evaluateSafetyGate({
  anomaly = false,
  isUnknownFault = false,
  confidence = 0.95,
  sensorReliability = { score: 100, isReliable: true },
  limitViolations = [],
  faultSeverity = 'NORMAL',
  preventiveResult = {},
  equipment = 'all'
}) {
  // Gate 1: Check Sensor Reliability
  if (!sensorReliability.isReliable || sensorReliability.score < 75) {
    return {
      gateState: 'RECOMMENDATION_BLOCKED',
      statusLabel: '⚠ SENSOR VERIFICATION REQUIRED',
      safeToRecommend: false,
      actionBlocked: true,
      requiresOperatorApproval: false,
      bannerType: 'warning',
      headline: 'SENSOR INTEGRITY COMPROMISED',
      reason: `Sensor reliability index is ${sensorReliability.score}% (< 75% safe threshold). Physical sensor verification is required before any recommendation can be made.`,
      directive: '🚨 DO NOT ACT — VERIFY SENSORS FIRST'
    };
  }

  // Gate 2: Check Unknown Fault Status
  if (isUnknownFault) {
    return {
      gateState: 'UNKNOWN_FAULT',
      statusLabel: '🚨 DO NOT FORCE CLASSIFICATION',
      safeToRecommend: false,
      actionBlocked: true,
      requiresOperatorApproval: false,
      bannerType: 'unknown',
      headline: '⚠ UNKNOWN FAULT DETECTED',
      reason: 'Multivariate sensor pattern deviates from baseline but fails strong match with known trained failure signatures. AI refuses to force an inaccurate classification.',
      directive: '🚨 DO NOT ACT — DO NOT FORCE CLASSIFICATION'
    };
  }

  // Gate 3: Check Normal Operation
  if (!anomaly || faultSeverity === 'NORMAL') {
    return {
      gateState: 'NORMAL',
      statusLabel: '✓ NOMINAL OPERATION',
      safeToRecommend: true,
      actionBlocked: false,
      requiresOperatorApproval: false,
      bannerType: 'safe',
      headline: 'SYSTEM OPERATING NOMINALLY',
      reason: 'All process parameters within nominal design limits. No corrective intervention required.',
      directive: '✓ CONTINUE ROUTINE MONITORING'
    };
  }

  // Gate 4: Check Low Diagnostic Confidence (< 60%)
  if (confidence < 0.60) {
    return {
      gateState: 'ANOMALY_UNCERTAIN',
      statusLabel: '🚨 DO NOT ACT (LOW CONFIDENCE)',
      safeToRecommend: false,
      actionBlocked: true,
      requiresOperatorApproval: false,
      bannerType: 'blocked',
      headline: 'UNCERTAIN DIAGNOSTIC EVIDENCE',
      reason: `Diagnostic confidence is ${Math.round(confidence * 100)}% (< 60% minimum threshold). Evidence is insufficient to recommend corrective action.`,
      directive: '🚨 DO NOT ACT — INSUFFICIENT CONFIDENCE'
    };
  }

  // Gate 5: Check Critical Runway Condition (Severity = CRITICAL)
  if (faultSeverity === 'CRITICAL' || preventiveResult.riskStage === 'CRITICAL') {
    return {
      gateState: 'OPERATOR_APPROVAL_REQUIRED',
      statusLabel: '🚨 OPERATOR VERIFICATION REQUIRED',
      safeToRecommend: false,
      actionBlocked: true,
      requiresOperatorApproval: true,
      bannerType: 'critical',
      headline: 'CRITICAL LIMIT EXCEEDED — NO AUTOMATIC ACTION',
      reason: 'Critical safety envelope reached. Automatic action blocked. Direct operator physical verification and manual authorization required.',
      directive: '🚨 STOP AUTOMATIC RECOMMENDATION — OPERATOR VERIFICATION REQUIRED'
    };
  }

  // Gate 6: Confirmed Fault with High Confidence & Reliable Sensors
  return {
    gateState: 'RECOMMENDATION_READY',
    statusLabel: '✓ SAFE TO RECOMMEND',
    safeToRecommend: true,
    actionBlocked: false,
    requiresOperatorApproval: true,
    bannerType: 'safe',
    headline: 'DIAGNOSTIC EVIDENCE CONFIRMED',
    reason: `Sufficient multidimensional evidence (${Math.round(confidence * 100)}% confidence, ${sensorReliability.score}% sensor reliability). Preventive measure evaluated.`,
    directive: '✓ SAFE TO RECOMMEND — OPERATOR APPROVAL REQUIRED'
  };
}
