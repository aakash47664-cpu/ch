import React from 'react';
import {
  ProcessUpdatePayload,
  TimeSeriesPoint,
  AlertItem,
  IntelligentAlert
} from '../../types';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Cpu,
  Layers,
  ArrowRight,
  TrendingUp,
  Droplet,
  Clock,
  CheckCircle2,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface OverviewWorkspaceProps {
  state: ProcessUpdatePayload;
  timeSeries: TimeSeriesPoint[];
  alerts: AlertItem[];
  onNavigateTab: (tab: 'overview' | 'flowsheet' | 'pump' | 'heat_exchanger' | 'reactor' | 'distillation' | 'ai_diagnosis' | 'alerts') => void;
  onAskAiAbout?: (unitId: string) => void;
}

export const OverviewWorkspace: React.FC<OverviewWorkspaceProps> = ({
  state,
  timeSeries,
  alerts,
  onNavigateTab,
  onAskAiAbout
}) => {
  const diagnosis = state.diagnosis;
  const eqDiagnostics = state.equipment_diagnostics || state.equipmentDiagnostics || ({} as any);

  const pumpDiag = eqDiagnostics.P101 || eqDiagnostics.pump;
  const hxDiag = eqDiagnostics.E101 || eqDiagnostics.heat_exchanger;
  const rxDiag = eqDiagnostics.R101 || eqDiagnostics.reactor;
  const distDiag = eqDiagnostics.D101 || eqDiagnostics.distillation;

  const pumpData = state.equipment.pump.data;
  const hxData = state.equipment.heat_exchanger.data;
  const reactorData = state.equipment.reactor.data;
  const distData = state.equipment.distillation.data;

  // Single source of truth health scores directly from continuous ML engine
  const pumpHealth = pumpDiag?.health ?? (pumpData.health ?? 98);
  const hxHealth = hxDiag?.health ?? (hxData.health ?? 96);
  const reactorHealth = rxDiag?.health ?? (reactorData.health ?? 99);
  const distHealth = distDiag?.health ?? (distData.health ?? 97);

  const riskScore = diagnosis?.preventive?.riskScore ?? 12;
  const riskStage = diagnosis?.preventive?.riskStage ?? 'NORMAL';
  const trainFlow = pumpData?.flow ?? 10.0;
  const overallHealth = eqDiagnostics.plant?.health ?? Math.max(0, Math.min(100, 100 - (riskScore * 0.85)));

  const activeAlerts = state.active_alerts || [];
  const activeAlertCount = activeAlerts.length;

  const getHealthBadge = (health: number, diagItem?: any) => {
    if (diagItem?.stageLabel) {
      const cls = diagItem.severity === 'CRITICAL' ? 'status-badge critical' 
        : diagItem.severity === 'HIGH' ? 'status-badge critical'
        : diagItem.severity === 'MEDIUM' ? 'status-badge warning'
        : diagItem.severity === 'LOW' ? 'status-badge deviation'
        : 'status-badge nominal';
      return { label: diagItem.stageLabel, className: cls };
    }
    if (health < 60) return { label: 'CRITICAL', className: 'status-badge critical' };
    if (health < 80) return { label: 'DEGRADED', className: 'status-badge warning' };
    if (health < 90) return { label: 'DEVIATION', className: 'status-badge deviation' };
    return { label: 'NOMINAL', className: 'status-badge nominal' };
  };

  // Recent 10 time series points for mini-sparkline
  const recentHistory = timeSeries.slice(-12);

  return (
    <div className="overview-workspace">
      {/* Top Banner: Process Overall KPIs */}
      <div className="overview-hero-grid">
        {/* Card 1: Process Health Index */}
        <div className="overview-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Overall Process Health</span>
            <ShieldCheck className="kpi-icon text-emerald-600" size={18} />
          </div>
          <div className="kpi-card-body">
            <span className="kpi-value font-mono font-bold text-slate-900">
              {overallHealth.toFixed(1)}%
            </span>
            <div className="kpi-subtext">
              <span className={`status-pill ${overallHealth > 80 ? 'nominal' : overallHealth > 60 ? 'warning' : 'critical'}`}>
                {eqDiagnostics.plant?.stageLabel || (overallHealth > 80 ? 'NOMINAL STEADY' : overallHealth > 60 ? 'EARLY DEVIATION' : 'ATTENTION REQUIRED')}
              </span>
            </div>
          </div>
          <div className="kpi-progress-bar">
            <div
              className={`kpi-progress-fill ${overallHealth > 80 ? 'bg-emerald-500' : overallHealth > 60 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${overallHealth}%` }}
            ></div>
          </div>
        </div>

        {/* Card 2: Train Volumetric Flow */}
        <div className="overview-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Main Train Feed Flow</span>
            <Droplet className="kpi-icon text-sky-600" size={18} />
          </div>
          <div className="kpi-card-body">
            <span className="kpi-value font-mono font-bold text-slate-900">
              {trainFlow.toFixed(1)} <span className="text-sm font-normal text-slate-500">L/min</span>
            </span>
            <div className="kpi-subtext">
              <span className="text-xs text-slate-600">
                Stream S-100 (T-100 &rarr; P-101)
              </span>
            </div>
          </div>
          <div className="kpi-footer-note">
            Nominal Design: 10.0 L/min
          </div>
        </div>

        {/* Card 3: Overall Risk & Preventive Stage */}
        <div className="overview-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Systemic Risk Score</span>
            <TrendingUp className="kpi-icon text-amber-600" size={18} />
          </div>
          <div className="kpi-card-body">
            <span className={`kpi-value font-mono font-bold ${riskScore > 50 ? 'text-red-600' : riskScore > 25 ? 'text-amber-600' : 'text-slate-900'}`}>
              {riskScore} <span className="text-sm font-normal text-slate-500">/ 100</span>
            </span>
            <div className="kpi-subtext">
              <span className={`risk-stage-badge ${riskStage.toLowerCase()}`}>
                STAGE: {riskStage}
              </span>
            </div>
          </div>
          <div className="kpi-footer-note">
            Safety Gate: {diagnosis?.safetyGate?.statusLabel || '✓ NOMINAL'}
          </div>
        </div>

        {/* Card 4: Active Alerts Summary */}
        <div className="overview-kpi-card cursor-pointer" onClick={() => onNavigateTab('alerts')}>
          <div className="kpi-card-header">
            <span className="kpi-label">Active Alerts Summary</span>
            <AlertTriangle className="kpi-icon text-rose-600" size={18} />
          </div>
          <div className="kpi-card-body">
            <span className={`kpi-value font-mono font-bold ${activeAlertCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {activeAlertCount} <span className="text-sm font-normal text-slate-500">Active</span>
            </span>
            <div className="kpi-subtext">
              <span className="text-xs text-sky-700 font-semibold flex items-center gap-1">
                View Alert Center <ArrowRight size={12} />
              </span>
            </div>
          </div>
          <div className="kpi-footer-note">
            {activeAlertCount === 0 ? 'All sensors reporting nominal' : `${activeAlertCount} anomaly conditions detected`}
          </div>
        </div>
      </div>

      {/* Main Grid: Unit Health Summary + Overall Trends */}
      <div className="overview-main-grid">
        {/* Left Column: Unit Health Summary Cards */}
        <div className="overview-units-section">
          <div className="section-header-row">
            <div>
              <h3 className="section-title">Plant-Wide Continuous ML Diagnostic State</h3>
              <p className="section-subtitle">Real-time ML monitoring active simultaneously across all process equipment</p>
            </div>
            <button
              className="btn-flowsheet-shortcut"
              onClick={() => onNavigateTab('flowsheet')}
            >
              <ExternalLink size={13} />
              Open Process Flowsheet
            </button>
          </div>

          <div className="units-summary-grid">
            {/* Unit 1: P-101 Centrifugal Pump */}
            <div
              className="unit-summary-card"
              onClick={() => onNavigateTab('pump')}
            >
              <div className="unit-summary-top">
                <div className="flex items-center gap-2">
                  <div className="unit-icon-box bg-sky-50 text-sky-700">
                    <Activity size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="unit-summary-name">P-101 Centrifugal Pump</h4>
                      {pumpDiag?.role === 'PRIMARY_FAULT' && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">PRIMARY FAULT</span>
                      )}
                      {pumpDiag?.role === 'DOWNSTREAM_IMPACT' && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.5 rounded">DOWNSTREAM</span>
                      )}
                    </div>
                    <span className="unit-summary-tag">
                      ML Anomaly: {((pumpDiag?.anomalyScore ?? 0.12)).toFixed(2)} &bull; {pumpDiag?.faultLabel || 'Nominal'}
                    </span>
                  </div>
                </div>
                <span className={getHealthBadge(pumpHealth, pumpDiag).className}>
                  {getHealthBadge(pumpHealth, pumpDiag).label} ({pumpHealth}%)
                </span>
              </div>

              <div className="unit-summary-metrics">
                <div className="unit-metric-item">
                  <span className="metric-lbl">Speed</span>
                  <span className="metric-val font-mono">{Math.round(pumpData.rpm || 2450)} RPM</span>
                </div>
                <div className="unit-metric-item">
                  <span className="metric-lbl">Flow</span>
                  <span className="metric-val font-mono">{(pumpData.flow ?? 10.0).toFixed(1)} L/m</span>
                </div>
                <div className="unit-metric-item">
                  <span className="metric-lbl">Vibration</span>
                  <span className={`metric-val font-mono ${(pumpData.vibration || 0) > 0.20 ? 'text-red-600 font-bold' : ''}`}>
                    {(pumpData.vibration || 0.08).toFixed(2)} g
                  </span>
                </div>
              </div>

              <div className="unit-summary-footer">
                <span className="text-xs text-sky-700 font-semibold flex items-center gap-1">
                  Open P-101 Live Analysis &rarr;
                </span>
              </div>
            </div>

            {/* Unit 2: E-101 Shell & Tube Heat Exchanger */}
            <div
              className="unit-summary-card"
              onClick={() => onNavigateTab('heat_exchanger')}
            >
              <div className="unit-summary-top">
                <div className="flex items-center gap-2">
                  <div className="unit-icon-box bg-amber-50 text-amber-700">
                    <Flame size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="unit-summary-name">E-101 Shell &amp; Tube Exchanger</h4>
                      {hxDiag?.role === 'PRIMARY_FAULT' && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">PRIMARY FAULT</span>
                      )}
                      {hxDiag?.role === 'DOWNSTREAM_IMPACT' && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.5 rounded">DOWNSTREAM</span>
                      )}
                    </div>
                    <span className="unit-summary-tag">
                      ML Anomaly: {((hxDiag?.anomalyScore ?? 0.12)).toFixed(2)} &bull; {hxDiag?.faultLabel || 'Nominal'}
                    </span>
                  </div>
                </div>
                <span className={getHealthBadge(hxHealth, hxDiag).className}>
                  {getHealthBadge(hxHealth, hxDiag).label} ({hxHealth}%)
                </span>
              </div>

              <div className="unit-summary-metrics">
                <div className="unit-metric-item">
                  <span className="metric-lbl">Inlet T</span>
                  <span className="metric-val font-mono">{(hxData.inlet_temperature || 25.2).toFixed(1)}°C</span>
                </div>
                <div className="unit-metric-item">
                  <span className="metric-lbl">Outlet T</span>
                  <span className="metric-val font-mono">{(hxData.outlet_temperature || 38.1).toFixed(1)}°C</span>
                </div>
                <div className="unit-metric-item">
                  <span className="metric-lbl">Delta T</span>
                  <span className={`metric-val font-mono ${(hxData.temperature_difference || 0) < 6.0 ? 'text-amber-600 font-bold' : ''}`}>
                    {(hxData.temperature_difference || 12.9).toFixed(1)}°C
                  </span>
                </div>
              </div>

              <div className="unit-summary-footer">
                <span className="text-xs text-sky-700 font-semibold flex items-center gap-1">
                  Open E-101 Live Analysis &rarr;
                </span>
              </div>
            </div>

            {/* Unit 3: R-101 CSTR Reactor */}
            <div
              className="unit-summary-card"
              onClick={() => onNavigateTab('reactor')}
            >
              <div className="unit-summary-top">
                <div className="flex items-center gap-2">
                  <div className="unit-icon-box bg-purple-50 text-purple-700">
                    <Cpu size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="unit-summary-name">R-101 Continuous CSTR</h4>
                      {rxDiag?.role === 'PRIMARY_FAULT' && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">PRIMARY FAULT</span>
                      )}
                      {rxDiag?.role === 'DOWNSTREAM_IMPACT' && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.5 rounded">DOWNSTREAM</span>
                      )}
                    </div>
                    <span className="unit-summary-tag">
                      ML Anomaly: {((rxDiag?.anomalyScore ?? 0.12)).toFixed(2)} &bull; {rxDiag?.faultLabel || 'Nominal'}
                    </span>
                  </div>
                </div>
                <span className={getHealthBadge(reactorHealth, rxDiag).className}>
                  {getHealthBadge(reactorHealth, rxDiag).label} ({reactorHealth}%)
                </span>
              </div>

              <div className="unit-summary-metrics">
                <div className="unit-metric-item">
                  <span className="metric-lbl">Core Temp</span>
                  <span className={`metric-val font-mono ${(reactorData.temperature || 0) > 75 ? 'text-red-600 font-bold' : ''}`}>
                    {(reactorData.temperature || 65.0).toFixed(1)}°C
                  </span>
                </div>
                <div className="unit-metric-item">
                  <span className="metric-lbl">Pressure</span>
                  <span className="metric-val font-mono">{(reactorData.pressure || 2.05).toFixed(2)} bar</span>
                </div>
                <div className="unit-metric-item">
                  <span className="metric-lbl">Cooling</span>
                  <span className={`metric-val font-mono ${reactorData.cooling_status === 1 ? 'text-emerald-700' : 'text-red-600 font-bold'}`}>
                    {reactorData.cooling_status === 1 ? 'ACTIVE' : 'TRIPPED'}
                  </span>
                </div>
              </div>

              <div className="unit-summary-footer">
                <span className="text-xs text-sky-700 font-semibold flex items-center gap-1">
                  Open R-101 Live Analysis &rarr;
                </span>
              </div>
            </div>

            {/* Unit 4: D-101 Binary Distillation Column */}
            <div
              className="unit-summary-card"
              onClick={() => onNavigateTab('distillation')}
            >
              <div className="unit-summary-top">
                <div className="flex items-center gap-2">
                  <div className="unit-icon-box bg-cyan-50 text-cyan-700">
                    <Layers size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="unit-summary-name">D-101 Distillation Column</h4>
                      {distDiag?.role === 'PRIMARY_FAULT' && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">PRIMARY FAULT</span>
                      )}
                      {distDiag?.role === 'DOWNSTREAM_IMPACT' && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.5 rounded">DOWNSTREAM</span>
                      )}
                    </div>
                    <span className="unit-summary-tag">
                      ML Anomaly: {((distDiag?.anomalyScore ?? 0.12)).toFixed(2)} &bull; {distDiag?.faultLabel || 'Nominal'}
                    </span>
                  </div>
                </div>
                <span className={getHealthBadge(distHealth, distDiag).className}>
                  {getHealthBadge(distHealth, distDiag).label} ({distHealth}%)
                </span>
              </div>

              <div className="unit-summary-metrics">
                <div className="unit-metric-item">
                  <span className="metric-lbl">Reflux (L/D)</span>
                  <span className={`metric-val font-mono ${(distData.reflux_ratio || 0) < 1.30 ? 'text-amber-600 font-bold' : ''}`}>
                    {(distData.reflux_ratio || 1.85).toFixed(2)}
                  </span>
                </div>
                <div className="unit-metric-item">
                  <span className="metric-lbl">Top Temp</span>
                  <span className="metric-val font-mono">{(distData.top_temperature || 76.5).toFixed(1)}°C</span>
                </div>
                <div className="unit-metric-item">
                  <span className="metric-lbl">Bottom Temp</span>
                  <span className="metric-val font-mono">{(distData.bottom_temperature || 98.4).toFixed(1)}°C</span>
                </div>
              </div>

              <div className="unit-summary-footer">
                <span className="text-xs text-sky-700 font-semibold flex items-center gap-1">
                  Open D-101 Live Analysis &rarr;
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Compact Overall Trend & Recent Events */}
        <div className="overview-side-section">
          {/* 1. Compact Live Trend */}
          <div className="overview-trend-card">
            <div className="trend-card-header">
              <span className="card-title">Live Process Trends</span>
              <span className="badge-live-pulse">LIVE TELEMETRY</span>
            </div>
            <div className="trend-stats-row">
              <div className="stat-pill">
                <span className="stat-lbl">Feed Flow</span>
                <span className="stat-val font-mono">{trainFlow.toFixed(1)} L/m</span>
              </div>
              <div className="stat-pill">
                <span className="stat-lbl">Pump Vib</span>
                <span className="stat-val font-mono">{(pumpData.vibration || 0.08).toFixed(2)} g</span>
              </div>
              <div className="stat-pill">
                <span className="stat-lbl">Reactor Temp</span>
                <span className="stat-val font-mono">{(reactorData.temperature || 65.0).toFixed(1)}°C</span>
              </div>
            </div>

            <div className="overview-chart-preview">
              <svg viewBox="0 0 320 80" className="w-full h-20 overflow-visible">
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0284c7" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal baseline guides */}
                <line x1="0" y1="20" x2="320" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="0" y1="50" x2="320" y2="50" stroke="#e2e8f0" strokeDasharray="3 3" />

                {/* Simulated sparkline path */}
                {recentHistory.length > 1 && (() => {
                  const points = recentHistory.map((pt, idx) => {
                    const x = (idx / (recentHistory.length - 1)) * 310 + 5;
                    const y = 65 - ((pt.pumpFlow || 10) / 12) * 45;
                    return `${x.toFixed(1)},${Math.max(8, Math.min(72, y)).toFixed(1)}`;
                  });
                  return (
                    <>
                      <polygon
                        points={`5,75 ${points.join(' ')} 315,75`}
                        fill="url(#trendGrad)"
                      />
                      <polyline
                        points={points.join(' ')}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* 2. Recent Events & Safety Audits */}
          <div className="overview-events-card">
            <div className="events-card-header">
              <span className="card-title">Recent System Events</span>
              <Clock size={14} className="text-slate-400" />
            </div>

            <div className="events-list">
              {alerts.length > 0 ? (
                alerts.slice(0, 4).map((alert, idx) => (
                  <div
                    key={idx}
                    className="event-item cursor-pointer"
                    onClick={() => onNavigateTab('alerts')}
                  >
                    <span className={`event-dot ${alert.severity === 'CRITICAL' ? 'critical' : alert.severity === 'HIGH' ? 'high' : 'warning'}`}></span>
                    <div className="event-content">
                      <div className="flex justify-between items-center">
                        <span className="event-equip font-bold">{alert.equipment}</span>
                        <span className="event-time text-slate-400 font-mono text-xs">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="event-desc">{alert.fault}: {alert.root_cause || 'Parameter deviation'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="event-item nominal">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                  <div className="event-content">
                    <span className="event-equip font-bold text-emerald-800">Steady State Telemetry</span>
                    <p className="event-desc">Continuous first-principles monitoring active across all train units.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
