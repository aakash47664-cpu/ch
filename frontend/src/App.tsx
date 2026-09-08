import React, { useState, useEffect } from 'react';
import {
  ProcessUpdatePayload,
  FaultMode,
  TimeSeriesPoint,
  AlertItem
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
import { SafetyDisclaimer } from './components/SafetyDisclaimer';

import {
  LayoutDashboard,
  Activity,
  Flame,
  Atom,
  Layers,
  BrainCircuit,
  Bell,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Network
} from 'lucide-react';

const INITIAL_STATE: ProcessUpdatePayload = {
  type: 'PROCESS_UPDATE',
  timestamp: new Date().toISOString(),
  active_fault_mode: 'normal',
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
      data: { rpm: 2450, vibration: 0.08, inlet_temperature: 25.2, outlet_temperature: 38.1 }
    },
    heat_exchanger: {
      id: 'heat_exchanger',
      name: 'Heat Exchanger (Shell & Tube)',
      source: 'demo',
      source_label: 'DEMO / SIMULATED',
      data: { inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, heat_transfer_indicator: 95.0 }
    },
    reactor: {
      id: 'reactor',
      name: 'Continuous Stirred-Tank Reactor (CSTR)',
      source: 'simulated',
      source_label: 'SIMULATED DATA',
      data: { temperature: 65.0, pressure: 2.05, level: 50.0, agitator_speed: 350, cooling_status: 1 }
    },
    distillation: {
      id: 'distillation',
      name: 'Binary Distillation Column',
      source: 'simulated',
      source_label: 'SIMULATED DATA',
      data: { top_temperature: 64.2, bottom_temperature: 98.4, pressure: 1.82, level: 52.0, reflux_ratio: 2.2 }
    }
  },
  diagnosis: {
    equipment: 'All Units',
    anomaly: false,
    anomaly_score: 0.18,
    fault: 'normal',
    probable_fault: 'Nominal Operation',
    root_cause: 'No significant anomaly detected.',
    severity: 'NORMAL',
    confidence: 0.95,
    important_variables: ['All variables within nominal tolerances'],
    recommended_action: 'Continue routine monitoring. System operating within nominal limits.',
    timestamp: new Date().toISOString()
  }
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'flowsheet' | 'pump' | 'heat_exchanger' | 'reactor' | 'distillation' | 'ai_diagnosis' | 'alerts'
  >('overview');

  const [selectedEquipment, setSelectedEquipment] = useState<string>('pump');
  const [chatEquipment, setChatEquipment] = useState<string | undefined>();
  const [state, setState] = useState<ProcessUpdatePayload>(INITIAL_STATE);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      time: new Date(Date.now() - (15 - i) * 1000).toLocaleTimeString(),
      pumpVibration: 0.08,
      pumpRpm: 2450,
      hxDeltaT: 12.9,
      hxOutletTemp: 38.1,
      reactorTemp: 65.0,
      reactorPressure: 2.05,
      distTopTemp: 64.2,
      distReflux: 2.2
    }));
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isInjectingFault, setIsInjectingFault] = useState(false);

  // Initial alerts fetch from SQLite
  useEffect(() => {
    fetchAlerts()
      .then((data) => setAlerts(data))
      .catch((err) => console.warn('Alerts fetch warning:', err.message));
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
        hxDeltaT: payload.equipment.heat_exchanger.data.temperature_difference || 12.5,
        hxOutletTemp: payload.equipment.heat_exchanger.data.outlet_temperature || 38.0,
        reactorTemp: payload.equipment.reactor.data.temperature || 65.0,
        reactorPressure: payload.equipment.reactor.data.pressure || 2.0,
        distTopTemp: payload.equipment.distillation.data.top_temperature || 64.0,
        distReflux: payload.equipment.distillation.data.reflux_ratio || 2.2
      };

      setTimeSeries((prev) => {
        const next = [...prev, point];
        return next.length > 30 ? next.slice(next.length - 30) : next;
      });

      // Update active alerts list if new fault
      if (payload.diagnosis.anomaly && payload.diagnosis.severity !== 'NORMAL') {
        setAlerts((prev) => {
          const alertExists = prev.some(
            (a) => a.equipment === payload.diagnosis.equipment && a.fault === payload.diagnosis.probable_fault
          );
          if (alertExists) return prev;
          const newAlert: AlertItem = {
            id: Date.now(),
            timestamp: payload.diagnosis.timestamp,
            equipment: payload.diagnosis.equipment,
            fault: payload.diagnosis.probable_fault,
            root_cause: payload.diagnosis.root_cause,
            severity: payload.diagnosis.severity
          };
          return [newAlert, ...prev.slice(0, 25)];
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
    setChatEquipment(equipId);
    // Switch to Overview or AI Diagnosis tab to show the copilot
    if (activeTab !== 'overview' && activeTab !== 'ai_diagnosis') {
      setActiveTab('overview');
    }
  };

  // Evaluate equipment health for sidebar dots
  const pumpIsFault = (state.equipment.pump.data.vibration || 0) > 0.25;
  const hxIsFault = (state.equipment.heat_exchanger.data.temperature_difference || 0) < 4.0;
  const reactorIsCritical =
    state.equipment.reactor.data.cooling_status === 0 || (state.equipment.reactor.data.temperature || 0) > 85;
  const distIsWarning = (state.equipment.distillation.data.reflux_ratio || 0) < 1.1;
  const isAnomaly = state.diagnosis.anomaly && state.diagnosis.severity !== 'NORMAL';

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
            Explainable AI-Based Fault Diagnosis & Root-Cause Analysis
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
              <span>Pump</span>
            </div>
            <span className={`nav-status-dot ${pumpIsFault ? 'warning' : 'pulse'}`}></span>
          </button>

          <button
            className={`nav-item ${activeTab === 'heat_exchanger' ? 'active' : ''}`}
            onClick={() => { setActiveTab('heat_exchanger'); setSelectedEquipment('heat_exchanger'); }}
          >
            <div className="nav-item-left">
              <Flame />
              <span>Heat Exchanger</span>
            </div>
            <span className={`nav-status-dot ${hxIsFault ? 'warning' : 'pulse'}`}></span>
          </button>

          <button
            className={`nav-item ${activeTab === 'reactor' ? 'active' : ''}`}
            onClick={() => { setActiveTab('reactor'); setSelectedEquipment('reactor'); }}
          >
            <div className="nav-item-left">
              <Cpu />
              <span>Reactor (CSTR)</span>
            </div>
            <span className={`nav-status-dot ${reactorIsCritical ? 'critical' : 'pulse'}`}></span>
          </button>

          <button
            className={`nav-item ${activeTab === 'distillation' ? 'active' : ''}`}
            onClick={() => { setActiveTab('distillation'); setSelectedEquipment('distillation'); }}
          >
            <div className="nav-item-left">
              <Layers />
              <span>Distillation</span>
            </div>
            <span className={`nav-status-dot ${distIsWarning ? 'warning' : 'pulse'}`}></span>
          </button>

          <button
            className={`nav-item ${activeTab === 'ai_diagnosis' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai_diagnosis')}
          >
            <div className="nav-item-left">
              <BrainCircuit />
              <span>AI Diagnosis & Chat</span>
            </div>
            <span className={`nav-status-dot ${isAnomaly ? 'critical' : 'ai-pulse'}`}></span>
          </button>

          <button
            className={`nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            <div className="nav-item-left">
              <Bell />
              <span>Alerts</span>
            </div>
            <span className={`nav-alert-badge ${alerts.length === 0 ? 'zero' : ''}`}>
              {alerts.length}
            </span>
          </button>
        </nav>

        {/* SYSTEM STATUS BLOCK */}
        <div className="sidebar-status-block">
          <span className="status-block-title">Process Telemetry</span>
          <div className="status-item">
            <span className="status-label">FastAPI Backend</span>
            <span className="status-val"><span className="status-dot pulse"></span> Online</span>
          </div>
          <div className="status-item">
            <span className="status-label">SQLite Database</span>
            <span className="status-val"><span className="status-dot pulse"></span> Synced</span>
          </div>
          <div className="status-item">
            <span className="status-label">ML & AI Copilot</span>
            <span className="status-val"><span className="status-dot pulse"></span> Active</span>
          </div>
          <div className="status-item">
            <span className="status-label">ESP32 Hardware</span>
            <span className={`status-val ${state.esp32_status.connected ? '' : 'offline'}`}>
              <span className="status-dot"></span> {state.esp32_status.connected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">CSTR Simulator</span>
            <span className="status-val"><span className="status-dot pulse"></span> Running</span>
          </div>
        </div>

        <div className="sidebar-footer">
          <span>ChemDiag AI · Industrial Copilot</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>v1.0</span>
        </div>
      </aside>

      {/* MAIN WRAPPER */}
      <div className="main-wrapper">
        <Navbar
          esp32Connected={state.esp32_status.connected}
          esp32Message={state.esp32_status.message}
        />

        <main className="dashboard-canvas">
          {/* ALWAYS VISIBLE: DEMO MODE FAULT BAR */}
          <DemoModeBar
            activeFault={state.active_fault_mode}
            onSelectFault={handleSelectFault}
            isLoading={isInjectingFault}
          />

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="tab-content-anim">
              {/* ASPEN-STYLE FUNCTIONAL PROCESS FLOWSHEET WITH CAUSE-AND-EFFECT PROPAGATION */}
              <ProcessFlowsheet
                state={state}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={(id) => setSelectedEquipment(id)}
                onAskAiAbout={handleAskAiAboutEquipment}
              />

              {/* CORE USP: PROMINENT AI DIAGNOSIS & INTERACTIVE COPILOT PANEL */}
              <AiDiagnosisPanel
                diagnosis={state.diagnosis}
                equipment={state.equipment}
                initialChatEquipment={chatEquipment}
              />

              {/* 4 MAIN EQUIPMENT CARDS WITH SPARKLINES & ASK AI BUTTONS */}
              <EquipmentCardsGrid
                pump={state.equipment.pump}
                heatExchanger={state.equipment.heat_exchanger}
                reactor={state.equipment.reactor}
                distillation={state.equipment.distillation}
                history={timeSeries}
                onAskAiAbout={handleAskAiAboutEquipment}
              />

              {/* LIVE TIME-SERIES CHARTS */}
              <LiveCharts
                data={timeSeries}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={setSelectedEquipment}
              />

              {/* SYSTEM ALERTS LOG */}
              <AlertsPanel alerts={alerts} />
            </div>
          )}

          {/* TAB 2: FLOWSHEET DEDICATED VIEW */}
          {activeTab === 'flowsheet' && (
            <div className="tab-content-anim">
              <ProcessFlowsheet
                state={state}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={setSelectedEquipment}
                onAskAiAbout={handleAskAiAboutEquipment}
              />
              <LiveCharts
                data={timeSeries}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={setSelectedEquipment}
              />
            </div>
          )}

          {/* TAB 2: PUMP DETAIL */}
          {activeTab === 'pump' && (
            <div className="tab-content-anim">
              <div className="equipment-card">
                <div className="equipment-card-header">
                  <div className="unit-title-group">
                    <div className="unit-icon-badge">
                      <Activity size={16} />
                    </div>
                    <div>
                      <h2 className="unit-name" style={{ fontSize: '1.05rem' }}>PUMP DETAIL — 6V WATER DEMONSTRATOR</h2>
                      <p className="unit-id">
                        Physical Hardware Prototype Monitoring (ESP32 Pins: GPIO 4, 5, 21, 22, 18)
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
                      <span>Ask AI Copilot</span>
                    </button>
                  </div>
                </div>

                <div className="unit-metrics-list" style={{ marginTop: '6px' }}>
                  <div className="metric-row">
                    <span className="metric-label">Rotational Speed (IR Optical Sensor GPIO 18)</span>
                    <span className="metric-value">{Math.round(state.equipment.pump.data.rpm)} RPM</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Casing Vibration Magnitude (MPU6050 Accelerometer)</span>
                    <span className="metric-value" style={{ color: pumpIsFault ? 'var(--sev-critical-text)' : 'inherit' }}>
                      {state.equipment.pump.data.vibration.toFixed(2)} g
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Inlet Fluid Temperature (DS18B20 on GPIO 4)</span>
                    <span className="metric-value">{state.equipment.pump.data.inlet_temperature.toFixed(1)} °C</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Discharge Fluid Temperature (DS18B20 on GPIO 5)</span>
                    <span className="metric-value">{state.equipment.pump.data.outlet_temperature.toFixed(1)} °C</span>
                  </div>
                </div>

                <div style={{ padding: '10px 14px', background: 'var(--bg-card-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                  <h4 style={{ fontSize: '0.78rem', color: 'var(--primary-blue)', marginBottom: '3px', fontWeight: 700 }}>
                    Process Engineering Diagnostic Heuristic
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Healthy centrifugal pumps maintain stable speed (2400–2500 RPM) and low casing acceleration (&lt; 0.15 g).
                    Impeller imbalance or bearing raceway wear produces elevated vibration (&gt; 0.25 g) accompanied by motor slip or speed oscillations.
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

          {/* TAB 3: HEAT EXCHANGER DETAIL */}
          {activeTab === 'heat_exchanger' && (
            <div className="tab-content-anim">
              <div className="equipment-card">
                <div className="equipment-card-header">
                  <div className="unit-title-group">
                    <div className="unit-icon-badge" style={{ color: '#D97706' }}>
                      <Flame size={16} />
                    </div>
                    <div>
                      <h2 className="unit-name" style={{ fontSize: '1.05rem' }}>HEAT EXCHANGER DETAIL — COUNTER-FLOW UNIT</h2>
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
                      <span>Ask AI Copilot</span>
                    </button>
                  </div>
                </div>

                <div className="unit-metrics-list" style={{ marginTop: '6px' }}>
                  <div className="metric-row">
                    <span className="metric-label">Process Stream Inlet Temperature</span>
                    <span className="metric-value">{state.equipment.heat_exchanger.data.inlet_temperature.toFixed(1)} °C</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Process Stream Outlet Temperature</span>
                    <span className="metric-value">{state.equipment.heat_exchanger.data.outlet_temperature.toFixed(1)} °C</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Thermal Difference (ΔT Gradient)</span>
                    <span className="metric-value" style={{ color: hxIsFault ? 'var(--sev-critical-text)' : 'var(--sev-normal-text)' }}>
                      {state.equipment.heat_exchanger.data.temperature_difference.toFixed(1)} °C
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Heat Transfer Overall Efficiency</span>
                    <span className="metric-value">{state.equipment.heat_exchanger.data.heat_transfer_indicator.toFixed(1)} %</span>
                  </div>
                </div>

                <div style={{ padding: '10px 14px', background: 'var(--bg-card-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                  <h4 style={{ fontSize: '0.78rem', color: 'var(--primary-blue)', marginBottom: '3px', fontWeight: 700 }}>
                    Thermal Fouling & Boundary Resistance
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Nominal heat transfer achieves ΔT ≈ 12–14°C. When scale fouling accumulates or coolant circulation decreases,
                    heat transfer resistance surges, reducing ΔT below 4.0°C and triggering a fouling degradation diagnosis.
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

          {/* TAB 4: REACTOR DETAIL */}
          {activeTab === 'reactor' && (
            <div className="tab-content-anim">
              <div className="equipment-card">
                <div className="equipment-card-header">
                  <div className="unit-title-group">
                    <div className="unit-icon-badge" style={{ color: '#7C3AED' }}>
                      <Cpu size={16} />
                    </div>
                    <div>
                      <h2 className="unit-name" style={{ fontSize: '1.05rem' }}>REACTOR DETAIL — CONTINUOUS CSTR SIMULATION</h2>
                      <p className="unit-id">
                        Coupled exothermic kinetics, vapor pressure accumulation, and jacket heat dissipation
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
                      <span>Ask AI Copilot</span>
                    </button>
                  </div>
                </div>

                <div className="unit-metrics-list" style={{ marginTop: '6px' }}>
                  <div className="metric-row">
                    <span className="metric-label">Reaction Temperature</span>
                    <span className="metric-value" style={{ color: state.equipment.reactor.data.temperature > 85 ? 'var(--sev-critical-text)' : 'inherit' }}>
                      {state.equipment.reactor.data.temperature.toFixed(1)} °C
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Internal Vessel Pressure</span>
                    <span className="metric-value" style={{ color: state.equipment.reactor.data.pressure > 3.0 ? 'var(--sev-critical-text)' : 'inherit' }}>
                      {state.equipment.reactor.data.pressure.toFixed(2)} bar
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Liquid Vessel Holdup Level</span>
                    <span className="metric-value">{state.equipment.reactor.data.level.toFixed(1)} %</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Agitator Shaft Speed</span>
                    <span className="metric-value">{Math.round(state.equipment.reactor.data.agitator_speed)} RPM</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Cooling Jacket Relay Interlock</span>
                    <span className="metric-value" style={{ color: state.equipment.reactor.data.cooling_status === 1 ? 'var(--sev-normal-text)' : 'var(--sev-critical-text)' }}>
                      {state.equipment.reactor.data.cooling_status === 1 ? 'ON (Active Circulation)' : 'TRIPPED (Cooling Loss Alarm)'}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '10px 14px', background: 'var(--bg-card-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                  <h4 style={{ fontSize: '0.78rem', color: 'var(--primary-blue)', marginBottom: '3px', fontWeight: 700 }}>
                    Coupled Reaction Differential Equations
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Exothermic chemical reaction rate increases exponentially with temperature according to the Arrhenius relation.
                    Cooling jacket trip causes rapid runaway, elevating vapor pressure according to Antoine equilibria into critical alarm status.
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

          {/* TAB 5: DISTILLATION DETAIL */}
          {activeTab === 'distillation' && (
            <div className="tab-content-anim">
              <div className="equipment-card">
                <div className="equipment-card-header">
                  <div className="unit-title-group">
                    <div className="unit-icon-badge" style={{ color: '#0891B2' }}>
                      <Layers size={16} />
                    </div>
                    <div>
                      <h2 className="unit-name" style={{ fontSize: '1.05rem' }}>DISTILLATION COLUMN — BINARY FRACTIONATOR</h2>
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
                      <span>Ask AI Copilot</span>
                    </button>
                  </div>
                </div>

                <div className="unit-metrics-list" style={{ marginTop: '6px' }}>
                  <div className="metric-row">
                    <span className="metric-label">Top Overhead Vapor Temperature</span>
                    <span className="metric-value" style={{ color: state.equipment.distillation.data.top_temperature > 78 ? 'var(--sev-critical-text)' : 'inherit' }}>
                      {state.equipment.distillation.data.top_temperature.toFixed(1)} °C
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Bottom Reboiler Temperature</span>
                    <span className="metric-value">{state.equipment.distillation.data.bottom_temperature.toFixed(1)} °C</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Column Operating Pressure</span>
                    <span className="metric-value">{state.equipment.distillation.data.pressure.toFixed(2)} bar</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Reflux Ratio (L/D)</span>
                    <span className="metric-value" style={{ color: distIsWarning ? 'var(--sev-medium-text)' : 'var(--sev-normal-text)' }}>
                      {state.equipment.distillation.data.reflux_ratio.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '10px 14px', background: 'var(--bg-card-subtle)', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                  <h4 style={{ fontSize: '0.78rem', color: 'var(--primary-blue)', marginBottom: '3px', fontWeight: 700 }}>
                    Reflux Ratio Dynamics & Column Separation
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Reflux ratio controls the liquid wash returned to upper column trays. When reflux drops below 1.1,
                    uncondensed heavy vapor reaches the condenser, causing top temperature to rise and separation efficiency to degrade.
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

          {/* TAB 6: AI DIAGNOSIS & INTERACTIVE COPILOT DEEP DIVE */}
          {activeTab === 'ai_diagnosis' && (
            <div className="tab-content-anim">
              <AiDiagnosisPanel
                diagnosis={state.diagnosis}
                equipment={state.equipment}
                initialChatEquipment={chatEquipment}
              />

              <div className="charts-section">
                <h3 className="section-title">HYBRID AI ARCHITECTURE & EXPLAINABILITY PIPELINE</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginTop: '6px' }}>
                  <div className="normal-card">
                    <span className="step-label" style={{ color: 'var(--primary-blue)' }}>Step 1: Isolation Forest</span>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.35' }}>
                      Constructs randomized isolation trees across 9 normalized continuous process features.
                      Computes anomaly score: <strong style={{ fontFamily: 'var(--font-mono)' }}>{state.diagnosis.anomaly_score?.toFixed(3) || '0.180'}</strong> (Threshold = 0.58).
                    </p>
                  </div>

                  <div className="normal-card">
                    <span className="step-label" style={{ color: 'var(--ai-cyan-hover)' }}>Step 2: Random Forest</span>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.35' }}>
                      Ensemble of decision trees trained on synthetic chemical engineering correlations.
                      Predicted class: <strong>{state.diagnosis.fault}</strong> with <strong style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(state.diagnosis.confidence * 100)}%</strong> ensemble confidence.
                    </p>
                  </div>

                  <div className="normal-card">
                    <span className="step-label" style={{ color: 'var(--sev-normal-text)' }}>Step 3: Engineering Rules & Copilot</span>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.35' }}>
                      Validates ML predictions against first-principles chemical engineering heuristics and answers interactive operator Q&A grounded on live telemetry.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: ALERTS */}
          {activeTab === 'alerts' && (
            <div className="tab-content-anim">
              <AlertsPanel alerts={alerts} />
            </div>
          )}

          {/* ALWAYS VISIBLE: SAFETY DISCLAIMER */}
          <SafetyDisclaimer />
        </main>
      </div>
    </div>
  );
};

export default App;
