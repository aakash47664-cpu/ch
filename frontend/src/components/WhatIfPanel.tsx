import React, { useState } from 'react';
import { WhatIfResult } from '../types';
import { runWhatIfScenario } from '../services/api';
import {
  BrainCircuit,
  Play,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Sliders,
  Layers,
  HelpCircle,
  CheckCircle2,
  Lock,
  Cpu,
  Activity,
  Flame,
  Scale
} from 'lucide-react';

interface WhatIfPanelProps {
  processContext?: any;
}

const QUICK_SCENARIOS = [
  'What happens if I increase pump speed to 2200 RPM?',
  'What if reactor cooling fails?',
  'What happens if reflux is reduced to 1.0?',
  'What if I increase the pump flow by 20%?',
  'What happens if reactor temperature rises by 10°C?',
  'What if the heat exchanger efficiency drops by 30%?',
  'Compare 2000 RPM and 2200 RPM'
];

export const WhatIfPanel: React.FC<WhatIfPanelProps> = ({ processContext }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRunScenario = async (scenarioText?: string) => {
    const textToRun = (scenarioText || query).trim();
    if (!textToRun || isLoading) return;

    setIsLoading(true);
    setError(null);
    if (scenarioText) setQuery(scenarioText);

    try {
      const data = await runWhatIfScenario(textToRun, processContext, history);
      setResult(data);
      setHistory(prev => [
        ...prev,
        { role: 'user', content: textToRun },
        { role: 'assistant', content: data.explanation || data.answer || 'Scenario computed.' }
      ]);
    } catch (err: any) {
      console.error('What-If run error:', err);
      setError(err.message || 'Failed to execute hypothetical scenario.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setQuery('');
    setResult(null);
    setHistory([]);
    setError(null);
  };

  const getRiskColor = (stage: string = 'NORMAL') => {
    switch (stage) {
      case 'CRITICAL': return '#DC2626';
      case 'HIGH_RISK': return '#EA580C';
      case 'DEVELOPING': return '#F59E0B';
      case 'EARLY_WARNING': return '#3B82F6';
      default: return '#10B981';
    }
  };

  const getDirectionIcon = (dir: 'UP' | 'DOWN' | 'SAME') => {
    if (dir === 'UP') return <TrendingUp size={13} color="#DC2626" />;
    if (dir === 'DOWN') return <TrendingDown size={13} color="#2563EB" />;
    return <Minus size={13} color="#6B7280" />;
  };

  return (
    <div className="what-if-simulator-container" aria-label="What-If Engineering Simulator">
      {/* 1. HEADER */}
      <div className="what-if-header">
        <div className="what-if-title-group">
          <div className="what-if-icon-badge">
            <Sliders size={18} />
          </div>
          <div>
            <h3 className="what-if-main-title">
              WHAT-IF ENGINEERING SIMULATOR <span className="what-if-badge">PREDICTIVE DIGITAL TWIN</span>
            </h3>
            <p className="what-if-subtitle">
              Simulate hypothetical operational modifications & evaluate causal downstream consequences before physical execution
            </p>
          </div>
        </div>

        <div className="what-if-header-actions">
          {/* Safety disclaimer pill */}
          <div className="simulation-mode-pill" title="Simulator isolated from physical actuators">
            <Lock size={12} />
            <span>SANDBOX ONLY · NO HARDWARE ACTUATION</span>
          </div>

          <button
            className="clear-chat-btn"
            onClick={handleReset}
            title="Reset simulation context"
          >
            <RefreshCw size={12} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 2. PROMPT & NATURAL LANGUAGE INPUT */}
      <div className="what-if-input-card">
        <label className="what-if-input-label">
          <span>What would you like to test?</span>
          <span className="what-if-label-hint">Type any hypothetical change or choose a preset:</span>
        </label>

        {/* Suggestion Chips */}
        <div className="what-if-chips-list">
          {QUICK_SCENARIOS.map((chip, idx) => (
            <button
              key={idx}
              className="what-if-chip-btn"
              onClick={() => handleRunScenario(chip)}
              disabled={isLoading}
            >
              <Sparkles size={11} className="chip-sparkle" />
              <span>{chip}</span>
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="what-if-query-bar">
          <input
            type="text"
            className="what-if-query-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleRunScenario();
              }
            }}
            placeholder="e.g. What happens if I increase pump speed to 2200 RPM? or Compare 2000 RPM and 2200 RPM"
            disabled={isLoading}
          />
          <button
            className="what-if-run-btn"
            onClick={() => handleRunScenario()}
            disabled={!query.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw size={13} className="spin-icon" />
                <span>SIMULATING...</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>RUN SCENARIO</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="what-if-error-banner">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* 3. SIMULATION OUTPUT RESULTS */}
      {result && (
        <div className="what-if-results-grid">
          {/* A. MULTI-SCENARIO MATRIX VIEW (IF COMPARING MULTIPLE SCENARIOS) */}
          {result.isMulti && result.multiComparison && (
            <div className="what-if-card comparison-matrix-card">
              <div className="card-header-bar">
                <span className="step-label" style={{ color: 'var(--primary-blue)' }}>
                  <Scale size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                  MULTI-SCENARIO ENGINEERING COMPARISON MATRIX
                </span>
                <span className="what-if-status-tag">Deterministic Comparison</span>
              </div>

              <div className="comparison-table-wrapper">
                <table className="engineering-comparison-table">
                  <thead>
                    <tr>
                      <th className="col-param">Process Parameter</th>
                      <th className="col-baseline">Baseline</th>
                      {result.multiComparison.scenarios.map((s, idx) => (
                        <th key={idx} className="col-scenario">
                          {s.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="col-param">P-101 Pump Speed</td>
                      <td className="numeric-data col-baseline">{result.multiComparison.baseline.pumpRpm} RPM</td>
                      {result.multiComparison.scenarios.map((s, idx) => (
                        <td key={idx} className="numeric-data col-scenario highlight-val">{s.pumpRpm} RPM</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="col-param">P-101 Discharge Flow</td>
                      <td className="numeric-data col-baseline">{result.multiComparison.baseline.flow.toFixed(1)} L/min</td>
                      {result.multiComparison.scenarios.map((s, idx) => (
                        <td key={idx} className="numeric-data col-scenario">{s.flow.toFixed(1)} L/min</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="col-param">R-101 Reactor Core Temp</td>
                      <td className="numeric-data col-baseline">{result.multiComparison.baseline.reactorTemp.toFixed(1)} °C</td>
                      {result.multiComparison.scenarios.map((s, idx) => (
                        <td key={idx} className="numeric-data col-scenario">{s.reactorTemp.toFixed(1)} °C</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="col-param">R-101 Vessel Pressure</td>
                      <td className="numeric-data col-baseline">{result.multiComparison.baseline.reactorPressure.toFixed(2)} bar</td>
                      {result.multiComparison.scenarios.map((s, idx) => (
                        <td key={idx} className="numeric-data col-scenario">{s.reactorPressure.toFixed(2)} bar</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="col-param">D-101 Overhead Temp</td>
                      <td className="numeric-data col-baseline">{result.multiComparison.baseline.distTopTemp.toFixed(1)} °C</td>
                      {result.multiComparison.scenarios.map((s, idx) => (
                        <td key={idx} className="numeric-data col-scenario">{s.distTopTemp.toFixed(1)} °C</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="col-param">D-101 Column Pressure</td>
                      <td className="numeric-data col-baseline">{result.multiComparison.baseline.distPressure.toFixed(2)} bar</td>
                      {result.multiComparison.scenarios.map((s, idx) => (
                        <td key={idx} className="numeric-data col-scenario">{s.distPressure.toFixed(2)} bar</td>
                      ))}
                    </tr>
                    <tr className="risk-score-row">
                      <td className="col-param"><strong>Preventive Risk Score</strong></td>
                      <td className="numeric-data col-baseline" style={{ color: getRiskColor(result.multiComparison.baseline.riskStage), fontWeight: 700 }}>
                        {result.multiComparison.baseline.riskScore} / 100 ({result.multiComparison.baseline.riskStage})
                      </td>
                      {result.multiComparison.scenarios.map((s, idx) => (
                        <td key={idx} className="numeric-data col-scenario" style={{ color: getRiskColor(s.riskStage), fontWeight: 700 }}>
                          {s.riskScore} / 100 ({s.riskStage})
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* B. SINGLE SCENARIO BEFORE vs AFTER COMPARISON PANEL */}
          {!result.isMulti && result.current && result.predicted && (
            <div className="what-if-card comparison-card">
              <div className="card-header-bar">
                <span className="step-label" style={{ color: 'var(--primary-blue)' }}>
                  1. WHAT-IF SCENARIO: BEFORE vs AFTER COMPARISON
                </span>
                <span className="what-if-target-pill">
                  Target: {result.scenario?.equipment_name || 'Process Unit'} ({result.scenario?.label || 'Parameter'})
                </span>
              </div>

              <div className="comparison-table-wrapper">
                <table className="engineering-comparison-table">
                  <thead>
                    <tr>
                      <th className="col-param">Process Parameter</th>
                      <th className="col-current">CURRENT (Live Telemetry)</th>
                      <th className="col-arrow"></th>
                      <th className="col-scenario">SCENARIO (Predicted)</th>
                      <th className="col-delta">Predicted Change (Δ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="col-param">P-101 Pump Rotational Speed</td>
                      <td className="numeric-data col-current">{result.current.pump.rpm} RPM</td>
                      <td className="col-arrow"><ArrowRight size={12} /></td>
                      <td className="numeric-data col-scenario highlight-val">{result.predicted.pump.rpm} RPM</td>
                      <td className="numeric-data col-delta">
                        {result.predicted.pump.rpm - result.current.pump.rpm > 0 ? '+' : ''}
                        {result.predicted.pump.rpm - result.current.pump.rpm} RPM
                      </td>
                    </tr>
                    <tr>
                      <td className="col-param">P-101 Volumetric Flow Rate</td>
                      <td className="numeric-data col-current">{result.current.pump.flow?.toFixed(1)} L/min</td>
                      <td className="col-arrow"><ArrowRight size={12} /></td>
                      <td className="numeric-data col-scenario highlight-val">{result.predicted.pump.flow?.toFixed(1)} L/min</td>
                      <td className="numeric-data col-delta">
                        {((result.predicted.pump.flow || 0) - (result.current.pump.flow || 0)) > 0 ? '+' : ''}
                        {((result.predicted.pump.flow || 0) - (result.current.pump.flow || 0)).toFixed(1)} L/min
                      </td>
                    </tr>
                    <tr>
                      <td className="col-param">E-101 Thermal Gradient (ΔT)</td>
                      <td className="numeric-data col-current">{result.current.heatExchanger.temperature_difference?.toFixed(1)} °C</td>
                      <td className="col-arrow"><ArrowRight size={12} /></td>
                      <td className="numeric-data col-scenario">{result.predicted.heatExchanger.temperature_difference?.toFixed(1)} °C</td>
                      <td className="numeric-data col-delta">
                        {((result.predicted.heatExchanger.temperature_difference || 0) - (result.current.heatExchanger.temperature_difference || 0)) > 0 ? '+' : ''}
                        {((result.predicted.heatExchanger.temperature_difference || 0) - (result.current.heatExchanger.temperature_difference || 0)).toFixed(1)} °C
                      </td>
                    </tr>
                    <tr>
                      <td className="col-param">R-101 Reactor Core Temperature</td>
                      <td className="numeric-data col-current">{result.current.reactor.temperature?.toFixed(1)} °C</td>
                      <td className="col-arrow"><ArrowRight size={12} /></td>
                      <td className="numeric-data col-scenario highlight-val">{result.predicted.reactor.temperature?.toFixed(1)} °C</td>
                      <td className="numeric-data col-delta">
                        {((result.predicted.reactor.temperature || 0) - (result.current.reactor.temperature || 0)) > 0 ? '+' : ''}
                        {((result.predicted.reactor.temperature || 0) - (result.current.reactor.temperature || 0)).toFixed(1)} °C
                      </td>
                    </tr>
                    <tr>
                      <td className="col-param">R-101 Reactor Vessel Pressure</td>
                      <td className="numeric-data col-current">{result.current.reactor.pressure?.toFixed(2)} bar</td>
                      <td className="col-arrow"><ArrowRight size={12} /></td>
                      <td className="numeric-data col-scenario">{result.predicted.reactor.pressure?.toFixed(2)} bar</td>
                      <td className="numeric-data col-delta">
                        {((result.predicted.reactor.pressure || 0) - (result.current.reactor.pressure || 0)) > 0 ? '+' : ''}
                        {((result.predicted.reactor.pressure || 0) - (result.current.reactor.pressure || 0)).toFixed(2)} bar
                      </td>
                    </tr>
                    <tr>
                      <td className="col-param">D-101 Overhead Top Temperature</td>
                      <td className="numeric-data col-current">{result.current.distillation.top_temperature?.toFixed(1)} °C</td>
                      <td className="col-arrow"><ArrowRight size={12} /></td>
                      <td className="numeric-data col-scenario">{result.predicted.distillation.top_temperature?.toFixed(1)} °C</td>
                      <td className="numeric-data col-delta">
                        {((result.predicted.distillation.top_temperature || 0) - (result.current.distillation.top_temperature || 0)) > 0 ? '+' : ''}
                        {((result.predicted.distillation.top_temperature || 0) - (result.current.distillation.top_temperature || 0)).toFixed(1)} °C
                      </td>
                    </tr>
                    <tr>
                      <td className="col-param">D-101 Column Operating Pressure</td>
                      <td className="numeric-data col-current">{result.current.distillation.pressure?.toFixed(2)} bar</td>
                      <td className="col-arrow"><ArrowRight size={12} /></td>
                      <td className="numeric-data col-scenario">{result.predicted.distillation.pressure?.toFixed(2)} bar</td>
                      <td className="numeric-data col-delta">
                        {((result.predicted.distillation.pressure || 0) - (result.current.distillation.pressure || 0)) > 0 ? '+' : ''}
                        {((result.predicted.distillation.pressure || 0) - (result.current.distillation.pressure || 0)).toFixed(2)} bar
                      </td>
                    </tr>
                    <tr className="risk-score-row">
                      <td className="col-param"><strong>Overall Process Risk Stage</strong></td>
                      <td className="numeric-data col-current" style={{ color: getRiskColor(result.risk?.currentStage), fontWeight: 700 }}>
                        {result.risk?.currentStage} ({result.risk?.currentScore}/100)
                      </td>
                      <td className="col-arrow"><ArrowRight size={12} /></td>
                      <td className="numeric-data col-scenario" style={{ color: getRiskColor(result.risk?.scenarioStage), fontWeight: 700 }}>
                        {result.risk?.scenarioStage} ({result.risk?.scenarioScore}/100)
                      </td>
                      <td className="numeric-data col-delta" style={{ fontWeight: 700 }}>
                        {result.risk?.currentStage} → {result.risk?.scenarioStage}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* C. DYNAMIC PROCESS IMPACT CHAIN */}
          {result.impactChain && result.impactChain.length > 0 && (
            <div className="what-if-card impact-chain-card">
              <div className="card-header-bar">
                <span className="step-label" style={{ color: '#7C3AED' }}>
                  <Activity size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                  2. PROCESS IMPACT CHAIN (DYNAMIC CAUSAL PROPAGATION)
                </span>
                <span className="what-if-status-tag">Flowsheet Propagation</span>
              </div>

              <div className="impact-chain-steps-container">
                {result.impactChain.map((node, idx) => (
                  <div key={idx} className="impact-chain-node-row">
                    <div className="node-step-circle numeric-data">{node.step}</div>
                    <div className="node-content-card">
                      <div className="node-header">
                        <span className="node-equip-name">{node.equipment}</span>
                        <div className="node-param-direction">
                          {getDirectionIcon(node.direction)}
                          <span className="node-param-name">{node.parameter}</span>
                        </div>
                      </div>
                      <div className="node-values-line">
                        <span className="from-val numeric-data">{node.from}</span>
                        <ArrowRight size={12} className="node-arrow" />
                        <span className="to-val numeric-data">{node.to}</span>
                      </div>
                      <p className="node-detail-text">{node.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* D. RISK PREDICTION & SAFETY GATE */}
          {result.risk && (
            <div className="what-if-card risk-prediction-card">
              <div className="card-header-bar">
                <span className="step-label" style={{ color: result.risk.isDangerous ? '#DC2626' : '#10B981' }}>
                  {result.risk.isDangerous ? <ShieldAlert size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} /> : <ShieldCheck size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />}
                  3. RISK PREDICTION & SAFETY GATE EVALUATION
                </span>
                <span className={`risk-badge-transition ${result.risk.isDangerous ? 'critical' : 'safe'}`}>
                  {result.risk.currentStage} → {result.risk.scenarioStage}
                </span>
              </div>

              <div className="risk-transition-banner">
                <div className="risk-score-box current-risk">
                  <span className="box-title">CURRENT RISK</span>
                  <div className="box-value numeric-data" style={{ color: getRiskColor(result.risk.currentStage) }}>
                    {result.risk.currentStage}
                  </div>
                  <span className="box-score numeric-data">{result.risk.currentScore} / 100</span>
                </div>

                <div className="risk-arrow-wrap">
                  <ArrowRight size={22} color="var(--primary-blue)" />
                </div>

                <div className="risk-score-box scenario-risk">
                  <span className="box-title">SCENARIO RISK</span>
                  <div className="box-value numeric-data" style={{ color: getRiskColor(result.risk.scenarioStage) }}>
                    {result.risk.scenarioStage}
                  </div>
                  <span className="box-score numeric-data">{result.risk.scenarioScore} / 100</span>
                </div>
              </div>

              {result.risk.isDangerous ? (
                <div className="dangerous-scenario-callout">
                  <div className="callout-title">🚨 SCENARIO RISK: CRITICAL / HIGH HAZARD</div>
                  <p className="callout-text">
                    This hypothetical change breaches safe operating envelopes (excessive thermal gradient, vapor pressure escalation, or cavitation limit).
                    Never apply this condition to physical plant hardware.
                  </p>
                </div>
              ) : (
                <div className="safe-scenario-callout">
                  <div className="callout-title">✓ SCENARIO WITHIN ACCEPTABLE PROCESS BOUNDS</div>
                  <p className="callout-text">
                    Predicted parameters remain within continuous design envelopes. Prior to manual implementation, verify upstream feed availability and auxiliary utility margins.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* E. AI ENGINEERING EXPLANATION */}
          <div className="what-if-card ai-explanation-card">
            <div className="card-header-bar">
              <span className="step-label" style={{ color: 'var(--ai-cyan-hover)' }}>
                <BrainCircuit size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                4. CHEMDIAG INDUSTRIAL AI EXPLANATION
              </span>
              <span className="copilot-pill">Groq Grounded Brain</span>
            </div>

            <div className="ai-explanation-content">
              {result.explanation.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.') || line.startsWith('4.') || line.startsWith('5.') || line.startsWith('6.') || line.startsWith('7.') || line.startsWith('8.') || line.startsWith('WHAT-IF') || line.startsWith('MULTI-SCENARIO') || line.startsWith('Recommendation:') ? (
                    <div className="explanation-section-heading">{line}</div>
                  ) : line.startsWith('-') || line.startsWith('•') ? (
                    <div className="explanation-bullet">{line}</div>
                  ) : (
                    <p style={{ margin: line === '' ? '4px 0' : '2px 0', lineHeight: 1.5, color: 'var(--text-secondary)', fontSize: '0.80rem' }}>
                      {line}
                    </p>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatIfPanel;
