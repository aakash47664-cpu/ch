import React, { useState, useEffect } from 'react';
import {
  ProcessUpdatePayload,
  FaultMode,
  TimeSeriesPoint,
  AlertItem,
  IntelligentAlert
} from './types';
import { wsClient } from './services/websocket';
import { fetchAlerts, setDemoFault } from './services/api';

import { Navbar } from './components/Navbar';
import { DemoModeBar } from './components/DemoModeBar';
import { ProcessFlowsheet } from './components/ProcessFlowsheet';
import { AiDiagnosisPanel } from './components/AiDiagnosisPanel';
import { EquipmentCardsGrid } from './components/EquipmentCard';
import { LiveCharts } from './components/LiveCharts';
import { AlertsPanel } from './components/AlertsPanel';
import { ActiveAlertsCard } from './components/ActiveAlertsCard';
import { ProcessHealthHeader } from './components/ProcessHealthHeader';
import { EquipmentHealthGrid } from './components/EquipmentHealthGrid';
import { EarlyWarningsSection } from './components/EarlyWarningsSection';
import { WatchListAndChanges } from './components/WatchListAndChanges';
import { EarlyWarningTimeline } from './components/EarlyWarningTimeline';
import { EquipmentDetailDrawer } from './components/EquipmentDetailDrawer';
import { EarlyFaultMonitoringCockpit } from './components/EarlyFaultMonitoringCockpit';
import { ProcessWorkflowSection } from './components/ProcessWorkflowSection';

import {
  LayoutDashboard,
  Activity,
  Flame,
  Atom,
  Cpu,
  Layers,
  BrainCircuit,
  Bell,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Network
} from 'lucide-react';



const INITIAL_STATE: ProcessUpdatePayload = {
  type: 'PROCESS_UPDATE',
  timestamp: new Date().toISOString(),
  active_fault_mode: 'normal',
  fault_severity: 0.0,
  esp32_status: {
    connected: false,
    status: 'ESP32 OFFLINE',
    message: 'Waiting for real ESP32 sensor data'
  },
  equipment: {
    pump: {
      id: 'pump',
      name: 'Pump (6V Mini Centrifugal)',
      source: 'demo',
      source_label: 'DEMO / SIMULATED',
      data: { rpm: 2450, vibration: 0.08, flow: 10.0, inlet_temperature: 25.2, outlet_temperature: 38.1, health: 100 }
    },
    heat_exchanger: {
      id: 'heat_exchanger',
      name: 'Heat Exchanger (Shell & Tube)',
      source: 'demo',
      source_label: 'DEMO / SIMULATED',
      data: { inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, heat_transfer_indicator: 95.0, efficiency: 95.0, health: 100 }
    },
    reactor: {
      id: 'reactor',
      name: 'Continuous Stirred-Tank Reactor (CSTR)',
      source: 'simulated',
      source_label: 'SIMULATED DATA',
      data: { temperature: 65.0, pressure: 2.05, level: 50.0, agitator_speed: 350, cooling_status: 1, health: 100 }
    },
    distillation: {
      id: 'distillation',
      name: 'Binary Distillation Column',
      source: 'simulated',
      source_label: 'SIMULATED DATA',
      data: { top_temperature: 76.5, bottom_temperature: 98.4, pressure: 2.10, level: 52.0, reflux_ratio: 1.85, health: 100 }
    }
  },
  diagnosis: {
    equipment: 'All Units',
    anomaly: false,
    anomaly_score: 0.18,
    is_unknown_fault: false,
    fault: 'normal',
    probable_fault: 'Nominal Operation',
    root_cause: 'No significant anomaly detected.',
    severity: 'NORMAL',
    confidence: 0.95,
    important_variables: ['All variables within nominal tolerances'],
    recommended_action: 'Continue routine monitoring. System operating within nominal limits.',
    xai_contributions: [{ feature: 'nominal', label: 'All variables nominal', change: '✓ Nominal', contributionPercent: 100, isUp: false }],
    prognosis: { degradationPercent: 0, trend: 'STABLE', riskStage: 'NORMAL', timeToThreshold: 'Operating nominally', narrative: 'Operating nominally' },
    preventive: { riskScore: 12, riskStage: 'NORMAL', observedEvidence: 'Operating within boundaries', probableCause: 'Nominal', preventiveMeasure: 'Continue routine monitoring', verificationRequired: false, recommendationAllowed: true },
    safetyGate: { gateState: 'NORMAL', statusLabel: '✓ NOMINAL OPERATION', safeToRecommend: true, actionBlocked: false, requiresOperatorApproval: false, bannerType: 'safe', headline: 'SYSTEM OPERATING NOMINALLY', reason: 'Parameters nominal', directive: '✓ CONTINUE ROUTINE MONITORING' },
    operatorApproval: { required: false, approved: false, message: 'Nominal operation' },
    timestamp: new Date().toISOString()
  }
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'flowsheet'
    | 'pump'
    | 'heat_exchanger'
    | 'reactor'
    | 'distillation'
    | 'ai_diagnosis'
    | 'alerts'
  >('overview');

  const [selectedEquipment, setSelectedEquipment] = useState<string>('pump');
  const [chatEquipment, setChatEquipment] = useState<string | undefined>();
  const [inspectEquipmentId, setInspectEquipmentId] = useState<string | null>(null);
  const [state, setState] = useState<ProcessUpdatePayload>(INITIAL_STATE);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      time: new Date(Date.now() - (15 - i) * 1000).toLocaleTimeString(),
      pumpVibration: 0.08,
      pumpRpm: 2450,
      pumpFlow: 10.0,
      hxDeltaT: 12.9,
      hxOutletTemp: 38.1,
      reactorTemp: 65.0,
      reactorPressure: 2.05,
      distTopTemp: 76.5,
      distReflux: 1.85,
      riskScore: 12
    }));
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isInjectingFault, setIsInjectingFault] = useState(false);

  // Initial alerts fetch from SQLite
  useEffect(() => {
    fetchAlerts()
      .then((data) => setAlerts(data))
      .catch((err) => {
        console.warn('Alerts fetch warning:', err.message);
        setAlerts([]);
      });
  }, []);

  // WebSocket Live Stream Subscription
  useEffect(() => {
    const unsubscribe = wsClient.subscribe((payload) => {
      setState(payload);

      // Append time-series point
      const timeStr = new Date(payload.timestamp).toLocaleTimeString();
      const point: TimeSeriesPoint = {
        time: timeStr,
        pumpVibration: payload.equipment.pump.data.vibration || 0.08,
        pumpRpm: payload.equipment.pump.data.rpm || 2450,
        pumpFlow: payload.equipment.pump.data.flow || ((payload.equipment.pump.data.rpm / 2450) * 10.0),
        hxDeltaT: payload.equipment.heat_exchanger.data.temperature_difference || 12.5,
        hxOutletTemp: payload.equipment.heat_exchanger.data.outlet_temperature || 38.0,
        reactorTemp: payload.equipment.reactor.data.temperature || 65.0,
        reactorPressure: payload.equipment.reactor.data.pressure || 2.0,
        distTopTemp: payload.equipment.distillation.data.top_temperature || 76.5,
        distReflux: payload.equipment.distillation.data.reflux_ratio || 1.85,
        riskScore: payload.diagnosis?.preventive?.riskScore ?? 12
      };

      setTimeSeries((prev) => {
        const next = [...prev, point];
        return next.length > 30 ? next.slice(next.length - 30) : next;
      });

      // Update active alerts list if new fault
      if (payload.diagnosis.anomaly && payload.diagnosis.severity !== 'NORMAL') {
        setAlerts((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          const alertExists = safePrev.some(
            (a) => a && a.equipment === payload.diagnosis.equipment && a.fault === payload.diagnosis.probable_fault
          );
          if (alertExists) return safePrev;
          const newAlert: AlertItem = {
            id: Date.now(),
            timestamp: payload.diagnosis.timestamp,
            equipment: payload.diagnosis.equipment,
            fault: payload.diagnosis.probable_fault,
            root_cause: payload.diagnosis.root_cause,
            severity: payload.diagnosis.severity
          };
          return [newAlert, ...safePrev.slice(0, 25)];
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSelectFault = async (fault: FaultMode) => {
    try {
      setIsInjectingFault(true);
      await setDemoFault(fault);
    } catch (e) {
      console.error('Failed to trigger fault mode:', e);
    } finally {
      setIsInjectingFault(false);
    }
  };

  const handleAskAiAboutEquipment = (equipId: string) => {
    setSelectedEquipment(equipId);
    setChatEquipment(equipId);
    if (activeTab !== 'overview' && activeTab !== 'ai_diagnosis') {
      setActiveTab('overview');
    }
  };

  const handleAnalyzeAlertWithAi = (alert: IntelligentAlert) => {
    const equipLower = alert.equipment.toLowerCase();
    let equipId = 'pump';
    if (equipLower.includes('p-101') || equipLower.includes('pump')) equipId = 'pump';
    else if (equipLower.includes('e-101') || equipLower.includes('exchanger')) equipId = 'heat_exchanger';
    else if (equipLower.includes('r-101') || equipLower.includes('reactor')) equipId = 'reactor';
    else if (equipLower.includes('d-101') || equipLower.includes('distill') || equipLower.includes('column')) equipId = 'distillation';

    setSelectedEquipment(equipId);
    setChatEquipment(equipId);
    setActiveTab('overview');

    setTimeout(() => {
      const el = document.querySelector('.ai-diagnosis-panel');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Evaluate equipment health for sidebar dots
  const pumpIsFault = (state.equipment.pump.data.vibration || 0) > 0.22;
  const hxIsFault = (state.equipment.heat_exchanger.data.temperature_difference || 0) < 5.0;
  const reactorIsCritical =
    state.equipment.reactor.data.cooling_status === 0 || (state.equipment.reactor.data.temperature || 0) > 78;
  const distIsWarning = (state.equipment.distillation.data.reflux_ratio || 0) < 1.15;
  const isAnomaly = state.diagnosis.anomaly && state.diagnosis.severity !== 'NORMAL';
  const isUnknown = !!state.diagnosis.is_unknown_fault;
  const activeAlertCount = (state.active_alerts || []).length;

  return (
    <div className="app-container">
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-badge">
            <Atom className="brand-logo-icon" />
            <span className="brand-title">
              ChemDiag <span className="ai-tag">AI</span>
            </span>
          </div>
          <p className="brand-subtitle">
            Digital Twin · Early Fault Detection · XAI · Safety Gate
          </p>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <div className="nav-item-left">
              <LayoutDashboard />
              <span>Overview</span>
            </div>
          </button>

          <button
            className={`nav-item ${activeTab === 'flowsheet' ? 'active' : ''}`}
            onClick={() => setActiveTab('flowsheet')}
          >
            <div className="nav-item-left">
              <Network />
              <span>Process Flowsheet</span>
            </div>
            <span className="nav-status-dot pulse"></span>
          </button>

          <button
            className={`nav-item ${activeTab === 'pump' ? 'active' : ''}`}
            onClick={() => { setActiveTab('pump'); setSelectedEquipment('pump'); }}
          >
            <div className="nav-item-left">
              <Activity />
              <span>Pump (P-101)</span>
            </div>
            <span className={`nav-status-dot ${pumpIsFault ? 'warning' : 'pulse'}`}></span>
          </button>

          <button
            className={`nav-item ${activeTab === 'heat_exchanger' ? 'active' : ''}`}
            onClick={() => { setActiveTab('heat_exchanger'); setSelectedEquipment('heat_exchanger'); }}
          >
            <div className="nav-item-left">
              <Flame />
              <span>Heat Exchanger (E-101)</span>
            </div>
            <span className={`nav-status-dot ${hxIsFault ? 'warning' : 'pulse'}`}></span>
          </button>

          <button
            className={`nav-item ${activeTab === 'reactor' ? 'active' : ''}`}
            onClick={() => { setActiveTab('reactor'); setSelectedEquipment('reactor'); }}
          >
            <div className="nav-item-left">
              <Cpu />
              <span>Reactor (R-101 CSTR)</span>
            </div>
            <span className={`nav-status-dot ${reactorIsCritical ? 'critical' : 'pulse'}`}></span>
          </button>

          <button
            className={`nav-item ${activeTab === 'distillation' ? 'active' : ''}`}
            onClick={() => { setActiveTab('distillation'); setSelectedEquipment('distillation'); }}
          >
            <div className="nav-item-left">
              <Layers />
              <span>Distillation (D-101)</span>
            </div>
            <span className={`nav-status-dot ${distIsWarning ? 'warning' : 'pulse'}`}></span>
          </button>

          <button
            className={`nav-item ${activeTab === 'ai_diagnosis' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai_diagnosis')}
          >
            <div className="nav-item-left">
              <BrainCircuit />
              <span>Industrial AI & Decision</span>
            </div>
            <span className={`nav-status-dot ${isUnknown ? 'unknown-dot' : isAnomaly ? 'critical' : 'ai-pulse'}`}></span>
          </button>

          <button
            className={`nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            <div className="nav-item-left">
              <Bell />
              <span>Active Alerts</span>
            </div>
            <span className={`nav-alert-badge ${activeAlertCount === 0 ? 'zero' : ''}`}>
              {activeAlertCount}
            </span>
          </button>
        </nav>

        {/* SYSTEM STATUS BLOCK */}
        <div className="sidebar-status-block">
          <span className="status-block-title">Process Telemetry & Digital Twin</span>
          <div className="status-item">
            <span className="status-label">Node Backend API</span>
            <span className="status-val"><span className="status-dot pulse"></span> Online</span>
          </div>
          <div className="status-item">
            <span className="status-label">Safety Gate Engine</span>
            <span className="status-val"><span className="status-dot pulse"></span> Active</span>
          </div>
          <div className="status-item">
            <span className="status-label">XAI & Prognosis</span>
            <span className="status-val"><span className="status-dot pulse"></span> Synced</span>
          </div>
          <div className="status-item">
            <span className="status-label">ESP32 Transceiver</span>
            <span className={`status-val ${state.esp32_status.connected ? '' : 'offline'}`}>
              <span className="status-dot"></span> {state.esp32_status.connected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Digital Twin Engine</span>
            <span className="status-val"><span className="status-dot pulse"></span> Continuous</span>
          </div>
        </div>

        <div className="sidebar-footer">
          <span>ChemDiag · Industrial AI</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>v2.0</span>
        </div>
      </aside>

      {/* MAIN WRAPPER */}
      <div className="main-wrapper">
        <Navbar
          esp32Connected={state.esp32_status.connected}
          esp32Message={state.esp32_status.message}
          alertSummary={state.alert_summary}
          activeAlertCount={activeAlertCount}
          onAlertsClick={() => setActiveTab('alerts')}
        />

        <main className="dashboard-canvas">
          {/* ALWAYS VISIBLE: 4-LEVEL DEMO SCENARIOS BAR */}
          <DemoModeBar
            activeFault={state.active_fault_mode}
            onSelectFault={handleSelectFault}
            isLoading={isInjectingFault}
          />

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="tab-content-anim space-y-4">
              {/* 0. ADJUSTABLE CAUSAL PROCESS WORKFLOW */}
              <ProcessWorkflowSection
                state={state}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={(id) => setSelectedEquipment(id)}
                onAskAiAboutEquipment={handleAskAiAboutEquipment}
              />

              {/* 1. COMPACT & INTERACTIVE EARLY FAULT MONITORING COCKPIT */}
              <EarlyFaultMonitoringCockpit
                state={state}
                timeSeries={timeSeries}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={(id) => setSelectedEquipment(id)}
                onAskAiAboutEquipment={handleAskAiAboutEquipment}
              />

              {/* 2. ASPEN PFD WITH CONTINUOUS CAUSAL STREAM PROPAGATION */}
              <ProcessFlowsheet
                state={state}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={(id) => setSelectedEquipment(id)}
                onAskAiAbout={handleAskAiAboutEquipment}
                timeSeries={timeSeries}
                onSelectFault={handleSelectFault}
              />

              {/* 3. CORE NOVELTY: AI DIAGNOSIS, XAI, PROGNOSIS, PREVENTIVE RISK & SAFETY GATE PANEL */}
              <AiDiagnosisPanel
                diagnosis={state.diagnosis}
                equipment={state.equipment}
                initialChatEquipment={chatEquipment}
              />

              {/* 4. 4 MAIN EQUIPMENT SENSOR DETAIL CARDS */}
              <EquipmentCardsGrid
                pump={state.equipment.pump}
                heatExchanger={state.equipment.heat_exchanger}
                reactor={state.equipment.reactor}
                distillation={state.equipment.distillation}
                history={timeSeries}
                onAskAiAbout={handleAskAiAboutEquipment}
              />

              {/* 5. LIVE TIME-SERIES CHARTS WITH RISK PROGRESSION TIMELINE */}
              <LiveCharts
                data={timeSeries}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={setSelectedEquipment}
              />

              {/* 6. ACTIVE INTELLIGENT ALERTS & AUDIT LOG */}
              <ActiveAlertsCard
                alerts={state.active_alerts || []}
                alertSummary={state.alert_summary}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={(id) => setSelectedEquipment(id)}
                onAnalyzeWithAi={handleAnalyzeAlertWithAi}
                onAlertsUpdated={() => {
                  fetchAlerts().then((data) => setAlerts(data)).catch(() => setAlerts([]));
                }}
              />

              <AlertsPanel alerts={alerts} />
            </div>
          )}

          {/* TAB 2: FLOWSHEET DEDICATED VIEW */}
          {activeTab === 'flowsheet' && (
            <div className="tab-content-anim space-y-4">
              <ProcessWorkflowSection
                state={state}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={(id) => setSelectedEquipment(id)}
                onAskAiAboutEquipment={handleAskAiAboutEquipment}
              />
              <ActiveAlertsCard
                alerts={state.active_alerts || []}
                alertSummary={state.alert_summary}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={setSelectedEquipment}
                onAnalyzeWithAi={handleAnalyzeAlertWithAi}
                onAlertsUpdated={() => {
                  fetchAlerts().then((data) => setAlerts(data)).catch(() => setAlerts([]));
                }}
              />
              <ProcessFlowsheet
                state={state}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={setSelectedEquipment}
                onAskAiAbout={handleAskAiAboutEquipment}
                timeSeries={timeSeries}
                onSelectFault={handleSelectFault}
              />
              <LiveCharts
                data={timeSeries}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={setSelectedEquipment}
              />
            </div>
          )}

          {/* TAB: ACTIVE ALERTS DEDICATED VIEW */}
          {activeTab === 'alerts' && (
            <div className="tab-content-anim space-y-4">
              <ActiveAlertsCard
                alerts={state.active_alerts || []}
                alertSummary={state.alert_summary}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={setSelectedEquipment}
                onAnalyzeWithAi={handleAnalyzeAlertWithAi}
                onAlertsUpdated={() => {
                  fetchAlerts().then((data) => setAlerts(data)).catch(() => setAlerts([]));
                }}
              />
              <AlertsPanel alerts={alerts} />
            </div>
          )}


          {/* TAB 3: PUMP DETAIL */}
          {activeTab === 'pump' && (
            <div className="tab-content-anim">
              <div className="equipment-card">
                <div className="equipment-card-header">
                  <div className="unit-title-group">
                    <div className="unit-icon-badge">
                      <Activity size={16} />
                    </div>
                    <div>
                      <h2 className="unit-name" style={{ fontSize: '1.05rem' }}>PUMP DETAIL — CENTRIFUGAL UNIT P-101</h2>
                      <p className="unit-id">
                        Hardware Interface / Digital Twin Continuous Model (Sensors: Speed, MPU6050 Acceleration, Dual DS18B20 Probes)
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`source-badge ${state.equipment.pump.source === 'real' ? 'real' : 'demo'}`}>
                      {state.equipment.pump.source === 'real' ? 'REAL DATA' : 'DEMO DATA'}
                    </span>
                    <button
                      className="card-ask-ai-btn"
                      onClick={() => handleAskAiAboutEquipment('pump')}
                    >
                      <MessageSquare size={11} />
                      <span>Ask Industrial AI</span>
                    </button>
                  </div>
                </div>

                <div className="unit-metrics-list" style={{ marginTop: '6px' }}>
                  <div className="metric-row">
                    <span className="metric-label">Rotational Speed (IR Optical Sensor)</span>
                    <span className="metric-value numeric-data">{Math.round(state.equipment.pump.data.rpm)} RPM</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Casing Vibration Magnitude (MPU6050 Accelerometer)</span>
                    <span className="metric-value numeric-data" style={{ color: pumpIsFault ? 'var(--sev-critical-text)' : 'inherit' }}>
                      {state.equipment.pump.data.vibration.toFixed(2)} g
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Calculated Discharge Flow</span>
                    <span className="metric-value numeric-data">{(state.equipment.pump.data.flow ?? 10.0).toFixed(1)} L/min</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Inlet Fluid Temperature</span>
                    <span className="metric-value numeric-data">{state.equipment.pump.data.inlet_temperature.toFixed(1)} °C</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Discharge Fluid Temperature</span>
                    <span className="metric-value numeric-data">{state.equipment.pump.data.outlet_temperature.toFixed(1)} °C</span>
                  </div>
                </div>

                <div style={{ padding: '10px 14px', background: 'var(--bg-card-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '6px' }}>
                  <h4 style={{ fontSize: '0.78rem', color: 'var(--primary-blue)', marginBottom: '3px', fontWeight: 700 }}>
                    Operating Limits & Vibration Boundaries
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Normal: 2300–2600 RPM, &lt;0.20 g vibration, 8–11 L/min flow. Early warning: 0.20–0.30 g vibration. Developing: 0.30–0.40 g. High risk: 0.40–0.50 g. Critical: &gt;0.50 g.
                  </p>
                </div>
              </div>

              <LiveCharts
                data={timeSeries}
                selectedEquipment="pump"
                onSelectEquipment={setSelectedEquipment}
              />
            </div>
          )}

          {/* TAB 4: HEAT EXCHANGER DETAIL */}
          {activeTab === 'heat_exchanger' && (
            <div className="tab-content-anim">
              <div className="equipment-card">
                <div className="equipment-card-header">
                  <div className="unit-title-group">
                    <div className="unit-icon-badge" style={{ color: '#D97706' }}>
                      <Flame size={16} />
                    </div>
                    <div>
                      <h2 className="unit-name" style={{ fontSize: '1.05rem' }}>HEAT EXCHANGER DETAIL — COUNTER-FLOW UNIT E-101</h2>
                      <p className="unit-id">
                        Thermal transfer gradient monitored via dual DS18B20 digital temperature sensors
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`source-badge ${state.equipment.heat_exchanger.source === 'real' ? 'real' : 'demo'}`}>
                      {state.equipment.heat_exchanger.source === 'real' ? 'REAL DATA' : 'DEMO DATA'}
                    </span>
                    <button
                      className="card-ask-ai-btn"
                      onClick={() => handleAskAiAboutEquipment('heat_exchanger')}
                    >
                      <MessageSquare size={11} />
                      <span>Ask Industrial AI</span>
                    </button>
                  </div>
                </div>

                <div className="unit-metrics-list" style={{ marginTop: '6px' }}>
                  <div className="metric-row">
                    <span className="metric-label">Process Stream Inlet Temperature</span>
                    <span className="metric-value numeric-data">{state.equipment.heat_exchanger.data.inlet_temperature.toFixed(1)} °C</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Process Stream Outlet Temperature</span>
                    <span className="metric-value numeric-data">{state.equipment.heat_exchanger.data.outlet_temperature.toFixed(1)} °C</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Thermal Difference (ΔT Gradient)</span>
                    <span className="metric-value numeric-data" style={{ color: hxIsFault ? 'var(--sev-critical-text)' : 'var(--sev-normal-text)' }}>
                      {state.equipment.heat_exchanger.data.temperature_difference.toFixed(1)} °C
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Heat Transfer Overall Efficiency</span>
                    <span className="metric-value numeric-data">{(state.equipment.heat_exchanger.data.efficiency ?? state.equipment.heat_exchanger.data.heat_transfer_indicator).toFixed(1)} %</span>
                  </div>
                </div>

                <div style={{ padding: '10px 14px', background: 'var(--bg-card-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '6px' }}>
                  <h4 style={{ fontSize: '0.78rem', color: 'var(--primary-blue)', marginBottom: '3px', fontWeight: 700 }}>
                    Thermal Fouling Factor & Progressive Limits
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Normal: ΔT ≈ 6–10°C (Eff &gt;75%). Early fouling: ΔT = 4–6°C (Eff 60–75%). Developing: ΔT = 3–4°C (Eff 50–60%). High risk: ΔT = 2–3°C (Eff 40–50%). Critical: ΔT &lt; 2°C (Eff &lt;40%).
                  </p>
                </div>
              </div>

              <LiveCharts
                data={timeSeries}
                selectedEquipment="heat_exchanger"
                onSelectEquipment={setSelectedEquipment}
              />
            </div>
          )}

          {/* TAB 5: REACTOR DETAIL */}
          {activeTab === 'reactor' && (
            <div className="tab-content-anim">
              <div className="equipment-card">
                <div className="equipment-card-header">
                  <div className="unit-title-group">
                    <div className="unit-icon-badge" style={{ color: '#7C3AED' }}>
                      <Cpu size={16} />
                    </div>
                    <div>
                      <h2 className="unit-name" style={{ fontSize: '1.05rem' }}>REACTOR DETAIL — CONTINUOUS CSTR R-101</h2>
                      <p className="unit-id">
                        Coupled exothermic Arrhenius kinetics, vapor pressure accumulation, and jacket heat dissipation
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="source-badge simulated">SIMULATED DATA</span>
                    <button
                      className="card-ask-ai-btn"
                      onClick={() => handleAskAiAboutEquipment('reactor')}
                    >
                      <MessageSquare size={11} />
                      <span>Ask Industrial AI</span>
                    </button>
                  </div>
                </div>

                <div className="unit-metrics-list" style={{ marginTop: '6px' }}>
                  <div className="metric-row">
                    <span className="metric-label">Reaction Core Temperature</span>
                    <span className="metric-value numeric-data" style={{ color: state.equipment.reactor.data.temperature > 80 ? 'var(--sev-critical-text)' : 'inherit' }}>
                      {state.equipment.reactor.data.temperature.toFixed(1)} °C
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Internal Vessel Pressure</span>
                    <span className="metric-value numeric-data" style={{ color: state.equipment.reactor.data.pressure > 2.8 ? 'var(--sev-critical-text)' : 'inherit' }}>
                      {state.equipment.reactor.data.pressure.toFixed(2)} bar
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Vessel Holdup Level</span>
                    <span className="metric-value numeric-data">{state.equipment.reactor.data.level.toFixed(1)} %</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Agitator Shaft Speed</span>
                    <span className="metric-value numeric-data">{Math.round(state.equipment.reactor.data.agitator_speed)} RPM</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Cooling Jacket Relay Interlock</span>
                    <span className="metric-value numeric-data" style={{ color: state.equipment.reactor.data.cooling_status === 1 ? 'var(--sev-normal-text)' : 'var(--sev-critical-text)' }}>
                      {state.equipment.reactor.data.cooling_status === 1 ? 'ACTIVE (1)' : 'TRIPPED (0 - Loss of Cooling)'}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '10px 14px', background: 'var(--bg-card-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '6px' }}>
                  <h4 style={{ fontSize: '0.78rem', color: 'var(--primary-blue)', marginBottom: '3px', fontWeight: 700 }}>
                    Exothermic Kinetics & Progressive Limits
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Normal: 60–75°C, 1.8–2.3 bar, Level 50–80%, Agitator 250–350 RPM. Progressive degradation: 65°C → 70°C → 76°C → 82°C → 88°C → 92°C. Pressure escalates according to Antoine vapor-liquid equilibria.
                  </p>
                </div>
              </div>

              <LiveCharts
                data={timeSeries}
                selectedEquipment="reactor"
                onSelectEquipment={setSelectedEquipment}
              />
            </div>
          )}

          {/* TAB 6: DISTILLATION DETAIL */}
          {activeTab === 'distillation' && (
            <div className="tab-content-anim">
              <div className="equipment-card">
                <div className="equipment-card-header">
                  <div className="unit-title-group">
                    <div className="unit-icon-badge" style={{ color: '#0891B2' }}>
                      <Layers size={16} />
                    </div>
                    <div>
                      <h2 className="unit-name" style={{ fontSize: '1.05rem' }}>DISTILLATION COLUMN — BINARY FRACTIONATOR D-101</h2>
                      <p className="unit-id">
                        Tray vapor-liquid equilibria, reflux ratio dynamics, and overhead distillate separation
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="source-badge simulated">SIMULATED DATA</span>
                    <button
                      className="card-ask-ai-btn"
                      onClick={() => handleAskAiAboutEquipment('distillation')}
                    >
                      <MessageSquare size={11} />
                      <span>Ask Industrial AI</span>
                    </button>
                  </div>
                </div>

                <div className="unit-metrics-list" style={{ marginTop: '6px' }}>
                  <div className="metric-row">
                    <span className="metric-label">Reflux Ratio (L/D)</span>
                    <span className="metric-value numeric-data" style={{ color: distIsWarning ? 'var(--sev-medium-text)' : 'var(--sev-normal-text)' }}>
                      {state.equipment.distillation.data.reflux_ratio.toFixed(2)}
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Top Overhead Vapor Temperature</span>
                    <span className="metric-value numeric-data" style={{ color: state.equipment.distillation.data.top_temperature > 80 ? 'var(--sev-critical-text)' : 'inherit' }}>
                      {state.equipment.distillation.data.top_temperature.toFixed(1)} °C
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Bottom Reboiler Temperature</span>
                    <span className="metric-value numeric-data">{state.equipment.distillation.data.bottom_temperature.toFixed(1)} °C</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Column Operating Pressure</span>
                    <span className="metric-value numeric-data">{state.equipment.distillation.data.pressure.toFixed(2)} bar</span>
                  </div>
                </div>

                <div style={{ padding: '10px 14px', background: 'var(--bg-card-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '6px' }}>
                  <h4 style={{ fontSize: '0.78rem', color: 'var(--primary-blue)', marginBottom: '3px', fontWeight: 700 }}>
                    Reflux Ratio Decay & Progressive Limits
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Normal: Reflux 1.5–2.2, Top Temp 74–80°C, Bottom Temp 105–120°C, Pressure 1.8–2.3 bar. Progressive reflux degradation: 1.84 → 1.50 → 1.20 → 0.90 → 0.65.
                  </p>
                </div>
              </div>

              <LiveCharts
                data={timeSeries}
                selectedEquipment="distillation"
                onSelectEquipment={setSelectedEquipment}
              />
            </div>
          )}

          {/* TAB 7: AI DECISION & GROUNDED COPILOT */}
          {activeTab === 'ai_diagnosis' && (
            <div className="tab-content-anim">
              <AiDiagnosisPanel
                diagnosis={state.diagnosis}
                equipment={state.equipment}
                initialChatEquipment={chatEquipment}
              />
            </div>
          )}
        </main>
      </div>

      {/* EQUIPMENT DETAIL INSPECTION DRAWER */}
      {inspectEquipmentId && state.equipment_health && (
        <EquipmentDetailDrawer
          equipmentId={inspectEquipmentId}
          equipmentHealthItem={state.equipment_health[inspectEquipmentId as keyof typeof state.equipment_health]}
          history={timeSeries}
          onClose={() => setInspectEquipmentId(null)}
          onAskAi={(_equipName) => {
            const equipId = inspectEquipmentId || 'pump';
            setInspectEquipmentId(null);
            handleAskAiAboutEquipment(equipId);
          }}
        />
      )}
    </div>
  );
};

export default App;
