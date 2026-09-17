import React, { useState } from 'react';
import {
  TelemetryData,
  ProcessStream,
  ManualControlOverrides,
  ProcessUpdatePayload,
  TimeSeriesPoint
} from '../types';
import {
  updateSimulatorControls as apiUpdateControls,
  resetSimulation as apiResetSimulation,
  setSimulatorScenario as apiSetScenario
} from '../services/api';
import {
  Layers,
  Activity,
  Sliders,
  RotateCcw,
  MessageSquare,
  Droplet,
  ArrowRight,
  Info,
  AlertTriangle,
  CheckCircle2,
  GitCommit,
  Gauge
} from 'lucide-react';

interface ProcessFlowsheetProps {
  telemetry?: TelemetryData | null;
  state?: ProcessUpdatePayload | null;
  selectedEquipment?: string;
  onSelectEquipment?: (unitId: string) => void;
  onSelectUnit?: (unitId: string) => void;
  onAskAiAbout?: (unitId: string) => void;
  onApplyPreset?: (scenario: string) => void;
  onSelectFault?: (fault: any) => void;
  onUpdateSimulatorControls?: (overrides: ManualControlOverrides) => Promise<void>;
  onResetSimulation?: () => Promise<void>;
  isLoadingPreset?: boolean;
  timeSeries?: TimeSeriesPoint[];
}

export const ProcessFlowsheet: React.FC<ProcessFlowsheetProps> = ({
  telemetry: directTelemetry,
  state,
  selectedEquipment,
  onSelectEquipment,
  onSelectUnit,
  onAskAiAbout,
  onApplyPreset,
  onSelectFault,
  onUpdateSimulatorControls,
  onResetSimulation,
  isLoadingPreset = false
}) => {
  // Normalize equipment ID mapping (e.g. 'pump' <-> 'P-101')
  const mapPropToUnitId = (id?: string) => {
    if (!id) return 'P-101';
    if (id === 'pump') return 'P-101';
    if (id === 'heat_exchanger') return 'E-101';
    if (id === 'reactor') return 'R-101';
    if (id === 'distillation') return 'D-101';
    return id;
  };

  const [selectedUnit, setSelectedUnit] = useState<string | null>(mapPropToUnitId(selectedEquipment));
  const [selectedStream, setSelectedStream] = useState<ProcessStream | null>(null);
  const [isUpdatingControls, setIsUpdatingControls] = useState(false);
  const [activeTab, setActiveTab] = useState<'equipment' | 'streams' | 'controls'>('equipment');

  // Local state for simulation control sliders
  const [localControls, setLocalControls] = useState<ManualControlOverrides>({});

  // Synchronize with external selectedEquipment prop
  React.useEffect(() => {
    if (selectedEquipment) {
      setSelectedUnit(mapPropToUnitId(selectedEquipment));
    }
  }, [selectedEquipment]);

  // Construct active telemetry object
  const telemetry: TelemetryData = directTelemetry || {
    active_scenario: state?.active_fault_mode || 'normal',
    timestamp: state?.timestamp || new Date().toISOString(),
    overall_health: {
      health_index: (state?.diagnosis?.preventive?.riskScore !== undefined) ? (100 - state.diagnosis.preventive.riskScore) : 98.5,
      overall_status: (state?.diagnosis?.severity === 'CRITICAL' ? 'critical' : (state?.diagnosis?.severity === 'HIGH' || state?.diagnosis?.severity === 'MEDIUM') ? 'warning' : 'nominal') as any
    },
    pump: {
      rpm: state?.equipment?.pump?.data?.rpm ?? 2900,
      vibration: state?.equipment?.pump?.data?.vibration ?? 1.2,
      flow_rate: state?.equipment?.pump?.data?.flow ?? 10.0,
      inlet_temperature: state?.equipment?.pump?.data?.inlet_temperature ?? 25.2,
      outlet_temperature: state?.equipment?.pump?.data?.outlet_temperature ?? 38.1,
      head: (state?.equipment?.pump?.data as any)?.head ?? 24.5,
      power_kw: (state?.equipment?.pump?.data as any)?.power_kw ?? 1.45,
      efficiency: (state?.equipment?.pump?.data as any)?.efficiency ?? 0.85,
      status: (state?.equipment?.pump?.data?.health ?? 100) < 60 ? 'critical' : (state?.equipment?.pump?.data?.health ?? 100) < 85 ? 'warning' : 'nominal'
    },
    heat_exchanger: {
      inlet_temperature: state?.equipment?.heat_exchanger?.data?.inlet_temperature ?? 25.2,
      outlet_temperature: state?.equipment?.heat_exchanger?.data?.outlet_temperature ?? 45.0,
      temperature_difference: state?.equipment?.heat_exchanger?.data?.temperature_difference ?? 19.8,
      heat_transfer_indicator: state?.equipment?.heat_exchanger?.data?.heat_transfer_indicator ?? 95.0,
      temp_in: state?.equipment?.heat_exchanger?.data?.inlet_temperature ?? 25.2,
      temp_out: state?.equipment?.heat_exchanger?.data?.outlet_temperature ?? 45.0,
      delta_t: state?.equipment?.heat_exchanger?.data?.temperature_difference ?? 19.8,
      overall_u: (state?.equipment?.heat_exchanger?.data as any)?.overall_u ?? 850.0,
      fouling_factor: (state?.equipment?.heat_exchanger?.data as any)?.fouling_factor ?? 0.0,
      heat_duty: (state?.equipment?.heat_exchanger?.data as any)?.heat_duty ?? 13.95,
      delta_p: (state?.equipment?.heat_exchanger?.data as any)?.delta_p ?? 0.1,
      thermal_condition: (state?.equipment?.heat_exchanger?.data as any)?.thermal_condition ?? 1.0,
      status: (state?.equipment?.heat_exchanger?.data?.health ?? 100) < 60 ? 'critical' : (state?.equipment?.heat_exchanger?.data?.health ?? 100) < 85 ? 'warning' : 'nominal'
    },
    reactor: {
      temperature: state?.equipment?.reactor?.data?.temperature ?? 85.0,
      pressure: state?.equipment?.reactor?.data?.pressure ?? 2.05,
      level: state?.equipment?.reactor?.data?.level ?? 50.0,
      agitator_speed: state?.equipment?.reactor?.data?.agitator_speed ?? 350,
      cooling_status: state?.equipment?.reactor?.data?.cooling_status ?? 1,
      cooling_flow: (state?.equipment?.reactor?.data as any)?.cooling_flow ?? 15.0,
      conversion: (state?.equipment?.reactor?.data as any)?.conversion ?? 0.782,
      residence_time: (state?.equipment?.reactor?.data as any)?.residence_time ?? 50.0,
      heat_removal: (state?.equipment?.reactor?.data as any)?.heat_removal ?? 12.4,
      heat_generation: (state?.equipment?.reactor?.data as any)?.heat_generation ?? 12.4,
      status: (state?.equipment?.reactor?.data?.health ?? 100) < 60 ? 'critical' : (state?.equipment?.reactor?.data?.health ?? 100) < 85 ? 'warning' : 'nominal'
    },
    distillation: {
      top_temperature: state?.equipment?.distillation?.data?.top_temperature ?? 76.5,
      bottom_temperature: state?.equipment?.distillation?.data?.bottom_temperature ?? 98.4,
      pressure: state?.equipment?.distillation?.data?.pressure ?? 2.10,
      column_pressure: (state?.equipment?.distillation?.data as any)?.column_pressure ?? state?.equipment?.distillation?.data?.pressure ?? 1.05,
      level: state?.equipment?.distillation?.data?.level ?? 52.0,
      bottoms_level: state?.equipment?.distillation?.data?.level ?? 55.0,
      reflux_ratio: state?.equipment?.distillation?.data?.reflux_ratio ?? 1.25,
      separation_purity: (state?.equipment?.distillation?.data as any)?.separation_purity ?? 0.985,
      reboiler_duty: (state?.equipment?.distillation?.data as any)?.reboiler_duty ?? 18.5,
      condenser_duty: (state?.equipment?.distillation?.data as any)?.condenser_duty ?? 16.2,
      status: (state?.equipment?.distillation?.data?.health ?? 100) < 60 ? 'critical' : (state?.equipment?.distillation?.data?.health ?? 100) < 85 ? 'warning' : 'nominal'
    },
    streams: (state as any)?.streams || []
  };

  const streams: ProcessStream[] = (telemetry.streams && telemetry.streams.length > 0)
    ? telemetry.streams
    : [
        { id: 'S-100', from: 'T-100', to: 'P-101', name: 'Raw Feed Stream', flow_rate: telemetry.pump?.flow_rate || 10.0, temperature: 25.0, pressure: 1.01, composition: { reactant_A: 1.0 }, status: 'nominal' },
        { id: 'S-101', from: 'P-101', to: 'E-101', name: 'Pumped Feed Stream', flow_rate: telemetry.pump?.flow_rate || 10.0, temperature: (telemetry.heat_exchanger?.temp_in || 25.2), pressure: 2.15, composition: { reactant_A: 1.0 }, status: 'nominal' },
        { id: 'S-102', from: 'E-101', to: 'R-101', name: 'Pre-Heated Reactor Feed', flow_rate: telemetry.pump?.flow_rate || 10.0, temperature: (telemetry.heat_exchanger?.temp_out || 45.0), pressure: 2.05, composition: { reactant_A: 1.0 }, status: 'nominal' },
        { id: 'S-103', from: 'R-101', to: 'D-101', name: 'Reactor Effluent', flow_rate: telemetry.pump?.flow_rate || 10.0, temperature: (telemetry.reactor?.temperature || 85.0), pressure: 1.95, composition: { reactant_A: 1 - (telemetry.reactor?.conversion || 0.78), product_B: telemetry.reactor?.conversion || 0.78 }, status: 'nominal' },
        { id: 'S-104', from: 'D-101', to: 'T-104', name: 'Distillate Product (Top)', flow_rate: (telemetry.pump?.flow_rate || 10.0) * 0.45, temperature: 78.2, pressure: 1.05, composition: { product_B: telemetry.distillation?.separation_purity || 0.985, reactant_A: 1 - (telemetry.distillation?.separation_purity || 0.985) }, status: 'nominal' },
        { id: 'S-105', from: 'D-101', to: 'T-105', name: 'Bottoms Heavy Residue', flow_rate: (telemetry.pump?.flow_rate || 10.0) * 0.53, temperature: 102.4, pressure: 1.25, composition: { reactant_A: 0.65, product_B: 0.35 }, status: 'nominal' },
        { id: 'S-106', from: 'D-101', to: 'D-101', name: 'Internal Column Reflux', flow_rate: ((telemetry.pump?.flow_rate || 10.0) * 0.45) * (telemetry.distillation?.reflux_ratio || 1.25), temperature: 76.5, pressure: 1.05, composition: { product_B: telemetry.distillation?.separation_purity || 0.985 }, status: 'nominal' }
      ];

  // Helper to determine status color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'nominal':
      default: return '#10b981';
    }
  };

  // Helper to determine stream pipeline color
  const getStreamPipelineColor = (stream?: ProcessStream) => {
    if (!stream) return '#0284c7';
    const flow = stream.flow_rate ?? stream.flow ?? 10.0;
    if (flow <= 0.05) return '#94a3b8'; // Steel gray when stopped
    if (stream.status === 'critical') return '#ef4444'; // Abnormal blocked / tripped
    if (flow < 8.0) return '#f59e0b'; // Reduced flow amber
    return '#0284c7'; // Engineering blue for nominal flow
  };

  // Helper to calculate dash animation speed based on flow rate
  const getStreamDashSpeed = (flowRate: number) => {
    if (flowRate <= 0.05) return 'paused';
    const duration = Math.max(0.4, Math.min(5.0, 16.0 / Math.max(0.2, flowRate)));
    return `${duration.toFixed(2)}s`;
  };

  const handleUnitClick = (unitId: string) => {
    setSelectedUnit(unitId);
    setSelectedStream(null);
    if (onSelectUnit) onSelectUnit(unitId);
    if (onSelectEquipment) {
      let legacyId = 'pump';
      if (unitId === 'P-101') legacyId = 'pump';
      else if (unitId === 'E-101') legacyId = 'heat_exchanger';
      else if (unitId === 'R-101') legacyId = 'reactor';
      else if (unitId === 'D-101') legacyId = 'distillation';
      onSelectEquipment(legacyId);
    }
  };

  const handleStreamClick = (stream: ProcessStream) => {
    setSelectedStream(stream);
    setSelectedUnit(null);
  };

  const getEquipmentTopology = (unitId: string) => {
    switch (unitId) {
      case 'T-100':
        return { upstream: null, downstream: 'P-101', inStream: null, outStream: 'S-100' };
      case 'P-101':
        return { upstream: 'T-100', downstream: 'E-101', inStream: 'S-100', outStream: 'S-101' };
      case 'E-101':
        return { upstream: 'P-101', downstream: 'R-101', inStream: 'S-101', outStream: 'S-102' };
      case 'R-101':
        return { upstream: 'E-101', downstream: 'D-101', inStream: 'S-102', outStream: 'S-103' };
      case 'D-101':
        return { upstream: 'R-101', downstream: 'T-104 / T-105', inStream: 'S-103', outStream: 'S-104, S-105' };
      case 'T-104':
        return { upstream: 'D-101', downstream: null, inStream: 'S-104', outStream: null };
      case 'T-105':
        return { upstream: 'D-101', downstream: null, inStream: 'S-105', outStream: null };
      default:
        return { upstream: null, downstream: null, inStream: null, outStream: null };
    }
  };

  const currentTopology = selectedUnit ? getEquipmentTopology(selectedUnit) : null;

  // Causal role calculation
  const getCausalRole = (unitId: string): { role: 'PRIMARY FAULT' | 'DOWNSTREAM IMPACT' | 'NOMINAL'; badgeClass: string; desc: string; outlineColor: string } => {
    const p = telemetry.pump;
    const e = telemetry.heat_exchanger;
    const r = telemetry.reactor;
    const d = telemetry.distillation;

    if (unitId === 'P-101') {
      if (p?.status === 'critical') {
        return { role: 'PRIMARY FAULT', badgeClass: 'primary', desc: 'Active mechanical/hydraulic disturbance initiated at pump (cavitation/trip).', outlineColor: '#ef4444' };
      }
      if (p?.status === 'warning') {
        return { role: 'PRIMARY FAULT', badgeClass: 'warning', desc: 'Pump operating with early deviation / moderate throttling.', outlineColor: '#f59e0b' };
      }
      return { role: 'NOMINAL', badgeClass: 'nominal', desc: 'Operating within normal design bounds (2900 RPM, 10 L/min).', outlineColor: '#10b981' };
    }
    if (unitId === 'E-101') {
      if (e?.status === 'critical' || e?.status === 'warning') {
        if (p?.status === 'critical' || p?.status === 'warning') {
          return { role: 'DOWNSTREAM IMPACT', badgeClass: 'downstream', desc: 'Thermal transfer compromised due to reduced upstream flow from P-101.', outlineColor: '#ea580c' };
        }
        return { role: 'PRIMARY FAULT', badgeClass: 'primary', desc: 'Thermal resistance fouling initiated on tube wall surfaces.', outlineColor: '#ef4444' };
      }
      return { role: 'NOMINAL', badgeClass: 'nominal', desc: 'Heat transfer rate optimal (Tout: 45°C).', outlineColor: '#10b981' };
    }
    if (unitId === 'R-101') {
      if (r?.status === 'critical' || r?.status === 'warning') {
        if ((p?.status === 'critical' || p?.status === 'warning') && (r.temperature || 85) <= 85) {
          return { role: 'DOWNSTREAM IMPACT', badgeClass: 'downstream', desc: 'Reaction residence time lengthened and conversion shifted by feed rate loss.', outlineColor: '#ea580c' };
        }
        return { role: 'PRIMARY FAULT', badgeClass: 'primary', desc: 'Jacket cooling failure or runaway exotherm condition.', outlineColor: '#ef4444' };
      }
      return { role: 'NOMINAL', badgeClass: 'nominal', desc: 'CSTR conversion & cooling balance steady (78% conv).', outlineColor: '#10b981' };
    }
    if (unitId === 'D-101') {
      if (d?.status === 'critical' || d?.status === 'warning') {
        if (p?.status === 'critical' || r?.status === 'critical') {
          return { role: 'DOWNSTREAM IMPACT', badgeClass: 'downstream', desc: 'Vapor-liquid equilibrium perturbed by upstream feed composition/flow shift.', outlineColor: '#ea580c' };
        }
        return { role: 'PRIMARY FAULT', badgeClass: 'primary', desc: 'Reflux pump loss, condenser flood, or reboiler duty imbalance.', outlineColor: '#ef4444' };
      }
      return { role: 'NOMINAL', badgeClass: 'nominal', desc: 'Top/bottom separation purity on specification (98.5%).', outlineColor: '#10b981' };
    }
    return { role: 'NOMINAL', badgeClass: 'nominal', desc: 'Nominal storage/feed operation.', outlineColor: '#10b981' };
  };

  // Causal Chain Steps for Flow Banner
  const pumpCausal = getCausalRole('P-101');
  const exchCausal = getCausalRole('E-101');
  const reactCausal = getCausalRole('R-101');
  const distCausal = getCausalRole('D-101');

  const handleApplyControlChange = async (overrides: ManualControlOverrides) => {
    setIsUpdatingControls(true);
    try {
      if (onUpdateSimulatorControls) {
        await onUpdateSimulatorControls(overrides);
      } else {
        await apiUpdateControls(overrides);
      }
    } catch (e) {
      console.error('Failed to update simulator controls:', e);
    } finally {
      setIsUpdatingControls(false);
    }
  };

  const handleReset = async () => {
    setLocalControls({});
    if (onResetSimulation) {
      await onResetSimulation();
    } else {
      await apiResetSimulation();
    }
  };

  const handleModeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (onApplyPreset) {
      onApplyPreset(val);
    } else if (onSelectFault) {
      onSelectFault(val);
    } else {
      await apiSetScenario(val);
    }
  };

  const handleAskAi = () => {
    if (onAskAiAbout && selectedUnit) {
      let legacyId = 'pump';
      if (selectedUnit === 'P-101') legacyId = 'pump';
      else if (selectedUnit === 'E-101') legacyId = 'heat_exchanger';
      else if (selectedUnit === 'R-101') legacyId = 'reactor';
      else if (selectedUnit === 'D-101') legacyId = 'distillation';
      onAskAiAbout(legacyId);
    }
  };

  return (
    <div className="process-flowsheet-card">
      {/* 1. Header Toolbar with Preset Modes and Global Actions */}
      <div className="flowsheet-header">
        <div className="flowsheet-title-area">
          <div className="flowsheet-icon-box">
            <Layers className="flowsheet-main-icon" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="flowsheet-title">Process Flow Diagram (PFD)</h2>
              <span className="pfd-status-pill online">
                <span className="pfd-status-pulse"></span>
                First-Principles Causal Dynamics
              </span>
            </div>
            <p className="flowsheet-subtitle">
              Interactive Chemical Train: T-100 Feed &rarr; P-101 Centrifugal Pump &rarr; E-101 Shell &amp; Tube &rarr; R-101 CSTR Reactor &rarr; D-101 Binary Distillation &rarr; T-104/T-105 Products
            </p>
          </div>
        </div>

        <div className="flowsheet-actions">
          {/* Operating Mode Dropdown */}
          <div className="flowsheet-mode-selector">
            <label className="flowsheet-mode-label">Process State:</label>
            <select
              className="flowsheet-mode-dropdown"
              disabled={isLoadingPreset}
              onChange={handleModeChange}
              value={telemetry?.active_scenario || 'normal'}
            >
              <option value="normal">Nominal Steady State (10.0 L/min)</option>
              <option value="early_pump_degradation">Fault: Early Pump Cavitation / Degradation (P-101)</option>
              <option value="early_heat_exchanger_fouling">Fault: Shell &amp; Tube Heat Fouling (E-101)</option>
              <option value="early_reactor_cooling_degradation">Fault: Reactor Cooling Trip / Exotherm (R-101)</option>
              <option value="early_distillation_reflux_loss">Fault: Distillation Reflux Pump Loss (D-101)</option>
              <option value="unknown_fault">Fault: Complex Multi-Unit Disturbance</option>
            </select>
          </div>

          <button
            className="pfd-btn-secondary"
            onClick={handleReset}
            title="Reset simulation parameters to nominal baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Baseline
          </button>
        </div>
      </div>

      {/* 2. Top Overview Process Strip */}
      <div className="pfd-overview-strip">
        <div className="pfd-overview-item">
          <span className="pfd-overview-label">Process Health</span>
          <span className={`pfd-overview-val ${telemetry?.overall_health?.overall_status || 'nominal'}`}>
            {telemetry?.overall_health?.overall_status ? telemetry.overall_health.overall_status.toUpperCase() : 'NOMINAL'}
          </span>
        </div>
        <div className="pfd-overview-item">
          <span className="pfd-overview-label">Train Feed Flow (S-100)</span>
          <span className="pfd-overview-val mono">
            {streams[0]?.flow_rate?.toFixed(2) || (telemetry?.pump?.flow_rate || 10.0).toFixed(2)} L/min
          </span>
        </div>
        <div className="pfd-overview-item">
          <span className="pfd-overview-label">Health Score</span>
          <span className="pfd-overview-val mono">
            {telemetry?.overall_health?.health_index !== undefined ? `${telemetry.overall_health.health_index.toFixed(1)}%` : '98.5%'}
          </span>
        </div>
        <div className="pfd-overview-item">
          <span className="pfd-overview-label">Reactor Conversion</span>
          <span className="pfd-overview-val mono">
            {telemetry?.reactor?.conversion !== undefined ? `${(telemetry.reactor.conversion * 100).toFixed(1)}%` : '78.2%'}
          </span>
        </div>
        <div className="pfd-overview-item">
          <span className="pfd-overview-label">Distillate Purity (x_D)</span>
          <span className="pfd-overview-val mono">
            {telemetry?.distillation?.separation_purity !== undefined ? `${(telemetry.distillation.separation_purity * 100).toFixed(1)}%` : '98.5%'}
          </span>
        </div>
        <div className="pfd-overview-item">
          <span className="pfd-overview-label">Active Scenario</span>
          <span className="pfd-overview-val highlight">
            {telemetry?.active_scenario && telemetry.active_scenario !== 'normal'
              ? telemetry.active_scenario.replace(/_/g, ' ').toUpperCase()
              : 'NOMINAL STEADY STATE'}
          </span>
        </div>
      </div>

      {/* 2.5 Causal Propagation Chain Banner */}
      <div className="pfd-causal-propagation-bar">
        <div className="pfd-causal-propagation-header">
          <GitCommit className="w-3.5 h-3.5 text-sky-600" />
          <span className="pfd-causal-bar-title">CAUSE &rarr; EFFECT PROPAGATION CHAIN</span>
        </div>
        <div className="pfd-causal-chain-nodes">
          {/* Node 1: T-100 */}
          <div className="pfd-causal-node nominal" onClick={() => handleUnitClick('T-100')}>
            <div className="pfd-node-top">
              <span className="pfd-node-tag">T-100</span>
              <span className="pfd-node-role nominal">FEED</span>
            </div>
            <span className="pfd-node-metric">75% LVL</span>
          </div>

          <ArrowRight className="w-3.5 h-3.5 pfd-causal-arrow" />

          {/* Node 2: P-101 */}
          <div
            className={`pfd-causal-node ${pumpCausal.badgeClass} ${selectedUnit === 'P-101' ? 'selected' : ''}`}
            onClick={() => handleUnitClick('P-101')}
          >
            <div className="pfd-node-top">
              <span className="pfd-node-tag">P-101</span>
              <span className={`pfd-node-role ${pumpCausal.badgeClass}`}>{pumpCausal.role}</span>
            </div>
            <span className="pfd-node-metric">
              {Math.round(telemetry.pump?.rpm || 2900)} RPM &bull; {(telemetry.pump?.flow_rate || 10.0).toFixed(1)} L/m
            </span>
          </div>

          <ArrowRight className="w-3.5 h-3.5 pfd-causal-arrow" />

          {/* Node 3: E-101 */}
          <div
            className={`pfd-causal-node ${exchCausal.badgeClass} ${selectedUnit === 'E-101' ? 'selected' : ''}`}
            onClick={() => handleUnitClick('E-101')}
          >
            <div className="pfd-node-top">
              <span className="pfd-node-tag">E-101</span>
              <span className={`pfd-node-role ${exchCausal.badgeClass}`}>{exchCausal.role}</span>
            </div>
            <span className="pfd-node-metric">
              {(telemetry.heat_exchanger?.temp_out || 45.0).toFixed(1)}°C &bull; {telemetry.heat_exchanger?.overall_u ? Math.round(telemetry.heat_exchanger.overall_u) : 850} W/m²K
            </span>
          </div>

          <ArrowRight className="w-3.5 h-3.5 pfd-causal-arrow" />

          {/* Node 4: R-101 */}
          <div
            className={`pfd-causal-node ${reactCausal.badgeClass} ${selectedUnit === 'R-101' ? 'selected' : ''}`}
            onClick={() => handleUnitClick('R-101')}
          >
            <div className="pfd-node-top">
              <span className="pfd-node-tag">R-101</span>
              <span className={`pfd-node-role ${reactCausal.badgeClass}`}>{reactCausal.role}</span>
            </div>
            <span className="pfd-node-metric">
              {(telemetry.reactor?.temperature || 85.0).toFixed(1)}°C &bull; {((telemetry.reactor?.conversion || 0.782) * 100).toFixed(1)}% XA
            </span>
          </div>

          <ArrowRight className="w-3.5 h-3.5 pfd-causal-arrow" />

          {/* Node 5: D-101 */}
          <div
            className={`pfd-causal-node ${distCausal.badgeClass} ${selectedUnit === 'D-101' ? 'selected' : ''}`}
            onClick={() => handleUnitClick('D-101')}
          >
            <div className="pfd-node-top">
              <span className="pfd-node-tag">D-101</span>
              <span className={`pfd-node-role ${distCausal.badgeClass}`}>{distCausal.role}</span>
            </div>
            <span className="pfd-node-metric">
              {((telemetry.distillation?.separation_purity || 0.985) * 100).toFixed(1)}% xD &bull; {(telemetry.distillation?.column_pressure || 1.05).toFixed(2)} bar
            </span>
          </div>

          <ArrowRight className="w-3.5 h-3.5 pfd-causal-arrow" />

          {/* Node 6: Products */}
          <div className="pfd-causal-node nominal" onClick={() => handleUnitClick('T-104')}>
            <div className="pfd-node-top">
              <span className="pfd-node-tag">T-104 / T-105</span>
              <span className="pfd-node-role nominal">PRODUCTS</span>
            </div>
            <span className="pfd-node-metric">SPEC COMPLIANT</span>
          </div>
        </div>
      </div>

      {/* 3. Main SVG Interactive Flowsheet Diagram (Engineering Off-White Canvas) */}
      <div className="flowsheet-svg-wrapper">
        <svg
          viewBox="0 0 1180 500"
          className="flowsheet-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Clean Engineering Equipment Fills */}
            <linearGradient id="engVesselFill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>

            <linearGradient id="liquidFeedGradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="rgba(14, 165, 233, 0.35)" />
              <stop offset="100%" stopColor="rgba(14, 165, 233, 0.08)" />
            </linearGradient>

            <linearGradient id="liquidReactorGradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="rgba(139, 92, 246, 0.35)" />
              <stop offset="100%" stopColor="rgba(139, 92, 246, 0.08)" />
            </linearGradient>

            <linearGradient id="liquidDistillateGradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.35)" />
              <stop offset="100%" stopColor="rgba(16, 185, 129, 0.08)" />
            </linearGradient>

            <linearGradient id="liquidBottomsGradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="rgba(245, 158, 11, 0.35)" />
              <stop offset="100%" stopColor="rgba(245, 158, 11, 0.08)" />
            </linearGradient>

            <filter id="pfd-subtle-shadow" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Clean Engineering Grid Background */}
          <pattern id="pfd-grid-light" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.75" />
          </pattern>
          <rect width="1180" height="500" fill="#f8fafc" />
          <rect width="1180" height="500" fill="url(#pfd-grid-light)" />

          {/* ========================================================================= */}
          {/* PROCESS PIPELINES / STREAMS (S-100 to S-106)                              */}
          {/* ========================================================================= */}

          {/* S-100: T-100 -> P-101 */}
          <g className={`stream-group ${selectedStream?.id === 'S-100' ? 'selected' : ''}`} onClick={() => handleStreamClick(streams[0])}>
            <path d="M 110 280 L 190 280" className="pfd-pipe-base" />
            <path
              d="M 110 280 L 190 280"
              className="pfd-pipe-flow"
              style={{
                stroke: getStreamPipelineColor(streams[0]),
                animationDuration: getStreamDashSpeed(streams[0]?.flow_rate || 10.0),
                animationPlayState: (streams[0]?.flow_rate || 10.0) <= 0.05 ? 'paused' : 'running'
              }}
            />
          </g>

          {/* S-101: P-101 -> E-101 */}
          <g className={`stream-group ${selectedStream?.id === 'S-101' ? 'selected' : ''}`} onClick={() => handleStreamClick(streams[1])}>
            <path d="M 230 260 L 230 220 L 330 220" className="pfd-pipe-base" />
            <path
              d="M 230 260 L 230 220 L 330 220"
              className="pfd-pipe-flow"
              style={{
                stroke: getStreamPipelineColor(streams[1]),
                animationDuration: getStreamDashSpeed(streams[1]?.flow_rate || 10.0),
                animationPlayState: (streams[1]?.flow_rate || 10.0) <= 0.05 ? 'paused' : 'running'
              }}
            />
          </g>

          {/* S-102: E-101 -> R-101 */}
          <g className={`stream-group ${selectedStream?.id === 'S-102' ? 'selected' : ''}`} onClick={() => handleStreamClick(streams[2])}>
            <path d="M 450 220 L 510 220 L 510 160 L 560 160 L 560 175" className="pfd-pipe-base" />
            <path
              d="M 450 220 L 510 220 L 510 160 L 560 160 L 560 175"
              className="pfd-pipe-flow"
              style={{
                stroke: getStreamPipelineColor(streams[2]),
                animationDuration: getStreamDashSpeed(streams[2]?.flow_rate || 10.0),
                animationPlayState: (streams[2]?.flow_rate || 10.0) <= 0.05 ? 'paused' : 'running'
              }}
            />
          </g>

          {/* S-103: R-101 -> D-101 */}
          <g className={`stream-group ${selectedStream?.id === 'S-103' ? 'selected' : ''}`} onClick={() => handleStreamClick(streams[3])}>
            <path d="M 580 370 L 580 400 L 730 400 L 730 260 L 760 260" className="pfd-pipe-base" />
            <path
              d="M 580 370 L 580 400 L 730 400 L 730 260 L 760 260"
              className="pfd-pipe-flow"
              style={{
                stroke: getStreamPipelineColor(streams[3]),
                animationDuration: getStreamDashSpeed(streams[3]?.flow_rate || 10.0),
                animationPlayState: (streams[3]?.flow_rate || 10.0) <= 0.05 ? 'paused' : 'running'
              }}
            />
          </g>

          {/* S-104: D-101 Top Vapor -> C-101 Condenser -> T-104 */}
          <g className={`stream-group ${selectedStream?.id === 'S-104' ? 'selected' : ''}`} onClick={() => handleStreamClick(streams[4])}>
            <path d="M 800 80 L 800 50 L 900 50" className="pfd-pipe-base" />
            <path d="M 940 50 L 970 50 L 970 90 L 1050 90 L 1050 120" className="pfd-pipe-base" />
            <path
              d="M 800 80 L 800 50 L 900 50 M 940 50 L 970 50 L 970 90 L 1050 90 L 1050 120"
              className="pfd-pipe-flow"
              style={{
                stroke: getStreamPipelineColor(streams[4]),
                animationDuration: getStreamDashSpeed(streams[4]?.flow_rate || 4.5),
                animationPlayState: (streams[4]?.flow_rate || 4.5) <= 0.05 ? 'paused' : 'running'
              }}
            />
          </g>

          {/* S-106: Reflux Return from Accumulator */}
          <g className={`stream-group ${selectedStream?.id === 'S-106' ? 'selected' : ''}`} onClick={() => handleStreamClick(streams[6] || streams[0])}>
            <path d="M 970 90 L 970 110 L 840 110" className="pfd-pipe-base" />
            <path
              d="M 970 90 L 970 110 L 840 110"
              className="pfd-pipe-flow"
              style={{
                stroke: getStreamPipelineColor(streams[6]),
                animationDuration: getStreamDashSpeed(streams[6]?.flow_rate || 5.6),
                animationPlayState: (streams[6]?.flow_rate || 5.6) <= 0.05 ? 'paused' : 'running'
              }}
            />
          </g>

          {/* Reboiler E-102 Loop */}
          <g className="pfd-utility-loop">
            <path d="M 780 430 L 780 450 L 870 450" className="pfd-pipe-base" />
            <path d="M 920 440 L 920 400 L 840 400" className="pfd-pipe-base" />
            <path
              d="M 780 430 L 780 450 L 870 450 M 920 440 L 920 400 L 840 400"
              className="pfd-pipe-flow"
              style={{ stroke: '#f59e0b', animationDuration: '2s' }}
            />
          </g>

          {/* S-105: Bottoms draw to T-105 */}
          <g className={`stream-group ${selectedStream?.id === 'S-105' ? 'selected' : ''}`} onClick={() => handleStreamClick(streams[5])}>
            <path d="M 800 430 L 800 475 L 1050 475 L 1050 420" className="pfd-pipe-base" />
            <path
              d="M 800 430 L 800 475 L 1050 475 L 1050 420"
              className="pfd-pipe-flow"
              style={{
                stroke: getStreamPipelineColor(streams[5]),
                animationDuration: getStreamDashSpeed(streams[5]?.flow_rate || 5.3),
                animationPlayState: (streams[5]?.flow_rate || 5.3) <= 0.05 ? 'paused' : 'running'
              }}
            />
          </g>

          {/* E-101 Utility Steam In / Condensate Out */}
          <g className="pfd-utility-loop">
            <path d="M 390 145 L 390 185" className="pfd-pipe-base stroke-rose-500" strokeDasharray="3 3" />
            <path d="M 390 255 L 390 295" className="pfd-pipe-base stroke-sky-500" strokeDasharray="3 3" />
            <text x="390" y="138" fill="#e11d48" fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="monospace">STEAM (130°C)</text>
            <text x="390" y="307" fill="#0284c7" fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="monospace">CONDENSATE</text>
          </g>

          {/* R-101 Cooling Water Utility Loop */}
          <g className="pfd-utility-loop">
            <path d="M 520 330 L 490 330" className="pfd-pipe-base stroke-sky-500" strokeDasharray="3 3" />
            <path d="M 640 210 L 670 210" className="pfd-pipe-base stroke-sky-500" strokeDasharray="3 3" />
            <text x="475" y="333" fill="#0284c7" fontSize="9" fontWeight="700" textAnchor="end" fontFamily="monospace">CW IN (20°C)</text>
            <text x="680" y="213" fill="#0284c7" fontSize="9" fontWeight="700" textAnchor="start" fontFamily="monospace">CW OUT</text>
          </g>

          {/* ========================================================================= */}
          {/* STREAM TELEMETRY BADGES                                                   */}
          {/* ========================================================================= */}

          {/* S-100 Badge */}
          <g className="pfd-stream-badge-group" transform="translate(145, 260)" onClick={() => handleStreamClick(streams[0])}>
            <rect x="-32" y="-12" width="64" height="20" rx="4" className={`pfd-stream-badge ${selectedStream?.id === 'S-100' ? 'active' : ''}`} />
            <text x="0" y="2" className="pfd-stream-text" textAnchor="middle">S-100: {(streams[0]?.flow_rate || 10.0).toFixed(1)} L/m</text>
          </g>

          {/* S-101 Badge */}
          <g className="pfd-stream-badge-group" transform="translate(275, 205)" onClick={() => handleStreamClick(streams[1])}>
            <rect x="-32" y="-12" width="64" height="20" rx="4" className={`pfd-stream-badge ${selectedStream?.id === 'S-101' ? 'active' : ''}`} />
            <text x="0" y="2" className="pfd-stream-text" textAnchor="middle">S-101: {(streams[1]?.flow_rate || 10.0).toFixed(1)} L/m</text>
          </g>

          {/* S-102 Badge */}
          <g className="pfd-stream-badge-group" transform="translate(490, 190)" onClick={() => handleStreamClick(streams[2])}>
            <rect x="-32" y="-12" width="64" height="20" rx="4" className={`pfd-stream-badge ${selectedStream?.id === 'S-102' ? 'active' : ''}`} />
            <text x="0" y="2" className="pfd-stream-text" textAnchor="middle">S-102: {(streams[2]?.temperature || 45.0).toFixed(1)}°C</text>
          </g>

          {/* S-103 Badge */}
          <g className="pfd-stream-badge-group" transform="translate(660, 385)" onClick={() => handleStreamClick(streams[3])}>
            <rect x="-32" y="-12" width="64" height="20" rx="4" className={`pfd-stream-badge ${selectedStream?.id === 'S-103' ? 'active' : ''}`} />
            <text x="0" y="2" className="pfd-stream-text" textAnchor="middle">S-103: {(streams[3]?.flow_rate || 10.0).toFixed(1)} L/m</text>
          </g>

          {/* S-104 Badge */}
          <g className="pfd-stream-badge-group" transform="translate(1015, 75)" onClick={() => handleStreamClick(streams[4])}>
            <rect x="-32" y="-12" width="64" height="20" rx="4" className={`pfd-stream-badge ${selectedStream?.id === 'S-104' ? 'active' : ''}`} />
            <text x="0" y="2" className="pfd-stream-text" textAnchor="middle">S-104: {(streams[4]?.flow_rate || 4.5).toFixed(1)} L/m</text>
          </g>

          {/* S-106 Badge */}
          <g className="pfd-stream-badge-group" transform="translate(900, 95)" onClick={() => handleStreamClick(streams[6] || streams[0])}>
            <rect x="-32" y="-12" width="64" height="20" rx="4" className={`pfd-stream-badge ${selectedStream?.id === 'S-106' ? 'active' : ''}`} />
            <text x="0" y="2" className="pfd-stream-text" textAnchor="middle">S-106: {(streams[6]?.flow_rate || 5.6).toFixed(1)} L/m</text>
          </g>

          {/* S-105 Badge */}
          <g className="pfd-stream-badge-group" transform="translate(920, 460)" onClick={() => handleStreamClick(streams[5])}>
            <rect x="-32" y="-12" width="64" height="20" rx="4" className={`pfd-stream-badge ${selectedStream?.id === 'S-105' ? 'active' : ''}`} />
            <text x="0" y="2" className="pfd-stream-text" textAnchor="middle">S-105: {(streams[5]?.flow_rate || 5.3).toFixed(1)} L/m</text>
          </g>

          {/* ========================================================================= */}
          {/* EQUIPMENT UNITS (ENGINEERING BODIES WITH CLEAN NAVY OUTLINES)             */}
          {/* ========================================================================= */}

          {/* --- T-100: FEED TANK --- */}
          <g
            className={`pfd-equipment-group ${selectedUnit === 'T-100' ? 'selected' : ''}`}
            onClick={() => handleUnitClick('T-100')}
          >
            <rect x="50" y="220" width="60" height="90" rx="6" fill="url(#engVesselFill)" stroke="#0f172a" strokeWidth="2" filter="url(#pfd-subtle-shadow)" />
            <rect x="52" y="250" width="56" height="58" rx="4" fill="url(#liquidFeedGradient)" />
            <line x1="52" y1="250" x2="108" y2="250" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="2 2" />
            <path d="M 50 225 Q 80 215 110 225" fill="none" stroke="#0f172a" strokeWidth="1.5" />
            <path d="M 50 305 Q 80 315 110 305" fill="none" stroke="#0f172a" strokeWidth="1.5" />
            <rect x="55" y="325" width="50" height="18" rx="3" className="pfd-tag-bg" />
            <text x="80" y="338" className="pfd-tag-text">T-100</text>
            <text x="80" y="270" className="pfd-unit-value">75% LVL</text>
          </g>

          {/* --- P-101: CENTRIFUGAL PUMP --- */}
          <g
            className={`pfd-equipment-group ${selectedUnit === 'P-101' ? 'selected' : ''}`}
            onClick={() => handleUnitClick('P-101')}
          >
            {/* Motor block */}
            <rect x="180" y="285" width="22" height="16" rx="2" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1.5" />
            {/* Pump Volute Casing */}
            <circle
              cx="210"
              cy="280"
              r="22"
              fill="url(#engVesselFill)"
              stroke={pumpCausal.outlineColor}
              strokeWidth={selectedUnit === 'P-101' ? '3.5' : '2.5'}
              filter="url(#pfd-subtle-shadow)"
            />
            <g className="pfd-impeller" style={{ transformOrigin: '210px 280px' }}>
              <line x1="210" y1="264" x2="210" y2="296" stroke="#475569" strokeWidth="2" />
              <line x1="194" y1="280" x2="226" y2="280" stroke="#475569" strokeWidth="2" />
              <circle cx="210" cy="280" r="4" fill="#0284c7" />
            </g>
            <path d="M 224 266 L 230 260" stroke="#0f172a" strokeWidth="2" />
            <rect x="185" y="325" width="50" height="18" rx="3" className="pfd-tag-bg" />
            <text x="210" y="338" className="pfd-tag-text">P-101</text>
            <text x="210" y="355" className="pfd-unit-stat">
              {telemetry.pump?.rpm ? `${Math.round(telemetry.pump.rpm)} RPM` : '2900 RPM'}
            </text>
            <text x="210" y="367" className="pfd-unit-stat highlight">
              {telemetry.pump?.flow_rate ? `${telemetry.pump.flow_rate.toFixed(1)} L/m` : '10.0 L/m'}
            </text>
          </g>

          {/* --- E-101: SHELL & TUBE HEAT EXCHANGER --- */}
          <g
            className={`pfd-equipment-group ${selectedUnit === 'E-101' ? 'selected' : ''}`}
            onClick={() => handleUnitClick('E-101')}
          >
            <rect
              x="330"
              y="185"
              width="120"
              height="70"
              rx="12"
              fill="url(#engVesselFill)"
              stroke={exchCausal.outlineColor}
              strokeWidth={selectedUnit === 'E-101' ? '3.5' : '2.5'}
              filter="url(#pfd-subtle-shadow)"
            />
            {/* Tube Bundle Linework */}
            <line x1="340" y1="205" x2="440" y2="205" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" />
            <line x1="340" y1="220" x2="440" y2="220" stroke="#0284c7" strokeWidth="2" />
            <line x1="340" y1="235" x2="440" y2="235" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" />
            {/* Baffles */}
            <line x1="365" y1="185" x2="365" y2="230" stroke="#64748b" strokeWidth="1.5" />
            <line x1="405" y1="210" x2="405" y2="255" stroke="#64748b" strokeWidth="1.5" />
            {/* Channel heads */}
            <path d="M 330 185 Q 320 220 330 255" fill="none" stroke="#0f172a" strokeWidth="1.5" />
            <path d="M 450 185 Q 460 220 450 255" fill="none" stroke="#0f172a" strokeWidth="1.5" />
            <rect x="365" y="325" width="50" height="18" rx="3" className="pfd-tag-bg" />
            <text x="390" y="338" className="pfd-tag-text">E-101</text>
            <text x="390" y="355" className="pfd-unit-stat">
              Tout: {telemetry.heat_exchanger?.temp_out ? `${telemetry.heat_exchanger.temp_out.toFixed(1)}°C` : '45.0°C'}
            </text>
            <text x="390" y="367" className="pfd-unit-stat highlight">
              U: {telemetry.heat_exchanger?.overall_u ? `${telemetry.heat_exchanger.overall_u.toFixed(0)} W/m²K` : '850 W/m²K'}
            </text>
          </g>

          {/* --- R-101: CONTINUOUS STIRRED TANK REACTOR (CSTR) --- */}
          <g
            className={`pfd-equipment-group ${selectedUnit === 'R-101' ? 'selected' : ''}`}
            onClick={() => handleUnitClick('R-101')}
          >
            {/* Cooling Jacket Outline */}
            <rect
              x="520"
              y="195"
              width="120"
              height="155"
              rx="18"
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.5"
              strokeDasharray="4 2"
            />
            {/* Main Vessel Body */}
            <rect
              x="530"
              y="180"
              width="100"
              height="180"
              rx="16"
              fill="url(#engVesselFill)"
              stroke={reactCausal.outlineColor}
              strokeWidth={selectedUnit === 'R-101' ? '3.5' : '2.5'}
              filter="url(#pfd-subtle-shadow)"
            />
            {/* Liquid Holdup */}
            <rect x="532" y="240" width="96" height="116" rx="10" fill="url(#liquidReactorGradient)" />
            <line x1="532" y1="240" x2="628" y2="240" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="3 2" />

            {/* Agitator Motor */}
            <rect x="570" y="150" width="20" height="22" rx="3" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1.5" />
            {/* Agitator Shaft */}
            <line x1="580" y1="172" x2="580" y2="335" stroke="#334155" strokeWidth="2.5" />
            {/* Top Impeller Blades */}
            <g className="pfd-impeller-blade" style={{ transformOrigin: '580px 270px' }}>
              <line x1="555" y1="270" x2="605" y2="270" stroke="#334155" strokeWidth="3" />
              <line x1="555" y1="265" x2="555" y2="275" stroke="#334155" strokeWidth="3" />
              <line x1="605" y1="265" x2="605" y2="275" stroke="#334155" strokeWidth="3" />
            </g>
            {/* Bottom Impeller Blades */}
            <g className="pfd-impeller-blade" style={{ transformOrigin: '580px 320px' }}>
              <line x1="555" y1="320" x2="605" y2="320" stroke="#334155" strokeWidth="3" />
              <line x1="555" y1="315" x2="555" y2="325" stroke="#334155" strokeWidth="3" />
              <line x1="605" y1="315" x2="605" y2="325" stroke="#334155" strokeWidth="3" />
            </g>

            {/* Thermowell Sensor Probe */}
            <line x1="615" y1="210" x2="615" y2="300" stroke="#e11d48" strokeWidth="1.5" />
            <circle cx="615" cy="300" r="2.5" fill="#e11d48" />

            <rect x="555" y="380" width="50" height="18" rx="3" className="pfd-tag-bg" />
            <text x="580" y="393" className="pfd-tag-text">R-101</text>
            <text x="580" y="415" className="pfd-unit-stat">
              T: {telemetry.reactor?.temperature ? `${telemetry.reactor.temperature.toFixed(1)}°C` : '85.0°C'}
            </text>
            <text x="580" y="427" className="pfd-unit-stat highlight">
              Conv: {telemetry.reactor?.conversion !== undefined ? `${(telemetry.reactor.conversion * 100).toFixed(1)}%` : '78.2%'}
            </text>
          </g>

          {/* --- D-101: BINARY DISTILLATION COLUMN --- */}
          <g
            className={`pfd-equipment-group ${selectedUnit === 'D-101' ? 'selected' : ''}`}
            onClick={() => handleUnitClick('D-101')}
          >
            {/* Column Vessel */}
            <rect
              x="760"
              y="80"
              width="80"
              height="350"
              rx="18"
              fill="url(#engVesselFill)"
              stroke={distCausal.outlineColor}
              strokeWidth={selectedUnit === 'D-101' ? '3.5' : '2.5'}
              filter="url(#pfd-subtle-shadow)"
            />

            {/* Internal Sieve Trays / Downcomers */}
            {[130, 175, 220, 265, 310, 355].map((y, idx) => (
              <g key={idx}>
                <line
                  x1={idx % 2 === 0 ? "765" : "775"}
                  y1={y}
                  x2={idx % 2 === 0 ? "825" : "835"}
                  y2={y}
                  stroke="#64748b"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                <line
                  x1={idx % 2 === 0 ? "825" : "775"}
                  y1={y}
                  x2={idx % 2 === 0 ? "825" : "775"}
                  y2={y + 20}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
              </g>
            ))}

            {/* Feed Tray Nozzle */}
            <circle cx="760" cy="260" r="3.5" fill="#0284c7" />
            <text x="750" y="263" fill="#0284c7" fontSize="8" fontWeight="700" textAnchor="end" fontFamily="monospace">FEED</text>

            {/* Sump Liquid Holdup */}
            <rect x="762" y="380" width="76" height="46" rx="10" fill="url(#liquidBottomsGradient)" />
            <line x1="762" y1="380" x2="838" y2="380" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" />

            {/* Overhead Condenser C-101 */}
            <g transform="translate(900, 35)">
              <rect x="0" y="0" width="40" height="30" rx="4" fill="url(#engVesselFill)" stroke="#0284c7" strokeWidth="1.5" />
              <line x1="5" y1="15" x2="35" y2="15" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="2 2" />
              <text x="20" y="20" fill="#0f172a" fontSize="8" fontWeight="700" textAnchor="middle" fontFamily="monospace">C-101</text>
            </g>

            {/* Reflux Accumulator */}
            <g transform="translate(955, 75)">
              <rect x="0" y="0" width="30" height="30" rx="6" fill="url(#engVesselFill)" stroke="#0f172a" strokeWidth="1.5" />
              <rect x="2" y="15" width="26" height="13" rx="3" fill="url(#liquidDistillateGradient)" />
              <text x="15" y="12" fill="#0f172a" fontSize="7" fontWeight="700" textAnchor="middle" fontFamily="monospace">ACC</text>
            </g>

            {/* Reboiler E-102 Kettle */}
            <g transform="translate(870, 430)">
              <circle cx="20" cy="20" r="18" fill="url(#engVesselFill)" stroke="#f59e0b" strokeWidth="1.5" />
              <path d="M 8 20 Q 20 8 32 20 Q 20 32 8 20" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
              <text x="20" y="23" fill="#0f172a" fontSize="8" fontWeight="700" textAnchor="middle" fontFamily="monospace">E-102</text>
            </g>

            <rect x="775" y="440" width="50" height="18" rx="3" className="pfd-tag-bg" />
            <text x="800" y="453" className="pfd-tag-text">D-101</text>
            <text x="800" y="472" className="pfd-unit-stat">
              Purity: {telemetry.distillation?.separation_purity ? `${(telemetry.distillation.separation_purity * 100).toFixed(1)}%` : '98.5%'}
            </text>
            <text x="800" y="484" className="pfd-unit-stat highlight">
              P: {telemetry.distillation?.column_pressure ? `${telemetry.distillation.column_pressure.toFixed(2)} bar` : '1.05 bar'}
            </text>
          </g>

          {/* --- T-104: DISTILLATE STORAGE TANK --- */}
          <g
            className={`pfd-equipment-group ${selectedUnit === 'T-104' ? 'selected' : ''}`}
            onClick={() => handleUnitClick('T-104')}
          >
            <rect x="1030" y="120" width="50" height="70" rx="5" fill="url(#engVesselFill)" stroke="#0f172a" strokeWidth="1.5" filter="url(#pfd-subtle-shadow)" />
            <rect x="1032" y="145" width="46" height="43" rx="3" fill="url(#liquidDistillateGradient)" />
            <rect x="1030" y="200" width="50" height="16" rx="3" className="pfd-tag-bg" />
            <text x="1055" y="212" className="pfd-tag-text">T-104</text>
            <text x="1055" y="170" className="pfd-unit-value">PRODUCT</text>
          </g>

          {/* --- T-105: BOTTOMS STORAGE TANK --- */}
          <g
            className={`pfd-equipment-group ${selectedUnit === 'T-105' ? 'selected' : ''}`}
            onClick={() => handleUnitClick('T-105')}
          >
            <rect x="1030" y="350" width="50" height="70" rx="5" fill="url(#engVesselFill)" stroke="#0f172a" strokeWidth="1.5" filter="url(#pfd-subtle-shadow)" />
            <rect x="1032" y="375" width="46" height="43" rx="3" fill="url(#liquidBottomsGradient)" />
            <rect x="1030" y="430" width="50" height="16" rx="3" className="pfd-tag-bg" />
            <text x="1055" y="442" className="pfd-tag-text">T-105</text>
            <text x="1055" y="400" className="pfd-unit-value">HEAVY</text>
          </g>
        </svg>
      </div>

      {/* 4. Deep Interactive Inspector Panel */}
      <div className="pfd-inspector-container">
        <div className="pfd-inspector-header">
          <div className="flex items-center gap-2">
            <button
              className={`pfd-tab-btn ${activeTab === 'equipment' ? 'active' : ''}`}
              onClick={() => setActiveTab('equipment')}
            >
              <Activity className="w-3.5 h-3.5" />
              Equipment Telemetry
            </button>
            <button
              className={`pfd-tab-btn ${activeTab === 'streams' ? 'active' : ''}`}
              onClick={() => setActiveTab('streams')}
            >
              <Droplet className="w-3.5 h-3.5" />
              Process Streams (S-100 to S-106)
            </button>
            <button
              className={`pfd-tab-btn ${activeTab === 'controls' ? 'active' : ''}`}
              onClick={() => setActiveTab('controls')}
            >
              <Sliders className="w-3.5 h-3.5" />
              Causal Process Actuators
            </button>
          </div>

          <div className="flex items-center gap-3">
            {onAskAiAbout && selectedUnit && (
              <button
                className="panel-ask-ai-btn"
                onClick={handleAskAi}
                title="Ask AI Copilot about this equipment unit"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Ask AI Copilot ({selectedUnit})
              </button>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Selected:</span>
              <span className="pfd-target-pill">
                {selectedStream ? `Stream ${selectedStream.id}` : selectedUnit ? `Unit ${selectedUnit}` : 'None'}
              </span>
            </div>
          </div>
        </div>

        <div className="pfd-inspector-body">
          {/* TAB 1: EQUIPMENT DETAIL */}
          {activeTab === 'equipment' && (
            <div className="pfd-tab-content">
              {selectedUnit ? (
                <div>
                  {/* Equipment Header with Causal Role Tag */}
                  <div className="pfd-equipment-banner">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="pfd-equipment-title">
                          {selectedUnit === 'P-101' && 'P-101: Centrifugal Feed Pump'}
                          {selectedUnit === 'E-101' && 'E-101: Shell & Tube Pre-Heater'}
                          {selectedUnit === 'R-101' && 'R-101: Continuous Stirred Tank Reactor (CSTR)'}
                          {selectedUnit === 'D-101' && 'D-101: Binary Distillation Column'}
                          {selectedUnit === 'T-100' && 'T-100: Raw Feed Storage Tank'}
                          {selectedUnit === 'T-104' && 'T-104: Distillate Product Tank'}
                          {selectedUnit === 'T-105' && 'T-105: Bottoms Heavy Residue Tank'}
                        </h3>
                        {(() => {
                          const causal = getCausalRole(selectedUnit);
                          return (
                            <span className={`prop-tag ${causal.badgeClass}`}>
                              {causal.role}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="pfd-causal-desc">{getCausalRole(selectedUnit).desc}</p>
                    </div>

                    {/* Topology Connectivity */}
                    <div className="pfd-topology-card">
                      <div className="pfd-topology-step">
                        <span className="pfd-topology-label">Upstream</span>
                        <span className="pfd-topology-value">{currentTopology?.upstream || 'None (Source)'}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <div className="pfd-topology-step highlight">
                        <span className="pfd-topology-label">Active Unit</span>
                        <span className="pfd-topology-value">{selectedUnit}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <div className="pfd-topology-step">
                        <span className="pfd-topology-label">Downstream</span>
                        <span className="pfd-topology-value">{currentTopology?.downstream || 'None (Sink)'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Calculated Properties Grid */}
                  <div className="pfd-props-grid">
                    {selectedUnit === 'P-101' && (
                      <>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Impeller Speed (RPM)</span>
                          <span className="pfd-prop-val mono">{telemetry.pump?.rpm ? Math.round(telemetry.pump.rpm) : 2900}</span>
                          <span className="pfd-prop-baseline">Baseline: 2900 RPM</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Discharge Flow Rate</span>
                          <span className="pfd-prop-val mono">{telemetry.pump?.flow_rate ? `${telemetry.pump.flow_rate.toFixed(2)} L/min` : '10.00 L/min'}</span>
                          <span className="pfd-prop-baseline">Design: 10.00 L/min</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Developed Head (H)</span>
                          <span className="pfd-prop-val mono">{telemetry.pump?.head ? `${telemetry.pump.head.toFixed(2)} m` : '24.50 m'}</span>
                          <span className="pfd-prop-baseline">Design: 25.00 m</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Shaft Power</span>
                          <span className="pfd-prop-val mono">{telemetry.pump?.power_kw ? `${telemetry.pump.power_kw.toFixed(2)} kW` : '1.45 kW'}</span>
                          <span className="pfd-prop-baseline">Nominal: 1.45 kW</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Hydraulic Efficiency</span>
                          <span className="pfd-prop-val mono">{telemetry.pump?.efficiency ? `${(telemetry.pump.efficiency * 100).toFixed(1)}%` : '85.0%'}</span>
                          <span className="pfd-prop-baseline">BEP: 85.0%</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Vibration FFT Peak</span>
                          <span className="pfd-prop-val mono">{telemetry.pump?.vibration ? `${telemetry.pump.vibration.toFixed(2)} mm/s` : '1.20 mm/s'}</span>
                          <span className="pfd-prop-baseline">ISO Limit: 2.80 mm/s</span>
                        </div>
                      </>
                    )}

                    {selectedUnit === 'E-101' && (
                      <>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Feed Outlet Temp (Tout)</span>
                          <span className="pfd-prop-val mono">{telemetry.heat_exchanger?.temp_out ? `${telemetry.heat_exchanger.temp_out.toFixed(1)} °C` : '45.0 °C'}</span>
                          <span className="pfd-prop-baseline">Target Setpoint: 45.0 °C</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Overall Coeff (U)</span>
                          <span className="pfd-prop-val mono">{telemetry.heat_exchanger?.overall_u ? `${telemetry.heat_exchanger.overall_u.toFixed(1)} W/m²K` : '850.0 W/m²K'}</span>
                          <span className="pfd-prop-baseline">Clean U: 850 W/m²K</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Thermal Duty (Q)</span>
                          <span className="pfd-prop-val mono">{telemetry.heat_exchanger?.heat_duty ? `${telemetry.heat_exchanger.heat_duty.toFixed(2)} kW` : '13.95 kW'}</span>
                          <span className="pfd-prop-baseline">Design Duty: 14.0 kW</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Fouling Resistance (Rf)</span>
                          <span className="pfd-prop-val mono">{telemetry.heat_exchanger?.fouling_factor ? `${(telemetry.heat_exchanger.fouling_factor * 1000).toFixed(3)} m²K/kW` : '0.000 m²K/kW'}</span>
                          <span className="pfd-prop-baseline">TEMA Max: 0.150 m²K/kW</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Tube Delta P</span>
                          <span className="pfd-prop-val mono">{telemetry.heat_exchanger?.delta_p ? `${telemetry.heat_exchanger.delta_p.toFixed(3)} bar` : '0.100 bar'}</span>
                          <span className="pfd-prop-baseline">Nominal: 0.100 bar</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Thermal Health Condition</span>
                          <span className="pfd-prop-val mono">
                            {typeof telemetry.heat_exchanger?.thermal_condition === 'number'
                              ? `${(Number(telemetry.heat_exchanger.thermal_condition) * 100).toFixed(1)}%`
                              : String(telemetry.heat_exchanger?.thermal_condition || 'Clean (100%)').toUpperCase()}
                          </span>
                          <span className="pfd-prop-baseline">Threshold: 70.0% Clean</span>
                        </div>
                      </>
                    )}

                    {selectedUnit === 'R-101' && (
                      <>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Reactor Core Temp</span>
                          <span className="pfd-prop-val mono">{telemetry.reactor?.temperature ? `${telemetry.reactor.temperature.toFixed(1)} °C` : '85.0 °C'}</span>
                          <span className="pfd-prop-baseline">Setpoint: 85.0 °C</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Chemical Conversion (X_A)</span>
                          <span className="pfd-prop-val mono">{telemetry.reactor?.conversion !== undefined ? `${(telemetry.reactor.conversion * 100).toFixed(2)}%` : '78.20%'}</span>
                          <span className="pfd-prop-baseline">Design: 78.00%</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Mean Residence Time (tau)</span>
                          <span className="pfd-prop-val mono">{telemetry.reactor?.residence_time ? `${telemetry.reactor.residence_time.toFixed(1)} min` : '50.0 min'}</span>
                          <span className="pfd-prop-baseline">Design: 50.0 min</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Jacket Heat Removal</span>
                          <span className="pfd-prop-val mono">{telemetry.reactor?.heat_removal ? `${telemetry.reactor.heat_removal.toFixed(2)} kW` : '12.40 kW'}</span>
                          <span className="pfd-prop-baseline">Duty Match: 12.4 kW</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Exothermic Heat Gen</span>
                          <span className="pfd-prop-val mono">{telemetry.reactor?.heat_generation ? `${telemetry.reactor.heat_generation.toFixed(2)} kW` : '12.40 kW'}</span>
                          <span className="pfd-prop-baseline">Nominal: 12.4 kW</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Cooling Jacket Flow</span>
                          <span className="pfd-prop-val mono">{telemetry.reactor?.cooling_flow ? `${telemetry.reactor.cooling_flow.toFixed(1)} L/min` : '15.0 L/min'}</span>
                          <span className="pfd-prop-baseline">Nominal: 15.0 L/min</span>
                        </div>
                      </>
                    )}

                    {selectedUnit === 'D-101' && (
                      <>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Distillate Purity (x_D)</span>
                          <span className="pfd-prop-val mono">{telemetry.distillation?.separation_purity ? `${(telemetry.distillation.separation_purity * 100).toFixed(2)}%` : '98.50%'}</span>
                          <span className="pfd-prop-baseline">Spec: &gt; 98.0%</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Internal Reflux Ratio (R/D)</span>
                          <span className="pfd-prop-val mono">{telemetry.distillation?.reflux_ratio ? telemetry.distillation.reflux_ratio.toFixed(2) : '1.25'}</span>
                          <span className="pfd-prop-baseline">Target: 1.25</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Column Top Pressure</span>
                          <span className="pfd-prop-val mono">{telemetry.distillation?.column_pressure ? `${telemetry.distillation.column_pressure.toFixed(3)} bar` : '1.050 bar'}</span>
                          <span className="pfd-prop-baseline">Atm Setpoint: 1.050 bar</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Reboiler Heat Duty</span>
                          <span className="pfd-prop-val mono">{telemetry.distillation?.reboiler_duty ? `${telemetry.distillation.reboiler_duty.toFixed(2)} kW` : '18.50 kW'}</span>
                          <span className="pfd-prop-baseline">Design: 18.5 kW</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Condenser Cooling Duty</span>
                          <span className="pfd-prop-val mono">{telemetry.distillation?.condenser_duty ? `${telemetry.distillation.condenser_duty.toFixed(2)} kW` : '16.20 kW'}</span>
                          <span className="pfd-prop-baseline">Design: 16.2 kW</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Sump Liquid Level</span>
                          <span className="pfd-prop-val mono">{telemetry.distillation?.bottoms_level ? `${telemetry.distillation.bottoms_level.toFixed(1)}%` : '55.0%'}</span>
                          <span className="pfd-prop-baseline">Control Band: 40-70%</span>
                        </div>
                      </>
                    )}

                    {(selectedUnit === 'T-100' || selectedUnit === 'T-104' || selectedUnit === 'T-105') && (
                      <>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Vessel Volume</span>
                          <span className="pfd-prop-val mono">500.0 L</span>
                          <span className="pfd-prop-baseline">Design Capacity</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Tank Level</span>
                          <span className="pfd-prop-val mono">{selectedUnit === 'T-100' ? '75.0%' : selectedUnit === 'T-104' ? '62.4%' : '48.1%'}</span>
                          <span className="pfd-prop-baseline">Normal Operating Range</span>
                        </div>
                        <div className="pfd-prop-card">
                          <span className="pfd-prop-label">Operating Pressure</span>
                          <span className="pfd-prop-val mono">1.013 bar</span>
                          <span className="pfd-prop-baseline">Atmospheric Vented</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="pfd-empty-state">
                  <Info className="w-6 h-6 text-slate-400" />
                  <p>Click on any equipment unit in the flowsheet diagram to view engineering properties and causal links.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STREAMS TABLE */}
          {activeTab === 'streams' && (
            <div className="pfd-tab-content">
              <div className="pfd-streams-table-wrapper">
                <table className="pfd-streams-table">
                  <thead>
                    <tr>
                      <th>Stream Tag</th>
                      <th>Description</th>
                      <th>Origin &rarr; Destination</th>
                      <th>Flow Rate (L/min)</th>
                      <th>Temperature (°C)</th>
                      <th>Pressure (bar)</th>
                      <th>Key Composition</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {streams.map((stream) => (
                      <tr
                        key={stream.id}
                        className={`pfd-stream-row ${selectedStream?.id === stream.id ? 'active' : ''}`}
                        onClick={() => handleStreamClick(stream)}
                      >
                        <td className="font-mono font-bold text-sky-700">{stream.id}</td>
                        <td className="text-slate-800">{stream.name}</td>
                        <td className="font-mono text-xs text-slate-500">{stream.from} &rarr; {stream.to}</td>
                        <td className="font-mono font-bold text-slate-900">{(stream.flow_rate ?? stream.flow ?? 10.0).toFixed(2)}</td>
                        <td className="font-mono text-slate-700">{stream.temperature.toFixed(1)}</td>
                        <td className="font-mono text-slate-700">{stream.pressure.toFixed(2)}</td>
                        <td className="font-mono text-xs text-slate-600">
                          {stream.composition
                            ? Object.entries(stream.composition)
                                .map(([k, v]) => `${k.replace('_', ' ')}: ${(Number(v) * 100).toFixed(1)}%`)
                                .join(', ')
                            : 'N/A'}
                        </td>
                        <td>
                          <span className={`pfd-stream-status-pill ${stream.status}`}>
                            {stream.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedStream && (
                <div className="pfd-stream-detail-box">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sky-800">Stream {selectedStream.id}: {selectedStream.name}</h4>
                    <span className={`pfd-stream-status-pill ${selectedStream.status}`}>
                      {selectedStream.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    Calculated from first-principles mass and enthalpy balance connecting upstream unit <strong>{selectedStream.from}</strong> to downstream unit <strong>{selectedStream.to}</strong>.
                  </p>
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-slate-500 block mb-1">Volumetric Flow</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">{(selectedStream.flow_rate ?? selectedStream.flow ?? 10.0).toFixed(2)} L/min</span>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-slate-500 block mb-1">Stream Enthalpy Temp</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">{selectedStream.temperature.toFixed(1)} °C</span>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-slate-500 block mb-1">Hydraulic Pressure</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">{selectedStream.pressure.toFixed(2)} bar</span>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-slate-500 block mb-1">Pipeline Velocity</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">{((selectedStream.flow_rate ?? selectedStream.flow ?? 10.0) * 0.12).toFixed(2)} m/s</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SIMULATION CONTROLS */}
          {activeTab === 'controls' && (
            <div className="pfd-tab-content">
              <div className="pfd-controls-intro">
                <Sliders className="w-4 h-4 text-sky-700" />
                <p className="text-xs text-slate-700">
                  Manipulate real-time boundary conditions and equipment actuators. Changes propagate dynamically through the causal first-principles simulation loop (P-101 &rarr; E-101 &rarr; R-101 &rarr; D-101).
                </p>
              </div>

              <div className="pfd-controls-grid">
                {/* P-101 Pump Controls */}
                <div className="pfd-control-card">
                  <h4 className="pfd-control-heading">P-101 Pump Controls</h4>
                  <div className="pfd-control-field">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Pump RPM Setpoint</span>
                      <span className="font-mono font-bold text-sky-700">{localControls.pump_rpm ?? telemetry.pump?.rpm ?? 2900} RPM</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3500"
                      step="50"
                      value={localControls.pump_rpm ?? telemetry.pump?.rpm ?? 2900}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalControls(prev => ({ ...prev, pump_rpm: val }));
                        handleApplyControlChange({ pump_rpm: val });
                      }}
                      className="pfd-range-slider"
                    />
                  </div>

                  <div className="pfd-control-field">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Suction Line Throttling</span>
                      <span className="font-mono font-bold text-amber-700">{((localControls.suction_restriction ?? 0) * 100).toFixed(0)}% Restricted</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.9"
                      step="0.05"
                      value={localControls.suction_restriction ?? 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalControls(prev => ({ ...prev, suction_restriction: val }));
                        handleApplyControlChange({ suction_restriction: val });
                      }}
                      className="pfd-range-slider"
                    />
                  </div>
                </div>

                {/* E-101 Exchanger Controls */}
                <div className="pfd-control-card">
                  <h4 className="pfd-control-heading">E-101 Exchanger Fouling</h4>
                  <div className="pfd-control-field">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Tube Fouling Level (Rf)</span>
                      <span className="font-mono font-bold text-amber-700">{((localControls.fouling_level ?? 0) * 100).toFixed(0)}% Fouled</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.8"
                      step="0.05"
                      value={localControls.fouling_level ?? 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalControls(prev => ({ ...prev, fouling_level: val }));
                        handleApplyControlChange({ fouling_level: val });
                      }}
                      className="pfd-range-slider"
                    />
                  </div>

                  <div className="pfd-control-field">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Exchanger Heat Duty Multiplier</span>
                      <span className="font-mono font-bold text-sky-700">{(localControls.heat_exchanger_efficiency ?? 1.0).toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="1.5"
                      step="0.05"
                      value={localControls.heat_exchanger_efficiency ?? 1.0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalControls(prev => ({ ...prev, heat_exchanger_efficiency: val }));
                        handleApplyControlChange({ heat_exchanger_efficiency: val });
                      }}
                      className="pfd-range-slider"
                    />
                  </div>
                </div>

                {/* R-101 Reactor Controls */}
                <div className="pfd-control-card">
                  <h4 className="pfd-control-heading">R-101 Reactor Jacket &amp; Kinetics</h4>
                  <div className="pfd-control-field">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Cooling Water Flow</span>
                      <span className="font-mono font-bold text-sky-700">{localControls.reactor_cooling_flow ?? telemetry.reactor?.cooling_flow ?? 15.0} L/min</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="1"
                      value={localControls.reactor_cooling_flow ?? telemetry.reactor?.cooling_flow ?? 15.0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalControls(prev => ({ ...prev, reactor_cooling_flow: val }));
                        handleApplyControlChange({ reactor_cooling_flow: val });
                      }}
                      className="pfd-range-slider"
                    />
                  </div>

                  <div className="pfd-control-field">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Agitator Speed</span>
                      <span className="font-mono font-bold text-emerald-700">{localControls.agitator_speed_rpm ?? 350} RPM</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="600"
                      step="25"
                      value={localControls.agitator_speed_rpm ?? 350}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalControls(prev => ({ ...prev, agitator_speed_rpm: val }));
                        handleApplyControlChange({ agitator_speed_rpm: val });
                      }}
                      className="pfd-range-slider"
                    />
                  </div>
                </div>

                {/* D-101 Distillation Controls */}
                <div className="pfd-control-card">
                  <h4 className="pfd-control-heading">D-101 Column Reflux &amp; Reboiler</h4>
                  <div className="pfd-control-field">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Reflux Ratio Setpoint (R/D)</span>
                      <span className="font-mono font-bold text-sky-700">{localControls.reflux_ratio ?? telemetry.distillation?.reflux_ratio ?? 1.25}</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.05"
                      value={localControls.reflux_ratio ?? telemetry.distillation?.reflux_ratio ?? 1.25}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalControls(prev => ({ ...prev, reflux_ratio: val }));
                        handleApplyControlChange({ reflux_ratio: val });
                      }}
                      className="pfd-range-slider"
                    />
                  </div>

                  <div className="pfd-control-field">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Reboiler Duty Mod</span>
                      <span className="font-mono font-bold text-amber-700">{(localControls.reboiler_duty_mod ?? 1.0).toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="2.0"
                      step="0.05"
                      value={localControls.reboiler_duty_mod ?? 1.0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalControls(prev => ({ ...prev, reboiler_duty_mod: val }));
                        handleApplyControlChange({ reboiler_duty_mod: val });
                      }}
                      className="pfd-range-slider"
                    />
                  </div>
                </div>
              </div>

              <div className="pfd-controls-footer">
                <button
                  className="pfd-btn-secondary"
                  onClick={handleReset}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Engineering Baseline
                </button>
                {isUpdatingControls && (
                  <span className="text-xs text-sky-700 animate-pulse flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> Propagating changes through causal flowsheet...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
