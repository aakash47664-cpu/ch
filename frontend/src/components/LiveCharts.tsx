import React, { useState, useEffect } from 'react';
import { TimeSeriesPoint } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts';
import { Activity, Clock, TrendingUp } from 'lucide-react';

interface LiveChartsProps {
  data: TimeSeriesPoint[];
  selectedEquipment?: string;
  onSelectEquipment?: (id: string) => void;
}

export const LiveCharts: React.FC<LiveChartsProps> = ({
  data,
  selectedEquipment = 'all',
  onSelectEquipment
}) => {
  const [activeView, setActiveView] = useState<string>(selectedEquipment || 'all');

  // Sync when prop changes
  useEffect(() => {
    if (selectedEquipment) {
      setActiveView(selectedEquipment);
    }
  }, [selectedEquipment]);

  const tooltipStyle = {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderRadius: 6,
    fontSize: '0.74rem',
    color: '#0F172A',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    padding: '6px 10px',
    fontFamily: 'var(--font-mono)'
  };

  const latestPoint = data && data.length > 0 ? data[data.length - 1] : null;
  const lastTime = latestPoint?.time || new Date().toLocaleTimeString();

  // Calculation helpers for current/min/max
  const getStats = (extractor: (p: TimeSeriesPoint) => number) => {
    if (!data || data.length === 0) return { current: 0, min: 0, max: 0 };
    const values = data.map(extractor);
    return {
      current: values[values.length - 1],
      min: Math.min(...values),
      max: Math.max(...values)
    };
  };

  const pumpVibStats = getStats((p) => p.pumpVibration);
  const pumpRpmStats = getStats((p) => p.pumpRpm);
  const pumpFlowStats = getStats((p) => p.pumpFlow || ((p.pumpRpm / 2450) * 10.0));
  const hxDeltaStats = getStats((p) => p.hxDeltaT);
  const hxOutletStats = getStats((p) => p.hxOutletTemp);
  const reactorTempStats = getStats((p) => p.reactorTemp);
  const reactorPressStats = getStats((p) => p.reactorPressure);
  const distTopStats = getStats((p) => p.distTopTemp);
  const distRefluxStats = getStats((p) => p.distReflux);
  const riskStats = getStats((p) => p.riskScore ?? 12);

  const handleTabChange = (view: string) => {
    setActiveView(view);
    if (onSelectEquipment) onSelectEquipment(view);
  };

  return (
    <section className="charts-section" aria-label="Real-Time Process Trends">
      <div className="section-header">
        <div className="section-title-group">
          <Activity size={16} color="var(--primary-blue)" />
          <h3 className="section-title">
            {activeView === 'pump'
              ? 'PUMP (P-101) — SPEED & VIBRATION TREND'
              : activeView === 'heat_exchanger'
              ? 'HEAT EXCHANGER (E-101) — THERMAL GRADIENT TREND'
              : activeView === 'reactor'
              ? 'REACTOR (R-101) — TEMPERATURE & PRESSURE TREND'
              : activeView === 'distillation'
              ? 'DISTILLATION (D-101) — REFLUX & TOP TEMP TREND'
              : activeView === 'risk'
              ? 'PREVENTIVE RISK & DEGRADATION PROGRESSION TIMELINE'
              : 'LIVE PROCESS DYNAMIC TRENDS'}
          </h3>
          <span className="live-trend-pill">
            <span className="sys-online-dot"></span>
            LIVE STREAM
          </span>
        </div>

        {/* Equipment Selector Tabs */}
        <div className="chart-equipment-tabs">
          <button
            className={`chart-tab-btn ${activeView === 'all' ? 'active' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            All Units
          </button>
          <button
            className={`chart-tab-btn ${activeView === 'pump' ? 'active' : ''}`}
            onClick={() => handleTabChange('pump')}
          >
            P-101 Pump
          </button>
          <button
            className={`chart-tab-btn ${activeView === 'heat_exchanger' ? 'active' : ''}`}
            onClick={() => handleTabChange('heat_exchanger')}
          >
            E-101 Exchanger
          </button>
          <button
            className={`chart-tab-btn ${activeView === 'reactor' ? 'active' : ''}`}
            onClick={() => handleTabChange('reactor')}
          >
            R-101 Reactor
          </button>
          <button
            className={`chart-tab-btn ${activeView === 'distillation' ? 'active' : ''}`}
            onClick={() => handleTabChange('distillation')}
          >
            D-101 Distillation
          </button>
          <button
            className={`chart-tab-btn ${activeView === 'risk' ? 'active' : ''}`}
            onClick={() => handleTabChange('risk')}
          >
            <TrendingUp size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
            Risk Progression
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          <Clock size={11} />
          <span>Last sync: <strong className="numeric-data" style={{ color: 'var(--text-secondary)' }}>{lastTime}</strong></span>
        </div>
      </div>

      {/* VIEW: RISK PROGRESSION TIMELINE */}
      {activeView === 'risk' && (
        <div className="chart-card-focused">
          <div className="chart-header-row">
            <span className="chart-title">Preventive Risk Score (0–100) & Degradation Trajectory</span>
            <span className="chart-live-val">
              Current Risk: <strong className="numeric-data" style={{ color: riskStats.current > 60 ? '#DC2626' : (riskStats.current > 30 ? '#EA580C' : '#10B981') }}>{riskStats.current} / 100</strong>
            </span>
          </div>
          <div style={{ width: '100%', height: 260, minHeight: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#DC2626" fontSize={10} domain={[0, 100]} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '6px' }} />
                <ReferenceLine y={20} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Normal (0-20)', fill: '#10B981', fontSize: 9, position: 'insideBottomRight' }} />
                <ReferenceLine y={40} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: 'Early Warning (21-40)', fill: '#F59E0B', fontSize: 9, position: 'insideTopLeft' }} />
                <ReferenceLine y={60} stroke="#EA580C" strokeDasharray="3 3" label={{ value: 'Developing (41-60)', fill: '#EA580C', fontSize: 9, position: 'insideTopLeft' }} />
                <ReferenceLine y={80} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'High Risk (61-80)', fill: '#DC2626', fontSize: 9, position: 'insideTopLeft' }} />
                <Line type="monotone" dataKey="riskScore" name="Preventive Risk Score (0-100)" stroke="#DC2626" strokeWidth={2.4} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* VIEW A: FOCUSED SINGLE UNIT LARGE CHART */}
      {activeView === 'pump' && (
        <div className="chart-card-focused">
          <div className="chart-header-row">
            <span className="chart-title">P-101 Centrifugal Pump: Rotational Speed (RPM) & Casing Acceleration (g)</span>
            <span className="chart-live-val">
              Flow: <strong className="numeric-data">{pumpFlowStats.current.toFixed(1)} L/min</strong> | Speed: <strong className="numeric-data">{Math.round(pumpRpmStats.current)} RPM</strong> | Vib: <strong className="numeric-data">{pumpVibStats.current.toFixed(2)} g</strong>
            </span>
          </div>
          <div style={{ width: '100%', height: 260, minHeight: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis yAxisId="left" stroke="#EA580C" fontSize={10} domain={[0, 0.9]} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#2563EB" fontSize={10} domain={[1000, 3200]} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '6px' }} />
                <ReferenceLine yAxisId="left" y={0.25} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'Alarm >0.25g', fill: '#DC2626', fontSize: 9, position: 'insideTopLeft' }} />
                <ReferenceLine yAxisId="right" y={2450} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Nominal 2450 RPM', fill: '#10B981', fontSize: 9, position: 'insideBottomRight' }} />
                <Line yAxisId="left" type="monotone" dataKey="pumpVibration" name="Vibration (g)" stroke="#EA580C" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="pumpRpm" name="Speed (RPM)" stroke="#2563EB" strokeWidth={2.2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeView === 'heat_exchanger' && (
        <div className="chart-card-focused">
          <div className="chart-header-row">
            <span className="chart-title">E-101 Shell & Tube Exchanger: Thermal Gradient ΔT (°C) & Outlet Temperature (°C)</span>
            <span className="chart-live-val">
              ΔT: <strong className="numeric-data">{hxDeltaStats.current.toFixed(1)} °C</strong> | Outlet: <strong className="numeric-data">{hxOutletStats.current.toFixed(1)} °C</strong>
            </span>
          </div>
          <div style={{ width: '100%', height: 260, minHeight: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis yAxisId="left" stroke="#D97706" fontSize={10} domain={[15, 55]} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#0891B2" fontSize={10} domain={[0, 20]} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '6px' }} />
                <ReferenceLine yAxisId="right" y={4.0} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'Fouling Alarm <4°C', fill: '#DC2626', fontSize: 9, position: 'insideBottomRight' }} />
                <ReferenceLine yAxisId="right" y={12.9} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Nominal ΔT 12.9°C', fill: '#10B981', fontSize: 9, position: 'insideTopRight' }} />
                <Line yAxisId="left" type="monotone" dataKey="hxOutletTemp" name="Outlet Temp (°C)" stroke="#D97706" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="hxDeltaT" name="Thermal Gradient ΔT (°C)" stroke="#0891B2" strokeWidth={2.2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeView === 'reactor' && (
        <div className="chart-card-focused">
          <div className="chart-header-row">
            <span className="chart-title">R-101 Continuous CSTR Reactor: Core Temperature (°C) & Vapor Pressure (bar)</span>
            <span className="chart-live-val">
              Temp: <strong className="numeric-data">{reactorTempStats.current.toFixed(1)} °C</strong> | Pressure: <strong className="numeric-data">{reactorPressStats.current.toFixed(2)} bar</strong>
            </span>
          </div>
          <div style={{ width: '100%', height: 260, minHeight: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis yAxisId="left" stroke="#DC2626" fontSize={10} domain={[45, 115]} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#7C3AED" fontSize={10} domain={[1.0, 6.0]} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '6px' }} />
                <ReferenceLine yAxisId="left" y={85.0} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'Runaway Trip >85°C', fill: '#DC2626', fontSize: 9, position: 'insideTopLeft' }} />
                <ReferenceLine yAxisId="left" y={65.0} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Nominal 65°C', fill: '#10B981', fontSize: 9, position: 'insideBottomLeft' }} />
                <Line yAxisId="left" type="monotone" dataKey="reactorTemp" name="Reaction Temp (°C)" stroke="#DC2626" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="reactorPressure" name="Vessel Pressure (bar)" stroke="#7C3AED" strokeWidth={2.2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeView === 'distillation' && (
        <div className="chart-card-focused">
          <div className="chart-header-row">
            <span className="chart-title">D-101 Binary Distillation Column: Top Vapor Temp (°C) & Reflux Ratio (L/D)</span>
            <span className="chart-live-val">
              Top: <strong className="numeric-data">{distTopStats.current.toFixed(1)} °C</strong> | Reflux: <strong className="numeric-data">{distRefluxStats.current.toFixed(2)}</strong>
            </span>
          </div>
          <div style={{ width: '100%', height: 260, minHeight: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis yAxisId="left" stroke="#EA580C" fontSize={10} domain={[55, 95]} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#2563EB" fontSize={10} domain={[0.2, 4.0]} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '6px' }} />
                <ReferenceLine yAxisId="right" y={1.1} stroke="#D97706" strokeDasharray="3 3" label={{ value: 'Starvation <1.1', fill: '#D97706', fontSize: 9, position: 'insideBottomRight' }} />
                <ReferenceLine yAxisId="right" y={1.85} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Nominal Reflux 1.85', fill: '#10B981', fontSize: 9, position: 'insideTopRight' }} />
                <Line yAxisId="left" type="monotone" dataKey="distTopTemp" name="Overhead Temp (°C)" stroke="#EA580C" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="distReflux" name="Reflux Ratio (L/D)" stroke="#2563EB" strokeWidth={2.2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* VIEW B: ALL 4 EQUIPMENT MULTI-GRID */}
      {activeView === 'all' && (
        <div className="charts-grid">
          {/* Chart 1: Pump Vibration & RPM */}
          <div className="chart-card">
            <div className="chart-header-row">
              <span className="chart-title">Pump (P-101): Speed & Vibration</span>
              <span className="chart-live-val">
                <strong className="numeric-data">{Math.round(pumpRpmStats.current)} RPM</strong> · <strong className="numeric-data">{pumpVibStats.current.toFixed(2)} g</strong>
              </span>
            </div>
            <div style={{ width: '100%', height: 180, minHeight: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#EA580C" fontSize={9} domain={[0, 0.8]} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#2563EB" fontSize={9} domain={[1000, 3200]} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '0.68rem', paddingTop: '4px' }} />
                  <ReferenceLine yAxisId="left" y={0.25} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'Alarm >0.25g', fill: '#DC2626', fontSize: 8, position: 'insideTopLeft' }} />
                  <Line yAxisId="left" type="monotone" dataKey="pumpVibration" name="Vib (g)" stroke="#EA580C" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                  <Line yAxisId="right" type="monotone" dataKey="pumpRpm" name="RPM" stroke="#2563EB" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Heat Exchanger Thermal Profiles */}
          <div className="chart-card">
            <div className="chart-header-row">
              <span className="chart-title">Heat Exchanger (E-101): Outlet & ΔT</span>
              <span className="chart-live-val">
                ΔT: <strong className="numeric-data">{hxDeltaStats.current.toFixed(1)} °C</strong> · Out: <strong className="numeric-data">{hxOutletStats.current.toFixed(1)} °C</strong>
              </span>
            </div>
            <div style={{ width: '100%', height: 180, minHeight: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#D97706" fontSize={9} domain={[20, 55]} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#0891B2" fontSize={9} domain={[0, 20]} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '0.68rem', paddingTop: '4px' }} />
                  <ReferenceLine yAxisId="right" y={4.0} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'Fouling <4°C', fill: '#DC2626', fontSize: 8, position: 'insideBottomRight' }} />
                  <Line yAxisId="left" type="monotone" dataKey="hxOutletTemp" name="Outlet (°C)" stroke="#D97706" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                  <Line yAxisId="right" type="monotone" dataKey="hxDeltaT" name="ΔT (°C)" stroke="#0891B2" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Reactor Temperature & Pressure */}
          <div className="chart-card">
            <div className="chart-header-row">
              <span className="chart-title">Reactor (R-101): Temp & Pressure</span>
              <span className="chart-live-val">
                <strong className="numeric-data">{reactorTempStats.current.toFixed(1)} °C</strong> · <strong className="numeric-data">{reactorPressStats.current.toFixed(2)} bar</strong>
              </span>
            </div>
            <div style={{ width: '100%', height: 180, minHeight: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#DC2626" fontSize={9} domain={[50, 115]} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#7C3AED" fontSize={9} domain={[1, 6]} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '0.68rem', paddingTop: '4px' }} />
                  <ReferenceLine yAxisId="left" y={85.0} stroke="#DC2626" strokeDasharray="3 3" label={{ value: 'Trip >85°C', fill: '#DC2626', fontSize: 8, position: 'insideTopLeft' }} />
                  <Line yAxisId="left" type="monotone" dataKey="reactorTemp" name="Temp (°C)" stroke="#DC2626" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                  <Line yAxisId="right" type="monotone" dataKey="reactorPressure" name="Press (bar)" stroke="#7C3AED" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Distillation Top Temp & Reflux Ratio */}
          <div className="chart-card">
            <div className="chart-header-row">
              <span className="chart-title">Distillation (D-101): Top Temp & Reflux</span>
              <span className="chart-live-val">
                Top: <strong className="numeric-data">{distTopStats.current.toFixed(1)} °C</strong> · Reflux: <strong className="numeric-data">{distRefluxStats.current.toFixed(2)}</strong>
              </span>
            </div>
            <div style={{ width: '100%', height: 180, minHeight: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#EA580C" fontSize={9} domain={[55, 95]} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#2563EB" fontSize={9} domain={[0.4, 4.0]} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '0.68rem', paddingTop: '4px' }} />
                  <ReferenceLine yAxisId="right" y={1.1} stroke="#D97706" strokeDasharray="3 3" label={{ value: 'Low Reflux <1.1', fill: '#D97706', fontSize: 8, position: 'insideBottomRight' }} />
                  <Line yAxisId="left" type="monotone" dataKey="distTopTemp" name="Top Temp (°C)" stroke="#EA580C" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                  <Line yAxisId="right" type="monotone" dataKey="distReflux" name="Reflux (L/D)" stroke="#2563EB" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default LiveCharts;
