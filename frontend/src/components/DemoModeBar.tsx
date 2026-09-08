import React from 'react';
import { FaultMode } from '../types';
import { PlayCircle, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

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
  const faultButtons: { id: FaultMode; label: string; isFault: boolean }[] = [
    { id: 'normal', label: 'NORMAL OPERATION', isFault: false },
    { id: 'pump_fault', label: 'PUMP FAULT', isFault: true },
    { id: 'heat_exchanger_fault', label: 'HEAT EXCHANGER FAULT', isFault: true },
    { id: 'reactor_cooling_failure', label: 'REACTOR COOLING FAILURE', isFault: true },
    { id: 'distillation_fault', label: 'DISTILLATION FAULT', isFault: true }
  ];

  const getScenarioLabel = (fault: FaultMode) => {
    switch (fault) {
      case 'pump_fault': return 'PUMP BEARING / VIBRATION FAULT';
      case 'heat_exchanger_fault': return 'HEAT EXCHANGER FOULING / DEGRADATION';
      case 'reactor_cooling_failure': return 'REACTOR COOLING SYSTEM FAILURE';
      case 'distillation_fault': return 'DISTILLATION COLUMN REFLUX LOSS';
      default: return 'NORMAL OPERATION';
    }
  };

  const isNormal = activeFault === 'normal';

  return (
    <section className="demo-mode-bar" aria-label="Demo Fault Injection Panel">
      <div className="demo-bar-left">
        <div className="demo-bar-icon-wrap" title="Interactive Demonstration Controls">
          <PlayCircle size={16} />
        </div>
        <div>
          <div className="demo-title-text">DEMO SCENARIO CONTROLS</div>
          <div className="demo-subtitle">
            Inject process deviations to demonstrate real-time AI fault diagnosis and root-cause explainability
          </div>
        </div>
      </div>

      <div className="demo-buttons-group">
        {faultButtons.map((btn) => {
          const isActive = activeFault === btn.id;
          const activeClass = isActive
            ? btn.isFault
              ? 'active-fault'
              : 'active-primary'
            : '';

          return (
            <button
              key={btn.id}
              className={`demo-btn ${activeClass}`}
              onClick={() => onSelectFault(btn.id)}
              disabled={isLoading}
              title={`Simulate ${btn.label}`}
            >
              {isActive ? (
                btn.isFault ? (
                  <AlertTriangle size={12} color="#FFFFFF" />
                ) : (
                  <CheckCircle2 size={12} color="#FFFFFF" />
                )
              ) : null}
              <span>{btn.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Active Scenario Status Line */}
      <div className="demo-feedback-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={13} color="var(--primary-blue)" />
          <span>ACTIVE SCENARIO:</span>
          <span className={`active-scenario-tag ${isNormal ? 'nominal' : 'fault'}`}>
            {getScenarioLabel(activeFault)}
          </span>
        </div>
        <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
          {isNormal
            ? 'Continuous nominal monitoring · Isolation forest threshold nominal'
            : 'Active simulated process deviation injected into live inference engine'}
        </span>
      </div>
    </section>
  );
};

export default DemoModeBar;
