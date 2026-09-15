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
      `, (err) => {
        if (err) return reject(err);
        resolve();
      });
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
