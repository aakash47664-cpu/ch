/**
 * Unit Test Suite: ChemDiag Engineering Calculation Library
 */

import { Units, Fluid, Heat, Thermo, Reaction, Mass, Control, Equipment, executeEngineeringTool } from './engineering/index.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runUnitTests() {
  console.log('=======================================================');
  console.log('🧪 TESTING DETERMINISTIC ENGINEERING CALCULATION LIBRARY');
  console.log('=======================================================\n');

  // 1. Units conversion
  console.log('[1] Unit Conversions:');
  const tempFtoC = Units.convertTemperature(212, 'F', 'C');
  assert(Math.abs(tempFtoC - 100) < 0.01, `212 °F = 100 °C (Got: ${tempFtoC})`);

  const barToPsi = Units.convertUnit(2.0, 'bar', 'psi');
  assert(Math.abs(barToPsi - 29.0075) < 0.05, `2 bar = ~29.0 psi (Got: ${barToPsi.toFixed(2)})`);

  const m3hToLs = Units.convertUnit(36, 'm3/h', 'L/s');
  assert(Math.abs(m3hToLs - 10.0) < 0.01, `36 m³/h = 10 L/s (Got: ${m3hToLs})`);

  // 2. Fluid mechanics: Pipe velocity
  console.log('\n[2] Fluid Mechanics — Pipe Velocity:');
  // 5 m³/h through 25 mm pipe
  // Q = 5 / 3600 = 0.00138889 m³/s
  // A = π * (0.025)² / 4 = 0.00049087 m²
  // v = 0.00138889 / 0.00049087 ≈ 2.829 m/s
  const velRes = Fluid.calcPipeVelocity({ flowRate: 5, flowUnit: 'm3/h', diameter: 25, diameterUnit: 'mm' });
  assert(Math.abs(velRes.results.velocity_ms - 2.829) < 0.02, `Velocity in 25mm pipe at 5 m³/h ≈ 2.83 m/s (Got: ${velRes.results.velocity_ms.toFixed(3)})`);

  // 3. Fluid mechanics: Reynolds Number
  console.log('\n[3] Fluid Mechanics — Reynolds Number:');
  const reRes = Fluid.calcReynoldsNumber({ velocity: 2.0, diameter: 50, density: 1000, viscosity: 0.001 });
  assert(Math.abs(reRes.results.reynolds - 100000) < 1, `Reynolds number = 100,000 (Got: ${reRes.results.reynolds})`);
  assert(reRes.results.isTurbulent === true, 'Regime identified as turbulent');

  // 4. Fluid mechanics: Darcy-Weisbach Pressure Drop
  console.log('\n[4] Fluid Mechanics — Darcy-Weisbach:');
  const dpRes = Fluid.calcDarcyWeisbachPressureDrop({ flowRate: 10, diameter: 50, length: 100 });
  assert(dpRes.results.deltaP_kPa > 0, `Pressure drop computed: ${dpRes.results.deltaP_kPa.toFixed(2)} kPa`);

  // 5. Fluid mechanics: Pump Hydraulic Power
  console.log('\n[5] Fluid Mechanics — Pump Hydraulic Power:');
  // 10 L/s against 20 m head
  // P_hyd = 1000 * 9.80665 * 0.010 * 20 ≈ 1.961 kW
  const pumpRes = Fluid.calcPumpHydraulicPower({ flowRate: 10, flowUnit: 'L/s', head: 20, efficiency: 0.75 });
  assert(Math.abs(pumpRes.results.hydraulicPower_kW - 1.961) < 0.02, `Hydraulic power ≈ 1.96 kW (Got: ${pumpRes.results.hydraulicPower_kW.toFixed(3)} kW)`);
  assert(Math.abs(pumpRes.results.shaftPower_kW - (1.961 / 0.75)) < 0.05, `Shaft power at 75% eff ≈ 2.61 kW (Got: ${pumpRes.results.shaftPower_kW.toFixed(3)} kW)`);

  // 6. Heat Transfer: Sensible Heat Duty
  console.log('\n[6] Heat Transfer — Sensible Heat (Q = m Cp ΔT):');
  // 100 kg water from 25°C to 80°C (ΔT = 55 K, Cp = 4.184 kJ/kg·K)
  // Q = 100 * 4.184 * 55 = 23012 kJ ≈ 23.01 MJ
  const heatBatchRes = Heat.calcSensibleHeatDuty({ mass: 100, specificHeat: 4.184, specificHeatUnit: 'kJ/(kg.K)', tIn: 25, tOut: 80 });
  assert(Math.abs(heatBatchRes.results.duty_kJ - 23012) < 5, `Batch heat energy = 23,012 kJ (Got: ${heatBatchRes.results.duty_kJ})`);

  // Continuous flow: 2 kg/s, Cp = 4.18 kJ/kg-K, ΔT = 10°C
  // Q = 2 * 4.18 * 10 = 83.6 kW
  const heatFlowRes = Heat.calcSensibleHeatDuty({ massFlow: 2, specificHeat: 4.18, deltaT: 10 });
  assert(Math.abs(heatFlowRes.results.power_kW - 83.6) < 0.1, `Continuous duty = 83.6 kW (Got: ${heatFlowRes.results.power_kW})`);

  // 7. Heat Transfer: LMTD
  console.log('\n[7] Heat Transfer — LMTD:');
  // Hot: 100 -> 60, Cold: 20 -> 50 in counter flow
  // ΔT1 = 100 - 50 = 50, ΔT2 = 60 - 20 = 40
  // LMTD = (50 - 40) / ln(50/40) = 10 / 0.22314 ≈ 44.81 °C
  const lmtdRes = Heat.calcLMTD({ tHotIn: 100, tHotOut: 60, tColdIn: 20, tColdOut: 50, flowArrangement: 'counter' });
  assert(Math.abs(lmtdRes.results.lmtd - 44.81) < 0.05, `LMTD ≈ 44.81 °C (Got: ${lmtdRes.results.lmtd.toFixed(2)})`);

  // 8. Thermodynamics: Ideal Gas
  console.log('\n[8] Thermodynamics — Ideal Gas Law:');
  // Air at 1 bar, 25°C (298.15 K), MW = 28.97
  // ρ = (100000 * 0.02897) / (8.314 * 298.15) ≈ 1.169 kg/m³
  const gasRes = Thermo.calcIdealGasLaw({ pressure: 1.0, pressureUnit: 'bar', temperature: 25, temperatureUnit: 'C', molecularWeight: 28.97 });
  assert(Math.abs(gasRes.results.density_kgm3 - 1.169) < 0.02, `Air density at 1 bar, 25°C ≈ 1.17 kg/m³ (Got: ${gasRes.results.density_kgm3.toFixed(3)})`);

  // 9. Thermodynamics: Carnot Efficiency
  console.log('\n[9] Thermodynamics — Carnot Efficiency:');
  // TH = 500 °C = 773.15 K, TC = 25 °C = 298.15 K
  // η = 1 - (298.15 / 773.15) = 1 - 0.3856 = 0.6144 (61.44%)
  const carnotRes = Thermo.calcCarnotEfficiency({ tHot: 500, tCold: 25 });
  assert(Math.abs(carnotRes.results.efficiencyPercent - 61.44) < 0.1, `Carnot efficiency ≈ 61.44% (Got: ${carnotRes.results.efficiencyPercent.toFixed(2)}%)`);

  // 10. Reaction Engineering: CSTR Residence Time
  console.log('\n[10] Reaction Engineering — Residence Time:');
  // Volume = 2 m³, Flow = 4 m³/h -> τ = 0.5 hr = 30 min
  const tauRes = Reaction.calcReactorResidenceTime({ reactorVolume: 2, volumetricFlow: 4 });
  assert(Math.abs(tauRes.results.residenceTime_min - 30.0) < 0.01, `Residence time = 30 min (Got: ${tauRes.results.residenceTime_min})`);

  // 11. Reaction Engineering: Arrhenius Equation
  console.log('\n[11] Reaction Engineering — Arrhenius Rate Constant:');
  const arrRes = Reaction.calcArrheniusRateConstant({ preExponentialFactor: 1e8, activationEnergy: 50, activationEnergyUnit: 'kJ/mol', temperature: 100 });
  assert(arrRes.results.rateConstant_k > 0, `Arrhenius k computed: ${arrRes.results.rateConstant_k.toFixed(3)}`);

  // 12. Mass Transfer: Fenske Minimum Stages
  console.log('\n[12] Mass Transfer — Fenske Distillation Minimum Stages:');
  // xD = 0.95, xB = 0.05, α = 2.5
  // Separation factor = (0.95 / 0.05) * (0.95 / 0.05) = 19 * 19 = 361
  // N_min = ln(361) / ln(2.5) = 5.8888 / 0.91629 ≈ 6.43 stages
  const fenskeRes = Mass.calcFenskeMinimumStages({ distillatePurity: 0.95, bottomsPurity: 0.05, relativeVolatility: 2.5 });
  assert(Math.abs(fenskeRes.results.minStages - 6.43) < 0.05, `Fenske N_min ≈ 6.43 theoretical stages (Got: ${fenskeRes.results.minStages.toFixed(2)})`);

  // 13. Process Control: PID Error & Output
  console.log('\n[13] Process Control — PID Error & Output:');
  // Setpoint = 80°C, PV = 73°C -> error = 7°C
  const errRes = Control.calcControllerError({ setpoint: 80, processVariable: 73 });
  assert(errRes.results.error === 7, `PID error = 7 °C (Got: ${errRes.results.error})`);

  const pidOutRes = Control.calcPIDOutput({ controllerGain: 2.0, error: 7, bias: 50.0 });
  // u = 50 + 2.0 * 7 = 64%
  assert(pidOutRes.results.clampedOutput === 64, `PID output = 64% (Got: ${pidOutRes.results.clampedOutput}%)`);

  // 14. Equipment: Control Valve Cv Sizing
  console.log('\n[14] Equipment — Control Valve Cv Sizing:');
  // Flow = 50 gpm, ΔP = 4 psi, SG = 1.0 -> Cv = 50 * sqrt(1/4) = 25
  const cvRes = Equipment.calcControlValveCv({ flowRate: 50, flowUnit: 'gpm', pressureDrop: 4, pressureDropUnit: 'psi', specificGravity: 1.0 });
  assert(Math.abs(cvRes.results.flowCoefficient_Cv - 25.0) < 0.01, `Valve Cv = 25 (Got: ${cvRes.results.flowCoefficient_Cv})`);

  // 15. Master Dispatcher Tool Execution
  console.log('\n[15] Master Tool Dispatcher:');
  const toolExecRes = await executeEngineeringTool('calcPipeVelocity', { flowRate: 5, flowUnit: 'm3/h', diameter: 25, diameterUnit: 'mm' });
  assert(toolExecRes.success === true && toolExecRes.results.velocity_ms > 2.8, 'Tool dispatcher executed calcPipeVelocity seamlessly');

  console.log('\n=======================================================');
  console.log(`RESULT: ${passed}/${total} Unit Tests Passed (${Math.round((passed/total)*100)}%)`);
  console.log('=======================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runUnitTests().catch(err => {
  console.error('Unit test failure:', err);
  process.exit(1);
});
