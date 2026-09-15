import React, { useState, useEffect } from 'react';
import {
  ProcessUpdatePayload,
  ProcessGraphNode,
  ProcessGraphConnection,
  ProcessNodeRole
} from '../types';
import {
  updateSimulatorControls,
  resetSimulatorControls,
  updateWorkflow,
  resetWorkflow
} from '../services/api';
import {
  Activity,
  Flame,
  Atom,
  Layers,
  ArrowRight,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Edit3,
  Zap,
  Info,
  Link,
  Cpu
} from 'lucide-react';

interface ProcessWorkflowSectionProps {
  state: ProcessUpdatePayload;
  selectedEquipment: string; // 'pump' | 'heat_exchanger' | 'reactor' | 'distillation'
  onSelectEquipment: (id: string) => void;
  onAskAiAboutEquipment: (id: string) => void;
}

export const ProcessWorkflowSection: React.FC<ProcessWorkflowSectionProps> = ({
  state,
  selectedEquipment,
  onSelectEquipment,
  onAskAiAboutEquipment
}) => {
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isApplyingControls, setIsApplyingControls] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);

  // Local simulation slider states for responsive immediate feedback
  const [pumpRpm, setPumpRpm] = useState<number>(state.equipment?.pump?.data?.rpm || 2450);
  const [hxEffic, setHxEffic] = useState<number>(state.equipment?.heat_exchanger?.data?.efficiency || 95.0);
  const [coolingStatus, setCoolingStatus] = useState<number>(state.equipment?.reactor?.data?.cooling_status ?? 1);
  const [agitatorSpeed, setAgitatorSpeed] = useState<number>(state.equipment?.reactor?.data?.agitator_speed || 350);
  const [refluxRatio, setRefluxRatio] = useState<number>(state.equipment?.distillation?.data?.reflux_ratio || 1.85);

  // Sync sliders when backend state updates (unless user is actively dragging)
  useEffect(() => {
    if (!isApplyingControls) {
      if (state.equipment?.pump?.data?.rpm) setPumpRpm(Math.round(state.equipment.pump.data.rpm));
      if (state.equipment?.heat_exchanger?.data?.efficiency) setHxEffic(Math.round(state.equipment.heat_exchanger.data.efficiency));
      if (state.equipment?.reactor?.data?.cooling_status !== undefined) setCoolingStatus(state.equipment.reactor.data.cooling_status);
      if (state.equipment?.reactor?.data?.agitator_speed) setAgitatorSpeed(Math.round(state.equipment.reactor.data.agitator_speed));
      if (state.equipment?.distillation?.data?.reflux_ratio) setRefluxRatio(Number(state.equipment.distillation.data.reflux_ratio.toFixed(2)));
    }
  }, [state.equipment, isApplyingControls]);

  // Map equipment id to node tag
  const equipmentTagMap: Record<string, string> = {
    pump: 'P-101',
    heat_exchanger: 'E-101',
    reactor: 'R-101',
    distillation: 'D-101'
  };

  const tagToEquipmentMap: Record<string, string> = {
    'P-101': 'pump',
    'E-101': 'heat_exchanger',
    'R-101': 'reactor',
    'D-101': 'distillation'
  };

  const selectedNodeTag = equipmentTagMap[selectedEquipment] || 'P-101';

  // Extract workflow data safely from state or fallback
  const workflow = state.workflow || {
    sequence: ['P-101', 'E-101', 'R-101', 'D-101'],
    nodes: {
      'P-101': { id: 'P-101', equipmentId: 'pump', name: 'Centrifugal Feed Pump', type: 'PUMP', enabled: true, role: 'PRIMARY_SOURCE' as ProcessNodeRole },
      'E-101': { id: 'E-101', equipmentId: 'heat_exchanger', name: 'Shell & Tube Exchanger', type: 'HEAT_EXCHANGER', enabled: true, role: 'NOMINAL' as ProcessNodeRole },
      'R-101': { id: 'R-101', equipmentId: 'reactor', name: 'CSTR Reactor', type: 'CSTR', enabled: true, role: 'NOMINAL' as ProcessNodeRole },
      'D-101': { id: 'D-101', equipmentId: 'distillation', name: 'Distillation Column', type: 'DISTILLATION', enabled: true, role: 'NOMINAL' as ProcessNodeRole }
    },
    connections: [
      { id: 'P101_E101', from: 'P-101', to: 'E-101', streamId: '02', flow: state.equipment?.pump?.data?.flow || 10.0 },
      { id: 'E101_R101', from: 'E-101', to: 'R-101', streamId: '03', flow: state.equipment?.heat_exchanger?.data?.flow || 9.9 },
      { id: 'R101_D101', from: 'R-101', to: 'D-101', streamId: '04', flow: state.equipment?.reactor?.data?.feed_flow || 9.8 }
    ],
    availableTypes: [
      { type: 'PUMP', name: 'Centrifugal Pump', defaultTag: 'P-102', description: 'Liquid feed pressurization and flow driver', maxInputs: 1, maxOutputs: 1 },
      { type: 'HEAT_EXCHANGER', name: 'Shell & Tube Exchanger', defaultTag: 'E-102', description: 'Counter-flow thermal conditioning', maxInputs: 1, maxOutputs: 1 },
      { type: 'CSTR', name: 'Continuous Stirred Tank', defaultTag: 'R-102', description: 'Exothermic jacketed chemical conversion', maxInputs: 1, maxOutputs: 1 },
      { type: 'DISTILLATION', name: 'Fractionation Column', defaultTag: 'D-102', description: 'Vapor-liquid binary separation', maxInputs: 1, maxOutputs: 2 },
      { type: 'TANK', name: 'Buffer Storage Tank', defaultTag: 'T-101', description: 'Surge buffering and inventory hold-up', maxInputs: 2, maxOutputs: 2 },
      { type: 'VALVE', name: 'Control Valve', defaultTag: 'V-101', description: 'In-line pressure drop and flow throttling', maxInputs: 1, maxOutputs: 1 },
      { type: 'COMPRESSOR', name: 'Gas Compressor', defaultTag: 'C-101', description: 'Vapor compression and head boost', maxInputs: 1, maxOutputs: 1 },
      { type: 'SEPARATOR', name: 'Flash Separator', defaultTag: 'S-101', description: 'Gravity vapor-liquid phase flash split', maxInputs: 1, maxOutputs: 2 },
      { type: 'HEATER', name: 'Fired Heater', defaultTag: 'H-101', description: 'Direct thermal enthalpy input', maxInputs: 1, maxOutputs: 1 },
      { type: 'COOLER', name: 'Utility Cooler', defaultTag: 'CLR-101', description: 'Cooling water heat dissipation', maxInputs: 1, maxOutputs: 1 },
      { type: 'MIXER', name: 'In-Line Mixer', defaultTag: 'M-101', description: 'Multi-stream blending manifold', maxInputs: 2, maxOutputs: 1 },
      { type: 'PFR', name: 'Plug Flow Reactor', defaultTag: 'PFR-101', description: 'Tubular continuous conversion reactor', maxInputs: 1, maxOutputs: 1 }
    ],
    isValid: true,
    validationMessage: 'Process flow train is continuous and valid.'
  };

  const nodes = workflow.nodes || {};
  const sequence = workflow.sequence || ['P-101', 'E-101', 'R-101', 'D-101'];
  const connections = workflow.connections || [];

  // Handle Parameter Adjustments (What-If Experimentation)
  const handleRpmChange = async (newRpm: number) => {
    setPumpRpm(newRpm);
    setIsApplyingControls(true);
    try {
      await updateSimulatorControls({ pump_rpm: newRpm });
      setFeedbackMsg({ text: `P-101 speed adjusted to ${newRpm} RPM → Recalculating causal train flow...`, type: 'success' });
    } catch (e) {
      console.error('Failed to update RPM:', e);
    } finally {
      setTimeout(() => setIsApplyingControls(false), 800);
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  const handleEfficiencyChange = async (newEff: number) => {
    setHxEffic(newEff);
    setIsApplyingControls(true);
    try {
      await updateSimulatorControls({ heat_exchanger_efficiency: newEff });
      setFeedbackMsg({ text: `E-101 efficiency adjusted to ${newEff}% → Thermal gradient propagating downstream...`, type: 'success' });
    } catch (e) {
      console.error('Failed to update efficiency:', e);
    } finally {
      setTimeout(() => setIsApplyingControls(false), 800);
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  const handleCoolingToggle = async (newCooling: number) => {
    setCoolingStatus(newCooling);
    setIsApplyingControls(true);
    try {
      await updateSimulatorControls({ cooling_status: newCooling });
      setFeedbackMsg({ text: `R-101 cooling jacket set to ${newCooling === 1 ? 'ACTIVE (1)' : 'TRIPPED (0)'} → Kinetics responding...`, type: 'success' });
    } catch (e) {
      console.error('Failed to update cooling:', e);
    } finally {
      setTimeout(() => setIsApplyingControls(false), 800);
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  const handleAgitatorChange = async (newSpeed: number) => {
    setAgitatorSpeed(newSpeed);
    setIsApplyingControls(true);
    try {
      await updateSimulatorControls({ agitator_speed: newSpeed });
    } catch (e) {
      console.error('Failed to update agitator:', e);
    } finally {
      setTimeout(() => setIsApplyingControls(false), 800);
    }
  };

  const handleRefluxChange = async (newReflux: number) => {
    setRefluxRatio(newReflux);
    setIsApplyingControls(true);
    try {
      await updateSimulatorControls({ reflux_ratio: newReflux });
      setFeedbackMsg({ text: `D-101 reflux ratio adjusted to ${newReflux.toFixed(2)} → Fractionation equilibria updating...`, type: 'success' });
    } catch (e) {
      console.error('Failed to update reflux:', e);
    } finally {
      setTimeout(() => setIsApplyingControls(false), 800);
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  // Handle Workflow Reset
  const handleResetWorkflow = async () => {
    setIsResetting(true);
    try {
      await resetWorkflow('Plant Operator');
      setFeedbackMsg({ text: 'Workflow restored to default P-101 → E-101 → R-101 → D-101 at nominal steady state.', type: 'success' });
    } catch (e) {
      console.error('Failed to reset workflow:', e);
    } finally {
      setIsResetting(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Reorder sequence
  const handleMoveUnit = async (idx: number, direction: 'left' | 'right') => {
    const newSeq = [...sequence];
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newSeq.length) return;

    const temp = newSeq[idx];
    newSeq[idx] = newSeq[targetIdx];
    newSeq[targetIdx] = temp;

    // Regenerate sequential connections
    const newConns: ProcessGraphConnection[] = [];
    for (let i = 0; i < newSeq.length - 1; i++) {
      newConns.push({
        id: `${newSeq[i].replace('-', '')}_${newSeq[i + 1].replace('-', '')}`,
        from: newSeq[i],
        to: newSeq[i + 1],
        streamId: `0${i + 2}`,
        flow: 10.0,
        status: 'CONNECTED',
        valid: true
      });
    }

    try {
      await updateWorkflow({ sequence: newSeq, connections: newConns });
      setFeedbackMsg({ text: `Workflow train reordered: ${newSeq.join(' → ')}`, type: 'success' });
    } catch (e) {
      console.error('Failed to reorder workflow:', e);
    }
  };

  // Helper for node icon
  const getNodeIcon = (type: string, tag: string) => {
    if (tag.startsWith('P') || type === 'PUMP') return <Activity size={15} color="#EA580C" />;
    if (tag.startsWith('E') || type === 'HEAT_EXCHANGER') return <Flame size={15} color="#0891B2" />;
    if (tag.startsWith('R') || type === 'CSTR') return <Atom size={15} color="#7C3AED" />;
    if (tag.startsWith('D') || type === 'DISTILLATION') return <Layers size={15} color="#2563EB" />;
    return <Cpu size={15} color="#64748B" />;
  };

  // Helper for role badge styling
  const getRoleBadge = (role?: ProcessNodeRole) => {
    switch (role) {
      case 'PRIMARY_FAULT':
        return <span className="workflow-role-badge primary-fault"><AlertTriangle size={10} /> PRIMARY FAULT</span>;
      case 'PRIMARY_DEGRADATION':
        return <span className="workflow-role-badge primary-degradation"><AlertTriangle size={10} /> PRIMARY DEGRADATION</span>;
      case 'DOWNSTREAM_EFFECT':
        return <span className="workflow-role-badge downstream-effect"><Link size={10} /> DOWNSTREAM EFFECT</span>;
      case 'PRIMARY_SOURCE':
        return <span className="workflow-role-badge primary-source"><Zap size={10} /> PRIMARY SOURCE</span>;
      default:
        return <span className="workflow-role-badge nominal"><CheckCircle2 size={10} /> NOMINAL</span>;
    }
  };

  // Get live primary variable string for node
  const getNodeLiveMetric = (tag: string) => {
    const eq = state.equipment;
    if (tag === 'P-101') {
      return `${Math.round(eq?.pump?.data?.rpm || 2450)} RPM · ${(eq?.pump?.data?.flow || 10.0).toFixed(1)} L/min`;
    }
    if (tag === 'E-101') {
      return `ΔT ${(eq?.heat_exchanger?.data?.temperature_difference || 12.9).toFixed(1)}°C · ${(eq?.heat_exchanger?.data?.flow || 9.9).toFixed(1)} L/min`;
    }
    if (tag === 'R-101') {
      return `${(eq?.reactor?.data?.temperature || 65.0).toFixed(1)}°C · ${(eq?.reactor?.data?.feed_flow || 9.8).toFixed(1)} L/min`;
    }
    if (tag === 'D-101') {
      return `Reflux ${(eq?.distillation?.data?.reflux_ratio || 1.85).toFixed(2)} · ${(eq?.distillation?.data?.feed_flow || 9.7).toFixed(1)} L/min`;
    }
    return 'Active';
  };

  const getNodeHealth = (tag: string) => {
    const eq = state.equipment;
    if (tag === 'P-101') return eq?.pump?.data?.health ?? 100;
    if (tag === 'E-101') return eq?.heat_exchanger?.data?.health ?? 100;
    if (tag === 'R-101') return eq?.reactor?.data?.health ?? 100;
    if (tag === 'D-101') return eq?.distillation?.data?.health ?? 100;
    return 100;
  };

  return (
    <section className="process-workflow-section" aria-label="Adjustable Causal Process Workflow">
      {/* 1. SECTION HEADER WITH CONTROLS */}
      <div className="workflow-header">
        <div className="workflow-title-block">
          <div className="workflow-badge">CAUSAL PROCESS GRAPH</div>
          <div>
            <h3 className="workflow-title">
              ADJUSTABLE CAUSAL PROCESS WORKFLOW
            </h3>
            <p className="workflow-subtitle">
              Connected Engineering Process Simulation · Dynamic first-order lag propagation across P-101 → E-101 → R-101 → D-101
            </p>
          </div>
        </div>

        <div className="workflow-actions">
          <div className="workflow-status-indicator">
            <span className="status-dot pulse" style={{ background: '#10B981' }}></span>
            <span className="status-text">CAUSALLY CONNECTED</span>
          </div>

          <button
            className={`workflow-btn ${isEditMode ? 'active' : ''}`}
            onClick={() => setIsEditMode(!isEditMode)}
            title="Toggle Workflow Configuration Editor"
          >
            <Edit3 size={12} />
            <span>{isEditMode ? 'CLOSE EDITOR' : 'EDIT WORKFLOW'}</span>
          </button>

          <button
            className="workflow-btn reset"
            onClick={handleResetWorkflow}
            disabled={isResetting}
            title="Restore P-101 → E-101 → R-101 → D-101 standard train & nominal conditions"
          >
            <RotateCcw size={12} className={isResetting ? 'spin-icon' : ''} />
            <span>RESET WORKFLOW</span>
          </button>
        </div>
      </div>

      {/* Notification / Feedback Banner */}
      {feedbackMsg && (
        <div className={`workflow-feedback-banner ${feedbackMsg.type}`}>
          <Info size={14} />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* 2. COMPACT INTERACTIVE PROCESS WORKFLOW STRIP */}
      <div className="workflow-strip-container">
        <div className="workflow-nodes-strip">
          {sequence.map((nodeTag, idx) => {
            const node = nodes[nodeTag] || { id: nodeTag, name: nodeTag, type: 'EQUIPMENT', enabled: true, role: 'NOMINAL' as ProcessNodeRole };
            const isSelected = selectedNodeTag === nodeTag;
            const health = getNodeHealth(nodeTag);
            const liveMetric = getNodeLiveMetric(nodeTag);
            const conn = connections.find(c => c.from === nodeTag);
            const flowVal = conn ? conn.flow : (nodeTag === 'P-101' ? state.equipment?.pump?.data?.flow || 10.0 : null);

            return (
              <React.Fragment key={nodeTag}>
                {/* NODE CARD */}
                <div
                  className={`workflow-node-card ${isSelected ? 'selected' : ''} ${node.role?.toLowerCase() || 'nominal'}`}
                  onClick={() => {
                    const eqId = tagToEquipmentMap[nodeTag] || 'pump';
                    onSelectEquipment(eqId);
                  }}
                  role="button"
                  tabIndex={0}
                  title={`Select ${node.name} to view connections and adjust simulation conditions`}
                >
                  <div className="node-card-top">
                    <div className="node-tag-icon">
                      {getNodeIcon(node.type, nodeTag)}
                      <strong className="node-tag">{nodeTag}</strong>
                    </div>
                    <span className="node-health numeric-data" style={{ color: health < 50 ? '#DC2626' : (health < 80 ? '#D97706' : '#16A34A') }}>
                      {health}%
                    </span>
                  </div>

                  <div className="node-name-label">{node.name || nodeTag}</div>

                  <div className="node-live-metric numeric-data">
                    {liveMetric}
                  </div>

                  <div className="node-role-row">
                    {getRoleBadge(node.role)}
                  </div>

                  {/* Move buttons when in edit mode */}
                  {isEditMode && (
                    <div className="node-edit-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className="node-move-btn"
                        disabled={idx === 0}
                        onClick={() => handleMoveUnit(idx, 'left')}
                        title="Move unit Left"
                      >
                        ←
                      </button>
                      <button
                        className="node-move-btn"
                        disabled={idx === sequence.length - 1}
                        onClick={() => handleMoveUnit(idx, 'right')}
                        title="Move unit Right"
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>

                {/* CONNECTION FLOW ARROW (between nodes) */}
                {idx < sequence.length - 1 && (
                  <div className="workflow-connection-indicator">
                    <div className="connection-flow-badge numeric-data" title="Actual dynamic process flow on stream">
                      <span className="flow-val">{flowVal !== null ? `${flowVal.toFixed(1)} L/min` : '→'}</span>
                    </div>
                    <div className="connection-line-wrapper">
                      <div
                        className="connection-line-active"
                        style={{
                          animationDuration: `${Math.max(0.6, Math.min(3.0, 15.0 / Math.max(1.0, flowVal || 10.0)))}s`
                        }}
                      ></div>
                    </div>
                    <ArrowRight size={14} className="connection-arrow-icon" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 3. SELECTED NODE INSPECTOR & ADJUSTABLE SIMULATION PARAMETERS */}
      <div className="workflow-detail-panel">
        <div className="detail-panel-header">
          <div className="detail-header-title">
            <Sliders size={14} color="var(--primary-blue)" />
            <span>SELECTED EQUIPMENT SIMULATION & WHAT-IF EXPERIMENTATION</span>
            <span className="selected-tag-pill">{selectedNodeTag}</span>
          </div>
          <button
            className="panel-ask-ai-btn"
            onClick={() => onAskAiAboutEquipment(selectedEquipment)}
            title="Analyze selected unit with rich causal upstream/downstream process context"
          >
            <Sparkles size={12} />
            <span>ANALYZE WITH AI</span>
          </button>
        </div>

        <div className="detail-panel-grid">
          {/* LEFT: Equipment Connection State & Causal Role */}
          <div className="detail-info-card">
            <h4 className="card-subhead">Topology & Causal Propagation Status</h4>
            <div className="info-kv-list">
              <div className="info-kv-row">
                <span className="info-k">Equipment:</span>
                <span className="info-v font-bold">{nodes[selectedNodeTag]?.name || selectedNodeTag}</span>
              </div>
              <div className="info-kv-row">
                <span className="info-k">Upstream Connection:</span>
                <span className="info-v text-blue font-mono">{nodes[selectedNodeTag]?.upstreamUnit || (selectedNodeTag === 'P-101' ? 'Raw Water Tank (Feed)' : 'Upstream Stream')}</span>
              </div>
              <div className="info-kv-row">
                <span className="info-k">Downstream Connection:</span>
                <span className="info-v text-blue font-mono">{nodes[selectedNodeTag]?.downstreamUnit || 'Downstream Feed'}</span>
              </div>
              <div className="info-kv-row">
                <span className="info-k">Diagnostic Role:</span>
                <span className="info-v">{getRoleBadge(nodes[selectedNodeTag]?.role)}</span>
              </div>
              <div className="info-kv-row">
                <span className="info-k">Causal Behavior:</span>
                <span className="info-v text-muted" style={{ fontSize: '0.78rem' }}>
                  {nodes[selectedNodeTag]?.role === 'PRIMARY_FAULT' || nodes[selectedNodeTag]?.role === 'PRIMARY_DEGRADATION'
                    ? 'Origin of process disturbance. Flow / thermal deviations causally propagate downstream.'
                    : (nodes[selectedNodeTag]?.role === 'DOWNSTREAM_EFFECT'
                    ? 'Receiving upstream process flow/temperature changes. Responding dynamically with first-order lag.'
                    : 'Operating within nominal baseline bounds.')}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Adjustable Operating Conditions (What-If Sliders) */}
          <div className="detail-controls-card">
            <div className="controls-header-row">
              <h4 className="card-subhead">Adjustable Operating Conditions (What-If Experimentation)</h4>
              <span className="simulation-notice-badge">SIMULATION ONLY</span>
            </div>

            {/* P-101 Controls */}
            {selectedNodeTag === 'P-101' && (
              <div className="control-slider-group">
                <div className="slider-label-row">
                  <span className="slider-name">Pump Rotational Speed (RPM):</span>
                  <span className="slider-val numeric-data font-bold text-blue">{pumpRpm} RPM</span>
                </div>
                <input
                  type="range"
                  min="1600"
                  max="3000"
                  step="25"
                  value={pumpRpm}
                  onChange={(e) => handleRpmChange(Number(e.target.value))}
                  className="interactive-slider"
                />
                <div className="slider-helper-row">
                  <span>1600 RPM (Slow)</span>
                  <span className="font-bold">Calculated Flow: {((pumpRpm / 2450) * 10.0).toFixed(1)} L/min</span>
                  <span>3000 RPM (Fast)</span>
                </div>
                <p className="slider-physics-hint">
                  Changing RPM recalculates hydraulic flow: Q = (RPM / 2450) * 10 L/min. Flow changes dynamically propagate to E-101, R-101, and D-101 with dynamic lag.
                </p>
              </div>
            )}

            {/* E-101 Controls */}
            {selectedNodeTag === 'E-101' && (
              <div className="control-slider-group">
                <div className="slider-label-row">
                  <span className="slider-name">Exchanger Heat Transfer Condition / Efficiency:</span>
                  <span className="slider-val numeric-data font-bold text-blue">{hxEffic}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="100"
                  step="1"
                  value={hxEffic}
                  onChange={(e) => handleEfficiencyChange(Number(e.target.value))}
                  className="interactive-slider"
                />
                <div className="slider-helper-row">
                  <span>30% (Severe Fouling)</span>
                  <span className="font-bold">Nominal ΔT: {(12.9 * (hxEffic / 95.0)).toFixed(1)} °C</span>
                  <span>100% (Clean Bundle)</span>
                </div>
                <p className="slider-physics-hint">
                  Efficiency determines the thermal gradient ΔT = 12.9 * (Eff / 95) * sqrt(Q / 10). Conditioned outlet fluid temperature propagates to CSTR R-101.
                </p>
              </div>
            )}

            {/* R-101 Controls */}
            {selectedNodeTag === 'R-101' && (
              <div className="control-slider-group">
                <div className="slider-label-row">
                  <span className="slider-name">Cooling Jacket Relay Interlock:</span>
                  <button
                    className={`cooling-toggle-btn ${coolingStatus === 1 ? 'on' : 'off'}`}
                    onClick={() => handleCoolingToggle(coolingStatus === 1 ? 0 : 1)}
                  >
                    {coolingStatus === 1 ? 'COOLING ON (1)' : 'COOLING TRIPPED (0)'}
                  </button>
                </div>

                <div className="slider-label-row" style={{ marginTop: '12px' }}>
                  <span className="slider-name">Agitator Speed (RPM):</span>
                  <span className="slider-val numeric-data font-bold text-blue">{agitatorSpeed} RPM</span>
                </div>
                <input
                  type="range"
                  min="150"
                  max="500"
                  step="10"
                  value={agitatorSpeed}
                  onChange={(e) => handleAgitatorChange(Number(e.target.value))}
                  className="interactive-slider"
                />
                <p className="slider-physics-hint">
                  Reactor couples exothermic Arrhenius kinetics with feed throughput and jacket dissipation. Loss of cooling triggers thermal runaway and vapor accumulation.
                </p>
              </div>
            )}

            {/* D-101 Controls */}
            {selectedNodeTag === 'D-101' && (
              <div className="control-slider-group">
                <div className="slider-label-row">
                  <span className="slider-name">Overhead Reflux Ratio (L/D):</span>
                  <span className="slider-val numeric-data font-bold text-blue">{refluxRatio.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="3.20"
                  step="0.05"
                  value={refluxRatio}
                  onChange={(e) => handleRefluxChange(Number(e.target.value))}
                  className="interactive-slider"
                />
                <div className="slider-helper-row">
                  <span>0.50 (Starvation)</span>
                  <span className="font-bold">Nominal: 1.85</span>
                  <span>3.20 (High Reflux)</span>
                </div>
                <p className="slider-physics-hint">
                  Reflux ratio governs fractionation column separation equilibrium, overhead distillate purity, and condenser duty.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. WORKFLOW EDIT DRAWER (Visible when isEditMode is true) */}
      {isEditMode && (
        <div className="workflow-editor-drawer">
          <div className="editor-drawer-header">
            <div className="flex items-center gap-2">
              <Edit3 size={15} color="var(--primary-blue)" />
              <strong style={{ fontSize: '0.9rem' }}>ENGINEERING WORKFLOW TOPOLOGY EDITOR</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className={`validation-status-badge ${workflow.isValid ? 'valid' : 'warning'}`}>
                {workflow.isValid ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                <span>{workflow.validationMessage || (workflow.isValid ? 'Valid Process Flow Train' : 'Connection Warning')}</span>
              </span>
            </div>
          </div>

          <div className="editor-drawer-body">
            <p className="editor-instructions">
              Reorder sequence nodes using arrows, or restore default P-101 → E-101 → R-101 → D-101 configuration. All units must be hydraulically continuous.
            </p>

            <div className="editor-sequence-builder">
              {sequence.map((nodeTag, i) => (
                <div key={nodeTag} className="editor-unit-pill">
                  <span className="unit-idx">{i + 1}</span>
                  <strong>{nodeTag}</strong>
                  <span className="unit-type-label">{nodes[nodeTag]?.type || 'UNIT'}</span>
                  <div className="unit-order-buttons">
                    <button
                      disabled={i === 0}
                      onClick={() => handleMoveUnit(i, 'left')}
                      title="Move Left"
                    >
                      ←
                    </button>
                    <button
                      disabled={i === sequence.length - 1}
                      onClick={() => handleMoveUnit(i, 'right')}
                      title="Move Right"
                    >
                      →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="editor-extensible-catalog">
              <h5 className="catalog-title">Extensible Equipment Catalog (Future Train Units)</h5>
              <div className="catalog-grid">
                {(workflow.availableTypes || []).map((t) => (
                  <div key={t.type} className="catalog-item">
                    <div className="catalog-item-header">
                      <strong>{t.defaultTag}</strong>
                      <span className="catalog-type">{t.type}</span>
                    </div>
                    <div className="catalog-item-desc">{t.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
