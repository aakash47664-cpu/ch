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
  Cpu,
  Sliders,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Droplet
} from 'lucide-react';

interface ReactorWorkspaceProps {
  state: ProcessUpdatePayload;
  timeSeries: TimeSeriesPoint[];
  onNavigateTab: (tab: 'overview' | 'flowsheet' | 'pump' | 'heat_exchanger' | 'reactor' | 'distillation' | 'ai_diagnosis' | 'alerts') => void;
  onAskAiAbout?: (unitId: string) => void;
}

export const ReactorWorkspace: React.FC<ReactorWorkspaceProps> = ({
  state,
  timeSeries,
  onNavigateTab,
  onAskAiAbout
}) => {
  const eqDiagnostics = state.equipment_diagnostics || state.equipmentDiagnostics || ({} as any);
  const rxDiag = eqDiagnostics.R101 || eqDiagnostics.reactor;

  const reactorData = state.equipment.reactor.data;
  const pumpFlow = state.equipment.pump.data.flow ?? 10.0;
  const isTrip = reactorData.cooling_status === 0;
  const reactorHealth = rxDiag?.health ?? (reactorData.health ?? (isTrip || (reactorData.temperature || 0) > 85 ? 42 : 98));
  const reactorRisk = rxDiag?.risk ?? Math.max(0, 100 - reactorHealth);

  const [localCoolingFlow, setLocalCoolingFlow] = useState<number>((reactorData as any).cooling_flow ?? 15.0);
  const [localAgitatorSpeed, setLocalAgitatorSpeed] = useState<number>(reactorData.agitator_speed || 350);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Derived kinetics and thermodynamics properties
  const temp = reactorData.temperature ?? 65.0;
  const pressure = reactorData.pressure ?? 2.05;
  const level = reactorData.level ?? 50.0;
  const agitatorRpm = reactorData.agitator_speed ?? 350;
  const conversion = (reactorData as any).conversion ?? (0.782 + ((temp - 65) * 0.003));
  const residenceTime = (reactorData as any).residence_time ?? (pumpFlow > 0.1 ? (500.0 * (level / 100.0)) / pumpFlow : 999.0);
  const heatRemoval = (reactorData as any).heat_removal ?? (localCoolingFlow * 4.184 * 0.2);
  const heatGen = (reactorData as any).heat_generation ?? (pumpFlow * conversion * 2.5);

  // Status classification from single source of truth
  const statusLabel = rxDiag?.stageLabel || (reactorHealth < 50 ? 'FAULT CONFIRMED' : isTrip || temp > 85 ? 'EXOTHERM SURGE' : temp > 75 ? 'EARLY DEVIATION' : 'NOMINAL STEADY');
  const statusClass = rxDiag?.severity === 'CRITICAL' || reactorHealth < 50 ? 'critical' : (rxDiag?.severity === 'HIGH' || rxDiag?.severity === 'MEDIUM' ? 'warning' : 'nominal');

  // Baseline comparison
  const baselines = [
    { name: 'Core Reaction Temperature', current: `${temp.toFixed(1)} °C`, baseline: '65.0 °C', dev: `${(((temp - 65.0) / 65.0) * 100).toFixed(1)}%`, normal: temp <= 75.0 },
    { name: 'Internal Vessel Pressure', current: `${pressure.toFixed(2)} bar`, baseline: '2.05 bar', dev: `${(((pressure - 2.05) / 2.05) * 100).toFixed(1)}%`, normal: pressure <= 2.80 },
    { name: 'Chemical Conversion (X_A)', current: `${(conversion * 100).toFixed(1)}%`, baseline: '78.2%', dev: `${((conversion - 0.782) * 100).toFixed(1)}%`, normal: true },
    { name: 'Mean Residence Time (tau)', current: `${residenceTime.toFixed(1)} min`, baseline: '25.0 min', dev: `${(((residenceTime - 25.0) / 25.0) * 100).toFixed(1)}%`, normal: pumpFlow > 2.0 },
    { name: 'Cooling Jacket Flow', current: `${localCoolingFlow.toFixed(1)} L/min`, baseline: '15.0 L/min', dev: `${(((localCoolingFlow - 15.0) / 15.0) * 100).toFixed(1)}%`, normal: localCoolingFlow >= 10.0 },
    { name: 'Agitator Shaft Speed', current: `${Math.round(agitatorRpm)} RPM`, baseline: '350 RPM', dev: `${(((agitatorRpm - 350) / 350) * 100).toFixed(1)}%`, normal: agitatorRpm >= 200 }
  ];

  const handleSliderChange = async (overrides: ManualControlOverrides) => {
    setIsUpdating(true);
    try {
      await updateSimulatorControls(overrides);
    } catch (e) {
      console.error('Failed to update reactor controls:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetControls = async () => {
    setLocalCoolingFlow(15.0);
    setLocalAgitatorSpeed(350);
    setIsUpdating(true);
    try {
      await updateSimulatorControls({ reactor_cooling_flow: 15.0, agitator_speed_rpm: 350 });
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
        activeUnit="R-101"
        onNavigate={onNavigateTab}
        trainFlow={pumpFlow}
      />

      {/* 2. Continuous ML Diagnostic Panel (Single Source of Truth) */}
      <EquipmentContinuousMlPanel
        diagnostic={rxDiag}
        allDiagnostics={eqDiagnostics}
        unitTag="R-101"
        unitName="Continuous Stirred-Tank Reactor (CSTR)"
        onSelectUnit={(id) => onNavigateTab(id as any)}
        onNavigateTab={onNavigateTab}
        onAskAiAbout={onAskAiAbout}
      />

      {/* 3. Live Parameters Key Metrics Grid */}
      <div className="workspace-metrics-grid mt-4">
        <div className="metric-card">
          <span className="metric-card-label">Reaction Core Temp</span>
          <span className={`metric-card-value font-mono ${temp > 80 ? 'text-red-600 font-bold' : ''}`}>
            {temp.toFixed(1)} <span className="unit">°C</span>
          </span>
          <span className="metric-card-sub">Safety Limit: 85.0 °C</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Internal Vessel Pressure</span>
          <span className={`metric-card-value font-mono ${pressure > 2.8 ? 'text-red-600 font-bold' : ''}`}>
            {pressure.toFixed(2)} <span className="unit">bar</span>
          </span>
          <span className="metric-card-sub">Relief Setpoint: 3.50 bar</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Chemical Conversion (XA)</span>
          <span className="metric-card-value font-mono">{(conversion * 100).toFixed(1)} <span className="unit">%</span></span>
          <span className="metric-card-sub">Design Conversion: 78.2%</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Liquid Holdup Level</span>
          <span className="metric-card-value font-mono">{level.toFixed(1)} <span className="unit">%</span></span>
          <span className="metric-card-sub">Volume: {(500 * level / 100).toFixed(0)} L</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Agitator Speed</span>
          <span className="metric-card-value font-mono">{Math.round(agitatorRpm)} <span className="unit">RPM</span></span>
          <span className="metric-card-sub">Turbulent Mixing (Re &gt; 10,000)</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Cooling Jacket Flow</span>
          <span className={`metric-card-value font-mono ${localCoolingFlow < 5 ? 'text-red-600 font-bold' : ''}`}>
            {localCoolingFlow.toFixed(1)} <span className="unit">L/min</span>
          </span>
          <span className="metric-card-sub">CW In: 20°C &bull; Out: 35°C</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Reactor Health Score</span>
          <span className={`metric-card-value font-mono ${reactorHealth < 75 ? 'text-amber-600' : 'text-emerald-700'}`}>
            {reactorHealth.toFixed(0)} <span className="unit">%</span>
          </span>
          <span className="metric-card-sub">Thermal Risk: {reactorRisk.toFixed(0)}%</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Residence Time (tau)</span>
          <span className="metric-card-value font-mono">{residenceTime.toFixed(1)} <span className="unit">min</span></span>
          <span className="metric-card-sub">Feed Flow: {pumpFlow.toFixed(1)} L/m</span>
        </div>
      </div>

      {/* 4. Live Trends & Simulation Controls */}
      <div className="workspace-split-layout">
        {/* Left Column: Live Charts + Baseline Table */}
        <div className="workspace-main-panel">
          <div className="panel-header">
            <h3 className="panel-title">R-101 Core Kinetics &amp; Exotherm Trends</h3>
            <span className="badge-live-pulse">REAL-TIME TELEMETRY</span>
          </div>

          <div className="chart-wrapper-card">
            <div className="chart-legend-row">
              <span className="legend-item"><span className="legend-dot bg-purple-600"></span> Core Temp (°C)</span>
              <span className="legend-item"><span className="legend-dot bg-rose-600"></span> Vessel Pressure (bar &times; 20)</span>
              <span className="legend-item"><span className="legend-dot bg-emerald-600"></span> Conversion %</span>
            </div>

            <svg viewBox="0 0 500 150" className="w-full h-44 overflow-visible">
              <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="0" y1="75" x2="500" y2="75" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#f1f5f9" strokeDasharray="3 3" />

              {timeSeries.length > 1 && (() => {
                const tempPts = timeSeries.map((pt, i) => {
                  const x = (i / (timeSeries.length - 1)) * 490 + 5;
                  const y = 140 - ((pt.reactorTemp || 65) / 100) * 110;
                  return `${x.toFixed(1)},${Math.max(10, Math.min(140, y)).toFixed(1)}`;
                });
                const pressPts = timeSeries.map((pt, i) => {
                  const x = (i / (timeSeries.length - 1)) * 490 + 5;
                  const y = 140 - (((pt.reactorPressure || 2.05) * 20) / 100) * 110;
                  return `${x.toFixed(1)},${Math.max(10, Math.min(140, y)).toFixed(1)}`;
                });

                return (
                  <>
                    <polyline points={tempPts.join(' ')} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" />
                    <polyline points={pressPts.join(' ')} fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" />
                  </>
                );
              })()}
            </svg>
          </div>

          {/* Baseline Table */}
          <div className="panel-header mt-4">
            <h3 className="panel-title">Baseline vs. Current Reaction Parameters</h3>
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
                <Sliders size={16} className="text-purple-700" />
                <h3 className="panel-title">R-101 Kinetics Simulation Controls</h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Throttle jacket cooling water flow to simulate runaway thermal exotherms or alter agitator RPM.
            </p>

            <div className="control-slider-group">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Cooling Water Jacket Flow</span>
                <span className="font-mono font-bold text-sky-700">{localCoolingFlow.toFixed(1)} L/min</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={localCoolingFlow}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLocalCoolingFlow(val);
                  handleSliderChange({ reactor_cooling_flow: val });
                }}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0 L/min (Trip Exotherm)</span>
                <span>15 L/min (Design)</span>
                <span>30 L/min (Boost)</span>
              </div>
            </div>

            <div className="control-slider-group mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Agitator Speed</span>
                <span className="font-mono font-bold text-emerald-700">{localAgitatorSpeed} RPM</span>
              </div>
              <input
                type="range"
                min="0"
                max="600"
                step="25"
                value={localAgitatorSpeed}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLocalAgitatorSpeed(val);
                  handleSliderChange({ agitator_speed_rpm: val });
                }}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0 RPM (Stalled)</span>
                <span>350 RPM (Nominal)</span>
                <span>600 RPM (High Shear)</span>
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
            <h4 className="card-heading-sm">Reaction Train Topology</h4>
            <div className="topology-items">
              <div className="topology-box" onClick={() => onNavigateTab('heat_exchanger')}>
                <span className="topo-tag">UPSTREAM (SOURCE)</span>
                <span className="topo-name">E-101 Shell &amp; Tube Exchanger</span>
                <span className="topo-stream">Stream S-102 &bull; Pre-Heated Feed &bull; {pumpFlow.toFixed(1)} L/m</span>
              </div>

              <div className="topology-arrow">&darr;</div>

              <div className="topology-box active">
                <span className="topo-tag active">ACTIVE UNIT</span>
                <span className="topo-name">R-101 CSTR Reactor</span>
                <span className="topo-stream">{temp.toFixed(1)}°C &bull; Conv: {(conversion * 100).toFixed(1)}%</span>
              </div>

              <div className="topology-arrow">&darr;</div>

              <div className="topology-box" onClick={() => onNavigateTab('distillation')}>
                <span className="topo-tag">DOWNSTREAM (SINK)</span>
                <span className="topo-name">D-101 Binary Distillation</span>
                <span className="topo-stream">Stream S-103 &bull; Effluent with Product B &rarr;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
