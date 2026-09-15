import React from 'react';
import { TimelineEventItem, CausalPropagationData } from '../types';
import { Clock, Network, AlertTriangle, CheckCircle2, ArrowRight, Layers } from 'lucide-react';

interface EarlyWarningTimelineProps {
  timelineEvents?: TimelineEventItem[];
  causalPropagation?: CausalPropagationData;
}

export const EarlyWarningTimeline: React.FC<EarlyWarningTimelineProps> = ({
  timelineEvents = [],
  causalPropagation
}) => {
  const getSeverityDotClass = (sev: string) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL': return 'dot-critical';
      case 'HIGH': return 'dot-high';
      case 'MEDIUM': return 'dot-medium';
      case 'LOW': return 'dot-low';
      default: return 'dot-normal';
    }
  };

  return (
    <div className="timeline-causal-card" aria-label="Early Warning Timeline & Causal Propagation">
      {/* HEADER */}
      <div className="tc-header">
        <div className="tc-title-left">
          <Clock size={15} color="var(--primary-blue)" />
          <span className="tc-title">EARLY WARNING PROGRESSION TIMELINE & CAUSAL CHAIN</span>
        </div>
        <span className="tc-subtitle">Proof of pre-failure detection & physical mass/energy flow propagation</span>
      </div>

      <div className="tc-body">
        {/* LEFT: PROGRESSION TIMELINE */}
        <div className="tc-timeline-pane">
          <div className="tc-pane-title">DEGRADATION PROGRESSION LOG</div>

          <div className="timeline-items-wrap">
            {timelineEvents.length === 0 ? (
              <div className="tc-empty">No degradation transition events recorded.</div>
            ) : (
              timelineEvents.map(evt => (
                <div key={evt.id || Math.random()} className="timeline-node-item">
                  <div className={`timeline-dot ${getSeverityDotClass(evt.severity)}`} />
                  <div className="timeline-node-content">
                    <div className="timeline-node-header">
                      <span className="timeline-time">{evt.time}</span>
                      <span className="timeline-eq-name">{evt.equipment}</span>
                      <span className={`timeline-stage-pill ${evt.stage.toLowerCase()}`}>
                        {evt.stage.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="timeline-node-msg">{evt.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: CAUSAL PROPAGATION CHAIN */}
        <div className="tc-causal-pane">
          <div className="tc-pane-title">
            <Network size={14} style={{ display: 'inline', marginRight: 5 }} />
            PROCESS-WIDE CAUSAL PROPAGATION
          </div>

          <div className="causal-chain-box">
            <div className="causal-source-card">
              <span className="causal-lbl">PRIMARY ROOT DEGRADATION SOURCE</span>
              <div className="causal-source-title">
                {causalPropagation?.primarySource || 'None (All Units Operating Nominally)'}
              </div>
            </div>

            {causalPropagation?.downstreamConsequences && causalPropagation.downstreamConsequences.length > 0 && (
              <div className="causal-downstream-wrap">
                <span className="causal-downstream-lbl">
                  <ArrowRight size={13} style={{ display: 'inline', marginRight: 4 }} />
                  DOWNSTREAM HYDRAULIC & THERMAL CONSEQUENCES:
                </span>
                <div className="causal-impacts-list">
                  {causalPropagation.downstreamConsequences.map((cons, i) => (
                    <div key={i} className="causal-impact-item">
                      <span className="causal-impact-unit">{cons.unit}</span>
                      <span className="causal-impact-desc">{cons.impact}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
