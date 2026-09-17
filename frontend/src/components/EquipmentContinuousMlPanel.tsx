import React, { useState, useEffect } from 'react';
import { EquipmentDiagnosticItem, SeverityLevel } from '../types';
import {
  Brain,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Minus,
  Layers,
  ArrowRight,
  Sparkles,
  Zap,
  Radio,
  Clock,
  Gauge,
  ShieldCheck,
  Cpu,
  Flame
} from 'lucide-react';

interface EquipmentContinuousMlPanelProps {
  diagnostic: EquipmentDiagnosticItem | undefined;
  allDiagnostics?: Record<string, EquipmentDiagnosticItem>;
  unitTag: string;
  unitName: string;
  onSelectUnit?: (unitId: string) => void;
  onNavigateTab?: (tab: 'overview' | 'flowsheet' | 'pump' | 'heat_exchanger' | 'reactor' | 'distillation' | 'ai_diagnosis' | 'alerts') => void;
  onAskAiAbout?: (unitId: string) => void;
}

export const EquipmentContinuousMlPanel: React.FC<EquipmentContinuousMlPanelProps> = ({
  diagnostic,
  allDiagnostics = {},
  unitTag,
  unitName,
  onSelectUnit,
  onNavigateTab,
  onAskAiAbout
}) => {
  const [lastCycleSeconds, setLastCycleSeconds] = useState<string>('0.8');

  useEffect(() => {
    const interval = setInterval(() => {
      if (diagnostic?.lastUpdated) {
        const diffMs = Math.max(200, Date.now() - new Date(diagnostic.lastUpdated).getTime());
        setLastCycleSeconds((diffMs / 1000).toFixed(1));
      } else {
        setLastCycleSeconds('1.0');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [diagnostic?.lastUpdated]);

  if (!diagnostic) {
    return (
      <div className="ml-panel-container loading">
        <div className="flex items-center justify-center p-8 gap-3 text-slate-600">
          <Brain className="animate-spin text-blue-600" size={24} />
          <span className="font-semibold text-sm">Continuous ML Monitoring Engine Initializing...</span>
        </div>
      </div>
    );
  }

  const {
    anomalyScore = 0.08,
    anomaly = false,
    faultClass = 'normal',
    faultLabel = 'Normal Operation',
    faultProbability = 0.96,
    probabilities = {},
    isUnknownFault = false,
    health = 100,
    risk = 0,
    stageLabel = 'HEALTHY',
    severity = 'NORMAL',
    color = '#16A34A',
    trend = 'STABLE',
    persistenceTicks = 0,
    role = 'NOMINAL',
    evidence = [],
    sensorReliability = { score: 98, source: 'Physical Sensors / Validated Telemetry' },
    processImpact
  } = diagnostic;

  const isPrimaryFault = role === 'PRIMARY_FAULT';
  const isDownstream = role === 'DOWNSTREAM_IMPACT';

  // Format probability key for display
  const formatProbKey = (k: string) => {
    return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Safe trend string (always uppercase: STABLE, IMPROVING, DEGRADING, RAPIDLY DEGRADING)
  const normalizedTrend = (persistenceTicks === 0) ? 'STABLE' : (trend || 'STABLE').toUpperCase();

  // All 4 units for the plant-wide overview
  const unitsOverview = [
    { id: 'pump', tag: 'P-101', name: 'Feed Pump', icon: Activity, diag: allDiagnostics.P101 || allDiagnostics.pump },
    { id: 'heat_exchanger', tag: 'E-101', name: 'Heat Exchanger', icon: Flame, diag: allDiagnostics.E101 || allDiagnostics.heat_exchanger },
    { id: 'reactor', tag: 'R-101', name: 'CSTR Reactor', icon: Cpu, diag: allDiagnostics.R101 || allDiagnostics.reactor },
    { id: 'distillation', tag: 'D-101', name: 'Distillation', icon: Layers, diag: allDiagnostics.D101 || allDiagnostics.distillation }
  ];

  return (
    <div className="ml-panel-container">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & ML ENGINE STATUS                                          */}
      {/* ========================================================================= */}
      <div className="ml-header-section">
        <div className="ml-header-top-row">
          <div className="ml-title-group">
            <div className="ml-logo-icon-box">
              <Brain size={22} className="text-blue-600" />
            </div>
            <div>
              <h2 className="ml-main-title">ML MONITORING</h2>
              <p className="ml-main-subtitle">Continuous Machine Learning Diagnostic State</p>
            </div>
          </div>

          <div className="ml-status-badges-group">
            <div className="ml-engine-badge active">
              <span className="ml-pulse-dot active"></span>
              <span className="ml-badge-text font-bold">ML ENGINE ACTIVE</span>
            </div>
            <div className="ml-metric-pill">
              <span className="pill-muted">Monitoring:</span>
              <span className="pill-bold">4 / 4 Units</span>
            </div>
            <div className="ml-metric-pill">
              <span className="pill-muted">Last cycle:</span>
              <span className="pill-bold font-mono">{lastCycleSeconds} s ago</span>
            </div>
          </div>
        </div>

        {/* ML Architecture Badges (Section 6) */}
        <div className="ml-architecture-bar">
          <div className="ml-arch-title">
            <span className="ml-arch-tag">CONTINUOUS ML ENGINE</span>
            <span className="ml-arch-status">● ACTIVE</span>
          </div>
          <div className="ml-models-grid">
            <div className="ml-model-chip">
              <span className="model-name">Isolation Forest</span>
              <span className="model-arrow">→</span>
              <span className="model-desc">Anomaly Detection</span>
            </div>
            <div className="ml-model-chip">
              <span className="model-name">Random Forest</span>
              <span className="model-arrow">→</span>
              <span className="model-desc">Fault Classification</span>
            </div>
            <div className="ml-model-chip">
              <span className="model-name">Engineering Rules</span>
              <span className="model-arrow">→</span>
              <span className="model-desc">Physical Validation</span>
            </div>
            <div className="ml-model-chip">
              <span className="model-name">XAI</span>
              <span className="model-arrow">→</span>
              <span className="model-desc">Evidence &amp; Importance</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PLANT-WIDE ML STATUS (ALL 4 UNITS MONITORED SIMULTANEOUSLY)            */}
      {/* ========================================================================= */}
      <div className="ml-plant-overview-section">
        <div className="ml-section-header">
          <span className="ml-section-title">PLANT-WIDE ML STATUS</span>
          <span className="ml-section-note">Live Continuous Evaluation Across Entire Train</span>
        </div>

        <div className="ml-units-overview-grid">
          {unitsOverview.map((u, idx) => {
            const uDiag = u.diag;
            const uHealth = uDiag?.health ?? 100;
            const uAnomaly = uDiag?.anomalyScore ?? 0.08;
            const uRole = uDiag?.role ?? 'NOMINAL';
            const uIsSelected = (unitTag === u.tag) || (unitName.toLowerCase().includes(u.id));

            let roleStatusText = '● NORMAL';
            let roleStatusClass = 'status-normal';
            if (uRole === 'PRIMARY_FAULT') {
              roleStatusText = '🔴 PRIMARY FAULT';
              roleStatusClass = 'status-fault';
            } else if (uRole === 'DOWNSTREAM_IMPACT') {
              roleStatusText = '🟠 DOWNSTREAM IMPACT';
              roleStatusClass = 'status-downstream';
            } else if (uHealth < 85) {
              roleStatusText = '🟡 DEVIATION';
              roleStatusClass = 'status-warning';
            }

            return (
              <React.Fragment key={u.tag}>
                <button
                  type="button"
                  className={`ml-unit-card ${uIsSelected ? 'selected' : ''} ${roleStatusClass}`}
                  onClick={() => onSelectUnit && onSelectUnit(u.id)}
                  title={`Click to inspect ${u.tag} ML state`}
                >
                  <div className="ml-unit-card-header">
                    <span className="unit-card-tag font-bold">{u.tag}</span>
                    <span className="unit-card-name text-slate-500">{u.name}</span>
                  </div>

                  <div className={`unit-card-status-badge ${roleStatusClass}`}>
                    {roleStatusText}
                  </div>

                  <div className="unit-card-metrics-row">
                    <div className="unit-card-metric">
                      <span className="metric-label">Health</span>
                      <span className="metric-val font-mono font-bold">{uHealth}%</span>
                    </div>
                    <div className="unit-card-metric">
                      <span className="metric-label">Anomaly</span>
                      <span className="metric-val font-mono font-bold">{uAnomaly.toFixed(3)}</span>
                    </div>
                  </div>
                </button>

                {idx < unitsOverview.length - 1 && (
                  <div className="ml-causal-connector">
                    <ArrowRight size={16} className="text-slate-400" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SELECTED EQUIPMENT HEADER & STATUS                                     */}
      {/* ========================================================================= */}
      <div className="ml-selected-unit-header">
        <div className="selected-unit-title-group">
          <span className="selected-unit-tag">{unitTag}</span>
          <span className="selected-unit-label">CONTINUOUS ML DIAGNOSTIC STATE</span>
        </div>

        <div className="selected-unit-badges">
          {isPrimaryFault && (
            <span className="badge-primary-fault">
              <AlertTriangle size={14} /> PRIMARY FAULT ORIGIN
            </span>
          )}
          {isDownstream && (
            <span className="badge-downstream">
              <Layers size={14} /> DOWNSTREAM IMPACT
            </span>
          )}
          <span
            className="badge-health-pill"
            style={{ backgroundColor: color ? `${color}15` : '#DCFCE7', color: color || '#16A34A', borderColor: color ? `${color}40` : '#86EFAC' }}
          >
            ● {stageLabel} ({health}%)
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. COMPACT 2x2 ML CARD GRID (CLEAN, SEPARATE DOM ELEMENTS, NO CONCAT)     */}
      {/* ========================================================================= */}
      <div className="ml-card-grid-2x2">
        {/* CARD 1: EQUIPMENT HEALTH */}
        <div className="ml-diagnostic-card">
          <div className="ml-card-label">EQUIPMENT HEALTH</div>
          <div className="ml-card-value" style={{ color: color || '#16A34A' }}>
            {health}%
          </div>
          <div className="ml-card-status">
            <span className="status-dot" style={{ backgroundColor: color || '#16A34A' }}></span>
            <span className="status-text">{stageLabel}</span>
          </div>
          <div className="ml-card-support">
            <div className="support-label">Physical Integrity Index</div>
            <div className="support-progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${health}%`, backgroundColor: color || '#16A34A' }}
              />
            </div>
          </div>
        </div>

        {/* CARD 2: ISOLATION FOREST ANOMALY SCORE */}
        <div className="ml-diagnostic-card">
          <div className="ml-card-label">ISOLATION FOREST ANOMALY SCORE</div>
          <div className={`ml-card-value ${anomaly ? 'val-fault' : 'val-normal'}`}>
            {anomalyScore.toFixed(3)}
          </div>
          <div className="ml-card-status">
            <span className={`status-dot ${anomaly ? 'bg-rose-600' : 'bg-emerald-600'}`}></span>
            <span className={`status-text font-bold ${anomaly ? 'text-rose-700' : 'text-emerald-700'}`}>
              {anomaly ? '▲ ANOMALOUS' : '● NOMINAL'}
            </span>
          </div>
          <div className="ml-card-support">
            <div className="support-row">
              <span className="text-slate-500">Nominal Threshold:</span>
              <span className="font-mono font-bold text-slate-700">0.560</span>
            </div>
          </div>
        </div>

        {/* CARD 3: RANDOM FOREST FAULT CLASSIFICATION */}
        <div className="ml-diagnostic-card">
          <div className="ml-card-label">RANDOM FOREST CLASSIFICATION</div>
          <div className="ml-card-value-text truncate" title={faultLabel}>
            {faultLabel}
          </div>
          <div className="ml-card-status">
            <span className="status-label-muted">Confidence:</span>
            <span className="status-value-bold font-mono">
              {(faultProbability * 100).toFixed(1)}%
            </span>
          </div>
          <div className="ml-card-support">
            <div className="support-label">Ensemble Decision Trees (25 Trees)</div>
          </div>
        </div>

        {/* CARD 4: TREND & PERSISTENCE */}
        <div className="ml-diagnostic-card">
          <div className="ml-card-label">TREND &amp; PERSISTENCE</div>
          <div className="ml-card-value-text flex items-center gap-2">
            {normalizedTrend === 'DEGRADING' || normalizedTrend === 'RAPIDLY DEGRADING' ? (
              <TrendingDown className="text-rose-600 shrink-0" size={22} />
            ) : normalizedTrend === 'IMPROVING' ? (
              <TrendingUp className="text-emerald-600 shrink-0" size={22} />
            ) : (
              <Minus className="text-slate-500 shrink-0" size={22} />
            )}
            <span className={normalizedTrend === 'DEGRADING' || normalizedTrend === 'RAPIDLY DEGRADING' ? 'text-rose-700' : 'text-slate-900'}>
              {normalizedTrend}
            </span>
          </div>
          <div className="ml-card-status">
            <span className="status-label-muted">Persistence:</span>
            <span className="status-value-bold font-mono">
              {persistenceTicks} sample cycles
            </span>
          </div>
          <div className="ml-card-support">
            <div className="support-label">Sliding-Window Rate of Change Tracking</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. FAULT PROBABILITY SPECTRUM (HORIZONTAL BARS)                           */}
      {/* ========================================================================= */}
      <div className="ml-probability-section">
        <div className="ml-section-header">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-blue-600" />
            <span className="ml-section-title">FAULT PROBABILITY SPECTRUM</span>
          </div>
          <span className="ml-section-note">Random Forest Multi-Class Ensemble Votes</span>
        </div>

        {isUnknownFault && (
          <div className="ml-unknown-guard-alert">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div>
              <div className="unknown-guard-title">UNKNOWN FAULT GUARD ACTIVE</div>
              <p className="unknown-guard-desc">
                Anomaly detected by Isolation Forest, but multivariate signature does not match learned single-unit failure profiles with sufficient confidence (&gt; 52%). Classification is withheld to prevent false assumptions.
              </p>
            </div>
          </div>
        )}

        <div className="ml-probability-list">
          {Object.entries(probabilities).map(([key, prob]) => {
            const pct = (prob * 100).toFixed(1);
            const isSelected = key === faultClass;
            const isNormalKey = key === 'normal';

            return (
              <div key={key} className={`ml-prob-row ${isSelected ? 'selected' : ''}`}>
                <div className="ml-prob-label-col">
                  <span className={`prob-class-name ${isSelected ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                    {formatProbKey(key)}
                  </span>
                </div>

                <div className="ml-prob-bar-col">
                  <div className="prob-bar-track">
                    <div
                      className={`prob-bar-fill ${isSelected ? (isNormalKey ? 'fill-emerald' : 'fill-rose') : 'fill-slate'}`}
                      style={{ width: `${Math.max(2, parseFloat(pct))}%` }}
                    />
                  </div>
                </div>

                <div className="ml-prob-val-col">
                  <span className="prob-pct-val font-mono font-bold">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. CORRELATED ML EVIDENCE & SENSOR INTEGRITY                              */}
      {/* ========================================================================= */}
      <div className="ml-evidence-section">
        <div className="ml-section-header">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-blue-600" />
            <span className="ml-section-title">ML EVIDENCE &amp; FIRST-PRINCIPLES RULES</span>
          </div>
          <span className="ml-section-note">Deterministic Cross-Verification</span>
        </div>

        <div className="ml-evidence-list">
          {evidence.map((item, idx) => (
            <div key={idx} className="ml-evidence-item">
              <div className="evidence-bullet"></div>
              <span className="evidence-text">{item}</span>
            </div>
          ))}
        </div>

        <div className="ml-sensor-integrity-footer">
          <div className="sensor-source-info">
            <span className="text-slate-500">Telemetry Source:</span>
            <span className="font-semibold text-slate-700">{sensorReliability.source}</span>
          </div>
          <div className="sensor-score-badge">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span className="font-bold text-emerald-800">Signal Score: {sensorReliability.score}%</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. CAUSE → EFFECT: PROCESS-WIDE CAUSAL PROPAGATION                        */}
      {/* ========================================================================= */}
      {processImpact && (
        <div className="ml-causal-propagation-section">
          <div className="ml-section-header">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-slate-700" />
              <span className="ml-section-title">CAUSE → EFFECT: PROCESS-WIDE CAUSAL PROPAGATION</span>
            </div>
            <span className="ml-section-note">P-101 → E-101 → R-101 → D-101 Process Train</span>
          </div>

          <div className="ml-causal-cards-grid">
            <div className="ml-causal-card upstream">
              <span className="causal-step-tag">1. UPSTREAM SOURCE</span>
              <p className="causal-step-text">{processImpact.upstream}</p>
            </div>

            <div className="ml-causal-card current">
              <span className="causal-step-tag active">2. CURRENT UNIT ({unitTag})</span>
              <p className="causal-step-text font-semibold">{processImpact.currentUnit}</p>
            </div>

            <div className="ml-causal-card downstream">
              <span className="causal-step-tag">3. DOWNSTREAM CONSEQUENCES</span>
              <p className="causal-step-text">{processImpact.downstream}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
