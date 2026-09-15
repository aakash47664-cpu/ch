import React from 'react';
import { EquipmentHealthMap, EquipmentHealthItem } from '../types';
import { Activity, Flame, Atom, Layers, AlertTriangle, AlertOctagon, CheckCircle2, ChevronRight } from 'lucide-react';

interface EquipmentHealthGridProps {
  equipmentHealth?: EquipmentHealthMap;
  selectedEquipment?: string;
  onSelectEquipment?: (equipmentId: string) => void;
}

export const EquipmentHealthGrid: React.FC<EquipmentHealthGridProps> = ({
  equipmentHealth,
  selectedEquipment,
  onSelectEquipment
}) => {
  const units: Array<{ id: string; key: keyof EquipmentHealthMap; defaultName: string; defaultTag: string; icon: React.ReactNode }> = [
    { id: 'pump', key: 'pump', defaultName: 'Feed Pump', defaultTag: 'P-101', icon: <Activity size={16} /> },
    { id: 'heat_exchanger', key: 'heat_exchanger', defaultName: 'Heat Exchanger', defaultTag: 'E-101', icon: <Flame size={16} /> },
    { id: 'reactor', key: 'reactor', defaultName: 'CSTR Reactor', defaultTag: 'R-101', icon: <Atom size={16} /> },
    { id: 'distillation', key: 'distillation', defaultName: 'Distillation Column', defaultTag: 'D-101', icon: <Layers size={16} /> }
  ];

  const getStageBadgeClass = (stage?: string) => {
    switch (stage) {
      case 'NORMAL': return 'eq-pill-normal';
      case 'EARLY_DEVIATION': return 'eq-pill-deviation';
      case 'EARLY_DEGRADATION': return 'eq-pill-early';
      case 'DEVELOPING_FAULT': return 'eq-pill-developing';
      case 'HIGH_RISK':
      case 'FAULT_CONFIRMED': return 'eq-pill-critical';
      default: return 'eq-pill-normal';
    }
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === 'increasing') return <span className="eq-trend-up" title="Upward rate of change">↑</span>;
    if (trend === 'decreasing') return <span className="eq-trend-down" title="Downward rate of change">↓</span>;
    return <span className="eq-trend-stable" title="Stable rate of change">→</span>;
  };

  return (
    <div className="equipment-health-grid" aria-label="Equipment Health Monitoring Grid">
      {units.map(({ id, key, defaultName, defaultTag, icon }) => {
        const item: Partial<EquipmentHealthItem> = equipmentHealth?.[key] || {
          id,
          equipment: defaultTag,
          name: defaultName,
          health: 100,
          stage: 'NORMAL',
          label: 'NORMAL',
          color: '#16A34A',
          severity: 'NORMAL',
          primaryVar: 'Nominal'
        };

        const score = item.health ?? 100;
        const isSelected = selectedEquipment === id;

        return (
          <div
            key={id}
            className={`eq-health-card ${isSelected ? 'selected' : ''} ${item.stage?.toLowerCase() || 'normal'}`}
            onClick={() => onSelectEquipment?.(id)}
            role="button"
            tabIndex={0}
            title={`Click to view detailed real-time monitoring and trend analysis for ${item.equipment || defaultTag}`}
          >
            {/* Header: Tag + Name + Health Score */}
            <div className="eq-card-header">
              <div className="eq-tag-group">
                <div className="eq-icon-box">{icon}</div>
                <div>
                  <div className="eq-tag-title">{item.equipment || defaultTag}</div>
                  <div className="eq-subname">{defaultName}</div>
                </div>
              </div>

              <div className="eq-score-box">
                <div className="eq-score-num" style={{ color: item.color || '#16A34A' }}>
                  {score}%
                </div>
                <div className="eq-score-lbl">HEALTH</div>
              </div>
            </div>

            {/* Health Bar Progression */}
            <div className="eq-health-bar-track">
              <div
                className="eq-health-bar-fill"
                style={{
                  width: `${score}%`,
                  backgroundColor: item.color || '#16A34A'
                }}
              />
            </div>

            {/* Status Pill & Trend */}
            <div className="eq-card-status-row">
              <span className={`eq-stage-pill ${getStageBadgeClass(item.stage)}`}>
                {score >= 90 ? <CheckCircle2 size={11} /> : (score >= 65 ? <AlertTriangle size={11} /> : <AlertOctagon size={11} />)}
                <span>{item.label || 'NORMAL'}</span>
              </span>

              <div className="eq-click-hint">
                <span>Inspect</span>
                <ChevronRight size={13} />
              </div>
            </div>

            {/* Primary Monitored Variables Summary */}
            <div className="eq-card-metrics">
              {item.metrics ? (
                Object.values(item.metrics).slice(0, 3).map(m => (
                  <div key={m.key} className="eq-metric-chip">
                    <span className="eq-metric-name">{m.name}:</span>
                    <span className="eq-metric-val">
                      <strong>{m.current}</strong> {m.unit}
                    </span>
                    {getTrendIcon(m.trend)}
                  </div>
                ))
              ) : (
                <div className="eq-metric-chip">
                  <span className="eq-metric-name">{item.primaryVar || 'Operating within baseline'}</span>
                  {getTrendIcon(item.trend)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
