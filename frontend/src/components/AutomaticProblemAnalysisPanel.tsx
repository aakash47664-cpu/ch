import React, { useState } from 'react';
import {
  AutomaticAnalysisItem,
  FailureEventHistoryItem,
  ProcessUpdatePayload
} from '../types';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Radio,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Search,
  MessageSquare,
  Activity,
  Flame,
  Atom,
  Layers,
  HelpCircle,
  History,
  RotateCcw,
  ChevronRight,
  GitBranch,
  Wrench,
  TrendingDown,
  TrendingUp,
  Cpu,
  Check
} from 'lucide-react';

interface AutomaticProblemAnalysisPanelProps {
  currentAnalysis: AutomaticAnalysisItem | null;
  activeProblemAnalyses?: AutomaticAnalysisItem[];
  recentAnalyses: AutomaticAnalysisItem[];
  failureHistory?: FailureEventHistoryItem[];
  isAnalyzing: boolean;
  lastAnalysisTime: string | null;
  aiError?: string | null;
  selectedUnitId?: string | null;
  onSelectUnit?: (unitId: string) => void;
  onManualReanalyze?: (equipmentId: string) => void;
  onAskAiFollowUp: (equipmentId: string, initialQuestion?: string) => void;
}

export const AutomaticProblemAnalysisPanel: React.FC<AutomaticProblemAnalysisPanelProps> = ({
  currentAnalysis,
  activeProblemAnalyses = [],
  recentAnalyses = [],
  failureHistory = [],
  isAnalyzing,
  lastAnalysisTime,
  aiError,
  selectedUnitId,
  onSelectUnit,
  onManualReanalyze,
  onAskAiFollowUp
}) => {
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [activeTabUnitId, setActiveTabUnitId] = useState<string | null>(null);

  // Active item to display: History item clicked > Selected tab unit > current live analysis
  const historyItem = selectedHistoryId
    ? recentAnalyses.find((a) => a.id === selectedHistoryId) ||
      failureHistory.find((h) => h.id === selectedHistoryId)?.analysis
    : null;

  const tabItem = activeTabUnitId
    ? activeProblemAnalyses.find((a) => a.equipmentId === activeTabUnitId)
    : null;

  const displayItem = historyItem || tabItem || currentAnalysis;

  if (!displayItem && !isAnalyzing) {
    return null;
  }

  const isFailure = displayItem?.isFailureConfirmed || displayItem?.stage === 'FAULT_CONFIRMED';
  const isUnknown = displayItem?.isUnknownFault;
  const isNominal = displayItem?.stage === 'NORMAL' && !isFailure && !isUnknown;
  const healthScore = displayItem?.healthScore ?? 100;
  const riskScore = displayItem?.riskScore ?? Math.round(100 - healthScore);
  const equipId = displayItem?.equipmentId || 'pump';
  const confidence = displayItem?.confidence ?? 89;

  const getEquipmentIcon = (id?: string) => {
    switch (id?.toLowerCase()) {
      case 'pump':
      case 'p-101':
        return <Activity size={16} className="text-sky-600" />;
      case 'heat_exchanger':
      case 'e-101':
        return <Flame size={16} className="text-amber-600" />;
      case 'reactor':
      case 'r-101':
        return <Cpu size={16} className="text-purple-600" />;
      case 'distillation':
      case 'd-101':
        return <Layers size={16} className="text-blue-600" />;
      default:
        return <Sparkles size={16} className="text-blue-600" />;
    }
  };

  const followUpSuggestions = isFailure
    ? [
        `Why did ${displayItem?.equipmentTag || 'this unit'} fail?`,
        'What physical checklist should the field operator inspect first?',
        'What are the immediate downstream shutdown risks?',
        'Could this be a false alarm or transmitter calibration drift?'
      ]
    : [
        `What caused ${displayItem?.equipmentTag || 'this unit'} degradation?`,
        'What should the operator verify before the fault trips?',
        'What is the predicted downstream impact on the reactor and column?',
        'Could this be a sensor drift rather than mechanical wear?'
      ];

  return (
    <div
      className={`auto-problem-analysis-container ${
        isFailure ? 'mode-failure' : isUnknown ? 'mode-unknown' : isNominal ? 'mode-nominal' : 'mode-degraded'
      }`}
      aria-label="Automatic AI Problem Analysis Section"
    >
      {/* =======================================================================
          1. DEDICATED HEADER & MULTIVARIABLE MONITORING STATUS BAR
          ======================================================================= */}
      <div className="auto-section-header">
        <div className="header-left-col">
          <div className="header-title-row">
            <div className="header-icon-box">
              {isFailure ? (
                <AlertOctagon size={18} className="text-rose-600" />
              ) : (
                <Sparkles size={18} className="text-blue-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="auto-main-heading">AUTOMATIC AI PROBLEM ANALYSIS</h2>
                <span className="auto-active-status-badge">
                  <span className="pulsing-emerald-dot" />
                  AUTOMATIC ANALYSIS ACTIVE
                </span>
              </div>
              <p className="auto-main-subheading">
                Continuous multivariable monitoring &bull; Root-cause analysis automatically triggered upon degradation.
              </p>
            </div>
          </div>
        </div>

        <div className="header-right-col">
          {/* Dual Engine Status Badges */}
          <div className="engine-status-group">
            <div className="status-chip ml-chip">
              <span className="chip-dot emerald" />
              <span className="chip-lbl">ML ENGINE</span>
              <span className="chip-val">ACTIVE</span>
            </div>

            {isAnalyzing ? (
              <div className="status-chip ai-chip analyzing">
                <span className="chip-spinner" />
                <span className="chip-lbl">AI ANALYSIS</span>
                <span className="chip-val">PENDING...</span>
              </div>
            ) : aiError ? (
              <div className="status-chip ai-chip unavailable" title={aiError}>
                <AlertTriangle size={11} className="text-amber-600" />
                <span className="chip-lbl">AI ANALYSIS</span>
                <span className="chip-val">TEMPORARILY UNAVAILABLE</span>
              </div>
            ) : (
              <div className="status-chip ai-chip updated">
                <span className="chip-dot blue" />
                <span className="chip-lbl">ANALYSIS UPDATED</span>
                <span className="chip-val font-mono">
                  {lastAnalysisTime || displayItem?.timestamp || 'Live'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =======================================================================
          ACTIVE PROBLEM UNITS SELECTOR TABS (If multiple degraded units exist)
          ======================================================================= */}
      {activeProblemAnalyses.length > 1 && (
        <div className="active-problems-tab-strip">
          <span className="tab-strip-label">ACTIVE PROBLEM UNITS:</span>
          <div className="tab-buttons-row">
            {activeProblemAnalyses.map((item) => {
              const isSelected =
                (activeTabUnitId === item.equipmentId) ||
                (!activeTabUnitId && displayItem?.equipmentId === item.equipmentId && !selectedHistoryId);
              const isPrimary = item.role === 'PRIMARY_FAULT';
              return (
                <button
                  key={item.equipmentId}
                  type="button"
                  className={`problem-unit-tab ${isSelected ? 'active' : ''} ${isPrimary ? 'primary-fault' : ''}`}
                  onClick={() => {
                    setSelectedHistoryId(null);
                    setActiveTabUnitId(item.equipmentId);
                    if (onSelectUnit) onSelectUnit(item.equipmentId);
                  }}
                >
                  <span className="tab-unit-tag">{item.equipmentTag || item.equipmentId.toUpperCase()}</span>
                  {isPrimary ? (
                    <span className="primary-pill">PRIMARY FAULT</span>
                  ) : (
                    <span className="downstream-pill">DOWNSTREAM</span>
                  )}
                  <span className="tab-stage-text">{item.stageLabel}</span>
                  <span className="tab-health-pct">({item.healthScore}%)</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Historical Mode Alert Banner */}
      {selectedHistoryId && (
        <div className="historical-inspection-banner">
          <div className="flex items-center gap-2">
            <History size={14} className="text-amber-700" />
            <span>
              Inspecting Historical Snapshot from <strong>{displayItem?.timestamp}</strong> for{' '}
              <strong>{displayItem?.equipmentName}</strong>
            </span>
          </div>
          <button
            type="button"
            className="btn-return-live"
            onClick={() => setSelectedHistoryId(null)}
          >
            ● Back to Live Analysis
          </button>
        </div>
      )}

      {/* =======================================================================
          2. ONE ANALYSIS CARD PER ACTIVE PROBLEM (Clean 2-Column Industrial Layout)
          ======================================================================= */}
      <div className="problem-analysis-card">
        {/* Card Header: Unit Tag, Name, Status, Health, Risk, Confidence */}
        <div className="card-top-banner">
          <div className="unit-info-group">
            <div className="unit-icon-badge">{getEquipmentIcon(displayItem?.equipmentId)}</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="unit-heading-tag">
                  {displayItem?.equipmentTag || 'P-101'} — {displayItem?.equipmentName?.split('—')[1]?.trim() || displayItem?.equipmentName || 'CENTRIFUGAL FEED PUMP'}
                </h3>
                {displayItem?.role === 'PRIMARY_FAULT' && (
                  <span className="role-tag-badge primary">PRIMARY ROOT CAUSE</span>
                )}
                {displayItem?.role === 'DOWNSTREAM_IMPACT' && (
                  <span className="role-tag-badge downstream">DOWNSTREAM CASCADE</span>
                )}
                {isFailure && <span className="critical-fault-pill">FAULT CONFIRMED</span>}
                {isUnknown && <span className="unknown-fault-pill">UNKNOWN ANOMALY</span>}
              </div>
              <div className="unit-trigger-reason">
                {displayItem?.triggerReason || 'Continuous Multivariable ML Assessment'}
              </div>
            </div>
          </div>

          <div className="kpi-metric-cards-group">
            {/* Status Pill */}
            <div className="metric-box">
              <span className="metric-title">STATUS</span>
              <span className={`metric-status-val ${isFailure ? 'crit' : healthScore < 70 ? 'warn' : 'norm'}`}>
                {displayItem?.stageLabel || (healthScore >= 90 ? 'NOMINAL' : healthScore >= 70 ? 'EARLY DEGRADATION' : 'HIGH RISK')}
              </span>
            </div>

            {/* Health Score */}
            <div className="metric-box">
              <span className="metric-title">HEALTH</span>
              <span
                className="metric-number-val"
                style={{
                  color: healthScore >= 85 ? '#16A34A' : healthScore >= 60 ? '#D97706' : '#DC2626'
                }}
              >
                {healthScore}%
              </span>
            </div>

            {/* Risk Score */}
            <div className="metric-box">
              <span className="metric-title">RISK SCORE</span>
              <span
                className="metric-number-val"
                style={{
                  color: riskScore > 60 ? '#DC2626' : riskScore > 30 ? '#D97706' : '#16A34A'
                }}
              >
                {riskScore} <span className="text-[10px] text-slate-500">/ 100</span>
              </span>
            </div>

            {/* Confidence */}
            <div className="metric-box">
              <span className="metric-title">CONFIDENCE</span>
              <span className="metric-number-val font-mono text-slate-800">
                {confidence}%
              </span>
            </div>
          </div>
        </div>

        {/* =======================================================================
            3. CLEAN 2-COLUMN STRUCTURED ENGINEERING GRID
            ======================================================================= */}
        <div className="analysis-2col-grid">
          {/* ROW 1 - LEFT: WHAT IS HAPPENING */}
          <div className="analysis-box-sec">
            <div className="sec-header-title">
              <Activity size={14} className="text-sky-600" />
              <span>WHAT IS HAPPENING</span>
            </div>
            <div className="sec-content-body">
              <p className="narrative-text">{displayItem?.whatIsHappening}</p>
            </div>
          </div>

          {/* ROW 1 - RIGHT: LIKELY ROOT CAUSE */}
          <div className="analysis-box-sec highlight-root-cause">
            <div className="sec-header-title">
              <Wrench size={14} className={isFailure ? 'text-rose-600' : 'text-amber-600'} />
              <span>LIKELY ROOT CAUSE</span>
            </div>
            <div className="sec-content-body">
              <div className="hypothesis-block">
                <div className="flex items-center justify-between gap-2">
                  <span className="hypo-label">Primary hypothesis:</span>
                  <span className="hypo-confidence-tag">Confidence: {confidence}%</span>
                </div>
                <div className="hypo-title-text">
                  {displayItem?.primaryHypothesis || displayItem?.whyItIsHappening?.split('.')[0] || 'Mechanical degradation / bearing wear'}
                </div>
              </div>

              {displayItem?.supportingEvidence && displayItem.supportingEvidence.length > 0 && (
                <div className="supporting-evidence-block">
                  <span className="block-subheading">Supporting evidence:</span>
                  <ul className="evidence-bullet-list">
                    {displayItem.supportingEvidence.map((ev, idx) => (
                      <li key={idx} className="evidence-bullet-item">
                        <span className="ev-check-icon">✓</span>
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {displayItem?.alternativePossibilities && displayItem.alternativePossibilities.length > 0 && (
                <div className="alternative-hypotheses-block">
                  <span className="block-subheading">Alternative possibilities evaluated:</span>
                  <ul className="alternative-bullet-list">
                    {displayItem.alternativePossibilities.map((alt, idx) => (
                      <li key={idx} className="alternative-bullet-item">
                        <span className="alt-dash">&bull;</span>
                        <span>{alt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* ROW 2 - LEFT: KEY EVIDENCE & SENSOR MEASUREMENTS */}
          <div className="analysis-box-sec">
            <div className="sec-header-title">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>KEY EVIDENCE &amp; SENSOR MEASUREMENTS</span>
            </div>
            <div className="sec-content-body">
              <div className="table-responsive-container">
                <table className="clean-engineering-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Baseline</th>
                      <th>Current</th>
                      <th>Deviation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(displayItem?.parameterRows || []).map((row, idx) => (
                      <tr key={idx} className={row.isAnomaly ? 'row-anomaly' : ''}>
                        <td className="font-semibold text-slate-800">{row.parameter}</td>
                        <td className="font-mono text-slate-600">{row.baseline}</td>
                        <td className="font-mono font-bold text-slate-900">{row.current}</td>
                        <td>
                          <span
                            className={`deviation-chip ${
                              row.isAnomaly
                                ? 'anomaly'
                                : row.deviation.startsWith('+') || row.deviation.startsWith('-')
                                ? 'minor'
                                : 'nominal'
                            }`}
                          >
                            {row.deviation}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ROW 2 - RIGHT: BASELINE → CURRENT DEVIATION (CLEAN HTML TABLE, ZERO LATEX) */}
          <div className="analysis-box-sec">
            <div className="sec-header-title">
              <Search size={14} className="text-blue-600" />
              <span>BASELINE → CURRENT DEVIATION</span>
            </div>
            <div className="sec-content-body">
              <div className="table-responsive-container">
                <table className="clean-engineering-table deviation-matrix-table">
                  <thead>
                    <tr>
                      <th>Monitored Variable</th>
                      <th>Design Baseline</th>
                      <th>Operating Value</th>
                      <th>Delta Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(displayItem?.parameterRows || []).map((row, idx) => (
                      <tr key={idx} className={row.isAnomaly ? 'row-deviated' : ''}>
                        <td className="font-semibold text-slate-800">{row.parameter}</td>
                        <td className="font-mono text-slate-500">{row.baseline}</td>
                        <td className="font-mono font-semibold text-slate-900">{row.current}</td>
                        <td>
                          <span
                            className={`delta-badge ${
                              row.isAnomaly
                                ? 'deviated'
                                : 'on-spec'
                            }`}
                          >
                            {row.isAnomaly ? `⚠ ${row.deviation}` : `✓ ${row.deviation}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ROW 3 - LEFT: DOWNSTREAM PROCESS IMPACT */}
          <div className="analysis-box-sec">
            <div className="sec-header-title">
              <GitBranch size={14} className="text-sky-600" />
              <span>DOWNSTREAM PROCESS IMPACT</span>
            </div>
            <div className="sec-content-body">
              <div className="topology-chain-breadcrumb">
                <span className={`chain-node ${displayItem?.equipmentId === 'pump' ? 'primary' : ''}`}>P-101</span>
                <span className="chain-arrow">&rarr;</span>
                <span className={`chain-node ${displayItem?.equipmentId === 'heat_exchanger' ? 'primary' : ''}`}>E-101</span>
                <span className="chain-arrow">&rarr;</span>
                <span className={`chain-node ${displayItem?.equipmentId === 'reactor' ? 'primary' : ''}`}>R-101</span>
                <span className="chain-arrow">&rarr;</span>
                <span className={`chain-node ${displayItem?.equipmentId === 'distillation' ? 'primary' : ''}`}>D-101</span>
              </div>

              <div className="downstream-impacts-list">
                <div className="primary-fault-indicator">
                  <strong>PRIMARY ROOT CAUSE:</strong> {displayItem?.equipmentTag || 'P-101'}
                </div>

                <div className="downstream-impacts-entries">
                  <span className="impacts-heading">DOWNSTREAM PROPAGATION:</span>
                  {(displayItem?.downstreamImpacts && displayItem.downstreamImpacts.length > 0) ? (
                    displayItem.downstreamImpacts.map((ds, idx) => (
                      <div key={idx} className="downstream-impact-card">
                        <span className="ds-unit-tag">{ds.unitTag}</span>
                        <div className="ds-impact-text">
                          {ds.unitName && <strong>{ds.unitName}: </strong>}
                          {ds.impact}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="downstream-impact-card">
                      <span className="ds-unit-tag">Train</span>
                      <div className="ds-impact-text">{displayItem?.potentialImpact || 'Zero adverse downstream consequences.'}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3 - RIGHT: WHAT THE OPERATOR SHOULD VERIFY */}
          <div className="analysis-box-sec">
            <div className="sec-header-title">
              <CheckCircle2 size={14} className="text-teal-600" />
              <span>WHAT THE OPERATOR SHOULD VERIFY</span>
            </div>
            <div className="sec-content-body">
              <div className="operator-checklist-container">
                {(displayItem?.operatorChecklist && displayItem.operatorChecklist.length > 0) ? (
                  displayItem.operatorChecklist.map((step, idx) => (
                    <div key={idx} className="checklist-item-row">
                      <span className="step-badge">{idx + 1}</span>
                      <span className="step-instruction">{step}</span>
                    </div>
                  ))
                ) : (
                  (displayItem?.whatToVerify?.split('\n') || []).map((step, idx) => (
                    <div key={idx} className="checklist-item-row">
                      <span className="step-badge">{idx + 1}</span>
                      <span className="step-instruction">{step.replace(/^\d+\.\s*/, '')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* =======================================================================
            4. ACTION FOOTER & COPILOT FOLLOW-UP BAR
            ======================================================================= */}
        <div className="analysis-card-footer">
          <div className="footer-left-info">
            <span className="footer-info-text">
              {isFailure
                ? '🔴 Critical fault automatically analyzed. Complete engineering verification before manual reset.'
                : 'Continuous ML monitoring active. Analysis auto-triggers on progressive degradation.'}
            </span>
          </div>

          <div className="footer-right-actions">
            {onManualReanalyze && (
              <button
                type="button"
                className="btn-manual-reanalyze"
                onClick={() => onManualReanalyze(equipId)}
                title="Manually re-trigger AI analysis on the current process telemetry"
              >
                <RotateCcw size={13} />
                <span>ANALYZE WITH AI</span>
              </button>
            )}

            <button
              type="button"
              className="btn-ask-copilot-followup"
              onClick={() => {
                const q = `Explain the root-cause degradation on ${displayItem?.equipmentTag || 'this unit'} and recommend immediate field verification actions.`;
                onAskAiFollowUp(equipId, q);
              }}
              title="Open ChemDiag AI Copilot for interactive engineering questions"
            >
              <MessageSquare size={13} />
              <span>Ask AI Follow-up</span>
            </button>
          </div>
        </div>

        {/* Quick Follow-up Chips */}
        <div className="quick-followup-strip">
          <span className="followup-strip-lbl">QUICK FOLLOW-UP:</span>
          <div className="followup-chips-row">
            {followUpSuggestions.map((promptText, idx) => (
              <button
                key={idx}
                type="button"
                className="followup-chip-button"
                onClick={() => onAskAiFollowUp(equipId, promptText)}
                title={`Ask Copilot: "${promptText}"`}
              >
                <span>{promptText}</span>
                <ChevronRight size={11} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =======================================================================
          5. COMPACT ANALYSIS HISTORY TIMELINE
          ======================================================================= */}
      {recentAnalyses.length > 0 && (
        <div className="analysis-history-section">
          <div className="history-header-row">
            <div className="flex items-center gap-1.5">
              <History size={13} className="text-blue-600" />
              <span className="history-title">ANALYSIS HISTORY</span>
            </div>
            <span className="history-subtitle">Click an event to inspect historical telemetry</span>
          </div>

          <div className="history-items-grid">
            {recentAnalyses.map((item) => {
              const isSelected = selectedHistoryId === item.id;
              const isItemCrit = item.isFailureConfirmed || item.stage === 'FAULT_CONFIRMED';
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`history-item-card ${isSelected ? 'selected' : ''} ${isItemCrit ? 'crit' : ''}`}
                  onClick={() => setSelectedHistoryId(isSelected ? null : item.id)}
                  title={`Inspect analysis from ${item.timestamp} for ${item.equipmentName}`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="hist-time font-mono">{item.timestamp}</span>
                    <span className={`hist-risk-badge ${item.riskScore > 50 ? 'high' : 'warn'}`}>
                      {item.stageLabel || item.stage}
                    </span>
                  </div>
                  <div className="hist-unit-tag font-bold text-slate-800">
                    {item.equipmentTag || item.equipmentId.toUpperCase()}
                  </div>
                  <div className="hist-cause-snippet text-slate-600 truncate">
                    {item.primaryHypothesis || item.whyItIsHappening || 'Process telemetry assessment'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomaticProblemAnalysisPanel;
