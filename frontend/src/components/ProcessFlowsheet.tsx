import React, { useState } from 'react';
import {
  ProcessUpdatePayload,
  EquipmentItem,
  PumpData,
  HeatExchangerData,
  ReactorData,
  DistillationData,
  ProcessStreams
} from '../types';
import { updateSimulatorControls, resetSimulatorControls } from '../services/api';
import {
  Activity,
  Flame,
  Cpu,
  Layers,
  Sliders,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Play,
  Pause,
  MessageSquare
} from 'lucide-react';

interface ProcessFlowsheetProps {
  state: ProcessUpdatePayload;
  selectedEquipment?: string;
  onSelectEquipment?: (id: string) => void;
  onAskAiAbout?: (id: string) => void;
}

export const ProcessFlowsheet: React.FC<ProcessFlowsheetProps> = ({
  state,
  selectedEquipment = 'pump',
  onSelectEquipment,
  onAskAiAbout
}) => {
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Extract equipment data safely
  const pump = state.equipment.pump.data;
  const hx = state.equipment.heat_exchanger.data;
  const reactor = state.equipment.reactor.data;
  const dist = state.equipment.distillation.data;

  // Real-time flow from pump or default
  const pumpFlow = pump.flow ?? Number(((pump.rpm / 2450) * 10.0).toFixed(1));

  // Default fallback streams if not yet received from backend
  const streams = state.streams || {
    stream_1: { id: '01', name: 'Source Feed', from: 'Source', to: 'P-101', flow: pumpFlow, temperature: 25.0, pressure: 1.01 },
    stream_2: { id: '02', name: 'Pump Discharge', from: 'P-101', to: 'E-101', flow: Number((pumpFlow * 0.99).toFixed(1)), temperature: pump.outlet_temperature, pressure: pump.pressure ?? 2.80 },
    stream_3: { id: '03', name: 'Exchanger Effluent', from: 'E-101', to: 'R-101', flow: Number((pumpFlow * 0.98).toFixed(1)), temperature: hx.outlet_temperature, pressure: 2.45 },
    stream_4: { id: '04', name: 'Reactor Effluent', from: 'R-101', to: 'D-101', flow: Number((pumpFlow * 0.97).toFixed(1)), temperature: reactor.temperature, pressure: reactor.pressure },
    stream_5: { id: '05', name: 'Top Distillate', from: 'D-101', to: 'Product Tank', flow: Number((pumpFlow * 0.45).toFixed(1)), temperature: dist.top_temperature, pressure: dist.pressure, reflux_ratio: dist.reflux_ratio, reflux_flow: Number((pumpFlow * 0.45 * dist.reflux_ratio).toFixed(1)) },
    stream_6: { id: '06', name: 'Bottom Product', from: 'D-101', to: 'Storage', flow: Number((pumpFlow * 0.53).toFixed(1)), temperature: dist.bottom_temperature, pressure: Number((dist.pressure + 0.15).toFixed(2)) }
  };

  // Unit health flags
  const isPumpAbnormal = (pump.vibration || 0) > 0.20 || (pump.rpm || 2450) < 2000;
  const isHxAbnormal = (hx.temperature_difference || 12.9) < 5.0 || (hx.efficiency && hx.efficiency < 50.0);
  const isReactorCritical = reactor.cooling_status === 0 || (reactor.temperature || 65) > 78.0 || (reactor.pressure || 2.05) > 2.60;
  const isDistAbnormal = (dist.reflux_ratio || 1.85) < 1.1 || (dist.top_temperature || 76.5) > 80.0 || (dist.pressure || 2.10) > 2.50;

  // Stream animation speed based on flow (higher flow = faster dash animation)
  const flowSpeedSeconds = Math.max(0.6, Math.min(3.5, 15.0 / Math.max(1.0, pumpFlow)));

  const handleControlChange = async (key: string, val: number) => {
    try {
      setIsUpdating(true);
      await updateSimulatorControls({ [key]: val });
    } catch (e) {
      console.error('Failed to update control:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetControls = async () => {
    try {
      setIsUpdating(true);
      await resetSimulatorControls();
    } catch (e) {
      console.error('Failed to reset controls:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <section className="flowsheet-container" aria-label="Chemical Engineering Process Flowsheet">
      {/* 1. FLOWSHEET TOP TOOLBAR */}
      <div className="flowsheet-toolbar">
        <div className="flowsheet-title-group">
          <div className="flowsheet-tag-badge">ASPEN PFD</div>
          <div>
            <h3 className="flowsheet-main-title">
              CHEMDIAG DYNAMIC PROCESS FLOWSHEET <span className="numeric-data" style={{ color: 'var(--primary-blue)', fontSize: '0.8rem' }}>(10.0 L/min Water Train)</span>
            </h3>
            <p className="flowsheet-sub-title">
              Coupled First-Principles Flowsheet · Upstream parameter changes dynamically propagate downstream
            </p>
          </div>
        </div>

        <div className="flowsheet-toolbar-actions">
          <button
            className={`control-drawer-toggle-btn ${showControls ? 'active' : ''}`}
            onClick={() => setShowControls(!showControls)}
            title="Toggle Live Parameter Sliders"
          >
            <Sliders size={13} />
            <span>{showControls ? 'Hide Process Sliders' : 'Process Sliders'}</span>
          </button>

          <button
            className="reset-flowsheet-btn"
            onClick={handleResetControls}
            disabled={isUpdating}
            title="Reset all process variables to nominal steady state"
          >
            <RotateCcw size={12} />
            <span>Reset Steady-State</span>
          </button>
        </div>
      </div>

      {/* 2. DYNAMIC PROPAGATION BREADCRUMB BAR */}
      <div className="propagation-banner">
        <div className="propagation-label">
          <Radio size={12} color="var(--primary-blue)" className="pulse-icon" />
          <span>LIVE CAUSE & EFFECT CHAIN:</span>
        </div>
        <div className="propagation-steps">
          <span className={`prop-node ${isPumpAbnormal ? 'fault' : 'nominal'}`}>
            P-101: <strong className="numeric-data">{Math.round(pump.rpm)} RPM</strong> (<span className="numeric-data">{pumpFlow.toFixed(1)} L/min</span>)
          </span>
          <ArrowRight size={11} className="prop-arrow" />
          <span className={`prop-node ${isHxAbnormal ? 'fault' : 'nominal'}`}>
            E-101: <strong className="numeric-data">ΔT = {hx.temperature_difference.toFixed(1)} °C</strong> (<span className="numeric-data">Tout = {hx.outlet_temperature.toFixed(1)} °C</span>)
          </span>
          <ArrowRight size={11} className="prop-arrow" />
          <span className={`prop-node ${isReactorCritical ? 'critical' : 'nominal'}`}>
            R-101: <strong className="numeric-data">{reactor.temperature.toFixed(1)} °C</strong> | <strong className="numeric-data">{reactor.pressure.toFixed(2)} bar</strong> (<span className="numeric-data">Cooling: {reactor.cooling_status === 1 ? 'ON' : 'OFF'}</span>)
          </span>
          <ArrowRight size={11} className="prop-arrow" />
          <span className={`prop-node ${isDistAbnormal ? 'fault' : 'nominal'}`}>
            D-101: <strong className="numeric-data">Reflux = {dist.reflux_ratio.toFixed(2)}</strong> (<span className="numeric-data">Top T = {dist.top_temperature.toFixed(1)} °C</span>)
          </span>
        </div>
      </div>

      {/* 3. INTERACTIVE PROCESS CONTROLS DRAWER (SLIDERS) */}
      {showControls && (
        <div className="interactive-controls-panel">
          <div className="controls-panel-header">
            <span className="controls-panel-title">
              <Sliders size={13} color="var(--primary-blue)" /> INTERACTIVE PROCESS OVERRIDES (Change one variable to see downstream propagation)
            </span>
            <span className="controls-panel-hint">Calculated on Node.js backend</span>
          </div>

          <div className="controls-grid">
            {/* Slider 1: Pump RPM */}
            <div className="control-slider-card">
              <div className="control-slider-header">
                <span className="control-label">P-101 Pump Speed</span>
                <span className="control-value numeric-value">{Math.round(pump.rpm)} RPM</span>
              </div>
              <input
                type="range"
                min="1000"
                max="3000"
                step="50"
                value={Math.round(pump.rpm)}
                onChange={(e) => handleControlChange('pump_rpm', Number(e.target.value))}
                className="control-range-input"
              />
              <div className="control-range-bounds">
                <span className="numeric-data">1000 RPM (Low Flow)</span>
                <span className="numeric-data">Nominal: 2450</span>
                <span className="numeric-data">3000 RPM</span>
              </div>
            </div>

            {/* Slider 2: Heat Exchanger Efficiency */}
            <div className="control-slider-card">
              <div className="control-slider-header">
                <span className="control-label">E-101 Exchanger Efficiency</span>
                <span className="control-value numeric-value">{(hx.efficiency ?? 95.0).toFixed(0)} %</span>
              </div>
              <input
                type="range"
                min="15"
                max="100"
                step="5"
                value={Math.round(hx.efficiency ?? 95.0)}
                onChange={(e) => handleControlChange('heat_exchanger_efficiency', Number(e.target.value))}
                className="control-range-input"
              />
              <div className="control-range-bounds">
                <span className="numeric-data">15% (Fouled)</span>
                <span className="numeric-data">Nominal: 95%</span>
                <span className="numeric-data">100%</span>
              </div>
            </div>

            {/* Control 3: Reactor Cooling Switch */}
            <div className="control-slider-card">
              <div className="control-slider-header">
                <span className="control-label">R-101 Jacket Cooling</span>
                <span className={`control-status-pill ${reactor.cooling_status === 1 ? 'on' : 'off'}`}>
                  {reactor.cooling_status === 1 ? 'COOLING ON' : 'COOLING OFF (TRIPPED)'}
                </span>
              </div>
              <div className="cooling-toggle-group">
                <button
                  className={`cooling-toggle-btn ${reactor.cooling_status === 1 ? 'active-on' : ''}`}
                  onClick={() => handleControlChange('cooling_status', 1)}
                >
                  <CheckCircle2 size={12} />
                  <span>Jacket ON (65°C)</span>
                </button>
                <button
                  className={`cooling-toggle-btn ${reactor.cooling_status === 0 ? 'active-off' : ''}`}
                  onClick={() => handleControlChange('cooling_status', 0)}
                >
                  <AlertTriangle size={12} />
                  <span>Trip OFF (Runaway)</span>
                </button>
              </div>
            </div>

            {/* Slider 4: Distillation Reflux Ratio */}
            <div className="control-slider-card">
              <div className="control-slider-header">
                <span className="control-label">D-101 Reflux Ratio (L/D)</span>
                <span className="control-value numeric-value">{dist.reflux_ratio.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.40"
                max="3.00"
                step="0.05"
                value={dist.reflux_ratio}
                onChange={(e) => handleControlChange('reflux_ratio', Number(e.target.value))}
                className="control-range-input"
              />
              <div className="control-range-bounds">
                <span className="numeric-data">0.40 (Starved)</span>
                <span className="numeric-data">Nominal: 1.85</span>
                <span className="numeric-data">3.00 (High Purity)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MAIN ASPEN PFD SCHEMATIC CANVAS */}
      <div className="aspen-canvas-wrapper">
        <svg
          className="aspen-svg-canvas"
          viewBox="0 0 1120 480"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Process Flow Diagram"
        >
          {/* BACKGROUND TECHNICAL GRID */}
          <defs>
            <pattern id="millimeter-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#F1F5F9" strokeWidth="1" />
            </pattern>

            {/* Stream Arrowhead Marker */}
            <marker id="stream-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#0284C7" />
            </marker>
            <marker id="stream-arrow-reflux" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#2563EB" />
            </marker>

            {/* Drop Shadow Filter */}
            <filter id="unit-shadow" x="-8%" y="-8%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.06" />
            </filter>
          </defs>

          {/* Canvas Background Grid */}
          <rect width="100%" height="100%" fill="#FFFFFF" />
          <rect width="100%" height="100%" fill="url(#millimeter-grid)" opacity="0.8" />

          {/* ========================================================================= */}
          {/* PROCESS STREAMS (THIN LINES WITH LIVE ANIMATION & STREAM NUMBERS) */}
          {/* ========================================================================= */}

          {/* STREAM 01: Water Reservoir -> P-101 Pump */}
          <g className="process-stream-group">
            <path
              d="M 85 240 L 175 240"
              className="stream-line main-flow"
              style={{ animationDuration: `${flowSpeedSeconds}s` }}
              markerEnd="url(#stream-arrow)"
            />
          </g>

          {/* STREAM 02: P-101 Pump -> E-101 Heat Exchanger */}
          <g className="process-stream-group">
            <path
              d="M 245 240 L 375 240"
              className="stream-line main-flow"
              style={{ animationDuration: `${flowSpeedSeconds}s` }}
              markerEnd="url(#stream-arrow)"
            />
          </g>

          {/* STREAM 03: E-101 Heat Exchanger -> R-101 CSTR Reactor */}
          <g className="process-stream-group">
            <path
              d="M 485 240 L 610 240"
              className="stream-line main-flow"
              style={{ animationDuration: `${flowSpeedSeconds}s` }}
              markerEnd="url(#stream-arrow)"
            />
          </g>

          {/* STREAM 04: R-101 CSTR Reactor -> D-101 Distillation Column */}
          <g className="process-stream-group">
            <path
              d="M 725 240 L 850 240"
              className="stream-line main-flow"
              style={{ animationDuration: `${flowSpeedSeconds}s` }}
              markerEnd="url(#stream-arrow)"
            />
          </g>

          {/* STREAM 05: D-101 Overhead -> Condenser -> Top Distillate Product */}
          <g className="process-stream-group">
            <path
              d="M 920 100 L 920 55 L 1020 55"
              className="stream-line vapor-flow"
              style={{ animationDuration: `${flowSpeedSeconds * 0.9}s` }}
              markerEnd="url(#stream-arrow)"
            />
            {/* STREAM 05 REFLUX RETURN: Condenser -> Split -> D-101 Top Tray */}
            <path
              d="M 975 55 L 975 125 L 945 125"
              className="stream-line reflux-flow"
              style={{ animationDuration: `${flowSpeedSeconds * 1.1}s` }}
              markerEnd="url(#stream-arrow-reflux)"
            />
          </g>

          {/* STREAM 06: D-101 Bottom -> Bottoms Product Tank */}
          <g className="process-stream-group">
            <path
              d="M 920 375 L 920 425 L 1020 425"
              className="stream-line bottoms-flow"
              style={{ animationDuration: `${flowSpeedSeconds * 1.2}s` }}
              markerEnd="url(#stream-arrow)"
            />
          </g>

          {/* ========================================================================= */}
          {/* FLOATING STREAM TELEMETRY TAGS (Flow, Temp, Press) */}
          {/* ========================================================================= */}

          {/* TAG 01 */}
          <g transform="translate(100, 195)" className="stream-telemetry-tag">
            <rect width="68" height="38" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" filter="url(#unit-shadow)" />
            <circle cx="12" cy="12" r="7" fill="#0284C7" />
            <text x="12" y="15" fill="#FFFFFF" fontSize="8" fontWeight="800" textAnchor="middle" className="numeric-data">01</text>
            <text x="24" y="14" fill="#0F172A" fontSize="8" fontWeight="700" className="numeric-data">{streams.stream_1.flow.toFixed(1)} L/m</text>
            <text x="8" y="28" fill="#64748B" fontSize="7.5" className="numeric-data">{streams.stream_1.temperature.toFixed(1)}°C · {streams.stream_1.pressure.toFixed(2)}b</text>
          </g>

          {/* TAG 02 */}
          <g transform="translate(280, 195)" className="stream-telemetry-tag">
            <rect width="70" height="38" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" filter="url(#unit-shadow)" />
            <circle cx="12" cy="12" r="7" fill="#0284C7" />
            <text x="12" y="15" fill="#FFFFFF" fontSize="8" fontWeight="800" textAnchor="middle" className="numeric-data">02</text>
            <text x="24" y="14" fill="#0F172A" fontSize="8" fontWeight="700" className="numeric-data">{streams.stream_2.flow.toFixed(1)} L/m</text>
            <text x="8" y="28" fill="#64748B" fontSize="7.5" className="numeric-data">{streams.stream_2.temperature.toFixed(1)}°C · {streams.stream_2.pressure.toFixed(2)}b</text>
          </g>

          {/* TAG 03 */}
          <g transform="translate(518, 195)" className="stream-telemetry-tag">
            <rect width="70" height="38" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" filter="url(#unit-shadow)" />
            <circle cx="12" cy="12" r="7" fill="#0284C7" />
            <text x="12" y="15" fill="#FFFFFF" fontSize="8" fontWeight="800" textAnchor="middle" className="numeric-data">03</text>
            <text x="24" y="14" fill="#0F172A" fontSize="8" fontWeight="700" className="numeric-data">{streams.stream_3.flow.toFixed(1)} L/m</text>
            <text x="8" y="28" fill="#64748B" fontSize="7.5" className="numeric-data">{streams.stream_3.temperature.toFixed(1)}°C · {streams.stream_3.pressure.toFixed(2)}b</text>
          </g>

          {/* TAG 04 */}
          <g transform="translate(755, 195)" className="stream-telemetry-tag">
            <rect width="70" height="38" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" filter="url(#unit-shadow)" />
            <circle cx="12" cy="12" r="7" fill="#0284C7" />
            <text x="12" y="15" fill="#FFFFFF" fontSize="8" fontWeight="800" textAnchor="middle" className="numeric-data">04</text>
            <text x="24" y="14" fill="#0F172A" fontSize="8" fontWeight="700" className="numeric-data">{streams.stream_4.flow.toFixed(1)} L/m</text>
            <text x="8" y="28" fill="#64748B" fontSize="7.5" className="numeric-data">{streams.stream_4.temperature.toFixed(1)}°C · {streams.stream_4.pressure.toFixed(2)}b</text>
          </g>

          {/* TAG 05: Top Product */}
          <g transform="translate(1015, 25)" className="stream-telemetry-tag">
            <rect width="85" height="38" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" filter="url(#unit-shadow)" />
            <circle cx="12" cy="12" r="7" fill="#2563EB" />
            <text x="12" y="15" fill="#FFFFFF" fontSize="8" fontWeight="800" textAnchor="middle" className="numeric-data">05</text>
            <text x="24" y="14" fill="#0F172A" fontSize="8" fontWeight="700" className="numeric-data">Distillate: {streams.stream_5.flow.toFixed(1)}</text>
            <text x="8" y="28" fill="#64748B" fontSize="7.5" className="numeric-data">Top T: {streams.stream_5.temperature.toFixed(1)}°C · Reflux: {streams.stream_5.reflux_ratio?.toFixed(2)}</text>
          </g>

          {/* TAG 06: Bottoms Product */}
          <g transform="translate(1015, 395)" className="stream-telemetry-tag">
            <rect width="85" height="38" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" filter="url(#unit-shadow)" />
            <circle cx="12" cy="12" r="7" fill="#059669" />
            <text x="12" y="15" fill="#FFFFFF" fontSize="8" fontWeight="800" textAnchor="middle" className="numeric-data">06</text>
            <text x="24" y="14" fill="#0F172A" fontSize="8" fontWeight="700" className="numeric-data">Bottoms: {streams.stream_6.flow.toFixed(1)}</text>
            <text x="8" y="28" fill="#64748B" fontSize="7.5" className="numeric-data">Bottom T: {streams.stream_6.temperature.toFixed(1)}°C</text>
          </g>

          {/* ========================================================================= */}
          {/* UNIT 0: RAW WATER SOURCE TANK */}
          {/* ========================================================================= */}
          <g transform="translate(30, 190)" className="aspen-equipment-node">
            <rect x="0" y="0" width="55" height="100" rx="6" fill="#F8FAFC" stroke="#64748B" strokeWidth="1.5" />
            <path d="M 0 35 Q 27.5 40 55 35 L 55 100 L 0 100 Z" fill="#E0F2FE" opacity="0.6" />
            <text x="27.5" y="-6" fill="#475569" fontSize="9" fontWeight="700" textAnchor="middle">FEED TANK</text>
            <text x="27.5" y="65" fill="#0369A1" fontSize="8" fontWeight="800" textAnchor="middle">WATER</text>
            <text x="27.5" y="78" fill="#64748B" fontSize="7" textAnchor="middle" className="numeric-data">25.0 °C</text>
          </g>

          {/* ========================================================================= */}
          {/* UNIT 1: P-101 CENTRIFUGAL PUMP */}
          {/* ========================================================================= */}
          <g
            transform="translate(175, 190)"
            className={`aspen-equipment-node ${selectedEquipment === 'pump' ? 'selected' : ''}`}
            onClick={() => onSelectEquipment && onSelectEquipment('pump')}
            style={{ cursor: 'pointer' }}
          >
            {/* Selection Aura */}
            {selectedEquipment === 'pump' && (
              <circle cx="35" cy="50" r="44" fill="none" stroke="var(--primary-blue)" strokeWidth="2.5" strokeDasharray="4 2" />
            )}

            {/* Volute Pump Casing */}
            <circle cx="35" cy="50" r="32" fill="#FFFFFF" stroke={isPumpAbnormal ? '#EA580C' : '#0F172A'} strokeWidth="2" filter="url(#unit-shadow)" />
            {/* Impeller Eye */}
            <circle cx="35" cy="50" r="10" fill={isPumpAbnormal ? '#FFEDD5' : '#F1F5F9'} stroke={isPumpAbnormal ? '#EA580C' : '#475569'} strokeWidth="1.5" />
            {/* Impeller Blades */}
            <line x1="35" y1="40" x2="35" y2="60" stroke="#475569" strokeWidth="1.5" />
            <line x1="25" y1="50" x2="45" y2="50" stroke="#475569" strokeWidth="1.5" />
            {/* Motor Box */}
            <rect x="0" y="38" width="16" height="24" rx="2" fill="#F8FAFC" stroke="#475569" strokeWidth="1.2" />

            {/* Status LED dot */}
            <circle cx="60" cy="24" r="5" fill={isPumpAbnormal ? '#EA580C' : '#10B981'} />

            {/* Tag & Key Readout */}
            <text x="35" y="-8" fill="#0F172A" fontSize="10" fontWeight="800" textAnchor="middle" className="numeric-data">P-101</text>
            <text x="35" y="5" fill="#64748B" fontSize="7.5" textAnchor="middle">CENTRIFUGAL PUMP</text>
            <rect x="-10" y="94" width="90" height="34" rx="4" fill="#FFFFFF" stroke={isPumpAbnormal ? '#FDBA74' : '#E2E8F0'} strokeWidth="1" />
            <text x="35" y="107" fill="#0F172A" fontSize="8.5" fontWeight="700" textAnchor="middle" className="numeric-data">{Math.round(pump.rpm)} RPM</text>
            <text x="35" y="120" fill={pump.vibration > 0.20 ? '#DC2626' : '#64748B'} fontSize="7.5" fontWeight="600" textAnchor="middle" className="numeric-data">
              Vib: {pump.vibration.toFixed(2)} g · {pumpFlow.toFixed(1)} L/m
            </text>
          </g>

          {/* ========================================================================= */}
          {/* UNIT 2: E-101 SHELL & TUBE HEAT EXCHANGER */}
          {/* ========================================================================= */}
          <g
            transform="translate(375, 180)"
            className={`aspen-equipment-node ${selectedEquipment === 'heat_exchanger' ? 'selected' : ''}`}
            onClick={() => onSelectEquipment && onSelectEquipment('heat_exchanger')}
            style={{ cursor: 'pointer' }}
          >
            {/* Selection Aura */}
            {selectedEquipment === 'heat_exchanger' && (
              <rect x="-8" y="-4" width="126" height="128" rx="8" fill="none" stroke="var(--primary-blue)" strokeWidth="2.5" strokeDasharray="4 2" />
            )}

            {/* Shell Body */}
            <rect x="0" y="8" width="110" height="104" rx="14" fill="#FFFFFF" stroke={isHxAbnormal ? '#EA580C' : '#0F172A'} strokeWidth="2" filter="url(#unit-shadow)" />
            
            {/* Tubes / Baffles Inside */}
            <line x1="20" y1="20" x2="90" y2="20" stroke="#0284C7" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="20" y1="40" x2="90" y2="40" stroke="#0284C7" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="20" y1="60" x2="90" y2="60" stroke="#0284C7" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="20" y1="80" x2="90" y2="80" stroke="#0284C7" strokeWidth="2" strokeDasharray="3 2" />
            <line x1="20" y1="100" x2="90" y2="100" stroke="#0284C7" strokeWidth="2" strokeDasharray="3 2" />

            {/* Vertical Baffle Plates */}
            <line x1="42" y1="16" x2="42" y2="80" stroke="#94A3B8" strokeWidth="1.5" />
            <line x1="68" y1="40" x2="68" y2="104" stroke="#94A3B8" strokeWidth="1.5" />

            {/* Shell Coolant Ports */}
            <rect x="25" y="0" width="12" height="8" fill="#F1F5F9" stroke="#475569" strokeWidth="1.2" />
            <rect x="73" y="112" width="12" height="8" fill="#F1F5F9" stroke="#475569" strokeWidth="1.2" />

            {/* Status LED */}
            <circle cx="98" cy="20" r="5" fill={isHxAbnormal ? '#EA580C' : '#10B981'} />

            {/* Tag & Key Readout */}
            <text x="55" y="-8" fill="#0F172A" fontSize="10" fontWeight="800" textAnchor="middle" className="numeric-data">E-101</text>
            <text x="55" y="5" fill="#64748B" fontSize="7.5" textAnchor="middle">HEAT EXCHANGER</text>
            <rect x="5" y="124" width="100" height="34" rx="4" fill="#FFFFFF" stroke={isHxAbnormal ? '#FDBA74' : '#E2E8F0'} strokeWidth="1" />
            <text x="55" y="137" fill="#0F172A" fontSize="8.5" fontWeight="700" textAnchor="middle" className="numeric-data">ΔT: {hx.temperature_difference.toFixed(1)} °C</text>
            <text x="55" y="150" fill={hx.temperature_difference < 5 ? '#DC2626' : '#64748B'} fontSize="7.5" fontWeight="600" textAnchor="middle" className="numeric-data">
              Tout: {hx.outlet_temperature.toFixed(1)}°C · Eff: {(hx.efficiency ?? 95).toFixed(0)}%
            </text>
          </g>

          {/* ========================================================================= */}
          {/* UNIT 3: R-101 CONTINUOUS STIRRED-TANK REACTOR (CSTR) */}
          {/* ========================================================================= */}
          <g
            transform="translate(610, 160)"
            className={`aspen-equipment-node ${selectedEquipment === 'reactor' ? 'selected' : ''}`}
            onClick={() => onSelectEquipment && onSelectEquipment('reactor')}
            style={{ cursor: 'pointer' }}
          >
            {/* Selection Aura */}
            {selectedEquipment === 'reactor' && (
              <rect x="-8" y="-4" width="131" height="168" rx="8" fill="none" stroke="var(--primary-blue)" strokeWidth="2.5" strokeDasharray="4 2" />
            )}

            {/* Outer Cooling Jacket */}
            <path
              d="M 5 35 L 5 135 A 25 25 0 0 0 110 135 L 110 35"
              fill={reactor.cooling_status === 1 ? '#E0F2FE' : '#FEE2E2'}
              stroke={reactor.cooling_status === 1 ? '#38BDF8' : '#EF4444'}
              strokeWidth="2"
              strokeDasharray="4 2"
            />

            {/* Reactor Vessel Body */}
            <path
              d="M 15 25 L 15 125 A 20 20 0 0 0 100 125 L 100 25 A 20 20 0 0 0 15 25 Z"
              fill="#FFFFFF"
              stroke={isReactorCritical ? '#DC2626' : '#0F172A'}
              strokeWidth="2"
              filter="url(#unit-shadow)"
            />

            {/* Liquid Level */}
            <path
              d="M 16 75 Q 57.5 80 99 75 L 99 125 A 20 20 0 0 1 16 125 Z"
              fill={isReactorCritical ? '#FEE2E2' : '#E0E7FF'}
              opacity="0.75"
            />

            {/* Agitator Motor */}
            <rect x="47.5" y="0" width="20" height="15" rx="2" fill="#334155" stroke="#0F172A" strokeWidth="1" />
            {/* Agitator Shaft */}
            <line x1="57.5" y1="15" x2="57.5" y2="120" stroke="#334155" strokeWidth="2.5" />
            {/* Dual Rushton Turbine Impellers */}
            <rect x="35" y="70" width="45" height="5" rx="1" fill="#475569" />
            <rect x="35" y="105" width="45" height="5" rx="1" fill="#475569" />

            {/* Status LED */}
            <circle cx="95" cy="20" r="5" fill={isReactorCritical ? '#DC2626' : '#10B981'} />

            {/* Tag & Key Readout */}
            <text x="57.5" y="-8" fill="#0F172A" fontSize="10" fontWeight="800" textAnchor="middle" className="numeric-data">R-101</text>
            <text x="57.5" y="5" fill="#64748B" fontSize="7.5" textAnchor="middle">CSTR REACTOR</text>
            <rect x="5" y="164" width="105" height="34" rx="4" fill="#FFFFFF" stroke={isReactorCritical ? '#FCA5A5' : '#E2E8F0'} strokeWidth="1" />
            <text x="57.5" y="177" fill={reactor.temperature > 80 ? '#DC2626' : '#0F172A'} fontSize="8.5" fontWeight="700" textAnchor="middle" className="numeric-data">
              {reactor.temperature.toFixed(1)} °C · {reactor.pressure.toFixed(2)} bar
            </text>
            <text x="57.5" y="190" fill={reactor.cooling_status === 0 ? '#DC2626' : '#64748B'} fontSize="7.5" fontWeight="600" textAnchor="middle" className="numeric-data">
              Cooling: {reactor.cooling_status === 1 ? 'ON' : 'OFF (TRIPPED)'} · {Math.round(reactor.agitator_speed)} RPM
            </text>
          </g>

          {/* ========================================================================= */}
          {/* UNIT 4: D-101 DISTILLATION COLUMN (FRACTIONATOR) */}
          {/* ========================================================================= */}
          <g
            transform="translate(850, 90)"
            className={`aspen-equipment-node ${selectedEquipment === 'distillation' ? 'selected' : ''}`}
            onClick={() => onSelectEquipment && onSelectEquipment('distillation')}
            style={{ cursor: 'pointer' }}
          >
            {/* Selection Aura */}
            {selectedEquipment === 'distillation' && (
              <rect x="-8" y="-4" width="156" height="308" rx="8" fill="none" stroke="var(--primary-blue)" strokeWidth="2.5" strokeDasharray="4 2" />
            )}

            {/* Tall Cylindrical Column Body */}
            <rect x="35" y="20" width="70" height="260" rx="20" fill="#FFFFFF" stroke={isDistAbnormal ? '#EA580C' : '#0F172A'} strokeWidth="2" filter="url(#unit-shadow)" />

            {/* Internal Fractionation Sieve Trays */}
            <line x1="45" y1="60" x2="95" y2="60" stroke="#94A3B8" strokeWidth="2" strokeDasharray="2 2" />
            <line x1="45" y1="95" x2="95" y2="95" stroke="#94A3B8" strokeWidth="2" strokeDasharray="2 2" />
            <line x1="45" y1="130" x2="95" y2="130" stroke="#94A3B8" strokeWidth="2" strokeDasharray="2 2" />
            <line x1="45" y1="165" x2="95" y2="165" stroke="#94A3B8" strokeWidth="2" strokeDasharray="2 2" />
            <line x1="45" y1="200" x2="95" y2="200" stroke="#94A3B8" strokeWidth="2" strokeDasharray="2 2" />
            <line x1="45" y1="235" x2="95" y2="235" stroke="#94A3B8" strokeWidth="2" strokeDasharray="2 2" />

            {/* Overhead Condenser Symbol */}
            <rect x="95" y="-15" width="30" height="20" rx="3" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.2" />
            <text x="110" y="-2" fill="#0369A1" fontSize="7" fontWeight="700" textAnchor="middle">COND</text>

            {/* Status LED */}
            <circle cx="95" cy="30" r="5" fill={isDistAbnormal ? '#EA580C' : '#10B981'} />

            {/* Tag & Key Readout */}
            <text x="70" y="-8" fill="#0F172A" fontSize="10" fontWeight="800" textAnchor="middle" className="numeric-data">D-101</text>
            <text x="70" y="6" fill="#64748B" fontSize="7.5" textAnchor="middle">FRACTIONATOR</text>
            <rect x="15" y="304" width="110" height="34" rx="4" fill="#FFFFFF" stroke={isDistAbnormal ? '#FDBA74' : '#E2E8F0'} strokeWidth="1" />
            <text x="70" y="317" fill={dist.top_temperature > 78 ? '#DC2626' : '#0F172A'} fontSize="8.5" fontWeight="700" textAnchor="middle" className="numeric-data">
              Top: {dist.top_temperature.toFixed(1)} °C · Reflux: {dist.reflux_ratio.toFixed(2)}
            </text>
            <text x="70" y="330" fill="#64748B" fontSize="7.5" fontWeight="600" textAnchor="middle" className="numeric-data">
              P: {dist.pressure.toFixed(2)} bar · Bottom: {dist.bottom_temperature.toFixed(1)}°C
            </text>
          </g>

        </svg>
      </div>

      {/* 5. FLOWSHEET BOTTOM STATUS & COPILOT CTA */}
      <div className="flowsheet-footer-bar">
        <div className="flowsheet-legend">
          <span className="legend-item"><span className="legend-dot normal"></span> Nominal Flow Stream</span>
          <span className="legend-item"><span className="legend-dot warning"></span> Performance Deviation</span>
          <span className="legend-item"><span className="legend-dot critical"></span> Critical Alarm Trigger</span>
        </div>

        <div className="flowsheet-cta-group">
          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            Selected: <strong style={{ color: 'var(--primary-blue)' }}>{selectedEquipment.toUpperCase()}</strong>
          </span>
          <button
            className="ask-copilot-flow-btn"
            onClick={() => onAskAiAbout && onAskAiAbout(selectedEquipment)}
          >
            <MessageSquare size={12} />
            <span>Ask Copilot About {selectedEquipment.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default ProcessFlowsheet;
