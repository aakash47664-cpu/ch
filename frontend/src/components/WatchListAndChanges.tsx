import React from 'react';
import { WatchListItem, WhatChangedItem } from '../types';
import { Eye, GitCommit, ArrowUpRight, ArrowDownRight, ArrowRight, Activity, Flame, Atom, Layers, CheckCircle2 } from 'lucide-react';

interface WatchListAndChangesProps {
  watchList?: WatchListItem[];
  whatChanged?: WhatChangedItem[];
  onSelectEquipment?: (equipmentId: string) => void;
}

export const WatchListAndChanges: React.FC<WatchListAndChangesProps> = ({
  watchList = [],
  whatChanged = [],
  onSelectEquipment
}) => {
  const getEquipmentIcon = (id: string) => {
    switch (id) {
      case 'pump': return <Activity size={14} />;
      case 'heat_exchanger': return <Flame size={14} />;
      case 'reactor': return <Atom size={14} />;
      case 'distillation': return <Layers size={14} />;
      default: return <Activity size={14} />;
    }
  };

  const getAttentionBadgeClass = (level: string) => {
    switch (level) {
      case 'CRITICAL ATTENTION': return 'att-badge-critical';
      case 'HIGH ATTENTION': return 'att-badge-high';
      case 'MODERATE ATTENTION': return 'att-badge-moderate';
      default: return 'att-badge-normal';
    }
  };

  const getTrendArrow = (trend: string) => {
    if (trend === 'increasing') return <span className="trend-arrow-up" title="Trending Upward">↑</span>;
    if (trend === 'decreasing') return <span className="trend-arrow-down" title="Trending Downward">↓</span>;
    return <span className="trend-arrow-stable" title="Stable">→</span>;
  };

  return (
    <div className="watch-changes-container">
      {/* COLUMN 1: EQUIPMENT TO WATCH */}
      <div className="wc-panel">
        <div className="wc-panel-header">
          <div className="wc-title-left">
            <Eye size={15} color="var(--primary-blue)" />
            <span className="wc-panel-title">EQUIPMENT TO WATCH (ATTENTION RANKING)</span>
          </div>
          <span className="wc-panel-hint">Auto-prioritized by degradation rate</span>
        </div>

        <div className="wc-panel-body">
          {watchList.length === 0 ? (
            <div className="wc-empty-msg">All equipment operating within nominal health boundaries.</div>
          ) : (
            <div className="watch-items-list">
              {watchList.map((item, index) => (
                <div
                  key={item.id || index}
                  className={`watch-item-card ${item.attentionRank >= 3 ? 'high-alert' : ''}`}
                  onClick={() => onSelectEquipment?.(item.id)}
                  title={`Inspect ${item.equipment}`}
                >
                  <div className="watch-item-top">
                    <div className="watch-rank-group">
                      <span className="watch-rank-num">#{index + 1}</span>
                      <div className="watch-eq-icon">{getEquipmentIcon(item.id)}</div>
                      <span className="watch-eq-tag">{item.equipment}</span>
                      <span className="watch-eq-name">{item.name}</span>
                    </div>

                    <div className="watch-badges-group">
                      <span className={`att-badge ${getAttentionBadgeClass(item.attentionLevel)}`}>
                        {item.attentionLevel}
                      </span>
                      <span className="watch-health-num" style={{ color: item.health < 75 ? 'var(--sev-high-text)' : 'var(--sev-normal-text)' }}>
                        {item.health}%
                      </span>
                    </div>
                  </div>

                  <div className="watch-issue-text">
                    <strong>Current Status:</strong> {item.primaryIssue}
                  </div>

                  {/* Key Variables Line */}
                  <div className="watch-vars-row">
                    {item.keyVars?.map((kv, i) => (
                      <span key={i} className="watch-var-chip">
                        {kv.name}: <strong>{kv.val}</strong> {getTrendArrow(kv.trend || 'stable')}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* COLUMN 2: WHAT CHANGED? (BASELINE VS CURRENT) */}
      <div className="wc-panel">
        <div className="wc-panel-header">
          <div className="wc-title-left">
            <GitCommit size={15} color="var(--primary-blue)" />
            <span className="wc-panel-title">WHAT CHANGED? (BASELINE VS CURRENT)</span>
          </div>
          <span className="wc-panel-hint">Continuous engineering rate-of-change</span>
        </div>

        <div className="wc-panel-body">
          {whatChanged.length === 0 ? (
            <div className="wc-empty-msg">
              <CheckCircle2 size={16} color="var(--sev-normal)" style={{ display: 'inline', marginRight: 6 }} />
              All 16 process variables tracking precisely to nominal baselines (0% drift).
            </div>
          ) : (
            <div className="changes-table-wrap">
              <table className="changes-table">
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th>Current</th>
                    <th>Baseline</th>
                    <th>Deviation</th>
                    <th>Rate/min</th>
                  </tr>
                </thead>
                <tbody>
                  {whatChanged.map((wc, idx) => {
                    const isUp = wc.deltaPercent > 0;
                    const isCrit = Math.abs(wc.deltaPercent) > 40;

                    return (
                      <tr key={wc.key || idx} className={isCrit ? 'crit-change-row' : ''}>
                        <td className="wc-name-cell">
                          <strong>{wc.name}</strong>
                        </td>
                        <td className="wc-current-cell">
                          <strong>{wc.current}</strong> <span className="wc-unit">{wc.unit}</span>
                        </td>
                        <td className="wc-base-cell">
                          {wc.baseline} {wc.unit}
                        </td>
                        <td className="wc-dev-cell">
                          <span className={`dev-badge ${isUp ? 'dev-up' : 'dev-down'}`}>
                            {isUp ? '↑ +' : '↓ '}{wc.deltaPercent}%
                          </span>
                        </td>
                        <td className="wc-roc-cell">
                          {wc.rateOfChange > 0 ? `+${wc.rateOfChange}` : wc.rateOfChange} {wc.unit}/min
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
