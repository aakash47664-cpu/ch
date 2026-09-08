import React, { useRef, useEffect } from 'react';
import {
  PumpData,
  HeatExchangerData,
  ReactorData,
  DistillationData,
  EquipmentItem,
  TimeSeriesPoint
} from '../types';
import { Activity, Flame, Cpu, Layers, Sparkles } from 'lucide-react';

interface EquipmentCardsGridProps {
  pump: EquipmentItem<PumpData>;
  heatExchanger: EquipmentItem<HeatExchangerData>;
  reactor: EquipmentItem<ReactorData>;
  distillation: EquipmentItem<DistillationData>;
  history?: TimeSeriesPoint[];
  onAskAiAbout?: (equipmentId: string) => void;
}

// Compact SVG Sparkline Generator
const Sparkline: React.FC<{
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}> = ({ data, color = '#2563EB', width = 90, height = 26 }) => {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className="sparkline-svg">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const padding = 3;
  const h = height - padding * 2;
  const w = width - padding * 2;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * w;
    const y = height - padding - ((val - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`;
  const lastPoint = points[points.length - 1].split(',');

  return (
    <svg width={width} height={height} className="sparkline-svg" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="2.5" fill={color} stroke="#FFFFFF" strokeWidth="1" />
    </svg>
  );
};

// Trend Arrow and Delta Calculator Hook/Component
const TrendValue: React.FC<{
  current: number;
  unit?: string;
  decimals?: number;
  highlightCondition?: boolean;
}> = ({ current, unit = '', decimals = 1, highlightCondition = false }) => {
  const prevRef = useRef<number>(current);
  const prev = prevRef.current;

  useEffect(() => {
    prevRef.current = current;
  }, [current]);

  const diff = current - prev;
  const isUp = diff > 0.005;
  const isDown = diff < -0.005;

  return (
    <div className="metric-value-wrap">
      <span
        className="metric-value"
        style={{ color: highlightCondition ? 'var(--sev-critical-text)' : 'inherit' }}
      >
        {decimals === 0 ? Math.round(current) : current.toFixed(decimals)} {unit}
      </span>
      {isUp && (
        <span className="trend-indicator trend-up" title={`+${diff.toFixed(decimals)}`}>
          ↑ <span style={{ fontSize: '0.62rem' }}>+{diff.toFixed(decimals === 0 ? 0 : 1)}</span>
        </span>
      )}
      {isDown && (
        <span className="trend-indicator trend-down" title={`${diff.toFixed(decimals)}`}>
          ↓ <span style={{ fontSize: '0.62rem' }}>{diff.toFixed(decimals === 0 ? 0 : 1)}</span>
        </span>
      )}
      {!isUp && !isDown && (
        <span className="trend-indicator trend-stable">
          →
        </span>
      )}
    </div>
  );
};

export const EquipmentCardsGrid: React.FC<EquipmentCardsGridProps> = ({
  pump,
  heatExchanger,
  reactor,
  distillation,
  history = [],
  onAskAiAbout
}) => {
  const renderSourceBadge = (source: string) => {
    if (source === 'real') {
      return (
        <span className="source-badge real">
          <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--primary-blue)' }}></span>
          REAL DATA
        </span>
      );
    }
    if (source === 'demo') {
      return (
        <span className="source-badge demo">
          <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--sev-medium-text)' }}></span>
          DEMO DATA
        </span>
      );
    }
    return (
      <span className="source-badge simulated">
        <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--ai-cyan)' }}></span>
        SIMULATED
      </span>
    );
  };

  // Evaluate equipment health
  const pumpStatus = (pump.data.vibration || 0) > 0.25 ? 'HIGH' : 'NORMAL';
  const hxStatus = (heatExchanger.data.temperature_difference || 0) < 4.0 ? 'HIGH' : 'NORMAL';
  const reactorStatus =
    reactor.data.cooling_status === 0 || (reactor.data.temperature || 0) > 85 ? 'CRITICAL' : 'NORMAL';
  const distStatus = (distillation.data.reflux_ratio || 0) < 1.1 ? 'MEDIUM' : 'NORMAL';

  const renderStatus = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return (
          <span className="status-dot-text" style={{ color: 'var(--sev-critical-text)' }}>
            <span className="status-indicator-dot pulse" style={{ backgroundColor: 'var(--sev-critical)' }}></span>
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="status-dot-text" style={{ color: 'var(--sev-high-text)' }}>
            <span className="status-indicator-dot pulse" style={{ backgroundColor: 'var(--sev-high)' }}></span>
            HIGH FAULT
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="status-dot-text" style={{ color: 'var(--sev-medium-text)' }}>
            <span className="status-indicator-dot" style={{ backgroundColor: 'var(--sev-medium)' }}></span>
            WARNING
          </span>
        );
      case 'LOW':
        return (
          <span className="status-dot-text" style={{ color: 'var(--sev-low-text)' }}>
            <span className="status-indicator-dot" style={{ backgroundColor: 'var(--sev-low)' }}></span>
            LOW
          </span>
        );
      default:
        return (
          <span className="status-dot-text" style={{ color: 'var(--sev-normal-text)' }}>
            <span className="status-indicator-dot" style={{ backgroundColor: 'var(--sev-normal)' }}></span>
            NORMAL
          </span>
        );
    }
  };

  // Extract sparkline history series
  const recentPoints = history.slice(-15);
  const pumpVibHistory = recentPoints.map((p) => p.pumpVibration ?? 0.08);
  const hxDeltaTHistory = recentPoints.map((p) => p.hxDeltaT ?? 12.5);
  const reactorTempHistory = recentPoints.map((p) => p.reactorTemp ?? 65.0);
  const distRefluxHistory = recentPoints.map((p) => p.distReflux ?? 2.2);

  return (
    <div className="equipment-grid" aria-label="Process Equipment Telemetry">
      {/* 1. PUMP */}
      <div className="equipment-card">
        <div className="equipment-card-header">
          <div className="unit-title-group">
            <div className="unit-icon-badge" title="Rotary Fluid Pump">
              <Activity size={16} />
            </div>
            <div>
              <h3 className="unit-name">PUMP</h3>
              <span className="unit-id">Centrifugal Pump (P-101)</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {renderSourceBadge(pump.source)}
            {onAskAiAbout && (
              <button
                className="card-ask-ai-btn"
                onClick={() => onAskAiAbout('pump')}
                title="Ask AI Copilot about P-101"
              >
                <Sparkles size={11} />
                <span>Ask AI</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Sparkline Widget */}
        <div className="sparkline-container">
          <div className="sparkline-info">
            <span className="sparkline-label">Vibration Live Trend</span>
            <span className="sparkline-val" style={{ color: (pump.data.vibration || 0) > 0.25 ? 'var(--sev-critical-text)' : 'inherit' }}>
              {(pump.data.vibration || 0).toFixed(2)} g
            </span>
          </div>
          <div className="sparkline-svg-wrap">
            <Sparkline
              data={pumpVibHistory}
              color={(pump.data.vibration || 0) > 0.25 ? '#DC2626' : '#2563EB'}
            />
          </div>
        </div>

        <div className="unit-metrics-list">
          <div className="metric-row">
            <span className="metric-label">RPM</span>
            <TrendValue current={pump.data.rpm || 2450} unit="RPM" decimals={0} />
          </div>
          <div className="metric-row">
            <span className="metric-label">Vibration</span>
            <TrendValue
              current={pump.data.vibration || 0.08}
              unit="g"
              decimals={2}
              highlightCondition={(pump.data.vibration || 0) > 0.25}
            />
          </div>
          <div className="metric-row">
            <span className="metric-label">Inlet Temp</span>
            <TrendValue current={pump.data.inlet_temperature || 25.2} unit="°C" decimals={1} />
          </div>
          <div className="metric-row">
            <span className="metric-label">Outlet Temp</span>
            <TrendValue current={pump.data.outlet_temperature || 38.1} unit="°C" decimals={1} />
          </div>
        </div>

        <div className="unit-status-bar">
          <span style={{ color: 'var(--text-muted)' }}>Status</span>
          {renderStatus(pumpStatus)}
        </div>
      </div>

      {/* 2. HEAT EXCHANGER */}
      <div className="equipment-card">
        <div className="equipment-card-header">
          <div className="unit-title-group">
            <div className="unit-icon-badge" style={{ color: '#D97706' }} title="Thermal Heat Transfer">
              <Flame size={16} />
            </div>
            <div>
              <h3 className="unit-name">HEAT EXCHANGER</h3>
              <span className="unit-id">Counter-Flow Unit (E-102)</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {renderSourceBadge(heatExchanger.source)}
            {onAskAiAbout && (
              <button
                className="card-ask-ai-btn"
                onClick={() => onAskAiAbout('heat_exchanger')}
                title="Ask AI Copilot about E-102"
              >
                <Sparkles size={11} />
                <span>Ask AI</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Sparkline Widget */}
        <div className="sparkline-container">
          <div className="sparkline-info">
            <span className="sparkline-label">Thermal Gradient (ΔT)</span>
            <span className="sparkline-val" style={{ color: (heatExchanger.data.temperature_difference || 0) < 4.0 ? 'var(--sev-critical-text)' : 'inherit' }}>
              {(heatExchanger.data.temperature_difference || 0).toFixed(1)} °C
            </span>
          </div>
          <div className="sparkline-svg-wrap">
            <Sparkline
              data={hxDeltaTHistory}
              color={(heatExchanger.data.temperature_difference || 0) < 4.0 ? '#DC2626' : '#0891B2'}
            />
          </div>
        </div>

        <div className="unit-metrics-list">
          <div className="metric-row">
            <span className="metric-label">Inlet Temp</span>
            <TrendValue current={heatExchanger.data.inlet_temperature || 25.2} unit="°C" decimals={1} />
          </div>
          <div className="metric-row">
            <span className="metric-label">Outlet Temp</span>
            <TrendValue current={heatExchanger.data.outlet_temperature || 38.1} unit="°C" decimals={1} />
          </div>
          <div className="metric-row">
            <span className="metric-label">Thermal Diff (ΔT)</span>
            <TrendValue
              current={heatExchanger.data.temperature_difference || 12.9}
              unit="°C"
              decimals={1}
              highlightCondition={(heatExchanger.data.temperature_difference || 0) < 4.0}
            />
          </div>
          <div className="metric-row">
            <span className="metric-label">Efficiency Indicator</span>
            <TrendValue current={heatExchanger.data.heat_transfer_indicator || 95.0} unit="%" decimals={1} />
          </div>
        </div>

        <div className="unit-status-bar">
          <span style={{ color: 'var(--text-muted)' }}>Status</span>
          {renderStatus(hxStatus)}
        </div>
      </div>

      {/* 3. REACTOR */}
      <div className="equipment-card">
        <div className="equipment-card-header">
          <div className="unit-title-group">
            <div className="unit-icon-badge" style={{ color: '#7C3AED' }} title="Continuous Stirred-Tank Reactor">
              <Cpu size={16} />
            </div>
            <div>
              <h3 className="unit-name">REACTOR</h3>
              <span className="unit-id">Continuous CSTR (R-201)</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {renderSourceBadge(reactor.source)}
            {onAskAiAbout && (
              <button
                className="card-ask-ai-btn"
                onClick={() => onAskAiAbout('reactor')}
                title="Ask AI Copilot about R-201"
              >
                <Sparkles size={11} />
                <span>Ask AI</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Sparkline Widget */}
        <div className="sparkline-container">
          <div className="sparkline-info">
            <span className="sparkline-label">Reactor Core Temp</span>
            <span className="sparkline-val" style={{ color: (reactor.data.temperature || 0) > 85 ? 'var(--sev-critical-text)' : 'inherit' }}>
              {(reactor.data.temperature || 0).toFixed(1)} °C
            </span>
          </div>
          <div className="sparkline-svg-wrap">
            <Sparkline
              data={reactorTempHistory}
              color={(reactor.data.temperature || 0) > 85 ? '#DC2626' : '#7C3AED'}
            />
          </div>
        </div>

        <div className="unit-metrics-list">
          <div className="metric-row">
            <span className="metric-label">Temperature</span>
            <TrendValue
              current={reactor.data.temperature || 65.0}
              unit="°C"
              decimals={1}
              highlightCondition={(reactor.data.temperature || 0) > 85}
            />
          </div>
          <div className="metric-row">
            <span className="metric-label">Pressure</span>
            <TrendValue
              current={reactor.data.pressure || 2.05}
              unit="bar"
              decimals={2}
              highlightCondition={(reactor.data.pressure || 0) > 3.0}
            />
          </div>
          <div className="metric-row">
            <span className="metric-label">Vessel Level</span>
            <TrendValue current={reactor.data.level || 50.0} unit="%" decimals={1} />
          </div>
          <div className="metric-row">
            <span className="metric-label">Cooling Jacket</span>
            <span
              className="metric-value"
              style={{ color: reactor.data.cooling_status === 1 ? 'var(--sev-normal-text)' : 'var(--sev-critical-text)' }}
            >
              {reactor.data.cooling_status === 1 ? 'ACTIVE (1)' : 'TRIPPED (0)'}
            </span>
          </div>
        </div>

        <div className="unit-status-bar">
          <span style={{ color: 'var(--text-muted)' }}>Status</span>
          {renderStatus(reactorStatus)}
        </div>
      </div>

      {/* 4. DISTILLATION COLUMN */}
      <div className="equipment-card">
        <div className="equipment-card-header">
          <div className="unit-title-group">
            <div className="unit-icon-badge" style={{ color: '#0891B2' }} title="Fractionating Column">
              <Layers size={16} />
            </div>
            <div>
              <h3 className="unit-name">DISTILLATION COLUMN</h3>
              <span className="unit-id">Fractionating Unit (T-301)</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {renderSourceBadge(distillation.source)}
            {onAskAiAbout && (
              <button
                className="card-ask-ai-btn"
                onClick={() => onAskAiAbout('distillation')}
                title="Ask AI Copilot about T-301"
              >
                <Sparkles size={11} />
                <span>Ask AI</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Sparkline Widget */}
        <div className="sparkline-container">
          <div className="sparkline-info">
            <span className="sparkline-label">Reflux Ratio (L/D)</span>
            <span className="sparkline-val" style={{ color: (distillation.data.reflux_ratio || 0) < 1.1 ? 'var(--sev-medium-text)' : 'inherit' }}>
              {(distillation.data.reflux_ratio || 0).toFixed(2)}
            </span>
          </div>
          <div className="sparkline-svg-wrap">
            <Sparkline
              data={distRefluxHistory}
              color={(distillation.data.reflux_ratio || 0) < 1.1 ? '#D97706' : '#2563EB'}
            />
          </div>
        </div>

        <div className="unit-metrics-list">
          <div className="metric-row">
            <span className="metric-label">Top Vapor Temp</span>
            <TrendValue
              current={distillation.data.top_temperature || 64.2}
              unit="°C"
              decimals={1}
              highlightCondition={(distillation.data.top_temperature || 0) > 78}
            />
          </div>
          <div className="metric-row">
            <span className="metric-label">Bottom Reboiler</span>
            <TrendValue current={distillation.data.bottom_temperature || 98.4} unit="°C" decimals={1} />
          </div>
          <div className="metric-row">
            <span className="metric-label">Column Pressure</span>
            <TrendValue current={distillation.data.pressure || 1.82} unit="bar" decimals={2} />
          </div>
          <div className="metric-row">
            <span className="metric-label">Reflux Ratio</span>
            <TrendValue
              current={distillation.data.reflux_ratio || 2.2}
              decimals={2}
              highlightCondition={(distillation.data.reflux_ratio || 0) < 1.1}
            />
          </div>
        </div>

        <div className="unit-status-bar">
          <span style={{ color: 'var(--text-muted)' }}>Status</span>
          {renderStatus(distStatus)}
        </div>
      </div>
    </div>
  );
};

export default EquipmentCardsGrid;
