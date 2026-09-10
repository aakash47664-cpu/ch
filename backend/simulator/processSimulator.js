/**
 * ChemDiag AI — Coupled Dynamic Chemical Process Flowsheet Simulation Engine
 * 
 * Simulates a continuous industrial process flowsheet with real cause-and-effect propagation:
 * 
 * WATER SOURCE
 *       ↓ Stream 01 (10.0 L/min, 25.0 °C, 1.01 bar)
 *   P-101 PUMP
 *       ↓ Stream 02 (9.9 L/min, 38.1 °C, 2.80 bar)
 *   E-101 HEAT EXCHANGER
 *       ↓ Stream 03 (9.8 L/min, 36.2 °C, 2.45 bar)
 *   R-101 CSTR REACTOR
 *       ↓ Stream 04 (9.7 L/min, 65.0 °C, 2.05 bar)
 *   D-101 DISTILLATION COLUMN
 *       ↓ Stream 05 (4.4 L/min, 76.5 °C, Reflux Return 8.1 L/min) -> TOP PRODUCT
 *       ↓ Stream 06 (5.2 L/min, 98.4 °C) -> BOTTOM PRODUCT
 * 
 * NOVELTY FEATURE: PROGRESSIVE FAULT SIMULATION
 * Rather than binary jumps, faults smoothly progress across:
 * NORMAL (0.0) -> EARLY DEGRADATION (0.2) -> DEVELOPING (0.4) -> HIGH RISK (0.6) -> CRITICAL (0.8+)
 */

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function noise(magnitude = 0.02) {
  return (Math.random() - 0.5) * 2 * magnitude;
}

export class ProcessSimulator {
  constructor() {
    this.currentFault = 'normal'; // 'normal' | 'early_pump_degradation' | 'pump_fault' | 'early_heat_exchanger_fouling' | 'heat_exchanger_fault' | 'early_reactor_cooling_degradation' | 'reactor_cooling_failure' | 'early_distillation_reflux_loss' | 'distillation_fault' | 'unknown_fault'
    this.faultTicks = 0; // seconds elapsed in current fault state
    this.faultSeverity = 0.0; // 0.0 to 1.0 continuous degradation variable

    // Manual control overrides from flowsheet UI
    this.manualOverrides = {
      pump_rpm: null,                   // e.g. 1500 - 3000 RPM (nominal: 2450)
      heat_exchanger_efficiency: null,  // e.g. 10 - 100 % (nominal: 95.0)
      cooling_status: null,             // 1 = ON, 0 = OFF
      reflux_ratio: null,               // e.g. 0.4 - 3.5 (nominal: 1.85)
      agitator_speed: null              // e.g. 0 - 450 RPM (nominal: 350)
    };

    // Hardware stream hook (ESP32)
    this.externalHardwareState = null;

    // Unit States
    this.pump = {
      rpm: 2450,
      vibration: 0.08,
      flow: 10.0, // L/min
      inlet_temperature: 25.2,
      outlet_temperature: 38.1,
      pressure: 2.80,
      status: 'NORMAL',
      health: 100
    };

    this.heatExchanger = {
      efficiency: 95.0, // %
      inlet_temperature: 25.2,
      outlet_temperature: 38.1,
      temperature_difference: 12.9, // °C
      heat_transfer_indicator: 95.0,
      status: 'NORMAL',
      health: 100
    };

    this.reactor = {
      temperature: 65.0, // °C
      pressure: 2.05,    // bar
      level: 50.0,       // %
      agitator_speed: 350, // RPM
      cooling_status: 1, // 1 = ON, 0 = OFF
      status: 'NORMAL',
      health: 100
    };

    this.distillation = {
      top_temperature: 76.5,    // °C
      bottom_temperature: 98.4, // °C
      pressure: 2.10,           // bar
      level: 52.0,              // %
      reflux_ratio: 1.85,       // L/D
      status: 'NORMAL',
      health: 100
    };

    // Streams
    this.streams = this.calculateStreams();
  }

  setHardwareState(hw) {
    this.externalHardwareState = hw;
  }

  setControlOverrides(overrides) {
    if (overrides.pump_rpm !== undefined) this.manualOverrides.pump_rpm = overrides.pump_rpm;
    if (overrides.heat_exchanger_efficiency !== undefined) this.manualOverrides.heat_exchanger_efficiency = overrides.heat_exchanger_efficiency;
    if (overrides.cooling_status !== undefined) this.manualOverrides.cooling_status = overrides.cooling_status;
    if (overrides.reflux_ratio !== undefined) this.manualOverrides.reflux_ratio = overrides.reflux_ratio;
    if (overrides.agitator_speed !== undefined) this.manualOverrides.agitator_speed = overrides.agitator_speed;
  }

  resetControls() {
    this.manualOverrides = {
      pump_rpm: null,
      heat_exchanger_efficiency: null,
      cooling_status: null,
      reflux_ratio: null,
      agitator_speed: null
    };
  }

  setFault(fault) {
    console.log(` Simulator fault mode switched to: ${fault}`);
    this.currentFault = fault;
    this.faultTicks = 0;
    this.faultSeverity = 0.0;
    this.resetControls();
  }

  getFault() {
    return this.currentFault;
  }

  getFaultTicks() {
    return this.faultTicks;
  }

  getFaultSeverity() {
    return this.faultSeverity;
  }

  // 1-second simulation tick advancing coupled physical equations and progressive degradation
  tick() {
    this.faultTicks++;
    const fault = this.currentFault;
    const t = this.faultTicks;

    // -------------------------------------------------------------------------
    // PROGRESSIVE DEGRADATION DYNAMICS (Smooth faultSeverity Ramp)
    // -------------------------------------------------------------------------
    if (fault === 'normal') {
      this.faultSeverity = Math.max(0.0, this.faultSeverity - 0.1);
    } else if (fault.startsWith('early_')) {
      // Early degradation targets ~0.25 max severity
      const targetSev = 0.24;
      this.faultSeverity += (targetSev - this.faultSeverity) * 0.25;
      this.faultSeverity = clamp(this.faultSeverity, 0.0, 0.32);
    } else if (fault === 'unknown_fault') {
      // Unknown fault stabilizes around moderate anomaly (severity ~0.45)
      const targetSev = 0.45;
      this.faultSeverity += (targetSev - this.faultSeverity) * 0.3;
      this.faultSeverity = clamp(this.faultSeverity, 0.0, 0.55);
    } else {
      // Confirmed fault progressively ramps: 0.0 -> 0.35 -> 0.70 -> 0.95 over ~12 ticks
      const targetSev = Math.min(1.0, 0.20 + (t / 10) * 0.80);
      this.faultSeverity += (targetSev - this.faultSeverity) * 0.35;
      this.faultSeverity = clamp(this.faultSeverity, 0.0, 1.0);
    }

    const s = this.faultSeverity;

    // =========================================================================
    // 1. P-101 PUMP DYNAMICS & FLOW GENERATION
    // =========================================================================
    let targetRpm = 2450;
    let targetVib = 0.08;

    if (this.manualOverrides.pump_rpm !== null) {
      targetRpm = this.manualOverrides.pump_rpm;
      targetVib = targetRpm < 2000 ? 0.35 : 0.08;
    } else if (fault === 'early_pump_degradation') {
      // Early Pump Degradation: Vibration 0.18-0.26g, RPM 2150-2300, Flow 7.5-8.5 L/min
      targetRpm = 2450 - s * (2450 - 2150); // ~2250 RPM
      targetVib = 0.08 + s * (0.28 - 0.08); // ~0.24 g
    } else if (fault === 'pump_fault') {
      // Progressive Pump Mechanical Fault:
      // Normal (2450, 0.08g) -> Early (2200, 0.24g) -> Developing (1950, 0.36g) -> High (1750, 0.46g) -> Critical (<1600, >0.55g)
      targetRpm = 2450 - s * (2450 - 1580);
      targetVib = 0.08 + s * (0.64 - 0.08);
    } else if (fault === 'unknown_fault') {
      // Intentionally unseen combination: slightly reduced RPM + moderate abnormal vibration
      targetRpm = 2450 - s * (2450 - 2250); // ~2350 RPM
      targetVib = 0.08 + s * (0.34 - 0.08); // ~0.28 g
    } else if (this.externalHardwareState && this.externalHardwareState.isConnected) {
      // Feed live ESP32 hardware values
      targetRpm = this.externalHardwareState.rpm;
      targetVib = this.externalHardwareState.vibration;
    }

    // Smooth RPM & Vibration convergence
    this.pump.rpm += (targetRpm - this.pump.rpm) * 0.4 + noise(6);
    this.pump.vibration += (targetVib - this.pump.vibration) * 0.4 + noise(0.008);

    this.pump.rpm = Math.round(clamp(this.pump.rpm, 600, 3200));
    this.pump.vibration = Number(clamp(this.pump.vibration, 0.02, 1.2).toFixed(2));

    // Calculate Flow proportional to RPM: Nominal 2450 RPM -> 10.0 L/min
    const baseFlow = (this.pump.rpm / 2450) * 10.0;
    this.pump.flow = Number(clamp(baseFlow + noise(0.08), 1.0, 15.0).toFixed(1));

    this.pump.inlet_temperature = Number((25.2 + noise(0.05)).toFixed(1));
    this.pump.outlet_temperature = Number((this.pump.inlet_temperature + 12.9 * (this.pump.rpm / 2450) + (this.pump.vibration > 0.25 ? 4.5 * s : 0) + noise(0.1)).toFixed(1));
    this.pump.pressure = Number((1.01 + 1.79 * (this.pump.rpm / 2450) + noise(0.02)).toFixed(2));
    this.pump.health = Math.max(0, Math.round(100 - (this.pump.vibration > 0.20 ? (this.pump.vibration - 0.08) * 160 : 0)));
    this.pump.status = this.pump.vibration > 0.45 ? 'CRITICAL' : (this.pump.vibration > 0.22 ? 'ABNORMAL' : (this.pump.vibration > 0.16 ? 'EARLY_WARNING' : 'NORMAL'));

    // =========================================================================
    // 2. E-101 HEAT EXCHANGER (Coupled to Pump Flow & Progressive Fouling)
    // =========================================================================
    let targetEfficiency = 95.0; // %

    if (this.manualOverrides.heat_exchanger_efficiency !== null) {
      targetEfficiency = this.manualOverrides.heat_exchanger_efficiency;
    } else if (fault === 'early_heat_exchanger_fouling') {
      // Early fouling: Efficiency 65-75%, ΔT 4.5-6.0°C
      targetEfficiency = 95.0 - s * (95.0 - 68.0);
    } else if (fault === 'heat_exchanger_fault') {
      // Progressive Fouling: 95% -> 65% -> 52% -> 42% -> 24%
      targetEfficiency = 95.0 - s * (95.0 - 24.0);
    }

    this.heatExchanger.efficiency += (targetEfficiency - this.heatExchanger.efficiency) * 0.4 + noise(0.3);
    this.heatExchanger.efficiency = Number(clamp(this.heatExchanger.efficiency, 10.0, 100.0).toFixed(1));

    // Incoming flow and temp from P-101
    this.heatExchanger.inlet_temperature = this.pump.outlet_temperature;
    
    // Thermal delta T calculated from efficiency and flow rate
    // Nominal: 95% eff and 10 L/min -> ΔT = 12.9 °C
    const flowFactor = Math.sqrt(this.pump.flow / 10.0);
    const nominalDeltaT = 12.9 * (this.heatExchanger.efficiency / 95.0) * flowFactor;
    this.heatExchanger.temperature_difference = Number(clamp(nominalDeltaT + noise(0.08), 1.0, 18.0).toFixed(1));

    this.heatExchanger.outlet_temperature = Number((this.heatExchanger.inlet_temperature - this.heatExchanger.temperature_difference + 12.9 + noise(0.1)).toFixed(1));
    this.heatExchanger.heat_transfer_indicator = Number(clamp(this.heatExchanger.efficiency * flowFactor, 10.0, 100.0).toFixed(1));
    this.heatExchanger.health = Math.max(0, Math.round((this.heatExchanger.efficiency / 95.0) * 100));
    this.heatExchanger.status = this.heatExchanger.temperature_difference < 2.5 ? 'CRITICAL' : (this.heatExchanger.temperature_difference < 5.0 ? 'ABNORMAL' : (this.heatExchanger.temperature_difference < 6.5 ? 'EARLY_WARNING' : 'NORMAL'));

    // =========================================================================
    // 3. R-101 CSTR REACTOR (Coupled to E-101 Effluent & Progressive Cooling Loss)
    // =========================================================================
    const reactorFeedFlow = this.pump.flow;
    const reactorFeedTemp = this.heatExchanger.outlet_temperature;

    let targetCooling = 1;
    let targetAgitator = 350;

    if (this.manualOverrides.cooling_status !== null) {
      targetCooling = this.manualOverrides.cooling_status;
    } else if (fault === 'early_reactor_cooling_degradation') {
      targetCooling = 1; // Cooling still nominally on, but degraded heat dissipation
    } else if (fault === 'reactor_cooling_failure') {
      targetCooling = s > 0.25 ? 0 : 1;
    }

    if (this.manualOverrides.agitator_speed !== null) {
      targetAgitator = this.manualOverrides.agitator_speed;
    }

    this.reactor.cooling_status = targetCooling;
    this.reactor.agitator_speed += (targetAgitator - this.reactor.agitator_speed) * 0.4 + noise(2);
    this.reactor.agitator_speed = Math.round(clamp(this.reactor.agitator_speed, 0, 450));

    if (fault === 'early_reactor_cooling_degradation') {
      // Early cooling degradation: Temp 70-76°C, Pressure 2.2-2.45 bar
      const nominalReactorTemp = 65.0 + s * (76.0 - 65.0);
      const nominalReactorPress = 2.05 + s * (2.42 - 2.05);

      this.reactor.temperature += (nominalReactorTemp - this.reactor.temperature) * 0.4 + noise(0.12);
      this.reactor.pressure += (nominalReactorPress - this.reactor.pressure) * 0.4 + noise(0.015);
    } else if (fault === 'unknown_fault') {
      // Intentionally unseen: Moderately high temperature (~75°C) and moderately high pressure (~2.4 bar)
      const nominalReactorTemp = 65.0 + s * (76.5 - 65.0);
      const nominalReactorPress = 2.05 + s * (2.45 - 2.05);

      this.reactor.temperature += (nominalReactorTemp - this.reactor.temperature) * 0.4 + noise(0.12);
      this.reactor.pressure += (nominalReactorPress - this.reactor.pressure) * 0.4 + noise(0.015);
    } else if (this.reactor.cooling_status === 0 || fault === 'reactor_cooling_failure') {
      // Progressive runaway: 65°C -> 72°C -> 78°C -> 86°C -> 94°C
      const runawayTemp = 65.0 + s * (94.0 - 65.0);
      const runawayPress = 2.05 + s * (3.80 - 2.05);

      this.reactor.temperature += (runawayTemp - this.reactor.temperature) * 0.4 + noise(0.2);
      this.reactor.pressure += (runawayPress - this.reactor.pressure) * 0.4 + noise(0.02);
    } else {
      // Cooling ON: Base equilibrium ~65°C, modulated by upstream feed temp and feed flow rate
      const feedTempInfluence = (reactorFeedTemp - 38.1) * 0.35;
      const flowInfluence = (reactorFeedFlow - 10.0) * 0.4;
      const nominalReactorTemp = 65.0 + feedTempInfluence - flowInfluence;
      const nominalReactorPress = 2.05 + feedTempInfluence * 0.03;

      this.reactor.temperature += (nominalReactorTemp - this.reactor.temperature) * 0.4 + noise(0.12);
      this.reactor.pressure += (nominalReactorPress - this.reactor.pressure) * 0.4 + noise(0.015);
    }

    this.reactor.temperature = Number(clamp(this.reactor.temperature, 45.0, 115.0).toFixed(1));
    this.reactor.pressure = Number(clamp(this.reactor.pressure, 1.20, 5.50).toFixed(2));
    this.reactor.level = Number(clamp(50.0 + (reactorFeedFlow - 10.0) * 1.5 + noise(0.2), 25.0, 85.0).toFixed(1));
    this.reactor.health = Math.max(0, Math.round(100 - (this.reactor.temperature > 65.0 ? (this.reactor.temperature - 65.0) * 3.5 : 0)));
    this.reactor.status = this.reactor.temperature > 85.0 || this.reactor.pressure > 3.0 ? 'CRITICAL' : (this.reactor.temperature > 74.0 ? 'ABNORMAL' : (this.reactor.temperature > 69.0 ? 'EARLY_WARNING' : 'NORMAL'));

    // =========================================================================
    // 4. D-101 DISTILLATION COLUMN (Coupled to R-101 & Progressive Reflux Decay)
    // =========================================================================
    const distFeedFlow = reactorFeedFlow;
    const distFeedTemp = this.reactor.temperature;

    let targetReflux = 1.85;

    if (this.manualOverrides.reflux_ratio !== null) {
      targetReflux = this.manualOverrides.reflux_ratio;
    } else if (fault === 'early_distillation_reflux_loss') {
      // Early reflux loss: Reflux 1.50 -> 1.30, Top temp 77.5 - 79.0°C
      targetReflux = 1.85 - s * (1.85 - 1.30);
    } else if (fault === 'distillation_fault') {
      // Progressive reflux starvation: 1.85 -> 1.45 -> 1.10 -> 0.85 -> 0.60
      targetReflux = 1.85 - s * (1.85 - 0.60);
    }

    this.distillation.reflux_ratio += (targetReflux - this.distillation.reflux_ratio) * 0.4 + noise(0.02);
    this.distillation.reflux_ratio = Number(clamp(this.distillation.reflux_ratio, 0.35, 4.0).toFixed(2));

    // Separation dynamics: Lower reflux OR higher feed temp -> Top Temp rises, Pressure rises
    const refluxLossEffect = (1.85 - this.distillation.reflux_ratio) * 6.5;
    const reactorTempThermalEffect = (distFeedTemp - 65.0) * 0.18;

    const nominalTopTemp = 76.5 + refluxLossEffect + reactorTempThermalEffect;
    const nominalBottomTemp = 98.4 + (distFeedTemp - 65.0) * 0.12;
    const nominalColumnPress = 2.10 + refluxLossEffect * 0.55 + reactorTempThermalEffect * 0.03;

    this.distillation.top_temperature += (nominalTopTemp - this.distillation.top_temperature) * 0.4 + noise(0.12);
    this.distillation.bottom_temperature += (nominalBottomTemp - this.distillation.bottom_temperature) * 0.3 + noise(0.1);
    this.distillation.pressure += (nominalColumnPress - this.distillation.pressure) * 0.4 + noise(0.015);
    this.distillation.level = Number(clamp(52.0 + (distFeedFlow - 10.0) * 1.2 + noise(0.2), 30.0, 75.0).toFixed(1));

    this.distillation.top_temperature = Number(clamp(this.distillation.top_temperature, 55.0, 95.0).toFixed(1));
    this.distillation.bottom_temperature = Number(clamp(this.distillation.bottom_temperature, 85.0, 115.0).toFixed(1));
    this.distillation.pressure = Number(clamp(this.distillation.pressure, 1.20, 3.80).toFixed(2));
    this.distillation.health = Math.max(0, Math.round(100 - (this.distillation.reflux_ratio < 1.85 ? (1.85 - this.distillation.reflux_ratio) * 80 : 0)));
    this.distillation.status = this.distillation.reflux_ratio < 0.75 || this.distillation.top_temperature > 84.0 ? 'CRITICAL' : (this.distillation.reflux_ratio < 1.15 ? 'ABNORMAL' : (this.distillation.reflux_ratio < 1.50 ? 'EARLY_WARNING' : 'NORMAL'));

    // =========================================================================
    // 5. CALCULATE PROCESS STREAMS (01 through 06)
    // =========================================================================
    this.streams = this.calculateStreams();

    return this.getState();
  }

  calculateStreams() {
    const qPump = this.pump.flow;
    const tPumpIn = this.pump.inlet_temperature;
    const tPumpOut = this.pump.outlet_temperature;
    const pPumpOut = this.pump.pressure;

    const tHxOut = this.heatExchanger.outlet_temperature;
    const pHxOut = Number(clamp(pPumpOut - 0.35, 1.05, 3.50).toFixed(2));

    const tReactor = this.reactor.temperature;
    const pReactor = this.reactor.pressure;

    const tTop = this.distillation.top_temperature;
    const tBottom = this.distillation.bottom_temperature;
    const pDist = this.distillation.pressure;
    const reflux = this.distillation.reflux_ratio;

    const topProductFlow = Number((qPump * 0.45).toFixed(1));
    const refluxReturnFlow = Number((topProductFlow * reflux).toFixed(1));
    const bottomProductFlow = Number((qPump * 0.53).toFixed(1));

    return {
      stream_1: {
        id: '01',
        name: 'Water Source Feed',
        from: 'Raw Water Tank',
        to: 'P-101 Centrifugal Pump',
        flow: qPump,
        temperature: tPumpIn,
        pressure: 1.01
      },
      stream_2: {
        id: '02',
        name: 'Pump Discharge Stream',
        from: 'P-101 Centrifugal Pump',
        to: 'E-101 Shell & Tube Exchanger',
        flow: Number((qPump * 0.99).toFixed(1)),
        temperature: tPumpOut,
        pressure: pPumpOut
      },
      stream_3: {
        id: '03',
        name: 'Conditioned Exchanger Effluent',
        from: 'E-101 Heat Exchanger',
        to: 'R-101 CSTR Reactor',
        flow: Number((qPump * 0.98).toFixed(1)),
        temperature: tHxOut,
        pressure: pHxOut
      },
      stream_4: {
        id: '04',
        name: 'Reactor Reaction Effluent',
        from: 'R-101 CSTR Reactor',
        to: 'D-101 Binary Distillation Column',
        flow: Number((qPump * 0.97).toFixed(1)),
        temperature: tReactor,
        pressure: pReactor
      },
      stream_5: {
        id: '05',
        name: 'Overhead Distillate & Reflux Loop',
        from: 'D-101 Overhead Condenser',
        to: 'Product Tank / Reflux Return',
        flow: topProductFlow,
        temperature: tTop,
        pressure: pDist,
        reflux_ratio: reflux,
        reflux_flow: refluxReturnFlow
      },
      stream_6: {
        id: '06',
        name: 'Column Bottoms Product',
        from: 'D-101 Column Reboiler',
        to: 'Bottoms Storage',
        flow: bottomProductFlow,
        temperature: tBottom,
        pressure: Number((pDist + 0.15).toFixed(2))
      }
    };
  }

  getState() {
    return {
      timestamp: new Date().toISOString(),
      current_fault: this.currentFault,
      fault_ticks: this.faultTicks,
      fault_severity: Number(this.faultSeverity.toFixed(3)),
      manual_overrides: { ...this.manualOverrides },
      pump: { ...this.pump },
      heatExchanger: { ...this.heatExchanger },
      reactor: { ...this.reactor },
      distillation: { ...this.distillation },
      streams: { ...this.streams },
      // Backward compatibility aliases
      demoPump: {
        rpm: this.pump.rpm,
        vibration: this.pump.vibration,
        inlet_temperature: this.pump.inlet_temperature,
        outlet_temperature: this.pump.outlet_temperature,
        flow: this.pump.flow
      },
      demoHeatExchanger: {
        inlet_temperature: this.heatExchanger.inlet_temperature,
        outlet_temperature: this.heatExchanger.outlet_temperature,
        temperature_difference: this.heatExchanger.temperature_difference,
        heat_transfer_indicator: this.heatExchanger.heat_transfer_indicator,
        efficiency: this.heatExchanger.efficiency
      }
    };
  }
}
