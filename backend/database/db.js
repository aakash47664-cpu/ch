/**
 * ChemDiag AI — SQLite Database & SCADA Event / Audit / Maintenance History
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../../chemdiag.db');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to SQLite database:', err.message);
  } else {
    console.log(` Connected to SQLite database at ${dbPath}`);
  }
});

// Initialize database schema
export function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Telemetry records
      db.run(`
        CREATE TABLE IF NOT EXISTS telemetry (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          equipment TEXT NOT NULL,
          source TEXT NOT NULL,
          data TEXT NOT NULL
        )
      `);

      // 2. Diagnoses history
      db.run(`
        CREATE TABLE IF NOT EXISTS diagnoses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          equipment TEXT NOT NULL,
          anomaly INTEGER NOT NULL,
          fault TEXT NOT NULL,
          probable_fault TEXT NOT NULL,
          root_cause TEXT NOT NULL,
          severity TEXT NOT NULL,
          confidence REAL NOT NULL,
          risk_score INTEGER DEFAULT 0,
          safety_gate_state TEXT DEFAULT 'NORMAL',
          important_variables TEXT NOT NULL,
          recommended_action TEXT NOT NULL,
          operator_decision TEXT DEFAULT 'NONE'
        )
      `);
      db.run(`ALTER TABLE diagnoses ADD COLUMN risk_score INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE diagnoses ADD COLUMN safety_gate_state TEXT DEFAULT 'NORMAL'`, () => {});
      db.run(`ALTER TABLE diagnoses ADD COLUMN operator_decision TEXT DEFAULT 'NONE'`, () => {});

      // 3. Intelligent System Alerts
      db.run(`
        CREATE TABLE IF NOT EXISTS alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alert_key TEXT UNIQUE,
          equipment TEXT NOT NULL,
          title TEXT NOT NULL,
          parameter TEXT,
          current_value REAL,
          expected_range TEXT,
          unit TEXT,
          severity TEXT NOT NULL,
          explanation TEXT,
          likely_cause TEXT,
          process_impact TEXT,
          related_effects TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          triggered_at TEXT NOT NULL,
          acknowledged_at TEXT,
          cleared_at TEXT
        )
      `);
      // Safe column additions for backward compatibility with existing databases
      const alertCols = [
        'alert_key TEXT', 'title TEXT', 'parameter TEXT', 'current_value REAL',
        'expected_range TEXT', 'unit TEXT', 'explanation TEXT', 'likely_cause TEXT',
        'process_impact TEXT', 'related_effects TEXT', 'status TEXT DEFAULT "ACTIVE"',
        'triggered_at TEXT', 'acknowledged_at TEXT', 'cleared_at TEXT'
      ];
      for (const col of alertCols) {
        db.run(`ALTER TABLE alerts ADD COLUMN ${col}`, () => {});
      }
      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_alert_key ON alerts(alert_key)`, () => {});

      // 4. Operator Audit Approvals (Safety Gate)
      db.run(`
        CREATE TABLE IF NOT EXISTS operator_approvals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          equipment TEXT NOT NULL,
          fault TEXT NOT NULL,
          risk_score INTEGER NOT NULL,
          recommended_measure TEXT NOT NULL,
          operator_decision TEXT NOT NULL,
          operator_note TEXT
        )
      `);

      // 5. SCADA Event Log
      db.run(`
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          event_type TEXT NOT NULL,
          equipment TEXT NOT NULL,
          tag TEXT,
          old_value TEXT,
          new_value TEXT,
          message TEXT NOT NULL,
          source TEXT NOT NULL,
          result TEXT NOT NULL
        )
      `);

      // 6. SCADA Operator Audit Trail
      db.run(`
        CREATE TABLE IF NOT EXISTS audit_trail (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          operator TEXT NOT NULL,
          equipment TEXT NOT NULL,
          action TEXT NOT NULL,
          parameter TEXT,
          old_value TEXT,
          new_value TEXT,
          result TEXT NOT NULL,
          reason TEXT
        )
      `);

      // 7. Persistent SCADA Alarms (Hysteresis & State Management)
      db.run(`
        CREATE TABLE IF NOT EXISTS scada_alarms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tag TEXT NOT NULL UNIQUE,
          equipment TEXT NOT NULL,
          name TEXT NOT NULL,
          message TEXT NOT NULL,
          priority TEXT NOT NULL,
          state TEXT NOT NULL,
          value REAL,
          threshold REAL,
          unit TEXT,
          activated_at TEXT NOT NULL,
          acknowledged_at TEXT,
          cleared_at TEXT
        )
      `);

      // 8. Maintenance Tickets & Action Log
      db.run(`
        CREATE TABLE IF NOT EXISTS maintenance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          equipment TEXT NOT NULL,
          issue TEXT NOT NULL,
          detected_at TEXT NOT NULL,
          severity TEXT NOT NULL,
          recommended_action TEXT NOT NULL,
          operator_action TEXT,
          status TEXT NOT NULL,
          closed_at TEXT,
          updated_at TEXT NOT NULL
        )
      `);

      // 9. Timestamped Historical Trends (Process History)
      db.run(`
        CREATE TABLE IF NOT EXISTS process_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          pump_rpm REAL,
          pump_flow REAL,
          pump_vibration REAL,
          pump_suction_pressure REAL,
          pump_discharge_pressure REAL,
          hx_inlet_temp REAL,
          hx_outlet_temp REAL,
          hx_delta_t REAL,
          hx_flow REAL,
          reactor_feed_flow REAL,
          reactor_temp REAL,
          reactor_pressure REAL,
          reactor_level REAL,
          dist_feed_flow REAL,
          dist_top_temp REAL,
          dist_bottom_temp REAL,
          dist_pressure REAL,
          dist_reflux_ratio REAL
        )
      `);

      // 10. Intermittent & Transient Fault Events
      db.run(`
        CREATE TABLE IF NOT EXISTS intermittent_fault_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT UNIQUE NOT NULL,
          equipment_id TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT,
          duration REAL DEFAULT 0,
          severity TEXT NOT NULL,
          pattern TEXT NOT NULL,
          event_type TEXT,
          variables TEXT NOT NULL,
          values_json TEXT NOT NULL,
          baseline_json TEXT NOT NULL,
          deviation_json TEXT NOT NULL,
          status TEXT NOT NULL,
          observation TEXT,
          interpretation TEXT,
          time_since_previous REAL,
          recurrence_count INTEGER DEFAULT 1,
          average_interval REAL,
          average_duration REAL,
          snapshot_history TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_ife_equip ON intermittent_fault_events(equipment_id)`, () => {});
      db.run(`CREATE INDEX IF NOT EXISTS idx_ife_start ON intermittent_fault_events(start_time)`, () => {});
      db.run(`CREATE INDEX IF NOT EXISTS idx_ife_event_id ON intermittent_fault_events(event_id)`, () => {});

      const extraIfCols = ['event_type TEXT', 'time_since_previous REAL', 'recurrence_count INTEGER', 'average_interval REAL', 'average_duration REAL'];
      for (const col of extraIfCols) {
        db.run(`ALTER TABLE intermittent_fault_events ADD COLUMN ${col}`, () => {});
      }
      resolve();
    });
  });
}

// ----------------------------------------------------
// Telemetry & Diagnoses
// ----------------------------------------------------
export function recordTelemetry(equipment, source, data) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    const query = `INSERT INTO telemetry (timestamp, equipment, source, data) VALUES (?, ?, ?, ?)`;
    db.run(query, [timestamp, equipment, source, JSON.stringify(data)], function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, timestamp });
    });
  });
}

export function recordDiagnosis(diag) {
  return new Promise((resolve, reject) => {
    const timestamp = diag.timestamp || new Date().toISOString();
    const query = `
      INSERT INTO diagnoses (
        timestamp, equipment, anomaly, fault, probable_fault, root_cause, severity, confidence, risk_score, safety_gate_state, important_variables, recommended_action, operator_decision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(query, [
      timestamp,
      diag.equipment,
      diag.anomaly ? 1 : 0,
      diag.fault,
      diag.probable_fault || diag.fault,
      diag.root_cause,
      diag.severity,
      diag.confidence,
      diag.preventive?.riskScore ?? 0,
      diag.safetyGate?.gateState ?? 'NORMAL',
      JSON.stringify(diag.important_variables || []),
      diag.recommended_action,
      diag.operatorApproval?.approved ? 'APPROVED' : 'PENDING'
    ], function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID });
    });
  });
}

export function recordOperatorApproval({ equipment, fault, riskScore, recommendedMeasure, decision = 'APPROVED', note = '' }) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    const query = `
      INSERT INTO operator_approvals (timestamp, equipment, fault, risk_score, recommended_measure, operator_decision, operator_note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(query, [timestamp, equipment, fault, riskScore, recommendedMeasure, decision, note], function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, timestamp, decision });
    });
  });
}

export function getRecentOperatorApprovals(limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM operator_approvals ORDER BY id DESC LIMIT ?`, [limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

// ----------------------------------------------------
// Intelligent Alert Persistence & Lifecycle Management
// ----------------------------------------------------
export function recordIntelligentAlert(alert) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const alertKey = alert.id || alert.alert_key || `${alert.equipment}_${alert.parameter || alert.title}`.toUpperCase();
    const relatedEffectsJson = JSON.stringify(alert.related_effects || []);

    db.get(`SELECT id, status, triggered_at FROM alerts WHERE alert_key = ?`, [alertKey], (err, existing) => {
      if (err) return reject(err);

      if (existing) {
        const reactivate = existing.status === 'CLEARED' && alert.status !== 'CLEARED';
        const finalStatus = reactivate ? 'ACTIVE' : (alert.status || existing.status);
        const finalTriggeredAt = reactivate ? now : existing.triggered_at;
        const finalClearedAt = finalStatus === 'CLEARED' ? (alert.cleared_at || now) : null;

        const updateQuery = `
          UPDATE alerts SET
            equipment = ?,
            title = ?,
            parameter = ?,
            current_value = ?,
            expected_range = ?,
            unit = ?,
            severity = ?,
            explanation = ?,
            likely_cause = ?,
            process_impact = ?,
            related_effects = ?,
            status = ?,
            triggered_at = ?,
            acknowledged_at = ?,
            cleared_at = ?
          WHERE id = ?
        `;
        db.run(
          updateQuery,
          [
            alert.equipment,
            alert.title || alert.fault || 'Process Alert',
            alert.parameter || null,
            alert.current_value !== undefined ? String(alert.current_value) : null,
            alert.expected_range || null,
            alert.unit || '',
            alert.severity || 'WARNING',
            alert.explanation || alert.root_cause || '',
            alert.likely_cause || '',
            alert.process_impact || '',
            relatedEffectsJson,
            finalStatus,
            finalTriggeredAt,
            alert.acknowledged_at || null,
            finalClearedAt,
            existing.id
          ],
          function (uErr) {
            if (uErr) return reject(uErr);
            resolve({ id: existing.id, alert_key: alertKey, status: finalStatus });
          }
        );
      } else {
        const insertQuery = `
          INSERT INTO alerts (
            timestamp, alert_key, equipment, title, fault, root_cause, parameter, current_value, expected_range, unit,
            severity, explanation, likely_cause, process_impact, related_effects, status,
            triggered_at, acknowledged_at, cleared_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(
          insertQuery,
          [
            alert.triggered_at || alert.timestamp || now,
            alertKey,
            alert.equipment,
            alert.title || alert.fault || 'Process Alert',
            alert.fault || alert.title || 'Process Alert',
            alert.root_cause || alert.likely_cause || alert.explanation || 'Anomaly detected',
            alert.parameter || null,
            alert.current_value !== undefined ? String(alert.current_value) : null,
            alert.expected_range || null,
            alert.unit || '',
            alert.severity || 'WARNING',
            alert.explanation || alert.root_cause || '',
            alert.likely_cause || '',
            alert.process_impact || '',
            relatedEffectsJson,
            alert.status || 'ACTIVE',
            alert.triggered_at || alert.timestamp || now,
            alert.acknowledged_at || null,
            alert.status === 'CLEARED' ? (alert.cleared_at || now) : null
          ],
          function (iErr) {
            if (iErr) return reject(iErr);
            resolve({ id: this.lastID, alert_key: alertKey, status: alert.status || 'ACTIVE' });
          }
        );
      }
    });
  });
}

export function acknowledgeIntelligentAlert(idOrKey) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const isNumeric = typeof idOrKey === 'number' || /^\d+$/.test(idOrKey);
    const query = isNumeric
      ? `UPDATE alerts SET status = 'ACKNOWLEDGED', acknowledged_at = ? WHERE id = ? AND status = 'ACTIVE'`
      : `UPDATE alerts SET status = 'ACKNOWLEDGED', acknowledged_at = ? WHERE alert_key = ? AND status = 'ACTIVE'`;

    db.run(query, [now, idOrKey], function (err) {
      if (err) return reject(err);
      resolve({ updated: this.changes, acknowledged_at: now });
    });
  });
}

export function clearIntelligentAlert(idOrKey) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const isNumeric = typeof idOrKey === 'number' || /^\d+$/.test(idOrKey);
    const query = isNumeric
      ? `UPDATE alerts SET status = 'CLEARED', cleared_at = ? WHERE id = ? AND status != 'CLEARED'`
      : `UPDATE alerts SET status = 'CLEARED', cleared_at = ? WHERE alert_key = ? AND status != 'CLEARED'`;

    db.run(query, [now, idOrKey], function (err) {
      if (err) return reject(err);
      resolve({ updated: this.changes, cleared_at: now });
    });
  });
}

export function getActiveIntelligentAlerts() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM alerts
      WHERE status IN ('ACTIVE', 'ACKNOWLEDGED')
      ORDER BY
        CASE severity
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'WARNING' THEN 3
          WHEN 'INFO' THEN 4
          ELSE 5
        END, id DESC
    `;
    db.all(query, [], (err, rows) => {
      if (err) return reject(err);
      const parsed = (rows || []).map(r => ({
        ...r,
        id: r.alert_key || `ALT-${r.id}`,
        db_id: r.id,
        related_effects: JSON.parse(r.related_effects || '[]')
      }));
      resolve(parsed);
    });
  });
}

export function getIntelligentAlertHistory(limit = 50) {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM alerts ORDER BY id DESC LIMIT ?`;
    db.all(query, [limit], (err, rows) => {
      if (err) return reject(err);
      const parsed = (rows || []).map(r => ({
        ...r,
        id: r.alert_key || `ALT-${r.id}`,
        db_id: r.id,
        related_effects: JSON.parse(r.related_effects || '[]')
      }));
      resolve(parsed);
    });
  });
}

// Backward-compatible recordAlert for diagnoses
export function recordAlert(alert) {
  return recordIntelligentAlert({
    id: alert.id || `${alert.equipment}_${alert.fault || 'ALERT'}`.replace(/\s+/g, '_').toUpperCase(),
    equipment: alert.equipment,
    title: alert.title || alert.fault || 'Process Alert',
    severity: alert.severity || 'WARNING',
    explanation: alert.explanation || alert.root_cause || '',
    likely_cause: alert.likely_cause || alert.root_cause || '',
    process_impact: alert.process_impact || '',
    related_effects: alert.related_effects || [],
    status: alert.status || 'ACTIVE'
  });
}

export function getRecentAlerts(limit = 20) {
  return getIntelligentAlertHistory(limit);
}

export function getRecentDiagnoses(limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM diagnoses ORDER BY id DESC LIMIT ?`, [limit], (err, rows) => {
      if (err) return reject(err);
      const parsed = (rows || []).map(r => ({
        ...r,
        anomaly: Boolean(r.anomaly),
        important_variables: JSON.parse(r.important_variables || '[]')
      }));
      resolve(parsed);
    });
  });
}

export function getRecentTelemetry(equipment, limit = 50) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM telemetry`;
    const params = [];
    if (equipment) {
      query += ` WHERE equipment = ?`;
      params.push(equipment);
    }
    query += ` ORDER BY id DESC LIMIT ?`;
    params.push(limit);

    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      const parsed = (rows || []).reverse().map(r => ({
        id: r.id,
        timestamp: r.timestamp,
        equipment: r.equipment,
        source: r.source,
        ...JSON.parse(r.data || '{}')
      }));
      resolve(parsed);
    });
  });
}


// ----------------------------------------------------
// SCADA Events & Operator Audit Trail
// ----------------------------------------------------
export function recordEvent({
  event_type,
  equipment,
  tag = null,
  old_value = null,
  new_value = null,
  message,
  source = 'SCADA System',
  result = 'SUCCESS'
}) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    const query = `
      INSERT INTO events (timestamp, event_type, equipment, tag, old_value, new_value, message, source, result)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
      query,
      [
        timestamp,
        event_type,
        equipment,
        tag ? String(tag) : null,
        old_value !== null && old_value !== undefined ? String(old_value) : null,
        new_value !== null && new_value !== undefined ? String(new_value) : null,
        message,
        source,
        result
      ],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, timestamp });
      }
    );
  });
}

export function getEvents(limit = 100, equipment = null, event_type = null) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM events`;
    const conditions = [];
    const params = [];

    if (equipment && equipment !== 'all') {
      conditions.push(`equipment = ?`);
      params.push(equipment);
    }
    if (event_type && event_type !== 'all') {
      conditions.push(`event_type = ?`);
      params.push(event_type);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    query += ` ORDER BY id DESC LIMIT ?`;
    params.push(limit);

    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

export function recordAuditEntry({
  operator = 'Web Operator',
  equipment,
  action,
  parameter = null,
  old_value = null,
  new_value = null,
  result = 'SUCCESS',
  reason = null
}) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    const query = `
      INSERT INTO audit_trail (timestamp, operator, equipment, action, parameter, old_value, new_value, result, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
      query,
      [
        timestamp,
        operator,
        equipment,
        action,
        parameter ? String(parameter) : null,
        old_value !== null && old_value !== undefined ? String(old_value) : null,
        new_value !== null && new_value !== undefined ? String(new_value) : null,
        result,
        reason
      ],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, timestamp });
      }
    );
  });
}

export function getAuditTrail(limit = 100, equipment = null) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM audit_trail`;
    const params = [];
    if (equipment && equipment !== 'all') {
      query += ` WHERE equipment = ?`;
      params.push(equipment);
    }
    query += ` ORDER BY id DESC LIMIT ?`;
    params.push(limit);

    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

// ----------------------------------------------------
// SCADA Alarms (Hysteresis & States)
// ----------------------------------------------------
export function upsertScadaAlarm({
  tag,
  equipment,
  name,
  message,
  priority = 'MEDIUM',
  state = 'ACTIVE',
  value = null,
  threshold = null,
  unit = ''
}) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const query = `
      INSERT INTO scada_alarms (tag, equipment, name, message, priority, state, value, threshold, unit, activated_at, cleared_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tag) DO UPDATE SET
        equipment = excluded.equipment,
        name = excluded.name,
        message = excluded.message,
        priority = excluded.priority,
        state = excluded.state,
        value = excluded.value,
        threshold = excluded.threshold,
        unit = excluded.unit,
        activated_at = CASE WHEN scada_alarms.state = 'CLEARED' AND excluded.state = 'ACTIVE' THEN excluded.activated_at ELSE scada_alarms.activated_at END,
        cleared_at = excluded.cleared_at
    `;
    db.run(
      query,
      [
        tag,
        equipment,
        name,
        message,
        priority,
        state,
        value,
        threshold,
        unit,
        now,
        state === 'CLEARED' ? now : null
      ],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, tag, state });
      }
    );
  });
}

export function acknowledgeScadaAlarm(idOrTag, operator = 'Web Operator') {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const isId = typeof idOrTag === 'number' || /^\d+$/.test(idOrTag);
    const query = isId
      ? `UPDATE scada_alarms SET state = 'ACKNOWLEDGED', acknowledged_at = ? WHERE id = ? AND state = 'ACTIVE'`
      : `UPDATE scada_alarms SET state = 'ACKNOWLEDGED', acknowledged_at = ? WHERE tag = ? AND state = 'ACTIVE'`;

    db.run(query, [now, idOrTag], function (err) {
      if (err) return reject(err);
      resolve({ updated: this.changes, acknowledged_at: now });
    });
  });
}

export function acknowledgeAllScadaAlarms(operator = 'Web Operator') {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const query = `UPDATE scada_alarms SET state = 'ACKNOWLEDGED', acknowledged_at = ? WHERE state = 'ACTIVE'`;
    db.run(query, [now], function (err) {
      if (err) return reject(err);
      resolve({ updated: this.changes, acknowledged_at: now });
    });
  });
}

export function getScadaAlarms(activeOnly = false, limit = 50) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM scada_alarms`;
    if (activeOnly) {
      query += ` WHERE state IN ('ACTIVE', 'ACKNOWLEDGED')`;
    }
    query += ` ORDER BY CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END, id DESC LIMIT ?`;

    db.all(query, [limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

// ----------------------------------------------------
// Maintenance Ticket Management
// ----------------------------------------------------
export function createMaintenanceRecord({
  equipment,
  issue,
  severity = 'MEDIUM',
  recommended_action,
  operator_action = null,
  status = 'OPEN'
}) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const query = `
      INSERT INTO maintenance (equipment, issue, detected_at, severity, recommended_action, operator_action, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
      query,
      [
        equipment,
        issue,
        now,
        severity,
        recommended_action,
        operator_action,
        status,
        now
      ],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, detected_at: now });
      }
    );
  });
}

export function updateMaintenanceStatus(id, { status, operator_action = null, closed_at = null }) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const finalClosedAt = status === 'RESOLVED' ? (closed_at || now) : null;
    const query = `
      UPDATE maintenance SET
        status = ?,
        operator_action = COALESCE(?, operator_action),
        closed_at = ?,
        updated_at = ?
      WHERE id = ?
    `;
    db.run(query, [status, operator_action, finalClosedAt, now, id], function (err) {
      if (err) return reject(err);
      resolve({ id, status, updated: this.changes, updated_at: now });
    });
  });
}

export function getMaintenanceRecords(status = null, limit = 50) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM maintenance`;
    const params = [];
    if (status && status !== 'ALL') {
      query += ` WHERE status = ?`;
      params.push(status);
    }
    query += ` ORDER BY CASE status WHEN 'OPEN' THEN 1 WHEN 'IN PROGRESS' THEN 2 ELSE 3 END, id DESC LIMIT ?`;
    params.push(limit);

    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

// ----------------------------------------------------
// Timestamped Process History Trends
// ----------------------------------------------------
export function recordProcessHistory(point) {
  return new Promise((resolve, reject) => {
    const timestamp = point.timestamp || new Date().toISOString();
    const query = `
      INSERT INTO process_history (
        timestamp, pump_rpm, pump_flow, pump_vibration, pump_suction_pressure, pump_discharge_pressure,
        hx_inlet_temp, hx_outlet_temp, hx_delta_t, hx_flow,
        reactor_feed_flow, reactor_temp, reactor_pressure, reactor_level,
        dist_feed_flow, dist_top_temp, dist_bottom_temp, dist_pressure, dist_reflux_ratio
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
      query,
      [
        timestamp,
        point.pump_rpm,
        point.pump_flow,
        point.pump_vibration,
        point.pump_suction_pressure,
        point.pump_discharge_pressure,
        point.hx_inlet_temp,
        point.hx_outlet_temp,
        point.hx_delta_t,
        point.hx_flow,
        point.reactor_feed_flow,
        point.reactor_temp,
        point.reactor_pressure,
        point.reactor_level,
        point.dist_feed_flow,
        point.dist_top_temp,
        point.dist_bottom_temp,
        point.dist_pressure,
        point.dist_reflux_ratio
      ],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, timestamp });
      }
    );
  });
}

export function getProcessHistory(limit = 60) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM process_history ORDER BY id DESC LIMIT ?`, [limit], (err, rows) => {
      if (err) return reject(err);
      resolve((rows || []).reverse());
    });
  });
}

// ----------------------------------------------------
// 10. Intermittent & Transient Fault Event Storage
// ----------------------------------------------------
export function recordIntermittentFaultEvent(event) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const query = `
      INSERT OR REPLACE INTO intermittent_fault_events (
        event_id, equipment_id, start_time, end_time, duration, severity,
        pattern, event_type, variables, values_json, baseline_json, deviation_json,
        status, observation, interpretation, time_since_previous, recurrence_count,
        average_interval, average_duration, snapshot_history, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
      query,
      [
        event.event_id,
        event.equipment_id,
        event.start_time || now,
        event.end_time || null,
        Number(event.duration || 0),
        event.severity || 'LOW',
        event.pattern || 'NON-REPEATABLE',
        event.event_type || event.pattern || 'NON-REPEATABLE',
        typeof event.variables === 'string' ? event.variables : JSON.stringify(event.variables || []),
        typeof event.values === 'string' ? event.values : JSON.stringify(event.values || {}),
        typeof event.baseline === 'string' ? event.baseline : JSON.stringify(event.baseline || {}),
        typeof event.deviation === 'string' ? event.deviation : JSON.stringify(event.deviation || {}),
        event.status || 'EVENT ACTIVE',
        event.observation || '',
        event.interpretation || '',
        typeof event.time_since_previous === 'number' ? event.time_since_previous : null,
        typeof event.recurrence_count === 'number' ? event.recurrence_count : 1,
        typeof event.average_interval === 'number' ? event.average_interval : null,
        typeof event.average_duration === 'number' ? event.average_duration : null,
        typeof event.snapshot_history === 'string' ? event.snapshot_history : JSON.stringify(event.snapshot_history || []),
        event.created_at || now,
        now
      ],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, event_id: event.event_id });
      }
    );
  });
}

export function updateIntermittentFaultEvent(eventId, updates) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const query = `
      UPDATE intermittent_fault_events SET
        end_time = COALESCE(?, end_time),
        duration = COALESCE(?, duration),
        severity = COALESCE(?, severity),
        pattern = COALESCE(?, pattern),
        event_type = COALESCE(?, event_type),
        status = COALESCE(?, status),
        observation = COALESCE(?, observation),
        interpretation = COALESCE(?, interpretation),
        time_since_previous = COALESCE(?, time_since_previous),
        recurrence_count = COALESCE(?, recurrence_count),
        average_interval = COALESCE(?, average_interval),
        average_duration = COALESCE(?, average_duration),
        values_json = COALESCE(?, values_json),
        deviation_json = COALESCE(?, deviation_json),
        snapshot_history = COALESCE(?, snapshot_history),
        updated_at = ?
      WHERE event_id = ?
    `;

    db.run(
      query,
      [
        updates.end_time || null,
        typeof updates.duration === 'number' ? updates.duration : null,
        updates.severity || null,
        updates.pattern || null,
        updates.event_type || updates.pattern || null,
        updates.status || null,
        updates.observation || null,
        updates.interpretation || null,
        typeof updates.time_since_previous === 'number' ? updates.time_since_previous : null,
        typeof updates.recurrence_count === 'number' ? updates.recurrence_count : null,
        typeof updates.average_interval === 'number' ? updates.average_interval : null,
        typeof updates.average_duration === 'number' ? updates.average_duration : null,
        updates.values ? (typeof updates.values === 'string' ? updates.values : JSON.stringify(updates.values)) : null,
        updates.deviation ? (typeof updates.deviation === 'string' ? updates.deviation : JSON.stringify(updates.deviation)) : null,
        updates.snapshot_history ? (typeof updates.snapshot_history === 'string' ? updates.snapshot_history : JSON.stringify(updates.snapshot_history)) : null,
        now,
        eventId
      ],
      function (err) {
        if (err) return reject(err);
        resolve({ event_id: eventId, updated: this.changes });
      }
    );
  });
}

export function getIntermittentFaultEvents({ equipmentId = null, pattern = null, status = null, limit = 100 } = {}) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM intermittent_fault_events WHERE 1=1`;
    const params = [];

    if (equipmentId && equipmentId !== 'ALL') {
      query += ` AND (equipment_id = ? OR equipment_id = ?)`;
      params.push(equipmentId, equipmentId.replace(/-/g, ''));
    }

    if (pattern && pattern !== 'ALL') {
      query += ` AND (pattern = ? OR event_type = ?)`;
      params.push(pattern, pattern);
    }

    if (status && status !== 'ALL') {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY id DESC LIMIT ?`;
    params.push(limit);

    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      const parsed = (rows || []).map(r => ({
        id: r.id,
        event_id: r.event_id,
        equipment_id: r.equipment_id,
        start_time: r.start_time,
        end_time: r.end_time,
        duration: r.duration,
        severity: r.severity,
        pattern: r.pattern || r.event_type || 'NON-REPEATABLE',
        event_type: r.event_type || r.pattern || 'NON-REPEATABLE',
        variables: (() => { try { return JSON.parse(r.variables); } catch { return []; } })(),
        values: (() => { try { return JSON.parse(r.values_json); } catch { return {}; } })(),
        baseline: (() => { try { return JSON.parse(r.baseline_json); } catch { return {}; } })(),
        deviation: (() => { try { return JSON.parse(r.deviation_json); } catch { return {}; } })(),
        status: r.status,
        observation: r.observation,
        interpretation: r.interpretation,
        time_since_previous: r.time_since_previous,
        recurrence_count: r.recurrence_count || 1,
        average_interval: r.average_interval,
        average_duration: r.average_duration || r.duration,
        snapshot_history: (() => { try { return JSON.parse(r.snapshot_history); } catch { return []; } })(),
        created_at: r.created_at,
        updated_at: r.updated_at
      }));
      resolve(parsed);
    });
  });
}

export function getIntermittentFaultEventById(eventId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM intermittent_fault_events WHERE event_id = ?`, [eventId], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve({
        id: row.id,
        event_id: row.event_id,
        equipment_id: row.equipment_id,
        start_time: row.start_time,
        end_time: row.end_time,
        duration: row.duration,
        severity: row.severity,
        pattern: row.pattern || row.event_type || 'NON-REPEATABLE',
        event_type: row.event_type || row.pattern || 'NON-REPEATABLE',
        variables: (() => { try { return JSON.parse(row.variables); } catch { return []; } })(),
        values: (() => { try { return JSON.parse(row.values_json); } catch { return {}; } })(),
        baseline: (() => { try { return JSON.parse(row.baseline_json); } catch { return {}; } })(),
        deviation: (() => { try { return JSON.parse(row.deviation_json); } catch { return {}; } })(),
        status: row.status,
        observation: row.observation,
        interpretation: row.interpretation,
        time_since_previous: row.time_since_previous,
        recurrence_count: row.recurrence_count || 1,
        average_interval: row.average_interval,
        average_duration: row.average_duration || row.duration,
        snapshot_history: (() => { try { return JSON.parse(row.snapshot_history); } catch { return []; } })(),
        created_at: row.created_at,
        updated_at: row.updated_at
      });
    });
  });
}

export function getIntermittentFaultStats() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN status = 'EVENT ACTIVE' THEN 1 END) as active_events,
        COUNT(CASE WHEN pattern = 'NON-REPEATABLE' OR event_type = 'NON-REPEATABLE' THEN 1 END) as non_repeatable_events,
        COUNT(CASE WHEN pattern = 'ISOLATED' OR pattern = 'ISOLATED TRANSIENT' OR event_type = 'ISOLATED' OR event_type = 'ISOLATED TRANSIENT' THEN 1 END) as isolated_events,
        COUNT(CASE WHEN pattern = 'SPORADIC' OR event_type = 'SPORADIC' THEN 1 END) as sporadic_events,
        COUNT(CASE WHEN pattern = 'INTERMITTENT' OR event_type = 'INTERMITTENT' THEN 1 END) as intermittent_events,
        COUNT(CASE WHEN pattern = 'RECURRENT' OR event_type = 'RECURRENT' THEN 1 END) as recurrent_events,
        COUNT(CASE WHEN pattern = 'PERSISTENT' OR event_type = 'PERSISTENT' THEN 1 END) as persistent_events,
        AVG(CASE WHEN duration > 0 THEN duration END) as avg_duration,
        MIN(CASE WHEN duration > 0 THEN duration END) as min_duration,
        MAX(CASE WHEN duration > 0 THEN duration END) as max_duration,
        AVG(CASE WHEN time_since_previous > 0 THEN time_since_previous END) as avg_interval,
        MAX(start_time) as last_event_time,
        MIN(start_time) as first_event_time
      FROM intermittent_fault_events
    `;
    db.get(query, [], (err, row) => {
      if (err) return reject(err);
      
      db.all(`
        SELECT 
          equipment_id,
          COUNT(*) as count,
          AVG(duration) as avg_duration,
          AVG(time_since_previous) as avg_interval,
          MAX(start_time) as last_seen
        FROM intermittent_fault_events
        GROUP BY equipment_id
      `, [], (err2, equipRows) => {
        if (err2) return reject(err2);
        
        const byEquipment = {};
        (equipRows || []).forEach(er => {
          byEquipment[er.equipment_id] = {
            count: er.count,
            avg_duration: Number((er.avg_duration || 0).toFixed(1)),
            avg_interval: er.avg_interval ? Number(er.avg_interval.toFixed(1)) : null,
            last_seen: er.last_seen
          };
        });

        resolve({
          total_events: row?.total_events || 0,
          active_events: row?.active_events || 0,
          non_repeatable_events: row?.non_repeatable_events || 0,
          isolated_events: row?.isolated_events || 0,
          sporadic_events: row?.sporadic_events || 0,
          intermittent_events: row?.intermittent_events || 0,
          recurrent_events: row?.recurrent_events || 0,
          persistent_events: row?.persistent_events || 0,
          avg_duration: Number((row?.avg_duration || 0).toFixed(1)),
          min_duration: Number((row?.min_duration || 0).toFixed(1)),
          max_duration: Number((row?.max_duration || 0).toFixed(1)),
          avg_interval: row?.avg_interval ? Number(row.avg_interval.toFixed(1)) : null,
          last_event_time: row?.last_event_time || null,
          first_event_time: row?.first_event_time || null,
          by_equipment: byEquipment
        });
      });
    });
  });
}

export function clearIntermittentFaultEvents() {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM intermittent_fault_events`, function (err) {
      if (err) return reject(err);
      resolve({ cleared: this.changes });
    });
  });
}


