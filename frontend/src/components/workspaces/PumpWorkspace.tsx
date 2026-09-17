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
  Activity,
  Sliders,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Layers,
  ArrowUpRight,
  Droplet
} from 'lucide-react';

interface PumpWorkspaceProps {
  state: ProcessUpdatePayload;
  timeSeries: TimeSeriesPoint[];
  onNavigateTab: (tab: 'overview' | 'flowsheet' | 'pump' | 'heat_exchanger' | 'reactor' | 'distillation' | 'ai_diagnosis' | 'alerts') => void;
  onAskAiAbout?: (unitId: string) => void;
}

export const PumpWorkspace: React.FC<PumpWorkspaceProps> = ({
  state,
  timeSeries,
  onNavigateTab,
  onAskAiAbout
}) => {
  const eqDiagnostics = state.equipment_diagnostics || state.equipmentDiagnostics || ({} as any);
  const pumpDiag = eqDiagnostics.P101 || eqDiagnostics.pump;

  const pumpData = state.equipment.pump.data;
  const pumpHealth = pumpDiag?.health ?? (pumpData.health ?? 98);
  const pumpRisk = pumpDiag?.risk ?? Math.max(0, 100 - pumpHealth);

  const [localRpm, setLocalRpm] = useState<number>(pumpData.rpm || 2450);
  const [localRestriction, setLocalRestriction] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Derived engineering properties
  const flowRate = pumpData.flow ?? ((pumpData.rpm / 2450) * 10.0);
  const vibration = pumpData.vibration ?? 0.08;
  const rpm = pumpData.rpm ?? 2450;
  const head = (pumpData as any).head ?? (18.25 * Math.pow(rpm / 2450, 2));
  const power = (pumpData as any).power_kw ?? (0.12 * Math.pow(rpm / 2450, 3));
  const efficiency = (pumpData as any).efficiency ?? (flowRate > 0.1 ? 78.5 : 0);
  const suctionP = 1.01;
  const dischargeP = 1.01 + (head * 0.0981);
  const isCavitation = vibration > 0.25 || flowRate < 7.0;

  // Status classification from single source of truth
  const statusLabel = pumpDiag?.stageLabel || (pumpHealth < 60 ? 'FAULT CONFIRMED' : pumpHealth < 80 ? 'EARLY DEGRADATION' : rpm < 2200 ? 'EARLY DEVIATION' : 'NOMINAL STEADY');
  const statusClass = pumpDiag?.severity === 'CRITICAL' || pumpHealth < 60 ? 'critical' : (pumpDiag?.severity === 'HIGH' || pumpDiag?.severity === 'MEDIUM' ? 'warning' : 'nominal');

  // Baseline comparison
  const baselines = [
    { name: 'Impeller Speed (RPM)', current: rpm.toFixed(0), baseline: '2450 RPM', dev: `${(((rpm - 2450) / 2450) * 100).toFixed(1)}%`, normal: Math.abs(rpm - 2450) < 150 },
    { name: 'Discharge Flow Rate', current: `${flowRate.toFixed(2)} L/min`, baseline: '10.00 L/min', dev: `${(((flowRate - 10) / 10) * 100).toFixed(1)}%`, normal: flowRate >= 8.5 },
    { name: 'Casing Vibration (MPU6050)', current: `${vibration.toFixed(2)} g`, baseline: '0.08 g', dev: `${(((vibration - 0.08) / 0.08) * 100).toFixed(0)}%`, normal: vibration < 0.20 },
    { name: 'Developed Head (H)', current: `${head.toFixed(2)} m`, baseline: '18.25 m', dev: `${(((head - 18.25) / 18.25) * 100).toFixed(1)}%`, normal: head >= 15.0 },
    { name: 'Hydraulic Efficiency', current: `${efficiency.toFixed(1)}%`, baseline: '78.5%', dev: `${(efficiency - 78.5).toFixed(1)}%`, normal: efficiency >= 70 },
    { name: 'Discharge Pressure', current: `${dischargeP.toFixed(2)} bar`, baseline: '2.80 bar', dev: `${(((dischargeP - 2.8) / 2.8) * 100).toFixed(1)}%`, normal: dischargeP >= 2.3 }
  ];

  const handleSliderChange = async (overrides: ManualControlOverrides) => {
    setIsUpdating(true);
    try {
      await updateSimulatorControls(overrides);
    } catch (e) {
      console.error('Failed to update pump controls:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetControls = async () => {
    setLocalRpm(2450);
    setLocalRestriction(0);
    setIsUpdating(true);
    try {
      await updateSimulatorControls({ pump_rpm: 2450, suction_restriction: 0 });
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
        activeUnit="P-101"
        onNavigate={onNavigateTab}
        trainFlow={flowRate}
      />

      {/* 2. Continuous ML Diagnostic Panel (Single Source of Truth) */}
      <EquipmentContinuousMlPanel
        diagnostic={pumpDiag}
        allDiagnostics={eqDiagnostics}
        unitTag="P-101"
        unitName="Centrifugal Feed Pump"
        onSelectUnit={(id) => onNavigateTab(id as any)}
        onNavigateTab={onNavigateTab}
        onAskAiAbout={onAskAiAbout}
      />

      {/* 3. Live Parameters Key Metrics Grid */}
      <div className="workspace-metrics-grid mt-4">
        <div className="metric-card">
          <span className="metric-card-label">Impeller Speed (RPM)</span>
          <span className="metric-card-value font-mono">{Math.round(rpm)} <span className="unit">RPM</span></span>
          <span className="metric-card-sub">Design: 2450 RPM (Nominal)</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Discharge Volumetric Flow</span>
          <span className="metric-card-value font-mono">{flowRate.toFixed(2)} <span className="unit">L/min</span></span>
          <span className="metric-card-sub">Stream S-101 (Pumped Feed)</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Vibration Magnitude</span>
          <span className={`metric-card-value font-mono ${vibration > 0.25 ? 'text-red-600 font-bold' : ''}`}>
            {vibration.toFixed(2)} <span className="unit">g</span>
          </span>
          <span className="metric-card-sub">ISO 10816 Limit: 0.25 g</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Developed Head (H)</span>
          <span className="metric-card-value font-mono">{head.toFixed(2)} <span className="unit">m</span></span>
          <span className="metric-card-sub">Design: 18.25 m at BEP</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Hydraulic Efficiency</span>
          <span className="metric-card-value font-mono">{efficiency.toFixed(1)} <span className="unit">%</span></span>
          <span className="metric-card-sub">BEP Efficiency: 78.5%</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Suction / Discharge P</span>
          <span className="metric-card-value font-mono">{suctionP.toFixed(2)} / {dischargeP.toFixed(2)} <span className="unit">bar</span></span>
          <span className="metric-card-sub">Atmospheric Suction Head</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Health Score</span>
          <span className={`metric-card-value font-mono ${pumpHealth < 80 ? 'text-amber-600' : 'text-emerald-700'}`}>
            {pumpHealth.toFixed(0)} <span className="unit">%</span>
          </span>
          <span className="metric-card-sub">Degradation: {(100 - pumpHealth).toFixed(0)}%</span>
        </div>

        <div className="metric-card">
          <span className="metric-card-label">Primary Fault Risk</span>
          <span className={`metric-card-value font-mono ${pumpRisk > 40 ? 'text-red-600' : 'text-slate-800'}`}>
            {pumpRisk.toFixed(0)} <span className="unit">/ 100</span>
          </span>
          <span className="metric-card-sub">{isCavitation ? 'Cavitation Impeller Risk' : 'Low Cavitation Risk'}</span>
        </div>
      </div>

      {/* 4. Live Trends & Simulation Controls (Two Columns) */}
      <div className="workspace-split-layout">
        {/* Left Column: Live Time-Series Chart */}
        <div className="workspace-main-panel">
          <div className="panel-header">
            <h3 className="panel-title">P-101 Dynamic Response Trends</h3>
            <span className="badge-live-pulse">REAL-TIME TELEMETRY</span>
          </div>

          <div className="chart-wrapper-card">
            <div className="chart-legend-row">
              <span className="legend-item"><span className="legend-dot bg-sky-600"></span> Flow (L/min)</span>
              <span className="legend-item"><span className="legend-dot bg-rose-600"></span> Vibration (g &times; 10)</span>
              <span className="legend-item"><span className="legend-dot bg-emerald-600"></span> RPM / 300</span>
            </div>

            <svg viewBox="0 0 500 150" className="w-full h-44 overflow-visible">
              <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="0" y1="75" x2="500" y2="75" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#f1f5f9" strokeDasharray="3 3" />

              {timeSeries.length > 1 && (() => {
                const flowPts = timeSeries.map((pt, i) => {
                  const x = (i / (timeSeries.length - 1)) * 490 + 5;
                  const y = 140 - ((pt.pumpFlow || 10) / 14) * 110;
                  return `${x.toFixed(1)},${Math.max(10, Math.min(140, y)).toFixed(1)}`;
                });
                const vibPts = timeSeries.map((pt, i) => {
                  const x = (i / (timeSeries.length - 1)) * 490 + 5;
                  const y = 140 - ((pt.pumpVibration || 0.08) * 10 / 6) * 110;
                  return `${x.toFixed(1)},${Math.max(10, Math.min(140, y)).toFixed(1)}`;
                });

                return (
                  <>
                    <polyline points={flowPts.join(' ')} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
                    <polyline points={vibPts.join(' ')} fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" />
                  </>
                );
              })()}
            </svg>
          </div>

          {/* Baseline vs Current Table */}
          <div className="panel-header mt-4">
            <h3 className="panel-title">Baseline vs. Current Engineering Parameters</h3>
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

        {/* Right Column: Actuator Simulation Controls + Connectivity */}
        <div className="workspace-side-panel">
          {/* Actuators & Boundary Control */}
          <div className="controls-panel-card">
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-sky-700" />
                <h3 className="panel-title">P-101 Actuators &amp; Physics Controls</h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-3">
              Manipulate live pump rotational speed and suction line resistance. Effects cascade downstream dynamically to E-101, R-101, and D-101.
            </p>

            <div className="control-slider-group">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Pump Rotational Speed</span>
                <span className="font-mono font-bold text-sky-700">{localRpm} RPM</span>
              </div>
              <input
                type="range"
                min="0"
                max="3500"
                step="50"
                value={localRpm}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLocalRpm(val);
                  handleSliderChange({ pump_rpm: val });
                }}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0 RPM (Trip)</span>
                <span>2450 RPM (Design)</span>
                <span>3500 RPM (Max)</span>
              </div>
            </div>

            <div className="control-slider-group mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">Suction Line Throttling</span>
                <span className="font-mono font-bold text-amber-700">{(localRestriction * 100).toFixed(0)}% Restricted</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.9"
                step="0.05"
                value={localRestriction}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setLocalRestriction(val);
                  handleSliderChange({ suction_restriction: val });
                }}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>Open (0%)</span>
                <span>Moderate (40%)</span>
                <span>Severe (90%)</span>
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

          {/* Upstream & Downstream Flowsheet Connectivity */}
          <div className="connectivity-card">
            <h4 className="card-heading-sm">Hydraulic Stream Topology</h4>
            <div className="topology-items">
              <div className="topology-box" onClick={() => onNavigateTab('flowsheet')}>
                <span className="topo-tag">UPSTREAM (SOURCE)</span>
                <span className="topo-name">T-100 Feed Stock Tank</span>
                <span className="topo-stream">Stream S-100 &bull; {(flowRate).toFixed(1)} L/min &bull; 25.0°C</span>
              </div>

              <div className="topology-arrow">&darr;</div>

              <div className="topology-box active">
                <span className="topo-tag active">ACTIVE UNIT</span>
                <span className="topo-name">P-101 Centrifugal Feed Pump</span>
                <span className="topo-stream">{rpm} RPM &bull; Head: {head.toFixed(1)} m</span>
              </div>

              <div className="topology-arrow">&darr;</div>

              <div className="topology-box" onClick={() => onNavigateTab('heat_exchanger')}>
                <span className="topo-tag">DOWNSTREAM (SINK)</span>
                <span className="topo-name">E-101 Shell &amp; Tube Exchanger</span>
                <span className="topo-stream">Stream S-101 &bull; {(flowRate).toFixed(1)} L/min &bull; 2.8 bar &rarr;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
