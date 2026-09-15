import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, AlertTriangle, AlertOctagon, Radio, Clock, CheckCircle2 } from 'lucide-react';
import { ProcessHealthData } from '../types';

interface ProcessHealthHeaderProps {
  health?: ProcessHealthData;
  lastUpdateTimestamp?: string;
  activeFaultMode?: string;
}

export const ProcessHealthHeader: React.FC<ProcessHealthHeaderProps> = ({
  health = {
    score: 95,
    stage: 'NORMAL',
    label: 'HEALTHY',
    color: '#16A34A',
    severity: 'NORMAL',
    summary: 'Continuous monitoring active. All 4 units operating within nominal design tolerances.'
  },
  lastUpdateTimestamp,
  activeFaultMode = 'normal'
}) => {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    setSecondsAgo(0);
    const interval = setInterval(() => {
      setSecondsAgo(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdateTimestamp]);

  const isStale = secondsAgo > 5;
  const score = health.score ?? 95;

  const getStageBadgeClass = (stage: string) => {
    switch (stage) {
      case 'NORMAL': return 'health-pill-normal';
      case 'EARLY_DEVIATION': return 'health-pill-deviation';
      case 'EARLY_DEGRADATION': return 'health-pill-early';
      case 'DEVELOPING_FAULT': return 'health-pill-developing';
      case 'HIGH_RISK':
      case 'FAULT_CONFIRMED': return 'health-pill-critical';
      default: return 'health-pill-normal';
    }
  };

  return (
    <div className="process-health-bar">
      {/* Left: Overall Live Process Health Score */}
      <div className="health-score-section">
        <div className="health-gauge-wrap">
          <svg className="health-ring-svg" viewBox="0 0 36 36">
            <path
              className="health-ring-bg"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="health-ring-fill"
              strokeDasharray={`${score}, 100`}
              stroke={health.color || '#16A34A'}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="health-score-number">{score}%</div>
        </div>

        <div className="health-title-group">
          <div className="health-label-row">
            <span className="health-main-title">OVERALL PROCESS HEALTH</span>
            <span className={`health-stage-pill ${getStageBadgeClass(health.stage)}`}>
              {score >= 90 ? <CheckCircle2 size={12} /> : (score >= 65 ? <AlertTriangle size={12} /> : <AlertOctagon size={12} />)}
              <span>{health.label || 'HEALTHY'}</span>
            </span>
          </div>
          <p className="health-summary-text">{health.summary}</p>
        </div>
      </div>

      {/* Right: Real-time Live Connection & Freshness Indicator */}
      <div className="health-meta-section">
        <div className={`live-stream-badge ${isStale ? 'stale' : 'live'}`}>
          <span className={`live-pulse-dot ${isStale ? 'stale' : 'live'}`} />
          <Radio size={13} />
          <span>{isStale ? 'DATA STALE' : 'LIVE MONITORING'}</span>
        </div>

        <div className="freshness-timer" title="Time since last telemetry packet from backend">
          <Clock size={12} />
          <span>{secondsAgo === 0 ? 'Just now' : `${secondsAgo}s ago`}</span>
        </div>
      </div>
    </div>
  );
};
