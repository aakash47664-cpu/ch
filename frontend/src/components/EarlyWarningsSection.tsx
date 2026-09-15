import React from 'react';
import { EarlyWarningItem } from '../types';
import { AlertTriangle, AlertOctagon, Sparkles, CheckCircle2, ChevronRight, ShieldAlert, ArrowRight } from 'lucide-react';

interface EarlyWarningsSectionProps {
  earlyWarnings?: EarlyWarningItem[];
  onSelectEquipment?: (equipmentId: string) => void;
  onAnalyzeWithAi?: (warning: EarlyWarningItem) => void;
}

export const EarlyWarningsSection: React.FC<EarlyWarningsSectionProps> = ({
  earlyWarnings = [],
  onSelectEquipment,
  onAnalyzeWithAi
}) => {
  const getEquipmentId = (name: string): string => {
    const n = (name || '').toUpperCase();
    if (n.includes('P-101') || n.includes('PUMP')) return 'pump';
    if (n.includes('E-101') || n.includes('EXCHANGER')) return 'heat_exchanger';
    if (n.includes('R-101') || n.includes('REACTOR')) return 'reactor';
    if (n.includes('D-101') || n.includes('DISTILLATION') || n.includes('COLUMN')) return 'distillation';
    return 'pump';
  };

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL': return 'sev-critical';
      case 'HIGH': return 'sev-high';
      case 'MEDIUM': return 'sev-medium';
      case 'LOW': return 'sev-low';
      default: return 'sev-normal';
    }
  };

  return (
    <div className="early-warnings-card" aria-label="Early Fault Detection Panel">
      <div className="ew-header">
        <div className="ew-header-left">
          <div className="ew-icon-box">
            <ShieldAlert size={16} />
          </div>
          <div>
            <div className="ew-title">EARLY FAULT DETECTION & MULTIVARIABLE WARNINGS</div>
            <div className="ew-subtitle">
              Proactive multi-sensor correlation identifies degradation drift BEFORE confirmed boundary trip
            </div>
          </div>
        </div>

        <div className="ew-count-badge">
          {earlyWarnings.length === 0 ? (
            <span className="ew-zero-pill">
              <CheckCircle2 size={12} />
              <span>0 EARLY DEVIATIONS</span>
            </span>
          ) : (
            <span className="ew-active-pill">
              <AlertTriangle size={12} />
              <span>{earlyWarnings.length} EARLY {earlyWarnings.length === 1 ? 'SIGNAL' : 'SIGNALS'}</span>
            </span>
          )}
        </div>
      </div>

      <div className="ew-body">
        {earlyWarnings.length === 0 ? (
          <div className="ew-nominal-state">
            <CheckCircle2 size={22} color="var(--sev-normal)" />
            <div>
              <strong>No Degradation Trends Detected</strong>
              <p>All continuous variables across P-101, E-101, R-101, and D-101 are tracking within nominal operating baselines.</p>
            </div>
          </div>
        ) : (
          <div className="ew-warnings-list">
            {earlyWarnings.map(ew => {
              const equipId = getEquipmentId(ew.equipment);

              return (
                <div key={ew.id} className={`ew-item-card ${ew.severity?.toLowerCase() || 'medium'}`}>
                  <div className="ew-item-top">
                    <div className="ew-item-tags">
                      <span className="ew-equip-badge">{ew.equipment}</span>
                      <span className={`severity-badge ${getSeverityBadgeClass(ew.severity)}`}>
                        {ew.stageLabel || ew.severity}
                      </span>
                      <span className="ew-health-badge">
                        Health: {ew.health}%
                      </span>
                    </div>

                    <div className="ew-actions-group">
                      <button
                        className="ew-ai-btn"
                        onClick={() => onAnalyzeWithAi?.(ew)}
                        title="Ask ChemDiag AI to explain this early degradation signal"
                      >
                        <Sparkles size={12} color="#FDE047" />
                        <span>AI Diagnose</span>
                      </button>

                      <button
                        className="ew-inspect-btn"
                        onClick={() => onSelectEquipment?.(equipId)}
                        title="View detailed telemetry for this unit"
                      >
                        <span>Inspect</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="ew-item-title">{ew.title}</div>
                  <p className="ew-item-summary">{ew.summary}</p>

                  {/* Correlated Multivariable Evidence */}
                  {ew.evidence && ew.evidence.length > 0 && (
                    <div className="ew-evidence-box">
                      <span className="ew-evidence-label">Correlated Degradation Evidence:</span>
                      <ul className="ew-evidence-list">
                        {ew.evidence.map((ev, idx) => (
                          <li key={idx} className="ew-evidence-item">
                            <span className="ew-bullet">•</span> {ev}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {ew.recommendedAction && (
                    <div className="ew-recom-row">
                      <strong>Proactive Recommendation:</strong> {ew.recommendedAction}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
