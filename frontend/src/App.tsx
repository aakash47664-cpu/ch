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
import { EquipmentDetailDrawer } from './components/EquipmentDetailDrawer';

import { OverviewWorkspace } from './components/workspaces/OverviewWorkspace';
import { ProcessFlowsheetWorkspace } from './components/workspaces/ProcessFlowsheetWorkspace';
import { MlMonitoringWorkspace } from './components/workspaces/MlMonitoringWorkspace';
import { IntermittentFaultsWorkspace } from './components/workspaces/IntermittentFaultsWorkspace';
import { PumpWorkspace } from './components/workspaces/PumpWorkspace';
import { HeatExchangerWorkspace } from './components/workspaces/HeatExchangerWorkspace';
import { ReactorWorkspace } from './components/workspaces/ReactorWorkspace';
import { DistillationWorkspace } from './components/workspaces/DistillationWorkspace';
import { AiWorkspace } from './components/workspaces/AiWorkspace';
import { AlertsWorkspace } from './components/workspaces/AlertsWorkspace';

import {
  LayoutDashboard,
  Activity,
  Flame,
  Cpu,
  Layers,
  BrainCircuit,
  Bell,
  Atom,
  Network,
  Clock,
  Gauge
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
    | 'ml_monitoring'
    | 'intermittent_faults'
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

  // WebSocket Live Stream Subscription (Unified Central Process Simulation State)
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
    setActiveTab('ai_diagnosis');
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
      {/* SIDEBAR NAVIGATION (DRIVES TRUE SEPARATE-PAGE WORKSPACES) */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-badge">
            <Atom className="brand-logo-icon" />
            <span className="brand-title">
              ChemDiag <span className="ai-tag">AI</span>
            </span>
          </div>
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
            className={`nav-item ${activeTab === 'ml_monitoring' ? 'active' : ''}`}
            onClick={() => setActiveTab('ml_monitoring')}
          >
            <div className="nav-item-left">
              <Gauge />
              <span>ML Monitoring</span>
            </div>
            <span className="nav-status-dot pulse"></span>
          </button>

          <button
            className={`nav-item ${activeTab === 'intermittent_faults' ? 'active' : ''}`}
            onClick={() => setActiveTab('intermittent_faults')}
          >
            <div className="nav-item-left">
              <Clock />
              <span>Intermittent Faults</span>
            </div>
            <span className={`nav-status-dot ${(state.intermittent_faults?.active_events_count || 0) > 0 ? 'critical' : 'ai-pulse'}`}></span>
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

          {/* ========================================================================= */}
          {/* STRICT SEPARATE-PAGE WORKSPACES: ONLY ONE PAGE IS MOUNTED AT A TIME       */}
          {/* ========================================================================= */}

          {/* PAGE 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="tab-content-anim">
              <OverviewWorkspace
                state={state}
                timeSeries={timeSeries}
                alerts={alerts}
                onNavigateTab={setActiveTab}
                onAskAiAbout={handleAskAiAboutEquipment}
              />
            </div>
          )}

          {/* PAGE 2: PROCESS FLOWSHEET */}
          {activeTab === 'flowsheet' && (
            <div className="tab-content-anim">
              <ProcessFlowsheetWorkspace
                state={state}
                timeSeries={timeSeries}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={(id) => setSelectedEquipment(id)}
                onAskAiAbout={handleAskAiAboutEquipment}
                onSelectFault={handleSelectFault}
              />
            </div>
          )}

          {/* PAGE 3: ML MONITORING */}
          {activeTab === 'ml_monitoring' && (
            <div className="tab-content-anim">
              <MlMonitoringWorkspace
                state={state}
                initialEquipmentId={selectedEquipment || 'heat_exchanger'}
                onNavigateTab={setActiveTab}
                onAskAiAbout={handleAskAiAboutEquipment}
              />
            </div>
          )}

          {/* PAGE 4: INTERMITTENT FAULTS (COMPLETELY SEPARATE WORKSPACE) */}
          {activeTab === 'intermittent_faults' && (
            <div className="tab-content-anim">
              <IntermittentFaultsWorkspace
                state={state}
                onNavigateTab={setActiveTab}
                onAskAiAbout={handleAskAiAboutEquipment}
              />
            </div>
          )}

          {/* PAGE 5: PUMP P-101 */}
          {activeTab === 'pump' && (
            <div className="tab-content-anim">
              <PumpWorkspace
                state={state}
                timeSeries={timeSeries}
                onNavigateTab={setActiveTab}
                onAskAiAbout={handleAskAiAboutEquipment}
              />
            </div>
          )}

          {/* PAGE 4: HEAT EXCHANGER E-101 */}
          {activeTab === 'heat_exchanger' && (
            <div className="tab-content-anim">
              <HeatExchangerWorkspace
                state={state}
                timeSeries={timeSeries}
                onNavigateTab={setActiveTab}
                onAskAiAbout={handleAskAiAboutEquipment}
              />
            </div>
          )}

          {/* PAGE 5: REACTOR R-101 CSTR */}
          {activeTab === 'reactor' && (
            <div className="tab-content-anim">
              <ReactorWorkspace
                state={state}
                timeSeries={timeSeries}
                onNavigateTab={setActiveTab}
                onAskAiAbout={handleAskAiAboutEquipment}
              />
            </div>
          )}

          {/* PAGE 6: DISTILLATION D-101 */}
          {activeTab === 'distillation' && (
            <div className="tab-content-anim">
              <DistillationWorkspace
                state={state}
                timeSeries={timeSeries}
                onNavigateTab={setActiveTab}
                onAskAiAbout={handleAskAiAboutEquipment}
              />
            </div>
          )}

          {/* PAGE 7: INDUSTRIAL AI & DECISION */}
          {activeTab === 'ai_diagnosis' && (
            <div className="tab-content-anim">
              <AiWorkspace
                state={state}
                selectedEquipment={selectedEquipment}
              />
            </div>
          )}

          {/* PAGE 8: ACTIVE ALERTS */}
          {activeTab === 'alerts' && (
            <div className="tab-content-anim">
              <AlertsWorkspace
                state={state}
                alerts={alerts}
                onNavigateTab={setActiveTab}
                onAlertsUpdated={() => {
                  fetchAlerts().then((data) => setAlerts(data)).catch(() => setAlerts([]));
                }}
                onAskAiAbout={handleAskAiAboutEquipment}
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
