import React, { useState, useEffect } from 'react';
import { Diagnosis, EquipmentItem, PumpData, HeatExchangerData, ReactorData, DistillationData } from '../types';
import { approveOperatorRecommendation } from '../services/api';
import { AiChatPanel } from './AiChatPanel';
import { WhatIfPanel } from './WhatIfPanel';
import {
  ShieldAlert,
  Wrench,
  HelpCircle,
  CheckCircle2,
  BrainCircuit,
  Activity,
  ArrowRight,
  MessageSquare,
  Sparkles,
  Layers,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  Check,
  RotateCcw,
  BarChart3,
  Cpu,
  Sliders
} from 'lucide-react';

interface AiDiagnosisPanelProps {
  diagnosis: Diagnosis;
  equipment?: {
    pump: EquipmentItem<PumpData>;
    heat_exchanger: EquipmentItem<HeatExchangerData>;
    reactor: EquipmentItem<ReactorData>;
    distillation: EquipmentItem<DistillationData>;
  };
  initialChatEquipment?: string;
}

export const AiDiagnosisPanel: React.FC<AiDiagnosisPanelProps> = ({
  diagnosis,
  equipment,
  initialChatEquipment
}) => {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'chat' | 'whatif'>('pipeline');
  const [chatEquipment, setChatEquipment] = useState<string | undefined>(initialChatEquipment);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [localApproved, setLocalApproved] = useState(false);

  useEffect(() => {
    if (initialChatEquipment) {
      setChatEquipment(initialChatEquipment);
      setActiveTab('chat');
    }
  }, [initialChatEquipment]);

  const isAnomaly = diagnosis.anomaly && diagnosis.severity !== 'NORMAL';
  const isUnknown = !!diagnosis.is_unknown_fault;
  const isEarly = diagnosis.prognosis?.isEarlyWarning || diagnosis.fault?.startsWith('early_');
  const confidencePercent = Math.round((diagnosis.confidence || 0.85) * 100);

  const riskScore = diagnosis.preventive?.riskScore ?? 12;
  const riskStage = diagnosis.preventive?.riskStage ?? 'NORMAL';
  const prognosis = diagnosis.prognosis;
  const safetyGate = diagnosis.safetyGate || {
    gateState: 'NORMAL',
    statusLabel: '✓ NOMINAL OPERATION',
    safeToRecommend: true,
    actionBlocked: false,
    requiresOperatorApproval: false,
    bannerType: 'safe',
    headline: 'SYSTEM OPERATING NOMINALLY',
    reason: 'All process parameters within nominal design limits.',
    directive: '✓ CONTINUE ROUTINE MONITORING'
  };

  const xaiContributions = diagnosis.xai_contributions || [];

  const handleAskAiAbout = (equipName?: string) => {
    setChatEquipment(equipName);
    setActiveTab('chat');
  };

  const handleOperatorApproval = async () => {
    try {
      setIsApproving(true);
      await approveOperatorRecommendation('Operator verified telemetry on dashboard and approved preventive recommendation.');
      setLocalApproved(true);
    } catch (e) {
      console.error('Operator approval error:', e);
    } finally {
      setIsApproving(false);
    }
  };

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return 'sev-critical';
      case 'HIGH': return 'sev-high';
      case 'MEDIUM': return 'sev-medium';
      case 'LOW': return 'sev-low';
      default: return 'sev-normal';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score <= 20) return '#10B981'; // Green
    if (score <= 40) return '#F59E0B'; // Amber
    if (score <= 60) return '#EA580C'; // Orange
    if (score <= 80) return '#DC2626'; // High Red
    return '#991B1B'; // Dark Red
  };

  return (
    <section className={`hero-diagnosis-container ${isUnknown ? 'status-unknown' : isEarly ? 'status-early' : !isAnomaly ? 'status-normal' : 'status-fault'}`} aria-label="AI Diagnosis Hero Panel">
      {/* 1. HERO HEADER WITH DUAL MODE SWITCH */}
      <div className="hero-diag-header">
        <div className="hero-header-title-group">
          <div className="hero-brain-icon-wrap" title="AI Inference Engine">
            <BrainCircuit size={18} />
          </div>
          <div>
            <h2 className="hero-main-title">
              CHEMDIAG AI NOVELTY ENGINE <span className="numeric-data" style={{ color: 'var(--primary-blue)', fontSize: '0.82rem' }}>[USP: KNOWS WHEN NOT TO ACT]</span>
            </h2>
            <p className="hero-subtitle">
              Digital Twin Simulation · Early Fault Detection · XAI Root Cause · Fault Prognosis · Safety Gate · Human-in-the-Loop
            </p>
          </div>
        </div>

        <div className="hero-badges-group">
          {/* Dual Tab Mode Switch */}
          <div className="ai-mode-toggle-group">
            <button
              className={`ai-mode-btn ${activeTab === 'pipeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('pipeline')}
            >
              <Layers size={12} />
              <span>DECISION PIPELINE</span>
            </button>
            <button
              className={`ai-mode-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={12} />
              <span>INDUSTRIAL AI</span>
              <span className="copilot-pill">UNIVERSAL</span>
            </button>
            <button
              className={`ai-mode-btn ${activeTab === 'whatif' ? 'active' : ''}`}
              onClick={() => setActiveTab('whatif')}
            >
              <Sliders size={12} />
              <span>WHAT-IF</span>
              <span className="copilot-pill" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary-blue)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>SIMULATOR</span>
            </button>
          </div>

          {/* Interactive Methodology Tooltip */}
          <div
            className="badge-tag-interactive"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
          >
            <span>11-STAGE DECISION FLOW</span>
            <HelpCircle size={12} color="var(--primary-blue)" />

            {showTooltip && (
              <div className="methodology-tooltip" role="tooltip">
                <div className="tooltip-title">💡 ChemDiag Complete Novelty Architecture</div>
                <p className="tooltip-text">
                  <strong>1. Digital Twin:</strong> Continuous first-principles process simulation.<br />
                  <strong>2. Isolation Forest:</strong> Unsupervised outlier anomaly detection.<br />
                  <strong>3. Random Forest:</strong> Calibrated multi-class classification.<br />
                  <strong>4. Unknown Fault Guard:</strong> Refuses to force classification on uncharacteristic patterns.<br />
                  <strong>5. Early Detection:</strong> Flags degradation before critical boundaries.<br />
                  <strong>6. Prognosis:</strong> Dynamic degradation & trend estimation.<br />
                  <strong>7. XAI:</strong> Transparent percentage feature contribution.<br />
                  <strong>8. Preventive Engine:</strong> Risk score (0-100) & stage recommendations.<br />
                  <strong>9. Safety Gate:</strong> Evaluates confidence & limits to block unsafe action.<br />
                  <strong>10. Grounded Copilot:</strong> Zero-hallucination interactive process assistance.<br />
                  <strong>11. Human-in-the-Loop:</strong> Explicit operator approval for recommendations.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODE 1: AUTOMATIC DIAGNOSIS PIPELINE */}
      {activeTab === 'pipeline' && (
        <>
          {/* VISUAL DIAGNOSTIC PIPELINE FLOW BREADCRUMB */}
          <div className="diag-pipeline-bar">
            <div className={`pipeline-node ${isUnknown ? 'node-unknown' : isEarly ? 'node-early' : isAnomaly ? 'node-fault' : 'node-nominal'}`}>
              <span className="pipeline-node-num">1</span>
              <span>ANOMALY: {isAnomaly ? (isUnknown ? 'UNKNOWN' : isEarly ? 'EARLY DRIFT' : 'CONFIRMED') : 'NONE'}</span>
            </div>
            <ArrowRight className="pipeline-arrow" size={12} />

            <div className={`pipeline-node ${isUnknown ? 'node-unknown' : isEarly ? 'node-early' : isAnomaly ? 'node-fault' : 'node-nominal'}`}>
              <span className="pipeline-node-num">2</span>
              <span>CLASSIFIER: {isUnknown ? 'UNCLASSIFIED' : diagnosis.equipment}</span>
            </div>
            <ArrowRight className="pipeline-arrow" size={12} />

            <div className={`pipeline-node ${isAnomaly ? 'node-active' : 'node-nominal'}`}>
              <span className="pipeline-node-num">3</span>
              <span>XAI ROOT CAUSE</span>
            </div>
            <ArrowRight className="pipeline-arrow" size={12} />

            <div className={`pipeline-node ${isAnomaly ? 'node-active' : 'node-nominal'}`}>
              <span className="pipeline-node-num">4</span>
              <span>PROGNOSIS</span>
            </div>
            <ArrowRight className="pipeline-arrow" size={12} />

            <div className={`pipeline-node ${isAnomaly ? 'node-active' : 'node-nominal'}`}>
              <span className="pipeline-node-num">5</span>
              <span>RISK ({riskScore}/100)</span>
            </div>
            <ArrowRight className="pipeline-arrow" size={12} />

            <div className={`pipeline-node ${safetyGate.safeToRecommend ? 'node-safe' : 'node-blocked'}`}>
              <span className="pipeline-node-num">6</span>
              <span>SAFETY GATE: {safetyGate.safeToRecommend ? 'SAFE' : 'BLOCKED'}</span>
            </div>
          </div>

          {/* MAIN PROMINENT SAFETY GATE BANNER (CORE USP DISPLAY) */}
          <div className={`safety-gate-hero-banner banner-${safetyGate.bannerType}`}>
            <div className="safety-gate-icon-group">
              {safetyGate.bannerType === 'safe' ? (
                <ShieldCheck size={26} color="#15803D" />
              ) : safetyGate.bannerType === 'unknown' ? (
                <HelpCircle size={26} color="#D97706" />
              ) : safetyGate.bannerType === 'critical' ? (
                <AlertTriangle size={26} color="#DC2626" />
              ) : (
                <ShieldAlert size={26} color="#EA580C" />
              )}
              <div>
                <div className="safety-gate-headline-text">{safetyGate.headline}</div>
                <div className="safety-gate-reason-text">{safetyGate.reason}</div>
              </div>
            </div>

            <div className="safety-gate-action-group">
              <span className={`safety-status-pill pill-${safetyGate.bannerType}`}>
                {safetyGate.statusLabel}
              </span>
              <button
                className="ask-ai-quick-btn"
                onClick={() => handleAskAiAbout()}
                title="Ask AI why this safety state was assigned"
              >
                <Sparkles size={12} />
                <span>Ask AI Why</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION A: UNKNOWN FAULT STATE (PRIMARY USP) */}
          {/* ========================================================================= */}
          {isUnknown && (
            <div className="unknown-fault-display-container">
              <div className="unknown-banner-grid">
                <div className="unknown-card">
                  <span className="step-label" style={{ color: '#D97706' }}>⚠ OBSERVED SENSOR ABNORMALITIES</span>
                  <div className="unknown-abnormal-list">
                    {(diagnosis.important_variables || []).map((v, i) => (
                      <div key={i} className="unknown-abnormal-item">
                        <span className="bullet-dot">●</span>
                        <strong className="numeric-data">{v}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="unknown-card">
                  <span className="step-label" style={{ color: '#DC2626' }}>KNOWN FAULT PATTERN MATCH</span>
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                      <span>Classification Confidence:</span>
                      <strong className="numeric-data" style={{ color: '#DC2626' }}>{confidencePercent}% (INSUFFICIENT)</strong>
                    </div>
                    <div className="confidence-bar-bg">
                      <div className="confidence-bar-fill unknown-fill" style={{ width: `${confidencePercent}%` }}></div>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      🚨 <strong>DO NOT FORCE CLASSIFICATION:</strong> This multivariate sensor combination does not match any known failure class with safe confidence.
                    </p>
                  </div>
                </div>

                <div className="unknown-card">
                  <span className="step-label" style={{ color: 'var(--primary-blue)' }}>AI SAFETY GATE DIRECTIVE</span>
                  <div className="safety-directive-box">
                    <div className="safety-directive-title">🚨 DO NOT ACT AUTOMATICALLY</div>
                    <p className="safety-directive-desc">
                      Automatic action blocked. Cross-verify physical sensors, instrument calibrations, and manual valve positions before taking corrective intervention.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION B: MULTI-SECTION WORKFLOW (CONDITION, XAI, PROGNOSIS, RISK, ACTION) */}
          {/* ========================================================================= */}
          {!isUnknown && (
            <div className="novelty-sections-grid">
              {/* ROW 1: CURRENT CONDITION & DIAGNOSIS SUMMARY */}
              <div className="novelty-card condition-card">
                <div className="card-header-bar">
                  <span className="step-label">1. CURRENT DIAGNOSTIC STATE</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span className={`severity-badge ${getSeverityBadgeClass(diagnosis.severity)}`}>
                      {isEarly ? 'EARLY WARNING' : `${diagnosis.severity} SEVERITY`}
                    </span>
                    <span className="confidence-pill numeric-data">
                      {confidencePercent}% CONFIDENCE
                    </span>
                  </div>
                </div>

                <div className="diagnosis-summary-content">
                  <div className="diag-equipment-name">
                    {diagnosis.equipment} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>·</span> <span style={{ color: isAnomaly ? 'var(--sev-high-text)' : 'var(--sev-normal-text)' }}>{diagnosis.probable_fault}</span>
                  </div>
                  <p className="diag-narrative-text">
                    "{diagnosis.pattern_narrative || diagnosis.assessment || 'Operating within nominal bounds.'}"
                  </p>
                </div>

                <div className="evidence-metrics-mini-grid">
                  {(diagnosis.evidence_cards || []).map((card, idx) => (
                    <div key={idx} className={`evidence-metric-box ${card.isWarning ? 'warning' : 'nominal'}`}>
                      <span className="box-label">{card.label}</span>
                      <span className="box-val numeric-data">{card.val}</span>
                      <span className="box-state">{card.state}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ROW 2: XAI ROOT CAUSE ATTRIBUTION ("WHY DID AI DETECT THIS?") */}
              <div className="novelty-card xai-card">
                <div className="card-header-bar">
                  <span className="step-label" style={{ color: 'var(--ai-cyan-hover)' }}>
                    <BarChart3 size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    2. XAI FEATURE ATTRIBUTION ("WHY DID AI DETECT THIS?")
                  </span>
                </div>

                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Transparent breakdown of variable deviations contributing to the AI decision:
                </p>

                <div className="xai-bars-list">
                  {xaiContributions.map((item, idx) => (
                    <div key={idx} className="xai-bar-row">
                      <div className="xai-bar-label-group">
                        <span className="xai-feat-name">{item.label}</span>
                        <span className={`xai-feat-change numeric-data ${item.isUp ? 'text-up' : 'text-down'}`}>
                          {item.change}
                        </span>
                      </div>
                      <div className="xai-bar-track">
                        <div
                          className={`xai-bar-fill ${item.isUp ? 'fill-up' : 'fill-down'}`}
                          style={{ width: `${item.contributionPercent}%` }}
                        ></div>
                      </div>
                      <span className="xai-percent-val numeric-data">{item.contributionPercent}%</span>
                    </div>
                  ))}
                </div>

                <div className="root-cause-callout">
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.78rem' }}>Probable Root Cause (ML + Process Engineering):</strong>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    {diagnosis.root_cause}
                  </p>
                </div>
              </div>

              {/* ROW 3: FAULT PROGRESSION & PROGNOSIS (5-STAGE PROGRESSION TRACKER) */}
              <div className="novelty-card prognosis-card">
                <div className="card-header-bar">
                  <span className="step-label" style={{ color: '#7C3AED' }}>
                    <TrendingUp size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    3. FAULT PROGRESSION & PROGNOSIS
                  </span>
                </div>

                {/* 5-Stage Visual Progress Bar */}
                <div className="progression-stages-bar">
                  {['NORMAL', 'EARLY_WARNING', 'DEVELOPING', 'HIGH_RISK', 'CRITICAL'].map((st, i) => {
                    const isPassedOrActive =
                      (riskStage === 'CRITICAL') ||
                      (riskStage === 'HIGH_RISK' && i <= 3) ||
                      (riskStage === 'DEVELOPING' && i <= 2) ||
                      (riskStage === 'EARLY_WARNING' && i <= 1) ||
                      (riskStage === 'NORMAL' && i === 0);

                    const isActive = riskStage === st;

                    return (
                      <div key={st} className={`stage-step ${isPassedOrActive ? 'stage-reached' : ''} ${isActive ? 'stage-current' : ''}`}>
                        <div className="stage-step-num numeric-data">{i + 1}</div>
                        <span className="stage-step-name">{st.replace('_', ' ')}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="prognosis-info-box">
                  <div className="prog-estimate-headline">
                    {prognosis?.timeToThreshold || 'Operating nominally within design tolerances.'}
                  </div>
                  <p className="prog-narrative-text">
                    {prognosis?.narrative || 'Continuous parameters are stable and within nominal operating envelopes.'}
                  </p>
                </div>
              </div>

              {/* ROW 4: PREVENTIVE RISK SCORE & OPERATOR APPROVAL */}
              <div className="novelty-card preventive-card">
                <div className="card-header-bar">
                  <span className="step-label" style={{ color: 'var(--primary-blue)' }}>
                    <Wrench size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    4. PREVENTIVE MEASURE & OPERATOR APPROVAL (HUMAN-IN-THE-LOOP)
                  </span>
                  <div className="risk-score-display-pill">
                    <span>Preventive Risk:</span>
                    <strong className="numeric-data" style={{ color: getRiskScoreColor(riskScore), fontSize: '0.95rem' }}>
                      {riskScore} / 100
                    </strong>
                  </div>
                </div>

                <div className="preventive-directive-box">
                  <div className="preventive-measure-title">
                    RECOMMENDED PREVENTIVE ACTION:
                  </div>
                  <div className="preventive-measure-text">
                    "{diagnosis.recommended_action || 'Continue routine supervisory monitoring.'}"
                  </div>
                </div>

                {/* Human-in-the-Loop Operator Authorization Button */}
                <div className="operator-approval-bar">
                  <div className="approval-status-info">
                    <span className="approval-badge-label">
                      {localApproved || diagnosis.operatorApproval?.approved
                        ? '✓ OPERATOR APPROVED'
                        : isAnomaly
                        ? '⚠ OPERATOR APPROVAL REQUIRED'
                        : 'ROUTINE SUPERVISION'}
                    </span>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                      ChemDiag AI never executes automatic control commands. All preventive measures require manual operator authorization.
                    </p>
                  </div>

                  {isAnomaly && (
                    <button
                      className={`operator-approve-btn ${localApproved || diagnosis.operatorApproval?.approved ? 'approved' : ''}`}
                      onClick={handleOperatorApproval}
                      disabled={isApproving || localApproved || diagnosis.operatorApproval?.approved}
                    >
                      {localApproved || diagnosis.operatorApproval?.approved ? (
                        <>
                          <Check size={13} />
                          <span>Action Authorized</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={13} />
                          <span>{isApproving ? 'Recording...' : 'Approve Recommendation'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Sensor Reliability Mini Bar */}
                <div className="sensor-reliability-footer">
                  <span>
                    Sensor Reliability: <strong className="numeric-data" style={{ color: (diagnosis.sensorReliability?.score ?? 100) >= 75 ? '#10B981' : '#DC2626' }}>{diagnosis.sensorReliability?.score ?? 100}%</strong> · {diagnosis.sensorReliability?.statusText || 'ALL SENSORS VALID'}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Operating Limits Enforced</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODE 2: INTERACTIVE GROUNDED INDUSTRIAL AI CHAT */}
      {activeTab === 'chat' && (
        <div style={{ padding: '14px 18px 16px' }}>
          <AiChatPanel
            selectedEquipment={chatEquipment}
            onClearSelectedEquipment={() => setChatEquipment(undefined)}
            processContext={{
              diagnosis,
              equipment
            }}
          />
        </div>
      )}

      {/* MODE 3: WHAT-IF ENGINEERING SIMULATOR */}
      {activeTab === 'whatif' && (
        <div style={{ padding: '14px 18px 16px' }}>
          <WhatIfPanel
            processContext={{
              diagnosis,
              equipment
            }}
          />
        </div>
      )}
    </section>
  );
};

export default AiDiagnosisPanel;
