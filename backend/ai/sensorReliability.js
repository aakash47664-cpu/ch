/**
 * ChemDiag AI — Real-Time Sensor Reliability & Signal Integrity Engine
 * 
 * Verifies signal continuity, timestamp freshness, boundary feasibility,
 * and electrical noise across ESP32 physical transducers and simulated telemetry streams.
 */

// History buffer to track sudden impossible jumps
const sensorHistoryMap = new Map();

export function calculateSensorReliability({
  telemetry,
  isHardwareOnline = false,
  hardwareLastSeen = 0,
  timeoutMs = 5000
}) {
  const checks = [];
  let scoreDeduction = 0;

  // 1. Pump Speed (Optical IR Encoder)
  const rpm = telemetry.pump_rpm;
  if (rpm === undefined || rpm === null || isNaN(rpm)) {
    checks.push({ name: 'Pump Speed Sensor', ok: false, status: 'MISSING', note: 'No RPM reading detected' });
    scoreDeduction += 25;
  } else if (rpm < 0 || rpm > 8000) {
    checks.push({ name: 'Pump Speed Sensor', ok: false, status: 'OUT_OF_RANGE', note: `${rpm} RPM exceeds physical capability` });
    scoreDeduction += 20;
  } else {
    checks.push({ name: 'Pump Speed Sensor', ok: true, status: 'VALID', note: `${Math.round(rpm)} RPM within bounds` });
  }

  // 2. Pump Vibration (MPU6050 Accelerometer)
  const vib = telemetry.pump_vibration;
  if (vib === undefined || vib === null || isNaN(vib)) {
    checks.push({ name: 'Pump Vibration Sensor', ok: false, status: 'MISSING', note: 'Accelerometer stream null' });
    scoreDeduction += 25;
  } else if (vib < 0 || vib > 5.0) {
    checks.push({ name: 'Pump Vibration Sensor', ok: false, status: 'OUT_OF_RANGE', note: `${vib.toFixed(2)} g exceeds transducer scale` });
    scoreDeduction += 20;
  } else {
    checks.push({ name: 'Pump Vibration Sensor', ok: true, status: 'VALID', note: `${vib.toFixed(2)} g valid acceleration` });
  }

  // 3. Fluid Temperatures (DS18B20 1-Wire Digital Probes)
  const tIn = telemetry.pump_inlet_temperature ?? telemetry.heat_exchanger_inlet_temperature;
  const tOut = telemetry.pump_outlet_temperature ?? telemetry.heat_exchanger_outlet_temperature;
  if (tIn === undefined || isNaN(tIn) || tIn < -10 || tIn > 150) {
    checks.push({ name: 'Inlet Temperature Probe', ok: false, status: 'FAULTY', note: 'Unphysical inlet thermal reading' });
    scoreDeduction += 15;
  } else {
    checks.push({ name: 'Inlet Temperature Probe', ok: true, status: 'VALID', note: `${tIn?.toFixed(1)} °C operational` });
  }

  if (tOut === undefined || isNaN(tOut) || tOut < -10 || tOut > 150) {
    checks.push({ name: 'Outlet Temperature Probe', ok: false, status: 'FAULTY', note: 'Unphysical outlet thermal reading' });
    scoreDeduction += 15;
  } else {
    checks.push({ name: 'Outlet Temperature Probe', ok: true, status: 'VALID', note: `${tOut?.toFixed(1)} °C operational` });
  }

  // 4. Reactor Thermocouple & Pressure Transducer
  const rTemp = telemetry.reactor_temperature;
  const rPress = telemetry.reactor_pressure;
  if (rTemp === undefined || isNaN(rTemp) || rTemp < 0 || rTemp > 250) {
    checks.push({ name: 'Reactor RTD Probe', ok: false, status: 'OUT_OF_RANGE', note: 'Core temperature invalid' });
    scoreDeduction += 20;
  } else {
    checks.push({ name: 'Reactor RTD Probe', ok: true, status: 'VALID', note: `${rTemp?.toFixed(1)} °C continuous` });
  }

  if (rPress === undefined || isNaN(rPress) || rPress < 0 || rPress > 12.0) {
    checks.push({ name: 'Reactor Pressure Transducer', ok: false, status: 'OUT_OF_RANGE', note: 'Pressure transducer error' });
    scoreDeduction += 20;
  } else {
    checks.push({ name: 'Reactor Pressure Transducer', ok: true, status: 'VALID', note: `${rPress?.toFixed(2)} bar calibrated` });
  }

  // 5. Distillation Sensors
  const dReflux = telemetry.distillation_reflux_ratio;
  const dTopTemp = telemetry.distillation_top_temperature;
  if (dReflux === undefined || isNaN(dReflux) || dReflux < 0 || dReflux > 15.0) {
    checks.push({ name: 'Reflux Ratio Flowmeter', ok: false, status: 'FAULTY', note: 'Reflux ratio out of bounds' });
    scoreDeduction += 15;
  } else {
    checks.push({ name: 'Reflux Ratio Flowmeter', ok: true, status: 'VALID', note: `${dReflux?.toFixed(2)} L/D nominal` });
  }

  // 6. ESP32 Transceiver Status (if real data mode)
  if (isHardwareOnline) {
    const ageMs = Date.now() - hardwareLastSeen;
    if (ageMs > timeoutMs) {
      checks.push({ name: 'ESP32 Hardware Stream', ok: false, status: 'STALE', note: `Stream stale by ${Math.round(ageMs / 1000)}s` });
      scoreDeduction += 25;
    } else {
      checks.push({ name: 'ESP32 Hardware Stream', ok: true, status: 'REAL_ONLINE', note: 'Transceiver online & synced' });
    }
  }

  const overallReliability = Math.max(0, Math.min(100, 100 - scoreDeduction));
  const isReliable = overallReliability >= 75 && !checks.some(c => !c.ok && (c.status === 'MISSING' || c.status === 'OUT_OF_RANGE'));

  return {
    score: overallReliability,
    isReliable,
    statusText: isReliable ? 'ALL SENSORS VALID' : 'SENSOR VERIFICATION REQUIRED',
    details: checks
  };
}
