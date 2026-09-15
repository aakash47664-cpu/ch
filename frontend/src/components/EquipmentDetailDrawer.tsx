import React from 'react';
import { EquipmentHealthItem, TimeSeriesPoint } from '../types';
import { X, Sparkles, Activity, Flame, Atom, Layers, CheckCircle2, AlertTriangle, AlertOctagon, TrendingUp, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface EquipmentDetailDrawerProps {
  equipmentId: string | null;
  equipmentHealthItem?: EquipmentHealthItem;
  history?: TimeSeriesPoint[];
  onClose: () => void;
  onAskAi?: (equipmentName: string) => void;
}

export const EquipmentDetailDrawer: React.FC<EquipmentDetailDrawerProps> = ({
  equipmentId,
  equipmentHealthItem,
  history = [],
  onClose,
  onAskAi
}) => {
  if (!equipmentId || !equipmentHealthItem) return null;

  const item = equipmentHealthItem;
  const score = item.health ?? 100;

  const getEquipmentIcon = (id: string) => {
    switch (id) {
      case 'pump': return <Activity size={18} />;
      case 'heat_exchanger': return <Flame size={18} />;
      case 'reactor': return <Atom size={18} />;
      case 'distillation': return <Layers size={18} />;
      default: return <Activity size={18} />;
    }
  };

  const getTrendArrow = (trend?: string) => {
    if (trend === 'increasing') return <span className="trend-arrow-up">↑ Rising</span>;
    if (trend === 'decreasing') return <span className="trend-arrow-down">↓ Dropping</span>;
    return <span className="trend-arrow-stable">→ Stable</span>;
  };

  // Determine chart key based on equipment
  const getChartConfig = () => {
    switch (equipmentId) {
      case 'pump':
        return {
          key1: 'pumpVibration',
          label1: 'Vibration (g)',
          color1: '#EA580C',
          key2: 'pumpFlow',
          label2: 'Flow (L/min)',
          color2: '#2563EB'
        };
      case 'heat_exchanger':
        return {
          key1: 'hxDeltaT',
          label1: 'Gradient ΔT (°C)',
          color1: '#0891B2',
          key2: 'hxOutletTemp',
          label2: 'Outlet Temp (°C)',
          color2: '#EA580C'
        };
      case 'reactor':
        return {
          key1: 'reactorTemp',
          label1: 'Core Temp (°C)',
          color1: '#DC2626',
          key2: 'reactorPressure',
          label2: 'Vessel Pressure (bar)',
          color2: '#7C3AED'
        };
      case 'distillation':
        return {
          key1: 'distTopTemp',
          label1: 'Top Vapor Temp (°C)',
          color1: '#EA580C',
          key2: 'distReflux',
          label2: 'Reflux Ratio',
          color2: '#2563EB'
        };
      default:
        return {
          key1: 'pumpVibration',
          label1: 'Vibration',
          color1: '#EA580C',
          key2: 'pumpFlow',
          label2: 'Flow',
          color2: '#2563EB'
        };
    }
  };

  const chartCfg = getChartConfig();

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* DRAWER HEADER */}
        <div className="drawer-header">
          <div className="drawer-header-left">
            <div className="drawer-eq-icon">{getEquipmentIcon(equipmentId)}</div>
            <div>
              <div className="drawer-title-row">
                <span className="drawer-tag">{item.equipment}</span>
                <span className="drawer-name">{item.name}</span>
                <span className={`eq-stage-pill ${item.stage.toLowerCase()}`}>
                  {item.label}
                </span>
              </div>
              <div className="drawer-subtitle">
                Continuous high-frequency variable telemetry & rate-of-change degradation monitoring
              </div>
            </div>
          </div>

          <div className="drawer-header-right">
            <div className="drawer-health-score" style={{ color: item.color }}>
              <span className="drawer-health-val">{score}%</span>
              <span className="drawer-health-lbl">HEALTH SCORE</span>
            </div>

            <button className="drawer-close-btn" onClick={onClose} title="Close inspection panel">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* DRAWER BODY */}
        <div className="drawer-body custom-scrollbar">
          {/* 1. VARIABLE TELEMETRY & BASELINE COMPARISON TABLE */}
          <div className="drawer-section">
            <div className="drawer-sec-header">
              <span className="drawer-sec-title">MONITORED PROCESS VARIABLES & BASELINE COMPARISON</span>
              <span className="drawer-sec-tag">1-Second Tick Sync</span>
            </div>

            {item.metrics ? (
              <table className="drawer-table">
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th>Live Reading</th>
                    <th>Nominal Baseline</th>
                    <th>Deviation (%)</th>
                    <th>Rate / min</th>
                    <th>Trend Direction</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(item.metrics).map((m) => {
                    const isUp = m.deltaPercent > 0;
                    return (
                      <tr key={m.key} className={m.isDeviated ? 'dev-row' : ''}>
                        <td className="m-name">{m.name}</td>
                        <td className="m-val">
                          <strong>{m.current}</strong> {m.unit}
                        </td>
                        <td className="m-base">
                          {m.baseline} {m.unit}
                        </td>
                        <td className="m-dev">
                          <span className={`dev-badge ${isUp ? 'dev-up' : 'dev-down'}`}>
                            {isUp ? '↑ +' : '↓ '}{m.deltaPercent}%
                          </span>
                        </td>
                        <td className="m-roc">
                          {m.rateOfChangePerMin > 0 ? `+${m.rateOfChangePerMin}` : m.rateOfChangePerMin} {m.unit}/min
                        </td>
                        <td className="m-trend">{getTrendArrow(m.trend)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-4 text-center text-muted text-sm">Telemetry metrics updating...</div>
            )}
          </div>

          {/* 2. LIVE TREND CHART */}
          <div className="drawer-section">
            <div className="drawer-sec-header">
              <span className="drawer-sec-title">LIVE TIME-SERIES DEGRADATION TREND</span>
              <span className="drawer-sec-tag">Recent 30 Samples</span>
            </div>

            <div className="drawer-chart-wrap" style={{ height: 200, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: 6, fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey={chartCfg.key1}
                    name={chartCfg.label1}
                    stroke={chartCfg.color1}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey={chartCfg.key2}
                    name={chartCfg.label2}
                    stroke={chartCfg.color2}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. AI DIAGNOSIS INTEGRATION TRIGGER */}
          <div className="drawer-ai-card">
            <div className="drawer-ai-info">
              <div className="drawer-ai-title">
                <Sparkles size={16} color="var(--primary-blue)" />
                <span>Need In-Depth Root Cause & Chemical Engineering Reasoning?</span>
              </div>
              <p className="drawer-ai-desc">
                ChemDiag AI can explain governing kinetics, Aspen HYSYS hydraulic analogies, and generate preventive operating steps for {item.equipment}.
              </p>
            </div>

            <button
              className="drawer-ask-ai-btn"
              onClick={() => {
                onClose();
                onAskAi?.(item.equipment);
              }}
            >
              <Sparkles size={14} />
              <span>Ask AI About {item.equipment}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
