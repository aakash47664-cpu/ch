import React, { useState, useEffect } from 'react';
import {
  ProcessUpdatePayload,
  TimeSeriesPoint,
  FaultMode
} from '../types';
import {
  updateSimulatorControls,
  resetSimulatorControls,
  resetWorkflow,
  setDemoFault
} from '../services/api';
import {
  RotateCcw,
  ArrowRight,
  Radio,
  MessageSquare,
  Sparkles,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Flame,
  Cpu,
  Layers,
  Droplets,
  Zap,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip
} from 'recharts';

interface ProcessFlowsheetProps {
  state: ProcessUpdatePayload;
  selectedEquipment?: string;
  onSelectEquipment?: (id: string) => void;
  onAskAiAbout?: (id: string) => void;
  timeSeries?: TimeSeriesPoint[];
  onSelectFault?: (fault: FaultMode) => void;
}

export const ProcessFlowsheet: React.FC<ProcessFlowsheetProps> = ({
  state,
  selectedEquipment = 'pump',
  onSelectEquipment,
  onAskAiAbout,
  timeSeries = [],
  onSelectFault
}) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    title: string;
    text: string;
    warn?: boolean;
  } | null>(null);

  // Local simulation control states
  const [pumpRpm, setPumpRpm] = useState<number>(state.equipment?.pump?.data?.rpm || 2450);
  const [hxEffic, setHxEffic] = useState<number>(state.equipment?.heat_exchanger?.data?.efficiency || 95.0);
  const [coolingStatus, setCoolingStatus] = useState<number>(state.equipment?.reactor?.data?.cooling_status ?? 1);
  const [agitatorSpeed, setAgitatorSpeed] = useState<number>(state.equipment?.reactor?.data?.agitator_speed || 350);
  const [refluxRatio, setRefluxRatio] = useState<number>(state.equipment?.distillation?.data?.reflux_ratio || 1.85);

  // Sync sliders from backend unless updating
  useEffect(() => {
    if (!isUpdating) {
      if (state.equipment?.pump?.data?.rpm) setPumpRpm(Math.round(state.equipment.pump.data.rpm));
      if (state.equipment?.heat_exchanger?.data?.efficiency) setHxEffic(Math.round(state.equipment.heat_exchanger.data.efficiency));
      if (state.equipment?.reactor?.data?.cooling_status !== undefined) setCoolingStatus(state.equipment.reactor.data.cooling_status);
      if (state.equipment?.reactor?.data?.agitator_speed) setAgitatorSpeed(Math.round(state.equipment.reactor.data.agitator_speed));
      if (state.equipment?.distillation?.data?.reflux_ratio) setRefluxRatio(Number(state.equipment.distillation.data.reflux_ratio.toFixed(2)));
    }
  }, [state.equipment, isUpdating]);

  // Extract equipment data safely
  const pump = state.equipment.pump.data;
  const hx = state.equipment.heat_exchanger.data;
  const reactor = state.equipment.reactor.data;
  const dist = state.equipment.distillation.data;

  // Real-time flow from pump or default
  const pumpFlow = pump.flow ?? Number(((pump.rpm / 2450) * 10.0).toFixed(1));

  // Default fallback streams if not yet received from backend
  const streams = state.streams || {
    stream_1: { id: '01', name: 'Raw Water Source Feed', from: 'Feed Tank', to: 'P-101', flow: pumpFlow, temperature: 25.0, pressure: 1.01 },
    stream_2: { id: '02', name: 'Pump Discharge Train', from: 'P-101', to: 'E-101', flow: Number((pumpFlow * 0.99).toFixed(1)), temperature: pump.outlet_temperature || 25.2, pressure: pump.pressure ?? 2.80 },
    stream_3: { id: '03', name: 'Exchanger Effluent', from: 'E-101', to: 'R-101', flow: Number((pumpFlow * 0.98).toFixed(1)), temperature: hx.outlet_temperature || 38.1, pressure: 2.45 },
    stream_4: { id: '04', name: 'Reactor Effluent', from: 'R-101', to: 'D-101', flow: Number((pumpFlow * 0.97).toFixed(1)), temperature: reactor.temperature || 65.0, pressure: reactor.pressure || 2.05 },
    stream_5: { id: '05', name: 'Top Distillate Product', from: 'D-101', to: 'Top Product Receiver', flow: Number((pumpFlow * 0.45).toFixed(1)), temperature: dist.top_temperature || 76.5, pressure: dist.pressure || 2.10, reflux_ratio: dist.reflux_ratio || 1.85, reflux_flow: Number((pumpFlow * 0.45 * (dist.reflux_ratio || 1.85)).toFixed(1)) },
    stream_6: { id: '06', name: 'Bottoms Product', from: 'D-101', to: 'Bottom Storage Tank', flow: Number((pumpFlow * 0.53).toFixed(1)), temperature: dist.bottom_temperature || 98.4, pressure: Number(((dist.pressure || 2.10) + 0.15).toFixed(2)) }
  };

  // Unit health & abnormal conditions
  const isPumpAbnormal = (pump.vibration || 0) > 0.20 || (pump.rpm || 2450) < 2000;
  const isHxAbnormal = (hx.temperature_difference || 12.9) < 5.0 || ((hx.efficiency ?? 95) < 50.0);
  const isReactorCritical = reactor.cooling_status === 0 || (reactor.temperature || 65) > 78.0 || (reactor.pressure || 2.05) > 2.60;
  const isDistAbnormal = (dist.reflux_ratio || 1.85) < 1.1 || (dist.top_temperature || 76.5) > 80.0 || (dist.pressure || 2.10) > 2.50;

  // Stream animation speed based on flow rate (higher flow = faster dash animation, zero flow = stopped)
  const calculateStreamDuration = (flowRate: number): number => {
    if (flowRate <= 0.05) return 0;
    return Math.max(0.4, Math.min(4.5, 15.0 / Math.max(0.2, flowRate)));
  };

  const durStream1 = calculateStreamDuration(streams.stream_1.flow);
  const durStream2 = calculateStreamDuration(streams.stream_2.flow);
  const durStream3 = calculateStreamDuration(streams.stream_3.flow);
  const durStream4 = calculateStreamDuration(streams.stream_4.flow);
  const durStream5 = calculateStreamDuration(streams.stream_5.flow);
  const durReflux = calculateStreamDuration(streams.stream_5.reflux_flow ?? (streams.stream_5.flow * 1.5));
  const durStream6 = calculateStreamDuration(streams.stream_6.flow);

  // Dispatch What-If simulation changes to backend process graph
  const handleApplyControl = async (newControls: {
    pump_rpm?: number;
    heat_exchanger_efficiency?: number;
    cooling_status?: number;
    reflux_ratio?: number;
    agitator_speed?: number;
  }) => {
    try {
      setIsUpdating(true);
      if (newControls.pump_rpm !== undefined) {
        setFeedbackMsg({
          title: 'PROCESS CHANGE: P-101 RPM',
          text: `${Math.round(pump.rpm)} → ${newControls.pump_rpm} RPM. Recalculating flows...`
        });
      } else if (newControls.heat_exchanger_efficiency !== undefined) {
        setFeedbackMsg({
          title: 'PROCESS CHANGE: E-101 EFFICIENCY',
          text: `Thermal transfer efficiency set to ${newControls.heat_exchanger_efficiency}%. Recalculating ΔT...`
        });
      } else if (newControls.cooling_status !== undefined) {
        setFeedbackMsg({
          title: 'PROCESS CHANGE: R-101 COOLING',
          text: `Reactor jacket cooling toggled to ${newControls.cooling_status === 1 ? 'ON (ACTIVE)' : 'OFF (TRIPPED)'}.`,
          warn: newControls.cooling_status === 0
        });
      } else if (newControls.reflux_ratio !== undefined) {
        setFeedbackMsg({
          title: 'PROCESS CHANGE: D-101 REFLUX',
          text: `Reflux ratio adjusted to ${newControls.reflux_ratio.toFixed(2)}. Updating vapor-liquid equilibrium...`
        });
      } else if (newControls.agitator_speed !== undefined) {
        setFeedbackMsg({
          title: 'PROCESS CHANGE: R-101 AGITATOR',
          text: `Agitator speed adjusted to ${newControls.agitator_speed} RPM.`
        });
      }

      await updateSimulatorControls(newControls);

      setTimeout(() => {
        setFeedbackMsg({
          title: 'DOWNSTREAM RESPONSE PROPAGATING',
          text: 'P-101 flow adjusted · E-101 updated · R-101 feed updated · D-101 boil-up responding'
        });
      }, 500);

      setTimeout(() => {
        setFeedbackMsg(null);
      }, 3500);
    } catch (e) {
      console.error('Failed to update process controls:', e);
      setFeedbackMsg({
        title: 'CONTROL ERROR',
        text: 'Failed to update backend model.',
        warn: true
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Reset entire process simulation to nominal steady-state
  const handleResetControls = async () => {
    try {
      setIsUpdating(true);
      await resetSimulatorControls();
      await resetWorkflow('Plant Operator');
      setPumpRpm(2450);
      setHxEffic(95);
      setCoolingStatus(1);
      setAgitatorSpeed(350);
      setRefluxRatio(1.85);

      setFeedbackMsg({
        title: 'PROCESS RESET TO STEADY-STATE',
        text: 'All hydraulic, thermal, and reaction nodes restored to 2450 RPM nominal conditions.'
      });

      setTimeout(() => {
        setFeedbackMsg(null);
      }, 3000);
    } catch (e) {
      console.error('Failed to reset process controls:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  // Trigger unit-specific degradation fault
  const handleInjectFaultForUnit = async (unitKey: string) => {
    let fault: FaultMode = 'early_pump_degradation';
    if (unitKey === 'pump') fault = 'early_pump_degradation';
    else if (unitKey === 'heat_exchanger') fault = 'early_heat_exchanger_fouling';
    else if (unitKey === 'reactor') fault = 'early_reactor_cooling_degradation';
    else if (unitKey === 'distillation') fault = 'early_distillation_reflux_loss';

    if (onSelectFault) {
      onSelectFault(fault);
    } else {
      await setDemoFault(fault);
    }

    setFeedbackMsg({
      title: 'FAULT SIMULATION INJECTED',
      text: `Simulating early degradation for ${unitKey.toUpperCase().replace('_', ' ')}. Causal propagation active.`,
      warn: true
    });

    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  // Helper to select an equipment or stream and notify parent
  const handleSelect = (id: string) => {
    if (onSelectEquipment) {
      onSelectEquipment(id);
    }
  };

  // Determine active unit details for the inspector panel
  const isStream = selectedEquipment.startsWith('stream_');
  const isTank = selectedEquipment === 'feed_tank' || selectedEquipment === 'top_product' || selectedEquipment === 'bottom_product';

  return (
    <section className="flowsheet-container" aria-label="Chemical Engineering Process Flowsheet">
      {/* 1. FLOWSHEET TOP TOOLBAR */}
      <div className="flowsheet-toolbar">
        <div className="flowsheet-title-group">
          <div className="flowsheet-tag-badge">ASPEN PFD</div>
          <div>
            <h3 className="flowsheet-main-title">
              CHEMDIAG DYNAMIC PROCESS FLOWSHEET <span className="numeric-data" style={{ color: 'var(--primary-blue)', fontSize: '0.8rem' }}>({pumpFlow.toFixed(1)} L/min Water Train)</span>
            </h3>
            <p className="flowsheet-sub-title">
              Coupled First-Principles Flowsheet · Upstream parameter changes dynamically propagate downstream · Interactive PFD
            </p>
          </div>
        </div>

        <div className="flowsheet-toolbar-actions">
          <button
            className="reset-flowsheet-btn"
            onClick={handleResetControls}
            disabled={isUpdating}
            title="Reset all process variables to nominal steady state"
          >
            <RotateCcw size={12} />
            <span>Reset Process</span>
          </button>
        </div>
      </div>

      {/* 2. DYNAMIC PROPAGATION BREADCRUMB BAR (CLICKABLE NODES) */}
      <div className="propagation-banner">
        <div className="propagation-label">
          <Radio size={12} color="var(--primary-blue)" className="pulse-icon" />
          <span>LIVE CAUSE & EFFECT CHAIN:</span>
        </div>
        <div className="propagation-steps">
          <span
            className={`prop-node clickable ${selectedEquipment === 'pump' ? 'active-selected' : ''} ${isPumpAbnormal ? 'fault' : 'nominal'}`}
            onClick={() => handleSelect('pump')}
            title="Click to inspect P-101 Centrifugal Pump"
          >
            P-101: <strong className="numeric-data">{Math.round(pump.rpm)} RPM</strong> (<span className="numeric-data">{pumpFlow.toFixed(1)} L/min</span>)
          </span>
          <ArrowRight size={11} className="prop-arrow" />
          <span
            className={`prop-node clickable ${selectedEquipment === 'heat_exchanger' ? 'active-selected' : ''} ${isHxAbnormal ? 'fault' : 'nominal'}`}
            onClick={() => handleSelect('heat_exchanger')}
            title="Click to inspect E-101 Heat Exchanger"
          >
            E-101: <strong className="numeric-data">ΔT = {hx.temperature_difference.toFixed(1)} °C</strong> (<span className="numeric-data">Tout = {hx.outlet_temperature.toFixed(1)} °C</span>)
          </span>
          <ArrowRight size={11} className="prop-arrow" />
          <span
            className={`prop-node clickable ${selectedEquipment === 'reactor' ? 'active-selected' : ''} ${isReactorCritical ? 'critical' : 'nominal'}`}
            onClick={() => handleSelect('reactor')}
            title="Click to inspect R-101 CSTR Reactor"
          >
            R-101: <strong className="numeric-data">{reactor.temperature.toFixed(1)} °C</strong> | <strong className="numeric-data">{reactor.pressure.toFixed(2)} bar</strong> (<span className="numeric-data">Cooling: {reactor.cooling_status === 1 ? 'ON' : 'OFF'}</span>)
          </span>
          <ArrowRight size={11} className="prop-arrow" />
          <span
            className={`prop-node clickable ${selectedEquipment === 'distillation' ? 'active-selected' : ''} ${isDistAbnormal ? 'fault' : 'nominal'}`}
            onClick={() => handleSelect('distillation')}
            title="Click to inspect D-101 Distillation Column"
          >
            D-101: <strong className="numeric-data">Reflux = {dist.reflux_ratio.toFixed(2)}</strong> (<span className="numeric-data">Top T = {dist.top_temperature.toFixed(1)} °C</span>)
          </span>
        </div>
      </div>

      {/* 3. REAL-TIME INTERACTION FEEDBACK BANNER */}
      {feedbackMsg && (
        <div className={`pfd-feedback-banner ${feedbackMsg.warn ? 'warn' : ''}`}>
          <div className="pfd-feedback-left">
            <span className="pfd-feedback-badge">{feedbackMsg.title}</span>
            <span>{feedbackMsg.text}</span>
          </div>
          <Sparkles size={13} />
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
          {/* BACKGROUND TECHNICAL GRID & DEFS */}
          <defs>
            <pattern id="millimeter-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#F1F5F9" strokeWidth="1" />
            </pattern>

            {/* Stream Arrowhead Markers */}
            <marker id="stream-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#0284C7" />
            </marker>
            <marker id="stream-arrow-reflux" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#2563EB" />
            </marker>
            <marker id="stream-arrow-bottoms" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#059669" />
            </marker>

            {/* Drop Shadow Filter */}
            <filter id="unit-shadow" x="-8%" y="-8%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.06" />
            </filter>
            <filter id="pfd-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Canvas Background Grid */}
          <rect width="100%" height="100%" fill="#FFFFFF" />
          <rect width="100%" height="100%" fill="url(#millimeter-grid)" opacity="0.8" />

          {/* ========================================================================= */}
          {/* PROCESS STREAMS (CLICKABLE WITH DYNAMIC SPEED PROPORTIONAL TO FLOW Q) */}
          {/* ========================================================================= */}

          {/* STREAM 01: Water Reservoir -> P-101 Pump */}
          <g
            className={`process-stream-group ${selectedEquipment === 'stream_1' ? 'selected' : ''}`}
            onClick={() => handleSelect('stream_1')}
          >
            <title>Stream 01: Raw Water Supply Feed ({streams.stream_1.flow.toFixed(1)} L/min) - Click to inspect</title>
            {/* Transparent wide hit area for effortless clicking */}
            <path d="M 85 240 L 175 240" stroke="transparent" strokeWidth="18" fill="none" />
            {selectedEquipment === 'stream_1' && (
              <path d="M 85 240 L 175 240" stroke="#93C5FD" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.6" />
            )}
            <path
              d="M 85 240 L 175 240"
              className="stream-line main-flow"
              style={{
                animationDuration: `${durStream1}s`,
                animationPlayState: durStream1 === 0 ? 'paused' : 'running'
              }}
              markerEnd="url(#stream-arrow)"
            />
          </g>

          {/* STREAM 02: P-101 Pump -> E-101 Heat Exchanger */}
          <g
            className={`process-stream-group ${selectedEquipment === 'stream_2' ? 'selected' : ''}`}
            onClick={() => handleSelect('stream_2')}
          >
            <title>Stream 02: Pump Discharge Line ({streams.stream_2.flow.toFixed(1)} L/min) - Click to inspect</title>
            <path d="M 245 240 L 375 240" stroke="transparent" strokeWidth="18" fill="none" />
            {selectedEquipment === 'stream_2' && (
              <path d="M 245 240 L 375 240" stroke="#93C5FD" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.6" />
            )}
            <path
              d="M 245 240 L 375 240"
              className="stream-line main-flow"
              style={{
                animationDuration: `${durStream2}s`,
                animationPlayState: durStream2 === 0 ? 'paused' : 'running'
              }}
              markerEnd="url(#stream-arrow)"
            />
          </g>

          {/* STREAM 03: E-101 Heat Exchanger -> R-101 CSTR Reactor */}
          <g
            className={`process-stream-group ${selectedEquipment === 'stream_3' ? 'selected' : ''}`}
            onClick={() => handleSelect('stream_3')}
          >
            <title>Stream 03: Heat Exchanger Effluent ({streams.stream_3.flow.toFixed(1)} L/min) - Click to inspect</title>
            <path d="M 485 240 L 610 240" stroke="transparent" strokeWidth="18" fill="none" />
            {selectedEquipment === 'stream_3' && (
              <path d="M 485 240 L 610 240" stroke="#93C5FD" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.6" />
            )}
            <path
              d="M 485 240 L 610 240"
              className="stream-line main-flow"
              style={{
                animationDuration: `${durStream3}s`,
                animationPlayState: durStream3 === 0 ? 'paused' : 'running'
              }}
              markerEnd="url(#stream-arrow)"
            />
          </g>

          {/* STREAM 04: R-101 CSTR Reactor -> D-101 Distillation Column */}
          <g
            className={`process-stream-group ${selectedEquipment === 'stream_4' ? 'selected' : ''}`}
            onClick={() => handleSelect('stream_4')}
          >
            <title>Stream 04: Reactor Effluent Line ({streams.stream_4.flow.toFixed(1)} L/min) - Click to inspect</title>
            <path d="M 725 240 L 850 240" stroke="transparent" strokeWidth="18" fill="none" />
            {selectedEquipment === 'stream_4' && (
              <path d="M 725 240 L 850 240" stroke="#93C5FD" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.6" />
            )}
            <path
              d="M 725 240 L 850 240"
              className="stream-line main-flow"
              style={{
                animationDuration: `${durStream4}s`,
                animationPlayState: durStream4 === 0 ? 'paused' : 'running'
              }}
              markerEnd="url(#stream-arrow)"
            />
          </g>

          {/* STREAM 05: D-101 Overhead -> Condenser -> Top Distillate Product */}
          <g
            className={`process-stream-group ${selectedEquipment === 'stream_5' ? 'selected' : ''}`}
            onClick={() => handleSelect('stream_5')}
          >
            <title>Stream 05: Distillate Vapor & Reflux Loop ({streams.stream_5.flow.toFixed(1)} L/min) - Click to inspect</title>
            <path d="M 920 100 L 920 55 L 1020 55" stroke="transparent" strokeWidth="18" fill="none" />
            <path d="M 975 55 L 975 125 L 945 125" stroke="transparent" strokeWidth="18" fill="none" />
            {selectedEquipment === 'stream_5' && (
              <>
                <path d="M 920 100 L 920 55 L 1020 55" stroke="#93C5FD" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.6" />
                <path d="M 975 55 L 975 125 L 945 125" stroke="#93C5FD" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.6" />
              </>
            )}
            <path
              d="M 920 100 L 920 55 L 1020 55"
              className="stream-line vapor-flow"
              style={{
                animationDuration: `${durStream5}s`,
                animationPlayState: durStream5 === 0 ? 'paused' : 'running'
              }}
              markerEnd="url(#stream-arrow)"
            />
            {/* STREAM 05 REFLUX RETURN */}
            <path
              d="M 975 55 L 975 125 L 945 125"
              className="stream-line reflux-flow"
              style={{
                animationDuration: `${durReflux}s`,
                animationPlayState: durReflux === 0 ? 'paused' : 'running'
              }}
              markerEnd="url(#stream-arrow-reflux)"
            />
          </g>

          {/* STREAM 06: D-101 Bottom -> Bottoms Product Tank */}
          <g
            className={`process-stream-group ${selectedEquipment === 'stream_6' ? 'selected' : ''}`}
            onClick={() => handleSelect('stream_6')}
          >
            <title>Stream 06: Heavy Bottoms Fraction ({streams.stream_6.flow.toFixed(1)} L/min) - Click to inspect</title>
            <path d="M 920 375 L 920 425 L 1020 425" stroke="transparent" strokeWidth="18" fill="none" />
            {selectedEquipment === 'stream_6' && (
              <path d="M 920 375 L 920 425 L 1020 425" stroke="#86EFAC" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.6" />
            )}
            <path
              d="M 920 375 L 920 425 L 1020 425"
              className="stream-line bottoms-flow"
              style={{
                animationDuration: `${durStream6}s`,
                animationPlayState: durStream6 === 0 ? 'paused' : 'running'
              }}
              markerEnd="url(#stream-arrow-bottoms)"
            />
          </g>

          {/* ========================================================================= */}
          {/* FLOATING STREAM TELEMETRY TAGS (CLICKABLE WITH HOVER HIGHLIGHTS) */}
          {/* ========================================================================= */}

          {/* TAG 01 */}
          <g
            transform="translate(100, 195)"
            className={`stream-telemetry-tag ${selectedEquipment === 'stream_1' ? 'selected' : ''}`}
            onClick={() => handleSelect('stream_1')}
          >
            <title>Click to inspect Stream 01 (Source Feed)</title>
            <rect width="68" height="38" rx="4" fill="#FFFFFF" stroke={selectedEquipment === 'stream_1' ? '#2563EB' : '#CBD5E1'} strokeWidth={selectedEquipment === 'stream_1' ? 2 : 1} filter="url(#unit-shadow)" />
            <circle cx="12" cy="12" r="7" fill="#0284C7" />
            <text x="12" y="15" fill="#FFFFFF" fontSize="8" fontWeight="800" textAnchor="middle" className="numeric-data">01</text>
            <text x="24" y="14" fill="#0F172A" fontSize="8" fontWeight="700" className="numeric-data">{streams.stream_1.flow.toFixed(1)} L/m</text>
            <text x="8" y="28" fill="#64748B" fontSize="7.5" className="numeric-data">{streams.stream_1.temperature.toFixed(1)}°C · {streams.stream_1.pressure.toFixed(2)}b</text>
          </g>

          {/* TAG 02 */}
          <g
            transform="translate(280, 195)"
            className={`stream-telemetry-tag ${selectedEquipment === 'stream_2' ? 'selected' : ''}`}
            onClick={() => handleSelect('stream_2')}
          >
            <title>Click to inspect Stream 02 (Pump Discharge)</title>
            <rect width="70" height="38" rx="4" fill="#FFFFFF" stroke={selectedEquipment === 'stream_2' ? '#2563EB' : '#CBD5E1'} strokeWidth={selectedEquipment === 'stream_2' ? 2 : 1} filter="url(#unit-shadow)" />
            <circle cx="12" cy="12" r="7" fill="#0284C7" />
            <text x="12" y="15" fill="#FFFFFF" fontSize="8" fontWeight="800" textAnchor="middle" className="numeric-data">02</text>
            <text x="24" y="14" fill="#0F172A" fontSize="8" fontWeight="700" className="numeric-data">{streams.stream_2.flow.toFixed(1)} L/m</text>
            <text x="8" y="28" fill="#64748B" fontSize="7.5" className="numeric-data">{streams.stream_2.temperature.toFixed(1)}°C · {streams.stream_2.pressure.toFixed(2)}b</text>
          </g>

          {/* TAG 03 */}
          <g
            transform="translate(518, 195)"
            className={`stream-telemetry-tag ${selectedEquipment === 'stream_3' ? 'selected' : ''}`}
            onClick={() => handleSelect('stream_3')}
          >
            <title>Click to inspect Stream 03 (Exchanger Effluent)</title>
            <rect width="70" height="38" rx="4" fill="#FFFFFF" stroke={selectedEquipment === 'stream_3' ? '#2563EB' : '#CBD5E1'} strokeWidth={selectedEquipment === 'stream_3' ? 2 : 1} filter="url(#unit-shadow)" />
            <circle cx="12" cy="12" r="7" fill="#0284C7" />
            <text x="12" y="15" fill="#FFFFFF" fontSize="8" fontWeight="800" textAnchor="middle" className="numeric-data">03</text>
            <text x="24" y="14" fill="#0F172A" fontSize="8" fontWeight="700" className="numeric-data">{streams.stream_3.flow.toFixed(1)} L/m</text>
            <text x="8" y="28" fill="#64748B" fontSize="7.5" className="numeric-data">{streams.stream_3.temperature.toFixed(1)}°C · {streams.stream_3.pressure.toFixed(2)}b</text>
          </g>

          {/* TAG 04 */}
          <g
            transform="translate(755, 195)"
            className={`stream-telemetry-tag ${selectedEquipment === 'stream_4' ? 'selected' : ''}`}
            onClick={() => handleSelect('stream_4')}
          >
            <title>Click to inspect Stream 04 (Reactor Effluent)</title>
            <rect width="70" height="38" rx="4" fill="#FFFFFF" stroke={selectedEquipment === 'stream_4' ? '#2563EB' : '#CBD5E1'} strokeWidth={selectedEquipment === 'stream_4' ? 2 : 1} filter="url(#unit-shadow)" />
            <circle cx="12" cy="12" r="7" fill="#0284C7" />
            <text x="12" y="15" fill="#FFFFFF" fontSize="8" fontWeight="800" textAnchor="middle" className="numeric-data">04</text>
            <text x="24" y="14" fill="#0F172A" fontSize="8" fontWeight="700" className="numeric-data">{streams.stream_4.flow.toFixed(1)} L/m</text>
            <text x="8" y="28" fill="#64748B" fontSize="7.5" className="numeric-data">{streams.stream_4.temperature.toFixed(1)}°C · {streams.stream_4.pressure.toFixed(2)}b</text>
          </g>

          {/* TAG 05: Top Product */}
          <g
            transform="translate(1015, 25)"
            className={`stream-telemetry-tag ${selectedEquipment === 'stream_5' || selectedEquipment === 'top_product' ? 'selected' : ''}`}
            onClick={() => handleSelect('top_product')}
          >
            <title>Click to inspect Top Distillate Product Tank</title>
            <rect width="85" height="38" rx="4" fill="#FFFFFF" stroke={selectedEquipment === 'top_product' || selectedEquipment === 'stream_5' ? '#2563EB' : '#CBD5E1'} strokeWidth={selectedEquipment === 'top_product' || selectedEquipment === 'stream_5' ? 2 : 1} filter="url(#unit-shadow)" />
            <circle cx="12" cy="12" r="7" fill="#2563EB" />
            <text x="12" y="15" fill="#FFFFFF" fontSize="8" fontWeight="800" textAnchor="middle" className="numeric-data">05</text>
            <text x="24" y="14" fill="#0F172A" fontSize="8" fontWeight="700" className="numeric-data">Distillate: {streams.stream_5.flow.toFixed(1)}</text>
            <text x="8" y="28" fill="#64748B" fontSize="7.5" className="numeric-data">Top T: {streams.stream_5.temperature.toFixed(1)}°C · R: {streams.stream_5.reflux_ratio?.toFixed(2)}</text>
          </g>

          {/* TAG 06: Bottoms Product */}
          <g
            transform="translate(1015, 395)"
            className={`stream-telemetry-tag ${selectedEquipment === 'stream_6' || selectedEquipment === 'bottom_product' ? 'selected' : ''}`}
            onClick={() => handleSelect('bottom_product')}
          >
            <title>Click to inspect Bottoms Storage Tank</title>
            <rect width="85" height="38" rx="4" fill="#FFFFFF" stroke={selectedEquipment === 'bottom_product' || selectedEquipment === 'stream_6' ? '#059669' : '#CBD5E1'} strokeWidth={selectedEquipment === 'bottom_product' || selectedEquipment === 'stream_6' ? 2 : 1} filter="url(#unit-shadow)" />
            <circle cx="12" cy="12" r="7" fill="#059669" />
            <text x="12" y="15" fill="#FFFFFF" fontSize="8" fontWeight="800" textAnchor="middle" className="numeric-data">06</text>
            <text x="24" y="14" fill="#0F172A" fontSize="8" fontWeight="700" className="numeric-data">Bottoms: {streams.stream_6.flow.toFixed(1)}</text>
            <text x="8" y="28" fill="#64748B" fontSize="7.5" className="numeric-data">Bottom T: {streams.stream_6.temperature.toFixed(1)}°C</text>
          </g>

          {/* ========================================================================= */}
          {/* UNIT 0: RAW WATER FEED TANK */}
          {/* ========================================================================= */}
          <g
            transform="translate(30, 190)"
            className={`aspen-equipment-node ${selectedEquipment === 'feed_tank' ? 'selected' : ''}`}
            onClick={() => handleSelect('feed_tank')}
          >
            <title>Feed Tank (Raw Water Reservoir) - Click to inspect</title>
            {/* Selection Aura */}
            {selectedEquipment === 'feed_tank' && (
              <rect x="-4" y="-4" width="63" height="108" rx="8" fill="none" stroke="var(--primary-blue)" strokeWidth="2.5" strokeDasharray="4 2" />
            )}

            <rect x="0" y="0" width="55" height="100" rx="6" fill="#F8FAFC" stroke="#64748B" strokeWidth="1.5" filter="url(#unit-shadow)" />
            <path d="M 0 35 Q 27.5 40 55 35 L 55 100 L 0 100 Z" fill="#E0F2FE" opacity="0.6" />
            <text x="27.5" y="-6" fill="#475569" fontSize="9" fontWeight="700" textAnchor="middle">FEED TANK</text>
            <text x="27.5" y="65" fill="#0369A1" fontSize="8" fontWeight="800" textAnchor="middle">WATER</text>
            <text x="27.5" y="78" fill="#64748B" fontSize="7" textAnchor="middle" className="numeric-data">25.0 °C</text>
          </g>

          {/* ========================================================================= */}
          {/* UNIT 1: P-101 CENTRIFUGAL FEED PUMP */}
          {/* ========================================================================= */}
          <g
            transform="translate(175, 190)"
            className={`aspen-equipment-node ${selectedEquipment === 'pump' ? 'selected' : ''}`}
            onClick={() => handleSelect('pump')}
          >
            <title>P-101 Centrifugal Feed Pump - Click to inspect & change simulation</title>
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
            onClick={() => handleSelect('heat_exchanger')}
          >
            <title>E-101 Shell & Tube Heat Exchanger - Click to inspect & change simulation</title>
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
            onClick={() => handleSelect('reactor')}
          >
            <title>R-101 CSTR Reactor - Click to inspect & change simulation</title>
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
            onClick={() => handleSelect('distillation')}
          >
            <title>D-101 Distillation Column - Click to inspect & change simulation</title>
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

          {/* ========================================================================= */}
          {/* PRODUCT STORAGE TANKS (TOP & BOTTOM PRODUCTS) */}
          {/* ========================================================================= */}
          {/* Top Distillate Product Receiver Tank Symbol */}
          <g
            transform="translate(1020, 40)"
            className={`aspen-equipment-node ${selectedEquipment === 'top_product' ? 'selected' : ''}`}
            onClick={() => handleSelect('top_product')}
          >
            <title>Top Distillate Product Tank - Click to inspect</title>
            <rect x="0" y="0" width="45" height="40" rx="4" fill="#F8FAFC" stroke="#2563EB" strokeWidth="1.5" filter="url(#unit-shadow)" />
            <path d="M 0 15 Q 22.5 18 45 15 L 45 40 L 0 40 Z" fill="#DBEAFE" opacity="0.7" />
            <text x="22.5" y="28" fill="#1E40AF" fontSize="6.5" fontWeight="800" textAnchor="middle">DISTILLATE</text>
          </g>

          {/* Bottoms Product Storage Tank Symbol */}
          <g
            transform="translate(1020, 410)"
            className={`aspen-equipment-node ${selectedEquipment === 'bottom_product' ? 'selected' : ''}`}
            onClick={() => handleSelect('bottom_product')}
          >
            <title>Bottoms Storage Tank - Click to inspect</title>
            <rect x="0" y="0" width="45" height="40" rx="4" fill="#F8FAFC" stroke="#059669" strokeWidth="1.5" filter="url(#unit-shadow)" />
            <path d="M 0 15 Q 22.5 18 45 15 L 45 40 L 0 40 Z" fill="#D1FAE5" opacity="0.7" />
            <text x="22.5" y="28" fill="#065F46" fontSize="6.5" fontWeight="800" textAnchor="middle">BOTTOMS</text>
          </g>

        </svg>
      </div>

      {/* ========================================================================= */}
      {/* 5. COMPACT INTEGRATED EQUIPMENT / STREAM DETAIL INSPECTOR */}
      {/* ========================================================================= */}
      <div className="pfd-inspector-container">
        {/* INSPECTOR HEADER */}
        <div className="pfd-inspector-header">
          <div className="pfd-inspector-identity">
            <span className="pfd-inspector-tag">
              {selectedEquipment === 'pump' && 'P-101'}
              {selectedEquipment === 'heat_exchanger' && 'E-101'}
              {selectedEquipment === 'reactor' && 'R-101'}
              {selectedEquipment === 'distillation' && 'D-101'}
              {selectedEquipment === 'feed_tank' && 'T-100'}
              {selectedEquipment === 'top_product' && 'T-105'}
              {selectedEquipment === 'bottom_product' && 'T-106'}
              {isStream && `STR-${selectedEquipment.replace('stream_', '0')}`}
            </span>
            <div>
              <h4 className="pfd-inspector-title">
                {selectedEquipment === 'pump' && 'P-101 — CENTRIFUGAL FEED PUMP'}
                {selectedEquipment === 'heat_exchanger' && 'E-101 — SHELL & TUBE HEAT EXCHANGER'}
                {selectedEquipment === 'reactor' && 'R-101 — CONTINUOUS STIRRED-TANK REACTOR (CSTR)'}
                {selectedEquipment === 'distillation' && 'D-101 — BINARY FRACTIONATION COLUMN'}
                {selectedEquipment === 'feed_tank' && 'FEED TANK — RAW WATER MAKEUP RESERVOIR'}
                {selectedEquipment === 'top_product' && 'TOP DISTILLATE PRODUCT — OVERHEAD RECEIVER'}
                {selectedEquipment === 'bottom_product' && 'BOTTOMS PRODUCT — HEAVY FRACTION STORAGE'}
                {selectedEquipment === 'stream_1' && 'PROCESS STREAM 01 — RAW WATER INLET FEED'}
                {selectedEquipment === 'stream_2' && 'PROCESS STREAM 02 — P-101 PUMP DISCHARGE'}
                {selectedEquipment === 'stream_3' && 'PROCESS STREAM 03 — E-101 EXCHANGER EFFLUENT'}
                {selectedEquipment === 'stream_4' && 'PROCESS STREAM 04 — R-101 REACTOR EFFLUENT'}
                {selectedEquipment === 'stream_5' && 'PROCESS STREAM 05 — D-101 OVERHEAD & REFLUX'}
                {selectedEquipment === 'stream_6' && 'PROCESS STREAM 06 — D-101 BOTTOMS DISCHARGE'}
              </h4>
              <p className="pfd-inspector-subtitle">
                {isStream ? 'Interactive Hydraulic Interconnect Stream' : 'Coupled Aspen PFD Process Unit · Live Digital Twin Telemetry'}
              </p>
            </div>
          </div>

          <div className="pfd-inspector-badges">
            <span className={`pfd-source-badge ${state.equipment[selectedEquipment as keyof typeof state.equipment]?.source === 'real' ? 'real' : ''}`}>
              {state.equipment[selectedEquipment as keyof typeof state.equipment]?.source === 'real' ? 'REAL SENSOR DATA (ESP32)' : 'SIMULATION / DIGITAL TWIN'}
            </span>
            
            {/* Status Pill */}
            {selectedEquipment === 'pump' && (
              <span className={`pfd-status-pill ${isPumpAbnormal ? 'warning' : 'healthy'}`}>
                {isPumpAbnormal ? '● EARLY DEGRADATION' : '● HEALTHY'}
              </span>
            )}
            {selectedEquipment === 'heat_exchanger' && (
              <span className={`pfd-status-pill ${isHxAbnormal ? 'warning' : 'healthy'}`}>
                {isHxAbnormal ? '● FOULING DEVIATION' : '● HEALTHY'}
              </span>
            )}
            {selectedEquipment === 'reactor' && (
              <span className={`pfd-status-pill ${isReactorCritical ? 'critical' : 'healthy'}`}>
                {isReactorCritical ? '● RUNAWAY RISK / CRITICAL' : '● HEALTHY'}
              </span>
            )}
            {selectedEquipment === 'distillation' && (
              <span className={`pfd-status-pill ${isDistAbnormal ? 'warning' : 'healthy'}`}>
                {isDistAbnormal ? '● REFLUX ANOMALY' : '● HEALTHY'}
              </span>
            )}
            {(isStream || isTank) && (
              <span className="pfd-status-pill healthy">● NOMINAL FLOW</span>
            )}

            {/* Causal Role Pill */}
            <span className="pfd-role-pill">
              {selectedEquipment === 'pump' && (isPumpAbnormal ? 'PRIMARY FAULT' : 'PRIMARY SOURCE')}
              {selectedEquipment === 'heat_exchanger' && (isHxAbnormal ? 'PRIMARY FAULT' : isPumpAbnormal ? 'DOWNSTREAM IMPACT' : 'NOMINAL')}
              {selectedEquipment === 'reactor' && (isReactorCritical ? 'PRIMARY FAULT' : isPumpAbnormal ? 'DOWNSTREAM IMPACT' : 'NOMINAL')}
              {selectedEquipment === 'distillation' && (isDistAbnormal ? 'PRIMARY FAULT' : isPumpAbnormal ? 'DOWNSTREAM IMPACT' : 'NOMINAL')}
              {isStream && 'HYDRAULIC STREAM'}
              {isTank && 'STORAGE UNIT'}
            </span>
          </div>
        </div>

        {/* CAUSAL TRACE BREADCRUMB BAR */}
        <div className="pfd-causal-trace-bar">
          <div className="pfd-causal-nodes">
            <span className="pfd-causal-node upstream">
              UPSTREAM: {selectedEquipment === 'pump' ? 'Feed Tank' : selectedEquipment === 'heat_exchanger' ? 'P-101 Pump' : selectedEquipment === 'reactor' ? 'E-101 Exchanger' : selectedEquipment === 'distillation' ? 'R-101 Reactor' : isStream ? (streams[selectedEquipment as keyof typeof streams]?.from || 'Upstream') : 'Source'}
            </span>
            <ArrowRight size={11} className="prop-arrow" />
            <span className="pfd-causal-node current">
              SELECTED: {selectedEquipment.toUpperCase().replace('_', ' ')}
            </span>
            <ArrowRight size={11} className="prop-arrow" />
            <span className="pfd-causal-node downstream">
              DOWNSTREAM: {selectedEquipment === 'pump' ? 'E-101 Exchanger' : selectedEquipment === 'heat_exchanger' ? 'R-101 Reactor' : selectedEquipment === 'reactor' ? 'D-101 Column' : selectedEquipment === 'distillation' ? 'Top/Bottom Products' : isStream ? (streams[selectedEquipment as keyof typeof streams]?.to || 'Downstream') : 'Destination'}
            </span>
          </div>

          <div className="pfd-causal-explanation">
            <Info size={12} color="var(--primary-blue)" />
            {selectedEquipment === 'pump' && (
              <span><strong>CAUSE:</strong> Pump speed sets system mass flow. <strong>EFFECT:</strong> Hydraulic throughput propagates through E-101, R-101, and D-101.</span>
            )}
            {selectedEquipment === 'heat_exchanger' && (
              <span>{isPumpAbnormal ? 'CAUSE: Upstream P-101 flow drop. EFFECT: Increased thermal residence time and lower mass flow.' : 'CAUSE: Tube heat transfer. EFFECT: Delivers preheated effluent to reactor R-101.'}</span>
            )}
            {selectedEquipment === 'reactor' && (
              <span>{isReactorCritical ? 'PRIMARY EVENT: Jacketed cooling deficit causes exothermic temperature rise.' : isPumpAbnormal ? 'CAUSE: Lower feed flow from P-101/E-101 train. EFFECT: Extended conversion residence time.' : 'Continuous chemical conversion vessel with dual-turbine agitation.'}</span>
            )}
            {selectedEquipment === 'distillation' && (
              <span>{isDistAbnormal ? 'PRIMARY EVENT: Reflux reduction leads to loss of overhead binary separation.' : isPumpAbnormal ? 'CAUSE: Reduced inlet boil-up feed. EFFECT: Lower distillate and bottoms production rates.' : 'Continuous vapor-liquid equilibrium fractionation.'}</span>
            )}
            {isStream && (
              <span><strong>LIVE STREAM:</strong> Real-time flowrate, temperature, and line pressure derived from backend process graph.</span>
            )}
            {isTank && (
              <span><strong>STORAGE UNIT:</strong> Boundary storage inventory and product collection vessel.</span>
            )}
          </div>
        </div>

        {/* INSPECTOR MAIN CONTENT BODY */}
        <div className="pfd-inspector-body">
          {/* LEFT: METRICS GRID VS BASELINE */}
          <div>
            <div className="pfd-metrics-grid">
              {/* PUMP METRICS */}
              {selectedEquipment === 'pump' && (
                <>
                  <div className={`pfd-metric-card ${pump.rpm < 2000 ? 'warn' : ''}`}>
                    <span className="pfd-metric-label">Impeller Speed</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{Math.round(pump.rpm)} RPM</span>
                      <span className="pfd-metric-trend numeric-data">
                        {pump.rpm < 2400 ? <TrendingDown size={11} color="#C2410C" /> : <Minus size={11} color="#15803D" />}
                        {(((pump.rpm - 2450) / 2450) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 2450 RPM</span>
                  </div>

                  <div className="pfd-metric-card highlight">
                    <span className="pfd-metric-label">Pump Flow</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{pumpFlow.toFixed(1)} L/min</span>
                      <span className="pfd-metric-trend numeric-data">
                        {pumpFlow < 9.5 ? <TrendingDown size={11} color="#C2410C" /> : <Minus size={11} color="#15803D" />}
                        {(((pumpFlow - 10.0) / 10.0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 10.0 L/min</span>
                  </div>

                  <div className={`pfd-metric-card ${pump.vibration > 0.20 ? 'alert' : ''}`}>
                    <span className="pfd-metric-label">Vibration (RMS)</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{pump.vibration.toFixed(2)} g</span>
                      <span className="pfd-metric-trend numeric-data">
                        {pump.vibration > 0.15 ? <TrendingUp size={11} color="#DC2626" /> : <Minus size={11} color="#15803D" />}
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 0.08 g</span>
                  </div>

                  <div className="pfd-metric-card">
                    <span className="pfd-metric-label">Discharge Pressure</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{(pump.pressure ?? 2.80).toFixed(2)} bar</span>
                      <span className="pfd-metric-trend numeric-data">→ Stable</span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 2.80 bar</span>
                  </div>
                </>
              )}

              {/* HEAT EXCHANGER METRICS */}
              {selectedEquipment === 'heat_exchanger' && (
                <>
                  <div className="pfd-metric-card highlight">
                    <span className="pfd-metric-label">Inlet Feed Flow</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{(hx.flow ?? pumpFlow).toFixed(1)} L/min</span>
                      <span className="pfd-metric-trend numeric-data">
                        {(hx.flow ?? pumpFlow) < 9.5 ? <TrendingDown size={11} color="#C2410C" /> : <Minus size={11} color="#15803D" />}
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 10.0 L/min</span>
                  </div>

                  <div className="pfd-metric-card">
                    <span className="pfd-metric-label">Inlet Temperature</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{hx.inlet_temperature.toFixed(1)} °C</span>
                      <span className="pfd-metric-trend numeric-data">→ Stable</span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 25.2 °C</span>
                  </div>

                  <div className="pfd-metric-card">
                    <span className="pfd-metric-label">Outlet Temperature</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{hx.outlet_temperature.toFixed(1)} °C</span>
                      <span className="pfd-metric-trend numeric-data">
                        {hx.outlet_temperature < 32 ? <TrendingDown size={11} color="#C2410C" /> : <Minus size={11} color="#15803D" />}
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 38.1 °C</span>
                  </div>

                  <div className={`pfd-metric-card ${hx.temperature_difference < 5.0 ? 'alert' : ''}`}>
                    <span className="pfd-metric-label">Thermal ΔT</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{hx.temperature_difference.toFixed(1)} °C</span>
                      <span className="pfd-metric-trend numeric-data">
                        {hx.temperature_difference < 10 ? <TrendingDown size={11} color="#DC2626" /> : <Minus size={11} color="#15803D" />}
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 12.9 °C</span>
                  </div>

                  <div className="pfd-metric-card">
                    <span className="pfd-metric-label">Efficiency</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{(hx.efficiency ?? 95).toFixed(0)} %</span>
                      <span className="pfd-metric-trend numeric-data">
                        {(hx.efficiency ?? 95) < 70 ? <TrendingDown size={11} color="#C2410C" /> : <Minus size={11} color="#15803D" />}
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 95 %</span>
                  </div>
                </>
              )}

              {/* REACTOR METRICS */}
              {selectedEquipment === 'reactor' && (
                <>
                  <div className="pfd-metric-card highlight">
                    <span className="pfd-metric-label">Feed Flow</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{(reactor.feed_flow ?? (pumpFlow * 0.98)).toFixed(1)} L/min</span>
                      <span className="pfd-metric-trend numeric-data">
                        {(reactor.feed_flow ?? pumpFlow) < 9.5 ? <TrendingDown size={11} color="#C2410C" /> : <Minus size={11} color="#15803D" />}
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 10.0 L/min</span>
                  </div>

                  <div className={`pfd-metric-card ${reactor.temperature > 75 ? 'alert' : ''}`}>
                    <span className="pfd-metric-label">Core Temperature</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{reactor.temperature.toFixed(1)} °C</span>
                      <span className="pfd-metric-trend numeric-data">
                        {reactor.temperature > 70 ? <TrendingUp size={11} color="#DC2626" /> : <Minus size={11} color="#15803D" />}
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 65.0 °C</span>
                  </div>

                  <div className={`pfd-metric-card ${reactor.pressure > 2.40 ? 'alert' : ''}`}>
                    <span className="pfd-metric-label">Pressure</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{reactor.pressure.toFixed(2)} bar</span>
                      <span className="pfd-metric-trend numeric-data">
                        {reactor.pressure > 2.20 ? <TrendingUp size={11} color="#DC2626" /> : <Minus size={11} color="#15803D" />}
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 2.05 bar</span>
                  </div>

                  <div className="pfd-metric-card">
                    <span className="pfd-metric-label">Liquid Level</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{reactor.level.toFixed(1)} %</span>
                      <span className="pfd-metric-trend numeric-data">→ Stable</span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 50.0 %</span>
                  </div>

                  <div className="pfd-metric-card">
                    <span className="pfd-metric-label">Agitator Speed</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{Math.round(reactor.agitator_speed)} RPM</span>
                      <span className="pfd-metric-trend numeric-data">→ Nominal</span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 350 RPM</span>
                  </div>

                  <div className={`pfd-metric-card ${reactor.cooling_status === 0 ? 'alert' : 'highlight'}`}>
                    <span className="pfd-metric-label">Jacket Cooling</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data" style={{ color: reactor.cooling_status === 1 ? '#15803D' : '#DC2626' }}>
                        {reactor.cooling_status === 1 ? 'ACTIVE (ON)' : 'TRIPPED (OFF)'}
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: Active ON</span>
                  </div>
                </>
              )}

              {/* DISTILLATION METRICS */}
              {selectedEquipment === 'distillation' && (
                <>
                  <div className="pfd-metric-card highlight">
                    <span className="pfd-metric-label">Feed Flow</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{(dist.feed_flow ?? (pumpFlow * 0.97)).toFixed(1)} L/min</span>
                      <span className="pfd-metric-trend numeric-data">
                        {(dist.feed_flow ?? pumpFlow) < 9.5 ? <TrendingDown size={11} color="#C2410C" /> : <Minus size={11} color="#15803D" />}
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 10.0 L/min</span>
                  </div>

                  <div className={`pfd-metric-card ${dist.top_temperature > 78 ? 'warn' : ''}`}>
                    <span className="pfd-metric-label">Top Vapor Temp</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{dist.top_temperature.toFixed(1)} °C</span>
                      <span className="pfd-metric-trend numeric-data">
                        {dist.top_temperature > 77.5 ? <TrendingUp size={11} color="#C2410C" /> : <Minus size={11} color="#15803D" />}
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 76.5 °C</span>
                  </div>

                  <div className="pfd-metric-card">
                    <span className="pfd-metric-label">Bottoms Temp</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{dist.bottom_temperature.toFixed(1)} °C</span>
                      <span className="pfd-metric-trend numeric-data">→ Stable</span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 98.4 °C</span>
                  </div>

                  <div className="pfd-metric-card">
                    <span className="pfd-metric-label">Column Pressure</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{dist.pressure.toFixed(2)} bar</span>
                      <span className="pfd-metric-trend numeric-data">→ Stable</span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 2.10 bar</span>
                  </div>

                  <div className={`pfd-metric-card ${dist.reflux_ratio < 1.2 ? 'alert' : ''}`}>
                    <span className="pfd-metric-label">Reflux Ratio</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{dist.reflux_ratio.toFixed(2)}</span>
                      <span className="pfd-metric-trend numeric-data">
                        {dist.reflux_ratio < 1.5 ? <TrendingDown size={11} color="#DC2626" /> : <Minus size={11} color="#15803D" />}
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Baseline: 1.85</span>
                  </div>
                </>
              )}

              {/* STREAM METRICS (CLICKED STREAM) */}
              {isStream && (
                <>
                  <div className="pfd-metric-card highlight">
                    <span className="pfd-metric-label">Stream Mass Flow</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">
                        {streams[selectedEquipment as keyof typeof streams]?.flow.toFixed(1)} L/min
                      </span>
                      <span className="pfd-metric-trend numeric-data">● Live</span>
                    </div>
                    <span className="pfd-metric-baseline">Nominal: ~10.0 L/min</span>
                  </div>

                  <div className="pfd-metric-card">
                    <span className="pfd-metric-label">Temperature</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">
                        {streams[selectedEquipment as keyof typeof streams]?.temperature.toFixed(1)} °C
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Stream Thermal Value</span>
                  </div>

                  <div className="pfd-metric-card">
                    <span className="pfd-metric-label">Pressure</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">
                        {streams[selectedEquipment as keyof typeof streams]?.pressure.toFixed(2)} bar
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Line Static Head</span>
                  </div>

                  <div className="pfd-metric-card">
                    <span className="pfd-metric-label">Source → Target</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val" style={{ fontSize: '0.78rem' }}>
                        {streams[selectedEquipment as keyof typeof streams]?.from} → {streams[selectedEquipment as keyof typeof streams]?.to}
                      </span>
                    </div>
                    <span className="pfd-metric-baseline">Hydraulic Link</span>
                  </div>
                </>
              )}

              {/* TANK METRICS */}
              {isTank && (
                <>
                  <div className="pfd-metric-card highlight">
                    <span className="pfd-metric-label">Throughput Flow</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">{pumpFlow.toFixed(1)} L/min</span>
                      <span className="pfd-metric-trend numeric-data">● Live</span>
                    </div>
                    <span className="pfd-metric-baseline">Connected Mass Flow</span>
                  </div>

                  <div className="pfd-metric-card">
                    <span className="pfd-metric-label">Storage Inventory</span>
                    <div className="pfd-metric-val-row">
                      <span className="pfd-metric-val numeric-data">100 %</span>
                      <span className="pfd-metric-trend numeric-data">→ Stable</span>
                    </div>
                    <span className="pfd-metric-baseline">Atmospheric Tank</span>
                  </div>
                </>
              )}
            </div>

            {/* MINI LIVE TREND SPARKLINE PREVIEW */}
            {timeSeries && timeSeries.length > 2 && (
              <div className="pfd-trend-preview-box" style={{ marginTop: '10px' }}>
                <div className="pfd-trend-header">
                  <span>LIVE HISTORICAL TELEMETRY TREND PREVIEW</span>
                  <span className="numeric-data">Last {timeSeries.length}s</span>
                </div>
                <div style={{ width: '100%', height: 75 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeries} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                      <XAxis dataKey="time" hide />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9 }} />
                      <ChartTooltip
                        contentStyle={{ background: '#0F172A', border: 'none', borderRadius: '4px', fontSize: '11px', color: '#FFFFFF' }}
                        labelStyle={{ color: '#94A3B8' }}
                      />
                      {selectedEquipment === 'pump' && (
                        <>
                          <Line type="monotone" dataKey="pumpRpm" stroke="#2563EB" strokeWidth={2} dot={false} isAnimationActive={false} name="RPM" />
                          <Line type="monotone" dataKey="pumpFlow" stroke="#059669" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Flow (L/m)" />
                        </>
                      )}
                      {selectedEquipment === 'heat_exchanger' && (
                        <>
                          <Line type="monotone" dataKey="hxDeltaT" stroke="#2563EB" strokeWidth={2} dot={false} isAnimationActive={false} name="ΔT (°C)" />
                          <Line type="monotone" dataKey="hxOutletTemp" stroke="#D97706" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Tout (°C)" />
                        </>
                      )}
                      {selectedEquipment === 'reactor' && (
                        <>
                          <Line type="monotone" dataKey="reactorTemp" stroke="#DC2626" strokeWidth={2} dot={false} isAnimationActive={false} name="Temp (°C)" />
                          <Line type="monotone" dataKey="reactorPressure" stroke="#7C3AED" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Pressure (bar)" />
                        </>
                      )}
                      {selectedEquipment === 'distillation' && (
                        <>
                          <Line type="monotone" dataKey="distTopTemp" stroke="#EA580C" strokeWidth={2} dot={false} isAnimationActive={false} name="Top T (°C)" />
                          <Line type="monotone" dataKey="distReflux" stroke="#2563EB" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Reflux" />
                        </>
                      )}
                      {(isStream || isTank) && (
                        <Line type="monotone" dataKey="pumpFlow" stroke="#0284C7" strokeWidth={2} dot={false} isAnimationActive={false} name="Train Flow (L/m)" />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: IN-PLACE WHAT-IF SIMULATION CONTROLS & ACTIONS */}
          <div className="pfd-sim-control-box">
            <div className="pfd-sim-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Sliders size={13} color="var(--primary-blue)" />
                <span>IN-PLACE SIMULATION CONTROL (WHAT-IF)</span>
              </span>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Coupled Model</span>
            </div>

            {/* P-101 CONTROLS */}
            {selectedEquipment === 'pump' && (
              <div className="pfd-slider-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700 }}>P-101 Impeller Speed:</span>
                  <div className="pfd-sim-stepper">
                    <button
                      className="pfd-step-btn"
                      onClick={() => {
                        const val = Math.max(1600, pumpRpm - 100);
                        setPumpRpm(val);
                        handleApplyControl({ pump_rpm: val });
                      }}
                      disabled={isUpdating}
                    >
                      -100
                    </button>
                    <span className="numeric-data" style={{ fontWeight: 800, color: 'var(--primary-blue)', minWidth: '60px', textAlign: 'center' }}>
                      {pumpRpm} RPM
                    </span>
                    <button
                      className="pfd-step-btn"
                      onClick={() => {
                        const val = Math.min(3000, pumpRpm + 100);
                        setPumpRpm(val);
                        handleApplyControl({ pump_rpm: val });
                      }}
                      disabled={isUpdating}
                    >
                      +100
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min={1600}
                  max={3000}
                  step={50}
                  value={pumpRpm}
                  onChange={(e) => setPumpRpm(Number(e.target.value))}
                  onMouseUp={() => handleApplyControl({ pump_rpm: pumpRpm })}
                  onTouchEnd={() => handleApplyControl({ pump_rpm: pumpRpm })}
                  className="pfd-slider-input"
                  disabled={isUpdating}
                />
                <div className="pfd-slider-limits">
                  <span>1600 RPM (Low Flow)</span>
                  <span>2450 RPM (Nominal)</span>
                  <span>3000 RPM (Max)</span>
                </div>
              </div>
            )}

            {/* E-101 CONTROLS */}
            {selectedEquipment === 'heat_exchanger' && (
              <div className="pfd-slider-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700 }}>Heat Transfer Efficiency:</span>
                  <span className="numeric-data" style={{ fontWeight: 800, color: 'var(--primary-blue)' }}>
                    {hxEffic}%
                  </span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={100}
                  step={5}
                  value={hxEffic}
                  onChange={(e) => setHxEffic(Number(e.target.value))}
                  onMouseUp={() => handleApplyControl({ heat_exchanger_efficiency: hxEffic })}
                  onTouchEnd={() => handleApplyControl({ heat_exchanger_efficiency: hxEffic })}
                  className="pfd-slider-input"
                  disabled={isUpdating}
                />
                <div className="pfd-slider-limits">
                  <span>30% (Severe Fouling)</span>
                  <span>95% (Nominal)</span>
                  <span>100% (Clean)</span>
                </div>
              </div>
            )}

            {/* R-101 CONTROLS */}
            {selectedEquipment === 'reactor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700 }}>Jacket Cooling Control:</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className={`pfd-step-btn ${coolingStatus === 1 ? 'active-step' : ''}`}
                      style={{ background: coolingStatus === 1 ? '#DCFCE7' : '#FFFFFF', color: coolingStatus === 1 ? '#15803D' : 'inherit', borderColor: coolingStatus === 1 ? '#86EFAC' : '#CBD5E1' }}
                      onClick={() => {
                        setCoolingStatus(1);
                        handleApplyControl({ cooling_status: 1 });
                      }}
                      disabled={isUpdating}
                    >
                      Cooling ON
                    </button>
                    <button
                      className={`pfd-step-btn ${coolingStatus === 0 ? 'active-step' : ''}`}
                      style={{ background: coolingStatus === 0 ? '#FEE2E2' : '#FFFFFF', color: coolingStatus === 0 ? '#B91C1C' : 'inherit', borderColor: coolingStatus === 0 ? '#FCA5A5' : '#CBD5E1' }}
                      onClick={() => {
                        setCoolingStatus(0);
                        handleApplyControl({ cooling_status: 0 });
                      }}
                      disabled={isUpdating}
                    >
                      Trip Cooling (OFF)
                    </button>
                  </div>
                </div>

                <div className="pfd-slider-container">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Agitator Speed:</span>
                    <span className="numeric-data" style={{ fontWeight: 800, color: 'var(--primary-blue)', fontSize: '0.76rem' }}>{agitatorSpeed} RPM</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={500}
                    step={25}
                    value={agitatorSpeed}
                    onChange={(e) => setAgitatorSpeed(Number(e.target.value))}
                    onMouseUp={() => handleApplyControl({ agitator_speed: agitatorSpeed })}
                    onTouchEnd={() => handleApplyControl({ agitator_speed: agitatorSpeed })}
                    className="pfd-slider-input"
                    disabled={isUpdating}
                  />
                </div>
              </div>
            )}

            {/* D-101 CONTROLS */}
            {selectedEquipment === 'distillation' && (
              <div className="pfd-slider-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700 }}>Reflux Ratio (R):</span>
                  <span className="numeric-data" style={{ fontWeight: 800, color: 'var(--primary-blue)' }}>
                    {refluxRatio.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={3.5}
                  step={0.05}
                  value={refluxRatio}
                  onChange={(e) => setRefluxRatio(Number(e.target.value))}
                  onMouseUp={() => handleApplyControl({ reflux_ratio: refluxRatio })}
                  onTouchEnd={() => handleApplyControl({ reflux_ratio: refluxRatio })}
                  className="pfd-slider-input"
                  disabled={isUpdating}
                />
                <div className="pfd-slider-limits">
                  <span>0.50 (Starvation)</span>
                  <span>1.85 (Nominal)</span>
                  <span>3.50 (High Reflux)</span>
                </div>
              </div>
            )}

            {/* STREAMS OR TANKS: GLOBAL FLOW DRIVER */}
            {(isStream || isTank) && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <p style={{ margin: '0 0 6px 0' }}>
                  Stream flow rate is dynamically driven by <strong>P-101 Feed Pump</strong> and hydraulic network backpressure.
                </p>
                <button
                  className="pfd-step-btn"
                  onClick={() => handleSelect('pump')}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                >
                  <Activity size={12} />
                  <span>Select P-101 to Modulate System Flow</span>
                </button>
              </div>
            )}

            {/* ACTION BUTTONS: SIMULATE DEGRADATION & ANALYZE WITH AI */}
            <div className="pfd-inspector-actions">
              {!isStream && !isTank && (
                <button
                  className="pfd-fault-btn"
                  onClick={() => handleInjectFaultForUnit(selectedEquipment)}
                  title="Inject early degradation fault for this unit"
                >
                  <AlertTriangle size={12} />
                  <span>Simulate Degradation</span>
                </button>
              )}

              <button
                className="pfd-ai-btn"
                onClick={() => {
                  const targetUnit = isStream || isTank ? 'pump' : selectedEquipment;
                  if (onAskAiAbout) onAskAiAbout(targetUnit);
                }}
                title="Send current process telemetry to AI Copilot"
              >
                <Sparkles size={12} />
                <span>Analyze with AI</span>
              </button>

              <button
                className="pfd-reset-mini-btn"
                onClick={handleResetControls}
                disabled={isUpdating}
                title="Reset simulation variables"
              >
                <RotateCcw size={11} />
                <span>Reset Unit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. FLOWSHEET FOOTER BAR */}
      <div className="flowsheet-footer-bar">
        <div className="flowsheet-legend">
          <span className="legend-item"><span className="legend-dot normal"></span> Nominal Flow Stream</span>
          <span className="legend-item"><span className="legend-dot warning"></span> Early Degradation / Deviation</span>
          <span className="legend-item"><span className="legend-dot critical"></span> Critical Alarm Trigger</span>
        </div>

        <div className="flowsheet-cta-group">
          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            Selected: <strong style={{ color: 'var(--primary-blue)' }}>{selectedEquipment.toUpperCase().replace('_', ' ')}</strong>
          </span>
          <button
            className="ask-copilot-flow-btn"
            onClick={() => {
              const targetUnit = isStream || isTank ? 'pump' : selectedEquipment;
              if (onAskAiAbout) onAskAiAbout(targetUnit);
            }}
          >
            <MessageSquare size={12} />
            <span>Ask AI About {selectedEquipment.toUpperCase().replace('_', ' ')}</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default ProcessFlowsheet;
