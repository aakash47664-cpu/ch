import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Clock, Activity } from 'lucide-react';

interface NavbarProps {
  esp32Connected: boolean;
  esp32Message: string;
}

export const Navbar: React.FC<NavbarProps> = ({ esp32Connected, esp32Message }) => {
  const [currentTime, setCurrentTime] = useState<string>(() => new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
        {/* Live System Online Status Indicator with subtle pulse */}
        <div className="sys-online-badge">
          <span className="sys-online-dot"></span>
          <span>SYSTEM ONLINE</span>
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
