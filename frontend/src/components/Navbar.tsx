import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Clock, Activity } from 'lucide-react';

import { AlertSummary } from '../types';

interface NavbarProps {
  esp32Connected: boolean;
  esp32Message: string;
  alertSummary?: AlertSummary;
  activeAlertCount?: number;
  onAlertsClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  esp32Connected,
  esp32Message,
  alertSummary,
  activeAlertCount = 0,
  onAlertsClick
}) => {
  const [currentTime, setCurrentTime] = useState<string>(() => new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const totalAlerts = alertSummary?.activeCount ?? activeAlertCount;
  const criticals = alertSummary?.criticalCount ?? 0;

  return (
    <header className="top-navbar">
      <div className="navbar-left">
        <div>
          <h1 className="navbar-brand-title">
            ChemDiag <span style={{ color: 'var(--ai-cyan)' }}>AI</span>
          </h1>
          <p className="navbar-brand-subtitle">
            Explainable AI-Based Fault Diagnosis & Root-Cause Analysis
          </p>
        </div>
      </div>

      <div className="navbar-right">
        {/* Live System Online Status Indicator */}
        <div className="sys-online-badge">
          <span className="sys-online-dot"></span>
          <span>SYSTEM ONLINE</span>
        </div>

        {/* Live Active Alerts Counter Badge */}
        <div
          className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer transition ${
            totalAlerts > 0
              ? criticals > 0
                ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}
          onClick={onAlertsClick}
          title={totalAlerts > 0 ? `${totalAlerts} Active Process Alerts (${criticals} Critical)` : 'No active alerts'}
        >
          <Activity size={12} className={totalAlerts > 0 ? 'text-red-400' : 'text-emerald-400'} />
          <span>ALERTS: {totalAlerts}</span>
        </div>

        {/* ESP32 Hardware Status Badge */}
        <div
          className={`hw-status-pill ${esp32Connected ? 'connected' : 'offline'}`}
          title={esp32Message || (esp32Connected ? 'ESP32 Hardware Stream Active' : 'ESP32 Hardware Offline')}
        >
          {esp32Connected ? (
            <>
              <Wifi size={12} color="var(--primary-blue)" />
              <span>ESP32: CONNECTED</span>
            </>
          ) : (
            <>
              <WifiOff size={12} color="var(--sev-medium-text)" />
              <span>ESP32: OFFLINE</span>
            </>
          )}
        </div>

        {/* Live Industrial Clock */}
        <div className="navbar-clock" title="System Local Telemetry Clock">
          <Clock size={12} color="var(--text-muted)" />
          <span>{currentTime}</span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
