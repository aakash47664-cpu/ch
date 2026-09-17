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
  Layers,
  Sliders,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Droplet
} from 'lucide-react';

interface DistillationWorkspaceProps {
  state: ProcessUpdatePayload;
  timeSeries: TimeSeriesPoint[];
  onNavigateTab: (tab: 'overview' | 'flowsheet' | 'pump' | 'heat_exchanger' | 'reactor' | 'distillation' | 'ai_diagnosis' | 'alerts') => void;
  onAskAiAbout?: (unitId: string) => void;
}

export const DistillationWorkspace: React.FC<DistillationWorkspaceProps> = ({
  state,
  timeSeries,
  onNavigateTab,
  onAskAiAbout
}) => {
  const eqDiagnostics = state.equipment_diagnostics || state.equipmentDiagnostics || ({} as any);
  const distDiag = eqDiagnostics.D101 || eqDiagnostics.distillation;

  const distData = state.equipment.distillation.data;
  const pumpFlow = state.equipment.pump.data.flow ?? 10.0;
  const distHealth = distDiag?.health ?? (distData.health ?? ((distData.reflux_ratio || 0) < 1.15 ? 65 : 98));
  const distRisk = distDiag?.risk ?? Math.max(0, 100 - distHealth);

  const [localReflux, setLocalReflux] = useState<number>(distData.reflux_ratio || 1.85);
  const [localReboilerMod, setLocalReboilerMod] = useState<number>(1.0);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Derived fractionation properties
  const topTemp = distData.top_temperature ?? 76.5;
  const bottomTemp = distData.bottom_temperature ?? 98.4;
  const pressure = distData.pressure ?? 2.10;
  const columnP = (distData as any).column_pressure ?? 1.05;
  const refluxRatio = distData.reflux_ratio ?? 1.85;
  const purity = (distData as any).separation_purity ?? (refluxRatio >= 1.5 ? 0.985 : 0.88);
  const distillateFlow = pumpFlow * 0.45;
  const bottomsFlow = pumpFlow * 0.53;
  const reboilerDuty = (distData as any).reboiler_duty ?? 18.5;
  const condenserDuty = (distData as any).condenser_duty ?? 16.2;
  const isRefluxLoss = refluxRatio < 1.40;

  // Status classification from single source of truth
  const statusLabel = distDiag?.stageLabel || (distHealth < 60 ? 'FAULT CONFIRMED' : distHealth < 80 ? 'REFLUX DEGRADATION' : refluxRatio < 1.50 ? 'EARLY DEVIATION' : 'NOMINAL STEADY');
  const statusClass = distDiag?.severity === 'CRITICAL' || distHealth < 60 ? 'critical' : (distDiag?.severity === 'HIGH' || distDiag?.severity === 'MEDIUM' ? 'warning' : 'nominal');

  // Baseline comparison
  const baselines = [
    { name: 'Overhead Distillate Purity (xD)', current: `${(purity * 100).toFixed(2)}%`, baseline: '98.50%', dev: `${(((purity - 0.985) / 0.985) * 100).toFixed(1)}%`, normal: purity >= 0.96 },
    { name: 'Internal Reflux Ratio (L/D)', current: refluxRatio.toFixed(2), baseline: '1.85', dev: `${(((refluxRatio - 1.85) / 1.85) * 100).toFixed(1)}%`, normal: refluxRatio >= 1.40 },
    { name: 'Top Column Vapor Temp', current: `${topTemp.toFixed(1)} °C`, baseline: '76.5 °C', dev: `${(((topTemp - 76.5) / 76.5) * 100).toFixed(1)}%`, normal: topTemp <= 80.0 },
    { name: 'Bottom Reboiler Sump Temp', current: `${bottomTemp.toFixed(1)} °C`, baseline: '98.4 °C', dev: `${(((bottomTemp - 98.4) / 98.4) * 100).toFixed(1)}%`, normal: true },
    { name: 'Column Operating Pressure', current: `${pressure.toFixed(2)} bar`, baseline: '2.10 bar', dev: `${(((pressure - 2.10) / 2.10) * 100).toFixed(1)}%`, normal: true },
    { name: 'Distillate Product Flow (S-104)', current: `${distillateFlow.toFixed(2)} L/min`, baseline: '4.50 L/min', dev: `${(((distillateFlow - 4.5) / 4.5) * 100).toFixed(1)}%`, normal: distillateFlow >= 3.8 }
  ];

  const handleSliderChange = async (overrides: ManualControlOverrides) => {
    setIsUpdating(true);
    try {
      await updateSimulatorControls(overrides);
    } catch (e) {
      console.error('Failed to update distillation controls:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetControls = async () => {
    setLocalReflux(1.85);
    setLocalReboilerMod(1.0);
    setIsUpdating(true);
    try {
      await updateSimulatorControls({ reflux_ratio: 1.85, reboiler_duty_mod: 1.0 });
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
        activeUnit="D-101"
        onNavigate={onNavigateTab}
        trainFlow={pumpFlow}
      />

      {/* 2. Continuous ML Diagnostic Panel (Single Source of Truth) */}
      <EquipmentContinuousMlPanel
        diagnostic={distDiag}
        allDiagnostics={eqDiagnostics}
        unitTag="D-101"
        unitName="Binary Distillation Column"
        onSelectUnit={(id) => onNavigateTab(id as any)}
        onNavigateTab={onNavigateTab}
        onAskAiAbout={onAskAiAbout}
      />

      {/* 3. Live Parameters Key Metrics Grid */}
      <div className="workspace-metrics-grid mt-4">
        <div className="metric-card">
          <span className="metric-card-label">Distillate Purity (xD)</span>
          <span className={`metric-card-value font-mono ${purity < 0.95 ? 'text-amber-600 font-bold' : 'text-emerald-700 font-bold'}`}>
            {(purity * 100).toFixed(2)} <span className="unit">%</span>
          </span>
          <span className="metric-card-sub">Product Spec: &gt; 98.0%</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Reflux Ratio (L/D)</span>
          <span className={`metric-card-value font-mono ${isRefluxLoss ? 'text-amber-600 font-bold' : ''}`}>
            {refluxRatio.toFixed(2)}
          </span>
          <span className="metric-card-sub">Optimal Setpoint: 1.85</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Top Overhead Temp</span>
          <span className="metric-card-value font-mono">{topTemp.toFixed(1)} <span className="unit">°C</span></span>
          <span className="metric-card-sub">Vapor Dew Point: 76.5 °C</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Bottom Reboiler Temp</span>
          <span className="metric-card-value font-mono">{bottomTemp.toFixed(1)} <span className="unit">°C</span></span>
          <span className="metric-card-sub">Heavy Sump Boiling Point</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Distillate Flow (Top)</span>
          <span className="metric-card-value font-mono">{distillateFlow.toFixed(2)} <span className="unit">L/min</span></span>
          <span className="metric-card-sub">Stream S-104 &rarr; Tank T-104</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Bottoms Residue Flow</span>
          <span className="metric-card-value font-mono">{bottomsFlow.toFixed(2)} <span className="unit">L/min</span></span>
          <span className="metric-card-sub">Stream S-105 &rarr; Tank T-105</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Column Pressure</span>
          <span className="metric-card-value font-mono">{pressure.toFixed(2)} <span className="unit">bar</span></span>
          <span className="metric-card-sub">Atmosphere Overhead</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Column Health Score</span>
          <span className={`metric-card-value font-mono ${distHealth < 75 ? 'text-amber-600' : 'text-emerald-700'}`}>
            {distHealth.toFixed(0)} <span className="unit">%</span>
          </span>
          <span className="metric-card-sub">Separation Risk: {distRisk.toFixed(0)}%</span>
        </div>
      </div>

      {/* 4. Live Trends & Simulation Controls */}
      <div className="workspace-split-layout">
        {/* Left Column: Live Charts + Baseline Table */}
        <div className="workspace-main-panel">
          <div className="panel-header">
            <h3 className="panel-title">D-101 Fractionation Dynamics</h3>
            <span className="badge-live-pulse">REAL-TIME TELEMETRY</span>
          </div>

          <div className="chart-wrapper-card">
            <div className="chart-legend-row">
              <span className="legend-item"><span className="legend-dot bg-cyan-600"></span> Top Temp (°C)</span>
              <span className="legend-item"><span className="legend-dot bg-amber-600"></span> Bottom Temp (°C)</span>
              <span className="legend-item"><span className="legend-dot bg-emerald-600"></span> Reflux Ratio &times; 10</span>
            </div>

            <svg viewBox="0 0 500 150" className="w-full h-44 overflow-visible">
              <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="0" y1="75" x2="500" y2="75" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#f1f5f9" strokeDasharray="3 3" />

              {timeSeries.length > 1 && (() => {
                const topPts = timeSeries.map((pt, i) => {
                  const x = (i / (timeSeries.length - 1)) * 490 + 5;
                  const y = 140 - ((pt.distTopTemp || 76.5) / 110) * 110;
                  return `${x.toFixed(1)},${Math.max(10, Math.min(140, y)).toFixed(1)}`;
                });
                const refluxPts = timeSeries.map((pt, i) => {
                  const x = (i / (timeSeries.length - 1)) * 490 + 5;
                  const y = 140 - (((pt.distReflux || 1.85) * 10) / 30) * 110;
                  return `${x.toFixed(1)},${Math.max(10, Math.min(140, y)).toFixed(1)}`;
                });

                return (
                  <>
                    <polyline points={topPts.join(' ')} fill="none" stroke="#0891b2" strokeWidth="2.5" strokeLinecap="round" />
                    <polyline points={refluxPts.join(' ')} fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
                  </>
                );
              })()}
            </svg>
          </div>

          {/* Baseline Table */}
          <div className="panel-header mt-4">
            <h3 className="panel-title">Baseline vs. Current Separation Parameters</h3>
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
                <Sliders size={16} className="text-cyan-700" />
                <h3 className="panel-title">D-101 Reflux &amp; Boilup Controls</h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Throttle reflux return ratio to simulate loss of reflux pump or modify reboiler thermal boilup rate.
            </p>

            <div className="control-slider-group">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Internal Reflux Ratio (L/D)</span>
                <span className="font-mono font-bold text-sky-700">{localReflux.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.05"
                value={localReflux}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLocalReflux(val);
                  handleSliderChange({ reflux_ratio: val });
                }}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0.1 (Reflux Loss)</span>
                <span>1.85 (Design)</span>
                <span>3.0 (High Reflux)</span>
              </div>
            </div>

            <div className="control-slider-group mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Reboiler Duty Modifier</span>
                <span className="font-mono font-bold text-amber-700">{localReboilerMod.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="2.0"
                step="0.05"
                value={localReboilerMod}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLocalReboilerMod(val);
                  handleSliderChange({ reboiler_duty_mod: val });
                }}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0.3x (Low Boilup)</span>
                <span>1.0x (Design)</span>
                <span>2.0x (Max Boilup)</span>
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
            <h4 className="card-heading-sm">Separation Train Topology</h4>
            <div className="topology-items">
              <div className="topology-box" onClick={() => onNavigateTab('reactor')}>
                <span className="topo-tag">UPSTREAM (SOURCE)</span>
                <span className="topo-name">R-101 CSTR Reactor</span>
                <span className="topo-stream">Stream S-103 &bull; Reactor Effluent &bull; {pumpFlow.toFixed(1)} L/m</span>
              </div>

              <div className="topology-arrow">&darr;</div>

              <div className="topology-box active">
                <span className="topo-tag active">ACTIVE UNIT</span>
                <span className="topo-name">D-101 Binary Distillation</span>
                <span className="topo-stream">Purity: {(purity * 100).toFixed(1)}% &bull; Reflux: {refluxRatio.toFixed(2)}</span>
              </div>

              <div className="topology-arrow">&darr;</div>

              <div className="topology-box" onClick={() => onNavigateTab('flowsheet')}>
                <span className="topo-tag">DOWNSTREAM (PRODUCTS)</span>
                <span className="topo-name">T-104 Top Product &amp; T-105 Residue</span>
                <span className="topo-stream">S-104: {distillateFlow.toFixed(1)} L/m &bull; S-105: {bottomsFlow.toFixed(1)} L/m &rarr;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
