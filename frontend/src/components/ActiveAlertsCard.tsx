import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Check,
  History,
  RefreshCw,
  Clock,
  Activity,
  Layers
} from 'lucide-react';
import { IntelligentAlert, AlertSummary } from '../types';
import { acknowledgeAlert, acknowledgeAllAlerts, fetchAlertHistory } from '../services/api';

interface ActiveAlertsCardProps {
  alerts: IntelligentAlert[];
  alertSummary?: AlertSummary;
  selectedEquipment?: string | null;
  onSelectEquipment?: (equipmentId: string) => void;
  onAnalyzeWithAi?: (alert: IntelligentAlert) => void;
  onAlertsUpdated?: () => void;
}

export const ActiveAlertsCard: React.FC<ActiveAlertsCardProps> = ({
  alerts = [],
  alertSummary,
  selectedEquipment,
  onSelectEquipment,
  onAnalyzeWithAi,
  onAlertsUpdated
}) => {
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyAlerts, setHistoryAlerts] = useState<IntelligentAlert[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Compute counts from alerts array or summary prop
  const safeAlerts = Array.isArray(alerts) ? alerts : [];
  const activeList = safeAlerts.filter(a => a && (a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED'));
  const criticalCount = alertSummary?.criticalCount ?? activeList.filter(a => a.severity === 'CRITICAL').length;
  const highCount = alertSummary?.highCount ?? activeList.filter(a => a.severity === 'HIGH').length;
  const warningCount = alertSummary?.warningCount ?? activeList.filter(a => a.severity === 'WARNING').length;
  const infoCount = alertSummary?.infoCount ?? activeList.filter(a => a.severity === 'INFO').length;
  const activeCount = alertSummary?.activeCount ?? activeList.length;

  // Auto-expand first alert if none expanded and alerts change
  useEffect(() => {
    if (activeList.length > 0 && (!expandedAlertId || !activeList.some(a => a.id === expandedAlertId))) {
      setExpandedAlertId(activeList[0].id);
    }
  }, [activeList.length]);

  const handleToggleHistory = async () => {
    if (!showHistory) {
      setLoadingHistory(true);
      try {
        const res = await fetchAlertHistory(30);
        if (res.history) {
          setHistoryAlerts(res.history);
        }
      } catch (e) {
        console.error('Failed to load alert history:', e);
      } finally {
        setLoadingHistory(false);
      }
    }
    setShowHistory(!showHistory);
  };

  const handleAcknowledge = async (e: React.MouseEvent, alertId: string) => {
    e.stopPropagation();
    setActionLoading(alertId);
    try {
      await acknowledgeAlert(alertId);
      if (onAlertsUpdated) onAlertsUpdated();
    } catch (err) {
      console.error('Acknowledge failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcknowledgeAll = async () => {
    setActionLoading('all');
    try {
      await acknowledgeAllAlerts();
      if (onAlertsUpdated) onAlertsUpdated();
    } catch (err) {
      console.error('Acknowledge all failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const getEquipmentId = (name: string): string => {
    const n = (name || '').toUpperCase();
    if (n.includes('P-101') || n.includes('PUMP')) return 'pump';
    if (n.includes('E-101') || n.includes('EXCHANGER')) return 'heat_exchanger';
    if (n.includes('R-101') || n.includes('REACTOR')) return 'reactor';
    if (n.includes('D-101') || n.includes('DISTILLATION') || n.includes('COLUMN')) return 'distillation';
    return 'pump';
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'sev-critical';
      case 'HIGH':
        return 'sev-high';
      case 'WARNING':
        return 'sev-medium';
      case 'INFO':
        return 'sev-low';
      default:
        return 'sev-normal';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return <AlertOctagon size={16} color="var(--sev-critical)" />;
      case 'HIGH':
        return <AlertTriangle size={16} color="var(--sev-high)" />;
      case 'WARNING':
        return <AlertTriangle size={16} color="var(--sev-medium)" />;
      case 'INFO':
        return <Info size={16} color="var(--ai-cyan)" />;
      default:
        return <CheckCircle2 size={16} color="var(--sev-normal)" />;
    }
  };

  return (
    <div className="ia-card">
      {/* CARD HEADER */}
      <div className="ia-header">
        <div className="ia-header-left">
          <div className="ia-title-icon-box" title="Real-Time Intelligent Safety & Fault Telemetry">
            <Activity size={16} />
            {activeCount > 0 && <span className="ia-live-ping" />}
          </div>
          <div className="ia-title-wrap">
            <span className="ia-title">INTELLIGENT ALERTS</span>
            <span className={`ia-active-badge ${activeCount === 0 ? 'zero' : 'active'}`}>
              {activeCount} ACTIVE
            </span>
          </div>
        </div>

        {/* Live Severity Breakdown / Nominal State in Header */}
        <div className="ia-header-breakdown">
          {activeCount === 0 ? (
            <span className="ia-status-nominal-pill">
              <CheckCircle2 size={12} />
              <span>✓ NOMINAL</span>
            </span>
          ) : (
            <>
              {criticalCount > 0 && (
                <span className="ia-sev-pill crit" title={`${criticalCount} Critical Alerts`}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--sev-critical)' }} />
                  {criticalCount} CRIT
                </span>
              )}
              {highCount > 0 && (
                <span className="ia-sev-pill high" title={`${highCount} High Alerts`}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--sev-high)' }} />
                  {highCount} HIGH
                </span>
              )}
              {warningCount > 0 && (
                <span className="ia-sev-pill warn" title={`${warningCount} Warning Alerts`}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--sev-medium)' }} />
                  {warningCount} WARN
                </span>
              )}
              {infoCount > 0 && (
                <span className="ia-sev-pill info" title={`${infoCount} Info Alerts`}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--ai-cyan)' }} />
                  {infoCount} INFO
                </span>
              )}
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="ia-header-actions">
          {activeCount > 0 && (
            <button
              onClick={handleAcknowledgeAll}
              disabled={actionLoading === 'all'}
              className="ia-btn"
              title="Acknowledge all active alerts"
            >
              <Check size={13} color="var(--sev-normal)" />
              <span>Ack All</span>
            </button>
          )}

          <button
            onClick={handleToggleHistory}
            className={`ia-btn ia-btn-history ${showHistory ? 'active' : ''}`}
            title="Toggle Alert History Log"
          >
            <History size={13} />
            <span>{showHistory ? 'Active Alerts' : 'Alert History'}</span>
          </button>
        </div>
      </div>

      {/* CARD BODY */}
      <div className="ia-body">
        {/* HISTORY VIEW */}
        {showHistory ? (
          <div className="ia-history-container">
            <div className="ia-history-header">
              <span>ALERT HISTORY (DATABASE LOG)</span>
              <button
                onClick={handleToggleHistory}
                className="ia-link-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>

            {loadingHistory ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.74rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <RefreshCw size={14} className="spin-anim" /> Loading history...
              </div>
            ) : historyAlerts.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.74rem', fontFamily: 'var(--font-mono)' }}>
                No past alerts recorded in database log.
              </div>
            ) : (
              <div>
                {historyAlerts.map(h => (
                  <div
                    key={h.id || (h as any).alert_key || Math.random()}
                    className="ia-history-item"
                  >
                    <div className="ia-history-main">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className={`severity-badge ${getSeverityBadgeClass(h.severity)}`}>
                          {h.severity}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.74rem' }}>{h.equipment}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>{h.title}</span>
                      </div>
                      <p style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: 2 }}>{h.likely_cause || (h as any).fault}</p>
                    </div>
                    <div className="ia-history-meta">
                      <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{h.status}</div>
                      <div>{h.triggered_at ? new Date(h.triggered_at).toLocaleTimeString() : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ACTIVE ALERTS OR NOMINAL VIEW */
          <>
            {activeList.length === 0 ? (
              <div className="ia-nominal-container">
                <div className="ia-nominal-icon-wrap">
                  <CheckCircle2 size={24} />
                </div>
                <span className="ia-nominal-badge">✓ NOMINAL</span>
                <h4 className="ia-nominal-heading">All Systems Operating Nominally</h4>
                <p className="ia-nominal-desc">
                  Continuous multi-variable monitoring active. No hydraulic, thermal, or pressure boundary violations detected across P-101, E-101, R-101, and D-101.
                </p>
              </div>
            ) : (
              <div className="ia-alerts-list">
                {activeList.map(alert => {
                  const isExpanded = expandedAlertId === alert.id;
                  const isAck = alert.status === 'ACKNOWLEDGED';
                  const sevLower = (alert.severity || 'info').toLowerCase();
                  const sevClass = sevLower === 'critical' ? 'severity-critical' : sevLower === 'high' ? 'severity-high' : sevLower === 'warning' ? 'severity-warning' : 'severity-info';

                  return (
                    <div
                      key={alert.id}
                      className={`ia-alert-item ${sevClass} ${isExpanded ? 'expanded' : ''}`}
                    >
                      {/* Alert Summary Header */}
                      <div
                        onClick={() => {
                          setExpandedAlertId(isExpanded ? null : alert.id);
                          if (onSelectEquipment) onSelectEquipment(getEquipmentId(alert.equipment));
                        }}
                        className="ia-alert-row"
                      >
                        <div className="ia-alert-main">
                          <div className="ia-alert-sev-icon">{getSeverityIcon(alert.severity)}</div>
                          <div className="ia-alert-info">
                            <div className="ia-alert-top-line">
                              <span className="ia-equip-tag">
                                {alert.equipment}
                              </span>
                              <span className={`severity-badge ${getSeverityBadgeClass(alert.severity)}`}>
                                {alert.severity}
                              </span>
                              {isAck && (
                                <span className="ia-ack-badge">
                                  ACKNOWLEDGED
                                </span>
                              )}
                              <h4 className="ia-alert-title">
                                {alert.title}
                              </h4>
                            </div>

                            <div className="ia-alert-sub-line">
                              {alert.parameter && (
                                <span className="ia-sub-param">
                                  <strong>{alert.parameter}:</strong> {alert.current_value}
                                </span>
                              )}
                              {alert.expected_range && (
                                <span className="ia-sub-range">
                                  (Expected: {alert.expected_range})
                                </span>
                              )}
                              <span className="ia-sub-time">
                                <Clock size={11} />
                                {alert.triggered_at ? new Date(alert.triggered_at).toLocaleTimeString() : 'Recent'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="ia-alert-actions">
                          {!isAck && (
                            <button
                              onClick={(e) => handleAcknowledge(e, alert.id)}
                              disabled={actionLoading === alert.id}
                              className="ia-btn-ack"
                              title="Acknowledge alert"
                            >
                              <Check size={11} color="var(--sev-normal)" />
                              <span>Ack</span>
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onAnalyzeWithAi) onAnalyzeWithAi(alert);
                            }}
                            className="ia-btn-ai"
                            title="Analyze with ChemDiag AI"
                          >
                            <Sparkles size={11} color="#FDE047" />
                            <span>AI Diagnose</span>
                          </button>

                          <div className="ia-chevron-toggle">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Detail Drawer */}
                      {isExpanded && (
                        <div className="ia-drawer">
                          <div className="ia-drawer-grid">
                            <div className="ia-drawer-box root-cause">
                              <span className="ia-drawer-box-title">
                                <AlertTriangle size={12} color="var(--sev-high-text)" />
                                Likely Root Cause
                              </span>
                              <p className="ia-drawer-box-text">
                                {alert.likely_cause}
                              </p>
                            </div>

                            <div className="ia-drawer-box process-impact">
                              <span className="ia-drawer-box-title">
                                <AlertOctagon size={12} color="var(--sev-critical-text)" />
                                Process & Safety Impact
                              </span>
                              <p className="ia-drawer-box-text">
                                {alert.process_impact}
                              </p>
                            </div>
                          </div>

                          {/* Multi-variable Correlated Effects */}
                          {alert.related_effects && alert.related_effects.length > 0 && (
                            <div className="ia-effects-box">
                              <span className="ia-effects-title">
                                <Layers size={12} color="var(--primary-blue)" /> Correlated Downstream Effects
                              </span>
                              <div className="ia-effects-list">
                                {alert.related_effects.map((eff, i) => (
                                  <span
                                    key={i}
                                    className="ia-effect-pill"
                                  >
                                    {eff}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Footer & Actions */}
                          <div className="ia-drawer-footer">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Clock size={11} />
                              <span>
                                Triggered: {alert.triggered_at ? new Date(alert.triggered_at).toLocaleTimeString() : 'Recent'}
                              </span>
                              {alert.acknowledged_at && (
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  • Acknowledged: {new Date(alert.acknowledged_at).toLocaleTimeString()}
                                </span>
                              )}
                            </div>

                            <div>
                              <button
                                onClick={() => {
                                  if (onSelectEquipment) onSelectEquipment(getEquipmentId(alert.equipment));
                                }}
                                className="ia-link-btn"
                              >
                                Highlight on Flowsheet →
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ActiveAlertsCard;

