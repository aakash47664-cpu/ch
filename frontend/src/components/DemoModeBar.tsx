import React from 'react';
import { FaultMode } from '../types';
import { PlayCircle, CheckCircle2, AlertTriangle, Sparkles, HelpCircle, ShieldAlert } from 'lucide-react';

interface DemoModeBarProps {
  activeFault: FaultMode;
  onSelectFault: (fault: FaultMode) => void;
  isLoading?: boolean;
}

export const DemoModeBar: React.FC<DemoModeBarProps> = ({
  activeFault,
  onSelectFault,
  isLoading = false
}) => {
  const isNormal = activeFault === 'normal';
  const isUnknown = activeFault === 'unknown_fault';
  const isEarly = activeFault.startsWith('early_');

  const getScenarioDescription = (fault: FaultMode) => {
    switch (fault) {
      case 'early_pump_degradation':
        return 'DEMO 2: Early vibration/speed drift detected before physical bearing failure boundary (Preventive Risk ~38/100).';
      case 'early_heat_exchanger_fouling':
        return 'DEMO 2: Early thermal boundary scale resistance detected before critical ΔT collapse.';
      case 'early_reactor_cooling_degradation':
        return 'DEMO 2: Early cooling dissipation decay detected before thermal runaway threshold.';
      case 'early_distillation_reflux_loss':
        return 'DEMO 2: Early reflux ratio slip detected before column overhead off-spec boundary.';
      case 'pump_fault':
        return 'DEMO 3: Confirmed pump mechanical fault (91%+ confidence, XAI breakdown, Safe to Recommend, Operator Approval Required).';
      case 'heat_exchanger_fault':
        return 'DEMO 3: Confirmed tube fouling fault (ΔT < 3°C, XAI breakdown, Safe to Recommend, Operator Approval Required).';
      case 'reactor_cooling_failure':
        return 'DEMO 3: Critical thermal runaway risk (Cooling jacket OFF, Emergency Operator Safety Protocol).';
      case 'distillation_fault':
        return 'DEMO 3: Confirmed reflux starvation fault (Reflux < 0.70, High Top Vapor Temp).';
      case 'unknown_fault':
        return 'DEMO 4 (PRIMARY USP): Anomaly detected by Isolation Forest, but pattern fails match with known classes. Result: ⚠ UNKNOWN FAULT, 🚨 DO NOT ACT, 🚨 DO NOT FORCE CLASSIFICATION.';
      default:
        return 'DEMO 1: Nominal baseline operation. All 4 continuous units within operating envelopes.';
    }
  };

  return (
    <section className="demo-mode-bar" aria-label="Demo Fault Injection Panel">
      {/* Top Header */}
      <div className="demo-bar-left">
        <div className="demo-bar-icon-wrap" title="Interactive Demonstration Controls">
          <PlayCircle size={16} />
        </div>
        <div>
          <div className="demo-title-text">DEMONSTRATION SCENARIO CONTROLS (4 EVALUATION LEVELS)</div>
          <div className="demo-subtitle">
            Manipulate live Digital Twin conditions to evaluate Early Detection, XAI Root Cause, Prognosis & Unknown Fault Safety Gating
          </div>
        </div>
      </div>

      {/* Button Rows Grouped by Level */}
      <div className="demo-scenarios-container">
        {/* LEVEL 1: NOMINAL */}
        <div className="demo-level-group">
          <span className="demo-level-badge level-1">LEVEL 1: BASELINE</span>
          <button
            className={`demo-btn ${activeFault === 'normal' ? 'active-primary' : ''}`}
            onClick={() => onSelectFault('normal')}
            disabled={isLoading}
          >
            {activeFault === 'normal' && <CheckCircle2 size={12} color="#FFFFFF" />}
            <span>NORMAL OPERATION</span>
          </button>
        </div>

        {/* LEVEL 2: EARLY FAULT DETECTION */}
        <div className="demo-level-group">
          <span className="demo-level-badge level-2">LEVEL 2: EARLY WARNING (BEFORE FAILURE)</span>
          <div className="demo-buttons-row">
            <button
              className={`demo-btn early-btn ${activeFault === 'early_pump_degradation' ? 'active-early' : ''}`}
              onClick={() => onSelectFault('early_pump_degradation')}
              disabled={isLoading}
              title="Simulate Early Pump Vibration & Speed Drift"
            >
              {activeFault === 'early_pump_degradation' && <AlertTriangle size={11} color="#FFFFFF" />}
              <span>EARLY PUMP DEGRADATION</span>
            </button>
            <button
              className={`demo-btn early-btn ${activeFault === 'early_heat_exchanger_fouling' ? 'active-early' : ''}`}
              onClick={() => onSelectFault('early_heat_exchanger_fouling')}
              disabled={isLoading}
              title="Simulate Early Heat Exchanger Thermal Fouling"
            >
              {activeFault === 'early_heat_exchanger_fouling' && <AlertTriangle size={11} color="#FFFFFF" />}
              <span>EARLY FOULING (E-101)</span>
            </button>
            <button
              className={`demo-btn early-btn ${activeFault === 'early_reactor_cooling_degradation' ? 'active-early' : ''}`}
              onClick={() => onSelectFault('early_reactor_cooling_degradation')}
              disabled={isLoading}
              title="Simulate Early Reactor Cooling Loss"
            >
              {activeFault === 'early_reactor_cooling_degradation' && <AlertTriangle size={11} color="#FFFFFF" />}
              <span>EARLY COOLING LOSS (R-101)</span>
            </button>
            <button
              className={`demo-btn early-btn ${activeFault === 'early_distillation_reflux_loss' ? 'active-early' : ''}`}
              onClick={() => onSelectFault('early_distillation_reflux_loss')}
              disabled={isLoading}
              title="Simulate Early Distillation Reflux Loss"
            >
              {activeFault === 'early_distillation_reflux_loss' && <AlertTriangle size={11} color="#FFFFFF" />}
              <span>EARLY REFLUX DECAY (D-101)</span>
            </button>
          </div>
        </div>

        {/* LEVEL 3: CONFIRMED FAULTS */}
        <div className="demo-level-group">
          <span className="demo-level-badge level-3">LEVEL 3: CONFIRMED FAULTS (XAI + ACTION)</span>
          <div className="demo-buttons-row">
            <button
              className={`demo-btn ${activeFault === 'pump_fault' ? 'active-fault' : ''}`}
              onClick={() => onSelectFault('pump_fault')}
              disabled={isLoading}
            >
              {activeFault === 'pump_fault' && <AlertTriangle size={11} color="#FFFFFF" />}
              <span>PUMP MECHANICAL FAULT</span>
            </button>
            <button
              className={`demo-btn ${activeFault === 'heat_exchanger_fault' ? 'active-fault' : ''}`}
              onClick={() => onSelectFault('heat_exchanger_fault')}
              disabled={isLoading}
            >
              {activeFault === 'heat_exchanger_fault' && <AlertTriangle size={11} color="#FFFFFF" />}
              <span>HEAT EXCHANGER FOULING</span>
            </button>
            <button
              className={`demo-btn ${activeFault === 'reactor_cooling_failure' ? 'active-fault' : ''}`}
              onClick={() => onSelectFault('reactor_cooling_failure')}
              disabled={isLoading}
            >
              {activeFault === 'reactor_cooling_failure' && <AlertTriangle size={11} color="#FFFFFF" />}
              <span>REACTOR RUNAWAY TRIP</span>
            </button>
            <button
              className={`demo-btn ${activeFault === 'distillation_fault' ? 'active-fault' : ''}`}
              onClick={() => onSelectFault('distillation_fault')}
              disabled={isLoading}
            >
              {activeFault === 'distillation_fault' && <AlertTriangle size={11} color="#FFFFFF" />}
              <span>DISTILLATION STARVATION</span>
            </button>
          </div>
        </div>

        {/* LEVEL 4: PRIMARY USP — UNKNOWN FAULT */}
        <div className="demo-level-group usp-level-group">
          <span className="demo-level-badge level-4">LEVEL 4: CORE USP (KNOWS WHEN NOT TO ACT)</span>
          <button
            className={`demo-btn unknown-usp-btn ${isUnknown ? 'active-unknown' : ''}`}
            onClick={() => onSelectFault('unknown_fault')}
            disabled={isLoading}
            title="Inject uncharacteristic multivariate deviation to demonstrate Unknown Fault Guard"
          >
            {isUnknown ? <ShieldAlert size={13} color="#FFFFFF" /> : <HelpCircle size={13} />}
            <span>⚠ UNKNOWN FAULT DEMO</span>
            <span className="usp-pill-badge">CORE USP</span>
          </button>
        </div>
      </div>

      {/* Dynamic Scenario Explanation Banner */}
      <div className={`demo-feedback-banner ${isUnknown ? 'banner-unknown' : isEarly ? 'banner-early' : isNormal ? 'banner-normal' : 'banner-fault'}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={14} />
          <span style={{ fontWeight: 700 }}>ACTIVE DEMO SCENARIO:</span>
          <span className="active-scenario-name">
            {activeFault.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
        <span className="scenario-desc-text">
          {getScenarioDescription(activeFault)}
        </span>
      </div>
    </section>
  );
};

export default DemoModeBar;
