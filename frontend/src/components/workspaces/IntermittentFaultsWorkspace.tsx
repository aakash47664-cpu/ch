import React, { useState, useEffect, useMemo } from 'react';
import {
  ProcessUpdatePayload,
  IntermittentEvent,
  IntermittentDetectorState,
  IntermittentRecurrenceStats
} from '../../types';
import {
  fetchIntermittentEvents,
  fetchIntermittentStats,
  triggerIntermittentTestPulse,
  clearIntermittentHistory
} from '../../services/api';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  Clock,
  Zap,
  Activity,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Layers,
  Flame,
  Cpu,
  RotateCcw,
  Info,
  Sliders,
  Calendar,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';

interface IntermittentFaultsWorkspaceProps {
  state: ProcessUpdatePayload;
  onNavigateTab?: (tab: 'overview' | 'flowsheet' | 'pump' | 'heat_exchanger' | 'reactor' | 'distillation' | 'ai_diagnosis' | 'alerts') => void;
  onAskAiAbout?: (unitId: string) => void;
}

export const IntermittentFaultsWorkspace: React.FC<IntermittentFaultsWorkspaceProps> = ({
  state
}) => {
  const liveDetectorState: IntermittentDetectorState | undefined = state.intermittent_faults;

  const [events, setEvents] = useState<IntermittentEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<string>('ALL');
  const [patternFilter, setPatternFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInjectingPulse, setIsInjectingPulse] = useState<boolean>(false);
  const [pulseMessage, setPulseMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<IntermittentRecurrenceStats | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [eventsRes, statsRes] = await Promise.all([
        fetchIntermittentEvents({ limit: 50 }),
        fetchIntermittentStats()
      ]);
      if (eventsRes?.events) {
        setEvents(eventsRes.events);
        if (eventsRes.events.length > 0 && !selectedEventId) {
          setSelectedEventId(eventsRes.events[0].event_id);
        }
      }
      if (statsRes?.stats) {
        setStats(statsRes.stats);
      }
    } catch (err) {
      console.warn('Intermittent workspace data load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      fetchIntermittentEvents({ limit: 50 }).then((res) => {
        if (res?.events) setEvents(res.events);
      }).catch(() => {});
      fetchIntermittentStats().then((res) => {
        if (res?.stats) setStats(res.stats);
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (liveDetectorState?.recent_events && liveDetectorState.recent_events.length > 0) {
      setEvents((prev) => {
        const map = new Map<string, IntermittentEvent>();
        (liveDetectorState.recent_events || []).forEach(e => map.set(e.event_id, e));
        (prev || []).forEach(e => {
          if (!map.has(e.event_id)) map.set(e.event_id, e);
        });
        return Array.from(map.values()).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
      });
    }
  }, [liveDetectorState?.recent_events, liveDetectorState?.active_events]);

  const activeEvents = liveDetectorState?.active_events || events.filter(e => e.status === 'EVENT ACTIVE');
  const activeCount = liveDetectorState?.active_events_count ?? activeEvents.length;

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return events[0] || activeEvents[0] || null;
    return (
      activeEvents.find(e => e.event_id === selectedEventId) ||
      events.find(e => e.event_id === selectedEventId) ||
      events[0] ||
      null
    );
  }, [selectedEventId, events, activeEvents]);

  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      const matchEquip = equipmentFilter === 'ALL' || ev.equipment_id === equipmentFilter || ev.equipment_id.replace(/-/g, '') === equipmentFilter.replace(/-/g, '');
      const patternVal = (ev.pattern || ev.event_type || '').toUpperCase();
      const matchPattern = patternFilter === 'ALL' || patternVal === patternFilter || (patternFilter === 'ISOLATED' && patternVal.includes('ISOLATED'));
      return matchEquip && matchPattern;
    });
  }, [events, equipmentFilter, patternFilter]);

  const recurrenceSummary = useMemo(() => {
    const liveStats = liveDetectorState?.recurrence_stats || stats;
    const total = liveStats?.total_events ?? events.length;
    const avgDur = liveStats?.avg_duration ?? 0;
    const lastTime = liveStats?.last_event_time ? new Date(liveStats.last_event_time).toLocaleTimeString() : 'N/A';
    const pattern = liveStats?.overall_pattern || (total >= 3 ? 'RECURRENT' : total === 2 ? 'INTERMITTENT' : total === 1 ? 'NON-REPEATABLE' : 'NORMAL');
    return { total, avgDur, lastTime, pattern, byEquip: liveStats?.by_equipment || {} };
  }, [liveDetectorState?.recurrence_stats, stats, events]);

  // 5-Category Real Counters from Actual Stored Event History
  const classificationCounters = useMemo(() => {
    const liveStats = liveDetectorState?.recurrence_stats || stats;
    let nonRepeatable = liveStats?.non_repeatable_events || 0;
    let isolated = liveStats?.isolated_events || 0;
    let sporadic = liveStats?.sporadic_events || 0;
    let intermittent = liveStats?.intermittent_events || 0;
    let recurrent = liveStats?.recurrent_events || 0;

    // Fallback directly to events array if stats not yet aggregated
    if (nonRepeatable === 0 && isolated === 0 && sporadic === 0 && intermittent === 0 && recurrent === 0 && events.length > 0) {
      events.forEach(e => {
        const p = (e.pattern || e.event_type || '').toUpperCase();
        if (p === 'NON-REPEATABLE') nonRepeatable++;
        else if (p === 'ISOLATED' || p === 'ISOLATED TRANSIENT') isolated++;
        else if (p === 'SPORADIC') sporadic++;
        else if (p === 'INTERMITTENT') intermittent++;
        else if (p === 'RECURRENT') recurrent++;
        else nonRepeatable++;
      });
    }

    return {
      nonRepeatable,
      isolated,
      sporadic,
      intermittent,
      recurrent
    };
  }, [liveDetectorState?.recurrence_stats, stats, events]);

  const hasNonRepeatableEvent = useMemo(() => {
    const p = (selectedEvent?.pattern || selectedEvent?.event_type || events[0]?.pattern || '').toUpperCase();
    return p === 'NON-REPEATABLE' || classificationCounters.nonRepeatable > 0;
  }, [selectedEvent, events, classificationCounters]);

  const handleTriggerPulse = async (equip: string, label: string, mode: string = 'single_spike') => {
    try {
      setIsInjectingPulse(true);
      setPulseMessage(`Injecting test anomaly (${label})...`);
      await triggerIntermittentTestPulse(equip, mode);
      const timeout = mode === 'persistent' ? 35000 : mode === 'three_pulse' ? 20000 : mode === 'two_pulse' ? 15000 : 5500;
      setTimeout(() => {
        setPulseMessage(null);
        setIsInjectingPulse(false);
      }, timeout);
    } catch (err: any) {
      console.error('Trigger pulse error:', err);
      setPulseMessage(`Error: ${err.message}`);
      setIsInjectingPulse(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Reset all intermittent fault event history and recurrence calculations?')) return;
    try {
      await clearIntermittentHistory();
      setEvents([]);
      setSelectedEventId(null);
      loadData();
    } catch (err) {
      console.error('Clear history error:', err);
    }
  };

  const formatTime = (ts: string | null | undefined) => {
    if (!ts) return 'N/A';
    try {
      return new Date(ts).toLocaleTimeString();
    } catch {
      return ts;
    }
  };

  const chartData = useMemo(() => {
    if (selectedEvent?.snapshot_history && selectedEvent.snapshot_history.length > 0) {
      return selectedEvent.snapshot_history.map((pt, idx) => ({
        index: idx + 1,
        time: pt.time || `${idx}s`,
        vibration: pt.pump_vibration ? Number((pt.pump_vibration * 1000).toFixed(0)) : undefined,
        rpm: pt.pump_rpm,
        flow: pt.pump_flow,
        hxDeltaT: pt.hx_delta_t,
        hxOutletTemp: pt.hx_outlet_temp,
        reactorTemp: pt.reactor_temp,
        reactorPressure: pt.reactor_pressure ? Number((pt.reactor_pressure * 10).toFixed(1)) : undefined,
        distReflux: pt.dist_reflux_ratio ? Number((pt.dist_reflux_ratio * 10).toFixed(1)) : undefined
      }));
    }

    if (liveDetectorState?.sliding_window && liveDetectorState.sliding_window.length > 0) {
      return liveDetectorState.sliding_window.map((pt, idx) => ({
        index: idx + 1,
        time: pt.time || `${idx}s`,
        vibration: pt.pump_vibration ? Number((pt.pump_vibration * 1000).toFixed(0)) : undefined,
        rpm: pt.pump_rpm,
        flow: pt.pump_flow,
        hxDeltaT: pt.hx_delta_t,
        hxOutletTemp: pt.hx_outlet_temp,
        reactorTemp: pt.reactor_temp,
        reactorPressure: pt.reactor_pressure ? Number((pt.reactor_pressure * 10).toFixed(1)) : undefined,
        distReflux: pt.dist_reflux_ratio ? Number((pt.dist_reflux_ratio * 10).toFixed(1)) : undefined
      }));
    }

    return [];
  }, [selectedEvent, liveDetectorState?.sliding_window]);

  return (
    <div className="intermittent-faults-workspace">
      {/* 1. PAGE HEADER */}
      <div className="if-header-banner">
        <div className="if-header-left">
          <div className="if-header-icon-box">
            <Clock size={22} />
          </div>
          <div className="if-header-text">
            <div className="if-header-title-row">
              <h2 className="if-title">INTERMITTENT &amp; TRANSIENT FAULT MONITOR</h2>
              <span className={`if-status-badge ${activeCount > 0 ? 'critical' : 'nominal'}`}>
                {activeCount > 0 ? `● ${activeCount} ACTIVE TRANSIENT EVENT` : '● MONITORING NOMINAL'}
              </span>
              <span className="if-engine-tag">NON-REPEATABLE &amp; TEMPORAL ENGINE</span>
            </div>
            <p className="if-subtitle">
              Temporal detection and preservation of short-duration, non-repeatable, and recurring process abnormalities
            </p>
          </div>
        </div>

        <div className="if-header-actions">
          <button
            type="button"
            className="if-btn-action"
            onClick={loadData}
            disabled={isLoading}
            title="Refresh events from SQLite database"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="if-btn-action reset"
            onClick={handleClearHistory}
            title="Reset intermittent fault event memory"
          >
            <RotateCcw size={13} />
            <span>Reset History</span>
          </button>
        </div>
      </div>

      {/* 2. WHY THIS MATTERS (NOVELTY STATEMENT) */}
      <div className="if-novelty-card">
        <div className="if-novelty-icon">
          <Info size={16} />
        </div>
        <div className="if-novelty-content">
          <span className="if-novelty-title">WHY THIS MATTERS</span>
          <p className="if-novelty-text">
            ChemDiag preserves short-duration abnormal events even when they occur only once, then uses temporal history to determine whether later events form a sporadic, intermittent, or recurrent pattern.
          </p>
        </div>
      </div>

      {/* 2b. NON-REPEATABLE WARNING ALERT BANNER */}
      {hasNonRepeatableEvent && (
        <div className="if-warning-banner">
          <div className="if-warning-banner-left">
            <div className="if-warning-banner-icon">
              <AlertTriangle size={18} />
            </div>
            <div>
              <span className="if-warning-banner-title">
                ⚠ NON-REPEATABLE EVENT DETECTED
              </span>
              <p className="if-warning-banner-sub">
                An abnormal transient event was detected and preserved for further temporal analysis.
              </p>
            </div>
          </div>
          <span className="if-badge-pattern non-repeatable">
            PRESERVED IN HISTORY
          </span>
        </div>
      )}

      {/* 3. EVENT CLASSIFICATION (5 REAL COUNTERS SECTION) */}
      <div className="if-section-card">
        <div className="if-section-title-row">
          <h3 className="if-section-title">
            <Activity size={17} style={{ color: '#4f46e5' }} />
            <span>EVENT CLASSIFICATION</span>
          </h3>
        </div>

        <div className="if-classification-counters-grid">
          {/* NON-REPEATABLE */}
          <div className={`if-counter-card ${classificationCounters.nonRepeatable > 0 ? 'active-non-rep' : ''}`}>
            <div className="if-counter-header">
              <span className="if-counter-label">NON-REPEATABLE</span>
              <span className="if-badge-pattern non-repeatable" style={{ fontSize: '0.58rem', padding: '1px 5px' }}>
                Single Event
              </span>
            </div>
            <div className="if-counter-val">{classificationCounters.nonRepeatable}</div>
            <p className="if-counter-sub">Occurred once without recurrence</p>
          </div>

          {/* ISOLATED */}
          <div className="if-counter-card">
            <div className="if-counter-header">
              <span className="if-counter-label">ISOLATED</span>
              <span className="if-badge-pattern isolated" style={{ fontSize: '0.58rem', padding: '1px 5px' }}>
                Transient
              </span>
            </div>
            <div className="if-counter-val">{classificationCounters.isolated}</div>
            <p className="if-counter-sub">Short event with auto-recovery</p>
          </div>

          {/* SPORADIC */}
          <div className="if-counter-card">
            <div className="if-counter-header">
              <span className="if-counter-label">SPORADIC</span>
              <span className="if-badge-pattern sporadic" style={{ fontSize: '0.58rem', padding: '1px 5px' }}>
                Irregular
              </span>
            </div>
            <div className="if-counter-val">{classificationCounters.sporadic}</div>
            <p className="if-counter-sub">Multiple irregular intervals</p>
          </div>

          {/* INTERMITTENT */}
          <div className="if-counter-card">
            <div className="if-counter-header">
              <span className="if-counter-label">INTERMITTENT</span>
              <span className="if-badge-pattern intermittent" style={{ fontSize: '0.58rem', padding: '1px 5px' }}>
                Appears &amp; Returns
              </span>
            </div>
            <div className="if-counter-val">{classificationCounters.intermittent}</div>
            <p className="if-counter-sub">Disappears and returns</p>
          </div>

          {/* RECURRENT */}
          <div className="if-counter-card">
            <div className="if-counter-header">
              <span className="if-counter-label">RECURRENT</span>
              <span className="if-badge-pattern recurrent" style={{ fontSize: '0.58rem', padding: '1px 5px' }}>
                Repeated Pattern
              </span>
            </div>
            <div className="if-counter-val">{classificationCounters.recurrent}</div>
            <p className="if-counter-sub">&ge;3 events with clear recurrence</p>
          </div>
        </div>
      </div>

      {/* 4. SUMMARY CARDS (4-CARD RESPONSIVE GRID) */}
      <div className="if-summary-grid">
        {/* Card 1: EVENT MONITOR */}
        <div className="if-summary-card">
          <div className="if-card-header">
            <span className="if-card-label">EVENT MONITOR</span>
            <div className="if-card-icon-pill indigo">
              <Activity size={15} />
            </div>
          </div>
          <div>
            <div className="if-card-val-huge">{recurrenceSummary.total}</div>
            <p className="if-card-sub">Events detected in total</p>
          </div>
          <div className="if-card-footer">
            <div className="if-equip-breakdown-chips">
              <div className="if-equip-chip">P-101: <strong>{recurrenceSummary.byEquip['P-101']?.count || 0}</strong></div>
              <div className="if-equip-chip">E-101: <strong>{recurrenceSummary.byEquip['E-101']?.count || 0}</strong></div>
              <div className="if-equip-chip">R-101: <strong>{recurrenceSummary.byEquip['R-101']?.count || 0}</strong></div>
              <div className="if-equip-chip">D-101: <strong>{recurrenceSummary.byEquip['D-101']?.count || 0}</strong></div>
            </div>
          </div>
        </div>

        {/* Card 2: ACTIVE EVENTS */}
        <div className={`if-summary-card ${activeCount > 0 ? 'active-state' : ''}`}>
          <div className="if-card-header">
            <span className="if-card-label">ACTIVE EVENTS</span>
            <div className={`if-card-icon-pill ${activeCount > 0 ? 'amber animate-pulse' : 'emerald'}`}>
              <AlertTriangle size={15} />
            </div>
          </div>
          <div>
            <div className={`if-card-val-huge ${activeCount > 0 ? 'active' : ''}`}>{activeCount}</div>
            <p className="if-card-sub">
              {activeCount > 0 ? 'Active transient window' : 'No active transient disturbances'}
            </p>
          </div>
          <div className="if-card-footer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="if-card-sub">Debounce Hysteresis</span>
              <span className="if-badge-hysteresis">Active &bull; 2 ticks</span>
            </div>
          </div>
        </div>

        {/* Card 3: RECURRENT PATTERNS */}
        <div className="if-summary-card">
          <div className="if-card-header">
            <span className="if-card-label">RECURRENT PATTERNS</span>
            <div className="if-card-icon-pill purple">
              <RotateCcw size={15} />
            </div>
          </div>
          <div>
            <div style={{ marginBottom: '4px' }}>
              <span className={`if-badge-pattern ${recurrenceSummary.pattern.toLowerCase().replace(/\s+/g, '-')}`}>
                {recurrenceSummary.pattern}
              </span>
            </div>
            <p className="if-card-sub">Temporal recurrence classification</p>
          </div>
          <div className="if-card-footer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="if-card-sub">Avg Duration</span>
              <span className="if-card-sub" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0f172a' }}>
                {recurrenceSummary.avgDur > 0 ? `${recurrenceSummary.avgDur}s` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: LAST EVENT */}
        <div className="if-summary-card">
          <div className="if-card-header">
            <span className="if-card-label">LAST EVENT</span>
            <div className="if-card-icon-pill blue">
              <Clock size={15} />
            </div>
          </div>
          <div>
            <div className="if-card-val-huge" style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)' }}>
              {recurrenceSummary.lastTime}
            </div>
            <p className="if-card-sub">Latest detected abnormal pulse</p>
          </div>
          <div className="if-card-footer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="if-card-sub">Status</span>
              <span className="if-card-sub" style={{ fontFamily: 'var(--font-mono)', color: '#0f172a' }}>
                {events[0] ? `${events[0].equipment_id} (${events[0].duration}s)` : 'Nominal'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. IMPORTANT DISTINCTIONS SECTION */}
      <div className="if-section-card">
        <div className="if-section-title-row">
          <h3 className="if-section-title">
            <HelpCircle size={17} style={{ color: '#4f46e5' }} />
            <span>IMPORTANT DISTINCTIONS</span>
          </h3>
          <span className="if-section-meta">Diagnostic Classification Taxonomy</span>
        </div>

        <div className="if-distinctions-grid">
          <div className="if-distinction-card persistent">
            <span className="if-distinction-title" style={{ color: '#b91c1c' }}>PERSISTENT FAULT</span>
            <p className="if-distinction-text">
              Abnormal condition remains continuously present without returning to nominal baseline.
            </p>
          </div>

          <div className="if-distinction-card intermittent">
            <span className="if-distinction-title" style={{ color: '#4338ca' }}>INTERMITTENT FAULT</span>
            <p className="if-distinction-text">
              Abnormal condition repeatedly appears, disappears upon recovery, and returns over time.
            </p>
          </div>

          <div className="if-distinction-card non-repeatable">
            <span className="if-distinction-title" style={{ color: '#b45309' }}>NON-REPEATABLE FAULT</span>
            <p className="if-distinction-text">
              A significant abnormal event occurs but does not repeat sufficiently to establish a recurring pattern.
            </p>
          </div>

          <div className="if-distinction-card transient">
            <span className="if-distinction-title" style={{ color: '#0369a1' }}>TRANSIENT EVENT</span>
            <p className="if-distinction-text">
              Short-duration abnormal process behavior that may recover automatically through self-stabilization.
            </p>
          </div>
        </div>
      </div>

      {/* 6. TRANSIENT TEST BENCH BAR */}
      <div className="if-test-bench">
        <div className="if-bench-title-wrap">
          <Sliders size={16} style={{ color: '#4f46e5' }} />
          <div>
            <span className="if-bench-title">TRANSIENT TEST BENCH:</span>
            <span className="if-bench-sub" style={{ marginLeft: '6px' }}>
              Inject controlled transient patterns to validate non-repeatable preservation and recurrence logic
            </span>
          </div>
        </div>

        <div className="if-bench-buttons">
          <button
            type="button"
            className="if-bench-btn pump"
            onClick={() => handleTriggerPulse('pump', 'P-101 Non-Repeatable Single Spike', 'single_spike')}
            disabled={isInjectingPulse}
            title="Injects a 5s spike that recovers into a NON-REPEATABLE event"
          >
            <Activity size={13} />
            <span>Case 1: Non-Repeatable Spike (P-101)</span>
          </button>

          <button
            type="button"
            className="if-bench-btn hx"
            onClick={() => handleTriggerPulse('heat_exchanger', 'E-101 Intermittent 2-Pulse Cycle', 'two_pulse')}
            disabled={isInjectingPulse}
            title="Injects 2 alternating pulses to establish an INTERMITTENT pattern"
          >
            <Flame size={13} />
            <span>Case 2: Intermittent 2-Pulse (E-101)</span>
          </button>

          <button
            type="button"
            className="if-bench-btn reactor"
            onClick={() => handleTriggerPulse('reactor', 'R-101 Sporadic Irregular Pulses', 'sporadic')}
            disabled={isInjectingPulse}
            title="Injects irregular pulses to establish a SPORADIC pattern"
          >
            <Cpu size={13} />
            <span>Case 3: Sporadic Pulses (R-101)</span>
          </button>

          <button
            type="button"
            className="if-bench-btn dist"
            onClick={() => handleTriggerPulse('distillation', 'D-101 Recurrent 3-Pulse Sequence', 'three_pulse')}
            disabled={isInjectingPulse}
            title="Injects 3 consecutive pulses to establish a RECURRENT pattern"
          >
            <Layers size={13} />
            <span>Case 4: Recurrent 3-Pulse (D-101)</span>
          </button>
        </div>

        {pulseMessage && (
          <div style={{ width: '100%', marginTop: '6px', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#6d28d9', background: '#f5f3ff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={13} />
            <span>{pulseMessage}</span>
          </div>
        )}
      </div>

      {/* 7. EVENT TIMELINE */}
      <div className="if-section-card">
        <div className="if-section-title-row">
          <h3 className="if-section-title">
            <Calendar size={17} style={{ color: '#4f46e5' }} />
            <span>EVENT TIMELINE</span>
          </h3>
          <span className="if-section-meta">
            {events.length} Historical &amp; Active Events
          </span>
        </div>

        {events.length === 0 ? (
          <div className="if-timeline-empty">
            <Clock size={28} style={{ color: '#94a3b8', marginBottom: '8px' }} />
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', margin: '0 0 4px 0' }}>
              No transient or intermittent events detected.
            </p>
            <p style={{ fontSize: '0.74rem', color: '#64748b', margin: 0 }}>
              System monitoring live process telemetry. Short-duration abnormalities will be automatically preserved here upon detection.
            </p>
          </div>
        ) : (
          <div className="if-timeline-track">
            {events.slice(0, 15).map((ev) => {
              const isSelected = selectedEvent?.event_id === ev.event_id;
              const isActive = ev.status === 'EVENT ACTIVE';
              const pType = ev.pattern || ev.event_type || 'NON-REPEATABLE';
              return (
                <div
                  key={ev.event_id}
                  className={`if-timeline-node ${isSelected ? 'selected' : ''} ${isActive ? 'active-pulse' : ''}`}
                  onClick={() => setSelectedEventId(ev.event_id)}
                >
                  <div className="if-timeline-marker">
                    <AlertTriangle size={11} />
                  </div>
                  <div className="if-timeline-card">
                    <div className="if-timeline-header">
                      <span className="if-timeline-tag">{ev.equipment_id}</span>
                      <span className={`if-timeline-sev ${ev.severity.toLowerCase()}`}>
                        {ev.severity}
                      </span>
                    </div>
                    <div className="if-timeline-time">{formatTime(ev.start_time)}</div>
                    <div className="if-timeline-dur">{ev.duration}s &bull; {pType}</div>
                    <div className="if-timeline-vars" title={ev.variables?.join(', ')}>
                      {ev.variables?.slice(0, 2).join(', ')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 8. MAIN SPLIT VIEW: EVENT HISTORY TABLE (LEFT) & EVENT DETAIL (RIGHT) */}
      <div className="if-main-grid">
        {/* LEFT COLUMN: EVENT HISTORY TABLE */}
        <div className="if-section-card">
          <div className="if-section-title-row">
            <h3 className="if-section-title">
              <Activity size={17} style={{ color: '#4f46e5' }} />
              <span>EVENT HISTORY TABLE</span>
            </h3>
            <span className="if-section-meta">
              Showing {filteredEvents.length} of {events.length}
            </span>
          </div>

          {/* Filter Bar */}
          <div className="if-filter-bar">
            <div className="if-filter-group">
              <span className="if-filter-label">Unit:</span>
              {['ALL', 'P-101', 'E-101', 'R-101', 'D-101'].map((u) => (
                <button
                  key={u}
                  type="button"
                  className={`if-filter-chip ${equipmentFilter === u ? 'active' : ''}`}
                  onClick={() => setEquipmentFilter(u)}
                >
                  {u}
                </button>
              ))}
            </div>

            <div className="if-filter-group">
              <span className="if-filter-label">Pattern:</span>
              {['ALL', 'NON-REPEATABLE', 'ISOLATED', 'SPORADIC', 'INTERMITTENT', 'RECURRENT', 'PERSISTENT'].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`if-filter-chip ${patternFilter === p ? 'active' : ''}`}
                  onClick={() => setPatternFilter(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="if-table-wrapper">
            <table className="if-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Equipment</th>
                  <th>Event Type</th>
                  <th>Duration</th>
                  <th>Variables</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: '#64748b' }}>
                      No transient or intermittent events detected.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((ev) => {
                    const isSelected = selectedEvent?.event_id === ev.event_id;
                    const isActive = ev.status === 'EVENT ACTIVE';
                    const pType = ev.event_type || ev.pattern || 'NON-REPEATABLE';
                    return (
                      <tr
                        key={ev.event_id}
                        className={`table-row-selectable ${isSelected ? 'row-selected' : ''} ${isActive ? 'row-active-anomaly' : ''}`}
                        onClick={() => setSelectedEventId(ev.event_id)}
                      >
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{formatTime(ev.start_time)}</td>
                        <td><strong>{ev.equipment_id}</strong></td>
                        <td>
                          <span className={`if-badge-pattern ${pType.toLowerCase().replace(/\s+/g, '-')}`} style={{ fontSize: '0.60rem', padding: '2px 5px' }}>
                            {pType}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{ev.duration}s</td>
                        <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.variables?.join(', ')}>
                          {ev.variables?.join(' + ') || 'General'}
                        </td>
                        <td>
                          <span className={`if-timeline-sev ${ev.severity.toLowerCase()}`}>
                            {ev.severity}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: isActive ? '#fee2e2' : '#f1f5f9', color: isActive ? '#dc2626' : '#475569' }}>
                            {isActive ? '● ACTIVE' : 'RECOVERED'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: EVENT DETAIL & DYNAMICS INSPECTOR */}
        <div className="if-section-card">
          <div className="if-section-title-row">
            <h3 className="if-section-title">
              <ShieldAlert size={17} style={{ color: '#7c3aed' }} />
              <span>EVENT DETAILS</span>
            </h3>
            {selectedEvent && (
              <span className={`if-status-badge ${selectedEvent.status === 'EVENT ACTIVE' ? 'critical' : 'nominal'}`}>
                {selectedEvent.status}
              </span>
            )}
          </div>

          {selectedEvent ? (
            <div>
              {/* Event Metadata Grid */}
              <div className="if-detail-meta">
                <div className="if-meta-item">
                  <span className="if-meta-label">Equipment</span>
                  <span className="if-meta-val" style={{ fontWeight: 700 }}>{selectedEvent.equipment_id} ({selectedEvent.equipment_name || 'Process Unit'})</span>
                </div>
                <div className="if-meta-item">
                  <span className="if-meta-label">Event Type</span>
                  <span className="if-meta-val" style={{ fontWeight: 800, color: '#7c3aed' }}>
                    {selectedEvent.event_type || selectedEvent.pattern}
                  </span>
                </div>
                <div className="if-meta-item">
                  <span className="if-meta-label">Start Time</span>
                  <span className="if-meta-val" style={{ fontFamily: 'var(--font-mono)' }}>{formatTime(selectedEvent.start_time)}</span>
                </div>
                <div className="if-meta-item">
                  <span className="if-meta-label">End / Duration</span>
                  <span className="if-meta-val" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {selectedEvent.end_time ? `${formatTime(selectedEvent.end_time)} (${selectedEvent.duration}s)` : `Active (${selectedEvent.duration}s)`}
                  </span>
                </div>
                <div className="if-meta-item">
                  <span className="if-meta-label">Severity</span>
                  <span className={`if-meta-val ${selectedEvent.severity.toLowerCase()}`}>{selectedEvent.severity}</span>
                </div>
                <div className="if-meta-item">
                  <span className="if-meta-label">Recurrence Count</span>
                  <span className="if-meta-val" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {selectedEvent.recurrence_count || 1}
                  </span>
                </div>
              </div>

              {/* Observed Variables: Baseline -> Event Value Shifts */}
              <span className="if-subheading">OBSERVED VARIABLES (BASELINE &rarr; EVENT)</span>
              <div className="if-shift-grid">
                {Object.keys(selectedEvent.deviation || {}).map((varKey) => {
                  const dev = selectedEvent.deviation[varKey];
                  const base = selectedEvent.baseline?.[varKey];
                  if (!dev) return null;
                  const isUp = dev.delta > 0;
                  return (
                    <div key={varKey} className={`if-shift-card ${dev.isAbnormal ? 'abnormal' : ''}`}>
                      <div className="if-shift-header">
                        <span className="if-shift-name">{base?.name || varKey}</span>
                        <span className="if-shift-pct" style={{ color: isUp ? '#dc2626' : '#2563eb' }}>
                          {isUp ? <TrendingUp size={12} style={{ display: 'inline', marginRight: '2px' }} /> : <TrendingDown size={12} style={{ display: 'inline', marginRight: '2px' }} />}
                          {isUp ? `+${dev.percent}%` : `${dev.percent}%`}
                        </span>
                      </div>
                      <div className="if-shift-values">
                        <span>Baseline: <strong>{dev.nominal} {dev.unit}</strong></span>
                        <span>&rarr;</span>
                        <span style={{ color: '#0f172a' }}>Event: <strong>{dev.current} {dev.unit}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Observed & Interpretation Box */}
              <div className="if-obs-box">
                <span className="if-obs-title">Observed Dynamics:</span>
                <p className="if-obs-text">{selectedEvent.observation || 'Transient parameter deviation recorded.'}</p>
                <span className="if-interp-title">Temporal Interpretation:</span>
                <p className="if-interp-text">{selectedEvent.interpretation || 'Single transient abnormal event detected. No recurrence has been observed within the available history.'}</p>
              </div>

              {/* Time-Series Dynamics Chart */}
              <div>
                <span className="if-subheading">TIME-SERIES DYNAMICS (BEFORE &rarr; EVENT &rarr; RECOVERY)</span>
                <div className="if-chart-container">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="time" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', color: '#fff', fontSize: '11px', borderRadius: '6px', border: 'none' }} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />

                        {selectedEvent.equipment_id.includes('P') && (
                          <>
                            <Line type="monotone" dataKey="vibration" name="Vibration (mg)" stroke="#e11d48" strokeWidth={2} dot={false} isAnimationActive={false} />
                            <Line type="monotone" dataKey="flow" name="Flow (L/min)" stroke="#0284c7" strokeWidth={2} dot={false} isAnimationActive={false} />
                          </>
                        )}
                        {selectedEvent.equipment_id.includes('E') && (
                          <>
                            <Line type="monotone" dataKey="hxDeltaT" name="ΔT (°C)" stroke="#d97706" strokeWidth={2} dot={false} isAnimationActive={false} />
                            <Line type="monotone" dataKey="hxOutletTemp" name="Outlet Temp (°C)" stroke="#dc2626" strokeWidth={2} dot={false} isAnimationActive={false} />
                          </>
                        )}
                        {selectedEvent.equipment_id.includes('R') && (
                          <>
                            <Line type="monotone" dataKey="reactorTemp" name="Reactor Temp (°C)" stroke="#dc2626" strokeWidth={2} dot={false} isAnimationActive={false} />
                            <Line type="monotone" dataKey="reactorPressure" name="Pressure (bar x10)" stroke="#7c3aed" strokeWidth={2} dot={false} isAnimationActive={false} />
                          </>
                        )}
                        {selectedEvent.equipment_id.includes('D') && (
                          <>
                            <Line type="monotone" dataKey="distReflux" name="Reflux Ratio (x10)" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px', fontSize: '0.72rem', color: '#94a3b8' }}>
                      Collecting high-resolution snapshot...
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
              <Clock size={28} style={{ color: '#cbd5e1', margin: '0 auto 8px' }} />
              <p style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', margin: '0 0 4px 0' }}>No Event Selected</p>
              <p style={{ fontSize: '0.72rem', margin: 0 }}>Select an event from the timeline or history table to inspect details.</p>
            </div>
          )}
        </div>
      </div>

      {/* 9. TEMPORAL RECURRENCE & CLUSTERING ANALYSIS */}
      <div className="if-section-card">
        <div className="if-section-title-row">
          <h3 className="if-section-title">
            <RotateCcw size={17} style={{ color: '#7c3aed' }} />
            <span>TEMPORAL RECURRENCE &amp; CLUSTERING ANALYSIS</span>
          </h3>
          <span className="if-engine-tag">
            OVERALL PATTERN: {recurrenceSummary.pattern}
          </span>
        </div>

        <div className="if-rec-grid">
          <div className="if-rec-box">
            <span className="if-rec-label">Total Events Tracked</span>
            <span className="if-rec-val">{recurrenceSummary.total}</span>
            <span className="if-rec-sub">Recorded across all process units</span>
          </div>

          <div className="if-rec-box">
            <span className="if-rec-label">Average Event Duration</span>
            <span className="if-rec-val">{recurrenceSummary.avgDur > 0 ? `${recurrenceSummary.avgDur}s` : 'N/A'}</span>
            <span className="if-rec-sub">Short-duration transient envelope</span>
          </div>

          <div className="if-rec-box">
            <span className="if-rec-label">Overall Recurrence Pattern</span>
            <span className="if-rec-val" style={{ color: '#7c3aed' }}>{recurrenceSummary.pattern}</span>
            <span className="if-rec-sub">Clustered temporal classification</span>
          </div>

          <div className="if-rec-box">
            <span className="if-rec-label">Last Occurrence</span>
            <span className="if-rec-val" style={{ fontSize: '1.05rem', fontFamily: 'var(--font-mono)' }}>{recurrenceSummary.lastTime}</span>
            <span className="if-rec-sub">Continuous time-window monitoring</span>
          </div>
        </div>

        {/* Equipment Breakdown Table */}
        <div className="if-table-wrapper">
          <table className="if-table">
            <thead>
              <tr>
                <th>Equipment Unit</th>
                <th>Total Events</th>
                <th>Avg Duration</th>
                <th>Avg Interval</th>
                <th>Last Occurrence</th>
                <th>Unit Temporal Pattern</th>
                <th>Engineering Assessment</th>
              </tr>
            </thead>
            <tbody>
              {[
                { tag: 'P-101', name: 'Pump (6V Mini Centrifugal)', stats: recurrenceSummary.byEquip['P-101'] },
                { tag: 'E-101', name: 'Heat Exchanger (Shell & Tube)', stats: recurrenceSummary.byEquip['E-101'] },
                { tag: 'R-101', name: 'CSTR Reactor', stats: recurrenceSummary.byEquip['R-101'] },
                { tag: 'D-101', name: 'Distillation Column', stats: recurrenceSummary.byEquip['D-101'] }
              ].map((row) => {
                const count = row.stats?.count || 0;
                const dur = row.stats?.avg_duration || 0;
                const interval = row.stats?.avg_interval;
                const last = row.stats?.last_seen ? formatTime(row.stats.last_seen) : 'None';
                const pattern = row.stats?.pattern || (count >= 3 ? 'RECURRENT' : count === 2 ? 'INTERMITTENT' : count === 1 ? 'NON-REPEATABLE' : 'NOMINAL');
                return (
                  <tr key={row.tag}>
                    <td><strong>{row.tag}</strong> &bull; {row.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{count}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{dur > 0 ? `${dur}s` : '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{interval ? `${interval}s` : '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{last}</td>
                    <td>
                      <span className={`if-badge-pattern ${pattern.toLowerCase().replace(/\s+/g, '-')}`} style={{ fontSize: '0.60rem', padding: '2px 5px' }}>
                        {pattern}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.72rem', color: '#475569' }}>
                      {count === 0 && 'Nominal baseline operation. No transient events recorded.'}
                      {count === 1 && 'Single event preserved for temporal monitoring; no recurrence observed.'}
                      {count === 2 && 'Intermittent occurrence detected. Monitor temporal interval.'}
                      {count >= 3 && 'Recurrent pattern established. Inspect mechanical/thermal linkages.'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
