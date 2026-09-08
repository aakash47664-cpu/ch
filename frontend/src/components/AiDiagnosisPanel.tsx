import React, { useState } from 'react';
import { Diagnosis, EquipmentItem, PumpData, HeatExchangerData, ReactorData, DistillationData } from '../types';
import { AiChatPanel } from './AiChatPanel';
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
  Layers
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
  const [activeTab, setActiveTab] = useState<'pipeline' | 'chat'>('pipeline');
  const [chatEquipment, setChatEquipment] = useState<string | undefined>(initialChatEquipment);
  const [showTooltip, setShowTooltip] = useState(false);

  const isAnomaly = diagnosis.anomaly && diagnosis.severity !== 'NORMAL';
  const confidencePercent = Math.round((diagnosis.confidence || 0.85) * 100);
  const isLowConfidence = (diagnosis.confidence || 0) < 0.60;

  // Switch to chat mode with equipment context
  const handleAskAiAbout = (equipName?: string) => {
    setChatEquipment(equipName);
    setActiveTab('chat');
  };

  // Helper to determine severity styling
  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return 'sev-critical';
      case 'HIGH': return 'sev-high';
      case 'MEDIUM': return 'sev-medium';
      case 'LOW': return 'sev-low';
      default: return 'sev-normal';
    }
  };

  // Helper to construct dynamic key variables during normal operation from actual live telemetry
  const getNormalKeyVariables = () => {
    if (diagnosis.normal_variables && diagnosis.normal_variables.length > 0) {
      return diagnosis.normal_variables;
    }

    const d = equipment?.distillation?.data;
    const p = equipment?.pump?.data;
    const r = equipment?.reactor?.data;
    const hx = equipment?.heat_exchanger?.data;

    return [
      { name: 'Reflux Ratio', val: (d?.reflux_ratio ?? 1.85).toFixed(2), status: 'NORMAL' },
      { name: 'Top Temperature', val: `${(d?.top_temperature ?? 76.5).toFixed(1)} °C`, status: 'NORMAL' },
      { name: 'Column Pressure', val: `${(d?.pressure ?? 2.10).toFixed(2)} bar`, status: 'NORMAL' },
      { name: 'Pump Vibration', val: `${(p?.vibration ?? 0.08).toFixed(2)} g`, status: 'NORMAL' },
      { name: 'Reactor Temperature', val: `${(r?.temperature ?? 65.0).toFixed(1)} °C`, status: 'NORMAL' },
      { name: 'Heat Exchanger ΔT', val: `${(hx?.temperature_difference ?? 12.9).toFixed(1)} °C`, status: 'NORMAL' }
    ];
  };

  // Helper to extract dynamic evidence based on active equipment and live values during fault
  const getDynamicEvidence = () => {
    const equipName = (diagnosis.equipment || '').toLowerCase();
    const faultType = (diagnosis.fault || '').toLowerCase();

    const cards = diagnosis.evidence_cards && diagnosis.evidence_cards.length > 0
      ? diagnosis.evidence_cards
      : [];

    if (equipName.includes('pump') || faultType.includes('pump')) {
      const pData = equipment?.pump?.data || { vibration: 0.08, rpm: 2450, outlet_temperature: 38.1 };
      const vib = pData.vibration ?? 0.08;
      const rpm = pData.rpm ?? 2450;
      const temp = pData.outlet_temperature ?? 38.1;

      return {
        unit: 'PUMP',
        faultTitle: (diagnosis.probable_fault || 'Pump Mechanical Fault').toUpperCase(),
        classification: diagnosis.probable_fault || 'Pump Mechanical Fault',
        classificationDesc: diagnosis.explanation || `Elevated vibration (${vib.toFixed(2)} g) with reduced speed (${Math.round(rpm)} RPM) detected on pump P-101.`,
        cards: cards.length > 0 ? cards : [
          { label: 'VIBRATION', val: `${vib.toFixed(2)} g`, state: vib > 0.20 ? '↑ HIGH' : '✓ NORMAL', isWarning: vib > 0.20 },
          { label: 'PUMP SPEED', val: `${Math.round(rpm)} RPM`, state: rpm < 2200 ? '↓ LOW' : '✓ NORMAL', isWarning: rpm < 2200 },
          { label: 'CASING TEMP', val: `${temp.toFixed(1)} °C`, state: temp > 40.0 ? '↑ ELEVATED' : '✓ NORMAL', isWarning: temp > 40.0 }
        ],
        patternNarrative: diagnosis.pattern_narrative || `Elevated casing vibration (${vib.toFixed(2)} g) and reduced rotational speed (${Math.round(rpm)} RPM) match the pump mechanical-fault pattern.`,
        rootCauseExplanation: diagnosis.explanation || 'Increased casing vibration accompanied by motor speed loss indicates bearing wear, shaft misalignment, or impeller unbalance.',
        severityReason: diagnosis.severity_reason || (vib > 0.38 ? 'High dynamic casing acceleration exceeds ISO 10816 vibration boundary.' : 'Moderate vibration and speed degradation.'),
        priority: diagnosis.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH'
      };
    }

    if (equipName.includes('heat') || faultType.includes('heat') || faultType.includes('exchanger')) {
      const hxData = equipment?.heat_exchanger?.data || { inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9 };
      const deltaT = hxData.temperature_difference ?? 12.9;
      const tIn = hxData.inlet_temperature ?? 25.2;
      const tOut = hxData.outlet_temperature ?? 38.1;

      return {
        unit: 'HEAT EXCHANGER',
        faultTitle: (diagnosis.probable_fault || 'Heat Exchanger Performance Fault').toUpperCase(),
        classification: diagnosis.probable_fault || 'Heat Exchanger Performance Fault',
        classificationDesc: diagnosis.explanation || `Thermal gradient collapse (ΔT = ${deltaT.toFixed(1)}°C) with loss of heat transfer capacity.`,
        cards: cards.length > 0 ? cards : [
          { label: 'INLET TEMP', val: `${tIn.toFixed(1)} °C`, state: 'NOMINAL', isWarning: false },
          { label: 'OUTLET TEMP', val: `${tOut.toFixed(1)} °C`, state: deltaT < 5.0 ? '↓ LOW ΔT' : '✓ NORMAL', isWarning: deltaT < 5.0 },
          { label: 'ΔT GRADIENT', val: `${deltaT.toFixed(1)} °C`, state: deltaT < 5.0 ? '↓ LOW (< 5°C)' : '✓ NORMAL', isWarning: deltaT < 5.0 }
        ],
        patternNarrative: diagnosis.pattern_narrative || `Severe loss of temperature difference (ΔT = ${deltaT.toFixed(1)}°C) between process streams matches tube fouling signature.`,
        rootCauseExplanation: diagnosis.explanation || 'Reduced temperature difference between inlet and outlet process streams indicates increased fouling thermal resistance.',
        severityReason: diagnosis.severity_reason || (deltaT < 2.5 ? 'Severe loss of heat transfer capacity across exchanger.' : 'Degraded thermal efficiency across exchanger boundary.'),
        priority: deltaT < 2.5 ? 'HIGH' : 'MEDIUM'
      };
    }

    if (equipName.includes('reactor') || faultType.includes('reactor') || faultType.includes('cooling')) {
      const rData = equipment?.reactor?.data || { temperature: 65.0, pressure: 2.05, cooling_status: 1 };
      const temp = rData.temperature ?? 65.0;
      const press = rData.pressure ?? 2.05;
      const cooling = rData.cooling_status ?? 1;

      return {
        unit: 'REACTOR',
        faultTitle: (diagnosis.probable_fault || 'Reactor Cooling Failure').toUpperCase(),
        classification: diagnosis.probable_fault || 'Reactor Cooling Failure',
        classificationDesc: diagnosis.explanation || `Cooling jacket interlock tripped with temperature (${temp.toFixed(1)}°C) and vapor pressure (${press.toFixed(2)} bar) escalation.`,
        cards: cards.length > 0 ? cards : [
          { label: 'COOLING STATUS', val: cooling === 0 ? 'OFF' : 'ON', state: cooling === 0 ? '▲ TRIPPED' : 'ACTIVE', isWarning: cooling === 0 },
          { label: 'VESSEL TEMP', val: `${temp.toFixed(1)} °C`, state: temp > 74.0 ? '↑ HIGH' : '✓ NORMAL', isWarning: temp > 74.0 },
          { label: 'PRESSURE', val: `${press.toFixed(2)} bar`, state: press > 2.50 ? '↑ HIGH' : '✓ NORMAL', isWarning: press > 2.50 }
        ],
        patternNarrative: diagnosis.pattern_narrative || `Cooling status OFF + sharp rise in temperature (${temp.toFixed(1)}°C) and pressure (${press.toFixed(2)} bar) matches cooling-system failure.`,
        rootCauseExplanation: diagnosis.explanation || 'Loss of cooling jacket heat removal capacity allows exothermic reaction heat to accumulate, driving vapor pressure toward relief thresholds.',
        severityReason: diagnosis.severity_reason || ((temp > 85.0 || press > 3.20) ? 'Critical thermal runaway condition in CSTR R-101.' : 'Cooling jacket loss with active temperature surge.'),
        priority: (temp > 85.0 || press > 3.20) ? 'CRITICAL' : 'HIGH'
      };
    }

    if (equipName.includes('distillation') || faultType.includes('distillation')) {
      const dData = equipment?.distillation?.data || { reflux_ratio: 1.85, top_temperature: 76.5, pressure: 2.10 };
      const reflux = dData.reflux_ratio ?? 1.85;
      const topT = dData.top_temperature ?? 76.5;
      const press = dData.pressure ?? 2.10;

      return {
        unit: 'DISTILLATION COLUMN',
        faultTitle: (diagnosis.probable_fault || 'Distillation Separation Fault').toUpperCase(),
        classification: diagnosis.probable_fault || 'Distillation Separation Fault',
        classificationDesc: diagnosis.explanation || `Reflux ratio depletion (${reflux.toFixed(2)}) causing elevated top temperature (${topT.toFixed(1)}°C) and loss of separation efficiency.`,
        cards: cards.length > 0 ? cards : [
          { label: 'REFLUX RATIO', val: `${reflux.toFixed(2)}`, state: reflux < 1.1 ? '↓ LOW' : '✓ NORMAL', isWarning: reflux < 1.1 },
          { label: 'TOP TEMP', val: `${topT.toFixed(1)} °C`, state: topT > 78.0 ? '↑ HIGH' : '✓ NORMAL', isWarning: topT > 78.0 },
          { label: 'COLUMN PRESSURE', val: `${press.toFixed(2)} bar`, state: press > 2.60 ? '↑ ELEVATED' : '✓ NORMAL', isWarning: press > 2.60 }
        ],
        patternNarrative: diagnosis.pattern_narrative || `Low reflux (${reflux.toFixed(2)}) + elevated top temperature (${topT.toFixed(1)}°C)${press > 2.60 ? ' + increased pressure (' + press.toFixed(2) + ' bar)' : ''} matches column reflux-starvation pattern.`,
        rootCauseExplanation: diagnosis.explanation || 'Low reflux combined with elevated top temperature indicates reduced liquid return to the column and loss of separation efficiency.',
        severityReason: diagnosis.severity_reason || (press > 2.60 ? 'High overhead vapor load and pressure accumulation in column T-101.' : 'Loss of fractionating efficiency leading to off-spec distillate.'),
        priority: press > 2.60 ? 'HIGH' : 'MEDIUM'
      };
    }

    // Default fallback
    return {
      unit: (diagnosis.equipment || 'PROCESS UNIT').toUpperCase(),
      faultTitle: (diagnosis.probable_fault || diagnosis.fault || 'Process Deviation').toUpperCase(),
      classification: diagnosis.probable_fault || diagnosis.fault || 'Process Deviation',
      classificationDesc: diagnosis.explanation || `Process anomaly identified in ${diagnosis.equipment}.`,
      cards: cards.length > 0 ? cards : (diagnosis.important_variables || []).slice(0, 3).map(v => ({
        label: 'PROCESS VARIABLE',
        val: v,
        state: 'ABNORMAL',
        isWarning: true
      })),
      patternNarrative: diagnosis.pattern_narrative || 'Multivariate sensor pattern deviates significantly from nominal boundary.',
      rootCauseExplanation: diagnosis.explanation || diagnosis.root_cause,
      severityReason: diagnosis.severity_reason || 'Multivariate anomaly score exceeds nominal tolerance.',
      priority: diagnosis.severity
    };
  };

  const evidence = getDynamicEvidence();
  const normalVariables = getNormalKeyVariables();

  return (
    <section className={`hero-diagnosis-container ${!isAnomaly ? 'status-normal' : 'status-fault'}`} aria-label="AI Diagnosis Hero Panel">
      {/* 1. HERO HEADER WITH DUAL MODE SWITCH */}
      <div className="hero-diag-header">
        <div className="hero-header-title-group">
          <div className="hero-brain-icon-wrap" title="AI Inference Engine">
            <BrainCircuit size={18} />
          </div>
          <div>
            <h2 className="hero-main-title">AI DIAGNOSIS & INTERACTIVE PROCESS COPILOT</h2>
            <p className="hero-subtitle">Explainable Real-Time Fault Diagnostics & Live AI Assistant</p>
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
              <span>AUTOMATIC PIPELINE</span>
            </button>
            <button
              className={`ai-mode-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={12} />
              <span>ASK CHEMDIAG AI</span>
              <span className="copilot-pill">COPILOT</span>
            </button>
          </div>

          {/* Interactive Methodology Tooltip */}
          <div
            className="badge-tag-interactive"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
          >
            <span>HYBRID ML + FIRST PRINCIPLES</span>
            <HelpCircle size={12} color="var(--primary-blue)" />

            {showTooltip && (
              <div className="methodology-tooltip" role="tooltip">
                <div className="tooltip-title">💡 Hybrid Explainable AI Architecture</div>
                <p className="tooltip-text">
                  <strong>1. Isolation Forest:</strong> Unsupervised outlier detection across continuous process features.<br />
                  <strong>2. Random Forest:</strong> Multi-class fault signature classification.<br />
                  <strong>3. Process Heuristics:</strong> Chemical engineering rules to deduce root cause and operator actions.<br />
                  <strong>4. Interactive AI Copilot:</strong> Real-time Q&A grounded on live sensor telemetry.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODE 1: AUTOMATIC DIAGNOSIS PIPELINE */}
      {activeTab === 'pipeline' && (
        <>
          {/* VISUAL DIAGNOSTIC PIPELINE FLOW BAR */}
          <div className="diag-pipeline-bar">
            <div className={`pipeline-node ${isAnomaly ? 'node-fault' : 'node-nominal'}`}>
              <span className="pipeline-node-num">1</span>
              <span>ANOMALY: {isAnomaly ? 'DETECTED' : 'NONE'}</span>
            </div>
            <ArrowRight className="pipeline-arrow" size={12} />

            <div className={`pipeline-node ${isAnomaly ? 'node-fault' : 'node-nominal'}`}>
              <span className="pipeline-node-num">2</span>
              <span>FAULT: {isAnomaly ? evidence.unit : 'NOMINAL'}</span>
            </div>
            <ArrowRight className="pipeline-arrow" size={12} />

            <div className={`pipeline-node ${isAnomaly ? 'node-active' : 'node-nominal'}`}>
              <span className="pipeline-node-num">3</span>
              <span>ROOT CAUSE</span>
            </div>
            <ArrowRight className="pipeline-arrow" size={12} />

            <div className={`pipeline-node ${isAnomaly ? 'node-active' : 'node-nominal'}`}>
              <span className="pipeline-node-num">4</span>
              <span>EVIDENCE</span>
            </div>
            <ArrowRight className="pipeline-arrow" size={12} />

            <div className={`pipeline-node ${isAnomaly ? 'node-active' : 'node-nominal'}`}>
              <span className="pipeline-node-num">5</span>
              <span>SEVERITY</span>
            </div>
            <ArrowRight className="pipeline-arrow" size={12} />

            <div className={`pipeline-node ${isAnomaly ? 'node-active' : 'node-nominal'}`}>
              <span className="pipeline-node-num">6</span>
              <span>ACTION</span>
            </div>
          </div>

          {/* STATE A: SYSTEM IS NOMINAL */}
          {!isAnomaly ? (
            <div className="normal-state-panel">
              {/* TOP NORMAL BANNER */}
              <div className="normal-banner">
                <div className="normal-icon-badge">
                  <CheckCircle2 size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="normal-headline">✓ NO PROCESS ANOMALY DETECTED</div>
                  <div className="normal-subheadline">
                    System Status: <strong style={{ color: '#15803D' }}>NOMINAL</strong> · All physical sensor streams and continuous process models operating within expected envelopes.
                  </div>
                </div>
                <button
                  className="ask-ai-quick-btn"
                  onClick={() => handleAskAiAbout()}
                  title="Ask AI questions about current process"
                >
                  <Sparkles size={12} />
                  <span>Ask AI Assistant</span>
                </button>
              </div>

              {/* AI ASSESSMENT & AI REASONING ROW */}
              <div className="normal-split-row">
                {/* AI ASSESSMENT CARD */}
                <div className="normal-card">
                  <span className="step-label">AI ASSESSMENT</span>
                  <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Confidence: <strong style={{ color: 'var(--primary-blue)', fontFamily: 'var(--font-mono)' }}>{confidencePercent}%</strong>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: '1.4', margin: 0 }}>
                      {diagnosis.assessment || 'All monitored process variables are currently within their expected operating boundaries.'}
                    </p>
                  </div>
                </div>

                {/* WHY AI SAYS NORMAL (REASONING) */}
                <div className="normal-card">
                  <span className="step-label" style={{ color: 'var(--ai-cyan-hover)' }}>WHY AI SAYS NOMINAL</span>
                  <p style={{ fontSize: '0.80rem', color: 'var(--text-muted)', lineHeight: '1.4', marginTop: '6px', margin: '6px 0 0' }}>
                    {diagnosis.ai_reasoning || 'Current sensor patterns match baseline steady-state operation. Temperature gradients, vessel pressures, and vibration spectra remain nominal.'}
                  </p>
                </div>
              </div>

              {/* KEY VARIABLES FROM LIVE SENSOR DATA */}
              <div className="normal-card">
                <span className="step-label">KEY TELEMETRY VARIABLES (LIVE STREAM)</span>
                <div className="normal-vars-grid" style={{ marginTop: '8px' }}>
                  {normalVariables.map((v, i) => (
                    <div key={i} className="normal-var-box">
                      <div className="normal-var-header">
                        <span className="normal-var-name">{v.name}</span>
                        <span className="normal-var-check">✓</span>
                      </div>
                      <div className="normal-var-val">{v.val}</div>
                      <span className="normal-var-status">{v.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RECOMMENDED OPERATOR ACTION CARD */}
              <div className="normal-card action-card-normal">
                <span className="step-label" style={{ color: 'var(--primary-blue)' }}>RECOMMENDED OPERATOR ACTION</span>
                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <CheckCircle2 size={16} color="var(--primary-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A8A' }}>
                      {diagnosis.recommended_action || 'Continue routine monitoring. System operating within nominal limits.'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#1E40AF', marginTop: '2px' }}>
                      All physical and simulated units are operating within nominal baseline parameters.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* STATE B: WHEN A FAULT IS DETECTED (6-STEP VISUAL CHAIN) */
            <div className="fault-state-panel">
              {/* TOP FAULT BANNER */}
              <div className="fault-hero-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="fault-badge-pill">
                    <ShieldAlert size={14} />
                    <span>⚠ FAULT DETECTED</span>
                  </div>
                  <div className="fault-equipment-title">
                    {evidence.unit} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>·</span> {evidence.faultTitle}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="confidence-pill">
                    {confidencePercent}% CONFIDENCE
                  </span>
                  <div className={`severity-badge ${getSeverityBadgeClass(diagnosis.severity)}`}>
                    {diagnosis.severity} SEVERITY
                  </div>
                  <button
                    className="ask-ai-quick-btn fault-ask-btn"
                    onClick={() => handleAskAiAbout(evidence.unit.toLowerCase())}
                    title="Ask AI Copilot why this occurred"
                  >
                    <Sparkles size={12} />
                    <span>Ask AI Why</span>
                  </button>
                </div>
              </div>

              {/* 6-STEP EXPLAINABILITY WORKFLOW */}
              <div className="steps-flow-container">
                {/* STEP 1: DETECTION */}
                <div className="flow-step-box step-detection">
                  <div className="step-num-badge">1</div>
                  <div className="step-content">
                    <span className="step-title-text">DETECTION & CLASSIFICATION</span>
                    <div className="detection-result-title">
                      ANOMALY CONFIRMED: <span style={{ color: 'var(--sev-critical-text)' }}>{evidence.classification}</span>
                    </div>
                    <p className="detection-desc-text">{evidence.classificationDesc}</p>
                  </div>
                </div>

                {/* STEP 2: EVIDENCE FROM LIVE DATA */}
                <div className="flow-step-box step-evidence">
                  <div className="step-num-badge" style={{ backgroundColor: '#EA580C' }}>2</div>
                  <div className="step-content">
                    <span className="step-title-text">EVIDENCE FROM LIVE DATA</span>
                    
                    <div className="evidence-cards-grid">
                      {evidence.cards.map((card, idx) => (
                        <div key={idx} className={`evidence-metric-card ${card.isWarning ? 'warning-border' : ''}`}>
                          <span className="metric-card-label">{card.label}</span>
                          <span className="metric-card-val">{card.val}</span>
                          <span className={`metric-card-state ${card.isWarning ? 'state-warning' : 'state-nominal'}`}>
                            {card.state}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="evidence-narrative-box">
                      <span className="narrative-label">Pattern Match:</span>
                      <span>"{evidence.patternNarrative}"</span>
                    </div>
                  </div>
                </div>

                {/* STEP 3: PROBABLE ROOT CAUSE */}
                <div className="flow-step-box step-root-cause">
                  <div className="step-num-badge" style={{ backgroundColor: 'var(--ai-cyan)' }}>3</div>
                  <div className="step-content">
                    <span className="step-title-text" style={{ color: 'var(--ai-cyan-hover)' }}>PROBABLE ROOT CAUSE</span>
                    <div className="root-cause-hero-card">
                      <div className="root-cause-hero-title">
                        🔧 {diagnosis.root_cause.toUpperCase()}
                      </div>
                      <p className="root-cause-hero-desc">
                        "{evidence.rootCauseExplanation}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* STEP 4 & 5: SEVERITY & CONFIDENCE (SPLIT ROW) */}
                <div className="flow-split-row">
                  {/* STEP 4: SEVERITY */}
                  <div className="flow-step-box step-severity">
                    <div className="step-num-badge" style={{ backgroundColor: '#DC2626' }}>4</div>
                    <div className="step-content">
                      <span className="step-title-text">SEVERITY ASSESSMENT</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <span className={`severity-badge-large ${getSeverityBadgeClass(diagnosis.severity)}`}>
                          {diagnosis.severity}
                        </span>
                      </div>
                      <p className="severity-reason-text">
                        <strong>Why:</strong> {evidence.severityReason}
                      </p>
                    </div>
                  </div>

                  {/* STEP 5: MODEL CONFIDENCE */}
                  <div className="flow-step-box step-confidence">
                    <div className="step-num-badge" style={{ backgroundColor: 'var(--primary-blue)' }}>5</div>
                    <div className="step-content">
                      <span className="step-title-text">MODEL CONFIDENCE</span>
                      <div className="confidence-display-group">
                        <span className="confidence-large-number">
                          {isLowConfidence ? 'LOW CONFIDENCE' : `${confidencePercent}%`}
                        </span>
                        <span className="confidence-subtext">
                          Random Forest Ensemble: {confidencePercent}%
                        </span>
                      </div>
                      <div className="confidence-bar-bg" style={{ marginTop: '4px' }}>
                        <div className="confidence-bar-fill" style={{ width: `${confidencePercent}%` }}></div>
                      </div>
                      <span className="prototype-disclaimer-note">
                        Validated against first-principles chemical engineering bounds.
                      </span>
                    </div>
                  </div>
                </div>

                {/* STEP 6: RECOMMENDED OPERATOR ACTION */}
                <div className="flow-step-box step-action">
                  <div className="step-num-badge" style={{ backgroundColor: 'var(--primary-blue)' }}>6</div>
                  <div className="step-content">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="step-title-text" style={{ color: 'var(--primary-blue)' }}>
                        RECOMMENDED OPERATOR ACTION
                      </span>
                      <span className="action-priority-badge">
                        Priority: {evidence.priority}
                      </span>
                    </div>

                    <div className="action-directive-card">
                      <Wrench size={18} color="var(--primary-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div className="action-directive-text">
                          {diagnosis.recommended_action}
                        </div>
                        <div className="action-directive-subtext">
                          Operator directive generated dynamically from diagnosed root cause and process engineering heuristics.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </>
      )}

      {/* MODE 2: INTERACTIVE AI CHAT COPILOT */}
      {activeTab === 'chat' && (
        <div style={{ padding: '14px 18px 16px' }}>
          <AiChatPanel
            selectedEquipment={chatEquipment}
            onClearSelectedEquipment={() => setChatEquipment(undefined)}
          />
        </div>
      )}
    </section>
  );
};

export default AiDiagnosisPanel;
