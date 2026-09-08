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
      `, (err) => {
        if (err) console.error('Error creating telemetry table:', err);
      });

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
          important_variables TEXT NOT NULL,
          recommended_action TEXT NOT NULL
        )
      `, (err) => {
        if (err) console.error('Error creating diagnoses table:', err);
      });

      // 3. System Alerts
      db.run(`
        CREATE TABLE IF NOT EXISTS alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          equipment TEXT NOT NULL,
          fault TEXT NOT NULL,
          root_cause TEXT NOT NULL,
          severity TEXT NOT NULL
        )
      `, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

// Telemetry insertion
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

// Diagnosis insertion
export function recordDiagnosis(diag) {
  return new Promise((resolve, reject) => {
    const timestamp = diag.timestamp || new Date().toISOString();
    const query = `
      INSERT INTO diagnoses (
        timestamp, equipment, anomaly, fault, probable_fault, root_cause, severity, confidence, important_variables, recommended_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      JSON.stringify(diag.important_variables || []),
      diag.recommended_action
    ], function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID });
    });
  });
}

// Alert insertion with simple anti-spam deduplication (ignore if identical active alert within last 5s)
let lastAlertCache = { key: '', time: 0 };

export function recordAlert(alert) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    const alertKey = `${alert.equipment}-${alert.fault}-${alert.severity}`;
    if (lastAlertCache.key === alertKey && now - lastAlertCache.time < 5000) {
      return resolve(null); // prevent duplicate spamming
    }
    lastAlertCache = { key: alertKey, time: now };

    const timestamp = alert.timestamp || new Date().toISOString();
    const query = `INSERT INTO alerts (timestamp, equipment, fault, root_cause, severity) VALUES (?, ?, ?, ?, ?)`;
    db.run(query, [timestamp, alert.equipment, alert.fault, alert.root_cause, alert.severity], function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, timestamp, ...alert });
    });
  });
}

// Query recent alerts
export function getRecentAlerts(limit = 20) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM alerts ORDER BY id DESC LIMIT ?`, [limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Query recent diagnoses
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

// Query recent telemetry for an equipment
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
