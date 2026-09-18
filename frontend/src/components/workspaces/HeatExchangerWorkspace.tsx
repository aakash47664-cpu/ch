import React, { useState } from 'react';
import {
  ProcessUpdatePayload,
  TimeSeriesPoint,
  ManualControlOverrides
} from '../../types';
import { updateSimulatorControls } from '../../services/api';
import { ProcessContextBar } from './ProcessContextBar';
import { EquipmentContinuousMlPanel } from '../EquipmentContinuousMlPanel';
import {
  Flame,
  Sliders,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Droplet
} from 'lucide-react';

interface HeatExchangerWorkspaceProps {
  state: ProcessUpdatePayload;
  timeSeries: TimeSeriesPoint[];
  onNavigateTab: (tab: 'overview' | 'flowsheet' | 'pump' | 'heat_exchanger' | 'reactor' | 'distillation' | 'ai_diagnosis' | 'alerts') => void;
  onAskAiAbout?: (unitId: string) => void;
}

export const HeatExchangerWorkspace: React.FC<HeatExchangerWorkspaceProps> = ({
  state,
  timeSeries,
  onNavigateTab,
  onAskAiAbout
}) => {
  const eqDiagnostics = state.equipment_diagnostics || state.equipmentDiagnostics || ({} as any);
  const hxDiag = eqDiagnostics.E101 || eqDiagnostics.heat_exchanger;

  const hxData = state.equipment.heat_exchanger.data;
  const pumpFlow = state.equipment.pump.data.flow ?? 10.0;
  const hxHealth = hxDiag?.health ?? (hxData.health ?? 96);
  const hxRisk = hxDiag?.risk ?? Math.max(0, 100 - hxHealth);

  const [localFouling, setLocalFouling] = useState<number>(0);
  const [localDutyMod, setLocalDutyMod] = useState<number>(1.0);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Derived engineering properties
  const tempIn = hxData.inlet_temperature ?? 25.2;
  const tempOut = hxData.outlet_temperature ?? 38.1;
  const deltaT = hxData.temperature_difference ?? (tempOut - tempIn);
  const efficiency = (hxData as any).efficiency ?? hxData.heat_transfer_indicator ?? 95.0;
  const overallU = (hxData as any).overall_u ?? 850.0;
  const foulingFactor = (hxData as any).fouling_factor ?? (localFouling * 0.002);
  const heatDuty = (hxData as any).heat_duty ?? (pumpFlow * 4.184 * deltaT / 60);
  const tubeDeltaP = (hxData as any).delta_p ?? (0.1 + (localFouling * 0.08));

  // Status classification from single source of truth
  const statusLabel = hxDiag?.stageLabel || (hxHealth < 60 ? 'FAULT CONFIRMED' : hxHealth < 80 ? 'EARLY DEGRADATION' : deltaT < 8.0 ? 'EARLY DEVIATION' : 'NOMINAL STEADY');
  const statusClass = hxDiag?.severity === 'CRITICAL' || hxHealth < 60 ? 'critical' : (hxDiag?.severity === 'HIGH' || hxDiag?.severity === 'MEDIUM' ? 'warning' : 'nominal');

  // Baseline comparison
  const baselines = [
    { name: 'Process Stream Inlet (Tin)', current: `${tempIn.toFixed(1)} °C`, baseline: '25.0 °C', dev: `${(((tempIn - 25.0) / 25.0) * 100).toFixed(1)}%`, normal: true },
    { name: 'Process Stream Outlet (Tout)', current: `${tempOut.toFixed(1)} °C`, baseline: '45.0 °C', dev: `${(((tempOut - 45.0) / 45.0) * 100).toFixed(1)}%`, normal: tempOut >= 36.0 },
    { name: 'Thermal Gradient (ΔT)', current: `${deltaT.toFixed(1)} °C`, baseline: '20.0 °C', dev: `${(((deltaT - 20.0) / 20.0) * 100).toFixed(1)}%`, normal: deltaT >= 10.0 },
    { name: 'Overall Heat Transfer Coeff (U)', current: `${overallU.toFixed(0)} W/m²K`, baseline: '850 W/m²K', dev: `${(((overallU - 850) / 850) * 100).toFixed(1)}%`, normal: overallU >= 650 },
    { name: 'Heat Duty Exchanged (Q)', current: `${heatDuty.toFixed(2)} kW`, baseline: '13.95 kW', dev: `${(((heatDuty - 13.95) / 13.95) * 100).toFixed(1)}%`, normal: heatDuty >= 9.0 },
    { name: 'Fouling Factor (Rf)', current: `${(foulingFactor * 1000).toFixed(3)} m²K/kW`, baseline: '0.000 m²K/kW', dev: `${(foulingFactor * 1000).toFixed(1)}`, normal: foulingFactor < 0.001 }
  ];

  const handleSliderChange = async (overrides: ManualControlOverrides) => {
    setIsUpdating(true);
    try {
      await updateSimulatorControls(overrides);
    } catch (e) {
      console.error('Failed to update heat exchanger controls:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetControls = async () => {
    setLocalFouling(0);
    setLocalDutyMod(1.0);
    setIsUpdating(true);
    try {
      await updateSimulatorControls({ fouling_level: 0, heat_exchanger_efficiency: 1.0 });
    } catch (e) {
      console.error('Reset failed:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="equipment-workspace">
      {/* 1. Top Non-Intrusive Process Context Bar */}
      <ProcessContextBar
        activeUnit="E-101"
        onNavigate={onNavigateTab}
        trainFlow={pumpFlow}
      />

      {/* 2. Continuous ML Diagnostic Panel (Single Source of Truth) */}
      <EquipmentContinuousMlPanel
        diagnostic={hxDiag}
        allDiagnostics={eqDiagnostics}
        unitTag="E-101"
        unitName="Shell & Tube Heat Exchanger"
        onSelectUnit={(id) => onNavigateTab(id as any)}
        onNavigateTab={onNavigateTab}
        onAskAiAbout={onAskAiAbout}
      />

      {/* 3. Live Parameters Key Metrics Grid */}
      <div className="workspace-metrics-grid mt-4">
        <div className="metric-card">
          <span className="metric-card-label">Process Inlet Temp (Tin)</span>
          <span className="metric-card-value font-mono">{tempIn.toFixed(1)} <span className="unit">°C</span></span>
          <span className="metric-card-sub">Stream S-101 from P-101</span>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-card-label">Process Outlet Temp (Tout)</span>
            {hxData.source === 'real' || hxData.has_real_sensor || hxData.sensor_status === 'LIVE' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                LIVE
              </span>
            ) : hxData.sensor_status === 'OFFLINE' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium tracking-wide uppercase bg-rose-500/10 text-rose-600 border border-rose-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                OFFLINE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium tracking-wide text-slate-500 bg-slate-100 border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                Waiting for sensor...
              </span>
            )}
          </div>
          <span className="metric-card-value font-mono">{tempOut.toFixed(1)} <span className="unit">°C</span></span>
          <span className="metric-card-sub">
            {hxData.source === 'real' || hxData.has_real_sensor || hxData.sensor_status === 'LIVE'
              ? 'Real Sensor: DS18B20 (ESP32 GPIO 4)'
              : 'Target Setpoint: 45.0 °C'}
          </span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Thermal Gradient (ΔT)</span>
          <span className={`metric-card-value font-mono ${deltaT < 5.0 ? 'text-amber-600 font-bold' : ''}`}>
            {deltaT.toFixed(1)} <span className="unit">°C</span>
          </span>
          <span className="metric-card-sub">Design ΔT: 20.0 °C</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Overall Coeff (U)</span>
          <span className="metric-card-value font-mono">{overallU.toFixed(0)} <span className="unit">W/m²K</span></span>
          <span className="metric-card-sub">Clean Baseline: 850 W/m²K</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Thermal Heat Duty (Q)</span>
          <span className="metric-card-value font-mono">{heatDuty.toFixed(2)} <span className="unit">kW</span></span>
          <span className="metric-card-sub">Design Duty: 13.95 kW</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Fouling Factor (Rf)</span>
          <span className={`metric-card-value font-mono ${foulingFactor > 0.001 ? 'text-amber-600' : ''}`}>
            {(foulingFactor * 1000).toFixed(3)} <span className="unit">m²K/kW</span>
          </span>
          <span className="metric-card-sub">TEMA Max: 0.150 m²K/kW</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Thermal Efficiency</span>
          <span className={`metric-card-value font-mono ${efficiency < 75 ? 'text-amber-600' : 'text-emerald-700'}`}>
            {efficiency.toFixed(1)} <span className="unit">%</span>
          </span>
          <span className="metric-card-sub">Health Score: {hxHealth.toFixed(0)}%</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Tube Pressure Drop</span>
          <span className="metric-card-value font-mono">{tubeDeltaP.toFixed(3)} <span className="unit">bar</span></span>
          <span className="metric-card-sub">Clean Baseline: 0.100 bar</span>
        </div>
      </div>

      {/* 4. Live Trends & Simulation Controls */}
      <div className="workspace-split-layout">
        {/* Left Column: Live Charts + Baseline Table */}
        <div className="workspace-main-panel">
          <div className="panel-header">
            <h3 className="panel-title">E-101 Thermal Response Trends</h3>
            <span className="badge-live-pulse">REAL-TIME TELEMETRY</span>
          </div>

          <div className="chart-wrapper-card">
            <div className="chart-legend-row">
              <span className="legend-item"><span className="legend-dot bg-amber-600"></span> Outlet Temp Tout (°C)</span>
              <span className="legend-item"><span className="legend-dot bg-sky-600"></span> Inlet Temp Tin (°C)</span>
              <span className="legend-item"><span className="legend-dot bg-emerald-600"></span> Gradient ΔT (°C)</span>
            </div>

            <svg viewBox="0 0 500 150" className="w-full h-44 overflow-visible">
              <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="0" y1="75" x2="500" y2="75" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#f1f5f9" strokeDasharray="3 3" />

              {timeSeries.length > 1 && (() => {
                const toutPts = timeSeries.map((pt, i) => {
                  const x = (i / (timeSeries.length - 1)) * 490 + 5;
                  const y = 140 - ((pt.hxOutletTemp || 38) / 60) * 110;
                  return `${x.toFixed(1)},${Math.max(10, Math.min(140, y)).toFixed(1)}`;
                });
                const deltaPts = timeSeries.map((pt, i) => {
                  const x = (i / (timeSeries.length - 1)) * 490 + 5;
                  const y = 140 - ((pt.hxDeltaT || 12.5) / 25) * 110;
                  return `${x.toFixed(1)},${Math.max(10, Math.min(140, y)).toFixed(1)}`;
                });

                return (
                  <>
                    <polyline points={toutPts.join(' ')} fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
                    <polyline points={deltaPts.join(' ')} fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
                  </>
                );
              })()}
            </svg>
          </div>

          {/* Baseline Table */}
          <div className="panel-header mt-4">
            <h3 className="panel-title">Baseline vs. Current Thermal Parameters</h3>
          </div>
          <div className="table-wrapper">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Current Reading</th>
                  <th>Engineering Baseline</th>
                  <th>Deviation (%)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {baselines.map((row, idx) => (
                  <tr key={idx}>
                    <td className="font-semibold text-slate-800">{row.name}</td>
                    <td className="font-mono font-bold text-slate-900">{row.current}</td>
                    <td className="font-mono text-slate-500">{row.baseline}</td>
                    <td className={`font-mono font-semibold ${row.normal ? 'text-slate-600' : 'text-amber-600'}`}>{row.dev}</td>
                    <td>
                      <span className={`status-pill ${row.normal ? 'nominal' : 'warning'}`}>
                        {row.normal ? 'NOMINAL' : 'DEVIATION'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Simulation Controls + Topology */}
        <div className="workspace-side-panel">
          <div className="controls-panel-card">
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-amber-700" />
                <h3 className="panel-title">E-101 Thermal Simulation Controls</h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Induce tube fouling resistance or adjust steam thermal efficiency to observe downstream temperature impacts on R-101.
            </p>

            <div className="control-slider-group">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Tube Fouling Resistance (Rf)</span>
                <span className="font-mono font-bold text-amber-700">{(localFouling * 100).toFixed(0)}% Fouled</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.05"
                value={localFouling}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLocalFouling(val);
                  handleSliderChange({ fouling_level: val });
                }}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>Clean (0%)</span>
                <span>TEMA Limit (30%)</span>
                <span>Severe Fouling (80%)</span>
              </div>
            </div>

            <div className="control-slider-group mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Heat Duty Multiplier</span>
                <span className="font-mono font-bold text-sky-700">{localDutyMod.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.5"
                step="0.05"
                value={localDutyMod}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLocalDutyMod(val);
                  handleSliderChange({ heat_exchanger_efficiency: val });
                }}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0.2x (Steam Loss)</span>
                <span>1.0x (Design)</span>
                <span>1.5x (Boost)</span>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
              <button
                className="btn-secondary-sm"
                onClick={handleResetControls}
              >
                <RotateCcw size={12} /> Reset Nominal
              </button>
              {isUpdating && (
                <span className="text-xs text-sky-700 animate-pulse font-semibold">
                  Updating simulation...
                </span>
              )}
            </div>
          </div>

          {/* Topology Connections */}
          <div className="connectivity-card">
            <h4 className="card-heading-sm">Thermal Stream Topology</h4>
            <div className="topology-items">
              <div className="topology-box" onClick={() => onNavigateTab('pump')}>
                <span className="topo-tag">UPSTREAM (SOURCE)</span>
                <span className="topo-name">P-101 Centrifugal Pump</span>
                <span className="topo-stream">Stream S-101 &bull; {pumpFlow.toFixed(1)} L/min &bull; {tempIn.toFixed(1)}°C</span>
              </div>

              <div className="topology-arrow">&darr;</div>

              <div className="topology-box active">
                <span className="topo-tag active">ACTIVE UNIT</span>
                <span className="topo-name">E-101 Shell &amp; Tube Exchanger</span>
                <span className="topo-stream">Duty: {heatDuty.toFixed(1)} kW &bull; Tout: {tempOut.toFixed(1)}°C</span>
              </div>

              <div className="topology-arrow">&darr;</div>

              <div className="topology-box" onClick={() => onNavigateTab('reactor')}>
                <span className="topo-tag">DOWNSTREAM (SINK)</span>
                <span className="topo-name">R-101 CSTR Reactor</span>
                <span className="topo-stream">Stream S-102 &bull; Pre-heated Feed ({tempOut.toFixed(1)}°C) &rarr;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
