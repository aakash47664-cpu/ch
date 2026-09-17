import React from 'react';
import { ArrowRight } from 'lucide-react';

interface ProcessContextBarProps {
  activeUnit: 'T-100' | 'P-101' | 'E-101' | 'R-101' | 'D-101' | 'T-104' | 'T-105';
  onNavigate?: (unit: 'pump' | 'heat_exchanger' | 'reactor' | 'distillation' | 'flowsheet') => void;
  trainFlow?: number;
}

export const ProcessContextBar: React.FC<ProcessContextBarProps> = ({
  activeUnit,
  onNavigate,
  trainFlow = 10.0
}) => {
  const units = [
    { id: 'T-100', label: 'T-100 Feed', nav: 'flowsheet' as const },
    { id: 'P-101', label: 'P-101 Pump', nav: 'pump' as const },
    { id: 'E-101', label: 'E-101 Exchanger', nav: 'heat_exchanger' as const },
    { id: 'R-101', label: 'R-101 CSTR', nav: 'reactor' as const },
    { id: 'D-101', label: 'D-101 Distillation', nav: 'distillation' as const },
    { id: 'T-104/5', label: 'T-104/105 Products', nav: 'flowsheet' as const }
  ];

  return (
    <div className="process-context-bar">
      <div className="context-bar-left">
        <span className="context-bar-title">Process Train Position:</span>
        <div className="context-bar-flow">
          <span className="context-flow-dot"></span>
          <span>Feed Flow: <strong>{trainFlow.toFixed(1)} L/min</strong></span>
        </div>
      </div>

      <div className="context-bar-chain">
        {units.map((u, idx) => {
          const isActive = u.id === activeUnit || (activeUnit === 'T-104' && u.id === 'T-104/5') || (activeUnit === 'T-105' && u.id === 'T-104/5');
          return (
            <React.Fragment key={u.id}>
              <button
                type="button"
                className={`context-chain-node ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate && onNavigate(u.nav)}
                title={`Navigate to ${u.label}`}
              >
                {isActive && <span className="context-active-indicator">Current Workspace</span>}
                <span className="context-node-text">{u.label}</span>
              </button>
              {idx < units.length - 1 && (
                <ArrowRight className="context-arrow" size={14} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
