import React from 'react';
import { AlertItem } from '../types';
import { Bell, CheckCircle2 } from 'lucide-react';

interface AlertsPanelProps {
  alerts?: AlertItem[] | any;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts }) => {
  const safeAlerts: AlertItem[] = Array.isArray(alerts)
    ? alerts
    : Array.isArray((alerts as any)?.alerts)
      ? (alerts as any).alerts
      : Array.isArray((alerts as any)?.data)
        ? (alerts as any).data
        : Array.isArray((alerts as any)?.data?.alerts)
          ? (alerts as any).data.alerts
          : [];

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL': return 'sev-critical';
      case 'HIGH': return 'sev-high';
      case 'MEDIUM': return 'sev-medium';
      case 'LOW': return 'sev-low';
      default: return 'sev-normal';
    }
  };

  const getRowClass = (sev: string) => {
    if (sev?.toUpperCase() === 'CRITICAL') return 'critical-row';
    if (sev?.toUpperCase() === 'HIGH') return 'high-row';
    return '';
  };

  return (
    <section className="alerts-section" aria-label="System Alerts Log">
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={15} color="var(--primary-blue)" />
          <h3 className="section-title">ACTIVE PROCESS ALERTS LOG</h3>
          <span className={`nav-alert-badge ${safeAlerts.length === 0 ? 'zero' : ''}`}>
            {safeAlerts.length} {safeAlerts.length === 1 ? 'EVENT' : 'EVENTS'}
          </span>
        </div>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          Continuous SQLite event log buffer · Real-time event detection
        </span>
      </div>

      {safeAlerts.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <CheckCircle2 size={22} color="var(--sev-normal)" style={{ margin: '0 auto 6px', display: 'block' }} />
          NO ACTIVE ALERTS — All chemical process equipment operating within nominal tolerances.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="alerts-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Time</th>
                <th style={{ width: '130px' }}>Equipment</th>
                <th>Diagnosed Fault</th>
                <th>Probable Root Cause</th>
                <th style={{ width: '100px' }}>Severity</th>
              </tr>
            </thead>
            <tbody>
              {safeAlerts.map((alert, index) => (
                <tr
                  key={alert.id || index}
                  className={getRowClass(alert.severity)}
                >
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : 'Recent'}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {alert.equipment}
                  </td>
                  <td style={{ color: alert.severity === 'NORMAL' ? 'var(--sev-normal-text)' : 'var(--sev-critical-text)', fontWeight: 600 }}>
                    {alert.fault}
                  </td>
                  <td style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    {alert.root_cause}
                  </td>
                  <td>
                    <span className={`severity-badge ${getSeverityBadgeClass(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default AlertsPanel;
