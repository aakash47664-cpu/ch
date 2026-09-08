import { answerProcessQuestion, getEquipmentContext } from './services/copilot.js';

console.log('====================================================');
console.log('TESTING CHEMDIAG LOCAL AI COPILOT SERVICE');
console.log('====================================================\n');

// 1. Test Normal Operation
const normalState = {
  activeFault: 'normal',
  diagnosis: {
    equipment: 'Process Plant',
    anomaly: false,
    severity: 'NORMAL',
    probable_fault: 'Nominal Operation',
    root_cause: 'All units operating within baseline bounds.',
    recommended_action: 'Continue routine supervisory monitoring.',
    confidence: 0.98,
    anomaly_score: 0.12
  },
  equipment: {
    pump: { id: 'pump', source: 'demo', data: { rpm: 2450, vibration: 0.08, inlet_temperature: 25.2, outlet_temperature: 38.1 } },
    heat_exchanger: { id: 'heat_exchanger', source: 'demo', data: { inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, heat_transfer_indicator: 95.0 } },
    reactor: { id: 'reactor', source: 'simulated', data: { temperature: 65.0, pressure: 2.05, level: 50.0, agitator_speed: 350, cooling_status: 1 } },
    distillation: { id: 'distillation', source: 'simulated', data: { top_temperature: 76.5, bottom_temperature: 98.4, pressure: 2.10, level: 52.0, reflux_ratio: 1.85 } }
  }
};

const q1 = answerProcessQuestion({ message: 'Is the process normal?', liveState: normalState });
console.log('[TEST 1] "Is the process normal?" (Normal state):');
console.log(q1.answer);
console.log('Intent:', q1.intent, '| Success:', q1.success, '\n---');

// 2. Test Pump Fault
const pumpFaultState = {
  activeFault: 'pump_fault',
  diagnosis: {
    equipment: 'Pump (P-101)',
    anomaly: true,
    severity: 'HIGH',
    probable_fault: 'Pump Mechanical Fault',
    root_cause: 'Possible bearing wear or mechanical imbalance.',
    recommended_action: 'Inspect pump alignment and mechanical condition.',
    confidence: 0.91,
    anomaly_score: 0.82
  },
  equipment: {
    pump: { id: 'pump', source: 'demo', data: { rpm: 1650, vibration: 0.62, inlet_temperature: 26.1, outlet_temperature: 39.5 } },
    heat_exchanger: { id: 'heat_exchanger', source: 'demo', data: { inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, heat_transfer_indicator: 95.0 } },
    reactor: { id: 'reactor', source: 'simulated', data: { temperature: 65.0, pressure: 2.05, level: 50.0, agitator_speed: 350, cooling_status: 1 } },
    distillation: { id: 'distillation', source: 'simulated', data: { top_temperature: 76.5, bottom_temperature: 98.4, pressure: 2.10, level: 52.0, reflux_ratio: 1.85 } }
  }
};

const q2 = answerProcessQuestion({ message: 'Why is the pump abnormal?', liveState: pumpFaultState });
console.log('[TEST 2] "Why is the pump abnormal?" (Pump Fault state):');
console.log(q2.answer);
console.log('Equipment:', q2.equipment, '| Success:', q2.success, '\n---');

// 3. Test Reactor Cooling Failure
const reactorFaultState = {
  activeFault: 'reactor_cooling_failure',
  diagnosis: {
    equipment: 'Reactor (R-201)',
    anomaly: true,
    severity: 'CRITICAL',
    probable_fault: 'Reactor Cooling Failure',
    root_cause: 'Cooling-system failure.',
    recommended_action: 'Check the cooling circulation and heat-removal system and follow the appropriate process safety procedure.',
    confidence: 0.96,
    anomaly_score: 0.94
  },
  equipment: {
    pump: { id: 'pump', source: 'demo', data: { rpm: 2450, vibration: 0.08, inlet_temperature: 25.2, outlet_temperature: 38.1 } },
    heat_exchanger: { id: 'heat_exchanger', source: 'demo', data: { inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, heat_transfer_indicator: 95.0 } },
    reactor: { id: 'reactor', source: 'simulated', data: { temperature: 87.0, pressure: 2.70, level: 50.0, agitator_speed: 350, cooling_status: 0 } },
    distillation: { id: 'distillation', source: 'simulated', data: { top_temperature: 76.5, bottom_temperature: 98.4, pressure: 2.10, level: 52.0, reflux_ratio: 1.85 } }
  }
};

const q3 = answerProcessQuestion({ message: 'Why is the reactor abnormal?', liveState: reactorFaultState });
console.log('[TEST 3] "Why is the reactor abnormal?" (Reactor Cooling Failure state):');
console.log(q3.answer);
console.log('Equipment:', q3.equipment, '| Success:', q3.success, '\n---');

// 4. Test Distillation Fault & What changed
const distFaultState = {
  activeFault: 'distillation_fault',
  diagnosis: {
    equipment: 'Distillation Column (D-101)',
    anomaly: true,
    severity: 'HIGH',
    probable_fault: 'Distillation Separation Fault',
    root_cause: 'Column reflux starvation.',
    recommended_action: 'Check the reflux pump, reflux control valve and condenser.',
    confidence: 0.89,
    anomaly_score: 0.78
  },
  equipment: {
    pump: { id: 'pump', source: 'demo', data: { rpm: 2450, vibration: 0.08, inlet_temperature: 25.2, outlet_temperature: 38.1 } },
    heat_exchanger: { id: 'heat_exchanger', source: 'demo', data: { inlet_temperature: 25.2, outlet_temperature: 38.1, temperature_difference: 12.9, heat_transfer_indicator: 95.0 } },
    reactor: { id: 'reactor', source: 'simulated', data: { temperature: 65.0, pressure: 2.05, level: 50.0, agitator_speed: 350, cooling_status: 1 } },
    distillation: { id: 'distillation', source: 'simulated', data: { top_temperature: 84.0, bottom_temperature: 98.4, pressure: 2.79, level: 52.0, reflux_ratio: 0.65 } }
  }
};

const q4 = answerProcessQuestion({ message: 'Why is the distillation column abnormal?', liveState: distFaultState });
console.log('[TEST 4] "Why is the distillation column abnormal?":');
console.log(q4.answer);
console.log('Equipment:', q4.equipment, '\n---');

const q5 = answerProcessQuestion({ message: 'Which variable changed?', liveState: distFaultState });
console.log('[TEST 5] "Which variable changed?":');
console.log(q5.answer);
console.log('Intent:', q5.intent, '\n---');

// 5. Test Multi-Turn Pronoun Context Resolution
const history1 = [
  { sender: 'user', text: 'Why is the reactor abnormal?' },
  { sender: 'ai', text: 'The reactor is showing a critical condition...' }
];
const q6 = answerProcessQuestion({ message: 'Why is it serious?', history: history1, liveState: reactorFaultState });
console.log('[TEST 6] "Why is it serious?" with context resolution (Reactor):');
console.log(q6.answer);
console.log('Equipment resolved:', q6.equipment, '\n---');

// 6. Test ESP32 Real Data ingestion & query
const esp32RealState = {
  activeFault: 'normal',
  diagnosis: {
    equipment: 'Pump (P-101)',
    anomaly: true,
    severity: 'HIGH',
    probable_fault: 'Pump Mechanical Fault',
    root_cause: 'Possible bearing wear or mechanical imbalance.',
    recommended_action: 'Inspect pump alignment and mechanical condition.',
    confidence: 0.93,
    anomaly_score: 0.88
  },
  equipment: {
    pump: { id: 'pump', source: 'real', data: { rpm: 1650, vibration: 0.62, inlet_temperature: 28.4, outlet_temperature: 34.7 } },
    heat_exchanger: { id: 'heat_exchanger', source: 'real', data: { inlet_temperature: 28.4, outlet_temperature: 34.7, temperature_difference: 6.3, heat_transfer_indicator: 85.0 } },
    reactor: { id: 'reactor', source: 'simulated', data: { temperature: 65.0, pressure: 2.05, level: 50.0, agitator_speed: 350, cooling_status: 1 } },
    distillation: { id: 'distillation', source: 'simulated', data: { top_temperature: 76.5, bottom_temperature: 98.4, pressure: 2.10, level: 52.0, reflux_ratio: 1.85 } }
  }
};

const q7 = answerProcessQuestion({ message: 'Why is the pump abnormal?', liveState: esp32RealState });
console.log('[TEST 7] ESP32 Real Data - "Why is the pump abnormal?":');
console.log(q7.answer);
console.log('Equipment:', q7.equipment, '\n---');

console.log('ALL UNIT LOGIC TESTS COMPLETED SUCCESSFULLY.');
